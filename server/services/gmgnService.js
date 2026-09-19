import axios from 'axios';
import https from 'https';
import crypto from 'crypto';
import { getSetting } from '../db/database.js';

const GMGN_OPENAPI_HOST = 'https://openapi.gmgn.ai';
export const DEFAULT_GMGN_API_KEY = 'gmgn_59afed5e6c4e5fbd0e2fd5930ce75d6a';

export class GmgnService {
  constructor() {
    this.clockOffsetMs = 0;
    this.lastSyncTime = 0;
    this.syncPromise = null;
    // 立即启动服务器时钟校准
    this.syncServerTime().catch(() => {});
  }

  getApiKey() {
    const key = getSetting('gmgn_api_key', process.env.GMGN_API_KEY || DEFAULT_GMGN_API_KEY);
    return (key && key.trim()) ? key.trim() : DEFAULT_GMGN_API_KEY;
  }

  // 是否已配置有效 API Key
  hasApiKey() {
    const key = this.getApiKey();
    return !!(key && key.trim().length > 5);
  }

  // 自动与 GMGN 官方服务器校准时钟偏差 (确保 timestamp 在 ±5s 验证窗口内)
  async syncServerTime(force = false) {
    const now = Date.now();
    if (!force && this.lastSyncTime && (now - this.lastSyncTime < 10 * 60 * 1000)) {
      return this.clockOffsetMs;
    }
    if (this.syncPromise) return this.syncPromise;

    this.syncPromise = new Promise((resolve) => {
      const req = https.request(`${GMGN_OPENAPI_HOST}/v1/user/info`, { method: 'GET', timeout: 5000 }, (res) => {
        const dateHeader = res.headers.date;
        if (dateHeader) {
          const serverTime = new Date(dateHeader).getTime();
          this.clockOffsetMs = serverTime - Date.now();
          this.lastSyncTime = Date.now();
          console.log(`[GMGN Service] ⏰ 服务器时间校准完成，时钟偏差: ${Math.round(this.clockOffsetMs / 1000)}s`);
        }
        resolve(this.clockOffsetMs);
      });
      req.on('error', (err) => {
        console.warn('[GMGN Service] 时钟校准网络超时，沿用当前偏差:', err.message);
        resolve(this.clockOffsetMs);
      });
      req.on('timeout', () => {
        req.destroy();
        resolve(this.clockOffsetMs);
      });
      req.end();
    }).finally(() => {
      this.syncPromise = null;
    });

    return this.syncPromise;
  }

  // 构建带时钟校准的 GMGN OpenAPI 认证参数
  buildAuthParams() {
    const syncedNow = Date.now() + this.clockOffsetMs;
    return {
      timestamp: Math.floor(syncedNow / 1000),
      client_id: crypto.randomUUID()
    };
  }

  // 基础请求方法
  async request(method, subPath, queryParams = {}, body = null, retried = false) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('未配置 GMGN_API_KEY');
    }

    // 确保至少做过一次时间校准
    if (!this.lastSyncTime) {
      await this.syncServerTime();
    }

    const auth = this.buildAuthParams();
    const fullParams = { ...queryParams, ...auth };

    const url = `${GMGN_OPENAPI_HOST}${subPath}`;
    const headers = {
      'X-APIKEY': apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'gmgn-cli/1.6.6'
    };

    try {
      const res = await axios({
        method,
        url,
        params: fullParams,
        data: body,
        headers,
        timeout: 10000
      });

      if (res.data && res.data.code === 0) {
        return res.data.data;
      }
      throw new Error(res.data?.msg || res.data?.message || 'GMGN API 请求返回非零状态码');
    } catch (err) {
      // 若遇到 timestamp expired 错误，强制重新校准时钟重试一次
      if (!retried && err.response?.data?.error === 'AUTH_TIMESTAMP_EXPIRED') {
        console.warn('[GMGN Service] 收到 AUTH_TIMESTAMP_EXPIRED，重新校对服务器时钟并重试...');
        await this.syncServerTime(true);
        return this.request(method, subPath, queryParams, body, true);
      }
      throw err;
    }
  }

  // 获取官方精准代币信息 (含精准 MC、当前价格、池子信息、聪明钱持有人统计)
  async getTokenInfo(address, chain = 'sol') {
    if (!address) return null;
    try {
      const data = await this.request('GET', '/v1/token/info', {
        chain,
        address
      });
      const token = data?.data || data;
      if (!token) return null;

      const price = parseFloat(token.price?.price || 0);
      const supply = parseFloat(token.circulating_supply || token.total_supply || 0);
      const marketCap = parseFloat(token.market_cap || (price * supply) || 0);

      return {
        address: token.address,
        symbol: (token.symbol || '').replace(/^\$/, ''),
        name: token.name || '',
        price,
        marketCap,
        liquidity: parseFloat(token.liquidity || 0),
        holderCount: token.holder_count || 0,
        smartWalletsCount: token.wallet_tags_stat?.smart_wallets || 0,
        renownedWalletsCount: token.wallet_tags_stat?.renowned_wallets || 0,
        whaleWalletsCount: token.wallet_tags_stat?.whale_wallets || 0,
        priceChange1h: parseFloat(token.price?.price_1h || 0),
        volume24h: parseFloat(token.price?.volume_24h || 0),
        raw: token
      };
    } catch (err) {
      // 记录简要日志，便于排查
      // console.warn(`[GMGN Service] 查询代币信息失败 (${address}):`, err.message);
      return null;
    }
  }

  // 获取全网 1h / 24h 热门排行与金狗排行 (带 20s 内存缓存防止 429 限频)
  async getMarketRank(chain = 'sol', interval = '1h') {
    const cacheKey = `${chain}_${interval}`;
    const now = Date.now();
    if (!this.rankCache) this.rankCache = new Map();

    if (this.rankCache.has(cacheKey)) {
      const entry = this.rankCache.get(cacheKey);
      if (now - entry.timestamp < 20000) {
        return entry.data;
      }
    }

    try {
      const data = await this.request('GET', '/v1/market/rank', {
        chain,
        interval
      });
      const list = data?.data?.rank || data?.rank || (Array.isArray(data) ? data : []);
      const result = list.map(item => ({
        address: item.address,
        symbol: (item.symbol || '').replace(/^\$/, ''),
        name: item.name || '',
        logo: item.logo || '',
        price: parseFloat(item.price || 0),
        marketCap: parseFloat(item.market_cap || 0),
        volume: parseFloat(item.volume || 0),
        buys: item.buys || 0,
        sells: item.sells || 0,
        priceChangePercent: parseFloat(item.price_change_percent || item.price_change_percent1h || 0),
        smartDegenCount: item.smart_degen_count || 0,
        renownedCount: item.renowned_count || 0,
        sniperCount: item.sniper_count || 0,
        holderCount: item.holder_count || 0
      }));
      this.rankCache.set(cacheKey, { timestamp: now, data: result });
      return result;
    } catch (err) {
      if (this.rankCache.has(cacheKey)) {
        return this.rankCache.get(cacheKey).data;
      }
      console.warn('[GMGN Service] 获取 Market Rank 失败:', err.message);
      return [];
    }
  }

  // 获取聪明钱最新交易记录 (带 8s 频控与 429 优雅退避)
  async getSmartMoneyTrades(limit = 50, chain = 'sol') {
    if (!this.hasApiKey()) {
      return null;
    }
    const now = Date.now();
    if (this.smCooldownUntil && now < this.smCooldownUntil) {
      return this.lastSmTrades || [];
    }
    if (this.lastSmTradesTime && (now - this.lastSmTradesTime < 8000)) {
      return this.lastSmTrades || [];
    }

    try {
      const data = await this.request('GET', '/v1/user/smartmoney', {
        chain,
        limit
      });
      const list = data?.list || (Array.isArray(data) ? data : []);
      this.lastSmTrades = list;
      this.lastSmTradesTime = now;
      return list;
    } catch (err) {
      if (err.response?.status === 429) {
        // 遇到 429，冷静 15 秒并复用已有数据
        this.smCooldownUntil = now + 15000;
        return this.lastSmTrades || [];
      }
      return this.lastSmTrades || [];
    }
  }

  // 获取指定钱包交易活动
  async getWalletActivity(walletAddress, limit = 20, chain = 'sol') {
    if (!this.hasApiKey()) {
      return null;
    }
    try {
      const data = await this.request('GET', '/v1/user/wallet_activity', {
        chain,
        wallet_address: walletAddress,
        limit
      });
      return data?.activities || data?.list || [];
    } catch (err) {
      console.warn(`[GMGN Service] 查询钱包活动失败 (${walletAddress}):`, err.message);
      return null;
    }
  }
}

export const gmgnService = new GmgnService();


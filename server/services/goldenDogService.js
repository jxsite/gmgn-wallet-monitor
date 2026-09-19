import { gmgnService } from './gmgnService.js';
import { telegramService } from './telegramService.js';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../data/monitor.db');

export class GoldenDogService {
  constructor() {
    this.io = null;
    this.alertedTokens = new Map(); // tokenAddress -> timestamp
    this.db = new DatabaseSync(dbPath);
  }

  setSocketServer(io) {
    this.io = io;
  }

  // 聚合计算金狗榜单 (支持按聪明钱买入人数 或 买入总金额 排序)
  async getGoldenDogs(sortBy = 'buyers', limit = 20) {
    // 1. 从本地数据库聚合监控到的聪明钱买入数据
    const alertAggStmt = this.db.prepare(`
      SELECT 
        token_address,
        token_symbol,
        token_name,
        COUNT(DISTINCT wallet_address) as buyer_count,
        SUM(amount_usd) as total_buy_usd,
        MAX(mc_at_event) as latest_event_mc,
        MIN(created_at) as first_buy_time,
        MAX(created_at) as last_buy_time
      FROM alerts
      WHERE UPPER(side) = 'BUY'
      GROUP BY token_address
      ORDER BY buyer_count DESC, total_buy_usd DESC
    `);
    const localAgg = alertAggStmt.all() || [];

    // 2. 获取 GMGN 官方全网 1h 实时热门/聪明钱排行
    let gmgnRanks = [];
    try {
      gmgnRanks = await gmgnService.getMarketRank('sol', '1h');
    } catch (e) {
      console.warn('[GoldenDog] 获取 GMGN Rank 失败，沿用本地聚合:', e.message);
    }

    const gmgnMap = new Map();
    for (const r of gmgnRanks) {
      gmgnMap.set(r.address, r);
    }

    // 3. 整合本地监控数据与 GMGN 全网数据
    const tokenMap = new Map();

    for (const item of localAgg) {
      const gmgnData = gmgnMap.get(item.token_address);
      
      // 查询该代币的前三大买入聪明钱
      const buyersStmt = this.db.prepare(`
        SELECT DISTINCT wallet_address, wallet_label, amount_usd, created_at
        FROM alerts
        WHERE token_address = ? AND UPPER(side) = 'BUY'
        ORDER BY amount_usd DESC
        LIMIT 5
      `);
      const buyers = buyersStmt.all(item.token_address) || [];

      const currentMc = gmgnData?.marketCap || item.latest_event_mc || 0;
      const priceChange = gmgnData?.priceChangePercent || 0;
      const smartDegenCount = gmgnData?.smartDegenCount || 0;
      const renownedCount = gmgnData?.renownedCount || 0;

      tokenMap.set(item.token_address, {
        address: item.token_address,
        symbol: (item.token_symbol || gmgnData?.symbol || '').replace(/^\$/, ''),
        name: item.token_name || gmgnData?.name || '',
        logo: gmgnData?.logo || '',
        price: gmgnData?.price || 0,
        marketCap: currentMc,
        priceChangePercent: priceChange,
        top100BuyerCount: item.buyer_count, // 本地获利前100聪明钱买入人数
        totalSmartBuyUsd: parseFloat((item.total_buy_usd || 0).toFixed(2)), // 本地聪明钱买入总金额
        gmgnSmartCount: smartDegenCount, // GMGN 全网聪明钱数
        gmgnRenownedCount: renownedCount, // GMGN 知名鲸鱼数
        volume1h: gmgnData?.volume || 0,
        buyers,
        lastBuyTime: item.last_buy_time,
        source: 'MONITORED_AND_GMGN'
      });
    }

    // 4. 将 GMGN 排行榜上高共识代币合并补充进金狗池
    for (const r of gmgnRanks) {
      if (!tokenMap.has(r.address) && (r.smartDegenCount > 5 || r.renownedCount > 0 || r.buys > 50)) {
        tokenMap.set(r.address, {
          address: r.address,
          symbol: r.symbol,
          name: r.name,
          logo: r.logo,
          price: r.price,
          marketCap: r.marketCap,
          priceChangePercent: r.priceChangePercent,
          top100BuyerCount: 0,
          totalSmartBuyUsd: 0,
          gmgnSmartCount: r.smartDegenCount,
          gmgnRenownedCount: r.renownedCount,
          volume1h: r.volume,
          buyers: [],
          lastBuyTime: null,
          source: 'GMGN_TRENDING'
        });
      }
    }

    let result = Array.from(tokenMap.values());

    // 5. 排序规则
    if (sortBy === 'volume' || sortBy === 'value') {
      // 聪明钱买入金额最多 (优先看本地聪明钱买入金额，次看全网成交量)
      result.sort((a, b) => {
        if (b.totalSmartBuyUsd !== a.totalSmartBuyUsd) {
          return b.totalSmartBuyUsd - a.totalSmartBuyUsd;
        }
        return (b.volume1h || 0) - (a.volume1h || 0);
      });
    } else {
      // 聪明钱买入人数最多 (优先看本地获利前100聪明钱买入人数，次看全网聪明钱数)
      result.sort((a, b) => {
        if (b.top100BuyerCount !== a.top100BuyerCount) {
          return b.top100BuyerCount - a.top100BuyerCount;
        }
        if (b.gmgnSmartCount !== a.gmgnSmartCount) {
          return b.gmgnSmartCount - a.gmgnSmartCount;
        }
        return b.totalSmartBuyUsd - a.totalSmartBuyUsd;
      });
    }

    return result.slice(0, limit);
  }

  // 检查是否达到突发金狗标准并推送 Telegram 预警
  async checkAndAlertGoldenDog(tokenAddress) {
    if (!tokenAddress) return;
    const now = Date.now();
    const lastAlert = this.alertedTokens.get(tokenAddress) || 0;
    if (now - lastAlert < 60 * 60 * 1000) {
      // 1小时内不重复轰炸
      return;
    }

    const aggStmt = this.db.prepare(`
      SELECT 
        token_symbol,
        token_name,
        COUNT(DISTINCT wallet_address) as buyer_count,
        SUM(amount_usd) as total_buy_usd
      FROM alerts
      WHERE token_address = ? AND UPPER(side) = 'BUY'
    `);
    const stats = aggStmt.get(tokenAddress);
    if (!stats) return;

    const buyerCount = stats.buyer_count || 0;
    const totalBuyUsd = stats.total_buy_usd || 0;

    // 达到金狗门槛：>= 2 个监控顶级聪明钱买入，或买入总额 >= $5,000 USD
    if (buyerCount >= 2 || totalBuyUsd >= 5000) {
      this.alertedTokens.set(tokenAddress, now);

      const buyersStmt = this.db.prepare(`
        SELECT DISTINCT wallet_address, wallet_label, amount_usd
        FROM alerts
        WHERE token_address = ? AND side = 'buy'
        ORDER BY amount_usd DESC
        LIMIT 5
      `);
      const buyers = buyersStmt.all(tokenAddress) || [];

      // 查询实时精确 MC
      let currentMc = 0;
      let priceChange = 0;
      try {
        const info = await gmgnService.getTokenInfo(tokenAddress);
        currentMc = info?.marketCap || 0;
        priceChange = info?.priceChange1h || 0;
      } catch (e) {}

      console.log(`[GoldenDog] 🔥 触发金狗共识预警: $${stats.token_symbol} (买入人数: ${buyerCount}, 总额: $${totalBuyUsd})`);

      await telegramService.sendGoldenDogAlert({
        tokenSymbol: stats.token_symbol,
        tokenName: stats.token_name,
        tokenAddress,
        smartBuyersCount: buyerCount,
        totalBuyUsd,
        currentMc,
        priceChangePercent: priceChange,
        topBuyers: buyers
      });

      if (this.io) {
        this.io.emit('goldendog:alert', {
          tokenAddress,
          symbol: stats.token_symbol,
          buyerCount,
          totalBuyUsd,
          currentMc
        });
      }
    }
  }
}

export const goldenDogService = new GoldenDogService();
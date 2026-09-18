import axios from 'axios';
import crypto from 'crypto';
import { getSetting } from '../db/database.js';

const GMGN_OPENAPI_HOST = 'https://openapi.gmgn.ai';

// 构建 GMGN OpenAPI 认证请求参数
function buildAuthParams() {
  return {
    timestamp: Math.floor(Date.now() / 1000),
    client_id: crypto.randomUUID()
  };
}

export class GmgnService {
  constructor() {}

  getApiKey() {
    return getSetting('gmgn_api_key', process.env.GMGN_API_KEY || '');
  }

  // 是否已配置有效 API Key
  hasApiKey() {
    const key = this.getApiKey();
    return !!(key && key.trim().length > 5);
  }

  // 基础请求方法
  async request(method, subPath, queryParams = {}, body = null) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('未配置 GMGN_API_KEY');
    }

    const auth = buildAuthParams();
    const fullParams = { ...queryParams, ...auth };

    const url = `${GMGN_OPENAPI_HOST}${subPath}`;
    const headers = {
      'X-APIKEY': apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'gmgn-cli/1.6.6'
    };

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
  }

  // 获取聪明钱最新交易记录
  async getSmartMoneyTrades(limit = 50) {
    if (!this.hasApiKey()) {
      return null;
    }
    try {
      const data = await this.request('GET', '/v1/user/smartmoney', {
        chain: 'sol',
        limit
      });
      return data?.list || (Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('[GMGN Service] 获取 SmartMoney 交易记录失败:', err.message);
      return null;
    }
  }

  // 获取指定钱包交易活动
  async getWalletActivity(walletAddress, limit = 20) {
    if (!this.hasApiKey()) {
      return null;
    }
    try {
      const data = await this.request('GET', '/v1/user/wallet_activity', {
        chain: 'sol',
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

import axios from 'axios';
import { gmgnService } from './gmgnService.js';

// 简单内存缓存防止频繁请求
const cache = new Map();
const CACHE_TTL_MS = 3000;

export async function getTokenMarketData(tokenAddress) {
  if (!tokenAddress) return null;

  const now = Date.now();
  if (cache.has(tokenAddress)) {
    const cached = cache.get(tokenAddress);
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  // 1. 优先使用官方 GMGN OpenAPI 获取最权威精准的 MC 与实时价格
  try {
    const gmgnInfo = await gmgnService.getTokenInfo(tokenAddress);
    if (gmgnInfo && gmgnInfo.marketCap > 0) {
      const data = {
        symbol: gmgnInfo.symbol || 'UNKNOWN',
        name: gmgnInfo.name || 'Unknown Token',
        address: tokenAddress,
        priceUsd: gmgnInfo.price,
        marketCap: gmgnInfo.marketCap,
        fdv: gmgnInfo.marketCap,
        liquidityUsd: gmgnInfo.liquidity || 0,
        volume24h: gmgnInfo.volume24h || 0,
        holderCount: gmgnInfo.holderCount || 0,
        smartWalletsCount: gmgnInfo.smartWalletsCount || 0,
        dexUrl: `https://dexscreener.com/solana/${tokenAddress}`,
        gmgnUrl: `https://gmgn.ai/sol/token/${tokenAddress}`,
        chain: 'sol',
        source: 'GMGN_OFFICIAL'
      };
      cache.set(tokenAddress, { timestamp: now, data });
      return data;
    }
  } catch (e) {
    // 降级继续
  }

  // 2. 次选 DexScreener 作为备用兜底
  try {
    const res = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    if (res.data && Array.isArray(res.data.pairs) && res.data.pairs.length > 0) {
      // 优选流动性最高的交易对
      const sortedPairs = [...res.data.pairs].sort((a, b) => {
        const liqA = a.liquidity?.usd || 0;
        const liqB = b.liquidity?.usd || 0;
        return liqB - liqA;
      });

      const bestPair = sortedPairs[0];
      const marketCap = bestPair.marketCap || bestPair.fdv || 0;
      const priceUsd = parseFloat(bestPair.priceUsd || '0');

      const data = {
        symbol: bestPair.baseToken?.symbol || 'UNKNOWN',
        name: bestPair.baseToken?.name || 'Unknown Token',
        address: tokenAddress,
        priceUsd,
        marketCap: parseFloat(marketCap) || 0,
        fdv: parseFloat(bestPair.fdv || '0'),
        liquidityUsd: bestPair.liquidity?.usd || 0,
        volume24h: bestPair.volume?.h24 || 0,
        dexUrl: bestPair.url || `https://dexscreener.com/solana/${tokenAddress}`,
        pairAddress: bestPair.pairAddress,
        chain: bestPair.chainId || 'solana',
        source: 'DEXSCREENER_FALLBACK'
      };

      cache.set(tokenAddress, { timestamp: now, data });
      return data;
    }
  } catch (err) {
    console.error(`[PriceService] 获取代币价格/MC 失败 (${tokenAddress}):`, err.message);
  }

  // 兜底返回默认值
  return null;
}

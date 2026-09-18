import {
  insertPosition,
  getOpenPositions,
  updatePositionPrice,
  closePosition as dbClosePosition,
  getAllPositions,
  getSetting
} from '../db/database.js';
import { getTokenMarketData } from './priceService.js';

export class TradingSimulator {
  constructor() {
    this.io = null;
    this.updateTimer = null;
    this.isUpdating = false;
  }

  setSocketServer(io) {
    this.io = io;
  }

  // 启动后台定时更新持仓行情
  start(intervalMs = 5000) {
    if (this.updateTimer) clearInterval(this.updateTimer);
    this.updateTimer = setInterval(() => this.updateOpenPositions(), intervalMs);
    console.log(`[Simulator] 模拟交易价格刷新引擎已启动 (每 ${intervalMs / 1000}s 刷新)`);
  }

  stop() {
    if (this.updateTimer) clearInterval(this.updateTimer);
  }

  // 触发模拟买入 10U
  async executeSimulatedBuy({
    tokenAddress,
    tokenSymbol,
    tokenName,
    triggerWallet,
    buyAmountUsd = null,
    chain = 'sol'
  }) {
    const isEnabled = getSetting('auto_buy_enabled', 'true') === 'true';
    if (!isEnabled) {
      console.log('[Simulator] 模拟自动买入已禁用，跳过开仓');
      return null;
    }

    const defaultAmount = parseFloat(getSetting('auto_buy_amount', '10')) || 10.0;
    const amount = buyAmountUsd !== null ? buyAmountUsd : defaultAmount;

    // 获取实时行情以获取精准的开仓 MC
    let marketData = await getTokenMarketData(tokenAddress);
    const entryMc = marketData?.marketCap || marketData?.fdv || 100000;
    const entryPrice = marketData?.priceUsd || 0.0001;
    const symbol = marketData?.symbol || tokenSymbol || 'UNKNOWN';
    const name = marketData?.name || tokenName || 'Token';

    const positionData = {
      token_address: tokenAddress,
      token_symbol: symbol,
      token_name: name,
      chain,
      entry_mc: entryMc,
      entry_price: entryPrice,
      entry_amount: amount,
      current_mc: entryMc,
      current_price: entryPrice,
      current_pnl_ratio: 0.0,
      trigger_wallet: triggerWallet
    };

    const positionId = insertPosition(positionData);
    const newPosition = { id: positionId, ...positionData, status: 'OPEN', created_at: new Date().toISOString() };

    console.log(`[Simulator] 🟢 模拟开仓成功: 买入 $${amount} 的 $${symbol} (CA: ${tokenAddress.slice(0, 8)}...), 入场 MC: $${entryMc.toLocaleString()}`);

    // WebSocket 广播新开仓
    if (this.io) {
      this.io.emit('position:new', newPosition);
      this.broadcastSummary();
    }

    return newPosition;
  }

  // 轮询更新所有持仓代币的最新 MC 与收益率
  async updateOpenPositions() {
    if (this.isUpdating) return;
    this.isUpdating = true;

    try {
      const openPositions = getOpenPositions();
      if (openPositions.length === 0) {
        this.isUpdating = false;
        return;
      }

      // 获取唯一代币地址
      const uniqueTokens = [...new Set(openPositions.map(p => p.token_address))];

      for (const tokenAddr of uniqueTokens) {
        const marketData = await getTokenMarketData(tokenAddr);
        if (!marketData) continue;

        const currentMc = marketData.marketCap || marketData.fdv;
        const currentPrice = marketData.priceUsd;

        if (!currentMc) continue;

        // 更新数据库中该代币的所有仓位
        const relatedPositions = openPositions.filter(p => p.token_address === tokenAddr);
        for (const pos of relatedPositions) {
          const entryMc = pos.entry_mc || 1;
          const pnlRatio = parseFloat((((currentMc - entryMc) / entryMc) * 100).toFixed(2));
          updatePositionPrice(pos.id, currentMc, currentPrice, pnlRatio);
        }
      }

      // 广播更新后的持仓列表
      if (this.io) {
        const updatedPositions = getOpenPositions();
        this.io.emit('positions:update', updatedPositions);
        this.broadcastSummary();
      }
    } catch (err) {
      console.error('[Simulator] 刷新持仓行情出错:', err.message);
    } finally {
      this.isUpdating = false;
    }
  }

  // 平仓
  async closePosition(positionId) {
    dbClosePosition(positionId);
    console.log(`[Simulator] 🔴 模拟平仓已执行: 仓位 #${positionId}`);
    if (this.io) {
      const updatedPositions = getOpenPositions();
      this.io.emit('positions:update', updatedPositions);
      this.broadcastSummary();
    }
    return { success: true };
  }

  // 获取汇总数据统计
  getSummary() {
    const openPositions = getOpenPositions();
    const allPositions = getAllPositions();

    const totalOpenCost = openPositions.reduce((acc, p) => acc + (p.entry_amount || 10), 0);
    const totalCurrentVal = openPositions.reduce((acc, p) => {
      const pnlFactor = 1 + (p.current_pnl_ratio || 0) / 100;
      return acc + (p.entry_amount || 10) * pnlFactor;
    }, 0);

    const unrealizedProfit = totalCurrentVal - totalOpenCost;
    const overallPnlRatio = totalOpenCost > 0 ? ((totalCurrentVal - totalOpenCost) / totalOpenCost) * 100 : 0;

    return {
      openPositionsCount: openPositions.length,
      totalPositionsCount: allPositions.length,
      totalOpenCost: parseFloat(totalOpenCost.toFixed(2)),
      totalCurrentVal: parseFloat(totalCurrentVal.toFixed(2)),
      unrealizedProfit: parseFloat(unrealizedProfit.toFixed(2)),
      overallPnlRatio: parseFloat(overallPnlRatio.toFixed(2))
    };
  }

  broadcastSummary() {
    if (this.io) {
      this.io.emit('summary:update', this.getSummary());
    }
  }
}

export const tradingSimulator = new TradingSimulator();

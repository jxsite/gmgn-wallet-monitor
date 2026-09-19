import {
  insertPosition,
  getOpenPositions,
  updatePositionPrice,
  updatePositionStrategy,
  closePosition as dbClosePosition,
  getAllPositions,
  hasOpenPositionForToken,
  getSetting
} from '../db/database.js';
import { getTokenMarketData } from './priceService.js';
import { telegramService } from './telegramService.js';

// 策略设定的里程碑倍数
const MILESTONE_MULTIPLIERS = [2, 3, 4, 5, 10, 20, 30, 50, 70, 100];

export class TradingSimulator {
  constructor() {
    this.io = null;
    this.updateTimer = null;
    this.isUpdating = false;
  }

  setSocketServer(io) {
    this.io = io;
  }

  // 启动后台定时更新持仓行情与策略检测
  start(intervalMs = 5000) {
    if (this.updateTimer) clearInterval(this.updateTimer);
    this.updateTimer = setInterval(() => this.updateOpenPositions(), intervalMs);
    console.log(`[Simulator] 模拟交易价格刷新与止盈止损策略引擎已启动 (每 ${intervalMs / 1000}s 刷新)`);
  }

  stop() {
    if (this.updateTimer) clearInterval(this.updateTimer);
  }

  // 检查某个代币是否已持仓
  hasOpenPosition(tokenAddress) {
    return hasOpenPositionForToken(tokenAddress);
  }

  // 触发模拟买入 10U（包含防重复买入检查）
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
      return { skipped: true, reason: 'DISABLED' };
    }

    // 核心需求1：如果已有持仓，严禁重复买入同币种
    if (this.hasOpenPosition(tokenAddress)) {
      console.log(`[Simulator] ⚠️ 代币 $${tokenSymbol || ''} (${tokenAddress.slice(0, 8)}...) 已处于持仓中，策略执行：防重复开仓，跳过买入！`);
      return { skipped: true, reason: 'ALREADY_HELD' };
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
    const newPosition = {
      id: positionId,
      ...positionData,
      status: 'OPEN',
      has_taken_profit_3x: 0,
      realized_profit: 0.0,
      reached_milestones: '[]',
      created_at: new Date().toISOString()
    };

    console.log(`[Simulator] 🟢 模拟开仓成功: 买入 $${amount} 的 $${symbol} (CA: ${tokenAddress.slice(0, 8)}...), 入场 MC: $${entryMc.toLocaleString()}`);

    // WebSocket 广播新开仓
    if (this.io) {
      this.io.emit('position:new', newPosition);
      this.broadcastSummary();
    }

    return newPosition;
  }

  // 轮询更新持仓行情并执行：【翻3倍卖1.5倍】、【倍数里程碑提醒】、【跌50%直接清仓】
  async updateOpenPositions() {
    if (this.isUpdating) return;
    this.isUpdating = true;

    try {
      const openPositions = getOpenPositions();
      if (openPositions.length === 0) {
        this.isUpdating = false;
        return;
      }

      // 获取唯一代币地址查询最新行情
      const uniqueTokens = [...new Set(openPositions.map(p => p.token_address))];
      const marketDataMap = new Map();

      for (const tokenAddr of uniqueTokens) {
        const data = await getTokenMarketData(tokenAddr);
        if (data) marketDataMap.set(tokenAddr, data);
      }

      for (const pos of openPositions) {
        const marketData = marketDataMap.get(pos.token_address);
        if (!marketData) continue;

        const currentMc = marketData.marketCap || marketData.fdv;
        const currentPrice = marketData.priceUsd;
        if (!currentMc) continue;

        const entryMc = pos.entry_mc || 1;
        const multiplier = currentMc / entryMc;
        const pnlRatio = parseFloat((((currentMc - entryMc) / entryMc) * 100).toFixed(2));

        // ----------------------------------------------------
        // 策略规则 1: 如果跌 50% 就直接清仓 (止损清仓)
        // ----------------------------------------------------
        if (pnlRatio <= -50.0) {
          console.log(`[Strategy] 🛑 代币 $${pos.token_symbol} 跌破 50% (当前 ${pnlRatio}%)，执行立即清仓止损！`);
          updatePositionStrategy(pos.id, {
            current_mc: currentMc,
            current_price: currentPrice,
            current_pnl_ratio: pnlRatio,
            status: 'CLOSED',
            close_reason: 'STOP_LOSS_50'
          });

          // 电报推送跌破50%清仓通知
          await telegramService.sendStopLossAlert({
            tokenSymbol: pos.token_symbol,
            tokenAddress: pos.token_address,
            entryMc,
            currentMc,
            pnlRatio
          });

          continue;
        }

        // ----------------------------------------------------
        // 策略规则 2: 翻三倍卖 1.5 倍 (3x 止盈收回本金加纯利，剩余零成本继续持有)
        // ----------------------------------------------------
        let hasTakenProfit3x = pos.has_taken_profit_3x || 0;
        let realizedProfit = pos.realized_profit || 0.0;

        if (multiplier >= 3.0 && hasTakenProfit3x === 0) {
          hasTakenProfit3x = 1;
          realizedProfit = realizedProfit + 15.0; // 卖出 1.5 倍本金 (收回 15U)
          console.log(`[Strategy] 🎯 代币 $${pos.token_symbol} 达成 3x 翻三倍！自动卖出 1.5 倍本金 ($15U) 锁定利润，剩余零成本继续持有！`);

          updatePositionStrategy(pos.id, {
            current_mc: currentMc,
            current_price: currentPrice,
            current_pnl_ratio: pnlRatio,
            has_taken_profit_3x: 1,
            realized_profit: realizedProfit
          });

          // 电报推送翻3倍止盈通知
          await telegramService.sendTakeProfit3xAlert({
            tokenSymbol: pos.token_symbol,
            tokenAddress: pos.token_address,
            entryMc,
            currentMc,
            pnlRatio
          });
        } else {
          updatePositionPrice(pos.id, currentMc, currentPrice, pnlRatio);
        }

        // ----------------------------------------------------
        // 策略规则 3: 达到 2, 3, 4, 5, 10, 20, 30, 50, 70, 100 倍数推送提醒
        // ----------------------------------------------------
        let reachedMilestones = [];
        try {
          reachedMilestones = JSON.parse(pos.reached_milestones || '[]');
        } catch (e) {
          reachedMilestones = [];
        }

        for (const m of MILESTONE_MULTIPLIERS) {
          if (multiplier >= m && !reachedMilestones.includes(m)) {
            reachedMilestones.push(m);
            console.log(`[Strategy] 🚀 代币 $${pos.token_symbol} 达成 ${m} 倍里程碑！推送暴涨提醒！`);

            updatePositionStrategy(pos.id, {
              reached_milestones: JSON.stringify(reachedMilestones)
            });

            await telegramService.sendMilestoneAlert({
              tokenSymbol: pos.token_symbol,
              tokenAddress: pos.token_address,
              multiplier: m,
              entryMc,
              currentMc,
              pnlRatio
            });
            break; // 每次刷新周期只触发当前最新达成的一级
          }
        }
      }

      // 广播更新后的持仓列表
      if (this.io) {
        const updatedPositions = getOpenPositions();
        this.io.emit('positions:update', updatedPositions);
        this.broadcastSummary();
      }
    } catch (err) {
      console.error('[Simulator] 刷新持仓与策略执行出错:', err.message);
    } finally {
      this.isUpdating = false;
    }
  }

  // 手动平仓
  async closePosition(positionId) {
    dbClosePosition(positionId, 'MANUAL');
    console.log(`[Simulator] 🔴 模拟手动平仓已执行: 仓位 #${positionId}`);
    if (this.io) {
      const updatedPositions = getOpenPositions();
      this.io.emit('positions:update', updatedPositions);
      this.broadcastSummary();
    }
    return { success: true };
  }

  // 获取汇总数据统计（包含已锁定落袋收益）
  getSummary() {
    const openPositions = getOpenPositions();
    const allPositions = getAllPositions();

    const totalOpenCost = openPositions.reduce((acc, p) => acc + (p.entry_amount || 10), 0);
    const totalCurrentVal = openPositions.reduce((acc, p) => {
      const pnlFactor = 1 + (p.current_pnl_ratio || 0) / 100;
      // 若已卖出1.5倍(50%仓位)，剩余持仓代币价值为当前估值的一半
      const remainingRatio = p.has_taken_profit_3x ? 0.5 : 1.0;
      return acc + (p.entry_amount || 10) * pnlFactor * remainingRatio;
    }, 0);

    const totalRealized = allPositions.reduce((acc, p) => acc + (p.realized_profit || 0), 0);
    const unrealizedProfit = totalCurrentVal - totalOpenCost;
    const overallPnlRatio = totalOpenCost > 0 ? ((totalCurrentVal + totalRealized - totalOpenCost) / totalOpenCost) * 100 : 0;

    return {
      openPositionsCount: openPositions.length,
      totalPositionsCount: allPositions.length,
      totalOpenCost: parseFloat(totalOpenCost.toFixed(2)),
      totalCurrentVal: parseFloat(totalCurrentVal.toFixed(2)),
      totalRealizedProfit: parseFloat(totalRealized.toFixed(2)),
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

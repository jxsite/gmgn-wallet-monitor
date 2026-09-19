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
    chain = 'sol',
    entryPrice: passedEntryPrice = null
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
    const entryPrice = passedEntryPrice || marketData?.price || marketData?.priceUsd || 0.0001;
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

  clear() {
    this.isUpdating = false;
    if (this.io) {
      this.io.emit('positions:update', []);
      this.broadcastSummary();
    }
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

        const currentMc = marketData.marketCap || marketData.fdv || 0;
        const currentPrice = marketData.priceUsd || marketData.price || 0;
        if (!currentMc && !currentPrice) continue;

        const entryMc = pos.entry_mc || 1;
        const entryPrice = pos.entry_price || 0;

        // 计算当前收益倍数：优先以代币单价比例为准（避免因代币铸造销毁或流动性池污染导致虚高）
        let multiplier = 1.0;
        if (entryPrice > 0 && currentPrice > 0) {
          multiplier = currentPrice / entryPrice;
        } else if (entryMc > 0 && currentMc > 0) {
          multiplier = currentMc / entryMc;
        }

        // 极端异常保护：如果倍数突变超过 50000x（通常是流动性池被抽干或脏池子污染），进行平滑保护
        if (multiplier > 50000 && pos.entry_price > 10) {
          console.warn(`[Simulator] ⚠️ 捕获到代币异常价格突变，忽略该次异常波动: ${pos.token_symbol}`);
          continue;
        }

        const pnlRatio = parseFloat(((multiplier - 1) * 100).toFixed(2));

        // 数据自愈修复：如果当前真实倍数远低于 2.5x，但数据库错误记录了已3倍止盈（测试污染），自动修正重置
        let hasTakenProfit3x = pos.has_taken_profit_3x || 0;
        let realizedProfit = pos.realized_profit || 0.0;
        if (multiplier < 2.5 && hasTakenProfit3x === 1) {
          console.warn(`[Simulator] ⚠️ 发现持仓 $${pos.token_symbol} 存在历史异常止盈标记 (当前仅 ${multiplier.toFixed(2)}x)，自动修正重置`);
          hasTakenProfit3x = 0;
          realizedProfit = 0.0;
          updatePositionStrategy(pos.id, {
            has_taken_profit_3x: 0,
            realized_profit: 0.0,
            reached_milestones: '[]'
          });
        }

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

  // 获取汇总数据统计（包含浮亏、浮盈、已锁定落袋收益、综合净盈亏）
  getSummary() {
    const openPositions = getOpenPositions();
    const allPositions = getAllPositions();

    const totalOpenCost = openPositions.reduce((acc, p) => acc + (p.entry_amount || 10), 0);
    
    let totalCurrentVal = 0;
    let totalFloatingLoss = 0;
    let totalFloatingProfit = 0;

    for (const p of openPositions) {
      const pnlFactor = 1 + (p.current_pnl_ratio || 0) / 100;
      const cost = p.entry_amount || 10;
      // 若已触发3x卖出1.5倍(50%仓位)，剩余持仓代币价值为当前估值的一半
      const remainingRatio = p.has_taken_profit_3x ? 0.5 : 1.0;
      const posVal = cost * pnlFactor * remainingRatio;
      const posPnl = posVal - (p.has_taken_profit_3x ? 0 : cost);

      totalCurrentVal += posVal;
      if (posPnl < 0) {
        totalFloatingLoss += posPnl;
      } else {
        totalFloatingProfit += posPnl;
      }
    }

    const totalRealized = allPositions.reduce((acc, p) => acc + (p.realized_profit || 0), 0);
    const unrealizedProfit = totalCurrentVal - totalOpenCost;
    const netTotalProfit = unrealizedProfit + totalRealized;
    const overallPnlRatio = totalOpenCost > 0 ? (netTotalProfit / totalOpenCost) * 100 : 0;

    return {
      openPositionsCount: openPositions.length,
      totalPositionsCount: allPositions.length,
      totalOpenCost: parseFloat(totalOpenCost.toFixed(2)),
      totalCurrentVal: parseFloat(totalCurrentVal.toFixed(2)),
      totalFloatingLoss: parseFloat(totalFloatingLoss.toFixed(2)), // 明确告知当前总浮亏金额 (负数，如 -$15.50)
      totalFloatingProfit: parseFloat(totalFloatingProfit.toFixed(2)), // 当前总浮盈金额
      totalRealizedProfit: parseFloat(totalRealized.toFixed(2)), // 已锁定落袋收益
      unrealizedProfit: parseFloat(unrealizedProfit.toFixed(2)), // 净浮动盈亏
      netTotalProfit: parseFloat(netTotalProfit.toFixed(2)), // 综合总盈亏 (浮动+落袋)
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

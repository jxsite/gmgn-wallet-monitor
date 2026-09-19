import React, { useState } from 'react';
import { TrendingUp, ArrowUpRight, ArrowDownRight, ExternalLink, DollarSign, Copy, Check, Zap, Target, ShieldAlert, Sparkles, AlertTriangle } from 'lucide-react';
import axios from 'axios';

function formatMC(val) {
  if (!val || isNaN(val)) return '$0';
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
  return `$${Number(val).toFixed(2)}`;
}

function formatPrice(price) {
  if (!price || isNaN(price)) return '$0.00';
  const num = Number(price);
  if (num >= 1) return `$${num.toFixed(4)}`;
  if (num >= 0.001) return `$${num.toFixed(6)}`;
  return `$${num.toFixed(8)}`;
}

export default function PaperTrading({ positions, onClosePosition, onManualBuy, summary }) {
  const [copiedCA, setCopiedCA] = useState(null);
  const [customCA, setCustomCA] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testStrategyMsg, setTestStrategyMsg] = useState('');

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedCA(id);
    setTimeout(() => setCopiedCA(null), 2000);
  };

  const handleManualBuySubmit = async (e) => {
    e.preventDefault();
    if (!customCA.trim()) return;
    setIsSubmitting(true);
    await onManualBuy(customCA.trim());
    setCustomCA('');
    setIsSubmitting(false);
  };

  // 策略模拟快速触发测试
  const handleTestStrategy = async (multiplier) => {
    try {
      const res = await axios.post('/api/test/strategy', { targetMultiplier: multiplier });
      setTestStrategyMsg(res.data.message);
      setTimeout(() => setTestStrategyMsg(''), 4000);
    } catch (err) {
      setTestStrategyMsg('策略测试失败: ' + (err.response?.data?.error || err.message));
      setTimeout(() => setTestStrategyMsg(''), 4000);
    }
  };

  // 计算当前总体亏损统计
  const totalCost = summary?.totalOpenCost || (positions?.length || 0) * 10;
  const currentVal = summary?.totalCurrentVal || 0;
  const totalLoss = summary?.totalFloatingLoss || 0;
  const totalProfit = summary?.totalFloatingProfit || 0;
  const realizedProfit = summary?.totalRealizedProfit || 0;
  const netTotalPnl = summary?.netTotalProfit || (currentVal - totalCost + realizedProfit);

  return (
    <div className="space-y-6">
      {/* 核心盈亏直观统计看板 (清楚呈现我的 10U 当前亏损了多少) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 当前总浮动亏损 */}
        <div className="glass-panel p-4 rounded-xl border border-rose-500/30 bg-rose-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-400 flex items-center space-x-1">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              <span>当前 10U 浮动总亏损</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono">
              亏损仓位
            </span>
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-bold font-mono text-rose-400">
              {totalLoss < 0 ? `-$${Math.abs(totalLoss).toFixed(2)}` : '$0.00'}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              当前亏损中仓位累计亏损金额 (USD)
            </p>
          </div>
        </div>

        {/* 投入本金 vs 当前估值 */}
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">总投入本金 ➔ 当前现值</span>
            <span className="text-[10px] text-slate-400 font-mono">{positions?.length || 0} 笔活跃</span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline space-x-2">
              <h3 className="text-2xl font-bold font-mono text-white">
                ${currentVal.toFixed(2)}
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                / 成本 ${totalCost.toFixed(2)}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              单笔买入 10 USD，防重复开仓已生效
            </p>
          </div>
        </div>

        {/* 翻3倍已卖1.5倍已锁定纯利 */}
        <div className="glass-panel p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400 flex items-center space-x-1">
              <Target className="h-4 w-4 text-amber-400" />
              <span>翻3倍已锁定落袋收益</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
              无风险本利
            </span>
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-bold font-mono text-amber-400">
              +${realizedProfit.toFixed(2)}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              达 3x 时已卖出 15U（收回 10U 本金 + 净赚 5U）
            </p>
          </div>
        </div>

        {/* 综合总净回报 */}
        <div className={`glass-panel p-4 rounded-xl border ${
          netTotalPnl >= 0 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${netTotalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              综合总盈亏 (浮动 + 落袋)
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
              netTotalPnl >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
            }`}>
              {summary?.overallPnlRatio >= 0 ? '+' : ''}{summary?.overallPnlRatio?.toFixed(2) || '0.00'}%
            </span>
          </div>
          <div className="mt-2">
            <h3 className={`text-2xl font-bold font-mono ${netTotalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {netTotalPnl >= 0 ? `+$${netTotalPnl.toFixed(2)}` : `-$${Math.abs(netTotalPnl).toFixed(2)}`}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              跌50%清仓止损保护本金，防极端归零
            </p>
          </div>
        </div>
      </div>

      {/* 策略规则看板 */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800/80">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Target className="h-4 w-4 text-brand-green" />
              <span>当前执行自动化策略体系</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3 text-xs">
              <div className="bg-dark-800/80 p-2.5 rounded-xl border border-slate-700/60">
                <span className="text-brand-cyan font-semibold block">1. 严禁重复买入</span>
                <span className="text-slate-400 text-[11px]">同代币 CA 已有持仓时，聪明钱再买入只记录流水，不重复扣款建仓。</span>
              </div>
              <div className="bg-dark-800/80 p-2.5 rounded-xl border border-slate-700/60">
                <span className="text-amber-400 font-semibold block">2. 翻 3 倍卖 1.5 倍</span>
                <span className="text-slate-400 text-[11px]">达 3x 时自动卖出 15U（收回 10U 本金 + 锁定 5U 利润），余下零成本永久持有。</span>
              </div>
              <div className="bg-dark-800/80 p-2.5 rounded-xl border border-slate-700/60">
                <span className="text-purple-400 font-semibold block">3. 多阶梯暴涨推送</span>
                <span className="text-slate-400 text-[11px]">达成 2x, 3x, 4x, 5x, 10x, 20x, 30x, 50x, 70x, 100x 时自动发送电报贺报。</span>
              </div>
              <div className="bg-dark-800/80 p-2.5 rounded-xl border border-slate-700/60">
                <span className="text-rose-400 font-semibold block">4. 跌 50% 坚决清仓</span>
                <span className="text-slate-400 text-[11px]">自开仓 MC 跌幅达 50% 立即触发止损全额清仓，果断斩断亏损。</span>
              </div>
            </div>
          </div>
        </div>

        {/* 快捷测试按钮 */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400">策略测试模拟器:</span>
            <button
              onClick={() => handleTestStrategy(3.0)}
              className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-medium transition"
              title="模拟持仓直接暴涨至3x，检验卖出1.5倍本金并推TG"
            >
              ⚡ 模拟触发 3x 翻倍卖出
            </button>
            <button
              onClick={() => handleTestStrategy(5.0)}
              className="px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-[11px] font-medium transition"
              title="模拟持仓暴涨至5x，检验多倍里程碑提醒"
            >
              🔥 模拟触发 5x 里程碑
            </button>
            <button
              onClick={() => handleTestStrategy(0.5)}
              className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-medium transition"
              title="模拟持仓暴跌50%，检验直接清仓止损"
            >
              🛑 模拟触发 -50% 清仓
            </button>
          </div>
          {testStrategyMsg && (
            <span className="text-xs text-brand-green font-medium animate-pulse">
              {testStrategyMsg}
            </span>
          )}
        </div>
      </div>

      {/* 手动输入 CA 开仓测试 */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-semibold text-slate-300">手动指定代币开仓</h4>
          <p className="text-[11px] text-slate-500">输入任意 Solana 代币 CA，以官方 GMGN 实时精准 MC 买入 10U 并纳入策略监控。</p>
        </div>
        <form onSubmit={handleManualBuySubmit} className="flex items-center space-x-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="输入代币合约 CA 手动模拟买入 10U"
            value={customCA}
            onChange={(e) => setCustomCA(e.target.value)}
            className="bg-dark-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-cyan w-full md:w-72 font-mono"
          />
          <button
            type="submit"
            disabled={isSubmitting || !customCA.trim()}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-green hover:bg-emerald-400 text-dark-900 transition disabled:opacity-50 whitespace-nowrap"
          >
            {isSubmitting ? '开仓中...' : '+ 模拟买入 10U'}
          </button>
        </form>
      </div>

      {/* 持仓列表 */}
      <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <h4 className="text-sm font-semibold text-white">活跃持仓列表 (Active Positions)</h4>
            <span className="text-xs text-slate-400">({positions?.length || 0} 笔)</span>
          </div>
          <div className="text-xs text-slate-400 flex items-center space-x-1.5">
            <span>官方 GMGN API 精准刷新:</span>
            <span className="text-brand-green font-mono font-bold">5秒/次</span>
          </div>
        </div>

        {!positions || positions.length === 0 ? (
          <div className="py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-slate-800 mx-auto flex items-center justify-center text-slate-400 mb-3">
              <DollarSign className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-200">暂无模拟持仓</h4>
            <p className="text-xs text-slate-400 mt-1">
              当获利钱包买入新代币时，系统将自动买入 10U 并记录入场基准 MC。
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-dark-800/60 text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800/80">
                <tr>
                  <th className="py-3 px-4">代币 / CA</th>
                  <th className="py-3 px-4">开仓本金</th>
                  <th className="py-3 px-4">入场单价 ➔ 当前单价</th>
                  <th className="py-3 px-4">当前 GMGN 市值 (MC)</th>
                  <th className="py-3 px-4">当前仓位价值</th>
                  <th className="py-3 px-4">当前净盈亏额 (USD)</th>
                  <th className="py-3 px-4">策略执行状态</th>
                  <th className="py-3 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {positions.map((pos) => {
                  const isProfit = (pos.current_pnl_ratio || 0) >= 0;
                  const shortCA = pos.token_address ? `${pos.token_address.slice(0, 6)}...${pos.token_address.slice(-4)}` : '';
                  const cost = pos.entry_amount || 10;
                  const remainingRatio = pos.has_taken_profit_3x ? 0.5 : 1.0;
                  const currentValue = cost * (1 + (pos.current_pnl_ratio || 0) / 100) * remainingRatio;
                  const pnlUsd = currentValue - (pos.has_taken_profit_3x ? 0 : cost);
                  const isCopied = copiedCA === pos.id;

                  return (
                    <tr key={pos.id} className="hover:bg-slate-800/30 transition">
                      {/* 代币名称与CA */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <div>
                            <div className="font-bold text-white text-sm">
                              ${pos.token_symbol || 'UNKNOWN'}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[120px]">
                              {pos.token_name || ''}
                            </div>
                          </div>
                          <button
                            onClick={() => copyToClipboard(pos.token_address, pos.id)}
                            className="flex items-center space-x-1 bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[10px] text-slate-400 hover:text-white transition"
                            title="复制代币 CA"
                          >
                            <span>{shortCA}</span>
                            {isCopied ? <Check className="h-3 w-3 text-brand-green" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      </td>

                      {/* 开仓本金 */}
                      <td className="py-3.5 px-4 font-mono text-slate-200">
                        ${cost.toFixed(2)}
                      </td>

                      {/* 单价变化 */}
                      <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                        <div className="flex items-center space-x-1 text-[11px]">
                          <span className="text-slate-400">{formatPrice(pos.entry_price)}</span>
                          <span className="text-slate-600">➔</span>
                          <span className={`font-semibold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {formatPrice(pos.current_price)}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          基准 MC: {formatMC(pos.entry_mc)}
                        </div>
                      </td>

                      {/* 当前 GMGN 精准市值 */}
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        <div className="flex items-center space-x-1.5">
                          <span>{formatMC(pos.current_mc)}</span>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-brand-cyan/20 text-brand-cyan font-normal">GMGN</span>
                        </div>
                      </td>

                      {/* 当前估值 */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-100">
                        <div>
                          <span>${currentValue.toFixed(2)}</span>
                          {pos.has_taken_profit_3x ? (
                            <span className="text-[10px] block text-amber-400 font-normal">
                              +已落袋 $15.00
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* 明确盈亏额 (USD) 与百分比 */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col space-y-0.5">
                          <span className={`font-mono font-bold text-sm ${pnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {pnlUsd >= 0 ? `+$${pnlUsd.toFixed(2)}` : `-$${Math.abs(pnlUsd).toFixed(2)}`}
                          </span>
                          <span className={`text-[11px] font-semibold flex items-center ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isProfit ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
                            {isProfit ? '+' : ''}{pos.current_pnl_ratio?.toFixed(2) || '0.00'}%
                          </span>
                        </div>
                      </td>

                      {/* 策略状态 */}
                      <td className="py-3.5 px-4 space-y-1">
                        {pos.has_taken_profit_3x ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            🎯 3x已卖1.5倍 (零成本持有)
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-normal bg-slate-800 text-slate-400">
                            持有观察中 (目标 3x / 止损 -50%)
                          </span>
                        )}
                      </td>

                      {/* 操作 */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <a
                            href={`https://gmgn.ai/sol/token/${pos.token_address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition inline-flex items-center space-x-1 font-medium"
                            title="前往 GMGN 查看图表"
                          >
                            <span>GMGN走势</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          <button
                            onClick={() => onClosePosition(pos.id)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/30 transition"
                            title="手动平仓"
                          >
                            平仓
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
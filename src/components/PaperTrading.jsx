import React, { useState } from 'react';
import { TrendingUp, ArrowUpRight, ArrowDownRight, ExternalLink, XCircle, DollarSign, Clock, Copy, Check, Zap } from 'lucide-react';

function formatMC(val) {
  if (!val || isNaN(val)) return '$0';
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
  return `$${Number(val).toFixed(2)}`;
}

export default function PaperTrading({ positions, onClosePosition, onManualBuy }) {
  const [copiedCA, setCopiedCA] = useState(null);
  const [customCA, setCustomCA] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  return (
    <div className="space-y-6">
      {/* 模拟买入测试栏 */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
            <Zap className="h-4 w-4 text-brand-green" />
            <span>10U 模拟跟单交易模块</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            监控到 Top 100 钱包买入时自动同步买入 10 USD，记录当时 MC，并通过 DexScreener 每 5 秒实时刷新当前 MC 与收益率。
          </p>
        </div>

        {/* 手动输入 CA 开仓测试 */}
        <form onSubmit={handleManualBuySubmit} className="flex items-center space-x-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="输入 Solana 代币合约 CA 手动模拟买入 10U"
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
          <div className="text-xs text-slate-400">
            刷新频次: <span className="text-brand-green font-mono">5秒/次</span>
          </div>
        </div>

        {!positions || positions.length === 0 ? (
          <div className="py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-slate-800 mx-auto flex items-center justify-center text-slate-400 mb-3">
              <DollarSign className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-200">暂无模拟持仓</h4>
            <p className="text-xs text-slate-400 mt-1">
              当获利钱包买入代币时，系统将自动买入 10U 并记录入场 MC。
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-dark-800/60 text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800/80">
                <tr>
                  <th className="py-3 px-4">代币 / CA</th>
                  <th className="py-3 px-4">开仓本金</th>
                  <th className="py-3 px-4">开仓时 MC</th>
                  <th className="py-3 px-4">当前实时 MC</th>
                  <th className="py-3 px-4">收益百分比 (P&L %)</th>
                  <th className="py-3 px-4">当前仓位价值</th>
                  <th className="py-3 px-4">开仓时间</th>
                  <th className="py-3 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {positions.map((pos) => {
                  const isProfit = (pos.current_pnl_ratio || 0) >= 0;
                  const shortCA = pos.token_address ? `${pos.token_address.slice(0, 6)}...${pos.token_address.slice(-4)}` : '';
                  const currentValue = (pos.entry_amount || 10) * (1 + (pos.current_pnl_ratio || 0) / 100);
                  const isCopied = copiedCA === pos.id;
                  const timeStr = pos.created_at ? new Date(pos.created_at).toLocaleTimeString() : '';

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
                        ${pos.entry_amount?.toFixed(2) || '10.00'}
                      </td>

                      {/* 入场市值 */}
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {formatMC(pos.entry_mc)}
                      </td>

                      {/* 当前实时市值 */}
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        <div className="flex items-center space-x-1">
                          <span>{formatMC(pos.current_mc)}</span>
                          <span className="h-1.5 w-1.5 rounded-full bg-brand-cyan animate-ping"></span>
                        </div>
                      </td>

                      {/* 收益百分比 */}
                      <td className="py-3.5 px-4">
                        <div className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                          isProfit
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 glow-green'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30 glow-red'
                        }`}>
                          {isProfit ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                          <span>{isProfit ? '+' : ''}{pos.current_pnl_ratio?.toFixed(2) || '0.00'}%</span>
                        </div>
                      </td>

                      {/* 当前估值 */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-100">
                        ${currentValue.toFixed(2)}
                      </td>

                      {/* 开仓时间 */}
                      <td className="py-3.5 px-4 text-slate-400 text-xs font-mono whitespace-nowrap">
                        {timeStr}
                      </td>

                      {/* 操作 */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-2">
                          <a
                            href={`https://dexscreener.com/solana/${pos.token_address}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"
                            title="在 DexScreener 查看 K 线"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                          <button
                            onClick={() => onClosePosition(pos.id)}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-medium text-xs transition"
                            title="模拟卖出平仓"
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

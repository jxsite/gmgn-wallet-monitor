import React from 'react';
import { Users, Activity, DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function StatCards({ summary, walletsCount, alertsCount }) {
  const isPositive = (summary?.overallPnlRatio || 0) >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 监控钱包数 */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800/80 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400">GMGN 获利监控钱包</p>
          <div className="flex items-baseline space-x-2 mt-1">
            <h3 className="text-2xl font-bold text-white">{walletsCount || 100}</h3>
            <span className="text-xs text-emerald-400 font-medium">全天候轮询</span>
          </div>
        </div>
        <div className="h-11 w-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
          <Users className="h-5 w-5 text-purple-400" />
        </div>
      </div>

      {/* 捕获买入信号 */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800/80 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400">捕获买入信号</p>
          <div className="flex items-baseline space-x-2 mt-1">
            <h3 className="text-2xl font-bold text-white">{alertsCount || 0}</h3>
            <span className="text-xs text-brand-cyan font-medium">已自动去重</span>
          </div>
        </div>
        <div className="h-11 w-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <Activity className="h-5 w-5 text-brand-cyan" />
        </div>
      </div>

      {/* 10U 模拟持仓总值 */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800/80 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400">当前模拟持仓估值</p>
          <div className="flex items-baseline space-x-2 mt-1">
            <h3 className="text-2xl font-bold text-white">${summary?.totalCurrentVal?.toFixed(2) || '0.00'}</h3>
            <span className="text-xs text-slate-400">({summary?.openPositionsCount || 0} 笔活跃)</span>
          </div>
        </div>
        <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <DollarSign className="h-5 w-5 text-brand-green" />
        </div>
      </div>

      {/* 模拟总收益率 */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800/80 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400">模拟持仓总盈亏比例</p>
          <div className="flex items-baseline space-x-2 mt-1">
            <h3 className={`text-2xl font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isPositive ? '+' : ''}{summary?.overallPnlRatio?.toFixed(2) || '0.00'}%
            </h3>
            <span className={`text-xs flex items-center ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {summary?.unrealizedProfit >= 0 ? `+$${summary.unrealizedProfit}` : `-$${Math.abs(summary?.unrealizedProfit || 0)}`}
            </span>
          </div>
        </div>
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center border ${
          isPositive
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        }`}>
          <TrendingUp className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

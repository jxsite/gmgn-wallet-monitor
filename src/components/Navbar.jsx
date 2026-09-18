import React from 'react';
import { Activity, Bell, Settings, Play, Pause, Zap, Send } from 'lucide-react';

export default function Navbar({
  isMonitoring,
  onToggleMonitoring,
  onOpenSettings,
  onTriggerTestBuy,
  telegramConfigured,
  isTestingBuy
}) {
  return (
    <header className="border-b border-slate-800/80 bg-dark-900/90 sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo & Title */}
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-green to-brand-cyan flex items-center justify-center shadow-lg shadow-brand-green/20">
            <Zap className="h-6 w-6 text-dark-900 font-bold" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                GMGN 聪明钱监控 & 模拟交易
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 font-mono">
                SOLANA
              </span>
            </div>
            <p className="text-xs text-slate-400">Top 100 获利钱包实时推送 + 10U 自动模拟开仓</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          {/* Telegram Status */}
          <div className={`hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs border ${
            telegramConfigured
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}>
            <Send className="h-3.5 w-3.5" />
            <span>{telegramConfigured ? '电报推送已连接' : '电报未配置'}</span>
          </div>

          {/* Test Signal Button */}
          <button
            onClick={onTriggerTestBuy}
            disabled={isTestingBuy}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50"
            title="手动触发一次买入事件，测试10U模拟开仓与TG推送"
          >
            <Zap className={`h-3.5 w-3.5 text-brand-cyan ${isTestingBuy ? 'animate-spin' : ''}`} />
            <span>{isTestingBuy ? '测试中...' : '测试买入'}</span>
          </button>

          {/* Monitor Toggle Button */}
          <button
            onClick={onToggleMonitoring}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm ${
              isMonitoring
                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40'
                : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40'
            }`}
          >
            {isMonitoring ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>监控中</span>
              </>
            ) : (
              <>
                <Pause className="h-3.5 w-3.5" />
                <span>已暂停</span>
              </>
            )}
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
            title="系统配置 (Telegram / GMGN Key / 模拟金额)"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

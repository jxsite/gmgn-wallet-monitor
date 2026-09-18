import React, { useState } from 'react';
import { ExternalLink, Copy, Check, TrendingUp, DollarSign, Wallet } from 'lucide-react';

function formatMC(val) {
  if (!val || isNaN(val)) return '$0';
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
  return `$${Number(val).toFixed(2)}`;
}

export default function LiveSignals({ alerts }) {
  const [copiedCA, setCopiedCA] = useState(null);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedCA(id);
    setTimeout(() => setCopiedCA(null), 2000);
  };

  if (!alerts || alerts.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center border border-slate-800/80">
        <div className="h-12 w-12 rounded-full bg-slate-800 mx-auto flex items-center justify-center text-slate-400 mb-3">
          <TrendingUp className="h-6 w-6" />
        </div>
        <h4 className="text-base font-semibold text-slate-200">等待买入信号中...</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          监控引擎正在轮询 GMGN 获利前 100 名钱包。一旦发现任何钱包买入，将即刻在网页高亮显示并推送到 Telegram。
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-green animate-pulse"></span>
          <h3 className="text-sm font-semibold text-white">实时买入信号流 (Live Feed)</h3>
          <span className="text-xs text-slate-400">({alerts.length} 条记录)</span>
        </div>
        <div className="text-xs text-brand-cyan">已自动触发 10U 模拟买入</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-dark-800/60 text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800/80">
            <tr>
              <th className="py-3 px-4">时间</th>
              <th className="py-3 px-4">聪明钱钱包</th>
              <th className="py-3 px-4">代币 / 合约地址 (CA)</th>
              <th className="py-3 px-4">钱包买入金额</th>
              <th className="py-3 px-4">代币市值 (MC)</th>
              <th className="py-3 px-4">模拟状态</th>
              <th className="py-3 px-4 text-right">快捷通道</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {alerts.map((item, idx) => {
              const shortWallet = item.wallet_address ? `${item.wallet_address.slice(0, 4)}...${item.wallet_address.slice(-4)}` : '';
              const shortCA = item.token_address ? `${item.token_address.slice(0, 6)}...${item.token_address.slice(-4)}` : '';
              const isCopied = copiedCA === item.id;
              const timeStr = item.created_at ? new Date(item.created_at).toLocaleTimeString() : '';

              return (
                <tr key={item.id || idx} className="hover:bg-slate-800/30 transition">
                  {/* 时间 */}
                  <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                    {timeStr}
                  </td>

                  {/* 钱包 */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="flex items-center space-x-1.5">
                      <Wallet className="h-3.5 w-3.5 text-purple-400 flex-shrink-0" />
                      <a
                        href={`https://gmgn.ai/sol/address/${item.wallet_address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-slate-200 hover:text-brand-cyan transition flex items-center space-x-1"
                      >
                        <span>{item.wallet_label || 'Smart Money'}</span>
                        <span className="text-[11px] text-slate-500 font-mono">({shortWallet})</span>
                      </a>
                    </div>
                  </td>

                  {/* 代币与CA */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-2">
                      <div className="font-bold text-white tracking-wide">
                        ${item.token_symbol || 'UNKNOWN'}
                      </div>
                      <button
                        onClick={() => copyToClipboard(item.token_address, item.id)}
                        className="flex items-center space-x-1 bg-slate-800/90 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-mono text-[11px] border border-slate-700 transition"
                        title="点击复制完整合约地址"
                      >
                        <span>{shortCA}</span>
                        {isCopied ? <Check className="h-3 w-3 text-brand-green" /> : <Copy className="h-3 w-3 text-slate-400" />}
                      </button>
                    </div>
                  </td>

                  {/* 买入金额 */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="font-semibold text-emerald-400">
                      +${(item.amount_usd || 0).toLocaleString()}
                    </span>
                  </td>

                  {/* 发生时代币市值 */}
                  <td className="py-3.5 px-4 font-mono font-medium text-slate-200 whitespace-nowrap">
                    {formatMC(item.mc_at_event)}
                  </td>

                  {/* 模拟状态 */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20">
                      10U 同步买入
                    </span>
                  </td>

                  {/* 快捷链接 */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-2">
                      <a
                        href={`https://gmgn.ai/sol/token/${item.token_address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-brand-cyan hover:underline inline-flex items-center space-x-0.5"
                      >
                        <span>GMGN</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <span className="text-slate-600">|</span>
                      <a
                        href={`https://dexscreener.com/solana/${item.token_address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-slate-400 hover:text-white inline-flex items-center space-x-0.5"
                      >
                        <span>Chart</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

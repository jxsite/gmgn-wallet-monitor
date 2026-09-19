import React, { useState, useMemo } from 'react';
import { ExternalLink, Copy, Check, TrendingUp, Wallet, ShieldCheck, Star, Link as LinkIcon, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

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

export default function LiveSignals({ alerts }) {
  const [copiedCA, setCopiedCA] = useState(null);
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedCA(id);
    setTimeout(() => setCopiedCA(null), 2000);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedAlerts = useMemo(() => {
    if (!alerts || alerts.length === 0) return [];
    return [...alerts].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'created_at') {
        valA = new Date(a.created_at || 0).getTime();
        valB = new Date(b.created_at || 0).getTime();
      } else if (['amount_usd', 'price_usd', 'mc_at_event'].includes(sortField)) {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [alerts, sortField, sortDirection]);

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 text-slate-600 group-hover:text-slate-400 inline ml-1 transition" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-brand-cyan inline ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 text-brand-cyan inline ml-1" />
    );
  };

  if (!alerts || alerts.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center border border-slate-800/80">
        <div className="h-12 w-12 rounded-full bg-slate-800 mx-auto flex items-center justify-center text-slate-400 mb-3">
          <TrendingUp className="h-6 w-6" />
        </div>
        <h4 className="text-base font-semibold text-slate-200">等待链上真实买入信号中...</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          监控引擎正在全天候监听 GMGN 获利前 100 名钱包及自定义关注钱包。一旦捕获到真实买入，将即刻推送并显示。
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-green animate-pulse"></span>
          <h3 className="text-sm font-semibold text-white">实时买入信号流 (Live Feed)</h3>
          <span className="text-xs text-slate-400">({alerts.length} 条真实记录)</span>
        </div>
        <div className="text-xs text-brand-cyan flex items-center space-x-1">
          <ShieldCheck className="h-3.5 w-3.5 text-brand-green" />
          <span>防重复买入机制已生效 (同币种仅持仓1笔)</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-dark-800/60 text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800/80 select-none">
            <tr>
              {/* 时间排序 */}
              <th
                onClick={() => handleSort('created_at')}
                className="py-3 px-4 cursor-pointer group hover:text-white transition whitespace-nowrap"
              >
                <span>时间</span>
                {renderSortIcon('created_at')}
              </th>

              {/* 钱包 */}
              <th
                onClick={() => handleSort('wallet_label')}
                className="py-3 px-4 cursor-pointer group hover:text-white transition whitespace-nowrap"
              >
                <span>买入钱包 / 标签</span>
                {renderSortIcon('wallet_label')}
              </th>

              <th className="py-3 px-4 whitespace-nowrap">推特 / X</th>

              {/* 代币 */}
              <th
                onClick={() => handleSort('token_symbol')}
                className="py-3 px-4 cursor-pointer group hover:text-white transition whitespace-nowrap"
              >
                <span>代币 / CA</span>
                {renderSortIcon('token_symbol')}
              </th>

              {/* 单价排序 */}
              <th
                onClick={() => handleSort('price_usd')}
                className="py-3 px-4 cursor-pointer group hover:text-white transition whitespace-nowrap"
              >
                <span>实时单价 (Price)</span>
                {renderSortIcon('price_usd')}
              </th>

              {/* 买入金额排序 */}
              <th
                onClick={() => handleSort('amount_usd')}
                className="py-3 px-4 cursor-pointer group hover:text-white transition whitespace-nowrap"
              >
                <span>买入金额</span>
                {renderSortIcon('amount_usd')}
              </th>

              {/* 发生市值排序 */}
              <th
                onClick={() => handleSort('mc_at_event')}
                className="py-3 px-4 cursor-pointer group hover:text-white transition whitespace-nowrap"
              >
                <span>发生市值 (MC)</span>
                {renderSortIcon('mc_at_event')}
              </th>

              <th className="py-3 px-4 whitespace-nowrap">10U 跟单状态</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">GMGN 直达走势</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {sortedAlerts.map((item, idx) => {
              const shortWallet = item.wallet_address ? `${item.wallet_address.slice(0, 4)}...${item.wallet_address.slice(-4)}` : '';
              const shortCA = item.token_address ? `${item.token_address.slice(0, 6)}...${item.token_address.slice(-4)}` : '';
              const isCopied = copiedCA === (item.id || idx);
              const timeStr = item.created_at ? new Date(item.created_at).toLocaleTimeString() : '';
              const isDuplicate = item.sim_status === 'ALREADY_HELD';
              const isCustom = item.is_custom === 1;
              const isAssociated = item.is_associated === 1;

              return (
                <tr key={item.id || idx} className="hover:bg-slate-800/30 transition">
                  {/* 时间 */}
                  <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                    {timeStr}
                  </td>

                  {/* 钱包与身份标签 */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center space-x-1.5">
                        {isCustom ? (
                          <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />
                        ) : isAssociated ? (
                          <LinkIcon className="h-3.5 w-3.5 text-purple-400 flex-shrink-0" />
                        ) : (
                          <Wallet className="h-3.5 w-3.5 text-brand-cyan flex-shrink-0" />
                        )}
                        <a
                          href={`https://gmgn.ai/sol/address/${item.wallet_address}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-slate-200 hover:text-brand-cyan transition flex items-center space-x-1"
                        >
                          <span>{item.wallet_label || 'GMGN 聪明钱'}</span>
                          <span className="text-[11px] text-slate-500 font-mono">({shortWallet})</span>
                        </a>
                      </div>

                      {/* 专属高亮属性徽章 */}
                      <div className="flex items-center space-x-1">
                        {isCustom && (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            ⭐ 自定义关注
                          </span>
                        )}
                        {isAssociated && (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            🔗 关联小号
                          </span>
                        )}
                        {!isCustom && !isAssociated && (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            Top 100 聪明钱
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* 推特 / X 账号 */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {item.twitter_username ? (
                      <a
                        href={`https://x.com/${item.twitter_username}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 border border-slate-700 transition font-mono text-[11px]"
                      >
                        <span>𝕏</span>
                        <span>@{item.twitter_username}</span>
                      </a>
                    ) : (
                      <span className="text-slate-600 text-[11px]">-</span>
                    )}
                  </td>

                  {/* 代币与CA */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-2">
                      <div className="font-bold text-white tracking-wide">
                        ${item.token_symbol || 'UNKNOWN'}
                      </div>
                      <button
                        onClick={() => copyToClipboard(item.token_address, item.id || idx)}
                        className="flex items-center space-x-1 bg-slate-800/90 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-mono text-[11px] border border-slate-700 transition"
                        title="点击复制完整合约地址"
                      >
                        <span>{shortCA}</span>
                        {isCopied ? <Check className="h-3 w-3 text-brand-green" /> : <Copy className="h-3 w-3 text-slate-400" />}
                      </button>
                    </div>
                  </td>

                  {/* 实时单价 */}
                  <td className="py-3.5 px-4 font-mono font-medium text-amber-300 whitespace-nowrap">
                    {formatPrice(item.price_usd)}
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
                    {isDuplicate ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        已有持仓(跳过重复买)
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20">
                        10U 同步买入
                      </span>
                    )}
                  </td>

                  {/* GMGN 直达走势 */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-2">
                      <a
                        href={`https://gmgn.ai/sol/token/${item.token_address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 hover:text-emerald-300 font-semibold border border-emerald-500/30 transition inline-flex items-center space-x-1"
                      >
                        <span>GMGN 走势</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <a
                        href={`https://dexscreener.com/solana/${item.token_address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded text-slate-400 hover:text-white transition"
                        title="DexScreener 图表"
                      >
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

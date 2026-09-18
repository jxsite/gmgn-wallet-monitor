import React, { useState } from 'react';
import { ExternalLink, Copy, Check, Search, Plus, Filter, ShieldCheck, Award } from 'lucide-react';

export default function WalletsTable({ wallets, onToggleStatus, onAddWallet }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [tagFilter, setTagFilter] = useState('ALL');
  const [copiedAddr, setCopiedAddr] = useState(null);

  // 添加自定义钱包状态
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAddr, setNewAddr] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newWinRate, setNewWinRate] = useState('80');

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedAddr(id);
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!newAddr.trim()) return;
    onAddWallet({
      address: newAddr.trim(),
      label: newLabel.trim() || '自定义关注钱包',
      win_rate: parseFloat(newWinRate) || 75.0,
      profit_7d: 50000,
      tag: 'custom'
    });
    setNewAddr('');
    setNewLabel('');
    setShowAddModal(false);
  };

  const filteredWallets = (wallets || []).filter((w) => {
    const matchSearch =
      w.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.label?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTag = tagFilter === 'ALL' || w.tag === tagFilter;
    return matchSearch && matchTag;
  });

  return (
    <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden">
      {/* 头部控制栏 */}
      <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Award className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">GMGN 获利前 100 名高胜率钱包</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {filteredWallets.length} / {wallets?.length || 0}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            系统按胜率与 7 日实际获利排序监控，可通过开关单独启用或停用特定钱包。
          </p>
        </div>

        {/* 筛选与搜索 */}
        <div className="flex items-center space-x-2.5 flex-wrap">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜索地址或备注..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-dark-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-cyan w-44 sm:w-56 font-mono"
            />
          </div>

          {/* 标签过滤 */}
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="bg-dark-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-cyan"
          >
            <option value="ALL">全部标签</option>
            <option value="smart_degen">Smart Degen</option>
            <option value="whale">Whale (巨鲸)</option>
            <option value="sniper">Sniper (狙击手)</option>
            <option value="kol">KOL</option>
          </select>

          {/* 添加钱包按钮 */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/30 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>添加钱包</span>
          </button>
        </div>
      </div>

      {/* 列表表格 */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-dark-800/60 text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800/80">
            <tr>
              <th className="py-3 px-4 w-16 text-center">排名</th>
              <th className="py-3 px-4">钱包地址 / 备注</th>
              <th className="py-3 px-4">历史胜率</th>
              <th className="py-3 px-4">7日总获利</th>
              <th className="py-3 px-4">标签类别</th>
              <th className="py-3 px-4 text-center">监控状态</th>
              <th className="py-3 px-4 text-right">查看</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredWallets.map((w) => {
              const shortAddr = w.address ? `${w.address.slice(0, 6)}...${w.address.slice(-6)}` : '';
              const isCopied = copiedAddr === w.address;

              return (
                <tr key={w.id || w.address} className="hover:bg-slate-800/30 transition">
                  {/* 排名 */}
                  <td className="py-3.5 px-4 text-center font-mono font-bold">
                    <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs ${
                      w.rank === 1 ? 'bg-amber-400/20 text-amber-400 font-extrabold border border-amber-400/30' :
                      w.rank === 2 ? 'bg-slate-300/20 text-slate-300 font-bold' :
                      w.rank === 3 ? 'bg-amber-700/20 text-amber-500 font-bold' : 'text-slate-400'
                    }`}>
                      {w.rank}
                    </span>
                  </td>

                  {/* 钱包与地址 */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-white">{w.label}</span>
                      <button
                        onClick={() => copyToClipboard(w.address, w.address)}
                        className="flex items-center space-x-1 bg-slate-800 px-2 py-0.5 rounded font-mono text-[11px] text-slate-400 hover:text-white transition"
                        title="复制完整钱包地址"
                      >
                        <span>{shortAddr}</span>
                        {isCopied ? <Check className="h-3 w-3 text-brand-green" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  </td>

                  {/* 胜率 */}
                  <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                    {w.win_rate || w.winRate}%
                  </td>

                  {/* 7日收益 */}
                  <td className="py-3.5 px-4 font-mono font-medium text-slate-200">
                    +${(w.profit_7d || w.profit7d || 0).toLocaleString()}
                  </td>

                  {/* 标签 */}
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      {w.tag || 'smart_degen'}
                    </span>
                  </td>

                  {/* 监控开关 */}
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => onToggleStatus(w.address, !w.is_monitored)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        w.is_monitored ? 'bg-brand-green' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-dark-900 shadow ring-0 transition duration-200 ease-in-out ${
                          w.is_monitored ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </td>

                  {/* GMGN链接 */}
                  <td className="py-3.5 px-4 text-right">
                    <a
                      href={`https://gmgn.ai/sol/address/${w.address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-400 hover:text-brand-cyan transition inline-flex items-center space-x-1"
                      title="在 GMGN 查看该钱包持仓与战绩"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 添加自定义钱包 Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-slate-700 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center space-x-2">
              <Plus className="h-5 w-5 text-brand-cyan" />
              <span>添加自定义监控钱包</span>
            </h3>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Solana 钱包公钥地址</label>
                <input
                  type="text"
                  required
                  placeholder="例如: 7yepWq3qGz5J9kL4f1X8oW9V7M4s1qP3K8L5u1X2z9Y4"
                  value={newAddr}
                  onChange={(e) => setNewAddr(e.target.value)}
                  className="w-full bg-dark-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-cyan font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">钱包备注别名</label>
                <input
                  type="text"
                  placeholder="例如: 某百倍战神鲸鱼"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="w-full bg-dark-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-cyan"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">预估历史胜率 (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newWinRate}
                  onChange={(e) => setNewWinRate(e.target.value)}
                  className="w-full bg-dark-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-cyan"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-cyan text-dark-900 hover:bg-cyan-300 transition"
                >
                  确认添加
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

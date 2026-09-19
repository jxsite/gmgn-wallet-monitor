import React, { useState, useMemo } from 'react';
import { ExternalLink, Copy, Check, Search, Plus, Award, Star, Link as LinkIcon, Users, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export default function WalletsTable({ wallets, onToggleStatus, onAddWallet }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL'); // ALL, CUSTOM, ASSOCIATED, TOP100
  const [copiedAddr, setCopiedAddr] = useState(null);

  // 排序状态 (默认按排名升序)
  const [sortField, setSortField] = useState('rank');
  const [sortDirection, setSortDirection] = useState('asc');

  // 添加自定义钱包状态
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAddr, setNewAddr] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newTwitter, setNewTwitter] = useState('');
  const [newWinRate, setNewWinRate] = useState('80');

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedAddr(id);
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // 胜率和获利默认降序，其余默认升序
      setSortDirection(['win_rate', 'profit_7d'].includes(field) ? 'desc' : 'asc');
    }
  };

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

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!newAddr.trim()) return;
    onAddWallet({
      address: newAddr.trim(),
      label: newLabel.trim() || '⭐ 自定义关注钱包',
      twitter_username: newTwitter.trim().replace(/^@/, ''),
      win_rate: parseFloat(newWinRate) || 75.0,
      profit_7d: 50000,
      tag: 'CUSTOM'
    });
    setNewAddr('');
    setNewLabel('');
    setNewTwitter('');
    setShowAddModal(false);
  };

  const customCount = (wallets || []).filter(w => w.is_custom === 1).length;
  const associatedCount = (wallets || []).filter(w => w.is_associated === 1).length;
  const top100Count = (wallets || []).filter(w => !w.is_custom && !w.is_associated).length;

  const filteredWallets = useMemo(() => {
    const list = (wallets || []).filter((w) => {
      const matchSearch =
        w.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (w.twitter_username && w.twitter_username.toLowerCase().includes(searchTerm.toLowerCase()));

      let matchCategory = true;
      if (categoryFilter === 'CUSTOM') matchCategory = w.is_custom === 1;
      else if (categoryFilter === 'ASSOCIATED') matchCategory = w.is_associated === 1;
      else if (categoryFilter === 'TOP100') matchCategory = !w.is_custom && !w.is_associated;

      return matchSearch && matchCategory;
    });

    return list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'rank') {
        valA = Number(a.rank) || 9999;
        valB = Number(b.rank) || 9999;
      } else if (sortField === 'win_rate') {
        valA = Number(a.win_rate || a.winRate || 0);
        valB = Number(b.win_rate || b.winRate || 0);
      } else if (sortField === 'profit_7d') {
        valA = Number(a.profit_7d || a.profit7d || 0);
        valB = Number(b.profit_7d || b.profit7d || 0);
      } else if (sortField === 'is_custom') {
        // 排序属性权重: 自定义(3) > 关联(2) > Top100(1)
        valA = a.is_custom ? 3 : a.is_associated ? 2 : 1;
        valB = b.is_custom ? 3 : b.is_associated ? 2 : 1;
      } else if (sortField === 'is_monitored') {
        valA = a.is_monitored ? 1 : 0;
        valB = b.is_monitored ? 1 : 0;
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [wallets, searchTerm, categoryFilter, sortField, sortDirection]);

  return (
    <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden">
      {/* 头部控制栏 */}
      <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Award className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">聪明钱与重点监控钱包库</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              共 {wallets?.length || 0} 个监控地址
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            涵盖 GMGN 真实获利前 100 聪明钱、自定义高优监控钱包以及资金溯源挖掘出的关联小号。
          </p>
        </div>

        {/* 筛选与搜索 */}
        <div className="flex items-center space-x-2.5 flex-wrap">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜索地址 / 备注 / 推特..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-dark-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-cyan w-44 sm:w-56 font-mono"
            />
          </div>

          {/* 分类快捷标签 */}
          <div className="inline-flex rounded-lg p-0.5 bg-dark-800 border border-slate-700 text-xs">
            <button
              onClick={() => setCategoryFilter('ALL')}
              className={`px-2.5 py-1 rounded-md transition font-medium ${categoryFilter === 'ALL' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              全部 ({wallets?.length || 0})
            </button>
            <button
              onClick={() => setCategoryFilter('TOP100')}
              className={`px-2.5 py-1 rounded-md transition font-medium ${categoryFilter === 'TOP100' ? 'bg-blue-600/40 text-blue-300' : 'text-slate-400 hover:text-white'}`}
            >
              Top 100 ({top100Count})
            </button>
            <button
              onClick={() => setCategoryFilter('CUSTOM')}
              className={`px-2.5 py-1 rounded-md transition font-medium flex items-center space-x-1 ${categoryFilter === 'CUSTOM' ? 'bg-amber-500/30 text-amber-300' : 'text-slate-400 hover:text-white'}`}
            >
              <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
              <span>自定义 ({customCount})</span>
            </button>
            <button
              onClick={() => setCategoryFilter('ASSOCIATED')}
              className={`px-2.5 py-1 rounded-md transition font-medium flex items-center space-x-1 ${categoryFilter === 'ASSOCIATED' ? 'bg-purple-500/30 text-purple-300' : 'text-slate-400 hover:text-white'}`}
            >
              <LinkIcon className="h-3 w-3 text-purple-400" />
              <span>关联小号 ({associatedCount})</span>
            </button>
          </div>

          {/* 添加钱包按钮 */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/30 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>添加关注钱包</span>
          </button>
        </div>
      </div>

      {/* 列表表格 */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-dark-800/60 text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800/80 select-none">
            <tr>
              <th
                onClick={() => handleSort('rank')}
                className="py-3 px-4 w-14 text-center cursor-pointer group hover:text-white transition whitespace-nowrap"
              >
                <span>排名</span>
                {renderSortIcon('rank')}
              </th>
              <th
                onClick={() => handleSort('is_custom')}
                className="py-3 px-4 cursor-pointer group hover:text-white transition whitespace-nowrap"
              >
                <span>钱包属性</span>
                {renderSortIcon('is_custom')}
              </th>
              <th
                onClick={() => handleSort('label')}
                className="py-3 px-4 cursor-pointer group hover:text-white transition whitespace-nowrap"
              >
                <span>钱包地址 / 备注</span>
                {renderSortIcon('label')}
              </th>
              <th
                onClick={() => handleSort('twitter_username')}
                className="py-3 px-4 cursor-pointer group hover:text-white transition whitespace-nowrap"
              >
                <span>推特 / X 账号</span>
                {renderSortIcon('twitter_username')}
              </th>
              <th
                onClick={() => handleSort('win_rate')}
                className="py-3 px-4 cursor-pointer group hover:text-white transition whitespace-nowrap"
              >
                <span>历史胜率</span>
                {renderSortIcon('win_rate')}
              </th>
              <th
                onClick={() => handleSort('profit_7d')}
                className="py-3 px-4 cursor-pointer group hover:text-white transition whitespace-nowrap"
              >
                <span>7日总获利</span>
                {renderSortIcon('profit_7d')}
              </th>
              <th
                onClick={() => handleSort('tag')}
                className="py-3 px-4 cursor-pointer group hover:text-white transition whitespace-nowrap"
              >
                <span>标签类别</span>
                {renderSortIcon('tag')}
              </th>
              <th
                onClick={() => handleSort('is_monitored')}
                className="py-3 px-4 text-center cursor-pointer group hover:text-white transition whitespace-nowrap"
              >
                <span>监控状态</span>
                {renderSortIcon('is_monitored')}
              </th>
              <th className="py-3 px-4 text-right whitespace-nowrap">GMGN详情</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredWallets.map((w, idx) => {
              const shortAddr = w.address ? `${w.address.slice(0, 6)}...${w.address.slice(-6)}` : '';
              const isCopied = copiedAddr === w.address;
              const isCustom = w.is_custom === 1;
              const isAssociated = w.is_associated === 1;

              return (
                <tr key={w.id || w.address || idx} className="hover:bg-slate-800/30 transition">
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

                  {/* 钱包属性徽章 */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {isCustom ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        ⭐ 自定义关注
                      </span>
                    ) : isAssociated ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40"
                        title={w.parent_wallet ? `来自主钱包: ${w.parent_wallet}` : '资金走向挖掘关联小号'}
                      >
                        🔗 关联小号
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        Top 100 获利
                      </span>
                    )}
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

                  {/* X / 推特账号 */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {w.twitter_username ? (
                      <a
                        href={`https://x.com/${w.twitter_username}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 border border-slate-700 transition font-mono text-[11px]"
                      >
                        <span>𝕏</span>
                        <span>@{w.twitter_username}</span>
                      </a>
                    ) : (
                      <span className="text-slate-600 text-[11px]">-</span>
                    )}
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
                      title="在 GMGN 查看该钱包持仓与真实战绩"
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
              <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
              <span>添加自定义重点关注钱包</span>
            </h3>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Solana 钱包地址 (Base58)</label>
                <input
                  type="text"
                  required
                  placeholder="例如: DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh"
                  value={newAddr}
                  onChange={(e) => setNewAddr(e.target.value)}
                  className="w-full bg-dark-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-cyan font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">钱包备注名称</label>
                <input
                  type="text"
                  placeholder="例如: 某百倍老鼠仓巨鲸"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="w-full bg-dark-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-cyan"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">推特 / X 账号 (选填)</label>
                <input
                  type="text"
                  placeholder="例如: sol_whale_alpha (无需带@)"
                  value={newTwitter}
                  onChange={(e) => setNewTwitter(e.target.value)}
                  className="w-full bg-dark-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-cyan font-mono"
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

              <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700/50 text-[11px] text-slate-400">
                💡 <b className="text-slate-300">系统联动</b>：添加后将自动标记为专属关注钱包，并立即启动链上资金流向追踪，挖掘其关联小号并同步纳入监控！
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
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
                  确认添加并追踪
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

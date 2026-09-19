import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Flame, Users, DollarSign, ArrowUpRight, ArrowDownRight, ExternalLink, Copy, Check, RefreshCw, Zap, Award } from 'lucide-react';

function formatMC(val) {
  if (!val || isNaN(val)) return '$0';
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
  return `$${Number(val).toFixed(2)}`;
}

export default function GoldenDogRadar({ onManualBuy }) {
  const [dogs, setDogs] = useState([]);
  const [sortBy, setSortBy] = useState('buyers'); // 'buyers' | 'volume'
  const [isLoading, setIsLoading] = useState(false);
  const [copiedCA, setCopiedCA] = useState(null);
  const [buyingCA, setBuyingCA] = useState(null);

  const fetchGoldenDogs = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`/api/goldendogs?sort=${sortBy}&limit=25`);
      if (res.data && res.data.list) {
        setDogs(res.data.list);
      }
    } catch (err) {
      console.error('获取金狗榜单失败:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGoldenDogs();
    const timer = setInterval(fetchGoldenDogs, 10000); // 10秒自动刷新
    return () => clearInterval(timer);
  }, [sortBy]);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedCA(id);
    setTimeout(() => setCopiedCA(null), 2000);
  };

  const handleQuickBuy = async (tokenAddress) => {
    if (!tokenAddress || !onManualBuy) return;
    setBuyingCA(tokenAddress);
    try {
      await onManualBuy(tokenAddress);
    } finally {
      setTimeout(() => setBuyingCA(null), 1000);
    }
  };

  return (
    <div className="space-y-6">
      {/* 头部导航与筛选 */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800/80">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Flame className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span>GMGN 聪明钱共识「金狗雷达」</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                  REAL-TIME
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                实时聚合获利前 100 顶级钱包买入流水与 GMGN 全网聪明钱数据，发掘机构与巨鲸重仓共识代币
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 w-full md:w-auto">
            {/* 榜单切换按钮 */}
            <div className="bg-dark-800 p-1 rounded-xl border border-slate-700/80 flex items-center space-x-1 text-xs">
              <button
                onClick={() => setSortBy('buyers')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                  sortBy === 'buyers'
                    ? 'bg-amber-500 text-dark-900 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>👥 买入人数最多</span>
              </button>
              <button
                onClick={() => setSortBy('volume')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                  sortBy === 'volume'
                    ? 'bg-amber-500 text-dark-900 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <DollarSign className="h-3.5 w-3.5" />
                <span>💰 买入金额最高</span>
              </button>
            </div>

            {/* 刷新按钮 */}
            <button
              onClick={fetchGoldenDogs}
              disabled={isLoading}
              className="p-2 rounded-xl bg-dark-800 border border-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50"
              title="立即刷新金狗榜单"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 金狗代币列表 */}
      <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Award className="h-4 w-4 text-amber-400" />
            <h4 className="text-sm font-semibold text-white">
              {sortBy === 'buyers' ? '聪明钱包买入人数榜 Top 25' : '聪明钱包买入总金额榜 Top 25'}
            </h4>
            <span className="text-xs text-slate-400">({dogs.length} 个上榜代币)</span>
          </div>
          <div className="text-xs text-slate-400 flex items-center space-x-1">
            <span>官方 GMGN API 数据联动:</span>
            <span className="text-brand-green font-semibold">已连接</span>
          </div>
        </div>

        {dogs.length === 0 ? (
          <div className="py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-slate-800 mx-auto flex items-center justify-center text-slate-400 mb-3">
              <Flame className="h-6 w-6 text-amber-400" />
            </div>
            <h4 className="text-sm font-semibold text-slate-200">正在聚合聪明钱买入流水...</h4>
            <p className="text-xs text-slate-400 mt-1">
              当监控到聪明钱买入时，系统将在此实时推出最火共识金狗。
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-dark-800/60 text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800/80">
                <tr>
                  <th className="py-3.5 px-4 text-center w-12">#</th>
                  <th className="py-3.5 px-4">代币信息 / 合约 CA</th>
                  <th className="py-3.5 px-4 text-amber-400 font-semibold">👥 聪明钱买入人数</th>
                  <th className="py-3.5 px-4 text-emerald-400 font-semibold">💰 聪明钱买入总额</th>
                  <th className="py-3.5 px-4">当前 GMGN 市值 (MC)</th>
                  <th className="py-3.5 px-4">1h 涨跌幅</th>
                  <th className="py-3.5 px-4">买入聪明钱巨鲸</th>
                  <th className="py-3.5 px-4 text-right">跟单操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {dogs.map((item, index) => {
                  const shortCA = item.address ? `${item.address.slice(0, 6)}...${item.address.slice(-4)}` : '';
                  const isCopied = copiedCA === item.address;
                  const isPositive = (item.priceChangePercent || 0) >= 0;

                  return (
                    <tr key={item.address} className="hover:bg-slate-800/30 transition">
                      {/* 排名 */}
                      <td className="py-4 px-4 text-center font-bold">
                        {index === 0 && <span className="text-lg">🥇</span>}
                        {index === 1 && <span className="text-lg">🥈</span>}
                        {index === 2 && <span className="text-lg">🥉</span>}
                        {index > 2 && <span className="text-slate-400 font-mono text-xs">#{index + 1}</span>}
                      </td>

                      {/* 代币名称与 CA */}
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2.5">
                          {item.logo ? (
                            <img src={item.logo} alt={item.symbol} className="h-8 w-8 rounded-full border border-slate-700 object-cover" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-amber-400 text-xs">
                              {item.symbol?.slice(0, 2) || 'TK'}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-white text-sm flex items-center space-x-1.5">
                              <span>${item.symbol}</span>
                              {item.source === 'MONITORED_AND_GMGN' && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  Top100命中
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                              <span className="text-[11px] text-slate-400 truncate max-w-[110px]">
                                {item.name || ''}
                              </span>
                              <button
                                onClick={() => copyToClipboard(item.address, item.address)}
                                className="flex items-center space-x-1 bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[10px] text-slate-400 hover:text-white transition"
                                title="点击复制代币 CA"
                              >
                                <span>{shortCA}</span>
                                {isCopied ? <Check className="h-3 w-3 text-brand-green" /> : <Copy className="h-3 w-3" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 聪明钱买入人数 */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-amber-400 font-mono">
                            {item.top100BuyerCount > 0 ? `${item.top100BuyerCount} 位 Top100 聪明钱` : `${item.gmgnSmartCount || 0} 位全网聪明钱`}
                          </span>
                          {item.top100BuyerCount > 0 && item.gmgnSmartCount > 0 && (
                            <span className="text-[10px] text-slate-400">
                              (全网聪明钱: {item.gmgnSmartCount} 人 | 鲸鱼: {item.gmgnRenownedCount} 人)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 聪明钱买入总金额 */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-emerald-400 font-mono">
                            ${Number(item.totalSmartBuyUsd || 0).toLocaleString()} USD
                          </span>
                          {item.volume1h > 0 && (
                            <span className="text-[10px] text-slate-400">
                              (1h 全网总成交: {formatMC(item.volume1h)})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 当前 GMGN 精准市值 */}
                      <td className="py-4 px-4 font-mono font-bold text-white">
                        <div className="flex items-center space-x-1">
                          <span>{formatMC(item.marketCap)}</span>
                          <span className="text-[10px] text-brand-cyan bg-brand-cyan/10 px-1 py-0.2 rounded font-normal">GMGN</span>
                        </div>
                      </td>

                      {/* 1h 涨跌幅 */}
                      <td className="py-4 px-4">
                        <div className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                          isPositive
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}>
                          {isPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                          <span>{isPositive ? '+' : ''}{item.priceChangePercent?.toFixed(2) || '0.00'}%</span>
                        </div>
                      </td>

                      {/* 买入代表 */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {item.buyers && item.buyers.length > 0 ? (
                            item.buyers.slice(0, 2).map((b, bi) => (
                              <span
                                key={bi}
                                className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 font-mono truncate border border-slate-700"
                                title={`${b.wallet_label} 买入 $${b.amount_usd}`}
                              >
                                {b.wallet_label?.slice(0, 8)} (${Number(b.amount_usd).toLocaleString()})
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-500">GMGN 榜单推荐共识</span>
                          )}
                        </div>
                      </td>

                      {/* 操作 */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => handleQuickBuy(item.address)}
                            disabled={buyingCA === item.address}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-brand-green/20 hover:bg-brand-green/30 text-brand-green border border-brand-green/40 transition disabled:opacity-50 whitespace-nowrap flex items-center space-x-1"
                            title="买入 10U 模拟仓"
                          >
                            <Zap className="h-3 w-3" />
                            <span>{buyingCA === item.address ? '买入中...' : '跟买 10U'}</span>
                          </button>
                          <a
                            href={`https://gmgn.ai/sol/token/${item.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            title="前往 GMGN 查看行情"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
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
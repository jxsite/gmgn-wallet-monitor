import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { Activity, DollarSign, Users, ShieldAlert, Sparkles, Flame } from 'lucide-react';

import Navbar from './components/Navbar.jsx';
import StatCards from './components/StatCards.jsx';
import LiveSignals from './components/LiveSignals.jsx';
import PaperTrading from './components/PaperTrading.jsx';
import WalletsTable from './components/WalletsTable.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import GoldenDogRadar from './components/GoldenDogRadar.jsx';

// 连接 Socket.io（在开发环境和生产环境自适应）
const socketUrl = window.location.port === '5173' ? 'http://localhost:3000' : '/';
const socket = io(socketUrl, {
  transports: ['websocket', 'polling']
});

export default function App() {
  const [activeTab, setActiveTab] = useState('signals'); // 'signals' | 'trading' | 'wallets'

  const [alerts, setAlerts] = useState([]);
  const [positions, setPositions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [wallets, setWallets] = useState([]);
  const [settings, setSettings] = useState(null);

  const [isMonitoring, setIsMonitoring] = useState(true);
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTestingBuy, setIsTestingBuy] = useState(false);

  // 1. 初始化数据加载
  useEffect(() => {
    // 监听 Socket.io 实时事件
    socket.on('connect', () => {
      console.log('[Socket] 已连接到监控服务器');
    });

    socket.on('initial:data', (data) => {
      if (data.alerts) setAlerts(data.alerts);
      if (data.positions) setPositions(data.positions);
      if (data.summary) setSummary(data.summary);
      if (data.isMonitoring !== undefined) setIsMonitoring(data.isMonitoring);
    });

    socket.on('alert:new', (newAlert) => {
      setAlerts((prev) => [newAlert, ...prev.slice(0, 99)]);
    });

    socket.on('position:new', (newPos) => {
      setPositions((prev) => [newPos, ...prev]);
    });

    socket.on('positions:update', (updatedPositions) => {
      setPositions(updatedPositions);
    });

    socket.on('summary:update', (newSummary) => {
      setSummary(newSummary);
    });

    socket.on('monitor:status', ({ isMonitoring }) => {
      setIsMonitoring(isMonitoring);
    });

    // REST API 初始拉取
    fetchWallets();
    fetchSettings();
    fetchStatus();

    return () => {
      socket.off('connect');
      socket.off('initial:data');
      socket.off('alert:new');
      socket.off('position:new');
      socket.off('positions:update');
      socket.off('summary:update');
      socket.off('monitor:status');
    };
  }, []);

  const fetchWallets = async () => {
    try {
      const res = await axios.get('/api/wallets');
      setWallets(res.data.wallets || []);
    } catch (err) {
      console.error('获取钱包列表失败:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await axios.get('/api/settings');
      setSettings(res.data.settings || {});
      const tgToken = res.data.settings?.telegram_bot_token;
      const tgChat = res.data.settings?.telegram_chat_id;
      setTelegramConfigured(!!(tgToken && tgChat));
    } catch (err) {
      console.error('获取设置失败:', err);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await axios.get('/api/status');
      setIsMonitoring(res.data.isMonitoring);
      setTelegramConfigured(res.data.telegramConfigured);
      if (res.data.summary) setSummary(res.data.summary);
    } catch (err) {
      console.error('获取状态失败:', err);
    }
  };

  // 监控启停
  const handleToggleMonitoring = async () => {
    try {
      const res = await axios.post('/api/monitor/toggle');
      setIsMonitoring(res.data.isMonitoring);
    } catch (err) {
      console.error('切换监控失败:', err);
    }
  };

  // 测试买入
  const handleTriggerTestBuy = async () => {
    setIsTestingBuy(true);
    try {
      await axios.post('/api/test/buy', {});
    } catch (err) {
      console.error('触发测试买入失败:', err);
    } finally {
      setTimeout(() => setIsTestingBuy(false), 1000);
    }
  };

  // 手动指定 CA 模拟买入 10U
  const handleManualBuy = async (tokenAddress) => {
    try {
      await axios.post('/api/test/buy', { tokenAddress });
    } catch (err) {
      alert('模拟买入失败: ' + (err.response?.data?.error || err.message));
    }
  };

  // 平仓模拟持仓
  const handleClosePosition = async (id) => {
    try {
      await axios.post(`/api/positions/${id}/close`);
    } catch (err) {
      console.error('平仓失败:', err);
    }
  };

  // 切换单个钱包监控状态
  const handleToggleWalletStatus = async (address, isMonitored) => {
    try {
      await axios.patch(`/api/wallets/${address}/status`, { isMonitored });
      setWallets((prev) =>
        prev.map((w) => (w.address === address ? { ...w, is_monitored: isMonitored ? 1 : 0 } : w))
      );
    } catch (err) {
      console.error('更新钱包状态失败:', err);
    }
  };

  // 添加自定义钱包
  const handleAddWallet = async (walletData) => {
    try {
      const res = await axios.post('/api/wallets', walletData);
      setWallets(res.data.wallets || []);
    } catch (err) {
      console.error('添加钱包失败:', err);
    }
  };

  // 保存系统配置
  const handleSaveSettings = async (newSettings) => {
    try {
      const res = await axios.post('/api/settings', newSettings);
      setSettings(res.data.settings);
      const tgToken = res.data.settings?.telegram_bot_token;
      const tgChat = res.data.settings?.telegram_chat_id;
      setTelegramConfigured(!!(tgToken && tgChat));
    } catch (err) {
      console.error('保存设置失败:', err);
    }
  };

  // 测试 Telegram
  const handleTestTelegram = async (token, chatId) => {
    try {
      const res = await axios.post('/api/telegram/test', { token, chatId });
      return res.data;
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 flex flex-col">
      {/* 顶部导航 */}
      <Navbar
        isMonitoring={isMonitoring}
        onToggleMonitoring={handleToggleMonitoring}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onTriggerTestBuy={handleTriggerTestBuy}
        telegramConfigured={telegramConfigured}
        isTestingBuy={isTestingBuy}
      />

      {/* 主界面主体 */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 数据总览看板 */}
        <StatCards
          summary={summary}
          walletsCount={wallets.length}
          alertsCount={alerts.length}
        />

        {/* 标签栏切换 */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 mb-6">
          <button
            onClick={() => setActiveTab('signals')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'signals'
                ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>实时买入监控 (Live Feed)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-dark-800 text-slate-300 font-mono">
              {alerts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('dogs')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'dogs'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Flame className="h-4 w-4 text-amber-400" />
            <span>🏆 聪明钱「金狗雷达」</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-mono">
              HOT
            </span>
          </button>

          <button
            onClick={() => setActiveTab('trading')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'trading'
                ? 'bg-brand-green/20 text-brand-green border border-brand-green/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <DollarSign className="h-4 w-4" />
            <span>10U 模拟交易持仓 (Paper Trading)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-dark-800 text-slate-300 font-mono">
              {positions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('wallets')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'wallets'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>GMGN 获利 Top 100 钱包</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-dark-800 text-slate-300 font-mono">
              {wallets.length}
            </span>
          </button>
        </div>

        {/* 标签页视图呈现 */}
        {activeTab === 'signals' && <LiveSignals alerts={alerts} />}

        {activeTab === 'dogs' && (
          <GoldenDogRadar onManualBuy={handleManualBuy} />
        )}

        {activeTab === 'trading' && (
          <PaperTrading
            positions={positions}
            onClosePosition={handleClosePosition}
            onManualBuy={handleManualBuy}
            summary={summary}
          />
        )}

        {activeTab === 'wallets' && (
          <WalletsTable
            wallets={wallets}
            onToggleStatus={handleToggleWalletStatus}
            onAddWallet={handleAddWallet}
          />
        )}
      </main>

      {/* 系统设置 Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        onTestTelegram={handleTestTelegram}
      />
    </div>
  );
}

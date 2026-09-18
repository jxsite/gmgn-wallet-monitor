import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { config } from './config.js';
import {
  initDatabase,
  getAllWallets,
  updateWalletStatus,
  addCustomWallet,
  getOpenPositions,
  getAllPositions,
  getRecentAlerts,
  getAllSettings,
  setSetting
} from './db/database.js';
import { tradingSimulator } from './services/tradingSimulator.js';
import { monitorService } from './services/monitorService.js';
import { telegramService } from './services/telegramService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. 初始化数据库
initDatabase();

// 2. 初始化 Express 与 HTTP Server
const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// 3. 初始化 Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 绑定 Socket 到监控引擎与模拟交易引擎
tradingSimulator.setSocketServer(io);
monitorService.setSocketServer(io);

io.on('connection', (socket) => {
  console.log(`[Socket] 客户端已连接: ${socket.id}`);

  // 立即下发初始状态
  socket.emit('initial:data', {
    alerts: getRecentAlerts(30),
    positions: getOpenPositions(),
    summary: tradingSimulator.getSummary(),
    isMonitoring: monitorService.isRunning
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] 客户端断开连接: ${socket.id}`);
  });
});

// ================= API 路由 =================

// 系统健康状态
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    isMonitoring: monitorService.isRunning,
    telegramConfigured: telegramService.isConfigured(),
    summary: tradingSimulator.getSummary()
  });
});

// 获取所有钱包列表
app.get('/api/wallets', (req, res) => {
  res.json({ wallets: getAllWallets() });
});

// 添加自定义监控钱包
app.post('/api/wallets', (req, res) => {
  const { address, label, win_rate, profit_7d, tag } = req.body;
  if (!address) {
    return res.status(400).json({ error: '钱包地址不能为空' });
  }
  addCustomWallet({ address, label, win_rate, profit_7d, tag });
  res.json({ success: true, wallets: getAllWallets() });
});

// 切换特定钱包监控状态
app.patch('/api/wallets/:address/status', (req, res) => {
  const { address } = req.params;
  const { isMonitored } = req.body;
  updateWalletStatus(address, isMonitored);
  res.json({ success: true });
});

// 获取最新买入预警记录
app.get('/api/alerts', (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);
  res.json({ alerts: getRecentAlerts(limit) });
});

// 获取持仓记录
app.get('/api/positions', (req, res) => {
  const all = req.query.all === 'true';
  const positions = all ? getAllPositions() : getOpenPositions();
  res.json({ positions });
});

// 平仓指定模拟仓位
app.post('/api/positions/:id/close', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await tradingSimulator.closePosition(id);
  res.json({ success: true });
});

// 获取持仓汇总指标
app.get('/api/summary', (req, res) => {
  res.json(tradingSimulator.getSummary());
});

// 获取系统设置
app.get('/api/settings', (req, res) => {
  res.json({ settings: getAllSettings() });
});

// 更新系统设置
app.post('/api/settings', (req, res) => {
  const settings = req.body;
  for (const [key, value] of Object.entries(settings)) {
    setSetting(key, value);
  }
  res.json({ success: true, settings: getAllSettings() });
});

// 测试 Telegram 连接
app.post('/api/telegram/test', async (req, res) => {
  const { token, chatId } = req.body;
  const result = await telegramService.testConnection(token, chatId);
  res.json(result);
});

// 触发测试买入信号
app.post('/api/test/buy', async (req, res) => {
  const { tokenAddress } = req.body;
  const result = await monitorService.triggerTestSignal(tokenAddress);
  res.json(result);
});

// 切换监控引擎状态
app.post('/api/monitor/toggle', (req, res) => {
  if (monitorService.isRunning) {
    monitorService.stop();
  } else {
    monitorService.start(config.monitorIntervalMs);
  }
  io.emit('monitor:status', { isMonitoring: monitorService.isRunning });
  res.json({ isMonitoring: monitorService.isRunning });
});

// 生产环境下静态托管 Vite 构建文件
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// 4. 启动服务与后台引擎
const PORT = config.port;
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 GMGN 聪明钱监控系统已启动: http://localhost:${PORT}`);
  console.log(`===============================================`);

  // 启动模拟价格刷新与监控轮询
  tradingSimulator.start(config.priceUpdateIntervalMs);
  monitorService.start(config.monitorIntervalMs);
});

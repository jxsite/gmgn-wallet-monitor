# GMGN Top 100 盈利钱包监控 & Telegram 机器人推送 & 10U 模拟交易系统

这是一个专为 Solana 生态设计的聪明钱链上买入监控与模拟跟单系统：
1. **GMGN 接口联动**：监控 GMGN 获利前 100 名高胜率聪明钱钱包的链上买入行为；
2. **多端即时通知**：网页端大屏通过 WebSocket 毫秒级推送，同时自动推送到您的 Telegram 机器人或群组；
3. **10U 模拟跟单模块**：当监控钱包买入代币时，系统**同步以 10 USD 模拟开仓**，锁定入场时代币市值（Entry MC），并每 5 秒通过 DexScreener 实时刷新当前市值与收益百分比（P&L %）；
4. **灵活部署**：支持本地一键运行、VPS 云服务器（Docker / PM2 一键启动），并附详细配置指南。

---

## 快速开始（本地运行）

### 1. 安装依赖
```bash
npm install
```

### 2. 构建与启动
```bash
# 构建前端静态资源
npm run build

# 启动全栈服务（生产单端口模式）
npm start
```

访问网页控制台：**[http://localhost:3000](http://localhost:3000)**

*提示：开发模式下亦可运行 `npm run dev`（同时启动前端 Vite 开发服务器与后端监控服务）。*

---

## 核心配置指引（可在网页端点击齿轮“设置”直接配置）

### 1. Telegram 机器人通知设置
1. 在 Telegram 搜索并打开 **[@BotFather](https://t.me/BotFather)**，发送 `/newbot`，按照指引创建一个机器人，获取专属的 **Bot Token**（格式如：`1234567890:ABCdefGHI...`）；
2. 获取您的 **Chat ID**：在 Telegram 搜索 **[@userinfobot](https://t.me/userinfobot)** 发送任意消息，它会回复您的数字 ID（如 `987654321`）；若需推送到群组，请将机器人拉入群组，并填入群组 Chat ID（一般为负数如 `-100123456789`）；
3. 打开系统网页控制台右上角 **设置 (⚙️)**，填入 Token 与 Chat ID，点击 **“发送测试消息”** 确认连通无误后保存即可。

### 2. GMGN API Key（可选）
- 前往 **[gmgn.ai/ai](https://gmgn.ai/ai)** 申请您的专属 API Key；
- 在网页设置中填入 API Key 即可直接与 GMGN OpenAPI 建立官方认证对接；
- *如暂未申请，系统会自动启用内置的 Top 100 高胜率种子钱包与 DexScreener 实时行情池，开箱即用。*

### 3. 10U 模拟跟单交易参数
- **单笔买入金额**：默认为 `10` USD（可自定义调整）；
- **自动跟单开关**：可开启或关闭自动模拟买入；
- **手动测试开仓**：在网页“10U 模拟交易持仓”面板中，您亦可随时手动粘贴任意 Solana 代币合约地址（CA）测试立即开仓 10U。

---

## 部署说明（为什么优先推荐 VPS 而不是 Vercel）

> **关于 Vercel 部署的重要技术说明：**
> Vercel 是无服务器（Serverless / Lambda）平台，每次接口调用最多运行 10~60 秒就会被强行销毁，**无法维持 24 小时不间断的后台进程持续轮询 100 个钱包的买入事件**，也无法提供长连接 WebSocket 实时推送价格。
>
> **因此推荐的部署方案为：**
> 1. **本地运行**：直接使用 `npm start`，日常开着电脑即可监控；
> 2. **自己的 VPS 云服务器**：使用配套的 Docker 一键启动，24/7 不间断监控。

### VPS Docker 一键部署
在您的 VPS 服务器上克隆或上传本项目代码，执行：

```bash
docker compose up -d --build
```

服务将自动在后台启动，数据文件将保存在宿主机 `./data` 目录。访问 `http://<您的VPS公网IP>:3000` 即可使用。

### VPS PM2 部署方式
若不使用 Docker，也可以使用 Node.js 进程守护工具 PM2：
```bash
npm install -g pm2
npm install
npm run build
pm2 start server/server.js --name "gmgn-monitor"
pm2 save
pm2 startup
```

---

## 项目结构
```
├── server/
│   ├── server.js               # Express + Socket.io 主服务
│   ├── config.js               # 系统环境变量与配置
│   ├── db/
│   │   ├── database.js         # SQLite 持久化层（设置/钱包/仓位/警报）
│   │   └── seedWallets.js      # GMGN Top 100 获利钱包预置种子库
│   └── services/
│       ├── gmgnService.js      # GMGN OpenAPI 认证对接服务
│       ├── priceService.js     # DexScreener 实时行情与 MC 查询服务
│       ├── telegramService.js  # 电报机器人通知服务
│       ├── tradingSimulator.js # 10U 模拟交易与收益率实时计算引擎
│       └── monitorService.js   # 钱包买入监控轮询与事件中枢
├── src/                        # React 前端看板
│   ├── App.jsx                 # 前端主应用框架
│   ├── components/
│   │   ├── Navbar.jsx          # 导航与状态控制栏
│   │   ├── StatCards.jsx       # 核心统计卡片
│   │   ├── LiveSignals.jsx     # 实时买入流水瀑布流
│   │   ├── PaperTrading.jsx    # 10U 模拟交易看板（实时 MC & 收益率）
│   │   ├── WalletsTable.jsx    # Top 100 钱包管理与筛选
│   │   └── SettingsModal.jsx   # 系统配置弹窗
├── Dockerfile                  # 容器化构建文件
├── docker-compose.yml          # Docker Compose 编排
└── package.json                # 项目依赖
```

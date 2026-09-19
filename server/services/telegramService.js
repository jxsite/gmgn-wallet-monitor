import axios from 'axios';
import { getSetting, setSetting } from '../db/database.js';

export class TelegramService {
  constructor() {
    this.io = null;
    this.pollTimer = null;
    this.lastUpdateId = 0;
  }

  setSocketServer(io) {
    this.io = io;
  }

  getCredentials() {
    const token = getSetting('telegram_bot_token', process.env.TELEGRAM_BOT_TOKEN || '8796135031:AAFYfOQ-MEGQ1WphjwMGGZjoxAwrthzYysk');
    const chatId = getSetting('telegram_chat_id', process.env.TELEGRAM_CHAT_ID || '');
    return { token, chatId };
  }

  isConfigured() {
    const { token, chatId } = this.getCredentials();
    return !!(token && chatId && token.trim() && chatId.trim());
  }

  // 启动 Telegram 自动监听（若未配置 Chat ID，用户在 TG 发送 /start 即可自动绑定）
  startAutoChatIdListener() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => this.checkTelegramUpdates(), 3500);
    console.log('[Telegram] 已启动 Telegram 自动监听（向 @lunacan3bot 发送 /start 即可自动绑定接收通知）');
  }

  // 轮询检测用户发送的 /start 消息自动获取 Chat ID
  async checkTelegramUpdates() {
    const { token, chatId } = this.getCredentials();
    if (!token) return;

    try {
      const res = await axios.get(`https://api.telegram.org/bot${token}/getUpdates`, {
        params: { offset: this.lastUpdateId + 1, timeout: 2 },
        timeout: 5000
      });

      const updates = res.data?.result || [];
      for (const u of updates) {
        this.lastUpdateId = Math.max(this.lastUpdateId, u.update_id);
        const msg = u.message || u.channel_post;
        if (!msg) continue;

        const incomingChatId = String(msg.chat?.id || '');
        const senderName = msg.from?.first_name || msg.chat?.title || '用户';

        // 若当前未配置 Chat ID 或用户主动发送 /start /bind
        if (incomingChatId && (!chatId || msg.text?.startsWith('/start') || msg.text?.startsWith('/bind'))) {
          setSetting('telegram_chat_id', incomingChatId);
          console.log(`[Telegram] 🎉 自动识别并绑定 Chat ID: ${incomingChatId} (来自: ${senderName})`);

          // 立即向用户发送欢迎确认消息
          await this.sendRawMessage(incomingChatId, `
🎉 <b>GMGN 监控机器人绑定成功！</b>
━━━━━━━━━━━━━━━━━
👤 欢迎您，<b>${senderName}</b>！
🤖 机器人: @lunacan3bot
🎯 接收通道 ID: <code>${incomingChatId}</code>

📋 <b>当前已生效交易策略：</b>
1️⃣ <b>防重复买入</b>：同币种已持仓时不重复开仓；
2️⃣ <b>翻3倍卖1.5倍</b>：达到 3x 收益时自动卖出 1.5 倍本金（落袋保本），剩余零成本仓位永久持有；
3️⃣ <b>暴涨倍数提醒</b>：达 2x, 3x, 4x, 5x, 10x, 20x, 30x, 50x, 70x, 100x 时即刻推送；
4️⃣ <b>跌50%止损</b>：若代币自开仓点跌达 50% 立即自动清仓止损。
━━━━━━━━━━━━━━━━━
系统已就绪，当监控到获利前 100 名钱包买入时将在此实时推送。
          `.trim());

          if (this.io) {
            this.io.emit('telegram:bound', { chatId: incomingChatId });
          }
          break;
        }
      }
    } catch (e) {
      // 忽略轮询网络偶发超时
    }
  }

  // 格式化数字：市值转换为易读单位（K, M, B）
  formatNumber(num) {
    if (!num || isNaN(num)) return '$0';
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${Number(num).toFixed(2)}`;
  }

  async sendRawMessage(targetChatId, messageHtml) {
    const { token } = this.getCredentials();
    if (!token || !targetChatId) return false;
    try {
      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: targetChatId,
        text: messageHtml,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }, { timeout: 8000 });
      return true;
    } catch (err) {
      console.error('[Telegram] 发送消息失败:', err.response?.data?.description || err.message);
      return false;
    }
  }

  // 1. 发送买入预警通知（区分新买入与重复过滤）
  async sendBuyAlert({
    walletAddress,
    walletLabel,
    tokenAddress,
    tokenSymbol,
    tokenName,
    buyAmountUsd,
    marketCap,
    simulatedBuyAmount = 10,
    isDuplicate = false,
    txHash
  }) {
    const { token, chatId } = this.getCredentials();
    if (!this.isConfigured()) return false;

    const shortWallet = walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : '未知钱包';
    const gmgnWalletUrl = `https://gmgn.ai/sol/address/${walletAddress}`;
    const gmgnTokenUrl = `https://gmgn.ai/sol/token/${tokenAddress}`;
    const dexscreenerUrl = `https://dexscreener.com/solana/${tokenAddress}`;
    const solscanTxUrl = txHash ? `https://solscan.io/tx/${txHash}` : `https://solscan.io/account/${walletAddress}`;

    const formattedMC = this.formatNumber(marketCap);
    const timeStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });

    let strategyStatus = '';
    if (isDuplicate) {
      strategyStatus = `⚠️ <b>【策略防护】该代币已有活跃持仓，执行规则：不重复买入开仓！</b>`;
    } else {
      strategyStatus = `
🤖 <b>【10U 模拟跟单】</b>
✅ 已同步开仓: <b>${simulatedBuyAmount} USD</b>
📌 入场基准 MC: <b>${formattedMC}</b>
🎯 预设止盈: <b>3x 时卖出 1.5 倍本金 ($15U)</b>
🛑 预设止损: <b>-50% 时直接清仓</b>
      `.trim();
    }

    const messageHtml = `
🚀 <b>【GMGN 聪明钱买入预警】</b>
━━━━━━━━━━━━━━━━━
👤 <b>监控钱包:</b> <a href="${gmgnWalletUrl}"><b>${walletLabel || 'Smart Money'}</b> (${shortWallet})</a>
🪙 <b>代币信息:</b> <b>$${tokenSymbol || 'UNKNOWN'}</b> | ${tokenName || ''}
📋 <b>合约地址 CA:</b>
<code>${tokenAddress}</code>

💰 <b>钱包买入:</b> $${(buyAmountUsd || 0).toLocaleString()} USD
📊 <b>代币当前 MC:</b> <b>${formattedMC}</b>
⏰ <b>捕获时间:</b> ${timeStr}

${strategyStatus}

🔗 <b>快捷通道:</b>
<a href="${gmgnTokenUrl}">[GMGN 代币]</a> | <a href="${dexscreenerUrl}">[DexScreener 图表]</a> | <a href="${solscanTxUrl}">[链上详情]</a>
━━━━━━━━━━━━━━━━━
    `.trim();

    return this.sendRawMessage(chatId, messageHtml);
  }

  // 2. 发送【翻3倍卖出1.5倍】策略执行通知
  async sendTakeProfit3xAlert({ tokenSymbol, tokenAddress, entryMc, currentMc, pnlRatio }) {
    const { chatId } = this.getCredentials();
    if (!this.isConfigured()) return false;

    const messageHtml = `
🎯 <b>【3 倍止盈执行提醒】</b>
━━━━━━━━━━━━━━━━━
🪙 <b>代币:</b> <b>$${tokenSymbol}</b>
📋 <b>合约 CA:</b> <code>${tokenAddress}</code>
📊 <b>入场 MC:</b> ${this.formatNumber(entryMc)} ➔ <b>当前 MC:</b> ${this.formatNumber(currentMc)}
📈 <b>当前收益率:</b> <b>+${pnlRatio}% (达成 3x 翻倍目标)</b>

💰 <b>【策略执行情况】</b>
✅ <b>已自动卖出 1.5 倍本金：收回 $15.00 USD！</b>
🎉 <b>已提前收回初始 $10 本金并净赚 $5 利润（已完全保本并锁定利润）！</b>
🌱 <b>剩余仓位（零成本 Moonbag）将继续永久持有，博取更高倍数爆发！</b>

🔗 <a href="https://dexscreener.com/solana/${tokenAddress}">[DexScreener 实时图表]</a> | <a href="https://gmgn.ai/sol/token/${tokenAddress}">[GMGN 页面]</a>
━━━━━━━━━━━━━━━━━
    `.trim();

    return this.sendRawMessage(chatId, messageHtml);
  }

  // 3. 发送【暴涨倍数里程碑】提醒 (2x, 3x, 4x, 5x, 10x, 20x, 30x, 50x, 70x, 100x)
  async sendMilestoneAlert({ tokenSymbol, tokenAddress, multiplier, entryMc, currentMc, pnlRatio }) {
    const { chatId } = this.getCredentials();
    if (!this.isConfigured()) return false;

    const messageHtml = `
🚀 <b>【金狗暴涨 ${multiplier} 倍里程碑】</b>
━━━━━━━━━━━━━━━━━
🪙 <b>代币:</b> <b>$${tokenSymbol}</b>
🔥 <b>已突破达成:</b> <b>${multiplier} 倍 (x${multiplier})！</b>
📊 <b>入场 MC:</b> ${this.formatNumber(entryMc)} ➔ <b>当前 MC:</b> ${this.formatNumber(currentMc)}
💰 <b>当前账面浮盈:</b> <b>+${pnlRatio}%</b>
⏰ <b>记录时间:</b> ${new Date().toLocaleTimeString('zh-CN')}

🔗 <a href="https://dexscreener.com/solana/${tokenAddress}">[查看实盘走势]</a>
━━━━━━━━━━━━━━━━━
    `.trim();

    return this.sendRawMessage(chatId, messageHtml);
  }

  // 4. 发送【跌 50% 直接清仓】止损通知
  async sendStopLossAlert({ tokenSymbol, tokenAddress, entryMc, currentMc, pnlRatio }) {
    const { chatId } = this.getCredentials();
    if (!this.isConfigured()) return false;

    const messageHtml = `
🛑 <b>【触发跌破 50% 止损清仓】</b>
━━━━━━━━━━━━━━━━━
🪙 <b>代币:</b> <b>$${tokenSymbol}</b>
📋 <b>合约 CA:</b> <code>${tokenAddress}</code>
📉 <b>入场 MC:</b> ${this.formatNumber(entryMc)} ➔ <b>当前跌至:</b> ${this.formatNumber(currentMc)}
📉 <b>跌幅比例:</b> <font color="#ff4d6d"><b>${pnlRatio}%</b></font>

⚠️ <b>【策略执行情况】</b>
🛑 <b>已严格执行止损规则：直接全额清仓离场！</b>
💡 果断规避代币归零风险，保留本金准备下一波聪明钱机会。
━━━━━━━━━━━━━━━━━
    `.trim();

    return this.sendRawMessage(chatId, messageHtml);
  }

  // 测试连通性
  async testConnection(customToken = null, customChatId = null) {
    const token = customToken || this.getCredentials().token;
    const chatId = customChatId || this.getCredentials().chatId;

    if (!token || !chatId) {
      return { success: false, message: 'Bot Token 或 Chat ID 不能为空' };
    }

    try {
      const getMeRes = await axios.get(`https://api.telegram.org/bot${token}/getMe`, { timeout: 8000 });
      const botName = getMeRes.data?.result?.username || 'lunacan3bot';

      const text = `
🤖 <b>GMGN 监控机器人连接成功！</b>
━━━━━━━━━━━━━━━━━
✅ 机器人账号: @${botName}
🎯 目标 Chat ID: <code>${chatId}</code>
⏰ 测试时间: ${new Date().toLocaleString('zh-CN')}
💡 系统已就绪，已开启：
• 避免重复买入
• 翻3倍卖1.5倍本金
• 2~100倍多阶梯里程碑推送
• 跌50%坚决止损清仓
      `.trim();

      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: 'HTML'
      }, { timeout: 8000 });

      return { success: true, message: `连接成功！已向 @${botName} 发送测试消息。` };
    } catch (err) {
      const errMsg = err.response?.data?.description || err.message;
      return { success: false, message: `连接失败: ${errMsg}` };
    }
  }
}

export const telegramService = new TelegramService();

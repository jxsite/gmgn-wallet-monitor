import axios from 'axios';
import { getSetting } from '../db/database.js';

export class TelegramService {
  constructor() {}

  getCredentials() {
    const token = getSetting('telegram_bot_token', process.env.TELEGRAM_BOT_TOKEN || '');
    const chatId = getSetting('telegram_chat_id', process.env.TELEGRAM_CHAT_ID || '');
    return { token, chatId };
  }

  isConfigured() {
    const { token, chatId } = this.getCredentials();
    return !!(token && chatId && token.trim() && chatId.trim());
  }

  // 格式化数字：市值转换为易读单位（K, M, B）
  formatNumber(num) {
    if (!num || isNaN(num)) return '$0';
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${Number(num).toFixed(2)}`;
  }

  // 发送买入预警与模拟跟单通知
  async sendBuyAlert({
    walletAddress,
    walletLabel,
    tokenAddress,
    tokenSymbol,
    tokenName,
    buyAmountUsd,
    marketCap,
    simulatedBuyAmount = 10,
    txHash
  }) {
    const { token, chatId } = this.getCredentials();
    if (!this.isConfigured()) {
      console.log('[Telegram] 未配置 Bot Token 或 Chat ID，跳过推送');
      return false;
    }

    const shortWallet = walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : '未知钱包';
    const gmgnWalletUrl = `https://gmgn.ai/sol/address/${walletAddress}`;
    const gmgnTokenUrl = `https://gmgn.ai/sol/token/${tokenAddress}`;
    const dexscreenerUrl = `https://dexscreener.com/solana/${tokenAddress}`;
    const solscanTxUrl = txHash ? `https://solscan.io/tx/${txHash}` : `https://solscan.io/account/${walletAddress}`;

    const formattedMC = this.formatNumber(marketCap);
    const timeStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });

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

🤖 <b>【模拟交易系统】</b>
✅ 已同步模拟买入: <b>${simulatedBuyAmount} USD</b>
📌 入场基准 MC: <b>${formattedMC}</b>

🔗 <b>快捷通道:</b>
<a href="${gmgnTokenUrl}">[GMGN 代币]</a> | <a href="${dexscreenerUrl}">[DexScreener 图表]</a> | <a href="${solscanTxUrl}">[链上详情]</a>
━━━━━━━━━━━━━━━━━
    `.trim();

    try {
      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: chatId,
        text: messageHtml,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }, { timeout: 8000 });

      console.log(`[Telegram] 买入通知已成功推送到 TG: $${tokenSymbol} (CA: ${tokenAddress.slice(0, 8)}...)`);
      return true;
    } catch (err) {
      console.error('[Telegram] 推送通知失败:', err.response?.data?.description || err.message);
      return false;
    }
  }

  // 测试连通性
  async testConnection(customToken = null, customChatId = null) {
    const token = customToken || this.getCredentials().token;
    const chatId = customChatId || this.getCredentials().chatId;

    if (!token || !chatId) {
      return { success: false, message: 'Bot Token 或 Chat ID 不能为空' };
    }

    try {
      // 先验证 Bot 信息
      const getMeRes = await axios.get(`https://api.telegram.org/bot${token}/getMe`, { timeout: 8000 });
      const botName = getMeRes.data?.result?.username || 'Telegram Bot';

      // 发送测试消息
      const text = `
🤖 <b>GMGN 监控机器人连接成功！</b>
━━━━━━━━━━━━━━━━━
✅ 机器人账号: @${botName}
🎯 接收目标 Chat ID: <code>${chatId}</code>
⏰ 测试时间: ${new Date().toLocaleString('zh-CN')}
💡 系统已就绪，当监控到获利前 100 名钱包买入时将在此实时推送。
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

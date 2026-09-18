import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  gmgnApiKey: process.env.GMGN_API_KEY || '',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  autoBuyAmount: parseFloat(process.env.AUTO_BUY_AMOUNT || '10'),
  autoBuyEnabled: process.env.AUTO_BUY_ENABLED !== 'false',
  monitorIntervalMs: parseInt(process.env.MONITOR_INTERVAL_MS || '8000', 10),
  priceUpdateIntervalMs: parseInt(process.env.PRICE_UPDATE_INTERVAL_MS || '5000', 10),
  chain: process.env.CHAIN || 'sol',
  dbPath: path.join(__dirname, '../data/monitor.db'),
};

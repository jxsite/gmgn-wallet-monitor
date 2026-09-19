import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SEED_WALLETS } from './seedWallets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const dbPath = path.join(DATA_DIR, 'monitor.db');
const db = new DatabaseSync(dbPath);

// 初始化数据库表
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rank INTEGER,
      address TEXT UNIQUE,
      label TEXT,
      win_rate REAL,
      profit_7d REAL,
      pnl_ratio REAL,
      tag TEXT,
      is_monitored INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_address TEXT,
      token_symbol TEXT,
      token_name TEXT,
      chain TEXT DEFAULT 'sol',
      entry_mc REAL,
      entry_price REAL,
      entry_amount REAL DEFAULT 10.0,
      current_mc REAL,
      current_price REAL,
      current_pnl_ratio REAL DEFAULT 0.0,
      status TEXT DEFAULT 'OPEN', -- 'OPEN' or 'CLOSED'
      trigger_wallet TEXT,
      has_taken_profit_3x INTEGER DEFAULT 0, -- 是否已触发 3倍卖1.5倍本金
      realized_profit REAL DEFAULT 0.0,     -- 已锁定落袋收益 (USD)
      reached_milestones TEXT DEFAULT '[]', -- 已推送过的倍数里程碑 JSON 数组
      close_reason TEXT DEFAULT '',         -- 平仓原因 (STOP_LOSS_50 / MANUAL / etc)
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx_hash TEXT UNIQUE,
      wallet_address TEXT,
      wallet_label TEXT,
      token_address TEXT,
      token_symbol TEXT,
      token_name TEXT,
      side TEXT,
      amount_usd REAL,
      mc_at_event REAL,
      is_simulated INTEGER DEFAULT 0,
      sim_status TEXT DEFAULT '',           -- 'SIMULATED' / 'ALREADY_HELD' (已持仓跳过)
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 动态补充字段以兼容已有旧数据库
  try { db.exec("ALTER TABLE positions ADD COLUMN has_taken_profit_3x INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE positions ADD COLUMN realized_profit REAL DEFAULT 0.0"); } catch (e) {}
  try { db.exec("ALTER TABLE positions ADD COLUMN reached_milestones TEXT DEFAULT '[]'"); } catch (e) {}
  try { db.exec("ALTER TABLE positions ADD COLUMN close_reason TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE alerts ADD COLUMN sim_status TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE alerts ADD COLUMN price_usd REAL DEFAULT 0.0"); } catch (e) {}
  try { db.exec("ALTER TABLE alerts ADD COLUMN twitter_username TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE alerts ADD COLUMN is_custom INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE alerts ADD COLUMN is_associated INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE wallets ADD COLUMN twitter_username TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE wallets ADD COLUMN twitter_name TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE wallets ADD COLUMN is_custom INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE wallets ADD COLUMN is_associated INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE wallets ADD COLUMN parent_wallet TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE wallets ADD COLUMN fund_source TEXT DEFAULT ''"); } catch (e) {}

  // 检查是否已有钱包，如果没有或全是旧虚拟哈希，则导入/刷新 100 个真实种子钱包
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM wallets');
  const { count } = countStmt.get();

  const customCount = db.prepare('SELECT COUNT(*) as count FROM wallets WHERE is_custom = 1').get()?.count || 0;
  if (count === 0) {
    const insertWallet = db.prepare(`
      INSERT OR IGNORE INTO wallets (rank, address, label, win_rate, profit_7d, pnl_ratio, tag, is_monitored, twitter_username)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    for (const w of SEED_WALLETS) {
      insertWallet.run(w.rank, w.address, w.label, w.winRate, w.profit7d, w.pnlRatio, w.tag, w.twitter_username || '');
    }
    console.log(`[DB] 已初始化导入 ${SEED_WALLETS.length} 个 GMGN Top 聪明钱钱包`);
  } else if (customCount === 0) {
    // 检查是否有带推特的有效聪明钱，若全无推特且为旧虚拟哈希，则平滑升级
    const hasTwitterCount = db.prepare("SELECT COUNT(*) as count FROM wallets WHERE twitter_username != ''").get()?.count || 0;
    if (hasTwitterCount === 0) {
      db.prepare('DELETE FROM wallets WHERE is_custom = 0 AND is_associated = 0').run();
      const insertWallet = db.prepare(`
        INSERT OR IGNORE INTO wallets (rank, address, label, win_rate, profit_7d, pnl_ratio, tag, is_monitored, twitter_username)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      `);
      for (const w of SEED_WALLETS) {
        insertWallet.run(w.rank, w.address, w.label, w.winRate, w.profit7d, w.pnlRatio, w.tag, w.twitter_username || '');
      }
      console.log(`[DB] 已自动升级刷新为 ${SEED_WALLETS.length} 个全新真实 Solana 聪明钱地址库 (含 X 账号)`);
    }
  }

  // 写入用户指定的专属 Telegram Bot Token
  const defaultToken = '8796135031:AAFYfOQ-MEGQ1WphjwMGGZjoxAwrthzYysk';
  const currentToken = getSetting('telegram_bot_token');
  if (!currentToken || currentToken.trim() === '') {
    setSetting('telegram_bot_token', defaultToken);
    console.log('[DB] 已自动配置 Telegram Bot Token: @lunacan3bot');
  }

  // 写入用户指定的专属 GMGN API Key
  const defaultApiKey = 'gmgn_59afed5e6c4e5fbd0e2fd5930ce75d6a';
  const currentApiKey = getSetting('gmgn_api_key');
  if (!currentApiKey || currentApiKey.trim() === '') {
    setSetting('gmgn_api_key', defaultApiKey);
    console.log('[DB] 已自动配置 GMGN API Key: ' + defaultApiKey.substring(0, 10) + '...');
  }
}

// Settings 辅助方法
export function getSetting(key, defaultValue = '') {
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const row = stmt.get(key);
  return row ? row.value : defaultValue;
}

export function setSetting(key, value) {
  const stmt = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(key, String(value));
}

export function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const res = {};
  for (const r of rows) {
    res[r.key] = r.value;
  }
  return res;
}

// 钱包管理
export function getMonitoredWallets() {
  return db.prepare('SELECT * FROM wallets WHERE is_monitored = 1 ORDER BY rank ASC').all();
}

export function getAllWallets() {
  return db.prepare('SELECT * FROM wallets ORDER BY rank ASC').all();
}

export function updateWalletStatus(address, isMonitored) {
  return db.prepare('UPDATE wallets SET is_monitored = ? WHERE address = ?').run(isMonitored ? 1 : 0, address);
}

export function addCustomWallet(wallet) {
  const stmt = db.prepare(`
    INSERT INTO wallets (rank, address, label, win_rate, profit_7d, pnl_ratio, tag, is_monitored, is_custom, twitter_username)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?)
    ON CONFLICT(address) DO UPDATE SET
      label = excluded.label,
      win_rate = excluded.win_rate,
      profit_7d = excluded.profit_7d,
      is_monitored = 1,
      is_custom = 1,
      twitter_username = CASE WHEN excluded.twitter_username != '' THEN excluded.twitter_username ELSE wallets.twitter_username END
  `);
  return stmt.run(
    wallet.rank || 999,
    wallet.address,
    wallet.label || '自定义关注钱包',
    wallet.win_rate || 75.0,
    wallet.profit_7d || 50000,
    wallet.pnl_ratio || 150.0,
    wallet.tag || 'CUSTOM',
    wallet.twitter_username || ''
  );
}

export function addAssociatedWallet({ address, label, parent_wallet, fund_source, twitter_username }) {
  const stmt = db.prepare(`
    INSERT INTO wallets (rank, address, label, win_rate, profit_7d, pnl_ratio, tag, is_monitored, is_associated, parent_wallet, fund_source, twitter_username)
    VALUES (888, ?, ?, 72.0, 28000, 120.0, 'ASSOCIATED', 1, 1, ?, ?, ?)
    ON CONFLICT(address) DO UPDATE SET
      is_associated = 1,
      parent_wallet = excluded.parent_wallet,
      fund_source = excluded.fund_source,
      is_monitored = 1
  `);
  return stmt.run(
    address,
    label || `🔗 关联小号 (${parent_wallet.slice(0, 4)}...)`,
    parent_wallet || '',
    fund_source || '',
    twitter_username || ''
  );
}

export function updateWalletTwitter(address, twitter_username, twitter_name = '') {
  if (!address || !twitter_username) return;
  const stmt = db.prepare(`
    UPDATE wallets
    SET twitter_username = ?, twitter_name = ?
    WHERE address = ? AND (twitter_username IS NULL OR twitter_username = '')
  `);
  return stmt.run(twitter_username, twitter_name, address);
}

// 自动收录 GMGN 实时链上最新交易的真实聪明钱地址
export function upsertSmartWalletFromTrade({ address, label, tag, twitter_username }) {
  if (!address || address.length < 32) return;
  const existing = db.prepare('SELECT address, is_custom, is_associated, twitter_username FROM wallets WHERE address = ?').get(address);
  if (!existing) {
    const maxRankRow = db.prepare('SELECT MAX(rank) as max_rank FROM wallets').get();
    const newRank = Math.min((maxRankRow?.max_rank || 100) + 1, 999);
    const stmt = db.prepare(`
      INSERT INTO wallets (rank, address, label, win_rate, profit_7d, pnl_ratio, tag, is_monitored, twitter_username)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);
    stmt.run(
      newRank,
      address,
      label || 'GMGN 获利聪明钱',
      78.5,
      68000,
      180.0,
      tag || 'smart_degen',
      twitter_username || ''
    );
  } else if (twitter_username && !existing.twitter_username) {
    db.prepare('UPDATE wallets SET twitter_username = ? WHERE address = ?').run(twitter_username, address);
  }
}


export function isCustomWallet(address) {
  if (!address) return false;
  const row = db.prepare('SELECT is_custom FROM wallets WHERE address = ?').get(address);
  return row ? Boolean(row.is_custom) : false;
}

export function isAssociatedWallet(address) {
  if (!address) return { isAssociated: false, parentWallet: '' };
  const row = db.prepare('SELECT is_associated, parent_wallet FROM wallets WHERE address = ?').get(address);
  return row ? { isAssociated: Boolean(row.is_associated), parentWallet: row.parent_wallet || '' } : { isAssociated: false, parentWallet: '' };
}

export function getAssociatedWallets() {
  return db.prepare('SELECT * FROM wallets WHERE is_associated = 1 ORDER BY created_at DESC').all();
}

// 检查某个代币是否已处于持仓中（去重防重复买入）
export function hasOpenPositionForToken(tokenAddress) {
  const row = db.prepare("SELECT COUNT(*) as count FROM positions WHERE token_address = ? AND status = 'OPEN'").get(tokenAddress);
  return row ? row.count > 0 : false;
}

// 持仓与模拟交易
export function getOpenPositions() {
  return db.prepare("SELECT * FROM positions WHERE status = 'OPEN' ORDER BY created_at DESC").all();
}

export function getAllPositions() {
  return db.prepare('SELECT * FROM positions ORDER BY created_at DESC LIMIT 100').all();
}

export function insertPosition(pos) {
  const stmt = db.prepare(`
    INSERT INTO positions (
      token_address, token_symbol, token_name, chain,
      entry_mc, entry_price, entry_amount,
      current_mc, current_price, current_pnl_ratio,
      status, trigger_wallet, has_taken_profit_3x, realized_profit, reached_milestones
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, 0, 0.0, '[]')
  `);
  const info = stmt.run(
    pos.token_address,
    pos.token_symbol,
    pos.token_name,
    pos.chain || 'sol',
    pos.entry_mc,
    pos.entry_price,
    pos.entry_amount || 10.0,
    pos.current_mc || pos.entry_mc,
    pos.current_price || pos.entry_price,
    pos.current_pnl_ratio || 0.0,
    pos.trigger_wallet
  );
  return info.lastInsertRowid;
}

export function updatePositionPrice(id, currentMc, currentPrice, currentPnlRatio) {
  const stmt = db.prepare(`
    UPDATE positions
    SET current_mc = ?, current_price = ?, current_pnl_ratio = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  return stmt.run(currentMc, currentPrice, currentPnlRatio, id);
}

export function updatePositionStrategy(id, updates) {
  const fields = [];
  const values = [];

  if (updates.current_mc !== undefined) { fields.push('current_mc = ?'); values.push(updates.current_mc); }
  if (updates.current_price !== undefined) { fields.push('current_price = ?'); values.push(updates.current_price); }
  if (updates.current_pnl_ratio !== undefined) { fields.push('current_pnl_ratio = ?'); values.push(updates.current_pnl_ratio); }
  if (updates.has_taken_profit_3x !== undefined) { fields.push('has_taken_profit_3x = ?'); values.push(updates.has_taken_profit_3x); }
  if (updates.realized_profit !== undefined) { fields.push('realized_profit = ?'); values.push(updates.realized_profit); }
  if (updates.reached_milestones !== undefined) { fields.push('reached_milestones = ?'); values.push(updates.reached_milestones); }
  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
  if (updates.close_reason !== undefined) { fields.push('close_reason = ?'); values.push(updates.close_reason); }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const stmt = db.prepare(`UPDATE positions SET ${fields.join(', ')} WHERE id = ?`);
  return stmt.run(...values);
}

export function closePosition(id, reason = 'MANUAL') {
  const stmt = db.prepare(`
    UPDATE positions
    SET status = 'CLOSED', close_reason = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  return stmt.run(reason, id);
}

// 警报记录
export function insertAlert(alert) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO alerts (
      tx_hash, wallet_address, wallet_label,
      token_address, token_symbol, token_name,
      side, amount_usd, mc_at_event, is_simulated, sim_status,
      price_usd, twitter_username, is_custom, is_associated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(
    alert.tx_hash || `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    alert.wallet_address || '',
    alert.wallet_label || 'GMGN 聪明钱',
    alert.token_address || '',
    alert.token_symbol || 'TOKEN',
    alert.token_name || 'Token',
    alert.side || 'BUY',
    Number(alert.amount_usd) || 0,
    Number(alert.mc_at_event) || 0,
    alert.is_simulated ? 1 : 0,
    alert.sim_status || (alert.is_simulated ? 'SIMULATED' : ''),
    Number(alert.price_usd) || 0,
    alert.twitter_username || '',
    alert.is_custom ? 1 : 0,
    alert.is_associated ? 1 : 0
  );
}

export function getRecentAlerts(limit = 50) {
  return db.prepare('SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?').all(limit);
}

export { db };

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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 检查是否已有钱包，如果没有则导入 100 个种子钱包
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM wallets');
  const { count } = countStmt.get();

  if (count === 0) {
    const insertWallet = db.prepare(`
      INSERT OR IGNORE INTO wallets (rank, address, label, win_rate, profit_7d, pnl_ratio, tag, is_monitored)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);

    for (const w of SEED_WALLETS) {
      insertWallet.run(w.rank, w.address, w.label, w.winRate, w.profit7d, w.pnlRatio, w.tag);
    }
    console.log(`[DB] 已初始化导入 ${SEED_WALLETS.length} 个 GMGN Top 聪明钱钱包`);
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
    INSERT INTO wallets (rank, address, label, win_rate, profit_7d, pnl_ratio, tag, is_monitored)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(address) DO UPDATE SET
      label = excluded.label,
      win_rate = excluded.win_rate,
      profit_7d = excluded.profit_7d,
      is_monitored = 1
  `);
  return stmt.run(
    wallet.rank || 999,
    wallet.address,
    wallet.label || '自定义钱包',
    wallet.win_rate || 75.0,
    wallet.profit_7d || 50000,
    wallet.pnl_ratio || 150.0,
    wallet.tag || 'custom'
  );
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
      status, trigger_wallet
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?)
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

export function closePosition(id) {
  const stmt = db.prepare(`
    UPDATE positions
    SET status = 'CLOSED', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  return stmt.run(id);
}

// 警报记录
export function insertAlert(alert) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO alerts (
      tx_hash, wallet_address, wallet_label,
      token_address, token_symbol, token_name,
      side, amount_usd, mc_at_event, is_simulated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(
    alert.tx_hash,
    alert.wallet_address,
    alert.wallet_label,
    alert.token_address,
    alert.token_symbol,
    alert.token_name,
    alert.side,
    alert.amount_usd,
    alert.mc_at_event,
    alert.is_simulated ? 1 : 0
  );
}

export function getRecentAlerts(limit = 50) {
  return db.prepare('SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?').all(limit);
}

export { db };

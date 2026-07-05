const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'return-home.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

/**
 * 安全执行 ALTER TABLE ADD COLUMN（忽略重复列错误）
 */
function safeAddColumn(db, sql) {
  try {
    db.exec(sql);
    return true;
  } catch (e) {
    if (e.message && e.message.includes('duplicate column name')) {
      return false;
    }
    throw e;
  }
}

function initDatabase() {
  const dbInstance = getDb();

  // -- V1: users table --
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      birth_date TEXT NOT NULL,
      life_expectancy INTEGER DEFAULT 80,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

    -- V1: entries table --
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      content TEXT NOT NULL,
      rating INTEGER DEFAULT 3 CHECK(rating >= 1 AND rating <= 5),
      satisfaction INTEGER DEFAULT 3 CHECK(satisfaction >= 1 AND satisfaction <= 5),
      category TEXT DEFAULT 'life',
      tags TEXT,
      date TEXT,
      entry_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(entry_date);
    CREATE INDEX IF NOT EXISTS idx_entries_user_id ON entries(user_id);
  `);

  // Migrate: copy rating to satisfaction for backward compatibility
  try {
    dbInstance.exec(`UPDATE entries SET rating = satisfaction WHERE rating IS NULL AND satisfaction IS NOT NULL`);
    dbInstance.exec(`UPDATE entries SET entry_date = date WHERE entry_date IS NULL AND date IS NOT NULL`);
  } catch (e) {
    // Ignore migration errors
  }

  // -- V2: Schema Migration (safe, idempotent) --
  safeAddColumn(dbInstance, 'ALTER TABLE users ADD COLUMN phone TEXT');
  safeAddColumn(dbInstance, 'ALTER TABLE users ADD COLUMN password_hash TEXT');
  safeAddColumn(dbInstance, 'ALTER TABLE users ADD COLUMN content_salt TEXT');
  safeAddColumn(dbInstance, 'ALTER TABLE users ADD COLUMN display_name TEXT');
  safeAddColumn(dbInstance, "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
  safeAddColumn(dbInstance, "ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  safeAddColumn(dbInstance, 'ALTER TABLE users ADD COLUMN last_login_at TEXT');
  safeAddColumn(dbInstance, 'ALTER TABLE entries ADD COLUMN content_encrypted TEXT');

  // -- V2: New tables --
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      device_info TEXT,
      ip_address TEXT,
      expires_at TEXT NOT NULL,
      revoked INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      event_type TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      path TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS sms_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      code TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT 'reset',
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // -- V2: Indexes --
  dbInstance.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
    CREATE INDEX IF NOT EXISTS idx_entries_user_id_v2 ON entries(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
    CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_log_event_type ON activity_log(event_type);
    CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_activity_log_date ON activity_log(date(created_at));
    CREATE INDEX IF NOT EXISTS idx_sms_codes_phone ON sms_codes(phone);
  `);

  // -- V2: Seed admin user --
  const { seedAdmin } = require('../scripts/seedAdmin');
  seedAdmin();

  // -- V2: Cleanup expired refresh tokens --
  try {
    dbInstance.exec(
      "DELETE FROM refresh_tokens WHERE expires_at < datetime('now')"
    );
  } catch (e) {
    // Table might not exist yet during first migration
  }

  console.log('[DB] Database initialized with V2 migrations');
  return dbInstance;
}

module.exports = { getDb, initDb: initDatabase };

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

function initDatabase() {
  const dbInstance = getDb();

  // -- users table --
  // Stores user profile with username as the primary identifier
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

    -- entries table --
    -- Compatible with both the "返乡" frontend schema and the original project schema
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

  console.log('[DB] Database initialized successfully');
  return dbInstance;
}

module.exports = { getDb, initDb: initDatabase };

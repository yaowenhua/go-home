/**
 * 返乡日记 V1 → V2 数据迁移脚本
 *
 * 使用方式：
 *   node db/migration.js              # 执行迁移
 *   node db/migration.js --dry-run    # 预览模式
 */

const { getDb } = require('./database')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const { nanoid } = require('nanoid')
const config = require('../config/auth')

/**
 * 安全执行 ALTER TABLE ADD COLUMN（忽略重复列错误）
 */
function safeAddColumn(db, sql) {
  try {
    db.exec(sql)
    return true
  } catch (e) {
    if (e.message && e.message.includes('duplicate column name')) {
      return false
    }
    throw e
  }
}

/**
 * 执行 V1 → V2 数据库迁移
 */
function runMigration() {
  console.log('=== 返乡日记 V1 → V2 数据迁移 ===')

  const db = getDb()
  const isDryRun = process.argv.includes('--dry-run')

  const v1Users = db.prepare('SELECT COUNT(*) as count FROM users').get().count
  const v1Entries = db.prepare('SELECT COUNT(*) as count FROM entries').get().count
  console.log(`  当前数据: ${v1Users} 用户, ${v1Entries} 条目`)

  if (isDryRun) {
    console.log('[DRY-RUN] 模式 - 仅预览')
    console.log('  - users 表: 新增 phone, password_hash, content_salt, display_name, role, status, last_login_at')
    console.log('  - entries 表: 新增 content_encrypted')
    console.log('  - 新建: refresh_tokens, activity_log, sms_codes 表')
    console.log('  - 创建索引')
    console.log('  - 创建管理员账号（如不存在）')
    return { isDryRun: true }
  }

  try {
    db.transaction(() => {
      // users 表扩展
      safeAddColumn(db, 'ALTER TABLE users ADD COLUMN phone TEXT')
      safeAddColumn(db, 'ALTER TABLE users ADD COLUMN password_hash TEXT')
      safeAddColumn(db, 'ALTER TABLE users ADD COLUMN content_salt TEXT')
      safeAddColumn(db, 'ALTER TABLE users ADD COLUMN display_name TEXT')
      safeAddColumn(db, "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'")
      safeAddColumn(db, "ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'")
      safeAddColumn(db, 'ALTER TABLE users ADD COLUMN last_login_at TEXT')

      // entries 表扩展
      safeAddColumn(db, 'ALTER TABLE entries ADD COLUMN content_encrypted TEXT')

      // 新建表
      db.exec(`
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
      `)

      // 索引
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
        CREATE INDEX IF NOT EXISTS idx_entries_user_id_v2 ON entries(user_id);
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
        CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
        CREATE INDEX IF NOT EXISTS idx_activity_log_event_type ON activity_log(event_type);
        CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);
        CREATE INDEX IF NOT EXISTS idx_activity_log_date ON activity_log(date(created_at));
        CREATE INDEX IF NOT EXISTS idx_sms_codes_phone ON sms_codes(phone);
      `)
    })()

    console.log('[Migration] Schema migration completed')

    // 管理员账号初始化
    const adminPhone = process.env.ADMIN_PHONE || '13800000000'
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123'
    const existingAdmin = db.prepare('SELECT id FROM users WHERE phone = ? AND role = ?')
      .get(adminPhone, 'admin')

    if (!existingAdmin) {
      const adminId = nanoid()
      const passwordHash = bcrypt.hashSync(adminPassword, config.bcrypt.saltRounds)
      const contentSalt = crypto.randomBytes(16).toString('hex')
      const now = new Date().toISOString()

      db.prepare(`
        INSERT INTO users (id, username, phone, password_hash, content_salt, display_name, role, status, birth_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'admin', 'active', '2000-01-01', ?, ?)
      `).run(adminId, '管理员', adminPhone, passwordHash, contentSalt, '系统管理员', now, now)

      console.log(`[Migration] Admin user created: ${adminPhone}`)
    } else {
      console.log('[Migration] Admin user already exists')
    }

    // 清理过期 refresh tokens
    const deleted = db.prepare(
      "DELETE FROM refresh_tokens WHERE expires_at < datetime('now')"
    ).run()
    if (deleted.changes > 0) {
      console.log(`[Migration] Cleaned ${deleted.changes} expired refresh tokens`)
    }

    console.log('=== 迁移完成 ===')
  } catch (err) {
    console.error('[Migration] FATAL:', err.message)
    throw err
  }
}

if (require.main === module) {
  runMigration()
}

module.exports = { runMigration }

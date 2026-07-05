/**
 * 返乡日记 V2 - 管理员账号初始化脚本
 *
 * 使用方式：
 *   node scripts/seedAdmin.js              # 默认管理员账号
 *   ADMIN_PHONE=13900000001 ADMIN_PASSWORD=Secret123 node scripts/seedAdmin.js
 *
 * 默认管理员账号（通过环境变量配置）：
 *   ADMIN_PHONE=13800000000
 *   ADMIN_PASSWORD=Admin123
 */

const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const { nanoid } = require('nanoid')
const { getDb } = require('../db/database')
const config = require('../config/auth')

/**
 * 创建或确保管理员账号存在
 * @returns {{ created: boolean, phone: string }}
 */
function seedAdmin() {
  const db = getDb()

  const adminPhone = process.env.ADMIN_PHONE || '13800000000'
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123'

  // 检查是否已存在管理员
  const existingAdmin = db.prepare(
    'SELECT id FROM users WHERE phone = ? AND role = ?'
  ).get(adminPhone, 'admin')

  if (existingAdmin) {
    console.log(`[Seed] Admin user already exists (${adminPhone}), skipping...`)
    return { created: false, phone: adminPhone }
  }

  // 检查是否有其他管理员存在
  const anyAdmin = db.prepare(
    "SELECT id, phone FROM users WHERE role = 'admin' LIMIT 1"
  ).get()

  if (anyAdmin) {
    console.log(`[Seed] Another admin exists (${anyAdmin.phone}), skipping creation...`)
    return { created: false, phone: anyAdmin.phone }
  }

  // 创建管理员
  const adminId = nanoid()
  const passwordHash = bcrypt.hashSync(adminPassword, config.bcrypt.saltRounds)
  const contentSalt = crypto.randomBytes(16).toString('hex')
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO users (id, username, phone, password_hash, content_salt, display_name, role, status, birth_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'admin', 'active', '1980-01-01', ?, ?)
  `).run(
    adminId,
    '管理员',
    adminPhone,
    passwordHash,
    contentSalt,
    '系统管理员',
    now,
    now
  )

  console.log(`[Seed] Admin user created: ${adminPhone}`)
  console.log(`[Seed] Admin password: ${adminPassword}`)
  console.log('[Seed] CHANGE THE DEFAULT PASSWORD IN PRODUCTION!')

  return { created: true, phone: adminPhone }
}

// 如果直接运行本文件
if (require.main === module) {
  // 确保数据库已初始化
  const { initDb } = require('../db/database')
  initDb()
  seedAdmin()
}

module.exports = { seedAdmin }

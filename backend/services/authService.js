/**
 * 返乡日记 V2 - JWT 签发与验证服务
 * 支持 Access Token + Refresh Token 双令牌机制
 */

const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const config = require('../config/auth')
const { getDb } = require('../db/database')

/**
 * 生成 Access Token + Refresh Token 对
 * @param {object} user - 用户对象 { id, phone, role }
 * @param {string} [deviceInfo] - 设备信息（可选）
 * @returns {{ accessToken: string, refreshToken: string, expiresIn: number }}
 */
function generateTokens(user, deviceInfo) {
  // --- Access Token ---
  const accessPayload = {
    userId: user.id,
    phone: user.phone,
    role: user.role || 'user',
  }

  const accessToken = jwt.sign(
    accessPayload,
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn }
  )

  // --- Refresh Token ---
  const jti = crypto.randomUUID()
  const refreshPayload = {
    userId: user.id,
    jti,
  }

  const refreshToken = jwt.sign(
    refreshPayload,
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  )

  // 计算过期时间（秒）
  const expiresIn = 24 * 60 * 60 // 24 hours

  // 存储 Refresh Token 到数据库
  storeRefreshToken(user.id, refreshToken, jti, deviceInfo)

  return { accessToken, refreshToken, expiresIn }
}

/**
 * 将 Refresh Token 哈希存入数据库
 * @param {string} userId
 * @param {string} refreshToken
 * @param {string} jti - JWT ID
 * @param {string} [deviceInfo]
 */
function storeRefreshToken(userId, refreshToken, jti, deviceInfo) {
  const db = getDb()
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')

  // 解析 Refresh Token 的过期时间
  const decoded = jwt.decode(refreshToken)
  const expiresAt = new Date(decoded.exp * 1000).toISOString()

  db.prepare(`
    INSERT INTO refresh_tokens (user_id, token_hash, device_info, ip_address, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, tokenHash, deviceInfo || null, null, expiresAt)
}

/**
 * 验证 Access Token
 * @param {string} token
 * @returns {{ userId: string, phone: string, role: string }}
 */
function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret)
}

/**
 * 验证 Refresh Token
 * @param {string} token
 * @returns {{ userId: string, jti: string }}
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwt.refreshSecret)
}

/**
 * 轮换 Refresh Token（同时废弃旧 Token）
 * @param {string} oldRefreshToken
 * @param {string} [deviceInfo]
 * @returns {{ accessToken: string, refreshToken: string }|null}
 */
function rotateRefreshToken(oldRefreshToken, deviceInfo) {
  const db = getDb()

  // 验证旧 Refresh Token 签名
  let decoded
  try {
    decoded = jwt.verify(oldRefreshToken, config.jwt.refreshSecret)
  } catch {
    return null
  }

  // 计算旧 Token 哈希，查询数据库
  const oldHash = crypto.createHash('sha256').update(oldRefreshToken).digest('hex')
  const storedToken = db.prepare(
    'SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked = 0'
  ).get(oldHash)

  if (!storedToken) {
    return null // Token 不存在或已被撤销
  }

  // 在事务中完成轮换
  const rotate = db.transaction(() => {
    // 1. 标记旧 Token 为已撤销
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?').run(storedToken.id)

    // 2. 查询用户信息
    const user = db.prepare('SELECT id, phone, role FROM users WHERE id = ?').get(decoded.userId)
    if (!user) {
      throw new Error('User not found')
    }

    // 3. 生成新 Token 对
    const newTokens = generateTokens(user, deviceInfo)
    return newTokens
  })

  try {
    return rotate()
  } catch {
    return null
  }
}

/**
 * 吊销用户的所有 Refresh Token（修改密码/登出时调用）
 * @param {string} userId
 */
function revokeAllUserTokens(userId) {
  const db = getDb()
  db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ? AND revoked = 0')
    .run(userId)
}

/**
 * 清理过期的 Refresh Token
 * @returns {number} 清理的数量
 */
function cleanupExpiredTokens() {
  const db = getDb()
  const result = db.prepare(
    "DELETE FROM refresh_tokens WHERE expires_at < datetime('now')"
  ).run()
  return result.changes
}

module.exports = {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  rotateRefreshToken,
  revokeAllUserTokens,
  cleanupExpiredTokens,
}

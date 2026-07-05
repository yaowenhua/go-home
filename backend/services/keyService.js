/**
 * 返乡日记 V2 - 密钥派生与缓存服务
 * PBKDF2-HMAC-SHA256 从用户密码派生 AES-256 加密密钥
 */

const crypto = require('crypto')
const config = require('../config/auth')

const { iterations, keyLength, cacheTTL } = config.keyDerivation

/**
 * 内存密钥缓存（单进程部署适用）
 * Map<userId, { key: Buffer, expiresAt: number }>
 * 多实例部署应改用 Redis
 */
const keyCache = new Map()

/**
 * 从用户密码派生出 AES-256-GCM 加密密钥
 * @param {string} password - 用户明文密码
 * @param {string} contentSalt - 用户自有的加密盐值 (hex)
 * @returns {Buffer} 32 bytes 的加密密钥
 */
function deriveKey(password, contentSalt) {
  if (!password || !contentSalt) {
    throw new Error('Password and contentSalt are required for key derivation')
  }

  return crypto.pbkdf2Sync(
    password,
    contentSalt,
    iterations,
    keyLength,
    'sha256'
  )
}

/**
 * 获取加密密钥（带4小时内存缓存）
 * @param {string} userId - 用户 ID
 * @param {string} password - 用户明文密码
 * @param {string} contentSalt - 用户加密盐值 (hex)
 * @returns {Buffer} 32 bytes 加密密钥
 */
function getEncryptionKey(userId, password, contentSalt) {
  // 检查缓存
  if (keyCache.has(userId)) {
    const cached = keyCache.get(userId)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.key
    }
    // 缓存过期，删除
    keyCache.delete(userId)
  }

  // 派生新密钥
  const key = deriveKey(password, contentSalt)

  // 缓存（4小时过期）
  keyCache.set(userId, {
    key,
    expiresAt: Date.now() + cacheTTL,
  })

  return key
}

/**
 * 从缓存中直接获取密钥（无需密码，用于已有缓存的场景）
 * @param {string} userId
 * @returns {Buffer|null}
 */
function getCachedKey(userId) {
  if (!keyCache.has(userId)) return null
  const cached = keyCache.get(userId)
  if (cached.expiresAt > Date.now()) {
    return cached.key
  }
  keyCache.delete(userId)
  return null
}

/**
 * 缓存加密密钥到内存
 * @param {string} userId
 * @param {Buffer} key - 32 bytes 加密密钥
 */
function cacheKey(userId, key) {
  keyCache.set(userId, {
    key,
    expiresAt: Date.now() + cacheTTL,
  })
}

/**
 * 清除指定用户的加密密钥缓存
 * @param {string} userId
 */
function clearKeyCache(userId) {
  keyCache.delete(userId)
}

/**
 * 清除所有密钥缓存（服务器重启/登出所有用户时调用）
 */
function clearAllCache() {
  keyCache.clear()
}

/**
 * 生成随机加密盐值
 * @returns {string} 32字符 hex 字符串（16 bytes）
 */
function generateSalt() {
  return crypto.randomBytes(16).toString('hex')
}

/**
 * 生成安全的随机临时密码
 * @param {number} length - 密码长度
 * @returns {string}
 */
function generateTempPassword(length = 16) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&'
  let password = ''
  const bytes = crypto.randomBytes(length)
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length]
  }
  return password
}

// 清理过期缓存的定时任务（每10分钟运行一次）
setInterval(() => {
  const now = Date.now()
  for (const [userId, cached] of keyCache.entries()) {
    if (cached.expiresAt <= now) {
      keyCache.delete(userId)
    }
  }
}, 10 * 60 * 1000)

module.exports = {
  deriveKey,
  getEncryptionKey,
  getCachedKey,
  cacheKey,
  clearKeyCache,
  clearAllCache,
  generateSalt,
  generateTempPassword,
}

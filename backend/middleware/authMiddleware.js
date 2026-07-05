/**
 * 返乡日记 V2 - JWT 认证中间件
 * 
 * - 从 Authorization header 提取 Bearer token
 * - 验证 token 有效性
 * - 将解密后的 payload 注入 req.user
 * - 可选：注入加密密钥到 req.encryptionKey
 */

const authService = require('../services/authService')
const keyService = require('../services/keyService')
const { getDb } = require('../db/database')
const { createError } = require('./errorHandler')

/**
 * JWT 认证中间件
 * 必需认证 — 无有效 Token 则返回 401
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader) {
    return next(createError(401, '未登录，请先登录'))
  }

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return next(createError(401, 'Token 格式错误'))
  }

  const token = parts[1]

  try {
    const decoded = authService.verifyAccessToken(token)
    req.user = {
      userId: decoded.userId,
      phone: decoded.phone,
      role: decoded.role,
    }

    // 尝试从缓存中获取加密密钥（登录时已缓存）
    const cachedKey = keyService.getCachedKey(decoded.userId)
    if (cachedKey) {
      req.encryptionKey = cachedKey
    }

    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(createError(401, 'Token 已过期'))
    }
    return next(createError(401, '无效的 Token'))
  }
}

/**
 * 可选认证中间件
 * 有有效 Token 则解析注入，无 Token 也不拒绝
 * 用于过渡期兼容 V1 接口
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader) {
    req.user = null
    return next()
  }

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    req.user = null
    return next()
  }

  try {
    const decoded = authService.verifyAccessToken(parts[1])
    req.user = {
      userId: decoded.userId,
      phone: decoded.phone,
      role: decoded.role,
    }

    const cachedKey = keyService.getCachedKey(decoded.userId)
    if (cachedKey) {
      req.encryptionKey = cachedKey
    }
  } catch {
    req.user = null
  }

  next()
}

/**
 * 派生并注入加密密钥到 req.encryptionKey
 * 要求 req.user 已存在（在 authenticate 之后使用）
 * 此中间件从请求体中获取密码（仅用于首次派生）
 */
function injectEncryptionKeyFromBody(req, res, next) {
  if (!req.user) {
    return next(createError(401, '未登录'))
  }

  const { password } = req.body
  if (!password) {
    return next(createError(400, '密码参数缺失'))
  }

  // 检查缓存
  const cachedKey = keyService.getCachedKey(req.user.userId)
  if (cachedKey) {
    req.encryptionKey = cachedKey
    return next()
  }

  // 从数据库获取用户的 content_salt
  const db = getDb()
  const user = db.prepare('SELECT content_salt FROM users WHERE id = ?').get(req.user.userId)
  if (!user || !user.content_salt) {
    return next(createError(500, '用户加密配置缺失'))
  }

  // 派生加密密钥并缓存
  const encryptionKey = keyService.getEncryptionKey(req.user.userId, password, user.content_salt)
  req.encryptionKey = encryptionKey
  next()
}

module.exports = { authenticate, optionalAuth, injectEncryptionKeyFromBody }

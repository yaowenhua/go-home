/**
 * 返乡日记 V2 - 管理员权限中间件
 * 必须在 authenticate 之后使用
 */

const { createError } = require('./errorHandler')

/**
 * 管理员权限验证中间件
 * 检查 req.user.role === 'admin'
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return next(createError(401, '未登录'))
  }

  if (req.user.role !== 'admin') {
    return next(createError(403, '权限不足，需要管理员权限'))
  }

  next()
}

module.exports = { requireAdmin }

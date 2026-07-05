/**
 * 返乡日记 V2 - 管理员控制器
 * listUsers / getUser / resetPassword / toggleUserStatus / getStatsOverview
 */

const bcrypt = require('bcryptjs')
const { getDb } = require('../db/database')
const authService = require('../services/authService')
const keyService = require('../services/keyService')
const config = require('../config/auth')
const { createError } = require('../middleware/errorHandler')

/**
 * GET /api/admin/users - 用户列表（分页+搜索）
 * Query: { page, pageSize, search, status, sortBy, sortDir }
 */
async function listUsers(req, res, next) {
  try {
    const db = getDb()
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20))
    const search = req.query.search || ''
    const status = req.query.status || ''
    const sortBy = ['created_at', 'last_login_at', 'username', 'phone'].includes(req.query.sortBy)
      ? req.query.sortBy
      : 'created_at'
    const sortDir = req.query.sortDir === 'asc' ? 'ASC' : 'DESC'
    const offset = (page - 1) * pageSize

    // 构建查询条件
    const conditions = []
    const params = []

    if (search) {
      conditions.push('(u.phone LIKE ? OR u.username LIKE ? OR u.display_name LIKE ?)')
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern)
    }

    if (status && ['active', 'disabled'].includes(status)) {
      conditions.push('u.status = ?')
      params.push(status)
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    // 查询总数
    const countResult = db.prepare(`SELECT COUNT(*) as total FROM users u ${whereClause}`).get(...params)
    const total = countResult.total

    // 查询用户列表 + 日记数量
    const users = db.prepare(`
      SELECT
        u.id,
        u.username,
        u.phone,
        u.display_name,
        u.role,
        u.status,
        u.birth_date,
        u.last_login_at,
        u.created_at,
        COUNT(e.id) as entry_count
      FROM users u
      LEFT JOIN entries e ON e.user_id = u.id
      ${whereClause}
      GROUP BY u.id
      ORDER BY u.${sortBy} ${sortDir}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset)

    // 手机号脱敏
    const sanitizedUsers = users.map((u) => ({
      id: u.id,
      username: u.username,
      phone: u.phone ? u.phone.slice(0, 3) + '****' + u.phone.slice(-4) : null,
      display_name: u.display_name,
      role: u.role,
      status: u.status,
      birth_date: u.birth_date,
      entry_count: u.entry_count,
      last_login_at: u.last_login_at,
      created_at: u.created_at,
    }))

    res.json({
      success: true,
      data: sanitizedUsers,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/admin/users/:id - 用户详情
 */
async function getUser(req, res, next) {
  try {
    const db = getDb()
    const { id } = req.params

    const user = db.prepare(`
      SELECT
        u.id, u.username, u.phone, u.display_name, u.role, u.status,
        u.birth_date, u.life_expectancy, u.last_login_at, u.created_at, u.updated_at,
        COUNT(e.id) as entry_count
      FROM users u
      LEFT JOIN entries e ON e.user_id = u.id
      WHERE u.id = ?
      GROUP BY u.id
    `).get(id)

    if (!user) {
      return next(createError(404, '用户不存在'))
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        phone: user.phone ? user.phone.slice(0, 3) + '****' + user.phone.slice(-4) : null,
        display_name: user.display_name,
        role: user.role,
        status: user.status,
        birth_date: user.birth_date,
        life_expectancy: user.life_expectancy,
        entry_count: user.entry_count,
        last_login_at: user.last_login_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/admin/users/:id/reset-password - 重置用户密码
 * 注意：重置密码后，该用户的加密日记永久不可读！
 */
async function resetPassword(req, res, next) {
  try {
    const db = getDb()
    const { id } = req.params

    // 不能重置自己的密码（管理员应使用 change-password）
    if (id === req.user.userId) {
      return next(createError(400, '不能重置自己的密码，请使用修改密码功能'))
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
    if (!user) {
      return next(createError(404, '用户不存在'))
    }

    if (user.role === 'admin') {
      return next(createError(403, '不能重置其他管理员的密码'))
    }

    // 生成随机临时密码
    const tempPassword = keyService.generateTempPassword()
    const passwordHash = bcrypt.hashSync(tempPassword, config.bcrypt.saltRounds)
    const now = new Date().toISOString()

    // 【重要】重置密码 = 旧加密密钥永久丢失
    // 即使生成新 salt，用户也无法恢复旧数据
    // 这里我们保留 content_salt 不变（用户后续可以继续写新日记，但旧日记无法读取）
    // 或者我们可以重置 content_salt —— 两种方式都导致旧数据不可读
    // 设计上保留 content_salt 不变更清晰

    db.prepare(`
      UPDATE users SET password_hash = ?, updated_at = ?, last_login_at = NULL
      WHERE id = ?
    `).run(passwordHash, now, id)

    // 吊销该用户所有 Refresh Token
    authService.revokeAllUserTokens(id)

    // 清除密钥缓存
    keyService.clearKeyCache(id)

    console.log(`[Admin] Password reset for user ${id} (${user.phone}) by admin ${req.user.userId}`)

    res.json({
      success: true,
      data: {
        tempPassword,
        userId: id,
      },
      message: '密码已重置。请将此临时密码安全地告知用户。用户登录后之前的加密日记将无法读取。',
      warning: '由于加密密钥变更，该用户的所有加密日记已永久不可读取。请务必告知用户。',
    })
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/admin/users/:id/status - 启用/禁用用户
 * Body: { status: 'active' | 'disabled' }
 */
async function toggleUserStatus(req, res, next) {
  try {
    const db = getDb()
    const { id } = req.params
    const { status } = req.body

    if (!status || !['active', 'disabled'].includes(status)) {
      return next(createError(400, '状态值无效，请使用 active 或 disabled'))
    }

    // 不能操作自己
    if (id === req.user.userId) {
      return next(createError(400, '不能禁用/启用自己的账号'))
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
    if (!user) {
      return next(createError(404, '用户不存在'))
    }

    if (user.role === 'admin') {
      return next(createError(403, '不能修改其他管理员的状态'))
    }

    const now = new Date().toISOString()
    db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id)

    // 如果禁用，吊销所有 Token
    if (status === 'disabled') {
      authService.revokeAllUserTokens(id)
      keyService.clearKeyCache(id)
    }

    res.json({
      success: true,
      data: {
        id,
        status,
        updated_at: now,
      },
      message: status === 'disabled' ? '用户已禁用' : '用户已启用',
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/admin/stats - 统计总览
 */
async function getStatsOverview(req, res, next) {
  try {
    const db = getDb()

    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count
    const totalEntries = db.prepare('SELECT COUNT(*) as count FROM entries').get().count
    const entriesToday = db.prepare(
      "SELECT COUNT(*) as count FROM entries WHERE date(created_at) = date('now', 'localtime')"
    ).get().count
    const usersToday = db.prepare(
      "SELECT COUNT(DISTINCT user_id) as count FROM activity_log WHERE date(created_at) = date('now', 'localtime')"
    ).get().count

    // DAU: 过去24小时
    const dau = db.prepare(
      "SELECT COUNT(DISTINCT user_id) as count FROM activity_log WHERE created_at >= datetime('now', '-1 day')"
    ).get().count

    // WAU: 过去7天
    const wau = db.prepare(
      "SELECT COUNT(DISTINCT user_id) as count FROM activity_log WHERE created_at >= datetime('now', '-7 days')"
    ).get().count

    // MAU: 过去30天
    const mau = db.prepare(
      "SELECT COUNT(DISTINCT user_id) as count FROM activity_log WHERE created_at >= datetime('now', '-30 days')"
    ).get().count

    res.json({
      success: true,
      data: {
        totalUsers,
        totalEntries,
        dau,
        wau,
        mau,
        entriesToday,
        usersToday,
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/admin/stats/dau-trend - DAU 趋势数据
 * Query: { days } 默认30天
 */
async function getDauTrend(req, res, next) {
  try {
    const db = getDb()
    const days = Math.min(365, Math.max(1, parseInt(req.query.days) || 30))

    const trend = db.prepare(`
      SELECT
        date(created_at) as date,
        COUNT(DISTINCT user_id) as dau
      FROM activity_log
      WHERE created_at >= datetime('now', ? || ' days')
      GROUP BY date(created_at)
      ORDER BY date ASC
    `).all(`-${days - 1}`)

    // 填充没有数据的日期（DAU = 0）
    const result = []
    const dateMap = new Map(trend.map((r) => [r.date, r.dau]))

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      result.push({
        date: dateStr,
        dau: dateMap.get(dateStr) || 0,
      })
    }

    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listUsers,
  getUser,
  resetPassword,
  toggleUserStatus,
  getStatsOverview,
  getDauTrend,
}

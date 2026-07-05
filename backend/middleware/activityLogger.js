/**
 * 返乡日记 V2 - 活动日志中间件
 *
 * 记录用户操作到 activity_log 表
 * - 关键事件（login/register/create/update/delete/change_password）：同步实时记录
 * - 高频事件（page_view）：频控 + 异步批量，同一用户 5min 内不重复
 * - 日志记录失败不影响主流程
 */

const { getDb } = require('../db/database')

// 高频事件频控缓存（单进程内存）
const rateLimitCache = new Map()
const PAGE_VIEW_COOLDOWN = 5 * 60 * 1000 // 5分钟
const API_CALL_COOLDOWN = 60 * 1000       // 1分钟

// 批量日志缓冲
const batchBuffer = []
const BATCH_FLUSH_INTERVAL = 30 * 1000 // 每30秒刷新一次
let batchTimer = null

/**
 * 活动日志中间件工厂
 * @param {string} eventType - 事件类型
 * @param {object} [options]
 * @param {boolean} [options.rateLimited=false] - 是否启用频控
 * @param {boolean} [options.async=false] - 是否异步批量记录
 * @param {object} [options.metadata] - 附加元数据
 * @returns {function} Express 中间件
 *
 * 使用示例：
 *   router.use(logActivity('page_view', { rateLimited: true, async: true }))
 *   router.post('/login', logActivity('login'), authController.login)
 */
function logActivity(eventType, options = {}) {
  const { rateLimited = false, async = false, metadata: extraMetadata = {} } = options

  return (req, res, next) => {
    // 频控检查
    if (rateLimited) {
      const userId = req.user?.userId || 'anonymous'
      const rateKey = `${eventType}:${userId}:${req.originalUrl}`
      const lastLog = rateLimitCache.get(rateKey)
      const cooldown = eventType === 'page_view' ? PAGE_VIEW_COOLDOWN : API_CALL_COOLDOWN

      if (lastLog && (Date.now() - lastLog) < cooldown) {
        return next()
      }
      rateLimitCache.set(rateKey, Date.now())
    }

    // 在响应完成后记录日志
    const originalEnd = res.end
    res.end = function (...args) {
      const db = getDb()
      const userId = req.user?.userId || null
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || ''
      const userAgent = req.headers['user-agent'] || ''

      const metadata = JSON.stringify({
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        ...extraMetadata,
      })

      if (async) {
        // 异步批量
        batchBuffer.push({
          user_id: userId,
          event_type: eventType,
          ip_address: ipAddress,
          user_agent: userAgent,
          path: req.originalUrl,
          metadata,
          created_at: new Date().toISOString(),
        })

        if (!batchTimer) {
          batchTimer = setTimeout(flushBatchBuffer, BATCH_FLUSH_INTERVAL)
        }
      } else {
        // 同步实时记录
        try {
          db.prepare(`
            INSERT INTO activity_log (user_id, event_type, ip_address, user_agent, path, metadata)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(userId, eventType, ipAddress, userAgent, req.originalUrl, metadata)
        } catch (err) {
          console.error('[ActivityLog] record failed:', err.message)
        }
      }

      return originalEnd.apply(res, args)
    }

    next()
  }
}

/**
 * 批量刷新缓冲日志到数据库
 */
function flushBatchBuffer() {
  if (batchBuffer.length === 0) {
    batchTimer = null
    return
  }

  try {
    const db = getDb()
    const stmt = db.prepare(`
      INSERT INTO activity_log (user_id, event_type, ip_address, user_agent, path, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const tx = db.transaction((entries) => {
      for (const entry of entries) {
        stmt.run(
          entry.user_id,
          entry.event_type,
          entry.ip_address,
          entry.user_agent,
          entry.path,
          entry.metadata
        )
      }
    })

    const entries = batchBuffer.splice(0, batchBuffer.length)
    tx(entries)
  } catch (err) {
    console.error('[ActivityLog] batch flush failed:', err.message)
  }

  batchTimer = null
}

/**
 * 独立的同步记录函数（用于非中间件场景）
 * @param {string} eventType
 * @param {object} data - { userId?, ipAddress?, userAgent?, path?, metadata? }
 */
function syncRecordEvent(eventType, data) {
  try {
    const db = getDb()
    db.prepare(`
      INSERT INTO activity_log (user_id, event_type, ip_address, user_agent, path, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      data.userId || null,
      eventType,
      data.ipAddress || '',
      data.userAgent || '',
      data.path || '',
      JSON.stringify(data.metadata || {})
    )
  } catch (err) {
    console.error('[ActivityLog] syncRecordEvent failed:', err.message)
  }
}

module.exports = { logActivity, syncRecordEvent }

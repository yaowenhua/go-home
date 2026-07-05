/**
 * 返乡日记 V2 - 统计控制器
 * getDAU / getWAU / getMAU / getDauTrend / getSummary
 */

const { getDb } = require('../db/database')
const { createError } = require('../middleware/errorHandler')

/**
 * GET /api/stats/dau - 当日 DAU
 */
async function getDAU(req, res, next) {
  try {
    const db = getDb()

    const dau = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM activity_log
      WHERE date(created_at) = date('now', 'localtime')
    `).get().count

    // 当日记录明细（最近100条）
    const details = db.prepare(`
      SELECT event_type, COUNT(*) as count
      FROM activity_log
      WHERE date(created_at) = date('now', 'localtime')
      GROUP BY event_type
      ORDER BY count DESC
    `).all()

    res.json({
      success: true,
      data: {
        dau,
        date: new Date().toISOString().split('T')[0],
        breakdown: details,
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/stats/wau - 本周 WAU
 */
async function getWAU(req, res, next) {
  try {
    const db = getDb()

    const wau = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM activity_log
      WHERE created_at >= datetime('now', '-7 days')
    `).get().count

    // 过去7天每日数据
    const daily = db.prepare(`
      SELECT
        date(created_at) as date,
        COUNT(DISTINCT user_id) as count
      FROM activity_log
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY date(created_at)
      ORDER BY date ASC
    `).all()

    res.json({
      success: true,
      data: {
        wau,
        daily,
        period: '7d',
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/stats/mau - 本月 MAU
 */
async function getMAU(req, res, next) {
  try {
    const db = getDb()

    const mau = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM activity_log
      WHERE created_at >= datetime('now', '-30 days')
    `).get().count

    // 过去30天每周数据
    const weekly = db.prepare(`
      SELECT
        strftime('%Y-W%W', created_at) as week,
        COUNT(DISTINCT user_id) as count
      FROM activity_log
      WHERE created_at >= datetime('now', '-30 days')
      GROUP BY week
      ORDER BY week ASC
    `).all()

    res.json({
      success: true,
      data: {
        mau,
        weekly,
        period: '30d',
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/stats/dau-trend - 近30天 DAU 趋势
 * Query: { days } 默认30天
 */
async function getDauTrend(req, res, next) {
  try {
    const db = getDb()
    const days = Math.min(365, Math.max(1, parseInt(req.query.days) || 30))

    const rawData = db.prepare(`
      SELECT
        date(created_at) as date,
        COUNT(DISTINCT user_id) as dau
      FROM activity_log
      WHERE created_at >= datetime('now', ? || ' days')
      GROUP BY date(created_at)
      ORDER BY date ASC
    `).all(`-${days - 1}`)

    // 填充日期缺口
    const dateMap = new Map(rawData.map((r) => [r.date, r.dau]))
    const result = []

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

/**
 * GET /api/stats/summary - 统计总览
 */
async function getSummary(req, res, next) {
  try {
    const db = getDb()

    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count
    const totalEntries = db.prepare('SELECT COUNT(*) as count FROM entries').get().count

    const dau = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM activity_log
      WHERE date(created_at) = date('now', 'localtime')
    `).get().count

    const wau = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM activity_log
      WHERE created_at >= datetime('now', '-7 days')
    `).get().count

    const mau = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM activity_log
      WHERE created_at >= datetime('now', '-30 days')
    `).get().count

    const todayEntries = db.prepare(`
      SELECT COUNT(*) as count FROM entries
      WHERE date(created_at) = date('now', 'localtime')
    `).get().count

    res.json({
      success: true,
      data: {
        totalUsers,
        totalEntries,
        dau,
        wau,
        mau,
        todayEntries,
      },
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { getDAU, getWAU, getMAU, getDauTrend, getSummary }

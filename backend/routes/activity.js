/**
 * 返乡日记 V2 - 活动路由
 * /api/activity/*
 * 入站端点：前端路由切换上报 page_view（登录态才计）
 *
 * 设计（架构 §4 A2，方案① pathFromBody）：
 *   - authenticate：无 token → 401，匿名天然进不来（DD-A2.2）。
 *   - logActivity('page_view', { rateLimited: true, async: true, pathFromBody: true })：
 *       * 5min 频控（key = page_view:<userId>:<originalUrl>，同一用户 5min 只记一次）
 *       * 30s 异步批量，主流程零阻塞
 *       * pathFromBody=true：落库 path、metadata.frontendPath 取 req.body.path（前端路由 path）
 *   - 仅 middleware 落库，handler 不重复写，避免双写。
 */

const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/authMiddleware')
const { logActivity } = require('../middleware/activityLogger')

// 所有活动路由需要认证
router.use(authenticate)

// POST /api/activity/page-view
// Body: { "path": "/history" } （必填）
router.post(
  '/page-view',
  logActivity('page_view', { rateLimited: true, async: true, pathFromBody: true }),
  (req, res, next) => {
    if (!req.body || typeof req.body.path !== 'string' || req.body.path.trim() === '') {
      return res.status(400).json({ success: false, message: 'path is required' })
    }
    res.json({ success: true, data: { recorded: true } })
  }
)

module.exports = router

/**
 * 返乡日记 V2 - 统计分析路由
 * /api/stats/*
 * 所有路由需要 authenticate + requireAdmin
 */

const express = require('express')
const router = express.Router()
const statsController = require('../controllers/statsController')
const { authenticate } = require('../middleware/authMiddleware')
const { requireAdmin } = require('../middleware/adminMiddleware')

// 所有统计路由需要认证 + 管理员权限
router.use(authenticate, requireAdmin)

// GET /api/stats/dau - 当日 DAU
router.get('/dau', statsController.getDAU)

// GET /api/stats/wau - 本周 WAU
router.get('/wau', statsController.getWAU)

// GET /api/stats/mau - 本月 MAU
router.get('/mau', statsController.getMAU)

// GET /api/stats/dau-trend - DAU 趋势
router.get('/dau-trend', statsController.getDauTrend)

// GET /api/stats/summary - 统计总览
router.get('/summary', statsController.getSummary)

module.exports = router

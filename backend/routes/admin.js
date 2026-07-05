/**
 * 返乡日记 V2 - 管理后台路由
 * /api/admin/*
 * 所有路由需要 authenticate + requireAdmin
 */

const express = require('express')
const router = express.Router()
const adminController = require('../controllers/adminController')
const { authenticate } = require('../middleware/authMiddleware')
const { requireAdmin } = require('../middleware/adminMiddleware')

// 所有管理路由需要认证 + 管理员权限
router.use(authenticate, requireAdmin)

// GET /api/admin/users - 用户列表（分页+搜索）
router.get('/users', adminController.listUsers)

// GET /api/admin/users/:id - 用户详情
router.get('/users/:id', adminController.getUser)

// POST /api/admin/users/:id/reset-password - 重置用户密码
router.post('/users/:id/reset-password', adminController.resetPassword)

// PUT /api/admin/users/:id/status - 启用/禁用用户
router.put('/users/:id/status', adminController.toggleUserStatus)

// GET /api/admin/stats - 统计总览
router.get('/stats', adminController.getStatsOverview)

// GET /api/admin/stats/dau-trend - DAU 趋势
router.get('/stats/dau-trend', adminController.getDauTrend)

module.exports = router

/**
 * 返乡日记 V2 - 日记路由
 * /api/entries/*
 * 所有路由需要 JWT 认证（authenticate 中间件）
 */

const express = require('express')
const router = express.Router()
const entryController = require('../controllers/entryController')
const { authenticate } = require('../middleware/authMiddleware')
const { logActivity } = require('../middleware/activityLogger')

// 所有日记路由需要认证（用户隔离）
router.use(authenticate)

// 活动日志中间件（异步批量记录）
router.use(logActivity('api_call', { rateLimited: true, async: true }))

// Static routes MUST come before param routes

// GET /api/entries/by-date?date=YYYY-MM-DD
router.get('/by-date', entryController.getByDate)

// GET /api/entries - List all entries (current user only)
router.get('/', entryController.getAll)

// POST /api/entries - Create entry
router.post('/', logActivity('entry_create'), entryController.create)

// GET /api/entries/:id
router.get('/:id', entryController.getById)

// PUT /api/entries/:id
router.put('/:id', logActivity('entry_update'), entryController.update)

// DELETE /api/entries/:id
router.delete('/:id', logActivity('entry_delete'), entryController.remove)

module.exports = router

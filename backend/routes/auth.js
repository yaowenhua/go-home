/**
 * 返乡日记 V2 - 认证路由
 * /api/auth/*
 */

const express = require('express')
const router = express.Router()
const authController = require('../controllers/authController')
const { authenticate } = require('../middleware/authMiddleware')
const { logActivity } = require('../middleware/activityLogger')

// POST /api/auth/register - 注册
router.post('/register', logActivity('register'), authController.register)

// POST /api/auth/login - 登录
router.post('/login', logActivity('login'), authController.login)

// POST /api/auth/logout - 登出（需要认证）
router.post('/logout', authenticate, logActivity('logout'), authController.logout)

// POST /api/auth/refresh - 刷新 Token
router.post('/refresh', authController.refresh)

// POST /api/auth/change-password - 修改密码（需要认证）
router.post(
  '/change-password',
  authenticate,
  logActivity('password_change'),
  authController.changePassword
)

// POST /api/auth/send-code - 发送短信验证码
router.post('/send-code', authController.sendCode)

// POST /api/auth/reset-password - 重置密码
router.post('/reset-password', logActivity('password_reset'), authController.resetPassword)

module.exports = router

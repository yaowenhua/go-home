/**
 * 返乡日记 V2 - 用户路由
 * /api/users/*
 *
 * V2 新增：
 * - GET /api/users/me - 获取当前用户信息（需要认证）
 * - PUT /api/users/me - 更新当前用户信息（需要认证）
 *
 * V1 端点保留兼容
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/authMiddleware');

// ========== V2 端点（需要认证）==========
// 注意：/me 必须在静态路由之前注册
router.get('/me', authenticate, userController.getMyProfile);
router.put('/me', authenticate, userController.updateMyProfile);

// ========== V1 兼容端点 ==========

// IMPORTANT: Static routes must come before :param routes

// GET /api/users/top - Top users
router.get('/top', userController.getTopUsers);

// GET/PUT /api/users/profile - Frontend-friendly profile endpoints
router.get('/profile', userController.getOrCreateProfile);
router.put('/profile', userController.updateProfile);

// GET /api/users - List all users
router.get('/', userController.getAll);

// POST /api/users - Create user
router.post('/', userController.create);

// GET /api/users/:username - Get user by username (must be last)
router.get('/:username', userController.getByUsername);

module.exports = router;

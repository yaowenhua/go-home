const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

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

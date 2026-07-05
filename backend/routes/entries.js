const express = require('express')
const router = express.Router()
const entryController = require('../controllers/entryController')

// Static routes MUST come before param routes

// GET /api/entries/by-date?date=YYYY-MM-DD
router.get('/by-date', entryController.getByDate)

// GET /api/entries - List all entries
router.get('/', entryController.getAll)

// POST /api/entries - Create entry
router.post('/', entryController.create)

// GET /api/entries/:id
router.get('/:id', entryController.getById)

// PUT /api/entries/:id
router.put('/:id', entryController.update)

// DELETE /api/entries/:id
router.delete('/:id', entryController.remove)

module.exports = router

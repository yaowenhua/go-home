const express = require('express')
const cors = require('cors')
const { initDb } = require('./db/database')
const { errorHandler } = require('./middleware/errorHandler')

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Init DB on startup (includes V2 migrations)
initDb()

// --- V1 Routes (retained for backward compatibility) ---
const entriesRouter = require('./routes/entries')
const usersRouter = require('./routes/users')

// --- V2 Routes (new) ---
const authRoutes = require('./routes/auth')
const adminRoutes = require('./routes/admin')
const statsRoutes = require('./routes/stats')

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  })
})

// Auth routes (no auth required, except logout)
app.use('/api/auth', authRoutes)

// Entry routes (auth required via router-level middleware)
app.use('/api/entries', entriesRouter)

// User routes (V1 backwards compatible + V2 /me endpoints)
app.use('/api/users', usersRouter)

// Admin routes (auth + admin required via router-level middleware)
app.use('/api/admin', adminRoutes)

// Stats routes (auth + admin required via router-level middleware)
app.use('/api/stats', statsRoutes)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Not found' })
})

// Global error handler
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`返乡日记 v2 backend running on http://localhost:${PORT}`)
  console.log(`  Auth:     POST /api/auth/{register,login,logout,refresh,change-password}`)
  console.log(`  Entries:  GET/POST/PUT/DELETE /api/entries/*`)
  console.log(`  Users:    GET/PUT /api/users/me`)
  console.log(`  Admin:    GET/POST /api/admin/users/*`)
  console.log(`  Stats:    GET /api/stats/{dau,wau,mau,dau-trend,summary}`)
})

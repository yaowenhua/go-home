const express = require('express')
const cors = require('cors')
const { initDb } = require('./db/database')

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

// Init DB on startup
initDb()

// --- Routes ---
const entriesRouter = require('./routes/entries')
const usersRouter = require('./routes/users')

app.use('/api/entries', entriesRouter)
app.use('/api/users', usersRouter)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message)
  res.status(500).json({ success: false, message: err.message })
})

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})

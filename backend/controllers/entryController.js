const { getDb } = require('../db/database')

/**
 * Get all entries.
 */
async function getAll(req, res, next) {
  try {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM entries ORDER BY entry_date DESC, created_at DESC').all()
    res.json({ success: true, data: rows })
  } catch (err) {
    next(err)
  }
}

/**
 * Get entry by ID.
 */
async function getById(req, res, next) {
  try {
    const db = getDb()
    const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id)
    if (!row) return res.status(404).json({ success: false, message: 'Entry not found' })
    res.json({ success: true, data: row })
  } catch (err) {
    next(err)
  }
}

/**
 * Get entries by date.
 */
async function getByDate(req, res, next) {
  try {
    const db = getDb()
    const { date } = req.query
    if (!date) return res.status(400).json({ success: false, message: 'date query param is required' })
    const rows = db.prepare('SELECT * FROM entries WHERE entry_date = ? ORDER BY created_at DESC').all(date)
    res.json({ success: true, data: rows })
  } catch (err) {
    next(err)
  }
}

/**
 * Create a new entry.
 */
async function create(req, res, next) {
  try {
    const db = getDb()
    const { content, rating, category, entry_date, date, userId } = req.body
    if (!content) return res.status(400).json({ success: false, message: 'content is required' })

    const entryDate = entry_date || date || new Date().toISOString().split('T')[0]
    const maxId = db.prepare('SELECT MAX(CAST(id AS INTEGER)) as maxId FROM entries').get()
    const newId = (maxId?.maxId || 0) + 1

    const stmt = db.prepare(
      'INSERT INTO entries (id, user_id, content, rating, category, entry_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    stmt.run(
      String(newId),
      userId || 'davis',
      content,
      rating || 3,
      category || 'life',
      entryDate,
      new Date().toISOString()
    )

    const created = db.prepare('SELECT * FROM entries WHERE id = ?').get(String(newId))
    res.status(201).json({ success: true, data: created })
  } catch (err) {
    next(err)
  }
}

/**
 * Update an entry.
 */
async function update(req, res, next) {
  try {
    const db = getDb()
    const { id } = req.params
    const existing = db.prepare('SELECT * FROM entries WHERE id = ?').get(id)
    if (!existing) return res.status(404).json({ success: false, message: 'Entry not found' })

    const fields = ['content', 'rating', 'category', 'entry_date']
    const updates = []
    const values = []

    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`)
        values.push(req.body[f])
      }
    })

    if (updates.length === 0) {
      return res.json({ success: true, data: existing })
    }

    values.push(id)
    db.prepare(`UPDATE entries SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const updated = db.prepare('SELECT * FROM entries WHERE id = ?').get(id)
    res.json({ success: true, data: updated })
  } catch (err) {
    next(err)
  }
}

/**
 * Delete an entry.
 */
async function remove(req, res, next) {
  try {
    const db = getDb()
    const { id } = req.params
    const existing = db.prepare('SELECT * FROM entries WHERE id = ?').get(id)
    if (!existing) return res.status(404).json({ success: false, message: 'Entry not found' })

    db.prepare('DELETE FROM entries WHERE id = ?').run(id)
    res.json({ success: true, message: 'Entry deleted' })
  } catch (err) {
    next(err)
  }
}

module.exports = { getAll, getById, getByDate, create, update, remove }

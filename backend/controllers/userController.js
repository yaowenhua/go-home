const { getDb } = require('../db/database');
const { nanoid } = require('nanoid');

const userController = {
  /** POST /api/users - Create user */
  create(req, res, next) {
    try {
      const { username, name, birthDate, birth_date } = req.body;
      const displayName = name || username;
      const dob = birthDate || birth_date;

      if (!displayName) {
        return res.status(400).json({
          error: { message: 'username or name is required' },
        });
      }
      if (!dob) {
        return res.status(400).json({
          error: { message: 'birthDate is required' },
        });
      }

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dob)) {
        return res.status(400).json({
          error: { message: 'birthDate must be in YYYY-MM-DD format' },
        });
      }

      // Check duplicate username
      const existing = getDb().prepare('SELECT * FROM users WHERE username = ?').get(displayName);
      if (existing) {
        return res.status(409).json({
          error: { message: 'Username already exists' },
          data: normalizeUser(existing),
        });
      }

      const id = nanoid();
      const now = new Date().toISOString();

      getDb().prepare(
        'INSERT INTO users (id, username, birth_date, created_at) VALUES (?, ?, ?, ?)'
      ).run(id, displayName, dob, now);

      res.status(201).json({
        success: true,
        data: { id: displayName, username: displayName, birthDate: dob, createdAt: now },
      });
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/users - List all users */
  getAll(req, res, next) {
    try {
      const rows = getDb().prepare('SELECT * FROM users ORDER BY created_at DESC').all();
      res.json({ success: true, data: rows.map(normalizeUser) });
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/users/profile - Get or create user profile (frontend-friendly) */
  getOrCreateProfile(req, res, next) {
    try {
      const { userId, username } = req.query;

      if (userId) {
        // Search by username
        const user = getDb().prepare('SELECT * FROM users WHERE username = ?').get(userId);
        if (user) {
          return res.json({ success: true, data: normalizeUser(user) });
        }
        return res.status(404).json({
          error: { message: 'User not found' },
        });
      }

      // Return all users if no userId specified
      const rows = getDb().prepare('SELECT * FROM users ORDER BY created_at DESC').all();
      res.json({ success: true, data: rows.map(normalizeUser) });
    } catch (err) {
      next(err);
    }
  },

  /** PUT /api/users/profile - Update user profile */
  updateProfile(req, res, next) {
    try {
      const { userId, username, birth_date, birthDate, name } = req.body;
      const userIdentifier = userId || username || name;

      if (!userIdentifier) {
        return res.status(400).json({
          error: { message: 'userId or username is required' },
        });
      }

      const existing = getDb().prepare('SELECT * FROM users WHERE username = ?').get(userIdentifier);

      if (!existing) {
        // Create new user profile
        const id = nanoid();
        const dob = birth_date || birthDate || existing?.birth_date;
        const now = new Date().toISOString();

        getDb().prepare(
          'INSERT INTO users (id, username, birth_date, created_at) VALUES (?, ?, ?, ?)'
        ).run(id, userIdentifier, dob || null, now);

        const created = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
        return res.json({ success: true, data: normalizeUser(created) });
      }

      // Update existing
      const updates = {};
      if (birth_date !== undefined) updates.birth_date = birth_date;
      if (birthDate !== undefined) updates.birth_date = birthDate;

      if (Object.keys(updates).length > 0) {
        const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
        const values = Object.values(updates);
        getDb().prepare(`UPDATE users SET ${setClauses} WHERE username = ?`).run(...values, userIdentifier);
      }

      const updated = getDb().prepare('SELECT * FROM users WHERE username = ?').get(userIdentifier);
      res.json({ success: true, data: normalizeUser(updated) });
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/users/top - Top users by average rating */
  getTopUsers(req, res, next) {
    try {
      const rows = getDb()
        .prepare(
          `SELECT u.username, u.birth_date, COUNT(e.id) as entry_count,
                  ROUND(AVG(e.rating), 1) as avg_rating
           FROM users u
           JOIN entries e ON e.user_id = u.username
           GROUP BY u.username
           HAVING entry_count > 0
           ORDER BY avg_rating DESC
           LIMIT 10`
        )
        .all();

      res.json({
        success: true,
        data: rows.map((r) => ({
          username: r.username,
          birthDate: r.birth_date,
          entryCount: r.entry_count,
          avgRating: r.avg_rating,
        })),
      });
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/users/:username - Get single user */
  getByUsername(req, res, next) {
    try {
      const { username } = req.params;
      const user = getDb().prepare('SELECT * FROM users WHERE username = ?').get(username);

      if (!user) {
        return res.status(404).json({
          error: { message: 'User not found' },
        });
      }

      res.json({ success: true, data: normalizeUser(user) });
    } catch (err) {
      next(err);
    }
  },
};

function normalizeUser(row) {
  return {
    id: row.username,
    username: row.username,
    birthDate: row.birth_date,
    createdAt: row.created_at,
  };
}

module.exports = userController;

/**
 * 返乡日记 V2 - 用户控制器
 *
 * V2 新增:
 * - GET /api/users/me - 获取当前登录用户信息（需要认证）
 * - PUT /api/users/me - 更新当前用户信息（需要认证）
 * - 原有端点保留兼容，但增加 auth 检查
 */

const { getDb } = require('../db/database');
const { nanoid } = require('nanoid');
const { createError } = require('../middleware/errorHandler');

const userController = {
  /**
   * POST /api/users - Create user（保留 V1 兼容）
   */
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

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dob)) {
        return res.status(400).json({
          error: { message: 'birthDate must be in YYYY-MM-DD format' },
        });
      }

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

  /**
   * GET /api/users - List all users（保留 V1 兼容）
   */
  getAll(req, res, next) {
    try {
      const rows = getDb().prepare('SELECT * FROM users ORDER BY created_at DESC').all();
      res.json({ success: true, data: rows.map(normalizeUser) });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/users/profile - Get or create user profile（保留 V1 兼容）
   */
  getOrCreateProfile(req, res, next) {
    try {
      const { userId, username } = req.query;

      if (userId) {
        const user = getDb().prepare('SELECT * FROM users WHERE username = ?').get(userId);
        if (user) {
          return res.json({ success: true, data: normalizeUser(user) });
        }
        return res.status(404).json({
          error: { message: 'User not found' },
        });
      }

      const rows = getDb().prepare('SELECT * FROM users ORDER BY created_at DESC').all();
      res.json({ success: true, data: rows.map(normalizeUser) });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PUT /api/users/profile - Update user profile（保留 V1 兼容）
   */
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
        const id = nanoid();
        const dob = birth_date || birthDate;
        const now = new Date().toISOString();

        getDb().prepare(
          'INSERT INTO users (id, username, birth_date, created_at) VALUES (?, ?, ?, ?)'
        ).run(id, userIdentifier, dob || null, now);

        const created = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
        return res.json({ success: true, data: normalizeUser(created) });
      }

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

  /**
   * GET /api/users/top - Top users by average rating（保留 V1 兼容）
   */
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

  /**
   * GET /api/users/:username - Get user by username（保留 V1 兼容）
   */
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

  // ========== V2 新增端点 ==========

  /**
   * GET /api/users/me - 获取当前登录用户信息（需要认证）
   */
  getMyProfile(req, res, next) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(createError(401, '未登录'));
      }

      const user = getDb().prepare(
        'SELECT id, username, phone, display_name, role, status, birth_date, life_expectancy, last_login_at, created_at FROM users WHERE id = ?'
      ).get(userId);

      if (!user) {
        return next(createError(404, '用户不存在'));
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          username: user.username,
          phone: user.phone,
          display_name: user.display_name,
          role: user.role,
          status: user.status,
          birth_date: user.birth_date,
          life_expectancy: user.life_expectancy,
          last_login_at: user.last_login_at,
          created_at: user.created_at,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PUT /api/users/me - 更新当前用户信息（需要认证）
   * Body: { display_name?, birth_date?, life_expectancy? }
   */
  updateMyProfile(req, res, next) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(createError(401, '未登录'));
      }

      const { display_name, birth_date, life_expectancy } = req.body;
      const updates = [];
      const values = [];

      if (display_name !== undefined) {
        updates.push('display_name = ?');
        values.push(display_name);
      }
      if (birth_date !== undefined) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(birth_date)) {
          return next(createError(400, 'birth_date 格式必须为 YYYY-MM-DD'));
        }
        updates.push('birth_date = ?');
        values.push(birth_date);
      }
      if (life_expectancy !== undefined) {
        const le = parseInt(life_expectancy);
        if (isNaN(le) || le < 50 || le > 150) {
          return next(createError(400, 'life_expectancy 必须在 50-150 之间'));
        }
        updates.push('life_expectancy = ?');
        values.push(le);
      }

      if (updates.length === 0) {
        return next(createError(400, '没有需要更新的字段'));
      }

      updates.push("updated_at = datetime('now', 'localtime')");
      values.push(userId);

      getDb().prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

      // 返回更新后的信息
      const user = getDb().prepare(
        'SELECT id, username, phone, display_name, role, status, birth_date, life_expectancy, last_login_at, created_at, updated_at FROM users WHERE id = ?'
      ).get(userId);

      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  },
};

/**
 * 标准化用户输出（V1 格式兼容）
 */
function normalizeUser(row) {
  return {
    id: row.username,
    username: row.username,
    birthDate: row.birth_date,
    createdAt: row.created_at,
  };
}

module.exports = userController;

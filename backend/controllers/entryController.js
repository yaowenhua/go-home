/**
 * 返乡日记 V2 - 日记控制器
 *
 * V2 变更：
 * - 所有查询追加 WHERE user_id = ?（用户隔离）
 * - 写入时使用 content_encrypted 加密存储
 * - 读取时自动解密 content_encrypted
 * - 创建/修改时自动设置 user_id 为当前登录用户
 * - 修复: getByDate 查询改用兼容格式
 */

const { getDb } = require('../db/database')
const cryptoService = require('../services/cryptoService')
const { syncRecordEvent } = require('../middleware/activityLogger')
const { createError } = require('../middleware/errorHandler')

/**
 * 获取所有当前用户的日记条目
 */
async function getAll(req, res, next) {
  try {
    const db = getDb()
    const userId = req.user?.userId

    if (!userId) {
      return next(createError(401, '未登录'))
    }

    const rows = db.prepare(
      'SELECT * FROM entries WHERE user_id = ? ORDER BY entry_date DESC, created_at DESC'
    ).all(userId)

    // 解密内容
    const decryptedRows = decryptEntries(rows, req.encryptionKey)

    res.json({ success: true, data: decryptedRows })
  } catch (err) {
    next(err)
  }
}

/**
 * 通过 ID 获取单条日记
 */
async function getById(req, res, next) {
  try {
    const db = getDb()
    const userId = req.user?.userId

    if (!userId) {
      return next(createError(401, '未登录'))
    }

    const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id)
    if (!row) {
      return res.status(404).json({ success: false, message: 'Entry not found' })
    }

    // 越权检查
    if (row.user_id !== userId) {
      return next(createError(403, '无权访问该日记'))
    }

    // 解密
    const decrypted = decryptEntry(row, req.encryptionKey)

    res.json({ success: true, data: decrypted })
  } catch (err) {
    next(err)
  }
}

/**
 * 按日期查询当前用户的日记
 * GET /api/entries/by-date?date=YYYY-MM-DD
 */
async function getByDate(req, res, next) {
  try {
    const db = getDb()
    const userId = req.user?.userId

    if (!userId) {
      return next(createError(401, '未登录'))
    }

    const { date } = req.query
    if (!date) {
      return res.status(400).json({ success: false, message: 'date query param is required' })
    }

    // 兼容两种日期字段：entry_date 和 date
    const rows = db.prepare(
      'SELECT * FROM entries WHERE (entry_date = ? OR date = ?) AND user_id = ? ORDER BY created_at DESC'
    ).all(date, date, userId)

    const decryptedRows = decryptEntries(rows, req.encryptionKey)

    res.json({ success: true, data: decryptedRows })
  } catch (err) {
    next(err)
  }
}

/**
 * 创建新日记
 */
async function create(req, res, next) {
  try {
    const db = getDb()
    const userId = req.user?.userId

    if (!userId) {
      return next(createError(401, '未登录'))
    }

    const { content, rating, category, entry_date, date } = req.body
    if (!content) {
      return res.status(400).json({ success: false, message: 'content is required' })
    }

    const entryDate = entry_date || date || new Date().toISOString().split('T')[0]
    const maxId = db.prepare('SELECT MAX(CAST(id AS INTEGER)) as maxId FROM entries').get()
    const newId = (maxId?.maxId || 0) + 1

    // 加密内容（如果提供了加密密钥）
    let contentEncrypted = null
    if (req.encryptionKey) {
      contentEncrypted = cryptoService.encrypt(content, req.encryptionKey)
    }

    // content 列在 V1 schema 为 NOT NULL 且不可 DROP（产品禁令），故写入空串 '' 占位而非明文；
    // 真实内容只进 content_encrypted（DD-A1.2）。空串非明文，DD-A1.1 判定（TRIM != ''）不受影响。
    const stmt = db.prepare(
      'INSERT INTO entries (id, user_id, content, content_encrypted, rating, category, entry_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    stmt.run(
      String(newId),
      userId,
      '',
      contentEncrypted,
      rating || 3,
      category || 'life',
      entryDate,
      new Date().toISOString()
    )

    const created = db.prepare('SELECT * FROM entries WHERE id = ?').get(String(newId))

    // 解密返回
    const result = decryptEntry(created, req.encryptionKey)

    res.status(201).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

/**
 * 更新日记
 */
async function update(req, res, next) {
  try {
    const db = getDb()
    const userId = req.user?.userId
    const { id } = req.params

    if (!userId) {
      return next(createError(401, '未登录'))
    }

    const existing = db.prepare('SELECT * FROM entries WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Entry not found' })
    }

    // 越权检查
    if (existing.user_id !== userId) {
      return next(createError(403, '无权修改该日记'))
    }

    // 只更新非明文字段；content 变更仅通过 content_encrypted 加密分支处理（见下）
    const fields = ['rating', 'category', 'entry_date']
    const updates = []
    const values = []

    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`)
        values.push(req.body[f])
      }
    })

    // 如果更新了 content，同时更新加密字段
    if (req.body.content !== undefined && req.encryptionKey) {
      const newEncrypted = cryptoService.encrypt(req.body.content, req.encryptionKey)
      updates.push('content_encrypted = ?')
      values.push(newEncrypted)
    }

    if (updates.length === 0) {
      const unchanged = decryptEntry(existing, req.encryptionKey)
      return res.json({ success: true, data: unchanged })
    }

    values.push(id)
    db.prepare(`UPDATE entries SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const updated = db.prepare('SELECT * FROM entries WHERE id = ?').get(id)
    const result = decryptEntry(updated, req.encryptionKey)

    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

/**
 * 删除日记
 */
async function remove(req, res, next) {
  try {
    const db = getDb()
    const userId = req.user?.userId
    const { id } = req.params

    if (!userId) {
      return next(createError(401, '未登录'))
    }

    const existing = db.prepare('SELECT * FROM entries WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Entry not found' })
    }

    // 越权检查
    if (existing.user_id !== userId) {
      return next(createError(403, '无权删除该日记'))
    }

    db.prepare('DELETE FROM entries WHERE id = ?').run(id)

    res.json({ success: true, message: 'Entry deleted' })
  } catch (err) {
    next(err)
  }
}

// ===== Helper Functions =====

/**
 * 解密单条日记
 *
 * V2：不再回退 DB 明文。
 * - content_encrypted 为空行 → content = null（前端需承载）
 * - content_encrypted 解密失败 → content = '（无法解密）' 占位 + decryptFailed: true，
 *   绝不返回 DB 明文（明文已从 DB 退出，DD-A1.2/1.3）。
 */
function decryptEntry(row, encryptionKey) {
  if (!row) return null

  const result = { ...row }

  // 有加密内容且提供了解密密钥时解密；否则置空/占位
  if (result.content_encrypted && encryptionKey) {
    try {
      result.content = cryptoService.decrypt(result.content_encrypted, encryptionKey)
    } catch (e) {
      console.warn(`[Entry] Failed to decrypt entry ${result.id}: ${e.message}`)
      result.content = '（无法解密）'
      result.decryptFailed = true
    }
  } else {
    // 无密文或无密钥：不伪造明文，置空（前端 EntryCard 显示占位/空态）
    result.content = null
  }

  // 不向客户端暴露加密字段
  delete result.content_encrypted

  return result
}

/**
 * 批量解密日记列表
 */
function decryptEntries(rows, encryptionKey) {
  if (!rows || !Array.isArray(rows)) return []
  return rows.map((row) => decryptEntry(row, encryptionKey))
}

module.exports = { getAll, getById, getByDate, create, update, remove }

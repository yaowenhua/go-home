/**
 * 返乡日记 V2 - 认证控制器
 * register / login / logout / refresh / changePassword / sendCode / resetPassword
 */

const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const { nanoid } = require('nanoid')
const { getDb } = require('../db/database')
const authService = require('../services/authService')
const keyService = require('../services/keyService')
const cryptoService = require('../services/cryptoService')
const config = require('../config/auth')
const { createError } = require('../middleware/errorHandler')
const { syncRecordEvent } = require('../middleware/activityLogger')

/**
 * POST /api/auth/register - 用户注册
 * Body: { phone, password }
 */
async function register(req, res, next) {
  try {
    const db = getDb()
    const { phone, password, display_name, birth_date, life_expectancy } = req.body

    // 校验手机号
    if (!phone || !/^\d{11}$/.test(phone)) {
      return next(createError(400, '请输入有效的11位手机号'))
    }

    // 校验密码强度
    if (!password || password.length < 6) {
      return next(createError(400, '密码长度至少6位'))
    }
    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
      return next(createError(400, '密码需包含字母和数字'))
    }

    // 检查手机号是否已注册
    const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone)
    if (existing) {
      return next(createError(409, '该手机号已注册'))
    }

    // 生成用户数据
    const userId = nanoid()
    const passwordHash = bcrypt.hashSync(password, config.bcrypt.saltRounds)
    const contentSalt = keyService.generateSalt()
    const now = new Date().toISOString()

    // 使用 nanoid 生成 6 位短数字作为默认 username（兼容旧前端）
    const defaultUsername = `user_${Date.now().toString(36)}`

    // 解析输入
    const userDisplayName = display_name || phone.slice(0, 3) + '****' + phone.slice(-4)
    const userBirthDate = birth_date || '2000-01-01'
    const userLifeExpectancy = life_expectancy ? parseInt(life_expectancy) : 80

    // 创建用户
    db.prepare(`
      INSERT INTO users (id, username, phone, password_hash, content_salt, display_name, role, status, birth_date, life_expectancy, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'user', 'active', ?, ?, ?, ?)
    `).run(userId, defaultUsername, phone, passwordHash, contentSalt, userDisplayName, userBirthDate, userLifeExpectancy, now, now)

    // 派生并缓存加密密钥
    const encryptionKey = keyService.getEncryptionKey(userId, password, contentSalt)

    // 签发 Token
    const tokens = authService.generateTokens({ id: userId, phone, role: 'user' })

    // 记录活动日志
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || ''
    syncRecordEvent('register', {
      userId,
      ipAddress,
      userAgent: req.headers['user-agent'],
      path: '/api/auth/register',
      metadata: { phone },
    })

    res.status(201).json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        user: {
          id: userId,
          phone,
          role: 'user',
          username: defaultUsername,
          display_name: userDisplayName,
          birth_date: userBirthDate,
          life_expectancy: userLifeExpectancy,
        },
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/auth/login - 用户登录
 * Body: { phone, password }
 */
async function login(req, res, next) {
  try {
    const db = getDb()
    const { phone, password } = req.body

    if (!phone || !password) {
      return next(createError(400, '手机号和密码不能为空'))
    }

    // 查找用户
    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone)

    // 统一错误提示：不暴露是手机号无效还是密码错误
    if (!user) {
      return next(createError(401, '手机号或密码错误'))
    }

    // 检查用户状态
    if (user.status === 'disabled') {
      return next(createError(403, '账号已被禁用'))
    }

    // 验证密码
    const isValid = bcrypt.compareSync(password, user.password_hash)
    if (!isValid) {
      return next(createError(401, '手机号或密码错误'))
    }

    // 派生并缓存加密密钥
    const encryptionKey = keyService.getEncryptionKey(user.id, password, user.content_salt)

    // 更新最后登录时间
    db.prepare("UPDATE users SET last_login_at = datetime('now', 'localtime') WHERE id = ?").run(user.id)

    // 签发 Token
    const tokens = authService.generateTokens({ id: user.id, phone: user.phone, role: user.role })

    // 记录登入日志
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || ''
    syncRecordEvent('login', {
      userId: user.id,
      ipAddress,
      userAgent: req.headers['user-agent'],
      path: '/api/auth/login',
      metadata: { phone },
    })

    res.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        user: {
          id: user.id,
          phone: user.phone,
          role: user.role,
          username: user.username,
          display_name: user.display_name,
          birth_date: user.birth_date,
          life_expectancy: user.life_expectancy,
        },
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/auth/logout - 用户登出
 * Headers: Authorization: Bearer <accessToken>
 */
async function logout(req, res, next) {
  try {
    // 从 Token 获取用户 ID（使用可选认证中间件）
    let userId = req.user?.userId

    // 尝试从 Authorization header 解码
    if (!userId) {
      const authHeader = req.headers.authorization
      if (authHeader) {
        try {
          const token = authHeader.split(' ')[1]
          const decoded = authService.verifyAccessToken(token)
          userId = decoded.userId
        } catch {
          // Token 可能已过期，尝试从 refresh token 获取
        }
      }
    }

    if (userId) {
      // 吊销所有该用户的 Refresh Token
      authService.revokeAllUserTokens(userId)
      // 清除加密密钥缓存
      keyService.clearKeyCache(userId)

      // 记录登出日志
      syncRecordEvent('logout', {
        userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        path: '/api/auth/logout',
      })
    }

    res.json({ success: true, message: '已退出登录' })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/auth/refresh - 刷新 Token
 * Body: { refreshToken }
 */
async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return next(createError(400, 'refreshToken 不能为空'))
    }

    const newTokens = authService.rotateRefreshToken(refreshToken)

    if (!newTokens) {
      return next(createError(401, 'Refresh Token 无效或已过期，请重新登录'))
    }

    res.json({
      success: true,
      data: {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresIn: 24 * 60 * 60, // 24h
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/auth/change-password - 修改密码（需登录）
 * Headers: Authorization: Bearer <accessToken>
 * Body: { oldPassword, newPassword }
 */
async function changePassword(req, res, next) {
  try {
    const db = getDb()
    const userId = req.user?.userId

    if (!userId) {
      return next(createError(401, '未登录'))
    }

    const { oldPassword, newPassword } = req.body

    if (!oldPassword || !newPassword) {
      return next(createError(400, '旧密码和新密码不能为空'))
    }

    if (oldPassword === newPassword) {
      return next(createError(400, '新旧密码不能相同'))
    }

    if (newPassword.length < 6) {
      return next(createError(400, '新密码长度至少6位'))
    }
    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) {
      return next(createError(400, '新密码需包含字母和数字'))
    }

    // 获取用户信息
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
    if (!user) {
      return next(createError(404, '用户不存在'))
    }

    // 验证旧密码
    const isValid = bcrypt.compareSync(oldPassword, user.password_hash)
    if (!isValid) {
      return next(createError(400, '旧密码错误'))
    }

    // ===== 内容重加密 =====
    // 1. 用旧密码派生旧密钥
    const oldKey = keyService.deriveKey(oldPassword, user.content_salt)

    // 2. 读取用户所有加密日记
    const entries = db.prepare(
      'SELECT id, content_encrypted FROM entries WHERE user_id = ? AND content_encrypted IS NOT NULL'
    ).all(userId)

    // 3. 生成新的 salt 和密钥
    const newSalt = keyService.generateSalt()
    const newKey = keyService.deriveKey(newPassword, newSalt)
    const newHash = bcrypt.hashSync(newPassword, config.bcrypt.saltRounds)

    // 4. 在事务中完成重加密
    const reencryptTx = db.transaction(() => {
      // 重加密所有条目
      const updateStmt = db.prepare('UPDATE entries SET content_encrypted = ? WHERE id = ?')
      for (const entry of entries) {
        try {
          const plaintext = cryptoService.decrypt(entry.content_encrypted, oldKey)
          const newEncrypted = cryptoService.encrypt(plaintext, newKey)
          updateStmt.run(newEncrypted, entry.id)
        } catch (e) {
          // 如果某条记录解密失败，跳过（可能是旧格式数据）
          console.warn(`[ChangePassword] Skipping entry ${entry.id}: ${e.message}`)
        }
      }

      // 更新用户密码
      db.prepare('UPDATE users SET password_hash = ?, content_salt = ?, updated_at = ? WHERE id = ?')
        .run(newHash, newSalt, new Date().toISOString(), userId)
    })

    reencryptTx()

    // 5. 吊销该用户所有 Refresh Token
    authService.revokeAllUserTokens(userId)

    // 6. 清除密钥缓存
    keyService.clearKeyCache(userId)

    // 7. 记录日志
    syncRecordEvent('password_change', {
      userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      path: '/api/auth/change-password',
    })

    res.json({
      success: true,
      message: '密码修改成功，请重新登录',
      data: { reencryptedCount: entries.length },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/auth/send-code - 发送短信验证码（P1）
 * 开发阶段使用固定验证码
 * Body: { phone }
 */
async function sendCode(req, res, next) {
  try {
    const { phone } = req.body

    if (!phone || !/^\d{11}$/.test(phone)) {
      return next(createError(400, '请输入有效的11位手机号'))
    }

    const db = getDb()

    // 开发环境：直接返回固定验证码
    if (process.env.NODE_ENV !== 'production') {
      const code = config.sms.devCode
      const expiresAt = new Date(Date.now() + config.sms.codeExpiresMinutes * 60 * 1000).toISOString()

      db.prepare(`
        INSERT INTO sms_codes (phone, code, purpose, expires_at)
        VALUES (?, ?, 'reset', ?)
      `).run(phone, code, expiresAt)

      console.log(`[SMS] Dev mode - Code for ${phone}: ${code}`)

      return res.json({
        success: true,
        message: '验证码已发送',
        // 开发模式下返回验证码方便调试
        ...(process.env.NODE_ENV !== 'production' && { devCode: code }),
      })
    }

    // 生产环境：检查60秒内是否有过发送
    const recentCode = db.prepare(`
      SELECT id FROM sms_codes
      WHERE phone = ? AND purpose = 'reset' AND used = 0
      AND created_at > datetime('now', ? || ' seconds')
    `).get(phone, `-${config.sms.resendInterval}`)

    if (recentCode) {
      return next(createError(429, `请 ${config.sms.resendInterval} 秒后再试`))
    }

    // TODO: 接入短信服务（阿里云/腾讯云 SMS）
    // 生成6位随机验证码
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = new Date(Date.now() + config.sms.codeExpiresMinutes * 60 * 1000).toISOString()

    db.prepare(`
      INSERT INTO sms_codes (phone, code, purpose, expires_at)
      VALUES (?, ?, 'reset', ?)
    `).run(phone, code, expiresAt)

    console.log(`[SMS] Code sent to ${phone}: ${code}`)

    res.json({
      success: true,
      message: '验证码已发送',
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/auth/reset-password - 验证码 + 重置密码
 * Body: { phone, code, newPassword }
 * 注意：重置密码后，已有加密内容永久不可读！
 */
async function resetPassword(req, res, next) {
  try {
    const db = getDb()
    const { phone, code, newPassword } = req.body

    if (!phone || !code || !newPassword) {
      return next(createError(400, '手机号、验证码和新密码不能为空'))
    }

    if (newPassword.length < 6) {
      return next(createError(400, '新密码长度至少6位'))
    }

    // 查找用户
    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone)
    if (!user) {
      return next(createError(404, '该手机号未注册'))
    }

    // 验证验证码
    const smsCode = db.prepare(`
      SELECT id, code FROM sms_codes
      WHERE phone = ? AND purpose = 'reset' AND used = 0
      AND expires_at > datetime('now', 'localtime')
      ORDER BY created_at DESC LIMIT 1
    `).get(phone)

    if (!smsCode) {
      return next(createError(400, '验证码不存在或已过期'))
    }

    if (smsCode.code !== code) {
      return next(createError(400, '验证码错误'))
    }

    // 标记验证码为已使用
    db.prepare('UPDATE sms_codes SET used = 1 WHERE id = ?').run(smsCode.id)

    // 【重要】重置密码 - 旧加密密钥永久丢失
    // 旧 content_salt 不变（保持密钥派生的确定性），但密码变了
    // 所以旧密钥无法通过新密码派生，已有加密内容永久不可读
    const newHash = bcrypt.hashSync(newPassword, config.bcrypt.saltRounds)
    const now = new Date().toISOString()

    db.prepare(`
      UPDATE users SET password_hash = ?, updated_at = ?, last_login_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(newHash, now, user.id)

    // 吊销所有 Refresh Token
    authService.revokeAllUserTokens(user.id)

    // 清除密钥缓存
    keyService.clearKeyCache(user.id)

    // 签发新 Token
    const tokens = authService.generateTokens({ id: user.id, phone: user.phone, role: user.role })

    // 记录日志
    syncRecordEvent('password_reset', {
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      path: '/api/auth/reset-password',
      metadata: { phone },
    })

    res.json({
      success: true,
      message: '密码重置成功',
      warning: '由于加密密钥变更，您之前的日记内容已无法读取。这是为了保障您的数据安全。',
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        user: {
          id: user.id,
          phone: user.phone,
          role: user.role,
          username: user.username,
          display_name: user.display_name,
        },
      },
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { register, login, logout, refresh, changePassword, sendCode, resetPassword }

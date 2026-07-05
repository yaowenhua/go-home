# 返乡日记（go-home）V2 — 架构设计文档

> **版本**: v2.0  
> **日期**: 2026-07-05  
> **作者**: Architect Team  
> **状态**: 初稿  
> **定位**: 在 V1.5（Vue 3 前端重写完成）基础上，新增用户认证、数据加密、后台管理、访问统计

---

## 目录

1. [架构总览](#1-架构总览)
2. [认证架构](#2-认证架构)
3. [数据模型变更](#3-数据模型变更)
4. [内容加密方案](#4-内容加密方案)
5. [后台管理](#5-后台管理)
6. [API 层扩展](#6-api-层扩展)
7. [文件结构变更](#7-文件结构变更)
8. [数据迁移方案与脚本](#8-数据迁移方案与脚本)
9. [安全设计](#9-安全设计)
10. [部署与运维](#10-部署与运维)

---

## 1. 架构总览

### 1.1 V1 → V2 演进路线

```
V1（已上线）          →    V1.5（已完成）          →    V2（本次设计）
React 18 + Express    →    Vue 3 + Express         →    Vue 3 + Express 重写
Zustand + React Router→    Pinia + Vue Router       →    + 用户系统
Device-ID 身份        →    Device-ID 身份           →    + JWT 认证
明文存储              →    明文存储                  →    + 内容加密 (AES-256-GCM)
无后台管理            →    无后台管理                →    + 管理后台
无用户统计            →    无用户统计                →    + 访问统计
```

### 1.2 系统分层架构

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (Vue 3)                  │
│  ┌──────────┐ ┌──────────┐ ┌─────────────────────┐  │
│  │ Login    │ │ Settings │ │ AdminDashboard      │  │
│  │ Login.vue│ │ +改密登出│ │ +用户列表+统计图表   │  │
│  └────┬─────┘ └────┬─────┘ └──────────┬──────────┘  │
│       │            │                  │             │
│  ┌────▼────────────▼──────────────────▼──────────┐  │
│  │              API Layer (Axios)                 │  │
│  │  auth.js  │  entries.js  │  admin.js  │ stats │  │
│  └───────────────────────┬───────────────────────┘  │
│                          │                          │
│  ┌───────────────────────▼───────────────────────┐  │
│  │            Pinia Stores (状态管理)             │  │
│  │  auth.js (JWT令牌+登录状态)                    │  │
│  │  app.js (用户+记录+UI)                         │  │
│  │  tag.js (标签管理)                             │  │
│  └───────────────────────────────────────────────┘  │
│                          │                          │
│  ┌───────────────────────▼───────────────────────┐  │
│  │          Vue Router (路由守卫)                 │  │
│  │  requiresAuth → 检查 authStore.isLoggedIn     │  │
│  │  requiresAdmin → 检查 authStore.role === 'admin'│ │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────┘
                          │ HTTP (Bearer Token)
                          ▼
┌─────────────────────────────────────────────────────┐
│                    Backend (Express)                 │
│  ┌───────────────────────────────────────────────┐  │
│  │         Middleware Layer                       │  │
│  │  authMiddleware.js (JWT验证)                   │  │
│  │  adminMiddleware.js (角色检查)                  │  │
│  │  activityLogger.js (访问统计埋点)              │  │
│  │  rateLimiter.js (登录频控)                     │  │
│  └──────────────┬────────────────────────────────┘  │
│                 │                                    │
│  ┌──────────────▼────────────────────────────────┐  │
│  │         Controller Layer                      │  │
│  │  authController.js (注册/登录/登出/改密)       │  │
│  │  entryController.js (CRUD+加密)                │  │
│  │  userController.js (用户信息)                  │  │
│  │  adminController.js (管理后台)                 │  │
│  │  statsController.js (统计查询)                 │  │
│  └──────────────┬────────────────────────────────┘  │
│                 │                                    │
│  ┌──────────────▼────────────────────────────────┐  │
│  │         Service Layer (新增)                   │  │
│  │  cryptoService.js (AES-256-GCM加解密)          │  │
│  │  authService.js (JWT签发+验证+refresh)         │  │
│  │  keyService.js (密钥派生+缓存)                 │  │
│  └──────────────┬────────────────────────────────┘  │
│                 │                                    │
│  ┌──────────────▼────────────────────────────────┐  │
│  │         Data Layer                             │  │
│  │  database.js (better-sqlite3)                  │  │
│  │  migration.js (V1→V2迁移脚本)                  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 1.3 新增依赖

```json
{
  "backend": {
    "dependencies": {
      "jsonwebtoken": "^9.0.0",
      "bcryptjs": "^2.4.3"
    }
  },
  "frontend": {
    "dependencies": {
      "chart.js": "^4.4.0"
    }
  }
}
```

---

## 2. 认证架构

### 2.1 JWT 方案设计

#### 2.1.1 Token 双令牌机制

```
┌───────────────────────────────────────────────────────────────┐
│                      JWT Token 体系                           │
│                                                               │
│  ┌─────────────────────────────┐  ┌─────────────────────────┐ │
│  │      Access Token           │  │    Refresh Token         │ │
│  │  ───────────────────────    │  │  ─────────────────────   │ │
│  │  有效期: 24小时              │  │  有效期: 7天             │ │
│  │  存储: localStorage         │  │  存储: localStorage      │ │
│  │  发送: Authorization Bearer │  │  发送: POST /api/auth/   │ │
│  │  用途: 每次API请求认证       │  │         refresh 请求体   │ │
│  │  签名: JWT_SECRET           │  │  签名: JWT_REFRESH_SECRET│ │
│  └─────────────────────────────┘  └────────┬────────────────┘ │
│                                            │                 │
│  每次登录/刷新: 旧的Refresh Token失效       │                 │
│  后端 refresh_tokens 表中记录 token_hash    │                 │
└────────────────────────────────────────────┴─────────────────┘
```

#### 2.1.2 Token Payload 结构

```json
// Access Token
{
  "userId": "abc123def456",
  "phone": "13800138000",
  "role": "user",
  "iat": 1688888888,
  "exp": 1688975288
}

// Refresh Token
{
  "userId": "abc123def456",
  "jti": "unique-token-id",
  "iat": 1688888888,
  "exp": 1689493688
}
```

#### 2.1.3 配置项

```javascript
// config/auth.js (新增)
module.exports = {
  jwt: {
    accessSecret: process.env.JWT_SECRET || 'change-me-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change-me-refresh-secret',
    accessExpiresIn: '24h',
    refreshExpiresIn: '7d',
  },
  bcrypt: {
    saltRounds: 12,
  },
  sms: {
    devCode: '888888',
    codeExpiresMinutes: 5,
    resendInterval: 60, // seconds
  },
}
```

### 2.2 Token 存储策略

**前端 localStorage 存储方案**（基于当前架构决策）：

```javascript
// localStorage 存储键
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'go_home_access_token',
  REFRESH_TOKEN: 'go_home_refresh_token',
  USER_INFO: 'go_home_user_info', // 基础用户信息缓存
}
```

**为什么不使用 httpOnly Cookie：**
- 当前后端无 session 层，JWT 已足够
- httpOnly Cookie 需要额外 CSRF 防护
- localStorage 方案简化了多端 Token 管理
- **风险缓解**: 已在前端实现 XSS 防护（Vue 默认转义模板内容）

### 2.3 后端 Auth 中间件

#### 2.3.1 authMiddleware.js

```javascript
// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken')
const { createError } = require('./errorHandler')
const config = require('../config/auth')

/**
 * JWT 认证中间件
 * - 从 Authorization header 提取 Bearer token
 * - 验证 token 有效性和过期时间
 * - 将解密后的 payload 注入 req.user
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader) {
    return next(createError(401, '未登录，请先登录'))
  }

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return next(createError(401, 'Token 格式错误'))
  }

  const token = parts[1]

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret)
    req.user = {
      userId: decoded.userId,
      phone: decoded.phone,
      role: decoded.role,
    }
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(createError(401, 'Token 已过期，请刷新'))
    }
    return next(createError(401, '无效的 Token'))
  }
}

/**
 * 可选认证中间件
 * - 有 token 则解析注入，无 token 也不拒绝
 * - 用于兼容 V1 到 V2 过渡期的接口
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    req.user = null
    return next()
  }

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    req.user = null
    return next()
  }

  try {
    const decoded = jwt.verify(parts[1], config.jwt.accessSecret)
    req.user = {
      userId: decoded.userId,
      phone: decoded.phone,
      role: decoded.role,
    }
  } catch {
    req.user = null
  }
  next()
}

module.exports = { authenticate, optionalAuth }
```

#### 2.3.2 adminMiddleware.js

```javascript
// backend/middleware/adminMiddleware.js
const { createError } = require('./errorHandler')

/**
 * 管理员权限中间件
 * - 必须在 authenticate 之后使用
 * - 检查 req.user.role === 'admin'
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return next(createError(401, '未登录'))
  }
  if (req.user.role !== 'admin') {
    return next(createError(403, '权限不足'))
  }
  next()
}

module.exports = { requireAdmin }
```

#### 2.3.3 中间件引用关系

```
请求到达
  │
  ├── /api/auth/* → 无需认证 → 直接放行
  │
  ├── /api/entries/* → authenticate → entryController
  │
  ├── /api/users/me → authenticate → userController
  │
  ├── /api/admin/* → authenticate → requireAdmin → adminController
  │
  └── /api/stats/* → authenticate → requireAdmin → statsController
```

### 2.4 前端路由守卫

#### 2.4.1 路由元信息扩展

```javascript
// src/router/index.js — V2 扩展后
const routes = [
  // 公开路由（无需登录）
  { path: '/onboarding', meta: { requiresAuth: false } },
  { path: '/login', meta: { requiresAuth: false, layout: 'auth' } },

  // 用户路由（需登录）
  { path: '/', meta: { requiresAuth: true, requiresAdmin: false } },
  { path: '/history', meta: { requiresAuth: true, requiresAdmin: false } },
  { path: '/settings', meta: { requiresAuth: true, requiresAdmin: false } },

  // 管理路由（需管理员）
  {
    path: '/admin',
    meta: { requiresAuth: true, requiresAdmin: true, layout: 'admin' },
    children: [
      { path: '', name: 'AdminDashboard' },
      { path: 'users', name: 'AdminUsers' },
    ],
  },
]
```

#### 2.4.2 导航守卫完整实现

```javascript
// src/router/index.js — V2 导航守卫
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useAppStore } from '../stores/app'

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 路由守卫白名单（不触发 redirect 循环）
const PUBLIC_PATHS = ['/login', '/onboarding']

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  const appStore = useAppStore()

  // 1. 初始化 authStore（从 localStorage 恢复 token）
  if (!authStore.isInitialized) {
    await authStore.initialize()
  }

  // 2. 检查是否需要登录
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    // 保存目标路由，登录后跳回
    return next({ path: '/login', query: { redirect: to.fullPath } })
  }

  // 3. 检查是否需要管理员
  if (to.meta.requiresAdmin && authStore.role !== 'admin') {
    return next({ path: '/', query: { error: '权限不足' } })
  }

  // 4. 已登录用户不进入登录页
  if (to.path === '/login' && authStore.isLoggedIn) {
    return next({ path: '/' })
  }

  next()
})

export default router
```

### 2.5 认证流程详细设计

#### 2.5.1 注册流程

```
用户输入手机号 + 密码
  │
  ├── 前端校验: 手机号11位 / 密码≥6位含字母+数字
  │
  ├── POST /api/auth/register { phone, password }
  │     │
  │     ├── 后端校验:
  │     │   ├── phone 已注册 → 409 手机号已注册
  │     │   ├── 手机号格式无效 → 400
  │     │   └── 密码强度不足 → 400
  │     │
  │     ├── 密码处理:
  │     │   ├── bcrypt.hash(password, 12) → password_hash
  │     │   └── crypto.randomBytes(16).toString('hex') → content_salt
  │     │
  │     ├── 用户创建:
  │     │   └── INSERT INTO users (id, phone, password_hash, content_salt, ...)
  │     │
  │     ├── Token 签发:
  │     │   ├── accessToken = jwt.sign({userId, phone, role:'user'}, ...)
  │     │   ├── refreshToken = jwt.sign({userId, jti}, ...)
  │     │   └── 存储 refreshToken hash → refresh_tokens 表
  │     │
  │     └── 响应: { accessToken, refreshToken, user: {id, phone, role} }
  │
  └── 前端:
      ├── 存入 localStorage
      ├── authStore.setLoggedIn(true)
      ├── 同时派生加密密钥存入 authStore.encryptionKey
      └── 跳转至引导页或首页
```

#### 2.5.2 登录流程

```
用户输入手机号 + 密码
  │
  ├── POST /api/auth/login { phone, password }
  │     │
  │     ├── 手机号不存在 → 401 "手机号或密码错误"（不暴露具体哪个错）
  │     │
  │     ├── bcrypt.compare(password, password_hash) → false → 同上 401
  │     │
  │     ├── 频率限制检查: 5次/分钟/手机号 → 超过则 429
  │     │
  │     ├── Token 签发:
  │     │   ├── 吊销该用户所有旧 refreshToken（可选轮换策略）
  │     │   ├── accessToken = jwt.sign({userId, phone, role})
  │     │   ├── refreshToken = jwt.sign({userId, jti})
  │     │   └── INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
  │     │
  │     ├── 更新最后登录时间:
  │     │   └── UPDATE users SET last_login_at = datetime('now')
  │     │
  │     └── 响应: { accessToken, refreshToken, user: {id, phone, role, ...} }
  │
  └── 前端:
      ├── 存入 localStorage
      ├── authStore 状态更新
      ├── 调用 keyService 派生加密密钥（通过后端辅助端点）
      ├── 检查 redirect 参数 → 跳回原页面 / 首页
      └── 如 admin → 检查是否需要跳转 /admin
```

#### 2.5.3 Token 刷新流程

```
前端收到 401 响应
  │
  ├── POST /api/auth/refresh { refreshToken }
  │     │
  │     ├── 验证 refreshToken 签名+有效期
  │     ├── 计算 SHA256(refreshToken) → 查询 refresh_tokens 表
  │     │   ├── 不存在或被 revoked → 401 (重新登录)
  │     │   └── 正常 → 继续
  │     │
  │     ├── Token 轮换（Refresh Token Rotation）:
  │     │   ├── 标记旧 refreshToken 为 revoked
  │     │   ├── 签发新 accessToken + 新 refreshToken
  │     │   └── 存储新 refreshToken hash
  │     │
  │     └── 响应: { accessToken, refreshToken }
  │
  └── 前端:
      ├── 更新 localStorage
      ├── 重试失败的原请求
      └── 如果 refresh 也失败 → 清除 tokens → 跳转登录页
```

#### 2.5.4 登出流程

```
用户点击"退出登录"
  │
  ├── POST /api/auth/logout (Authorization: Bearer accessToken)
  │     │
  │     └── 后端:
  │         ├── 从请求头获取 accessToken 解码获取 userId
  │         ├── 可选: 将该用户所有 refreshToken 标记为 revoked
  │         └── 响应: { success: true }
  │
  └── 前端:
      ├── 清除 localStorage 中的 tokens 和用户信息
      ├── 清除加密密钥缓存
      ├── 清除本地日记缓存 (可选)
      ├── authStore 重置
      └── 跳转登录页
```

#### 2.5.5 修改密码流程

```
用户输入旧密码 + 新密码 × 2
  │
  ├── POST /api/auth/change-password (Auth Header)
  │     ├── { oldPassword, newPassword }
  │     │
  │     ├── 校验旧密码: bcrypt.compare(oldPassword, password_hash)
  │     │   └── 不匹配 → 400 "旧密码错误"
  │     │
  │     ├── 校验新密码强度（≥6位，含字母+数字）
  │     │
  │     ├── 新旧密码相同 → 400 "新旧密码不能相同"
  │     │
  │     ├── 关键步骤: 内容重加密
  │     │   ├── 用旧密码派生旧密钥
  │     │   ├── 读取该用户所有 entries 的 content_encrypted
  │     │   ├── 逐个用旧密钥解密获取明文
  │     │   ├── 生成新的 content_salt
  │     │   ├── 用新密码派生新密钥
  │     │   ├── 用新密钥重新加密所有内容
  │     │   ├── 更新 entries.content_encrypted
  │     │   └── 在单个事务中完成
  │     │
  │     ├── 更新用户:
  │     │   ├── UPDATE users SET password_hash = ?, content_salt = ?
  │     │   ├── 吊销该用户所有 refreshToken
  │     │   └── 更新 updated_at
  │     │
  │     └── 响应: { success: true }
  │
  └── 前端:
      ├── 清除所有 token
      ├── 提示 "密码修改成功，请重新登录"
      └── 跳转登录页
```

#### 2.5.6 重置密码流程

```
用户在登录页点击"忘记密码"
  │
  ├── 输入手机号
  │     │
  │     ├── POST /api/auth/send-code { phone }
  │     │   └── 开发环境: 返回 888888
  │     │   └── 生产环境: 调用短信服务 API
  │     │
  │     └── 前端: 开始 60s 倒计时
  │
  ├── 输入验证码 + 新密码
  │     │
  │     ├── POST /api/auth/reset-password { phone, code, newPassword }
  │     │   ├── 验证码校验:
  │     │   │   ├── 查找 phone + 未使用 + 未过期 → 验证
  │     │   │   ├── 标记验证码为 used
  │     │   │   └── 验证失败 → 400 "验证码错误或已过期"
  │     │   │
  │     │   ├── 重要: 管理员重置密码影响
  │     │   │   ├── 用户密码被重置 → 新 salt + 新 password_hash
  │     │   │   ├── 旧密钥丢失 → 已有加密内容永久不可访问
  │     │   │   └── 与用户自行修改密码不同，此场景不重加密内容
  │     │   │
  │     │   ├── 更新用户密码
  │     │   ├── 吊销所有旧 refreshToken
  │     │   ├── 签发新 token（自动登录）
  │     │   │
  │     │   └── 响应: { accessToken, refreshToken, user }
  │     │
  │     └── 前端: 自动登录 → 跳转首页
  │
  └── 注意:
      ├── 验证码有效期为 5 分钟
      └── 每个验证码仅可使用一次
```

### 2.6 加密密钥派生与缓存

```javascript
// backend/services/keyService.js
const crypto = require('crypto')

const PBKDF2_ITERATIONS = 100000
const KEY_LENGTH = 32 // 256 bits

// 内存缓存（单进程部署适用）
const keyCache = new Map()
const CACHE_TTL = 4 * 60 * 60 * 1000 // 4小时

/**
 * 从用户密码派生出 AES-256-GCM 加密密钥
 * @param {string} password - 用户明文密码
 * @param {string} contentSalt - 用户自有的加密盐值 (hex)
 * @returns {Buffer} 32 bytes 的加密密钥
 */
function deriveKey(password, contentSalt) {
  return crypto.pbkdf2Sync(
    password,
    contentSalt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    'sha256'
  )
}

/**
 * 获取加密密钥（带缓存）
 * @param {string} userId
 * @param {string} password
 * @param {string} contentSalt
 * @returns {Buffer}
 */
function getEncryptionKey(userId, password, contentSalt) {
  const cached = keyCache.get(userId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.key
  }
  const key = deriveKey(password, contentSalt)
  keyCache.set(userId, { key, expiresAt: Date.now() + CACHE_TTL })
  return key
}

/**
 * 清除指定用户的加密密钥缓存
 * （密码修改后需调用）
 */
function clearKeyCache(userId) {
  keyCache.delete(userId)
}

/**
 * 生成随机加密盐值
 * @returns {string} 32字符 hex 字符串
 */
function generateSalt() {
  return crypto.randomBytes(16).toString('hex')
}

module.exports = {
  deriveKey,
  getEncryptionKey,
  clearKeyCache,
  generateSalt,
}
```

---

## 3. 数据模型变更

### 3.1 users 表完整定义

```sql
-- V2 users 表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                          -- nanoid，不变
  username TEXT UNIQUE NOT NULL,                 -- 不变（兼容旧数据，用作昵称/显示名）
  phone TEXT UNIQUE,                             -- 【新增】手机号（登录凭证，可为 NULL 兼容旧数据）
  password_hash TEXT,                            -- 【新增】bcrypt 密码哈希（可为 NULL 兼容旧数据）
  content_salt TEXT,                             -- 【新增】AES 加密盐值 (32字符 hex)
  display_name TEXT,                             -- 【新增】显示昵称
  role TEXT NOT NULL DEFAULT 'user',             -- 【新增】角色: 'user' | 'admin'
  status TEXT NOT NULL DEFAULT 'active',          -- 【新增】状态: 'active' | 'disabled'
  last_login_at TEXT,                            -- 【新增】最后登录时间 (ISO8601)
  birth_date TEXT NOT NULL,                      -- 不变
  life_expectancy INTEGER DEFAULT 80,            -- 不变
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
```

### 3.2 users 表 V1 → V2 字段对照

| 字段名 | V1 存在 | V2 变化 |
|---------|---------|---------|
| id | ✅ | 不变 |
| username | ✅ | 不变（展示用，不再是登录凭证） |
| phone | ❌ | **新增**（新登录凭证） |
| password_hash | ❌ | **新增** |
| content_salt | ❌ | **新增** |
| display_name | ❌ | **新增**（可选，复用 username 作为默认值） |
| role | ❌ | **新增**（默认 'user'） |
| status | ❌ | **新增**（默认 'active'） |
| last_login_at | ❌ | **新增** |
| birth_date | ✅ | 不变 |
| life_expectancy | ✅ | 不变 |
| created_at | ✅ | 不变 |
| updated_at | ✅ | 不变 |

### 3.3 entries 表 V2 扩展

```sql
-- V2 entries 表 - 新增字段
-- 新增 content_encrypted TEXT 字段存储加密后的内容
ALTER TABLE entries ADD COLUMN content_encrypted TEXT;

-- 新增 user_id 字段改进（确保所有 entries 关联到 users.id）
-- user_id 原为 TEXT 类型，V1 中存储的是 username，V2 改为存储 users.id
-- 由于 SQLite 不支持修改列类型，我们保留原值，新数据写入 users.id

-- content_encrypted 字段存储的 JSON 格式:
-- {"c": "hex_ciphertext", "i": "hex_iv", "t": "hex_authTag"}
-- c = ciphertext (AES-256-GCM 加密后的密文, hex)
-- i = initialization vector (12 bytes, hex)
-- t = auth tag (16 bytes, hex)

-- 新增索引
CREATE INDEX IF NOT EXISTS idx_entries_user_id_v2 ON entries(user_id);
```

### 3.4 新增 refresh_tokens 表

```sql
-- V2: Refresh Token 管理表
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,                        -- 用户 ID（关联 users.id）
  token_hash TEXT NOT NULL,                     -- Refresh Token 的 SHA256 哈希
  device_info TEXT,                             -- 设备信息（可选）
  ip_address TEXT,                              -- 签发时的 IP 地址
  expires_at TEXT NOT NULL,                     -- 过期时间 (ISO8601)
  revoked INTEGER DEFAULT 0,                    -- 是否已撤销 (0=未撤销, 1=已撤销)
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
-- 清理过期 refresh token 的索引
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_cleanup ON refresh_tokens(expires_at, revoked);
```

### 3.5 新增 activity_log 表

```sql
-- V2: 用户活动日志表（访问统计核心数据源）
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,                                 -- 用户 ID（可为 NULL 表示匿名访问）
  event_type TEXT NOT NULL,                     -- 事件类型
  ip_address TEXT,                              -- 请求 IP
  user_agent TEXT,                              -- User-Agent
  path TEXT,                                    -- 请求路径
  metadata TEXT,                                -- 额外信息 (JSON)
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- event_type 枚举值:
-- 'page_view'      - 页面浏览（前端路由变化）
-- 'api_call'       - API 请求（统一中间件记录）
-- 'login'          - 登录成功
-- 'register'       - 注册成功
-- 'entry_create'   - 创建日记
-- 'entry_update'   - 更新日记
-- 'entry_delete'   - 删除日记
-- 'logout'         - 登出
-- 'password_change' - 修改密码
-- 'password_reset' - 重置密码

-- 索引
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_event_type ON activity_log(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_date ON activity_log(date(created_at));
```

### 3.6 新增 sms_codes 表（P1）

```sql
-- V2: 短信验证码表（P1 功能，开发阶段用固定验证码 888888 替代）
CREATE TABLE IF NOT EXISTS sms_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,                          -- 手机号
  code TEXT NOT NULL,                           -- 验证码
  purpose TEXT NOT NULL DEFAULT 'reset',         -- 用途: 'register' | 'reset'
  expires_at TEXT NOT NULL,                      -- 过期时间 (ISO8601)
  used INTEGER DEFAULT 0,                        -- 是否已使用 (0=未使用, 1=已使用)
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_sms_codes_phone ON sms_codes(phone);
CREATE INDEX IF NOT EXISTS idx_sms_codes_purpose ON sms_codes(phone, purpose);
```

### 3.7 所有表变更汇总

| 表 | 操作 | 说明 | 优先级 |
|----|------|------|--------|
| users | **修改** | 新增 7 个字段 (phone, password_hash, content_salt, display_name, role, status, last_login_at) | P0 |
| entries | **修改** | 新增 content_encrypted 字段 | P0 |
| refresh_tokens | **新增** | Refresh Token 管理 | P0 |
| activity_log | **新增** | 访问统计数据源 | P1 |
| sms_codes | **新增** | 短信验证码（开发期可跳过） | P1 |

### 3.8 SQLite Schema 约束说明

```javascript
// SQLite 特定的注意事项:
//
// 1. ALTER TABLE ADD COLUMN:
//    SQLite 支持 ALTER TABLE ADD COLUMN，但新增列不能有 NOT NULL 约束
//    除非指定了 DEFAULT 值。因此 phone 和 password_hash 定义为可为 NULL
//    （兼容 V1 旧数据）
//
// 2. 不支持 DROP COLUMN:
//    SQLite 3.35.0+ 支持 ALTER TABLE DROP COLUMN，但为保持兼容性，
//    我们不删除任何字段，仅新增
//
// 3. 事务安全:
//    better-sqlite3 支持同步事务，使用 db.transaction(() => { ... })()
```

---

## 4. 内容加密方案

### 4.1 加密选型

| 项目 | 选择 | 理由 |
|------|------|------|
| 算法 | AES-256-GCM | 认证加密，提供机密性 + 完整性验证 |
| 密钥派生 | PBKDF2-HMAC-SHA256 | 内置 crypto 模块，无需额外依赖 |
| 迭代次数 | 100,000 | 平衡安全性与性能 |
| 派生密钥长度 | 32 bytes (256 bits) | AES-256 要求 |
| IV 长度 | 12 bytes (96 bits) | GCM 推荐值 |
| Auth Tag 长度 | 16 bytes (128 bits) | 最高安全性 |
| 盐值长度 | 16 bytes | 每个用户独立 |
| 密钥存储 | 不存储，登录时派生 | 管理员无法获取用户密码，因此无法派生密钥 |

### 4.2 加密架构决策树

```
用户密码
    │
    ├── bcrypt(password, 12) → password_hash
    │   └── 存入 users.password_hash (用于登录验证)
    │
    └── PBKDF2(password, content_salt, 100000, 32, 'sha256') → encryptionKey
        └── 不存储，登录后派生并缓存 4 小时
            └── crypto.createCipheriv('aes-256-gcm', encryptionKey, iv)
                └── 加密 entries.content 后存入 entries.content_encrypted
```

### 4.3 cryptoService 实现

```javascript
// backend/services/cryptoService.js
const crypto = require('crypto')

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12       // bytes
const AUTH_TAG_LENGTH = 16 // bytes

/**
 * 加密内容
 * @param {string} plaintext - 明文内容
 * @param {Buffer} encryptionKey - 32 bytes 加密密钥
 * @returns {string} JSON 字符串 {c, i, t}
 */
function encrypt(plaintext, encryptionKey) {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  return JSON.stringify({
    c: encrypted,
    i: iv.toString('hex'),
    t: authTag.toString('hex'),
  })
}

/**
 * 解密内容
 * @param {string} encryptedStr - JSON 字符串 {c, i, t}
 * @param {Buffer} encryptionKey - 32 bytes 加密密钥
 * @returns {string} 明文内容
 */
function decrypt(encryptedStr, encryptionKey) {
  let data
  try {
    data = JSON.parse(encryptedStr)
  } catch {
    throw new Error('Invalid encrypted data format')
  }

  const { c, i, t } = data

  if (!c || !i || !t) {
    throw new Error('Missing required encrypted data fields')
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    encryptionKey,
    Buffer.from(i, 'hex')
  )

  decipher.setAuthTag(Buffer.from(t, 'hex'))

  let decrypted = decipher.update(c, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

/**
 * 批量重加密（用于修改密码）
 * @param {Array<{id: string, content_encrypted: string}>} entries
 * @param {Buffer} oldKey
 * @param {Buffer} newKey
 * @returns {Array<{id: string, content_encrypted: string}>}
 */
function batchReencrypt(entries, oldKey, newKey) {
  return entries.map((entry) => {
    if (!entry.content_encrypted) {
      return entry // 没有加密内容的条目保持原样
    }
    const plaintext = decrypt(entry.content_encrypted, oldKey)
    const newEncrypted = encrypt(plaintext, newKey)
    return { id: entry.id, content_encrypted: newEncrypted }
  })
}

module.exports = { encrypt, decrypt, batchReencrypt }
```

### 4.4 加解密在 Controller 层的调用

```javascript
// 在 entryController.js 中的修改:

// 创建日记时加密
async function create(req, res, next) {
  try {
    const db = getDb()
    const { content, rating, category, entry_date, date } = req.body

    // 从 req.user 获取当前登录用户
    const userId = req.user.userId

    // 加密 content
    const encryptionKey = req.encryptionKey // 由 auth 中间件注入
    let contentEncrypted = null
    if (content && encryptionKey) {
      contentEncrypted = cryptoService.encrypt(content, encryptionKey)
    }

    // ... 插入数据库，content_encrypted 写入加密字段
  }
}

// 读取日记时解密
async function getByDate(req, res, next) {
  try {
    // ... 查询数据
    const rows = db.prepare(
      'SELECT * FROM entries WHERE entry_date = ? AND user_id = ? ORDER BY created_at DESC'
    ).all(date, req.user.userId)

    const encryptionKey = req.encryptionKey
    const decryptedRows = rows.map((row) => ({
      ...row,
      content: row.content_encrypted && encryptionKey
        ? cryptoService.decrypt(row.content_encrypted, encryptionKey)
        : row.content, // 降级：旧数据或无法解密时返回明文
      content_encrypted: undefined, // 不向客户端暴露加密数据
    }))

    res.json({ success: true, data: decryptedRows })
  }
}
```

### 4.5 req.encryptionKey 的注入方式

```javascript
// backend/middleware/authMiddleware.js
// 在 authenticate 中间件中注入加密密钥

const keyService = require('../services/keyService')

function authenticate(req, res, next) {
  // ... JWT 验证逻辑 ...

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret)
    req.user = {
      userId: decoded.userId,
      phone: decoded.phone,
      role: decoded.role,
    }

    // 注入加密密钥（如果用户有 password 的话）
    // 注意：这里需要一个机制来获取 password
    // 方案1: 登录时在后端加密 password 存 session/临时存储
    // 方案2: 新增端点 POST /api/auth/derive-key { password }
    //        加密后存入内存缓存
    //
    // 推荐方案: 登录成功后自动派生密钥并缓存
    // 在 authController.login 中:
    //   const encKey = keyService.deriveKey(password, user.content_salt)
    //   keyService.cacheKey(user.id, encKey)

    next()
  } catch (err) {
    // ...
  }
}
```

### 4.6 密钥生命周期

```
注册
  │
  ├── 生成 content_salt (随机16字节)
  ├── PBKDF2(password, content_salt) → encryptionKey
  └── 不持久化 encryptionKey

登录
  │
  ├── PBKDF2(password, content_salt) → encryptionKey
  ├── 缓存到内存 (4h TTL)
  └── 后续请求通过 req.encryptionKey 获取

修改密码
  │
  ├── 旧 password + 旧 content_salt → 旧 encryptionKey
  ├── 解密所有 entries
  ├── 生成新 content_salt
  ├── 新 password + 新 content_salt → 新 encryptionKey
  ├── 重新加密所有 entries
  └── 清除旧缓存

管理员重置密码
  │
  ├── 生成新 content_salt + 新 password_hash
  ├── 旧 encryptionKey 永久丢失
  ├── 已有加密内容永久不可读
  └── 用户下次使用新密码登录后只能创建新内容

登出
  │
  └── 清除内存中的 encryptionKey 缓存
```

### 4.7 加密安全注意事项

| 风险 | 说明 | 缓解措施 |
|------|------|---------|
| 密码泄露 | 密码泄露则密钥泄露 | bcrypt 哈希减慢爆破速度；提醒用户使用强密码 |
| 数据库泄露 | 攻击者获取 SQLite 文件 | 密文无密钥无法解密；密钥不在数据库内 |
| 内存泄露 | 密钥驻留在内存中 | 设置 TTL 4h；不在日志中打印密钥 |
| 密码修改后数据丢失 | 旧密钥无法恢复 | 修改密码时自动重加密；重置密码前需用户确认数据将丢失 |
| PBKDF2 耗时 | 100k 迭代约 50-100ms | 缓存密钥减少派生次数；仅在登录时派生一次 |

---

## 5. 后台管理

### 5.1 管理后台架构

```
┌─────────────────────────────────────────────────────────────┐
│                   管理后台前端 (/admin/*)                      │
│                                                             │
│  /admin/login              → AdminLogin.vue                  │
│  /admin                    → AdminDashboard.vue (重定向)      │
│  /admin/users              → AdminUsers.vue                  │
│  /admin/users/:id          → AdminUserDetail.vue             │
│                                                             │
│  管理后台与用户前端共享同一个 Vue 应用实例                     │
│  但使用独立的路由前缀 /admin/*                                 │
│  管理后台组件放在 /src/views/admin/ 目录                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   后端管理 API                                 │
│                                                             │
│  GET    /api/admin/users      → 用户列表（分页+搜索）          │
│  GET    /api/admin/users/:id  → 用户详情                     │
│  POST   /api/admin/users/:id/reset-password → 重置密码       │
│  PUT    /api/admin/users/:id/status          → 启用/禁用     │
│  GET    /api/admin/stats      → 统计总览                     │
│  GET    /api/admin/stats/dau-trend → DAU 趋势数据             │
│                                                             │
│  所有管理 API 需要通过 authenticate + requireAdmin            │
│  req.user.role !== 'admin' → 403                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 管理 API 详细设计

#### 5.2.1 用户列表 API

```
GET /api/admin/users
  Headers: Authorization: Bearer <admin_access_token>
  Query:
    page     - (可选, 默认 1) 页码
    pageSize - (可选, 默认 20) 每页数量
    search   - (可选) 按手机号模糊搜索
    status   - (可选) 按状态过滤: 'active' | 'disabled'
    sortBy   - (可选) 排序字段: 'created_at' | 'last_login_at'
    sortDir  - (可选) 排序方向: 'asc' | 'desc'

  Response:
  {
    "success": true,
    "data": {
      "users": [
        {
          "id": "abc123",
          "phone": "138****8000",     // 手机号脱敏
          "display_name": "张三",
          "role": "user",
          "status": "active",
          "birthDate": "1990-01-01",
          "entryCount": 42,
          "lastLoginAt": "2026-07-04T12:00:00Z",
          "createdAt": "2026-06-01T00:00:00Z"
        }
      ],
      "pagination": {
        "page": 1,
        "pageSize": 20,
        "total": 156,
        "totalPages": 8
      }
    }
  }
```

#### 5.2.2 重置用户密码 API

```
POST /api/admin/users/:id/reset-password
  Headers: Authorization: Bearer <admin_access_token>
  Body: 无（后端生成随机密码）

  Response:
  {
    "success": true,
    "data": {
      "tempPassword": "aB3#kF9$mN1@xP7",  // 随机生成的临时密码
      "message": "请将此密码安全地告知用户。用户下次登录后需立即修改密码。"
    }
  }

  注意:
  - 重置密码时生成新的 content_salt
  - 旧加密密钥永久丢失，已有加密内容不可访问
  - 重置后需要 user 标记 password_reset_required = true
```

#### 5.2.3 启用/禁用用户 API

```
PUT /api/admin/users/:id/status
  Headers: Authorization: Bearer <admin_access_token>
  Body: { "status": "disabled" | "active" }

  Response:
  {
    "success": true,
    "data": {
      "id": "abc123",
      "status": "disabled",
      "updatedAt": "2026-07-05T10:00:00Z"
    }
  }

  校验:
  - 不能禁用自己（管理员不能禁用自己）
  - 不能禁用其他管理员
```

#### 5.2.4 统计总览 API

```
GET /api/admin/stats
  Headers: Authorization: Bearer <admin_access_token>

  Response:
  {
    "success": true,
    "data": {
      "totalUsers": 156,
      "totalEntries": 3892,
      "dau": 42,
      "wau": 198,
      "mau": 523,
      "entriesToday": 15,
      "usersToday": 8
    }
  }
```

#### 5.2.5 DAU 趋势 API

```
GET /api/admin/stats/dau-trend
  Headers: Authorization: Bearer <admin_access_token>
  Query:
    days - (可选, 默认 30) 过去天数

  Response:
  {
    "success": true,
    "data": [
      { "date": "2026-06-06", "dau": 38 },
      { "date": "2026-06-07", "dau": 42 },
      ...
      { "date": "2026-07-05", "dau": 45 }
    ]
  }
```

### 5.3 管理员账号初始化

```javascript
// backend/scripts/seedAdmin.js
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const { nanoid } = require('nanoid')
const { getDb } = require('../db/database')

function seedAdmin() {
  const db = getDb()
  const adminPhone = process.env.ADMIN_PHONE || '13800000000'
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123'

  const existingAdmin = db.prepare('SELECT id FROM users WHERE phone = ? AND role = ?')
    .get(adminPhone, 'admin')

  if (existingAdmin) {
    console.log('[Seed] Admin user already exists, skipping...')
    return
  }

  const adminId = nanoid()
  const passwordHash = bcrypt.hashSync(adminPassword, 12)
  const contentSalt = crypto.randomBytes(16).toString('hex')
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO users (id, username, phone, password_hash, content_salt, display_name, role, status, birth_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'admin', 'active', '2000-01-01', ?, ?)
  `).run(adminId, '管理员', adminPhone, passwordHash, contentSalt, '系统管理员', now, now)

  console.log(`[Seed] Admin user created: ${adminPhone}`)
}

module.exports = { seedAdmin }
```

### 5.4 管理前端关键实现

#### 5.4.1 管理后台路由

```javascript
// src/router/index.js — 新增管理路由
const adminRoutes = {
  path: '/admin',
  meta: { requiresAuth: true, requiresAdmin: true },
  component: () => import('../views/admin/AdminLayout.vue'),
  children: [
    {
      path: '',
      redirect: { name: 'AdminUsers' },
    },
    {
      path: 'users',
      name: 'AdminUsers',
      component: () => import('../views/admin/AdminUsers.vue'),
      meta: { title: '用户管理' },
    },
    {
      path: 'users/:id',
      name: 'AdminUserDetail',
      component: () => import('../views/admin/AdminUserDetail.vue'),
      meta: { title: '用户详情' },
    },
    {
      path: 'stats',
      name: 'AdminStats',
      component: () => import('../views/admin/AdminStats.vue'),
      meta: { title: '数据统计' },
    },
  ],
}
```

#### 5.4.2 导航栏扩展

管理员用户在底部标签栏或侧边栏看到"管理后台"入口。

```vue
<!-- NavBar.vue — V2 扩展 -->
<template>
  <nav class="navbar">
    <router-link to="/" v-if="isLoggedIn">🏠 首页</router-link>
    <router-link to="/history" v-if="isLoggedIn">📅 历史</router-link>
    <router-link to="/settings" v-if="isLoggedIn">⚙️ 设置</router-link>
    <router-link to="/admin" v-if="isAdmin">🛡️ 管理</router-link>
    <router-link to="/login" v-if="!isLoggedIn">🔐 登录</router-link>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const isLoggedIn = computed(() => authStore.isLoggedIn)
const isAdmin = computed(() => authStore.isLoggedIn && authStore.role === 'admin')
</script>
```

---

## 6. API 层扩展

### 6.1 新增 API 端点完整清单

| 方法 | 路径 | 说明 | 认证要求 | 管理员仅限 | 优先级 |
|------|------|------|---------|-----------|--------|
| **认证模块** | | | | | |
| POST | `/api/auth/register` | 手机号注册 | 无 | 否 | P0 |
| POST | `/api/auth/login` | 手机号登录 | 无 | 否 | P0 |
| POST | `/api/auth/logout` | 登出 | 需要 | 否 | P0 |
| POST | `/api/auth/refresh` | 刷新 Token | 无(使用 refreshToken) | 否 | P0 |
| POST | `/api/auth/change-password` | 修改密码 | 需要 | 否 | P0 |
| POST | `/api/auth/send-code` | 发送短信验证码 | 无 | 否 | P1 |
| POST | `/api/auth/reset-password` | 验证码+重置密码 | 无 | 否 | P1 |
| **用户模块(V2扩展)** | | | | | |
| GET | `/api/users/me` | 获取当前用户信息 | 需要 | 否 | P0 |
| PUT | `/api/users/me` | 更新当前用户信息 | 需要 | 否 | P0 |
| **管理后台模块** | | | | | |
| GET | `/api/admin/users` | 用户列表(分页+搜索) | 需要 | 是 | P1 |
| GET | `/api/admin/users/:id` | 用户详情 | 需要 | 是 | P1 |
| POST | `/api/admin/users/:id/reset-password` | 重置密码 | 需要 | 是 | P1 |
| PUT | `/api/admin/users/:id/status` | 启用/禁用用户 | 需要 | 是 | P2 |
| GET | `/api/admin/stats` | 统计总览 | 需要 | 是 | P1 |
| **统计模块** | | | | | |
| GET | `/api/stats/dau` | 当日 DAU | 需要 | 是 | P1 |
| GET | `/api/stats/wau` | 本周 WAU | 需要 | 是 | P1 |
| GET | `/api/stats/mau` | 本月 MAU | 需要 | 是 | P1 |
| GET | `/api/stats/dau-trend` | 近30天 DAU 趋势 | 需要 | 是 | P1 |
| GET | `/api/stats/summary` | 统计总览 | 需要 | 是 | P1 |

### 6.2 现有 API 端点修改清单

| 方法 | 路径 | 修改内容 | 影响说明 | 优先级 |
|------|------|---------|---------|--------|
| GET | `/api/entries/by-date?date=xxx` | 追加 `WHERE user_id = ?` | **破坏性变更**: 原返回所有用户数据，V2 只返回当前用户数据 | P0 |
| GET | `/api/entries` | 追加 `WHERE user_id = ?` | **破坏性变更** | P0 |
| POST | `/api/entries` | `userId` 强制使用 `req.user.userId` | 行为变更: 忽略请求体中的 userId | P0 |
| PUT | `/api/entries/:id` | 校验 `entry.user_id === req.user.userId` | 新增越权检查 | P0 |
| DELETE | `/api/entries/:id` | 校验 `entry.user_id === req.user.userId` | 新增越权检查 | P0 |
| GET | `/api/entries/:id` | 校验 `entry.user_id === req.user.userId` | 新增越权检查 | P0 |
| GET | `/api/users/profile?userId=xxx` | **废弃**: 替换为 `/api/users/me` | 保留兼容，返回当前用户信息 | P0 |
| PUT | `/api/users/profile` | **废弃**: 替换为 `PUT /api/users/me` | 保留兼容，但加认证 | P0 |
| POST | `/api/users` | **保持兼容** | 旧客户端可用，但建议迁移到 auth/register | P2 |

### 6.3 API 一致性规范

```javascript
// 所有 API 响应格式:

// 成功响应
{
  "success": true,
  "data": { ... }          // 或 data: [...] 对于列表
}

// 列表响应（含分页）
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 156
  }
}

// 错误响应
{
  "success": false,
  "error": {
    "message": "手机号或密码错误",
    "code": "AUTH_INVALID_CREDENTIALS"  // 可选错误码
  }
}

// HTTP 状态码使用规范:
// 200 - 成功
// 201 - 创建成功
// 400 - 请求参数错误
// 401 - 未登录 / Token 失效
// 403 - 权限不足
// 404 - 资源不存在
// 409 - 冲突（如手机号已注册）
// 429 - 频率限制
// 500 - 服务器内部错误
```

### 6.4 API 路由结构

```javascript
// backend/server.js — V2 扩展
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

// --- V2 新增模块 ---
const authRoutes = require('./routes/auth')
const adminRoutes = require('./routes/admin')
const statsRoutes = require('./routes/stats')

// --- V1 已有模块 (需修改) ---
const entriesRouter = require('./routes/entries')
const usersRouter = require('./routes/users')

// Health check (不变)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// -- 认证路由 (无需认证) --
app.use('/api/auth', authRoutes)

// -- V2 用户路由 (需要认证) --
app.use('/api/users', usersRouter)

// -- 日记路由 (需要认证) --
app.use('/api/entries', entriesRouter)

// -- 管理后台路由 (需要认证 + 管理员) --
app.use('/api/admin', adminRoutes)

// -- 统计路由 (需要认证 + 管理员) --
app.use('/api/stats', statsRoutes)

// Error handler (增强)
const { errorHandler } = require('./middleware/errorHandler')
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
```

---

## 7. 文件结构变更

### 7.1 后端文件结构（V2 新增/修改文件标注）

```
go-home/
└── backend/
    ├── server.js                               # [修改] 新增路由注册
    ├── package.json                            # [修改] 新增依赖
    │
    ├── config/
    │   └── auth.js                             # [新增] JWT / bcrypt / 短信配置
    │
    ├── db/
    │   ├── database.js                         # [修改] 新增表结构初始化
    │   └── migration.js                        # [新增] V1→V2 数据迁移脚本
    │
    ├── middleware/
    │   ├── errorHandler.js                     # [修改] 新增 createError 辅助函数
    │   ├── authMiddleware.js                   # [新增] JWT 验证中间件
    │   ├── adminMiddleware.js                  # [新增] 管理员权限中间件
    │   └── activityLogger.js                  # [新增] 活动日志中间件
    │
    ├── controllers/
    │   ├── authController.js                   # [新增] 注册/登录/登出/改密
    │   ├── entryController.js                  # [修改] 新增加密/用户隔离
    │   ├── userController.js                   # [修改] 新增 /me 端点
    │   ├── adminController.js                  # [新增] 管理后台控制器
    │   └── statsController.js                  # [新增] 统计查询控制器
    │
    ├── services/
    │   ├── cryptoService.js                    # [新增] AES-256-GCM 加解密
    │   ├── authService.js                      # [新增] JWT 签发/验证/Refresh
    │   └── keyService.js                       # [新增] 密钥派生/缓存管理
    │
    ├── routes/
    │   ├── auth.js                             # [新增] 认证路由
    │   ├── entries.js                          # [修改] 加 auth 中间件
    │   ├── users.js                            # [修改] 加 auth 中间件
    │   ├── admin.js                            # [新增] 管理后台路由
    │   └── stats.js                            # [新增] 统计路由
    │
    └── scripts/
        ├── seedAdmin.js                        # [新增] 管理员账号初始化
        └── migrateV1ToV2.js                    # [新增] V1→V2 数据迁移
```

### 7.2 前端文件结构（V2 新增/修改文件标注）

```
go-home/
└── frontend/
    ├── src/
    │   ├── main.js                             # [修改] 引入 auth store
    │   ├── App.vue                             # [修改] 全局 auth 监听
    │   │
    │   ├── router/
    │   │   └── index.js                        # [修改] 新增 Login/Admin 路由 + 守卫
    │   │
    │   ├── stores/
    │   │   ├── app.js                          # [修改] 移除 deviceId 逻辑
    │   │   ├── auth.js                         # [新增] Pinia auth store
    │   │   └── tag.js                          # (不变, 已有)
    │   │
    │   ├── api/
    │   │   ├── index.js                        # [修改] 新增 Auth 拦截器 + Token 管理
    │   │   ├── auth.js                         # [新增] 登录/注册/刷新 API
    │   │   ├── admin.js                        # [新增] 管理后台 API
    │   │   ├── stats.js                        # [新增] 统计 API
    │   │   ├── entries.js                      # [修改] 移除 userId 参数
    │   │   ├── user.js                         # [修改] 改用 /api/users/me
    │   │   └── localStore.js                   # [修改] 存储 key 前缀改为 go_home_
    │   │
    │   ├── views/
    │   │   ├── Login.vue                       # [新增] 登录/注册/忘记密码页面
    │   │   ├── Onboarding.vue                  # [修改] 增加登录入口
    │   │   ├── Settings.vue                    # [修改] 新增改密/登出功能
    │   │   ├── admin/
    │   │   │   ├── AdminLayout.vue             # [新增] 管理后台布局
    │   │   │   ├── AdminUsers.vue              # [新增] 用户列表页
    │   │   │   ├── AdminUserDetail.vue         # [新增] 用户详情页
    │   │   │   └── AdminStats.vue              # [新增] 统计图表页
    │   │   └── ...                             # (其他 views 不变或微调)
    │   │
    │   └── components/
    │       ├── NavBar.vue                      # [修改] 新增管理后台入口
    │       └── ...                             # (其他 components 不变)
```

### 7.3 文件变更汇总

| 区域 | 操作 | 文件数 | 备注 |
|------|------|--------|------|
| 后端 | **新增** | 14 个 | config, middleware, controllers, services, routes, scripts |
| 后端 | **修改** | 5 个 | server.js, package.json, database.js, entryController, userController |
| 前端 | **新增** | 10 个 | views, stores, api, components |
| 前端 | **修改** | 7 个 | main.js, App.vue, router, api/index, stores/app, Settings, NavBar |
| **合计** | | **36 个** | |

---

## 8. 数据迁移方案与脚本

### 8.1 迁移策略

```
迁移策略: 向下兼容，渐进迁移
─────────────────────────────────────

Phase 1 — Schema 变更（启动时自动执行）
  ├── users 表 ALTER TABLE ADD COLUMN (兼容旧数据)
  ├── entries 表 ADD COLUMN content_encrypted
  └── 新建 refresh_tokens / activity_log / sms_codes 表

Phase 2 — 管理员账号创建（启动时自动执行）
  ├── 检查是否已存在管理员账号
  └── 不存在则根据环境变量创建默认管理员

Phase 3 — 旧数据加密（按需执行脚本）
  ├── 对于已有用户，需要注册后手动关联旧数据
  └── 提供 migrateV1ToV2.js 脚本

Phase 4 — 清理（V2 稳定后）
  └── 删除 entries.content 冗余字段
```

### 8.2 可运行 Migration SQL

```sql
-- ===============================================================
-- 返乡日记 V2 - 数据库迁移脚本
-- 兼容 SQLite 3.x，使用 better-sqlite3 执行
-- ===============================================================

-- ---------------------------------------------------------------
-- 1. users 表扩展
-- ---------------------------------------------------------------

-- 新增 phone 字段（可为 NULL 兼容旧数据）
ALTER TABLE users ADD COLUMN phone TEXT;

-- 新增 password_hash 字段（可为 NULL 兼容旧数据）
ALTER TABLE users ADD COLUMN password_hash TEXT;

-- 新增 content_salt 字段（可为 NULL 兼容旧数据）
ALTER TABLE users ADD COLUMN content_salt TEXT;

-- 新增 display_name 字段
ALTER TABLE users ADD COLUMN display_name TEXT;

-- 新增 role 字段（默认 'user'）
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';

-- 新增 status 字段（默认 'active'）
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

-- 新增 last_login_at 字段
ALTER TABLE users ADD COLUMN last_login_at TEXT;

-- ---------------------------------------------------------------
-- 2. entries 表扩展
-- ---------------------------------------------------------------

-- 新增 content_encrypted 密文字段
ALTER TABLE entries ADD COLUMN content_encrypted TEXT;

-- ---------------------------------------------------------------
-- 3. 新建 refresh_tokens 表
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  device_info TEXT,
  ip_address TEXT,
  expires_at TEXT NOT NULL,
  revoked INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ---------------------------------------------------------------
-- 4. 新建 activity_log 表
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  event_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  path TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ---------------------------------------------------------------
-- 5. 新建 sms_codes 表（P1 功能，开发阶段可跳过）
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sms_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'reset',
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ---------------------------------------------------------------
-- 6. 索引
-- ---------------------------------------------------------------

-- users 表索引
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- entries 表索引
CREATE INDEX IF NOT EXISTS idx_entries_user_id_v2 ON entries(user_id);

-- refresh_tokens 表索引
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_cleanup ON refresh_tokens(expires_at, revoked);

-- activity_log 表索引
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_event_type ON activity_log(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_date ON activity_log(date(created_at));

-- sms_codes 表索引
CREATE INDEX IF NOT EXISTS idx_sms_codes_phone ON sms_codes(phone);
CREATE INDEX IF NOT EXISTS idx_sms_codes_purpose ON sms_codes(phone, purpose);
```

### 8.3 database.js 修改要点

```javascript
// backend/db/database.js — V2 修改（在原有基础上增加 V2 表结构）

function initDatabase() {
  const dbInstance = getDb()

  // -- 原有 V1 表结构（不变） --
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      birth_date TEXT NOT NULL,
      life_expectancy INTEGER DEFAULT 80,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      content TEXT NOT NULL,
      rating INTEGER DEFAULT 3,
      satisfaction INTEGER DEFAULT 3,
      category TEXT DEFAULT 'life',
      tags TEXT,
      date TEXT,
      entry_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `)

  // -- V2: Schema 迁移（安全执行，已存在的列自动跳过） --
  try { dbInstance.exec('ALTER TABLE users ADD COLUMN phone TEXT') } catch (e) { /* SQLITE_OK */ }
  try { dbInstance.exec('ALTER TABLE users ADD COLUMN password_hash TEXT') } catch (e) { /* SQLITE_OK */ }
  try { dbInstance.exec('ALTER TABLE users ADD COLUMN content_salt TEXT') } catch (e) { /* SQLITE_OK */ }
  try { dbInstance.exec('ALTER TABLE users ADD COLUMN display_name TEXT') } catch (e) { /* SQLITE_OK */ }
  try { dbInstance.exec('ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT \'user\'') } catch (e) { /* SQLITE_OK */ }
  try { dbInstance.exec('ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT \'active\'') } catch (e) { /* SQLITE_OK */ }
  try { dbInstance.exec('ALTER TABLE users ADD COLUMN last_login_at TEXT') } catch (e) { /* SQLITE_OK */ }
  try { dbInstance.exec('ALTER TABLE entries ADD COLUMN content_encrypted TEXT') } catch (e) { /* SQLITE_OK */ }

  // -- V2: 新建表 --
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      device_info TEXT,
      ip_address TEXT,
      expires_at TEXT NOT NULL,
      revoked INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      event_type TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      path TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS sms_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      code TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT 'reset',
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `)

  // -- V2: 索引 --
  dbInstance.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    CREATE INDEX IF NOT EXISTS idx_entries_user_id_v2 ON entries(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
    CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_log_event_type ON activity_log(event_type);
    CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_activity_log_date ON activity_log(date(created_at));
    CREATE INDEX IF NOT EXISTS idx_sms_codes_phone ON sms_codes(phone);
  `);

  // -- 管理员账号初始化 --
  const { seedAdmin } = require('../scripts/seedAdmin')
  seedAdmin()

  // -- 清理过期 refresh tokens（启动时清理） --
  dbInstance.exec(
    'DELETE FROM refresh_tokens WHERE expires_at < datetime(\'now\')'
  )

  console.log('[DB] Database initialized with V2 migrations')
  return dbInstance
}
```

### 8.4 V1→V2 数据迁移脚本（入口点）

```javascript
// backend/scripts/migrateV1ToV2.js
// 一次性迁移脚本: V1 旧用户数据 → V2 新格式
// 使用方式: node scripts/migrateV1ToV2.js [--dry-run]

const { getDb } = require('../db/database')

const DRY_RUN = process.argv.includes('--dry-run')

async function migrate() {
  console.log('=== 返乡日记 V1 → V2 数据迁移 ===')
  const db = getDb()

  // 1. 统计 V1 旧数据
  const v1Users = db.prepare('SELECT * FROM users WHERE phone IS NULL').all()
  const v1Entries = db.prepare('SELECT * FROM entries WHERE content_encrypted IS NULL').all()
  console.log(`  待迁移: ${v1Users.length} 个旧用户, ${v1Entries.length} 条旧记录`)

  if (DRY_RUN) {
    console.log('[DRY-RUN] 未执行实际修改')
    return
  }

  // 2. 旧用户无法自动迁移（需要手机号和密码），跳过
  //    用户需要重新注册
  console.log('  [SKIP] 旧用户需要重新注册（V2 登录需要手机号+密码）')

  // 3. 旧 entries 的 content 保持原样（content_encrypted = NULL）
  //    前端读取时: content_encrypted 不为空时返回解密内容
  //                content_encrypted 为空时返回 content 明文
  console.log('  [SKIP] 旧记录保持 content 明文字段，content_encrypted = NULL')
  console.log('         前端读取降级: content_encrypted 为空时读取 content 字段')

  // 4. 创建默认管理员账号
  console.log('  [DONE] 管理员账号已在 database.init 中创建')

  console.log('=== 迁移完成 ===')
}

migrate().catch(console.error)
```

### 8.5 活动日志中间件

```javascript
// backend/middleware/activityLogger.js
const { getDb } = require('../db/database')

/**
 * 活动日志中间件
 * 记录每个 API 请求到 activity_log 表
 * 频控策略:
 *   - page_view: 同一用户同一页面 5min 内不重复
 *   - api_call: 同一用户 1min 内仅首次记录
 *   - 关键操作 (login/register/create/update/delete): 实时记录
 */
function logActivity(eventType, options = {}) {
  return (req, res, next) => {
    const originalEnd = res.end.bind(res)

    // 在响应完成后记录
    res.end = function (...args) {
      try {
        const db = getDb()
        const userId = req.user?.userId || null
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || ''
        const userAgent = req.headers['user-agent'] || ''

        // 登录/注册事件从请求体获取 userId
        const effectiveUserId = eventType === 'login' || eventType === 'register'
          ? (req.body?.userId || userId)
          : userId

        const metadata = JSON.stringify({
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          ...options.metadata,
        })

        db.prepare(`
          INSERT INTO activity_log (user_id, event_type, ip_address, user_agent, path, metadata)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(effectiveUserId, eventType, ipAddress, userAgent, req.originalUrl, metadata)
      } catch (err) {
        // 日志记录不应影响主流程
        console.error('[ActivityLog] Failed to log event:', err.message)
      }

      originalEnd(...args)
    }

    next()
  }
}

module.exports = { logActivity }
```

---

## 9. 安全设计

### 9.1 安全策略总览

| 安全维度 | 策略 | 实现方式 |
|---------|------|---------|
| 传输安全 | HTTPS | 生产环境强制 HTTPS |
| 存储安全 | 密码 bcrypt，内容 AES-256-GCM | bcrypt(12) + crypto.createCipheriv |
| 认证安全 | JWT双令牌 + Token轮换 | accessToken 24h + refreshToken 7天 |
| 越权防护 | 用户级数据隔离 | 所有查询自动追加 WHERE user_id = ? |
| 频率限制 | 登录/注册频控 | 5次/分钟/手机号 |
| 密码策略 | 最小强度 + 不可与旧密码相同 | ≥6位，含字母+数字，新旧不同 |
| 错误信息 | 不泄露具体信息 | "手机号或密码错误" 统一提示 |

### 9.2 登录频控中间件

```javascript
// backend/middleware/rateLimiter.js
const { createError } = require('./errorHandler')

// 内存频控计数器（单进程）
const loginAttempts = new Map()
const WINDOW_MS = 60 * 1000 // 1分钟窗口
const MAX_ATTEMPTS = 5       // 最多5次

/**
 * 登录频率限制中间件
 * 基于手机号限制
 */
function loginRateLimiter(req, res, next) {
  const phone = req.body?.phone
  if (!phone) return next()

  const now = Date.now()
  const key = `login:${phone}`

  // 清理过期记录
  if (loginAttempts.has(key)) {
    const record = loginAttempts.get(key)
    if (now - record.windowStart > WINDOW_MS) {
      loginAttempts.set(key, { count: 1, windowStart: now })
      return next()
    }
    if (record.count >= MAX_ATTEMPTS) {
      return next(createError(429, '登录尝试次数过多，请 1 分钟后再试'))
    }
    record.count++
  } else {
    loginAttempts.set(key, { count: 1, windowStart: now })
  }

  // 定期清理过期记录
  if (loginAttempts.size > 10000) {
    for (const [k, v] of loginAttempts.entries()) {
      if (now - v.windowStart > WINDOW_MS) {
        loginAttempts.delete(k)
      }
    }
  }

  next()
}

module.exports = { loginRateLimiter }
```

### 9.3 XSS 防护

```javascript
// 前端安全策略:
// 1. Vue 3 默认转义所有模板表达式 {{ }} → 天然防 XSS
// 2. 避免使用 v-html，除非内容经过 sanitize
// 3. localStorage 中的 token 不可被 XSS 读取如果 CSP 配置完善

// 后端安全策略:
// 1. 所有数据库查询使用 prepared statements (better-sqlite3)
// 2. 用户输入在写入前不做特殊处理（不修改用户数据）
// 3. 响应中的用户内容在前端渲染时由 Vue 自动转义
```

### 9.4 CSP 建议

```html
<!-- 建议在生产环境 index.html 中添加 -->
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self';
           script-src 'self';
           style-src 'self' 'unsafe-inline';
           connect-src 'self' https://api.example.com;
           img-src 'self' data:;">
```

---

## 10. 部署与运维

### 10.1 环境变量清单

```bash
# === 必要配置 ===
PORT=3000
JWT_SECRET=your-256-bit-secret-key                   # 必填，32字符以上随机字符串
JWT_REFRESH_SECRET=your-256-bit-refresh-secret       # 必填，与 JWT_SECRET 不同
ADMIN_PHONE=13800000000                              # 管理员手机号
ADMIN_PASSWORD=Admin123                              # 管理员初始密码

# === 可选配置 ===
JWT_ACCESS_EXPIRES=24h                               # Access Token 有效期
JWT_REFRESH_EXPIRES=7d                               # Refresh Token 有效期
DB_PATH=./data/return-home.db                        # 数据库路径
NODE_ENV=development                                  # development | production

# === 短信服务（生产环境 ===
SMS_PROVIDER=aliyun                                   # aliyun | tencent
SMS_ACCESS_KEY=xxx
SMS_SECRET_KEY=xxx
SMS_SIGN_NAME=返乡日记
SMS_TEMPLATE_CODE=SMS_123456

# === 开发环境 ===
DEV_SMS_CODE=888888                                   # 开发环境固定验证码
```

### 10.2 启动脚本

```json
// package.json 新增脚本
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "migrate": "node scripts/migrateV1ToV2.js",
    "migrate:dry-run": "node scripts/migrateV1ToV2.js --dry-run",
    "seed:admin": "node -e \"require('./scripts/seedAdmin').seedAdmin()\""
  }
}
```

### 10.3 数据库维护

```javascript
// 定期维护任务（可配置为 cron job）

// 清理过期 refresh tokens（建议每天运行一次）
function cleanupRefreshTokens() {
  const db = getDb()
  const deleted = db.prepare(
    'DELETE FROM refresh_tokens WHERE expires_at < datetime(\'now\')'
  ).run()
  console.log(`[Maintenance] Cleaned up ${deleted.changes} expired refresh tokens`)
}

// 清理超过 90 天的 activity_log（保留最近3个月的统计原始数据）
function cleanupOldActivityLogs() {
  const db = getDb()
  const deleted = db.prepare(
    "DELETE FROM activity_log WHERE created_at < datetime('now', '-90 days')"
  ).run()
  console.log(`[Maintenance] Cleaned up ${deleted.changes} old activity logs`)
}

// 清理过期的 sms_codes
function cleanupExpiredSmsCodes() {
  const db = getDb()
  const deleted = db.prepare(
    "DELETE FROM sms_codes WHERE expires_at < datetime('now')"
  ).run()
  console.log(`[Maintenance] Cleaned up ${deleted.changes} expired SMS codes`)
}
```

---

## 附录 A: 前端 auth Store 参考实现

```javascript
// src/stores/auth.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '../api/auth'

const ACCESS_TOKEN_KEY = 'go_home_access_token'
const REFRESH_TOKEN_KEY = 'go_home_refresh_token'
const USER_INFO_KEY = 'go_home_user_info'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref(null)
  const refreshToken = ref(null)
  const user = ref(null)           // { id, phone, role, username, ... }
  const isInitialized = ref(false)
  const isLoading = ref(false)

  const isLoggedIn = computed(() => !!accessToken.value)
  const role = computed(() => user.value?.role || '')
  const isAdmin = computed(() => role.value === 'admin')

  // 初始化: 从 localStorage 恢复 token
  async function initialize() {
    const storedAccess = localStorage.getItem(ACCESS_TOKEN_KEY)
    const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY)
    const storedUser = localStorage.getItem(USER_INFO_KEY)

    if (storedAccess && storedRefresh) {
      accessToken.value = storedAccess
      refreshToken.value = storedRefresh
      if (storedUser) {
        try { user.value = JSON.parse(storedUser) } catch { /* ignore */ }
      }

      // 尝试验证 token 是否有效
      try {
        const res = await authApi.getMe()
        user.value = res.data
        localStorage.setItem(USER_INFO_KEY, JSON.stringify(res.data))
      } catch {
        // Token 可能过期，尝试 refresh
        try {
          const refreshed = await refreshTokens()
          if (!refreshed) {
            await logout()
          }
        } catch {
          await logout()
        }
      }
    }

    isInitialized.value = true
  }

  async function login(phone, password) {
    isLoading.value = true
    try {
      const res = await authApi.login({ phone, password })
      const { accessToken: at, refreshToken: rt, user: u } = res.data

      accessToken.value = at
      refreshToken.value = rt
      user.value = u

      localStorage.setItem(ACCESS_TOKEN_KEY, at)
      localStorage.setItem(REFRESH_TOKEN_KEY, rt)
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(u))

      return u
    } finally {
      isLoading.value = false
    }
  }

  async function register(phone, password) {
    isLoading.value = true
    try {
      const res = await authApi.register({ phone, password })
      const { accessToken: at, refreshToken: rt, user: u } = res.data

      accessToken.value = at
      refreshToken.value = rt
      user.value = u

      localStorage.setItem(ACCESS_TOKEN_KEY, at)
      localStorage.setItem(REFRESH_TOKEN_KEY, rt)
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(u))

      return u
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    try {
      await authApi.logout()
    } catch {
      // 登出请求失败不影响本地清理
    } finally {
      accessToken.value = null
      refreshToken.value = null
      user.value = null

      localStorage.removeItem(ACCESS_TOKEN_KEY)
      localStorage.removeItem(REFRESH_TOKEN_KEY)
      localStorage.removeItem(USER_INFO_KEY)
    }
  }

  async function refreshTokens() {
    try {
      const res = await authApi.refresh({ refreshToken: refreshToken.value })
      const { accessToken: at, refreshToken: rt } = res.data

      accessToken.value = at
      refreshToken.value = rt

      localStorage.setItem(ACCESS_TOKEN_KEY, at)
      localStorage.setItem(REFRESH_TOKEN_KEY, rt)

      return true
    } catch {
      return false
    }
  }

  return {
    // State
    accessToken, refreshToken, user, isInitialized, isLoading,
    // Computed
    isLoggedIn, role, isAdmin,
    // Actions
    initialize, login, register, logout, refreshTokens,
  }
})
```

## 附录 B: 前端 API 拦截器（带 Token 刷新）

```javascript
// src/api/index.js — V2 带 Auth 拦截器

import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

// 请求拦截器: 自动添加 Authorization header
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('go_home_access_token')
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// 响应拦截器: 401 自动尝试 refresh
let isRefreshing = false
let pendingRequests = []

apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      // 避免 refresh 请求本身触发递归
      if (originalRequest.url?.includes('/auth/refresh')) {
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // 如果有正在进行的 refresh 请求，等待它完成
        return new Promise((resolve) => {
          pendingRequests.push(() => resolve(apiClient(originalRequest)))
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const refreshToken = localStorage.getItem('go_home_refresh_token')
        const res = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken })
        const { accessToken, refreshToken: newRefreshToken } = res.data

        localStorage.setItem('go_home_access_token', accessToken)
        localStorage.setItem('go_home_refresh_token', newRefreshToken)

        // 重试所有等待的请求
        pendingRequests.forEach((cb) => cb())
        pendingRequests = []

        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`
        return apiClient(originalRequest)
      } catch (refreshError) {
        // Refresh 失败，强制登出
        pendingRequests = []
        localStorage.removeItem('go_home_access_token')
        localStorage.removeItem('go_home_refresh_token')
        localStorage.removeItem('go_home_user_info')

        // 跳转登录页
        window.location.href = '/login'

        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default apiClient
```

---

*文档结束*

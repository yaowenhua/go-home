# 返乡日记（go-home）V2 — 产品需求文档

> **版本**: v2.0  
> **日期**: 2026-07-05  
> **作者**: PM Team  
> **状态**: 初稿  
> **定位**: 在 V1（React → Vue 3 前端重写）基础上，新增用户系统、数据安全与管理能力

---

## 目录

1. [背景与版本关系](#1-背景与版本关系)
2. [功能点详细描述](#2-功能点详细描述)
   1. [用户注册与登录](#21-用户注册与登录)
   2. [数据隔离](#22-数据隔离)
   3. [后台管理](#23-后台管理)
   4. [内容加密](#24-内容加密)
   5. [用户访问统计](#25-用户访问统计)
3. [技术约束与方案建议](#3-技术约束与方案建议)
   1. [用户认证方案](#31-用户认证方案)
   2. [内容加密方案](#32-内容加密方案)
   3. [会话管理](#33-会话管理)
4. [优先级排序](#4-优先级排序)
5. [预估工作量](#5-预估工作量)
6. [新增API端点清单](#6-新增api端点清单)
7. [数据模型变更](#7-数据模型变更)
8. [前端变更概要](#8-前端变更概要)
9. [风险与注意事项](#9-风险与注意事项)

---

## 1. 背景与版本关系

### 1.1 版本演进图

```
V1（已上线）           →   V1.5 / "架构重写"（进行中）  →   V2（本需求）
React 18 + Express    →   Vue 3 + Express (同后端)    →   Vue 3 + Express
Zustand + React Router→   Pinia + Vue Router           →   + 用户系统 + 安全 + 管理
Device-ID 身份        →   Device-ID 身份               →   JWT 认证 + 数据隔离
明文存储              →   明文存储                      →   内容加密
无后台管理            →   无后台管理                     →   管理面板 + 统计
```

**重要说明**：当前 `architecture.md` 中标记的"v2.0"实际是 **前端框架重写**（React → Vue 3），**并非**本需求中定义的 V2。本 PRD 定义的是在 Vue 3 前端 + Express 后端之上新增的 **用户系统、安全与管理能力**。

### 1.2 当前系统现状（V1）

| 维度 | 现状 |
|------|------|
| **用户身份** | 无注册/登录，通过 `X-Device-Id` 头标识设备 |
| **用户表(users)** | `id, username, birth_date, life_expectancy, created_at, updated_at` — 无手机号、无密码 |
| **日记表(entries)** | `id, user_id, content, rating, category, tags, entry_date, created_at, updated_at` — 明文存储 |
| **数据隔离** | 无，任何 deviceId 可查任何用户数据 |
| **后台管理** | 无 |
| **认证机制** | 无 |
| **用户统计** | 无 |

---

## 2. 功能点详细描述

---

### 2.1 用户注册与登录

#### 2.1.1 产品描述

用户通过手机号完成注册和登录，系统支持完整的认证生命周期。

#### 2.1.2 功能清单

| # | 功能 | 说明 | 详细要求 |
|---|------|------|---------|
| F1.1 | 手机号注册 | 用户输入手机号 + 密码完成注册 | 手机号格式校验(11位数字)；密码强度要求(≥6位，含字母+数字)；注册后自动登录 |
| F1.2 | 手机号登录 | 已注册用户凭手机号+密码登录 | 登录成功后返回 JWT token；失败提示"手机号或密码错误"(不暴露具体哪个错) |
| F1.3 | 密码修改 | 已登录用户可修改密码 | 需验证旧密码；新旧密码不能相同；修改后重新登录 |
| F1.4 | 密码重置 | 忘记密码时通过短信验证码重置 | 输入手机号→发送验证码(60s倒计时)→验证码校验→设置新密码 |
| F1.5 | 登出 | 用户主动退出登录 | 前端清除 token；可选：后端将 token 加入黑名单 |
| F1.6 | Token 刷新 | 自动或手动刷新 access token | 使用 refresh token 机制；access token 有效期 24h，refresh token 7天 |

#### 2.1.3 交互流程

```
[引导页/首页] ──→ [登录页]
                     ├── 已有账号 → 输入手机号 + 密码 → 登录成功 → 跳转首页
                     └── 新用户   → 输入手机号 + 密码 → 注册成功 → 自动登录 → 跳转引导/首页

[设置页] ──→ [修改密码] → 输入旧密码 + 新密码 × 2 → 提交 → 重新登录

[登录页] ──→ [忘记密码] → 输入手机号 → 获取验证码 → 输入验证码 → 设置新密码 → 自动登录
```

#### 2.1.4 前端页面变更

| 页面 | 操作 |
|------|------|
| 新增 `Login.vue` | 登录/注册/忘记密码三合一页面 |
| 新增 `ForgetPassword.vue` | 忘记密码流程（或内嵌在 Login.vue 中） |
| 修改 `Onboarding.vue` | 引导页增加登录入口，未登录时提示登录 |
| 修改 `App.vue` | 全局路由守卫增加 auth 检查 |
| 修改 `NavBar.vue` | 未登录时导航项变化 |
| 修改 `Settings.vue` | 增加"修改密码"入口和"登出"按钮 |

---

### 2.2 数据隔离

#### 2.2.1 产品描述

每个注册用户只能看到和管理自己的日记数据，系统根据登录状态自动切换视图。

#### 2.2.2 功能清单

| # | 功能 | 说明 |
|---|------|------|
| F2.1 | 认证中间件 | 后端所有 `/api/entries/*` 和 `/api/users/profile` 请求必须携带有效的 JWT token |
| F2.2 | 用户级查询过滤 | 所有 entries 查询自动追加 `WHERE user_id = currentUserId` |
| F2.3 | 跨用户防越权 | API 层校验 `req.userId === entry.user_id`，拒绝越权访问 |
| F2.4 | 前端路由守卫 | 未登录用户只能访问登录/注册/引导页；已登录用户不能访问登录页 |
| F2.5 | 前端视图切换 | 登录前显示登录入口；登录后显示完整功能；登出后数据视图自动消失 |

#### 2.2.3 越权防护规则

| 操作 | 校验规则 |
|------|---------|
| 查询某日日记 | `GET /api/entries/by-date?date=xxx` → 后端追加 `AND user_id = token.userId` |
| 查询单条日记 | `GET /api/entries/:id` → 后端校验 `entry.user_id === token.userId` |
| 创建日记 | `POST /api/entries` → 后端用 `token.userId` 覆盖请求中的 `userId` |
| 更新日记 | `PUT /api/entries/:id` → 后端校验 `entry.user_id === token.userId` |
| 删除日记 | `DELETE /api/entries/:id` → 后端校验 `entry.user_id === token.userId` |
| 查询用户信息 | `GET /api/users/profile` → 返回 `token.userId` 对应用户的信息 |

---

### 2.3 后台管理

#### 2.3.1 产品描述

管理员可通过专用后台查看用户列表、用户基本信息，以及重置用户密码。

#### 2.3.2 功能清单

| # | 功能 | 说明 |
|---|------|------|
| F3.1 | 管理员登录 | 使用管理员账号（预设或普通账号提升为管理员）登录管理后台 |
| F3.2 | 用户列表 | 分页展示所有注册用户：手机号、注册时间、最后登录时间、日记数量、状态 |
| F3.3 | 用户搜索 | 按手机号模糊搜索用户 |
| F3.4 | 重置用户密码 | 管理员可将指定用户密码重置为随机密码（重置后用户需修改密码才能继续使用） |
| F3.5 | 用户状态管理 | 可选：禁用/启用用户账号（P2） |

#### 2.3.3 交互流程

```
[管理员登录] → [管理后台首页]
                ├── 用户列表表格（分页 + 搜索）
                │   ├── 每行: 手机号 | 注册时间 | 最后登录 | 日记数 | 操作
                │   │   └── 操作: [重置密码]
                │   │       └── 弹出确认框 → 确认 → 展示新密码（仅一次） → 用户下次登录需改密码
                │   └── 搜索框: 输入手机号 → 实时过滤
                └── 数据概览区域（可选）：总用户数、总日记数等
```

#### 2.3.4 前端页面

| 页面 | 操作 |
|------|------|
| 新增 `AdminLogin.vue` | 管理员登录（与普通登录保持统一或使用独立入口） |
| 新增 `AdminDashboard.vue` | 管理后台主页：用户列表 + 统计概览 |

**注意**: 管理后台为独立子应用或独立路由前缀（`/admin/*`），与普通用户路由完全隔离，避免混淆。

---

### 2.4 内容加密

#### 2.4.1 产品描述

用户日记内容在数据库中以密文存储，后端管理员即使直接查询数据库也无法读取明文。加解密过程在后端完成，使用用户密钥。

#### 2.4.2 功能清单

| # | 功能 | 说明 |
|---|------|------|
| F4.1 | 写入加密 | 用户创建/更新日记时，后端对 `content` 字段加密后存入 `entries` 表 |
| F4.2 | 读取解密 | 后端查询日记时，对 `content` 字段解密后返回给前端 |
| F4.3 | 密钥管理 | 每个用户使用独立密钥，密钥由用户密码派生 |
| F4.4 | 密码变更处理 | 用户修改密码后，原有日记内容使用新密钥重新加密 |
| F4.5 | 管理员重置密码影响 | 管理员重置密码后，已有加密日记**永久不可读**（需在产品中明确告知用户） |

#### 2.4.3 加密策略比选

| 方案 | 原理 | 优点 | 缺点 | 推荐 |
|-----|------|------|------|------|
| **A. 密码派生密钥** | `encryptionKey = KDF(password + salt)`，用该密钥 AES-256-GCM 加解密 content | 实现简单；管理员无法解密 | 改密码需重加密所有内容；密码重置会导致数据丢失 | ⭐**推荐** |
| **B. 用户主密钥 + 密码加密** | 生成随机主密钥 MK，用 `KDF(password)` 加密 MK；用 MK 加解密 content | 改密码只需重加密 MK（快） | 实现复杂；密码重置仍需丢弃主密钥 | ✅ 可选 |
| **C. 服务器主密钥 + 用户密钥** | 服务器持有主密钥 Ks；用户持有密码派生密钥 Ku；双重加密 `AES(Ks, AES(Ku, content))` | 管理员可恢复（用Ks解密） | 管理员有途径读取明文**不符合需求** | ❌ 不推荐 |

**推荐方案 A**：密码派生密钥（AES-256-GCM）

```
注册时:
  password → bcrypt(password) → password_hash (存入 users 表)
  password + user_salt → PBKDF2(password, salt, 100000) → encryption_key (不存储，每次登录派生)

写入时:
  AES-256-GCM.encrypt(content, encryption_key) → ciphertext + iv + authTag
  存储: encrypted_content = { ciphertext(hex), iv(hex), authTag(hex) }  → JSON string → content_encrypted 字段

读取时:
  content_encrypted → JSON.parse → { ciphertext, iv, authTag }
  AES-256-GCM.decrypt(ciphertext, encryption_key, iv, authTag) → plaintext

改密码时:
  用旧密码派生旧 key → 解密所有内容 → 用新密码派生新 key → 重新加密所有内容
```

#### 2.4.4 存储变更

| 字段 | 变更 |
|------|------|
| `entries.content` | **保留**（可选保留作为前端降级/搜索索引，V2初始可删除或置空） |
| `entries.content_encrypted` | **新增** TEXT，存储 JSON 格式的密文 `{ciphertext, iv, authTag}` |
| `users.content_salt` | **新增** TEXT，每个用户独立的加密盐值 |

**关键设计决策**: `content` 字段可保留明文用于搜索（如果未来需要全文搜索），但默认 V2 建议 **删除 content 字段，仅保留 content_encrypted**。如需搜索功能，可后期引入 FTS5 索引或加密搜索方案。

---

### 2.5 用户访问统计

#### 2.5.1 产品描述

平台自动记录用户访问行为，支持日活(DAU)、周活(WAU)、月活(MAU)统计，在管理后台以图表或数据形式展示。

#### 2.5.2 功能清单

| # | 功能 | 说明 |
|---|------|------|
| F5.1 | 行为埋点 | 用户每次访问 API 时自动记录活动日志 |
| F5.2 | DAU 统计 | 过去24小时内活跃的不同用户数 |
| F5.3 | WAU 统计 | 过去7天内活跃的不同用户数 |
| F5.4 | MAU 统计 | 过去30天内活跃的不同用户数 |
| F5.5 | 趋势数据 | 过去30天的 DAU 趋势（日期+DAU 值列表） |
| F5.6 | 后台展示 | 管理后台展示统计卡片 + 趋势折线图 |

#### 2.5.3 埋点策略

| 事件类型 | 触发条件 | 频控策略 |
|---------|---------|---------|
| `page_view` | 前端页面切换（路由变化） | 同一用户同一页面 5min 内不重复记录 |
| `api_call` | 后端 API 请求 | 使用中间件统一记录，同一用户 1min 内仅首次记录 |
| `entry_create` | 创建日记 | 实时记录 |
| `entry_update` | 更新日记 | 实时记录 |
| `login` | 用户登录成功 | 实时记录 |
| `register` | 用户注册成功 | 实时记录 |

#### 2.5.4 统计口径

| 指标 | 定义 | SQL 示例 |
|------|------|---------|
| DAU | 当日 00:00:00 ~ 23:59:59 有活动的不同用户数 | `SELECT COUNT(DISTINCT user_id) FROM activity_log WHERE date = TODAY` |
| WAU | 过去 7 天有活动的不重复用户数 | `SELECT COUNT(DISTINCT user_id) FROM activity_log WHERE date >= DATE('now', '-7 days')` |
| MAU | 过去 30 天有活动的不重复用户数 | `SELECT COUNT(DISTINCT user_id) FROM activity_log WHERE date >= DATE('now', '-30 days')` |

#### 2.5.5 前端展示

在管理后台 `AdminDashboard.vue` 中:

```
┌──────────────────────────────────────────┐
│  📊 数据概览                              │
│  ┌────────┐ ┌────────┐ ┌────────┐        │
│  │  DAU   │ │  WAU   │ │  MAU   │        │
│  │  128   │ │  563   │ │  1,892 │        │
│  └────────┘ └────────┘ └────────┘        │
│                                           │
│  近30天 DAU 趋势                           │
│  ╱╲  ╱╲                                   │
│ ╱  ╲╱  ╲╱ ╲                               │
│ 01 05 10 15 20 25 30                      │
└──────────────────────────────────────────┘
```

**前端统计图表实现建议**:
- 轻量方案: 使用 Canvas 自绘或纯 CSS 图表
- 推荐库（如需）: Chart.js（轻量、2KB gzip）或 ECharts（功能丰富）
- 若不引入图表库: 使用 SVG 或 canvas 手动绘制简单折线图

---

## 3. 技术约束与方案建议

### 3.1 用户认证方案

#### 3.1.1 推荐方案: JWT (JSON Web Token)

| 项目 | 值 |
|------|-----|
| 认证方式 | JWT (Access Token + Refresh Token) |
| Token 存储 | Access Token 存内存/`localStorage`；Refresh Token 存 `localStorage`（或 `httpOnly Cookie`） |
| Access Token 有效期 | 24 小时 |
| Refresh Token 有效期 | 7 天 |
| 密码哈希 | bcrypt (salt rounds = 12) |
| 密钥轮换 | 每次登录生成新的 Refresh Token；旧 Refresh Token 失效 |

#### 3.1.2 JWT Payload 结构

```json
{
  "userId": "abc123",
  "phone": "13800138000",
  "role": "user",           // "user" | "admin"
  "iat": 1688888888,
  "exp": 1688975288
}
```

#### 3.1.3 新增依赖

```json
{
  "dependencies": {
    "jsonwebtoken": "^9.x",
    "bcrypt": "^5.x"          // 或 bcryptjs (纯JS，无原生依赖)
  }
}
```

**生产建议**: 使用 `bcryptjs`（纯 JavaScript 实现）避免原生编译问题；如性能敏感使用 `bcrypt`。

### 3.2 内容加密方案

#### 3.2.1 推荐方案: AES-256-GCM + PBKDF2 密码派生

| 项目 | 值 |
|------|-----|
| 加密算法 | AES-256-GCM（提供认证加密） |
| 密钥派生 | PBKDF2-HMAC-SHA256，迭代 100,000 次 |
| IV 长度 | 12 bytes（96 bits） |
| Auth Tag 长度 | 16 bytes（128 bits） |
| 每个用户独立盐值 | 16 bytes，存储在 `users.content_salt` |

#### 3.2.2 加密流程（伪代码）

```javascript
// 注册时
const contentSalt = crypto.randomBytes(16).toString('hex')
const encryptionKey = crypto.pbkdf2Sync(password, contentSalt, 100000, 32, 'sha256')
// encryptionKey 不存储，每次登录后从密码派生存入会话

// 登录后（服务端派生 encryptionKey 存入 req.encryptionKey）
const encryptionKey = crypto.pbkdf2Sync(
  req.body.password,
  user.content_salt,
  100000,
  32,
  'sha256'
)

// 写入日记时
function encryptContent(plaintext, encryptionKey) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  return JSON.stringify({ c: encrypted, i: iv.toString('hex'), t: authTag })
}

// 读取日记时
function decryptContent(encryptedStr, encryptionKey) {
  const { c, i, t } = JSON.parse(encryptedStr)
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(i, 'hex'))
  decipher.setAuthTag(Buffer.from(t, 'hex'))
  let decrypted = decipher.update(c, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
```

#### 3.2.3 加密密钥的缓存

为避免每次请求都重新派生密钥（PBKDF2 100k 次迭代需约 50-100ms），采用以下策略：

```javascript
// 方案：登录时将 encryptionKey 加密存入临时存储，后续请求通过解密恢复
// 简化方案：使用一个内存 Map（单进程）或 Redis（多进程）

const keyCache = new Map()  // key: userId, value: { key: Buffer, expiresAt }
const CACHE_TTL = 4 * 60 * 60 * 1000  // 4小时

function getEncryptionKey(userId, password, contentSalt) {
  const cached = keyCache.get(userId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.key
  }
  const key = crypto.pbkdf2Sync(password, contentSalt, 100000, 32, 'sha256')
  keyCache.set(userId, { key, expiresAt: Date.now() + CACHE_TTL })
  return key
}
```

**安全提示**: 
- 生产环境应使用 Redis（带 TTL）替代内存 Map
- 多进程/多实例部署需共享加密密钥缓存
- 登录后前端不传输明文密码给加密函数 —— 整个流程在后端完成

#### 3.2.4 密码修改时的重加密策略

```javascript
async function changePassword(userId, oldPassword, newPassword) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  
  // 1. 用旧密码派生旧密钥
  const oldKey = crypto.pbkdf2Sync(oldPassword, user.content_salt, 100000, 32, 'sha256')
  
  // 2. 读取所有加密日记并解密
  const entries = db.prepare('SELECT id, content_encrypted FROM entries WHERE user_id = ?').all(userId)
  const decrypted = entries.map(e => ({
    id: e.id,
    content: decryptContent(e.content_encrypted, oldKey)
  }))
  
  // 3. 更新用户密码（生成新的 salt 和 password_hash）
  const newSalt = crypto.randomBytes(16).toString('hex')
  const newKey = crypto.pbkdf2Sync(newPassword, newSalt, 100000, 32, 'sha256')
  const newHash = bcrypt.hashSync(newPassword, 12)
  
  // 4. 用新密钥重新加密所有日记
  const updateStmt = db.prepare('UPDATE entries SET content_encrypted = ? WHERE id = ?')
  const tx = db.transaction(() => {
    for (const e of decrypted) {
      const newEncrypted = encryptContent(e.content, newKey)
      updateStmt.run(newEncrypted, e.id)
    }
    db.prepare('UPDATE users SET password_hash = ?, content_salt = ? WHERE id = ?')
      .run(newHash, newSalt, userId)
  })
  tx()
}
```

### 3.3 会话管理

| 场景 | 策略 |
|------|------|
| 登录 | 返回 `{ accessToken, refreshToken, expiresIn }` |
| 每次请求 | 前端在 `Authorization: Bearer <accessToken>` 头中携带 token |
| Token 过期 | 前端 401 拦截 → 使用 refreshToken 获取新 accessToken |
| RefreshToken 过期 | 重定向到登录页 |
| 登出 | 前端清除所有 token |
| 多设备登录 | 允许多设备（每个设备独立 refreshToken） |
| 密码修改 | 使该用户所有 refreshToken 失效 |

---

## 4. 优先级排序

### 4.1 优先级矩阵

| 优先级 | 功能 | 依赖 | 理由 |
|--------|------|------|------|
| **P0** | 用户注册与登录 | 无 | 一切的基础，所有其他功能依赖用户身份 |
| **P0** | 数据隔离 | P0-用户系统 | 无数据隔离则多用户无意义 |
| **P1** | 内容加密 | P0-用户系统 | 核心安全需求；v2 发布前必须完成 |
| **P1** | 后台管理（基础版） | P0-用户系统 | 仅支持用户列表 + 密码重置 |
| **P2** | 后台管理（增强版） | P1-基础版 | 用户禁用、导出等增强功能 |
| **P1** | 用户访问统计 | P0-用户系统 | 需从头开始记录活动数据 |
| **P2** | 统计图表增强 | P1-基础统计 | 趋势图、导出报表等 |

### 4.2 建议迭代顺序

```
Sprint 1 (P0) ──── 用户注册/登录 + 数据库迁移 + JWT 中间件
Sprint 2 (P0) ──── 数据隔离 + 前端路由守卫 + 视图切换
Sprint 3 (P1) ──── 内容加密（核心加密/解密 + 流程测试）
Sprint 4 (P1) ──── 后台管理（用户列表 + 密码重置）+ 管理前端
Sprint 5 (P1) ──── 用户访问统计（埋点 + DAU/WAU/MAU）
Sprint 6 (P2) ──── 统计图表增强 + 管理员功能增强 + 集成测试
```

---

## 5. 预估工作量

### 5.1 按功能模块分解

| 模块 | 后端 | 前端 | 测试 | 合计(人天) |
|------|------|------|------|-----------|
| 用户注册与登录 | 3 | 2 | 1 | **6** |
| 数据隔离 | 1.5 | 1.5 | 0.5 | **3.5** |
| 内容加密 | 3 | — | 1 | **4** |
| 后台管理 | 2 | 2 | 1 | **5** |
| 用户访问统计 | 2 | 1 | 0.5 | **3.5** |
| 数据迁移与兼容 | 1 | — | 0.5 | **1.5** |
| 联调与回归测试 | — | — | 2 | **2** |
| **合计** | **12.5** | **6.5** | **6.5** | **~25.5** |

### 5.2 按角色分解

| 角色 | 人天 | 备注 |
|------|------|------|
| 后端开发（1人） | 12.5 | Express + SQLite + 加密模块 |
| 前端开发（1人） | 6.5 | Vue 3 + Pinia + 路由改造 |
| 测试（1人） | 6.5 | 功能测试 + 安全测试 + 回归 |
| **总工期（并行）** | **~13-15个工作日** | 约 3 周 |

### 5.3 风险缓冲

| 风险项 | 缓冲天数 | 应对策略 |
|--------|---------|---------|
| 加密模块开发调试 | +2 | 优先调研 Node.js crypto API |
| JWT 与 Refresh Token 流程 | +1 | 参考成熟方案（如 auth0 模式） |
| 管理后台 UI 开发 | +1 | 使用现有组件库，复用已有样式 |
| 密码变更重加密大规模数据 | +1 | 异步任务处理，避免请求超时 |
| **总风险缓冲** | **+5** | |

---

## 6. 新增 API 端点清单

### 6.1 认证相关

| 方法 | 路径 | 说明 | 请求体 | 响应 | 优先级 |
|------|------|------|--------|------|--------|
| `POST` | `/api/auth/register` | 手机号注册 | `{ phone, password }` | `{ accessToken, refreshToken, user }` | P0 |
| `POST` | `/api/auth/login` | 手机号登录 | `{ phone, password }` | `{ accessToken, refreshToken, user }` | P0 |
| `POST` | `/api/auth/logout` | 登出 | (Header: Bearer Token) | `{ success: true }` | P0 |
| `POST` | `/api/auth/refresh` | 刷新 Token | `{ refreshToken }` | `{ accessToken, refreshToken }` | P0 |
| `POST` | `/api/auth/change-password` | 修改密码(已登录) | `{ oldPassword, newPassword }` | `{ success: true }` | P0 |
| `POST` | `/api/auth/send-code` | 发送短信验证码 | `{ phone }` | `{ success: true }` | P1 |
| `POST` | `/api/auth/reset-password` | 验证码+重置密码 | `{ phone, code, newPassword }` | `{ accessToken, refreshToken }` | P1 |

**注意**: 短信验证码为 P1 功能，前期可使用固定验证码（如 `888888`）进行开发和测试，在生产环境接入短信服务（阿里云/腾讯云 SMS）。

### 6.2 用户相关（V2 扩展）

| 方法 | 路径 | 说明 | 请求体/参数 | 优先级 |
|------|------|------|-------------|--------|
| `GET` | `/api/users/me` | 获取当前登录用户信息 | (从 token 获取 userId) | P0 |
| `PUT` | `/api/users/me` | 更新当前用户信息 | `{ name, birthDate, lifeExpectancy }` | P0 |

### 6.3 管理后台

| 方法 | 路径 | 说明 | 权限 | 优先级 |
|------|------|------|------|--------|
| `GET` | `/api/admin/users` | 用户列表（分页+搜索） | admin | P1 |
| `GET` | `/api/admin/users/:id` | 用户详情 | admin | P1 |
| `POST` | `/api/admin/users/:id/reset-password` | 重置指定用户密码 | admin | P1 |
| `PUT` | `/api/admin/users/:id/status` | 启用/禁用用户 | admin | P2 |
| `GET` | `/api/admin/stats` | 统计概览（总用户数、总日记数） | admin | P1 |

### 6.4 统计分析

| 方法 | 路径 | 说明 | 权限 | 优先级 |
|------|------|------|------|--------|
| `GET` | `/api/stats/dau` | 当日 DAU | admin | P1 |
| `GET` | `/api/stats/wau` | 本周 WAU | admin | P1 |
| `GET` | `/api/stats/mau` | 本月 MAU | admin | P1 |
| `GET` | `/api/stats/dau-trend` | 近30天 DAU 趋势 | admin | P1 |
| `GET` | `/api/stats/summary` | 管理后台统计总览 | admin | P1 |

### 6.5 现有端点修改

| 端点 | 修改内容 | 影响范围 |
|------|---------|---------|
| `GET /api/entries/by-date` | 追加 `WHERE user_id = ?` | **彻底变更**（原返回所有用户数据） |
| `GET /api/entries` | 追加 `WHERE user_id = ?` | **彻底变更** |
| `POST /api/entries` | `userId` 强制使用 `token.userId` | 行为变更（忽略请求中的 userId） |
| `PUT /api/entries/:id` | 校验 `entry.user_id === token.userId` | 新加校验 |
| `DELETE /api/entries/:id` | 校验 `entry.user_id === token.userId` | 新加校验 |
| `PUT /api/users/profile` | 改为仅允许当前用户修改自己的信息 | 行为变更 |
| `GET /api/users/profile` | 改为返回当前用户信息（从 token 获取） | 行为变更 |

---

## 7. 数据模型变更

### 7.1 users 表扩展

```sql
-- V2: users 表完整定义
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                    -- 不变，nanoid
  username TEXT UNIQUE NOT NULL,           -- 不变（可用于昵称）
  phone TEXT UNIQUE NOT NULL,              -- 【新增】手机号（登录凭证）
  password_hash TEXT NOT NULL,             -- 【新增】bcrypt 密码哈希
  content_salt TEXT NOT NULL,              -- 【新增】加密盐值（16 bytes hex）
  role TEXT NOT NULL DEFAULT 'user',       -- 【新增】角色: 'user' | 'admin'
  status TEXT NOT NULL DEFAULT 'active',   -- 【新增】状态: 'active' | 'disabled'
  last_login_at TEXT,                      -- 【新增】最后登录时间
  birth_date TEXT NOT NULL,                -- 不变
  life_expectancy INTEGER DEFAULT 80,      -- 不变
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 新增索引
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
```

### 7.2 entries 表扩展

```sql
-- V2: entries 表修改
-- 【新增字段】
ALTER TABLE entries ADD COLUMN content_encrypted TEXT;
-- 存储在 content_encrypted 中的 JSON 结构:
-- {"c": "hex_ciphertext", "i": "hex_iv", "t": "hex_authTag"}

-- 可选：后续删除 content 字段（v2 迁移完成后）
-- ALTER TABLE entries DROP COLUMN content;
```

**注意**: 由于 SQLite 不支持直接删除列（ALTER TABLE DROP COLUMN 在 SQLite 3.35.0+ 支持），V2 初期暂不删除 `content` 字段，仅添加 `content_encrypted`。等所有数据迁移完成后，再执行清理。

### 7.3 新增表: activity_log

```sql
-- V2: 用户活动日志
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,                   -- 用户 ID（关联 users.id）
  event_type TEXT NOT NULL,                -- 事件类型: 'page_view' | 'api_call' | 'login' | 'register' | 'entry_create' | 'entry_update'
  ip_address TEXT,                         -- 请求 IP
  user_agent TEXT,                         -- User-Agent
  metadata TEXT,                           -- 额外信息（JSON，如：{"path": "/", "entry_id": "xxx"}）
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_event_type ON activity_log(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_date ON activity_log(date(created_at));
```

### 7.4 新增表: refresh_tokens

```sql
-- V2: Refresh Token 管理
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,                   -- 用户 ID
  token_hash TEXT NOT NULL,                -- Refresh Token 的 SHA256 哈希
  device_info TEXT,                        -- 设备信息（可选）
  expires_at TEXT NOT NULL,                -- 过期时间
  revoked INTEGER DEFAULT 0,               -- 是否已撤销
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
```

### 7.5 新增表: sms_codes（P1）

```sql
-- V2: 短信验证码（P1功能，MVP阶段可用固定验证码替代）
CREATE TABLE IF NOT EXISTS sms_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,                     -- 手机号
  code TEXT NOT NULL,                      -- 验证码
  purpose TEXT NOT NULL DEFAULT 'reset',   -- 用途: 'register' | 'reset'
  expires_at TEXT NOT NULL,                -- 过期时间（发送后5分钟）
  used INTEGER DEFAULT 0,                  -- 是否已使用
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_sms_codes_phone ON sms_codes(phone);
```

### 7.6 数据模型变更汇总

| 表 | 操作 | 说明 |
|----|------|------|
| `users` | **修改** | 新增 `phone`, `password_hash`, `content_salt`, `role`, `status`, `last_login_at` |
| `entries` | **修改** | 新增 `content_encrypted` |
| `activity_log` | **新增** | 用户活动日志 |
| `refresh_tokens` | **新增** | Refresh Token 管理 |
| `sms_codes` | **新增** | 短信验证码（P1） |

### 7.7 数据库清理任务（数据迁移）

V1 → V2 需要处理的存量数据：

| 任务 | 说明 | 迁移策略 |
|------|------|---------|
| 用户迁移 | V1 用户（device-based）需注册账号 | **不迁移**，旧用户需重新注册。旧数据可通过 admin 工具导入 |
| 旧 entries | V1 entries 中 `user_id` 为 deviceId，V2 需关联到新用户 | 在迁移工具中按用户手动关联 |
| entries 加密 | 旧 entries 的 `content` 为明文，需加密后填入 `content_encrypted` | 运行迁移脚本：遍历所有用户，用用户密钥加密 `content` 写入 `content_encrypted` |
| 清理旧表 | 确认迁移完成后清理冗余字段 | V2 稳定后，删除 `entries.content` 字段 |

---

## 8. 前端变更概要

### 8.1 新增文件

| 文件 | 用途 |
|------|------|
| `src/views/Login.vue` | 登录/注册/忘记密码三合一页面 |
| `src/views/AdminLogin.vue` | 管理后台登录页面（与普通登录可共用组件） |
| `src/views/AdminDashboard.vue` | 管理后台主页（用户列表 + 统计展示） |
| `src/api/auth.js` | 认证相关 API（login, register, logout, refresh, changePassword, resetPassword） |
| `src/api/admin.js` | 管理后台 API（user list, reset password, stats） |
| `src/api/stats.js` | 统计 API（dau, wau, mau, trend） |
| `src/stores/auth.js` | Pinia auth store（token 管理 + 登录状态） |

### 8.2 修改文件

| 文件 | 变更内容 |
|------|---------|
| `src/main.js` | 引入 auth store，初始化时检查 token |
| `src/App.vue` | 全局 auth 状态监听，未登录时显示登录页 |
| `src/router/index.js` | 新增 Login 路由、Admin 路由；导航守卫增加 auth 检查 |
| `src/api/index.js` | 拦截器增加 `Authorization` 头；401 响应自动尝试 refresh |
| `src/api/entries.js` | 移除 `userId` 参数（从 token 获取） |
| `src/api/user.js` | 改用 `/api/users/me` |
| `src/stores/app.js` | 移除 deviceId 逻辑；状态初始化改为从服务端获取 |
| `src/views/Settings.vue` | 增加 "修改密码"、"登出"、"账号信息显示"、"退出登录清除本地数据" |
| `src/views/Onboarding.vue` | 登录/注册入口 |
| `src/components/NavBar.vue` | 未登录隐藏，或显示登录入口 |

### 8.3 前端认证流程

```
应用启动
  │
  ├── localStorage 中有 accessToken?
  │   ├── 是 → 尝试验证 token (调用 /api/users/me)
  │   │     ├── 成功 → authStore.isLoggedIn = true → 正常显示
  │   │     └── 失败(401) → 尝试 refreshToken
  │   │           ├── 成功 → 更新 accessToken → 正常显示
  │   │           └── 失败 → 清除 tokens → 显示登录页
  │   └── 否 → 显示登录页
  │
  └── 用户操作期间:
        └── Axios 拦截器 401 → 尝试 refresh → 成功后重试原请求
```

### 8.4 API 拦截器变更

```javascript
// src/api/index.js - 新增 auth 拦截器
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('go_home_access_token')
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// 401 响应时尝试 refresh token
let isRefreshing = false
let pendingRequests = []

apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingRequests.push(() => resolve(apiClient(originalRequest)))
        })
      }
      
      originalRequest._retry = true
      isRefreshing = true
      
      try {
        const refreshToken = localStorage.getItem('go_home_refresh_token')
        const res = await axios.post('/api/auth/refresh', { refreshToken })
        localStorage.setItem('go_home_access_token', res.data.accessToken)
        localStorage.setItem('go_home_refresh_token', res.data.refreshToken)
        
        pendingRequests.forEach(cb => cb())
        pendingRequests = []
        
        originalRequest.headers['Authorization'] = `Bearer ${res.data.accessToken}`
        return apiClient(originalRequest)
      } catch {
        // Refresh failed - redirect to login
        localStorage.removeItem('go_home_access_token')
        localStorage.removeItem('go_home_refresh_token')
        window.location.href = '/login'
        return Promise.reject(error)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)
```

---

## 9. 风险与注意事项

### 9.1 安全风险

| 风险 | 说明 | 缓解措施 |
|------|------|---------|
| Token 泄露 | JWT 泄露后攻击者可模拟用户 | AccessToken 24h 过期；使用 refreshToken 轮换；HTTPS 传输 |
| 密码爆破 | 暴力破解用户密码 | bcrypt(12) 减慢攻击速度；登录失败频控（5次/分钟/手机号） |
| SQL 注入 | 参数拼接导致数据泄露 | 使用 prepared statements（已通过 better-sqlite3 实现） |
| XSS | 前端存储 token 被窃取 | 前端渲染时转义用户内容；避免直接 innerHTML |
| 重放攻击 | 捕获请求后重放 | JWT 含 iat 和 exp；HTTPS 传输 |

### 9.2 产品决策

| 决策 | 选项 | 推荐 | 理由 |
|------|------|------|------|
| 短信验证码 | 总是发送 vs 测试阶段固定 | 固定验证码 `888888`（开发期） | 降低开发复杂度，上线前接入阿里云 SMS/腾讯云 SMS |
| 加密密钥派生时机 | 登录时 vs 每请求 | 登录时派生+缓存 | PBKDF2 100k 次迭代约 50-100ms，每请求派生不可接受 |
| 历史数据加密 | 上线即加密 vs 按需加密 | 上线脚本一次性加密所有存量数据 | 避免新旧数据不一致 |
| 后端 session 状态 | 无状态（JWT）vs 有状态（Session） | JWT 无状态 | 架构简单，水平扩展友好 |
| 管理后台独立部署 | 子路由 vs 独立项目 | 子路由 `/admin/*` | 避免重复构建，共享组件库 |

### 9.3 技术债务

| 项 | 说明 | 计划处理时机 |
|----|------|-------------|
| `entries.content` 字段废弃 | V2 中 content 仅做备份，逻辑使用 `content_encrypted` | V3 数据清理阶段 |
| 短信服务接入 | 开发期使用固定验证码，无真实短信能力 | V2 正式上线前 |
| 加密密钥缓存 | 内存 Map 在重启后丢失，多实例不共享 | V2 多实例部署时引入 Redis |
| 密码修改重加密 | 用户数据量大时可能超时 | V2 后期改为后台异步任务 |

### 9.4 与现有架构文档（architecture.md）的衔接

当前 `architecture.md` 描述的是 **前端从 React 重写为 Vue 3** 的架构设计。V2 需求实施时需注意：

1. **路由扩展**: 在 Vue Router 现有路由表上新增 `/login`, `/admin/*` 路由
2. **Store 扩展**: 现有 `useAppStore` 保留，新增 `useAuthStore` 专门管理认证状态
3. **API 层扩展**: 现有 `api/user.js`, `api/entries.js` 保持不变，新增 `api/auth.js`, `api/admin.js`
4. **导航守卫增强**: 现有 `beforeEach` 逻辑增加 `requiresAuth` 和 `requiresAdmin` 判断

---

## 附录 A: 数据库迁移脚本参考

### A.1 V1 → V2 迁移脚本（seed/migrate.js）

```javascript
const Database = require('better-sqlite3')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const path = require('path')

const DB_PATH = path.join(__dirname, '..', 'data', 'return-home.db')
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

// 1. 创建新表结构
db.exec(`
  -- activity_log 表
  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  -- refresh_tokens 表
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    device_info TEXT,
    expires_at TEXT NOT NULL,
    revoked INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  -- sms_codes 表
  CREATE TABLE IF NOT EXISTS sms_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    code TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'reset',
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  -- users 表增加字段（SQLite ALTER TABLE 添加列）
  ALTER TABLE users ADD COLUMN phone TEXT;
  ALTER TABLE users ADD COLUMN password_hash TEXT;
  ALTER TABLE users ADD COLUMN content_salt TEXT;
  ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
  ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
  ALTER TABLE users ADD COLUMN last_login_at TEXT;

  -- entries 表增加字段
  ALTER TABLE entries ADD COLUMN content_encrypted TEXT;
`)

// 2. 创建管理员账号（如果不存在）
const adminPhone = process.env.ADMIN_PHONE || '13800000000'
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123'
const existingAdmin = db.prepare('SELECT id FROM users WHERE phone = ?').get(adminPhone)

if (!existingAdmin) {
  const { nanoid } = require('nanoid')
  const adminId = nanoid()
  const adminHash = bcrypt.hashSync(adminPassword, 12)
  const adminSalt = crypto.randomBytes(16).toString('hex')
  
  db.prepare(`INSERT OR IGNORE INTO users (id, username, phone, password_hash, content_salt, role, birth_date, created_at)
    VALUES (?, '管理员', ?, ?, ?, 'admin', '2000-01-01', datetime('now', 'localtime'))`)
    .run(adminId, adminPhone, adminHash, adminSalt)
  console.log(`[Migrate] Admin user created: ${adminPhone}`)
}

// 3. 创建索引
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
  CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
  CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);
  CREATE INDEX IF NOT EXISTS idx_activity_log_date ON activity_log(date(created_at));
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
  CREATE INDEX IF NOT EXISTS idx_sms_codes_phone ON sms_codes(phone);
`)

console.log('[Migrate] V2 migration completed successfully')
```

---

## 附录 B: 环境变量

```bash
# .env (backend)
PORT=3000
JWT_SECRET=your-256-bit-secret-key
JWT_ACCESS_EXPIRES=24h
JWT_REFRESH_EXPIRES=7d
ADMIN_PHONE=13800000000
ADMIN_PASSWORD=Admin123
DB_PATH=./data/return-home.db

# SMS (production only)
SMS_PROVIDER=aliyun       # aliyun | tencent
SMS_ACCESS_KEY=xxx
SMS_SECRET_KEY=xxx
SMS_SIGN_NAME=返乡日记
SMS_TEMPLATE_CODE=SMS_123456

# 开发环境固定验证码
DEV_SMS_CODE=888888
```

---

*文档结束*

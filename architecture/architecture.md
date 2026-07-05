# 返乡日记（go-home）— 前端架构设计文档

> **版本**: v2.0  
> **日期**: 2026-07-05  
> **作者**: Architect Team  
> **状态**: 初稿  
> **定位**: React → Vue 3 前端重写，后端不变

---

## 目录

1. [技术栈](#1-技术栈)
2. [项目结构](#2-项目结构)
3. [路由设计（Vue Router）](#3-路由设计vue-router)
4. [Pinia Store 设计](#4-pinia-store-设计)
5. [API 层设计](#5-api-层设计)
6. [Composables 组合式函数](#6-composables-组合式函数)
7. [组件树与设计](#7-组件树与设计)
8. [样式方案（CSS Modules）](#8-样式方案css-modules)
9. [后端 API 清单](#9-后端-api-清单)
10. [离线存储策略](#10-离线存储策略)
11. [数据流图](#11-数据流图)
12. [从 V1 到 V2 的关键变化对照](#12-从-v1-到-v2-的关键变化对照)

---

## 1. 技术栈

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| **前端框架** | Vue | 3.x | Composition API + `<script setup>` |
| **构建工具** | Vite | 5.x | 快速开发服务器 + 生产构建 |
| **路由** | Vue Router | 4.x | SPA 路由 + 页面过渡动画 |
| **状态管理** | Pinia | 2.x | 替代 Zustand，全局状态管理 |
| **HTTP 客户端** | Axios | 1.x | API 请求封装，拦截器统一处理 |
| **日期处理** | dayjs | 1.x | **保留**，与 V1 一致 |
| **样式方案** | CSS Modules | — | `.module.css`，保持与 V1 一致，不引入 Tailwind |
| **离线缓存** | localStorage | 原生 | Offline-First 数据持久化 |

### 1.1 与 V1 的技术对比

| 维度 | V1（React） | V2（Vue 3） |
|------|-------------|-------------|
| 框架 | React 18 + JSX | Vue 3 + `<script setup>` SFC |
| 构建 | Vite 5 | Vite 5（不变） |
| 路由 | React Router 6 | Vue Router 4 |
| 状态管理 | Zustand | Pinia (Composition API style) |
| HTTP | Axios | Axios（不变） |
| 样式 | CSS Modules | CSS Modules（不变） |
| 日期 | dayjs | dayjs（不变） |
| 自定义 Hook | `useCountdown` ✗ | `useCountdown` composable ✅ |

### 1.2 package.json 关键依赖

```json
{
  "dependencies": {
    "vue": "^3.4",
    "vue-router": "^4.3",
    "pinia": "^2.1",
    "axios": "^1.6",
    "dayjs": "^1.11"
  },
  "devDependencies": {
    "vite": "^5.0",
    "@vitejs/plugin-vue": "^5.0"
  }
}
```

---

## 2. 项目结构

### 2.1 完整目录树

```
go-home/
└── frontend/
    ├── index.html                          # HTML 入口
    ├── vite.config.js                      # Vite 配置
    ├── package.json                        # 依赖管理
    │
    └── src/
        ├── main.js                         # Vue 应用入口（createApp + use + mount）
        ├── App.vue                         # 根组件（<RouterView> + 动画过渡 + 全局守卫）
        │
        ├── router/
        │   └── index.js                    # 路由定义 + 导航守卫
        │
        ├── stores/
        │   ├── app.js                      # 全局 Store：用户 + 记录 + UI 状态
        │   └── tag.js                      # 标签 Store
        │
        ├── api/
        │   ├── index.js                    # Axios 实例 + 拦截器 + DeviceID 管理
        │   ├── localStore.js               # 离线存储层（localStorage CRUD + Sync Queue）
        │   ├── user.js                     # 用户 API
        │   └── entries.js                  # 记录 API
        │
        ├── composables/
        │   ├── useCountdown.js             # 倒计时计算（每60秒刷新）
        │   ├── useOfflineSync.js           # 离线队列同步
        │   └── useNetworkStatus.js         # 网络状态监测
        │
        ├── views/
        │   ├── Onboarding.vue              # 引导页 /onboarding
        │   ├── Home.vue                    # 首页 /（倒计时 + 记录）
        │   ├── History.vue                 # 历史页 /history（日历 + 浏览）
        │   └── Settings.vue                # 设置页 /settings
        │
        ├── components/
        │   ├── NavBar.vue                  # 底部标签导航栏
        │   ├── ProgressBar.vue             # 人生进度条
        │   ├── EntryCard.vue               # 单条记录卡片
        │   ├── EntryForm.vue               # 记录输入表单
        │   └── StarRating.vue              # 星级评分选择器
        │
        └── styles/
            ├── variables.css               # CSS 变量（颜色、间距、字体、阴影等）
            └── global.css                  # 全局样式重置 + 动画定义
```

### 2.2 目录结构说明

| 目录/文件 | 职责 | 备注 |
|-----------|------|------|
| `router/` | 路由定义 & 导航守卫 | 懒加载 views，守卫判断是否已引导 |
| `stores/` | Pinia 状态管理 | Composition API 风格 |
| `api/` | 网络请求 + 离线存储 | 拆分为 `index.js`（实例）+ `user.js`/`entries.js`（业务）+ `localStore.js`（本地） |
| `composables/` | 可复用组合式函数 | 替代 React Hooks |
| `views/` | 页面级组件 | 对应路由，扁平命名无 `View` 后缀 |
| `components/` | 通用 UI 组件 | 无嵌套子目录，扁平管理 |
| `styles/` | 全局 CSS | `variables.css` + `global.css`，与 V1 一致 |

---

## 3. 路由设计（Vue Router）

### 3.1 路由表

```javascript
// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/onboarding',
    name: 'Onboarding',
    component: () => import('../views/Onboarding.vue'),
    meta: { requiresAuth: false },    // 无需引导
  },
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    meta: { requiresAuth: true },    // 已引导才能访问
  },
  {
    path: '/history',
    name: 'History',
    component: () => import('../views/History.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]
```

### 3.2 导航守卫

```javascript
// src/router/index.js
router.beforeEach((to, from, next) => {
  const store = useAppStore()
  
  if (!store.isHydrated) {
    // 等待 store 从 localStorage 恢复完毕（首次挂载时 checkOnboarding 尚未完成）
    store.checkOnboarding()
  }

  if (to.meta.requiresAuth && !store.isOnboarded) {
    next({ name: 'Onboarding' })
  } else if (to.name === 'Onboarding' && store.isOnboarded) {
    next({ name: 'Home' })
  } else {
    next()
  }
})
```

### 3.3 路由过渡动画

在 `App.vue` 中使用 Vue 的 `<Transition>` 包裹 `<RouterView>`：

```vue
<!-- App.vue -->
<router-view v-slot="{ Component, route }">
  <transition :name="route.meta.transition || 'fade'" mode="out-in">
    <component :is="Component" :key="route.path" />
  </transition>
</router-view>
```

**过渡动画定义**（位于 `global.css`）：
- `.fade-enter-active / .fade-leave-active` — 默认淡入淡出
- `.slide-left-enter-active / .slide-left-leave-active` — 历史/设置页左滑
- `.slide-up-enter-active / .slide-up-leave-active` — 引导页上滑

---

## 4. Pinia Store 设计

### 4.1 useAppStore（核心 Store）

完全参照 V1 `useAppStore.js` 功能，用 Pinia Composition API 风格改写。

```javascript
// src/stores/app.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import { userApi, entriesApi } from '../api'

const DEFAULT_LIFE_EXPECTANCY = 80
const STORAGE_KEY = 'go_home_user'

// --- Math helpers (可导出供 composable 复用) ---
export function calcTotalDays(birthDate, lifeExpectancy = DEFAULT_LIFE_EXPECTANCY) {
  const birth = dayjs(birthDate)
  const end = birth.add(lifeExpectancy, 'year')
  return end.diff(birth, 'day')
}
export function calcPassedDays(birthDate) {
  return dayjs().diff(dayjs(birthDate), 'day')
}
export function calcRemainingDays(birthDate, lifeExpectancy = DEFAULT_LIFE_EXPECTANCY) {
  return calcTotalDays(birthDate, lifeExpectancy) - calcPassedDays(birthDate)
}

// --- Storage helpers ---
function loadFromStorage(key, fallback = null) {
  try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : fallback } catch { return fallback }
}
function saveToStorage(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch {}
}

export const useAppStore = defineStore('app', () => {
  // ============ User State ============
  const user = ref(null)                    // { birthDate, lifeExpectancy, ... }
  const isOnboarded = ref(false)            // 是否完成引导
  const isHydrated = ref(false)             // 标记——checkOnboarding 是否跑完
  const lifeExpectancy = ref(DEFAULT_LIFE_EXPECTANCY)
  const isLoading = ref(false)

  // ============ Entry State ============
  const entries = ref([])                   // 当前日期下的所有记录
  const selectedDate = ref('')              // 当前选中的日期（格式 YYYY-MM-DD）
  const isLoadingEntries = ref(false)

  // ============ UI State ============
  const showForm = ref(false)               // 输入表单是否展开
  const editingEntry = ref(null)            // 正在编辑的记录（null = 新增模式）

  // ============ Computed ============
  const birthDate = computed(() => user.value?.birthDate || '')

  // ============ Actions ============

  // --- setBirthDate: 引导页临时保存出生日期 ---
  function setBirthDate(birthDate) {
    const u = { ...user.value, birthDate }
    user.value = u
    isOnboarded.value = true
    lifeExpectancy.value = DEFAULT_LIFE_EXPECTANCY
    saveToStorage(STORAGE_KEY, u)
  }

  // --- checkOnboarding: App.vue onMounted 时调用 ---
  function checkOnboarding() {
    const savedUser = loadFromStorage(STORAGE_KEY, null)
    if (savedUser?.birthDate) {
      user.value = savedUser
      isOnboarded.value = true
      isHydrated.value = true
      lifeExpectancy.value = savedUser.lifeExpectancy || DEFAULT_LIFE_EXPECTANCY
      return true
    }
    isHydrated.value = true
    return false
  }

  // --- completeOnboarding: 完成所有引导步骤，同步到后端 ---
  async function completeOnboarding(userData) {
    isLoading.value = true
    try {
      if (userData.username && userData.birthDate) {
        await userApi.create({ username: userData.username, birthDate: userData.birthDate })
      }
    } catch (err) {
      console.warn('User sync failed:', err.message)
    }
    const u = {
      username: userData.username || 'user',
      birthDate: userData.birthDate,
      lifeExpectancy: userData.lifeExpectancy || DEFAULT_LIFE_EXPECTANCY,
      onboardingDate: new Date().toISOString(),
    }
    saveToStorage(STORAGE_KEY, u)
    user.value = u
    isOnboarded.value = true
    lifeExpectancy.value = u.lifeExpectancy
    isLoading.value = false
  }

  // --- setSelectedDate: 切换日期（历史页使用） ---
  function setSelectedDate(date) {
    selectedDate.value = date
    loadEntries(date)
  }

  // --- loadEntries: 加载指定日期的记录 ---
  async function loadEntries(date) {
    isLoadingEntries.value = true
    const targetDate = date || dayjs().format('YYYY-MM-DD')
    try {
      const res = await entriesApi.getByDate(targetDate)
      const entryList = (res.data || []).map(e => ({
        id: e.id,
        content: e.content,
        rating: e.rating || e.satisfaction || 3,
        category: e.category || 'life',
        tags: e.tags ? JSON.parse(e.tags) : [],
        entryDate: e.entryDate || e.entry_date || e.date || targetDate,
        createdAt: e.createdAt || e.created_at,
      }))
      entries.value = entryList
      selectedDate.value = targetDate
      isLoadingEntries.value = false
      return entryList
    } catch {
      // Offline fallback: 从 localStorage 读取
      const cached = loadFromStorage(`go_home_entries_${targetDate}`, [])
      entries.value = cached
      selectedDate.value = targetDate
      isLoadingEntries.value = false
      return cached
    }
  }

  // --- openForm / closeForm: UI 控制 ---
  function openForm(entry = null) {
    showForm.value = true
    editingEntry.value = entry
  }
  function closeForm() {
    showForm.value = false
    editingEntry.value = null
  }

  // --- addEntry: 新增记录 ---
  async function addEntry(data) {
    const targetDate = selectedDate.value || dayjs().format('YYYY-MM-DD')
    const entry = {
      ...data,
      id: 'local_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
      entryDate: targetDate,
      createdAt: new Date().toISOString(),
    }

    // 乐观更新
    const updated = [entry, ...entries.value]
    entries.value = updated
    showForm.value = false
    editingEntry.value = null
    saveToStorage(`go_home_entries_${targetDate}`, updated)

    // 异步同步到后端
    try {
      await entriesApi.create({
        content: entry.content,
        rating: entry.rating,
        category: entry.category || 'life',
        tags: JSON.stringify(entry.tags || []),
        entry_date: targetDate,
      })
    } catch (err) {
      console.warn('Entry create sync failed:', err.message)
    }
  }

  // --- updateEntry: 更新记录（新增/编辑） ---
  async function updateEntry(entryData) {
    const targetDate = selectedDate.value || dayjs().format('YYYY-MM-DD')
    const entry = {
      ...entryData,
      id: entryData.id || 'local_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
      entryDate: entryData.entryDate || targetDate,
      createdAt: entryData.createdAt || new Date().toISOString(),
    }

    const exists = entries.value.some(e => e.id === entry.id)
    const updated = exists
      ? entries.value.map(e => e.id === entry.id ? { ...e, ...entry } : e)
      : [entry, ...entries.value]

    entries.value = updated
    showForm.value = false
    editingEntry.value = null
    saveToStorage(`go_home_entries_${targetDate}`, updated)

    try {
      if (exists) {
        await entriesApi.update(entry.id, {
          content: entry.content,
          rating: entry.rating,
          category: entry.category || 'life',
          tags: JSON.stringify(entry.tags || []),
          entry_date: targetDate,
        })
      } else {
        await entriesApi.create({
          content: entry.content,
          rating: entry.rating,
          category: entry.category || 'life',
          tags: JSON.stringify(entry.tags || []),
          entry_date: targetDate,
        })
      }
    } catch (err) {
      console.warn('Entry sync failed:', err.message)
    }
  }

  // --- deleteEntry: 删除记录 ---
  async function deleteEntry(entryId) {
    const targetDate = selectedDate.value || dayjs().format('YYYY-MM-DD')
    const filtered = entries.value.filter(e => e.id !== entryId)
    entries.value = filtered
    saveToStorage(`go_home_entries_${targetDate}`, filtered)
    try {
      await entriesApi.delete(entryId)
    } catch {
      console.warn('Entry delete sync failed')
    }
  }

  // --- Settings actions ---
  function setLifeExpectancy(years) {
    lifeExpectancy.value = years
    if (user.value) {
      const u = { ...user.value, lifeExpectancy: years }
      user.value = u
      saveToStorage(STORAGE_KEY, u)
    }
  }

  function updateProfile(data) {
    const u = { ...user.value, ...data }
    user.value = u
    saveToStorage(STORAGE_KEY, u)
  }

  return {
    // State (refs)
    user, isOnboarded, isHydrated, lifeExpectancy, isLoading,
    entries, selectedDate, isLoadingEntries,
    showForm, editingEntry,

    // Computed
    birthDate,

    // Actions
    setBirthDate,
    checkOnboarding,
    completeOnboarding,
    setSelectedDate,
    loadEntries,
    openForm, closeForm,
    addEntry,
    updateEntry,
    deleteEntry,
    setLifeExpectancy,
    updateProfile,
  }
})
```

### 4.2 useTagStore（标签 Store）

新增 Store 管理分类标签：

```javascript
// src/stores/tag.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const PRESET_TAGS = [
  { name: '工作', emoji: '💼', color: '#3498db', isPreset: true },
  { name: '生活', emoji: '🏠', color: '#2ecc71', isPreset: true },
  { name: '学习', emoji: '📚', color: '#9b59b6', isPreset: true },
  { name: '旅行', emoji: '✈️', color: '#e67e22', isPreset: true },
  { name: '健康', emoji: '💪', color: '#e74c3c', isPreset: true },
  { name: '社交', emoji: '🫂', color: '#1abc9c', isPreset: true },
  { name: '美食', emoji: '🍜', color: '#f39c12', isPreset: true },
  { name: '其他', emoji: '📌', color: '#95a5a6', isPreset: true },
]

const STORAGE_KEY = 'go_home_tags'

export const useTagStore = defineStore('tag', () => {
  const tags = ref([])

  const filteredTags = computed(() => tags.value)

  function loadTags() {
    const saved = loadFromStorage(STORAGE_KEY, null)
    tags.value = saved || PRESET_TAGS
  }

  function addTag(tag) {
    tags.value.push({ ...tag, isPreset: false })
    saveToStorage(STORAGE_KEY, tags.value)
  }

  function removeTag(tagName) {
    tags.value = tags.value.filter(t => t.name !== tagName)
    saveToStorage(STORAGE_KEY, tags.value)
  }

  return { tags, filteredTags, loadTags, addTag, removeTag }
})

function loadFromStorage(key, fallback) {
  try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : fallback } catch { return fallback }
}
function saveToStorage(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch {}
}
```

### 4.3 Store 职责边界

| Store | 职责 | 数据源 |
|-------|------|--------|
| `useAppStore` | 用户状态 + 记录 CRUD + UI 状态 | localStorage + API |
| `useTagStore` | 标签管理（预设 + 自定义） | localStorage + 后续 API |

V1 将所有状态放在一个 `useAppStore` 中，V2 将标签管理拆为独立 Store，保持单一职责。

---

## 5. API 层设计

### 5.1 Axios 实例（src/api/index.js）

```javascript
// src/api/index.js
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

// Device ID 管理
function getDeviceId() {
  let deviceId = localStorage.getItem('go_home_device_id')
  if (!deviceId) {
    deviceId = crypto.randomUUID?.() ||
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      })
    localStorage.setItem('go_home_device_id', deviceId)
  }
  return deviceId
}

// 请求拦截器：自动添加 Device ID
apiClient.interceptors.request.use((config) => {
  config.headers['X-Device-Id'] = getDeviceId()
  return config
})

// 响应拦截器：解包 + 统一错误处理
apiClient.interceptors.response.use(
  (response) => response.data,  // 自动解套，调用方直接拿到 { success, data }
  (error) => {
    if (error.response) {
      console.error(`API Error ${error.response.status}:`, error.response.data)
      throw new Error(error.response.data?.error || error.response.data?.message || '请求失败')
    }
    if (error.request) {
      console.error('Network error')
      throw new Error('网络连接失败，请检查网络')
    }
    throw error
  }
)

export default apiClient
```

### 5.2 用户 API（src/api/user.js）

```javascript
// src/api/user.js
import apiClient from './index'

export const userApi = {
  /** GET /api/users/profile?userId=xxx — 获取用户信息 */
  getProfile: (userId) => apiClient.get(`/users/profile?userId=${userId}`),

  /** PUT /api/users/profile — 创建或更新用户信息 */
  updateProfile: (data) => apiClient.put('/users/profile', data),

  /** POST /api/users — 创建用户 */
  create: (data) => apiClient.post('/users', data),

  /** GET /api/users — 获取所有用户 */
  getAll: () => apiClient.get('/users'),
}
```

### 5.3 记录 API（src/api/entries.js）

```javascript
// src/api/entries.js
import apiClient from './index'

export const entriesApi = {
  /** GET /api/entries/by-date?date=YYYY-MM-DD — 获取某日记录 */
  getByDate: (entryDate) => apiClient.get(`/entries/by-date?date=${entryDate}`),

  /** GET /api/entries — 获取全部记录（带可选过滤参数） */
  getList: (params = {}) => apiClient.get('/entries', { params }),

  /** POST /api/entries — 创建记录 */
  create: (data) => apiClient.post('/entries', data),

  /** PUT /api/entries/:id — 更新记录 */
  update: (id, data) => apiClient.put(`/entries/${id}`, data),

  /** DELETE /api/entries/:id — 删除记录 */
  delete: (id) => apiClient.delete(`/entries/${id}`),
}
```

### 5.4 离线存储层（src/api/localStore.js）

与 V1 完全一致，只需将 storage key 前缀从 `return_home_` 改为 `go_home_`。

| Key 前缀 | 用途 |
|----------|------|
| `go_home_user` | 用户信息（birthDate, lifeExpectancy） |
| `go_home_entries_YYYY-MM-DD` | 某日记录缓存 |
| `go_home_sync_queue` | 离线同步队列 |
| `go_home_device_id` | 设备标识 |
| `go_home_tags` | 自定义标签 |
| `go_home_onboarded` | 导航守卫缓存标记 |

---

## 6. Composables 组合式函数

### 6.1 useCountdown

```javascript
// src/composables/useCountdown.js
import { ref, computed, onMounted, onUnmounted } from 'vue'
import dayjs from 'dayjs'
import { useAppStore, calcRemainingDays, calcPassedDays, calcTotalDays } from '../stores/app'

export function useCountdown() {
  const store = useAppStore()
  const now = ref(dayjs())

  let timer = null
  onMounted(() => {
    timer = setInterval(() => { now.value = dayjs() }, 60000) // 每分钟刷新
  })
  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  const birthDate = computed(() => store.user?.birthDate)

  const remainingDays = computed(() =>
    birthDate.value ? calcRemainingDays(birthDate.value, store.lifeExpectancy) : 0
  )
  const passedDays = computed(() =>
    birthDate.value ? calcPassedDays(birthDate.value) : 0
  )
  const totalDays = computed(() =>
    birthDate.value ? calcTotalDays(birthDate.value, store.lifeExpectancy) : 0
  )
  const progress = computed(() => {
    if (!birthDate.value) return 0
    const total = totalDays.value
    return total === 0 ? 0 : Math.min(100, (passedDays.value / total) * 100)
  })

  const isBirthday = computed(() => {
    if (!birthDate.value) return false
    return dayjs(birthDate.value).format('MM-DD') === now.value.format('MM-DD')
  })
  const today = computed(() => now.value.format('YYYY-MM-DD'))

  return { remainingDays, passedDays, totalDays, progress, isBirthday, today, now }
}
```

### 6.2 useNetworkStatus

检测网络状态变化，显示离线/在线提示。

### 6.3 useOfflineSync

监听网络恢复，将离线队列中的数据同步到后端。

---

## 7. 组件树与设计

### 7.1 组件树

```
App.vue
├── <NavBar />                   — 底部导航（首页/历史/设置）
└── <RouterView />
    ├── Onboarding.vue           — 引导页
    │   └── (无子组件，内联表单)
    │
    ├── Home.vue                 — 首页
    │   ├── 倒计时区域（内联）
    │   │   └── <CountdownDisplay />  → 超大数字 + 补充信息
    │   ├── <ProgressBar />      — 人生进度条
    │   ├── <EntryForm />        — 记录输入表单
    │   │   ├── <TagSelector />  — 标签选择器（可选，内联使用时直接渲染）
    │   │   └── <StarRating />   — 星级评分
    │   └── <EntryCard />        — 记录卡片列表（v-for）
    │       ├── <TagBadge />     — 标签徽章
    │       └── <StarRating />   — 星级展示（只读）
    │
    ├── History.vue              — 历史页
    │   ├── <CalendarGrid />     — 日历组件
    │   └── <EntryCard />        — 记录卡片（只读，不可编辑）
    │
    └── Settings.vue             — 设置页
        ├── 个人信息编辑区（内联）
        ├── 标签管理区（内联）
        └── 数据概览区（内联）
```

### 7.2 组件设计说明书

#### NavBar.vue

| 方向 | 名称 | 类型 | 说明 |
|------|------|------|------|
| 路由 | — | — | 内部使用 `useRouter()` + `useRoute()` 控制高亮 |
| **Props** | — | — | 无，纯展示/导航组件 |
| **Emits** | — | — | 无 |
| **Slots** | — | — | 无 |

**说明**：固定在底部的三标签导航（首页 🏠 / 历史页 📅 / 设置页 ⚙️）。
根据当前路由高亮相应图标。考虑使用 `<router-link>` 包裹。

#### ProgressBar.vue

| 方向 | 名称 | 类型 | 默认值 | 说明 |
|------|------|------|--------|------|
| Props | `progress` | Number | 0 | 已用百分比（0~100） |
| Props | `passedDays` | Number | 0 | 已用天数 |
| Props | `totalDays` | Number | 0 | 总天数 |
| Props | `color` | String | '#FF4757' | 进度条颜色 |

#### EntryCard.vue

| 方向 | 名称 | 类型 | 默认值 | 说明 |
|------|------|------|--------|------|
| Props | `entry` | Object | required | 记录数据 `{ id, content, rating, tags, entryDate, createdAt }` |
| Props | `readonly` | Boolean | false | 历史页只读模式，隐藏编辑/删除按钮 |
| Emits | `edit` | — | — | 点击编辑按钮触发，传出 entry 对象 |
| Emits | `delete` | — | — | 点击删除按钮触发，传出 entry.id |
| Slots | `actions` | — | — | 自定义操作按钮区域 |

**说明**：如果 `readonly` 为 true，则不显示 ✏️ 编辑和 🗑️ 删除按钮。

#### EntryForm.vue

| 方向 | 名称 | 类型 | 默认值 | 说明 |
|------|------|------|--------|------|
| Props | `editingEntry` | Object | null | 编辑模式：传入已有记录；新增模式：null |
| Emits | `submit` | — | — | 表单提交，传出 `{ content, rating, tags, date }` 数据 |
| Emits | `cancel` | — | — | 点击取消/关闭按钮 |

**说明**：包含文本输入框（最多500字符，显示剩余字数）、标签选择器和星级评分。
提交策略：
- 新增模式：`editingEntry === null` → 调用 `store.addEntry(data)`
- 编辑模式：`editingEntry !== null` → 调用 `store.updateEntry({ ...editingEntry, ...data })`

#### StarRating.vue

| 方向 | 名称 | 类型 | 默认值 | 说明 |
|------|------|------|--------|------|
| Props | `modelValue` | Number | 3 | 当前评分（1-5） |
| Props | `readonly` | Boolean | false | 只读模式（展示用，不可交互） |
| Props | `size` | String | 'md' | 尺寸：sm / md / lg |
| Emits | `update:modelValue` | Number | — | v-model 支持，用户点击星星时触发 |

**使用示例**：
```vue
<!-- 可交互 -->
<StarRating v-model="rating" />

<!-- 只读展示 -->
<StarRating :model-value="entry.rating" readonly />
```

### 7.3 视图组件职责

| 视图 | 主要职责 | 调用对象 |
|------|---------|---------|
| **Onboarding.vue** | 全屏引导，收集出生日期 + 预期寿命，调用 `completeOnboarding` | `useAppStore` |
| **Home.vue** | 倒计时（`useCountdown`）、今日统计、表单 + 列表入口 | `useAppStore`, `useCountdown` |
| **History.vue** | 日历组件、日期选择、只读记录列表 | `useAppStore`, `useTagStore` |
| **Settings.vue** | 用户信息编辑、预期寿命调整、标签管理 | `useAppStore`, `useTagStore` |

---

## 8. 样式方案（CSS Modules）

### 8.1 方案选择

**选择 CSS Modules**，不引入 Tailwind CSS。理由：
1. 与 V1 保持一致，所有 `.module.css` 文件可直接复用
2. 避免 Tailwind 在 `.vue` 文件中对模板的过度侵入（长 class 列表降低可读性）
3. Vue SFC + CSS Modules 天然支持 Scoped 样式，无命名冲突

### 8.2 CSS Modules 使用约定

每个组件同级创建 `.module.css` 文件：

```
components/
├── EntryCard.vue
├── EntryCard.module.css
├── EntryForm.vue
├── EntryForm.module.css
├── StarRating.vue
├── StarRating.module.css
├── NavBar.vue
├── NavBar.module.css
├── ProgressBar.vue
└── ProgressBar.module.css
```

在 Vue `<script setup>` 中导入使用：

```vue
<script setup>
import styles from './EntryCard.module.css'
</script>

<template>
  <div :class="styles.card">
    <p :class="styles.content">{{ entry.content }}</p>
  </div>
</template>
```

### 8.3 全局样式

`styles/variables.css` 和 `styles/global.css` 从 V1 原样继承，无需改动。
在 `main.js` 中引入：

```javascript
import './styles/global.css'
import './styles/variables.css'  // variables.css 已在 global.css 中 @import
```

---

## 9. 后端 API 清单

### 9.1 现有 API 端点（无需修改）

| 方法 | 路径 | 说明 | V1 前端调用 | V2 前端调用 |
|------|------|------|------------|------------|
| `GET` | `/api/health` | 健康检查 | — | — |
| `POST` | `/api/users` | 创建用户 | `userApi.create()` | 不变 |
| `GET` | `/api/users` | 获取所有用户 | `userApi.getAll()` | 不变 |
| `GET` | `/api/users/profile?userId=xxx` | 获取用户信息 | `userApi.getProfile()` | 不变 |
| `PUT` | `/api/users/profile` | 创建或更新用户 | `userApi.updateProfile()` | 不变 |
| `GET` | `/api/users/:username` | 按 username 查询用户 | `userApi.getByUsername()` | 不变 |
| `GET` | `/api/entries` | 获取所有记录 | `entriesApi.getList()` | 不变 |
| `GET` | `/api/entries/by-date?date=YYYY-MM-DD` | 按日期获取记录 | `entriesApi.getByDate()` | 不变 |
| `GET` | `/api/entries/:id` | 按 ID 获取记录 | `entriesApi.getById()` | 不变 |
| `POST` | `/api/entries` | 创建记录 | `entriesApi.create()` | 不变 |
| `PUT` | `/api/entries/:id` | 更新记录 | `entriesApi.update()` | 不变 |
| `DELETE` | `/api/entries/:id` | 删除记录 | `entriesApi.delete()` | 不变 |

### 9.2 V2 新功能所需的新端点（后端需新增）

以下端点对应需求文档 §6.2 中的新增功能：

| 方法 | 路径 | 说明 | 优先级 |
|------|------|------|--------|
| `GET` | `/api/users/:id/life-expectancy` | 获取用户预期寿命 | P0（设置页需要） |
| `PUT` | `/api/users/:id/life-expectancy` | 更新预期寿命 | P0（设置页需要） |
| `GET` | `/api/tags/:deviceId` | 获取用户标签列表 | P1（标签管理需要） |
| `POST` | `/api/tags` | 添加自定义标签 | P1 |
| `DELETE` | `/api/tags/:id` | 删除自定义标签 | P1 |

或者通过扩展现有端点实现（推荐，减少新增路由）：

| 方法 | 路径变化 | 说明 |
|------|---------|------|
| `PUT /api/users/profile` | 请求体新增 `lifeExpectancy` 字段 | 复用现有端点，无需新增路由 |
| `GET /api/entries` | 新增 `?tag=` 查询参数 | 复用现有端点 |
| `GET /api/entries/by-date?date=&tag=` | 新增 `tag` 过滤参数 | 复用现有端点 |

### 9.3 API 调用对照（V1 → V2）

| 功能 | V1 调用方式 | V2 调用方式 | 变化 |
|------|------------|------------|------|
| 用户创建 | `userApi.create({ username, birthDate })` | `userApi.create({ username, birthDate })` | 不变 |
| 获取记录 | `entriesApi.getByDate('2026-07-05')` | `entriesApi.getByDate('2026-07-05')` | 不变 |
| 创建记录 | `entriesApi.create({ content, rating, category })` | `entriesApi.create({ content, rating, category, tags })` | 新增 `tags` 字段 |
| 更新记录 | `entriesApi.update(id, { content, rating })` | `entriesApi.update(id, { content, rating, tags })` | 新增 `tags` 字段 |

### 9.4 后端注意事项

**当前后端 entries 表已有 `tags` 字段**（见 database.js 中 `tags TEXT` 列定义）。
前端发送时需将 tags 数组 `JSON.stringify()` 后存入，读取时 `JSON.parse()` 解析。

**当前后端 users 表已有 `life_expectancy` 字段**（默认 80）。
`PUT /api/users/profile` 可接受 `lifeExpectancy` 更新。

**建议**: V2 前端 api 层新增 `tags.js` 处理标签 API：

```javascript
// src/api/tags.js (可选，MVP 阶段前期标签存储在 localStorage)
import apiClient from './index'

export const tagsApi = {
  getAll: (deviceId) => apiClient.get(`/tags/${deviceId}`),
  create: (data) => apiClient.post('/tags', data),
  delete: (id) => apiClient.delete(`/tags/${id}`),
}
```

---

## 10. 离线存储策略

### 10.1 数据存储结构

```
localStorage:
├── go_home_device_id           → string (UUID)
├── go_home_user                → { username, birthDate, lifeExpectancy, onboardingDate }
├── go_home_entries_YYYY-MM-DD  → [ { id, content, rating, tags, entryDate, createdAt }, ... ]
├── go_home_sync_queue          → [ { action, data, timestamp }, ... ]   // 离线操作队列
└── go_home_tags                → [ { name, emoji, color, isPreset }, ... ]
```

### 10.2 离线同步队列设计

在 `localStore.js` 中维护同步队列：

```javascript
// 离线写入时追加到队列
addToSyncQueue({ type: 'CREATE', data: { content, rating, entry_date } })

// 网络恢复后批量同步
async function processSyncQueue() {
  const queue = getSyncQueue()
  for (const item of queue) {
    try {
      switch (item.action) {
        case 'CREATE': await entriesApi.create(item.data); break
        case 'UPDATE': await entriesApi.update(item.id, item.data); break
        case 'DELETE': await entriesApi.delete(item.id); break
      }
    } catch (err) {
      console.warn('Sync item failed, will retry:', err)
      return // 中断，保留队列
    }
  }
  clearSyncQueue() // 全部成功则清空
}
```

### 10.3 离线策略总结

| 操作 | 离线时行为 | 网络恢复后 |
|------|-----------|-----------|
| 创建记录 | 写入 localStorage + 加入同步队列 | 同步到后端 |
| 编辑记录 | 更新 localStorage + 加入同步队列 | 同步到后端 |
| 删除记录 | 从 localStorage 移除 + 加入同步队列 | 同步到后端 |
| 浏览记录 | 从 localStorage 读取缓存 | 重新请求后端 |
| Onboarding | 纯本地操作，无需网络 | — |

---

## 11. 数据流图

### 11.1 核心数据流

```
用户操作
  │
  ├── Onboarding 提交
  │     ↓
  │   useAppStore.completeOnboarding(userData)
  │     ├── 写入 localStorage (go_home_user)         ← 离线优先
  │     ├── userApi.create → POST /api/users          ← 异步同步
  │     └── isOnboarded = true → 导航到 /
  │
  ├── 添加/编辑/删除记录
  │     ↓
  │   useAppStore.addEntry / updateEntry / deleteEntry
  │     ├── 乐观更新 entries[] (ref)
  │     ├── 写入 localStorage (go_home_entries_DATE)  ← 离线优先
  │     └── entriesApi异步:
  │           ├── POST /api/entries (create)
  │           ├── PUT /api/entries/:id  (update)
  │           └── DELETE /api/entries/:id (delete)
  │
  ├── 切换日期（首页/历史页）
  │     ↓
  │   useAppStore.loadEntries(date)
  │     ├── 尝试 entriesApi.getByDate(date)           ← 优先请求后端
  │     └── 失败 → 读取 localStorage (go_home_entries_DATE) ← 降级离线
  │
  └── 调整设置
        ↓
      useAppStore.updateProfile / setLifeExpectancy
        ├── 更新 localStorage (go_home_user)
        └── userApi.updateProfile → PUT /api/users/profile
```

### 11.2 组件数据流（以首页为例）

```
Home.vue
  │
  ├── useAppStore()                    ← 全局状态
  │   ├── user, isOnboarded, lifeExpectancy
  │   ├── entries, selectedDate, isLoadingEntries
  │   └── showForm, editingEntry
  │
  ├── useCountdown()                   ← 倒计时逻辑
  │   └── remainingDays, passedDays, progress
  │
  ├── 倒计时区域
  │   ├── <ProgressBar :progress :passedDays :totalDays />
  │   └── 内联大数字
  │
  ├── 统计卡片（内联）
  │   └── 今日记录数 / 平均星级
  │
  ├── <EntryForm                       ← 新增/编辑
  │     :editing-entry="editingEntry"
  │     @submit="handleSubmit"
  │     @cancel="closeForm"
  │   >
  │     <StarRating v-model="formRating" />
  │   </EntryForm>
  │
  └── <div v-for="entry in entries">
        <EntryCard
          :entry="entry"
          @edit="openForm(entry)"
          @delete="handleDelete(entry.id)"
        >
          <StarRating :model-value="entry.rating" readonly size="sm" />
        </EntryCard>
      </div>
```

---

## 12. 从 V1 到 V2 的关键变化对照

### 12.1 代码结构变化

| 维度 | V1 | V2 | 影响 |
|------|----|----|------|
| 路由 | React Router 6 | Vue Router 4 | 全部重写 |
| 状态管理 | Zustand (hook-based) | Pinia (defineStore) | 全部重写 |
| 自定义 Hook | `useCountdown.js` | `composables/useCountdown.js` | 重写逻辑但架构相同 |
| 页面组件 | `pages/` 目录 | `views/` 目录 | 目录名变化 |
| 图片资源 | `public/` | `assets/images/` | 无影响，遵顼 Vite 惯例 |
| CSS 文件 | `.module.css` | `.module.css`（保持不变） | 直接复用 |

### 12.2 文件映射

| V1 (React) 文件 | → | V2 (Vue) 文件 | 备注 |
|-----------------|---|---------------|------|
| `src/main.jsx` | → | `src/main.js` | React → Vue 全新入口 |
| `src/App.jsx` | → | `src/App.vue` | 模板风格重写 |
| `src/store/useAppStore.js` | → | `src/stores/app.js` | Zustand → Pinia 重写 |
| — | → | `src/stores/tag.js` | **新增** |
| `src/pages/Onboarding.jsx` | → | `src/views/Onboarding.vue` | 全新 SFC |
| `src/pages/Home.jsx` | → | `src/views/Home.vue` | 全新 SFC |
| `src/pages/History.jsx` | → | `src/views/History.vue` | 全新 SFC |
| `src/pages/Settings.jsx` | → | `src/views/Settings.vue` | **新增**（V1 无独立设置页） |
| `src/components/*.jsx` | → | `src/components/*.vue` | + 同名 `.module.css` |
| `src/api/index.js` | → | `src/api/index.js` | 基本不变，key 前缀改 `go_home_` |
| `src/api/localStore.js` | → | `src/api/localStore.js` | key 前缀改 `go_home_` |
| — | → | `src/api/user.js` | **拆分**，V1 嵌在 index.js 中 |
| — | → | `src/api/entries.js` | **拆分**，V1 嵌在 index.js 中 |
| — | → | `src/composables/useCountdown.js` | **重构**（原 hooks/） |
| — | → | `src/composables/useOfflineSync.js` | **新增** |
| — | → | `src/composables/useNetworkStatus.js` | **新增** |

### 12.3 逻辑变化总结

| 逻辑 | V1 实现 | V2 实现 | 变化说明 |
|------|---------|---------|---------|
| 倒计时刷新 | `setInterval` 每60秒 | `setInterval` + `onUnmounted` 清理 | Vue 生命周期替代 useEffect cleanup |
| 离线存储 | localStorage key `return_home_*` | localStorage key `go_home_*` | 前缀改名防止冲突 |
| 记录 tags | 无 | `tags: []` + `JSON.stringify/parse` | 新增标签支持 |
| 标签管理 | 无 | `useTagStore` | 新增独立 Store |
| 预期寿命 | 硬编码 80 | `lifeExpectancy` ref + 设置页修改 | 用户可自定义 |
| 导航高亮 | React Router `useLocation` | Vue Router `<router-link>` + `useRoute` | 框架原生支持 |
| 页面过渡 | CSS 基础动画 | Vue `<Transition>` 组件 | V2 动画更丰富 |

---

## 附录 A：构建配置（vite.config.js）

```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
```

---

## 附录 B：入口文件（main.js）

```javascript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/global.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
```

---

## 附录 C：V1 现有组件/文件清单

以下为参考依据——V1 (`return-home/frontend`) 的现有组件在重写过程中需要逐一核对：

| V1 文件 | 类型 | 对应 V2 文件 | 重写方式 |
|---------|------|-------------|---------|
| `src/App.jsx` | 根组件 | `src/App.vue` | 用 `<RouterView>` + `<Transition>` 替换 `<Routes>` |
| `src/main.jsx` | 入口 | `src/main.js` | `createApp` 替代 `createRoot` |
| `src/store/useAppStore.js` | Store | `src/stores/app.js` | Zustand → Pinia，全部重写 |
| `src/api/index.js` | API 客户端 | `src/api/index.js` + `user.js` + `entries.js` | 拆分 |
| `src/api/localStore.js` | 离线存储 | `src/api/localStore.js` | 仅改 key 前缀 |
| `src/hooks/useCountdown.js` | Hook | `src/composables/useCountdown.js` | Hook → Composable |
| `src/pages/Onboarding.jsx` + `.module.css` | 页面 | `src/views/Onboarding.vue` | SFC |
| `src/pages/Home.jsx` + `.module.css` | 页面 | `src/views/Home.vue` | SFC |
| `src/pages/History.jsx` + `.module.css` | 页面 | `src/views/History.vue` | SFC |
| `src/pages/Settings.jsx` + `.module.css` | 页面 | `src/views/Settings.vue` | 新增 |
| `src/components/NavBar.jsx` + `.module.css` | 组件 | `src/components/NavBar.vue` | SFC |
| `src/components/ProgressBar.jsx` + `.module.css` | 组件 | `src/components/ProgressBar.vue` | SFC |
| `src/components/EntryCard.jsx` + `.module.css` | 组件 | `src/components/EntryCard.vue` | SFC |
| `src/components/EntryForm.jsx` + `.module.css` | 组件 | `src/components/EntryForm.vue` | SFC |
| `src/components/StarRating.jsx` + `.module.css` | 组件 | `src/components/StarRating.vue` | SFC |
| `src/styles/variables.css` | 样式 | `src/styles/variables.css` | 直接复用 |
| `src/styles/global.css` | 样式 | `src/styles/global.css` | 直接复用 |

---

## 附录 D：开发阶段任务分解

### Phase 1 — 基础设施（半天）
1. 搭建 Vite + Vue 3 项目骨架
2. 配置 `vite.config.js`（proxy 到后端）
3. 配置 `router/index.js` + 导航守卫
4. 配置 `main.js`（Pinia + Router + App）
5. 拷贝 `styles/` 目录（variables.css + global.css）

### Phase 2 — API + Store（1天）
1. 拷贝 + 改写 `api/index.js`（改 key 前缀）
2. 拆分 `api/user.js` + `api/entries.js`
3. 拷贝 + 改写 `api/localStore.js`
4. 重写 `stores/app.js`（Pinia composition API）
5. 新增 `stores/tag.js`
6. 新增 `composables/useCountdown.js`
7. 新增 `composables/useOfflineSync.js`

### Phase 3 — 组件（1天）
1. `StarRating.vue`（most独立，先做）
2. `NavBar.vue`
3. `ProgressBar.vue`
4. `EntryCard.vue`
5. `EntryForm.vue`

### Phase 4 — 页面（1.5天）
1. `App.vue`（根组件 + 导航 + 过渡动画）
2. `Onboarding.vue`
3. `Home.vue`
4. `History.vue`
5. `Settings.vue`

### Phase 5 — 联调 + 测试（0.5天）
1. 端到端走通完整流程
2. 离线缓存测试

**总预估工时**: 4-4.5 天（单人）

---

*文档结束*

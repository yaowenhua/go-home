<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { adminApi } from '../../api/admin'
import dayjs from 'dayjs'
import styles from './AdminUsers.module.css'

const router = useRouter()

// ============ State ============
const users = ref([])
const loading = ref(false)
const error = ref('')
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const totalPages = ref(0)
const actionLoading = ref(null) // userId being acted upon

// ============ Computed ============
const paginationInfo = computed(() => {
  if (total.value === 0) return '暂无数据'
  const start = (currentPage.value - 1) * pageSize.value + 1
  const end = Math.min(currentPage.value * pageSize.value, total.value)
  return `第 ${start}-${end} 条，共 ${total.value} 条`
})

// ============ Debounced Search ============
let searchTimer = null
watch(searchQuery, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    currentPage.value = 1
    fetchUsers()
  }, 400)
})

// ============ Fetch ============
async function fetchUsers() {
  loading.value = true
  error.value = ''
  try {
    const res = await adminApi.listUsers({
      page: currentPage.value,
      pageSize: pageSize.value,
      search: searchQuery.value || undefined,
    })
    users.value = res.data.users || []
    const pagination = res.pagination || res.data?.pagination || {}
    total.value = pagination.total || 0
    totalPages.value = pagination.totalPages || 1
  } catch (err) {
    error.value = err.message || '获取用户列表失败'
    users.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchUsers()
})

// ============ Pagination ============
function goToPage(page) {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
  fetchUsers()
}

// ============ Actions ============
function viewDetail(userId) {
  router.push(`/admin/users/${userId}`)
}

async function handleResetPassword(userId) {
  if (!confirm('确定要重置该用户的密码吗？\n\n重置后该用户的加密内容将不可访问。')) return

  actionLoading.value = userId
  try {
    const res = await adminApi.resetPassword(userId)
    alert(`密码已重置\n\n临时密码: ${res.data?.tempPassword || '请查看后台日志'}\n请安全地告知用户。`)
  } catch (err) {
    alert('重置失败: ' + (err.message || '请重试'))
  } finally {
    actionLoading.value = null
  }
}

async function handleToggleStatus(user) {
  const newStatus = user.status === 'active' ? 'disabled' : 'active'
  const action = newStatus === 'disabled' ? '禁用' : '启用'
  if (!confirm(`确定要${action}用户「${user.displayName || user.phone}」吗？`)) return

  actionLoading.value = user.id
  try {
    await adminApi.toggleUserStatus(user.id, newStatus)
    // Update local state
    const found = users.value.find((u) => u.id === user.id)
    if (found) found.status = newStatus
  } catch (err) {
    alert(`${action}失败: ` + (err.message || '请重试'))
  } finally {
    actionLoading.value = null
  }
}

// ============ Helpers ============
function maskPhone(phone) {
  if (!phone) return '—'
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return dayjs(dateStr).format('YYYY/M/D HH:mm')
}

function statusClass(status) {
  return status === 'active' ? styles.statusActive : styles.statusDisabled
}

function statusLabel(status) {
  return status === 'active' ? '正常' : '已禁用'
}
</script>

<template>
  <div :class="styles.page">
    <!-- Header -->
    <div :class="styles.header">
      <div>
        <h1 :class="styles.title">用户管理</h1>
        <p :class="styles.subtitle">管理系统中的所有用户</p>
      </div>
    </div>

    <!-- Search bar -->
    <div :class="styles.searchBar">
      <input
        type="text"
        :class="styles.searchInput"
        v-model="searchQuery"
        placeholder="搜索手机号..."
      />
      <span :class="styles.searchIcon">🔍</span>
    </div>

    <!-- Error -->
    <p v-if="error" :class="styles.error">{{ error }}</p>

    <!-- Loading -->
    <p v-if="loading" :class="styles.loading">加载中...</p>

    <!-- Table -->
    <div v-if="!loading && !error" :class="styles.tableWrapper">
      <table :class="styles.table">
        <thead>
          <tr>
            <th>手机号</th>
            <th>昵称</th>
            <th>角色</th>
            <th>状态</th>
            <th>注册时间</th>
            <th>最后登录</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="users.length === 0">
            <td :class="styles.emptyCell" colspan="7">暂无用户数据</td>
          </tr>
          <tr v-for="user in users" :key="user.id" @click="viewDetail(user.id)">
            <td>{{ maskPhone(user.phone) }}</td>
            <td>{{ user.displayName || user.username || '—' }}</td>
            <td>
              <span :class="[styles.roleBadge, user.role === 'admin' && styles.roleAdmin]">
                {{ user.role === 'admin' ? '管理员' : '用户' }}
              </span>
            </td>
            <td>
              <span :class="[styles.statusBadge, statusClass(user.status)]">
                {{ statusLabel(user.status) }}
              </span>
            </td>
            <td>{{ formatDate(user.createdAt) }}</td>
            <td>{{ user.lastLoginAt ? formatDate(user.lastLoginAt) : '从未登录' }}</td>
            <td @click.stop>
              <div :class="styles.actions">
                <button
                  :class="styles.actionBtn"
                  @click="handleResetPassword(user.id)"
                  :disabled="actionLoading === user.id"
                >
                  {{ actionLoading === user.id ? '...' : '重置密码' }}
                </button>
                <button
                  :class="[styles.actionBtn, user.status === 'active' ? styles.actionDanger : styles.actionSuccess]"
                  @click="handleToggleStatus(user)"
                  :disabled="actionLoading === user.id"
                >
                  {{ actionLoading === user.id ? '...' : (user.status === 'active' ? '禁用' : '启用') }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" :class="styles.pagination">
      <span :class="styles.paginationInfo">{{ paginationInfo }}</span>
      <div :class="styles.paginationBtns">
        <button
          :class="styles.pageBtn"
          :disabled="currentPage <= 1"
          @click="goToPage(currentPage - 1)"
        >
          上一页
        </button>
        <span
          v-for="p in totalPages"
          :key="p"
          :class="[styles.pageNum, currentPage === p && styles.pageNumActive]"
          @click="goToPage(p)"
        >
          {{ p }}
        </span>
        <button
          :class="styles.pageBtn"
          :disabled="currentPage >= totalPages"
          @click="goToPage(currentPage + 1)"
        >
          下一页
        </button>
      </div>
    </div>
  </div>
</template>

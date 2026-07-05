<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { adminApi } from '../../api/admin'
import dayjs from 'dayjs'
import styles from './AdminUserDetail.module.css'

const route = useRoute()
const router = useRouter()
const userId = route.params.id

// ============ State ============
const user = ref(null)
const loading = ref(true)
const error = ref('')
const actionLoading = ref(false)

// ============ Activity Log (mock for now) ============
const activities = ref([])

// ============ Computed ============
const isAdmin = computed(() => user.value?.role === 'admin')
const isActive = computed(() => user.value?.status === 'active')

// ============ Fetch ============
async function fetchUserDetail() {
  loading.value = true
  error.value = ''
  try {
    const res = await adminApi.getUser(userId)
    user.value = res.data || res
  } catch (err) {
    error.value = err.message || '获取用户信息失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchUserDetail()
})

// ============ Actions ============
async function handleResetPassword() {
  if (!confirm('确定要重置该用户的密码吗？\n\n重置后该用户的加密内容将不可访问。')) return

  actionLoading.value = true
  try {
    const res = await adminApi.resetPassword(userId)
    alert(`密码已重置\n\n临时密码: ${res.data?.tempPassword || '请查看后台日志'}`)
  } catch (err) {
    alert('重置失败: ' + (err.message || '请重试'))
  } finally {
    actionLoading.value = false
  }
}

async function handleToggleStatus() {
  const newStatus = isActive.value ? 'disabled' : 'active'
  const action = isActive.value ? '禁用' : '启用'
  if (!confirm(`确定要${action}该用户吗？`)) return

  actionLoading.value = true
  try {
    await adminApi.toggleUserStatus(userId, newStatus)
    user.value.status = newStatus
  } catch (err) {
    alert(`${action}失败: ` + (err.message || '请重试'))
  } finally {
    actionLoading.value = false
  }
}

function goBack() {
  router.push('/admin/users')
}

// ============ Helpers ============
function formatDate(dateStr) {
  if (!dateStr) return '—'
  return dayjs(dateStr).format('YYYY/MM/DD HH:mm:ss')
}

function maskPhone(phone) {
  if (!phone) return '—'
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}
</script>

<template>
  <div :class="styles.page">
    <!-- Back link -->
    <button :class="styles.backLink" @click="goBack">
      ← 返回用户列表
    </button>

    <!-- Loading -->
    <div v-if="loading" :class="styles.loading">加载中...</div>

    <!-- Error -->
    <div v-else-if="error" :class="styles.error">
      <p>{{ error }}</p>
      <button :class="styles.retryBtn" @click="fetchUserDetail">重试</button>
    </div>

    <!-- User Detail -->
    <template v-else-if="user">
      <!-- User Info Card -->
      <div :class="styles.card">
        <div :class="styles.cardHeader">
          <div :class="styles.avatar">
            {{ (user.displayName || user.phone || '?')[0].toUpperCase() }}
          </div>
          <div :class="styles.userMeta">
            <h2 :class="styles.userName">{{ user.displayName || user.username || '未设置昵称' }}</h2>
            <p :class="styles.userPhone">{{ maskPhone(user.phone) }}</p>
          </div>
          <span :class="[styles.statusTag, isActive ? styles.statusActive : styles.statusDisabled]">
            {{ isActive ? '正常' : '已禁用' }}
          </span>
          <span v-if="isAdmin" :class="styles.adminTag">管理员</span>
        </div>

        <div :class="styles.infoGrid">
          <div :class="styles.infoItem">
            <span :class="styles.infoLabel">用户 ID</span>
            <span :class="styles.infoValue">{{ user.id }}</span>
          </div>
          <div :class="styles.infoItem">
            <span :class="styles.infoLabel">角色</span>
            <span :class="styles.infoValue">{{ isAdmin ? '管理员' : '普通用户' }}</span>
          </div>
          <div :class="styles.infoItem">
            <span :class="styles.infoLabel">注册时间</span>
            <span :class="styles.infoValue">{{ formatDate(user.createdAt) }}</span>
          </div>
          <div :class="styles.infoItem">
            <span :class="styles.infoLabel">最后登录</span>
            <span :class="styles.infoValue">{{ user.lastLoginAt ? formatDate(user.lastLoginAt) : '从未登录' }}</span>
          </div>
          <div :class="styles.infoItem">
            <span :class="styles.infoLabel">出生日期</span>
            <span :class="styles.infoValue">{{ user.birthDate || '未设置' }}</span>
          </div>
          <div :class="styles.infoItem">
            <span :class="styles.infoLabel">日记数量</span>
            <span :class="styles.infoValue">{{ user.entryCount ?? '—' }}</span>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div :class="styles.actionCard">
        <h3 :class="styles.actionTitle">操作</h3>
        <div :class="styles.actionBtns">
          <button
            :class="styles.actionBtnWarning"
            :disabled="actionLoading"
            @click="handleResetPassword"
          >
            {{ actionLoading ? '处理中...' : '重置密码' }}
          </button>
          <button
            v-if="!isAdmin"
            :class="[styles.actionBtn, isActive ? styles.actionBtnDanger : styles.actionBtnSuccess]"
            :disabled="actionLoading"
            @click="handleToggleStatus"
          >
            {{ actionLoading ? '处理中...' : (isActive ? '禁用用户' : '启用用户') }}
          </button>
          <p v-if="isAdmin" :class="styles.actionHint">管理员账号无法被禁用</p>
        </div>
      </div>

      <!-- Recent Activity Log -->
      <div :class="styles.card">
        <h3 :class="styles.sectionTitle">最近活动</h3>
        <div v-if="activities.length === 0" :class="styles.emptyLog">
          暂无活动记录
        </div>
        <div v-else :class="styles.activityList">
          <div v-for="(activity, i) in activities" :key="i" :class="styles.activityItem">
            <span :class="styles.activityIcon">{{ activity.icon }}</span>
            <div :class="styles.activityContent">
              <p :class="styles.activityText">{{ activity.text }}</p>
              <p :class="styles.activityTime">{{ formatDate(activity.time) }}</p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

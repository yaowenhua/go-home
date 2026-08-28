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

// ============ Activity Log ============
const activities = ref([])
const activitiesLoading = ref(false)
const activitiesLoaded = ref(false)
const activitiesError = ref('')

// 重置密码二次确认弹窗
const showResetConfirm = ref(false)
function openResetConfirm() {
  showResetConfirm.value = true
}
function cancelResetConfirm() {
  showResetConfirm.value = false
}

// 行为类型 → 展示文案/图标映射（DD-B1.2）
const ACTIVITY_TYPE_MAP = {
  login: { text: '登录', icon: '🔑' },
  register: { text: '注册', icon: '📝' },
  entry_create: { text: '写日记', icon: '✍️' },
  entry_update: { text: '更新日记', icon: '🔄' },
  entry_delete: { text: '删除日记', icon: '🗑️' },
  page_view: { text: '浏览页面', icon: '👀' },
  api_call: { text: '接口访问', icon: '⚙️' },
  change_password: { text: '修改密码', icon: '🔒' },
  default: { text: '行为记录', icon: '📌' },
}

function mapActivity(item) {
  const type = item.event_type
  const label = ACTIVITY_TYPE_MAP[type] || ACTIVITY_TYPE_MAP.default
  return {
    type,
    text: label.text,
    time: item.created_at,
    icon: label.icon,
  }
}

// ============ Computed ============
const isAdmin = computed(() => user.value?.role === 'admin')
const isActive = computed(() => user.value?.status === 'active')

// ============ Fetch ============
async function fetchUserDetail() {
  loading.value = true
  error.value = ''
  try {
    const res = await adminApi.getUser(userId)
    user.value = res.data?.data || res.data || res
  } catch (err) {
    error.value = err.message || '获取用户信息失败'
  } finally {
    loading.value = false
  }
}

// B1: 拉取用户真实活动日志（与用户信息并行，独立 loading，不阻塞整页）
async function fetchUserActivity() {
  activitiesLoading.value = true
  activitiesError.value = ''
  try {
    const res = await adminApi.getUserActivity(userId)
    const data = res?.data || res
    const items = data?.items || []
    activities.value = items.map(mapActivity)
    activitiesLoaded.value = true
  } catch (err) {
    activitiesError.value = err.message || '活动记录加载失败'
    activities.value = []
    activitiesLoaded.value = true
  } finally {
    activitiesLoading.value = false
  }
}

onMounted(() => {
  fetchUserDetail()
  // 并行拉真实活动日志（独立状态，慢不阻塞整页）
  fetchUserActivity()
})

// ============ Actions ============
async function confirmResetPassword() {
  // 二次确认弹窗确认按钮触发实际重置
  showResetConfirm.value = false
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
            {{ (user.display_name || user.phone || '?')[0].toUpperCase() }}
          </div>
          <div :class="styles.userMeta">
            <h2 :class="styles.userName">{{ user.display_name || user.username || '未设置昵称' }}</h2>
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
            <span :class="styles.infoValue">{{ formatDate(user.created_at) }}</span>
          </div>
          <div :class="styles.infoItem">
            <span :class="styles.infoLabel">最后登录</span>
            <span :class="styles.infoValue">{{ user.last_login_at ? formatDate(user.last_login_at) : '从未登录' }}</span>
          </div>
          <div :class="styles.infoItem">
            <span :class="styles.infoLabel">出生日期</span>
            <span :class="styles.infoValue">{{ user.birth_date || '未设置' }}</span>
          </div>
          <div :class="styles.infoItem">
            <span :class="styles.infoLabel">日记数量</span>
            <span :class="styles.infoValue">{{ user.entry_count ?? '—' }}</span>
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
            @click="openResetConfirm"
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

        <!-- 独立 loading（不影响用户详情主体） -->
        <div v-if="activitiesLoading" :class="styles.activityLoading">
          活动加载中...
        </div>

        <div v-else-if="activitiesError" :class="styles.emptyLog">
          {{ activitiesError }}
        </div>

        <div v-else-if="activities.length === 0" :class="styles.emptyLog">
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

      <!-- 重置密码二次确认弹窗（红字强警告） -->
      <div v-if="showResetConfirm" :class="styles.confirmOverlay" @click.self="cancelResetConfirm">
        <div :class="styles.confirmDialog" role="dialog" aria-modal="true">
          <h3 :class="styles.confirmTitle">重置密码</h3>
          <p :class="styles.confirmDanger">
            ⚠️ 重置后该用户的所有历史日记将<strong>永久无法恢复</strong>（无法读取）。确定继续吗？
          </p>
          <div :class="styles.confirmBtns">
            <button :class="styles.confirmCancel" @click="cancelResetConfirm">取消</button>
            <button :class="styles.confirmOk" :disabled="actionLoading" @click="confirmResetPassword">
              {{ actionLoading ? '处理中...' : '确认重置' }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import styles from './AdminLayout.module.css'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const isAdmin = computed(() => authStore.isAdmin)

const navItems = [
  { path: '/admin/users', label: '用户管理', icon: '👥' },
  { path: '/admin/stats', label: '数据统计', icon: '📊' },
]

function navigate(path) {
  router.push(path)
}

function goHome() {
  router.push('/')
}
</script>

<template>
  <div :class="styles.layout">
    <!-- Sidebar -->
    <aside :class="styles.sidebar">
      <div :class="styles.sidebarHeader">
        <span :class="styles.sidebarLogo">🏡</span>
        <span :class="styles.sidebarTitle">管理后台</span>
      </div>

      <nav :class="styles.sidebarNav">
        <button
          v-for="item in navItems"
          :key="item.path"
          :class="[styles.navItem, route.path === item.path && styles.navItemActive]"
          @click="navigate(item.path)"
        >
          <span :class="styles.navIcon">{{ item.icon }}</span>
          <span :class="styles.navLabel">{{ item.label }}</span>
        </button>
      </nav>

      <div :class="styles.sidebarFooter">
        <button :class="styles.backBtn" @click="goHome">
          <span>← 返回首页</span>
        </button>
        <div :class="styles.adminInfo">
          <span :class="styles.adminBadge">管理员</span>
          <span :class="styles.adminName">{{ authStore.user?.displayName || authStore.user?.phone || 'Admin' }}</span>
        </div>
      </div>
    </aside>

    <!-- Main content -->
    <main :class="styles.main">
      <router-view />
    </main>
  </div>
</template>

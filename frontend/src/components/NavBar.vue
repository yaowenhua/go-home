<script setup>
import { useRoute, useRouter } from 'vue-router'
import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import styles from './NavBar.module.css'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const NAV_ITEMS = [
  { path: '/', label: '首页', icon: '🏠' },
  { path: '/history', label: '历史', icon: '📅' },
  { path: '/settings', label: '设置', icon: '⚙️' },
]

// Admin entry — only visible to admins
const showAdminEntry = computed(() => authStore.isLoggedIn && authStore.isAdmin)

// Login / user icon — show login when not logged in
const showLoginEntry = computed(() => !authStore.isLoggedIn)

// Don't show on onboarding or login pages
const showNav = computed(() => {
  return route.path !== '/onboarding' && route.path !== '/login' && !route.path.startsWith('/admin')
})

function navigate(path) {
  router.push(path)
}
</script>

<template>
  <nav v-if="showNav" :class="styles.nav">
    <div :class="styles.inner">
      <button
        v-for="item in NAV_ITEMS"
        :key="item.path"
        :class="[styles.navItem, route.path === item.path && styles.active]"
        @click="navigate(item.path)"
      >
        <span :class="styles.icon">{{ item.icon }}</span>
        <span :class="styles.label">{{ item.label }}</span>
        <span v-if="route.path === item.path" :class="styles.indicator" />
      </button>

      <!-- Admin Entry (V2) -->
      <button
        v-if="showAdminEntry"
        :class="[styles.navItem, route.path.startsWith('/admin') && styles.activeAdmin]"
        @click="navigate('/admin')"
      >
        <span :class="styles.icon">🛡️</span>
        <span :class="styles.label">管理</span>
        <span v-if="route.path.startsWith('/admin')" :class="styles.indicator" />
      </button>

      <!-- Login Entry (V2) — shown when not logged in -->
      <button
        v-if="showLoginEntry"
        :class="[styles.navItem, route.path === '/login' && styles.active]"
        @click="navigate('/login')"
      >
        <span :class="styles.icon">🔐</span>
        <span :class="styles.label">登录</span>
      </button>
    </div>
  </nav>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import { computed } from 'vue'
import styles from './NavBar.module.css'

const route = useRoute()
const router = useRouter()

const NAV_ITEMS = [
  { path: '/', label: '首页', icon: '🏠' },
  { path: '/history', label: '历史', icon: '📅' },
  { path: '/settings', label: '设置', icon: '⚙️' },
]

// Don't show on onboarding
const showNav = computed(() => route.path !== '/onboarding')

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
    </div>
  </nav>
</template>

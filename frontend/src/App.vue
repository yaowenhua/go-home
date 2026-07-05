<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from './stores/app'
import { useAuthStore } from './stores/auth'
import NavBar from './components/NavBar.vue'

const router = useRouter()
const appStore = useAppStore()
const authStore = useAuthStore()

onMounted(async () => {
  // Initialize auth (restore from localStorage)
  await authStore.initialize()

  // Check onboarding
  appStore.checkOnboarding()
})

// Navigation guard: redirect based on auth & onboarding state
router.beforeEach(async (to, from, next) => {
  // Ensure stores are hydrated
  if (!authStore.isInitialized) {
    await authStore.initialize()
  }

  if (!appStore.isHydrated) {
    appStore.checkOnboarding()
  }

  // Public paths — always allow
  const publicPaths = ['/login', '/onboarding']
  if (publicPaths.includes(to.path)) {
    // But redirect logged-in users away from /login
    if (to.path === '/login' && authStore.isLoggedIn) {
      return next({ path: '/' })
    }
    return next()
  }

  // Check admin routes
  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    return next({ path: '/' })
  }

  // Check auth
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    return next({ path: '/login', query: { redirect: to.fullPath } })
  }

  // Check onboarding
  if (to.meta.requiresAuth && !appStore.isOnboarded) {
    return next({ path: '/onboarding' })
  }

  next()
})
</script>

<template>
  <NavBar />
  <router-view v-slot="{ Component, route }">
    <transition :name="route.meta.transition || 'fade'" mode="out-in">
      <component :is="Component" :key="route.path" />
    </transition>
  </router-view>
</template>

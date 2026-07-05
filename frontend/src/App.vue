<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from './stores/app'
import NavBar from './components/NavBar.vue'

const router = useRouter()
const store = useAppStore()

onMounted(() => {
  store.checkOnboarding()
})

// Navigation guard: redirect un-onboarded users
router.beforeEach((to, from, next) => {
  if (!store.isHydrated) {
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
</script>

<template>
  <NavBar />
  <router-view v-slot="{ Component, route }">
    <transition :name="route.meta.transition || 'fade'" mode="out-in">
      <component :is="Component" :key="route.path" />
    </transition>
  </router-view>
</template>

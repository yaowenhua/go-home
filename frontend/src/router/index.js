import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useAppStore } from '../stores/app'
import adminRoutes from './admin'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/onboarding',
    name: 'Onboarding',
    component: () => import('../views/Onboarding.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    meta: { requiresAuth: true },
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
    path: '/admin',
    component: () => import('../views/admin/AdminLayout.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      {
        path: '',
        redirect: { name: 'AdminUsers' },
      },
      ...adminRoutes,
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to, from, next) => {
  // Initialize stores if needed
  const authStore = useAuthStore()
  const appStore = useAppStore()

  if (!authStore.isInitialized) {
    await authStore.initialize()
  }

  if (!appStore.isHydrated) {
    appStore.checkOnboarding()
  }

  // 1. Check requiresAuth
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    // Save redirect path, go to login
    return next({ path: '/login', query: { redirect: to.fullPath } })
  }

  // 2. Check requiresAdmin
  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    return next({ path: '/' })
  }

  // 3. Already logged in — skip login page
  if (to.path === '/login' && authStore.isLoggedIn) {
    return next({ path: '/' })
  }

  // 4. Old onboarding redirect logic
  if (to.meta.requiresAuth && !appStore.isOnboarded && to.path !== '/onboarding') {
    return next({ path: '/onboarding' })
  }
  if (to.path === '/onboarding' && appStore.isOnboarded) {
    return next({ path: '/' })
  }

  next()
})

export default router

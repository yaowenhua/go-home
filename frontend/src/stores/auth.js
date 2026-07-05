import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '../api/auth'

const ACCESS_TOKEN_KEY = 'go_home_access_token'
const REFRESH_TOKEN_KEY = 'go_home_refresh_token'
const USER_INFO_KEY = 'go_home_user_info'

export const useAuthStore = defineStore('auth', () => {
  // ============ State ============
  const accessToken = ref(null)
  const refreshTokenVal = ref(null)
  const user = ref(null)
  const isInitialized = ref(false)
  const isLoading = ref(false)

  // ============ Computed ============
  const isLoggedIn = computed(() => !!accessToken.value)
  const role = computed(() => user.value?.role || '')
  const isAdmin = computed(() => role.value === 'admin')

  // ============ Storage helpers ============
  function saveTokens(at, rt) {
    accessToken.value = at
    refreshTokenVal.value = rt
    localStorage.setItem(ACCESS_TOKEN_KEY, at)
    localStorage.setItem(REFRESH_TOKEN_KEY, rt)
  }

  function saveUser(u) {
    user.value = u
    localStorage.setItem(USER_INFO_KEY, JSON.stringify(u))
  }

  function clearAuth() {
    accessToken.value = null
    refreshTokenVal.value = null
    user.value = null
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_INFO_KEY)
  }

  // ============ Actions ============

  async function initialize() {
    const storedAccess = localStorage.getItem(ACCESS_TOKEN_KEY)
    const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY)
    const storedUser = localStorage.getItem(USER_INFO_KEY)

    if (storedAccess && storedRefresh) {
      accessToken.value = storedAccess
      refreshTokenVal.value = storedRefresh
      if (storedUser) {
        try {
          user.value = JSON.parse(storedUser)
        } catch {
          // ignore
        }
      }

      // Validate token by fetching profile
      try {
        const res = await authApi.getMe()
        saveUser(res.data)
      } catch {
        // Token might be expired — try refresh
        try {
          const ok = await refreshToken()
          if (!ok) {
            clearAuth()
          }
        } catch {
          clearAuth()
        }
      }
    }

    isInitialized.value = true
  }

  async function login(phone, password) {
    isLoading.value = true
    try {
      const res = await authApi.login({ phone, password })
      const { accessToken: at, refreshToken: rt, user: u } = res.data
      saveTokens(at, rt)
      saveUser(u)
      return u
    } finally {
      isLoading.value = false
    }
  }

  async function register(phone, password, name) {
    isLoading.value = true
    try {
      const res = await authApi.register({ phone, password, name })
      const { accessToken: at, refreshToken: rt, user: u } = res.data
      saveTokens(at, rt)
      saveUser(u)
      return u
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    try {
      await authApi.logout()
    } catch {
      // Ignore server errors on logout
    } finally {
      clearAuth()
    }
  }

  async function refreshToken() {
    try {
      const res = await authApi.refresh({ refreshToken: refreshTokenVal.value })
      const { accessToken: at, refreshToken: rt } = res.data
      saveTokens(at, rt)
      return true
    } catch {
      clearAuth()
      return false
    }
  }

  async function changePassword(oldPassword, newPassword) {
    await authApi.changePassword({ oldPassword, newPassword })
  }

  async function fetchProfile() {
    try {
      const res = await authApi.getMe()
      saveUser(res.data)
      return res.data
    } catch {
      return null
    }
  }

  return {
    // State
    accessToken,
    refreshToken: refreshTokenVal,
    user,
    isInitialized,
    isLoading,
    // Computed
    isLoggedIn,
    role,
    isAdmin,
    // Actions
    initialize,
    login,
    register,
    logout,
    refreshToken,
    changePassword,
    fetchProfile,
  }
})

import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ============ Request Interceptor: Auto-attach JWT ============
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('go_home_access_token')
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// ============ Response Interceptor: 401 → Auto Refresh ============
let isRefreshing = false
let pendingRequests = []

apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't try to refresh on the refresh endpoint itself
      if (originalRequest.url?.includes('/auth/refresh')) {
        // Refresh failed — force logout
        clearAuthAndRedirect()
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve) => {
          pendingRequests.push(() => resolve(apiClient(originalRequest)))
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const refreshToken = localStorage.getItem('go_home_refresh_token')
        if (!refreshToken) {
          throw new Error('No refresh token')
        }

        const res = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken })
        const data = res.data.data || res.data
        const { accessToken, refreshToken: newRefreshToken } = data

        localStorage.setItem('go_home_access_token', accessToken)
        localStorage.setItem('go_home_refresh_token', newRefreshToken)

        // Retry all queued requests
        pendingRequests.forEach((cb) => cb())
        pendingRequests = []

        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`
        return apiClient(originalRequest)
      } catch (refreshError) {
        pendingRequests = []
        clearAuthAndRedirect()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    // Format error message
    if (error.response) {
      const msg = error.response.data?.error?.message
        || error.response.data?.error
        || error.response.data?.message
        || `请求失败 (${error.response.status})`
      error.message = msg
    } else if (error.request) {
      error.message = '网络连接失败，请检查网络'
    }

    return Promise.reject(error)
  }
)

function clearAuthAndRedirect() {
  localStorage.removeItem('go_home_access_token')
  localStorage.removeItem('go_home_refresh_token')
  localStorage.removeItem('go_home_user_info')
  // Only redirect if not already on login page
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login'
  }
}

export default apiClient
export { entriesApi } from './entries'
export { userApi } from './user'
export { authApi } from './auth'
export { adminApi } from './admin'
export { statsApi } from './stats'

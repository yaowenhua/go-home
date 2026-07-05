import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Device ID management
function getDeviceId() {
  let deviceId = localStorage.getItem('go_home_device_id')
  if (!deviceId) {
    deviceId =
      crypto.randomUUID?.() ||
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      })
    localStorage.setItem('go_home_device_id', deviceId)
  }
  return deviceId
}

apiClient.interceptors.request.use((config) => {
  config.headers['X-Device-Id'] = getDeviceId()
  return config
})

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      console.error(`API Error ${error.response.status}:`, error.response.data)
      throw new Error(error.response.data?.error || '请求失败')
    }
    if (error.request) {
      console.error('Network error')
      throw new Error('网络连接失败，请检查网络')
    }
    throw error
  }
)

export default apiClient
export { userApi } from './user'
export { entriesApi } from './entries'

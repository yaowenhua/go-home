import apiClient from './index'

export const userApi = {
  /** GET /api/users/profile?userId=xxx — 获取用户信息 */
  getProfile: (userId) => apiClient.get(`/users/profile?userId=${userId}`),

  /** PUT /api/users/profile — 创建或更新用户信息 */
  updateProfile: (data) => apiClient.put('/users/profile', data),

  /** POST /api/users — 创建用户 */
  create: (data) => apiClient.post('/users', data),

  /** GET /api/users — 获取所有用户 */
  getAll: () => apiClient.get('/users'),
}

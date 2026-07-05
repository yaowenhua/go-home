import apiClient from './index'

export const adminApi = {
  /** GET /api/admin/users — 用户列表（分页+搜索） */
  listUsers: (params = {}) =>
    apiClient.get('/admin/users', { params }),

  /** GET /api/admin/users/:id — 用户详情 */
  getUser: (id) =>
    apiClient.get(`/admin/users/${id}`),

  /** POST /api/admin/users/:id/reset-password — 重置密码 */
  resetPassword: (userId) =>
    apiClient.post(`/admin/users/${userId}/reset-password`),

  /** PUT /api/admin/users/:id/status — 启用/禁用用户 */
  toggleUserStatus: (userId, status) =>
    apiClient.put(`/admin/users/${userId}/status`, { status }),

  /** GET /api/admin/stats — 统计总览 */
  getStatsOverview: () =>
    apiClient.get('/admin/stats'),

  /** GET /api/admin/stats/dau-trend — DAU 趋势 */
  getDAUTrend: (days = 30) =>
    apiClient.get('/admin/stats/dau-trend', { params: { days } }),
}

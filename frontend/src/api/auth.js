import apiClient from './index'

export const authApi = {
  /** POST /api/auth/login — 手机号密码登录 */
  login: (data) => apiClient.post('/auth/login', data),

  /** POST /api/auth/register — 手机号注册 */
  register: (data) => apiClient.post('/auth/register', data),

  /** POST /api/auth/logout — 登出 */
  logout: () => apiClient.post('/auth/logout'),

  /** POST /api/auth/refresh — 刷新 Token */
  refresh: (data) => apiClient.post('/auth/refresh', data),

  /** POST /api/auth/change-password — 修改密码 */
  changePassword: (data) => apiClient.post('/auth/change-password', data),

  /** POST /api/auth/reset-password — 重置密码（验证码） */
  resetPassword: (data) => apiClient.post('/auth/reset-password', data),

  /** POST /api/auth/send-code — 发送短信验证码 */
  sendCode: (phone) => apiClient.post('/auth/send-code', { phone }),

  /** GET /api/users/me — 获取当前用户信息 */
  getMe: () => apiClient.get('/users/me'),
}

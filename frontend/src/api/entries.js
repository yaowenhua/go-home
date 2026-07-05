import apiClient from './index'

export const entriesApi = {
  /** GET /api/entries/by-date?date=YYYY-MM-DD — 获取某日记录 */
  getByDate: (entryDate) => apiClient.get(`/entries/by-date?date=${entryDate}`),

  /** GET /api/entries — 获取全部记录（带可选过滤参数） */
  getList: (params = {}) => apiClient.get('/entries', { params }),

  /** POST /api/entries — 创建记录 */
  create: (data) => apiClient.post('/entries', data),

  /** PUT /api/entries/:id — 更新记录 */
  update: (id, data) => apiClient.put(`/entries/${id}`, data),

  /** DELETE /api/entries/:id — 删除记录 */
  delete: (id) => apiClient.delete(`/entries/${id}`),
}

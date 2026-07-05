import apiClient from './index'

export const statsApi = {
  /** GET /api/stats/summary — 统计总览 */
  getOverview: () =>
    apiClient.get('/stats/summary'),

  /** GET /api/stats/dau — 当日 DAU */
  getDAU: () =>
    apiClient.get('/stats/dau'),

  /** GET /api/stats/wau — 本周 WAU */
  getWAU: () =>
    apiClient.get('/stats/wau'),

  /** GET /api/stats/mau — 本月 MAU */
  getMAU: () =>
    apiClient.get('/stats/mau'),

  /** GET /api/stats/dau-trend — DAU 趋势数据 */
  getDAUTrend: (params = {}) =>
    apiClient.get('/stats/dau-trend', { params }),
}

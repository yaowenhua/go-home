import apiClient from './index'

export const activityApi = {
  /**
   * POST /api/activity/page-view — 登录态上报浏览页面（A2 埋点）
   * 仅登录用户调用；失败由调用方 .catch(() => {}) 兜底，零影响主流程。
   */
  reportPageView: (path) =>
    apiClient.post('/activity/page-view', { path }),
}

/**
 * 管理后台独立路由配置
 * 被 src/router/index.js 导入使用
 *
 * 注意：每条路由显式设置 requiresAdmin: true，
 * 因为 Vue Router 4 中 route.meta 不会从父路由继承
 */
export default [
  {
    path: 'users',
    name: 'AdminUsers',
    component: () => import('../views/admin/AdminUsers.vue'),
    meta: { title: '用户管理', requiresAuth: true, requiresAdmin: true },
  },
  {
    path: 'users/:id',
    name: 'AdminUserDetail',
    component: () => import('../views/admin/AdminUserDetail.vue'),
    meta: { title: '用户详情', requiresAuth: true, requiresAdmin: true },
  },
  {
    path: 'stats',
    name: 'AdminStats',
    component: () => import('../views/admin/AdminStats.vue'),
    meta: { title: '数据统计', requiresAuth: true, requiresAdmin: true },
  },
]

import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView,
      meta: { title: '用量看板' },
    },
    {
      path: '/conversations',
      name: 'conversations',
      component: () => import('@/views/ConversationsView.vue'),
      meta: { title: '会话明细' },
    },
  ],
})

router.afterEach((to) => {
  const title = to.meta?.title as string | undefined
  document.title = title ? `${title} · CodeBuddy 用量看板` : 'CodeBuddy 用量看板'
})

export default router

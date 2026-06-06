import { createRouter, createWebHistory } from 'vue-router'
import SetupView from '../views/SetupView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'setup', component: SetupView },
    { path: '/race', name: 'race', component: () => import('../views/RaceView.vue') },
    { path: '/history', name: 'history', component: () => import('../views/HistoryView.vue') },
  ],
})

export default router

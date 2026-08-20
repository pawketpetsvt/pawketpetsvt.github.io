import { createRouter, createWebHashHistory } from 'vue-router'
import { AppState } from './AppState.js'

const routes = [
  { path: '/', redirect: '/my-pets' },
  { path: '/login', name: 'login', component: () => import('./pages/LoginPage.vue') },
  { path: '/register', name: 'register', component: () => import('./pages/RegisterPage.vue') },
  { path: '/adopt', name: 'adopt', component: () => import('./pages/AdoptPage.vue'), meta: { requiresAuth: true } },
  { path: '/my-pets', name: 'my-pets', component: () => import('./pages/MyPetsPage.vue'), meta: { requiresAuth: true } }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !AppState.user) {
    return { name: 'login' }
  }
})

export default router

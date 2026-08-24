import { createRouter, createWebHashHistory } from 'vue-router'
import { AppState } from './AppState.js'

const ComingSoonPage = () => import('./pages/ComingSoonPage.vue')

// Tabs not yet migrated get a ComingSoonPage stub with a display name —
// same route shape as the real ones so later phases just swap the component.
const stubTabs = [
  { tab: 'twitch', name: 'Twitch' },
  { tab: 'redeem', name: 'Redeem' },
  { tab: 'battle', name: 'Battle Arena' },
  { tab: 'racing', name: 'Racing' },
  { tab: 'housing', name: 'Housing' },
  { tab: 'guild', name: 'Guild' }
]

const routes = [
  { path: '/', redirect: '/home' },

  // Guest routes
  { path: '/login', name: 'login', component: () => import('./pages/LoginPage.vue') },
  { path: '/register', name: 'register', component: () => import('./pages/RegisterPage.vue') },
  { path: '/forgot', name: 'forgot', component: () => import('./pages/ForgotPasswordPage.vue') },
  { path: '/reset-password', name: 'reset-password', component: () => import('./pages/ResetPasswordPage.vue') },

  // Real tabs
  { path: '/home', name: 'home', component: () => import('./pages/HomePage.vue'), meta: { requiresAuth: true, tabKey: 'home' } },
  { path: '/adopt', name: 'adopt', component: () => import('./pages/AdoptPage.vue'), meta: { requiresAuth: true, tabKey: 'adopt' } },
  { path: '/mypets', name: 'mypets', component: () => import('./pages/MyPetsPage.vue'), meta: { requiresAuth: true, tabKey: 'mypets' } },
  { path: '/journal', name: 'journal', component: () => import('./pages/JournalPage.vue'), meta: { requiresAuth: true, tabKey: 'journal' } },
  { path: '/news', name: 'news', component: () => import('./pages/NewsPage.vue'), meta: { requiresAuth: true, tabKey: 'news' } },
  { path: '/privacy', name: 'privacy', component: () => import('./pages/PrivacyPage.vue'), meta: { requiresAuth: true, tabKey: 'privacy' } },
  { path: '/settings', name: 'settings', component: () => import('./pages/SettingsPage.vue'), meta: { requiresAuth: true, tabKey: 'settings' } },
  { path: '/team', name: 'team', component: () => import('./pages/TeamPage.vue'), meta: { requiresAuth: true, tabKey: 'team' } },
  { path: '/shop', name: 'shop', component: () => import('./pages/ShopPage.vue'), meta: { requiresAuth: true, tabKey: 'shop' } },
  { path: '/cooking', name: 'cooking', component: () => import('./pages/CookingPage.vue'), meta: { requiresAuth: true, tabKey: 'cooking' } },
  { path: '/minigames', name: 'minigames', component: () => import('./pages/MinigamesPage.vue'), meta: { requiresAuth: true, tabKey: 'minigames' } },
  { path: '/fishing', name: 'fishing', component: () => import('./pages/FishingPage.vue'), meta: { requiresAuth: true, tabKey: 'fishing' } },
  { path: '/friends', name: 'friends', component: () => import('./pages/FriendsPage.vue'), meta: { requiresAuth: true, tabKey: 'friends' } },
  { path: '/leaderboard', name: 'leaderboard', component: () => import('./pages/LeaderboardPage.vue'), meta: { requiresAuth: true, tabKey: 'leaderboard' } },
  { path: '/forum', name: 'forum', component: () => import('./pages/ForumPage.vue'), meta: { requiresAuth: true, tabKey: 'forum' } },
  { path: '/stats', name: 'stats', component: () => import('./pages/StatsPage.vue'), meta: { requiresAuth: true, tabKey: 'stats' } },
  { path: '/myprofile', name: 'myprofile', component: () => import('./pages/MyProfilePage.vue'), meta: { requiresAuth: true, tabKey: 'myprofile' } },
  { path: '/profile/:username', name: 'profile', component: () => import('./pages/ProfilePage.vue'), meta: { requiresAuth: true, tabKey: 'profile' } },

  // Stubbed tabs — not built this phase
  ...stubTabs.map(({ tab, name }) => ({
    path: '/' + tab,
    name: tab,
    component: ComingSoonPage,
    meta: { requiresAuth: true, tabKey: tab, displayName: name }
  }))
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

router.afterEach((to) => {
  if (to.meta.tabKey) AppState.tabKey = to.meta.tabKey
})

export default router

import { createRouter, createWebHashHistory } from 'vue-router'
import { AppState } from './AppState.js'
import { streamerLandingState } from './services/StreamerLandingService.js'

const ComingSoonPage = () => import('./pages/ComingSoonPage.vue')

// Tabs not yet migrated get a ComingSoonPage stub with a display name —
// same route shape as the real ones so later phases just swap the component.
// Every tab now has a real page. The stub machinery stays: it costs nothing and
// is what a new tab would use.
const stubTabs = []

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
  { path: '/battle', name: 'battle', component: () => import('./pages/BattlePage.vue'), meta: { requiresAuth: true, tabKey: 'battle' } },
  { path: '/housing', name: 'housing', component: () => import('./pages/HousingPage.vue'), meta: { requiresAuth: true, tabKey: 'housing' } },
  { path: '/racing', name: 'racing', component: () => import('./pages/RacingPage.vue'), meta: { requiresAuth: true, tabKey: 'racing' } },
  { path: '/twitch', name: 'twitch', component: () => import('./pages/TwitchPage.vue'), meta: { requiresAuth: true, tabKey: 'twitch' } },
  { path: '/redeem', name: 'redeem', component: () => import('./pages/RedeemPage.vue'), meta: { requiresAuth: true, tabKey: 'redeem' } },
  { path: '/guild', name: 'guild', component: () => import('./pages/GuildPage.vue'), meta: { requiresAuth: true, tabKey: 'guild' } },
  // The destination of a shared room link. Legacy generated these URLs but never
  // registered a handler for them — see RoomVisitPage's header.
  { path: '/room/:username', name: 'room-visit', component: () => import('./pages/RoomVisitPage.vue'), meta: { requiresAuth: true, tabKey: 'housing' } },

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
    // Someone who arrived through a streamer's `?streamer=` link is a new
    // visitor being invited, not a returning player — legacy's landing sent
    // them straight to the register form (streamerLanding_buildHero's closing
    // `showAuthSection('register')`), so the sign-in page is the wrong door.
    if (streamerLandingState.member) return { name: 'register' }
    return { name: 'login' }
  }
  if (to.name === 'login' && !AppState.user && streamerLandingState.member) {
    return { name: 'register' }
  }
})

router.afterEach((to) => {
  if (to.meta.tabKey) AppState.tabKey = to.meta.tabKey
})

export default router

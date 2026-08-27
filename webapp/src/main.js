import { createApp, watch } from 'vue'
import { AppState } from './AppState.js'
import { awardService } from './services/AwardService.js'
import { adminService } from './services/AdminService.js'
import App from './App.vue'
// Imported BEFORE the router: Twitch's OAuth flow returns its token in the URL
// fragment, and this app uses hash history — so the fragment has to be read and
// stripped at module load, before the router tries to resolve it as a route.
// This import is the side effect; TwitchPage picks the token up on mount.
import './services/TwitchService.js'
import router from './router.js'
import { authService } from './services/AuthService.js'
import { companionService } from './services/CompanionService.js'
import { weatherService } from './services/WeatherService.js'
import { vTooltip } from './directives/tooltip.js'
import '../../style.css'
// Must come after style.css — Bootstrap's utilities are !important, style.css
// is saturated with !important, and equal-specificity ties break by source
// order. See the header comment in bootstrap.scss.
import './assets/scss/bootstrap.scss'

authService.subscribeToAuthChanges(() => {
  router.push('/reset-password')
})

// Registered here rather than from CompanionBuddy.vue's onMounted: a watcher
// created inside a component is stopped when that component unmounts, so the
// companion would stop following log-out/log-in. These have to outlive both.
companionService.init()

// Weather is shared by every player and rotates every six hours. Started here
// rather than from the Home page because it applies a `body.weather-*` class the
// whole site is styled against, and Fishing reads it for its weather-gated
// legendaries whether or not Home has been visited this session.
weatherService.init().catch(err => console.error('[weather] init failed:', err))

// Warms the earned-badge / earned-title caches so awardBadge() can short-circuit
// without a DB round trip on the common "already has it" path — legacy did the
// same from showApp(). Re-warmed whenever the signed-in user changes.
watch(() => AppState.user && AppState.user.id, id => {
  if (!id) return
  awardService.load()
    .then(() => adminService.refresh())
    .catch(err => console.error('[awards] warm failed:', err))
}, { immediate: true })

authService.restoreSession().finally(() => {
  const app = createApp(App)
  app.directive('tooltip', vTooltip)
  app.use(router).mount('#app')
})

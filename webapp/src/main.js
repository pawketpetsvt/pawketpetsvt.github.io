import { createApp, watch } from 'vue'
import { AppState } from './AppState.js'
import { awardService } from './services/AwardService.js'
import { adminService } from './services/AdminService.js'
import { bingoService } from './services/BingoService.js'
import { weeklyChallengeService } from './services/WeeklyChallengeService.js'
import { communityGoalService } from './services/CommunityGoalService.js'
import { argLogService } from './services/ArgLogService.js'
import { cosmeticUnlockService } from './services/CosmeticUnlockService.js'
import { giftService } from './services/GiftService.js'
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
import { worldEventService } from './services/WorldEventService.js'
import { ppHistoryService } from './services/PPHistoryService.js'
import { vTooltip } from './directives/tooltip.js'
// The design system, formerly the 18,816-line root style.css (Phase 11). It is
// now nine themed partials under assets/scss/; anything used by a single
// component moved into that component's own <style scoped> block.
import './assets/scss/globals.scss'
// Must come after globals — Bootstrap's utilities are !important, the design
// system is saturated with !important, and equal-specificity ties break by
// source order. See the header comment in bootstrap.scss.
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

// The world event is the other half of the same chrome, and the same reasoning
// applies: its bonuses are read by the shop, battle rewards, expeditions and
// energy regen, none of which should depend on a particular page having been
// opened. One event is live for the whole community at a time, decided by the
// server; this only asks what it is.
ppHistoryService.load()
worldEventService.init().catch(err => console.error('[worldEvents] init failed:', err))

// Warms the earned-badge / earned-title caches so awardBadge() can short-circuit
// without a DB round trip on the common "already has it" path — legacy did the
// same from showApp(). Re-warmed whenever the signed-in user changes.
watch(() => AppState.user && AppState.user.id, id => {
  if (!id) return
  awardService.load()
    .then(() => adminService.refresh())
    .catch(err => console.error('[awards] warm failed:', err))
  bingoService.load().catch(err => console.error('[bingo] load failed:', err))
  argLogService.load().catch(err => console.error('[argLogs] load failed:', err))
  cosmeticUnlockService.load().catch(err => console.error('[cosmetics] load failed:', err))
  giftService.refreshCount().catch(() => {})
  weeklyChallengeService.load()
}, { immediate: true })

// Bingo and the weekly challenges are TaskTracker SUBSCRIBERS — the two systems
// that bus was built for. Registered here, not in a component: legacy funnelled
// every "player did X" through updateBingoProgress(), so these must hear about
// actions taken anywhere in the app, not just while a panel is open.
bingoService.subscribe()
weeklyChallengeService.subscribe()
// Community goals are a third subscriber. Their contributions are batched and
// flushed, so they must keep accumulating while the player is anywhere in the
// app — not only while the Home page is mounted.
communityGoalService.subscribe()
communityGoalService.installUnloadFlush()

authService.restoreSession().finally(() => {
  const app = createApp(App)
  app.directive('tooltip', vTooltip)
  app.use(router).mount('#app')
})

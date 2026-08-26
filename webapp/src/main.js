import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import { authService } from './services/AuthService.js'
import { companionService } from './services/CompanionService.js'
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

authService.restoreSession().finally(() => {
  const app = createApp(App)
  app.directive('tooltip', vTooltip)
  app.use(router).mount('#app')
})

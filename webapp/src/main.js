import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import { authService } from './services/AuthService.js'
import { vTooltip } from './directives/tooltip.js'
import '../../style.css'

authService.subscribeToAuthChanges(() => {
  router.push('/reset-password')
})

authService.restoreSession().finally(() => {
  const app = createApp(App)
  app.directive('tooltip', vTooltip)
  app.use(router).mount('#app')
})

import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import { authService } from './services/AuthService.js'
import '../../css/style.css'
import '../../css/style-additions.css'

authService.restoreSession().finally(() => {
  createApp(App).use(router).mount('#app')
})

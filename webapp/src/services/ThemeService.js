import { AppState } from '../AppState.js'
import { THEME_CATALOG } from '../data/themeCatalog.js'

// Ports theme_isUnlocked/theme_apply/theme_loadSaved, game.js:465-512.
// PawketPass-gated themes (passLevel) always report locked here — PawketPass
// itself isn't migrated yet, so there's no real level to check against.
// Streak-gated themes work fully since AppState.player.login_streak is real.
class ThemeService {
  isUnlocked(themeId) {
    const t = THEME_CATALOG.find(x => x.id === themeId)
    if (!t) return false
    if (t.alwaysUnlocked) return true
    if (t.streakRequired && AppState.player && (AppState.player.login_streak || 0) >= t.streakRequired) return true
    try {
      const list = JSON.parse(localStorage.getItem('unlockedThemes') || '[]')
      if (list.includes(themeId)) return true
    } catch (e) {}
    return false
  }

  apply(themeId, toastService) {
    if (!this.isUnlocked(themeId)) {
      toastService.warning('🔒 Theme not unlocked yet!')
      return
    }
    THEME_CATALOG.forEach(t => document.body.classList.remove('theme-' + t.id))
    if (themeId !== 'classic') document.body.classList.add('theme-' + themeId)
    const key = AppState.user ? 'playerSettings_' + AppState.user.id : 'playerSettings_guest'
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '{}')
      saved.active_theme = themeId
      localStorage.setItem(key, JSON.stringify(saved))
    } catch (e) {}
  }

  loadSaved() {
    const key = AppState.user ? 'playerSettings_' + AppState.user.id : 'playerSettings_guest'
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '{}')
      if (saved.active_theme) this.apply(saved.active_theme, { warning: () => {} })
      return saved.active_theme || 'classic'
    } catch (e) {
      return 'classic'
    }
  }
}

export const themeService = new ThemeService()

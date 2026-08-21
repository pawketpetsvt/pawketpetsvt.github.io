import { reactive } from 'vue'
import { supabase } from './SupabaseService.js'
import { musicService, musicState } from './MusicService.js'

const COLORBLIND_FILTERS = {
  none: '',
  deuteranopia: "url('#cb-deuteranopia')",
  protanopia: "url('#cb-protanopia')",
  tritanopia: "url('#cb-tritanopia')"
}

// Mirrors game.js's playerSettings shape (game.js:437-451). Only
// spooky_enabled is persisted server-side (players.spooky_enabled); everything
// else is localStorage-only, matching the original's own behavior — not a
// simplification introduced by this migration.
export const settingsState = reactive({
  spooky_enabled: false,
  sfx_volume: 80,
  daynight_enabled: true,
  weather_enabled: true,
  colorblind_mode: 'none',
  reduced_motion: false,
  high_contrast: false,
  large_text: false
})

class SettingsService {
  // Ports loadSettings(), game.js:33808-33882 (DOM-sync parts omitted —
  // components read settingsState/musicState reactively instead).
  async load(userId) {
    const localRaw = localStorage.getItem('playerSettings_' + userId)
    if (localRaw) {
      try {
        const saved = JSON.parse(localRaw)
        Object.assign(settingsState, saved)
        if (saved.music_enabled !== undefined) musicState.enabled = saved.music_enabled
        if (saved.music_volume !== undefined) musicService.setVolume(saved.music_volume)
      } catch (e) {}
    }

    const { data } = await supabase.from('players').select('spooky_enabled').eq('id', userId).maybeSingle()
    if (data) settingsState.spooky_enabled = data.spooky_enabled || false

    this.applyAccessibility()
    musicState.enabled ? musicService.play() : musicService.pause()
  }

  // Ports saveSettings(), game.js:33884-33943.
  async save(userId) {
    await supabase.from('players').update({ spooky_enabled: settingsState.spooky_enabled }).eq('id', userId)
    localStorage.setItem('playerSettings_' + userId, JSON.stringify({
      ...settingsState,
      music_enabled: musicState.enabled,
      music_volume: musicState.volume
    }))
    this.applyAccessibility()
  }

  // Ports applyAccessibilitySettings(), game.js:396-403.
  applyAccessibility() {
    document.documentElement.style.filter = COLORBLIND_FILTERS[settingsState.colorblind_mode] || ''
    document.body.classList.toggle('reduced-motion', !!settingsState.reduced_motion)
    document.body.classList.toggle('high-contrast', !!settingsState.high_contrast)
    document.body.classList.toggle('large-text', !!settingsState.large_text)
  }
}

export const settingsService = new SettingsService()

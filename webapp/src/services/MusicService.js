import { reactive } from 'vue'

// Single source of truth for the background music element, shared between
// NavBar.vue's quick controls and SettingsPage.vue's enabled/volume settings
// — previously these would've been two disconnected pieces of state.
export const musicState = reactive({
  enabled: true,
  volume: 70,
  playing: false
})

let audioEl = null

class MusicService {
  registerElement(el) {
    audioEl = el
    audioEl.volume = musicState.volume / 100
  }

  play() {
    if (!audioEl) return
    audioEl.play().then(() => { musicState.playing = true }, () => {})
  }

  pause() {
    if (!audioEl) return
    audioEl.pause()
    musicState.playing = false
  }

  toggle() {
    if (!audioEl) return
    audioEl.paused ? this.play() : this.pause()
  }

  stop() {
    if (!audioEl) return
    audioEl.pause()
    audioEl.currentTime = 0
    musicState.playing = false
  }

  setEnabled(on) {
    musicState.enabled = on
    on ? this.play() : this.pause()
  }

  setVolume(v) {
    musicState.volume = v
    if (audioEl) audioEl.volume = v / 100
  }
}

export const musicService = new MusicService()

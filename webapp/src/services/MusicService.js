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

// Battle music state, kept module-local like `audioEl` above.
const BATTLE_TRACKS = {
  normal: '/music/normalfightsong.mp3',
  boss: '/music/bossong.mp3',
  piper: '/music/pipersong.ogg'
}
const BATTLE_VOLUMES = { piper: 0.28, boss: 0.22, normal: 0.18 }

let battleAudio = null
let battleTrack = null
let fadeTimer = null
// The element a fade-out is currently working on. `stopBattleTrack` clears
// `battleAudio` immediately but defers the actual pause() into the fade timer,
// so without this handle a second stop (or a new battle starting inside the
// 0.8s fade) cancels the timer and leaves that element playing with nothing
// referencing it — the boss theme carrying on over the next track.
let fadingAudio = null
let bgWasPlaying = false

// 1s ramp in 20 steps, matching legacy's fade.
function fadeIn(audio) {
  const target = BATTLE_VOLUMES[battleTrack] ?? 0.18
  let ticks = 0
  const timer = setInterval(() => {
    if (!audio || audio !== battleAudio) { clearInterval(timer); return }
    ticks++
    audio.volume = Math.min(target, ticks * (target / 20))
    if (ticks >= 20) clearInterval(timer)
  }, 50)
}

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

  // ── battle tracks ─────────────────────────────────────────────────────────
  // Ports the BattleMusic object (game.js:10035-10132). Folded in here rather
  // than ported as a second audio owner: BattleMusic reached into the page to
  // pause `#bg-music` directly and kept its own enabled-flag reading of
  // localStorage, which could disagree with the real settings. Routing it
  // through this service means one owner and one notion of "music is off".
  //
  // Per-track target volumes are legacy's: Piper is loudest, then boss, then
  // the normal fight theme.
  playBattleTrack(key) {
    if (!musicState.enabled) return
    if (battleTrack === key && battleAudio && !battleAudio.paused) return

    this.stopBattleTrack(false)
    battleTrack = key
    const src = BATTLE_TRACKS[key]
    if (!src) return

    // Remember whether the background music was running so it can be resumed
    // exactly as it was.
    bgWasPlaying = !!(audioEl && !audioEl.paused)
    if (bgWasPlaying) this.pause()

    const audio = new Audio(src)
    audio.loop = true
    audio.volume = 0
    audio.onerror = () => {
      console.error('[musicService] battle track unavailable:', src)
      battleAudio = null
      this.stopBattleTrack(false)
    }
    battleAudio = audio
    audio.play().then(() => fadeIn(audio), () => {
      // Autoplay blocked — leave the background music as it was.
      battleAudio = null
      battleTrack = null
      if (bgWasPlaying) this.play()
    })
  }

  stopBattleTrack(fade = true) {
    // Cancel any fade still in flight AND hard-stop the element it was fading.
    // Clearing the timer alone is what orphaned it: `battleAudio` was already
    // nulled when that fade began, so the code below finds nothing to pause.
    if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null }
    if (fadingAudio) {
      fadingAudio.pause()
      fadingAudio.src = ''
      fadingAudio = null
    }

    const audio = battleAudio
    battleAudio = null
    battleTrack = null

    if (bgWasPlaying) {
      bgWasPlaying = false
      if (musicState.enabled) this.play()
    }
    if (!audio) return

    if (!fade || audio.volume < 0.01) {
      audio.pause()
      audio.src = ''
      return
    }
    const startVol = audio.volume
    let ticks = 0
    fadingAudio = audio
    fadeTimer = setInterval(() => {
      ticks++
      audio.volume = Math.max(0, startVol * (1 - ticks / 16))
      if (ticks >= 16) {
        clearInterval(fadeTimer)
        fadeTimer = null
        audio.pause()
        audio.src = ''
        if (fadingAudio === audio) fadingAudio = null
      }
    }, 50)
  }
}

export const musicService = new MusicService()

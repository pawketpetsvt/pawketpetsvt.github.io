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
// Piper's theme was the only Ogg Vorbis file in the game, which is very likely
// why hers was the one track reported as not playing: Safari and iOS cannot
// decode Ogg in <audio> at all, so `onerror` fired, the track was dropped and
// the failure was silent apart from a console line. Re-encoded to 320k MP3
// (same duration, matching normalfightsong's bitrate) so all three battle
// tracks are one format that every browser handles.
//
// Tradeoff accepted deliberately: these tracks loop, and MP3's encoder
// delay/padding puts a few milliseconds of silence at the loop point where
// Vorbis loops seamlessly. The other two battle themes are already MP3 and
// already have that gap, so this is consistent rather than a new flaw.
const BATTLE_TRACKS = {
  normal: '/music/normalfightsong.mp3',
  boss: '/music/bossong.mp3',
  piper: '/music/pipersong.mp3'
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

  // Ports startBossMusicGlitchFade() / simpleMusicFade() (game.js:19290-19384).
  // The boss theme comes apart over 6 seconds as the death screen fades in:
  // the volume falls on an exponential curve, playback slows to half speed, a
  // lowpass sweeps 1000Hz -> 100Hz, and there is a 15% chance per 50ms tick of
  // a random stutter to 0.3-0.7x that snaps back after 100ms.
  //
  // Deliberately does NOT resume the background music or clear `bgWasPlaying`
  // — the sequence this belongs to ends by signing out and reloading, and the
  // caller stops the track properly at the very end.
  glitchFadeBattleTrack(durationMs = 6000) {
    const audio = battleAudio
    if (!audio) return

    // Cancel the ordinary fade so the two are not both driving the volume.
    if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null }

    const startVolume = audio.volume
    let gain = null
    let filter = null

    // Web Audio gives the filter sweep; without it this degrades to legacy's
    // `simpleMusicFade` fallback — volume and playback rate only.
    const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
    if (Ctx) {
      try {
        // `createMediaElementSource` may be called only ONCE per element, and
        // after it is, the element routes through the graph instead of straight
        // to the speakers. `battleAudio` is a fresh element per fight, so the
        // handle is parked on the element rather than in a module global the
        // way legacy did it — legacy's `window.bossAudioSource` guard meant the
        // SECOND boss fight of a session reused the first fight's node, which
        // belonged to an element that had already been torn down.
        if (!audio._ppGraph) {
          const ctx = new Ctx()
          const source = ctx.createMediaElementSource(audio)
          const g = ctx.createGain()
          const f = ctx.createBiquadFilter()
          f.type = 'lowpass'
          f.frequency.value = 1000
          source.connect(f)
          f.connect(g)
          g.connect(ctx.destination)
          audio._ppGraph = { ctx, gain: g, filter: f }
        }
        gain = audio._ppGraph.gain
        filter = audio._ppGraph.filter
      } catch (e) {
        console.warn('[musicService] Web Audio unavailable, plain fade instead:', e)
      }
    }

    const startTime = Date.now()
    fadingAudio = audio
    fadeTimer = setInterval(() => {
      const progress = Math.min((Date.now() - startTime) / durationMs, 1)

      if (progress >= 1) {
        clearInterval(fadeTimer)
        fadeTimer = null
        audio.pause()
        if (fadingAudio === audio) fadingAudio = null
        return
      }

      const volumeFade = Math.pow(1 - progress, 2)
      if (gain) gain.gain.value = volumeFade
      else audio.volume = Math.max(0, startVolume * volumeFade)

      audio.playbackRate = 1 - progress * 0.5
      if (filter) filter.frequency.value = 1000 - progress * 900

      if (Math.random() < 0.15) {
        audio.playbackRate = 0.3 + Math.random() * 0.4
        setTimeout(() => {
          if (fadingAudio === audio) audio.playbackRate = Math.max(0.5, 1 - progress * 0.5)
        }, 100)
      }
    }, 50)
  }
}

export const musicService = new MusicService()

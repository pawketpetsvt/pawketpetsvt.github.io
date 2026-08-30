// Battle sound effects and celebration bleeps.
//
// Ports the `battleSounds` / `playBattleSound` / `getBattleSoundKey` /
// `playChiptune` block from the legacy game.js (main:57-278). None of it was
// carried across in Phase 7 — that phase folded battle MUSIC into MusicService
// and the per-hit SFX were missed — so nine files in `sounds/` sat unreferenced
// and the live site's combat audio was silently absent from the Vue app.
// `settingsState.sfx_volume` had a slider in Settings that controlled nothing.
//
// Music lives in MusicService. This owns only short, overlapping one-shots, and
// the two have to stay separate: battle music is a single long-lived element
// that fades, whereas a hit sound is cloned per play so two hits can overlap.

import { settingsState } from './SettingsService.js'

// `defeat` is deliberately absent. Legacy declares `/sounds/defeat.mp3` but the
// file has never existed in the repo, and legacy's own auto-battle call site is
// commented out with "Disabled - file missing". `victory.mp3` does exist and is
// used, so it is here.
const BATTLE_SOUNDS = {
  playerLight:  '/sounds/hit-light.mp3',
  playerNormal: '/sounds/hit-normal.mp3',
  playerCrit:   '/sounds/hit-crit.mp3',
  enemyLight:   '/sounds/enemy-hit-light.mp3',
  enemyNormal:  '/sounds/enemy-hit-normal.mp3',
  enemyCrit:    '/sounds/enemy-hit-crit.mp3',
  // The boss set is Piper's flute — soft, main, then distorted.
  bossLight:    '/sounds/piper-flute-light.mp3',
  bossNormal:   '/sounds/piper-flute-normal.mp3',
  bossCrit:     '/sounds/piper-flute-crit.mp3',
  victory:      '/sounds/victory.mp3'
}

// Minimum gap between sounds, so a fast exchange doesn't stack into noise.
// Legacy's GAME_CONSTANTS.SOUND_COOLDOWN_MS.
const COOLDOWN_MS = 300

// The three the player hears first and most often; loaded up front when a
// battle starts so the opening exchange isn't silent while they fetch. Legacy
// did this from a one-shot document click listener; a battle starting is both
// a more precise moment and a real user gesture, which is what browsers
// actually require before audio may play.
const PRIORITY = ['playerNormal', 'enemyNormal', 'playerCrit']

class SoundService {
  constructor() {
    this.cache = {}          // key -> HTMLAudioElement | null (null = failed to load)
    this.lastPlayed = 0
    this.ctx = null          // lazily created AudioContext for the chiptune bleeps
  }

  // 0..1. A slider at 0 mutes everything this service plays.
  get sfxVolume() {
    const v = settingsState.sfx_volume
    return v == null ? 0.35 : v / 100
  }

  load(key) {
    if (key in this.cache) return this.cache[key]
    // battle-smoke.mjs drives the real BattleService under plain Node, where
    // there is no Audio constructor. Sound is a presentation concern the engine
    // should never depend on, so it goes quiet rather than throwing.
    if (typeof Audio === 'undefined') return null
    const src = BATTLE_SOUNDS[key]
    if (!src) return null
    const audio = new Audio(src)
    audio.volume = 0.35
    audio.preload = 'auto'
    // A missing file caches as null so it is attempted once, not every hit.
    audio.onerror = () => { this.cache[key] = null }
    this.cache[key] = audio
    return audio
  }

  preloadBattle() {
    for (const key of PRIORITY) this.load(key)
  }

  // `force` bypasses the rate limit — legacy passes it for boss attacks so
  // Piper's flute is never the sound that gets dropped.
  play(key, volume = null, force = false) {
    const userSFX = this.sfxVolume
    if (userSFX <= 0) return

    const now = Date.now()
    if (!force && now - this.lastPlayed < COOLDOWN_MS) return
    this.lastPlayed = now

    const audio = this.load(key)
    if (!audio) return

    // Cloned so overlapping hits each get their own playback head; replaying
    // one element would cut the previous hit off mid-sound.
    const sound = audio.cloneNode()
    sound.volume = volume != null ? Math.min(volume, userSFX) : userSFX * 0.6
    sound.play().catch(() => {})   // autoplay policy, or the file is missing
  }

  // Ports getBattleSoundKey(): variance is the damage roll's -1 / 0 / +1, which
  // is what makes a glancing hit and a crit sound different.
  hit(source, variance = 0, isCrit = false) {
    const key = this.keyFor(source, isCrit ? 1 : variance)
    // Boss hits bypass the cooldown, as in legacy.
    this.play(key, null, source === 'boss')
  }

  // Ports the sound half of the auto-battle log playback (main:16900-16940),
  // used by the Starter Dungeon. Its volumes are deliberately LOWER than a
  // manual battle's and are not the same for every tier: entries replay every
  // 420ms, so a crit at full volume in that cadence is jarring. Legacy's own
  // figures, kept rather than rounded — the comments there record them as
  // deliberate reductions from an earlier, louder pass.
  logEntry(entry, isBossBattle = false) {
    if (!entry || entry.variance === undefined) return
    const crit = entry.variance === 1

    if (entry.type === 'player_attack') {
      this.play(this.keyFor('player', entry.variance), crit ? 0.08 : 0.21)
    } else if (entry.type === 'enemy_attack') {
      if (isBossBattle) {
        // Louder than an ordinary enemy for light/normal, quieter on a crit,
        // and allowed to overlap so the flute is never the sound that drops.
        this.play(this.keyFor('boss', entry.variance), crit ? 0.26 : 0.42, true)
      } else {
        this.play(this.keyFor('enemy', entry.variance), crit ? 0.08 : 0.18)
      }
    }
  }

  keyFor(source, variance) {
    const prefix = source === 'player' ? 'player' : source === 'boss' ? 'boss' : 'enemy'
    return prefix + (variance === -1 ? 'Light' : variance === 0 ? 'Normal' : 'Crit')
  }

  // ── Chiptune celebration bleeps ─────────────────────────────────────────
  // Web Audio, no files — a few square-wave notes. Ports playChiptune().
  chiptune(type) {
    const SEQUENCES = {
      milestone: [[523, 80], [659, 80], [784, 80], [1047, 160]],              // C E G C
      levelup:   [[392, 70], [523, 70], [659, 70], [784, 70], [1047, 120]],   // G C E G C
      badge:     [[659, 80], [784, 80], [1047, 130]],                         // E G C
      variant:   [[784, 70], [1047, 70], [1319, 70], [1568, 140]]             // sparkly high
    }
    const userSFX = this.sfxVolume
    if (userSFX <= 0) return

    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)() } catch { return }
    }
    const ctx = this.ctx
    if (!ctx) return

    try {
      const notes = SEQUENCES[type] || SEQUENCES.milestone
      let t = ctx.currentTime + 0.01
      for (const [freq, ms] of notes) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'square'
        osc.frequency.setValueAtTime(freq, t)
        // Legacy hardcodes 0.04 and ignores the SFX slider entirely. Scaled
        // here instead: the setting is labelled "SFX Volume" and a celebration
        // bleep is an SFX, so a player who muted SFX should not still hear it.
        gain.gain.setValueAtTime(0.04 * userSFX, t)
        gain.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000)
        osc.start(t)
        osc.stop(t + ms / 1000 + 0.02)
        t += ms / 1000
      }
    } catch { /* an AudioContext can be refused or suspended; silence is fine */ }
  }
}

export const soundService = new SoundService()

import { reactive } from 'vue'
import { supabase } from './SupabaseService.js'
import { WEATHER_TYPES, WEATHER_BONUS_TYPE, ROTATION_HOURS } from '../data/weatherData.js'
import { worldStateService } from './WorldStateService.js'

// Ports weatherSystem (game.js:32593+) — the shared six-hourly weather.
//
// Pulled forward from the navbar tier deliberately: it is a dependency of work
// that has already shipped. Phase 4 built four weather-gated legendary fish
// (ghost_fish / storm_eel / void_fish / aurora_cod) that have been uncatchable
// because `currentWeather` always evaluated to 'clear', and the companion's
// weather dialogue could never fire for the same reason.
//
// NOT ported here, and left for the navbar phase:
//   • the `#event-status-widget` navbar chrome (its own ~580-line system)
//   • adpocalypse_start/stop — the Ad-pocalypse popup-ad event, ~1,386 lines
//   • addCursedGlitches() — decorative, and part of the ARG glitch layer
export const weatherState = reactive({
  current: null,
  loaded: false
})

const LS_WEATHER = 'currentWeather'
const LS_SET_AT = 'weatherSetAt'
const ROTATION_MS = ROTATION_HOURS * 3600000

class WeatherService {
  constructor() {
    this.timer = null
    this.today = null
  }

  byId(id) {
    return WEATHER_TYPES.find(w => w.id === id) || null
  }

  // World-state corruption raises the odds of Cursed Fog. Read from the cache
  // only, exactly as legacy's generateWeather() does via
  // getWorldStateValueSync() — the roll must not block on a network call, and a
  // slightly stale corruption value is harmless here.
  corruptionLevel() {
    return worldStateService.corruptionSync()
  }

  async init() {
    this.today = new Date().toISOString().slice(0, 10)

    // Warm the world-state cache first so corruptionLevel() — which is a
    // synchronous cache read — has a real value if generate() ends up running.
    // Legacy fires the same warm-up, but doesn't await it.
    await worldStateService.loadFlags().catch(() => {})

    let loaded = await this.loadFromDb()
    if (!loaded) loaded = this.loadFromCache()
    if (!loaded) {
      this.generate()
      this.syncToDb().catch(() => {})
    }

    this.apply()
    this.startRotationChecker()
    weatherState.loaded = true
  }

  // Everyone shares one sky, so the DB row wins over anything cached locally.
  async loadFromDb() {
    try {
      const { data, error } = await supabase
        .from('daily_features')
        .select('weather, created_at')
        .eq('date', this.today)
        .maybeSingle()
      if (error || !data || !data.weather) return false

      // A row from earlier in the day is stale once the rotation window passes.
      if (data.created_at && Date.now() - new Date(data.created_at).getTime() > ROTATION_MS) return false

      const id = typeof data.weather === 'object' ? data.weather.id : data.weather
      const weather = this.byId(id)
      if (!weather) return false

      this.set(weather)
      return true
    } catch (e) {
      return false
    }
  }

  loadFromCache() {
    try {
      const raw = localStorage.getItem(LS_WEATHER)
      const at = parseInt(localStorage.getItem(LS_SET_AT), 10)
      if (!raw || !at || Date.now() - at >= ROTATION_MS) return false
      const cached = JSON.parse(raw)
      const weather = this.byId(cached && cached.id)
      if (!weather) return false
      weatherState.current = weather
      return true
    } catch (e) {
      return false
    }
  }

  set(weather) {
    weatherState.current = weather
    try {
      localStorage.setItem(LS_WEATHER, JSON.stringify(weather))
      localStorage.setItem(LS_SET_AT, String(Date.now()))
    } catch (e) { /* private mode */ }
  }

  // Ports generateWeather(). Starry Night only rolls at night, so it doesn't
  // waste its weight during the day; Cursed Fog scales from weight 2 at zero
  // corruption up to 20 at full.
  generate() {
    const hour = new Date().getHours()
    const isNight = hour >= 18 || hour < 6
    const corruption = this.corruptionLevel()

    const pool = WEATHER_TYPES
      .filter(w => isNight || w.id !== 'starry')
      // Ad-pocalypse is excluded while its popup-ad system is unmigrated.
      // Rolling it would announce "Ads appear!" and then produce none, which is
      // worse than not rolling it — the opposite trade-off from Phase 4's
      // weather-gated fish, where the feature simply stayed unreachable.
      // Restore this line's removal when that system lands.
      .filter(w => w.id !== 'adpocalypse')
      .map(w => w.id === 'cursed' ? { ...w, weight: 2 + (corruption / 100) * 18 } : w)

    const total = pool.reduce((s, w) => s + w.weight, 0)
    let roll = Math.random() * total
    for (const w of pool) {
      roll -= w.weight
      if (roll <= 0) { this.set(w); break }
    }
    if (!weatherState.current) this.set(pool[0])
  }

  async syncToDb() {
    if (!weatherState.current) return
    try {
      await supabase.from('daily_features').upsert({
        date: this.today,
        weather: weatherState.current.id,
        bonus_type: WEATHER_BONUS_TYPE[weatherState.current.id] || 'normal'
      }, { onConflict: 'date' })
    } catch (e) {
      console.error('[weatherService.syncToDb]', e)
    }
  }

  // Only the body class is applied. style.css already carries every
  // `body.weather-*` rule — they survived the Phase 6.75 CSS cut precisely
  // because they are applied dynamically rather than written in the markup.
  apply() {
    if (!weatherState.current) return
    const root = document.body
    for (const w of WEATHER_TYPES) root.classList.remove('weather-' + w.id)
    root.classList.add('weather-' + weatherState.current.id)
  }

  startRotationChecker() {
    if (this.timer) return
    // Checks every 5 minutes whether the six-hour window has rolled over.
    this.timer = setInterval(() => this.checkRotation(), 5 * 60 * 1000)
  }

  async checkRotation() {
    let at = 0
    try { at = parseInt(localStorage.getItem(LS_SET_AT), 10) || 0 } catch (e) { at = 0 }
    if (Date.now() - at < ROTATION_MS) return
    this.today = new Date().toISOString().slice(0, 10)
    if (!(await this.loadFromDb())) {
      this.generate()
      this.syncToDb().catch(() => {})
    }
    this.apply()
  }

  stop() {
    clearInterval(this.timer)
    this.timer = null
  }

  // What the rest of the game asks. Returns the id ('clear', 'rainy', …) so
  // callers can compare without reaching into the object.
  currentId() {
    return (weatherState.current && weatherState.current.id) || 'clear'
  }
}

export const weatherService = new WeatherService()

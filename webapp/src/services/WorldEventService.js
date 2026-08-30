import { reactive } from 'vue'
import { supabase } from './SupabaseService.js'
import { WORLD_EVENTS, EFFECT_LABELS } from '../data/worldEventData.js'

// Ports the `worldEvents` object (game.js:10064-10420).
//
// One event is live at a time for the WHOLE community. Legacy's own comment
// records that this used to be localStorage-only — every browser rolled its own
// "world" event — and was made genuinely shared via `active_world_event` and the
// row-locked `roll_world_event()` RPC. That server-side roll is what is ported
// here; the client only supplies the candidate list and reads back the answer.
//
// The event's bonuses are real gameplay multipliers, and this is what makes
// them reachable again: `bonus()` / `applyModifier()` / `hasEffect()` are
// consumed by the shop, battle rewards and energy regen, all of which have been
// running at a flat 1.0 in the Vue app because this system was unmigrated.
export const worldEventState = reactive({
  event: null,     // the WORLD_EVENTS entry, or null for "no event"
  endsAt: null,    // Date, or null
  loaded: false
})

const ROLL_INTERVAL_MS = 3600000 // legacy re-checks hourly

class WorldEventService {
  constructor() {
    this.timer = null
    this.inflight = null
  }

  byId(id) {
    return WORLD_EVENTS.find(e => e.id === id) || null
  }

  async init() {
    await this.roll()
    if (!this.timer) this.timer = setInterval(() => this.roll(), ROLL_INTERVAL_MS)
  }

  stop() {
    clearInterval(this.timer)
    this.timer = null
  }

  // Ports rollEvent(). The RPC decides whether the current event has expired
  // and, if so, atomically picks the next one (or "no event", which it returns
  // as a null event_id ~30% of the time). Only the id and end date come back —
  // the effects are client-side data, so a candidate the client doesn't know
  // resolves to null rather than to a half-populated event.
  async roll() {
    if (this.inflight) return this.inflight
    this.inflight = (async () => {
      try {
        const candidates = WORLD_EVENTS.map(e => ({ id: e.id, duration: e.duration }))
        const res = await supabase.rpc('roll_world_event', { p_candidates: candidates })
        if (res.error || !res.data) return
        const data = res.data
        if (!data.event_id) {
          worldEventState.event = null
          worldEventState.endsAt = null
        } else {
          worldEventState.event = this.byId(data.event_id)
          worldEventState.endsAt = data.ends_at ? new Date(data.ends_at) : null
        }
      } catch (e) {
        console.error('[worldEventService.roll]', e)
      } finally {
        worldEventState.loaded = true
        this.inflight = null
      }
    })()
    return this.inflight
  }

  currentId() {
    return worldEventState.event ? worldEventState.event.id : null
  }

  // Ports getActiveBonus(). Returns 1.0 with no event, so every call site can
  // multiply unconditionally.
  bonus(effectKey) {
    const ev = worldEventState.event
    if (!ev || !ev.effects) return 1.0
    const v = ev.effects[effectKey]
    return typeof v === 'number' ? v : 1.0
  }

  // Ports hasActiveEffect() — the boolean-flag effects (luckBonus, voidBlessing…).
  hasEffect(effectKey) {
    const ev = worldEventState.event
    return !!(ev && ev.effects && ev.effects[effectKey] === true)
  }

  // Ports applyEventModifier(). Floors, as legacy does.
  applyModifier(baseValue, effectKey) {
    return Math.floor(baseValue * this.bonus(effectKey))
  }

  // How long is left, for the tooltip. Legacy recomputed this on a 60s timer
  // writing into an element by id; a caller can just ask.
  hoursRemaining() {
    if (!worldEventState.endsAt) return null
    return Math.max(0, Math.floor((worldEventState.endsAt.getTime() - Date.now()) / 3600000))
  }

  // Ports esw_getEventBonusText() and getEffectsDisplay(), which legacy keeps as
  // two separate partial tables — see the bug note on EFFECT_LABELS. Returns
  // one line per effect.
  bonusLines(effects) {
    const src = effects || (worldEventState.event && worldEventState.event.effects)
    if (!src) return []
    const lines = []
    for (const [key, value] of Object.entries(src)) {
      const label = EFFECT_LABELS[key]
      if (!label) continue
      const pct = v => Math.round(Math.abs(1 - v) * 100)
      if (label.dir === 'flag') {
        if (value === true) lines.push(`${label.icon} ${label.label}`)
      } else if (label.dir === 'pct') {
        if (value > 0) lines.push(`${label.icon} ${Math.round(value * 100)}% ${label.label}`)
      } else if (label.dir === 'mult') {
        if (value > 1) lines.push(`${label.icon} ${value}x ${label.label}`)
      } else if (label.dir === 'down') {
        // A multiplier below 1 is the benefit here (0.7 shop discount = 30% off).
        if (value < 1) lines.push(`${label.icon} ${pct(value)}% ${label.label}`)
      } else if (value > 1) {
        lines.push(`${label.icon} +${pct(value)}% ${label.label}`)
      }
    }
    return lines
  }
}

export const worldEventService = new WorldEventService()

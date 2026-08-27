import { reactive } from 'vue'
import { PERK_TYPES, perkMultiplierFrom } from '../data/guildData.js'

// Ports the guild-perk half of the treasury system: _activeGuildPerks,
// getActivePerkMultiplier, applyGuildPerk, clearGuildPerks and the restore half
// of loadActiveGuildPerks (game.js:7551-7641).
//
// Kept in its own service rather than inside GuildService because its READERS
// are Shop, Battle and Expeditions — none of which should have to import the
// whole guild system to ask "is a discount running?".
//
// Perks live in localStorage keyed by guild id, exactly as legacy stored them.
// That is genuinely per-device rather than a source of truth worth moving
// server-side: the vote that granted the perk IS recorded in
// guild_treasury_votes, so this cache is only a fast local read of it.

export const perkState = reactive({
  // { [effectType]: { multiplier, expiresAt, guildId } }
  active: {}
})

const key = (guildId, type) => 'guild_perk_' + guildId + '_' + type

class GuildPerkService {
  // Returns 1.0 when no perk applies, so every call site can multiply
  // unconditionally.
  multiplier(effectType) {
    const perk = perkState.active[effectType]
    if (!perk) return 1.0
    if (Date.now() > perk.expiresAt) {
      delete perkState.active[effectType]
      return 1.0
    }
    return perk.multiplier || 1.0
  }

  apply(guildId, effectType, effectValue, durationHours) {
    if (!guildId) return
    const perk = {
      multiplier: perkMultiplierFrom(effectType, effectValue),
      expiresAt: Date.now() + durationHours * 3600000,
      guildId
    }
    perkState.active[effectType] = perk
    try { localStorage.setItem(key(guildId, effectType), JSON.stringify(perk)) } catch { /* private mode */ }
  }

  // Restores this guild's perks and drops anything expired or belonging to a
  // guild the player has since left — legacy's guild-scoped key exists for
  // exactly that reason.
  restore(guildId) {
    if (!guildId) {
      PERK_TYPES.forEach(t => delete perkState.active[t])
      return
    }
    const now = Date.now()
    PERK_TYPES.forEach(t => {
      try {
        const raw = localStorage.getItem(key(guildId, t))
        if (!raw) return
        const p = JSON.parse(raw)
        if (p.expiresAt > now && p.guildId === guildId) {
          perkState.active[t] = p
        } else {
          localStorage.removeItem(key(guildId, t))
          delete perkState.active[t]
        }
      } catch { /* unreadable entry — treat as absent */ }
    })
  }

  clear(guildId) {
    PERK_TYPES.forEach(t => {
      try { localStorage.removeItem(key(guildId, t)) } catch { /* private mode */ }
      delete perkState.active[t]
    })
    try { localStorage.removeItem('guild_perks') } catch { /* legacy key */ }
  }

  // What the guild view lists at the top. Sorted so the banner order is stable.
  activeList() {
    const now = Date.now()
    return PERK_TYPES
      .filter(t => perkState.active[t] && perkState.active[t].expiresAt > now)
      .map(t => ({ type: t, ...perkState.active[t] }))
  }

  // Legacy pruned with a 60s interval registered at module scope. Kept, since
  // an expired perk should stop showing in the banner without a navigation.
  startPruning() {
    if (this._pruning) return
    this._pruning = true
    setInterval(() => {
      const now = Date.now()
      PERK_TYPES.forEach(t => {
        const p = perkState.active[t]
        if (p && p.expiresAt <= now) {
          delete perkState.active[t]
          if (p.guildId) {
            try { localStorage.removeItem(key(p.guildId, t)) } catch { /* private mode */ }
          }
        }
      })
    }, 60000)
  }
}

export const guildPerkService = new GuildPerkService()

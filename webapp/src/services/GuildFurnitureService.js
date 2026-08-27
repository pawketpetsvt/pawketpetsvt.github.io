import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { playerService } from './PlayerService.js'
import { guildState, GuildError } from './GuildService.js'
import {
  GUILD_FURNITURE_CATALOG, guildFurnitureSlots, PP_PER_GUILD_TOKEN
} from '../data/guildFurnitureData.js'

const EMPTY_BUFFS = () => ({
  attack: 0, defense: 0, speed: 0, luck: 0, spirit: 0,
  xp_bonus: 0, pp_bonus: 0, hp_regen: 0, happiness_max: 0, corruption_resist: 0
})

// Ports the GUILD HOUSING SYSTEM block (game.js:21679-21988) — the Guild Hall.
//
// Distinct from FurnitureService, which owns the per-pet and per-player rooms.
// This furniture is bought with guild TOKENS and its buffs apply to every pet
// owned by every member.
class GuildFurnitureService {
  constructor() {
    this._cache = null
    this._cacheGuildId = null
  }

  def(key) {
    return GUILD_FURNITURE_CATALOG.find(f => f.key === key) || null
  }

  slots() {
    return guildFurnitureSlots(guildState.myGuild?.guild_level)
  }

  invalidate() {
    this._cache = null
    this._cacheGuildId = null
  }

  async loadPlaced(force = false) {
    const g = guildState.myGuild
    if (!g) return []
    // Cache is per-guild: leaving and joining another must not inherit the old
    // hall's furniture. Legacy's single global cache had no such guard.
    if (!force && this._cache && this._cacheGuildId === g.guild_id) return this._cache
    const { data } = await supabase
      .from('guild_furniture')
      .select('*')
      .eq('guild_id', g.guild_id)
      .order('slot_index', { ascending: true })
    this._cache = data || []
    this._cacheGuildId = g.guild_id
    return this._cache
  }

  // Ports guild_getFurnitureBuffs().
  //
  // LEGACY BUG — the Champion's Hall loses its speed bonus. Legacy applied
  // `buff.stat`/`buff.amount`, then had exactly ONE extra line for a second
  // stat: `if (b.defense) buffs.defense += b.defense`. Champion's Hall is
  // `{ stat: 'attack', amount: 5, defense: 3, speed: 2 }` and its own
  // description promises "+5 ATK, +3 DEF, +2 SPD" — so the +2 SPD was silently
  // dropped on an 800-token, guild-level-8 item. Here every numeric key on the
  // buff object is applied, so a future multi-stat item can't fall through the
  // same gap.
  async buffs() {
    const totals = EMPTY_BUFFS()
    if (!guildState.myGuild) return totals

    for (const placed of await this.loadPlaced()) {
      const def = this.def(placed.furniture_key)
      if (!def || !def.buff) continue
      const b = def.buff
      if (b.stat && totals[b.stat] !== undefined) totals[b.stat] += b.amount || 0
      for (const [key, value] of Object.entries(b)) {
        if (key === 'stat' || key === 'amount') continue
        if (typeof value === 'number' && totals[key] !== undefined) totals[key] += value
      }
    }
    return totals
  }

  // Ports guild_placeFurniture(). Officers only — enforced by the caller and
  // re-checked here.
  async place(furnitureKey, slotIndex) {
    const g = guildState.myGuild
    if (!g) throw new GuildError('You are not in a guild.')

    const def = this.def(furnitureKey)
    if (!def) throw new GuildError('Unknown furniture.')

    if (def.requiresLevel && (g.guild_level || 1) < def.requiresLevel) {
      throw new GuildError(`${def.name} needs Guild Level ${def.requiresLevel}.`)
    }

    const tokens = g.guild_tokens || 0
    if (tokens < def.cost) throw new GuildError('Not enough tokens!')

    // Slot is upserted, so an existing occupant is replaced. Legacy deleted
    // first AND upserted; the upsert alone does it.
    const newTokens = tokens - def.cost
    await supabase.from('guilds').update({ guild_tokens: newTokens }).eq('id', g.guild_id)
    g.guild_tokens = newTokens

    const { error } = await supabase.from('guild_furniture').upsert({
      guild_id: g.guild_id,
      slot_index: slotIndex,
      furniture_key: furnitureKey,
      placed_by: AppState.user.id,
      placed_at: new Date().toISOString()
    }, { onConflict: 'guild_id,slot_index' })

    if (error) {
      // Refund rather than charging for furniture that never landed — legacy
      // left the tokens spent here.
      await supabase.from('guilds').update({ guild_tokens: tokens }).eq('id', g.guild_id)
      g.guild_tokens = tokens
      throw new GuildError('Error placing furniture: ' + error.message)
    }

    this.invalidate()
    return def
  }

  async remove(slotIndex) {
    const g = guildState.myGuild
    if (!g) return
    await supabase.from('guild_furniture')
      .delete().eq('guild_id', g.guild_id).eq('slot_index', slotIndex)
    this.invalidate()
  }

  // Ports guild_donateForTokens(). PP goes to the guild as tokens, NOT to the
  // treasury — a separate currency from guild_treasury.
  async donateForTokens(amount) {
    const g = guildState.myGuild
    if (!g) return
    amount = parseInt(amount, 10)
    if (!amount || amount < PP_PER_GUILD_TOKEN) {
      throw new GuildError(`Minimum donation is ${PP_PER_GUILD_TOKEN} PP.`)
    }
    // Rounded down to a whole number of tokens so no PP is spent on a fraction.
    amount = Math.floor(amount / PP_PER_GUILD_TOKEN) * PP_PER_GUILD_TOKEN
    if ((AppState.player?.pawketpoints || 0) < amount) throw new GuildError('Not enough PP!')

    const spent = await playerService.spendPoints(amount, 'guild_token_donation')
    if (spent === null) throw new GuildError('Error spending PP. Please try again.')

    const gain = Math.floor(amount / PP_PER_GUILD_TOKEN)
    const newTokens = (g.guild_tokens || 0) + gain
    const { error } = await supabase.from('guilds')
      .update({ guild_tokens: newTokens }).eq('id', g.guild_id)
    if (error) {
      await playerService.awardPoints(amount, 'guild_token_donation_refund').catch(() => {})
      throw new GuildError('Could not credit tokens. Your PP has been refunded.')
    }
    g.guild_tokens = newTokens
    return { amount, gain }
  }
}

export const guildFurnitureService = new GuildFurnitureService()

import { reactive } from 'vue'
import { passService } from './PassService.js'
import { communityGoalService } from './CommunityGoalService.js'
import { petMoodService } from './PetMoodService.js'
import * as badgeHooks from './BadgeHooks.js'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { toastService } from './ToastService.js'
import { taskTracker } from './TaskTrackerService.js'
import {
  RACING_DAILY_SESSIONS, RACING_DAILY_RACES, RACING_FITNESS_DECAY,
  RACING_TRAINING_TYPES, RACING_LEAGUE_TIERS, RACING_SHOP,
  RACING_LEAGUE_REWARDS, RACING_PLACEMENT_PTS
} from '../data/racingData.js'

// Beating every streamer phantom pays a flat bonus on top of the placement
// reward. Legacy hardcodes this at the call site.
const BEAT_ALL_BONUS_PP = 150

// Ports the racing_* family (game.js:25588-26690) — the Racing tab's Train,
// League and Shop halves. The Quick Race engine is RaceEngine.js.
//
// Tables: `pet_racing_stats` (per pet: fitness + three trained ratings),
// `pet_racing_equipment` (one row per pet per slot), `player_league` (per
// account: tier + this week's points and races), `race_history` (one row per
// race, also the daily race-count source).
export const racingState = reactive({
  selectedPetId: null,
  stats: null,          // pet_racing_stats row for the selected pet
  equip: {},            // slot -> shop item object (what's worn)
  owned: [],            // item_key[] (what's been bought — see loadOwned)
  league: null,         // player_league row
  sessionsLeft: RACING_DAILY_SESSIONS,
  racesLeft: RACING_DAILY_RACES,
  loading: false
})

const today = () => new Date().toISOString().slice(0, 10)

class RacingService {
  // ── league ────────────────────────────────────────────────────────────────
  // Ports racing_loadLeagueState(), including its create-on-first-visit.
  async loadLeague() {
    if (!AppState.user) return null
    const res = await supabase.from('player_league')
      .select('*').eq('user_id', AppState.user.id).maybeSingle()

    if (res.data) {
      racingState.league = res.data
      return res.data
    }

    const ins = await supabase.from('player_league').insert([{
      user_id: AppState.user.id, league: 'bronze', weekly_points: 0, weekly_races: 0
    }]).select().maybeSingle()
    racingState.league = ins.data || { league: 'bronze', weekly_points: 0, weekly_races: 0 }
    return racingState.league
  }

  tier() {
    return (racingState.league && racingState.league.league) || 'bronze'
  }

  tierIndex() {
    return RACING_LEAGUE_TIERS.indexOf(this.tier())
  }

  // Promotion needs 3+ races AND 12+ points; relegation is <2 races OR <4 pts.
  leagueOutlook() {
    const l = racingState.league || {}
    const pts = l.weekly_points || 0
    const races = l.weekly_races || 0
    const tier = this.tier()
    const canPromote = tier !== 'champion' && races >= 3 && pts >= 12
    const atRisk = (races < 2 || pts < 4) && tier !== 'bronze'
    return {
      pts, races, canPromote, atRisk,
      nextTier: RACING_LEAGUE_TIERS[this.tierIndex() + 1] || null,
      prevTier: RACING_LEAGUE_TIERS[this.tierIndex() - 1] || null
    }
  }

  // ── pet selection ─────────────────────────────────────────────────────────
  // Ports racing_selectPet(): pulls the pet's base stats, its racing stats
  // (applying fitness decay and the daily session reset), its equipment, and
  // how many races are left today.
  async selectPet(petId) {
    if (!AppState.user || !petId) return
    racingState.loading = true
    racingState.selectedPetId = petId

    try {
      await Promise.all([
        this.loadRacingStats(petId),
        // Ownership falls back to the equipped set, so equipment loads first.
        this.loadEquipment(petId).then(() => this.loadOwned(petId)),
        this.loadRacesLeft()
      ])
    } finally {
      racingState.loading = false
    }
  }

  async loadRacingStats(petId) {
    const res = await supabase.from('pet_racing_stats')
      .select('*').eq('pet_id', petId).eq('user_id', AppState.user.id).maybeSingle()

    if (!res.data) {
      const ins = await supabase.from('pet_racing_stats')
        .insert([{ user_id: AppState.user.id, pet_id: petId, fitness: 50 }])
        .select().maybeSingle()
      racingState.stats = ins.data ||
        { fitness: 50, pace_rating: 0, stamina_rating: 0, interference_rating: 0, sessions_today: 0 }
      racingState.sessionsLeft = RACING_DAILY_SESSIONS
      return
    }

    const stats = { ...res.data }

    // Fitness decays 2 points per day since the last training session.
    if (stats.last_trained_at) {
      const last = new Date(stats.last_trained_at.slice(0, 10) + 'T00:00:00')
      const days = Math.floor((Date.now() - last.getTime()) / 86400000)
      if (days > 0) {
        stats.fitness = Math.max(0, (stats.fitness || 0) - days * RACING_FITNESS_DECAY)
        await supabase.from('pet_racing_stats').update({ fitness: stats.fitness }).eq('id', stats.id)
      }
    }

    // `last_trained_at` is stored as a date in some rows and a timestamptz in
    // others, so only the date portion is ever compared.
    if ((stats.last_trained_at ? stats.last_trained_at.slice(0, 10) : null) !== today()) {
      stats.sessions_today = 0
    }

    racingState.stats = stats
    racingState.sessionsLeft = RACING_DAILY_SESSIONS - (stats.sessions_today || 0)
  }

  async loadEquipment(petId) {
    const res = await supabase.from('pet_racing_equipment')
      .select('*').eq('pet_id', petId).eq('user_id', AppState.user.id)
    const equip = {}
    for (const row of res.data || []) {
      const item = (RACING_SHOP[row.slot] || []).find(i => i.key === row.item_key)
      if (item) equip[row.slot] = item
    }
    racingState.equip = equip
  }

  // What this pet owns, as opposed to what it currently has on.
  //
  // Legacy has no such table: `pet_racing_equipment` holds only the equipped
  // item per slot, so its shop derived "owned" from that same map, its
  // `owned && !equipped` branch was unreachable, and switching gear always
  // meant re-buying. `pet_racing_inventory` is what makes owning distinct from
  // wearing. An absent table degrades to "owns only what's equipped", i.e.
  // exactly the old behaviour, so the app still works before the SQL is run.
  async loadOwned(petId) {
    const res = await supabase.from('pet_racing_inventory')
      .select('item_key').eq('pet_id', petId).eq('user_id', AppState.user.id)
    if (res.error) {
      racingState.owned = Object.values(racingState.equip).filter(Boolean).map(i => i.key)
      return
    }
    racingState.owned = (res.data || []).map(r => r.item_key)
  }

  async loadRacesLeft() {
    const res = await supabase.from('race_history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', AppState.user.id)
      .eq('race_date', today())
    racingState.racesLeft = Math.max(0, RACING_DAILY_RACES - (res.count || 0))
  }

  // ── derived stats ─────────────────────────────────────────────────────────
  // Ports racing_calcStats(). Fitness scales everything except resilience,
  // which comes purely from the pet's defence.
  calcStats(pet, stats = racingState.stats, equip = racingState.equip) {
    if (!pet || !stats) return { pace: 30, stamina: 5, interference: 3, resilience: 3 }

    const fitness = (stats.fitness || 50) / 100
    const scale = 0.7 + fitness * 0.3
    const level = pet.level || 1
    const baseSpeed = pet.base_speed || 5
    const baseAttack = pet.base_attack || 5
    const baseDefense = pet.base_defense || 5

    let pace = Math.round((baseSpeed * 2 + (stats.pace_rating || 0) + level) * scale)
    let stamina = Math.max(3, Math.round((Math.floor(level / 2) + 5 + (stats.stamina_rating || 0)) * scale))
    let interference = Math.round((Math.floor(baseAttack / 2) + (stats.interference_rating || 0)) * scale)
    let resilience = Math.floor(baseDefense / 2)

    for (const item of Object.values(equip || {})) {
      if (!item) continue
      pace += item.pace || 0
      stamina += item.stamina || 0
      interference += item.interference || 0
      resilience += item.resilience || 0
      if (item.special === 'all_stats_10') {
        pace = Math.round(pace * 1.1)
        stamina = Math.round(stamina * 1.1)
        interference = Math.round(interference * 1.1)
        resilience = Math.round(resilience * 1.1)
      }
    }

    return {
      pace: Math.max(10, pace),
      stamina: Math.max(3, stamina),
      interference: Math.max(0, interference),
      resilience: Math.max(0, resilience)
    }
  }

  // ── training ──────────────────────────────────────────────────────────────
  // Ports racing_doTrain(). Prefers `racing_train_secure`, which validates the
  // session cap and applies the gain server-side, and falls back to a direct
  // write if that RPC isn't deployed.
  //
  // Legacy's fallback decides whether to fall back by sniffing the error string
  // for '404' / 'not found' / 'date' / 'type' / '400'. That is fragile and
  // silently swallows real failures it doesn't recognise; here ANY RPC error
  // falls back, and the reason is logged rather than guessed at.
  async train(type, pet) {
    if (!AppState.user || !racingState.selectedPetId || !racingState.stats) return false
    if (racingState.sessionsLeft <= 0) {
      toastService.info('No training sessions left today!')
      return false
    }
    const t = RACING_TRAINING_TYPES[type]
    if (!t) return false

    const stats = racingState.stats
    if ((stats.fitness || 0) < 30 && type !== 'rest') {
      toastService.info('Fitness too low! Your pet needs a rest day.')
      return false
    }
    if (t.energyCost > 0 && pet && (pet.energy || 0) < t.energyCost) {
      toastService.info(`Not enough energy! Need ${t.energyCost}.`)
      return false
    }

    if (t.energyCost > 0 && pet) {
      const next = Math.max(0, (pet.energy || 0) - t.energyCost)
      await supabase.from('user_pets').update({ energy: next }).eq('id', pet.id)
      pet.energy = next
    }

    const rpc = await supabase.rpc('racing_train_secure', {
      p_pet_id: racingState.selectedPetId,
      p_training_type: type
    })

    if (rpc.error || (rpc.data && rpc.data.error)) {
      console.warn('[racing.train] racing_train_secure unavailable, applying client-side:',
        (rpc.error && rpc.error.message) || (rpc.data && rpc.data.error))
      await this.trainLocally(t, stats)
    } else if (rpc.data && rpc.data.stats) {
      Object.assign(racingState.stats, rpc.data.stats)
      racingState.sessionsLeft = Math.max(0, RACING_DAILY_SESSIONS - (racingState.stats.sessions_today || 0))
    } else {
      racingState.sessionsLeft = Math.max(0, racingState.sessionsLeft - 1)
    }

    taskTracker.report('train_pet_racing')
    passService.addXP(3, 'racing')
    toastService.success(
      `${t.label} complete! +${t.gain} ${t.stat === 'fitness' ? 'Fitness' : 'Stat'}!`
    )
    return true
  }

  async trainLocally(t, stats) {
    const key = t.stat
    const value = Math.min(100, (stats[key] || 0) + t.gain)
    const sessions = (stats.sessions_today || 0) + 1

    await supabase.from('pet_racing_stats').update({
      [key]: value,
      sessions_today: sessions,
      // Sent as a timestamptz so Postgres casts it correctly whichever type the
      // column actually is.
      last_trained_at: today() + 'T00:00:00.000Z'
    }).eq('id', stats.id)

    stats[key] = value
    stats.sessions_today = sessions
    stats.last_trained_at = today()
    racingState.sessionsLeft = Math.max(0, RACING_DAILY_SESSIONS - sessions)
  }

  // ── race results ──────────────────────────────────────────────────────────
  // Ports racing_endRace()'s persistence half. `racing_record_result_secure`
  // owns the PP and league-point maths, so its values win when it answers; the
  // client-side table is only a fallback for when the RPC isn't deployed.
  //
  // The beat-all-streamers bonus is awarded separately because the server has
  // no knowledge of the phantom field — it only sees a placement.
  async recordResult(placement, totalRacers) {
    badgeHooks.onRaceFinished({ placement, league: this.tier ? this.tier() : null })
    passService.addXP(6, 'race')
    const league = this.tier()
    const rewards = RACING_LEAGUE_REWARDS[league] || RACING_LEAGUE_REWARDS.bronze
    let pp = rewards[Math.min(placement - 1, rewards.length - 1)] || 0
    let pts = RACING_PLACEMENT_PTS[Math.min(placement - 1, RACING_PLACEMENT_PTS.length - 1)] || 0
    const beatAll = placement === 1
    let bonus = 0

    const { playerService } = await import('./PlayerService.js')

    const res = await supabase.rpc('racing_record_result_secure', {
      p_pet_id: racingState.selectedPetId,
      p_placement: placement,
      p_total_racers: totalRacers,
      p_league: league
    })

    if (res.data && res.data.success) {
      pp = res.data.pp_earned ?? pp
      pts = res.data.league_pts ?? pts
      if (res.data.new_pp !== undefined && AppState.player) {
        AppState.player.pawketpoints = res.data.new_pp
      }
      if (racingState.league) {
        racingState.league.weekly_points = (racingState.league.weekly_points || 0) + pts
        racingState.league.weekly_races = (racingState.league.weekly_races || 0) + 1
      }
      if (beatAll) {
        bonus = BEAT_ALL_BONUS_PP
        await playerService.awardPoints(bonus, 'beat_all_streamers')
      }
    } else {
      console.warn('[racing.recordResult] racing_record_result_secure unavailable, awarding client-side:',
        res.error && res.error.message)
      if (pp > 0) await playerService.awardPoints(pp, 'quick_race')
      if (beatAll) {
        bonus = BEAT_ALL_BONUS_PP
        await playerService.awardPoints(bonus, 'beat_all_streamers')
      }
      if (racingState.league) {
        racingState.league.weekly_points = (racingState.league.weekly_points || 0) + pts
        racingState.league.weekly_races = (racingState.league.weekly_races || 0) + 1
      }
    }

    racingState.racesLeft = Math.max(0, racingState.racesLeft - 1)

    taskTracker.report('complete_race')
    // Legacy uses the selected pet id here too (main:26472).
    if (racingState.selectedPetId) petMoodService.completeWish(racingState.selectedPetId, 'race')
    if (placement <= 3) taskTracker.report('race_podium')
    communityGoalService.increment('races_completed')
    // Scaled by finishing position: 1st pays 10, 6th pays 5 (main:26462).
    passService.addXP(5 + Math.max(0, 6 - placement), 'racing')

    return { pp: pp + bonus, pts, beatAll, bonus }
  }

  // ── shop ──────────────────────────────────────────────────────────────────
  // Gear is buyable only once you have REACHED its tier.
  //
  // DELIBERATE CHANGE from legacy, at the user's request. Legacy locks only
  // what is two or more tiers above you (`itemTierIdx > tierIndex + 1`), which
  // means the next tier up is always purchasable early — a Bronze player can
  // buy Silver gear. Requiring the tier to be reached makes the league ladder
  // actually gate the equipment ladder.
  //
  // Enforced server-side too, in racing_buy_gear_secure — this check only
  // shapes the UI.
  isLocked(item) {
    return RACING_LEAGUE_TIERS.indexOf(item.league) > this.tierIndex()
  }

  isEquipped(slot, item) {
    return !!(racingState.equip[slot] && racingState.equip[slot].key === item.key)
  }

  owns(item) {
    return racingState.owned.includes(item.key)
  }

  // Ports racing_buyShopItem(), but through `racing_buy_gear_secure`, which
  // charges, records ownership and equips in one transaction — and charges
  // NOTHING for gear this pet already owns, which is the case legacy could not
  // express. The server owns the price list, so the client only names an item.
  //
  // Falls back to legacy's charge-then-upsert if that RPC isn't deployed, so
  // the shop still works before the SQL is applied.
  async buy(slot, itemKey) {
    if (!AppState.user || !racingState.selectedPetId) {
      toastService.info('Select a pet first!')
      return false
    }
    const item = (RACING_SHOP[slot] || []).find(i => i.key === itemKey)
    if (!item) return false

    const rpc = await supabase.rpc('racing_buy_gear_secure', {
      p_pet_id: racingState.selectedPetId,
      p_slot: slot,
      p_item_key: itemKey
    })

    if (!rpc.error && rpc.data) {
      if (rpc.data.success === false) {
        toastService.error(rpc.data.error || 'Purchase failed!')
        return false
      }
      // Recorded in PP History — the RPC charges server-side (it owns the price
      // list), so this never passes through spendPoints and would otherwise
      // leave the player's balance dropping with no entry to explain it.
      // `charged` is 0 for gear the pet already owns, which costs nothing.
      const charged = typeof rpc.data.charged === 'number' ? rpc.data.charged : item.price
      if (charged > 0) {
        // Lazily imported, matching this file's other PlayerService uses.
        const { playerService: ps } = await import('./PlayerService.js')
        await ps.noteExternalSpend(charged, 'racing_gear', rpc.data.points)
      } else if (AppState.player && typeof rpc.data.points === 'number') {
        AppState.player.pawketpoints = rpc.data.points
      }
      this.applyPurchase(slot, item)
      toastService.success(rpc.data.already_owned
        ? `${item.emoji} Equipped ${item.name}!`
        : `${item.emoji} Bought & equipped ${item.name}!`)
      return true
    }

    console.warn('[racing.buy] racing_buy_gear_secure unavailable, using legacy path:',
      rpc.error && rpc.error.message)
    return this.buyLegacy(slot, item)
  }

  applyPurchase(slot, item) {
    racingState.equip = { ...racingState.equip, [slot]: item }
    if (!racingState.owned.includes(item.key)) {
      racingState.owned = [...racingState.owned, item.key]
    }
  }

  async buyLegacy(slot, item) {
    const { playerService } = await import('./PlayerService.js')
    const remaining = await playerService.spendPoints(item.price, 'racing_shop')
    if (remaining === null) {
      toastService.error(`Not enough PP! Need ${item.price}.`)
      return false
    }

    const res = await supabase.from('pet_racing_equipment').upsert({
      user_id: AppState.user.id,
      pet_id: racingState.selectedPetId,
      slot,
      item_key: item.key
    }, { onConflict: 'user_id,pet_id,slot' })

    if (res.error) {
      toastService.error('Purchase failed!')
      return false
    }

    this.applyPurchase(slot, item)
    toastService.success(`${item.emoji} Bought & equipped ${item.name}!`)
    return true
  }
}

export const racingService = new RacingService()

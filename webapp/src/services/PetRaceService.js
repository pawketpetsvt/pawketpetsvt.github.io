import { reactive } from 'vue'
import { passService } from './PassService.js'
import { questService } from './QuestService.js'
import { petMoodService } from './PetMoodService.js'
import { achievementTierService } from './AchievementTierService.js'
import * as badgeHooks from './BadgeHooks.js'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { toastService } from './ToastService.js'
import { taskTracker } from './TaskTrackerService.js'
import { canPerformAction } from '../utils/RateLimit.js'

// Ports the Pet Racing mini-game (race_*, game.js:5348-5900) — the betting
// race on the Minigames tab. Distinct from the Racing TAB: this one is a wager
// on a single simulated dash, with no training, leagues or turn-by-turn play.
//
// It shares only `race_history` with the Racing tab, which is also where both
// read their daily race count from.

export const RACE_BETS = [10, 50, 100]
export const RACE_DAILY_MAX = 5
export const RACE_ENERGY_COST = 5

// Ports CPU_PETS — the field is topped up to four with these.
export const CPU_PETS = [
  { id: 'cpu1', nickname: 'Zippy', base_speed: 6, emoji: '🐇', isCpu: true },
  { id: 'cpu2', nickname: 'Sludge', base_speed: 3, emoji: '🐌', isCpu: true },
  { id: 'cpu3', nickname: 'Blaze', base_speed: 8, emoji: '🦊', isCpu: true },
  { id: 'cpu4', nickname: 'Pebble', base_speed: 4, emoji: '🐢', isCpu: true }
]

// The weighted-lottery model, ported with legacy's own reasoning intact:
//   tickets = FLOOR_TICKETS + (speed * trackMod) ^ SPEED_EXPONENT
//   score   = tickets * random()
// FLOOR_TICKETS gives even a Speed-4 starter a real underdog chance (~14%
// against three average opponents). SPEED_EXPONENT above 1 makes high-speed
// endgame pets genuinely dominant (Speed 12 ≈65%, 20 ≈82%, 28 ≈88%) without
// ever being unbeatable, and it scales to any speed ceiling without retuning.
const FLOOR_TICKETS = 8
const SPEED_EXPONENT = 1.4

export const petRaceState = reactive({
  tracks: [],
  selectedTrack: null,
  racesLeft: RACE_DAILY_MAX,
  loaded: false
})

class PetRaceService {
  async load() {
    if (!AppState.user) return
    await Promise.all([this.loadTracks(), this.loadRacesLeft()])
    petRaceState.loaded = true
  }

  // Tracks are optional — the race works without them, so a missing table is
  // not an error. Legacy makes the same allowance.
  async loadTracks() {
    try {
      const res = await supabase.from('race_tracks').select('*').order('id', { ascending: true })
      petRaceState.tracks = res.data || []
    } catch (e) {
      petRaceState.tracks = []
    }
  }

  async loadRacesLeft() {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const res = await supabase.from('race_history')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', AppState.user.id)
        .eq('race_date', today)
      petRaceState.racesLeft = Math.max(0, RACE_DAILY_MAX - (res.count || 0))
    } catch (e) {
      petRaceState.racesLeft = RACE_DAILY_MAX
    }
  }

  // Ports race_getTrackSpeedModifier() — a track can favour certain pet
  // variants, stored as a JSON percentage map on the track row.
  trackModifier(variant) {
    if (!petRaceState.selectedTrack) return 1
    const track = petRaceState.tracks.find(t => t.track_key === petRaceState.selectedTrack)
    if (!track) return 1
    try {
      const bonuses = typeof track.type_bonus === 'string'
        ? JSON.parse(track.type_bonus)
        : (track.type_bonus || {})
      return 1 + ((bonuses[variant] || 0) / 100)
    } catch (e) {
      return 1
    }
  }

  // Builds the four-lane field and rolls the result. Pure apart from the track
  // modifier lookup, so it can be reasoned about on its own.
  simulate(playerPets) {
    const lanes = playerPets.slice()
    const pool = CPU_PETS.slice().sort(() => Math.random() - 0.5)
    let i = 0
    while (lanes.length < 4) lanes.push(pool[i++] || CPU_PETS[0])

    const runners = lanes.map(pet => {
      const base = pet.base_speed || 4
      const mod = pet.isCpu ? 1 : this.trackModifier(pet.current_variant || null)
      const effectiveSpeed = base * mod
      const tickets = FLOOR_TICKETS + Math.pow(effectiveSpeed, SPEED_EXPONENT)
      return {
        pet,
        // "speed" here is the final race score, not a rate.
        speed: tickets * Math.random(),
        effectiveSpeed: Math.round(effectiveSpeed * 10) / 10,
        tickets: Math.round(tickets * 10) / 10
      }
    })

    runners.sort((a, b) => b.speed - a.speed)
    runners.forEach((r, idx) => { r.finishOrder = idx + 1 })
    return runners
  }

  // Ports the placement payout: 1st pays 1.5x-3x depending on how dominant the
  // win was, 2nd returns the stake plus a small bonus if it was close, 3rd
  // returns half, 4th loses it.
  payoutFor(runners, best, bet) {
    if (!best) return { payout: 0, profit: -bet }
    const avg = runners.reduce((s, r) => s + r.speed, 0) / runners.length
    const ratio = best.speed / (avg || 1)

    if (best.finishOrder === 1) {
      const mult = Math.min(3, 1.5 + ratio * 0.5)
      const payout = Math.round(bet * mult)
      return { payout, profit: payout - bet }
    }
    if (best.finishOrder === 2) {
      const bonus = ratio > 1 ? Math.round(bet * 0.2) : 0
      return { payout: bet + bonus, profit: bonus }
    }
    if (best.finishOrder === 3) {
      const payout = Math.round(bet * 0.5)
      return { payout, profit: payout - bet }
    }
    return { payout: 0, profit: -bet }
  }

  // Ports race_start()'s non-animation half.
  async run(playerPets, bet) {
    if (!AppState.user) return null
    if (!canPerformAction('race_start', 3000)) return null
    if (petRaceState.racesLeft <= 0) {
      toastService.info('No races left today!')
      return null
    }
    if (!playerPets.length) {
      toastService.info('Select at least 1 pet!')
      return null
    }
    if ((AppState.player?.pawketpoints || 0) < bet) {
      toastService.error('Not enough PP!')
      return null
    }
    for (const p of playerPets) {
      if ((p.energy || 0) < RACE_ENERGY_COST) {
        toastService.info(`${p.nickname || 'Your pet'} is too tired!`)
        return null
      }
    }

    const { playerService } = await import('./PlayerService.js')
    const runners = this.simulate(playerPets)
    const mine = runners.filter(r => !r.pet.isCpu)
    const best = mine[0] || null
    const won = !!best && best.finishOrder === 1
    const { payout, profit } = this.payoutFor(runners, best, bet)

    // The stake is taken up front, as legacy does, then the payout returned.
    await playerService.adjustPoints(-bet, 'race_bet')
    if (payout > 0) await playerService.awardPoints(payout, 'race_win')

    await this.spendEnergy(playerPets)
    await this.recordHistory(best, runners, bet, payout, won)
    if (best) await this.updateWeeklyScore(best.pet.id, won)

    petRaceState.racesLeft = Math.max(0, petRaceState.racesLeft - 1)
    taskTracker.report('complete_race')
    passService.addXP(5, 'race')
    if (best) questService.progress(best.pet.id, 'race')
    if (best) petMoodService.completeWish(best.pet.id, 'race')
    if (best) achievementTierService.check('race_wins', best.pet.id, won ? 1 : 0)
    badgeHooks.onPetRaceStarted()
    if (best && best.finishOrder <= 3) taskTracker.report('race_podium')

    return { runners, best, won, payout, profit, bet }
  }

  async spendEnergy(pets) {
    for (const p of pets) {
      const res = await supabase.rpc('adjust_pet_stat_secure', {
        p_pet_id: p.id, p_stat: 'energy', p_delta: -RACE_ENERGY_COST, p_reason: 'pet_race'
      })
      if (!res.error && res.data !== null && res.data !== undefined) p.energy = res.data
    }
  }

  // Ports updateWeeklyLeaderboard(). One row per (user, pet, week) tracking
  // wins and the best time; weeks start on Sunday.
  //
  // Caught by the deletion pass: its only callers were inside the two racing
  // blocks that migrated, so removing them left it callerless — and nothing in
  // the Vue app wrote `race_weekly_scores` at all. Same shape as Phase 7's
  // exploration encounters: the deletion is what surfaced the gap.
  async updateWeeklyScore(petId, won, raceTimeMs = null) {
    if (!AppState.user || !petId) return
    try {
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      weekStart.setHours(0, 0, 0, 0)
      const weekKey = weekStart.toISOString().slice(0, 10)

      const { data: existing } = await supabase.from('race_weekly_scores')
        .select('id, wins_this_week, best_time_ms')
        .eq('user_id', AppState.user.id)
        .eq('week_start', weekKey)
        .eq('pet_id', petId)
        .maybeSingle()

      if (existing) {
        const updates = {}
        if (won) updates.wins_this_week = (existing.wins_this_week || 0) + 1
        if (raceTimeMs && (!existing.best_time_ms || raceTimeMs < existing.best_time_ms)) {
          updates.best_time_ms = raceTimeMs
        }
        if (Object.keys(updates).length) {
          await supabase.from('race_weekly_scores').update(updates).eq('id', existing.id)
        }
      } else {
        await supabase.from('race_weekly_scores').insert({
          user_id: AppState.user.id, pet_id: petId, week_start: weekKey,
          wins_this_week: won ? 1 : 0, best_time_ms: raceTimeMs || null
        })
      }
    } catch (e) {
      console.error('[petRaceService.updateWeeklyScore]', e)
    }
  }

  // This week's top racers, for the leaderboard panel.
  async weeklyLeaders(limit = 10) {
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const weekKey = weekStart.toISOString().slice(0, 10)

    const res = await supabase.from('race_weekly_scores')
      .select('pet_id, wins_this_week, best_time_ms, user_pets(nickname), players(username)')
      .eq('week_start', weekKey)
      .order('wins_this_week', { ascending: false })
      .limit(limit)
    if (res.error) {
      console.error('[petRaceService.weeklyLeaders]', res.error)
      return []
    }
    return res.data || []
  }

  async recordHistory(best, runners, bet, payout, won) {
    try {
      await supabase.from('race_history').insert({
        user_id: AppState.user.id,
        pet_id: best ? best.pet.id : null,
        pet_name: best ? (best.pet.nickname || null) : null,
        bet_amount: bet,
        payout,
        won,
        position: best ? best.finishOrder : null,
        opponents: runners
          .filter(r => !best || r.pet !== best.pet)
          .map(r => ({ name: r.pet.nickname || 'CPU', speed: r.speed }))
      })
    } catch (e) {
      console.error('[petRaceService.recordHistory]', e)
    }
  }
}

export const petRaceService = new PetRaceService()

import { reactive } from 'vue'
import { passService } from './PassService.js'
import { awardService } from './AwardService.js'
import { supabase } from './SupabaseService.js'
import { supabaseUrl } from '../env.js'
import { AppState } from '../AppState.js'
import { toastService } from './ToastService.js'
import { taskTracker } from './TaskTrackerService.js'
import { canPerformAction } from '../utils/RateLimit.js'
import {
  GP_TRAINING_TYPES, TRAINING_CAP, GP_VARIANT_BONUS, GP_ENTRY_FEE
} from '../data/grandPrixData.js'

// Ports the gp_* family (game.js:26749-27500) — the weekly Grand Prix, the
// Racing tab's fifth sub-tab.
//
// The event moves through phases on the server: registration → racing →
// reward_claim → complete. Each phase is a different screen, which is why
// legacy has four separate renderers.
//
// NOT ported: the gp_admin* family (running the event, recalculating scores,
// setting winners). That is admin surface and belongs with Phase 9's Admin
// panel, gated behind isAdmin().
export const gpState = reactive({
  event: null,
  entry: null,
  replay: null,
  leaderboard: [],
  loading: false
})

class GrandPrixService {
  // Ports gp_load(). Legacy pings a `process-grand-prix` edge function first to
  // nudge any pending phase transition; that is fire-and-forget there and here.
  async load() {
    if (!AppState.user) return
    gpState.loading = true
    try {
      this.pingProcessor()
      gpState.event = await this.fetchCurrentEvent()
      gpState.entry = null
      gpState.replay = null
      gpState.leaderboard = []

      if (!gpState.event) return

      const entryRes = await supabase.from('grand_prix_entries')
        .select('*')
        .eq('event_id', gpState.event.id)
        .eq('user_id', AppState.user.id)
        .maybeSingle()
      gpState.entry = entryRes.data || null

      if (gpState.event.status === 'complete' || gpState.event.status === 'reward_claim') {
        await this.loadResults()
      }
    } catch (e) {
      console.error('[grandPrixService.load]', e)
    } finally {
      gpState.loading = false
    }
  }

  // Best-effort nudge; a failure here must never block the page.
  pingProcessor() {
    supabase.auth.getSession().then(res => {
      const token = res?.data?.session?.access_token
      if (!token) return
      // Derived from the configured project URL rather than the hardcoded
      // `hqzugbxutgefjilgmxqu.supabase.co` legacy pastes inline, so this still
      // points at the right project if the config ever changes.
      if (!supabaseUrl) return
      fetch(`${supabaseUrl}/functions/v1/process-grand-prix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
      }).catch(() => {})
    }).catch(() => {})
  }

  // RPC first, direct query as a fallback — legacy's own pattern, since
  // `get_current_grand_prix` may not be deployed.
  async fetchCurrentEvent() {
    try {
      const { data, error } = await supabase.rpc('get_current_grand_prix')
      if (error) throw error
      if (data && data.length) return data[0]
    } catch (e) {
      console.warn('[grandPrix] get_current_grand_prix unavailable, querying directly:', e.message)
    }

    const res = await supabase.from('grand_prix_events')
      .select('id, week_number, year, status, prize_pool, registration_close, start_time, end_time')
      .in('status', ['registration', 'racing', 'reward_claim'])
      .order('week_number', { ascending: false })
      .limit(1)
    return (res.data && res.data[0]) || null
  }

  async loadResults() {
    const lb = await supabase.from('grand_prix_leaderboard')
      .select('*')
      .eq('event_id', gpState.event.id)
      .order('final_rank', { ascending: true })
      .limit(20)
    gpState.leaderboard = lb.data || []

    if (gpState.entry) {
      const rp = await supabase.from('grand_prix_replays')
        .select('*')
        .eq('event_id', gpState.event.id)
        .eq('user_id', AppState.user.id)
        .maybeSingle()
      gpState.replay = rp.data || null
    }
  }

  // ── entry ─────────────────────────────────────────────────────────────────
  // Ports gp_getEquipmentBonus() — battle equipment feeds the racing score,
  // weighted so speed counts double. Capped at 30.
  async equipmentBonus(petId) {
    try {
      const { data } = await supabase.from('player_equipment')
        .select('equipment(attack_bonus, defense_bonus, speed_bonus)')
        .eq('user_id', AppState.user.id)
        .eq('pet_id', petId)
        .eq('is_equipped', true)
      let total = 0
      for (const row of data || []) {
        const e = row.equipment
        if (!e) continue
        total += (e.speed_bonus || 0) * 2 + (e.attack_bonus || 0) + (e.defense_bonus || 0)
      }
      return Math.min(30, total)
    } catch (e) {
      return 0
    }
  }

  // Ports gp_estimateScore(). Speed, level, happiness, gear and variant.
  estimateScore(pet, equipBonus = 0) {
    if (!pet) return 0
    const spd = Math.min(50, ((pet.base_speed || 4) + Math.floor(equipBonus / 3)) * 5)
    const lvl = Math.min(100, (pet.level || 1) * 2)
    const hap = ((pet.happiness || 50) / (pet.max_happiness || 100)) * 20
    const equip = Math.min(30, equipBonus)
    const vrnt = GP_VARIANT_BONUS[pet.current_variant || ''] || 0
    return Math.round(spd + lvl + hap + equip + vrnt)
  }

  // Ports gp_enter(). The RPC owns the entry fee and writes the entry row.
  async enter(petId) {
    if (!AppState.user || !petId) return false
    if ((AppState.player?.pawketpoints || 0) < GP_ENTRY_FEE) {
      toastService.error(`Need ${GP_ENTRY_FEE} PP to enter!`)
      return false
    }
    if (!canPerformAction('gp_enter', 5000)) return false

    try {
      const { data, error } = await supabase.rpc('enter_grand_prix', {
        p_user_id: AppState.user.id,
        p_pet_id: petId,
        p_entry_fee: GP_ENTRY_FEE
      })
      if (error) throw error
      if (data && data.success === false) throw new Error(data.error || 'Entry failed')

      // The entry fee is taken inside the RPC, so record it in PP History —
      // otherwise the balance drops with nothing to account for it. Lazily
      // imported, as this file's other PlayerService uses are: a static import
      // would close a cycle.
      const { playerService: ps } = await import('./PlayerService.js')
      await ps.noteExternalSpend(GP_ENTRY_FEE, 'grand_prix_entry')

      taskTracker.report('enter_grand_prix')
      passService.addXP(25, 'grand_prix_entry')
      toastService.success('🎪 You are entered in the Grand Prix!')
      await this.load()
      return true
    } catch (e) {
      toastService.error('Could not enter: ' + e.message)
      return false
    }
  }

  // ── training ──────────────────────────────────────────────────────────────
  trainingBonus() {
    return (gpState.entry && gpState.entry.training_bonus) || 0
  }

  trainingRoom() {
    return Math.max(0, TRAINING_CAP - this.trainingBonus())
  }

  // Ports gp_train(). The weekly bonus is capped at 15 and a session that would
  // overshoot is trimmed to exactly fill it rather than rejected.
  async train(type, pet) {
    if (!gpState.entry || !AppState.user) return false
    if (!canPerformAction('gp_train', 1000)) return false

    const t = GP_TRAINING_TYPES[type]
    if (!t) return false

    const current = this.trainingBonus()
    let gain = type === 'lucky' ? Math.floor(Math.random() * 9) + 2 : t.bonus
    if (current + gain > TRAINING_CAP) {
      gain = TRAINING_CAP - current
      if (gain <= 0) {
        toastService.info(`Weekly training cap (${TRAINING_CAP}) already reached!`)
        return false
      }
    }

    if (t.energyCost > 0 && (pet?.energy || 0) < t.energyCost) {
      toastService.info(`Not enough energy! (need ${t.energyCost})`)
      return false
    }
    // Focus needs 10 points of headroom above its cost, so it can't leave a pet
    // at zero happiness.
    if (t.happinessCost > 0 && (pet?.happiness || 0) < t.happinessCost + 10) {
      toastService.info('Pet needs to be happier for Focus Training!')
      return false
    }
    if (t.ppCost > 0 && (AppState.player?.pawketpoints || 0) < t.ppCost) {
      toastService.info(`Need ${t.ppCost} PP for Lucky Training!`)
      return false
    }

    try {
      const { error } = await supabase.from('grand_prix_entries')
        .update({ training_bonus: current + gain, training_type: type })
        .eq('id', gpState.entry.id)
      if (error) throw error
      gpState.entry.training_bonus = current + gain

      await this.applyTrainingCosts(t, pet)

      taskTracker.report('train_grand_prix')
      passService.addXP(10, 'grand_prix_training')
      toastService.success(`🎯 Training complete! +${gain} race score! (${current + gain}/${TRAINING_CAP})`)
      return true
    } catch (e) {
      toastService.error('Training failed: ' + e.message)
      return false
    }
  }

  async applyTrainingCosts(t, pet) {
    if (t.ppCost > 0) {
      const { playerService } = await import('./PlayerService.js')
      await playerService.adjustPoints(-t.ppCost, 'gp_lucky_training')
    }
    if (!pet) return

    const updates = {}
    if (t.energyCost > 0 || t.energyGain > 0) {
      const next = Math.min(pet.max_energy || 100,
        Math.max(0, (pet.energy || 0) - t.energyCost + t.energyGain))
      pet.energy = next
      updates.energy = next
    }
    if (t.happinessCost > 0) {
      const next = Math.max(0, (pet.happiness || 0) - t.happinessCost)
      pet.happiness = next
      updates.happiness = next
    }
    if (Object.keys(updates).length) {
      await supabase.from('user_pets').update(updates).eq('id', pet.id)
    }
  }

  // ── rewards ───────────────────────────────────────────────────────────────
  // Ports gp_claimRewards(). The prize pool is re-read at claim time because it
  // grows as more players enter after the page loaded.
  async claimRewards() {
    if (!gpState.entry || !gpState.event || !AppState.user) return false
    if (!canPerformAction('gp_claim', 5000)) return false

    try {
      const rank = gpState.entry.final_rank

      const fresh = await supabase.from('grand_prix_events')
        .select('prize_pool').eq('id', gpState.event.id).single()
      const pool = (fresh.data && fresh.data.prize_pool) || gpState.event.prize_pool || 0

      const tiers = await supabase.from('grand_prix_rewards')
        .select('*').lte('rank_min', rank)

      let tier = null
      for (const r of tiers.data || []) {
        if (rank >= r.rank_min && (!r.rank_max || rank <= r.rank_max)) tier = r
      }

      const pp = tier
        ? (tier.pp_reward_percentage
          ? Math.floor(pool * tier.pp_reward_percentage / 100)
          : tier.pp_reward_fixed || 25)
        : 25

      const { playerService } = await import('./PlayerService.js')
      await playerService.awardPoints(pp, 'grand_prix_reward')

      await supabase.from('grand_prix_entries')
        .update({ rewards_claimed: true }).eq('id', gpState.entry.id)
      gpState.entry.rewards_claimed = true

      // Legacy reports BOTH of these here (main:27437-27438) — a win counts as
      // a top-10 finish too. The top-10 report was missed when Bingo landed,
      // leaving its '🏅 Grand Prix Top 10' square unable to complete.
      await this.grantTierExtras(tier)
      if (rank <= 10) taskTracker.report('grand_prix_top_10')
      if (rank === 1) taskTracker.report('grand_prix_winner')
      if (rank === 1) passService.addXP(250, 'grand_prix_winner')
      else if (rank <= 10) passService.addXP(100, 'grand_prix_top_10')
      else passService.addXP(25, 'grand_prix_entry')
      toastService.success(`🏆 Rewards claimed! +${pp} PP`)
      return true
    } catch (e) {
      toastService.error('Could not claim rewards: ' + e.message)
      return false
    }
  }

  // Grants the reward tier's badge and title. Deferred through Phase 8c while
  // Badges and Player Titles were unmigrated; both landed in Phase 9.5.
  async grantTierExtras(tier) {
    if (!tier) return
    if (tier.badge_reward) await awardService.awardBadge(tier.badge_reward)
    if (tier.title_reward) await awardService.awardPlayerTitle(tier.title_reward, 'grand_prix')
  }
}

export const grandPrixService = new GrandPrixService()

import { supabase } from './SupabaseService.js'
import { passService } from './PassService.js'
import * as badgeHooks from './BadgeHooks.js'
import { AppState } from '../AppState.js'
import { playerService } from './PlayerService.js'
import { EXPEDITION_ZONES, EXPEDITION_SPEEDS } from '../data/expeditionData.js'
import { taskTracker } from './TaskTrackerService.js'
import { secretDungeonService } from './SecretDungeonService.js'
import { guildPerkService } from './GuildPerkService.js'
import { worldEventService } from './WorldEventService.js'
import { weatherService } from './WeatherService.js'
import { trackDailyStat } from './DailyStatsService.js'
import { scrapbookService } from './ScrapbookService.js'
import { questService } from './QuestService.js'
import { achievementTierService } from './AchievementTierService.js'
import { argLogService } from './ArgLogService.js'
import { petMoodService } from './PetMoodService.js'

// Ports the battle-page expedition system (battleExp_*, game.js:10763-11097).
//
// A pet is sent to a zone for a fixed number of minutes, costing energy up
// front. Rewards are rolled AT DEPARTURE and stored on the row, so the payout
// can't be re-rolled by reloading — that's legacy's design and it's kept.
//
// The Minigames tab has a second UI over this same `expeditions` table
// (`expedition_*`, with speed options); this service is written to serve both.
class ExpeditionService {
  constructor() {
    // { 'petId:zone': streakCount } — see bumpStreak().
    this._streaks = {}
  }

  zone(key) {
    return EXPEDITION_ZONES.find(z => z.key === key) || null
  }

  // Everything not yet claimed, newest first. `ends_at` in the past means it's
  // ready to collect.
  async getActive(userId) {
    const res = await supabase
      .from('expeditions')
      .select('*')
      .eq('user_id', userId)
      .eq('claimed', false)
      .order('ends_at', { ascending: true })
    if (res.error) {
      console.error('[expeditionService.getActive]', res.error)
      return []
    }
    return res.data || []
  }

  async getHistory(userId, limit = 5) {
    const res = await supabase
      .from('expeditions')
      .select('*')
      .eq('user_id', userId)
      .eq('claimed', true)
      .order('ends_at', { ascending: false })
      .limit(limit)
    return res.error ? [] : (res.data || [])
  }

  // Ports battleExp_start(). Rewards are rolled here and written onto the row.
  async start(pet, zoneKey, speedKey = 'normal') {
    const zone = this.zone(zoneKey)
    if (!zone) throw new Error('Unknown zone.')
    if ((pet.energy || 0) < zone.energyCost) {
      throw new Error(`${pet.nickname || 'Your pet'} needs ${zone.energyCost} energy for this expedition.`)
    }
    const speed = EXPEDITION_SPEEDS[speedKey] || EXPEDITION_SPEEDS.normal

    // Higher-level pets bring back more, capped at +50%.
    const levelBonus = Math.min(1.5, 1 + (pet.level || 1) / 100)
    const rewardPP = Math.floor(
      (zone.minPP + Math.floor(Math.random() * (zone.maxPP - zone.minPP + 1))) * levelBonus * speed.ppMult
    )

    // A single drop, if the zone's itemChance hits. Ruins splits that roll
    // between its equipment and its toys.
    const droppedItems = []
    if (Math.random() < (zone.itemChance || 0)) {
      const pool = zone.itemPool || []
      let dropped = null
      if (zone.key === 'ruins') {
        const equip = pool.filter(i => i.type === 'equipment')
        const toys = pool.filter(i => i.type !== 'equipment')
        const useEquip = Math.random() < (zone.equipmentChance || 0.1) && equip.length
        const from = useEquip ? equip : toys
        dropped = from[Math.floor(Math.random() * from.length)]
      } else {
        dropped = pool[Math.floor(Math.random() * pool.length)]
      }
      if (dropped) droppedItems.push(dropped)
    }

    const endsAt = new Date(Date.now() + zone.duration * speed.timeMult * 60000).toISOString()
    const res = await supabase.from('expeditions').insert({
      user_id: AppState.user.id,
      pet_id: pet.id,
      zone: zoneKey,
      ends_at: endsAt,
      completed: false,
      claimed: false,
      reward_pp: rewardPP,
      reward_items: droppedItems
    }).select().single()
    if (res.error) throw new Error('Could not start the expedition: ' + res.error.message)

    // Energy is spent only AFTER the row exists, so a failed insert can't cost
    // the player anything.
    const energyRes = await supabase.rpc('adjust_pet_stat_secure', {
      p_pet_id: pet.id, p_stat: 'energy', p_delta: -zone.energyCost, p_reason: 'expedition_start'
    })
    if (!energyRes.error && energyRes.data !== null && energyRes.data !== undefined) {
      pet.energy = energyRes.data
    }

    return { row: res.data, zone }
  }

  // Ports battleExp_claim(). Pays out the PP and XP that were rolled at
  // departure, plus any item drop.
  async claim(expeditionId) {
    const { data: row } = await supabase
      .from('expeditions').select('*').eq('id', expeditionId).single()
    if (!row) throw new Error('Expedition not found.')
    if (row.claimed) throw new Error('Already claimed.')

    await supabase.from('expeditions').update({ claimed: true }).eq('id', expeditionId)

    const zone = this.zone(row.zone) || { xpReward: 0, label: 'the wild' }
    const items = row.reward_items || []

    // Exploration streak, then the guild reward-boost perk — the same two
    // multipliers legacy stacks onto the stored payout at claim time
    // (main:5176-5179). Both were deferred through Phase 7/8: streaks had no
    // port at all, and Guild was unmigrated. Both are live as of Phase 9.
    const streak = await this.bumpStreak(row.pet_id, row.zone)
    const streakMult = this.streakMultiplier(row.pet_id, row.zone)
    const perkMult = guildPerkService.multiplier('reward_boost')
    // The world event's exploration multipliers. Both are advertised by events
    // (Strange Fog, Butterfly Swarm, The Ruins are Rumbling) and read nowhere in
    // legacy — the same decorative-bonus pattern as the battle XP one. Weather's
    // ppBonus rides along too, since expedition PP is "PP from all sources".
    const eventMult = worldEventService.bonus('explorationBonus') *
      worldEventService.bonus('allRewards') * weatherService.bonus('ppBonus')
    const pp = Math.floor((row.reward_pp || 0) * streakMult * perkMult * eventMult)

    await playerService.awardPoints(pp, 'expedition_' + row.zone)
    await this.awardPetXP(row.pet_id, zone.xpReward || 0)

    for (const item of items) {
      if (!item.id) continue
      const ins = await supabase.from('user_inventory')
        .insert({ user_id: AppState.user.id, item_id: item.id, quantity: 1 })
      if (ins.error) console.error('[expeditionService.claim] item grant failed:', ins.error.message)
    }

    // A 2% chance the pet stumbles on one of the two hidden battle zones.
    // Returned alongside the normal payout so the claim UI can announce it.
    const discovery = await secretDungeonService.roll(row.zone)

    // The separate streak-gated `exploration_secrets` find — unblocked by the
    // streak port above.
    const secret = await secretDungeonService.checkExplorationSecret(row.pet_id, row.zone, streak)

    // Badges, the forest_friend title, Pass XP, the community counter and the
    // pet's quest arc are all live as of Phase 9.5 — nothing is deferred here
    // any more.
    taskTracker.report('complete_expedition')
    badgeHooks.onExpeditionClaim()
    passService.addXP(10, 'expedition')
    trackDailyStat('expeditions_completed')
    argLogService.tryDrop('expedition')
    petMoodService.completeWish(row.pet_id, 'expedition')
    scrapbookService.add(row.pet_id, 'expedition_complete', { zone: zone.label })
    questService.progress(row.pet_id, 'expedition')
    achievementTierService.check('expeditions_completed', row.pet_id, streak)
    badgeHooks.onExplorationStreak(streak)
    return { pp, xp: zone.xpReward || 0, items, zone, discovery, secret, streak, streakMult }
  }

  // ── Exploration streaks ───────────────────────────────────────────────────
  // Ports checkExplorationStreak()/getStreakMultiplier() (game.js:8808-8871).
  // A streak is per pet AND per zone: sending the same pet back to the same
  // place repeatedly is what pays, not expeditions in general.
  //
  // Memory is the working copy, `expeditions.streak_count` the durable one, so
  // a refresh mid-session doesn't reset progress.
  streakMultiplier(petId, zone) {
    const streak = this._streaks[petId + ':' + zone] || 0
    if (streak >= 10) return 2.0
    if (streak >= 5) return 1.5
    if (streak >= 3) return 1.25
    return 1.0
  }

  streakMessage(streak) {
    if (streak >= 10) return '🔥×10 Streak! +100% rewards & guaranteed rare item!'
    if (streak >= 5) return '🔥×5 Streak! +50% rewards!'
    if (streak >= 3) return '🔥×3 Streak! +25% rewards!'
    return ''
  }

  async bumpStreak(petId, zone) {
    const key = petId + ':' + zone

    if (!this._streaks[key]) {
      try {
        const { data: last } = await supabase
          .from('expeditions')
          .select('streak_count')
          .eq('pet_id', petId)
          .eq('zone', zone)
          .eq('claimed', true)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (last && last.streak_count) this._streaks[key] = last.streak_count
      } catch {
        // `streak_count` is optional — an absent column just means streaks
        // restart each session, which is how legacy degrades too.
      }
    }

    this._streaks[key] = (this._streaks[key] || 0) + 1
    const streak = this._streaks[key]

    // Persisted without blocking the payout.
    ;(async () => {
      try {
        const { data: recent } = await supabase
          .from('expeditions')
          .select('id')
          .eq('pet_id', petId)
          .eq('zone', zone)
          .eq('user_id', AppState.user.id)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (recent && recent.id) {
          await supabase.from('expeditions').update({ streak_count: streak }).eq('id', recent.id)
        }
      } catch { /* optional column */ }
    })()

    return streak
  }

  // Ports addPetXP(). Levels up while the threshold is met, carrying the
  // remainder — the same curve battle victories use.
  async awardPetXP(petId, amount) {
    if (!amount) return null
    const { data: pet } = await supabase
      .from('user_pets').select('xp, level, stat_points').eq('id', petId).single()
    if (!pet) return null

    let xp = (pet.xp || 0) + amount
    let level = pet.level || 1
    let statPoints = pet.stat_points || 0
    let leveled = false
    while (xp >= level * 100) {
      xp -= level * 100
      level++
      statPoints++
      leveled = true
    }
    await supabase.from('user_pets')
      .update({ xp, level, stat_points: statPoints }).eq('id', petId)
    return { leveled, level }
  }

  // Remaining milliseconds, floored at zero.
  msRemaining(row) {
    return Math.max(0, new Date(row.ends_at).getTime() - Date.now())
  }

  isReady(row) {
    return this.msRemaining(row) === 0
  }

  formatRemaining(ms) {
    if (ms <= 0) return 'Ready!'
    const totalMinutes = Math.ceil(ms / 60000)
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }
}

export const expeditionService = new ExpeditionService()

import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { playerService } from './PlayerService.js'
import { EXPEDITION_ZONES } from '../data/expeditionData.js'

// Ports the battle-page expedition system (battleExp_*, game.js:10763-11097).
//
// A pet is sent to a zone for a fixed number of minutes, costing energy up
// front. Rewards are rolled AT DEPARTURE and stored on the row, so the payout
// can't be re-rolled by reloading — that's legacy's design and it's kept.
//
// The Minigames tab has a second UI over this same `expeditions` table
// (`expedition_*`, with speed options); this service is written to serve both.
class ExpeditionService {
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
  async start(pet, zoneKey) {
    const zone = this.zone(zoneKey)
    if (!zone) throw new Error('Unknown zone.')
    if ((pet.energy || 0) < zone.energyCost) {
      throw new Error(`${pet.nickname || 'Your pet'} needs ${zone.energyCost} energy for this expedition.`)
    }

    // Higher-level pets bring back more, capped at +50%.
    const levelBonus = Math.min(1.5, 1 + (pet.level || 1) / 100)
    const rewardPP = Math.floor(
      (zone.minPP + Math.floor(Math.random() * (zone.maxPP - zone.minPP + 1))) * levelBonus
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

    const endsAt = new Date(Date.now() + zone.duration * 60000).toISOString()
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
    const pp = row.reward_pp || 0
    const items = row.reward_items || []

    await playerService.awardPoints(pp, 'expedition_' + row.zone)
    await this.awardPetXP(row.pet_id, zone.xpReward || 0)

    for (const item of items) {
      if (!item.id) continue
      const ins = await supabase.from('user_inventory')
        .insert({ user_id: AppState.user.id, item_id: item.id, quantity: 1 })
      if (ins.error) console.error('[expeditionService.claim] item grant failed:', ins.error.message)
    }

    // Deliberately not ported — each belongs to a system that isn't migrated:
    // exploration streaks and their PP multiplier, secret-zone discovery,
    // PawketPass XP, quest-arc progress, and the community stat counter.
    return { pp, xp: zone.xpReward || 0, items, zone }
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

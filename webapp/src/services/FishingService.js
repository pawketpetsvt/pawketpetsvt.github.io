import { reactive } from 'vue'
import * as badgeHooks from './BadgeHooks.js'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { playerService } from './PlayerService.js'
import { minigamesService } from './MinigamesService.js'
import { toastService } from './ToastService.js'
import { cookingService } from './CookingService.js'
import { weatherService } from './WeatherService.js'
import { taskTracker } from './TaskTrackerService.js'
import { scrapbookService } from './ScrapbookService.js'
import { argLogService } from './ArgLogService.js'
import { cosmeticsState } from './PetCosmeticsService.js'
import { FISH_SPOTS, FISH_BAIT, FISH_POOL, ROD_CASTS_BONUS, AUTO_FISHER_TIERS, DAILY_FISH_CHALLENGES, getWeekKey } from '../data/fishingData.js'
import { FISHING_INGREDIENT_DROPS } from '../data/cookingData.js'

// Rare Shoal event — a 12%-per-visit window where the next 3 casts get a
// real +50% weight boost on rare+ fish. In game.js (9166-10191) this only
// ever showed a banner promising the bonus; the roll math in
// fishingGetCatch() never actually read the flag, so the bonus was
// decorative-only. Per the user's explicit choice, this port makes the
// bonus real — getCatch() below applies it when shoalState.active is true.
export const shoalState = reactive({ active: false, castsLeft: 0 })

// How much Pass XP one fishing session can contribute (legacy's min(8, …)).
const FISHING_SESSION_XP_CAP = 8

class FishingService {
  // Reset by startSession() so each trip out gets its own XP allowance.
  sessionPassXP = 0

  startSession() {
    this.sessionPassXP = 0
  }

  // Shared helper for the server-side claim RPCs (see
  // supabase/migrations/2026-08-23_game_claims.sql) — applies the returned
  // new PP total to AppState.player, or returns null (and logs) on
  // rejection, e.g. an already-claimed key.
  async _claim(rpcName, params) {
    const { data, error } = await supabase.rpc(rpcName, params)
    if (error) {
      console.error('[' + rpcName + ']', error.message)
      return null
    }
    if (AppState.player && data !== null && data !== undefined) AppState.player.pawketpoints = data
    return data
  }

  getRodCasts(spot, rodLevel) {
    const base = FISH_SPOTS[spot] ? FISH_SPOTS[spot].baseCasts : 8
    return base + (ROD_CASTS_BONUS[rodLevel] || 0)
  }

  async loadRodLevel(userId) {
    const res = await supabase.from('players').select('fishing_rod_level').eq('id', userId).maybeSingle()
    return (res.data && res.data.fishing_rod_level) || 1
  }

  async upgradeRod(userId, currentLevel, cost) {
    const newTotal = await playerService.adjustPoints(-cost, 'rod_upgrade')
    if (newTotal === null) throw new Error('Upgrade failed. Try again.')
    await supabase.from('players').update({ fishing_rod_level: currentLevel + 1 }).eq('id', userId)
    return currentLevel + 1
  }

  async loadCollection(userId) {
    const res = await supabase.from('user_fish_collection').select('fish_id, catch_count, best_weight, first_caught_at').eq('user_id', userId)
    const map = {}
    ;(res.data || []).forEach(row => {
      map[row.fish_id] = {
        count: row.catch_count || 0,
        firstCatch: row.first_caught_at ? new Date(row.first_caught_at).getTime() : Date.now(),
        bestWeight: row.best_weight || null
      }
    })
    return map
  }

  // Weighted-pool roll, ports fishingGetCatch(), game.js:9320-9382.
  getCatch({ spot, bait, rodLevel, power }) {
    const baitData = FISH_BAIT[bait] || FISH_BAIT.worm
    // Live weather at last. Until the weather system was ported this was
    // hardcoded to 'clear', which made all four weather-gated legendaries
    // (ghost_fish / storm_eel / void_fish / aurora_cod) permanently uncatchable.
    const weather = weatherService.currentId()
    const rodLvl = rodLevel || 1
    const castPower = power !== undefined ? power : 0.5

    const pool = FISH_POOL.filter(f => f.spots.includes(spot) && (!f.weather || f.weather === weather))

    const getWeight = f => {
      let w = f.weight
      const isJunk = f.rarity === 'junk'
      const isCommon = f.rarity === 'common'
      const isRarePlus = f.rarity === 'rare' || f.rarity === 'epic' || f.rarity === 'legendary'

      if (baitData.rarityBoost > 0) {
        if (isJunk || isCommon) w = Math.max(1, w - Math.floor(w * baitData.rarityBoost * 2))
        if (isRarePlus) w = Math.floor(w * (1 + baitData.rarityBoost))
      }

      if (rodLvl >= 2 && isJunk) w = Math.max(1, Math.floor(w * (rodLvl >= 4 ? 0.25 : rodLvl >= 3 ? 0.50 : 0.75)))
      if (rodLvl >= 4 && isCommon) w = Math.max(1, Math.floor(w * 0.75))
      if (rodLvl >= 3 && isRarePlus) w = Math.floor(w * (rodLvl >= 4 ? 1.30 : 1.15))

      if (castPower >= 0.8) {
        if (isRarePlus) w = Math.floor(w * 1.20)
        if (isJunk) w = Math.max(1, Math.floor(w * 0.85))
      } else if (castPower < 0.4) {
        if (isJunk) w = Math.floor(w * 1.15)
        if (isRarePlus) w = Math.max(1, Math.floor(w * 0.90))
      }

      // Rare Shoal bonus — see module comment above.
      if (shoalState.active && isRarePlus) w = Math.floor(w * 1.5)

      return Math.max(1, w)
    }

    const totalWeight = pool.reduce((s, f) => s + getWeight(f), 0)
    const roll = Math.random() * totalWeight
    let acc = 0
    for (const f of pool) {
      acc += getWeight(f)
      if (roll < acc) return f
    }
    return pool[0]
  }

  // Full single-cast resolution: bait cost, catch roll, collection upsert,
  // cooking-ingredient drop, quest/daily/shoal hooks. Ports the body of
  // castLine(), game.js:9384-9555, minus session-end (owned by the page,
  // which knows the remaining-casts count). Badges, the angler titles, Bingo,
  // Pass XP, the weekly challenge counters and the scrapbook memory for a
  // legendary catch are all live as of Phase 9.5. Still deferred, UNBLOCKED BY
  // its own port: ARG lore-log drops.
  async castLine({ userId, spot, bait, rodLevel, power, collectionMap, ingredientsMap }) {
    let usedBait = bait
    let baitData = FISH_BAIT[usedBait] || FISH_BAIT.worm
    const currentPoints = AppState.player ? AppState.player.pawketpoints : 0
    if (baitData.cost > 0 && currentPoints < baitData.cost) {
      toastService.warning('Not enough PP for ' + baitData.name + '! Switching to worm.')
      usedBait = 'worm'
      baitData = FISH_BAIT.worm
    }
    if (baitData.cost > 0) await playerService.adjustPoints(-baitData.cost, 'fishing_bait')

    const fish = this.getCatch({ spot, bait: usedBait, rodLevel, power })
    let weightG = 0
    if (fish.maxWeightG > fish.minWeightG) {
      weightG = Math.round(fish.minWeightG + Math.random() * (fish.maxWeightG - fish.minWeightG))
    }

    const prevEntry = collectionMap[fish.id]
    const prevCount = prevEntry ? prevEntry.count : 0
    const prevBest = prevEntry ? prevEntry.bestWeight || 0 : 0
    const isNew = prevCount === 0
    const isNewRecord = weightG > 0 && weightG > prevBest

    try {
      await supabase.from('user_fish_collection').upsert(
        {
          user_id: userId,
          fish_id: fish.id,
          catch_count: prevCount + 1,
          best_weight: Math.max(weightG, prevBest),
          first_caught_at: isNew ? new Date().toISOString() : undefined
        },
        { onConflict: 'user_id,fish_id' }
      )
    } catch (err) {
      console.error('[Fishing] collection save error:', err)
    }

    collectionMap[fish.id] = {
      count: prevCount + 1,
      firstCatch: prevEntry ? prevEntry.firstCatch : Date.now(),
      bestWeight: Math.max(weightG, prevBest) || null
    }

    if (fish.rarity !== 'junk') await this.rollCookingDrop(userId, fish.name, ingredientsMap)

    if (shoalState.active) {
      shoalState.castsLeft--
      if (shoalState.castsLeft <= 0) shoalState.active = false
    }

    // Badges and the angler titles. `totalCaught` is every catch across the
    // whole collection, which is what legacy's 50/100/250 thresholds count.
    const totalCaught = Object.values(collectionMap).reduce((s, e) => s + (e.count || 0), 0)
    badgeHooks.onFishCaught({ totalCaught, isNew, rarity: fish.rarity, fishId: fish.id })

    // The two fishing weekly challenges ('Catch 25 fish' / 'Catch 3 rare or
    // better'). Legacy counts junk toward wk_fish_caught too, so this is
    // reported for every catch.
    // Scrapbook: a legendary catch is worth remembering (main:9486). Legacy
    // files it against the active companion rather than a rod-holder, since
    // fishing has no per-pet actor.
    if (fish.rarity === 'legendary' && cosmeticsState.companionPetId) {
      scrapbookService.add(cosmeticsState.companionPetId, 'legendary_fish', {
        fish: fish.name + ' ' + (fish.emoji || '')
      })
    }

    argLogService.tryDrop(fish.rarity === 'legendary' ? 'fishing_legendary' : 'fishing')

    taskTracker.report('catch_fish')
    if (fish.rarity === 'rare' || fish.rarity === 'epic' || fish.rarity === 'legendary') {
      taskTracker.report('catch_rare_fish')
    }

    // Pass XP for fishing, which the Phase 4 port never carried. Legacy files
    // it under the 'play' source rather than one of its own, at 2 XP per fish
    // with the SESSION contribution capped at 8 (main:9531) — on top of the
    // daily 'play' cap the Pass already enforces.
    //
    // Legacy recomputes `min(8, caught * 2)` and grants that WHOLE amount on
    // every catch, so a five-fish session grants 2+4+6+8+8 = 28 rather than the
    // 8 the cap describes. Granting the increment gives the intended total.
    this.sessionPassXP = (this.sessionPassXP || 0)
    const passAward = Math.min(2, FISHING_SESSION_XP_CAP - this.sessionPassXP)
    if (passAward > 0) {
      this.sessionPassXP += passAward
      passService.addXP(passAward, 'play')
    }

    return { fish, weightG, isNew, isNewRecord, usedBait }
  }

  // Ports cooking_rollFishingDrop(), game.js:42223-42249 — the salmon/cod
  // check is a name-substring match, not a table lookup (see the comment on
  // FISHING_INGREDIENT_DROPS in cookingData.js for why).
  async rollCookingDrop(userId, fishName, ingredientsMap) {
    const drops = new Set()
    const lower = (fishName || '').toLowerCase()
    if (lower.includes('salmon')) drops.add('fresh_salmon')
    else if (lower.includes('cod')) drops.add('fresh_cod')
    for (const id in FISHING_INGREDIENT_DROPS.any) {
      if (Math.random() < FISHING_INGREDIENT_DROPS.any[id]) drops.add(id)
    }
    for (const id of drops) await cookingService.awardIngredient(userId, id, 1, ingredientsMap)
  }

  async awardSessionTotal(total) {
    const result = await this._claim('claim_daily_secure', { p_game_key: 'fishing', p_amount: total, p_reason: 'fishing' })
    return result !== null
  }

  async checkCollectionBonus(collected, total) {
    if (collected < total) return false
    const result = await this._claim('claim_once_secure', { p_game_key: 'fishing_collection_complete', p_amount: 200, p_reason: 'fishing_collection_complete' })
    return result !== null
  }

  // ── Melon's Weekly Quest ──────────────────────────────────────────────
  getWeeklyTargets() {
    let seed = getWeekKey().split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const eligible = FISH_POOL.filter(f => f.rarity !== 'junk' && f.id !== 'piper_fish' && f.id !== 'junk_ad')
    const picked = []
    const pool = eligible.slice()
    for (let i = 0; i < 3 && pool.length; i++) {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff
      const idx = Math.abs(seed) % pool.length
      picked.push(pool[idx])
      pool.splice(idx, 1)
    }
    return picked
  }

  // Progress (which of the 3 target fish caught so far) stays in
  // localStorage — it's just checklist display, not something that grants
  // PP by itself, so it doesn't need server enforcement. The 300 PP
  // completion award below does.
  getQuestProgress(userId) {
    const key = 'fq_' + userId + '_' + getWeekKey()
    try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} }
  }

  async isQuestClaimed() {
    if (!AppState.user) return false
    const { data, error } = await supabase.rpc('has_claimed_weekly', { p_game_key: 'melon_quest' })
    if (error) { console.error('[isQuestClaimed]', error.message); return false }
    return !!data
  }

  async recordQuestCatch(userId, fishId) {
    const targets = this.getWeeklyTargets()
    const target = targets.find(f => f.id === fishId)
    if (!target) return { caughtTarget: null, questJustFinished: false }

    const key = 'fq_' + userId + '_' + getWeekKey()
    const progress = this.getQuestProgress(userId)
    if (progress[fishId]) return { caughtTarget: null, questJustFinished: false }

    progress[fishId] = true
    localStorage.setItem(key, JSON.stringify(progress))
    const done = targets.filter(f => progress[f.id]).length
    let questJustFinished = false
    if (done >= 3) {
      const result = await this._claim('claim_weekly_secure', { p_game_key: 'melon_quest', p_amount: 300, p_reason: 'melon_quest_complete' })
      questJustFinished = result !== null
    }
    return { caughtTarget: target, questJustFinished }
  }

  // ── Daily Fishing Challenge ───────────────────────────────────────────
  getTodayChallenge() {
    const dayNum = Math.floor(Date.now() / 86400000)
    return DAILY_FISH_CHALLENGES[dayNum % DAILY_FISH_CHALLENGES.length]
  }

  // Progress count is cosmetic (localStorage), same reasoning as the quest
  // progress above — the reward claim below is what's server-enforced.
  getDailyProgress(userId) {
    const today = new Date().toISOString().split('T')[0]
    return parseInt(localStorage.getItem('fd_' + userId + '_' + today + '_prog') || '0', 10)
  }

  async isDailyClaimed() {
    if (!AppState.user) return false
    const { data, error } = await supabase.rpc('has_claimed_daily', { p_game_key: 'fishing_daily_challenge' })
    if (error) { console.error('[isDailyClaimed]', error.message); return false }
    return !!data
  }

  async recordDailyCatch(userId, caught, weightG) {
    const challenge = this.getTodayChallenge()
    if (await this.isDailyClaimed()) return { justCompleted: false, challenge }

    let qualifies = false
    if (challenge.stat === 'df_any') qualifies = true
    if (challenge.stat === 'df_rare') qualifies = ['rare', 'epic', 'legendary'].includes(caught.rarity)
    if (challenge.stat === 'df_epic') qualifies = ['epic', 'legendary'].includes(caught.rarity)
    if (challenge.stat === 'df_nonjunk') qualifies = caught.rarity !== 'junk'
    if (challenge.stat === 'df_heavy') qualifies = (weightG || 0) >= 500
    if (!qualifies) return { justCompleted: false, challenge }

    const today = new Date().toISOString().split('T')[0]
    const progKey = 'fd_' + userId + '_' + today + '_prog'
    const prog = parseInt(localStorage.getItem(progKey) || '0', 10) + 1
    localStorage.setItem(progKey, String(prog))
    if (prog >= challenge.target) {
      const result = await this._claim('claim_daily_secure', { p_game_key: 'fishing_daily_challenge', p_amount: challenge.reward, p_reason: 'daily_fish_challenge' })
      return { justCompleted: result !== null, challenge }
    }
    return { justCompleted: false, challenge }
  }

  // ── Rare Shoal ─────────────────────────────────────────────────────────
  checkShoal() {
    if (shoalState.active) return false
    if (Math.random() < 0.12) {
      shoalState.active = true
      shoalState.castsLeft = 3
      return true
    }
    return false
  }

  // ── Auto-Fisher ────────────────────────────────────────────────────────
  async loadAutoFisherState(userId) {
    const res = await supabase.from('players').select('auto_fisher_level, auto_fisher_last_catch').eq('id', userId).maybeSingle()
    return {
      level: (res.data && res.data.auto_fisher_level) || 0,
      lastCatch: res.data ? res.data.auto_fisher_last_catch : null
    }
  }

  // Ports autoFisherCheck(), game.js:9647-9683 — offline-progress haul is
  // stored in localStorage only, same as the original (never in Supabase).
  async checkOfflineProgress(userId, level, lastCatch, spot, bait, rodLevel) {
    if (!level) return
    const tier = AUTO_FISHER_TIERS[level - 1]
    if (!tier) return
    const now = Date.now()
    const last = lastCatch ? new Date(lastCatch).getTime() : 0
    const elapsed = Math.floor((now - last) / 1000)
    let catches = Math.floor(elapsed / tier.interval)
    if (catches <= 0) return
    catches = Math.min(catches, tier.maxHaul || 20)

    const haul = []
    for (let i = 0; i < catches; i++) {
      const power = 0.4 + Math.random() * 0.4
      const fish = this.getCatch({ spot, bait, rodLevel, power })
      haul.push({ name: fish.name, emoji: fish.emoji || '🐟', pp: fish.pp, rarity: fish.rarity })
    }

    try {
      const haulKey = 'autofisher_haul_' + userId
      let existing = JSON.parse(localStorage.getItem(haulKey) || '[]')
      existing = existing.concat(haul)
      if (existing.length > 50) existing = existing.slice(-50)
      localStorage.setItem(haulKey, JSON.stringify(existing))
    } catch { /* ignore */ }

    await supabase.from('players').update({ auto_fisher_last_catch: new Date().toISOString() }).eq('id', userId)
  }

  getPendingHaul(userId) {
    try { return JSON.parse(localStorage.getItem('autofisher_haul_' + userId) || '[]') } catch { return [] }
  }

  async collectHaul(userId) {
    const haul = this.getPendingHaul(userId)
    if (!haul.length) return { haul: [], totalPP: 0 }
    const totalPP = haul.reduce((sum, c) => sum + (c.pp || 0), 0)
    if (totalPP > 0) await playerService.awardPoints(totalPP, 'auto_fisher_haul')
    localStorage.removeItem('autofisher_haul_' + userId)
    return { haul, totalPP }
  }

  async purchaseAutoFisher(userId, level) {
    const tier = AUTO_FISHER_TIERS[level - 1]
    const newTotal = await playerService.spendPoints(tier.cost, 'auto_fisher_purchase')
    if (newTotal === null) throw new Error('Purchase failed.')
    await supabase.from('players').update({ auto_fisher_level: level }).eq('id', userId)
  }

  // ── Cook & Feed ────────────────────────────────────────────────────────
  // Ports fishingCookFeed(), game.js:10194-10228 — feed_pet_secure's return
  // value is discarded in the original too (fire-and-forget); hunger is
  // applied optimistically via a direct user_pets update either way.
  async cookFeed(userId, fish, hungerAmount, pet, collectionMap) {
    supabase.rpc('feed_pet_secure', { p_pet_id: pet.id, p_item_id: null }).then(null, () => {})
    const newHunger = Math.min(pet.max_hunger || 100, (pet.hunger || 0) + hungerAmount)
    await supabase.from('user_pets').update({ hunger: newHunger }).eq('id', pet.id)
    pet.hunger = newHunger

    const entry = collectionMap[fish.id]
    const newCount = Math.max(0, ((entry && entry.count) || 1) - 1)
    if (entry) entry.count = newCount
    await supabase.from('user_fish_collection').update({ catch_count: newCount }).eq('user_id', userId).eq('fish_id', fish.id)
  }
}

export const fishingService = new FishingService()

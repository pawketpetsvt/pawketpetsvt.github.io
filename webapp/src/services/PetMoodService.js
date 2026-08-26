import { reactive } from 'vue'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { playerService } from './PlayerService.js'
import { toastService } from './ToastService.js'
import { PERSONALITIES, WISH_POOL } from '../data/petCardData.js'

// Ports the pet personality / "Today's Wishes" system (game.js:3694-3875).
//
// Each pet rolls one personality per calendar day and three wishes drawn from a
// pool weighted by that personality — a Hungry pet asks to be fed far more
// often than a Brave one does. Completing a wish pays PP; completing all three
// pays a bonus. State lives in `pet_daily_moods`, keyed by (pet_id, date).
export const moodState = reactive({
  // petId -> { date, personality, wishes, completedWishes, rewardClaimed }
  byPet: {}
})

const ALL_WISHES_BONUS = 100

class PetMoodService {
  today() {
    return new Date().toISOString().slice(0, 10)
  }

  personalityDef(key) {
    return PERSONALITIES.find(p => p.key === key) || PERSONALITIES[0]
  }

  // Ports personality_loadMood(). Cached per pet per day; reads the row if one
  // exists for today, otherwise rolls a new mood and persists it.
  async load(petId) {
    if (!petId) return null
    const today = this.today()
    const cached = moodState.byPet[petId]
    if (cached && cached.date === today) return cached

    const { data: row } = await supabase
      .from('pet_daily_moods')
      .select('*')
      .eq('pet_id', petId)
      .eq('date', today)
      .maybeSingle()

    if (row) {
      // The JSONB columns come back as either parsed values or strings
      // depending on how they were written, so handle both.
      const parse = (v) => {
        if (!v) return []
        return typeof v === 'string' ? JSON.parse(v) : v
      }
      moodState.byPet[petId] = {
        date: today,
        personality: row.personality,
        wishes: parse(row.wishes),
        completedWishes: parse(row.completed_wishes),
        rewardClaimed: row.reward_claimed || false
      }
      return moodState.byPet[petId]
    }

    return this.rollNew(petId, today)
  }

  // Weighted draw of three distinct wishes, per the personality's wishWeights.
  // A weight of 0 removes a wish from that personality's pool entirely.
  rollNew(petId, today) {
    const personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)].key
    const weights = this.personalityDef(personality).wishWeights || null

    const pool = []
    for (const w of WISH_POOL) {
      const weight = weights ? (weights[w.key] ?? 1) : 1
      for (let i = 0; i < weight; i++) pool.push(w)
    }
    pool.sort(() => Math.random() - 0.5)

    const seen = new Set()
    const wishes = []
    for (const w of pool) {
      if (wishes.length >= 3) break
      if (seen.has(w.key)) continue
      seen.add(w.key)
      wishes.push({ key: w.key, text: w.text, action: w.action, reward: w.reward })
    }
    // A personality that zeroes out most of the pool can yield fewer than
    // three; top up from the flat list so a pet always has three wishes.
    for (const w of WISH_POOL) {
      if (wishes.length >= 3) break
      if (seen.has(w.key)) continue
      seen.add(w.key)
      wishes.push({ key: w.key, text: w.text, action: w.action, reward: w.reward })
    }

    const mood = { date: today, personality, wishes, completedWishes: [], rewardClaimed: false }
    moodState.byPet[petId] = mood

    // Fire-and-forget: a failed write just means the mood re-rolls next load,
    // which is better than blocking the card render on it.
    supabase.from('pet_daily_moods').insert({
      pet_id: petId,
      date: today,
      personality,
      wishes: JSON.stringify(wishes),
      completed_wishes: '[]',
      reward_claimed: false
    }).then(({ error }) => {
      if (error) console.error('[petMoodService.rollNew] insert failed:', error.message)
    })

    return mood
  }

  // Ports personality_completeWish(). Called by whatever the pet wished for —
  // feeding, playing, winning a battle, and so on. Silently does nothing when
  // there's no matching outstanding wish, so callers can fire it freely.
  async completeWish(petId, actionKey) {
    if (!AppState.user) return
    const mood = moodState.byPet[petId]
    if (!mood) return

    const wish = mood.wishes.find(w => w.action === actionKey && !mood.completedWishes.includes(w.key))
    if (!wish) return

    mood.completedWishes.push(wish.key)
    await playerService.awardPoints(wish.reward, 'wish_' + wish.key)
    toastService.success(`🎯 Wish completed: ${wish.text} +${wish.reward} PP!`)

    await supabase.from('pet_daily_moods')
      .update({ completed_wishes: JSON.stringify(mood.completedWishes) })
      .eq('pet_id', petId).eq('date', mood.date)

    if (mood.completedWishes.length === 3 && !mood.rewardClaimed) {
      mood.rewardClaimed = true
      await supabase.from('pet_daily_moods')
        .update({ reward_claimed: true })
        .eq('pet_id', petId).eq('date', mood.date)
      await playerService.awardPoints(ALL_WISHES_BONUS, 'all_wishes_bonus')
      // Legacy also grants +25 Pass XP here; PawketPass is not migrated yet.
      toastService.success(`🎉 All wishes complete! BONUS +${ALL_WISHES_BONUS} PP!`)
    }
  }
}

export const petMoodService = new PetMoodService()

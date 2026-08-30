import { reactive } from 'vue'
import { passService } from './PassService.js'
import { supabase } from './SupabaseService.js'
import { questService } from './QuestService.js'
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
      // Restore any three-day quest arc stored alongside the mood, so a reload
      // does not lose one in progress.
      questService.hydrate(petId, row)
      if (!row.quest_arc) questService.assign(petId, row.personality)
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

    // A fresh day's personality is what the quest arc is matched against, so
    // the arc is drawn right after the roll (main:4068).
    questService.assign(petId, personality)

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

  // Ports checkPetWishes(actionKey, petId) for EVERY pet with a loaded mood.
  //
  // THIS WAS THE GAP: `completeWish()` below had no callers anywhere, so
  // Today's Wishes rendered on every pet card and could never be completed —
  // the per-wish PP and the all-three bonus were both unreachable. Legacy fires
  // its equivalent from eleven places; the six that name a specific pet call
  // completeWish directly, and the ambient ones (visiting the shop, viewing a
  // profile, taking a snapshot) sweep every pet, which is what this does.
  async completeWishAll(actionKey) {
    if (!AppState.user) return
    // Sweep the player's ACTUAL pets, not merely the ones whose card happened
    // to have been rendered this session — `moodState.byPet` is only warmed by
    // PetWishes.vue mounting, so on the Shop or Profile page it was usually
    // empty and this loop ran zero times.
    //
    // `AppState.ownedPets` is the right list: its `.id` is the `user_pets` row
    // id, which is what `pet_daily_moods.pet_id` stores. `AppState.ownedPetIds`
    // would NOT work — that holds catalog `pet_id`s, a different key entirely.
    //
    // It is loaded on the first visit of a day (StreakService's login hooks) but
    // NOT on later sessions that day, so it is fetched here when cold. Lazily
    // imported because OwnedPetsService imports this module back — a static
    // import would be a cycle, the same reason StreakService defers its own.
    if (!(AppState.ownedPets || []).length && AppState.user) {
      try {
        const { ownedPetsService } = await import('./OwnedPetsService.js')
        await ownedPetsService.getMyPets(AppState.user.id)
      } catch (e) {
        console.error('[petMood.completeWishAll] could not load pets:', e)
      }
    }

    const ids = (AppState.ownedPets || []).length
      ? AppState.ownedPets.map(p => p.id)
      : Object.keys(moodState.byPet)
    for (const petId of ids) {
      await this.completeWish(petId, actionKey)
    }
  }

  // Ports personality_completeWish(). Called by whatever the pet wished for —
  // feeding, playing, winning a battle, and so on. Silently does nothing when
  // there's no matching outstanding wish, so callers can fire it freely.
  async completeWish(petId, actionKey) {
    if (!AppState.user) return

    // Load on demand rather than reading `moodState.byPet` directly.
    //
    // THIS IS WHY "win a battle" never completed: the map is warmed ONLY by
    // PetWishes.vue's onMounted, which runs when a pet CARD is on screen — that
    // is, on My Pets. A battle is won on the Battle page, where no card is
    // mounted, so the lookup missed and this method returned silently. Feeding
    // and playing appeared to work purely because they happen on the page that
    // warms the cache. The same silent miss affected expeditions and races.
    //
    // `load()` is cache-checked per pet per day, so this is free once warm, and
    // it also fixes a stale-date read: a mood cached before midnight would
    // otherwise have been used against today's wishes.
    // Every caller fires this without awaiting, so a rejection here would
    // escape as an unhandled promise rather than into the caller's try/catch.
    // Until now that hardly mattered because the method almost always returned
    // early; now that it actually does work, it contains its own failures.
    try {
      const mood = await this.load(petId)
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
        passService.addXP(25, 'all_wishes')
        toastService.success(`🎉 All wishes complete! BONUS +${ALL_WISHES_BONUS} PP!`)
      }
    } catch (e) {
      console.error('[petMood.completeWish]', actionKey, e)
    }
  }
}

export const petMoodService = new PetMoodService()

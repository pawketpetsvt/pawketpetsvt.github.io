import { supabase } from './SupabaseService.js'
import { passService } from './PassService.js'
import * as badgeHooks from './BadgeHooks.js'
import { AppState } from '../AppState.js'
import { OwnedPet } from '../models/OwnedPet.js'
import { playerService } from './PlayerService.js'
import { inventoryService } from './InventoryService.js'
import { calculateEnergyRegen, calculateHungerDecay, calculateHappinessDecay, calculateLevelUp } from '../utils/PetStatMath.js'
import { containsProfanity } from '../utils/profanity.js'
import { taskTracker } from './TaskTrackerService.js'
import { referralService } from './ReferralService.js'
import { streamerLandingService } from './StreamerLandingService.js'
import { weatherService } from './WeatherService.js'
import { worldEventService } from './WorldEventService.js'
import { trackDailyStat } from './DailyStatsService.js'
import { scrapbookService } from './ScrapbookService.js'
import { questService } from './QuestService.js'
import { petMoodService } from './PetMoodService.js'
import { achievementTierService } from './AchievementTierService.js'
import { activityService } from './ActivityService.js'

class OwnedPetsService {
  async getOwnedPetIds(userId) {
    const owned = await supabase.from('user_pets').select('pet_id').eq('user_id', userId)
    AppState.ownedPetIds = owned.data ? owned.data.map(p => p.pet_id) : []
    return AppState.ownedPetIds
  }

  async getMyPets(userId) {
    const res = await supabase.from('user_pets')
      .select('*, pets(name, image_file, vtuber_name, twitch_url)')
      .eq('user_id', userId)
      .order('adopted_at', { ascending: true })
    if (res.error || !res.data) {
      AppState.ownedPets = []
      throw new Error('Could not load pets.')
    }
    // Energy regen is multiplied by the active world event AND the weather,
    // exactly as legacy stacks them (main:4362-4366). Both return 1.0 when
    // nothing is active, so this is a no-op on an ordinary day.
    const regenMult = worldEventService.bonus('energyRegen') * weatherService.bonus('energyRegen')
    const decayMult = weatherService.bonus('happinessDecay')

    AppState.ownedPets = res.data.map(pet => new OwnedPet({
      ...pet,
      energy: calculateEnergyRegen(pet.energy, pet.max_energy, pet.last_played, regenMult),
      hunger: calculateHungerDecay(pet.hunger, pet.last_fed),
      happiness: calculateHappinessDecay(pet.happiness, pet.last_fed, pet.last_played, decayMult)
    }))
    return AppState.ownedPets
  }

  // Ports saveNickname(), game.js:4171-4227 — the rename flow that lived
  // behind the pet card's edit button. Validation order and messages are kept
  // as they were; throwing lets the caller surface them through the toast
  // service instead of the service reaching for UI itself.
  async rename(pet, rawNickname) {
    const nickname = (rawNickname || '').trim()
    if (!nickname) throw new Error('Please enter a nickname!')
    if (nickname.length > 30) throw new Error('Nickname too long! (Max 30 characters)')
    if (/<\/?[a-z][\s\S]*>/i.test(nickname)) throw new Error('Nickname cannot contain HTML tags!')
    if (containsProfanity(nickname)) throw new Error('Please choose a family-friendly nickname!')

    const res = await supabase.from('user_pets')
      .update({ nickname })
      .eq('id', pet.id)
      .eq('user_id', AppState.user.id)
    if (res.error) throw new Error('Failed to update nickname')

    // Mutating the reactive model updates every view of this pet at once —
    // legacy had to call loadMyPets() to re-render the whole tab.
    pet.nickname = nickname
    return nickname
  }

  async adopt(pet, nickname, price) {
    // .select() so the new row's id comes back — the scrapbook's 'adopted'
    // memory and the quest arc are both keyed to it.
    const res = await supabase.from('user_pets').insert([{
      user_id: AppState.user.id, pet_id: pet.id, nickname,
      level: 1, xp: 0, hunger: 50, energy: 50, happiness: 50,
      max_hunger: 100, max_energy: 100, max_happiness: 100
    }]).select().single()
    if (res.error) throw new Error(res.error.message)
    const created = res.data

    // Charged through `spendPoints` (spend_pp_secure) like every other purchase
    // in the app. This previously computed the new balance CLIENT-SIDE and wrote
    // it as an absolute value:
    //     const newPoints = AppState.player.pawketpoints - price
    //     await supabase.from('players').update({ pawketpoints: newPoints })
    // which was wrong in three ways. It clobbered any change made between the
    // client's read and its write, rather than letting Postgres do
    // `pawketpoints - price` atomically. It skipped the RPC's
    // `WHERE pawketpoints >= p_amount` affordability guard, so the balance was
    // whatever the client said. And it never reached `ppHistoryService`, so
    // adoptions were the one PP charge INVISIBLE in the player's PP History —
    // which makes a later balance look inexplicably short.
    if (price > 0) {
      const remaining = await playerService.spendPoints(price, 'pet_adoption')
      if (remaining === null) {
        console.error('[adopt] charge failed after the pet row was created')
      }
    }

    // The three keys matter: obs.html (and the Discord bot that shares its
    // message contract) builds "<user> adopted a <species> and named it
    // <nickname>!" from `species` + `nickname`, falling back to `pet_name`.
    // This previously sent only `{ pet_name: nickname }`, so the species was
    // missing entirely and an un-nicknamed adoption announced "adopted a a pet".
    await activityService.log('pet_adopted', {
      pet_name: nickname || pet.name,
      species: pet.name,
      nickname: nickname || null
    })

    AppState.ownedPetIds.push(pet.id)
    taskTracker.report('adopt_pet')
    badgeHooks.onAdopt()
    // Community counter behind the news ticker's "N new pets adopted today"
    // headline and the Home page's Today card (main:35177).
    trackDailyStat('pets_adopted')
    if (created && created.id) scrapbookService.add(created.id, 'adopted', {})

    // Legacy credited a pending `?ref=` referral right here, on first adoption
    // (main:3205) — not at signup, so a referral only counts once the invited
    // player actually starts playing. Returned rather than toasted so the page
    // can welcome them; never allowed to fail the adoption itself.
    const referrer = await referralService.processPendingReferral()
    streamerLandingService.clearSuggestion()
    return { referrer }
  }

  // The world event's happiness multiplier. Grand Pet Parade doubles it,
  // Friendship Festival and Strange Fog add 50%. Legacy names this bonus in the
  // event copy and in its own "helper functions" comment block, and then never
  // reads it — applied here for the same reason as the battle XP bonus.
  happinessMult() {
    return worldEventService.bonus('happinessGain')
  }

  async feed(pet) {
    if (!pet.canFeed) return
    const nh = Math.min(pet.hunger + 20, pet.max_hunger)
    const nhap = Math.min(pet.happiness + Math.round(5 * this.happinessMult()), pet.max_happiness)
    const nxp = pet.xp + 10
    const lu = calculateLevelUp(nxp, pet.level, pet.max_hunger, pet.max_energy, pet.max_happiness)
    const updates = { hunger: nh, happiness: nhap, xp: lu.xp, level: lu.level, last_fed: new Date().toISOString() }
    if (lu.leveled) { updates.max_hunger = lu.maxHunger; updates.max_energy = lu.maxEnergy; updates.max_happiness = lu.maxHappiness }
    const res = await supabase.from('user_pets').update(updates).eq('id', pet.id)
    if (res.error) throw new Error(res.error.message)
    Object.assign(pet, updates)
    taskTracker.report('feed_pet')
    passService.addXP(2, 'feed')
    questService.progress(pet.id, 'feed')
    petMoodService.completeWish(pet.id, 'feed')
    achievementTierService.check('feed_count', pet.id, 1)
    if (lu.leveled) { taskTracker.report('level_up_pet'); badgeHooks.onPetLevel(lu.level); passService.addXP(10, 'level_up') }
    return lu
  }

  async play(pet) {
    if (!pet.canPlay) return
    const ne = Math.max(pet.energy - 10, 0)
    const nhap = Math.min(pet.happiness + Math.round(15 * this.happinessMult()), pet.max_happiness)
    const nxp = pet.xp + 15
    const lu = calculateLevelUp(nxp, pet.level, pet.max_hunger, pet.max_energy, pet.max_happiness)
    const updates = { energy: ne, happiness: nhap, xp: lu.xp, level: lu.level, last_played: new Date().toISOString() }
    if (lu.leveled) { updates.max_hunger = lu.maxHunger; updates.max_energy = lu.maxEnergy; updates.max_happiness = lu.maxHappiness }
    const res = await supabase.from('user_pets').update(updates).eq('id', pet.id)
    if (res.error) throw new Error(res.error.message)
    Object.assign(pet, updates)
    taskTracker.report('play_pet')
    passService.addXP(2, 'play')
    questService.progress(pet.id, 'play')
    petMoodService.completeWish(pet.id, 'play')
    achievementTierService.check('play_count', pet.id, 1)
    if (lu.leveled) { taskTracker.report('level_up_pet'); badgeHooks.onPetLevel(lu.level); passService.addXP(10, 'level_up') }
    return lu
  }

  // Ports useOnPet(), game.js:7734-7827. Healing items (effect='healing'/
  // 'full_heal'/'revive') go through a direct HP update since use_item_secure
  // only covers hunger/energy/happiness/xp, not the current_hp column.
  // Everything else calls the secure RPC, which validates ownership,
  // applies effects, and decrements the inventory row server-side — so the
  // client only needs to mirror that decrement locally, not repeat it.
  async useItemOnPet(pet, invItem) {
    const isHealing = invItem.effect === 'healing' || invItem.effect === 'full_heal' || invItem.effect === 'revive'
    if (isHealing) {
      const healAmount = invItem.effectValue > 0 ? invItem.effectValue : 9999
      const petRow = await supabase.from('user_pets').select('current_hp, max_hp').eq('id', pet.id).maybeSingle()
      if (!petRow.data) throw new Error('Could not find pet.')
      const { current_hp: curHP, max_hp: maxHP } = petRow.data
      if (curHP >= maxHP) throw new Error('Pet is already at full HP!')
      const newHP = Math.min(curHP + healAmount, maxHP)
      const healed = newHP - curHP
      await supabase.from('user_pets').update({ current_hp: newHP }).eq('id', pet.id)
      await inventoryService.useItem(invItem)
      return { healed, currentHp: newHP, maxHp: maxHP }
    }

    const { data: ef, error } = await supabase.rpc('use_item_secure', { p_pet_id: pet.id, p_inv_id: invItem.invId })
    if (error) throw new Error(error.message)
    if (ef && ef.error) throw new Error(ef.error)

    const updates = {}
    if (ef.hunger !== undefined) updates.hunger = ef.hunger
    if (ef.energy !== undefined) updates.energy = ef.energy
    if (ef.happiness !== undefined) updates.happiness = ef.happiness
    if (ef.xp !== undefined) updates.xp = ef.xp
    if (ef.leveled_up && ef.new_level) updates.level = ef.new_level
    Object.assign(pet, updates)
    inventoryService.decrementLocal(invItem)

    // A Melon request can name a specific food, so the item id rides along.
    // Legacy reports the same distinction via updateBingoProgress's itemId arg.
    const kind = (invItem.itemType || '').toLowerCase()
    if (kind === 'toy') {
      taskTracker.report('use_toy', 1, { itemId: invItem.id })
      petMoodService.completeWish(pet.id, 'use_toy')
      petMoodService.completeWish(pet.id, 'play')
      // Scrapbook: the first time this pet plays with a given toy (main:6699).
      scrapbookService.add(pet.id, 'first_toy_use', { toy: invItem.name })
    } else {
      // Scrapbook: a favourite food, recorded when the pet reacts well. Legacy
      // gates this on the RPC's reaction_type (main:6396).
      if (ef.reaction_type === 'love' || ef.reaction_type === 'favorite') {
        scrapbookService.add(pet.id, 'favorite_food', { food: invItem.name })
      }
      // Legacy reports BOTH for a non-toy item, with the comment 'Any
      // item-based feed counts as a treat' (main:6366) — which is what makes
      // the Bingo 'Feed a Treat' square reachable at all.
      taskTracker.report('feed_pet', 1, { itemId: invItem.id })
      taskTracker.report('use_treat', 1, { itemId: invItem.id })
    }
    if (ef.leveled_up) { taskTracker.report('level_up_pet'); badgeHooks.onPetLevel(ef.new_level); passService.addXP(10, 'level_up') }

    return { reactionType: ef.reaction_type, leveledUp: !!ef.leveled_up, newLevel: ef.new_level }
  }
}

export const ownedPetsService = new OwnedPetsService()

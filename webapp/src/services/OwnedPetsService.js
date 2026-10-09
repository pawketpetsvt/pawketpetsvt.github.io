import { supabase } from './SupabaseService.js'
import { passService } from './PassService.js'
import * as badgeHooks from './BadgeHooks.js'
import { AppState } from '../AppState.js'
import { OwnedPet } from '../models/OwnedPet.js'
import { playerService } from './PlayerService.js'
import { inventoryService } from './InventoryService.js'
import { calculateEnergyRegen, calculateHungerDecay, calculateHappinessDecay } from '../utils/PetStatMath.js'
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
import { combatBuffService } from './CombatBuffService.js'

// True when an ISO timestamp falls on today's UTC date — legacy's
// `toISOString().split('T')[0]` comparison.
function sameUtcDay(iso) {
  return !!iso && new Date(iso).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)
}

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

  // ── Feed / Play ─────────────────────────────────────────────────────────
  // Ports feed()/feedFree()/feedWithItem() and play()/playFree()/playWithToy()
  // (game.js:6093-6716 at 826475d). On the live site the Feed and Play buttons
  // open a picker: one free option per pet per day, plus whatever food or toys
  // the player owns, each consumed on use. Both paths go through the server
  // RPCs, which apply the stats; feed_pet_secure also decrements the food, and
  // a toy is decremented in play() (see there).
  //
  // The port had replaced all of that with a direct `user_pets` update of fixed
  // amounts and no cost, so both buttons could be pressed indefinitely for free
  // stats and XP.
  //
  // "Used today" is read off `last_fed` / `last_played`, which the RPCs stamp —
  // legacy's own server-side check. (Legacy also kept a localStorage flag; it
  // added nothing the column doesn't already say.) As on the live site, any
  // feed that day stamps `last_fed`, so feeding an item also spends the free
  // treat.

  freeFeedUsed(pet) {
    return sameUtcDay(pet.last_fed)
  }

  freePlayUsed(pet) {
    return sameUtcDay(pet.last_played)
  }

  // `invItem` null = the free daily treat.
  async feed(pet, invItem = null) {
    if (!invItem && this.freeFeedUsed(pet)) throw new Error('Free daily treat already used today!')
    const r = await this._careRpc('feed_pet_secure', pet, invItem)
    const care = await this._applyCare(pet, r, { last_fed: new Date().toISOString() })

    taskTracker.report('feed_pet', 1, invItem ? { itemId: invItem.itemId } : undefined)
    passService.addXP(2, 'feed')
    questService.progress(pet.id, 'feed')
    petMoodService.completeWish(pet.id, 'feed')
    achievementTierService.check('feed_count', pet.id, 1)
    if (invItem) {
      // 'Any item-based feed counts as a treat' (main:6366).
      taskTracker.report('use_treat', 1, { itemId: invItem.itemId })
      if (care.reactionType === 'loved') scrapbookService.add(pet.id, 'favorite_food', { food: invItem.name })
      // A secret combat dish gives its battle buff however it's eaten. Legacy
      // applied it only in useItem(), so feeding one through the Feed picker
      // gave hunger and silently dropped the buff.
      care.combatBuff = await this.applyDishBuff(pet, invItem)
      await inventoryService.getInventory(AppState.user.id)
    }
    return care
  }

  // `invItem` null = the free daily playtime.
  async play(pet, invItem = null) {
    if (invItem) {
      if (!pet.canPlayWithToy) throw new Error('Not enough energy!')
    } else {
      if (this.freePlayUsed(pet)) throw new Error('Free playtime already used today!')
      if (!pet.canPlay) throw new Error('Not enough energy!')
    }
    const r = await this._careRpc('play_with_pet_secure', pet, invItem)
    const care = await this._applyCare(pet, r, { last_played: new Date().toISOString() })

    taskTracker.report('play_pet')
    passService.addXP(2, 'play')
    questService.progress(pet.id, 'play')
    petMoodService.completeWish(pet.id, 'play')
    achievementTierService.check('play_count', pet.id, 1)
    if (invItem) {
      // Unlike feed_pet_secure, play_with_pet_secure does NOT decrement the toy
      // — legacy's playWithToy never even reloaded the inventory afterwards, so
      // toys were reusable forever on the live site. A toy is a one-use item, so
      // it is consumed here, after the play succeeds. This is a direct
      // user_inventory write (the same one the healing-item path uses), so a
      // player calling the RPC by hand could still skip it; closing that needs
      // the decrement moved into the RPC itself.
      await inventoryService.useItem(invItem)
      taskTracker.report('use_toy', 1, { itemId: invItem.itemId })
      petMoodService.completeWish(pet.id, 'use_toy')
      scrapbookService.add(pet.id, 'first_toy_use', { toy: invItem.name })
      await inventoryService.getInventory(AppState.user.id)
    }
    return care
  }

  async _careRpc(fn, pet, invItem) {
    const { data, error } = await supabase.rpc(fn, { p_pet_id: pet.id, p_item_id: invItem ? invItem.itemId : null })
    if (error) throw new Error(error.message)
    if (data && data.error) throw new Error(data.error)
    return data || {}
  }

  // Mirrors the RPC's returned stats onto the reactive pet. On a level-up the
  // row is re-read for the new stat caps, which the RPC result doesn't carry.
  async _applyCare(pet, r, stamp) {
    const updates = { ...stamp }
    for (const k of ['hunger', 'energy', 'happiness', 'xp']) {
      if (typeof r[k] === 'number') updates[k] = r[k]
    }
    if (r.leveled_up && r.new_level) updates.level = r.new_level
    Object.assign(pet, updates)

    if (r.leveled_up) {
      const row = await supabase.from('user_pets')
        .select('level, xp, max_hunger, max_energy, max_happiness').eq('id', pet.id).maybeSingle()
      if (row.data) Object.assign(pet, row.data)
      taskTracker.report('level_up_pet')
      badgeHooks.onPetLevel(pet.level)
      passService.addXP(10, 'level_up')
    }

    // The world event's happiness bonus (see happinessMult) — the server applies
    // a flat amount, so the extra share is topped up here.
    let happinessGained = r.happiness_gained || 0
    const mult = this.happinessMult()
    if (mult > 1 && happinessGained > 0) {
      const happiness = Math.min(pet.happiness + Math.round(happinessGained * (mult - 1)), pet.max_happiness)
      const res = await supabase.from('user_pets').update({ happiness }).eq('id', pet.id)
      if (!res.error) {
        happinessGained += happiness - pet.happiness
        pet.happiness = happiness
      }
    }

    return {
      leveled: !!r.leveled_up,
      level: pet.level,
      hungerGained: r.hunger_gained || 0,
      happinessGained,
      xpGained: r.xp_gained || 0,
      reactionType: r.reaction_type || 'normal'
    }
  }

  // Ports useOnPet(), game.js:7734-7827. Healing items (effect='healing'/
  // 'full_heal'/'revive') go through a direct HP update since use_item_secure
  // only covers hunger/energy/happiness/xp, not the current_hp column.
  // Everything else calls the secure RPC, which validates ownership,
  // applies effects, and decrements the inventory row server-side — so the
  // client only needs to mirror that decrement locally, not repeat it.
  async useItemOnPet(pet, invItem) {
    if (invItem.isHealing) {
      const healAmount = invItem.effectValue > 0 ? invItem.effectValue : 9999
      const petRow = await supabase.from('user_pets').select('current_hp, max_hp').eq('id', pet.id).maybeSingle()
      if (!petRow.data) throw new Error('Could not find pet.')
      const { current_hp: curHP, max_hp: maxHP } = petRow.data
      if (curHP >= maxHP) throw new Error('Pet is already at full HP!')
      const newHP = Math.min(curHP + healAmount, maxHP)
      const healed = newHP - curHP
      await supabase.from('user_pets').update({ current_hp: newHP }).eq('id', pet.id)
      await inventoryService.useItem(invItem)
      return { healed, currentHp: newHP, maxHp: maxHP, combatBuff: await this.applyDishBuff(pet, invItem) }
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
      taskTracker.report('use_toy', 1, { itemId: invItem.itemId })
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
      taskTracker.report('feed_pet', 1, { itemId: invItem.itemId })
      taskTracker.report('use_treat', 1, { itemId: invItem.itemId })
    }
    if (ef.leveled_up) { taskTracker.report('level_up_pet'); badgeHooks.onPetLevel(ef.new_level); passService.addXP(10, 'level_up') }

    return {
      reactionType: ef.reaction_type,
      leveledUp: !!ef.leveled_up,
      newLevel: ef.new_level,
      combatBuff: await this.applyDishBuff(pet, invItem)
    }
  }

  // Ports the secret-recipe step of useItem() (game.js:3661-3707 at 826475d):
  // eating one of the six combat dishes puts a per-battle stat buff on the pet.
  // Never ported until now, which is why `pet_combat_buffs` held no rows. The
  // item is already consumed by this point, so a failed write is logged rather
  // than thrown — legacy treats it the same way.
  async applyDishBuff(pet, invItem) {
    const recipe = combatBuffService.recipeFor(invItem.name)
    if (!recipe) return null
    try {
      const battles = await combatBuffService.apply(pet.id, recipe)
      return { recipe, battles }
    } catch (e) {
      console.error('[ownedPetsService.applyDishBuff]', e)
      return null
    }
  }
}

export const ownedPetsService = new OwnedPetsService()

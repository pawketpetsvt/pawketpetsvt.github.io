import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { weatherService } from './WeatherService.js'
import { getPetMood } from '../utils/petMood.js'
import { SCRAPBOOK_TEMPLATES, WEATHER_MEMORY_LINES, SEASONS } from '../data/scrapbookData.js'

// Ports the pet scrapbook (scrapbook_*, game.js:35447-35850) — the running diary
// of memorable moments on each pet, stored in `pet_memories`.
//
// Memories are written from a dozen places across the game (adoption, battles,
// level milestones, evolutions, expeditions, first toy, favourite food,
// legendary catches, neglect recovery) and read back by the pet's scrapbook
// panel and by the shareable snapshot card.

// Hours a memory type must wait before it can be written again. Anything not
// listed here has no cooldown.
const COOLDOWN_HOURS = {
  random_flavor: 24,
  low_hp_victory: 24,
  hunger_empty: 24
}

// Written at most once per pet, ever.
const ONCE_PER_PET = ['adopted', 'first_battle_win', 'first_battle_loss']

const CD_KEY = 'scrapbook_cooldowns'
// Half the time, a random daily memory uses a weather-flavoured line instead.
const WEATHER_LINE_CHANCE = 0.5

function readCooldowns() {
  try { return JSON.parse(localStorage.getItem(CD_KEY) || '{}') } catch { return {} }
}

function writeCooldowns(map) {
  try { localStorage.setItem(CD_KEY, JSON.stringify(map)) } catch { /* private mode */ }
}

class ScrapbookService {
  // Ports scrapbook_getCalendarSeason(). Flavour only.
  season() {
    const month = new Date().getMonth()
    return SEASONS.find(s => s.months.includes(month)) || SEASONS[3]
  }

  onCooldown(petId, memoryType, hours) {
    const map = readCooldowns()
    const at = map[petId + ':' + memoryType]
    if (!at) return false
    return (Date.now() - at) < hours * 3600000
  }

  setCooldown(petId, memoryType) {
    const map = readCooldowns()
    map[petId + ':' + memoryType] = Date.now()
    writeCooldowns(map)
  }

  async hasMemory(userPetId, memoryType) {
    if (!userPetId || !memoryType) return false
    const res = await supabase
      .from('pet_memories').select('id')
      .eq('user_pet_id', userPetId).eq('memory_type', memoryType).limit(1)
    if (res.error) return false
    return !!(res.data && res.data.length)
  }

  // Ports scrapbook_addMemory(). Returns true only when a row was actually
  // written, so a caller can tell "already had it" from "just earned it".
  //
  // Legacy resolves the pet's name and mood from `petState`, an in-memory cache
  // only populated by visiting My Pets — so a memory written from a battle or an
  // expedition before that tab was opened said "Your pet" and tagged the mood
  // from an empty object. The row is queried here instead, the same fix pattern
  // as the guild create form and the dungeon party builder.
  async add(userPetId, memoryType, variables = {}) {
    if (!userPetId || !memoryType) return false

    const cooldown = COOLDOWN_HOURS[memoryType] || 0
    if (cooldown > 0 && this.onCooldown(userPetId, memoryType, cooldown)) return false

    if (ONCE_PER_PET.includes(memoryType) && await this.hasMemory(userPetId, memoryType)) {
      return false
    }

    const weatherId = weatherService.currentId()
    let templates = SCRAPBOOK_TEMPLATES[memoryType]
    if (memoryType === 'random_flavor' &&
        WEATHER_MEMORY_LINES[weatherId] &&
        Math.random() < WEATHER_LINE_CHANCE) {
      templates = WEATHER_MEMORY_LINES[weatherId]
    }
    if (!templates || !templates.length) {
      console.error('[scrapbook] unknown memory type:', memoryType)
      return false
    }

    const pet = await this.petFor(userPetId)
    const petName = (pet && (pet.nickname || (pet.pets && pet.pets.name))) || 'Your pet'
    const trainer = (AppState.player && AppState.player.username) || 'their trainer'

    const fill = {
      pet: petName,
      trainer,
      enemy: variables.enemy || 'an enemy',
      level: variables.level || '?',
      food: variables.food || 'a treat',
      hp: variables.hp || 'low',
      zone: variables.zone || 'the wilderness',
      toy: variables.toy || 'a toy',
      fish: variables.fish || 'a rare fish'
    }
    let text = templates[Math.floor(Math.random() * templates.length)]
    for (const [k, v] of Object.entries(fill)) {
      text = text.split('{' + k + '}').join(v)
    }

    const mood = pet
      ? getPetMood(pet.hunger, pet.energy, pet.happiness, pet.max_hunger, pet.max_energy, pet.max_happiness)
      : null

    try {
      const res = await supabase.from('pet_memories').insert({
        user_pet_id: userPetId,
        memory_text: text,
        memory_type: memoryType,
        weather: weatherId || null,
        mood: mood ? mood.mood : null
      })
      if (res.error) {
        console.error('[scrapbook] insert failed:', res.error)
        return false
      }
      if (cooldown > 0) this.setCooldown(userPetId, memoryType)
      return true
    } catch (e) {
      console.error('[scrapbook] add threw:', e)
      return false
    }
  }

  async petFor(userPetId) {
    try {
      const res = await supabase
        .from('user_pets')
        .select('nickname, hunger, energy, happiness, max_hunger, max_energy, max_happiness, pets(name)')
        .eq('id', userPetId).maybeSingle()
      return res.data || null
    } catch {
      return null
    }
  }

  // Ports scrapbook_addRandomMemory() — one ambient memory per pet per day.
  async addRandomDaily(petId) {
    const key = 'sb_random_' + petId + '_' + new Date().toISOString().slice(0, 10)
    try {
      if (localStorage.getItem(key)) return false
      localStorage.setItem(key, 'true')
    } catch { /* private mode — the 24h cooldown below still applies */ }
    return this.add(petId, 'random_flavor', {})
  }

  async load(userPetId, limit = 15) {
    if (!userPetId) return []
    const res = await supabase
      .from('pet_memories')
      .select('id, memory_text, memory_type, created_at, weather, mood, entry_data')
      .eq('user_pet_id', userPetId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (res.error) {
      console.error('[scrapbook] load failed:', res.error)
      return []
    }
    return res.data || []
  }

  // The single most recent line, for the snapshot card's memory strip.
  async latest(userPetId) {
    const rows = await this.load(userPetId, 1)
    return rows.length ? rows[0].memory_text : null
  }

  // Ports scrapbook_saveNote() — the player's own annotation on a memory.
  async saveNote(memoryId, note) {
    const res = await supabase
      .from('pet_memories')
      .update({ entry_data: { note: (note || '').slice(0, 200) } })
      .eq('id', memoryId)
    if (res.error) throw new Error(res.error.message)
  }
}

export const scrapbookService = new ScrapbookService()

import { PET_SKILLS, SKILL_KEY_MAP } from '../data/battleData.js'

// Ports the petSkills_* helpers (game.js:7232-7275).

// A pet's DB name (or its streamer alias) resolved to a PET_SKILLS key.
export function skillKeyFor(petName) {
  const lower = (petName || '').toLowerCase()
  return SKILL_KEY_MAP[lower] || lower
}

// How many active skills a pet may take into battle. Ports petSkills_slotCount().
export function skillSlotCount(level) {
  if (level >= 20) return 6
  if (level >= 12) return 5
  if (level >= 5) return 4
  return 3
}

// Every active (non-passive) skill unlocked at this level, before slot limits.
export function unlockedSkills(petName, petLevel) {
  const all = PET_SKILLS[skillKeyFor(petName)] || []
  return all.filter(s => !s.passive && s.unlockLevel <= (petLevel || 1))
}

// Passive skills are always on and don't consume a slot.
export function passiveSkills(petName, petLevel) {
  const all = PET_SKILLS[skillKeyFor(petName)] || []
  return all.filter(s => s.passive && s.unlockLevel <= (petLevel || 1))
}

// Ports petSkills_getLoadout(). The player's chosen loadout is stored per pet
// in localStorage — the legacy behaviour, kept deliberately: it is a UI
// preference, not game state the server needs to trust.
//
// A saved loadout is filtered against what is currently unlocked (so a skill
// list saved before a level-up or a data change can't produce holes), then
// topped up in unlock order and trimmed to the slot count.
export function skillLoadout(petId, petName, petLevel) {
  const all = PET_SKILLS[skillKeyFor(petName)] || []
  const unlocked = unlockedSkills(petName, petLevel)
  const slots = skillSlotCount(petLevel || 1)

  let saved = null
  try {
    saved = JSON.parse(localStorage.getItem('skill_loadout_' + petId) || 'null')
  } catch (e) { /* unreadable storage — fall through to the default loadout */ }

  if (saved && Array.isArray(saved)) {
    const validIds = unlocked.map(s => s.id)
    const chosen = saved.filter(id => validIds.includes(id))
    for (const s of unlocked) {
      if (chosen.length >= slots) break
      if (!chosen.includes(s.id)) chosen.push(s.id)
    }
    return chosen.slice(0, slots).map(id => all.find(s => s.id === id)).filter(Boolean)
  }

  return unlocked.slice(0, slots)
}

export function saveSkillLoadout(petId, skillIds) {
  try {
    localStorage.setItem('skill_loadout_' + petId, JSON.stringify(skillIds))
  } catch (e) { /* storage full or blocked — the default loadout still works */ }
}

// Ports getEvolutionStage()/getEvolutionBonuses() (game.js:6303-ish). Stat
// bumps land at the level-5 and level-10 milestones.
export function evolutionStage(level) {
  if (level >= 10) return 'adult'
  if (level >= 5) return 'teen'
  return 'baby'
}

export function evolutionBonuses(stage) {
  if (stage === 'adult') return { hp: 35, attack: 15, defense: 10, speed: 7 }
  if (stage === 'teen') return { hp: 15, attack: 6, defense: 4, speed: 3 }
  return { hp: 0, attack: 0, defense: 0, speed: 0 }
}

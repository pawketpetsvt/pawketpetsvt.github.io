import { PET_BACKSTORIES, PET_PERSONALITIES } from '../data/petCardData.js'

// Pet-card display helpers, ported from makeMyPetCard's inline helpers
// (game.js:3780-3823). These render the achievement pips, the "last
// interaction" line and the habitat gradient behind the avatar.

// Ports getAchievements(). Purely derived from the pet's own stats — these are
// card decorations, distinct from the real `user_badges` achievement system.
//
// Legacy's first pip was a plain "Lv.N" badge. It's dropped here: the card
// already shows the level in `.pet-card-level` directly above the pip row,
// so it was the same number twice.
export function getAchievements(pet) {
  const badges = []
  if (pet.level >= 5) badges.push({ icon: '🌟', label: 'Veteran', cls: 'purple' })
  if (pet.level >= 10) badges.push({ icon: '👑', label: 'Legend', cls: 'gold' })
  if (pet.xp >= 50) badges.push({ icon: '🏅', label: 'Trained', cls: 'bronze' })
  if (pet.happiness >= 80) badges.push({ icon: '💖', label: 'Happy', cls: 'silver' })
  if (pet.max_hunger > 100) badges.push({ icon: '📈', label: 'Growing', cls: 'purple' })
  return badges
}

// Ports getLastSeenText(). Uses whichever of feed/play happened most recently.
export function getLastSeenText(lastFed, lastPlayed) {
  let lastTime = null
  if (lastFed && lastPlayed) {
    lastTime = new Date(lastFed) > new Date(lastPlayed) ? new Date(lastFed) : new Date(lastPlayed)
  } else if (lastFed) {
    lastTime = new Date(lastFed)
  } else if (lastPlayed) {
    lastTime = new Date(lastPlayed)
  } else {
    return 'Never interacted yet'
  }

  const mins = Math.floor((Date.now() - lastTime.getTime()) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return mins + ' minute' + (mins === 1 ? '' : 's') + ' ago'
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return hrs + ' hour' + (hrs === 1 ? '' : 's') + ' ago'
  const days = Math.floor(hrs / 24)
  return days + ' day' + (days === 1 ? '' : 's') + ' ago'
}

// Ports getHabitatStyle(). Per-VTuber gradient behind the avatar, with a
// purple default for everyone not given their own.
const HABITATS = {
  Embertail: 'linear-gradient(180deg, #ff9f43 0%, #ffcc70 60%, #fffaf6 100%)',
  Pyxshuul: 'linear-gradient(180deg, #b06aff 0%, #e8d5ff 60%, #fffaf6 100%)'
}

export function getHabitatBackground(vtuberName) {
  return HABITATS[vtuberName] || 'linear-gradient(180deg, var(--purple) 0%, var(--purple-light) 60%, #fffaf6 100%)'
}

// Ports getEvolutionEmoji() — the glyph shown before the nickname.
export function getEvolutionEmoji(stage) {
  if (stage === 'adult') return '🐺'
  if (stage === 'teen') return '🦊'
  return '🐣'
}

export function getEvolutionStageName(stage) {
  return stage === 'adult' ? 'Adult' : stage === 'teen' ? 'Teen' : 'Baby'
}

// Ports getPetBackstory().
export function getPetBackstory(petName) {
  return PET_BACKSTORIES[petName] || 'Coming soon... 🌟'
}

// Ports getPetPersonalityMessage(). Picks a flavour line from the pool matching
// the pet's overall condition — or the neglected pool outright if nothing has
// interacted with it for 24h. The index is derived from the current hour so the
// line changes through the day but stays stable across re-renders rather than
// flickering on every repaint.
//
// LEGACY BUG, fixed here: PET_PERSONALITIES is keyed by the PET's name
// ('Ember', 'Pyxie', 'Kleat'…), but makeMyPetCard looked it up with
// `info.vtuber_name || info.name` — and vtuber_name is the STREAMER
// ('Embertail', 'Pyxshuul'). That lookup misses for every pet, so
// `getPetPersonalityMessage` returns null and the personality line never
// renders on the live site at all. Same shape as the getPetMood arity bug
// found in Phase 6. This takes the pet name first and only falls back to
// vtuber_name, so the lines actually appear.
export function getPetPersonalityMessage(petName, pet) {
  const p = PET_PERSONALITIES[petName]
  if (!p) return null

  const { hunger, energy, happiness, max_hunger: mh, max_energy: me, max_happiness: mhap,
    last_fed: lastFed, last_played: lastPlayed } = pet

  const hourIndex = Math.floor(Date.now() / 3600000)
  const pick = (pool) => pool[hourIndex % pool.length]

  let lastActivity = null
  if (lastFed && lastPlayed) {
    lastActivity = new Date(lastFed) > new Date(lastPlayed) ? new Date(lastFed) : new Date(lastPlayed)
  } else if (lastFed) lastActivity = new Date(lastFed)
  else if (lastPlayed) lastActivity = new Date(lastPlayed)

  if (lastActivity && (Date.now() - lastActivity.getTime()) / 3600000 >= 24) {
    return pick(p.neglected)
  }

  const overall = (
    (mh > 0 ? hunger / mh : 1) +
    (me > 0 ? energy / me : 1) +
    (mhap > 0 ? happiness / mhap : 1)
  ) / 3

  if (overall >= 0.85) return pick(p.thriving)
  if (overall >= 0.65) return pick(p.happy)
  if (overall >= 0.40) return pick(p.meh)
  if (overall >= 0.20) return pick(p.sad)
  return pick(p.neglected)
}

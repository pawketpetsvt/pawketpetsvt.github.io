// The base regen rate is 5 energy an hour. `multiplier` is the combined world
// event × weather energyRegen bonus, which legacy applies right here
// (main:4362-4366) — passed in rather than imported so this module stays pure
// and testable. It defaults to 1, so a caller that has no world state to hand
// gets exactly the old behaviour.
export function calculateEnergyRegen(currentEnergy, maxEnergy, lastPlayedTimestamp, multiplier = 1) {
  if (!lastPlayedTimestamp) return currentEnergy
  const hours = (new Date() - new Date(lastPlayedTimestamp)) / (1000 * 60 * 60)
  return Math.min(currentEnergy + Math.floor(hours * 5 * multiplier), maxEnergy)
}

export function calculateHungerDecay(currentHunger, lastFedTimestamp) {
  if (!lastFedTimestamp) return currentHunger
  const hours = (new Date() - new Date(lastFedTimestamp)) / (1000 * 60 * 60)
  return Math.max(currentHunger - Math.floor(hours * 0.625), 0)
}

// `decayMultiplier` is the weather's happinessDecay figure, where LOWER is
// better (0.85 on a sunny day = decays 15% slower).
//
// NOTE: legacy defines that figure and never reads it — the only consumer of
// `weatherSystem.getWeatherBonus('happinessDecay')` anywhere in the codebase is
// nothing. It is applied here because the weather tooltip states it as a
// promise to the player ("Happiness decays 15% slower"), and a displayed bonus
// that does nothing is the exact pattern this migration keeps finding and
// fixing — Rare Shoal, the room bonuses, the expedition pace, Guard.
export function calculateHappinessDecay(currentHappiness, lastFedTimestamp, lastPlayedTimestamp, decayMultiplier = 1) {
  let lastInteraction = null
  if (lastFedTimestamp && lastPlayedTimestamp) {
    lastInteraction = new Date(lastFedTimestamp) > new Date(lastPlayedTimestamp)
      ? new Date(lastFedTimestamp) : new Date(lastPlayedTimestamp)
  } else if (lastFedTimestamp) {
    lastInteraction = new Date(lastFedTimestamp)
  } else if (lastPlayedTimestamp) {
    lastInteraction = new Date(lastPlayedTimestamp)
  } else {
    return currentHappiness
  }
  const hours = (new Date() - lastInteraction) / (1000 * 60 * 60)
  return Math.max(currentHappiness - Math.floor(hours * 0.625 * decayMultiplier), 0)
}

export function calculateLevelUp(currentXp, currentLevel, currentMaxHunger, currentMaxEnergy, currentMaxHappiness) {
  const xpForNext = currentLevel * 100
  if (currentXp < xpForNext) {
    return { leveled: false, level: currentLevel, xp: currentXp, maxHunger: currentMaxHunger, maxEnergy: currentMaxEnergy, maxHappiness: currentMaxHappiness }
  }
  return {
    leveled: true,
    level: currentLevel + 1,
    xp: currentXp - xpForNext,
    maxHunger: currentMaxHunger + 5,
    maxEnergy: currentMaxEnergy + 5,
    maxHappiness: currentMaxHappiness + 5
  }
}

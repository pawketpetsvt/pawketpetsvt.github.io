export function calculateEnergyRegen(currentEnergy, maxEnergy, lastPlayedTimestamp) {
  if (!lastPlayedTimestamp) return currentEnergy
  const hours = (new Date() - new Date(lastPlayedTimestamp)) / (1000 * 60 * 60)
  return Math.min(currentEnergy + Math.floor(hours * 5), maxEnergy)
}

export function calculateHungerDecay(currentHunger, lastFedTimestamp) {
  if (!lastFedTimestamp) return currentHunger
  const hours = (new Date() - new Date(lastFedTimestamp)) / (1000 * 60 * 60)
  return Math.max(currentHunger - Math.floor(hours * 0.625), 0)
}

export function calculateHappinessDecay(currentHappiness, lastFedTimestamp, lastPlayedTimestamp) {
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
  return Math.max(currentHappiness - Math.floor(hours * 0.625), 0)
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

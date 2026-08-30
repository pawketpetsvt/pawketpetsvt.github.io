// Ports getPetMood(), game.js:4797-4813.
//
// Note: the legacy public-profile caller (game.js:11864) invokes this with
// only 3 of its 6 arguments, so maxHunger/maxEnergy/maxHappiness arrive
// undefined, every percentage computes to NaN, and every comparison falls
// through — meaning every pet on every public profile renders as "Miserable"
// regardless of its real stats. The max values default here so a 3-arg call
// still behaves sensibly, and the profile page passes the real ones.
export function getPetMood(hunger, energy, happiness, maxHunger = 100, maxEnergy = 100, maxHappiness = 100) {
  const overall = (
    (hunger / maxHunger) * 100 +
    (energy / maxEnergy) * 100 +
    (happiness / maxHappiness) * 100
  ) / 3

  if (overall >= 90) return { mood: 'Ecstatic', emoji: '😍', color: '#5dde7a' }
  if (overall >= 75) return { mood: 'Happy', emoji: '😊', color: '#8de6a1' }
  if (overall >= 60) return { mood: 'Content', emoji: '🙂', color: '#ffdd00' }
  if (overall >= 40) return { mood: 'Okay', emoji: '😐', color: '#ff9f43' }
  if (overall >= 25) return { mood: 'Unhappy', emoji: '😟', color: '#ff9933' }
  if (overall >= 10) return { mood: 'Sad', emoji: '😢', color: '#ff6b6b' }
  return { mood: 'Miserable', emoji: '😭', color: '#ff3838' }
}

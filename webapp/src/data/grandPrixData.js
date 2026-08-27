// Grand Prix data, ported from GP_TRAINING_TYPES / GP_VARIANT_BONUS
// (game.js:26736-26748).

// Training raises your entry's race score during the racing phase, capped at
// TRAINING_CAP for the week. `lucky` is the odd one out: its listed bonus of -1
// is a placeholder — the real gain is rolled at 2-10 (see grandPrixService.train).
export const GP_TRAINING_TYPES = {
  speed: { label: '💨 Speed Training', bonus: 3, energyCost: 10, ppCost: 0, happinessCost: 0, energyGain: 0, desc: '+3 race score · Costs 10 energy' },
  stamina: { label: '💪 Stamina Training', bonus: 1, energyCost: 0, ppCost: 0, happinessCost: 0, energyGain: 15, desc: '+1 race score · Free! Grants +15 energy' },
  focus: { label: '🎯 Focus Training', bonus: 5, energyCost: 20, ppCost: 0, happinessCost: 10, energyGain: 0, desc: '+5 race score · Costs 20 energy & 10 happiness' },
  lucky: { label: '🍀 Lucky Training', bonus: -1, energyCost: 0, ppCost: 15, happinessCost: 0, energyGain: 0, desc: '+2–10 random bonus · Costs 15 PP' }
}

export const TRAINING_CAP = 15

// A pet's cosmetic variant is worth flat race score.
export const GP_VARIANT_BONUS = {
  golden: 12, shiny: 10, cosmic: 15, shadow: 5,
  fire: 8, ice: 8, electric: 10, nature: 5, crystal: 8, ghost: 3
}

export const GP_ENTRY_FEE = 100

// Ports gp_prizeTable()'s copy. The real payouts come from the
// `grand_prix_rewards` table at claim time; this is what the player is told
// up front.
export const GP_PRIZE_STRUCTURE = [
  '🥇 1st: 30% of prize pool + Grand Champion title',
  '🥈 2nd: 15% of prize pool + Speed Demon title',
  '🥉 3rd: 10% of prize pool + Racer title',
  '🏅 4th–10th: Top 10 Finisher badge',
  '🎖️ 11th+: 25 PP consolation'
]

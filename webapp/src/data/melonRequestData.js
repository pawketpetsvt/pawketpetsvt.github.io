// Melon's Requests — 2-3 daily errands from the shopkeeper, ported from the
// MELON_REQUEST_TEMPLATES / MELON_MYSTERY_REQUESTS tables in game.js.
//
// Legacy stores each request's copy as a `generateText()` function so the food
// requests can interpolate an item name. Only the food ones actually vary, so
// the fixed requests carry plain strings here and the food request builds its
// own line — same output, without a function per row.

export const MELON_REQUESTS = [
  { id: 'play_pet', icon: '🎾', reward: 30, trackKey: 'play_pet', text: 'Could you play with one of your pets today? They seem restless.' },
  { id: 'win_battle', icon: '⚔️', reward: 40, trackKey: 'win_battle', text: "I heard there's been a lot of activity in the battle arena. Think you could win one for me?" },
  { id: 'visit_shop', icon: '🛒', reward: 15, trackKey: 'visit_shop', text: 'Business has been slow today. Stop by the shop, would you? Even just to browse.' },
  { id: 'play_minigame', icon: '🎮', reward: 25, trackKey: 'complete_minigame', text: "I've been thinking about the fishing pond. Have you been lately? The weather's nice." },
  { id: 'expedition', icon: '🗺️', reward: 35, trackKey: 'complete_expedition', text: "Could you send a pet on an expedition? I want to know what's out there these days." },
  { id: 'login_check', icon: '📅', reward: 10, trackKey: 'login', text: "Just... check in today, okay? I like knowing you're here." }
]

// Rare, quietly unsettling variants — 15% chance of replacing the last request.
export const MELON_MYSTERY_REQUESTS = [
  { id: 'mystery_piper', icon: '❓', reward: 50, trackKey: 'visit_shop', mystery: true, text: '...Could you check the redeem codes page? I thought I saw something there earlier. Probably nothing.' },
  { id: 'mystery_corruption', icon: '🟣', reward: 45, trackKey: 'win_battle', mystery: true, text: "The world's integrity is a little lower today. I worry about that. Could you battle something? It helps, somehow." }
]

// The three phrasings a food request picks between.
export const MELON_FOOD_LINES = [
  (name) => `I've been craving ${name} lately. Could you feed some to your pets?`,
  (name) => `Your pets could use some ${name} today, I think.`,
  (name) => `A little ${name} goes a long way. Could you feed one to a pet?`
]

export const MYSTERY_CHANCE = 0.15

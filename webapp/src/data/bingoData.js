// Daily Bingo task pool, extracted verbatim from BINGO_TASKS (game.js:11406).
//
// 12 of these are drawn each day into a 4x3 grid. Every `taskType` is a member
// of TaskTrackerService's vocabulary — that bus was built for this system and
// for Melon's Requests, which is why no translation layer is needed here.
export const BINGO_TASKS = [
  // ── Core daily tasks ──────────────────────────────────────────────────────
  { id: 'feed_pet',         name: '🍖 Feed a Pet',         target: 5,   taskType: 'feed_pet',         rewardPoints: 50  },
  { id: 'play_pet',         name: '🎾 Play with Pet',       target: 5,   taskType: 'play_pet',         rewardPoints: 50  },
  { id: 'use_treat',        name: '🍬 Feed a Treat',        target: 3,   taskType: 'use_treat',        rewardPoints: 50  },
  { id: 'use_toy',          name: '🧸 Use a Toy',           target: 3,   taskType: 'use_toy',          rewardPoints: 50  },
  { id: 'login',            name: '📅 Daily Login',         target: 1,   taskType: 'login',            rewardPoints: 20  },
  { id: 'visit_shop',       name: '🛒 Visit Shop',          target: 1,   taskType: 'visit_shop',       rewardPoints: 20  },
  { id: 'pet_companion',    name: '💬 Chat with Companion', target: 5,   taskType: 'pet_companion',    rewardPoints: 50  },
  { id: 'earn_points',      name: '💰 Earn 500 PP',         target: 500, taskType: 'earn_points',      rewardPoints: 100 },
  // ── Progression tasks ─────────────────────────────────────────────────────
  { id: 'win_battle',       name: '⚔️ Win a Battle',        target: 3,   taskType: 'win_battle',       rewardPoints: 100 },
  { id: 'level_up_pet',     name: '⬆️ Level Up a Pet',      target: 1,   taskType: 'level_up_pet',     rewardPoints: 100 },
  { id: 'adopt_pet',        name: '🐣 Adopt a Pet',          target: 1,   taskType: 'adopt_pet',        rewardPoints: 150 },
  { id: 'complete_minigame',name: '🎮 Play a Minigame',      target: 1,   taskType: 'complete_minigame',rewardPoints: 75  },
  { id: 'complete_expedition',name:'🗺️ Complete Expedition',  target: 1,   taskType: 'complete_expedition',rewardPoints: 75},
  // ── Social/community tasks ─────────────────────────────────────────────────
  { id: 'send_gift',        name: '🎁 Send a Gift',         target: 1,   taskType: 'send_gift',        rewardPoints: 75  },
  { id: 'vote_poll',        name: '🗳️ Vote in a Poll',      target: 1,   taskType: 'vote_poll',        rewardPoints: 30  },
  { id: 'donate_guild',     name: '🏛️ Donate to Guild',     target: 1,   taskType: 'donate_guild',     rewardPoints: 75  },
  { id: 'vote_in_guild',    name: '🗳️ Cast Guild Vote',      target: 1,   taskType: 'vote_in_guild',    rewardPoints: 50  },
  { id: 'guild_dungeon',    name: '⚔️ Guild Dungeon Run',    target: 1,   taskType: 'guild_dungeon',    rewardPoints: 100 },
  // ── Grand Prix tasks ──────────────────────────────────────────────────────
  { id: 'enter_grand_prix', name: '🏁 Enter Grand Prix',    target: 1,   taskType: 'enter_grand_prix', rewardPoints: 50  },
  { id: 'train_grand_prix', name: '🏋️ Train for Grand Prix',target: 3,   taskType: 'train_grand_prix', rewardPoints: 75  },
  { id: 'grand_prix_top_10',name: '🏅 Grand Prix Top 10',   target: 1,   taskType: 'grand_prix_top_10',rewardPoints: 150 },
  { id: 'grand_prix_winner',name: '🏆 Win Grand Prix',       target: 1,   taskType: 'grand_prix_winner',rewardPoints: 300 },
  // ── Quest tasks ───────────────────────────────────────────────────────────
  { id: 'complete_quest',   name: '📜 Complete a Quest',    target: 1,   taskType: 'complete_quest',   rewardPoints: 100 },
  { id: 'complete_race',    name: 'Finish a Race',     target: 1, taskType: 'complete_race',    rewardPoints: 50  },
  { id: 'race_podium',      name: 'Race Top 3 Finish', target: 1, taskType: 'race_podium',      rewardPoints: 150 },
  { id: 'train_pet_racing', name: 'Train for Racing',  target: 1, taskType: 'train_pet_racing', rewardPoints: 30  }
]

// Task types nothing announces yet, so a square drawn from them could never be
// completed — and because a dead square sits inside a row, a column and
// possibly a diagonal, it would permanently block a line AND the blackout.
// Excluded from the draw rather than handed to players as an unwinnable cell.
//
// EMPTY as of Phase 9.5: the last two entries were `send_gift` and
// `complete_quest`, and both Gifting and Personality Quests now report. Every
// square in the pool is reachable. Kept as the mechanism, so a future task type
// that outruns its system has somewhere to go.
export const BINGO_UNREACHABLE = []

// BINGO_DRAWABLE is what the board draws from. BINGO_TASKS (the full table) and
// BINGO_UNREACHABLE are exported for reference and are deliberately consumed
// only here — an orphan sweep will list them; that is expected.
export const BINGO_DRAWABLE = BINGO_TASKS.filter(t => !BINGO_UNREACHABLE.includes(t.taskType))

// The grid is 3 rows x 4 columns; these are its 9 winning lines.
//
// Legacy's own comment says "4x3 grid = 10 lines total" while its array holds
// nine — 3 rows + 4 columns + 2 diagonals. Nine is what the code has always
// checked, so nine is what is ported; only the comment was ever wrong.
export const BINGO_LINES = [
  [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11],          // rows
  [0, 4, 8], [1, 5, 9], [2, 6, 10], [3, 7, 11],        // columns
  [0, 5, 10], [3, 6, 9]                                // diagonals
]

export const BINGO_SQUARES = 12
export const BINGO_LINE_PP = 100
export const BINGO_LINE_XP = 50
export const BINGO_SQUARE_XP = 15
export const BINGO_BLACKOUT_PP = 500
export const BINGO_BLACKOUT_XP = 200
export const SKIN_KEY_ITEM_ID = '00000000-0000-0000-0000-000000000001'

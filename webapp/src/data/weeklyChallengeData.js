// Weekly challenge pool, extracted verbatim from WEEKLY_CHALLENGE_POOL
// (game.js:12413). Five are drawn per week by a week-seeded shuffle, so every
// player sees the same five and they are stable for the whole week.
export const WEEKLY_CHALLENGE_POOL = [
  { id: 'win_battles',       label: 'Win 15 battles',                 emoji: '⚔️',  target: 15,  stat: 'wk_battles_won',      reward: 150 },
  { id: 'catch_fish',        label: 'Catch 25 fish',                  emoji: '🎣',  target: 25,  stat: 'wk_fish_caught',       reward: 100 },
  { id: 'expeditions',       label: 'Complete 5 expeditions',         emoji: '🗺️',  target: 5,   stat: 'wk_expeditions',       reward: 120 },
  { id: 'feed_pets',         label: 'Feed your pets 20 times',        emoji: '🍖',  target: 20,  stat: 'wk_feeds',             reward: 80  },
  { id: 'earn_pp',           label: 'Earn 400 PP',                    emoji: '💰',  target: 400, stat: 'wk_pp_earned',         reward: 100 },
  { id: 'use_skills',        label: 'Use battle skills 20 times',     emoji: '✨',  target: 20,  stat: 'wk_skills_used',       reward: 130 },
  { id: 'play_minigames',    label: 'Play 10 minigames',              emoji: '🎮',  target: 10,  stat: 'wk_minigames',         reward: 90  },
  { id: 'boss_encounters',   label: 'Fight a boss battle',            emoji: '⚠️',  target: 1,   stat: 'wk_boss_fights',       reward: 200 },
  { id: 'daily_logins',      label: 'Log in 5 days this week',        emoji: '📅',  target: 5,   stat: 'wk_logins',            reward: 100 },
  { id: 'use_items_battle',  label: 'Use items in battle 5 times',   emoji: '🧪',  target: 5,   stat: 'wk_battle_items',      reward: 90  },
  { id: 'win_without_dmg',   label: 'Win a battle without damage',    emoji: '🛡️',  target: 1,   stat: 'wk_untouchable',       reward: 150 },
  { id: 'fish_rare',         label: 'Catch 3 rare or better fish',   emoji: '🌟',  target: 3,   stat: 'wk_fish_rare',         reward: 120 }
]

export const WEEKLY_PICK_COUNT = 5
export const WEEKLY_ALL_COMPLETE_PP = 250

// Home page data, ported from game.js.

// Ports EVENT_CALENDAR — the "This Week" strip. Keyed by JS day-of-week
// (0 = Sunday), which is what `new Date().getDay()` returns.
//
// The bonuses are NOT decorative: getCalendarBonus() is read by battle XP
// (game.js:16217) and minigame PP (game.js:35188), doubling them on the
// matching day. The other five days advertise bonuses that nothing reads —
// fishing, guild, race, boss and pet are informational only, on the live site
// as here. Left as-is rather than invented: making them real is a balance
// decision, not a port.
export const EVENT_CALENDAR = {
  1: { name: 'Minigame Monday',    icon: '🎮', color: '#9966ff', bonus: '2x PP from all minigames',        stat: 'minigame_pp' },
  2: { name: 'Battle Tuesday',     icon: '⚔️', color: '#ff6b6b', bonus: '2x XP from battles',              stat: 'battle_xp'  },
  3: { name: 'Fishing Wednesday',  icon: '🎣', color: '#4dabf7', bonus: 'Rare fish spawn rate doubled',     stat: 'fishing'    },
  4: { name: 'Guild Thursday',     icon: '🏛️', color: '#51cf66', bonus: '2x guild treasury donations',     stat: 'guild'      },
  5: { name: 'Race Friday',        icon: '🏁', color: '#ffd43b', bonus: 'Grand Prix registration open!',    stat: 'race'       },
  6: { name: 'Boss Saturday',      icon: '👹', color: '#ff4500', bonus: 'Boss difficulty increased + drops',stat: 'boss'       },
  0: { name: 'Pet Sunday',         icon: '💖', color: '#ff9f43', bonus: 'Double happiness from feeding',    stat: 'pet'        }
}

// Ports dailyTips — the "Did You Know?" pool.
export const DAILY_TIPS = [
  "Pets with higher happiness perform better in battles!",
  "Play minigames daily to earn PawketPoints!",
  "Your pet's level increases their battle stats!",
  "Boss battles drop exclusive items!",
  "Equipment boosts your pet's combat stats!",
  "Ember's Flametail Strike deals 1.5x damage!",
  "Pyxie's Raspberry Soda Stream heals while attacking!",
  "Login daily to build your streak for bonus rewards!",
  "Feed your pets to keep them happy and healthy!",
  "Check the leaderboard to see top players!",
  "Friend other players to see their activity!",
  "Leave guestbook messages on profiles!",
  "Evolving your pet changes their appearance!",
  "Pets have 3 evolution stages: Baby, Teen, and Adult!",
  "Win battles to earn XP and level up your pet!",
  "The shop has items in different tiers - higher tiers cost more!",
  "Boss battles are the ultimate challenge!",
  "Skills have a 30% chance to activate each turn!",
  "You can earn badges by completing achievements!",
  "Visit Melon's shop to buy treats and equipment!",
  "Battle in different forest zones for varying rewards!",
  "Your day streak is displayed in the sidebar!",
  "Blocked users cannot view your profile!",
  "Notifications appear when friends interact with you!",
  "Check your activity feed to see what friends are up to!"
]

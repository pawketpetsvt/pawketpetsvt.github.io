import { EVENT_CALENDAR } from '../data/homeData.js'

// Ports getCalendarBonus() (game.js:32332). Returns the multiplier for today's
// calendar event, or 1.0 when today's theme doesn't match the stat asked for.
//
// This is NOT decorative — legacy reads it in exactly two places, and both are
// already-migrated systems whose ports had no way to ask for it until now:
//   • battle XP        (game.js:16217, `getCalendarBonus('battle_xp')`)
//   • minigame PP      (game.js:35188, `getCalendarBonus('minigame_pp')`)
//
// The other five days advertise bonuses nothing reads (fishing, guild, race,
// boss, pet). That is true on the live site too, so it is left alone here —
// making them real is a balance decision, not part of a port.
export function getCalendarBonus(statKey) {
  const ev = EVENT_CALENDAR[new Date().getDay()]
  if (!ev || ev.stat !== statKey) return 1.0
  return 2.0
}

// Today's event, for anything that wants to show what's active.
export function todaysEvent() {
  return EVENT_CALENDAR[new Date().getDay()] || null
}

import { RACING_FINISH_LINE, STREAMER_PHANTOMS } from '../data/racingData.js'

// Ports the Quick Race turn engine (racing_startRace / racing_executeAction /
// racing_cpuDecide, game.js:26116-26408).
//
// A pure module with no Supabase, DOM or toast access: everything it needs
// arrives as arguments and it only ever mutates the race object it was handed.
// That is what lets it be driven headlessly the way BattleService is.

export const MAX_TURNS = 8

// Ports racing_getPhantoms() — three or four streamers, chosen at random.
export function pickPhantoms() {
  const shuffled = STREAMER_PHANTOMS.slice().sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.random() < 0.5 ? 3 : 4)
}

export function buildRace({ petName, stats, charm, league, phantoms }) {
  const player = {
    id: 'player',
    name: petName || 'Your Pet',
    emoji: '🏃',
    isPlayer: true,
    pace: stats.pace,
    stamina: stats.stamina,
    maxStamina: stats.stamina,
    interference: stats.interference,
    resilience: stats.resilience,
    position: 0,
    jostlePenalty: 0,
    blocking: false,
    personality: 'player',
    charm: charm || null
  }

  const cpus = (phantoms || pickPhantoms()).map(p => ({
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    isPlayer: false,
    streamer: p.streamer,
    pace: p.pace[league] || 38,
    stamina: p.stamina[league] || 7,
    maxStamina: p.stamina[league] || 7,
    interference: p.interference[league] || 10,
    resilience: p.resilience[league] || 8,
    position: 0,
    jostlePenalty: 0,
    blocking: false,
    personality: p.personality
  }))

  return {
    turn: 0,
    maxTurns: MAX_TURNS,
    racers: [player, ...cpus],
    log: [],
    finished: false,
    awaitingPlayerAction: true,
    league
  }
}

// Phantom names read "Ember's Embertail"; the log uses just the first word.
const shortName = (name) => String(name).split("'")[0]

function rankOf(racer, allRacers) {
  const ranked = allRacers.slice().sort((a, b) => b.position - a.position)
  return { ranked, index: ranked.findIndex(x => x.id === racer.id) }
}

// Ports racing_executeAction(). Returns the log line; mutates the racer (and,
// for a jostle, its target).
export function executeAction(racer, allRacers, action) {
  const { ranked, index: myRank } = rankOf(racer, allRacers)

  // A jostle received last turn is paid for now, then cleared.
  let pace = Math.max(5, racer.pace - (racer.jostlePenalty || 0))
  racer.jostlePenalty = 0

  // Underdog charms pay out only when you're behind.
  if (racer.charm) {
    if (racer.charm.special === 'underdog_pace_15' && myRank >= 2) pace = Math.round(pace * 1.15)
    if (racer.charm.special === 'underdog_pace_20' && myRank >= 3) pace = Math.round(pace * 1.2)
  }

  const advance = (n) => {
    racer.position = Math.min(RACING_FINISH_LINE, racer.position + n)
    return n
  }

  if (action === 'sprint') {
    if (racer.stamina > 0) {
      const d = advance(Math.round(pace * (0.9 + Math.random() * 0.2)))
      racer.stamina = Math.max(0, racer.stamina - 1)
      return `💨 Sprints! (+${d})`
    }
    const d = advance(Math.round(pace * 0.5))
    return `😮‍💨 Exhausted, conserves. (+${d})`
  }

  if (action === 'jostle') {
    // The racer directly ahead — the last of everyone ranked above you.
    const ahead = ranked.slice(0, myRank).reverse()[0]
    if (!ahead) {
      // Already leading: nothing to jostle, so sprint instead.
      const d = advance(Math.round(pace * (0.9 + Math.random() * 0.2)))
      racer.stamina = Math.max(0, racer.stamina - 1)
      return `💨 Already leading — Sprints! (+${d})`
    }
    if (ahead.charm && ahead.charm.special === 'jostle_resist_5' && Math.random() < 0.05) {
      return `💥 Jostles ${shortName(ahead.name)}... resisted!`
    }
    let impact = Math.max(0, racer.interference - ahead.resilience + Math.floor(Math.random() * 4))
    if (ahead.blocking) impact = Math.round(impact * 0.3)
    ahead.jostlePenalty = (ahead.jostlePenalty || 0) + impact
    const d = advance(Math.round(pace * 0.6))
    return `💥 Jostles ${shortName(ahead.name)}! (-${impact} pace next turn) (+${d})`
  }

  if (action === 'block') {
    racer.blocking = true
    racer.stamina = Math.min(racer.maxStamina, racer.stamina + 2)
    const d = advance(Math.round(pace * 0.65))
    return `🛡️ Blocks! (+2 stamina, +${d})`
  }

  // conserve, and the default for anything unrecognised
  racer.stamina = Math.min(racer.maxStamina, racer.stamina + 2)
  const d = advance(Math.round(pace * 0.6))
  return `😮‍💨 Conserves. (+2 stamina, +${d})`
}

// Ports racing_cpuDecide(). Each streamer races the way they stream.
export function cpuDecide(racer, allRacers, turn) {
  const { index } = rankOf(racer, allRacers)
  const myRank = index + 1
  const total = allRacers.length

  switch (racer.personality) {
    case 'aggressive':   // Ember — harry the leader early
      if (myRank === 1) return 'sprint'
      return (turn < 6 && myRank <= total - 1) ? 'jostle' : 'sprint'

    case 'speedrunner':  // Gnarly — hang back, then burn it down
      if (turn <= 3) return 'conserve'
      if (turn <= 5) return myRank > 2 ? 'sprint' : 'conserve'
      return 'sprint'

    case 'unpredictable': { // Aria — genuinely random
      const opts = ['sprint', 'sprint', 'jostle', 'block', 'conserve']
      return opts[Math.floor(Math.random() * opts.length)]
    }

    case 'chaotic':      // Blushimia — jostle whoever is in front, always
      return myRank === 1 ? 'sprint' : 'jostle'

    case 'steady':       // Cowbee — clean racing, never jostles
      return racer.stamina > 1 ? 'sprint' : 'conserve'

    case 'sneaky':       // Kelta / Pyxie — block early, kick late
      if (turn === 0) return 'block'
      if (turn >= 5 && myRank > 2) return 'sprint'
      return myRank > 3 ? 'sprint' : 'conserve'

    case 'retaliate':    // Jess — alternates jostle and block
      return turn % 2 === 0 ? 'jostle' : 'block'

    default:
      return racer.stamina > 2 ? 'sprint' : 'conserve'
  }
}

// Ports racing_playerAction()'s turn loop. Resolves the player's action, then
// every CPU's, then advances the turn and reports whether the race is over.
export function takeTurn(race, playerAction) {
  if (!race || !race.awaitingPlayerAction) return race
  race.awaitingPlayerAction = false

  const player = race.racers[0]
  race.log.push('You: ' + executeAction(player, race.racers, playerAction))

  for (const cpu of race.racers.slice(1)) {
    const action = cpuDecide(cpu, race.racers, race.turn)
    race.log.push(shortName(cpu.name) + ': ' + executeAction(cpu, race.racers, action))
  }

  // Blocking lasts exactly one turn.
  for (const r of race.racers) r.blocking = false

  race.turn++

  if (race.turn >= race.maxTurns || race.racers.some(r => r.position >= RACING_FINISH_LINE)) {
    race.finished = true
    race.awaitingPlayerAction = false
  } else {
    race.awaitingPlayerAction = true
  }
  return race
}

// Final order, and where the player landed in it (1-based).
export function results(race) {
  const ranked = race.racers.slice().sort((a, b) => b.position - a.position)
  return { ranked, playerRank: ranked.findIndex(r => r.isPlayer) + 1 }
}

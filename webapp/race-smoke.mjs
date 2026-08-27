// Drives the Quick Race engine across every league, every player action and a
// wide range of pet stat lines, asserting the invariants that matter:
//   • a race always terminates within maxTurns
//   • positions stay within [0, FINISH_LINE] and never move backwards
//   • stamina stays within [0, maxStamina]
//   • no NaN reaches any racer field
//   • the results always name exactly one player and rank everyone
//
// RaceEngine has no Supabase/DOM/toast imports, so it runs under plain Node
// with no stubbing — unlike the battle suite, which needs smoke-hooks.mjs.
import { buildRace, takeTurn, results, MAX_TURNS } from './src/services/RaceEngine.js'
import { RACING_LEAGUE_TIERS, RACING_FINISH_LINE, RACING_SHOP } from './src/data/racingData.js'

const ACTIONS = ['sprint', 'jostle', 'block', 'conserve']
const CHARMS = [null, ...RACING_SHOP.charm]

let races = 0
let turns = 0
const problems = []

function check(cond, msg) {
  if (!cond) problems.push(msg)
}

function assertRacer(r, where) {
  for (const key of ['pace', 'stamina', 'maxStamina', 'interference', 'resilience', 'position']) {
    check(Number.isFinite(r[key]), `${where}: ${r.name}.${key} is not finite (${r[key]})`)
  }
  check(r.position >= 0 && r.position <= RACING_FINISH_LINE,
    `${where}: ${r.name} position out of range (${r.position})`)
  check(r.stamina >= 0 && r.stamina <= r.maxStamina,
    `${where}: ${r.name} stamina out of range (${r.stamina}/${r.maxStamina})`)
}

for (const league of RACING_LEAGUE_TIERS) {
  for (const charm of CHARMS) {
    // A spread of stat lines: a weak new pet through a fully-kitted one.
    for (const tierMul of [0.4, 1, 2.2]) {
      for (const action of ACTIONS) {
        const stats = {
          pace: Math.round(30 * tierMul),
          stamina: Math.max(3, Math.round(6 * tierMul)),
          interference: Math.round(8 * tierMul),
          resilience: Math.round(6 * tierMul)
        }
        const race = buildRace({ petName: 'Test Pet', stats, charm, league })
        check(race.racers.length >= 4 && race.racers.length <= 5,
          `field size out of range: ${race.racers.length}`)

        const before = race.racers.map(r => r.position)
        let guard = 0
        while (!race.finished && guard++ <= MAX_TURNS + 2) {
          // Alternate the fixed action with a random one so both the pinned
          // case and mixed play get exercised.
          const pick = guard % 2 === 0 ? action : ACTIONS[Math.floor(Math.random() * ACTIONS.length)]
          takeTurn(race, pick)
          turns++
          race.racers.forEach((r, i) => {
            assertRacer(r, `${league}/${action}`)
            check(r.position >= before[i], `${league}: ${r.name} moved backwards`)
            before[i] = r.position
          })
        }

        check(race.finished, `${league}/${action}: race did not finish within ${MAX_TURNS} turns`)
        check(race.turn <= MAX_TURNS, `${league}/${action}: overran maxTurns (${race.turn})`)

        const { ranked, playerRank } = results(race)
        check(ranked.length === race.racers.length, `${league}: ranking lost racers`)
        check(playerRank >= 1 && playerRank <= race.racers.length,
          `${league}: playerRank out of range (${playerRank})`)
        check(ranked.filter(r => r.isPlayer).length === 1, `${league}: player appears more than once`)
        check(race.log.length > 0, `${league}: empty race log`)

        races++
      }
    }
  }
}

console.log(`races: ${races}   turns: ${turns}   leagues: ${RACING_LEAGUE_TIERS.length}   charms: ${CHARMS.length}`)
if (problems.length) {
  console.error(`FAILED — ${problems.length} problem(s):`)
  for (const p of problems.slice(0, 20)) console.error('  ' + p)
  process.exit(1)
}
console.log('OK — no exceptions, no invariant violations')

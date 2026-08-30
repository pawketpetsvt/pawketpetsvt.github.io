// Every field the battle engine WRITES must also be RESET when a battle starts.
//
// `battleState` is a module-level reactive singleton, so anything left set from
// the previous fight carries into the next one. That is how `fled` broke: it was
// assigned by the flee branch but appeared in neither the state declaration nor
// startBattle's reset, so after one successful escape EVERY later battle ended
// on the player's first action — attack, skill or item — because the flee check
// runs immediately after the action resolves.
//
// The smoke suite cannot catch this: it drives the turn engine directly and
// never calls startBattle, which needs Supabase. This is a static check.
//
//   node battle-state-check.mjs
import fs from 'fs'

const src = fs.readFileSync('./src/services/BattleService.js', 'utf8')

// Fields that are deliberately NOT reset per battle, with the reason.
const EXEMPT = new Map([
  ['anim', 'a stable object of animation timestamps; mutated in place, never replaced'],
  ['phase', 'set by startBattle itself and by endBattle; not a per-turn field'],
  ['active', 'the battle lifecycle flag, set by startBattle/endBattle'],
  // Bound by attachBehaviorHelpers(), which startBattle calls. They are function
  // references rather than per-battle data — carrying over is correct, and
  // clearing them would break ENEMY_BEHAVIORS, which calls them as `s.$…`.
  ['$applyStatus', 'behaviour helper rebound by attachBehaviorHelpers()'],
  ['$applyStatusToPlayer', 'behaviour helper rebound by attachBehaviorHelpers()']
])

// The reset block: Object.assign(battleState, { ... }) inside startBattle.
const assignMatch = src.match(/Object\.assign\(battleState,\s*\{([\s\S]*?)\n {4}\}\)/)
if (!assignMatch) {
  console.error('FAILED — could not find the Object.assign(battleState, {...}) reset in startBattle')
  process.exit(1)
}
const resetKeys = new Set(
  [...assignMatch[1].matchAll(/^\s{6}([a-zA-Z_$][\w$]*)\s*:/gm)].map(m => m[1])
)

// Fields the declaration establishes, so a missing reset is at least defined.
const declMatch = src.match(/export const battleState = reactive\(\{([\s\S]*?)\n\}\)/)
const declaredKeys = new Set(
  declMatch ? [...declMatch[1].matchAll(/^\s{2}([a-zA-Z_$][\w$]*)\s*:/gm)].map(m => m[1]) : []
)

// Every field assigned anywhere in the service, minus the reset block itself.
const body = src.replace(assignMatch[0], '')
const written = new Set()
for (const m of body.matchAll(/\b(?:s|battleState)\.([a-zA-Z_$][\w$]*)\s*(?:=[^=]|\+=|-=|\|\|=|\?\?=)/g)) {
  written.add(m[1])
}

const missingReset = [...written].filter(k => !resetKeys.has(k) && !EXEMPT.has(k)).sort()
const missingDecl = [...written].filter(k => !declaredKeys.has(k) && !EXEMPT.has(k)).sort()

console.log(`fields written by the engine: ${written.size}`)
console.log(`fields reset by startBattle:  ${resetKeys.size}`)
console.log(`fields in the declaration:    ${declaredKeys.size}`)

let bad = false
if (missingReset.length) {
  bad = true
  console.error('\nWRITTEN BUT NEVER RESET — these leak into the next battle:')
  missingReset.forEach(k => console.error('  battleState.' + k))
}
if (missingDecl.length) {
  console.warn('\nWritten but not in the declaration (reactive from first write only):')
  missingDecl.forEach(k => console.warn('  battleState.' + k))
}

if (bad) {
  console.error('\nFAILED — add each field above to startBattle\'s reset, or to EXEMPT with a reason.')
  process.exit(1)
}
console.log('\nOK — every field the engine writes is reset when a battle starts')

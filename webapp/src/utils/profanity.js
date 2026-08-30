// Ports the username/bio profanity filter, game.js:2756-2838.
const PROFANITY_LIST = [
  'fuck', 'shit', 'bitch', 'ass', 'damn', 'hell', 'crap', 'piss', 'douche', 'twat', 'wanker', 'bollocks',
  'dick', 'cock', 'pussy', 'cunt', 'whore', 'slut', 'sex', 'porn', 'nude', 'xxx', 'anal', 'penis', 'vagina',
  'testicle', 'boner', 'cum', 'jizz', 'dildo', 'blowjob', 'handjob', 'creampie', 'orgasm', 'fetish', 'incest',
  'pedo', 'loli', 'rape', 'rapist',
  'nigger', 'nigga', 'chink', 'spic', 'kike', 'gook', 'wetback', 'coon', 'jap', 'paki', 'raghead',
  'sandnigger', 'towelhead', 'beaner', 'gypsy',
  'fag', 'faggot', 'dyke', 'tranny', 'shemale',
  'retard', 'retarded', 'spastic', 'cripple', 'mongoloid',
  'nazi', 'hitler', 'kkk', 'isis', 'heil',
  'bastard', 'skank', 'thot', 'whorebag',
  'kill', 'death', 'murder', 'suicide', 'lynch', 'genocide'
]

const PROFANITY_SUBSTITUTIONS = {
  a: 'a@4', e: 'e3', i: 'i1!|', o: 'o0', s: 's5$z', t: 't7',
  g: 'g69', l: 'l1', b: 'b8', u: 'uv', c: 'ck', z: 'z2'
}

// Tolerates letter substitutions (n1gga, a55) and stretched letters (fuuuck).
function buildPattern(word) {
  let pattern = ''
  for (const ch of word) {
    const subs = PROFANITY_SUBSTITUTIONS[ch]
    pattern += (subs ? '[' + subs + ']' : ch) + '+'
  }
  return pattern
}

export function containsProfanity(text) {
  if (!text) return false
  const lower = text.toLowerCase()

  for (const word of PROFANITY_LIST) {
    if (new RegExp('\\b' + word + '\\b', 'i').test(lower)) return true

    // Lookarounds rather than \b — these patterns can start/end on a symbol
    // (the $ in "a$$"), which \b fails to anchor correctly.
    if (new RegExp('(?<![a-zA-Z0-9])' + buildPattern(word) + '(?![a-zA-Z0-9])', 'i').test(lower)) return true

    // Separator-dodging (f.u.c.k) — requires at least one separator between
    // letters so "hello" doesn't trip on "hell", "scrapbook" not on "crap".
    const spaced = word.split('').join('[^a-z0-9]+')
    if (new RegExp('(?<![a-zA-Z0-9])' + spaced + '(?![a-zA-Z0-9])', 'i').test(lower)) return true
  }
  return false
}

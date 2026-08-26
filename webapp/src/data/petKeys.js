// Ports SKILL_KEY_MAP (game.js) — maps a pet's DB name, and its streamer alias,
// to one canonical key. Note it intentionally accepts both `kleat` and `kelta`,
// and both `cypurr` and `cypurractive`.
//
// It lives in its own module rather than inside battleData.js because it is not
// only a battle concern: the companion's dialogue pools key off it too, and
// importing it from battleData pulled ~1,100 lines of skill/enemy tables into
// the main bundle for the sake of this one object.
export const SKILL_KEY_MAP = { ember: 'ember', embertail: 'ember', pyxie: 'pyxie', pyxshuul: 'pyxie', kleat: 'kelta', kelta: 'kelta', steve: 'steve', cowbee: 'steve', aria: 'aria', blushimia: 'blushimia', jess: 'jess', gnarly: 'gnarly', cypurr: 'cypurr', cypurractive: 'cypurr' }

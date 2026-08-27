// Ports EXPEDITION_ZONES (game.js:2660-2669). Shared by both expedition
// panels — the Battle tab's and the Minigames tab's — which are two UIs over
// the same `expeditions` table.
//
// duration is in MINUTES; energyCost is charged on departure; itemChance rolls
// a single drop from itemPool, with the ruins zone splitting that roll between
// equipment and toys via equipmentChance.
export const EXPEDITION_ZONES = [
  { key:'outskirts',  label:'Outskirts',     emoji:'🏘️', duration:30, minPP:15,  maxPP:30,  rarity:'common',   desc:'Quick scout of the nearby fields.',  energyCost:15, xpReward:5,
    itemPool:[{id:'basic_food',name:'Basic Food',icon:'🍞',type:'food'}], itemChance:0.30, minItems:0, maxItems:1 },
  { key:'forest',     label:'Forest Glade',  emoji:'🌳', duration:45, minPP:30,  maxPP:60,  rarity:'uncommon', desc:'Wander through the shady forest.',    energyCost:25, xpReward:10,
    itemPool:[{id:'treat',name:'Treat',icon:'🍪',type:'treat'}], itemChance:0.40, minItems:0, maxItems:1 },
  { key:'deepwoods',  label:'Deep Woods',    emoji:'🌲', duration:60, minPP:50,  maxPP:100, rarity:'rare',     desc:'Brave the dangerous deep woods.',    energyCost:40, xpReward:20,
    itemPool:[{id:'squeaky_toy',name:'Squeaky Toy',icon:'🧸',type:'toy'},{id:'rubber_ball',name:'Rubber Ball',icon:'⚽',type:'toy'},{id:'rope_toy',name:'Rope Toy',icon:'🪢',type:'toy'}], itemChance:0.50, minItems:0, maxItems:1 },
  { key:'ruins',      label:'Ancient Ruins', emoji:'🏛️', duration:90, minPP:75,  maxPP:150, rarity:'epic',     desc:'Explore the mysterious old ruins.',   energyCost:60, xpReward:35,
    itemPool:[{id:'wooden_spoon',name:'Wooden Spoon',icon:'🥄',type:'equipment'},{id:'squeaky_toy',name:'Squeaky Toy',icon:'🧸',type:'toy'}], itemChance:0.60, equipmentChance:0.10, minItems:0, maxItems:1 }
]

// Ports EXPEDITION_SPEED_OPTS (game.js:5022). Trades expedition time against
// reward size.
//
// Legacy only offers these on the MINIGAMES expedition panel — and there they
// do NOTHING: `_expeditionSpeed` is assigned by expedition_setSpeed() and never
// read again, and EXPEDITION_SPEED_OPTS is never read at all. Picking a speed
// on the live site recolours three buttons and changes neither the duration nor
// the payout. Same shape as Phase 4's Rare Shoal bonus and the room bonuses.
//
// Made real here, since a control that does nothing is worse than no control.
// `timeMult` and `ppMult` both apply — they land in `ends_at` and `reward_pp`,
// which the row already stores.
//
// `xpMult` is NOT applied: XP is paid at claim time from the zone's own
// xpReward, and `expeditions` has no column to carry a per-row XP figure
// (neither legacy insert writes one). Adding one is a one-line ALTER if the
// speed choice should affect XP too.
//
// The Vue app has ONE panel used on both the Battle and Minigames tabs, so the
// option is available wherever expeditions are and the two cannot diverge.
export const EXPEDITION_SPEEDS = {
  quick: { key: 'quick', label: '⚡ Quick', timeMult: 0.5, ppMult: 0.7, xpMult: 0.7, desc: 'Half the time, fewer rewards' },
  normal: { key: 'normal', label: '🗺️ Normal', timeMult: 1.0, ppMult: 1.0, xpMult: 1.0, desc: 'Standard expedition' },
  thorough: { key: 'thorough', label: '🔍 Thorough', timeMult: 2.0, ppMult: 1.5, xpMult: 1.6, desc: 'Twice as long, better rewards' }
}

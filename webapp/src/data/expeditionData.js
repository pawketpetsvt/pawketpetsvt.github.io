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

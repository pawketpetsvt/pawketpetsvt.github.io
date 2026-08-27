// Racing data, ported from game.js's RACING_* tables (game.js:25588+).
// Extracted programmatically — the shop alone is four slots x four league tiers
// of hand-tuned stat lines, where a transcription slip would be invisible.
//
// Promotion needs 3+ races AND 12+ points in a week; relegation happens on
// fewer than 2 races OR fewer than 4 points.

export const RACING_DAILY_SESSIONS = 3

export const RACING_DAILY_RACES = 5

export const RACING_FITNESS_DECAY = 2

export const RACING_FINISH_LINE = 100

export const RACING_TRAINING_TYPES = {
  sprint:    { label:'💨 Sprint Drills',   stat:'pace_rating',          gain:3, energyCost:10, desc:'Builds raw speed. +3 Pace rating.' },
  obstacles: { label:'🚧 Obstacle Course', stat:'stamina_rating',       gain:3, energyCost:10, desc:'Builds endurance. +3 Stamina rating.' },
  sparring:  { label:'⚔️ Sparring',        stat:'interference_rating',  gain:3, energyCost:10, desc:'Builds jostle power & resilience. +3 Interference.' },
  rest:      { label:'😴 Rest & Recovery', stat:'fitness',              gain:8, energyCost:0,  desc:'Restore Fitness without wearing your pet out. +8 Fitness.' }
}

export const RACING_LEAGUE_TIERS = ['bronze','silver','gold','diamond','champion']

export const RACING_LEAGUE_LABELS = { bronze:'🥉 Bronze', silver:'🥈 Silver', gold:'🥇 Gold', diamond:'💎 Diamond', champion:'🌟 Champion' }

export const RACING_LEAGUE_COLORS = { bronze:'#cd7f32', silver:'#aaa', gold:'#e6a800', diamond:'#6cf', champion:'#ff99ff' }

export const RACING_LEAGUE_REWARDS = {
  bronze:   [100, 70, 50, 35, 20, 10],
  silver:   [200, 140, 100, 70, 40, 20],
  gold:     [350, 250, 175, 120, 70, 35],
  diamond:  [500, 350, 250, 175, 100, 50],
  champion: [750, 550, 400, 275, 150, 75]
}

export const RACING_PLACEMENT_PTS = [5, 4, 3, 2, 1, 0]

export const RACING_SHOP = {
  shoes: [
    { key:'paw_wraps',      name:'Paw Wraps',        emoji:'🧣', league:'bronze',   price:200,  pace:3,  stamina:0,  interference:0,  resilience:0,  desc:'Starter racing wraps. +3 Pace.' },
    { key:'sprint_cleats',  name:'Sprint Cleats',     emoji:'👟', league:'silver',   price:500,  pace:6,  stamina:0,  interference:0,  resilience:0,  desc:'Lightweight cleats. +6 Pace.' },
    { key:'cloud_slippers', name:'Cloud Slippers',    emoji:'☁️', league:'gold',    price:1200, pace:10, stamina:2,  interference:0,  resilience:0,  desc:'Ethereally light. +10 Pace, +2 Stamina.' },
    { key:'wind_boots',     name:'Wind Boots',        emoji:'🌬️', league:'diamond', price:2500, pace:14, stamina:3,  interference:0,  resilience:0,  desc:'Legendary speed. +14 Pace, +3 Stamina.' }
  ],
  outfit: [
    { key:'padded_vest',       name:'Padded Vest',        emoji:'🧥', league:'bronze',   price:200,  pace:0, stamina:0,  interference:0, resilience:3,  desc:'Basic protection. +3 Resilience.' },
    { key:'aerowing_suit',     name:'Aerowing Suit',      emoji:'🪶', league:'silver',   price:500,  pace:0, stamina:5,  interference:0, resilience:3,  desc:'Streamlined. +5 Stamina, +3 Resilience.' },
    { key:'streamlined_coat',  name:'Streamlined Coat',   emoji:'💙', league:'gold',     price:1200, pace:0, stamina:8,  interference:0, resilience:5,  desc:'Advanced aerodynamics. +8 Stamina, +5 Resilience.' },
    { key:'champion_regalia',  name:'Champion\'s Regalia',emoji:'👑', league:'diamond',  price:2500, pace:0, stamina:12, interference:0, resilience:8,  desc:'Worn only by the best. +12 Stamina, +8 Resilience.' }
  ],
  goggles: [
    { key:'basic_visor',          name:'Basic Visor',        emoji:'🥽', league:'bronze',  price:200,  pace:0, stamina:0, interference:3,  resilience:0, desc:'Improves your aim. +3 Interference.' },
    { key:'focus_lens',           name:'Focus Lens',         emoji:'🔭', league:'silver',  price:500,  pace:0, stamina:0, interference:6,  resilience:0, desc:'Precision targeting. +6 Interference.' },
    { key:'intimidation_goggles', name:'Intimidation Goggles',emoji:'😤',league:'gold',   price:1200, pace:3, stamina:0, interference:9,  resilience:0, desc:'Unsettles rivals. +9 Interference, +3 Pace.' },
    { key:'apex_targeting',       name:'Apex Targeting',     emoji:'🎯', league:'diamond', price:2500, pace:5, stamina:0, interference:14, resilience:0, desc:'Elite precision. +14 Interference, +5 Pace.' }
  ],
  charm: [
    { key:'lucky_ribbon',     name:'Lucky Ribbon',      emoji:'🎀', league:'bronze',  price:300,  special:'jostle_resist_5',  desc:'5% chance to resist any Jostle.' },
    { key:'rivals_token',     name:'Rival\'s Token',    emoji:'🪙', league:'silver',  price:600,  special:'underdog_pace_15', desc:'+15% Pace when in 3rd place or lower.' },
    { key:'underdog_badge',   name:'Underdog Badge',    emoji:'🏅', league:'gold',    price:1400, special:'underdog_pace_20', desc:'+20% Pace when in 4th place or lower.' },
    { key:'champions_spirit', name:'Champion\'s Spirit',emoji:'✨', league:'diamond', price:3000, special:'all_stats_10',     desc:'+10% to all stats.' }
  ],
  mount: [
    { key:'basic_saddle',    name:'Basic Saddle',     emoji:'🐴', league:'bronze',  price:250,  pace:2,  stamina:2,  interference:0, resilience:0, desc:'Improves control. +2 Pace, +2 Stamina.' },
    { key:'racing_saddle',   name:'Racing Saddle',    emoji:'🎠', league:'silver',  price:600,  pace:4,  stamina:4,  interference:0, resilience:0, desc:'Purpose-built. +4 Pace, +4 Stamina.' },
    { key:'suspension_pads', name:'Suspension Pads',  emoji:'⚙️', league:'gold',   price:1400, pace:7,  stamina:7,  interference:0, resilience:0, desc:'Absorbs rough terrain. +7 Pace, +7 Stamina.' },
    { key:'legendary_mount', name:'Legendary Mount',  emoji:'🦄', league:'diamond', price:3000, pace:10, stamina:10, interference:5, resilience:0, desc:'The peak of racing gear. +10/+10/+5.' }
  ]
}

// Ports STREAMER_PHANTOMS — the CPU field for Quick Races. Each phantom has a
// per-league stat line and a personality that drives its turn choices (see
// cpuDecide in RaceEngine.js).
export const STREAMER_PHANTOMS = [
  { id:'ph_ember',    name:"Ember's Embertail",   emoji:'🔥', streamer:'embertail',
    personality:'aggressive',
    pace:   { bronze:38, silver:47, gold:58, diamond:70, champion:82 },
    interference: { bronze:12, silver:17, gold:24, diamond:31, champion:38 },
    resilience:   { bronze:6,  silver:9,  gold:13, diamond:18, champion:23 },
    stamina:      { bronze:7,  silver:9,  gold:12, diamond:15, champion:18 }
  },
  { id:'ph_pyxie',   name:"Pyxie's Sparkledog",  emoji:'✨', streamer:'pyxshuul',
    personality:'sneaky',
    pace:   { bronze:35, silver:44, gold:55, diamond:67, champion:79 },
    interference: { bronze:8,  silver:12, gold:17, diamond:23, champion:29 },
    resilience:   { bronze:10, silver:13, gold:18, diamond:24, champion:30 },
    stamina:      { bronze:8,  silver:10, gold:13, diamond:17, champion:21 }
  },
  { id:'ph_aria',    name:"Aria's Moth",          emoji:'🦋', streamer:'ariadoestwitch',
    personality:'unpredictable',
    pace:   { bronze:36, silver:45, gold:56, diamond:68, champion:80 },
    interference: { bronze:9,  silver:13, gold:18, diamond:24, champion:30 },
    resilience:   { bronze:8,  silver:11, gold:15, diamond:20, champion:25 },
    stamina:      { bronze:8,  silver:10, gold:13, diamond:16, champion:20 }
  },
  { id:'ph_blushimia',name:"Blushimia's Pup",    emoji:'🐶', streamer:'realblushimia',
    personality:'chaotic',
    pace:   { bronze:34, silver:43, gold:54, diamond:66, champion:78 },
    interference: { bronze:14, silver:19, gold:26, diamond:33, champion:40 },
    resilience:   { bronze:5,  silver:7,  gold:10, diamond:14, champion:18 },
    stamina:      { bronze:6,  silver:8,  gold:11, diamond:14, champion:17 }
  },
  { id:'ph_cowbee',  name:"Cowbee's Cowbee",     emoji:'🐄', streamer:'cowbeevt',
    personality:'steady',
    pace:   { bronze:40, silver:49, gold:60, diamond:72, champion:84 },
    interference: { bronze:4,  silver:6,  gold:9,  diamond:12, champion:15 },
    resilience:   { bronze:7,  silver:10, gold:14, diamond:19, champion:24 },
    stamina:      { bronze:10, silver:13, gold:17, diamond:22, champion:27 }
  },
  { id:'ph_kelta',   name:"Kelta's Pomeranian",  emoji:'🍊', streamer:'keltathepomeranian',
    personality:'sneaky',
    pace:   { bronze:36, silver:45, gold:56, diamond:68, champion:80 },
    interference: { bronze:7,  silver:10, gold:14, diamond:19, champion:24 },
    resilience:   { bronze:12, silver:16, gold:22, diamond:29, champion:36 },
    stamina:      { bronze:9,  silver:12, gold:16, diamond:21, champion:26 }
  },
  { id:'ph_jess',    name:"Jess's Dino",          emoji:'🦕', streamer:'teatimejess',
    personality:'retaliate',
    pace:   { bronze:37, silver:46, gold:57, diamond:69, champion:81 },
    interference: { bronze:11, silver:15, gold:21, diamond:28, champion:35 },
    resilience:   { bronze:11, silver:15, gold:21, diamond:28, champion:35 },
    stamina:      { bronze:8,  silver:10, gold:14, diamond:18, champion:22 }
  },
  { id:'ph_gnarly',  name:"Gnarly's Smilodon",   emoji:'🕹️', streamer:'gnarly_neon_smilodon',
    personality:'speedrunner',
    pace:   { bronze:42, silver:52, gold:63, diamond:75, champion:87 },
    interference: { bronze:6,  silver:9,  gold:13, diamond:17, champion:21 },
    resilience:   { bronze:6,  silver:9,  gold:13, diamond:17, champion:21 },
    stamina:      { bronze:6,  silver:8,  gold:11, diamond:14, champion:17 }
  },
  { id:'ph_cypurr',  name:"Cypurr's Catgirl",     emoji:'💜', streamer:'cypurractive',
    personality:'steady',
    pace:   { bronze:35, silver:44, gold:55, diamond:67, champion:79 },
    interference: { bronze:5,  silver:7,  gold:10, diamond:14, champion:18 },
    resilience:   { bronze:14, silver:19, gold:26, diamond:34, champion:42 },
    stamina:      { bronze:10, silver:13, gold:17, diamond:22, champion:27 }
  }
]

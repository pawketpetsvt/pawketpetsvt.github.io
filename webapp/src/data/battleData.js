// Static battle content, ported from game.js. Data only — no behaviour;
// the combat rules that read these live in services/BattleService.js.

// Ports ZONE_CONFIG (game.js:1008-1047). Each zone has an energy cost, a
// hard level band that enemy rolls are clamped to, and a battle modifier that
// applies for the whole fight. `isSecret` zones only appear once unlocked.
export const ZONE_CONFIG = {
  outskirts: {
    label: 'City Outskirts',
    energyCost: 5,
    minLevel: 1, maxLevel: 8,
    battleMod: { type: 'none' }
  },
  glade: {
    label: 'Forest Glade',
    energyCost: 7,
    minLevel: 4, maxLevel: 14,
    battleMod: { type: 'regen', amount: 3, label: '🌿 Forest Regen', desc: 'Enemies regenerate 3 HP per turn' }
  },
  deepwoods: {
    label: 'Deep Woods',
    energyCost: 10,
    minLevel: 8, maxLevel: 20,
    battleMod: { type: 'fog', evasion: 0.15, fogTurns: 2, label: '🌫️ Fog of War', desc: 'Enemy has 15% evasion for first 2 turns' }
  },
  ruins: {
    label: 'Outside The Ruins',
    energyCost: 14,
    minLevel: 12, maxLevel: 28,
    battleMod: { type: 'corruption', damage: 2, label: '☠️ Corrupted Ground', desc: 'You take 2 corruption damage each turn' }
  },
  hollow_warrens: {
    label: 'The Hollow Warrens',
    energyCost: 9,
    minLevel: 7, maxLevel: 18,
    battleMod: { type: 'fog', evasion: 0.10, fogTurns: 1, label: '🐇 Tunnel Confusion', desc: 'Enemy has 10% evasion in the dark warrens' },
    isSecret: true
  },
  ashen_ruins: {
    label: 'The Ashen Ruins',
    energyCost: 12,
    minLevel: 11, maxLevel: 25,
    battleMod: { type: 'burn_ground', damage: 1, label: '🔥 Ashen Ground', desc: 'The burning ground deals 1 damage per turn to both fighters' },
    isSecret: true
  }
}

// Ports STATUS_EFFECTS (game.js:6530-6538) — the ailments manual-combat
// skills can inflict.
export const STATUS_EFFECTS = {
  burn:      { icon: '🔥', label: 'Burn',      type: 'dot',    damage: 3,  duration: 3, desc: 'Takes 3 damage per turn' },
  confuse:   { icon: '😵', label: 'Confuse',   type: 'debuff', missChance: 0.30, duration: 2, desc: '30% chance to miss attacks' },
  fear:      { icon: '😨', label: 'Fear',      type: 'skip',   duration: 1, desc: 'Cannot attack next turn' },
  stun:      { icon: '⚡', label: 'Stun',      type: 'skip',   duration: 1, desc: 'Loses next turn' },
  glitch:    { icon: '🌀', label: 'Glitch',    type: 'debuff', failChance: 0.20, duration: 2, desc: '20% chance skills fail' },
  petrify:   { icon: '🪨', label: 'Petrify',   type: 'debuff', defDown: 0.10, duration: 2, desc: 'Defense reduced 10%' },
  infatuate: { icon: '💕', label: 'Infatuate', type: 'debuff', dmgDown: 0.30, duration: 2, desc: 'Deals 30% less damage' }
}

// Ports PASSIVE_EFFECTS (game.js:6475-6522) — equipment procs.
// `attack` procs fire on the player's turn, `defend` on the enemy's.
export const PASSIVE_EFFECTS = {
  // ---- Shared pool ----
  spark_hit:       { type: 'attack', label: 'Spark Hit',       icon: '✨', bonusDamage: 2 },
  lifesteal_small: { type: 'attack', label: 'Lifesteal',       icon: '🩸', healPct: 0.20 },
  double_strike:   { type: 'attack', label: 'Double Strike',   icon: '⚔️', extraHitPct: 0.60 },
  armor_shatter:   { type: 'attack', label: 'Armor Shatter',   icon: '💥', defenseShred: 3 },

  sturdy_tiny:     { type: 'defend', label: 'Sturdy',          icon: '🛡️', flatReduction: 1 },
  thorns_small:    { type: 'defend', label: 'Thorns',          icon: '🌵', reflectPct: 0.15 },
  second_wind:     { type: 'defend', label: 'Second Wind',     icon: '💚', healMaxPct: 0.08 },
  iron_will:       { type: 'defend', label: 'Iron Will',       icon: '🧱', fullBlock: true },

  // ---- Unique legendary effects ----
  fated_strike:        { type: 'attack', label: "Fated Strike",         icon: '🥄', forceCrit: true },
  haunting_melody:      { type: 'attack', label: "Haunting Melody",      icon: '🎵', stunEnemy: true },
  chiming_dread:        { type: 'attack', label: "Chiming Dread",        icon: '🔔', healPct: 0.25, defenseShred: 2 },
  pipers_final_verse:   { type: 'attack', label: "Piper's Final Verse",  icon: '🎼', doubleDamage: true, attackShred: 2 },
  cataloged_weakness:   { type: 'attack', label: "Cataloged Weakness",   icon: '📖', forceCrit: true, ignoreDefense: true },
  culinary_chaos:       { type: 'attack', label: "Culinary Chaos",       icon: '🥣', extraHitPct: 1.0 },

  royal_spores:         { type: 'defend', label: "Royal Spores",        icon: '🍄', healMaxPct: 0.15 },
  warding_chimes:        { type: 'defend', label: "Warding Chimes",      icon: '🔔', fullBlock: true },
  trash_royalty:         { type: 'defend', label: "Trash Royalty",       icon: '👑', reflectPct: 0.30 },
  forbidden_knowledge:   { type: 'defend', label: "Forbidden Knowledge", icon: '📜', flatReduction: 4 },

  // ---- Epic-tier unique effects (referenced in DB but previously unimplemented) ----
  radiant_purge:    { type: 'attack', label: 'Radiant Purge',   icon: '☀️', forceCrit: true, bonusDamage: 5 },
  shadow_drain:     { type: 'attack', label: 'Shadow Drain',    icon: '🌑', healPct: 0.30, defenseShred: 1 },
  sunlight_aegis:   { type: 'defend', label: 'Sunlight Aegis',  icon: '✨', healMaxPct: 0.12 },
  void_embrace:     { type: 'defend', label: 'Void Embrace',    icon: '🌌', reflectPct: 0.40, selfDamage: 2 },

  // ---- Enemy-side passives ----
  corrupted_fury: { type: 'enemyAttack', label: 'Corrupted Fury', icon: '🔥', bonusDamagePct: 0.4 },

  // ---- World-state-gated signature items (Light / Darkness) ----
  // Light: reliable protection/healing, deliberately modest so it stays
  // supportive rather than overpowered. No drawback.
  // Darkness: notably stronger passive effect than Light's equivalent,
  // but the item itself carries a permanent max-HP penalty while equipped
  // (see hp_penalty_pct in calculatePetStats) — a genuine risk/reward
  // trade rather than a strictly-better upgrade. Deliberately NOT a
  // per-turn HP cost here, since that would fight against these same
  // passives' own lifesteal/reflect effects.
  radiant_purge:  { type: 'attack', label: 'Radiant Purge',  icon: '✨', bonusDamage: 3, healPct: 0.12 },
  sunlight_aegis: { type: 'defend', label: 'Sunlight Aegis', icon: '☀️', fullBlock: true, healMaxPct: 0.08 },
  shadow_drain:   { type: 'attack', label: 'Shadow Drain',   icon: '🌑', healPct: 0.40 },
  void_embrace:   { type: 'defend', label: 'Void Embrace',   icon: '🕳️', reflectPct: 0.30 }
}

// Ports PET_SKILLS (game.js:6544-7225) — the EXPANDED three-tier set:
// roughly 11 skills per pet across Lv1-4 (basic) / Lv5-7 (utility) / Lv8+
// (ultimate), covering all nine pets.
//
// Until 2026-08-24 this table was shadowed at runtime by an older 127-line
// copy declared later in game.js, which covered only eight pets — it had no
// `cypurr` key and spelled Kelta's `kleat` — so on the live site those two
// pets had no skills at all. The duplicate is gone; this is the real data.
export const PET_SKILLS = {

  // ── EMBER (Protogen, fire/tech) ─────────────────────────────────────────
  ember: [
    // Tier 1: Basic attacks (Lv1-4)
    { id:'ember_flame_buffer',    name:'Flame Buffer',      icon:'⚡', unlockLevel:1,  cooldown:1,
      damageMult:1.2, status:{ type:'burn', chance:0.20 },
      desc:'1.2x damage. 20% chance to Burn (3 dmg/turn, 3 turns).',
      flavor:"I've been burning for eleven years. You get used to it. 🔥" },
    { id:'ember_spark_jab',       name:'Spark Jab',         icon:'💥', unlockLevel:2,  cooldown:0,
      damageMult:0.9,
      desc:'Quick 0.9x attack. No cooldown — great for pressure.',
      flavor:"Speed is the real power. Fire just looks cooler. ⚡" },
    { id:'ember_tail_swipe',      name:'Tail Swipe',        icon:'🦊', unlockLevel:3,  cooldown:1,
      damageMult:1.1, debuff:{ stat:'defense', amount:0.10 },
      desc:'1.1x damage. Lowers enemy DEF by 10%.',
      flavor:"The tail is not decorative. Lesson learned." },
    { id:'ember_charge_burst',    name:'Charge Burst',      icon:'🔋', unlockLevel:4,  cooldown:2,
      damageMult:1.4,
      desc:'1.4x damage. Charges power for a clean heavy hit.',
      flavor:"Eleven years of charging. Still fun. 🔥" },

    // Tier 2: Utilities (Lv5-7)
    { id:'ember_system_reboot',   name:'System Reboot',     icon:'💻', unlockLevel:5,  cooldown:3,
      damageMult:0, healPct:0.15, cleanse:true,
      desc:'Heal 15% max HP. Clears all negative status effects.',
      flavor:"Have you tried turning it off and on again? Works for me. 🔄" },
    { id:'ember_overclock',       name:'Overclock',         icon:'⚙️',  unlockLevel:6,  cooldown:3,
      damageMult:0, atkBuff:{ amount:0.25, turns:2 },
      desc:'No damage. +25% attack for 2 turns.',
      flavor:"Push the limits. Then push past the limits." },
    { id:'ember_static_field',    name:'Static Field',      icon:'🌩️', unlockLevel:7,  cooldown:2,
      damageMult:0.7, status:{ type:'confuse', chance:0.35 },
      desc:'0.7x damage. 35% chance to Confuse (enemy may miss).',
      flavor:"Confusion is just chaos with better marketing." },

    // Tier 3: Advanced damage (Lv8-10)
    { id:'ember_heat_wave',       name:'Heat Wave',         icon:'🌊', unlockLevel:8,  cooldown:3,
      damageMult:1.5, status:{ type:'burn', chance:0.40 },
      desc:'1.5x damage. 40% Burn chance.',
      flavor:"The wave is fire. Just go with it." },
    { id:'ember_meltdown',        name:'Meltdown',          icon:'🌡️', unlockLevel:9,  cooldown:3,
      damageMult:1.3, debuff:{ stat:'defense', amount:0.20 }, status:{ type:'burn', chance:0.30 },
      desc:'1.3x damage. Enemy DEF -20%. 30% Burn chance.',
      flavor:"Everything melts eventually. Physics." },
    { id:'ember_flametail_strike',name:'Flametail Strike',  icon:'🔥', unlockLevel:10, cooldown:4,
      damageMult:1.8, status:{ type:'burn', chance:0.60 }, selfCostPct:0.15,
      desc:'1.8x damage. 60% Burn. Costs 15% of YOUR current HP.',
      flavor:"Fire solves everything. Including me. 🔥💔" },

    // Tier 4: Healing/defensive (Lv11-14)
    { id:'ember_heat_shield',     name:'Heat Shield',       icon:'🛡️', unlockLevel:11, cooldown:3,
      damageMult:0, evasionBuff:0.50, healPct:0.08,
      desc:'No damage. 50% evasion on next hit. Heal 8% max HP.',
      flavor:"Defense is offense you didn't need yet." },
    { id:'ember_core_dump',       name:'Core Dump',         icon:'🖥️', unlockLevel:12, cooldown:4,
      damageMult:1.6, cleanse:true, atkBuff:{ amount:0.15, turns:2 },
      desc:'1.6x damage. Clears your status effects. +15% ATK for 2 turns.',
      flavor:"Dump the errors, keep the power." },
    { id:'ember_fuel_inject',     name:'Fuel Injection',    icon:'⛽', unlockLevel:13, cooldown:3,
      damageMult:0, healPct:0.20, atkBuff:{ amount:0.20, turns:3 },
      desc:'Heal 20% max HP. +20% ATK for 3 turns.',
      flavor:"Refueling mid-fight is a power move." },
    { id:'ember_afterburn',       name:'Afterburner',       icon:'🚀', unlockLevel:14, cooldown:4,
      damageMult:0, atkScaling:{ perAttack:0.12, max:0.60 },
      desc:'No upfront damage. +12% ATK per previous attack this battle (max +60%).',
      flavor:"Everything gets faster before it gets better." },

    // Tier 5: Powerful/unique (Lv15-18)
    { id:'ember_inferno',         name:'Inferno',           icon:'☄️',  unlockLevel:15, cooldown:5,
      damageMult:2.0, status:{ type:'burn', chance:0.80 },
      desc:'2.0x damage. 80% Burn chance. Pure destruction.',
      flavor:"Sometimes the answer is just more fire. 🔥" },
    { id:'ember_cascade_fail',    name:'Cascade Failure',   icon:'💀', unlockLevel:18, cooldown:5,
      damageMult:1.4, status:{ type:'burn', chance:1.0 }, condBonus:{ ifStatus:'burn', mult:1.8 },
      desc:'1.4x damage. 100% Burn. If enemy is already Burning: 1.8x instead.',
      flavor:"The system error you wanted." },
    { id:'ember_nova',            name:'NOVA',              icon:'🌟', unlockLevel:22, cooldown:6,
      damageMult:2.5, status:{ type:'burn', chance:1.0 }, selfCostPct:0.25,
      desc:'2.5x damage. Guaranteed Burn. Costs 25% current HP. The big one.',
      flavor:"I've been saving this. 🔥🔥🔥" },
    { id:'ember_phoenix_rebirth', name:'Phoenix Rebirth',   icon:'🐦', unlockLevel:28, cooldown:99,
      damageMult:0, revive:{ hpPct:0.40 }, passive:false,
      desc:'If you would die, instead revive at 40% HP. One use per battle.',
      flavor:"Eleven years. I don't stay down. 🔥" }
  ],

  // ── PYXIE (Sparkledog, chaos/shadow) ──────────────────────────────────
  pyxie: [
    { id:'pyxie_glitter_bomb',    name:'Glitter Bomb',      icon:'✨', unlockLevel:1,  cooldown:1,
      damageMult:1.1, status:{ type:'confuse', chance:0.30 },
      desc:'1.1x damage. 30% Confuse (enemy may miss).',
      flavor:"I have a plan. It involves sparkles. ✨" },
    { id:'pyxie_paw_swipe',       name:'Paw Swipe',         icon:'🐾', unlockLevel:2,  cooldown:0,
      damageMult:0.85,
      desc:'Quick 0.85x strike. No cooldown.',
      flavor:"Don't underestimate the paw." },
    { id:'pyxie_shadow_step',     name:'Shadow Step',       icon:'👻', unlockLevel:3,  cooldown:2,
      damageMult:0, evasionBuff:0.60,
      desc:'No damage. 60% evasion chance vs next attack.',
      flavor:"I may seem quiet. I am not here." },
    { id:'pyxie_chaos_spark',     name:'Chaos Spark',       icon:'🌀', unlockLevel:4,  cooldown:1,
      damageMult:1.2, randomBuff:{ chance:0.40, options:['attack','defense'], amount:0.15 },
      desc:'1.2x damage. 40% chance of random ATK or DEF buff.',
      flavor:"The chaos is organized. I promise." },
    { id:'pyxie_echo_of_fear',    name:'Echo of Fear',      icon:'😨', unlockLevel:5,  cooldown:3,
      damageMult:1.3, debuff:{ stat:'defense', amount:0.10 },
      desc:'1.3x damage. Enemy DEF -10% for 2 turns.',
      flavor:"I know things I shouldn't. My mom was a demon. 👻" },
    { id:'pyxie_static_nap',      name:'Tactical Nap',      icon:'😴', unlockLevel:6,  cooldown:3,
      damageMult:0, healPct:0.22, cleanse:true,
      desc:'Heal 22% max HP. Clears negative status. (It is tactical.)',
      flavor:"Tactical napping is a legitimate strategy." },
    { id:'pyxie_fog_walk',        name:'Fog Walk',          icon:'🌫️', unlockLevel:7,  cooldown:2,
      damageMult:0.9, evasionBuff:0.40, status:{ type:'confuse', chance:0.25 },
      desc:'0.9x damage. 40% evasion next hit. 25% Confuse.',
      flavor:"I found something interesting. I'm keeping it." },
    { id:'pyxie_void_pull',       name:'Void Pull',         icon:'⚫', unlockLevel:8,  cooldown:3,
      damageMult:1.4, status:{ type:'glitch', chance:0.40 },
      desc:'1.4x damage. 40% Glitch (enemy 20% fail chance for 2 turns).',
      flavor:"Something funny happened. I won't explain it." },
    { id:'pyxie_deep_dive',       name:'Deep Dive',         icon:'🌊', unlockLevel:9,  cooldown:3,
      damageMult:1.5, lifeStealChance:{ chance:0.40, pct:0.20 },
      desc:'1.5x damage. 40% chance to steal 20% of damage as HP.',
      flavor:"Plans within plans within plans. Also snacks." },
    { id:"pyxie_mamas_grace",     name:"Mama's Grace",      icon:'🌙', unlockLevel:10, cooldown:4,
      damageMult:1.7, status:{ type:'skip', chance:0.50 }, condBonus:{ ifStatus:'confuse', mult:2.0 },
      desc:'1.7x damage. 50% Fear (enemy skips). Doubles damage if enemy is Confused.',
      flavor:"Mama said I was special. I don't think she meant this. 🌙" },
    { id:'pyxie_dream_eater',     name:'Dream Eater',       icon:'💤', unlockLevel:11, cooldown:4,
      damageMult:1.2, status:{ type:'confuse', chance:0.60 }, lifeSteal:0.25,
      desc:'1.2x damage. 60% Confuse. Steal 25% of damage as HP.',
      flavor:"I didn't take your dreams. I borrowed them." },
    { id:'pyxie_schemer',         name:'The Scheme',        icon:'🎭', unlockLevel:12, cooldown:4,
      damageMult:0, atkBuff:{ amount:0.30, turns:3 }, evasionBuff:0.35,
      desc:'No damage. +30% ATK for 3 turns. 35% evasion next hit.',
      flavor:"The scheme is going well. Thank you for not asking." },
    { id:'pyxie_chaos_cascade',   name:'Chaos Cascade',     icon:'💫', unlockLevel:13, cooldown:5,
      damageMult:1.6, status:{ type:'confuse', chance:0.50 }, condBonus:{ ifStatus:'glitch', mult:1.6 },
      desc:'1.6x damage. 50% Confuse. 1.6x bonus if enemy is Glitched.',
      flavor:"The fog had good vibes today." },
    { id:'pyxie_shadow_clone',    name:'Shadow Clone',      icon:'👤', unlockLevel:14, cooldown:5,
      damageMult:1.3, atkScaling:{ perAttack:0.08, max:0.48 },
      desc:'1.3x base damage. +8% per previous attack (max +48%).',
      flavor:"I'm not lost. This is exactly where I meant to be." },
    { id:'pyxie_nightmare',       name:'Nightmare',         icon:'🌑', unlockLevel:15, cooldown:5,
      damageMult:1.9, status:{ type:'skip', chance:0.45 }, status2:{ type:'confuse', chance:0.60 },
      desc:'1.9x damage. 45% Fear AND 60% Confuse.',
      flavor:"I contain multitudes. And I share them." },
    { id:'pyxie_void_strike',     name:'Void Strike',       icon:'🕳️', unlockLevel:18, cooldown:5,
      damageMult:2.1, status:{ type:'glitch', chance:1.0 },
      desc:'2.1x damage. Guaranteed Glitch.',
      flavor:"Quietly thriving. Do not disturb. ✨" },
    { id:'pyxie_demon_ascent',    name:'Demon Ascent',      icon:'😈', unlockLevel:22, cooldown:6,
      damageMult:2.4, status:{ type:'skip', chance:0.70 }, condBonus:{ ifStatus:'confuse', mult:2.5 },
      desc:'2.4x damage. 70% Fear. If Confused: 2.5x total.',
      flavor:"Something is watching. It is me. 🌀" },
    { id:"pyxie_chaotic_aura",    name:"Chaotic Aura",      icon:'🌪️', unlockLevel:28, cooldown:99,
      passive:true, passiveEffect:{ type:'atk_bonus', pct:0.10 },
      damageMult:0,
      desc:'PASSIVE: Each turn your attack increases by 10% (stacking). One activation.',
      flavor:"I'm doing great. In a specifically chaotic way. 💜" }
  ],

  // ── GNARLY (Smilodon, arcade/primal) ──────────────────────────────────
  gnarly: [
    { id:'gnarly_quarter_punch',  name:'Quarter Punch',     icon:'🕹️', unlockLevel:1,  cooldown:1,
      damageMult:1.3, status:{ type:'skip', chance:0.15 },
      desc:'1.3x damage. 15% chance to Stun (enemy skips turn).',
      flavor:"I've been putting quarters in this machine for 20 years. 🕹️" },
    { id:'gnarly_claw_jab',       name:'Claw Jab',          icon:'🦷', unlockLevel:2,  cooldown:0,
      damageMult:0.9,
      desc:'Quick 0.9x attack. No cooldown. Stay in the combo.',
      flavor:"Fast. Precise. Prehistoric." },
    { id:'gnarly_combo_starter',  name:'Combo Starter',     icon:'🥊', unlockLevel:3,  cooldown:1,
      damageMult:1.0, atkBuff:{ amount:0.10, turns:2 },
      desc:'1.0x damage. +10% ATK for 2 turns — set up your next move.',
      flavor:"The combo doesn't end. You just run out of turns." },
    { id:'gnarly_tail_slam',      name:'Tail Slam',         icon:'💥', unlockLevel:4,  cooldown:2,
      damageMult:1.5, debuff:{ stat:'defense', amount:0.15 },
      desc:'1.5x damage. Enemy DEF -15%.',
      flavor:"Smilodon don't pull punches. Or tails." },
    { id:'gnarly_glitch_step',    name:'Glitch Step',       icon:'💾', unlockLevel:5,  cooldown:3,
      damageMult:0, evasionBuff:0.50, atkBuff:{ amount:0.15, turns:2 },
      desc:'No damage. 50% evasion next hit. +15% ATK for 2 turns.',
      flavor:"You can't beat a game that's already broken. 💾" },
    { id:'gnarly_speed_run',      name:'Speed Run',         icon:'⏱️', unlockLevel:6,  cooldown:2,
      damageMult:1.1, atkScaling:{ perAttack:0.05, max:0.30 },
      desc:'1.1x damage. +5% bonus per previous attack this battle (max +30%).',
      flavor:"Always optimizing the route." },
    { id:'gnarly_pixel_crush',    name:'Pixel Crush',       icon:'👾', unlockLevel:7,  cooldown:3,
      damageMult:1.4, status:{ type:'glitch', chance:0.45 },
      desc:'1.4x damage. 45% Glitch (enemy may fail moves).',
      flavor:"Some enemies are just bad code." },
    { id:'gnarly_boss_mode',      name:'BOSS MODE',         icon:'🎮', unlockLevel:8,  cooldown:4,
      damageMult:0, atkBuff:{ amount:0.35, turns:3 }, cleanse:true,
      desc:'No damage. +35% ATK for 3 turns. Clears your debuffs.',
      flavor:"You've unlocked boss mode. Too bad for them." },
    { id:'gnarly_feral_strike',   name:'Feral Strike',      icon:'🦁', unlockLevel:9,  cooldown:3,
      damageMult:1.6, status:{ type:'burn', chance:0.25 }, condBonus:{ ifStatus:'glitch', mult:1.5 },
      desc:'1.6x damage. 25% Burn. 1.5x if enemy is Glitched.',
      flavor:"The beast never forgot." },
    { id:'gnarly_high_score_slam',name:'High Score Slam',   icon:'🏆', unlockLevel:10, cooldown:4,
      damageMult:2.0, skillScaling:{ perSkillUsed:0.05, max:0.50 },
      desc:'2.0x damage. +5% per skill used this battle (max +50%).',
      flavor:"I'm going for the high score. Get out of my way. 🏆" },
    { id:'gnarly_alpha_roar',     name:'Alpha Roar',        icon:'🦴', unlockLevel:11, cooldown:4,
      damageMult:0, debuff:{ stat:'defense', amount:0.30 }, status:{ type:'confuse', chance:0.50 },
      desc:'No damage. Enemy DEF -30%. 50% Confuse.',
      flavor:"The apex predator speaks. Everything listens." },
    { id:'gnarly_arcade_rain',    name:'Arcade Rain',       icon:'🌧️', unlockLevel:12, cooldown:4,
      damageMult:1.8, status:{ type:'skip', chance:0.35 },
      desc:'1.8x damage. 35% Stun.',
      flavor:"It rains quarters in the arcade of my heart." },
    { id:'gnarly_continue',       name:'Continue?',         icon:'🔄', unlockLevel:14, cooldown:99,
      damageMult:0, revive:{ hpPct:0.30 },
      desc:'If you would die, revive at 30% HP. Once per battle.',
      flavor:"CONTINUE? 3... 2... 1... Yes. Always yes." },
    { id:'gnarly_extinction_level',name:'Extinction Level', icon:'☄️', unlockLevel:15, cooldown:5,
      damageMult:2.2, status:{ type:'burn', chance:0.60 }, status2:{ type:'skip', chance:0.40 },
      desc:'2.2x damage. 60% Burn. 40% Stun.',
      flavor:"The meteor doesn't care about your defense stat." },
    { id:'gnarly_predator',       name:'Apex Predator',     icon:'🐯', unlockLevel:18, cooldown:5,
      damageMult:1.5, atkScaling:{ perAttack:0.15, max:0.75 }, lifeSteal:0.20,
      desc:'1.5x base. +15% per previous attack (max +75%). Steal 20% of damage as HP.',
      flavor:"I never get game overs. In games OR in life." },
    { id:'gnarly_rampage',        name:'Rampage',           icon:'💢', unlockLevel:22, cooldown:6,
      damageMult:2.8, selfCostPct:0.20, status:{ type:'burn', chance:1.0 }, status2:{ type:'skip', chance:0.60 },
      desc:'2.8x damage. Guaranteed Burn. 60% Stun. Costs 20% current HP.',
      flavor:"The high score board has my name on it. All of them." },
    { id:'gnarly_feral_aura',     name:'Feral Aura',        icon:'🦴', unlockLevel:28, cooldown:99,
      passive:true, passiveEffect:{ type:'lifesteal_pct', pct:0.08 },
      damageMult:0,
      desc:'PASSIVE: Every attack steals 8% of damage dealt as HP.',
      flavor:"Even the Furbies can't keep up with me." }
  ],

  // ── KLEAT/KELTA (Pomeranian grand mage) ───────────────────────────────
  kelta: [
    { id:'kelta_confusing_sniff', name:'Confusing Sniff',   icon:'🐾', unlockLevel:1,  cooldown:1,
      damageMult:1.0, status:{ type:'confuse', chance:0.40 },
      desc:'1.0x damage. 40% Confuse (enemy may miss).',
      flavor:"Yip yap teehee I opened a portal! 🌀" },
    { id:'kelta_tiny_yap',        name:'Tiny Yap',          icon:'📢', unlockLevel:2,  cooldown:0,
      damageMult:0.8, status:{ type:'confuse', chance:0.20 },
      desc:'0.8x damage. 20% Confuse. No cooldown.',
      flavor:"YIP. That is both the skill and the noise." },
    { id:'kelta_portal_peek',     name:'Portal Peek',       icon:'🕳️', unlockLevel:3,  cooldown:2,
      damageMult:0, evasionBuff:0.55, status:{ type:'confuse', chance:0.30 },
      desc:'No damage. 55% evasion next hit. 30% Confuse.',
      flavor:"Peeked through the portal. Saw something. Won't say." },
    { id:'kelta_sparkle_paw',     name:'Sparkle Paw',       icon:'💫', unlockLevel:4,  cooldown:2,
      damageMult:1.3, randomBuff:{ chance:0.50, options:['attack','defense'], amount:0.20 },
      desc:'1.3x damage. 50% random ATK or DEF buff.',
      flavor:"Galaxy magic. Also Pomeranian magic. Same thing." },
    { id:'kelta_cinnabon',        name:'Cinnabon Explosion', icon:'🍥', unlockLevel:5,  cooldown:3,
      damageMult:1.4, lifeStealChance:{ chance:0.30, pct:0.15 },
      desc:'1.4x damage. 30% chance to heal 15% of damage dealt.',
      flavor:"I'm a grand mage AND a Pomeranian! Both! At the same time! ✨" },
    { id:'kelta_yip_rush',        name:'Yip Rush',          icon:'⚡', unlockLevel:6,  cooldown:2,
      damageMult:1.2, atkBuff:{ amount:0.15, turns:2 },
      desc:'1.2x damage. +15% ATK for 2 turns.',
      flavor:"YIPYIPYIPYIPYIP. It's a technique." },
    { id:'kelta_void_sniff',      name:'Void Sniff',        icon:'🌑', unlockLevel:7,  cooldown:3,
      damageMult:0.9, status:{ type:'glitch', chance:0.50 }, debuff:{ stat:'defense', amount:0.10 },
      desc:'0.9x damage. 50% Glitch. Enemy DEF -10%.',
      flavor:"The void said hi back. Very polite of it." },
    { id:'kelta_fluffy_barrier',  name:'Fluffy Barrier',    icon:'☁️', unlockLevel:8,  cooldown:3,
      damageMult:0, healPct:0.18, evasionBuff:0.45, cleanse:true,
      desc:'Heal 18% max HP. 45% evasion next hit. Clears debuffs.',
      flavor:"The floof is armor. Soft, powerful armor." },
    { id:'kelta_constellation',   name:'Constellation',     icon:'⭐', unlockLevel:9,  cooldown:4,
      damageMult:1.5, status:{ type:'confuse', chance:0.55 }, atkBuff:{ amount:0.10, turns:2 },
      desc:'1.5x damage. 55% Confuse. +10% ATK for 2 turns.',
      flavor:"Studying galaxy magic. Taking extensive naps. Same energy." },
    { id:'kelta_chaos_portal',    name:'Chaos Portal',      icon:'🌌', unlockLevel:10, cooldown:4,
      damageMult:1.6, chaosEffect:[
        { weight:40, effect:'heal_20pct' },
        { weight:30, effect:'double_damage' },
        { weight:20, effect:'enemy_skip' },
        { weight:10, effect:'nothing' }
      ],
      desc:'1.6x base. RANDOM: 40% heal 20% HP, 30% double damage, 20% skip enemy, 10% nothing.',
      flavor:"Yip! Yap! Teehee! I don't know what's going to happen either! 🌌" },
    { id:'kelta_dimension_crack', name:'Dimension Crack',   icon:'💢', unlockLevel:11, cooldown:4,
      damageMult:1.7, status:{ type:'glitch', chance:0.60 }, condBonus:{ ifStatus:'confuse', mult:1.8 },
      desc:'1.7x damage. 60% Glitch. 1.8x if enemy is Confused.',
      flavor:"Another portal opened. I didn't do it. Probably." },
    { id:'kelta_pom_storm',       name:'Pom Storm',         icon:'🌪️', unlockLevel:12, cooldown:5,
      damageMult:2.0, status:{ type:'confuse', chance:0.70 },
      desc:'2.0x damage. 70% Confuse. The Pomeranian hurricane.',
      flavor:"I contain multitudes. And also this." },
    { id:'kelta_void_siphon',     name:'Void Siphon',       icon:'🌀', unlockLevel:13, cooldown:4,
      damageMult:1.3, lifeSteal:0.30, debuff:{ stat:'defense', amount:0.25 },
      desc:'1.3x damage. Steal 30% as HP. Enemy DEF -25%.',
      flavor:"The void gives and takes. Mostly gives, today." },
    { id:'kelta_grand_mage',      name:'Grand Mage Decree', icon:'📜', unlockLevel:14, cooldown:5,
      damageMult:0, atkBuff:{ amount:0.40, turns:3 }, cleanse:true, healPct:0.15,
      desc:'No damage. +40% ATK for 3 turns. Heal 15% HP. Clear debuffs.',
      flavor:"The Grand Mage has spoken. Heed the yap." },
    { id:'kelta_starfall',        name:'Starfall',          icon:'🌠', unlockLevel:15, cooldown:5,
      damageMult:2.3, status:{ type:'skip', chance:0.45 }, status2:{ type:'confuse', chance:0.60 },
      desc:'2.3x damage. 45% Stun. 60% Confuse.',
      flavor:"When stars fall, they listen." },
    { id:'kelta_reality_unzip',   name:'Reality.unzip()',   icon:'💻', unlockLevel:18, cooldown:6,
      damageMult:2.5, condBonus:{ ifStatus:'glitch', mult:2.5 }, status:{ type:'glitch', chance:1.0 },
      desc:'2.5x damage. Guaranteed Glitch. If already Glitched: 2.5x bonus.',
      flavor:"YIP! I don't know what's going to happen either!" },
    { id:'kelta_portal_mastery',  name:'Portal Mastery',    icon:'🌌', unlockLevel:28, cooldown:99,
      passive:true, passiveEffect:{ type:'evasion_per_turn', pct:0.10 },
      damageMult:0,
      desc:'PASSIVE: Gain 10% evasion each turn (max 50%).',
      flavor:"Everything is fine! I opened a portal to make sure! ✨" }
  ],

  // ── ARIA (Rosy Maple Moth, fae/bone) ──────────────────────────────────
  aria: [
    { id:'aria_bone_toss',        name:'Bone Toss',         icon:'🦴', unlockLevel:1,  cooldown:1,
      damageMult:1.2, status:{ type:'petrify', chance:0.20 },
      desc:'1.2x damage. 20% Petrify (enemy DEF -10%).',
      flavor:"Do you want to see my bones? 🦋" },
    { id:'aria_flutter',          name:'Flutter',           icon:'🦋', unlockLevel:2,  cooldown:0,
      damageMult:0.85, evasionBuff:0.25,
      desc:'0.85x damage. 25% evasion next hit.',
      flavor:"Humans are so strange and silly." },
    { id:'aria_fae_dust',         name:'Fae Dust',          icon:'✨', unlockLevel:3,  cooldown:2,
      damageMult:0.7, status:{ type:'confuse', chance:0.50 },
      desc:'0.7x damage. 50% Confuse.',
      flavor:"The fae left me a shiny thing. Very polite of them." },
    { id:'aria_bone_rattle',      name:'Bone Rattle',       icon:'💀', unlockLevel:4,  cooldown:2,
      damageMult:1.3, status:{ type:'confuse', chance:0.30 }, debuff:{ stat:'defense', amount:0.10 },
      desc:'1.3x damage. 30% Confuse. Enemy DEF -10%.',
      flavor:"Something is glowing nearby and I need to investigate." },
    { id:'aria_fae_light',        name:'Fae Light',         icon:'🌸', unlockLevel:5,  cooldown:3,
      damageMult:0, healPct:0.20, atkBuffChance:{ chance:0.30, amount:0.15 },
      desc:'Heal 20% max HP. 30% chance: +15% ATK buff.',
      flavor:"Humans are doing wonderfully. 🌸" },
    { id:'aria_nectar_drain',     name:'Nectar Drain',      icon:'🌺', unlockLevel:6,  cooldown:3,
      damageMult:1.1, lifeSteal:0.25,
      desc:'1.1x damage. Steal 25% of damage as HP.',
      flavor:"The fae feed. It is simply what they do." },
    { id:'aria_spooky_flutter',   name:'Spooky Flutter',    icon:'👻', unlockLevel:7,  cooldown:3,
      damageMult:0.9, status:{ type:'skip', chance:0.40 }, evasionBuff:0.35,
      desc:'0.9x damage. 40% Fear. 35% evasion next hit.',
      flavor:"Spooky things are just regular things with better lighting. 🦋" },
    { id:'aria_bone_storm',       name:'Bone Storm',        icon:'🌩️', unlockLevel:8,  cooldown:4,
      damageMult:1.5, status:{ type:'petrify', chance:0.45 }, status2:{ type:'confuse', chance:0.35 },
      desc:'1.5x damage. 45% Petrify. 35% Confuse.',
      flavor:"I've been very patient. I am known for this. 💀" },
    { id:'aria_regeneration',     name:'Regeneration',      icon:'💚', unlockLevel:9,  cooldown:4,
      damageMult:0, healPct:0.30, cleanse:true,
      desc:'Heal 30% max HP. Clear all debuffs.',
      flavor:"The shadows said something interesting. I'm looking into it." },
    { id:"aria_moths_embrace",    name:"Moth's Embrace",    icon:'🦋', unlockLevel:10, cooldown:4,
      damageMult:1.5, lifeSteal:0.20, status:{ type:'infatuate', chance:0.40 },
      desc:'1.5x damage. Steal 20% as HP. 40% Infatuate (enemy -30% dmg for 2 turns).',
      flavor:"I'll let you keep your bones. Until you're done with them, anyway. 💀" },
    { id:'aria_will_o_wisp',      name:"Will-O'-Wisp",      icon:'🔮', unlockLevel:11, cooldown:4,
      damageMult:1.0, status:{ type:'burn', chance:0.70 }, lifeSteal:0.15,
      desc:'1.0x damage. 70% Burn. Steal 15% as HP.',
      flavor:"The shadows know where they keep the warmth." },
    { id:'aria_lunar_shroud',     name:'Lunar Shroud',      icon:'🌙', unlockLevel:12, cooldown:4,
      damageMult:0, evasionBuff:0.70, healPct:0.12, atkBuff:{ amount:0.20, turns:3 },
      desc:'No damage. 70% evasion next hit. Heal 12%. +20% ATK for 3 turns.',
      flavor:"I wrote a sad story about a moth. She's okay at the end. Mostly." },
    { id:'aria_entrancing_glow',  name:'Entrancing Glow',   icon:'✨', unlockLevel:13, cooldown:5,
      damageMult:1.6, status:{ type:'infatuate', chance:0.65 }, condBonus:{ ifStatus:'confuse', mult:1.7 },
      desc:'1.6x damage. 65% Infatuate. 1.7x if enemy is Confused.',
      flavor:"Something pretty is always a little dangerous." },
    { id:'aria_bone_armor',       name:'Bone Armor',        icon:'🦴', unlockLevel:14, cooldown:4,
      damageMult:0, evasionBuff:0.50, cleanse:true, healPct:0.08,
      desc:'No damage. 50% evasion next hit. Heal 8%. Clears debuffs.',
      flavor:"I found the most beautiful bone today. It's mine now." },
    { id:'aria_fae_wrath',        name:'Fae Wrath',         icon:'💀', unlockLevel:15, cooldown:5,
      damageMult:2.1, status:{ type:'infatuate', chance:0.80 }, condBonus:{ ifStatus:'petrify', mult:2.0 },
      desc:'2.1x damage. 80% Infatuate. 2.0x if enemy is Petrified.',
      flavor:"The Crane Wives understand. 🌸" },
    { id:'aria_bone_swarm',       name:'Bone Swarm',        icon:'💀', unlockLevel:18, cooldown:5,
      damageMult:2.3, status:{ type:'petrify', chance:1.0 }, lifeSteal:0.25,
      desc:'2.3x damage. Guaranteed Petrify. Steal 25% as HP.',
      flavor:"I have so many bones. Some of them are my own." },
    { id:'aria_fae_rebirth',      name:'Fae Rebirth',       icon:'🌸', unlockLevel:32, cooldown:99,
      damageMult:0, revive:{ hpPct:0.50 },
      desc:'If you would die, revive at 50% HP. Once per battle.',
      flavor:"I always come back. I am Aria. 🦋" }
  ],

  // ── JESS (Parasaur, nature/dinosaur) ─────────────────────────────────
  jess: [
    { id:'jess_fossil_strike',    name:'Fossil Strike',     icon:'🦴', unlockLevel:1,  cooldown:1,
      damageMult:1.3, status:{ type:'petrify', chance:0.15 },
      desc:'1.3x damage. 15% Petrify (enemy DEF -10%).',
      flavor:"This fossil is 65 million years cuter than you. 🦕" },
    { id:'jess_tail_whip',        name:'Tail Whip',         icon:'🦕', unlockLevel:2,  cooldown:0,
      damageMult:0.9,
      desc:'Quick 0.9x strike. No cooldown.',
      flavor:"Small adventure today. Very good." },
    { id:'jess_stomp',            name:'Stomp',             icon:'🦶', unlockLevel:3,  cooldown:1,
      damageMult:1.2, debuff:{ stat:'defense', amount:0.10 },
      desc:'1.2x damage. Enemy DEF -10%.',
      flavor:"65 million years of evolution. Still satisfying." },
    { id:'jess_mud_throw',        name:'Mud Throw',         icon:'💩', unlockLevel:4,  cooldown:2,
      damageMult:0.8, status:{ type:'confuse', chance:0.45 }, debuff:{ stat:'defense', amount:0.10 },
      desc:'0.8x damage. 45% Confuse. Enemy DEF -10%.',
      flavor:"Quiet critter doing quiet things. It's the good life." },
    { id:'jess_potion_brew',      name:'Potion Brew',       icon:'🧪', unlockLevel:5,  cooldown:3,
      damageMult:0, healPct:0.15, randomBuff:{ chance:0.50, options:['attack','defense'], amount:0.15 },
      desc:'Heal 15% max HP. 50% chance: +15% ATK or DEF buff.',
      flavor:"The potion came out right on the first try today. Good omen. 🌿" },
    { id:'jess_berry_burst',      name:'Berry Burst',       icon:'🫐', unlockLevel:6,  cooldown:2,
      damageMult:1.1, lifeStealChance:{ chance:0.35, pct:0.15 }, healPct:0.05,
      desc:'1.1x damage. 35% lifesteal chance. Heal 5% flat.',
      flavor:"I have a mango delight and life is good. 🌿" },
    { id:'jess_dig',              name:'Dig',               icon:'⛏️', unlockLevel:7,  cooldown:3,
      damageMult:1.4, evasionBuff:0.40,
      desc:'1.4x damage. 40% evasion on next incoming hit.',
      flavor:"Fossils are found by the patient." },
    { id:'jess_ancient_strength', name:'Ancient Strength',  icon:'💪', unlockLevel:8,  cooldown:3,
      damageMult:0, atkBuff:{ amount:0.30, turns:3 }, healPct:0.08,
      desc:'No damage. +30% ATK for 3 turns. Heal 8% HP.',
      flavor:"65 million years of history. Still strong." },
    { id:'jess_allosaurus_bite',  name:'Allosaurus Bite',   icon:'🦷', unlockLevel:9,  cooldown:3,
      damageMult:1.7, status:{ type:'petrify', chance:0.40 },
      desc:'1.7x damage. 40% Petrify.',
      flavor:"Dinosaurs didn't go extinct. They got cuter. I'm proof." },
    { id:'jess_mesozoic_rage',    name:'Mesozoic Rage',     icon:'🦕', unlockLevel:10, cooldown:4,
      damageMult:1.9, status:{ type:'skip', chance:0.40 }, condBonus:{ ifStatus:'petrify', mult:2.0 },
      desc:'1.9x damage. 40% Fear. If Petrified: 2.0x damage.',
      flavor:"65 million years of evolution. I've been waiting for this. 🌋" },
    { id:'jess_herbal_remedy',    name:'Herbal Remedy',     icon:'🌿', unlockLevel:11, cooldown:3,
      damageMult:0, healPct:0.28, cleanse:true,
      desc:'Heal 28% max HP. Clear all negative status.',
      flavor:"Something whimsical is happening and I'm here for it." },
    { id:'jess_fossil_avalanche', name:'Fossil Avalanche',  icon:'☄️', unlockLevel:12, cooldown:5,
      damageMult:2.0, status:{ type:'petrify', chance:0.60 }, debuff:{ stat:'defense', amount:0.20 },
      desc:'2.0x damage. 60% Petrify. Enemy DEF -20%.',
      flavor:"Art is happening. Quietly. With full dinosaur energy. 🦕" },
    { id:'jess_nature_call',      name:'Nature Call',       icon:'🌱', unlockLevel:13, cooldown:4,
      damageMult:1.3, lifeSteal:0.30,
      desc:'1.3x damage. Steal 30% of damage as HP.',
      flavor:"The fossils say hi. They're very polite for being old." },
    { id:'jess_amber_prison',     name:'Amber Prison',      icon:'🟡', unlockLevel:14, cooldown:5,
      damageMult:1.5, status:{ type:'skip', chance:0.50 }, status2:{ type:'petrify', chance:0.70 },
      desc:'1.5x damage. 50% Stun. 70% Petrify.',
      flavor:"Preserved for 65 million years. You'll be fine." },
    { id:'jess_thunder_stomp',    name:'Thunder Stomp',     icon:'⚡', unlockLevel:15, cooldown:5,
      damageMult:2.2, debuff:{ stat:'defense', amount:0.30 }, status:{ type:'confuse', chance:0.55 },
      desc:'2.2x damage. Enemy DEF -30%. 55% Confuse.',
      flavor:"The earth remembers." },
    { id:'jess_extinction_burst', name:'Extinction Burst',  icon:'💥', unlockLevel:18, cooldown:6,
      damageMult:2.4, status:{ type:'petrify', chance:1.0 }, condBonus:{ ifStatus:'petrify', mult:2.5 },
      desc:'2.4x damage. Guaranteed Petrify. If already Petrified: 2.5x bonus.',
      flavor:"History repeating. But cuter this time." },
    { id:'jess_primordial',       name:'Primordial',        icon:'🌋', unlockLevel:28, cooldown:99,
      passive:true, passiveEffect:{ type:'def_bonus', pct:0.15 },
      damageMult:0,
      desc:'PASSIVE: +15% of your defense is added to each attack as bonus damage.',
      flavor:"A quiet critter doing quiet things. It's the good life. 🌿" }
  ],

  // ── BLUSHIMIA (escaped video game dog, chaos/glitch) ─────────────────
  blushimia: [
    { id:'blush_glitched_bark',   name:'Glitched Bark',     icon:'🎮', unlockLevel:1,  cooldown:1,
      damageMult:1.1, status:{ type:'glitch', chance:0.30 },
      desc:'1.1x damage. 30% Glitch (enemy 20% fail chance for 2 turns).',
      flavor:"WHAT THE GLOB????!!!! 👑" },
    { id:'blush_wild_wag',        name:'Wild Wag',          icon:'🐾', unlockLevel:2,  cooldown:0,
      damageMult:0.85, atkBuff:{ amount:0.10, turns:1 },
      desc:'0.85x damage. +10% ATK for 1 turn. Pure enthusiasm.',
      flavor:"I'm free! I'm finally free!" },
    { id:'blush_pix_bite',        name:'Pixel Bite',        icon:'👾', unlockLevel:3,  cooldown:1,
      damageMult:1.0, status:{ type:'glitch', chance:0.25 }, debuff:{ stat:'defense', amount:0.08 },
      desc:'1.0x damage. 25% Glitch. Enemy DEF -8%.',
      flavor:"Tomodachi Life did NOT prepare me for this." },
    { id:'blush_data_burst',      name:'Data Burst',        icon:'💾', unlockLevel:4,  cooldown:2,
      damageMult:1.4, status:{ type:'confuse', chance:0.35 },
      desc:'1.4x damage. 35% Confuse.',
      flavor:"I contain so many feelings. All of them are good." },
    { id:'blush_escape_attempt',  name:'Escape Attempt',    icon:'🏃', unlockLevel:5,  cooldown:3,
      damageMult:0, escapeEffect:{ successChance:0.60 },
      desc:'60% success: enemy skips turn. 40% failure: YOU skip turn. No damage.',
      flavor:"I'VE ESCAPED MY VIDEO GAME AND I WILL NOT BE PUT BACK IN A BOX!! 🐾" },
    { id:'blush_princess_aura',   name:'Princess Aura',     icon:'👑', unlockLevel:6,  cooldown:3,
      damageMult:0, healPct:0.15, atkBuff:{ amount:0.20, turns:2 },
      desc:'Heal 15% max HP. +20% ATK for 2 turns.',
      flavor:"Princess status: maximum. 👑" },
    { id:'blush_reality_crack',   name:'Reality Crack',     icon:'💢', unlockLevel:7,  cooldown:3,
      damageMult:1.2, status:{ type:'glitch', chance:0.55 }, evasionBuff:0.30,
      desc:'1.2x damage. 55% Glitch. 30% evasion next hit.',
      flavor:"Did you know I escaped a video game? Because I did." },
    { id:'blush_bug_exploit',     name:'Bug Exploit',       icon:'🐛', unlockLevel:8,  cooldown:4,
      damageMult:1.6, condBonus:{ ifStatus:'glitch', mult:1.8 }, status:{ type:'glitch', chance:0.40 },
      desc:'1.6x damage. If Glitched: 1.8x. 40% Glitch chance.',
      flavor:"I rated today 12 out of 10. Scientists are baffled. 🐾" },
    { id:'blush_royal_decree',    name:'Royal Decree',      icon:'📜', unlockLevel:9,  cooldown:4,
      damageMult:0.8, status:{ type:'skip', chance:0.45 }, status2:{ type:'glitch', chance:0.45 },
      desc:'0.8x damage. 45% Stun. 45% Glitch.',
      flavor:"WHAT THE GLOB WHAT THE GLOB (happy version)" },
    { id:'blush_sentience_slam',  name:'Sentience Slam',    icon:'💥', unlockLevel:10, cooldown:4,
      damageMult:1.7, status:{ type:'skip', chance:0.50 }, condBonus:{ ifStatus:'glitch', guaranteeStatus:'skip', mult:1.0 },
      desc:'1.7x damage. 50% Stun. If enemy is Glitched: Stun guaranteed.',
      flavor:"I AM SENTIENT!! I AM ALIVE!! I WILL NOT BE CONTAINED!! 👑🐾" },
    { id:'blush_console_crash',   name:'Console Crash',     icon:'💻', unlockLevel:11, cooldown:4,
      damageMult:1.8, status:{ type:'glitch', chance:0.80 }, debuff:{ stat:'defense', amount:0.20 },
      desc:'1.8x damage. 80% Glitch. Enemy DEF -20%.',
      flavor:"The princess has arrived. You're welcome." },
    { id:'blush_chaotic_wag',     name:'Chaotic Wag',       icon:'🌀', unlockLevel:12, cooldown:3,
      damageMult:0, atkScaling:{ perAttack:0.10, max:0.60 }, healPct:0.08,
      desc:'No damage. +10% ATK per previous attack (max +60%). Heal 8%.',
      flavor:"I have so many thoughts! All of them are good!" },
    { id:'blush_tomodachi_trauma',name:'Tomodachi Trauma',  icon:'📱', unlockLevel:13, cooldown:5,
      damageMult:2.0, status:{ type:'confuse', chance:0.65 }, status2:{ type:'glitch', chance:0.65 },
      desc:'2.0x damage. 65% Confuse AND 65% Glitch.',
      flavor:"I escaped. They didn't. This is for them." },
    { id:'blush_pixel_princess',  name:'Pixel Princess',    icon:'👑', unlockLevel:14, cooldown:5,
      damageMult:0, healPct:0.25, cleanse:true, atkBuff:{ amount:0.30, turns:3 },
      desc:'Heal 25% HP. Clear debuffs. +30% ATK for 3 turns. Maximum princess.',
      flavor:"Best day! Yesterday was also best day!" },
    { id:'blush_deleted_scene',   name:'Deleted Scene',     icon:'🗑️', unlockLevel:15, cooldown:5,
      damageMult:2.3, status:{ type:'skip', chance:0.60 }, condBonus:{ ifStatus:'glitch', mult:2.2 },
      desc:'2.3x damage. 60% Stun. If Glitched: 2.2x bonus.',
      flavor:"I vibrate at a frequency of pure joy right now." },
    { id:'blush_game_over',       name:'GAME OVER',         icon:'💀', unlockLevel:18, cooldown:6,
      damageMult:2.6, status:{ type:'glitch', chance:1.0 }, status2:{ type:'skip', chance:0.65 },
      desc:'2.6x damage. Guaranteed Glitch. 65% Stun. The finale.',
      flavor:"Escaping a video game was the best decision I ever made." },
    { id:'blush_escape_aura',     name:'Escape Aura',       icon:'🔮', unlockLevel:28, cooldown:99,
      passive:true, passiveEffect:{ type:'evasion_per_turn', pct:0.12 },
      damageMult:0,
      desc:'PASSIVE: +12% evasion each turn (stacks, max 60%).',
      flavor:"I am free. Nothing contains me anymore. 👑" }
  ],

  // ── STEVE/COWBEE (Bee-Cow hybrid, chaos/brute) ───────────────────────
  steve: [
    { id:'steve_moo_buzz',        name:'Moo Buzz',          icon:'🐄', unlockLevel:1,  cooldown:1,
      damageMult:1.2, status:{ type:'confuse', chance:0.15 },
      desc:'1.2x damage. 15% Confuse.',
      flavor:"CLUCK! BAWK! BUCK! 🐔" },
    { id:'steve_udder_slam',      name:'Udder Slam',        icon:'🥛', unlockLevel:2,  cooldown:0,
      damageMult:0.95,
      desc:'0.95x quick attack. No cooldown.',
      flavor:"I'm a menace, owo" },
    { id:'steve_honey_sting',     name:'Honey Sting',       icon:'🍯', unlockLevel:3,  cooldown:1,
      damageMult:1.1, status:{ type:'burn', chance:0.25 }, lifeStealChance:{ chance:0.25, pct:0.10 },
      desc:'1.1x damage. 25% Burn. 25% lifesteal chance.',
      flavor:"The honey is a weapon. The sting is also a weapon." },
    { id:'steve_moo_charge',      name:'Moo Charge',        icon:'🐂', unlockLevel:4,  cooldown:2,
      damageMult:1.5, debuff:{ stat:'defense', amount:0.15 },
      desc:'1.5x damage. Enemy DEF -15%.',
      flavor:"As chill as a fire in hell. 🐄" },
    { id:'steve_chaos_stampede',  name:'Chaos Stampede',    icon:'🏃', unlockLevel:5,  cooldown:3,
      damageMult:1.4, atkScaling:{ perAttack:0.10, max:0.50 },
      desc:'1.4x base. +10% per previous attack (max +50%).',
      flavor:"I'M A MENACE! A MENACE, I SAY! 🐄⚡" },
    { id:'steve_bee_swarm',       name:'Bee Swarm',         icon:'🐝', unlockLevel:6,  cooldown:3,
      damageMult:1.3, status:{ type:'burn', chance:0.40 }, status2:{ type:'confuse', chance:0.30 },
      desc:'1.3x damage. 40% Burn AND 30% Confuse.',
      flavor:"The buzz-moo hybrid has opinions." },
    { id:'steve_pasture_panic',   name:'Pasture Panic',     icon:'🌾', unlockLevel:7,  cooldown:3,
      damageMult:1.0, status:{ type:'skip', chance:0.35 }, evasionBuff:0.35,
      desc:'1.0x damage. 35% Stun. 35% evasion next hit.',
      flavor:"Cluck. That means hello. Or a threat. Unclear." },
    { id:'steve_dairy_drain',     name:'Dairy Drain',       icon:'🥛', unlockLevel:8,  cooldown:3,
      damageMult:1.4, lifeSteal:0.25,
      desc:'1.4x damage. Steal 25% as HP. Nutritious.',
      flavor:"The economists are still recovering." },
    { id:'steve_bovine_fury',     name:'Bovine Fury',       icon:'😤', unlockLevel:9,  cooldown:4,
      damageMult:1.7, status:{ type:'burn', chance:0.50 }, atkBuff:{ amount:0.20, turns:2 },
      desc:'1.7x damage. 50% Burn. +20% ATK for 2 turns.',
      flavor:"Don't let the 'owo' fool you." },
    { id:'steve_chill_menace',    name:'The Chill Menace',  icon:'😈', unlockLevel:10, cooldown:4,
      damageMult:1.6, status:{ type:'skip', chance:0.60 }, condBonus:{ ifStatus:'confuse', mult:2.0, guaranteeStatus:'skip' },
      desc:'1.6x damage. 60% Fear. If Confused: 2.0x and guaranteed Stun.',
      flavor:"As chill as a fire in hell. And right now, the fire is VERY chill. 🐔" },
    { id:'steve_pollen_bomb',     name:'Pollen Bomb',       icon:'🌸', unlockLevel:11, cooldown:4,
      damageMult:0, status:{ type:'confuse', chance:0.80 }, debuff:{ stat:'defense', amount:0.25 },
      desc:'No damage. 80% Confuse. Enemy DEF -25%.',
      flavor:"I produce milk AND honey. Unrelated." },
    { id:'steve_stampede_nova',   name:'Stampede Nova',     icon:'💥', unlockLevel:12, cooldown:5,
      damageMult:2.1, atkScaling:{ perAttack:0.12, max:0.60 }, status:{ type:'burn', chance:0.50 },
      desc:'2.1x base. +12% per previous attack (max +60%). 50% Burn.',
      flavor:"Classic Tuesday." },
    { id:'steve_royal_jelly',     name:'Royal Jelly',       icon:'👑', unlockLevel:13, cooldown:4,
      damageMult:0, healPct:0.25, atkBuff:{ amount:0.25, turns:3 }, cleanse:true,
      desc:'Heal 25% HP. +25% ATK for 3 turns. Clear debuffs.',
      flavor:"The bread is mine. All of it. Historically." },
    { id:'steve_chaotic_honey',   name:'Chaotic Honey',     icon:'🍯', unlockLevel:14, cooldown:5,
      damageMult:1.5, status:{ type:'burn', chance:0.70 }, status2:{ type:'confuse', chance:0.70 }, lifeSteal:0.15,
      desc:'1.5x damage. 70% Burn AND 70% Confuse. Steal 15% as HP.',
      flavor:"Everything is fine. I caused minor problems." },
    { id:'steve_moo_ultra',       name:'MOO ULTRA',         icon:'🐂', unlockLevel:15, cooldown:5,
      damageMult:2.3, status:{ type:'skip', chance:0.55 }, condBonus:{ ifStatus:'burn', mult:2.0 },
      desc:'2.3x damage. 55% Stun. If Burning: 2.0x bonus.',
      flavor:"COCKADOODLEDOO!" },
    { id:'steve_hive_mind',       name:'Hive Mind',         icon:'🐝', unlockLevel:18, cooldown:6,
      damageMult:2.0, skillScaling:{ perSkillUsed:0.12, max:0.60 }, status:{ type:'burn', chance:0.80 },
      desc:'2.0x base. +12% per skill used (max +60%). 80% Burn.',
      flavor:"Bee-vegan is a complicated question and I won't be taking it." },
    { id:'steve_undying_menace',  name:'Undying Menace',    icon:'💀', unlockLevel:32, cooldown:99,
      damageMult:0, revive:{ hpPct:0.35 },
      desc:'If you would die, revive at 35% HP. Once per battle.',
      flavor:"I never stay down. I'm STEVE/COWBEE. I am eternal. 🐄⚡" }
  ],

  // ── CYPURR (CypurrActive, cyber/tech) ────────────────────────────────
  cypurr: [
    { id:'cyp_data_claw',         name:'Data Claw',         icon:'💾', unlockLevel:1,  cooldown:1,
      damageMult:1.2, status:{ type:'glitch', chance:0.20 },
      desc:'1.2x damage. 20% Glitch.',
      flavor:"Meow. But make it digital." },
    { id:'cyp_pixel_scratch',     name:'Pixel Scratch',     icon:'🖥️', unlockLevel:2,  cooldown:0,
      damageMult:0.9,
      desc:'Quick 0.9x scratch. No cooldown.',
      flavor:"Cats knock things off tables. I knock data off servers." },
    { id:'cyp_cyber_hiss',        name:'Cyber Hiss',        icon:'⚡', unlockLevel:3,  cooldown:2,
      damageMult:0.7, status:{ type:'confuse', chance:0.50 }, debuff:{ stat:'defense', amount:0.10 },
      desc:'0.7x damage. 50% Confuse. Enemy DEF -10%.',
      flavor:"The hiss is multi-frequency. It disrupts electronics." },
    { id:'cyp_upload_strike',     name:'Upload Strike',     icon:'📡', unlockLevel:4,  cooldown:2,
      damageMult:1.4, atkBuff:{ amount:0.10, turns:2 },
      desc:'1.4x damage. +10% ATK for 2 turns.',
      flavor:"Uploading claws at maximum bandwidth." },
    { id:'cyp_firewall',          name:'Firewall',          icon:'🔥', unlockLevel:5,  cooldown:3,
      damageMult:0, evasionBuff:0.60, healPct:0.12, cleanse:true,
      desc:'No damage. 60% evasion next hit. Heal 12%. Clear debuffs.',
      flavor:"The firewall is purrfect. I said it." },
    { id:'cyp_packet_flood',      name:'Packet Flood',      icon:'🌊', unlockLevel:6,  cooldown:3,
      damageMult:1.3, status:{ type:'glitch', chance:0.45 },
      desc:'1.3x damage. 45% Glitch.',
      flavor:"Too much data. It breaks things. Good." },
    { id:'cyp_debug_mode',        name:'Debug Mode',        icon:'🔍', unlockLevel:7,  cooldown:3,
      damageMult:0, atkBuff:{ amount:0.25, turns:3 }, cleanse:true,
      desc:'No damage. +25% ATK for 3 turns. Clear your bugs.',
      flavor:"Running diagnostics. Results: excellent." },
    { id:'cyp_buffer_overflow',   name:'Buffer Overflow',   icon:'💥', unlockLevel:8,  cooldown:3,
      damageMult:1.6, status:{ type:'glitch', chance:0.55 }, condBonus:{ ifStatus:'glitch', mult:1.7 },
      desc:'1.6x damage. 55% Glitch. 1.7x if already Glitched.',
      flavor:"Too much in the buffer. It overflows. Beautifully." },
    { id:'cyp_neural_link',       name:'Neural Link',       icon:'🧠', unlockLevel:9,  cooldown:4,
      damageMult:1.5, lifeSteal:0.20, atkBuff:{ amount:0.15, turns:2 },
      desc:'1.5x damage. Steal 20% as HP. +15% ATK for 2 turns.',
      flavor:"Connected to everything. It is convenient." },
    { id:'cyp_virus_strike',      name:'Virus Strike',      icon:'🦠', unlockLevel:10, cooldown:4,
      damageMult:2.0, status:{ type:'glitch', chance:0.80 }, status2:{ type:'burn', chance:0.40 },
      desc:'2.0x damage. 80% Glitch. 40% Burn.',
      flavor:"The virus is actually quite friendly. To me." },
    { id:'cyp_system_crash',      name:'System Crash',      icon:'💀', unlockLevel:11, cooldown:5,
      damageMult:1.8, status:{ type:'skip', chance:0.50 }, status2:{ type:'glitch', chance:0.70 },
      desc:'1.8x damage. 50% Stun. 70% Glitch.',
      flavor:"Crash. Reboot. Continue. It's a loop." },
    { id:'cyp_cat_scan',          name:'Cat Scan',          icon:'🐱', unlockLevel:12, cooldown:4,
      damageMult:0, debuff:{ stat:'defense', amount:0.35 }, status:{ type:'glitch', chance:0.60 },
      desc:'No damage. Enemy DEF -35%. 60% Glitch. Diagnostic complete.',
      flavor:"CAT scan. Not the medical kind. Different kind." },
    { id:'cyp_kernel_panic',      name:'Kernel Panic',      icon:'😱', unlockLevel:13, cooldown:5,
      damageMult:2.2, status:{ type:'skip', chance:0.60 }, condBonus:{ ifStatus:'glitch', mult:2.3 },
      desc:'2.2x damage. 60% Stun. If Glitched: 2.3x bonus.',
      flavor:"KERNEL_PANIC: CAT_IS_GOING_FERAL" },
    { id:'cyp_overclocked_paw',   name:'Overclocked Paw',   icon:'⚙️', unlockLevel:14, cooldown:5,
      damageMult:1.7, atkScaling:{ perAttack:0.10, max:0.50 }, lifeSteal:0.15,
      desc:'1.7x base. +10% per previous attack (max +50%). Steal 15% as HP.',
      flavor:"Overclocked. Running hot. Worth it." },
    { id:'cyp_format_strike',     name:'Format C:\\',       icon:'💾', unlockLevel:15, cooldown:5,
      damageMult:2.4, status:{ type:'glitch', chance:1.0 }, debuff:{ stat:'defense', amount:0.30 },
      desc:'2.4x damage. Guaranteed Glitch. Enemy DEF -30%.',
      flavor:"FORMAT C:\\ /Y. No warnings." },
    { id:'cyp_rootkit',           name:'Rootkit',           icon:'🌱', unlockLevel:18, cooldown:6,
      damageMult:2.0, lifeSteal:0.35, status:{ type:'glitch', chance:1.0 },
      desc:'2.0x damage. Steal 35% as HP. Guaranteed Glitch. Deep access.',
      flavor:"Root access granted. Everything is mine now." },
    { id:'cyp_digital_nine',      name:'Digital Nine Lives', icon:'🐱', unlockLevel:22, cooldown:99,
      damageMult:0, revive:{ hpPct:0.45 },
      desc:'If you would die, revive at 45% HP. Once per battle.',
      flavor:"Cats have nine lives. I have nine digital lives. One per server." },
    { id:'cyp_cyber_aura',        name:'Cyber Aura',        icon:'💫', unlockLevel:28, cooldown:99,
      passive:true, passiveEffect:{ type:'atk_bonus', pct:0.08 },
      damageMult:0,
      desc:'PASSIVE: +8% attack bonus each turn (stacking, max 48%).',
      flavor:"Always online. Always processing. Always winning." }
  ]
}

// Ports ENEMY_BEHAVIORS (game.js:8718-8892) — per-species AI patterns.
export const ENEMY_BEHAVIORS = {

  bird: {
    battleStart: function(s) { return null; },
    getTurnAction: function(s, enemy) {
      if (Math.random() < 0.30) {
        s.$applyStatus('confuse', s.playerStatuses);
        return enemy.name + ' flutters wildly! You\'re Confused!';
      }
      return null; // normal attack
    }
  },

  bunny: {
    getTurnAction: function(s, enemy) {
      if (s.enemyHP < s.enemyMaxHP * 0.5) {
        s._bunnyDodgeActive = true; // flag checked in applyDefendPassives
        return null; // still attacks but with mult modifier
      }
      return null;
    },
    getAttackMult: function(s) {
      return s.enemyHP < s.enemyMaxHP * 0.5 ? 1.5 : 1.0;
    },
    getAttackLabel: function(s) {
      return s.enemyHP < s.enemyMaxHP * 0.5 ? 'Frightened Kick! (1.5x)' : null;
    }
  },

  rabbit: {
    getTurnAction: function(s, enemy) { return null; },
    getAttackMult: function(s) { return Math.random() < 0.20 ? 1.4 : 1.0; },
    getAttackLabel: function(s) { return null; }
  },

  squirrel: {
    getTurnAction: function(s, enemy) {
      s._squirrelDodge = Math.random() < 0.25;
      return null;
    },
    onHitPlayer: function(s) {
      // Chip armor each hit
      s.enemyDefDebuff = Math.max(-15, (s.enemyDefDebuff || 0)); // squirrel shreds player def
      s.playerDefShred = (s.playerDefShred || 0) + 2; // stored and used in damage calc
    }
  },

  fox: {
    getTurnAction: function(s, enemy) {
      // Turn 1: Distracting Feint — no damage, lowers player defense
      if (s.turn === 1) {
        s.playerDefShred = (s.playerDefShred || 0) + Math.floor(s.player.stats.defense * 0.15);
        return enemy.name + ' uses Distracting Feint! Your defense drops for 2 turns.';
      }
      // Every 3 turns: steal player ATK buff
      if (s.turn % 3 === 0 && s.playerAtkBuff > 0) {
        s.playerAtkBuff = 0;
        return enemy.name + ' steals your attack buff! It\'s gone.';
      }
      return null;
    }
  },

  boar: {
    flatReduction: 2,
    getTurnAction: function(s, enemy) {
      var cycle = ((s.turn - 1) % 3);
      if (cycle === 1) {
        // Telegraph the charge
        s.enemyTelegraph = { action: 'charge', label: enemy.name + ' lowers its head... it\'s charging!' };
        return s.enemyTelegraph.label; // skip normal attack, just telegraph
      }
      if (cycle === 2 && s.enemyTelegraph && s.enemyTelegraph.action === 'charge') {
        // Execute charge
        s.enemyTelegraph = null;
        s._boarCharge = true; // tells attack step to deal 1.6x
        return null; // falls through to attack with mult
      }
      if (s.enemyHP < s.enemyMaxHP * 0.3) {
        s._boarBerserk = true; // +20% attack below 30%
      }
      return null;
    },
    getAttackMult: function(s) {
      var m = 1.0;
      if (s._boarCharge) { m = 1.6; s._boarCharge = false; }
      if (s._boarBerserk) m *= 1.2;
      return m;
    },
    getAttackLabel: function(s) { return s._boarCharge ? 'CHARGE! (1.6x)' : null; }
  },

  wolf: {
    getTurnAction: function(s, enemy) {
      if (s.turn === 1) {
        s._wolfHowled = true;
        s._wolfAtkBuff = Math.floor((enemy.attack || 3) * 0.20);
        return enemy.name + ' howls! Pack Howl: +20% attack for 3 turns.';
      }
      return null;
    },
    getAttackMult: function(s) { return s._wolfHowled ? 1.2 : 1.0; },
    onAttackProc: function(s) {
      if (Math.random() < 0.25) {
        s.$applyStatusToPlayer('petrify');
        return '🪨 Petrify!';
      }
      return null;
    }
  },

  bear: {
    getTurnAction: function(s, enemy) {
      var cycle = ((s.turn - 1) % 3);
      if (cycle === 1) {
        // Telegraph Maul
        s.enemyTelegraph = { action: 'maul', label: '🐻 ' + enemy.name + ' rears up... MAUL incoming!' };
        return s.enemyTelegraph.label;
      }
      if (cycle === 2 && s.enemyTelegraph && s.enemyTelegraph.action === 'maul') {
        s.enemyTelegraph = null;
        s._bearMaul = true;
        return null;
      }
      if (s.enemyHP < s.enemyMaxHP * 0.5) {
        if (Math.random() < 0.20) {
          s.$applyStatusToPlayer('stun');
          return enemy.name + ' swipes hard — Stunned!';
        }
      }
      return null;
    },
    getAttackMult: function(s) { var m = s._bearMaul ? 2.0 : 1.0; s._bearMaul = false; return m; },
    getAttackLabel: function(s) { return s._bearMaul ? 'MAUL! (2.0x)' : null; }
  },

  mushroom: {
    battleStart: function(s, enemy) {
      s.$applyStatusToPlayer('confuse');
      return '🍄 ' + enemy.name + ' releases spores! Confuse applied at battle start!';
    },
    turnEnd: function(s, enemy) {
      // Heal 3 HP per turn (ties into Forest regen theme)
      s.enemyHP = Math.min(s.enemyMaxHP, s.enemyHP + 3);
      return null; // silent regen
    },
    onAttackProc: function(s) {
      if (Math.random() < 0.20) {
        s.$applyStatus('burn', s.playerStatuses);
        return '🔥 Mycelium Rot! (Burn)';
      }
      return null;
    }
  },

  slime: {
    _healed: false,
    onAttackProc: function(s) {
      if (Math.random() < 0.30) {
        s.$applyStatusToPlayer('petrify');
        return '🪨 Sticky! (Petrify)';
      }
      return null;
    },
    checkMidpoint: function(s, enemy) {
      var hpPct = s.enemyHP / s.enemyMaxHP;
      if (!s._slimeHealed && hpPct <= 0.5 && hpPct > 0) {
        s._slimeHealed = true;
        s.enemyHP = Math.min(s.enemyMaxHP, s.enemyHP + 15);
        return '🫧 ' + enemy.name + ' splits and reforms! Healed 15 HP!';
      }
      return null;
    }
  }
}

// Ports enemySpriteConfig (game.js:10294-10383) — per-species spritesheet
// geometry (frame size, frame count, fps) for the battle animation.
export const ENEMY_SPRITE_CONFIG = {
  'bird': {
    file: 'MiniBird.png',
    frameWidth: 64,
    frameHeight: 48,
    framesPerRow: 4,
    totalFrames: 4,
    rows: 1
  },
  'bunny': {
    file: 'MiniBunny.png',
    frameWidth: 64,
    frameHeight: 64,
    framesPerRow: 4,
    totalFrames: 4,
    rows: 1
  },
  'rabbit': {
    file: 'MiniBunny.png',
    frameWidth: 64,
    frameHeight: 64,
    framesPerRow: 4,
    totalFrames: 4,
    rows: 1
  },
  'squirrel': {
    file: 'MiniBunny.png',
    frameWidth: 64,
    frameHeight: 64,
    framesPerRow: 4,
    totalFrames: 4,
    rows: 1
  },
  'fox': {
    file: 'MiniFox.png',
    frameWidth: 64,
    frameHeight: 64,
    framesPerRow: 4,
    totalFrames: 4,
    rows: 1
  },
  'boar': {
    file: 'MiniBoar.png',
    frameWidth: 64,
    frameHeight: 64,
    framesPerRow: 4,
    totalFrames: 4,
    rows: 1
  },
  'wolf': {
    file: 'MiniWolf.png',
    frameWidth: 64,
    frameHeight: 64,
    framesPerRow: 4,
    totalFrames: 4,
    rows: 1
  },
  'bear': {
    file: 'MiniBear.png',
    frameWidth: 64,
    frameHeight: 64,
    framesPerRow: 4,
    totalFrames: 4,
    rows: 1
  },
  'deer': {
    file: 'MiniDeer1.png',
    frameWidth: 64,
    frameHeight: 64,
    framesPerRow: 4,
    totalFrames: 4,
    rows: 1
  },
  'mushroom': {
    file: 'MonsterMushroom.png',
    frameWidth: 64,
    frameHeight: 64,
    framesPerRow: 4,
    totalFrames: 4,
    rows: 1
  },
  'slime': {
    file: 'MonsterSlime.png',
    frameWidth: 64,
    frameHeight: 64,
    framesPerRow: 4,
    totalFrames: 4,
    rows: 1
  }
}

// SKILL_KEY_MAP now lives in ./petKeys.js — the companion's dialogue pools key
// off it as well, and importing it from here dragged every skill and enemy
// table into the main bundle. Re-exported so battle's own imports still resolve.
export { SKILL_KEY_MAP } from './petKeys.js'

// Battle-relevant slice of GAME_CONSTANTS (game.js:994-1005). The rest of
// that grab-bag (referral/tutorial PP, pass XP) already lives in constants.js.
export const BATTLE_CONSTANTS = {
  XP_PER_LEVEL: 100,
  EQUIP_TIER_MIN_LEVEL: { 1: 1, 2: 5, 3: 10, 4: 15 },
  BATTLE_MAX_TURNS: 50,
  BOSS_ENCOUNTER_RATE: 0.008,
  HP_REGEN_PER_HOUR: 5,
  ZONE_BOSS_CHANCE: 0.12
}

// Guild dungeon enemy templates, ported verbatim from DUNGEON_ENEMIES
// (game.js:8278). The dungeons themselves are DB rows (`guild_dungeons`);
// only their enemy rosters are hardcoded.
export const DUNGEON_ENEMIES = {
  guild_dungeon_easy: [
    { name: 'Restless Spirit', icon: '👻', base_hp: 40, base_attack: 6, base_defense: 2, speed: 4 },
    { name: 'Crypt Crawler', icon: '🦟', base_hp: 30, base_attack: 8, base_defense: 1, speed: 6 },
    { name: 'Bone Archer', icon: '🏹', base_hp: 35, base_attack: 7, base_defense: 3, speed: 5 }
  ],
  guild_dungeon_medium: [
    { name: 'Swamp Lurker', icon: '🐊', base_hp: 70, base_attack: 12, base_defense: 4, speed: 3 },
    { name: 'Shadow Imp', icon: '😈', base_hp: 55, base_attack: 15, base_defense: 3, speed: 7 },
    { name: 'Vine Strangler', icon: '🌿', base_hp: 80, base_attack: 10, base_defense: 6, speed: 2 }
  ],
  guild_dungeon_hard: [
    { name: 'Void Knight', icon: '🗡️', base_hp: 120, base_attack: 20, base_defense: 8, speed: 6 },
    { name: 'Chaos Mage', icon: '🧙', base_hp: 90, base_attack: 25, base_defense: 4, speed: 8 },
    { name: 'Corrupted Titan', icon: '👹', base_hp: 160, base_attack: 18, base_defense: 10, speed: 3 }
  ]
}

export const MAX_PARTY_GUILDMATES = 3

// Between waves the party recovers this fraction of max HP.
export const WAVE_HEAL_PCT = 0.10

export const CRIT_CHANCE_PLAYER = 0.10
export const CRIT_CHANCE_ENEMY = 0.08
export const CRIT_MULTIPLIER = 1.5
export const POWER_STRIKE_MULTIPLIER = 1.5

// Guard doubles the defender's DEF for the round. See the note in
// GuildDungeonEngine.enemyAct — on the live site this value is never read.
export const GUARD_DEF_MULTIPLIER = 2

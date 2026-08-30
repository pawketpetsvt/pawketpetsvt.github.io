// Static exploration-encounter content, ported from goExploring's handlers
// (game.js:6851-7135). Exploring is 82% battle; the rest of the time one of
// these fires instead.

// Zone-themed flavour events — small moments with a little PP, deliberately
// unlocking nothing. Several carry quiet ARG undertones.
export const FLAVOR_BY_ZONE = {
    outskirts: [
      { text: "Your pet rifled through some trash and found a shiny coin.", pp: 12, emoji: "🗑️" },
      { text: "A stray cat gave your pet a long, judgemental stare, then walked away.", pp: 8, emoji: "🐱" },
      { text: "You found a crumpled receipt from a store that closed years ago.", pp: 10, emoji: "🧾" },
      { text: "A pigeon dropped something on your pet. It was a coin. Somehow.", pp: 14, emoji: "🐦" },
      { text: "Someone left half a sandwich on a bench. Your pet ate it before you could stop them.", pp: 9, emoji: "🥪" },
      { text: "A street musician played a familiar melody. You couldn't place it.", pp: 11, emoji: "🎵" },
      { text: "Your pet found a lost glove. Just the one. Where is the other one?", pp: 8, emoji: "🧤" },
      { text: "You spotted a strange symbol spray-painted on a wall. It looked like it was watching you.", pp: 15, emoji: "🌀" },
    ],
    glade: [
      { text: "Your pet chased a butterfly for ten minutes. The butterfly won.", pp: 7, emoji: "🦋" },
      { text: "You found a four-leaf clover. Good omen, probably.", pp: 13, emoji: "🍀" },
      { text: "A small bird dropped a berry directly into your pet's mouth. Convenient.", pp: 9, emoji: "🫐" },
      { text: "Your pet rolled in some flowers. They smell absolutely divine now.", pp: 8, emoji: "🌺" },
      { text: "A sunny patch of grass. Your pet napped for exactly three minutes.", pp: 10, emoji: "☀️" },
      { text: "You heard a distant song carried on the wind. It felt oddly familiar.", pp: 12, emoji: "🎶" },
      { text: "A firefly landed on your pet's nose and just... stayed there.", pp: 10, emoji: "✨" },
      { text: "The pond reflected a sky that looked slightly different from the one above you.", pp: 14, emoji: "🌊" },
    ],
    deepwoods: [
      { text: "Something watched you from between the trees. When you looked, nothing was there.", pp: 15, emoji: "🌲" },
      { text: "Your pet sniffed a mushroom. The mushroom seemed offended.", pp: 10, emoji: "🍄" },
      { text: "You found old footprints that didn't match any creature you recognize.", pp: 14, emoji: "🐾" },
      { text: "The birds stopped singing all at once. Then started again a moment later.", pp: 12, emoji: "🦜" },
      { text: "There was a circle of perfectly flat grass. Your pet refused to enter it.", pp: 16, emoji: "⭕" },
      { text: "A tree had carvings in it. Most were initials. One was a date from 200 years ago.", pp: 13, emoji: "🌳" },
      { text: "You found honey dripping from a hollow log. No bees in sight.", pp: 11, emoji: "🍯" },
      { text: "Something rustled in the dark. Probably just the wind.", pp: 9, emoji: "💨" },
    ],
    ruins: [
      { text: "A stone moved beneath your foot and revealed a hidden compartment. It was empty.", pp: 15, emoji: "🏛️" },
      { text: "Strange symbols on the wall began to glow faintly, then stopped.", pp: 18, emoji: "✨" },
      { text: "You found a door that shouldn't be here. It was locked. The lock looked new.", pp: 20, emoji: "🚪" },
      { text: "The ruins whispered something. You didn't catch it. You don't think you want to.", pp: 16, emoji: "👂" },
      { text: "A single coin, minted in a country that doesn't exist anymore.", pp: 17, emoji: "🪙" },
      { text: "Your pet pressed their ear to the ground and growled softly.", pp: 13, emoji: "🔊" },
      { text: "A perfectly preserved jar of something. You left it where you found it.", pp: 14, emoji: "🫙" },
      { text: "The Archivist's filing system, scrawled on a wall. Your name is in it.", pp: 25, emoji: "📋" },
    ],
    hollow_warrens: [
      { text: "Something small darted past in the dark. Too fast to see clearly.", pp: 12, emoji: "🐇" },
      { text: "The tunnels echo strangely here. Your voice came back a second late.", pp: 14, emoji: "🌀" },
      { text: "A warren dead-end. Scratch marks on the wall. Something was trying to get out.", pp: 16, emoji: "🪨" },
      { text: "Old nesting material. Whatever lived here was large. Is large.", pp: 13, emoji: "🌿" },
    ],
    ashen_ruins: [
      { text: "The fire here burns without fuel. It has burned for a very long time.", pp: 16, emoji: "🔥" },
      { text: "Ash fell upward for a moment. Then the world remembered gravity.", pp: 18, emoji: "💨" },
      { text: "Scorched carvings. Someone was counting something. The number is very large.", pp: 20, emoji: "🔢" },
      { text: "The heat doesn't bother your pet. That should probably concern you.", pp: 15, emoji: "🌡️" },
    ]
  };

  // Fall back to generic events if zone not found

// Mixed into every zone's pool.
export const FLAVOR_UNIVERSAL = [
    { text: "You found a shiny pebble. It's not worth anything, but it's yours now.", pp: 8, emoji: "✨" },
    { text: "Your pet stopped to stare at something you couldn't see. They looked satisfied.", pp: 10, emoji: "🐾" },
    { text: "You heard a melody you didn't recognize. It stopped when you tried to hum it back.", pp: 11, emoji: "🎵" },
  ]

// Ports the roll table in goExploring(). Order matters: these are cumulative
// thresholds against a single Math.random().
export const ENCOUNTER_ODDS = [
  { kind: 'battle',  upTo: 0.82 },
  { kind: 'item',    upTo: 0.88 },
  { kind: 'treasure',upTo: 0.92 },
  { kind: 'recipe',  upTo: 0.95 },
  { kind: 'flavor',  upTo: 1.00 }
]

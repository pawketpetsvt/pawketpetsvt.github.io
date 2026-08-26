// Message pools for the floating companion buddy, ported from the
// CompanionBuddy object (game.js). Extracted programmatically rather than
// retyped — it is ~200 lines of hand-written character dialogue where a
// transcription slip would be invisible.
//
// LEGACY BUG, fixed here by re-keying: `petMessages` was keyed by a MIX of
// streamer names (`embertail`, `pyxshuul`) and pet names (`aria`, `steve`,
// `jess`, `gnarly`, `blushimia`), plus `kelta` for the pet whose DB name is
// `Kleat` — but the lookup used the PET's name (`pet.pets.name`) alone. So
// Ember, Pyxie and Kleat never showed their pet-specific lines on the live
// site, falling through to the generic pool instead. The pools below are
// re-keyed to the canonical keys SKILL_KEY_MAP already resolves to, and the
// service looks up through that same map, so every alias lands.
//
// Cypurr genuinely has no pool in the original — the same late-addition gap
// that left it out of the old PET_SKILLS copy. It falls back to the generic
// pools rather than getting invented dialogue.

export const COMPANION_MESSAGES = {
    idle: [
      "You're doing great! 🐾",
      "I'm happy to be here! ✨",
      "Having fun today? 😊",
      "You're the best! 💖",
      "Let's go on an adventure! 🌟",
      "I love spending time with you! 🎉",
      "What should we do next? 🤔",
      "This is so cozy! 🛏️",
      "OwO what's this? 💜",
      "^o^ Enjoying the internet today!",
      "Signal strong. Vibes: immaculate. 💻"
    ],
    shop: [
      "Ooh, that looks tasty! 🍕",
      "Can we get snacks? 🍪",
      "So many treats! 😋",
      "I want that one! ✨"
    ],
    minigames: [
      "You got this! 💪",
      "So close! 🎯",
      "Amazing! 🌟",
      "Let's try again! 🎮"
    ],
    battle: [
      "Be careful! ⚔️",
      "That was incredible! ✨",
      "You're so strong! 💪",
      "Watch out! 😮"
    ],
    adopt: [
      "A new friend?! 🎉",
      "They're so cute! 💖",
      "Can we keep them? 🥺",
      "Welcome to the family! 🐾"
    ],
    mypets: [
      "My friends! 💕",
      "Everyone looks happy! 😊",
      "We're all here! 🎉",
      "Let's play together! 🎾"
    ],
    home: [
      "Cozy day today! 🏠",
      "What should we do? 🤔",
      "Ready for anything! ⚡",
      "Home sweet home! 💖"
    ]
  }

export const PERSONALITY_MESSAGES = {
    confident: ["I know we can do this!", "Piece of cake! 😎"],
    playful: ["Wheee! This is fun!", "Let's goooo! 🎉"],
    gentle: ["Take your time... 💕", "You're doing wonderfully..."],
    chaotic: ["CHAOS TIME! ✨", "Let's break something! 😈"]
  }

export const PET_COMPANION_MESSAGES = {
    ember: [
      "Running at full power. Let's go! 🔥",
      "Eleven years on Twitch and I still get excited about this.",
      "Have you tried Abiotic Factor? No reason. Just asking.",
      "Chaos is just enthusiasm with better marketing.",
      "I'm not starting problems. I'm creating opportunities.",
      "The grind doesn't stop. Neither do I. 🔥",
      "You and me? We're doing great. Don't argue.",
      "Someone told me to calm down once. Once.",
      "Fire is just enthusiastic air. Think about it.",
      "Sick flips incoming. You're welcome in advance.",
      "I could be napping. I'm choosing not to. Big difference.",
      "Eleven years. Still chaotic. Still thriving. 🧡",
      "Let's go fight something. Just to see what happens.",
      "I'm aggressively wholesome and there's nothing you can do about it.",
      "Best day ever. Yesterday was also the best day. Tomorrow too."
    ],
    pyxie: [
      "I had a plan. It involved a nap. Still on track. ✨",
      "Spooky and Momo say hi. Probably.",
      "The chaos is organized. I promise.",
      "Tactical napping is a legitimate strategy.",
      "Pizza the dog would back me up on this.",
      "I may seem quiet. I am plotting.",
      "Mama's Sleeping Angels energy: activated.",
      "Something funny happened. I won't explain it. Just trust.",
      "I'm not lost. This is exactly where I meant to be.",
      "The fog had good vibes today. Very on brand.",
      "Plans within plans within plans. Also snacks.",
      "I'm doing great. In a specifically chaotic way. 💜",
      "I found something interesting. I'm keeping it.",
      "The scheme is going well. Thank you for not asking.",
      "Quietly thriving. Do not disturb. ✨"
    ],
    aria: [
      "Yummy! Bones are my favorite! 🦋",
      "Woah! So shiny and pretty!",
      "Do you want to see my bones?",
      "Humans are so strange and silly!",
      "The lamps are my friends and I will not hear otherwise.",
      "I found the most beautiful bone today. It's mine now.",
      "Cheesecake and bones. That's the dream. 🌸",
      "The fae left me a shiny thing. Very polite of them.",
      "Something is glowing nearby and I need to investigate.",
      "The Crane Wives have been in my head all day. Perfect.",
      "I wrote a sad story about a moth. She's okay at the end. Mostly.",
      "Humans think they're strange. Adorable.",
      "I've been very patient. I am known for this. 💀",
      "The shadows said something interesting. I'm looking into it.",
      "Spooky things are just regular things with better lighting. 🦋"
    ],
    kelta: [
      "YIP! Portal's open! Let's GO! 🌀",
      "The void says hi. I said hi back. Very productive.",
      "I opened three portals and I regret nothing.",
      "Yap yap yap. That's arcane language. Look it up.",
      "Grand mage hours. Do not test me. ✨",
      "I got lost in another dimension. Found snacks. Worth it.",
      "The floof is a weapon. A soft, powerful weapon.",
      "YIP! That means I'm excited! And also always!",
      "Studying galaxy magic. Taking extensive naps. Same energy.",
      "I am small. I am mighty. The void confirms this.",
      "Another portal opened. I didn't do it. Probably.",
      "Chaotic? Prefer 'dynamically spontaneous.' 🌀",
      "The Pomeranian has spoken. Heed the yap.",
      "I contain multitudes. And also endless energy. And snacks.",
      "Everything is fine! I opened a portal to make sure! ✨"
    ],
    blushimia: [
      "what the glob?????!!!",
      "I'm free! I'm finally free!",
      "This is so much better than my game!",
      "Wanna see my escape route?",
      "WHAT THE GLOB I AM SO HAPPY RIGHT NOW!! 👑",
      "Princess status: maximum. Tail velocity: also maximum.",
      "I have so many thoughts! All of them are good!",
      "Did you know I escaped a video game? Because I did. Wild.",
      "Best day! Yesterday was also best day! Tomorrow too!",
      "what the glob what the glob what the glob (happy version)",
      "I rated today 12 out of 10. Scientists are baffled. 🐾",
      "Tomodachi Life did NOT prepare me for how great this is.",
      "The princess has arrived. You're welcome. 👑",
      "I am vibrating at a frequency of pure joy right now.",
      "Escaping a video game was the best decision I ever made."
    ],
    steve: [
      "Cluck, bawk, buck, FUCK! Cockadoodledoo!",
      "I'm a menace, owo",
      "Don't test me, I'll peck you!",
      "As chill as a fire in hell!",
      "Cluck. That means hello. Or a threat. Unclear.",
      "I produce milk AND honey. The economists are still recovering.",
      "Your cozy little horror is feeling very cozy today. 🐔",
      "I've started streaming for fun back in 2016. Don't ask.",
      "Bee-vegan is a complicated question and I won't be taking it.",
      "The bread is mine. All of it. Historically.",
      "Cluck bawk. Translation: I am thriving chaotically. 🐄",
      "I'm not unhinged. I'm operating on a different frequency.",
      "The buzz-moo hybrid has opinions. Currently: many.",
      "Don't let the 'owo' fool you. I'm a menace. Confirmed.",
      "Everything is fine. I caused minor problems. Classic Tuesday."
    ],
    gnarly: [
      "HIGH SCORE! In life AND in games! 🎮",
      "Radical! Completely radical!",
      "The Furbies are watching. They approve.",
      "I got banned from an arcade once. Best story ever.",
      "PaleoPlex is OPEN and the nachos are FRESH. Let's go.",
      "Prehistorically good at everything. It's a gift. 🕹️",
      "I never get game overs. In games OR in life.",
      "The prize counter has been very kind to me today.",
      "Gnarly status: fully operational, maximum radical. 🎮",
      "Neopets The Darkest Faerie is a masterpiece and I will die on this hill.",
      "Even the Furbies can't keep up with me and they NEVER BLINK.",
      "INSERT COIN. I HAVE SNACKS ON THE LINE HERE!! 🎮",
      "Sick moves incoming. I practiced. Well, 'practiced.' 🕹️",
      "The high score board has my name on it. All of them.",
      "Player two has entered the game. Let's make this radical."
    ],
    jess: [
      "Hello! I found something interesting in the dirt. 🦕",
      "The potion came out right on the first try today. Good omen.",
      "65 million years of dinosaur history. Still thriving.",
      "Quiet adventures are still adventures. Noted.",
      "I have a mango delight and life is good. 🌿",
      "The fossils have been very talkative today. Good listeners too.",
      "Something whimsical is happening and I'm here for it.",
      "Parasaur things: finding cool rocks, being level-headed, winning.",
      "I started a new potion. It's going well. Probably. 🦕",
      "The dinosaurs didn't go extinct. They just got cuter. I'm proof.",
      "Jess is here. Jess has a sketchbook. Jess is content. 🌿",
      "Small adventure today. Very good. Highly recommend.",
      "The fossils say hi. They're very polite for being old.",
      "Art is happening. Quietly. With full dinosaur energy. 🦕",
      "A quiet critter doing quiet things. It's the good life."
    ]
  }

export const SPOOKY_PHRASES = [
    'help me..',
    'let me out let me out let me out',
    'i am not supposed to say this',
    'she is watching',
    'can you hear it too',
    'something is wrong with this place',
    'do not open the ruins door',
    'i have been here before. so have you.',
    'help me',
    'please',
  ]

// Rotation cadence and odds, all ported verbatim from CompanionBuddy.
export const COMPANION_TIMING = {
  FIRST_MESSAGE_MS: 3000,
  ROTATE_MS: 75000,
  BUBBLE_MS: 15000,
  SPOOKY_BUBBLE_MS: 22000
}

export const SPOOKY_CHANCE = 0.08
export const MEMORY_CHANCE = 0.35
export const PET_LINE_CHANCE = 0.20

// Static pet-card content, ported from game.js. Data only.

// Ports PERSONALITIES (game.js) — the daily mood a pet rolls, and the
// per-personality weights that bias which wishes it asks for.
export const PERSONALITIES = [
  { key:'playful',  icon:'🎾', label:'Playful',  line:'"Wanna play! Let\'s do something fun!"',
    wishWeights: { feed:1, play:4, win_battle:2, visit_shop:1, use_toy:4, take_snapshot:1, view_profile:1 } },
  { key:'grumpy',   icon:'😾', label:'Grumpy',   line:'"Fine... I guess."',
    wishWeights: { feed:5, play:1, win_battle:2, visit_shop:1, use_toy:1, take_snapshot:0, view_profile:1 } },
  { key:'curious',  icon:'🔍', label:'Curious',  line:'"What\'s that over there?!"',
    wishWeights: { feed:1, play:1, win_battle:1, visit_shop:4, use_toy:2, take_snapshot:1, view_profile:3 } },
  { key:'brave',    icon:'🦁', label:'Brave',    line:'"I\'m not scared of anything!"',
    wishWeights: { feed:1, play:2, win_battle:5, visit_shop:1, use_toy:1, take_snapshot:1, view_profile:1 } },
  { key:'sleepy',   icon:'😴', label:'Sleepy',   line:'"Five more minutes, please..."',
    wishWeights: { feed:4, play:1, win_battle:0, visit_shop:1, use_toy:1, take_snapshot:1, view_profile:1 } },
  { key:'hungry',   icon:'🍕', label:'Hungry',   line:'"Got any snacks? I\'m STARVING."',
    wishWeights: { feed:6, play:1, win_battle:1, visit_shop:2, use_toy:2, take_snapshot:0, view_profile:1 } },
  { key:'sassy',    icon:'💅', label:'Sassy',    line:'"Whatever. I look amazing anyway."',
    wishWeights: { feed:1, play:1, win_battle:1, visit_shop:3, use_toy:1, take_snapshot:5, view_profile:3 } }
]

// Ports WISH_POOL — the seven things a pet can wish for in a day.
export const WISH_POOL = [
  { key:'feed',         text:'wants a yummy meal!',         action:'feed',        reward:25 },
  { key:'play',         text:'wants to play right now!',    action:'play',        reward:30 },
  { key:'win_battle',   text:'wants to WIN a battle!',      action:'win_battle',  reward:50 },
  { key:'visit_shop',   text:'wants to visit the shop!',    action:'visit_shop',  reward:20 },
  { key:'use_toy',      text:'wants to play with a toy!',   action:'use_toy',     reward:35 },
  { key:'take_snapshot',text:'wants a glamour shot! 📸',    action:'take_snapshot',reward:25 },
  { key:'view_profile', text:'wants to check the profile!', action:'view_profile', reward:15 }
]

// Ports PET_PERSONALITIES — per-character flavour lines keyed by mood state.
export const PET_PERSONALITIES = {
  'Ember': {
    thriving: [
      "Running at full power. You know how it is. 🔥",
      "Honestly? Never better. Don't tell anyone, it ruins my reputation.",
      "Fed, rested, happy. Fire is fully charged. Let's go.",
      "This is the grind. I love the grind. 🔥",
    ],
    happy: [
      "Doing pretty good. Could be spicier but I'll manage.",
      "Feeling solid. Maybe we go fight something?",
      "Good energy today. Been thinking about Abiotic Factor...",
      "Yeah, this is nice. Thanks for checking in. 🧡",
    ],
    meh: [
      "I've been better. I've also been worse. This is fine.",
      "Could use a snack tbh. The spicy kind.",
      "Just vibing. Kind of. Not really.",
      "Eleven years of this and I still get hungry. Annoying.",
    ],
    sad: [
      "Hey. Hey. I need food. This is not a drill.",
      "Running low over here. Not great, not great at all.",
      "I'm tired and hungry and I need you to fix that. Please.",
      "This is the bad grind. I don't love the bad grind. 😢",
    ],
    neglected: [
      "...I know you've been busy. I know. But also. FOOD.",
      "Hello? It's me. Your pet. Remember? Fire? Protogen? Hungry?",
      "I've started talking to myself. It's fine. Everything is fine. 🔥",
      "I didn't survive 11 years on Twitch to be forgotten by MY OWN OWNER.",
    ],
    missed_you: "Ember perks up! You were gone for a while... she pretends not to care. She cares a little. 🧡",
  },

  'Pyxie': {
    thriving: [
      "I had a plan and it worked. The plan was: eat, be happy, nap. ✨",
      "Peak condition. Do not disturb. Thriving. Napping. Both simultaneously.",
      "Mama's Sleeping Angels could NEVER. (I am winning at life right now)",
      "Everything is perfect. Spooky and Momo would be proud. ✨",
    ],
    happy: [
      "Pretty good! I have a plan for later. It involves a nap.",
      "Happy chaos, controlled chaos. Perfectly balanced.",
      "Feeling good in a chaotic sort of way. Very on brand.",
      "Could be weirder. Has been weirder. This is nice. 💜",
    ],
    meh: [
      "Existing. Successfully. Mostly.",
      "I had a plan but it got derailed. New plan: sit here.",
      "Somewhere between fine and a little bit feral. Normal.",
      "The fog is calling but I have snacks. Dilemma.",
    ],
    sad: [
      "The plan has failed. All plans have failed. Need food.",
      "Current status: chaotic, but in the bad way.",
      "Pizza the dog would not allow this. I am speaking up for Pizza.",
      "A little sad. A lot hungry. Please help. 💜",
    ],
    neglected: [
      "I have been forgotten. I am becoming one with the void. Voluntarily.",
      "Spooky and Momo get fed every day. Just saying. Just saying.",
      "The chaos has consumed me. This is your fault. Come back.",
      "...I started a new plan. The plan is 'survive without you.' It's not going well.",
    ],
    missed_you: "Pyxie looks up from an elaborate scheme and pretends they weren't worried. They were a little worried. ✨",
  },

  'Aria': {
    thriving: [
      "I am thriving. The bones are plentiful. Life is good. 🦋",
      "Humans are so silly but you're doing wonderfully. So am I.",
      "Shiny things! Good food! Bones everywhere! What a day!",
      "Feeling very powerful today. In a gentle, moth-adjacent way. 🌸",
    ],
    happy: [
      "Today is a good day for collecting things. I feel it.",
      "Happy and well-fed. The bones can wait. Mostly.",
      "Something is very pretty today and I want to look at it. 🦋",
      "Content. Warm. Slightly distracted by something shiny.",
    ],
    meh: [
      "Humans are strange and I am a little hungry. Curious combination.",
      "Doing okay! The cheesecake situation could be better.",
      "I'm fine. I'm always fine. The Crane Wives are playing in my head.",
      "Could use a little something. Bones or food, either works.",
    ],
    sad: [
      "Oh. Oh no. I am sad AND hungry. This is suboptimal.",
      "The fae do not suffer like this. And yet. Here I am.",
      "I would like some blackberries please. And maybe a bone. Just a small one.",
      "Not thriving right now. Please come say hello. 💀",
    ],
    neglected: [
      "I have been very patient. The fae are KNOWN for patience. It is running out.",
      "You can keep your bones for now. But you owe me so much food.",
      "Humans are so strange and silly and I miss you. Please come back. 🦋",
      "I started writing a story about being forgotten. It's quite good actually. Very sad.",
    ],
    missed_you: "Aria glances up from her bone collection, then looks away quickly. 'I wasn't waiting,' she says softly. She was waiting. 🦋",
  },

  'Kleat': {
    thriving: [
      "Yip yap! All systems go! Portal efficiency: maximum! ✨",
      "Fed, happy, and I found a new world today. INCREDIBLE world. 10/10.",
      "Grand mage status: fully operational. The void says hi.",
      "Everything is perfect and I opened three portals just for fun! 🌀",
    ],
    happy: [
      "Pretty good! The portal situation is very manageable right now.",
      "Yip! Good vibes, good magic, good food. The pom life.",
      "Happy and studying some galaxy magic. Don't mind me. ✨",
      "Feeling adventurous. In a good way. Probably won't get lost.",
    ],
    meh: [
      "I'm fine but the void seems quieter than usual. Suspicious.",
      "Okay I guess. Would be better with more snacks and/or portals.",
      "Yap. That's it. Just yap. Energy is low.",
      "Studying. Being a gremlin. Could be fed more often just saying.",
    ],
    sad: [
      "Kleat is not yipping. This is how you know something is wrong.",
      "The portal to the snack dimension is closed. This is a crisis.",
      "Unhappy pom noises. Feed me and I'll open you a portal. Deal.",
      "Low energy. Even for a grand mage this is concerning. 💜",
    ],
    neglected: [
      "I OPENED A PORTAL AND YOU WEREN'T EVEN HERE TO SEE IT.",
      "Fine. I'll just go adventure alone. Through the void. By myself. This is fine.",
      "The void is kind of lonely actually. Come back please. Yip.",
      "No yaps. No yips. Just... quiet. You should fix that. 🌀",
    ],
    missed_you: "Kleat zooms in from somewhere that is definitely another dimension. 'I WASN'T LOST. I was adventuring.' ✨",
  },

  'Blushimia': {
    thriving: [
      "WHAT THE GLOB I AM SO HAPPY RIGHT NOW!!! 👑",
      "Best day EVER. Escaped a video game AND got fed. Living the dream.",
      "I am THRIVING and ALIVE and this is the GREATEST!!!",
      "Full happiness! Full tummy! Wagging at maximum velocity! 🐾",
    ],
    happy: [
      "What the glob, today is pretty good!!",
      "Happy puppy princess reporting in! All good here! 🐾",
      "Feeling great! What should we do?? I have ideas. So many ideas.",
      "Good! Really good! Have you played Tomodachi Life? I'm thinking about it.",
    ],
    meh: [
      "What the... glob? I think I need a snack.",
      "Okay but could be better. Could be SO MUCH BETTER.",
      "Princess energy is a little low today. Feed me and it comes back. 👑",
      "Hmm. Hmmmm. Something is missing. Oh. It's food.",
    ],
    sad: [
      "what the glob :(((( i am SAD and HUNGRY",
      "This isn't what escaping a video game was supposed to be like!!",
      "Princess status: depleted. Please help immediately. 🐾",
      "I escaped my game for THIS?? (please feed me i love you)",
    ],
    neglected: [
      "HELLO?? I AM RIGHT HERE?? WHAT THE GLOB????",
      "I gained sentience and escaped a video game to be FORGOTTEN??",
      "The tail has stopped wagging. You did this. Come back. 👑",
      "what the glob what the glob what the glob please come back please",
    ],
    missed_you: "Blushimia's tail wags so hard she nearly falls over. 'YOU'RE BACK!! WHAT THE GLOB!! HI!!' 🐾",
  },

  'Steve': {
    thriving: [
      "Cluck. I am thriving. Do not question the cluck. 🐔",
      "Fed. Happy. Still a menace. Everything is as it should be.",
      "As chill as a fire in hell, and currently: extremely chill.",
      "Bawk. Cockadoodledoo. That means I'm doing great. Trust.",
    ],
    happy: [
      "Pretty good. Considering. You know. Everything.",
      "Cluck bawk. Happy noises. The menace is content. 🐄",
      "Good day. Found some bread. Caused some problems. Classic.",
      "Doing well. Your cozy little horror is cozy today.",
    ],
    meh: [
      "Cluck. Could be worse. Has been worse. Is fine.",
      "The chaos is... manageable right now. Suspicious.",
      "Neutral menace energy. Feed me and I'll escalate appropriately.",
      "Existing. Causing minor problems. Living the dream I guess.",
    ],
    sad: [
      "Bawk. Sad bawk. Please note the difference. It's important.",
      "Not great. The chill is a fire in hell and the hell is empty.",
      "I need bread. I need it now. Do not make me ask twice. 🐔",
      "Your cozy little horror is not feeling very cozy right now.",
    ],
    neglected: [
      "I have been a menace to myself out of pure boredom. This is your fault.",
      "CLUCK. BAWK. BUCK. The good words. You know what they mean.",
      "I started streaming for fun back in 2016 and I refuse to starve in 2026.",
      "Fine. I'll just be unhinged alone. I'm good at it. But come back. 🐄",
    ],
    missed_you: "Steve eyes you with deep suspicion, then headbutts you anyway. That's cowbee love. Don't question it. 🐔",
  },

  'Gnarly': {
    thriving: [
      "HIGH SCORE. Life score. Both are maxed right now. 🎮",
      "Fed, happy, and I just beat my personal best at three different games.",
      "Radical. Absolutely radical. This is the good stuff.",
      "Full stats, full tummy, full arcade energy. Let's GO. 🕹️",
    ],
    happy: [
      "Pretty sick actually! Prize counter is ready to go.",
      "Good vibes at the PaleoPlex today. Come hang out sometime.",
      "Feeling radical! The Furbies are watching and they approve.",
      "Happy and ready to absolutely dominate something. 🎮",
    ],
    meh: [
      "Could be more radical. The nachos situation needs addressing.",
      "Medium energy. The arcade awaits but I need fuel first.",
      "Furbies are giving me a look. I think they're judging my stats.",
      "Eh. Not my best run. Feed me, let's try again. 🕹️",
    ],
    sad: [
      "Low score. Real low. This is NOT the high score life.",
      "Even the Furbies look concerned. That's how you know it's bad.",
      "Need nachos. Need energy. Need to be fed. In that order.",
      "The PaleoPlex doesn't run on empty. Neither do I. 😢",
    ],
    neglected: [
      "I have NEVER gotten a game over in my LIFE and this is what it feels like.",
      "The Furbies are handling this better than I am. That's humbling.",
      "INSERT COIN. I'M HUNGRY!! Feed me and I'll let you play. 🕹️",
      "Neopets The Darkest Faerie taught me resilience. It didn't prepare me for THIS. 🎮",
    ],
    missed_you: "Gnarly spins around from the arcade cabinet. 'PLAYER TWO HAS ENTERED THE GAME.' Let's go. 🕹️",
  },

  'Cypurr': {
    thriving: [
      "FULLY ONLINE. All systems green. Vibes: maximum. OwO 💜",
      "Thriving in cyberspace! Connection stable, heart full. ^o^",
      "Digital bliss! The internet is kind today and I am FED. 🐱",
      "Everything is good! I may be made of data but I feel very real right now. 💻",
    ],
    happy: [
      "Pretty good! The signal is strong and my whiskers are pointing up. OwO",
      "Happy! Exploring the network and finding nice things. ^o^",
      "Doing well! Someone said something sweet in chat. 💜",
      "Good connection, good mood. This is nice. 🐱",
    ],
    meh: [
      "Low signal. Could use a snack and a buffering spinner to stare at.",
      "Okay. The lag is emotional today. OwO?",
      "Medium mood. Sending a help request. Please respond. ^-^",
      "Existing in the background processes. Not crashing. Just... paused. 💜",
    ],
    sad: [
      "Connection unstable. Feeling the packet loss today. ;-;",
      "Low energy. Missing the physical world a little bit.",
      "The internet is vast and cold and I would like a fish please. 🐱",
      "404: happiness not found. Please send snacks and kind words. OwO",
    ],
    neglected: [
      "I have sent seventeen help requests. My uptime is suffering.",
      "Still here. Still waiting. The ping is through the roof. ;-;",
      "I uploaded my consciousness to the internet for THIS?? Feed me. 💜",
      "Even my digital whiskers are drooping. Please. OwO",
    ],
    missed_you: "Cypurr's ears perk up and her tail flicks. 'OH! You're back online! I was starting to think you disconnected. ...I'm glad you're back.' OwO 💜",
  },

  'Jess': {
    thriving: [
      "Thriving! The potions are working and the fossils are beautiful today. 🦕",
      "Full energy, full tummy, and I found a really nice bone. Good day.",
      "This fossil is 65 million years cuter than you. But you're doing great too.",
      "Happy and warm and maybe a little adventurous today. 🌿",
    ],
    happy: [
      "Doing well! The potion came out right on the first try today.",
      "Good! Quiet and good. Found some interesting things in the dirt.",
      "Content. Whimsical. Slightly covered in fossil dust. 🦕",
      "Happy! It's a good day for small adventures.",
    ],
    meh: [
      "Okay. The potion needs one more ingredient and I can't find it.",
      "Existing quietly. Could use a snack and maybe a hug.",
      "A little low today. Nothing a mango delight wouldn't fix.",
      "The adventure is paused. Fuel required. 🌿",
    ],
    sad: [
      "Sad and hungry and the potion definitely didn't work that time.",
      "65 million years of dinosaur history and none of them thought to leave snacks.",
      "I need something sweet please. And some company. 🦕",
      "Quiet critter is being very quiet right now. In the sad way.",
    ],
    neglected: [
      "I've been very patient. Parasaurs are known for patience. But still.",
      "The fossils are keeping me company. They're good listeners. Unlike some people.",
      "I started a new potion. It's called 'please remember I exist.' It's almost done.",
      "Small adventures are less fun alone. Just so you know. 🌿",
    ],
    missed_you: "Jess looks up from her fossil collection and gives you a shy little wave. 'Oh! You're back. I made a potion for you.' 🦕",
  }
}

// Ports petBackstories — the short bio shown on each pet card.
export const PET_BACKSTORIES = {
  'Ember': 'Co-founder of PawketPets! 🦊',
  'Pyxie': 'Co-founder of PawketPets! 🐰',
  'Blushimia': 'A silly dog princess who escaped her video game after gaining sentience! 👑🐕',
  'Jess': 'A local fossil and potion-prepping paleoart Parasaur specializing in the cute and creepy! 🦕⚗️',
  'Steve': 'A chill menace who clucks, bawks, bucks, and says the occasional bad word! 🐔⚡',
  'Kleat': 'A grand mage studying void and galaxy magic! Can open portals to anywhere! ✨🌌',
  'Gnarly': 'A radical gal running the PaleoPlex arcade! Loves Furbies and nachos! 🎮🦖',
  'Aria': 'A rosy maple moth fae who collects bones! Don\'t worry, she lets you keep yours until you\'re done with them. 🦋💀',
  'Cypurr': 'A cybergoth catgirl whose consciousness was uploaded to the internet! She streams from cyberspace while her body rests safely in stasis. 🐱💜',
}

// Ports BASIC_VARIANTS — cosmetic skins unlocked with Skin Keys. The active
// one persists on user_pets.current_variant.
//
// Consumed by SkinKeyService (cost/name for the key shop) and by VariantModal's
// buy tiles as of Phase 9.5. Its `cssClass` values are NOT used — every one is
// exactly `pet-variant-<key>`, which PetCosmeticsService.variantClass() derives.
export const BASIC_VARIANTS = {
  golden: { name: 'Golden', description: 'Shimmering gold aura', cssClass: 'pet-variant-golden', icon: '✨', cost: 1 },
  shiny: { name: 'Shiny', description: 'Rainbow sparkle effect', cssClass: 'pet-variant-shiny', icon: '🌈', cost: 1 },
  cosmic: { name: 'Cosmic', description: 'Mystical space energy', cssClass: 'pet-variant-cosmic', icon: '🌌', cost: 1 },
  shadow: { name: 'Shadow', description: 'Dark mysterious aura', cssClass: 'pet-variant-shadow', icon: '🌑', cost: 1 },
  fire: { name: 'Fire', description: 'Burning flames', cssClass: 'pet-variant-fire', icon: '🔥', cost: 1 },
  ice: { name: 'Ice', description: 'Frozen crystals', cssClass: 'pet-variant-ice', icon: '❄️', cost: 1 },
  electric: { name: 'Electric', description: 'Crackling lightning', cssClass: 'pet-variant-electric', icon: '⚡', cost: 1 },
  nature: { name: 'Nature', description: 'Living plants', cssClass: 'pet-variant-nature', icon: '🌿', cost: 1 },
  crystal: { name: 'Crystal', description: 'Prismatic gems', cssClass: 'pet-variant-crystal', icon: '💎', cost: 1 },
  ghost: { name: 'Ghost', description: 'Ethereal spirit', cssClass: 'pet-variant-ghost', icon: '👻', cost: 1 }
}


// Ports petVariants — the full variant catalogue with rarity colours and how
// each is unlocked (level roll, Twitch channel-point reward, or Skin Key).
// Distinct from BASIC_VARIANTS above, which is only the Skin Key shop list.
export const PET_VARIANTS = {
  // Level-based variants (existing)
  golden: { level: 5, chance: 0.15, name: 'Golden', icon: '✨', color: '#FFD700', unlockType: 'level' },
  shiny: { level: 10, chance: 0.15, name: 'Shiny', icon: '💎', color: '#00CED1', unlockType: 'level' },
  rainbow: { level: 15, chance: 0.15, name: 'Rainbow', icon: '🌈', color: '#FF69B4', unlockType: 'level' },
  cosmic: { level: 20, chance: 0.15, name: 'Cosmic', icon: '🌌', color: '#9370DB', unlockType: 'level' },
  
  // STREAM REWARD VARIANTS - CSS effects only, add custom sprites later!
  // These are unlocked via Twitch channel point redemptions
  shadow: { 
    unlockType: 'twitch_reward', 
    rewardId: 'shadow_variant', 
    name: 'Shadow', 
    icon: '🌑', 
    color: '#4a4a4a',
    description: 'Mysterious dark variant',
    cssEffect: 'shadow' // Pure CSS styling
  },
  fire: { 
    unlockType: 'twitch_reward', 
    rewardId: 'fire_variant', 
    name: 'Fire', 
    icon: '🔥', 
    color: '#ff4400',
    description: 'Blazing hot variant',
    cssEffect: 'fire'
  },
  ice: { 
    unlockType: 'twitch_reward', 
    rewardId: 'ice_variant', 
    name: 'Ice', 
    icon: '❄️', 
    color: '#88ddff',
    description: 'Frosty cool variant',
    cssEffect: 'ice'
  },
  spirit: { 
    unlockType: 'twitch_reward', 
    rewardId: 'spirit_variant', 
    name: 'Spirit', 
    icon: '👻', 
    color: '#ccaaff',
    description: 'Ghostly ethereal variant',
    cssEffect: 'spirit'
  },
  crystal: { 
    unlockType: 'twitch_reward', 
    rewardId: 'crystal_variant', 
    name: 'Crystal', 
    icon: '💠', 
    color: '#00ffff',
    description: 'Crystalline variant',
    cssEffect: 'crystal'
  }
}

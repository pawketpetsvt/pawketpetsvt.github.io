// Melon's onboarding walkthrough, extracted verbatim from the `Tutorial.steps`
// array in the legacy index.html's inline <script> (index.html:1104-1167).
//
// This is a genuine, live feature — not dead code. It ran for every new player
// via checkTutorialStatus() and is what awards the first-run PP. It lived in an
// inline <script> rather than game.js, which is why a Phase 1 grep of game.js
// concluded `Tutorial` was undefined; that was corrected in Phase 2, but the
// walkthrough itself was never ported until now.
//
// Extracted programmatically — 38 lines of dialogue where a transcription slip
// would be invisible.
//
// Per-dialogue flags:
//   mascot       one of excited / explaining / worried / serious / scared /
//                happy. Drives the mascot animation class. Note `happy` has no
//                rule of its own; it renders as the unmodified mascot, which is
//                how legacy behaved too.
//   highlightTab pulses that tab's sidebar button and points an arrow at it.
//   waitForPet   blocks Continue until the player actually adopts.
//   showChoice   replaces the buttons with the spooky-mode opt-in.

export const TUTORIAL_STEPS = [
    {id:'welcome', tab:'home', dialogue:[
      {text:"Hi! I'm Melon 🍈 — before anything else: do you need any accessibility features? You can enable colorblind mode, reduced motion, high contrast, or larger text in ⚙️ Settings anytime. We want everyone to be able to enjoy PawketPets!", mascot:"explaining"},
      {text:"Hi! I'm Melon 🍈 — welcome to PawketPets! You've been accepted into the beta!", mascot:"excited"},
      {text:"Fair warning: the game isn't fully finished. The code is... fragmenting. You'll see a Beta Integrity bar — that tracks how stable things are. But don't worry, your presence here actually helps stabilize it.", mascot:"worried"},
      {text:"Things will get better with time. And there may be... something watching the cracks. But we don't need to talk about that right now! Let's focus on getting you a pet!", mascot:"serious"},
      {text:"This is your Home page. Your daily login bonus, my requests, world events, and tips all show up here. You can see your stats in the bottom-left corner too!", mascot:"explaining", highlightTab:"home"}
    ]},
    {id:'adoption', tab:'adopt', dialogue:[
      {text:"Welcome to the Adoption Center! 🐾 Each pet belongs to one of our VTuber streamers.", mascot:"happy", highlightTab:"adopt"},
      {text:"Your FIRST pet is completely FREE! Each pet after that costs PP — the price goes up by 50 PP per pet you own.", mascot:"explaining"},
      {text:"Go ahead — click a pet to adopt them! I'll wait right here. 😊", mascot:"excited", waitForPet:true}
    ]},
    {id:'mypets', tab:'mypets', requiresPet:true, dialogue:[
      {text:"Aww, look at them! 💕 Welcome to your new companion!", mascot:"excited"},
      {text:"This is My Pets. Each pet has Hunger, Energy, and Happiness stats — feed them, play with them, and check in daily!", mascot:"explaining", highlightTab:"mypets"},
      {text:"As pets level up they get stronger for battles. You can also set a Companion — they'll hang out in the corner of your screen!", mascot:"happy"},
      {text:"The Pet Journal tab (also in this section) unlocks lore entries as you feed your pets different foods. It's worth exploring!", mascot:"excited"}
    ]},
    {id:'equipment', tab:'mypets', dialogue:[
      {text:"See the Equipment section on each pet card? ⚔️ Click Manage to equip weapons and armor.", mascot:"explaining"},
      {text:"Better gear makes your pets tougher in battle. You can buy equipment from the Shop!", mascot:"excited"}
    ]},
    {id:'fishing', tab:'fishing', dialogue:[
      {text:"The Fishing tab is tucked in the Games section of the sidebar! 🎣", mascot:"happy", highlightTab:"fishing"},
      {text:"Hold the Cast button to charge power, release when the bar fills up, then click the timing bar when the indicator hits the green zone.", mascot:"explaining"},
      {text:"Rare catches reward bonus PP and unlock your Fish Journal. You can upgrade your rod and set bait for better odds!", mascot:"excited"}
    ]},
    {id:'minigames', tab:'minigames', dialogue:[
      {text:"Minigames are another great way to earn PP! 🕹️", mascot:"excited", highlightTab:"minigames"},
      {text:"Shell Game, Slot Machine, Dice Roll, Typing Challenge — most can be played once per day for a PP reward.", mascot:"explaining"},
      {text:"The more you play each day, the more you earn. Mix in fishing and minigames with pet care for a solid daily routine!", mascot:"happy"}
    ]},
    {id:'battle', tab:'battle', dialogue:[
      {text:"Battle Arena is where your pets fight wild enemies and earn XP and PP! ⚔️", mascot:"explaining", highlightTab:"battle"},
      {text:"Battles are TURN-BASED — you pick your action each turn: Attack, use a Skill, or Flee. Your pet's level and equipment matter!", mascot:"excited"},
      {text:"Defeat enough enemies and you'll eventually face the Shadow of Piper... if you're brave enough. 👀", mascot:"serious"}
    ]},
    {id:'racing', tab:'racing', dialogue:[
      {text:"Racing is a whole competitive system! 🏁 Check the sidebar — there's a Racing section with Train, Quick Race, and Grand Prix.", mascot:"excited", highlightTab:"racing"},
      {text:"Train your pet's stats like Pace, Stamina, and Interference — up to 3 sessions per day. Then enter Quick Races for PP!", mascot:"explaining"},
      {text:"Win enough races to climb the League ladder: Bronze → Silver → Gold → Diamond → Champion. Weekly prizes await at the top!", mascot:"happy"}
    ]},
    {id:'shop', tab:'shop', dialogue:[
      {text:"The Shop is where you spend PP on food, toys, healing items, and equipment. 🛒", mascot:"explaining", highlightTab:"shop"},
      {text:"Stock rotates weekly so check back often. Guild members may also get a Shop discount if their treasury vote passes!", mascot:"happy"}
    ]},
    {id:'guild', tab:'guild', dialogue:[
      {text:"Guilds let you team up with other players! 🏛️", mascot:"happy", highlightTab:"guild"},
      {text:"Join or create a guild, donate PP to its treasury, and vote on buffs — like bonus XP or shop discounts — that help everyone.", mascot:"explaining"},
      {text:"Guilds also have Dungeons! Form a party with your guildmates' pets and tackle waves of enemies together for PP and guild XP.", mascot:"excited"}
    ]},
    {id:'pass', tab:null, dialogue:[
      {text:"See the 🎫 Pass and 🎯 Bingo buttons in the top bar?", mascot:"excited"},
      {text:"The PawketPass levels up as you play — every feed, battle, race, and minigame gives Pass XP. Each level rewards PP, items, or cosmetics!", mascot:"explaining"},
      {text:"The Daily Bingo card gives you tasks to complete each day. Finish a row for bonus rewards, or blackout the whole card for a big prize! 🎉", mascot:"happy"}
    ]},
    {id:'spooky', tab:null, dialogue:[
      {text:"Almost done! But... I should mention something.", mascot:"worried"},
      {text:"PawketPets is still technically in beta. I've been here a long time and I notice things — glitches, shadows, strange encounters.", mascot:"scared"},
      {text:"There are hidden lore fragments, creepy bosses, and a character named Piper who seems very interested in what we're building here.", mascot:"serious"},
      {text:"Are you okay with things that go bump in the night? 👻", mascot:"serious", showChoice:true}
    ]}
]

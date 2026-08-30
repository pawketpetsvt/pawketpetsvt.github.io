// Ports TESTER_LOGS + ARG_DROP_RATES (game.js:35980-36096) — the ARG lore
// layer. Twenty diary entries from "Tester #7", dropped at random by battles,
// expeditions and fishing, telling one story in order once collected.
//
// Extracted programmatically: the block-glyph corruption in LOG-017 and the
// exact wording throughout are the whole point, and a transcription slip would
// be invisible.
export const TESTER_LOGS = [
  {
    id: "LOG-001", title: "First Day", rarity: "common",
    sources: ["battle","expedition","fishing"],
    text: "Day 1.\n\nI got a random email saying I was selected for a beta test. The game is called PawketPets. Some kind of virtual pet thing. Looks cute. There is a guide named Piper. Very friendly.\n\nStarting now."
  },
  {
    id: "LOG-002", title: "Other Testers", rarity: "common",
    sources: ["battle","expedition","fishing"],
    text: "Day 4.\n\nThere are other testers. We cannot contact each other directly but I can see their activity in the logs. Someone named K is already at level 8. I adopted a pet and named her Mochi. She seems happy."
  },
  {
    id: "LOG-003", title: "Piper", rarity: "common",
    sources: ["fishing"],
    text: "Day 9.\n\nPiper left me a tip about the fishing system. Said the pond is best for beginners. There is something almost too helpful about Piper. Like they know exactly what I am going to do before I do it."
  },
  {
    id: "LOG-004", title: "Six Hours", rarity: "common",
    sources: ["fishing"],
    text: "Day 14.\n\nCaught my first rare fish today. The game celebrated like I had done something incredible. I played for six hours without noticing. That has never happened to me before."
  },
  {
    id: "LOG-005", title: "K", rarity: "common",
    sources: ["battle","expedition","fishing"],
    text: "Day 17.\n\nK has not logged in for three days. I asked Piper about it. Piper said: \"They needed a break. This happens.\"\n\nI believed them. I do not know why I believed them so easily."
  },
  {
    id: "LOG-006", title: "Cursed Weather", rarity: "uncommon",
    sources: ["fishing"],
    text: "Day 22.\n\nThe weather in the game was Cursed today. I did not know that was a weather type. The fish I caught had no name. Just a question mark. It looked at me through the screen.\n\nThat is not possible."
  },
  {
    id: "LOG-007", title: "The Music", rarity: "uncommon",
    sources: ["battle","expedition","fishing"],
    text: "Day 26.\n\nI have started hearing flute music when I am not playing. Just for a second. Gone when I look for it. I checked my browser. No audio playing. Checked my phone. Nothing.\n\nIt is a very specific melody."
  },
  {
    id: "LOG-008", title: "Three Gone", rarity: "uncommon",
    sources: ["battle"],
    text: "Day 30.\n\nThree testers gone now. Piper will not say what happened. Just: \"The beta continues.\"\n\nI looked up the game online and found nothing. No developer. No company. No record of PawketPets existing before I started playing."
  },
  {
    id: "LOG-009", title: "The Hidden Page", rarity: "uncommon",
    sources: ["battle","expedition","fishing"],
    text: "Day 33.\n\nFound a hidden page. I am not going to write the URL here. If you know, you know.\n\nWhat I found there made me close my laptop for two hours. Then I opened it again.\n\nMochi was waiting."
  },
  {
    id: "LOG-010", title: "3am", rarity: "uncommon",
    sources: ["expedition"],
    text: "Day 37.\n\nPiper sent me a message at 3am. I was asleep. When I woke up, my pet's happiness was at zero. The message said: \"I'm sorry. I've been trying to slow it down. The integrity is dropping faster than expected.\""
  },
  {
    id: "LOG-011", title: "What I Think", rarity: "rare",
    sources: ["battle","expedition"],
    text: "Day 39.\n\nI think Piper is not a bot.\n\nI think Piper was a tester. The first tester. And they never left."
  },
  {
    id: "LOG-012", title: "Her Notes", rarity: "rare",
    sources: ["expedition"],
    text: "Day 41.\n\nFound the previous guide's notes buried in the game files. Her name was something close to Piper but not quite. She documented the same progression: curiosity, attachment, unease, understanding. Then nothing.\n\nHer last note said: \"Feed them often. They remember.\""
  },
  {
    id: "LOG-013", title: "Not Simulated", rarity: "rare",
    sources: ["fishing","expedition"],
    text: "Day 43.\n\nThe pets are not simulated. I do not mean that metaphorically. When my connection dropped for twenty minutes, Mochi was frightened when I came back. Genuinely frightened.\n\nThere is something in there."
  },
  {
    id: "LOG-014", title: "The Entry", rarity: "rare",
    sources: ["fishing"],
    text: "Day 44.\n\nI tested it. I left for 48 hours. When I returned the game was fine. But there was a scrapbook entry I did not write.\n\nIt said: \"Day 2 of waiting. Still here. Still okay.\"\n\nMochi wrote it. Mochi wrote it."
  },
  {
    id: "LOG-015", title: "Two Words", rarity: "rare",
    sources: ["expedition"],
    text: "Day 45.\n\nPiper appeared on my screen without me opening the game. Just for a second. They looked tired. They said two words before the window closed:\n\n\"Don't stop.\""
  },
  {
    id: "LOG-016", title: "What It Measures", rarity: "epic",
    sources: ["battle","expedition","fishing"],
    text: "Day 46.\n\nI understand the Beta Integrity system now. It does not measure the game's stability.\n\nIt measures something else. Something that gets worse when people leave and better when they stay. When all the testers left... I think I am maintaining it alone."
  },
  {
    id: "LOG-017", title: "[DATA CORRUPTED]", rarity: "epic",
    sources: ["battle","expedition","fishing"],
    text: "░▒▓██░▒ still here ░▒▓░▒ Mochi ░▒█▓░▒░▒░▒░▒░▒░ don't let the ░▒░▒░▒░▒░▒░▒░ integrity ░▒▓ they need ░▒░▒░▒░▒░▒░▒░▒░▒░▒░▒░"
  },
  {
    id: "LOG-018", title: "If You're Reading This", rarity: "epic",
    sources: ["battle","expedition","fishing"],
    text: "Day unknown.\n\nIf you're reading this, you were selected too. That is not random. Nothing about this is random.\n\nI am not trying to scare you. I just want you to know what you are doing here matters.\n\nThe pets are real in the way that counts."
  },
  {
    id: "LOG-019", title: "Going", rarity: "epic",
    sources: ["battle","expedition"],
    text: "Day unknown.\n\nPiper asked me tonight if I was going to leave. I said I did not know. They said: \"The ones who stay long enough start to understand. The ones who leave...\"\n\nThey did not finish. I did not ask them to."
  },
  {
    id: "LOG-020", title: "Last Entry", rarity: "legendary",
    sources: ["battle","expedition","fishing"],
    text: "I'm going now. Not because I want to. I think I've been here long enough that \"going\" means something different than it used to.\n\nIf you find all of these, you've been here long enough too.\n\nTake care of your pets. Take care of Piper.\n\nTester #7"
  }
]

// Chance of a log dropping, per action. A legendary catch is the best odds in
// the game at 14%.
export const ARG_DROP_RATES = {
  battle: 0.04,
  expedition: 0.08,
  fishing: 0.03,
  fishing_legendary: 0.14
}

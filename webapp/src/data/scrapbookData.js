// Ports the scrapbook memory templates (SCRAPBOOK_TEMPLATES and
// WEATHER_MEMORY_LINES, game.js:35455-35560). Extracted programmatically —
// 70 lines of flavour text where a transcription slip would be invisible.
//
// `{pet}` and `{trainer}` are substituted at write time, plus whatever extra
// variables the memory type carries (`{zone}`, `{food}`, `{level}`, `{enemy}`,
// `{hp}`, `{toy}`, `{fish}`).
export const SCRAPBOOK_TEMPLATES = {
  adopted: [
    "{pet} found a forever home with {trainer}!",
    "{pet} was adopted and joined the Pawket family!",
    "A new journey begins for {pet} with {trainer}!"
  ],
  first_battle_win: [
    "{pet} won their first battle against {enemy}!",
    "{pet} defeated {enemy} for the very first time!",
    "Victory! {pet} triumphed over {enemy}!"
  ],
  first_battle_loss: [
    "{pet} lost to {enemy} but learned a valuable lesson.",
    "{pet} gained experience from defeat against {enemy}.",
    "{enemy} proved tough, but {pet} will try again!"
  ],
  level_milestone: [
    "{pet} reached level {level}! Growing stronger every day!",
    "Level {level} achieved for {pet}! More adventures await!",
    "{pet} hit level {level} - what a journey so far!"
  ],
  favorite_food: [
    "{pet} discovered they absolutely LOVE {food}!",
    "{pet} went crazy for {food} - new favorite discovered!",
    "{pet} tried {food} and couldn't get enough!"
  ],
  low_hp_victory: [
    "{pet} won a battle with only {hp} HP remaining! Such determination!",
    "{pet} pulled through a tough fight with {hp} HP left!",
    "Against all odds, {pet} survived with {hp} HP!"
  ],
  random_flavor: [
    "{pet} enjoyed a peaceful afternoon in the sun.",
    "{pet} played with other pets at the park.",
    "{pet} found a hidden treasure while exploring!",
    "{pet} made a new friend during their adventures.",
    "{pet} had a relaxing day by the pond.",
    "{pet} chased butterflies in the meadow.",
    "{pet} watched the sunset with their trainer.",
    "{pet} discovered a mysterious hidden cave.",
    "{pet} was very quiet today. They seemed to be waiting for something.",
    "{pet} kept looking at the door. You were not sure what they expected to see.",
    "{pet} remembered something today. They did not share it with you.",
    "{pet} seemed happy. Happier than usual. You are not sure why.",
    "{pet} looked at you for a long time before doing anything else."
  ],
  neglect_recovery: [
    "{pet} was relieved when {trainer} came back. They had been keeping track of the days.",
    "{pet} did not ask where {trainer} had been. They were just glad they came back.",
    "When {trainer} returned, {pet} acted like nothing had happened. They had been practicing."
  ],
  expedition_complete: [
    "{pet} came back from {zone} with stories to tell and pockets full of treasures.",
    "An expedition to {zone} complete! {pet} returned safely, tired but proud.",
    "{pet} explored {zone} and made it back. A little braver than before.",
    "The {zone} has been thoroughly investigated by {pet}. Verdict: very interesting."
  ],
  evolution_teen: [
    "{pet} has grown into a teen! Something has shifted. They seem bigger. More themselves.",
    "Somewhere between adventure and rest, {pet} crossed into a new stage. Teen now.",
    "{pet} grew up a little today. Just a little. Still theirs. 🌱",
    "A quiet milestone: {pet} is no longer a baby. Teen energy incoming."
  ],
  evolution_adult: [
    "{pet} reached adulthood. Whatever that means for them, exactly. It suits them.",
    "Full-grown and fully themselves: {pet} is an adult now. The journey continues.",
    "{pet} made it to adulthood. {trainer} watched it happen. Quietly proud.",
    "An adult now. {pet} looks the same but different somehow. Good different. 🌿"
  ],
  first_toy_use: [
    "{pet} played with {toy} for the first time today. Immediate obsession detected.",
    "{toy} has been approved by {pet}. Unanimously. With enthusiasm.",
    "First time with {toy}: {pet} was into it. Very into it. This is their thing now.",
    "{pet} discovered {toy} today. The toy did not survive at full dignity. {pet} had fun."
  ],
  hunger_empty: [
    "{pet} got very hungry while {trainer} was away. They waited. They're okay. They remember.",
    "An empty bowl. {pet} sat with it quietly. Then {trainer} came back.",
    "The hunger reached zero today. {pet} was patient about it. Mostly.",
    "{pet} was forgotten for a little while. It happens. They still wagged when you returned."
  ],
  legendary_fish: [
    "{pet} watched from the shoreline as {trainer} caught {fish}. Absolutely gobsmacked.",
    "A legendary catch: {fish}! {pet} pretended not to be impressed. {pet} was very impressed.",
    "{fish}, caught today. {pet} immediately tried to befriend it.",
    "{trainer} pulled {fish} out of the water. {pet} decided this was the best day ever."
  ]
}

// Used in place of the generic random_flavor pool when the weather is known,
// so a scrapbook entry reflects the world the pet was actually in that day.
export const WEATHER_MEMORY_LINES = {
  clear: [
    "{pet} enjoyed a bright, sunny day outside with {trainer}.",
    "{pet} basked in the warm sunshine all afternoon."
  ],
  rainy: [
    "{pet} splashed happily through puddles in the rain.",
    "{pet} watched raindrops race down the window with {trainer}."
  ],
  foggy: [
    "{pet} crept curiously through the misty fog, exploring.",
    "{pet} could barely see through the thick fog, but had fun anyway."
  ],
  windy: [
    "{pet} chased leaves swirling in the wind.",
    "A gust of wind sent {pet} tumbling, much to {trainer}'s amusement!"
  ],
  starry: [
    "{pet} gazed up at the sparkling night sky with {trainer}.",
    "{pet} tried to count the stars and lost track after a hundred."
  ],
  cursed: [
    "{pet} shivered as an eerie fog rolled through... something felt off.",
    "{pet} refused to leave {trainer}'s side during the cursed weather."
  ]
}

// Ports scrapbook_getCalendarSeason(). Flavour only — deliberately unrelated to
// the separate mini-season shop rotation. Northern-hemisphere months.
export const SEASONS = [
  { id: 'spring', name: 'Spring', icon: '🌸', months: [2, 3, 4] },
  { id: 'summer', name: 'Summer', icon: '☀️', months: [5, 6, 7] },
  { id: 'fall',   name: 'Fall',   icon: '🍂', months: [8, 9, 10] },
  { id: 'winter', name: 'Winter', icon: '❄️', months: [11, 0, 1] }
]

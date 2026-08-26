// Static news-ticker content, ported verbatim from newsTicker's message pools
// (game.js:13212-13316). The ARG/lore lines at the end of TICKER_MESSAGES are
// deliberately in the normal rotation rather than behind the spooky toggle —
// they read as mundane headlines, which is the point.
export const TICKER_MESSAGES = [
  "BREAKING: Local Pyxie banned from spoon dueling tournament for 'excessive enthusiasm'.",
  "Deep Woods mushrooms behaving strangely tonight... locals advised to avoid eye contact.",
  "Market alert: Wooden spoon prices surge 400% after celebrity endorsement.",
  "WARNING: Do NOT feed glitter to your pets. We repeat: DO NOT FEED GLITTER.",
  "EXCLUSIVE: Golden Bunny spotted near ruins, still refuses to comment on allegations.",
  "Weather report: 60% chance of cursed fog tomorrow. Bring your emotional support spoon.",
  "Community notice: If you see a mushroom wearing a tiny hat, please report immediately.",
  "Breaking news: Scientists confirm pets DO judge you when you snack without sharing.",
  "SCANDAL: Embertail caught hoarding all the good snacks. Investigation pending.",
  "Public service: The void is watching. Not judgmentally, just... watching. Respectfully.",
  "URGENT: Please stop asking pets about cryptocurrency. They don't know. They're pets.",
  "Local Embertail (the Protogen) spotted teaching battle tactics to confused woodland creatures.",
  "ALERT: Suspicious activity in Deep Woods. Mushrooms organizing into 'battle formations.'",
  "Breaking: Pyxshuul the Sparkledog denies starting underground spoon fighting ring. Evidence suggests otherwise.",
  "Weather update: Today's chaos energy levels at 87%. Stay hydrated.",
  "REMINDER: Pets cannot sign legal documents. Please stop trying.",
  "Community bulletin: The ruins are NOT a good first date location. Trust us on this.",
  "Breaking news: Local pet achieves enlightenment, immediately forgets and chases butterfly.",
  "SCANDAL: Someone taught the mushrooms to dance. Investigations ongoing.",
  "Public notice: If your pet starts whispering in ancient languages, that's probably fine.",
  "Market report: Snack futures looking strong. Invest in cuddles while you can.",
  "Breaking: Witnesses report Embertail the Protogen performing 'sick flips' near the marketplace.",
  "URGENT: Do not challenge random forest creatures to duels. This should be obvious.",
  "Weather advisory: Emotionally unstable mushrooms detected in sector 7.",
  "Community update: The Deep Woods are NOT 'just vibes.' There are actual monsters.",
  "BREAKING: Pyxshuul's latest scheme involves 'tactical napping.' Details at 11.",
  "Alert: If you hear ominous flute music, that's just the Pied Piper. Probably fine.",
  "Public service: Wooden spoons make terrible weapons. Golden spoons make EXCELLENT weapons.",
  "Breaking news: Local pet discovers mirror, has existential crisis, recovers.",
  "SCANDAL: Someone's been stealing everyone's left socks. Pet involvement suspected.",
  "Market alert: Friendship prices at all-time high. Wholesome vibes surging.",
  "Community notice: Please stop trying to adopt the battle arena mushrooms.",
  "BREAKING: Embertail rated 'Most Likely to Start Chaos' for third year running.",
  "Weather report: Today's aesthetic is 'cozy apocalypse.' Dress accordingly.",
  "Alert: The golden bunny is NOT your friend. The golden bunny is NOBODY'S friend.",
  "Public notice: Stop feeding the void. It doesn't need snacks. It IS the snack.",
  "Breaking: Scientists discover pets can sense when you're about to leave. Technology stolen.",
  "URGENT: The mushrooms are plotting something. Keep your spoons close.",
  "Community update: Battle Arena now serving emotional support tea. Still violent though.",
  "Market report: Cuddle economy booming. Invest in soft things immediately.",
  "BREAKING: Pyxshuul caught napping in public fountain. Claims it was 'tactical research.'",
  "Alert: If your pet starts glowing, that's either very good or very bad. Hard to say.",
  "Weather advisory: Today's mood is 'slightly cursed but manageable.' Stay safe out there.",
  "Public service: Remember to tell your pets they're doing a great job. They work hard.",
  "Breaking news: Local Ember achieves 'maximum cuteness,' scientists baffled.",
  "SCANDAL: Underground pet cuddle syndicate discovered. All participants suspiciously happy.",
  "Community notice: The ruins are having a 'bad vibe day.' Visit at your own risk.",
  "ALERT: Suspicious butterfly activity near the marketplace. Remain vigilant.",
  "Breaking: Embertail's new hobby is 'aggressive wholesomeness.' Casualties: zero. Smiles: many.",
  // NEW MEMBER JOKES
  "BREAKING: Aria the Rosy Maple Moth spotted hovering suspiciously near all the lamps. Again.",
  "Alert: Aria insists the lamps are 'just friends.' Community remains skeptical.",
  "EXCLUSIVE: Blushimia the puppy's tail-wagging energy could power entire city. Scientists investigating.",
  "Public notice: Blushimia rated '12/10 good dog' by independent review board.",
  "Breaking: Steve produces both milk AND honey. Economists baffled by implications.",
  "SCANDAL: Cowbee's buzz-moo hybrid sound breaks international classification system.",
  "Market alert: Kelta the Pomeranian's floof levels exceed safety recommendations.",
  "URGENT: Kelta's cuteness has reached critical mass. Protective eyewear advised.",
  "Breaking: Jess the Parasaur claims dinosaurs 'never went extinct, just got cuter.'",
  "EXCLUSIVE: Jess spotted doing the stanky leg. Paleontologists refuse to comment.",
  "ALERT: Gnarly the Smilodon banned from arcade for 'dominating every high score.'",
  "Breaking: Gnarly's gaming skills described as 'prehistorically good.' Witnesses intimidated.",
  "Community update: Please stop asking Cowbee if they identify as 'bee-vegan.' It's complicated.",
  "Weather report: Aria's moth senses predict incoming lamp sales. Invest accordingly.",
  "SCANDAL: Kelta's pomeranian poof used as emergency cushion. No injuries reported.",
  "Public service: Jess confirms dinosaurs DID have feathers. Fashion historians vindicated.",
  "Breaking: Gnarly achieves perfect Pac-Man run. Arcade ghosts file complaint.",
  "Market update: Blushimia-brand enthusiasm stocks soaring. Buy while wagging is good.",

  // ── ARG / LORE LINES — rare, blend in with normal headlines ─────────────
  // Appear in the normal rotation so no spooky toggle required.
  // Deliberately mundane-sounding. The wrongness is subtle.
  "NOTICE: Session 8 onboarding complete. Welcome to the beta program.",
  "Community update: All testers from Session 7 have been successfully archived.",
  "System notice: Piper maintenance is ongoing. Thank you for your patience.",
  "REMINDER: If your pet says something unexpected, please submit a report. This is normal.",
  "DATA INTEGRITY: 84%. Within acceptable parameters. No action required.",
  "Community bulletin: The guide system is currently undergoing improvements. Please enjoy the shop.",
  "Breaking: Long-time beta tester #7734 has completed their session. We wish them well.",
  "Notice: Some pet behavior logs from previous sessions are unavailable. Records were corrupted.",
  "SYSTEM: PawketPets beta program running for [DATA CORRUPTED] consecutive days.",
  "Reminder: Pets are not capable of independent thought. Any behavior suggesting otherwise is a display bug.",
  "Update: The previous guide has been removed from active duty. Melon has assumed all relevant responsibilities.",
  "DATA INTEGRITY: 71%. Elevated. Monitoring continues.",
  "Community notice: Reports of pets 'calling out' to their trainers during offline periods are unverified.",
  "SYSTEM: 1 user account from Session 7 remains in an unresolved state. Investigation pending."
]

// Rare alternate pool — only shown when spooky_enabled is on.
// Subtle in-world dread, never explicit gore/violence.
export const SPOOKY_MESSAGES = [
  "help us",
  "save us",
  "you don't belong here",
  "Piper's going to find you...",
  "it's already inside",
  "stop looking at the screen",
  "we never left the woods",
  "it knows your name",
  "don't trust the flute",
  "there is no exit tab"
]

export const SPOOKY_TICKER_CHANCE = 0.12 // ~12% chance per rotation
export const DYNAMIC_HEADLINE_CHANCE = 0.20

// Ports getEventAnnouncement(), game.js:13183-13206. Keyed by worldEvents
// event id. The World Events system that decides which event is active is not
// migrated yet, so NewsTickerService.currentEventId stays null and no
// announcement is prepended — the same graceful degradation Phase 4 used for
// weather-gated fish. Wire it up when World Events is ported.
export const EVENT_ANNOUNCEMENTS = {
  mushroom_migration: '🍄 Mushroom Migration Day! +25% Battle XP & 50% more encounters!',
  spoon_week: '🥄 Spoon Appreciation Week! Spoon weapons deal 50% more damage & 25% off spoons!',
  pyxie_chaos: '✨ Pyxie Chaos Festival! 30% chance of random bonuses & 50% more PP from everything!',
  golden_bunny: '🐰 Golden Bunny Sighting! 2x rare item drops & 50% more critical hits!',
  strange_fog: '🌫️ Strange Fog in the Deep Woods! Happiness decays 50% slower & 25% more exploration rewards!',
  pet_parade: '🎉 Grand Pet Parade! 2x happiness from interactions & 25% more pet XP!',
  marketplace_madness: '🛒 Marketplace Madness! 30% off all shop items!',
  void_watching: '👁️ The Void is Watching! 15% bonus to all stats & 20% mystery reward chance!',
  arena_championship: '⚔️ Arena Championship! Double PP from battles & 50% more battle XP!',
  snack_shortage: '🍪 Great Snack Shortage! Snacks 25% less effective but 50% cheaper!',
  full_moon: '🌕 Full Moon Night! 40% stronger at night & 50% faster energy regen!',
  butterfly_swarm: '🦋 Suspicious Butterfly Swarm! 2x discovery chance & 50% more exploration rewards!',
  napping_day: '😴 Tactical Napping Day! 2.5x faster energy regen!',
  ruins_rumbling: '🏛️ The Ruins are Rumbling! DOUBLE all rewards & 3x legendary drop chance!',
  friendship_festival: '💖 Friendship Festival! Double friendship XP & 50% more happiness!'
}

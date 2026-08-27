// Player-title unlock thresholds, ported from checkPlayerTitleUnlocks()
// (game.js:8586-8664).
//
// Legacy wrote this as a flat run of ~25 `if (x >= n) await awardPlayerTitle(...)`
// lines grouped by rarity comment. As data it can be iterated once, and the
// duplicates below become visible instead of hiding in the middle of the list.
//
// TWO THINGS WORTH KNOWING, both carried over unchanged because they are the
// live thresholds players have been earning against:
//   • `popular` (uncommon) and `socialite` (rare) BOTH unlock at 20 friends, so
//     they always arrive together. Almost certainly one was meant to be higher.
//   • The referral tiers are not monotonic with rarity: `the_recruiter` (epic)
//     needs 10 referrals while `ambassador` (rare) needs 20.
// Legacy also listed `fighter` twice — once under COMMON and again under EPIC
// with its own "// already above" comment. The duplicate is dropped here; it
// awarded nothing the first line had not already awarded.
export const PLAYER_TITLE_UNLOCKS = [
  // ── COMMON ──
  { key: 'fighter', stat: 'wins', min: 50 },
  { key: 'pet_lover', stat: 'ownedPets', min: 3 },
  { key: 'friendly', stat: 'friendCount', min: 5 },
  { key: 'daily_player', stat: 'streak', min: 7 },

  // ── UNCOMMON ──
  { key: 'dedicated', stat: 'streak', min: 30 },
  { key: 'trainer', stat: 'totalLevel', min: 100 },
  { key: 'warrior', stat: 'wins', min: 200 },
  { key: 'collector', stat: 'ownedPets', min: 10 },
  { key: 'popular', stat: 'friendCount', min: 20 },
  { key: 'recruiter', stat: 'refs', min: 5 },
  // `night_owl` is not here: legacy awards it from checkMidnightLogin(), which
  // is a time-of-day trigger rather than a threshold.

  // ── RARE ──
  { key: 'hoarder', stat: 'ownedPets', min: 25 },
  { key: 'loyal', stat: 'streak', min: 100 },
  { key: 'champion', stat: 'wins', min: 500 },
  { key: 'socialite', stat: 'friendCount', min: 20 },
  { key: 'master_trainer', stat: 'totalLevel', min: 500 },
  { key: 'point_hoarder', stat: 'ppEarned', min: 10000 },
  { key: 'ambassador', stat: 'refs', min: 20 },

  // ── EPIC ──
  { key: 'the_reaper', stat: 'battles', min: 500 },
  { key: 'whale', stat: 'ppEarned', min: 50000 },
  { key: 'the_veteran', stat: 'totalLevel', min: 200 },
  { key: 'the_recruiter', stat: 'refs', min: 10 },

  // ── LEGENDARY ──
  { key: 'the_hardcore', stat: 'battles', min: 1000 },
  { key: 'millionaire', stat: 'ppEarned', min: 1000000 },
  { key: 'the_legendary', stat: 'refs', min: 25 }
]

export const TITLE_RARITY_COLORS = {
  common: '#8e8e8e',
  uncommon: '#5cb85c',
  rare: '#5bc0de',
  epic: '#9c27b0',
  legendary: '#ff9800'
}

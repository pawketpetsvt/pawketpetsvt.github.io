// Referral milestones, ported from REFERRAL_MILESTONES (game.js:29227).
// `badge`, `title`, `skinKeys` and `frame` name rewards owned by systems that
// are not migrated yet, so they are carried through as data and shown as the
// milestone's label/tier — nothing grants them here.
export const REFERRAL_MILESTONES = [
  { count: 1, label: 'Referral Rookie', tier: 'common', badge: 'referral_rookie', title: null, skinKeys: 0, frame: null },
  { count: 3, label: 'Triple Recruiter', tier: 'uncommon', badge: null, title: null, skinKeys: 1, frame: null },
  { count: 5, label: 'Community Builder', tier: 'rare', badge: 'recruiter', title: 'community_builder', skinKeys: 0, frame: null },
  { count: 10, label: 'Pied Piper', tier: 'rare', badge: 'ambassador', title: 'pied_piper', skinKeys: 1, frame: null },
  { count: 25, label: 'Influencer', tier: 'epic', badge: 'influencer', title: null, skinKeys: 2, frame: 'frame_sparkle-earned' },
  { count: 50, label: 'Legendary Recruiter', tier: 'legendary', badge: 'legend', title: null, skinKeys: 3, frame: 'frame_crown' }
]

// Legacy's tier palette was written for a light page background, but these
// labels only ever render inside `.referral-card` — a dark blue→purple
// gradient. `common` (#8e8e8e) and `epic` (#9c27b0) were effectively invisible
// against it. Lightened to keep the tier colour-coding legible where it is
// actually used; the hues are unchanged.
export const MILESTONE_TIER_COLORS = {
  common: '#d5d5d5',    // was #8e8e8e
  uncommon: '#7ee87e',  // was #5cb85c
  rare: '#7ddcf5',      // was #5bc0de
  epic: '#dc9bec',      // was #9c27b0
  legendary: '#ffc061'  // was #ff9800
}

// FOUR different referral rewards exist across the legacy codebase, and no two
// agree:
//   • the Home card's own copy and its PP-earned sum ....... 200 (referrer)
//   • the same card's second reward row ................... 100 (referee)
//   • GAME_CONSTANTS.REFERRAL_PP_REWARD ................... 250, never read
//   • processReferral(), the path that actually RAN ....... 250 referrer, 0 referee
//
// CORRECTION to the note that stood here through Phase 8b: it said "nothing in
// game.js actually awards referral PP". That was checked against the trimmed
// game.js on this branch, not against `main`. On the deployed site
// processReferral() does award — 250 PP to the referrer via
// award_pp_to_user_secure, and nothing at all to the referee — and it was live,
// called from the adoption flow (main:3205). A second live path,
// initReferralSystem(), separately fired a `referral_increment` RPC keyed by
// USERNAME. Both call sites were inside blocks deleted in Phase 1/6.75.
//
// ReferralService now runs ONE path and pays the figures below, which are the
// ones the card shows the player. Paying 250/0 instead would leave the page
// promising rewards it does not give.
export const REFERRER_PP = 200
export const REFEREE_PP = 100

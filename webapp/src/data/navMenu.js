// The site's page navigation, in ONE place.
//
// Legacy carried this list twice — once in the desktop left sidebar and again,
// hand-copied, in `#mobile-nav-menu` (index.html:2004-2094) — with the two
// already out of sync by the time they were read: the mobile copy had Housing
// ("My Room"), Weekly Challenges and a Give Feedback link that the desktop one
// never had, and the desktop one carried entries the mobile copy omitted.
// Duplicating a menu is how a page becomes reachable at one width and not the
// other, so LeftSidebar and MobileNav both render from these arrays.
//
// `tab` is the route path segment AND the `AppState.tabKey` used for active
// highlighting — they were deliberately made 1:1 in Phase 1.

export const NAV_GROUPS = [
  {
    key: 'pets', icon: '🐾', label: 'Pets',
    items: [
      { tab: 'adopt', icon: '🐣', label: 'Adopt' },
      { tab: 'mypets', icon: '💖', label: 'My Pets' },
      { tab: 'journal', icon: '📓', label: 'Pet Journal' }
    ]
  },
  {
    key: 'games', icon: '🎮', label: 'Games',
    items: [
      { tab: 'minigames', icon: '🕹️', label: 'Minigames' },
      { tab: 'fishing', icon: '🎣', label: 'Fishing' },
      { tab: 'racing', icon: '🏁', label: 'Racing' },
      { tab: 'cooking', icon: '🍳', label: 'Cooking' }
    ]
  },
  {
    key: 'community', icon: '🌐', label: 'Community',
    items: [
      { tab: 'guild', icon: '🏛️', label: 'Guild' },
      { tab: 'friends', icon: '👥', label: 'Friends' },
      { tab: 'leaderboard', icon: '🏆', label: 'Leaderboard' },
      { tab: 'forum', icon: '💬', label: 'Forum' },
      { tab: 'stats', icon: '📊', label: 'Statistics' }
    ]
  },
  {
    key: 'more', icon: '✨', label: 'More',
    items: [
      { tab: 'twitch', icon: '🎬', label: 'Twitch' },
      { tab: 'redeem', icon: '🎟️', label: 'Redeem' },
      { tab: 'news', icon: '📰', label: 'News' },
      { tab: 'team', icon: '👥', label: 'Team' },
      { tab: 'settings', icon: '⚙️', label: 'Settings' },
      { tab: 'privacy', icon: '🔒', label: 'Privacy Policy' }
    ]
  }
]

// Rendered above the groups.
export const NAV_HOME = { tab: 'home', icon: '🏠', label: 'Home' }

// Rendered below the groups, outside any collapsible section — matching the
// order legacy used in both menus.
export const NAV_STANDALONE = [
  { tab: 'battle', icon: '⚔️', label: 'Battle Arena' },
  { tab: 'shop', icon: '🛍️', label: 'Shop' },
  // Legacy's DESKTOP sidebar had no Housing entry at all — the tab was
  // reachable only from My Profile's "View My Room" button and from the mobile
  // menu, where it sat beside My Profile. Listing it here gives it a home at
  // both widths.
  { tab: 'housing', icon: '🏠', label: 'My Room' }
]

// Mobile only. On desktop these live in the navbar's right-hand cluster, which
// mobile drops for space — so the drawer has to carry them or they become
// unreachable on a phone. Legacy's mobile menu did exactly this.
export const NAV_MOBILE_ACCOUNT = [
  { tab: 'myprofile', icon: '👤', label: 'My Profile' }
]

import { reactive } from 'vue'

export const AppState = reactive({
  user: null,
  player: null,
  petCatalog: [],
  ownedPetIds: [],
  ownedPets: [],
  inventory: [],
  tabKey: 'home',
  sidebarStats: { petCount: 0, itemCount: 0, streak: 0 },
  notifications: [],
  unreadNotificationCount: 0,
  friendRequestCount: 0,
  // The mobile nav drawer. Lives here rather than in either component because
  // the hamburger that opens it is in NavBar while the drawer itself is
  // teleported out of AppShell — they have no parent/child relationship to
  // pass a prop through.
  mobileNavOpen: false,
  // The right-hand drawer, holding the navbar controls that are hidden below
  // 992px. Separate from mobileNavOpen so opening one closes nothing by
  // accident; NavBar closes the other when either opens.
  mobileChromeOpen: false,
  // Which LeftSidebar nav group is expanded. Shared rather than local to the
  // sidebar because the tutorial has to open the group containing a tab before
  // it can highlight that tab's button — legacy did the same through a global
  // navGroupOpen().
  navOpenGroup: null
})

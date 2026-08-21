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
  unreadNotificationCount: 0
})

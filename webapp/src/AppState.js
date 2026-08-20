import { reactive } from 'vue'

export const AppState = reactive({
  user: null,
  player: null,
  petCatalog: [],
  ownedPetIds: [],
  ownedPets: [],
  inventory: []
})

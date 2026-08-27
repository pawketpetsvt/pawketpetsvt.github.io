<template>
  <div class="page-wrap">
    <div class="page-hero">
      <div class="sparkle-row">💖 ✦ 💖</div>
      <h1>My Pets</h1>
      <p>Feed them, play with them, and watch them grow! ✨</p>
    </div>
    <PointsBanner :points="points" />

    <div v-if="loading" class="spinner"></div>
    <div v-else-if="!AppState.ownedPets.length" class="empty-state">
      <div class="empty-icon">🐾</div>
      <h2>No pets yet!</h2>
      <p>Head to the adoption centre!</p>
      <router-link to="/adopt" class="btn btn-primary btn-lg">🐣 Adopt a Pet</router-link>
    </div>
    <!-- Two per row from md up (one on narrow screens). Replaces the global
         `.pets-grid` auto-fill track, which produced ~250px columns — too
         narrow for the card's 120px avatar and 1.8rem nickname, so its
         contents spilled outside the card. -->
    <div v-else class="row row-cols-1 row-cols-md-2 g-4">
      <div v-for="pet in AppState.ownedPets" :key="pet.id" class="col">
        <PetCard :pet="pet" :inventory="AppState.inventory" :discoveries="discoveries"
          :is-exploring="exploringPetIds.includes(pet.id)"
          @manage-skills="open('skills', pet)"
          @manage-equipment="open('equipment', pet)"
          @allocate-stats="open('stats', pet)"
          @manage-variant="open('variant', pet)"
          @manage-room="open('room', pet)"
          @snapshot="snapshotComingSoon" />
      </div>
    </div>

    <!-- One modal instance for the whole page rather than one per card. -->
    <SkillLoadoutModal v-if="modal === 'skills'" :pet="modalPet" @close="close" />
    <EquipmentModal v-if="modal === 'equipment'" :pet="modalPet" @close="close" @changed="refreshPets" />
    <StatPointsModal v-if="modal === 'stats'" :pet="modalPet" @close="close" />
    <VariantModal v-if="modal === 'variant'" :pet="modalPet" @close="close" />
    <PetRoomModal v-if="modal === 'room'" :pet="modalPet" @close="close" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { AppState } from '../AppState.js'
import { playerService } from '../services/PlayerService.js'
import { ownedPetsService } from '../services/OwnedPetsService.js'
import { inventoryService } from '../services/InventoryService.js'
import { journalService } from '../services/JournalService.js'
import { petCosmeticsService } from '../services/PetCosmeticsService.js'
import { supabase } from '../services/SupabaseService.js'
import { toastService } from '../services/ToastService.js'
import PointsBanner from '../components/PointsBanner.vue'
import PetCard from '../components/PetCard.vue'
import SkillLoadoutModal from '../components/pet/SkillLoadoutModal.vue'
import EquipmentModal from '../components/pet/EquipmentModal.vue'
import StatPointsModal from '../components/pet/StatPointsModal.vue'
import VariantModal from '../components/pet/VariantModal.vue'
import PetRoomModal from '../components/pet/PetRoomModal.vue'
import { furnitureService } from '../services/FurnitureService.js'

const loading = ref(true)
const discoveries = ref({})
const exploringPetIds = ref([])

// Which pet-card modal is open, and for which pet.
const modal = ref(null)
const modalPet = ref(null)

function open(which, pet) {
  modalPet.value = pet
  modal.value = which
}

function close() {
  modal.value = null
  modalPet.value = null
}

// Equipping changes the battle stats the cards display, so reload after it.
async function refreshPets() {
  await ownedPetsService.getMyPets(AppState.user.id)
}

function snapshotComingSoon() {
  toastService.info('Snapshot cards arrive with the sharing system — coming soon!')
}

const points = computed(() => AppState.player ? AppState.player.pawketpoints : 0)

// The daily-login streak reward is now shown once at the app-shell level
// (AppShell.vue, via StreakService + ModalService) rather than per-page.
onMounted(async () => {
  await playerService.getPlayer(AppState.user.id)
  await inventoryService.getInventory(AppState.user.id)
  await ownedPetsService.getMyPets(AppState.user.id)
  discoveries.value = await journalService.loadDiscoveries(AppState.user.id)
  // Title catalogue + unlocks and the active companion, loaded once for the
  // whole page rather than per card.
  await petCosmeticsService.load(AppState.user.id)
  await petCosmeticsService.loadCompanion(AppState.user.id)

  // Pets away on an unclaimed expedition get a "🧭 Exploring" pip, matching the
  // legacy card. A failure here just means no pips — never a blocked page.
  try {
    const res = await supabase.from('expeditions')
      .select('pet_id').eq('user_id', AppState.user.id).eq('claimed', false)
    exploringPetIds.value = (res.data || []).map(r => r.pet_id)
  } catch (e) {
    exploringPetIds.value = []
  }

  loading.value = false
})
</script>

<style lang="scss" scoped>
.empty-state {
  text-align: center;
  padding: 60px 40px;
  background: var(--white);
  border: 2.5px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 6px 24px var(--shadow);
}

.empty-icon {
  font-size: 3.5rem;
  margin-bottom: 16px;
}
</style>

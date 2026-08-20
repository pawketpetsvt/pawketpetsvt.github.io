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
    <div v-else class="pets-grid">
      <PetCard v-for="pet in AppState.ownedPets" :key="pet.id" :pet="pet" :inventory="AppState.inventory" />
    </div>

    <div class="modal-overlay" :class="{ show: bonusInfo }">
      <div class="modal" v-if="bonusInfo">
        <div class="bonus-coins">🪙</div>
        <h2>Daily Bonus!</h2>
        <p>Welcome back! You earned <strong>{{ bonusInfo.amount }} PP</strong> for logging in today!</p>
        <p class="hint">Come back tomorrow for another bonus! ✨</p>
        <button class="btn btn-primary btn-lg" @click="bonusInfo = null">✨ Awesome!</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { AppState } from '../AppState.js'
import { playerService } from '../services/PlayerService.js'
import { ownedPetsService } from '../services/OwnedPetsService.js'
import { inventoryService } from '../services/InventoryService.js'
import PointsBanner from '../components/PointsBanner.vue'
import PetCard from '../components/PetCard.vue'

const loading = ref(true)
const bonusInfo = ref(null)

const points = computed(() => AppState.player ? AppState.player.pawketpoints : 0)

onMounted(async () => {
  await playerService.getPlayer(AppState.user.id)
  const bonus = await playerService.checkDailyBonus(AppState.user.id)
  if (bonus.awarded) bonusInfo.value = bonus
  await inventoryService.getInventory(AppState.user.id)
  await ownedPetsService.getMyPets(AppState.user.id)
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

.bonus-coins {
  font-size: 3.5rem;
  margin-bottom: 8px;
  animation: bonus-bounce 0.6s ease infinite alternate;
}

@keyframes bonus-bounce {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-10px);
  }
}
</style>

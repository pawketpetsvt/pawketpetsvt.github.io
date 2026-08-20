<template>
  <div class="page-wrap">
    <div class="page-hero">
      <div class="sparkle-row">🐣 ✦ 🐣</div>
      <h1>Adopt a Pet!</h1>
      <p>Choose a VTuber pet to add to your collection. Your first pet is always free! ✨</p>
    </div>
    <PointsBanner :points="points" />

    <div v-if="loading" class="spinner"></div>
    <p v-else-if="loadError" class="load-error">Could not load pets.</p>
    <div v-else class="pets-grid">
      <div v-for="pet in AppState.petCatalog" :key="pet.id" class="pet-card" :class="{ placeholder: pet.isPlaceholder, 'already-owned': isOwned(pet.id) }">
        <div class="pet-image-wrap">
          <img v-if="pet.image_file && !pet.isPlaceholder && !imgErrors[pet.id]" :src="'/images/' + pet.image_file" :alt="pet.name" @error="imgErrors[pet.id] = true" />
          <span v-else class="pet-image-placeholder">{{ pet.isPlaceholder ? '❓' : '🐾' }}</span>
        </div>
        <div class="pet-name">{{ pet.isPlaceholder ? '???' : pet.name }}</div>
        <div v-if="pet.vtuber_name && !pet.isPlaceholder" class="pet-vtuber">🎭 {{ pet.vtuber_name }}</div>
        <div class="pet-description">{{ pet.isPlaceholder ? 'A mystery pet shrouded in shadow... who could it be? 👀' : pet.description }}</div>
        <span v-if="!pet.isPlaceholder" class="pet-price" :class="{ free: effectivePrice(pet) === 0 }">
          {{ effectivePrice(pet) === 0 ? '✨ FREE' : '🪙 ' + pet.price + ' PP' }}
        </span>
        <button v-if="pet.isPlaceholder" class="btn-locked">🔒 Coming Soon</button>
        <button v-else-if="isOwned(pet.id)" class="btn-owned">✅ Already Adopted!</button>
        <button v-else-if="points < effectivePrice(pet)" class="btn-locked">Need {{ pet.price }} PP</button>
        <button v-else class="btn btn-primary btn-adopt" @click="openAdoptModal(pet)">🐣 Adopt!</button>
      </div>
    </div>

    <div class="modal-overlay" :class="{ show: selectedPet }">
      <div class="modal" v-if="selectedPet">
        <div class="modal-image">
          <img v-if="selectedPet.image_file && !modalImgError" :src="'/images/' + selectedPet.image_file" :alt="selectedPet.name" @error="modalImgError = true" />
          <span v-else>🐾</span>
        </div>
        <h2>Adopt {{ selectedPet.name }}?</h2>
        <p>{{ effectivePrice(selectedPet) === 0 ? 'Your first pet is free! Give them a nickname. 🎉' : 'This will cost ' + selectedPet.price + ' PawketPoints.' }}</p>
        <div class="modal-nickname-group">
          <label>Nickname <span class="hint">(or leave blank to use their name)</span></label>
          <input type="text" v-model="nickname" placeholder="e.g. Ember the Brave" maxlength="30" @keydown.enter.prevent />
        </div>
        <div class="modal-buttons">
          <button class="btn btn-outline" @click="closeModal">Cancel</button>
          <button class="btn btn-primary" :disabled="adopting" @click="confirmAdopt">{{ adopting ? 'Adopting...' : '💖 Adopt!' }}</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" :class="{ show: successMessage }">
      <div class="modal" v-if="successMessage">
        <div class="modal-celebrate">🎉</div>
        <h2>Welcome home!</h2>
        <p>{{ successMessage }}</p>
        <div class="modal-buttons">
          <button class="btn btn-outline" @click="successMessage = ''">Adopt More</button>
          <router-link to="/my-pets" class="btn btn-primary">💖 My Pets</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { AppState } from '../AppState.js'
import { petsService } from '../services/PetsService.js'
import { playerService } from '../services/PlayerService.js'
import { ownedPetsService } from '../services/OwnedPetsService.js'
import { showToast } from '../utils/Toast.js'
import PointsBanner from '../components/PointsBanner.vue'

const loading = ref(true)
const loadError = ref(false)
const imgErrors = reactive({})
const modalImgError = ref(false)
const selectedPet = ref(null)
const nickname = ref('')
const adopting = ref(false)
const successMessage = ref('')

const points = computed(() => AppState.player ? AppState.player.pawketpoints : 0)
const totalOwnedCount = computed(() => AppState.ownedPetIds.length)

function isOwned(petId) {
  return AppState.ownedPetIds.includes(petId)
}

function effectivePrice(pet) {
  return totalOwnedCount.value === 0 ? 0 : pet.price
}

function openAdoptModal(pet) {
  selectedPet.value = pet
  modalImgError.value = false
  nickname.value = ''
}

function closeModal() {
  selectedPet.value = null
}

async function confirmAdopt() {
  if (!selectedPet.value) return
  adopting.value = true
  const pet = selectedPet.value
  const price = effectivePrice(pet)
  const finalNickname = nickname.value.trim() || pet.name
  try {
    await ownedPetsService.adopt(pet, finalNickname, price)
    closeModal()
    successMessage.value = finalNickname + ' has joined your collection! 💖'
  } catch (err) {
    showToast('Error: ' + err.message)
  } finally {
    adopting.value = false
  }
}

onMounted(async () => {
  try {
    await playerService.getPlayer(AppState.user.id)
    await ownedPetsService.getOwnedPetIds(AppState.user.id)
    await petsService.getCatalog()
  } catch (err) {
    loadError.value = true
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
.load-error {
  text-align: center;
  color: var(--text-light);
}

.modal-celebrate {
  font-size: 4rem;
  margin-bottom: 12px;
}
</style>

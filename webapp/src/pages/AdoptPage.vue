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
    <!-- Was the global `.pets-grid` auto-fill track (minmax 240px, 24px gap);
         now Bootstrap's grid with the same effective column counts. -->
    <div v-else class="row row-cols-2 row-cols-md-3 g-4">
      <div v-for="pet in AppState.petCatalog" :key="pet.id" class="col">
        <div
          class="pet-card h-100"
          :ref="el => setPetCardRef(pet, el)"
          :class="{
            placeholder: pet.isPlaceholder,
            'already-owned': isOwned(pet.id),
            'streamer-landing-highlight': highlightedPetName === pet.name
          }"
        >
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
          <router-link to="/mypets" class="btn btn-primary">💖 My Pets</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { AppState } from '../AppState.js'
import { petsService } from '../services/PetsService.js'
import { playerService } from '../services/PlayerService.js'
import { ownedPetsService } from '../services/OwnedPetsService.js'
import { toastService } from '../services/ToastService.js'
import PointsBanner from '../components/PointsBanner.vue'
import { streamerLandingService } from '../services/StreamerLandingService.js'
import { REFEREE_PP } from '../data/referralData.js'

const loading = ref(true)
const loadError = ref(false)
const imgErrors = reactive({})
const modalImgError = ref(false)
const selectedPet = ref(null)
const nickname = ref('')
const adopting = ref(false)
const successMessage = ref('')

// Ports the streamer-landing highlight from loadAdoptTab() (main:3027): a
// visitor who arrived through `?streamer=` gets that streamer's pet highlighted
// and scrolled into view for four seconds.
const highlightedPetName = ref('')
const petCardEls = new Map()

function setPetCardRef(pet, el) {
  if (el) petCardEls.set(pet.name, el)
  else petCardEls.delete(pet.name)
}

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
    const { referrer } = await ownedPetsService.adopt(pet, finalNickname, price)
    closeModal()
    successMessage.value = finalNickname + ' has joined your collection! 💖'
    // Legacy toasted this from awardReferralRewards; the referral is only
    // credited now, on the first adoption, so this is the first chance to say so.
    if (referrer) {
      toastService.success(
        '🎁 Welcome! You earned ' + REFEREE_PP + ' PP from ' + referrer + "'s referral!"
      )
    }
  } catch (err) {
    toastService.error('Error: ' + err.message)
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

  const suggested = streamerLandingService.suggestedFirstPet()
  if (!suggested) return
  await nextTick()
  const match = AppState.petCatalog.find(
    p => p.name && p.name.toLowerCase() === suggested.toLowerCase()
  )
  if (!match) return
  highlightedPetName.value = match.name
  const el = petCardEls.get(match.name)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  setTimeout(() => { highlightedPetName.value = '' }, 4000)
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

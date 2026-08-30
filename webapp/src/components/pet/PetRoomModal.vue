<template>
  <!-- Ports furniture_openRoom() / furniture_renderRoomModal(). This is the
       PER-PET room: a flat list of up to 8 items backed by `pet_rooms`, whose
       only mechanic is a daily happiness bonus. It is a different system from
       the Housing tab's positioned player room — see roomData.js. -->
  <PetModal :title="`🏠 ${petName}'s Room`" :subtitle="subtitle" width="520px" @close="$emit('close')">
    <div v-if="loading" class="text-center py-3"><div class="spinner"></div></div>

    <template v-else>
      <div class="pr-desc rounded-3 py-tight px-px14 mb-px14">📝 {{ description }}</div>

      <div class="pr-bonus d-flex align-items-center justify-content-between rounded-2 py-2 px-px14 mb-px14">
        <span class="pr-bonus-label">✨ Daily Happiness Bonus</span>
        <span class="pr-bonus-value">+{{ totalBonus }} happiness</span>
      </div>

      <div class="pr-section-label">🪑 In Room ({{ equipped.length }}/{{ ROOM_MAX_ITEMS }}):</div>
      <div class="mb-3">
        <p v-if="!equippedItems.length" class="pr-empty">Nothing here yet. Equip some furniture!</p>
        <div v-for="f in equippedItems" :key="f.id" class="pr-row">
          <span class="pr-emoji">{{ f.emoji }}</span>
          <span class="pr-name flex-grow-1 min-w-0">{{ f.name }}</span>
          <span class="pr-per-day">+{{ f.happiness_bonus }}/day</span>
          <button class="btn btn-sm btn-outline pr-btn" :disabled="busy" @click="unequip(f.id)">Unequip</button>
        </div>
      </div>

      <div class="pr-section-label">📦 In Storage:</div>
      <div class="mb-3">
        <p v-if="!storage.length" class="pr-empty">No furniture in storage.</p>
        <div v-for="f in storage" :key="f.id" class="pr-row">
          <span class="pr-emoji">{{ f.emoji }}</span>
          <span class="pr-name pr-muted flex-grow-1 min-w-0">{{ f.name }}</span>
          <span class="pr-per-day">+{{ f.happiness_bonus }}/day</span>
          <span v-if="isFull" class="pr-full flex-shrink-0">Room full</span>
          <button v-else class="btn btn-sm btn-primary pr-btn" :disabled="busy" @click="equip(f.id)">Equip</button>
        </div>
      </div>

      <router-link to="/shop" class="btn btn-outline w-100 pr-shop" @click="$emit('close')">
        🛒 Buy More Furniture
      </router-link>
    </template>
  </PetModal>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import PetModal from './PetModal.vue'
import { furnitureService } from '../../services/FurnitureService.js'
import { toastService } from '../../services/ToastService.js'
import { ROOM_MAX_ITEMS } from '../../data/roomData.js'

const props = defineProps({
  pet: { type: Object, required: true }
})
defineEmits(['close'])

const equipped = ref([])
const loading = ref(true)
const busy = ref(false)
const description = ref('')

const petName = computed(() => props.pet.nickname || 'Your pet')
const subtitle = computed(() => 'Furniture is shared — one purchase works in every pet\'s room.')

const equippedItems = computed(() => equipped.value.map(id => furnitureService.byId(id)).filter(Boolean))
const storage = computed(() => furnitureService.ownedItems().filter(f => !equipped.value.includes(f.id)))
const totalBonus = computed(() => equippedItems.value.reduce((s, f) => s + (f.happiness_bonus || 0), 0))
const isFull = computed(() => equipped.value.length >= ROOM_MAX_ITEMS)

// Regenerated after every change, since it names the items currently in the room.
function refreshDescription() {
  description.value = furnitureService.describeRoom(petName.value, equippedItems.value)
}

async function load() {
  loading.value = true
  try {
    await furnitureService.load()
    const room = await furnitureService.getPetRoom(props.pet.id)
    equipped.value = room.furniture_list || []
    refreshDescription()
  } catch (e) {
    toastService.error('Could not load the room.')
  } finally {
    loading.value = false
  }
}

async function equip(furnitureId) {
  busy.value = true
  try {
    equipped.value = await furnitureService.equipToPet(props.pet.id, equipped.value, furnitureId)
    refreshDescription()
  } catch (err) {
    toastService.error(err.message)
  } finally {
    busy.value = false
  }
}

async function unequip(furnitureId) {
  busy.value = true
  try {
    equipped.value = await furnitureService.unequipFromPet(props.pet.id, equipped.value, furnitureId)
    refreshDescription()
  } catch (err) {
    toastService.error(err.message)
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
// This modal was built entirely from inline styles in legacy — none of its
// classes exist in the global stylesheet — so all of it is owned here.
.pr-desc {
  background: rgba(153, 102, 255, 0.06);
  font-size: 0.85rem;
  color: var(--purple-dark);
  line-height: 1.6;
  font-style: italic;
}

.pr-bonus {
  background: rgba(93, 222, 122, 0.1);
}

.pr-bonus-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--purple-dark);
}

.pr-bonus-value {
  font-size: 1.1rem;
  font-weight: 800;
  color: #5dde7a;
}

.pr-section-label {
  font-weight: 700;
  font-size: 0.82rem;
  color: var(--purple-dark);
  margin-bottom: 8px;
}

.pr-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(153, 102, 255, 0.08);
}

.pr-emoji { font-size: 1.2rem; }

.pr-name {
  font-size: 0.82rem;
  color: var(--purple-dark);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-muted { color: var(--text-light); }

.pr-per-day {
  font-size: 0.75rem;
  color: #5dde7a;
  font-weight: 600;
  flex-shrink: 0;
}

.pr-full {
  font-size: 0.72rem;
  color: #ff6b6b;
}

.pr-btn {
  font-size: 0.72rem;
  padding: 3px 8px;
  flex-shrink: 0;
}

.pr-empty {
  color: var(--text-light);
  font-style: italic;
  font-size: 0.83rem;
  margin: 0;
}

.pr-shop {
  font-size: 0.85rem;
  text-decoration: none;
}
</style>

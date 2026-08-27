<template>
  <!-- Ports racing_petSelectorHtml(), shared by every racing sub-tab.

       Legacy re-triggers `loadMyPets()` from inside the renderer when its pet
       cache is cold, then re-renders the whole tab. The pets live in AppState
       here, so the page loads them once and this just reads them. -->
  <div>
    <p v-if="!pets.length" class="rps-empty">
      No pets yet — <router-link to="/adopt">adopt one</router-link> to start racing!
    </p>

    <div v-else class="rps-row">
      <button
        v-for="pet in pets"
        :key="pet.id"
        class="rps-pet"
        :class="{ 'rps-selected': pet.id === modelValue }"
        @click="$emit('update:modelValue', pet.id)"
      >
        <img v-if="imageFor(pet)" :src="imageFor(pet)" alt="" class="rps-avatar" @error="hide" />
        {{ pet.nickname || (pet.species && pet.species.name) || 'Pet' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { AppState } from '../../AppState.js'

defineProps({
  modelValue: { type: String, default: null }
})
defineEmits(['update:modelValue'])

const pets = computed(() => AppState.ownedPets || [])

// `/images/` + image_file — the column carries its own subpath. Legacy splits
// the filename off and prepends `images/pets/`, which double-nests the folder;
// that is the same bug Phase 6 found on public profiles.
function imageFor(pet) {
  const file = pet.species && pet.species.image_file
  return file ? '/images/' + file : null
}

function hide(e) { e.target.style.display = 'none' }
</script>

<style lang="scss" scoped>
.rps-empty {
  text-align: center;
  color: var(--text-light);
}

.rps-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.rps-pet {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 2.5px solid var(--border);
  border-radius: 12px;
  background: var(--white);
  font-family: Fredoka, sans-serif;
  font-size: 0.88rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;

  &.rps-selected {
    border-color: var(--purple);
    background: rgba(153, 102, 255, 0.15);
    font-weight: 700;
  }
}

.rps-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}
</style>

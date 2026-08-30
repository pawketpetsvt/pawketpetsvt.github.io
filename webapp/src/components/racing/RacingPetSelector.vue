<template>
  <!-- Ports racing_petSelectorHtml(), shared by every racing sub-tab.

       Legacy re-triggers `loadMyPets()` from inside the renderer when its pet
       cache is cold, then re-renders the whole tab. The pets live in AppState
       here, so the page loads them once and this just reads them. -->
  <div>
    <p v-if="!pets.length" class="rps-empty text-center">
      No pets yet — <router-link to="/adopt">adopt one</router-link> to start racing!
    </p>

    <div v-else class="d-flex flex-wrap gap-px10 mb-3">
      <button
        v-for="pet in pets"
        :key="pet.id"
        class="rps-pet d-inline-flex align-items-center gap-px6 px-px14 py-2 rounded-3"
        :class="{ 'rps-selected': pet.id === modelValue }"
        @click="$emit('update:modelValue', pet.id)"
      >
        <img v-if="imageFor(pet)" :src="imageFor(pet)" alt="" class="rps-avatar rounded-circle" @error="hide" />
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
// Layout and spacing are Bootstrap's; only the chip's visual treatment remains.
.rps-empty { color: var(--text-light); }

.rps-pet {
  border: 2.5px solid var(--border);
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

// A fixed avatar size, not a spacing step — `rounded-circle` supplies the shape.
.rps-avatar {
  width: 24px;
  height: 24px;
  object-fit: cover;
}
</style>

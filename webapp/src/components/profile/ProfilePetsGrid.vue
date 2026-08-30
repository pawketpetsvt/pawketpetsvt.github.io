<template>
  <div v-if="!pets.length" class="empty-note text-center p-4">
    <p>No pets yet! 🐾</p>
  </div>
  <div v-else class="row row-cols-2 row-cols-md-3 row-cols-lg-4 g-3">
    <div v-for="p in decorated" :key="p.id" class="col">
      <div class="pf-pet-card h-100 overflow-hidden rounded-4">
        <div class="pf-pet-image d-flex align-items-center justify-content-center">
          <img
            v-if="p.imageFile && !imgErrors[p.id]"
            :src="'/images/' + p.imageFile"
            :alt="p.displayName"
            @error="imgErrors[p.id] = true"
          />
          <span v-else class="pf-pet-image-fallback">🐾</span>
        </div>
        <div class="px-3 py-2">
          <div class="pf-pet-top d-flex align-items-center justify-content-between gap-2">
            <h3>{{ p.displayName }}</h3>
            <span class="pf-pet-level flex-shrink-0">Lv {{ p.level }}</span>
          </div>
          <div
            class="pf-pet-mood d-flex align-items-center gap-2 mt-2 px-2 py-1 rounded-3"
            :style="{ borderColor: p.mood.color, background: p.mood.color + '22' }"
          >
            <span class="pf-pet-mood-emoji">{{ p.mood.emoji }}</span>
            <span>Mood: {{ p.mood.mood }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { getPetMood } from '../../utils/petMood.js'

const props = defineProps({
  pets: { type: Array, required: true }
})

// `image_file` already carries its own subpath (e.g. "pets/cy.png"), so only
// "/images/" gets prepended — matching PetCard.vue/AdoptPage.vue. Legacy's
// profile grid (game.js:11869) prepends "images/pets/" instead, which
// double-nests the folder and 404s for every pet.
const imgErrors = ref({})

const decorated = computed(() =>
  props.pets.map(up => ({
    id: up.id,
    level: up.level,
    displayName: up.nickname || (up.pets ? up.pets.name : 'Pet'),
    imageFile: up.pets ? up.pets.image_file : '',
    mood: getPetMood(up.hunger, up.energy, up.happiness, up.max_hunger, up.max_energy, up.max_happiness)
  }))
)
</script>

<style lang="scss" scoped>
// Layout via Bootstrap utilities in the template; visuals only here.
.pf-pet-card {
  border: 1px solid var(--border);
  background: var(--card-bg, #fff);
}

.pf-pet-image {
  aspect-ratio: 1;
  background: rgba(153, 102, 255, 0.06);

  img {
    max-width: 100%;
    max-height: 100%;
  }
}

.pf-pet-image-fallback {
  font-size: 2.4rem;
  opacity: 0.5;
}

.pf-pet-top h3 {
  margin: 0;
  font-size: 0.9rem;
  color: var(--purple-dark);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pf-pet-level {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--purple);
}

.pf-pet-mood {
  border: 1px solid;
  font-size: 0.72rem;
}

.pf-pet-mood-emoji {
  font-size: 1.1rem;
}

.empty-note {
  color: var(--text-light);
}
</style>

<template>
  <div v-if="!pets.length" class="empty-note">
    <p>No pets yet! 🐾</p>
  </div>
  <div v-else class="pf-pets-grid">
    <div v-for="p in decorated" :key="p.id" class="pf-pet-card">
      <div class="pf-pet-image">
        <img
          v-if="p.imageFile && !imgErrors[p.id]"
          :src="'/images/' + p.imageFile"
          :alt="p.displayName"
          @error="imgErrors[p.id] = true"
        />
        <span v-else class="pf-pet-image-fallback">🐾</span>
      </div>
      <div class="pf-pet-body">
        <div class="pf-pet-top">
          <h3>{{ p.displayName }}</h3>
          <span class="pf-pet-level">Lv {{ p.level }}</span>
        </div>
        <div class="pf-pet-mood" :style="{ borderColor: p.mood.color, background: p.mood.color + '22' }">
          <span class="pf-pet-mood-emoji">{{ p.mood.emoji }}</span>
          <span>Mood: {{ p.mood.mood }}</span>
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
.pf-pets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.pf-pet-card {
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  background: var(--card-bg, #fff);
}

.pf-pet-image {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
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

.pf-pet-body {
  padding: 10px 12px;
}

.pf-pet-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  h3 {
    margin: 0;
    font-size: 0.9rem;
    color: var(--purple-dark);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.pf-pet-level {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--purple);
  flex-shrink: 0;
}

.pf-pet-mood {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 4px 8px;
  border: 1px solid;
  border-radius: 10px;
  font-size: 0.72rem;
}

.pf-pet-mood-emoji {
  font-size: 1.1rem;
}

.empty-note {
  text-align: center;
  padding: 24px;
  color: var(--text-light);
}
</style>

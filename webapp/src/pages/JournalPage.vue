<template>
  <div class="page-wrap">
    <div class="page-hero">
      <div class="sparkle-row">📓 ✦ 📓</div>
      <h1>Pet Journal</h1>
      <p>Discover your pets' favorite foods, hobbies, and secrets! ✨</p>
    </div>

    <div v-if="loading" class="spinner"></div>

    <div v-else-if="!ownedJournalTypes.length" class="empty-state">
      <div class="empty-icon">📓</div>
      <h2>No pets to journal yet!</h2>
      <p>Adopt a pet to start discovering their favorite foods, hobbies, and secrets.</p>
      <router-link to="/adopt" class="btn btn-primary btn-lg">🐣 Adopt a Pet</router-link>
    </div>

    <div v-else class="journal-book">
      <div class="journal-controls">
        <button class="journal-nav-btn" :disabled="page === 0" @click="changePage(-1)">← Previous</button>
        <span class="journal-page-indicator">Page {{ page + 1 }} of {{ ownedJournalTypes.length }}</span>
        <button class="journal-nav-btn" :disabled="page === ownedJournalTypes.length - 1" @click="changePage(1)">Next →</button>
      </div>

      <div class="journal-page">
        <div class="journal-pet-header">
          <div class="journal-pet-image" :style="{ backgroundImage: 'url(/images/pets/' + petImage + ')', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }"></div>
          <div class="journal-pet-name">{{ petType }}</div>
        </div>

        <div v-if="!prefs" style="text-align:center;padding:40px;color:var(--text-light);">No data available for this pet.</div>
        <template v-else>
          <div v-for="entry in JOURNAL_ENTRIES" :key="entry.key" class="journal-entry">
            <div class="journal-entry-label">{{ entry.icon }} {{ entry.label }}:</div>
            <div v-if="entry.key === 'catchphrase' && discoveries.catchphrase" class="journal-entry-value journal-catchphrase">"{{ prefs.catchphrase }}"</div>
            <div v-else-if="discoveries[entry.key]" class="journal-entry-value">{{ prefs[entry.valueField] }}</div>
            <div v-else class="journal-entry-value">
              <span class="journal-entry-unknown" :title="JOURNAL_ENTRY_HINTS[entry.key]">???</span>
              <span style="font-size:0.68rem;color:var(--text-light);display:block;margin-top:2px;font-style:italic;">💡 {{ JOURNAL_ENTRY_HINTS[entry.key] }}</span>
            </div>
          </div>

          <div style="text-align:center;margin-top:30px;padding:15px;background:rgba(153,102,255,0.2);border-radius:12px;">
            <strong>Discovery Progress:</strong> {{ discoveredCount }} / 10
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { AppState } from '../AppState.js'
import { journalService } from '../services/JournalService.js'
import { ownedPetsService } from '../services/OwnedPetsService.js'
import { JOURNAL_PET_TYPES, PET_IMAGE_MAP, PET_FOOD_PREFERENCES, JOURNAL_ENTRY_HINTS, JOURNAL_ENTRIES } from '../data/petJournalData.js'

const loading = ref(true)
const page = ref(0)
const allDiscoveries = ref({})
const ownedJournalTypes = ref([])

const petType = computed(() => ownedJournalTypes.value[page.value])
const petImage = computed(() => PET_IMAGE_MAP[petType.value] || petType.value.toLowerCase() + '.png')
const prefs = computed(() => PET_FOOD_PREFERENCES[petType.value] || null)
const discoveries = computed(() => allDiscoveries.value[petType.value] || {})
const discoveredCount = computed(() => Object.keys(discoveries.value).length)

function changePage(delta) {
  page.value = Math.min(Math.max(page.value + delta, 0), ownedJournalTypes.value.length - 1)
}

onMounted(async () => {
  await ownedPetsService.getMyPets(AppState.user.id)
  const ownedSpecies = new Set(AppState.ownedPets.map(p => p.species.name))
  ownedJournalTypes.value = JOURNAL_PET_TYPES.filter(t => ownedSpecies.has(t))

  allDiscoveries.value = await journalService.loadDiscoveries(AppState.user.id)
  loading.value = false
})
</script>

<style lang="scss" scoped>
// .journal-controls' border/spacing (root style.css) was authored assuming
// it sits BELOW the journal-page content, separating them with a border-top.
// It's now positioned above instead (see template), so flip the border to
// the bottom edge and mirror the spacing to match.
.journal-controls {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid rgba(139, 69, 19, 0.3);
}
</style>

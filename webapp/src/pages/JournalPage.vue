<template>
  <div class="page-wrap container-fluid position-relative z-1 pb-page">
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
      <div class="journal-controls mt-0 pt-0 pb-gap">
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
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.journal-book {
  max-width: 700px;
  margin: 30px auto;
  background: linear-gradient(135deg, #d4b896 0%, #c9a885 100%); /* DARKER paper color */
  border: 6px solid #8B4513;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  position: relative;
}
.journal-book::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 20px;
  bottom: 20px;
  width: 2px;
  background: transparent; /* REMOVED: Brown line */
  transform: translateX(-50%);
}
.journal-page {
  min-height: 500px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.95); /* MORE OPAQUE white background */
  border-radius: 8px;
}
.journal-pet-header {
  text-align: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid var(--purple);
}
.journal-pet-image {
  width: 120px;
  height: 120px;
  margin: 0 auto 15px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}
.journal-pet-name {
  font-size: 2rem;
  color: var(--purple);
  font-family: 'Chewy', cursive;
}
.journal-entry {
  margin: 20px 0;
  padding: 15px;
  background: rgba(255, 255, 255, 0.95); /* SOLID white entries for contrast */
  border-left: 4px solid var(--purple);
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); /* Subtle shadow for depth */
}
.journal-entry-label {
  font-weight: 700;
  color: var(--purple-dark);
  margin-bottom: 5px;
  font-size: 0.95rem;
}
.journal-entry-value {
  color: var(--text);
  font-size: 1.1rem;
  font-weight: 500; /* Slightly bolder text */
}
.journal-entry-unknown {
  color: #999; /* Darker gray for ??? */
  font-style: italic;
  font-weight: normal;
}
.journal-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 2px solid rgba(139, 69, 19, 0.3);
}
.journal-nav-btn {
  background: linear-gradient(135deg, var(--purple) 0%, var(--pink) 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}
.journal-nav-btn:hover { transform: scale(1.05); }
.journal-nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.journal-page-indicator {
  font-weight: 600;
  color: var(--purple-dark);
}
body.night-mode .journal-book {
  background: linear-gradient(135deg, #2a1a3a 0%, #1e1228 100%) !important;
  border-color: #8B6914 !important;
  box-shadow: 0 10px 40px rgba(0,0,0,0.5) !important;
}
body.night-mode .journal-page {
  background: rgba(42,36,64,0.95) !important;
  color: #e8d5ff !important;
}
body.night-mode .journal-entry {
  background: rgba(30,20,50,0.85) !important;
  border-left: 4px solid #ffa502 !important;
  color: #e8d5ff !important;
}
body.night-mode .journal-entry-label { color: #ffcc66 !important; }
body.night-mode .journal-entry-value { color: #e8d5ff !important; }
body.night-mode .journal-entry-unknown { color: #b399dd !important; }
body.night-mode .journal-pet-name { color: #ffcc66 !important; }
body.night-mode .journal-catchphrase { color: #b589ff !important; font-style: italic; }

// .journal-controls' border/spacing (the global stylesheet) was authored assuming
// it sits BELOW the journal-page content, separating them with a border-top.
// It's now positioned above instead (see template), so flip the border to
// the bottom edge and mirror the spacing to match.
.journal-controls {
  border-top: none;
  margin-bottom: 30px;
  border-bottom: 2px solid rgba(139, 69, 19, 0.3);
}
</style>

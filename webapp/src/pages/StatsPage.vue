<template>
  <div class="page-wrap">
    <div class="page-hero">
      <div class="sparkle-row">📊 ✦ 📊</div>
      <h1>Statistics</h1>
      <p>Track your progress and see community achievements! 🌍</p>
    </div>

    <div v-if="loading" class="spinner"></div>

    <template v-else>
      <h2 class="st-section-title">📊 Your Statistics</h2>
      <div class="row row-cols-2 row-cols-md-3 row-cols-xl-4 g-3">
        <div v-for="c in personal.cards" :key="c.label" class="col">
          <div class="st-card h-100 text-center p-3 rounded-4">
            <div class="st-icon">{{ c.icon }}</div>
            <div class="st-value">{{ c.value.toLocaleString() }}</div>
            <div class="st-label">{{ c.label }}</div>
            <div v-if="c.sub" class="st-sub">{{ c.sub }}</div>
          </div>
        </div>
        <div class="col">
          <div class="st-card h-100 text-center p-3 rounded-4">
            <div class="st-icon">📅</div>
            <div class="st-value st-value-date">{{ personal.memberSince }}</div>
            <div class="st-label">Member Since</div>
          </div>
        </div>
      </div>

      <h2 class="st-section-title">🌍 Community Statistics</h2>
      <div class="d-flex flex-column gap-2">
        <div
          v-for="s in community"
          :key="s.key"
          class="st-row d-flex align-items-center justify-content-between gap-2 px-3 py-2 rounded-3"
        >
          <span class="st-row-label">{{ s.label }}</span>
          <span class="st-row-value">{{ s.value.toLocaleString() }}</span>
        </div>
      </div>

      <div class="st-footer text-center mt-5 p-gap rounded-4">
        <p>🎮 Keep playing to improve your stats!</p>
        <p class="st-footer-sub">Adopt more pets, catch more fish, and log in daily to climb the leaderboards!</p>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { AppState } from '../AppState.js'
import { statsService } from '../services/StatsService.js'
import { toastService } from '../services/ToastService.js'

const loading = ref(true)
const personal = ref({ cards: [], memberSince: 'N/A' })
const community = ref([])

onMounted(async () => {
  try {
    const [p, c] = await Promise.all([
      statsService.loadPersonalStats(AppState.user.id),
      statsService.loadCommunityStats()
    ])
    personal.value = p
    community.value = c
  } catch (err) {
    toastService.error('Failed to load statistics')
  }
  loading.value = false
})
</script>

<style lang="scss" scoped>
.st-section-title {
  font-size: 1.15rem;
  color: var(--purple-dark);
  margin: 24px 0 12px;
}

// Layout (grid, spacing, centering, radius) is expressed with Bootstrap
// utilities in the template; only the visual identity lives here.
.st-card {
  border: 1px solid var(--border);
  background: rgba(153, 102, 255, 0.05);
}

.st-icon {
  font-size: 1.8rem;
}

.st-value {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--purple);
  margin-top: 4px;
}

.st-value-date {
  font-size: 1.05rem;
}

.st-label {
  font-size: 0.76rem;
  color: var(--text-light);
  margin-top: 2px;
}

.st-sub {
  font-size: 0.68rem;
  color: var(--text-light);
  margin-top: 4px;
  opacity: 0.85;
}

.st-row {
  border: 1px solid var(--border);
  background: var(--card-bg, #fff);
}

.st-row-label {
  font-size: 0.85rem;
}

.st-row-value {
  font-weight: 700;
  color: var(--purple);
}

.st-footer {
  background: rgba(153, 102, 255, 0.06);
}

.st-footer-sub {
  color: var(--text-light);
  font-size: 0.85rem;
  margin-top: 6px;
}
</style>

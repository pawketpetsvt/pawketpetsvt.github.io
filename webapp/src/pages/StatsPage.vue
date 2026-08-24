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
      <div class="st-grid">
        <div v-for="c in personal.cards" :key="c.label" class="st-card">
          <div class="st-icon">{{ c.icon }}</div>
          <div class="st-value">{{ c.value.toLocaleString() }}</div>
          <div class="st-label">{{ c.label }}</div>
          <div v-if="c.sub" class="st-sub">{{ c.sub }}</div>
        </div>
        <div class="st-card">
          <div class="st-icon">📅</div>
          <div class="st-value st-value-date">{{ personal.memberSince }}</div>
          <div class="st-label">Member Since</div>
        </div>
      </div>

      <h2 class="st-section-title">🌍 Community Statistics</h2>
      <div class="st-list">
        <div v-for="s in community" :key="s.key" class="st-row">
          <span class="st-row-label">{{ s.label }}</span>
          <span class="st-row-value">{{ s.value.toLocaleString() }}</span>
        </div>
      </div>

      <div class="st-footer">
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

.st-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.st-card {
  padding: 18px 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  text-align: center;
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

.st-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.st-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
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
  margin-top: 30px;
  padding: 24px;
  border-radius: 14px;
  background: rgba(153, 102, 255, 0.06);
  text-align: center;
}

.st-footer-sub {
  color: var(--text-light);
  font-size: 0.85rem;
  margin-top: 6px;
}
</style>

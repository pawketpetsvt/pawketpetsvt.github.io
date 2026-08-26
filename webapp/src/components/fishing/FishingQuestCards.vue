<template>
  <div class="quest-card px-3 py-3 mb-3 rounded-4">
    <div class="quest-title mb-1">🐟 Melon's Weekly Request <span class="quest-count">({{ questDone }}/3 found)</span></div>
    <div class="quest-desc mb-2">Bring Melon these fish before the week ends. Reward: <strong>+300 PP</strong></div>
    <div class="d-flex flex-wrap gap-2">
      <span
        v-for="f in targets"
        :key="f.id"
        class="quest-chip px-2 py-1 rounded-pill"
        :class="{ got: questProgress[f.id] }"
      >{{ f.emoji }} {{ f.name }}{{ questProgress[f.id] ? ' ✓' : '' }}</span>
    </div>
    <div v-if="questClaimed" class="quest-claimed mt-2">✅ Quest complete this week!</div>
  </div>

  <div class="daily-card px-3 py-2 mb-3 rounded-4">
    <div class="daily-title">📅 Daily Challenge</div>
    <div class="daily-desc mb-1">{{ challenge.label }} <span class="daily-reward">+{{ challenge.reward }} PP</span></div>
    <div class="d-flex align-items-center gap-2">
      <div class="daily-progress-track flex-grow-1 overflow-hidden rounded-pill">
        <div class="daily-progress-fill rounded-pill" :class="{ done: dailyClaimed }" :style="{ width: dailyPct + '%' }"></div>
      </div>
      <span class="daily-progress-label">{{ dailyClaimed ? '✅ Done' : dailyProgress + '/' + challenge.target }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { AppState } from '../../AppState.js'
import { fishingService } from '../../services/FishingService.js'

// The parent remounts this component (via a :key bump) after a catch
// updates localStorage progress, so these computeds re-derive fresh.
// questClaimed/dailyClaimed are server-checked (see FishingService's
// isQuestClaimed/isDailyClaimed) rather than read from localStorage, so
// they're fetched once on mount instead of being plain computeds.
const targets = computed(() => fishingService.getWeeklyTargets())
const questProgress = computed(() => fishingService.getQuestProgress(AppState.user.id))
const questDone = computed(() => targets.value.filter(f => questProgress.value[f.id]).length)
const questClaimed = ref(false)

const challenge = computed(() => fishingService.getTodayChallenge())
const dailyProgress = computed(() => fishingService.getDailyProgress(AppState.user.id))
const dailyClaimed = ref(false)
const dailyPct = computed(() => Math.min(100, Math.round((dailyProgress.value / challenge.value.target) * 100)))

onMounted(async () => {
  questClaimed.value = await fishingService.isQuestClaimed()
  dailyClaimed.value = await fishingService.isDailyClaimed()
})
</script>

<style lang="scss" scoped>
// Layout via Bootstrap utilities in the template; visuals only here.
.quest-card {
  background: linear-gradient(135deg, rgba(153, 102, 255, 0.08), rgba(255, 102, 204, 0.06));
  border: 1px solid rgba(153, 102, 255, 0.2);
}

.quest-title {
  font-weight: 700;
  font-size: 0.88rem;
}

.quest-count {
  font-weight: 400;
  font-size: 0.75rem;
  color: var(--text-light);
}

.quest-desc {
  font-size: 0.78rem;
  color: var(--text-light);
}

.quest-chip {
  font-size: 0.78rem;
  background: rgba(0, 0, 0, 0.05);
  border: 1px solid var(--border);
  color: var(--text);

  &.got {
    background: rgba(93, 222, 122, 0.15);
    border-color: rgba(93, 222, 122, 0.4);
    color: #27ae60;
  }
}

.quest-claimed {
  font-size: 0.75rem;
  color: #27ae60;
}

.daily-card {
  background: rgba(255, 159, 67, 0.06);
  border: 1px solid rgba(255, 159, 67, 0.25);
}

.daily-title {
  font-weight: 700;
  font-size: 0.85rem;
}

.daily-desc {
  font-size: 0.82rem;
}

.daily-reward {
  color: var(--purple);
  font-weight: 700;
}

.daily-progress-track {
  background: rgba(0, 0, 0, 0.08);
  height: 6px;
}

.daily-progress-fill {
  background: #ff9f43;
  height: 100%;
  transition: width 0.4s;

  &.done {
    background: #5dde7a;
  }
}

.daily-progress-label {
  font-size: 0.72rem;
  color: var(--text-light);
}
</style>

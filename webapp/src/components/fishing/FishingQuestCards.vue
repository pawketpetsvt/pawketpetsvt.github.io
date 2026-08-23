<template>
  <div class="quest-card">
    <div class="quest-title">🐟 Melon's Weekly Request <span class="quest-count">({{ questDone }}/3 found)</span></div>
    <div class="quest-desc">Bring Melon these fish before the week ends. Reward: <strong>+300 PP</strong></div>
    <div class="quest-chips">
      <span v-for="f in targets" :key="f.id" class="quest-chip" :class="{ got: questProgress[f.id] }">{{ f.emoji }} {{ f.name }}{{ questProgress[f.id] ? ' ✓' : '' }}</span>
    </div>
    <div v-if="questClaimed" class="quest-claimed">✅ Quest complete this week!</div>
  </div>

  <div class="daily-card">
    <div class="daily-title">📅 Daily Challenge</div>
    <div class="daily-desc">{{ challenge.label }} <span class="daily-reward">+{{ challenge.reward }} PP</span></div>
    <div class="daily-progress-row">
      <div class="daily-progress-track">
        <div class="daily-progress-fill" :class="{ done: dailyClaimed }" :style="{ width: dailyPct + '%' }"></div>
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
.quest-card {
  background: linear-gradient(135deg, rgba(153, 102, 255, 0.08), rgba(255, 102, 204, 0.06));
  border: 1px solid rgba(153, 102, 255, 0.2);
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 14px;
}

.quest-title {
  font-weight: 700;
  font-size: 0.88rem;
  margin-bottom: 6px;
}

.quest-count {
  font-weight: 400;
  font-size: 0.75rem;
  color: var(--text-light);
}

.quest-desc {
  font-size: 0.78rem;
  color: var(--text-light);
  margin-bottom: 8px;
}

.quest-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.quest-chip {
  padding: 4px 10px;
  border-radius: 20px;
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
  margin-top: 8px;
}

.daily-card {
  background: rgba(255, 159, 67, 0.06);
  border: 1px solid rgba(255, 159, 67, 0.25);
  border-radius: 14px;
  padding: 12px 16px;
  margin-bottom: 14px;
}

.daily-title {
  font-weight: 700;
  font-size: 0.85rem;
  margin-bottom: 4px;
}

.daily-desc {
  font-size: 0.82rem;
  margin-bottom: 6px;
}

.daily-reward {
  color: var(--purple);
  font-weight: 700;
}

.daily-progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.daily-progress-track {
  flex: 1;
  background: rgba(0, 0, 0, 0.08);
  border-radius: 20px;
  height: 6px;
  overflow: hidden;
}

.daily-progress-fill {
  background: #ff9f43;
  height: 100%;
  border-radius: 20px;
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

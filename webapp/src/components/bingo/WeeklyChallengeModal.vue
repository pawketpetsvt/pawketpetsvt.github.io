<template>
  <PetModal
    title="📋 Weekly Challenges"
    :subtitle="`${doneCount}/${weeklyState.challenges.length} complete this week`"
    width="520px"
    @close="$emit('close')"
  >
    <div v-if="!weeklyState.loaded" class="spinner"></div>

    <template v-else>
      <div v-for="ch in weeklyState.challenges" :key="ch.id" class="wc-row" :class="{ done: weeklyState.claimed[ch.id] }">
        <div class="d-flex align-items-center gap-2 mb-1">
          <span class="wc-emoji">{{ ch.emoji }}</span>
          <span class="wc-label flex-fill min-w-0">{{ ch.label }}</span>
          <span class="wc-reward">+{{ ch.reward }} PP</span>
        </div>
        <div class="wc-bar rounded-5 overflow-hidden"><div class="wc-fill h-100 rounded-5" :style="{ width: pct(ch) + '%' }"></div></div>
        <div class="wc-count mt-1">
          <template v-if="weeklyState.claimed[ch.id]">✅ Complete</template>
          <template v-else-if="!tracked(ch)">
            {{ progress(ch) }}/{{ ch.target }} · not yet tracked
          </template>
          <template v-else>{{ progress(ch) }}/{{ ch.target }}</template>
        </div>
      </div>

      <div class="wc-legend mt-tight text-center">
        Finish all {{ weeklyState.challenges.length }} for a
        <strong>+{{ WEEKLY_ALL_COMPLETE_PP }} PP</strong> bonus. Challenges reset each week.
      </div>
    </template>
  </PetModal>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import PetModal from '../pet/PetModal.vue'
import { weeklyChallengeService, weeklyState } from '../../services/WeeklyChallengeService.js'
import { WEEKLY_ALL_COMPLETE_PP } from '../../data/weeklyChallengeData.js'

defineEmits(['close'])

// Four of the twelve pool entries measure something the task bus does not
// announce yet, so their bar would sit at zero with no explanation. The row
// says so rather than looking broken — see TASK_TO_STAT in the service.
const UNTRACKED = ['wk_skills_used', 'wk_boss_fights', 'wk_untouchable', 'wk_fish_rare', 'wk_fish_caught']
const tracked = ch => !UNTRACKED.includes(ch.stat)

const progress = ch => weeklyState.progress[ch.stat] || 0
const pct = ch => Math.min(100, Math.round((progress(ch) / ch.target) * 100))
const doneCount = computed(() => Object.keys(weeklyState.claimed).length)

onMounted(() => { if (!weeklyState.loaded) weeklyChallengeService.load() })
</script>

<style lang="scss" scoped>
.wc-row {
  border: 2px solid var(--border);
  border-radius: 12px;
  padding: 10px 12px;
  margin-bottom: 8px;

  &.done {
    border-color: #5dde7a;
    background: rgba(93, 222, 122, 0.08);
  }
}

.wc-emoji { font-size: 1.1rem; }
.wc-label { font-size: 0.85rem; font-weight: 700; color: var(--purple-dark); }
.wc-reward { font-size: 0.75rem; color: #e6a800; font-weight: 700; }

.wc-bar {
  background: rgba(153, 102, 255, 0.12);
  height: 6px;
}

.wc-fill {
  background: linear-gradient(90deg, #9966ff, #ff66cc);
}

.wc-count {
  font-size: 0.7rem;
  color: var(--text-light);
}

.wc-legend {
  font-size: 0.75rem;
  color: var(--text-light);
  line-height: 1.6;
}
</style>

<template>
  <!-- Ports community_refreshUI()'s card list (game.js:36487-36542). Hidden
       entirely when no goal is running, as legacy's container is. -->
  <section v-if="communityState.goals.length" class="cg-panel mb-3">
    <div class="cg-header mb-tight">🌍 Community Goals</div>

    <div v-for="goal in communityState.goals" :key="goal.id" class="cg-goal">
      <div class="cg-title">{{ goal.title }}</div>
      <div class="cg-narrative mt-1 mb-2">{{ svc.narrative(goal) }}</div>

      <div class="cg-bar rounded-5 overflow-hidden">
        <div class="cg-fill h-100 rounded-5" :style="{ width: svc.percent(goal) + '%' }"></div>
      </div>
      <div class="cg-meta d-flex justify-content-between mt-1">
        <span>{{ (goal.current_progress || 0).toLocaleString() }} / {{ goal.goal_target.toLocaleString() }}</span>
        <span v-if="goal.ends_at">Ends {{ endsAt(goal) }}</span>
      </div>

      <div class="cg-reward mt-px6">🎁 {{ svc.rewardText(goal) }}</div>

      <button
        v-if="svc.isComplete(goal)"
        class="btn btn-primary btn-sm w-100 mt-2"
        :disabled="svc.isClaimed(goal) || busy === goal.id"
        @click="claim(goal)"
      >
        {{ svc.isClaimed(goal) ? '✅ Reward claimed' : '🎉 Claim Reward' }}
      </button>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { communityGoalService, communityState } from '../../services/CommunityGoalService.js'
import { toastService } from '../../services/ToastService.js'

const svc = communityGoalService
const busy = ref(null)

onMounted(() => communityGoalService.loadGoals())

function endsAt(goal) {
  return new Date(goal.ends_at).toLocaleDateString()
}

async function claim(goal) {
  busy.value = goal.id
  try {
    const reward = await communityGoalService.claim(goal)
    toastService.success('🎉 Reward claimed: ' + reward)
  } catch (err) {
    toastService.error(err.message)
  }
  busy.value = null
}
</script>

<style lang="scss" scoped>
// style.css carries `.com-*` rules for legacy's markup, but they are keyed to a
// per-goal class (`.com-progress-<goal_key>`) that only its string-built HTML
// produced. This owns its own styling rather than reviving that scheme.
.cg-panel {
  background: var(--white);
  border: 2px solid var(--border);
  // 16px radius (`rounded-4` is 14px) and an 18px horizontal inset — neither
  // has an exact utility, so the shorthand stays rather than drifting.
  border-radius: 16px;
  padding: 16px 18px;
}

.cg-header {
  font-weight: 800;
  color: var(--purple-dark);
}

// An adjacent-sibling divider: the spacing depends on position, which no
// utility can express.
.cg-goal + .cg-goal {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed var(--border);
}

.cg-title {
  font-weight: 700;
  color: var(--purple-dark);
  font-size: 0.92rem;
}

.cg-narrative {
  font-size: 0.8rem;
  color: var(--text-light);
  font-style: italic;
  line-height: 1.5;
}

// 10px is the bar's drawn thickness, not a spacing step.
.cg-bar {
  background: rgba(153, 102, 255, 0.15);
  height: 10px;
}

.cg-fill {
  background: linear-gradient(90deg, var(--purple), var(--pink));
  transition: width 0.4s ease;
}

.cg-meta {
  font-size: 0.72rem;
  color: var(--text-light);
}

.cg-reward {
  font-size: 0.78rem;
  color: #e6a800;
  font-weight: 600;
}
</style>

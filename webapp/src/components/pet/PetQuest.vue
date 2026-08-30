<template>
  <!-- Ports personality_renderQuestWidget() (game.js:25397). Renders nothing
       when the pet is not on an arc, exactly as legacy's empty innerHTML did. -->
  <div v-if="quest" class="pq-widget rounded-3 px-tight py-px10 my-2">
    <div class="pq-title mb-1">
      📖 Quest: {{ quest.arc.name || 'Adventure' }} (Day {{ quest.day }}/{{ ARC_DAYS }})
    </div>
    <div class="pq-hint mb-px6">{{ hint }}</div>
    <div class="pq-bar rounded-5 overflow-hidden">
      <div class="pq-fill h-100 rounded-5" :style="{ width: pct + '%' }"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { questService, questState } from '../../services/QuestService.js'

const props = defineProps({
  petId: { type: [String, Number], required: true }
})

const ARC_DAYS = 3

const quest = computed(() => {
  const q = questState.byPet[props.petId]
  return q && !q.completed ? q : null
})

// LEGACY BUG: the widget prints `Day (day-1)/3`, so a pet that has just been
// given a quest shows "Day 0/3" and one on its final step shows "Day 2/3" — the
// third day is never displayed. `day` is already 1-based (assignQuestArc sets
// it to 1), and only the PROGRESS BAR should use day-1. Shown as `day` here.
const hint = computed(() => questService.todaysHint(props.petId))
const pct = computed(() => questService.percent(props.petId))
</script>

<style lang="scss" scoped>
// Legacy built this widget inline; there is no `.quest-*` rule in the global stylesheet.
.pq-widget {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.08), rgba(153, 102, 255, 0.06));
  border: 1px solid rgba(255, 215, 0, 0.25);
}

.pq-title {
  font-weight: 700;
  font-size: 0.82rem;
  color: var(--purple-dark);
}

.pq-hint {
  font-size: 0.75rem;
  color: var(--text-light);
}

// 6px is the bar's drawn thickness, not a spacing step.
.pq-bar {
  background: rgba(255, 215, 0, 0.12);
  height: 6px;
}

.pq-fill {
  background: linear-gradient(90deg, #ffd700, #ffa500);
  transition: width 0.4s ease;
}
</style>

<template>
  <!-- Ports personality_renderWidget() (game.js:3837-3872) — the daily mood
       banner and its three wishes. Legacy built this as an innerHTML blob
       injected into a mount point after the card rendered; here it's a normal
       child that loads its own data. -->
  <div v-if="mood" class="pp-wishes rounded-3 py-px10 px-tight my-2 mx-0">
    <div class="d-flex align-items-center gap-px6 mb-px6">
      <span class="pp-wishes-icon">{{ def.icon }}</span>
      <span class="pp-wishes-label">{{ def.label }} Mood</span>
      <span v-if="allDone" class="pp-wishes-done ms-auto py-px2 px-2 rounded-5">ALL DONE! 🎉</span>
    </div>

    <div class="pp-wishes-line mb-2">{{ def.line }}</div>
    <div class="pp-wishes-title mb-1">📋 Today's Wishes:</div>

    <div v-for="wish in mood.wishes" :key="wish.key" class="pp-wish-row d-flex align-items-center gap-2">
      <span class="pp-wish-mark">{{ isDone(wish) ? '✅' : '🔘' }}</span>
      <span class="pp-wish-text" :class="{ 'pp-wish-struck': isDone(wish) }">
        {{ def.icon }} <em>{{ petName }}</em> {{ wish.text }}
      </span>
      <span class="pp-wish-reward ms-auto">+{{ wish.reward }} PP</span>
    </div>

    <div v-if="allDone && !mood.rewardClaimed" class="pp-wishes-bonus mt-2 py-px6 px-px10 rounded-1">
      🎁 Bonus ready: +100 PP, complete a wish to claim!
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { petMoodService, moodState } from '../services/PetMoodService.js'

const props = defineProps({
  petId: { type: String, required: true },
  petName: { type: String, default: 'Your pet' }
})

const mood = computed(() => moodState.byPet[props.petId] || null)
const def = computed(() => petMoodService.personalityDef(mood.value?.personality))
const allDone = computed(() =>
  !!mood.value && mood.value.completedWishes.length >= mood.value.wishes.length
)

function isDone(wish) {
  return mood.value.completedWishes.includes(wish.key)
}

// Loaded per card rather than in bulk, matching legacy's async-after-render
// behaviour — a slow mood fetch never delays the pet card itself.
onMounted(() => petMoodService.load(props.petId))
</script>

<style lang="scss" scoped>
.pp-wishes {
  background: linear-gradient(135deg, rgba(153, 102, 255, 0.08), rgba(255, 102, 204, 0.05));
  border: 1px solid rgba(153, 102, 255, 0.2);
}

.pp-wishes-icon { font-size: 1.2rem; }

.pp-wishes-label {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--purple-dark);
}

.pp-wishes-done {
  background: #5dde7a;
  color: var(--white);
  font-size: 0.7rem;
  font-weight: 700;
}

.pp-wishes-line {
  font-size: 0.78rem;
  color: var(--text-light);
  font-style: italic;
}

.pp-wishes-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--purple);
}

.pp-wish-row {
  padding: 5px 0;
  border-bottom: 1px solid rgba(153, 102, 255, 0.08);
}

.pp-wish-mark { font-size: 1rem; }

.pp-wish-text {
  font-size: 0.8rem;
  color: var(--purple-dark);

  &.pp-wish-struck {
    color: #aaa;
    text-decoration: line-through;
  }
}

.pp-wish-reward {
  font-size: 0.75rem;
  color: var(--purple);
  font-weight: 600;
}

.pp-wishes-bonus {
  background: rgba(93, 222, 122, 0.15);
  font-size: 0.78rem;
  color: #2d8a4e;
  font-weight: 600;
}
</style>

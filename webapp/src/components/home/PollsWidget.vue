<template>
  <!-- Ports pollSystem.renderWidget(). Legacy shows the two soonest-ending
       polls inline and pushes the rest into a modal; voting happens right on
       the option here, so the widget's own "Vote Now" button — which only ever
       opened a modal showing the same options — is not reproduced. -->
  <div v-if="pollState.loaded && polls.length" class="polls-widget">
    <div class="polls-widget-header">
      🗳️ Community Polls <span class="polls-badge">{{ pollState.polls.length }}</span>
    </div>

    <div v-for="poll in polls" :key="poll.id" class="poll-widget-item">
      <div class="poll-widget-question">{{ poll.question }}</div>
      <div class="poll-widget-timer mb-2">⏰ {{ timeLeft(poll.ends_at) }}</div>

      <button
        v-for="(opt, idx) in (poll.options || [])"
        :key="idx"
        class="poll-option pw-option d-block w-100 text-start"
        :class="{ 'poll-option-chosen': isChosen(poll, idx) }"
        :disabled="voted(poll) || busy"
        @click="cast(poll.id, idx)"
      >
        <div class="poll-option-label">
          {{ opt.icon || '' }} {{ opt.text }}
          <template v-if="isChosen(poll, idx)"> ✓ Your vote</template>
        </div>
        <div v-if="voted(poll)" class="pw-bar mt-px6 rounded-5 overflow-hidden">
          <div class="pw-bar-fill h-100 rounded-5" :style="{ width: pollService.percent(poll, idx) + '%' }"></div>
        </div>
      </button>

      <p v-if="!voted(poll)" class="pw-reward mt-px6 mb-0">Vote to earn +25 PP</p>
    </div>

    <p v-if="pollState.polls.length > polls.length" class="pw-more mt-px10 mb-0 text-center">
      +{{ pollState.polls.length - polls.length }} more poll{{ pollState.polls.length - polls.length === 1 ? '' : 's' }} running
    </p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { pollService, pollState } from '../../services/PollService.js'

const busy = ref(false)

// Legacy shows at most two inline; the rest live behind a "view all" modal.
const polls = computed(() => pollState.polls.slice(0, 2))

const voted = (poll) => pollService.hasVoted(poll.id)
const isChosen = (poll, idx) => pollState.votes[poll.id] === idx

// Ports polls_timeRemaining().
function timeLeft(endsAt) {
  const ms = new Date(endsAt).getTime() - Date.now()
  if (ms <= 0) return 'Ended'
  const days = Math.floor(ms / 86400000)
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'} left`
  const hours = Math.floor(ms / 3600000)
  if (hours >= 1) return `${hours} hour${hours === 1 ? '' : 's'} left`
  const mins = Math.max(1, Math.floor(ms / 60000))
  return `${mins} minute${mins === 1 ? '' : 's'} left`
}

async function cast(pollId, idx) {
  busy.value = true
  try {
    await pollService.vote(pollId, idx)
  } finally {
    busy.value = false
  }
}

onMounted(() => pollService.load())
</script>

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.polls-widget {
  background: var(--cream, #fff9ff);
  border: 2px solid var(--border, #cc99ff);
  border-radius: 16px;
  padding: 16px;
}
.polls-widget-header {
  font-weight: 700;
  font-size: 1rem;
  color: var(--purple, #9966ff);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.polls-badge {
  background: var(--purple, #9966ff);
  color: white;
  border-radius: 20px;
  padding: 1px 8px;
  font-size: 0.8rem;
}
.poll-widget-item {
  border-top: 1px solid var(--border, #cc99ff);
  padding-top: 12px;
  margin-top: 12px;
}
.poll-widget-item:first-of-type { border-top: none; padding-top: 0; margin-top: 0; }
.poll-widget-question { font-weight: 600; font-size: 0.9rem; margin-bottom: 4px; }
.poll-widget-timer { font-size: 0.78rem; color: var(--text-light, #888); margin-bottom: 8px; }
.poll-option {
  padding: 8px 12px;
  border: 1.5px solid var(--border, #cc99ff);
  border-radius: 10px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: all 0.15s;
  font-size: 0.85rem;
}
.poll-option:hover { background: rgba(153,102,255,0.08); border-color: var(--purple, #9966ff); }
.poll-option-chosen { background: rgba(153,102,255,0.12); border-color: var(--purple, #9966ff); font-weight: 600; }
.poll-option-label { margin-bottom: 4px; }
body.night-mode .polls-widget { background: rgba(42,36,64,0.9); border-color: #6644aa; }
body.night-mode .poll-option { border-color: #6644aa; }
body.night-mode .poll-option:hover { background: rgba(153,102,255,0.15); }
body.night-mode .poll-widget-question, body.night-mode .poll-option-label { color: #e8d5ff; }

// `.polls-widget`, `.polls-widget-header`, `.polls-badge` and `.poll-option`
// are owned by the global stylesheet. `.poll-widget-item`, `.poll-widget-question` and
// `.poll-widget-timer` have no rule anywhere — legacy relied on `.poll-option`
// alone and left the rest unstyled — so they live here, as do the result bars.
// The only structural rule left: an adjacent-sibling divider, which Bootstrap
// has no utility for — the spacing is conditional on position, not on the
// element itself.
.poll-widget-item + .poll-widget-item {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.poll-widget-question {
  font-weight: 700;
  font-size: 0.88rem;
  color: var(--purple-dark);
}

.poll-widget-timer {
  font-size: 0.72rem;
  color: var(--text-light);
}

// `.poll-option` is a <button> here rather than a clickable div, so the
// browser's own button chrome has to be neutralised.
.pw-option {
  font: inherit;
  color: inherit;
  cursor: pointer;

  &:disabled { cursor: default; }
}

// 6px is the bar's drawn thickness, not a spacing step.
.pw-bar {
  height: 6px;
  background: rgba(153, 102, 255, 0.12);
}

.pw-bar-fill {
  background: linear-gradient(90deg, #9966ff, #ff66cc);
  transition: width 0.4s;
}

.pw-reward {
  font-size: 0.72rem;
  color: var(--text-light);
}

.pw-more {
  font-size: 0.75rem;
  color: var(--text-light);
}
</style>

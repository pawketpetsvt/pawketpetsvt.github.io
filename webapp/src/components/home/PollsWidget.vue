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
      <div class="poll-widget-timer">⏰ {{ timeLeft(poll.ends_at) }}</div>

      <button
        v-for="(opt, idx) in (poll.options || [])"
        :key="idx"
        class="poll-option pw-option"
        :class="{ 'poll-option-chosen': isChosen(poll, idx) }"
        :disabled="voted(poll) || busy"
        @click="cast(poll.id, idx)"
      >
        <div class="poll-option-label">
          {{ opt.icon || '' }} {{ opt.text }}
          <template v-if="isChosen(poll, idx)"> ✓ Your vote</template>
        </div>
        <div v-if="voted(poll)" class="pw-bar">
          <div class="pw-bar-fill" :style="{ width: pollService.percent(poll, idx) + '%' }"></div>
        </div>
      </button>

      <p v-if="!voted(poll)" class="pw-reward">Vote to earn +25 PP</p>
    </div>

    <p v-if="pollState.polls.length > polls.length" class="pw-more">
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
// `.polls-widget`, `.polls-widget-header`, `.polls-badge` and `.poll-option`
// are owned by style.css. `.poll-widget-item`, `.poll-widget-question` and
// `.poll-widget-timer` have no rule anywhere — legacy relied on `.poll-option`
// alone and left the rest unstyled — so they live here, as do the result bars.
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
  margin-bottom: 8px;
}

// `.poll-option` is a <button> here rather than a clickable div.
.pw-option {
  display: block;
  width: 100%;
  text-align: left;
  font: inherit;
  color: inherit;
  cursor: pointer;

  &:disabled { cursor: default; }
}

.pw-bar {
  height: 6px;
  margin-top: 6px;
  border-radius: 20px;
  background: rgba(153, 102, 255, 0.12);
  overflow: hidden;
}

.pw-bar-fill {
  height: 100%;
  border-radius: 20px;
  background: linear-gradient(90deg, #9966ff, #ff66cc);
  transition: width 0.4s;
}

.pw-reward {
  font-size: 0.72rem;
  color: var(--text-light);
  margin: 6px 0 0;
}

.pw-more {
  font-size: 0.75rem;
  color: var(--text-light);
  margin: 10px 0 0;
  text-align: center;
}
</style>

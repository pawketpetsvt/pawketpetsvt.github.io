<template>
  <!-- Ports melonRequests_renderWidget(). Every `.melon-req*` class is owned by
       style.css. Requests complete themselves by watching what you do, so there
       is nothing to click here — it's a status board, which is why legacy
       renders it as plain divs. -->
  <div v-if="state.ready && state.requests.length" class="melon-requests-widget">
    <div class="melon-req-header">
      🍉 Melon's Requests
      <span v-if="allDone" class="mr-all-done">All done! ✓</span>
    </div>

    <div v-for="req in state.requests" :key="req.id" class="melon-req-item"
      :class="{ 'melon-req-done': isDone(req), 'melon-req-mystery': req.mystery }">
      <span class="melon-req-icon">{{ req.icon }}</span>
      <div class="melon-req-body">
        <div class="melon-req-text">
          <s v-if="isDone(req)">{{ req.text }}</s>
          <template v-else>{{ req.text }}</template>
        </div>
        <div class="melon-req-reward">{{ isDone(req) ? '✓ Claimed' : `+${req.reward} PP` }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { melonRequestService, melonRequestState as state } from '../../services/MelonRequestService.js'
import { taskTracker } from '../../services/TaskTrackerService.js'

const allDone = computed(() => melonRequestService.allDone())
const isDone = (req) => !!state.completed[req.id]

onMounted(async () => {
  await melonRequestService.load()
  // The "just check in today" request is satisfied by being here at all, so the
  // login event fires once the day's requests are known.
  taskTracker.report('login')
})
</script>

<style lang="scss" scoped>
.mr-all-done {
  color: #5dde7a;
  font-size: 0.75rem;
}
</style>

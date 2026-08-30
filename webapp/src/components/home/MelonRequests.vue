<template>
  <!-- Ports melonRequests_renderWidget(). Every `.melon-req*` class is owned by
       the global stylesheet. Requests complete themselves by watching what you do, so there
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
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.melon-requests-widget { padding: 2px 0; }
.melon-req-header {
  font-weight: 700; font-size: 0.78rem; color: var(--purple-dark);
  margin-bottom: 8px; display: flex; align-items: center; gap: 6px;
}
.melon-req-item {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 8px 10px; border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--white);
  margin-bottom: 6px;
  transition: border-color 0.2s;
}
.melon-req-item:hover { border-color: rgba(153,102,255,0.4); }
.melon-req-done { opacity: 0.6; background: rgba(93,222,122,0.05); border-color: rgba(93,222,122,0.3) !important; }
.melon-req-mystery { border-color: rgba(120,0,160,0.3) !important; background: rgba(80,0,100,0.04) !important; }
.melon-req-icon { font-size: 1.2rem; flex-shrink: 0; margin-top: 1px; }
.melon-req-body { flex: 1; min-width: 0; }
.melon-req-text { font-size: 0.78rem; color: var(--text); line-height: 1.4; font-style: italic; margin-bottom: 3px; }
.melon-req-reward { font-size: 0.72rem; font-weight: 700; color: var(--purple); }
.melon-req-done .melon-req-reward { color: #5dde7a; }

.mr-all-done {
  color: #5dde7a;
  font-size: 0.75rem;
}
</style>

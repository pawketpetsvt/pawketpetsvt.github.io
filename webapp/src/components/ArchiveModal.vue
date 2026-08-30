<template>
  <PetModal title="THE ARCHIVE" :subtitle="subtitle" width="680px" @close="$emit('close')">
    <div class="ar-wrap" :class="{ corrupted: svc.isCorrupted() }">
      <div class="ar-bar-row d-flex justify-content-between mb-1">
        <span>Logs recovered: {{ found }} / {{ total }}</span>
        <span>{{ pct }}%</span>
      </div>
      <div class="ar-bar rounded-5 overflow-hidden mb-3">
        <div class="ar-fill h-100 rounded-5" :style="{ width: pct + '%' }"></div>
      </div>

      <div class="d-flex flex-column gap-px10">
        <div
          v-for="log in entries"
          :key="log.id"
          class="ar-entry"
          :class="[log.rarity, { locked: !log.found }]"
        >
          <template v-if="log.found">
            <div class="ar-entry-head">
              <span class="ar-id">{{ log.id }}</span>
              <span class="ar-title">{{ log.title }}</span>
            </div>
            <pre class="ar-text m-0">{{ log.text }}</pre>
          </template>
          <template v-else>
            <div class="ar-entry-head">
              <span class="ar-id">{{ log.id }}</span>
              <span class="ar-title redacted">[ RECORD NOT RECOVERED ]</span>
            </div>
          </template>
        </div>
      </div>

      <p class="ar-footer text-center mt-3 mx-0 mb-0">Beta testing records. Partial recovery.</p>
    </div>
  </PetModal>
</template>

<script setup>
import { computed } from 'vue'
import PetModal from './pet/PetModal.vue'
import { argLogService } from '../services/ArgLogService.js'

// Ports argLogs_showArchive(). Unfound entries are shown REDACTED rather than
// omitted, which is legacy's own presentation — the gaps are the point.
defineEmits(['close'])

const svc = argLogService
const entries = computed(() => argLogService.entries())
const found = computed(() => argLogService.count())
const total = computed(() => entries.value.length)
const pct = computed(() => Math.round((found.value / total.value) * 100))
const subtitle = computed(() => 'Beta testing records · partial recovery')
</script>

<style lang="scss" scoped>
// Legacy built this modal from an inline-styled HTML string; the only related
// rule in style.css is `.archive-widget-pulse`, which belongs to the home
// widget rather than to this panel.
.ar-bar-row {
  font-size: 0.78rem;
  color: var(--text-light);
}

.ar-bar {
  background: rgba(0, 0, 0, 0.08);
  height: 8px;
}

.ar-fill {
  background: linear-gradient(90deg, var(--purple), var(--pink));
  transition: width 0.4s ease;
}

.ar-entry {
  border: 1px solid rgba(153, 102, 255, 0.25);
  border-radius: 10px;
  padding: 10px 12px;
  background: rgba(153, 102, 255, 0.04);

  &.locked { opacity: 0.45; background: rgba(0, 0, 0, 0.03); }
  &.epic { border-color: rgba(156, 39, 176, 0.45); }
  &.legendary { border-color: rgba(255, 152, 0, 0.55); }
}

.ar-entry-head {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin-bottom: 6px;
}

.ar-id {
  font-family: monospace;
  font-size: 0.72rem;
  color: var(--purple);
  letter-spacing: 1px;
}

.ar-title { font-weight: 700; font-size: 0.88rem; color: var(--purple-dark); }
.ar-title.redacted { font-weight: 500; color: var(--text-light); letter-spacing: 1px; }

// Preserves the logs' own line breaks, which carry their pacing.
.ar-text {
  font-family: inherit;
  font-size: 0.8rem;
  line-height: 1.6;
  color: var(--text);
  white-space: pre-wrap;
}

.ar-footer {
  font-size: 0.72rem;
  color: var(--text-light);
}

// Beta Integrity below 40 unsettles the presentation.
.corrupted {
  .ar-id { color: #b9aecd; }
  .ar-text { filter: saturate(0.6); }
  .ar-entry { border-color: rgba(120, 90, 160, 0.4); }
}
</style>

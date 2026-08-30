<template>
  <PetModal title="💰 PP History" :subtitle="subtitle" width="420px" @close="$emit('close')">
    <p v-if="!entries.length" class="pph-empty text-center m-0">No transactions yet today.</p>

    <div v-else class="d-flex flex-column gap-2">
      <div
        v-for="(tx, i) in entries"
        :key="i"
        class="pph-row"
        :class="tx.amount >= 0 ? 'gain' : 'spend'"
      >
        <div class="min-w-0">
          <div class="pph-amount">{{ tx.amount >= 0 ? '+' : '' }}{{ tx.amount }} PP</div>
          <div class="pph-reason overflow-hidden">{{ ppHistoryService.label(tx.reason) }}</div>
        </div>
        <div class="text-end flex-shrink-0">
          <div class="pph-balance">{{ tx.balance !== undefined ? tx.balance + ' PP' : '' }}</div>
          <div class="pph-time">{{ ppHistoryService.time(tx) }}</div>
        </div>
      </div>
    </div>
  </PetModal>
</template>

<script setup>
import { computed } from 'vue'
import PetModal from './pet/PetModal.vue'
import { ppHistoryService, ppHistoryState } from '../services/PPHistoryService.js'

// Ports pp_showHistory() (game.js:1469) — opened by clicking the navbar's PP
// counter, as legacy's `onclick` on #nav-points does.
defineEmits(['close'])

const entries = computed(() => ppHistoryState.entries)

const subtitle = computed(() =>
  entries.value.length ? `Last ${entries.value.length} movements on this device` : '')
</script>

<style lang="scss" scoped>
// Legacy built this modal from an inline-styled HTML string; no `.pp-history`
// rule exists in the global stylesheet, so the component owns it. Colours carried over.
.pph-empty {
  color: var(--text-light);
}

.pph-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 7px 10px;
  border-radius: 10px;

  &.gain { background: rgba(93, 222, 122, 0.08); }
  &.spend { background: rgba(231, 76, 60, 0.08); }
}

.pph-amount {
  font-size: 0.8rem;
  font-weight: 700;

  .gain & { color: #27ae60; }
  .spend & { color: #e74c3c; }
}

.pph-reason {
  font-size: 0.68rem;
  color: var(--text-light);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pph-balance { font-size: 0.75rem; font-weight: 700; }
.pph-time { font-size: 0.65rem; color: var(--text-light); }
</style>

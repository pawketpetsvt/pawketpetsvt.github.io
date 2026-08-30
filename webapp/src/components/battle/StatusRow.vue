<template>
  <!-- Ports manualBattle_renderStatuses(). The row keeps its height even when
       empty so the HP bars above don't shift as statuses come and go. -->
  <div class="pp-status-row d-flex flex-wrap mt-1 justify-content-center">
    <span v-for="(st, key) in statuses" :key="key" class="pp-status-badge d-inline-flex align-items-center rounded-5"
      :title="`${STATUS_EFFECTS[key]?.label || key}: ${STATUS_EFFECTS[key]?.desc || ''}`">
      {{ STATUS_EFFECTS[key]?.icon || '❔' }}<span class="pp-status-turns">{{ st.turns }}</span>
    </span>
  </div>
</template>

<script setup>
import { STATUS_EFFECTS } from '../../data/battleData.js'

defineProps({
  statuses: { type: Object, default: () => ({}) }
})
</script>

<style lang="scss" scoped>
.pp-status-row {
  gap: 3px;
  min-height: 18px;
}

.pp-status-badge {
  gap: 1px;
  padding: 1px 5px;
  background: rgba(0, 0, 0, 0.06);
  border: 1px solid var(--border);
  font-size: 0.72rem;
  cursor: help;
}

.pp-status-turns {
  font-weight: 800;
  color: var(--purple-dark);
}
</style>

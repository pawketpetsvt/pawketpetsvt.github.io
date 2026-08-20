<template>
  <div class="stat-row">
    <span class="stat-label">{{ label }}</span>
    <div class="stat-bar-wrap">
      <div class="stat-bar-fill" :class="stat" :style="{ width: pct + '%' }"></div>
    </div>
    <span class="stat-value">{{ value }}/{{ max }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  stat: { type: String, required: true },
  label: { type: String, required: true },
  value: { type: Number, required: true },
  max: { type: Number, required: true }
})

const pct = computed(() => Math.round((props.value / props.max) * 100))
</script>

<style lang="scss" scoped>
.stat-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-light);
  width: 90px;
  flex-shrink: 0;
}

.stat-bar-wrap {
  flex: 1;
  height: 14px;
  background: var(--purple-light);
  border-radius: 10px;
  overflow: hidden;
}

.stat-bar-fill {
  height: 100%;
  border-radius: 10px;
  transition: width 0.5s ease;

  &.hunger {
    background: linear-gradient(90deg, #ff9f43, #ffcc70);
  }

  &.happiness {
    background: linear-gradient(90deg, var(--pink), #ffb3d9);
  }

  &.energy {
    background: linear-gradient(90deg, var(--cyan), #a0f0ff);
  }
}

.stat-value {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-light);
  width: 44px;
  text-align: right;
  flex-shrink: 0;
}
</style>

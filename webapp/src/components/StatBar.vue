<template>
  <div class="sb-row d-flex align-items-center gap-px10 py-2 px-0">
    <span class="sb-label flex-shrink-0">{{ label }}</span>
    <div class="sb-track min-w-0 overflow-hidden position-relative">
      <div class="sb-fill" :class="stat" :style="{ width: pct + '%' }"></div>
    </div>
    <span class="sb-value flex-shrink-0 text-end">{{ value }}/{{ max }}</span>
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
// These classes are deliberately component-owned (`sb-*`) rather than the
// shared `.stat-row` / `.stat-bar-wrap` names this component used to carry.
// Those names collide with the sidebar's own stat rows in the root style.css,
// which layers several competing `!important` rules over them — including a
// top-level `.stat-bar-wrap, .xp-bar-wrap { width: auto !important }` that can
// collapse the track to zero width. The values below reproduce the appearance
// those global rules were producing (20px track, 2px border, dotted row rule),
// so the look is unchanged but nothing outside this file can alter it.
.sb-row {
  border-bottom: 2px dotted rgba(153, 102, 255, 0.3);
}

.sb-label {
  width: 90px;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-light);
}

.sb-track {
  flex: 1 1 auto;
  height: 20px;
  background: rgba(153, 102, 255, 0.15);
  border: 2px solid var(--border);
  border-radius: 15px;
}

.sb-fill {
  height: 100%;
  border-radius: 15px;
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

  &.xp {
    background: linear-gradient(90deg, var(--purple), var(--pink));
  }
}

.sb-value {
  width: 52px;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-light);
}
</style>

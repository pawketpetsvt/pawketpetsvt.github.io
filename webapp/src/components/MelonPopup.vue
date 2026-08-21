<template>
  <div class="melon-float-popup" :class="{ visible: melonState.visible }">
    <div class="melon-sprite"></div>
    <div class="melon-bubble" :class="{ spooky: melonState.spooky }" @click="melonService.dismissNow()">
      <strong v-if="melonState.title" class="melon-bubble-title" :class="{ spooky: melonState.spooky }">{{ melonState.title }}</strong>
      {{ melonState.text }}
    </div>
  </div>
</template>

<script setup>
import { melonState, melonService } from '../services/MelonService.js'
</script>

<style lang="scss" scoped>
.melon-float-popup {
  position: fixed;
  bottom: -160px;
  left: 12px;
  z-index: 8500;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  transition: bottom 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  pointer-events: none;

  &.visible {
    bottom: 12px;
  }
}

.melon-sprite {
  width: 72px;
  height: 72px;
  flex-shrink: 0;
  background: url('/images/Melon2.png') center / contain no-repeat;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
  animation: melon-float 3s ease-in-out infinite;
}

@keyframes melon-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

.melon-bubble {
  background: rgba(255, 255, 255, 0.97);
  color: var(--text);
  border: 2px solid rgba(153, 102, 255, 0.3);
  border-radius: 16px 16px 16px 4px;
  padding: 10px 14px;
  font-size: 0.82rem;
  line-height: 1.5;
  max-width: min(320px, 70vw);
  width: max-content;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  pointer-events: auto;
  cursor: pointer;

  &.spooky {
    background: rgba(20, 0, 30, 0.95);
    color: #cc88ff;
    border-color: rgba(120, 0, 160, 0.6);
    font-family: 'Courier New', monospace;
  }
}

.melon-bubble-title {
  display: block;
  margin-bottom: 4px;
  color: var(--purple-dark);

  &.spooky {
    color: #9966ff;
  }
}
</style>

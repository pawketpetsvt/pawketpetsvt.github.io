<template>
  <!-- Ports the QUEST COMPLETE celebration modal (game.js:25356-25375).
       Rendered app-wide from AppShell rather than per-card, since an arc can
       finish from an expedition claim or a race, not only from the pet card. -->
  <PetModal v-if="celebration" title="📖✨ Quest Complete" width="400px" @close="dismiss">
    <div class="text-center">
      <div class="qc-eyebrow mb-px6">QUEST COMPLETE</div>
      <div class="qc-name mb-2">{{ celebration.name }}</div>
      <div v-if="celebration.story" class="qc-story mb-tight">{{ celebration.story }}</div>

      <div class="qc-rewards rounded-3 p-tight">
        <div class="qc-pp">+{{ celebration.pp }} PP</div>
        <div class="qc-xp">+50 Pass XP</div>
        <div v-if="celebration.badge" class="qc-badge">🎖️ Badge unlocked!</div>
      </div>
    </div>
  </PetModal>
</template>

<script setup>
import { computed } from 'vue'
import PetModal from './PetModal.vue'
import { questService, questState } from '../../services/QuestService.js'

const celebration = computed(() => questState.celebrating)

function dismiss() {
  questService.dismissCelebration()
}
</script>

<style lang="scss" scoped>
.qc-eyebrow {
  font-size: 0.72rem;
  letter-spacing: 2px;
  color: var(--purple);
  font-weight: 700;
}

.qc-name {
  font-weight: 800;
  font-size: 1.1rem;
  color: var(--purple-dark);
}

.qc-story {
  font-size: 0.82rem;
  color: var(--text-light);
}

.qc-rewards {
  background: rgba(255, 215, 0, 0.12);
}

.qc-pp { font-size: 1.3rem; font-weight: 800; color: #e6a800; }
.qc-xp { font-size: 0.82rem; color: #5dde7a; }
.qc-badge { font-size: 0.8rem; color: var(--purple); }
</style>

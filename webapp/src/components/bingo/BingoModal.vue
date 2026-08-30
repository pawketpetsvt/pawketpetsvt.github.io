<template>
  <PetModal
    title="🎰 Daily Bingo"
    :subtitle="`${bingoService.completedCount()}/${BINGO_SQUARES} complete · ${bingoState.completedLines.length} line${bingoState.completedLines.length === 1 ? '' : 's'}`"
    width="640px"
    @close="$emit('close')"
  >
    <div v-if="!bingoState.loaded" class="spinner"></div>

    <template v-else>
      <div v-if="bingoState.blackoutCompleted" class="bg-blackout rounded-2 px-tight py-2 mb-tight text-center">
        🏆 BLACKOUT! Every square complete today.
      </div>

      <!-- The bingo card is 4x3. `row-cols-4` pins exactly four per row at any
           width — it is `auto-fit` that would reflow — so the board's shape is
           as fixed here as it was under `repeat(4, 1fr)`, and the two-column
           fallback now rides Bootstrap's `sm` breakpoint (576px) instead of the
           hand-picked 560px. -->
      <div class="row row-cols-2 row-cols-sm-4 g-2">
        <div v-for="(sq, i) in bingoState.squares" :key="i" class="col">
          <div class="bg-cell h-100 d-flex flex-column gap-1 px-2 py-px10 rounded-3 text-center"
            :class="{ done: sq.completed, free: sq.freeSpace }">
            <div class="bg-cell-name">{{ sq.name }}</div>
            <div class="bg-cell-progress">
              <template v-if="sq.freeSpace">⭐ Free</template>
              <template v-else-if="sq.completed">✅ Done</template>
              <template v-else>{{ sq.progress }}/{{ sq.target }}</template>
            </div>
            <div v-if="!sq.completed" class="bg-cell-bar rounded-5 overflow-hidden">
              <div class="bg-cell-fill h-100 rounded-5" :style="{ width: pct(sq) + '%' }"></div>
            </div>
            <div class="bg-cell-reward mt-auto">+{{ sq.rewardPoints }} PP</div>
          </div>
        </div>
      </div>

      <div class="bg-legend mt-px14 text-center">
        Complete a row, column or diagonal for <strong>+{{ BINGO_LINE_PP }} PP</strong>.
        Fill the whole card for <strong>+{{ BINGO_BLACKOUT_PP }} PP</strong> — and a
        🔑 Skin Key for the first blackout each week.
      </div>
    </template>
  </PetModal>
</template>

<script setup>
import { onMounted } from 'vue'
import PetModal from '../pet/PetModal.vue'
import { bingoService, bingoState } from '../../services/BingoService.js'
import { BINGO_SQUARES, BINGO_LINE_PP, BINGO_BLACKOUT_PP } from '../../data/bingoData.js'

defineEmits(['close'])

const pct = sq => Math.min(100, Math.round((sq.progress / sq.target) * 100))

onMounted(() => { if (!bingoState.loaded) bingoService.load() })
</script>

<style lang="scss" scoped>
// Legacy rendered the card into `#section-bingo`, whose rules went with the
// unmigrated markup, so this owns its styling. The board itself is now
// Bootstrap's grid; what remains is the cell's colour states and type.
.bg-cell {
  border: 2px solid var(--border);
  background: var(--white);

  &.done {
    border-color: #5dde7a;
    background: rgba(93, 222, 122, 0.1);
  }

  &.free {
    border-color: #e6a800;
    background: rgba(255, 215, 0, 0.1);
  }
}

.bg-cell-name {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--purple-dark);
  line-height: 1.25;
}

.bg-cell-progress { font-size: 0.68rem; color: var(--text-light); }

// 5px is the bar's drawn thickness, not a spacing step.
.bg-cell-bar {
  background: rgba(153, 102, 255, 0.12);
  height: 5px;
}

.bg-cell-fill {
  background: linear-gradient(90deg, #9966ff, #ff66cc);
}

.bg-cell-reward {
  font-size: 0.65rem;
  color: #e6a800;
  font-weight: 700;
}

.bg-blackout {
  background: rgba(255, 215, 0, 0.15);
  border: 1px solid rgba(255, 215, 0, 0.45);
  font-weight: 800;
  color: #b8860b;
}

.bg-legend {
  font-size: 0.75rem;
  color: var(--text-light);
  line-height: 1.6;
}
</style>

<template>
  <PetModal
    title="🎫 PawketPass"
    :subtitle="`Season ${passState.seasonNumber} · Level ${passState.level}/${passState.maxLevel}`"
    width="620px"
    @close="$emit('close')"
  >
    <!-- Progress to the next level -->
    <div class="pass-progress mb-3">
      <div class="d-flex justify-content-between pass-xp-label mb-1">
        <span>Level {{ passState.level }}</span>
        <span v-if="passState.level < passState.maxLevel">
          {{ passState.xp }} / {{ passState.xpToNext }} XP
        </span>
        <span v-else>MAX</span>
      </div>
      <div class="pass-track rounded-5 overflow-hidden"><div class="pass-fill h-100 rounded-5" :style="{ width: pct + '%' }"></div></div>
    </div>

    <div v-if="unclaimed > 0" class="pass-ready rounded-2 py-2 px-tight mb-tight text-center">
      🎁 {{ unclaimed }} reward{{ unclaimed === 1 ? '' : 's' }} ready to claim!
    </div>

    <div v-if="!passState.loaded" class="spinner"></div>

    <div v-else class="pass-levels">
      <div
        v-for="row in track"
        :key="row.level"
        class="pass-row d-flex align-items-center gap-2"
        :class="{ reached: passState.level >= row.level, claimed: passState.claimed.includes(row.level) }"
      >
        <span class="pass-lvl text-end">{{ row.level }}</span>
        <span class="pass-reward flex-fill min-w-0">{{ describe(row) }}</span>
        <span v-if="passState.claimed.includes(row.level)" class="pass-done">✅ Claimed</span>
        <button
          v-else-if="passState.level >= row.level"
          class="btn btn-primary btn-sm"
          :disabled="busy"
          @click="claim(row.level)"
        >Claim</button>
        <span v-else class="pass-locked">🔒</span>
      </div>
    </div>
  </PetModal>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import PetModal from '../pet/PetModal.vue'
import { passService, passState } from '../../services/PassService.js'
import { toastService } from '../../services/ToastService.js'
import { PASS_REWARDS, passItemLabel } from '../../data/passData.js'

defineEmits(['close'])

const busy = ref(false)

// The reward track comes from the SERVER (pass_get_progress returns it), so a
// new season added as rows renders here without a code change. The client's own
// PASS_REWARDS is the fallback for when the pass RPCs aren't deployed.
const track = computed(() => {
  if (passState.track && passState.track.length) return passState.track
  return Object.keys(PASS_REWARDS).map(Number).sort((a, b) => a - b).map(level => {
    const r = PASS_REWARDS[level]
    const data = r.type === 'points' ? { amount: r.amount }
      : r.type === 'title' ? { title_key: r.titleKey }
      : { item: r.itemId, quantity: r.quantity || 1, item2: r.itemId2, quantity2: r.quantity2 }
    return { level, type: r.type, data }
  })
})

const pct = computed(() => {
  if (passState.level >= passState.maxLevel) return 100
  return Math.min(100, Math.round((passState.xp / passState.xpToNext) * 100))
})

const unclaimed = computed(() => passService.unclaimedCount())

// Turns a track row into the one line the list shows. Takes the server's shape
// ({ level, type, data }), which the fallback above also produces.
function describe(row) {
  const d = row.data || {}
  if (row.type === 'points') return `🪙 ${d.amount} PP`
  if (row.type === 'skin_key') return `🔑 ${d.amount || 1}× Skin Key`
  if (row.type === 'title') return `🏆 Title: ${(d.title_key || '').replace(/_/g, ' ')}`
  // `passItemLabel` maps both the fixed UUIDs and the category tokens to
  // readable text. Without it a fixed reward would render as a bare UUID and a
  // category token as its slug.
  let s = `📦 ${d.quantity || 1}× ${passItemLabel(d.item)}`
  if (d.item2) s += ` + ${d.quantity2 || 1}× ${passItemLabel(d.item2)}`
  return s
}

async function claim(lvl) {
  busy.value = true
  try {
    await passService.claim(lvl)
  } catch (e) {
    toastService.error(e.message)
  } finally {
    busy.value = false
  }
}

onMounted(() => { if (!passState.loaded) passService.load() })
</script>

<style lang="scss" scoped>
// Legacy rendered the Pass into a `#section-pass` block whose rules were removed
// with the rest of the unmigrated markup, so this owns its own styling.
.pass-xp-label {
  font-size: 0.75rem;
  color: var(--text-light);
}

.pass-track {
  background: rgba(153, 102, 255, 0.12);
  height: 10px;
}

.pass-fill {
  background: linear-gradient(90deg, #9966ff, #ff66cc);
  transition: width 0.3s;
}

.pass-ready {
  background: rgba(255, 215, 0, 0.12);
  border: 1px solid rgba(255, 215, 0, 0.4);
  font-size: 0.82rem;
  font-weight: 700;
  color: #b8860b;
}

.pass-levels {
  max-height: 46vh;
  overflow-y: auto;
}

.pass-row {
  padding: 8px 10px;
  border-bottom: 1px solid rgba(153, 102, 255, 0.08);
  font-size: 0.82rem;
  opacity: 0.5;

  &.reached { opacity: 1; }
  &.claimed { opacity: 0.7; }
}

.pass-lvl {
  min-width: 28px;
  font-weight: 800;
  color: var(--purple);
}

.pass-reward { color: var(--purple-dark); }
.pass-done { font-size: 0.72rem; color: #5dde7a; font-weight: 700; }
.pass-locked { font-size: 0.8rem; }
</style>

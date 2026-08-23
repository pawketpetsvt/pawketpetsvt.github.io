<template>
  <div class="fishing-shop-box autofisher-box">
    <div class="shop-box-title">🤖 Auto-Fisher</div>
    <div v-for="(tier, i) in AUTO_FISHER_TIERS" :key="tier.level" class="autofisher-row" :class="tierState(i + 1)">
      <b>{{ tier.name }}</b>: {{ tier.desc }}
      <span v-if="tierState(i + 1) === 'owned'" class="tier-owned-label">✓ Owned</span>
      <span v-else-if="tierState(i + 1) === 'active'" class="tier-active-label">✓ Active</span>
      <button v-else class="btn btn-sm" :disabled="purchasing || points < tier.cost" @click="purchase(i + 1)">
        {{ tier.cost }} PP{{ level > 0 ? ' Upgrade' : '' }}
      </button>
    </div>
  </div>

  <div v-if="pendingHaul.length" class="autofisher-banner">
    <div class="haul-title">🤖 Auto-Fisher caught {{ pendingHaul.length }} fish!</div>
    <div class="haul-sub">Estimated: ~{{ pendingTotal }} PP waiting for you</div>
    <button class="btn btn-primary haul-collect-btn" @click="collect">🎣 Collect Haul!</button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { AppState } from '../../AppState.js'
import { fishingService } from '../../services/FishingService.js'
import { modalService } from '../../services/ModalService.js'
import { toastService } from '../../services/ToastService.js'
import { AUTO_FISHER_TIERS } from '../../data/fishingData.js'

const props = defineProps({
  level: { type: Number, required: true }
})
const emit = defineEmits(['purchased'])

const purchasing = ref(false)
const pendingHaul = ref([])
const points = computed(() => AppState.player ? AppState.player.pawketpoints : 0)
const pendingTotal = computed(() => pendingHaul.value.reduce((s, c) => s + (c.pp || 0), 0))

function tierState(tierLevel) {
  if (tierLevel < props.level) return 'owned'
  if (tierLevel === props.level) return 'active'
  return 'available'
}

async function purchase(level) {
  purchasing.value = true
  try {
    await fishingService.purchaseAutoFisher(AppState.user.id, level)
    toastService.success('🤖 Auto-Fisher activated!')
    emit('purchased', level)
  } catch (err) {
    toastService.error(err.message)
  } finally {
    purchasing.value = false
  }
}

async function collect() {
  const { haul, totalPP } = await fishingService.collectHaul(AppState.user.id)
  pendingHaul.value = []
  if (!haul.length) return

  const grouped = {}
  haul.forEach(c => {
    if (!grouped[c.name]) grouped[c.name] = { emoji: c.emoji, count: 0, pp: 0 }
    grouped[c.name].count++
    grouped[c.name].pp += c.pp
  })
  const summary = Object.entries(grouped)
    .sort((a, b) => b[1].pp - a[1].pp)
    .map(([name, g]) => g.emoji + ' ' + (g.count > 1 ? g.count + 'x ' : '') + name)
    .join(', ')

  modalService.success('🤖 Auto-Fisher Haul!', summary + ' — Total: +' + totalPP + ' PP 🎉')
}

onMounted(() => {
  pendingHaul.value = fishingService.getPendingHaul(AppState.user.id)
})
</script>

<style lang="scss" scoped>
.fishing-shop-box {
  background: rgba(93, 222, 122, 0.06);
  border: 1px solid rgba(93, 222, 122, 0.2);
  border-radius: 10px;
  padding: 10px 12px;
  margin-top: 8px;
}

.shop-box-title {
  font-weight: 700;
  margin-bottom: 8px;
  color: var(--purple-dark);
}

.autofisher-row {
  padding: 6px 0;
  font-size: 0.9rem;

  &.owned {
    opacity: 0.5;
  }

  &.active {
    background: rgba(153, 102, 255, 0.1);
    border-radius: 8px;
    padding: 8px;
  }
}

.autofisher-banner {
  background: linear-gradient(135deg, rgba(153, 102, 255, 0.15), rgba(255, 102, 204, 0.1));
  border: 2px solid var(--purple);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 12px;
  text-align: center;
}

.tier-owned-label {
  color: var(--green);
  font-size: 0.8rem;
}

.tier-active-label {
  color: var(--purple);
  font-weight: 700;
}

.haul-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 6px;
}

.haul-sub {
  color: var(--text-light);
  font-size: 0.85rem;
  margin-bottom: 10px;
}

.haul-collect-btn {
  width: 100%;
}
</style>

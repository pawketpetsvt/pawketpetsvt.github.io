<template>
  <div class="fishing-shop-box rod-shop h-100 px-3 py-2 rounded-2">
    <div class="shop-box-title mb-2">🎣 Upgrade Your Rod</div>
    <div
      v-for="rod in FISHING_RODS.slice(1)"
      :key="rod.level"
      class="shop-box-row d-flex align-items-center gap-2 p-2 mb-1 rounded-2"
      :class="{ current: rodLevel === rod.level }"
    >
      <span class="rod-emoji">{{ rod.emoji }}</span>
      <div class="flex-grow-1 min-w-0">
        <div class="rod-name">{{ rod.name }}</div>
        <div class="rod-desc">{{ rod.desc }}</div>
      </div>
      <span v-if="rodLevel >= rod.level" class="rod-owned-label">{{ rodLevel === rod.level ? '✅ Equipped' : '✅ Owned' }}</span>
      <button v-else class="btn btn-sm btn-primary rod-buy-btn" :disabled="upgrading || points < rod.cost" @click="upgrade(rod)">{{ rod.cost }} PP</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { AppState } from '../../AppState.js'
import { fishingService } from '../../services/FishingService.js'
import { toastService } from '../../services/ToastService.js'
import { FISHING_RODS } from '../../data/fishingData.js'

const props = defineProps({
  rodLevel: { type: Number, required: true }
})
const emit = defineEmits(['upgraded'])

const upgrading = ref(false)
const points = computed(() => AppState.player ? AppState.player.pawketpoints : 0)

async function upgrade(rod) {
  upgrading.value = true
  try {
    const newLevel = await fishingService.upgradeRod(AppState.user.id, props.rodLevel, rod.cost)
    toastService.success('🎣 Upgraded to ' + rod.name + '!')
    emit('upgraded', newLevel)
  } catch (err) {
    toastService.error(err.message)
  } finally {
    upgrading.value = false
  }
}
</script>

<style lang="scss" scoped>
// Layout via Bootstrap utilities in the template; visuals only here.
.fishing-shop-box {
  background: rgba(153, 102, 255, 0.06);
  border: 1px solid rgba(153, 102, 255, 0.2);
}

.shop-box-title {
  font-weight: 700;
  color: var(--purple-dark);
}

.shop-box-row {
  background: rgba(0, 0, 0, 0.03);

  &.current {
    background: rgba(153, 102, 255, 0.15);
  }
}

.rod-emoji {
  font-size: 1.4rem;
}

.rod-name {
  font-weight: 700;
}

.rod-desc {
  font-size: 0.8rem;
  color: var(--text-light);
}

.rod-owned-label {
  color: var(--purple);
  font-size: 0.8rem;
}

.rod-buy-btn {
  font-size: 0.8rem;
}
</style>

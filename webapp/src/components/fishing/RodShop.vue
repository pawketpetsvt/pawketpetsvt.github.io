<template>
  <div class="fishing-shop-box rod-shop">
    <div class="shop-box-title">🎣 Upgrade Your Rod</div>
    <div v-for="rod in FISHING_RODS.slice(1)" :key="rod.level" class="shop-box-row" :class="{ current: rodLevel === rod.level }">
      <span class="rod-emoji">{{ rod.emoji }}</span>
      <div class="rod-info">
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
.fishing-shop-box {
  background: rgba(153, 102, 255, 0.06);
  border: 1px solid rgba(153, 102, 255, 0.2);
  border-radius: 10px;
  padding: 10px 12px;
}

.shop-box-title {
  font-weight: 700;
  margin-bottom: 8px;
  color: var(--purple-dark);
}

.shop-box-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 10px;
  margin-bottom: 6px;
  background: rgba(0, 0, 0, 0.03);

  &.current {
    background: rgba(153, 102, 255, 0.15);
  }
}

.rod-emoji {
  font-size: 1.4rem;
}

.rod-info {
  flex: 1;
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

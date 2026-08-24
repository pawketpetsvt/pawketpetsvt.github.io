<template>
  <div class="cos-panel">
    <h2 class="cos-title">✨ Profile Cosmetics</h2>
    <p class="cos-desc">Customize how your profile looks to everyone. Equip up to {{ MAX_EQUIPPED_BADGES }} badge pips.</p>

    <div class="cos-tabs">
      <button
        v-for="t in TABS"
        :key="t.key"
        class="cos-tab"
        :class="{ active: tab === t.key }"
        @click="tab = t.key"
      >{{ t.label }}</button>
    </div>

    <div class="cos-grid">
      <button
        v-for="item in items"
        :key="item.id"
        class="cos-card"
        :class="{ equipped: isEquipped(item.id), locked: !isUnlocked(item) }"
        :title="isUnlocked(item) ? item.name : '🔒 ' + item.unlockHint"
        @click="pick(item)"
      >
        <span v-if="tab === 'backgrounds'" class="cos-swatch" :style="{ background: item.gradient }"></span>
        <span v-else class="cos-emoji" :style="tab === 'badges' ? { filter: 'drop-shadow(0 0 4px ' + item.color + ')' } : null">{{ item.emoji }}</span>
        <span class="cos-name">{{ isUnlocked(item) ? item.name : '???' }}</span>
        <span v-if="!isUnlocked(item)" class="cos-hint">🔒 {{ item.unlockHint }}</span>
        <span v-else-if="isEquipped(item.id)" class="cos-equipped-tag">Equipped</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { COSMETICS_CATALOG, MAX_EQUIPPED_BADGES } from '../../data/cosmeticsData.js'
import { profileService } from '../../services/ProfileService.js'
import { toastService } from '../../services/ToastService.js'

const props = defineProps({
  equipped: { type: Object, required: true },
  unlocked: { type: Object, default: () => ({ backgrounds: [], frames: [], badges: [] }) }
})
const emit = defineEmits(['update'])

const TABS = [
  { key: 'backgrounds', label: '🎨 Backgrounds', type: 'background' },
  { key: 'frames', label: '🖼️ Frames', type: 'frame' },
  { key: 'badges', label: '🏷️ Badge Pips', type: 'badge' }
]

const tab = ref('backgrounds')
const items = computed(() => COSMETICS_CATALOG[tab.value])
const activeType = computed(() => TABS.find(t => t.key === tab.value).type)

function isUnlocked(item) {
  return profileService.isOwned(activeType.value, item.id, props.unlocked[tab.value] || [])
}

function isEquipped(id) {
  if (activeType.value === 'badge') return props.equipped.badges.includes(id)
  return props.equipped[activeType.value] === id
}

function pick(item) {
  if (!isUnlocked(item)) {
    toastService.warning('🔒 Cosmetic not unlocked yet!')
    return
  }
  emit('update', profileService.applyEquip(props.equipped, activeType.value, item.id))
}
</script>

<style lang="scss" scoped>
.cos-panel {
  margin-top: 24px;
}

.cos-title {
  font-size: 1.15rem;
  color: var(--purple-dark);
  margin-bottom: 4px;
}

.cos-desc {
  font-size: 0.82rem;
  color: var(--text-light);
  margin-bottom: 12px;
}

.cos-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.cos-tab {
  padding: 7px 14px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: transparent;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-light);
  cursor: pointer;

  &.active {
    background: var(--purple);
    border-color: var(--purple);
    color: #fff;
  }
}

.cos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
}

.cos-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  border: 2px solid var(--border);
  border-radius: 12px;
  background: var(--card-bg, #fff);
  cursor: pointer;
  text-align: center;

  &.equipped {
    border-color: var(--purple);
    background: rgba(153, 102, 255, 0.08);
  }

  &.locked {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.cos-swatch {
  width: 100%;
  height: 38px;
  border-radius: 8px;
}

.cos-emoji {
  font-size: 1.7rem;
}

.cos-name {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--purple-dark);
}

.cos-hint {
  font-size: 0.62rem;
  color: var(--text-light);
  line-height: 1.25;
}

.cos-equipped-tag {
  font-size: 0.62rem;
  font-weight: 700;
  color: var(--purple);
}
</style>

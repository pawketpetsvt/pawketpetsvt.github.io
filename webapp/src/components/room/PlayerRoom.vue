<template>
  <!-- Ports room_render(). One component covers both the owner's editable room
       and the read-only view another player sees, exactly as legacy's single
       renderer did via its `readOnly` flag.

       All of `.player-room-*` and `.room-*` are owned by the global stylesheet, so this
       carries no styling of its own — only the per-theme colors, which legacy
       also set inline because they vary with the chosen theme. -->
  <div class="player-room-wrap">
    <div v-if="!ready" class="text-center py-4">
      <div class="spinner"></div>
    </div>

    <template v-else>
      <!-- Theme picker, owner only. -->
      <div v-if="!readOnly" class="room-theme-bar">
        <span class="rm-theme-label me-2">Theme:</span>
        <button v-for="(t, key) in THEMES" :key="key" class="rm-theme-btn"
          :class="{ 'rm-theme-current': key === layout.theme }" :style="themeBtnStyle(key, t)" :title="t.desc"
          :disabled="busy" @click="pickTheme(key)">
          {{ shortName(t) }}<span v-if="t.price > 0 && !roomService.isThemeUnlocked(key)"> ({{ t.price }}PP)</span>
        </button>
      </div>

      <div class="player-room-visual" :style="visualStyle">
        <div class="room-floor-line" :style="{ top: '45%', borderColor: theme.accent }"></div>

        <template v-if="!readOnly">
          <div class="room-zone-label room-zone-wall" :style="{ color: theme.accent }">WALL</div>
          <div class="room-zone-label room-zone-floor" :style="{ color: theme.accent }">FLOOR</div>
        </template>

        <!-- The pet standing in the room. Legacy always showed the FIRST pet;
             showing the active companion instead means the pet you chose to
             follow you around is the one who lives here, and it falls back to
             the first pet when no companion is set. -->
        <div v-if="roomPet && roomPet.image" class="room-pet-sprite" :style="{ bottom: '5%', left: '90%' }">
          <img :src="roomPet.image" :alt="roomPet.name" class="rm-pet-img" @error="onPetImgError" />
          <div class="rm-pet-name text-center mt-px2" :style="{ color: theme.accent }">{{ roomPet.name }}</div>
        </div>

        <div v-for="slot in SLOTS" :key="slot.id" class="room-slot"
          :style="{ left: slot.x, top: slot.y, cursor: readOnly ? 'default' : 'pointer' }"
          :title="readOnly ? '' : slot.label" @click="!readOnly && clickSlot(slot.id)">
          <div v-if="itemFor(slot.id)" class="room-item-placed" :style="{ borderColor: theme.accent }">
            <div class="rm-item-emoji">{{ itemFor(slot.id).emoji || '🪑' }}</div>
            <div class="room-item-name">{{ itemFor(slot.id).name }}</div>
            <div v-if="bonusLabelFor(slot.id)" class="room-item-bonus">{{ bonusLabelFor(slot.id) }}</div>
            <div v-if="!readOnly" class="room-item-remove" title="Remove" @click.stop="place(slot.id, null)">✕</div>
          </div>
          <div v-else-if="!readOnly" class="room-slot-empty">
            <div class="rm-plus">+</div>
            <div class="rm-slot-label">{{ slot.label }}</div>
          </div>
        </div>
      </div>

      <div v-if="bonuses.length" class="room-bonuses-panel">
        <div class="rm-bonus-head mb-2">
          ✨ Room Bonuses
          <span v-if="!readOnly" class="rm-bonus-note">(active while on this page)</span>
        </div>
        <div v-for="(b, i) in bonuses" :key="i" class="room-bonus-row">
          <span>{{ b.label }}</span>
          <span class="room-bonus-value">Active</span>
        </div>
      </div>

      <div class="room-vibe">
        {{ roomService.vibeStars(vibe) }} Vibe Score: {{ vibe }}/{{ VIBE_MAX }}
        <template v-if="readOnly && ownerName"> — {{ ownerName }}'s Room</template>
      </div>

      <!-- Furniture picker. Legacy toggled a hidden div and rebuilt its HTML;
           here the open slot is just state. -->
      <div v-if="!readOnly && openSlot !== null" class="room-picker">
        <div class="rm-picker-head mb-px10">Choose furniture for {{ slotLabel(openSlot) }}:</div>

        <p v-if="!owned.length" class="rm-picker-empty">
          You don't own any furniture yet!<br /><br />
          <router-link to="/shop">Visit the Shop →</router-link>
        </p>

        <div v-else class="d-flex flex-wrap gap-2">
          <button class="rm-pick" :disabled="busy" @click="place(openSlot, null)">
            <div class="rm-pick-emoji">✕</div>
            <div class="rm-pick-name rm-muted">Empty</div>
          </button>
          <button v-for="item in owned" :key="item.id" class="rm-pick"
            :class="{ 'rm-pick-current': isCurrent(item), 'rm-pick-placed': isElsewhere(item) }" :disabled="busy"
            @click="place(openSlot, item.id)">
            <span v-if="isElsewhere(item)" class="rm-pick-badge position-absolute">placed</span>
            <div class="rm-pick-emoji">{{ item.emoji || '🪑' }}</div>
            <div class="rm-pick-name">{{ item.name }}</div>
            <div v-if="item.bonus_type" class="rm-pick-bonus">has bonus</div>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { AppState } from '../../AppState.js'
import { roomService, roomState } from '../../services/RoomService.js'
import { furnitureService } from '../../services/FurnitureService.js'
import { cosmeticsState } from '../../services/PetCosmeticsService.js'
import { toastService } from '../../services/ToastService.js'
import { ROOM_SLOTS, ROOM_THEMES, ROOM_BONUS_LABELS, VIBE_MAX } from '../../data/roomData.js'

const props = defineProps({
  // Omit for the owner's own editable room; pass a { username, layout } from
  // roomService.loadVisitorRoom() to render someone else's read-only.
  visitor: { type: Object, default: null }
})

const SLOTS = ROOM_SLOTS
const THEMES = ROOM_THEMES

const busy = ref(false)
const openSlot = ref(null)

const readOnly = computed(() => !!props.visitor)
const ownerName = computed(() => props.visitor && props.visitor.username)
const layout = computed(() => props.visitor ? props.visitor.layout : roomState.layout)
const ready = computed(() => readOnly.value ? !!props.visitor.layout : roomState.loaded)
const theme = computed(() => ROOM_THEMES[layout.value.theme] || ROOM_THEMES.cottage)

const owned = computed(() => furnitureService.ownedItems())
const bonuses = computed(() => roomService.activeBonuses(layout.value))
const vibe = computed(() => roomService.vibeScore(layout.value))

// The room's back wall meets the floor at 45%, which the dashed floor line and
// the slot coordinates both assume.
const visualStyle = computed(() => ({
  background: `linear-gradient(180deg, ${theme.value.sky} 0%, ${theme.value.wall} 45%, ${theme.value.floor} 45% 100%)`,
  border: `3px solid ${theme.value.accent}`
}))

const roomPet = computed(() => {
  const pets = AppState.ownedPets || []
  if (!pets.length) return null
  const pet = pets.find(p => p.id === cosmeticsState.companionPetId) || pets[0]
  const file = pet.imageFile || (pet.species && pet.species.image_file)
  return file ? { image: '/images/' + file, name: pet.nickname || '' } : null
})

function onPetImgError(e) { e.target.style.display = 'none' }

function itemFor(slotId) { return roomService.itemInSlot(slotId, layout.value) }

function bonusLabelFor(slotId) {
  const item = itemFor(slotId)
  if (!item || !item.bonus_type || !item.bonus_value) return ''
  return (ROOM_BONUS_LABELS[item.bonus_type] || '+{v} Bonus').replace('{v}', item.bonus_value)
}

function slotLabel(id) {
  const s = SLOTS.find(s => s.id === id)
  return s ? s.label : 'this slot'
}

const isCurrent = (item) => layout.value.slots[openSlot.value] === item.id
const isElsewhere = (item) => roomService.isPlaced(item.id, layout.value) && !isCurrent(item)

function shortName(t) { return t.name.split(' ').slice(0, 2).join(' ') }

function themeBtnStyle(key, t) {
  const current = key === layout.value.theme
  return {
    borderColor: current ? t.accent : 'var(--border)',
    background: current ? t.accent : 'var(--bg)',
    color: current ? '#fff' : 'var(--text)'
  }
}

// Legacy toggled the picker closed when the same slot was clicked twice.
function clickSlot(slotId) {
  openSlot.value = openSlot.value === slotId ? null : slotId
}

async function place(slotId, furnitureId) {
  busy.value = true
  try {
    await roomService.place(slotId, furnitureId)
    openSlot.value = null
  } catch (err) {
    toastService.error(err.message)
  } finally {
    busy.value = false
  }
}

async function pickTheme(key) {
  if (key === layout.value.theme) return
  busy.value = true
  try {
    const charged = await roomService.setTheme(key)
    if (charged) toastService.success(`${ROOM_THEMES[key].name} unlocked! 🎨`)
  } catch (err) {
    toastService.error(err.message)
  } finally {
    busy.value = false
  }
}
</script>

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.player-room-wrap {
  max-width: 560px;
  margin: 0 auto;
}
.room-theme-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 12px;
  padding: 10px 12px;
  background: var(--white);
  border: 2px solid var(--border);
  border-radius: 14px;
}
.player-room-visual {
  position: relative;
  width: 100%;
  aspect-ratio: 4/3;
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 14px;
  min-height: 240px;
}
.room-floor-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  border-top: 2px dashed;
  opacity: 0.3;
  z-index: 1;
}
.room-zone-label {
  position: absolute;
  font-size: 0.55rem;
  font-weight: 800;
  letter-spacing: 2px;
  opacity: 0.3;
  z-index: 1;
}
.room-zone-wall { top: 8px;  left: 10px; }
.room-zone-floor { bottom: 8px; left: 10px; }
.room-pet-sprite {
  position: absolute;
  text-align: center;
  z-index: 3;
  transform: translateX(-50%);
}
.room-slot {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 4;
  cursor: pointer;
}
.room-slot-empty {
  width: 72px;
  height: 72px;
  border: 2.5px dashed rgba(0,0,0,0.18);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.15);
  transition: all 0.15s;
}
.room-slot:hover .room-slot-empty {
  border-color: rgba(153,102,255,0.5);
  background: rgba(153,102,255,0.1);
}
.room-item-placed {
  width: 72px;
  min-height: 72px;
  background: rgba(255,255,255,0.85);
  border: 2.5px solid;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4px;
  position: relative;
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
  transition: transform 0.15s;
}
.room-slot:hover .room-item-placed { transform: scale(1.06); }
.room-item-name {
  font-size: 0.5rem;
  font-weight: 700;
  text-align: center;
  color: #333;
  line-height: 1.2;
  margin-top: 2px;
}
.room-item-bonus {
  font-size: 0.45rem;
  color: var(--purple);
  text-align: center;
  font-weight: 700;
  margin-top: 1px;
}
.room-item-remove {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 18px;
  height: 18px;
  background: #ff6b6b;
  border-radius: 50%;
  font-size: 0.6rem;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-weight: 700;
  opacity: 0;
  transition: opacity 0.15s;
}
.room-slot:hover .room-item-remove { opacity: 1; }
.room-bonuses-panel {
  background: var(--white);
  border: 2px solid var(--border);
  border-radius: 14px;
  padding: 12px 16px;
  margin-bottom: 12px;
}
.room-bonus-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  padding: 4px 0;
  border-bottom: 1px solid rgba(153,102,255,0.08);
}
.room-bonus-row:last-child { border-bottom: none; }
.room-bonus-value {
  font-size: 0.72rem;
  color: #27ae60;
  font-weight: 700;
}
.room-vibe {
  text-align: center;
  font-size: 0.82rem;
  color: var(--text-light);
  margin-bottom: 12px;
}
.room-picker {
  background: var(--white);
  border: 2px solid var(--purple);
  border-radius: 14px;
  padding: 14px 16px;
  margin-top: 10px;
  max-height: 240px;
  overflow-y: auto;
}

// Everything structural is in the global stylesheet. What lives here is what legacy set
// inline on each element, since it varies per theme or per item.
.rm-theme-label {
  font-size: 0.8rem;
  color: var(--text-light);
}

.rm-theme-btn {
  padding: 4px 10px;
  border-radius: 20px;
  border: 2px solid;
  font-size: 0.72rem;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
  }

  &:not(.rm-theme-current) {
    opacity: 0.85;
  }
}

.rm-pet-img {
  width: 60px;
  height: 60px;
  object-fit: contain;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.2));
}

.rm-pet-name {
  font-size: 0.65rem;
}

.rm-item-emoji {
  font-size: 1.8rem;
}

.rm-plus {
  font-size: 1.1rem;
  opacity: 0.4;
}

.rm-slot-label {
  font-size: 0.55rem;
  opacity: 0.4;
}

.rm-bonus-head {
  font-weight: 700;
  font-size: 0.85rem;
}

.rm-bonus-note {
  font-size: 0.7rem;
  color: var(--text-light);
  font-weight: 400;
}

.rm-picker-head {
  font-weight: 700;
  font-size: 0.82rem;
}

.rm-picker-empty {
  text-align: center;
  padding: 16px;
  color: var(--text-light);
  font-size: 0.85rem;
  margin: 0;

  a {
    color: var(--purple);
  }
}

.rm-pick {
  position: relative;
  min-width: 80px;
  padding: 8px 10px;
  border: 2px solid var(--border);
  border-radius: 10px;
  background: var(--white);
  text-align: center;
  cursor: pointer;

  &.rm-pick-current {
    border-color: var(--purple);
    background: rgba(153, 102, 255, 0.1);
  }

  &.rm-pick-placed {
    border-color: rgba(153, 102, 255, 0.3);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.rm-pick-badge {
  top: 2px;
  right: 4px;
  font-size: 0.55rem;
  color: var(--text-light);
}

.rm-pick-emoji {
  font-size: 1.6rem;
}

.rm-pick-name {
  font-size: 0.65rem;
  font-weight: 700;
}

.rm-muted {
  color: var(--text-light);
  font-weight: 400;
}

.rm-pick-bonus {
  font-size: 0.58rem;
  color: var(--purple);
}
</style>

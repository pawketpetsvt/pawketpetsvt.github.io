<template>
  <div class="my-pet-card">
    <div class="pet-card-header">
      <div class="pet-avatar">
        <img v-if="pet.species.image_file && !imgError" :src="'/images/' + pet.species.image_file" :alt="pet.nickname" @error="imgError = true" />
        <span v-else>🐾</span>
      </div>
      <div class="pet-card-info">
        <div class="pet-card-nickname">{{ pet.nickname }}</div>
        <div class="pet-card-species">
          <span v-if="pet.species.vtuber_name">🎭 {{ pet.species.vtuber_name }}</span>
          <a v-if="pet.species.twitch_url" :href="pet.species.twitch_url" target="_blank" class="watch-live">Watch Live</a>
        </div>
        <div class="pet-card-level">Lv. {{ pet.level }} &nbsp;|&nbsp; Max: {{ pet.max_hunger }}</div>
      </div>
    </div>

    <div v-if="pet.happiness <= 20 || pet.hunger <= 10" class="sadness-warning">😢 Your pet needs attention!</div>

    <div class="stat-bars">
      <StatBar stat="hunger" label="🍖 Hunger" :value="pet.hunger" :max="pet.max_hunger" />
      <StatBar stat="happiness" label="💖 Happiness" :value="pet.happiness" :max="pet.max_happiness" />
      <StatBar stat="energy" label="⚡ Energy" :value="pet.energy" :max="pet.max_energy" />
      <div class="xp-row">
        <span class="xp-label">✨ XP</span>
        <div class="xp-bar-wrap"><div class="xp-bar-fill" :style="{ width: xpPct + '%' }"></div></div>
        <span class="xp-value">{{ pet.xp }}/{{ pet.xpForNextLevel }}</span>
      </div>
    </div>

    <div class="pet-actions">
      <button class="btn-action btn-feed" :disabled="!pet.canFeed || feeding" @click="handleFeed">
        {{ pet.canFeed ? '🍖 Feed' : '🍖 Full!' }}
      </button>
      <button class="btn-action btn-play" :disabled="!pet.canPlay || playing" @click="handlePlay">
        {{ pet.canPlay ? '🎾 Play' : '⚡ Tired!' }}
      </button>
    </div>

    <div class="use-item-section">
      <div class="use-item-label">🎒 Use an Item</div>
      <p v-if="!inventory.length" class="no-items">No items. <router-link to="/adopt">Visit the adoption centre!</router-link></p>
      <div v-else class="use-item-row">
        <select v-model="selectedInvId" class="item-select">
          <option value="">— Choose an item —</option>
          <option v-for="item in inventory" :key="item.invId" :value="item.invId">
            {{ item.name }} (x{{ item.qty }}) — {{ item.effectText }}
          </option>
        </select>
        <button class="btn-use-item" :disabled="!selectedInvId || usingItem" @click="handleUseItem">✨ Use</button>
      </div>
      <div v-if="selectedItem" class="item-effect-preview">✨ Will give: {{ selectedItem.effectText }}</div>
    </div>

    <div class="stat-flash" :style="{ opacity: flashMessage ? 1 : 0, color: flashColor }">{{ flashMessage }}</div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import StatBar from './StatBar.vue'
import { AppState } from '../AppState.js'
import { ownedPetsService } from '../services/OwnedPetsService.js'
import { journalService } from '../services/JournalService.js'
import { toastService } from '../services/ToastService.js'

const props = defineProps({
  pet: { type: Object, required: true },
  inventory: { type: Array, required: true },
  discoveries: { type: Object, default: () => ({}) }
})

const imgError = ref(false)
const feeding = ref(false)
const playing = ref(false)
const usingItem = ref(false)
const selectedInvId = ref('')
const flashMessage = ref('')
const flashColor = ref('')

const xpPct = computed(() => Math.min((props.pet.xp / props.pet.xpForNextLevel) * 100, 100))
const selectedItem = computed(() => props.inventory.find(i => i.invId === selectedInvId.value) || null)

function flash(msg, color) {
  flashMessage.value = msg
  flashColor.value = color
  setTimeout(() => { flashMessage.value = '' }, 3000)
}

async function handleFeed() {
  feeding.value = true
  try {
    const lu = await ownedPetsService.feed(props.pet)
    if (lu.leveled) flash('🎉 Level ' + lu.level + '! Max stats +5!', '#b06aff')
    else flash('+20 Hunger  +5 Happiness  +10 XP', '#5dde7a')
  } catch (err) {
    flash('Error!', '#ff6eb4')
  } finally {
    feeding.value = false
  }
}

async function handlePlay() {
  playing.value = true
  try {
    const lu = await ownedPetsService.play(props.pet)
    if (lu.leveled) flash('🎉 Level ' + lu.level + '! Max stats +5!', '#b06aff')
    else flash('-10 Energy  +15 Happiness  +15 XP', '#5dde7a')
  } catch (err) {
    flash('Error!', '#ff6eb4')
  } finally {
    playing.value = false
  }
}

async function handleUseItem() {
  const item = selectedItem.value
  if (!item) return
  usingItem.value = true
  try {
    const result = await ownedPetsService.useItemOnPet(props.pet, item)
    if (result.healed) {
      flash('💚 Healed ' + result.healed + ' HP!', '#5dde7a')
      toastService.success('Healed ' + props.pet.nickname + ' with ' + item.name + '!')
    } else {
      flash('✨ ' + item.name + ': ' + item.effectText, '#b06aff')
      toastService.success(
        result.leveledUp
          ? '🎉 Used ' + item.name + ' — ' + props.pet.nickname + ' leveled up to ' + result.newLevel + '!'
          : 'Used ' + item.name + ' on ' + props.pet.nickname + '!'
      )
      if (result.reactionType && result.reactionType !== 'normal') {
        await journalService.logDiscovery(AppState.user.id, props.pet.species.name, props.discoveries, result.reactionType, item.name)
      }
    }
    selectedInvId.value = ''
  } catch (err) {
    toastService.error('Error: ' + err.message)
  } finally {
    usingItem.value = false
  }
}
</script>

<style lang="scss" scoped>
.my-pet-card {
  background: var(--white);
  border: 2.5px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: 0 6px 24px var(--shadow);
  transition: transform 0.2s;
  display: flex;
  flex-direction: column;
  gap: 14px;

  &:hover {
    transform: translateY(-4px);
  }
}

.pet-card-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.pet-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 3px solid var(--purple-light);
  background: var(--purple-light);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.2rem;
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: 0 4px 12px var(--shadow);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.pet-card-info {
  flex: 1;
  min-width: 0;
}

.pet-card-nickname {
  font-family: 'Fredoka One', cursive;
  font-size: 1.3rem;
  color: var(--purple-dark);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pet-card-species {
  font-size: 0.82rem;
  color: var(--text-light);
  font-weight: 700;
}

.pet-card-level {
  display: inline-block;
  background: linear-gradient(135deg, var(--purple), var(--pink));
  color: var(--white);
  font-family: 'Fredoka One', cursive;
  font-size: 0.8rem;
  padding: 2px 10px;
  border-radius: 20px;
  margin-top: 4px;
}

.watch-live {
  font-size: 0.78rem;
  background: #9146ff;
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  font-family: 'Fredoka One', cursive;
  text-decoration: none;
  margin-left: 6px;
}

.sadness-warning {
  background: #fff0f0;
  border: 2px solid #ffb3b3;
  border-radius: var(--radius);
  padding: 6px 12px;
  font-size: 0.82rem;
  color: #cc4444;
  font-weight: 700;
  text-align: center;
}

.stat-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.xp-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.xp-label {
  font-size: 0.78rem;
  color: var(--text-light);
  font-weight: 700;
  width: 90px;
  flex-shrink: 0;
}

.xp-bar-wrap {
  flex: 1;
  height: 10px;
  background: var(--purple-light);
  border-radius: 10px;
  overflow: hidden;
}

.xp-bar-fill {
  height: 100%;
  border-radius: 10px;
  background: linear-gradient(90deg, var(--purple), var(--pink));
  transition: width 0.5s ease;
}

.xp-value {
  font-size: 0.78rem;
  color: var(--text-light);
  font-weight: 700;
  width: 60px;
  text-align: right;
  flex-shrink: 0;
}

.pet-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.btn-action {
  font-family: 'Fredoka One', cursive;
  font-size: 0.95rem;
  padding: 9px 12px;
  border-radius: 24px;
  border: none;
  cursor: pointer;
  transition: transform 0.15s, opacity 0.2s;
  text-align: center;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.btn-feed {
  background: linear-gradient(135deg, #ff9f43, #ffcc70);
  color: var(--white);
}

.btn-play {
  background: linear-gradient(135deg, var(--pink), var(--purple));
  color: var(--white);
}

.use-item-section {
  border-top: 2px solid var(--border);
  padding-top: 12px;
}

.use-item-label {
  font-family: 'Fredoka One', cursive;
  font-size: 0.9rem;
  color: var(--purple-dark);
  margin-bottom: 8px;
}

.no-items {
  font-size: 0.82rem;
  color: var(--text-light);
}

.use-item-row {
  display: flex;
  gap: 8px;
}

.item-select {
  flex: 1;
  padding: 8px 12px;
  border: 2.5px solid var(--border);
  border-radius: var(--radius);
  font-family: 'Nunito', sans-serif;
  font-size: 0.88rem;
  color: var(--text);
  background: var(--cream);
  outline: none;
  min-width: 0;

  &:focus {
    border-color: var(--purple);
  }
}

.btn-use-item {
  font-family: 'Fredoka One', cursive;
  font-size: 0.88rem;
  padding: 8px 16px;
  border-radius: var(--radius);
  border: none;
  cursor: pointer;
  background: linear-gradient(135deg, var(--green), #3ab85a);
  color: var(--white);
  white-space: nowrap;
  transition: transform 0.15s, opacity 0.2s;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.item-effect-preview {
  font-size: 0.82rem;
  color: var(--purple);
  margin-top: 6px;
  min-height: 18px;
  font-weight: 700;
}

.stat-flash {
  font-size: 0.82rem;
  font-weight: 700;
  text-align: center;
  min-height: 18px;
  transition: opacity 0.4s;
}
</style>

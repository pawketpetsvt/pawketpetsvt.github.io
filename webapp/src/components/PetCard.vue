<template>
  <div class="my-pet-card d-flex flex-column" :class="variantClass">
    <!-- Header banner: the habitat gradient runs to every edge of the card, and
         the avatar straddles the boundary into the body below via
         `.pet-avatar-wrap { margin-bottom: -50px }` + `.pet-card-body`'s 65px
         top padding — the live site's layout, all of it already in the global stylesheet.
         The per-pet gradient is passed as a custom property because the global
         `.pet-habitat` sets `background` with `!important`, which a plain
         inline style would lose to. -->
    <div class="pet-habitat" :style="{ '--pp-habitat': habitatBackground }">
      <div v-if="props.isExploring" class="pp-exploring position-absolute rounded-5">🧭 Exploring</div>
      <div class="pet-avatar-wrap">
        <div class="pet-avatar">
          <img v-if="pet.species.image_file && !imgError" :src="'/images/' + pet.species.image_file" :alt="pet.nickname"
            @error="imgError = true" />
          <span v-else>🐾</span>
        </div>
        <div class="mood-badge">{{ mood.emoji }}</div>
      </div>
    </div>

    <div class="pet-card-body d-flex flex-column gap-px10">
      <div class="pet-card-info w-100">
        <!-- Rename: legacy opened a modal from a pencil button on the card
             (openEditNicknameModal/saveNickname). Editing in place needs no
             modal plumbing and keeps the action next to what it changes. -->
        <div v-if="!editingName" class="d-flex align-items-center justify-content-center gap-2">
          <div class="pet-card-nickname">{{ evolutionEmoji }} {{ pet.nickname }}</div>
          <button class="pp-edit-btn" title="Rename pet" @click="startEditName">✏️</button>
        </div>
        <div v-else class="d-flex align-items-center justify-content-center gap-2">
          <input ref="nameInput" v-model="nameDraft" class="pp-name-input flex-grow-1 min-w-0 py-1 px-px10 text-center" maxlength="30" @keyup.enter="saveName"
            @keyup.esc="editingName = false" />
          <button class="pp-edit-btn" :disabled="savingName" title="Save" @click="saveName">✅</button>
          <button class="pp-edit-btn" title="Cancel" @click="editingName = false">✖️</button>
        </div>

        <div class="pet-stage">({{ stageName }})</div>

        <!-- Variant badge and active pet title, when the pet has them. -->
        <div v-if="variant" class="pet-variant-badge d-inline-block py-1 px-px10 rounded-3"
          :style="{ background: variant.color + '20', borderColor: variant.color, color: variant.color }">
          {{ variant.icon }} {{ variant.name }}
        </div>
        <div v-if="activeTitle" class="pet-title-badge"
          :style="{ color: petCosmeticsService.rarityColor(activeTitle.rarity) }">
          {{ activeTitle.icon }} {{ activeTitle.display_name }}
        </div>

        <div class="pet-card-species d-flex flex-wrap justify-content-center align-items-center gap-2">
          <span v-if="pet.species.vtuber_name">🎭 {{ pet.species.vtuber_name }}</span>
          <a v-if="pet.species.twitch_url" :href="pet.species.twitch_url" target="_blank" class="watch-live py-px2 px-2 rounded-2 ms-px6">Watch
            Live</a>
        </div>

        <div class="pet-bio">{{ backstory }}</div>
        <div class="pet-card-level">Lv. {{ pet.level }} &nbsp;|&nbsp; Max HP: {{ pet.max_hp }}</div>
      </div>

      <div v-if="pet.happiness <= 20 || pet.hunger <= 10" class="sadness-warning">😢 Your pet needs attention!</div>

      <!-- Achievement pips (getAchievements) — derived from this pet's own
           stats, unrelated to the account-wide `user_badges` system. -->
      <div v-if="achievements.length" class="achievements-row">
        <span v-for="a in achievements" :key="a.label" class="ach-badge" :class="a.cls">{{ a.icon }} {{ a.label
        }}</span>
      </div>

      <div class="pet-last-seen">Last interaction: {{ lastSeenText }}</div>

      <!-- Mood readout, ported from makeMyPetCard's `.pet-mood-display`. Colour
           is data-driven so it stays an inline binding. -->
      <div class="pp-mood text-center p-2 rounded-3" :style="{ background: mood.color + '20', borderColor: mood.color, color: mood.color }">
        {{ mood.emoji }} Mood: {{ mood.mood }}
      </div>

      <!-- Character-specific flavour line, chosen by overall condition. -->
      <div v-if="personalityMessage" class="pet-personality-msg text-center py-2 px-tight mt-0 mx-0 mb-2 rounded-2">"{{ personalityMessage }}"</div>

      <PetBattleStats :pet="pet" />
      <PetEquipment :pet="pet" @manage="$emit('manage-equipment', $event)" />

      <!-- 10px gap / 16px block margin come from what actually rendered: the
           global `.stat-bars` rule set both with `!important`, which beat this
           component's scoped 8px. That rule is now deleted and these utilities
           carry the same values. -->
      <div class="d-flex flex-column gap-px10 my-3">
        <StatBar stat="hunger" label="🍖 Hunger" :value="pet.hunger" :max="pet.max_hunger" />
        <StatBar stat="happiness" label="💖 Happiness" :value="pet.happiness" :max="pet.max_happiness" />
        <StatBar stat="energy" label="⚡ Energy" :value="pet.energy" :max="pet.max_energy" />
        <!-- Uses the same StatBar as the three above so it can't drift from them
             again — it previously carried a hand-written copy of the row with a
             thinner, unbordered track and different label/value widths. -->
        <StatBar stat="xp" label="✨ XP" :value="pet.xp" :max="pet.xpForNextLevel" />
      </div>

      <PetWishes :pet-id="pet.id" :pet-name="pet.nickname" />
      <PetQuest :pet-id="pet.id" />

      <!-- Centred wrapping row, NOT the two-column grid this component's scoped
           block used to ask for: the global `.pet-actions` rule set
           `display: flex !important` and won, so the grid never rendered. These
           utilities reproduce what is actually on screen. The class stays as a
           hook for the ≤768px rule that still targets it. -->
      <div class="pet-actions d-flex flex-wrap justify-content-center gap-px6 my-tight">
        <button class="btn-action btn-feed" :disabled="!pet.canFeed || feeding" @click="handleFeed">
          {{ pet.canFeed ? '🍖 Feed' : '🍖 Full!' }}
        </button>
        <button class="btn-action btn-play" :disabled="!pet.canPlay || playing" @click="handlePlay">
          {{ pet.canPlay ? '🎾 Play' : '⚡ Tired!' }}
        </button>
        <button class="btn-action" title="Manage skill loadout" @click="$emit('manage-skills', pet.id)">⚔️
          Skills</button>
        <!-- The PET room (pet_rooms), not the Housing tab's player room. -->
        <button class="btn-action" title="Decorate your pet's room" @click="$emit('manage-room', pet.id)">🏠
          Room</button>
        <button v-if="(pet.stat_points || 0) > 0" class="btn-action pp-statpoints" title="Allocate stat points"
          @click="$emit('allocate-stats', pet.id)">
          📊 Level Up! ({{ pet.stat_points }})
        </button>
        <button class="btn-action btn-variant-selector" title="Manage variants for this pet"
          @click="$emit('manage-variant', pet.id)">
          {{ variant ? `${variant.icon} ${variant.name}` : '🎨 Variant' }}
        </button>
        <button class="btn-action btn-scrapbook" title="Read this pet's scrapbook of memories"
          @click="$emit('scrapbook', pet.id)">📖</button>
        <button class="btn-action btn-snapshot" title="Take a Snapshot of this pet!"
          @click="$emit('snapshot', pet.id)">📸</button>
      </div>

      <!-- Toggles rather than latching: legacy only ever set a companion, so
           once one was chosen there was no way to dismiss it. -->
      <button class="btn-companion w-100 mt-2" :class="{ 'pp-is-companion': isCompanion }" :disabled="settingCompanion"
        :title="isCompanion ? 'Stop this pet following you around' : 'Set as your active companion'"
        @click="toggleCompanion">
        {{ isCompanion ? '🐾 Remove Companion' : '🐾 Set Companion' }}
      </button>

      <div class="use-item-section pt-tight">
        <div class="use-item-label mb-2">🎒 Use an Item</div>
        <p v-if="!inventory.length" class="no-items">No items. <router-link to="/adopt">Visit the adoption
            centre!</router-link></p>
        <!-- 10px gap, again from the global rule that was overriding the scoped 8px. -->
        <div v-else class="d-flex gap-px10 mb-2">
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

      <!-- Ports renderPetTitleSelector(). Locked titles stay listed but disabled,
           showing their unlock condition — that's how the game teaches what's
           obtainable. -->
      <div class="pet-title-selector mt-2">
        <label :for="'pet-title-' + pet.id">🏷️ Pet Title:</label>
        <select :id="'pet-title-' + pet.id" class="pet-title-select" :value="pet.active_pet_title_id || ''"
          @change="changeTitle($event.target.value)">
          <option value="">No Title</option>
          <option v-for="t in unlockedTitles" :key="t.id" :value="t.id">
            {{ t.icon }} {{ t.display_name }} ({{ t.rarity }})
          </option>
          <option v-for="t in lockedTitles" :key="'lock-' + t.id" value="" disabled>
            🔒 ??? — {{ t.unlock_condition }}
          </option>
        </select>
      </div>

      <div class="stat-flash" :style="{ opacity: flashMessage ? 1 : 0, color: flashColor }">{{ flashMessage }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import StatBar from './StatBar.vue'
import { AppState } from '../AppState.js'
import { ownedPetsService } from '../services/OwnedPetsService.js'
import { journalService } from '../services/JournalService.js'
import { toastService } from '../services/ToastService.js'
import { getPetMood } from '../utils/petMood.js'
import {
  getAchievements, getLastSeenText, getHabitatBackground,
  getEvolutionEmoji, getEvolutionStageName, getPetBackstory, getPetPersonalityMessage
} from '../utils/petCard.js'
import { evolutionStage } from '../utils/petSkills.js'
import { petCosmeticsService, cosmeticsState } from '../services/PetCosmeticsService.js'
import { companionService } from '../services/CompanionService.js'
import PetBattleStats from './PetBattleStats.vue'
import PetEquipment from './PetEquipment.vue'
import PetWishes from './PetWishes.vue'
import PetQuest from './pet/PetQuest.vue'

const props = defineProps({
  pet: { type: Object, required: true },
  inventory: { type: Array, required: true },
  discoveries: { type: Object, default: () => ({}) },
  // True while this pet is away on an unclaimed expedition; the banner shows a
  // "🧭 Exploring" pip, matching the legacy card.
  isExploring: { type: Boolean, default: false }
})

// Modals live on the page rather than in every card, so the card just asks.
defineEmits(['manage-equipment', 'manage-skills', 'manage-variant', 'manage-room', 'allocate-stats', 'snapshot', 'scrapbook'])

const imgError = ref(false)
const feeding = ref(false)
const playing = ref(false)
const usingItem = ref(false)
const selectedInvId = ref('')
const flashMessage = ref('')
const flashColor = ref('')

const selectedItem = computed(() => props.inventory.find(i => i.invId === selectedInvId.value) || null)

const editingName = ref(false)
const savingName = ref(false)
const nameDraft = ref('')
const nameInput = ref(null)

const mood = computed(() => getPetMood(
  props.pet.hunger, props.pet.energy, props.pet.happiness,
  props.pet.max_hunger, props.pet.max_energy, props.pet.max_happiness
))
const achievements = computed(() => getAchievements(props.pet))
const lastSeenText = computed(() => getLastSeenText(props.pet.last_fed, props.pet.last_played))
const habitatBackground = computed(() => getHabitatBackground(props.pet.species.vtuber_name))

const stage = computed(() => evolutionStage(props.pet.level || 1))
const evolutionEmoji = computed(() => getEvolutionEmoji(stage.value))
const stageName = computed(() => getEvolutionStageName(stage.value))
const backstory = computed(() => getPetBackstory(props.pet.species.name))

// Pet name first — see the bug note in utils/petCard.js: legacy preferred
// vtuber_name here, which never matches the data's keys.
const personalityMessage = computed(() =>
  getPetPersonalityMessage(props.pet.species.name || props.pet.species.vtuber_name || '', props.pet)
)

const variant = computed(() => petCosmeticsService.variantData(props.pet.current_variant))
// Paints the card's variant aura — the global stylesheet carries a full set of
// `.my-pet-card.pet-variant-*` treatments (glow, corner glyph, image filter).
const variantClass = computed(() => petCosmeticsService.variantClass(props.pet.current_variant))
const activeTitle = computed(() => petCosmeticsService.titleById(props.pet.active_pet_title_id))
const unlockedTitles = computed(() => petCosmeticsService.unlockedTitles(props.pet.id))
const lockedTitles = computed(() => petCosmeticsService.lockedTitles(props.pet.id))
const isCompanion = computed(() => cosmeticsState.companionPetId === props.pet.id)

const settingCompanion = ref(false)

async function toggleCompanion() {
  settingCompanion.value = true
  try {
    if (isCompanion.value) {
      await companionService.clear()
      toastService.info(`${props.pet.nickname} is no longer following you.`)
    } else {
      await companionService.set(props.pet.id)
      toastService.success(`🐾 ${props.pet.nickname} is now your companion!`)
    }
  } catch (err) {
    toastService.error(err.message)
  } finally {
    settingCompanion.value = false
  }
}

async function changeTitle(titleId) {
  try {
    await petCosmeticsService.setTitle(props.pet.id, titleId)
    props.pet.active_pet_title_id = titleId || null
    toastService.success(titleId ? 'Pet title updated!' : 'Pet title cleared.')
  } catch (err) {
    toastService.error(err.message)
  }
}

async function startEditName() {
  nameDraft.value = props.pet.nickname
  editingName.value = true
  await nextTick()
  nameInput.value?.select()
}

async function saveName() {
  savingName.value = true
  try {
    await ownedPetsService.rename(props.pet, nameDraft.value)
    editingName.value = false
    toastService.success('Nickname updated! ✨')
  } catch (err) {
    toastService.error(err.message)
  } finally {
    savingName.value = false
  }
}

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
    // The companion brings this up later when you're in the Shop — legacy's
    // `CompanionBuddy.lastFoodUsed` (game.js:3751).
    companionService.remember({ lastFoodUsed: item.name })
    selectedInvId.value = ''
  } catch (err) {
    toastService.error('Error: ' + err.message)
  } finally {
    usingItem.value = false
  }
}
</script>

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.my-pet-card {
  background: var(--white) !important;
  border: 4px solid var(--border) !important;
  border-radius: var(--radius-xl) !important;
  overflow: hidden !important;
  box-shadow: 0 8px 24px rgba(153,102,255,0.25) !important;
  transition: all 0.3s !important;
  position: relative !important;
}
.my-pet-card:hover {
  transform: translateY(-8px) scale(1.02) !important;
  box-shadow: 0 16px 40px rgba(153,102,255,0.35) !important;
}
.pet-habitat {
  position: relative !important;
  height: 180px !important;
  display: flex !important;
  align-items: flex-end !important;
  justify-content: center !important;
  padding: 20px !important;
  background: linear-gradient(135deg, var(--purple-light), var(--pink-light)) !important;
  border-bottom: 4px solid rgba(255,255,255,0.4) !important;
}
.pet-avatar-wrap {
  position: relative !important;
  z-index: 2 !important;
  margin-bottom: -50px !important;
}
.pet-avatar {
  width: 120px !important;
  height: 120px !important;
  border-radius: 50% !important;
  border: 5px solid var(--white) !important;
  background: linear-gradient(135deg, var(--purple-light), var(--pink-light)) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 4rem !important;
  overflow: hidden !important;
  box-shadow: 0 8px 24px rgba(153,102,255,0.4) !important;
  position: relative !important;
}
.pet-avatar img {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}
.mood-badge {
  position: absolute !important;
  bottom: -5px !important;
  right: -5px !important;
  width: 45px !important;
  height: 45px !important;
  border-radius: 50% !important;
  background: var(--white) !important;
  border: 3px solid var(--purple) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 1.8rem !important;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
}
.pet-card-body {
  padding: 65px 16px 20px !important;
  position: relative !important;
}
.pet-card-nickname {
  font-family: 'Chewy', cursive !important;
  font-size: 1.8rem !important;
  color: var(--purple-dark) !important;
  margin-bottom: 6px !important;
  text-shadow: 2px 2px 0 var(--pink-light) !important;
}
.pet-card-species {
  font-size: 0.95rem !important;
  color: var(--text-light) !important;
  font-weight: 700 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.5px !important;
  margin-bottom: 4px !important;
}
.pet-card-level {
  font-size: 0.85rem !important;
  color: var(--text) !important;
  font-weight: 600 !important;
  background: rgba(153,102,255,0.1) !important;
  padding: 4px 12px !important;
  border-radius: 15px !important;
  display: inline-block !important;
}
.pet-last-seen {
  text-align: center !important;
  font-size: 0.8rem !important;
  color: var(--text-light) !important;
  margin-bottom: 12px !important;
  font-weight: 500 !important;
}
.achievements-row {
  display: flex !important;
  gap: 6px !important;
  flex-wrap: wrap !important;
  justify-content: center !important;
  margin-bottom: 12px !important;
}
.sadness-warning {
  background: linear-gradient(135deg, #ffe6e6, #ffcccc) !important;
  border: 3px solid #ff6b6b !important;
  border-radius: 20px !important;
  padding: 10px 16px !important;
  text-align: center !important;
  font-family: 'Chewy', cursive !important;
  font-size: 0.95rem !important;
  color: #cc0000 !important;
  margin-bottom: 12px !important;
  font-weight: 600 !important;
  animation: pulse-warning 2s ease-in-out infinite !important;
}
.btn-action {
  flex: 1 1 auto !important;
  min-width: 72px !important;
  touch-action: manipulation !important;
  -webkit-tap-highlight-color: transparent !important;
  max-width: calc(50% - 4px) !important;
  font-family: 'Chewy', cursive !important;
  font-size: 0.88rem !important;
  padding: 8px 10px !important;
  border-radius: 25px !important;
  border: 3px solid transparent !important;
  cursor: pointer !important;
  transition: all 0.2s !important;
  font-weight: 600 !important;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
  white-space: nowrap !important;
  text-align: center !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}
.btn-action:hover:not(:disabled) {
  transform: translateY(-3px) !important;
  box-shadow: 0 6px 16px rgba(0,0,0,0.25) !important;
}
.btn-action:disabled {
  opacity: 0.5 !important;
  cursor: not-allowed !important;
}
.btn-feed {
  background: linear-gradient(135deg, #ff9966, #ff6699) !important;
  color: var(--white) !important;
  border-color: rgba(255,255,255,0.4) !important;
}
.btn-play {
  background: linear-gradient(135deg, #66ff99, #33ccaa) !important;
  color: var(--white) !important;
  border-color: rgba(255,255,255,0.4) !important;
}
.use-item-section {
  margin-top: 16px !important;
  padding-top: 16px !important;
  border-top: 2px solid rgba(153,102,255,0.2) !important;
}
.use-item-label {
  font-family: 'Chewy', cursive !important;
  font-size: 1rem !important;
  color: var(--purple-dark) !important;
  margin-bottom: 10px !important;
  font-weight: 600 !important;
}
.item-select {
  flex: 1 !important;
  padding: 10px 14px !important;
  border: 3px solid var(--border) !important;
  border-radius: 20px !important;
  font-family: 'Fredoka', cursive !important;
  font-size: 0.9rem !important;
  background: rgba(255,255,255,0.9) !important;
  color: var(--text) !important;
  cursor: pointer !important;
  transition: all 0.2s !important;
}
.item-select:focus {
  outline: none !important;
  border-color: var(--purple) !important;
  box-shadow: 0 0 0 3px rgba(153,102,255,0.2) !important;
}
.btn-use-item {
  font-family: 'Chewy', cursive !important;
  font-size: 0.95rem !important;
  padding: 10px 24px !important;
  border-radius: 25px !important;
  background: linear-gradient(135deg, var(--yellow), var(--orange)) !important;
  color: var(--text) !important;
  border: 3px solid rgba(255,255,255,0.5) !important;
  cursor: pointer !important;
  transition: all 0.2s !important;
  font-weight: 600 !important;
  box-shadow: 0 3px 8px rgba(0,0,0,0.15) !important;
}
.btn-use-item:hover:not(:disabled) {
  transform: translateY(-2px) !important;
  box-shadow: 0 5px 12px rgba(0,0,0,0.25) !important;
}
.btn-use-item:disabled {
  opacity: 0.7 !important;
  cursor: not-allowed !important;
  background: linear-gradient(135deg, #cccccc, #999999) !important;
}
.item-effect-preview {
  font-size: 0.85rem !important;
  color: var(--text-light) !important;
  margin-top: 6px !important;
  font-weight: 500 !important;
  font-style: italic !important;
}
.stat-flash {
  position: absolute !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  background: rgba(255,255,255,0.98) !important;
  border: 3px solid var(--purple) !important;
  border-radius: 25px !important;
  padding: 16px 28px !important;
  font-family: 'Chewy', cursive !important;
  font-size: 1.2rem !important;
  color: var(--purple-dark) !important;
  opacity: 0 !important;
  pointer-events: none !important;
  z-index: 10 !important;
  box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important;
  text-align: center !important;
  font-weight: 600 !important;
}
.pet-title-select {
  padding: 10px 15px;
  border: 2px solid var(--border);
  border-radius: var(--radius);
  background: var(--white);
  color: var(--text);
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}
.pet-title-select:hover {
  border-color: var(--primary);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
}
.pet-title-select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}
.pet-title-badge {
  display: inline-block;
  font-size: 0.9rem;
  font-weight: 600;
  margin-top: 4px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.1);
}
.pet-title-selector {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid var(--border);
}
.pet-title-selector label {
  display: block;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 8px;
}
.my-pet-card[class*="pet-variant-"] {
  overflow: visible !important;
  position: relative !important;
}
.my-pet-card[class*="pet-variant-"]::before {
  content: '✦';
  position: absolute;
  top: -14px;
  right: -14px;
  font-size: 2rem;
  pointer-events: none;
  z-index: 200;
  filter: drop-shadow(0 2px 6px rgba(0,0,0,0.5));
  animation: badgeHover 2.5s ease-in-out infinite;
}
.my-pet-card[class*="pet-variant-"]::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
  border-radius: inherit;
}
.pet-title-select {
  width: 100%;
  padding: 12px 15px;
  border: 2px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 0.95rem;
  font-family: inherit;
  background: var(--white);
  cursor: pointer;
  transition: border-color 0.2s;
}
.pet-title-select:hover { border-color: var(--purple); }
.pet-title-select:focus {
  outline: none;
  border-color: var(--purple);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}
.pet-title-select option[disabled] {
  color: var(--text-light);
  font-style: italic;
}
.pet-title-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pet-title-selector label {
  font-weight: 600;
  color: var(--text);
  font-size: 0.9rem;
}
.pet-title-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 15px;
  font-size: 0.85rem;
  font-weight: bold;
  background: rgba(99, 102, 241, 0.1);
  margin-top: 8px;
  text-align: center;
}
body.night-mode .sadness-warning {
  background: linear-gradient(135deg, rgba(255, 107, 107, 0.25), rgba(255, 82, 82, 0.25)) !important;
  border: 3px solid #ff6b6b !important;
  color: #ffcccc !important;
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3) !important;
}
.pet-stage {
  text-align: center !important;
  font-size: 0.85rem !important;
  color: var(--text-light) !important;
  margin: 0 0 6px !important;
  white-space: normal !important;
}
.pet-bio {
  font-size: 0.85rem !important;
  color: var(--text-light) !important;
  text-align: center !important;
  font-style: italic !important;
  line-height: 1.4 !important;
  padding: 0 8px !important;
  word-wrap: break-word !important;
  overflow-wrap: break-word !important;
  white-space: normal !important;
  margin: 0 0 6px !important;
  display: -webkit-box !important;
  -webkit-line-clamp: 3 !important;
  -webkit-box-orient: vertical !important;
  overflow: hidden !important;
}
.my-pet-card { overflow: visible !important; }
.pet-card-body {
  overflow: visible !important;
  word-wrap: break-word !important;
  overflow-wrap: break-word !important;
}
.btn-variant-selector {
  width: 100%;
  padding: 8px 10px;
  margin-top: 4px;
  font-size: 0.82rem;
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  color: white;
  border: none;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-variant-selector:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}
body.night-mode .btn-variant-selector { background: linear-gradient(135deg, #6d28d9, #4f46e5) !important; }
.my-pet-card[class*="pet-variant-"] { overflow: visible !important; }
@media (max-width: 768px) {
  .btn-action, .btn-companion, .btn-variant-selector { min-height: 40px !important; }
  .pet-actions { flex-wrap: wrap !important; gap: 6px !important; }
}

@keyframes pulse-warning {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

@keyframes badgeHover {
  0%,100% { transform: translateY(0) scale(1); }
  50%      { transform: translateY(-6px) scale(1.15); }
}

// `.my-pet-card`, `.pet-habitat`, `.pet-avatar-wrap`, `.pet-avatar` and
// `.pet-card-body` are all fully owned by the global stylesheet — including the
// 180px banner, the avatar's -50px overhang and the body's 65px top padding
// that clears it. The card carries no padding of its own so the banner reaches
// every edge; the body supplies the padding instead.
// The card's own stacking is `d-flex flex-column` in the template.

// The card is `overflow: visible` (legacy style.css:14651 overrides the earlier
// `hidden`), so the banner has to round its own top corners or it would square
// off the card's.
//
// The radius must be the card's INNER one, not its outer: the card is
// `border-radius: 40px` with a `4px` border, and a border-box curve of 40px
// leaves a 36px curve on the inside of it. Matching 40px here left a sliver of
// the card's white background visible in both top corners.
.pet-habitat {
  background: var(--pp-habitat) !important;
  border-top-left-radius: calc(var(--radius-xl) - 4px);
  border-top-right-radius: calc(var(--radius-xl) - 4px);
}

// The body stacks its sections (`d-flex flex-column gap-px10` in the template);
// legacy relied on each child's own margins.

.pp-exploring {
  top: 8px;
  left: 8px;
  background: rgba(153, 102, 255, 0.85);
  color: var(--white);
  font-size: 0.68rem;
  font-weight: 700;
  padding: 3px 8px;
  z-index: 10;
}

.pp-edit-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.95rem;
  line-height: 1;
  padding: 2px 4px;
  border-radius: 6px;
  opacity: 0.65;
  transition: opacity 0.15s, background 0.15s;

  &:hover:not(:disabled) {
    opacity: 1;
    background: var(--purple-light);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}

.pp-name-input {
  max-width: 220px;
  border: 2.5px solid var(--purple);
  border-radius: var(--radius);
  font-family: 'Fredoka One', cursive;
  font-size: 1rem;
  color: var(--purple-dark);
  background: var(--cream);
  outline: none;
}

.pp-mood {
  border: 2px solid;
  font-weight: 700;
  font-size: 0.9rem;
}

// `.pet-personality-msg`, `.btn-snapshot`, `.btn-companion` and
// `.pet-variant-badge` were inline-styled in the legacy card and have NO base
// rule in the global stylesheet, so they're owned here — the same gap `.ach-badge` had.
// (An earlier version of this comment claimed the latter two were styled
// globally; they are not. `.btn-companion` appears in the global stylesheet only inside two
// media queries — an exclusion list and a mobile min-height — and
// `.pet-variant-badge` appears nowhere at all, so the card was rendering a bare
// browser button and an unboxed badge.)
//
// Genuinely global and left alone, verified rule by rule: `.pet-stage`,
// `.pet-bio`, `.pet-title-badge`, `.pet-title-select*`, `.btn-variant-selector`.
.pet-personality-msg {
  font-size: 0.82rem;
  color: var(--text-light);
  font-style: italic;
  background: rgba(153, 102, 255, 0.06);
  line-height: 1.5;
}

.btn-scrapbook,
.btn-snapshot {
  transition: transform 0.15s;

  &:hover {
    transform: scale(1.1);
  }
}

.pp-statpoints {
  background: linear-gradient(135deg, #ffb302, #ffdd55);
  color: #5a3d00;
  font-weight: 800;
}

// Ports the inline styling legacy applied in makeMyPetCard (game.js:4140).
// Width and top margin come from the `w-100 mt-2` utilities on the element.
.btn-companion {
  padding: 8px 10px;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--white);
  background: linear-gradient(135deg, #9966ff 0%, #ff66cc 100%);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.2s;

  &:hover:not(:disabled) {
    transform: scale(1.02);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

// The active companion's button removes rather than sets, so it reads as a
// distinct action instead of the disabled-looking state it used to have.
.pp-is-companion {
  background: var(--white);
  border: 2px solid var(--purple);
  color: var(--purple);
}

// Legacy set the padding/radius/font inline alongside the colors; only the
// colors are bound in the template (they vary per variant), so the box itself
// belongs here.
.pet-variant-badge {
  border: 2px solid;
  font-size: 0.85rem;
  font-weight: 700;
}

// `.achievements-row` is styled globally, but `.ach-badge` itself has no base
// rule anywhere (the global stylesheet defines only an `.ach-badge.trained` variant that
// nothing produces), so the pips would render as bare text. Owned here.
.ach-badge {
  font-family: 'Chewy', cursive;
  font-size: 0.72rem;
  padding: 3px 9px;
  border-radius: 20px;
  color: var(--white);
  white-space: nowrap;
  box-shadow: 0 2px 6px var(--shadow);

  &.gold {
    background: linear-gradient(135deg, #ffb302, #ffdd55);
    color: #5a3d00;
  }

  &.silver {
    background: linear-gradient(135deg, #b9c6d1, #e8eef3);
    color: #3d4750;
  }

  &.bronze {
    background: linear-gradient(135deg, #c87f3d, #e8ac74);
  }

  &.purple {
    background: linear-gradient(135deg, var(--purple), var(--pink));
  }
}

// `.pet-avatar` is deliberately NOT overridden any more. The global rule makes
// it 120px with a white ring and shadow — the size the overhanging split-header
// layout is built around. The earlier 80px override here existed only because
// the avatar used to sit inline above centred text.

.pet-card-info {
  flex: 1;
  min-width: 0;
  // `.pet-card-level` is `display: inline-block !important`, so it centres via
  // its parent's text-align rather than any flex rule. The old `.pet-card-top`
  // wrapper supplied that; the split-header layout has to supply it here.
  text-align: center;
}

.pet-card-nickname {
  font-family: 'Fredoka One', cursive;
  font-size: 1.3rem;
  color: var(--purple-dark);
  // Wraps rather than truncating: the global stylesheet overrides this to 1.8rem
  // !important, at which point a long name would otherwise be ellipsised away
  // instead of using the full width of the (now centred) card.
  max-width: 100%;
  overflow-wrap: anywhere;
  line-height: 1.15;
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
  color: white !important;
  font-family: 'Fredoka One', cursive;
  text-decoration: none;
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

// `.stat-bars` and `.pet-actions` rules used to live here and were BOTH dead —
// the global copies in the global stylesheet carried `!important`, which outranks a scoped
// rule's higher specificity. Their real values now sit on the elements as
// utilities and the global rules are deleted.

.btn-action {
  font-family: 'Fredoka One', cursive;
  font-size: 0.95rem;
  // Neither 9px nor a 24px radius has an exact utility (the radius scale tops
  // out at 20px), so the shorthand stays rather than drifting.
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
}

.use-item-label {
  font-family: 'Fredoka One', cursive;
  font-size: 0.9rem;
  color: var(--purple-dark);
}

.no-items {
  font-size: 0.82rem;
  color: var(--text-light);
}

// The global `.item-select` (legacy style.css:1137) owns this control's padding,
// border, radius, font and background, all with `!important`, so those are
// left to it. Only the native dropdown button is replaced here.
//
// `appearance: none` removes that button — on Windows it is a separate control
// with its own blue hover highlight, which is what was showing at the right
// edge and clashing with the theme — and a themed chevron is drawn in its
// place. The background declarations need `!important` because the global rule
// sets the `background` SHORTHAND with `!important`, and a shorthand resets
// `background-image` to none; without it the chevron would silently not paint.
.item-select {
  min-width: 0;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  padding-right: 34px !important; // clearance for the chevron
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%239966ff' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 6l5 5 5-5'/%3E%3C/svg%3E") !important;
  background-repeat: no-repeat !important;
  background-position: right 12px center !important;
  background-size: 14px !important;

  &::-ms-expand {
    display: none;
  }
}

// The pet-title dropdown is the same kind of control and had the same native
// button. Its global rule uses no `!important`, so plain declarations win here.
//
// Border styling is matched to the item select above, which differed in three
// ways. Two were deliberate design drift, one was a latent bug:
//   • 2px border            -> 3px, as `.item-select` uses
//   • `var(--radius-md)`    -> 20px. **--radius-md is never defined anywhere in
//     the global stylesheet**, so that declaration was dropped by the browser and the
//     control rendered with square corners — on the live site too. Same class
//     of bug as the undefined `--bs-border-radius-*` found in Phase 6.5.
//   • focus ring `rgba(99,102,241,0.1)` -> `rgba(153,102,255,0.2)`; the former
//     is an indigo left over from elsewhere, not the site's purple.
.pet-title-select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  padding-right: 34px;
  border: 3px solid var(--border);
  border-radius: 20px;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%239966ff' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 6l5 5 5-5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 14px;

  &:focus {
    outline: none;
    border-color: var(--purple);
    box-shadow: 0 0 0 3px rgba(153, 102, 255, 0.2);
  }

  &::-ms-expand {
    display: none;
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

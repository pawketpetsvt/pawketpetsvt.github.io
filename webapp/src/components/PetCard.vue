<template>
  <div class="my-pet-card" :class="variantClass">
    <!-- Header banner: the habitat gradient runs to every edge of the card, and
         the avatar straddles the boundary into the body below via
         `.pet-avatar-wrap { margin-bottom: -50px }` + `.pet-card-body`'s 65px
         top padding — the live site's layout, all of it already in style.css.
         The per-pet gradient is passed as a custom property because the global
         `.pet-habitat` sets `background` with `!important`, which a plain
         inline style would lose to. -->
    <div class="pet-habitat" :style="{ '--pp-habitat': habitatBackground }">
      <div v-if="props.isExploring" class="pp-exploring">🧭 Exploring</div>
      <div class="pet-avatar-wrap">
        <div class="pet-avatar">
          <img v-if="pet.species.image_file && !imgError" :src="'/images/' + pet.species.image_file"
            :alt="pet.nickname" @error="imgError = true" />
          <span v-else>🐾</span>
        </div>
        <div class="mood-badge">{{ mood.emoji }}</div>
      </div>
    </div>

    <div class="pet-card-body">
      <div class="pet-card-info w-100">
        <!-- Rename: legacy opened a modal from a pencil button on the card
             (openEditNicknameModal/saveNickname). Editing in place needs no
             modal plumbing and keeps the action next to what it changes. -->
        <div v-if="!editingName" class="d-flex align-items-center justify-content-center gap-2">
          <div class="pet-card-nickname">{{ evolutionEmoji }} {{ pet.nickname }}</div>
          <button class="pp-edit-btn" title="Rename pet" @click="startEditName">✏️</button>
        </div>
        <div v-else class="d-flex align-items-center justify-content-center gap-2">
          <input ref="nameInput" v-model="nameDraft" class="pp-name-input" maxlength="30"
            @keyup.enter="saveName" @keyup.esc="editingName = false" />
          <button class="pp-edit-btn" :disabled="savingName" title="Save" @click="saveName">✅</button>
          <button class="pp-edit-btn" title="Cancel" @click="editingName = false">✖️</button>
        </div>

        <div class="pet-stage">({{ stageName }})</div>

        <!-- Variant badge and active pet title, when the pet has them. -->
        <div v-if="variant" class="pet-variant-badge"
          :style="{ background: variant.color + '20', borderColor: variant.color, color: variant.color }">
          {{ variant.icon }} {{ variant.name }}
        </div>
        <div v-if="activeTitle" class="pet-title-badge"
          :style="{ color: petCosmeticsService.rarityColor(activeTitle.rarity) }">
          {{ activeTitle.icon }} {{ activeTitle.display_name }}
        </div>

        <div class="pet-card-species d-flex flex-wrap justify-content-center align-items-center gap-2">
          <span v-if="pet.species.vtuber_name">🎭 {{ pet.species.vtuber_name }}</span>
          <a v-if="pet.species.twitch_url" :href="pet.species.twitch_url" target="_blank" class="watch-live">Watch
            Live</a>
        </div>

        <div class="pet-bio">{{ backstory }}</div>
        <div class="pet-card-level">Lv. {{ pet.level }} &nbsp;|&nbsp; Max: {{ pet.max_hunger }}</div>
      </div>

      <div v-if="pet.happiness <= 20 || pet.hunger <= 10" class="sadness-warning">😢 Your pet needs attention!</div>

      <!-- Achievement pips (getAchievements) — derived from this pet's own
           stats, unrelated to the account-wide `user_badges` system. -->
      <div v-if="achievements.length" class="achievements-row">
        <span v-for="a in achievements" :key="a.label" class="ach-badge" :class="a.cls">{{ a.icon }} {{ a.label }}</span>
      </div>

      <div class="pet-last-seen">Last interaction: {{ lastSeenText }}</div>

      <!-- Mood readout, ported from makeMyPetCard's `.pet-mood-display`. Colour
           is data-driven so it stays an inline binding. -->
      <div class="pp-mood" :style="{ background: mood.color + '20', borderColor: mood.color, color: mood.color }">
        {{ mood.emoji }} Mood: {{ mood.mood }}
      </div>

      <!-- Character-specific flavour line, chosen by overall condition. -->
      <div v-if="personalityMessage" class="pet-personality-msg">"{{ personalityMessage }}"</div>

      <PetBattleStats :pet="pet" />
      <PetEquipment :pet="pet" @manage="$emit('manage-equipment', $event)" />

      <div class="stat-bars">
        <StatBar stat="hunger" label="🍖 Hunger" :value="pet.hunger" :max="pet.max_hunger" />
        <StatBar stat="happiness" label="💖 Happiness" :value="pet.happiness" :max="pet.max_happiness" />
        <StatBar stat="energy" label="⚡ Energy" :value="pet.energy" :max="pet.max_energy" />
        <!-- Uses the same StatBar as the three above so it can't drift from them
             again — it previously carried a hand-written copy of the row with a
             thinner, unbordered track and different label/value widths. -->
        <StatBar stat="xp" label="✨ XP" :value="pet.xp" :max="pet.xpForNextLevel" />
      </div>

      <PetWishes :pet-id="pet.id" :pet-name="pet.nickname" />

      <div class="pet-actions">
        <button class="btn-action btn-feed" :disabled="!pet.canFeed || feeding" @click="handleFeed">
          {{ pet.canFeed ? '🍖 Feed' : '🍖 Full!' }}
        </button>
        <button class="btn-action btn-play" :disabled="!pet.canPlay || playing" @click="handlePlay">
          {{ pet.canPlay ? '🎾 Play' : '⚡ Tired!' }}
        </button>
        <button class="btn-action" title="Manage skill loadout" @click="$emit('manage-skills', pet.id)">⚔️ Skills</button>
        <!-- Room decoration belongs to the Housing tab, which is Phase 8. The
             button is kept so the card matches the live site rather than
             silently losing an action, and says so plainly when pressed. -->
        <button class="btn-action" title="Decorate your pet's room" @click="roomComingSoon">🏠 Room</button>
        <button v-if="(pet.stat_points || 0) > 0" class="btn-action pp-statpoints"
          title="Allocate stat points" @click="$emit('allocate-stats', pet.id)">
          📊 Level Up! ({{ pet.stat_points }})
        </button>
        <button class="btn-action btn-variant-selector" title="Manage variants for this pet"
          @click="$emit('manage-variant', pet.id)">
          {{ variant ? `${variant.icon} ${variant.name}` : '🎨 Variant' }}
        </button>
        <button class="btn-action btn-snapshot" title="Take a Snapshot of this pet!"
          @click="$emit('snapshot', pet.id)">📸</button>
      </div>

      <button class="btn-companion w-100 mt-2" :class="{ 'pp-is-companion': isCompanion }"
        :disabled="isCompanion || settingCompanion" title="Set as your active companion" @click="makeCompanion">
        {{ isCompanion ? '🐾 Active Companion ✓' : '🐾 Set Companion' }}
      </button>

      <div class="use-item-section">
        <div class="use-item-label">🎒 Use an Item</div>
        <p v-if="!inventory.length" class="no-items">No items. <router-link to="/adopt">Visit the adoption
            centre!</router-link></p>
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
import PetBattleStats from './PetBattleStats.vue'
import PetEquipment from './PetEquipment.vue'
import PetWishes from './PetWishes.vue'

const props = defineProps({
  pet: { type: Object, required: true },
  inventory: { type: Array, required: true },
  discoveries: { type: Object, default: () => ({}) },
  // True while this pet is away on an unclaimed expedition; the banner shows a
  // "🧭 Exploring" pip, matching the legacy card.
  isExploring: { type: Boolean, default: false }
})

// Modals live on the page rather than in every card, so the card just asks.
defineEmits(['manage-equipment', 'manage-skills', 'manage-variant', 'allocate-stats', 'snapshot'])

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
// Paints the card's variant aura — style.css carries a full set of
// `.my-pet-card.pet-variant-*` treatments (glow, corner glyph, image filter).
const variantClass = computed(() => petCosmeticsService.variantClass(props.pet.current_variant))
const activeTitle = computed(() => petCosmeticsService.titleById(props.pet.active_pet_title_id))
const unlockedTitles = computed(() => petCosmeticsService.unlockedTitles(props.pet.id))
const lockedTitles = computed(() => petCosmeticsService.lockedTitles(props.pet.id))
const isCompanion = computed(() => cosmeticsState.companionPetId === props.pet.id)

const settingCompanion = ref(false)

async function makeCompanion() {
  settingCompanion.value = true
  try {
    await petCosmeticsService.setCompanion(props.pet.id)
    toastService.success(`🐾 ${props.pet.nickname} is now your companion!`)
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

function roomComingSoon() {
  toastService.info('Pet rooms arrive with the Housing tab — coming soon!')
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
    selectedInvId.value = ''
  } catch (err) {
    toastService.error('Error: ' + err.message)
  } finally {
    usingItem.value = false
  }
}
</script>

<style lang="scss" scoped>
// `.my-pet-card`, `.pet-habitat`, `.pet-avatar-wrap`, `.pet-avatar` and
// `.pet-card-body` are all fully owned by the root style.css — including the
// 180px banner, the avatar's -50px overhang and the body's 65px top padding
// that clears it. The card carries no padding of its own so the banner reaches
// every edge; the body supplies the padding instead.
.my-pet-card {
  display: flex;
  flex-direction: column;
}

// The card is `overflow: visible` (style.css:14651 overrides the earlier
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

// The body stacks its sections; legacy relied on each child's own margins.
.pet-card-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pp-exploring {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(153, 102, 255, 0.85);
  color: var(--white);
  font-size: 0.68rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 20px;
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
  flex: 1;
  min-width: 0;
  max-width: 220px;
  padding: 4px 10px;
  border: 2.5px solid var(--purple);
  border-radius: var(--radius);
  font-family: 'Fredoka One', cursive;
  font-size: 1rem;
  color: var(--purple-dark);
  background: var(--cream);
  outline: none;
  text-align: center;
}

.pp-mood {
  text-align: center;
  padding: 8px;
  border: 2px solid;
  border-radius: 12px;
  font-weight: 700;
  font-size: 0.9rem;
}

// `.pet-personality-msg` and `.btn-snapshot` were inline-styled in the legacy
// card and have no global rule, so they're owned here. Everything else on the
// card (`.pet-stage`, `.pet-bio`, `.pet-variant-badge`, `.pet-title-badge`,
// `.pet-title-select*`, `.btn-companion`, `.btn-variant-selector`) already has
// one in style.css and is left alone.
.pet-personality-msg {
  font-size: 0.82rem;
  color: var(--text-light);
  font-style: italic;
  text-align: center;
  padding: 8px 12px;
  margin: 0 0 8px;
  background: rgba(153, 102, 255, 0.06);
  border-radius: 10px;
  line-height: 1.5;
}

.btn-snapshot {
  transition: transform 0.15s;

  &:hover { transform: scale(1.1); }
}

.pp-statpoints {
  background: linear-gradient(135deg, #ffb302, #ffdd55);
  color: #5a3d00;
  font-weight: 800;
}

.pp-is-companion {
  opacity: 0.75;
  cursor: default;
}

// `.achievements-row` is styled globally, but `.ach-badge` itself has no base
// rule anywhere (style.css defines only an `.ach-badge.trained` variant that
// nothing produces), so the pips would render as bare text. Owned here.
.ach-badge {
  font-family: 'Chewy', cursive;
  font-size: 0.72rem;
  padding: 3px 9px;
  border-radius: 20px;
  color: var(--white);
  white-space: nowrap;
  box-shadow: 0 2px 6px var(--shadow);

  &.gold { background: linear-gradient(135deg, #ffb302, #ffdd55); color: #5a3d00; }
  &.silver { background: linear-gradient(135deg, #b9c6d1, #e8eef3); color: #3d4750; }
  &.bronze { background: linear-gradient(135deg, #c87f3d, #e8ac74); }
  &.purple { background: linear-gradient(135deg, var(--purple), var(--pink)); }
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
  // Wraps rather than truncating: the root style.css overrides this to 1.8rem
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

// The global `.item-select` (style.css:1137) owns this control's padding,
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
//     style.css**, so that declaration was dropped by the browser and the
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

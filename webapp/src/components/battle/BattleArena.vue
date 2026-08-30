<template>
  <div>
    <div v-if="phaseFlash" class="pp-phase-flash position-fixed"></div>

    <!-- Zone modifier banner. Only zones with a real mechanic show one. -->
    <div v-if="zoneMod && zoneMod.type !== 'none'" class="pp-zone-banner mb-3 text-center py-2 px-tight">
      {{ zoneMod.label }}: {{ zoneMod.desc }}
    </div>

    <div class="battle-container">
      <div class="battle-side battle-player">
        <div class="battle-sprite-container">
          <div class="battle-sprite player-sprite" :class="{ 'pp-attack': cue.playerAttack, 'pp-hit': cue.playerHit }"
            :style="playerSpriteStyle">
            <span v-if="!s.player?.imageFile">🐾</span>
          </div>
        </div>
        <div class="battle-name">{{ s.player?.name }}</div>
        <div class="battle-hp-container">
          <div class="battle-hp-label"><span>HP</span><span>{{ s.playerHP }}/{{ s.playerMaxHP }}</span></div>
          <div class="battle-hp-bar">
            <div class="battle-hp-fill" :style="{ width: pct(s.playerHP, s.playerMaxHP) + '%' }"></div>
          </div>
        </div>
        <StatusRow :statuses="s.playerStatuses" />
      </div>

      <div class="battle-vs">VS</div>

      <div class="battle-side battle-enemy">
        <div class="battle-sprite-container">
          <div class="battle-sprite enemy-sprite"
            :class="{ 'pp-attack': cue.enemyAttack, 'pp-hit': cue.enemyHit }"
            :style="enemySpriteStyle">{{ enemyEmoji }}</div>
        </div>
        <div class="battle-name">{{ s.enemy?.is_boss ? '⚠️ ' : '' }}{{ s.enemy?.name }}</div>
        <div class="battle-hp-container">
          <!-- Bosses hide their real numbers, as in the legacy fight. -->
          <div class="battle-hp-label">
            <span>HP</span><span>{{ s.enemy?.is_boss ? '???/???' : s.enemyHP + '/' + s.enemyMaxHP }}</span>
          </div>
          <div class="battle-hp-bar">
            <div class="battle-hp-fill" :class="{ 'pp-boss-hp': s.enemy?.is_boss }"
              :style="{ width: pct(s.enemyHP, s.enemyMaxHP) + '%' }"></div>
          </div>
        </div>
        <StatusRow :statuses="s.enemyStatuses" />

        <!-- Melody counter — Piper only. The melody damages every third tick
             regardless of what either side does, so the countdown is the real
             information here. -->
        <div v-if="fightingPiper" class="pp-melody text-center mt-px6">
          🎵 Melody: {{ s.piperMelody || 0 }}
          <span v-if="melodyIn <= 1" class="pp-melody-warn"> — Resonates next turn</span>
          <span v-else class="pp-melody-soft"> — resonates in {{ melodyIn }}</span>
        </div>
      </div>
    </div>

    <!-- Piper's Influence. Dormant unless world-state corruption is high
         enough (see tickInfluence), so it only appears once it starts filling
         rather than sitting at a permanent 0%. -->
    <div v-if="fightingPiper && s.piperInfluence > 0" class="pp-influence mt-2">
      <div class="pp-influence-head d-flex justify-content-between align-items-center">
        <span>👁️ Piper's Influence</span>
        <span>{{ s.piperInfluence }}%</span>
      </div>
      <div class="pp-influence-track rounded-5 overflow-hidden">
        <div class="pp-influence-fill h-100 rounded-5" :style="{ width: s.piperInfluence + '%' }"></div>
      </div>
    </div>

    <div class="pp-narrative mt-3 py-px10 px-px14 rounded-3">
      <p v-for="(line, i) in s.narrative" :key="i" class="m-0">{{ line }}</p>
    </div>

    <div v-if="s.phase === 'fighting'" class="mt-3">
      <div class="text-center pp-turn">TURN {{ s.turn }}</div>

      <!-- Ports manualBattle_showItemPicker(). Using an item costs the turn,
           which the heading says outright as legacy's did. -->
      <div v-if="showItems" class="pp-item-picker rounded-4 p-px10 mb-2">
        <div class="pp-item-head mb-2">🎒 Use an Item (costs your turn)</div>
        <button v-for="item in usableItems" :key="item.invId" class="pp-item-row" :disabled="s.processing"
          @click="useItem(item)">
          <strong>{{ item.name }}</strong>
          <span class="pp-item-effect">{{ battleService.itemBattleLabel(item) }}</span>
          <span class="pp-item-qty">×{{ item.qty }}</span>
        </button>
        <button class="pp-item-cancel w-100 p-px6 rounded-1" @click="showItems = false">Cancel</button>
      </div>

      <div class="row row-cols-3 g-2 mt-1">
        <div class="col"><button class="btn btn-primary w-100" :disabled="s.processing"
            @click="act('attack')">⚔️ Attack</button></div>
        <div class="col"><button class="btn btn-outline w-100" :disabled="s.processing"
            @click="toggleItems">🎒 Item</button></div>
        <div class="col"><button class="btn btn-outline w-100" :disabled="s.processing"
            @click="act('flee')">🏃 Flee</button></div>
      </div>

      <div class="pp-skill-heading mt-3 text-center mb-px6">SKILLS</div>
      <div class="d-flex flex-wrap justify-content-center gap-2">
        <button v-for="(skill, i) in s.player?.skills || []" :key="skill.id" class="pp-skill-btn"
          :class="{ 'pp-skill-cooling': (s.skillCooldowns[skill.id] || 0) > 0 }"
          :disabled="s.processing || (s.skillCooldowns[skill.id] || 0) > 0" :title="skill.desc"
          @click="act('skill', i)">
          <span class="pp-skill-icon">{{ skill.icon }}</span>
          <span class="pp-skill-name text-center">{{ skill.name }}</span>
          <span v-if="(s.skillCooldowns[skill.id] || 0) > 0" class="pp-skill-cd position-absolute rounded-5">{{ s.skillCooldowns[skill.id] }}</span>
        </button>
      </div>
    </div>

    <div v-else-if="s.phase === 'over'" class="text-center mt-3">
      <h3 class="pp-result" :class="s.victory === true ? 'pp-win' : 'pp-lose'">
        {{ resultText }}
      </h3>
      <p v-if="s.rewards && s.victory === true" class="pp-rewards">
        +{{ s.rewards.xp }} XP &nbsp;·&nbsp; +{{ s.rewards.pp }} PP
        <span v-if="s.calendarBonus" class="pp-cal-bonus"><br />⚔️ {{ s.calendarBonus }} — 2x XP!</span>
        <span v-if="s.rewards.leveled"><br />🎉 Level {{ s.rewards.newLevel }}!</span>
        <!-- Item drops: a flat 10% on an ordinary win, guaranteed from a boss's
             own loot table. Nothing rendered them before, because nothing
             dropped — see BattleService.rollItemDrop(). -->
        <span v-if="s.rewards.item" class="pp-drop"><br />🎁 Found {{ s.rewards.item.name }}!</span>
      </p>
      <button class="btn btn-primary" @click="$emit('done')">Continue</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch, onUnmounted } from 'vue'
import { battleState, battleService } from '../../services/BattleService.js'
import { isPiper } from '../../services/PiperBoss.js'
import { AppState } from '../../AppState.js'
import { inventoryService } from '../../services/InventoryService.js'
import { toastService } from '../../services/ToastService.js'
import StatusRow from './StatusRow.vue'

defineEmits(['done'])

const s = battleState

const showItems = ref(false)
const usableItems = computed(() => battleService.usableItems(AppState.inventory))

function toggleItems() {
  if (!usableItems.value.length) {
    toastService.info('No battle items!')
    return
  }
  showItems.value = !showItems.value
}

async function useItem(item) {
  showItems.value = false
  // Consume first so the count is right even if the turn resolution throws;
  // legacy decremented in the same place, before resolving the effect.
  inventoryService.decrementLocal(item)
  inventoryService.useItem(item).catch(err =>
    console.error('[BattleArena] item consume failed to persist:', err)
  )
  await battleService.playerAction('item', item)
}

// enemy_pets has no emoji column, so species names map to a glyph — ported
// from the ENEMY_EMOJI_MAP built inline in initManualBattle().
const ENEMY_EMOJI = {
  bird: '🐦', bunny: '🐰', rabbit: '🐰', squirrel: '🐿️', rat: '🐭', mouse: '🐭',
  cat: '🐱', dog: '🐕', fox: '🦊', raccoon: '🦝', boar: '🐗', pig: '🐷',
  deer: '🦌', wolf: '🐺', bear: '🐻', mushroom: '🍄', slime: '🫧',
  bat: '🦇', spider: '🕷️', crab: '🦀', fish: '🐟', frog: '🐸',
  crystal: '💎', ghost: '👻', spirit: '👻', shadow: '🌑', void: '🌑',
  corrupted: '💀', piper: '🎵', boss: '⚠️'
}
const VARIANT_FILTER = {
  corrupted: 'hue-rotate(270deg) saturate(2.5)',
  golden: 'sepia(1) brightness(1.6) saturate(2.5)',
  shiny: 'hue-rotate(180deg) saturate(1.8) brightness(1.1)',
  glitched: 'hue-rotate(120deg) contrast(1.4)'
}

const zoneMod = computed(() => s.zoneConf && s.zoneConf.battleMod)

const enemyEmoji = computed(() => {
  const key = (s.enemy?.species || '').toLowerCase().split(/\s+/)[0]
  return ENEMY_EMOJI[key] || '🐾'
})

const playerSpriteStyle = computed(() => s.player?.imageFile
  ? { backgroundImage: `url(/images/${s.player.imageFile})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }
  : {})

const enemySpriteStyle = computed(() => ({
  filter: VARIANT_FILTER[s.enemy?.specialVariant] || 'none',
  fontSize: s.enemy?.is_boss ? '3.5rem' : '2.5rem',
  lineHeight: 1
}))

const fightingPiper = computed(() => isPiper(s.enemy))
// Ticks remaining before the melody next resonates (it fires every 3rd tick).
const melodyIn = computed(() => 3 - ((s.piperMelody || 0) % 3))

// Legacy applied `boss-ui-glitch` to <body> directly from inside the combat
// logic. The service now just stamps a timestamp and the component owns the
// DOM — style.css already carries the `body.boss-ui-glitch` rules.
watch(() => s.piperGlitch, (t) => {
  if (!t) return
  document.body.classList.add('boss-ui-glitch')
  setTimeout(() => document.body.classList.remove('boss-ui-glitch'), 800)
})

const phaseFlash = ref(false)
watch(() => s.piperFlash, (t) => {
  if (!t) return
  phaseFlash.value = true
  setTimeout(() => { phaseFlash.value = false }, 500)
})

// Never leave the glitch class behind if the player navigates mid-fight.
onUnmounted(() => document.body.classList.remove('boss-ui-glitch'))

const resultText = computed(() => {
  if (s.victory === 'flee') return '🏃 Escaped!'
  return s.victory === true ? '🎉 Victory!' : '💫 Defeated...'
})

function pct(v, max) {
  if (!max) return 0
  return Math.max(0, Math.min(100, (v / max) * 100))
}

function act(type, payload) {
  battleService.playerAction(type, payload)
}

// The service stamps a timestamp on `anim.*` to signal a hit or a lunge. Each
// is turned into a short-lived boolean so a CSS class can animate, rather than
// the service touching the DOM the way the legacy engine did.
const cue = reactive({ playerAttack: false, enemyAttack: false, playerHit: false, enemyHit: false })
for (const key of Object.keys(cue)) {
  watch(() => s.anim[key], () => {
    cue[key] = true
    setTimeout(() => { cue[key] = false }, 320)
  })
}
</script>

<style lang="scss" scoped>
// `.battle-container`, `.battle-side`, `.battle-sprite`, `.battle-hp-*`,
// `.battle-name` and `.battle-vs` are all owned by the root style.css and are
// left alone. Only what the legacy markup styled inline lives here.
.pp-zone-banner {
  border-radius: var(--radius);
  background: rgba(153, 102, 255, 0.12);
  border: 2px solid var(--purple-light);
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--purple-dark);
}

.pp-narrative {
  min-height: 64px;
  background: rgba(0, 0, 0, 0.04);
  font-size: 0.9rem;
  line-height: 1.6;
}

.pp-turn {
  font-size: 0.78rem;
  color: var(--text-light);
  font-weight: 600;
  letter-spacing: 2px;
}

.pp-skill-heading {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--text-light);
  text-transform: uppercase;
}

.pp-skill-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 84px;
  padding: 8px 10px;
  border: 2.5px solid var(--purple-light);
  border-radius: var(--radius);
  background: var(--white);
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    border-color: var(--purple);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.pp-skill-icon { font-size: 1.2rem; }

.pp-skill-name {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--purple-dark);
  line-height: 1.15;
}

.pp-skill-cd {
  top: -6px;
  right: -6px;
  min-width: 20px;
  padding: 1px 5px;
  background: var(--pink);
  color: var(--white);
  font-size: 0.7rem;
  font-weight: 800;
}

// ── Piper-only chrome ───────────────────────────────────────────────────────
.pp-melody {
  font-size: 0.75rem;
  color: #cc66ff;
  font-weight: 700;
}

.pp-melody-warn { color: #ff6666; }
.pp-melody-soft { color: var(--text-light); font-weight: 400; }

.pp-influence-head {
  font-size: 0.72rem;
  color: var(--text-light);
  margin-bottom: 3px;
}

.pp-influence-track {
  background: rgba(0, 0, 0, 0.08);
  height: 6px;
}

.pp-influence-fill {
  background: linear-gradient(90deg, #9966ff, #ff0066);
  transition: width 0.3s;
}

// Phase-3 transition flash, ported from piperBoss_phaseTransition().
.pp-phase-flash {
  inset: 0;
  background: rgba(200, 0, 80, 0.15);
  z-index: 9998;
  pointer-events: none;
  animation: pp-phase3-flash 0.4s ease-out forwards;
}

@keyframes pp-phase3-flash {
  to { opacity: 0; }
}

.pp-item-picker {
  background: var(--white);
  border: 2px solid var(--purple);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.pp-item-head {
  font-weight: 700;
  font-size: 0.82rem;
  color: var(--purple-dark);
}

.pp-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 7px 10px;
  margin-bottom: 5px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: rgba(153, 102, 255, 0.06);
  cursor: pointer;
  font-size: 0.82rem;

  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.pp-item-effect {
  font-size: 0.72rem;
  color: var(--green);
}

.pp-item-qty {
  color: var(--text-light);
  font-size: 0.72rem;
  white-space: nowrap;
}

.pp-item-cancel {
  border: 1px solid var(--border);
  background: none;
  cursor: pointer;
  font-size: 0.78rem;
  color: var(--text-light);
}

.pp-boss-hp { background: linear-gradient(90deg, #ff4444, #ff0000) !important; }

.pp-result { font-family: 'Fredoka One', cursive; }
.pp-win { color: var(--green); }
.pp-lose { color: #ff6b6b; }
.pp-rewards { font-weight: 700; color: var(--purple-dark); }
.pp-drop { color: #d97706; }
.pp-cal-bonus { color: #e6a800; }

// Lunge / recoil cues. Kept short so they can't overlap the next turn.
// The legacy `.battle-sprite` rules were written for background SPRITESHEETS:
// a fixed 100x100 block, `background-position: center`, and — at style.css:10046
// — `transform: scale(1.8)` to magnify one frame of the sheet. The player side
// still paints a background image, so those rules suit it exactly.
//
// The enemy side renders an EMOJI (as the live site's own initManualBattle does
// — see the sprite-animation finding: startSpriteAnimation is a no-op there).
// A text glyph inside a `display: block` box sits at its TOP-LEFT corner, so
// scaling the box 1.8x about its centre threw the glyph ~40px up and ~40px left.
// Centre the glyph and drop the spritesheet magnification; neither applies to
// text. `!important` is required because `.battle-sprite` sets
// `display: block !important` (style.css:3924).
.battle-sprite.enemy-sprite {
  display: flex !important;
  align-items: center;
  justify-content: center;
  transform: none;
}

.pp-attack { animation: pp-lunge 0.3s ease; }
.pp-hit { animation: pp-recoil 0.3s ease; }

// The enemy stands to the RIGHT of the player, so it has to lunge left to move
// toward its target. Same curve, mirrored.
.battle-enemy .pp-attack { animation-name: pp-lunge-left; }
.battle-enemy .pp-hit { animation-name: pp-recoil-right; }

@keyframes pp-lunge {
  50% { transform: translateX(14px) scale(1.06); }
}

@keyframes pp-recoil {
  25% { transform: translateX(-8px); filter: brightness(2); }
  75% { transform: translateX(4px); }
}

@keyframes pp-lunge-left {
  50% { transform: translateX(-14px) scale(1.06); }
}

@keyframes pp-recoil-right {
  25% { transform: translateX(8px); filter: brightness(2); }
  75% { transform: translateX(-4px); }
}
</style>

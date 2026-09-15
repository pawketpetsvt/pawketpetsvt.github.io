<template>
  <div>
    <div v-if="phaseFlash" class="pp-phase-flash position-fixed"></div>

    <!-- Zone modifier banner. Only zones with a real mechanic show one. -->
    <div v-if="zoneMod && zoneMod.type !== 'none'" class="pp-zone-banner mb-3 text-center py-2 px-tight">
      {{ zoneMod.label }}: {{ zoneMod.desc }}
    </div>

    <!-- Beta Integrity below Stable. Legacy appended this to the zone banner,
         with the tier's explanation on hover. -->
    <div v-if="s.integrity?.label" class="pp-zone-banner pp-integrity-banner mb-3 text-center py-2 px-tight"
      :title="s.integrity.tip">
      {{ s.integrity.label }}
    </div>

    <!-- The full-screen half of the boss entrance: the RGB scanline overlay and
         the scrolling warnings. Rendered here rather than in AppShell so it
         cannot outlive the arena. -->
    <BossOverlay />

    <!-- `.boss-entrance` and the indicator below are revived rather than
         ported: legacy aims them at `el('battle-tab')` and `el('battle-area')`,
         and NEITHER id exists anywhere in index.html (the real ones are
         `section-battle` and `battle-screen`), so both lookups returned null
         and neither has ever rendered on the live site — the same wrong-id
         family as the Twitch follow badges.

         The third effect from that block, `.boss-battle-bg`, is deliberately
         still not applied. It paints a near-black gradient while
         `.battle-name` and `.battle-vs` are `--purple-dark` with a white
         text-shadow, so switching it on would leave the arena unreadable. Its
         legacy CSS is in git at 71ad3a1^:style.css if it is ever redesigned. -->
    <div class="battle-container" :class="{ 'boss-entrance': isBossFight, 'has-boss-banner': isBossFight }">
      <div v-if="isBossFight" class="boss-battle-indicator">⚠️ BOSS BATTLE ⚠️</div>

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
        <div v-if="playerMods.length" class="d-flex flex-wrap justify-content-center gap-1">
          <span v-for="mod in playerMods" :key="mod.key" class="pp-buff-pill"
            :class="mod.down ? 'pp-mod-down' : 'pp-mod-up'" :title="mod.title">{{ mod.text }}</span>
        </div>
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
        <div v-if="enemyMods.length" class="d-flex flex-wrap justify-content-center gap-1">
          <span v-for="mod in enemyMods" :key="mod.key" class="pp-buff-pill"
            :class="mod.down ? 'pp-mod-down' : 'pp-mod-up'" :title="mod.title">{{ mod.text }}</span>
        </div>

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

    <!-- Piper's Influence. Dormant unless Beta Integrity is 25 or below (see
         tickInfluence), so it only appears once it starts filling rather than
         sitting at a permanent 0%.

         Not gated on a Piper fight: the meter fills and its events fire
         whoever the enemy is, and legacy shows it in every fight at that
         point. The port had hidden it outside Piper fights while it filled. -->
    <div v-if="s.piperInfluence > 0" class="pp-influence mt-2"
      title="With the beta integrity failing, the veil between game and reality is weakening. Piper is watching.">
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

      <!-- Ports renderGlobalBuffPills() + combatBuff_renderPills(): what is
           boosting this fight. Dropped by the Phase 7 port. -->
      <div v-if="buffPills.length" class="d-flex flex-wrap justify-content-center gap-1 mt-2">
        <span v-for="pill in buffPills" :key="pill.key" class="pp-buff-pill"
          :class="{ 'pp-buff-food': pill.food }" :title="pill.desc">
          {{ pill.text }}<span v-if="pill.left" class="pp-buff-left"> ({{ pill.left }} battles)</span>
        </span>
      </div>

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
import { bossPresentationService } from '../../services/BossPresentationService.js'
import { weatherState } from '../../services/WeatherService.js'
import { worldEventState, worldEventService } from '../../services/WorldEventService.js'
import { guildPerkService } from '../../services/GuildPerkService.js'
import { WEATHER_BONUSES } from '../../data/weatherData.js'
import StatusRow from './StatusRow.vue'
import BossOverlay from './BossOverlay.vue'

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

// Ports getGlobalBuffSummary() + combatBuff_renderPills(): the weather's XP
// bonus, the world event, active guild perks, then the pet's own cooking buffs.
// The weather pill reads the weather's own bonus rather than
// weatherService.bonus(), which also folds in the community celebration buff.
// Timed stat changes on each side — skill buffs, Echo of Fear's DEF cut, the
// fox's feint — as chips under that side's status icons.
const MOD_STAT = { playerAtk: 'ATK', playerDef: 'DEF', enemyDef: 'DEF' }
function modChips(side) {
  return (s.timedMods || [])
    .filter(m => m.target.startsWith(side))
    .map(m => {
      const turns = Math.max(1, m.lastTurn - s.turn)
      return {
        key: m.source,
        text: `${m.amount > 0 ? '+' : ''}${m.amount} ${MOD_STAT[m.target]}`,
        title: `${turns} turn${turns === 1 ? '' : 's'} left`,
        down: m.amount < 0
      }
    })
}
const playerMods = computed(() => modChips('player'))
const enemyMods = computed(() => modChips('enemy'))

const STAT_LABELS = { attack: 'ATK', defense: 'DEF', speed: 'SPD', luck: 'Luck', spirit: 'Spirit' }
const buffPills = computed(() => {
  const pills = []
  const weather = weatherState.current
  const weatherXp = weather ? (WEATHER_BONUSES.xpBonus[weather.id] ?? 1) : 1
  if (weatherXp > 1) {
    pills.push({ key: 'weather', text: `${weather.icon} ${weather.name}`, desc: `+${Math.round((weatherXp - 1) * 100)}% XP` })
  }
  const event = worldEventState.event
  if (event) {
    pills.push({ key: 'event', text: `${event.icon || '🎉'} ${event.name}`, desc: worldEventService.bonusLines().join(', ') })
  }
  for (const perk of guildPerkService.activeList()) {
    pills.push({ key: 'perk-' + perk.type, text: `🏛️ Guild: ${perk.type.replace(/_/g, ' ')}`, desc: 'Active perk' })
  }
  for (const buff of s.player?.combatBuffs || []) {
    pills.push({
      key: 'food-' + buff.id,
      text: `+${buff.amount} ${STAT_LABELS[buff.stat] || buff.stat}`,
      left: buff.battles_left,
      food: true
    })
  }
  return pills
})

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
const isBossFight = computed(() => !!s.enemy?.is_boss)
// Ticks remaining before the melody next resonates (it fires every 3rd tick).
const melodyIn = computed(() => 3 - ((s.piperMelody || 0) % 3))

// Legacy applied `boss-ui-glitch` to <body> directly from inside the combat
// logic. The service still just stamps a timestamp, but the body class is now
// owned by BossPresentationService rather than added and removed here.
//
// That ownership matters: the sustained entrance glitch holds the same class
// for the whole fight, so the add-then-remove this used to do would have ENDED
// the effect at the first phase transition — a brief flicker where the page is
// supposed to be coming apart. `pulse()` is a no-op while the sustained effect
// is running and only does real work where it isn't (a phone, which legacy
// excludes from the fragmentation for performance).
watch(() => s.piperGlitch, (t) => {
  if (!t) return
  bossPresentationService.pulse(800)
})

const phaseFlash = ref(false)
watch(() => s.piperFlash, (t) => {
  if (!t) return
  phaseFlash.value = true
  setTimeout(() => { phaseFlash.value = false }, 500)
})

// Never leave the glitch class, the overlay or a spawn timer behind if the
// player navigates mid-fight. BattleService.reset() also calls this, but the
// arena can unmount without that running.
onUnmounted(() => bossPresentationService.stop())

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
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.battle-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 40px 20px;
  background: linear-gradient(180deg, #87ceeb 0%, #98d98e 100%);
  border-radius: 16px;
  position: relative;
  min-height: 300px;
}
.battle-side {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.battle-sprite-container {
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.battle-sprite {
  image-rendering: auto;
  width: 100px;
  height: 100px;
  /* background-size now set dynamically via JavaScript */
  background-repeat: no-repeat !important;  /* CRITICAL: Prevent tiling */
  background-size: contain !important;
  background-position: center !important;
  overflow: visible !important;  /* CRITICAL: Hide frames outside viewport */
  display: block !important;  /* CRITICAL: Proper block display */
  transition: transform 0.1s ease;
}
.battle-sprite.player-sprite { font-size: 4rem; }
.battle-sprite.enemy-sprite { /* animation now handled by JavaScript */ }
.battle-vs {
  font-size: 2rem;
  font-weight: bold;
  color: var(--purple);
  text-shadow: 2px 2px 0 white;
  animation: pulse 1.5s ease-in-out infinite;
}
.battle-name {
  font-weight: bold;
  font-size: 1.2rem;
  color: var(--purple-dark);
  text-shadow: 1px 1px 0 white;
}
.battle-hp-container { width: 200px; }
.battle-sprite.enemy-sprite {
  overflow: hidden !important;
  background-repeat: no-repeat !important;
  image-rendering: crisp-edges !important;
  image-rendering: pixelated !important;
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
}
.battle-sprite-container {
  overflow: hidden !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-width: 80px;
  min-height: 80px;
}
.battle-sprite {
  image-rendering: crisp-edges !important;
  image-rendering: pixelated !important;
  image-rendering: -moz-crisp-edges !important;
  background-repeat: no-repeat !important;
}
.battle-sprite.enemy-sprite {
  overflow: hidden !important;
  background-repeat: no-repeat !important;
  position: relative !important;
}
.battle-sprite-container {
  overflow: hidden !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-width: 80px !important;
  min-height: 80px !important;
  background: transparent !important;
}
.battle-sprite-container, .battle-side, .battle-container { background: transparent !important; }

// ── Boss entrance chrome ────────────────────────────────────────────────────
// Recovered verbatim from the pre-migration stylesheet, where these were
// global. The dead-CSS pass removed them during the style.css elimination,
// correctly at the time, because the code that would have applied them had
// never been ported. `.boss-battle-bg` is still not here — see the template.
.boss-entrance {
  animation: boss-fade-in 3s ease-in-out;
}

.boss-battle-indicator {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(139, 0, 0, 0.9);
  color: #FF0000;
  padding: 10px 30px;
  border-radius: 8px;
  font-weight: bold;
  font-size: 1.2rem;
  border: 2px solid #FF0000;
  box-shadow: 0 0 20px rgba(255, 0, 0, 0.6);
  animation: boss-pulse 1s infinite;
  z-index: 100;
}

// The banner is absolutely positioned at `top: 20px` and stands ~44px tall,
// while `.battle-container`'s own top padding is 40px — so it would sit on top
// of the sprites. Legacy never hit this because it was inserting the banner
// into a different element entirely (one that did not exist). Extra top
// padding only in the boss case keeps every other fight's layout untouched.
.battle-container.has-boss-banner {
  padding-top: 84px;
}

// `boss-pulse` bakes `translateX(-50%)` into both of its keyframes, so it
// carries the centring itself while it runs. Under reduced motion the
// animation is forced to 0.01ms and lands on its final frame, which still
// includes the translate — the banner stays centred either way.
body.reduced-motion .boss-battle-indicator {
  animation: none;
}
.battle-sprite-container {
  width: 120px !important;
  height: 120px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  overflow: visible !important;
}
.battle-sprite.enemy-sprite {
  transform: scale(1.8);
  transform-origin: center;
  image-rendering: crisp-edges;
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
}
@media (max-width: 900px) {
  .battle-container {
    flex-direction: column !important;
    gap: 20px !important;
    width: 100% !important;
    box-sizing: border-box !important;
  }
  .battle-side {
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
  }
  .battle-vs { order: 2 !important; }
  .battle-player { order: 1 !important; }
  .battle-enemy { order: 3 !important; }
}
@media (max-width: 768px) {
  .battle-container {
    flex-direction: column !important;
    align-items: center !important;
  }
  .battle-sprite { width: 80px !important; height: 80px !important; }
  .battle-sprite-container { width: 90px !important; height: 90px !important; }
  .battle-hp-container { width: 100% !important; }
}

// `.battle-container`, `.battle-side`, `.battle-sprite`, `.battle-hp-*`,
// `.battle-name` and `.battle-vs` are all owned by the global stylesheet and are
// left alone. Only what the legacy markup styled inline lives here.
.pp-zone-banner {
  border-radius: var(--radius);
  background: rgba(153, 102, 255, 0.12);
  border: 2px solid var(--purple-light);
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--purple-dark);
}

.pp-integrity-banner,
.pp-influence { cursor: help; }

// Buff pills, from legacy's inline styles.
.pp-buff-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 20px;
  background: rgba(153, 102, 255, 0.12);
  border: 1px solid rgba(153, 102, 255, 0.25);
  font-size: 0.68rem;
  color: var(--purple-dark);
}

.pp-buff-food {
  background: rgba(93, 222, 122, 0.15);
  border-color: rgba(93, 222, 122, 0.4);
  font-size: 0.65rem;
  font-weight: 700;
  color: #5dde7a;
}

.pp-buff-left { opacity: 0.7; }

.pp-mod-up {
  background: rgba(93, 222, 122, 0.15);
  border-color: rgba(93, 222, 122, 0.4);
  color: #3fae5c;
  font-weight: 700;
}

.pp-mod-down {
  background: rgba(255, 107, 107, 0.12);
  border-color: rgba(255, 107, 107, 0.35);
  color: #e05555;
  font-weight: 700;
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
// a fixed 100x100 block, `background-position: center`, and — at legacy style.css:10046
// — `transform: scale(1.8)` to magnify one frame of the sheet. The player side
// still paints a background image, so those rules suit it exactly.
//
// The enemy side renders an EMOJI (as the live site's own initManualBattle does
// — see the sprite-animation finding: startSpriteAnimation is a no-op there).
// A text glyph inside a `display: block` box sits at its TOP-LEFT corner, so
// scaling the box 1.8x about its centre threw the glyph ~40px up and ~40px left.
// Centre the glyph and drop the spritesheet magnification; neither applies to
// text. `!important` is required because `.battle-sprite` sets
// `display: block !important` (legacy style.css:3924).
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

<template>
  <!-- Ports the Starter Dungeon flow (showDungeonIntro → startDungeonWave →
       battle playback → completeDungeon/failDungeon). Waves resolve via the
       auto-battle simulator, and the log plays back a line at a time. -->
  <div class="pp-dungeon">
    <div class="page-hero">
      <div class="sparkle-row">⛰️ ⚔️ ⛰️</div>
      <h1>Shallow Cave</h1>
      <p>Three waves. No healing between them.</p>
    </div>

    <div class="d-flex gap-2 justify-content-center my-3 mx-0">
      <div v-for="(e, i) in s.enemies" :key="i" class="pp-wave" :class="waveClass(i)">
        <div class="pp-wave-num">Wave {{ i + 1 }}</div>
        <div class="pp-wave-name">{{ e.name }}</div>
        <div class="pp-wave-lv">Lv.{{ e.level }}</div>
      </div>
    </div>

    <div class="pp-dungeon-hp my-0 mx-auto">
      <div class="battle-hp-label"><span>{{ s.pet?.name }}</span><span>{{ s.petHP }}/{{ s.petMaxHP }}</span></div>
      <div class="battle-hp-bar">
        <div class="battle-hp-fill" :style="{ width: hpPct + '%' }"></div>
      </div>
    </div>

    <!-- INTRO -->
    <div v-if="s.phase === 'intro'" class="text-center mt-3">
      <p class="pp-dungeon-msg">
        A {{ baseName }} family guards this cave. Beat all three to claim the
        <strong>+100 PP</strong> clear bonus.
      </p>
      <button class="btn btn-primary btn-lg" @click="runWave">⚔️ Enter the Cave</button>
      <button class="btn btn-outline w-100 mt-2" @click="$emit('exit')">Not yet</button>
    </div>

    <!-- BATTLE PLAYBACK -->
    <div v-else-if="s.phase === 'fighting'" class="mt-3">
      <div class="text-center mb-px10">
        <div v-if="currentEnemy?.sprite" class="pp-sprite mt-0 mx-auto mb-px6 overflow-hidden" :style="spriteStyle"></div>
        <div class="pp-enemy-name">{{ currentEnemy?.name }}</div>
      </div>
      <div class="battle-log-container">
        <div ref="logEl" class="battle-log">
          <div v-for="(entry, i) in shownLog" :key="i" class="battle-log-entry" :class="'pp-log-' + entry.type">
            {{ entry.text }}
          </div>
        </div>
      </div>
      <button v-if="!playbackDone" class="btn btn-outline w-100 mt-2" @click="skipPlayback">Skip</button>
    </div>

    <!-- BETWEEN WAVES -->
    <div v-else-if="s.phase === 'wave-clear'" class="text-center mt-3">
      <h3 class="pp-result pp-win">Wave {{ s.wave - 1 }} cleared!</h3>
      <p class="pp-dungeon-msg">
        {{ s.pet?.name }} has <strong>{{ s.petHP }}</strong> HP left. No healing — press on?
      </p>
      <button class="btn btn-primary" @click="runWave">⚔️ Next Wave</button>
    </div>

    <!-- DONE -->
    <div v-else class="text-center mt-3">
      <h3 class="pp-result" :class="s.phase === 'complete' ? 'pp-win' : 'pp-lose'">
        {{ s.phase === 'complete' ? '👑 Cave Cleared!' : '💫 Defeated...' }}
      </h3>
      <p v-if="s.phase === 'complete'" class="pp-rewards">
        +{{ s.rewards.pp }} PP <span class="pp-bonus">(incl. +{{ s.bonusPP }} clear bonus)</span><br />
        +{{ s.rewards.xp }} XP
      </p>
      <p v-else class="pp-dungeon-msg">
        Made it to wave {{ s.wave }}. Rewards from cleared waves are kept.
      </p>
      <button class="btn btn-primary" @click="$emit('exit')">Continue</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onUnmounted } from 'vue'
import { dungeonState, dungeonService } from '../../services/DungeonService.js'
import { soundService } from '../../services/SoundService.js'

defineEmits(['exit'])

const s = dungeonState
const shownLog = ref([])
const playbackDone = ref(false)
const logEl = ref(null)
let playbackTimer = null

const hpPct = computed(() => s.petMaxHP ? Math.max(0, (s.petHP / s.petMaxHP) * 100) : 0)
const currentEnemy = computed(() => s.enemies[s.wave - 1] || null)
// All three waves are the same creature, so the base name is the first wave's
// minus its variant prefix.
const baseName = computed(() => (s.enemies[0]?.name || 'creature').replace(/^Baby /, ''))

const spriteStyle = computed(() => {
  const sp = currentEnemy.value?.sprite
  if (!sp) return {}
  return {
    backgroundImage: `url(${sp.file})`,
    backgroundSize: `${sp.sheetWidth}px ${sp.sheetHeight}px`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: '0 0',
    width: sp.frameWidth + 'px',
    height: sp.frameHeight + 'px'
  }
})

function waveClass(i) {
  if (i < s.wave - 1) return 'pp-wave-done'
  if (i === s.wave - 1) return 'pp-wave-current'
  return ''
}

// Plays the auto-battle log back a line at a time so the fight reads as a
// fight rather than appearing all at once.
async function runWave() {
  const result = dungeonService.fightWave()
  shownLog.value = []
  playbackDone.value = false

  let i = 0
  playbackTimer = setInterval(async () => {
    if (i >= result.log.length) {
      clearInterval(playbackTimer)
      playbackTimer = null
      playbackDone.value = true
      await dungeonService.resolveWave(result)
      return
    }
    const entry = result.log[i++]
    shownLog.value.push(entry)
    // The Starter Dungeon replays its log a line at a time, so the hit sounds
    // belong to the PLAYBACK rather than to the simulation that produced it.
    soundService.logEntry(entry, !!(currentEnemy.value && currentEnemy.value.is_boss))
    await nextTick()
    if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
  }, 420)
}

async function skipPlayback() {
  if (playbackTimer) { clearInterval(playbackTimer); playbackTimer = null }
  shownLog.value = [...s.log]
  playbackDone.value = true
  await nextTick()
  if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
  await dungeonService.resolveWave({
    victory: s.petHP > 0,
    log: s.log,
    playerFinalHP: s.petHP
  })
}

onUnmounted(() => { if (playbackTimer) clearInterval(playbackTimer) })
</script>

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.battle-log-container {
  margin-top: 20px;
  background: white;
  border: 3px solid var(--purple-light);
  border-radius: 12px;
  padding: 20px;
  max-height: 200px;
  overflow-y: auto;
}
.battle-log {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.battle-log-entry {
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
  font-size: 0.9rem;
  color: var(--purple-dark);
  animation: slide-in 0.3s ease;
}
.battle-log-entry.victory {
  background: linear-gradient(90deg, rgba(255, 215, 0, 0.3), rgba(255, 193, 7, 0.3));
  border-left: 4px solid #ffd700;
  font-weight: bold;
}
.battle-log-container {
  max-height: 280px;
  min-height: 280px;
  overflow-y: auto;
  margin-bottom: 20px;
}
.battle-log {
  max-height: 280px;
  overflow-y: auto;
}
.battle-log-entry {
  padding: 8px 12px;
  margin: 4px 0;
  border-radius: 6px;
  line-height: 1.4;
}
body.night-mode .battle-log-container {
  background: #2a2a3a !important;
  border: 2px solid #9966ff !important;
}
body.night-mode .battle-log-entry {
  background: rgba(42,36,64,0.9) !important;
  color: #e8d5ff !important;
}
body.night-mode .battle-log-entry.victory { background: rgba(251,191,36,0.12) !important;  border-left: 4px solid #fbbf24 !important; }
body.night-mode .battle-log-entry { color: var(--text) !important; }
@media (max-width: 768px) {
  .battle-log-container { max-height: 120px !important; }
}

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.pp-wave {
  flex: 1;
  max-width: 160px;
  padding: 10px;
  border: 2px solid var(--border);
  border-radius: 12px;
  text-align: center;
  opacity: 0.55;

  &.pp-wave-current {
    opacity: 1;
    border-color: var(--purple);
    background: var(--purple-light);
  }

  &.pp-wave-done {
    opacity: 1;
    border-color: var(--green);
    background: rgba(93, 222, 122, 0.12);
  }
}

.pp-wave-num {
  font-size: 0.68rem;
  text-transform: uppercase;
  color: var(--text-light);
  font-weight: 700;
}

.pp-wave-name {
  font-weight: 700;
  font-size: 0.8rem;
  color: var(--purple-dark);
}

.pp-wave-lv {
  font-size: 0.7rem;
  color: var(--text-light);
}

.pp-dungeon-hp {
  max-width: 420px;
}

.pp-dungeon-msg {
  font-size: 0.88rem;
  color: var(--text-light);
  margin: 10px 0;
}

// The dungeon is the only place enemies render as spritesheet frames rather
// than emoji; frame 0 only, since legacy's animation hook is a no-op.
.pp-sprite {
  image-rendering: pixelated;
}

.pp-enemy-name {
  font-family: 'Fredoka One', cursive;
  color: var(--purple-dark);
}

.pp-log-passive { color: var(--purple); }
.pp-log-zone { color: #ff9f43; }
.pp-log-enemy_passive { color: #ff6b6b; }
.pp-log-end { font-weight: 800; }

.pp-result { font-family: 'Fredoka One', cursive; }
.pp-win { color: var(--green); }
.pp-lose { color: #ff6b6b; }

.pp-rewards {
  font-weight: 700;
  color: var(--purple-dark);
}

.pp-bonus {
  font-weight: 400;
  font-size: 0.82rem;
  color: var(--text-light);
}
</style>

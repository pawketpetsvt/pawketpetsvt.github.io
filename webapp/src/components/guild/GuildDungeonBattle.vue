<template>
  <div v-if="battle">
    <div class="gdb-header mb-px10">
      ⚔️ {{ battle.dungeon.name }} • Wave {{ battle.waveIndex + 1 }}/{{ battle.waves.length }} • Turn {{ battle.turn }}
    </div>

    <div class="d-flex gap-2 mb-3 align-items-start">
      <div class="flex-fill min-w-0">
        <div class="gdb-side-label party">YOUR PARTY</div>
        <div class="guild-party-panel">
          <div
            v-for="p in battle.party"
            :key="p.id"
            class="guild-party-member"
            :class="{ 'gdb-acting': isActor(p) }"
          >
            <div class="gdb-avatar">
              {{ p.icon }}
              <span v-if="isActor(p)" class="gdb-turn-tag">YOUR TURN</span>
            </div>
            <div class="flex-fill min-w-0">
              <div class="gdb-name" :class="{ me: p.isPlayer }">
                {{ p.name }}
                <span class="gdb-owner" :class="{ me: p.isPlayer }">
                  ({{ p.isPlayer ? 'You' : p.ownerName }})
                </span>
              </div>
              <div class="guild-member-hp-bar">
                <div
                  class="guild-member-hp-fill"
                  :style="{ width: pct(p) + '%', background: hpColor(pct(p)) }"
                ></div>
              </div>
              <div class="gdb-hp">
                {{ Math.max(0, p.currentHp) }}/{{ p.maxHp }} HP
                <template v-if="p.currentHp <= 0"> 💀</template>
                <template v-else-if="p._guarding"> 🛡️</template>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="gdb-vs">⚡</div>

      <div class="flex-fill min-w-0">
        <div class="gdb-side-label enemy">ENEMIES</div>
        <div class="guild-enemies-grid">
          <div
            v-for="(e, i) in battle.enemies"
            :key="i"
            class="guild-enemy-card"
            :class="{ 'gdb-acting-enemy': isActor(e) }"
          >
            <div class="gdb-enemy-icon">
              {{ e.icon }}
              <span v-if="isActor(e)" class="gdb-acting-tag d-block">ACTING</span>
            </div>
            <div class="gdb-enemy-name" :class="{ dead: e.currentHp <= 0 }">{{ e.name }}</div>
            <div class="guild-enemy-hp-bar">
              <div
                class="guild-enemy-hp-fill"
                :style="{ width: pct(e) + '%', opacity: e.currentHp <= 0 ? 0.3 : 1 }"
              ></div>
            </div>
            <div class="gdb-hp">
              {{ Math.max(0, e.currentHp) }}/{{ e.maxHp }}<template v-if="e.currentHp <= 0"> ✅</template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <template v-if="!over">
      <div v-if="partyTurn" class="gdb-actions rounded-2 p-px10 mb-px10">
        <div class="gdb-actor-name mb-2">🐾 {{ actorName }}'s turn!</div>
        <div class="d-flex gap-2">
          <button class="btn btn-primary flex-fill gdb-act-btn" @click="act('attack')">⚔️ Attack</button>
          <button class="btn btn-outline flex-fill gdb-act-btn" @click="act('power')">💥 Power</button>
          <button class="btn btn-outline flex-fill gdb-act-btn" @click="act('guard')">🛡️ Guard</button>
        </div>
        <div class="gdb-act-hint mt-px6">
          Attack: normal hit · Power: 1.5x hits all · Guard: double DEF this round
        </div>
      </div>
      <div v-else class="gdb-waiting text-center p-px10">Enemies are acting...</div>
    </template>

    <div class="gdb-side-label mt-2">BATTLE LOG</div>
    <div ref="logEl" class="guild-battle-log">
      <div
        v-for="(entry, i) in recentLog"
        :key="i"
        class="guild-battle-log-entry"
        :class="logClass(entry)"
      >{{ entry.text }}</div>
    </div>

    <!-- Wave / run result -->
    <div v-if="over" class="text-center py-2 px-0">
      <template v-if="enemiesDead">
        <div class="gdb-cleared mb-px10">✅ Wave {{ battle.waveIndex + 1 }}/{{ battle.waves.length }} Cleared!</div>
        <button
          v-if="moreWaves && !partyDead"
          class="btn btn-primary w-100 mb-2"
          @click="advance"
        >Continue to Wave {{ battle.waveIndex + 2 }} →</button>
        <button class="btn btn-outline btn-sm w-100" :disabled="finishing" @click="finish(true)">
          🏆 Claim Rewards
        </button>
      </template>
      <template v-else>
        <div class="gdb-defeated mb-px10">❌ Party Defeated on Wave {{ battle.waveIndex + 1 }}!</div>
        <button class="btn btn-outline btn-sm w-100" :disabled="finishing" @click="finish(false)">
          💔 End Run
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import {
  playerAction, nextWave, startRoundIfNeeded, currentActor,
  isPartyTurn, allEnemiesDead, allPartyDead, battleOver, hasMoreWaves
} from '../../services/GuildDungeonEngine.js'

const props = defineProps({ battle: { type: Object, required: true } })
const emit = defineEmits(['finish'])

const finishing = ref(false)
const logEl = ref(null)
// Bumped after every mutation so the computeds below re-read the plain (non-
// reactive) battle object the engine mutates in place.
const tick = ref(0)

const over = computed(() => (tick.value, battleOver(props.battle)))
const enemiesDead = computed(() => (tick.value, allEnemiesDead(props.battle)))
const partyDead = computed(() => (tick.value, allPartyDead(props.battle)))
const partyTurn = computed(() => (tick.value, !over.value && isPartyTurn(props.battle)))
const moreWaves = computed(() => (tick.value, hasMoreWaves(props.battle)))
const actorName = computed(() => {
  tick.value
  const a = currentActor(props.battle)
  return a ? a.name : ''
})
const recentLog = computed(() => {
  tick.value
  return props.battle.fullLog.concat(props.battle.log).slice(-12)
})

const pct = c => Math.max(0, Math.round((c.currentHp / c.maxHp) * 100))
const hpColor = p => (p > 50 ? '#4ade80' : p > 20 ? '#fbbf24' : '#ff6b6b')

function isActor(c) {
  tick.value
  return !over.value && props.battle.actorQueue.length > 0 && props.battle.actorQueue[0] === c
}

function logClass(entry) {
  if (entry.type === 'crit') return 'critical'
  if (entry.type === 'death') return 'death'
  if (entry.type === 'enemy') return 'enemy-atk'
  return ''
}

function act(type) {
  playerAction(props.battle, type)
  tick.value++
}

function advance() {
  nextWave(props.battle)
  startRoundIfNeeded(props.battle)
  tick.value++
}

async function finish(victory) {
  finishing.value = true
  // A cleared final wave counts as fully cleared; a defeat counts only the waves
  // finished before it — legacy's own arithmetic at its two call sites.
  const wavesCleared = victory ? props.battle.waveIndex + 1 : props.battle.waveIndex
  emit('finish', { victory, wavesCleared })
}

// Legacy scrolled the log after every innerHTML rebuild.
watch(recentLog, async () => {
  await nextTick()
  if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
})

onMounted(() => {
  startRoundIfNeeded(props.battle)
  tick.value++
})
</script>

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.guild-party-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.guild-party-member {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: rgba(153,102,255,0.06);
  border-radius: 10px;
  border: 1px solid rgba(153,102,255,0.15);
}
.guild-member-hp-bar {
  width: 100%;
  height: 8px;
  background: rgba(0,0,0,0.15);
  border-radius: 20px;
  overflow: hidden;
  margin: 3px 0;
}
.guild-member-hp-fill {
  height: 100%;
  border-radius: 20px;
  transition: width 0.4s ease;
}
.guild-enemies-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 8px;
}
.guild-enemy-card {
  background: rgba(255,107,107,0.08);
  border: 1px solid rgba(255,107,107,0.25);
  border-radius: 10px;
  padding: 10px 8px;
  text-align: center;
}
.guild-enemy-hp-bar {
  width: 100%;
  height: 6px;
  background: rgba(255,255,255,0.15);
  border-radius: 20px;
  overflow: hidden;
  margin: 6px 0 4px;
}
.guild-enemy-hp-fill {
  height: 100%;
  background: #ff6b6b;
  border-radius: 20px;
  transition: width 0.4s ease;
}
.guild-battle-log {
  max-height: 140px;
  overflow-y: auto;
  background: rgba(0,0,0,0.08);
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 0.75rem;
  line-height: 1.6;
}
.guild-battle-log-entry { padding: 2px 0; border-bottom: 1px solid rgba(153,102,255,0.06); }
.guild-battle-log-entry.critical { color: #ffd700; font-weight: 700; }
.guild-battle-log-entry.death { color: #ff6b6b; }
.guild-battle-log-entry.enemy-atk { color: #fb923c; }
@media (max-width: 500px) {
  .guild-enemies-grid { grid-template-columns: repeat(2, 1fr); }
}

// the global stylesheet owns .guild-party-panel, .guild-party-member, .guild-member-hp-*,
// .guild-enemies-grid, .guild-enemy-card, .guild-enemy-hp-*, .guild-battle-log
// and .guild-battle-log-entry. Everything below is what legacy set inline.
.gdb-header {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-light);
  letter-spacing: 1px;
}

.gdb-side-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-light);
  letter-spacing: 1px;
  margin-bottom: 6px;
  &.party { color: var(--purple); }
  &.enemy { color: #ff6b6b; }
}

.gdb-acting {
  border: 2px solid var(--purple);
  border-radius: 10px;
  padding: 4px;
  background: rgba(153, 102, 255, 0.1);
}

.gdb-acting-enemy {
  border: 2px solid #ff6b6b;
  border-radius: 10px;
}

.gdb-avatar { font-size: 1.1rem; }
.gdb-enemy-icon { font-size: 1.6rem; }

.gdb-turn-tag {
  font-size: 0.7rem;
  color: var(--purple);
  font-weight: 700;
}

.gdb-acting-tag {
  font-size: 0.6rem;
  color: #ff6b6b;
}

.gdb-name {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--purple-dark);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  &.me { color: var(--purple); }
}

.gdb-owner {
  font-size: 0.68rem;
  color: var(--text-light);
  &.me { color: var(--purple); }
}

.gdb-enemy-name {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--purple-dark);
  &.dead { color: #888; }
}

.gdb-hp { font-size: 0.68rem; color: var(--text-light); }

.gdb-vs {
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--text-light);
  padding-top: 30px;
}

.gdb-actions {
  background: rgba(153, 102, 255, 0.08);
}

.gdb-actor-name {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--purple);
}

.gdb-act-btn { font-size: 0.85rem; }

.gdb-act-hint {
  font-size: 0.68rem;
  color: var(--text-light);
}

.gdb-waiting {
  font-size: 0.8rem;
  color: var(--text-light);
  font-style: italic;
}

.gdb-cleared {
  font-weight: 700;
  font-size: 0.95rem;
  color: #4ade80;
}

.gdb-defeated {
  font-weight: 700;
  font-size: 0.95rem;
  color: #ff6b6b;
}
</style>

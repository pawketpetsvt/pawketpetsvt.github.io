<template>
  <div>
    <!-- Result screen -->
    <template v-if="result">
      <div class="text-center gdn-result">
        <div class="gdn-result-icon">{{ result.victory ? '🏆' : '💀' }}</div>
        <div class="gdn-result-title">{{ result.victory ? 'Dungeon Complete!' : 'Run Ended' }}</div>
        <div class="gdn-result-sub">Waves cleared: {{ result.wavesCleared }}/{{ result.totalWaves }}</div>

        <div class="gdn-reward-box">
          <div class="gdn-reward-pp">+{{ result.ppReward }} PP</div>
          <div class="gdn-reward-sub">
            +{{ result.xpReward }} Pet XP · +{{ result.guildXp }} Guild XP
            <template v-if="result.tokens"> · +🏅 {{ result.tokens }} Tokens</template>
          </div>
        </div>

        <div class="gdn-survival">
          <div class="gdn-survival-title">Party Survival</div>
          <div v-for="p in result.party" :key="p.id" class="d-flex align-items-center gap-2 gdn-survival-row">
            <span class="flex-fill min-w-0">{{ p.name }}{{ p.isPlayer ? ' (You)' : '' }}</span>
            <span :class="p.currentHp > 0 ? 'gdn-alive' : 'gdn-ko'">
              {{ p.currentHp > 0 ? Math.max(0, Math.round((p.currentHp / p.maxHp) * 100)) + '% HP' : 'KO' }}
            </span>
          </div>
        </div>

        <button class="btn btn-primary w-100" @click="reset">Back to Dungeons</button>
      </div>
    </template>

    <!-- Live battle -->
    <GuildDungeonBattle v-else-if="battle" :battle="battle" @finish="onFinish" />

    <!-- Picker + party builder -->
    <template v-else>
      <button class="btn btn-outline btn-sm mb-3" @click="$emit('back')">← Back to Guild</button>
      <h3 class="gdn-title">⚔️ Guild Dungeons</h3>

      <div v-if="loading" class="spinner"></div>

      <template v-else>
        <div class="row row-cols-1 row-cols-sm-3 g-2 mb-4">
          <div v-for="d in dungeons" :key="d.dungeon_key" class="col">
            <div
              class="gdn-card h-100"
              :class="{ locked: locked(d), selected: selectedKey === d.dungeon_key }"
              @click="select(d)"
            >
              <div class="gdn-card-icon">{{ d.icon || '⚔️' }}</div>
              <div class="gdn-card-name">{{ d.name }}</div>
              <div class="gdn-card-diff">{{ (d.difficulty || '?').toUpperCase() }}</div>
              <div class="gdn-card-cost">💰{{ d.entry_cost_pp }} PP entry</div>
              <div class="gdn-card-reward">+{{ d.base_pp_reward }} PP · +{{ d.base_xp_reward }} XP</div>
              <div v-if="locked(d)" class="gdn-card-locked">
                Requires Guild Lv.{{ d.required_guild_level }}
              </div>
            </div>
          </div>
        </div>

        <div class="gdn-party">
          <div class="gdn-party-title">🧑‍🤝‍🧑 Build Your Party</div>

          <div class="gdn-mypet">
            🏛️ Your Guild Pet: <strong>{{ myPetLabel }}</strong>
          </div>

          <div class="mb-3">
            <label class="gdn-label">Add Guildmates (optional):</label>
            <select v-model="pickerValue" class="gdn-select">
              <option value="">-- Select a guildmate --</option>
              <option v-if="!guildmates.length" disabled>No guildmates have set a liaison yet</option>
              <option v-for="l in availableGuildmates" :key="l.user_id" :value="l.user_id">
                {{ l.username }} • {{ l.pet_name || 'Pet' }} Lv.{{ l.pet_level || 1 }}
              </option>
            </select>
            <button class="btn btn-outline btn-sm w-100 mt-1" :disabled="!pickerValue" @click="addMember">
              + Add to Party
            </button>
          </div>

          <div class="gdn-party-list">
            <strong>Party:</strong> You<template v-if="party.length"> + {{ party.map(p => p.username).join(', ') }}</template>
          </div>

          <div class="gdn-info">
            {{ selectedKey ? selectedName + ' selected · Your pet will fight for the guild!' : 'Select a dungeon above.' }}
          </div>

          <button class="btn btn-primary w-100" :disabled="!canStart || starting" @click="start">
            {{ starting ? '⚔️ Loading battle…' : '⚔️ Start Dungeon' }}
          </button>
        </div>

        <div class="gdn-section">📜 Recent Runs</div>
        <div v-if="!history.length" class="gdn-empty">No runs yet.</div>
        <div v-for="r in history" :key="r.id" class="gdn-run d-flex align-items-center gap-2">
          <span>{{ (r.guild_dungeons && r.guild_dungeons.icon) || '⚔️' }}</span>
          <span class="flex-fill min-w-0">{{ (r.guild_dungeons && r.guild_dungeons.name) || 'Dungeon' }}</span>
          <span :class="r.victory ? 'gdn-alive' : 'gdn-ko'">{{ r.victory ? 'Victory' : 'Defeat' }}</span>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { guildDungeonService } from '../../services/GuildDungeonService.js'
import { toastService } from '../../services/ToastService.js'
import { MAX_PARTY_GUILDMATES } from '../../data/guildDungeonData.js'
import GuildDungeonBattle from './GuildDungeonBattle.vue'

defineEmits(['back'])

const loading = ref(true)
const dungeons = ref([])
const guildmates = ref([])
const history = ref([])
const myLiaison = ref(null)
const selectedKey = ref('')
const pickerValue = ref('')
const party = ref([])
const starting = ref(false)
const battle = ref(null)
const result = ref(null)

const locked = d => guildDungeonService.isLocked(d)

const myPetLabel = computed(() => {
  const up = myLiaison.value && myLiaison.value.user_pets
  return up ? `${up.nickname || 'Pet'} Lv.${up.level || 1}` : '⚠️ Not set. Go set a Guild Pet first!'
})

const selectedName = computed(() => {
  const d = dungeons.value.find(x => x.dungeon_key === selectedKey.value)
  return d ? d.name : ''
})

const availableGuildmates = computed(() =>
  guildmates.value.filter(l => !party.value.some(p => p.user_id === l.user_id))
)

const canStart = computed(() => !!selectedKey.value && !!(myLiaison.value && myLiaison.value.pet_id))

function select(d) {
  if (locked(d)) return
  selectedKey.value = d.dungeon_key
}

function addMember() {
  const l = guildmates.value.find(x => x.user_id === pickerValue.value)
  if (!l) return
  if (party.value.length >= MAX_PARTY_GUILDMATES) {
    toastService.info(`Max ${MAX_PARTY_GUILDMATES} guildmates!`)
    return
  }
  party.value.push(l)
  pickerValue.value = ''
}

async function load() {
  loading.value = true
  try {
    const [d, g, h, l] = await Promise.all([
      guildDungeonService.loadDungeons(),
      guildDungeonService.loadGuildmates(),
      guildDungeonService.loadHistory(),
      guildDungeonService.myLiaison()
    ])
    dungeons.value = d
    guildmates.value = g
    history.value = h
    myLiaison.value = l
  } catch (e) {
    toastService.error(e.message)
  } finally {
    loading.value = false
  }
}

async function start() {
  starting.value = true
  try {
    battle.value = await guildDungeonService.start(
      selectedKey.value, party.value.map(p => p.user_id)
    )
  } catch (e) {
    toastService.error(e.message)
  } finally {
    starting.value = false
  }
}

async function onFinish({ victory, wavesCleared }) {
  try {
    const r = await guildDungeonService.finish(battle.value, victory, wavesCleared)
    // Snapshot the party's final HP before the battle object is cleared.
    result.value = { ...r, party: battle.value.party }
    battle.value = null
  } catch (e) {
    toastService.error('Error saving run: ' + e.message)
    battle.value = null
  }
}

function reset() {
  result.value = null
  selectedKey.value = ''
  party.value = []
  load()
}

onMounted(load)
</script>

<style lang="scss" scoped>
.gdn-title { color: var(--purple); margin-bottom: 14px; }

.gdn-card {
  border: 2px solid var(--purple);
  border-radius: 14px;
  padding: 14px 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  &.locked { border-color: var(--border); opacity: 0.5; cursor: default; }
  &.selected { background: rgba(153, 102, 255, 0.1); }
}

.gdn-card-icon { font-size: 2rem; }
.gdn-card-name { font-weight: 700; font-size: 0.85rem; color: var(--purple-dark); }
.gdn-card-diff { font-size: 0.72rem; color: var(--text-light); }
.gdn-card-cost { font-size: 0.72rem; color: #e6a800; }
.gdn-card-reward { font-size: 0.72rem; color: #5dde7a; }
.gdn-card-locked { font-size: 0.68rem; color: #ff6b6b; margin-top: 4px; }

.gdn-party {
  border: 2px solid var(--border);
  border-radius: 14px;
  padding: 14px 16px;
}

.gdn-party-title {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--purple-dark);
  margin-bottom: 12px;
}

.gdn-mypet {
  font-size: 0.82rem;
  margin-bottom: 8px;
  padding: 8px 10px;
  background: rgba(153, 102, 255, 0.06);
  border-radius: 8px;
}

.gdn-label {
  font-size: 0.78rem;
  font-weight: 600;
  display: block;
  margin-bottom: 4px;
}

.gdn-select {
  width: 100%;
  padding: 8px;
  border-radius: 8px;
  border: 2px solid var(--border);
  font-size: 0.82rem;
}

.gdn-party-list { margin-bottom: 12px; font-size: 0.82rem; color: var(--text-light); }
.gdn-info { font-size: 0.78rem; color: var(--text-light); margin-bottom: 10px; }

.gdn-section {
  margin-top: 16px;
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--purple-dark);
  margin-bottom: 8px;
}

.gdn-empty { color: var(--text-light); font-size: 0.82rem; }

.gdn-run {
  padding: 5px 0;
  border-bottom: 1px solid rgba(153, 102, 255, 0.08);
  font-size: 0.78rem;
}

.gdn-alive { color: #5dde7a; font-weight: 600; }
.gdn-ko { color: #ff6b6b; font-weight: 600; }

.gdn-result { padding: 10px 0; }
.gdn-result-icon { font-size: 3rem; margin-bottom: 10px; }

.gdn-result-title {
  font-weight: 800;
  font-size: 1.15rem;
  color: var(--purple-dark);
  margin-bottom: 4px;
}

.gdn-result-sub { font-size: 0.82rem; color: var(--text-light); margin-bottom: 14px; }

.gdn-reward-box {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.12), rgba(153, 102, 255, 0.08));
  border-radius: 14px;
  padding: 14px;
  margin-bottom: 14px;
}

.gdn-reward-pp { font-size: 1.5rem; font-weight: 800; color: #e6a800; }
.gdn-reward-sub { font-size: 0.82rem; color: #5dde7a; margin-top: 4px; }

.gdn-survival {
  text-align: left;
  margin-bottom: 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
}

.gdn-survival-title {
  font-weight: 700;
  font-size: 0.78rem;
  color: var(--purple-dark);
  margin-bottom: 6px;
}

.gdn-survival-row { padding: 4px 0; font-size: 0.78rem; }
</style>

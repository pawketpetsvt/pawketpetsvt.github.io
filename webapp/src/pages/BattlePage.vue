<template>
  <div class="page-wrap">
    <!-- EXPLORING: pick a pet, pick a zone, go looking for a fight -->
    <template v-if="s.phase === 'exploring' && !dungeon.active">
      <div class="page-hero">
        <div class="sparkle-row">🌲 ⚔️ 🌲</div>
        <h1>Wildwood Forest</h1>
        <p>Explore and battle wild creatures!</p>
      </div>

      <div v-if="loading" class="text-center py-4"><div class="spinner"></div></div>

      <div v-else-if="!totalPets" class="pp-empty text-center">
        You have no pets! <router-link to="/adopt">Adopt one first.</router-link>
      </div>

      <template v-else>
        <!-- Expeditions sit above the fight setup on the live battle page, and
             share the pet list — a pet that's away can't also be battling.
             Rendered before the "all exploring" branch on purpose: when every
             pet is out, this panel is exactly what you need to collect them. -->
        <ExpeditionPanel :pets="allPets" @changed="load" />

        <div v-if="!pets.length" class="pp-empty text-center">
          All your pets are exploring! Wait for them to return. 🧭
        </div>

        <template v-else>
          <h3 class="pp-section-title">Choose Your Fighter</h3>
          <p class="pp-helper">Select a pet to battle ({{ pets.length }} available)</p>
          <div class="row row-cols-1 row-cols-md-2 g-3">
            <div v-for="pet in pets" :key="pet.id" class="col">
              <BattlePetCard :pet="pet" :selected="selectedPetId === pet.id" @select="selectPet" />
            </div>
          </div>

          <div class="d-flex flex-column gap-2 mt-3">
            <button class="btn btn-outline pp-heal-btn" :disabled="!selectedPet || healing" @click="heal">
              {{ healing ? 'Healing...' : `💚 Quick Heal (${HEAL_COST} PP)` }}
            </button>
            <button class="btn btn-outline pp-energy-btn" :disabled="!selectedPet || toppingUp" @click="topUp">
              {{ toppingUp ? 'Topping up...' : `⚡ Energy Top-Up (${TOPUP_COST} PP)` }}
            </button>
          </div>

          <h3 class="pp-section-title mt-4">Choose Your Destination</h3>
          <div class="row row-cols-1 row-cols-md-2 g-3">
            <div v-for="zone in zones" :key="zone.key" class="col">
              <button class="pp-zone-btn w-100 h-100" :class="{ 'pp-selected': selectedZone === zone.key }"
                :style="{ borderColor: zone.color }" @click="selectedZone = zone.key">
                <div class="pp-zone-icon">{{ zone.icon }}</div>
                <div class="pp-zone-name">{{ zone.name }}</div>
                <div class="pp-zone-blurb">{{ zone.blurb }}</div>
                <div class="pp-zone-diff" :style="{ color: zone.color }">{{ zone.difficulty }}</div>
                <div class="pp-zone-denizens">{{ zone.denizens }}</div>
                <div class="pp-zone-cost">{{ zoneCostLabel(zone) }}</div>
              </button>
            </div>
          </div>

            <!-- Ports showExplorationResult() — the non-battle outcome panel. -->
          <div v-if="lastEncounter" class="pp-encounter">
            <div class="pp-encounter-title">{{ lastEncounter.title }}</div>
            <div class="pp-encounter-body">{{ lastEncounter.body }}</div>
            <div v-if="lastEncounter.note" class="pp-encounter-note">{{ lastEncounter.note }}</div>
            <div class="pp-encounter-reward">{{ lastEncounter.reward }}</div>
            <button class="btn btn-primary btn-sm mt-2" @click="lastEncounter = null">Continue</button>
          </div>

          <div class="text-center mt-4">
            <button class="btn btn-primary btn-lg" :disabled="!canExplore || exploring" @click="explore">
              {{ exploring ? '🌲 Exploring...' : '🌲 Go Exploring' }}
            </button>
            <p v-if="blockedReason" class="pp-blocked mt-2">{{ blockedReason }}</p>
          </div>
        </template>
      </template>
    </template>

    <!-- DUNGEON GAUNTLET -->
    <DungeonRun v-else-if="dungeon.active" @exit="exitDungeon" />

    <!-- FIGHTING / OVER -->
    <template v-else>
      <BattleArena @done="finish" />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { AppState } from '../AppState.js'
import { battleService, battleState } from '../services/BattleService.js'
import { dungeonService, dungeonState } from '../services/DungeonService.js'
import { encounterService } from '../services/EncounterService.js'
import { playerService } from '../services/PlayerService.js'
import { inventoryService } from '../services/InventoryService.js'
import { toastService } from '../services/ToastService.js'
import { ZONE_CONFIG } from '../data/battleData.js'
import { ZONE_META } from '../data/zoneMeta.js'
import BattleArena from '../components/battle/BattleArena.vue'
import BattlePetCard from '../components/battle/BattlePetCard.vue'
import DungeonRun from '../components/battle/DungeonRun.vue'
import ExpeditionPanel from '../components/battle/ExpeditionPanel.vue'

const HEAL_COST = 100
const TOPUP_COST = 220

const s = battleState
const dungeon = dungeonState
const pets = ref([])
const totalPets = ref(0)
const allPets = ref([])
const loading = ref(true)
const exploring = ref(false)
const healing = ref(false)
const toppingUp = ref(false)
const selectedPetId = ref('')
const selectedZone = ref('outskirts')
// Non-battle exploration outcome, shown until dismissed.
const lastEncounter = ref(null)

// Secret zones stay out of the picker until the unlock system is migrated —
// showing a permanently locked button would misrepresent them as reachable.
const zones = computed(() => ZONE_META.filter(z => !z.secret))

const selectedPet = computed(() => pets.value.find(p => p.id === selectedPetId.value) || null)

function energyCost(zoneKey) {
  return (ZONE_CONFIG[zoneKey] || ZONE_CONFIG.outskirts).energyCost
}

// The dungeon isn't in ZONE_CONFIG — it draws on a daily energy budget rather
// than a per-run cost, so it says so instead of falling back to outskirts' 5.
function zoneCostLabel(zone) {
  return zone.isDungeon ? '⚡ 15 from your daily budget' : `⚡ ${energyCost(zone.key)} energy`
}

const blockedReason = computed(() => {
  const pet = selectedPet.value
  if (!pet) return 'Pick a pet to explore with.'
  const name = pet.nickname || pet.pets?.name || 'Your pet'
  if (isDungeonZone.value) {
    return dungeonService.canRun() ? '' : 'Not enough energy left for a dungeon run today.'
  }
  const cost = energyCost(selectedZone.value)
  if ((pet.energy || 0) < cost) return `${name} needs ${cost} energy for this zone (has ${pet.energy || 0}).`
  if ((pet.current_hp ?? 1) <= 0) return `${name} has fainted — heal them before exploring.`
  return ''
})

// Ports selectBattlePet()'s localStorage memory of the last pet used.
function selectPet(petId) {
  selectedPetId.value = petId
  try {
    localStorage.setItem('lastBattlePetId_' + AppState.user.id, petId)
  } catch (e) { /* storage blocked — selection still works for this session */ }
}

async function heal() {
  healing.value = true
  try {
    const hp = await battleService.quickHeal(selectedPet.value, HEAL_COST)
    toastService.success(`💚 Pet fully healed! (${hp}/${hp} HP)`)
    await load()
  } catch (err) {
    toastService.error(err.message)
  } finally {
    healing.value = false
  }
}

async function topUp() {
  toppingUp.value = true
  try {
    const energy = await battleService.energyTopUp(selectedPet.value, TOPUP_COST)
    toastService.success(`⚡ Energy fully restored! (${energy}/${energy})`)
    await load()
  } catch (err) {
    toastService.error(err.message)
  } finally {
    toppingUp.value = false
  }
}

const isDungeonZone = computed(() => !!ZONE_META.find(z => z.key === selectedZone.value)?.isDungeon)

const canExplore = computed(() => !!selectedPet.value && !blockedReason.value)

async function exitDungeon() {
  dungeonService.reset()
  await load()
}

async function explore() {
  exploring.value = true
  try {
    // The Shallow Cave isn't a battle zone — it runs the gauntlet instead.
    if (isDungeonZone.value) {
      await dungeonService.start(selectedPetId.value)
      return
    }
    // Exploring isn't always a fight — 18% of the time something else happens
    // (a found item, treasure, a recipe book, or just a moment).
    const encounter = await encounterService.roll(selectedZone.value)
    if (encounter) {
      lastEncounter.value = encounter
      await playerService.refreshSidebarStats(AppState.user.id)
      await inventoryService.getInventory(AppState.user.id)
      return
    }

    const enemy = await battleService.rollEnemy(selectedZone.value, selectedPet.value.level || 1)
    if (!enemy) {
      toastService.error('Nothing stirs here right now — try another zone.')
      return
    }
    await battleService.startBattle(selectedPetId.value, enemy, selectedZone.value)
  } catch (err) {
    toastService.error(err.message)
  } finally {
    exploring.value = false
  }
}

async function finish() {
  battleService.reset()
  await load()
}

async function load() {
  loading.value = true
  try {
    // The in-battle item picker reads AppState.inventory, so it has to be
    // loaded before a fight can start.
    if (!AppState.inventory?.length) {
      await inventoryService.getInventory(AppState.user.id)
    }
    const { available, all, total } = await battleService.getBattlePets(AppState.user.id)
    pets.value = available
    allPets.value = all
    totalPets.value = total

    // Restore the last pet used, falling back to the first available one.
    if (available.length && !available.some(p => p.id === selectedPetId.value)) {
      let remembered = null
      try {
        remembered = localStorage.getItem('lastBattlePetId_' + AppState.user.id)
      } catch (e) { /* unreadable storage — fall back below */ }
      selectedPetId.value = available.some(p => p.id === remembered)
        ? remembered
        : available[0].id
    }
  } catch (err) {
    toastService.error(err.message || 'Could not load your pets.')
  } finally {
    loading.value = false
  }
}

onMounted(load)
// Leaving mid-fight shouldn't strand the shared battle state.
onUnmounted(() => battleService.reset())
</script>

<style lang="scss" scoped>
.pp-encounter {
  margin-top: 20px;
  padding: 16px 18px;
  border: 2.5px solid var(--purple-light);
  border-radius: var(--radius-lg);
  background: rgba(153, 102, 255, 0.06);
  text-align: center;
}

.pp-encounter-title {
  font-family: 'Fredoka One', cursive;
  color: var(--purple-dark);
  margin-bottom: 6px;
}

.pp-encounter-body {
  font-size: 0.9rem;
  line-height: 1.5;
}

.pp-encounter-note {
  font-size: 0.78rem;
  color: var(--text-light);
  font-style: italic;
  margin-top: 6px;
}

.pp-encounter-reward {
  margin-top: 8px;
  font-weight: 800;
  color: var(--green);
}

.pp-section-title {
  text-align: center;
  color: var(--purple);
  margin-bottom: 15px;
  font-family: 'Fredoka One', cursive;
}

.pp-empty {
  padding: 24px;
  border: 2.5px dashed var(--border);
  border-radius: var(--radius-lg);
  color: var(--text-light);
}

.pp-helper {
  text-align: center;
  font-size: 0.85rem;
  color: var(--text-light);
  font-weight: 700;
  margin-bottom: 12px;
}

// Colour-matched to their action, as the legacy buttons were.
.pp-heal-btn {
  color: var(--green);
  border-color: var(--green);
  font-size: 0.85rem;
}

.pp-energy-btn {
  color: #66ff99;
  border-color: #66ff99;
  font-size: 0.85rem;
}

// The legacy zone buttons were entirely inline-styled, so there is no global
// rule to preserve here — the component owns the whole look.
.pp-zone-btn {
  padding: 20px;
  border: 3px solid var(--purple-light);
  border-radius: var(--radius-lg);
  background: var(--white);
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;

  &:hover { transform: translateY(-3px); box-shadow: 0 6px 18px var(--shadow); }
  &.pp-selected { background: var(--purple-light); }
}

.pp-zone-icon { font-size: 2rem; margin-bottom: 8px; }

.pp-zone-name {
  font-weight: bold;
  color: var(--purple);
  font-size: 1.1rem;
  margin-bottom: 4px;
}

.pp-zone-blurb { font-size: 0.85rem; color: var(--text-light); margin-bottom: 8px; }
.pp-zone-diff { font-size: 0.75rem; font-weight: bold; }
.pp-zone-denizens { font-size: 0.7rem; color: var(--text-light); margin-top: 4px; }

.pp-zone-cost {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--purple-dark);
  margin-top: 6px;
}

.pp-blocked { font-size: 0.85rem; color: var(--text-light); font-weight: 700; }
</style>

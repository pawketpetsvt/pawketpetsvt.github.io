<template>
  <div>
    <button class="btn btn-outline btn-sm mb-3" @click="$emit('back')">← Back to Guild</button>
    <h3 class="gh-title">🏠 Guild Hall</h3>
    <div class="gh-sub">Furniture buffs apply to ALL pets owned by guild members.</div>

    <div class="gh-tokens d-flex align-items-center justify-content-between">
      <div>
        <div class="gh-tokens-title">🏅 Guild Tokens</div>
        <div class="gh-tokens-sub">Earned from dungeons and PP donations</div>
      </div>
      <div class="gh-tokens-amount">{{ tokens.toLocaleString() }}</div>
    </div>

    <div class="gh-buffs">
      <div class="gh-buffs-title">✨ Active Buffs (all guild members)</div>
      <div v-if="!buffEntries.length" class="gh-no-buffs">
        No furniture placed yet — no active buffs.
      </div>
      <div v-else>
        <span v-for="b in buffEntries" :key="b.key" class="gh-buff-pill">
          {{ BUFF_LABELS[b.key] || b.key }}: +{{ b.value }}{{ BUFF_UNITS[b.key] || '' }}
        </span>
      </div>
    </div>

    <div class="gh-section">🪑 Furniture Slots ({{ placed.length }}/{{ totalSlots }})</div>

    <div v-if="loading" class="spinner"></div>
    <div v-else class="guild-furniture-grid">
      <div
        v-for="i in totalSlots"
        :key="i - 1"
        class="guild-furniture-slot"
        :class="slotMap[i - 1] ? 'filled' : 'empty'"
        :title="slotMap[i - 1] ? (defOf(slotMap[i - 1]) || {}).desc : ''"
      >
        <template v-if="slotMap[i - 1]">
          <span class="gh-slot-emoji">{{ (defOf(slotMap[i - 1]) || {}).emoji || '📦' }}</span>
          <span class="gh-slot-name">
            {{ (defOf(slotMap[i - 1]) || {}).name || slotMap[i - 1].furniture_key }}
          </span>
          <button v-if="isOfficer" class="btn btn-sm gh-remove-btn" @click="remove(i - 1)">Remove</button>
        </template>
        <template v-else>
          <span class="gh-slot-empty-emoji">🪑</span>
          <span class="gh-slot-empty-label">Empty</span>
          <button v-if="isOfficer" class="btn btn-primary btn-sm gh-place-btn" @click="openShop(i - 1)">
            + Place
          </button>
        </template>
      </div>
    </div>

    <div v-if="guildLevel < GUILD_FURNITURE_MAX_SLOTS" class="gh-next-unlock">
      Reach Guild Level {{ guildLevel + 1 }} to unlock slot {{ totalSlots + 1 }}/{{ GUILD_FURNITURE_MAX_SLOTS }}
    </div>

    <div class="gh-donate">
      <div class="gh-section mb-2">💸 Donate PP for Tokens</div>
      <div class="gh-donate-note">
        Every {{ PP_PER_GUILD_TOKEN }} PP donated = 1 Guild Token. Tokens go to the guild, not your balance.
      </div>
      <div class="d-flex gap-2 align-items-center">
        <input
          v-model="donateAmount"
          type="number"
          :min="PP_PER_GUILD_TOKEN"
          :step="PP_PER_GUILD_TOKEN"
          max="10000"
          class="gh-donate-input"
        />
        <button class="btn btn-primary" :disabled="donating" @click="donate">
          {{ donating ? '...' : 'Donate PP' }}
        </button>
      </div>
    </div>

    <!-- Furniture shop for one slot -->
    <PetModal
      v-if="shopSlot !== null"
      title="🪑 Place Furniture"
      :subtitle="`Slot ${shopSlot + 1} · 🏅 ${tokens.toLocaleString()} tokens available`"
      @close="shopSlot = null"
    >
      <div v-for="tier in tiers" :key="tier" class="mb-3">
        <div class="gh-tier-label">Tier {{ tier }}</div>
        <div class="row row-cols-1 row-cols-sm-2 g-2">
          <div v-for="f in catalogByTier(tier)" :key="f.key" class="col">
            <div class="gh-shop-card h-100" :class="{ unaffordable: !canAfford(f) }">
              <div class="d-flex align-items-center gap-2">
                <span class="gh-shop-emoji">{{ f.emoji }}</span>
                <div class="flex-fill min-w-0">
                  <div class="gh-shop-name">{{ f.name }}</div>
                  <div class="gh-shop-cost">🏅 {{ f.cost }}</div>
                </div>
              </div>
              <div class="gh-shop-desc">{{ f.desc }}</div>
              <div v-if="f.requiresLevel && guildLevel < f.requiresLevel" class="gh-shop-locked">
                Requires Guild Level {{ f.requiresLevel }}
              </div>
              <button
                v-else
                class="btn btn-primary btn-sm w-100 mt-2"
                :disabled="!canAfford(f) || placing"
                @click="place(f)"
              >{{ canAfford(f) ? 'Place' : 'Not enough tokens' }}</button>
            </div>
          </div>
        </div>
      </div>
    </PetModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { guildState } from '../../services/GuildService.js'
import { guildService } from '../../services/GuildService.js'
import { guildFurnitureService } from '../../services/GuildFurnitureService.js'
import { toastService } from '../../services/ToastService.js'
import PetModal from '../pet/PetModal.vue'
import {
  GUILD_FURNITURE_CATALOG, GUILD_FURNITURE_MAX_SLOTS, PP_PER_GUILD_TOKEN,
  BUFF_LABELS, BUFF_UNITS
} from '../../data/guildFurnitureData.js'

defineEmits(['back'])

const loading = ref(true)
const placed = ref([])
const buffs = ref({})
const shopSlot = ref(null)
const placing = ref(false)
const donateAmount = ref(PP_PER_GUILD_TOKEN)
const donating = ref(false)

const guildLevel = computed(() => guildState.myGuild?.guild_level || 1)
const tokens = computed(() => guildState.myGuild?.guild_tokens || 0)
const totalSlots = computed(() => guildFurnitureService.slots())
const isOfficer = computed(() => guildService.isOfficer)

const slotMap = computed(() => {
  const m = {}
  placed.value.forEach(p => { m[p.slot_index] = p })
  return m
})

const buffEntries = computed(() =>
  Object.entries(buffs.value).filter(([, v]) => v > 0).map(([key, value]) => ({ key, value }))
)

const tiers = [...new Set(GUILD_FURNITURE_CATALOG.map(f => f.tier))].sort()
const catalogByTier = tier => GUILD_FURNITURE_CATALOG.filter(f => f.tier === tier)
const defOf = p => guildFurnitureService.def(p.furniture_key)
const canAfford = f => tokens.value >= f.cost

async function load() {
  loading.value = true
  try {
    placed.value = await guildFurnitureService.loadPlaced(true)
    buffs.value = await guildFurnitureService.buffs()
  } catch (e) {
    toastService.error(e.message)
  } finally {
    loading.value = false
  }
}

function openShop(slot) { shopSlot.value = slot }

async function place(f) {
  placing.value = true
  try {
    const def = await guildFurnitureService.place(f.key, shopSlot.value)
    toastService.success(`${def.emoji} ${def.name} placed! Buffs now apply to all guild members.`)
    shopSlot.value = null
    await load()
  } catch (e) {
    toastService.error(e.message)
  } finally {
    placing.value = false
  }
}

async function remove(slot) {
  try {
    await guildFurnitureService.remove(slot)
    await load()
  } catch (e) {
    toastService.error(e.message)
  }
}

async function donate() {
  donating.value = true
  try {
    const { amount, gain } = await guildFurnitureService.donateForTokens(donateAmount.value)
    toastService.success(`Donated ${amount} PP! Guild received 🏅 ${gain} tokens.`)
    await load()
  } catch (e) {
    toastService.error(e.message)
  } finally {
    donating.value = false
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
// style.css owns .guild-furniture-grid and .guild-furniture-slot (+ .filled /
// .empty). The rest was inline in legacy's template string.
.gh-title { color: var(--purple); margin-bottom: 4px; }

.gh-sub {
  font-size: 0.78rem;
  color: var(--text-light);
  margin-bottom: 16px;
}

.gh-tokens {
  background: rgba(255, 215, 0, 0.1);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 16px;
}

.gh-tokens-title { font-weight: 700; font-size: 0.9rem; color: #e6a800; }
.gh-tokens-sub { font-size: 0.75rem; color: var(--text-light); }
.gh-tokens-amount { font-size: 1.5rem; font-weight: 800; color: #e6a800; }

.gh-buffs {
  background: rgba(153, 102, 255, 0.06);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 16px;
}

.gh-buffs-title {
  font-weight: 700;
  font-size: 0.82rem;
  color: var(--purple-dark);
  margin-bottom: 8px;
}

.gh-no-buffs { font-size: 0.78rem; color: var(--text-light); font-style: italic; }

.gh-buff-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: rgba(153, 102, 255, 0.12);
  border: 1px solid rgba(153, 102, 255, 0.25);
  border-radius: 20px;
  padding: 2px 8px;
  font-size: 0.7rem;
  color: var(--purple-dark);
  margin: 2px;
}

.gh-section {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--purple-dark);
  margin-bottom: 10px;
}

.gh-slot-emoji { font-size: 1.8rem; }

.gh-slot-name {
  font-size: 0.65rem;
  color: var(--purple-dark);
  font-weight: 600;
  text-align: center;
  line-height: 1.2;
}

.gh-slot-empty-emoji { font-size: 1.5rem; opacity: 0.3; }
.gh-slot-empty-label { font-size: 0.65rem; color: var(--text-light); }

.gh-remove-btn {
  margin-top: 4px;
  font-size: 0.6rem;
  padding: 1px 6px;
  color: #ff6b6b;
  border-color: #ff6b6b;
}

.gh-place-btn { margin-top: 4px; font-size: 0.62rem; padding: 2px 8px; }

.gh-next-unlock {
  font-size: 0.72rem;
  color: var(--text-light);
  text-align: center;
  margin-top: 8px;
}

.gh-donate {
  margin-top: 20px;
  border-top: 1px solid var(--border);
  padding-top: 16px;
}

.gh-donate-note {
  font-size: 0.78rem;
  color: var(--text-light);
  margin-bottom: 10px;
}

.gh-donate-input {
  width: 90px;
  padding: 6px;
  border-radius: 8px;
  border: 2px solid var(--border);
  font-size: 0.85rem;
  text-align: center;
}

.gh-tier-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-light);
  letter-spacing: 1px;
  margin-bottom: 6px;
}

.gh-shop-card {
  border: 2px solid var(--border);
  border-radius: 12px;
  padding: 10px 12px;
  &.unaffordable { opacity: 0.55; }
}

.gh-shop-emoji { font-size: 1.6rem; }
.gh-shop-name { font-weight: 700; font-size: 0.82rem; color: var(--purple-dark); }
.gh-shop-cost { font-size: 0.75rem; color: #e6a800; font-weight: 700; }

.gh-shop-desc {
  font-size: 0.72rem;
  color: var(--text-light);
  margin-top: 6px;
  line-height: 1.4;
}

.gh-shop-locked {
  font-size: 0.7rem;
  color: #ff6b6b;
  margin-top: 6px;
  font-weight: 600;
}
</style>

<template>
  <div class="page-wrap">
    <div class="page-hero">
      <div class="sparkle-row">🍉 ✦ 🍉</div>
      <h1>Melon's Melons</h1>
      <p>Spend your PawketPoints! ✨</p>
    </div>
    <PointsBanner :points="points" />

    <!-- No layout utilities here on purpose: style.css already owns
         `.shop-tabs` entirely (flex, 10px gap, centered, 28px margin). Adding
         utilities would silently override those values rather than preserve
         them — only convert what the component itself styles. -->
    <div class="shop-tabs">
      <button
        v-for="t in TABS"
        :key="t.key"
        class="shop-tab"
        :class="{ active: activeTab === t.key }"
        @click="switchTab(t.key)"
      >{{ t.label }}</button>
    </div>

    <div v-if="loading" class="spinner"></div>

    <template v-else-if="activeTab === 'items'">
      <div v-if="!petCareSections.length" class="empty-state"><p>No items yet!</p></div>
      <template v-for="section in petCareSections" :key="section.key">
        <div class="shop-cat-heading">
          <div class="shop-category-title">{{ section.title }}</div>
          <div v-if="section.desc" class="shop-category-desc">{{ section.desc }}</div>
        </div>
        <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-4">
          <div v-for="item in section.items" :key="item.id" class="col"><div class="shop-card h-100">
            <div class="shop-item-icon"><ItemIcon :item="item" /></div>
            <div class="shop-item-name">{{ item.name }}</div>
            <div v-if="section.key === 'food' && item.foodCategory" class="food-category-label" :class="{ featured: isFoodFeatured(item.foodCategory) }">
              {{ getFoodCategoryLabel(item.foodCategory) }}<span v-if="isFoodFeatured(item.foodCategory)"> ⭐ Featured</span>
            </div>
            <div class="shop-item-desc">{{ item.description }}</div>
            <div v-if="item.effectTags.length" class="shop-effects">
              <span v-for="tag in item.effectTags" :key="tag" class="effect-tag">{{ tag }}</span>
            </div>
            <div class="shop-item-price">🪙 {{ item.price }} PP</div>
            <button class="btn-buy" :disabled="points < item.price || buyingId === item.id" @click="buy(item)">
              {{ points >= item.price ? 'Buy' : 'Need ' + item.price + ' PP' }}
            </button>
            <button v-if="isBulkEligible(item)" class="btn-buy-5" :disabled="points < item.price * 5 || buyingId === item.id" @click="buy(item, 5)">
              Buy 5x ({{ item.price * 5 }} PP)
            </button>
            </div>
          </div>
        </div>
      </template>
    </template>

    <template v-else-if="activeTab === 'consumables'">
      <div v-if="!consumables.length" class="empty-state"><p>No consumables available yet!</p></div>
      <div v-else class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-4">
        <div v-for="item in consumables" :key="item.id" class="col"><div class="shop-card h-100">
          <div class="shop-item-icon"><ItemIcon :item="item" /></div>
          <div class="shop-item-name">{{ item.name }}</div>
          <div class="shop-item-desc">{{ item.description || 'Battle consumable' }}</div>
          <div class="shop-item-price">🪙 {{ item.price }} PP</div>
          <button class="btn-buy" :disabled="points < item.price || buyingId === item.id" @click="buy(item)">
            {{ points >= item.price ? 'Buy' : 'Need ' + item.price + ' PP' }}
          </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Ports the Equipment shop tab (loadEquipmentShop). Stock rotates
         weekly A/B/C, so what's here changes; gear is bought unequipped and
         assigned to a pet from My Pets → Manage. -->
    <template v-else-if="activeTab === 'equipment'">
      <div class="pp-equip-filters">
        <button v-for="f in EQUIP_FILTERS" :key="f.key" class="shop-tab"
          :class="{ active: equipFilter === f.key }" @click="setEquipFilter(f.key)">{{ f.label }}</button>
      </div>
      <p class="pp-rotation">Stock rotates weekly — currently showing week {{ rotationWeek }}.</p>

      <div v-if="!equipment.length" class="empty-state"><p>No equipment in this week's rotation!</p></div>
      <div v-else class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-4">
        <div v-for="item in equipment" :key="item.id" class="col"><div class="shop-card h-100">
          <div class="shop-item-icon">{{ item.icon || '⚔️' }}</div>
          <div class="shop-item-name">
            {{ item.name }} <span class="pp-tier">T{{ item.tier || 1 }}</span>
          </div>
          <div class="shop-item-desc">{{ equipBonusText(item) }}</div>
          <div v-if="item.passive_effect" class="pp-passive">
            ✨ {{ item.passive_effect.replace(/_/g, ' ') }} ({{ item.passive_chance }}%)
          </div>
          <div class="pp-req">Needs pet level {{ equipmentService.tierMinLevel(item.tier || 1) }}</div>
          <div class="shop-item-price">🪙 {{ item.price }} PP</div>
          <button class="btn-buy" :disabled="points < item.price || buyingId === item.id"
            @click="buyEquipment(item)">
            {{ points >= item.price ? 'Buy' : 'Need ' + item.price + ' PP' }}
          </button>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div v-if="!AppState.inventory.length" class="empty-state"><p>Inventory empty!</p></div>
      <div v-else class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-4">
        <div v-for="item in AppState.inventory" :key="item.invId" class="col"><div class="inv-card h-100">
          <div class="inv-item-icon"><ItemIcon :item="item" /></div>
          <div class="inv-item-name">{{ item.name }}</div>
          <div v-if="item.effectText" class="inv-effect">{{ item.effectText }}</div>
          <div class="inv-item-qty">x{{ item.qty }}</div>
          <p class="inv-use-hint">Use items from <router-link to="/mypets">My Pets</router-link></p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { AppState } from '../AppState.js'
import { playerService } from '../services/PlayerService.js'
import { inventoryService } from '../services/InventoryService.js'
import { shopService } from '../services/ShopService.js'
import { equipmentService } from '../services/EquipmentService.js'
import { toastService } from '../services/ToastService.js'
import { isFoodFeatured, getFoodCategoryLabel } from '../utils/itemIcons.js'
import PointsBanner from '../components/PointsBanner.vue'
import ItemIcon from '../components/ItemIcon.vue'

const CATEGORY_CONFIG = [
  { key: 'food', title: '🍕 Food', desc: 'Keep your pet well-fed and happy!' },
  { key: 'toys', title: '🎾 Toys', desc: 'Fun items to boost happiness!' },
  { key: 'energy', title: '⚡ Energy', desc: 'Restore energy for more activities!' },
  { key: 'other', title: '📦 Other Items', desc: '' }
]

const BULK_ELIGIBLE_TYPES = ['food', 'snack', 'medicine', 'drink', 'energy', 'toy']

const TABS = [
  { key: 'items', label: '🐾 Pet Care' },
  { key: 'consumables', label: '🧪 Consumables' },
  { key: 'equipment', label: '⚔️ Equipment' },
  { key: 'inventory', label: '🎒 My Inventory' }
]

const activeTab = ref('items')
const loading = ref(true)
const catalog = ref({ food: [], toys: [], energy: [], other: [] })
const consumables = ref([])
const buyingId = ref('')
const equipment = ref([])
const equipFilter = ref('all')

// Ports filterEquipment()'s tabs. Equipment rows carry the slot under one of
// a few column names depending on how they were seeded, so the service checks
// all of them.
const EQUIP_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'weapon', label: '⚔️ Weapons' },
  { key: 'armor', label: '🛡️ Armor' }
]

const rotationWeek = equipmentService.currentRotationWeek()

async function setEquipFilter(key) {
  equipFilter.value = key
  equipment.value = await equipmentService.getShopStock(key)
}

function equipBonusText(item) {
  const parts = []
  if (item.attack_bonus) parts.push(`+${item.attack_bonus} ATK`)
  if (item.defense_bonus) parts.push(`+${item.defense_bonus} DEF`)
  if (item.speed_bonus) parts.push(`+${item.speed_bonus} SPD`)
  if (item.hp_bonus) parts.push(`+${item.hp_bonus} HP`)
  if (item.luck_bonus) parts.push(`+${item.luck_bonus} LCK`)
  if (item.spirit_bonus) parts.push(`+${item.spirit_bonus} SPI`)
  if (item.hp_penalty_pct) parts.push(`−${Math.round(item.hp_penalty_pct * 100)}% max HP`)
  return parts.join(' · ') || item.description || 'Equipment'
}

async function buyEquipment(item) {
  buyingId.value = item.id
  try {
    await equipmentService.buy(item)
    await playerService.refreshSidebarStats(AppState.user.id)
    toastService.success('Bought ' + item.name + '!')
  } catch (err) {
    toastService.error(err.message)
  } finally {
    buyingId.value = ''
  }
}
const loadedTabs = new Set(['items'])

const points = computed(() => AppState.player ? AppState.player.pawketpoints : 0)
const petCareSections = computed(() =>
  CATEGORY_CONFIG.map(c => ({ ...c, items: catalog.value[c.key] || [] })).filter(s => s.items.length)
)

function isBulkEligible(item) {
  return BULK_ELIGIBLE_TYPES.includes((item.itemType || '').toLowerCase())
}

async function switchTab(tab) {
  activeTab.value = tab
  if (loadedTabs.has(tab)) return
  loadedTabs.add(tab)
  if (tab === 'consumables') consumables.value = await shopService.getConsumables()
  if (tab === 'equipment') equipment.value = await equipmentService.getShopStock(equipFilter.value)
}

async function buy(item, qty = 1) {
  buyingId.value = item.id
  try {
    await shopService.buyItem(item, qty)
    await inventoryService.getInventory(AppState.user.id)
    await playerService.refreshSidebarStats(AppState.user.id)
    toastService.success('Bought ' + (qty > 1 ? qty + 'x ' : '') + item.name + '!')
  } catch (err) {
    toastService.error(err.message)
  } finally {
    buyingId.value = ''
  }
}

onMounted(async () => {
  await playerService.getPlayer(AppState.user.id)
  await inventoryService.getInventory(AppState.user.id)
  catalog.value = await shopService.getCatalog()
  loading.value = false
})
</script>

<style lang="scss" scoped>
.pp-equip-filters {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.pp-rotation {
  text-align: center;
  font-size: 0.78rem;
  color: var(--text-light);
  margin-bottom: 16px;
}

.pp-tier {
  font-size: 0.68rem;
  color: var(--purple);
  border: 1px solid var(--purple-light);
  border-radius: 6px;
  padding: 0 4px;
}

.pp-passive {
  font-size: 0.72rem;
  color: var(--green);
  font-weight: 700;
}

.pp-req {
  font-size: 0.7rem;
  color: var(--text-light);
}

.shop-cat-heading {
  // Renamed off "…-header": the global `[class*="header"]` rule forces
  // flex + space-between + a 56px min-height and makes children inline-flex,
  // which laid the title and description side by side instead of stacked.
  // `grid-column` dropped too — this block is a sibling of the row now, not a
  // CSS-grid child, so it had no effect.
  padding: 20px 10px 10px;
  border-bottom: 3px solid var(--purple-light);
  margin-bottom: 10px;
}

.shop-category-title {
  font-size: 1.4rem;
  font-weight: bold;
  color: var(--purple);
  margin-bottom: 5px;
}

.shop-category-desc {
  font-size: 0.9rem;
  color: var(--text-light);
}

.food-category-label {
  font-size: 0.85rem;
  color: #888;
  margin: 4px 0;
  font-weight: normal;

  &.featured {
    color: #ff6600;
    font-weight: bold;
  }
}

.btn-buy-5 {
  font-size: 0.7rem;
  padding: 4px 8px;
  margin-top: 4px;
  background: rgba(153, 102, 255, 0.15);
  border: 1px solid var(--purple-light);
  border-radius: 8px;
  cursor: pointer;
  width: 100%;
  color: var(--purple-dark);

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.inv-effect {
  font-size: 0.85rem;
  color: var(--green);
  margin-top: 4px;
}

.inv-use-hint {
  font-size: 0.75rem;
  color: var(--text-light);
  margin-top: 8px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-light);
}
</style>

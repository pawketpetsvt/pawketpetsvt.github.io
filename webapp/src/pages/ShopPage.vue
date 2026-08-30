<template>
  <div class="page-wrap container-fluid position-relative z-1 pb-page">
    <div class="page-hero">
      <div class="sparkle-row">🍉 ✦ 🍉</div>
      <h1>Melon's Melons</h1>
      <p>Spend your PawketPoints! ✨</p>
    </div>
    <PointsBanner :points="points" />

    <!-- No layout utilities here on purpose: the global stylesheet already owns
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
            <div class="shop-item-price">
            <span v-if="discounted" class="shop-price-was">{{ item.price }}</span>
            🪙 {{ priceOf(item) }} PP
          </div>
            <button class="btn-buy" :disabled="points < priceOf(item) || buyingId === item.id" @click="buy(item)">
              {{ points >= priceOf(item) ? 'Buy' : 'Need ' + priceOf(item) + ' PP' }}
            </button>
            <button v-if="isBulkEligible(item)" class="btn-buy-5" :disabled="points < priceOf(item) * 5 || buyingId === item.id" @click="buy(item, 5)">
              Buy 5x ({{ priceOf(item) * 5 }} PP)
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
          <div class="shop-item-price">
            <span v-if="discounted" class="shop-price-was">{{ item.price }}</span>
            🪙 {{ priceOf(item) }} PP
          </div>
          <button class="btn-buy" :disabled="points < priceOf(item) || buyingId === item.id" @click="buy(item)">
            {{ points >= priceOf(item) ? 'Buy' : 'Need ' + priceOf(item) + ' PP' }}
          </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Ports the Equipment shop tab (loadEquipmentShop). Stock rotates
         weekly A/B/C, so what's here changes; gear is bought unequipped and
         assigned to a pet from My Pets → Manage. -->
    <template v-else-if="activeTab === 'equipment'">
      <div class="d-flex gap-2 justify-content-center flex-wrap mb-2">
        <button v-for="f in EQUIP_FILTERS" :key="f.key" class="shop-tab"
          :class="{ active: equipFilter === f.key }" @click="setEquipFilter(f.key)">{{ f.label }}</button>
      </div>
      <p class="pp-rotation text-center mb-3">Stock rotates weekly — currently showing week {{ rotationWeek }}.</p>

      <div v-if="!equipment.length" class="empty-state"><p>No equipment in this week's rotation!</p></div>
      <div v-else class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-4">
        <div v-for="item in equipment" :key="item.id" class="col"><div class="shop-card h-100">
          <div class="shop-item-icon">{{ item.icon || '⚔️' }}</div>
          <div class="shop-item-name">
            {{ item.name }} <span class="pp-tier py-0 px-1">T{{ item.tier || 1 }}</span>
          </div>
          <div class="shop-item-desc">{{ equipBonusText(item) }}</div>
          <div v-if="item.passive_effect" class="pp-passive">
            ✨ {{ item.passive_effect.replace(/_/g, ' ') }} ({{ item.passive_chance }}%)
          </div>
          <div class="pp-req">Needs pet level {{ equipmentService.tierMinLevel(item.tier || 1) }}</div>
          <div class="shop-item-price">
            <span v-if="discounted" class="shop-price-was">{{ item.price }}</span>
            🪙 {{ priceOf(item) }} PP
          </div>
          <button class="btn-buy" :disabled="points < priceOf(item) || buyingId === item.id"
            @click="buyEquipment(item)">
            {{ points >= priceOf(item) ? 'Buy' : 'Need ' + priceOf(item) + ' PP' }}
          </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Ports the Furniture shop tab (furniture_loadShop), deferred out of
         Phase 3 because furniture had no consumer until Housing. -->
    <template v-else-if="activeTab === 'furniture'">
      <div class="pp-furn-note">
        🏠 <strong>Furniture is shared</strong> — one purchase works in every pet's room, and in
        <router-link to="/housing">your own room</router-link> too.<br />
        ✨ Each item in a pet's room gives that pet a <strong>daily happiness boost</strong> on login.
      </div>

      <div v-if="!furniture.length" class="empty-state"><p>No furniture available yet!</p></div>
      <div v-else class="row row-cols-2 row-cols-sm-3 row-cols-lg-4 g-3">
        <div v-for="item in furniture" :key="item.id" class="col">
          <div class="shop-card h-100" :class="{ 'pp-owned': owns(item) }">
            <div class="shop-item-icon">{{ item.emoji || '🪑' }}</div>
            <div class="shop-item-name">{{ item.name }}</div>
            <div v-if="item.description" class="shop-item-desc">{{ item.description }}</div>
            <div class="pp-happy">+{{ item.happiness_bonus || 0 }} happiness/day</div>
            <div v-if="furnitureBonus(item)" class="pp-passive">{{ furnitureBonus(item) }}</div>
            <template v-if="owns(item)">
              <div class="pp-owned-tag">✅ Owned</div>
            </template>
            <template v-else>
              <div class="shop-item-price">🪙 {{ furnitureService.priceOf(item) }} PP</div>
              <button class="btn-buy" :disabled="points < furnitureService.priceOf(item) || buyingId === item.id"
                @click="buyFurniture(item)">
                {{ points >= furnitureService.priceOf(item) ? 'Buy' : 'Need ' + furnitureService.priceOf(item) + ' PP' }}
              </button>
            </template>
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
          <div v-if="item.effectText" class="inv-effect mt-1">{{ item.effectText }}</div>
          <div class="inv-item-qty">x{{ item.qty }}</div>
          <p class="inv-use-hint mt-2">Use items from <router-link to="/mypets">My Pets</router-link></p>
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
import { furnitureService, furnitureState } from '../services/FurnitureService.js'
import { taskTracker } from '../services/TaskTrackerService.js'
import { petMoodService } from '../services/PetMoodService.js'
import { ROOM_BONUS_LABELS } from '../data/roomData.js'
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
  { key: 'furniture', label: '🪑 Furniture' },
  { key: 'inventory', label: '🎒 My Inventory' }
]

const activeTab = ref('items')
const loading = ref(true)
const catalog = ref({ food: [], toys: [], energy: [], other: [] })
const consumables = ref([])
const buyingId = ref('')
const equipment = ref([])
const equipFilter = ref('all')
const furniture = ref([])

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
function owns(item) {
  return furnitureService.ownsId(item.id)
}

// Furniture can carry a room bonus on top of its happiness value; the player
// room reads those, so they're worth surfacing before you buy.
function furnitureBonus(item) {
  if (!item.bonus_type || !item.bonus_value) return ''
  return (ROOM_BONUS_LABELS[item.bonus_type] || '+{v} Bonus').replace('{v}', item.bonus_value)
}

async function buyFurniture(item) {
  buyingId.value = item.id
  try {
    await furnitureService.buy(item)
    await playerService.refreshSidebarStats(AppState.user.id)
    toastService.success('🪑 ' + item.name + ' purchased! Place it from any room.')
  } catch (err) {
    toastService.error(err.message)
  } finally {
    buyingId.value = ''
  }
}

const loadedTabs = new Set(['items'])

const points = computed(() => AppState.player ? AppState.player.pawketpoints : 0)

// Guild shop-discount perk. Both the price shown and the price charged come
// from shopService.effectivePrice, so they cannot disagree — legacy computed
// them at two separate call sites.
const discounted = computed(() => shopService.hasDiscount())
const priceOf = item => shopService.effectivePrice(item)
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
  if (tab === 'furniture') {
    await furnitureService.load()
    furniture.value = furnitureState.catalog
  }
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
  // Melon's "stop by the shop, even just to browse" request is satisfied by
  // arriving, so this fires before anything can fail.
  taskTracker.report('visit_shop')
  // A pet can wish for a shop visit — legacy sweeps every pet from showTab().
  petMoodService.completeWishAll('visit_shop')
  await playerService.getPlayer(AppState.user.id)
  await inventoryService.getInventory(AppState.user.id)
  catalog.value = await shopService.getCatalog()
  loading.value = false
})
</script>

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.shop-card {
  background: var(--white) !important;
  border: 4px solid var(--border) !important;
  border-radius: var(--radius-xl) !important;
  padding: 24px 20px !important;
  text-align: center !important;
  box-shadow: 0 8px 24px rgba(153,102,255,0.25) !important;
  transition: all 0.3s !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  gap: 12px !important;
}
.shop-card:hover {
  transform: translateY(-8px) scale(1.02) !important;
  box-shadow: 0 16px 40px rgba(153,102,255,0.35) !important;
}
.shop-item-icon {
  width: 100px !important;
  height: 100px !important;
  border-radius: 50% !important;
  background: linear-gradient(135deg, var(--purple-light), var(--pink-light)) !important;
  border: 4px solid var(--purple) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 3.5rem !important;
  margin: 0 auto 8px !important;
  box-shadow: 0 6px 20px rgba(153,102,255,0.3) !important;
  overflow: hidden !important;
}
.shop-item-icon img {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}
.shop-item-name {
  font-family: 'Chewy', cursive !important;
  font-size: 1.4rem !important;
  color: var(--purple-dark) !important;
  font-weight: 600 !important;
  margin-top: 4px !important;
  text-shadow: 1px 1px 0 var(--pink-light) !important;
}
.shop-item-desc {
  font-size: 0.9rem !important;
  color: var(--text) !important;
  line-height: 1.6 !important;
  flex: 1 !important;
  font-weight: 500 !important;
  min-height: 40px !important;
}
.shop-effects {
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 6px !important;
  justify-content: center !important;
  margin: 8px 0 !important;
}
.effect-tag {
  background: linear-gradient(135deg, var(--green), #3ab85a) !important;
  color: var(--white) !important;
  font-size: 0.75rem !important;
  padding: 4px 10px !important;
  border-radius: 15px !important;
  border: 2px solid rgba(255,255,255,0.5) !important;
  font-weight: 700 !important;
  box-shadow: 0 2px 6px rgba(93,222,122,0.3) !important;
  font-family: 'Fredoka', cursive !important;
}
.shop-item-price {
  font-family: 'Chewy', cursive !important;
  font-size: 1.2rem !important;
  color: var(--purple-dark) !important;
  background: var(--purple-light) !important;
  padding: 8px 20px !important;
  border-radius: 25px !important;
  border: 2px solid var(--purple) !important;
  font-weight: 600 !important;
  margin: 4px 0 !important;
}
.btn-buy {
  width: 100% !important;
  font-family: 'Chewy', cursive !important;
  font-size: 1.05rem !important;
  padding: 12px 24px !important;
  border-radius: 30px !important;
  background: linear-gradient(135deg, var(--yellow), var(--orange)) !important;
  color: var(--text) !important;
  border: 3px solid rgba(255,255,255,0.5) !important;
  cursor: pointer !important;
  transition: all 0.2s !important;
  font-weight: 600 !important;
  box-shadow: 0 4px 12px rgba(255,153,51,0.3) !important;
}
.btn-buy:hover:not(:disabled) {
  transform: translateY(-3px) !important;
  box-shadow: 0 6px 16px rgba(255,153,51,0.4) !important;
}
.btn-buy:disabled {
  opacity: 0.5 !important;
  cursor: not-allowed !important;
  background: #ccc !important;
  color: #888 !important;
}
.inv-card {
  background: var(--white) !important;
  border: 4px solid var(--border) !important;
  border-radius: var(--radius-xl) !important;
  padding: 20px !important;
  text-align: center !important;
  box-shadow: 0 6px 20px rgba(153,102,255,0.2) !important;
  transition: all 0.3s !important;
}
.inv-card:hover {
  transform: translateY(-6px) !important;
  box-shadow: 0 12px 30px rgba(153,102,255,0.3) !important;
}
.inv-item-icon {
  width: 80px !important;
  height: 80px !important;
  border-radius: 50% !important;
  background: linear-gradient(135deg, var(--purple-light), var(--pink-light)) !important;
  border: 3px solid var(--purple) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 3rem !important;
  margin: 0 auto 10px !important;
  box-shadow: 0 4px 12px rgba(153,102,255,0.25) !important;
}
.inv-item-name {
  font-family: 'Chewy', cursive !important;
  font-size: 1.2rem !important;
  color: var(--purple-dark) !important;
  font-weight: 600 !important;
  margin-bottom: 6px !important;
}
.inv-item-qty {
  font-size: 0.95rem !important;
  color: var(--text-light) !important;
  font-weight: 700 !important;
  background: rgba(153,102,255,0.1) !important;
  padding: 4px 12px !important;
  border-radius: 15px !important;
  display: inline-block !important;
  margin-top: 6px !important;
}
.shop-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 52px;
  min-height: 52px;
}
@media (max-width: 768px) {
  .shop-item-name { font-size: 0.85rem !important; }
  .shop-item-price { font-size: 0.8rem !important; }
  .btn-buy { font-size: 0.78rem !important; padding: 7px !important; }
}

// Shown only while a guild discount perk is running.
.shop-price-was {
  text-decoration: line-through;
  color: var(--text-light);
  font-weight: 400;
  margin-right: 4px;
}

.pp-rotation {
  font-size: 0.78rem;
  color: var(--text-light);
}

.pp-tier {
  font-size: 0.68rem;
  color: var(--purple);
  border: 1px solid var(--purple-light);
  border-radius: 6px;
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

// Ports the amber info banner furniture_loadShop() renders above its grid.
.pp-furn-note {
  background: rgba(255, 170, 0, 0.1);
  border: 1px solid rgba(255, 170, 0, 0.3);
  border-radius: 12px;
  padding: 10px 14px;
  margin-bottom: 14px;
  font-size: 0.78rem;
  line-height: 1.6;
  color: #b37700;

  a { color: #b37700; font-weight: 700; }
}

.pp-happy {
  font-size: 0.78rem;
  color: #5dde7a;
  font-weight: 600;
}

.pp-owned {
  background: rgba(93, 222, 122, 0.06);
}

.pp-owned-tag {
  font-size: 0.75rem;
  color: #5dde7a;
  font-weight: 700;
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
}

.inv-use-hint {
  font-size: 0.75rem;
  color: var(--text-light);
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-light);
}
</style>

<template>
  <div class="page-wrap container-fluid position-relative z-1 pb-page">
    <div class="page-hero">
      <div class="sparkle-row">🍳 ✦ 🍵</div>
      <h1>Kitchen</h1>
      <p>Combine ingredients to discover recipes and cook meals for your pets.</p>
    </div>

    <div class="cooking-subtabs d-flex flex-wrap gap-2 mb-gap">
      <button
        v-for="t in TABS"
        :key="t.key"
        class="cooking-tab-btn"
        :class="{ active: activeTab === t.key }"
        @click="activeTab = t.key"
      >{{ t.label }}</button>
    </div>

    <div v-if="loading" class="spinner"></div>

    <template v-else>
      <!-- CRAFT -->
      <div v-if="activeTab === 'craft'" class="row g-3">
        <div class="col-12 col-md-7">
          <div class="craft-col-label">Your Ingredients</div>
          <div class="cooking-ingredient-grid gap-2">
            <div
              v-for="id in ingredientIds"
              :key="id"
              class="cooking-ingredient-card"
              :class="{ 'out-of-stock': !(ingredients[id] > 0) }"
              :title="COOKING_INGREDIENTS[id].name + ' (' + (ingredients[id] || 0) + ' owned)'"
              @click="addToSlot(id)"
            >
              <span class="ing-emoji">{{ COOKING_INGREDIENTS[id].emoji }}</span>
              <span class="ing-name">{{ COOKING_INGREDIENTS[id].name }}</span>
              <span class="ing-count">{{ ingredients[id] || 0 }}</span>
            </div>
          </div>
        </div>

        <div class="col-12 col-md-5">
          <div class="craft-col-label">Crafting Slots</div>
          <div class="row row-cols-2 g-2 mb-3">
            <div v-for="(id, idx) in slots" :key="idx" class="col">
              <div class="cooking-slot" :class="{ filled: id }" @click="removeSlot(idx)">
                <template v-if="id">
                  <span class="cook-slot-emoji">{{ COOKING_INGREDIENTS[id].emoji }}</span>
                  <span class="cook-slot-ing-name">{{ COOKING_INGREDIENTS[id].name }}</span>
                </template>
                <span v-else class="cook-slot-label">+</span>
              </div>
            </div>
          </div>
          <div class="cooking-recipe-hint text-center mb-px10">{{ hint }}</div>
          <button class="btn btn-primary cook-btn" :class="{ 'recipe-ready': !!match }" :disabled="!filled.length || cooking" @click="cook">
            {{ cooking ? 'Cooking...' : (filled.length && !match ? 'Try Cooking' : 'Cook!') }}
          </button>
          <div class="multi-count-row d-flex align-items-center gap-2 mt-2">
            <label>x</label>
            <input type="number" v-model.number="multiCount" min="1" max="20" class="px-2 py-1 rounded-1" />
            <span>batches (multi-craft)</span>
          </div>
        </div>
      </div>

      <!-- RECIPE BOOK -->
      <div v-else-if="activeTab === 'recipes'">
        <div class="craft-col-label">Discovered Recipes</div>
        <div v-if="!discoveredRecipes.length" class="empty-state"><p>No recipes discovered yet.<br />Experiment in the kitchen!</p></div>
        <div v-else class="cooking-recipe-card" v-for="r in discoveredRecipes" :key="r.id">
          <div class="recipe-icon">{{ r.emoji }}</div>
          <div class="recipe-info">
            <div class="recipe-name">{{ r.name }}</div>
            <div class="recipe-ingredients">{{ ingredientListText(r) }}</div>
            <div class="recipe-effect">{{ r.effect }}</div>
            <div v-if="r.description" class="recipe-desc">{{ r.description }}</div>
          </div>
          <button class="btn btn-primary btn-sm" :disabled="!canCraft(r)" :title="canCraft(r) ? '' : 'Not enough ingredients'" @click="quickCraft(r)">Cook</button>
        </div>
      </div>

      <!-- INGREDIENTS -->
      <div v-else>
        <div class="craft-col-label">All Ingredients</div>
        <p class="ingredients-hint mb-px14">Ingredients drop from battles, fishing, and expeditions. Staples can be bought below.</p>
        <div v-for="cat in INGREDIENT_SOURCE_CATEGORIES" :key="cat.label" class="ingredient-source-category">
          <div class="ingredient-source-label mb-px6">{{ cat.label }}</div>
          <div v-for="id in cat.ids" :key="id" class="cooking-all-ing-row">
            <span class="all-ing-emoji">{{ COOKING_INGREDIENTS[id].emoji }}</span>
            <span class="all-ing-name">{{ COOKING_INGREDIENTS[id].name }}</span>
            <span v-if="stapleFor(id)" class="all-ing-price">🪙 {{ stapleFor(id).price }} PP</span>
            <span v-else class="all-ing-source">{{ COOKING_INGREDIENTS[id].source }}</span>
            <span class="all-ing-qty" :class="{ owned: (ingredients[id] || 0) > 0 }">{{ ingredients[id] || 0 }}</span>
            <button
              v-if="stapleFor(id)"
              class="btn btn-primary btn-sm"
              :disabled="points < stapleFor(id).price || buyingStapleId === id"
              @click="buyStaple(id)"
            >Buy</button>
          </div>
        </div>
      </div>
    </template>

    <div v-if="discoveryRecipe" class="cooking-discovery-overlay">
      <div class="cooking-discovery-box">
        <div class="discovery-emoji">{{ discoveryRecipe.emoji }}</div>
        <div class="discovery-title">New Recipe Discovered!</div>
        <div class="discovery-name">{{ discoveryRecipe.name }}</div>
        <div class="discovery-effect">{{ discoveryRecipe.effect }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { AppState } from '../AppState.js'
import { playerService } from '../services/PlayerService.js'
import { shopService } from '../services/ShopService.js'
import { cookingService } from '../services/CookingService.js'
import { toastService } from '../services/ToastService.js'
import { COOKING_INGREDIENTS, COOKING_RECIPES, INGREDIENT_SOURCE_CATEGORIES } from '../data/cookingData.js'

const ingredientIds = Object.keys(COOKING_INGREDIENTS)

const loading = ref(true)
const TABS = [
  { key: 'craft', label: '🍳 Cook' },
  { key: 'recipes', label: '📖 Recipe Book' },
  { key: 'ingredients', label: '🧺 Ingredients' }
]

const activeTab = ref('craft')
const ingredients = ref({})
const discovered = ref({})
const staples = ref([])
const slots = ref([null, null, null, null])
const multiCount = ref(1)
const cooking = ref(false)
const buyingStapleId = ref('')
const discoveryRecipe = ref(null)

const points = computed(() => AppState.player ? AppState.player.pawketpoints : 0)
const filled = computed(() => slots.value.filter(s => s !== null))
const match = computed(() => cookingService.matchRecipe(filled.value))
const hint = computed(() => {
  if (!filled.value.length) return ''
  if (match.value) return discovered.value[match.value.id] ? match.value.emoji + ' ' + match.value.name : '? Unknown recipe...'
  return filled.value.length >= 2 ? 'No recipe found with these ingredients.' : 'Add more ingredients...'
})
const discoveredRecipes = computed(() => COOKING_RECIPES.filter(r => discovered.value[r.id]))

function stapleFor(ingredientId) {
  return staples.value.find(s => s.name.toLowerCase() === COOKING_INGREDIENTS[ingredientId].name.toLowerCase())
}

function ingredientListText(recipe) {
  return recipe.ingredients.map(id => COOKING_INGREDIENTS[id].emoji + ' ' + COOKING_INGREDIENTS[id].name).join(' + ')
}

function canCraft(recipe) {
  return recipe.ingredients.every(id => {
    const inSlots = slots.value.filter(s => s === id).length
    return (ingredients.value[id] || 0) > inSlots
  })
}

function addToSlot(id) {
  const qty = ingredients.value[id] || 0
  const inSlots = slots.value.filter(s => s === id).length
  if (qty <= inSlots) { toastService.warning('Not enough ' + COOKING_INGREDIENTS[id].name + '!'); return }
  const freeIdx = slots.value.indexOf(null)
  if (freeIdx === -1) { toastService.warning('All slots are full! Click a slot to remove an ingredient.'); return }
  slots.value[freeIdx] = id
}

function removeSlot(idx) {
  slots.value[idx] = null
}

function quickCraft(recipe) {
  slots.value = [null, null, null, null]
  recipe.ingredients.slice(0, 4).forEach((id, i) => { slots.value[i] = id })
  activeTab.value = 'craft'
}

function showDiscovery(recipe) {
  discoveryRecipe.value = recipe
  setTimeout(() => {
    discoveryRecipe.value = null
    toastService.success(recipe.emoji + ' ' + recipe.name + ' discovered! Check your Recipe Book.')
  }, 2300)
}

async function cook() {
  if (!filled.value.length || cooking.value) return
  let count = multiCount.value
  if (!count || count < 1) count = 1
  if (count > 20) count = 20
  multiCount.value = count

  cooking.value = true
  try {
    const result = await cookingService.cook(AppState.user.id, filled.value, count, ingredients.value, discovered.value)
    if (result.recipe.isPiperRecipe) {
      setTimeout(() => toastService.info('Something is watching you eat.'), 1200)
    }
    if (result.isNewDiscovery) {
      showDiscovery(result.recipe)
    } else {
      toastService.success(result.recipe.emoji + ' Cooked ' + (count > 1 ? count + 'x ' : '') + result.recipe.name + '! Added to inventory.')
    }
    slots.value = [null, null, null, null]
  } catch (err) {
    toastService.error(err.message)
  } finally {
    cooking.value = false
  }
}

async function buyStaple(ingredientId) {
  const staple = stapleFor(ingredientId)
  if (!staple) return
  buyingStapleId.value = ingredientId
  try {
    const result = await shopService.buyStaple(staple, 1)
    ingredients.value[result.ingredientId] = result.newQty
    toastService.success('Bought 1x ' + staple.name + '!')
  } catch (err) {
    toastService.error(err.message)
  } finally {
    buyingStapleId.value = ''
  }
}

onMounted(async () => {
  await playerService.getPlayer(AppState.user.id)
  ;[ingredients.value, discovered.value, staples.value] = await Promise.all([
    cookingService.loadIngredients(AppState.user.id),
    cookingService.loadDiscoveredRecipes(AppState.user.id),
    shopService.getIngredientStaples()
  ])
  loading.value = false
})
</script>

<style lang="scss" scoped>
// Layout comes from Bootstrap utilities in the template; the underline that
// defines this tab strip visually stays here.
.cooking-subtabs {
  border-bottom: 2px solid var(--border);
}

.craft-col-label {
  font-weight: 700;
  font-size: 0.88rem;
  color: var(--purple-dark);
  margin-bottom: 10px;
}

// The ingredient tray keeps a real CSS grid: it's an auto-fill track sized by
// content width (80px minimum), which Bootstrap's fixed 12-column row/col
// system can't express. The two-column slot grid and the outer split DID map
// cleanly and are now `row`/`col-*` in the template.
.cooking-ingredient-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
}

.cook-slot-emoji {
  font-size: 1.5rem;
}

.cooking-recipe-hint {
  font-size: 0.75rem;
  color: var(--text-light);
  min-height: 18px;
}

.cook-btn {
  width: 100%;
  font-size: 1rem;

  &.recipe-ready {
    animation: cooking-page-pulse 1.2s ease-in-out infinite;
    box-shadow: 0 0 18px rgba(153, 102, 255, 0.55);
  }
}

@keyframes cooking-page-pulse {
  0%, 100% { box-shadow: 0 0 10px rgba(153, 102, 255, 0.35); }
  50% { box-shadow: 0 0 24px rgba(153, 102, 255, 0.75); }
}

.multi-count-row {
  font-size: 0.78rem;
  color: var(--text-light);

  input {
    width: 54px;
    border: 2px solid var(--border);
    font-size: 0.85rem;
    text-align: center;
  }
}

.recipe-desc {
  font-size: 0.72rem;
  color: var(--text-light);
  margin-top: 3px;
  font-style: italic;
}

.ingredients-hint {
  font-size: 0.8rem;
  color: var(--text-light);
}

.ingredient-source-category {
  margin-bottom: 18px;
}

.ingredient-source-label {
  font-weight: 700;
  font-size: 0.82rem;
  color: var(--purple-dark);
}

.cooking-all-ing-row {
  gap: 10px;

  .all-ing-emoji {
    font-size: 1.3rem;
  }

  .all-ing-name {
    flex: 1;
    font-weight: 600;
    color: var(--purple-dark);
  }

  .all-ing-source,
  .all-ing-price {
    font-size: 0.75rem;
    color: var(--text-light);
  }

  .all-ing-qty {
    font-weight: 700;
    color: var(--text-light);
    min-width: 30px;
    text-align: right;

    &.owned {
      color: var(--purple);
    }
  }
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-light);
  font-style: italic;
}
</style>

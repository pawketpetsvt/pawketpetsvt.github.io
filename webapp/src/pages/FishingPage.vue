<template>
  <div class="page-wrap">
    <div class="page-hero">
      <div class="sparkle-row">🎣 ✨ 🎣</div>
      <h1>Fishing</h1>
      <p>Cast your line, collect fish, upgrade your rod, and discover what lurks in the deep. 🌊</p>
    </div>

    <div v-if="loading" class="spinner"></div>

    <div v-else class="fishing-page-inner">
      <div v-if="shoalState.active" class="shoal-banner">
        🐠 Rare Shoal! (+50% rare chance for {{ shoalState.castsLeft }} more cast{{ shoalState.castsLeft === 1 ? '' : 's' }})
      </div>

      <FishingQuestCards :key="questCardsKey" />

      <div class="game-card fishing-card">
        <div class="game-title">🎣 Fishing</div>
        <div class="game-desc">Cast your line at different spots. Catch rare fish, build your collection, and upgrade your rod!</div>

        <div class="game-area fishing-game-area">
          <div v-if="onCooldown" class="cooldown-msg">Already fished today! Come back tomorrow. 🎣</div>

          <template v-else>
            <div class="shop-row">
              <RodShop :rod-level="rodLevel" @upgraded="onRodUpgraded" />
              <AutoFisherWidget :level="autoFisherLevel" @purchased="onAutoFisherPurchased" />
              <div class="session-stats">
                <div class="session-stats-title">📊 Today's Session</div>
                <div>Casts left: <strong>{{ castsLeft }}</strong></div>
                <div>Earned: <strong>{{ sessionTotal }}</strong> PP</div>
                <div class="session-stats-sub">Total: {{ collected }}/{{ totalFish }} found</div>
              </div>
            </div>

            <div class="selector-section">
              <div class="selector-label">📍 Choose Fishing Spot</div>
              <div class="spot-grid">
                <button v-for="(data, key) in FISH_SPOTS" :key="key" class="fishing-spot-btn" :class="{ active: spot === key }" :title="data.description" @click="selectSpot(key)">
                  {{ data.name.split(' ')[0] }}<br /><span>{{ data.name.split(' ')[1] }}</span><br /><span class="spot-tier">{{ SPOT_TIERS[key] }}</span>
                </button>
              </div>
            </div>

            <div class="selector-section">
              <div class="selector-label">🪱 Choose Bait</div>
              <div class="spot-grid">
                <button v-for="(data, key) in FISH_BAIT" :key="key" class="fishing-bait-btn" :class="{ active: bait === key }" :title="data.description" @click="bait = key">
                  {{ data.name.split(' ')[0] }}<br /><span>{{ data.name.split(' ').slice(1).join(' ') }}</span><br />
                  <span class="bait-price" :class="{ free: data.cost === 0 }">{{ data.cost === 0 ? 'Free' : data.cost + ' PP' }}</span>
                </button>
              </div>
            </div>

            <FishingPond ref="pondRef" :disabled="castsLeft <= 0" @caught="handleCaught" />

            <div class="game-result fishing-result" :style="{ color: resultColor }" v-html="resultHtml"></div>
          </template>
        </div>

        <FishJournal :collection="collection" @cook-feed="handleCookFeed" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { AppState } from '../AppState.js'
import { fishingService, shoalState } from '../services/FishingService.js'
import { cookingService } from '../services/CookingService.js'
import { ownedPetsService } from '../services/OwnedPetsService.js'
import { playerService } from '../services/PlayerService.js'
import { minigamesService } from '../services/MinigamesService.js'
import { toastService } from '../services/ToastService.js'
import { FISH_SPOTS, FISH_BAIT, FISH_POOL, RARITY_COLORS, FISH_HUNGER_BY_RARITY, formatWeight } from '../data/fishingData.js'
import RodShop from '../components/fishing/RodShop.vue'
import AutoFisherWidget from '../components/fishing/AutoFisherWidget.vue'
import FishJournal from '../components/fishing/FishJournal.vue'
import FishingQuestCards from '../components/fishing/FishingQuestCards.vue'
import FishingPond from '../components/fishing/FishingPond.vue'

const SPOT_TIERS = { pond: 'Common', river: 'Uncommon', lake: 'Rare', ocean: 'Legendary' }

const NON_JUNK_FISH = FISH_POOL.filter(f => f.rarity !== 'junk')
const totalFish = NON_JUNK_FISH.length

const loading = ref(true)
const onCooldown = ref(false)
const spot = ref('pond')
const bait = ref('worm')
const rodLevel = ref(1)
const autoFisherLevel = ref(0)
const autoFisherLastCatch = ref(null)
const castsLeft = ref(0)
const sessionTotal = ref(0)
const collection = ref({})
const ingredients = ref({})
const questCardsKey = ref(0)
const resultHtml = ref('')
const resultColor = ref('')
const pondRef = ref(null)

const collected = computed(() => Object.keys(collection.value).filter(id => NON_JUNK_FISH.some(f => f.id === id)).length)

function selectSpot(key) {
  spot.value = key
  castsLeft.value = fishingService.getRodCasts(spot.value, rodLevel.value)
}

function onRodUpgraded(newLevel) {
  rodLevel.value = newLevel
  castsLeft.value = fishingService.getRodCasts(spot.value, rodLevel.value)
}

function onAutoFisherPurchased(newLevel) {
  autoFisherLevel.value = newLevel
}

async function handleCaught(power) {
  const userId = AppState.user.id
  const result = await fishingService.castLine({
    userId, spot: spot.value, bait: bait.value, rodLevel: rodLevel.value, power,
    collectionMap: collection.value, ingredientsMap: ingredients.value
  })
  if (result.usedBait !== bait.value) bait.value = result.usedBait
  castsLeft.value--
  sessionTotal.value += result.fish.pp

  renderCatchResult(result)

  const questResult = await fishingService.recordQuestCatch(userId, result.fish.id)
  if (questResult.caughtTarget) toastService.success('🎣 Melon\'s quest: caught ' + questResult.caughtTarget.name + ' ' + questResult.caughtTarget.emoji + '!')
  if (questResult.questJustFinished) toastService.success('🐟 Melon\'s Weekly Quest complete! +300 PP! Thanks for the fish!')

  const dailyResult = await fishingService.recordDailyCatch(userId, result.fish, result.weightG)
  if (dailyResult.justCompleted) toastService.success('🎣 Daily challenge complete: ' + dailyResult.challenge.label + '! +' + dailyResult.challenge.reward + ' PP')
  questCardsKey.value++

  if (result.fish.id === 'piper_fish') {
    setTimeout(() => toastService.warning("...you caught something that shouldn't be here. It looked at you."), 2000)
  }
  if (result.fish.id === 'junk_ad') {
    setTimeout(() => toastService.info('📢 You caught: Sponsored Content. It was not worth it.'), 500)
  }

  if (castsLeft.value <= 0) {
    await fishingService.awardSessionTotal(sessionTotal.value)
    onCooldown.value = true
    const bonusAwarded = await fishingService.checkCollectionBonus(collected.value, totalFish)
    if (bonusAwarded) toastService.success('🏆 Complete collection! +200 PP bonus!')
    setTimeout(() => {
      resultHtml.value = 'All casts used! +' + sessionTotal.value + ' PP total! (' + collected.value + '/' + totalFish + ' fish)'
      resultColor.value = '#5dde7a'
    }, 1200)
  }

  pondRef.value && pondRef.value.markResolved()
}

function renderCatchResult(result) {
  const { fish, weightG, isNew, isNewRecord } = result
  const weightStr = formatWeight(weightG)
  const weightDisplay = weightStr ? ' (' + weightStr + ')' : ''
  const badge = isNew ? ' ✨ NEW!' : isNewRecord && weightStr ? ' 🏆 RECORD!' : ''
  resultColor.value = RARITY_COLORS[fish.rarity] || '#5dde7a'
  resultHtml.value = fish.emoji + ' <strong>' + fish.name + '</strong>' + weightDisplay + badge + ' (+' + fish.pp + ' PP)'

  if (isNew && (fish.rarity === 'epic' || fish.rarity === 'legendary')) {
    toastService.success('🎣 NEW ' + fish.rarity.toUpperCase() + ' CATCH: ' + fish.name + '! ' + fish.emoji + (weightStr ? ' (' + weightStr + ')' : ''))
  } else if (isNewRecord && weightStr) {
    toastService.success('🏆 Personal best: ' + fish.name + ' ' + weightStr + '!')
  }
}

async function handleCookFeed(fish) {
  if (!AppState.ownedPets.length) { toastService.error('No pet to feed!'); return }
  const pet = AppState.ownedPets[0]
  const hunger = FISH_HUNGER_BY_RARITY[fish.rarity] || 8
  await fishingService.cookFeed(AppState.user.id, fish, hunger, pet, collection.value)
  toastService.success('🍳 Cooked ' + fish.name + ' for your pet! +' + hunger + ' hunger.')
}

onMounted(async () => {
  const userId = AppState.user.id
  onCooldown.value = await minigamesService.isOnCooldown('fishing')

  const [, loadedRodLevel, loadedCollection, autoFisherState, loadedIngredients] = await Promise.all([
    playerService.getPlayer(userId),
    fishingService.loadRodLevel(userId),
    fishingService.loadCollection(userId),
    fishingService.loadAutoFisherState(userId),
    cookingService.loadIngredients(userId),
    AppState.ownedPets.length ? Promise.resolve() : ownedPetsService.getMyPets(userId)
  ])
  rodLevel.value = loadedRodLevel
  collection.value = loadedCollection
  autoFisherLevel.value = autoFisherState.level
  autoFisherLastCatch.value = autoFisherState.lastCatch
  ingredients.value = loadedIngredients

  await fishingService.checkOfflineProgress(userId, autoFisherLevel.value, autoFisherLastCatch.value, spot.value, bait.value, rodLevel.value)

  fishingService.checkShoal()
  castsLeft.value = fishingService.getRodCasts(spot.value, rodLevel.value)
  loading.value = false
})
</script>

<style lang="scss" scoped>
.fishing-page-inner {
  max-width: 720px;
  margin: 0 auto;
}

.fishing-card {
  grid-column: 1 / -1;
}

.fishing-game-area {
  max-width: 680px;
  margin: 0 auto;
}

.shoal-banner {
  background: linear-gradient(135deg, rgba(77, 171, 247, 0.15), rgba(93, 222, 122, 0.12));
  border: 1px solid rgba(77, 171, 247, 0.4);
  border-radius: 12px;
  padding: 8px 14px;
  margin-bottom: 10px;
  font-weight: 700;
  font-size: 0.82rem;
  color: #2980b9;
  text-align: center;
}

.shop-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
  align-items: start;
}

.session-stats {
  background: rgba(77, 171, 247, 0.08);
  border: 1px solid rgba(77, 171, 247, 0.2);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 0.78rem;
}

.session-stats-title {
  font-weight: 700;
  color: var(--purple-dark);
  margin-bottom: 4px;
}

.session-stats-sub {
  margin-top: 4px;
  color: var(--text-light);
}

.selector-section {
  margin-bottom: 12px;
}

.selector-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--purple-dark);
  margin-bottom: 6px;
}

.spot-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;

  span {
    font-size: 0.6rem;
    opacity: 0.7;
  }
}

.spot-tier {
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.bait-price {
  color: #ffd43b;

  &.free {
    color: #5dde7a;
  }
}

.fishing-result {
  margin-top: 8px;
  text-align: center;
}
</style>

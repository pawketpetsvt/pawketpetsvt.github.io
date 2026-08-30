// Icon/category helpers shared by Shop and Inventory item cards.
// Ports itemEmoji/FOOD_CATEGORY_IMAGES/FOOD_CATEGORY_FALLBACK/foodCategoryData/
// getFoodRotation/isFoodFeatured/getFoodCategoryLabel/getCurrentRotationWeek,
// game.js:6870-6967.

const ITEM_TYPE_EMOJI = {
  food: '🍖',
  toy: '🧸',
  potion: '⚡',
  special: '✨',
  drink: '🥤',
  pillow: '🛏️',
  snack: '🍪'
}

export function itemTypeEmoji(type) {
  return ITEM_TYPE_EMOJI[type] || '🎁'
}

export const FOOD_CATEGORY_IMAGES = {
  spicy: '/images/icons/food/spicy.png',
  sweet: '/images/icons/food/sweet.png',
  savory: '/images/icons/food/savory.png',
  fish: '/images/icons/food/fish.png',
  fruit: '/images/icons/food/fruit.png',
  basic: '/images/icons/food/basic.png'
}

export const FOOD_CATEGORY_FALLBACK_EMOJI = {
  spicy: '🌶️',
  sweet: '🍰',
  savory: '🍖',
  fish: '🐟',
  fruit: '🍎',
  basic: '🍞'
}

const FOOD_CATEGORY_DATA = {
  spicy: { name: 'Spicy', icon: '🌶️' },
  sweet: { name: 'Sweet', icon: '🍰' },
  savory: { name: 'Savory', icon: '🍖' },
  fish: { name: 'Fish', icon: '🐟' },
  fruit: { name: 'Fruit', icon: '🍎' },
  basic: { name: 'Basic', icon: '🍞' }
}

// 3-week rotation (like equipment), game.js:6936-6947.
const FOOD_ROTATIONS = [
  ['spicy', 'savory'],
  ['sweet', 'fruit'],
  ['fish', 'basic']
]

function weekInCycle() {
  const weeksSinceEpoch = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))
  return weeksSinceEpoch % 3
}

export function isFoodFeatured(foodCategory) {
  if (!foodCategory) return false
  return FOOD_ROTATIONS[weekInCycle()].includes(foodCategory)
}

export function getFoodCategoryLabel(category) {
  const data = FOOD_CATEGORY_DATA[category]
  return data ? data.icon + ' ' + data.name : ''
}

<template>
  <img v-if="src" :src="src" class="item-icon-img" :alt="item.name" @error="errored = true" />
  <span v-else>{{ emoji }}</span>
</template>

<script setup>
import { ref, computed } from 'vue'
import { itemTypeEmoji, FOOD_CATEGORY_IMAGES, FOOD_CATEGORY_FALLBACK_EMOJI } from '../utils/itemIcons.js'

const props = defineProps({
  item: { type: Object, required: true }
})

const errored = ref(false)

// Priority: item.image_url -> food category image -> type emoji fallback,
// mirrors getItemIconHtml, game.js:6903-6920.
const src = computed(() => {
  if (errored.value) return null
  if (props.item.imageUrl) return props.item.imageUrl
  if (props.item.foodCategory && FOOD_CATEGORY_IMAGES[props.item.foodCategory]) return FOOD_CATEGORY_IMAGES[props.item.foodCategory]
  return null
})

const emoji = computed(() => {
  if (props.item.foodCategory && FOOD_CATEGORY_FALLBACK_EMOJI[props.item.foodCategory]) return FOOD_CATEGORY_FALLBACK_EMOJI[props.item.foodCategory]
  return itemTypeEmoji(props.item.itemType)
})
</script>

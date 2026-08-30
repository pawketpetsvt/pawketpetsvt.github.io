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

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.item-icon-img {
  width: 48px;
  height: 48px;
  object-fit: contain;
  image-rendering: crisp-edges;
  image-rendering: pixelated;
  filter: drop-shadow(1px 2px 3px rgba(0,0,0,0.12));
  transition: transform 0.2s ease;
  display: block;
}
body.night-mode .item-icon-img { filter: drop-shadow(1px 2px 4px rgba(0,0,0,0.35)); }
</style>

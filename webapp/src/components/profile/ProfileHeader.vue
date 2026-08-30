<template>
  <!-- Not a `container`: this is a banner inside an already-contained page, and
       `.pf-banner`'s own `padding: 24px` outranks a container's inset anyway, so
       the class was contributing nothing but width:100% and auto margins that a
       block-level div already has. -->
  <div class="pf-banner d-flex gap-gap p-4" :style="{ background: backgroundGradient }">
    <div class="row w-100">
      <div class="col-6 d-flex">
        <div class="pf-avatar flex-shrink-0 rounded-circle d-flex align-items-center justify-content-center" :class="frameClass">{{ profile.initial }}</div>
        <div class="ps-3 d-flex flex-column align-items-start min-w-0">
          <div class="pf-username">{{ profile.username }}</div>
          <div v-if="profile.title" class="pf-title mt-1" :style="{ color: profile.title.resolvedColor }">
            {{ profile.title.icon }} {{ profile.title.display_name }}
          </div>
          <div v-if="pips.length" class="d-flex gap-px6 mt-px6">
            <span v-for="pip in pips" :key="pip.id" class="pf-pip" :title="pip.name"
              :style="{ filter: 'drop-shadow(0 0 4px ' + pip.color + ')' }">{{ pip.emoji }}</span>
          </div>
          <div class="pf-joined mt-px6">{{ profile.joinedText }}</div>
        </div>
      </div>
      <div class="col-6 d-flex flex-column justify-content-between align-items-end">
        <div>
          <router-link class="pf-room-btn" :to="own ? '/housing' : `/room/${encodeURIComponent(profile.username)}`"
            :title="own ? 'Decorate your room' : `Visit ${profile.username}'s room`">
            {{ own ? '🏠 My Room' : '🏠 Room' }}
          </router-link>
        </div>
        <div>
          <router-link class="pf-room-btn" :to="'/profile/' + encodeURIComponent(profile.username)"
            title="View My Public Profile">
            👁️ View My Public Profile
          </router-link>
        </div>
      </div>
    </div>
  </div>

  <div class="pf-bio mt-px14 py-px14 px-3 rounded-3">{{ profile.bio || 'No bio yet' }}</div>
</template>

<script setup>
import { computed } from 'vue'
import { COSMETICS_CATALOG } from '../../data/cosmeticsData.js'

const props = defineProps({
  profile: { type: Object, required: true },
  // True on MyProfile — the Room button then edits rather than visits.
  own: { type: Boolean, default: false }
})

const backgroundGradient = computed(() => {
  const bg = COSMETICS_CATALOG.backgrounds.find(b => b.id === props.profile.equipped.background)
  return bg ? bg.gradient : COSMETICS_CATALOG.backgrounds[0].gradient
})

const frameClass = computed(() => {
  const frame = COSMETICS_CATALOG.frames.find(f => f.id === props.profile.equipped.frame)
  return frame ? frame.cssClass : ''
})

const pips = computed(() =>
  props.profile.equipped.badges
    .map(id => COSMETICS_CATALOG.badges.find(b => b.id === id))
    .filter(Boolean)
)
</script>

<style lang="scss" scoped>
// Deliberately NOT named `.pf-header`: the global stylesheet has
// `[class*="header"] { justify-content: space-between !important }` plus
// `[class*="header"] > * { display: inline-flex !important }` (style.css:
// 11827-11850), which any class containing the substring "header" inherits.
// That pushed the avatar and identity block to opposite edges and flattened
// the identity's stacked children onto one horizontal line. Renaming off the
// substring is the fix — the same sidestep used for `.notif-panel`/`.lb-list`.
.pf-banner {
  border-radius: 16px;
  color: #fff;
}

// Top-right of the banner: `margin-left: auto` claims the leftover space and
// `align-self: flex-start` lifts it out of the banner's vertical centring.
//
// The button carries its OWN dark scrim rather than tinting whatever is behind
// it, because the banner background is a player-chosen cosmetic and the catalog
// spans the full range — `#000428` (Starry Night) through `#fefae0` (Cozy Café)
// and `#ffd200` (Legendary). Neither a translucent-white fill nor a translucent
// -dark one is legible across both ends, so nothing that depends on the
// backdrop can work here. An opaque-enough dark pill with white text does, and
// the light border keeps it from disappearing into the dark backgrounds.
//
// `!important` on the colors is load-bearing: legacy style.css:61 sets
// `a { color: var(--purple-dark) !important }` and :62 the same for `a:hover`,
// and an `!important` element selector beats a plain scoped class. That global
// rule is also why this read as unreadable dark purple rather than white.
.pf-room-btn {
  padding: 6px 12px;
  border: 2px solid rgba(255, 255, 255, 0.75);
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.45);
  color: #fff !important;
  font-size: 0.8rem;
  font-weight: 700;
  text-decoration: none !important;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
  transition: background 0.15s, border-color 0.15s;

  &:hover {
    background: rgba(0, 0, 0, 0.62);
    border-color: #fff;
    color: #fff !important;
  }

  &:focus-visible {
    outline: 3px solid #fff;
    outline-offset: 2px;
  }
}

.pf-avatar {
  width: 84px;
  height: 84px;
  background: rgba(0, 0, 0, 0.25);
  font-size: 2.2rem;
  font-weight: 700;
  border-width: 4px;
  border-style: solid;
  border-color: rgba(255, 255, 255, 0.6);
}

.pf-username {
  font-size: 1.6rem;
  font-weight: 700;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.pf-title {
  font-size: 1.05rem;
  font-weight: 600;
  filter: brightness(1.4);
}

.pf-pip {
  font-size: 1.15rem;
}

.pf-joined {
  font-size: 0.82rem;
  opacity: 0.85;
}

.pf-bio {
  border: 1px solid var(--border);
  font-size: 0.9rem;
  color: var(--text);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>

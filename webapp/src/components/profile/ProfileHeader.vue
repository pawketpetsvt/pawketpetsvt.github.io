<template>
  <div class="pf-banner" :style="{ background: backgroundGradient }">
    <div class="pf-avatar" :class="frameClass">{{ profile.initial }}</div>
    <div class="pf-identity">
      <div class="pf-username">{{ profile.username }}</div>
      <div v-if="profile.title" class="pf-title" :style="{ color: profile.title.resolvedColor }">
        {{ profile.title.icon }} {{ profile.title.display_name }}
      </div>
      <div v-if="pips.length" class="pf-pips">
        <span
          v-for="pip in pips"
          :key="pip.id"
          class="pf-pip"
          :title="pip.name"
          :style="{ filter: 'drop-shadow(0 0 4px ' + pip.color + ')' }"
        >{{ pip.emoji }}</span>
      </div>
      <div class="pf-joined">{{ profile.joinedText }}</div>
    </div>

    <!-- On your own profile this is the way in to editing your room; on anyone
         else's it opens their read-only view.
         Not a port on the public side: legacy exposed room-visiting ONLY from
         the Friends tab's friend cards, so a profile reached any other way —
         search, leaderboard, a notification — had no route into it. -->
    <router-link class="pf-room-btn" :to="own ? '/housing' : `/room/${encodeURIComponent(profile.username)}`"
      :title="own ? 'Decorate your room' : `Visit ${profile.username}'s room`">
      {{ own ? '🏠 My Room' : '🏠 Room' }}
    </router-link>
  </div>

  <div class="pf-bio">{{ profile.bio || 'No bio yet' }}</div>
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
// Deliberately NOT named `.pf-header`: the global style.css has
// `[class*="header"] { justify-content: space-between !important }` plus
// `[class*="header"] > * { display: inline-flex !important }` (style.css:
// 11827-11850), which any class containing the substring "header" inherits.
// That pushed the avatar and identity block to opposite edges and flattened
// the identity's stacked children onto one horizontal line. Renaming off the
// substring is the fix — the same sidestep used for `.notif-panel`/`.lb-list`.
.pf-banner {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 20px;
  padding: 24px;
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
// `!important` on the colors is load-bearing: style.css:61 sets
// `a { color: var(--purple-dark) !important }` and :62 the same for `a:hover`,
// and an `!important` element selector beats a plain scoped class. That global
// rule is also why this read as unreadable dark purple rather than white.
.pf-room-btn {
  align-self: flex-start;
  margin-left: auto;
  flex-shrink: 0;
  padding: 6px 12px;
  border: 2px solid rgba(255, 255, 255, 0.75);
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.45);
  color: #fff !important;
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
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
  flex-shrink: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.2rem;
  font-weight: 700;
  border-width: 4px;
  border-style: solid;
  border-color: rgba(255, 255, 255, 0.6);
}

.pf-identity {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}

.pf-username {
  font-size: 1.6rem;
  font-weight: 700;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.pf-title {
  font-size: 1.05rem;
  font-weight: 600;
  margin-top: 4px;
  filter: brightness(1.4);
}

.pf-pips {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.pf-pip {
  font-size: 1.15rem;
}

.pf-joined {
  font-size: 0.82rem;
  opacity: 0.85;
  margin-top: 6px;
}

.pf-bio {
  margin-top: 14px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  font-size: 0.9rem;
  color: var(--text);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>

<template>
  <!-- Twitch's "Glitch" mark: the purple speech bubble with a white face and
       purple eyes. The white fill is drawn as its own shape under the outline so
       the logo stays legible on the purple Twitch buttons, where an
       outline-only purple glyph would vanish into the background. Sized in `em`
       so it scales with whatever text it sits beside, like the emoji it
       replaced. -->
  <svg class="twitch-logo" viewBox="0 0 24 24" role="img" aria-label="Twitch" xmlns="http://www.w3.org/2000/svg">
    <polygon fill="#ffffff"
      points="20.571,11.143 17.143,14.571 13.714,14.571 10.714,17.571 10.714,14.571 6.857,14.571 6.857,1.714 20.571,1.714" />
    <path fill="#9146ff"
      d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
  </svg>
</template>

<style lang="scss" scoped>
.twitch-logo {
  display: inline-block;
  width: 1.1em;
  height: 1.1em;
  vertical-align: -0.18em;
  flex-shrink: 0;
}
</style>

<template>
  <footer id="site-footer" class="site-footer text-center mt-auto px-gap py-2">
    <div class="site-footer-inner d-flex flex-wrap justify-content-center align-items-center mx-auto row-gap-2 column-gap-gap">
      <span>
        © 2024–2026 PawketPetsVT &nbsp;·&nbsp; Made with 💜 by
        <a class="site-footer-link underlined" href="https://twitch.tv/Embertail" target="_blank" rel="noopener">Embertail</a>
      </span>
      <span class="site-footer-sep">|</span>
      <router-link class="site-footer-link" to="/privacy">Privacy Policy</router-link>
      <span class="site-footer-sep">|</span>
      <a class="site-footer-link" href="https://discord.gg/9TbRZkSJpU" target="_blank" rel="noopener">Discord</a>
      <span class="site-footer-sep">|</span>
      <a class="site-footer-link" href="https://tally.so/r/0Q0ADQ" target="_blank" rel="noopener">Give Feedback</a>
      <span class="site-footer-sep">|</span>
      <span class="site-footer-beta">⚠️ Beta — data may reset before full launch</span>
    </div>
  </footer>
</template>

<style lang="scss" scoped>
// Layout comes from Bootstrap utilities in the template; only the things
// utilities can't express (the site's own colors, the border tint, the
// content cap) live here.
.site-footer {
  border-top: 1px solid rgba(153, 102, 255, 0.15);
  font-size: 0.78rem;
  color: var(--text-light);
  background: rgba(10, 5, 20, 0.5);
}

.site-footer-inner {
  max-width: 900px;
}

.site-footer-link {
  color: var(--text-light);
  text-decoration: none;

  &.underlined {
    text-decoration: underline;
  }
}

.site-footer-sep {
  opacity: 0.4;
}

.site-footer-beta {
  color: rgba(255, 160, 80, 0.7);
}
</style>

<template>
  <!-- Ports the "About PawketPetsVT" block that closes the Home page. -->
  <div class="section-header">
    <h2>About PawketPetsVT</h2>
    <div class="section-line"></div>
  </div>
  <div class="card ap-card">
    <p>
      <strong class="ap-em">PawketPetsVT</strong> is a fan-interactive pet game inspired by the pet games of the
      early 2000s. Collect, raise, and care for little virtual versions of your favourite streamers.
    </p>
    <p>
      Earn <strong class="ap-em">PawketPoints</strong> by playing minigames, chatting in streams, and interacting
      with your pets!
    </p>
  </div>
</template>

<style lang="scss" scoped>
// Legacy set the card's line-height/colour and both <strong> colours inline,
// and separated the paragraphs with a bare <br> rather than paragraph spacing.
.ap-card {
  line-height: 1.8;
  color: var(--text-light);

  p { margin: 0; }
  p + p { margin-top: 1.2em; }
}

.ap-em {
  color: var(--purple-dark);
}
</style>

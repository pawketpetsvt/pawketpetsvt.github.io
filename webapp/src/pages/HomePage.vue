<template>
  <div class="page-wrap">
    <!-- Welcome panel. Legacy injected the two CTA buttons into an empty
         `#home-cta` div from showApp(); they are static there (no branch on
         whether you own pets), so they are just markup here. -->
    <div class="welcome-panel hp-welcome">
      <div class="hp-title-row">
        <img src="/images/logo.png" alt="PawketPetsVT" class="logo-hero hp-logo" />
        <h1 class="hp-title">Welcome to PawketPetsVT!</h1>
      </div>
      <p class="hp-tagline">
        Adopt virtual pets based on your favourite VTubers, play games, and earn rewards ✨
      </p>
      <div class="hp-cta">
        <router-link class="btn btn-primary btn-lg hp-cta-btn" to="/mypets">My Pets</router-link>
        <router-link class="btn btn-secondary btn-lg hp-cta-btn" to="/adopt">Adopt More</router-link>
      </div>
    </div>

    <!-- Legacy order below is preserved. Two blocks are deliberately absent:
         `#archive-home-widget` (the ARG log archive — that system is not
         migrated, and the widget is `display:none` until a log is found), and
         `#gift-inbox-bar`, which legacy hard-disables with
         `display:none!important` so it never renders on the live site either. -->

    <TodayCard class="hp-block" />

    <EventCalendar class="hp-block" />

    <MelonRequests class="hp-block" />

    <StreakCalendar class="hp-block" />

    <DailyTip class="hp-block" />

    <PollsWidget class="hp-block" />

    <MelonPromo class="hp-block" />

    <ReferralCard class="hp-block" />

    <AboutPawket />
  </div>
</template>

<script setup>
import TodayCard from '../components/home/TodayCard.vue'
import EventCalendar from '../components/home/EventCalendar.vue'
import MelonRequests from '../components/home/MelonRequests.vue'
import StreakCalendar from '../components/home/StreakCalendar.vue'
import DailyTip from '../components/home/DailyTip.vue'
import PollsWidget from '../components/home/PollsWidget.vue'
import MelonPromo from '../components/home/MelonPromo.vue'
import ReferralCard from '../components/home/ReferralCard.vue'
import AboutPawket from '../components/home/AboutPawket.vue'
</script>

<style lang="scss" scoped>
// Legacy built this whole panel from inline styles; `.welcome-panel` itself is
// the only part style.css owns.
.hp-welcome {
  padding: 10px 16px 8px;
  margin-bottom: 8px;
}

.hp-title-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.hp-logo {
  width: 36px;
  height: 36px;
  margin: 0;
}

.hp-title {
  font-size: 1.2rem;
  margin: 0;
}

.hp-tagline {
  font-size: 0.8rem;
  margin: 4px 0 6px;
  color: var(--text-light);
}

.hp-cta {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 6px;
}

// The CTAs are router-links rather than buttons, so they need the anchor
// underline removed — style.css's `.btn` assumes a real <button>.
.hp-cta-btn {
  text-decoration: none;
}

.hp-block {
  margin: 8px 0;
}
</style>

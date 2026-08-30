<template>
  <div class="page-wrap container-fluid position-relative z-1 pb-page">
    <!-- Welcome panel. Legacy injected the two CTA buttons into an empty
         `#home-cta` div from showApp(); they are static there (no branch on
         whether you own pets), so they are just markup here. -->
    <div class="welcome-panel px-3 pt-px10 pb-2 mb-2">
      <div class="d-flex align-items-center justify-content-center gap-px10">
        <img src="/images/logo.png" alt="PawketPetsVT" class="logo-hero hp-logo m-0" />
        <h1 class="hp-title m-0">Welcome to PawketPetsVT!</h1>
      </div>
      <p class="hp-tagline mt-1 mb-px6">
        Adopt virtual pets based on your favourite VTubers, play games, and earn rewards ✨
      </p>
      <div class="d-flex justify-content-center gap-px10 mt-px6">
        <router-link class="btn btn-primary btn-lg hp-cta-btn" to="/mypets">My Pets</router-link>
        <router-link class="btn btn-secondary btn-lg hp-cta-btn" to="/adopt">Adopt More</router-link>
      </div>
    </div>

    <!-- Legacy order below is preserved. The ARG Archive widget leads, exactly
         as it does on the live site, and hides itself until the player has found
         a tester log. `#gift-inbox-bar` is deliberately NOT reproduced: legacy
         hard-disables it, which is precisely why its gift inbox is unreachable —
         that entry point lives on the navbar here instead. -->
    <ArchiveWidget class="my-2" />

    <TodayCard class="my-2" />

    <EventCalendar class="my-2" />

    <MelonRequests class="my-2" />

    <StreakCalendar class="my-2" />

    <DailyTip class="my-2" />

    <!-- Community goals sit with the other community widgets, above Polls,
         matching the order of legacy's Home mounts. -->
    <CommunityGoals class="my-2" />

    <PollsWidget class="my-2" />

    <MelonPromo class="my-2" />

    <ReferralCard class="my-2" />

    <AboutPawket />
  </div>
</template>

<script setup>
import TodayCard from '../components/home/TodayCard.vue'
import EventCalendar from '../components/home/EventCalendar.vue'
import MelonRequests from '../components/home/MelonRequests.vue'
import StreakCalendar from '../components/home/StreakCalendar.vue'
import DailyTip from '../components/home/DailyTip.vue'
import ArchiveWidget from '../components/home/ArchiveWidget.vue'
import CommunityGoals from '../components/home/CommunityGoals.vue'
import PollsWidget from '../components/home/PollsWidget.vue'
import MelonPromo from '../components/home/MelonPromo.vue'
import ReferralCard from '../components/home/ReferralCard.vue'
import AboutPawket from '../components/home/AboutPawket.vue'
</script>

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.welcome-panel {
  background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.85)) !important;
  border: 4px solid var(--border) !important;
  border-radius: var(--radius-xl) !important;
  padding: 50px 40px !important;
  text-align: center !important;
  margin-bottom: 40px !important;
  box-shadow: 0 10px 30px rgba(153,102,255,0.25) !important;
}
.logo-hero {
  width: 120px !important;
  height: 120px !important;
  margin-bottom: 20px !important;
  filter: drop-shadow(0 4px 8px rgba(153,102,255,0.3)) !important;
  animation: float 3s ease-in-out infinite !important;
}
.welcome-panel h1 {
  font-size: 2.5rem !important;
  color: var(--purple-dark) !important;
  margin-bottom: 16px !important;
  text-shadow: 3px 3px 0 var(--pink-light) !important;
}
.welcome-panel p {
  font-size: 1.2rem !important;
  color: var(--text) !important;
  line-height: 1.7 !important;
  max-width: 600px !important;
  margin: 0 auto 24px !important;
}
body.night-mode .welcome-panel {
  background: rgba(42, 36, 64, 0.95) !important;
  border: 3px solid #6644aa !important;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.6) !important;
}

// Legacy built this whole panel from inline styles; `.welcome-panel` itself is
// the only part the global stylesheet owns. Layout and spacing are Bootstrap's now — what
// remains is the logo's fixed size and two type treatments.
.hp-logo {
  width: 36px;
  height: 36px;
}

.hp-title { font-size: 1.2rem; }

.hp-tagline {
  font-size: 0.8rem;
  color: var(--text-light);
}

// The CTAs are router-links rather than buttons, so they need the anchor
// underline removed — the global stylesheet's `.btn` assumes a real <button>.
.hp-cta-btn {
  text-decoration: none;
}
</style>

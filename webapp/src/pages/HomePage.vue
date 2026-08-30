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
// Legacy built this whole panel from inline styles; `.welcome-panel` itself is
// the only part style.css owns. Layout and spacing are Bootstrap's now — what
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
// underline removed — style.css's `.btn` assumes a real <button>.
.hp-cta-btn {
  text-decoration: none;
}
</style>

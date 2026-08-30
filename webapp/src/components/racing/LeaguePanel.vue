<template>
  <!-- Ports racing_renderLeagueTab(). Promotion needs 3+ races AND 12+ points
       in a week; relegation happens on fewer than 2 races OR fewer than 4. -->
  <div>
    <h3 class="mb-tight">🏆 League Standing</h3>

    <div v-if="!racingState.league" class="spinner"></div>

    <template v-else>
      <!-- The 16px radius stays in the scoped block: `rounded-4` emits 14px, and
           rounding a hand-written value to a near utility is how radius drift
           crept in the first time. The label carries the full 16px separation
           (was 6px + a 10px row margin) because a margin utility on a `.row`
           REPLACES its negative gutter compensation rather than adding to it,
           which would have doubled the gap to 20px. -->
      <div class="lp-tier p-gap text-center mb-3" :style="{ borderColor: tierColor }">
        <div class="lp-tier-label mb-3">{{ tierLabel }}</div>
        <div class="row row-cols-2 g-px10">
          <div class="col">
            <div class="lp-tier-stat p-px10 rounded-2 h-100">
              <div class="lp-tier-stat-label">Races This Week</div>
              <div class="lp-tier-stat-value">{{ outlook.races }} / 3+</div>
            </div>
          </div>
          <div class="col">
            <div class="lp-tier-stat p-px10 rounded-2 h-100">
              <div class="lp-tier-stat-label">League Points</div>
              <div class="lp-tier-stat-value">{{ outlook.pts }} / 12+</div>
            </div>
          </div>
        </div>
      </div>

      <div class="lp-status rounded-3 px-3 py-tight mb-3" :class="statusClass">
        <template v-if="outlook.canPromote">
          <div class="lp-status-title">✅ Ready to Promote!</div>
          <div class="lp-status-body">
            Great week! You'll move up to {{ labelOf(outlook.nextTier) }} when the week resets.
          </div>
        </template>
        <template v-else-if="outlook.atRisk">
          <div class="lp-status-title">⚠️ Relegation Risk</div>
          <div class="lp-status-body">
            Race more or earn more points to stay in {{ tierLabel }}. Need 2+ races &amp; 4+ pts.
          </div>
        </template>
        <template v-else>
          <div class="lp-status-title">📊 On Track</div>
          <div class="lp-status-body">
            Keep racing! Need 3 races &amp; 12 pts to promote{{ outlook.nextTier ? ' to ' + labelOf(outlook.nextTier) : '' }}.
          </div>
        </template>
      </div>

      <div class="lp-rewards-title fw-bold mb-2">💰 Placement Rewards by Tier</div>
      <div class="d-flex flex-column gap-px6">
        <div
          v-for="t in RACING_LEAGUE_TIERS"
          :key="t"
          class="lp-reward-row d-flex align-items-center flex-wrap gap-tight px-tight py-2 rounded-3"
          :class="{ 'lp-reward-current': t === tier }"
          :style="{ borderColor: RACING_LEAGUE_COLORS[t] }"
        >
          <div class="lp-reward-tier" :style="{ color: RACING_LEAGUE_COLORS[t] }">
            {{ RACING_LEAGUE_LABELS[t] }}
          </div>
          <div class="lp-reward-values d-flex flex-wrap gap-px10">
            <span v-for="(pp, i) in RACING_LEAGUE_REWARDS[t]" :key="i">
              <em>{{ ORDINALS[i] }}</em> {{ pp }}
            </span>
          </div>
        </div>
      </div>
      <p class="lp-note mt-px10">Placement also earns league points: {{ RACING_PLACEMENT_PTS.join(' · ') }} for 1st through 6th.</p>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { racingService, racingState } from '../../services/RacingService.js'
import {
  RACING_LEAGUE_TIERS, RACING_LEAGUE_LABELS, RACING_LEAGUE_COLORS,
  RACING_LEAGUE_REWARDS, RACING_PLACEMENT_PTS
} from '../../data/racingData.js'

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th']

const tier = computed(() => racingService.tier())
const tierLabel = computed(() => RACING_LEAGUE_LABELS[tier.value] || tier.value)
const tierColor = computed(() => RACING_LEAGUE_COLORS[tier.value] || '#ccc')
const outlook = computed(() => racingService.leagueOutlook())

const statusClass = computed(() => ({
  'lp-promote': outlook.value.canPromote,
  'lp-risk': outlook.value.atRisk && !outlook.value.canPromote
}))

const labelOf = (t) => RACING_LEAGUE_LABELS[t] || t || 'Champion'
</script>

<style lang="scss" scoped>
// Layout, spacing and the two-up stat grid are Bootstrap's. What stays is the
// colour/border treatment and the one radius the utility scale can't hit.
.lp-tier {
  background: var(--white);
  border: 3px solid;
  border-radius: 16px; // `rounded-4` is 14px — see the template comment.
}

.lp-tier-label { font-size: 2.5rem; }

.lp-tier-stat { background: var(--bg); }

.lp-tier-stat-label {
  font-size: 0.75rem;
  color: var(--text-light);
}

.lp-tier-stat-value {
  font-size: 1.5rem;
  font-weight: 700;
}

.lp-status {
  background: rgba(153, 102, 255, 0.07);
  border: 2px solid rgba(153, 102, 255, 0.2);

  &.lp-promote {
    background: rgba(39, 174, 96, 0.1);
    border-color: #27ae60;
    .lp-status-title { color: #27ae60; }
  }

  &.lp-risk {
    background: rgba(231, 76, 60, 0.1);
    border-color: #e74c3c;
    .lp-status-title { color: #e74c3c; }
  }
}

.lp-status-title { font-weight: 700; }

.lp-status-body {
  font-size: 0.82rem;
  margin-top: 4px;
}

.lp-rewards-title { font-size: 0.9rem; }

.lp-reward-row {
  border: 2px solid;
  background: var(--white);
  opacity: 0.7;

  &.lp-reward-current { opacity: 1; }
}

// A label column measure, not a spacing step: it keeps the tier names aligned
// so the placement figures line up down the list.
.lp-reward-tier {
  font-weight: 700;
  font-size: 0.85rem;
  min-width: 110px;
}

.lp-reward-values {
  font-size: 0.78rem;

  em {
    color: var(--text-light);
    font-style: normal;
    margin-right: 2px;
  }
}

.lp-note {
  font-size: 0.75rem;
  color: var(--text-light);
}
</style>

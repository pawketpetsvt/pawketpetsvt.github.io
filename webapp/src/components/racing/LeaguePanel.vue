<template>
  <!-- Ports racing_renderLeagueTab(). Promotion needs 3+ races AND 12+ points
       in a week; relegation happens on fewer than 2 races OR fewer than 4. -->
  <div>
    <h3 class="lp-title">🏆 League Standing</h3>

    <div v-if="!racingState.league" class="spinner"></div>

    <template v-else>
      <div class="lp-tier" :style="{ borderColor: tierColor }">
        <div class="lp-tier-label">{{ tierLabel }}</div>
        <div class="lp-tier-stats">
          <div class="lp-tier-stat">
            <div class="lp-tier-stat-label">Races This Week</div>
            <div class="lp-tier-stat-value">{{ outlook.races }} / 3+</div>
          </div>
          <div class="lp-tier-stat">
            <div class="lp-tier-stat-label">League Points</div>
            <div class="lp-tier-stat-value">{{ outlook.pts }} / 12+</div>
          </div>
        </div>
      </div>

      <div class="lp-status" :class="statusClass">
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

      <div class="lp-rewards-title">💰 Placement Rewards by Tier</div>
      <div class="lp-rewards">
        <div
          v-for="t in RACING_LEAGUE_TIERS"
          :key="t"
          class="lp-reward-row"
          :class="{ 'lp-reward-current': t === tier }"
          :style="{ borderColor: RACING_LEAGUE_COLORS[t] }"
        >
          <div class="lp-reward-tier" :style="{ color: RACING_LEAGUE_COLORS[t] }">
            {{ RACING_LEAGUE_LABELS[t] }}
          </div>
          <div class="lp-reward-values">
            <span v-for="(pp, i) in RACING_LEAGUE_REWARDS[t]" :key="i" class="lp-reward-place">
              <em>{{ ORDINALS[i] }}</em> {{ pp }}
            </span>
          </div>
        </div>
      </div>
      <p class="lp-note">Placement also earns league points: {{ RACING_PLACEMENT_PTS.join(' · ') }} for 1st through 6th.</p>
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
.lp-title { margin-bottom: 12px; }

.lp-tier {
  background: var(--white);
  border: 3px solid;
  border-radius: 16px;
  padding: 20px;
  text-align: center;
  margin-bottom: 16px;
}

.lp-tier-label {
  font-size: 2.5rem;
  margin-bottom: 6px;
}

.lp-tier-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 10px;
}

.lp-tier-stat {
  background: var(--bg);
  border-radius: 10px;
  padding: 10px;
}

.lp-tier-stat-label {
  font-size: 0.75rem;
  color: var(--text-light);
}

.lp-tier-stat-value {
  font-size: 1.5rem;
  font-weight: 700;
}

.lp-status {
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
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

.lp-rewards-title {
  font-weight: 700;
  font-size: 0.9rem;
  margin-bottom: 8px;
}

.lp-rewards {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lp-reward-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 8px 12px;
  border: 2px solid;
  border-radius: 12px;
  background: var(--white);
  opacity: 0.7;

  &.lp-reward-current { opacity: 1; }
}

.lp-reward-tier {
  font-weight: 700;
  font-size: 0.85rem;
  min-width: 110px;
}

.lp-reward-values {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
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
  margin-top: 10px;
}
</style>

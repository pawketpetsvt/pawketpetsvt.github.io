<template>
  <div class="page-wrap">
    <div class="page-hero">
      <div class="sparkle-row">🟪 ✦ 🟪</div>
      <h1>Twitch &amp; Rewards</h1>
      <p>Connect your Twitch and check out our team! ✨</p>
    </div>

    <a :href="TWITCH_TEAM_URL" target="_blank" rel="noopener" class="team-page-link">
      🟪 Visit Our Official Twitch Team Page
    </a>

    <!-- Reward explainer — visible whether or not an account is linked -->
    <div class="twitch-rewards-section">
      <h3 class="tw-rewards-title">🎁 Earn PP by Being Active in Our Streams!</h3>
      <div class="reward-cards row row-cols-1 row-cols-md-2 g-3">
        <div v-for="c in TWITCH_REWARD_CARDS" :key="c.title" class="col">
          <div class="reward-card h-100">
            <div class="reward-icon">{{ c.icon }}</div>
            <div class="reward-info">
              <div class="reward-title">{{ c.title }}</div>
              <div class="reward-desc">{{ c.desc }}</div>
              <div v-if="c.cooldown" class="reward-cooldown">{{ c.cooldown }}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="twitch-tip">
        💡 <strong>Pro Tip:</strong> Link your Twitch account below, then go chat in our streams!
        Rewards credit automatically, no button to click.
      </div>
    </div>

    <div class="section-header mt-5"><h2>Link Your Account</h2><div class="section-line"></div></div>

    <!-- Streamers copy this into their Cloudflare worker config. Only shown on
         the request that just came back from Twitch — never re-read from the DB. -->
    <div v-if="twitchState.displayToken" class="token-box">
      <h3>Authorization Successful!</h3>
      <p class="tw-token-note">Streamers: copy this token for Cloudflare. Viewers can ignore this.</p>
      <textarea class="token-textarea" readonly :value="twitchState.displayToken"></textarea>
      <br><button class="btn btn-primary btn-sm mt-2" @click="copyToken">Copy Token</button>
    </div>

    <div class="twitch-card">
      <h2>Connect Twitch Account</h2>
      <p>Link your Twitch to unlock stream rewards! Earn PP for following and chatting live.</p>

      <div v-if="twitchState.loading" class="spinner"></div>

      <template v-else-if="!twitchState.linked">
        <button class="btn-twitch" @click="twitchService.beginLink()">🟪 Connect with Twitch</button>
        <p class="tw-privacy-note">We only read public info. We never post on your behalf.</p>
      </template>

      <template v-else>
        <div class="linked-panel">
          <h3>Twitch Linked!</h3>
          <p class="tw-connected-as">
            Connected as: <strong class="tw-username">{{ twitchState.username }}</strong>
          </p>

          <!-- Legacy listed only Embertail and Pyxshuul here while rewarding
               every streamer in the table. All of them are listed now. -->
          <ul class="reward-list">
            <li v-for="s in FOLLOW_STREAMERS" :key="s.key">
              Follow {{ s.name }}
              <span v-if="badgeFor(s.key)" class="status-badge" :class="badgeFor(s.key).cls">
                {{ badgeFor(s.key).label }}
              </span>
            </li>
            <li>+{{ FOLLOW_REWARD_PP }} PP per follow (one time each)</li>
          </ul>

          <button
            class="btn btn-primary"
            :disabled="twitchState.checkingFollows"
            @click="twitchService.checkFollows()"
          >
            {{ twitchState.checkingFollows ? 'Checking...' : 'Check Follows & Claim Rewards' }}
          </button>
        </div>

        <div v-if="twitchState.stats" class="tw-stats-panel">
          <div class="tw-stats-title">📊 Your Twitch Rewards</div>
          <div class="row row-cols-4 g-2 text-center">
            <div class="col"><div class="tw-stat"><div class="tw-stat-num">{{ twitchState.stats.pp.toLocaleString() }}</div><div class="tw-stat-label">PP Earned</div></div></div>
            <div class="col"><div class="tw-stat"><div class="tw-stat-num">{{ twitchState.stats.chats.toLocaleString() }}</div><div class="tw-stat-label">Chats</div></div></div>
            <div class="col"><div class="tw-stat"><div class="tw-stat-num">{{ twitchState.stats.follows }}</div><div class="tw-stat-label">Follows</div></div></div>
            <div class="col"><div class="tw-stat"><div class="tw-stat-num">{{ twitchState.stats.subs.toLocaleString() }}</div><div class="tw-stat-label">Subs</div></div></div>
          </div>
          <div class="tw-stats-legend">
            💬 Chat rewards: +2 PP per 5 min · 👥 Follow: +{{ FOLLOW_REWARD_PP }} PP each · 🌟 Sub: +200 PP · 🪙 Bits: +1 PP per 10
          </div>
        </div>

        <button class="btn btn-outline btn-sm mt-3" @click="twitchService.unlink()">Unlink Twitch</button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { twitchService, twitchState } from '../services/TwitchService.js'
import { toastService } from '../services/ToastService.js'
import {
  TWITCH_REWARD_CARDS, TWITCH_TEAM_URL, FOLLOW_STREAMERS, FOLLOW_REWARD_PP
} from '../data/twitchData.js'

function badgeFor(key) {
  if (twitchState.followRewards[key]) return { label: 'Claimed', cls: 'status-done' }
  const s = twitchState.followStatus[key]
  if (s === 'not-following') return { label: 'Not following', cls: 'status-pending' }
  if (s === 'error') return { label: 'Check failed', cls: 'status-pending' }
  return null
}

function copyToken() {
  const t = twitchState.displayToken
  if (!t) { toastService.info('No token to copy.'); return }
  navigator.clipboard.writeText(t)
    .then(() => toastService.success('Token copied to clipboard!'))
    .catch(() => toastService.error('Could not copy — select the box and copy manually.'))
}

onMounted(async () => {
  // The OAuth fragment was captured and stripped at module load in
  // TwitchService, before the router could try to route it.
  const token = twitchService.takePendingToken()
  if (token) {
    try {
      await twitchService.completeLink(token)
      toastService.success('✅ Twitch account linked successfully!')
    } catch (e) {
      console.error('[twitch] link failed:', e)
      toastService.error('Error linking Twitch account')
    }
  } else {
    await twitchService.loadStatus()
  }
  twitchService.startRewardPolling()
})
</script>

<style lang="scss" scoped>
// style.css owns .twitch-card, .reward-card, .token-box, .btn-twitch,
// .linked-panel, .reward-list and .status-badge. What it does NOT define is
// .status-done / .status-pending (the badge variants), and the whole stats
// panel, which legacy built from inline styles in the markup.
.tw-rewards-title {
  margin-bottom: 16px;
  color: var(--purple-dark);
}

.tw-token-note,
.tw-privacy-note {
  font-size: 0.85rem;
  color: var(--text-light);
}

.tw-privacy-note { margin-top: 14px; }
.tw-token-note { margin-bottom: 10px; }

.tw-connected-as {
  color: var(--text-light);
  font-size: 0.88rem;
}

.tw-username { color: var(--purple-dark); }

.status-badge {
  &.status-done {
    background: var(--green);
    color: var(--white);
  }
  &.status-pending {
    background: var(--purple-light);
    color: var(--purple-dark);
  }
}

.tw-stats-panel {
  margin-top: 18px;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(153, 102, 255, 0.06);
  border: 1px solid var(--purple-light);
}

.tw-stats-title {
  font-weight: 700;
  font-size: 0.88rem;
  color: var(--purple-dark);
  margin-bottom: 10px;
}

.tw-stat {
  background: var(--white);
  border-radius: 10px;
  padding: 8px 4px;
}

.tw-stat-num {
  font-weight: 800;
  font-size: 1.1rem;
  color: var(--purple);
}

.tw-stat-label {
  font-size: 0.68rem;
  color: var(--text-light);
}

.tw-stats-legend {
  margin-top: 10px;
  font-size: 0.72rem;
  color: var(--text-light);
  line-height: 1.5;
}
</style>

<template>
  <div class="page-wrap container-fluid position-relative z-1 pb-page">
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
      <h3 class="tw-rewards-title mb-3">🎁 Earn PP by Being Active in Our Streams!</h3>
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
      <p class="tw-token-note mb-px10">Streamers: copy this token for Cloudflare. Viewers can ignore this.</p>
      <textarea class="token-textarea" readonly :value="twitchState.displayToken"></textarea>
      <br><button class="btn btn-primary btn-sm mt-2" @click="copyToken">Copy Token</button>
    </div>

    <div class="twitch-card">
      <h2>Connect Twitch Account</h2>
      <p>Link your Twitch to unlock stream rewards! Earn PP for following and chatting live.</p>

      <div v-if="twitchState.loading" class="spinner"></div>

      <template v-else-if="!twitchState.linked">
        <button class="btn-twitch" @click="twitchService.beginLink()">🟪 Connect with Twitch</button>
        <p class="tw-privacy-note mt-px14">We only read public info. We never post on your behalf.</p>
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

        <div v-if="twitchState.stats" class="tw-stats-panel py-px14 px-3 rounded-4">
          <div class="tw-stats-title mb-px10">📊 Your Twitch Rewards</div>
          <div class="row row-cols-4 g-2 text-center">
            <div class="col"><div class="tw-stat"><div class="tw-stat-num">{{ twitchState.stats.pp.toLocaleString() }}</div><div class="tw-stat-label">PP Earned</div></div></div>
            <div class="col"><div class="tw-stat"><div class="tw-stat-num">{{ twitchState.stats.chats.toLocaleString() }}</div><div class="tw-stat-label">Chats</div></div></div>
            <div class="col"><div class="tw-stat"><div class="tw-stat-num">{{ twitchState.stats.follows }}</div><div class="tw-stat-label">Follows</div></div></div>
            <div class="col"><div class="tw-stat"><div class="tw-stat-num">{{ twitchState.stats.subs.toLocaleString() }}</div><div class="tw-stat-label">Subs</div></div></div>
          </div>
          <div class="tw-stats-legend mt-px10">
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
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.team-page-link {
  display: block !important;
  text-align: center !important;
  font-family: 'Chewy', cursive !important;
  font-size: 1.2rem !important;
  color: var(--white) !important;
  background: linear-gradient(135deg, #9146ff, #772ce8) !important;
  padding: 16px 32px !important;
  border-radius: 30px !important;
  margin: 20px auto !important;
  max-width: 400px !important;
  border: 3px solid rgba(255,255,255,0.3) !important;
  box-shadow: 0 6px 20px rgba(145,70,255,0.4) !important;
  transition: all 0.3s !important;
  font-weight: 600 !important;
  text-decoration: none !important;
}
.team-page-link:hover {
  transform: translateY(-4px) scale(1.03) !important;
  box-shadow: 0 10px 30px rgba(145,70,255,0.5) !important;
  color: var(--white) !important;
}
.twitch-card {
  background: var(--white) !important;
  border: 4px solid var(--border) !important;
  border-radius: var(--radius-xl) !important;
  padding: 32px 28px !important;
  max-width: 600px !important;
  margin: 30px auto !important;
  box-shadow: 0 10px 30px rgba(153,102,255,0.25) !important;
  text-align: center !important;
}
.twitch-card h2 {
  font-family: 'Chewy', cursive !important;
  font-size: 2rem !important;
  color: var(--purple-dark) !important;
  margin-bottom: 12px !important;
  text-shadow: 2px 2px 0 var(--pink-light) !important;
}
.twitch-card p {
  font-size: 1.05rem !important;
  color: var(--text) !important;
  line-height: 1.6 !important;
  margin-bottom: 20px !important;
  font-weight: 500 !important;
}
.btn-twitch {
  font-family: 'Chewy', cursive !important;
  font-size: 1.2rem !important;
  padding: 16px 40px !important;
  border-radius: 35px !important;
  background: linear-gradient(135deg, #9146ff, #772ce8) !important;
  color: var(--white) !important;
  border: 3px solid rgba(255,255,255,0.3) !important;
  cursor: pointer !important;
  transition: all 0.3s !important;
  font-weight: 600 !important;
  box-shadow: 0 6px 20px rgba(145,70,255,0.4) !important;
}
.btn-twitch:hover {
  transform: translateY(-4px) scale(1.05) !important;
  box-shadow: 0 10px 30px rgba(145,70,255,0.5) !important;
}
.linked-panel {
  background: rgba(145,70,255,0.08) !important;
  border-radius: var(--radius) !important;
  padding: 24px !important;
  margin-bottom: 16px !important;
  border: 2px solid rgba(145,70,255,0.2) !important;
}
.linked-panel h3 {
  font-family: 'Chewy', cursive !important;
  font-size: 1.5rem !important;
  color: var(--purple-dark) !important;
  margin-bottom: 10px !important;
}
.reward-list {
  list-style: none !important;
  padding: 0 !important;
  margin: 16px 0 !important;
  text-align: left !important;
  max-width: 400px !important;
  margin-left: auto !important;
  margin-right: auto !important;
}
.reward-list li {
  padding: 8px 0 !important;
  font-size: 0.95rem !important;
  color: var(--text) !important;
  font-weight: 600 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
}
.status-badge {
  font-size: 0.75rem !important;
  padding: 4px 10px !important;
  border-radius: 15px !important;
  font-weight: 700 !important;
  text-transform: uppercase !important;
  font-family: 'Fredoka', cursive !important;
}
.token-box {
  background: rgba(255,221,0,0.15) !important;
  border: 3px solid var(--yellow) !important;
  border-radius: var(--radius-xl) !important;
  padding: 24px !important;
  margin-bottom: 24px !important;
  max-width: 600px !important;
  margin-left: auto !important;
  margin-right: auto !important;
}
.token-box h3 {
  font-family: 'Chewy', cursive !important;
  font-size: 1.5rem !important;
  color: var(--purple-dark) !important;
  margin-bottom: 10px !important;
}
.token-textarea {
  width: 100% !important;
  min-height: 120px !important;
  padding: 14px !important;
  border: 3px solid var(--border) !important;
  border-radius: 20px !important;
  font-family: 'Courier New', monospace !important;
  font-size: 0.85rem !important;
  background: var(--white) !important;
  color: var(--text) !important;
  resize: vertical !important;
}
.reward-icon {
  font-size: 40px;
  margin: 15px 0;
}
.twitch-rewards-section {
  background: var(--white);
  border: 2px solid var(--border);
  border-radius: 16px;
  padding: 20px;
  margin: 20px 0;
}
.reward-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin: 16px 0;
}
.reward-card {
  display: flex;
  gap: 12px;
  padding: 14px;
  background: rgba(153,102,255,0.07);
  border-radius: 12px;
  border-left: 4px solid var(--purple);
}
.reward-icon { font-size: 1.8rem; flex-shrink: 0; }
.reward-title {
  font-weight: 700;
  color: var(--purple-dark);
  font-size: 0.88rem;
  margin-bottom: 3px;
}
.reward-desc {
  font-size: 0.78rem;
  color: var(--text-light);
  line-height: 1.4;
  margin-bottom: 3px;
}
.reward-cooldown {
  font-size: 0.7rem;
  color: #ffaa00;
  font-weight: 600;
}
.twitch-tip {
  background: rgba(255,215,0,0.08);
  border: 1px solid rgba(255,215,0,0.25);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 0.82rem;
  color: var(--text-light);
  line-height: 1.5;
  margin-top: 8px;
}
@media (max-width: 500px) {
  .reward-cards { grid-template-columns: 1fr; }
}

// the global stylesheet owns .twitch-card, .reward-card, .token-box, .btn-twitch,
// .linked-panel, .reward-list and .status-badge. What it does NOT define is
// .status-done / .status-pending (the badge variants), and the whole stats
// panel, which legacy built from inline styles in the markup.
.tw-rewards-title {
  color: var(--purple-dark);
}

.tw-token-note,
.tw-privacy-note {
  font-size: 0.85rem;
  color: var(--text-light);
}

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
  background: rgba(153, 102, 255, 0.06);
  border: 1px solid var(--purple-light);
}

.tw-stats-title {
  font-weight: 700;
  font-size: 0.88rem;
  color: var(--purple-dark);
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
  font-size: 0.72rem;
  color: var(--text-light);
  line-height: 1.5;
}
</style>

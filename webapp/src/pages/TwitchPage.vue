<template>
  <div class="page-wrap container-fluid position-relative z-1 pb-page">
    <div class="page-hero">
      <div class="sparkle-row"><TwitchLogo /> ✦ <TwitchLogo /></div>
      <h1>Twitch &amp; Rewards</h1>
      <p>Connect your Twitch and check out our team! ✨</p>
    </div>

    <a :href="TWITCH_TEAM_URL" target="_blank" rel="noopener" class="team-page-link">
      <TwitchLogo /> Visit Our Official Twitch Team Page
    </a>

    <!-- Reward explainer — visible whether or not an account is linked -->
    <div class="twitch-rewards-section">
      <h3 class="tw-rewards-title mb-3">🎁 Earn PP by Being Active in Our Streams!</h3>
      <div class="row row-cols-1 row-cols-md-2 g-3 mb-3">
        <div v-for="c in TWITCH_REWARD_CARDS" :key="c.title" class="col">
          <div class="reward-card h-100">
            <div class="reward-icon">{{ c.icon }}</div>
            <div class="reward-info min-w-0">
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

    <div class="twitch-card">
      <h2>Connect Twitch Account</h2>
      <p>Link your Twitch to unlock stream rewards! Earn PP for following and chatting live.</p>

      <div v-if="twitchState.loading" class="spinner"></div>

      <template v-else-if="!twitchState.linked">
        <button class="btn-twitch" :disabled="linking" @click="link"><TwitchLogo /> Connect with Twitch</button>
        <p class="tw-privacy-note mt-px14">We only read public info. We never post on your behalf.
          Once linked, you can also sign in with "Log In With Twitch".</p>
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

          <!-- Follow checks need a live Twitch token, and the one from Log In
               With Twitch lasts only hours. This fetches a long-lived one. -->
          <div class="mt-3">
            <button class="btn btn-sm" :class="twitchState.needsReconnect ? 'btn-primary' : 'btn-outline'"
              @click="twitchService.beginReconnect()">
              🔄 Reconnect Twitch
            </button>
            <p v-if="twitchState.needsReconnect" class="tw-privacy-note mt-2 mb-0">
              Your Twitch connection expired — reconnect, then check your follows again.
            </p>
          </div>
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

    <!-- Replaces the old "copy this token for Cloudflare" box. The worker gets
         subs, cheers, follows and chat from Twitch EventSub, which Twitch only
         allows once each streamer — and the chat-reading bot account — has
         authorized the app. Nothing is stored; the authorization is the point. -->
    <details class="tw-streamers mx-auto" :open="!!twitchState.streamerAuth">
      <summary>🎥 For PawketPets streamers</summary>
      <p class="tw-privacy-note mt-2">
        So the game can reward your viewers for chatting, following, subscribing and cheering, authorize
        PawketPets <strong>once, while logged in to Twitch as your streaming account</strong>. Twitch will show
        exactly what's being allowed. Nothing posts on your behalf.
      </p>
      <div class="d-flex flex-wrap justify-content-center gap-2">
        <button class="btn btn-primary btn-sm" @click="twitchService.beginStreamerAuth('channel')">
          <TwitchLogo /> Authorize my channel
        </button>
        <button class="btn btn-outline btn-sm" @click="twitchService.beginStreamerAuth('bot')">
          🤖 Authorize the chat bot account
        </button>
      </div>
      <p class="tw-privacy-note mt-2 mb-0">The bot button is only for the PawketPets bot account that reads chat.
        Making that bot a moderator in your channel is enough for chat and follow rewards; authorizing your
        channel adds sub and cheer rewards.</p>

      <div v-if="twitchState.streamerAuth" class="tw-auth-result mt-3 p-3 rounded-3">
        <template v-if="!twitchState.streamerAuth.missing.length">
          ✅ <strong>{{ twitchState.streamerAuth.login }}</strong>
          {{ twitchState.streamerAuth.kind === 'bot' ? 'is authorized as the chat bot.' : 'has authorized PawketPets for their channel.' }}
          <div class="tw-privacy-note mt-1">Twitch user id: {{ twitchState.streamerAuth.userId }}</div>
        </template>
        <template v-else>
          ⚠️ <strong>{{ twitchState.streamerAuth.login }}</strong> didn't grant everything needed
          (missing: {{ twitchState.streamerAuth.missing.join(', ') }}). Please try again and accept all permissions.
        </template>
      </div>
    </details>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { twitchService, twitchState } from '../services/TwitchService.js'
import { authService } from '../services/AuthService.js'
import { toastService } from '../services/ToastService.js'
import TwitchLogo from '../components/TwitchLogo.vue'
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

// Leaves the site for Twitch and comes back through Supabase; AuthService
// returns the player to this page afterwards.
const linking = ref(false)
async function link() {
  linking.value = true
  try {
    await authService.linkTwitch()
  } catch (e) {
    toastService.error(e.message)
    linking.value = false
  }
}

onMounted(async () => {
  // A token from a direct Twitch redirect, captured and stripped at module load
  // in TwitchService before the router could try to route it. Its `state` says
  // which button sent the player there.
  const pending = twitchService.takePendingAuth()
  if (pending && (pending.state === 'channel' || pending.state === 'bot')) {
    try {
      await twitchService.completeStreamerAuth(pending.token, pending.state)
    } catch (e) {
      toastService.error(e.message)
    }
    await twitchService.loadStatus()
  } else if (pending) {
    try {
      await twitchService.completeReconnect(pending.token)
      toastService.success('✅ Twitch reconnected!')
    } catch (e) {
      console.error('[twitch] reconnect failed:', e)
      toastService.error(e.message || 'Error reconnecting Twitch')
      await twitchService.loadStatus()
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
// The streamer authorization panel, which replaced the old token box.
.tw-streamers {
  max-width: 600px;
  background: var(--white);
  border: 2px dashed var(--border);
  border-radius: var(--radius-lg);
  padding: 14px 20px;
  text-align: center;

  summary {
    cursor: pointer;
    font-weight: 700;
    color: var(--purple-dark);
  }
}

.tw-auth-result {
  background: rgba(145, 70, 255, 0.08);
  border: 1px solid rgba(145, 70, 255, 0.25);
  font-size: 0.9rem;
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
// The card grid is the Bootstrap `row row-cols-1 row-cols-md-2 g-3` in the
// template. A `.reward-cards` rule here used to ALSO make that row a CSS grid
// (`repeat(auto-fit, minmax(220px, 1fr))` plus a 12px gap and `margin: 16px 0`).
// The two layouts nested rather than combined: each `.col` kept Bootstrap's
// `width: 50%` and was then sized at 50% of its GRID TRACK, so every card
// rendered at roughly half the width it was given, its text squeezed into a
// ~100px column and spilling past the card's background and border. The margin
// also cancelled the row's negative gutter margins. Bootstrap alone now owns it.
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

// .status-done / .status-pending (the badge variants) and the whole stats
// panel were built from inline styles in the legacy markup.
.tw-rewards-title {
  color: var(--purple-dark);
}

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

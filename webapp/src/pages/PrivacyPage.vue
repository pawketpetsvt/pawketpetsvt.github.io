<template>
  <div class="page-wrap container-fluid position-relative z-1 pb-page privacy-col">
    <div class="privacy-doc">
      <div class="d-flex align-items-center gap-tight mb-2">
        <button class="privacy-back rounded-1 py-px6 px-px14" @click="router.back()">← Back</button>
        <h1 class="privacy-title m-0">Privacy Policy</h1>
      </div>
      <p class="privacy-sub">Last updated: August 2026 &nbsp;·&nbsp; <em>This policy is provided in good faith for a free beta. It will be formally reviewed by legal counsel before any paid features are introduced.</em></p>

      <div class="legal-doc">
        <h2>1. Who We Are</h2>
        <p>PawketPetsVT ("PawketPets", "we", "us", or "our") is an independent browser-based virtual pet game created and operated by Embertail (PawketPetsVT). The game is accessible at pawketpets.net.</p>
        <p>For privacy questions, contact us at: <strong>pawketpetsvt@gmail.com</strong> (or via our Discord server at discord.gg/9TbRZkSJpU).</p>

        <h2>2. What Information We Collect</h2>
        <h3>Information you provide directly:</h3>
        <ul>
          <li><strong>Email address</strong> — used to create and authenticate your account. Stored securely via Supabase Auth.</li>
          <li><strong>Username</strong> — your chosen display name, visible to other players.</li>
          <li><strong>Date of birth</strong> — used solely to verify you meet the minimum age requirement (13+). We do not store your exact birth date after age verification; we store only whether the age requirement was met.</li>
        </ul>
        <h3>Information collected automatically:</h3>
        <ul>
          <li><strong>Gameplay data</strong> — your pets, inventory, PawketPoints balance, login streaks, battle history, and similar in-game activity. This is necessary for the game to function.</li>
          <li><strong>Twitch ID and username</strong> — only if you voluntarily link your Twitch account via the Twitch tab. Used solely to detect when followed streamers go live and to credit PawketPoints for stream watching. We store only your Twitch user ID and display name — we do not access your Twitch email, subscriptions, payment information, or any other Twitch data.</li>
          <li><strong>Session data</strong> — Supabase sets authentication cookies/tokens in your browser to keep you logged in. These are technical necessities and contain no personal tracking data.</li>
          <li><strong>Browser and device type</strong> — collected passively by our hosting infrastructure (GitHub Pages / Supabase). We do not run any analytics trackers or advertising scripts.</li>
        </ul>
        <h3>Information we do NOT collect:</h3>
        <ul>
          <li>Payment information (we have no paid features at this time)</li>
          <li>Location data beyond country-level (from hosting infrastructure logs)</li>
          <li>Social media profiles beyond the Twitch link described above</li>
          <li>Any information from children under 13</li>
        </ul>

        <h2>3. How We Use Your Information</h2>
        <ul>
          <li>To create, maintain, and secure your game account</li>
          <li>To save your game progress and enable gameplay features</li>
          <li>To send password reset emails (only when requested by you)</li>
          <li>To display your username and in-game stats to other players, where you have chosen to participate in social features (friends, guestbook, leaderboard)</li>
          <li>To detect live Twitch streams from our team members, if you have linked your account</li>
          <li>To improve the game during the beta period</li>
        </ul>
        <p>We do not sell your personal information to third parties. We do not use your information for advertising. We do not use automated decision-making or profiling in any way that produces legal or significant effects on you.</p>

        <h2>4. Who We Share Your Information With</h2>
        <p>We use the following third-party services to operate the game:</p>
        <ul>
          <li><strong>Supabase</strong> (supabase.com) — database, authentication, and backend services. Your email, username, and gameplay data are stored on Supabase servers. Supabase is GDPR-compliant and SOC 2 certified. See supabase.com/privacy for their policy.</li>
          <li><strong>GitHub Pages</strong> — hosts the game frontend. GitHub may collect standard web server logs. See docs.github.com/en/site-policy/privacy-policies for their policy.</li>
          <li><strong>Cloudflare</strong> — used for the Twitch stream integration worker. Cloudflare processes Twitch webhook events on our behalf. See cloudflare.com/privacypolicy for their policy.</li>
          <li><strong>Twitch</strong> — if you voluntarily link your Twitch account. See twitch.tv/p/en/legal/privacy-notice for their policy.</li>
          <li><strong>Tally.so</strong> — if you choose to complete our optional feedback survey. See tally.so/privacy for their policy.</li>
        </ul>
        <p>We will disclose your information if required to do so by law or if we believe in good faith that such disclosure is necessary to protect our rights, comply with a judicial proceeding, court order, or legal process.</p>

        <h2>5. Data Retention</h2>
        <p>We retain your account and gameplay data for as long as your account is active. During the beta period, data may be reset as part of game updates — we will announce any planned data wipes in advance via our Discord and news feed.</p>
        <p>If you request account deletion, we will delete your personal data (email, username, gameplay records) within 30 days. To request deletion, contact us via Discord or email.</p>

        <h2>6. Children's Privacy (COPPA)</h2>
        <p>PawketPetsVT is not directed at children under the age of 13. We do not knowingly collect personal information from children under 13. If you are under 13, please do not register for an account.</p>
        <p>If we learn that we have collected personal information from a child under 13 without verifiable parental consent, we will promptly delete that information. If you believe we have inadvertently collected such information, please contact us immediately.</p>
        <p>Users aged 13–17 should have parental or guardian awareness of their participation in PawketPets.</p>

        <h2>7. Your Rights</h2>
        <p>Depending on where you live, you may have the following rights regarding your personal data:</p>
        <ul>
          <li><strong>Access</strong> — request a copy of the personal data we hold about you</li>
          <li><strong>Correction</strong> — request correction of inaccurate data (your username can be updated in Settings)</li>
          <li><strong>Deletion</strong> — request deletion of your account and associated data</li>
          <li><strong>Portability</strong> — request your data in a machine-readable format</li>
          <li><strong>Objection</strong> — object to certain processing of your data</li>
        </ul>
        <p>To exercise any of these rights, contact us via Discord or email. We will respond within 30 days.</p>
        <p><strong>California residents (CCPA):</strong> You have the right to know what personal information we collect, to request deletion, and to opt out of the sale of your personal information. We do not sell personal information.</p>
        <p><strong>EEA/UK residents (GDPR):</strong> Our lawful basis for processing your personal data is the performance of our contract with you (operating your game account) and our legitimate interests in running the game. You may lodge a complaint with your national data protection authority if you believe we have mishandled your data.</p>

        <h2>8. Security</h2>
        <p>We implement reasonable technical measures to protect your information, including encrypted transmission (HTTPS), secure password hashing via Supabase Auth, and row-level security policies on our database. No method of electronic transmission or storage is 100% secure. We cannot guarantee absolute security but take our obligations seriously.</p>

        <h2>9. Cookies</h2>
        <p>PawketPetsVT uses essential cookies only. Supabase Auth stores an authentication token in your browser's localStorage/sessionStorage to keep you logged in. We do not use advertising cookies, tracking cookies, or analytics cookies. You can clear these tokens at any time by logging out.</p>

        <h2>10. Changes to This Policy</h2>
        <p>We may update this Privacy Policy from time to time. We will notify players of significant changes via our in-game news feed and Discord. Continued use of the game after changes constitutes acceptance of the updated policy.</p>

        <h2>11. Contact</h2>
        <p>For any privacy questions, data requests, or concerns:</p>
        <ul>
          <li><strong>Discord:</strong> discord.gg/9TbRZkSJpU</li>
          <li><strong>Email:</strong> pawketpetsvt@gmail.com</li>
          <li><strong>Twitch:</strong> twitch.tv/embertail</li>
        </ul>
        <p class="privacy-footnote mt-4 pt-3"><em>This Privacy Policy was drafted by the PawketPetsVT development team in good faith based on applicable privacy law requirements. It will be formally reviewed by qualified legal counsel before any paid features are introduced. Last updated August 2026.</em></p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.legal-doc {
  line-height: 1.75;
  color: var(--text);
}
.legal-doc h2 {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--purple-dark);
  margin: 28px 0 10px;
  padding-bottom: 6px;
  border-bottom: 2px solid rgba(153,102,255,0.15);
}
.legal-doc h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 16px 0 6px;
  color: var(--text);
}
.legal-doc h2:first-child { margin-top: 0; }
.legal-doc p { margin: 0 0 12px; color: var(--text); }
.legal-doc ul {
  margin: 8px 0 14px 20px;
  padding: 0;
}
.legal-doc li { margin-bottom: 6px; }
.legal-doc strong { color: var(--text); }
.legal-doc a { color: var(--purple); }
body.night-mode .legal-doc, body.night-mode .legal-doc p, body.night-mode .legal-doc li { color: var(--text) !important; }
body.night-mode .legal-doc h2 { color: #c4a0ff !important; border-color: rgba(153,102,255,0.2) !important; }

// Layout is Bootstrap's (`container-fluid` + spacing/flex utilities). What
// stays here is what the utility scale cannot express: a legal document's
// reading measure and inset, and the colour/border treatment.
.privacy-col {
  // 860px is a reading measure, not a grid step — Bootstrap has no container
  // between 720px and 960px, and a `col-*` fraction would move with the
  // viewport rather than holding a fixed line length.
  max-width: 860px;
}

// 32px sits between the site's `wide` (28px) and `page` (60px) spacer tokens.
// Kept literal rather than rounded to a utility, since "close enough" spacing
// drift is what the radius audit had to unpick earlier in this migration.
.privacy-doc { padding: 32px 24px; }

.privacy-back {
  background: none;
  border: 1px solid var(--border);
  cursor: pointer;
  color: var(--text);
  font-size: 0.88rem;
}

.privacy-title { font-size: 1.8rem; }

.privacy-sub {
  color: var(--text-light);
  font-size: 0.88rem;
  margin-bottom: 32px;
}

.privacy-footnote {
  font-size: 0.82rem;
  color: var(--text-light);
  border-top: 1px solid var(--border);
}
</style>

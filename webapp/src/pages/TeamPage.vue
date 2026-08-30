<template>
  <div class="page-wrap container-fluid position-relative z-1 pb-page">
    <div class="page-hero">
      <div class="sparkle-row">👥 ✦ 👥</div>
      <h1>Meet the Team</h1>
      <p>Get to know the streamers behind PawketPetsVT! 🌟</p>
    </div>

    <!-- Was `.team-profiles-grid` (auto-fill minmax 350px, 24px gap). -->
    <div class="row row-cols-1 row-cols-md-2 g-4">
      <div v-for="m in MEMBERS" :key="m.name" class="col">
        <!-- Column flex + `mt-auto` on the socials keeps the stat panel and
             buttons aligned across cards in a row, however long the bio is. -->
        <div class="team-profile-card h-100 d-flex flex-column">
          <div class="team-profile-banner">
            <div class="team-profile-avatar">
              <img :src="'/images/pets/' + m.image" :alt="m.name" @error="$event.target.style.display = 'none'" />
            </div>
            <!-- Explicitly stacked: name above role. -->
            <div class="team-profile-info d-flex flex-column">
              <h2 class="team-profile-name">{{ m.name }}</h2>
              <div class="team-profile-role" :style="m.roleStyle">{{ m.role }}</div>
            </div>
          </div>

          <div class="team-profile-body flex-grow-1 d-flex flex-column">
            <p class="team-profile-bio">{{ m.bio }}</p>

            <!-- The Bootstrap row sits INSIDE the panel: `.team-profile-stats`
                 keeps the background/padding, and the row's negative gutter
                 margins would fight that padding if they shared an element. -->
            <div class="team-profile-stats mt-auto">
              <div class="row row-cols-2 g-3">
                <div v-for="s in m.stats" :key="s.label" class="team-stat">
                  <span class="team-stat-label">{{ s.label }}</span>
                  <span class="team-stat-value">{{ s.value }}</span>
                </div>
              </div>
            </div>

            <div class="team-profile-socials">
              <a v-for="s in m.socials" :key="s.platform" :href="s.url" target="_blank" class="team-social-btn"
                :class="s.platform">
                <span class="social-icon">{{ s.icon }}</span> {{ s.label }}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div class="col">
        <div class="team-profile-card team-join-card h-100">
          <div class="team-join-content">
            <div class="team-join-sparkle mb-gap">✨</div>
            <h3>Want to Join?</h3>
            <p>We're looking for VTubers to join the PawketPetsVT team!</p>
            <button class="btn btn-primary" @click="showContactModal = true">Get in Touch</button>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-overlay" :class="{ show: showContactModal }">
      <div class="modal contact-modal" v-if="showContactModal">
        <h2>📞 Contact Us</h2>
        <p>Need help or found a bug? Reach out to us!</p>
        <div class="contact-options">
          <a href="mailto:PawketPetsVT@gmail.com" class="contact-option"
            style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none;">
            <div class="contact-icon">✉️</div>
            <div class="contact-text">
              <strong style="color: white; font-size: 1.1rem;">Email Us</strong>
              <span style="color: rgba(255,255,255,0.95); font-weight: 600;">PawketPetsVT@gmail.com</span>
            </div>
          </a>
          <a href="https://discord.com/users/embertail" target="_blank" class="contact-option"
            style="background: linear-gradient(135deg, #5865F2 0%, #7289DA 100%); color: white; border: none;">
            <div class="contact-icon">💬</div>
            <div class="contact-text">
              <strong style="color: white; font-size: 1.1rem;">Discord</strong>
              <span style="color: rgba(255,255,255,0.95); font-weight: 600;">Embertail</span>
            </div>
          </a>
        </div>
        <button class="btn btn-outline" @click="showContactModal = false">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const showContactModal = ref(false)

const MEMBERS = [
  {
    name: 'Embertail', image: 'ember.png', role: '🦊 Founder & Lead Dev',
    bio: "Creator of PawketPetsVT! A brokenhearted Protogen VTuber who loves horror games, MOBAs, and building wild community projects. Twitch Partner for 11 years and counting. She/her. Probably playing something scary right now. 🔥",
    stats: [{ label: 'Streaming Since', value: '2015' }, { label: 'Favorite Game', value: 'Deadlock' }],
    socials: [
      { platform: 'twitch', url: 'https://twitch.tv/embertail', icon: '📺', label: 'Twitch' },
      { platform: 'bluesky', url: 'https://bsky.app/profile/embertail.bsky.social', icon: '🦋', label: 'Bluesky' }
    ]
  },
  {
    name: 'Pyxshuul', image: 'pyxie.png', role: '🐰 Co-Founder & Community Manager',
    bio: 'Co-creator of PawketPetsVT! A Sparkledog VTuber who brings joy and nostalgia to every stream! Loves connecting with the community and making everyone feel welcome.',
    stats: [{ label: 'Streaming Since', value: '2023' }, { label: 'Favorite Game', value: "Mama's Sleeping Angels" }],
    socials: [
      { platform: 'twitch', url: 'https://twitch.tv/pyxshuul', icon: '📺', label: 'Twitch' },
      { platform: 'bluesky', url: 'https://bsky.app/profile/pyxshuul.bsky.social', icon: '🦋', label: 'Bluesky' }
    ]
  },
  {
    name: 'Aria', image: 'aria.png', role: 'Fae Moth Collector 🦋💀',
    bio: "A quiet critter who enjoys a little adventure and a lot of whimsy. Rosy maple moth fae who collects bones (don't worry, she lets you keep yours until you're done with them!) 🦋💀",
    stats: [{ label: 'Streaming Since', value: '2026' }, { label: 'Favorite Game', value: 'Ori & The Blind Forest' }],
    socials: [
      { platform: 'twitch', url: 'https://twitch.tv/ariadoestwitch', icon: '📺', label: 'Twitch' },
      { platform: 'tiktok', url: 'https://www.tiktok.com/@ariadoeseverything', icon: '🎵', label: 'TikTok' }
    ]
  },
  {
    name: 'Blushimia', image: 'blushimia.png', role: 'Escaped Video Game Princess 👑🐕',
    bio: 'A silly dog princess who escaped her video game after gaining sentience! Breaking free from the digital realm and living her best life. 👑🐕',
    stats: [{ label: 'Streaming Since', value: '??? WIP' }, { label: 'Favorite Game', value: 'The one she escaped from' }],
    socials: [
      { platform: 'twitch', url: 'https://twitch.tv/realblushimia', icon: '📺', label: 'Twitch' },
      { platform: 'instagram', url: 'https://www.instagram.com/blushimia/', icon: '📷', label: 'Instagram' },
      { platform: 'tiktok', url: 'https://www.tiktok.com/@blushimia/', icon: '🎵', label: 'TikTok' }
    ]
  },
  {
    name: 'Steve', image: 'cowbee.png', role: 'Certified Menace 🐔⚡',
    bio: 'A chill menace who clucks, bawks, bucks, and says the occasional bad word! As chill as a fire in hell, controlled like the beasts of Australia! 🐔⚡',
    stats: [{ label: 'Streaming Since', value: '2016' }, { label: 'Favorite Game', value: 'Marvel Rivals' }],
    socials: [
      { platform: 'twitch', url: 'https://twitch.tv/cowbeevt', icon: '📺', label: 'Twitch' },
      { platform: 'bluesky', url: 'https://bsky.app/profile/cowbeevt.vtubers.social', icon: '🦋', label: 'Bluesky' }
    ]
  },
  {
    name: 'Kleat! Gremlin Kleat!', image: 'kelta.png', role: 'Grand Mage of Void & Galaxy ✨🌌',
    bio: 'Yip, Yap, teehee! A grand mage studying void and galaxy magic who can open portals to anywhere! ✨🌌',
    stats: [{ label: 'Streaming Since', value: '2022' }, { label: 'Favorite Game', value: 'Pokemon' }],
    socials: [
      { platform: 'twitch', url: 'https://twitch.tv/keltathepomeranian', icon: '📺', label: 'Twitch' },
      { platform: 'bluesky', url: 'https://bsky.app/profile/keltathepomeranian.bsky.social', icon: '🦋', label: 'Bluesky' },
      { platform: 'twitter', url: 'https://x.com/keltathepom', icon: '🐦', label: 'Twitter/X' }
    ]
  },
  {
    name: 'Gnarly', image: 'gnarly.png', role: 'PaleoPlex Arcade Operator 🎮🦖',
    bio: 'A radical gal running the PaleoPlex arcade! Loves Furbies and nachos! 🎮🦖',
    stats: [{ label: 'Streaming Since', value: '??? WIP' }, { label: 'Favorite Game', value: '??? WIP' }],
    socials: [
      { platform: 'twitch', url: 'https://twitch.tv/gnarly_neon_smilodon', icon: '📺', label: 'Twitch' },
      { platform: 'twitter', url: 'https://x.com/GnarlySmilodon', icon: '🐦', label: 'Twitter' },
      { platform: 'tiktok', url: 'https://www.tiktok.com/@gnarlyneonsmilodon', icon: '🎵', label: 'TikTok' }
    ]
  },
  {
    name: 'CypurrActive', image: 'cy.png', role: 'Cybergoth Catgirl of the Internet 🐱💜', roleStyle: 'font-size:0.78rem;',
    bio: 'Cybergoth Vtuber, Gamer, and Artist! Her consciousness was uploaded to the internet as part of a medical experiment — she streams from cyberspace while her body rests safely in stasis. 🐱💜',
    stats: [{ label: 'Streaming Since', value: '2026' }, { label: 'Favorite Game', value: 'Final Fantasy XIV' }],
    socials: [
      { platform: 'twitch', url: 'https://www.twitch.tv/cypurractive', icon: '📺', label: 'Twitch' },
      { platform: 'youtube', url: 'https://www.youtube.com/@cypurractive', icon: '▶️', label: 'YouTube' },
      { platform: 'tiktok', url: 'https://www.tiktok.com/@cypurractive', icon: '🎵', label: 'TikTok' }
    ]
  }
]
</script>

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.contact-modal { max-width: 500px; }
.contact-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 20px 0;
}
.contact-option {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  text-decoration: none;
  color: white;
  transition: all 0.2s;
}
.contact-option:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}
.contact-icon {
  font-size: 2rem;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
}
.contact-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.contact-text strong { font-size: 1.1rem; }
.contact-text span {
  font-size: 0.9rem;
  opacity: 0.9;
}
.social-icon { font-size: 1.1rem; }
.team-profile-card {
  background: white;
  border: 3px solid var(--purple-light);
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.3s;
}
.team-profile-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(176, 106, 255, 0.2);
  border-color: var(--purple);
}
.team-profile-banner {
  background: linear-gradient(135deg, var(--purple) 0%, var(--pink) 100%);
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 20px;
}
.team-profile-stats {
  margin-bottom: 20px;
  padding: 16px;
  background: var(--purple-light);
  border-radius: 12px;
}
.team-profile-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 4px solid white;
  overflow: hidden;
  background: white;
  flex-shrink: 0;
}
.team-profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.team-profile-info { flex: 1; }
.team-profile-name {
  color: white;
  font-size: 1.8rem;
  margin: 0 0 8px 0;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
}
.team-profile-role {
  color: rgba(255,255,255,0.95);
  font-size: 1rem;
  font-weight: bold;
}
.team-profile-body { padding: 24px; }
.team-profile-bio {
  color: var(--text);
  line-height: 1.6;
  margin-bottom: 20px;
}
.team-stat { text-align: center; }
.team-stat-label {
  display: block;
  font-size: 0.75rem;
  color: var(--text-light);
  text-transform: uppercase;
  margin-bottom: 4px;
}
.team-stat-value {
  display: block;
  font-size: 1.2rem;
  font-weight: bold;
  color: var(--purple-dark);
}
.team-profile-socials {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.team-social-btn {
  flex: 1;
  min-width: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 10px;
  font-weight: bold;
  text-decoration: none;
  transition: all 0.2s;
  color: white;
}
.team-social-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}
.team-social-btn.twitch { background: linear-gradient(135deg, #9146ff 0%, #772ce8 100%); }
.team-social-btn.twitter { background: linear-gradient(135deg, #1DA1F2 0%, #0d8bd9 100%); }
.team-social-btn.bluesky { background: linear-gradient(135deg, #0085ff 0%, #0066cc 100%); }
.team-social-btn.tiktok { background: linear-gradient(135deg, #25f4ee 0%, #fe2c55 100%); }
.team-social-btn.instagram { background: linear-gradient(135deg, #f58529 0%, #dd2a7b 50%, #8134af 100%); }
.team-social-btn.youtube {
  background: #FF0000;
  color: white !important;
}
.social-icon { font-size: 1.2rem; }
.team-join-card {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(176, 106, 255, 0.1) 100%);
  border: 3px dashed var(--purple-light);
  display: flex;
  align-items: center;
  justify-content: center;
}
.team-join-card:hover {
  border-color: var(--purple);
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(176, 106, 255, 0.2) 100%);
}
.team-join-content {
  text-align: center;
  padding: 40px;
}
.team-join-content h3 {
  color: var(--purple-dark);
  margin: 0 0 12px 0;
}
.team-join-content p {
  color: var(--text-light);
  margin-bottom: 20px;
}
@media (max-width: 768px) {
  .team-profile-socials { flex-direction: column; }
  .team-social-btn { width: 100%; }
}

// Was an inline style attribute on the sparkle div.
.team-join-sparkle {
  font-size: 4rem;
}
</style>

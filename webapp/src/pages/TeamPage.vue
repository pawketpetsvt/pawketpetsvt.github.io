<template>
  <div class="page-wrap">
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
            <div class="team-join-sparkle">✨</div>
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
    name: 'Jess', image: 'jess.png', role: 'Paleoart Parasaur Potion Brewer 🦕⚗️',
    bio: 'A local fossil and potion-prepping paleoart Parasaur specializing in the cute and creepy! A quiet critter who enjoys a little adventure and a lot of whimsy. 🦕⚗️',
    stats: [{ label: 'Streaming Since', value: '??? WIP' }, { label: 'Favorite Game', value: '??? WIP' }],
    socials: [
      { platform: 'twitch', url: 'https://twitch.tv/teatimejess', icon: '📺', label: 'Twitch' },
      { platform: 'twitter', url: 'https://x.com/teatimejess', icon: '🐦', label: 'Twitter' }
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
// Was an inline style attribute on the sparkle div.
.team-join-sparkle {
  font-size: 4rem;
  margin-bottom: 20px;
}
</style>

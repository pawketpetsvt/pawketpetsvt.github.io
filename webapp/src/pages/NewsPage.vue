<template>
  <div class="page-wrap container-fluid position-relative z-1 pb-page">
    <div class="page-hero"><div class="sparkle-row">📰 ✦ 📰</div><h1>News &amp; Updates</h1><p>Stay up to date! ✨</p></div>

    <div class="shop-tabs" style="margin-bottom:20px;">
      <button v-for="t in TABS" :key="t.key" class="shop-tab" :class="{ active: activeTab === t.key }" @click="switchTab(t.key)">{{ t.icon }} {{ t.label }}</button>
    </div>

    <div v-if="loading" class="spinner"></div>
    <div v-else-if="!posts.length" class="card" style="text-align:center;padding:48px 32px;">
      <div style="font-size:2.5rem;margin-bottom:12px;">📭</div>
      <p style="color:var(--text-light);font-size:1rem;">{{ emptyMessage }}</p>
    </div>
    <div v-else>
      <div v-for="post in posts" :key="post.id" class="news-post news-card">
        <div v-if="post.version" class="news-version-badge" style="display:inline-block;background:var(--purple);color:white;padding:2px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;margin-bottom:8px;">v{{ post.version }}</div>
        <div class="news-post-date news-date">{{ formatDate(post) }}</div>
        <h3>{{ post.title || 'Untitled' }}</h3>
        <p>{{ post.content || '' }}</p>
        <div v-if="post.author" class="news-author">— {{ post.author }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { newsService } from '../services/NewsService.js'

const TABS = [
  { key: 'announcements', icon: '📢', label: 'Announcements' },
  { key: 'patchnotes', icon: '🔧', label: 'Patch Notes' },
  { key: 'comingsoon', icon: '🚀', label: 'Coming Soon' }
]

const EMPTY_MESSAGES = {
  announcements: '📢 No announcements yet. Check back soon!',
  patchnotes: '🔧 No patch notes yet — still cooking!',
  comingsoon: '🚀 Nothing announced yet — stay tuned for surprises!'
}

const activeTab = ref('announcements')
const loading = ref(true)
const posts = ref([])
const loadedTabs = new Set()
const cache = {}

const emptyMessage = computed(() => EMPTY_MESSAGES[activeTab.value])

async function switchTab(tab) {
  activeTab.value = tab
  if (loadedTabs.has(tab)) {
    posts.value = cache[tab]
    return
  }
  loading.value = true
  const data = await newsService.fetchNews(tab)
  cache[tab] = data
  loadedTabs.add(tab)
  posts.value = data
  loading.value = false
}

function formatDate(post) {
  const d = new Date(post.published_at || post.created_at)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

onMounted(() => switchTab('announcements'))
</script>

<style lang="scss" scoped>
// Moved out of the root style.css (Phase 11 — style.css elimination).
// These rules are used by this component and nothing else, so they belong with
// it rather than in a shared 18,000-line file. Kept as authored except for SCSS
// nesting of `&:hover`-style variants; anything a Bootstrap utility expresses
// exactly was converted in the template instead.
.news-card {
  background: var(--white) !important;
  border: 4px solid var(--border) !important;
  border-radius: var(--radius-xl) !important;
  padding: 28px 32px !important;
  box-shadow: 0 8px 24px rgba(153,102,255,0.25) !important;
  transition: all 0.3s !important;
}
.news-card:hover {
  transform: translateY(-6px) !important;
  box-shadow: 0 14px 35px rgba(153,102,255,0.35) !important;
}
</style>

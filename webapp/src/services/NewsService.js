import { supabase } from './SupabaseService.js'

const TYPE_MAP = { announcements: 'announcement', patchnotes: 'patch_note', comingsoon: 'coming_soon' }

class NewsService {
  // Ports _loadNewsPanel(), game.js:10409-10457. "announcements" means
  // everything that ISN'T a patch note or coming-soon post; the other two
  // tabs filter by post_type directly. Falls back gracefully if the
  // post_type column doesn't exist yet (matches original behavior).
  async fetchNews(tab) {
    let query = supabase.from('news').select('*').eq('is_published', true).order('published_at', { ascending: false })
    query = tab !== 'announcements'
      ? query.eq('post_type', TYPE_MAP[tab])
      : query.not('post_type', 'in', '(patch_note,coming_soon)')

    let res = await query
    if (res.error && res.error.message && res.error.message.includes('post_type')) {
      if (tab === 'announcements') {
        res = await supabase.from('news').select('*').eq('is_published', true).order('published_at', { ascending: false })
      } else {
        return []
      }
    }
    return res.data || []
  }

  async fetchSidebarNews() {
    const res = await supabase.from('news').select('*').eq('is_published', true).order('published_at', { ascending: false }).limit(3)
    return res.data || []
  }
}

export const newsService = new NewsService()

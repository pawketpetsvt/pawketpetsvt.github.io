import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { canPerformAction } from '../utils/RateLimit.js'

export const FORUM_PAGE_SIZE = 20
const REPLY_LIMIT = 200

// Defence-in-depth, matching game.js:29979-29980/30034 — display escapes too
// (Vue's text interpolation does this automatically), but stored content is
// stripped of tags on the way in as well.
function stripTags(text) {
  return (text || '').trim().replace(/<[^>]*>/g, '')
}

class ForumService {
  // Ports initForum()'s moderator check, game.js:29613-29653.
  async loadModeratorStatus(userId) {
    const { data } = await supabase.from('forum_moderators').select('id').eq('user_id', userId).maybeSingle()
    return !!data
  }

  async isBanned(userId) {
    const { data } = await supabase.from('forum_bans').select('id').eq('user_id', userId).maybeSingle()
    return !!data
  }

  // Ports loadForumCategories(), game.js:29658-29726. Legacy fires one count
  // query per category inside the render loop (N+1); this batches all thread
  // rows in a single query and counts client-side instead.
  async loadCategories() {
    const { data: categories, error } = await supabase
      .from('forum_categories')
      .select('*')
      .order('display_order', { ascending: true })
    if (error) throw error
    if (!categories || !categories.length) return []

    const { data: threads } = await supabase.from('forum_threads').select('category_id')
    const counts = {}
    ;(threads || []).forEach(t => { counts[t.category_id] = (counts[t.category_id] || 0) + 1 })
    return categories.map(c => ({ ...c, threadCount: counts[c.id] || 0 }))
  }

  // Ports loadForumThreads(), game.js:29744-29835. Returns one page plus a
  // hasMore flag — legacy over-fetches by one row to detect "more" and then
  // renders that extra row too (an off-by-one that shows 21 rows per page);
  // this fetches the extra row purely as a probe and slices it off.
  async loadThreads(categoryId, page = 0) {
    const from = page * FORUM_PAGE_SIZE
    const { data, error } = await supabase
      .from('forum_threads')
      .select('*, players!forum_threads_author_id_fkey(username)')
      .eq('category_id', categoryId)
      .order('is_pinned', { ascending: false })
      .order('last_reply_at', { ascending: false })
      .range(from, from + FORUM_PAGE_SIZE)
    if (error) throw error

    const rows = data || []
    const hasMore = rows.length > FORUM_PAGE_SIZE
    return { threads: rows.slice(0, FORUM_PAGE_SIZE), hasMore }
  }

  // Ports showForumThread(), game.js:29840-29899.
  async loadThread(threadId) {
    await supabase.rpc('increment', { table_name: 'forum_threads', row_id: threadId, column_name: 'view_count' })

    const { data: thread, error } = await supabase
      .from('forum_threads')
      .select('*, players!forum_threads_author_id_fkey(username, forum_post_count)')
      .eq('id', threadId)
      .maybeSingle()
    if (error || !thread) throw new Error('Thread not found')

    const { data: replies } = await supabase
      .from('forum_replies')
      .select('*, players!forum_replies_author_id_fkey(username, forum_post_count)')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(REPLY_LIMIT)

    return { thread, replies: replies || [] }
  }

  // Ports submitNewThread(), game.js:29966-30014.
  async createThread(categoryId, title, content) {
    if (!canPerformAction('forum_new_thread', 5000)) throw new Error('Please slow down before creating another thread!')
    const cleanTitle = stripTags(title)
    const cleanContent = stripTags(content)
    if (!cleanTitle || !cleanContent) throw new Error('Please fill in both title and message!')
    if (await this.isBanned(AppState.user.id)) throw new Error('You are banned from posting')

    const { error } = await supabase.from('forum_threads').insert([{
      category_id: categoryId,
      author_id: AppState.user.id,
      title: cleanTitle,
      content: cleanContent
    }])
    if (error) throw error
  }

  // Ports submitReply(), game.js:30019-30066.
  async createReply(threadId, content) {
    if (!canPerformAction('forum_reply', 3000)) throw new Error('Please slow down before posting again!')
    const clean = stripTags(content)
    if (!clean) throw new Error('Please write a reply!')
    if (await this.isBanned(AppState.user.id)) throw new Error('You are banned from posting')

    const { error } = await supabase.from('forum_replies').insert([{
      thread_id: threadId,
      author_id: AppState.user.id,
      content: clean
    }])
    if (error) throw error
  }

  // Ports deleteForumPost(), game.js:30071-30126 — WITH the moderator bug
  // fixed (Phase 6 scope decision). Legacy showed the delete button to
  // moderators but then hard-blocked on authorship and scoped the delete
  // `.eq('author_id', currentUser.id)`, so a moderator deleting someone
  // else's post hit a wrong "you can only delete your own posts" error and
  // silently no-oped. Moderators may now delete any post; everyone else is
  // still restricted to their own (and RLS remains the real enforcement).
  async deletePost(postId, postType, isModerator) {
    const table = postType === 'thread' ? 'forum_threads' : 'forum_replies'
    if (!isModerator) {
      const { data } = await supabase.from(table).select('author_id').eq('id', postId).maybeSingle()
      if (data && data.author_id !== AppState.user.id) throw new Error('You can only delete your own posts.')
    }

    let query = supabase.from(table).delete().eq('id', postId)
    if (!isModerator) query = query.eq('author_id', AppState.user.id)
    const { error } = await query
    if (error) throw new Error('Error deleting ' + postType)
  }

  async setPinned(threadId, pinned) {
    const { error } = await supabase.from('forum_threads').update({ is_pinned: pinned }).eq('id', threadId)
    if (error) throw new Error('Error updating thread')
  }

  async setLocked(threadId, locked) {
    const { error } = await supabase.from('forum_threads').update({ is_locked: locked }).eq('id', threadId)
    if (error) throw new Error('Error updating thread')
  }

  // Ports loadBannedUsers()/banUser()/unbanUser(), game.js:30216-30305.
  async loadBans() {
    const { data } = await supabase
      .from('forum_bans')
      .select('*, players!forum_bans_user_id_fkey(username)')
      .order('banned_at', { ascending: false })
    return data || []
  }

  async banUser(username, reason) {
    const name = (username || '').trim()
    if (!name) throw new Error('Enter a username')
    const { data: user } = await supabase.from('players').select('id').eq('username', name).maybeSingle()
    if (!user) throw new Error('User not found')

    const { error } = await supabase.from('forum_bans').insert([{
      user_id: user.id,
      banned_by: AppState.user.id,
      reason: (reason || '').trim() || null
    }])
    if (error) throw new Error('Error banning user: ' + error.message)
  }

  async unbanUser(userId) {
    const { error } = await supabase.from('forum_bans').delete().eq('user_id', userId)
    if (error) throw new Error('Error unbanning user')
  }

  // Ports loadRecentPosts(), game.js:30310-30342.
  async loadRecentThreads() {
    const { data } = await supabase
      .from('forum_threads')
      .select('*, players!forum_threads_author_id_fkey(username)')
      .order('created_at', { ascending: false })
      .limit(10)
    return data || []
  }
}

export const forumService = new ForumService()

import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { canPerformAction } from '../utils/RateLimit.js'

export const GUESTBOOK_PAGE_SIZE = 10
export const GUESTBOOK_MAX_LENGTH = 500

class GuestbookService {
  // Ports loadGuestbookEntries(), game.js:21708-21783. Pagination is caller-
  // driven (offset in, one page out) rather than legacy's module-level
  // _guestbookOffset globals.
  async loadEntries(profileUserId, offset = 0) {
    const { data, error } = await supabase
      .from('guestbook_entries')
      .select('id, author_id, message, created_at, players!guestbook_entries_author_id_fkey(username)')
      .eq('profile_user_id', profileUserId)
      .order('created_at', { ascending: false })
      .range(offset, offset + GUESTBOOK_PAGE_SIZE - 1)
    if (error) throw error

    const myId = AppState.user ? AppState.user.id : null
    return (data || []).map(entry => ({
      id: entry.id,
      authorId: entry.author_id,
      authorName: entry.players ? entry.players.username : 'Unknown User',
      message: entry.message,
      createdAt: entry.created_at,
      // Author OR profile owner can delete — profile owners moderate their
      // own guestbook (game.js:21741).
      canDelete: !!myId && (entry.author_id === myId || profileUserId === myId)
    }))
  }

  // Ports postGuestbookMessage(), game.js:21653-21695. Per the Phase 6 scope
  // decision, guestbook messages are deliberately NOT profanity-filtered —
  // matching legacy, unlike username/bio which are.
  async post(profileUserId, message) {
    if (!canPerformAction('guestbook_post', 2000)) throw new Error('Please wait before posting again!')
    const text = (message || '').trim()
    if (!text) throw new Error('Please enter a message')
    if (text.length > GUESTBOOK_MAX_LENGTH) throw new Error('Message is too long (max ' + GUESTBOOK_MAX_LENGTH + ' characters)')

    const { error } = await supabase.from('guestbook_entries').insert([{
      profile_user_id: profileUserId,
      author_id: AppState.user.id,
      message: text
    }])
    if (error) throw error
  }

  // Ports deleteGuestbookEntry(), game.js:21786-21811 — relies on RLS to
  // reject unauthorized deletes rather than re-checking ownership client-side.
  async remove(entryId) {
    const { error } = await supabase.from('guestbook_entries').delete().eq('id', entryId)
    if (error) throw new Error('You can only delete your own messages, or messages on your profile.')
  }
}

export const guestbookService = new GuestbookService()

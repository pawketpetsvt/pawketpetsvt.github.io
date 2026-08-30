import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'

// Ports getNotificationIcon()'s switch, game.js:22174-22198.
const ICONS = {
  friend_request: '👥',
  friend_accepted: '✅',
  guestbook_message: '📝',
  badge_earned: '🎖️',
  level_up: '⭐',
  pet_hungry: '🍽️',
  pet_needs_attention: '💔',
  pet_evolved: '✨',
  pet_birthday: '🎂',
  variant_unlocked: '🌈',
  battle_victory: '⚔️',
  daily_reward: '🎁',
  event_started: '🎉',
  referral_reward: '💰',
  grand_prix_results: '🏁',
  grand_prix_claimed: '🏆',
  grand_prix_overtaken: '📉',
  guild_vote_passed: '✅',
  guild_vote_failed: '📋',
  gift_received: '🎁',
  melon_message: '🍉',
  twitch_reward: '🎬'
}

class NotificationService {
  async refreshBadge(userId) {
    if (!userId) return
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('is_read', false)
      if (error) throw error
      AppState.unreadNotificationCount = data ? data.length : 0
    } catch (err) {
      // Silently ignore — intermittent network hiccups shouldn't flood the console
    }
  }

  async loadRecent(userId) {
    if (!userId) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    AppState.notifications = data || []
  }

  async markAllRead(userId) {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
    AppState.notifications.forEach(n => { n.is_read = true })
    AppState.unreadNotificationCount = 0
  }

  // Ports markNotificationRead(), game.js:22224-22233 — single-item version
  // of markAllRead, used when a notification is clicked rather than the
  // dropdown's "Mark all read" button.
  async markRead(id) {
    const n = AppState.notifications.find(x => x.id === id)
    if (n && n.is_read) return
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    if (n) n.is_read = true
    if (AppState.unreadNotificationCount > 0) AppState.unreadNotificationCount--
  }

  // Ports getNotificationIcon(), game.js:22174-22198.
  getIcon(type) {
    return ICONS[type] || '🔔'
  }

  // Ports the link-parsing half of handleNotificationClick(), game.js:22201-22217.
  // Returns { kind: 'tab'|'profile', value } or null for an empty/unrecognized link.
  resolveLink(link) {
    if (!link) return null
    if (link.startsWith('tab:')) return { kind: 'tab', value: link.slice(4) }
    if (link.startsWith('profile:')) return { kind: 'profile', value: link.slice(8) }
    // Gift notifications. Legacy links them to '/gifts', a path that has never
    // existed — the gift inbox is a modal, not a route — so clicking one did
    // nothing. Emitted as 'gift:inbox' now and handled by the bell.
    if (link.startsWith('gift:')) return { kind: 'gift', value: link.slice(5) }
    return null
  }

  async create(userId, type, title, message, link, fromUserId) {
    try {
      const rpcRes = await supabase.rpc('create_notification_secure', {
        p_user_id: userId,
        p_type: type,
        p_title: title,
        p_message: message,
        p_link: link || null,
        p_from_user_id: fromUserId || null
      })
      if (rpcRes.error) {
        if (rpcRes.error.code === 'PGRST202' || String(rpcRes.error.code) === '404') {
          const insertRes = await supabase.from('notifications').insert([{
            user_id: userId, type, title, message, link: link || null, from_user_id: fromUserId || null
          }])
          if (insertRes.error) console.error('[notificationService.create] fallback insert failed:', insertRes.error)
        } else {
          // Previously swallowed silently for any error code other than
          // "function not found" — e.g. an ambiguous-overload or permission
          // error would fail with zero visibility into why.
          console.error('[notificationService.create] create_notification_secure RPC failed:', rpcRes.error)
        }
      }
    } catch (err) {
      console.error('Error creating notification:', err)
    }
  }
}

export const notificationService = new NotificationService()

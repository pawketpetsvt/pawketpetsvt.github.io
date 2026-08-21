import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'

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
      if (rpcRes.error && (rpcRes.error.code === 'PGRST202' || String(rpcRes.error.code) === '404')) {
        await supabase.from('notifications').insert([{
          user_id: userId, type, title, message, link: link || null, from_user_id: fromUserId || null
        }])
      }
    } catch (err) {
      console.error('Error creating notification:', err)
    }
  }
}

export const notificationService = new NotificationService()

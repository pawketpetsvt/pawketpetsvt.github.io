import { reactive } from 'vue'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { notificationService } from './NotificationService.js'
import { PLAYER_TITLE_UNLOCKS } from '../data/playerTitleUnlocks.js'

// Ports awardBadge() / loadUserBadges() (game.js:3174-3288) and
// awardPlayerTitle() / loadPlayerTitles() / checkPlayerTitleUnlocks()
// (game.js:8389-8664).
//
// This is the AWARDING half. The reading half (profile badge grid, title
// picker) already shipped in Phase 6 via ProfileService — nothing there
// changes; this is what finally makes those surfaces fill up.
//
// Every phase from 3 onward deferred "award a badge / grant a title" hooks into
// this service. Its arrival is what closes them.
export const awardState = reactive({
  badges: [],      // badge_key[]
  titles: [],      // title_key[]
  loaded: false
})

// Queue of things to celebrate, drained by UnlockCelebration.vue.
export const celebrationQueue = reactive({ items: [] })

class AwardService {
  async load() {
    if (!AppState.user) return
    try {
      const [badgeRes, titleRes] = await Promise.all([
        supabase.from('user_badges')
          .select('badge_id, badges(badge_key)')
          .eq('user_id', AppState.user.id),
        supabase.from('user_player_titles')
          .select('player_title_id, player_titles(title_key)')
          .eq('user_id', AppState.user.id)
      ])
      awardState.badges = (badgeRes.data || [])
        .map(b => b.badges && b.badges.badge_key).filter(Boolean)
      awardState.titles = (titleRes.data || [])
        .map(t => t.player_titles && t.player_titles.title_key).filter(Boolean)
      awardState.loaded = true
    } catch (e) {
      console.error('[awards] load failed:', e)
    }
  }

  hasBadge(key) { return awardState.badges.includes(key) }
  hasTitle(key) { return awardState.titles.includes(key) }

  // ── Badges ────────────────────────────────────────────────────────────────
  // Never throws: a badge is always a side effect of some other action, and
  // failing to grant one must not fail that action.
  async awardBadge(badgeKey) {
    if (!AppState.user || !badgeKey) return null
    if (this.hasBadge(badgeKey)) return null

    try {
      const { data: badge } = await supabase
        .from('badges').select('*').eq('badge_key', badgeKey).maybeSingle()
      if (!badge) return null

      // Re-check against the DB immediately before inserting. Legacy added this
      // because two near-simultaneous awardBadge() calls both passed the
      // in-memory check and collided with a 409.
      const { data: existing } = await supabase
        .from('user_badges').select('id')
        .eq('user_id', AppState.user.id).eq('badge_id', badge.id).maybeSingle()
      if (existing) {
        if (!this.hasBadge(badgeKey)) awardState.badges.push(badgeKey)
        return null
      }

      const { error } = await supabase.from('user_badges')
        .insert([{ user_id: AppState.user.id, badge_id: badge.id }])
      if (error) {
        // A tighter race can still lose; treat the unique violation as success.
        if (error.code === '23505') {
          if (!this.hasBadge(badgeKey)) awardState.badges.push(badgeKey)
          return null
        }
        console.error('[awards] badge insert failed:', error)
        return null
      }

      awardState.badges.push(badgeKey)
      celebrationQueue.items.push({ kind: 'badge', badge })
      this._logActivity('badge_earned', { badge_name: badge.name, badge_icon: badge.icon })
      this._notifyFriends(
        'badge_earned',
        'Badge Earned! ' + (badge.icon || '🎖️'),
        `${AppState.player?.username || 'Someone'} just earned the ${badge.name}! ${badge.icon || '🎖️'}`
      )
      return badge
    } catch (e) {
      console.error('[awards] awardBadge threw:', e)
      return null
    }
  }

  // ── Player titles ─────────────────────────────────────────────────────────
  async awardPlayerTitle(titleKey, reason) {
    if (!AppState.user || !titleKey) return null
    if (this.hasTitle(titleKey)) return null

    try {
      const { data: title } = await supabase
        .from('player_titles').select('*').eq('title_key', titleKey).maybeSingle()
      if (!title) return null

      const { error } = await supabase.from('user_player_titles').insert([{
        user_id: AppState.user.id,
        player_title_id: title.id,
        unlock_reason: reason || 'Achievement unlocked'
      }])
      if (error) {
        // Legacy logged and returned on ANY error including the duplicate-key
        // case, which is the normal outcome of a race. Handled quietly here.
        if (error.code !== '23505') console.error('[awards] title insert failed:', error)
        if (!this.hasTitle(titleKey)) awardState.titles.push(titleKey)
        return null
      }

      awardState.titles.push(titleKey)
      celebrationQueue.items.push({ kind: 'title', title, reason })
      this._logActivity('title_unlocked', { title_name: title.display_name || titleKey })
      return title
    } catch (e) {
      console.error('[awards] awardPlayerTitle threw:', e)
      return null
    }
  }

  // Ports checkPlayerTitleUnlocks(). Reads the denormalised counters on
  // `players` rather than joining battle_history, which legacy notes is far too
  // slow. Called after login and after anything that moves one of these numbers.
  async checkTitleUnlocks() {
    if (!AppState.user) return
    try {
      const uid = AppState.user.id
      const [{ data: p }, petsRes, friendsRes] = await Promise.all([
        supabase.from('players')
          .select('battles_won, total_battles, total_pp_earned, login_streak, referral_count')
          .eq('id', uid).maybeSingle(),
        supabase.from('user_pets').select('level').eq('user_id', uid),
        supabase.from('friendships').select('id', { count: 'exact', head: true })
          .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`).eq('status', 'accepted')
      ])
      if (!p) return

      const pets = petsRes.data || []
      const stats = {
        wins: p.battles_won || 0,
        battles: p.total_battles || 0,
        ppEarned: p.total_pp_earned || 0,
        streak: p.login_streak || 0,
        refs: p.referral_count || 0,
        ownedPets: pets.length,
        totalLevel: pets.reduce((s, x) => s + (x.level || 1), 0),
        friendCount: friendsRes.count || 0
      }

      for (const rule of PLAYER_TITLE_UNLOCKS) {
        if ((stats[rule.stat] || 0) >= rule.min && !this.hasTitle(rule.key)) {
          await this.awardPlayerTitle(rule.key)
        }
      }
    } catch (e) {
      console.error('[awards] title unlock check failed:', e)
    }
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  async _logActivity(type, data) {
    try {
      await supabase.from('activity_feed').insert([{
        user_id: AppState.user.id,
        activity_type: type,
        activity_data: data,
        is_public: true
      }])
    } catch {
      // Activity logging is decorative; never surface a failure.
    }
  }

  // Legacy sent these itself rather than relying on the DB trigger, whose
  // message is generic — the note in game.js says so explicitly.
  async _notifyFriends(type, title, message) {
    try {
      const uid = AppState.user.id
      const { data: friendships } = await supabase
        .from('friendships').select('requester_id, addressee_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`)
      for (const f of friendships || []) {
        const friendId = f.requester_id === uid ? f.addressee_id : f.requester_id
        notificationService.create(friendId, type, title, message, null, uid).catch(() => {})
      }
    } catch {
      // Same — a friend not hearing about a badge is not worth an error.
    }
  }
}

export const awardService = new AwardService()

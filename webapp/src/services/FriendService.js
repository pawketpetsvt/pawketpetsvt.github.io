import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { notificationService } from './NotificationService.js'
import { FriendProfile } from '../models/FriendProfile.js'
import { FriendRequest } from '../models/FriendRequest.js'
import { BlockedUser } from '../models/BlockedUser.js'

// Attaches pet-level totals and badge counts to a list of player rows,
// matching the stat rollups every Friends-tab query performs (see
// loadFriendsList/loadFriendRequests, game.js:19679-19704/19756-19777).
async function attachStats(players) {
  const ids = players.map(p => p.id)
  if (!ids.length) return players
  const [petsRes, badgesRes] = await Promise.all([
    supabase.from('user_pets').select('user_id, level').in('user_id', ids),
    supabase.from('user_badges').select('user_id').in('user_id', ids)
  ])
  const pets = petsRes.data || []
  const badges = badgesRes.data || []
  players.forEach(p => {
    p.petCount = pets.filter(x => x.user_id === p.id).length
    p.totalLevel = pets.filter(x => x.user_id === p.id).reduce((sum, x) => sum + (x.level || 0), 0)
    p.badgeCount = badges.filter(x => x.user_id === p.id).length
  })
  return players
}

class FriendService {
  // Ports updateFriendRequestBadge()'s count query, game.js:19580-19617.
  async refreshRequestCount(userId) {
    if (!userId) return
    const { data } = await supabase.from('friendships').select('id').eq('addressee_id', userId).eq('status', 'pending')
    AppState.friendRequestCount = data ? data.length : 0
  }

  // Ports loadFriendsList(), game.js:19644-19722.
  async loadFriendsList(userId) {
    const { data: friendships, error } = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id')
      .eq('status', 'accepted')
      .or('requester_id.eq.' + userId + ',addressee_id.eq.' + userId)
    if (error || !friendships || !friendships.length) return []

    const friendIds = friendships.map(f => (f.requester_id === userId ? f.addressee_id : f.requester_id))
    const { data: friends } = await supabase.from('players').select('id, username, pawketpoints, last_login').in('id', friendIds)
    if (!friends) return []
    await attachStats(friends)

    friends.forEach(f => {
      const fs = friendships.find(x => x.requester_id === f.id || x.addressee_id === f.id)
      f.friendshipId = fs ? fs.id : ''
    })
    friends.sort((a, b) => (b.pawketpoints || 0) - (a.pawketpoints || 0))
    return friends.map(f => new FriendProfile(f))
  }

  // Ports loadFriendRequests(), game.js:19725-19792.
  async loadFriendRequests(userId) {
    const { data: requests, error } = await supabase
      .from('friendships')
      .select('id, requester_id, created_at')
      .eq('addressee_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (error || !requests || !requests.length) return []

    const requesterIds = requests.map(r => r.requester_id)
    const { data: requesters } = await supabase.from('players').select('id, username, pawketpoints').in('id', requesterIds)
    if (!requesters) return []
    await attachStats(requesters)

    requesters.forEach(r => {
      const req = requests.find(x => x.requester_id === r.id)
      r.friendshipId = req ? req.id : ''
    })
    return requesters.map(r => new FriendRequest(r))
  }

  // Ports loadBlockedUsers(), game.js:19795-19844.
  async loadBlockedUsers(userId) {
    const { data: blocks, error } = await supabase
      .from('blocked_users')
      .select('id, blocked_user_id, created_at')
      .eq('blocker_id', userId)
      .order('created_at', { ascending: false })
    if (error || !blocks || !blocks.length) return []

    const blockedIds = blocks.map(b => b.blocked_user_id)
    const { data: users } = await supabase.from('players').select('id, username').in('id', blockedIds)
    if (!users) return []
    users.forEach(u => {
      const b = blocks.find(x => x.blocked_user_id === u.id)
      u.blockId = b ? b.id : ''
    })
    return users.map(u => new BlockedUser(u))
  }

  // Ports searchPlayers(), game.js:19907-19968. Returns plain annotated rows
  // (not a model) since the search-result shape — friendshipStatus/isSelf —
  // is UI-decision data, not really a "profile" the rest of the app reuses.
  async searchPlayers(query, userId) {
    const trimmed = query.trim()
    if (!trimmed) return []
    const { data: players, error } = await supabase
      .from('players')
      .select('id, username, pawketpoints')
      .ilike('username', '%' + trimmed + '%')
      .limit(5)
    if (error || !players) return []
    await attachStats(players)

    const playerIds = players.map(p => p.id)
    const { data: friendships } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id, status')
      .or('requester_id.eq.' + userId + ',addressee_id.eq.' + userId)
      .in('requester_id', playerIds.concat([userId]))
      .in('addressee_id', playerIds.concat([userId]))

    players.forEach(p => {
      const fs = (friendships || []).find(
        f => (f.requester_id === userId && f.addressee_id === p.id) || (f.addressee_id === userId && f.requester_id === p.id)
      )
      p.friendshipStatus = fs ? fs.status : null
      p.isSelf = p.id === userId
    })
    return players
  }

  // Ports sendFriendRequestToUser()/sendFriendRequest() — unified into one
  // path so every entry point (search results included) notifies the
  // recipient, closing the inconsistency noted at game.js:20010-20031 where
  // the search path never called createNotification. Uses the "superset"
  // notification copy from the monkey-patched version at game.js:28154-28188.
  async sendFriendRequest(targetUserId, myUsername) {
    const { data: existing } = await supabase
      .from('friendships')
      .select('id, status')
      .or('and(requester_id.eq.' + AppState.user.id + ',addressee_id.eq.' + targetUserId + '),and(requester_id.eq.' + targetUserId + ',addressee_id.eq.' + AppState.user.id + ')')
      .maybeSingle()
    if (existing) {
      throw new Error(existing.status === 'accepted' ? 'You are already friends!' : 'Friend request already sent!')
    }

    const { error } = await supabase.from('friendships').insert([{ requester_id: AppState.user.id, addressee_id: targetUserId, status: 'pending' }])
    if (error) throw error

    await notificationService.create(targetUserId, 'friend_request', '👋 Friend Request', (myUsername || 'Someone') + ' sent you a friend request!', 'tab:friends', AppState.user.id)
  }

  // Ports the active (monkey-patched) acceptFriendRequest(), game.js:28192-28234.
  async acceptFriendRequest(friendshipId, requesterId, myUsername) {
    const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
    if (error) throw error

    await notificationService.create(requesterId, 'friend_accepted', 'Friend Request Accepted!', (myUsername || 'Someone') + ' accepted your friend request!', 'tab:friends', AppState.user.id)
    await this.refreshRequestCount(AppState.user.id)
  }

  // Ports declineFriendRequest(), game.js:20117-20134.
  async declineFriendRequest(friendshipId) {
    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
    if (error) throw error
    await this.refreshRequestCount(AppState.user.id)
  }

  // Ports removeFriendById(), game.js:20143-20159.
  async removeFriend(friendshipId) {
    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
    if (error) throw error
  }

  // Ports unblockById(), game.js:20240-20256.
  async unblockUser(blockId) {
    const { error } = await supabase.from('blocked_users').delete().eq('id', blockId)
    if (error) throw error
  }

  // Ports loadFriendActivities() + formatActivityMessage(), game.js:21900-22056.
  // Returns pre-formatted message strings — LeftSidebar just rotates through them.
  async loadFriendActivity(userId) {
    const { data: friendships } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or('requester_id.eq.' + userId + ',addressee_id.eq.' + userId)
    if (!friendships || !friendships.length) return []

    const friendIds = friendships.map(f => (f.requester_id === userId ? f.addressee_id : f.requester_id))
    const { data: activities } = await supabase
      .from('activity_feed')
      .select('*, players(username)')
      .in('user_id', friendIds)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(50)
    if (!activities) return []

    return activities.map(a => formatActivityMessage(a, a.players ? a.players.username : 'Someone'))
  }
}

function formatActivityMessage(activity, username) {
  const type = activity.activity_type
  const data = activity.activity_data || {}
  switch (type) {
    case 'badge_earned':
      return username + ' just earned the ' + (data.badge_name || 'Badge') + '! ' + (data.badge_icon || '🎖️')
    case 'level_up':
      return username + "'s " + (data.pet_name || 'their pet') + ' just hit level ' + (data.level || '?') + '! 🎉'
    case 'pet_adopted':
      return username + ' just adopted ' + (data.pet_name || 'a new pet') + '! 🐾'
    case 'pet_fainted':
      return (data.pet_name || 'Their pet') + ' fainted in battle against ' + (data.enemy || 'an enemy') + '... 😢'
    case 'achievement_unlocked':
      return username + ' unlocked: ' + (data.achievement_name || 'Achievement') + '! ⭐'
    case 'title_unlocked':
      return username + ' unlocked the title "' + (data.title_name || 'a new title') + '"! 👑'
    case 'battle_victory':
      return username + ' defeated ' + (data.enemy_name || 'an enemy') + '! ⚔️'
    case 'boss_defeated':
      return username + ' defeated ' + (data.boss_name || 'a boss') + '! 💀🎉'
    default:
      return username + ' did something cool! ✨'
  }
}

export const friendService = new FriendService()

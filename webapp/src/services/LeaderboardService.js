import { supabase } from './SupabaseService.js'
import { LeaderboardEntry } from '../models/LeaderboardEntry.js'
import { getTimeAgo } from '../utils/timeAgo.js'

class LeaderboardService {
  // Ports the 'points' branch of loadLeaderboard(), game.js:11463-11484.
  async loadPoints() {
    const { data, error } = await supabase.from('players').select('id, username, pawketpoints').order('pawketpoints', { ascending: false }).limit(10)
    if (error || !data) return []
    return data
      .filter(p => p.username != null)
      .map(p => new LeaderboardEntry({ id: p.id, username: p.username, value: p.pawketpoints + ' PP', stat: p.pawketpoints + ' PawketPoints' }))
  }

  // Ports the 'streak' branch, game.js:11486-11528. Tries the RPC first,
  // falls back to a direct query (RPC deployment isn't verifiable from this
  // migration session — see pawketpets-supabase-migrations memory).
  // Returns { entries, myStreak, myRank } so the page can render the
  // "Your Streak" widget (streak is the only category that has one).
  async loadStreak(userId) {
    let rows
    const rpcRes = await supabase.rpc('get_streak_leaderboard', { limit_count: 10 })
    if (rpcRes.error) {
      const fallback = await supabase
        .from('players')
        .select('id, username, login_streak, last_login')
        .not('username', 'is', null)
        .order('login_streak', { ascending: false })
        .order('last_login', { ascending: false })
        .limit(10)
      rows = fallback.data || []
    } else {
      rows = rpcRes.data || []
    }

    const entries = rows
      .filter(p => p.username)
      .map(p => {
        const streak = p.login_streak || 0
        const icon = streak >= 30 ? '💎' : streak >= 7 ? '🔥' : '📅'
        return new LeaderboardEntry({
          id: p.id,
          username: p.username,
          value: icon + ' ' + streak + (streak === 1 ? ' day' : ' days'),
          stat: p.last_login ? getTimeAgo(new Date(p.last_login)) : 'Never'
        })
      })

    let myStreak = 0
    let myRank = null
    if (userId) {
      const myRes = await supabase.from('players').select('login_streak').eq('id', userId).maybeSingle()
      myStreak = (myRes.data && myRes.data.login_streak) || 0
      const idx = entries.findIndex(e => e.userId === userId)
      myRank = idx >= 0 ? idx + 1 : null
    }
    return { entries, myStreak, myRank }
  }

  // Ports the 'levels' branch, game.js:11530-11566.
  async loadLevels() {
    const res = await supabase.rpc('get_leaderboard_levels')
    if (!res.error && res.data) {
      return res.data.map(p => new LeaderboardEntry({ id: p.id, username: p.username, value: 'Lvl ' + p.total_level, stat: 'Total level: ' + p.total_level }))
    }
    const levelsRes = await supabase.from('user_pets').select('user_id, level, players(username)')
    if (levelsRes.error || !levelsRes.data) return []
    const totals = {}
    levelsRes.data.forEach(pet => {
      const username = pet.players ? pet.players.username : null
      if (!username) return
      totals[username] = (totals[username] || 0) + (pet.level || 0)
    })
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([username, level]) => new LeaderboardEntry({ username, value: 'Lvl ' + level, stat: 'Total level: ' + level }))
  }

  // Ports the 'badges' branch, game.js:11569-11604 — no RPC, pure client
  // aggregation, matching the legacy implementation as-is.
  async loadBadges() {
    const badgesRes = await supabase.from('user_badges').select('user_id')
    if (badgesRes.error || !badgesRes.data) return []
    const counts = {}
    badgesRes.data.forEach(b => { counts[b.user_id] = (counts[b.user_id] || 0) + 1 })
    const userIds = Object.keys(counts)
    if (!userIds.length) return []
    const usersRes = await supabase.from('players').select('id, username').in('id', userIds)
    if (usersRes.error || !usersRes.data) return []
    return usersRes.data
      .map(u => ({ user: u, count: counts[u.id] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(({ user, count }) => new LeaderboardEntry({ id: user.id, username: user.username, value: count + ' badges', stat: count + ' badges earned' }))
  }
}

export const leaderboardService = new LeaderboardService()

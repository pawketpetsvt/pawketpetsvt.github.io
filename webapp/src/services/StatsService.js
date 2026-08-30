import { supabase } from './SupabaseService.js'

// Labels for the community section, ported from loadStatsPage()'s
// globalStatLabels (game.js:33414-33424).
const GLOBAL_STAT_LABELS = {
  total_pets_adopted: '🐾 Total Pets Adopted',
  total_battles_won: '⚔️ Total Battles Won',
  total_bosses_slain: '👑 Total Bosses Slain',
  total_enemies_defeated: '🎯 Total Enemies Defeated',
  total_pp_earned: '🪙 Total PP Earned',
  total_items_purchased: '🛒 Total Items Purchased',
  total_minigames_played: '🎮 Total Minigames Played',
  mushrooms_defeated: '🍄 Mushrooms Defeated',
  spoon_weapon_equips: '🥄 Spoon Weapons Equipped'
}

class StatsService {
  // Personal stats are computed from live tables rather than read from the
  // `player_stats` table that loadStatsPage() (game.js:33369, dead code) was
  // written against. That table is fed only by trackStat(), which in the
  // entire legacy codebase is called from exactly one place (equipment
  // purchases) — so reading it would render zeros for almost every row.
  // Every number below comes from data that actually exists today.
  async loadPersonalStats(userId) {
    const [playerRes, petsRes, badgesRes, fishRes, claimsRes, friendsRes, invRes] = await Promise.all([
      supabase.from('players').select('*').eq('id', userId).maybeSingle(),
      supabase.from('user_pets').select('level').eq('user_id', userId),
      supabase.from('user_badges').select('badge_id').eq('user_id', userId),
      supabase.from('user_fish_collection').select('fish_id, catch_count').eq('user_id', userId),
      supabase.from('game_claims').select('claim_key').eq('user_id', userId),
      supabase.from('friendships').select('id').eq('status', 'accepted').or('requester_id.eq.' + userId + ',addressee_id.eq.' + userId),
      supabase.from('user_inventory').select('quantity').eq('user_id', userId)
    ])

    const p = playerRes.data || {}
    const pets = petsRes.data || []
    const fish = fishRes.data || []
    const claims = claimsRes.data || []
    const inv = invRes.data || []

    const battlesWon = p.battles_won || 0
    const totalBattles = p.total_battles || 0
    const winRate = totalBattles > 0 ? Math.round((battlesWon / totalBattles) * 100) : 0

    return {
      memberSince: p.created_at ? new Date(p.created_at).toLocaleDateString() : 'N/A',
      cards: [
        { icon: '🐾', label: 'Pets Adopted', value: pets.length },
        { icon: '⭐', label: 'Total Pet Levels', value: pets.reduce((s, x) => s + (x.level || 0), 0) },
        { icon: '⬆️', label: 'Highest Pet Level', value: pets.length ? Math.max(...pets.map(x => x.level || 0)) : 0 },
        { icon: '🪙', label: 'PawketPoints Earned', value: p.total_pp_earned || 0 },
        { icon: '💰', label: 'Current PawketPoints', value: p.pawketpoints || 0 },
        { icon: '⚔️', label: 'Battles Won', value: battlesWon, sub: totalBattles ? battlesWon + '/' + totalBattles + ' (' + winRate + '%)' : 'No battles yet' },
        { icon: '🔥', label: 'Day Login Streak', value: p.login_streak || 0 },
        { icon: '🎖️', label: 'Badges Earned', value: (badgesRes.data || []).length },
        { icon: '🐟', label: 'Fish Species Found', value: fish.length },
        { icon: '🎣', label: 'Total Fish Caught', value: fish.reduce((s, x) => s + (x.catch_count || 0), 0) },
        { icon: '🎮', label: 'Minigame Rewards Claimed', value: claims.length },
        { icon: '👥', label: 'Friends', value: (friendsRes.data || []).length },
        { icon: '🎒', label: 'Items Held', value: inv.reduce((s, x) => s + (x.quantity || 0), 0) },
        { icon: '🤝', label: 'Referrals', value: p.referral_count || 0 }
      ]
    }
  }

  // Ports getGlobalStats(), game.js:33346-33364. Only some keys are actually
  // written to today (total_pets_adopted / total_battles_won /
  // total_bosses_slain, via ad hoc increment_global_stat calls in game.js) —
  // the rest read as 0 until their systems are migrated, same graceful
  // degradation as Phase 4's weather-gated fish.
  async loadCommunityStats() {
    const { data, error } = await supabase.from('global_stats').select('stat_key, stat_value')
    if (error) return []
    const values = {}
    ;(data || []).forEach(s => { values[s.stat_key] = s.stat_value })
    return Object.entries(GLOBAL_STAT_LABELS).map(([key, label]) => ({
      key,
      label,
      value: values[key] || 0
    }))
  }
}

export const statsService = new StatsService()

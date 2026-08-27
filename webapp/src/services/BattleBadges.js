import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { awardService } from './AwardService.js'

// The badge and title awards legacy fires from manualBattle_endBattle() and
// saveBattleHistory() (main:16260+ / main:19940+). Kept out of BattleService so
// the turn loop stays readable and the smoke suite doesn't have to stub any of
// it — BattleService calls this once, from endBattle, and never awaits it.

// Ten wins in a zone earns its badge.
const ZONE_BADGE_10 = {
  outskirts: 'battle_outskirts_10',
  glade: 'battle_glade_10',
  deepwoods: 'battle_deepwoods_10',
  ruins: 'battle_ruins_10'
}

const WIN_MILESTONES = [
  { wins: 1, badge: 'battle_first_win' },
  { wins: 25, badge: 'battle_25_wins' },
  { wins: 100, badge: 'battle_100_wins' },
  { wins: 500, badge: 'battle_500_wins' }
]

// Awards everything a won battle earns. Never throws.
export async function awardBattleBadges(s) {
  if (!AppState.user) return
  try {
    await awardService.awardBadge('battle_first_win')

    // Per-battle performance badges, read off the counters battleState keeps.
    if (s.turn <= 3) await awardService.awardBadge('battle_speed_demon')
    if (s.totalDamageTaken < 10) await awardService.awardBadge('battle_iron_wall')
    if (s.totalDamageTaken === 0) await awardService.awardBadge('battle_untouchable')
    if (s.playerHP > 0 && (s.playerHP / s.playerMaxHP) < 0.10) {
      await awardService.awardBadge('battle_comeback')
    }
    if ((s.uniqueStatusesApplied || []).length >= 3) {
      await awardService.awardBadge('battle_status_master')
    }
    if ((s.skillsUsedThisBattle || []).length >= 3) {
      await awardService.awardBadge('battle_combo_master')
    }

    // Piper.
    if (s.enemy && /piper/i.test(s.enemy.name || '')) {
      await awardService.awardBadge('battle_piper_slayer')
      await awardService.awardPlayerTitle('piper_hunter', 'Defeated the Shadow of Piper')
      const { count } = await supabase
        .from('battle_history').select('id', { count: 'exact', head: true })
        .eq('user_id', AppState.user.id).eq('victory', true).eq('is_boss', true)
      if ((count || 0) >= 10) await awardService.awardBadge('battle_piper_veteran')
    }

    // Cumulative win milestones.
    //
    // Legacy tested these with STRICT EQUALITY (`totalWins === 25`), so a
    // counter that ever skipped the exact value — a win recorded while the page
    // was closed, or two resolving together — lost that badge permanently.
    // `>=` here: awardBadge is idempotent and checks the cache first, so a
    // player who is already past a milestone simply receives what they earned.
    const { data: player } = await supabase
      .from('players').select('battles_won').eq('id', AppState.user.id).maybeSingle()
    const totalWins = (player && player.battles_won) || 0
    for (const m of WIN_MILESTONES) {
      if (totalWins >= m.wins) await awardService.awardBadge(m.badge)
    }

    // Ten wins in this zone.
    const zoneBadge = ZONE_BADGE_10[s.zone]
    if (zoneBadge) {
      const { count } = await supabase
        .from('battle_history').select('id', { count: 'exact', head: true })
        .eq('user_id', AppState.user.id).eq('victory', true).eq('zone', s.zone)
      if ((count || 0) >= 10) await awardService.awardBadge(zoneBadge)
    }

    // Several player titles key off battles_won / total_battles.
    await awardService.checkTitleUnlocks()
  } catch (e) {
    console.error('[battleBadges] award pass failed:', e)
  }
}

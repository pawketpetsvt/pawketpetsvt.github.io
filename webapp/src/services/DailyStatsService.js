import { supabase } from './SupabaseService.js'

// Ports trackDailyStat() (main:36337) — the community counters on `daily_stats`,
// one row per calendar day.
//
// THIS WAS DROPPED. Legacy has exactly four call sites — `battles_won`,
// `bosses_killed`, `pets_adopted` and `expeditions_completed` — and all four
// live in systems this migration has already ported, so none of them survived.
// The consequence is that the two surfaces that READ this table have been
// showing zeros since they were built: the news ticker's dynamic community
// headlines (Phase 6.8) and the Home page's "Today in PawketPets" card
// (Phase 8b). Both degrade quietly, which is why nobody noticed.
//
// Never throws: a community counter failing must not take down the action that
// triggered it.
export async function trackDailyStat(column, amount = 1) {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const { data: existing } = await supabase
      .from('daily_stats')
      .select(`id, ${column}`)
      .eq('stat_date', today)
      .maybeSingle()

    if (existing) {
      await supabase.from('daily_stats')
        .update({ [column]: (existing[column] || 0) + amount, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    } else {
      await supabase.from('daily_stats')
        .insert([{ stat_date: today, [column]: amount, updated_at: new Date().toISOString() }])
    }
  } catch (e) {
    // Legacy logs and swallows here too — deliberately non-critical.
    console.error('[dailyStats] failed to track', column, e)
  }
}

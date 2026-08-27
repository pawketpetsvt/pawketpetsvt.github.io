import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { playerService } from './PlayerService.js'
import { settingsState } from './SettingsService.js'

// The one code that is a lore trigger rather than a reward: it is deliberately
// re-redeemable (legacy skips the already-claimed check for it) so a player can
// replay the effect, and it is hidden entirely from players who opted out of
// spooky content.
export const LORE_CODE = 'THEYWENTMISSING'

// Ports redeemCode() / loadRedeemHistory(), game.js:4505-4680.
class RedeemService {
  // Returns { ok, error?, reward } where reward is
  // { pp, description, lorePage, spooky }.
  async redeem(rawCode) {
    if (!AppState.user) return { ok: false, error: 'You must be logged in.' }

    const code = String(rawCode || '').trim().toUpperCase()
    if (!code) return { ok: false, error: 'Please enter a code!' }

    // Try the atomic path first. redeem_code_secure does the lookup, the
    // max-uses check, the per-player uniqueness check, the PP award, the
    // redemption log and the times_used increment in ONE transaction — see the
    // note on the fallback below for why that matters.
    const rpc = await supabase.rpc('redeem_code_secure', { p_code: code })
    if (!rpc.error) {
      const r = rpc.data || {}
      if (!r.ok) return { ok: false, error: r.error || 'That code could not be redeemed.' }
      if (code === LORE_CODE && !settingsState.spooky_enabled) {
        return { ok: false, error: '👻 Your in-game settings prevent you from seeing this content.' }
      }
      if (typeof r.new_balance === 'number' && AppState.player) {
        AppState.player.pawketpoints = r.new_balance
      }
      return {
        ok: true,
        reward: {
          pp: r.pp_reward || 0,
          description: r.description || '',
          lorePage: r.lore_page || null,
          spooky: code === LORE_CODE
        }
      }
    }

    console.warn('[redeem] redeem_code_secure unavailable, using client path:', rpc.error.message)
    return this._redeemClientSide(code)
  }

  // Legacy's own sequence, kept as a fallback so the page works before the RPC
  // is deployed.
  //
  // Worth being explicit about what this path cannot guarantee, since it is
  // exactly what the RPC exists to fix: the "have I already redeemed this?"
  // check and the insert that records the redemption are two round trips, and
  // the PP is awarded BETWEEN them — so two requests racing each other both
  // pass the check and both get paid. The `times_used` bump is likewise a
  // read-modify-write of a value read earlier, so concurrent redemptions
  // overwrite each other and a code can be claimed past its max_uses. Same
  // class of hole as the localStorage claim gating closed in Phase 4.
  async _redeemClientSide(code) {
    const { data: promo, error } = await supabase
      .from('promo_codes')
      .select('id, code, pp_reward, lore_page, description, max_uses, times_used, is_active')
      .eq('code', code)
      .eq('is_active', true)
      .maybeSingle()

    if (error || !promo) {
      return { ok: false, error: "That code doesn't exist or is no longer active. Check for typos!" }
    }

    if (code === LORE_CODE && !settingsState.spooky_enabled) {
      return { ok: false, error: '👻 Your in-game settings prevent you from seeing this content.' }
    }

    if (promo.max_uses !== null && promo.times_used >= promo.max_uses) {
      return { ok: false, error: 'This code has been fully claimed, sorry!' }
    }

    if (code !== LORE_CODE) {
      const { data: already } = await supabase
        .from('redeemed_codes')
        .select('id')
        .eq('player_id', AppState.user.id)
        .eq('code_id', promo.id)
        .maybeSingle()
      if (already) {
        return { ok: false, error: "You've already redeemed this code! Each code is one per account." }
      }
    }

    try {
      if (promo.pp_reward > 0) {
        await playerService.awardPoints(promo.pp_reward, 'promo_code_' + code)
      }
      await supabase.from('redeemed_codes').insert([{
        player_id: AppState.user.id,
        code_id: promo.id,
        redeemed_at: new Date().toISOString()
      }])
      await supabase.from('promo_codes')
        .update({ times_used: (promo.times_used || 0) + 1 })
        .eq('id', promo.id)
    } catch (e) {
      return { ok: false, error: 'Something went wrong: ' + e.message }
    }

    return {
      ok: true,
      reward: {
        pp: promo.pp_reward || 0,
        description: promo.description || '',
        lorePage: promo.lore_page || null,
        spooky: code === LORE_CODE
      }
    }
  }

  async history(limit = 10) {
    if (!AppState.user) return []
    const { data, error } = await supabase
      .from('redeemed_codes')
      .select('redeemed_at, code_id, promo_codes(code, pp_reward, description)')
      .eq('player_id', AppState.user.id)
      .order('redeemed_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return data.map(row => ({
      code: (row.promo_codes && row.promo_codes.code) || '???',
      description: (row.promo_codes && row.promo_codes.description) || '',
      pp: (row.promo_codes && row.promo_codes.pp_reward) || 0,
      date: new Date(row.redeemed_at).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      })
    }))
  }
}

export const redeemService = new RedeemService()

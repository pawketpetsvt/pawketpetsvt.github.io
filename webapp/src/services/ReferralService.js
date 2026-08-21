import { supabase } from './SupabaseService.js'

function generateReferralCode(username) {
  let base = username.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8)
  while (base.length < 6) base += Math.floor(Math.random() * 10)
  base += Math.floor(Math.random() * 90 + 10)
  return base
}

class ReferralService {
  // Ports showReferralModal()'s data-fetch half, game.js:27985-28074 (the
  // rendering half becomes ReferralModal markup instead of DOM-built HTML).
  async getOrCreateReferral(userId) {
    const { data: player, error } = await supabase
      .from('players')
      .select('username, referral_code, referral_count')
      .eq('id', userId)
      .single()
    if (error) throw error

    let code = player.referral_code
    if (!code) {
      code = generateReferralCode(player.username)
      await supabase.from('players').update({ referral_code: code }).eq('id', userId)
    }

    return {
      link: 'https://pawketpets.vt?ref=' + code,
      count: player.referral_count || 0
    }
  }
}

export const referralService = new ReferralService()

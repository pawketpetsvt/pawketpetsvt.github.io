import { AppState } from '../AppState.js'
import { supabase } from './SupabaseService.js'
import { toastService } from './ToastService.js'
import { referralService } from './ReferralService.js'

const SHARE_BONUS_PP = 100

// Ports the SOCIAL SHARING SYSTEM — shareToTwitter()/shareToBluesky()
// (game.js:7365-7405) plus shareProgress()/showShareModal()/awardShareBonus()
// (main:27841-27970). The pet-card snapshot half lives in SnapshotService.
const HASHTAGS = 'PawketPetsVT,VTuber,VirtualPets'
const SITE_URL = 'https://pawketpetsvt.github.io'

class ShareService {
  // A share link carries the player's referral code when `includeReferral` is
  // set, so sharing doubles as recruiting — legacy's own arrangement.
  async shareUrl(includeReferral) {
    if (!includeReferral || !AppState.user) return SITE_URL
    try {
      const { link } = await referralService.getOrCreateReferral(AppState.user.id)
      return link || SITE_URL
    } catch {
      return SITE_URL
    }
  }

  async share(platform, text, includeReferral = false) {
    const url = await this.shareUrl(includeReferral)
    const target = platform === 'bluesky'
      ? 'https://bsky.app/intent/compose?text=' + encodeURIComponent(text + '\n\n' + url)
      : 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) +
        '&url=' + encodeURIComponent(url) +
        '&hashtags=' + HASHTAGS
    window.open(target, '_blank', 'width=550,height=420')
  }

  // Ports shareProgress()'s text composition. Legacy hardcodes
  // `https://pawketpets.vt`, which is not this site's address — the same
  // wrong-domain slip as the referral links and the snapshot footer. The URL is
  // appended by share()/shareUrl() from the running origin instead.
  async progressText() {
    if (!AppState.user) throw new Error('Please log in to share!')
    const [{ data: player }, { data: pets }] = await Promise.all([
      supabase.from('players').select('username, pawketpoints').eq('id', AppState.user.id).single(),
      supabase.from('user_pets').select('id').eq('user_id', AppState.user.id)
    ])
    const petCount = pets ? pets.length : 0
    const pp = (player && player.pawketpoints) || 0
    return `I have ${petCount} pets and ${pp} PawketPoints on PawketPetsVT! 🐾✨\n\nAdopt your favorite VTuber's pet:`
  }

  // Ports awardShareBonus() — 100 PP, once a day.
  //
  // LEGACY BUG: the once-a-day gate is a localStorage key and nothing else, so
  // clearing site data (or a private tab) lets the same player claim 100 PP over
  // and over. That is the exact replay vulnerability Phase 4 closed for every
  // minigame with `claim_daily_secure`, which takes an arbitrary key — so no new
  // SQL is needed to close it here too.
  async awardBonus() {
    if (!AppState.user) return false
    const { data, error } = await supabase.rpc('claim_daily_secure', {
      p_game_key: 'social_share',
      p_amount: SHARE_BONUS_PP,
      p_reason: 'social_share'
    })
    if (error) {
      console.error('[share] bonus claim failed:', error.message)
      return false
    }
    // A null/undefined result means the server rejected it as already claimed.
    if (data === null || data === undefined) return false
    if (AppState.player) AppState.player.pawketpoints = data
    toastService.success(`🎉 +${SHARE_BONUS_PP} PP for sharing! Thanks for spreading the word!`)
    return true
  }
}

export const shareService = new ShareService()

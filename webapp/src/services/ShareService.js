import { AppState } from '../AppState.js'
import { referralService } from './ReferralService.js'

// Ports shareToTwitter() / shareToBluesky() (game.js:7365-7405) — the share
// half of the SOCIAL SHARING SYSTEM.
//
// The rest of that system (showShareModal, awardShareBonus, and the pet card's
// 📸 Snapshot) is still to come in this phase; this piece lands first because
// the badge-unlock notification carries share buttons and would otherwise ship
// with two dead controls.
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
}

export const shareService = new ShareService()

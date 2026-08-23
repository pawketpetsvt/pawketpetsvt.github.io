export class FriendProfile {
  constructor(data = {}) {
    this.friendshipId = data.friendshipId || ''
    this.userId = data.id || ''
    this.username = data.username || ''
    this.pawketpoints = data.pawketpoints || 0
    this.petCount = data.petCount || 0
    this.totalLevel = data.totalLevel || 0
    this.badgeCount = data.badgeCount || 0
    this.lastLogin = data.last_login || null
  }

  // Ports friendIsOnlineNow(), game.js:19848-19852.
  get isOnline() {
    if (!this.lastLogin) return false
    return Date.now() - new Date(this.lastLogin).getTime() < 5 * 60000
  }

  // Ports formatLastActive(), game.js:19854-19862.
  get lastActiveText() {
    if (!this.lastLogin) return '⚪ Never logged in'
    const diffMs = Date.now() - new Date(this.lastLogin).getTime()
    if (diffMs < 5 * 60000) return '🟢 Online now'
    if (diffMs < 3600000) return '⚪ Active ' + Math.floor(diffMs / 60000) + 'm ago'
    if (diffMs < 86400000) return '⚪ Active ' + Math.floor(diffMs / 3600000) + 'h ago'
    if (diffMs < 604800000) return '⚪ Active ' + Math.floor(diffMs / 86400000) + 'd ago'
    return '⚪ Active ' + Math.floor(diffMs / 604800000) + 'w ago'
  }
}

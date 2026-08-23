export class FriendRequest {
  constructor(data = {}) {
    this.friendshipId = data.friendshipId || ''
    this.requesterId = data.id || ''
    this.username = data.username || ''
    this.pawketpoints = data.pawketpoints || 0
    this.petCount = data.petCount || 0
    this.totalLevel = data.totalLevel || 0
    this.badgeCount = data.badgeCount || 0
  }
}

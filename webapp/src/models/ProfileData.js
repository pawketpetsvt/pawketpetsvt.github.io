import { DEFAULT_EQUIPPED } from '../data/cosmeticsData.js'

export class ProfileData {
  constructor(data = {}) {
    this.id = data.id || ''
    this.username = data.username || ''
    this.bio = data.bio || ''
    this.pawketpoints = data.pawketpoints || 0
    this.createdAt = data.created_at || null
    this.totalPets = data.total_pets || 0
    this.totalLevels = data.total_levels || 0
    this.highestLevel = data.highest_level || 0
    this.rank = data.rank || null
    this.title = data.title || null
    this.equipped = data.equipped_cosmetics || { ...DEFAULT_EQUIPPED }
  }

  get initial() {
    return (this.username || '?').charAt(0).toUpperCase()
  }

  get joinedText() {
    if (!this.createdAt) return ''
    return 'Joined: ' + new Date(this.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
}

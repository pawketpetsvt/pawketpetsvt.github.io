export class LeaderboardEntry {
  constructor(data = {}) {
    this.userId = data.id || ''
    this.username = data.username || ''
    this.value = data.value || ''
    this.stat = data.stat || ''
  }
}

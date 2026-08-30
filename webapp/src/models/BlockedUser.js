export class BlockedUser {
  constructor(data = {}) {
    this.blockId = data.blockId || ''
    this.userId = data.id || ''
    this.username = data.username || ''
  }
}

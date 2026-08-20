export class Player {
  constructor(data = {}) {
    this.id = data.id || ''
    this.username = data.username || ''
    this.pawketpoints = data.pawketpoints || 0
  }
}

export class Player {
  constructor(data = {}) {
    this.id = data.id || ''
    this.username = data.username || ''
    this.pawketpoints = data.pawketpoints || 0
    this.login_streak = data.login_streak || 0
    this.tutorial_completed = data.tutorial_completed || false
  }
}

export class Pet {
  constructor(data = {}) {
    this.id = data.id || ''
    this.name = data.name || ''
    this.description = data.description || ''
    this.image_file = data.image_file || ''
    this.price = data.price || 0
    this.vtuber_name = data.vtuber_name || ''
    this.twitch_url = data.twitch_url || ''
    this.created_at = data.created_at || null
  }

  get isPlaceholder() {
    return this.name === '???'
  }
}

export class InventoryItem {
  constructor(data = {}) {
    this.invId = data.invId || ''
    this.itemId = data.itemId || ''
    this.name = data.name || 'Item'
    this.qty = data.qty || 0
    this.h = data.h || 0
    this.e = data.e || 0
    this.hap = data.hap || 0
    this.xp = data.xp || 0
    this.itemType = data.itemType || ''
    this.imageUrl = data.imageUrl || ''
    this.foodCategory = data.foodCategory || ''
    this.effect = data.effect || ''
    this.effectValue = data.effectValue || 0
  }

  get effectText() {
    const parts = []
    if (this.h > 0) parts.push('+' + this.h + ' Hunger')
    if (this.e > 0) parts.push('+' + this.e + ' Energy')
    if (this.hap > 0) parts.push('+' + this.hap + ' Happiness')
    if (this.xp > 0) parts.push('+' + this.xp + ' XP')
    if (this.effect === 'healing' && this.effectValue > 0) parts.push('+' + this.effectValue + ' HP')
    return parts.join('  ')
  }
}

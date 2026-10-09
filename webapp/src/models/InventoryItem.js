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

  // Every item has exactly one place to be used on a pet card: food in the Feed
  // picker, toys in the Play picker, everything else in "Use an Item".
  // Healing items always go to "Use an Item" even if they'd pass the food or toy
  // test: restoring HP is handled only by that path (OwnedPetsService.
  // useItemOnPet), and feeding one would give hunger and never heal.
  get isHealing() {
    return this.effect === 'healing' || this.effect === 'full_heal' || this.effect === 'revive'
  }

  // The Feed picker's filter (legacy feed(), game.js:6125 at 826475d): anything
  // that restores hunger, any cooked dish, or a name that reads as food.
  get isFood() {
    if (this.isHealing) return false
    const n = this.name.toLowerCase()
    return this.h > 0 || !!this.foodCategory ||
      ['food', 'ramen', 'cake', 'steak', 'burger', 'pie', 'cookie', 'juice', 'smoothie'].some(w => n.includes(w))
  }

  // The Play picker's filter (legacy play(), game.js:6462). Legacy required an
  // item_type before checking anything, name included, and so does this.
  get isToy() {
    if (this.isHealing || !this.itemType) return false
    const t = this.itemType.toLowerCase()
    const n = this.name.toLowerCase()
    return t === 'toy' || t === 'fun' || ['toy', 'ball', 'frisbee', 'game'].some(w => n.includes(w))
  }

  // What the card's "Use an Item" dropdown lists.
  get isOtherItem() {
    return !this.isFood && !this.isToy
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

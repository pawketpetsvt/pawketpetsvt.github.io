export class ShopItem {
  constructor(data = {}) {
    this.id = data.id || ''
    this.name = data.name || 'Item'
    this.description = data.description || ''
    this.price = data.price || 0
    this.itemType = data.item_type || ''
    this.imageUrl = data.image_url || ''
    this.foodCategory = data.food_category || ''
    this.h = data.hunger_effect || 0
    this.e = data.energy_effect || 0
    this.hap = data.happiness_effect || 0
    this.xp = data.xp_effect || 0
    this.effect = data.effect || ''
    this.effectValue = data.effect_value || 0
    this.atk = data.attack_bonus || 0
    this.def = data.defense_bonus || 0
    this.lck = data.luck_bonus || 0
    this.spi = data.spirit_bonus || 0
    this.hpBonus = data.hp_bonus || 0
    this.spd = data.speed_bonus || 0
  }

  // Mirrors the effect-tag list built in loadShop(), game.js:7303-7313.
  get effectTags() {
    const tags = []
    if (this.h > 0) tags.push('+' + this.h + ' Hunger')
    if (this.e > 0) tags.push('+' + this.e + ' Energy')
    if (this.hap > 0) tags.push('+' + this.hap + ' Happiness')
    if (this.xp > 0) tags.push('+' + this.xp + ' XP')
    if (this.effect === 'healing' && this.effectValue > 0) tags.push('+' + this.effectValue + ' HP')
    if (this.atk > 0) tags.push('+' + this.atk + ' ATK')
    if (this.def > 0) tags.push('+' + this.def + ' DEF')
    if (this.lck > 0) tags.push('+' + this.lck + ' LCK')
    if (this.spi > 0) tags.push('+' + this.spi + ' SPI')
    if (this.hpBonus > 0) tags.push('+' + this.hpBonus + ' HP')
    if (this.spd > 0) tags.push('+' + this.spd + ' SPD')
    return tags
  }
}

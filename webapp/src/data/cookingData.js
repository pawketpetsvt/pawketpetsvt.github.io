// Static cooking content, ported verbatim from game.js:41481-41735
// (COOKING_INGREDIENTS, COOKING_RECIPES). COOKING_DROP_TABLES (the
// battle/fishing/expedition ingredient-drop chances) is deliberately not
// ported — those systems aren't migrated yet, so there's nothing to roll
// drops from. Ingredients currently only enter play via the 5 shop staples
// (see SHOP_STAPLE_INGREDIENT_IDS).

export const COOKING_INGREDIENTS = {
  meat_chunk: { name: 'Raw Meat', emoji: '🥩', source: 'Battle (animals)' },
  tough_meat: { name: 'Tough Meat', emoji: '🍖', source: 'Battle (elder animals)' },
  small_bone: { name: 'Small Bone', emoji: '🦴', source: 'Battle (any animal)' },
  feather: { name: 'Feather', emoji: '🪶', source: 'Battle (birds)' },
  mushroom: { name: 'Forest Mushroom', emoji: '🍄', source: 'Battle (deepwoods/ruins)' },
  glitch_residue: { name: 'Glitch Residue', emoji: '⁉️', source: 'Battle (rare drop, any)' },
  fresh_salmon: { name: 'Fresh Salmon', emoji: '🐟', source: 'Fishing (salmon catch)' },
  fresh_cod: { name: 'Fresh Cod', emoji: '🐠', source: 'Fishing (cod catch)' },
  shellfish: { name: 'Shellfish', emoji: '🦐', source: 'Fishing (10% any cast)' },
  seaweed: { name: 'Seaweed', emoji: '🌿', source: 'Fishing (15% any cast)' },
  wild_herb: { name: 'Wild Herb', emoji: '🌱', source: 'Expedition (outskirts/glade)' },
  forest_berry: { name: 'Forest Berry', emoji: '🍇', source: 'Expedition (glade)' },
  honey: { name: 'Wild Honey', emoji: '🍯', source: 'Expedition (deepwoods)' },
  rare_spice: { name: 'Rare Spice', emoji: '✨', source: 'Expedition (ruins)' },
  crystal_shard: { name: 'Crystal Shard', emoji: '💎', source: 'Expedition (ruins, rare)' },
  flour: { name: 'Flour', emoji: '🌾', source: 'Shop staple' },
  sugar: { name: 'Sugar', emoji: '🍬', source: 'Shop staple' },
  butter: { name: 'Butter', emoji: '🧈', source: 'Shop staple' },
  salt: { name: 'Salt', emoji: '🧂', source: 'Shop staple' },
  egg: { name: 'Egg', emoji: '🥚', source: 'Shop staple' }
}

// The 5 ingredients purchasable directly (item_type='ingredient' in the
// items table) rather than dropped from Battle/Fishing/Expedition.
export const SHOP_STAPLE_INGREDIENT_IDS = ['flour', 'sugar', 'butter', 'salt', 'egg']

// Fishing's ingredient drop chances, game.js:41724-41728 (part of the larger
// COOKING_DROP_TABLES shared with Battle/Expedition — only the .fishing slice
// is ported since those other two systems aren't migrated). The salmon/cod
// sub-keys below are carried over for data completeness but aren't actually
// read by name lookup in game.js's cooking_rollFishingDrop — the real check
// there is a hardcoded name-substring match ("salmon"/"cod" in the catch
// name), which FishingService.rollCookingDrop replicates directly instead of
// keying off these two sub-objects.
export const FISHING_INGREDIENT_DROPS = {
  salmon: { fresh_salmon: 1.0 },
  cod: { fresh_cod: 1.0 },
  any: { shellfish: 0.10, seaweed: 0.15 }
}

export const INGREDIENT_SOURCE_CATEGORIES = [
  { label: 'From Battles', ids: ['meat_chunk', 'tough_meat', 'small_bone', 'feather', 'mushroom', 'glitch_residue'] },
  { label: 'From Fishing', ids: ['fresh_salmon', 'fresh_cod', 'shellfish', 'seaweed'] },
  { label: 'From Expeditions', ids: ['wild_herb', 'forest_berry', 'honey', 'rare_spice', 'crystal_shard'] },
  { label: 'From Shop', ids: SHOP_STAPLE_INGREDIENT_IDS }
]

// Sorted ingredient-id set is the canonical recipe key. combatBuff fields are
// carried over for data fidelity but nothing applies them yet — that's
// Battle-phase scope, ported here only so the dishes exist to be cooked.
export const COOKING_RECIPES = [
  { id: 'honey_cookies', name: 'Honey Cookies', emoji: '🍪', ingredients: ['butter', 'flour', 'honey', 'sugar'], effect: 'Hunger +35, Happiness +15', description: 'Sweet, chewy cookies drizzled in wild honey.' },
  { id: 'berry_mash', name: 'Berry Mash', emoji: '🫐', ingredients: ['forest_berry', 'sugar'], effect: 'Hunger +15, Happiness +10', description: 'Mashed forest berries with a hint of sweetness.' },
  { id: 'fish_fillet', name: 'Fish Fillet', emoji: '🍣', ingredients: ['fresh_salmon', 'salt'], effect: 'Hunger +25, HP +5', description: 'Lightly salted salmon fillet. Nutritious and fresh.' },
  { id: 'mushroom_soup', name: 'Mushroom Soup', emoji: '🍲', ingredients: ['mushroom', 'salt', 'wild_herb'], effect: 'Hunger +30, HP +10', description: 'A warm forest soup with earthy mushrooms and fresh herbs.' },
  { id: 'meat_pie', name: 'Meat Pie', emoji: '🥧', ingredients: ['egg', 'flour', 'meat_chunk'], effect: 'Hunger +40, HP +5', description: 'A hearty pie filled with savory meat.' },
  { id: 'spiced_broth', name: 'Spiced Broth', emoji: '🫕', ingredients: ['rare_spice', 'salt', 'tough_meat'], effect: 'Hunger +35, HP +15', description: 'A rich, spicy broth brewed from tough cuts.' },
  { id: 'sweet_bun', name: 'Sweet Bun', emoji: '🧁', ingredients: ['butter', 'egg', 'flour', 'sugar'], effect: 'Hunger +20, Happiness +20', description: 'A fluffy, buttery bun dusted with sugar.' },
  { id: 'seaweed_wrap', name: 'Seaweed Wrap', emoji: '🌯', ingredients: ['fresh_cod', 'salt', 'seaweed'], effect: 'Hunger +28, Happiness +5', description: 'Cod and vegetables wrapped in dried seaweed.' },
  { id: 'shellfish_stew', name: 'Shellfish Stew', emoji: '🍜', ingredients: ['salt', 'shellfish', 'wild_herb'], effect: 'Hunger +30, HP +8, Happiness +5', description: 'A savory stew of fresh shellfish and wild herbs.' },
  { id: 'feather_fluff_cake', name: 'Feather Fluff Cake', emoji: '🎂', ingredients: ['feather', 'flour', 'sugar'], effect: 'Hunger +10, Happiness +30', description: 'Impossibly light cake. More fluff than substance, but surprisingly fun.' },
  { id: 'golden_crown_roast', name: 'Golden Crown Roast', emoji: '👑', ingredients: ['crystal_shard', 'honey', 'rare_spice', 'tough_meat'], effect: 'Hunger +50, HP +25, Happiness +15', description: 'The finest dish the kitchen can produce. Fit for royalty.' },
  { id: 'faerie_dust_delight', name: 'Faerie Dust Delight', emoji: '✨', ingredients: ['forest_berry', 'glitch_residue', 'sugar'], effect: 'Hunger +20, Happiness +25, HP +10', description: 'Something about this dish shimmers wrong. It tastes incredible though.' },
  { id: 'pipers_broth', name: "Piper's Broth", emoji: '🎵', ingredients: ['glitch_residue', 'mushroom', 'small_bone'], effect: 'Hunger MAX, Happiness -10', description: 'A dark, bubbling broth. It smells like static and something older.', isPiperRecipe: true },
  { id: 'warriors_feast', name: "Warrior's Feast", emoji: '🍗', ingredients: ['tough_meat', 'rare_spice', 'honey'], effect: '+3 ATK for next 5 battles', combatBuff: { stat: 'attack', amount: 3, battles: 5 }, description: 'A roasted haunch glazed with spiced honey. Your pet looks ready to fight.', isSecretRecipe: true },
  { id: 'iron_shell_stew', name: 'Iron Shell Stew', emoji: '🫕', ingredients: ['shellfish', 'mushroom', 'small_bone', 'salt'], effect: '+4 DEF for next 5 battles', combatBuff: { stat: 'defense', amount: 4, battles: 5 }, description: 'A thick, mineral stew made from boiled shells and forest mushrooms. Fortifying.', isSecretRecipe: true },
  { id: 'swiftfin_sashimi', name: 'Swiftfin Sashimi', emoji: '🍱', ingredients: ['fresh_salmon', 'seaweed', 'rare_spice'], effect: '+3 SPD for next 5 battles', combatBuff: { stat: 'speed', amount: 3, battles: 5 }, description: 'Razor-thin slices of salmon seasoned with rare spice. Light, fast, fierce.', isSecretRecipe: true },
  { id: 'lucky_berry_jam', name: 'Lucky Berry Jam', emoji: '🍯', ingredients: ['forest_berry', 'honey', 'sugar'], effect: '+4 Luck for next 5 battles', combatBuff: { stat: 'luck', amount: 4, battles: 5 }, description: 'Thick jam bursting with tart berries. Each spoonful feels like a small miracle.', isSecretRecipe: true },
  { id: 'crystalized_power_cake', name: 'Crystalized Power Cake', emoji: '💎', ingredients: ['crystal_shard', 'butter', 'flour', 'egg'], effect: '+5 ATK, +3 DEF for next 8 battles', combatBuff: { stat: 'multi', bonuses: [{ stat: 'attack', amount: 5 }, { stat: 'defense', amount: 3 }], battles: 8 }, description: 'A cake with a literal crystal baked into it. Somehow delicious. Definitely dangerous.', isSecretRecipe: true },
  { id: 'glitch_cookie', name: 'Glitch Cookie', emoji: '🍪', ingredients: ['glitch_residue', 'flour', 'butter', 'sugar'], effect: '+6 Luck, +2 ATK for next 10 battles', combatBuff: { stat: 'multi', bonuses: [{ stat: 'luck', amount: 6 }, { stat: 'attack', amount: 2 }], battles: 10 }, description: "It phases slightly as you eat it. The crunch is on a frequency you shouldn't be able to hear.", isSecretRecipe: true }
]

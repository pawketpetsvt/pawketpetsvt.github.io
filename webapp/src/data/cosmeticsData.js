// Ported verbatim from COSMETICS_CATALOG, game.js:536-612.
export const COSMETICS_CATALOG = {
  backgrounds: [
    { id: 'bg_default', name: 'Classic', emoji: '💜', gradient: 'linear-gradient(135deg,#9966ff,#764ba2)', alwaysUnlocked: true, unlockHint: 'Free for everyone' },
    { id: 'bg_dreamy', name: 'Dreamy Skies', emoji: '☁️', gradient: 'linear-gradient(135deg,#a8edea,#fed6e3)', alwaysUnlocked: true, unlockHint: 'Free for everyone' },
    { id: 'bg_sunset', name: 'Sunset Glow', emoji: '🌅', gradient: 'linear-gradient(135deg,#ff9a9e,#fecfef)', alwaysUnlocked: true, unlockHint: 'Free for everyone' },
    { id: 'bg_midnight', name: 'Midnight Stars', emoji: '🌙', gradient: 'linear-gradient(135deg,#2c3e50,#3498db)', alwaysUnlocked: true, unlockHint: 'Free for everyone' },
    { id: 'bg_candy', name: 'Candy Land', emoji: '🍬', gradient: 'linear-gradient(135deg,#ff6b9d,#ffb3c6,#ffdee9)', alwaysUnlocked: true, unlockHint: 'Free for everyone' },
    { id: 'bg_cafe', name: 'Cozy Café', emoji: '☕', gradient: 'linear-gradient(135deg,#d4a373,#faedcd,#fefae0)', alwaysUnlocked: true, unlockHint: 'Free for everyone' },
    { id: 'bg_galaxy', name: 'Cosmic Void', emoji: '🌌', gradient: 'linear-gradient(135deg,#2d1b5e,#3d1d78,#4a2090)', alwaysUnlocked: true, unlockHint: 'Free for everyone' },
    { id: 'bg_garden', name: 'Garden', emoji: '🌸', gradient: 'linear-gradient(135deg,#a8edea,#fed6e3)', alwaysUnlocked: true, unlockHint: 'Free for everyone' },
    { id: 'bg_forest', name: 'Forest Glade', emoji: '🌲', gradient: 'linear-gradient(135deg,#134e5e,#71b280)', unlockHint: 'Reach player level 10' },
    { id: 'bg_stars', name: 'Starry Night', emoji: '✨', gradient: 'linear-gradient(135deg,#000428,#004e92)', unlockHint: '30-day login streak' },
    { id: 'bg_castle', name: 'Battle Keep', emoji: '🏰', gradient: 'linear-gradient(135deg,#2c3e50,#8e44ad)', unlockHint: 'Win 50 battles' },
    { id: 'bg_desert', name: 'Dusk Desert', emoji: '🏜️', gradient: 'linear-gradient(135deg,#c94b4b,#4b134f)', unlockHint: 'Win 100 battles' },
    { id: 'bg_clouds', name: 'Cloud Nine', emoji: '☁️', gradient: 'linear-gradient(135deg,#89f7fe,#66a6ff)', unlockHint: 'Reach player level 20' },
    { id: 'bg_rainbow', name: 'Rainbow Road', emoji: '🌈', gradient: 'linear-gradient(90deg,#ff0000,#ff7f00,#ffff00,#00ff00,#0000ff,#4b0082,#9400d3)', unlockHint: 'Complete Bingo blackout' },
    { id: 'bg_legendary', name: 'Legendary', emoji: '👑', gradient: 'linear-gradient(135deg,#f7971e,#ffd200)', unlockHint: 'Reach player level 50' },
    { id: 'bg_underwater', name: 'Underwater', emoji: '🐠', gradient: 'linear-gradient(135deg,#0052d4,#65c7f7)', unlockHint: '50-day login streak' },
    { id: 'bg_volcano', name: 'Volcano', emoji: '🌋', gradient: 'linear-gradient(135deg,#ff512f,#dd2476)', unlockHint: 'Defeat 10 bosses' },
    { id: 'bg_aurora', name: 'Aurora Bloom', emoji: '🌿', gradient: 'linear-gradient(135deg,#0f9b8e,#bdc372)', unlockHint: 'Contribute to 10 community goals' },
    { id: 'bg_rose', name: 'Rose Gold', emoji: '🌹', gradient: 'linear-gradient(135deg,#f093fb,#f5576c)', unlockHint: 'Send 50 gifts' }
  ],
  frames: [
    { id: 'frame_classic', name: 'Classic', emoji: '💜', previewColor: '#9966ff', cssClass: 'frame-classic', alwaysUnlocked: true, unlockHint: 'Free for everyone' },
    { id: 'frame_dashed', name: 'Dashed', emoji: '┅', previewColor: '#9966ff', cssClass: 'frame-dashed', alwaysUnlocked: true, unlockHint: 'Free for everyone' },
    { id: 'frame_dotted', name: 'Dotted', emoji: '⋯', previewColor: '#9966ff', cssClass: 'frame-dotted', alwaysUnlocked: true, unlockHint: 'Free for everyone' },
    { id: 'frame_double', name: 'Double', emoji: '═', previewColor: '#9966ff', cssClass: 'frame-double', alwaysUnlocked: true, unlockHint: 'Free for everyone' },
    { id: 'frame_soft', name: 'Soft', emoji: '●', previewColor: '#ff99cc', cssClass: 'frame-soft', alwaysUnlocked: true, unlockHint: 'Free for everyone' },
    { id: 'frame_glow', name: 'Glowing', emoji: '💫', previewColor: '#9966ff', cssClass: 'frame-glow-free', alwaysUnlocked: true, unlockHint: 'Free for everyone' },
    { id: 'frame_paw', name: 'Paw Prints', emoji: '🐾', previewColor: '#ff9966', cssClass: 'frame-paw', alwaysUnlocked: true, unlockHint: 'Free for everyone' },
    { id: 'frame_silver', name: 'Silver', emoji: '⚪', previewColor: '#c0c0c0', cssClass: 'frame-silver', unlockHint: 'Reach player level 10' },
    { id: 'frame_gold', name: 'Gold', emoji: '🟡', previewColor: '#ffd700', cssClass: 'frame-gold', unlockHint: 'Reach player level 20' },
    { id: 'frame_fire', name: 'Fire', emoji: '🔥', previewColor: '#ff4500', cssClass: 'frame-fire', unlockHint: 'Win 100 battles' },
    { id: 'frame_ice', name: 'Ice', emoji: '❄️', previewColor: '#00d2ff', cssClass: 'frame-ice', unlockHint: '30-day login streak' },
    { id: 'frame_rainbow', name: 'Rainbow', emoji: '🌈', previewColor: '#ff69b4', cssClass: 'frame-rainbow', unlockHint: 'Complete Bingo blackout' },
    { id: 'frame_sparkle', name: 'Sparkle', emoji: '✨', previewColor: '#ffd700', cssClass: 'frame-sparkle-earned', unlockHint: 'Referred 5 friends' },
    { id: 'frame_legendary', name: 'Legendary', emoji: '✨', previewColor: '#ffd700', cssClass: 'frame-legendary', unlockHint: 'Reach player level 50' },
    { id: 'frame_void', name: 'Void', emoji: '🌑', previewColor: '#8b00ff', cssClass: 'frame-void', unlockHint: 'Ultra rare drop' },
    { id: 'frame_crown', name: 'Crown', emoji: '👑', previewColor: '#ffd700', cssClass: 'frame-crown', unlockHint: 'Win 50 battles in a row' },
    { id: 'frame_glitch', name: 'Glitch', emoji: '📺', previewColor: '#ff00ff', cssClass: 'frame-glitch', unlockHint: 'Secret code: GLITCH' }
  ],
  badges: [
    { id: 'badge_newbie', name: 'Newbie', emoji: '🌱', color: '#8e8e8e', alwaysUnlocked: true, unlockHint: 'Free for everyone' },
    { id: 'badge_explorer', name: 'Explorer', emoji: '🗺️', color: '#5cb85c', alwaysUnlocked: true, unlockHint: 'Free for everyone' },
    { id: 'badge_friendly', name: 'Friendly', emoji: '😊', color: '#f1c40f', alwaysUnlocked: true, unlockHint: 'Free for everyone' },
    { id: 'badge_helpful', name: 'Helpful', emoji: '🤝', color: '#3498db', alwaysUnlocked: true, unlockHint: 'Free for everyone' },
    { id: 'badge_creative', name: 'Creative', emoji: '🎨', color: '#9b59b6', alwaysUnlocked: true, unlockHint: 'Free for everyone' },
    { id: 'badge_brave', name: 'Brave', emoji: '🦁', color: '#e67e22', alwaysUnlocked: true, unlockHint: 'Free for everyone' },
    { id: 'badge_recruit', name: 'Recruit', emoji: '🎖️', color: '#8e8e8e', alwaysUnlocked: false, unlockHint: 'Complete tutorial' },
    { id: 'badge_level_20', name: 'Veteran', emoji: '⭐', color: '#c0c0c0', unlockHint: 'Reach player level 20' },
    { id: 'badge_level_50', name: 'Mythic', emoji: '💫', color: '#ff9800', unlockHint: 'Reach player level 50' },
    { id: 'badge_100_battles', name: 'Veteran Fighter', emoji: '⚔️', color: '#5bc0de', unlockHint: 'Win 100 battles' },
    { id: 'badge_30_days', name: 'Loyal', emoji: '🗓️', color: '#5cb85c', unlockHint: '30-day login streak' },
    { id: 'badge_100_days', name: 'Devoted', emoji: '💎', color: '#5bc0de', unlockHint: '100-day login streak' },
    { id: 'badge_pet_20', name: 'Collector', emoji: '🐾', color: '#ff69b4', unlockHint: 'Own 20 pets' },
    { id: 'badge_boss_10', name: 'Boss Slayer', emoji: '👑', color: '#ff4500', unlockHint: 'Defeat 10 bosses' },
    { id: 'badge_treats_100', name: 'Feeder', emoji: '🍖', color: '#5dde7a', unlockHint: 'Feed pets 100 times' },
    { id: 'badge_gift_giver', name: 'Gift Giver', emoji: '🎁', color: '#ff6b9d', unlockHint: 'Send your first gift' },
    { id: 'badge_generous', name: 'Generous Soul', emoji: '💝', color: '#ff6b9d', unlockHint: 'Send 10 gifts' },
    { id: 'badge_philanthropist', name: 'Philanthropist', emoji: '🏦', color: '#ffd700', unlockHint: 'Send 50 gifts' },
    { id: 'badge_snapshot', name: 'Snapshot', emoji: '📸', color: '#5bc0de', unlockHint: 'Share your first screenshot' },
    { id: 'badge_social_butterfly', name: 'Social Butterfly', emoji: '📱', color: '#9b59b6', unlockHint: 'Share 5 screenshots' },
    { id: 'badge_voter', name: 'Voice of the People', emoji: '🗳️', color: '#3498db', unlockHint: 'Vote in 3 polls' },
    { id: 'badge_poll_champ', name: 'Poll Champion', emoji: '📊', color: '#9b59b6', unlockHint: 'Vote in 15 polls' },
    { id: 'badge_speed_demon', name: 'Speed Demon', emoji: '⚡', color: '#ffd700', unlockHint: 'Win a battle in under 3 turns' },
    { id: 'badge_the_wall', name: 'The Wall', emoji: '🛡️', color: '#5bc0de', unlockHint: 'Win a battle taking <10 damage' },
    { id: 'badge_comeback', name: 'Comeback King', emoji: '🔥', color: '#ff4500', unlockHint: 'Win a battle at <5% HP' },
    { id: 'badge_team_player', name: 'Team Player', emoji: '🤝', color: '#5cb85c', unlockHint: 'Contribute to a community goal' },
    { id: 'badge_global_hero', name: 'Global Hero', emoji: '🌍', color: '#3498db', unlockHint: 'Contribute to 10 community goals' }
  ]
}

export const DEFAULT_EQUIPPED = { background: 'bg_default', frame: 'frame_classic', badges: [] }

export const MAX_EQUIPPED_BADGES = 3

// Ports the rarity→color map used for player title badges, game.js:11799-11805.
export const TITLE_RARITY_COLORS = {
  Common: '#8e8e8e',
  Uncommon: '#5cb85c',
  Rare: '#5bc0de',
  Epic: '#9c27b0',
  Legendary: '#ff9800'
}

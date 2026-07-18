'use strict';

// ══════════════════════════════════════════════════════════════════════════
// DEBUG FLAG — set to true locally to see verbose logs; false for production
// ══════════════════════════════════════════════════════════════════════════
var _notifTabHidden = false;

var DEBUG = false;

// ── Global Tooltip System ──────────────────────────────────────────────────
// Usage: add data-tooltip="text" to any element. Supports \n for line breaks.
(function() {
  var tip = null;
  function show(el, text) {
    hide();
    tip = document.createElement('div');
    tip.id = 'global-tooltip';
    tip.innerHTML = text.replace(/\n/g, '<br>');
    tip.style.cssText = 'position:fixed;background:#1a1a2e;color:#e8d5ff;padding:8px 13px;border-radius:10px;font-size:0.78rem;max-width:240px;z-index:100000;border:1px solid #9966ff;box-shadow:0 4px 16px rgba(0,0,0,0.4);pointer-events:none;line-height:1.5;';
    document.body.appendChild(tip);
    var r = el.getBoundingClientRect();
    var left = Math.min(r.left, window.innerWidth - 260);
    var top  = r.bottom + 8;
    if (top + 120 > window.innerHeight) top = r.top - 10 - tip.offsetHeight;
    tip.style.left = Math.max(8, left) + 'px';
    tip.style.top  = top + 'px';
  }
  function hide() { if (tip) { tip.remove(); tip = null; } }
  document.addEventListener('mouseover', function(e) {
    var t = e.target.closest('[data-tooltip]');
    if (t) show(t, t.getAttribute('data-tooltip'));
    else hide();
  }, true);
  document.addEventListener('touchstart', hide, true);
  document.addEventListener('scroll', hide, true);
})();
// Refresh notification badge when user returns to this tab
document.addEventListener('visibilitychange', function() {
  if (document.hidden) {
    _notifTabHidden = true;
  } else {
    _notifTabHidden = false;
    if (currentUser) updateNotificationBadge().catch(function() {});
  }
});

function dbg() { if (DEBUG) console.log.apply(console, arguments); }

// ══════════════════════════════════════════════════════════════════════════
// SUPABASE INITIALIZATION
// ══════════════════════════════════════════════════════════════════════════
var SUPABASE_URL = 'https://hqzugbxutgefjilgmxqu.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxenVnYnh1dGdlZmppbGdteHF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MTE5NjEsImV4cCI6MjA5MDQ4Nzk2MX0.A3bQMriwY8j9GasUywq_8hKlnkEQQNMyB2ykSaQR68c';

// Initialize supabaseClient - wait for library to load
/* ═══════════════════════════════════════════════════════════════════════
   BATTLE SOUND EFFECTS SYSTEM
   ═══════════════════════════════════════════════════════════════════════ */

var battleSounds = {
  playerLight: '/sounds/hit-light.mp3',
  playerNormal: '/sounds/hit-normal.mp3',
  playerCrit: '/sounds/hit-crit.mp3',
  enemyLight: '/sounds/enemy-hit-light.mp3',
  enemyNormal: '/sounds/enemy-hit-normal.mp3',
  enemyCrit: '/sounds/enemy-hit-crit.mp3',
  
  // Boss attack sounds with variance (creepy flute variants)
  bossLight: '/sounds/piper-flute-light.mp3',    // Soft, eerie flute
  bossNormal: '/sounds/piper-flute-normal.mp3',  // Main creepy flute
  bossCrit: '/sounds/piper-flute-crit.mp3',      // Intense/distorted flute
  
  victory: '/sounds/victory.mp3',
  defeat: '/sounds/defeat.mp3'
};

// ─── Sound files exist in /sounds/ directory ──────────────────────────────
var SOUNDS_ENABLED = true;
// ─────────────────────────────────────────────────────────────────────────

// ── CHIPTUNE CELEBRATION SOUNDS (Web Audio API — no files needed) ──────────
// Small, quiet, happy chiptune bleeps for celebration events.
var _celebAudioCtx = null;
function _getCelebCtx() {
  if (!_celebAudioCtx) {
    try { _celebAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { /* silent */ }
  }
  return _celebAudioCtx;
}

function playChiptune(type) {
  var ctx = _getCelebCtx();
  if (!ctx) return;
  try {
    // Note sequences per event type (frequencies in Hz, duration in ms)
    var sequences = {
      milestone: [[523,80],[659,80],[784,80],[1047,160]],    // C E G C  — rising triumphant
      levelup:   [[392,70],[523,70],[659,70],[784,70],[1047,120]], // G C E G C
      badge:     [[659,80],[784,80],[1047,130]],              // E G C
      variant:   [[784,70],[1047,70],[1319,70],[1568,140]],   // G C E G  — sparkly high
    };
    var notes = sequences[type] || sequences.milestone;
    var t = ctx.currentTime + 0.01;
    notes.forEach(function(note) {
      var osc   = ctx.createOscillator();
      var gain  = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(note[0], t);
      gain.gain.setValueAtTime(0.04, t);          // very quiet
      gain.gain.exponentialRampToValueAtTime(0.001, t + note[1] / 1000);
      osc.start(t);
      osc.stop(t + note[1] / 1000 + 0.02);
      t += note[1] / 1000;
    });
  } catch(e) { dbg('Chiptune play error:', e); }
}
// ──────────────────────────────────────────────────────────────────────────

var audioCache = {};
var lastSoundTime = 0;
var soundCooldown = 300; // Default; updated to GAME_CONSTANTS.SOUND_COOLDOWN_MS after constants are defined

// ═══════════════════════════════════════════════════════════════════════
// AUDIO PRELOADING - Lazy load strategy for better performance
// ═══════════════════════════════════════════════════════════════════════

// FIX 3: Priority sounds preloaded immediately, others loaded on-demand
var prioritySounds = ['playerNormal', 'enemyNormal', 'playerCrit'];

function preloadPrioritySounds() {
  if (!SOUNDS_ENABLED) return; // No sound files yet
  prioritySounds.forEach(function(key) {
    if (battleSounds[key] && !audioCache[key]) {
      var audio = new Audio(battleSounds[key]);
      audio.volume = 0.35;
      audio.preload = 'auto';
      audio.onerror = function() {
        dbg('Sound file not available:', battleSounds[key]);
        audioCache[key] = null;
      };
      audioCache[key] = audio;
    }
  });
  dbg('✅ Priority audio preloaded:', prioritySounds.join(', '));
}

function loadSoundOnDemand(soundKey) {
  if (!SOUNDS_ENABLED) return null;
  if (!battleSounds[soundKey]) return null;
  if (audioCache[soundKey]) return audioCache[soundKey];
  
  // Load on demand and cache
  var audio = new Audio(battleSounds[soundKey]);
  audio.volume = 0.35;
  audio.preload = 'auto';
  audio.onerror = function() {
    dbg('Sound file not available:', battleSounds[soundKey]);
    audioCache[soundKey] = null;
  };
  audioCache[soundKey] = audio;
  dbg('🔊 Loaded sound on demand:', soundKey);
  return audio;
}

// Preload priority sounds on first user interaction
var audioPreloaded = false;
document.addEventListener('click', function preloadOnClick() {
  if (!audioPreloaded) {
    preloadPrioritySounds();
    audioPreloaded = true;
  }
}, { once: true });

// ═══════════════════════════════════════════════════════════════════════
// TIMER CLEANUP SYSTEM - Prevents memory leaks
// ═══════════════════════════════════════════════════════════════════════
var activeTimers = {
  intervals: [],
  timeouts: []
};

function safeSetInterval(fn, delay) {
  var id = setInterval(fn, delay);
  activeTimers.intervals.push(id);
  return id;
}

function safeSetTimeout(fn, delay) {
  var id = setTimeout(fn, delay);
  activeTimers.timeouts.push(id);
  return id;
}

function safeClearInterval(id) {
  clearInterval(id);
  var index = activeTimers.intervals.indexOf(id);
  if (index > -1) {
    activeTimers.intervals.splice(index, 1);
  }
}

function safeClearTimeout(id) {
  clearTimeout(id);
  var index = activeTimers.timeouts.indexOf(id);
  if (index > -1) {
    activeTimers.timeouts.splice(index, 1);
  }
}

function cleanupAllTimers() {
  // System timers (weather, events, news, notifications) live outside activeTimers
  // and must not be cleared on tab switch. UI/particle cleanup happens in showTab().
  dbg('✅ Timer cleanup skipped — system timers preserved');
}

function playBattleSound(soundKey, volume, forceBoss) {
  if (!SOUNDS_ENABLED) return;
  // Rate limiting - prevent sound spam
  var now = Date.now();
  if (!forceBoss && now - lastSoundTime < soundCooldown) {
    return; // Skip this sound
  }
  lastSoundTime = now;
  
  // FIX 3: Get audio from cache or load on-demand
  var audio = audioCache[soundKey];
  
  // If not cached, try to load on-demand
  if (!audio) {
    audio = loadSoundOnDemand(soundKey);
  }
  
  // If still null (missing file), skip
  if (!audio) {
    return;
  }
  
  // Clone audio node to allow overlapping sounds
  var sound = audio.cloneNode();
  sound.volume = volume || 0.35;
  
  sound.play().catch(function(err) {
    // Silently fail if sound can't play
  });
}

function getBattleSoundKey(attacker, variance) {
  var prefix = attacker === 'player' ? 'player' : 'enemy';
  
  if (variance === -1) {
    return prefix + 'Light';
  } else if (variance === 0) {
    return prefix + 'Normal';
  } else {
    return prefix + 'Crit';
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN GAME CODE
   ═══════════════════════════════════════════════════════════════════════ */

var supabaseClient = null;

function initSupabase() {
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      }
    });
    dbg('✅ Supabase initialized');
    return true;
  }
  return false;
}

// Try to initialize immediately
if (!initSupabase()) {
  // If library not loaded yet, poll until it is
  dbg('Waiting for Supabase library...');
  var checkSupabase = setInterval(function() {
    if (typeof supabase !== 'undefined' && supabase.createClient) {
      initSupabase();
      clearInterval(checkSupabase);
      // Retry the auth gate after initialization
      if (typeof initApp === 'function') {
        initApp();
      }
    }
  }, 100);
}

// ── CONFIG ──────────────────────────────
var TWITCH_CLIENT_ID = 'moqd3war5e7fleif8yte1d8n6kl25u';
var TWITCH_REDIRECT_URI = 'https://pawketpets.net/';
var STREAMER_IDS = {
  embertail: '91821604',
  pyxshuul:  '1459912293',
  aria:      '1445288832',
  blushimia: '659500662',
  cowbee:    '203845195',
  kelta:     '121490227',
  jess:      '88727356',
  gnarly:    '531222973'
};

// ── GLOBALS ──────────────────────────────
var currentUser = null;
var currentUsername = null; // cached players.username — currentUser is the Supabase Auth object and has no username field of its own
var currentPoints = 0;
var tabsLoaded = {};

// ── TUTORIAL & SETTINGS ──────────────────
var playerSettings = {
  spooky_enabled: false,
  music_enabled: true,
  music_volume: 70,
  sfx_volume: 80,
  daynight_enabled: true,
  weather_enabled: true,
  tutorial_completed: false,
  active_theme: 'classic'
};

// ═══════════════════════════════════════════════════════════════════════════
// SEASONAL UI THEMES
// ═══════════════════════════════════════════════════════════════════════════

var THEME_CATALOG = [
  { id:'classic',   name:'Classic Purple', emoji:'💜', colors:['#9966ff','#ff66cc'], alwaysUnlocked:true,  unlockHint:'Always free!' },
  { id:'autumn',    name:'Cozy Autumn',    emoji:'🍂', colors:['#c0672a','#e8a030'], alwaysUnlocked:true,  unlockHint:'Free seasonal theme' },
  { id:'winter',    name:'Winter Aurora',  emoji:'❄️', colors:['#005f99','#00b4db'], passLevel:15,         unlockHint:'PawketPass Lv. 15' },
  { id:'halloween', name:'Spooky Season',  emoji:'🎃', colors:['#5c1a00','#ff6b35'], alwaysUnlocked:true,  unlockHint:'Halloween event' },
  { id:'golden',    name:'Golden Age',     emoji:'✨', colors:['#8b6914','#ffd700'], streakRequired:30,    unlockHint:'30-day login streak' }
];

function theme_isUnlocked(themeId) {
  var t = THEME_CATALOG.find(function(x) { return x.id === themeId; });
  if (!t) return false;
  if (t.alwaysUnlocked) return true;
  if (t.passLevel && typeof passProgress !== 'undefined' && passProgress && passProgress.level >= t.passLevel) return true;
  if (t.streakRequired && currentUser && (currentUser.login_streak || 0) >= t.streakRequired) return true;
  try {
    var list = JSON.parse(localStorage.getItem('unlockedThemes') || '[]');
    if (list.indexOf(themeId) !== -1) return true;
  } catch(e) { /* silent */ }
  return false;
}

function theme_grant(themeId) {
  try {
    var list = JSON.parse(localStorage.getItem('unlockedThemes') || '[]');
    if (list.indexOf(themeId) === -1) {
      list.push(themeId);
      localStorage.setItem('unlockedThemes', JSON.stringify(list));
      var t = THEME_CATALOG.find(function(x) { return x.id === themeId; });
      if (typeof showToast === 'function') showToast('🎨 Theme unlocked: ' + (t ? t.name : themeId) + '!', 3000);
    }
  } catch(e) { /* silent */ }
}

function theme_apply(themeId) {
  if (!theme_isUnlocked(themeId)) { showToast('🔒 Theme not unlocked yet!', 2500); return; }
  THEME_CATALOG.forEach(function(t) { document.body.classList.remove('theme-' + t.id); });
  if (themeId !== 'classic') document.body.classList.add('theme-' + themeId);
  playerSettings.active_theme = themeId;
  try {
    var key = currentUser ? 'playerSettings_' + currentUser.id : 'playerSettings_guest';
    var saved = JSON.parse(localStorage.getItem(key) || '{}');
    saved.active_theme = themeId;
    localStorage.setItem(key, JSON.stringify(saved));
  } catch(e) { /* silent */ }
  document.querySelectorAll('.theme-swatch').forEach(function(sw) {
    sw.classList.toggle('active', sw.dataset.themeId === themeId);
  });
}

function theme_loadSaved() {
  try {
    var key = currentUser ? 'playerSettings_' + currentUser.id : 'playerSettings_guest';
    var saved = JSON.parse(localStorage.getItem(key) || '{}');
    if (saved.active_theme) { playerSettings.active_theme = saved.active_theme; theme_apply(saved.active_theme); }
  } catch(e) { /* silent */ }
}

function theme_renderSelector(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var html = '<div class="theme-selector-grid">';
  THEME_CATALOG.forEach(function(t) {
    var unlocked = theme_isUnlocked(t.id);
    var active   = playerSettings.active_theme === t.id;
    html += '<div class="theme-swatch' + (active ? ' active' : '') + (unlocked ? '' : ' locked') + '"' +
      ' data-theme-id="' + t.id + '"' + (unlocked ? ' onclick="theme_apply(\'' + t.id + '\')"' : '') + '>' +
      '<div class="theme-swatch-preview" style="background:linear-gradient(135deg,' + t.colors[0] + ',' + t.colors[1] + ');display:flex;align-items:center;justify-content:center;font-size:1.6rem;">' + t.emoji + '</div>' +
      '<div class="theme-swatch-label">' + t.name + '</div>' +
      (!unlocked ? '<div class="theme-swatch-hint">' + t.unlockHint + '</div><div class="theme-swatch-lock">🔒</div>' : '') +
      '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROFILE COSMETICS CATALOG
// ═══════════════════════════════════════════════════════════════════════════

var COSMETICS_CATALOG = {
  backgrounds: [
    // ── Free for everyone ──
    { id:'bg_default',    name:'Classic',        emoji:'💜', gradient:'linear-gradient(135deg,#9966ff,#764ba2)', alwaysUnlocked:true, unlockHint:'Free for everyone' },
    { id:'bg_dreamy',     name:'Dreamy Skies',   emoji:'☁️', gradient:'linear-gradient(135deg,#a8edea,#fed6e3)', alwaysUnlocked:true, unlockHint:'Free for everyone' },
    { id:'bg_sunset',     name:'Sunset Glow',    emoji:'🌅', gradient:'linear-gradient(135deg,#ff9a9e,#fecfef)', alwaysUnlocked:true, unlockHint:'Free for everyone' },
    { id:'bg_midnight',   name:'Midnight Stars', emoji:'🌙', gradient:'linear-gradient(135deg,#2c3e50,#3498db)', alwaysUnlocked:true, unlockHint:'Free for everyone' },
    { id:'bg_candy',      name:'Candy Land',     emoji:'🍬', gradient:'linear-gradient(135deg,#ff6b9d,#ffb3c6,#ffdee9)', alwaysUnlocked:true, unlockHint:'Free for everyone' },
    { id:'bg_cafe',       name:'Cozy Café',      emoji:'☕', gradient:'linear-gradient(135deg,#d4a373,#faedcd,#fefae0)', alwaysUnlocked:true, unlockHint:'Free for everyone' },
    { id:'bg_galaxy',     name:'Cosmic Void',    emoji:'🌌', gradient:'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)', alwaysUnlocked:true, unlockHint:'Free for everyone' },
    { id:'bg_garden',     name:'Garden',         emoji:'🌸', gradient:'linear-gradient(135deg,#a8edea,#fed6e3)', alwaysUnlocked:true, unlockHint:'Free for everyone' },
    // ── Earned ──
    { id:'bg_forest',     name:'Forest Glade',   emoji:'🌲', gradient:'linear-gradient(135deg,#134e5e,#71b280)',  unlockHint:'Reach player level 10' },
    { id:'bg_stars',      name:'Starry Night',   emoji:'✨', gradient:'linear-gradient(135deg,#000428,#004e92)',  unlockHint:'30-day login streak' },
    { id:'bg_castle',     name:'Battle Keep',    emoji:'🏰', gradient:'linear-gradient(135deg,#2c3e50,#8e44ad)',  unlockHint:'Win 50 battles' },
    { id:'bg_desert',     name:'Dusk Desert',    emoji:'🏜️', gradient:'linear-gradient(135deg,#c94b4b,#4b134f)',  unlockHint:'Win 100 battles' },
    { id:'bg_clouds',     name:'Cloud Nine',     emoji:'☁️', gradient:'linear-gradient(135deg,#89f7fe,#66a6ff)',  unlockHint:'Reach player level 20' },
    { id:'bg_rainbow',    name:'Rainbow Road',   emoji:'🌈', gradient:'linear-gradient(90deg,#ff0000,#ff7f00,#ffff00,#00ff00,#0000ff,#4b0082,#9400d3)', unlockHint:'Complete Bingo blackout' },
    { id:'bg_legendary',  name:'Legendary',      emoji:'👑', gradient:'linear-gradient(135deg,#f7971e,#ffd200)',  unlockHint:'Reach player level 50' },
    { id:'bg_underwater', name:'Underwater',     emoji:'🐠', gradient:'linear-gradient(135deg,#0052d4,#65c7f7)',  unlockHint:'50-day login streak' },
    { id:'bg_volcano',    name:'Volcano',        emoji:'🌋', gradient:'linear-gradient(135deg,#ff512f,#dd2476)',  unlockHint:'Defeat 10 bosses' },
    { id:'bg_aurora',     name:'Aurora Bloom',   emoji:'🌿', gradient:'linear-gradient(135deg,#0f9b8e,#bdc372)',  unlockHint:'Contribute to 10 community goals' },
    { id:'bg_rose',       name:'Rose Gold',      emoji:'🌹', gradient:'linear-gradient(135deg,#f093fb,#f5576c)',  unlockHint:'Send 50 gifts' },
  ],
  frames: [
    // ── Free for everyone ──
    { id:'frame_classic',   name:'Classic',    emoji:'💜', previewColor:'#9966ff', cssClass:'frame-classic',  alwaysUnlocked:true, unlockHint:'Free for everyone' },
    { id:'frame_dashed',    name:'Dashed',     emoji:'┅',  previewColor:'#9966ff', cssClass:'frame-dashed',   alwaysUnlocked:true, unlockHint:'Free for everyone' },
    { id:'frame_dotted',    name:'Dotted',     emoji:'⋯',  previewColor:'#9966ff', cssClass:'frame-dotted',   alwaysUnlocked:true, unlockHint:'Free for everyone' },
    { id:'frame_double',    name:'Double',     emoji:'═',  previewColor:'#9966ff', cssClass:'frame-double',   alwaysUnlocked:true, unlockHint:'Free for everyone' },
    { id:'frame_soft',      name:'Soft',       emoji:'●',  previewColor:'#ff99cc', cssClass:'frame-soft',     alwaysUnlocked:true, unlockHint:'Free for everyone' },
    { id:'frame_glow',      name:'Glowing',    emoji:'💫', previewColor:'#9966ff', cssClass:'frame-glow-free',alwaysUnlocked:true, unlockHint:'Free for everyone' },
    { id:'frame_paw',       name:'Paw Prints', emoji:'🐾', previewColor:'#ff9966', cssClass:'frame-paw',      alwaysUnlocked:true, unlockHint:'Free for everyone' },
    // ── Earned ──
    { id:'frame_silver',    name:'Silver',     emoji:'⚪', previewColor:'#c0c0c0', cssClass:'frame-silver',    unlockHint:'Reach player level 10' },
    { id:'frame_gold',      name:'Gold',       emoji:'🟡', previewColor:'#ffd700', cssClass:'frame-gold',      unlockHint:'Reach player level 20' },
    { id:'frame_fire',      name:'Fire',       emoji:'🔥', previewColor:'#ff4500', cssClass:'frame-fire',      unlockHint:'Win 100 battles' },
    { id:'frame_ice',       name:'Ice',        emoji:'❄️', previewColor:'#00d2ff', cssClass:'frame-ice',       unlockHint:'30-day login streak' },
    { id:'frame_rainbow',   name:'Rainbow',    emoji:'🌈', previewColor:'#ff69b4', cssClass:'frame-rainbow',   unlockHint:'Complete Bingo blackout' },
    { id:'frame_sparkle',   name:'Sparkle',    emoji:'✨', previewColor:'#ffd700', cssClass:'frame-sparkle-earned', unlockHint:'Referred 5 friends' },
    { id:'frame_legendary', name:'Legendary',  emoji:'✨', previewColor:'#ffd700', cssClass:'frame-legendary', unlockHint:'Reach player level 50' },
    { id:'frame_void',      name:'Void',       emoji:'🌑', previewColor:'#8b00ff', cssClass:'frame-void',      unlockHint:'Ultra rare drop' },
    { id:'frame_crown',     name:'Crown',      emoji:'👑', previewColor:'#ffd700', cssClass:'frame-crown',     unlockHint:'Win 50 battles in a row' },
    { id:'frame_glitch',    name:'Glitch',     emoji:'📺', previewColor:'#ff00ff', cssClass:'frame-glitch',    unlockHint:'Secret code: GLITCH' },
  ],
  badges: [
    // ── Free starter badges (equip to show personality) ──
    { id:'badge_newbie',      name:'Newbie',          emoji:'🌱', color:'#8e8e8e', alwaysUnlocked:true,  unlockHint:'Free for everyone' },
    { id:'badge_explorer',    name:'Explorer',         emoji:'🗺️', color:'#5cb85c', alwaysUnlocked:true,  unlockHint:'Free for everyone' },
    { id:'badge_friendly',    name:'Friendly',         emoji:'😊', color:'#f1c40f', alwaysUnlocked:true,  unlockHint:'Free for everyone' },
    { id:'badge_helpful',     name:'Helpful',          emoji:'🤝', color:'#3498db', alwaysUnlocked:true,  unlockHint:'Free for everyone' },
    { id:'badge_creative',    name:'Creative',         emoji:'🎨', color:'#9b59b6', alwaysUnlocked:true,  unlockHint:'Free for everyone' },
    { id:'badge_brave',       name:'Brave',            emoji:'🦁', color:'#e67e22', alwaysUnlocked:true,  unlockHint:'Free for everyone' },
    // ── Earned badges ──
    { id:'badge_recruit',     name:'Recruit',          emoji:'🎖️', color:'#8e8e8e', alwaysUnlocked:false, unlockHint:'Complete tutorial' },
    { id:'badge_level_20',    name:'Veteran',          emoji:'⭐',  color:'#c0c0c0',                       unlockHint:'Reach player level 20' },
    { id:'badge_level_50',    name:'Mythic',           emoji:'💫',  color:'#ff9800',                       unlockHint:'Reach player level 50' },
    { id:'badge_100_battles', name:'Veteran Fighter',  emoji:'⚔️',  color:'#5bc0de',                       unlockHint:'Win 100 battles' },
    { id:'badge_30_days',     name:'Loyal',            emoji:'🗓️',  color:'#5cb85c',                       unlockHint:'30-day login streak' },
    { id:'badge_100_days',    name:'Devoted',          emoji:'💎',  color:'#5bc0de',                       unlockHint:'100-day login streak' },
    { id:'badge_pet_20',      name:'Collector',        emoji:'🐾',  color:'#ff69b4',                       unlockHint:'Own 20 pets' },
    { id:'badge_boss_10',     name:'Boss Slayer',      emoji:'👑',  color:'#ff4500',                       unlockHint:'Defeat 10 bosses' },
    { id:'badge_treats_100',  name:'Feeder',           emoji:'🍖',  color:'#5dde7a',                       unlockHint:'Feed pets 100 times' },
    { id:'badge_gift_giver',  name:'Gift Giver',       emoji:'🎁',  color:'#ff6b9d',                       unlockHint:'Send your first gift' },
    { id:'badge_generous',    name:'Generous Soul',    emoji:'💝',  color:'#ff6b9d',                       unlockHint:'Send 10 gifts' },
    { id:'badge_philanthropist',name:'Philanthropist', emoji:'🏦',  color:'#ffd700',                       unlockHint:'Send 50 gifts' },
    { id:'badge_snapshot',    name:'Snapshot',         emoji:'📸',  color:'#5bc0de',                       unlockHint:'Share your first screenshot' },
    { id:'badge_social_butterfly',name:'Social Butterfly',emoji:'📱',color:'#9b59b6',                    unlockHint:'Share 5 screenshots' },
    { id:'badge_voter',       name:'Voice of the People',emoji:'🗳️',color:'#3498db',                      unlockHint:'Vote in 3 polls' },
    { id:'badge_poll_champ',  name:'Poll Champion',    emoji:'📊',  color:'#9b59b6',                       unlockHint:'Vote in 15 polls' },
    { id:'badge_speed_demon', name:'Speed Demon',      emoji:'⚡',  color:'#ffd700',                       unlockHint:'Win a battle in under 3 turns' },
    { id:'badge_the_wall',    name:'The Wall',         emoji:'🛡️',  color:'#5bc0de',                       unlockHint:'Win a battle taking <10 damage' },
    { id:'badge_comeback',    name:'Comeback King',    emoji:'🔥',  color:'#ff4500',                       unlockHint:'Win a battle at <5% HP' },
    { id:'badge_team_player', name:'Team Player',      emoji:'🤝',  color:'#5cb85c',                       unlockHint:'Contribute to a community goal' },
    { id:'badge_global_hero', name:'Global Hero',      emoji:'🌍',  color:'#3498db',                       unlockHint:'Contribute to 10 community goals' },
  ]
};

var equippedCosmetics = { background:'bg_default', frame:'frame_classic', badges:[] };

function cosmetics_loadEquipped() {
  if (!currentUser) return;
  try {
    var saved = JSON.parse(localStorage.getItem('equippedCosmetics_' + currentUser.id) || 'null');
    if (saved) Object.assign(equippedCosmetics, saved);
  } catch(e) { /* silent */ }
}

function cosmetics_saveEquipped() {
  if (!currentUser) return;
  try { localStorage.setItem('equippedCosmetics_' + currentUser.id, JSON.stringify(equippedCosmetics)); } catch(e) { /* silent */ }
}

function cosmetics_isOwned(type, id) {
  var catalog = COSMETICS_CATALOG[type + 's'] || [];
  var item = catalog.find(function(c) { return c.id === id; });
  if (!item) return false;
  if (item.alwaysUnlocked) return true;
  var stateKey = 'unlocked' + type.charAt(0).toUpperCase() + type.slice(1) + 's';
  var unlocked = (phase1_state && phase1_state[stateKey]) ? phase1_state[stateKey] : [];
  return unlocked.indexOf(id) !== -1;
}

function cosmetics_equip(type, id) {
  if (!cosmetics_isOwned(type, id)) { showToast('🔒 Cosmetic not unlocked yet!', 2500); return; }
  var catalog = COSMETICS_CATALOG[type + 's'] || [];
  var item = catalog.find(function(c) { return c.id === id; });
  if (!item) return;
  if (type === 'badge') {
    var idx = equippedCosmetics.badges.indexOf(id);
    if (idx !== -1) { equippedCosmetics.badges.splice(idx,1); showToast('Badge removed', 1500); }
    else { if (equippedCosmetics.badges.length >= 3) equippedCosmetics.badges.shift(); equippedCosmetics.badges.push(id); showToast(item.emoji + ' Badge equipped!', 1500); }
  } else {
    equippedCosmetics[type] = id;
    showToast(item.emoji + ' ' + item.name + ' equipped!', 2000);
  }
  cosmetics_saveEquipped();
  cosmetics_applyToProfile();
  cosmetics_renderPanel('cosmetics-panel-content', cosmetics_currentTab);
}

function cosmetics_applyToProfile() {
  // Profile header background
  var header = document.querySelector('.myprofile-preview-header, .profile-header');
  if (header) {
    var bg = COSMETICS_CATALOG.backgrounds.find(function(b) { return b.id === equippedCosmetics.background; });
    if (bg) { header.style.background = bg.gradient; header.style.borderRadius = '16px'; header.style.padding = '24px'; }
  }
  // Avatar frame
  var avatars = ['profile-avatar','myprofile-avatar-preview'];
  avatars.forEach(function(avatarId) {
    var avatar = document.getElementById(avatarId);
    if (!avatar) return;
    COSMETICS_CATALOG.frames.forEach(function(f) { avatar.classList.remove(f.cssClass); });
    var frame = COSMETICS_CATALOG.frames.find(function(f) { return f.id === equippedCosmetics.frame; });
    if (frame) { avatar.classList.add(frame.cssClass); avatar.style.borderWidth = '4px'; avatar.style.borderStyle = 'solid'; }
  });
  // Badge row
  var badgeRow = document.getElementById('profile-badge-display');
  if (badgeRow) {
    badgeRow.innerHTML = '';
    equippedCosmetics.badges.forEach(function(badgeId) {
      var badge = COSMETICS_CATALOG.badges.find(function(b) { return b.id === badgeId; });
      if (badge) {
        var pip = document.createElement('span');
        pip.className = 'profile-badge-pip'; pip.textContent = badge.emoji;
        pip.title = badge.name; pip.style.filter = 'drop-shadow(0 0 4px ' + badge.color + ')';
        badgeRow.appendChild(pip);
      }
    });
  }
}

var cosmetics_currentTab = 'backgrounds';

function cosmetics_renderPanel(containerId, tab) {
  var container = document.getElementById(containerId);
  if (!container) return;
  cosmetics_currentTab = tab;
  var typeKey = tab;
  var catalog = COSMETICS_CATALOG[typeKey] || [];
  var typeSingular = typeKey === 'backgrounds' ? 'background' : typeKey === 'frames' ? 'frame' : 'badge';
  var html = '<div class="cosmetics-grid">';
  catalog.forEach(function(item) {
    var owned   = cosmetics_isOwned(typeSingular, item.id);
    var equipped = typeSingular === 'badge'
      ? equippedCosmetics.badges.indexOf(item.id) !== -1
      : equippedCosmetics[typeSingular] === item.id;
    var preview = '';
    if (typeKey === 'backgrounds') {
      preview = '<div class="cosmetic-preview" style="background:' + item.gradient + ';border-radius:4px 4px 0 0;"></div>';
    } else if (typeKey === 'frames') {
      preview = '<div class="cosmetic-preview"><div style="width:44px;height:44px;border-radius:50%;border:4px solid ' + item.previewColor + ';box-shadow:0 0 10px ' + item.previewColor + ';display:flex;align-items:center;justify-content:center;font-size:1.4rem;">' + item.emoji + '</div></div>';
    } else {
      preview = '<div class="cosmetic-preview" style="font-size:2rem;">' + item.emoji + '</div>';
    }
    html += '<div class="cosmetic-item' + (equipped?' equipped-cosmetic':'') + (owned?'':' locked-cosmetic') + '"' +
      (owned ? ' onclick="cosmetics_equip(\'' + typeSingular + '\',\'' + item.id + '\')"' : '') + '>' +
      preview +
      (equipped ? '<div class="cosmetic-equipped-badge">ON</div>' : '') +
      (!owned   ? '<div class="cosmetic-lock-icon">🔒</div>' : '') +
      '<div class="cosmetic-name">' + item.name + '</div>' +
      (!owned   ? '<div class="cosmetic-unlock-hint">' + item.unlockHint + '</div>' : '') +
      '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

function cosmetics_renderFullPanel(mountId) {
  var mount = document.getElementById(mountId);
  if (!mount) return;
  var tabs = [['backgrounds','🖼️ Backgrounds'],['frames','🔲 Frames'],['badges','🏅 Badges']];
  var tabHtml = '<div class="cosmetics-panel-tabs">';
  tabs.forEach(function(tab) {
    tabHtml += '<button class="cosmetics-panel-tab' + (tab[0] === cosmetics_currentTab ? ' active' : '') + '" onclick="cosmetics_switchTab(\'' + tab[0] + '\')">' + tab[1] + '</button>';
  });
  tabHtml += '</div><div id="cosmetics-panel-content"></div>';
  mount.innerHTML = tabHtml;
  cosmetics_renderPanel('cosmetics-panel-content', cosmetics_currentTab);
}

function cosmetics_switchTab(tab) {
  cosmetics_currentTab = tab;
  document.querySelectorAll('.cosmetics-panel-tab').forEach(function(btn) {
    var label = btn.textContent.toLowerCase();
    btn.classList.toggle('active', label.indexOf(tab.replace('s','')) !== -1);
  });
  cosmetics_renderPanel('cosmetics-panel-content', tab);
}

// Daily tips array for home page
var dailyTips = [
  "Pets with higher happiness perform better in battles!",
  "Play minigames daily to earn PawketPoints!",
  "Your pet's level increases their battle stats!",
  "Boss battles drop exclusive items!",
  "Equipment boosts your pet's combat stats!",
  "Ember's Flametail Strike deals 1.5x damage!",
  "Pyxie's Raspberry Soda Stream heals while attacking!",
  "Login daily to build your streak for bonus rewards!",
  "Feed your pets to keep them happy and healthy!",
  "Check the leaderboard to see top players!",
  "Friend other players to see their activity!",
  "Leave guestbook messages on profiles!",
  "Evolving your pet changes their appearance!",
  "Pets have 3 evolution stages: Baby, Teen, and Adult!",
  "Win battles to earn XP and level up your pet!",
  "The shop has items in different tiers - higher tiers cost more!",
  "Boss battles are the ultimate challenge!",
  "Skills have a 30% chance to activate each turn!",
  "You can earn badges by completing achievements!",
  "Visit Melon's shop to buy treats and equipment!",
  "Battle in different forest zones for varying rewards!",
  "Your day streak is displayed in the sidebar!",
  "Blocked users cannot view your profile!",
  "Notifications appear when friends interact with you!",
  "Check your activity feed to see what friends are up to!"
];

// ══════════════════════════════════════════════════════════════════════════
// PET BACKSTORIES / BIOS
// ══════════════════════════════════════════════════════════════════════════

/**
 * Pet backstories - easily editable!
 * Format: petName: "Bio text here"
 */
var petBackstories = {
  'Ember': 'Co-founder of PawketPets! 🦊',
  'Pyxie': 'Co-founder of PawketPets! 🐰',
  'Blushimia': 'A silly dog princess who escaped her video game after gaining sentience! 👑🐕',
  'Jess': 'A local fossil and potion-prepping paleoart Parasaur specializing in the cute and creepy! 🦕⚗️',
  'Steve': 'A chill menace who clucks, bawks, bucks, and says the occasional bad word! 🐔⚡',
  'Kleat': 'A grand mage studying void and galaxy magic! Can open portals to anywhere! ✨🌌',
  'Gnarly': 'A radical gal running the PaleoPlex arcade! Loves Furbies and nachos! 🎮🦖',
  'Aria': 'A rosy maple moth fae who collects bones! Don\'t worry, she lets you keep yours until you\'re done with them. 🦋💀',
};

/**
 * Get pet backstory
 */
function getPetBackstory(petName) {
  return petBackstories[petName] || 'Coming soon... 🌟';
}

// ══════════════════════════════════════════════════════════════════════════
// EVOLUTION SYSTEM
// ══════════════════════════════════════════════════════════════════════════

function getEvolutionStage(level) {
  if (level >= 10) return 'adult';
  if (level >= 5) return 'teen';
  return 'baby';
}

function getEvolutionEmoji(stage) {
  if (stage === 'adult') return '🐺';
  if (stage === 'teen') return '🦊';
  return '🐣';
}

function getEvolutionBonuses(stage) {
  // Cumulative bonuses based on stage
  if (stage === 'adult') {
    return { hp: 5, attack: 3, defense: 2, speed: 1 }; // Total bonuses at adult
  }
  if (stage === 'teen') {
    return { hp: 2, attack: 1, defense: 1, speed: 0 }; // Bonuses at teen
  }
  return { hp: 0, attack: 0, defense: 0, speed: 0 }; // No bonuses as baby
}
var selectedPet = null;
var ownedPetIds = [];
var totalOwnedCount = 0;
var petState = {};
var inventoryItems = [];
var selectedInvItem = null;
var secretNumber = 0;
var guessesLeft = 3;
var memoryCards = [];
var flippedCards = [];
var matchedPairs = 0;
var triesLeft = 15;
var memoryEarned = 0;
var memoryLocked = false;
var memoryEmojis = ['&#128062;','&#127775;','&#128150;','&#9889;','&#127830;','&#127934;'];
var today = new Date().toISOString().split('T')[0];

// ── MUSIC ────────────────────────────────
var bgMusic = document.getElementById('bg-music');
bgMusic.volume = 0.4;

document.addEventListener('click', function startM() {
  bgMusic.play().catch(function(){});
  document.getElementById('music-play-btn').textContent = '\u23F8';
  document.removeEventListener('click', startM);
}, { once: true });

function toggleMusic() {
  if (bgMusic.paused) { bgMusic.play().catch(function(){}); document.getElementById('music-play-btn').textContent = '\u23F8'; }
  else { bgMusic.pause(); document.getElementById('music-play-btn').textContent = '\u25B6'; }
}
function stopMusic() { bgMusic.pause(); bgMusic.currentTime = 0; document.getElementById('music-play-btn').textContent = '\u25B6'; }
function setVolume(v) { bgMusic.volume = parseFloat(v); }

// ── TOAST ────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// PIXEL-ART TOAST NOTIFICATION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

var toastQueue = [];
var isShowingToast = false;

function showToast(msg, type, useModal) {
  // If useModal is true, use centered modal for important notifications
  if (useModal === true) {
    var icon = '🎉';
    var title = 'Notice';
    
    if (type === 'success') {
      icon = '✅';
      title = 'Success!';
    } else if (type === 'error') {
      icon = '❌';
      title = 'Error';
    } else if (type === 'warning') {
      icon = '⚠️';
      title = 'Warning';
    }
    
    showCenteredModal(title, msg, icon);
  } else {
    // Keep old toast behavior for minor notifications
    showPixelToast(msg, type || 'info');
  }
}

function showPixelToast(message, type) {
  // Add to queue
  toastQueue.push({ message: message, type: type || 'info' });
  
  // If not already showing, start queue
  if (!isShowingToast) {
    showNextToast();
  }
}

function showNextToast() {
  if (toastQueue.length === 0) {
    isShowingToast = false;
    return;
  }
  
  isShowingToast = true;
  var toast = toastQueue.shift();
  
  // Create toast element
  var toastEl = makeEl('div', { class: 'pixel-toast pixel-toast-' + toast.type });
  
  // Add icon based on type
  var icon = '';
  switch(toast.type) {
    case 'success': icon = '✓'; break;
    case 'error': icon = '✗'; break;
    case 'warning': icon = '⚠'; break;
    case 'info': 
    default: icon = 'ⓘ'; break;
  }
  
  toastEl.innerHTML = '<span class="pixel-toast-icon">' + icon + '</span><span class="pixel-toast-message">' + escapeHtml(toast.message) + '</span>';
  
  document.body.appendChild(toastEl);
  
  // Animate in
  setTimeout(function() {
    toastEl.classList.add('show');
  }, 10);
  
  // Remove after duration (default 5s — was 3s, bumped for readability)
  var toastDuration = (typeof type === 'number') ? type : 5000;
  setTimeout(function() {
    toastEl.classList.remove('show');
    setTimeout(function() {
      toastEl.remove();
      showNextToast();
    }, 300);
  }, toastDuration);
}

function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ── UTILS ────────────────────────────────
function el(id) { return document.getElementById(id); }

// ══════════════════════════════════════════════════════════════════════════
// RATE LIMITING - Client-side cooldowns to prevent spam
// ══════════════════════════════════════════════════════════════════════════

var actionCooldowns = {};

function canPerformAction(actionKey, cooldownMs) {
  var now = Date.now();
  if (actionCooldowns[actionKey] && now - actionCooldowns[actionKey] < cooldownMs) {
    return false;
  }
  actionCooldowns[actionKey] = now;
  return true;
}

function makeEl(tag, attrs, text) {
  var e = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(function(k){ e.setAttribute(k, attrs[k]); });
  if (text !== undefined) e.textContent = text;
  return e;
}

// ══════════════════════════════════════════════════════════════════════════
// GAME CONSTANTS — named values instead of scattered magic numbers
// ══════════════════════════════════════════════════════════════════════════
var GAME_CONSTANTS = {
  XP_PER_LEVEL:        120,   // XP needed per level (currentLevel * this)
  BATTLE_MAX_TURNS:    50,    // Max turns before battle auto-ends
  BOSS_ENCOUNTER_RATE: 0.03,  // 3% chance (~1 in 33 battles)
  SOUND_COOLDOWN_MS:   300,   // Minimum ms between sounds to avoid spam
  HP_REGEN_PER_HOUR:   3,     // HP regenerated per hour out of battle
  PASS_XP_PER_FEED:    2,     // Pass XP awarded for feeding a pet
  REFERRAL_PP_REWARD:  0,     // Legacy — replaced by tiered rewards below
  TUTORIAL_PP_REWARD:  100,   // PP awarded for completing tutorial
  TUTORIAL_SKIP_PP:    50,    // PP awarded for skipping tutorial
};
// ═══════════════════════════════════════════════════════════════════════════
// EVENT / WEATHER STATUS NAVBAR WIDGET
// Shows active event (priority) or current weather in the navbar center.
// Hover = tooltip, click = full detail modal.
// ═══════════════════════════════════════════════════════════════════════════

function updateEventStatusWidget() {
  var widget = document.getElementById('event-status-widget');
  if (!widget) return;

  var iconEl = document.getElementById('event-status-icon');
  var textEl = document.getElementById('event-status-text');
  var dotEl  = document.getElementById('event-status-dot');

  // Priority: active world event > weatherSystem (the single source of truth)
  var hasEvent = false;

  if (typeof worldEvents !== 'undefined' && worldEvents.currentEvent) {
    var ev = worldEvents.currentEvent;
    iconEl.textContent = ev.icon || '🎪';
    textEl.textContent = ev.name.length > 18 ? ev.name.substring(0, 15) + '…' : ev.name;
    dotEl.className = 'event-status-dot event-active';
    widget.dataset.type    = 'event';
    widget.dataset.name    = ev.name;
    widget.dataset.desc    = ev.description || '';
    widget.dataset.icon    = ev.icon || '🎪';
    widget.dataset.bonuses = esw_getEventBonusText(ev.effects || {});
    widget.dataset.endDate = (worldEvents.eventEndDate || '').toString();
    hasEvent = true;
  } else {
    // Weather from weatherSystem, the single source of truth
    var weatherId   = null;
    var weatherName = 'Clear';
    var weatherIcon = '☀️';
    var weatherDesc = 'Normal conditions today.';

    if (typeof weatherSystem !== 'undefined' && weatherSystem.currentWeather) {
      var ws = weatherSystem.currentWeather;
      weatherId   = ws.id;
      weatherName = ws.name;
      weatherIcon = ws.icon;
      weatherDesc = ws.description || '';
    }

    iconEl.textContent = weatherIcon;
    textEl.textContent = weatherName;
    dotEl.className    = 'event-status-dot active';
    widget.dataset.type = 'weather';
    widget.dataset.name = weatherName;
    widget.dataset.desc = weatherDesc;
    widget.dataset.icon = weatherIcon;
    widget.dataset.bonuses = esw_getWeatherBonusText(weatherId);
  }

  widget.style.display = 'flex';
}

function esw_getEventBonusText(effects) {
  var parts = [];
  if (effects.battleXpBonus   && effects.battleXpBonus > 1)   parts.push('⚔️ +' + Math.round((effects.battleXpBonus - 1) * 100) + '% Battle XP');
  if (effects.ppGainBonus     && effects.ppGainBonus > 1)      parts.push('💜 +' + Math.round((effects.ppGainBonus - 1) * 100) + '% PP Gain');
  if (effects.encounterRate   && effects.encounterRate > 1)    parts.push('✨ +' + Math.round((effects.encounterRate - 1) * 100) + '% Encounters');
  if (effects.energyRegen     && effects.energyRegen > 1)      parts.push('⚡ ' + effects.energyRegen + 'x Energy Regen');
  if (effects.happinessGain   && effects.happinessGain > 1)    parts.push('💖 +' + Math.round((effects.happinessGain - 1) * 100) + '% Happiness');
  if (effects.shopDiscount    && effects.shopDiscount < 1)     parts.push('🛒 ' + Math.round((1 - effects.shopDiscount) * 100) + '% Off Shop');
  if (effects.spoonDamageBonus && effects.spoonDamageBonus > 1) parts.push('🥄 +' + Math.round((effects.spoonDamageBonus - 1) * 100) + '% Spoon Damage');
  if (effects.randomBonusChance) parts.push('🎲 ' + Math.round(effects.randomBonusChance * 100) + '% Random Bonus Chance');
  return parts.join('\n') || 'No special bonuses';
}

function esw_getWeatherBonusText(weatherId) {
  // These match the actual values in weatherSystem.getWeatherBonus()
  var map = {
    clear:  '☀️ Normal conditions, no bonuses or penalties',
    sunny:  '☀️ +10% XP from all sources\n⚡ +15% Energy regen\n😊 Happiness decays 15% slower',
    rainy:  '🌧️ +5% PP from all sources\n😟 Happiness decays 10% faster',
    foggy:  '🌫️ +15% rare item drop chance',
    windy:  '💨 +10% Energy regen',
    starry: '✨ +20% XP from all sources\n💜 +15% PP from all sources\n⭐ +25% rare item drop chance',
    cursed: '🟣 -10% XP and PP from all sources\n⚡ -15% Energy regen\n😱 Happiness decays 20% faster'
  };
  return map[weatherId] || '✨ Normal conditions';
}

function esw_showTooltip() {
  esw_hideTooltip();
  var widget = document.getElementById('event-status-widget');
  if (!widget) return;

  var isEvent = widget.dataset.type === 'event';
  var bonuses = (widget.dataset.bonuses || '').trim();

  var timerHtml = '';
  if (isEvent && widget.dataset.endDate) {
    try {
      var end = new Date(widget.dataset.endDate);
      var hoursLeft = Math.max(0, Math.floor((end - Date.now()) / 3600000));
      if (hoursLeft > 0) {
        timerHtml = '<div class="esw-tooltip-timer">⏰ ' + hoursLeft + ' hour' + (hoursLeft !== 1 ? 's' : '') + ' remaining</div>';
      } else {
        timerHtml = '<div class="esw-tooltip-timer">⏰ Ending soon!</div>';
      }
    } catch(e) { /* silent */ }
  }

  var tip = document.createElement('div');
  tip.className = 'esw-tooltip';
  tip.id = 'esw-tooltip';
  tip.innerHTML =
    '<div class="esw-tooltip-title"><span>' + (widget.dataset.icon || '🌤️') + '</span><span>' + escapeHtml(widget.dataset.name || '') + (isEvent ? ' <span style="font-size:0.7rem;background:#fbbf2433;color:#fbbf24;padding:2px 6px;border-radius:6px;margin-left:4px;">EVENT</span>' : '') + '</span></div>' +
    '<div class="esw-tooltip-desc">' + escapeHtml(widget.dataset.desc || '') + '</div>' +
    (bonuses ? '<div class="esw-tooltip-bonus">' + escapeHtml(bonuses).replace(/\n/g, '<br>') + '</div>' : '') +
    timerHtml;

  document.body.appendChild(tip);

  // Position below widget
  var rect = widget.getBoundingClientRect();
  var tipW = 290;
  var left = rect.left + rect.width / 2 - tipW / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
  tip.style.top  = (rect.bottom + 8) + 'px';
  tip.style.left = left + 'px';
}

function esw_hideTooltip() {
  var tip = document.getElementById('esw-tooltip');
  if (tip) tip.remove();
}

function esw_showModal() {
  esw_hideTooltip();
  // Open the 7-day calendar instead of the old single-condition modal
  calendar_open();
}

// ─── EVENT CALENDAR ──────────────────────────────────────────────────────────

var WEATHER_ICONS = {
  clear:'☀️', rainy:'🌧️', foggy:'🌫️', windy:'💨', starry:'✨', cursed:'🟣'
};
var EVENT_TYPE_ICONS = {
  weather:'🌤️', bonus_event:'⚡', holiday:'🎉', streamer_birthday:'🎂'
};

async function calendar_open() {
  var modal = makeModal();
  modal.innerHTML = '<div style="text-align:center;padding:20px 0;"><div class="spinner"></div><div style="color:var(--text-light);margin-top:8px;font-size:0.85rem;">Loading forecast…</div></div>';
  openModal(modal);
  await calendar_load(modal);
}

async function calendar_load(modal) {
  // Build 7-day array starting from today
  var days = [];
  var now = new Date();

  for (var i = 0; i < 7; i++) {
    var d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push({
      date: d,
      dateStr: d.toISOString().slice(0, 10),
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' }),
      weather: null,
      event: null,
      isToday: i === 0
    });
  }

  // Today: use live in-memory state, then check daily_features for override
  if (typeof weatherSystem !== 'undefined' && weatherSystem.currentWeather) {
    days[0].weather = weatherSystem.currentWeather;
  }
  if (typeof worldEvents !== 'undefined' && worldEvents.currentEvent) {
    days[0].event = worldEvents.currentEvent;
  }

  // Check daily_features for today's scheduled weather (may override in-memory)
  try {
    var { data: todayFeature } = await supabaseClient
      .from('daily_features')
      .select('weather, event_id')
      .eq('date', days[0].dateStr)
      .maybeSingle();

    if (todayFeature && todayFeature.weather) {
      var weatherId = typeof todayFeature.weather === 'object' ? todayFeature.weather.id : todayFeature.weather;
      // Use live weatherSystem types so today's card always matches actual weather definitions
    var found = (typeof weatherSystem !== 'undefined' && weatherSystem.weatherTypes)
      ? weatherSystem.weatherTypes.find(function(w) { return w.id === weatherId; })
      : null;
    if (found) days[0].weather = found;
    else if (weatherId) days[0].weather = { id: weatherId, name: weatherId, icon: '🌤️', description: 'Today\'s weather.' };
    }
  } catch(e) { /* silent — daily_features may not exist yet */ }

  // Future days: try scheduled_events table
  try {
    var { data: scheduled } = await supabaseClient
      .from('scheduled_events')
      .select('*')
      .gte('event_date', days[1].dateStr)
      .lte('event_date', days[6].dateStr)
      .order('event_date', { ascending: true });

    if (scheduled && scheduled.length > 0) {
      scheduled.forEach(function(row) {
        var day = days.find(function(d) { return d.dateStr === row.event_date; });
        if (!day) return;
        if (row.event_type === 'weather') {
          day.weather = { id: row.weather_id || row.event_id, name: row.name, icon: row.icon || WEATHER_ICONS[row.weather_id] || '🌤️', description: row.description || '' };
        } else {
          day.event = { id: row.event_id || row.id, name: row.name, icon: row.icon || EVENT_TYPE_ICONS[row.event_type] || '⚡', description: row.description || '', event_type: row.event_type };
        }
      });
    }
  } catch(e) {
    // Silent fallback — table may not exist yet
  }

  // For any future day still without weather, generate deterministic forecast
  // Uses date string as seed so ALL players see the same forecast
  // Build forecast pool from the actual weatherSystem types (excluding cursed - too rare to forecast)
  var forecastPool = (typeof weatherSystem !== 'undefined' && Array.isArray(weatherSystem.weatherTypes))
    ? weatherSystem.weatherTypes.filter(function(w) { return w.id !== 'cursed'; })
    : [
        { id:'clear',  name:'Clear Skies',   icon:'☀️',  description:'Normal conditions today.' },
        { id:'sunny',  name:'Sunny',          icon:'🌤️', description:'Warm and bright!' },
        { id:'rainy',  name:'Rainy',          icon:'🌧️', description:'Great day to stay cozy inside.' },
        { id:'foggy',  name:'Foggy',          icon:'🌫️', description:'Mysterious conditions with a rare encounter bonus!' },
        { id:'windy',  name:'Windy',          icon:'💨',  description:'Breezy day, pets move faster!' },
        { id:'starry', name:'Starry Night',   icon:'✨',  description:'Make a wish tonight!' }
      ];

  // Deterministic hash — same seed = same forecast for all players on that date
  function calendarHash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }

  // Weight-aware deterministic selection — respects rarity
  function deterministicWeatherPick(dateStr, pool) {
    var seed = calendarHash(dateStr);
    // Use seed to pick a weather weighted by its weight property
    var totalWeight = pool.reduce(function(s, w) { return s + (w.weight || 10); }, 0);
    var pick = seed % totalWeight;
    var cumulative = 0;
    for (var wi = 0; wi < pool.length; wi++) {
      cumulative += (pool[wi].weight || 10);
      if (pick < cumulative) return pool[wi];
    }
    return pool[0];
  }

  for (var di = 1; di < days.length; di++) {
    if (!days[di].weather) {
      // Night hours (18-6) can show starry; daytime pool excludes it
      var hour = new Date().getHours();
      var isNight = hour >= 18 || hour < 6;
      var dayPool = isNight ? forecastPool : forecastPool.filter(function(w) { return w.id !== 'starry'; });
      var picked = deterministicWeatherPick(days[di].dateStr, dayPool);
      days[di].weather = {
        id:          picked.id,
        name:        picked.name,
        icon:        picked.icon,
        description: picked.description || 'Forecasted weather.'
      };
    }
  }

  // Render
  modal.innerHTML = calendar_render(days);
}

function calendar_render(days) {
  var dayCards = days.map(function(day) {
    var weatherIcon  = (day.weather && day.weather.icon) ? day.weather.icon  : '❓';
    var weatherName  = (day.weather && day.weather.name) ? day.weather.name  : 'Unknown';
    var weatherDesc  = (day.weather && day.weather.description) ? day.weather.description : '';

    var eventBadge = '';
    if (day.event) {
      eventBadge =
        '<div style="margin-top:6px;padding:3px 8px;border-radius:20px;background:rgba(251,191,36,0.15);border:1px solid rgba(251,191,36,0.3);display:inline-block;">' +
          '<span style="font-size:0.75rem;color:#fbbf24;font-weight:600;">' +
            (day.event.icon || '⚡') + ' ' + escapeHtml(day.event.name) +
          '</span>' +
        '</div>';
    }

    return '<div style="' +
      'border-radius:14px;padding:14px 12px;text-align:center;min-width:90px;flex:1;' +
      'border:2px solid ' + (day.isToday ? 'var(--purple)' : 'var(--border)') + ';' +
      'background:' + (day.isToday ? 'rgba(153,102,255,0.08)' : 'rgba(255,255,255,0.5)') + ';' +
      'cursor:pointer;transition:all 0.2s;box-sizing:border-box;"' +
      ' onmouseover="this.style.transform=\'translateY(-3px)\';this.style.boxShadow=\'0 6px 18px rgba(153,102,255,0.15)\'"' +
      ' onmouseout="this.style.transform=\'\';this.style.boxShadow=\'\'"' +
      ' title="' + escapeHtml(weatherDesc) + '">' +
      '<div style="font-size:0.72rem;font-weight:' + (day.isToday ? '800' : '600') + ';color:' + (day.isToday ? 'var(--purple)' : 'var(--text-light)') + ';margin-bottom:6px;">' +
        escapeHtml(day.label) +
      '</div>' +
      '<div style="font-size:1.8rem;margin-bottom:4px;">' + weatherIcon + '</div>' +
      '<div style="font-size:0.72rem;color:var(--purple-dark);font-weight:600;">' + escapeHtml(weatherName) + '</div>' +
      eventBadge +
    '</div>';
  });

  // Split into two rows: today + next 3, then last 3
  var row1 = dayCards.slice(0, 4).join('');
  var row2 = dayCards.slice(4).join('');

  return '<div style="max-width:680px;">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">' +
      '<h2 style="margin:0;color:var(--purple);font-size:1.15rem;">🗓️ 7-Day Forecast</h2>' +
      '<button onclick="closeModal()" style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:var(--text-light);padding:0;line-height:1;">×</button>' +
    '</div>' +

    // Today's detail card
    (days[0].weather || days[0].event
      ? '<div style="background:linear-gradient(135deg,rgba(153,102,255,0.1),rgba(255,102,204,0.06));border-radius:14px;padding:14px 18px;margin-bottom:18px;border:1px solid rgba(153,102,255,0.2);">' +
          '<div style="font-weight:700;font-size:0.8rem;color:var(--purple);margin-bottom:8px;letter-spacing:1px;">TODAY\'S CONDITIONS</div>' +
          '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">' +
            (days[0].weather
              ? '<div style="display:flex;align-items:center;gap:8px;">' +
                  '<span style="font-size:1.6rem;">' + (days[0].weather.icon||'🌤️') + '</span>' +
                  '<div><div style="font-weight:700;color:var(--purple-dark);">' + escapeHtml(days[0].weather.name||'') + '</div>' +
                  '<div style="font-size:0.78rem;color:var(--text-light);">' + escapeHtml(days[0].weather.description||'') + '</div></div>' +
                '</div>'
              : '') +
            (days[0].event
              ? '<div style="display:flex;align-items:center;gap:8px;padding-left:' + (days[0].weather ? '16px' : '0') + ';border-left:' + (days[0].weather ? '1px solid rgba(153,102,255,0.2)' : 'none') + ';">' +
                  '<span style="font-size:1.6rem;">' + (days[0].event.icon||'⚡') + '</span>' +
                  '<div><div style="font-weight:700;color:#fbbf24;">' + escapeHtml(days[0].event.name||'') + '</div>' +
                  '<div style="font-size:0.78rem;color:var(--text-light);">' + escapeHtml(days[0].event.description||'') + '</div></div>' +
                '</div>'
              : '') +
          '</div>' +
        '</div>'
      : '') +

    // 7-day grid
    '<div style="font-weight:700;font-size:0.8rem;color:var(--text-light);margin-bottom:10px;letter-spacing:1px;">7-DAY OUTLOOK</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">' + row1 + '</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;">' + row2 + '</div>' +

    '<div style="text-align:center;font-size:0.75rem;color:var(--text-light);">Hover a day for details · Future forecasts may change</div>' +
    '<button class="btn btn-outline" onclick="closeModal()" style="width:100%;margin-top:14px;">Close</button>' +
  '</div>';
}

function initEventStatusWidget() {
  updateEventStatusWidget();
  // Refresh every minute + check adpocalypse/fish_frenzy weather
  safeSetInterval(function() {
    updateEventStatusWidget();
    // Sync adpocalypse weather effect with current weather
    var weatherId = (typeof weatherSystem !== 'undefined' && weatherSystem.currentWeather)
      ? weatherSystem.currentWeather.id : null;
    if (weatherId === 'adpocalypse') {
      adpocalypse_start();
    } else {
      adpocalypse_stop();
    }
  }, 60000);
  // Hover tooltip
  var widget = document.getElementById('event-status-widget');
  if (widget) {
    widget.addEventListener('mouseenter', esw_showTooltip);
    widget.addEventListener('mouseleave', esw_hideTooltip);
    widget.addEventListener('click', esw_showModal);
  }
}

// Sync soundCooldown now that GAME_CONSTANTS is defined
if (typeof GAME_CONSTANTS !== 'undefined' && GAME_CONSTANTS.SOUND_COOLDOWN_MS) {
  soundCooldown = GAME_CONSTANTS.SOUND_COOLDOWN_MS;
}

// ══════════════════════════════════════════════════════════════════════════
// STUB FUNCTIONS - Prevent "not defined" console errors
// These are called by various systems; defined here so they never crash
// ══════════════════════════════════════════════════════════════════════════

function playSound(soundName) {
  // Stub - sound system not yet implemented; silently no-ops
}

function awardBattleRewards(victory, exp, pp, itemDropped) {
  // Stub - battle rewards handled by saveBattleHistory; this is a no-op
  dbg('[stub] awardBattleRewards called:', { victory, exp, pp, itemDropped });
}

async function grantCosmetic(cosmeticId, type) {
  if (!currentUser) return false;
  try {
    var { error } = await supabaseClient
      .from('unlocked_cosmetics')
      .upsert({
        user_id: currentUser.id,
        cosmetic_type: type,
        cosmetic_id: cosmeticId
      }, { onConflict: 'user_id,cosmetic_id' });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('[grantCosmetic] Error:', err);
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// MODAL HELPER FUNCTIONS - Required for variant gallery & nickname editing
// ══════════════════════════════════════════════════════════════════════════

function makeModal() {
  var overlay = makeEl('div');
  overlay.className = 'modal-overlay-custom';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:10000;';
  
  var modal = makeEl('div');
  modal.className = 'modal-content-custom';
  modal.style.cssText = 'background:white;border-radius:20px;padding:30px;max-width:90%;max-height:90vh;overflow-y:auto;position:relative;box-shadow:0 10px 40px rgba(0,0,0,0.3);';
  
  overlay.appendChild(modal);
  
  // Click overlay to close
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      closeModal();
    }
  });
  
  return modal;
}

function openModal(modalElement) {
  // modalElement is the inner content div; its parent is the overlay created by makeModal()
  var overlay = modalElement.parentElement;
  if (!overlay) {
    // Fallback: wrap in a new overlay if somehow detached
    console.warn('openModal: modal has no parent overlay, creating one');
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay-custom';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:10000;';
    overlay.appendChild(modalElement);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeModal();
    });
  }
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  var overlays = document.querySelectorAll('.modal-overlay-custom');
  overlays.forEach(function(overlay) {
    if (overlay.parentElement) {
      overlay.parentElement.removeChild(overlay);
    }
  });
  document.body.style.overflow = ''; // Restore scroll
}

function updateAllPoints(pts) {
  // Handle RPC response objects (e.g. {new_pp: 500} or {error: ...})
  if (pts !== null && typeof pts === 'object') {
    if (typeof pts.new_pp === 'number') {
      pts = pts.new_pp;
    } else if (pts.error || pts.message) {
      console.error('updateAllPoints received error object:', pts);
      return;
    } else {
      pts = 0;
    }
  }
  // Handle null/undefined/non-number points
  if (pts === null || pts === undefined || typeof pts !== 'number') {
    console.warn('updateAllPoints received invalid value:', pts);
    pts = 0;
  }
  
  currentPoints = pts;
  var str = pts + ' PP';
  ['adopt-points','mypets-points','shop-points','games-points','redeem-points'].forEach(function(id){
    var e = el(id); if (e) e.textContent = str;
  });
  
  var navPoints = el('nav-points');
  if (navPoints) navPoints.innerHTML = '&#129689; ' + pts + ' PP';
  
  // Update sidebar points
  var sidebarPoints = document.getElementById('sidebar-points');
  if (sidebarPoints) sidebarPoints.textContent = pts.toLocaleString() + ' PP';

  maybeGlitchPointsDisplay(pts);
}

// ── Ambient "666 PP" Money Glitch ────────────────────────────────────────────
// Rare chance, on any points update, to briefly flash every PP display to 666
// with a spooky wobble before reverting to the real value.
var SPOOKY_PP_GLITCH_CHANCE = 0.015; // ~1.5% chance per points update

function maybeGlitchPointsDisplay(realPts) {
  if (!playerSettings.spooky_enabled) return;
  if (_ppGlitchActive) return; // don't stack while one is already playing out
  if (Math.random() >= SPOOKY_PP_GLITCH_CHANCE) return;

  var glitchIds = ['adopt-points','mypets-points','shop-points','games-points','redeem-points','nav-points','sidebar-points'];
  var elements = [];
  glitchIds.forEach(function(id) {
    var node = el(id);
    if (node) elements.push(node);
  });
  if (elements.length === 0) return;

  _ppGlitchActive = true;
  elements.forEach(function(node) {
    node.classList.add('glitch-text', 'spooky-wobble');
    node.textContent = node.id === 'nav-points' ? '\uD83E\uDE99 666 PP' : '666 PP';
  });

  safeSetTimeout(function() {
    elements.forEach(function(node) {
      node.classList.remove('glitch-text', 'spooky-wobble');
    });
    _ppGlitchActive = false;
    // Restore real values via the normal path rather than guessing each format
    updateAllPoints(realPts);
  }, 3500 + Math.random() * 2500); // 3.5-6 seconds
}
var _ppGlitchActive = false;

// ═══════════════════════════════════════════════════════════════════════════
// STREAM OVERLAY API ENDPOINTS
// Provides pet data for on-stream widgets/overlays
// Usage: GET /api/overlay/pet?streamer=EMBERTAIL_USERNAME
// ═══════════════════════════════════════════════════════════════════════════

async function handleOverlayRequest(request) {
  var url = new URL(request.url);
  var streamerName = url.searchParams.get('streamer');
  
  if (!streamerName) {
    return new Response(JSON.stringify({ error: 'Missing streamer param' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
  
  try {
    var { data: player, error: playerError } = await supabaseClient
      .from('players')
      .select('id, username, companion_pet_id')
      .ilike('username', streamerName)
      .single();
    
    if (playerError || !player) {
      return new Response(JSON.stringify({ error: 'Streamer not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    if (!player.companion_pet_id) {
      return new Response(JSON.stringify({ error: 'No companion pet set', streamer: player.username }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    var { data: pet, error: petError } = await supabaseClient
      .from('user_pets')
      .select('id, nickname, level, current_hp, max_hp, hunger, max_hunger, energy, max_energy, happiness, max_happiness, current_variant, last_fed, last_played, pets(name, image_file)')
      .eq('id', player.companion_pet_id)
      .single();
    
    if (petError || !pet) {
      return new Response(JSON.stringify({ error: 'Pet not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    var hungerPct    = Math.round((pet.hunger    / pet.max_hunger)    * 100);
    var energyPct    = Math.round((pet.energy    / pet.max_energy)    * 100);
    var happinessPct = Math.round((pet.happiness / pet.max_happiness) * 100);
    var hpPct        = Math.round((pet.current_hp / pet.max_hp)       * 100);
    
    var moodEmoji = happinessPct >= 80 ? '😊' : happinessPct >= 60 ? '🙂' : happinessPct >= 40 ? '😐' : happinessPct >= 20 ? '😟' : '😭';

    var lastFed    = pet.last_fed    ? new Date(pet.last_fed)    : null;
    var lastPlayed = pet.last_played ? new Date(pet.last_played) : null;
    var lastActive = null;
    if (lastFed && lastPlayed) lastActive = lastFed > lastPlayed ? lastFed : lastPlayed;
    else if (lastFed)    lastActive = lastFed;
    else if (lastPlayed) lastActive = lastPlayed;
    
    var hoursSince = 'Never';
    if (lastActive) {
      var hours = Math.floor((Date.now() - lastActive) / 3600000);
      hoursSince = hours < 1 ? 'Just now' : hours < 24 ? hours + ' hour' + (hours !== 1 ? 's' : '') + ' ago' : Math.floor(hours / 24) + ' days ago';
    }
    
    var tip = hungerPct < 30 ? '🍽️ Hungry! Feed me in the game!' :
              energyPct < 30 ? '😴 Tired! Let me rest...' :
              happinessPct < 40 ? '💔 Sad! Play with me in the game!' :
              '✨ Happy and healthy! Thanks for watching!';
    
    var response = {
      success: true,
      pet: {
        id:      pet.id,
        name:    pet.nickname || (pet.pets && pet.pets.name) || 'Pet',
        species: (pet.pets && pet.pets.name) || 'Pet',
        level:   pet.level,
        image:   (pet.pets && pet.pets.image_file) || null,
        variant: pet.current_variant || null,
        stats: {
          hp:        { current: pet.current_hp, max: pet.max_hp,        percent: hpPct },
          hunger:    { current: pet.hunger,     max: pet.max_hunger,    percent: hungerPct },
          energy:    { current: pet.energy,     max: pet.max_energy,    percent: energyPct },
          happiness: { current: pet.happiness,  max: pet.max_happiness, percent: happinessPct }
        },
        mood:       { emoji: moodEmoji, text: getMoodText(happinessPct) },
        lastActive: hoursSince,
        tip:        tip
      }
    };
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      }
    });
    
  } catch (err) {
    console.error('Overlay API error:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

function getMoodText(percent) {
  if (percent >= 80) return 'Ecstatic';
  if (percent >= 60) return 'Happy';
  if (percent >= 40) return 'Content';
  if (percent >= 20) return 'Unhappy';
  return 'Miserable';
}

// ── LEADERBOARD INITIALIZATION ────────────────────────────
function initLeaderboardTab() {
  // Set initial state
  currentLeaderboard = 'points';
  // Activate the Most Points button
  document.querySelectorAll('.leaderboard-tab').forEach(function(t) {
    t.classList.remove('active');
  });
  var firstTab = document.querySelectorAll('.leaderboard-tab')[0];
  if (firstTab) firstTab.classList.add('active');
  // Show points list, hide others
  document.querySelectorAll('.leaderboard-list').forEach(function(list) {
    list.classList.remove('active');
  });
  el('leaderboard-points').classList.add('active');
  // Load data if not cached
  if (!leaderboardCache.points) {
    loadLeaderboard('points');
  }
}

// ── TAB NAVIGATION ───────────────────────

// ══════════════════════════════════════════════════════════════════════════
// GROUPED NAV — hover + click to open/close
// ══════════════════════════════════════════════════════════════════════════

// Map of tab name -> parent group id
var NAV_GROUP_MAP = {
  adopt: 'pets', mypets: 'pets', journal: 'pets',
  minigames: 'games', fishing: 'games', racing: 'games',
  guild: 'community', friends: 'community', leaderboard: 'community',
  forum: 'community', stats: 'community',
  twitch: 'more', redeem: 'more', news: 'more', team: 'more', settings: 'more'
};

var _navGroupTimers = {};

function navGroupOpen(groupId) {
  var g = document.getElementById('navgroup-' + groupId);
  var gm = document.getElementById('navgroup-' + groupId + '-mobile');
  if (g) g.classList.add('open');
  if (gm) gm.classList.add('open');
}

function navGroupClose(groupId) {
  var g = document.getElementById('navgroup-' + groupId);
  var gm = document.getElementById('navgroup-' + groupId + '-mobile');
  if (g) g.classList.remove('open');
  if (gm) gm.classList.remove('open');
}

function navGroupToggle(groupId) {
  var g = document.getElementById('navgroup-' + groupId);
  if (!g) return;
  if (g.classList.contains('open')) {
    navGroupClose(groupId);
  } else {
    navGroupOpen(groupId);
  }
}

// Hover open with delay-close so mouse can move into children
function navGroupHover(groupId, entering) {
  if (_navGroupTimers[groupId]) {
    clearTimeout(_navGroupTimers[groupId]);
    _navGroupTimers[groupId] = null;
  }
  if (entering) {
    navGroupOpen(groupId);
  } else {
    // Delay close so user can move cursor into the children list
    _navGroupTimers[groupId] = setTimeout(function() {
      navGroupClose(groupId);
    }, 280);
  }
}

function showTab(tab) {
  // CRITICAL: Clean up all timers when switching tabs to prevent memory leaks
  cleanupAllTimers();

  // WISHES: shop visit — check for any pet that has a visit_shop wish
  if (tab === 'shop' && currentUser) {
    Object.keys(petMoodCache).forEach(function(pid) {
      checkPetWishes('visit_shop', pid).catch(function(){});
    });
  }
  // WISHES: profile visit
  if (tab === 'profile' && currentUser) {
    Object.keys(petMoodCache).forEach(function(pid) {
      checkPetWishes('view_profile', pid).catch(function(){});
    });
  }
  
  document.querySelectorAll('#app-content .page-section').forEach(function(s){ s.classList.remove('active'); });
  var sec = el('section-' + tab); if (sec) sec.classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(function(b){ b.classList.remove('active'); });
  var btn = el('tab-btn-' + tab); if (btn) btn.classList.add('active');
  
  // Update sidebar buttons
  document.querySelectorAll('.sidebar-nav-btn').forEach(function(b){ b.classList.remove('active'); });
  var sidebarBtn = el('sidebar-btn-' + tab);
  if (sidebarBtn) sidebarBtn.classList.add('active');

  // Open parent nav group if this tab belongs to one
  var parentGroup = NAV_GROUP_MAP[tab];
  if (parentGroup) {
    // Close all groups first
    ['pets','games','community','more'].forEach(function(g) {
      var el2 = document.getElementById('navgroup-' + g);
      var el3 = document.getElementById('navgroup-' + g + '-mobile');
      if (el2) { el2.classList.remove('has-active'); }
      if (el3) { el3.classList.remove('has-active'); }
    });
    // Mark parent as having active child
    var parentEl = document.getElementById('navgroup-' + parentGroup);
    var parentMobile = document.getElementById('navgroup-' + parentGroup + '-mobile');
    if (parentEl) parentEl.classList.add('has-active');
    if (parentMobile) parentMobile.classList.add('has-active');
  }
  
  // FIX 4: Particle system cleanup - stop when leaving home, start when entering
  if (tab !== 'home' && window.particleInterval) {
    // Leaving home tab - clean up particles
    safeClearInterval(window.particleInterval);
    window.particleInterval = null;
    // Remove all existing sparkle particles
    document.querySelectorAll('.sparkle-particle').forEach(function(el) {
      el.remove();
    });
  } else if (tab === 'home' && !window.particleInterval) {
    // Entering home tab - start particles if not already running
    createFloatingSparkles();
  }
  
  // Special cases: some tabs need to initialize every time
  if (tab === 'leaderboard') {
    initLeaderboardTab();
  } else if (tab === 'forum') {
    // Ensure forum initializes properly
    safeSetTimeout(function() {
      initForum();
    }, 100);
  } else if (tab === 'settings') {
    loadSettings();
  } else if (tab === 'myprofile') {
    loadMyProfile();
    renderReferralWidget('referral-widget-mount');
  } else if (tab === 'profile' && window.currentProfileUsername) {
    loadProfile(window.currentProfileUsername);
  } else if (tab === 'battle') {
    // Always run both systems when battle tab opens
    setTimeout(function() { loadBattlePets(); }, 100);
    setTimeout(function() { battleExp_init(); }, 150);
  } else if (!tabsLoaded[tab]) { 
    tabsLoaded[tab] = true; 
    loadTab(tab); 
  }
  
  // Load daily tip when home tab is shown
  if (tab === 'home') {
    loadDailyTip();
  }
  
  window.scrollTo(0, 0);
  
  // Update URL hash to persist tab (without triggering reload)
  if (window.location.hash !== '#tab-' + tab) {
    history.replaceState(null, null, '#tab-' + tab);
  }
}



// ══════════════════════════════════════════════════════════════════════════
// NOTIFICATION SYSTEM
// createNotification — saves to user_notifications table + updates bell badge
// toggleNotificationDropdown — shows/hides the dropdown
// ══════════════════════════════════════════════════════════════════════════

async function createNotification(userId, type, title, message, actionTab) {
  if (!userId) return;
  try {
    await supabaseClient.from('user_notifications').insert({
      user_id:    userId,
      type:       type || 'general',
      title:      title || '',
      message:    message || '',
      action_tab: actionTab || null,
      is_read:    false,
      created_at: new Date().toISOString()
    });
    // Update the bell badge
    await updateNotificationBadge();
  } catch(e) {
    // Notification failures are non-critical — log but don't surface
    console.error('[Notif] createNotification failed:', e);
  }
}

async function updateNotificationBadge() {
  if (!currentUser) return;
  try {
    var res = await supabaseClient
      .from('user_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', currentUser.id)
      .eq('is_read', false);
    var count = res.count || 0;
    var badge = document.getElementById('notification-badge');
    var bell  = document.getElementById('notification-bell');
    if (badge) {
      badge.textContent = count > 9 ? '9+' : count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
    if (bell) bell.style.display = currentUser ? 'flex' : 'none';
    return count;
  } catch(e) { return 0; }
}

async function toggleNotificationDropdown() {
  var dropdown = document.getElementById('notification-dropdown');
  if (!dropdown) {
    // Create dropdown dynamically
    dropdown = document.createElement('div');
    dropdown.id = 'notification-dropdown';
    dropdown.style.cssText = [
      'position:fixed','top:52px','right:120px',
      'width:320px','max-height:420px',
      'background:var(--white)','border-radius:16px',
      'box-shadow:0 8px 32px rgba(0,0,0,0.18)',
      'border:1px solid rgba(153,102,255,0.2)',
      'z-index:8000','overflow:hidden',
      'display:flex','flex-direction:column'
    ].join(';');
    document.body.appendChild(dropdown);
    // Close on outside click
    setTimeout(function() {
      document.addEventListener('click', function closeDD(e) {
        if (!dropdown.contains(e.target) && e.target.id !== 'notification-bell') {
          dropdown.remove();
          document.removeEventListener('click', closeDD);
        }
      });
    }, 10);
  } else {
    dropdown.remove();
    return;
  }

  dropdown.innerHTML = '<div style="padding:12px 16px;border-bottom:1px solid rgba(153,102,255,0.1);display:flex;justify-content:space-between;align-items:center;">' +
    '<span style="font-weight:700;color:var(--purple-dark);">🔔 Notifications</span>' +
    '<button onclick="markAllNotificationsRead()" style="background:none;border:none;font-size:0.72rem;color:var(--purple);cursor:pointer;">Mark all read</button>' +
  '</div>' +
  '<div id="notification-list" style="overflow-y:auto;flex:1;"><div style="padding:20px;text-align:center;color:var(--text-light);">Loading...</div></div>';

  // Load notifications
  try {
    var res = await supabaseClient
      .from('user_notifications')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20);

    var list = document.getElementById('notification-list');
    if (!list) return;

    if (!res.data || res.data.length === 0) {
      list.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-light);">No notifications yet! 🌸</div>';
      return;
    }

    // Set up click delegation for notification rows
    list.addEventListener('click', function(e) {
      var row = e.target.closest('[data-action]');
      if (row) {
        var action = row.getAttribute('data-action').replace('tab:', '');
        showTab(action);
        var dd = document.getElementById('notification-dropdown');
        if (dd) dd.remove();
      }
    });

    list.innerHTML = res.data.map(function(n) {
      var timeAgo = notifTimeAgo(n.created_at);
      return '<div style="padding:12px 16px;border-bottom:1px solid rgba(153,102,255,0.07);opacity:' + (n.is_read ? '0.6' : '1') + ';cursor:' + (n.action_tab ? 'pointer' : 'default') + ';transition:background 0.15s;" ' +
        (n.action_tab ? (' data-action="' + n.action_tab + '"') : '') +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">' +
          '<div>' +
            '<div style="font-size:0.82rem;font-weight:' + (n.is_read ? '400' : '700') + ';color:var(--text);margin-bottom:2px;">' + escapeHtml(n.title || '') + '</div>' +
            '<div style="font-size:0.74rem;color:var(--text-light);line-height:1.4;">' + escapeHtml((n.message || '').substring(0, 100)) + '</div>' +
          '</div>' +
          '<div style="font-size:0.65rem;color:var(--text-light);white-space:nowrap;flex-shrink:0;">' + timeAgo + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    // Mark all as read
    await supabaseClient
      .from('user_notifications')
      .update({ is_read: true })
      .eq('user_id', currentUser.id)
      .eq('is_read', false);
    await updateNotificationBadge();
  } catch(e) {
    var list2 = document.getElementById('notification-list');
    if (list2) list2.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-light);">Could not load notifications.</div>';
  }
}

async function markAllNotificationsRead() {
  if (!currentUser) return;
  await supabaseClient.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id);
  await updateNotificationBadge();
  var dropdown = document.getElementById('notification-dropdown');
  if (dropdown) dropdown.remove();
}

function notifNavClick(el) {
  var tab = el && el.getAttribute ? el.getAttribute('onclick') : null;
  // Extract tab name from onclick string
  var match = (el.outerHTML || '').match(/notifNavClick.*?'([^']+)'/);
  // Simpler: use data approach — just close dropdown and navigate
  var dropdown = document.getElementById('notification-dropdown');
  if (dropdown) dropdown.remove();
}

function notifTimeAgo(isoStr) {
  if (!isoStr) return '';
  var diff = Date.now() - new Date(isoStr).getTime();
  var mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return mins + 'm ago';
  var hrs = Math.floor(mins / 60);
  if (hrs < 24)   return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
}

// ══════════════════════════════════════════════════════════════════════════
// STATISTICS TAB
// Shows personal stats + global community stats
// ══════════════════════════════════════════════════════════════════════════

async function loadStatistics() {
  var container = document.getElementById('stats-container');
  if (!container) return;
  container.innerHTML = '<div class="spinner"></div>';

  try {
    // Personal stats
    var playerRes = await supabaseClient
      .from('players')
      .select('pawketpoints, login_streak, skin_keys, referral_count')
      .eq('id', currentUser.id)
      .single();

    // Battle history
    var battleRes = await supabaseClient
      .from('battle_history')
      .select('victory')
      .eq('user_id', currentUser.id);

    // Pets
    var petRes = await supabaseClient
      .from('user_pets')
      .select('id, level, nickname, pets(name)')
      .eq('user_id', currentUser.id);

    // Badges earned
    var badgeRes = await supabaseClient
      .from('user_badges')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', currentUser.id);

    // Fish caught
    var fishRes = await supabaseClient
      .from('user_fish_collection')
      .select('fish_id, catch_count')
      .eq('user_id', currentUser.id);

    // Global stats
    var globalRes = await supabaseClient
      .from('global_stats')
      .select('stat_key, stat_value');

    var p           = (playerRes.data) || {};
    var battles     = (battleRes.data) || [];
    var pets        = (petRes.data) || [];
    var badgeCount  = badgeRes.count || 0;
    var fishCaught  = (fishRes.data) || [];
    var globalStats = {};
    ((globalRes.data) || []).forEach(function(r) { globalStats[r.stat_key] = r.stat_value; });

    var battlesWon  = battles.filter(function(b) { return b.victory; }).length;
    var totalFish   = fishCaught.reduce(function(s,f) { return s + (f.catch_count||0); }, 0);
    var uniqueFish  = fishCaught.length;
    var highestPet  = pets.reduce(function(best, p) { return (p.level||0) > (best.level||0) ? p : best; }, {});

    var personalRows = [
      { icon:'💰', label:'Total PawketPoints',     value: (p.pawketpoints||0).toLocaleString() + ' PP' },
      { icon:'🔥', label:'Login Streak',            value: (p.login_streak||0) + ' days' },
      { icon:'🗝️',  label:'Skin Keys',              value: p.skin_keys||0 },
      { icon:'⚔️', label:'Battles Won',             value: battlesWon + ' / ' + battles.length },
      { icon:'🐾', label:'Pets Owned',              value: pets.length },
      { icon:'⭐', label:'Highest Pet Level',       value: highestPet.level ? 'Lv.' + highestPet.level + ' ' + escapeHtml(highestPet.nickname || (highestPet.pets && highestPet.pets.name) || '?') : 'None' },
      { icon:'🏅', label:'Badges Earned',           value: badgeCount },
      { icon:'🎣', label:'Fish Caught',             value: totalFish + ' total, ' + uniqueFish + ' unique species' },
      { icon:'🌟', label:'Referrals',               value: (p.referral_count||0) + ' players' },
    ];

    var globalRows = [
      { icon:'⚔️', label:'Total Battles Fought',   value: (globalStats.total_battles_won||0).toLocaleString() },
      { icon:'💀', label:'Bosses Slain',            value: (globalStats.total_bosses_slain||0).toLocaleString() },
      { icon:'🐾', label:'Pets Adopted',            value: (globalStats.total_pets_adopted||0).toLocaleString() },
      { icon:'💰', label:'PP Earned (all players)', value: (globalStats.total_pp_earned||0).toLocaleString() },
      { icon:'🛍️', label:'Items Purchased',         value: (globalStats.total_items_purchased||0).toLocaleString() },
      { icon:'🎮', label:'Minigames Played',        value: (globalStats.total_minigames_played||0).toLocaleString() },
    ];

    function makeStatCard(rows) {
      return rows.map(function(r) {
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(153,102,255,0.08);">' +
          '<span style="color:var(--text-light);font-size:0.85rem;">' + r.icon + ' ' + r.label + '</span>' +
          '<span style="font-weight:700;color:var(--purple-dark);font-size:0.9rem;">' + r.value + '</span>' +
        '</div>';
      }).join('');
    }

    container.innerHTML =
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
        '<div style="background:rgba(153,102,255,0.06);border:1px solid rgba(153,102,255,0.18);border-radius:16px;padding:16px 18px;">' +
          '<div style="font-size:0.9rem;font-weight:700;color:var(--purple-dark);margin-bottom:4px;">📊 Your Stats</div>' +
          makeStatCard(personalRows) +
        '</div>' +
        '<div style="background:rgba(255,102,178,0.05);border:1px solid rgba(255,102,178,0.18);border-radius:16px;padding:16px 18px;">' +
          '<div style="font-size:0.9rem;font-weight:700;color:#e0245e;margin-bottom:4px;">🌍 Community Stats</div>' +
          makeStatCard(globalRows) +
        '</div>' +
      '</div>';

  } catch(e) {
    container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-light);">Could not load statistics. Please try again.</div>';
    console.error('[Stats] loadStatistics error:', e);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// NEWS TAB
// Loads news_posts from DB, displays in reverse chronological order
// ══════════════════════════════════════════════════════════════════════════

async function loadNews() {
  var container = document.getElementById('news-container');
  if (!container) return;
  container.innerHTML = '<div class="spinner"></div>';

  try {
    var { data, error } = await supabaseClient
      .from('news_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-light);">No news posts yet. Check back soon! 📰</div>';
      return;
    }

    container.innerHTML = data.map(function(post) {
      var date = new Date(post.created_at).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
      return '<div style="background:var(--white);border:1px solid rgba(153,102,255,0.15);border-radius:16px;padding:18px 22px;margin-bottom:14px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
          '<span style="font-size:0.72rem;font-weight:700;color:var(--purple);text-transform:uppercase;letter-spacing:1px;">' + escapeHtml(post.category || 'Update') + '</span>' +
          '<span style="font-size:0.72rem;color:var(--text-light);">' + date + '</span>' +
        '</div>' +
        '<div style="font-size:1.05rem;font-weight:800;color:var(--purple-dark);margin-bottom:6px;">' + escapeHtml(post.title || '') + '</div>' +
        '<div style="font-size:0.85rem;color:var(--text);line-height:1.6;">' + (post.content || '').replace(/\n/g, '<br>') + '</div>' +
      '</div>';
    }).join('');
  } catch(e) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-light);">Could not load news.</div>';
  }
}

// ══════════════════════════════════════════════════════════════════════════
// FORUM — loadForumCategories + initForum
// ══════════════════════════════════════════════════════════════════════════

async function loadForumCategories() {
  var list = document.getElementById('forum-categories-list');
  if (!list) return;
  list.innerHTML = '<div class="spinner"></div>';
  try {
    var { data, error } = await supabaseClient
      .from('forum_categories')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) {
      list.innerHTML = '<div class="forum-empty-state"><div class="forum-empty-state-icon">📂</div><p>No forum categories yet. Please run the SQL migration!</p></div>';
      console.warn('No categories found in database!');
      return;
    }

    list.innerHTML = data.map(function(cat) {
      return '<div class="forum-category-card" onclick="loadForumCategory(' + cat.id + ', ' + JSON.stringify(escapeHtml(cat.name)) + ')">' +
        '<div class="forum-cat-icon">' + (cat.icon || '💬') + '</div>' +
        '<div class="forum-cat-body">' +
          '<div class="forum-cat-name">' + escapeHtml(cat.name) + '</div>' +
          '<div class="forum-cat-desc">' + escapeHtml(cat.description || '') + '</div>' +
        '</div>' +
        '<div class="forum-cat-arrow">›</div>' +
      '</div>';
    }).join('');
  } catch(e) {
    list.innerHTML = '<div class="forum-empty-state"><p>Could not load forum. Please try again.</p></div>';
    console.error('[Forum] loadForumCategories error:', e);
  }
}

function initForum() {
  loadForumCategories();
  // Ensure categories view is shown
  var catView = document.getElementById('forum-categories-view');
  var threadView = document.getElementById('forum-thread-view');
  if (catView) catView.style.display = 'block';
  if (threadView) threadView.style.display = 'none';
}

// ══════════════════════════════════════════════════════════════════════════
// PET MOOD DECAY
// Runs on login — pets lose hunger/happiness while player was away
// Creates a Melon notification if pet needs attention
// ══════════════════════════════════════════════════════════════════════════

async function applyPetDecay() {
  if (!currentUser || !petState) return;

  var now = Date.now();
  var petsNeedingCare = [];

  for (var petId in petState) {
    var pet = petState[petId];
    if (!pet || !pet.id) continue;

    // Calculate hours since last fed / last played
    var lastFed   = pet.last_fed   ? new Date(pet.last_fed).getTime()   : now;
    var lastPlay  = pet.last_played ? new Date(pet.last_played).getTime() : now;

    var hoursSinceFed  = Math.max(0, (now - lastFed)  / 3600000);
    var hoursSincePlay = Math.max(0, (now - lastPlay) / 3600000);

    // Hunger decays ~5 per hour away (max 24h worth)
    var hungerLoss = Math.min(Math.floor(hoursSinceFed * 5), pet.max_hunger || 100);
    // Happiness decays ~3 per hour away (max 12h worth)  
    var happyLoss  = Math.min(Math.floor(hoursSincePlay * 3), pet.max_happiness || 100);

    if (hungerLoss === 0 && happyLoss === 0) continue;

    var newHunger  = Math.max(0, (pet.hunger  || 0) - hungerLoss);
    var newHappy   = Math.max(0, (pet.happiness || 0) - happyLoss);

    // Update local state
    petState[petId].hunger    = newHunger;
    petState[petId].happiness = newHappy;

    // Update bars if rendered
    updateBar(petId, 'hunger',    newHunger, pet.max_hunger    || 100);
    updateBar(petId, 'happiness', newHappy,  pet.max_happiness || 100);

    // Persist to DB (fire-and-forget, decay is approximate)
    supabaseClient.from('user_pets')
      .update({ hunger: newHunger, happiness: newHappy })
      .eq('id', petId)
      .catch(function(){});

    var petName = pet.nickname || (pet.pets && pet.pets.name) || 'Your pet';
    if (newHunger < 30 || newHappy < 30) {
      petsNeedingCare.push(petName);
    }
  }

  if (petsNeedingCare.length > 0) {
    showToast('😢 ' + petsNeedingCare.slice(0,2).join(', ') + (petsNeedingCare.length > 2 ? ' and others need' : (petsNeedingCare.length > 1 ? ' need' : ' needs')) + ' attention!', 6000);
  }
}

function loadTab(tab) {
  if (tab === 'adopt') loadAdopt();
  else if (tab === 'mypets') loadMyPets();
  else if (tab === 'journal') initJournalTab();
  else if (tab === 'shop') { loadShop(); loadInventory(); }
  else if (tab === 'minigames') initMinigames();
  else if (tab === 'battle') loadBattlePets();
  else if (tab === 'news') loadNews();
  else if (tab === 'twitch') initTwitchTab();
  else if (tab === 'redeem') { loadRedeemHistory(); }
  else if (tab === 'stats') loadStatistics();
  else if (tab === 'guild') loadGuildPage();
  else if (tab === 'fishing') { if (!tabsLoaded['fishing']) { tabsLoaded['fishing'] = true; initMinigames(); } }
  else if (tab === 'racing') racing_init();
  // Note: leaderboard and myprofile handled in showTab()
}

// ── AUTH GATE ────────────────────────────
function showAuthSection(which) {
  document.querySelectorAll('#auth-gate .page-section').forEach(function(s){ s.classList.remove('active'); });
  el('section-' + which).classList.add('active');
  return false;
}

function showForgotPassword() {
  showAuthSection('forgot');
  return false;
}

async function initApp() {
  // Guard: wait for Supabase client to be ready
  if (!supabaseClient) {
    dbg('Waiting for Supabase client to initialize...');
    setTimeout(initApp, 500);
    return;
  }

  // Check if user is coming from password reset email
  var hash = window.location.hash;
  if (hash && hash.includes('type=recovery')) {
    dbg('Password recovery mode detected');
    el('auth-gate').style.display = 'none';
    el('reset-password-gate').style.display = 'block';
    el('app-content').style.display = 'none';
    return;
  }
  
  var session = await requireLogin();
  if (session) {
    await showApp(session.user);
  } else {
    showAuth();
  }

  // Check for streamer landing page parameter
  streamerLanding_init();

  // Set up auth state listener
  supabaseClient.auth.onAuthStateChange(function(event, session) {
    dbg('Auth state changed:', event);
    if (event === 'PASSWORD_RECOVERY') {
      el('auth-gate').style.display = 'none';
      el('reset-password-gate').style.display = 'block';
      el('app-content').style.display = 'none';
    } else if (event === 'SIGNED_IN' && session) {
      setTimeout(function() {
        showApp(session.user);
      }, 100);
    } else if (event === 'SIGNED_OUT') {
      showAuth();
    }
  });
}

async function showApp(user) {
  document.body.classList.remove('guest');
  dbg('showApp called with user:', user?.id || 'null');

  // Guard: ensure user is valid before proceeding
  if (!user || !user.id) {
    console.error('showApp called with invalid user');
    showAuth();
    return;
  }

  currentUser = user;
  el('auth-gate').style.display = 'none';
  el('app-content').style.display = 'block';
  el('nav-logout').style.display = 'inline-block';

  // Restore sidebars and navbar chrome now that user is logged in
  var leftSidebar  = document.querySelector('.left-sidebar');
  var rightSidebar = document.querySelector('.right-sidebar');
  var navCenter    = document.querySelector('.navbar-center');
  var navRight     = document.querySelector('.navbar-right');
  if (leftSidebar)  leftSidebar.style.display    = '';
  if (rightSidebar) rightSidebar.style.display   = '';
  if (navCenter)    navCenter.style.visibility   = '';
  if (navRight)     navRight.style.visibility    = '';
  document.body.classList.remove('logged-out');
  el('nav-profile').style.display = 'inline-block';
  
  // Show Pass and Bingo buttons
  var passBtn = el('pass-button');
  var bingoBtn = el('bingo-button');
  if (passBtn) passBtn.style.display = 'flex';
  if (bingoBtn) bingoBtn.style.display = 'inline-block';
  
  // Clean up any leftover spooky effects
  cleanupSpookyEffects();

  // Check if player exists, create if missing (auto-recovery from database issues)
  var pr = await supabaseClient.from('players').select('username, pawketpoints').eq('id', user.id).maybeSingle();
  
  if (!pr.data) {
    dbg('🚨 Player not found! Auto-creating fresh player account...');
    
    // Generate a safe temporary username (NOT from email for privacy!)
    var tempUsername = 'Player' + Math.floor(Math.random() * 100000);
    
    // Create new player
    var createResult = await supabaseClient
      .from('players')
      .insert([{
        id: user.id,
        username: tempUsername,
        pawketpoints: 0,
        created_at: new Date().toISOString()
      }])
      .select('username, pawketpoints')
      .single();
    
    if (createResult.data) {
      dbg('✅ Fresh player account created:', createResult.data);
      pr = createResult;
      
      // Show welcome notification with prompt to set username
      setTimeout(function() {
        showToast('🌟 Welcome! Please set your username in your Profile!', 10000, 'var(--orange)');
      }, 1000);
    } else {
      console.error('❌ Failed to create player:', createResult.error);
      showToast('⚠️ Error creating account. Please refresh the page.', 5000, 'var(--red)');
      return;
    }
  }
  
  if (pr.data) {
    el('nav-user').textContent = '\u2B50 ' + pr.data.username;
    currentUsername = pr.data.username;
    updateAllPoints(pr.data.pawketpoints || 0);
  }
  
  // Update sidebar stats
  await updateSidebarStats();
  
  // Load user's badges
  await loadUserBadges();
  
  // Load pet title library
  await loadAllPetTitles();
  
  // Load player title system
  await loadAllPlayerTitles();
  await loadPlayerTitles();
  await loadActivePlayerTitle();
  
  // Check for 3am login (Sleep Deprived title)
  // Note: Player titles not yet implemented, this is for future use
  // checkMidnightLogin();
  
  // Check player title unlocks
  await checkPlayerTitleUnlocks();
  
  // Award welcome badge if new user
  await awardBadge('welcome');
  
  // Load daily tip on home page (delay to ensure DOM is ready)
  setTimeout(loadDailyTip, 100);
  
  // Initialize referral system
  await initReferralSystem(user.id);
  
  // Check tutorial status and start if needed
  await checkTutorialStatus();
  
  // Initialize daily fortune AFTER tutorial (only for logged-in users)
  if (typeof dailyFortune !== 'undefined' && dailyFortune.init) {
    // Check if tutorial is completed before showing fortune
    var tutorialDone = playerSettings.tutorial_completed;
    if (tutorialDone) {
      dailyFortune.init();
    }
  }
  
  // Check sidebar stream status
  await checkSidebarStreamStatus();
  
  // FIX 2: Refresh stream status every 2 minutes (throttled, using safe timer)
  safeSetInterval(checkSidebarStreamStatus, 120000);
  
  // PHASE 8 - Growth Features Initialization
  await checkDailyLogin(); // Daily rewards and buffs
  checkReferralCode(); // Check for referral code in URL
  await updateNotificationBadge(); // Update notification count
  
  // Refresh notifications every 2 minutes (reduced from 60s to limit CORS noise)
  safeSetInterval(updateNotificationBadge, 120000);

  var bonus = await checkDailyBonus(user.id);
  if (bonus.awarded) {
    var today = new Date().toISOString().split('T')[0];
    var modalKey = 'daily_bonus_modal_' + user.id + '_' + today;
    if (!localStorage.getItem(modalKey)) {
      el('bonus-amount').textContent = bonus.amount + ' PP';
      el('bonus-modal').classList.add('show');
      localStorage.setItem(modalKey, '1');
    }
    updateAllPoints(bonus.newTotal);
  }

  el('home-cta').innerHTML = '<button class="btn btn-primary btn-lg" onclick="showTab(\'mypets\')" style="margin-right:10px;">My Pets</button><button class="btn btn-secondary btn-lg" onclick="showTab(\'adopt\')">Adopt More</button>';

  // Restore last active tab from URL hash
  var hash = window.location.hash;
  dbg('Page loaded with hash:', hash);
  if (hash && hash.startsWith('#tab-')) {
    var savedTab = hash.replace('#tab-', '');
    dbg('Restoring saved tab:', savedTab);
    showTab(savedTab);
  } else if (hash && hash.includes('access_token')) {
    // Twitch auth callback
    showTab('twitch');
  } else {
    // Only show home if no tab is currently active and no hash
    var currentTab = document.querySelector('.page-content.active');
    if (!currentTab) {
      dbg('No saved tab, showing home');
      showTab('home');
    }
  }
  
  // Load sidebar news widget
  loadSidebarNews();
  
  // PAWKETPASS & BINGO: Initialize systems
  await loadPassProgress();
  loadDailyBingo();
  updateBingoUI();
  
  // SCRAPBOOK & COMMUNITY GOALS: Initialize systems
  scrapbook_init();
  community_init();

  // PET DECAY: Apply hunger/happiness decay since last visit
  safeSetTimeout(function() { applyPetDecay().catch(function(){}); }, 3500);

  // MELON MILESTONES: Check once per session
  safeSetTimeout(function() { checkMelonMilestones(); }, 5000);

  // AUTO-FISHER: Check for completed casts since last login
  safeSetTimeout(function() { autoFisherLoadState(); autoFisherCheck().catch(function(){}); }, 6000);

  // EVENT/WEATHER WIDGET: Initialize navbar widget
  initEventStatusWidget();

  // THEMES & COSMETICS: Load saved preferences
  theme_loadSaved();
  cosmetics_loadEquipped();

  // POLLS: Load active polls (non-blocking)
  pollSystem.load().catch(function(e) { dbg('Polls load failed:', e); });

  // ADMIN: Show admin tools section if applicable
  isAdmin().then(function(admin) {
    var adminSection = document.getElementById('admin-panel-section');
    if (adminSection) adminSection.style.display = admin ? 'block' : 'none';
  });

  // GIFTS: Show inbox bar and check pending gifts count
  var giftBar = document.getElementById('gift-inbox-bar');
  if (giftBar) giftBar.style.display = 'flex';
  supabaseClient.from('gifts').select('id', { count: 'exact', head: true })
    .eq('to_user_id', currentUser.id).eq('status', 'pending')
    .then(function(res) {
      var badge = document.getElementById('gift-inbox-badge');
      if (badge && res.count > 0) { badge.textContent = res.count; badge.style.display = 'inline'; }
    }).catch(function(){});
  
  // PHASE 1: Initialize cosmetics, milestones, daily features
  phase1_init();
  
  // SKIN KEYS: Initialize variant system
  skinkey_init();
  
  // CLEANUP: Remove expired localStorage items
  cleanupExpiredLocalStorage();
  // Also clean up every hour for long sessions
  safeSetInterval(cleanupExpiredLocalStorage, 3600000);
}

function showAuth() {
  currentUser = null;
  el('auth-gate').style.display = 'block';
  el('app-content').style.display = 'none';
  el('nav-logout').style.display = 'none';
  el('nav-profile').style.display = 'none';
  el('nav-user').textContent = '';
  el('nav-points').textContent = '';
  tabsLoaded = {};

  // Hide sidebars and navbar chrome — show only the login box
  var leftSidebar  = document.querySelector('.left-sidebar');
  var rightSidebar = document.querySelector('.right-sidebar');
  var navCenter    = document.querySelector('.navbar-center');
  var navRight     = document.querySelector('.navbar-right');
  if (leftSidebar)  leftSidebar.style.display    = 'none';
  if (rightSidebar) rightSidebar.style.display   = 'none';
  if (navCenter)    navCenter.style.visibility   = 'hidden';
  if (navRight)     navRight.style.visibility    = 'hidden';
  document.body.classList.add('guest');
}

// ══════════════════════════════════════════════════════════════════════════
// UPDATE SIDEBAR STATS
// ══════════════════════════════════════════════════════════════════════════

async function updateSidebarStats() {
  if (!currentUser) return;
  
  try {
    // Get player data (use maybeSingle to avoid errors if missing)
    var { data: player, error: playerError } = await supabaseClient
      .from('players')
      .select('pawketpoints')
      .eq('id', currentUser.id)
      .maybeSingle();
    
    // If player doesn't exist, they're being auto-created - skip stats for now
    if (!player) {
      dbg('⏳ Player not yet created, skipping sidebar stats...');
      return;
    }
    
    if (playerError) throw playerError;
    
    // Get pet count
    var { data: pets, error: petsError } = await supabaseClient
      .from('user_pets')
      .select('id')
      .eq('user_id', currentUser.id);
    
    if (petsError) throw petsError;
    
    // Get item count
    var { data: items, error: itemsError } = await supabaseClient
      .from('user_inventory')
      .select('quantity')
      .eq('user_id', currentUser.id);
    
    if (itemsError) throw itemsError;
    
    var totalItems = 0;
    if (items) {
      items.forEach(function(item) {
        totalItems += item.quantity || 0;
      });
    }
    
    // Calculate day streak — prefer DB value (dailyLoginStreak) for consistency with Today card
    var streak = (typeof dailyLoginStreak !== 'undefined' && dailyLoginStreak > 0)
      ? dailyLoginStreak
      : calculateDayStreak();
    
    // Update sidebar display
    var petCountEl = document.getElementById('sidebar-pet-count');
    var pointsEl = document.getElementById('sidebar-points');
    var itemsEl = document.getElementById('sidebar-items');
    var streakEl = document.getElementById('sidebar-streak');
    
    if (petCountEl) petCountEl.textContent = (pets ? pets.length : 0);
    if (pointsEl) {
      var ppValue = player && typeof player.pawketpoints === 'number' ? player.pawketpoints : 0;
      pointsEl.textContent = ppValue.toLocaleString() + ' PP';
    }
    if (itemsEl) itemsEl.textContent = totalItems;
    if (streakEl) {
      streakEl.textContent = streak;
      // Show next milestone
      var milestones = [3, 7, 14, 30, 60, 100];
      var nextMs = milestones.find(function(m) { return streak < m; });
      var msEl = document.getElementById('sidebar-streak-milestone');
      if (!msEl) {
        msEl = makeEl('div');
        msEl.id = 'sidebar-streak-milestone';
        msEl.style.cssText = 'font-size:0.68rem;color:#ffaa00;text-align:center;margin-top:2px;line-height:1.3;';
        if (streakEl.parentElement) streakEl.parentElement.appendChild(msEl);
      }
      msEl.textContent = nextMs
        ? '🎯 ' + (nextMs - streak) + ' more for ' + nextMs + '-day reward!'
        : '🏆 Legendary streak!';
    }
    
  } catch (err) {
    console.error('Error updating sidebar stats:', err);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// FLOATING MELON POPUP SYSTEM
// showMelonMessage(text, opts) — slides Melon in from bottom-left,
// shows a speech bubble, then slides back out.
// Completely separate from companion (bottom-right) so they never collide.
// ══════════════════════════════════════════════════════════════════════════

var _melonPopupActive = false;
var _melonPopupQueue = [];

function showMelonMessage(text, opts) {
  opts = opts || {};
  // Queue if already showing
  if (_melonPopupActive) {
    _melonPopupQueue.push({ text: text, opts: opts });
    return;
  }
  _melonPopupActive = true;

  // Build the popup
  var wrap = document.createElement('div');
  wrap.id = 'melon-float-popup';
  wrap.style.cssText = [
    'position:fixed','bottom:-160px','left:12px',
    'z-index:8500','display:flex','align-items:flex-end','gap:8px',
    'transition:bottom 0.5s cubic-bezier(0.34,1.56,0.64,1)',
    'pointer-events:none'
  ].join(';');

  // Melon sprite (use existing companion sprite style)
  var spriteUrl = 'images/melon.png'; // existing melon image
  var sprite = document.createElement('div');
  sprite.style.cssText = [
    'width:72px','height:72px','flex-shrink:0',
    'background:url(' + spriteUrl + ') center/contain no-repeat',
    'filter:drop-shadow(0 4px 8px rgba(0,0,0,0.2))',
    'animation:companionFloat 3s ease-in-out infinite'
  ].join(';');

  // Speech bubble
  var bubble = document.createElement('div');
  var isSpooky = opts.spooky || false;
  bubble.style.cssText = [
    'background:' + (isSpooky ? 'rgba(20,0,30,0.95)' : 'rgba(255,255,255,0.97)'),
    'color:' + (isSpooky ? '#cc88ff' : 'var(--text)'),
    'border:2px solid ' + (isSpooky ? 'rgba(120,0,160,0.6)' : 'rgba(153,102,255,0.3)'),
    'border-radius:16px 16px 16px 4px',
    'padding:10px 14px',
    'font-size:0.82rem','line-height:1.5',
    'max-width:260px',
    'box-shadow:0 4px 16px rgba(0,0,0,0.15)',
    'pointer-events:auto','cursor:pointer',
    'font-family:inherit',
    isSpooky ? 'font-family:Courier New,monospace;' : ''
  ].join(';');
  bubble.innerHTML = (opts.title ? '<strong style="display:block;margin-bottom:4px;color:' + (isSpooky ? '#9966ff' : 'var(--purple-dark)') + ';">' + opts.title + '</strong>' : '') + text;

  // Click bubble to dismiss early
  bubble.addEventListener('click', function() { _melonPopupDismiss(wrap); });

  wrap.appendChild(sprite);
  wrap.appendChild(bubble);
  document.body.appendChild(wrap);

  // Slide in
  safeSetTimeout(function() { wrap.style.bottom = '12px'; }, 50);

  // Auto-dismiss after display time
  var displayMs = opts.displayMs || 9000;
  safeSetTimeout(function() { _melonPopupDismiss(wrap); }, displayMs);
}

function _melonPopupDismiss(wrap) {
  if (!wrap || !wrap.parentNode) return;
  wrap.style.bottom = '-160px';
  safeSetTimeout(function() {
    if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    _melonPopupActive = false;
    // Show next queued message
    if (_melonPopupQueue.length > 0) {
      var next = _melonPopupQueue.shift();
      safeSetTimeout(function() { showMelonMessage(next.text, next.opts); }, 800);
    }
  }, 600);
}

// ══════════════════════════════════════════════════════════════════════════
// MELON MILESTONE MESSAGES
// Melon sends contextual notifications at key moments post-tutorial.
// Turns her from a tutorial NPC into a recurring character.
// Each fires once per player (tracked in localStorage).
// ══════════════════════════════════════════════════════════════════════════

function checkMelonMilestones() {
  if (!currentUser) return;
  var streak = (typeof dailyLoginStreak !== 'undefined' && dailyLoginStreak) || 0;
  var sent = JSON.parse(localStorage.getItem('melon_milestones') || '{}');

  var milestones = [
    {
      key: 'day3',
      check: function() { return streak >= 3; },
      title: 'Melon says hi! 🍉',
      message: "Hey! You've been around for a few days now. That makes you one of our more dedicated testers. I hope the pets are treating you well. ...They are, right?"
    },
    {
      key: 'day7',
      check: function() { return streak >= 7; },
      title: 'Melon checks in 🍉',
      message: "One week! Have you noticed the news ticker yet? Sometimes it says... unusual things. I'm sure it's nothing. Probably just a display bug. Anyway — keep feeding your pets!"
    },
    {
      key: 'first_boss',
      check: function() {
        var stats = JSON.parse(localStorage.getItem('player_local_stats') || '{}');
        return (stats.bosses_killed || 0) >= 1;
      },
      title: 'Melon has a question 🍉',
      message: "...That wasn't supposed to happen. The boss, I mean. I didn't think anyone would actually get that far this quickly. Are you doing okay? The pets seem unsettled."
    },
    {
      key: 'corruption_50',
      check: function() {
        return (typeof getWorldStateValueSync === 'function') && getWorldStateValueSync('corruption_level', 0) >= 50;
      },
      title: 'Melon sounds different 🍉',
      message: "The world integrity is getting lower. I notice things like that. I notice a lot of things. Don't tell anyone I said this, but... you might want to keep your pets close tonight.",
      spooky: true
    },
    {
      key: 'level10',
      check: function() {
        return Object.values(petState || {}).some(function(p) { return p && (p.level || 0) >= 10; });
      },
      title: 'Melon is impressed 🍉',
      message: "Level 10! That's real dedication. I've seen a lot of testers come through here. Not many make it this far. ...Well. Most of them don't. But you're doing great!"
    }
  ];

  milestones.forEach(function(m) {
    if (sent[m.key]) return;
    try {
      if (m.check()) {
        sent[m.key] = Date.now();
        localStorage.setItem('melon_milestones', JSON.stringify(sent));
        // Capture milestone for closure
        (function(milestone) {
          safeSetTimeout(function() {
            // Show as floating Melon popup for maximum impact
            showMelonMessage(milestone.message, {
              title: milestone.title,
              displayMs: 12000,
              spooky: milestone.spooky || false
            });
            // Also save to notifications so they can re-read it later
            createNotification(
              currentUser.id,
              'melon_message',
              milestone.title,
              milestone.message,
              'tab:shop'
            ).catch(function(){});
          }, 4000);
        })(m);
      }
    } catch(e) { /* silent */ }
  });
}

// Calculate day streak from localStorage
function calculateDayStreak() {
  try {
    var today = new Date().toDateString();
    var yesterday = new Date(Date.now() - 86400000).toDateString();
    
    var lastLogin = localStorage.getItem('lastLoginDate');
    var currentStreak = parseInt(localStorage.getItem('loginStreak') || '0');
    var lastRewardDay = parseInt(localStorage.getItem('lastStreakRewardDay') || '0');
    
    if (!lastLogin) {
      // First login
      localStorage.setItem('lastLoginDate', today);
      localStorage.setItem('loginStreak', '1');
      return 1;
    }
    
    if (lastLogin === today) {
      // Already logged in today
      return currentStreak;
    } else if (lastLogin === yesterday) {
      // Consecutive day
      currentStreak++;
      localStorage.setItem('lastLoginDate', today);
      localStorage.setItem('loginStreak', currentStreak.toString());
      
      // Check for streak rewards (only award once per milestone)
      if (currentStreak > lastRewardDay) {
        awardStreakReward(currentStreak);
        localStorage.setItem('lastStreakRewardDay', currentStreak.toString());
      }
      
      return currentStreak;
    } else {
      // Streak broken
      localStorage.setItem('lastLoginDate', today);
      localStorage.setItem('loginStreak', '1');
      localStorage.setItem('lastStreakRewardDay', '0'); // Reset reward tracking
      return 1;
    }
  } catch (err) {
    console.error('Error calculating streak:', err);
    return 0;
  }
}

// Award streak milestone rewards
async function awardStreakReward(streak) {
  var reward = null;
  
  if (streak === 3) {
    reward = { pp: 50, message: '3-Day Streak! +50 PP! 🎉' };
  } else if (streak === 7) {
    reward = { pp: 150, message: '7-Day Streak! +150 PP! ⭐' };
  } else if (streak === 14) {
    reward = { pp: 300, message: '14-Day Streak! +300 PP! 💎' };
  } else if (streak === 30) {
    reward = { pp: 1000, message: '30-Day Streak! +1000 PP! 🏆' };
  } else if (streak === 60) {
    reward = { pp: 2500, message: '60-Day Streak! +2500 PP! 👑' };
  } else if (streak === 100) {
    reward = { pp: 5000, message: '100-Day Streak! +5000 PP! 🌟' };
  }
  
  if (reward) {
    await awardPP(reward.pp, 'streak_bonus');
    showPixelToast(reward.message, 'success');
  }
}

async function handleLogout() {
  document.body.classList.add('guest');
  cleanupAllTimers();
  if (typeof CompanionBuddy !== 'undefined' && CompanionBuddy.destroy) {
    CompanionBuddy.destroy();
  }
  await supabaseClient.auth.signOut();
  location.reload();
}
function closeBonusModal() { el('bonus-modal').classList.remove('show'); }

// ── LOGIN / REGISTER ─────────────────────
// ══════════════════════════════════════════════════════════════════════════
// AUTH HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════

async function loginUser(email, password) {
  var { data, error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password
  });
  if (error) throw error;
  return data;
}

async function registerUser(email, password, username) {
  // Capture ?ref= param before registration
  var refUsername = getReferralFromURL();

  // Step 1: Create auth user with Supabase
  var { data: authData, error: authError } = await supabaseClient.auth.signUp({
    email: email,
    password: password,
    options: { data: { username: username } }
  });

  if (authError) throw authError;

  // Step 2: Create player profile in database
  var userId = authData.user.id;

  var insertData = {
    id: userId,
    username: username,
    pawketpoints: refUsername ? 50 : 0, // welcome bonus for referred players
    created_at: new Date().toISOString()
  };
  if (refUsername) insertData.referred_by = refUsername;

  var { error: profileError } = await supabaseClient
    .from('players')
    .insert([insertData]);
  
  if (profileError) {
    console.error('Error creating player profile:', profileError);
    // Don't throw here - auth account was created, they can still log in
  }

  // Increment referrer's count if this player was referred
  if (refUsername && !profileError) {
    await supabaseClient.rpc('referral_increment', {
      p_referrer_username: refUsername
    }).catch(function(e) { console.error('[Referral] increment failed:', e); });
  }

  return authData;
}

async function requireLogin() {
  // Guard: check if Supabase is ready
  if (!supabaseClient) {
    dbg('Supabase not ready in requireLogin');
    return null;
  }

  try {
    var { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      console.error('Error checking session:', error);
      return null;
    }
    if (data && data.session) {
      return data.session;
    }
    return null;
  } catch (err) {
    console.error('Session check error:', err);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// AUTH UI HANDLERS
// ══════════════════════════════════════════════════════════════════════════

async function handleLogin() {
  var email = el('login-email').value.trim();
  var password = el('login-password').value;
  var btn = el('login-btn');
  var err = el('login-error');
  var suc = el('login-success');
  err.classList.remove('show');
  suc.classList.remove('show');

  if (!email || !password) {
    err.textContent = 'Please fill in all fields!';
    err.classList.add('show');
    return;
  }

  // Guard: check if Supabase is ready
  if (!supabaseClient) {
    err.textContent = 'Loading... Please wait and try again.';
    err.classList.add('show');
    return;
  }

  btn.textContent = 'Logging in...';
  btn.disabled = true;

  try {
    var result = await loginUser(email, password);
    suc.textContent = 'Logged in! Loading...';
    suc.classList.add('show');

    // Wait for auth state to fully update, then verify session before showing app
    setTimeout(async function() {
      if (result && result.user) {
        var session = await requireLogin();
        if (session) {
          await showApp(session.user);
        } else {
          throw new Error('Session not found after login');
        }
      }
    }, 500);
  } catch(e) {
    console.error('Login error:', e);
    err.textContent = e.message || 'Login failed. Check your email and password.';
    err.classList.add('show');
    btn.textContent = 'Login';
    btn.disabled = false;
  }
}

// ── USERNAME PROFANITY FILTER ─────────────────────────────
var PROFANITY_LIST = [
  // Profanity
  'fuck', 'shit', 'bitch', 'ass', 'damn', 'hell', 'crap', 'piss', 'douche', 'twat', 'wanker', 'bollocks',
  // Sexual anatomy / content
  'dick', 'cock', 'pussy', 'cunt', 'whore', 'slut', 'sex', 'porn', 'nude', 'xxx', 'anal', 'penis', 'vagina',
  'testicle', 'boner', 'cum', 'jizz', 'dildo', 'blowjob', 'handjob', 'creampie', 'orgasm', 'fetish', 'incest',
  'pedo', 'loli', 'rape', 'rapist',
  // Racial / ethnic slurs
  'nigger', 'nigga', 'chink', 'spic', 'kike', 'gook', 'wetback', 'coon', 'jap', 'paki', 'raghead',
  'sandnigger', 'towelhead', 'beaner', 'gypsy',
  // Homophobic / transphobic slurs
  'fag', 'faggot', 'dyke', 'tranny', 'shemale',
  // Ableist slurs
  'retard', 'retarded', 'spastic', 'cripple', 'mongoloid',
  // Antisemitic / hate group terms
  'nazi', 'hitler', 'kkk', 'isis', 'heil',
  // Misogynistic / general slurs
  'bastard', 'skank', 'thot', 'whorebag',
  // Violence / self-harm
  'kill', 'death', 'murder', 'suicide', 'lynch', 'genocide'
];

// Extra letter substitutions frequently used to dodge filters — kept
// separate from the main word list so it's easy to extend on its own.
var PROFANITY_SUBSTITUTIONS = {
  a: 'a@4', e: 'e3', i: 'i1!|', o: 'o0', s: 's5$z', t: 't7',
  g: 'g69', l: 'l1', b: 'b8', u: 'uv', c: 'ck', z: 'z2'
};

// Builds a regex pattern for one word that tolerates:
//  - letter substitutions (n1gga, a55, etc — see PROFANITY_SUBSTITUTIONS above)
//  - stretched/repeated letters (fuuuck, shiiiit, etc)
// Word-boundary anchors on the outside keep this from matching inside
// unrelated words (e.g. "class" should never trip on "ass").
function buildProfanityPattern(word) {
  var pattern = '';
  for (var i = 0; i < word.length; i++) {
    var ch = word[i];
    var subs = PROFANITY_SUBSTITUTIONS[ch];
    pattern += (subs ? '[' + subs + ']' : ch) + '+';
  }
  return pattern;
}

function containsProfanity(text) {
  if (!text) return false;
  
  var lowerText = text.toLowerCase();
  
  // Check for exact matches and common variations
  for (var i = 0; i < PROFANITY_LIST.length; i++) {
    var word = PROFANITY_LIST[i];
    
    // Check exact word (with word boundaries)
    var regex = new RegExp('\\b' + word + '\\b', 'i');
    if (regex.test(lowerText)) {
      return true;
    }
    
    // Check for leetspeak, common substitutions, and stretched/repeated
    // letters (n1gga, fuuuck, a$$, etc). Uses lookaround instead of \b —
    // \b only works when the match starts/ends on a letter or digit, but
    // these patterns can start/end on a symbol (like the $ in "a$$"),
    // which \b silently fails to anchor correctly.
    var variationRegex = new RegExp('(?<![a-zA-Z0-9])' + buildProfanityPattern(word) + '(?![a-zA-Z0-9])', 'i');
    if (variationRegex.test(lowerText)) {
      return true;
    }
    
    // Check for word with extra separator characters (f.u.c.k, f-u-c-k, etc)
    // FIX: require at least one separator between letters (use [^a-z]+ not *) AND
    // word boundaries around the whole match, so "hello" doesn't trip on "hell"
    // and "scrapbook" doesn't trip on "crap"
    var spacedWord = word.split('').join('[^a-z0-9]+');
    var spacedRegex = new RegExp('(?<![a-zA-Z0-9])' + spacedWord + '(?![a-zA-Z0-9])', 'i');
    if (spacedRegex.test(lowerText)) {
      return true;
    }
  }
  
  return false;
}

async function handleRegister() {
  var username = el('reg-username').value.trim();
  var email = el('reg-email').value.trim();
  var password = el('reg-password').value;
  var confirm = el('reg-confirm').value;
  var btn = el('reg-btn');
  var err = el('reg-error');
  var suc = el('reg-success');
  err.classList.remove('show');
  suc.classList.remove('show');
  if (!username||!email||!password||!confirm) { err.textContent='Fill in all fields!'; err.classList.add('show'); return; }
  if (username.length < 3) { err.textContent='Username must be 3+ chars!'; err.classList.add('show'); return; }
  if (username.length > 20) { err.textContent='Username must be 20 characters or fewer!'; err.classList.add('show'); return; }
  if (!/^[a-zA-Z0-9_\- ]+$/.test(username)) { err.textContent='Username can only contain letters, numbers, spaces, _ and -'; err.classList.add('show'); return; }
  
  // Check for profanity
  if (containsProfanity(username)) {
    err.textContent='Name cannot contain offensive language';
    err.classList.add('show');
    return;
  }
  
  if (password.length < 6) { err.textContent='Password must be 6+ chars!'; err.classList.add('show'); return; }
  if (password !== confirm) { err.textContent='Passwords do not match!'; err.classList.add('show'); return; }
  btn.textContent='Creating...'; btn.disabled=true;
  try {
    await registerUser(email, password, username);
    suc.textContent='Account created! Now login.';
    suc.classList.add('show');
    btn.textContent='Done!';
    setTimeout(function(){ showAuthSection('login'); }, 2000);
  } catch(e) {
    err.textContent=e.message||'Registration failed.';
    err.classList.add('show');
    btn.textContent='Create Account';
    btn.disabled=false;
  }
}

async function handleForgotPassword() {
  var email = el('forgot-email').value.trim();
  var err = el('forgot-error');
  var suc = el('forgot-success');
  err.classList.remove('show');
  suc.classList.remove('show');
  
  if (!email) {
    err.textContent = 'Please enter your email address!';
    err.classList.add('show');
    return;
  }
  
  var btn = event.target;
  btn.textContent = 'Sending...';
  btn.disabled = true;
  
  try {
    // Don't specify redirectTo - let Supabase use the Site URL from settings
    var res = await supabaseClient.auth.resetPasswordForEmail(email);
    
    if (res.error) throw res.error;
    
    suc.textContent = 'Password reset email sent! Check your inbox.';
    suc.classList.add('show');
    el('forgot-email').value = '';
    btn.textContent = '✉️ Send Reset Email';
    btn.disabled = false;
    setTimeout(function(){ showAuthSection('login'); }, 3000);
  } catch(e) {
    err.textContent = e.message || 'Failed to send reset email. Please try again.';
    err.classList.add('show');
    btn.textContent = '✉️ Send Reset Email';
    btn.disabled = false;
  }
}

async function handleResetPassword() {
  var newPassword = el('reset-new-password').value;
  var confirmPassword = el('reset-confirm-password').value;
  var err = el('reset-error');
  var suc = el('reset-success');
  
  err.classList.remove('show');
  suc.classList.remove('show');
  
  if (!newPassword || !confirmPassword) {
    err.textContent = 'Please fill in both password fields!';
    err.classList.add('show');
    return;
  }
  
  if (newPassword.length < 6) {
    err.textContent = 'Password must be at least 6 characters!';
    err.classList.add('show');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    err.textContent = 'Passwords do not match!';
    err.classList.add('show');
    return;
  }
  
  var btn = event.target;
  btn.textContent = 'Updating...';
  btn.disabled = true;
  
  try {
    var res = await supabaseClient.auth.updateUser({
      password: newPassword
    });
    
    if (res.error) throw res.error;
    
    suc.textContent = 'Password updated successfully! Redirecting...';
    suc.classList.add('show');
    
    // Hide reset form, show app
    setTimeout(function() {
      el('reset-password-gate').style.display = 'none';
      el('auth-gate').style.display = 'none';
      initApp();
    }, 2000);
    
  } catch(e) {
    err.textContent = e.message || 'Failed to update password. Please try again.';
    err.classList.add('show');
    btn.textContent = '🔐 Update Password';
    btn.disabled = false;
  }
}

document.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter') return;
  var a = document.querySelector('#auth-gate .page-section.active');
  if (!a) return;
  if (a.id === 'section-login') handleLogin();
  else if (a.id === 'section-register') handleRegister();
});

// ── ADOPT TAB ────────────────────────────
async function loadAdopt() {
  var grid = el('pets-grid');
  if (!currentUser) return;
  grid.innerHTML = '<div class="spinner"></div>';

  var owned = await supabaseClient.from('user_pets').select('pet_id').eq('user_id', currentUser.id);
  if (owned.data) { ownedPetIds = owned.data.map(function(p){ return p.pet_id; }); totalOwnedCount = owned.data.length; }

  var res = await supabaseClient.from('pets').select('*').order('created_at', {ascending:true});
  if (res.error || !res.data) { grid.textContent = 'Could not load pets.'; return; }
  grid.innerHTML = '';
  res.data.forEach(function(pet) { grid.appendChild(makePetCard(pet)); });

  // If player arrived via streamer landing, highlight and scroll to that pet
  var suggestedPet = localStorage.getItem('suggestedFirstPet');
  if (suggestedPet) {
    setTimeout(function() {
      var cards = grid.querySelectorAll('.pet-card');
      cards.forEach(function(card) {
        var nameEl = card.querySelector('.pet-name');
        if (nameEl && nameEl.textContent.trim().toLowerCase() === suggestedPet.toLowerCase()) {
          card.classList.add('streamer-landing-highlight');
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Remove highlight after a few seconds, clear suggestion after first adopt
          setTimeout(function() { card.classList.remove('streamer-landing-highlight'); }, 4000);
        }
      });
    }, 200);
  }
}

function makePetCard(pet) {
  var isPlaceholder = pet.name === '???';
  var isOwned = ownedPetIds.indexOf(pet.id) !== -1;
  
  // DYNAMIC PRICING: Calculate price based on how many pets player already owns
  // 1st pet = 0, 2nd = 100, 3rd = 150, 4th = 200, etc. (+50 each time)
  var price = 0;
  if (totalOwnedCount === 0) {
    price = 0; // First pet is always free
  } else if (totalOwnedCount === 1) {
    price = 100; // Second pet costs 100
  } else {
    // 3rd pet onwards: 150, 200, 250, 300, etc.
    price = 100 + ((totalOwnedCount - 1) * 50);
  }
  
  var canAfford = currentPoints >= price;

  var card = document.createElement('div');
  card.className = 'pet-card' + (isPlaceholder ? ' placeholder' : '') + (isOwned ? ' already-owned' : '');

  var imgWrap = makeEl('div', {class:'pet-image-wrap'});
  if (pet.image_file && !isPlaceholder) {
    var img = makeEl('img', {src:'images/'+pet.image_file, alt:pet.name});
    img.onerror = function(){ this.parentElement.innerHTML = '&#128062;'; };
    imgWrap.appendChild(img);
  } else {
    imgWrap.innerHTML = isPlaceholder ? '&#10067;' : '&#128062;';
  }
  card.appendChild(imgWrap);
  var nameEl = makeEl('div', {class:'pet-name'}, isPlaceholder ? '???' : pet.name);
  card.appendChild(nameEl);
  if (!isPlaceholder) maybeApplyNameGlitch(nameEl, pet.name);
  if (pet.vtuber_name && !isPlaceholder) card.appendChild(makeEl('div', {class:'pet-vtuber'}, pet.vtuber_name));
  card.appendChild(makeEl('div', {class:'pet-description'}, isPlaceholder ? 'A mystery pet...' : (pet.description || '')));

  if (!isPlaceholder) {
    var priceEl = makeEl('span', {class: price === 0 ? 'pet-price free' : 'pet-price'}, price === 0 ? 'FREE' : '\uD83E\uDE99 ' + price + ' PP');
    card.appendChild(priceEl);
  }

  var btn = document.createElement('button');
  if (isPlaceholder) { btn.className='btn-locked'; btn.textContent='Coming Soon'; }
  else if (isOwned) { btn.className='btn-owned'; btn.textContent='Already Adopted!'; }
  else if (!canAfford) { btn.className='btn-locked'; btn.textContent='Need '+price+' PP'; }
  else {
    btn.className='btn btn-primary btn-adopt';
    btn.textContent='Adopt!';
    btn.addEventListener('click', function() {
      selectedPet = {id:pet.id, name:pet.name, description:pet.description||'', image_file:pet.image_file||'', price:price};
      openAdoptModal();
    });
  }
  card.appendChild(btn);
  return card;
}

function openAdoptModal() {
  var mi = el('modal-image');
  if (selectedPet.image_file) {
    var img = makeEl('img', {src:'images/'+selectedPet.image_file, alt:selectedPet.name});
    img.onerror = function(){ mi.innerHTML='&#128062;'; };
    mi.innerHTML=''; mi.appendChild(img);
  } else { mi.innerHTML='&#128062;'; }
  el('modal-title').textContent = 'Adopt ' + selectedPet.name + '?';
  el('modal-desc').textContent = selectedPet.price === 0 ? 'Your first pet is free!' : 'This will cost ' + selectedPet.price + ' PawketPoints.';
  el('nickname-input').value = '';
  el('adopt-modal').classList.add('show');
}

function closeAdoptModal() { el('adopt-modal').classList.remove('show'); selectedPet = null; }
function closeSuccessModal() { el('success-modal').classList.remove('show'); tabsLoaded['adopt'] = false; loadAdopt(); lastAdoptedPet = null; }

// Store last adopted pet for sharing
var lastAdoptedPet = null;

async function confirmAdopt() {
  if (!selectedPet || !currentUser) return;
  
  // Rate limiting
  if (!canPerformAction('adopt_pet', 1000)) {
    showToast('Please wait before adopting again!');
    return;
  }
  
  var btn = el('confirm-adopt-btn');
  var nickname = el('nickname-input').value.trim();
  
  // Nickname is optional — empty falls through to selectedPet.name below
  if (nickname.length > 50) {
    showToast('Nickname must be 50 characters or less! ❌');
    return;
  }
  
  if (/<\/?[a-z][\s\S]*>/i.test(nickname)) {
    showToast('Nickname cannot contain HTML tags! ❌');
    return;
  }
  
  if (containsProfanity(nickname)) {
    showToast('Please choose a family-friendly nickname! ❌');
    return;
  }
  
  // Use provided nickname or fallback to pet name
  if (nickname === '') {
    nickname = selectedPet.name;
  }
  
  btn.textContent = 'Adopting...'; 
  btn.disabled = true;
  
  // Call secure database function
  var { data: result, error } = await supabaseClient.rpc('adopt_pet_secure', {
    p_pet_type: selectedPet.name,
    p_nickname: nickname,
    p_price: selectedPet.price
  });
  
  if (error) {
    showToast('Adoption failed: ' + error.message);
    btn.textContent = 'Adopt!'; 
    btn.disabled = false; 
    return;
  }
  
  // Update display
  updateAllPoints(currentPoints - (result.price_paid || 0));
  
  // SCRAPBOOK: Add adoption memory
  if (result.pet_id) {
    scrapbook_addMemory(result.pet_id, 'adopted', {});
  }
  
  // ACTIVITY FEED: Log adoption so friend feeds + OBS live alerts pick it up
  logActivity('pet_adopted', { pet_name: nickname || selectedPet.name, species: selectedPet.name, nickname: nickname || null });
  
  // Store for social sharing
  lastAdoptedPet = {
    name: selectedPet.name,
    nickname: nickname,
    emoji: getPetEmoji(selectedPet.name)
  };
  
  // Award first pet badge
  await awardBadge('first_pet');
  onPetAdopted(result.pet_id);
  supabaseClient.rpc('increment_global_stat', { p_key: 'total_pets_adopted', p_amount: 1 }).catch(function(){});
  
  // PHASE 8 - Process referral on first adoption
  await processReferral();
  
  // Clear streamer landing suggestion — they've adopted now
  localStorage.removeItem('suggestedFirstPet');

  // Track adoption in analytics
  trackPetAdoption(selectedPet.name);
  
  closeAdoptModal();
  el('success-message').textContent = nickname + ' has joined your collection!';
  el('success-modal').classList.add('show');
  
  // 🎉 CONFETTI BURST!
  setTimeout(function() {
    createConfettiBurst(window.innerWidth / 2, window.innerHeight / 2);
  }, 100);
  
  // Notify tutorial if active
  if (typeof Tutorial !== 'undefined' && Tutorial.active) {
    Tutorial.onPetAdopted();
  }
  
  if (selectedPet) ownedPetIds.push(selectedPet.id); 
  totalOwnedCount++;
  tabsLoaded['mypets'] = false;
  btn.textContent = 'Adopt!'; 
  btn.disabled = false;
}

// ── MY PETS TAB ──────────────────────────
async function loadInventoryData() {
  inventoryItems = [];
  if (!currentUser) return;
  var invRes = await supabaseClient.from('user_inventory').select('id,item_id,quantity').eq('user_id',currentUser.id).gt('quantity',0);
  if (invRes.error || !invRes.data || !invRes.data.length) return;
  var itemIds = invRes.data.map(function(r){ return r.item_id; });
  var itemsRes = await supabaseClient.from('items').select('id,name,effect,value,effect_value,hunger_effect,energy_effect,happiness_effect,xp_effect').in('id',itemIds);
  var itemMap = {};
  if (itemsRes.data) itemsRes.data.forEach(function(i){ itemMap[i.id]=i; });
  invRes.data.forEach(function(row) {
    var item = itemMap[row.item_id] || {};
    inventoryItems.push({
      invId: row.id, 
      itemId: row.item_id, 
      name: item.name || 'Item', 
      qty: row.quantity, 
      effect: item.effect,
      value: item.value,
      effect_value: item.effect_value,
      h: item.hunger_effect || 0, 
      e: item.energy_effect || 0, 
      hap: item.happiness_effect || 0, 
      xp: item.xp_effect || 0
    });
  });
}

function getEffectText(item) {
  var p = [];
  if (item.h > 0) p.push('+'+item.h+' Hunger');
  if (item.e > 0) p.push('+'+item.e+' Energy');
  if (item.hap > 0) p.push('+'+item.hap+' Happiness');
  if (item.xp > 0) p.push('+'+item.xp+' XP');
  return p.join('  ');
}

async function loadMyPets() {
  var container = el('mypets-container');
  if (!currentUser) return;
  container.innerHTML = '<div class="spinner"></div>';
  await loadInventoryData();
  
  // OPTIMIZATION 2: Single JOIN query instead of N+1 queries
  // Fetch pets WITH titles in one query instead of 1 + N queries
  var res = await supabaseClient
    .from('user_pets')
    .select(`
      *,
      pets(name, image_file, vtuber_name, twitch_url),
      user_pet_titles(
        pet_title_id,
        pet_titles(*)
      )
    `)
    .eq('user_id', currentUser.id)
    .order('adopted_at', {ascending: true});
  
  if (res.error) { 
    console.error('Error loading pets:', res.error);
    container.textContent='Could not load pets.'; 
    return; 
  }
  
  if (!res.data || !res.data.length) {
    container.innerHTML='<div class="empty-state"><div style="font-size:3rem;margin-bottom:14px;">&#128062;</div><h2 style="color:var(--purple-dark);margin-bottom:10px;">No pets yet!</h2><p style="color:var(--text-light);margin-bottom:18px;">Head to the adoption centre!</p><button class="btn btn-primary btn-lg" onclick="showTab(\'adopt\')">Adopt a Pet</button></div>';
    return;
  }
  
  // Process pets and calculate decay for DISPLAY ONLY (don't save back to DB!)
  res.data.forEach(function(pet) {
    var decayedEnergy = calculateEnergyRegen(pet.energy, pet.max_energy, pet.last_played);
    var decayedHunger = calculateHungerDecay(pet.hunger, pet.last_fed);
    var decayedHappiness = calculateHappinessDecay(pet.happiness, pet.last_fed, pet.last_played);
    
    // HP regenerates over time (3 HP per hour) - BUT respect 0 HP (fainted)!
    // user_pets has no updated_at column — use last_played as the regen reference
    // (battle sets current_hp directly; last_played is the closest proxy for "last activity")
    var currentHP = (pet.current_hp !== null && pet.current_hp !== undefined) ? pet.current_hp : (pet.base_hp || 25);
    var maxHP = pet.max_hp || pet.base_hp || 25;
    var hpRegenRef = pet.last_played || pet.last_fed || null;
    
    // Only regenerate if HP > 0 (don't auto-revive fainted pets!)
    var regenedHP = currentHP > 0 ? calculateHPRegen(currentHP, maxHP, hpRegenRef) : 0;
    
    petState[pet.id] = Object.assign({}, pet, {
      energy: decayedEnergy,
      hunger: decayedHunger,
      happiness: decayedHappiness,
      current_hp: regenedHP
    });
    
    // OPTIMIZATION 2: Cache titles from joined query (already loaded above)
    if (pet.user_pet_titles && pet.user_pet_titles.length > 0) {
      petTitlesCache[pet.id] = pet.user_pet_titles.map(function(upt) {
        return upt.pet_titles;
      });
    } else {
      petTitlesCache[pet.id] = [];
    }
  });
  
  // OPTIMIZATION 1: Use DocumentFragment for batch DOM operations
  // Build all cards in memory, then append once (1 reflow instead of N reflows)
  var grid = document.createElement('div');
  grid.className = 'mypets-grid';
  
  var fragment = document.createDocumentFragment();
  Object.values(petState).forEach(function(pet) { 
    fragment.appendChild(makeMyPetCard(pet)); 
  });
  grid.appendChild(fragment);
  container.innerHTML = '';
  container.appendChild(grid);

  // Apply variants AFTER cards are in the live DOM so getElementById finds them
  Object.values(petState).forEach(function(pet) {
    if (pet && pet.current_variant) {
      setTimeout(function() { skinkey_applyVariantToAllDisplays(pet.id, pet.current_variant); }, 50);
    }
  });
}

// Feed/Play event delegation - attached to document once, always works
if (!window._pawketFeedPlayDelegationSetup) {
  window._pawketFeedPlayDelegationSetup = true;
  document.addEventListener('click', function(e) {
    var feedBtn = e.target.closest('.btn-feed');
    if (feedBtn) {
      var petId = feedBtn.getAttribute('data-pet-id');
      if (petId && typeof feed === 'function') {
        feed(petId); // UUID string - do NOT parseInt
      }
      return;
    }
    var playBtn = e.target.closest('.btn-play');
    if (playBtn) {
      var petId = playBtn.getAttribute('data-pet-id');
      if (petId && typeof play === 'function') {
        play(petId); // UUID string - do NOT parseInt
      }
      return;
    }
  });
}

function makeDropdown(petId) {
  var section = makeEl('div', {class:'use-item-section'});
  var label = makeEl('div', {class:'use-item-label'}, 'Use an Item');
  section.appendChild(label);
  if (!inventoryItems.length) {
    var p = makeEl('p', {style:'font-size:0.8rem;color:var(--text-light)'}, 'No items. ');
    var a = makeEl('a', {href:'#'}, 'Visit the shop!');
    a.onclick = function(){ showTab('shop'); return false; };
    p.appendChild(a);
    section.appendChild(p);
    return section;
  }
  var row = makeEl('div', {class:'use-item-row'});
  var sel = makeEl('select', {class:'item-select', id:'sel-'+petId});
  sel.appendChild(makeEl('option', {value:''}, 'Select an item'));
  inventoryItems.forEach(function(item) {
    sel.appendChild(makeEl('option', {value:item.invId}, item.name + ' (x'+item.qty+')'));
  });
  sel.onchange = function(){ previewItem(petId); };
  var useBtn = makeEl('button', {class:'btn-use-item', id:'usebtn-'+petId}, 'Use Item');
  useBtn.disabled = true;
  useBtn.onclick = function(){ useItem(petId); };
  row.appendChild(sel);
  row.appendChild(useBtn);
  section.appendChild(row);
  var preview = makeEl('div', {class:'item-effect-preview', id:'preview-'+petId});
  preview.textContent = 'Choose an item to see effects';
  section.appendChild(preview);
  return section;
}

function previewItem(petId) {
  var sel = el('sel-'+petId);
  var preview = el('preview-'+petId);
  var btn = el('usebtn-'+petId);
  if (!sel || !sel.value) { if(preview) preview.textContent=''; if(btn) btn.disabled=true; return; }
  var item = inventoryItems.find(function(i){ return i.invId === sel.value; });
  if (!item) { if(preview) preview.textContent=''; if(btn) btn.disabled=true; return; }
  preview.textContent = 'Will give: ' + getEffectText(item);
  btn.disabled = false;
}

// ── EDIT PET NICKNAME ─────────────────────────────
function openEditNicknameModal(petId, currentNickname) {
  // Create modal overlay
  var overlay = makeEl('div', {class:'modal-overlay', id:'edit-nickname-overlay'});
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;';
  
  // Create modal
  var modal = makeEl('div', {class:'modal-content'});
  modal.style.cssText = 'background:var(--cream);border:4px solid var(--purple);border-radius:24px;padding:30px;max-width:400px;width:90%;box-shadow:0 8px 32px rgba(153,102,255,0.4);';
  
  // Title
  var title = makeEl('h2', {style:'font-family:Chewy,cursive;color:var(--purple);margin:0 0 20px 0;text-align:center;'});
  title.textContent = 'Edit Nickname';
  modal.appendChild(title);
  
  // Input
  var input = makeEl('input', {type:'text', id:'nickname-input', maxlength:'30', value:currentNickname});
  input.style.cssText = 'width:100%;padding:12px;font-size:1.1rem;border:3px solid var(--purple-light);border-radius:12px;font-family:Fredoka One,cursive;margin-bottom:20px;box-sizing:border-box;';
  input.placeholder = 'Enter new nickname...';
  modal.appendChild(input);
  
  // Character count
  var charCount = makeEl('div', {id:'char-count', style:'text-align:right;color:var(--text-light);font-size:0.9rem;margin:-10px 0 15px 0;'});
  charCount.textContent = currentNickname.length + '/30';
  modal.appendChild(charCount);
  
  input.oninput = function() {
    var count = this.value.length;
    charCount.textContent = count + '/30';
    if (count > 25) {
      charCount.style.color = 'var(--pink)';
    } else {
      charCount.style.color = 'var(--text-light)';
    }
  };
  
  // Buttons
  var btnRow = makeEl('div', {style:'display:flex;gap:10px;justify-content:center;'});
  
  var cancelBtn = makeEl('button', {class:'btn btn-outline'});
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = function() { closeEditNicknameModal(); };
  
  var saveBtn = makeEl('button', {class:'btn btn-primary'});
  saveBtn.textContent = 'Save';
  saveBtn.onclick = function() { saveNickname(petId); };
  
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);
  modal.appendChild(btnRow);
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Focus input and select all
  setTimeout(function() {
    input.focus();
    input.select();
  }, 100);
  
  // Enter key to save
  input.onkeypress = function(e) {
    if (e.key === 'Enter') {
      saveNickname(petId);
    }
  };
}

function closeEditNicknameModal() {
  var overlay = el('edit-nickname-overlay');
  if (overlay && overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
  }
}

async function saveNickname(petId) {
  var input = el('nickname-input');
  if (!input) return;
  
  var newNickname = input.value.trim();
  
  // Validation
  if (!newNickname) {
    showToast('Please enter a nickname! ❌');
    return;
  }
  
  if (newNickname.length > 30) {
    showToast('Nickname too long! (Max 30 characters) ❌');
    return;
  }
  
  if (/<\/?[a-z][\s\S]*>/i.test(newNickname)) {
    showToast('Nickname cannot contain HTML tags! ❌');
    return;
  }
  
  if (containsProfanity(newNickname)) {
    showToast('Please choose a family-friendly nickname! ❌');
    return;
  }
  
  try {
    // Update in database
    var res = await supabaseClient
      .from('user_pets')
      .update({ nickname: newNickname })
      .eq('id', petId)
      .eq('user_id', currentUser.id);
    
    if (res.error) {
      console.error('Error updating nickname:', res.error);
      showToast('Failed to update nickname ❌');
      return;
    }
    
    // Update local state
    if (petState[petId]) {
      petState[petId].nickname = newNickname;
    }
    
    // Close modal
    closeEditNicknameModal();
    
    // Reload pets page to show new nickname
    loadMyPets();
    
    showToast('Nickname updated! ✨');
    
  } catch (err) {
    console.error('Error saving nickname:', err);
    showToast('Failed to update nickname ❌');
  }
}

async function useItem(petId) {
  var sel = el('sel-'+petId); 
  if (!sel || !sel.value) return;
  if (!canPerformAction('use_item', 500)) return;
  
  var idx = inventoryItems.findIndex(function(i){ return i.invId === sel.value; }); 
  if (idx === -1) return;
  
  var item = inventoryItems[idx]; 
  var pet = petState[petId]; 
  if (!pet) return;
  
  var btn = el('usebtn-'+petId); 
  btn.disabled = true; 
  btn.textContent = '...';
  
  var updates = {};
  
  dbg('=== USE ITEM DEBUG ===');
  dbg('Item:', item);
  dbg('Item effect:', item.effect);
  dbg('Item value:', item.value);
  dbg('Item effect_value:', item.effect_value);
  
  // Handle healing items (HP restoration)
  var healValue = item.value || item.effect_value || 0;
  dbg('Heal value calculated:', healValue);
  dbg('Is healing item?', item.effect === 'healing', healValue > 0);
  
  if (item.effect === 'healing' && healValue > 0) {
    // Get current HP and max HP from database
    var petRes = await supabaseClient
      .from('user_pets')
      .select('current_hp, max_hp, base_hp')
      .eq('id', petId)
      .single();
    
    if (petRes.error) {
      showToast('Error: ' + petRes.error.message);
      btn.disabled = false;
      btn.textContent = 'Use';
      return;
    }
    
    // FIX: Respect 0 HP! Don't use base_hp as fallback for 0
    var currentHP = (petRes.data.current_hp !== null && petRes.data.current_hp !== undefined) ? petRes.data.current_hp : (petRes.data.base_hp || 30);
    var maxHP = petRes.data.max_hp || petRes.data.base_hp || 30;
    
    dbg('🩹 Healing - Current HP:', currentHP, 'Max HP:', maxHP, 'Heal amount:', healValue);
    
    // Check if already at full HP
    if (currentHP >= maxHP) {
      showToast('❤️ Pet is already at full HP!');
      btn.disabled = false;
      btn.textContent = 'Use';
      return;
    }
    
    // Calculate new HP (can't exceed max)
    var newHP = Math.min(currentHP + healValue, maxHP);
    var healedAmount = newHP - currentHP;
    
    updates.current_hp = newHP;
    showToast('💚 Healed ' + healedAmount + ' HP! (' + newHP + '/' + maxHP + ')');
  }
  
  // Handle other item effects
  if (item.h > 0) updates.hunger = Math.min(pet.hunger + item.h, pet.max_hunger);
  if (item.e > 0) updates.energy = Math.min(pet.energy + item.e, pet.max_energy);
  if (item.hap > 0) updates.happiness = Math.min(pet.happiness + item.hap, pet.max_happiness);
  if (item.xp > 0) updates.xp = pet.xp + item.xp;
  
  // Make sure we have some effect to apply
  if (!Object.keys(updates).length) { 
    showToast('No effects configured.'); 
    btn.disabled = false; 
    btn.textContent = 'Use'; 
    return; 
  }
  
  // FIX: update last_fed if this is a food item so decay calculates correctly
  if (item.h > 0) updates.last_fed = new Date().toISOString();

  // Apply the updates
  var res = await supabaseClient.from('user_pets').update(updates).eq('id', petId);
  if (res.error) { 
    showToast('Error: ' + res.error.message); 
    btn.disabled = false; 
    btn.textContent = 'Use'; 
    return; 
  }
  
  // Remove item from inventory
  if (item.qty <= 1) { 
    await supabaseClient.from('user_inventory').delete().eq('id', item.invId); 
    inventoryItems.splice(idx, 1); 
  } else { 
    await supabaseClient.from('user_inventory').update({quantity: item.qty - 1}).eq('id', item.invId); 
    inventoryItems[idx].qty = item.qty - 1; 
  }

  // FIX: track bingo + passXP (was missing from this path)
  if (item.h > 0) {
    updateBingoProgress('feed_pet', 1);
    melonRequests_checkProgress('feed_pet', itemId);
    addPassXP(2, 'feed').catch(function(){});
    community_increment('feed_pets', 1);
  }
  if (item.hap > 0 && !(item.h > 0)) {
    updateBingoProgress('use_toy', 1);
    updateBingoProgress('play_pet', 1);
    addPassXP(2, 'play').catch(function(){});
  }
  
  // Update UI for non-healing effects
  if (updates.hunger !== undefined) { 
    petState[petId].hunger = updates.hunger; 
    updateBar(petId, 'hunger', updates.hunger, pet.max_hunger); 
  }
  if (updates.energy !== undefined) { 
    petState[petId].energy = updates.energy; 
    updateBar(petId, 'energy', updates.energy, pet.max_energy); 
  }
  if (updates.happiness !== undefined) { 
    petState[petId].happiness = updates.happiness; 
    updateBar(petId, 'happiness', updates.happiness, pet.max_happiness); 
  }
  if (updates.xp !== undefined) { 
    petState[petId].xp = updates.xp; 
    updateXpBar(petId, updates.xp, pet.level); 
  }
  if (updates.current_hp !== undefined) {
    // Update petState and reload the entire card to show new HP
    petState[petId].current_hp = updates.current_hp;
    tabsLoaded['mypets'] = false;
    loadMyPets();
  }
  
  // Show effect flash (skip for healing items since we already showed toast)
  if (!updates.current_hp) {
    showFlash(petId, item.name + ': ' + getEffectText(item), '#b06aff');
    showToast('Used ' + item.name + '!');
  // Store in companion memory
  if (typeof CompanionBuddy !== 'undefined') CompanionBuddy.lastFoodUsed = item.name;
  }
  
  // Refresh the dropdown
  var card = el('petcard-' + petId);
  if (card) { 
    var old = card.querySelector('.use-item-section'); 
    if (old) old.replaceWith(makeDropdown(petId)); 
  }
  
  btn.disabled = false; 
  btn.textContent = 'Use';
}

function getMoodEmoji(happiness, hunger, energy, maxHappiness, maxHunger, maxEnergy) {
  // Use the comprehensive mood calculator if max values provided
  if (maxHappiness && maxHunger && maxEnergy) {
    var mood = getPetMood(hunger, energy, happiness, maxHunger, maxEnergy, maxHappiness);
    return mood.emoji;
  }
  
  // Fallback to simple mood
  if (happiness >= 80 && hunger >= 60) return '😊';
  if (happiness >= 60) return '🙂';
  if (happiness >= 40) return '😐';
  if (happiness >= 20) return '😟';
  return '😭';
}

function getHabitatStyle(vtuberName) {
  var habitats = {
    'Embertail': 'background: linear-gradient(180deg, #ff9f43 0%, #ffcc70 60%, #fffaf6 100%)',
    'Pyxshuul':  'background: linear-gradient(180deg, #b06aff 0%, #e8d5ff 60%, #fffaf6 100%)',
  };
  return habitats[vtuberName] || 'background: linear-gradient(180deg, var(--purple) 0%, var(--purple-light) 60%, #fffaf6 100%)';
}

function getAchievements(pet) {
  var badges = [];
  if (pet.level >= 2) badges.push({icon:'&#11088;', label:'Lv.'+pet.level, cls:'gold'});
  if (pet.level >= 5) badges.push({icon:'&#127775;', label:'Veteran', cls:'purple'});
  if (pet.level >= 10) badges.push({icon:'&#128081;', label:'Legend', cls:'gold'});
  if (pet.xp >= 50) badges.push({icon:'&#127941;', label:'Trained', cls:'bronze'});
  if (pet.happiness >= 80) badges.push({icon:'&#128150;', label:'Happy', cls:'silver'});
  if (pet.max_hunger > 100) badges.push({icon:'&#128200;', label:'Growing', cls:'purple'});
  return badges;
}

function getLastSeenText(lastFed, lastPlayed) {
  var lastTime = null;
  if (lastFed && lastPlayed) {
    lastTime = new Date(lastFed) > new Date(lastPlayed) ? new Date(lastFed) : new Date(lastPlayed);
  } else if (lastFed) { lastTime = new Date(lastFed); }
  else if (lastPlayed) { lastTime = new Date(lastPlayed); }
  else return 'Never interacted yet';

  var mins = Math.floor((new Date() - lastTime) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + ' minute' + (mins===1?'':'s') + ' ago';
  var hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + ' hour' + (hrs===1?'':'s') + ' ago';
  var days = Math.floor(hrs / 24);
  return days + ' day' + (days===1?'':'s') + ' ago';
}

function makeMyPetCard(pet) {
  var info = pet.pets || {};
  var xpNext = pet.level * GAME_CONSTANTS.XP_PER_LEVEL;
  var hPct = Math.round(pet.hunger/pet.max_hunger*100);
  var hapPct = Math.round(pet.happiness/pet.max_happiness*100);
  var ePct = Math.round(pet.energy/pet.max_energy*100);
  var xpPct = Math.min(pet.xp/xpNext*100, 100);
  var mood = getPetMood(pet.hunger, pet.energy, pet.happiness, pet.max_hunger, pet.max_energy, pet.max_happiness);
  var moodEmoji = mood.emoji;
  var achievements = getAchievements(pet);
  var lastSeen = getLastSeenText(pet.last_fed, pet.last_played);
  
  // Evolution info
  var evolutionStage = getEvolutionStage(pet.level);
  var evolutionEmoji = getEvolutionEmoji(evolutionStage);
  var stageName = evolutionStage.charAt(0).toUpperCase() + evolutionStage.slice(1);
  var backstory = getPetBackstory(info.name);

  var card = makeEl('div', {class:'my-pet-card', id:'petcard-'+pet.id});

  // Habitat banner with avatar
  var habitat = makeEl('div', {class:'pet-habitat'});
  habitat.setAttribute('style', getHabitatStyle(info.vtuber_name));
  
  var avatarWrap = makeEl('div', {class:'pet-avatar-wrap'});
  var avatar = makeEl('div', {class:'pet-avatar'});
  if (info.image_file) {
    var img = makeEl('img', {src:'images/'+info.image_file, alt:pet.nickname});
    img.onerror = function(){ this.parentElement.innerHTML='&#128062;'; };
    avatar.appendChild(img);
  } else { avatar.innerHTML='&#128062;'; }

  // Apply variant class immediately so it shows on page load
  var activeVariant = skinkey_getCurrentVariant(pet.id);
  if (activeVariant) {
    var varCls = BASIC_VARIANTS[activeVariant] ? BASIC_VARIANTS[activeVariant].cssClass : 'pet-variant-' + activeVariant;
    card.classList.add(varCls);
    avatar.classList.add(varCls);
    avatarWrap.classList.add(varCls);
    // Spawn particles (slight delay so card is in DOM)
    setTimeout(function() { createVariantParticles(card, activeVariant, 12); }, 300);
  }

  // Show 🧭 Exploring badge if this pet is on an expedition
  if (_battleExpeditionPetIds && _battleExpeditionPetIds.indexOf(pet.id) !== -1) {
    var exploringBadge = makeEl('div');
    exploringBadge.innerHTML = '🧭 Exploring';
    exploringBadge.style.cssText = 'position:absolute;top:8px;left:8px;background:rgba(153,102,255,0.85);color:white;font-size:0.68rem;font-weight:700;padding:3px 8px;border-radius:20px;z-index:10;';
    card.style.position = 'relative';
    card.appendChild(exploringBadge);
  }
  var moodBadge = makeEl('div', {class:'mood-badge'});
  moodBadge.innerHTML = moodEmoji;
  avatarWrap.appendChild(avatar);
  avatarWrap.appendChild(moodBadge);
  habitat.appendChild(avatarWrap);
  card.appendChild(habitat);

  // Card body
  var body = makeEl('div', {class:'pet-card-body'});
  
  // NAME ROW - nickname + edit button (CLEAN CENTERED LAYOUT)
  var nameRow = makeEl('div', {class:'pet-name-row'});
  var nicknameSpan = makeEl('span', {class:'pet-nickname'}, evolutionEmoji + ' ' + pet.nickname);
  maybeApplyNameGlitch(nicknameSpan, evolutionEmoji + ' ' + pet.nickname);
  var editBtn = makeEl('button', {class:'pet-edit-btn', title:'Edit nickname'});
  editBtn.textContent = '✏️';
  editBtn.onclick = function() { openEditNicknameModal(pet.id, pet.nickname); };
  nameRow.appendChild(nicknameSpan);
  nameRow.appendChild(editBtn);
  body.appendChild(nameRow);
  
  // EVOLUTION STAGE
  var stageDiv = makeEl('div', {class:'pet-stage'}, '(' + stageName + ')');
  body.appendChild(stageDiv);
  
  // VARIANT BADGE (if exists)
  if (pet.variant) {
    var variantDiv = makeEl('div', {class:'pet-variant-badge-wrap'});
    variantDiv.innerHTML = getPetVariantBadge(pet.variant);
    body.appendChild(variantDiv);
  }
  
  // PET TITLE (if exists)
  if (pet.active_pet_title_id) {
    var titleDiv = makeEl('div', {class:'pet-title-display-wrap'});
    titleDiv.innerHTML = getPetTitleDisplay(pet.id);
    body.appendChild(titleDiv);
  }
  
  // SPECIES/VTUBER NAME
  var speciesDiv = makeEl('div', {class:'pet-species'}, info.vtuber_name || '');
  body.appendChild(speciesDiv);
  
  // BIO TEXT
  var bioDiv = makeEl('div', {class:'pet-bio'}, backstory);
  body.appendChild(bioDiv);
  
  // LEVEL
  var levelDiv = makeEl('div', {class:'pet-level'}, 'Lv. ' + pet.level);
  body.appendChild(levelDiv);

  // Last interaction
  var lastSeenEl = makeEl('div', {class:'pet-last-seen'}, 'Last interaction: ' + lastSeen);
  body.appendChild(lastSeenEl);
  maybeApplyNameGlitch(lastSeenEl, 'Last interaction: ' + lastSeen);

  // Achievements
  if (achievements.length > 0) {
    var achRow = makeEl('div', {class:'achievements-row'});
    achievements.forEach(function(ach) {
      var badge = makeEl('span', {class:'ach-badge '+ach.cls});
      badge.innerHTML = ach.icon + ' ' + ach.label;
      achRow.appendChild(badge);
    });
    body.appendChild(achRow);
  }

  // Mood status display
  var moodDisplay = makeEl('div', {class:'pet-mood-display'});
  moodDisplay.style.cssText = 'text-align:center;padding:8px;margin:10px 0;background:' + mood.color + '20;border:2px solid ' + mood.color + ';border-radius:12px;font-weight:bold;color:' + mood.color + ';';
  moodDisplay.innerHTML = mood.emoji + ' Mood: ' + mood.mood;
  body.appendChild(moodDisplay);

  // Personality message — character-specific flavor text based on mood state
  var petType = info.vtuber_name || info.name || '';
  var personalityMsg = getPetPersonalityMessage(
    petType,
    pet.hunger, pet.energy, pet.happiness,
    pet.max_hunger, pet.max_energy, pet.max_happiness,
    pet.last_fed, pet.last_played
  );
  if (personalityMsg) {
    var personalityDiv = makeEl('div', {class:'pet-personality-msg'});
    personalityDiv.style.cssText = 'font-size:0.82rem;color:var(--text-light);font-style:italic;text-align:center;' +
      'padding:8px 12px;margin:0 0 8px 0;background:rgba(153,102,255,0.06);border-radius:10px;line-height:1.5;';
    personalityDiv.textContent = '"' + personalityMsg + '"';
    body.appendChild(personalityDiv);
  }

  // Battle Stats (if they exist)
  if (pet.base_hp || pet.base_attack || pet.base_defense || pet.base_speed) {
    var battleStats = makeEl('div', {class:'pet-battle-stats'});
    battleStats.style.cssText = 'display:flex;justify-content:space-around;padding:12px;margin:10px 0;background:rgba(176,106,255,0.1);border:2px solid var(--purple-light);border-radius:12px;';
    
    // HP with current/max display
    var currentHP = (pet.current_hp !== null && pet.current_hp !== undefined) ? pet.current_hp : (pet.base_hp || 30);
    var maxHP = pet.max_hp || pet.base_hp || 30;
    var hpPercent = Math.round((currentHP / maxHP) * 100);
    var hpColor = hpPercent > 50 ? '#5dde7a' : hpPercent > 25 ? '#ffaa00' : '#ff6b6b';
    
    var hpStat = makeEl('div', {class:'battle-stat-mini'});
    hpStat.setAttribute('data-tooltip', '❤️ HEALTH POINTS\nHP carries over between battles!\nAt 0 HP your pet faints. Use a Revive Potion.\n\n💡 HP regenerates slowly over time.\nHeal faster with potions from the Shop.');
    hpStat.style.cursor = 'help';
    hpStat.innerHTML = '<div style="font-size:0.7rem;color:var(--text-light);text-transform:uppercase;">HP</div>' +
      '<div style="font-weight:bold;color:var(--purple);font-size:1.1rem;">' + currentHP + '/' + maxHP + '</div>' +
      '<div style="width:60px;height:4px;background:#e0e0e0;border-radius:2px;margin-top:4px;overflow:hidden;">' +
      '<div style="width:' + hpPercent + '%;height:100%;background:' + hpColor + ';transition:width 0.3s;"></div></div>';
    battleStats.appendChild(hpStat);
    
    var atkStat = makeEl('div', {class:'battle-stat-mini', id:'atk-stat-'+pet.id});
    atkStat.setAttribute('data-tooltip', '⚔️ ATTACK\nHow much damage your pet deals in battle.\n\n💡 Increase by:\n• Leveling up\n• Equipping weapons\n• Evolution');
    atkStat.style.cursor = 'help';
    atkStat.innerHTML = '<div style="font-size:0.7rem;color:var(--text-light);text-transform:uppercase;">ATK</div><div style="font-weight:bold;color:var(--purple);font-size:1.1rem;">' + (pet.base_attack || 5) + '</div>';
    battleStats.appendChild(atkStat);
    
    var defStat = makeEl('div', {class:'battle-stat-mini', id:'def-stat-'+pet.id});
    defStat.setAttribute('data-tooltip', '🛡️ DEFENSE\nReduces damage taken from enemy attacks.\n\n💡 Increase by:\n• Leveling up\n• Equipping armor\n• Evolution');
    defStat.style.cursor = 'help';
    defStat.innerHTML = '<div style="font-size:0.7rem;color:var(--text-light);text-transform:uppercase;">DEF</div><div style="font-weight:bold;color:var(--purple);font-size:1.1rem;">' + (pet.base_defense || 3) + '</div>';
    battleStats.appendChild(defStat);
    
    var spdStat = makeEl('div', {class:'battle-stat-mini', id:'spd-stat-'+pet.id});
    spdStat.setAttribute('data-tooltip', '💨 SPEED\nDetermines who attacks first in battles.\nAlso affects race performance!\n\n💡 Increase by:\n• Leveling up\n• Speed equipment\n• Certain variants');
    spdStat.style.cursor = 'help';
    spdStat.innerHTML = '<div style="font-size:0.7rem;color:var(--text-light);text-transform:uppercase;">SPD</div><div style="font-weight:bold;color:var(--purple);font-size:1.1rem;">' + (pet.base_speed || 4) + '</div>';
    battleStats.appendChild(spdStat);
    
    // Luck and Spirit — only show if pet has any via equipment
    // We render placeholder boxes that updatePetStatsDisplay fills in
    var lckStat = makeEl('div', {class:'battle-stat-mini', id:'lck-stat-'+pet.id});
    lckStat.setAttribute('data-tooltip', '🍀 LUCK\nIncreases critical hit chance in battle.\n(Base 5% + 0.5% per Luck point, max 25%)\n\nAlso improves rare item drop chances.\n\n💡 Increase by:\n• Equipping Luck gear\n• Certain boss drops');
    lckStat.style.cursor = 'help';
    lckStat.innerHTML = '<div style="font-size:0.7rem;color:var(--text-light);text-transform:uppercase;">LCK</div><div style="font-weight:bold;color:#f0a500;font-size:1.1rem;">0</div>';
    battleStats.appendChild(lckStat);

    var spiStat = makeEl('div', {class:'battle-stat-mini', id:'spi-stat-'+pet.id});
    spiStat.setAttribute('data-tooltip', '✨ SPIRIT\nReduces the chance of encountering spooky events.\n(Every 10 Spirit = -0.3% Piper encounter rate)\n\nAlso builds resistance to enemy debuffs and\nstatus effects in future updates.\n\n💡 Increase by:\n• Equipping Spirit gear\n• Certain boss drops');
    spiStat.style.cursor = 'help';
    spiStat.innerHTML = '<div style="font-size:0.7rem;color:var(--text-light);text-transform:uppercase;">SPI</div><div style="font-weight:bold;color:#c47fff;font-size:1.1rem;">0</div>';
    battleStats.appendChild(spiStat);

    body.appendChild(battleStats);
    
    // Update stats with equipment bonuses (async)
    updatePetStatsDisplay(pet.id, pet.base_attack || 5, pet.base_defense || 3, pet.base_speed || 4);
  }

  // Equipped Items Display
  var equipSection = makeEl('div', {class:'equipped-items-section'});
  equipSection.style.cssText = 'margin:10px 0;padding:10px;background:rgba(93,222,122,0.1);border:2px solid #5dde7a;border-radius:12px;';
  
  var equipTitle = makeEl('div', {style:'font-weight:bold;color:var(--purple);margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;'});
  equipTitle.innerHTML = '<span>⚔️ Equipment</span>';
  
  var manageBtn = makeEl('button', {class:'btn-sm', style:'font-size:0.7rem;padding:4px 8px;'});
  manageBtn.textContent = 'Manage';
  manageBtn.onclick = function() { showEquipmentModal(pet.id); };
  equipTitle.appendChild(manageBtn);
  
  equipSection.appendChild(equipTitle);
  
  // Show equipped weapon and armor (loaded async)
  var equipDisplay = makeEl('div', {id:'equip-display-'+pet.id, style:'font-size:0.85rem;color:var(--text);'});
  equipDisplay.innerHTML = '<div style="opacity:0.6;">Loading equipment...</div>';
  equipSection.appendChild(equipDisplay);
  
  body.appendChild(equipSection);
  
  // Load equipped items for this pet (async)
  loadEquippedItems(pet.id);

  // Warning if neglected
  if (pet.happiness <= 20 || pet.hunger <= 10) {
    body.appendChild(makeEl('div', {class:'sadness-warning'}, moodEmoji + ' Your pet needs attention!'));
  }

  // Stat bars
  var bars = makeEl('div', {class:'stat-bars'});
  bars.appendChild(makeStatRow('hunger', pet.id, pet.hunger, pet.max_hunger, hPct, 'Hunger'));
  bars.appendChild(makeStatRow('happiness', pet.id, pet.happiness, pet.max_happiness, hapPct, 'Happiness'));
  bars.appendChild(makeStatRow('energy', pet.id, pet.energy, pet.max_energy, ePct, 'Energy'));
  var xpRow = makeEl('div', {class:'xp-row'});
  xpRow.appendChild(makeEl('span', {class:'xp-label'}, 'XP'));
  var xpWrap = makeEl('div', {class:'xp-bar-wrap'});
  var xpFill = makeEl('div', {class:'xp-bar-fill', id:'xp-bar-'+pet.id});
  xpFill.style.width = xpPct+'%';
  xpWrap.appendChild(xpFill);
  xpRow.appendChild(xpWrap);
  xpRow.appendChild(makeEl('span', {class:'xp-value', id:'xp-val-'+pet.id}, pet.xp+'/'+xpNext));
  bars.appendChild(xpRow);
  body.appendChild(bars);

  // ── Mood & Wishes widget (loaded async after card renders) ──
  var moodMount = makeEl('div', { id: 'mood-widget-' + pet.id });
  moodMount.innerHTML = '<div style="height:4px"></div>'; // placeholder
  body.appendChild(moodMount);
  // Load asynchronously so it doesn't block card render
  personality_loadMood(pet.id).then(function() {
    personality_renderWidget(pet.id);
    // Also render quest widget and try to assign one if none active
    personality_renderQuestWidget(pet.id);
    assignQuestArc(pet.id).catch(function(){});
  }).catch(function(){});

  // Quest widget mount point (separate from mood widget)
  var questMount = makeEl('div', { id: 'quest-widget-' + pet.id });
  body.appendChild(questMount);
  var actions = makeEl('div', {class:'pet-actions'});
  actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin:10px 0;justify-content:center;';
  
  // Feed/Play buttons with event delegation
  var feedBtn = makeEl('button', {class:'btn-action btn-feed', id:'feed-'+pet.id}, 'Feed');
  feedBtn.setAttribute('data-pet-id', pet.id);
  feedBtn.style.cssText = 'flex:1;min-width:60px;padding:7px 10px;font-size:0.82rem;';

  // 🏠 Room button
  var roomBtn = makeEl('button', {class:'btn-action'});
  roomBtn.textContent = '🏠 Room';
  roomBtn.title = 'Decorate your pet\'s room!';
  roomBtn.style.cssText = 'min-width:72px;padding:8px 10px;font-size:0.88rem;background:linear-gradient(135deg,#5cb85c,#3a9a3a);color:white;border:none;border-radius:25px;cursor:pointer;font-weight:600;white-space:nowrap;text-align:center;';
  roomBtn.onclick = (function(id) { return function() { furniture_openRoom(id); }; })(pet.id);
  
  var playBtn = makeEl('button', {class:'btn-action btn-play', id:'play-'+pet.id}, pet.energy >= 10 ? 'Play' : 'Tired!');
  playBtn.setAttribute('data-pet-id', pet.id);
  playBtn.disabled = pet.energy < 10;
  playBtn.style.cssText = 'flex:1;min-width:60px;padding:7px 10px;font-size:0.82rem;';
  
  actions.appendChild(feedBtn); 
  actions.appendChild(playBtn);
  actions.appendChild(roomBtn);

  // 🏛️ Set Guild Pet button — only if player is in a guild and pet is level 5+
  if (guildState.myGuild && (pet.level||1) >= 5) {
    var isLiaison = (guildState.liaisonPetId === pet.id);
    var guildPetBtn = makeEl('button', { class: 'btn-action' });
    guildPetBtn.textContent = isLiaison ? '🏛️ Guild Pet ✓' : '🏛️ Set Guild Pet';
    guildPetBtn.title = 'Set this pet as your guild liaison';
    guildPetBtn.disabled = isLiaison;
    guildPetBtn.style.cssText = 'min-width:72px;padding:8px 10px;font-size:0.82rem;background:' + (isLiaison?'rgba(153,102,255,0.2)':'linear-gradient(135deg,#5b6abf,#764ba2)') + ';color:white;border:none;border-radius:25px;cursor:' + (isLiaison?'default':'pointer') + ';font-weight:600;white-space:nowrap;';
    guildPetBtn.onclick = (function(id) { return function() { setGuildLiaison(id); }; })(pet.id);
    actions.appendChild(guildPetBtn);
  }

  // Snapshot button — compact icon only
  var snapBtn = makeEl('button', {class:'btn-action btn-snapshot', id:'snap-'+pet.id});
  snapBtn.textContent = '📸';
  snapBtn.title = 'Take a Snapshot of this pet!';
  snapBtn.style.cssText = 'background:linear-gradient(135deg,#764ba2,#9966ff);color:white;border:none;border-radius:25px;padding:8px 10px;font-size:0.9rem;cursor:pointer;transition:transform 0.15s;flex:0 0 auto;white-space:nowrap;';
  snapBtn.onmouseover = function() { this.style.transform = 'scale(1.1)'; };
  snapBtn.onmouseout  = function() { this.style.transform = 'scale(1)'; };
  snapBtn.onclick = function() { screenshot_generate(pet.id); };
  actions.appendChild(snapBtn);
  var companionBtn = makeEl('button', {class: 'btn-companion'});
  companionBtn.textContent = '🐾 Set Companion';
  companionBtn.title = 'Set as your active companion';
  companionBtn.style.cssText = 'margin-top:6px;width:100%;padding:8px 10px;font-size:0.82rem;background:linear-gradient(135deg,#9966ff 0%,#ff66cc 100%);color:white;border:none;border-radius:12px;font-weight:600;cursor:pointer;transition:transform 0.2s;';
  companionBtn.onmouseover = function() { this.style.transform = 'scale(1.02)'; };
  companionBtn.onmouseout = function() { this.style.transform = 'scale(1)'; };
  companionBtn.onclick = function() {
    CompanionBuddy.setCompanion(pet.id);
  };
  actions.appendChild(companionBtn);

  // Variant selector button
  var variantBtn = makeEl('button', {class: 'btn-variant-selector', id: 'variant-btn-' + pet.id});
  var activeVariant = skinkey_getCurrentVariant(pet.id);
  var activeVariantData = activeVariant ? BASIC_VARIANTS[activeVariant] : null;
  variantBtn.textContent = activeVariantData ? (activeVariantData.icon + ' ' + activeVariantData.name) : '🎨 Variant';
  variantBtn.title = 'Manage variants for this pet';
  variantBtn.style.cssText = 'width:100%;padding:8px 10px;margin-top:4px;font-size:0.82rem;background:linear-gradient(135deg,#8b5cf6,#6366f1);color:white;border:none;border-radius:12px;font-weight:600;cursor:pointer;transition:all 0.2s;';
  variantBtn.onclick = function() { showPetVariantModal(pet.id, pet.nickname || pet.pet_type || 'Pet'); };
  actions.appendChild(variantBtn);
  
  body.appendChild(actions);

  body.appendChild(makeDropdown(pet.id));
  body.appendChild(makeEl('div', {class:'stat-flash', id:'flash-'+pet.id}));
  
  // Pet title selector dropdown
  var titleSelectorDiv = makeEl('div', {
    id: 'pet-title-selector-' + pet.id, 
    class: 'pet-title-selector-container'
  });
  titleSelectorDiv.innerHTML = renderPetTitleSelector(pet.id);
  body.appendChild(titleSelectorDiv);
  
  card.appendChild(body);
  
  // Apply variant CSS class to card if pet has variant
  if (pet.variant) {
    card.className += ' ' + getPetVariantClass(pet.variant);
  }
  
  return card;
}

function makeStatRow(stat, petId, val, max, pct, label) {
  var row = makeEl('div', {class:'stat-row'});
  row.appendChild(makeEl('span', {class:'stat-label'}, label));
  var wrap = makeEl('div', {class:'stat-bar-wrap'});
  var fill = makeEl('div', {class:'stat-bar-fill '+stat, id:stat+'-bar-'+petId});
  fill.style.width = pct+'%';
  wrap.appendChild(fill);
  row.appendChild(wrap);
  row.appendChild(makeEl('span', {class:'stat-value', id:stat+'-val-'+petId}, val+'/'+max));
  return row;
}

async function loadEquippedItems(petId) {
  // Wait a bit for the DOM to be ready
  setTimeout(async function() {
    var display = el('equip-display-' + petId);
    if (!display) return;
    
    try {
      // Get equipped items for THIS specific pet (not all pets)
      var equipRes = await supabaseClient
        .from('player_equipment')
        .select('equipment(*), equipped_slot')
        .eq('user_id', currentUser.id)
        .eq('pet_id', petId)
        .eq('is_equipped', true);
      
      if (equipRes.error) {
        display.innerHTML = '<div style="opacity:0.6;font-size:0.8rem;">Error loading equipment</div>';
        return;
      }
      
      if (!equipRes.data || equipRes.data.length === 0) {
        display.innerHTML = '<div style="opacity:0.6;font-size:0.8rem;">No equipment equipped</div>';
        return;
      }
      
      var weapon = equipRes.data.find(function(e) { return e.equipped_slot === 'weapon'; });
      var armor = equipRes.data.find(function(e) { return e.equipped_slot === 'armor'; });
      
      var html = '<div style="display:flex;gap:10px;flex-wrap:wrap;">';
      
      if (weapon && weapon.equipment) {
        var w = weapon.equipment;
        var bonuses = [];
        if (w.attack_bonus) bonuses.push('+' + w.attack_bonus + ' ATK');
        if (w.defense_bonus) bonuses.push('+' + w.defense_bonus + ' DEF');
        if (w.speed_bonus) bonuses.push('+' + w.speed_bonus + ' SPD');
        if (w.hp_bonus) bonuses.push('+' + w.hp_bonus + ' HP');
        if (w.luck_bonus) bonuses.push('+' + w.luck_bonus + ' LCK');
        if (w.spirit_bonus) bonuses.push('+' + w.spirit_bonus + ' SPI');
        
        html += '<div style="flex:1;min-width:120px;padding:6px;background:rgba(255,255,255,0.5);border-radius:8px;">';
        html += '<div style="font-weight:bold;color:#ff6b6b;">⚔️ ' + w.name + '</div>';
        html += '<div style="font-size:0.75rem;color:var(--text-light);">' + bonuses.join(', ') + '</div>';
        html += '</div>';
      } else {
        html += '<div style="flex:1;min-width:120px;padding:6px;background:rgba(255,255,255,0.3);border-radius:8px;opacity:0.6;">';
        html += '<div style="font-size:0.8rem;">⚔️ No weapon</div>';
        html += '</div>';
      }
      
      if (armor && armor.equipment) {
        var a = armor.equipment;
        var bonuses = [];
        if (a.attack_bonus) bonuses.push('+' + a.attack_bonus + ' ATK');
        if (a.defense_bonus) bonuses.push('+' + a.defense_bonus + ' DEF');
        if (a.speed_bonus) bonuses.push('+' + a.speed_bonus + ' SPD');
        if (a.hp_bonus) bonuses.push('+' + a.hp_bonus + ' HP');
        if (a.luck_bonus) bonuses.push('+' + a.luck_bonus + ' LCK');
        if (a.spirit_bonus) bonuses.push('+' + a.spirit_bonus + ' SPI');
        
        html += '<div style="flex:1;min-width:120px;padding:6px;background:rgba(255,255,255,0.5);border-radius:8px;">';
        html += '<div style="font-weight:bold;color:#5dde7a;">🛡️ ' + a.name + '</div>';
        html += '<div style="font-size:0.75rem;color:var(--text-light);">' + bonuses.join(', ') + '</div>';
        html += '</div>';
      } else {
        html += '<div style="flex:1;min-width:120px;padding:6px;background:rgba(255,255,255,0.3);border-radius:8px;opacity:0.6;">';
        html += '<div style="font-size:0.8rem;">🛡️ No armor</div>';
        html += '</div>';
      }
      
      html += '</div>';
      display.innerHTML = html;
    } catch (error) {
      console.error('Error in loadEquippedItems:', error);
      if (display) {
        display.innerHTML = '<div style="opacity:0.6;font-size:0.8rem;">Error loading equipment</div>';
      }
    }
  }, 100);
}

async function updatePetStatsDisplay(petId, baseAtk, baseDef, baseSpd) {
  // Fetch equipment for THIS specific pet and update stat display
  setTimeout(async function() {
    try {
      var equipRes = await supabaseClient
        .from('player_equipment')
        .select('equipment(*)')
        .eq('user_id', currentUser.id)
        .eq('pet_id', petId)
        .eq('is_equipped', true);
      
      if (equipRes.error || !equipRes.data) return;
      
      var totalAtk = baseAtk;
      var totalDef = baseDef;
      var totalSpd = baseSpd;
      var totalLck = 0;
      var totalSpi = 0;
      
      equipRes.data.forEach(function(item) {
        var equip = item.equipment;
        totalAtk += equip.attack_bonus  || 0;
        totalDef += equip.defense_bonus || 0;
        totalSpd += equip.speed_bonus   || 0;
        totalLck += equip.luck_bonus    || 0;
        totalSpi += equip.spirit_bonus  || 0;
      });
      
      // Update the display
      var atkEl = el('atk-stat-' + petId);
      var defEl = el('def-stat-' + petId);
      var spdEl = el('spd-stat-' + petId);
      var lckEl = el('lck-stat-' + petId);
      var spiEl = el('spi-stat-' + petId);
      
      if (atkEl) {
        var atkBonus = totalAtk - baseAtk;
        atkEl.innerHTML = '<div style="font-size:0.7rem;color:var(--text-light);text-transform:uppercase;">ATK</div>' +
          '<div style="font-weight:bold;color:var(--purple);font-size:1.1rem;">' + totalAtk + 
          (atkBonus > 0 ? ' <span style="color:#5dde7a;font-size:0.8rem;">(+' + atkBonus + ')</span>' : '') + '</div>';
      }
      
      if (defEl) {
        var defBonus = totalDef - baseDef;
        defEl.innerHTML = '<div style="font-size:0.7rem;color:var(--text-light);text-transform:uppercase;">DEF</div>' +
          '<div style="font-weight:bold;color:var(--purple);font-size:1.1rem;">' + totalDef + 
          (defBonus > 0 ? ' <span style="color:#5dde7a;font-size:0.8rem;">(+' + defBonus + ')</span>' : '') + '</div>';
      }
      
      if (spdEl) {
        var spdBonus = totalSpd - baseSpd;
        spdEl.innerHTML = '<div style="font-size:0.7rem;color:var(--text-light);text-transform:uppercase;">SPD</div>' +
          '<div style="font-weight:bold;color:var(--purple);font-size:1.1rem;">' + totalSpd + 
          (spdBonus > 0 ? ' <span style="color:#5dde7a;font-size:0.8rem;">(+' + spdBonus + ')</span>' : '') + '</div>';
      }

      if (lckEl) {
        lckEl.innerHTML = '<div style="font-size:0.7rem;color:var(--text-light);text-transform:uppercase;">LCK</div>' +
          '<div style="font-weight:bold;color:#f0a500;font-size:1.1rem;">' + totalLck +
          (totalLck > 0 ? ' <span style="color:#5dde7a;font-size:0.8rem;">(+' + totalLck + ')</span>' : '') + '</div>';
      }

      if (spiEl) {
        spiEl.innerHTML = '<div style="font-size:0.7rem;color:var(--text-light);text-transform:uppercase;">SPI</div>' +
          '<div style="font-weight:bold;color:#c47fff;font-size:1.1rem;">' + totalSpi +
          (totalSpi > 0 ? ' <span style="color:#5dde7a;font-size:0.8rem;">(+' + totalSpi + ')</span>' : '') + '</div>';
      }
    } catch (error) {
      console.error('Error updating pet stats display:', error);
    }
  }, 100);
}

// ══════════════════════════════════════════════════════════════════════════
// PET STAT DECAY & REGENERATION SYSTEM
// ══════════════════════════════════════════════════════════════════════════

function calculateEnergyRegen(currentEnergy, maxEnergy, lastPlayedTimestamp) {
  if (!lastPlayedTimestamp) return currentEnergy;
  
  var now = new Date();
  var lastPlayed = new Date(lastPlayedTimestamp);
  var hoursPassed = (now - lastPlayed) / (1000 * 60 * 60);
  
  // Regenerate 5% per hour (base rate)
  var regenRate = 5; // 5% per hour
  
  // Apply event bonus if active
  var eventMultiplier = worldEvents.getActiveBonus('energyRegen');
  var weatherMultiplier = (typeof weatherSystem !== 'undefined') ? weatherSystem.getWeatherBonus('energyRegen') : 1.0;
  eventMultiplier = eventMultiplier * weatherMultiplier;
  regenRate = regenRate * eventMultiplier;
  
  var regenAmount = Math.floor((maxEnergy * (regenRate / 100)) * hoursPassed);
  
  var newEnergy = Math.min(currentEnergy + regenAmount, maxEnergy);
  return newEnergy;
}

function calculateHPRegen(currentHP, maxHP, lastBattleTimestamp) {
  if (!lastBattleTimestamp) return currentHP;
  
  var now = new Date();
  var lastBattle = new Date(lastBattleTimestamp);
  var hoursPassed = (now - lastBattle) / (1000 * 60 * 60);
  
  // Regenerate 3 HP per hour while resting
  var regenRate = 3; // HP per hour
  var regenAmount = Math.floor(regenRate * hoursPassed);
  
  var newHP = Math.min(currentHP + regenAmount, maxHP);
  return newHP;
}

function calculateHungerDecay(currentHunger, lastFedTimestamp) {
  if (!lastFedTimestamp) return currentHunger;
  
  var now = new Date();
  var lastFed = new Date(lastFedTimestamp);
  var hoursPassed = (now - lastFed) / (1000 * 60 * 60);
  
  // Hunger decreases 2.5 points per hour (60 points per day)
  var decayRate = 2.5; // points per hour
  var decayAmount = Math.floor(decayRate * hoursPassed);
  
  var newHunger = Math.max(currentHunger - decayAmount, 0);
  return newHunger;
}

function calculateHappinessDecay(currentHappiness, lastFedTimestamp, lastPlayedTimestamp) {
  if (!lastFedTimestamp && !lastPlayedTimestamp) return currentHappiness;
  
  var now = new Date();
  
  // Use the most recent interaction timestamp
  var lastInteraction = lastFedTimestamp;
  if (lastPlayedTimestamp) {
    var fedTime = new Date(lastFedTimestamp || 0);
    var playedTime = new Date(lastPlayedTimestamp);
    lastInteraction = playedTime > fedTime ? lastPlayedTimestamp : lastFedTimestamp;
  }
  
  var lastTime = new Date(lastInteraction);
  var hoursPassed = (now - lastTime) / (1000 * 60 * 60);
  
  // Happiness decreases 2 points per hour (48 points per day)
  var decayRate = 2; // points per hour
  var decayAmount = Math.floor(decayRate * hoursPassed);
  
  var newHappiness = Math.max(currentHappiness - decayAmount, 0);
  return newHappiness;
}

// ══════════════════════════════════════════════════════════════════════════
// PET PERSONALITY MOOD MESSAGES
// Each member has messages for 5 states: thriving, happy, meh, sad, neglected
// Plus a special "missed you" message for 24h+ absence
// ══════════════════════════════════════════════════════════════════════════

var PET_PERSONALITIES = {
  'Ember': {
    thriving: [
      "Running at full power. You know how it is. 🔥",
      "Honestly? Never better. Don't tell anyone, it ruins my reputation.",
      "Fed, rested, happy. Fire is fully charged. Let's go.",
      "This is the grind. I love the grind. 🔥",
    ],
    happy: [
      "Doing pretty good. Could be spicier but I'll manage.",
      "Feeling solid. Maybe we go fight something?",
      "Good energy today. Been thinking about Abiotic Factor...",
      "Yeah, this is nice. Thanks for checking in. 🧡",
    ],
    meh: [
      "I've been better. I've also been worse. This is fine.",
      "Could use a snack tbh. The spicy kind.",
      "Just vibing. Kind of. Not really.",
      "Eleven years of this and I still get hungry. Annoying.",
    ],
    sad: [
      "Hey. Hey. I need food. This is not a drill.",
      "Running low over here. Not great, not great at all.",
      "I'm tired and hungry and I need you to fix that. Please.",
      "This is the bad grind. I don't love the bad grind. 😢",
    ],
    neglected: [
      "...I know you've been busy. I know. But also. FOOD.",
      "Hello? It's me. Your pet. Remember? Fire? Protogen? Hungry?",
      "I've started talking to myself. It's fine. Everything is fine. 🔥",
      "I didn't survive 11 years on Twitch to be forgotten by MY OWN OWNER.",
    ],
    missed_you: "Ember perks up! You were gone for a while... she pretends not to care. She cares a little. 🧡",
  },

  'Pyxie': {
    thriving: [
      "I had a plan and it worked. The plan was: eat, be happy, nap. ✨",
      "Peak condition. Do not disturb. Thriving. Napping. Both simultaneously.",
      "Mama's Sleeping Angels could NEVER. (I am winning at life right now)",
      "Everything is perfect. Spooky and Momo would be proud. ✨",
    ],
    happy: [
      "Pretty good! I have a plan for later. It involves a nap.",
      "Happy chaos, controlled chaos. Perfectly balanced.",
      "Feeling good in a chaotic sort of way. Very on brand.",
      "Could be weirder. Has been weirder. This is nice. 💜",
    ],
    meh: [
      "Existing. Successfully. Mostly.",
      "I had a plan but it got derailed. New plan: sit here.",
      "Somewhere between fine and a little bit feral. Normal.",
      "The fog is calling but I have snacks. Dilemma.",
    ],
    sad: [
      "The plan has failed. All plans have failed. Need food.",
      "Current status: chaotic, but in the bad way.",
      "Pizza the dog would not allow this. I am speaking up for Pizza.",
      "A little sad. A lot hungry. Please help. 💜",
    ],
    neglected: [
      "I have been forgotten. I am becoming one with the void. Voluntarily.",
      "Spooky and Momo get fed every day. Just saying. Just saying.",
      "The chaos has consumed me. This is your fault. Come back.",
      "...I started a new plan. The plan is 'survive without you.' It's not going well.",
    ],
    missed_you: "Pyxie looks up from an elaborate scheme and pretends they weren't worried. They were a little worried. ✨",
  },

  'Aria': {
    thriving: [
      "I am thriving. The bones are plentiful. Life is good. 🦋",
      "Humans are so silly but you're doing wonderfully. So am I.",
      "Shiny things! Good food! Bones everywhere! What a day!",
      "Feeling very powerful today. In a gentle, moth-adjacent way. 🌸",
    ],
    happy: [
      "Today is a good day for collecting things. I feel it.",
      "Happy and well-fed. The bones can wait. Mostly.",
      "Something is very pretty today and I want to look at it. 🦋",
      "Content. Warm. Slightly distracted by something shiny.",
    ],
    meh: [
      "Humans are strange and I am a little hungry. Curious combination.",
      "Doing okay! The cheesecake situation could be better.",
      "I'm fine. I'm always fine. The Crane Wives are playing in my head.",
      "Could use a little something. Bones or food, either works.",
    ],
    sad: [
      "Oh. Oh no. I am sad AND hungry. This is suboptimal.",
      "The fae do not suffer like this. And yet. Here I am.",
      "I would like some blackberries please. And maybe a bone. Just a small one.",
      "Not thriving right now. Please come say hello. 💀",
    ],
    neglected: [
      "I have been very patient. The fae are KNOWN for patience. It is running out.",
      "You can keep your bones for now. But you owe me so much food.",
      "Humans are so strange and silly and I miss you. Please come back. 🦋",
      "I started writing a story about being forgotten. It's quite good actually. Very sad.",
    ],
    missed_you: "Aria glances up from her bone collection, then looks away quickly. 'I wasn't waiting,' she says softly. She was waiting. 🦋",
  },

  'Kleat': {
    thriving: [
      "Yip yap! All systems go! Portal efficiency: maximum! ✨",
      "Fed, happy, and I found a new world today. INCREDIBLE world. 10/10.",
      "Grand mage status: fully operational. The void says hi.",
      "Everything is perfect and I opened three portals just for fun! 🌀",
    ],
    happy: [
      "Pretty good! The portal situation is very manageable right now.",
      "Yip! Good vibes, good magic, good food. The pom life.",
      "Happy and studying some galaxy magic. Don't mind me. ✨",
      "Feeling adventurous. In a good way. Probably won't get lost.",
    ],
    meh: [
      "I'm fine but the void seems quieter than usual. Suspicious.",
      "Okay I guess. Would be better with more snacks and/or portals.",
      "Yap. That's it. Just yap. Energy is low.",
      "Studying. Being a gremlin. Could be fed more often just saying.",
    ],
    sad: [
      "Kleat is not yipping. This is how you know something is wrong.",
      "The portal to the snack dimension is closed. This is a crisis.",
      "Unhappy pom noises. Feed me and I'll open you a portal. Deal.",
      "Low energy. Even for a grand mage this is concerning. 💜",
    ],
    neglected: [
      "I OPENED A PORTAL AND YOU WEREN'T EVEN HERE TO SEE IT.",
      "Fine. I'll just go adventure alone. Through the void. By myself. This is fine.",
      "The void is kind of lonely actually. Come back please. Yip.",
      "No yaps. No yips. Just... quiet. You should fix that. 🌀",
    ],
    missed_you: "Kleat zooms in from somewhere that is definitely another dimension. 'I WASN'T LOST. I was adventuring.' ✨",
  },

  'Blushimia': {
    thriving: [
      "WHAT THE GLOB I AM SO HAPPY RIGHT NOW!!! 👑",
      "Best day EVER. Escaped a video game AND got fed. Living the dream.",
      "I am THRIVING and ALIVE and this is the GREATEST!!!",
      "Full happiness! Full tummy! Wagging at maximum velocity! 🐾",
    ],
    happy: [
      "What the glob, today is pretty good!!",
      "Happy puppy princess reporting in! All good here! 🐾",
      "Feeling great! What should we do?? I have ideas. So many ideas.",
      "Good! Really good! Have you played Tomodachi Life? I'm thinking about it.",
    ],
    meh: [
      "What the... glob? I think I need a snack.",
      "Okay but could be better. Could be SO MUCH BETTER.",
      "Princess energy is a little low today. Feed me and it comes back. 👑",
      "Hmm. Hmmmm. Something is missing. Oh. It's food.",
    ],
    sad: [
      "what the glob :(((( i am SAD and HUNGRY",
      "This isn't what escaping a video game was supposed to be like!!",
      "Princess status: depleted. Please help immediately. 🐾",
      "I escaped my game for THIS?? (please feed me i love you)",
    ],
    neglected: [
      "HELLO?? I AM RIGHT HERE?? WHAT THE GLOB????",
      "I gained sentience and escaped a video game to be FORGOTTEN??",
      "The tail has stopped wagging. You did this. Come back. 👑",
      "what the glob what the glob what the glob please come back please",
    ],
    missed_you: "Blushimia's tail wags so hard she nearly falls over. 'YOU'RE BACK!! WHAT THE GLOB!! HI!!' 🐾",
  },

  'Steve': {
    thriving: [
      "Cluck. I am thriving. Do not question the cluck. 🐔",
      "Fed. Happy. Still a menace. Everything is as it should be.",
      "As chill as a fire in hell, and currently: extremely chill.",
      "Bawk. Cockadoodledoo. That means I'm doing great. Trust.",
    ],
    happy: [
      "Pretty good. Considering. You know. Everything.",
      "Cluck bawk. Happy noises. The menace is content. 🐄",
      "Good day. Found some bread. Caused some problems. Classic.",
      "Doing well. Your cozy little horror is cozy today.",
    ],
    meh: [
      "Cluck. Could be worse. Has been worse. Is fine.",
      "The chaos is... manageable right now. Suspicious.",
      "Neutral menace energy. Feed me and I'll escalate appropriately.",
      "Existing. Causing minor problems. Living the dream I guess.",
    ],
    sad: [
      "Bawk. Sad bawk. Please note the difference. It's important.",
      "Not great. The chill is a fire in hell and the hell is empty.",
      "I need bread. I need it now. Do not make me ask twice. 🐔",
      "Your cozy little horror is not feeling very cozy right now.",
    ],
    neglected: [
      "I have been a menace to myself out of pure boredom. This is your fault.",
      "CLUCK. BAWK. BUCK. The good words. You know what they mean.",
      "I started streaming for fun back in 2016 and I refuse to starve in 2026.",
      "Fine. I'll just be unhinged alone. I'm good at it. But come back. 🐄",
    ],
    missed_you: "Steve eyes you with deep suspicion, then headbutts you anyway. That's cowbee love. Don't question it. 🐔",
  },

  'Gnarly': {
    thriving: [
      "HIGH SCORE. Life score. Both are maxed right now. 🎮",
      "Fed, happy, and I just beat my personal best at three different games.",
      "Radical. Absolutely radical. This is the good stuff.",
      "Full stats, full tummy, full arcade energy. Let's GO. 🕹️",
    ],
    happy: [
      "Pretty sick actually! Prize counter is ready to go.",
      "Good vibes at the PaleoPlex today. Come hang out sometime.",
      "Feeling radical! The Furbies are watching and they approve.",
      "Happy and ready to absolutely dominate something. 🎮",
    ],
    meh: [
      "Could be more radical. The nachos situation needs addressing.",
      "Medium energy. The arcade awaits but I need fuel first.",
      "Furbies are giving me a look. I think they're judging my stats.",
      "Eh. Not my best run. Feed me, let's try again. 🕹️",
    ],
    sad: [
      "Low score. Real low. This is NOT the high score life.",
      "Even the Furbies look concerned. That's how you know it's bad.",
      "Need nachos. Need energy. Need to be fed. In that order.",
      "The PaleoPlex doesn't run on empty. Neither do I. 😢",
    ],
    neglected: [
      "I have NEVER gotten a game over in my LIFE and this is what it feels like.",
      "The Furbies are handling this better than I am. That's humbling.",
      "INSERT COIN. INSERT COIN. That's you. You're the coin. Please.",
      "Neopets The Darkest Faerie taught me resilience. It didn't prepare me for THIS. 🎮",
    ],
    missed_you: "Gnarly spins around from the arcade cabinet. 'PLAYER TWO HAS ENTERED THE GAME.' Let's go. 🕹️",
  },

  'Jess': {
    thriving: [
      "Thriving! The potions are working and the fossils are beautiful today. 🦕",
      "Full energy, full tummy, and I found a really nice bone. Good day.",
      "This fossil is 65 million years cuter than you. But you're doing great too.",
      "Happy and warm and maybe a little adventurous today. 🌿",
    ],
    happy: [
      "Doing well! The potion came out right on the first try today.",
      "Good! Quiet and good. Found some interesting things in the dirt.",
      "Content. Whimsical. Slightly covered in fossil dust. 🦕",
      "Happy! It's a good day for small adventures.",
    ],
    meh: [
      "Okay. The potion needs one more ingredient and I can't find it.",
      "Existing quietly. Could use a snack and maybe a hug.",
      "A little low today. Nothing a mango delight wouldn't fix.",
      "The adventure is paused. Fuel required. 🌿",
    ],
    sad: [
      "Sad and hungry and the potion definitely didn't work that time.",
      "65 million years of dinosaur history and none of them thought to leave snacks.",
      "I need something sweet please. And some company. 🦕",
      "Quiet critter is being very quiet right now. In the sad way.",
    ],
    neglected: [
      "I've been very patient. Parasaurs are known for patience. But still.",
      "The fossils are keeping me company. They're good listeners. Unlike some people.",
      "I started a new potion. It's called 'please remember I exist.' It's almost done.",
      "Small adventures are less fun alone. Just so you know. 🌿",
    ],
    missed_you: "Jess looks up from her fossil collection and gives you a shy little wave. 'Oh! You're back. I made a potion for you.' 🦕",
  }
};

// Returns a personality-driven mood message for the pet card
// Falls back to generic if pet type not found
function getPetPersonalityMessage(petType, hunger, energy, happiness, maxHunger, maxEnergy, maxHappiness, lastFed, lastPlayed) {
  var p = PET_PERSONALITIES[petType];
  if (!p) return null;

  // Check for neglect (24h+ since last interaction)
  var lastActivity = null;
  if (lastFed && lastPlayed) {
    lastActivity = new Date(lastFed) > new Date(lastPlayed) ? new Date(lastFed) : new Date(lastPlayed);
  } else if (lastFed) { lastActivity = new Date(lastFed); }
  else if (lastPlayed) { lastActivity = new Date(lastPlayed); }

  if (lastActivity) {
    var hoursAgo = (Date.now() - lastActivity) / 3600000;
    if (hoursAgo >= 24) {
      var msgs = p.neglected;
      return msgs[Math.floor(Date.now() / 3600000) % msgs.length]; // rotates hourly
    }
  }

  // Determine mood bucket
  var hungerPct    = maxHunger    > 0 ? hunger    / maxHunger    : 1;
  var energyPct    = maxEnergy    > 0 ? energy    / maxEnergy    : 1;
  var happinessPct = maxHappiness > 0 ? happiness / maxHappiness : 1;
  var overall = (hungerPct + energyPct + happinessPct) / 3;

  var pool;
  if (overall >= 0.85)      pool = p.thriving;
  else if (overall >= 0.65) pool = p.happy;
  else if (overall >= 0.40) pool = p.meh;
  else if (overall >= 0.20) pool = p.sad;
  else                      pool = p.neglected;

  // Rotate through messages based on hour of day so it changes but doesn't flicker
  return pool[Math.floor(Date.now() / 3600000) % pool.length];
}


// Piper equipment flavor text — lore delivery via item descriptions
function getPiperFlavorText(item) {
  if (!item || !item.name) return null;
  var name = item.name.toLowerCase();
  if (name.indexOf('piper') === -1) return null;

  var lore = {
    "piper's pipe":    "She played this every evening at server reset. No one knows what the song was. No one has heard it since.",
    "piper's pipe+1":  "The same pipe, but the sound has changed somehow. No one played it. It changed on its own.",
    "piper's pipe+2":  "It plays by itself sometimes. Very quietly. Only when no one is watching.",
    "piper's bells":   "Found near the last known location of Session 7 participants. No signs of struggle.",
    "piper's bells+1": "The bells still ring occasionally. There is no wind in the data layer.",
    "piper's bells+2": "Whoever holds these says they can sometimes hear the others. The ones from before.",
  };
  return lore[name] || "This belonged to the previous guide. She is no longer available.";
}

function getPetMood(hunger, energy, happiness, maxHunger, maxEnergy, maxHappiness) {
  // Calculate percentages
  var hungerPercent = (hunger / maxHunger) * 100;
  var energyPercent = (energy / maxEnergy) * 100;
  var happinessPercent = (happiness / maxHappiness) * 100;
  
  // Average overall wellness
  var overall = (hungerPercent + energyPercent + happinessPercent) / 3;
  
  if (overall >= 90) return { mood: 'Ecstatic', emoji: '😍', color: '#5dde7a' };
  if (overall >= 75) return { mood: 'Happy', emoji: '😊', color: '#8de6a1' };
  if (overall >= 60) return { mood: 'Content', emoji: '🙂', color: '#ffdd00' };
  if (overall >= 40) return { mood: 'Okay', emoji: '😐', color: '#ff9f43' };
  if (overall >= 25) return { mood: 'Unhappy', emoji: '😟', color: '#ff9933' };
  if (overall >= 10) return { mood: 'Sad', emoji: '😢', color: '#ff6b6b' };
  return { mood: 'Miserable', emoji: '😭', color: '#ff3838' };
}

// ══════════════════════════════════════════════════════════════════════════
// PET ACTIONS (Feed, Play)
// ══════════════════════════════════════════════════════════════════════════

function calculateLevelUp(newXp, currentLevel, currentMaxHunger, currentMaxEnergy, currentMaxHappiness, currentHP, currentAtk, currentDef, currentSpd) {
  var xpNeeded = currentLevel * GAME_CONSTANTS.XP_PER_LEVEL;
  
  if (newXp >= xpNeeded) {
    // Level up! Calculate stat increases
    var statIncreases = {
      hp: 6, // Always get +6 HP minimum (doubled from +3 for longer battles)
      atk: 0,
      def: 0,
      spd: 0
    };
    
    // Pick ONE random stat to increase by +1 (guaranteed)
    var stats = ['atk', 'def', 'spd'];
    var primaryStat = stats[Math.floor(Math.random() * stats.length)];
    statIncreases[primaryStat] = 1;
    
    // 40% chance for a second +1 to a DIFFERENT stat
    if (Math.random() < 0.4) {
      var remainingStats = stats.filter(function(s) { return s !== primaryStat; });
      var secondaryStat = remainingStats[Math.floor(Math.random() * remainingStats.length)];
      statIncreases[secondaryStat] = 1;
    }
    
    return {
      xp: newXp - xpNeeded, // Carry over excess XP
      level: currentLevel + 1,
      maxHunger: currentMaxHunger + 5,
      maxEnergy: currentMaxEnergy + 5,
      maxHappiness: currentMaxHappiness + 5,
      // Combat stat increases
      base_hp: currentHP + statIncreases.hp,
      base_attack: currentAtk + statIncreases.atk,
      base_defense: currentDef + statIncreases.def,
      base_speed: currentSpd + statIncreases.spd,
      statIncreases: statIncreases, // Return what increased for display
      leveled: true
    };
  } else {
    // No level up
    return {
      xp: newXp,
      level: currentLevel,
      maxHunger: currentMaxHunger,
      maxEnergy: currentMaxEnergy,
      maxHappiness: currentMaxHappiness,
      leveled: false
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TREASURE HUNTING — Expedition System
// ═══════════════════════════════════════════════════════════════════════════

var EXPEDITION_ZONES = [
  {
    key:'outskirts', label:'Outskirts', emoji:'🏘️', duration:30,
    minPP:15, maxPP:35, energyCost:15, xpReward:25, minLevel:1,
    desc:'Quick scout of the nearby fields. Safe for any pet.',
    itemChance:0.30, equipChance:0.02, injuryChance:0.05, moodChance:0.05,
    rarity:'common',
    itemPool:[{id:'basic_food',name:'Basic Food',icon:'🍞',type:'food'}],
    events:[
      { weight:60, outcome:'pp',    text:'{pet} had a productive scout and returned with supplies.' },
      { weight:20, outcome:'item',  text:'{pet} found something useful tucked behind a fence post.' },
      { weight:10, outcome:'mood',  text:'{pet} came back a little grumpy. Something spooked them.' },
      { weight:8,  outcome:'bonus', text:'{pet} found a shortcut! Returned early with a little extra.' },
      { weight:2,  outcome:'lore',  text:'{pet} found some old scratches on a wall. Probably nothing.' }
    ]
  },
  {
    key:'forest', label:'Forest Glade', emoji:'🌳', duration:45,
    minPP:30, maxPP:65, energyCost:25, xpReward:50, minLevel:5,
    desc:'Wander through the shady forest. Recommended level 5+.',
    itemChance:0.40, equipChance:0.05, injuryChance:0.10, moodChance:0.08,
    rarity:'uncommon',
    itemPool:[{id:'treat',name:'Treat',icon:'🍪',type:'treat'},{id:'basic_food',name:'Basic Food',icon:'🍞',type:'food'}],
    events:[
      { weight:50, outcome:'pp',    text:'{pet} explored the forest trails and found some treasures.' },
      { weight:20, outcome:'item',  text:'{pet} dug up something buried near an old tree root.' },
      { weight:15, outcome:'mood',  text:'{pet} ran into another creature and came back shaken.' },
      { weight:10, outcome:'injury',text:'{pet} tripped on some roots. A little banged up.' },
      { weight:4,  outcome:'bonus', text:'{pet} followed a strange light and found something remarkable.' },
      { weight:1,  outcome:'lore',  text:'{pet} kept staring at one particular tree on the way back. You are not sure why.' }
    ]
  },
  {
    key:'deepwoods', label:'Deep Woods', emoji:'🌲', duration:60,
    minPP:55, maxPP:110, energyCost:40, xpReward:100, minLevel:10,
    desc:'Brave the dangerous deep woods. Recommended level 10+.',
    itemChance:0.50, equipChance:0.12, injuryChance:0.18, moodChance:0.12,
    rarity:'rare',
    itemPool:[{id:'squeaky_toy',name:'Squeaky Toy',icon:'🧸',type:'toy'},{id:'rope_toy',name:'Rope Toy',icon:'🪢',type:'toy'}],
    events:[
      { weight:40, outcome:'pp',    text:'{pet} ventured deep and returned with valuable finds.' },
      { weight:20, outcome:'item',  text:'{pet} discovered an abandoned camp with supplies left behind.' },
      { weight:18, outcome:'injury',text:'{pet} encountered something aggressive. They won, but took a hit.' },
      { weight:12, outcome:'mood',  text:'{pet} came back quieter than usual. Something unsettled them.' },
      { weight:8,  outcome:'bonus', text:'{pet} found a hidden clearing with remarkable loot.' },
      { weight:2,  outcome:'lore',  text:'{pet} was gone longer than expected. They won't show you what they found.' }
    ]
  },
  {
    key:'ruins', label:'Ancient Ruins', emoji:'🏛️', duration:90,
    minPP:80, maxPP:160, energyCost:60, xpReward:200, minLevel:15,
    desc:'Explore the mysterious old ruins. Recommended level 15+.',
    itemChance:0.60, equipChance:0.20, injuryChance:0.22, moodChance:0.15,
    rarity:'epic',
    itemPool:[{id:'squeaky_toy',name:'Squeaky Toy',icon:'🧸',type:'toy'}],
    events:[
      { weight:35, outcome:'pp',    text:'{pet} excavated the ruins and returned with artifacts.' },
      { weight:22, outcome:'equip', text:'{pet} found something remarkable — old but sturdy.' },
      { weight:18, outcome:'injury',text:'{pet} triggered a trap. They made it out, but just barely.' },
      { weight:15, outcome:'mood',  text:'{pet} saw something in the ruins. They won't talk about it.' },
      { weight:8,  outcome:'bonus', text:'{pet} found a sealed chamber. Whatever was inside is yours now.' },
      { weight:2,  outcome:'lore',  text:'{pet} came back with a piece of paper covered in writing. The handwriting looks recent.' }
    ]
  }
];

// Pace modes — affect duration and risk
var EXPEDITION_PACES = {
  careful: { label:'🐢 Careful', durationMult:1.4, ppMult:0.85, negMult:0.5,  posMult:0.9,  desc:'Slower but much safer. Negative events halved.' },
  normal:  { label:'⚖️ Normal',  durationMult:1.0, ppMult:1.0,  negMult:1.0,  posMult:1.0,  desc:'Balanced risk and reward.' },
  rushed:  { label:'💨 Rushed',  durationMult:0.7, ppMult:1.15, negMult:1.8,  posMult:1.1,  desc:'Faster but riskier. Negative events nearly doubled.' }
};

var _expeditionPace = 'normal'; // current pace selection

var expeditionState = {
  active: null,      // current active expedition row from DB
  timer:  null       // setInterval id for countdown
};

// Called when minigames tab loads
async function expedition_init() {
  var area = document.getElementById('expedition-area');
  if (!area) return;
  if (!currentUser) { area.innerHTML = '<p style="color:var(--text-light);text-align:center;">Log in to go exploring!</p>'; return; }

  area.innerHTML = '<div class="spinner"></div>';

  // Check for active or unclaimed expedition
  var { data: active } = await supabaseClient
    .from('expeditions')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('claimed', false)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()
    .catch(function() { return { data: null }; });

  expeditionState.active = active || null;

  if (active && !active.completed && new Date(active.ends_at) > new Date()) {
    expedition_renderCountdown(active);
  } else if (active && (!active.completed || new Date(active.ends_at) <= new Date())) {
    // Mark complete if time is up
    if (!active.completed) {
      await supabaseClient.from('expeditions').update({ completed: true }).eq('id', active.id);
      active.completed = true;
    }
    expedition_renderClaim(active);
  } else {
    expedition_renderSelector();
  }
}

// ── Odds calculator ──────────────────────────────────────────────────────────
function expedition_calcOdds(zone, pet, pace) {
  if (!zone || !pet) return null;
  var p = EXPEDITION_PACES[pace] || EXPEDITION_PACES.normal;
  var petLevel  = pet.level || 1;
  var petAtk    = pet.base_attack  || pet.attack  || pet.atk || 5;
  var petDef    = pet.base_defense || pet.defense || pet.def || 3;
  var petSpd    = pet.base_speed   || pet.speed   || pet.spd || 3;
  var petSpirit = pet.spirit || 0;

  // Level scaling — underleveled pets take more risk
  var levelPenalty = Math.max(0, (zone.minLevel - petLevel) * 0.04);

  // Gear bonuses — DEF reduces injury, ATK reduces mood debuff, SPD cuts time
  var defBonus     = Math.min(0.15, petDef * 0.01);
  var atkBonus     = Math.min(0.10, petAtk * 0.008);
  var spdBonus     = Math.min(0.15, petSpd * 0.01);
  var spiritBonus  = Math.min(0.12, petSpirit * 0.02);

  var injuryChance = Math.max(0, Math.min(0.95,
    (zone.injuryChance + levelPenalty - defBonus - spiritBonus * 0.5) * p.negMult));
  var moodChance   = Math.max(0, Math.min(0.95,
    (zone.moodChance + levelPenalty - atkBonus - spiritBonus * 0.5) * p.negMult));
  var itemChance   = Math.min(0.95, zone.itemChance * p.posMult);
  var equipChance  = Math.min(0.50, zone.equipChance * p.posMult);
  var bonusChance  = 0.05 * p.posMult;

  var minPP = Math.round(zone.minPP * p.ppMult);
  var maxPP = Math.round(zone.maxPP * p.ppMult);
  var duration = Math.round(zone.duration * p.durationMult * (1 - spdBonus));

  return {
    minPP, maxPP, duration, itemChance, equipChance,
    injuryChance, moodChance, bonusChance,
    levelOk: petLevel >= zone.minLevel,
    levelPenalty: Math.round(levelPenalty * 100)
  };
}

function expedition_oddsHTML(odds, zone) {
  if (!odds) return '';
  var pct = function(n) { return Math.round(n * 100) + '%'; };
  var col = function(n, good) {
    var v = n * 100;
    if (good) return v >= 50 ? '#5dde7a' : v >= 25 ? '#ffd700' : '#aaa';
    return v >= 20 ? '#ff6b6b' : v >= 10 ? '#ffd700' : '#5dde7a';
  };
  var rows = [
    { icon:'💰', label:'PP Reward',      val: odds.minPP + ' – ' + odds.maxPP + ' PP', color:'var(--purple)' },
    { icon:'🎁', label:'Find an item',   val: pct(odds.itemChance),   color: col(odds.itemChance, true) },
    { icon:'⚔️',  label:'Find equipment', val: pct(odds.equipChance),  color: col(odds.equipChance, true) },
    { icon:'✨', label:'Bonus event',    val: pct(odds.bonusChance),   color: col(odds.bonusChance, true) },
    { icon:'🩹', label:'Pet injury',     val: pct(odds.injuryChance),  color: col(odds.injuryChance, false) },
    { icon:'😢', label:'Mood debuff',    val: pct(odds.moodChance),    color: col(odds.moodChance, false) },
  ];
  var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:0.75rem;">';
  rows.forEach(function(r) {
    html += '<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(153,102,255,0.07);">' +
      '<span style="color:var(--text-light);">' + r.icon + ' ' + r.label + '</span>' +
      '<span style="font-weight:700;color:' + r.color + ';">' + r.val + '</span>' +
    '</div>';
  });
  html += '</div>';
  if (!odds.levelOk) {
    html += '<div style="margin-top:6px;font-size:0.72rem;background:rgba(255,100,50,0.1);border-radius:6px;padding:4px 8px;color:#ff6b6b;">⚠️ Pet is underleveled for this zone (+' + odds.levelPenalty + '% risk penalty)</div>';
  }
  return html;
}

// ── Pet + Zone selector UI ──
function expedition_renderSelector() {
  var area = document.getElementById('expedition-area');
  if (!area) return;

  // If petState hasn't loaded yet (user came directly to Battle tab),
  // fetch pets from DB and then re-render
  if (Object.keys(petState).length === 0 && currentUser) {
    supabaseClient
      .from('user_pets')
      .select('id, nickname, pet_type, level, energy, max_energy, happiness')
      .eq('user_id', currentUser.id)
      .then(function(res) {
        if (res.data) {
          res.data.forEach(function(p) { if (!petState[p.id]) petState[p.id] = p; });
        }
        expedition_renderSelector();
      })
      .catch(function() { expedition_renderSelector(); });
    area.innerHTML = '<div class="spinner"></div>';
    return;
  }

  // All pets eligible — no level/energy gate
  var eligiblePets = Object.values(petState).filter(function(p) {
    return (p.level || 1) >= 1;
  });

  var petOptions = eligiblePets.length === 0
    ? '<p style="color:#ff6b6b;text-align:center;font-size:0.88rem;">No pets available. Adopt one first! 🐾</p>'
    : '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:16px;">' +
      eligiblePets.map(function(p) {
        return '<button class="btn btn-outline expedition-pet-btn" data-pet-id="' + p.id + '" onclick="expedition_selectPet(\'' + p.id + '\')" style="padding:8px 14px;font-size:0.82rem;">' +
          (p.nickname || p.pet_type || 'Pet') + ' Lv.' + (p.level || 1) + ' ⚡' + Math.floor(p.energy || 0) +
          '</button>';
      }).join('') +
      '</div>';

  // Zone discovery — ruins stays hidden until player has completed deep woods
  var discoveredZones = {
    outskirts: true,
    forest:    true,
    deepwoods: true
  };
  try {
    var zd = JSON.parse(localStorage.getItem('discovered_zones_' + (currentUser && currentUser.id)) || '{}');
    Object.assign(discoveredZones, zd);
  } catch(e) {}

  // Auto-discover ruins if player has a Lv.15+ pet
  if (Object.values(petState).some(function(p) { return (p.level||0) >= 15; })) {
    discoveredZones.ruins = true;
    try { localStorage.setItem('discovered_zones_' + (currentUser && currentUser.id), JSON.stringify(discoveredZones)); } catch(e) {}
  }

  var zoneOptions = EXPEDITION_ZONES.filter(function(z) { return discoveredZones[z.key] !== false; }).map(function(z) {
    var levelOk = !_expeditionPetId || !petState[_expeditionPetId] || (petState[_expeditionPetId].level || 1) >= z.minLevel;
    return '<div class="expedition-zone-card" data-zone="' + z.key + '" onclick="expedition_selectZone(\'' + z.key + '\')" style="cursor:pointer;border:2px solid var(--border);border-radius:12px;padding:12px 16px;margin-bottom:8px;transition:all 0.2s;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;">' +
        '<span style="font-size:1.1rem;">' + z.emoji + ' <strong>' + z.label + '</strong>' +
          (z.minLevel > 1 ? ' <span style="font-size:0.65rem;color:' + (levelOk ? '#5dde7a' : '#ff9f43') + ';background:rgba(0,0,0,0.06);border-radius:8px;padding:1px 6px;">Lv.' + z.minLevel + '+ rec.</span>' : '') +
        '</span>' +
        '<span style="font-size:0.75rem;color:var(--text-light);">⏱️ ' + z.duration + 'min | 💰 ' + z.minPP + '-' + z.maxPP + ' PP</span>' +
      '</div>' +
      '<div style="font-size:0.74rem;color:var(--text-light);margin-top:3px;">' + z.desc + '</div>' +
    '</div>';
  }).join('');

  // Pace selector
  var paceOptions = Object.keys(EXPEDITION_PACES).map(function(pk) {
    var pc = EXPEDITION_PACES[pk];
    var active = _expeditionPace === pk;
    return '<button onclick="expedition_setPace(\'' + pk + '\')" style="flex:1;padding:7px 4px;border-radius:10px;border:2px solid ' + (active ? 'var(--purple)' : 'var(--border)') + ';background:' + (active ? 'rgba(153,102,255,0.12)' : 'var(--white)') + ';font-size:0.75rem;font-weight:' + (active ? '700' : '400') + ';cursor:pointer;color:var(--text);transition:all 0.15s;">' +
      pc.label + '<br><span style="font-size:0.62rem;color:var(--text-light);">' + pc.desc + '</span>' +
    '</button>';
  }).join('');

  area.innerHTML =
    '<div id="expedition-selector">' +
      '<div style="font-weight:700;color:var(--purple-dark);margin-bottom:8px;font-size:0.9rem;">1️⃣ Choose a Pet:</div>' +
      petOptions +
      '<div id="expedition-pet-selected" style="margin-bottom:12px;font-size:0.82rem;color:var(--text-light);text-align:center;">No pet selected</div>' +
      '<div style="font-weight:700;color:var(--purple-dark);margin-bottom:8px;font-size:0.9rem;">2️⃣ Choose a Zone:</div>' +
      zoneOptions +
      '<div style="font-weight:700;color:var(--purple-dark);margin-bottom:8px;margin-top:14px;font-size:0.9rem;">3️⃣ Choose a Pace:</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:14px;">' + paceOptions + '</div>' +
      '<div id="expedition-odds-panel" style="background:rgba(153,102,255,0.05);border:1px solid rgba(153,102,255,0.15);border-radius:12px;padding:12px 14px;margin-bottom:12px;display:none;">' +
        '<div style="font-size:0.78rem;font-weight:700;color:var(--purple-dark);margin-bottom:8px;">📊 Estimated Odds</div>' +
        '<div id="expedition-odds-content"></div>' +
      '</div>' +
      '<button id="expedition-start-btn" class="btn btn-primary" onclick="expedition_start()" disabled style="width:100%;margin-top:4px;opacity:0.5;">Select a pet and zone</button>' +
    '</div>';
}

var _expeditionPetId  = null;
var _expeditionZoneKey = null;

function expedition_selectPet(petId) {
  _expeditionPetId = petId;
  document.querySelectorAll('.expedition-pet-btn').forEach(function(b) {
    b.style.background = b.getAttribute('data-pet-id') === petId ? 'var(--purple)' : '';
    b.style.color      = b.getAttribute('data-pet-id') === petId ? 'white' : '';
  });
  var pet = petState[petId];
  var nameEl = document.getElementById('expedition-pet-selected');
  if (nameEl && pet) nameEl.textContent = '✅ ' + (pet.nickname || pet.pet_type || 'Pet') + ' selected';
  expedition_updateOdds();
  expedition_updateStartBtn();
}

function expedition_setPace(pace) {
  _expeditionPace = pace;
  expedition_renderSelector();
}

function expedition_updateOdds() {
  var panel   = document.getElementById('expedition-odds-panel');
  var content = document.getElementById('expedition-odds-content');
  if (!panel || !content) return;
  if (!_expeditionPetId || !_expeditionZoneKey) { panel.style.display = 'none'; return; }
  var zone = EXPEDITION_ZONES.find(function(z) { return z.key === _expeditionZoneKey; });
  var pet  = petState[_expeditionPetId];
  var odds = expedition_calcOdds(zone, pet, _expeditionPace);
  if (!odds) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  content.innerHTML = expedition_oddsHTML(odds, zone);
}

function expedition_selectZone(zoneKey) {
  _expeditionZoneKey = zoneKey;
  document.querySelectorAll('.expedition-zone-card').forEach(function(card) {
    var selected = card.getAttribute('data-zone') === zoneKey;
    card.style.borderColor  = selected ? 'var(--purple)' : 'var(--border)';
    card.style.background   = selected ? 'rgba(153,102,255,0.08)' : '';
  });
  expedition_updateStartBtn();
  expedition_updateOdds();
  expedition_updateStartBtn();
}  // closes expedition_selectZone

function expedition_updateStartBtn() {
  var btn = document.getElementById('expedition-start-btn');
  if (!btn) return;
  var zone = EXPEDITION_ZONES.find(function(z) { return z.key === _expeditionZoneKey; });
  var ready = _expeditionPetId && _expeditionZoneKey;
  btn.disabled = !ready;
  btn.style.opacity = ready ? '1' : '0.5';
  if (zone && ready) btn.textContent = '⚡ ' + zone.energyCost + ' energy. Send to ' + zone.label + '!';
}

async function expedition_start() {
  if (raceState && raceState.racing) return; // belt-and-braces
  if (!canPerformAction('expedition_start', 5000)) return;
  if (!_expeditionPetId || !_expeditionZoneKey || !currentUser) return;
  var btn = document.getElementById('expedition-start-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

  var zone = EXPEDITION_ZONES.find(function(z) { return z.key === _expeditionZoneKey; });
  var pet  = petState[_expeditionPetId];
  if (!zone || !pet) return;

  // Level gate — underleveled pets can attempt but get heavily penalised odds
  // This is enforced client-side; the odds display already warns the player
  if ((pet.level || 1) < zone.minLevel - 5) {
    // Way underlevelled (5+ below minimum) — hard block
    showToast('⚠️ ' + (pet.nickname || 'Your pet') + ' is too underlevelled for ' + zone.label + '! (need Lv.' + zone.minLevel + ')', 4000);
    if (btn) { btn.disabled = false; expedition_updateStartBtn(); }
    return;
  }

  // Final energy check
  if ((pet.energy || 0) < zone.energyCost) {
    showToast('Not enough energy! (need ' + zone.energyCost + ')', 3000);
    if (btn) { btn.disabled = false; expedition_updateStartBtn(); }
    return;
  }

  var endsAt = new Date(Date.now() + zone.duration * 60000).toISOString();

  // Pre-calculate rewards with balanced economy
  var levelBonus2 = Math.min(1.5, 1 + ((pet.level || 1) / 100));
  var rewardPP = Math.floor((zone.minPP + Math.floor(Math.random() * (zone.maxPP - zone.minPP + 1))) * levelBonus2);

  // Single item drop
  var droppedItemsMG = [];
  if (Math.random() < (zone.itemChance || 0)) {
    var mgPool = zone.itemPool || [];
    var mgDropped = null;
    if (zone.key === 'ruins') {
      var mgEquip = mgPool.filter(function(it) { return it.type === 'equipment'; });
      var mgToy   = mgPool.filter(function(it) { return it.type !== 'equipment'; });
      mgDropped = Math.random() < (zone.equipmentChance || 0.10)
        ? mgEquip[Math.floor(Math.random() * mgEquip.length)]
        : mgToy[Math.floor(Math.random() * mgToy.length)];
    } else {
      mgDropped = mgPool[Math.floor(Math.random() * mgPool.length)];
    }
    if (mgDropped) droppedItemsMG.push(mgDropped);
  }

  // Insert expedition row
  var { data: row, error } = await supabaseClient.from('expeditions').insert({
    user_id:      currentUser.id,
    pet_id:       _expeditionPetId,
    zone:         _expeditionZoneKey,
    ends_at:      endsAt,
    completed:    false,
    claimed:      false,
    reward_pp:    rewardPP,
    reward_items: droppedItemsMG
  }).select().single();

  if (error) { showToast('Failed to start expedition: ' + error.message, 4000); if (btn) { btn.disabled = false; expedition_updateStartBtn(); } return; }

  // Deduct energy AFTER successful DB insert (use zone's actual energyCost)
  var { data: newEnergyVal, error: energyErr } = await supabaseClient.rpc('adjust_pet_stat_secure', {
    p_pet_id: _expeditionPetId, p_stat: 'energy', p_delta: -zone.energyCost, p_reason: 'expedition_start'
  });
  if (!energyErr && petState[_expeditionPetId]) petState[_expeditionPetId].energy = newEnergyVal;

  expeditionState.active = row;
  showToast('🏴‍☠️ ' + (pet.nickname || 'Your pet') + ' set off for the ' + zone.label + '!', 3000);
  expedition_renderCountdown(row);
}

// ── Active expedition countdown ──
function expedition_renderCountdown(row) {
  var area = document.getElementById('expedition-area');
  if (!area) return;
  var zone = EXPEDITION_ZONES.find(function(z) { return z.key === row.zone; }) || EXPEDITION_ZONES[0];
  var pet  = petState[row.pet_id] || {};

  area.innerHTML =
    '<div style="text-align:center;padding:20px 10px;">' +
      '<div style="font-size:2.5rem;margin-bottom:8px;">' + zone.emoji + '</div>' +
      '<div style="font-weight:700;font-size:1.05rem;color:var(--purple-dark);margin-bottom:4px;">' +
        (pet.nickname || 'Your pet') + ' is exploring the ' + zone.label + '!' +
      '</div>' +
      '<div style="color:var(--text-light);font-size:0.85rem;margin-bottom:16px;">' + zone.desc + '</div>' +
      '<div style="background:rgba(153,102,255,0.1);border-radius:16px;padding:16px;display:inline-block;min-width:180px;">' +
        '<div style="font-size:0.78rem;color:var(--text-light);margin-bottom:4px;">Returns in</div>' +
        '<div id="expedition-countdown" style="font-size:2rem;font-weight:800;color:var(--purple);font-family:monospace;">--:--</div>' +
      '</div>' +
      '<div style="margin-top:16px;font-size:0.8rem;color:var(--text-light);">Expected loot: 💰 ' + (row.reward_pp || '?') + ' PP</div>' +
    '</div>';

  // Start countdown ticker
  if (expeditionState.timer) safeClearInterval(expeditionState.timer);
  function tick() {
    var remaining = new Date(row.ends_at) - new Date();
    var el = document.getElementById('expedition-countdown');
    if (!el) { safeClearInterval(expeditionState.timer); return; }
    if (remaining <= 0) {
      safeClearInterval(expeditionState.timer);
      supabaseClient.from('expeditions').update({ completed: true }).eq('id', row.id).then(function() {
        row.completed = true;
        expedition_renderClaim(row);
      });
      return;
    }
    var mins = Math.floor(remaining / 60000);
    var secs = Math.floor((remaining % 60000) / 1000);
    el.textContent = String(mins).padStart(2,'0') + ':' + String(secs).padStart(2,'0');
  }
  tick();
  expeditionState.timer = safeSetInterval(tick, 1000);
}

// ── Claim UI ──
function expedition_renderClaim(row) {
  var area = document.getElementById('expedition-area');
  if (!area) return;
  var zone = EXPEDITION_ZONES.find(function(z) { return z.key === row.zone; }) || EXPEDITION_ZONES[0];
  var pet  = petState[row.pet_id] || {};

  area.innerHTML =
    '<div style="text-align:center;padding:20px 10px;">' +
      '<div style="font-size:2.5rem;margin-bottom:8px;animation:bounce 0.6s ease infinite alternate;">🎉</div>' +
      '<div style="font-weight:700;font-size:1.1rem;color:var(--purple-dark);margin-bottom:6px;">' +
        (pet.nickname || 'Your pet') + ' returned from the ' + zone.label + '!' +
      '</div>' +
      '<div style="background:linear-gradient(135deg,rgba(255,215,0,0.15),rgba(153,102,255,0.1));border:2px solid rgba(255,215,0,0.4);border-radius:16px;padding:18px;margin:14px auto;max-width:260px;">' +
        '<div style="font-size:0.8rem;color:var(--text-light);margin-bottom:6px;">Expedition Haul</div>' +
        '<div style="font-size:2rem;font-weight:800;color:#e6a800;">💰 ' + (row.reward_pp || 0) + ' PP</div>' +
        '<div style="font-size:0.78rem;color:var(--text-light);margin-top:4px;">' + zone.emoji + ' ' + zone.label + ' · ' + zone.rarity + ' loot</div>' +
      '</div>' +
      '<button class="btn btn-primary" onclick="expedition_claim(\'' + row.id + '\')" style="padding:12px 32px;font-size:1rem;">🎁 Claim Rewards!</button>' +
    '</div>';
}

async function expedition_claim(expeditionId) {
  var claimBtn = document.querySelector('#expedition-area .btn-primary');
  if (claimBtn) { claimBtn.disabled = true; claimBtn.textContent = 'Claiming…'; }

  var { data: row } = await supabaseClient.from('expeditions').select('*').eq('id', expeditionId).single();
  if (!row) { showToast('Expedition not found', 3000); return; }

  // Mark claimed
  await supabaseClient.from('expeditions').update({ claimed: true }).eq('id', expeditionId);

  // Award PP
  var streak = await checkExplorationStreak(row.pet_id, row.zone);
  var streakMult = getStreakMultiplier(row.pet_id, row.zone);
  var perkMult   = getActivePerkMultiplier('reward_boost');
  var finalPP = Math.floor((row.reward_pp || 0) * streakMult * perkMult);
  await awardPP(finalPP, 'expedition_' + row.zone);

  // FIX: Grant item drops (were being silently skipped in this path)
  var rewardItems = row.reward_items || [];
  var itemNames = [];
  for (var ri = 0; ri < rewardItems.length; ri++) {
    if (rewardItems[ri].id) {
      await supabaseClient.from('user_inventory').insert({
        user_id: currentUser.id, item_id: rewardItems[ri].id, quantity: 1
      }).catch(function(){});
      itemNames.push(rewardItems[ri].name || '📦');
    }
  }

  // FIX: Award zone XP and check for level-up (was missing entirely)
  var EXPEDITION_ZONES_MAP = {};
  if (typeof EXPEDITION_ZONES !== 'undefined') {
    EXPEDITION_ZONES.forEach(function(z) { EXPEDITION_ZONES_MAP[z.key] = z; });
  }
  var zoneData = EXPEDITION_ZONES_MAP[row.zone] || {};
  var zoneXP = zoneData.xpReward || 0;
  if (zoneXP > 0) {
    var petXPRes = await supabaseClient.from('user_pets')
      .select('xp, level, max_hunger, max_energy, max_happiness, base_hp, base_attack, base_defense, base_speed')
      .eq('id', row.pet_id).single();
    if (petXPRes.data) {
      var pd = petXPRes.data;
      var newXP = (pd.xp || 0) + zoneXP;
      var lu = calculateLevelUp(newXP, pd.level, pd.max_hunger, pd.max_energy, pd.max_happiness,
        pd.base_hp || 25, pd.base_attack || 4, pd.base_defense || 2, pd.base_speed || 3);
      var xpUpdates = { xp: lu.leveled ? lu.xp : newXP };
      if (lu.leveled) {
        xpUpdates.level = lu.level;
        xpUpdates.max_hunger = lu.maxHunger;
        // Level milestone celebrations
        if (lu.level === 10 || lu.level === 25 || lu.level === 50) {
          var petName = petState[row.pet_id] && petState[row.pet_id].nickname || 'Your pet';
          var milestoneRarity = lu.level >= 50 ? 'legendary' : lu.level >= 25 ? 'epic' : 'rare';
          safeSetTimeout(function() {
            showRareCelebration({
              title: petName + ' reached Lv.' + lu.level + '!',
              subtitle: 'A major milestone! Your pet is growing strong.',
              icon: lu.level >= 50 ? '🌟' : lu.level >= 25 ? '⭐' : '✨',
              rarity: milestoneRarity,
              shareText: 'My pet just hit Level ' + lu.level + ' in PawketPetsVT! 🐾 #PawketPetsVT'
            });
          }, 1500);
        }
        xpUpdates.max_energy = lu.maxEnergy;
        xpUpdates.max_happiness = lu.maxHappiness;
        xpUpdates.base_hp = lu.base_hp;
        xpUpdates.base_attack = lu.base_attack;
        xpUpdates.base_defense = lu.base_defense;
        xpUpdates.base_speed = lu.base_speed;
        onPetLevelUp(row.pet_id);
        showToast('⭐ ' + (petState[row.pet_id] && petState[row.pet_id].nickname || 'Pet') + ' leveled up to Lv.' + lu.level + '!', 4000);
      }
      await supabaseClient.from('user_pets').update(xpUpdates).eq('id', row.pet_id);
      if (petState[row.pet_id]) Object.assign(petState[row.pet_id], xpUpdates);
    }
  }

  // Check for secrets
  checkSecretDiscovery(row.pet_id, row.zone, streak).catch(function(){});

  // Integrations
  addPassXP(10, 'expedition').catch(function(){});
  updateBingoProgress('complete_expedition', 1);
  checkPetWishes('expedition', row.pet_id).catch(function(){});
  progressQuestArc(row.pet_id, 'expedition').catch(function(){});
  community_increment('expeditions', 1);
  trackDailyStat('expeditions_completed').catch(function(){});
  checkAchievementTierProgress('expeditions_completed', row.pet_id, streak).catch(function(){});

  var itemMsg = itemNames.length > 0 ? ' + ' + itemNames.join(', ') : '';
  // Build narrative event log instead of plain toast
  var zone2 = EXPEDITION_ZONES.find(function(z) { return z.key === row.zone; }) || EXPEDITION_ZONES[0];
  var petName2 = (petState[row.pet_id] && (petState[row.pet_id].nickname || petState[row.pet_id].pet_type)) || 'Your pet';
  var narrativeEvents = expedition_buildNarrative(zone2, petName2, row, finalPP, itemNames);
  expedition_showNarrativeModal(zone2, petName2, finalPP, itemNames, narrativeEvents);
  showToast('🏴\u200d\u2620\ufe0f ' + petName2 + ' returned! +' + finalPP + ' PP' + (itemNames.length > 0 ? ' + items!' : '!'), 4000);

  expeditionState.active = null;
  _expeditionPetId  = null;
  _expeditionZoneKey = null;

  // Reload pets to reflect any XP/level changes
  tabsLoaded['mypets'] = false;

  // Show history then selector
  await expedition_renderHistory();
}

// Build 2-4 narrative sentences describing what happened
function expedition_buildNarrative(zone, petName, row, finalPP, itemNames) {
  var events = zone.events || [];
  var sentences = [];

  // Opening sentence
  var openings = [
    petName + ' set off into ' + zone.label + ' with a determined look.',
    'Off went ' + petName + ', disappearing into ' + zone.label + '.',
    petName + ' headed out to explore the ' + zone.label + '.',
  ];
  sentences.push(openings[Math.floor(Math.random() * openings.length)]);

  // Middle events — pick 1-2 from the zone's event table
  var shuffled = events.slice().sort(function() { return Math.random() - 0.5; });
  var picked = shuffled.slice(0, 1 + Math.floor(Math.random() * 2));
  picked.forEach(function(ev) {
    if (ev.text) sentences.push(ev.text.replace(/\{pet\}/g, petName));
  });

  // Item discovery sentence
  if (itemNames.length > 0) {
    sentences.push('They came back carrying: ' + itemNames.join(', ') + '.');
  }

  // Closing sentence with PP
  var closings = [
    'All in all, a productive outing. (+' + finalPP + ' PP)',
    'Back home safe with ' + finalPP + ' PP worth of findings.',
    petName + ' returned tired but satisfied. (+' + finalPP + ' PP)',
  ];
  sentences.push(closings[Math.floor(Math.random() * closings.length)]);

  return sentences;
}

function expedition_showNarrativeModal(zone, petName, finalPP, itemNames, sentences) {
  // Remove any existing
  var existing = document.getElementById('expedition-narrative-modal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'expedition-narrative-modal';
  modal.style.cssText = [
    'position:fixed','top:50%','left:50%',
    'transform:translate(-50%,-52%) scale(0.9)',
    'z-index:9700',
    'background:var(--white)',
    'border:2px solid rgba(153,102,255,0.4)',
    'border-radius:20px',
    'padding:22px 26px',
    'max-width:400px','width:90vw',
    'box-shadow:0 10px 40px rgba(0,0,0,0.2)',
    'opacity:0',
    'transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1)'
  ].join(';');

  modal.innerHTML =
    '<div style="text-align:center;margin-bottom:12px;">' +
      '<div style="font-size:2.2rem;">' + zone.emoji + '</div>' +
      '<div style="font-weight:800;color:var(--purple-dark);font-size:1rem;margin-top:4px;">' +
        petName + ' returned from ' + zone.label + '!' +
      '</div>' +
    '</div>' +
    '<div style="background:rgba(153,102,255,0.05);border-radius:12px;padding:12px 14px;margin-bottom:14px;">' +
      sentences.map(function(s) {
        return '<p style="font-size:0.82rem;color:var(--text);line-height:1.6;margin:0 0 6px;">' + escapeHtml(s) + '</p>';
      }).join('') +
    '</div>' +
    '<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:14px;">' +
      '<div style="text-align:center;background:rgba(255,215,0,0.12);border-radius:10px;padding:8px 16px;">' +
        '<div style="font-size:1.3rem;font-weight:800;color:#e8a000;">💰 +' + finalPP + ' PP</div>' +
        (itemNames.length > 0 ? '<div style="font-size:0.72rem;color:var(--text-light);">' + itemNames.join(', ') + '</div>' : '') +
      '</div>' +
    '</div>' +
    '<button class="btn btn-primary" onclick="document.getElementById('expedition-narrative-modal').remove()" ' +
    'style="width:100%;">Continue</button>';

  document.body.appendChild(modal);
  requestAnimationFrame(function() {
    modal.style.opacity = '1';
    modal.style.transform = 'translate(-50%,-50%) scale(1)';
  });
  // Auto-dismiss after 15s
  setTimeout(function() { if (modal.parentNode) modal.parentNode.removeChild(modal); }, 15000);
}

async function expedition_renderHistory() {
  var area = document.getElementById('expedition-area');
  if (!area) return;

  var { data: history } = await supabaseClient
    .from('expeditions')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('claimed', true)
    .order('started_at', { ascending: false })
    .limit(5);

  var histHtml = '';
  if (history && history.length > 0) {
    histHtml = '<div style="margin-top:20px;border-top:1px solid var(--border);padding-top:14px;">' +
      '<div style="font-weight:700;font-size:0.85rem;color:var(--purple-dark);margin-bottom:8px;">📜 Recent Expeditions</div>' +
      history.map(function(r) {
        var zone = EXPEDITION_ZONES.find(function(z) { return z.key === r.zone; });
        var pet  = petState[r.pet_id];
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(153,102,255,0.08);font-size:0.8rem;">' +
          '<span>' + (zone ? zone.emoji : '🗺️') + ' ' + (zone ? zone.label : r.zone) + ' · ' + (pet ? (pet.nickname || 'Pet') : 'Pet') + '</span>' +
          '<span style="color:#e6a800;font-weight:700;">+' + (r.reward_pp || 0) + ' PP</span>' +
        '</div>';
      }).join('') +
      '</div>';
  }

  area.innerHTML = '<div id="expedition-post-claim">' + histHtml + '</div>';
  // Reload selector after 800ms
  setTimeout(function() { expedition_renderSelector(); }, 800);
}

// Hook into minigames tab load
var _origTabsLoadedMinigames = tabsLoaded['minigames'];
tabsLoaded['minigames'] = function() {
  if (_origTabsLoadedMinigames) _origTabsLoadedMinigames();
  expedition_init();
  race_init();
};

// Battle tab: also init expedition panel
var _origTabsLoadedBattle = tabsLoaded['battle'];
tabsLoaded['battle'] = function() {
  if (_origTabsLoadedBattle) _origTabsLoadedBattle();
  battleExp_init();
};

// ═══════════════════════════════════════════════════════════════════════════
// PET RACING MINI-GAME
// ═══════════════════════════════════════════════════════════════════════════

var RACE_BETS       = [10, 50, 100];
var RACE_DAILY_MAX  = 5;
var RACE_ENERGY_COST = 5;

var CPU_PETS = [
  { id:'cpu1', nickname:'Zippy',   base_speed:6,  emoji:'🐇', isCpu:true },
  { id:'cpu2', nickname:'Sludge',  base_speed:3,  emoji:'🐌', isCpu:true },
  { id:'cpu3', nickname:'Blaze',   base_speed:8,  emoji:'🦊', isCpu:true },
  { id:'cpu4', nickname:'Pebble',  base_speed:4,  emoji:'🐢', isCpu:true }
];

var raceState = {
  selectedPets: [],   // up to 4 pet objects (mix of player + CPU)
  bet:          10,
  racing:       false,
  racesLeft:    RACE_DAILY_MAX,
  animFrame:    null
};

// ── Init ──────────────────────────────────────────────────────────────────
async function race_init() {
  // Support both the Racing page (racing-race-area) and the Minigames page (race-area)
  var area = document.getElementById('racing-race-area') || document.getElementById('race-area');
  if (!area) return;
  if (!currentUser) {
    area.innerHTML = '<p style="color:var(--text-light);text-align:center;">Log in to race!</p>';
    return;
  }
  area.innerHTML = '<div class="spinner"></div>';

  // Load tracks if not cached
  if (!_raceTracks) await race_loadTracks();

  // Check daily race count — table may not exist yet, default to 0
  try {
    var today = new Date().toISOString().slice(0, 10);
    var { count } = await supabaseClient
      .from('race_history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', currentUser.id)
      .eq('race_date', today);
    raceState.racesLeft = Math.max(0, RACE_DAILY_MAX - (count || 0));
  } catch(e) {
    dbg('race_init: race_history table not found, defaulting racesLeft to max');
    raceState.racesLeft = RACE_DAILY_MAX;
  }

  raceState.selectedPets = [];
  raceState.bet = 10;

  race_renderSetup();
}

// ── Setup UI ─────────────────────────────────────────────────────────────
async function race_renderSetup() {
  var area = document.getElementById('racing-race-area') || document.getElementById('race-area');
  if (!area) return;

  area.innerHTML = '<div class="spinner"></div>';

  // Query DB directly — don't rely on petState being populated
  var myPets = [];
  try {
    var { data: dbPets, error } = await supabaseClient
      .from('user_pets')
      .select('id, nickname, level, energy, base_speed, current_variant, pets(name, image_file)')
      .eq('user_id', currentUser.id);
    if (!error && dbPets) {
      myPets = dbPets; // All pets eligible — no level/energy gate for Quick Race
    }
  } catch(e) { dbg('race_renderSetup: DB query failed', e); }

  var petsHtml = myPets.length === 0
    ? '<div style="color:#ff6b6b;font-size:0.85rem;text-align:center;">No pets found. Adopt one first! 🐾</div>'
    : myPets.map(function(p) {
        var spd = p.base_speed || 4;
        var spdColor = spd >= 8 ? '#4ade80' : spd >= 5 ? '#fbbf24' : '#ff9966';
        // Approximate win odds using the same weighted-lottery model as race_start
        // tickets = 6 + speed^0.65; win% ≈ tickets / (3*avg_cpu_tickets + tickets)
        // Match FLOOR_TICKETS=8, SPEED_EXPONENT=1.4 from race_start
        var myTickets = 8 + Math.pow(spd, 1.4);
        var avgCpuTickets = 8 + Math.pow(5.25, 1.4); // CPU pool avg ~5.25
        var approxWinPct = Math.round((myTickets / (myTickets + 3 * avgCpuTickets)) * 100);
        var selected = raceState.selectedPets.some(function(s) { return s && s.id === p.id; });
        return '<div class="race-pet-option ' + (selected ? 'race-pet-selected' : '') + '" ' +
          'onclick="race_togglePet(\'' + p.id + '\')" ' +
          'data-pet-id="' + p.id + '" ' +
          'style="cursor:pointer;border:2px solid ' + (selected ? 'var(--purple)' : 'var(--border)') + ';' +
          'border-radius:10px;padding:8px 12px;text-align:center;transition:all 0.2s;' +
          'background:' + (selected ? 'rgba(153,102,255,0.1)' : 'transparent') + ';">' +
          '<div style="font-size:1.4rem;">' + race_petAvatar(p) + '</div>' +
          '<div style="font-size:0.78rem;font-weight:700;color:var(--purple-dark);">' + escapeHtml(p.nickname || p.pet_type || 'Pet') + '</div>' +
          '<div style="font-size:0.72rem;color:var(--text-light);">Lv.' + (p.level||1) + ' · ⚡' + Math.floor(p.energy||0) + '</div>' +
          '<div style="font-size:0.72rem;font-weight:700;color:' + spdColor + ';">💨 SPD ' + spd + ' · ~' + approxWinPct + '% win</div>' +
        '</div>';
      }).join('');

  var betBtns = RACE_BETS.map(function(b) {
    var active = raceState.bet === b;
    return '<button class="btn ' + (active ? 'btn-primary' : 'btn-outline') + ' btn-sm" ' +
      'onclick="race_setBet(' + b + ')" style="padding:6px 14px;">' + b + ' PP</button>';
  }).join('');

  // Cache DB pets so race_togglePet can look them up by id
  window._racePetsCache = myPets;

  var canRace = raceState.selectedPets.length >= 1 && raceState.racesLeft > 0 && currentPoints >= raceState.bet;

  area.innerHTML =
    '<div id="race-setup">' +
      // Track selector (only if tracks are available from DB)
      race_renderTrackSelector() +

      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
        '<div style="font-size:0.82rem;color:var(--text-light);">Races left today: ' +
          '<strong style="color:' + (raceState.racesLeft > 0 ? 'var(--purple)' : '#ff6b6b') + ';">' + raceState.racesLeft + '/' + RACE_DAILY_MAX + '</strong>' +
        '</div>' +
        '<div style="font-size:0.82rem;color:var(--text-light);">Your PP: <strong>🪙' + (currentPoints||0) + '</strong></div>' +
      '</div>' +
      '<div style="font-weight:700;font-size:0.85rem;color:var(--purple-dark);margin-bottom:8px;">Select up to 2 pets to race (CPU fills the rest):</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin-bottom:10px;">' + petsHtml + '</div>' +
      '<div style="background:rgba(153,102,255,0.06);border-radius:8px;padding:8px 10px;margin-bottom:12px;font-size:0.7rem;color:var(--text-light);line-height:1.7;">' +
        '<strong style="color:var(--purple-dark);">🏎️ How does Speed work?</strong> ' +
        'Every pet has a base chance to win — even slow ones can upset! Higher Speed (💨) gives more tickets in the draw so faster pets win more often, but returns shrink as you stack gear. Rough win odds vs 3 opponents: Speed 4 ≈14%, Speed 8 ≈48%, Speed 12 ≈66%, Speed 20 ≈82%. Boost speed by leveling, equipping speed gear, or unlocking variants!' +
      '</div>' +
      '<div style="font-weight:700;font-size:0.85rem;color:var(--purple-dark);margin-bottom:8px;">Your Bet:</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:16px;">' + betBtns + '</div>' +
      '<div style="font-size:0.78rem;color:var(--text-light);margin-bottom:12px;">' +
        '⚡ Costs ' + RACE_ENERGY_COST + ' energy from racing pets · Max 2× your bet · CPU fills empty lanes' +
      '</div>' +
      '<div style="background:rgba(153,102,255,0.08);border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:0.75rem;color:var(--text-light);line-height:1.6;">' +
        '<strong style="color:var(--purple-dark);">🏁 Race Rewards:</strong><br>' +
        '🥇 1st Place: Win 1.5× to 3× your bet<br>' +
        '🥈 2nd Place: Get your bet back (small bonus if close)<br>' +
        '🥉 3rd Place: Get half your bet back<br>' +
        '4️⃣ 4th Place: Lose your full bet. Faster pets = bigger wins!' +
      '</div>' +
      '<button id="race-start-btn" class="btn btn-primary" onclick="race_start()" ' +
        (canRace ? '' : 'disabled ') +
        'style="width:100%;' + (canRace ? '' : 'opacity:0.5;') + '">' +
        (raceState.racesLeft === 0 ? '🏁 Come back tomorrow!' :
         currentPoints < raceState.bet ? '❌ Not enough PP' :
         '🏁 Start Race! (Bet ' + raceState.bet + ' PP)') +
      '</button>' +
      '<button class="btn btn-outline btn-sm" onclick="race_renderWeeklyLeaderboard()" style="width:100%;margin-top:8px;">📅 Weekly Leaderboard</button>' +
    '</div>';
}

function race_petAvatar(p) {
  if (p.isCpu) return p.emoji || '🐾';
  var imgFile = p.image_file || (p.pets && p.pets.image_file);
  if (imgFile) return '<img src="images/' + imgFile + '" style="width:28px;height:28px;object-fit:contain;" onerror="this.outerHTML=\'🐾\';">';
  return '🐾';
}

function race_togglePet(petId) {
  var idx = raceState.selectedPets.findIndex(function(p) { return p && p.id === petId; });
  if (idx !== -1) {
    raceState.selectedPets.splice(idx, 1);
  } else {
    if (raceState.selectedPets.length >= 2) { showToast('Max 2 of your pets per race!', 2000); return; }
    // Look up from the DB-fetched cache first, then fall back to petState
    var pet = (window._racePetsCache || []).find(function(p) { return p.id === petId; }) || petState[petId];
    if (!pet) { showToast('Pet data not found. Try refreshing', 2500); return; }
    raceState.selectedPets.push(pet);
  }
  race_renderSetup();
}

function race_setBet(amount) {
  raceState.bet = amount;
  race_renderSetup();
}

// ── Race start ────────────────────────────────────────────────────────────
async function race_start() {
  if (raceState.racing) return;
  if (!canPerformAction('race_start', 3000)) return;
  if (raceState.racesLeft <= 0) { showToast('No races left today!', 3000); return; }
  if (raceState.selectedPets.length < 1) { showToast('Select at least 1 pet!', 2000); return; }
  if (currentPoints < raceState.bet) { showToast('Not enough PP!', 2500); return; }

  // Validate energy
  for (var i = 0; i < raceState.selectedPets.length; i++) {
    var p = raceState.selectedPets[i];
    if (!p.isCpu && (p.energy || 0) < RACE_ENERGY_COST) {
      showToast((p.nickname || 'Your pet') + ' is too tired!', 2500);
      return;
    }
  }

  raceState.racing = true;

  // Build full lane lineup: player pets + CPU fill to 4
  var lanes = raceState.selectedPets.slice();
  var cpuPool = CPU_PETS.slice().sort(function() { return Math.random() - 0.5; });
  while (lanes.length < 4) { lanes.push(cpuPool[lanes.length - raceState.selectedPets.length] || CPU_PETS[0]); }

  // Compute race scores using a weighted-lottery model:
  //   tickets = FLOOR_TICKETS + (speed * trackMod) ^ SPEED_EXPONENT
  //   score   = tickets * random()
  //
  // FLOOR_TICKETS: every pet starts with these so even Speed-4 starters
  //   have a real underdog chance (~14% vs 3 average-speed opponents).
  // SPEED_EXPONENT > 1: super-linear scaling so high-speed endgame pets
  //   feel genuinely dominant (Speed 12 ≈65%, Speed 20 ≈82%, Speed 28 ≈88%)
  //   while still occasionally losing — no pet is unbeatable.
  // This scales naturally to any speed ceiling without needing retuning.
  var FLOOR_TICKETS  = 8;   // baseline tickets for all pets
  var SPEED_EXPONENT = 1.4; // >1 = increasing returns (Speed 12 ≈65%, Speed 28 ≈88%)
  var racerunners = lanes.map(function(pet) {
    var base = pet.base_speed || 4;
    var trackMod = pet.isCpu ? 1 : race_getTrackSpeedModifier(pet.current_variant || null);
    var effectiveSpeed = base * trackMod;
    var tickets = FLOOR_TICKETS + Math.pow(effectiveSpeed, SPEED_EXPONENT);
    var speed = tickets * Math.random(); // "speed" here is the final race score
    return { pet: pet, speed: speed, effectiveSpeed: Math.round(effectiveSpeed * 10) / 10, tickets: Math.round(tickets * 10) / 10, progress: 0, finished: false, finishOrder: null };
  });

  // Render track
  race_renderTrack(racerunners);

  // Deduct bet from player (before race — refunded if race errors out)
  await awardPP(-raceState.bet, 'race_bet');

  // Animate
  await race_animate(racerunners);

  // Sort by finish order
  racerunners.sort(function(a, b) { return a.finishOrder - b.finishOrder; });

  var winner = racerunners[0];
  var playerRunners = racerunners.filter(function(r) { return !r.pet.isCpu; });
  var playerWon = playerRunners.length > 0 && playerRunners[0].finishOrder === 1;
  var playerBest = playerRunners.length > 0 ? playerRunners[0] : null;

  // Calculate payout — placement-based system
  var payout = 0;
  var profit  = 0;
  if (playerBest) {
    var avgSpeed   = racerunners.reduce(function(s, r) { return s + r.speed; }, 0) / racerunners.length;
    var speedRatio = playerBest.speed / (avgSpeed || 1);

    if (playerBest.finishOrder === 1) {
      // 1st: 1.5× to 3× bet depending on how dominant the win was
      var winMultiplier = Math.min(3, 1.5 + speedRatio * 0.5);
      payout = Math.round(raceState.bet * winMultiplier);
      profit = payout - raceState.bet;
    } else if (playerBest.finishOrder === 2) {
      // 2nd: get bet back + small bonus if close to winner
      var secondBonus = speedRatio > 1 ? Math.round(raceState.bet * 0.2) : 0;
      payout = raceState.bet + secondBonus;
      profit = payout - raceState.bet;
    } else if (playerBest.finishOrder === 3) {
      // 3rd: get half bet back
      payout = Math.round(raceState.bet * 0.5);
      profit = payout - raceState.bet;
    } else {
      // 4th: lose full bet
      payout = 0;
      profit = -raceState.bet;
    }
  }

  // Deduct energy from player pets (AFTER race)
  for (var j = 0; j < raceState.selectedPets.length; j++) {
    var rp = raceState.selectedPets[j];
    if (!rp.isCpu) {
      var { data: newEnergyVal, error: energyErr } = await supabaseClient.rpc('adjust_pet_stat_secure', {
        p_pet_id: rp.id, p_stat: 'energy', p_delta: -RACE_ENERGY_COST, p_reason: 'race_energy_cost'
      });
      if (!energyErr && petState[rp.id]) petState[rp.id].energy = newEnergyVal;
    }
  }

  // Save to race_history
  try {
    await supabaseClient.from('race_history').insert({
      user_id:    currentUser.id,
      pet_id:     playerBest ? playerBest.pet.id : null,
      pet_name:   playerBest ? (playerBest.pet.nickname || playerBest.pet.pet_type || null) : null,
      bet_amount: raceState.bet,
      payout:     payout,
      won:        !!playerWon,
      position:   playerBest ? playerBest.finishOrder : null,
      opponents:  racerunners.filter(function(r) { return !playerBest || r.pet !== playerBest.pet; })
                          .map(function(r) { return { name: r.pet.nickname || r.pet.pet_type || 'CPU', speed: r.speed }; })
    });
  } catch(e) { dbg('[Race] race_history insert failed:', e); }

  // Award payout if any
  if (payout > 0) await awardPP(payout, 'race_win');

  // Integrations
  raceState.racesLeft = Math.max(0, raceState.racesLeft - 1);
  addPassXP(5, 'race').catch(function(){});
  if (playerWon) {
    checkPetWishes('race', winner.pet.id).catch(function(){});
    awardBadge('speed_demon').catch(function(){});
    progressQuestArc(winner.pet.id, 'race').catch(function(){});
    // Celebration popup for race win
    safeSetTimeout(function() {
      showRareCelebration({
        title: 'Race Winner!',
        subtitle: (winner && winner.pet && (winner.pet.nickname || winner.pet.name) || 'Your pet') + ' crossed the finish line first!' + (payout > 0 ? ' +' + payout + ' PP!' : ''),
        icon: '🏁', rarity: 'epic',
        shareText: 'My pet just won a race in PawketPetsVT! First place! 🏁 #PawketPetsVT'
      });
    }, 2000);
  }
  // Weekly leaderboard + achievement tiers
  var raceTimeMs = racerunners.length > 0 ? Math.floor(3000 + Math.random() * 2000) : null; // simulated time
  if (playerBest && !playerBest.pet.isCpu) {
    updateWeeklyLeaderboard(playerBest.pet.id, playerWon, raceTimeMs).catch(function(){});
    checkAchievementTierProgress('race_wins', playerBest.pet.id, playerWon ? 1 : 0).catch(function(){});
  }
  community_increment('races', 1);

  // Show results with animated log
  race_renderResults(racerunners, payout, playerBest);
  raceState.racing = false;
}

// ── Track render ──────────────────────────────────────────────────────────
function race_renderTrack(runners) {
  var area = document.getElementById('race-area');
  if (!area) return;

  var lanesHtml = runners.map(function(r, i) {
    var isPlayer = !r.pet.isCpu;
    return '<div class="race-lane" id="race-lane-' + i + '" style="' +
      'display:flex;align-items:center;gap:10px;margin-bottom:10px;' +
      'background:' + (isPlayer ? 'rgba(153,102,255,0.06)' : 'rgba(0,0,0,0.02)') + ';' +
      'border-radius:10px;padding:8px 10px;border:1px solid ' + (isPlayer ? 'rgba(153,102,255,0.2)' : 'var(--border)') + ';">' +
      '<div style="width:28px;text-align:center;font-size:1.1rem;" id="race-avatar-' + i + '">' + race_petAvatar(r.pet) + '</div>' +
      '<div style="width:70px;font-size:0.72rem;color:var(--purple-dark);font-weight:' + (isPlayer ? '700' : '500') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
        escapeHtml(r.pet.nickname || r.pet.pet_type || 'CPU') +
      '</div>' +
      '<div style="flex:1;background:rgba(0,0,0,0.08);border-radius:20px;height:18px;overflow:hidden;">' +
        '<div id="race-bar-' + i + '" style="height:100%;width:0%;background:' + (isPlayer ? 'linear-gradient(90deg,#9966ff,#ff66cc)' : 'linear-gradient(90deg,#aaa,#ccc)') + ';border-radius:20px;transition:width 0.05s linear;"></div>' +
      '</div>' +
      '<div id="race-pos-' + i + '" style="width:24px;font-size:0.78rem;color:var(--text-light);text-align:right;"></div>' +
    '</div>';
  }).join('');

  area.innerHTML =
    '<div id="race-track" style="padding:8px 0;">' +
      '<div style="text-align:center;font-weight:700;font-size:0.9rem;color:var(--purple-dark);margin-bottom:12px;animation:pulse 0.5s ease infinite alternate;">🏁 RACE IN PROGRESS…</div>' +
      lanesHtml +
    '</div>';
}

// ── Animation engine ──────────────────────────────────────────────────────
function race_animate(runners) {
  return new Promise(function(resolve) {
    var finishCount = 0;
    var order = 1;
    var TICK = 50; // ms per frame

    function frame() {
      var allDone = true;
      runners.forEach(function(r, i) {
        if (r.finished) return;
        allDone = false;
        r.progress += r.speed * (0.8 + Math.random() * 0.4);
        if (r.progress >= 100) {
          r.progress = 100;
          r.finished = true;
          r.finishOrder = order++;
          var posEl = document.getElementById('race-pos-' + i);
          if (posEl) posEl.textContent = r.finishOrder === 1 ? '🥇' : r.finishOrder === 2 ? '🥈' : r.finishOrder === 3 ? '🥉' : '4️⃣';
        }
        var bar = document.getElementById('race-bar-' + i);
        if (bar) bar.style.width = Math.min(100, r.progress) + '%';
      });
      if (allDone) { resolve(); return; }
      // Fill in finishOrder for any still at progress<100 that should be last
      runners.forEach(function(r) { if (!r.finished) r.finishOrder = order; });
      setTimeout(frame, TICK);
    }
    frame();
  });
}

// ── Results UI ────────────────────────────────────────────────────────────
function race_renderResults(runners, payout, playerBest) {
  var area = document.getElementById('racing-race-area') || document.getElementById('race-area');
  if (!area) return;

  var winner = runners[0];
  var playerWon = playerBest && playerBest.finishOrder === 1;
  var playerPlace = playerBest ? playerBest.finishOrder : null;

  var placeText = playerPlace === 1 ? '\ud83e\udd47 1st Place!' :
                  playerPlace === 2 ? '\ud83e\udd48 2nd Place' :
                  playerPlace === 3 ? '\ud83e\udd49 3rd Place' :
                  playerPlace === 4 ? '4\ufe0f\u20e3 4th Place' : 'No player entry';

  var outcomeColor = payout > raceState.bet ? '#5dde7a' : payout > 0 ? '#fbbf24' : '#ff6b6b';
  var netChange = payout - raceState.bet;
  var netText = netChange > 0 ? '+' + netChange + ' PP' : netChange === 0 ? 'Break even' : netChange + ' PP';

  var resultRows = runners.map(function(r, i) {
    var medals = ['\ud83e\udd47','\ud83e\udd48','\ud83e\udd49','4\ufe0f\u20e3'];
    var isPlayer = !r.pet.isCpu;
    var spdVal = r.speed.toFixed(1);
    var spdColor = r.speed > 8 ? '#4ade80' : r.speed > 5 ? '#fbbf24' : '#ff9966';
    return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid rgba(153,102,255,0.08);' +
      (isPlayer ? 'font-weight:700;' : '') + '">' +
      '<span style="font-size:1.1rem;">' + (medals[i] || (i+1)+'.') + '</span>' +
      '<span style="font-size:0.9rem;flex:1;color:' + (isPlayer ? 'var(--purple-dark)' : 'var(--text-light)') + ';">' +
        escapeHtml(r.pet.nickname || r.pet.pet_type || 'CPU') + (isPlayer ? ' (You)' : '') +
      '</span>' +
      '<span style="font-size:0.78rem;color:' + spdColor + ';font-weight:700;">\ud83d\udca8 ' + spdVal + '</span>' +
    '</div>';
  }).join('');

  // Generate the richer multi-racer log (now references all runners, not just the player)
  var logLines = race_generateLog(runners, playerBest, playerWon, playerPlace);

  area.innerHTML =
    '<div style="padding:4px;">' +
      // Race log (animated) — results stay hidden until this finishes
      '<div style="background:rgba(0,0,0,0.07);border-radius:12px;padding:12px 14px;margin-bottom:14px;">' +
        '<div style="font-weight:700;font-size:0.8rem;color:var(--purple-dark);margin-bottom:8px;letter-spacing:1px;">\ud83c\udfc1 RACE LOG</div>' +
        '<div id="race-log-entries" style="font-size:0.82rem;color:var(--text-light);line-height:1.7;min-height:60px;max-height:280px;overflow-y:auto;"></div>' +
      '</div>' +
      // Results — hidden until the log finishes playing out
      '<div id="race-results-block" style="display:none;">' +
        '<div style="text-align:center;margin-bottom:14px;">' +
          '<div style="font-size:2rem;">' + (playerWon ? '\ud83c\udf89' : '\ud83d\ude24') + '</div>' +
          '<div style="font-weight:800;font-size:1.05rem;color:var(--purple-dark);">' + placeText + '</div>' +
          '<div style="font-size:1.5rem;font-weight:800;color:' + outcomeColor + ';margin:6px 0;">' + netText + '</div>' +
          (payout > 0 ? '<div style="font-size:0.8rem;color:var(--text-light);">Payout: ' + payout + ' PP</div>' : '') +
        '</div>' +
        '<div style="margin-bottom:14px;">' + resultRows + '</div>' +
        '<div style="display:flex;gap:8px;">' +
          '<button class="btn btn-primary" onclick="race_init()" style="flex:1;">' +
            (raceState.racesLeft > 0 ? '\ud83c\udfc1 Race Again! (' + raceState.racesLeft + ' left)' : '\ud83c\udfc1 Come back tomorrow!') +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  // Animate the log progressively — slower pace (~950ms/line) so a full race log
  // runs roughly 10-13 seconds. Results block only appears once the log finishes.
  var logEl = document.getElementById('race-log-entries');
  if (!logEl) return;
  var idx = 0;
  var interval = safeSetInterval(function() {
    if (idx >= logLines.length) {
      clearInterval(interval);
      var resultsBlock = document.getElementById('race-results-block');
      if (resultsBlock) {
        resultsBlock.style.display = 'block';
        resultsBlock.style.animation = 'fadeIn 0.5s ease';
      }
      return;
    }
    var line = document.createElement('div');
    line.textContent = logLines[idx];
    line.style.cssText = 'animation:fadeIn 0.3s ease;border-bottom:1px solid rgba(153,102,255,0.08);padding:3px 0;' +
      (idx === logLines.length - 1 ? 'font-weight:700;color:' + outcomeColor + ';' : '');
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
    idx++;
  }, 950);
}

function race_generateLog(runners, playerBest, playerWon, playerPlace) {
  var pName = playerBest ? (playerBest.pet.nickname || playerBest.pet.pet_type || 'Your pet') : 'Your pet';
  // Names of the other racers, in their finishing order, excluding the player
  var others = runners.filter(function(r) { return playerBest ? r.pet !== playerBest.pet : true; })
                      .map(function(r) { return r.pet.nickname || r.pet.pet_type || 'Rival'; });
  var rival1 = others[0] || 'a rival';
  var rival2 = others[1] || 'another racer';
  var rival3 = others[2] || 'the pack';

  var lines = [];
  lines.push('\ud83c\udfc1 THE GATES OPEN! ' + pName + ', ' + rival1 + ', ' + rival2 + ', and ' + rival3 + ' burst onto the track!');

  var openers = [
    pName + ' gets a quick jump off the line!',
    rival1 + ' shoots ahead early, setting a blistering pace!',
    'A tight scramble at the first turn \u2014 everyone\'s neck and neck!',
    pName + ' stumbles slightly at the start but quickly recovers!'
  ];
  lines.push(openers[Math.floor(Math.random() * openers.length)]);

  lines.push('Lap 1: ' + rival2 + ' settles into a steady rhythm near the front of the pack.');

  if (playerWon) {
    lines.push(pName + ' finds another gear and surges toward the lead!');
    lines.push(rival1 + ' tries to match the pace, but can\'t quite keep up!');
    lines.push('Lap 2: ' + pName + ' is pulling away \u2014 the gap is growing!');
    lines.push(rival3 + ' stumbles on a rough patch of track, losing precious ground!');
    lines.push(rival2 + ' digs in for a late charge, but it may be too little too late!');
    lines.push('Final lap: ' + pName + ' rounds the last bend with a commanding lead!');
    lines.push('The crowd is on their feet as ' + pName + ' barrels toward the finish!');
    lines.push('It\'s not even close anymore \u2014 ' + pName + ' has this one in the bag!');
    lines.push('\ud83c\udf89 ' + pName + ' CROSSES THE LINE FIRST! VICTORY!! \ud83c\udfc6');
  } else if (playerPlace === 2) {
    lines.push(rival1 + ' edges out front, but ' + pName + ' refuses to fall back!');
    lines.push('Lap 2: It\'s a two-pet battle at the front \u2014 ' + pName + ' and ' + rival1 + ' trade the lead!');
    lines.push(rival3 + ' fades off the pace, unable to keep up with the leaders.');
    lines.push(pName + ' makes a bold move on the final turn!');
    lines.push('So close! ' + pName + ' draws level with ' + rival1 + ' down the home stretch!');
    lines.push('Final lap: ' + rival1 + ' just barely holds on as both racers give everything!');
    lines.push('A photo finish \u2014 but ' + rival1 + ' crosses first by a whisker!');
    lines.push('\ud83e\udd48 ' + pName + ' takes 2nd place! What a race that was!');
  } else if (playerPlace === 3) {
    lines.push(rival1 + ' and ' + rival2 + ' break away early, leaving the rest to fight for the podium.');
    lines.push('Lap 2: ' + pName + ' is stuck in traffic, looking for a gap to exploit!');
    lines.push(rival3 + ' clips the rail and loses momentum \u2014 chance opens up!');
    lines.push(pName + ' seizes the opening and surges into 3rd!');
    lines.push('A tense battle for the final podium spot down the back stretch!');
    lines.push('Final lap: ' + pName + ' holds firm as ' + rival3 + ' tries one last desperate push!');
    lines.push('It\'s tight, but ' + pName + ' has just enough to seal the spot!');
    lines.push('\ud83e\udd49 ' + pName + ' secures 3rd place! A hard-fought podium finish!');
  } else {
    lines.push(rival1 + ' and ' + rival2 + ' tear off into the distance, well ahead of the pack.');
    lines.push('Lap 2: ' + pName + ' is giving it everything, but the gap keeps growing.');
    lines.push(pName + ' stumbles trying to make up ground, losing a step!');
    lines.push(rival3 + ' also fades back, leaving ' + pName + ' to battle for pride alone.');
    lines.push('Final lap: ' + pName + ' digs deep for one last effort down the home stretch!');
    lines.push('It won\'t be enough to catch the leaders today, but ' + pName + ' never lets up!');
    lines.push('\ud83d\udcaa ' + pName + ' crosses the line in last place. Tough one \u2014 better luck next time!');
  }

  return lines;
}

// ═══════════════════════════════════════════════════════════════════════════

var PERSONALITIES = [
  { key:'playful',  icon:'🎾', label:'Playful',  line:'"Wanna play! Let\'s do something fun!"' },
  { key:'grumpy',   icon:'😾', label:'Grumpy',   line:'"Fine... I guess."' },
  { key:'curious',  icon:'🔍', label:'Curious',  line:'"What\'s that over there?!"' },
  { key:'brave',    icon:'🦁', label:'Brave',    line:'"I\'m not scared of anything!"' },
  { key:'sleepy',   icon:'😴', label:'Sleepy',   line:'"Five more minutes, please..."' },
  { key:'hungry',   icon:'🍕', label:'Hungry',   line:'"Got any snacks? I\'m STARVING."' },
  { key:'sassy',    icon:'💅', label:'Sassy',    line:'"Whatever. I look amazing anyway."' }
];

var WISH_POOL = [
  { key:'feed',         text:'wants a yummy meal!',         action:'feed',        reward:25 },
  { key:'play',         text:'wants to play right now!',    action:'play',        reward:30 },
  { key:'win_battle',   text:'wants to WIN a battle!',      action:'win_battle',  reward:50 },
  { key:'visit_shop',   text:'wants to visit the shop!',    action:'visit_shop',  reward:20 },
  { key:'use_toy',      text:'wants to play with a toy!',   action:'use_toy',     reward:35 },
  { key:'take_snapshot',text:'wants a glamour shot! 📸',    action:'take_snapshot',reward:25 },
  { key:'view_profile', text:'wants to check the profile!', action:'view_profile', reward:15 }
];

// In-memory cache: { petId: { personality, wishes, completedWishes, date } }
var petMoodCache = {};

// Load (or generate) today's mood for a pet
async function personality_loadMood(petId) {
  if (!petId || typeof petId !== 'string') return null;
  var today = new Date().toISOString().slice(0, 10);

  // Return from cache if same day
  if (petMoodCache[petId] && petMoodCache[petId].date === today) {
    return petMoodCache[petId];
  }

  // Try DB first
  var { data: row } = await supabaseClient
    .from('pet_daily_moods')
    .select('*')
    .eq('pet_id', petId)
    .eq('date', today)
    .single();

  if (row) {
    var parsedWishes = row.wishes
      ? (typeof row.wishes === 'string' ? JSON.parse(row.wishes) : row.wishes)
      : [];
    var parsedCompleted = row.completed_wishes
      ? (typeof row.completed_wishes === 'string' ? JSON.parse(row.completed_wishes) : row.completed_wishes)
      : [];
    petMoodCache[petId] = {
      date: today,
      personality: row.personality,
      wishes: parsedWishes,
      completedWishes: parsedCompleted,
      rewardClaimed: row.reward_claimed || false
    };
    return petMoodCache[petId];
  }

  // Generate new mood for today
  var personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)].key;
  var shuffled = WISH_POOL.slice().sort(function() { return Math.random() - 0.5; });
  var wishes = shuffled.slice(0, 3).map(function(w) { return { key: w.key, text: w.text, action: w.action, reward: w.reward }; });

  // Save to DB — use insert with fallback update for better 403/duplicate handling
  var safeWishes = (wishes && wishes.length) ? wishes : [];
  var wishesForDb = JSON.stringify(safeWishes.map(function(w) {
    return {
      key:    String(w.key    || ''),
      text:   String(w.text   || ''),
      action: String(w.action || ''),
      reward: Number(w.reward) || 10
    };
  }));
  var safePersonality = personality || 'playful';

  var { error: insertErr } = await supabaseClient
    .from('pet_daily_moods')
    .insert({
      pet_id:           petId,
      date:             today,
      personality:      safePersonality,
      wishes:           wishesForDb,
      completed_wishes: '[]',
      reward_claimed:   false
    });

  // If duplicate (already exists today), update instead
  if (insertErr && insertErr.code === '23505') {
    var { error: updateErr } = await supabaseClient
      .from('pet_daily_moods')
      .update({
        personality:      safePersonality,
        wishes:           wishesForDb,
        completed_wishes: '[]',
        reward_claimed:   false
      })
      .eq('pet_id', petId)
      .eq('date',   today);
    if (updateErr) dbg('[Mood] Update fallback error:', updateErr);
  } else if (insertErr) {
    dbg('[Mood] Insert error:', insertErr);
  }

  petMoodCache[petId] = { date: today, personality: personality, wishes: wishes, completedWishes: [], rewardClaimed: false };
  return petMoodCache[petId];
}

// Mark a wish action as complete for a pet
async function personality_completeWish(petId, actionKey) {
  if (!currentUser) return;
  var mood = petMoodCache[petId];
  if (!mood) return;

  var wish = mood.wishes.find(function(w) { return w.action === actionKey && mood.completedWishes.indexOf(w.key) === -1; });
  if (!wish) return; // no matching unfinished wish

  mood.completedWishes.push(wish.key);

  // Award wish reward
  await awardPP(wish.reward, 'wish_' + wish.key);
  showToast('🎯 Wish completed: ' + wish.text + ' +' + wish.reward + ' PP!', 3500);

  // Persist to DB — serialize array as JSON string for JSONB column
  await supabaseClient.from('pet_daily_moods')
    .update({ completed_wishes: JSON.stringify(mood.completedWishes) })
    .eq('pet_id', petId)
    .eq('date', mood.date);

  // Refresh the wish widget on the card
  personality_renderWidget(petId);

  // All 3 wishes done? Award bonus
  if (mood.completedWishes.length === 3 && !mood.rewardClaimed) {
    mood.rewardClaimed = true;
    await supabaseClient.from('pet_daily_moods')
      .update({ reward_claimed: true })
      .eq('pet_id', petId)
      .eq('date', mood.date);
    await awardPP(100, 'all_wishes_bonus');
    await addPassXP(25, 'all_wishes');
    showToast('🎉 All wishes complete! BONUS +100 PP & +25 Pass XP!', 5000);
  }
}

// Build and inject the mood/wish widget into an existing pet card
function personality_renderWidget(petId) {
  var mount = document.getElementById('mood-widget-' + petId);
  if (!mount) return;
  var mood = petMoodCache[petId];
  if (!mood) { mount.innerHTML = ''; return; }

  var pDef = PERSONALITIES.find(function(p) { return p.key === mood.personality; }) || PERSONALITIES[0];
  var allDone = mood.completedWishes.length >= mood.wishes.length;

  var wishRows = mood.wishes.map(function(w) {
    var done = mood.completedWishes.indexOf(w.key) !== -1;
    return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(153,102,255,0.08);">' +
      '<span style="font-size:1rem;">' + (done ? '✅' : '🔘') + '</span>' +
      '<span style="font-size:0.8rem;color:' + (done ? '#aaa' : 'var(--purple-dark)') + ';' + (done ? 'text-decoration:line-through;' : '') + '">' +
        pDef.icon + ' <em>' + escapeHtml(petState[petId] ? (petState[petId].nickname || 'Your pet') : 'Your pet') + '</em> ' + escapeHtml(w.text) +
      '</span>' +
      '<span style="margin-left:auto;font-size:0.75rem;color:#9966ff;font-weight:600;">+' + w.reward + ' PP</span>' +
    '</div>';
  }).join('');

  mount.innerHTML =
    '<div style="background:linear-gradient(135deg,rgba(153,102,255,0.08),rgba(255,102,204,0.05));border-radius:12px;border:1px solid rgba(153,102,255,0.2);padding:10px 12px;margin:8px 0;">' +
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">' +
        '<span style="font-size:1.2rem;">' + pDef.icon + '</span>' +
        '<span style="font-weight:700;font-size:0.85rem;color:var(--purple-dark);">' + pDef.label + ' Mood</span>' +
        (allDone ? '<span style="margin-left:auto;background:#5dde7a;color:white;padding:2px 8px;border-radius:20px;font-size:0.7rem;font-weight:700;">ALL DONE! 🎉</span>' : '') +
      '</div>' +
      '<div style="font-size:0.78rem;color:var(--text-light);font-style:italic;margin-bottom:8px;">' + pDef.line + '</div>' +
      '<div style="font-size:0.75rem;font-weight:600;color:#9966ff;margin-bottom:4px;">📋 Today\'s Wishes:</div>' +
      wishRows +
      (allDone && !mood.rewardClaimed
        ? '<div style="margin-top:8px;padding:6px 10px;background:rgba(93,222,122,0.15);border-radius:8px;font-size:0.78rem;color:#2d8a4e;font-weight:600;">🎁 Bonus ready: +100 PP, complete a wish to claim!</div>'
        : '') +
    '</div>';
}

// Global wish tracking — call this after any action
async function checkPetWishes(actionKey, petId) {
  if (!petId || !currentUser) return;
  await personality_completeWish(petId, actionKey);
}

async function feed(petId) {
  // Rate limiting
  if (!canPerformAction('feed_' + petId, 500)) {
    return;
  }
  
  var pet = petState[petId]; 
  if (!pet) {
    console.warn('feed(): no pet found in petState for id', petId, '- petState keys:', Object.keys(petState));
    return;
  }

  // Show loading state on button immediately so user knows click registered
  var feedBtnEl = document.getElementById('feed-' + petId);
  if (feedBtnEl) { feedBtnEl.textContent = '...'; feedBtnEl.disabled = true; }

  try {
  // Get user's food inventory
  var { data: inventory, error: invError } = await supabaseClient
    .from('user_inventory')
    .select('item_id, quantity, items(id, name, hunger_effect, happiness_effect, xp_effect, image_url, food_category)')
    .eq('user_id', currentUser.id)
    .gt('quantity', 0);
  
  if (invError) {
    showToast('Error loading inventory', 3000);
    if (feedBtnEl) { feedBtnEl.textContent = 'Feed'; feedBtnEl.disabled = false; }
    return;
  }
  
  // Filter to food items (items with hunger_effect > 0 or food_category)
  var foodItems = inventory ? inventory.filter(function(inv) {
    return inv.items && (
      (inv.items.hunger_effect && inv.items.hunger_effect > 0) ||
      inv.items.food_category ||
      inv.items.name.toLowerCase().includes('food') ||
      inv.items.name.toLowerCase().includes('ramen') ||
      inv.items.name.toLowerCase().includes('cake') ||
      inv.items.name.toLowerCase().includes('steak') ||
      inv.items.name.toLowerCase().includes('burger') ||
      inv.items.name.toLowerCase().includes('pie') ||
      inv.items.name.toLowerCase().includes('cookie') ||
      inv.items.name.toLowerCase().includes('juice') ||
      inv.items.name.toLowerCase().includes('smoothie')
    );
  }) : [];
  
  // Show picker modal with free option + food items
  var modal = makeModal();
  modal.innerHTML = '<h2 style="text-align:center;margin-bottom:20px;">🍽️ Feed Your Pet</h2>';
  
  var grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;max-height:400px;overflow-y:auto;';
  
  // FREE DAILY OPTION (Check if already used today)
  var today = new Date().toISOString().split('T')[0];
  var freeFeedKey = 'free_feed_' + petId + '_' + today;
  var freeUsed = localStorage.getItem(freeFeedKey) === 'done';
  
  var freeBtn = document.createElement('button');
  freeBtn.style.cssText = freeUsed ?
    'padding:15px;border:3px solid #ccc;background:#f0f0f0;border-radius:12px;cursor:not-allowed;opacity:0.6;' :
    'padding:15px;border:3px solid #5dde7a;background:linear-gradient(135deg, #5dde7a 0%, #4caf50 100%);border-radius:12px;cursor:pointer;transition:transform 0.2s;';
  
  freeBtn.innerHTML = freeUsed ?
    '<div style="font-size:2rem;">✅</div>' +
    '<div style="font-size:0.9rem;font-weight:700;margin-top:5px;color:#999;">Free Daily Treat</div>' +
    '<div style="font-size:0.75rem;color:#999;margin-top:3px;">Used Today!</div>' :
    '<div style="font-size:2rem;">✨</div>' +
    '<div style="font-size:0.9rem;font-weight:700;margin-top:5px;color:#fff;">Free Daily Treat</div>' +
    '<div style="font-size:0.75rem;color:#fff;margin-top:3px;">+30 Hunger +10 XP</div>';
  
  if (!freeUsed) {
    freeBtn.onmouseover = function() { this.style.transform = 'scale(1.05)'; };
    freeBtn.onmouseout = function() { this.style.transform = 'scale(1)'; };
    
    freeBtn.onclick = function() {
      closeModal();
      feedFree(petId);
    };
  }
  
  grid.appendChild(freeBtn);
  
  // FOOD ITEMS FROM INVENTORY
  foodItems.forEach(function(inv) {
    var item = inv.items;
    var btn = document.createElement('button');
    btn.style.cssText = 'padding:15px;border:3px solid #9966ff;background:white;border-radius:12px;cursor:pointer;transition:transform 0.2s;';
    
    // Try to show image or fallback to category icon
    var iconHtml = getItemIconHtml(item);
    
    btn.innerHTML = '<div style="font-size:2rem;min-height:48px;display:flex;align-items:center;justify-content:center;">' + iconHtml + '</div>' +
                    '<div style="font-size:0.8rem;font-weight:600;margin-top:5px;">' + item.name + '</div>' +
                    '<div style="font-size:0.7rem;color:#666;">x' + inv.quantity + '</div>';
    
    btn.onmouseover = function() { this.style.transform = 'scale(1.05)'; };
    btn.onmouseout = function() { this.style.transform = 'scale(1)'; };
    
    btn.onclick = function() {
      closeModal();
      feedWithItem(petId, item.id, item.name);
    };
    
    grid.appendChild(btn);
  });
  
  modal.appendChild(grid);
  
  // Show helpful message if no food items
  if (foodItems.length === 0) {
    var noItemsMsg = document.createElement('div');
    noItemsMsg.style.cssText = 'text-align:center;padding:20px;color:#666;font-size:0.9rem;';
    noItemsMsg.textContent = '💡 No food items in inventory. Buy some from the shop or use the free daily treat!';
    modal.appendChild(noItemsMsg);
  }
  
  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'margin-top:20px;padding:10px 20px;background:#ccc;border:none;border-radius:8px;cursor:pointer;display:block;margin-left:auto;margin-right:auto;';
  cancelBtn.onclick = closeModal;
  modal.appendChild(cancelBtn);
  
  // Restore button before showing modal
  if (feedBtnEl) { feedBtnEl.textContent = 'Feed'; feedBtnEl.disabled = false; }
  openModal(modal);

  } catch(err) {
    console.error('feed() error:', err);
    showToast('Error opening feed menu', 3000);
    if (feedBtnEl) { feedBtnEl.textContent = 'Feed'; feedBtnEl.disabled = false; }
  }
}

// FREE DAILY FEED - Called when clicking free option
async function feedFree(petId) {
  var pet = petState[petId];
  if (!pet) return;
  
  // FREE OPTION - Check daily limit
  var today = new Date().toISOString().split('T')[0];
  var freeFeedKey = 'free_feed_' + petId + '_' + today;
  
  if (localStorage.getItem(freeFeedKey) === 'done') {
    showFlash(petId, 'Free daily treat already used today!', '#ff9f43');
    return;
  }
  
  var btn = el('feed-'+petId); 
  if (btn) {
    btn.disabled = true; 
    btn.textContent = '...';
  }
  
  // Call RPC with null item_id for free feed
  var { data: result, error } = await supabaseClient.rpc('feed_pet_secure', {
    p_pet_id: petId,
    p_item_id: null
  });
  
  if (error) {
    console.error('Feed RPC error:', error);
    showFlash(petId, 'Error: ' + error.message, '#ff6eb4');
    if (btn) {
      btn.disabled = false; 
      btn.textContent = 'Feed';
    }
    return;
  }
  
  // Check for error in response
  if (result && result.error) {
    console.error('Feed error:', result.error);
    showFlash(petId, result.error, '#ff6eb4');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Feed';
    }
    return;
  }
  
  // JSONB response - direct object (not array)
  var feedResult = result;
  
  // MARK FREE OPTION AS USED FOR TODAY (after successful feed)
  localStorage.setItem(freeFeedKey, 'done');
  
  // PAWKETPASS: Update bingo progress for feeding
  updateBingoProgress('feed_pet', 1);
  await addPassXP(2, 'feed');
  
  // WISHES: check feed wish
  checkPetWishes('feed', petId).catch(function(){});
  progressQuestArc(petId, 'feed').catch(function(){});
  checkAchievementTierProgress('feed_count', petId, 1).catch(function(){});

  // JOURNAL: log food discovery
  if (typeof logJournalDiscovery === 'function') {
    var feedPet = petState[petId] || {};
    var feedPetType = feedPet.pet_type || (feedPet.pets && feedPet.pets.name) || null;
    if (feedPetType) {
      logJournalDiscovery(feedPetType, 'loved', '').catch(function(){});  // free feed, no item name
    }
  }
  
  // COMMUNITY GOALS: Track feeding
  community_increment('feed_pets', 1);
  
  // Update local state
  petState[petId].hunger = feedResult.hunger;
  petState[petId].happiness = feedResult.happiness;
  petState[petId].xp = feedResult.xp;
  
  updateBar(petId, 'hunger', feedResult.hunger, pet.max_hunger);
  updateBar(petId, 'happiness', feedResult.happiness, pet.max_happiness);
  updateXpBar(petId, feedResult.xp, pet.level);
  
  if (feedResult.leveled_up) {
    petState[petId].level = feedResult.new_level;
    showFlash(petId, 'Level ' + feedResult.new_level + '! 🎉', '#b06aff');
    updateLvl(petId, feedResult.new_level, pet.max_hunger);
    tabsLoaded['mypets'] = false;
    
    if (feedResult.new_level === 5) await awardBadge('level_5');
    if (feedResult.new_level === 10) await awardBadge('level_10');
    if (feedResult.new_level === 20) await awardBadge('level_20');
  } else {
    showFlash(petId, '✨ +' + feedResult.hunger_gained + ' Hunger +' + feedResult.xp_gained + ' XP', '#5dde7a');
  }
  
  // Re-enable button for next use
  if (btn) {
    btn.textContent = 'Feed';
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

// FEED WITH SPECIFIC FOOD ITEM - Called when clicking a food item
async function feedWithItem(petId, itemId, itemName) {
  if (!canPerformAction('feed_' + petId, 500)) return;
  var pet = petState[petId];
  if (!pet) return;
  
  // Call RPC with the item_id
  var { data: result, error } = await supabaseClient.rpc('feed_pet_secure', {
    p_pet_id: petId,
    p_item_id: itemId
  });
  
  if (error) {
    console.error('Feed with item error:', error);
    showFlash(petId, 'Error: ' + error.message, '#ff6eb4');
    return;
  }
  
  // Check for error in response
  if (result && result.error) {
    console.error('Feed error:', result.error);
    showFlash(petId, result.error, '#ff6eb4');
    return;
  }
  
  // JSONB response - direct object (not array)
  var feedResult = result;
  
  // PAWKETPASS: Update bingo and Pass XP
  updateBingoProgress('feed_pet', 1);
  await addPassXP(2, 'feed');
  
  // COMMUNITY GOALS: Track feeding
  community_increment('feed_pets', 1);
  
  // Check if using treat for bingo and community
  if (itemId === 'treat' || itemId === 'premium_treat') {
    updateBingoProgress('use_treat', 1);
    community_increment('use_treats', 1);
  }
  
  // Update local state
  petState[petId].hunger = feedResult.hunger;
  petState[petId].happiness = feedResult.happiness;
  petState[petId].xp = feedResult.xp;
  
  updateBar(petId, 'hunger', feedResult.hunger, pet.max_hunger);
  updateBar(petId, 'happiness', feedResult.happiness, pet.max_happiness);
  updateXpBar(petId, feedResult.xp, pet.level);
  
  if (feedResult.leveled_up) {
    petState[petId].level = feedResult.new_level;
    showFlash(petId, 'Level ' + feedResult.new_level + '! 🎉', '#b06aff');
    updateLvl(petId, feedResult.new_level, pet.max_hunger);
    tabsLoaded['mypets'] = false;
  }
  
  // Show reaction based on food preference
  var reactionType = feedResult.reaction_type || 'normal';
  var reactionMsg = '';
  
  if (reactionType === 'loved') {
    reactionMsg = '💖 ' + escapeHtml(itemName) + '! (1.75x bonus!)';
    // SCRAPBOOK: Favorite food discovered
    scrapbook_addMemory(petId, 'favorite_food', { food: itemName });
  } else if (reactionType === 'liked') {
    reactionMsg = '😊 ' + escapeHtml(itemName) + '! (1.25x bonus)';
  } else if (reactionType === 'disliked') {
    reactionMsg = '😐 ' + escapeHtml(itemName) + '... (0.75x effect)';
  } else if (reactionType === 'hated') {
    reactionMsg = '😖 Ew, ' + escapeHtml(itemName) + '! (0.5x effect)';
  } else {
    reactionMsg = '🍽️ Ate ' + escapeHtml(itemName) + '!';
  }
  
  if (feedResult.hunger_gained || feedResult.happiness_gained || feedResult.xp_gained) {
    var effects = [];
    if (feedResult.hunger_gained) effects.push('+' + feedResult.hunger_gained + ' Hunger');
    if (feedResult.happiness_gained) effects.push('+' + feedResult.happiness_gained + ' Happiness');
    if (feedResult.xp_gained) effects.push('+' + feedResult.xp_gained + ' XP');
    reactionMsg += ' ' + effects.join(', ');
  }
  
  showFlash(petId, reactionMsg, reactionType === 'loved' ? '#ff66cc' : reactionType === 'hated' ? '#999' : '#5dde7a');
  
  // Reload inventory and pets to reflect item usage
  tabsLoaded['mypets'] = false;
  loadInventory();
}

async function play(petId) {
  // Rate limiting
  if (!canPerformAction('play_' + petId, 500)) {
    return;
  }
  
  var pet = petState[petId]; 
  if (!pet) {
    console.warn('play(): no pet found in petState for id', petId, '- petState keys:', Object.keys(petState));
    return;
  }

  // Show loading state on button immediately
  var playBtnEl = document.getElementById('play-' + petId);
  if (playBtnEl) { playBtnEl.textContent = '...'; playBtnEl.disabled = true; }

  try {
  // Get user's toy inventory
  var { data: inventory, error: invError } = await supabaseClient
    .from('user_inventory')
    .select('item_id, quantity, items(id, name, item_type, image_url)')
    .eq('user_id', currentUser.id)
    .gt('quantity', 0);
  
  if (invError) {
    showToast('Error loading inventory', 3000);
    if (playBtnEl) { playBtnEl.textContent = 'Play'; playBtnEl.disabled = false; }
    return;
  }
  
  // Filter to toy/fun items
  var toyItems = inventory ? inventory.filter(function(inv) {
    return inv.items && inv.items.item_type && 
           (inv.items.item_type.toLowerCase() === 'toy' ||
            inv.items.item_type.toLowerCase() === 'fun' ||
            inv.items.name.toLowerCase().includes('toy') ||
            inv.items.name.toLowerCase().includes('ball') ||
            inv.items.name.toLowerCase().includes('frisbee') ||
            inv.items.name.toLowerCase().includes('game'));
  }) : [];
  
  // Show picker modal with free option + toy items
  var modal = makeModal();
  modal.innerHTML = '<h2 style="text-align:center;margin-bottom:20px;">🎮 Play With Your Pet</h2>';
  
  var grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;max-height:400px;overflow-y:auto;';
  
  // FREE DAILY OPTION (Check if already used today AND has energy)
  var today = new Date().toISOString().split('T')[0];
  var freePlayKey = 'free_play_' + petId + '_' + today;
  var freeUsed = localStorage.getItem(freePlayKey) === 'done';
  var hasEnergy = pet.energy >= 10;
  
  var freeBtn = document.createElement('button');
  
  // Determine button style based on status
  if (freeUsed) {
    // Already used today
    freeBtn.style.cssText = 'padding:15px;border:3px solid #ccc;background:#f0f0f0;border-radius:12px;cursor:not-allowed;opacity:0.6;';
  } else if (!hasEnergy) {
    // Not enough energy
    freeBtn.style.cssText = 'padding:15px;border:3px solid #ccc;background:#f5f5f5;border-radius:12px;cursor:not-allowed;opacity:0.6;';
  } else {
    // Available!
    freeBtn.style.cssText = 'padding:15px;border:3px solid #ff9f43;background:linear-gradient(135deg, #ff9f43 0%, #ffa726 100%);border-radius:12px;cursor:pointer;transition:transform 0.2s;';
  }
  
  // Set button content
  if (freeUsed) {
    freeBtn.innerHTML = '<div style="font-size:2rem;">✅</div>' +
                    '<div style="font-size:0.9rem;font-weight:700;margin-top:5px;color:#999;">Free Playtime</div>' +
                    '<div style="font-size:0.75rem;color:#999;margin-top:3px;">Used Today!</div>';
  } else if (!hasEnergy) {
    freeBtn.innerHTML = '<div style="font-size:2rem;">🎾</div>' +
                    '<div style="font-size:0.9rem;font-weight:700;margin-top:5px;color:#999;">Free Playtime</div>' +
                    '<div style="font-size:0.75rem;color:#999;margin-top:3px;">Need 10 Energy</div>';
  } else {
    freeBtn.innerHTML = '<div style="font-size:2rem;">🎾</div>' +
                    '<div style="font-size:0.9rem;font-weight:700;margin-top:5px;color:#fff;">Free Playtime</div>' +
                    '<div style="font-size:0.75rem;color:#fff;margin-top:3px;">+15 Happiness +15 XP</div>';
  }
  
  // Only enable if not used and has energy
  if (!freeUsed && hasEnergy) {
    freeBtn.onmouseover = function() { this.style.transform = 'scale(1.05)'; };
    freeBtn.onmouseout = function() { this.style.transform = 'scale(1)'; };
    
    freeBtn.onclick = function() {
      closeModal();
      playFree(petId);
    };
  }
  
  grid.appendChild(freeBtn);
  
  // TOY ITEMS FROM INVENTORY
  toyItems.forEach(function(inv) {
    var item = inv.items;
    var btn = document.createElement('button');
    btn.style.cssText = 'padding:15px;border:3px solid #9966ff;background:white;border-radius:12px;cursor:pointer;transition:transform 0.2s;';
    
    // Try to show image or fallback to category icon
    var iconHtml = getItemIconHtml(item);
    
    btn.innerHTML = '<div style="font-size:2rem;min-height:48px;display:flex;align-items:center;justify-content:center;">' + iconHtml + '</div>' +
                    '<div style="font-size:0.8rem;font-weight:600;margin-top:5px;">' + item.name + '</div>' +
                    '<div style="font-size:0.7rem;color:#666;">x' + inv.quantity + '</div>';
    
    btn.onmouseover = function() { this.style.transform = 'scale(1.05)'; };
    btn.onmouseout = function() { this.style.transform = 'scale(1)'; };
    
    btn.onclick = function() {
      closeModal();
      playWithToy(petId, item.id, item.name);
    };
    
    grid.appendChild(btn);
  });
  
  modal.appendChild(grid);
  
  // Show helpful message if no toy items
  if (toyItems.length === 0) {
    var noItemsMsg = document.createElement('div');
    noItemsMsg.style.cssText = 'text-align:center;padding:20px;color:#666;font-size:0.9rem;';
    noItemsMsg.textContent = '💡 No toys in inventory. Buy some from the shop or use free playtime!';
    modal.appendChild(noItemsMsg);
  }
  
  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'margin-top:20px;padding:10px 20px;background:#ccc;border:none;border-radius:8px;cursor:pointer;display:block;margin-left:auto;margin-right:auto;';
  cancelBtn.onclick = closeModal;
  modal.appendChild(cancelBtn);
  
  // Restore button before showing modal
  if (playBtnEl) { playBtnEl.textContent = 'Play'; playBtnEl.disabled = false; }
  openModal(modal);

  } catch(err) {
    console.error('play() error:', err);
    showToast('Error opening play menu', 3000);
    if (playBtnEl) { playBtnEl.textContent = 'Play'; playBtnEl.disabled = false; }
  }
}

// FREE DAILY PLAY
async function playFree(petId) {
  var pet = petState[petId];
  if (!pet || pet.energy < 10) return;
  
  // FREE OPTION - Check daily limit
  var today = new Date().toISOString().split('T')[0];
  var freePlayKey = 'free_play_' + petId + '_' + today;
  
  if (localStorage.getItem(freePlayKey) === 'done') {
    showFlash(petId, 'Free playtime already used today!', '#ff9f43');
    return;
  }

  var btn = document.getElementById('play-' + petId);
  if (btn) { btn.disabled = true; btn.textContent = '...'; }

  try {
    var { data: result, error } = await supabaseClient.rpc('play_with_pet_secure', {
      p_pet_id: petId,
      p_item_id: null
    });

    if (error) {
      console.error('Play RPC error:', error);
      showFlash(petId, 'Error: ' + error.message, '#ff6eb4');
      return;
    }

    if (result && result.error) {
      showFlash(petId, result.error, '#ff6eb4');
      return;
    }

    // MARK FREE OPTION AS USED FOR TODAY (after successful play)
    localStorage.setItem(freePlayKey, 'done');

    // PAWKETPASS: Update bingo and Pass XP
    updateBingoProgress('play_pet', 1);
    await addPassXP(2, 'play');

    // WISHES: check play wish
    checkPetWishes('play', petId).catch(function(){});
    progressQuestArc(petId, 'play').catch(function(){});
    checkAchievementTierProgress('play_count', petId, 1).catch(function(){});
    petState[petId].happiness = result.happiness;
    petState[petId].xp = result.xp;

    updateBar(petId, 'energy', result.energy, pet.max_energy);
    updateBar(petId, 'happiness', result.happiness, pet.max_happiness);
    updateXpBar(petId, result.xp, pet.level);

    if (result.leveled_up) {
      petState[petId].level = result.new_level;
      showFlash(petId, 'Level ' + result.new_level + '! 🎉', '#b06aff');
      updateLvl(petId, result.new_level, pet.max_hunger);
      tabsLoaded['mypets'] = false;

      if (result.new_level === 5) await awardBadge('level_5');
      if (result.new_level === 10) await awardBadge('level_10');
      if (result.new_level === 20) await awardBadge('level_20');
    } else {
      var hapGained = result.happiness_gained !== undefined ? result.happiness_gained : 15;
    showFlash(petId, '🎾 -10 Energy +' + hapGained + ' Happiness +' + (result.xp_gained || 15) + ' XP', '#5dde7a');
    }

  } catch (err) {
    console.error('Play error:', err);
    showFlash(petId, 'Error: ' + err.message, '#ff6eb4');
  } finally {
    if (btn) { btn.textContent = 'Play'; btn.disabled = false; }
  }
}

// PLAY WITH TOY ITEM
async function playWithToy(petId, toyId, toyName) {
  if (!canPerformAction('play_' + petId, 500)) return;
  var pet = petState[petId];
  if (!pet || pet.energy < 5) {
    showFlash(petId, 'Not enough energy!', '#ff6eb4');
    return;
  }
  
  // Call RPC to play with toy
  var { data: result, error } = await supabaseClient.rpc('play_with_pet_secure', {
    p_pet_id: petId,
    p_item_id: toyId
  });
  
  if (error) {
    showFlash(petId, 'Error: ' + error.message, '#ff6eb4');
    return;
  }
  
  // Check for error in response
  if (result && result.error) {
    console.error('Play with toy error:', result.error);
    showFlash(petId, result.error, '#ff6eb4');
    return;
  }
  
  // Update local state (JSONB returns direct object)
  petState[petId].energy = result.energy;
  petState[petId].happiness = result.happiness;
  petState[petId].xp = result.xp;
  
  // PAWKETPASS: Update bingo and Pass XP
  updateBingoProgress('play_pet', 1);
  updateBingoProgress('use_toy', 1);
  await addPassXP(2, 'play');
  
  // WISHES: check play and use_toy wishes
  checkPetWishes('play', petId).catch(function(){});
  checkPetWishes('use_toy', petId).catch(function(){});
  updateBar(petId, 'happiness', result.happiness, pet.max_happiness);
  updateXpBar(petId, result.xp, pet.level);
  
  if (result.leveled_up) {
    petState[petId].level = result.new_level;
    showFlash(petId, 'Level ' + result.new_level + '! 🎉', '#b06aff');
    updateLvl(petId, result.new_level, pet.max_hunger);
    tabsLoaded['mypets'] = false;
  } else {
    showFlash(petId, '🎮 Played with ' + escapeHtml(toyName) + '! +20 Happiness +10 XP', '#5dde7a');
  }
}

function updateBar(petId,stat,val,max) {
  var pct=Math.round(val/max*100);
  var b=el(stat+'-bar-'+petId); if(b)b.style.width=pct+'%';
  var v=el(stat+'-val-'+petId); if(v)v.textContent=val+'/'+max;
}
function updateXpBar(petId,xp,level) {
  var next=level*(typeof GAME_CONSTANTS!=='undefined'?GAME_CONSTANTS.XP_PER_LEVEL:120);
  var pct=Math.min(xp/next*100,100);
  var b=el('xp-bar-'+petId); if(b)b.style.width=pct+'%';
  var v=el('xp-val-'+petId); if(v)v.textContent=xp+'/'+next;
}
function updateLvl(petId,level,maxH) {
  var e=el('lvl-'+petId); if(e)e.textContent='Lv. '+level+' | Max: '+maxH;
}
function showFlash(petId,msg,color) {
  var e=el('flash-'+petId); if(!e)return;
  e.textContent=msg; e.style.color=color||'var(--green)'; e.style.opacity='1';
  setTimeout(function(){e.style.opacity='0';},2800);
}

// ── Cloudflare Worker Integration ─────────────────────────────────────────
// Worker handles: chat PP rewards, follow rewards, sub rewards, bit rewards
var WORKER_URL = 'https://pawketpets-twitch.pawketpetsvt.workers.dev';

async function checkTwitchRewards() {
  if (!currentUser) return;
  try {
    var pr = await supabaseClient
      .from('players')
      .select('twitch_id')
      .eq('id', currentUser.id)
      .single();
    if (!pr.data || !pr.data.twitch_id) return;
    var twitchId = pr.data.twitch_id;

    var res = await fetch(WORKER_URL + '/api/rewards?twitch_id=' + twitchId, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) return;
    var rewards = await res.json();
    if (!Array.isArray(rewards) || rewards.length === 0) return;

    for (var i = 0; i < rewards.length; i++) {
      var reward = rewards[i];
      if (reward.claimed) continue;
      await awardPP(reward.amount, 'twitch_' + reward.type);
      showTwitchRewardNotification(reward);
      // Also log to bell notification center
      createNotification(currentUser.id, 'twitch_reward', '🎬 Twitch Reward!',
        '+' + reward.amount + ' PP for ' + reward.reason, 'tab:twitch').catch(function(){});
      // Mark claimed
      await fetch(WORKER_URL + '/api/rewards/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reward_id: reward.id, twitch_id: twitchId })
      }).catch(function(){});
    }
  } catch(e) { dbg('Twitch rewards check failed:', e); }
}

function showTwitchRewardNotification(reward) {
  var notif = document.createElement('div');
  notif.className = 'twitch-reward-notification';
  notif.innerHTML =
    '<div class="reward-notif-icon">🎬</div>' +
    '<div class="reward-notif-content">' +
      '<div class="reward-notif-title">Twitch Reward!</div>' +
      '<div class="reward-notif-text">+' + reward.amount + ' PP for ' + escapeHtml(reward.reason) + '</div>' +
      '<div class="reward-notif-sub">Keep chatting for more rewards!</div>' +
    '</div>';
  document.body.appendChild(notif);
  // Slide in
  setTimeout(function() { notif.classList.add('show'); }, 10);
  // Slide out and remove
  setTimeout(function() {
    notif.classList.remove('show');
    setTimeout(function() { if (notif.parentNode) notif.parentNode.removeChild(notif); }, 400);
  }, 5000);
}

async function loadTwitchStats() {
  if (!currentUser) return;
  var panel = document.getElementById('twitch-stats-panel');
  if (!panel) return;
  try {
    var pr = await supabaseClient
      .from('players')
      .select('twitch_id, twitch_follow_rewards')
      .eq('id', currentUser.id)
      .single();
    if (!pr.data || !pr.data.twitch_id) return;

    var res = await fetch(WORKER_URL + '/api/rewards/stats?twitch_id=' + pr.data.twitch_id);
    if (!res.ok) return;
    var stats = await res.json();

    var ppEl   = document.getElementById('twitch-pp-earned');
    var chatEl = document.getElementById('twitch-chats');
    var fwEl   = document.getElementById('twitch-follows');
    var subEl  = document.getElementById('twitch-subs');

    if (ppEl)   ppEl.textContent   = (stats.total_pp_earned || 0).toLocaleString();
    if (chatEl) chatEl.textContent = (stats.chat_messages   || 0).toLocaleString();
    if (fwEl)   fwEl.textContent   = Object.keys(pr.data.twitch_follow_rewards || {}).length;
    if (subEl)  subEl.textContent  = (stats.subs || 0).toLocaleString();

    panel.style.display = 'block';
  } catch(e) { dbg('Twitch stats load failed:', e); }
}


function showShopTab(tab) {
  // Update Bingo progress for visiting shop
  if (typeof updateBingoProgress === 'function') {
    updateBingoProgress('visit_shop', 1);
  }
  
  // Update tab buttons
  el('shop-tab-btn').classList.remove('active');
  el('equip-tab-btn').classList.remove('active');
  el('furn-tab-btn').classList.remove('active');
  el('inv-tab-btn').classList.remove('active');
  
  // Hide all panels
  el('shop-items-panel').style.display = 'none';
  el('shop-equipment-panel').style.display = 'none';
  el('shop-furniture-panel').style.display = 'none';
  el('shop-inv-panel').style.display = 'none';
  
  if (tab === 'items') {
    el('shop-tab-btn').classList.add('active');
    el('shop-items-panel').style.display = 'block';
  } else if (tab === 'equipment') {
    el('equip-tab-btn').classList.add('active');
    el('shop-equipment-panel').style.display = 'block';
    loadEquipmentShop();
  } else if (tab === 'furniture') {
    el('furn-tab-btn').classList.add('active');
    el('shop-furniture-panel').style.display = 'block';
    furniture_loadShop();
  } else if (tab === 'inventory') {
    el('inv-tab-btn').classList.add('active');
    el('shop-inv-panel').style.display = 'block';
  }
}

function itemEmoji(type) { 
  return {
    food:'🍖',      // Meat
    toy:'🧸',       // Teddy bear
    potion:'⚡',    // Lightning/energy
    special:'✨',   // Sparkles
    drink:'🥤',     // Cup with straw
    pillow:'🛏️',   // Bed/pillow
    snack:'🍪'      // Cookie/treat
  }[type]||'🎁';     // Gift box default
}

// ── Category-based food icon images ─────────────────────────────────────
var FOOD_CATEGORY_IMAGES = {
  spicy:  'images/icons/food/spicy.png',
  sweet:  'images/icons/food/sweet.png',
  savory: 'images/icons/food/savory.png',
  fish:   'images/icons/food/fish.png',
  fruit:  'images/icons/food/fruit.png',
  basic:  'images/icons/food/basic.png'
};

var FOOD_CATEGORY_FALLBACK = {
  spicy:  '🌶️',
  sweet:  '🍰',
  savory: '🍖',
  fish:   '🐟',
  fruit:  '🍎',
  basic:  '🍞'
};

// Returns icon HTML for any shop/inventory item.
// Priority: item.image_url → food category image → type emoji fallback
function getItemIconHtml(item) {
  if (!item) return '🎁';

  // Custom image URL takes priority
  if (item.image_url) {
    return '<img src="' + item.image_url + '" class="item-icon-img" alt="' + escapeHtml(item.name || '') + '" onerror="this.outerHTML=\''+escapeHtml(itemEmoji(item.item_type))+'\'">';
  }

  // Food items: use category image; fallback to category emoji on load error
  if (item.food_category && FOOD_CATEGORY_IMAGES[item.food_category]) {
    var fb  = FOOD_CATEGORY_FALLBACK[item.food_category] || '🍕';
    var src = FOOD_CATEGORY_IMAGES[item.food_category];
    return '<img src="' + src + '" class="item-icon-img" alt="' + escapeHtml(item.food_category) + '" onerror="var p=this.parentElement;if(p){p.innerHTML=\'' + fb + '\';p.style.fontSize=\'2rem\';}">';
  }

  // All other items: type emoji fallback
  return itemEmoji(item.item_type);
}

// ══════════════════════════════════════════════════════════════════════════
// FOOD ROTATION SYSTEM - Weekly rotating food categories
// ══════════════════════════════════════════════════════════════════════════

var foodCategoryData = {
  spicy: { name: 'Spicy', icon: '🌶️', color: '#ff4444' },
  sweet: { name: 'Sweet', icon: '🍰', color: '#ff66cc' },
  savory: { name: 'Savory', icon: '🍖', color: '#8B4513' },
  fish: { name: 'Fish', icon: '🐟', color: '#4488ff' },
  fruit: { name: 'Fruit', icon: '🍎', color: '#ff6666' },
  basic: { name: 'Basic', icon: '🍞', color: '#d4a76a' }
};

// 3-week rotation (like equipment)

// ══════════════════════════════════════════════════════════════════════════
// DAILY SHOP ROTATION
// Same picks for all players each day (date-seeded).
// 5 items: 2 food + 1 equipment + 1 toy/misc + 1 wildcard.
// 15% discount on daily items. Resets at midnight UTC.
// ══════════════════════════════════════════════════════════════════════════

function getDailyShopSeed() {
  // Deterministic seed from today's date — same for all players
  var d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

function seededRandom(seed, index) {
  // Simple deterministic pseudo-random from seed + index
  var x = Math.sin(seed * 9301 + index * 49297 + 233720) * 16807;
  return x - Math.floor(x);
}

function seededShuffle(arr, seed) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(seededRandom(seed, i) * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function getDailyShopCountdown() {
  var now = new Date();
  var midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  var diff = midnight - now;
  var h = Math.floor(diff / 3600000);
  var m = Math.floor((diff % 3600000) / 60000);
  var s = Math.floor((diff % 60000) / 1000);
  return h + 'h ' + m + 'm ' + s + 's';
}

function getDailyBoughtKey() {
  return 'daily_shop_bought_' + getDailyShopSeed() + '_' + (currentUser && currentUser.id);
}

function getDailyBoughtItems() {
  try {
    return JSON.parse(localStorage.getItem(getDailyBoughtKey()) || '[]');
  } catch(e) { return []; }
}

function markDailyItemBought(itemId) {
  var bought = getDailyBoughtItems();
  if (bought.indexOf(itemId) === -1) bought.push(itemId);
  try { localStorage.setItem(getDailyBoughtKey(), JSON.stringify(bought)); } catch(e) {}
}

async function renderDailyShop(allItems) {
  var mount = document.getElementById('daily-shop-mount');
  if (!mount) return;

  var seed = getDailyShopSeed();
  var boughtIds = getDailyBoughtItems();

  // Build category pools from all available items
  var foodItems  = allItems.filter(function(i) { return i.food_category || (i.tags && i.tags.includes('food')); });
  var equipItems = allItems.filter(function(i) { return i.equipment_type || (i.tags && i.tags.includes('equipment')); });
  var miscItems  = allItems.filter(function(i) { return !i.food_category && !i.equipment_type && i.price > 0; });

  // Seed-shuffle each pool and pick slots
  var daily = [];
  var shuffledFood  = seededShuffle(foodItems, seed);
  var shuffledEquip = seededShuffle(equipItems, seed + 1);
  var shuffledMisc  = seededShuffle(miscItems, seed + 2);
  var shuffledAll   = seededShuffle(allItems, seed + 3);

  if (shuffledFood[0])  daily.push({ item: shuffledFood[0],  slot: 'food'      });
  if (shuffledFood[1])  daily.push({ item: shuffledFood[1],  slot: 'food'      });
  if (shuffledEquip[0]) daily.push({ item: shuffledEquip[0], slot: 'equipment' });
  if (shuffledMisc[0])  daily.push({ item: shuffledMisc[0],  slot: 'misc'      });
  // Wildcard: any item not already picked
  var pickedIds = daily.map(function(d) { return d.item.id; });
  var wildcard = shuffledAll.find(function(i) { return pickedIds.indexOf(i.id) === -1; });
  if (wildcard) daily.push({ item: wildcard, slot: 'wildcard' });

  if (daily.length === 0) { mount.innerHTML = ''; return; }

  var DISCOUNT = 0.85; // 15% off

  var html =
    '<div style="background:linear-gradient(135deg,rgba(255,140,0,0.08),rgba(255,200,0,0.05));' +
    'border:2px solid rgba(255,165,0,0.3);border-radius:16px;padding:14px 16px;margin-bottom:20px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
        '<div>' +
          '<span style="font-size:0.9rem;font-weight:800;color:#e8a000;">🌟 Daily Deals</span>' +
          '<span style="font-size:0.72rem;color:var(--text-light);margin-left:8px;">15% off — same for everyone today</span>' +
        '</div>' +
        '<div style="font-size:0.7rem;color:var(--text-light);text-align:right;">' +
          'Resets in <span id="daily-shop-countdown" style="color:#e8a000;font-weight:700;">--:--:--</span>' +
        '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;">' +
        daily.map(function(d) {
          var item     = d.item;
          var fullPrice = item.price || 0;
          var salePrice = Math.max(1, Math.round(fullPrice * DISCOUNT));
          var isBought  = boughtIds.indexOf(item.id) !== -1;
          var icon      = item.emoji || item.icon || '📦';
          return '<div style="background:var(--white);border:2px solid ' + (isBought ? '#ccc' : 'rgba(255,165,0,0.4)') + ';' +
            'border-radius:12px;padding:10px;text-align:center;position:relative;opacity:' + (isBought ? '0.6' : '1') + ';">' +
            '<div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);' +
            'background:#e8a000;color:#fff;border-radius:10px;padding:1px 8px;font-size:0.6rem;font-weight:800;">DAILY</div>' +
            '<div style="font-size:1.6rem;margin:6px 0 4px;">' + icon + '</div>' +
            '<div style="font-size:0.72rem;font-weight:700;color:var(--text);margin-bottom:4px;line-height:1.3;">' + escapeHtml(item.name) + '</div>' +
            '<div style="font-size:0.68rem;margin-bottom:6px;">' +
              '<span style="text-decoration:line-through;color:#aaa;">' + fullPrice + ' PP</span> ' +
              '<span style="color:#e8a000;font-weight:800;">' + salePrice + ' PP</span>' +
            '</div>' +
            '<button class="btn btn-sm" onclick="buyDailyItem(' + JSON.stringify(item.id) + ',' + salePrice + ',this)" ' +
            'style="width:100%;font-size:0.72rem;padding:4px 6px;' + (isBought ? 'background:#eee;color:#999;' : 'background:linear-gradient(135deg,#e8a000,#ffcc00);color:#fff;border:none;') + '"' +
            (isBought ? ' disabled' : '') + '>' +
            (isBought ? '✓ Bought' : 'Buy') +
            '</button>' +
          '</div>';
        }).join('') +
      '</div>' +
    '</div>';

  mount.innerHTML = html;

  // Start countdown ticker
  if (window._dailyCountdownInterval) clearInterval(window._dailyCountdownInterval);
  window._dailyCountdownInterval = setInterval(function() {
    var el = document.getElementById('daily-shop-countdown');
    if (el) el.textContent = getDailyShopCountdown();
    else clearInterval(window._dailyCountdownInterval);
  }, 1000);
}

async function buyDailyItem(itemId, salePrice, btn) {
  if (!currentUser) return;
  var boughtIds = getDailyBoughtItems();
  if (boughtIds.indexOf(itemId) !== -1) {
    showToast('Already bought this daily deal today!', 3000);
    return;
  }
  if (currentPoints < salePrice) {
    showToast('Not enough PP! Need ' + salePrice + ' PP.', 3000);
    return;
  }
  if (btn) { btn.disabled = true; btn.textContent = 'Buying...'; }

  // Deduct PP
  var ppRes = await supabaseClient.rpc('award_pp_secure', {
    p_amount: -salePrice, p_reason: 'daily_shop'
  }).catch(function(){ return null; });

  if (!ppRes || ppRes.error) {
    showToast('Purchase failed — try again.', 3000);
    if (btn) { btn.disabled = false; btn.textContent = 'Buy'; }
    return;
  }
  updateAllPoints(ppRes.data);

  // Add to inventory
  var invRes = await supabaseClient.from('user_inventory').upsert(
    { user_id: currentUser.id, item_id: itemId, quantity: 1 },
    { onConflict: 'user_id,item_id' }
  ).catch(function(){ return null; });

  markDailyItemBought(itemId);
  showToast('✅ Daily deal purchased! Check your inventory.', 4000);
  updateBingoProgress('purchase_item', 1);
  addPassXP(3, 'shop').catch(function(){});

  if (btn) { btn.textContent = '✓ Bought'; btn.style.background = '#eee'; btn.style.color = '#999'; }
}

function getFoodRotation() {
  var weeksSinceEpoch = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  var weekInCycle = weeksSinceEpoch % 3;
  
  var rotations = [
    ['spicy', 'savory'],    // Week A: Hearty foods
    ['sweet', 'fruit'],     // Week B: Treats
    ['fish', 'basic']       // Week C: Essentials
  ];
  
  return rotations[weekInCycle];
}

function isFoodFeatured(foodCategory) {
  if (!foodCategory) return false;
  var featured = getFoodRotation();
  return featured.includes(foodCategory);
}

function getFoodCategoryLabel(category) {
  if (!category) return '';
  var data = foodCategoryData[category];
  if (!data) return '';
  return data.icon + ' ' + data.name;
}

// Get current rotation week (A, B, or C)
function getCurrentRotationWeek() {
  var weeksSinceEpoch = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  var weekInCycle = weeksSinceEpoch % 3;
  return ['A', 'B', 'C'][weekInCycle];
}

// ══════════════════════════════════════════════════════════════════════════
// MINI SEASONS SYSTEM
// A themed ~3-month (or shorter, for custom events) period that layers
// seasonal shop items into the existing weekly rotation, can carry its own
// themed community goals (via the existing community_goals date-range
// system — no new mechanism needed there), and has its own cosmetic
// reward track separate from the main PawketPass.
// ══════════════════════════════════════════════════════════════════════════

var _activeMiniSeasonsCache = null;
var _activeMiniSeasonsFetchedAt = 0;

// Multiple seasons can be active at once on purpose (e.g. a short custom
// event layered over a longer calendar season), so this returns an array.
async function getActiveMiniSeasons() {
  var now = Date.now();
  if (_activeMiniSeasonsCache && (now - _activeMiniSeasonsFetchedAt) < 300000) {
    return _activeMiniSeasonsCache;
  }
  try {
    var nowIso = new Date().toISOString();
    var res = await supabaseClient
      .from('mini_seasons')
      .select('*')
      .eq('is_active', true)
      .lte('started_at', nowIso)
      .gte('ends_at', nowIso);
    _activeMiniSeasonsCache = res.data || [];
    _activeMiniSeasonsFetchedAt = now;
  } catch (e) {
    dbg('[MiniSeasons] load error:', e);
    _activeMiniSeasonsCache = [];
  }
  return _activeMiniSeasonsCache;
}

// Independent weekly counter for seasonal item rotation (1-4), deliberately
// separate from getCurrentRotationWeek()'s A/B/C engine above so seasonal
// items rotating in doesn't touch or risk the existing rotation logic.
function getSeasonalWeekSlot() {
  var weeksSinceEpoch = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  return (weeksSinceEpoch % 4) + 1; // 1-4
}

// ══════════════════════════════════════════════════════════════════════════
// WORLD STATE FLAGS
// Persistent, genuinely-shared values (unlike the old localStorage-only
// worldEvents below) that boss kills nudge a little each time. Currently
// one flag exists — corruption_level (0-100) — but the table is key-value
// so more can be added later without a schema change.
// ══════════════════════════════════════════════════════════════════════════

var _worldStateCache = null;
var _worldStateFetchedAt = 0;

async function getWorldStateFlags() {
  var now = Date.now();
  if (_worldStateCache && (now - _worldStateFetchedAt) < 60000) {
    return _worldStateCache;
  }
  try {
    var res = await supabaseClient.from('world_state_flags').select('*');
    var flags = {};
    (res.data || []).forEach(function(row) {
      // Skip expired temporary-buff-style flags (e.g. celebration_buff)
      if (row.expires_at && new Date(row.expires_at) < new Date()) return;
      flags[row.flag_key] = row;
    });
    _worldStateCache = flags;
    _worldStateFetchedAt = now;
  } catch (e) {
    dbg('[WorldState] load error:', e);
    _worldStateCache = _worldStateCache || {};
  }
  return _worldStateCache;
}

async function getWorldStateValue(flagKey, fallback) {
  var flags = await getWorldStateFlags();
  return (flags[flagKey] && typeof flags[flagKey].value === 'number') ? flags[flagKey].value : fallback;
}

// Synchronous, cache-only read (no network call) — for spots that can't
// await, like weatherSystem.generateWeather() below. A slightly-stale
// value here is fine; this never blocks weather from being set.
function getWorldStateValueSync(flagKey, fallback) {
  if (_worldStateCache && _worldStateCache[flagKey] && typeof _worldStateCache[flagKey].value === 'number') {
    return _worldStateCache[flagKey].value;
  }
  return fallback;
}

// Called on every boss kill — nudges corruption down a little (the
// community is pushing back) always, but the celebration buff only
// triggers every 10th community-wide boss kill (not every single one —
// with even a small player base, boss kills happen constantly, so this
// keeps the buff feeling earned rather than automatic).
async function nudgeWorldStateForBossKill() {
  try {
    // Reduced from -2: boss kills are now an ambient nudge, not the
    // dominant force — the corruption ritual (see performCorruptionRitual)
    // is the real, deliberate lever players can use in either direction.
    await supabaseClient.rpc('nudge_world_state', { p_flag_key: 'corruption_level', p_delta: -1 });
    var killRes = await supabaseClient.rpc('record_boss_kill');
    _worldStateCache = null; // force a fresh read next time something checks
    if (killRes.data && killRes.data.triggered) {
      showToast('🎉 10 bosses defeated by the community! Everyone gets a 1-hour +15% XP/PP bonus!', 'success', true);
      _lastAnnouncedCelebrationCheck = Date.now(); // this browser already saw it, skip the poll-based announce below
    }
  } catch (e) {
    dbg('[WorldState] boss-kill nudge error:', e);
  }
}

// Broader announcement: since only the specific player whose kill landed
// on the 10th gets the toast above, this periodic check lets anyone else
// who's currently using the app find out too, within about a minute of
// it triggering — without needing full realtime infrastructure for it.
var _lastAnnouncedCelebrationCheck = 0;
async function checkForNewCelebrationBuff() {
  try {
    var flags = await getWorldStateFlags();
    var buff = flags.celebration_buff;
    if (!buff || !buff.expires_at) return;
    var startedAt = new Date(buff.updated_at || buff.expires_at).getTime();
    if (startedAt > _lastAnnouncedCelebrationCheck) {
      _lastAnnouncedCelebrationCheck = Date.now();
      showToast('🎉 The community just earned a 1-hour +15% XP/PP bonus from boss kills!', 'success', true);
    }
  } catch (e) { /* silent — this is just a periodic nicety, not critical */ }
}

// Generates a short-lived code the player types into `/link` on Discord
// to connect their account. Invalidates any previous unused code first
// (handled server-side in the RPC).
async function generateDiscordLinkCode() {
  if (!currentUser) return;
  try {
    var res = await supabaseClient.rpc('generate_discord_link_code');
    if (res.error || !res.data || res.data.error) {
      showToast(res.data && res.data.error ? res.data.error : 'Could not generate a code', 'error');
      return;
    }
    var codeDisplay = el('discord-link-code-display');
    var codeValue = el('discord-link-code-value');
    if (codeDisplay && codeValue) {
      codeValue.textContent = res.data.code;
      codeDisplay.style.display = 'block';
    }
  } catch (e) {
    console.error('[Discord] link code error:', e);
    showToast('Could not generate a code', 'error');
  }
}

// Deliberate player-driven lever on corruption — unlike boss kills (an
// ambient side-effect), this is a real choice: spend 100 PP, once per
// day, to push the world 5 points toward Light ('purify') or Darkness
// ('corrupt'). Exists specifically so players who want Dark gear (or
// Light gear) have a way to actually make that happen, rather than
// waiting on random boss-kill timing they can't control.
async function performCorruptionRitual(direction) {
  if (!currentUser) return;
  try {
    var res = await supabaseClient.rpc('perform_corruption_ritual', { p_direction: direction });
    if (res.error || !res.data || res.data.error) {
      showToast(res.data && res.data.error ? res.data.error : 'The ritual failed', 'error');
      return;
    }
    var data = res.data;
    updateAllPoints(data.new_pp);
    _worldStateCache = null; // force a fresh read so the UI reflects the new value
    var directionText = direction === 'purify' ? '🕯️ You purified the forest a little!' : '🌑 You fed the corruption a little!';
    showToast(directionText + ' World corruption is now ' + Math.round(data.new_value) + '%.', 'success', true);
    if (typeof todayCard_render === 'function') todayCard_render();
  } catch (e) {
    console.error('[CorruptionRitual] error:', e);
    showToast('The ritual failed', 'error');
  }
}


async function loadShop() {
  var grid = el('shop-grid');
  
  // PAWKETPASS: Mark shop visit for bingo
  updateBingoProgress('visit_shop', 1);
  
  // Exclude boss drops from shop! Boss items can only be obtained by defeating bosses
  var res = await supabaseClient
    .from('items')
    .select('*')
    .or('is_boss_drop.is.null,is_boss_drop.eq.false')
    .neq('id', '00000000-0000-0000-0000-000000000001')  // Exclude Skin Keys by ID
    .neq('name', 'Skin Key')                             // Exclude Skin Keys by name
    .order('price', {ascending: true});
  
  if (res.error||!res.data||!res.data.length) { 
    grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:36px;color:var(--text-light)">No items yet!</div>'; 
    return; 
  }
  
  // Dedupe items
  var seen={}, deduped=[];
  res.data.forEach(function(item){ var k=item.name.toLowerCase().trim(); if(!seen[k]||item.price<seen[k].price)seen[k]=item; });
  Object.values(seen).forEach(function(i){deduped.push(i);});
  
  // MINI SEASONS: filter out seasonal items unless their season is
  // currently active AND it's their week to appear (separate 1-4 rotation
  // from the regular A/B/C weekly rotation below, see getSeasonalWeekSlot())
  var activeSeasons = await getActiveMiniSeasons();
  var activeSeasonKeys = activeSeasons.map(function(s) { return s.season_key; });
  var currentSeasonalSlot = getSeasonalWeekSlot();
  deduped = deduped.filter(function(item) {
    if (!item.season_key) return true; // not a seasonal item, always eligible
    return activeSeasonKeys.indexOf(item.season_key) !== -1 && item.season_week_slot === currentSeasonalSlot;
  });
  
  // WORLD STATE: some items only appear once corruption crosses a
  // threshold in either direction (unlock_min_corruption / unlock_max_corruption,
  // both nullable — leave unset for items that should always be visible)
  var corruptionLevelForShop = await getWorldStateValue('corruption_level', 50);
  deduped = deduped.filter(function(item) {
    if (item.unlock_min_corruption != null && corruptionLevelForShop < item.unlock_min_corruption) return false;
    if (item.unlock_max_corruption != null && corruptionLevelForShop > item.unlock_max_corruption) return false;
    return true;
  });
  
  // Render daily shop rotation at the top
  await renderDailyShop(deduped);

  // Categorize items
  var categories = {
    food: [],
    toys: [],
    energy: [],
    healing: [],
    equipment: [],
    other: []
  };
  
  var currentWeek = getCurrentRotationWeek();
  
  deduped.forEach(function(item) {
    // Categorize based on primary effect
    if (item.effect === 'healing' || item.name.toLowerCase().includes('heal') || item.name.toLowerCase().includes('ointment') || item.name.toLowerCase().includes('potion')) {
      categories.healing.push(item);
    } else if (item.item_type === 'equipment') {
      categories.equipment.push(item);
    } else if (item.energy_effect > 0 && (item.hunger_effect === 0 || item.energy_effect > item.hunger_effect)) {
      categories.energy.push(item);
    } else if (item.happiness_effect > 0 && (item.hunger_effect === 0 || item.happiness_effect > item.hunger_effect)) {
      categories.toys.push(item);
    } else if (item.hunger_effect > 0) {
      // FOOD ROTATION FILTER: Only show food for current week
      if (!item.rotation_week || item.rotation_week === currentWeek) {
        categories.food.push(item);
      }
    } else {
      categories.other.push(item);
    }
  });
  
  // Sort each category by price
  Object.keys(categories).forEach(function(cat) {
    categories[cat].sort(function(a,b){return a.price-b.price;});
  });
  
  grid.innerHTML='';
  
  // Render categories with headers
  var categoryConfig = [
    { key: 'food', title: '🍕 Food', desc: 'Keep your pet well-fed and happy!' },
    { key: 'toys', title: '🎾 Toys', desc: 'Fun items to boost happiness!' },
    { key: 'energy', title: '⚡ Energy', desc: 'Restore energy for more activities!' },
    { key: 'healing', title: '💚 Healing', desc: 'Restore HP after battles!' },
    { key: 'equipment', title: '⚔️ Equipment', desc: 'Battle gear to make your pet stronger!' }
  ];
  
  categoryConfig.forEach(function(config) {
    var items = categories[config.key];
    if (items.length === 0) return; // Skip empty categories
    
    // Category header
    var header = makeEl('div', {class: 'shop-category-header'});
    header.style.cssText = 'grid-column: 1 / -1; padding: 20px 10px 10px; border-bottom: 3px solid var(--purple-light); margin-bottom: 10px;';
    
    var title = makeEl('div', {style: 'font-size: 1.4rem; font-weight: bold; color: var(--purple); margin-bottom: 5px;'});
    title.textContent = config.title;
    
    var desc = makeEl('div', {style: 'font-size: 0.9rem; color: var(--text-light);'});
    desc.textContent = config.desc;
    
    header.appendChild(title);
    header.appendChild(desc);
    grid.appendChild(header);
    
    // OPTIMIZATION 1: Use DocumentFragment for batch append
    var fragment = document.createDocumentFragment();
    
    // Render items in this category
    items.forEach(function(item) {
      var card=makeEl('div',{class:'shop-card'});
      var iconDiv=makeEl('div',{class:'shop-item-icon'});
      iconDiv.innerHTML = getItemIconHtml(item);
      card.appendChild(iconDiv);
      card.appendChild(makeEl('div',{class:'shop-item-name'},item.name));
      
      // FOOD CATEGORY LABEL (for food items only)
      if (config.key === 'food' && item.food_category) {
        var categoryLabel = makeEl('div', {class: 'food-category-label'});
        var featured = isFoodFeatured(item.food_category);
        categoryLabel.textContent = getFoodCategoryLabel(item.food_category) + (featured ? ' ⭐ Featured' : '');
        categoryLabel.style.cssText = 'font-size: 0.85rem; color: ' + (featured ? '#ff6600' : '#888') + '; margin: 4px 0; font-weight: ' + (featured ? 'bold' : 'normal');
        card.appendChild(categoryLabel);
      }
      
      card.appendChild(makeEl('div',{class:'shop-item-desc'},item.description||''));
      var tags=makeEl('div',{class:'shop-effects'});
      if(item.hunger_effect>0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.hunger_effect+' Hunger'));
      if(item.energy_effect>0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.energy_effect+' Energy'));
      if(item.happiness_effect>0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.happiness_effect+' Happiness'));
      if(item.xp_effect>0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.xp_effect+' XP'));
      if(item.effect === 'healing' && item.effect_value > 0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.effect_value+' HP'));
      if(item.attack_bonus>0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.attack_bonus+' ATK'));
      if(item.defense_bonus>0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.defense_bonus+' DEF'));
      if(item.luck_bonus>0)tags.appendChild(makeEl('span',{class:'effect-tag luck-tag'},'+'+item.luck_bonus+' LCK'));
      if(item.spirit_bonus>0)tags.appendChild(makeEl('span',{class:'effect-tag spirit-tag'},'+'+item.spirit_bonus+' SPI'));
      if(item.hp_bonus>0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.hp_bonus+' HP'));
      if(item.speed_bonus>0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.speed_bonus+' SPD'));
      if(tags.children.length)card.appendChild(tags);
      
      // Apply event discount to displayed price
      var displayPrice = worldEvents.applyEventModifier(item.price, 'shopDiscount');
      var guildDiscount = getActivePerkMultiplier('discount'); if (guildDiscount < 1) displayPrice = Math.floor(displayPrice * guildDiscount);
      var priceText = '🪙 ' + displayPrice + ' PP';
      if (displayPrice < item.price) {
        priceText += ' <span style="text-decoration:line-through;color:#999;font-size:0.85em;">' + item.price + '</span>';
      }
      var priceDiv = makeEl('div',{class:'shop-item-price'});
      priceDiv.innerHTML = priceText;
      card.appendChild(priceDiv);
      
      var canAfford=currentPoints>=displayPrice;
      var buyBtn=makeEl('button',{class:'btn-buy'},canAfford?'Buy':'Need '+displayPrice+' PP');
      if(!canAfford)buyBtn.disabled=true;
      buyBtn.onclick=function(){buyItem(item.id,item.name,displayPrice);};
      card.appendChild(buyBtn);
      fragment.appendChild(card);
    });
    
    // Append all items at once
    grid.appendChild(fragment);
  });
  
  // Add any uncategorized items at the end
  if (categories.other.length > 0) {
    var header = makeEl('div', {class: 'shop-category-header'});
    header.style.cssText = 'grid-column: 1 / -1; padding: 20px 10px 10px; border-bottom: 3px solid var(--purple-light); margin-bottom: 10px;';
    header.innerHTML = '<div style="font-size: 1.4rem; font-weight: bold; color: var(--purple);">📦 Other Items</div>';
    grid.appendChild(header);
    
    // OPTIMIZATION 1: Use DocumentFragment for batch append
    var fragment = document.createDocumentFragment();
    
    categories.other.forEach(function(item) {
      var card=makeEl('div',{class:'shop-card'});
      var iconDiv=makeEl('div',{class:'shop-item-icon'});
      iconDiv.innerHTML = getItemIconHtml(item);
      card.appendChild(iconDiv);
      card.appendChild(makeEl('div',{class:'shop-item-name'},item.name));
      card.appendChild(makeEl('div',{class:'shop-item-desc'},item.description||''));
      
      // Apply event discount to displayed price
      var displayPrice = worldEvents.applyEventModifier(item.price, 'shopDiscount');
      var priceText = '🪙 ' + displayPrice + ' PP';
      var guildDiscount = getActivePerkMultiplier('discount'); if (guildDiscount < 1) displayPrice = Math.floor(displayPrice * guildDiscount);
      if (displayPrice < item.price) {
        priceText += ' <span style="text-decoration:line-through;color:#999;font-size:0.85em;">' + item.price + '</span>';
      }
      var priceDiv = makeEl('div',{class:'shop-item-price'});
      priceDiv.innerHTML = priceText;
      card.appendChild(priceDiv);
      
      var canAfford=currentPoints>=displayPrice;
      var buyBtn=makeEl('button',{class:'btn-buy'},canAfford?'Buy':'Need '+displayPrice+' PP');
      if(!canAfford)buyBtn.disabled=true;
      buyBtn.onclick=function(){buyItem(item.id,item.name,displayPrice);};
      card.appendChild(buyBtn);
      fragment.appendChild(card);
    });
    
    // Append all at once
    grid.appendChild(fragment);
  }
}

async function buyItem(itemId, itemName, price) {
  if (!currentUser) return;
  
  // Rate limiting
  if (!canPerformAction('buy_item', 500)) {
    showToast('Please wait before purchasing again!');
    return;
  }
  
  // Call secure database function
  var { data: result, error } = await supabaseClient.rpc('buy_item_secure', {
    p_item_id: itemId,
    p_item_price: price,
    p_item_name: itemName
  });
  
  if (error) {
    showToast('Purchase failed: ' + error.message);
    return;
  }
  
  if (!result || !result.success) {
    showToast('Purchase failed!');
    return;
  }
  
  // Check spending badges
  if (currentPoints >= 500) {
    await awardBadge('mega_spender');
  } else if (currentPoints >= 100) {
    await awardBadge('big_spender');
  }
  
  // Update display with correct field name from RPC
  updateAllPoints(result.new_pp);
  showToast('Bought ' + result.item_name + '!');
  tabsLoaded['shop'] = false; 
  loadShop(); 
  loadInventory();
  tabsLoaded['mypets'] = false;
}

async function loadInventory() {
  var grid=el('inventory-grid'); if(!currentUser)return;
  var invRes=await supabaseClient.from('user_inventory').select('id,item_id,quantity').eq('user_id',currentUser.id).gt('quantity',0);
  if(invRes.error||!invRes.data||!invRes.data.length){grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:36px;color:var(--text-light)">Inventory empty!</div>';return;}
  var itemIds=invRes.data.map(function(r){return r.item_id;});
  var itemsRes=await supabaseClient.from('items').select('id,name,item_type,image_url,hunger_effect,happiness_effect,energy_effect,xp_effect').in('id',itemIds);
  var itemMap={};
  if(itemsRes.data)itemsRes.data.forEach(function(i){itemMap[i.id]=i;});
  grid.innerHTML='';
  invRes.data.forEach(function(row){
    var item=itemMap[row.item_id]||{};
    var card=makeEl('div',{class:'inv-card'});
    var icon=makeEl('div',{class:'inv-icon'});
    icon.innerHTML = getItemIconHtml(item);
    card.appendChild(icon);
    card.appendChild(makeEl('div',{class:'inv-name'},item.name||'Item'));
    
    // Show item effects
    var effects = [];
    if (item.hunger_effect) effects.push('Hunger +' + item.hunger_effect);
    if (item.happiness_effect) effects.push('Happiness +' + item.happiness_effect);
    if (item.energy_effect) effects.push('Energy +' + item.energy_effect);
    if (item.xp_effect) effects.push('XP +' + item.xp_effect);
    if (effects.length > 0) {
      var effectDiv = makeEl('div', {class:'inv-effect'}, effects.join(', '));
      effectDiv.style.cssText = 'font-size:0.85rem;color:var(--green);margin-top:4px;';
      card.appendChild(effectDiv);
    }
    
    card.appendChild(makeEl('div',{class:'inv-qty'},'x'+row.quantity));
    // Skip Use button for Skin Keys — they're spent in the Variant menu on pet cards
    if (item.name === 'Skin Key' || row.item_id === '00000000-0000-0000-0000-000000000001') {
      var infoBadge = makeEl('div');
      infoBadge.textContent = '🔑 Use in My Pets → Variant';
      infoBadge.style.cssText = 'font-size:0.72rem;color:var(--purple);margin-top:4px;text-align:center;opacity:0.85;';
      card.appendChild(infoBadge);
    } else {
      var useBtn=makeEl('button',{class:'btn btn-sm btn-primary'},'Use');
      useBtn.onclick=(function(rId,iName){return function(){openUseModal(rId,iName);};})(row.id, item.name||'Item');
      card.appendChild(useBtn);
    }
    grid.appendChild(card);
  });
}

function openUseModal(invId,itemName) {
  selectedInvItem={invId:invId,itemName:itemName};
  el('use-modal-title').textContent='Use '+itemName;
  el('use-modal-desc').textContent='Which pet?';
  var list=el('pet-select-list'); list.innerHTML='';
  var pets=Object.values(petState);
  if(!pets.length){list.innerHTML='<p style="color:var(--text-light)">No pets yet!</p>';}
  else{
    pets.forEach(function(p){
      var btn=makeEl('button',{class:'pet-select-btn'},p.nickname);
      btn.onclick=(function(pid,pname){return function(){useOnPet(pid,pname);};})(p.id,p.nickname);
      list.appendChild(btn);
    });
  }
  el('use-modal').classList.add('show');
}
function closeUseModal(){el('use-modal').classList.remove('show');selectedInvItem=null;}

// ── CONTACT MODAL ──────────────────────────────────────
function openContactModal() {
  el('contact-modal').classList.add('show');
}

function closeContactModal() {
  el('contact-modal').classList.remove('show');
}

// ── SIDEBAR TWITCH LIVE STATUS CHECK ──────────────────
// Track if we've already logged about missing Twitch token
var twitchTokenLoggedOnce = false;
function sortStreamerList() {
  var streamersWidget = document.querySelector('.streamers-widget');
  if (!streamersWidget) return;
  
  var streamerItems = streamersWidget.querySelectorAll('.streamer-item');
  if (!streamerItems.length) return;
  
  var itemsArray = Array.prototype.slice.call(streamerItems);
  
  itemsArray.sort(function(a, b) {
    var aLive = a.querySelector('.live-indicator') && 
                a.querySelector('.live-indicator').style.display !== 'none';
    var bLive = b.querySelector('.live-indicator') && 
                b.querySelector('.live-indicator').style.display !== 'none';
    
    if (aLive && !bLive) return -1;
    if (!aLive && bLive) return 1;
    
    var aName = a.querySelector('.streamer-name').textContent.trim();
    var bName = b.querySelector('.streamer-name').textContent.trim();
    return aName.localeCompare(bName);
  });
  
  itemsArray.forEach(function(item) {
    streamersWidget.appendChild(item);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// WHO'S LIVE BANNER — floating notification when team members are streaming
// ═══════════════════════════════════════════════════════════════════════════

function updateLiveBanner() {
  var existing = document.getElementById('live-banner');

  // Nobody live — remove banner if it exists
  if (_currentlyLiveStreamers.length === 0) {
    if (existing) existing.remove();
    return;
  }

  // Build or update the banner
  if (!existing) {
    existing = document.createElement('div');
    existing.id = 'live-banner';
    existing.className = 'live-banner-collapsed';
    document.body.appendChild(existing);
  }

  var count = _currentlyLiveStreamers.length;

  if (count === 1) {
    // Single streamer — show name and link directly
    var s = _currentlyLiveStreamers[0];
    existing.innerHTML =
      '<div class="live-banner-inner" onclick="liveBannerToggle()">' +
        '<span class="live-banner-dot"></span>' +
        '<span class="live-banner-text">🎮 <strong>' + escapeHtml(s.name) + '</strong> is LIVE!</span>' +
        '<a class="live-banner-btn" href="' + escapeHtml(s.twitchUrl) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">Watch →</a>' +
      '</div>';
    existing.className = 'live-banner-collapsed live-banner-single';
  } else {
    // Multiple streamers — show count badge, expand on click
    var expanded = existing.classList.contains('live-banner-open');
    var listHtml = _currentlyLiveStreamers.map(function(s) {
      return '<a class="live-banner-list-item" href="' + escapeHtml(s.twitchUrl) + '" target="_blank" rel="noopener">' +
        '<span class="live-banner-dot live-banner-dot-sm"></span>' +
        '<span class="live-banner-list-name">' + escapeHtml(s.name) + '</span>' +
        (s.viewers ? '<span class="live-banner-viewers">' + s.viewers.toLocaleString() + ' viewers</span>' : '') +
        '<span class="live-banner-list-btn">Watch →</span>' +
      '</a>';
    }).join('');

    existing.innerHTML =
      '<div class="live-banner-inner" onclick="liveBannerToggle()">' +
        '<span class="live-banner-dot"></span>' +
        '<span class="live-banner-text">🎮 <strong>' + count + ' streamers</strong> are LIVE!</span>' +
        '<span class="live-banner-badge">' + count + '</span>' +
        '<span class="live-banner-chevron">' + (expanded ? '▲' : '▼') + '</span>' +
      '</div>' +
      '<div class="live-banner-list" style="display:' + (expanded ? 'block' : 'none') + ';">' +
        listHtml +
      '</div>';
    existing.className = 'live-banner-collapsed' + (expanded ? ' live-banner-open' : '');
  }
}

function liveBannerToggle() {
  var banner = document.getElementById('live-banner');
  if (!banner) return;
  if (_currentlyLiveStreamers.length <= 1) return; // single streamer has no expand

  var list = banner.querySelector('.live-banner-list');
  var chevron = banner.querySelector('.live-banner-chevron');
  if (!list) return;

  var isOpen = banner.classList.contains('live-banner-open');
  if (isOpen) {
    banner.classList.remove('live-banner-open');
    list.style.display = 'none';
    if (chevron) chevron.textContent = '▼';
  } else {
    banner.classList.add('live-banner-open');
    list.style.display = 'block';
    if (chevron) chevron.textContent = '▲';
  }
}

async function checkSidebarStreamStatus() {
  // ... rest of the existing function ...
  // Check if Embertail and Pyxshuul are live using public Twitch API
  try {
    // We need to use a token to check streams - try to get from user if linked
    var token = null;
    if (currentUser) {
      var pr = await supabaseClient.from('players').select('twitch_token').eq('id', currentUser.id).single();
      if (pr.data && pr.data.twitch_token) {
        token = pr.data.twitch_token;
      }
    }
    
    // If no token, can't check live status — still sort by whatever is currently shown
    if (!token) {
      if (!twitchTokenLoggedOnce) {
        dbg('No Twitch token available - cannot check live status');
        twitchTokenLoggedOnce = true;
      }
      sortStreamerList();
      return;
    }
    
    // Check both streamers
        var logins = TEAM_MEMBERS.map(function(m) { return 'user_login=' + m.login; }).join('&');
        var resp = await fetch('https://api.twitch.tv/helix/streams?' + logins, {
      headers: {
        'Client-Id': TWITCH_CLIENT_ID,
        'Authorization': 'Bearer ' + token
      }
    });
    
    var data = await resp.json();
    
       // Reset all to offline first
    var streamerIds = ['ember', 'pyxs', 'aria', 'blushimia', 'cowbee', 'kelta', 'jess', 'gnarly'];
    streamerIds.forEach(function(id) {
      var statusEl = el(id + '-status');
      var badgeEl = el(id + '-live-badge');
      var watchBtn = el(id + '-watch-btn');
      if (statusEl) statusEl.textContent = 'OFFLINE';
      if (badgeEl) badgeEl.style.display = 'none';
      if (watchBtn) watchBtn.style.display = 'none';
    });
    
    // Update live streamers
    _currentlyLiveStreamers = []; // reset before repopulating

    if (data.data && data.data.length > 0) {
      data.data.forEach(function(stream) {
        var login = stream.user_login.toLowerCase();
        var loginMap = {
          'embertail': 'ember',
          'pyxshuul': 'pyxs',
          'ariadoestwitch': 'aria',
          'realblushimia': 'blushimia',
          'cowbeevt': 'cowbee',
          'keltathepomeranian': 'kelta',
          'teatimejess': 'jess',
          'gnarly_neon_smilodon': 'gnarly'
        };
        var prefix = loginMap[login];
        if (!prefix) return;
        var statusEl = el(prefix + '-status');
        var badgeEl = el(prefix + '-live-badge');
        var watchBtn = el(prefix + '-watch-btn');
        if (statusEl) statusEl.textContent = stream.game_name || 'LIVE';
        if (badgeEl) badgeEl.style.display = 'inline-block';
        if (watchBtn) watchBtn.style.display = 'inline-block';

        // Add to shared live state for the banner and other systems
        var member = TEAM_MEMBERS.find(function(m) { return m.login.toLowerCase() === login; });
        if (member) {
          _currentlyLiveStreamers.push({
            name:      member.name,
            login:     member.login,
            twitchUrl: member.twitchUrl,
            petName:   member.petName,
            viewers:   stream.viewer_count,
            title:     stream.title || ''
          });
        }
      });
    }
    
    dbg('✅ Sidebar stream status checked. Live:', _currentlyLiveStreamers.length);
    sortStreamerList();
    updateLiveBanner(); // Update floating banner whenever live status changes
    if (_streamerLandingMember) streamerLanding_checkLive(_streamerLandingMember);
  } catch (err) {
    console.error('❌ Error checking sidebar stream status:', err);
  }
}



async function useOnPet(petId,petNickname) {
  if(!selectedInvItem)return;
  var invId=selectedInvItem.invId; var itemName=selectedInvItem.itemName;
  closeUseModal();
  var invRow=await supabaseClient.from('user_inventory').select('item_id,quantity').eq('id',invId).single();
  if(invRow.error||!invRow.data){showToast('Could not find item.');return;}
  var itemRes=await supabaseClient.from('items').select('hunger_effect,energy_effect,happiness_effect,xp_effect').eq('id',invRow.data.item_id).single();
  if(itemRes.error||!itemRes.data){showToast('Could not find effects.');return;}
  var ef=itemRes.data;
  var petRes=await supabaseClient.from('user_pets').select('hunger,max_hunger,energy,max_energy,happiness,max_happiness,xp,level').eq('id',petId).single();
  if(petRes.error||!petRes.data){showToast('Could not find pet.');return;}
  var pet=petRes.data; var updates={};
  if(ef.hunger_effect>0)updates.hunger=Math.min(pet.hunger+ef.hunger_effect,pet.max_hunger);
  if(ef.energy_effect>0)updates.energy=Math.min(pet.energy+ef.energy_effect,pet.max_energy);
  if(ef.happiness_effect>0)updates.happiness=Math.min(pet.happiness+ef.happiness_effect,pet.max_happiness);
  if(ef.xp_effect>0)updates.xp=pet.xp+ef.xp_effect;
  if(!Object.keys(updates).length){showToast('No effects configured.');return;}
  // Also update last_fed if this is a food item, so decay calculates correctly
  if(ef.hunger_effect>0) updates.last_fed = new Date().toISOString();
  await supabaseClient.from('user_pets').update(updates).eq('id',petId);
  var qty=invRow.data.quantity;
  if(qty<=1)await supabaseClient.from('user_inventory').delete().eq('id',invId);
  else await supabaseClient.from('user_inventory').update({quantity:qty-1}).eq('id',invId);
  // Track bingo + PassXP the same way feedWithItem does
  if(ef.hunger_effect>0){
    updateBingoProgress('feed_pet',1);
    addPassXP(2,'feed').catch(function(){});
    community_increment('feed_pets',1);
  }
  if(ef.happiness_effect>0 && ef.hunger_effect<=0){
    // Toy/happiness-only item counts as play
    updateBingoProgress('use_toy',1);
    updateBingoProgress('play_pet',1);
    addPassXP(2,'play').catch(function(){});
  }
  showToast('Used '+itemName+' on '+petNickname+'!');
  await loadInventory(); tabsLoaded['mypets']=false;
}

// ══════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════
// PET FOOD PREFERENCES & PERSONALITIES
// PLACEHOLDER_PET_DATA - Replace these with real streamer pet preferences!
// Search for "PLACEHOLDER_PET_DATA" to find all placeholder data
// ══════════════════════════════════════════════════════════════════════════

var petFoodPreferences = {
  // PLACEHOLDER_PET_DATA - Replace these with real streamer pet data!
  // Format: loved (1.75x), liked (1.25x), disliked (0.75x), hated (0.5x)
  
  'Ember': {
    loved_item: 'Spicy Ramen',
    liked_item: 'Hot Wings',
    disliked_item: 'Rainbow Cake',
    hated_item: 'Sushi Roll',
    hobby: 'Competitive dueling',
    fun_fact: 'Once won a spoon dueling championship!',
    sleep_habit: 'night owl',
    weather_preference: 'loves sun',
    catchphrase: 'Fire solves everything, obviously! 🔥',
    secret_talent: 'Can light a campfire with a single wink'
  },
  
  'Pyxie': {
    loved_item: 'Rainbow Cake',
    liked_item: 'Honey Cookies',
    disliked_item: 'Grilled Salmon',
    hated_item: 'Spicy Burrito',
    hobby: 'Professional napping',
    fun_fact: 'Can sleep for 16 hours straight!',
    sleep_habit: 'heavy sleeper',
    weather_preference: 'loves fog',
    catchphrase: 'I have a plan. It involves napping. ✨',
    secret_talent: 'Can nap in any position, including upside down'
  },
  
  'Steve': {
    loved_item: 'Fresh Bread',
    liked_item: 'Garden Salad',
    disliked_item: 'Hot Wings',
    hated_item: 'Curry Feast',
    hobby: 'Being a menace',
    fun_fact: 'As chill as a fire in hell, controlled like the beasts of Australia!',
    sleep_habit: 'power napper',
    weather_preference: 'hates weather',
    catchphrase: 'Cluck, bawk, buck... you know the rest. 🐔',
    secret_talent: 'Somehow always the last one standing in any situation'
  },
  
  'Kleat': {
    loved_item: 'Garden Salad',
    liked_item: 'Fresh Bread',
    disliked_item: 'Shrimp Tempura',
    hated_item: 'Grilled Steak',
    hobby: 'Studying void and galaxy magic',
    fun_fact: 'A grand mage who can open portals to other worlds!',
    sleep_habit: 'night owl',
    weather_preference: 'loves fog',
    catchphrase: 'Yip, yap, teehee, I opened a portal! ✨',
    secret_talent: 'Can sense when someone is about to say something stupid'
  },
  
  'Blushimia': {
    loved_item: 'Sushi Roll',
    liked_item: 'Grilled Salmon',
    disliked_item: 'Banana Bread',
    hated_item: 'Honey Cookies',
    hobby: 'Breaking out of video games',
    fun_fact: 'Escaped her video game after gaining sentience!',
    sleep_habit: 'early bird',
    weather_preference: 'loves sun',
    catchphrase: 'What the glob?! I\'m free!! 👑',
    secret_talent: 'Can find the hidden exit in literally any room'
  },
  
  'Aria': {
    loved_item: 'Grilled Steak',
    liked_item: 'Beef Jerky',
    disliked_item: 'Apple Pie',
    hated_item: 'Grape Juice',
    hobby: 'Collecting bones and writing stories',
    fun_fact: 'A fae rosy maple moth who uses bones as currency!',
    sleep_habit: 'night owl',
    weather_preference: 'loves rain',
    catchphrase: 'Do you want to see my bones? 🦋',
    secret_talent: 'Can identify any creature by its skeleton alone'
  },
  
  'Gnarly': {
    loved_item: 'Apple Pie',
    liked_item: 'Mango Delight',
    disliked_item: 'Roasted Chicken',
    hated_item: 'Seafood Soup',
    hobby: 'Playing arcade games and collecting Furbies',
    fun_fact: 'Runs the PaleoPlex arcade! Loves nachos!',
    sleep_habit: 'power napper',
    weather_preference: 'loves sun',
    catchphrase: 'High score? Watch me. 🎮',
    secret_talent: 'Has never lost a game of Pac-Man. Not once.'
  },
  
  'Jess': {
    loved_item: 'Mango Delight',
    liked_item: 'Strawberry Parfait',
    disliked_item: 'Cheese Platter',
    hated_item: 'Veggie Noodles',
    hobby: 'Potion brewing and fossil collecting',
    fun_fact: 'A paleoart Parasaur who makes potions!',
    sleep_habit: 'early bird',
    weather_preference: 'loves rain',
    catchphrase: 'This fossil is 65 million years cuter than you. 🦕',
    secret_talent: 'Can brew a potion that tastes terrible but works perfectly'
  }
};

function getPetPreferences(petType) {
  return petFoodPreferences[petType] || null;
}

// BADGES SYSTEM
// ══════════════════════════════════════════════════════════════════════════

var earnedBadges = []; // Cache of user's earned badge keys

async function loadUserBadges() {
  if (!currentUser) return;
  
  var res = await supabaseClient
    .from('user_badges')
    .select('badge_id, badges(badge_key, name, icon)')
    .eq('user_id', currentUser.id);
  
  if (res.error) {
    console.error('[Badges] Error loading badges:', res.error);
    return;
  }
  
  earnedBadges = res.data.map(b => b.badges.badge_key);
  dbg('[Badges] User has earned:', earnedBadges);
}
// Award a player title by title_key
// Table: user_player_titles (user_id, player_title_id UUID, unlocked_at, unlock_reason)
async function awardPlayerTitle(titleKey, reason) {
  if (!currentUser || !titleKey) return;
  try {
    // Look up the title's UUID from player_titles
    var titleRes = await supabaseClient
      .from('player_titles')
      .select('id, display_name')
      .eq('title_key', titleKey)
      .maybeSingle();

    if (!titleRes.data) {
      console.warn('[Title] Title not found in DB:', titleKey);
      return;
    }

    var titleId   = titleRes.data.id;
    var titleName = titleRes.data.display_name;

    // Check if already unlocked
    var existing = await supabaseClient
      .from('user_player_titles')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('player_title_id', titleId)
      .maybeSingle();

    if (existing.data) return; // already earned

    // Insert unlock record
    await supabaseClient.from('user_player_titles').insert({
      user_id:         currentUser.id,
      player_title_id: titleId,
      unlocked_at:     new Date().toISOString(),
      unlock_reason:   reason || 'earned'
    });

    showToast('🏷️ New title unlocked: "' + titleName + '"!', 5000);

  } catch(e) {
    console.error('[Title] awardPlayerTitle failed:', e);
  }
}

async function awardBadge(badgeKey) {
  if (!currentUser) return;
  
  // Check local cache first (fast path, avoids a DB call most of the time)
  if (earnedBadges.includes(badgeKey)) {
    return;
  }
  
  try {
    // Get badge info
    var { data: badge, error: badgeError } = await supabaseClient
      .from('badges')
      .select('*')
      .eq('badge_key', badgeKey)
      .single();
    
    if (badgeError || !badge) {
      dbg('[Badges] Badge not found in database:', badgeKey);
      return;
    }
    
    // Verify against the DB directly right before inserting — closes the race window
    // where two near-simultaneous awardBadge() calls both pass the in-memory check
    // before either insert resolves, which is what was causing the 409 conflicts.
    var { data: existing } = await supabaseClient
      .from('user_badges')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('badge_id', badge.id)
      .maybeSingle();
    
    if (existing) {
      // Already has it — sync the cache so future calls short-circuit instantly
      if (!earnedBadges.includes(badgeKey)) earnedBadges.push(badgeKey);
      return;
    }
    
    // Award badge to user
    var { error: insertError } = await supabaseClient
      .from('user_badges')
      .insert([{
        user_id: currentUser.id,
        badge_id: badge.id
      }]);
    
    if (insertError) {
      if (insertError.code === '23505') {
        // Still possible in a tight race — handle quietly, no console noise
        if (!earnedBadges.includes(badgeKey)) earnedBadges.push(badgeKey);
        return;
      }
      console.error('[Badges] Error awarding badge:', insertError);
      return;
    }
    
    // Add to local cache
    earnedBadges.push(badgeKey);
    
    // Show notification
    if (typeof showBadgeNotification === 'function') {
      showBadgeNotification(badge);
    }
    // Update bell badge count
    updateNotificationBadge().catch(function(){});
    
    // Log activity
    if (typeof logActivity === 'function') {
      await logActivity('badge_earned', {
        badge_name: badge.name,
        badge_icon: badge.icon
      });
    }
    
    dbg('[Badges] Awarded:', badgeKey, '-', badge.name);
    
  } catch (err) {
    console.error('[Badges] Error in awardBadge:', err);
  }
}


// ══════════════════════════════════════════════════════════════════════════
// SOCIAL SHARING SYSTEM
// Rewards players with PP + PassXP for sharing moments to Twitter/Bluesky.
// Trust-based: we reward on button click, trust they actually posted.
// Tracks total shares for badge/title progression.
// ══════════════════════════════════════════════════════════════════════════

var SHARE_REWARD_PP      = 100;
var SHARE_REWARD_PASS_XP = 10;
var SHARE_COOLDOWN_MS    = 60000; // 1 min cooldown so spamming one button doesn't farm PP
var _lastShareTime       = 0;

// Badge thresholds: shares needed for each badge
var SHARE_BADGE_THRESHOLDS = [
  { count: 1,  badge: 'first_share',   title: null,              label: 'First Share!' },
  { count: 5,  badge: 'word_spreader', title: null,              label: 'Word Spreader' },
  { count: 10, badge: 'hype_machine',  title: 'the_broadcaster', label: 'Hype Machine' },
  { count: 25, badge: 'viral_moment',  title: 'the_viral',       label: 'Viral Moment' },
];

// ══════════════════════════════════════════════════════════════════════════
// REFERRAL SYSTEM
// ?ref=username captured on registration, stored in players.referred_by.
// Referrer's referral_count increments; milestones award PP + badges + titles.
// ══════════════════════════════════════════════════════════════════════════

var REFERRAL_TIERS = [
  { count:1,  pp:100,  skinKeys:0, badge:'first_recruit',       title:null,              label:'First Recruit!' },
  { count:3,  pp:200,  skinKeys:0, badge:'recruiter',           title:null,              label:'Recruiter' },
  { count:5,  pp:300,  skinKeys:1, badge:'dedicated_recruiter', title:null,              label:'Dedicated Recruiter' },
  { count:10, pp:500,  skinKeys:2, badge:'talent_scout',        title:'the_recruiter',   label:'Talent Scout' },
  { count:25, pp:1000, skinKeys:3, badge:'legendary_recruiter', title:'the_legendary',   label:'Legend Maker' },
];

// Get referrer username from URL — called before registration
function getReferralFromURL() {
  try {
    var match = window.location.search.match(/[?&]ref=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch(e) { return null; }
}

// Called after login — checks and fires any unclaimed tier rewards
async function initReferralSystem(userId) {
  if (!userId) return;
  try {
    var res = await supabaseClient
      .from('players')
      .select('referral_count, referral_rewards_claimed')
      .eq('id', userId)
      .single();
    if (!res.data) return;

    var count   = res.data.referral_count || 0;
    var claimed = res.data.referral_rewards_claimed || [];

    for (var i = 0; i < REFERRAL_TIERS.length; i++) {
      var tier = REFERRAL_TIERS[i];
      if (count >= tier.count && claimed.indexOf(tier.count) === -1) {
        await referralClaimTier(tier, claimed);
        claimed = claimed.concat([tier.count]);
      }
    }
  } catch(e) { console.error('[Referral] initReferralSystem error:', e); }
}

async function referralClaimTier(tier, alreadyClaimed) {
  if (!currentUser) return;
  try {
    // Use secure RPC to award — idempotent, won't double-pay
    var res = await supabaseClient.rpc('referral_claim_tier', {
      p_tier_count: tier.count,
      p_pp:         tier.pp,
      p_skin_keys:  tier.skinKeys
    }).catch(function(){ return null; });

    if (!res || !res.data || res.data.already_claimed) return;

    // Update PP display
    if (res.data.new_pp !== undefined) updateAllPoints(res.data.new_pp);

    // Award badge
    if (tier.badge) await awardBadge(tier.badge).catch(function(){});

    // Award title + celebration
    if (tier.title) {
      await awardPlayerTitle(tier.title, 'Referral milestone').catch(function(){});
      showRareCelebration({
        title: tier.label + ' — ' + tier.count + ' Referrals!',
        subtitle: '+' + tier.pp + ' PP' + (tier.skinKeys > 0 ? ' + ' + tier.skinKeys + ' Skin Key' + (tier.skinKeys > 1 ? 's' : '') : '') + ' + title unlocked!',
        icon: '🌟', rarity: 'legendary',
        shareText: 'I just hit ' + tier.count + ' referrals in PawketPetsVT and unlocked "' + tier.title.replace(/_/g,' ') + '"! 🌟 #PawketPetsVT'
      });
    } else {
      showToast('🎉 ' + tier.label + '! ' + tier.count + ' referral' + (tier.count > 1 ? 's' : '') + '! +' + tier.pp + ' PP' + (tier.skinKeys > 0 ? ' +' + tier.skinKeys + ' Skin Key' + (tier.skinKeys > 1 ? 's' : '') : '') + '!', 6000);
    }
  } catch(e) { console.error('[Referral] claimTier error:', e); }
}

// Render the referral widget (shown on profile or home page)
function renderReferralWidget(mountId) {
  var mount = document.getElementById(mountId);
  if (!mount || !currentUser || !currentUsername) return;

  var refLink = 'https://pawketpets.net?ref=' + encodeURIComponent(currentUsername);
  var count   = 0; // pulled from DB on render

  supabaseClient.from('players').select('referral_count').eq('id', currentUser.id).single()
    .then(function(res) {
      count = (res.data && res.data.referral_count) || 0;

      // Find next unclaimed tier
      var nextTier = REFERRAL_TIERS.find(function(t) { return t.count > count; });

      var html =
        '<div style="background:rgba(153,102,255,0.06);border:1px solid rgba(153,102,255,0.2);border-radius:14px;padding:14px 16px;">' +
          '<div style="font-size:0.82rem;font-weight:700;color:var(--purple-dark);margin-bottom:8px;">🌟 Refer a Friend</div>' +
          '<div style="font-size:0.78rem;color:var(--text-light);margin-bottom:10px;">Share your link — earn PP, Skin Keys, and exclusive titles!</div>' +
          // Referral link box
          '<div style="display:flex;gap:6px;margin-bottom:10px;">' +
            '<input readonly value="' + escapeHtml(refLink) + '" style="flex:1;border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-size:0.72rem;background:var(--bg);color:var(--text);min-width:0;" id="referral-link-input" />' +
            '<button class="btn btn-outline btn-sm" onclick="referralCopyLink()" style="flex-shrink:0;font-size:0.72rem;padding:6px 10px;">📋 Copy</button>' +
          '</div>' +
          // Count
          '<div style="font-size:0.78rem;margin-bottom:8px;">Referrals so far: <strong style="color:var(--purple);">' + count + '</strong>' +
            (nextTier ? ' <span style="color:var(--text-light);">(' + (nextTier.count - count) + ' more for next reward)</span>' : ' <span style="color:#ffd700;">✨ All tiers claimed!</span>') +
          '</div>' +
          // Tier list
          '<div style="display:grid;gap:4px;">' +
            REFERRAL_TIERS.map(function(t) {
              var done = count >= t.count;
              return '<div style="display:flex;align-items:center;gap:8px;font-size:0.72rem;opacity:' + (done ? '1' : '0.55') + ';">' +
                '<span>' + (done ? '✅' : '⬜') + '</span>' +
                '<span style="color:' + (done ? 'var(--purple)' : 'var(--text)') + ';font-weight:' + (done ? '700' : '400') + ';">' +
                  t.count + ' referral' + (t.count > 1 ? 's' : '') + ' — ' + t.pp + ' PP' +
                  (t.skinKeys > 0 ? ' + ' + t.skinKeys + ' Skin Key' + (t.skinKeys > 1 ? 's' : '') : '') +
                  (t.title ? ' + <em>' + t.title.replace(/_/g,' ') + '</em> title' : '') +
                '</span>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>';

      mount.innerHTML = html;
    }).catch(function(){});
}

function referralCopyLink() {
  var inp = document.getElementById('referral-link-input');
  if (!inp) return;
  try {
    navigator.clipboard.writeText(inp.value).then(function() {
      showToast('📋 Referral link copied!', 3000);
    }).catch(function() {
      inp.select(); document.execCommand('copy');
      showToast('📋 Referral link copied!', 3000);
    });
  } catch(e) {
    inp.select(); document.execCommand('copy');
    showToast('📋 Referral link copied!', 3000);
  }
}


function getSocialShareCount() {
  try {
    return parseInt(localStorage.getItem('share_count_' + (currentUser && currentUser.id)) || '0');
  } catch(e) { return 0; }
}

function incrementSocialShareCount() {
  try {
    var count = getSocialShareCount() + 1;
    localStorage.setItem('share_count_' + currentUser.id, count);
    return count;
  } catch(e) { return 0; }
}

async function onSocialShare(platform) {
  if (!currentUser) return;

  // Cooldown check — prevent rapid button mashing for PP
  var now = Date.now();
  if (now - _lastShareTime < SHARE_COOLDOWN_MS) {
    showToast('Thanks for sharing! Reward available again in a moment.', 3000);
    return;
  }
  _lastShareTime = now;

  // Award PP + PassXP
  var ppRes = await supabaseClient.rpc('award_pp_secure', {
    p_amount: SHARE_REWARD_PP,
    p_reason: 'social_share_' + platform
  }).catch(function(){ return null; });
  if (ppRes && ppRes.data !== undefined) updateAllPoints(ppRes.data);

  addPassXP(SHARE_REWARD_PASS_XP, 'social_share').catch(function(){});

  showToast('🎉 Thanks for sharing! +' + SHARE_REWARD_PP + ' PP +' + SHARE_REWARD_PASS_XP + ' Pass XP!', 4000);

  // Increment share count and check milestones
  var newCount = incrementSocialShareCount();
  await checkShareMilestones(newCount);

  // Track in community stats
  community_increment('social_shares', 1);
}

async function checkShareMilestones(count) {
  for (var i = 0; i < SHARE_BADGE_THRESHOLDS.length; i++) {
    var milestone = SHARE_BADGE_THRESHOLDS[i];
    if (count === milestone.count) {
      // Award badge
      if (milestone.badge) {
        await awardBadge(milestone.badge).catch(function(){});
      }
      // Award title if applicable
      if (milestone.title) {
        await awardPlayerTitle(milestone.title, 'Social sharing milestone').catch(function(){});
        showRareCelebration({
          title: 'Title Unlocked!',
          subtitle: '"' + milestone.title + '" — earned by sharing ' + count + ' times!',
          icon: '📢', rarity: 'rare',
          shareText: 'I just unlocked the "' + milestone.title + '" title in PawketPetsVT for spreading the word! #PawketPetsVT'
        });
      } else {
        showToast('📢 ' + milestone.label + ' badge earned for sharing ' + count + ' time' + (count > 1 ? 's' : '') + '!', 5000);
      }
      break;
    }
  }
}

// Core share functions — open social media with pre-filled text, reward on click
function shareToTwitter(text, rewardPlayer) {
  var url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(
    text + '

https://pawketpets.net'
  );
  window.open(url, '_blank', 'width=600,height=400,noopener');
  if (rewardPlayer) onSocialShare('twitter').catch(function(){});
}

function shareToBluesky(text, rewardPlayer) {
  var url = 'https://bsky.app/intent/compose?text=' + encodeURIComponent(
    text + '

https://pawketpets.net'
  );
  window.open(url, '_blank', 'width=600,height=400,noopener');
  if (rewardPlayer) onSocialShare('bluesky').catch(function(){});
}

// Badge share helpers (used by showBadgeNotification)
function shareBadgeToTwitter(badgeName, badgeIcon) {
  shareToTwitter('I just earned the "' + badgeName + '" badge ' + badgeIcon + ' in PawketPetsVT! Come play!', true);
}

function shareBadgeToBluesky(badgeName, badgeIcon) {
  shareToBluesky('I just earned the "' + badgeName + '" badge ' + badgeIcon + ' in PawketPetsVT! Come play!', true);
}

// ═══════════════════════════════════════════════════════════════════════════
// UNLOCK CELEBRATION SYSTEM
// Central handler for all reward unlocks — badge, title, cosmetic
// Shows a rich notification with context-aware nav button + nav flash
// ═══════════════════════════════════════════════════════════════════════════

var _navFlashTimers = {}; // track active flashes so we don't stack them

function flashNavButton(tab, duration) {
  // Add pulsing attention dot to the sidebar nav button
  var btn = document.getElementById('sidebar-btn-' + tab);
  if (!btn) return;

  // Add notification dot if not already there
  if (!btn.querySelector('.nav-attention-dot')) {
    var dot = document.createElement('span');
    dot.className = 'nav-attention-dot';
    btn.appendChild(dot);
  }

  // Clear any existing timer for this tab
  if (_navFlashTimers[tab]) clearTimeout(_navFlashTimers[tab]);

  // Remove dot after duration
  _navFlashTimers[tab] = setTimeout(function() {
    var d = btn.querySelector('.nav-attention-dot');
    if (d) d.remove();
    delete _navFlashTimers[tab];
  }, duration || 10000);
}

function clearNavFlash(tab) {
  var btn = document.getElementById('sidebar-btn-' + tab);
  if (!btn) return;
  var dot = btn.querySelector('.nav-attention-dot');
  if (dot) dot.remove();
  if (_navFlashTimers[tab]) {
    clearTimeout(_navFlashTimers[tab]);
    delete _navFlashTimers[tab];
  }
}

// ── GENERIC RARE MOMENT CELEBRATION ─────────────────────────────────────────
// Call this for any big moment: legendary catch, level milestone, skin key, etc.
// data = { title, subtitle, icon, rarity, shareText, color }
// rarity: 'uncommon'|'rare'|'epic'|'legendary'

var RARITY_COLORS = {
  uncommon:  '#5cb85c',
  rare:      '#9966ff',
  epic:      '#ff9f43',
  legendary: '#ffd700'
};

function showRareCelebration(data) {
  var color = data.color || RARITY_COLORS[data.rarity] || '#9966ff';
  var rarityLabel = data.rarity ? data.rarity.toUpperCase() + '!' : 'UNLOCKED!';

  // Remove any existing celebration
  var existing = document.getElementById('rare-celebration-modal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'rare-celebration-modal';
  modal.style.cssText = [
    'position:fixed', 'top:50%', 'left:50%',
    'transform:translate(-50%,-52%) scale(0.85)',
    'z-index:9800',
    'background:var(--white)',
    'border:3px solid ' + color,
    'border-radius:24px',
    'padding:28px 32px 24px',
    'text-align:center',
    'min-width:300px',
    'max-width:420px',
    'width:90vw',
    'box-shadow:0 12px 48px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)',
    'opacity:0',
    'transition:transform 0.35s cubic-bezier(0.34,1.56,0.64,1),opacity 0.25s ease'
  ].join(';');

  var shareText = data.shareText ||
    'I just got a ' + data.rarity + ' moment in PawketPetsVT! ' + (data.icon || '✨') +
    ' ' + data.title + ' — ' + data.subtitle + ' 🐾 #PawketPetsVT';

  modal.innerHTML =
    '<button onclick="rareCelebrationDismiss()" style="position:absolute;top:10px;right:14px;background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--text-light);">✕</button>' +
    // Rarity badge
    '<div style="display:inline-block;background:' + color + '22;color:' + color + ';border:2px solid ' + color + ';border-radius:20px;padding:3px 14px;font-size:0.7rem;font-weight:800;letter-spacing:2px;margin-bottom:12px;">' + rarityLabel + '</div>' +
    // Main icon
    '<div style="font-size:3.5rem;line-height:1;margin-bottom:8px;" id="rare-cel-icon">' + (data.icon || '✨') + '</div>' +
    // Title
    '<div style="font-size:1.3rem;font-weight:800;color:var(--purple-dark);margin-bottom:4px;">' + escapeHtml(data.title) + '</div>' +
    // Subtitle
    '<div style="font-size:0.9rem;color:' + color + ';font-weight:600;margin-bottom:16px;">' + escapeHtml(data.subtitle) + '</div>' +
    // Share buttons
    '<div style="margin-bottom:6px;">' +
      '<div style="font-size:0.68rem;color:var(--text-light);margin-bottom:6px;">Share for <strong style=\"color:#5dde7a;\">+100 PP</strong> + <strong style=\"color:#9966ff;\">+10 Pass XP</strong></div>' +
      '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
        '<button class="btn-social-mini btn-twitter" onclick="shareToTwitter(' + JSON.stringify(shareText) + ', true)" style="font-size:0.78rem;padding:6px 14px;">🐦 Tweet</button>' +
        '<button class="btn-social-mini btn-bluesky" onclick="shareToBluesky(' + JSON.stringify(shareText) + ', true)" style="font-size:0.78rem;padding:6px 14px;">🦋 Post</button>' +
      '</div>' +
    '</div>' +
    '<button class="btn btn-outline btn-sm" onclick="rareCelebrationDismiss()" style="width:100%;font-size:0.82rem;">Continue</button>';

  document.body.appendChild(modal);

  // Animate in
  requestAnimationFrame(function() {
    modal.style.opacity = '1';
    modal.style.transform = 'translate(-50%,-50%) scale(1)';
  });

  // Confetti burst
  if (data.rarity === 'legendary' || data.rarity === 'epic') {
    if (typeof startConfetti === 'function') {
      startConfetti();
      setTimeout(function() { if (typeof stopConfetti === 'function') stopConfetti(); }, 2500);
    }
  }

  // Auto-dismiss after 15s
  modal._autoDismiss = setTimeout(rareCelebrationDismiss, 15000);
}

function rareCelebrationDismiss() {
  var modal = document.getElementById('rare-celebration-modal');
  if (!modal) return;
  if (modal._autoDismiss) clearTimeout(modal._autoDismiss);
  modal.style.opacity = '0';
  modal.style.transform = 'translate(-50%,-50%) scale(0.9)';
  setTimeout(function() { if (modal.parentNode) modal.parentNode.removeChild(modal); }, 300);
}

function showUnlockCelebration(unlockType, data, extra) {
  // unlockType: 'cosmetic' | 'title' | 'badge' (badge uses showBadgeNotification directly)
  // For cosmetics: data = type ('background'|'frame'|'badge'), extra = cosmeticId
  // For titles: data = title object, extra = reason string

  var title, subtitle, icon, navTab, navLabel, color;

  if (unlockType === 'cosmetic') {
    var cosmeticType = data;
    var cosmeticId = extra;

    // Look up the cosmetic in COSMETICS_CATALOG for display info
    var cosmeticItem = null;
    if (typeof COSMETICS_CATALOG !== 'undefined') {
      var allItems = (COSMETICS_CATALOG.backgrounds || [])
        .concat(COSMETICS_CATALOG.frames || [])
        .concat(COSMETICS_CATALOG.badges || [])
        .concat(COSMETICS_CATALOG.themes || []);
      cosmeticItem = allItems.find(function(c) { return c.id === cosmeticId; });
    }

    var typeLabels = {
      background: { label: 'Profile Background', icon: '🖼️', color: '#9966ff' },
      frame:      { label: 'Profile Frame',      icon: '✨', color: '#ff6eb4' },
      badge:      { label: 'Profile Badge',       icon: '🏅', color: '#f0a500' },
      theme:      { label: 'UI Theme',            icon: '🎨', color: '#44aaff' }
    };
    var typeInfo = typeLabels[cosmeticType] || { label: 'Cosmetic', icon: '🎨', color: '#9966ff' };

    title = typeInfo.label + ' Unlocked!';
    subtitle = cosmeticItem ? cosmeticItem.name : cosmeticId;
    icon = typeInfo.icon;
    color = typeInfo.color;
    navTab = 'profile';
    navLabel = 'Customize Profile →';

  } else if (unlockType === 'title') {
    var titleObj = data;
    var rarityColors = { common:'#8e8e8e', uncommon:'#5cb85c', rare:'#5bc0de', epic:'#9c27b0', legendary:'#ff9800' };
    color = titleObj.color || rarityColors[(titleObj.rarity||'').toLowerCase()] || '#9966ff';
    title = 'Title Unlocked!';
    subtitle = (titleObj.icon || '👑') + ' ' + titleObj.display_name;
    icon = '👑';
    navTab = 'profile';
    navLabel = 'Set as Active →';
  } else {
    return; // badges handled by showBadgeNotification
  }

  // Play celebration sound
  if (typeof playChiptune === 'function') playChiptune('badge');

  // Build the notification panel
  var panel = document.createElement('div');
  panel.className = 'unlock-celebration-panel';
  panel.innerHTML =
    '<button class="unlock-dismiss-btn" onclick="this.closest(&quot;.unlock-celebration-panel&quot;).remove()" title="Dismiss">✕</button>' +
    '<div class="unlock-cel-icon">' + icon + '</div>' +
    '<div class="unlock-cel-body">' +
      '<div class="unlock-cel-title">' + escapeHtml(title) + '</div>' +
      '<div class="unlock-cel-subtitle" style="color:' + color + ';">' + escapeHtml(subtitle) + '</div>' +
      '<button class="unlock-cel-nav-btn" onclick="showTab(&quot;' + navTab + '&quot;);this.closest(&quot;.unlock-celebration-panel&quot;).remove();clearNavFlash(&quot;' + navTab + '&quot;);">' +
        navLabel +
      '</button>' +
    '</div>';

  document.body.appendChild(panel);

  // Animate in
  setTimeout(function() { panel.classList.add('show'); }, 10);

  // Auto-dismiss after 10 seconds
  setTimeout(function() {
    panel.classList.remove('show');
    setTimeout(function() { if (panel.parentNode) panel.remove(); }, 400);
  }, 10000);

  // Flash the nav button
  flashNavButton(navTab, 12000);

  // Mini confetti burst
  if (typeof startConfetti === 'function') {
    startConfetti();
    setTimeout(function() { if (typeof stopConfetti === 'function') stopConfetti(); }, 2000);
  }
}

function showBadgeNotification(badge) {
  // Store for potential sharing
  lastUnlockedBadge = badge;
  
  playChiptune('badge');

  var notification = makeEl('div', {class: 'badge-notification'});
  notification.style.position = 'relative';
  notification.innerHTML = `
    <button class="celebration-dismiss-btn" onclick="this.closest('.badge-notification').remove()" title="Dismiss" style="top:6px;right:6px;width:24px;height:24px;font-size:12px;">✕</button>
    <div class="badge-notif-icon">${badge.icon}</div>
    <div class="badge-notif-content">
      <div class="badge-notif-title">Badge Earned!</div>
      <div class="badge-notif-name">${badge.name}</div>
      <div class="badge-notif-desc">${badge.description || ''}</div>
      <div class="badge-notif-share">
        <button class="btn-social-mini btn-twitter" onclick="shareBadgeToTwitter('${badge.name}', '${badge.icon}')">
          🐦 Tweet
        </button>
        <button class="btn-social-mini btn-bluesky" onclick="shareBadgeToBluesky('${badge.name}', '${badge.icon}')">
          🦋 Post
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(function() { notification.classList.add('show'); }, 10);
  
  // Remove after 12 seconds
  setTimeout(function() {
    notification.classList.remove('show');
    setTimeout(function() { if (notification.parentNode) notification.remove(); }, 300);
  }, 12000);

  // Flash the profile nav button so player knows where to find their badge
  flashNavButton('profile', 8000);
}

// ── MINIGAMES ────────────────────────────
function gck(game){return 'game_'+game+'_'+(currentUser?currentUser.id:'')+'_'+today;}
function isCD(game){return localStorage.getItem(gck(game))==='done';}
function setCD(game){localStorage.setItem(gck(game),'done');}

function initMinigames() {
  if(isCD('dice')){el('roll-btn').style.display='none';el('dice-cooldown').style.display='block';}
  if(isCD('guess')){el('guess-play').style.display='none';el('guess-cooldown').style.display='block';}
  else initGuess();
  if(isCD('memory')){el('memory-play').style.display='none';el('memory-cooldown').style.display='block';}
  else initMemory();
  // Init fishing (async DB load)
  fishingLoadCollection().then(function() {
    fishingRenderRodShop();
    autoFisherRenderWidget();
    fishingRenderJournal();
    fishingUpdateAreaStatus();
  }).catch(function(){});
  fishingCasts = fishingGetRodCasts();
  var castsEl = el('fishing-casts');
  if (castsEl) castsEl.textContent = fishingCasts;
  if (isCD('fishing')) {
    var fp = el('fishing-play'); if(fp) fp.style.display='none';
    var fc = el('fishing-cooldown'); if(fc) fc.style.display='block';
  } else {
    var fp2 = el('fishing-play'); if(fp2) fp2.style.display='block';
    var fc2 = el('fishing-cooldown'); if(fc2) fc2.style.display='none';
  }
  // (rod shop, journal, area status rendered in fishingLoadCollection().then() above)
  autoFisherCheck().catch(function(){});
  // Update collection count display
  var totalFish = FISH_POOL.filter(function(f){return f.rarity!=='junk';}).length;
  var collected = Object.keys(_fishCollection).filter(function(k){
    var f = FISH_POOL.find(function(ff){return ff.id===k;});
    return f && f.rarity!=='junk';
  }).length;
  var collEl = el('fishing-collection');
  if (collEl) collEl.textContent = collected + '/' + totalFish + ' fish found';
}

// ── FISH JOURNAL ──────────────────────────────────────────────────────────
function fishingRenderJournal(spotFilter) {
  var mount = document.getElementById('fishing-journal-mount');
  if (!mount) return;
  fishingLoadCollection();
  spotFilter = spotFilter || 'all';
  var rarityColors = { common:'#5dde7a', uncommon:'#4dabf7', rare:'#9966ff', epic:'#ff9f43', legendary:'#ffd700' };
  var rarityLabels = { common:'Common', uncommon:'Uncommon', rare:'Rare', epic:'Epic', legendary:'Legendary' };
  var fishToShow = FISH_POOL.filter(function(f) {
    if (f.rarity === 'junk' || f.id === '__item__') return false;
    if (spotFilter !== 'all' && f.spots.indexOf(spotFilter) === -1) return false;
    return true;
  });
  var rarityOrder = { common:0, uncommon:1, rare:2, epic:3, legendary:4 };
  fishToShow.sort(function(a, b) {
    var aCaught = !!_fishCollection[a.id], bCaught = !!_fishCollection[b.id];
    if (aCaught !== bCaught) return bCaught ? 1 : -1;
    return (rarityOrder[a.rarity]||0) - (rarityOrder[b.rarity]||0);
  });
  var collected = fishToShow.filter(function(f){ return _fishCollection[f.id]; }).length;
  var totalInFilter = fishToShow.length;
  var pct = totalInFilter > 0 ? Math.round(collected / totalInFilter * 100) : 0;

  var html = '<div>';
  // Spot filter tabs
  html += '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px;">';
  ['all','pond','river','lake','ocean'].forEach(function(spot) {
    var label = { all:'🌊 All', pond:'🏞️ Pond', river:'🏔️ River', lake:'🌊 Lake', ocean:'🌊 Ocean' }[spot];
    var spotFishArr = spot === 'all'
      ? FISH_POOL.filter(function(f){ return f.rarity!=='junk'&&f.id!=='__item__'; })
      : (FISH_BY_SPOT[spot]||[]).map(function(id){ return FISH_POOL.find(function(f){ return f.id===id; }); }).filter(Boolean);
    var spotC = spotFishArr.filter(function(f){ return f&&_fishCollection[f.id]; }).length;
    var active = spotFilter===spot;
    html += '<button onclick="fishingRenderJournal(\"' + spot + '\"  )" style="padding:4px 10px;border-radius:8px;font-size:0.7rem;cursor:pointer;' +
      'border:2px solid '+(active?'var(--purple)':'var(--border)')+';background:'+(active?'rgba(153,102,255,0.15)':'var(--white)')+';font-weight:'+(active?'700':'500')+';color:var(--text);">' +
      label+' <span style="color:var(--text-light);">('+spotC+'/'+spotFishArr.length+')</span></button>';
  });
  html += '</div>';
  // Progress bar
  html += '<div style="background:var(--border);border-radius:8px;height:8px;overflow:hidden;margin-bottom:4px;">' +
    '<div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,var(--purple),var(--pink));border-radius:8px;"></div></div>';
  html += '<div style="font-size:0.72rem;color:var(--text-light);margin-bottom:10px;">'+collected+' / '+totalInFilter+' discovered ('+pct+'%)</div>';
  // Fish grid
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(85px,1fr));gap:6px;">';
  fishToShow.forEach(function(fish) {
    var isCaught = !!_fishCollection[fish.id];
    var count = isCaught ? _fishCollection[fish.id].count : 0;
    var color = rarityColors[fish.rarity]||'#888';
    var weatherHint = fish.weather ? ' 🌤️' : '';
    var spotHint = fish.spots ? fish.spots.join(', ') : '';
    var bestW = isCaught && _fishCollection[fish.id] && _fishCollection[fish.id].bestWeight
      ? _fishCollection[fish.id].bestWeight : null;
    html += '<div title="'+fish.name+(fish.weather?' — '+fish.weather+' weather only':'')+' — '+spotHint+'" style="' +
      'background:'+(isCaught?'rgba(153,102,255,0.06)':'rgba(0,0,0,0.03)')+';' +
      'border:2px solid '+(isCaught?color+'60':'var(--border)')+';border-radius:10px;padding:8px 4px;text-align:center;opacity:'+(isCaught?'1':'0.45')+';cursor:default;">' +
      '<div style="font-size:1.5rem;'+(isCaught?'':'filter:grayscale(1);')+'">'+(isCaught?fish.emoji:'❓')+'</div>' +
      '<div style="font-size:0.6rem;font-weight:700;color:'+(isCaught?'var(--text)':'var(--text-light)')+';line-height:1.3;margin-top:2px;">'+(isCaught?fish.name:'???')+'</div>' +
      '<div style="font-size:0.56rem;color:'+color+';font-weight:600;">'+rarityLabels[fish.rarity]+weatherHint+'</div>' +
      (isCaught?'<div style="font-size:0.56rem;color:var(--text-light);">×'+count+(bestW?' · PB: '+fishingFormatWeight(bestW):'')+'</div>':'')+
    '</div>';
  });
  html += '</div></div>';
  mount.innerHTML = html;
}

// ── ROD SHOP ──────────────────────────────────────────────────────────────
async function fishingUpgradeRod() {
  var nextLevel = _fishingRodLevel + 1;
  if (nextLevel > 4) { showToast('You already have the best rod! 🎣', 3000); return; }
  var rod = FISHING_RODS[nextLevel];
  if (!rod) return;
  if (currentPoints < rod.cost) { showToast('Need ' + rod.cost + ' PP to buy the ' + rod.name + '!', 3000); return; }
  if (!confirm('Buy ' + rod.emoji + ' ' + rod.name + ' for ' + rod.cost + ' PP?\n' + rod.desc)) return;
  // Use secure RPC — validates PP server-side, won't allow skipping levels
  var res = await supabaseClient.rpc('fishing_upgrade_rod', {
    p_next_level: nextLevel, p_cost: rod.cost
  }).catch(function(){ return null; });
  if (!res || res.error || (res.data && res.data.error)) {
    showToast('Could not purchase: ' + ((res && res.data && res.data.error) || 'try again'), 3000);
    return;
  }
  _fishingRodLevel = nextLevel;
  if (res.data && res.data.new_pp !== undefined) updateAllPoints(res.data.new_pp);
  showToast('🎣 Upgraded to ' + rod.name + '! Junk rate reduced!', 5000);
  showMelonMessage('Nice rod! The ' + rod.name + ' should help a lot. 🍉', { displayMs: 6000 });
  fishingRenderRodShop();
}

function fishingRenderRodShop() {
  var mount = document.getElementById('fishing-rod-shop');
  if (!mount) return;
  var current = FISHING_RODS[_fishingRodLevel];
  var junkRate = (FISHING_JUNK_RATES[_fishingRodLevel]||FISHING_JUNK_RATES[1])[_fishingBait||'worm']||0.45;
  var html = '<div style="font-size:0.75rem;font-weight:700;color:var(--purple-dark);margin-bottom:4px;">🎣 Your Rod</div>';
  html += '<div style="font-size:0.78rem;margin-bottom:4px;"><strong>'+current.emoji+' '+current.name+'</strong></div>';
  html += '<div style="font-size:0.68rem;color:var(--text-light);margin-bottom:6px;" id="fishing-junk-rate">'+Math.round(junkRate*100)+'% junk chance with current bait</div>';
  if (_fishingRodLevel < 4) {
    var next = FISHING_RODS[_fishingRodLevel+1];
    html += '<button class="btn btn-outline btn-sm" onclick="fishingUpgradeRod()" style="width:100%;font-size:0.7rem;">⬆️ '+next.name+' — '+next.cost+' PP</button>';
  } else {
    html += '<div style="font-size:0.7rem;color:#ffd700;">✨ Max rod level!</div>';
  }
  mount.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════════════════
// AUTO-FISHER SYSTEM
// Purchased upgrade, set-and-forget, completes while away.
// No bait, no timing, slightly worse junk rate than manual fishing.
// ══════════════════════════════════════════════════════════════════════════

var AUTO_FISHER_TIERS = [
  null,
  { level:1, name:'Auto-Fisher I',   cost:500,  dailyCasts:10, junkPenalty:0.18, desc:'10 auto-casts/day. Set and forget!' },
  { level:2, name:'Auto-Fisher II',  cost:1500, dailyCasts:25, junkPenalty:0.12, desc:'25 auto-casts/day.'  },
  { level:3, name:'Auto-Fisher III', cost:4000, dailyCasts:50, junkPenalty:0.08, desc:'50 auto-casts/day.'  },
];

var _autoFisherLevel = 0;    // 0 = not purchased
var _autoFisherState = null; // { startTime, castsTotal, castsLeft, spot, date }

async function autoFisherLoadState() {
  // Level and state are loaded with the player data in fishingLoadRodLevel()
  // This is a no-op but kept for compatibility
}

async function autoFisherSaveState() {
  if (!currentUser) return;
  // Save auto_fisher_state JSON to players table via RPC
  await supabaseClient.rpc('fishing_save_autofisher_state', {
    p_state: _autoFisherState ? JSON.parse(JSON.stringify(_autoFisherState)) : null
  }).catch(function(){});
}

async function autoFisherPurchase() {
  var nextLevel = _autoFisherLevel + 1;
  if (nextLevel > 3) { showToast('Auto-Fisher is maxed out! 🤖', 3000); return; }
  var tier = AUTO_FISHER_TIERS[nextLevel];
  if (!tier) return;
  if (currentPoints < tier.cost) { showToast('Need ' + tier.cost + ' PP for ' + tier.name + '!', 3000); return; }
  if (!confirm('Buy ' + tier.name + ' for ' + tier.cost + ' PP? ' + tier.desc + ' (No bait supported, slightly higher junk rate)')) return;
  var res = await supabaseClient.rpc('fishing_upgrade_autofisher', {
    p_next_level: nextLevel, p_cost: tier.cost
  }).catch(function(){ return null; });
  if (!res || res.error || (res.data && res.data.error)) {
    showToast('Purchase failed: ' + ((res && res.data && res.data.error) || 'try again'), 3000); return;
  }
  _autoFisherLevel = nextLevel;
  if (res.data && res.data.new_pp !== undefined) updateAllPoints(res.data.new_pp);
  showToast('🤖 ' + tier.name + ' activated! ' + tier.dailyCasts + ' auto-casts available daily.', 5000);
  showMelonMessage('Oh! You got the Auto-Fisher! I\'ll keep an eye on it for you. 🍉', { displayMs: 6000 });
  autoFisherRenderWidget();
}

async function autoFisherStart() {
  if (_autoFisherLevel === 0) { showToast('Purchase an Auto-Fisher first!', 3000); return; }
  var tier = AUTO_FISHER_TIERS[_autoFisherLevel];
  var today = new Date().toDateString();
  // Check if already used today
  if (_autoFisherState && _autoFisherState.date === today) {
    if (_autoFisherState.castsLeft > 0) {
      showToast('Auto-Fisher already running! (' + _autoFisherState.castsLeft + ' casts left)', 3000);
    } else {
      showToast('Auto-Fisher already used today. Come back tomorrow! 🤖', 3000);
    }
    return;
  }
  _autoFisherState = {
    startTime: Date.now(),
    castsTotal: tier.dailyCasts,
    castsLeft: tier.dailyCasts,
    spot: _fishingSpot,
    date: today,
    msPerCast: Math.floor((4 * 60 * 60 * 1000) / tier.dailyCasts)
  };
  await autoFisherSaveState();
  showToast('🤖 Auto-Fisher started at ' + _fishingSpot + '! Will cast ' + tier.dailyCasts + ' times over ~4 hours.', 5000);
  autoFisherRenderWidget();
}

async function autoFisherCheck() {
  if (!currentUser || !_autoFisherState) return;
  var today = new Date().toDateString();
  if (_autoFisherState.date !== today) { _autoFisherState = null; autoFisherSaveState(); autoFisherRenderWidget(); return; }
  if (_autoFisherState.castsLeft <= 0) return;

  var elapsed = Date.now() - _autoFisherState.startTime;
  var castsDone = Math.min(_autoFisherState.castsTotal, Math.floor(elapsed / _autoFisherState.msPerCast));
  var newCasts = _autoFisherState.castsTotal - castsDone;

  if (newCasts < _autoFisherState.castsLeft) {
    // Some casts have completed — simulate them
    var completedCount = _autoFisherState.castsLeft - newCasts;
    var tier = AUTO_FISHER_TIERS[_autoFisherLevel];
    var catches = [];
    fishingLoadCollection();

    for (var i = 0; i < completedCount; i++) {
      // Auto-fisher uses no timing, no power — just base junk rate + penalty
      var junkRate = (FISHING_JUNK_RATES[_fishingRodLevel] || FISHING_JUNK_RATES[1]).worm + (tier.junkPenalty || 0.15);
      junkRate = Math.min(0.85, junkRate);
      var caught;
      if (Math.random() < junkRate) {
        var junkPool2 = FISH_POOL.filter(function(f){ return f.rarity==='junk' && f.spots.indexOf(_autoFisherState.spot)!==-1; });
        caught = junkPool2[Math.floor(Math.random()*junkPool2.length)] || FISH_POOL[0];
      } else {
        // Simple random fish from spot (no timing/power bonus)
        caught = fishingGetCatch('ok');
        if (caught.id === '__item__') caught = FISH_POOL.find(function(f){ return f.id==='carp'; });
      }
      if (caught.rarity !== 'junk' && caught.id !== '__item__') {
        var w = fishingRollWeight(caught);
        var szData = fishingWeightCategory(w, caught);
        var pp = Math.round(caught.pp * (szData ? szData.mult : 1));
        catches.push({ name: caught.name, emoji: caught.emoji, pp: pp, rarity: caught.rarity, weight: w });
        if (!_fishCollection[caught.id]) _fishCollection[caught.id] = { count:0, firstCatch:Date.now() };
        _fishCollection[caught.id].count++;
        await awardPP(pp, 'auto_fishing').catch(function(){});
        addPassXP(caught.passXP || 2, 'fishing').catch(function(){});
      }
    }
    fishingSaveCollection();

    _autoFisherState.castsLeft = newCasts;
    await autoFisherSaveState();

    if (catches.length > 0) {
      // Show summary notification
      var summaryLines = catches.slice(0, 8).map(function(c){ return c.emoji + ' ' + c.name + ' (+' + c.pp + ' PP)'; });
      if (catches.length > 8) summaryLines.push('...and ' + (catches.length - 8) + ' more!');
      var totalPP = catches.reduce(function(s,c){ return s+c.pp; }, 0);
      var msg = 'Auto-Fisher caught ' + catches.length + ' fish! (+' + totalPP + ' PP total) ' + summaryLines.join(', ');
      createNotification(currentUser.id, 'auto_fisher', '🤖 Auto-Fisher Update!', msg, 'tab:fishing').catch(function(){});
      if (completedCount === _autoFisherState.castsTotal) {
        // All done!
        showMelonMessage('Your auto-fisher is done for the day! Caught ' + catches.length + ' fish. 🍉', { displayMs: 8000 });
      }
    }
  }

  autoFisherRenderWidget();
}

function autoFisherRenderWidget() {
  var mount = document.getElementById('auto-fisher-mount');
  if (!mount) return;
  autoFisherLoadState();

  var tier = AUTO_FISHER_TIERS[_autoFisherLevel];
  var today = new Date().toDateString();
  var state = (_autoFisherState && _autoFisherState.date === today) ? _autoFisherState : null;

  var html = '<div style="font-size:0.75rem;font-weight:700;color:var(--purple-dark);margin-bottom:6px;">🤖 Auto-Fisher</div>';

  if (_autoFisherLevel === 0) {
    html += '<div style="font-size:0.72rem;color:var(--text-light);margin-bottom:6px;">Automatically catches fish while you're away!</div>';
    html += '<button class="btn btn-outline btn-sm" onclick="autoFisherPurchase()" style="width:100%;font-size:0.72rem;">🤖 Buy Auto-Fisher I — 500 PP</button>';
  } else {
    html += '<div style="font-size:0.72rem;color:var(--text-light);margin-bottom:4px;">Level ' + _autoFisherLevel + ': ' + tier.name + ' — ' + tier.dailyCasts + ' casts/day</div>';
    if (state) {
      var done = state.castsTotal - state.castsLeft;
      var pct  = Math.round(done / state.castsTotal * 100);
      html += '<div style="background:var(--border);border-radius:6px;height:8px;overflow:hidden;margin-bottom:4px;">' +
        '<div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,var(--purple),var(--pink));border-radius:6px;"></div></div>';
      html += '<div style="font-size:0.68rem;color:var(--text-light);margin-bottom:6px;">' + done + '/' + state.castsTotal + ' casts done ('+pct+'%)</div>';
      if (state.castsLeft <= 0) {
        html += '<div style="font-size:0.72rem;color:#5dde7a;">✅ Done for today! Come back tomorrow.</div>';
      }
    } else {
      html += '<div style="font-size:0.72rem;margin-bottom:6px;">Spot: auto-fishes at current selected spot.</div>';
      html += '<button class="btn btn-outline btn-sm" onclick="autoFisherStart()" style="width:100%;font-size:0.72rem;">🤖 Start Auto-Fishing</button>';
    }
    if (_autoFisherLevel < 3) {
      var nextT = AUTO_FISHER_TIERS[_autoFisherLevel+1];
      html += '<button class="btn btn-sm" onclick="autoFisherPurchase()" style="width:100%;margin-top:4px;font-size:0.68rem;background:none;border:1px solid var(--border);">⬆️ Upgrade to Level ' + (_autoFisherLevel+1) + ' — ' + nextT.cost + ' PP</button>';
    }
  }
  mount.innerHTML = html;
}


async function awardPP(amount, reason) {
  if(!currentUser) return;
  if (!reason) reason = 'unknown';
  
  var { data, error } = await supabaseClient.rpc('award_pp_secure', {
    p_amount: amount,
    p_reason: reason
  });
  
  if (error) {
    console.error('PP award error:', error.message);
    showPixelToast('Error awarding points!', 'error');
    return;
  }
  
  currentPoints = data;
  updateAllPoints(data);
  await checkTop10Badge();
}

async function checkTop10Badge() {
  if (!currentUser) return;
  
  var rankRes = await supabaseClient
    .from('players')
    .select('id')
    .order('pawketpoints', { ascending: false })
    .limit(10);
  
  if (rankRes.data) {
    var top10Ids = rankRes.data.map(function(p) { return p.id; });
    if (top10Ids.includes(currentUser.id)) {
      await awardBadge('top_10');
    }
  }
}

var diceFaces=['&#9856;','&#9857;','&#9858;','&#9859;','&#9860;','&#9861;'];
// Dice state for Double or Nothing
var _diceCurrentEarned = 0;
var _diceDoubleOrNothingActive = false;
var _diceRollCount = 0;

async function rollDice() {
  if(isCD('dice'))return;
  _diceCurrentEarned = 0;
  _diceDoubleOrNothingActive = false;
  _diceRollCount = 0;
  _diceDoRoll();
}

function _diceDoRoll() {
  var btn = el('roll-btn'); if(btn) btn.disabled = true;
  var d1=el('die1'); var d2=el('die2');
  var res=el('dice-result'); res.textContent=''; res.style.opacity='0';
  d1.classList.add('rolling'); d2.classList.add('rolling');
  var ri=setInterval(function(){d1.innerHTML=diceFaces[Math.floor(Math.random()*6)];d2.innerHTML=diceFaces[Math.floor(Math.random()*6)];},100);
  setTimeout(async function(){
    clearInterval(ri); d1.classList.remove('rolling'); d2.classList.remove('rolling');
    var v1=Math.floor(Math.random()*6)+1; var v2=Math.floor(Math.random()*6)+1;
    d1.innerHTML=diceFaces[v1-1]; d2.innerHTML=diceFaces[v2-1];
    var total=v1+v2; var isDouble=v1===v2;
    _diceRollCount++;

    // Bust condition: rolled a 1 on either die after first roll during Double or Nothing
    if (_diceDoubleOrNothingActive && (v1===1||v2===1)) {
      res.style.opacity='1';
      res.textContent='💀 Rolled a 1! Lost everything! +0 PP';
      res.style.color='#ff4444';
      _diceCurrentEarned=0;
      await awardBadge('dice_first_play');
      setCD('dice'); onMinigameComplete(0);
      el('dice-don-btns') && (el('dice-don-btns').style.display='none');
      el('dice-cooldown').style.display='block';
      return;
    }

    var earned = isDouble ? total*3 : total;
    if(_diceDoubleOrNothingActive) earned = _diceCurrentEarned * 2;
    _diceCurrentEarned = earned;

    await awardBadge('dice_first_play');
    if(isDouble){
      await awardBadge('lucky_doubles');
      if(v1===1) await awardBadge('snake_eyes');
      if(v1===6) await awardBadge('boxcars');
    }

    res.style.opacity='1';
    var rollDesc = isDouble ? 'DOUBLE '+v1+'s!' : v1+'+'+v2+'='+total;
    res.textContent = rollDesc + ' | Bank: '+earned+' PP';
    res.style.color = isDouble?'#b06aff':'#5dde7a';

    // Show Double or Nothing buttons (up to 4 times max)
    var donBtns = el('dice-don-btns');
    if(donBtns && _diceRollCount < 4) {
      donBtns.style.display='flex';
      donBtns.innerHTML =
        '<button class="btn btn-primary" style="flex:1;font-size:0.8rem;" onclick="_diceTakeIt()">💰 Take '+earned+' PP</button>' +
        '<button class="btn" style="flex:1;font-size:0.8rem;background:#cc0000;color:#fff;" onclick="_diceDoubleOrNothing()">🎲 Double or Nothing!</button>';
      _diceDoubleOrNothingActive = true;
    } else {
      // Auto-collect on 4th roll
      await _diceTakeIt();
    }
  },1200);
}

async function _diceTakeIt() {
  var donBtns = el('dice-don-btns');
  if(donBtns) donBtns.style.display='none';
  await awardPP(_diceCurrentEarned, 'dice_roll');
  setCD('dice'); onMinigameComplete(_diceCurrentEarned);
  var res=el('dice-result');
  res.textContent='Collected! +'+_diceCurrentEarned+' PP! 💰';
  res.style.color='#5dde7a';
  el('dice-cooldown').style.display='block';
  var rollBtn=el('roll-btn'); if(rollBtn) rollBtn.style.display='none';
}

async function _diceDoubleOrNothing() {
  var res=el('dice-result');
  res.textContent='Going for double! 🎲';
  var donBtns = el('dice-don-btns');
  if(donBtns) donBtns.style.display='none';
  _diceDoubleOrNothingActive = true;
  setTimeout(function(){ _diceDoRoll(); }, 400);
}

var guessAttempts = 0; // Track attempts for badge

function initGuess(){
  secretNumber=Math.floor(Math.random()*100)+1;  // 1-100
  guessesLeft=6;
  guessAttempts=0;
  el('guess-input').value='';
  el('guess-result').textContent='';
  el('attempts-left').textContent='6 guesses remaining';
  el('guess-input').placeholder='1 - 100';
  el('guess-input').max='100';
  // Reset hot/cold indicator
  var hc=el('guess-hotcold'); if(hc) hc.textContent='';
}

async function makeGuess() {
  if(isCD('guess'))return;
  var input=el('guess-input'); var guess=parseInt(input.value);
  var result=el('guess-result'); var attEl=el('attempts-left');
  var hc=el('guess-hotcold');
  if(!guess||guess<1||guess>100){result.textContent='Enter a number 1-100!';result.style.color='#ff6eb4';return;}
  
  guessesLeft--;
  guessAttempts++;
  
  if(guess===secretNumber){
    // Reward gradient: fewer guesses = more PP
    var ppRewards=[100,70,50,35,25,20];
    var earned=ppRewards[Math.min(guessAttempts-1,5)];
    await awardPP(earned, 'guess_game'); setCD('guess'); onMinigameComplete(earned);
    
    await awardBadge('guess_first_play');
    if(guessAttempts===1){
      await awardBadge('first_try');
      var playerRes=await supabaseClient.from('players').select('first_try_wins').eq('id',currentUser.id).maybeSingle();
      var newCount=((playerRes.data&&playerRes.data.first_try_wins)||0)+1;
      await supabaseClient.from('players').update({first_try_wins:newCount}).eq('id',currentUser.id);
      if(newCount>=5) await awardBadge('mind_reader');
    }
    
    if(hc) hc.textContent='';
    result.textContent='Correct in '+guessAttempts+' guess'+(guessAttempts===1?'':'es')+'! +'+earned+' PP! 🎯';
    result.style.color='#5dde7a';
    el('guess-play').style.display='none'; el('guess-cooldown').style.display='block';
    
    if(typeof CompanionBuddy!=='undefined'&&CompanionBuddy.currentCompanionId){
      setTimeout(function(){
        var msgs=["You got it! 🌟","Amazing guess! 🎯","You\'re so smart! 💡","Perfect! ✨"];
        CompanionBuddy.showMessage(msgs[Math.floor(Math.random()*msgs.length)]);
      },500);
    }
  } else if(guessesLeft===0){
    setCD('guess');
    await awardBadge('guess_first_play');
    await awardPP(5,'guess_consolation');
    if(hc) hc.textContent='';
    result.textContent='The number was '+secretNumber+'. +5 PP consolation.'; result.style.color='#ff6eb4';
    el('guess-play').style.display='none'; el('guess-cooldown').style.display='block';
  } else {
    var diff=Math.abs(guess-secretNumber);
    var direction=guess<secretNumber?'Too low! ⬆️':'Too high! ⬇️';
    var temp=diff<=5?'🔥 Hot!':diff<=15?'♨️ Warm':diff<=30?'🌡️ Cool':'🧊 Cold';
    if(hc){ hc.textContent=temp; hc.style.color=diff<=5?'#ff4444':diff<=15?'#ff9900':diff<=30?'#5dde7a':'#88bbff'; }
    result.textContent=direction+' '+guessesLeft+' left.'; result.style.color='#ff9f43';
    attEl.textContent=guessesLeft+' guess'+(guessesLeft===1?'':'es')+' remaining';
    input.value=''; input.focus();
  }
}

function shuffle(arr){var a=arr.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
// Memory combo tracking
var memoryCombo=0; var memoryLastMatchTime=0;

function initMemory(difficulty) {
  if(isCD('memory'))return;
  difficulty = difficulty || 'easy';
  var pairCounts={easy:6,medium:8,hard:12};
  var tryCounts={easy:15,medium:18,hard:24};
  var pairs=pairCounts[difficulty]||6;
  var emojiSet=memoryEmojis.slice(0,pairs);
  memoryCards=shuffle(emojiSet.concat(emojiSet));
  flippedCards=[]; matchedPairs=0; triesLeft=tryCounts[difficulty]||15;
  memoryEarned=0; memoryLocked=false; memoryCombo=0; memoryLastMatchTime=0;
  el('match-count').textContent='0'; el('tries-left').textContent=triesLeft;
  el('memory-earned').textContent='0'; el('memory-result').textContent='';
  el('memory-total-pairs') && (el('memory-total-pairs').textContent=pairs);
  el('memory-difficulty') && (el('memory-difficulty').textContent=difficulty.toUpperCase());
  var grid=el('memory-grid'); grid.innerHTML='';
  memoryCards.forEach(function(em,idx){
    var btn=document.createElement('button'); btn.className='memory-card';
    btn.dataset.idx=idx; btn.dataset.emoji=em; btn.innerHTML='';
    btn.onclick=function(){flipCard(this);}; grid.appendChild(btn);
  });
}
function flipCard(btn) {
  if(memoryLocked||btn.classList.contains('flipped')||btn.classList.contains('matched')||flippedCards.length>=2)return;
  btn.innerHTML=btn.dataset.emoji; btn.classList.add('flipped'); flippedCards.push(btn);
  if(flippedCards.length===2){
    memoryLocked=true; triesLeft--; el('tries-left').textContent=triesLeft;
    if(flippedCards[0].dataset.emoji===flippedCards[1].dataset.emoji){
      flippedCards[0].classList.add('matched'); flippedCards[1].classList.add('matched');
      flippedCards[0].classList.remove('flipped'); flippedCards[1].classList.remove('flipped');
      matchedPairs++; memoryEarned+=5;
      el('match-count').textContent=matchedPairs; el('memory-earned').textContent=memoryEarned;
      flippedCards=[]; memoryLocked=false;
      // Combo: consecutive matches within 3 seconds
      var now=Date.now();
      if(now-memoryLastMatchTime<3000){ memoryCombo++; } else { memoryCombo=1; }
      memoryLastMatchTime=now;
      if(memoryCombo>1){
        var comboBonus=memoryCombo*3;
        memoryEarned+=comboBonus;
        el('memory-earned').textContent=memoryEarned;
        showFlash('memory-result','🔥 Combo x'+memoryCombo+'! +'+comboBonus+' bonus PP!','#ff9f43');
      }
      
      var totalPairs=memoryCards.length/2;
      if(matchedPairs===totalPairs){
        // Game complete!
        awardPP(memoryEarned, 'memory_match'); setCD('memory'); onMinigameComplete(memoryEarned);
        
        // Award badges
        awardBadge('memory_first_play'); // First time playing
        var usedTries = 15 - triesLeft;
        if (usedTries === 6) {
          awardBadge('perfect_memory'); // Perfect game (no mistakes)
        }
        if (usedTries <= 10) {
          awardBadge('speed_matcher'); // Completed in 10 tries or less
        }
        
        var r=el('memory-result');r.textContent='All matched! +'+memoryEarned+' PP!';r.style.color='#5dde7a';el('memory-cooldown').style.display='block';
      }
    } else {
      setTimeout(function(){
        flippedCards[0].innerHTML=''; flippedCards[0].classList.remove('flipped');
        flippedCards[1].innerHTML=''; flippedCards[1].classList.remove('flipped');
        flippedCards=[]; memoryLocked=false;
        if(triesLeft===0&&matchedPairs<6){
          awardPP(memoryEarned, 'memory_match');setCD('memory'); onMinigameComplete(memoryEarned);
          awardBadge('memory_first_play'); // Award badge even if lost
          var r=el('memory-result');r.textContent='Out of tries! Earned '+memoryEarned+' PP.';r.style.color='#ff9f43';el('memory-cooldown').style.display='block';document.querySelectorAll('.memory-card:not(.matched)').forEach(function(c){c.innerHTML=c.dataset.emoji;c.disabled=true;});
        }
      },900);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// NEW MINIGAMES
// ══════════════════════════════════════════════════════════════════════════

// ── TREASURE WHEEL ──────────────────────────────
var wheelSpinning = false;
var wheelPrizes = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

function drawWheel() {
  var canvas = el('wheel-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var centerX = 150, centerY = 150, radius = 140;
  var sliceAngle = (2 * Math.PI) / wheelPrizes.length;
  
  wheelPrizes.forEach(function(prize, i) {
    var startAngle = i * sliceAngle;
    var endAngle = startAngle + sliceAngle;
    
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? '#9966ff' : '#ff66cc';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw text
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(startAngle + sliceAngle / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Fredoka';
    ctx.fillText(prize + ' PP', radius - 40, 5);
    ctx.restore();
  });
  
  // Draw pointer
  ctx.beginPath();
  ctx.moveTo(centerX, 10);
  ctx.lineTo(centerX - 10, 30);
  ctx.lineTo(centerX + 10, 30);
  ctx.closePath();
  ctx.fillStyle = '#ffdd00';
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function spinWheel() {
  if (wheelSpinning || isCD('wheel')) return;
  wheelSpinning = true;
  
  var btn = el('wheel-btn');
  btn.disabled = true;
  btn.textContent = 'Spinning...';
  
  var canvas = el('wheel-canvas');
  var winningIndex = Math.floor(Math.random() * wheelPrizes.length);
  var winningPrize = wheelPrizes[winningIndex];
  var rotations = 5 + Math.random() * 3;
  
  // Calculate angle so the winning slice ends up at the TOP (12 o'clock position where pointer is)
  // Each slice is (360 / wheelPrizes.length) degrees
  var degreesPerSlice = 360 / wheelPrizes.length;
  var targetAngle = (degreesPerSlice * winningIndex) + (degreesPerSlice / 2);
  
  // We want to rotate so this angle ends up at the top (0 degrees)
  // So we rotate to (360 - targetAngle) to position it correctly
  var finalPosition = 360 - targetAngle;
  var totalRotation = (rotations * 360) + finalPosition;
  
  var startTime = Date.now();
  var duration = 4000;
  
  function animate() {
    var elapsed = Date.now() - startTime;
    var progress = Math.min(elapsed / duration, 1);
    var easeOut = 1 - Math.pow(1 - progress, 3);
    var currentRotation = totalRotation * easeOut;
    
    // Only rotate the canvas (wheel), NOT the pointer
    canvas.style.transform = 'rotate(' + currentRotation + 'deg)';
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      wheelSpinning = false;
      awardPP(winningPrize, 'treasure_wheel'); onMinigameComplete(winningPrize);
      setCD('wheel');
      var r = el('wheel-result');
      r.textContent = 'You won ' + winningPrize + ' PP!';
      r.style.color = '#5dde7a';
      el('wheel-cooldown').style.display = 'block';
      btn.textContent = 'Spin the Wheel!';
    }
  }
  animate();
}

// ── WHACK-A-MOLE ──────────────────────────────
var whackScore = 0;
var whackTimer = null;
var whackInterval = null;

// Whack combo tracking
var whackCombo=0; var whackPPperHit=5;

function startWhack() {
  if (isCD('whack')) return;
  whackScore = 0; whackCombo=0; whackPPperHit=5;
  var timeLeft = 30;
  
  el('whack-score').textContent = '0';
  el('whack-earned').textContent = '0';
  el('whack-time').textContent = timeLeft;
  el('whack-btn').disabled = true;
  el('whack-result').textContent = '';
  
  // Pop moles randomly — 10% chance of golden mole (3x points)
  whackInterval = setInterval(function() {
    var moleId = Math.floor(Math.random() * 6);
    var mole = el('mole-' + moleId);
    if (!mole.classList.contains('active')) {
      var isGolden = Math.random() < 0.10;
      mole.classList.add('active');
      if(isGolden){ mole.classList.add('golden'); mole.dataset.golden='1'; }
      else { mole.classList.remove('golden'); mole.dataset.golden=''; }
      setTimeout(function() {
        mole.classList.remove('active','golden');
        mole.dataset.golden='';
      }, isGolden ? 600 : 800);
    }
  }, 600);
  
  // Timer countdown
  whackTimer = setInterval(function() {
    timeLeft--;
    el('whack-time').textContent = timeLeft;
    if (timeLeft <= 0) {
      endWhack();
    }
  }, 1000);
}

function whackMole(id) {
  var mole = el('mole-' + id);
  if (mole.classList.contains('active')) {
    var isGolden = mole.dataset.golden==='1';
    mole.classList.add('hit');
    mole.classList.remove('active','golden');
    mole.dataset.golden='';
    whackScore++;
    whackCombo++;
    // Combo scaling: 5->10->15 PP per hit at 5/10/20 combo
    if(whackCombo>=20) whackPPperHit=15;
    else if(whackCombo>=10) whackPPperHit=10;
    else whackPPperHit=5;
    var hitPP = isGolden ? whackPPperHit*3 : whackPPperHit;
    fishingTotal = (fishingTotal||0); // don't touch
    var totalEarned = parseInt(el('whack-earned').textContent||'0') + hitPP;
    el('whack-score').textContent = whackScore;
    el('whack-earned').textContent = totalEarned;
    // Flash combo
    if(whackCombo>=5){
      var flash=el('whack-combo-flash');
      if(flash){ flash.textContent=(isGolden?'✨ GOLDEN! ':'')+'x'+whackCombo+' combo! +'+hitPP+' PP';
        flash.style.opacity='1';
        setTimeout(function(){flash.style.opacity='0';},700);
      }
    }
    setTimeout(function() {
      mole.classList.remove('hit');
      mole.style.bottom = '-60px';
    }, 300);
  } else {
    // Miss resets combo
    whackCombo=0; whackPPperHit=5;
  }
}

function endWhack() {
  clearInterval(whackTimer);
  clearInterval(whackInterval);
  var earned = parseInt(el('whack-earned').textContent||'0');
  awardPP(earned, 'whack_a_mole'); onMinigameComplete(earned);
  setCD('whack');
  var r = el('whack-result');
  r.textContent = 'Game over! Whacked '+whackScore+'! +' + earned + ' PP!';
  r.style.color = '#5dde7a';
  el('whack-cooldown').style.display = 'block';
  el('whack-btn').disabled = true;
  document.querySelectorAll('.mole').forEach(function(m) {
    m.classList.remove('active','golden');
    m.dataset.golden='';
  });
}

// ── SHELL GAME ──────────────────────────────
var shellRound = 0;
var shellCorrect = 0;
var shellWinningPos = 0;
var shellShuffling = false;

function startShellGame() {
  if (isCD('shell')) return;
  shellRound = 1;
  shellCorrect = 0;
  el('shell-round').textContent = '1';
  el('shell-result').textContent = '';
  el('shell-btn').style.display = 'none';
  shuffleShells();
}

function shuffleShells() {
  if (shellShuffling) return;
  shellShuffling = true;
  shellWinningPos = Math.floor(Math.random() * 3);
  
  // Show egg under winning shell briefly
  for (var i = 0; i < 3; i++) {
    el('shell-' + i).textContent = i === shellWinningPos ? '🥚✨' : '🥚';
  }
  
  setTimeout(function() {
    // Hide all eggs
    for (var i = 0; i < 3; i++) {
      el('shell-' + i).textContent = '🥚';
    }
    
    // Now perform actual visual swaps
    var shells = [el('shell-0'), el('shell-1'), el('shell-2')];
    var positions = [0, 1, 2]; // Track logical positions
    var swapCount = 8; // Number of swaps to perform
    var swapDelay = 400; // Time between swaps
    var currentSwap = 0;
    
    function performSwap() {
      if (currentSwap >= swapCount) {
        shellShuffling = false;
        return;
      }
      
      // Pick two random positions to swap
      var pos1 = Math.floor(Math.random() * 3);
      var pos2 = Math.floor(Math.random() * 3);
      while (pos1 === pos2) {
        pos2 = Math.floor(Math.random() * 3);
      }
      
      // Animate the swap visually
      var shell1 = shells[pos1];
      var shell2 = shells[pos2];
      
      // Get current positions
      var rect1 = shell1.getBoundingClientRect();
      var rect2 = shell2.getBoundingClientRect();
      var deltaX = rect2.left - rect1.left;
      
      // Apply transform to swap
      shell1.style.transition = 'transform 0.4s ease';
      shell2.style.transition = 'transform 0.4s ease';
      shell1.style.transform = 'translateX(' + deltaX + 'px)';
      shell2.style.transform = 'translateX(' + (-deltaX) + 'px)';
      
      setTimeout(function() {
        // Reset transforms
        shell1.style.transition = 'none';
        shell2.style.transition = 'none';
        shell1.style.transform = '';
        shell2.style.transform = '';
        
        // Actually swap in DOM (so they stay in new positions)
        var parent = shell1.parentNode;
        var shell1Next = shell1.nextSibling;
        var shell2Next = shell2.nextSibling;
        
        if (shell1Next === shell2) {
          parent.insertBefore(shell2, shell1);
        } else if (shell2Next === shell1) {
          parent.insertBefore(shell1, shell2);
        } else {
          parent.insertBefore(shell2, shell1Next);
          parent.insertBefore(shell1, shell2Next);
        }
        
        // Swap in arrays
        var temp = shells[pos1];
        shells[pos1] = shells[pos2];
        shells[pos2] = temp;
        
        var tempPos = positions[pos1];
        positions[pos1] = positions[pos2];
        positions[pos2] = tempPos;
        
        // Track where winning position moved to
        if (positions[pos1] === shellWinningPos) {
          shellWinningPos = pos1;
        } else if (positions[pos2] === shellWinningPos) {
          shellWinningPos = pos2;
        }
        
        currentSwap++;
        setTimeout(performSwap, 100);
      }, swapDelay);
    }
    
    performSwap();
  }, 1000);
}

function guessShell(pos) {
  if (shellShuffling) return;
  
  // Reveal
  el('shell-' + pos).textContent = pos === shellWinningPos ? '🥚✨' : '❌';
  
  if (pos === shellWinningPos) {
    shellCorrect++;
    setTimeout(function() {
      if (shellRound < 3) {
        shellRound++;
        el('shell-round').textContent = shellRound;
        shuffleShells();
      } else {
        // Won all 3 rounds!
        awardPP(30, 'shell_game'); onMinigameComplete(30);
        setCD('shell');
        var r = el('shell-result');
        r.textContent = 'Perfect! +30 PP!';
        r.style.color = '#5dde7a';
        el('shell-cooldown').style.display = 'block';
      }
    }, 1500);
  } else {
    // Lost
    setTimeout(function() {
      setCD('shell');
      var r = el('shell-result');
      r.textContent = 'Wrong! Better luck tomorrow!';
      r.style.color = '#ff6eb4';
      el('shell-cooldown').style.display = 'block';
    }, 1500);
  }
}

// ── SLOT MACHINE ──────────────────────────────────
var slotSpinning = false;
var slotSymbols = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣', '🎰'];
var slotReels = [0, 0, 0]; // Current symbol index for each reel
var selectedSlotBet = 50; // Default bet amount

function selectSlotBet(amount) {
  if (slotSpinning) return;
  selectedSlotBet = amount;
  
  // Update button states
  var buttons = document.querySelectorAll('.bet-btn');
  buttons.forEach(function(btn) {
    btn.classList.remove('active');
    if (parseInt(btn.getAttribute('data-bet')) === amount) {
      btn.classList.add('active');
    }
  });
  
  // Update spin button text
  var spinBtn = el('slot-spin-btn');
  if (spinBtn) {
    spinBtn.textContent = '🎰 Spin! (' + amount + ' PP)';
  }
}

function spinSlots() {
  if (slotSpinning) return;
  
  // Check if user has enough PP
  if (currentPoints < selectedSlotBet) {
    var result = el('slot-result');
    if (result) {
      result.textContent = 'Not enough PP! Need ' + selectedSlotBet + ' PP to play.';
      result.style.color = '#ff6eb4';
    }
    return;
  }
  
  // Deduct bet amount to play
  deductPP(selectedSlotBet);
  
  slotSpinning = true;
  
  var btn = el('slot-spin-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Spinning...';
  }
  
  // Clear previous result
  var result = el('slot-result');
  if (result) {
    result.textContent = '';
  }
  
  var reel1 = el('slot-reel-1');
  var reel2 = el('slot-reel-2');
  var reel3 = el('slot-reel-3');
  
  // Random final positions
  var final = [
    Math.floor(Math.random() * slotSymbols.length),
    Math.floor(Math.random() * slotSymbols.length),
    Math.floor(Math.random() * slotSymbols.length)
  ];
  
  var spins = 0;
  var maxSpins = 20;
  var spinInterval = setInterval(function() {
    // Spin all reels rapidly
    slotReels[0] = Math.floor(Math.random() * slotSymbols.length);
    slotReels[1] = Math.floor(Math.random() * slotSymbols.length);
    slotReels[2] = Math.floor(Math.random() * slotSymbols.length);
    
    if (reel1) reel1.textContent = slotSymbols[slotReels[0]];
    if (reel2) reel2.textContent = slotSymbols[slotReels[1]];
    if (reel3) reel3.textContent = slotSymbols[slotReels[2]];
    
    spins++;
    
    // Stop reels one by one
    if (spins === 15 && reel1) {
      slotReels[0] = final[0];
      reel1.textContent = slotSymbols[final[0]];
    }
    if (spins === 18 && reel2) {
      slotReels[1] = final[1];
      reel2.textContent = slotSymbols[final[1]];
    }
    if (spins >= maxSpins) {
      clearInterval(spinInterval);
      slotReels[2] = final[2];
      if (reel3) reel3.textContent = slotSymbols[final[2]];
      
      // Calculate prizes based on bet amount
      // Match 2 = get bet back (break even)
      // Match 3 = 4x bet (3x profit)
      var grossPrize = 0;
      var netProfit = 0;
      
      if (final[0] === final[1] && final[1] === final[2]) {
        // All three match! 4x payout
        grossPrize = selectedSlotBet * 4;
        netProfit = selectedSlotBet * 3; // 3x profit after cost
      } else if (final[0] === final[1] || final[1] === final[2] || final[0] === final[2]) {
        // Two match - break even
        grossPrize = selectedSlotBet;
        netProfit = 0; // Got bet back
      }
      
      slotSpinning = false;
      
      var result = el('slot-result');
      if (result) {
        if (grossPrize > 0) {
          // Award the gross prize
          awardPP(grossPrize, 'slot_machine');
          
          // WORLD STATE: a real win (not just breaking even) nudges
          // corruption up a little — small, frequent lever ("gambling
          // feeds the dark"), not a dominant one on its own
          if (netProfit > 0 && typeof supabaseClient !== 'undefined') {
            supabaseClient.rpc('nudge_world_state', { p_flag_key: 'corruption_level', p_delta: 0.5 }).catch(function(){});
          }
          
          if (netProfit > 0) {
            result.textContent = '🎉 Triple Match! Won ' + netProfit + ' PP profit! (Paid ' + grossPrize + ' PP total)';
            result.style.color = '#5dde7a';
          } else {
            result.textContent = '🎯 Two Match! Break even - got your ' + selectedSlotBet + ' PP back!';
            result.style.color = '#ffdd57';
          }
        } else {
          // Already deducted bet - show loss
          result.textContent = '❌ No match! Lost ' + selectedSlotBet + ' PP. Try again!';
          result.style.color = '#ff6eb4';
        }
      }
      
      if (btn) {
        btn.textContent = '🎰 Spin! (' + selectedSlotBet + ' PP)';
        btn.disabled = false;
      }
    }
  }, 100);
}

// Helper function to deduct PP
async function deductPP(amount) {
  if (!currentUser) return;
  
  var { data: newPoints, error } = await supabaseClient.rpc('deduct_pp_secure', {
    p_amount: amount,
    p_reason: 'slot_machine'
  });
  
  if (error) {
    console.error('Deduct PP error:', error.message);
    showToast('Error processing bet!', 'error');
    return;
  }
  
  currentPoints = newPoints;
  updateAllPoints(currentPoints);
}

// ── TYPING CHALLENGE ──────────────────────────────
var typingWords = ['Ember', 'Pyxie', 'Embertail', 'Pyxshuul', 'Firefox', 'Sparkle', 'Panda', 'Koala', 'Dragon', 'Phoenix', 'Tiger', 'Leopard', 'Cheetah', 'Panther', 'Wolf', 'Bear', 'Raccoon', 'Otter', 'Seal'];
var typingScore = 0;
var typingTimer = null;
var currentWord = '';

function startTyping() {
  if (isCD('typing')) return;
  typingScore = 0;
  var timeLeft = 60;
  
  el('typing-score').textContent = '0';
  el('typing-earned').textContent = '0';
  el('typing-time').textContent = timeLeft;
  el('typing-input').disabled = false;
  el('typing-input').value = '';
  el('typing-input').focus();
  el('typing-btn').disabled = true;
  el('typing-result').textContent = '';
  
  nextWord();
  
  typingTimer = setInterval(function() {
    timeLeft--;
    el('typing-time').textContent = timeLeft;
    if (timeLeft <= 0) {
      endTyping();
    }
  }, 1000);
}

function nextWord() {
  currentWord = typingWords[Math.floor(Math.random() * typingWords.length)];
  el('typing-target').textContent = currentWord;
}

el('typing-input').addEventListener('input', function() {
  if (el('typing-input').value === currentWord) {
    typingScore++;
    var earned = typingScore * 3;
    el('typing-score').textContent = typingScore;
    el('typing-earned').textContent = earned;
    el('typing-input').value = '';
    nextWord();
  }
});

function endTyping() {
  clearInterval(typingTimer);
  var earned = Math.min(typingScore * 3, 60);
  awardPP(earned, 'typing_challenge'); onMinigameComplete(earned);
  setCD('typing');
  var r = el('typing-result');
  r.textContent = 'Time\'s up! +' + earned + ' PP!';
  r.style.color = '#5dde7a';
  el('typing-cooldown').style.display = 'block';
  el('typing-input').disabled = true;
  el('typing-btn').disabled = true;
}

// ── FISHING GAME — OVERHAULED ──────────────────────────────
// Spots, bait, 24-fish collection, weather modifiers, rod upgrades

var FISH_SPOTS = {
  pond:  { name: '🏞️ Pond',  baseCasts: 8,  baitSlots: ['worm','bread'], description: 'Calm water. Common fish.' },
  river: { name: '🏔️ River', baseCasts: 10, baitSlots: ['bread','lure'], description: 'Fast current. Uncommon fish.' },
  lake:  { name: '🌊 Lake',  baseCasts: 10, baitSlots: ['lure','golden'], description: 'Deep water. Rare fish.' },
  ocean: { name: '🌊 Ocean', baseCasts: 8,  baitSlots: ['lure','golden'], description: 'Legendary catches possible.' }
};

var FISH_BAIT = {
  worm:   { name: '🪱 Worm',         cost: 0,  rarityBoost: 0,    description: 'Free! Catches common fish.' },
  bread:  { name: '🍞 Bread Crumbs', cost: 5,  rarityBoost: 0.05, description: '+5% rare chance.' },
  lure:   { name: '🪝 Fancy Lure',   cost: 15, rarityBoost: 0.12, description: '+12% rare chance.' },
  golden: { name: '✨ Golden Lure',  cost: 40, rarityBoost: 0.25, description: '+25% rare chance.' }
};

// Fish pool — spot:rarity:weather-bonus
var FISH_POOL = [
  // ── JUNK (0 PP, high base weight, reduced by rod/bait) ──────────────────
  { id:'boot',       name:'Old Boot',          emoji:'👢', pp:0,  rarity:'junk', spots:['pond','river','lake','ocean'], weight:40 , wMin:0.5, wMax:2},
  { id:'seaweed',    name:'Seaweed Clump',      emoji:'🌿', pp:0,  rarity:'junk', spots:['pond','river','lake','ocean'], weight:35 , wMin:0.1, wMax:0.5},
  { id:'pebble',     name:'Sparkly Pebble',     emoji:'💎', pp:0,  rarity:'junk', spots:['pond','river'],               weight:28 , wMin:0.05, wMax:0.3},
  { id:'tin_can',    name:'Old Tin Can',         emoji:'🥫', pp:0,  rarity:'junk', spots:['pond','river','lake'],        weight:22 , wMin:0.2, wMax:0.8},
  { id:'lost_sock',  name:'Lost Sock',           emoji:'🧦', pp:0,  rarity:'junk', spots:['pond','river','lake','ocean'], weight:20 , wMin:0.05, wMax:0.2},
  { id:'junk_ad',    name:'Sponsored Content',   emoji:'📢', pp:0,  rarity:'junk', spots:['pond','river','lake','ocean'], weather:'adpocalypse', weight:30 , wMin:0, wMax:0},

  // ── POND ─────────────────────────────────────────────────────────────────
  { id:'carp',       name:'Carp',               emoji:'🐟', pp:4,  rarity:'common',   spots:['pond','river'],             weight:22, passXP:2 , wMin:0.5, wMax:8},
  { id:'bluegill',   name:'Bluegill',            emoji:'🐠', pp:5,  rarity:'common',   spots:['pond','lake'],              weight:20, passXP:2 , wMin:0.2, wMax:2},
  { id:'perch',      name:'Yellow Perch',        emoji:'🐡', pp:6,  rarity:'common',   spots:['pond','river','lake'],      weight:18, passXP:2 , wMin:0.3, wMax:3},
  { id:'sunfish',    name:'Sunfish',             emoji:'☀️', pp:5,  rarity:'common',   spots:['pond'],                    weight:16, passXP:2 , wMin:0.3, wMax:2.5},
  { id:'tadpole',    name:'Giant Tadpole',       emoji:'🐸', pp:3,  rarity:'common',   spots:['pond'],                    weight:14, passXP:2 , wMin:0.02, wMax:0.1},
  { id:'golden_carp',name:'Golden Carp',         emoji:'✨', pp:100,rarity:'legendary', spots:['pond'],                    weight:1,  passXP:30 , wMin:5, wMax:25},

  // ── RIVER ────────────────────────────────────────────────────────────────
  { id:'trout',      name:'Rainbow Trout',       emoji:'🌈', pp:10, rarity:'uncommon', spots:['river'],                   weight:14, passXP:5 , wMin:0.5, wMax:6},
  { id:'catfish',    name:'Catfish',             emoji:'🐈', pp:8,  rarity:'uncommon', spots:['river','lake'],            weight:16, passXP:4 , wMin:1, wMax:20},
  { id:'bass',       name:'Largemouth Bass',     emoji:'🎣', pp:12, rarity:'uncommon', spots:['lake','river'],            weight:12, passXP:5 , wMin:1, wMax:12},
  { id:'salmon',     name:'Atlantic Salmon',     emoji:'🐟', pp:18, rarity:'rare',     spots:['river','ocean'],           weight:7,  passXP:10 , wMin:3, wMax:30},
  { id:'mudskipper', name:'Mudskipper',          emoji:'🦎', pp:9,  rarity:'uncommon', spots:['river'],                   weight:10, passXP:4 , wMin:0.1, wMax:0.8},
  { id:'river_otter',name:'Confused River Otter',emoji:'🦦', pp:15, rarity:'rare',     spots:['river'],                   weight:5,  passXP:10 , wMin:10, wMax:30},

  // ── LAKE ─────────────────────────────────────────────────────────────────
  { id:'pike',       name:'Northern Pike',       emoji:'⚡', pp:14, rarity:'uncommon', spots:['lake'],                    weight:10, passXP:5 , wMin:2, wMax:25},
  { id:'eel',        name:'Electric Eel',        emoji:'⚡', pp:20, rarity:'rare',     spots:['lake','ocean'],            weight:6,  passXP:10 , wMin:1, wMax:8},
  { id:'turtle',     name:'Ancient Turtle',      emoji:'🐢', pp:30, rarity:'epic',     spots:['lake','ocean'],            weight:3,  passXP:18 , wMin:10, wMax:80},
  { id:'pike_king',  name:'Lake King Pike',      emoji:'👑', pp:25, rarity:'rare',     spots:['lake'],                    weight:4,  passXP:12 , wMin:15, wMax:60},
  { id:'blob_fish',  name:'Blobfish',            emoji:'😞', pp:22, rarity:'rare',     spots:['lake','ocean'],            weight:5,  passXP:10 , wMin:1, wMax:9},
  { id:'ghost_fish', name:'Ghost Fish',          emoji:'👻', pp:50, rarity:'legendary', spots:['pond','lake'], weather:'foggy',  weight:4,  passXP:25 , wMin:0.5, wMax:4},
  { id:'void_fish',  name:'Void Fish',           emoji:'🌑', pp:60, rarity:'legendary', spots:['lake','ocean'],weather:'cursed', weight:3,  passXP:25 , wMin:2, wMax:15},

  // ── OCEAN ────────────────────────────────────────────────────────────────
  { id:'swordfish',  name:'Swordfish',           emoji:'🗡️',  pp:25, rarity:'rare',     spots:['ocean'],                   weight:5,  passXP:12 , wMin:50, wMax:400},
  { id:'pufferfish', name:'Pufferfish',          emoji:'🐡', pp:22, rarity:'rare',     spots:['ocean'],                   weight:6,  passXP:10 , wMin:0.5, wMax:5},
  { id:'shark',      name:'Baby Shark',          emoji:'🦈', pp:35, rarity:'epic',     spots:['ocean'],                   weight:3,  passXP:18 , wMin:20, wMax:200},
  { id:'manta',      name:'Manta Ray',           emoji:'🦅', pp:40, rarity:'epic',     spots:['ocean'],                   weight:2,  passXP:20 , wMin:50, wMax:300},
  { id:'octopus',    name:'Octopus',             emoji:'🐙', pp:28, rarity:'rare',     spots:['ocean'],                   weight:4,  passXP:12 , wMin:2, wMax:15},
  { id:'anglerfish', name:'Anglerfish',          emoji:'💡', pp:45, rarity:'epic',     spots:['ocean'],                   weight:2,  passXP:22 , wMin:1, wMax:40},
  { id:'whale',      name:'Tiny Whale',          emoji:'🐋', pp:55, rarity:'epic',     spots:['ocean'],                   weight:1,  passXP:25 , wMin:200, wMax:2000},
  { id:'storm_eel',  name:'Storm Eel',           emoji:'⛈️',  pp:45, rarity:'legendary', spots:['ocean','river'],weather:'windy',  weight:3,  passXP:25 , wMin:5, wMax:50},
  { id:'aurora_cod', name:'Aurora Cod',          emoji:'🌌', pp:55, rarity:'legendary', spots:['ocean'],       weather:'starry', weight:3,  passXP:25 , wMin:2, wMax:20},

  // ── ALL SPOTS ─────────────────────────────────────────────────────────────
  { id:'piper_fish', name:'Unfamiliar Fish',     emoji:'❓', pp:75, rarity:'legendary', spots:['lake','ocean'],            weight:1,  passXP:40 , wMin:0, wMax:0},

  // ── ITEM CATCHES (special, not tracked in collection) ────────────────────
  // These are handled separately in castLine() — listed here for reference only
];

// Fish that can appear in each area's collection journal
var FISH_BY_SPOT = {
  pond:  ['carp','bluegill','perch','sunfish','tadpole','golden_carp','ghost_fish'],
  river: ['carp','perch','trout','catfish','bass','salmon','mudskipper','river_otter','storm_eel'],
  lake:  ['bluegill','perch','catfish','bass','pike','eel','turtle','pike_king','blob_fish','ghost_fish','void_fish'],
  ocean: ['salmon','eel','swordfish','pufferfish','shark','manta','octopus','anglerfish','whale','storm_eel','aurora_cod','void_fish','piper_fish']
};

// Completion rewards per area
var FISH_SPOT_REWARDS = {
  pond:  { pp: 300,  passXP: 50,  label: 'Pond Master' },
  river: { pp: 500,  passXP: 75,  label: 'River Guide' },
  lake:  { pp: 750,  passXP: 100, label: 'Lake Legend' },
  ocean: { pp: 1000, passXP: 150, label: 'Ocean Sovereign' }
};

// Full collection completion
var FISH_FULL_COMPLETION_PP = 2000;
var FISH_FULL_COMPLETION_PASSXP = 300;
var fishingCasts   = 0;   // unlimited now — reset each cast, used for display
var fishingTotal   = 0;   // PP earned this session
var _fishingSpot   = 'pond';
var _fishingBait   = 'worm';
var _fishCollection = {};
var _fishingRodLevel = 1;
var _fishingSessionCasts = 0; // casts this session (for stats display)
var _fishingTimingWindow = false; // true when timing click is active
var _fishingTimingTimer  = null;
var _fishingTimingResult = null; // 'great'|'ok'|'miss'

// Junk rate table [rodLevel][baitKey] → fraction (0-1) chance of junk
var FISHING_JUNK_RATES = {
  1: { worm:0.45, bread:0.30, lure:0.18, golden:0.08 },
  2: { worm:0.35, bread:0.22, lure:0.12, golden:0.05 },
  3: { worm:0.25, bread:0.15, lure:0.08, golden:0.03 },
  4: { worm:0.15, bread:0.09, lure:0.05, golden:0.01 }
};

// Item catch rates [baitKey] → fraction chance of catching an item instead of fish
var FISHING_ITEM_RATES = {
  worm:0.06, bread:0.09, lure:0.11, golden:0.15
};

var FISHING_RODS = [
  null, // index 0 unused
  { level:1, name:'Basic Rod',     emoji:'🎣', desc:'The starter rod.',                cost:0,    baseCasts:8  },
  { level:2, name:'Nice Rod',      emoji:'🎣', desc:'Sturdier. Reduced junk rate.',    cost:500,  baseCasts:8  },
  { level:3, name:'Pro Rod',       emoji:'🎣', desc:'Fisher's choice. Much less junk.',cost:2000, baseCasts:8  },
  { level:4, name:'Legendary Rod', emoji:'✨', desc:'Almost no junk. Melon-approved.',  cost:5000, baseCasts:8  },
];

var _rodCastsBonus = [0, 0, 4, 10, 17]; // extra display casts per rod level (cosmetic)

async function fishingLoadRodLevel() {
  if (!currentUser) return;
  try {
    var res = await supabaseClient
      .from('players')
      .select('fishing_rod_level, auto_fisher_level, auto_fisher_state')
      .eq('id', currentUser.id)
      .single();
    if (res.data) {
      _fishingRodLevel  = Math.min(4, Math.max(1, res.data.fishing_rod_level || 1));
      _autoFisherLevel  = Math.min(3, Math.max(0, res.data.auto_fisher_level || 0));
      _autoFisherState  = res.data.auto_fisher_state || null;
    }
  } catch(e) { /* silent */ }
}

async function fishingSaveRodLevel() { /* rod level is written by fishing_upgrade_rod RPC */ }

function fishingGetRodCasts() {
  // Kept for compatibility but no longer limits — returns display cast count
  var base = (FISH_SPOTS[_fishingSpot] && FISH_SPOTS[_fishingSpot].baseCasts) || 8;
  return base + (_rodCastsBonus[_fishingRodLevel] || 0);
}

function fishingSelectSpot(spot) {
  _fishingSpot = spot;
  document.querySelectorAll('.fishing-spot-btn').forEach(function(b){
    b.classList.toggle('active', b.dataset.spot === spot);
  });
  fishingUpdateAreaStatus();
}

function fishingSelectBait(bait) {
  _fishingBait = bait;
  document.querySelectorAll('.fishing-bait-btn').forEach(function(b){
    b.classList.toggle('active', b.dataset.bait === bait);
  });
  // Show junk rate for current selection
  var rate = (FISHING_JUNK_RATES[_fishingRodLevel] || FISHING_JUNK_RATES[1])[_fishingBait] || 0.45;
  var junkEl = document.getElementById('fishing-junk-rate');
  if (junkEl) junkEl.textContent = Math.round(rate * 100) + '% junk chance';
}

async function fishingLoadCollection() {
  if (!currentUser) return;
  try {
    var res = await supabaseClient
      .from('user_fish_collection')
      .select('fish_id,catch_count,best_weight')
      .eq('user_id', currentUser.id);
    _fishCollection = {};
    if (res.data) {
      res.data.forEach(function(row) {
        _fishCollection[row.fish_id] = {
          count:       row.catch_count,
          bestWeight:  row.best_weight,
          firstCatch:  null // not needed client-side
        };
      });
    }
  } catch(e) { _fishCollection = {}; }
  await fishingLoadRodLevel();
}

// fishingSaveCollection is now a no-op — DB is updated via fishing_record_catch RPC
function fishingSaveCollection() { /* DB-backed now */ }

function fishingUpdateAreaStatus() {
  // Update collection count for current spot
  var spotFish = FISH_BY_SPOT[_fishingSpot] || [];
  var spotCollected = spotFish.filter(function(id){ return _fishCollection[id]; }).length;
  var areaEl = document.getElementById('fishing-area-progress');
  if (areaEl) areaEl.textContent = spotCollected + '/' + spotFish.length + ' in this area';
}

function fishingGetCatch(timingBonus) {
  var spot    = _fishingSpot;
  var bait    = FISH_BAIT[_fishingBait] || FISH_BAIT.worm;
  var weather = (weatherSystem && weatherSystem.currentWeather && weatherSystem.currentWeather.id) || 'clear';
  var rodLevel= _fishingRodLevel;
  var powerBonus = window._castPowerBonus || { junkMult:1, rarityBoost:0 };

  // Fish Frenzy weather bonus
  if (weather === 'fish_frenzy') {
    powerBonus = { junkMult: Math.min(powerBonus.junkMult, 0.5), rarityBoost: (powerBonus.rarityBoost || 0) + 0.20 };
  }

  // 1. Check for ITEM catch
  var itemRate = FISHING_ITEM_RATES[_fishingBait] || 0.06;
  if (timingBonus === 'great') itemRate *= 1.5;
  if (Math.random() < itemRate) return { id:'__item__', rarity:'item' };

  // 2. Check for JUNK
  var junkRate = (FISHING_JUNK_RATES[rodLevel] || FISHING_JUNK_RATES[1])[_fishingBait] || 0.45;
  junkRate *= powerBonus.junkMult;                            // power cast reduces junk
  if (timingBonus === 'great') junkRate *= 0.5;
  if (timingBonus === 'miss')  junkRate = Math.min(0.9, junkRate * 1.5);
  if (Math.random() < junkRate) {
    // Return a junk item
    var junkPool = FISH_POOL.filter(function(f){
      return f.rarity === 'junk' && f.spots.indexOf(spot) !== -1;
      // weather junk only in matching weather
    }).filter(function(f){ return !f.weather || f.weather === weather; });
    return junkPool[Math.floor(Math.random() * junkPool.length)] || FISH_POOL[0];
  }

  // 3. Roll for actual fish
  var pool = FISH_POOL.filter(function(f){
    if (f.rarity === 'junk') return false;
    if (f.id === '__item__') return false;
    if (f.spots.indexOf(spot) === -1) return false;
    if (f.weather && f.weather !== weather) return false;
    return true;
  });

  var rarityBoost = (bait.rarityBoost || 0) + (powerBonus.rarityBoost || 0);
  if (timingBonus === 'great') rarityBoost += 0.15;

  var totalWeight = pool.reduce(function(s, f) {
    var w = f.weight;
    if (rarityBoost > 0) {
      if (f.rarity === 'common')    w = Math.max(1, w - Math.floor(w * rarityBoost * 1.5));
      if (f.rarity === 'rare' || f.rarity === 'epic' || f.rarity === 'legendary') w = Math.floor(w * (1 + rarityBoost));
    }
    return s + w;
  }, 0);

  var roll = Math.random() * totalWeight, acc = 0;
  for (var i = 0; i < pool.length; i++) {
    var w = pool[i].weight;
    if (rarityBoost > 0) {
      if (pool[i].rarity === 'common')    w = Math.max(1, w - Math.floor(w * rarityBoost * 1.5));
      if (pool[i].rarity === 'rare' || pool[i].rarity === 'epic' || pool[i].rarity === 'legendary') w = Math.floor(w * (1 + rarityBoost));
    }
    acc += w;
    if (roll < acc) return pool[i];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── WEIGHT / SIZE SYSTEM ─────────────────────────────────────────────────────
// Each catch rolls a random weight within the fish's range.
// Weight affects PP multiplier and tracks personal/server records.

var _fishingRecords = {}; // { fishId: { weight, date } } personal bests

function fishingLoadRecords() {
  try {
    _fishingRecords = JSON.parse(localStorage.getItem('fish_records_' + currentUser.id) || '{}');
  } catch(e) { _fishingRecords = {}; }
}

function fishingSaveRecords() {
  try {
    localStorage.setItem('fish_records_' + currentUser.id, JSON.stringify(_fishingRecords));
  } catch(e) { /* silent */ }
}

function fishingRollWeight(fish) {
  if (!fish.wMin && !fish.wMax) return null; // piper fish / junk
  var min = fish.wMin || 0.1;
  var max = fish.wMax || 1;
  // Slightly weighted toward lower end (realistic distribution)
  var raw = min + Math.pow(Math.random(), 1.5) * (max - min);
  return Math.round(raw * 10) / 10; // 1 decimal place
}

function fishingWeightCategory(weight, fish) {
  if (!weight || !fish.wMax) return null;
  var range = fish.wMax - (fish.wMin || 0);
  var pct = (weight - (fish.wMin || 0)) / range;
  if (pct < 0.25)      return { label: 'Small',   emoji: '📏', mult: 0.7,  color: '#888' };
  if (pct < 0.55)      return { label: 'Average',  emoji: '🐟', mult: 1.0,  color: '#5dde7a' };
  if (pct < 0.80)      return { label: 'Large',    emoji: '💪', mult: 1.3,  color: '#4dabf7' };
  if (pct < 0.95)      return { label: 'Trophy!',  emoji: '🏆', mult: 1.75, color: '#ffd700' };
  return                        { label: 'MONSTER!', emoji: '🌟', mult: 2.5,  color: '#ff66cc' };
}

function fishingFormatWeight(w) {
  if (w === null || w === undefined) return '??? lbs';
  if (w >= 100) return Math.round(w) + ' lbs';
  return w.toFixed(1) + ' lbs';
}

function fishingCheckRecord(fish, weight) {
  if (!weight) return false;
  var prev = _fishingRecords[fish.id];
  if (!prev || weight > prev.weight) {
    _fishingRecords[fish.id] = { weight: weight, date: Date.now() };
    fishingSaveRecords();
    return true; // new personal best
  }
  return false;
}

// Show the catch popup modal
function fishingShowCatchPopup(fish, weight, ppEarned, isNew, isRecord) {
  var sizeData = fishingWeightCategory(weight, fish);
  var rarityColors = { common:'#5dde7a', uncommon:'#4dabf7', rare:'#9966ff', epic:'#ff9f43', legendary:'#ffd700' };
  var color = rarityColors[fish.rarity] || '#5dde7a';

  // Remove any existing popup
  var existing = document.getElementById('fishing-catch-popup');
  if (existing) existing.remove();

  var popup = document.createElement('div');
  popup.id = 'fishing-catch-popup';
  popup.style.cssText = [
    'position:fixed','top:50%','left:50%',
    'transform:translate(-50%,-50%) scale(0.8)',
    'z-index:9500',
    'background:var(--white)',
    'border:3px solid ' + color,
    'border-radius:20px',
    'padding:24px 28px',
    'text-align:center',
    'min-width:260px',
    'max-width:340px',
    'box-shadow:0 8px 40px rgba(0,0,0,0.25)',
    'transition:transform 0.25s cubic-bezier(0.34,1.56,0.64,1),opacity 0.2s',
    'opacity:0',
    'cursor:pointer'
  ].join(';');

  var sizeHtml = sizeData
    ? '<div style="font-size:0.85rem;color:' + sizeData.color + ';font-weight:700;margin-bottom:4px;">' +
      sizeData.emoji + ' ' + sizeData.label + '</div>'
    : '';
  var weightHtml = weight
    ? '<div style="font-size:1.1rem;font-weight:700;color:var(--text);margin-bottom:2px;">' + fishingFormatWeight(weight) + '</div>'
    : '';
  var newBadge = isNew ? '<div style="background:#ffd700;color:#000;border-radius:20px;padding:2px 10px;font-size:0.7rem;font-weight:700;display:inline-block;margin-bottom:6px;">✨ NEW FISH!</div><br>' : '';
  var recordBadge = isRecord && !isNew ? '<div style="background:#9966ff;color:#fff;border-radius:20px;padding:2px 10px;font-size:0.7rem;font-weight:700;display:inline-block;margin-bottom:6px;">🏆 PERSONAL BEST!</div><br>' : '';

  popup.innerHTML =
    newBadge + recordBadge +
    '<div style="font-size:3rem;margin-bottom:4px;">' + fish.emoji + '</div>' +
    '<div style="font-size:1.2rem;font-weight:800;color:' + color + ';margin-bottom:4px;">' + fish.name + '</div>' +
    '<div style="font-size:0.7rem;color:var(--text-light);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">' + fish.rarity + '</div>' +
    sizeHtml + weightHtml +
    '<div style="font-size:1.3rem;font-weight:700;color:#5dde7a;margin-top:8px;">+' + ppEarned + ' PP</div>' +
    '<div style="font-size:0.68rem;color:var(--text-light);margin-top:8px;">Click to continue</div>';

  popup.addEventListener('click', function() { fishingDismissCatchPopup(); });
  document.body.appendChild(popup);

  // Animate in
  requestAnimationFrame(function() {
    popup.style.opacity = '1';
    popup.style.transform = 'translate(-50%,-50%) scale(1)';
  });

  // Auto-dismiss after 4s
  popup._autoTimer = setTimeout(function() { fishingDismissCatchPopup(); }, 4000);
}

function fishingDismissCatchPopup() {
  var popup = document.getElementById('fishing-catch-popup');
  if (!popup) return;
  if (popup._autoTimer) clearTimeout(popup._autoTimer);
  popup.style.opacity = '0';
  popup.style.transform = 'translate(-50%,-50%) scale(0.85)';
  setTimeout(function() { if (popup.parentNode) popup.parentNode.removeChild(popup); }, 200);
}

// ── TIMING MECHANIC ────────────────────────────────────────────────────────
// After casting, a nibble animation plays, then a timing bar appears.
// Player clicks when the indicator is in the "sweet spot" for a bonus.

function fishingShowTimingBar() {
  var bar = document.getElementById('fishing-timing-wrap');
  if (!bar) return;
  bar.style.display = 'block';
  var indicator = document.getElementById('fishing-timing-indicator');
  var sweetspot = document.getElementById('fishing-timing-sweet');
  if (!indicator || !sweetspot) return;

  _fishingTimingWindow = true;
  _fishingTimingResult = 'miss'; // default if they don't click

  // Animate indicator left→right over 1.8s
  var start = null;
  var duration = 1800;
  var sweetLeft = 35, sweetRight = 65; // sweet spot is middle 30% of bar

  indicator.style.left = '0%';

  function step(ts) {
    if (!start) start = ts;
    var pct = Math.min(100, ((ts - start) / duration) * 100);
    indicator.style.left = pct + '%';

    if (_fishingTimingWindow) {
      if (pct >= sweetLeft && pct <= sweetRight) {
        indicator.style.background = '#5dde7a'; // green in sweet spot
      } else {
        indicator.style.background = '#ff6b6b'; // red outside
      }
      if (pct < 100) {
        requestAnimationFrame(step);
      } else {
        // Time ran out — miss
        _fishingTimingWindow = false;
        fishingHideTimingBar();
        fishingResolveCast('miss');
      }
    }
  }
  requestAnimationFrame(step);
}

function fishingTimingClick() {
  if (!_fishingTimingWindow) return;
  var indicator = document.getElementById('fishing-timing-indicator');
  if (!indicator) return;
  var pct = parseFloat(indicator.style.left) || 0;
  _fishingTimingWindow = false;
  var sweetLeft = 35, sweetRight = 65;
  var result = (pct >= sweetLeft && pct <= sweetRight) ? 'great' : 'ok';
  fishingHideTimingBar();
  fishingResolveCast(result);
}

function fishingHideTimingBar() {
  var bar = document.getElementById('fishing-timing-wrap');
  if (bar) bar.style.display = 'none';
}

// Power bar state
var _castPowerInterval = null;
var _castPower = 0;
var _castPressing = false;

function castLineStart(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (!currentUser || _castPressing) return;
  _castPressing = true;
  _castPower = 0;
  var btn = document.getElementById('fishing-btn');
  var powerWrap = document.getElementById('fishing-power-wrap');
  var powerBar  = document.getElementById('fishing-power-bar');
  var catchText = document.querySelector('.pond-text');
  if (powerWrap) powerWrap.style.display = 'block';
  if (btn) btn.textContent = '💪 Release to cast!';
  if (catchText) catchText.innerHTML = '<span style="color:#4dabf7;font-weight:600;">Hold to build power, release to cast!</span>';
  var start = Date.now();
  _castPowerInterval = setInterval(function() {
    _castPower = Math.min(1, (Date.now() - start) / 1500);
    if (powerBar) {
      var pct = _castPower * 100;
      powerBar.style.width = pct + '%';
      powerBar.style.background = pct < 50 ? '#5dde7a' : pct < 80 ? '#ffd700' : '#ff9f43';
    }
    if (_castPower >= 1) castLineRelease();
  }, 30);
}

async function castLineRelease() {
  if (!_castPressing) return;
  _castPressing = false;
  if (_castPowerInterval) { clearInterval(_castPowerInterval); _castPowerInterval = null; }
  var power = _castPower; _castPower = 0;
  var powerWrap = document.getElementById('fishing-power-wrap');
  var powerBar  = document.getElementById('fishing-power-bar');
  if (powerWrap) powerWrap.style.display = 'none';
  if (powerBar)  powerBar.style.width = '0%';
  var powerCat = power < 0.3 ? 'weak' : power < 0.6 ? 'ok' : power < 0.85 ? 'good' : 'perfect';
  var powerBonuses = {
    weak:   { junkMult:1.25, rarityBoost:0,    label:'Weak cast...'   },
    ok:     { junkMult:1.0,  rarityBoost:0,    label:'Decent cast!'   },
    good:   { junkMult:0.85, rarityBoost:0.05, label:'Good cast! 🎣'  },
    perfect:{ junkMult:0.65, rarityBoost:0.12, label:'Perfect cast! ⭐'}
  };
  window._castPowerBonus = powerBonuses[powerCat];
  // Deduct bait cost
  var baitData = FISH_BAIT[_fishingBait] || FISH_BAIT.worm;
  if (baitData.cost > 0) {
    if (currentPoints < baitData.cost) {
      showToast('Not enough PP for ' + baitData.name + '! Switching to worm.', 3000);
      _fishingBait = 'worm'; fishingSelectBait('worm');
    } else {
      var ppRes = await supabaseClient.rpc('award_pp_secure', { p_amount: -baitData.cost, p_reason: 'fishing_bait' }).catch(function(){ return null; });
      if (ppRes && ppRes.data !== undefined) updateAllPoints(ppRes.data);
    }
  }
  var btn = document.getElementById('fishing-btn');
  var line = document.getElementById('fishing-line');
  var catchText = document.querySelector('.pond-text');
  if (btn) btn.disabled = true;
  if (line) line.style.display = 'block';
  if (catchText) catchText.innerHTML = '<span style="color:#4dabf7;">' + powerBonuses[powerCat].label + ' Waiting for a nibble...</span>';
  var spotDelays = { pond:600, river:900, lake:1100, ocean:1400 };
  var nibbleDelay = (spotDelays[_fishingSpot] || 800) + Math.random() * 800;
  setTimeout(function() {
    if (line) line.classList.add('nibble');
    if (catchText) catchText.innerHTML = '<span style="color:#ffd700;font-weight:700;">🐟 Something\'s biting! Click when it\'s in the zone!</span>';
    fishingShowTimingBar();
    if (btn) { btn.disabled = false; btn.textContent = '\u26a1 REEL IT!'; btn.onclick = fishingTimingClick; }
  }, nibbleDelay);
}

// Legacy entry kept for compatibility
async function castLine() { castLineStart(null); }

async function fishingResolveCast(timing) {
  var line = document.getElementById('fishing-line');
  if (line) { line.style.display = 'none'; line.classList.remove('nibble'); }

  // Reset button
  var btn = document.getElementById('fishing-btn');
  if (btn) { btn.textContent = '🎣 Cast Again!'; btn.onclick = castLine; btn.disabled = false; }

  var caught = fishingGetCatch(timing);
  _fishingSessionCasts++;

  var catchText = document.querySelector('.pond-text');
  var rarityColors = { junk:'#888', common:'#5dde7a', uncommon:'#4dabf7', rare:'#9966ff', epic:'#ff9f43', legendary:'#ffd700', item:'#ff66cc' };

  // ── ITEM CATCH ────────────────────────────────────────────────────────────
  if (caught.id === '__item__') {
    try {
      var itemRes = await supabaseClient.from('items').select('id,name,emoji').gt('hunger_effect', 0).order('id').limit(30);
      if (itemRes.data && itemRes.data.length > 0) {
        var randomItem = itemRes.data[Math.floor(Math.random() * itemRes.data.length)];
        await supabaseClient.from('user_inventory').upsert(
          { user_id: currentUser.id, item_id: randomItem.id, quantity: 1 },
          { onConflict: 'user_id,item_id' }
        ).catch(function(){});
        if (catchText) catchText.innerHTML = '🎁 <span style="color:#ff66cc;font-weight:700;">You caught an item: ' + (randomItem.emoji||'📦') + ' ' + randomItem.name + '!</span>' +
          (timing === 'great' ? ' <span style="color:#ffd700;font-size:0.7rem;">PERFECT TIMING!</span>' : '');
        showToast('🎣 Found: ' + (randomItem.emoji||'📦') + ' ' + randomItem.name + ' in your tackle box! Added to inventory.', 4000);
        addPassXP(3, 'fishing').catch(function(){});
      }
    } catch(e) { /* silent */ }
    fishingUpdateStats();
    return;
  }

  // ── JUNK CATCH ───────────────────────────────────────────────────────────
  if (caught.rarity === 'junk') {
    if (catchText) catchText.innerHTML = caught.emoji + ' <span style="color:#888;">You caught ' + caught.name + '...</span>' +
      (timing === 'miss' ? ' <span style="color:#ff6b6b;font-size:0.7rem;">Late click!</span>' : '');
    fishingUpdateStats();
    return;
  }

  // ── REAL FISH CATCH ───────────────────────────────────────────────────────
  // Roll weight and calculate PP
  fishingLoadRecords();
  var weight   = fishingRollWeight(caught);
  var sizeData = fishingWeightCategory(weight, caught);
  var ppMult   = sizeData ? sizeData.mult : 1.0;
  var ppEarned = Math.round(caught.pp * ppMult);
  fishingTotal += ppEarned;

  var isNew    = !_fishCollection[caught.id];
  if (!_fishCollection[caught.id]) _fishCollection[caught.id] = { count:0, firstCatch:Date.now(), bestWeight:null };
  _fishCollection[caught.id].count++;

  // Track personal best weight
  var isRecord = false;
  if (weight !== null) {
    var prevBest = _fishCollection[caught.id].bestWeight || 0;
    if (weight > prevBest) {
      _fishCollection[caught.id].bestWeight = weight;
      isRecord = !isNew; // only "record" if we've caught this before
    }
  }
  fishingSaveCollection();
  // Also save to records map
  fishingCheckRecord(caught, weight);

  var rarityColor = rarityColors[caught.rarity] || '#5dde7a';
  if (catchText) catchText.innerHTML = caught.emoji + ' <span style="color:' + rarityColor + ';font-weight:700;">' + caught.name + '</span>' +
    (isNew ? ' <span style="color:#ffd700;font-size:0.75rem;">✨ NEW!</span>' : '') +
    ' <span style="color:#5dde7a;">(+' + ppEarned + ' PP)</span>';

  // Show catch popup (non-junk only)
  fishingShowCatchPopup(caught, weight, ppEarned, isNew, isRecord);

  // Update bingo for fish catches
  updateBingoProgress('catch_fish', 1);
  if (caught.rarity === 'rare' || caught.rarity === 'epic' || caught.rarity === 'legendary') {
    updateBingoProgress('catch_rare_fish', 1);
  }

  // Record catch in DB via secure RPC (handles collection + deduplication)
  var catchRes = await supabaseClient.rpc('fishing_record_catch', {
    p_fish_id: caught.id,
    p_weight:  weight,
    p_pp:      ppEarned
  }).catch(function(){ return null; });
  // Use server's authoritative new_fish/new_record flags if available
  if (catchRes && catchRes.data && !catchRes.data.error) {
    isNew    = catchRes.data.new_fish    || isNew;
    isRecord = catchRes.data.new_record  || isRecord;
  }
  // Sync local cache from DB periodically (after catch)
  if (!_fishCollection[caught.id]) _fishCollection[caught.id] = { count:0, bestWeight:null };
  _fishCollection[caught.id].count++;
  if (weight && (!_fishCollection[caught.id].bestWeight || weight > _fishCollection[caught.id].bestWeight)) {
    _fishCollection[caught.id].bestWeight = weight;
  }

  // Award PP
  await awardPP(ppEarned, 'fishing').catch(function(){});

  // Award PassXP per fish
  var fishPassXP = caught.passXP || 2;
  addPassXP(fishPassXP, 'fishing').catch(function(){});

  // New fish celebrations
  if (isNew) {
    if (caught.rarity === 'legendary') {
      var sizeLabel2 = sizeData ? sizeData.label + ' · ' : '';
      safeSetTimeout(function() {
        showRareCelebration({
          title: 'Legendary Catch!',
          subtitle: caught.emoji + ' ' + caught.name + (weight ? ' — ' + sizeLabel2 + fishingFormatWeight(weight) : '') + ' (+' + ppEarned + ' PP)',
          icon: caught.emoji, rarity: 'legendary',
          shareText: 'I just caught a legendary ' + caught.name + ' in PawketPetsVT! ?? #PawketPetsVT'
        });
      }, 400);
      safeSetTimeout(function() {
        showMelonMessage(caught.id === 'piper_fish'
          ? '...where did you catch that? Please don\'t catch it again.'
          : 'A legendary catch! ' + caught.emoji + ' I haven\'t seen one in a long time.',
          { displayMs: 10000, spooky: caught.id === 'piper_fish' }
        );
      }, 3500);
    } else if (caught.rarity === 'epic') {
      safeSetTimeout(function() {
        showRareCelebration({
          title: 'Epic Catch!',
          subtitle: caught.emoji + ' ' + caught.name + (weight ? ' — ' + fishingFormatWeight(weight) : '') + ' (+' + ppEarned + ' PP)',
          icon: caught.emoji, rarity: 'epic',
          shareText: 'Just caught an epic ' + caught.name + ' in PawketPetsVT! #PawketPetsVT'
        });
      }, 400);
    }
  }
  // Check area completion after every real catch
  if (caught.rarity !== 'junk' && caught.id !== '__item__') {
    fishingCheckAreaComplete().catch(function(){});
  }


var PASS_XP_TOAST_SOURCES = {
  fishing:           '🎣 Fishing',
  battle:            '⚔️ Battle',
  expedition:        '🗺️ Expedition',
  minigame:          '🎮 Minigame',
  level_up:          '⭐ Level Up',
  quest_complete:    '📜 Quest',
  bingo_line:        '🎯 Bingo Line',
  bingo_blackout:    '🎯 Bingo Blackout',
  grand_prix_winner: '🏆 Grand Prix Win',
  grand_prix_top_10: '🏅 Grand Prix Top 10',
  secret_discovery:  '🔍 Discovery',
  friend_added:      '👥 New Friend',
  social_share:      '📢 Share',
};

// ══════════════════════════════════════════════════════════════════════════
// FUNCTIONS ADDED THIS SESSION — appended to base file
// ══════════════════════════════════════════════════════════════════════════

// ── Calendar bonus multiplier ─────────────────────────────────────────────
function getCalendarBonus(statKey) {
  var today = new Date().getDay();
  var schedule = {
    1: { stat: 'minigame_pp' }, 2: { stat: 'battle_xp' },
    3: { stat: 'fishing' },     5: { stat: 'race' }, 0: { stat: 'pet' }
  };
  var ev = schedule[today];
  return (ev && ev.stat === statKey) ? 2.0 : 1.0;
}

// ── Fishing area completion (DB-backed, idempotent) ───────────────────────
async function fishingCheckAreaComplete() {
  var spotFish = FISH_BY_SPOT[_fishingSpot] || [];
  if (!spotFish.every(function(id){ return _fishCollection[id]; })) return;
  var reward = FISH_SPOT_REWARDS[_fishingSpot];
  if (!reward) return;
  var res = await supabaseClient.rpc('fishing_claim_reward', {
    p_reward_key: 'area_' + _fishingSpot, p_pp: reward.pp,
    p_pass_xp: reward.passXP, p_skin_key: false
  }).catch(function(){ return null; });
  if (!res || (res.data && res.data.already_claimed)) return;
  if (res.data && res.data.ok) {
    addPassXP(reward.passXP, 'fishing').catch(function(){});
    showToast('🏆 ' + reward.label + '! +' + reward.pp + ' PP +' + reward.passXP + ' Pass XP!', 7000);
    if (typeof showMelonMessage === 'function')
      showMelonMessage('You caught every fish in the ' + _fishingSpot + '! 🍉', { displayMs: 10000 });
  }
  var allIds = FISH_POOL.filter(function(f){ return f.rarity !== 'junk'; }).map(function(f){ return f.id; });
  if (!allIds.every(function(id){ return _fishCollection[id]; })) return;
  var full = await supabaseClient.rpc('fishing_claim_reward', {
    p_reward_key: 'full_collection', p_pp: FISH_FULL_COMPLETION_PP,
    p_pass_xp: FISH_FULL_COMPLETION_PASSXP, p_skin_key: true
  }).catch(function(){ return null; });
  if (full && full.data && full.data.ok) {
    if (typeof showRareCelebration === 'function')
      showRareCelebration({ title:'Master Angler!',
        subtitle:'Caught every fish! +' + FISH_FULL_COMPLETION_PP + ' PP + 1 Skin Key!',
        icon:'🎣', rarity:'legendary',
        shareText:'Completed the fish collection in PawketPetsVT! 🎣 #PawketPetsVT' });
  }
}

// ── Ad-pocalypse weather ──────────────────────────────────────────────────
var _adpocalypseInterval = null;
var _adpocalypseActive   = false;
var AD_POOL = [
  { id:'ad_free_pp', title:'💰 FREE PawketPoints!!', headline:'CLICK HERE FOR FREE PP!!',
    sub:'Limited time! Click NOW for <strong>free 25 PP</strong>!',
    btn:'✨ CLAIM NOW — FREE!!', fine:'* One per ad.',
    outcome:function(){ awardPP(25,'adpocalypse_ad').catch(function(){}); showToast('🎉 +25 PP from an ad!',4000); }, weight:25 },
  { id:'ad_pp_loss', title:'🔥 FLASH SALE!!', headline:'BUY NOW!!',
    sub:'PetCare Pro™ — <strong>only 50 PP!!</strong>',
    btn:'💸 BUY NOW — 50 PP!!', fine:'* The timer was not real.',
    outcome:function(){ supabaseClient.rpc('award_pp_secure',{p_amount:-50,p_reason:'adpocalypse_scam'}).then(function(r){if(r.data)updateAllPoints(r.data);}).catch(function(){}); showToast('😈 -50 PP. PetCare Pro does not exist.',5000); }, weight:15 },
  { id:'ad_nothing', title:'🎉 YOU QUALIFY!!', headline:'EXCLUSIVE OFFER!!',
    sub:'You have been pre-approved for our <strong>Exclusive Rewards Program</strong>!!',
    btn:'✅ TELL ME MORE!!', fine:'* There is nothing more.',
    outcome:function(){ showToast('There was nothing there. Thank you. 🙂',4000); }, weight:15 },
  { id:'ad_horror', title:'SYSTEM — do not close', headline:'have you seen them?',
    sub:'the other testers. from before.<br><br>it was not fine.',
    btn:'i haven\'t seen them', fine:'* this ad will not appear again.',
    outcome:function(){ showToast('...noted. please continue playing.',5000); }, weight:10 }
];
function adpocalypse_pickAd(){
  var t=AD_POOL.reduce(function(s,a){return s+a.weight;},0),r=Math.random()*t,acc=0;
  for(var i=0;i<AD_POOL.length;i++){acc+=AD_POOL[i].weight;if(r<acc)return AD_POOL[i];}return AD_POOL[0];
}
function adpocalypse_showAd(){
  if(!_adpocalypseActive||!currentUser)return;
  var ad=adpocalypse_pickAd(),pos=[{top:'8%',right:'3%'},{bottom:'10%',right:'3%'},{top:'35%',right:'2%'}][Math.floor(Math.random()*3)];
  var popup=document.createElement('div');
  popup.className='adpoc-popup'+(ad.id==='ad_horror'?' adpoc-horror':'');
  popup.style.cssText=Object.keys(pos).map(function(k){return k+':'+pos[k];}).join(';');
  popup.innerHTML='<div class="adpoc-titlebar"><span>'+ad.title+'</span><button class="adpoc-close" onclick="adpocalypse_closePopup(this.parentElement.parentElement)">×</button></div>'+
    '<div class="adpoc-body"><div class="adpoc-headline">'+ad.headline+'</div><div class="adpoc-sub">'+ad.sub+'</div>'+
    '<button class="adpoc-btn">'+ad.btn+'</button><div class="adpoc-fine">'+ad.fine+'</div></div>';
  popup.querySelector('.adpoc-btn').addEventListener('click',function(){ad.outcome();adpocalypse_closePopup(popup);});
  document.body.appendChild(popup);
  setTimeout(function(){popup.classList.add('adpoc-show');},50);
  setTimeout(function(){adpocalypse_closePopup(popup);},12000);
}
function adpocalypse_closePopup(el){
  if(!el||!el.parentNode)return;
  el.classList.remove('adpoc-show');
  setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},400);
}
function adpocalypse_start(){
  if(_adpocalypseActive)return; _adpocalypseActive=true;
  showToast('📢 Ad-pocalypse weather! Watch out for ads...',4000);
  setTimeout(function(){
    adpocalypse_showAd();
    _adpocalypseInterval=setInterval(function(){ if(!_adpocalypseActive){clearInterval(_adpocalypseInterval);return;} adpocalypse_showAd(); },25000+Math.random()*15000);
  },8000);
}
function adpocalypse_stop(){
  _adpocalypseActive=false;
  if(_adpocalypseInterval){clearInterval(_adpocalypseInterval);_adpocalypseInterval=null;}
  document.querySelectorAll('.adpoc-popup').forEach(function(el){adpocalypse_closePopup(el);});
}

// ── ARG: Melon spooky shop dialogue ──────────────────────────────────────
// This replaces the single spooky line in initMelonDialogue
// The function initMelonDialogue already exists in the base file and calls
// spookyLines internally — we patch it to use the expanded pool via a global
var MELON_SPOOKY_POOL = [
  'I have to run the shop now that <span class="glitch-text">Piper</span> has gone missing.',
  'Buy whatever you need! <span class="glitch-text">Piper</span> used to say that too.',
  'Is your pet happy today? They look happy. They always look happy.',
  'I\'ve been here a long time. So have you. Isn\'t that nice?',
  'Welcome to the shop! Everything is fine. <span class="glitch-text">Everything is fine.</span>',
  'I\'m not sure what happened to the last guide. I\'m sure it was nothing.',
  'Your pet seems very attached to you. That\'s good. That\'s very good.',
  'Sometimes I think the pets remember things I don\'t. But I\'m just the shopkeeper.',
];

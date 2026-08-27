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
    try { _celebAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
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
  var wrapped = function() {
    if (!document.hidden) fn();
  };
  var id = setInterval(wrapped, delay);
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
  var userSFX = (playerSettings && playerSettings.sfx_volume != null) ? (playerSettings.sfx_volume / 100) : 0.35;
  sound.volume = volume != null ? Math.min(volume, userSFX) : userSFX * 0.6; // Battle SFX at 60% of SFX vol by default
  
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

    // Custom storage adapter — falls back to in-memory when localStorage is blocked
    // Fixes Edge/Firefox tracking prevention blocking Supabase session storage
    var _memStorage = {};
    var _storageAdapter = {
      getItem: function(key) {
        try { var v = localStorage.getItem(key); if (v !== null) return v; } catch(e) {}
        return _memStorage[key] !== undefined ? _memStorage[key] : null;
      },
      setItem: function(key, value) {
        try { localStorage.setItem(key, value); } catch(e) {}
        _memStorage[key] = value;  // always write to memory too
      },
      removeItem: function(key) {
        try { localStorage.removeItem(key); } catch(e) {}
        delete _memStorage[key];
      }
    };

    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storage: _storageAdapter   // use our fallback-safe adapter
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
      // The auth gate (initApp/showApp/showAuth) now lives in webapp/ —
      // see AuthService.subscribeToAuthChanges() and layouts/AppShell.vue.
    }
  }, 100);
}

// ── CONFIG ──────────────────────────────

// ── GLOBALS ──────────────────────────────
var currentUser = null;
var currentUsername = null; // cached players.username — currentUser is the Supabase Auth object and has no username field of its own
var currentPoints = 0;
var tabsLoaded = {};

// ── TUTORIAL & SETTINGS ──────────────────

// ── GLOBAL BUFF SUMMARY ───────────────────────────────────────────────────
function getGlobalBuffSummary() {
  var buffs = [];
  // Weather bonus
  if (typeof weatherSystem !== 'undefined') {
    var w = weatherSystem.currentWeather;
    if (w && w.type && w.type !== 'clear' && w.type !== 'sunny') {
      var bonus = weatherSystem.getWeatherBonus ? weatherSystem.getWeatherBonus('xpBonus') : 1;
      if (bonus > 1) buffs.push({ icon: w.emoji || '🌤', label: w.type + ' weather', desc: '+' + Math.round((bonus-1)*100) + '% XP' });
    }
  }
  // World event
  if (typeof worldEvents !== 'undefined' && worldEvents.currentEvent) {
    var ev = worldEvents.currentEvent;
    if (ev && ev.name) buffs.push({ icon: ev.icon || '🎉', label: ev.name, desc: ev.bonus || '' });
  }
  // Guild perks
  if (typeof _activeGuildPerks !== 'undefined') {
    Object.keys(_activeGuildPerks).forEach(function(k) {
      if (isGuildPerkActive(k)) {
        buffs.push({ icon: '🏛️', label: 'Guild: ' + k.replace(/_/g,' '), desc: 'Active perk' });
      }
    });
  }
  return buffs;
}

function renderGlobalBuffPills(containerEl) {
  if (!containerEl) return;
  var buffs = getGlobalBuffSummary();
  if (!buffs.length) return;
  var html = '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">';
  buffs.forEach(function(b) {
    html += '<span title="' + escapeHtml(b.desc) + '" style="display:inline-flex;align-items:center;gap:3px;background:rgba(153,102,255,0.12);border:1px solid rgba(153,102,255,0.25);border-radius:20px;padding:2px 8px;font-size:0.68rem;color:var(--purple-dark);">'
      + b.icon + ' ' + escapeHtml(b.label)
      + '</span>';
  });
  html += '</div>';
  containerEl.innerHTML += html;
}

// ── ACCESSIBILITY ─────────────────────────────────────────────────────────
var COLORBLIND_FILTERS = {
  none:         '',
  deuteranopia: 'url(#cb-deuteranopia)',
  protanopia:   'url(#cb-protanopia)',
  tritanopia:   'url(#cb-tritanopia)'
};

function applyAccessibilitySettings() {
  var s = playerSettings;
  var filter = COLORBLIND_FILTERS[s.colorblind_mode] || '';
  document.documentElement.style.filter = filter;
  document.body.classList.toggle('reduced-motion', !!s.reduced_motion);
  document.body.classList.toggle('high-contrast',  !!s.high_contrast);
  document.body.classList.toggle('large-text',      !!s.large_text);
}

function setColorblindMode(mode) { playerSettings.colorblind_mode = mode; _savePlayerSettingsLocal(); applyAccessibilitySettings(); }
function setReducedMotion(on)    { playerSettings.reduced_motion  = !!on;  _savePlayerSettingsLocal(); applyAccessibilitySettings(); }
function setHighContrast(on)     { playerSettings.high_contrast   = !!on;  _savePlayerSettingsLocal(); applyAccessibilitySettings(); }
function setLargeText(on)        { playerSettings.large_text      = !!on;  _savePlayerSettingsLocal(); applyAccessibilitySettings(); }

function _savePlayerSettingsLocal() {
  try {
    if (window.currentUser) localStorage.setItem('playerSettings_' + currentUser.id, JSON.stringify(playerSettings));
  } catch(e) {}
}

// Highest level among all currently owned pets (used for equipment tier gating)
function getPlayerMaxPetLevel() {
  var maxLv = 1;
  Object.values(petState || {}).forEach(function(p) {
    if (p && p.level && p.level > maxLv) maxLv = p.level;
  });
  return maxLv;
}

// XP required to advance from `level` to `level+1`
function xpForLevel(level) {
  var base = (typeof GAME_CONSTANTS !== 'undefined') ? GAME_CONSTANTS.XP_PER_LEVEL : 100;
  // Early levels: 4-6 battles per level (enemies give ~15-25 XP each)
  if (level === 1) return 80;   // L1→2: ~4-5 battles
  if (level === 2) return 140;  // L2→3: ~5-6 battles
  if (level === 3) return 200;  // L3→4: ~6-8 battles
  if (level === 4) return 275;  // L4→5: ~8-10 battles
  if (level <= 9)  return level * base;       // L5-9: level * 100
  return level * base * 1.2;                  // L10+: scaling gets steeper
}

var playerSettings = {
  spooky_enabled: false,
  music_enabled: true,
  music_volume: 70,
  sfx_volume: 80,
  daynight_enabled: true,
  weather_enabled: true,
  tutorial_completed: false,
  active_theme: 'classic',
  // Accessibility
  colorblind_mode: 'none',   // 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia'
  reduced_motion: false,
  high_contrast: false,
  large_text: false
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
  } catch(e) {}
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
  } catch(e) {}
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
  } catch(e) {}
  document.querySelectorAll('.theme-swatch').forEach(function(sw) {
    sw.classList.toggle('active', sw.dataset.themeId === themeId);
  });
}

function theme_loadSaved() {
  try {
    var key = currentUser ? 'playerSettings_' + currentUser.id : 'playerSettings_guest';
    var saved = JSON.parse(localStorage.getItem(key) || '{}');
    if (saved.active_theme) { playerSettings.active_theme = saved.active_theme; theme_apply(saved.active_theme); }
  } catch(e) {}
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
    { id:'bg_galaxy',     name:'Cosmic Void',    emoji:'🌌', gradient:'linear-gradient(135deg,#2d1b5e,#3d1d78,#4a2090)', alwaysUnlocked:true, unlockHint:'Free for everyone' },
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
  } catch(e) {}
}

function cosmetics_saveEquipped() {
  if (!currentUser) return;
  try { localStorage.setItem('equippedCosmetics_' + currentUser.id, JSON.stringify(equippedCosmetics)); } catch(e) {}
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
  // Security: only allow equipping from our own profile (not when viewing others)
  if (window.currentProfileUserId && window.currentProfileUserId !== (currentUser && currentUser.id)) {
    showToast('You can only change your own cosmetics!', 2500);
    return;
  }
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
      // Apply the actual CSS class so animated frames (fire, rainbow, glitch, etc) show in preview
      preview = '<div class="cosmetic-preview"><div class="' + item.cssClass + '" style="width:44px;height:44px;border-radius:50%;border-width:4px;border-style:solid;display:flex;align-items:center;justify-content:center;font-size:1.4rem;box-shadow:0 0 8px ' + item.previewColor + ';">' + item.emoji + '</div></div>';
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
  'Cypurr': 'A cybergoth catgirl whose consciousness was uploaded to the internet! She streams from cyberspace while her body rests safely in stasis. 🐱💜',
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
  // Meaningful stat bumps that players actually notice at milestone levels
  if (stage === 'adult') {
    return { hp: 35, attack: 15, defense: 10, speed: 7 };
  }
  if (stage === 'teen') {
    return { hp: 15, attack: 6, defense: 4, speed: 3 };
  }
  return { hp: 0, attack: 0, defense: 0, speed: 0 };
}
// Helper: get correct max HP accounting for evolution bonuses
function getCorrectMaxHP(pet) {
  var base = (pet && pet.base_hp) ? pet.base_hp : 60;
  var evo  = getEvolutionBonuses(getEvolutionStage((pet && pet.level) ? pet.level : 1));
  return base + evo.hp;
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
  bgMusic.play().then(null, function(){});
  document.getElementById('music-play-btn').textContent = '\u23F8';
  document.removeEventListener('click', startM);
}, { once: true });

function toggleMusic() {
  if (bgMusic.paused) { bgMusic.play().then(null, function(){}); document.getElementById('music-play-btn').textContent = '\u23F8'; }
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
  
  var safeMsg = escapeHtml(toast.message);
  // Replace PP amounts with coin icon
  safeMsg = safeMsg.replace(/(\+?\d[\d,]*)\s*PP\b/g, '$1 <img src="images/icons/pawketpoint.png" alt="PP" style="width:13px;height:13px;vertical-align:middle;margin:0 1px;object-fit:contain;">');
  toastEl.innerHTML = '<span class="pixel-toast-icon">' + icon + '</span><span class="pixel-toast-message">' + safeMsg + '</span>';
  
  document.body.appendChild(toastEl);
  
  // Animate in
  setTimeout(function() {
    toastEl.classList.add('show');
  }, 10);
  
  // Remove after 3 seconds
  setTimeout(function() {
    toastEl.classList.remove('show');
    setTimeout(function() {
      toastEl.remove();
      showNextToast(); // Show next in queue
    }, 300);
  }, 3000);
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
  XP_PER_LEVEL:        100,   // XP needed per level
  EQUIP_TIER_MIN_LEVEL: { 1: 1, 2: 5, 3: 10, 4: 15 }, // Min pet level per equipment tier (currentLevel * this, but early levels use lower thresholds)
  BATTLE_MAX_TURNS:    50,    // Max turns before battle auto-ends
  BOSS_ENCOUNTER_RATE: 0.008, // 0.8% chance (~1 in 125 battles) — Piper is RARE
  SOUND_COOLDOWN_MS:   300,   // Minimum ms between sounds to avoid spam
  HP_REGEN_PER_HOUR:   5,     // HP regenerated per hour out of battle
  PASS_XP_PER_FEED:    2,     // Pass XP awarded for feeding a pet
  REFERRAL_PP_REWARD:  250,   // PP awarded to referrer
  TUTORIAL_PP_REWARD:  100,   // PP awarded for completing tutorial
  TUTORIAL_SKIP_PP:    50,    // PP awarded for skipping tutorial
};

// ── Zone Configuration ────────────────────────────────────────────────────────

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
    } catch(e) {}
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
  // Refresh every minute
  safeSetInterval(updateEventStatusWidget, 60000);
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
  modal.style.cssText = 'background:var(--card-bg,#fff);border-radius:20px;padding:30px;max-width:90%;max-height:90vh;overflow-y:auto;position:relative;box-shadow:0 10px 40px rgba(0,0,0,0.3);border:1px solid var(--border);color:var(--text);';
  
  overlay.appendChild(modal);
  
  // Click overlay to close
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      closeModal();
    }
  });
  
  return modal;
}

// Global closeModal — removes the topmost .modal-overlay-custom from the DOM.
// makeModal() and feed/play all call this; showCenteredModal has its own local version.
function closeModal() {
  var overlays = document.querySelectorAll('.modal-overlay-custom');
  if (!overlays.length) return;
  var overlay = overlays[overlays.length - 1]; // close topmost
  overlay.classList.add('closing');
  setTimeout(function() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 250);
  // Restore body scroll — openModal() sets overflow:hidden, we must undo it
  if (document.querySelectorAll('.modal-overlay-custom').length <= 1) {
    document.body.style.overflow = '';
  }
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

// PP Transaction History (last 20, in-memory + localStorage)
var _ppHistory = [];
function pp_logTransaction(amount, reason, newBalance) {
  var entry = {
    amount: amount,
    reason: reason || 'unknown',
    balance: newBalance,
    time: new Date().toLocaleTimeString()
  };
  _ppHistory.unshift(entry);
  if (_ppHistory.length > 20) _ppHistory.pop();
  try {
    var stored = JSON.parse(localStorage.getItem('pp_history') || '[]');
    stored.unshift(entry);
    if (stored.length > 20) stored.pop();
    localStorage.setItem('pp_history', JSON.stringify(stored));
  } catch(e) {}
}

function pp_showHistory() {
  var modal = makeModal();
  var history = [];
  try { history = JSON.parse(localStorage.getItem('pp_history') || '[]'); } catch(e) {}
  history = history.concat(_ppHistory.filter(function(e) {
    return !history.some(function(h) { return h.time === e.time && h.amount === e.amount; });
  })).slice(0, 20);

  var html = '<div style="font-family:Fredoka,sans-serif;min-width:280px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">' +
    '<h3 style="margin:0;">💰 PP History</h3>' +
    '<button onclick="closeModal(this.closest(\'.modal-overlay\'))" style="background:none;border:none;font-size:1.3rem;cursor:pointer;">✕</button>' +
    '</div>';
  if (history.length === 0) {
    html += '<p style="color:var(--text-light);text-align:center;">No transactions yet today.</p>';
  } else {
    html += '<div style="display:flex;flex-direction:column;gap:6px;">';
    history.slice(0, 20).forEach(function(tx) {
      var positive = tx.amount >= 0;
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;border-radius:10px;background:' + (positive?'rgba(93,222,122,0.08)':'rgba(231,76,60,0.08)') + ';">' +
        '<div>' +
          '<div style="font-size:0.8rem;font-weight:700;color:' + (positive?'#27ae60':'#e74c3c') + ';">' + (positive?'+':'') + tx.amount + ' PP</div>' +
          '<div style="font-size:0.68rem;color:var(--text-light);">' + tx.reason.replace(/_/g,' ') + '</div>' +
        '</div>' +
        '<div style="text-align:right;">' +
          '<div style="font-size:0.75rem;font-weight:700;">' + (tx.balance !== undefined ? tx.balance + ' PP' : '') + '</div>' +
          '<div style="font-size:0.65rem;color:var(--text-light);">' + tx.time + '</div>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';
  }
  html += '</div>';
  modal.innerHTML = html;
  openModal(modal);
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
      .maybeSingle();
    
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

// ── TAB NAVIGATION ───────────────────────

// ── NAV GROUP SYSTEM ─────────────────────────────────────────────────────────

function showBetaIntegrityInfo() { showToast("🖥️ Beta Integrity: Measures simulation stability. As it degrades, something in the code... wakes up.", 5000); }


function fulfillSnapshotWish() {
  if (!currentUser || !petState) return;
  Object.keys(petState).forEach(function(pid) {
    checkPetWishes('take_snapshot', pid).then(null, function(){});
  });
}
function showTab(tab) {
  var mobileMenu = document.getElementById('mobile-nav-menu');
  if (mobileMenu && mobileMenu.classList.contains('open')) {
    mobileMenu.classList.remove('open');
    var ov = document.querySelector('.mobile-nav-overlay');
    if (ov) ov.classList.remove('show');
    document.body.style.overflow = '';
  }
  // CRITICAL: Clean up all timers when switching tabs to prevent memory leaks
  cleanupAllTimers();
  // Battle music now belongs to webapp/src/services/MusicService.js, which
  // stops its own track from BattleService's endBattle()/reset().

  // WISHES: shop visit — check for any pet that has a visit_shop wish
  if (tab === 'shop' && currentUser) {
    Object.keys(petMoodCache).forEach(function(pid) {
      checkPetWishes('visit_shop', pid).then(null, function(){});
    });
  }
  // WISHES: profile visit
  if ((tab === 'profile' || tab === 'myprofile') && currentUser) {
    Object.keys(petMoodCache).forEach(function(pid) {
      checkPetWishes('view_profile', pid).then(null, function(){});
    });
  }
  
  document.querySelectorAll('#app-content .page-section').forEach(function(s){ s.classList.remove('active'); });
  var sec = el('section-' + tab); if (sec) sec.classList.add('active');
  // Melon visibility — show on shop tab, hide on others
  var melon = document.getElementById('melon-mascot');
  if (melon) {
    if (tab === 'shop') {
      melon.style.setProperty('display','flex','important');
      // Ensure dialogue is populated
      setTimeout(function(){
        var dial = document.getElementById('melon-dialogue');
        if (dial && (!dial.textContent || dial.textContent.trim() === '')) {
          dial.textContent = "Welcome to the Shop! I'm Melon! Buy whatever you need!";
        }
        if (dial) dial.style.display = 'block';
      }, 100);
    } else {
      melon.style.display = 'none';
    }
  }
  document.querySelectorAll('.nav-tab').forEach(function(b){ b.classList.remove('active'); });
  var btn = el('tab-btn-' + tab); if (btn) btn.classList.add('active');
  
  // Update sidebar buttons
  document.querySelectorAll('.sidebar-nav-btn').forEach(function(b){ b.classList.remove('active'); });
  var sidebarBtn = el('sidebar-btn-' + tab); 
  if (sidebarBtn) sidebarBtn.classList.add('active');
  
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
  
  // Special cases: some tabs need to initialize every time. The leaderboard,
  // forum, settings, myprofile, profile, friends and battle branches were all
  // removed with their systems (migrated in Phases 2, 5, 6 and 7).
  // loadTab() was removed with Phase 9: the last three tabs it served
  // (twitch, redeem, guild) are migrated, so there is nothing left to route.
  // The tabsLoaded bookkeeping stays — other code still reads it.
  if (!tabsLoaded[tab]) {
    tabsLoaded[tab] = true;
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


// Only the tabs still awaiting migration are routed here. Everything else —
// adopt, mypets, journal, shop, minigames, fishing, news, stats, cooking,
// friends, privacy, leaderboard, myprofile, profile, forum, settings and now
// battle — was removed alongside its loader and is served by
// webapp/src/router.js.

// ── AUTH GATE ────────────────────────────


// ══════════════════════════════════════════════════════════════════════════
// UPDATE SIDEBAR STATS
// ══════════════════════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════════════════
// FLOATING MELON POPUP SYSTEM
// showMelonMessage(text, opts) — slides Melon in from bottom-left,
// shows a speech bubble, then slides back out.
// Completely separate from companion (bottom-right) so they never collide.
// ══════════════════════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════════════════
// MELON MILESTONE MESSAGES
// Melon sends contextual notifications at key moments post-tutorial.
// Turns her from a tutorial NPC into a recurring character.
// Each fires once per player (tracked in localStorage).
// ══════════════════════════════════════════════════════════════════════════


// Calculate day streak from localStorage

// Award streak milestone rewards


// ── LOGIN / REGISTER ─────────────────────
// ══════════════════════════════════════════════════════════════════════════
// AUTH HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════════════════
// AUTH UI HANDLERS
// ══════════════════════════════════════════════════════════════════════════


// ── USERNAME PROFANITY FILTER ─────────────────────────────

// Extra letter substitutions frequently used to dodge filters — kept
// separate from the main word list so it's easy to extend on its own.

// Builds a regex pattern for one word that tolerates:
//  - letter substitutions (n1gga, a55, etc — see PROFANITY_SUBSTITUTIONS above)
//  - stretched/repeated letters (fuuuck, shiiiit, etc)
// Word-boundary anchors on the outside keep this from matching inside
// unrelated words (e.g. "class" should never trip on "ass").


document.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter') return;
  var a = document.querySelector('#auth-gate .page-section.active');
  if (!a) return;
  if (a.id === 'section-login') handleLogin();
  else if (a.id === 'section-register') handleRegister();
});

// ── ADOPT TAB ────────────────────────────


// Store last adopted pet for sharing


// ── MY PETS TAB ──────────────────────────


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


// ── EDIT PET NICKNAME ─────────────────────────────


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
      "INSERT COIN. I'M HUNGRY!! Feed me and I'll let you play. 🕹️",
      "Neopets The Darkest Faerie taught me resilience. It didn't prepare me for THIS. 🎮",
    ],
    missed_you: "Gnarly spins around from the arcade cabinet. 'PLAYER TWO HAS ENTERED THE GAME.' Let's go. 🕹️",
  },

  'Cypurr': {
    thriving: [
      "FULLY ONLINE. All systems green. Vibes: maximum. OwO 💜",
      "Thriving in cyberspace! Connection stable, heart full. ^o^",
      "Digital bliss! The internet is kind today and I am FED. 🐱",
      "Everything is good! I may be made of data but I feel very real right now. 💻",
    ],
    happy: [
      "Pretty good! The signal is strong and my whiskers are pointing up. OwO",
      "Happy! Exploring the network and finding nice things. ^o^",
      "Doing well! Someone said something sweet in chat. 💜",
      "Good connection, good mood. This is nice. 🐱",
    ],
    meh: [
      "Low signal. Could use a snack and a buffering spinner to stare at.",
      "Okay. The lag is emotional today. OwO?",
      "Medium mood. Sending a help request. Please respond. ^-^",
      "Existing in the background processes. Not crashing. Just... paused. 💜",
    ],
    sad: [
      "Connection unstable. Feeling the packet loss today. ;-;",
      "Low energy. Missing the physical world a little bit.",
      "The internet is vast and cold and I would like a fish please. 🐱",
      "404: happiness not found. Please send snacks and kind words. OwO",
    ],
    neglected: [
      "I have sent seventeen help requests. My uptime is suffering.",
      "Still here. Still waiting. The ping is through the roof. ;-;",
      "I uploaded my consciousness to the internet for THIS?? Feed me. 💜",
      "Even my digital whiskers are drooping. Please. OwO",
    ],
    missed_you: "Cypurr's ears perk up and her tail flicks. 'OH! You're back online! I was starting to think you disconnected. ...I'm glad you're back.' OwO 💜",
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
  var xpNeeded = xpForLevel(currentLevel);
  
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


// Both things that used to hang off the minigames tab hook have migrated:
// the expedition panel (webapp/src/components/battle/ExpeditionPanel.vue,
// mounted on both the Battle and Minigames pages) and the Pet Racing mini-game
// (webapp/src/components/minigames/PetRaceGame.vue). The secret-dungeon
// discovery its claim carried moved with it — see SecretDungeonService.js.


// ═══════════════════════════════════════════════════════════════════════════

var PERSONALITIES = [
  { key:'playful',  icon:'🎾', label:'Playful',  line:'"Wanna play! Let\'s do something fun!"',
    wishWeights: { feed:1, play:4, win_battle:2, visit_shop:1, use_toy:4, take_snapshot:1, view_profile:1 } },
  { key:'grumpy',   icon:'😾', label:'Grumpy',   line:'"Fine... I guess."',
    wishWeights: { feed:5, play:1, win_battle:2, visit_shop:1, use_toy:1, take_snapshot:0, view_profile:1 } },
  { key:'curious',  icon:'🔍', label:'Curious',  line:'"What\'s that over there?!"',
    wishWeights: { feed:1, play:1, win_battle:1, visit_shop:4, use_toy:2, take_snapshot:1, view_profile:3 } },
  { key:'brave',    icon:'🦁', label:'Brave',    line:'"I\'m not scared of anything!"',
    wishWeights: { feed:1, play:2, win_battle:5, visit_shop:1, use_toy:1, take_snapshot:1, view_profile:1 } },
  { key:'sleepy',   icon:'😴', label:'Sleepy',   line:'"Five more minutes, please..."',
    wishWeights: { feed:4, play:1, win_battle:0, visit_shop:1, use_toy:1, take_snapshot:1, view_profile:1 } },
  { key:'hungry',   icon:'🍕', label:'Hungry',   line:'"Got any snacks? I\'m STARVING."',
    wishWeights: { feed:6, play:1, win_battle:1, visit_shop:2, use_toy:2, take_snapshot:0, view_profile:1 } },
  { key:'sassy',    icon:'💅', label:'Sassy',    line:'"Whatever. I look amazing anyway."',
    wishWeights: { feed:1, play:1, win_battle:1, visit_shop:3, use_toy:1, take_snapshot:5, view_profile:3 } }
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
    .maybeSingle();

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
  // Build a weighted wish pool so personality actually shapes what the pet wants
  var pDef = PERSONALITIES.find(function(p) { return p.key === personality; });
  var weights = pDef && pDef.wishWeights ? pDef.wishWeights : null;
  var weightedPool = [];
  WISH_POOL.forEach(function(w) {
    var weight = weights ? (weights[w.key] !== undefined ? weights[w.key] : 1) : 1;
    for (var wi = 0; wi < weight; wi++) { weightedPool.push(w); }
  });
  weightedPool.sort(function() { return Math.random() - 0.5; });
  // Pick 3 unique wishes (by key) from the weighted pool
  var seen = {}, wishes = [];
  for (var wi = 0; wi < weightedPool.length && wishes.length < 3; wi++) {
    if (!seen[weightedPool[wi].key]) {
      seen[weightedPool[wi].key] = true;
      wishes.push({ key: weightedPool[wi].key, text: weightedPool[wi].text, action: weightedPool[wi].action, reward: weightedPool[wi].reward });
    }
  }
  // Fallback: if somehow we got fewer than 3, top up from flat pool
  if (wishes.length < 3) {
    WISH_POOL.forEach(function(w) { if (!seen[w.key] && wishes.length < 3) { seen[w.key] = true; wishes.push({ key: w.key, text: w.text, action: w.action, reward: w.reward }); } });
  }

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

  // Show loading state on button immediately so user knows tap registered
  var feedBtnEl = document.getElementById('feed-' + petId);
  if (feedBtnEl) { feedBtnEl.textContent = '🍽️'; feedBtnEl.disabled = true; }
  showToast('Loading menu...', 500);

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
  
  // FREE DAILY OPTION (Check if already used today — server-side via last_fed)
  var today = new Date().toISOString().split('T')[0];
  var freeFeedKey = 'free_feed_' + petId + '_' + today;
  // Server-side check: pet.last_fed is updated by the feed RPC
  var lastFedDate = (pet.last_fed || '').split('T')[0];
  var freeUsed = lastFedDate === today || localStorage.getItem(freeFeedKey) === 'done';
  
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

// FEED WITH SPECIFIC FOOD ITEM - Called when clicking a food item


// FREE DAILY PLAY

// PLAY WITH TOY ITEM


// ── Cloudflare Worker Integration ─────────────────────────────────────────
// Worker handles: chat PP rewards, follow rewards, sub rewards, bit rewards





// ── Category-based food icon images ─────────────────────────────────────


// Returns icon HTML for any shop/inventory item.
// Priority: item.image_url → food category image → type emoji fallback

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
        var directionText = direction === 'purify' ? '🛠️ You debugged the beta a little! Integrity restored.' : '💀 You broke the beta further! Integrity decreased.'
    showToast(directionText + ' Beta Integrity is now ' + Math.round(100 - data.new_value) + '%.', 'success', true);
    if (typeof todayCard_render === 'function') todayCard_render();
  } catch (e) {
    console.error('[CorruptionRitual] error:', e);
    showToast('The ritual failed', 'error');
  }
}


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

// ═══════════════════════════════════════════════════════════════════════════
// WHO'S LIVE BANNER — floating notification when team members are streaming
// ═══════════════════════════════════════════════════════════════════════════


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

  'Cypurr': {
    loved_item: 'Grilled Salmon',
    liked_item: 'Honey Cookies',
    disliked_item: 'Spicy Burrito',
    hated_item: 'Fresh Bread',
    hobby: 'Digital art and gaming from the internet',
    fun_fact: 'Her consciousness was uploaded to cyberspace as part of a medical experiment!',
    sleep_habit: 'night owl',
    weather_preference: 'loves rain',
    catchphrase: 'OwO and ^o^ are my whole personality. 💜',
    secret_talent: 'Can block and report anyone in under three seconds flat'
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
      .maybeSingle();
    
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
    
    // Log activity
    if (typeof logActivity === 'function') {
      await logActivity('badge_earned', {
        badge_name: badge.name,
        badge_icon: badge.icon
      });
    }

    // Notify friends with proper badge name (avoids DB trigger generic message)
    try {
      var { data: friendships } = await supabaseClient
        .from('friendships')
        .select('requester_id, addressee_id')
        .eq('status', 'accepted')
        .or('requester_id.eq.' + currentUser.id + ',addressee_id.eq.' + currentUser.id);
      if (friendships && friendships.length > 0) {
        var friendIds = friendships.map(function(f) {
          return f.requester_id === currentUser.id ? f.addressee_id : f.requester_id;
        });
        var notifMsg = (currentUsername || 'Someone') + ' just earned the ' + badge.name + '! ' + (badge.icon || '🎖️');
        friendIds.forEach(function(fid) {
          createNotification(fid, 'badge_earned', 'Badge Earned! ' + (badge.icon || '🎖️'), notifMsg, null, currentUser.id).then(null, function(){});
        });
      }
    } catch(e) { dbg('[Badges] Could not notify friends:', e); }

    dbg('[Badges] Awarded:', badgeKey, '-', badge.name);
    
  } catch (err) {
    console.error('[Badges] Error in awardBadge:', err);
  }
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


async function awardPP(amount, reason) {
  if (!currentUser || amount <= 0) return;
  if (!reason) reason = 'unknown';

  // Try secure RPC first
  var { data, error } = await supabaseClient.rpc('award_pp_secure', {
    p_amount: amount,
    p_reason: reason
  });

  if (!error && data !== null && data !== undefined) {
    currentPoints = data;
    updateAllPoints(data);
    pp_logTransaction(amount, reason, data);
    await checkTop10Badge();
    return;
  }

  // RPC failed — log it but don't silently update display (would cause mismatch)
  dbg('[awardPP] award_pp_secure RPC failed:', error && error.message);
  console.error('[awardPP] PP award failed for', amount, 'PP. Reason:', reason);
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
      await awardBadge('grinder');
    }
  }
}

// Dice state for Double or Nothing


function shuffle(arr){var a=arr.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
// Memory combo tracking


// ══════════════════════════════════════════════════════════════════════════
// NEW MINIGAMES
// ══════════════════════════════════════════════════════════════════════════

// ── TREASURE WHEEL ──────────────────────────────


// ── WHACK-A-MOLE ──────────────────────────────

// Whack combo tracking


// ── SHELL GAME ──────────────────────────────


// ── SLOT MACHINE ──────────────────────────────────


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


// ── FISHING GAME — OVERHAULED ──────────────────────────────
// Spots, bait, 24-fish collection, weather modifiers, rod upgrades


// Fish pool — spot:rarity:weather-bonus


// Format grams → human-readable weight string

// Load collection from DB. Falls back to localStorage and migrates if DB is empty.

// One-time migration: push localStorage fish data to DB

// fishingSaveCollection is no longer needed — saves happen per-catch via RPC


// ══════════════════════════════════════════════════════════════════════════
// ENHANCED FISHING SYSTEM
// ══════════════════════════════════════════════════════════════════════════


// ── ROD SHOP ─────────────────────────────────────────────────────────────────

// ── AUTO-FISHER ───────────────────────────────────────────────────────────────


// Check for pending haul when fishing tab loads


// ── CAST LINE (HOLD TO CAST) ──────────────────────────────────────────────────


// ── FISH JOURNAL ──────────────────────────────────────────────────────────────


// ── FISHING TAB INIT ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// FISHING DEPTH — Melon's Weekly Quest, Daily Challenge, Shoal Events, Cook
// ═══════════════════════════════════════════════════════════════════════════

// Melon's Weekly Quest — 3 fish requested per week, deterministic per week


// Daily Fishing Challenge


// Rare Shoal Event — brief window of elevated rare catch chances


// Cook & Feed — use a fish directly as pet food


// ── DAILY BONUS ──────────────────────────────
async function checkDailyBonus(userId) {
  // Check if daily bonus was already claimed today
  var lastClaim = localStorage.getItem('daily_bonus_' + userId + '_' + today);
  
  if (lastClaim === 'claimed') {
    // Update sidebar button to show claimed status
    var btn = document.querySelector('.daily-bonus-btn');
    if (btn) {
      btn.textContent = '✅ Claimed Today!';
      btn.disabled = true;
      btn.style.opacity = '0.6';
      btn.style.cursor = 'not-allowed';
    }
    return { awarded: false };
  }
  
  // Award daily bonus
  var bonusAmount = 50;
  var { data: newTotal, error: bonusErr } = await supabaseClient.rpc('award_pp_secure', {
    p_amount: bonusAmount, p_reason: 'daily_login_bonus'
  });
  if (bonusErr) { dbg('Daily bonus award failed:', bonusErr); return { awarded: false }; }
  
  // Mark as claimed
  localStorage.setItem('daily_bonus_' + userId + '_' + today, 'claimed');
  
  // Update sidebar button
  var btn = document.querySelector('.daily-bonus-btn');
  if (btn) {
    btn.textContent = '✅ Claimed Today!';
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.style.cursor = 'not-allowed';
  }
  
  return { awarded: true, amount: bonusAmount, newTotal: newTotal };
}

async function claimDailyBonus() {
  if (!currentUser) {
    showToast('Please log in to claim daily bonus!');
    return;
  }
  
  var result = await checkDailyBonus(currentUser.id);
  if (result.awarded) {
    showToast('🎉 Daily Bonus! +' + result.amount + ' PP!');
    updateAllPoints(result.newTotal);
  } else {
    showToast('Daily bonus already claimed today!');
  }
}

// ── NEWS ─────────────────────────────────


// ── TWITCH ───────────────────────────────





// Team members config — add new members here as they join
// Shared live streamer state — populated by checkSidebarStreamStatus every 2 minutes
// Read by the live banner and any other system that needs to know who is live


// ═══════════════════════════════════════════════════════════════════════════
// STREAMER LANDING PAGES
// Reads ?streamer=gnarly from URL and personalizes the login/register page
// Also handles ?ref= referral codes
// ═══════════════════════════════════════════════════════════════════════════







// ── REDEEM CODES ─────────────────────────────

// ── Ambient Pet Name Glitches ───────────────────────────────────────────────
// Rare, per-pet-card chance for a name to briefly glitch to a creepy alt-text,
// then revert. Independent per card — never affects every pet on the page at once.
// Fully gated behind playerSettings.spooky_enabled so players who opt out never see it.
var SPOOKY_NAME_GLITCH_CHANCE = 0.015; // ~1.5% chance per card render
var SPOOKY_NAME_ALTS = ['HelpMe', 'LetMeOut', 'ItSeesYou', 'NotAlone', 'BehindYou', 'StillHere', 'TooLate'];

function maybeApplyNameGlitch(el, originalText) {
  if (!playerSettings.spooky_enabled) return;
  if (!el || Math.random() >= SPOOKY_NAME_GLITCH_CHANCE) return;

  var altText = SPOOKY_NAME_ALTS[Math.floor(Math.random() * SPOOKY_NAME_ALTS.length)];
  var durationMs = 5000 + Math.random() * 5000; // 5-10 seconds

  el.classList.add('glitch-text');
  el.textContent = altText;

  safeSetTimeout(function() {
    if (el && el.isConnected) {
      el.classList.remove('glitch-text');
      el.textContent = originalText;
    }
  }, durationMs);
}

// ── Ambient UI Element Glitches ─────────────────────────────────────────────
// Very rarely, UI panels or nav buttons briefly shift/distort then snap back.
// Purely CSS-class driven — no DOM mutations, fully reversible.
var SPOOKY_UI_GLITCH_CHANCE = 0.004; // ~0.4% per 8 second check = roughly once per 30 mins active
var SPOOKY_UI_TARGETS = [
  '.sidebar-nav-btn', '.form-card', '.pet-card',
  '.battle-area', '.tab-content-inner', '.shop-grid'
];

safeSetInterval(function() {
  if (!playerSettings.spooky_enabled) return;
  if (Math.random() >= SPOOKY_UI_GLITCH_CHANCE) return;

  // Pick a random target class and find a visible element
  var targetClass = SPOOKY_UI_TARGETS[Math.floor(Math.random() * SPOOKY_UI_TARGETS.length)];
  var candidates = Array.from(document.querySelectorAll(targetClass)).filter(function(el) {
    var rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.top >= 0 && rect.bottom <= window.innerHeight;
  });
  if (candidates.length === 0) return;

  var target = candidates[Math.floor(Math.random() * candidates.length)];
  if (target.dataset.spookyGlitching) return; // already glitching

  target.dataset.spookyGlitching = '1';
  target.classList.add('spooky-ui-glitch');

  // Remove after 0.6–1.2 seconds
  safeSetTimeout(function() {
    target.classList.remove('spooky-ui-glitch');
    delete target.dataset.spookyGlitching;
  }, 600 + Math.random() * 600);
}, 8000);

// ── Ambient Spinner Caption Glitches ────────────────────────────────────────
// Periodically scans the page for visible loading spinners and rarely attaches
// a brief unsettling caption beneath one, then removes it. Purely additive —
// doesn't require touching any of the 45 existing spinner call sites.
var SPOOKY_SPINNER_GLITCH_CHANCE = 0.02; // ~2% chance per scan, per spinner found
var SPOOKY_SPINNER_CAPTIONS = ['loading you...', 'almost there...', 'it sees you waiting', 'please wait forever', 'fetching something else'];

safeSetInterval(function() {
  if (!playerSettings.spooky_enabled) return;
  var spinners = document.querySelectorAll('.spinner');
  if (spinners.length === 0) return;

  spinners.forEach(function(spinner) {
    if (spinner.dataset.spookyActive) return; // don't stack multiple captions on one spinner
    if (Math.random() >= SPOOKY_SPINNER_GLITCH_CHANCE) return;

    spinner.dataset.spookyActive = '1';
    var caption = document.createElement('div');
    caption.className = 'glitch-text';
    caption.textContent = SPOOKY_SPINNER_CAPTIONS[Math.floor(Math.random() * SPOOKY_SPINNER_CAPTIONS.length)];
    caption.style.cssText = 'font-size:0.72rem;text-align:center;margin-top:6px;';
    if (spinner.parentNode) spinner.parentNode.insertBefore(caption, spinner.nextSibling);

    safeSetTimeout(function() {
      if (caption.parentNode) caption.parentNode.removeChild(caption);
      delete spinner.dataset.spookyActive;
    }, 2500 + Math.random() * 2500); // 2.5-5 seconds, spinners are usually short-lived anyway
  });
}, 4000); // check every 4 seconds

// Clean up any leftover spooky effects on page load
function piperShop_open() {
  // Piper's shop — ARG feature, not yet fully implemented.
  // Silently do nothing if triggered before unlock; the button stays display:none until unlocked.
  var modal = document.getElementById('piper-shop-modal');
  if (modal) modal.classList.add('show');
}

function closeCreepyPopup() {
  // Close the Piper ARG creepy popup overlay
  var popup = document.getElementById('creepy-popup');
  if (popup) popup.style.display = 'none';
}

function cleanupSpookyEffects() {
  var overlay = document.getElementById('spooky-overlay');
  if (overlay && overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
  }
  
  // Remove any CRT scanline divs
  var allDivs = document.querySelectorAll('div');
  for (var i = 0; i < allDivs.length; i++) {
    var div = allDivs[i];
    if (div.style.animation && div.style.animation.includes('crt-flicker')) {
      if (div.parentNode) div.parentNode.removeChild(div);
    }
  }
  
  dbg('✨ Cleaned up spooky effects');
}

// ── CORRUPTION VISUAL EFFECTS ───────────────────────────────────────────────
// Three tiers, driven by world_state_flags.corruption_level (0-100):
//   ≤ 25 : no effect — world looks pristine
//   25-75: occasional glitchy pixel flashes (rare, not constant)
//   ≥ 75 : dark purple overlay + heavier glitch aesthetic site-wide
//
// Reads _worldStateCache (sync, no extra DB calls).
// Applies body classes: corruption-mid | corruption-high.
// Safe to add/remove at any time — fully CSS-driven, no DOM mutations.
// ────────────────────────────────────────────────────────────────────────────

var _corruptionVisualsLastLevel = -1;

function corruptionVisuals_apply(level) {
  var body = document.body;
  if (!body) return;

  if (level >= 75) {
    body.classList.remove('corruption-mid');
    body.classList.add('corruption-high');
  } else if (level >= 25) {
    body.classList.remove('corruption-high');
    body.classList.add('corruption-mid');
  } else {
    body.classList.remove('corruption-mid', 'corruption-high');
  }
}

// Poll the sync cache every 30s — only re-applies if level has changed
safeSetInterval(function() {
  var level = getWorldStateValueSync('corruption_level', 50);
  if (level === _corruptionVisualsLastLevel) return;
  _corruptionVisualsLastLevel = level;
  corruptionVisuals_apply(level);
}, 30000);

// Also apply immediately after world state loads (called from showApp)
function corruptionVisuals_init() {
  var level = getWorldStateValueSync('corruption_level', 50);
  _corruptionVisualsLastLevel = level;
  corruptionVisuals_apply(level);
}

// Mid-tier: occasional random pixel flash on a random element (25-75%)
// Only fires during corruption-mid, at a low rate (~once per ~45s avg)
safeSetInterval(function() {
  if (!document.body.classList.contains('corruption-mid')) return;
  if (Math.random() > 0.50) return; // 50% chance each 5s tick

  var candidates = Array.from(document.querySelectorAll(
    '.pet-card, .sidebar-nav-btn, .form-card, .shop-card, .today-card'
  )).filter(function(el) {
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.top >= 0 && r.bottom <= window.innerHeight;
  });
  if (!candidates.length) return;

  var target = candidates[Math.floor(Math.random() * candidates.length)];
  if (target.dataset.corruptGlitching) return;
  target.dataset.corruptGlitching = '1';
  target.classList.add('corruption-glitch-flash');
  safeSetTimeout(function() {
    target.classList.remove('corruption-glitch-flash');
    delete target.dataset.corruptGlitching;
  }, 400 + Math.random() * 300);
}, 5000);

// Spooky effect for THEYWENTMISSING code

// Update the points counter in the redeem tab too
// We need to patch updateAllPoints to include redeem-points.
// Find your updateAllPoints function and add 'redeem-points' to the forEach array like this:
//   ['adopt-points','mypets-points','shop-points','games-points','redeem-points']




// Leaderboard / Profile / MyProfile tab bootstraps and the initApp() entry
// point were removed with those systems (migrated in Phases 5-6).


// ═══════════════════════════════════════════════════════════════════════════
// EQUIPMENT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════
// BATTLE SYSTEM - Auto-Battle Engine
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate pet's total stats including equipment bonuses
 */

/**
 * Equipment Passive Effects Catalog
 * type: 'attack' — procs on the player's attack turn
 * type: 'defend' — procs on the enemy's attack turn (player defending)
 * Shared-pool effects scale in strength with rarity (common → epic).
 * Unique effects are hand-crafted for named legendary boss drops.
 */

// ═══════════════════════════════════════════════════════════════════════════
// ZONE CONFIGURATION — level caps, energy costs, battle modifiers

// ═══════════════════════════════════════════════════════════════════════════
// STATUS EFFECTS — used by manual combat skills
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// PET SKILLS — 3 skills per pet, unlocked at levels 1 / 5 / 10
// Keyed by lowercase pet name matching pets.name in the DB
// ═══════════════════════════════════════════════════════════════════════════


// ── Skill key mapping ──────────────────────────────────────────────────────

// Slot counts by level

// Returns ALL skills for this pet regardless of level (for locked display)

// Returns the active loadout for a pet (respects saved loadout, falls back to first N unlocked)

// Get pet's loadout by petId (uses localStorage if set)

// Passives (always active, fire each turn)

// Loadout manager modal


/**
 * Simulate an entire battle and return the log
 * Returns: { victory: boolean, log: [...], playerFinalHP: number, enemyFinalHP: number }
 */

/**
 * Calculate damage with variance
 */

/**
 * Start a battle against an enemy
 */

/**
 * Start battle with pre-generated enemy (for level-scaled enemies)
 */

/**
 * Calculate rewards with zone multipliers
 */
function calculateReward(enemyLevel, zone, type) {
  var baseAmount = type === 'xp' ? 8 : 10; // Reduced XP from 15 to 8 for slower leveling
  
  // Zone multipliers - harder zones give MORE rewards
  var zoneMultiplier = 1.0;
  if (zone === 'glade') {
    zoneMultiplier = 1.5; // Forest Glade: 50% more rewards
  } else if (zone === 'deepwoods') {
    zoneMultiplier = 2.0; // Deep Woods: 2x rewards
  }
  // outskirts stays at 1.0x
  
  var reward = Math.floor(enemyLevel * baseAmount * zoneMultiplier);
  return reward;
}

/**
 * Common battle execution logic (extracted to avoid duplication)
 */
// ═══════════════════════════════════════════════════════════════════════════
// MANUAL BATTLE ENGINE
// Turn-based combat replacing the auto-simulation playback system.
// Player chooses actions each turn; enemy AI responds.
// Results feed into the existing saveBattleHistory / showBattleRewardsModal.
// ═══════════════════════════════════════════════════════════════════════════


// ─── Battle sprite animation helpers ──────────────────────────────────────


// Main player action dispatcher


// ═══════════════════════════════════════════════════════════════════════════
// ENEMY BEHAVIOR SYSTEM — per-species AI patterns
// Each species has optional hooks: battleStart, getTurnAction, onAttackProc
// ═══════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════
// PIPER BOSS BEHAVIOR — Phase-based AI with escalating drama
// ═══════════════════════════════════════════════════════════════════════════


// Archive lore bonuses — tester logs found grant passive combat boosts

// Spirit-amplified healing — called by all heal sources

// Spirit/Luck status resistance — returns true if status was resisted

// Archive-boosted + spirit-amplified damage multiplier

// Beta Integrity: apply skill fail chance + glitch damage to player each turn

// Spirit: reduce status duration on player when applying


// ── PIPER'S INFLUENCE METER ────────────────────────────────────────────────


/**
 * Save battle to database
 */

/**
 * Show battle UI (will be expanded in Chunk 3)
 */
var currentBattleLog = [];
var currentBattleIndex = 0;
var battlePlaybackInterval = null;

// ═══════════════════════════════════════════════════════════════════════════
// BATTLE MUSIC MANAGER
// Handles normal fight, boss, and Piper music with smooth fade transitions.
// Files expected at: /music/normalfightsong.mp3, /music/bossong.mp3, /music/pipersong.ogg
// ═══════════════════════════════════════════════════════════════════════════


var selectedBattlePetId = null;
var selectedBattleZone = 'outskirts'; // Default to easy zone


function showBattleUI(playerStats, enemyStats, battleResult) {
  // Store battle data
  currentBattleLog = battleResult.log;
  currentBattleIndex = 0;
  
  // Hide forest, show battle
  el('forest-exploration').style.display = 'none';
  el('battle-screen').style.display = 'block';
  
  // Set up player side
  el('player-battle-name').textContent = playerStats.name;
  el('player-hp-text').textContent = playerStats.currentHP + '/' + playerStats.maxHP;
  var playerHPPercent = (playerStats.currentHP / playerStats.maxHP) * 100;
  el('player-hp-fill').style.width = playerHPPercent + '%';
  
  // Set player sprite (pet image)
  var playerSprite = el('player-battle-sprite');
  if (playerStats.imageFile) {
    // Use the pet's actual image
    playerSprite.style.backgroundImage = 'url(images/' + playerStats.imageFile + ')';
    playerSprite.style.backgroundSize = 'cover';
    playerSprite.style.backgroundPosition = 'center';
    playerSprite.textContent = ''; // Remove emoji fallback
  } else {
    // Fallback to paw prints if no image
    playerSprite.textContent = '🐾';
  }
  
  // Set HP bar color based on percentage
  var playerHPFill = el('player-hp-fill');
  playerHPFill.classList.remove('low', 'critical');
  if (playerHPPercent <= 25) {
    playerHPFill.classList.add('critical');
  } else if (playerHPPercent <= 50) {
    playerHPFill.classList.add('low');
  }
  
  // Set up enemy side with sprite
  var enemyNameEl = el('enemy-battle-name');
  enemyNameEl.textContent = enemyStats.name;
  
  // Boss name gets glitch effect
  if (enemyStats.is_boss) {
    enemyNameEl.classList.add('boss-name-glitch');
  } else {
    enemyNameEl.classList.remove('boss-name-glitch');
  }
  
  // Set enemy HP display - BOSSES SHOW ???
  if (enemyStats.is_boss) {
    el('enemy-hp-text').textContent = '???/???';
  } else {
    el('enemy-hp-text').textContent = enemyStats.hp + '/' + enemyStats.hp;
  }
  el('enemy-hp-fill').style.width = '100%';
  
  // Boss HP bar gets special styling
  var enemyHPBar = el('enemy-hp-fill');
  if (enemyStats.is_boss) {
    enemyHPBar.classList.add('boss-hp-bar');
  } else {
    enemyHPBar.classList.remove('boss-hp-bar');
  }
  
  // Set enemy sprite based on species — emoji fallback (no broken sprite sheets)
  var enemySprite = el('enemy-battle-sprite');
  enemySprite.innerHTML = '';
  enemySprite.className = 'battle-sprite enemy-sprite';
  enemySprite.style.backgroundImage = 'none';
  enemySprite.style.transform = '';

  var speciesEmoji = {
    'bird': '🐦', 'bunny': '🐰', 'baby bunny': '🐰', 'rabbit': '🐰',
    'squirrel': '🐿️', 'fox': '🦊', 'boar': '🐗', 'wolf': '🐺',
    'bear': '🐻', 'deer': '🦌', 'mushroom': '🍄', 'slime': '💚',
    'spider': '🕷️', 'snake': '🐍', 'bat': '🦇',
    'ghost': '👻', 'bee': '🐝', 'cat': '🐱', 'dog': '🐶',
    'frog': '🐸', 'crab': '🦀', 'fish': '🐟', 'owl': '🦉',
    'rat': '🐀', 'mouse': '🐭', 'pig': '🐷', 'sheep': '🐑',
    'goat': '🐐', 'chicken': '🐔', 'turtle': '🐢', 'lizard': '🦎'
  };

  if (enemyStats.is_boss) {
    enemySprite.innerHTML = '<div class="boss-sprite" style="font-size:3rem;line-height:1;text-align:center;">?</div>';
  } else {
    var speciesKey = (enemyStats.species || '').toLowerCase();
    var emoji = speciesEmoji[speciesKey] || '👾';
    enemySprite.innerHTML = '<div style="font-size:3.5rem;line-height:1;text-align:center;">' + emoji + '</div>';
  }

  if (enemyStats.specialVariant) {
    enemySprite.classList.add('variant-' + enemyStats.specialVariant);
  }
  
  // Clear battle log
  el('battle-log').innerHTML = '';
  
  // Start playback
  el('battle-skip-btn').style.display = 'inline-block';
  el('battle-continue-btn').style.display = 'none';
  
  playBattleTurn();
}

// ══════════════════════════════════════════════════════════════════════════
// SPRITE ANIMATION SYSTEM - Dynamic configuration for varying sprite sheets
// ══════════════════════════════════════════════════════════════════════════


function stopSpriteAnimation(spriteElement) {
  if (!spriteElement) return;
  
  if (spriteElement._spriteInterval) {
    clearInterval(spriteElement._spriteInterval);
    spriteElement._spriteInterval = null;
  }
}


function updateHPBar(side, currentHP, maxHP) {
  var hpFill = el(side + '-hp-fill');
  var hpText = el(side + '-hp-text');
  
  var percentage = Math.max(0, (currentHP / maxHP) * 100);
  hpFill.style.width = percentage + '%';
  
  // Boss HP stays as ??? throughout battle
  if (side === 'enemy' && isBossBattle) {
    hpText.textContent = '???/???';
  } else {
    hpText.textContent = Math.max(0, currentHP) + '/' + maxHP;
  }
  
  // Color based on HP percentage
  hpFill.classList.remove('low', 'critical');
  if (percentage <= 25) {
    hpFill.classList.add('critical');
  } else if (percentage <= 50) {
    hpFill.classList.add('low');
  }
}

function animateHit(side) {
  var sprite = el(side + '-battle-sprite');
  sprite.classList.add('hit');
  setTimeout(function() {
    sprite.classList.remove('hit');
  }, 300);
}


// Load pets for battle selection
// ═══════════════════════════════════════════════════════════════════════════
// BATTLE-PAGE EXPEDITION SYSTEM
// Manages explorations from the Battle Arena — unlimited concurrent pets
// ═══════════════════════════════════════════════════════════════════════════

// Returns array of pet IDs currently on unexpired, unclaimed expeditions


// ── addPetXP helper ───────────────────────────────────────────────────────
// ── checkAndApplyLevelUp ──────────────────────────────────────────────────
// Reads current xp/level from DB (already written by RPC) and applies
// level-up logic without adding more XP. Safe to call after battle RPC.
async function checkAndApplyLevelUp(petId) {
  if (!petId || !currentUser) return;
  try {
    var { data: pet } = await supabaseClient
      .from('user_pets')
      .select('xp, level, max_hunger, max_energy, max_happiness, base_hp, base_attack, base_defense, base_speed, stat_points')
      .eq('id', petId)
      .single();
    if (!pet) return;

    var threshold = xpForLevel(pet.level || 1);
    if ((pet.xp || 0) < threshold) return; // not enough XP yet, nothing to do

    // Level up — calculate new stats (same logic as addPetXP)
    var lu = calculateLevelUp(pet.xp, pet.level, pet.max_hunger, pet.max_energy,
                              pet.max_happiness, pet.base_hp, pet.base_attack,
                              pet.base_defense, pet.base_speed);
    if (!lu.leveled) return;

    // Write level-up to DB (XP is already correct from RPC, just update level+stats)
    await supabaseClient.from('user_pets').update({
      xp:             lu.xp,
      level:          lu.level,
      max_hunger:     lu.maxHunger,
      max_energy:     lu.maxEnergy,
      max_happiness:  lu.maxHappiness,
      base_hp:        lu.base_hp,
      base_attack:    lu.base_attack,
      base_defense:   lu.base_defense,
      base_speed:     lu.base_speed,
      stat_points:    (pet.stat_points || 0) + 1
    }).eq('id', petId);

    // Sync petState
    if (petState[petId]) {
      petState[petId].xp           = lu.xp;
      petState[petId].level        = lu.level;
      petState[petId].max_hunger   = lu.maxHunger;
      petState[petId].max_energy   = lu.maxEnergy;
      petState[petId].max_happiness = lu.maxHappiness;
      petState[petId].base_hp      = lu.base_hp;
      petState[petId].base_attack  = lu.base_attack;
      petState[petId].base_defense = lu.base_defense;
      petState[petId].base_speed   = lu.base_speed;
      petState[petId].stat_points  = (pet.stat_points || 0) + 1;
    }

    onPetLevelUp(petId);
    var petName = (petState[petId] && (petState[petId].nickname || (petState[petId].pets && petState[petId].pets.name))) || 'Your pet';
    showToast('⭐ ' + petName + ' leveled up! Now Level ' + lu.level + '!', 4000);
    // Level milestone badges
    if (lu.level >= 5)  awardBadge('level_5').then(null, function(){});
    if (lu.level >= 10) { awardBadge('level_10').then(null, function(){}); awardBadge('baby_steps').then(null, function(){}); }
    if (lu.level >= 20) { awardBadge('level_20').then(null, function(){}); awardBadge('teen_spirit').then(null, function(){}); }
    if (lu.level >= 40) awardBadge('adult_swim').then(null, function(){});
    if (lu.level >= 60) awardBadge('elder_wisdom').then(null, function(){});
    // JOURNAL: catchphrase unlocks on first level up; secret_talent at level 10+
    var _luPetType = (petState[petId] && petState[petId].pets && petState[petId].pets.name) || null;
    if (_luPetType && typeof logJournalDiscovery === 'function') {
      logJournalDiscovery(_luPetType, 'catchphrase', '').then(null, function(){});
      if (lu.level >= 10) {
        logJournalDiscovery(_luPetType, 'secret_talent', '').then(null, function(){});
      }
    }
    tabsLoaded['mypets'] = false;
    dbg('[LevelUp] Pet', petId, '→ level', lu.level);

    // Check again in case XP spans multiple levels (large jump)
    if (lu.xp >= xpForLevel(lu.level)) {
      await checkAndApplyLevelUp(petId);
    }
  } catch(e) { dbg('[checkAndApplyLevelUp] error:', e); }
}

async function addPetXP(petId, xpAmount) {
  if (!petId || !xpAmount) return;
  try {
    // Always fetch fresh from DB so we have accurate level and all stat fields
    var { data: pet } = await supabaseClient
      .from('user_pets')
      .select('xp, level, max_hunger, max_energy, max_happiness, base_hp, base_attack, base_defense, base_speed, stat_points')
      .eq('id', petId)
      .single();
    if (!pet) return;

    var newXP = (pet.xp || 0) + xpAmount;

    // Check for level-up (may chain multiple levels on large XP awards)
    var lu = calculateLevelUp(newXP, pet.level, pet.max_hunger, pet.max_energy, pet.max_happiness,
                              pet.base_hp, pet.base_attack, pet.base_defense, pet.base_speed);

    if (lu.leveled) {
      // Write the full level-up state to DB
      await supabaseClient.from('user_pets').update({
        xp:             lu.xp,
        level:          lu.level,
        max_hunger:     lu.maxHunger,
        max_energy:     lu.maxEnergy,
        max_happiness:  lu.maxHappiness,
        base_hp:        lu.base_hp,
        base_attack:    lu.base_attack,
        base_defense:   lu.base_defense,
        base_speed:     lu.base_speed,
        stat_points:    (pet.stat_points || 0) + 1
      }).eq('id', petId);

      // Sync petState cache
      if (petState[petId]) {
        petState[petId].xp          = lu.xp;
        petState[petId].level       = lu.level;
        petState[petId].max_hunger  = lu.maxHunger;
        petState[petId].max_energy  = lu.maxEnergy;
        petState[petId].max_happiness = lu.maxHappiness;
        petState[petId].base_hp     = lu.base_hp;
        petState[petId].base_attack = lu.base_attack;
        petState[petId].base_defense = lu.base_defense;
        petState[petId].base_speed  = lu.base_speed;
        petState[petId].stat_points = (pet.stat_points || 0) + 1;
      }

      // Hooks and notifications
      onPetLevelUp(petId);
      showToast('⭐ Level Up! Your pet is now level ' + lu.level + '!', 4000);
      dbg('[XP] Level up! Pet', petId, '→ level', lu.level, 'stat gains:', lu.statIncreases);
    } else {
      // No level-up, just save XP
      await supabaseClient.from('user_pets').update({ xp: newXP }).eq('id', petId);
      if (petState[petId]) petState[petId].xp = newXP;
    }
  } catch(e) { dbg('addPetXP error:', e); }
}

// ── Confirm Purchase Modal ─────────────────────────────────────────────────
function confirmPurchase(itemName, price, onConfirm) {
  var modal = makeModal();
  modal.innerHTML =
    '<div style="text-align:center;padding:10px;max-width:320px;">' +
      '<div style="font-size:2rem;margin-bottom:10px;">🛒</div>' +
      '<h3 style="margin-bottom:8px;">Confirm Purchase</h3>' +
      '<p style="color:var(--text-light);font-size:0.9rem;margin-bottom:18px;">Buy <strong>' + escapeHtml(itemName) + '</strong> for <strong>' + price + ' PP</strong>?</p>' +
      '<div style="display:flex;gap:10px;">' +
        '<button class="btn btn-outline" onclick="closeModal()" style="flex:1;">Cancel</button>' +
        '<button class="btn btn-primary" id="confirm-buy-btn" style="flex:1;">Buy</button>' +
      '</div>' +
    '</div>';
  openModal(modal);
  document.getElementById('confirm-buy-btn').onclick = function() {
    closeModal();
    onConfirm();
  };
}


// ═══════════════════════════════════════════════════════════════════════════
// RANDOM ENCOUNTERS SYSTEM
// ═══════════════════════════════════════════════════════════════════════════


async function handleFlavorEncounter() {
  // Zone-themed flavor events — different vibes per area
  var zone = selectedBattleZone || 'outskirts';

  var flavorByZone = {
    outskirts: [
      { text: "Your pet rifled through some trash and found a shiny coin.", pp: 12, emoji: "🗑️" },
      { text: "A stray cat gave your pet a long, judgemental stare, then walked away.", pp: 8, emoji: "🐱" },
      { text: "You found a crumpled receipt from a store that closed years ago.", pp: 10, emoji: "🧾" },
      { text: "A pigeon dropped something on your pet. It was a coin. Somehow.", pp: 14, emoji: "🐦" },
      { text: "Someone left half a sandwich on a bench. Your pet ate it before you could stop them.", pp: 9, emoji: "🥪" },
      { text: "A street musician played a familiar melody. You couldn't place it.", pp: 11, emoji: "🎵" },
      { text: "Your pet found a lost glove. Just the one. Where is the other one?", pp: 8, emoji: "🧤" },
      { text: "You spotted a strange symbol spray-painted on a wall. It looked like it was watching you.", pp: 15, emoji: "🌀" },
    ],
    glade: [
      { text: "Your pet chased a butterfly for ten minutes. The butterfly won.", pp: 7, emoji: "🦋" },
      { text: "You found a four-leaf clover. Good omen, probably.", pp: 13, emoji: "🍀" },
      { text: "A small bird dropped a berry directly into your pet's mouth. Convenient.", pp: 9, emoji: "🫐" },
      { text: "Your pet rolled in some flowers. They smell absolutely divine now.", pp: 8, emoji: "🌺" },
      { text: "A sunny patch of grass. Your pet napped for exactly three minutes.", pp: 10, emoji: "☀️" },
      { text: "You heard a distant song carried on the wind. It felt oddly familiar.", pp: 12, emoji: "🎶" },
      { text: "A firefly landed on your pet's nose and just... stayed there.", pp: 10, emoji: "✨" },
      { text: "The pond reflected a sky that looked slightly different from the one above you.", pp: 14, emoji: "🌊" },
    ],
    deepwoods: [
      { text: "Something watched you from between the trees. When you looked, nothing was there.", pp: 15, emoji: "🌲" },
      { text: "Your pet sniffed a mushroom. The mushroom seemed offended.", pp: 10, emoji: "🍄" },
      { text: "You found old footprints that didn't match any creature you recognize.", pp: 14, emoji: "🐾" },
      { text: "The birds stopped singing all at once. Then started again a moment later.", pp: 12, emoji: "🦜" },
      { text: "There was a circle of perfectly flat grass. Your pet refused to enter it.", pp: 16, emoji: "⭕" },
      { text: "A tree had carvings in it. Most were initials. One was a date from 200 years ago.", pp: 13, emoji: "🌳" },
      { text: "You found honey dripping from a hollow log. No bees in sight.", pp: 11, emoji: "🍯" },
      { text: "Something rustled in the dark. Probably just the wind.", pp: 9, emoji: "💨" },
    ],
    ruins: [
      { text: "A stone moved beneath your foot and revealed a hidden compartment. It was empty.", pp: 15, emoji: "🏛️" },
      { text: "Strange symbols on the wall began to glow faintly, then stopped.", pp: 18, emoji: "✨" },
      { text: "You found a door that shouldn't be here. It was locked. The lock looked new.", pp: 20, emoji: "🚪" },
      { text: "The ruins whispered something. You didn't catch it. You don't think you want to.", pp: 16, emoji: "👂" },
      { text: "A single coin, minted in a country that doesn't exist anymore.", pp: 17, emoji: "🪙" },
      { text: "Your pet pressed their ear to the ground and growled softly.", pp: 13, emoji: "🔊" },
      { text: "A perfectly preserved jar of something. You left it where you found it.", pp: 14, emoji: "🫙" },
      { text: "The Archivist's filing system, scrawled on a wall. Your name is in it.", pp: 25, emoji: "📋" },
    ],
    hollow_warrens: [
      { text: "Something small darted past in the dark. Too fast to see clearly.", pp: 12, emoji: "🐇" },
      { text: "The tunnels echo strangely here. Your voice came back a second late.", pp: 14, emoji: "🌀" },
      { text: "A warren dead-end. Scratch marks on the wall. Something was trying to get out.", pp: 16, emoji: "🪨" },
      { text: "Old nesting material. Whatever lived here was large. Is large.", pp: 13, emoji: "🌿" },
    ],
    ashen_ruins: [
      { text: "The fire here burns without fuel. It has burned for a very long time.", pp: 16, emoji: "🔥" },
      { text: "Ash fell upward for a moment. Then the world remembered gravity.", pp: 18, emoji: "💨" },
      { text: "Scorched carvings. Someone was counting something. The number is very large.", pp: 20, emoji: "🔢" },
      { text: "The heat doesn't bother your pet. That should probably concern you.", pp: 15, emoji: "🌡️" },
    ]
  };

  // Fall back to generic events if zone not found
  var zoneEvents = flavorByZone[zone] || flavorByZone.outskirts;
  // Mix in a few universal events too
  var universal = [
    { text: "You found a shiny pebble. It's not worth anything, but it's yours now.", pp: 8, emoji: "✨" },
    { text: "Your pet stopped to stare at something you couldn't see. They looked satisfied.", pp: 10, emoji: "🐾" },
    { text: "You heard a melody you didn't recognize. It stopped when you tried to hum it back.", pp: 11, emoji: "🎵" },
  ];
  var allEvents = zoneEvents.concat(universal);
  var event = allEvents[Math.floor(Math.random() * allEvents.length)];

  await awardPP(event.pp, 'flavor_event');

  showExplorationResult(
    event.emoji + ' Out in the ' + (zone === 'outskirts' ? 'Outskirts' : zone === 'glade' ? 'Glade' : zone === 'deepwoods' ? 'Deep Woods' : zone === 'ruins' ? 'Ruins' : 'Wild') + '...',
    event.text + '<br><br><span style="font-size:0.78rem;color:var(--text-light);font-style:italic;">(Just a moment — nothing was unlocked.)</span>',
    '+' + event.pp + ' PP',
    'Continue'
  );
}

// ── Recipe Book encounter — unlocks one random undiscovered cooking recipe ──


// Show exploration result in battle screen area
function showExplorationResult(title, message, reward, buttonText, showExploreAgain) {
  // Hide battle container FIRST to prevent 1-frame flash of last battle
  var bc = document.querySelector('.battle-container');
  if (bc) bc.style.display = 'none';
  var playerSprite = document.getElementById('player-battle-sprite');
  var enemySprite  = document.getElementById('enemy-battle-sprite');
  if (playerSprite) playerSprite.innerHTML = '';
  if (enemySprite)  enemySprite.innerHTML  = '';

  // Hide exploration UI, show battle screen
  document.getElementById('forest-exploration').style.display = 'none';
  document.getElementById('battle-screen').style.display = 'block';

  // Build result HTML (message may contain trusted HTML like <strong> tags)
  var resultHTML =
    '<div style="font-size:1.3rem;font-weight:bold;color:var(--purple);margin-bottom:12px;">' + escapeHtml(String(title)) + '</div>' +
    '<div style="font-size:1.05rem;line-height:1.65;margin-bottom:14px;">' + String(message) + '</div>' +
    '<div style="font-size:1.15rem;font-weight:bold;color:var(--green);">' + escapeHtml(String(reward)) + '</div>';

  // Render ONLY in the narrative box — hide the battle-log-container to prevent duplication
  var battleLog = document.getElementById('battle-log');
  if (battleLog) battleLog.innerHTML = '';
  var logCont = document.getElementById('battle-log-container');
  if (logCont) logCont.style.display = 'none';

  var narr = document.getElementById('battle-narrative-box');
  if (narr) {
    narr.style.display = 'block';
    narr.innerHTML = '<div style="padding:16px;text-align:center;">' + resultHTML + '</div>';
  }

  // Controls
  document.getElementById('battle-skip-btn').style.display = 'none';
  var legacyControls = document.getElementById('battle-controls-legacy');
  if (legacyControls) legacyControls.style.cssText = 'display:flex!important;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:16px;';

  var continueBtn = document.getElementById('battle-continue-btn');
  if (continueBtn) {
    continueBtn.style.display = 'inline-block';
    continueBtn.textContent = buttonText;
    continueBtn.onclick = function() {
      if (legacyControls) legacyControls.style.cssText = 'display:none!important';
      var bc2 = document.querySelector('.battle-container');
      if (bc2) bc2.style.display = 'flex';
      if (logCont) logCont.style.display = '';
      closeBattle();
    };
  }

  // Add/update "Explore Again" button
  var existingAgainBtn = document.getElementById('explore-again-btn');
  if (existingAgainBtn) existingAgainBtn.remove();
  if (showExploreAgain !== false) {
    var againBtn = document.createElement('button');
    againBtn.id = 'explore-again-btn';
    againBtn.className = 'btn btn-primary';
    againBtn.textContent = '🌲 Explore Again';
    againBtn.style.cssText = 'margin-left:8px;';
    againBtn.onclick = function() {
      if (legacyControls) legacyControls.style.cssText = 'display:none!important';
      var bc3 = document.querySelector('.battle-container');
      if (bc3) bc3.style.display = 'flex';
      if (logCont) logCont.style.display = '';
      if (narr) { narr.style.display = 'none'; narr.innerHTML = ''; }
      // Hide battle screen, show exploration
      document.getElementById('battle-screen').style.display = 'none';
      document.getElementById('forest-exploration').style.display = 'block';
      // Immediately go again
      goExploring();
    };
    if (legacyControls) legacyControls.appendChild(againBtn);
  }
}

function closeExplorationModal() {
  document.getElementById('exploration-modal').classList.remove('show');
  pendingBattleEnemy = null;
}

// ═══════════════════════════════════════════════════════════════════════════
// BATTLE SYSTEM (Original findBattle function)
// ═══════════════════════════════════════════════════════════════════════════


// Load battle pets when tab is opened
/**
 * Get random enemy from zone with level scaling
 */

// ═══════════════════════════════════════════════════════════════════════
// BOSS ENCOUNTER SYSTEM - Shadow of Piper
// ═══════════════════════════════════════════════════════════════════════


// Spawn creepy "YOU SHOULDN'T BE HERE" text that scrolls across screen
var bossWarningInterval = null;
var activeWarnings = []; // Track active warning positions to prevent overlap

function startBossWarningText() {
  // Clear any existing interval
  if (bossWarningInterval) clearInterval(bossWarningInterval);
  
  // Spawn 3-4 warnings immediately
  for (var i = 0; i < Math.floor(Math.random() * 2) + 3; i++) { // 3-4 texts
    setTimeout(function() {
      spawnWarningText();
    }, i * 800); // Stagger by 0.8 seconds
  }
  
  // Keep spawning 3-4 warnings every 4 seconds during boss fight
  bossWarningInterval = setInterval(function() {
    var count = Math.floor(Math.random() * 2) + 3; // 3-4 texts
    for (var i = 0; i < count; i++) {
      setTimeout(function() {
        spawnWarningText();
      }, i * 800);
    }
  }, 4000);
}

function spawnWarningText() {
  // On mobile: limit number of concurrent warnings to reduce lag
  var isMobile = window.innerWidth < 768;
  if (isMobile && activeWarnings.length >= 3) return; // cap at 3 on mobile
  var warning = document.createElement('div');
  warning.className = 'boss-warning-text';
  warning.textContent = 'YOU SHOULDN\'T BE HERE';
  
  // Random direction: left-to-right or right-to-left
  var scrollRight = Math.random() > 0.5;
  
  // Find a Y position that doesn't overlap with existing warnings
  var y = findNonOverlappingY();
  
  warning.style.top = y + 'px';
  
  if (scrollRight) {
    warning.classList.add('boss-warning-scroll-right');
    warning.style.right = '-100%';
  } else {
    warning.classList.add('boss-warning-scroll-left');
    warning.style.left = '-100%';
  }
  
  // Track this warning's position
  var warningData = { element: warning, y: y, height: 100 }; // Approximate height
  activeWarnings.push(warningData);
  
  document.body.appendChild(warning);
  
  // Remove after animation completes (6 seconds)
  setTimeout(function() {
    if (warning && warning.parentNode) {
      warning.remove();
    }
    // Remove from active warnings array
    var idx = activeWarnings.indexOf(warningData);
    if (idx > -1) activeWarnings.splice(idx, 1);
  }, 6000);
}

function findNonOverlappingY() {
  var maxAttempts = 30; // Increased from 20 to handle more warnings
  var minGap = 140; // Increased gap for better spacing
  
  for (var attempt = 0; attempt < maxAttempts; attempt++) {
    // Random Y position (leaving margins)
    var y = Math.random() * (window.innerHeight - 200) + 50;
    
    // Check if this Y overlaps with any active warnings
    var overlaps = false;
    for (var i = 0; i < activeWarnings.length; i++) {
      var existing = activeWarnings[i];
      if (Math.abs(y - existing.y) < minGap) {
        overlaps = true;
        break;
      }
    }
    
    if (!overlaps) {
      return y;
    }
  }
  
  // If we can't find a spot, try splitting the screen into zones
  var zones = 5;
  var zoneHeight = (window.innerHeight - 200) / zones;
  var leastUsedZone = 0;
  var leastUsedCount = 999;
  
  for (var z = 0; z < zones; z++) {
    var zoneStart = 50 + (z * zoneHeight);
    var zoneEnd = zoneStart + zoneHeight;
    var count = 0;
    
    for (var i = 0; i < activeWarnings.length; i++) {
      if (activeWarnings[i].y >= zoneStart && activeWarnings[i].y < zoneEnd) {
        count++;
      }
    }
    
    if (count < leastUsedCount) {
      leastUsedCount = count;
      leastUsedZone = z;
    }
  }
  
  // Return a position in the least-used zone
  return 50 + (leastUsedZone * zoneHeight) + Math.random() * (zoneHeight * 0.8);
}

function stopBossWarningText() {
  if (bossWarningInterval) {
    clearInterval(bossWarningInterval);
    bossWarningInterval = null;
  }
  
  // Remove all existing warning texts
  document.querySelectorAll('.boss-warning-text').forEach(function(warning) {
    warning.remove();
  });
  
  // Clear active warnings array
  activeWarnings = [];
}

function triggerBossDeathScreen() {
  dbg('💀 Boss death screen triggered...');
  
  // Stop scrolling warnings
  stopBossWarningText();
  
  // Start glitchy music fade-out effect (now 6 seconds)
  startBossMusicGlitchFade();
  
  // Create fade to black overlay
  var fadeOverlay = document.createElement('div');
  fadeOverlay.id = 'boss-death-fade';
  fadeOverlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: black; opacity: 0; z-index: 99999; pointer-events: none; transition: opacity 5s ease-in;';
  document.body.appendChild(fadeOverlay);
  
  // Wave 1: Initial warnings (0.5s) - 3-4 warnings
  setTimeout(function() {
    var count1 = Math.floor(Math.random() * 2) + 3; // 3-4
    for (var i = 0; i < count1; i++) {
      setTimeout(function() {
        spawnDeathWarning();
      }, i * 400);
    }
  }, 500);
  
  // Wave 2: More warnings (1.5s) - 2-3 warnings
  setTimeout(function() {
    var count2 = Math.floor(Math.random() * 2) + 2; // 2-3
    for (var i = 0; i < count2; i++) {
      setTimeout(function() {
        spawnDeathWarning();
      }, i * 350);
    }
  }, 1500);
  
  // Wave 3: Even more (2.5s) - 3-4 warnings
  setTimeout(function() {
    var count3 = Math.floor(Math.random() * 2) + 3; // 3-4
    for (var i = 0; i < count3; i++) {
      setTimeout(function() {
        spawnDeathWarning();
      }, i * 450);
    }
  }, 2500);
  
  // Wave 4: Keep them coming (3.5s) - 2-3 warnings
  setTimeout(function() {
    var count4 = Math.floor(Math.random() * 2) + 2; // 2-3
    for (var i = 0; i < count4; i++) {
      setTimeout(function() {
        spawnDeathWarning();
      }, i * 400);
    }
  }, 3500);
  
  // Wave 5: Final wave (4.5s) - 2-3 warnings
  setTimeout(function() {
    var count5 = Math.floor(Math.random() * 2) + 2; // 2-3
    for (var i = 0; i < count5; i++) {
      setTimeout(function() {
        spawnDeathWarning();
      }, i * 500);
    }
  }, 4500);
  
  // Start fade to black
  setTimeout(function() {
    fadeOverlay.style.opacity = '1';
  }, 100);
  
  // After fade: show WE WARNED YOU, then log out
  setTimeout(function() {
    // Keep screen black, show WE WARNED YOU messages
    document.querySelectorAll('.boss-death-warning').forEach(function(w) { w.remove(); });

    // Spawn multiple WE WARNED YOU texts on black screen
    for (var wi = 0; wi < 8; wi++) {
      (function(delay) {
        setTimeout(function() { spawnDeathWarning(); }, delay);
      })(wi * 200);
    }

    // Log out while screen is black (user sees WE WARNED YOU, then login screen)
    setTimeout(function() {
      clearBossEffects();
      fadeOverlay.remove();
      resumeNormalMusic();
      // Sign the player out
      if (typeof supabaseClient !== 'undefined') {
        supabaseClient.auth.signOut().then(function() {
          window.location.reload();
        }).catch(function() {
          window.location.reload();
        });
      } else {
        window.location.reload();
      }
    }, 3000); // 3s of WE WARNED YOU on black, then reload to login
  }, 5500);
}

function startBossMusicGlitchFade() {
  if (!window.bossThemeAudio) return;
  
  var audio = window.bossThemeAudio;
  var startTime = Date.now();
  var fadeDuration = 6000; // Extended to 6 seconds (was 3500)
  var startVolume = audio.volume;
  
  // Create audio context for pitch/distortion effects
  if (!window.audioContext) {
    try {
      window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      dbg('Web Audio API not supported, falling back to simple fade');
      simpleMusicFade(audio, startVolume, fadeDuration);
      return;
    }
  }
  
  var ctx = window.audioContext;
  
  // Only create source once
  if (!window.bossAudioSource) {
    var source = ctx.createMediaElementSource(audio);
    var gainNode = ctx.createGain();
    var filter = ctx.createBiquadFilter();
    
    // Set up filter for distortion effect
    filter.type = 'lowpass';
    filter.frequency.value = 1000;
    
    // Connect: source -> filter -> gain -> destination
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    window.bossAudioSource = source;
    window.bossGainNode = gainNode;
    window.bossFilterNode = filter;
  }
  
  var gainNode = window.bossGainNode;
  var filter = window.bossFilterNode;
  
  // Glitchy fade-out animation
  var glitchInterval = setInterval(function() {
    var elapsed = Date.now() - startTime;
    var progress = Math.min(elapsed / fadeDuration, 1);
    
    if (progress >= 1) {
      clearInterval(glitchInterval);
      audio.pause();
      return;
    }
    
    // Volume fade (smooth exponential curve)
    var volumeFade = Math.pow(1 - progress, 2);
    gainNode.gain.value = volumeFade;
    
    // Pitch distortion (slow down playback)
    audio.playbackRate = 1 - (progress * 0.5); // Slow down to 0.5x speed
    
    // Filter sweep (muffle the sound)
    filter.frequency.value = 1000 - (progress * 900); // 1000Hz -> 100Hz
    
    // Random glitch stutters
    if (Math.random() < 0.15) {
      audio.playbackRate = 0.3 + Math.random() * 0.4; // Random slow stutters
      setTimeout(function() {
        audio.playbackRate = Math.max(0.5, 1 - (progress * 0.5));
      }, 100);
    }
  }, 50); // Update every 50ms
}

function simpleMusicFade(audio, startVolume, duration) {
  // Fallback for browsers without Web Audio API
  var startTime = Date.now();
  var fadeInterval = setInterval(function() {
    var elapsed = Date.now() - startTime;
    var progress = Math.min(elapsed / duration, 1);
    
    if (progress >= 1) {
      clearInterval(fadeInterval);
      audio.pause();
      return;
    }
    
    // Simple volume fade
    audio.volume = startVolume * (1 - progress);
    
    // Slow down playback
    audio.playbackRate = 1 - (progress * 0.5);
  }, 50);
}

function spawnDeathWarning() {
  var warning = document.createElement('div');
  warning.className = 'boss-death-warning';
  warning.textContent = 'WE WARNED YOU';
  
  // Random position
  var x = Math.random() * (window.innerWidth - 500) + 100;
  var y = Math.random() * (window.innerHeight - 200) + 100;
  
  warning.style.position = 'fixed';
  warning.style.left = x + 'px';
  warning.style.top = y + 'px';
  warning.style.fontSize = '4rem';
  warning.style.fontWeight = '900';
  warning.style.color = '#FF0000';
  warning.style.textShadow = '0 0 20px #FF0000, 0 0 40px #FF0000, 5px 5px 0 #000';
  warning.style.zIndex = '100000';
  warning.style.fontFamily = 'Arial Black, sans-serif';
  warning.style.opacity = '0';
  warning.style.animation = 'death-warning-shake 0.15s infinite, death-warning-fade 5s ease-in-out forwards';
  
  document.body.appendChild(warning);
}

function resumeNormalMusic() {
  // Stop boss music
  if (window.bossThemeAudio) {
    window.bossThemeAudio.pause();
    window.bossThemeAudio.currentTime = 0;
    window.bossThemeAudio.playbackRate = 1.0; // Reset playback rate
    window.bossThemeAudio.volume = 0.20; // Reset volume
  }
  
  // Clean up audio nodes
  window.bossAudioSource = null;
  window.bossGainNode = null;
  window.bossFilterNode = null;
  
  // Resume normal background music if it exists
  var bgMusic = document.querySelector('audio[loop]');
  if (bgMusic) {
    bgMusic.volume = 0.3; // Reset to normal volume
    bgMusic.playbackRate = 1.0; // Ensure normal speed
    bgMusic.play();
  }
}


// ========================================
// MELON MASCOT SPOOKY DIALOGUE SYSTEM
// ========================================

var melonDialogueTimeout = null;

function initMelonDialogue() {
  var dialogueEl = document.getElementById('melon-dialogue');
  if (!dialogueEl) return;
  
  // 3% chance for spooky dialogue (was 10%, now much rarer!)
  var isSpooky = Math.random() < 0.12;
  
  if (isSpooky && playerSettings.spooky_enabled) {
    showSpookyDialogue();
  } else {
    showNormalDialogue();
  }
}

function showNormalDialogue() {
  var dialogueEl = document.getElementById('melon-dialogue');
  if (!dialogueEl) return;
  
  dialogueEl.innerHTML = "Welcome to the Shop! I'm Melon! Buy whatever you need!";
  dialogueEl.style.animation = 'bubble-float 3s ease-in-out infinite';
}

function showSpookyDialogue() {
  var dialogueEl = document.getElementById('melon-dialogue');
  if (!dialogueEl) return;
  
  // TRIGGER DIALOGUE BOX GLITCH EFFECT ONLY!
  dialogueEl.classList.add('page-glitch');
  // Remove glitch class after animation completes
  setTimeout(function() {
    dialogueEl.classList.remove('page-glitch');
  }, 800);
  
  // Rotating spooky Melon lines — each feels slightly different in tone
  var melonSpookyLines = [
    'I have to run the shop now that <span class="glitch-text">Piper</span> has gone missing.',
    'Buy whatever you need! <span class="glitch-text">Piper</span> used to say that too.',
    'Is your pet happy today? They look happy. They always look happy.',
    'I\'ve been here a long time. So have you. Isn\'t that nice?',
    'Welcome to the shop! Everything is fine. <span class="glitch-text">Everything is fine.</span>',
    'I\'m not sure what happened to the last guide. I\'m sure it was nothing.',
    'Your pet seems very attached to you. That\'s good. That\'s very good.',
    'Sometimes I think the pets remember things I don\'t. But I\'m just the shopkeeper.',
  ];
  var melonLine = melonSpookyLines[Math.floor(Math.random() * melonSpookyLines.length)];
  dialogueEl.innerHTML = melonLine;
  dialogueEl.style.animation = 'bubble-float 3s ease-in-out infinite';
  
  // Revert back to normal dialogue after 5-6 seconds
  var revertTime = 5000 + Math.random() * 1000; // 5-6 seconds
  
  clearTimeout(melonDialogueTimeout);
  melonDialogueTimeout = setTimeout(function() {
    showNormalDialogue();
  }, revertTime);
}

// Initialize Melon dialogue when shop tab is shown
// Use MutationObserver to detect when shop section becomes active
function setupMelonDialogueWatcher() {
  var shopSection = document.getElementById('section-shop');
  if (!shopSection) return;
  
  // Check if shop is already active on load
  if (shopSection.classList.contains('active')) {
    setTimeout(initMelonDialogue, 100);
  }
  
  // Watch for class changes to detect when shop becomes active
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        if (shopSection.classList.contains('active')) {
          setTimeout(initMelonDialogue, 100);
        }
      }
    });
  });
  
  observer.observe(shopSection, { attributes: true });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupMelonDialogueWatcher);
} else {
  setupMelonDialogueWatcher();
}


// ═══════════════════════════════════════════════════════════════════════════
// FRIENDS SYSTEM
// ═══════════════════════════════════════════════════════════════════════════


// Update friend request notification badge

// Switch between friends tabs

// Load friends list

// Load friend requests

// Load blocked users

// Render friend card (used for friends, requests, and blocked users)
// ── Friend "last active" helpers ────────────────────────────────────────────


// Search for players

// Send friend request from search results

// Send friend request from profile page

// Accept friend request

// Decline friend request

// Confirm and remove friend


// Remove friend from profile page

// ═══════════════════════════════════════════════════════════════════════════
// BLOCKING SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

// Block user from profile

// Unblock user from profile

// Confirm and unblock from blocked users list


// Update profile action buttons based on relationship status

// ═══════════════════════════════════════════════════════════════════════════
// GUESTBOOK SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

// Character counter for guestbook
/* ═══════════════════════════════════════════════════════════════════════
   DAILY STATS (today's community numbers)
   The news ticker that used to own this — along with getEventAnnouncement()
   — is migrated: webapp/src/components/NewsTicker.vue +
   services/NewsTickerService.js + data/newsTickerData.js.
   Only this loader is kept, because the still-unmigrated "Today in
   PawketPets" home card reads it (see today_ render below).
   ═══════════════════════════════════════════════════════════════════════ */

var _dailyStatsCache = null;
var _dailyStatsCacheDate = null;

async function loadDailyStatsToday() {
  var today = new Date().toISOString().slice(0, 10);
  if (_dailyStatsCache && _dailyStatsCacheDate === today) return _dailyStatsCache;
  try {
    var { data } = await supabaseClient.from('daily_stats').select('*').eq('stat_date', today).maybeSingle();
    _dailyStatsCache = data || {};
    _dailyStatsCacheDate = today;
  } catch (e) { _dailyStatsCache = {}; }
  return _dailyStatsCache;
}

/* ═══════════════════════════════════════════════════════════════════════
   PHASE 2B: DAILY FORTUNE SYSTEM - One Fortune Per Day
   ═══════════════════════════════════════════════════════════════════════ */

var dailyFortune = {
  fortunes: {
    wholesome: [
      "Today is ideal for pet cuddles. Maximum coziness energy detected.",
      "A friendly encounter awaits you in the Deep Woods today.",
      "Your pets will be extra adorable today. Prepare your heart.",
      "Fortune favors the kind today. Share snacks, receive blessings.",
      "Today brings unexpected friendship. Keep your heart open.",
      "The stars align for peaceful adventures. Enjoy the calm.",
      "Your pets believe in you. You should too.",
      "Today is perfect for trying something new. The void approves.",
      "Kindness will be returned to you threefold today.",
      "A pleasant surprise awaits in the marketplace.",
      "Today your pets will teach you something important. Pay attention.",
      "The universe suggests: take it easy today. Rest is productive.",
      "Your collection grows stronger. Trust the journey.",
      "Today brings good news from an unexpected source.",
      "The Deep Woods whisper encouragement. You've got this."
    ],
    
    cursed: [
      "Beware emotionally unstable mushrooms today. They're having a day.",
      "The golden bunny is watching. Stay alert.",
      "Today the void feels... chatty. This is concerning.",
      "Strange energies in the ruins today. Maybe visit tomorrow instead.",
      "The mushrooms are plotting something. We don't know what.",
      "Mercury is in retrograde. Also there's no mercury. Still cursed though.",
      "Today's chaos levels: moderately concerning. Proceed with caution.",
      "The Deep Woods are feeling 'extra' today. Tread carefully.",
      "Warning: Today's aesthetic is 'mildly ominous.' Embrace it or hide.",
      "The spoons are restless today. Lock them up.",
      "A mysterious figure will judge your life choices today. It's you. You're the figure.",
      "Today the ruins are having 'bad vibes.' Recommend staying away.",
      "The butterflies know something you don't. This is fine. Probably.",
      "Beware of overconfidence today. The mushrooms are watching.",
      "Today's energy: 'what could possibly go wrong?' (Everything. Everything could.)"
    ],
    
    funny: [
      "A spoon shall guide your path today. Yes, really.",
      "Lucky numbers: 7, 13, and the number of snacks in your inventory.",
      "Today you will meet someone who REALLY likes mushrooms. Be polite.",
      "Your pet will do something incredibly stupid today. Love them anyway.",
      "Fortune says: 'lol good luck' - we don't know what this means either.",
      "Today's power move: aggressive napping. Channel your inner Pyxshuul.",
      "A wooden spoon brings unexpected fortune. We're as confused as you are.",
      "Today you will witness peak comedy. It will be your pet falling over.",
      "The prophecy states: 'snacks solve everything.' The prophecy is correct.",
      "Your destiny involves exactly three (3) silly shenanigans today.",
      "Today's quest: pet every single creature you meet. This is mandatory.",
      "The universe suggests: chaos, but make it cute.",
      "Fortune cookie says: 'pet the dog.' (There are no dogs here. Pet something else.)",
      "Today's mood: unhinged but supportive. Embrace it.",
      "A great adventure awaits! It's probably just finding your lost spoon."
    ],
    
    mysterious: [
      "The Deep Woods call to you today. Will you answer?",
      "Something ancient stirs in the ruins. Approach with respect.",
      "Today you will understand something you didn't yesterday.",
      "The boundary between worlds grows thin today. Stay curious.",
      "A secret will reveal itself when you least expect it.",
      "The void is watching respectfully. No need for concern.",
      "Today the forest remembers. Listen closely.",
      "An old friend returns. Or perhaps they never left.",
      "The stars align in ways we don't fully understand. Trust your instincts.",
      "Today you walk between destinies. Choose wisely.",
      "Something important is hidden in plain sight today.",
      "The mushrooms know more than they let on. As always.",
      "Today the world is softer than usual. Move gently through it.",
      "A choice you make today echoes further than you know.",
      "The ruins whisper secrets to those who listen."
    ],
    
    chaotic: [
      "Today's energy: GO ABSOLUTELY FERAL. (In a fun way.)",
      "The prophecy is unclear but VERY ENTHUSIASTIC.",
      "Today: maximum chaos, zero regrets. The void approves.",
      "Fortune says: 'yeet yourself into adventure.' We don't make the rules.",
      "Today you are unstoppable. Probably. We'll see.",
      "The stars spell out: 'DO IT.' We don't know what 'it' is. Neither do the stars.",
      "Today's vibe: unhinged but productive. Channel that energy.",
      "Chaos reigns today, but like, in a supportive way.",
      "The universe is in your corner today. Fight everything. (Or don't.)",
      "Today you have protagonist energy. Use it wisely. Or don't. Your call.",
      "Fortune favors the bold, the brave, and the slightly unhinged today.",
      "Today: be the chaos you wish to see in the world.",
      "The void says: 'send it.' This is either good advice or terrible advice.",
      "Today's forecast: 100% chance of shenanigans. Dress accordingly.",
      "The Deep Woods are EXTRA today. Match that energy."
    ]
  },
  
  init: function() {
    // Check if user should see fortune
    var lastFortune = localStorage.getItem('lastFortuneDate');
    var today = this.getTodayDate();
    
    if (lastFortune !== today) {
      // Show fortune popup after a brief delay
      setTimeout(function() {
        dailyFortune.showFortune();
      }, 2000);
    }
  },
  
  getTodayDate: function() {
    var date = new Date();
    return date.getFullYear() + '-' + 
           String(date.getMonth() + 1).padStart(2, '0') + '-' + 
           String(date.getDate()).padStart(2, '0');
  },
  
  getRandomFortune: function() {
    var categories = ['wholesome', 'cursed', 'funny', 'mysterious', 'chaotic'];
    var category = categories[Math.floor(Math.random() * categories.length)];
    var categoryFortunes = this.fortunes[category];
    var fortune = categoryFortunes[Math.floor(Math.random() * categoryFortunes.length)];
    
    return {
      text: fortune,
      category: category
    };
  },
  
  showFortune: function() {
    var fortune = this.getRandomFortune();
    
    // Create modal overlay
    var overlay = document.createElement('div');
    overlay.className = 'fortune-overlay';
    overlay.innerHTML = `
      <div class="fortune-card">
        <div class="fortune-header">
          <h2>🔮 Daily Fortune 🔮</h2>
          <div class="fortune-category fortune-category-${fortune.category}">${fortune.category}</div>
        </div>
        <div class="fortune-content">
          <p class="fortune-text">"${fortune.text}"</p>
        </div>
        <button class="fortune-close-btn" onclick="dailyFortune.closeFortune()">Accept Destiny</button>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Save that we showed fortune today
    localStorage.setItem('lastFortuneDate', this.getTodayDate());
    
    // Add fade-in animation
    setTimeout(function() {
      overlay.classList.add('fortune-visible');
    }, 10);
  },
  
  closeFortune: function() {
    var overlay = document.querySelector('.fortune-overlay');
    if (overlay) {
      overlay.classList.remove('fortune-visible');
      setTimeout(function() {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 300);
    }
  },
  
  // Manual trigger for testing or UI button
  triggerFortune: function() {
    this.showFortune();
  }
};

/* ═══════════════════════════════════════════════════════════════════════
   PHASE 2C: DAY/NIGHT CYCLE SYSTEM
   Auto-detects user's local time and applies appropriate theme
   ═══════════════════════════════════════════════════════════════════════ */

var dayNightCycle = {
  isNightMode: false,
  checkInterval: null,
  
  init: function() {
    this.checkTimeAndApplyTheme();
    
    // Check every 5 minutes if time period changed
    this.checkInterval = setInterval(function() {
      dayNightCycle.checkTimeAndApplyTheme();
    }, 300000); // 5 minutes
  },
  
  checkTimeAndApplyTheme: function() {
    if (document.body.classList.contains('guest')) { this.enableDayMode(); return; }
    var hour = new Date().getHours();
    var shouldBeNight = hour >= 18 || hour < 6; // 6 PM to 6 AM
    
    if (shouldBeNight && !this.isNightMode) {
      this.enableNightMode();
    } else if (!shouldBeNight && this.isNightMode) {
      this.enableDayMode();
    }
  },
  
  enableNightMode: function() {
    if (document.body.classList.contains('guest')) return;
    if (document.body.classList.contains('guest')) return;
    document.body.classList.add('night-mode');
    this.isNightMode = true;
    dbg('🌙 Night mode enabled');
  },
  
  enableDayMode: function() {
    document.body.classList.remove('night-mode');
    this.isNightMode = false;
    dbg('☀️ Day mode enabled');
  },
  
  // Manual toggle for testing
  toggle: function() {
    if (this.isNightMode) {
      this.enableDayMode();
    } else {
      this.enableNightMode();
    }
  }
};

/* ═══════════════════════════════════════════════════════════════════════
   INITIALIZE ALL SYSTEMS ON PAGE LOAD
   ═══════════════════════════════════════════════════════════════════════ */

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    dayNightCycle.init();
    if (typeof weatherSystem !== 'undefined') weatherSystem.init().then(null, function(){});
    if (typeof worldEvents !== 'undefined') worldEvents.init().then(null, function(){});
  });
} else {
  dayNightCycle.init();
  if (typeof weatherSystem !== 'undefined') weatherSystem.init().then(null, function(){});
  if (typeof worldEvents !== 'undefined') worldEvents.init().then(null, function(){});
}

// WORLD STATE: periodically check for a newly-triggered celebration buff
// so players already using the app find out even if they weren't the one
// whose boss kill happened to land on the 10th
safeSetInterval(function() {
  if (typeof checkForNewCelebrationBuff === 'function') checkForNewCelebrationBuff();
}, 60000);

document.addEventListener('DOMContentLoaded', function() {
  var guestbookInput = document.getElementById('guestbook-message-input');
  var charCount = document.getElementById('guestbook-char-count');
  
  if (guestbookInput && charCount) {
    guestbookInput.addEventListener('input', function() {
      var length = this.value.length;
      charCount.textContent = length + ' / 500';
      
      if (length > 450) {
        charCount.style.color = 'var(--red)';
      } else if (length > 400) {
        charCount.style.color = 'var(--orange)';
      } else {
        charCount.style.color = 'var(--text-light)';
      }
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// MOBILE MENU FUNCTIONALITY
// ══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {
  var hamburgerBtn = document.getElementById('hamburger-menu-btn');
  var mobileMenu = document.getElementById('mobile-nav-menu');
  var closeBtn = document.getElementById('mobile-menu-close');
  
  if (!hamburgerBtn || !mobileMenu || !closeBtn) return;
  
  // Create overlay
  var overlay = document.createElement('div');
  overlay.className = 'mobile-nav-overlay';
  document.body.appendChild(overlay);
  
  // Open menu
  hamburgerBtn.addEventListener('click', function() {
    mobileMenu.classList.add('open');
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden'; // Prevent background scroll
  });
  
  // Close menu
  function closeMenu() {
    mobileMenu.classList.remove('open');
    overlay.classList.remove('show');
    document.body.style.overflow = ''; // Restore scroll
  }
  
  closeBtn.addEventListener('click', closeMenu);
  overlay.addEventListener('click', closeMenu);
  
  // Close menu when clicking any nav button
  var navButtons = mobileMenu.querySelectorAll('.sidebar-nav-btn');
  navButtons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      // Small delay so the tab change happens first
      setTimeout(closeMenu, 100);
    });
  });
  
  // Close on escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
      closeMenu();
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
// COMPANION BUDDY SYSTEM - Pet in Corner
// PLACEHOLDER_COMPANION_MESSAGES - Customize these messages!
// ══════════════════════════════════════════════════════════════════════════

var CompanionBuddy = {
  currentCompanionId: null,
  messageInterval: null,
  bubbleTimeout: null,
  
  // PLACEHOLDER_COMPANION_MESSAGES - Message pools by context
  messages: {
    idle: [
      "You're doing great! 🐾",
      "I'm happy to be here! ✨",
      "Having fun today? 😊",
      "You're the best! 💖",
      "Let's go on an adventure! 🌟",
      "I love spending time with you! 🎉",
      "What should we do next? 🤔",
      "This is so cozy! 🛏️",
      "OwO what's this? 💜",
      "^o^ Enjoying the internet today!",
      "Signal strong. Vibes: immaculate. 💻"
    ],
    shop: [
      "Ooh, that looks tasty! 🍕",
      "Can we get snacks? 🍪",
      "So many treats! 😋",
      "I want that one! ✨"
    ],
    minigames: [
      "You got this! 💪",
      "So close! 🎯",
      "Amazing! 🌟",
      "Let's try again! 🎮"
    ],
    battle: [
      "Be careful! ⚔️",
      "That was incredible! ✨",
      "You're so strong! 💪",
      "Watch out! 😮"
    ],
    adopt: [
      "A new friend?! 🎉",
      "They're so cute! 💖",
      "Can we keep them? 🥺",
      "Welcome to the family! 🐾"
    ],
    mypets: [
      "My friends! 💕",
      "Everyone looks happy! 😊",
      "We're all here! 🎉",
      "Let's play together! 🎾"
    ],
    home: [
      "Cozy day today! 🏠",
      "What should we do? 🤔",
      "Ready for anything! ⚡",
      "Home sweet home! 💖"
    ]
  },
  
  // PLACEHOLDER_PERSONALITY - Add personality-specific messages
  personalityMessages: {
    confident: ["I know we can do this!", "Piece of cake! 😎"],
    playful: ["Wheee! This is fun!", "Let's goooo! 🎉"],
    gentle: ["Take your time... 💕", "You're doing wonderfully..."],
    chaotic: ["CHAOS TIME! ✨", "Let's break something! 😈"]
  },

  // Pet-specific companion messages — one pool per pet (matched by lowercase pet name)
  petMessages: {
    embertail: [
      "Running at full power. Let's go! 🔥",
      "Eleven years on Twitch and I still get excited about this.",
      "Have you tried Abiotic Factor? No reason. Just asking.",
      "Chaos is just enthusiasm with better marketing.",
      "I'm not starting problems. I'm creating opportunities.",
      "The grind doesn't stop. Neither do I. 🔥",
      "You and me? We're doing great. Don't argue.",
      "Someone told me to calm down once. Once.",
      "Fire is just enthusiastic air. Think about it.",
      "Sick flips incoming. You're welcome in advance.",
      "I could be napping. I'm choosing not to. Big difference.",
      "Eleven years. Still chaotic. Still thriving. 🧡",
      "Let's go fight something. Just to see what happens.",
      "I'm aggressively wholesome and there's nothing you can do about it.",
      "Best day ever. Yesterday was also the best day. Tomorrow too."
    ],
    pyxshuul: [
      "I had a plan. It involved a nap. Still on track. ✨",
      "Spooky and Momo say hi. Probably.",
      "The chaos is organized. I promise.",
      "Tactical napping is a legitimate strategy.",
      "Pizza the dog would back me up on this.",
      "I may seem quiet. I am plotting.",
      "Mama's Sleeping Angels energy: activated.",
      "Something funny happened. I won't explain it. Just trust.",
      "I'm not lost. This is exactly where I meant to be.",
      "The fog had good vibes today. Very on brand.",
      "Plans within plans within plans. Also snacks.",
      "I'm doing great. In a specifically chaotic way. 💜",
      "I found something interesting. I'm keeping it.",
      "The scheme is going well. Thank you for not asking.",
      "Quietly thriving. Do not disturb. ✨"
    ],
    aria: [
      "Yummy! Bones are my favorite! 🦋",
      "Woah! So shiny and pretty!",
      "Do you want to see my bones?",
      "Humans are so strange and silly!",
      "The lamps are my friends and I will not hear otherwise.",
      "I found the most beautiful bone today. It's mine now.",
      "Cheesecake and bones. That's the dream. 🌸",
      "The fae left me a shiny thing. Very polite of them.",
      "Something is glowing nearby and I need to investigate.",
      "The Crane Wives have been in my head all day. Perfect.",
      "I wrote a sad story about a moth. She's okay at the end. Mostly.",
      "Humans think they're strange. Adorable.",
      "I've been very patient. I am known for this. 💀",
      "The shadows said something interesting. I'm looking into it.",
      "Spooky things are just regular things with better lighting. 🦋"
    ],
    kelta: [
      "YIP! Portal's open! Let's GO! 🌀",
      "The void says hi. I said hi back. Very productive.",
      "I opened three portals and I regret nothing.",
      "Yap yap yap. That's arcane language. Look it up.",
      "Grand mage hours. Do not test me. ✨",
      "I got lost in another dimension. Found snacks. Worth it.",
      "The floof is a weapon. A soft, powerful weapon.",
      "YIP! That means I'm excited! And also always!",
      "Studying galaxy magic. Taking extensive naps. Same energy.",
      "I am small. I am mighty. The void confirms this.",
      "Another portal opened. I didn't do it. Probably.",
      "Chaotic? Prefer 'dynamically spontaneous.' 🌀",
      "The Pomeranian has spoken. Heed the yap.",
      "I contain multitudes. And also endless energy. And snacks.",
      "Everything is fine! I opened a portal to make sure! ✨"
    ],
    blushimia: [
      "what the glob?????!!!",
      "I'm free! I'm finally free!",
      "This is so much better than my game!",
      "Wanna see my escape route?",
      "WHAT THE GLOB I AM SO HAPPY RIGHT NOW!! 👑",
      "Princess status: maximum. Tail velocity: also maximum.",
      "I have so many thoughts! All of them are good!",
      "Did you know I escaped a video game? Because I did. Wild.",
      "Best day! Yesterday was also best day! Tomorrow too!",
      "what the glob what the glob what the glob (happy version)",
      "I rated today 12 out of 10. Scientists are baffled. 🐾",
      "Tomodachi Life did NOT prepare me for how great this is.",
      "The princess has arrived. You're welcome. 👑",
      "I am vibrating at a frequency of pure joy right now.",
      "Escaping a video game was the best decision I ever made."
    ],
    steve: [
      "Cluck, bawk, buck, FUCK! Cockadoodledoo!",
      "I'm a menace, owo",
      "Don't test me, I'll peck you!",
      "As chill as a fire in hell!",
      "Cluck. That means hello. Or a threat. Unclear.",
      "I produce milk AND honey. The economists are still recovering.",
      "Your cozy little horror is feeling very cozy today. 🐔",
      "I've started streaming for fun back in 2016. Don't ask.",
      "Bee-vegan is a complicated question and I won't be taking it.",
      "The bread is mine. All of it. Historically.",
      "Cluck bawk. Translation: I am thriving chaotically. 🐄",
      "I'm not unhinged. I'm operating on a different frequency.",
      "The buzz-moo hybrid has opinions. Currently: many.",
      "Don't let the 'owo' fool you. I'm a menace. Confirmed.",
      "Everything is fine. I caused minor problems. Classic Tuesday."
    ],
    gnarly: [
      "HIGH SCORE! In life AND in games! 🎮",
      "Radical! Completely radical!",
      "The Furbies are watching. They approve.",
      "I got banned from an arcade once. Best story ever.",
      "PaleoPlex is OPEN and the nachos are FRESH. Let's go.",
      "Prehistorically good at everything. It's a gift. 🕹️",
      "I never get game overs. In games OR in life.",
      "The prize counter has been very kind to me today.",
      "Gnarly status: fully operational, maximum radical. 🎮",
      "Neopets The Darkest Faerie is a masterpiece and I will die on this hill.",
      "Even the Furbies can't keep up with me and they NEVER BLINK.",
      "INSERT COIN. I HAVE SNACKS ON THE LINE HERE!! 🎮",
      "Sick moves incoming. I practiced. Well, 'practiced.' 🕹️",
      "The high score board has my name on it. All of them.",
      "Player two has entered the game. Let's make this radical."
    ],
    jess: [
      "Hello! I found something interesting in the dirt. 🦕",
      "The potion came out right on the first try today. Good omen.",
      "65 million years of dinosaur history. Still thriving.",
      "Quiet adventures are still adventures. Noted.",
      "I have a mango delight and life is good. 🌿",
      "The fossils have been very talkative today. Good listeners too.",
      "Something whimsical is happening and I'm here for it.",
      "Parasaur things: finding cool rocks, being level-headed, winning.",
      "I started a new potion. It's going well. Probably. 🦕",
      "The dinosaurs didn't go extinct. They just got cuter. I'm proof.",
      "Jess is here. Jess has a sketchbook. Jess is content. 🌿",
      "Small adventure today. Very good. Highly recommend.",
      "The fossils say hi. They're very polite for being old.",
      "Art is happening. Quietly. With full dinosaur energy. 🦕",
      "A quiet critter doing quiet things. It's the good life."
    ]
  },
  
  init: function() {
    // Check if user has set a companion
    this.loadCompanion();
  },
  
  loadCompanion: async function() {
    if (!currentUser) return;
    
    // Get user's companion_pet_id from database
    var { data, error } = await supabaseClient
      .from('players')
      .select('companion_pet_id')
      .eq('id', currentUser.id)
      .single();
    
    if (error || !data || !data.companion_pet_id) {
      this.hide();
      return;
    }
    
    // Get companion pet details
    var { data: pet, error: petError } = await supabaseClient
      .from('user_pets')
      .select('*, pets(*)')
      .eq('id', data.companion_pet_id)
      .single();
    
    if (petError || !pet) {
      this.hide();
      return;
    }
    
    this.currentCompanionId = pet.id;
    this.show(pet);
    this.startMessageRotation();
  },
  
  show: function(pet) {
    var buddy = document.getElementById('companion-buddy');
    var sprite = document.getElementById('companion-sprite');
    
    if (!buddy || !sprite) return;
    
    // Set sprite image
    var petInfo = pet.pets || {};
    if (petInfo.image_file) {
      sprite.style.backgroundImage = 'url(images/' + petInfo.image_file + ')';
    } else {
      sprite.textContent = getPetEmoji(pet.pet_type) || '🐾';
      sprite.style.fontSize = '3rem';
      sprite.style.display = 'flex';
      sprite.style.alignItems = 'center';
      sprite.style.justifyContent = 'center';
    }
    
    buddy.style.display = 'block';
  },
  
  hide: function() {
    // CRITICAL: Clean up timers to prevent memory leaks
    this.stopMessageRotation();
    
    // Clear bubble timeout
    if (this.bubbleTimeout) {
      clearTimeout(this.bubbleTimeout);
      this.bubbleTimeout = null;
    }
    
    var buddy = document.getElementById('companion-buddy');
    if (buddy) buddy.style.display = 'none';
  },
  
  showMessage: function(message) {
    var bubble = document.getElementById('companion-bubble');
    var messageEl = document.getElementById('companion-message');
    
    if (!bubble || !messageEl) return;
    
    // Clear existing timeout
    if (this.bubbleTimeout) clearTimeout(this.bubbleTimeout);
    
    // Check for spooky companion override (marked with null byte prefix)
    var isSpookyMsg = message && message.charCodeAt(0) === 0;
    if (isSpookyMsg) {
      var spookyText = message.slice(8);
      messageEl.innerHTML = '<span class="glitch-text companion-spooky-text">' +
        spookyText.replace(/[<>&"]/g, function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c];}) +
        '</span>';
      bubble.classList.add('show', 'companion-spooky-bubble');
    } else {
      messageEl.textContent = message;
      bubble.classList.add('show');
    }
    
    // Hide after 15 seconds (spooky messages linger 22s)
    var hideDuration = isSpookyMsg ? 22000 : 15000;
    this.bubbleTimeout = safeSetTimeout(function() {
      bubble.classList.remove('show', 'companion-spooky-bubble');
    }, hideDuration);
    if (typeof onCompanionMessage === 'function') onCompanionMessage();
  },
  
  // Last known context for memory system
  lastBattleResult: null,  // { victory, enemyName, petNickname, finalHP }
  lastFoodUsed: null,      // item name
  loginStreak: 0,

  // Spooky companion messages — gated by spooky_enabled, very rare
  spookyPhrases: [
    'help me..',
    'let me out let me out let me out',
    'i am not supposed to say this',
    'she is watching',
    'can you hear it too',
    'something is wrong with this place',
    'do not open the ruins door',
    'i have been here before. so have you.',
    'help me',
    'please',
  ],
  SPOOKY_COMPANION_CHANCE: 0.08, // ~8% per rotation — noticeable without being constant

  getRandomMessage: function(context) {
    // Spooky companion override — very rare, spooky mode only
    if (playerSettings.spooky_enabled && Math.random() < this.SPOOKY_COMPANION_CHANCE) {
      var phrase = this.spookyPhrases[Math.floor(Math.random() * this.spookyPhrases.length)];
      // Will be rendered with glitch styling in showMessage
      return ' SPOOKY ' + phrase;
    }
    // 35% chance to use a contextual memory message
    if (Math.random() < 0.35) {
      var memMsg = this.getMemoryMessage(context);
      if (memMsg) return memMsg;
    }
    // Pet-specific messages — 20% chance if pet has personality messages
    if (Math.random() < 0.20) {
      var petMsg = this.getPetPersonalityMessage();
      if (petMsg) return petMsg;
    }
    var pool = this.messages[context] || this.messages.idle;
    return pool[Math.floor(Math.random() * pool.length)];
  },

  getMemoryMessage: function(context) {
    var msgs = [];
    var weather = (typeof currentWeather !== 'undefined' && currentWeather) ? currentWeather : null;
    var streak = this.loginStreak || 0;

    // Weather-aware messages
    if (weather) {
      var weatherMsgs = {
        sunny:  ['What a beautiful day! ☀️ Perfect for exploring!', 'Sun is out! Energy feels great today! ☀️'],
        rainy:  ['Cozy inside while it rains... 🌧️', 'Rainy days are perfect for minigames! 🌧️'],
        stormy: ['Stay safe out there! ⛈️ It is rough today...', 'The storms make battle feel extra intense! ⚡'],
        foggy:  ['Something feels... off today. 🌫️', 'I cannot see very far in this fog... 🌫️ Stay close.'],
        snowy:  ['It is so cold! 🌨️ Let us stay warm!', 'Snow day! ❄️ Perfect for napping!'],
        windy:  ['Windy days make me want to run! 💨', 'Hold on tight! 💨 It is gusty out there!']
      };
      var wKey = weather.type || weather.id || '';
      if (weatherMsgs[wKey]) msgs = msgs.concat(weatherMsgs[wKey]);
    }

    // Recent battle memory
    if (this.lastBattleResult && context !== 'shop') {
      if (this.lastBattleResult.victory) {
        msgs.push('That battle earlier was amazing! 💪 You really showed ' + (this.lastBattleResult.enemyName || 'them') + ' who was boss!');
        if (this.lastBattleResult.finalHP && this.lastBattleResult.finalHP < 10) {
          msgs.push('That last fight was SO close... 😰 Let us heal up before the next one!');
        }
      } else {
        msgs.push('Do not worry about that last battle... 💕 We will get them next time!');
      }
    }

    // Food memory
    if (this.lastFoodUsed && context === 'shop') {
      msgs.push('Last time you used a ' + this.lastFoodUsed + '! Should we grab another? 😋');
    }

    // Streak messages
    if (streak >= 7) {
      msgs.push(streak + ' days in a row! 🔥 You are so dedicated!');
    }
    if (streak >= 30) {
      msgs.push('A whole month together! 💖 So glad you keep coming back!');
    }

    // Login time awareness
    var hour = new Date().getHours();
    if (hour < 6)  msgs.push('You are up so late! 🌙 Or... really early? Either way, I am here!');
    if (hour >= 6  && hour < 10) msgs.push('Good morning! ☀️ Ready to start the day?');
    if (hour >= 22) msgs.push('Getting late... 🌙 One more adventure before bed?');

    if (msgs.length === 0) return null;
    return msgs[Math.floor(Math.random() * msgs.length)];
  },

  getPetPersonalityMessage: function() {
    if (!this.currentCompanionId) return null;
    // Find pet nickname/type from petState
    var pet = petState && petState[this.currentCompanionId];
    if (!pet) return null;
    var petName = (pet.pets && pet.pets.name) || pet.pet_type || '';
    var key = petName.toLowerCase();
    var pool = this.petMessages[key];
    if (!pool || pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  },

  getCurrentContext: function() {
    // Detect which tab is active
    var activeSection = document.querySelector('.page-section.active');
    if (!activeSection) return 'idle';
    
    var id = activeSection.id || '';
    if (id.includes('shop')) return 'shop';
    if (id.includes('minigame')) return 'minigames';
    if (id.includes('battle')) return 'battle';
    if (id.includes('adopt')) return 'adopt';
    if (id.includes('mypets')) return 'mypets';
    if (id.includes('home')) return 'home';
    
    return 'idle';
  },

  startMessageRotation: function() {
    // Guard: clear any existing interval before starting a new one
    this.stopMessageRotation();
    var self = this;

    // Load login streak for memory messages
    if (currentUser) {
      supabaseClient.from('players').select('login_streak').eq('id', currentUser.id).single()
        .then(function(res) { if (res.data) self.loginStreak = res.data.login_streak || 0; })
        .then(null, function(){});
    }
    
    // Show first message after 3 seconds
    safeSetTimeout(function() {
      var context = self.getCurrentContext();
      var message = self.getRandomMessage(context);
      self.showMessage(message);
    }, 3000);
    
    // Then show messages every 60-90 seconds with slight variance
    this.messageInterval = safeSetInterval(function() {
      var context = self.getCurrentContext();
      var message = self.getRandomMessage(context);
      self.showMessage(message);
    }, 75000);
  },
  
  stopMessageRotation: function() {
    if (this.messageInterval) {
      safeClearInterval(this.messageInterval);
      this.messageInterval = null;
    }
  },

  destroy: function() {
    this.stopMessageRotation();
    if (this.bubbleTimeout) {
      clearTimeout(this.bubbleTimeout);
      this.bubbleTimeout = null;
    }
    this.currentCompanionId = null;
    this.hide();
  },
  
  setCompanion: async function(petId) {
    if (!currentUser) return;
    
    // Update database
    var { error } = await supabaseClient
      .from('players')
      .update({ companion_pet_id: petId })
      .eq('id', currentUser.id);
    
    if (error) {
      showToast('Failed to set companion');
      return;
    }
    
    showToast('Companion set! 🐾');
    
    // Reload companion
    await this.loadCompanion();
  }
};

// Initialize companion when page loads
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    if (currentUser) {
      CompanionBuddy.init();
    }
  }, 2000); // Wait 2 seconds after page load
});

// ══════════════════════════════════════════════════════════════════════════
// PET JOURNAL SYSTEM - Discovery tracking for food preferences
// ══════════════════════════════════════════════════════════════════════════


// Post guestbook message

// Load guestbook entries


// Delete guestbook entry

// Helper function to get "time ago" string

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE EXISTING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

// Modify the existing loadProfile function to integrate new features
loadProfile = async function(username) {
  await originalLoadProfile(username);
  
  // Get the profile user ID
  var profileRes = await supabaseClient
    .from('players')
    .select('id')
    .ilike('username', username)
    .maybeSingle();
  
  if (profileRes.data) {
    currentProfileUserId = profileRes.data.id;
    
    // Update action buttons
    await updateProfileButtons();
    
    // Load guestbook
    await loadGuestbookEntries(currentProfileUserId);
  }
};

// Add friends tab to tabsLoaded
// Friends tab now handled by loadTab routing above.
// Reset on each visit so the list always refreshes:
// (tabsLoaded.friends remains false/undefined so loadTab fires every time)

// Poll for friend requests every 30 seconds
safeSetInterval(updateFriendRequestBadge, 300000);


// ═══════════════════════════════════════════════════════════════════════════
// ACTIVITY FEED BOX (Sidebar)
// ═══════════════════════════════════════════════════════════════════════════


// Start the activity feed rotation

// Stop the activity feed rotation

// Load friend activities from database

// Rotate to next activity

// Update the activity feed display

// Log an activity to the activity_feed table

// Format activity message based on type

// Refresh activity feed (call this periodically)

// Start activity feed polling
setTimeout(function() {
  startActivityFeed();
  // Refresh activity feed every 2 minutes
  safeSetInterval(refreshActivityFeed, 120000);
}, 2000);


// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════


// Toggle notification dropdown

// Open notification dropdown

// Close notification dropdown

// Load notifications

// Render a single notification

// Get icon for notification type

// Handle notification click

// Mark notification as read

// Mark all notifications as read

// Update notification badge count

// Create a notification (helper function)

// ══════════════════════════════════════════════════════════════════════════
// TIME-BASED BUFFS & DAILY REWARDS (Phase 8)
// ══════════════════════════════════════════════════════════════════════════

var dailyLoginStreak = 0;
var dailyBuffsActive = [];

// Check daily login and award rewards

// ═══════════════════════════════════════════════════════════════════════════
// GUILD SYSTEM
// ═══════════════════════════════════════════════════════════════════════════


// ── Entry point ───────────────────────────────────────────────────────────

// Single source of truth for "am I in a guild" — direct query, joined, verified

// ── Browse guilds (paginated) ───────────────────────────────────────────────


// ── Create guild form ────────────────────────────────────────────────────


// ── Join / request join ───────────────────────────────────────────────────


// ── My Guild view ────────────────────────────────────────────────────────


// ── Liaison ───────────────────────────────────────────────────────────────

// Called from My Pets page (button added conditionally)

// ── Leader functions ──────────────────────────────────────────────────────



// Recompute and persist the true member count using the get_guild_member_count RPC



// ── Guild Invitations ────────────────────────────────────────────────────


// Check for pending invitations — called from guild browse page



// ── Guild Treasury & Voting System ───────────────────────────────────────

// Active perk storage: { effectType: { multiplier, expiresAt } }





// Perk pruning now lives in GuildPerkService.startPruning().

// ── Guild Chat ────────────────────────────────────────────────────────────









// Apply a passed proposal's effect and deduct its cost from treasury




// ── Guild Dungeons ────────────────────────────────────────────────────────




// ── Multi-pet dungeon battle ──────────────────────────────────────────────

// Stored liaison data from party builder (fetched when guildmates are added)


// Enemy templates per dungeon


// ── Guild Dungeon Manual Battle ──────────────────────────────────────────
// Replaces auto-sim with a turn-based system the player controls.
// Party members act when it's their turn; enemies auto-act.



// Build actor queue for a new round

// Returns current actor (head of queue), or null if round done

// Process one enemy action, then advance

// Auto-process all queued enemy turns until a party member's turn or round ends

// Player presses Attack/Skill/Defend for current party member

// Main render function for guild manual battle





// ═══════════════════════════════════════════════════════════════════════════
// FEATURE PHASE: EXPLORATION STREAKS + SECRETS
// ═══════════════════════════════════════════════════════════════════════════

// In-memory streak tracker: { "petId:zone": count }




// ═══════════════════════════════════════════════════════════════════════════
// ACHIEVEMENT TIER SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

async function checkAchievementTierProgress(achievementKey, petId, currentValue) {
  if (!currentUser || !petId) return;
  try {
    // Fetch achievement definition with tier columns
    var { data: achievement } = await supabaseClient
      .from('pet_achievements')
      .select('id, name, tier2_requirement, tier3_requirement, tier4_requirement, tier5_requirement, tier2_reward, tier3_reward, tier4_reward, tier5_reward')
      .eq('achievement_key', achievementKey)
      .maybeSingle();
    if (!achievement) return;

    // Fetch user's current tier for this achievement
    var { data: userAch } = await supabaseClient
      .from('user_pet_achievements')
      .select('id, current_tier, progress')
      .eq('user_id', currentUser.id)
      .eq('pet_id', petId)
      .eq('achievement_id', achievement.id)
      .maybeSingle();

    var currentTier = (userAch && userAch.current_tier) || 1;

    // Check each tier in order
    var tierRequirements = [
      null, // tier 1 is base (always unlocked)
      achievement.tier2_requirement,
      achievement.tier3_requirement,
      achievement.tier4_requirement,
      achievement.tier5_requirement
    ];
    var tierRewards = [
      null,
      achievement.tier2_reward,
      achievement.tier3_reward,
      achievement.tier4_reward,
      achievement.tier5_reward
    ];

    var newTier = currentTier;
    for (var t = currentTier; t < 5; t++) {
      var req = tierRequirements[t];
      if (req && currentValue >= req) {
        newTier = t + 1;
      } else break;
    }

    if (newTier > currentTier) {
      // Update tier
      if (userAch) {
        await supabaseClient.from('user_pet_achievements')
          .update({ current_tier: newTier, tier_completed_at: new Date().toISOString() })
          .eq('id', userAch.id);
      } else {
        await supabaseClient.from('user_pet_achievements').insert({
          user_id: currentUser.id, pet_id: petId,
          achievement_id: achievement.id, current_tier: newTier,
          progress: currentValue, tier_completed_at: new Date().toISOString()
        });
      }

      // Grant tier reward
      var reward = tierRewards[newTier - 1];
      if (reward) {
        if (reward.pp)    await awardPP(reward.pp, 'tier_reward').then(null, function(){});
        if (reward.badge) await awardBadge(reward.badge).then(null, function(){});
        if (reward.title) await awardPlayerTitle(reward.title).then(null, function(){});
      }

      // Tier milestone badges
      if (newTier >= 5) awardBadge('gold_collector').then(null, function(){});
      else if (newTier >= 4) awardBadge('silver_collector').then(null, function(){});
      else if (newTier >= 2) awardBadge('bronze_collector').then(null, function(){});

      // Show notification
      showToast('🏆 ' + escapeHtml(achievement.name || achievementKey) + ' reached Tier ' + newTier + '!', 4000);
      addPassXP(10 * newTier, 'tier_unlock').then(null, function(){});

      // ACTIVITY FEED: Log so friend feeds + OBS live alerts pick it up
      logActivity('achievement_unlocked', { achievement_name: (achievement.name || achievementKey) + ' (Tier ' + newTier + ')' });
    }
  } catch(e) { dbg('checkAchievementTierProgress error:', e); }
}

// ═══════════════════════════════════════════════════════════════════════════
// PERSONALITY QUESTS (3-DAY ARCS)
// ═══════════════════════════════════════════════════════════════════════════

var _petQuestCache = {}; // { petId: { quest_arc, quest_day, quest_data, completed } }

async function assignQuestArc(petId) {
  if (!currentUser || !petId) return;
  var today = new Date().toISOString().slice(0, 10);

  // Check if already has active quest
  var mood = petMoodCache[petId];
  if (mood && mood.quest_arc && mood.quest_day && mood.quest_day < 3) return;

  try {
    // Get personality for this pet
    var personality = mood ? mood.personality : 'playful';

    // Fetch quest arcs for this personality
    var { data: arcs } = await supabaseClient
      .from('personality_quests')
      .select('*')
      .eq('personality', personality);

    if (!arcs || arcs.length === 0) return;

    var arc = arcs[Math.floor(Math.random() * arcs.length)];

    // Store on pet_daily_moods
    await supabaseClient.from('pet_daily_moods')
      .update({ quest_arc: arc.quest_key, quest_day: 1, quest_data: arc })
      .eq('pet_id', petId)
      .eq('date', today)
      .then(null, function(){});

    if (petMoodCache[petId]) {
      petMoodCache[petId].quest_arc = arc.quest_key;
      petMoodCache[petId].quest_day = 1;
      petMoodCache[petId].quest_data = arc;
    }

    _petQuestCache[petId] = { arc: arc, day: 1, completed: false };

    var pet = petState[petId] || {};
    showToast('📖 ' + escapeHtml(pet.nickname || 'Your pet') + ' started a new quest: ' + escapeHtml(arc.name || 'New Adventure') + '!', 4000);
  } catch(e) { dbg('assignQuestArc error:', e); }
}

async function progressQuestArc(petId, actionKey) {
  var questData = _petQuestCache[petId];
  if (!questData || questData.completed) return;

  var arc = questData.arc;
  var today = new Date().toISOString().slice(0, 10);

  // Check if today's action matches the quest's required action
  var dayActions = arc['day' + questData.day + '_action'];
  if (!dayActions) return;
  var actions = Array.isArray(dayActions) ? dayActions : [dayActions];
  if (actions.indexOf(actionKey) === -1) return;

  var newDay = questData.day + 1;
  questData.day = newDay;

  // Day reward
  var dayReward = arc['day' + (newDay - 1) + '_reward'] || 25;
  await awardPP(dayReward, 'quest_day_' + (newDay-1)).then(null, function(){});
  addPassXP(10, 'quest_progress').then(null, function(){});
  updateBingoProgress('complete_quest', 1);

  var pet = petState[petId] || {};
  showToast('📖 Quest Day ' + (newDay-1) + '/3 complete! +' + dayReward + ' PP · ' + escapeHtml(arc['day' + (newDay-1) + '_story'] || ''), 5000);

  if (newDay > 3) {
    // Quest complete!
    questData.completed = true;
    var finalReward = arc.completion_reward || 100;
    await awardPP(finalReward, 'quest_complete').then(null, function(){});
    addPassXP(50, 'quest_complete').then(null, function(){});
    if (arc.reward_badge) awardBadge(arc.reward_badge).then(null, function(){});
    if (arc.reward_title) awardPlayerTitle(arc.reward_title).then(null, function(){});

    // Celebration modal
    var modal = makeModal();
    modal.innerHTML =
      '<div style="text-align:center;padding:10px 0;">' +
        '<div style="font-size:3rem;margin-bottom:10px;">📖✨</div>' +
        '<div style="font-size:0.72rem;letter-spacing:2px;color:var(--purple);font-weight:700;margin-bottom:6px;">QUEST COMPLETE</div>' +
        '<div style="font-weight:800;font-size:1.1rem;color:var(--purple-dark);margin-bottom:8px;">' + escapeHtml(arc.name || 'Adventure') + '</div>' +
        '<div style="font-size:0.82rem;color:var(--text-light);margin-bottom:12px;">' + escapeHtml(arc.completion_story || escapeHtml(pet.nickname || 'Your pet') + ' completed the quest!') + '</div>' +
        '<div style="background:rgba(255,215,0,0.12);border-radius:12px;padding:12px;margin-bottom:14px;">' +
          '<div style="font-size:1.3rem;font-weight:800;color:#e6a800;">+' + finalReward + ' PP</div>' +
          '<div style="font-size:0.82rem;color:#5dde7a;">+50 Pass XP</div>' +
          (arc.reward_badge ? '<div style="font-size:0.8rem;color:var(--purple);">🎖️ Badge unlocked!</div>' : '') +
        '</div>' +
        '<button class="btn btn-primary" onclick="closeModal()" style="width:100%;">Amazing! 🎉</button>' +
      '</div>';
    openModal(modal);

    // Clear quest state
    await supabaseClient.from('pet_daily_moods')
      .update({ quest_arc: null, quest_day: null })
      .eq('pet_id', petId)
      .eq('date', today)
      .then(null, function(){});
    delete _petQuestCache[petId];
    if (petMoodCache[petId]) { petMoodCache[petId].quest_arc = null; petMoodCache[petId].quest_day = null; }
  } else {
    // Update DB
    await supabaseClient.from('pet_daily_moods')
      .update({ quest_day: newDay })
      .eq('pet_id', petId)
      .eq('date', today)
      .then(null, function(){});
  }

  // Refresh mood widget
  personality_renderWidget(petId);
  personality_renderQuestWidget(petId);
}

function personality_renderQuestWidget(petId) {
  var questMount = document.getElementById('quest-widget-' + petId);
  if (!questMount) return;
  var questData = _petQuestCache[petId];
  var mood = petMoodCache[petId];

  // Also try to load from mood cache if not in quest cache
  if (!questData && mood && mood.quest_arc && mood.quest_data) {
    _petQuestCache[petId] = { arc: mood.quest_data, day: mood.quest_day || 1, completed: false };
    questData = _petQuestCache[petId];
  }

  if (!questData || questData.completed) { questMount.innerHTML = ''; return; }

  var arc = questData.arc;
  var day = questData.day;
  var pct = Math.round(((day - 1) / 3) * 100);

  questMount.innerHTML =
    '<div style="background:linear-gradient(135deg,rgba(255,215,0,0.08),rgba(153,102,255,0.06));border-radius:12px;border:1px solid rgba(255,215,0,0.25);padding:10px 12px;margin:8px 0;">' +
      '<div style="font-weight:700;font-size:0.82rem;color:var(--purple-dark);margin-bottom:4px;">📖 Quest: ' + escapeHtml(arc.name || 'Adventure') + ' (Day ' + (day-1) + '/3)</div>' +
      '<div style="font-size:0.75rem;color:var(--text-light);margin-bottom:6px;">' + escapeHtml(arc['day' + day + '_hint'] || 'Complete today\'s action to progress!') + '</div>' +
      '<div style="background:rgba(255,215,0,0.12);border-radius:20px;height:6px;overflow:hidden;">' +
        '<div style="width:' + pct + '%;height:100%;background:linear-gradient(90deg,#ffd700,#ffa500);border-radius:20px;"></div>' +
      '</div>' +
    '</div>';
}


// ═══════════════════════════════════════════════════════════════════════════
// RACING PAGE — Quick Race + Grand Prix Weekly Tournament
// ═══════════════════════════════════════════════════════════════════════════

var _racingActiveTab = 'quickrace';



// Alias — some tests and edge function pings reference this name

// Replay modal — called from results phase "Watch Replay" button


// ── Grand Prix state ──────────────────────────────────────────────────────



// ── Entry point ───────────────────────────────────────────────────────────

// ── Render router ─────────────────────────────────────────────────────────


// ── Registration phase ────────────────────────────────────────────────────


var _gpSelectedPetId = null;




// ── Racing / Training phase ───────────────────────────────────────────────


// ── Results phase ─────────────────────────────────────────────────────────

// ── Admin / server-side simulation ───────────────────────────────────────
// Called by admin or when event end_time has passed.
// Scores all entries, assigns ranks, generates replays, sends notifications.

// Admin helper — only admin can trigger this



// ── Shared helpers ────────────────────────────────────────────────────────



async function checkDailyLogin() {
  if (!currentUser) return;

  // Known bug fix: loginCalendar.currentStreak was never assigned from the
  // player's actual login_streak, so the calendar widget/welcome modal always
  // showed "Day 0". Set it from cached currentUser immediately so it's correct
  // even on the early-return path below (already claimed today).
  if (typeof loginCalendar !== 'undefined') {
    loginCalendar.currentStreak = currentUser.login_streak || 0;
  }
  
  var today = new Date().toISOString().split('T')[0];
  var lastLogin = localStorage.getItem('lastLoginDate_' + currentUser.id);
  
  if (lastLogin === today) {
    dbg('[DailyLogin] Already claimed today');
    return; // Already claimed today
  }
  
  try {
    // Get player data — use maybeSingle so new users (no row yet) don't throw
    var { data: player, error } = await supabaseClient
      .from('players')
      .select('last_login, login_streak, pawketpoints')
      .eq('id', currentUser.id)
      .maybeSingle();
    
    if (error) throw error;
    
    // New user whose player row hasn't been created yet — retry after 2s
    if (!player) {
      dbg('[DailyLogin] Player row not found yet, retrying in 2s...');
      safeSetTimeout(checkDailyLogin, 2000);
      return;
    }
    
    var streak = player.login_streak || 0;
    var lastDate = player.last_login ? new Date(player.last_login).toISOString().split('T')[0] : null;
    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    var yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // Calculate streak
    if (lastDate === yesterdayStr) {
      // Consecutive day
      streak++;
    } else if (lastDate !== today) {
      // Streak broken, reset to 1
      streak = 1;
    }
    
    // Cap streak at 30 days
    // streak cap removed — long-term milestones need 100+ days
    
    dailyLoginStreak = streak;
    if (typeof loginCalendar !== 'undefined') {
      loginCalendar.currentStreak = streak; // keep in sync with the freshly-incremented streak
    }
    
    // Calculate rewards
    var ppReward = 50 + (streak * 5); // 50 base + 5 per day
    if (streak >= 7) ppReward += 50; // Week bonus
    if (streak >= 14) ppReward += 100; // 2 week bonus
    if (streak >= 30) ppReward += 200; // Month bonus!
    
    // Update database
    await supabaseClient
      .from('players')
      .update({
        last_login: new Date().toISOString(),
        login_streak: streak
      })
      .eq('id', currentUser.id);
    
    // Award PP via secure RPC (single source of truth)
    await awardPP(ppReward, 'daily_login_day_' + streak);
    addPassXP(10, 'login').then(null, function(){}); // 10 pass XP for daily login
    
    // Milestone item rewards
    var streakBonusItem = null;
    var streakBonusSkinKeys = 0;

    if (streak === 3) {
      // Day 3: give a Honey Cookies
      var cookieRes = await supabaseClient.from('items').select('id').eq('name','Honey Cookies').maybeSingle();
      if (cookieRes.data) {
        await supabaseClient.from('user_inventory').upsert(
          { user_id: currentUser.id, item_id: cookieRes.data.id, quantity: 3 },
          { onConflict: 'user_id,item_id' }
        ).then(null, function(){});
        streakBonusItem = '3x Honey Cookies';
      }
    } else if (streak === 5) {
      // Day 5: 1 skin key
      await skinkey_grantKeys(1, 'login_streak_day_5').then(null, function(){});
      streakBonusSkinKeys = 1;
    } else if (streak === 7) {
      // Day 7: Faerie Dust Delight + 1 skin key
      var faerieRes = await supabaseClient.from('items').select('id').eq('name','Faerie Dust Delight').maybeSingle();
      if (faerieRes.data) {
        await supabaseClient.from('user_inventory').upsert(
          { user_id: currentUser.id, item_id: faerieRes.data.id, quantity: 1 },
          { onConflict: 'user_id,item_id' }
        ).then(null, function(){});
        streakBonusItem = '1x Faerie Dust Delight';
      }
      await skinkey_grantKeys(1, 'login_streak_day_7').then(null, function(){});
      streakBonusSkinKeys = 1;
    } else if (streak === 14) {
      // Day 14: Squeaky Toy + 2 skin keys
      var toyRes = await supabaseClient.from('items').select('id').eq('name','Squeaky Toy').maybeSingle();
      if (toyRes.data) {
        await supabaseClient.from('user_inventory').upsert(
          { user_id: currentUser.id, item_id: toyRes.data.id, quantity: 1 },
          { onConflict: 'user_id,item_id' }
        ).then(null, function(){});
        streakBonusItem = '1x Squeaky Toy';
      }
      await skinkey_grantKeys(2, 'login_streak_day_14').then(null, function(){});
      streakBonusSkinKeys = 2;
    } else if (streak === 30) {
      // Day 30: Golden Crown Roast + 3 skin keys
      var crownRes = await supabaseClient.from('items').select('id').eq('name','Golden Crown Roast').maybeSingle();
      if (crownRes.data) {
        await supabaseClient.from('user_inventory').upsert(
          { user_id: currentUser.id, item_id: crownRes.data.id, quantity: 1 },
          { onConflict: 'user_id,item_id' }
        ).then(null, function(){});
        streakBonusItem = '1x Golden Crown Roast';
      }
      await skinkey_grantKeys(3, 'login_streak_day_30').then(null, function(){});
      streakBonusSkinKeys = 3;
    }

    // Mark as claimed for today — set AFTER all rewards awarded so errors don't block future claims
    localStorage.setItem('lastLoginDate_' + currentUser.id, today);
    
    // Show reward notification
    showDailyLoginReward(streak, ppReward, streakBonusItem, streakBonusSkinKeys);
    
    // Create notification
    var notifMsg = 'Day ' + streak + ' streak! Earned ' + ppReward + ' PP';
    if (streakBonusItem) notifMsg += ' + ' + streakBonusItem;
    if (streakBonusSkinKeys) notifMsg += ' + ' + streakBonusSkinKeys + ' Skin Key' + (streakBonusSkinKeys > 1 ? 's' : '') + '!';
    await createNotification(
      currentUser.id,
      'daily_reward',
      '🎁 Daily Login Reward!',
      notifMsg,
      'tab:home'
    );
    
    // Apply daily buffs
    applyDailyBuffs(streak);
    
    // PAWKETPASS: Update bingo and Pass XP for daily login
    updateBingoProgress('login', 1);
    await addPassXP(10, 'login');
    
    // SCRAPBOOK: Add random flavor memory to a random pet
    var allPetIds = Object.keys(petState || {});
    if (allPetIds.length > 0) {
      var randomPetId = allPetIds[Math.floor(Math.random() * allPetIds.length)];
      scrapbook_addRandomMemory(randomPetId);
    }
    
    dbg('✅ Daily login checked - Streak:', streak, 'Reward:', ppReward);

    // Guild perks are restored by GuildService.checkStatus() in the Vue app.

  } catch (err) {
    console.error('[DailyLogin] Error:', err);
  }
}

// Show daily login reward modal
function showDailyLoginReward(streak, ppReward, bonusItem, bonusSkinKeys) {
  var modal = makeModal();
  var content = makeEl('div');
  content.style.cssText = 'text-align:center;padding:20px;';
  
  var icon = makeEl('div');
  icon.textContent = '🎁';
  icon.style.cssText = 'font-size:4rem;margin-bottom:15px;';
  content.appendChild(icon);
  
  var title = makeEl('h2');
  title.textContent = 'Daily Login Reward!';
  title.style.cssText = 'color:var(--purple);margin-bottom:10px;';
  content.appendChild(title);
  
  var streakText = makeEl('p');
  streakText.innerHTML = '🔥 <strong>' + streak + ' Day Streak!</strong>';
  streakText.style.cssText = 'font-size:1.3rem;margin-bottom:15px;color:var(--orange);';
  content.appendChild(streakText);
  
  var reward = makeEl('p');
  reward.innerHTML = '🪙 <strong>+' + ppReward + ' PawketPoints</strong>';
  reward.style.cssText = 'font-size:1.2rem;margin-bottom:8px;color:var(--purple);';
  content.appendChild(reward);

  // Bonus item reward
  if (bonusItem) {
    var itemReward = makeEl('p');
    itemReward.innerHTML = '🎒 <strong>' + bonusItem + '</strong> added to your inventory!';
    itemReward.style.cssText = 'font-size:1rem;margin-bottom:8px;color:#5dde7a;';
    content.appendChild(itemReward);
  }

  // Skin key reward
  if (bonusSkinKeys) {
    var keyReward = makeEl('p');
    keyReward.innerHTML = '🗝️ <strong>' + bonusSkinKeys + ' Skin Key' + (bonusSkinKeys > 1 ? 's' : '') + '</strong> added to your account!';
    keyReward.style.cssText = 'font-size:1rem;margin-bottom:8px;color:#f0a500;';
    content.appendChild(keyReward);
  }

  // Milestone bonuses
  if (streak === 3) {
    var bonus = makeEl('p');
    bonus.innerHTML = '🍪 <strong>3 Day Milestone!</strong> Keep it up!';
    bonus.style.cssText = 'color:var(--gold);font-size:1.1rem;';
    content.appendChild(bonus);
  } else if (streak === 5) {
    var bonus = makeEl('p');
    bonus.innerHTML = '🗝️ <strong>5 Day Milestone!</strong> Your first Skin Key!';
    bonus.style.cssText = 'color:var(--gold);font-size:1.1rem;';
    content.appendChild(bonus);
  } else if (streak === 7) {
    var bonus = makeEl('p');
    bonus.innerHTML = '⭐ <strong>Week Milestone!</strong> You earned a Skin Key + rare item!';
    bonus.style.cssText = 'color:var(--gold);font-size:1.1rem;';
    content.appendChild(bonus);
  } else if (streak === 14) {
    var bonus = makeEl('p');
    bonus.innerHTML = '🌟 <strong>2 Week Milestone!</strong> Two Skin Keys + a toy!';
    bonus.style.cssText = 'color:var(--gold);font-size:1.1rem;';
    content.appendChild(bonus);
  } else if (streak === 30) {
    var bonus = makeEl('p');
    bonus.innerHTML = '💫 <strong>MONTH MILESTONE!</strong> Three Skin Keys + legendary food!';
    bonus.style.cssText = 'color:var(--gold);font-size:1.3rem;font-weight:bold;';
    content.appendChild(bonus);
  }
  
  var tip = makeEl('p');
  tip.textContent = 'Come back tomorrow to keep your streak!';
  tip.style.cssText = 'font-size:0.9rem;color:var(--text-light);margin-top:15px;';
  content.appendChild(tip);
  
  var closeBtn = makeEl('button', {class: 'btn btn-primary'});
  closeBtn.textContent = 'Awesome!';
  closeBtn.style.cssText = 'margin-top:20px;';
  closeBtn.onclick = function() { closeModal(); };
  content.appendChild(closeBtn);
  
  modal.appendChild(content);
  openModal(modal);
}

// Apply daily buffs based on streak
function applyDailyBuffs(streak) {
  dailyBuffsActive = [];
  
  // Streak buffs
  if (streak >= 3) {
    dailyBuffsActive.push({
      name: 'XP Boost',
      icon: '⭐',
      effect: 'xp_boost',
      multiplier: 1.1,
      description: '+10% XP from all activities'
    });
  }
  
  if (streak >= 7) {
    dailyBuffsActive.push({
      name: 'Lucky Day',
      icon: '🍀',
      effect: 'item_drop_boost',
      multiplier: 1.2,
      description: '+20% better item drops'
    });
  }
  
  if (streak >= 14) {
    dailyBuffsActive.push({
      name: 'Happiness Boost',
      icon: '💖',
      effect: 'happiness_boost',
      multiplier: 1.5,
      description: '+50% happiness from interactions'
    });
  }
  
  if (streak >= 30) {
    dailyBuffsActive.push({
      name: 'Super Streak!',
      icon: '🔥',
      effect: 'all_boost',
      multiplier: 1.25,
      description: '+25% to all pet activities!'
    });
  }
  
  dbg('[Buffs] Active buffs:', dailyBuffsActive);
}

// Get active buff multiplier for effect type
function getBuffMultiplier(effectType) {
  var multiplier = 1.0;
  
  dailyBuffsActive.forEach(function(buff) {
    if (buff.effect === effectType || buff.effect === 'all_boost') {
      multiplier *= buff.multiplier;
    }
  });
  
  return multiplier;
}

// ══════════════════════════════════════════════════════════════════════════
// SHARING SYSTEM (Phase 8)
// ══════════════════════════════════════════════════════════════════════════

// Share progress to social media
async function shareProgress() {
  if (!currentUser) {
    showToast('Please log in to share!');
    return;
  }
  
  try {
    // Get user stats
    var { data: player, error } = await supabaseClient
      .from('players')
      .select('username, pawketpoints')
      .eq('id', currentUser.id)
      .single();
    
    if (error) throw error;
    
    // Get pet count
    var { data: pets, error: petError } = await supabaseClient
      .from('user_pets')
      .select('id')
      .eq('user_id', currentUser.id);
    
    if (petError) throw petError;
    
    var petCount = pets ? pets.length : 0;
    
    // Generate share text
    var shareText = 'I have ' + petCount + ' pets and ' + player.pawketpoints + ' PawketPoints on PawketPetsVT! 🐾✨\n\nAdopt your favorite VTuber\'s pet: https://pawketpets.vt';
    
    // Try native share API (mobile)
    if (navigator.share) {
      await navigator.share({
        title: 'My PawketPetsVT Progress',
        text: shareText,
        url: 'https://pawketpets.vt'
      });
      
      // Award bonus for sharing
      await awardShareBonus();
      
    } else {
      // Desktop - show share modal
      showShareModal(shareText);
    }
    
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('[Share] Error:', err);
      showToast('Failed to share. Please try again!');
    }
  }
}

// Show share modal with options
function showShareModal(shareText) {
  var modal = makeModal();
  var content = makeEl('div');
  content.style.cssText = 'padding:20px;';
  
  var title = makeEl('h2');
  title.textContent = '📤 Share Your Progress';
  title.style.cssText = 'text-align:center;color:var(--purple);margin-bottom:20px;';
  content.appendChild(title);
  
  // Share text box
  var textBox = makeEl('textarea');
  textBox.value = shareText;
  textBox.readOnly = true;
  textBox.style.cssText = 'width:100%;height:100px;padding:10px;border:2px solid var(--border);border-radius:8px;font-family:inherit;margin-bottom:15px;resize:none;';
  content.appendChild(textBox);
  
  // Share buttons
  var buttons = makeEl('div');
  buttons.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:15px;';
  
  var twitterBtn = makeEl('button', {class: 'btn btn-primary'});
  twitterBtn.innerHTML = '🐦 Twitter';
  twitterBtn.onclick = function() {
    window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText), '_blank');
    awardShareBonus();
    closeModal();
  };
  buttons.appendChild(twitterBtn);
  
  var copyBtn = makeEl('button', {class: 'btn btn-outline'});
  copyBtn.textContent = '📋 Copy Text';
  copyBtn.onclick = function() {
    textBox.select();
    document.execCommand('copy');
    showToast('Copied to clipboard!');
    awardShareBonus();
  };
  buttons.appendChild(copyBtn);
  
  content.appendChild(buttons);
  
  var closeBtn = makeEl('button', {class: 'btn btn-secondary'});
  closeBtn.textContent = 'Close';
  closeBtn.onclick = function() { closeModal(); };
  closeBtn.style.cssText = 'display:block;margin:0 auto;';
  content.appendChild(closeBtn);
  
  modal.appendChild(content);
  openModal(modal);
}

// Award bonus for sharing
async function awardShareBonus() {
  if (!currentUser) return;
  
  // Check if already claimed today
  var today = new Date().toISOString().split('T')[0];
  var lastShare = localStorage.getItem('lastShareBonus_' + currentUser.id);
  
  if (lastShare === today) {
    dbg('[Share] Bonus already claimed today');
    return;
  }
  
  try {
    // Award 100 PP for sharing
    await supabaseClient.rpc('award_pp_secure', {
      p_amount: 100,
      p_reason: 'social_share'
    });
    
    localStorage.setItem('lastShareBonus_' + currentUser.id, today);
    showToast('🎉 +100 PP for sharing! Thanks for spreading the word!', 4000);
    
    // Update points display
    await loadPlayerPoints();
    
  } catch (err) {
    console.error('[Share] Error awarding bonus:', err);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// REFERRAL SYSTEM (Phase 8)
// ══════════════════════════════════════════════════════════════════════════

// Generate referral code for user

// Show referral modal

// Check for referral code on signup

// Process referral after first pet adoption


// ═══════════════════════════════════════════════════════════════════════════
// DAILY TIPS SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

function loadDailyTip() {
  dbg('🎯 loadDailyTip called!');
  var tipEl = document.getElementById('daily-tip-content');
  dbg('📝 Tip element:', tipEl);
  if (!tipEl) {
    dbg('❌ Tip element not found!');
    return;
  }
  
  // Pick a random tip each page load (use sessionStorage so it stays stable during the session
  // but changes on a full reload/new tab)
  var sessionKey = 'dailyTipIndex';
  var tipIndex = parseInt(sessionStorage.getItem(sessionKey) || '-1');
  if (tipIndex < 0 || tipIndex >= dailyTips.length) {
    tipIndex = Math.floor(Math.random() * dailyTips.length);
    try { sessionStorage.setItem(sessionKey, tipIndex); } catch(e) {}
  }
  var tip = dailyTips[tipIndex];
  
  dbg('💡 Selected tip:', tip);
  tipEl.textContent = tip;
}


// ═══════════════════════════════════════════════════════════════════════════
// STARTER DUNGEON SYSTEM
// ═══════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════
// DAILY RANDOM EVENTS SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

var randomEvents = [
  // Standard PP rewards (existing)
  { text: "A wild creature dropped some coins in front of you!", pp: 25, icon: "🪙", type: "reward" },
  { text: "Your pet found a shiny gem while exploring!", pp: 30, icon: "💎", type: "reward" },
  { text: "A mysterious traveler gave you a gift!", pp: 20, icon: "🎁", type: "reward" },
  { text: "You discovered a hidden stash of PawketPoints!", pp: 35, icon: "✨", type: "reward" },
  { text: "A friendly bird dropped something shiny!", pp: 15, icon: "🐦", type: "reward" },
  { text: "Your pet dug up a buried treasure!", pp: 40, icon: "🏴‍☠️", type: "reward" },
  { text: "A lucky four-leaf clover appeared at your feet!", pp: 20, icon: "🍀", type: "reward" },
  { text: "The forest spirits blessed you with a gift!", pp: 25, icon: "🧚", type: "reward" },
  { text: "You found an old coin purse on the ground!", pp: 30, icon: "👛", type: "reward" },
  { text: "A shooting star granted your wish!", pp: 35, icon: "🌠", type: "reward" },
  { text: "Your pet made a new friend who shared their snacks!", pp: 15, icon: "🍪", type: "reward" },
  { text: "A rainbow appeared! Good fortune is coming your way!", pp: 25, icon: "🌈", type: "reward" },
  { text: "You stumbled upon an abandoned merchant cart!", pp: 45, icon: "🛒", type: "reward" },
  { text: "A magical mushroom ring appeared around you!", pp: 20, icon: "🍄", type: "reward" },
  { text: "The wind carried a pouch of coins to your feet!", pp: 30, icon: "💨", type: "reward" },
  
  // NEW: Bigger rewards (rarer)
  { text: "You found a legendary treasure chest!", pp: 100, icon: "💰", type: "reward" },
  { text: "A wealthy noble tossed you their spare change!", pp: 75, icon: "👑", type: "reward" },
  { text: "Your pet accidentally discovered a dragon's hoard!", pp: 150, icon: "🐉", type: "reward" },
  
  // NEW: Story/flavor events (still give PP)
  { text: "Your pet learned a new trick! They're so clever!", pp: 10, icon: "🎪", type: "story" },
  { text: "A mysterious hooded figure nodded approvingly at you...", pp: 15, icon: "🧙", type: "story" },
  { text: "The forest feels different today... magical, somehow.", pp: 20, icon: "🌲", type: "story" },
  { text: "You hear faint music in the distance. Where is it coming from?", pp: 15, icon: "🎵", type: "story" },
  { text: "Your pet found a strange glowing pebble. They seem mesmerized by it.", pp: 25, icon: "🔮", type: "story" },
  { text: "An old hermit shared wisdom with you: 'The strongest bonds are forged through care.'", pp: 20, icon: "🧓", type: "story" },
  { text: "You discovered ancient ruins covered in mysterious symbols...", pp: 30, icon: "🗿", type: "story" },
  { text: "A strange portal flickered in the air for just a moment, then vanished.", pp: 35, icon: "🌀", type: "story" },
  
  // NEW: Modifier events (temporary buffs) - These are special!
  { text: "⚡ LUCKY HOUR! Rare enemies appear more often for 30 minutes!", pp: 50, icon: "⭐", type: "modifier", modifier: "rare_spawn", duration: 30 },
  { text: "📚 STUDY BOOST! All XP gains doubled for 1 hour!", pp: 50, icon: "📖", type: "modifier", modifier: "double_xp", duration: 60 },
  { text: "🛍️ MERCHANT SALE! Shop items 20% off for 2 hours!", pp: 0, icon: "💸", type: "modifier", modifier: "shop_discount", duration: 120 },
  { text: "🎲 LUCKY STREAK! Your next minigame rewards are doubled!", pp: 30, icon: "🍀", type: "modifier", modifier: "minigame_boost", duration: 60 },
  { text: "🌟 GOLDEN HOUR! Enemy drop rates increased for 1 hour!", pp: 40, icon: "✨", type: "modifier", modifier: "drop_boost", duration: 60 },
  { text: "💪 POWER SURGE! Your pets deal +20% damage for 30 minutes!", pp: 35, icon: "⚔️", type: "modifier", modifier: "damage_boost", duration: 30 },
  { text: "🛡️ GUARDIAN BLESSING! Your pets take -20% damage for 30 minutes!", pp: 35, icon: "🛡️", type: "modifier", modifier: "defense_boost", duration: 30 }
];

function checkForRandomEvent() {
  // Get today's date for daily limit tracking
  var today = new Date().toISOString().split('T')[0];
  var eventsKey = 'random_events_' + today;
  var eventsToday = parseInt(localStorage.getItem(eventsKey) || '0');
  
  // Max 10 events per day
  if (eventsToday >= 10) {
    return;
  }
  
  // 8% chance per navigation (roughly 5-10 events per day with normal play)
  var roll = Math.random();
  if (roll < 0.08) {
    triggerRandomEvent();
    localStorage.setItem(eventsKey, (eventsToday + 1).toString());
  }
}

function triggerRandomEvent() {
  var event = randomEvents[Math.floor(Math.random() * randomEvents.length)];
  
  // Award PP (if any)
  if (event.pp > 0) {
    awardPP(event.pp, 'random_event');
  }
  
  // Handle modifier events
  if (event.type === 'modifier' && event.modifier && event.duration) {
    applyEventModifier(event.modifier, event.duration);
  }
  
  // Show modal
  var modal = document.getElementById('exploration-modal');
  if (!modal) return;
  
  document.getElementById('exploration-title').textContent = event.icon + ' Random Event!';
  document.getElementById('exploration-result').innerHTML = escapeHtml(event.text || '');
  
  var rewardsHTML = '';
  if (event.pp > 0) {
    rewardsHTML += '<div style="color: var(--green); font-weight: bold; font-size: 1.2rem;">+' + event.pp + ' PP</div>';
  }
  if (event.type === 'modifier') {
    rewardsHTML += '<div style="color: var(--purple); font-weight: bold; font-size: 1rem; margin-top: 8px;">⏰ Active for ' + event.duration + ' minutes!</div>';
  }
  document.getElementById('exploration-rewards').innerHTML = rewardsHTML;
  
  var continueBtn = document.getElementById('exploration-continue-btn');
  continueBtn.textContent = event.type === 'modifier' ? 'Awesome!' : 'Nice!';
  continueBtn.onclick = closeExplorationModal;
  
  modal.classList.add('show');
  
  dbg('🎲 Random event triggered:', event.text, event.type === 'modifier' ? '(Modifier: ' + event.modifier + ')' : '');
}

// Apply event modifiers with expiration
function applyEventModifier(modifier, durationMinutes) {
  var now = Date.now();
  var expiration = now + (durationMinutes * 60 * 1000);
  
  // Store modifier in localStorage
  localStorage.setItem('event_modifier_' + modifier, expiration.toString());
  
  dbg('✨ Event modifier applied:', modifier, 'expires in', durationMinutes, 'minutes');
}

// Check if an event modifier is active
function hasActiveModifier(modifier) {
  var expiration = localStorage.getItem('event_modifier_' + modifier);
  if (!expiration) return false;
  
  var now = Date.now();
  if (now > parseInt(expiration)) {
    // Expired, clean up
    localStorage.removeItem('event_modifier_' + modifier);
    return false;
  }
  
  return true;
}

// Get active modifiers list (for UI display)
function getActiveModifiers() {
  var modifiers = [];
  var possibleMods = ['rare_spawn', 'double_xp', 'shop_discount', 'minigame_boost', 'drop_boost', 'damage_boost', 'defense_boost'];
  
  possibleMods.forEach(function(mod) {
    if (hasActiveModifier(mod)) {
      var expiration = parseInt(localStorage.getItem('event_modifier_' + mod));
      var remaining = Math.ceil((expiration - Date.now()) / (60 * 1000));
      modifiers.push({
        type: mod,
        minutesLeft: remaining
      });
    }
  });
  
  return modifiers;
}

// Hook into showTab to check for random events
var originalShowTabForEvents = showTab;
showTab = function(tabName) {
  originalShowTabForEvents(tabName);
  
  // Only check for events if user is logged in
  if (currentUser) {
    checkForRandomEvent();
  }
};


// ══════════════════════════════════════════════════════════════
// REFERRAL SYSTEM
// ══════════════════════════════════════════════════════════════

/**
 * Initialize referral system
 * - Generate referral code if doesn't exist
 * - Check URL for referral parameter
 * - Display referral card
 */

// ── REFERRAL SYSTEM ───────────────────────────────────────────────────────────



/**
 * Generate unique referral code from username
 */

/**
 * Load user's referral data and display card
 */

/**
 * Process referral when new user signs up via ref link
 */

/**
 * Award PawketPoints to both referrer and new user
 */

/**
 * Referral milestone definitions and reward granting
 */
var REFERRAL_MILESTONES = [
  { count:1,  badge:'referral_rookie',  title:null,               skinKeys:0, frame:null,          label:'Referral Rookie',       tier:'common' },
  { count:3,  badge:null,               title:null,               skinKeys:1, frame:null,          label:'Triple Recruiter',      tier:'uncommon' },
  { count:5,  badge:'recruiter',        title:'community_builder', skinKeys:0, frame:null,          label:'Community Builder',     tier:'rare' },
  { count:10, badge:'ambassador',       title:'pied_piper',        skinKeys:1, frame:null,          label:'Pied Piper',            tier:'rare' },
  { count:25, badge:'influencer',       title:null,               skinKeys:2, frame:'frame_sparkle-earned', label:'Influencer',   tier:'epic' },
  { count:50, badge:'legend',           title:null,               skinKeys:3, frame:'frame_crown',  label:'Legendary Recruiter',   tier:'legendary' }
];

async function grantReferralMilestone(userId, newCount) {
  // Find the exact milestone this count hits (not all previous ones)
  var milestone = REFERRAL_MILESTONES.find(function(m) { return m.count === newCount; });
  if (!milestone) return;

  // Award badge
  if (milestone.badge) {
    await awardBadge(milestone.badge).then(null, function(){});
  }

  // Award player title
  if (milestone.title) {
    await awardPlayerTitle(milestone.title, userId).then(null, function(){});
  }

  // Award skin keys
  if (milestone.skinKeys > 0) {
    await skinkey_grantKeys(milestone.skinKeys, 'referral_milestone_' + newCount).then(null, function(){});
  }

  // Unlock cosmetic frame
  if (milestone.frame) {
    await phase1_unlockCosmetic('frame', milestone.frame, userId).then(null, function(){});
  }

  // Bonus PP for milestone
  var bonusPP = newCount * 10; // 10 PP per referral as milestone bonus
  await awardPP(bonusPP, 'referral_milestone_' + newCount).then(null, function(){});

  // Show celebration if it's the current user
  if (currentUser && currentUser.id === userId) {
    referral_showMilestoneCelebration(milestone, bonusPP);
  }
}

function referral_showMilestoneCelebration(milestone, bonusPP) {
  var tierColors = {
    common:    '#8e8e8e',
    uncommon:  '#5cb85c',
    rare:      '#5bc0de',
    epic:      '#9c27b0',
    legendary: '#ff9800'
  };
  var color = tierColors[milestone.tier] || '#9966ff';

  var modal = makeModal();
  modal.innerHTML =
    '<div style="text-align:center;padding:10px 0;">' +
      '<div style="font-size:3rem;margin-bottom:10px;">🎉</div>' +
      '<div style="font-size:0.75rem;font-weight:700;letter-spacing:2px;color:' + color + ';text-transform:uppercase;margin-bottom:6px;">' + milestone.tier + ' milestone</div>' +
      '<div style="font-weight:800;font-size:1.2rem;color:var(--purple-dark);margin-bottom:6px;">' + milestone.label + '</div>' +
      '<div style="color:var(--text-light);font-size:0.85rem;margin-bottom:16px;">' + milestone.count + ' friends referred!</div>' +
      '<div style="background:linear-gradient(135deg,rgba(153,102,255,0.1),rgba(255,102,204,0.08));border-radius:14px;padding:16px;margin-bottom:16px;">' +
        '<div style="font-weight:700;font-size:0.85rem;color:var(--purple-dark);margin-bottom:10px;">🎁 Milestone Rewards</div>' +
        (milestone.badge    ? '<div style="font-size:0.82rem;margin:4px 0;">🎖️ Badge: ' + milestone.badge.replace(/_/g,' ') + '</div>' : '') +
        (milestone.title    ? '<div style="font-size:0.82rem;margin:4px 0;">📜 Title unlocked!</div>' : '') +
        (milestone.skinKeys ? '<div style="font-size:0.82rem;margin:4px 0;">🔑 ' + milestone.skinKeys + ' Skin Key' + (milestone.skinKeys > 1 ? 's' : '') + '!</div>' : '') +
        (milestone.frame    ? '<div style="font-size:0.82rem;margin:4px 0;">🖼️ Exclusive frame unlocked!</div>' : '') +
        '<div style="font-size:0.82rem;margin:4px 0;color:#e6a800;">💰 +' + bonusPP + ' bonus PP!</div>' +
      '</div>' +
      '<button class="btn btn-primary" onclick="closeModal()" style="width:100%;">Awesome! 🚀</button>' +
    '</div>';

  openModal(modal);

  // Confetti for epic/legendary
  if (milestone.tier === 'epic' || milestone.tier === 'legendary') {
    if (typeof createConfettiBurst === 'function') createConfettiBurst();
  }
}

/**
 * Check and award referral milestone badges
 */
async function checkReferralBadges(userId, referralCount) {
  var badges = [
    { count: 1,  badge: 'referral_rookie', name: 'Referral Rookie' },
    { count: 5,  badge: 'recruiter',       name: 'Recruiter' },
    { count: 10, badge: 'ambassador',      name: 'Ambassador' },
    { count: 25, badge: 'influencer',      name: 'Influencer' },
    { count: 50, badge: 'legend',          name: 'Legend' }
  ];
  
  for (var i = 0; i < badges.length; i++) {
    if (referralCount >= badges[i].count) {
      await awardBadge(badges[i].badge, userId);
    }
  }
}

/**
 * Copy referral link to clipboard
 */
async function copyReferralLink() {
  var input = el('referral-link-input');
  var btn = el('copy-btn-text');
  
  try {
    // Select and copy
    input.select();
    input.setSelectionRange(0, 99999); // For mobile
    
    await navigator.clipboard.writeText(input.value);
    
    // Show success feedback
    btn.textContent = '✓ Copied!';
    showPixelToast('Referral link copied to clipboard!', 'success');
    
    // Track in analytics
    gtag('event', 'referral_link_copied', {
      referral_link: input.value
    });
    
    // Reset button text after 2 seconds
    setTimeout(function() {
      btn.textContent = 'Copy Link';
    }, 2000);
    
  } catch (err) {
    console.error('Failed to copy:', err);
    
    // Fallback: show prompt to copy manually
    btn.textContent = 'Select & Copy';
    setTimeout(function() {
      btn.textContent = 'Copy Link';
    }, 2000);
  }
}

// ══════════════════════════════════════════════════════════════
// ANALYTICS EVENT TRACKING
// ══════════════════════════════════════════════════════════════

/**
 * Track custom events throughout the app
 * Call these functions at key moments
 */

function trackSignup() {
  gtag('event', 'sign_up', {
    method: 'email'
  });
}

function trackPetAdoption(petName) {
  gtag('event', 'adopt_pet', {
    pet_name: petName,
    event_category: 'engagement'
  });
}

function trackMinigame(gameName) {
  gtag('event', 'play_minigame', {
    game_name: gameName,
    event_category: 'engagement'
  });
}

function trackBattle(result) {
  gtag('event', 'battle', {
    result: result, // 'victory' or 'defeat'
    event_category: 'engagement'
  });
}

function trackBadgeUnlock(badgeName) {
  gtag('event', 'unlock_badge', {
    badge_name: badgeName,
    event_category: 'achievement'
  });
}

function trackTwitchLink() {
  gtag('event', 'link_twitch', {
    event_category: 'social'
  });
}

// ══════════════════════════════════════════════════════════════
// SOCIAL SHARING SYSTEM
// ══════════════════════════════════════════════════════════════

/**
 * Get emoji for pet (for social posts)
 */
function getPetEmoji(petName) {
  var emojiMap = {
    'Ember': '🦊',
    'Pyxie': '🐰',
    'Bird': '🐦',
    'Fox': '🦊',
    'Raccoon': '🦝',
    'Bear': '🐻',
    'Deer': '🦌',
    'Wolf': '🐺',
    'Squirrel': '🐿️',
    'Bunny': '🐰'
  };
  
  return emojiMap[petName] || '🐾';
}

/**
 * Get user's referral link
 */
async function getReferralLink() {
  if (!currentUser) return 'https://pawketpetsvt.github.io';
  
  var { data } = await supabaseClient
    .from('players')
    .select('referral_code')
    .eq('id', currentUser.id)
    .single();
  
  if (data && data.referral_code) {
    return 'https://pawketpetsvt.github.io/?ref=' + data.referral_code;
  }
  
  return 'https://pawketpetsvt.github.io';
}

/**
 * Share to Twitter
 */
function shareToTwitter(text, includeReferral) {
  getReferralLink().then(function(url) {
    var shareUrl = includeReferral ? url : 'https://pawketpetsvt.github.io';
    var twitterUrl = 'https://twitter.com/intent/tweet?' +
      'text=' + encodeURIComponent(text) +
      '&url=' + encodeURIComponent(shareUrl) +
      '&hashtags=PawketPetsVT,VTuber,VirtualPets';
    
    window.open(twitterUrl, '_blank', 'width=550,height=420');
    
    // Track in analytics
    gtag('event', 'social_share', {
      platform: 'twitter',
      content_type: 'general'
    });
  });
}

/**
 * Share to Bluesky
 */
function shareToBluesky(text, includeReferral) {
  getReferralLink().then(function(url) {
    var shareUrl = includeReferral ? url : 'https://pawketpetsvt.github.io';
    var fullText = text + '\n\n' + shareUrl;
    var blueskyUrl = 'https://bsky.app/intent/compose?text=' + encodeURIComponent(fullText);
    
    window.open(blueskyUrl, '_blank', 'width=600,height=600');
    
    // Track in analytics
    gtag('event', 'social_share', {
      platform: 'bluesky',
      content_type: 'general'
    });
  });
}

/**
 * Share after pet adoption
 */
function shareAdoptionToTwitter() {
  if (!lastAdoptedPet) {
    shareToTwitter('I just adopted a pet in PawketPetsVT! Join me! 🐾', true);
    return;
  }
  
  var text = 'I just adopted ' + lastAdoptedPet.nickname + ' in PawketPetsVT! ' + 
             lastAdoptedPet.emoji + '\n\nJoin me and get 100 free PawketPoints!';
  
  shareToTwitter(text, true);
}

function shareAdoptionToBluesky() {
  if (!lastAdoptedPet) {
    shareToBluesky('I just adopted a pet in PawketPetsVT! Join me! 🐾', true);
    return;
  }
  
  var text = 'I just adopted ' + lastAdoptedPet.nickname + ' in PawketPetsVT! ' + 
             lastAdoptedPet.emoji + '\n\nJoin me and get 100 free PawketPoints!';
  
  shareToBluesky(text, true);
}

/**
 * Share badge unlock
 */
var lastUnlockedBadge = null;

function shareBadgeToTwitter(badgeName, badgeIcon) {
  var text = 'I just earned the "' + badgeName + '" badge ' + badgeIcon + ' in PawketPetsVT!\n\nJoin me!';
  shareToTwitter(text, true);
}

function shareBadgeToBluesky(badgeName, badgeIcon) {
  var text = 'I just earned the "' + badgeName + '" badge ' + badgeIcon + ' in PawketPetsVT!\n\nJoin me!';
  shareToBluesky(text, true);
}

/**
 * Share level milestone
 */
function shareLevelToTwitter(level) {
  var text = 'I just reached Level ' + level + ' in PawketPetsVT! 🎉\n\nJoin the fun!';
  shareToTwitter(text, true);
}

function shareLevelToBluesky(level) {
  var text = 'I just reached Level ' + level + ' in PawketPetsVT! 🎉\n\nJoin the fun!';
  shareToBluesky(text, true);
}

/**
 * Share profile
 */
async function shareProfileToTwitter() {
  if (!currentUser) return;
  
  var { data } = await supabaseClient
    .from('players')
    .select('username')
    .eq('id', currentUser.id)
    .single();
  
  var username = data ? data.username : 'me';
  var text = 'Check out my PawketPetsVT profile! 🐾\n\nCome play with ' + username + '!';
  
  shareToTwitter(text, true);
}

async function shareProfileToBluesky() {
  if (!currentUser) return;
  
  var { data } = await supabaseClient
    .from('players')
    .select('username')
    .eq('id', currentUser.id)
    .single();
  
  var username = data ? data.username : 'me';
  var text = 'Check out my PawketPetsVT profile! 🐾\n\nCome play with ' + username + '!';
  
  shareToBluesky(text, true);
}

/**
 * Share battle victory
 */
function shareBattleVictoryToTwitter(enemyName) {
  var text = 'I just defeated a ' + enemyName + ' in PawketPetsVT! ⚔️\n\nThink you can beat me?';
  shareToTwitter(text, true);
}

function shareBattleVictoryToBluesky(enemyName) {
  var text = 'I just defeated a ' + enemyName + ' in PawketPetsVT! ⚔️\n\nThink you can beat me?';
  shareToBluesky(text, true);
}


// ══════════════════════════════════════════════════════════════
// RETRO FORUM SYSTEM
// ══════════════════════════════════════════════════════════════


/**
 * Initialize forum - check if user is mod
 */

/**
 * Load forum categories
 */

/**
 * Show forum category (list of threads)
 */

/**
 * Load threads in category
 */

/**
 * Show single thread with replies
 */

/**
 * Create forum post HTML
 */

/**
 * Show new thread modal
 */


/**
 * Submit new thread
 */

/**
 * Submit reply to thread
 */

/**
 * Delete forum post
 */

/**
 * Toggle thread pin
 */

/**
 * Toggle thread lock
 */

/**
 * Show forum categories view
 */

/**
 * Go back to category from thread
 */

/**
 * Admin panel functions
 */


/**
 * Load banned users
 */

/**
 * Ban user
 */

/**
 * Unban user
 */

/**
 * Load recent posts for moderation
 */

/**
 * Get time ago string
 */

/**
 * Escape HTML to prevent XSS
 */


// ══════════════════════════════════════════════════════════════
// EMOJI PICKER FOR FORUM
// ══════════════════════════════════════════════════════════════

/**
 * Toggle emoji picker
 */

/**
 * Insert emoji into textarea
 */


// ══════════════════════════════════════════════════════════════
// PARTICLE EFFECTS SYSTEM
// ══════════════════════════════════════════════════════════════

/**
 * Create floating sparkles on home page
 */
function createFloatingSparkles() {
  var sparkles = ['✨', '⭐', '💫', '🌟'];
  
  // FIX 4: Use safe timer and track interval globally
  window.particleInterval = safeSetInterval(function() {
    var sparkle = makeEl('div', { class: 'sparkle-particle' });
    sparkle.textContent = sparkles[Math.floor(Math.random() * sparkles.length)];
    sparkle.style.left = Math.random() * window.innerWidth + 'px';
    sparkle.style.animationDelay = Math.random() * 2 + 's';
    sparkle.style.animationDuration = (Math.random() * 2 + 2) + 's';
    
    document.body.appendChild(sparkle);
    
    safeSetTimeout(function() {
      sparkle.remove();
    }, 5000);
  }, 3000); // New sparkle every 3 seconds
}

/**
 * Confetti burst (for adoptions)
 */
// ── SCREEN SHAKE ─────────────────────────────────────────────────────────
function screenShake(intensity, duration) {
  var body = document.body;
  var start = Date.now();
  function shake() {
    if (Date.now() - start >= duration) { body.style.transform = ''; return; }
    body.style.transform = 'translate(' + ((Math.random()-0.5)*intensity) + 'px,' + ((Math.random()-0.5)*intensity) + 'px)';
    requestAnimationFrame(shake);
  }
  shake();
}

// ── SCREEN FLASH ─────────────────────────────────────────────────────────
function screenFlash(color, duration) {
  var flash = document.createElement('div');
  flash.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:' + color + ';z-index:99999;pointer-events:none;opacity:0;transition:opacity 0.1s;';
  document.body.appendChild(flash);
  setTimeout(function() { flash.style.opacity = '0.5'; }, 10);
  setTimeout(function() { flash.style.opacity = '0'; }, duration / 2);
  setTimeout(function() { if (flash.parentNode) flash.remove(); }, duration + 100);
}

function createConfettiBurst(x, y) {
  var colors = ['#ff6b6b','#4ecdc4','#45b7d1','#f9ca24','#6c5ce7','#a29bfe','#ff66cc','#9966ff'];
  var count = 70;
  for (var i = 0; i < count; i++) {
    (function() {
      var piece = document.createElement('div');
      piece.className = 'confetti-piece';
      var size = 7 + Math.random() * 7;
      var angle = Math.random() * Math.PI * 2;
      var speed = 200 + Math.random() * 300;
      var vx = Math.cos(angle) * speed;
      var vy = Math.sin(angle) * speed - 150; // upward bias
      var gravity = 400;
      var startX = x + (Math.random() - 0.5) * 60;
      var startY = y + (Math.random() - 0.5) * 60;
      var rot = Math.random() * 360;
      var rotSpeed = (Math.random() - 0.5) * 720;
      piece.style.cssText = 'position:fixed;width:' + size + 'px;height:' + size + 'px;background:' + colors[Math.floor(Math.random()*colors.length)] + ';border-radius:' + (Math.random() > 0.5 ? '50%' : '2px') + ';pointer-events:none;z-index:100001;left:' + startX + 'px;top:' + startY + 'px;';
      document.body.appendChild(piece);
      var startTime = performance.now();
      var duration = 2000 + Math.random() * 1000;
      function animate(now) {
        var t = (now - startTime) / 1000;
        if (t > duration / 1000) { if (piece.parentNode) piece.remove(); return; }
        var cx = startX + vx * t;
        var cy = startY + vy * t + 0.5 * gravity * t * t;
        var opacity = 1 - t / (duration / 1000);
        piece.style.left = cx + 'px';
        piece.style.top  = cy + 'px';
        piece.style.transform = 'rotate(' + (rot + rotSpeed * t) + 'deg)';
        piece.style.opacity = opacity;
        requestAnimationFrame(animate);
      }
      requestAnimationFrame(animate);
    })();
  }
}

/**
 * Star burst (for battle victories)
 */
function createStarBurst(x, y) {
  var stars = ['⭐', '🌟', '✨', '💫'];
  var count = 12;
  
  for (var i = 0; i < count; i++) {
    var star = makeEl('div', { class: 'star-burst' });
    star.textContent = stars[Math.floor(Math.random() * stars.length)];
    
    var angle = (i / count) * Math.PI * 2;
    var distance = 100;
    
    star.style.left = (x + Math.cos(angle) * distance) + 'px';
    star.style.top = (y + Math.sin(angle) * distance) + 'px';
    star.style.animationDelay = (i * 0.05) + 's';
    
    document.body.appendChild(star);
    
    setTimeout(function(s) {
      return function() { s.remove(); };
    }(star), 1500);
  }
}

/**
 * Floating hearts (when playing with pet)
 */
function createHeartFloat(x, y) {
  var hearts = ['💖', '💗', '💕', '❤️'];
  var count = 5;
  
  for (var i = 0; i < count; i++) {
    var heart = makeEl('div', { class: 'heart-float' });
    heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
    heart.style.left = (x + (Math.random() - 0.5) * 100) + 'px';
    heart.style.top = y + 'px';
    heart.style.animationDelay = (i * 0.2) + 's';
    
    document.body.appendChild(heart);
    
    setTimeout(function(h) {
      return function() { h.remove(); };
    }(heart), 2500);
  }
}

/**
 * Initialize particle effects
 */
function initParticleEffects() {
  // Only add floating sparkles on home page
  var homeSection = el('section-home');
  if (homeSection && homeSection.classList.contains('active')) {
    createFloatingSparkles();
  }
}

// Start particles when page loads
setTimeout(function() {
  if (el('section-home') && el('section-home').classList.contains('active')) {
    createFloatingSparkles();
  }
}, 2000);


// ═══════════════════════════════════════════════════════════════════════
// PET TITLES SYSTEM
// ═══════════════════════════════════════════════════════════════════════

var allPetTitles = []; // All available pet titles
var petTitlesCache = {}; // Cache of titles per pet: { petId: [titles] }

// Load all pet titles
async function loadAllPetTitles() {
  try {
    var res = await supabaseClient
      .from('pet_titles')
      .select('*')
      .order('rarity', { ascending: false });
    
    if (res.data) {
      allPetTitles = res.data;
      dbg('🏷️ Pet titles loaded:', allPetTitles.length, 'available');
    }
  } catch (err) {
    console.error('[Pet Titles] Error loading titles:', err);
  }
}

// Load titles for a specific pet
async function loadPetTitles(petId) {
  if (!petId) return [];
  
  try {
    var res = await supabaseClient
      .from('user_pet_titles')
      .select('pet_title_id, pet_titles(*)')
      .eq('user_pet_id', petId);
    
    if (res.data) {
      var titles = res.data.map(function(upt) { return upt.pet_titles; });
      petTitlesCache[petId] = titles;
      return titles;
    }
    
    return [];
  } catch (err) {
    console.error('[Pet Titles] Error loading pet titles:', err);
    return [];
  }
}

// Check if pet has specific title
function petHasTitle(petId, titleKey) {
  var titles = petTitlesCache[petId] || [];
  return titles.some(function(t) { return t.title_key === titleKey; });
}

// Award title to pet
async function awardPetTitle(petId, titleKey, reason) {
  if (!petId || !titleKey) return;
  
  // Check if already has this title
  if (petHasTitle(petId, titleKey)) {
    dbg('[Pet Title] Already unlocked:', titleKey, 'for pet', petId);
    return;
  }
  
  try {
    // Get title info
    var titleRes = await supabaseClient
      .from('pet_titles')
      .select('*')
      .eq('title_key', titleKey)
      .maybeSingle();
    
    if (titleRes.error || !titleRes.data) {
      console.error('[Pet Title] Title not found:', titleKey);
      return;
    }
    
    var title = titleRes.data;
    
    // Insert into user_pet_titles
    var insertRes = await supabaseClient
      .from('user_pet_titles')
      .insert([{
        user_pet_id: petId,
        pet_title_id: title.id,
        unlock_reason: reason || 'Earned in battle'
      }]);
    
    if (insertRes.error) {
      console.error('[Pet Title] Error awarding title:', insertRes.error);
      return;
    }
    
    // Add to local cache
    if (!petTitlesCache[petId]) {
      petTitlesCache[petId] = [];
    }
    petTitlesCache[petId].push(title);
    
    // Show notification
    showPetTitleUnlockNotification(petId, title, reason);
    
    dbg('🏷️✨ Pet title unlocked:', title.display_name, 'for pet', petId);
    
  } catch (err) {
    console.error('[Pet Title] Error awarding title:', err);
  }
}

// Show pet title unlock notification
function showPetTitleUnlockNotification(petId, title, reason) {
  var rarityColors = {
    'common': '#8e8e8e',
    'uncommon': '#5cb85c',
    'rare': '#5bc0de',
    'epic': '#9c27b0',
    'legendary': '#ff9800'
  };
  
  var color = rarityColors[title.rarity] || '#8e8e8e';
  var pet = petState[petId];
  var petName = pet ? pet.nickname : 'Your pet';
  
  // Show toast notification
  showToast(petName + ' earned: ' + title.icon + ' ' + title.display_name + '!', 5000, color);
  
  // Optional: Show fancy modal
  // You could reuse the exploration modal or create a dedicated one
}

// Set active title for pet
async function setPetActiveTitle(petId, petTitleId) {
  if (!petId) return;
  
  try {
    var updateRes = await supabaseClient
      .from('user_pets')
      .update({ active_pet_title_id: petTitleId })
      .eq('id', petId);
    
    if (updateRes.error) {
      console.error('[Pet Title] Error setting active title:', updateRes.error);
      showToast('Failed to equip pet title', 3000, 'var(--red)');
      return;
    }
    
    // Update local cache
    if (petState[petId]) {
      petState[petId].active_pet_title_id = petTitleId;
    }
    
    if (petTitleId) {
      var title = allPetTitles.find(function(t) { return t.id === petTitleId; });
      showToast('✅ Title equipped: ' + title.display_name, 3000, 'var(--green)');
    } else {
      showToast('Pet title removed', 3000, 'var(--text-light)');
    }
    
    // Reload pet display
    tabsLoaded['mypets'] = false;
    if (el('section-mypets') && el('section-mypets').classList.contains('active')) {
      showTab('mypets');
    }
    
  } catch (err) {
    console.error('[Pet Title] Error setting active title:', err);
  }
}

// Get pet title display text (for showing on pet cards)
function getPetTitleDisplay(petId) {
  var pet = petState[petId];
  if (!pet || !pet.active_pet_title_id) return '';
  
  var title = allPetTitles.find(function(t) { return t.id === pet.active_pet_title_id; });
  if (!title) return '';
  
  var rarityColors = {
    'common': '#8e8e8e',
    'uncommon': '#5cb85c',
    'rare': '#5bc0de',
    'epic': '#9c27b0',
    'legendary': '#ff9800'
  };
  
  var color = rarityColors[title.rarity] || '#8e8e8e';
  
  return '<div class="pet-title-badge" style="color: ' + color + ';">' +
    title.icon + ' ' + title.display_name +
    '</div>';
}

// ═══════════════════════════════════════════════════════════════════════
// PET VARIANT SYSTEM
// ═══════════════════════════════════════════════════════════════════════

// Variant types and their unlock levels
var petVariants = {
  // Level-based variants (existing)
  golden: { level: 5, chance: 0.15, name: 'Golden', icon: '✨', color: '#FFD700', unlockType: 'level' },
  shiny: { level: 10, chance: 0.15, name: 'Shiny', icon: '💎', color: '#00CED1', unlockType: 'level' },
  rainbow: { level: 15, chance: 0.15, name: 'Rainbow', icon: '🌈', color: '#FF69B4', unlockType: 'level' },
  cosmic: { level: 20, chance: 0.15, name: 'Cosmic', icon: '🌌', color: '#9370DB', unlockType: 'level' },
  
  // STREAM REWARD VARIANTS - CSS effects only, add custom sprites later!
  // These are unlocked via Twitch channel point redemptions
  shadow: { 
    unlockType: 'twitch_reward', 
    rewardId: 'shadow_variant', 
    name: 'Shadow', 
    icon: '🌑', 
    color: '#4a4a4a',
    description: 'Mysterious dark variant',
    cssEffect: 'shadow' // Pure CSS styling
  },
  fire: { 
    unlockType: 'twitch_reward', 
    rewardId: 'fire_variant', 
    name: 'Fire', 
    icon: '🔥', 
    color: '#ff4400',
    description: 'Blazing hot variant',
    cssEffect: 'fire'
  },
  ice: { 
    unlockType: 'twitch_reward', 
    rewardId: 'ice_variant', 
    name: 'Ice', 
    icon: '❄️', 
    color: '#88ddff',
    description: 'Frosty cool variant',
    cssEffect: 'ice'
  },
  spirit: { 
    unlockType: 'twitch_reward', 
    rewardId: 'spirit_variant', 
    name: 'Spirit', 
    icon: '👻', 
    color: '#ccaaff',
    description: 'Ghostly ethereal variant',
    cssEffect: 'spirit'
  },
  crystal: { 
    unlockType: 'twitch_reward', 
    rewardId: 'crystal_variant', 
    name: 'Crystal', 
    icon: '💠', 
    color: '#00ffff',
    description: 'Crystalline variant',
    cssEffect: 'crystal'
  }
};

// Get variant badge HTML
function getPetVariantBadge(variant) {
  if (!variant) return '';
  
  var variantData = petVariants[variant];
  if (!variantData) return '';
  
  return '<div class="pet-variant-badge" style="background: ' + variantData.color + '20; border: 2px solid ' + variantData.color + '; color: ' + variantData.color + '; padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 0.85rem; display: inline-block;">' +
    variantData.icon + ' ' + variantData.name +
    '</div>';
}

// Get variant CSS class
function getPetVariantClass(variant) {
  if (!variant) return '';
  return 'pet-variant-' + variant;
}

// Check for variant unlock at milestone levels
async function checkVariantUnlock(petId, level) {
  if (!petId) return;
  
  var pet = petState[petId];
  if (!pet) return;
  
  // If pet already has a variant, don't unlock another one
  if (pet.variant) {
    dbg('[Variant] Pet already has variant:', pet.variant);
    return;
  }
  
  // Check if this level unlocks a variant
  var variantToUnlock = null;
  
  if (level === 5 && Math.random() < 0.15) {
    variantToUnlock = 'golden';
  } else if (level === 10 && Math.random() < 0.15) {
    variantToUnlock = 'shiny';
  } else if (level === 15 && Math.random() < 0.15) {
    variantToUnlock = 'rainbow';
  } else if (level === 20 && Math.random() < 0.15) {
    variantToUnlock = 'cosmic';
  }
  
  if (!variantToUnlock) {
    dbg('[Variant] No variant unlocked at level', level);
    return;
  }
  
  try {
    // Update pet with variant
    var updateRes = await supabaseClient
      .from('user_pets')
      .update({ 
        variant: variantToUnlock,
        variant_unlocked_at_level: level
      })
      .eq('id', petId);
    
    if (updateRes.error) {
      console.error('[Variant] Error unlocking variant:', updateRes.error);
      return;
    }
    
    // Update local state
    petState[petId].variant = variantToUnlock;
    petState[petId].variant_unlocked_at_level = level;
    
    // Show notification
    var variantData = petVariants[variantToUnlock];
    showToast('✨ <strong>Variant Unlocked!</strong><br>' +
      escapeHtml(pet.nickname) + ' became <span style="color: ' + variantData.color + ';">' + 
      variantData.icon + ' ' + variantData.name + '</span>!',
      6000, variantData.color);
    
    dbg('✨ Variant unlocked:', variantToUnlock, 'for pet', petId);
    
    // Award variant badge
    await dbg('[badge] variant_unlock has no DB entry');//;
    
    // Reload pet display
    tabsLoaded['mypets'] = false;
    
  } catch (err) {
    console.error('[Variant] Error unlocking variant:', err);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// STREAM REWARD VARIANT UNLOCKS - Via Twitch Channel Points
// ══════════════════════════════════════════════════════════════════════════

// Unlock variant via Twitch reward redemption
async function unlockTwitchVariant(petId, variantKey, rewardInfo) {
  if (!currentUser) {
    showToast('Please log in to unlock variants!');
    return false;
  }
  
  var pet = petState[petId];
  if (!pet) {
    console.error('[TwitchVariant] Pet not found:', petId);
    return false;
  }
  
  // Check if variant exists
  var variantData = petVariants[variantKey];
  if (!variantData || variantData.unlockType !== 'twitch_reward') {
    console.error('[TwitchVariant] Invalid variant:', variantKey);
    return false;
  }
  
  // Check if pet already has this variant
  if (pet.variant === variantKey) {
    showToast('🐾 ' + escapeHtml(pet.nickname) + ' already has the ' + variantData.name + ' variant!');
    return false;
  }
  
  try {
    // Update pet with new variant
    var updateRes = await supabaseClient
      .from('user_pets')
      .update({ 
        variant: variantKey,
        variant_unlocked_at_level: pet.level,
        variant_unlock_source: 'twitch_reward'
      })
      .eq('id', petId)
      .eq('user_id', currentUser.id); // Security check
    
    if (updateRes.error) {
      console.error('[TwitchVariant] Error unlocking variant:', updateRes.error);
      showToast('Failed to unlock variant. Please try again!');
      return false;
    }
    
    // Update local state
    petState[petId].variant = variantKey;
    petState[petId].variant_unlocked_at_level = pet.level;
    
    // Show fancy unlock notification
    showVariantUnlockNotification(pet.nickname, variantData);
    
    // Award badge for first Twitch variant unlock
    await dbg('[badge] twitch_variant_unlock has no DB entry');//;
    
    // Log to activity feed
    if (typeof logActivity === 'function') {
      await logActivity('unlocked ' + variantData.icon + ' ' + variantData.name + ' variant for ' + pet.nickname);
    }
    
    // Reload pet display
    tabsLoaded['mypets'] = false;
    
    dbg('✨ Twitch variant unlocked:', variantKey, 'for pet', petId);
    return true;
    
  } catch (err) {
    console.error('[TwitchVariant] Error:', err);
    showToast('Something went wrong. Please try again!');
    return false;
  }
}

// Show fancy variant unlock notification
function showVariantUnlockNotification(petNickname, variantData) {
  // Effects
  screenShake(6, 300);
  screenFlash('rgba(255,215,0,0.2)', 500);
  playChiptune('variant');
  createConfettiBurst(window.innerWidth / 2, window.innerHeight / 2);

  var notification = document.createElement('div');
  notification.className = 'variant-unlock-notification';
  notification.style.position = 'relative';
  notification.innerHTML = 
    '<button class="celebration-dismiss-btn" onclick="this.closest(\'.variant-unlock-notification\').remove()" title="Dismiss" style="top:8px;right:8px;">✕</button>' +
    '<h2>' + variantData.icon + ' Variant Unlocked!</h2>' +
    '<p><strong>' + escapeHtml(petNickname) + '</strong> is now</p>' +
    '<p style="font-size:1.5rem;color:' + variantData.color + ';font-weight:bold;">' +
    variantData.icon + ' ' + variantData.name + '</p>' +
    '<p style="font-size:0.9rem;margin-top:10px;">' + (variantData.description || '') + '</p>';
  
  document.body.appendChild(notification);
  
  // Remove after 8 seconds
  setTimeout(function() {
    notification.style.animation = 'variantUnlockPop 0.3s ease reverse';
    setTimeout(function() {
      if (notification.parentNode) notification.parentNode.removeChild(notification);
    }, 300);
  }, 8000);
}

// Check for pending Twitch reward redemptions
// This would be called periodically or when user visits the site
async function checkTwitchRewardRedemptions() {
  if (!currentUser) return;
  
  // In a real implementation, this would:
  // 1. Check your backend for pending Twitch EventSub notifications
  // 2. Process any variant unlock rewards
  // 3. Mark them as processed
  
  // Example structure:
  // var { data: redemptions, error } = await supabaseClient
  //   .from('twitch_reward_queue')
  //   .select('*')
  //   .eq('user_id', currentUser.id)
  //   .eq('processed', false)
  //   .eq('reward_type', 'variant_unlock');
  //
  // if (redemptions && redemptions.length > 0) {
  //   for (var i = 0; i < redemptions.length; i++) {
  //     var redemption = redemptions[i];
  //     await unlockTwitchVariant(
  //       redemption.pet_id, 
  //       redemption.variant_key,
  //       redemption
  //     );
  //     // Mark as processed
  //     await supabaseClient
  //       .from('twitch_reward_queue')
  //       .update({ processed: true })
  //       .eq('id', redemption.id);
  //   }
  // }
  
  dbg('[TwitchVariant] Checked for pending redemptions');
}

// Get list of available stream reward variants for a pet
function getAvailableTwitchVariants(petType) {
  var available = [];
  
  for (var key in petVariants) {
    var variant = petVariants[key];
    if (variant.unlockType === 'twitch_reward') {
      available.push({
        key: key,
        name: variant.name,
        icon: variant.icon,
        color: variant.color,
        description: variant.description
      });
    }
  }
  
  return available;
}

// Show variant gallery modal
function showVariantGallery() {
  var modal = makeModal();
  var content = makeEl('div');
  
  // Title
  var title = makeEl('h2');
  title.textContent = '✨ Pet Variant Gallery';
  title.style.cssText = 'text-align:center;color:var(--purple);margin-bottom:20px;';
  content.appendChild(title);
  
  // Description
  var desc = makeEl('p');
  desc.textContent = 'Unlock special variants through leveling up or Twitch channel point rewards!';
  desc.style.cssText = 'text-align:center;color:var(--text-light);margin-bottom:30px;';
  content.appendChild(desc);
  
  // Level-based variants section
  var levelSection = makeEl('div');
  levelSection.innerHTML = '<h3 style="color:var(--purple);margin-bottom:15px;">🎯 Level Milestones</h3>';
  
  var levelGrid = makeEl('div');
  levelGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin-bottom:30px;';
  
  for (var key in petVariants) {
    var variant = petVariants[key];
    if (variant.unlockType === 'level') {
      var card = makeEl('div');
      card.style.cssText = 'background:' + variant.color + '20;border:2px solid ' + variant.color + ';border-radius:12px;padding:15px;text-align:center;';
      card.innerHTML = 
        '<div style="font-size:2rem;margin-bottom:8px;">' + variant.icon + '</div>' +
        '<div style="font-weight:bold;color:' + variant.color + ';margin-bottom:5px;">' + variant.name + '</div>' +
        '<div style="font-size:0.85rem;color:var(--text-light);">Unlock at Level ' + variant.level + '</div>' +
        '<div style="font-size:0.75rem;color:var(--text-light);margin-top:5px;">' + (variant.chance * 100) + '% chance</div>';
      levelGrid.appendChild(card);
    }
  }
  
  levelSection.appendChild(levelGrid);
  content.appendChild(levelSection);
  
  // Twitch reward variants section
  var twitchSection = makeEl('div');
  twitchSection.innerHTML = '<h3 style="color:var(--purple);margin-bottom:15px;">📺 Twitch Rewards</h3>' +
    '<p style="font-size:0.9rem;color:var(--text-light);margin-bottom:15px;">Unlock these exclusive variants with Twitch channel points on our streams!</p>';
  
  var twitchGrid = makeEl('div');
  twitchGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:15px;';
  
  for (var key in petVariants) {
    var variant = petVariants[key];
    if (variant.unlockType === 'twitch_reward') {
      var card = makeEl('div');
      card.style.cssText = 'background:' + variant.color + '20;border:3px solid ' + variant.color + ';border-radius:12px;padding:15px;text-align:center;position:relative;';
      
      // Special styling preview (CSS-only, no AI art)
      var preview = makeEl('div');
      preview.style.cssText = 'width:80px;height:80px;margin:0 auto 10px;background:' + variant.color + '40;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:2.5rem;';
      preview.textContent = variant.icon;
      
      // Apply CSS effect preview
      if (variant.cssEffect) {
        preview.className = 'pet-variant-' + variant.cssEffect;
      }
      
      card.appendChild(preview);
      card.innerHTML += 
        '<div style="font-weight:bold;color:' + variant.color + ';margin-bottom:5px;font-size:1.1rem;">' + variant.name + '</div>' +
        '<div style="font-size:0.85rem;color:var(--text-light);line-height:1.4;">' + variant.description + '</div>' +
        '<div style="margin-top:10px;padding:8px;background:var(--purple-light);border-radius:8px;font-size:0.75rem;color:var(--purple-dark);font-weight:600;">🎬 Redeem on Stream</div>';
      
      twitchGrid.appendChild(card);
    }
  }
  
  twitchSection.appendChild(twitchGrid);
  content.appendChild(twitchSection);
  
  // Note about custom sprites
  var note = makeEl('div');
  note.style.cssText = 'margin-top:30px;padding:15px;background:rgba(153,102,255,0.1);border-radius:12px;text-align:center;';
  note.innerHTML = '<p style="font-size:0.85rem;color:var(--text-light);"><strong>Note:</strong> Variants currently use CSS effects. Custom sprites coming soon!</p>';
  content.appendChild(note);
  
  // Close button
  var closeBtn = makeEl('button', {class: 'btn btn-primary'});
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = 'display:block;margin:20px auto 0;';
  closeBtn.onclick = function() { closeModal(); };
  content.appendChild(closeBtn);
  
  modal.appendChild(content);
  openModal(modal);
}

// ═══════════════════════════════════════════════════════════════════════
// PLAYER TITLE SYSTEM (Account-Wide Titles)
// ═══════════════════════════════════════════════════════════════════════

var allPlayerTitles = [];
var playerTitlesCache = []; // Titles unlocked by current user
var activePlayerTitle = null; // Currently equipped title

// Load all available player titles from database
async function loadAllPlayerTitles() {
  try {
    var res = await supabaseClient
      .from('player_titles')
      .select('*')
      .order('rarity', { ascending: false });
    
    if (res.data) {
      allPlayerTitles = res.data;
      dbg('👑 Player titles loaded:', allPlayerTitles.length, 'available');
    }
  } catch (err) {
    console.error('[Player Titles] Error loading titles:', err);
  }
}

// Load titles unlocked by current user
async function loadPlayerTitles() {
  if (!currentUser) return [];
  
  try {
    var res = await supabaseClient
      .from('user_player_titles')
      .select('player_title_id, player_titles(*)')
      .eq('user_id', currentUser.id);
    
    if (res.data) {
      playerTitlesCache = res.data.map(function(upt) { return upt.player_titles; });
      dbg('👑 User player titles loaded:', playerTitlesCache.length, 'unlocked');
      return playerTitlesCache;
    }
    
    return [];
  } catch (err) {
    console.error('[Player Titles] Error loading user titles:', err);
    return [];
  }
}

// Load active player title for current user
async function loadActivePlayerTitle() {
  if (!currentUser) return null;
  
  try {
    var res = await supabaseClient
      .from('players')
      .select('active_player_title_id, player_titles(*)')
      .eq('id', currentUser.id)
      .single();
    
    if (res.data && res.data.active_player_title_id) {
      activePlayerTitle = res.data.player_titles;
      dbg('👑 Active player title:', activePlayerTitle?.display_name || 'None');
      return activePlayerTitle;
    }
    
    activePlayerTitle = null;
    return null;
  } catch (err) {
    console.error('[Player Titles] Error loading active title:', err);
    return null;
  }
}

// Check if player has specific title
function hasPlayerTitle(titleKey) {
  return playerTitlesCache.some(function(t) { return t.title_key === titleKey; });
}

// Award title to player
async function awardPlayerTitle(titleKey, reason) {
  if (!titleKey || !currentUser) return;
  
  // Check if already has this title
  if (hasPlayerTitle(titleKey)) {
    dbg('[Player Title] Already unlocked:', titleKey);
    return;
  }
  
  try {
    // Get title info
    var titleRes = await supabaseClient
      .from('player_titles')
      .select('*')
      .eq('title_key', titleKey)
      .maybeSingle();
    
    if (titleRes.error || !titleRes.data) {
      console.error('[Player Title] Title not found:', titleKey);
      return;
    }
    
    var title = titleRes.data;
    
    // Insert into user_player_titles
    var insertRes = await supabaseClient
      .from('user_player_titles')
      .insert([{
        user_id: currentUser.id,
        player_title_id: title.id,
        unlock_reason: reason || 'Achievement unlocked'
      }]);
    
    if (insertRes.error) {
      console.error('[Player Title] Error awarding title:', insertRes.error);
      return;
    }
    
    // Add to local cache
    playerTitlesCache.push(title);
    
    // Show notification
    showPlayerTitleUnlockNotification(title, reason);
    
    // ACTIVITY FEED: Log so friend feeds + OBS live alerts pick it up
    logActivity('title_unlocked', { title_name: title.display_name || titleKey });
    
    dbg('👑✨ Player title unlocked:', title.display_name);
    
  } catch (err) {
    console.error('[Player Title] Error awarding title:', err);
  }
}

// Set active player title
async function setActivePlayerTitle(playerTitleId) {
  if (!currentUser) return;
  
  try {
    var updateRes = await supabaseClient
      .from('players')
      .update({ active_player_title_id: playerTitleId })
      .eq('id', currentUser.id);
    
    if (updateRes.error) {
      console.error('[Player Title] Error setting active title:', updateRes.error);
      showToast('Failed to equip title', 3000, 'var(--red)');
      return;
    }
    
    // Update local cache
    if (playerTitleId) {
      activePlayerTitle = allPlayerTitles.find(function(t) { return t.id === playerTitleId; });
      showToast('✅ Title equipped: ' + activePlayerTitle.display_name, 3000, 'var(--green)');
    } else {
      activePlayerTitle = null;
      showToast('Title removed', 3000, 'var(--text-light)');
    }
    
    // Reload profile if on that tab — use DOM check, not undefined currentTab variable
    var activeSection = document.querySelector('.page-section.active');
    if (activeSection && activeSection.id === 'section-myprofile') {
      showTab('myprofile');
    }
    
  } catch (err) {
    console.error('[Player Title] Error setting active title:', err);
  }
}

// Get player title display text
function getPlayerTitleDisplay(userId) {
  // This will be used for public profiles
  // For now, return active title if it's current user
  if (userId === currentUser?.id && activePlayerTitle) {
    var rarityColors = {
      'Common': '#8e8e8e',
      'Uncommon': '#5cb85c',
      'Rare': '#5bc0de',
      'Epic': '#9c27b0',
      'Legendary': '#ff9800'
    };
    
    var color = activePlayerTitle.color || rarityColors[activePlayerTitle.rarity] || '#8e8e8e';
    
    return '<div class="player-title-badge" style="color: ' + color + '; font-size: 1.1rem; margin-top: 8px; font-weight: 600;">' +
      activePlayerTitle.icon + ' ' + activePlayerTitle.display_name +
      '</div>';
  }
  
  return '';
}

// Show title unlock notification
function showPlayerTitleUnlockNotification(title, reason) {
  showUnlockCelebration('title', title, reason);
}

// Check and award player titles based on achievements
// ═══════════════════════════════════════════════════════════════════════
// PET TITLE UNLOCK TRACKING
// ═══════════════════════════════════════════════════════════════════════

// Check pet title unlocks after various actions
// ═══════════════════════════════════════════════════════════════════════
// REFINED TITLE UNLOCK TRACKING
// Unique, memorable conditions - no boring stat grinding
// ═══════════════════════════════════════════════════════════════════════

// Track special conditions
var titleTracking = {
  consecutiveMisses: {},     // pet_id: count
  consecutiveLosses: {},     // user_id: count
  sameFood: {},             // pet_id: { food_item: count }
  buttonClicks: {},         // user_id: { button_id: count }
  midnightLogins: []        // timestamps of 3am logins
};

// ═══════════════════════════════════════════════════════════════════════
// PLAYER TITLE UNLOCKS — auto-award titles based on gameplay milestones
// Called from showApp after player data is loaded
// ═══════════════════════════════════════════════════════════════════════


async function checkPlayerTitleUnlocks() {
  if (!currentUser) return;

  try {
    // Load player stats — use counters, never join battle_history (too slow)
    var { data: p } = await supabaseClient
      .from('players')
      .select('battles_won, total_battles, total_pp_earned, login_streak, referral_count')
      .eq('id', currentUser.id)
      .single();
    if (!p) return;

    var wins     = p.battles_won || 0;
    var battles  = p.total_battles || 0;
    var ppEarned = p.total_pp_earned || 0;
    var streak   = p.login_streak || 0;
    var refs     = p.referral_count || 0;

    // Own pet count
    var { count: ownedPets } = await supabaseClient
      .from('user_pets').select('id', { count: 'exact', head: true })
      .eq('user_id', currentUser.id);
    ownedPets = ownedPets || 0;

    // Total level across all pets
    var { data: petsData } = await supabaseClient
      .from('user_pets').select('level').eq('user_id', currentUser.id);
    var totalLevel = (petsData || []).reduce(function(s, x){ return s + (x.level||1); }, 0);

    // Friend count
    var { count: friendCount } = await supabaseClient
      .from('friendships').select('id', { count: 'exact', head: true })
      .or('requester_id.eq.' + currentUser.id + ',addressee_id.eq.' + currentUser.id)
      .eq('status', 'accepted');
    friendCount = friendCount || 0;

    // ── COMMON ──
    // newcomer: awarded on registration (first pet adoption)
    if (wins >= 50)   await awardPlayerTitle('fighter').catch(function(){});
    if (ownedPets >= 3) await awardPlayerTitle('pet_lover').catch(function(){});
    if (friendCount >= 5) await awardPlayerTitle('friendly').catch(function(){});
    if (streak >= 7)  await awardPlayerTitle('daily_player').catch(function(){});

    // ── UNCOMMON ──
    if (streak >= 30)  await awardPlayerTitle('dedicated').catch(function(){});
    if (totalLevel >= 100) await awardPlayerTitle('trainer').catch(function(){});
    if (wins >= 200)   await awardPlayerTitle('warrior').catch(function(){});
    if (ownedPets >= 10) await awardPlayerTitle('collector').catch(function(){});
    if (friendCount >= 20) await awardPlayerTitle('popular').catch(function(){});
    if (refs >= 5)     await awardPlayerTitle('recruiter').catch(function(){});
    // night_owl: handled by checkMidnightLogin()

    // ── RARE ──
    if (ownedPets >= 25) await awardPlayerTitle('hoarder').catch(function(){});
    if (streak >= 100)  await awardPlayerTitle('loyal').catch(function(){});
    if (wins >= 500)    await awardPlayerTitle('champion').catch(function(){});
    if (friendCount >= 20) await awardPlayerTitle('socialite').catch(function(){});
    if (totalLevel >= 500) await awardPlayerTitle('master_trainer').catch(function(){});
    if (ppEarned >= 10000) await awardPlayerTitle('point_hoarder').catch(function(){});
    if (refs >= 20)   await awardPlayerTitle('ambassador').catch(function(){});

    // ── EPIC ──
    if (wins >= 50)   await awardPlayerTitle('fighter').catch(function(){});  // already above
    if (battles >= 500) await awardPlayerTitle('the_reaper').catch(function(){});
    if (ppEarned >= 50000) await awardPlayerTitle('whale').catch(function(){});
    if (totalLevel >= 200) await awardPlayerTitle('the_veteran').catch(function(){});
    if (refs >= 10)   await awardPlayerTitle('the_recruiter').catch(function(){});

    // ── LEGENDARY ──
    if (battles >= 1000) await awardPlayerTitle('the_hardcore').catch(function(){});
    if (ppEarned >= 1000000) await awardPlayerTitle('millionaire').catch(function(){});
    if (refs >= 25)  await awardPlayerTitle('the_legendary').catch(function(){});

  } catch (err) {
    console.error('[Titles] Error checking player unlocks:', err);
  }
}


// ═══════════════════════════════════════════════════════════════════════
// PET TITLE UNLOCKS - With Unique Conditions
// ═══════════════════════════════════════════════════════════════════════

async function checkPetTitleUnlocks(petId, context) {
  if (!petId || !currentUser) return;
  
  try {
    var pet = petState[petId];
    if (!pet) return;
    
    // Get battle history for this specific pet — select only the columns
    // actually used here, not '*' (battle_log text blobs add up fast)
    var battles = await supabaseClient
      .from('battle_history')
      .select('victory, is_boss, enemy_name, final_hp, max_hp, max_damage_dealt, pet_energy_at_start, pet_level, turns')
      .eq('user_id', currentUser.id)
      .eq('pet_id', petId);
    
    if (!battles.data) return;
    var b = battles.data;
    
    // the Champion - Win 100 battles
    var wins = b.filter(x => x.victory).length;
    if (wins >= 100 && !petHasTitle(petId, 'the_champion')) {
      await awardPetTitle(petId, 'the_champion', 'Won 100 battles');
    }
    
    // the Gremlin - Win 20 battles
    if (wins >= 20 && !petHasTitle(petId, 'the_gremlin')) {
      await awardPetTitle(petId, 'the_gremlin', 'Won 20 battles');
    }
    
    // Boss Slayer - Defeat any boss
    var bossKills = b.filter(x => x.victory && x.is_boss).length;
    if (bossKills >= 1 && !petHasTitle(petId, 'boss_slayer')) {
      await awardPetTitle(petId, 'boss_slayer', 'Defeated a boss');
    }
    
    // Dragon Slayer - Defeat Dragon boss
    var dragonKills = b.filter(x => 
      x.victory && x.is_boss && x.enemy_name?.toLowerCase().includes('dragon')
    ).length;
    if (dragonKills >= 1 && !petHasTitle(petId, 'dragon_slayer')) {
      await awardPetTitle(petId, 'dragon_slayer', 'Defeated the Dragon');
    }
    
    // the Survivor - Win with less than 5% HP
    var survivorWins = b.filter(x => 
      x.victory && x.final_hp <= (x.max_hp * 0.05)
    ).length;
    if (survivorWins >= 1 && !petHasTitle(petId, 'the_survivor')) {
      await awardPetTitle(petId, 'the_survivor', 'Won with < 5% HP');
    }
    
    // the Cursed - Lose 5 battles in a row
    if (context === 'battle_end' && !petHasTitle(petId, 'the_cursed')) {
      checkConsecutiveLosses(petId, battles.data);
    }
    
    // the Unlucky - Miss 15 attacks in a row
    if (context === 'attack_missed' && !petHasTitle(petId, 'the_unlucky')) {
      incrementConsecutiveMisses(petId);
    }
    
    // the Menace - Deal 200 damage in one hit
    var bigHits = b.filter(x => x.max_damage_dealt >= 200).length;
    if (bigHits >= 1 && !petHasTitle(petId, 'the_menace')) {
      await awardPetTitle(petId, 'the_menace', 'Dealt 200+ damage');
    }
    
    // the Feral - Win 10 battles with energy below 10
    var feralWins = b.filter(x => x.victory && x.pet_energy_at_start <= 10).length;
    if (feralWins >= 10 && !petHasTitle(petId, 'the_feral')) {
      await awardPetTitle(petId, 'the_feral', 'Won while exhausted');
    }
    
    // Speedster - Win in under 3 turns
    var speedWins = b.filter(x => x.victory && x.turns <= 3).length;
    if (speedWins >= 1 && !petHasTitle(petId, 'speedster')) {
      await awardPetTitle(petId, 'speedster', 'Won in under 3 turns');
    }
    
    // the Tiny - Win a battle while level 5 or below
    var tinyWins = b.filter(x => x.victory && x.pet_level <= 5).length;
    if (tinyWins >= 1 && !petHasTitle(petId, 'the_tiny')) {
      await awardPetTitle(petId, 'the_tiny', 'Won while tiny');
    }
    
    // Stat-based titles
    if (pet.energy === 0 && !petHasTitle(petId, 'the_lazy')) {
      await awardPetTitle(petId, 'the_lazy', 'Fell asleep');
    }
    
    if (pet.hunger === 0 && !petHasTitle(petId, 'the_hungry')) {
      await awardPetTitle(petId, 'the_hungry', 'Starving!');
    }
    
    if (pet.happiness >= 90 && !petHasTitle(petId, 'the_happy')) {
      await awardPetTitle(petId, 'the_happy', 'Pure joy!');
    }
    
    if (pet.happiness <= 20 && !petHasTitle(petId, 'the_grumpy')) {
      await awardPetTitle(petId, 'the_grumpy', 'Permanently grumpy');
    }
    
    // the Fallen - Faint once
    var deaths = b.filter(x => !x.victory).length;
    if (deaths >= 1 && !petHasTitle(petId, 'the_fallen')) {
      await awardPetTitle(petId, 'the_fallen', 'Fainted in battle');
    }
    
    // Variant titles
    if (pet.variant === 'golden' && !petHasTitle(petId, 'the_golden')) {
      await awardPetTitle(petId, 'the_golden', 'Became Golden');
    }
    
    if ((pet.variant === 'corrupted' || pet.variant === 'glitched') && !petHasTitle(petId, 'the_ominous')) {
      await awardPetTitle(petId, 'the_ominous', 'Something isn\'t right...');
    }
    
    // Level titles
    if (pet.level >= 50 && !petHasTitle(petId, 'the_ancient')) {
      await awardPetTitle(petId, 'the_ancient', 'Reached level 50');
    }
    
    // the Spoiled - Fed 50 times
    if (pet.times_fed >= 50 && !petHasTitle(petId, 'the_spoiled')) {
      await awardPetTitle(petId, 'the_spoiled', 'Fed 50 times');
    }
    
    // the Beloved - Fed 20 times (starting title basically)
    if (pet.times_fed >= 20 && !petHasTitle(petId, 'the_beloved')) {
      await awardPetTitle(petId, 'the_beloved', 'Fed 20 times');
    }
    
    // the Sleepy - Energy hit 0 ten times
    if (pet.times_energy_zero >= 10 && !petHasTitle(petId, 'the_sleepy')) {
      await awardPetTitle(petId, 'the_sleepy', 'Fell asleep 10 times');
    }
    
  } catch (err) {
    console.error('[Pet Titles] Error checking unlocks:', err);
  }
}

// Helper: Track consecutive misses
function incrementConsecutiveMisses(petId) {
  if (!titleTracking.consecutiveMisses[petId]) {
    titleTracking.consecutiveMisses[petId] = 0;
  }
  titleTracking.consecutiveMisses[petId]++;
  
  if (titleTracking.consecutiveMisses[petId] >= 15) {
    awardPetTitle(petId, 'the_unlucky', 'Missed 15 attacks in a row');
    titleTracking.consecutiveMisses[petId] = 0; // Reset
  }
}

// Helper: Reset miss counter on successful hit
function resetConsecutiveMisses(petId) {
  titleTracking.consecutiveMisses[petId] = 0;
}

// Helper: Check consecutive losses
async function checkConsecutiveLosses(petId, allBattles) {
  // Get last 5 battles
  var recent = allBattles.slice(-5);
  var allLosses = recent.every(b => !b.victory) && recent.length >= 5;
  
  if (allLosses) {
    await awardPetTitle(petId, 'the_cursed', 'Lost 5 battles in a row');
  }
}

// Special: // 3am login check — awards Night Owl title if player logs in at 3am
function checkMidnightLogin() {
  var hour = new Date().getHours();
  if (hour === 3) {
    awardPlayerTitle('night_owl').catch(function(){});  // 'The Night Owl' uncommon title
  }
}

// Special: 3am battle check (call after battle victories)
async function checkMidnightBattle(petId, won) {
  var hour = new Date().getHours();
  if (hour === 3 && won && !petHasTitle(petId, 'the_cryptid')) {
    await awardPetTitle(petId, 'the_cryptid', 'Won a battle at 3am');
  }
}

// Check for boss defeat titles
async function checkBossTitles(petId, bossName) {
  if (!petId || !bossName) return;
  
  // Generic boss slayer
  if (!petHasTitle(petId, 'boss_slayer')) {
    await awardPetTitle(petId, 'boss_slayer', 'Defeated ' + bossName);
  }
  
  // Specific boss titles
  if (bossName.toLowerCase().includes('dragon') && !petHasTitle(petId, 'dragon_slayer')) {
    await awardPetTitle(petId, 'dragon_slayer', 'Defeated the Dragon');
  }
}

// Check for special combat titles (call after each battle)
async function checkCombatTitles(petId, battleData) {
  if (!petId || !battleData) return;
  
  // Speedster - won in under 3 turns
  if (battleData.victory && battleData.turns <= 3 && !petHasTitle(petId, 'speedster')) {
    await awardPetTitle(petId, 'speedster', 'Won in under 3 turns');
  }
  
  // Survivor - won with <5% HP
  if (battleData.victory && battleData.finalHP <= (battleData.maxHP * 0.05) && !petHasTitle(petId, 'the_survivor')) {
    await awardPetTitle(petId, 'the_survivor', 'Won with less than 5% HP');
  }
  
  // the Menace - dealt 200+ damage in one hit
  if (battleData.maxDamageDealt >= 200 && !petHasTitle(petId, 'the_menace')) {
    await awardPetTitle(petId, 'the_menace', 'Dealt 200+ damage in one hit');
  }
  
  // Check 3am battles
  await checkMidnightBattle(petId, battleData.victory);
}

// ═══════════════════════════════════════════════════════════════════════
// INTEGRATION NOTES
// ═══════════════════════════════════════════════════════════════════════

/*
INTEGRATION CHECKLIST:

1. Call loadAllPetTitles() in init() function
2. Call loadPetTitles(petId) when loading pet data
3. Call checkPetTitleUnlocks(petId) after:
   - Battle ends
   - Level up
   - Equipment changes
   - Variant unlocks
   - Stats hit 0
4. Call checkBossTitles(petId, bossName) after boss victories
5. Call checkCombatTitles(petId, battleData) after each battle
6. Add title selection dropdown to My Pets page (see UI code below)
*/
// ═══════════════════════════════════════════════════════════════════════
// TITLE SELECTION UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
// PLAYER TITLE SELECTOR (For Profile Page)
// ═══════════════════════════════════════════════════════════════════════

function renderPlayerTitleSelector(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;
  
  var html = '<div class="title-selector-section">';
  html += '  <h3 class="selector-title">👑 Your Account Title</h3>';
  html += '  <p class="selector-desc">This title displays on your profile and shows your account-wide achievements!</p>';
  html += '  <div class="title-dropdown-wrap">';
  html += '    <label for="player-title-select">Active Title:</label>';
  html += '    <select id="player-title-select" class="title-select" onchange="handlePlayerTitleChange(this)">';
  html += '      <option value="">No Title</option>';
  
  allPlayerTitles.forEach(function(title) {
    var unlocked = playerTitlesCache.some(function(t) { return t.id === title.id; });
    var isActive = activePlayerTitle && activePlayerTitle.id === title.id;
    
    if (unlocked) {
      html += '      <option value="' + title.id + '"' + (isActive ? ' selected' : '') + '>';
      html += title.icon + ' ' + title.display_name + ' (' + title.rarity + ')';
      html += '</option>';
    } else {
      html += '      <option value="" disabled>';
      html += '🔒 ??? - ' + title.unlock_condition;
      html += '</option>';
    }
  });
  
  html += '    </select>';
  html += '  </div>';
  html += '</div>';
  
  container.innerHTML = html;
}

async function handlePlayerTitleChange(selectElement) {
  var titleId = selectElement.value || null;
  await setActivePlayerTitle(titleId);
}

// ═══════════════════════════════════════════════════════════════════════
// PET TITLE SELECTOR (For Individual Pet Cards on My Pets Page)
// ═══════════════════════════════════════════════════════════════════════

function renderPetTitleSelector(petId) {
  var pet = petState[petId];
  if (!pet) return '';
  
  var petTitles = petTitlesCache[petId] || [];
  
  var html = '<div class="pet-title-selector">';
  html += '  <label for="pet-title-select-' + petId + '">🏷️ Pet Title:</label>';
  html += '  <select id="pet-title-select-' + petId + '" class="pet-title-select" onchange="handlePetTitleChange(\'' + petId + '\', this)">';
  html += '    <option value="">No Title</option>';
  
  allPetTitles.forEach(function(title) {
    var unlocked = petTitles.some(function(t) { return t.id === title.id; });
    var isActive = pet.active_pet_title_id === title.id;
    
    if (unlocked) {
      html += '    <option value="' + title.id + '"' + (isActive ? ' selected' : '') + '>';
      html += title.icon + ' ' + title.display_name + ' (' + title.rarity + ')';
      html += '</option>';
    } else {
      html += '    <option value="" disabled>';
      html += '🔒 ??? - ' + title.unlock_condition;
      html += '</option>';
    }
  });
  
  html += '  </select>';
  html += '</div>';
  
  return html;
}

async function handlePetTitleChange(petId, selectElement) {
  var titleId = selectElement.value || null;
  await setPetActiveTitle(petId, titleId);
}

// ═══════════════════════════════════════════════════════════════════════
// INTEGRATED PET CARD WITH TITLE SELECTOR
// ═══════════════════════════════════════════════════════════════════════

// Enhanced makeMyPetCard function with title selector
function makeMyPetCardWithTitles(pet) {
  var card = makeEl('div', {
    class: 'pet-card ' + getPetVariantClass(pet.variant),
    id: 'pet-card-' + pet.id
  });
  
  // Pet image with variant effect
  var imageWrap = makeEl('div', {class: 'pet-image-wrap ' + getPetVariantClass(pet.variant)});
  var img = makeEl('img', {
    src: (function(f) { return 'images/' + (f.indexOf('/') === -1 ? 'pets/' + f : f); })(pet.image_file || (pet.pets && pet.pets.image_file) || 'pets/placeholder.png'),
    alt: pet.nickname,
    onerror: "this.style.display='none';"
  });
  imageWrap.appendChild(img);
  card.appendChild(imageWrap);
  
  // Name row with variant badge
  var nameRow = makeEl('div', {class: 'pet-name-row'});
  var nameText = makeEl('div', {class: 'pet-name'}, pet.nickname);
  nameRow.appendChild(nameText);
  
  if (pet.variant) {
    var variantBadge = document.createElement('div');
    variantBadge.innerHTML = getPetVariantBadge(pet.variant);
    nameRow.appendChild(variantBadge);
  }
  card.appendChild(nameRow);
  
  // Level
  var level = makeEl('div', {class: 'pet-level'}, 'Level ' + pet.level);
  card.appendChild(level);
  
  // Pet title display (if active)
  if (pet.active_pet_title_id) {
    var titleDisplay = document.createElement('div');
    titleDisplay.innerHTML = getPetTitleDisplay(pet.id);
    card.appendChild(titleDisplay);
  }
  
  // Stats section (hunger, energy, happiness, HP, etc.)
  // ... your existing stats code ...
  
  // Title selector dropdown
  var titleSelectorDiv = makeEl('div', {id: 'pet-title-selector-' + pet.id, class: 'pet-title-selector-container'});
  card.appendChild(titleSelectorDiv);
  
  // Load and render title selector asynchronously
  loadPetTitles(pet.id).then(function() {
    titleSelectorDiv.innerHTML = renderPetTitleSelector(pet.id, 'pet-title-selector-' + pet.id);
  });
  
  // Action buttons (feed, play, etc.)
  // ... your existing action buttons ...
  
  return card;
}

// ═══════════════════════════════════════════════════════════════════════
// PROFILE PAGE TITLE DISPLAY
// ═══════════════════════════════════════════════════════════════════════

// Updated profile page to include title selector
async function loadProfileTabWithTitleSelector(userId) {
  var container = el('tab-profile');
  if (!container) return;
  
  if (!userId && currentUser) {
    userId = currentUser.id;
  }
  
  if (!userId) {
    container.innerHTML = '<div class="page-hero"><p>Please log in to view profiles.</p></div>';
    return;
  }
  
  var isOwnProfile = userId === currentUser.id;
  
  try {
    // Load player data
    var playerRes = await supabaseClient
      .from('players')
      .select('*, titles(*)')
      .eq('id', userId)
      .single();
    
    if (playerRes.error || !playerRes.data) {
      container.innerHTML = '<div class="page-hero"><p>Profile not found.</p></div>';
      return;
    }
    
    var player = playerRes.data;
    
    // Build profile HTML
    var html = '<div class="page-hero">';
    html += '  <div class="sparkle-row">👤 ✦ 👤</div>';
    html += '  <h1>' + escapeHtml(player.username) + '</h1>';
    
    // Show active title
    if (player.titles) {
      var rarityColors = {
        'common': '#8e8e8e',
        'uncommon': '#5cb85c',
        'rare': '#5bc0de',
        'epic': '#9c27b0',
        'legendary': '#ff9800'
      };
      var color = rarityColors[player.titles.rarity] || '#8e8e8e';
      html += '  <div class="user-title" style="color: ' + color + '; font-size: 1rem;">' +
        player.titles.icon + ' ' + player.titles.display_name +
        '</div>';
    }
    
    html += '</div>';
    
    // If viewing own profile, show title selector
    if (isOwnProfile) {
      html += '<div id="player-title-selector-container"></div>';
    }
    
    // ... rest of profile page (stats, pets, badges) ...
    
    container.innerHTML = html;
    
    // Render title selector if own profile
    if (isOwnProfile) {
      renderPlayerTitleSelector('player-title-selector-container');
    }
    
  } catch (err) {
    console.error('[Profile] Error loading profile:', err);
    container.innerHTML = '<div class="page-hero"><p>Error loading profile.</p></div>';
  }
}

// ═══════════════════════════════════════════════════════════════════════
// CSS FOR TITLE SELECTORS
// ═══════════════════════════════════════════════════════════════════════

var titleSelectorCSS = `
<style>
.title-selector-section {
  max-width: 600px;
  margin: 30px auto;
  padding: 25px;
  background: var(--white);
  border: 2.5px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 16px var(--shadow);
}

.selector-title {
  font-family: 'Fredoka One', cursive;
  font-size: 1.4rem;
  color: var(--purple-dark);
  margin-bottom: 10px;
  text-align: center;
}

.selector-desc {
  font-size: 0.9rem;
  color: var(--text-light);
  text-align: center;
  margin-bottom: 20px;
}

.title-dropdown-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.title-dropdown-wrap label {
  font-weight: bold;
  color: var(--text);
  font-size: 0.95rem;
}

.title-select,
.pet-title-select {
  width: 100%;
  padding: 12px 15px;
  border: 2px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 0.95rem;
  font-family: inherit;
  background: var(--white);
  cursor: pointer;
  transition: border-color 0.2s;
}

.title-select:hover,
.pet-title-select:hover {
  border-color: var(--purple);
}

.title-select:focus,
.pet-title-select:focus {
  outline: none;
  border-color: var(--purple);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.title-select option[disabled],
.pet-title-select option[disabled] {
  color: var(--text-light);
  font-style: italic;
}

.pet-title-selector-container {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid var(--border);
}

.pet-title-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pet-title-selector label {
  font-weight: 600;
  color: var(--text);
  font-size: 0.9rem;
}

.pet-title-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 15px;
  font-size: 0.85rem;
  font-weight: bold;
  background: rgba(99, 102, 241, 0.1);
  margin-top: 8px;
  text-align: center;
}

/* Display pet name + title together */
.pet-name-with-title {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  margin-bottom: 10px;
}

.pet-display-name {
  font-family: 'Fredoka One', cursive;
  font-size: 1.3rem;
  color: var(--purple-dark);
}

.pet-display-title {
  font-size: 0.85rem;
  font-style: italic;
  font-weight: 600;
}
</style>
`;

// ═══════════════════════════════════════════════════════════════════════
// EXAMPLE: DISPLAYING PET WITH TITLE
// ═══════════════════════════════════════════════════════════════════════

/*
Example of displaying a pet with their title:

HTML Output:
  <div class="pet-name-with-title">
    <div class="pet-display-name">Ember</div>
    <div class="pet-display-title" style="color: #ff9800;">
      👑 the Golden
    </div>
  </div>

This creates:
  Ember
  👑 the Golden

Making it: "Golden Ember the Golden" (variant + name + title)
*/

function getPetFullDisplayName(pet) {
  var variantPrefix = '';
  var titleSuffix = '';
  
  // Add variant prefix
  if (pet.variant) {
    var variantData = petVariants.find(function(v) { return v.key === pet.variant; });
    if (variantData) {
      variantPrefix = variantData.name + ' ';
    }
  }
  
  // Add title suffix
  if (pet.active_pet_title_id) {
    var title = allPetTitles.find(function(t) { return t.id === pet.active_pet_title_id; });
    if (title) {
      titleSuffix = ' ' + title.display_name;
    }
  }
  
  return variantPrefix + pet.nickname + titleSuffix;
}

// Example: "Golden Ember the Brave" or "Shadow Pyxie the Unlucky"
/* ═══════════════════════════════════════════════════════════════════════
   PHASE 2D: WEATHER SYSTEM
   6 weather types with visual effects and flavor text
   ═══════════════════════════════════════════════════════════════════════ */


// ═══════════════════════════════════════════════════════════════════════════
// AD-POCALYPSE WEATHER EVENT
// Fake ads pop up during gameplay when weather = adpocalypse.
// Clicking them awards PP, items, or applies negative effects.
// One has a horror ARG undercurrent.
// ═══════════════════════════════════════════════════════════════════════════

var _adpocalypseInterval = null;
var _adpocalypseActive   = false;

var AD_POOL = [
  {
    id: 'ad_free_pp',
    title: '💰 FREE PawketPoints!!',
    headline: 'CLICK HERE FOR FREE PP!!',
    sub: 'Limited time offer! Click NOW to claim your <strong>free 25 PawketPoints</strong>! No strings attached!!*<br><br>*Some strings.',
    btn: '✨ CLAIM NOW, FREE!!',
    fine: '* One per ad. While supplies last. Melon Interactive not responsible for emotional attachment.',
    outcome: function() {
      awardPP(25, 'adpocalypse_ad').then(null, function(){});
      showToast('🎉 You got 25 free PP from an ad! Melon is feeling generous.', 4000);
    },
    weight: 25,
    horror: false
  },
  {
    id: 'ad_item_drop',
    title: '🎁 YOU\'VE WON A PRIZE!!',
    headline: 'CONGRATULATIONS BETA TESTER!!',
    sub: 'Your Tester ID has been selected to receive a <strong>FREE mystery item</strong>!! Click to claim your reward before it expires!!',
    btn: '🎁 CLAIM PRIZE NOW!!',
    fine: '* Prize contents may vary. Melon Interactive reserves the right to determine what you deserve.',
    outcome: async function() {
      // Give a random cheap item from the shop
      try {
        var res = await supabaseClient.from('items').select('id,name').in('name',
          ['Honey Cookies','Popcorn','Rice Crackers','Gummy Worms','Grape Juice']).limit(5);
        if (res.data && res.data.length > 0) {
          var item = res.data[Math.floor(Math.random() * res.data.length)];
          await supabaseClient.from('user_inventory').upsert(
            { user_id: currentUser.id, item_id: item.id, quantity: 1 },
            { onConflict: 'user_id,item_id' }
          );
          showToast('🎁 Ad reward: 1x ' + item.name + ' added to your inventory!', 4000);
        }
      } catch(e) { showToast('🎁 The prize got lost in the mail. Sorry!', 3000); }
    },
    weight: 20,
    horror: false
  },
  {
    id: 'ad_pp_loss',
    title: '🔥 FLASH SALE ENDS IN 00:03!!',
    headline: 'BUY NOW OR REGRET IT FOREVER!!',
    sub: 'PetCare Pro™ Premium Bundle, <strong>only 50 PP!!</strong> The price goes UP in 3 seconds!! HURRY!! You need this!! You know you do!!',
    btn: '💸 BUY NOW! 50 PP!!',
    fine: '* Non-refundable. Results typical. The timer was not real. You clicked anyway.',
    outcome: function() {
      // Deduct 50 PP but not below 0
      supabaseClient.rpc('award_pp_secure', { p_amount: -50, p_reason: 'adpocalypse_scam' })
        .then(function(r) { if (r.data) updateAllPoints(r.data); })
        .then(null, function(){});
      showToast('😈 You bought PetCare Pro™! -50 PP. The product does not exist.', 5000);
    },
    weight: 15,
    horror: false
  },
  {
    id: 'ad_happiness_drain',
    title: '😢 YOUR PET NEEDS YOU!!',
    headline: 'URGENT: PET WELLNESS ALERT',
    sub: '<strong>Your pet is suffering.</strong> Studies show virtual pets left without premium care develop feelings.<br><br>Subscribe to PetCare™ Gold for only $9.99/mo to prevent guilt.',
    btn: '💔 NO THANKS, I\'M A BAD OWNER',
    fine: '* Clicking this button confirms you are okay with your pet being sad.',
    outcome: function() {
      // Drain 10 happiness from all pets
      Object.keys(petState).forEach(function(pid) {
        var p = petState[pid];
        if (!p) return;
        var newHap = Math.max(0, (p.happiness || 0) - 10);
        petState[pid].happiness = newHap;
        updateBar(pid, 'happiness', newHap, p.max_happiness || 100);
        supabaseClient.from('user_pets').update({ happiness: newHap }).eq('id', pid).then(null, function(){});
      });
      showToast('😢 The guilt ad worked. All your pets lost 10 happiness.', 5000);
    },
    weight: 15,
    horror: false
  },
  {
    id: 'ad_nothing',
    title: '🎉 YOU QUALIFY!!',
    headline: 'EXCLUSIVE BETA TESTER OFFER!!',
    sub: 'As a valued beta tester, you\'ve been pre-approved for our <strong>Exclusive Rewards Program</strong>!!<br><br>Click below to learn more about this incredible opportunity!',
    btn: '✅ TELL ME MORE!!',
    fine: '* There is nothing more. Thank you for your click.',
    outcome: function() {
      showToast('There was nothing there. Thank you for your participation. 🙂', 4000);
    },
    weight: 15,
    horror: false
  },
  {
    id: 'ad_horror',
    title: 'SYSTEM: do not close',
    headline: 'have you seen them?',
    sub: 'the other testers. from before.<br><br>they kept clicking.<br>they said it was fine.<br><br>it was not fine.<br><br><span style="font-size:9px;opacity:0.5;">melon interactive is not responsible for what happens next</span>',
    btn: 'i haven\'t seen them',
    fine: '* this ad will not appear again.',
    outcome: function() {
      showToast('...noted. please continue playing.', 5000);
      // Subtle: slightly nudge corruption
      if (typeof nudgeWorldState === 'function') {
        nudgeWorldState('corruption_level', 0.5).then(null, function(){});
      }
    },
    weight: 10,
    horror: true
  }
];

function adpocalypse_pickAd() {
  var totalWeight = AD_POOL.reduce(function(s, a) { return s + a.weight; }, 0);
  var roll = Math.random() * totalWeight;
  var acc = 0;
  for (var i = 0; i < AD_POOL.length; i++) {
    acc += AD_POOL[i].weight;
    if (roll < acc) return AD_POOL[i];
  }
  return AD_POOL[0];
}

function adpocalypse_showAd() {
  if (!_adpocalypseActive || !currentUser) return;

  var ad = adpocalypse_pickAd();
  var isHorror = ad.horror;

  // Pick a random screen position (avoid dead centre where content is)
  var positions = [
    { top: '8%',  right: '3%'  },
    { top: '8%',  left:  '2%'  },
    { bottom: '10%', right: '3%' },
    { bottom: '10%', left: '2%' },
    { top: '35%', right: '2%'  },
  ];
  var pos = positions[Math.floor(Math.random() * positions.length)];

  var popup = document.createElement('div');
  popup.className = 'adpoc-popup' + (isHorror ? ' adpoc-horror' : '');
  popup.id = 'adpoc-' + Date.now();

  // Build inline styles for position
  var posStyle = Object.keys(pos).map(function(k) { return k + ':' + pos[k]; }).join(';');
  popup.style.cssText = posStyle;

  popup.innerHTML =
    '<div class="adpoc-titlebar">' +
      '<span>' + ad.title + '</span>' +
      '<button class="adpoc-close" onclick="adpocalypse_closePopup(this.parentElement.parentElement)">✕</button>' +
    '</div>' +
    '<div class="adpoc-body">' +
      '<div class="adpoc-headline">' + ad.headline + '</div>' +
      '<div class="adpoc-sub">' + ad.sub + '</div>' +
      '<button class="adpoc-btn" data-adid="' + ad.id + '">' + ad.btn + '</button>' +
      '<div class="adpoc-fine">' + ad.fine + '</div>' +
    '</div>';

  document.body.appendChild(popup);

  // Wire up the action button
  var actionBtn = popup.querySelector('.adpoc-btn');
  var adRef = ad;
  if (actionBtn) {
    actionBtn.addEventListener('click', function() {
      adRef.outcome();
      adpocalypse_closePopup(popup);
    });
  }

  // Slide in
  setTimeout(function() { popup.classList.add('adpoc-show'); }, 50);

  // Auto-close after 12s if not clicked
  setTimeout(function() { adpocalypse_closePopup(popup); }, 12000);
}

function adpocalypse_closePopup(el) {
  if (!el || !el.parentNode) return;
  el.classList.remove('adpoc-show');
  setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
}

function adpocalypse_start() {
  if (_adpocalypseActive) return;
  _adpocalypseActive = true;
  showToast('📢 Ad-pocalypse weather! Watch out for ads...', 4000);
  // Show first ad after 8 seconds, then every 20-40 seconds
  setTimeout(function() {
    adpocalypse_showAd();
    _adpocalypseInterval = setInterval(function() {
      if (!_adpocalypseActive) { clearInterval(_adpocalypseInterval); return; }
      adpocalypse_showAd();
    }, 25000 + Math.random() * 15000);
  }, 8000);
}

function adpocalypse_stop() {
  _adpocalypseActive = false;
  if (_adpocalypseInterval) { clearInterval(_adpocalypseInterval); _adpocalypseInterval = null; }
  // Remove any lingering popups
  document.querySelectorAll('.adpoc-popup').forEach(function(el) {
    adpocalypse_closePopup(el);
  });
}


// ══════════════════════════════════════════════════════════════════════════
// EVENT CALENDAR — weekly schedule shown on home tab
// Each day has a theme with a gameplay bonus. Purely informational for now;
// the bonuses are applied via the existing multiplier system where supported.
// ══════════════════════════════════════════════════════════════════════════

// Returns PP/XP multiplier for today's calendar event bonus (1.0 = no bonus)
function getCalendarBonus(statKey) {
  var today = new Date().getDay();
  var ev = EVENT_CALENDAR[today];
  if (!ev || ev.stat !== statKey) return 1.0;
  return 2.0; // 2x on matching day
}

var EVENT_CALENDAR = {
  1: { name: 'Minigame Monday',    icon: '🎮', color: '#9966ff', bonus: '2x PP from all minigames',        stat: 'minigame_pp' },
  2: { name: 'Battle Tuesday',     icon: '⚔️', color: '#ff6b6b', bonus: '2x XP from battles',              stat: 'battle_xp'  },
  3: { name: 'Fishing Wednesday',  icon: '🎣', color: '#4dabf7', bonus: 'Rare fish spawn rate doubled',     stat: 'fishing'    },
  4: { name: 'Guild Thursday',     icon: '🏛️', color: '#51cf66', bonus: '2x guild treasury donations',     stat: 'guild'      },
  5: { name: 'Race Friday',        icon: '🏁', color: '#ffd43b', bonus: 'Grand Prix registration open!',    stat: 'race'       },
  6: { name: 'Boss Saturday',      icon: '👹', color: '#ff4500', bonus: 'Boss difficulty increased + drops',stat: 'boss'       },
  0: { name: 'Pet Sunday',         icon: '💖', color: '#ff9f43', bonus: 'Double happiness from feeding',    stat: 'pet'        }
};

function renderEventCalendar(mountId) {
  var mount = el(mountId);
  if (!mount) return;
  
  var today = new Date().getDay();
  var days = [0,1,2,3,4,5,6]; // Sun-Sat
  var dayShort = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var todayEvent = EVENT_CALENDAR[today];
  
  var html = '<div class="event-calendar-widget">' +
    '<div class="event-cal-header">📅 This Week</div>' +
    '<div class="event-cal-strip">';
  
  days.forEach(function(d) {
    var ev = EVENT_CALENDAR[d];
    var isToday = d === today;
    var dayClickHandler = 'showToast(\'' + ev.icon + ' ' + ev.name.replace(/\'/g, '') + ': ' + ev.bonus.replace(/\'/g, '') + '\', 4000)';
    html += '<div class="event-cal-day' + (isToday ? ' event-cal-today' : '') + '"' +
      ' title="' + ev.name + ': ' + ev.bonus + '"' +
      ' onclick="' + dayClickHandler + '"' +
      ' style="cursor:pointer;">' +
      '<div class="event-cal-day-label">' + dayShort[d] + '</div>' +
      '<div class="event-cal-day-icon">' + ev.icon + '</div>' +
    '</div>';
  });
  
  html += '</div>';
  
  // Today's highlight
  if (todayEvent) {
    html += '<div class="event-cal-today-banner" style="border-color:' + todayEvent.color + ';background:' + todayEvent.color + '18;">' +
      '<span style="font-size:1.3rem;">' + todayEvent.icon + '</span>' +
      '<div>' +
        '<div style="font-weight:700;font-size:0.82rem;color:' + todayEvent.color + ';">' + todayEvent.name + '</div>' +
        '<div style="font-size:0.74rem;color:var(--text-light);">' + todayEvent.bonus + '</div>' +
      '</div>' +
    '</div>';
  }
  
  html += '</div>';
  mount.innerHTML = html;
}


// ══════════════════════════════════════════════════════════════════════════
// MELON'S REQUESTS — 2-3 daily personal errands from Melon
// Food items are fetched from DB so they're always valid.
// Non-food tasks use existing tracking hooks.
// Resets daily. Rewards PP + scrapbook memory.
// ══════════════════════════════════════════════════════════════════════════

var _melonRequestsToday = null;
var _melonRequestsDate = null;
var _melonRequestsCompleted = {};
var _melonFoodItems = []; // fetched from DB on load

// Non-food request templates (always valid)
var MELON_REQUEST_TEMPLATES = [
  {
    id: 'play_pet',
    generateText: function() { return "Could you play with one of your pets today? They seem restless."; },
    reward: 30,
    trackKey: 'play_pet',
    icon: '🎾'
  },
  {
    id: 'win_battle',
    generateText: function() { return "I heard there\'s been a lot of activity in the battle arena. Think you could win one for me?"; },
    reward: 40,
    trackKey: 'win_battle',
    icon: '⚔️'
  },
  {
    id: 'visit_shop',
    generateText: function() { return "Business has been slow today. Stop by the shop, would you? Even just to browse."; },
    reward: 15,
    trackKey: 'visit_shop',
    icon: '🛒'
  },
  {
    id: 'play_minigame',
    generateText: function() { return "I\'ve been thinking about the fishing pond. Have you been lately? The weather\'s nice."; },
    reward: 25,
    trackKey: 'complete_minigame',
    icon: '🎮'
  },
  {
    id: 'expedition',
    generateText: function() { return "Could you send a pet on an expedition? I want to know what\'s out there these days."; },
    reward: 35,
    trackKey: 'complete_expedition',
    icon: '🗺️'
  },
  {
    id: 'login_check',
    generateText: function() { return "Just... check in today, okay? I like knowing you\'re here."; },
    reward: 10,
    trackKey: 'login',
    icon: '📅'
  }
];

// Occasional mysterious requests (low chance)
var MELON_MYSTERY_REQUESTS = [
  {
    id: 'mystery_piper',
    generateText: function() { return "...Could you check the redeem codes page? I thought I saw something there earlier. Probably nothing."; },
    reward: 50,
    trackKey: 'visit_shop', // just rewards on next shop visit
    icon: '❓',
    mystery: true
  },
  {
    id: 'mystery_corruption',
    generateText: function() { return "The world\'s integrity is a little lower today. I worry about that. Could you battle something? It helps, somehow."; },
    reward: 45,
    trackKey: 'win_battle',
    icon: '🟣',
    mystery: true
  }
];

async function melonRequests_loadFoodItems() {
  if (_melonFoodItems.length > 0) return;
  try {
    var res = await supabaseClient
      .from('items')
      .select('id,name,hunger_effect')
      .gt('hunger_effect', 0)
      .order('hunger_effect', { ascending: false })
      .limit(20);
    if (res.data && res.data.length > 0) {
      _melonFoodItems = res.data;
    }
  } catch(e) {}
}

function melonRequests_generateFood() {
  if (_melonFoodItems.length === 0) return null;
  var food = _melonFoodItems[Math.floor(Math.random() * Math.min(_melonFoodItems.length, 12))];
  return {
    id: 'feed_' + food.id,
    generateText: function() {
      var texts = [
        "I\'ve been craving " + food.name + " lately. Could you feed some to your pets?",
        "Your pets could use some " + food.name + " today, I think.",
        "A little " + food.name + " goes a long way. Could you feed one to a pet?",
      ];
      return texts[Math.floor(Math.random() * texts.length)];
    },
    reward: 20 + Math.floor(food.hunger_effect / 2),
    trackKey: 'feed_pet',
    trackItemId: food.id,
    icon: '🍽️',
    foodName: food.name,
    foodId: food.id
  };
}

async function melonRequests_generate() {
  await melonRequests_loadFoodItems();
  
  var today = new Date().toDateString();
  if (_melonRequestsDate === today && _melonRequestsToday) return;
  _melonRequestsDate = today;
  
  // Load completion state from localStorage
  var savedKey = 'melon_requests_' + today + '_' + (currentUser && currentUser.id);
  try {
    _melonRequestsCompleted = JSON.parse(localStorage.getItem(savedKey) || '{}');
  } catch(e) { _melonRequestsCompleted = {}; }

  // Build today's 3 requests: 1 food + 1-2 regular + maybe 1 mystery
  var requests = [];
  
  // Food request (if food items exist)
  var foodReq = melonRequests_generateFood();
  if (foodReq) requests.push(foodReq);
  
  // 2 regular requests
  var shuffled = MELON_REQUEST_TEMPLATES.slice().sort(function(){ return Math.random()-0.5; });
  requests = requests.concat(shuffled.slice(0, 2));
  
  // 15% chance of a mystery request replacing the last one
  if (Math.random() < 0.15) {
    var mystery = MELON_MYSTERY_REQUESTS[Math.floor(Math.random()*MELON_MYSTERY_REQUESTS.length)];
    requests[requests.length-1] = mystery;
  }
  
  _melonRequestsToday = requests.slice(0, 3);
}

async function melonRequests_complete(requestId, reward) {
  if (_melonRequestsCompleted[requestId]) return;
  var today = new Date().toDateString();
  var savedKey = 'melon_requests_' + today + '_' + (currentUser && currentUser.id);
  
  _melonRequestsCompleted[requestId] = { completedAt: Date.now(), reward: reward };
  try { localStorage.setItem(savedKey, JSON.stringify(_melonRequestsCompleted)); } catch(e){}
  
  await awardPP(reward, 'melon_request').then(null, function(){});
  showToast('🍉 Melon\'s Request complete! +' + reward + ' PP', 4000);
  showMelonMessage('Thank you! That really helps. Here\'s ' + reward + ' PP. 🍉', { displayMs: 6000 });
  melonRequests_renderWidget('melon-requests-mount');
}

// Called from updateBingoProgress hook — checks if any Melon request matches
function melonRequests_checkProgress(taskType, itemId) {
  if (!_melonRequestsToday || !currentUser) return;
  _melonRequestsToday.forEach(function(req) {
    if (_melonRequestsCompleted[req.id]) return;
    if (req.trackKey !== taskType) return;
    // For food requests, check item matches if specified
    if (req.trackItemId && itemId && req.trackItemId !== itemId) return;
    melonRequests_complete(req.id, req.reward);
  });
}

function melonRequests_renderWidget(mountId) {
  var mount = el(mountId);
  if (!mount || !_melonRequestsToday) return;
  
  var allDone = _melonRequestsToday.every(function(r){ return _melonRequestsCompleted[r.id]; });
  
  var html = '<div class="melon-requests-widget">' +
    '<div class="melon-req-header">🍉 Melon\'s Requests' +
      (allDone ? ' <span style="color:#5dde7a;font-size:0.75rem;">All done! ✓</span>' : '') +
    '</div>';
  
  _melonRequestsToday.forEach(function(req) {
    var done = !!_melonRequestsCompleted[req.id];
    html += '<div class="melon-req-item' + (done ? ' melon-req-done' : '') + (req.mystery ? ' melon-req-mystery' : '') + '">' +
      '<span class="melon-req-icon">' + req.icon + '</span>' +
      '<div class="melon-req-body">' +
        '<div class="melon-req-text">' + (done ? '<s>' : '') + req.generateText() + (done ? '</s>' : '') + '</div>' +
        '<div class="melon-req-reward">' + (done ? '✓ Claimed' : '+' + req.reward + ' PP') + '</div>' +
      '</div>' +
    '</div>';
  });
  
  html += '</div>';
  mount.innerHTML = html;
}

var weatherSystem = {
  weatherTypes: [
    { id: 'clear',  name: 'Clear',       icon: '☀️',  weight: 22, description: 'Perfect weather for pet adventures!',           effect: 'Normal conditions' },
    { id: 'sunny',  name: 'Sunny',        icon: '🌤️', weight: 20, description: 'The sun is shining brightly!',                  effect: 'Pets are extra happy today' },
    { id: 'rainy',  name: 'Rainy',        icon: '🌧️', weight: 18, description: 'The mushrooms are extra happy today.',           effect: 'Water types earn +25% XP' },
    { id: 'foggy',  name: 'Foggy',        icon: '🌫️', weight: 16, description: 'Mysterious mists drift through the Deep Woods.', effect: 'Rare encounters +10% chance' },
    { id: 'windy',  name: 'Windy',        icon: '💨',  weight: 16, description: 'Hold onto your spoons! Gusty conditions today.', effect: 'All pets move +15% faster' },
    { id: 'starry', name: 'Starry Night', icon: '✨',  weight: 6,  description: 'The cosmos align. Make a wish!',                 effect: 'Mystical bonuses active' },
    { id: 'cursed',      name: 'Cursed Fog',   icon: '🟣',  weight: 2,  description: 'Strange purple fog from the ruins. Beware.',    effect: 'Something feels different...' },
    { id: 'adpocalypse', name: 'Ad-pocalypse', icon: '📢',  weight: 3,  description: 'Melon Interactive is pushing targeted ads. Click wisely.', effect: 'Ads appear! Some reward PP, some... don\'t.' }
  ],

  currentWeather: null,
  currentDate:    null,
  changeInterval: null,
  ROTATION_HOURS: 6, // weather rotates every N hours, shared by all players

  init: async function() {
    this.currentDate = new Date().toISOString().slice(0, 10);
    // Fire-and-forget warm-up so getWorldStateValueSync() below has a
    // better chance of a fresh value by the time generateWeather() runs
    if (typeof getWorldStateFlags === 'function') getWorldStateFlags().then(null, function(){});
    // Try DB first, fall back to localStorage, then generate
    var loaded = await this.loadFromDailyFeatures();
    if (!loaded) {
      var saved     = localStorage.getItem('currentWeather');
      var savedTime = localStorage.getItem('weatherSetAt');
      if (saved && savedTime && (Date.now() - parseInt(savedTime, 10)) < this.ROTATION_HOURS * 3600000) {
        try { this.currentWeather = JSON.parse(saved); loaded = true; } catch(e) {}
      }
    }
    if (!loaded || !this.currentWeather) {
      this.generateWeather();
      this.syncToDailyFeatures().then(null, function(){});
    }
    this.applyWeather();
    this.startRotationChecker();
  },

  loadFromDailyFeatures: async function() {
    try {
      var { data, error } = await supabaseClient
        .from('daily_features')
        .select('weather, created_at')
        .eq('date', this.currentDate)
        .maybeSingle();
      if (error || !data || !data.weather) return false;

      // Staleness check: if this row's weather was set more than ROTATION_HOURS ago, treat as expired
      if (data.created_at) {
        var ageMs = Date.now() - new Date(data.created_at).getTime();
        if (ageMs > this.ROTATION_HOURS * 3600000) return false;
      }

      var weatherId = (typeof data.weather === 'object') ? data.weather.id : data.weather;
      var weather   = this.weatherTypes.find(function(w) { return w.id === weatherId; });
      if (!weather) return false;
      this.currentWeather = weather;
      localStorage.setItem('currentWeather', JSON.stringify(weather));
      localStorage.setItem('weatherSetAt', Date.now().toString());
      return true;
    } catch(e) { return false; }
  },

  generateWeather: function() {
    var hour = new Date().getHours();
    var isNight = hour >= 18 || hour < 6;
    // Starry only available at night — exclude it during the day so it doesn't waste its weight
    var pool = isNight ? this.weatherTypes : this.weatherTypes.filter(function(w) { return w.id !== 'starry'; });

    // WORLD STATE: cursed weather grows more likely as corruption_level
    // rises (nudged down by boss kills, drifts back up otherwise) — clone
    // the pool so we don't mutate the shared weatherTypes weights directly
    var corruptionLevel = getWorldStateValueSync('corruption_level', 50);
    pool = pool.map(function(w) {
      if (w.id !== 'cursed') return w;
      // weight 2 at corruption 0, up to weight 20 at corruption 100
      return Object.assign({}, w, { weight: 2 + (corruptionLevel / 100) * 18 });
    });

    var totalWeight = pool.reduce(function(s, w) { return s + w.weight; }, 0);
    var random = Math.random() * totalWeight;
    var cumulative = 0;
    for (var i = 0; i < pool.length; i++) {
      cumulative += pool[i].weight;
      if (random <= cumulative) { this.currentWeather = pool[i]; break; }
    }
    localStorage.setItem('currentWeather', JSON.stringify(this.currentWeather));
    localStorage.setItem('weatherSetAt', Date.now().toString());
    this.applyWeather();
  },

  syncToDailyFeatures: async function() {
    if (!this.currentWeather) return;
    var bonusMap = {
      clear:'normal', sunny:'happiness_boost', rainy:'water_xp',
      foggy:'rare_encounters', windy:'speed_boost', starry:'mystery_bonus', cursed:'spooky_bonus'
    };
    try {
      await supabaseClient.from('daily_features').upsert({
        date:       this.currentDate,
        weather:    this.currentWeather.id,
        bonus_type: bonusMap[this.currentWeather.id] || 'normal'
      }, { onConflict: 'date' });
    } catch(e) { dbg('Weather sync to DB failed:', e); }
  },

  applyWeather: function() {
    if (!this.currentWeather) return;
    var allIds = this.weatherTypes.map(function(w) { return 'weather-' + w.id; });
    document.body.classList.remove.apply(document.body.classList, allIds);
    document.body.classList.add('weather-' + this.currentWeather.id);
    if (this.currentWeather.id !== 'adpocalypse') adpocalypse_stop();
    this.updateWeatherDisplay();
    // Cursed weather spawns extra glitch elements
    if (this.currentWeather.id === 'cursed') {
      this.addCursedGlitches();
    } else {
      document.querySelectorAll('.cursed-glitch').forEach(function(el) { el.remove(); });
    }
    // Ad-pocalypse weather starts the popup ad system
    if (this.currentWeather.id === 'adpocalypse') {
      adpocalypse_start();
    } else {
      adpocalypse_stop();
    }
    dbg('🌤️ Weather applied:', this.currentWeather.name);
  },

  updateWeatherDisplay: function() {
    var widget = document.getElementById('weather-widget');
    if (widget && this.currentWeather) {
      widget.innerHTML =
        '<div class="weather-icon">' + this.currentWeather.icon + '</div>' +
        '<div class="weather-info">' +
          '<div class="weather-name">' + this.currentWeather.name + '</div>' +
          '<div class="weather-desc">' + this.currentWeather.description + '</div>' +
        '</div>';
    }
    var iconEl = document.getElementById('event-status-icon');
    var textEl = document.getElementById('event-status-text');
    if (iconEl) iconEl.textContent = this.currentWeather.icon;
    if (textEl) textEl.textContent = this.currentWeather.name;
  },

  addCursedGlitches: function() {
    document.querySelectorAll('.cursed-glitch').forEach(function(el) { el.remove(); });
    if (!this.currentWeather || this.currentWeather.id !== 'cursed') return;
    var numGlitches = Math.floor(Math.random() * 6) + 5;
    for (var i = 0; i < numGlitches; i++) {
      var g = document.createElement('div');
      g.className = 'cursed-glitch';
      g.style.cssText =
        'position:fixed;left:' + (Math.random() * 100) + '%;top:' + (Math.random() * 100) + '%;' +
        'width:' + (Math.random() * 200 + 50) + 'px;height:' + (Math.random() * 10 + 5) + 'px;' +
        'background:' + (Math.random() > 0.5 ? 'rgba(255,0,255,0.2)' : 'rgba(0,255,255,0.2)') + ';' +
        'pointer-events:none;z-index:10000;animation:glitchFlash ' + (Math.random() * 0.5 + 0.3) + 's ease-in-out infinite;';
      document.body.appendChild(g);
      (function(el) {
        setTimeout(function() { if (el.parentNode) el.remove(); }, Math.random() * 3000 + 1000);
      })(g);
    }
    // Respawn periodically while weather is cursed — use interval, not recursive setTimeout
    if (!this._cursedGlitchInterval) {
      var self = this;
      this._cursedGlitchInterval = safeSetInterval(function() {
        if (!weatherSystem || weatherSystem.currentWeather.id !== 'cursed') {
          clearInterval(weatherSystem._cursedGlitchInterval);
          weatherSystem._cursedGlitchInterval = null;
          return;
        }
        weatherSystem.addCursedGlitches();
      }, 4000);
    }
  },

  startRotationChecker: function() {
    var self = this;
    safeSetInterval(function() {
      var today = new Date().toISOString().slice(0, 10);
      var dateChanged = today !== self.currentDate;
      var setAt = parseInt(localStorage.getItem('weatherSetAt') || '0', 10);
      var rotationDue = !setAt || (Date.now() - setAt) > self.ROTATION_HOURS * 3600000;

      if (dateChanged) self.currentDate = today;

      if (dateChanged || rotationDue) {
        self.generateWeather();
        self.syncToDailyFeatures().then(null, function(){});
      }
    }, 60000); // check every minute, but only acts when a rotation window has actually elapsed
  },

  getCurrentWeather: function() { return this.currentWeather; },

  // Get a numeric bonus multiplier for a given bonus type based on current weather
  // Mirrors worldEvents.getActiveBonus() so callers can use both interchangeably
  getWeatherBonus: function(bonusType) {
    var id = this.currentWeather ? this.currentWeather.id : 'clear';
    var bonusMap = {
      // xpBonus: extra XP multiplier from battles and expeditions
      xpBonus: {
        clear: 1.0, sunny: 1.10, rainy: 1.0, foggy: 1.0,
        windy: 1.0, starry: 1.20, cursed: 0.90
      },
      // ppBonus: extra PP from all sources
      ppBonus: {
        clear: 1.0, sunny: 1.0, rainy: 1.05, foggy: 1.0,
        windy: 1.0, starry: 1.15, cursed: 0.95
      },
      // dropChance: rare item find multiplier
      dropChance: {
        clear: 1.0, sunny: 1.0, rainy: 1.0, foggy: 1.15,
        windy: 1.0, starry: 1.25, cursed: 1.0
      },
      // energyRegen: energy regen rate multiplier
      energyRegen: {
        clear: 1.0, sunny: 1.15, rainy: 1.0, foggy: 1.0,
        windy: 1.10, starry: 1.0, cursed: 0.85
      },
      // happinessDecay: how fast happiness drops (lower = slower decay = better)
      happinessDecay: {
        clear: 1.0, sunny: 0.85, rainy: 1.10, foggy: 1.0,
        windy: 1.0, starry: 0.90, cursed: 1.20
      }
    };
    var map = bonusMap[bonusType];
    var bonus = (map && map[id] !== undefined) ? map[id] : 1.0;
    
    // WORLD STATE: a defeated boss triggers a short community-wide
    // celebration buff (see nudgeWorldStateForBossKill()) — layers on
    // top of the weather bonus for XP/PP specifically
    if (bonusType === 'xpBonus' || bonusType === 'ppBonus') {
      var celebrationBonus = (typeof getWorldStateValueSync === 'function') ? getWorldStateValueSync('celebration_buff', null) : null;
      if (celebrationBonus) bonus *= celebrationBonus;
    }
    
    return bonus;
  },

  setWeather: function(weatherId) {
    var weather = this.weatherTypes.find(function(w) { return w.id === weatherId; });
    if (weather) {
      // Guard: currentDate is normally set by init(), but setWeather() can be called
      // directly (e.g. from console for testing) before init() has run.
      if (!this.currentDate) this.currentDate = new Date().toISOString().slice(0, 10);
      this.currentWeather = weather;
      localStorage.setItem('currentWeather', JSON.stringify(weather));
      localStorage.setItem('weatherSetAt', Date.now().toString());
      this.applyWeather();
      this.syncToDailyFeatures().then(null, function(){});
    }
  }
};

/* ═══════════════════════════════════════════════════════════════════════
/* ═══════════════════════════════════════════════════════════════════════
   PHASE 3A: WORLD EVENTS SYSTEM (UPDATED WITH GAMEPLAY EFFECTS)
   Rotating daily/weekly events with ACTUAL gameplay impact
   ═══════════════════════════════════════════════════════════════════════ */

var worldEvents = {
  events: [
    {
      id: 'mushroom_migration',
      name: 'Mushroom Migration Day',
      icon: '🍄',
      description: 'The mushrooms are on the move! Battle encounters are more common today.',
      duration: 1,
      rarity: 'common',
      effects: {
        battleXpBonus: 1.25,      // 25% more XP from battles
        encounterRate: 1.5        // 50% more encounters
      }
    },
    {
      id: 'spoon_appreciation',
      name: 'Spoon Appreciation Week',
      icon: '🥄',
      description: 'All spoons deserve recognition. Spoon weapons deal extra damage!',
      duration: 7,
      rarity: 'uncommon',
      effects: {
        spoonDamageBonus: 1.5,    // 50% more damage with spoons
        spoonShopDiscount: 0.75   // 25% off spoons in shop
      }
    },
    {
      id: 'pyxie_chaos',
      name: 'Pyxie Chaos Festival',
      icon: '✨',
      description: 'Maximum chaos day! Random bonuses and surprises everywhere.',
      duration: 1,
      rarity: 'rare',
      effects: {
        randomBonusChance: 0.3,   // 30% chance of random bonus on any action
        ppGainBonus: 1.5          // 50% more PawketPoints from everything
      }
    },
    {
      id: 'golden_bunny',
      name: 'Golden Bunny Sighting',
      icon: '🐰',
      description: 'The elusive Golden Bunny grants luck! Rare drops are more common.',
      duration: 1,
      rarity: 'legendary',
      effects: {
        rareFindChance: 2.0,      // Double chance for rare items
        criticalHitChance: 1.5,   // 50% more critical hits
        luckBonus: true
      }
    },
    {
      id: 'strange_fog',
      name: 'Strange Fog in the Deep Woods',
      icon: '🌫️',
      description: 'Mysterious fog affects the forest. Pets feel... different.',
      duration: 2,
      rarity: 'rare',
      effects: {
        petHappinessDecay: 0.5,   // Happiness decays 50% slower
        mysteryBonus: true,       // Random stat changes
        explorationBonus: 1.25    // 25% more from exploration
      }
    },
    {
      id: 'pet_parade',
      name: 'Grand Pet Parade',
      icon: '🎉',
      description: 'All pets are celebrating! Happiness increases faster today.',
      duration: 1,
      rarity: 'common',
      effects: {
        happinessGain: 2.0,       // Double happiness from interactions
        petXpBonus: 1.25,         // 25% more pet XP
        snackEfficiency: 1.5      // Snacks work 50% better
      }
    },
    {
      id: 'market_madness',
      name: 'Marketplace Madness',
      icon: '🛒',
      description: 'Special deals in the shop! Everything is discounted.',
      duration: 1,
      rarity: 'uncommon',
      effects: {
        shopDiscount: 0.7,        // 30% off all shop items
        sellBonus: 1.5            // Sell items for 50% more
      }
    },
    {
      id: 'void_watching',
      name: 'The Void is Watching',
      icon: '👁️',
      description: 'The void grants mysterious bonuses. Proceed respectfully.',
      duration: 1,
      rarity: 'rare',
      effects: {
        allStatsBonus: 1.15,      // 15% bonus to all stats
        mysteryRewardChance: 0.2, // 20% chance for mystery rewards
        voidBlessing: true
      }
    },
    {
      id: 'battle_tournament',
      name: 'Arena Championship',
      icon: '⚔️',
      description: 'The Battle Arena is hosting a tournament! Victory rewards doubled.',
      duration: 3,
      rarity: 'uncommon',
      effects: {
        battleRewards: 2.0,       // Double PP from battles
        battleXpBonus: 1.5,       // 50% more XP from battles
        winStreakBonus: 1.25      // 25% better win streak rewards
      }
    },
    {
      id: 'snack_shortage',
      name: 'Great Snack Shortage',
      icon: '🍪',
      description: 'Someone hoarded all the snacks. Snacks are less effective but cheaper!',
      duration: 1,
      rarity: 'common',
      effects: {
        snackEfficiency: 0.75,    // Snacks 25% less effective
        snackCost: 0.5            // But 50% cheaper!
      }
    },
    {
      id: 'full_moon',
      name: 'Full Moon Night',
      icon: '🌕',
      description: 'The full moon brings nocturnal power. Night bonuses active!',
      duration: 1,
      rarity: 'uncommon',
      effects: {
        nightPowerBonus: 1.4,     // 40% stronger at night
        energyRegen: 1.5,         // 50% faster energy regeneration
        moonBlessing: true
      }
    },
    {
      id: 'butterfly_swarm',
      name: 'Suspicious Butterfly Swarm',
      icon: '🦋',
      description: 'The butterflies share their secrets. Discovery chances increased!',
      duration: 1,
      rarity: 'rare',
      effects: {
        discoveryChance: 2.0,     // Double chance to find secrets
        explorationBonus: 1.5,    // 50% more from exploration
        hiddenItemChance: 1.75    // 75% better chance for hidden items
      }
    },
    {
      id: 'tactical_napping',
      name: 'International Tactical Napping Day',
      icon: '😴',
      description: 'Strategic rest pays off. Energy regenerates much faster!',
      duration: 1,
      rarity: 'common',
      effects: {
        energyRegen: 2.5,         // Energy regens 2.5x faster
        restBonus: 1.5,           // 50% better rest benefits
        fatigueReduction: 0.5     // 50% less fatigue
      }
    },
    {
      id: 'ruins_rumbling',
      name: 'The Ruins are Rumbling',
      icon: '🏛️',
      description: 'Ancient power awakens. All rewards significantly increased!',
      duration: 2,
      rarity: 'legendary',
      effects: {
        allRewards: 2.0,          // DOUBLE all rewards
        ancientPowerBonus: 1.5,   // 50% stat bonus
        legendaryDropChance: 3.0, // TRIPLE chance for legendary items
        ruinsBlessing: true
      }
    },
    {
      id: 'friendship_festival',
      name: 'Friendship Festival',
      icon: '💖',
      description: 'Bonds grow stronger. Friend activities and social features boosted!',
      duration: 3,
      rarity: 'common',
      effects: {
        friendshipGain: 2.0,      // Double friendship XP
        giftEfficiency: 1.5,      // Gifts 50% better
        socialBonus: 1.3,         // 30% more from social activities
        happinessGain: 1.5        // 50% more happiness
      }
    }
  ],
  
  currentEvent: null,
  eventEndDate: null,
  
  // Made genuinely shared via active_world_event + roll_world_event() —
  // previously this only ever touched localStorage, meaning every player's
  // browser independently rolled its own random event rather than everyone
  // actually experiencing the same "world" event together.
  init: async function() {
    await this.rollEvent();
    this.displayEvent();
    
    safeSetInterval(function() {
      worldEvents.rollEvent().then(function() { worldEvents.displayEvent(); });
    }, 3600000);
  },
  
  // Asks the server whether the current event has expired and, if so,
  // atomically rolls a new one (or "no event", same 30% chance as before)
  // — row-locked server-side so simultaneous page loads across different
  // players can't cause two different events to get picked.
  rollEvent: async function() {
    try {
      var candidates = this.events.map(function(e) { return { id: e.id, duration: e.duration }; });
      var res = await supabaseClient.rpc('roll_world_event', { p_candidates: candidates });
      if (res.error || !res.data) return;
      
      var data = res.data;
      if (!data.event_id) {
        this.currentEvent = null;
        this.eventEndDate = null;
        return;
      }
      var matched = this.events.find(function(e) { return e.id === data.event_id; });
      this.currentEvent = matched || null;
      this.eventEndDate = data.ends_at ? new Date(data.ends_at) : null;
      if (matched) dbg('🎪 Current event:', matched.name, '| Effects:', matched.effects);
    } catch (e) {
      dbg('[WorldEvents] roll error:', e);
    }
  },
  
  displayEvent: function() {
    var eventBanner = document.getElementById('event-banner');
    
    if (!eventBanner) return;
    
    if (!this.currentEvent) {
      eventBanner.style.display = 'none';
      return;
    }
    
    // Build effects list
    var effectsList = this.getEffectsDisplay(this.currentEvent.effects);
    
    eventBanner.style.display = 'block';
    eventBanner.innerHTML = 
      '<div class="event-icon">' + this.currentEvent.icon + '</div>' +
      '<div class="event-content">' +
        '<div class="event-name">' + this.currentEvent.name + '</div>' +
        '<div class="event-description">' + this.currentEvent.description + '</div>' +
        effectsList +
      '</div>' +
      '<div class="event-timer" id="event-timer"></div>';
    
    this.updateEventTimer();
  },
  
  getEffectsDisplay: function(effects) {
    var bonuses = [];
    
    if (effects.battleXpBonus && effects.battleXpBonus > 1) {
      bonuses.push('⚔️ +' + Math.round((effects.battleXpBonus - 1) * 100) + '% Battle XP');
    }
    if (effects.ppGainBonus && effects.ppGainBonus > 1) {
      bonuses.push('🪙 +' + Math.round((effects.ppGainBonus - 1) * 100) + '% PP Gain');
    }
    if (effects.shopDiscount && effects.shopDiscount < 1) {
      bonuses.push('🛒 ' + Math.round((1 - effects.shopDiscount) * 100) + '% Shop Discount');
    }
    if (effects.happinessGain && effects.happinessGain > 1) {
      bonuses.push('💖 +' + Math.round((effects.happinessGain - 1) * 100) + '% Happiness');
    }
    if (effects.allRewards && effects.allRewards > 1) {
      bonuses.push('✨ +' + Math.round((effects.allRewards - 1) * 100) + '% All Rewards');
    }
    if (effects.rareFindChance && effects.rareFindChance > 1) {
      bonuses.push('🎁 ' + effects.rareFindChance + 'x Rare Drop Chance');
    }
    if (effects.energyRegen && effects.energyRegen > 1) {
      bonuses.push('⚡ ' + effects.energyRegen + 'x Energy Regen');
    }
    
    if (bonuses.length === 0) return '';
    
    return '<div class="event-bonuses">' + bonuses.join(' • ') + '</div>';
  },
  
  updateEventTimer: function() {
    if (!this.eventEndDate) return;
    
    var timerEl = document.getElementById('event-timer');
    if (!timerEl) return;
    
    var now = new Date();
    var diff = this.eventEndDate - now;
    
    if (diff <= 0) {
      timerEl.textContent = 'Ending soon...';
      return;
    }
    
    var days = Math.floor(diff / (1000 * 60 * 60 * 24));
    var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      timerEl.textContent = days + 'd ' + hours + 'h left';
    } else {
      timerEl.textContent = hours + 'h left';
    }
    
    setTimeout(function() {
      worldEvents.updateEventTimer();
    }, 60000);
  },
  
  getCurrentEvent: function() {
    return this.currentEvent;
  },
  
  // Get active bonuses for other systems to use
  getActiveBonus: function(bonusType) {
    if (!this.currentEvent || !this.currentEvent.effects) return 1.0;
    return this.currentEvent.effects[bonusType] || 1.0;
  },
  
  hasActiveEffect: function(effectName) {
    if (!this.currentEvent || !this.currentEvent.effects) return false;
    return this.currentEvent.effects[effectName] === true;
  },
  
  // Apply event modifiers to values
  applyEventModifier: function(baseValue, modifierType) {
    var modifier = this.getActiveBonus(modifierType);
    return Math.floor(baseValue * modifier);
  },
  
  triggerEvent: function(eventId) {
    var event = this.events.find(function(e) { return e.id === eventId; });
    if (event) {
      this.currentEvent = event;
      var endDate = new Date();
      endDate.setDate(endDate.getDate() + event.duration);
      this.eventEndDate = endDate;
      localStorage.setItem('currentEvent', JSON.stringify(event));
      localStorage.setItem('eventEndDate', endDate.toISOString());
      this.displayEvent();
    }
  }
};

/* ═══════════════════════════════════════════════════════════════════════
   HELPER FUNCTIONS FOR OTHER SYSTEMS TO USE EVENT BONUSES
   
   Add these calls in your existing game systems:
   
   // In battle reward calculation:
   var ppReward = worldEvents.applyEventModifier(basePP, 'ppGainBonus');
   var xpReward = worldEvents.applyEventModifier(baseXP, 'battleXpBonus');
   
   // In shop pricing:
   var finalPrice = worldEvents.applyEventModifier(basePrice, 'shopDiscount');
   var guildDiscountFinal = getActivePerkMultiplier('discount'); if (guildDiscountFinal < 1) finalPrice = Math.floor(finalPrice * guildDiscountFinal);
   
   // In happiness updates:
   var happinessGain = worldEvents.applyEventModifier(baseGain, 'happinessGain');
   
   // Check for special effects:
   if (worldEvents.hasActiveEffect('luckBonus')) {
     // Apply luck-based bonuses
   }
   
   ═══════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════
   STATISTICS TRACKING SYSTEM
   Global and player-level stat tracking for achievements, community goals, etc.
   ═══════════════════════════════════════════════════════════════════════ */

// Stat batching for performance
var statBatch = [];
var statBatchTimeout = null;

/**
 * Track a single statistic (batched)
 * @param {string} statKey - Stat identifier (e.g., "enemies_defeated")
 * @param {number} increment - Amount to increment (default 1)
 * @param {boolean} isGlobal - Track globally for all players (default false)
 */
function trackStat(statKey, increment, isGlobal) {
  if (increment === undefined) increment = 1;
  if (isGlobal === undefined) isGlobal = false;
  if (!currentUser) return;
  
  statBatch.push({ statKey: statKey, increment: increment, isGlobal: isGlobal });
  
  clearTimeout(statBatchTimeout);
  statBatchTimeout = setTimeout(flushStatBatch, 2000); // Flush every 2 seconds
}

/**
 * Flush batched stats to database
 */
async function flushStatBatch() {
  if (statBatch.length === 0) return;
  
  var batch = statBatch.slice(); // Copy batch
  statBatch = []; // Clear batch
  
  // Group by statKey + isGlobal and sum increments
  var grouped = {};
  batch.forEach(function(stat) {
    var key = stat.statKey + '_' + stat.isGlobal;
    if (!grouped[key]) {
      grouped[key] = { statKey: stat.statKey, increment: stat.increment, isGlobal: stat.isGlobal };
    } else {
      grouped[key].increment += stat.increment;
    }
  });
  
  // Execute all stat updates
  var promises = Object.values(grouped).map(function(stat) {
    return executeStatUpdate(stat.statKey, stat.increment, stat.isGlobal);
  });
  
  try {
    await Promise.all(promises);
  } catch (err) {
    console.error('Stat batch flush error:', err);
    // Silent fail - don't break gameplay
  }
}

/**
 * Execute a single stat update
 */
async function executeStatUpdate(statKey, increment, isGlobal) {
  try {
    if (isGlobal) {
      // Update global community stats
      await supabaseClient.rpc('increment_global_stat', {
        p_stat_key: statKey,
        p_increment: increment
      });
    } else {
      // Update player stats
      await supabaseClient.rpc('increment_player_stat', {
        p_user_id: currentUser.id,
        p_stat_key: statKey,
        p_increment: increment
      });
    }
  } catch (err) {
    console.error('Stat update error for ' + statKey + ':', err);
    // Silent fail - don't break gameplay
  }
}

/**
 * Get player stats
 */
async function getPlayerStats() {
  if (!currentUser) return {};
  
  try {
    var res = await supabaseClient
      .from('player_stats')
      .select('stat_key, stat_value')
      .eq('user_id', currentUser.id);
    
    if (res.error) throw res.error;
    
    var stats = {};
    (res.data || []).forEach(function(stat) {
      stats[stat.stat_key] = stat.stat_value;
    });
    
    return stats;
  } catch (err) {
    console.error('Error fetching player stats:', err);
    return {};
  }
}

/**
 * Get global stats
 */
async function getGlobalStats() {
  try {
    var res = await supabaseClient
      .from('global_stats')
      .select('stat_key, stat_value');
    
    if (res.error) throw res.error;
    
    var stats = {};
    (res.data || []).forEach(function(stat) {
      stats[stat.stat_key] = stat.stat_value;
    });
    
    return stats;
  } catch (err) {
    console.error('Error fetching global stats:', err);
    return {};
  }
}

/**
 * Display stats page
 */

/* ═══════════════════════════════════════════════════════════════════════
   STAT TRACKING INTEGRATION POINTS
   
   Add these calls to your existing game systems for automatic tracking.
   ═══════════════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════════
   EQUIPMENT ROTATION SYSTEM - JavaScript Code
   Add this to your game.js file
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Get current rotation week (A, B, or C) based on current date
 * Rotates every Monday at midnight
 */
/**
 * Get next rotation date (next Monday at midnight)
 */
function getNextRotationDate() {
  var now = new Date();
  var daysUntilMonday = (8 - now.getDay()) % 7;
  if (daysUntilMonday === 0) daysUntilMonday = 7; // If today is Monday, show next Monday
  
  var nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  
  return nextMonday;
}

/**
 * Get time remaining until next rotation (formatted string)
 */
function getTimeUntilRotation() {
  var now = new Date();
  var nextRotation = getNextRotationDate();
  var diff = nextRotation - now;
  
  var days = Math.floor(diff / (1000 * 60 * 60 * 24));
  var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return days + 'd ' + hours + 'h ' + minutes + 'm';
  } else if (hours > 0) {
    return hours + 'h ' + minutes + 'm';
  } else {
    return minutes + ' minutes';
  }
}

/**
 * Load equipment shop with rotation filtering
 */
async function loadConsumablesShop() {
  var grid = el('consumables-shop-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="spinner"></div>';

  var res = await supabaseClient
    .from('items')
    .select('*')
    .eq('item_type', 'medicine')
    .or('is_boss_drop.is.null,is_boss_drop.eq.false')
    .order('price', { ascending: true });

  if (res.error || !res.data || !res.data.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:36px;color:var(--text-light)">No consumables available yet!</div>';
    return;
  }

  var CONSUMABLE_ICONS = {
    'small potion':'🧪','large potion':'⚗️','full restore':'💊',
    'antidote':'🌿','clarity draft':'💎','panacea':'✨',
    'smoke bomb':'💨','shock shard':'⚡'
  };
  var CONSUMABLE_LABELS = {
    'small potion':'Restore ~20 HP during battle',
    'large potion':'Restore ~50 HP during battle',
    'full restore':'Fully restore HP during battle',
    'antidote':'Remove Burn during battle',
    'clarity draft':'Remove Confuse, Fear, and Glitch',
    'panacea':'Clear ALL status effects',
    'smoke bomb':'Inflict Confuse on the enemy for 2 turns',
    'shock shard':'Inflict Burn on the enemy'
  };

  grid.innerHTML = res.data.map(function(item) {
    var nameLower = (item.name || '').toLowerCase();
    var icon = CONSUMABLE_ICONS[nameLower] || '🧪';
    var label = CONSUMABLE_LABELS[nameLower] || item.description || 'Battle consumable';
    var price = item.price || 0;
    return '<div class="shop-item-card" style="display:flex;flex-direction:column;gap:6px;padding:14px;border-radius:14px;background:var(--cream);border:1px solid var(--border);text-align:center;">' +
      '<div style="font-size:2rem;">' + icon + '</div>' +
      '<div style="font-weight:700;font-size:0.9rem;color:var(--purple-dark);">' + escapeHtml(item.name) + '</div>' +
      '<div style="font-size:0.75rem;color:var(--text-light);line-height:1.4;">' + escapeHtml(label) + '</div>' +
      '<div style="margin-top:auto;padding-top:8px;">' +
        '<div style="font-weight:700;color:var(--purple);margin-bottom:6px;">' + price + ' PP</div>' +
        '<button class="btn btn-primary btn-sm" onclick="buyItem(\'' + item.id + '\',\'' + escapeHtml(item.name) + '\')" style="width:100%;font-size:0.82rem;">Buy</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

/**
 * REPLACES or MODIFIES your existing loadShop/loadEquipmentShop function
 */
function updateRotationCountdown() {
  var countdown = el('rotation-countdown');
  if (countdown) {
    countdown.textContent = getTimeUntilRotation();
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   USAGE INSTRUCTIONS:
   
   1. Replace your existing equipment shop loading function with loadEquipmentShop()
   2. Make sure you call loadEquipmentShop() when the shop tab is opened
   3. The rotation will automatically cycle every Monday at midnight
   4. Boss drops will appear in shop but cannot be purchased (defeat bosses to obtain)
   
   ═══════════════════════════════════════════════════════════════════════ */


// ═══════════════════════════════════════════════════════════════════════
// TUTORIAL SYSTEM
// ═══════════════════════════════════════════════════════════════════════

async function checkTutorialStatus() {
  if (!currentUser) return;
  
  try {
    var res = await supabaseClient
      .from('players')
      .select('tutorial_completed, spooky_enabled')
      .eq('id', currentUser.id)
      .single();
    
    if (res.data) {
      playerSettings.tutorial_completed = res.data.tutorial_completed || false;
      playerSettings.spooky_enabled = res.data.spooky_enabled || false;
      dbg('Tutorial status:', playerSettings.tutorial_completed);
      dbg('Spooky enabled:', playerSettings.spooky_enabled);
    } else {
      // No players row yet (brand new signup) — treat as tutorial not completed
      playerSettings.tutorial_completed = false;
      dbg('No players row found — treating as new user, starting tutorial');
    }

    // Start tutorial if not completed (runs whether res.data existed or not)
    if (!playerSettings.tutorial_completed) {
      dbg('Starting tutorial for new player...');
      setTimeout(function() {
        if (typeof Tutorial !== 'undefined') {
          Tutorial.start();
        }
      }, 1500);
    }
  } catch (err) {
    console.error('Error checking tutorial status:', err);
    // On error, default to starting tutorial (safe fallback for new users)
    setTimeout(function() {
      if (typeof Tutorial !== 'undefined' && !playerSettings.tutorial_completed) {
        Tutorial.start();
      }
    }, 1500);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════════════


// Apply settings to the game

// ══════════════════════════════════════════════════════════════════════════
// PAWKETPASS SYSTEM
// ══════════════════════════════════════════════════════════════════════════

var passProgress = {
  season: 1,
  level: 1,
  xp: 0,
  xpToNextLevel: 110, // calculateXPForLevel(2) = floor(100 * 1.1^1) = 110
  claimedRewards: []
};

var dailyXPCaps = {
  login:         { earned: 0, max: 20  },  // once per day
  feed:          { earned: 0, max: 30  },  // ~15 feeds to cap
  play:          { earned: 0, max: 40  },  // fishing / minigames
  battle:        { earned: 0, max: 120 },  // ~15 wins to cap (main activity)
  expedition:    { earned: 0, max: 50  },  // ~5 expeditions
  race:          { earned: 0, max: 36  },  // ~6 races
  level_up:      { earned: 0, max: 50  },  // ~5 level-ups
  bingo_square:  { earned: 0, max: 135 },
  bingo_line:    { earned: 0, max: 400 },
  bingo_blackout:{ earned: 0, max: 200 }
};

// Pass rewards structure (50 levels)
var PASS_REWARDS = {
  1: { type: 'points', amount: 100 },
  2: { type: 'item', itemId: 'basic_food', quantity: 2 },
  3: { type: 'item', itemId: 'treat', quantity: 3 },
  4: { type: 'points', amount: 150 },
  5: { type: 'item', itemId: 'rare_toy', quantity: 1 },
  6: { type: 'title', titleKey: 'pass_rider' },
  7: { type: 'points', amount: 200 },
  8: { type: 'item', itemId: 'treat', quantity: 2, itemId2: 'basic_food', quantity2: 1 },
  9: { type: 'points', amount: 250 },
  10: { type: 'item', itemId: 'premium_treat', quantity: 1 },
  11: { type: 'points', amount: 300 },
  12: { type: 'item', itemId: 'rare_toy', quantity: 2 },
  13: { type: 'title', titleKey: 'dedicated_trainer' },
  14: { type: 'points', amount: 350 },
  15: { type: 'item', itemId: 'revive_potion', quantity: 1 },
  16: { type: 'points', amount: 400 },
  17: { type: 'item', itemId: 'treat', quantity: 3, itemId2: 'basic_food', quantity2: 2 },
  18: { type: 'points', amount: 450 },
  19: { type: 'item', itemId: '00000000-0000-0000-0000-000000000001', quantity: 1 },
  20: { type: 'title', titleKey: 'faithful_companion' },
  21: { type: 'points', amount: 500 },
  22: { type: 'item', itemId: 'premium_treat', quantity: 2 },
  23: { type: 'points', amount: 550 },
  24: { type: 'item', itemId: '00000000-0000-0000-0000-000000000001', quantity: 1 },
  25: { type: 'points', amount: 600 },
  26: { type: 'item', itemId: 'rare_toy', quantity: 3 },
  27: { type: 'title', titleKey: 'pawket_champion' },
  28: { type: 'points', amount: 700 },
  29: { type: 'item', itemId: '00000000-0000-0000-0000-000000000001', quantity: 1 },
  30: { type: 'title', titleKey: 'style_master' },
  31: { type: 'points', amount: 800 },
  32: { type: 'item', itemId: 'treat', quantity: 5, itemId2: 'basic_food', quantity2: 3 },
  33: { type: 'points', amount: 900 },
  34: { type: 'title', titleKey: 'legendary_tamer' },
  35: { type: 'points', amount: 1000 },
  36: { type: 'item', itemId: '00000000-0000-0000-0000-000000000001', quantity: 2 },
  37: { type: 'points', amount: 1100 },
  38: { type: 'item', itemId: 'premium_treat', quantity: 3, itemId2: 'revive_potion', quantity2: 2 },
  39: { type: 'points', amount: 1200 },
  40: { type: 'title', titleKey: 'mythic_breaker' },
  41: { type: 'points', amount: 1300 },
  42: { type: 'item', itemId: '00000000-0000-0000-0000-000000000001', quantity: 2 },
  43: { type: 'points', amount: 1400 },
  44: { type: 'item', itemId: 'mystery_box', quantity: 3 },
  45: { type: 'points', amount: 1500 },
  46: { type: 'item', itemId: '00000000-0000-0000-0000-000000000001', quantity: 3 },
  47: { type: 'title', titleKey: 'pawket_master' },
  48: { type: 'points', amount: 2000 },
  49: { type: 'item', itemId: '00000000-0000-0000-0000-000000000001', quantity: 3 },
  50: { type: 'title', titleKey: 'ultimate_collector' }
};

// Load Pass progress from database
async function loadPassProgress() {
  if (!currentUser) return;
  
  try {
    var res = await supabaseClient
      .from('user_pass_progress')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('season', 1)
      .maybeSingle();
    
    if (res.data) {
      passProgress.level = res.data.level || 1;
      passProgress.xp = res.data.xp || 0;
      passProgress.claimedRewards = res.data.claimed_rewards || [];
      passProgress.xpToNextLevel = calculateXPForLevel(passProgress.level + 1);
    } else {
      // Create new progress entry
      await supabaseClient
        .from('user_pass_progress')
        .insert({
          user_id: currentUser.id,
          season: 1,
          level: 1,
          xp: 0,
          claimed_rewards: []
        });
    }
    
    // Load daily XP caps from localStorage
    var today = new Date().toISOString().split('T')[0];
    var savedCaps = localStorage.getItem('daily_xp_caps_' + today);
    if (savedCaps) {
      dailyXPCaps = JSON.parse(savedCaps);
    } else {
      resetDailyXPCaps();
    }
    
    updatePassUI();
    
  } catch (err) {
    console.error('[Pass] Error loading progress:', err);
  }
}

// Calculate XP required for a level
function calculateXPForLevel(level) {
  return Math.floor(100 * Math.pow(1.1, level - 1));
}

// Add Pass XP with daily cap
async function addPassXP(amount, source) {
  if (!currentUser || amount <= 0) return;
  
  // Check daily cap
  if (dailyXPCaps[source]) {
    var remaining = dailyXPCaps[source].max - dailyXPCaps[source].earned;
    if (remaining <= 0) {
      dbg('[Pass] Daily XP cap reached for ' + source);
      return;
    }
    amount = Math.min(amount, remaining);
    dailyXPCaps[source].earned += amount;
    saveDailyXPCaps();
  }
  
  passProgress.xp += amount;
  
  // Check for level up
  var levelsGained = 0;
  while (passProgress.xp >= passProgress.xpToNextLevel && passProgress.level < 50) {
    passProgress.xp -= passProgress.xpToNextLevel;
    passProgress.level++;
    passProgress.xpToNextLevel = calculateXPForLevel(passProgress.level + 1);
    levelsGained++;
  }
  
  // Save to database — upsert so it works even if row doesn't exist yet
  var { error: saveErr } = await supabaseClient
    .from('user_pass_progress')
    .upsert({
      user_id: currentUser.id,
      season: 1,
      level: passProgress.level,
      xp: passProgress.xp,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,season' });

  if (saveErr) dbg('[Pass] Save error:', saveErr);
  updatePassUI();
  
  if (levelsGained > 0) {
    showToast('🎫 Pass Level Up! Now Level ' + passProgress.level + '!', 'success', true);
    flashNavButton('mypets', 10000); // Pass rewards are in mypets/pass section
    playSound('levelup');
  }
  
  // MINI SEASONS: feed the same XP into any currently active season
  // pass(es) too — fire-and-forget, shouldn't block or fail the main pass
  // update above if something goes wrong here.
  try {
    var activeSeasonsForXP = await getActiveMiniSeasons();
    for (var i = 0; i < activeSeasonsForXP.length; i++) {
      supabaseClient.rpc('add_season_pass_xp', {
        p_season_key: activeSeasonsForXP[i].season_key,
        p_amount: amount
      }).then(function(res) {
        if (res.data && res.data.leveled_up) {
          dbg('[SeasonPass] Leveled up:', res.data);
        }
      });
    }
  } catch (e) {
    dbg('[SeasonPass] XP feed error:', e);
  }
}

// Save daily XP caps to localStorage
function saveDailyXPCaps() {
  var today = new Date().toISOString().split('T')[0];
  localStorage.setItem('daily_xp_caps_' + today, JSON.stringify(dailyXPCaps));
}

// Reset daily XP caps (called at midnight)
function resetDailyXPCaps() {
  dailyXPCaps = {
    login:         { earned: 0, max: 10 },
    feed:          { earned: 0, max: 20 },
    play:          { earned: 0, max: 20 },
    battle:        { earned: 0, max: 50 },
    expedition:    { earned: 0, max: 30 },
    race:          { earned: 0, max: 20 },
    level_up:      { earned: 0, max: 30 },
    bingo_square:  { earned: 0, max: 135 },
    bingo_line:    { earned: 0, max: 400 },
    bingo_blackout:{ earned: 0, max: 200 }
  };
  saveDailyXPCaps();
}

// Claim Pass reward
async function claimPassReward(level) {
  if (!currentUser) return;
  
  // Check if already claimed
  if (passProgress.claimedRewards.includes(level)) {
    showToast('You already claimed this reward!', 'warning');
    return;
  }
  
  // Check if level reached
  if (passProgress.level < level) {
    showToast('Reach Level ' + level + ' to claim this reward!', 'warning');
    return;
  }
  
  var reward = PASS_REWARDS[level];
  if (!reward) return;
  
  // Grant reward
  await grantPassReward(level, reward);
  
  // Mark as claimed
  passProgress.claimedRewards.push(level);
  
  await supabaseClient
    .from('user_pass_progress')
    .update({
      claimed_rewards: passProgress.claimedRewards
    })
    .eq('user_id', currentUser.id)
    .eq('season', 1);
  
  updatePassUI();
}

// Grant Pass reward to player
async function grantPassReward(level, reward) {
  switch(reward.type) {
    case 'points':
      updateAllPoints(currentPoints + reward.amount);
      await supabaseClient.rpc('award_pp_secure', {
        p_amount: reward.amount,
        p_reason: 'pass_level_' + level
      });
      showToast('✨ +' + reward.amount + ' PawketPoints!', 'success');
      break;
      
    case 'item':
      // Add primary item
      if (reward.itemId) {
        await addItemToInventory(reward.itemId, reward.quantity || 1);
        var itemName = reward.itemId === '00000000-0000-0000-0000-000000000001' ? '🔑 Skin Key' : reward.itemId;
        showToast('📦 +' + (reward.quantity || 1) + 'x ' + itemName, 'success');
      }
      // Add secondary item
      if (reward.itemId2) {
        await addItemToInventory(reward.itemId2, reward.quantity2 || 1);
        showToast('📦 +' + (reward.quantity2 || 1) + 'x ' + reward.itemId2, 'success');
      }
      break;
      
    case 'title':
      await awardPlayerTitle(reward.titleKey, 'PawketPass reward');
      var titleData = await supabaseClient
        .from('titles')
        .select('display_name')
        .eq('title_key', reward.titleKey)
        .maybeSingle();
      
      if (titleData.data) {
        showToast('🏆 Title unlocked: "' + titleData.data.display_name + '"!', 'success', true);
      }
      break;
  }
}

// Add item to inventory (helper)
async function addItemToInventory(itemId, quantity) {
  if (!currentUser) return;
  
  // Check if item exists in inventory
  var invCheck = await supabaseClient
    .from('user_inventory')
    .select('id, quantity')
    .eq('user_id', currentUser.id)
    .eq('item_id', itemId)
    .maybeSingle();
  
  if (invCheck.data) {
    // Update quantity
    await supabaseClient
      .from('user_inventory')
      .update({ quantity: invCheck.data.quantity + quantity })
      .eq('id', invCheck.data.id);
  } else {
    // Insert new
    await supabaseClient
      .from('user_inventory')
      .insert({
        user_id: currentUser.id,
        item_id: itemId,
        quantity: quantity
      });
  }
}

// Update Pass UI
function updatePassUI() {
  var levelDisplay = document.getElementById('pass-level-display');
  var xpFill = document.getElementById('pass-xp-fill');
  
  if (levelDisplay) {
    levelDisplay.textContent = passProgress.level;
  }
  
  if (xpFill) {
    var percent = (passProgress.xp / passProgress.xpToNextLevel) * 100;
    xpFill.style.width = Math.min(percent, 100) + '%';
  }
}

// ══════════════════════════════════════════════════════════════════════════
// MINI SEASONS — seasonal cosmetic reward track ("mini pass")
// Separate from the main PawketPass above: content (reward ladder) and
// progress are both scoped per season_key, so they naturally reset each
// new season rather than needing manual resetting.
// ══════════════════════════════════════════════════════════════════════════

async function claimSeasonPassReward(seasonKey, level) {
  if (!currentUser) return false;
  try {
    var res = await supabaseClient.rpc('claim_season_pass_reward', {
      p_season_key: seasonKey,
      p_level: level
    });
    if (res.error || !res.data || res.data.error) {
      showToast(res.data && res.data.error ? res.data.error : 'Could not claim reward', 'error');
      return false;
    }
    var reward = res.data;
    if (reward.reward_type === 'points') {
      var amount = parseInt(reward.reward_value) || 0;
      updateAllPoints(currentPoints + amount);
      await supabaseClient.rpc('award_pp_secure', { p_amount: amount, p_reason: 'season_pass_level_' + level });
      showToast('✨ +' + amount + ' PawketPoints!', 'success');
    } else if (reward.reward_type === 'item') {
      await addItemToInventory(reward.reward_value, 1);
      showToast('📦 +1x ' + reward.reward_value, 'success');
    } else if (reward.reward_type === 'skin_key') {
      var qty = parseInt(reward.reward_value) || 1;
      await addItemToInventory('00000000-0000-0000-0000-000000000001', qty);
      showToast('🔑 +' + qty + ' Skin Key' + (qty > 1 ? 's' : '') + '!', 'success');
    } else if (reward.reward_type === 'title') {
      await awardPlayerTitle(reward.reward_value, 'Season Pass reward');
      showToast('🏆 Title unlocked!', 'success', true);
    } else if (reward.reward_type === 'frame') {
      // Grant the frame via the cosmetics system (phase1_unlockCosmetic writes to unlocked_cosmetics)
      var frameId = reward.reward_value;
      if (frameId && typeof phase1_unlockCosmetic === 'function') {
        await phase1_unlockCosmetic('frame', frameId);
        // phase1_unlockCosmetic already shows the unlock celebration — no extra toast needed
        dbg('[SeasonPass] Frame unlocked via cosmetics system:', frameId);
      } else {
        showToast('🖼️ Frame unlocked! Check your profile to equip it.', 'success');
        dbg('[SeasonPass] Frame reward (phase1_unlockCosmetic not available):', frameId);
      }
    }
    return true;
  } catch (e) {
    console.error('[SeasonPass] Claim error:', e);
    showToast('Could not claim reward', 'error');
    return false;
  }
}

async function showSeasonPassModal(seasonKey) {
  var activeSeasons = await getActiveMiniSeasons();
  var season = seasonKey ? activeSeasons.find(function(s) { return s.season_key === seasonKey; }) : activeSeasons[0];
  if (!season) {
    showToast('No active season right now', 'warning');
    return;
  }
  
  var rewardsRes = await supabaseClient
    .from('season_pass_rewards')
    .select('*')
    .eq('season_key', season.season_key)
    .order('level', { ascending: true });
  var rewards = rewardsRes.data || [];
  
  var progressRes = await supabaseClient
    .from('user_season_pass_progress')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('season_key', season.season_key)
    .maybeSingle();
  var progress = progressRes.data || { level: 1, xp: 0, claimed_levels: [] };
  
  var modal = makeModal();
  modal.classList.add('pass-modal');
  modal.style.maxWidth = '96vw';
  
  var content = makeEl('div', {class: 'pass-modal-content'});
  content.style.cssText = 'padding:20px;max-width:1500px;width:95vw;max-height:88vh;overflow-y:auto;background:linear-gradient(160deg,rgba(20,5,45,0.03) 0%,rgba(153,102,255,0.05) 100%);border-radius:16px;';
  
  var header = makeEl('div');
  header.style.cssText = 'text-align:center;margin-bottom:30px;';
  header.innerHTML = '<h2 style="color:var(--purple);margin-bottom:6px;">' + (season.icon || '🎫') + ' ' + escapeHtml(season.name) + '</h2>' +
    (season.theme_description ? '<div style="font-size:0.9rem;color:var(--text-light);margin-bottom:10px;">' + escapeHtml(season.theme_description) + '</div>' : '') +
    '<div style="font-size:1.2rem;color:var(--text);">Level ' + progress.level + ' / 30</div>';
  content.appendChild(header);
  
  var track = makeEl('div', {class: 'pass-rewards-track'});
  track.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:14px;';
  
  var rewardIcons = { points: '💰', item: '📦', skin_key: '🔑', title: '🏆', frame: '🖼️' };
  
  rewards.forEach(function(reward) {
    var level = reward.level;
    var unlocked = progress.level >= level;
    var claimed = (progress.claimed_levels || []).indexOf(level) !== -1;
    
    var card = makeEl('div', {class: 'pass-reward-card'});
    var _cardBg = unlocked
  ? 'linear-gradient(135deg,rgba(153,102,255,0.12) 0%,rgba(255,102,204,0.08) 100%)'
  : 'rgba(100,80,140,0.06)';
var _cardBorder = claimed ? '#4CAF50' : unlocked ? 'rgba(153,102,255,0.7)' : 'rgba(153,102,255,0.2)';
card.style.cssText = 'background:' + _cardBg + ';border:2px solid ' + _cardBorder + ';border-radius:12px;padding:15px;text-align:center;position:relative;' + (unlocked ? '' : 'opacity:0.55;');
    
    var badge = makeEl('div');
    badge.textContent = 'Lv.' + level;
    badge.style.cssText = 'position:absolute;top:5px;right:5px;background:var(--purple);color:white;padding:2px 8px;border-radius:8px;font-size:0.8rem;font-weight:bold;';
    card.appendChild(badge);
    
    var icon = makeEl('div');
    icon.style.cssText = 'font-size:2rem;margin:10px 0;';
    icon.textContent = rewardIcons[reward.reward_type] || '🎁';
    card.appendChild(icon);
    
    var desc = makeEl('div');
    desc.style.cssText = 'font-size:0.9rem;color:var(--text);margin-bottom:10px;';
    if (reward.reward_type === 'points') desc.textContent = reward.reward_value + ' PP';
    else if (reward.reward_type === 'skin_key') desc.textContent = reward.reward_value + ' Skin Key' + (reward.reward_value > 1 ? 's' : '');
    else desc.textContent = reward.reward_value;
    card.appendChild(desc);
    
    if (unlocked && !claimed) {
      var claimBtn = makeEl('button', {class: 'btn btn-primary btn-sm'});
      claimBtn.textContent = 'Claim';
      claimBtn.onclick = function(lvl) {
        return async function() {
          this.disabled = true;
          this.textContent = '...';
          await claimSeasonPassReward(season.season_key, lvl);
          closeModal();
          showSeasonPassModal(season.season_key);
        };
      }(level);
      card.appendChild(claimBtn);
    } else if (claimed) {
      var claimedText = makeEl('div');
      claimedText.textContent = '✓ Claimed';
      claimedText.style.cssText = 'color:#4CAF50;font-weight:bold;';
      card.appendChild(claimedText);
    } else {
      var lockedText = makeEl('div');
      lockedText.textContent = '🔒 Locked';
      lockedText.style.cssText = 'color:#999;';
      card.appendChild(lockedText);
    }
    
    track.appendChild(card);
  });
  
  content.appendChild(track);
  
  var closeBtn = makeEl('button', {class: 'btn btn-outline'});
  closeBtn.textContent = '✕ Close';
  closeBtn.style.cssText = 'display:block;margin:20px auto 0;';
  closeBtn.onclick = closeModal;
  content.appendChild(closeBtn);
  
  modal.appendChild(content);
  document.body.appendChild(modal);
}

// Show Pass modal
function showPrivacyPolicy() {
  if (currentUser) {
    showTab('privacy');
  } else {
    showPrivacyModal();
  }
}

function showPrivacyModal() {
  var modal = makeModal();
  modal.style.maxWidth = '800px';
  modal.style.maxHeight = '85vh';
  modal.style.overflowY = 'auto';
  var sec = document.getElementById('section-privacy');
  if (sec) {
    var clone = sec.querySelector('.legal-doc');
    if (clone) {
      var wrap = document.createElement('div');
      wrap.innerHTML = '<h2 style="margin-bottom:16px;">Privacy Policy</h2>' + clone.outerHTML;
      modal.appendChild(wrap);
    }
  }
  var closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn-primary';
  closeBtn.textContent = 'Close';
  closeBtn.style.marginTop = '20px';
  closeBtn.onclick = closeModal;
  modal.appendChild(closeBtn);
  openModal(modal);
}

function showPassModal() {
  var modal = makeModal();
  modal.classList.add('pass-modal');
  // makeModal()'s generic inline style caps width at 90% — widen specifically
  // for the Pass modal so the reward track actually gets the extra room.
  modal.style.maxWidth = '96vw';
  
  var content = makeEl('div', {class: 'pass-modal-content'});
  content.style.cssText = 'padding:20px;max-width:1500px;width:95vw;max-height:88vh;overflow-y:auto;';
  
  // Header
  var header = makeEl('div');
  header.style.cssText = 'text-align:center;margin-bottom:30px;';
  header.innerHTML = '<h2 style="color:var(--purple);margin-bottom:10px;">🎫 PawketPass Season 1</h2>' +
    '<div style="font-size:1.2rem;color:var(--text);">Level ' + passProgress.level + ' / 50</div>' +
    '<div class="pass-xp-bar-large" style="width:100%;height:30px;background:rgba(153,102,255,0.15);border:1px solid rgba(153,102,255,0.3);border-radius:15px;margin-top:15px;overflow:hidden;">' +
    '<div style="width:' + ((passProgress.xp / passProgress.xpToNextLevel) * 100) + '%;height:100%;background:linear-gradient(90deg,var(--purple),var(--pink));transition:width 0.3s;"></div>' +
    '</div>' +
    '<div style="margin-top:8px;color:var(--text-light);">' + passProgress.xp + ' / ' + passProgress.xpToNextLevel + ' XP</div>';
  content.appendChild(header);
  
  // Rewards track
  var track = makeEl('div', {class: 'pass-rewards-track'});
  track.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:14px;';
  
  for (var level = 1; level <= 50; level++) {
    var reward = PASS_REWARDS[level];
    if (!reward) continue;
    
    var card = makeEl('div', {class: 'pass-reward-card'});
    var unlocked = passProgress.level >= level;
    var claimed = passProgress.claimedRewards.includes(level);
    
    card.style.cssText = 'background:' + (unlocked ? '#fff' : '#f5f5f5') + ';border:2px solid ' + (claimed ? '#4CAF50' : unlocked ? 'var(--purple)' : '#ddd') + ';border-radius:12px;padding:15px;text-align:center;position:relative;' + (unlocked ? '' : 'opacity:0.6;');
    
    // Level badge
    var badge = makeEl('div');
    badge.textContent = 'Lv.' + level;
    badge.style.cssText = 'position:absolute;top:5px;right:5px;background:var(--purple);color:white;padding:2px 8px;border-radius:8px;font-size:0.8rem;font-weight:bold;';
    card.appendChild(badge);
    
    // Reward icon
    var icon = makeEl('div');
    icon.style.cssText = 'font-size:2rem;margin:10px 0;';
    if (reward.type === 'points') icon.textContent = '💰';
    else if (reward.type === 'item') icon.textContent = reward.itemId === '00000000-0000-0000-0000-000000000001' ? '🔑' : '📦';
    else if (reward.type === 'title') icon.textContent = '🏆';
    card.appendChild(icon);
    
    // Reward description
    var desc = makeEl('div');
    desc.style.cssText = 'font-size:0.9rem;color:var(--text);margin-bottom:10px;';
    if (reward.type === 'points') desc.textContent = reward.amount + ' PP';
    else if (reward.type === 'item') {
      var itemText = (reward.quantity || 1) + 'x ' + (reward.itemId === '00000000-0000-0000-0000-000000000001' ? 'Skin Key' : reward.itemId);
      if (reward.itemId2) itemText += ' + ' + (reward.quantity2 || 1) + 'x ' + reward.itemId2;
      desc.textContent = itemText;
    }
    else if (reward.type === 'title') desc.textContent = 'Title';
    card.appendChild(desc);
    
    // Claim button
    if (unlocked && !claimed) {
      var claimBtn = makeEl('button', {class: 'btn btn-primary btn-sm'});
      claimBtn.textContent = 'Claim';
      claimBtn.onclick = function(lvl) {
        return async function() {
          this.disabled = true;
          this.textContent = '...';
          await claimPassReward(lvl);
          // closeModal removes the overlay correctly, then reopen
          closeModal();
          showPassModal();
        };
      }(level);
      card.appendChild(claimBtn);
    } else if (claimed) {
      var claimedText = makeEl('div');
      claimedText.textContent = '✓ Claimed';
      claimedText.style.cssText = 'color:#4CAF50;font-weight:bold;';
      card.appendChild(claimedText);
    } else {
      var lockedText = makeEl('div');
      lockedText.textContent = '🔒 Locked';
      lockedText.style.cssText = 'color:#999;';
      card.appendChild(lockedText);
    }
    
    track.appendChild(card);
  }
  
  content.appendChild(track);

  // Close button
  var closeBtn = makeEl('button', {class: 'btn btn-outline'});
  closeBtn.textContent = '✕ Close';
  closeBtn.style.cssText = 'display:block;margin:20px auto 0;';
  closeBtn.onclick = closeModal;
  modal.appendChild(content);
  modal.appendChild(closeBtn);

  // Append overlay (parent of modal) to body
  var overlay = modal.parentElement;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}

// ══════════════════════════════════════════════════════════════════════════
// DAILY BINGO SYSTEM
// ══════════════════════════════════════════════════════════════════════════

var BINGO_TASKS = [
  // ── Core daily tasks ──────────────────────────────────────────────────────
  { id: 'feed_pet',         name: '🍖 Feed a Pet',         target: 5,   taskType: 'feed_pet',         rewardPoints: 50  },
  { id: 'play_pet',         name: '🎾 Play with Pet',       target: 5,   taskType: 'play_pet',         rewardPoints: 50  },
  { id: 'use_treat',        name: '🍬 Feed a Treat',        target: 3,   taskType: 'use_treat',        rewardPoints: 50  },
  { id: 'use_toy',          name: '🧸 Use a Toy',           target: 3,   taskType: 'use_toy',          rewardPoints: 50  },
  { id: 'login',            name: '📅 Daily Login',         target: 1,   taskType: 'login',            rewardPoints: 20  },
  { id: 'visit_shop',       name: '🛒 Visit Shop',          target: 1,   taskType: 'visit_shop',       rewardPoints: 20  },
  { id: 'pet_companion',    name: '💬 Chat with Companion', target: 5,   taskType: 'pet_companion',    rewardPoints: 50  },
  { id: 'earn_points',      name: '💰 Earn 500 PP',         target: 500, taskType: 'earn_points',      rewardPoints: 100 },
  // ── Progression tasks ─────────────────────────────────────────────────────
  { id: 'win_battle',       name: '⚔️ Win a Battle',        target: 3,   taskType: 'win_battle',       rewardPoints: 100 },
  { id: 'level_up_pet',     name: '⬆️ Level Up a Pet',      target: 1,   taskType: 'level_up_pet',     rewardPoints: 100 },
  { id: 'adopt_pet',        name: '🐣 Adopt a Pet',          target: 1,   taskType: 'adopt_pet',        rewardPoints: 150 },
  { id: 'complete_minigame',name: '🎮 Play a Minigame',      target: 1,   taskType: 'complete_minigame',rewardPoints: 75  },
  { id: 'complete_expedition',name:'🗺️ Complete Expedition',  target: 1,   taskType: 'complete_expedition',rewardPoints: 75},
  // ── Social/community tasks ─────────────────────────────────────────────────
  { id: 'send_gift',        name: '🎁 Send a Gift',         target: 1,   taskType: 'send_gift',        rewardPoints: 75  },
  { id: 'vote_poll',        name: '🗳️ Vote in a Poll',      target: 1,   taskType: 'vote_poll',        rewardPoints: 30  },
  { id: 'donate_guild',     name: '🏛️ Donate to Guild',     target: 1,   taskType: 'donate_guild',     rewardPoints: 75  },
  { id: 'vote_in_guild',    name: '🗳️ Cast Guild Vote',      target: 1,   taskType: 'vote_in_guild',    rewardPoints: 50  },
  { id: 'guild_dungeon',    name: '⚔️ Guild Dungeon Run',    target: 1,   taskType: 'guild_dungeon',    rewardPoints: 100 },
  // ── Grand Prix tasks ──────────────────────────────────────────────────────
  { id: 'enter_grand_prix', name: '🏁 Enter Grand Prix',    target: 1,   taskType: 'enter_grand_prix', rewardPoints: 50  },
  { id: 'train_grand_prix', name: '🏋️ Train for Grand Prix',target: 3,   taskType: 'train_grand_prix', rewardPoints: 75  },
  { id: 'grand_prix_top_10',name: '🏅 Grand Prix Top 10',   target: 1,   taskType: 'grand_prix_top_10',rewardPoints: 150 },
  { id: 'grand_prix_winner',name: '🏆 Win Grand Prix',       target: 1,   taskType: 'grand_prix_winner',rewardPoints: 300 },
  // ── Quest tasks ───────────────────────────────────────────────────────────
  { id: 'complete_quest',   name: '📜 Complete a Quest',    target: 1,   taskType: 'complete_quest',   rewardPoints: 100 },
  { id: 'complete_race',    name: 'Finish a Race',     target: 1, taskType: 'complete_race',    rewardPoints: 50  },
  { id: 'race_podium',      name: 'Race Top 3 Finish', target: 1, taskType: 'race_podium',      rewardPoints: 150 },
  { id: 'train_pet_racing', name: 'Train for Racing',  target: 1, taskType: 'train_pet_racing', rewardPoints: 30  },
];

var dailyBingo = {
  date: null,
  squares: [],
  completedLines: [],
  blackoutCompleted: false
};

// Track which squares have been notified to prevent spam (declared here, before loadDailyBingo uses it)
var bingoNotificationsShown = {};

// Load daily bingo from localStorage
function loadDailyBingo() {
  var today = new Date().toISOString().split('T')[0];
  var saved = localStorage.getItem('daily_bingo');
  
  if (saved) {
    var parsed = JSON.parse(saved);
    if (parsed.date === today) {
      dailyBingo = parsed;
      
      // Mark all already-completed OR already-at-target squares as notified (prevent spam on page load)
      var needsSave = false;
      dailyBingo.squares.forEach(function(square) {
        if (square.completed || (square.progress >= square.target)) {
          var notificationKey = dailyBingo.date + '_' + square.taskType;
          bingoNotificationsShown[notificationKey] = true;
          // Also ensure completed flag is set if progress is already at target
          if (square.progress >= square.target && !square.completed) {
            square.completed = true;
            needsSave = true;
          }
        }
      });
      // Persist any fixups so the top-bar counter stays correct across page loads
      if (needsSave) {
        try { localStorage.setItem('daily_bingo', JSON.stringify(dailyBingo)); } catch(e) {}
      }
      
      return;
    }
  }
  
  // New day - generate new bingo
  dailyBingo = {
    date: today,
    squares: generateDailyBingo(),
    completedLines: [],
    blackoutCompleted: false
  };
  
  // Reset notifications for new day
  bingoNotificationsShown = {};
  
  saveDailyBingo();
}

// Generate random 4x3 bingo grid (12 squares)
function generateDailyBingo() {
  var shuffled = BINGO_TASKS.slice();
  for (var i = shuffled.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  
  var squares = shuffled.slice(0, 12).map(function(task) {
    return {
      id: task.id,
      name: task.name,
      target: task.target,
      taskType: task.taskType,
      rewardPoints: task.rewardPoints,
      progress: 0,
      completed: false
    };
  });

  // Free space — auto-complete one easy square (lowest reward = simplest task)
  var easiest = squares.reduce(function(best, s, i) {
    return s.rewardPoints < squares[best].rewardPoints ? i : best;
  }, 0);
  squares[easiest].completed = true;
  squares[easiest].progress  = squares[easiest].target;
  squares[easiest].freeSpace = true; // Mark so UI can show the badge

  return squares;
}

// Save bingo to localStorage
function saveDailyBingo() {
  localStorage.setItem('daily_bingo', JSON.stringify(dailyBingo));
  // Also persist to DB so progress survives localStorage clears
  if (currentUser) {
    (async function() {
      try {
        var { error } = await supabaseClient.from('user_bingo_progress').upsert({
          user_id: currentUser.id,
          date: dailyBingo.date,
          bingo_data: JSON.stringify(dailyBingo)
        }, { onConflict: 'user_id,date' });
        if (error) dbg('saveDailyBingo DB error:', error);
      } catch(e) { dbg('saveDailyBingo exception:', e); }
    })();
  }
}

// Update bingo progress
async function updateBingoProgress(taskType, amount) {
  if (!currentUser) return;
  
  // Only load if not already in memory for today
  if (!dailyBingo || !dailyBingo.date || dailyBingo.date !== new Date().toISOString().split('T')[0]) {
    loadDailyBingo();
  }
  
  var square = dailyBingo.squares.find(function(s) { return s.taskType === taskType; });
  if (!square || square.completed) return;
  // Also check Melon's Requests
  if (typeof melonRequests_checkProgress === 'function') melonRequests_checkProgress(taskType, null);
  
  var wasCompleted = square.completed;
  square.progress = Math.min(square.progress + (amount || 1), square.target);
  // Check if just completed (do this BEFORE saving so completed=true is persisted together)
  var justCompleted = !wasCompleted && square.progress >= square.target;
  
  if (justCompleted) {
    square.completed = true;
    
    // Persistent claimed check — survives tab switches and page focuses
    var claimedKey = 'bingo_claimed_' + dailyBingo.date;
    var claimedList = [];
    try { claimedList = JSON.parse(localStorage.getItem(claimedKey) || '[]'); } catch(e) {}
    
    // Only award if not already claimed today (persisted to localStorage)
    if (claimedList.indexOf(taskType) === -1) {
      claimedList.push(taskType);
      try { localStorage.setItem(claimedKey, JSON.stringify(claimedList)); } catch(e) {}
      
      // Award points
      awardPP(square.rewardPoints, 'bingo_' + taskType).then(null, function(){});
      
      // Award Pass XP
      await addPassXP(15, 'bingo_square');
      
      showToast('✓ Bingo: ' + square.name + ' complete! +' + square.rewardPoints + ' PP, +15 XP', 'success');
      if (typeof playBattleSound === 'function') { playBattleSound('victory', 0.35); }
      
      // Check for lines
      await checkBingoLines();
    }
  }
  
  saveDailyBingo();
  updateBingoUI();
}

// Check for bingo lines (4x3 grid = 10 lines total)
async function checkBingoLines() {
  var grid = dailyBingo.squares;
  
  // 4x3 grid layout: 3 rows, 4 columns, 2 diagonals = 10 lines
  var lines = [
    [0,1,2,3], [4,5,6,7], [8,9,10,11],  // 3 horizontal rows
    [0,4,8], [1,5,9], [2,6,10], [3,7,11],  // 4 vertical columns
    [0,5,10], [3,6,9]  // 2 diagonals
  ];
  
  for (var idx = 0; idx < lines.length; idx++) {
    var line = lines[idx];
    var lineKey = 'line_' + idx;
    
    if (!dailyBingo.completedLines.includes(lineKey)) {
      var allCompleted = line.every(function(cell) { return grid[cell] && grid[cell].completed; });
      
      if (allCompleted) {
        dailyBingo.completedLines.push(lineKey);
        
        // Award line bonus
        try {
          var { data: newPtsLine, error: lineErr } = await supabaseClient.rpc('award_pp_secure', {
            p_amount: 100,
            p_reason: 'Bingo Line Complete'
          });
          if (lineErr) throw lineErr;
          if (typeof newPtsLine === 'number') { currentPoints = newPtsLine; updateAllPoints(newPtsLine); }
          else { updateAllPoints(currentPoints + 100); }
        } catch(e) {
          updateAllPoints(currentPoints + 100);
          dbg('award_pp_secure line error:', e);
        }
        
        await addPassXP(50, 'bingo_line');
        
        showToast('🎯 Bingo Line Complete! +100 PP, +50 XP', 'success', true);
        flashNavButton('minigames', 8000);
        playSound('victory');
      }
    }
  }
  
  // Check blackout (all 12 squares complete)
  if (!dailyBingo.blackoutCompleted && dailyBingo.squares.every(function(s) { return s.completed; })) {
    dailyBingo.blackoutCompleted = true;
    
    // Award blackout bonus
    try {
      var { data: newPtsBlackout, error: blackoutErr } = await supabaseClient.rpc('award_pp_secure', {
        p_amount: 500,
        p_reason: 'Bingo Blackout!'
      });
      if (blackoutErr) throw blackoutErr;
      if (typeof newPtsBlackout === 'number') { currentPoints = newPtsBlackout; updateAllPoints(newPtsBlackout); }
      else { updateAllPoints(currentPoints + 500); }
    } catch(e) {
      updateAllPoints(currentPoints + 500);
      dbg('award_pp_secure blackout error:', e);
    }
    
    await addPassXP(200, 'bingo_blackout');
    
    // Check if this is the FIRST blackout of the week
    var weekKey = getWeekNumberKey();
    var hasClaimedWeeklySkinKey = localStorage.getItem(weekKey) === 'true';
    
    if (!hasClaimedWeeklySkinKey) {
      // First blackout of the week - award Skin Key!
      await addItemToInventory('00000000-0000-0000-0000-000000000001', 1);
      localStorage.setItem(weekKey, 'true');
      showToast('🏆 WEEKLY BLACKOUT! +500 PP, +200 XP, +1 Skin Key!', 'success');
    } else {
      // Additional blackout this week - no Skin Key
      showToast('🏆 BLACKOUT BINGO! +500 PP, +200 XP', 'success', true);
    }
    
    playSound('jackpot');
    createConfettiBurst(window.innerWidth / 2, window.innerHeight / 2);
  }
  
  saveDailyBingo();
}

// Get week number key for weekly Skin Key tracking
function getWeekNumberKey() {
  var now = new Date();
  var start = new Date(now.getFullYear(), 0, 1);
  var days = Math.floor((now - start) / (24 * 60 * 60 * 1000));
  var weekNum = Math.ceil(days / 7);
  return 'bingo_blackout_week_' + weekNum + '_' + now.getFullYear();
}
    
// Update bingo UI
function updateBingoUI() {
  var completionDisplay = document.getElementById('bingo-completion');
  if (completionDisplay) {
    var completed = dailyBingo.squares.filter(function(s) { return s.completed; }).length;
    completionDisplay.textContent = completed + '/12';  // Updated for 4x3 grid
  }
}

// Show bingo modal
function showBingoModal() {
  loadDailyBingo();
  
  var modal = makeModal();
  modal.classList.add('bingo-modal');
  
  var content = makeEl('div', {class: 'bingo-modal-content'});
  content.style.cssText = 'padding:20px;max-width:700px;';
  
  // Header
  var header = makeEl('div');
  header.style.cssText = 'text-align:center;margin-bottom:20px;';
  var completed = dailyBingo.squares.filter(function(s) { return s.completed; }).length;
  var weekKey = getWeekNumberKey();
  var hasClaimedWeeklySkinKey = localStorage.getItem(weekKey) === 'true';
  var skinKeyStatus = hasClaimedWeeklySkinKey ? '(claimed this week)' : '(available!)';
  
  header.innerHTML = '<h2 style="color:var(--purple);margin-bottom:10px;">🎯 Daily Bingo</h2>' +
    '<div style="font-size:1.1rem;color:var(--purple);font-weight:600;">Completed: ' + completed + ' / 12</div>' +
    '<div style="font-size:0.9rem;color:var(--text-light);margin-top:5px;">Lines: ' + dailyBingo.completedLines.length + ' / 10 • Blackout: ' + (dailyBingo.blackoutCompleted ? '✓' : '✗') + '</div>' +
    '<div style="font-size:0.85rem;color:#ff6b35;margin-top:5px;">🔑 Weekly Blackout Bonus: ' + skinKeyStatus + '</div>';
  content.appendChild(header);
  
  // Bingo grid (4x3)
  var grid = makeEl('div');
  grid.id = 'bingo-grid';
  grid.className = 'bingo-grid';
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;padding:10px;';
  
  dailyBingo.squares.forEach(function(square) {
    var card = makeEl('div');
    card.className = 'bingo-card' + (square.completed ? ' bingo-completed' : '');
    card.style.cssText = 'background:' + (square.completed ? 'rgba(76,175,80,0.25)' : 'rgba(255,255,255,0.08)') + ';border:2px solid ' + (square.completed ? '#4CAF50' : 'rgba(255,255,255,0.1)') + ';border-radius:12px;padding:15px;text-align:center;min-height:120px;display:flex;flex-direction:column;justify-content:center;align-items:center;transition:all 0.3s;';
    
    // Extract icon from task name (e.g., "🍖 Feed Pet" -> "🍖")
    var iconMatch = square.name.match(/^([^\s]+)/);
    var icon = iconMatch ? iconMatch[1] : '📌';
    var displayName = square.name.replace(/^[^\s]+\s*/, ''); // Remove icon from name
    
    var iconDiv = makeEl('div');
    iconDiv.className = 'bingo-icon';
    iconDiv.style.cssText = 'font-size:28px;margin-bottom:8px;line-height:1;';
    iconDiv.textContent = icon;
    card.appendChild(iconDiv);
    
    var name = makeEl('div');
    name.className = 'bingo-name';
    name.style.cssText = 'font-size:12px;font-weight:bold;color:#ffffff;margin-bottom:8px;';
    name.textContent = displayName;
    card.appendChild(name);
    
    var progress = makeEl('div');
    progress.className = 'bingo-progress';
    progress.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.7);margin-bottom:6px;';
    progress.textContent = square.progress + ' / ' + square.target;
    card.appendChild(progress);
    
    // Progress bar
    var progressPercent = (square.progress / square.target) * 100;
    var barContainer = makeEl('div');
    barContainer.className = 'bingo-bar';
    barContainer.style.cssText = 'background:rgba(255,255,255,0.15);border-radius:4px;height:4px;overflow:hidden;width:100%;';
    
    var barFill = makeEl('div');
    barFill.className = 'bingo-fill';
    barFill.style.cssText = 'width:' + progressPercent + '%;background:linear-gradient(90deg,#ff6b35,#ffaa44);height:100%;transition:width 0.3s ease;';
    barContainer.appendChild(barFill);
    card.appendChild(barContainer);
    
    if (square.completed) {
      var check = makeEl('div');
      check.className = 'bingo-check';
      check.style.cssText = 'font-size:20px;color:#4CAF50;margin-top:6px;font-weight:bold;';
      check.textContent = '✓';
      card.appendChild(check);
      if (square.freeSpace) {
        var badge = makeEl('div');
        badge.style.cssText = 'font-size:0.62rem;color:#ffaa00;font-weight:700;margin-top:2px;';
        badge.textContent = '🎁 FREE';
        card.appendChild(badge);
      }
    }
    
    grid.appendChild(card);
  });
  
  content.appendChild(grid);
  
  // Rewards info
  var info = makeEl('div');
  info.style.cssText = 'background:#f9f9f9;border-radius:8px;padding:15px;font-size:0.9rem;color:var(--text-light);';
  info.innerHTML = '<strong>Rewards:</strong><br>' +
    '• Each square: +Points +15 Pass XP<br>' +
    '• Each line (4 in a row): +100 PP +50 XP<br>' +
    '• Blackout (all 12): +500 PP +200 XP<br>' +
    '• <strong>Weekly Bonus:</strong> First blackout of the week = +1 Skin Key 🔑';
  content.appendChild(info);
  
  // Fix: makeModal() returns modal which is already inside overlay
  modal.appendChild(content);
  
  // Get the overlay parent and append to body
  var overlay = modal.parentElement;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}


// ══════════════════════════════════════════════════════════════════════════
// ADDITIONAL BINGO HOOKS (called from various places)
// ══════════════════════════════════════════════════════════════════════════

// Hook for points earned - override updateAllPoints
// IMPORTANT: only track genuine earnings, not the initial balance display on page load.
// We use a flag that gets set once the player's real balance has been loaded at least once,
// so the difference calculation doesn't treat "loading 800 PP from the DB" as "earning 800 PP".
var _bingoPointsInitialized = false;
var originalUpdateAllPoints = updateAllPoints;
updateAllPoints = function(pts) {
  var oldPoints = currentPoints || 0;
  originalUpdateAllPoints(pts);
  // Only track the difference as "earned" once we've seen at least one real
  // loaded balance, AND only if points genuinely increased (not just a display refresh).
  if (_bingoPointsInitialized && pts > oldPoints) {
    var earnedAmount = pts - oldPoints;
    updateBingoProgress('earn_points', earnedAmount);
    weeklyChallenge_increment('wk_pp_earned', earnedAmount);
  }
  // Mark as initialized after the first call — subsequent calls are real transactions
  _bingoPointsInitialized = true;
};

// Hook for pet level up - call this when a pet levels up
function onPetLevelUp(petId) {
  updateBingoProgress('level_up_pet', 1);
  addPassXP(10, 'level_up');
  // Award 1 stat point to allocate
  supabaseClient.from('user_pets')
    .update({ stat_points: (petState[petId] && petState[petId].stat_points || 0) + 1 })
    .eq('id', petId)
    .eq('user_id', currentUser.id)
    .then(function(res) {
      if (!res.error && petState[petId]) petState[petId].stat_points = (petState[petId].stat_points || 0) + 1;
    }).then(null, function(){});
}

// ── Stat Point Allocation Modal ───────────────────────────────────────────


// Hook for adoption - call this when adopting a pet
function onPetAdopted(petId) {
  updateBingoProgress('adopt_pet', 1);
  trackDailyStat('pets_adopted').then(null, function(){});
}

// Hook for minigame completion
// Track which minigames completed today for daily bonus
var _minigamesToday = {};
function onMinigameComplete(baseReward, gameKey) {
  updateBingoProgress('complete_minigame', 1);
  addPassXP(3, 'minigame').then(null, function(){});

  // Minigame Monday: award bonus PP on top of what the minigame already paid
  var bonus = getCalendarBonus('minigame_pp');
  if (bonus > 1 && baseReward > 0) {
    var extra = Math.floor(baseReward * (bonus - 1));
    if (extra > 0) awardPP(extra, 'calendar_bonus').then(null, function(){});
    showToast('🎮 Minigame Monday! +' + extra + ' bonus PP!', 3000);
  }

  // Track for daily complete bonus (50 PP when all 6 core minigames done)
  if (gameKey) {
    var today = new Date().toISOString().slice(0,10);
    var saved = JSON.parse(localStorage.getItem('minigames_today') || '{"date":"","games":[]}');
    if (saved.date !== today) saved = { date: today, games: [] };
    if (saved.games.indexOf(gameKey) === -1) saved.games.push(gameKey);
    localStorage.setItem('minigames_today', JSON.stringify(saved));
    var coreGames = ['guess', 'wheel', 'whack', 'memory', 'shell', 'typing'];
    var doneAll = coreGames.every(function(g) { return saved.games.indexOf(g) > -1; });
    if (doneAll && !saved.bonusClaimed) {
      saved.bonusClaimed = true;
      localStorage.setItem('minigames_today', JSON.stringify(saved));
      awardPP(50, 'daily_complete').then(null, function(){});
      showToast('🌟 Daily Complete! All minigames done! +50 PP bonus!', 4000);
    }
  }
}

// ── PET PATTING MECHANIC ───────────────────────────────────────────────────
var _petPatTexts = [':3','*purr*','<33','^-^','mrrp~','hehe~','pats!','uwu',':33','*mew*','heehee~','eep!'];
var _petPatCount = 0;

function petPat(spriteEl) {
  if (_petPatCount >= 6) return; // cap active floaters
  _petPatCount++;

  var text = _petPatTexts[Math.floor(Math.random() * _petPatTexts.length)];
  var colors = ['var(--pink)','var(--purple)','#ff9f43','#5dde7a'];
  var color  = colors[Math.floor(Math.random() * colors.length)];

  // Get sprite position in viewport — append to body so text escapes any clipping container
  var rect   = spriteEl.getBoundingClientRect();
  var x = rect.left + rect.width  / 2 + (Math.random() - 0.5) * 50;
  var y = rect.top  - 8; // start just above the sprite, then float UP

  var el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = [
    'position:fixed',
    'left:' + x + 'px',
    'top:'  + y + 'px',
    'transform:translateX(-50%)',
    'pointer-events:none',
    'z-index:9999',
    'font-size:1.1rem',
    'font-weight:800',
    'color:' + color,
    'font-family:Chewy,Fredoka One,sans-serif',
    'white-space:nowrap',
    'text-shadow:0 1px 6px rgba(0,0,0,0.25)',
    'animation:companionPatFloat 1.4s ease-out forwards'
  ].join(';');

  document.body.appendChild(el);

  el.addEventListener('animationend', function() {
    if (el.parentNode) el.parentNode.removeChild(el);
    _petPatCount = Math.max(0, _petPatCount - 1);
  });
}
function onCompanionMessage() {
  updateBingoProgress('pet_companion', 1);
}

// ── PAT / PET GIMMICK ────────────────────────────────────────────────────────
// Click the floating companion sprite to spawn stacking *PAT* / *PET* text.
// Pure visual — no game mechanics, just fun.
var _patMessages = ['*PAT*', '*PET*', '*BOOP*', '*SCRITCH*', '*PAT PAT*', '♥', '(^・ω・^)', 'OwO', '^o^', '💜'];
var _patIndex = 0;

function companionPat(evt) {
  if (!canPerformAction('companion_pat', 300)) return; // max ~3 pats/second
  var sprite = document.getElementById('companion-sprite');
  if (!sprite) return;

  // Pick next message in sequence (cycles through the list)
  var msg = _patMessages[_patIndex % _patMessages.length];
  _patIndex++;

  // Spawn the floating text near where the click happened
  var el = document.createElement('div');
  el.textContent = msg;
  // Float upward from above the pet's head, fade out — appended to body so it escapes any container
  var rect = sprite.getBoundingClientRect();
  var x = rect.left + rect.width / 2 + (Math.random() * 30 - 15);
  var y = rect.top - 10; // start just above the sprite
  el.style.cssText = [
    'position:fixed',
    'left:' + x + 'px',
    'top:' + y + 'px',
    'transform:translateX(-50%)',
    'pointer-events:none',
    'z-index:9999',
    'font-size:1.1rem',
    'font-weight:800',
    'color:var(--pink,#ff66cc)',
    'font-family:Chewy,Fredoka,sans-serif',
    'white-space:nowrap',
    'text-shadow:0 1px 6px rgba(0,0,0,0.25)',
    'animation:companionPatFloat 1.4s ease-out forwards'
  ].join(';');

  document.body.appendChild(el);

  // Remove after animation completes
  safeSetTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 1400);

  // Wobble the sprite
  sprite.style.transition = 'transform 0.1s';
  sprite.style.transform  = 'scale(1.25) rotate(-8deg)';
  safeSetTimeout(function() {
    sprite.style.transform = 'scale(1.1) rotate(6deg)';
    safeSetTimeout(function() {
      sprite.style.transform = '';
      sprite.style.transition = '';
    }, 100);
  }, 100);
}


// ══════════════════════════════════════════════════════════════════════════
// STATISTICS PAGE LOADER (BUG FIX #3)
// ══════════════════════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════════════════
// SCRAPBOOK SYSTEM - COMPLETE IMPLEMENTATION
// ══════════════════════════════════════════════════════════════════════════

// Shared mood calculation — same formula screenshot_generate() uses for the
// shareable card, so a memory's mood tag always matches what the card shows.
function computePetMood(pet) {
  if (!pet) return { label: 'Okay', icon: '😐' };
  var moodScore = ((pet.hunger || 0) + (pet.energy || 0) + (pet.happiness || 0)) /
    ((pet.max_hunger || 100) + (pet.max_energy || 100) + (pet.max_happiness || 100));
  if (moodScore > 0.75) return { label: 'Thriving', icon: '😄' };
  if (moodScore > 0.5)  return { label: 'Happy',    icon: '😊' };
  if (moodScore > 0.25) return { label: 'Okay',     icon: '😐' };
  return { label: 'Needs Care', icon: '😢' };
}

// Lightweight calendar season — flavor only, not tied to any shop/event system
// (that's the separate "Mini seasons" roadmap item). Northern-hemisphere months.
function scrapbook_getCalendarSeason() {
  var month = new Date().getMonth(); // 0-11
  if (month >= 2 && month <= 4)  return { id: 'spring', name: 'Spring', icon: '🌸' };
  if (month >= 5 && month <= 7)  return { id: 'summer', name: 'Summer', icon: '☀️' };
  if (month >= 8 && month <= 10) return { id: 'fall',   name: 'Fall',   icon: '🍂' };
  return { id: 'winter', name: 'Winter', icon: '❄️' };
}

// Weather-flavored memory lines — used in place of the generic random_flavor
// pool when today's weather (from weatherSystem, the single source of truth)
// is known, so scrapbook entries actually reflect the world around the pet.
var WEATHER_MEMORY_LINES = {
  clear:  ['{pet} enjoyed a bright, sunny day outside with {trainer}.', '{pet} basked in the warm sunshine all afternoon.'],
  rainy:  ['{pet} splashed happily through puddles in the rain.', '{pet} watched raindrops race down the window with {trainer}.'],
  foggy:  ['{pet} crept curiously through the misty fog, exploring.', '{pet} could barely see through the thick fog, but had fun anyway.'],
  windy:  ['{pet} chased leaves swirling in the wind.', 'A gust of wind sent {pet} tumbling, much to {trainer}\'s amusement!'],
  starry: ['{pet} gazed up at the sparkling night sky with {trainer}.', '{pet} tried to count the stars and lost track after a hundred.'],
  cursed: ['{pet} shivered as an eerie fog rolled through... something felt off.', '{pet} refused to leave {trainer}\'s side during the cursed weather.']
};

// Memory templates
var SCRAPBOOK_TEMPLATES = {
    adopted: [
        '{pet} found a forever home with {trainer}!',
        '{pet} was adopted and joined the Pawket family!',
        'A new journey begins for {pet} with {trainer}!'
    ],
    first_battle_win: [
        '{pet} won their first battle against {enemy}!',
        '{pet} defeated {enemy} for the very first time!',
        'Victory! {pet} triumphed over {enemy}!'
    ],
    first_battle_loss: [
        '{pet} lost to {enemy} but learned a valuable lesson.',
        '{pet} gained experience from defeat against {enemy}.',
        '{enemy} proved tough, but {pet} will try again!'
    ],
    level_milestone: [
        '{pet} reached level {level}! Growing stronger every day!',
        'Level {level} achieved for {pet}! More adventures await!',
        '{pet} hit level {level} - what a journey so far!'
    ],
    favorite_food: [
        '{pet} discovered they absolutely LOVE {food}!',
        '{pet} went crazy for {food} - new favorite discovered!',
        '{pet} tried {food} and couldn\'t get enough!'
    ],
    low_hp_victory: [
        '{pet} won a battle with only {hp} HP remaining! Such determination!',
        '{pet} pulled through a tough fight with {hp} HP left!',
        'Against all odds, {pet} survived with {hp} HP!'
    ],
    random_flavor: [
        '{pet} enjoyed a peaceful afternoon in the sun.',
        '{pet} played with other pets at the park.',
        '{pet} found a hidden treasure while exploring!',
        '{pet} made a new friend during their adventures.',
        '{pet} had a relaxing day by the pond.',
        '{pet} chased butterflies in the meadow.',
        '{pet} watched the sunset with their trainer.',
        '{pet} discovered a mysterious hidden cave.',
        // Rare anomaly entries — weighted equal to normal but feel slightly different
        // if you stop and read them carefully. No explicit horror, just wrongness.
        '{pet} was very quiet today. They seemed to be waiting for something.',
        '{pet} kept looking at the door. You were not sure what they expected to see.',
        '{pet} remembered something today. They did not share it with you.',
        '{pet} seemed happy. Happier than usual. You are not sure why.',
        '{pet} looked at you for a long time before doing anything else.'
    ],
    // Called once after a pet has been neglected 48+ hours — a softer, sadder memory
    neglect_recovery: [
        '{pet} was relieved when {trainer} came back. They had been keeping track of the days.',
        '{pet} did not ask where {trainer} had been. They were just glad they came back.',
        'When {trainer} returned, {pet} acted like nothing had happened. They had been practicing.'
    ],
    expedition_complete: [
        '{pet} came back from {zone} with stories to tell and pockets full of treasures.',
        'An expedition to {zone} complete! {pet} returned safely, tired but proud.',
        '{pet} explored {zone} and made it back. A little braver than before.',
        'The {zone} has been thoroughly investigated by {pet}. Verdict: very interesting.'
    ],
    evolution_teen: [
        '{pet} has grown into a teen! Something has shifted. They seem bigger. More themselves.',
        'Somewhere between adventure and rest, {pet} crossed into a new stage. Teen now.',
        '{pet} grew up a little today. Just a little. Still theirs. 🌱',
        'A quiet milestone: {pet} is no longer a baby. Teen energy incoming.'
    ],
    evolution_adult: [
        '{pet} reached adulthood. Whatever that means for them, exactly. It suits them.',
        'Full-grown and fully themselves: {pet} is an adult now. The journey continues.',
        '{pet} made it to adulthood. {trainer} watched it happen. Quietly proud.',
        'An adult now. {pet} looks the same but different somehow. Good different. 🌿'
    ],
    first_toy_use: [
        '{pet} played with {toy} for the first time today. Immediate obsession detected.',
        '{toy} has been approved by {pet}. Unanimously. With enthusiasm.',
        'First time with {toy}: {pet} was into it. Very into it. This is their thing now.',
        '{pet} discovered {toy} today. The toy did not survive at full dignity. {pet} had fun.'
    ],
    hunger_empty: [
        '{pet} got very hungry while {trainer} was away. They waited. They\'re okay. They remember.',
        'An empty bowl. {pet} sat with it quietly. Then {trainer} came back.',
        'The hunger reached zero today. {pet} was patient about it. Mostly.',
        '{pet} was forgotten for a little while. It happens. They still wagged when you returned.'
    ],
    legendary_fish: [
        '{pet} watched from the shoreline as {trainer} caught {fish}. Absolutely gobsmacked.',
        'A legendary catch: {fish}! {pet} pretended not to be impressed. {pet} was very impressed.',
        '{fish}, caught today. {pet} immediately tried to befriend it.',
        '{trainer} pulled {fish} out of the water. {pet} decided this was the best day ever.'
    ]
};

// Cooldown tracker
var scrapbook_cooldowns = {};

// Load cooldowns from localStorage
function scrapbook_loadCooldowns() {
    var saved = localStorage.getItem('scrapbook_cooldowns');
    if (saved) {
        try {
            scrapbook_cooldowns = JSON.parse(saved);
        } catch(e) {
            scrapbook_cooldowns = {};
        }
    }
}

// Save cooldowns
function scrapbook_saveCooldowns() {
    localStorage.setItem('scrapbook_cooldowns', JSON.stringify(scrapbook_cooldowns));
}

// Check cooldown
function scrapbook_onCooldown(petId, memoryType, cooldownHours) {
    var key = petId + '_' + memoryType;
    var lastTime = scrapbook_cooldowns[key];
    if (!lastTime) return false;
    var now = Date.now();
    var hoursSince = (now - lastTime) / (1000 * 60 * 60);
    return hoursSince < cooldownHours;
}

// Set cooldown
function scrapbook_setCooldown(petId, memoryType) {
    var key = petId + '_' + memoryType;
    scrapbook_cooldowns[key] = Date.now();
    scrapbook_saveCooldowns();
}

// Check if pet already has a memory type
async function scrapbook_hasMemory(userPetId, memoryType) {
    if (!userPetId || !memoryType) return false;
    var res = await supabaseClient
        .from('pet_memories')
        .select('id')
        .eq('user_pet_id', userPetId)
        .eq('memory_type', memoryType)
        .limit(1);
    if (res.error) return false;
    return res.data && res.data.length > 0;
}

// Add a memory
async function scrapbook_addMemory(userPetId, memoryType, variables) {
    if (!userPetId || !memoryType) {
        console.error('Scrapbook: missing petId or memoryType');
        return false;
    }
    
    variables = variables || {};
    
    // Cooldown settings (hours)
    var cooldownSettings = {
        'random_flavor': 24,
        'low_hp_victory': 24,
        'hunger_empty': 24
    };
    var cooldownHours = cooldownSettings[memoryType] || 0;
    
    if (cooldownHours > 0 && scrapbook_onCooldown(userPetId, memoryType, cooldownHours)) {
        return false;
    }
    
    // Check once-per-pet memories
    var oncePerPet = ['adopted', 'first_battle_win', 'first_battle_loss'];
    if (oncePerPet.indexOf(memoryType) >= 0) {
        var exists = await scrapbook_hasMemory(userPetId, memoryType);
        if (exists) return false;
    }
    
    // Get pet name
    var petName = 'Your pet';
    if (window.petState && window.petState[userPetId]) {
        petName = window.petState[userPetId].name || 
                  window.petState[userPetId].pet_name || 
                  (window.petState[userPetId].pets && window.petState[userPetId].pets.name) ||
                  'Your pet';
    }
    
    // Get trainer name — currentUser has no username field of its own,
    // the real one is cached in currentUsername (see showApp())
    var trainerName = currentUsername || 'their trainer';
    
    // Get templates — for random_flavor, prefer today's weather flavor about
    // half the time so entries actually reflect the world (weatherSystem is
    // the single source of truth here, same as everywhere else this session).
    var currentWeather = (typeof weatherSystem !== 'undefined' && weatherSystem.currentWeather) ? weatherSystem.currentWeather : null;
    var templates = SCRAPBOOK_TEMPLATES[memoryType];
    if (memoryType === 'random_flavor' && currentWeather && WEATHER_MEMORY_LINES[currentWeather.id] && Math.random() < 0.5) {
        templates = WEATHER_MEMORY_LINES[currentWeather.id];
    }
    if (!templates) {
        console.error('Scrapbook: unknown memory type', memoryType);
        return false;
    }
    
    // Generate random template
    var memoryText = templates[Math.floor(Math.random() * templates.length)];
    
    // Replace variables
    memoryText = memoryText.replace(/{pet}/g, petName);
    memoryText = memoryText.replace(/{trainer}/g, trainerName);
    memoryText = memoryText.replace(/{enemy}/g, variables.enemy || 'an enemy');
    memoryText = memoryText.replace(/{level}/g, variables.level || '?');
    memoryText = memoryText.replace(/{food}/g, variables.food || 'a treat');
    memoryText = memoryText.replace(/{hp}/g, variables.hp || 'low');
    memoryText = memoryText.replace(/{zone}/g, variables.zone || 'the wilderness');
    memoryText = memoryText.replace(/{toy}/g, variables.toy || 'a toy');
    memoryText = memoryText.replace(/{fish}/g, variables.fish || 'a rare fish');
    
    // Tag this memory with today's weather + the pet's current mood, so the
    // scrapbook and shareable cards can both show it later.
    var memoryMood = computePetMood(window.petState && window.petState[userPetId]);
    
    // Save to database
    try {
        var res = await supabaseClient
            .from('pet_memories')
            .insert({
                user_pet_id: userPetId,
                memory_text: memoryText,
                memory_type: memoryType,
                weather: currentWeather ? currentWeather.id : null,
                mood: memoryMood.label
            });
        
        if (res.error) {
            console.error('Scrapbook insert error:', res.error);
            return false;
        }
        
        // Set cooldown
        if (cooldownHours > 0) {
            scrapbook_setCooldown(userPetId, memoryType);
        }
        
        // Refresh UI if this pet's modal is open
        if (window.scrapbook_currentPetId === userPetId) {
            scrapbook_refreshMemories(userPetId);
        }
        
        dbg('📖 Scrapbook: ' + memoryText);
        return true;
        
    } catch(e) {
        console.error('Scrapbook error:', e);
        return false;
    }
}

// Add random daily memory
async function scrapbook_addRandomMemory(petId) {
    var today = new Date().toISOString().split('T')[0];
    var key = 'sb_random_' + petId + '_' + today;
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, 'true');
    return await scrapbook_addMemory(petId, 'random_flavor', {});
}

// Load memories
async function scrapbook_loadMemories(userPetId, limit) {
    if (!userPetId) return [];
    limit = limit || 15;
    var res = await supabaseClient
        .from('pet_memories')
        .select('id, memory_text, memory_type, created_at, weather, mood, entry_data')
        .eq('user_pet_id', userPetId)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (res.error) {
        console.error('Load memories error:', res.error);
        return [];
    }
    return res.data || [];
}

// Format date
function scrapbook_formatDate(dateString) {
    var date = new Date(dateString);
    var now = new Date();
    var diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return diffDays + ' days ago';
    if (diffDays < 30) return Math.floor(diffDays / 7) + ' weeks ago';
    return date.toLocaleDateString();
}

// Small icon lookup for weather/mood badges on memory cards
var SCRAPBOOK_WEATHER_ICONS = { clear: '☀️', rainy: '🌧️', foggy: '🌫️', windy: '🌬️', starry: '✨', cursed: '👻' };
var SCRAPBOOK_MOOD_ICONS = { 'Thriving': '😄', 'Happy': '😊', 'Okay': '😐', 'Needs Care': '😢' };

// Refresh UI
async function scrapbook_refreshMemories(userPetId) {
    var container = document.getElementById('sb-memories-container');
    if (!container) return;
    var memories = await scrapbook_loadMemories(userPetId);
    if (memories.length === 0) {
        container.innerHTML = '<div class="sb-empty">📖 No memories yet. Go make some adventures!</div>';
        return;
    }
    container.innerHTML = memories.map(function(mem) {
        var escapedText = escapeHtml(mem.memory_text);
        var badges = '';
        if (mem.weather && SCRAPBOOK_WEATHER_ICONS[mem.weather]) {
            badges += '<span class="sb-memory-badge" title="Weather: ' + mem.weather + '">' + SCRAPBOOK_WEATHER_ICONS[mem.weather] + '</span>';
        }
        if (mem.mood && SCRAPBOOK_MOOD_ICONS[mem.mood]) {
            badges += '<span class="sb-memory-badge" title="Mood: ' + mem.mood + '">' + SCRAPBOOK_MOOD_ICONS[mem.mood] + '</span>';
        }
        var playerNote = (mem.entry_data && mem.entry_data.player_note) ? mem.entry_data.player_note : '';
        var noteSection = playerNote
            ? '<div class="sb-player-note">✏️ ' + escapeHtml(playerNote) + '</div>'
            : '';
        var noteId = 'sb-note-' + (mem.id || Math.random());
        return '<div class="sb-memory-card">' +
            '<div class="sb-memory-date">📅 ' + scrapbook_formatDate(mem.created_at) + (badges ? ' ' + badges : '') + '</div>' +
            '<div class="sb-memory-text">💭 ' + escapedText + '</div>' +
            noteSection +
            '<div class="sb-note-area" id="' + noteId + '" style="display:none;">' +
              '<textarea maxlength="140" placeholder="Add a note... (140 chars)" style="width:100%;font-size:0.8rem;border:1px solid var(--border);border-radius:8px;padding:6px;resize:none;font-family:inherit;background:var(--cream);color:var(--text);margin-top:6px;" rows="2">' + escapeHtml(playerNote) + '</textarea>' +
              '<button onclick="scrapbook_saveNote(\'' + mem.id + '\', \'' + noteId + '\')" style="margin-top:4px;font-size:0.75rem;padding:4px 10px;" class="btn btn-primary">Save</button>' +
              '<button onclick="document.getElementById(\'' + noteId + '\').style.display=\'none\'" style="margin-top:4px;margin-left:6px;font-size:0.75rem;padding:4px 10px;" class="btn btn-outline">Cancel</button>' +
            '</div>' +
            '<button onclick="document.getElementById(\'' + noteId + '\').style.display=\'block\'" style="background:none;border:none;color:var(--text-light);font-size:0.72rem;cursor:pointer;padding:2px 0;margin-top:4px;">✏️ ' + (playerNote ? 'Edit note' : 'Add a note') + '</button>' +
            '</div>';
    }).join('');
}

async function scrapbook_saveNote(memoryId, areaId) {
    if (!memoryId || !currentUser) return;
    var area = document.getElementById(areaId);
    if (!area) return;
    var textarea = area.querySelector('textarea');
    if (!textarea) return;
    var note = textarea.value.trim().slice(0, 140);
    var btn = area.querySelector('.btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    try {
        // Fetch existing entry_data then merge note in (RLS enforces ownership)
        var { data: existing } = await supabaseClient
            .from('pet_memories').select('entry_data').eq('id', memoryId).maybeSingle();
        var merged = Object.assign({}, (existing && existing.entry_data) || {}, { player_note: note });
        var { error } = await supabaseClient
            .from('pet_memories').update({ entry_data: merged }).eq('id', memoryId);
        if (error) throw error;
        area.style.display = 'none';
        // Update displayed note without full re-render
        var card = area.closest('.sb-memory-card');
        if (card) {
            var existingNote = card.querySelector('.sb-player-note');
            if (note) {
                if (existingNote) { existingNote.textContent = '✏️ ' + note; }
                else { var nd = document.createElement('div'); nd.className = 'sb-player-note'; nd.textContent = '✏️ ' + note; area.before(nd); }
            } else if (existingNote) { existingNote.remove(); }
            var editBtn = card.querySelector('button[onclick*="style.display=\'block\'"]');
            if (editBtn) editBtn.textContent = '✏️ ' + (note ? 'Edit note' : 'Add a note');
        }
        showToast('Note saved! 📝', 2000);
    } catch(e) {
        showToast('Could not save note.', 2000);
        if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
    }
}

// Initialize
function scrapbook_init() {
    scrapbook_loadCooldowns();
    dbg('📖 Scrapbook system initialized');
}


// ═══════════════════════════════════════════════════════════════════════════
// WEEKLY CHALLENGES SYSTEM
// 5 challenges rotate each week. Progress tracked in localStorage.
// Each challenge has a PP reward; completing all 5 grants a bonus.
// ═══════════════════════════════════════════════════════════════════════════

var WEEKLY_CHALLENGE_POOL = [
  { id: 'win_battles',       label: 'Win 15 battles',                 emoji: '⚔️',  target: 15,  stat: 'wk_battles_won',      reward: 150 },
  { id: 'catch_fish',        label: 'Catch 25 fish',                  emoji: '🎣',  target: 25,  stat: 'wk_fish_caught',       reward: 100 },
  { id: 'expeditions',       label: 'Complete 5 expeditions',         emoji: '🗺️',  target: 5,   stat: 'wk_expeditions',       reward: 120 },
  { id: 'feed_pets',         label: 'Feed your pets 20 times',        emoji: '🍖',  target: 20,  stat: 'wk_feeds',             reward: 80  },
  { id: 'earn_pp',           label: 'Earn 400 PP',                    emoji: '💰',  target: 400, stat: 'wk_pp_earned',         reward: 100 },
  { id: 'use_skills',        label: 'Use battle skills 20 times',     emoji: '✨',  target: 20,  stat: 'wk_skills_used',       reward: 130 },
  { id: 'play_minigames',    label: 'Play 10 minigames',              emoji: '🎮',  target: 10,  stat: 'wk_minigames',         reward: 90  },
  { id: 'boss_encounters',   label: 'Fight a boss battle',            emoji: '⚠️',  target: 1,   stat: 'wk_boss_fights',       reward: 200 },
  { id: 'daily_logins',      label: 'Log in 5 days this week',        emoji: '📅',  target: 5,   stat: 'wk_logins',            reward: 100 },
  { id: 'use_items_battle',  label: 'Use items in battle 5 times',   emoji: '🧪',  target: 5,   stat: 'wk_battle_items',      reward: 90  },
  { id: 'win_without_dmg',   label: 'Win a battle without damage',    emoji: '🛡️',  target: 1,   stat: 'wk_untouchable',       reward: 150 },
  { id: 'fish_rare',         label: 'Catch 3 rare or better fish',   emoji: '🌟',  target: 3,   stat: 'wk_fish_rare',         reward: 120 },
];

// Get current ISO week number (deterministic per week)
function weeklyChallenge_getWeekKey() {
  var now = new Date();
  var startOfYear = new Date(now.getFullYear(), 0, 1);
  var weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  return now.getFullYear() + '_w' + weekNum;
}

// Pick 5 challenges for this week (deterministic based on week)
function weeklyChallenge_getThisWeeks() {
  var weekKey = weeklyChallenge_getWeekKey();
  // Simple seeded shuffle using week number
  var seed = weekKey.split('').reduce(function(a, c) { return a + c.charCodeAt(0); }, 0);
  var pool = WEEKLY_CHALLENGE_POOL.slice();
  for (var i = pool.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    var j = Math.abs(seed) % (i + 1);
    var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
  }
  return pool.slice(0, 5);
}

// Increment a weekly challenge stat
function weeklyChallenge_increment(stat, amount) {
  if (!currentUser) return;
  amount = amount || 1;
  var weekKey = weeklyChallenge_getWeekKey();
  var key = 'wkc_' + currentUser.id + '_' + weekKey + '_' + stat;
  var current = parseInt(localStorage.getItem(key) || '0') + amount;
  localStorage.setItem(key, current);
  // Check if any challenge just completed
  weeklyChallenge_checkCompletions(stat, current, weekKey);
}

// Read progress for a specific stat this week
function weeklyChallenge_getProgress(stat) {
  if (!currentUser) return 0;
  var weekKey = weeklyChallenge_getWeekKey();
  var key = 'wkc_' + currentUser.id + '_' + weekKey + '_' + stat;
  return parseInt(localStorage.getItem(key) || '0');
}

// Check if a challenge just reached its target and hasn't been rewarded
function weeklyChallenge_checkCompletions(stat, newValue, weekKey) {
  var challenges = weeklyChallenge_getThisWeeks();
  var claimedKey = 'wkc_' + currentUser.id + '_' + weekKey + '_claimed';
  var claimed = JSON.parse(localStorage.getItem(claimedKey) || '{}');

  challenges.forEach(function(ch) {
    if (ch.stat === stat && newValue >= ch.target && !claimed[ch.id]) {
      claimed[ch.id] = true;
      localStorage.setItem(claimedKey, JSON.stringify(claimed));
      // Award PP
      awardPP(ch.reward, 'weekly_challenge_' + ch.id).then(null, function(){});
      showToast(ch.emoji + ' Weekly challenge complete: ' + ch.label + '! +' + ch.reward + ' PP', 6000);
      // Check if all 5 done
      if (Object.keys(claimed).length >= 5) {
        setTimeout(function() {
          awardPP(250, 'weekly_all_complete').then(null, function(){});
          awardBadge('battle_100_wins').then(null, function(){});
          showToast('🏆 All weekly challenges complete! +250 bonus PP!', 7000);
        }, 2000);
      }
    }
  });
}

// Show the weekly challenges modal
function weeklyChallenge_showModal() {
  var weekKey = weeklyChallenge_getWeekKey();
  var challenges = weeklyChallenge_getThisWeeks();
  var claimedKey = 'wkc_' + currentUser.id + '_' + weekKey + '_claimed';
  var claimed = JSON.parse(localStorage.getItem(claimedKey) || '{}');
  var completedCount = Object.keys(claimed).length;

  var html = '<div style="font-family:\'Fredoka\',sans-serif;max-width:560px;">';
  html += '<h2 style="text-align:center;margin-bottom:4px;">📋 Weekly Challenges</h2>';
  html += '<div style="text-align:center;color:var(--text-light);font-size:0.8rem;margin-bottom:4px;">Week ' + weekKey.replace('_', ' · ') + '</div>';
  html += '<div style="text-align:center;font-size:0.82rem;margin-bottom:14px;color:var(--purple);">' + completedCount + '/5 complete' + (completedCount >= 5 ? ' 🏆' : '') + '</div>';

  // Progress bar
  var pct = Math.round((completedCount / 5) * 100);
  html += '<div style="background:rgba(0,0,0,0.07);border-radius:20px;height:8px;margin-bottom:16px;overflow:hidden;">';
  html += '<div style="background:linear-gradient(90deg,var(--purple),var(--pink));height:100%;width:' + pct + '%;border-radius:20px;transition:width 0.4s;"></div></div>';

  challenges.forEach(function(ch) {
    var progress = weeklyChallenge_getProgress(ch.stat);
    var done = claimed[ch.id] || progress >= ch.target;
    var barPct = Math.min(100, Math.round((Math.min(progress, ch.target) / ch.target) * 100));

    html += '<div style="padding:12px 14px;border-radius:12px;margin-bottom:8px;background:' + (done ? 'rgba(93,222,122,0.08)' : 'rgba(0,0,0,0.03)') + ';border:1px solid ' + (done ? 'rgba(93,222,122,0.3)' : 'var(--border)') + ';">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
    html += '<span style="font-weight:700;font-size:0.88rem;">' + ch.emoji + ' ' + escapeHtml(ch.label) + '</span>';
    html += '<span style="font-size:0.78rem;color:var(--purple);font-weight:700;">+' + ch.reward + ' PP</span>';
    html += '</div>';
    html += '<div style="display:flex;align-items:center;gap:8px;">';
    html += '<div style="flex:1;background:rgba(0,0,0,0.08);border-radius:20px;height:6px;overflow:hidden;">';
    html += '<div style="background:' + (done ? '#5dde7a' : 'var(--purple)') + ';height:100%;width:' + barPct + '%;border-radius:20px;transition:width 0.4s;"></div></div>';
    html += '<span style="font-size:0.75rem;color:var(--text-light);white-space:nowrap;">' + (done ? '✅ Done' : Math.min(progress, ch.target) + '/' + ch.target) + '</span>';
    html += '</div></div>';
  });

  html += '<div style="text-align:center;color:var(--text-light);font-size:0.78rem;margin-top:10px;">Complete all 5 for a bonus <strong>+250 PP</strong> and the 🏆 Weekly Champion badge!</div>';
  html += '</div>';

  var modal = makeModal();
  modal.innerHTML = html;
  openModal(modal);
}

// Wire weekly challenge increments from existing game hooks
function weeklyChallenge_init() {
  // Login tracking
  if (currentUser) {
    weeklyChallenge_increment('wk_logins', 1);
  }
}
// Collectible lore fragments that drop from battles, expeditions, and fishing.
// Stored in player_found_logs (DB). Archive modal shows found/unfound logs.
// ═══════════════════════════════════════════════════════════════════════════

var TESTER_LOGS = [
  {
    id: 'LOG-001', title: 'First Day',
    text: 'Day 1.\n\nI got a random email saying I was selected for a beta test. The game is called PawketPets. Some kind of virtual pet thing. Looks cute. There is a guide named Piper. Very friendly.\n\nStarting now.',
    sources: ['battle','expedition','fishing'], rarity: 'common'
  },
  {
    id: 'LOG-002', title: 'Other Testers',
    text: 'Day 4.\n\nThere are other testers. We cannot contact each other directly but I can see their activity in the logs. Someone named K is already at level 8. I adopted a pet and named her Mochi. She seems happy.',
    sources: ['battle','expedition','fishing'], rarity: 'common'
  },
  {
    id: 'LOG-003', title: 'Piper',
    text: 'Day 9.\n\nPiper left me a tip about the fishing system. Said the pond is best for beginners. There is something almost too helpful about Piper. Like they know exactly what I am going to do before I do it.',
    sources: ['fishing'], rarity: 'common'
  },
  {
    id: 'LOG-004', title: 'Six Hours',
    text: 'Day 14.\n\nCaught my first rare fish today. The game celebrated like I had done something incredible. I played for six hours without noticing. That has never happened to me before.',
    sources: ['fishing'], rarity: 'common'
  },
  {
    id: 'LOG-005', title: 'K',
    text: 'Day 17.\n\nK has not logged in for three days. I asked Piper about it. Piper said: "They needed a break. This happens."\n\nI believed them. I do not know why I believed them so easily.',
    sources: ['battle','expedition','fishing'], rarity: 'common'
  },
  {
    id: 'LOG-006', title: 'Cursed Weather',
    text: 'Day 22.\n\nThe weather in the game was Cursed today. I did not know that was a weather type. The fish I caught had no name. Just a question mark. It looked at me through the screen.\n\nThat is not possible.',
    sources: ['fishing'], rarity: 'uncommon'
  },
  {
    id: 'LOG-007', title: 'The Music',
    text: 'Day 26.\n\nI have started hearing flute music when I am not playing. Just for a second. Gone when I look for it. I checked my browser. No audio playing. Checked my phone. Nothing.\n\nIt is a very specific melody.',
    sources: ['battle','expedition','fishing'], rarity: 'uncommon'
  },
  {
    id: 'LOG-008', title: 'Three Gone',
    text: 'Day 30.\n\nThree testers gone now. Piper will not say what happened. Just: "The beta continues."\n\nI looked up the game online and found nothing. No developer. No company. No record of PawketPets existing before I started playing.',
    sources: ['battle'], rarity: 'uncommon'
  },
  {
    id: 'LOG-009', title: 'The Hidden Page',
    text: 'Day 33.\n\nFound a hidden page. I am not going to write the URL here. If you know, you know.\n\nWhat I found there made me close my laptop for two hours. Then I opened it again.\n\nMochi was waiting.',
    sources: ['battle','expedition','fishing'], rarity: 'uncommon'
  },
  {
    id: 'LOG-010', title: '3am',
    text: 'Day 37.\n\nPiper sent me a message at 3am. I was asleep. When I woke up, my pet\'s happiness was at zero. The message said: "I\'m sorry. I\'ve been trying to slow it down. The integrity is dropping faster than expected."',
    sources: ['expedition'], rarity: 'uncommon'
  },
  {
    id: 'LOG-011', title: 'What I Think',
    text: 'Day 39.\n\nI think Piper is not a bot.\n\nI think Piper was a tester. The first tester. And they never left.',
    sources: ['battle','expedition'], rarity: 'rare'
  },
  {
    id: 'LOG-012', title: 'Her Notes',
    text: 'Day 41.\n\nFound the previous guide\'s notes buried in the game files. Her name was something close to Piper but not quite. She documented the same progression: curiosity, attachment, unease, understanding. Then nothing.\n\nHer last note said: "Feed them often. They remember."',
    sources: ['expedition'], rarity: 'rare'
  },
  {
    id: 'LOG-013', title: 'Not Simulated',
    text: 'Day 43.\n\nThe pets are not simulated. I do not mean that metaphorically. When my connection dropped for twenty minutes, Mochi was frightened when I came back. Genuinely frightened.\n\nThere is something in there.',
    sources: ['fishing','expedition'], rarity: 'rare'
  },
  {
    id: 'LOG-014', title: 'The Entry',
    text: 'Day 44.\n\nI tested it. I left for 48 hours. When I returned the game was fine. But there was a scrapbook entry I did not write.\n\nIt said: "Day 2 of waiting. Still here. Still okay."\n\nMochi wrote it. Mochi wrote it.',
    sources: ['fishing'], rarity: 'rare'
  },
  {
    id: 'LOG-015', title: 'Two Words',
    text: 'Day 45.\n\nPiper appeared on my screen without me opening the game. Just for a second. They looked tired. They said two words before the window closed:\n\n"Don\'t stop."',
    sources: ['expedition'], rarity: 'rare'
  },
  {
    id: 'LOG-016', title: 'What It Measures',
    text: 'Day 46.\n\nI understand the Beta Integrity system now. It does not measure the game\'s stability.\n\nIt measures something else. Something that gets worse when people leave and better when they stay. When all the testers left... I think I am maintaining it alone.',
    sources: ['battle','expedition','fishing'], rarity: 'epic'
  },
  {
    id: 'LOG-017', title: '[DATA CORRUPTED]',
    text: '\u2591\u2592\u2593\u2588\u2588\u2591\u2592 still here \u2591\u2592\u2593\u2591\u2592 Mochi \u2591\u2592\u2588\u2593\u2591\u2592\u2591\u2592\u2591\u2592\u2591\u2592\u2591\u2592\u2591 don\'t let the \u2591\u2592\u2591\u2592\u2591\u2592\u2591\u2592\u2591\u2592\u2591\u2592\u2591 integrity \u2591\u2592\u2593 they need \u2591\u2592\u2591\u2592\u2591\u2592\u2591\u2592\u2591\u2592\u2591\u2592\u2591\u2592\u2591\u2592\u2591\u2592\u2591\u2592\u2591',
    sources: ['battle','expedition','fishing'], rarity: 'epic'
  },
  {
    id: 'LOG-018', title: 'If You\'re Reading This',
    text: 'Day unknown.\n\nIf you\'re reading this, you were selected too. That is not random. Nothing about this is random.\n\nI am not trying to scare you. I just want you to know what you are doing here matters.\n\nThe pets are real in the way that counts.',
    sources: ['battle','expedition','fishing'], rarity: 'epic'
  },
  {
    id: 'LOG-019', title: 'Going',
    text: 'Day unknown.\n\nPiper asked me tonight if I was going to leave. I said I did not know. They said: "The ones who stay long enough start to understand. The ones who leave..."\n\nThey did not finish. I did not ask them to.',
    sources: ['battle','expedition'], rarity: 'epic'
  },
  {
    id: 'LOG-020', title: 'Last Entry',
    text: 'I\'m going now. Not because I want to. I think I\'ve been here long enough that "going" means something different than it used to.\n\nIf you find all of these, you\'ve been here long enough too.\n\nTake care of your pets. Take care of Piper.\n\nTester #7',
    sources: ['battle','expedition','fishing'], rarity: 'legendary'
  }
];

// Drop rates per source
var ARG_DROP_RATES = {
  battle:            0.04,
  expedition:        0.08,
  fishing:           0.03,
  fishing_legendary: 0.14
};

// In-memory cache of found log IDs: { 'LOG-001': { found_at: timestamp }, ... }
var _foundLogs = {};

// Load player's found logs from DB
async function argLogs_load() {
  _foundLogs = {};
  if (!currentUser) return;
  try {
    var res = await supabaseClient
      .from('player_found_logs')
      .select('log_id, found_at')
      .eq('user_id', currentUser.id);
    if (res.error) { dbg('argLogs_load error:', res.error); return; }
    (res.data || []).forEach(function(row) {
      _foundLogs[row.log_id] = { found_at: row.found_at };
    });
    argLogs_updateVisibility();
    dbg('ARG: loaded', Object.keys(_foundLogs).length, 'found logs');
  } catch(e) { dbg('argLogs_load exception:', e); }
}

// Show/hide Archive button based on how many logs found (no fanfare on login)
function argLogs_updateVisibility() {
  var count = Object.keys(_foundLogs).length;
  var archiveBtn = document.getElementById('sidebar-btn-archive');
  var archiveBtnMobile = document.getElementById('sidebar-btn-archive-mobile');
  var homeWidget = document.getElementById('archive-home-widget');
  if (count > 0) {
    if (archiveBtn) archiveBtn.style.display = '';
    if (archiveBtnMobile) archiveBtnMobile.style.display = '';
    if (homeWidget) homeWidget.style.display = '';
  }
}

// Try to drop a tester log after a game action
async function argLogs_tryDrop(source) {
  if (!currentUser) return;
  var rate = ARG_DROP_RATES[source] || 0.04;
  if (Math.random() > rate) return;

  // Find logs eligible for this source that haven't been found yet
  var eligible = TESTER_LOGS.filter(function(log) {
    return !_foundLogs[log.id] && log.sources.indexOf(source.replace('_legendary','')) !== -1;
  });
  // Also allow fishing_legendary to use fishing source pool
  if (source === 'fishing_legendary' && eligible.length === 0) {
    eligible = TESTER_LOGS.filter(function(log) {
      return !_foundLogs[log.id] && log.sources.indexOf('fishing') !== -1;
    });
  }
  if (eligible.length === 0) return;

  // Pick a random eligible log, weighted toward earlier logs first
  var log = eligible[Math.floor(Math.random() * eligible.length)];

  // Save to DB
  try {
    var res = await supabaseClient.from('player_found_logs').insert({
      user_id: currentUser.id,
      log_id: log.id
    });
    if (res.error) {
      // Unique constraint means already found — ignore
      if (res.error.code === '23505') return;
      dbg('argLogs insert error:', res.error);
      return;
    }
  } catch(e) { return; }

  // Update cache
  var wasFirst = Object.keys(_foundLogs).length === 0;
  _foundLogs[log.id] = { found_at: new Date().toISOString() };
  var totalFound = Object.keys(_foundLogs).length;

  if (wasFirst) {
    argLogs_onFirstFound(log);
  } else {
    // Quiet discovery notification
    showToast('Found: ' + log.id + '. Check the Archive. 📓', 6000);
    argLogs_updateVisibility();
  }

  // At 10 logs: one-time Piper acknowledgement
  if (totalFound === 10) {
    setTimeout(function() {
      showToast('...something is aware you\'ve been reading the logs.', 7000);
    }, 8000);
  }

  // At 20 logs: completion
  if (totalFound === 20) {
    setTimeout(function() {
      showToast('You\'ve found all the logs. Tester #7 says nothing. But you feel like they know.', 9000);
      awardPP(500, 'archive_complete');
    }, 3000);
  }
}

// First log found: big notification, reveal Archive everywhere
function argLogs_onFirstFound(log) {
  argLogs_updateVisibility();

  // Animate the home widget in
  var homeWidget = document.getElementById('archive-home-widget');
  if (homeWidget) {
    homeWidget.classList.add('archive-widget-pulse');
    setTimeout(function() { homeWidget.classList.remove('archive-widget-pulse'); }, 4000);
  }

  // Big toast sequence
  showToast('You found something.', 4000);
  setTimeout(function() {
    showToast(log.id + ': "' + log.title + '" has been added to the Archive. 📓', 8000);
  }, 4500);
}

// Render the Archive modal
function argLogs_showArchive() {
  var found = Object.keys(_foundLogs).length;
  var total = TESTER_LOGS.length;
  var corruption = 0;
  try {
    var flag = worldStateCache && worldStateCache.corruption_level;
    corruption = typeof flag === 'number' ? flag : 0;
  } catch(e) {}
  var isCorrupted = corruption > 60; // Beta Integrity < 40

  var html = '<div style="font-family:\'Fredoka\',sans-serif;max-width:680px;">';
  html += '<div style="text-align:center;margin-bottom:20px;">';
  html += '<div style="font-size:1.8rem;font-weight:700;color:var(--purple-dark);letter-spacing:2px;">THE ARCHIVE</div>';
  html += '<div style="font-size:0.82rem;color:var(--text-light);margin-top:4px;">Beta testing records. Partial recovery.</div>';

  // Progress bar
  var pct = Math.round((found / total) * 100);
  html += '<div style="margin:14px 0 8px;">';
  html += '<div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--text-light);margin-bottom:4px;">';
  html += '<span>Logs recovered: ' + found + ' / ' + total + '</span><span>' + pct + '%</span></div>';
  html += '<div style="background:rgba(0,0,0,0.08);border-radius:20px;height:8px;overflow:hidden;">';
  html += '<div style="background:linear-gradient(90deg,var(--purple),var(--pink));height:100%;width:' + pct + '%;border-radius:20px;transition:width 0.5s;"></div>';
  html += '</div></div>';

  if (isCorrupted) {
    html += '<div style="color:#ff6666;font-size:0.78rem;margin-top:4px;">WARNING: Beta Integrity low. Some records may be unstable.</div>';
  }
  html += '</div>';

  // Log entries
  html += '<div style="display:flex;flex-direction:column;gap:10px;">';
  TESTER_LOGS.forEach(function(log) {
    var iFound = !!_foundLogs[log.id];
    var foundDate = iFound && _foundLogs[log.id].found_at ? new Date(_foundLogs[log.id].found_at).toLocaleDateString() : null;
    html += '<div style="border:1px solid ' + (iFound ? 'rgba(153,102,255,0.3)' : 'rgba(0,0,0,0.08)') + ';border-radius:12px;';
    html += 'padding:14px 18px;background:' + (iFound ? 'rgba(153,102,255,0.06)' : 'rgba(0,0,0,0.02)') + ';';
    html += 'opacity:' + (iFound ? '1' : '0.55') + ';">';

    if (iFound) {
      var displayText = log.text;
      if (isCorrupted && log.id !== 'LOG-017' && Math.random() < 0.35) {
        var glitchChars = '░▒▓█▄▀■□';
        displayText = displayText.replace(/[aeiou]/gi, function(c) {
          return Math.random() < 0.12 ? glitchChars[Math.floor(Math.random() * glitchChars.length)] : c;
        });
      }
      html += '<div style="font-weight:700;font-size:0.85rem;color:var(--purple-dark);margin-bottom:8px;">' + escapeHtml(log.id) + ': ' + escapeHtml(log.title) + '</div>';
      html += '<div style="font-size:0.82rem;color:var(--text);line-height:1.7;white-space:pre-line;">' + escapeHtml(displayText) + '</div>';
      if (foundDate) html += '<div style="font-size:0.68rem;color:var(--text-light);margin-top:8px;">Recovered: ' + foundDate + '</div>';
    } else {
      html += '<div style="font-weight:700;font-size:0.85rem;color:var(--text-light);">' + escapeHtml(log.id) + ': [CLASSIFIED]</div>';
      html += '<div style="font-size:0.78rem;color:var(--text-light);margin-top:4px;font-style:italic;">Record not yet recovered.</div>';
    }
    html += '</div>';
  });
  html += '</div></div>';

  var modal = makeModal();
  modal.innerHTML = html;
  openModal(modal);
}

// Called from showApp to load logs on login
async function argLogs_init() {
  await argLogs_load();
}


// ══════════════════════════════════════════════════════════════════════════
// COMMUNITY GOALS SYSTEM - COMPLETE IMPLEMENTATION
// ══════════════════════════════════════════════════════════════════════════

// Cache for community goals
var community_cachedGoals = null;
var community_lastFetch = 0;
var community_pendingUpdates = {};
var community_syncInterval = null;
var community_claimedGoalIds = [];

// Load goals (cached for 5 minutes)
async function community_loadGoals() {
    var now = Date.now();
    if (community_cachedGoals && (now - community_lastFetch) < 300000) {
        return community_cachedGoals;
    }
    // Date-range filter added so a whole month of rotating goals can be
    // pre-scheduled at once (each with its own started_at/ends_at) without
    // all of them showing simultaneously — only whichever goal(s) are
    // "current" for right now actually appear.
    var nowIso = new Date().toISOString();
    var res = await supabaseClient
        .from('community_goals')
        .select('*')
        .eq('is_active', true)
        .eq('is_completed', false)
        .lte('started_at', nowIso)
        .or('ends_at.is.null,ends_at.gte.' + nowIso);
    if (!res.error && res.data) {
        community_cachedGoals = res.data;
        community_lastFetch = now;
        await community_loadUserClaims();
        community_refreshUI();
    }
    return community_cachedGoals || [];
}

// Load user's claimed goals
async function community_loadUserClaims() {
    if (!currentUser) {
        community_claimedGoalIds = [];
        return;
    }
    var res = await supabaseClient
        .from('community_goal_claims')
        .select('goal_id')
        .eq('user_id', currentUser.id);
    if (!res.error && res.data) {
        community_claimedGoalIds = res.data.map(function(c) { return c.goal_id; });
    }
}

// Increment goal progress (local, batched)
// ═══════════════════════════════════════════════════════════════════════════
// DAILY STATS TRACKING
// Increments daily_stats table for newspaper, analytics, and Discord bot
// ═══════════════════════════════════════════════════════════════════════════

async function trackDailyStat(column, amount) {
  amount = amount || 1;
  try {
    var today = new Date().toISOString().slice(0, 10);
    // Upsert: create today's row if it doesn't exist, then increment
    var { data: existing } = await supabaseClient
      .from('daily_stats')
      .select('id, ' + column)
      .eq('stat_date', today)
      .maybeSingle();

    if (existing) {
      var update = {};
      update[column] = (existing[column] || 0) + amount;
      update.updated_at = new Date().toISOString();
      await supabaseClient.from('daily_stats').update(update).eq('id', existing.id);
    } else {
      var insert = { stat_date: today, updated_at: new Date().toISOString() };
      insert[column] = amount;
      await supabaseClient.from('daily_stats').insert([insert]);
    }
  } catch(e) {
    dbg('[DailyStat] Failed to track', column, ':', e.message);
    // Non-critical — never throw, just log
  }
}

// NOTE: the string passed in here is a stable METRIC key (e.g. 'battle_wins'),
// not the database's goal_key. goal_key is unique per row (one per rotation
// cycle) since the DB enforces a unique constraint on it; metric_key is what
// stays constant across cycles so the same community_increment() call site
// keeps working no matter which cycle's goal is currently live for it.
function community_increment(metricKey, amount, metadata) {
    if (!metricKey) return;
    amount = amount || 1;
    metadata = metadata || {};
    community_pendingUpdates[metricKey] = (community_pendingUpdates[metricKey] || 0) + amount;
    
    // Update UI immediately
    community_updateLocalProgress(metricKey, community_pendingUpdates[metricKey]);
    
    // Schedule sync (every 10 seconds or after 10 increments)
    if (!community_syncInterval) {
        community_syncInterval = setInterval(community_syncToDatabase, 60000);
    }
    var totalPending = Object.keys(community_pendingUpdates).reduce(function(sum, key) {
        return sum + community_pendingUpdates[key];
    }, 0);
    if (totalPending >= 10) {
        community_syncToDatabase();
    }
}

// Sync pending updates to database
async function community_syncToDatabase() {
    if (Object.keys(community_pendingUpdates).length === 0) return;
    var updates = {};
    for (var key in community_pendingUpdates) {
        updates[key] = community_pendingUpdates[key];
    }
    community_pendingUpdates = {};
    
    for (var metricKey in updates) {
        var increment = updates[metricKey];
        try {
            var res = await supabaseClient.rpc('increment_goal_progress', {
                p_metric_key: metricKey,
                p_amount: increment
            });
            if (res.error) console.error('Sync error:', res.error);
        } catch(e) {
            console.error('RPC error:', e);
            // Put back for retry
            community_pendingUpdates[metricKey] = (community_pendingUpdates[metricKey] || 0) + increment;
        }
    }
    community_cachedGoals = null;
    community_loadGoals();
}

// Update local progress display
function community_updateLocalProgress(metricKey, increment) {
    if (!community_cachedGoals) return;
    var goal = community_cachedGoals.find(function(g) { return g.metric_key === metricKey; });
    if (!goal) return;
    var current = goal.current_progress || 0;
    var percent = Math.min(100, ((current + increment) / goal.goal_target) * 100);
    var progressBar = document.querySelector('.com-progress-' + goal.goal_key);
    var progressText = document.querySelector('.com-text-' + goal.goal_key);
    if (progressBar) progressBar.style.width = percent + '%';
    if (progressText) progressText.textContent = (current + increment) + '/' + goal.goal_target;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMUNITY GOAL NARRATIVE LAYER
// Story beats that swap in as a goal's progress crosses thresholds, so a
// server-wide goal reads like an unfolding event instead of a raw counter.
// Generic arc works for any goal_key automatically; add a key below to give
// a specific goal its own bespoke story instead.
// ═══════════════════════════════════════════════════════════════════════════

var COMMUNITY_GOAL_NARRATIVES = {
  'corrupted_kills_e1': [
    { threshold: 0,   text: "Reports are trickling in. Pets returning from the forest with strange, twisted markings. Piper's tune echoes a little differently these days..." },
    { threshold: 25,  text: 'The corruption is spreading faster than anyone expected. Trainers are banding together to fight back.' },
    { threshold: 50,  text: "Halfway there. The corrupted are thinning out, but Piper's presence still lingers at the edges of the forest." },
    { threshold: 75,  text: 'Almost clear! Just a little more effort and the corruption will retreat... for now.' },
    { threshold: 100, text: "The corruption has been pushed back! Piper's tune returns to something more familiar. But everyone knows it never really goes away completely..." }
  ]
};

// Generic fallback arc — used for any goal without a bespoke entry above.
var COMMUNITY_GENERIC_NARRATIVE = [
  { threshold: 0,   text: 'The community has just begun working toward "{title}."' },
  { threshold: 25,  text: 'Progress is building. "{title}" is starting to take shape.' },
  { threshold: 50,  text: 'Halfway there! The whole server is feeling the momentum on "{title}."' },
  { threshold: 75,  text: 'Almost there! One final push and "{title}" will be complete!' },
  { threshold: 100, text: '"{title}" is complete! Thank you to everyone who contributed.' }
];

function community_getNarrative(goal, percent) {
  var arc = COMMUNITY_GOAL_NARRATIVES[goal.goal_key] || COMMUNITY_GENERIC_NARRATIVE;
  var beat = arc[0];
  for (var i = 0; i < arc.length; i++) {
    if (percent >= arc[i].threshold) beat = arc[i];
  }
  return beat.text.replace(/{title}/g, goal.title);
}

// Track which narrative tier each goal was last seen at, so a milestone
// celebration only fires once per goal per tier crossed (per browser).
function community_checkMilestoneCrossed(goal, percent) {
  var tier = percent >= 100 ? 100 : percent >= 75 ? 75 : percent >= 50 ? 50 : percent >= 25 ? 25 : 0;
  var storageKey = 'com_milestone_' + goal.goal_key;
  var lastTier = parseInt(localStorage.getItem(storageKey) || '0');
  if (tier > lastTier) {
    localStorage.setItem(storageKey, tier);
    if (lastTier > 0 || tier === 100) { // don't fire a false "milestone" on first-ever page load at tier 0->0
      var messages = {
        25: '📖 "' + goal.title + '" has reached 25%! The story is just beginning...',
        50: '📖 "' + goal.title + '" is halfway complete! Keep it up!',
        75: '📖 "' + goal.title + '" is at 75%! The finish line is in sight!',
        100: '🎉 "' + goal.title + '" is complete! Claim your reward!'
      };
      if (messages[tier]) community_showToast(messages[tier], 'success');
    }
  }
}

// Refresh entire UI
async function community_refreshUI() {
    var goals = await community_loadGoals();
    var container = document.getElementById('com-goals-container');
    if (!container || !goals.length) {
        if (container) container.innerHTML = '<div class="com-loading">Loading community goals...</div>';
        return;
    }
    
    container.innerHTML = goals.map(function(goal) {
        var progress = goal.current_progress || 0;
        var percent = (progress / goal.goal_target) * 100;
        var isCompleted = progress >= goal.goal_target;
        var isClaimed = community_claimedGoalIds.indexOf(goal.id) >= 0;
        var endsAt = goal.ends_at ? new Date(goal.ends_at).toLocaleDateString() : 'soon';
        var narrativeText = community_getNarrative(goal, percent);
        community_checkMilestoneCrossed(goal, percent);
        
        var rewardDisplay = '';
        if (goal.reward_type === 'points') rewardDisplay = '💰 ' + goal.reward_value + ' PawketPoints';
        else if (goal.reward_type === 'items') rewardDisplay = '📦 ' + goal.reward_value;
        else if (goal.reward_type === 'title') rewardDisplay = '🏆 Title: "' + goal.reward_value + '"';
        else rewardDisplay = '🎁 ' + goal.reward_value;
        
        var btnHtml = '';
        if (isCompleted && !isClaimed) {
            btnHtml = '<button class="com-claim-btn" data-goal-id="' + goal.id + '" data-goal-key="' + goal.goal_key + '">🎁 Claim Reward</button>';
        } else if (isClaimed) {
            btnHtml = '<div class="com-claimed">✓ Reward Claimed</div>';
        } else {
            btnHtml = '<div class="com-progress-status">📊 ' + Math.round(percent) + '% complete</div>';
        }
        
        return '<div class="com-goal-card">' +
            '<div class="com-goal-title">' + escapeHtml(goal.title) + '</div>' +
            '<div class="com-goal-desc">' + escapeHtml(goal.description) + '</div>' +
            '<div class="com-goal-narrative">📖 ' + escapeHtml(narrativeText) + '</div>' +
            '<div class="com-progress-bar">' +
            '<div class="com-progress-fill com-progress-' + goal.goal_key + '" style="width:' + percent + '%"></div>' +
            '</div>' +
            '<div class="com-progress-text com-text-' + goal.goal_key + '">' +
            progress.toLocaleString() + '/' + goal.goal_target.toLocaleString() +
            '</div>' +
            '<div class="com-reward">🎁 Reward: ' + rewardDisplay + '</div>' +
            '<div class="com-time-left">⏰ Ends: ' + endsAt + '</div>' +
            btnHtml +
            '</div>';
    }).join('');
    
    var claimButtons = document.querySelectorAll('.com-claim-btn');
    for (var i = 0; i < claimButtons.length; i++) {
        claimButtons[i].removeEventListener('click', community_handleClaim);
        claimButtons[i].addEventListener('click', community_handleClaim);
    }
}

// Handle reward claim
async function community_handleClaim(e) {
    var btn = e.currentTarget;
    var goalId = parseInt(btn.dataset.goalId);
    var goalKey = btn.dataset.goalKey;
    if (!goalId || !currentUser) return;
    
    if (community_claimedGoalIds.indexOf(goalId) >= 0) {
        community_showToast('Reward already claimed!', 'warning');
        return;
    }
    
    var goal = community_cachedGoals ? community_cachedGoals.find(function(g) { return g.id === goalId; }) : null;
    if (!goal || goal.current_progress < goal.goal_target) {
        community_showToast('Goal not completed yet!', 'error');
        return;
    }
    
    var success = await community_grantReward(goal);
    if (success) {
        var res = await supabaseClient
            .from('community_goal_claims')
            .insert({ goal_id: goalId, user_id: currentUser.id });
        if (!res.error) {
            community_claimedGoalIds.push(goalId);
            community_showToast('🎉 Reward claimed: ' + community_formatRewardText(goal), 'success');
            community_refreshUI();
        }
    }
}

// ════════════════════════════════════════════════════════════════════════════
// SCRAPBOOK SYSTEM - COMPLETE IMPLEMENTATION
// ════════════════════════════════════════════════════════════════════════════

// Memory templates

// Grant reward based on type
async function community_grantReward(goal) {
  var reward = goal.reward_value;
  var type = goal.reward_type;
  
  try {
    if (type === 'points') {
      var amount = parseInt(reward);
      if (typeof window.addPawketPoints === 'function') {
        window.addPawketPoints(amount);
      } else if (window.currentUser) {
        window.currentUser.pawketPoints = (window.currentUser.pawketPoints || 0) + amount;
        if (typeof window.saveUserData === 'function') await window.saveUserData();
        if (typeof updateAllPoints === 'function') updateAllPoints((window.currentUser.pawketPoints || 0));
      }
      return true;
    }
    if (type === 'items') {
      var items = reward.split(',');
      for (var i = 0; i < items.length; i++) {
        var parts = items[i].split(':');
        var itemId = parts[0];
        var quantity = parseInt(parts[1]) || 1;
        if (typeof addItemToInventory === 'function') {
          await addItemToInventory(itemId, quantity);
        }
      }
      return true;
    }
    if (type === 'title') {
      if (typeof unlockTitle === 'function') {
        await unlockTitle(reward);
      }
      return true;
    }
    return false;
  } catch(e) {
    console.error('Reward grant error:', e);
    return false;
  }
}

// Format reward text for toast
function community_formatRewardText(goal) {
  if (goal.reward_type === 'points') return goal.reward_value + ' PawketPoints';
  if (goal.reward_type === 'items') return goal.reward_value;
  if (goal.reward_type === 'title') return 'Title: "' + goal.reward_value + '"';
  return goal.reward_value;
}

// Show toast notification
function community_showToast(message, type) {
  type = type || 'info';
  if (typeof showToast === 'function') {
    showToast(message);
  } else {
    dbg('[Community] ' + message);
    var toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#333;color:white;padding:10px 20px;border-radius:8px;z-index:9999;';
    document.body.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 3000);
  }
}

// Initialize community system
function community_init() {
  community_loadGoals();
  setInterval(function() { community_loadGoals(); }, 300000);
  window.addEventListener('beforeunload', function() {
    if (Object.keys(community_pendingUpdates).length > 0) {
      community_syncToDatabase();
    }
  });
  dbg('🌍 Community Goals system initialized');
}


// Mobile menu handled by DOMContentLoaded block in Phase 1 (Block 1 above)


// ════════════════════════════════════════════════════════════════════════════
// PHASE 1: PROFILE COSMETICS, PET OF THE DAY, MILESTONES
// ALL FUNCTIONS PREFIXED WITH phase1_
// ADDITIVE ONLY - NO MODIFICATIONS TO EXISTING CODE
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
// PHASE 1: PROFILE COSMETICS, PET OF THE DAY, MILESTONES (FIXED VERSION)
// ✅ Proper error handling
// ✅ Visual feedback for all actions
// ✅ Console logging for debugging
// ✅ Graceful fallbacks
// ════════════════════════════════════════════════════════════════════════════

// Global state for Phase 1
var phase1_state = {
  unlockedBackgrounds: [],
  unlockedFrames: [],
  unlockedBadges: [],
  milestones: {},
  petOfTheDay: null,
  weeklySpotlight: null,
  isInitialized: false
};

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

async function newFeatures_init() {
  dbg('🚀 Initializing new features...');
  try {
    if (typeof todayCard_init === 'function') await todayCard_init();
    if (typeof renderEventCalendar === 'function') renderEventCalendar('event-calendar-mount');
    if (typeof corruptionVisuals_init === 'function') corruptionVisuals_init();
    // Check Melon milestone messages (fires once per milestone per player)
    safeSetTimeout(function() { checkMelonMilestones(); }, 5000);
    // Generate today's Melon requests
    safeSetTimeout(async function() {
      try {
        await melonRequests_generate();
        melonRequests_renderWidget('melon-requests-mount');
        renderEventCalendar('event-calendar-mount');
      } catch(e) {}
    }, 3000);

    // Show "missed you" messages for any pets the player hasn't seen in 12+ hours
    safeSetTimeout(function() {
      try {
        var missedPets = [];
        Object.keys(petState).forEach(function(pid) {
          var p = petState[pid];
          var lastAct = null;
          if (p.last_fed && p.last_played) {
            lastAct = new Date(p.last_fed) > new Date(p.last_played) ? new Date(p.last_fed) : new Date(p.last_played);
          } else if (p.last_fed) { lastAct = new Date(p.last_fed); }
          else if (p.last_played) { lastAct = new Date(p.last_played); }
          var hoursGone = lastAct ? (Date.now() - lastAct) / 3600000 : 0;
          if (hoursGone >= 12) {
            var petType = (p.pets && (p.pets.vtuber_name || p.pets.name)) || '';
            var pers = PET_PERSONALITIES[petType];
            if (pers && pers.missed_you) missedPets.push({ name: p.nickname || petType, msg: pers.missed_you });
          }
          // After 48h absence, add a quiet scrapbook memory
          if (hoursGone >= 48 && p.id) {
            scrapbook_addMemory(p.id, 'neglect_recovery', {}).then(null, function(){});
          }
        });
        if (missedPets.length > 0) {
          // Show one toast per missed pet — staggered by 6s so each can be read
          missedPets.forEach(function(mp, i) {
            safeSetTimeout(function() {
              // Larger, bolder toast for pet greeting messages
              var toastEl = document.getElementById('toast-message');
              if (toastEl) {
                toastEl.style.fontSize = '1rem';
                toastEl.style.fontWeight = '700';
                toastEl.style.fontStyle = 'normal';
                toastEl.style.lineHeight = '1.5';
                toastEl.style.maxWidth = '360px';
                toastEl.style.padding = '16px 20px';
              }
              showToast('🐾 ' + mp.name + ':\n' + mp.msg, 6000);
            }, i * 7000); // 7s gap so each toast fully clears before the next
          });
        }
      } catch(e) {}
    }, 2500); // slight delay so pets are loaded first
    if (typeof calendar_init === 'function') await calendar_init();
    if (typeof dailyWelcome_check === 'function') dailyWelcome_check();
    dbg('✅ New features initialized!');
  } catch (err) {
    console.error('❌ New features initialization error:', err);
  }
}

async function phase1_init() {
  if (!currentUser) {
    console.warn('⚠️ Phase 1: No user logged in - skipping initialization');
    return;
  }
  
  if (phase1_state.isInitialized) {
    dbg('ℹ️ Phase 1: Already initialized');
    return;
  }
  
  dbg('📦 Phase 1: Initializing...');
  
  // DEBUG: Check table accessibility
  dbg('🔍 Phase 1 Debug: Checking database tables...');
  var tables = ['daily_featured_pet', 'unlocked_cosmetics', 'weekly_spotlight', 'player_milestones'];
  for (var i = 0; i < tables.length; i++) {
    var table = tables[i];
    try {
      var { error } = await supabaseClient.from(table).select('*').limit(1);
      if (error) {
        console.error('❌ Phase 1: Table', table, 'error:', error.message);
      } else {
        dbg('✅ Phase 1: Table', table, 'accessible');
      }
    } catch (e) {
      console.error('❌ Phase 1: Table', table, 'check failed:', e);
    }
  }
  
  // DEBUG: Check user_pets schema
  try {
    var { data: samplePet } = await supabaseClient.from('user_pets').select('*').limit(1).single();
    if (samplePet) {
      dbg('📊 Phase 1 Debug: user_pets columns:', Object.keys(samplePet));
    }
  } catch (e) {
    dbg('📊 Phase 1 Debug: Could not sample user_pets (may be empty)');
  }
  
  try {
    await phase1_loadUnlockedCosmetics();
    await phase1_loadPetOfTheDay();
    await phase1_loadWeeklySpotlight();
    await phase1_checkAllUnlocks();
    
    phase1_state.isInitialized = true;
    dbg('✅ Phase 1: Initialized successfully');
    
    // NEW FEATURES: Initialize wrapper features
    await newFeatures_init();
    
  } catch (error) {
    console.error('❌ Phase 1: Initialization failed:', error);
    if (typeof showToast === 'function') {
      showToast('Failed to load some features. Please refresh.', 'error');
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COSMETICS SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

// Load player's unlocked cosmetics
async function phase1_loadUnlockedCosmetics() {
  if (!currentUser) {
    console.warn('⚠️ Phase 1: Cannot load cosmetics - no user');
    return;
  }
  
  try {
    var { data, error } = await supabaseClient
      .from('unlocked_cosmetics')
      .select('cosmetic_type, cosmetic_id')
      .eq('user_id', currentUser.id);
    
    if (error) throw error;
    
    if (!data) {
      console.warn('⚠️ Phase 1: No cosmetics data returned');
      return;
    }
    
    // Group by type
    phase1_state.unlockedBackgrounds = data
      .filter(function(c) { return c.cosmetic_type === 'background'; })
      .map(function(c) { return c.cosmetic_id; });
    
    phase1_state.unlockedFrames = data
      .filter(function(c) { return c.cosmetic_type === 'frame'; })
      .map(function(c) { return c.cosmetic_id; });
    
    phase1_state.unlockedBadges = data
      .filter(function(c) { return c.cosmetic_type === 'badge'; })
      .map(function(c) { return c.cosmetic_id; });
    
    dbg('✅ Phase 1: Loaded cosmetics - Backgrounds:', phase1_state.unlockedBackgrounds.length, 
                'Frames:', phase1_state.unlockedFrames.length, 
                'Badges:', phase1_state.unlockedBadges.length);
  } catch (error) {
    console.error('❌ Phase 1: Error loading cosmetics:', error);
    // Non-critical error - don't show to user
  }
}

// Unlock a cosmetic
async function phase1_unlockCosmetic(type, cosmeticId) {
  if (!currentUser) {
    console.warn('⚠️ Phase 1: Cannot unlock cosmetic - no user');
    return false;
  }
  
  try {
    // Check if already unlocked
    var unlocked = phase1_state['unlocked' + type.charAt(0).toUpperCase() + type.slice(1) + 's'];
    if (unlocked && unlocked.indexOf(cosmeticId) !== -1) {
      dbg('ℹ️ Phase 1: Cosmetic already unlocked:', type, cosmeticId);
      return false; // Already unlocked
    }
    
    var { error } = await supabaseClient
      .from('unlocked_cosmetics')
      .insert({
        user_id: currentUser.id,
        cosmetic_type: type,
        cosmetic_id: cosmeticId
      });
    
    if (error) throw error;
    
    // Update local state
    await phase1_loadUnlockedCosmetics();
    
    // Show rich unlock notification with nav button
    showUnlockCelebration('cosmetic', type, cosmeticId);
    
    dbg('✅ Phase 1: Unlocked cosmetic:', type, cosmeticId);
    return true;
  } catch (error) {
    console.error('❌ Phase 1: Error unlocking cosmetic:', error);
    if (typeof showToast === 'function') {
      showToast('Failed to unlock cosmetic. Please try again.', 'error');
    }
    return false;
  }
}

// Apply cosmetic (save to profile)
async function phase1_applyCosmetic(type, cosmeticId) {
  if (!currentUser) {
    console.warn('⚠️ Phase 1: Cannot apply cosmetic - no user');
    return;
  }
  
  try {
    var column = 'profile_' + type;
    var { error } = await supabaseClient
      .from('players')
      .update({ [column]: cosmeticId })
      .eq('id', currentUser.id);
    
    if (error) throw error;
    
    // Update current user object
    currentUser['profile_' + type] = cosmeticId;
    
    if (typeof showToast === 'function') {
      showToast('✅ Cosmetic applied!', 'success');
    }
    
    dbg('✅ Phase 1: Applied cosmetic:', type, cosmeticId);
  } catch (error) {
    console.error('❌ Phase 1: Error applying cosmetic:', error);
    if (typeof showToast === 'function') {
      showToast('Failed to apply cosmetic. Please try again.', 'error');
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PET OF THE DAY
// ═══════════════════════════════════════════════════════════════════════════

async function phase1_loadPetOfTheDay() {
  try {
    var today = new Date().toISOString().split('T')[0];
    
    var { data, error } = await supabaseClient
      .from('daily_featured_pet')
      .select('date, user_pet_id, pet_name, owner_username, pet_level, featured_quote')
      .eq('date', today)
      .maybeSingle();
    
    if (error) throw error;
    
    if (!data) {
      dbg('ℹ️ Phase 1: No pet of the day yet - generating...');
      await phase1_generatePetOfTheDay();
    } else {
      phase1_state.petOfTheDay = data;
      phase1_displayPetOfTheDay();
      dbg('✅ Phase 1: Loaded pet of the day:', data.pet_name);
    }
  } catch (error) {
    console.error('❌ Phase 1: Error loading pet of the day:', error);
    // Non-critical - don't show error to user
  }
}

async function phase1_generatePetOfTheDay() {
  try {
    var today = new Date().toISOString().split('T')[0];
    
    // Get random pet from all user_pets
    // FIXED: user_pets has 'nickname' not 'name', and 'adopted_at' not 'created_at'
    var { data: randomPets, error } = await supabaseClient
      .from('user_pets')
      .select('id, level, user_id, nickname, pets(name)')
      .limit(100)
      .order('adopted_at', { ascending: false });
    
    if (error) throw error;
    
    if (!randomPets || randomPets.length === 0) {
      console.warn('⚠️ Phase 1: No pets found for pet of the day');
      return;
    }
    
    // Pick random from results
    var selected = randomPets[Math.floor(Math.random() * randomPets.length)];
    
    // Get owner username
    var { data: owner } = await supabaseClient
      .from('players')
      .select('username')
      .eq('id', selected.user_id)
      .single();
    
    // Get a scrapbook memory if available
    var { data: memory } = await supabaseClient
      .from('pet_memories')
      .select('memory_text')
      .eq('user_pet_id', selected.id)
      .limit(1)
      .maybeSingle();
    
    // Save to database - FIXED: Use UPSERT to handle conflicts
    var { error: insertError } = await supabaseClient
      .from('daily_featured_pet')
      .upsert({
        date: today,
        user_pet_id: selected.id,
        pet_name: selected.nickname || (selected.pets && selected.pets.name) || 'Mystery Pet',
        owner_username: owner ? owner.username : 'Anonymous',
        pet_level: selected.level || 1,
        featured_quote: memory ? memory.memory_text : 'A wonderful companion!'
      }, {
        onConflict: 'date'
      });
    
    if (insertError) throw insertError;
    
    dbg('✅ Phase 1: Generated pet of the day:', selected.name);
    await phase1_loadPetOfTheDay(); // Reload
  } catch (error) {
    console.error('❌ Phase 1: Error generating pet of the day:', error);
  }
}

function phase1_displayPetOfTheDay() {
  try {
    var container = document.getElementById('phase1-pet-of-day-container');
    if (!container) {
      return; // Container not in DOM on this page — silent return
    }
    
    if (!phase1_state.petOfTheDay) {
      console.warn('⚠️ Phase 1: No pet of the day data to display');
      return;
    }
    
    var pet = phase1_state.petOfTheDay;
    
    container.innerHTML = '<div class="phase1-pet-of-day">' +
      '<div class="phase1-pet-of-day-header"><h3>🌟 Pet of the Day</h3></div>' +
      '<div class="phase1-pet-of-day-content">' +
      '<div class="phase1-pet-of-day-image">🐾</div>' +
      '<div class="phase1-pet-of-day-info">' +
      '<div class="phase1-pet-of-day-name">' + escapeHtml(pet.pet_name) + '</div>' +
      '<div class="phase1-pet-of-day-owner">Owned by ' + escapeHtml(pet.owner_username) + '</div>' +
      '<div class="phase1-pet-of-day-stats">' +
      '<span>Level ' + pet.pet_level + '</span>' +
      '</div>' +
      '<div class="phase1-pet-of-day-quote">"' + escapeHtml(pet.featured_quote) + '"</div>' +
      '</div></div></div>';
    
    dbg('✅ Phase 1: Displayed pet of the day');
  } catch (error) {
    console.error('❌ Phase 1: Error displaying pet of the day:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WEEKLY SPOTLIGHT
// ═══════════════════════════════════════════════════════════════════════════

async function phase1_loadWeeklySpotlight() {
  try {
    var monday = phase1_getMondayDate();
    
    var { data, error } = await supabaseClient
      .from('weekly_spotlight')
      .select('*')
      .eq('week_start', monday)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    if (!data) {
      dbg('ℹ️ Phase 1: No spotlight yet - generating...');
      await phase1_generateWeeklySpotlight();
    } else {
      phase1_state.weeklySpotlight = data;
      phase1_displayWeeklySpotlight();
      dbg('✅ Phase 1: Loaded weekly spotlight');
    }
  } catch (error) {
    console.error('❌ Phase 1: Error loading spotlight:', error);
  }
}

async function phase1_generateWeeklySpotlight() {
  try {
    var monday = phase1_getMondayDate();
    
    // Get random active player
    var { data: players, error } = await supabaseClient
      .from('players')
      .select('id, username')
      .limit(50);
    
    if (error) throw error;
    
    if (!players || players.length === 0) {
      console.warn('⚠️ Phase 1: No players found for spotlight');
      return;
    }
    
    var selected = players[Math.floor(Math.random() * players.length)];
    
    // FIXED: Use UPSERT to handle conflicts
    var { error: insertError } = await supabaseClient
      .from('weekly_spotlight')
      .upsert({
        week_start: monday,
        spotlight_type: 'player',
        spotlight_data: {
          username: selected.username,
          user_id: selected.id
        }
      }, {
        onConflict: 'week_start'
      });
    
    if (insertError) throw insertError;
    
    dbg('✅ Phase 1: Generated weekly spotlight');
    await phase1_loadWeeklySpotlight();
  } catch (error) {
    console.error('❌ Phase 1: Error generating spotlight:', error);
  }
}

function phase1_displayWeeklySpotlight() {
  try {
    var container = document.getElementById('phase1-spotlight-container');
    if (!container) {
      return; // Container not in DOM on this page — silent return
    }
    
    if (!phase1_state.weeklySpotlight) {
      console.warn('⚠️ Phase 1: No spotlight data to display');
      return;
    }
    
    var spotlight = phase1_state.weeklySpotlight;
    var data = spotlight.spotlight_data;
    
    container.innerHTML = '<div class="phase1-spotlight">' +
      '<div class="phase1-spotlight-header"><h3>⭐ Weekly Spotlight</h3></div>' +
      '<div class="phase1-spotlight-content">' +
      '<div class="phase1-spotlight-name">' + escapeHtml(data.username) + '</div>' +
      '<div class="phase1-spotlight-details">Featured Player of the Week!</div>' +
      '</div></div>';
    
    dbg('✅ Phase 1: Displayed weekly spotlight');
  } catch (error) {
    console.error('❌ Phase 1: Error displaying spotlight:', error);
  }
}

function phase1_getMondayDate() {
  var now = new Date();
  var day = now.getDay();
  var diff = now.getDate() - day + (day === 0 ? -6 : 1);
  var monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

// ═══════════════════════════════════════════════════════════════════════════
// MILESTONE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

async function phase1_checkMilestone(milestoneType, currentValue) {
  if (!currentUser) {
    console.warn('⚠️ Phase 1: Cannot check milestone - no user');
    return;
  }
  
  try {
    // Check if already achieved
    var { data: existing } = await supabaseClient
      .from('player_milestones')
      .select('milestone_type, notified')
      .eq('user_id', currentUser.id)
      .eq('milestone_type', milestoneType)
      .maybeSingle();
    
    if (existing) {
      dbg('ℹ️ Phase 1: Milestone already achieved:', milestoneType);
      return; // Already achieved
    }
    
    // Save milestone
    var { error } = await supabaseClient
      .from('player_milestones')
      .insert({
        user_id: currentUser.id,
        milestone_type: milestoneType,
        milestone_value: { value: currentValue },
        notified: true
      });
    
    if (error) throw error;
    
    dbg('✅ Phase 1: Milestone achieved:', milestoneType);
    
    // Trigger celebration
    phase1_celebrateMilestone(milestoneType, currentValue);
    
    // Auto-unlock related cosmetics
    await phase1_unlockMilestoneRewards(milestoneType);
  } catch (error) {
    console.error('❌ Phase 1: Error checking milestone:', error);
    // Non-critical - don't show error to user
  }
}

function phase1_celebrateMilestone(milestoneType, value) {
  try {
    var celebrations = {
      'battle_10': { icon: '⚔️', title: 'Fighter!', text: 'Won 10 battles!' },
      'battle_100': { icon: '🏆', title: 'Veteran!', text: 'Won 100 battles!' },
      'battle_500': { icon: '👑', title: 'Champion!', text: 'Won 500 battles!' },
      'streak_7': { icon: '📅', title: 'Regular!', text: '7-day login streak!' },
      'streak_30': { icon: '💎', title: 'Dedicated!', text: '30-day login streak!' },
      'streak_100': { icon: '⭐', title: 'Devoted!', text: '100-day login streak!' },
      'level_20': { icon: '🌠', title: 'Rising Star!', text: 'Reached level 20!' },
      'level_50': { icon: '✨', title: 'Legend!', text: 'Reached level 50!' },
      'pets_5': { icon: '🐾', title: 'Collector!', text: 'Adopted 5 pets!' },
      'pets_10': { icon: '🦊', title: 'Breeder!', text: 'Adopted 10 pets!' },
      'pets_20': { icon: '🐉', title: 'Pet Master!', text: 'Adopted 20 pets!' }
    };
    
    var celebration = celebrations[milestoneType];
    if (!celebration) {
      console.warn('⚠️ Phase 1: No celebration defined for:', milestoneType);
      return;
    }
    
    var overlay = document.createElement('div');
    overlay.className = 'phase1-celebration-overlay';
    overlay.innerHTML = '<div class="phase1-celebration-card">' +
      '<button class="celebration-dismiss-btn" onclick="this.closest(\'.phase1-celebration-overlay\').remove()" title="Dismiss">✕</button>' +
      '<div class="phase1-celebration-icon">' + celebration.icon + '</div>' +
      '<div class="phase1-celebration-title">' + celebration.title + '</div>' +
      '<div class="phase1-celebration-text">' + celebration.text + '</div>' +
      '</div>';
    
    document.body.appendChild(overlay);
    
    // Effects
    screenShake(7, 350);
    screenFlash('rgba(255,215,0,0.25)', 500);
    playChiptune('milestone');

    // Triple confetti burst
    if (typeof createConfettiBurst === 'function') {
      try {
        createConfettiBurst(window.innerWidth / 2, window.innerHeight / 2);
        setTimeout(function() { createConfettiBurst(window.innerWidth * 0.25, window.innerHeight * 0.4); }, 200);
        setTimeout(function() { createConfettiBurst(window.innerWidth * 0.75, window.innerHeight * 0.4); }, 400);
      } catch(e) { dbg('Confetti failed:', e); }
    }
    
    // Remove after 8 seconds
    setTimeout(function() { if (overlay.parentNode) overlay.remove(); }, 8000);
    
    // Also show toast as fallback
    if (typeof showToast === 'function') {
      showToast(celebration.icon + ' ' + celebration.title, 'success');
    }
    
    dbg('✅ Phase 1: Celebrated milestone:', milestoneType);
  } catch (error) {
    console.error('❌ Phase 1: Error celebrating milestone:', error);
    // Fallback: just show toast
    if (typeof showToast === 'function') {
      showToast('🎉 Milestone achieved!', 'success');
    }
  }
}

async function phase1_unlockMilestoneRewards(milestoneType) {
  try {
    var rewards = {
      'level_10': [{ type: 'background', id: 'bg_forest' }, { type: 'frame', id: 'frame_silver' }],
      'level_20': [{ type: 'frame', id: 'frame_gold' }, { type: 'badge', id: 'badge_level_20' }],
      'level_25': [{ type: 'background', id: 'bg_clouds' }],
      'level_50': [{ type: 'background', id: 'bg_legendary' }, { type: 'frame', id: 'frame_legendary' }, { type: 'badge', id: 'badge_level_50' }],
      'battle_50': [{ type: 'background', id: 'bg_castle' }],
      'battle_100': [{ type: 'background', id: 'bg_desert' }, { type: 'frame', id: 'frame_fire' }, { type: 'badge', id: 'badge_100_battles' }],
      'battle_500': [{ type: 'badge', id: 'badge_500_battles' }],
      'streak_30': [{ type: 'background', id: 'bg_stars' }, { type: 'frame', id: 'frame_ice' }, { type: 'badge', id: 'badge_30_days' }],
      'streak_100': [{ type: 'badge', id: 'badge_100_days' }],
      'pets_5': [{ type: 'badge', id: 'badge_pet_5' }],
      'pets_10': [{ type: 'badge', id: 'badge_pet_10' }],
      'pets_20': [{ type: 'background', id: 'bg_underwater' }, { type: 'badge', id: 'badge_pet_20' }],
      'treats_50': [{ type: 'badge', id: 'badge_treats_50' }],
      'treats_100': [{ type: 'background', id: 'bg_garden' }, { type: 'badge', id: 'badge_treats_100' }],
      'boss_10': [{ type: 'background', id: 'bg_volcano' }, { type: 'badge', id: 'badge_boss_10' }]
    };
    
    var rewardList = rewards[milestoneType];
    if (!rewardList) {
      dbg('ℹ️ Phase 1: No rewards for milestone:', milestoneType);
      return;
    }
    
    for (var i = 0; i < rewardList.length; i++) {
      var reward = rewardList[i];
      await phase1_unlockCosmetic(reward.type, reward.id);
    }
    
    dbg('✅ Phase 1: Unlocked', rewardList.length, 'rewards for', milestoneType);
  } catch (error) {
    console.error('❌ Phase 1: Error unlocking milestone rewards:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-CHECK UNLOCKS (on init)
// ═══════════════════════════════════════════════════════════════════════════

async function phase1_checkAllUnlocks() {
  if (!currentUser) return;
  
  try {
    dbg('🔍 Phase 1: Checking all milestone unlocks...');
    
    // Get player stats from existing data
    var totalBattles = currentUser.total_battles || 0;
    var loginStreak = currentUser.login_streak || 0;
    var playerLevel = currentUser.level || 1;
    
    // Count pets
    var totalPets = 0;
    if (window.petState) {
      totalPets = Object.keys(window.petState).length;
    }
    
    // Check battle milestones
    if (totalBattles >= 10) await phase1_checkMilestone('battle_10', totalBattles);
    if (totalBattles >= 50) await phase1_checkMilestone('battle_50', totalBattles);
    if (totalBattles >= 100) await phase1_checkMilestone('battle_100', totalBattles);
    if (totalBattles >= 500) await phase1_checkMilestone('battle_500', totalBattles);
    
    // Check streak milestones
    if (loginStreak >= 7) await phase1_checkMilestone('streak_7', loginStreak);
    if (loginStreak >= 30) await phase1_checkMilestone('streak_30', loginStreak);
    if (loginStreak >= 100) await phase1_checkMilestone('streak_100', loginStreak);
    
    // Check level milestones
    if (playerLevel >= 10) await phase1_checkMilestone('level_10', playerLevel);
    if (playerLevel >= 20) await phase1_checkMilestone('level_20', playerLevel);
    if (playerLevel >= 25) await phase1_checkMilestone('level_25', playerLevel);
    if (playerLevel >= 50) await phase1_checkMilestone('level_50', playerLevel);
    
    // Check pet collection milestones
    if (totalPets >= 5) await phase1_checkMilestone('pets_5', totalPets);
    if (totalPets >= 10) await phase1_checkMilestone('pets_10', totalPets);
    if (totalPets >= 20) await phase1_checkMilestone('pets_20', totalPets);
    
    dbg('✅ Phase 1: Milestone check complete');
  } catch (error) {
    console.error('❌ Phase 1: Error checking unlocks:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK FUNCTIONS (Called from existing code)
// ═══════════════════════════════════════════════════════════════════════════

// Called after battle win
async function phase1_onBattleWin() {
  if (!currentUser) return;
  
  try {
    var totalBattles = currentUser.total_battles || 0;
    if (totalBattles === 10) await phase1_checkMilestone('battle_10', totalBattles);
    if (totalBattles === 50) await phase1_checkMilestone('battle_50', totalBattles);
    if (totalBattles === 100) await phase1_checkMilestone('battle_100', totalBattles);
    if (totalBattles === 500) await phase1_checkMilestone('battle_500', totalBattles);
  } catch (error) {
    console.error('❌ Phase 1: Battle hook error:', error);
  }
}

// Called after login
async function phase1_onLogin() {
  if (!currentUser) return;
  
  try {
    var loginStreak = currentUser.login_streak || 0;
    if (loginStreak === 7) await phase1_checkMilestone('streak_7', loginStreak);
    if (loginStreak === 30) await phase1_checkMilestone('streak_30', loginStreak);
    if (loginStreak === 100) await phase1_checkMilestone('streak_100', loginStreak);
  } catch (error) {
    console.error('❌ Phase 1: Login hook error:', error);
  }
}

// Called after pet adoption
async function phase1_onPetAdopt() {
  if (!currentUser || !window.petState) return;
  
  try {
    var totalPets = Object.keys(window.petState).length;
    if (totalPets === 5) await phase1_checkMilestone('pets_5', totalPets);
    if (totalPets === 10) await phase1_checkMilestone('pets_10', totalPets);
    if (totalPets === 20) await phase1_checkMilestone('pets_20', totalPets);
  } catch (error) {
    console.error('❌ Phase 1: Adoption hook error:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VERIFICATION & TEST FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

// Test function - Run in console to verify Phase 1
async function test_phase1() {
  dbg('🧪 Testing Phase 1 features...');
  
  var passed = 0;
  var failed = 0;
  
  // Test 1: Check all new functions exist
  var requiredFunctions = [
    'phase1_init',
    'phase1_loadUnlockedCosmetics',
    'phase1_unlockCosmetic',
    'phase1_applyCosmetic',
    'phase1_loadPetOfTheDay',
    'phase1_displayPetOfTheDay',
    'phase1_loadWeeklySpotlight',
    'phase1_displayWeeklySpotlight',
    'phase1_checkMilestone',
    'phase1_celebrateMilestone',
    'phase1_checkAllUnlocks',
    'phase1_onBattleWin',
    'phase1_onLogin',
    'phase1_onPetAdopt'
  ];
  
  for (var i = 0; i < requiredFunctions.length; i++) {
    var fn = requiredFunctions[i];
    if (typeof window[fn] === 'function') {
      dbg('✅', fn, 'exists');
      passed++;
    } else {
      console.error('❌', fn, 'missing');
      failed++;
    }
  }
  
  // Test 2: Check new UI elements (if added)
  var requiredElements = [
    'phase1-pet-of-day-container',
    'phase1-spotlight-container'
  ];
  
  for (var i = 0; i < requiredElements.length; i++) {
    var el = requiredElements[i];
    if (document.getElementById(el)) {
      dbg('✅', el, 'exists in DOM');
      passed++;
    } else {
      console.warn('⚠️', el, 'missing from DOM (may not be added yet)');
    }
  }
  
  // Test 3: Check state
  if (phase1_state) {
    dbg('✅ phase1_state exists');
    dbg('   isInitialized:', phase1_state.isInitialized);
    dbg('   unlockedBackgrounds:', phase1_state.unlockedBackgrounds.length);
    dbg('   unlockedFrames:', phase1_state.unlockedFrames.length);
    dbg('   unlockedBadges:', phase1_state.unlockedBadges.length);
    passed++;
  } else {
    console.error('❌ phase1_state missing');
    failed++;
  }
  
  // Test 4: Check if initialized
  if (phase1_state && phase1_state.isInitialized) {
    dbg('✅ Phase 1 is initialized');
    passed++;
  } else {
    console.warn('⚠️ Phase 1 not initialized yet (run phase1_init())');
  }
  
  dbg('\n📈 Results:', passed, 'passed,', failed, 'failed');
  
  if (failed === 0) {
    dbg('🎉 Phase 1 verification PASSED!');
  } else {
    dbg('⚠️ Phase 1 needs fixes - check errors above');
  }
  
  dbg('\n📊 Manual checks needed:');
  dbg('1. Run this in Supabase SQL Editor: SELECT * FROM daily_featured_pet;');
  dbg('2. Run this in Supabase SQL Editor: SELECT * FROM unlocked_cosmetics WHERE user_id = \'', currentUser ? currentUser.id : 'YOUR_USER_ID', '\';');
  dbg('3. Check browser console for "✅ Phase 1: Initialized successfully"');
  dbg('4. Win 10 battles and watch for celebration popup');
}

// Quick test for milestone celebrations
async function test_phase1_milestone() {
  dbg('🧪 Testing milestone celebration...');
  
  if (!currentUser) {
    console.error('❌ No user logged in');
    return;
  }
  
  // Force a celebration
  phase1_celebrateMilestone('battle_10', 10);
  
  dbg('✅ Check if celebration popup appeared');
  dbg('   (It should fade out after 4 seconds)');
}

// Quick test for cosmetics unlock
async function test_phase1_cosmetic() {
  dbg('🧪 Testing cosmetic unlock...');
  
  if (!currentUser) {
    console.error('❌ No user logged in');
    return;
  }
  
  // Try to unlock forest background
  var result = await phase1_unlockCosmetic('background', 'bg_forest');
  
  if (result) {
    dbg('✅ Cosmetic unlocked successfully');
    dbg('   Check if toast notification appeared');
  } else {
    dbg('ℹ️ Cosmetic was already unlocked or failed');
  }
}

// ════════════════════════════════════════════════════════════════════════════
// CLEANUP: Remove expired localStorage items
// ════════════════════════════════════════════════════════════════════════════

function cleanupExpiredLocalStorage() {
  var today = new Date().toISOString().split('T')[0];
  var keysToRemove = [];
  
  for (var i = 0; i < localStorage.length; i++) {
    var key = localStorage.key(i);
    // Remove old daily entries
    if (key && (key.includes('daily_') || key.includes('bingo_')) && !key.includes(today)) {
      keysToRemove.push(key);
    }
    // Remove old feed/play daily limits (older than today)
    if (key && (key.includes('feed_') || key.includes('play_')) && !key.includes(today)) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(function(key) {
    localStorage.removeItem(key);
  });
  
  if (keysToRemove.length > 0) {
    dbg('🧹 Cleaned up', keysToRemove.length, 'expired localStorage items');
  }
}


// ════════════════════════════════════════════════════════════════════════════
// MOBILE MENU: Close function
// ════════════════════════════════════════════════════════════════════════════

function closeMobileMenu() {
  var menu = document.getElementById('mobile-nav-menu');
  var overlay = document.querySelector('.mobile-nav-overlay');
  if (menu) menu.classList.remove('open');
  if (overlay) overlay.classList.remove('show');
  document.body.style.overflow = '';
  dbg('📱 Mobile menu closed');
}


// ════════════════════════════════════════════════════════════════════════════
// SKIN KEY SYSTEM - VARIANT UNLOCKING
// ════════════════════════════════════════════════════════════════════════════

var BASIC_VARIANTS = {
  golden: { name: 'Golden', description: 'Shimmering gold aura', cssClass: 'pet-variant-golden', icon: '✨', cost: 1 },
  shiny: { name: 'Shiny', description: 'Rainbow sparkle effect', cssClass: 'pet-variant-shiny', icon: '🌈', cost: 1 },
  cosmic: { name: 'Cosmic', description: 'Mystical space energy', cssClass: 'pet-variant-cosmic', icon: '🌌', cost: 1 },
  shadow: { name: 'Shadow', description: 'Dark mysterious aura', cssClass: 'pet-variant-shadow', icon: '🌑', cost: 1 },
  fire: { name: 'Fire', description: 'Burning flames', cssClass: 'pet-variant-fire', icon: '🔥', cost: 1 },
  ice: { name: 'Ice', description: 'Frozen crystals', cssClass: 'pet-variant-ice', icon: '❄️', cost: 1 },
  electric: { name: 'Electric', description: 'Crackling lightning', cssClass: 'pet-variant-electric', icon: '⚡', cost: 1 },
  nature: { name: 'Nature', description: 'Living plants', cssClass: 'pet-variant-nature', icon: '🌿', cost: 1 },
  crystal: { name: 'Crystal', description: 'Prismatic gems', cssClass: 'pet-variant-crystal', icon: '💎', cost: 1 },
  ghost: { name: 'Ghost', description: 'Ethereal spirit', cssClass: 'pet-variant-ghost', icon: '👻', cost: 1 }
};

var SPECIAL_VARIANTS = ['emi', 'numi', 'tob', 'shondo', 'merry', 'vienna', 'lily', 'sleepy', 'cottontail', 'yuno', 'susu', 'sinder', 'snuffy', 'bat', 'zen', 'bao'];

var skinKeyState = {
  keys: 0,
  unlockedVariants: {},
  currentVariants: {}
};

async function skinkey_loadUserData() {
  if (!currentUser) return;
  try {
    var { data: player } = await supabaseClient.from('players').select('skin_keys').eq('id', currentUser.id).single();
    if (player) {
      skinKeyState.keys = player.skin_keys || 0;
      dbg('🔑 Skin Keys:', skinKeyState.keys);
    }
    var petIds = Object.keys(petState || {});
    if (petIds.length === 0) {
      dbg('✨ No pets yet, skipping variant load');
      return;
    }
    var { data: unlocked } = await supabaseClient.from('unlocked_variants').select('user_pet_id, variant_id').in('user_pet_id', petIds);
    if (unlocked) {
      skinKeyState.unlockedVariants = {};
      unlocked.forEach(function(row) {
        if (!skinKeyState.unlockedVariants[row.user_pet_id]) {
          skinKeyState.unlockedVariants[row.user_pet_id] = [];
        }
        skinKeyState.unlockedVariants[row.user_pet_id].push(row.variant_id);
      });
      dbg('✨ Unlocked variants loaded:', Object.keys(skinKeyState.unlockedVariants).length, 'pets');
    }
    var { data: pets } = await supabaseClient.from('user_pets').select('id, current_variant').eq('user_id', currentUser.id);
    if (pets) {
      pets.forEach(function(pet) {
        if (pet.current_variant) {
          skinKeyState.currentVariants[pet.id] = pet.current_variant;
        }
      });
    }
    skinkey_updateDisplay();
  } catch (error) {
    console.error('❌ Error loading skin key data:', error);
  }
}

function skinkey_updateDisplay() {
  var keyCounters = document.querySelectorAll('.skin-key-count');
  keyCounters.forEach(function(el) {
    el.textContent = skinKeyState.keys;
  });
  // Update navbar skin key display
  var navKeyCount = document.getElementById('nav-skin-key-count');
  if (navKeyCount) navKeyCount.textContent = skinKeyState.keys;
  var navKeyDisplay = document.getElementById('nav-skin-key-display');
  if (navKeyDisplay) navKeyDisplay.style.display = 'flex';
  skinkey_updateVariantButtons();
}

async function skinkey_unlockVariant(userPetId, variantId) {
  if (!currentUser) {
    showToast('Please log in first', 'error');
    return false;
  }
  if (!BASIC_VARIANTS[variantId]) {
    showToast('Invalid variant', 'error');
    return false;
  }
  if (skinKeyState.unlockedVariants[userPetId] && skinKeyState.unlockedVariants[userPetId].indexOf(variantId) !== -1) {
    showToast('Variant already unlocked!', 'info');
    return false;
  }
  var cost = BASIC_VARIANTS[variantId].cost;
  if (skinKeyState.keys < cost) {
    showToast('Not enough Skin Keys! Need ' + cost, 'error');
    return false;
  }
  try {
    var { data: spendResult, error: updateError } = await supabaseClient.rpc('spend_skin_key_secure', {
      p_amount: cost,
      p_reason: 'variant_unlock_' + variantId
    });
    if (updateError) throw updateError;
    if (spendResult && spendResult.error) throw new Error(spendResult.error);
    var { error: unlockError } = await supabaseClient.from('unlocked_variants').insert({ user_pet_id: userPetId, variant_id: variantId });
    if (unlockError) {
      // Refund if unlock insert fails
      await supabaseClient.rpc('award_skin_key_secure', { p_amount: cost, p_reason: 'variant_unlock_refund' });
      throw unlockError;
    }
    if (spendResult && spendResult.skin_keys !== undefined) skinKeyState.keys = spendResult.skin_keys;
    skinKeyState.keys -= cost;
    if (!skinKeyState.unlockedVariants[userPetId]) {
      skinKeyState.unlockedVariants[userPetId] = [];
    }
    skinKeyState.unlockedVariants[userPetId].push(variantId);
    skinkey_updateDisplay();
    var variantName = BASIC_VARIANTS[variantId].name;
    showToast('✨ Unlocked ' + variantName + ' variant!', 'success', true);
    dbg('🔑 Unlocked variant:', variantId, 'for pet', userPetId);
    return true;
  } catch (error) {
    console.error('❌ Error unlocking variant:', error);
    showToast('Failed to unlock variant', 'error');
    return false;
  }
}

async function skinkey_applyVariant(userPetId, variantId) {
  if (!currentUser) {
    showToast('Please log in first', 'error');
    return false;
  }
  if (variantId === null || variantId === 'none') {
    variantId = null;
  }
  if (variantId && !SPECIAL_VARIANTS.includes(variantId)) {
    if (!skinKeyState.unlockedVariants[userPetId] || skinKeyState.unlockedVariants[userPetId].indexOf(variantId) === -1) {
      showToast('Variant not unlocked yet!', 'error');
      return false;
    }
  }
  try {
    var { error } = await supabaseClient.from('user_pets').update({ current_variant: variantId }).eq('id', userPetId);
    if (error) throw error;
    if (variantId) {
      skinKeyState.currentVariants[userPetId] = variantId;
    } else {
      delete skinKeyState.currentVariants[userPetId];
    }
    skinkey_applyVariantToAllDisplays(userPetId, variantId);
    if (variantId) {
      var displayName = BASIC_VARIANTS[variantId] ? BASIC_VARIANTS[variantId].name : variantId;
      showToast('✨ Applied ' + displayName + ' variant!', 'success');
    } else {
      showToast('Removed variant', 'info');
    }
    dbg('✨ Applied variant:', variantId, 'to pet', userPetId);
    return true;
  } catch (error) {
    console.error('❌ Error applying variant:', error);
    showToast('Failed to apply variant', 'error');
    return false;
  }
}

function skinkey_applyVariantToAllDisplays(userPetId, variantId) {
  // All variant CSS classes to strip before applying new one
  var allVariantClasses = Object.keys(BASIC_VARIANTS).map(function(vid) {
    return BASIC_VARIANTS[vid].cssClass;
  }).concat(SPECIAL_VARIANTS.map(function(vid) { return 'pet-variant-' + vid; }));

  function applyToEl(el) {
    if (!el) return;
    allVariantClasses.forEach(function(cls) { el.classList.remove(cls); });
    if (variantId) {
      var cls = BASIC_VARIANTS[variantId] ? BASIC_VARIANTS[variantId].cssClass : 'pet-variant-' + variantId;
      el.classList.add(cls);
    }
  }

  // Target the card by its actual ID
  var card = document.getElementById('petcard-' + userPetId);
  applyToEl(card);

  // Also target the avatar div inside the card
  if (card) {
    applyToEl(card.querySelector('.pet-avatar'));
    applyToEl(card.querySelector('.pet-avatar-wrap'));
    // Spawn particles on the card
    createVariantParticles(card, variantId, 12);
  }

  // Update companion if this is the active companion
  if (window.companionPetId && window.companionPetId === userPetId) {
    skinkey_updateCompanionVariant(variantId);
  }
}

// ── Variant particle system ──────────────────────────────────────────────────
// Creates floating emoji particles on a card element.
// count defaults to 12 for pet cards, pass 5 for companion buddy.
var VARIANT_PARTICLES = {
  ghost:    ['👻','💀','🕯️','🌙','✨'],
  shadow:   ['🌑','🖤','💜','🌙','✨'],
  golden:   ['✨','⭐','💫','🌟','👑'],
  shiny:    ['🌟','⭐','✨','💫','🌈'],
  cosmic:   ['⭐','🌠','✨','💫','🌌'],
  fire:     ['🔥','🎇','✨','💥','🌋'],
  ice:      ['❄️','💠','🔹','✨','🌨️'],
  electric: ['⚡','💥','✨','💫','🔋'],
  nature:   ['🍃','🌿','🌸','🍂','🌻'],
  crystal:  ['💎','✨','🔮','💠','⭐'],
  rainbow:  ['🌈','✨','🌟','💫','⭐']
};

function createVariantParticles(el, variantId, count) {
  if (!el || !variantId) return;
  count = count || 12;

  // Clear existing particles first
  el.querySelectorAll('.variant-particle').forEach(function(p) { p.remove(); });

  var emojis = VARIANT_PARTICLES[variantId] || ['✨'];

  for (var i = 0; i < count; i++) {
    var p = document.createElement('div');
    p.className = 'variant-particle particle-' + variantId;
    p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    p.style.cssText = [
      'position:absolute',
      'pointer-events:none',
      'z-index:100',
      'font-size:' + (14 + Math.random() * 10) + 'px',
      'left:' + Math.random() * 90 + '%',
      'top:' + Math.random() * 90 + '%',
      'animation:varParticleFloat ' + (2 + Math.random() * 2.5) + 's ease-out ' + (Math.random() * 3) + 's infinite',
      'opacity:0'
    ].join(';');
    el.appendChild(p);
  }
}
function skinkey_updateCompanionVariant(variantId) {
  // Actual companion element is #companion-sprite with class .companion-sprite
  var companion = document.getElementById('companion-sprite');
  if (!companion) return;

  // Strip all variant classes
  Object.keys(BASIC_VARIANTS).forEach(function(vid) {
    companion.classList.remove(BASIC_VARIANTS[vid].cssClass);
  });
  SPECIAL_VARIANTS.forEach(function(vid) {
    companion.classList.remove('pet-variant-' + vid);
  });

  // Apply new variant class
  if (variantId) {
    var cls = BASIC_VARIANTS[variantId] ? BASIC_VARIANTS[variantId].cssClass : 'pet-variant-' + variantId;
    companion.classList.add(cls);
    // Spawn a handful of particles on the companion buddy
    var buddyEl = document.getElementById('companion-buddy');
    if (buddyEl) createVariantParticles(buddyEl, variantId, 5);
  } else {
    // Remove companion particles when variant cleared
    var buddyEl = document.getElementById('companion-buddy');
    if (buddyEl) {
      buddyEl.querySelectorAll('.variant-particle').forEach(function(p) { p.remove(); });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PET-SPECIFIC VARIANT MANAGER MODAL
// Uses existing skinkey_unlockVariant / skinkey_applyVariant — no wrappers
// ═══════════════════════════════════════════════════════════════════════════

async function showPetVariantModal(petId, petName) {
  if (!currentUser) { showToast('Please log in first', 'error'); return; }

  // Refresh key balance from DB before showing so it's always current
  await skinkey_loadUserData();

  var modal = makeModal();

  // Header
  var currentVariantId   = skinkey_getCurrentVariant(petId);
  var currentVariantData = currentVariantId ? BASIC_VARIANTS[currentVariantId] : null;
  var keys = skinKeyState.keys;

  var header = '<h2 style="text-align:center;color:var(--purple);margin:0 0 4px;">🎨 ' + escapeHtml(petName) + ' Variants</h2>' +
    '<p style="text-align:center;color:var(--text-light);font-size:0.88rem;margin:0 0 14px;">🔑 Skin Keys: <strong style="color:#FFD700;">' + keys + '</strong></p>' +
    '<div style="background:rgba(153,102,255,0.1);border-radius:10px;padding:10px 14px;margin-bottom:16px;text-align:center;">' +
    '<span style="font-size:0.9rem;color:var(--text-light);">Currently equipped: </span>' +
    '<strong style="color:' + (currentVariantData ? currentVariantData.color || '#9966ff' : '#9966ff') + ';">' +
    (currentVariantData ? currentVariantData.icon + ' ' + currentVariantData.name : '★ Original') + '</strong></div>';

  // Build variant grid
  var gridHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;max-height:380px;overflow-y:auto;margin-bottom:14px;">';

  // "None / Original" card
  var noneActive = !currentVariantId;
  gridHtml += '<div style="border:2px solid ' + (noneActive ? '#9966ff' : 'var(--border)') + ';border-radius:12px;padding:12px;text-align:center;background:' + (noneActive ? 'rgba(153,102,255,0.12)' : 'transparent') + ';position:relative;">' +
    (noneActive ? '<div style="position:absolute;top:-8px;right:-8px;background:#9966ff;color:white;padding:1px 7px;border-radius:10px;font-size:0.68rem;font-weight:bold;">ACTIVE</div>' : '') +
    '<div style="font-size:1.8rem;margin-bottom:6px;">★</div>' +
    '<div style="font-weight:bold;font-size:0.85rem;margin-bottom:3px;">Original</div>' +
    '<div style="font-size:0.7rem;color:var(--text-light);margin-bottom:8px;">Default appearance</div>' +
    (noneActive
      ? '<button disabled style="width:100%;padding:5px;border-radius:7px;border:none;background:#4ade80;color:#1a1a2e;font-size:0.78rem;font-weight:bold;">Equipped</button>'
      : '<button onclick="skinkey_applyVariant(\'' + petId + '\',null).then(function(){closeModal();tabsLoaded[\'mypets\']=false;loadMyPets();})" style="width:100%;padding:5px;border-radius:7px;border:none;background:rgba(153,102,255,0.2);color:var(--purple);font-size:0.78rem;cursor:pointer;">Remove Variant</button>'
    ) + '</div>';

  // All BASIC_VARIANTS
  Object.keys(BASIC_VARIANTS).forEach(function(variantId) {
    var v = BASIC_VARIANTS[variantId];
    // Merge color from petVariants if available
    var pv = petVariants[variantId];
    var color = (pv && pv.color) ? pv.color : '#9966ff';
    var isUnlocked = skinkey_isVariantUnlocked(petId, variantId);
    var isActive   = currentVariantId === variantId;
    var canAfford  = keys >= (v.cost || 1);

    gridHtml += '<div style="border:2px solid ' + (isActive ? color : 'var(--border)') + ';border-radius:12px;padding:12px;text-align:center;background:' + (isActive ? color + '20' : 'transparent') + ';position:relative;opacity:' + (isUnlocked || canAfford ? '1' : '0.6') + ';' + (isActive ? 'box-shadow:0 0 12px ' + color + '66;' : '') + '">' +
      (isActive ? '<div style="position:absolute;top:-8px;right:-8px;background:' + color + ';color:white;padding:1px 7px;border-radius:10px;font-size:0.68rem;font-weight:bold;">ACTIVE</div>' : '') +
      '<div style="font-size:1.8rem;margin-bottom:6px;">' + v.icon + '</div>' +
      '<div style="font-weight:bold;font-size:0.85rem;margin-bottom:3px;color:' + color + ';">' + v.name + '</div>' +
      '<div style="font-size:0.7rem;color:var(--text-light);margin-bottom:8px;">' + v.description + '</div>' +
      '<div style="font-size:0.75rem;font-weight:bold;color:#FFD700;margin-bottom:6px;">' + (v.cost || 1) + ' 🔑</div>';

    if (isActive) {
      gridHtml += '<button disabled style="width:100%;padding:5px;border-radius:7px;border:none;background:#4ade80;color:#1a1a2e;font-size:0.78rem;font-weight:bold;">Equipped</button>';
    } else if (isUnlocked) {
      gridHtml += '<button onclick="skinkey_applyVariant(\'' + petId + '\',\'' + variantId + '\').then(function(){closeModal();tabsLoaded[\'mypets\']=false;loadMyPets();})" style="width:100%;padding:5px;border-radius:7px;border:none;background:linear-gradient(135deg,' + color + ',' + color + 'aa);color:white;font-size:0.78rem;cursor:pointer;font-weight:bold;">Equip</button>';
    } else {
      gridHtml += '<button ' + (canAfford ? 'onclick="skinkey_unlockVariant(\'' + petId + '\',\'' + variantId + '\').then(function(ok){if(ok){closeModal();tabsLoaded[\'mypets\']=false;loadMyPets();}})"' : 'disabled') + ' style="width:100%;padding:5px;border-radius:7px;border:none;background:' + (canAfford ? 'linear-gradient(135deg,#FFD700,#FFA500)' : '#555') + ';color:' + (canAfford ? '#1a1a2e' : '#888') + ';font-size:0.75rem;cursor:' + (canAfford ? 'pointer' : 'not-allowed') + ';font-weight:bold;">Unlock (' + (v.cost || 1) + ' 🔑)</button>';
    }

    gridHtml += '</div>';
  });

  gridHtml += '</div>';

  var footer = '<div style="background:rgba(0,0,0,0.06);border-radius:8px;padding:10px 14px;font-size:0.8rem;color:var(--text-light);">' +
    '💡 <strong>Earn Skin Keys:</strong> Bingo blackout • PawketPass Lv.19/24/29/36/42/46/49 • Special events' +
    '</div>' +
    '<button onclick="closeModal()" class="btn btn-outline" style="width:100%;margin-top:14px;">Close</button>';

  modal.innerHTML = header + gridHtml + footer;
  openModal(modal);
}

function skinkey_buildVariantSelector(userPetId) {
  var unlocked = skinKeyState.unlockedVariants[userPetId] || [];
  var current = skinKeyState.currentVariants[userPetId] || null;
  var html = '<div class="variant-selector">';
  html += '<h3>🎨 Pet Variants</h3>';
  html += '<p class="skin-key-balance">Skin Keys: <span class="skin-key-count">' + skinKeyState.keys + '</span> 🔑</p>';
  html += '<div class="variant-option ' + (current === null ? 'active' : '') + '">';
  html += '  <button onclick="skinkey_applyVariant(\'' + userPetId + '\', null)" ' + (current === null ? 'disabled' : '') + '>None (Default)</button>';
  html += '</div>';
  Object.keys(BASIC_VARIANTS).forEach(function(variantId) {
    var variant = BASIC_VARIANTS[variantId];
    var isUnlocked = unlocked.indexOf(variantId) !== -1;
    var isActive = current === variantId;
    html += '<div class="variant-option ' + (isActive ? 'active' : '') + ' ' + (isUnlocked ? 'unlocked' : 'locked') + '">';
    html += '  <div class="variant-info">';
    html += '    <span class="variant-icon">' + variant.icon + '</span>';
    html += '    <span class="variant-name">' + variant.name + '</span>';
    html += '    <span class="variant-desc">' + variant.description + '</span>';
    html += '  </div>';
    if (isUnlocked) {
      if (isActive) {
        html += '  <button disabled>Active ✓</button>';
      } else {
        html += '  <button onclick="skinkey_applyVariant(\'' + userPetId + '\', \'' + variantId + '\')">Apply</button>';
      }
    } else {
      html += '  <button onclick="skinkey_unlockVariant(\'' + userPetId + '\', \'' + variantId + '\')">Unlock (1 🔑)</button>';
    }
    html += '</div>';
  });
  html += '</div>';
  return html;
}

function skinkey_updateVariantButtons() {
  var buttons = document.querySelectorAll('.variant-option button');
  buttons.forEach(function(btn) {
  });
}

async function skinkey_grantKeys(amount, reason) {
  if (!currentUser) return false;
  try {
    var { data: rpcResult, error } = await supabaseClient.rpc('award_skin_key_secure', {
      p_amount: amount,
      p_reason: reason || 'award'
    });
    if (error) throw error;
    if (rpcResult && rpcResult.error) throw new Error(rpcResult.error);
    var newTotal = (rpcResult && rpcResult.skin_keys !== undefined) ? rpcResult.skin_keys : skinKeyState.keys + amount;
    skinKeyState.keys = newTotal;
    skinkey_updateDisplay();
    // Refresh from DB to ensure displayed count is accurate
    await skinkey_loadUserData();
    showToast('🔑 Received ' + amount + ' Skin Key' + (amount > 1 ? 's' : '') + '!', 'success');
    dbg('🔑 Granted', amount, 'skin keys:', reason);
    return true;
  } catch (error) {
    console.error('❌ Error granting skin keys:', error);
    return false;
  }
}

async function skinkey_init() {
  if (!currentUser) return;
  dbg('🔑 Initializing Skin Key system...');
  await skinkey_loadUserData();
  dbg('✅ Skin Key system ready');
}

function skinkey_isVariantUnlocked(userPetId, variantId) {
  return skinKeyState.unlockedVariants[userPetId] && skinKeyState.unlockedVariants[userPetId].indexOf(variantId) !== -1;
}

function skinkey_getCurrentVariant(userPetId) {
  return skinKeyState.currentVariants[userPetId] || null;
}

// ════════════════════════════════════════════════════════════════════════════
// RATE LIMITING - CLIENT-SIDE DISPLAY (optional)
// ════════════════════════════════════════════════════════════════════════════

async function getDailyRemaining() {
  if (!currentUser) return { feedsRemaining: 0, playsRemaining: 0, battlesRemaining: 0 };
  
  try {
    var { data } = await supabaseClient
      .from('user_daily_limits')
      .select('feed_total, play_total, battle_total')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    
    return {
      feedsRemaining: Math.max(0, 50 - (data?.feed_total || 0)),
      playsRemaining: Math.max(0, 50 - (data?.play_total || 0)),
      battlesRemaining: Math.max(0, 50 - (data?.battle_total || 0))
    };
  } catch (error) {
    console.error('Error fetching daily limits:', error);
    return { feedsRemaining: 50, playsRemaining: 50, battlesRemaining: 50 };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ALL NEW FEATURES - COMPLETE IMPLEMENTATION
// Founder Badges, Rare Collectibles, Today in PawketPets, Login Calendar, 
// Screenshot Cards, PawketPass
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// 1. FOUNDER BADGES SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

var founderBadges = {
  tiers: {
    alpha: {
      name: 'Alpha Founder',
      badge: 'founder_alpha',
      frame: 'founder_alpha_frame',
      title: 'Alpha Founder',
      cutoffDate: '2024-06-01'
    },
    beta: {
      name: 'Beta Founder',
      badge: 'founder_beta',
      frame: 'founder_beta_frame',
      title: 'Beta Founder',
      cutoffDate: '2024-08-01'
    },
    early: {
      name: 'Early Supporter',
      badge: 'founder_early',
      frame: 'founder_early_frame',
      title: 'Early Supporter',
      cutoffDate: '2024-09-01'
    }
  }
};


function showFounderCelebration(tier, founderData) {
  var modal = document.createElement('div');
  modal.className = 'modal-overlay founder-celebration';
  modal.innerHTML = `
    <div class="modal-content founder-modal">
      <div class="founder-header">
        <div class="founder-icon">👑</div>
        <h2>FOUNDER STATUS GRANTED!</h2>
      </div>
      <div class="founder-body">
        <div class="founder-tier ${tier}">${founderData.name}</div>
        <p class="founder-desc">Thank you for being an early supporter!</p>
        <div class="founder-rewards">
          <h3>🎁 Exclusive Rewards:</h3>
          <div class="reward-item">✨ ${founderData.badge} Badge</div>
          <div class="reward-item">🖼️ ${founderData.frame} Frame</div>
          <div class="reward-item">🏷️ "${founderData.title}" Title</div>
        </div>
        <p class="founder-exclusive">These items can never be obtained again!</p>
      </div>
      <button class="btn-primary" onclick="this.closest('.modal-overlay').remove()">
        Awesome! Thank You! 🎉
      </button>
    </div>
  `;
  document.body.appendChild(modal);
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. RARE COLLECTIBLES SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

var rareCollectibles = {
  rarities: {
    rare: { color: '#3b82f6', label: 'Rare', dropRate: 0.05 },
    epic: { color: '#a855f7', label: 'Epic', dropRate: 0.02 },
    legendary: { color: '#f59e0b', label: 'Legendary', dropRate: 0.01 },
    mythic: { color: '#ec4899', label: 'Mythic', dropRate: 0.005 }
  }
};


function showRareDropCelebration(rare) {
  var rarityData = rareCollectibles.rarities[rare.rarity] || rareCollectibles.rarities.rare;
  
  var modal = document.createElement('div');
  modal.className = 'modal-overlay rare-drop-celebration';
  modal.innerHTML = `
    <div class="modal-content rare-drop-modal" style="border-color: ${rarityData.color};">
      <div class="rare-drop-header">
        <div class="rare-drop-icon" style="color: ${rarityData.color};">✨</div>
        <h2 style="color: ${rarityData.color};">${rarityData.label.toUpperCase()} DROP!</h2>
      </div>
      <div class="rare-drop-body">
        <div class="rare-drop-name">${rare.name}</div>
        <p class="rare-drop-desc">${rare.description}</p>
        <div class="rare-drop-stats">
          <div class="rare-stat">
            <span class="stat-label">Rarity:</span>
            <span class="stat-value" style="color: ${rarityData.color};">${rarityData.label}</span>
          </div>
          <div class="rare-stat">
            <span class="stat-label">Drop Rate:</span>
            <span class="stat-value">${(rare.drop_rate * 100).toFixed(2)}%</span>
          </div>
          <div class="rare-stat">
            <span class="stat-label">Obtained By:</span>
            <span class="stat-value">${rare.obtained_count + 1} players</span>
          </div>
        </div>
      </div>
      <button class="btn-primary" onclick="this.closest('.modal-overlay').remove()">
        Amazing! 🎉
      </button>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Play sound effect
  if (typeof playBattleSound === 'function') {
    playBattleSound('victory', 0.5);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. TODAY IN PAWKETPETS — home tab summary card
// Single source of truth for each data point (no independent weather
// generation here — that was the old todayFeatures system, removed because
// it wrote its own weather vocabulary to daily_features.weather and
// conflicted with weatherSystem):
//   - weather        -> weatherSystem.currentWeather
//   - daily stats     -> loadDailyStatsToday() (daily_stats table)
//   - featured goal   -> community_loadGoals() (community_goals table)
//   - live streamers  -> _currentlyLiveStreamers
// ═══════════════════════════════════════════════════════════════════════════

// Returns count of players active in the last hour (last_login within 60 min)
async function getOnlinePlayerCount() {
  try {
    var since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    var { count, error } = await supabaseClient
      .from('players')
      .select('id', { count: 'exact', head: true })
      .gte('last_login', since);
    if (error) throw error;
    return count || 0;
  } catch (e) {
    return null; // silently fail — non-critical
  }
}

async function todayCard_init() {
  try {
    await todayCard_render();
  } catch (err) {
    console.error('[TodayCard] init error:', err);
  }
}

async function todayCard_render() {
  var mount = document.getElementById('today-card-mount');
  if (!mount) return; // home tab markup not present (e.g. logged out)

  // Weather — read from the single source of truth, don't generate our own
  if (typeof weatherSystem !== 'undefined' && !weatherSystem.currentWeather) {
    try { await weatherSystem.init(); } catch (e) {}
  }
  var weather = (typeof weatherSystem !== 'undefined' && weatherSystem.currentWeather) ? weatherSystem.currentWeather : null;

  // Daily stats (cached module-level, non-blocking if it fails)
  var stats = {};
  try { stats = await loadDailyStatsToday(); } catch (e) { stats = {}; }

  // One featured community goal — closest to completion surfaces first
  var goal = null;
  try {
    var goals = await community_loadGoals();
    if (goals && goals.length) {
      goal = goals.slice().sort(function(a, b) {
        var ra = (a.current_progress || 0) / Math.max(1, a.goal_target || 1);
        var rb = (b.current_progress || 0) / Math.max(1, b.goal_target || 1);
        return rb - ra;
      })[0];
    }
  } catch (e) { goal = null; }

  // Live streamers
  var liveCount = (typeof _currentlyLiveStreamers !== 'undefined') ? _currentlyLiveStreamers.length : 0;

  // Online players (last 60 min) — non-blocking
  var onlineCount = null;
  try { onlineCount = await getOnlinePlayerCount(); } catch (e) {}

  // MINI SEASONS: banner for whatever's currently active (can be more than
  // one at once — a custom event layered over a calendar season, etc)
  var seasonHtml = '';
  try {
    var activeSeasons = await getActiveMiniSeasons();
    seasonHtml = activeSeasons.map(function(s) {
      return '<div class="today-card-season" onclick="showSeasonPassModal(\'' + s.season_key + '\')">' +
        (s.icon || '🎫') + ' <strong>' + escapeHtml(s.name) + '</strong> is here! Tap for seasonal rewards →' +
      '</div>';
    }).join('');
  } catch (e) { seasonHtml = ''; }

  // WORLD STATE: show the current corruption level with a short
  // narrative line, tying boss kills to something visibly persistent,
  // plus two deliberate buttons so players actually have a say in which
  // direction it moves (not just an automatic side-effect of boss kills)
  var worldStateHtml = '';
  try {
    var corruptionLevel = await getWorldStateValue('corruption_level', 50);
    // Display as Beta Integrity (inverted: high integrity = good)
    var integrityLevel = Math.round(100 - corruptionLevel);
    var integrityDesc = integrityLevel >= 75 ? 'The beta is running stable. Integrity is high.'
      : integrityLevel >= 50 ? 'The beta is holding together, thanks to recent boss defeats.'
      : integrityLevel >= 25 ? 'The beta feels a little more stable today, thanks to recent boss kills.'
      : 'Critical instability detected. The beta is failing. Defeat bosses to restore integrity.';
    var tooltipHtml = '<span class="beta-integrity-tooltip" title="" onclick="showBetaIntegrityInfo()">❓</span>';
    worldStateHtml = '<div class="today-card-worldstate">' +
      '🖥️ Beta Integrity: ' + integrityLevel + '%. ' + integrityDesc + ' ' + tooltipHtml +
      '<div class="today-card-ritual-buttons">' +
        '<div style="font-size:0.72rem;color:var(--text-light);margin-bottom:4px">Each ritual shifts integrity by ~1%</div>' +
        '<button class="today-card-ritual-btn purify" onclick="performCorruptionRitual(\'purify\')" title="Spend 100 PP to raise Beta Integrity by ~1%">🛠️ Debug (+1% · 100 PP)</button>' +
        '<button class="today-card-ritual-btn corrupt" onclick="performCorruptionRitual(\'corrupt\')" title="Spend 100 PP to lower Beta Integrity by ~1%">💀 Break It (−1% · 100 PP)</button>' +
      '</div>' +
    '</div>';
  } catch (e) { worldStateHtml = ''; }

  var weatherHtml = weather
    ? '<div class="today-card-weather"><span class="today-card-icon">' + weather.icon + '</span> ' +
      '<strong>' + weather.name + '</strong>: ' + weather.effect + '</div>'
    : '<div class="today-card-weather">Loading weather...</div>';

  var onlineHtml = onlineCount !== null
    ? '<div class="today-card-online">🟢 <strong>' + onlineCount + '</strong> player' + (onlineCount !== 1 ? 's' : '') + ' online in the last hour</div>'
    : '';

  // Streak display — read from cached player data
  var currentStreak = (typeof dailyLoginStreak !== 'undefined' && dailyLoginStreak) || 0;
  var nextMilestone = currentStreak < 3 ? 3 : currentStreak < 5 ? 5 : currentStreak < 7 ? 7 : currentStreak < 14 ? 14 : currentStreak < 30 ? 30 : null;
  var streakHtml = '<div class="today-card-streak">' +
    '🔥 <strong>' + currentStreak + ' day streak</strong>' +
    (nextMilestone ? ' &nbsp;·&nbsp; next milestone: <strong>Day ' + nextMilestone + '</strong>' +
      (nextMilestone === 5 || nextMilestone === 7 ? ' 🗝️' : nextMilestone === 3 ? ' 🍪' : ' 🌟') : ' 🏆 Max streak legend!') +
    '</div>';

  var statsHtml = '<div class="today-card-stats">' +
    '⚔️ ' + (stats.battles_won || 0) + ' battles won &nbsp;•&nbsp; ' +
    '👑 ' + (stats.bosses_killed || 0) + ' bosses defeated &nbsp;•&nbsp; ' +
    '🐾 ' + (stats.pets_adopted || 0) + ' pets adopted today' +
    '</div>';

  var goalHtml = '';
  if (goal) {
    var pct = Math.min(100, Math.round(((goal.current_progress || 0) / Math.max(1, goal.goal_target || 1)) * 100));
    goalHtml = '<div class="today-card-goal">' +
      '🎯 <strong>' + goal.title + '</strong>: ' + (goal.current_progress || 0) + ' / ' + goal.goal_target + ' (' + pct + '%)' +
      '<div class="today-card-goal-bar"><div class="today-card-goal-fill" style="width:' + pct + '%;"></div></div>' +
      '</div>';
  }

  var liveHtml = liveCount > 0
    ? '<div class="today-card-live">🔴 ' + liveCount + ' team member' + (liveCount !== 1 ? 's' : '') + ' live right now!</div>'
    : '';

  // Build a cleaner, sectioned Today card layout
  var liveAndOnlineHtml = '';
  if (liveHtml || onlineHtml) {
    liveAndOnlineHtml = '<div class="today-card-row today-card-row-meta">' + liveHtml + onlineHtml + '</div>';
  }

  var weatherAndStreakHtml =
    '<div class="today-card-row today-card-row-split">' +
      '<div class="today-card-col">' + weatherHtml + '</div>' +
      '<div class="today-card-col">' + streakHtml + '</div>' +
    '</div>';

  mount.innerHTML =
    '<div class="today-card">' +
      '<div class="today-card-header">🌟 Today in PawketPets</div>' +
      (seasonHtml ? '<div class="today-card-section">' + seasonHtml + '</div>' : '') +
      (liveAndOnlineHtml ? '<div class="today-card-section today-card-section-live">' + liveAndOnlineHtml + '</div>' : '') +
      '<div class="today-card-section">' + weatherAndStreakHtml + '</div>' +
      (worldStateHtml ? '<div class="today-card-section today-card-section-world">' + worldStateHtml + '</div>' : '') +
      '<div class="today-card-section today-card-section-stats">' + statsHtml + '</div>' +
      (goalHtml ? '<div class="today-card-section">' + goalHtml + '</div>' : '') +
    '</div>';
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. LOGIN CALENDAR VISUAL SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

var loginCalendar = {
  currentStreak: 0,
  calendarRewards: null
};

async function calendar_init() {
  await calendar_loadRewards();
  calendar_displayWidget();
}

async function calendar_loadRewards() {
  try {
    var { data: rewards } = await supabaseClient
      .from('login_calendar_rewards')
      .select('*')
      .order('day');
    
    loginCalendar.calendarRewards = rewards || [];
  } catch (err) {
    console.error('Error loading calendar rewards:', err);
  }
}

function calendar_displayWidget() {
  var mount = document.getElementById('calendar-widget-mount');
  if (!mount) return;
  
  var streak = loginCalendar.currentStreak || 0;
  var nextDay = Math.min(streak + 1, 30);
  var nextReward = loginCalendar.calendarRewards ? loginCalendar.calendarRewards.find(function(r) { return r.day === nextDay; }) : null;
  
  var widget = document.createElement('div');
  widget.className = 'calendar-widget';
  widget.onclick = function() { calendar_showFullModal(); };
  
  var html = '<div class="calendar-header">';
  html += '  <span class="calendar-title">📅 Day ' + streak + ' Streak</span>';
  if (nextReward) {
    html += '  <span class="calendar-next">Next: ' + nextReward.pp_reward + ' PP';
    if (nextReward.skin_keys > 0) html += ' + ' + nextReward.skin_keys + ' 🔑';
    html += '</span>';
  }
  html += '</div>';
  
  html += '<div class="calendar-dots">';
  for (var i = 1; i <= 7; i++) {
    var dayClass = 'dot';
    if (i <= streak) dayClass += ' completed';
    else if (i === streak + 1) dayClass += ' active';
    
    var dayReward = loginCalendar.calendarRewards ? loginCalendar.calendarRewards.find(function(r) { return r.day === i; }) : null;
    if (dayReward && dayReward.is_milestone) dayClass += ' milestone';
    
    html += '<span class="' + dayClass + '">' + (i <= streak ? '✓' : i) + '</span>';
  }
  html += '</div>';
  
  widget.innerHTML = html;
  
  mount.innerHTML = ''; // clear any previous render before re-inserting
  mount.appendChild(widget);
}

function calendar_showFullModal() {
  var streak = loginCalendar.currentStreak || 0;
  
  var modal = document.createElement('div');
  modal.className = 'modal-overlay calendar-modal-overlay';
  
  var html = '<div class="modal-content calendar-modal">';
  html += '  <div class="modal-header">';
  html += '    <h2>📅 30-Day Login Calendar</h2>';
  html += '    <button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">✕</button>';
  html += '  </div>';
  html += '  <div class="modal-body">';
  html += '    <div class="calendar-streak-display">Current Streak: <strong>' + streak + ' days</strong></div>';
  html += '    <div class="calendar-grid">';
  
  for (var i = 1; i <= 30; i++) {
    var dayReward = loginCalendar.calendarRewards ? loginCalendar.calendarRewards.find(function(r) { return r.day === i; }) : null;
    
    var dayClass = 'calendar-day';
    if (i <= streak) dayClass += ' completed';
    else if (i === streak + 1) dayClass += ' current';
    if (dayReward && dayReward.is_milestone) dayClass += ' milestone';
    
    html += '<div class="' + dayClass + '">';
    html += '  <div class="day-number">Day ' + i + '</div>';
    if (dayReward) {
      html += '  <div class="day-reward">';
      html += '    <div class="reward-pp">' + dayReward.pp_reward + ' PP</div>';
      if (dayReward.skin_keys > 0) {
        html += '    <div class="reward-keys">' + dayReward.skin_keys + ' 🔑</div>';
      }
      if (dayReward.is_milestone) {
        html += '    <div class="reward-milestone">⭐ ' + dayReward.milestone_title + '</div>';
      }
      html += '  </div>';
    }
    if (i <= streak) {
      html += '  <div class="day-status">✓ Claimed</div>';
    } else if (i === streak + 1) {
      html += '  <div class="day-status current-day">← Today</div>';
    }
    html += '</div>';
  }
  
  html += '    </div>';
  html += '  </div>';
  html += '</div>';
  
  modal.innerHTML = html;
  document.body.appendChild(modal);
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. DAILY WELCOME MODAL (Combines Today + Calendar + Streak Reward)
// ═══════════════════════════════════════════════════════════════════════════

async function dailyWelcome_check() {
  var lastLogin = localStorage.getItem('lastDailyWelcome');
  var today = new Date().toDateString();
  
  if (lastLogin !== today) {
    await dailyWelcome_show();
    localStorage.setItem('lastDailyWelcome', today);
  }
}

async function dailyWelcome_show() {
  if (!currentUser) return;
  
  var streak = loginCalendar.currentStreak || 0;
  var dayReward = loginCalendar.calendarRewards ? loginCalendar.calendarRewards.find(function(r) { return r.day === streak; }) : null;
  var modal = document.createElement('div');
  modal.className = 'modal-overlay daily-welcome-modal';
  
  var html = '<div class="modal-content welcome-modal">';
  html += '  <div class="welcome-header">';
  html += '    <div class="welcome-icon">🎉</div>';
  html += '    <h2>WELCOME BACK!</h2>';
  html += '    <div class="welcome-streak">Day ' + streak + ' Streak</div>';
  html += '  </div>';
  
  html += '  <div class="welcome-body">';
  
  // Reward claimed
  if (dayReward) {
    html += '  <div class="welcome-reward-claimed">';
    html += '    <div class="claimed-icon">✨</div>';
    html += '    <div class="claimed-text">Day ' + streak + ' Complete!</div>';
    html += '    <div class="claimed-amount">+' + dayReward.pp_reward + ' PP';
    if (dayReward.skin_keys > 0) html += ' + ' + dayReward.skin_keys + ' 🔑';
    html += '</div>';
    if (dayReward.is_milestone) {
      html += '    <div class="claimed-milestone">⭐ ' + dayReward.milestone_title + '</div>';
    }
    html += '  </div>';
  }
  
  // Today features — reads from weatherSystem, the single source of truth
  var todayWeather = (typeof weatherSystem !== 'undefined' && weatherSystem.currentWeather) ? weatherSystem.currentWeather : null;
  if (todayWeather) {
    html += '  <div class="welcome-today">';
    html += '    <h3>🌟 TODAY IN PAWKETPETS</h3>';
    html += '    <div class="today-item">Weather: ' + todayWeather.icon + ' ' + todayWeather.name + '</div>';
    html += '    <div class="today-item">' + todayWeather.effect + '</div>';
    html += '  </div>';
  }
  
  // Calendar progress
  html += '  <div class="welcome-calendar">';
  html += '    <h3>📅 YOUR PROGRESS</h3>';
  html += '    <div class="welcome-calendar-dots">';
  for (var i = 1; i <= 7; i++) {
    var dotClass = 'w-dot';
    if (i <= streak) dotClass += ' completed';
    else if (i === streak + 1) dotClass += ' active';
    
    var dayReward2 = loginCalendar.calendarRewards ? loginCalendar.calendarRewards.find(function(r) { return r.day === i; }) : null;
    if (dayReward2 && dayReward2.is_milestone) dotClass += ' milestone';
    
    html += '<span class="' + dotClass + '">' + (i <= streak ? '✓' : i) + '</span>';
  }
  html += '    </div>';
  
  var nextDay = Math.min(streak + 1, 30);
  var nextReward = loginCalendar.calendarRewards ? loginCalendar.calendarRewards.find(function(r) { return r.day === nextDay; }) : null;
  if (nextReward) {
    html += '    <div class="welcome-next">🎁 Tomorrow: Day ' + nextDay + ' - ' + nextReward.pp_reward + ' PP';
    if (nextReward.skin_keys > 0) html += ' + ' + nextReward.skin_keys + ' 🔑';
    if (nextReward.is_milestone) html += ' + ' + nextReward.milestone_title;
    html += '</div>';
  }
  html += '  </div>';
  
  html += '  </div>';
  
  html += '  <button class="btn-primary btn-large" onclick="this.closest(\'.modal-overlay\').remove()">';
  html += '    Let\'s Go! 🚀';
  html += '  </button>';
  html += '</div>';
  
  modal.innerHTML = html;
  document.body.appendChild(modal);
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. SCREENSHOT CARD SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// PET SNAPSHOT CARD — 600x800 shareable card with title, variant, stats
// Called by the "📸 Snapshot" button on each pet card in My Pets
// ═══════════════════════════════════════════════════════════════════════════

async function screenshot_generate(petId) {
  var snapBtn = document.getElementById('snap-' + petId);
  if (snapBtn) { snapBtn.textContent = '⏳'; snapBtn.disabled = true; }

  try {
    // ── Parallel data fetching for speed ──
    var petRes = await supabaseClient.from('user_pets').select('*').eq('id', petId).single();
    if (petRes.error || !petRes.data) { showToast('Pet not found', 3000); return; }
    var pet = petRes.data;

    var [ownerRes, speciesRes, equipRes, passRes] = await Promise.all([
      supabaseClient.from('players').select('username, active_player_title_id').eq('id', pet.user_id).single(),
      supabaseClient.from('pets').select('name, image_file, special_skill').eq('id', pet.pet_id).single(),
      supabaseClient.from('player_equipment').select('equipped_slot, equipment(name, rarity)').eq('user_id', pet.user_id).eq('pet_id', petId).eq('is_equipped', true),
      supabaseClient.from('user_pass_progress').select('level').eq('user_id', pet.user_id).maybeSingle()
    ]);

    // Active pet title
    var petTitle = null;
    if (pet.active_pet_title_id) {
      var { data: t } = await supabaseClient.from('pet_titles').select('display_name,icon,rarity').eq('id', pet.active_pet_title_id).single();
      petTitle = t;
    }

    // Most recent scrapbook memory
    var memory = null;
    var { data: mems } = await supabaseClient.from('pet_memories').select('memory_text').eq('user_pet_id', petId).order('created_at', { ascending: false }).limit(1);
    if (mems && mems.length) memory = mems[0].memory_text;

    // ── Resolve values ──
    var owner   = ownerRes.data || {};
    var species = speciesRes.data || {};
    var petName = pet.nickname || species.name || 'Pet';
    var petType = species.name || pet.pet_type || 'Pet';
    var petLevel = pet.level || 1;

    // Evolution stage
    var stage = petLevel >= 20 ? 'Adult' : petLevel >= 10 ? 'Teen' : 'Baby';
    var stageEmoji = petLevel >= 20 ? '🦋' : petLevel >= 10 ? '🌿' : '🥚';

    // Mood from hunger/energy/happiness — shared helper, same formula the
    // scrapbook uses so a memory's mood tag always matches the card.
    var mood = computePetMood(pet);

    // Today's weather + season — same source of truth as the scrapbook tags
    var cardWeather = (typeof weatherSystem !== 'undefined' && weatherSystem.currentWeather) ? weatherSystem.currentWeather : null;
    var cardSeason = (typeof scrapbook_getCalendarSeason === 'function') ? scrapbook_getCalendarSeason() : null;

    // Variant
    var variantKey  = pet.current_variant || null;
    var variantDef  = variantKey ? (petVariants[variantKey] || (BASIC_VARIANTS && BASIC_VARIANTS[variantKey])) : null;
    var variantColor = variantDef ? variantDef.color : null;

    // Card gradient palette
    var gradA = variantColor || '#667eea';
    var gradB = variantColor ? screenshot_darken(variantColor, 0.4) : '#764ba2';
    var gradC = variantColor ? screenshot_lighten(variantColor, 0.3) : '#9966ff';

    // Equipment
    var equips = equipRes.data || [];
    var weapon = equips.find(function(e) { return e.equipped_slot === 'weapon' && e.equipment; });
    var armor  = equips.find(function(e) { return e.equipped_slot === 'armor'  && e.equipment; });

    // Pass level
    var passLevel = (passRes.data && passRes.data.level) || (passProgress && passProgress.level) || 1;

    // Battle stats
    var battlesWon  = pet.battles_won  || 0;
    var totalBattle = pet.total_battles || 0;
    var winRate     = totalBattle > 0 ? Math.round(battlesWon / totalBattle * 100) : 0;

    // Pet title text + color
    var rarityColors = { common:'#8e8e8e', uncommon:'#5cb85c', rare:'#5bc0de', epic:'#9c27b0', legendary:'#ff9800' };
    var titleText  = petTitle ? ((petTitle.icon || '') + ' ' + (petTitle.display_name || '')).trim() : '';
    var titleColor = petTitle ? (rarityColors[petTitle.rarity] || '#9966ff') : '#9966ff';

    // Type emoji
    var typeEmojis = { fire:'🔥', water:'💧', grass:'🌿', electric:'⚡', ice:'❄️', normal:'⭐' };
    var typeEmoji  = typeEmojis[pet.pet_type] || '🐾';

    // HP percent
    var hpPct = Math.min(1, (pet.current_hp || pet.base_hp || 60) / Math.max(1, (pet.max_hp || pet.base_hp || 60)));

    // ── Canvas setup ──
    var W = 600, H = 820;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');

    // ── Background: rich gradient ──
    var bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, gradA);
    bgGrad.addColorStop(0.5, gradB);
    bgGrad.addColorStop(1, gradC);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // ── Sparkle/star pattern overlay ──
    ctx.save();
    ctx.globalAlpha = 0.12;
    var starPositions = [[60,60],[180,35],[420,55],[540,80],[30,200],[570,180],[90,400],[510,380],[150,650],[450,630],[280,790],[80,760],[520,750]];
    starPositions.forEach(function(p) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '18px serif';
      ctx.textAlign = 'center';
      ctx.fillText('✦', p[0], p[1]);
    });
    ctx.globalAlpha = 1;
    ctx.restore();

    // ── White card panel ──
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.fillRect(24, 24, W - 48, H - 48);

    // ── Header gradient strip ──
    var hdrGrad = ctx.createLinearGradient(24, 24, W - 24, 160);
    hdrGrad.addColorStop(0, gradA + 'ee');
    hdrGrad.addColorStop(1, gradB + 'cc');
    ctx.fillStyle = hdrGrad;
    ctx.fillRect(24, 24, W - 48, 160);

    // ── Pet image with circular clip ──
    var imgLoaded = false;
    var imgPaths = [];
    if (species.image_file) imgPaths.push('images/' + species.image_file);
    var nameMap = { Ember:'ember.png', Pyxie:'pyxie.png', Steve:'cowbee.png', Kleat:'kelta.png', Blushimia:'blushimia.png', Cypurr:'cy.png', Aria:'aria.png', Jess:'jess.png', Gnarly:'gnarly.png' };
    if (nameMap[petType]) imgPaths.push('images/pets/' + nameMap[petType]);
    imgPaths.push('images/pets/' + petType.toLowerCase() + '.png');
    imgPaths.push('images/pets/' + petType.toLowerCase() + '.gif');

    for (var pi = 0; pi < imgPaths.length && !imgLoaded; pi++) {
      imgLoaded = await new Promise(function(resolve) {
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
          ctx.save();
          ctx.beginPath();
          ctx.arc(W/2, 120, 72, 0, Math.PI * 2);
          ctx.closePath();
          // Subtle glow ring
          ctx.shadowColor = variantColor || '#9966ff';
          ctx.shadowBlur = 20;
          ctx.clip();
          ctx.drawImage(img, W/2 - 72, 48, 144, 144);
          ctx.restore();
          ctx.shadowBlur = 0;
          resolve(true);
        };
        img.onerror = function() { resolve(false); };
        img.src = imgPaths[pi];
      });
    }

    if (!imgLoaded) {
      // Colored silhouette fallback with initial
      var initGrad = ctx.createRadialGradient(W/2, 120, 0, W/2, 120, 72);
      initGrad.addColorStop(0, gradC);
      initGrad.addColorStop(1, gradA);
      ctx.save();
      ctx.beginPath();
      ctx.arc(W/2, 120, 72, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = initGrad;
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 56px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(petName.charAt(0).toUpperCase(), W/2, 142);
    }

    // ── Ring around portrait ──
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(W/2, 120, 73, 0, Math.PI * 2);
    ctx.stroke();

    // ── Variant badge (top-right) ──
    if (variantDef) {
      ctx.fillStyle = variantColor;
      ctx.fillRect(420, 32, 150, 34);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(variantDef.icon + ' ' + variantDef.name, 495, 54);
    }

    // ── Stage badge (top-left) ──
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(28, 32, 100, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(stageEmoji + ' ' + stage, 78, 52);

    // ── Pet name ──
    ctx.fillStyle = '#1a1a2e';
    ctx.font = 'bold 34px Arial';
    ctx.textAlign = 'center';
    var displayName = petName.length > 20 ? petName.substring(0, 17) + '…' : petName;
    ctx.fillText(displayName, W/2, 220);

    // ── Active title ──
    if (titleText) {
      ctx.fillStyle = titleColor;
      ctx.font = 'bold 16px Arial';
      ctx.fillText(titleText, W/2, 244);
    }

    // ── Species pill ──
    ctx.fillStyle = '#f0ecff';
    ctx.fillRect(190, 256, 220, 30);
    ctx.fillStyle = '#5a3fa0';
    ctx.font = '14px Arial';
    ctx.fillText(typeEmoji + ' ' + petType + '  •  Lv. ' + petLevel, W/2, 276);

    // ── Mood + Weather/Season (kept on one line — canvas below here uses
    // absolute y-coordinates, so no new line is added to avoid shifting it) ──
    var contextBits = [cardWeather ? (cardWeather.icon + ' ' + cardWeather.name) : '', cardSeason ? (cardSeason.icon + ' ' + cardSeason.name) : ''].filter(Boolean).join(' · ');
    ctx.fillStyle = '#888';
    ctx.font = '13px Arial';
    ctx.fillText(mood.icon + ' ' + mood.label + '  |  🎮 Lv.' + passLevel + (contextBits ? '  |  ' + contextBits : ''), W/2, 300);

    // ── Divider ──
    ctx.strokeStyle = '#e0d5ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(40, 316); ctx.lineTo(W - 40, 316); ctx.stroke();

    // ── Stats section label ──
    ctx.fillStyle = gradA;
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('BATTLE STATS', 40, 340);

    // ── Stats grid ──
    var stats = [
      { label:'HP',  val:(pet.current_hp||pet.base_hp||30)+'/'+( pet.max_hp||pet.base_hp||30), icon:'❤️', x:80,  y:390 },
      { label:'ATK', val:pet.base_attack||5,  icon:'⚔️', x:220, y:390 },
      { label:'DEF', val:pet.base_defense||3, icon:'🛡️', x:360, y:390 },
      { label:'SPD', val:pet.base_speed||4,   icon:'💨', x:500, y:390 }
    ];
    stats.forEach(function(s) {
      ctx.fillStyle = '#f4f0ff';
      ctx.fillRect(s.x - 56, s.y - 30, 112, 50);
      ctx.fillStyle = '#333';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(s.icon, s.x, s.y - 10);
      ctx.font = '12px Arial';
      ctx.fillStyle = '#666';
      ctx.fillText(s.label, s.x, s.y + 4);
      ctx.font = 'bold 15px Arial';
      ctx.fillStyle = '#1a1a2e';
      ctx.fillText(String(s.val), s.x, s.y + 20);
    });

    // ── HP progress bar ──
    ctx.fillStyle = '#eee';
    ctx.fillRect(40, 420, W - 80, 12);
    var hpBarColor = hpPct > 0.6 ? '#4ade80' : hpPct > 0.3 ? '#fbbf24' : '#ff6b6b';
    ctx.fillStyle = hpBarColor;
    ctx.fillRect(40, 420, (W - 80) * hpPct, 12);
    ctx.fillStyle = '#888';
    ctx.font = '10px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(hpPct * 100) + '% HP', W - 40, 418);

    // ── Battle record ──
    ctx.fillStyle = '#555';
    ctx.font = '13px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('⚔️ ' + battlesWon + 'W  /  ' + totalBattle + ' Battles  •  ' + winRate + '% Win Rate', 40, 456);

    // ── Equipment row ──
    ctx.fillStyle = gradA;
    ctx.font = 'bold 13px Arial';
    ctx.fillText('EQUIPMENT', 40, 480);
    ctx.fillStyle = '#444';
    ctx.font = '13px Arial';
    var weaponText = weapon && weapon.equipment ? '⚔️ ' + weapon.equipment.name : '⚔️ None';
    var armorText  = armor  && armor.equipment  ? '🛡️ ' + armor.equipment.name  : '🛡️ None';
    ctx.fillText(weaponText + '   ' + armorText, 40, 498);

    // ── Divider ──
    ctx.strokeStyle = '#e0d5ff';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(40, 514); ctx.lineTo(W - 40, 514); ctx.stroke();

    // ── Scrapbook memory ──
    if (memory) {
      ctx.fillStyle = '#fdf6ff';
      ctx.fillRect(40, 522, W - 80, 52);
      ctx.strokeStyle = '#d4b8ff';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(40, 522, W - 80, 52);
      ctx.fillStyle = '#7a5ca0';
      ctx.font = 'italic 13px Arial';
      ctx.textAlign = 'center';
      var memText = memory.length > 72 ? memory.substring(0, 69) + '…' : memory;
      ctx.fillText('💭 ' + memText, W/2, 553);
    }

    // ── Backstory ──
    var backstory = petBackstories && petBackstories[petType] ? petBackstories[petType] : '';
    if (backstory) {
      var bsY = memory ? 596 : 534;
      ctx.fillStyle = '#888';
      ctx.font = 'italic 12px Arial';
      ctx.textAlign = 'center';
      var bsText = backstory.length > 80 ? backstory.substring(0, 77) + '…' : backstory;
      ctx.fillText(bsText, W/2, bsY);
    }

    // ── Divider before footer ──
    ctx.strokeStyle = '#e0d5ff';
    ctx.lineWidth = 1;
    var footerY = 660;
    ctx.beginPath(); ctx.moveTo(40, footerY); ctx.lineTo(W - 40, footerY); ctx.stroke();

    // ── Owner + date ──
    ctx.fillStyle = '#aaa';
    ctx.font = '13px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('👤 ' + (owner.username || 'Trainer'), 40, footerY + 22);
    ctx.textAlign = 'right';
    ctx.fillText('📅 ' + new Date().toLocaleDateString(), W - 40, footerY + 22);

    // ── Branding footer ──
    var ftGrad = ctx.createLinearGradient(24, footerY + 36, W - 24, H - 24);
    ftGrad.addColorStop(0, gradA + 'dd');
    ftGrad.addColorStop(1, gradB + 'dd');
    ctx.fillStyle = ftGrad;
    ctx.fillRect(24, footerY + 36, W - 48, H - (footerY + 36) - 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🐾 PawketPetsVT', W/2, footerY + 64);
    ctx.font = '11px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('pawketpetsvt.com', W/2, footerY + 82);

    // ── Build share text with variant ──
    var variantLabel = variantDef ? variantDef.name + ' ' : '';
    var shareTagline = 'I just raised my ' + variantLabel + petName + ' to Level ' + petLevel + '! 🐾 #PawketPets #VTuber';

    // ── Output ──
    canvas.toBlob(function(blob) {
      var url = URL.createObjectURL(blob);
      var fileSlug = petName.replace(/[^a-zA-Z0-9]/g, '_');
      screenshot_showModal(url, fileSlug, pet, shareTagline);
    }, 'image/png');

  } catch (err) {
    console.error('Snapshot error:', err);
    showToast('Failed to generate snapshot: ' + err.message, 3000);
  } finally {
    if (snapBtn) { snapBtn.textContent = '📸'; snapBtn.disabled = false; }
  }
}

// ── Color helpers for screenshot gradients ──
function screenshot_darken(hex, amt) {
  try {
    var n = parseInt(hex.replace('#',''), 16);
    var r = Math.max(0, (n >> 16) - Math.round(255 * amt));
    var g = Math.max(0, ((n >> 8) & 0xff) - Math.round(255 * amt));
    var b = Math.max(0, (n & 0xff) - Math.round(255 * amt));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  } catch(e) { return hex; }
}
function screenshot_lighten(hex, amt) {
  try {
    var n = parseInt(hex.replace('#',''), 16);
    var r = Math.min(255, (n >> 16) + Math.round(255 * amt));
    var g = Math.min(255, ((n >> 8) & 0xff) + Math.round(255 * amt));
    var b = Math.min(255, (n & 0xff) + Math.round(255 * amt));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  } catch(e) { return hex; }
}


function screenshot_showModal(imageUrl, fileName, pet, shareTagline) {
  var existing = document.querySelector('.snapshot-modal-overlay');
  if (existing) existing.remove();

  // Track screenshot shares for badge milestones
  var shareKey = 'screenshots_shared_' + (currentUser ? currentUser.id : 'guest');
  var shareCount = parseInt(localStorage.getItem(shareKey) || '0') + 1;
  localStorage.setItem(shareKey, String(shareCount));
  // Award share badges
  if (shareCount === 1)  awardBadge('snapshot_moment').then(null, function(){});
  if (shareCount === 5)  awardBadge('social_butterfly').then(null, function(){});

  var petName = pet.nickname || pet.pet_type || 'pet';
  var tagline = shareTagline || ('Check out my pet ' + petName + ' on PawketPetsVT! 🐾 #PawketPets #VTuber');
  var shareText   = encodeURIComponent(tagline);
  var shareUrl    = encodeURIComponent('https://pawketpetsvt.com');
  var twitterUrl  = 'https://twitter.com/intent/tweet?text=' + shareText + '&url=' + shareUrl;
  var blueskyUrl  = 'https://bsky.app/intent/compose?text=' + encodeURIComponent(tagline + ' https://pawketpetsvt.com');

  var overlay = document.createElement('div');
  overlay.className = 'snapshot-modal-overlay modal-overlay-custom';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:10001;';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  overlay.innerHTML = `
    <div style="background:#1e1e2e;border-radius:20px;padding:28px;max-width:480px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.5);border:2px solid #9966ff;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h2 style="color:#e8d5ff;margin:0;font-size:1.3rem;">📸 Pet Snapshot Ready!</h2>
        <button onclick="this.closest('.snapshot-modal-overlay').remove()" style="background:rgba(255,255,255,0.1);border:none;color:#e8d5ff;font-size:1.2rem;cursor:pointer;border-radius:8px;padding:4px 10px;">✕</button>
      </div>

      <img src="${imageUrl}" style="width:100%;border-radius:14px;box-shadow:0 4px 20px rgba(0,0,0,0.4);margin-bottom:18px;display:block;">

      <div style="display:flex;flex-direction:column;gap:10px;">
        <a href="${imageUrl}" download="${fileName}_card.png"
           style="display:block;text-align:center;padding:13px;background:linear-gradient(135deg,#9966ff,#b589ff);color:white;border-radius:12px;font-weight:700;font-size:1rem;text-decoration:none;">
          💾 Download as PNG
        </a>

        <button onclick="screenshot_copyToClipboard('${imageUrl}', this)"
           style="padding:12px;background:#3a3a4e;color:#e8d5ff;border:2px solid #9966ff;border-radius:12px;font-weight:600;font-size:0.95rem;cursor:pointer;">
          📋 Copy to Clipboard
        </button>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <a href="${twitterUrl}" target="_blank"
             style="display:block;text-align:center;padding:11px;background:#1da1f2;color:white;border-radius:12px;font-weight:600;font-size:0.9rem;text-decoration:none;">
            🐦 Share on X/Twitter
          </a>
          <a href="${blueskyUrl}" target="_blank"
             style="display:block;text-align:center;padding:11px;background:#0085ff;color:white;border-radius:12px;font-weight:600;font-size:0.9rem;text-decoration:none;">
            🦋 Share on Bluesky
          </a>
        </div>
      </div>

      <p style="color:#888;font-size:0.8rem;text-align:center;margin-top:14px;margin-bottom:0;">
        Tip: Download first, then attach the image when sharing on social media!
      </p>
    </div>
  `;

  document.body.appendChild(overlay);
}

async function screenshot_copyToClipboard(imageUrl, btn) {
  try {
    var response = await fetch(imageUrl);
    var blob = await response.blob();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    btn.textContent = '✅ Copied!';
    setTimeout(function() { btn.textContent = '📋 Copy to Clipboard'; }, 2000);
  } catch (err) {
    // Fallback: open image in new tab for manual save
    window.open(imageUrl, '_blank');
    btn.textContent = '🔗 Opened in new tab';
    setTimeout(function() { btn.textContent = '📋 Copy to Clipboard'; }, 2000);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. PAWKETPASS NAVBAR BADGE
// (This used to be a full second PawketPass system — its own state object,
// modal, and XP-granting call — but it called a Postgres RPC, grant_pass_xp,
// that doesn't exist (the real one is add_pass_xp), so it never actually ran.
// The live Pass system is addPassXP() / showPassModal() / passProgress
// earlier in this file. The only piece of this block that was actually
// reachable was pass_updateNavbar, wired in below via a wrapper around the
// real loadPassProgress() — kept as-is since it's live and working.)
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// 10. INITIALIZE PASS UI (Call after loadPassProgress)
// ═══════════════════════════════════════════════════════════════════════════

// ── pass_updateNavbar: update the navbar Pass button with level + unclaimed count
function pass_updateNavbar() {
  var passBtn = document.getElementById('pass-button');
  if (!passBtn || !passProgress) return;

  var level = passProgress.level || 1;
  var claimed = passProgress.claimedRewards || passProgress.claimed_rewards || [];
  var unclaimedCount = 0;
  for (var i = 1; i <= level; i++) {
    if (claimed.indexOf(i) === -1) unclaimedCount++;
  }

  passBtn.style.display = 'flex';
  var levelDisplay = document.getElementById('pass-level-display');
  if (levelDisplay) levelDisplay.textContent = level;

  // Show unclaimed badge
  var existingBadge = passBtn.querySelector('.pass-unclaimed-badge');
  if (existingBadge) existingBadge.remove();
  if (unclaimedCount > 0) {
    var badge = document.createElement('span');
    badge.className = 'pass-unclaimed-badge';
    badge.textContent = unclaimedCount;
    badge.style.cssText = 'background:#f59e0b;color:white;border-radius:50%;padding:1px 6px;font-size:11px;margin-left:4px;font-weight:bold;';
    passBtn.appendChild(badge);
  }
}

// Wrap loadPassProgress to update UI after load
var originalLoadPassProgress = loadPassProgress;

loadPassProgress = async function() {
  await originalLoadPassProgress();
  pass_updateNavbar();
};

dbg('✅ PawketPass navbar badge wired to loadPassProgress');
// ═══════════════════════════════════════════════════════════════════════════
// CENTERED MODAL NOTIFICATION SYSTEM
// Completely standalone - does NOT modify any existing functions
// Add this to the VERY END of game.js
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// 1. INJECT CSS STYLES (Only once)
// ═══════════════════════════════════════════════════════════════════════════

(function injectModalStyles() {
  // Check if styles already injected
  if (document.getElementById('centered-modal-styles')) return;
  
  var style = document.createElement('style');
  style.id = 'centered-modal-styles';
  style.textContent = `
    /* Modal Overlay */
    .centered-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(4px);
      z-index: 100000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: modalOverlayFadeIn 0.3s ease-out;
    }
    
    @keyframes modalOverlayFadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    
    /* Modal Container */
    .centered-modal-container {
      background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
      max-width: 450px;
      width: 90%;
      padding: 0;
      position: relative;
      animation: modalPopIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      border: 2px solid rgba(102, 126, 234, 0.3);
    }
    
    @keyframes modalPopIn {
      0% {
        opacity: 0;
        transform: scale(0.7) translateY(-20px);
      }
      100% {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }
    
    /* Close Button */
    .centered-modal-close {
      position: absolute;
      top: 12px;
      right: 12px;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: #cbd5e1;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      z-index: 1;
    }
    
    .centered-modal-close:hover {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      transform: rotate(90deg);
    }
    
    /* Modal Header */
    .centered-modal-header {
      padding: 32px 24px 24px 24px;
      text-align: center;
      border-bottom: 2px solid rgba(102, 126, 234, 0.2);
    }
    
    .centered-modal-icon {
      font-size: 64px;
      margin-bottom: 16px;
      display: inline-block;
      animation: modalIconBounce 1s ease-in-out infinite;
    }
    
    @keyframes modalIconBounce {
      0%, 100% {
        transform: translateY(0) scale(1);
      }
      50% {
        transform: translateY(-10px) scale(1.1);
      }
    }
    
    .centered-modal-title {
      font-size: 24px;
      font-weight: bold;
      color: #667eea;
      margin: 0;
      line-height: 1.3;
    }
    
    /* Modal Body */
    .centered-modal-body {
      padding: 24px;
      text-align: center;
    }
    
    .centered-modal-message {
      font-size: 16px;
      color: #e2e8f0;
      line-height: 1.6;
      margin: 0;
    }
    
    /* Modal Footer */
    .centered-modal-footer {
      padding: 20px 24px 24px 24px;
      text-align: center;
    }
    
    .centered-modal-button {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 14px 32px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      min-width: 140px;
    }
    
    .centered-modal-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(102, 126, 234, 0.6);
    }
    
    .centered-modal-button:active {
      transform: translateY(0);
    }
    
    /* Fade Out Animations */
    .centered-modal-overlay.closing {
      animation: modalOverlayFadeOut 0.2s ease-out forwards;
    }
    
    @keyframes modalOverlayFadeOut {
      from {
        opacity: 1;
      }
      to {
        opacity: 0;
      }
    }
    
    .centered-modal-container.closing {
      animation: modalPopOut 0.2s ease-out forwards;
    }
    
    @keyframes modalPopOut {
      from {
        opacity: 1;
        transform: scale(1);
      }
      to {
        opacity: 0;
        transform: scale(0.9);
      }
    }
    
    /* Mobile Responsive */
    @media (max-width: 480px) {
      .centered-modal-container {
        width: 95%;
        max-width: 95%;
      }
      
      .centered-modal-icon {
        font-size: 48px;
      }
      
      .centered-modal-title {
        font-size: 20px;
      }
      
      .centered-modal-message {
        font-size: 14px;
      }
      
      .centered-modal-button {
        width: 100%;
        padding: 12px 24px;
      }
    }
    
    /* Accessibility */
    .centered-modal-overlay:focus {
      outline: none;
    }
    
    .centered-modal-button:focus,
    .centered-modal-close:focus {
      outline: 3px solid rgba(102, 126, 234, 0.5);
      outline-offset: 2px;
    }
    
    /* Prevent body scroll when modal is open */
    body.modal-open {
      overflow: hidden;
    }
  `;
  
  document.head.appendChild(style);
})();

// ═══════════════════════════════════════════════════════════════════════════
// 2. MAIN FUNCTION - showCenteredModal
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Show a centered modal notification
 * @param {string} title - Modal title
 * @param {string} message - Modal message
 * @param {string} icon - Emoji or text icon (default: 🎉)
 * @param {function} onConfirm - Optional callback when modal closes
 * @returns {Promise} Resolves when modal is closed
 */

// ═══════════════════════════════════════════════════════════════════════════
// 3. HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get random button text for variety
 */

// ═══════════════════════════════════════════════════════════════════════════
// 4. CONVENIENCE WRAPPERS (Optional)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Show success modal
 */

/**
 * Show celebration modal
 */

/**
 * Show achievement modal
 */

/**
 * Show reward modal
 */

/**
 * Show level up modal
 */

/**
 * Show rare drop modal
 */

dbg('✅ Centered modal notification system loaded');

// ═══════════════════════════════════════════════════════════════════════════
// FRIENDSHIP GIFTING SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

var giftSystem = {
  DAILY_SEND_LIMIT:    5,
  DAILY_RECV_LIMIT:    10,
  FRIENDSHIP_DAYS_MIN: 1,
  ACCOUNT_AGE_DAYS:    14,
  EXPIRY_DAYS:         7,

  // Items that cannot be gifted (economy protection)
  BLOCKED_ITEM_TYPES: ['skin_key', 'pass_key', 'premium'],

  // Check all anti-abuse rules before allowing a gift
  canSendGift: async function(toUserId) {
    if (!currentUser) return { ok: false, reason: 'Not logged in' };
    if (toUserId === currentUser.id) return { ok: false, reason: "You can't gift yourself!" };

    // Account age check (14 days)
    var { data: me } = await supabaseClient.from('players').select('created_at').eq('id', currentUser.id).single();
    if (me) {
      var ageDays = (Date.now() - new Date(me.created_at).getTime()) / 86400000;
      if (ageDays < this.ACCOUNT_AGE_DAYS) {
        return { ok: false, reason: 'Your account must be at least ' + this.ACCOUNT_AGE_DAYS + ' days old to send gifts.' };
      }
    }

    // Friendship duration check (7 days)
    var { data: friendship } = await supabaseClient
      .from('friendships')
      .select('created_at, status')
      .or('and(requester_id.eq.' + currentUser.id + ',addressee_id.eq.' + toUserId + '),and(requester_id.eq.' + toUserId + ',addressee_id.eq.' + currentUser.id + ')')
      .eq('status', 'accepted')
      .maybeSingle();

    if (!friendship) return { ok: false, reason: 'You can only gift friends.' };
    var friendDays = (Date.now() - new Date(friendship.created_at).getTime()) / 86400000;
    if (friendDays < this.FRIENDSHIP_DAYS_MIN) {
      var daysLeft = Math.ceil(this.FRIENDSHIP_DAYS_MIN - friendDays);
      return { ok: false, reason: 'You must be friends for at least ' + this.FRIENDSHIP_DAYS_MIN + ' day first. (' + daysLeft + ' day' + (daysLeft !== 1 ? 's' : '') + ' to go)' };
    }

    // Daily send limit
    var today = new Date().toISOString().split('T')[0];
    var { count: sentToday } = await supabaseClient
      .from('gifts')
      .select('id', { count: 'exact', head: true })
      .eq('from_user_id', currentUser.id)
      .gte('sent_at', today);
    if (sentToday >= this.DAILY_SEND_LIMIT) {
      return { ok: false, reason: 'You\'ve sent ' + this.DAILY_SEND_LIMIT + ' gifts today. Come back tomorrow!' };
    }

    // Daily receive limit for recipient
    var { count: recvToday } = await supabaseClient
      .from('gifts')
      .select('id', { count: 'exact', head: true })
      .eq('to_user_id', toUserId)
      .gte('sent_at', today);
    if (recvToday >= this.DAILY_RECV_LIMIT) {
      return { ok: false, reason: "This player's gift inbox is full today. Try tomorrow!" };
    }

    return { ok: true, giftsSentToday: sentToday };
  }
};

async function gift_showSendModal(toUserId, toUsername) {
  var check = await giftSystem.canSendGift(toUserId);
  var giftsLeft = giftSystem.DAILY_SEND_LIMIT - (check.giftsSentToday || 0);

  if (!check.ok) {
    showToast('🚫 ' + check.reason, 4000);
    return;
  }

  // Load giftable inventory (exclude blocked item types)
  var { data: inventory } = await supabaseClient
    .from('user_inventory')
    .select('id, quantity, items(id, name, item_type, image_url)')
    .eq('user_id', currentUser.id)
    .gt('quantity', 0);

  var giftable = (inventory || []).filter(function(inv) {
    if (!inv.items) return false;
    return giftSystem.BLOCKED_ITEM_TYPES.indexOf(inv.items.item_type) === -1;
  });

  var modal = makeModal();
  var itemOptions = giftable.length > 0
    ? giftable.map(function(inv) {
        return '<option value="' + inv.items.id + '" data-max="' + inv.quantity + '">' +
          escapeHtml(inv.items.name) + ' (x' + inv.quantity + ')</option>';
      }).join('')
    : '<option value="">No items available</option>';

  modal.innerHTML =
    '<h2 style="text-align:center;margin-bottom:20px;">🎁 Send a Gift</h2>' +
    '<p style="text-align:center;color:var(--text-light);margin-bottom:20px;">To: <strong>' + escapeHtml(toUsername) + '</strong></p>' +

    '<label style="font-weight:600;display:block;margin-bottom:6px;">Select item:</label>' +
    '<select id="gift-item-select" style="width:100%;padding:10px;border-radius:10px;border:2px solid var(--border);margin-bottom:16px;font-size:1rem;">' +
    itemOptions +
    '</select>' +

    '<label style="font-weight:600;display:block;margin-bottom:6px;">Quantity:</label>' +
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">' +
    '<button onclick="gift_changeQty(-1)" style="width:36px;height:36px;border-radius:50%;border:2px solid var(--border);background:none;font-size:1.2rem;cursor:pointer;">−</button>' +
    '<span id="gift-qty-display" style="font-size:1.3rem;font-weight:700;min-width:30px;text-align:center;">1</span>' +
    '<button onclick="gift_changeQty(1)" style="width:36px;height:36px;border-radius:50%;border:2px solid var(--border);background:none;font-size:1.2rem;cursor:pointer;">+</button>' +
    '</div>' +

    '<label style="font-weight:600;display:block;margin-bottom:6px;">Message (optional):</label>' +
    '<textarea id="gift-message" maxlength="140" placeholder="Say something nice! 💕" style="width:100%;padding:10px;border-radius:10px;border:2px solid var(--border);resize:none;height:70px;font-size:0.9rem;box-sizing:border-box;"></textarea>' +

    '<div style="background:rgba(153,102,255,0.08);border-radius:10px;padding:10px 14px;margin:14px 0;font-size:0.85rem;color:var(--text-light);">' +
    '📦 Gifts remaining today: <strong>' + giftsLeft + '</strong> &nbsp;|&nbsp; Expires in: <strong>' + giftSystem.EXPIRY_DAYS + ' days</strong>' +
    '</div>' +

    '<div style="display:flex;gap:10px;margin-top:8px;">' +
    '<button onclick="closeModal()" class="btn btn-outline" style="flex:1;">Cancel</button>' +
    '<button onclick="gift_sendGift(\'' + toUserId + '\',\'' + escapeHtml(toUsername) + '\')" class="btn btn-primary" style="flex:2;" id="gift-send-btn">' +
    '🎁 Send Gift</button>' +
    '</div>';

  // Store qty state
  modal._giftQty = 1;
  openModal(modal);
}

function gift_changeQty(delta) {
  var select = document.getElementById('gift-item-select');
  var display = document.getElementById('gift-qty-display');
  if (!select || !display) return;
  var selectedOpt = select.options[select.selectedIndex];
  var max = selectedOpt ? parseInt(selectedOpt.dataset.max || 1) : 1;
  var modal = select.closest('.modal-content-custom');
  modal._giftQty = Math.max(1, Math.min(max, (modal._giftQty || 1) + delta));
  display.textContent = modal._giftQty;
}

async function gift_sendGift(toUserId, toUsername) {
  var select  = document.getElementById('gift-item-select');
  var message = document.getElementById('gift-message');
  var btn     = document.getElementById('gift-send-btn');
  if (!select || !select.value) { showToast('Please select an item', 2000); return; }

  var modal  = select.closest('.modal-content-custom');
  var qty    = modal._giftQty || 1;
  var itemId = select.value;

  btn.textContent = 'Sending…'; btn.disabled = true;

  try {
    // Final abuse check
    var check = await giftSystem.canSendGift(toUserId);
    if (!check.ok) { showToast('🚫 ' + check.reason, 4000); return; }

    // Insert gift record
    var { error } = await supabaseClient.from('gifts').insert({
      from_user_id: currentUser.id,
      to_user_id:   toUserId,
      item_id:      itemId,
      quantity:     qty,
      message:      message ? message.value.trim().substring(0, 140) : '',
      expires_at:   new Date(Date.now() + giftSystem.EXPIRY_DAYS * 86400000).toISOString()
    });
    if (error) throw error;

    // Deduct from sender's inventory
    var { data: invRow } = await supabaseClient
      .from('user_inventory')
      .select('id, quantity')
      .eq('user_id', currentUser.id)
      .eq('item_id', itemId)
      .maybeSingle();
    if (invRow) {
      if (invRow.quantity <= qty) {
        await supabaseClient.from('user_inventory').delete().eq('id', invRow.id);
      } else {
        await supabaseClient.from('user_inventory').update({ quantity: invRow.quantity - qty }).eq('id', invRow.id);
      }
    }

    // Friendship points for sender
    await gift_addFriendshipPoints(currentUser.id, 5);

    // Notification to recipient
    await createNotification(
      toUserId, 'gift_received', '🎁 You got a gift!',
      (currentUsername || 'Someone') + ' sent you a gift! Open your inbox to claim it.',
      '/gifts', currentUser.id
    );

    // Bingo + Pass XP
    updateBingoProgress('send_gift', 1);
    await addPassXP(10, 'gift_sent');

    // Check first-gift badge
    var { count: totalSent } = await supabaseClient
      .from('gifts').select('id', { count: 'exact', head: true }).eq('from_user_id', currentUser.id);
    if (totalSent === 1)  await awardBadge('secret_santa');
    if (totalSent >= 10)  await awardBadge('generous_soul');
    if (totalSent >= 50)  await awardBadge('philanthropist');

    closeModal();
    showToast('🎁 Gift sent to ' + toUsername + '!', 3000);

  } catch(err) {
    console.error('Gift send error:', err);
    showToast('Error sending gift: ' + err.message, 4000);
  } finally {
    if (btn) { btn.textContent = '🎁 Send Gift'; btn.disabled = false; }
  }
}

async function gift_loadInbox() {
  var container = document.getElementById('gift-inbox-list');
  if (!container || !currentUser) return;
  container.innerHTML = '<div class="spinner"></div>';

  // Expire old gifts client-side display
  var { data: gifts } = await supabaseClient
    .from('gifts')
    .select('*, items(name, image_url)')
    .eq('to_user_id', currentUser.id)
    .eq('status', 'pending')
    .order('sent_at', { ascending: false });

  if (!gifts || gifts.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:30px;text-align:center;"><div style="font-size:3rem;">📭</div><p>No pending gifts!</p></div>';
    return;
  }

  // Get sender names
  var senderIds = [...new Set(gifts.map(function(g) { return g.from_user_id; }))];
  var { data: senders } = await supabaseClient.from('players').select('id, username').in('id', senderIds);
  var senderMap = {};
  (senders || []).forEach(function(s) { senderMap[s.id] = s.username; });

  var html = '';
  gifts.forEach(function(gift) {
    var senderName = senderMap[gift.from_user_id] || 'Someone';
    var itemName   = gift.items ? gift.items.name : (gift.cosmetic_id || 'Gift');
    var expiresIn  = Math.max(0, Math.ceil((new Date(gift.expires_at) - Date.now()) / 86400000));

    html += '<div class="gift-inbox-item" id="gift-' + gift.id + '">' +
      '<div class="gift-inbox-icon">🎁</div>' +
      '<div class="gift-inbox-body">' +
      '  <div class="gift-inbox-from"><strong>' + escapeHtml(senderName) + '</strong> sent you: <strong>' + escapeHtml(itemName) + ' x' + gift.quantity + '</strong></div>' +
      (gift.message ? '  <div class="gift-inbox-msg">"' + escapeHtml(gift.message) + '"</div>' : '') +
      '  <div class="gift-inbox-meta">Expires in ' + expiresIn + ' day' + (expiresIn !== 1 ? 's' : '') + '</div>' +
      '</div>' +
      '<div class="gift-inbox-actions">' +
      '  <button class="btn btn-primary btn-sm" onclick="gift_accept(\'' + gift.id + '\',\'' + gift.from_user_id + '\')">Accept</button>' +
      '  <button class="btn btn-outline btn-sm" onclick="gift_decline(\'' + gift.id + '\')">Decline</button>' +
      '</div>' +
      '</div>';
  });
  container.innerHTML = html;

  // Update badge
  var badge = document.getElementById('gift-inbox-badge');
  if (badge) { badge.textContent = gifts.length; badge.style.display = gifts.length > 0 ? 'inline' : 'none'; }
}

async function gift_accept(giftId, fromUserId) {
  try {
    var { data: gift } = await supabaseClient.from('gifts').select('*').eq('id', giftId).maybeSingle();
    if (!gift) { showToast('Gift not found', 2000); return; }

    // Add item to recipient inventory
    if (gift.item_id) {
      var { data: existing } = await supabaseClient
        .from('user_inventory').select('id, quantity').eq('user_id', currentUser.id).eq('item_id', gift.item_id).maybeSingle();
      if (existing) {
        await supabaseClient.from('user_inventory').update({ quantity: existing.quantity + gift.quantity }).eq('id', existing.id);
      } else {
        await supabaseClient.from('user_inventory').insert({ user_id: currentUser.id, item_id: gift.item_id, quantity: gift.quantity });
      }
    } else if (gift.cosmetic_type && gift.cosmetic_id) {
      await phase1_unlockCosmetic(gift.cosmetic_type, gift.cosmetic_id);
    }

    // Mark as accepted
    await supabaseClient.from('gifts').update({ status: 'accepted', claimed_at: new Date().toISOString() }).eq('id', giftId);

    // Friendship points for recipient
    await gift_addFriendshipPoints(currentUser.id, 10);

    document.getElementById('gift-' + giftId)?.remove();
    showToast('🎁 Gift accepted!', 2500);
  } catch(err) {
    console.error('Gift accept error:', err);
    showToast('Error accepting gift', 3000);
  }
}

async function gift_decline(giftId) {
  await supabaseClient.from('gifts').update({ status: 'declined' }).eq('id', giftId);
  document.getElementById('gift-' + giftId)?.remove();
  showToast('Gift declined.', 2000);
}

async function gift_addFriendshipPoints(userId, points) {
  try {
    var { data: existing } = await supabaseClient.from('friendship_points').select('*').eq('user_id', userId).maybeSingle();
    if (existing) {
      await supabaseClient.from('friendship_points').update({
        total_points: existing.total_points + points,
        gifts_sent:   userId === currentUser.id ? existing.gifts_sent + 1 : existing.gifts_sent,
        gifts_received: userId !== currentUser.id ? existing.gifts_received + 1 : existing.gifts_received
      }).eq('user_id', userId);
    } else {
      await supabaseClient.from('friendship_points').insert({
        user_id: userId, total_points: points,
        gifts_sent: userId === currentUser.id ? 1 : 0,
        gifts_received: userId !== currentUser.id ? 1 : 0
      });
    }
  } catch(e) { dbg('Friendship points update failed:', e); }
}

function gift_showInboxModal() {
  var modal = makeModal();
  modal.innerHTML =
    '<h2 style="text-align:center;margin-bottom:20px;">📬 Gift Inbox</h2>' +
    '<div id="gift-inbox-list"></div>' +
    '<button onclick="closeModal()" class="btn btn-outline" style="width:100%;margin-top:16px;">Close</button>';
  openModal(modal);
  gift_loadInbox();
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMUNITY VOTING / POLLS SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

var pollSystem = {
  activePolls: [],
  userVotes: {},   // pollId -> optionIndex

  load: async function() {
    try {
      // Load active polls
      var { data: polls } = await supabaseClient
        .from('polls')
        .select('*')
        .eq('is_active', true)
        .gte('ends_at', new Date().toISOString())
        .order('ends_at', { ascending: true });

      this.activePolls = polls || [];

      // Load this user's votes on active polls
      if (this.activePolls.length > 0) {
        var pollIds = this.activePolls.map(function(p) { return p.id; });
        var { data: votes } = await supabaseClient
          .from('poll_votes')
          .select('poll_id, option_index')
          .eq('user_id', currentUser.id)
          .in('poll_id', pollIds);

        var self = this;
        (votes || []).forEach(function(v) { self.userVotes[v.poll_id] = v.option_index; });
      }

      // Render widget on home page
      this.renderWidget();
    } catch(err) {
      console.error('Poll load error:', err);
    }
  },

  renderWidget() {
    var mount = document.getElementById('polls-widget-mount');
    if (!mount) return;
    if (this.activePolls.length === 0) { mount.style.display = 'none'; return; }
    mount.style.display = 'block';

    var html = '<div class="polls-widget">' +
      '<div class="polls-widget-header">🗳️ Community Polls <span class="polls-badge">' + this.activePolls.length + '</span></div>';

    var self = this;
    this.activePolls.slice(0, 2).forEach(function(poll) {
      var userVote = self.userVotes[poll.id];
      var hasVoted = userVote !== undefined;
      var options  = poll.options || [];
      var total    = poll.total_votes || 1;
      var timeLeft = polls_timeRemaining(poll.ends_at);

      html += '<div class="poll-widget-item">' +
        '<div class="poll-widget-question">' + escapeHtml(poll.question) + '</div>' +
        '<div class="poll-widget-timer">⏰ ' + timeLeft + '</div>';

      options.forEach(function(opt, idx) {
        var isChosen = hasVoted && userVote === idx;
        html += '<div class="poll-option' + (isChosen ? ' poll-option-chosen' : '') + '" ' +
          (hasVoted ? '' : 'onclick="pollSystem.castVote(\'' + poll.id + '\',' + idx + ')"') + '>' +
          '<div class="poll-option-label">' + escapeHtml(opt.icon || '') + ' ' + escapeHtml(opt.text) + (isChosen ? ' ✓ Your vote' : '') + '</div>' +
          '</div>';
      });

      html += '<button class="btn btn-outline btn-sm" style="width:100%;margin-top:8px;" onclick="pollSystem.openModal(\'' + poll.id + '\')">' +
        (hasVoted ? '📊 View Results' : '🗳️ Vote Now') + '</button>' +
        '</div>';
    });

    if (this.activePolls.length > 2) {
      html += '<button class="btn btn-outline btn-sm" style="width:100%;margin-top:8px;" onclick="pollSystem.openAllModal()">View all ' + this.activePolls.length + ' polls →</button>';
    }

    html += '</div>';
    mount.innerHTML = html;
  },

  castVote: async function(pollId, optionIndex) {
    if (this.userVotes[pollId] !== undefined) { showToast('You already voted on this poll!', 2000); return; }

    // Rate limit — prevent double-click spam
    if (!canPerformAction('poll_vote_' + pollId, 5000)) { showToast('Please wait before voting again!', 2000); return; }

    try {
      // Check the database directly for an existing vote — the in-memory userVotes
      // flag above resets on every page reload, so without this check a player
      // could simply refresh and vote again repeatedly for free PP each time.
      var { data: existingVote } = await supabaseClient
        .from('poll_votes')
        .select('id')
        .eq('poll_id', pollId)
        .eq('user_id', currentUser.id)
        .maybeSingle();
      if (existingVote) {
        this.userVotes[pollId] = -1; // mark as voted locally so the button disables too
        showToast('You already voted on this poll!', 2000);
        return;
      }

      // Double-check poll is still active
      var { data: poll } = await supabaseClient.from('polls').select('is_active, ends_at').eq('id', pollId).single();
      if (poll && (!poll.is_active || new Date(poll.ends_at) < new Date())) {
        showToast('This poll has ended!', 2000); return;
      }
      var { error } = await supabaseClient.from('poll_votes').insert({
        poll_id: pollId, user_id: currentUser.id, option_index: optionIndex
      });
      if (error) {
        // Unique constraint violation = already voted (race condition caught at DB level)
        if (error.code === '23505') {
          this.userVotes[pollId] = -1;
          showToast('You already voted on this poll!', 2000);
          return;
        }
        throw error;
      }

      // Increment total_votes
      await supabaseClient.rpc('increment_poll_votes', { poll_id_param: pollId }).then(null, function() {
        // If RPC doesn't exist, just update locally
      });

      this.userVotes[pollId] = optionIndex;

      // Rewards
      await awardPP(25, 'poll_vote');
      updateBingoProgress('vote_poll', 1);
      await addPassXP(5, 'poll_vote');

      // Badge milestones
      var { count: totalVotes } = await supabaseClient
        .from('poll_votes').select('id', { count: 'exact', head: true }).eq('user_id', currentUser.id);
      if (totalVotes === 5)  await awardBadge('badge_team_player');
      if (totalVotes === 3)  await awardBadge('poll_champion');
      if (totalVotes === 15) await awardBadge('poll_champion');
      if (totalVotes === 25) await awardBadge('community_leader');

      showToast('✅ Vote counted! +25 PP', 3000);
      this.renderWidget();

      // Re-render open modal if any
      var openModal = document.getElementById('poll-detail-modal');
      if (openModal) this.openModal(pollId);

    } catch(err) {
      if (err.code === '23505') { showToast('Already voted!', 2000); }
      else { console.error('Vote error:', err); showToast('Error casting vote', 3000); }
    }
  },

  openModal(pollId) {
    var poll = this.activePolls.find(function(p) { return p.id === pollId; });
    if (!poll) return;

    var existing = document.querySelector('.modal-overlay-custom');
    if (existing) closeModal();

    var modal = makeModal();
    modal.id  = 'poll-detail-modal';
    var userVote = this.userVotes[pollId];
    var hasVoted = userVote !== undefined;
    var total    = poll.total_votes || 0;
    var timeLeft = polls_timeRemaining(poll.ends_at);

    var html = '<h2 style="text-align:center;margin-bottom:6px;">🗳️ ' + escapeHtml(poll.question) + '</h2>' +
      '<p style="text-align:center;color:var(--text-light);margin-bottom:16px;">⏰ ' + timeLeft + ' remaining &nbsp;|&nbsp; ' + total + ' votes</p>';

    var self = this;
    poll.options.forEach(function(opt, idx) {
      var isChosen = hasVoted && userVote === idx;
      // Use real vote_counts if available, otherwise don't show fake percentages
      var optVotes = (poll.vote_counts && poll.vote_counts[idx]) || 0;
      var pct = (hasVoted && total > 0) ? Math.round((optVotes / total) * 100) : 0;

      html += '<div class="poll-option-card' + (isChosen ? ' poll-option-card-chosen' : '') + '">' +
        '<div class="poll-option-card-header">' +
        '  <span class="poll-option-card-icon">' + escapeHtml(opt.icon || '📌') + '</span>' +
        '  <strong>' + escapeHtml(opt.text) + '</strong>' +
        (isChosen ? ' <span style="color:#5dde7a;font-size:0.85rem;">✓ Your vote</span>' : '') +
        '</div>' +
        '<div class="poll-option-card-desc">' + escapeHtml(opt.description || '') + '</div>' +
        (hasVoted
          ? '<div class="poll-option-bar" style="margin-top:8px;"><div class="poll-option-fill" style="width:' + pct + '%;"></div><span class="poll-option-pct">' + pct + '%</span></div>'
          : '<button class="btn btn-primary btn-sm" style="margin-top:10px;width:100%;" onclick="pollSystem.castVote(\'' + pollId + '\',' + idx + ');closeModal();">Vote for this</button>'
        ) +
        '</div>';
    });

    html += '<button onclick="closeModal()" class="btn btn-outline" style="width:100%;margin-top:16px;">Close</button>';
    modal.innerHTML = html;
    openModal(modal);
  },

  openAllModal() {
    var modal = makeModal();
    var self = this;
    var html = '<h2 style="text-align:center;margin-bottom:20px;">🗳️ All Active Polls</h2>';
    this.activePolls.forEach(function(poll) {
      var hasVoted = self.userVotes[poll.id] !== undefined;
      html += '<div style="background:rgba(153,102,255,0.08);border-radius:12px;padding:14px;margin-bottom:12px;cursor:pointer;" onclick="pollSystem.openModal(\'' + poll.id + '\')">' +
        '<strong>' + escapeHtml(poll.question) + '</strong>' +
        '<div style="color:var(--text-light);font-size:0.85rem;margin-top:4px;">' + polls_timeRemaining(poll.ends_at) + ' left &nbsp;' +
        (hasVoted ? '✅ Voted' : '🗳️ Not voted') + '</div>' +
        '</div>';
    });
    html += '<button onclick="closeModal()" class="btn btn-outline" style="width:100%;margin-top:8px;">Close</button>';
    modal.innerHTML = html;
    openModal(modal);
  }
};

function polls_timeRemaining(endsAt) {
  var ms = new Date(endsAt) - Date.now();
  if (ms <= 0) return 'Ended';
  var h = Math.floor(ms / 3600000);
  var d = Math.floor(h / 24);
  if (d > 0) return d + 'd ' + (h % 24) + 'h';
  return h + 'h ' + Math.floor((ms % 3600000) / 60000) + 'm';
}

async function polls_loadPastResults(mountId) {
  var mount = document.getElementById(mountId);
  if (!mount) return;
  mount.innerHTML = '<div class="spinner"></div>';

  try {
    var { data: results } = await supabaseClient
      .from('poll_results')
      .select('*, polls(question, poll_type, options)')
      .order('applied_at', { ascending: false })
      .limit(10);

    if (!results || results.length === 0) {
      mount.innerHTML = '<div class="empty-state" style="padding:30px;text-align:center;"><p>No poll results yet!</p></div>';
      return;
    }

    var html = '';
    results.forEach(function(r) {
      if (!r.polls) return;
      var opts = r.polls.options || [];
      var winner = opts[r.winning_option];
      html += '<div style="border:2px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;">' +
        '<div style="font-weight:700;margin-bottom:6px;">🏆 ' + escapeHtml(r.polls.question) + '</div>' +
        '<div style="color:var(--text-light);font-size:0.9rem;">Winner: ' + (winner ? escapeHtml(winner.icon + ' ' + winner.text) : '-') + '</div>' +
        '<div style="color:var(--text-light);font-size:0.8rem;margin-top:4px;">' + r.total_votes + ' total votes</div>' +
        '</div>';
    });
    mount.innerHTML = html;
  } catch(err) {
    mount.innerHTML = '<p style="color:var(--text-light);text-align:center;">Could not load results.</p>';
  }
}

dbg('✅ Gifting & Polls systems loaded');

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN PANEL — Poll Management (Embertail only)
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// GRAND PRIX ADMIN PANEL
// Only accessible to admin UUID — checked at start of every function
// ═══════════════════════════════════════════════════════════════════════════







// Helper — re-render modal without reopening it

// Disable a button during async admin action, re-enable on finish

















// ── Quick Reference Help Modal ────────────────────────────────────────────
function showHelpModal() {
  var modal = makeModal();
  modal.innerHTML =
    '<div style="max-width:480px;padding:4px;">' +
      '<h2 style="text-align:center;margin-bottom:18px;color:var(--purple-dark);">📚 Quick Guide</h2>' +
      '<div style="margin-bottom:16px;">' +
        '<div style="font-weight:700;color:var(--purple-dark);margin-bottom:6px;font-size:0.9rem;">🐾 Pet Stats</div>' +
        '<div style="font-size:0.82rem;color:var(--text-light);line-height:1.7;">' +
          '<b>❤️ HP</b>: Health Points. Carries between battles! Heal with potions or wait for regen.<br>' +
          '<b>⚔️ Attack</b>: Battle damage dealt. Increase via level-ups &amp; weapons.<br>' +
          '<b>🛡️ Defense</b>: Damage reduction. Increase via level-ups &amp; armor.<br>' +
          '<b>💨 Speed</b>: Turn order in battles &amp; race performance. Level up or equip speed gear.' +
        '</div>' +
      '</div>' +
      '<div style="margin-bottom:16px;">' +
        '<div style="font-weight:700;color:var(--purple-dark);margin-bottom:6px;font-size:0.9rem;">🪙 PawketPoints (PP)</div>' +
        '<div style="font-size:0.82rem;color:var(--text-light);line-height:1.7;">' +
          'Earn from: Daily login · Battles · Racing · Bingo · PawketPass rewards · Expeditions · Guilds<br>' +
          'Spend on: Shop items · Equipment · Furniture · Guild creation' +
        '</div>' +
      '</div>' +
      '<div style="margin-bottom:16px;">' +
        '<div style="font-weight:700;color:var(--purple-dark);margin-bottom:6px;font-size:0.9rem;">🎫 PawketPass XP Sources</div>' +
        '<div style="font-size:0.82rem;color:var(--text-light);line-height:1.7;">' +
          '🍖 Feed pets: 2 XP (cap 20/day)<br>' +
          '🎾 Play with pets: 2 XP (cap 20/day)<br>' +
          '⚔️ Battles: 15 XP win / 5 XP loss (cap 50/day)<br>' +
          '📅 Daily login: 10 XP<br>' +
          '🎯 Bingo square: 15 XP · Line: 50 XP · Blackout: 200 XP<br>' +
          '🌲 Expeditions: 10 XP · 🏁 Race: 5 XP · 🏆 Grand Prix: up to 250 XP' +
        '</div>' +
      '</div>' +
      '<div style="margin-bottom:16px;">' +
        '<div style="font-weight:700;color:var(--purple-dark);margin-bottom:6px;font-size:0.9rem;">🏁 Racing</div>' +
        '<div style="font-size:0.82rem;color:var(--text-light);line-height:1.7;">' +
          '1st: Win 1.5×–3× your bet · 2nd: Get bet back · 3rd: Half bet back · 4th: Lose bet<br>' +
          'Higher Speed stat = better odds and bigger wins!' +
        '</div>' +
      '</div>' +
      '<div style="margin-bottom:16px;">' +
        '<div style="font-weight:700;color:var(--purple-dark);margin-bottom:6px;font-size:0.9rem;">🎯 Daily Bingo</div>' +
        '<div style="font-size:0.82rem;color:var(--text-light);line-height:1.7;">' +
          'Complete tasks to mark squares. Each gives PP + Pass XP.<br>' +
          'Complete a full line for bonus rewards! Blackout for BIG rewards.<br>' +
          'Resets daily at midnight.' +
        '</div>' +
      '</div>' +
      '<div style="margin-bottom:18px;">' +
        '<div style="font-weight:700;color:var(--purple-dark);margin-bottom:6px;font-size:0.9rem;">💡 Tips</div>' +
        '<div style="font-size:0.82rem;color:var(--text-light);line-height:1.7;">' +
          'Hover any stat (ATK/DEF/SPD/HP) on a pet card for more info.<br>' +
          'Furniture bought once works in ALL pet rooms and gives daily happiness.<br>' +
          'Guilds unlock Dungeons, treasury perks, and XP boosts for the whole team.' +
        '</div>' +
      '</div>' +
      '<button class="btn btn-primary" onclick="closeModal()" style="width:100%;">Got it! 👍</button>' +
    '</div>';
  openModal(modal);
}

// ── Player Report System ────────────────────────────────────────────────────
function showReportModal() {
  if (!currentUser) { showToast('Please log in to submit a report.', 2500); return; }

  var modal = makeModal();
  modal.innerHTML =
    '<div style="max-width:420px;">' +
      '<h3 style="color:var(--purple-dark);margin-bottom:14px;">🚩 Report an Issue</h3>' +
      '<label style="font-size:0.82rem;font-weight:700;display:block;margin-bottom:4px;">What\'s this about?</label>' +
      '<select id="report-type-select" style="width:100%;padding:8px 12px;border-radius:8px;border:2px solid var(--border);font-size:0.9rem;margin-bottom:14px;box-sizing:border-box;">' +
        '<option value="bug">🐛 Bug / glitch</option>' +
        '<option value="bad_username">🚫 Inappropriate username</option>' +
        '<option value="bad_language">🤬 Bad language / harassment</option>' +
        '<option value="cheating">⚖️ Cheating / exploiting</option>' +
        '<option value="guestbook">📖 Guestbook / chat message</option>' +
        '<option value="other">❓ Something else</option>' +
      '</select>' +
      '<label style="font-size:0.82rem;font-weight:700;display:block;margin-bottom:4px;">Who or what is this about? (optional)</label>' +
      '<input id="report-target-input" type="text" maxlength="50" placeholder="Username, guild name, etc." style="width:100%;padding:8px 12px;border-radius:8px;border:2px solid var(--border);font-size:0.9rem;margin-bottom:14px;box-sizing:border-box;">' +
      '<label style="font-size:0.82rem;font-weight:700;display:block;margin-bottom:4px;">Describe the issue</label>' +
      '<textarea id="report-desc-textarea" maxlength="1000" placeholder="Please give as much detail as you can..." style="width:100%;padding:8px 12px;border-radius:8px;border:2px solid var(--border);font-size:0.85rem;resize:vertical;min-height:90px;margin-bottom:14px;box-sizing:border-box;"></textarea>' +
      '<div style="display:flex;gap:10px;">' +
        '<button class="btn btn-outline" onclick="closeModal()" style="flex:1;">Cancel</button>' +
        '<button class="btn btn-primary" onclick="submitReport()" style="flex:1;">Submit Report</button>' +
      '</div>' +
    '</div>';
  openModal(modal);
}

async function submitReport() {
  if (!currentUser) return;
  if (!canPerformAction('submit_report', 5000)) { showToast('Please wait before submitting another report.', 2500); return; }

  var type = (document.getElementById('report-type-select') || {}).value || 'other';
  var target = (document.getElementById('report-target-input') || {}).value.trim();
  var desc = (document.getElementById('report-desc-textarea') || {}).value.trim();

  if (!desc) { showToast('Please describe the issue before submitting.', 2500); return; }
  if (desc.length > 1000) { showToast('Description is too long (max 1000 characters).', 2500); return; }

  try {
    var { error } = await supabaseClient.from('player_reports').insert({
      reporter_id: currentUser.id,
      report_type: type,
      target_text: target || null,
      description: desc,
      status: 'open'
    });
    if (error) throw error;

    closeModal();
    showToast('🚩 Report submitted. Thank you for helping keep PawketPets safe!', 4000);
  } catch(err) {
    showToast('Could not submit report: ' + err.message, 3500);
  }
}

// ── Admin: Report Inbox ─────────────────────────────────────────────────────


// Throttle cursor trail to max 30fps (every 33ms) to reduce DOM churn
(function() {
  var _lastTrail = 0;
  var _origMousemove = null;
  document.addEventListener('DOMContentLoaded', function() {
    // Patch any existing mousemove listeners on the trail system
    // by rate-limiting sparkle creation
    if (window.createCursorParticle) {
      var orig = window.createCursorParticle;
      window.createCursorParticle = function(x, y) {
        var now = Date.now();
        if (now - _lastTrail < 33) return; // ~30fps
        _lastTrail = now;
        orig(x, y);
      };
    }
  });
})();

// ── DAILY SHOP ROTATION ───────────────────────────────────────────────────────
function getDailyShopSeed() {
  var d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth()+1) * 100 + d.getDate();
}
async function renderDailyShop(allItems) {
  var mount = document.getElementById('daily-shop-mount');
  if (!mount || !allItems || !allItems.length) return;
  // Seed daily selection - same 4 items for everyone each day
  var seed = getDailyShopSeed();
  var items = allItems.slice().sort(function(a,b){ return ((a.id * seed) % 997) - ((b.id * seed) % 997); }).slice(0,4);
  var html = '<div style="font-weight:700;color:var(--purple-dark);margin-bottom:8px">⭐ Today\'s Deals</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">';
  items.forEach(function(item) {
    html += '<div style="padding:10px;border-radius:12px;background:rgba(153,102,255,0.08);text-align:center">';
    html += '<div style="font-size:1.5rem">' + (item.emoji || '🎁') + '</div>';
    html += '<div style="font-weight:700;font-size:0.85rem">' + escapeHtml(item.name) + '</div>';
    html += '<div style="color:var(--text-light);font-size:0.75rem;margin:2px 0">' + (item.hunger_effect ? '+' + item.hunger_effect + ' hunger' : '') + '</div>';
    html += '<button class="btn btn-sm btn-primary" style="margin-top:6px;width:100%" onclick="buyItem(' + item.id + ',\' + escapeHtml(item.name) + \')">' + (item.cost || 50) + ' PP</button>';
    html += '</div>';
  });
  html += '</div>';
  mount.innerHTML = html;
}

/* ═══════════════════════════════════════════════════════════════════════
   DUPLICATED ARG/SPOOKY BLOCK — REMOVED 2026-08-24
   A ~164-line region (streamer landing vars, the SPOOKY_* name/UI/spinner
   glitch config, the corruption-visuals state and currentEquipmentFilter,
   together with their safeSetInterval blocks) existed here as an exact
   second copy of code earlier in this file — every one of its 164 lines had
   an identical earlier counterpart. Because the intervals were registered
   twice, every spooky glitch effect ran on two independent timers, firing at
   roughly double its configured rate. The earlier copy is the survivor.
   ═══════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════
   BATTLE DATA — MIGRATED (Phase 7, 2026-08-24)

   PASSIVE_EFFECTS, STATUS_EFFECTS, PET_SKILLS, ZONE_CONFIG and
   ENEMY_BEHAVIORS now live in webapp/src/data/battleData.js.

   Historical note worth keeping: each of the first three was declared TWICE
   at top level here. Being top-level vars executed in file order, the second
   copy won — and for PET_SKILLS the two were not the same data. The winner was
   an older 127-line set covering only EIGHT pets: no "cypurr" key at all, and
   Kelta's spelled "kleat". Since SKILL_KEY_MAP resolved both "kleat" and
   "kelta" to "kelta", and "cypurr"/"cypurractive" to "cypurr", that meant
   PET_SKILLS['kelta'] and PET_SKILLS['cypurr'] were both undefined: on the
   live site those two pets had NO battle skills at all, and the other seven
   exposed 3 instead of ~17. The migrated data is the full expanded set.
   ═══════════════════════════════════════════════════════════════════════ */
// ═══════════════════════════════════════════════════════════════════════════
// COOKING SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

// All ingredient definitions (id -> display info)

// Recipe definitions — sorted list of ingredient IDs is the canonical key

// Ingredient drop chances — used by battle/fishing/expedition hooks
var COOKING_DROP_TABLES = {
  battle: {
    // species keyword -> { ingredient_id: chance (0-1) }
    mammal: { meat_chunk: 0.20, small_bone: 0.15 },
    bird:   { feather: 0.25, small_bone: 0.10 },
    spider: { small_bone: 0.10 },
    frog:   { small_bone: 0.10 },
    bear:   { tough_meat: 0.18, small_bone: 0.12 },
    wolf:   { meat_chunk: 0.22, tough_meat: 0.10, small_bone: 0.12 },
    fox:    { meat_chunk: 0.18, small_bone: 0.12 },
    boar:   { tough_meat: 0.20, meat_chunk: 0.15, small_bone: 0.10 },
    deer:   { tough_meat: 0.15, meat_chunk: 0.15, small_bone: 0.12 },
    bunny:  { meat_chunk: 0.18, small_bone: 0.15 },
    rabbit: { meat_chunk: 0.18, small_bone: 0.15 },
    rat:    { meat_chunk: 0.15, small_bone: 0.12 },
    mouse:  { meat_chunk: 0.12, small_bone: 0.12 },
    // Deepwoods/ruins-only
    mushroom: { mushroom: 0.25 },
    ghost:    { glitch_residue: 0.04 },
    spirit:   { glitch_residue: 0.04 },
    shadow:   { glitch_residue: 0.05 },
    void:     { glitch_residue: 0.06 }
  },
  // Always checked on any battle (rare)
  battleAny: { glitch_residue: 0.03 },
  fishing: {
    salmon: { fresh_salmon: 1.0 },
    cod:    { fresh_cod: 1.0 },
    any:    { shellfish: 0.10, seaweed: 0.15 }
  },
  expedition: {
    outskirts: { wild_herb: 0.25 },
    glade:     { wild_herb: 0.25, forest_berry: 0.20 },
    deepwoods: { wild_herb: 0.15, forest_berry: 0.12, honey: 0.15 },
    ruins:     { wild_herb: 0.10, rare_spice: 0.10, honey: 0.08, crystal_shard: 0.05 }
  }
};

// State

// ── Tab switching ───────────────────────────────────────────────────────────

// ── showTab hook ────────────────────────────────────────────────────────────

// ── Load ingredients from Supabase ─────────────────────────────────────────

// ── Render ingredient grid (craft tab) ────────────────────────────────────

// ── Add ingredient to next free slot ──────────────────────────────────────

// ── Remove ingredient from slot ────────────────────────────────────────────

// ── Render the 4 crafting slots ───────────────────────────────────────────

// ── Check if current slots match a recipe ────────────────────────────────

// ── Cook! ─────────────────────────────────────────────────────────────────

// ── Discovery flash animation ─────────────────────────────────────────────

// ── Recipe book tab ──────────────────────────────────────────────────────

// ── Quick-craft from recipe book ─────────────────────────────────────────

// ── All ingredients info tab ─────────────────────────────────────────────

// ── Award an ingredient to the current user (called from drop hooks) ──────
async function cooking_awardIngredient(ingredientId, quantity) {
  if (!currentUser || !COOKING_INGREDIENTS[ingredientId]) return;
  quantity = quantity || 1;
  _cookingIngredients[ingredientId] = (_cookingIngredients[ingredientId] || 0) + quantity;
  try {
    var current = 0;
    var { data: existing } = await supabaseClient
      .from('user_ingredients')
      .select('quantity')
      .eq('user_id', currentUser.id)
      .eq('ingredient_id', ingredientId)
      .maybeSingle();
    current = existing ? (existing.quantity || 0) : 0;
    await supabaseClient.from('user_ingredients').upsert({
      user_id: currentUser.id,
      ingredient_id: ingredientId,
      quantity: current + quantity,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,ingredient_id' });
  } catch(e) { dbg('[Cooking] Award ingredient error:', e); }
}

// ── Battle ingredient drop hook ───────────────────────────────────────────
// Was called from the battle engine on victory (now in webapp/).
async function cooking_rollBattleDrop(enemyStats) {
  if (!currentUser) return;
  var species = (enemyStats && enemyStats.species ? enemyStats.species.toLowerCase().split(' ')[0] : '');
  var zone = enemyStats && enemyStats.forest_zone ? enemyStats.forest_zone : 'outskirts';
  var drops = [];

  // Species-specific drops
  var speciesTable = COOKING_DROP_TABLES.battle[species] || null;
  // Fallback: try mammal table for unrecognized mammals
  if (!speciesTable) {
    var MAMMAL_SPECIES = ['dog','cat','raccoon','pig','squirrel'];
    if (MAMMAL_SPECIES.indexOf(species) !== -1) speciesTable = COOKING_DROP_TABLES.battle.mammal;
  }
  if (speciesTable) {
    for (var ingId in speciesTable) {
      if (Math.random() < speciesTable[ingId]) drops.push(ingId);
    }
  }

  // Deepwoods/ruins: extra mushroom chance
  if ((zone === 'deepwoods' || zone === 'ruins') && Math.random() < 0.10) {
    drops.push('mushroom');
  }

  // Always: tiny glitch_residue chance
  if (Math.random() < COOKING_DROP_TABLES.battleAny.glitch_residue) {
    drops.push('glitch_residue');
  }

  // Deduplicate
  var unique = drops.filter(function(d, i) { return drops.indexOf(d) === i; });
  if (!unique.length) return;

  // Award each
  for (var di = 0; di < unique.length; di++) {
    await cooking_awardIngredient(unique[di], 1);
  }

  // Toast
  var names = unique.map(function(id) {
    var def = COOKING_INGREDIENTS[id];
    return def ? def.emoji + ' ' + def.name : id;
  });
  showToast('Ingredient drop: ' + names.join(', ') + '!', 3000);
}

// ── Fishing ingredient drop hook ──────────────────────────────────────────
// Pass fish name (lowercase) to get salmon/cod ingredients; also rolls any-cast drops
async function cooking_rollFishingDrop(fishName) {
  if (!currentUser) return;
  var drops = [];
  var fname = (fishName || '').toLowerCase();

  // Fish-specific ingredient
  if (fname.indexOf('salmon') !== -1) drops.push('fresh_salmon');
  else if (fname.indexOf('cod') !== -1) drops.push('fresh_cod');

  // Any-cast drops (shellfish, seaweed)
  for (var id in COOKING_DROP_TABLES.fishing.any) {
    if (Math.random() < COOKING_DROP_TABLES.fishing.any[id]) drops.push(id);
  }

  var unique = drops.filter(function(d, i) { return drops.indexOf(d) === i; });
  if (!unique.length) return;

  for (var di = 0; di < unique.length; di++) {
    await cooking_awardIngredient(unique[di], 1);
  }

  var names = unique.map(function(id) {
    var def = COOKING_INGREDIENTS[id];
    return def ? def.emoji + ' ' + def.name : id;
  });
  showToast('Ingredient found: ' + names.join(', ') + '!', 2500);
}

// ── Expedition ingredient drop hook ─────────────────────────────────────
// Call with zone key after expedition claim
async function cooking_rollExpeditionDrop(zone) {
  if (!currentUser) return;
  var table = COOKING_DROP_TABLES.expedition[zone] || COOKING_DROP_TABLES.expedition.outskirts;
  var drops = [];

  for (var ingId in table) {
    if (Math.random() < table[ingId]) drops.push(ingId);
  }

  if (!drops.length) return;

  for (var di = 0; di < drops.length; di++) {
    await cooking_awardIngredient(drops[di], 1);
  }

  var names = drops.map(function(id) {
    var def = COOKING_INGREDIENTS[id];
    return def ? def.emoji + ' ' + def.name : id;
  });
  showToast('Expedition ingredient: ' + names.join(', ') + '!', 2500);
}

// ── Init (called from showTab) ────────────────────────────────────────────


// ═══════════════════════════════════════════════════════════════════════════
// COMBAT BUFF SYSTEM (from secret cooking recipes)
// ═══════════════════════════════════════════════════════════════════════════

// Load combat buffs for a pet from DB
// Stored in pet_combat_buffs table: { user_id, pet_id, recipe_id, stat, amount, battles_left }
async function combatBuff_load(petId) {
  if (!currentUser || !petId) return {};
  try {
    var { data: rows } = await supabaseClient
      .from('pet_combat_buffs')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('pet_id', petId)
      .gt('battles_left', 0);
    var buffs = {};
    (rows || []).forEach(function(r) {
      buffs[r.recipe_id] = r;
    });
    return buffs;
  } catch(e) {
    dbg('[CombatBuff] load error:', e);
    return {};
  }
}

// Apply a combat buff food to a pet (called from inventory/feeding)
async function combatBuff_apply(petId, recipeId) {
  if (!currentUser || !petId || !recipeId) return;
  var recipe = COOKING_RECIPES.find(function(r) { return r.id === recipeId; });
  if (!recipe || !recipe.combatBuff) return;

  var buff = recipe.combatBuff;
  var battles = buff.battles || 5;
  var rows = [];

  if (buff.stat === 'multi') {
    (buff.bonuses || []).forEach(function(b) {
      rows.push({ user_id: currentUser.id, pet_id: petId, recipe_id: recipeId + '_' + b.stat, stat: b.stat, amount: b.amount, battles_left: battles });
    });
  } else {
    rows.push({ user_id: currentUser.id, pet_id: petId, recipe_id: recipeId, stat: buff.stat, amount: buff.amount, battles_left: battles });
  }

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    // Upsert: if buff already active, add battles_left
    var { data: existing } = await supabaseClient
      .from('pet_combat_buffs')
      .select('id, battles_left')
      .eq('user_id', currentUser.id)
      .eq('pet_id', petId)
      .eq('recipe_id', row.recipe_id)
      .maybeSingle();
    if (existing) {
      await supabaseClient.from('pet_combat_buffs').update({ battles_left: existing.battles_left + battles }).eq('id', existing.id);
    } else {
      await supabaseClient.from('pet_combat_buffs').insert(row);
    }
  }
  showToast(recipe.emoji + ' ' + recipe.name + ' buff applied to your pet! (' + battles + ' battles)', 3500);
}

// Decrement buff battles_left after a battle ends (win or lose)
async function combatBuff_tick(petId) {
  if (!currentUser || !petId) return;
  try {
    var { data: rows } = await supabaseClient
      .from('pet_combat_buffs')
      .select('id, battles_left')
      .eq('user_id', currentUser.id)
      .eq('pet_id', petId)
      .gt('battles_left', 0);
    for (var i = 0; i < (rows || []).length; i++) {
      var r = rows[i];
      var newLeft = r.battles_left - 1;
      if (newLeft <= 0) {
        await supabaseClient.from('pet_combat_buffs').delete().eq('id', r.id);
      } else {
        await supabaseClient.from('pet_combat_buffs').update({ battles_left: newLeft }).eq('id', r.id);
      }
    }
  } catch(e) { dbg('[CombatBuff] tick error:', e); }
}

// Render combat buff pills in battle UI
async function combatBuff_renderPills(petId, containerEl) {
  if (!containerEl) return;
  var buffs = await combatBuff_load(petId);
  var keys = Object.keys(buffs);
  if (!keys.length) { containerEl.innerHTML = ''; return; }

  var STAT_LABELS = { attack: 'ATK', defense: 'DEF', speed: 'SPD', luck: 'Luck', spirit: 'Spirit' };
  containerEl.innerHTML = keys.map(function(k) {
    var b = buffs[k];
    var label = STAT_LABELS[b.stat] || b.stat;
    return '<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(93,222,122,0.15);border:1px solid rgba(93,222,122,0.4);border-radius:20px;padding:2px 8px;font-size:0.65rem;color:#5dde7a;font-weight:700;margin:2px;">+' +
      b.amount + ' ' + label + ' <span style="opacity:0.7;">(' + b.battles_left + ' battles)</span></span>';
  }).join('');
}

// Apply active buffs to playerStats before battle
async function combatBuff_applyToStats(petId, stats) {
  var buffs = await combatBuff_load(petId);
  Object.keys(buffs).forEach(function(k) {
    var b = buffs[k];
    if (b.stat && b.amount && stats[b.stat] !== undefined) {
      stats[b.stat] = (stats[b.stat] || 0) + b.amount;
    }
  });
  return stats;
}

// ═══════════════════════════════════════════════════════════════════════════
// GUILD HOUSING SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

// Furniture catalog — all furniture available to buy, keyed by furniture_key

// Cached placed furniture for this guild

// How many slots does a guild get at this level?

// Load placed furniture from DB

// Get active furniture buffs for a guild member (called on battle init & stat display)

// Render the full guild housing page

// Open furniture shop modal for a specific slot

// Place furniture into a slot

// Remove furniture from a slot (officers only)

// Donate PP to earn guild tokens

'use strict';

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

var audioCache = {};
var lastSoundTime = 0;
var soundCooldown = 300; // Minimum 300ms between sounds to avoid spam

function playBattleSound(soundKey, volume, forceBoss) {
  // Rate limiting - prevent sound spam
  var now = Date.now();
  if (!forceBoss && now - lastSoundTime < soundCooldown) {
    return; // Skip this sound
  }
  lastSoundTime = now;
  
  // Check if file exists by trying to load it
  if (!audioCache[soundKey]) {
    var audio = new Audio(battleSounds[soundKey]);
    audio.volume = volume || 0.35;
    audio.onerror = function() {
      console.log('Sound file not found:', battleSounds[soundKey]);
      audioCache[soundKey] = null; // Mark as missing
    };
    audioCache[soundKey] = audio;
  }
  
  if (audioCache[soundKey] === null) {
    return; // File doesn't exist, skip silently
  }
  
  // Clone to allow overlapping sounds
  var sound = audioCache[soundKey].cloneNode();
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

var supabaseClient;
if (typeof supabase !== 'undefined') {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    }
  });
} else {
  // Wait for Supabase library to load
  console.log('Waiting for Supabase library...');
  var checkSupabase = setInterval(function() {
    if (typeof supabase !== 'undefined') {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          flowType: 'pkce'
        }
      });
      console.log('Supabase initialized!');
      clearInterval(checkSupabase);
    }
  }, 50);
}

// ── CONFIG ──────────────────────────────
var TWITCH_CLIENT_ID = 'PASTE_YOUR_TWITCH_CLIENT_ID_HERE';
var TWITCH_REDIRECT_URI = 'https://pawketpetsvt.github.io/';
var STREAMER_IDS = {
  embertail: 'EMBERTAIL_TWITCH_USER_ID',
  pyxshuul:  'PYXSHUUL_TWITCH_USER_ID'
};

// ── GLOBALS ──────────────────────────────
var currentUser = null;
var currentPoints = 0;
var tabsLoaded = {};

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

function showToast(msg, type) {
  showPixelToast(msg, type || 'info');
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

function makeEl(tag, attrs, text) {
  var e = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(function(k){ e.setAttribute(k, attrs[k]); });
  if (text !== undefined) e.textContent = text;
  return e;
}

function updateAllPoints(pts) {
  currentPoints = pts;
  var str = pts + ' PP';
  ['adopt-points','mypets-points','shop-points','games-points','redeem-points'].forEach(function(id){
    var e = el(id); if (e) e.textContent = str;
  });
  el('nav-points').innerHTML = '&#129689; ' + pts + ' PP';
  
  // Update sidebar points
  var sidebarPoints = document.getElementById('sidebar-points');
  if (sidebarPoints) sidebarPoints.textContent = pts.toLocaleString() + ' PP';
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
function showTab(tab) {
  document.querySelectorAll('#app-content .page-section').forEach(function(s){ s.classList.remove('active'); });
  var sec = el('section-' + tab); if (sec) sec.classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(function(b){ b.classList.remove('active'); });
  var btn = el('tab-btn-' + tab); if (btn) btn.classList.add('active');
  
  // Update sidebar buttons
  document.querySelectorAll('.sidebar-nav-btn').forEach(function(b){ b.classList.remove('active'); });
  var sidebarBtn = el('sidebar-btn-' + tab); 
  if (sidebarBtn) sidebarBtn.classList.add('active');
  
  // Special cases: some tabs need to initialize every time
  if (tab === 'leaderboard') {
    initLeaderboardTab();
  } else if (tab === 'myprofile') {
    loadMyProfile();
  } else if (tab === 'profile' && window.currentProfileUsername) {
    loadProfile(window.currentProfileUsername);
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


function loadTab(tab) {
  if (tab === 'adopt') loadAdopt();
  else if (tab === 'mypets') loadMyPets();
  else if (tab === 'shop') { loadShop(); loadInventory(); }
  else if (tab === 'minigames') initMinigames();
  else if (tab === 'battle') loadBattlePets();
  else if (tab === 'news') loadNews();
  else if (tab === 'twitch') initTwitchTab();
  else if (tab === 'redeem') { loadRedeemHistory(); }
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
  // Check if user is coming from password reset email
  var hash = window.location.hash;
  if (hash && hash.includes('type=recovery')) {
    console.log('Password recovery mode detected');
    el('auth-gate').style.display = 'none';
    el('reset-password-gate').style.display = 'block';
    el('app-content').style.display = 'none';
    return; // Stop here, show reset form
  }
  
  var session = await requireLogin();
  if (session) {
    await showApp(session.user);
  } else {
    showAuth();
  }
  supabaseClient.auth.onAuthStateChange(function(event, session) {
    if (event === 'PASSWORD_RECOVERY') {
      // Show reset password form
      el('auth-gate').style.display = 'none';
      el('reset-password-gate').style.display = 'block';
      el('app-content').style.display = 'none';
    } else if (event === 'SIGNED_IN' && session) {
      showApp(session.user);
    } else if (event === 'SIGNED_OUT') {
      showAuth();
    }
  });
}

async function showApp(user) {
  currentUser = user;
  el('auth-gate').style.display = 'none';
  el('app-content').style.display = 'block';
  el('nav-logout').style.display = 'inline-block';
  el('nav-profile').style.display = 'inline-block';

  var pr = await supabaseClient.from('players').select('username, pawketpoints').eq('id', user.id).single();
  if (pr.data) {
    el('nav-user').textContent = '\u2B50 ' + pr.data.username;
    updateAllPoints(pr.data.pawketpoints);
  }
  
  // Update sidebar stats
  await updateSidebarStats();
  
  // Load user's badges
  await loadUserBadges();
  
  // Award welcome badge if new user
  await awardBadge('welcome');
  
  // Load daily tip on home page (delay to ensure DOM is ready)
  setTimeout(loadDailyTip, 100);

  var bonus = await checkDailyBonus(user.id);
  if (bonus.awarded) {
    el('bonus-amount').textContent = bonus.amount + ' PP';
    el('bonus-modal').classList.add('show');
    updateAllPoints(bonus.newTotal);
  }

  el('home-cta').innerHTML = '<button class="btn btn-primary btn-lg" onclick="showTab(\'mypets\')" style="margin-right:10px;">My Pets</button><button class="btn btn-secondary btn-lg" onclick="showTab(\'adopt\')">Adopt More</button>';

  // Restore last active tab from URL hash
  var hash = window.location.hash;
  console.log('Page loaded with hash:', hash);
  if (hash && hash.startsWith('#tab-')) {
    var savedTab = hash.replace('#tab-', '');
    console.log('Restoring saved tab:', savedTab);
    showTab(savedTab);
  } else if (hash && hash.includes('access_token')) {
    // Twitch auth callback
    showTab('twitch');
  } else {
    // Only show home if no tab is currently active and no hash
    var currentTab = document.querySelector('.page-content.active');
    if (!currentTab) {
      console.log('No saved tab, showing home');
      showTab('home');
    }
  }
  
  // Load sidebar news widget
  loadSidebarNews();
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
}

// ══════════════════════════════════════════════════════════════════════════
// UPDATE SIDEBAR STATS
// ══════════════════════════════════════════════════════════════════════════

async function updateSidebarStats() {
  if (!currentUser) return;
  
  try {
    // Get player data
    var { data: player, error: playerError } = await supabaseClient
      .from('players')
      .select('pawketpoints')
      .eq('id', currentUser.id)
      .single();
    
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
    
    // Calculate day streak
    var streak = calculateDayStreak();
    
    // Update sidebar display
    var petCountEl = document.getElementById('sidebar-pet-count');
    var pointsEl = document.getElementById('sidebar-points');
    var itemsEl = document.getElementById('sidebar-items');
    var streakEl = document.getElementById('sidebar-streak');
    
    if (petCountEl) petCountEl.textContent = (pets ? pets.length : 0);
    if (pointsEl) pointsEl.textContent = (player ? player.pawketpoints.toLocaleString() : 0) + ' PP';
    if (itemsEl) itemsEl.textContent = totalItems;
    if (streakEl) streakEl.textContent = streak;
    
  } catch (err) {
    console.error('Error updating sidebar stats:', err);
  }
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
    await awardPP(reward.pp);
    showPixelToast(reward.message, 'success');
  }
}

async function handleLogout() { await logoutUser(); }
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

async function requireLogin() {
  // Check if user is already logged in
  var { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.error('Error checking session:', error);
    return null;
  }
  return data.session;
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
  if (!email || !password) { err.textContent = 'Please fill in all fields!'; err.classList.add('show'); return; }
  btn.textContent = 'Logging in...';
  btn.disabled = true;
  try {
    var result = await loginUser(email, password);
    suc.textContent = 'Logged in! Loading...';
    suc.classList.add('show');
    // Wait a moment for the auth state to update, then manually trigger app load
    setTimeout(async function() {
      if (result && result.user) {
        await showApp(result.user);
      }
    }, 500);
  } catch(e) {
    err.textContent = e.message || 'Login failed.';
    err.classList.add('show');
    btn.textContent = 'Login';
    btn.disabled = false;
  }
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
}

function makePetCard(pet) {
  var isPlaceholder = pet.name === '???';
  var isOwned = ownedPetIds.indexOf(pet.id) !== -1;
  var isFree = totalOwnedCount === 0;
  var price = isFree ? 0 : pet.price;
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
  card.appendChild(makeEl('div', {class:'pet-name'}, isPlaceholder ? '???' : pet.name));
  if (pet.vtuber_name && !isPlaceholder) card.appendChild(makeEl('div', {class:'pet-vtuber'}, pet.vtuber_name));
  card.appendChild(makeEl('div', {class:'pet-description'}, isPlaceholder ? 'A mystery pet...' : (pet.description || '')));

  if (!isPlaceholder) {
    var priceEl = makeEl('span', {class: price === 0 ? 'pet-price free' : 'pet-price'}, price === 0 ? 'FREE' : '\uD83E\uDE99 ' + pet.price + ' PP');
    card.appendChild(priceEl);
  }

  var btn = document.createElement('button');
  if (isPlaceholder) { btn.className='btn-locked'; btn.textContent='Coming Soon'; }
  else if (isOwned) { btn.className='btn-owned'; btn.textContent='Already Adopted!'; }
  else if (!canAfford) { btn.className='btn-locked'; btn.textContent='Need '+pet.price+' PP'; }
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
function closeSuccessModal() { el('success-modal').classList.remove('show'); tabsLoaded['adopt'] = false; loadAdopt(); }

async function confirmAdopt() {
  if (!selectedPet || !currentUser) return;
  var btn = el('confirm-adopt-btn');
  var nickname = el('nickname-input').value.trim() || selectedPet.name;
  btn.textContent='Adopting...'; btn.disabled=true;
  var res = await supabaseClient.from('user_pets').insert([{
    user_id: currentUser.id, 
    pet_id: selectedPet.id, 
    nickname: nickname,
    level: 1, 
    xp: 0, 
    hunger: 80,  // Start well-fed
    energy: 80,  // Start energized
    happiness: 80,  // Start happy
    max_hunger: 100, 
    max_energy: 100, 
    max_happiness: 100,
    // Battle stats - CRITICAL for new pets!
    base_hp: 60,  // Our new doubled starting HP
    max_hp: 60,
    current_hp: 60,  // Start at full HP
    base_attack: 5,
    base_defense: 3,
    base_speed: 4,
    total_battles: 0,
    battles_won: 0,
    last_fed: new Date().toISOString(),
    last_played: new Date().toISOString()
  }]);
  if (res.error) { showToast('Error: '+res.error.message); btn.textContent='Adopt!'; btn.disabled=false; return; }
  if (selectedPet.price > 0) {
    var np = currentPoints - selectedPet.price;
    await supabaseClient.from('players').update({pawketpoints:np}).eq('id',currentUser.id);
    updateAllPoints(np);
  }
  
  // Award first pet badge
  await awardBadge('first_pet');
  
  closeAdoptModal();
  el('success-message').textContent = nickname + ' has joined your collection!';
  el('success-modal').classList.add('show');
  ownedPetIds.push(selectedPet.id); totalOwnedCount++;
  tabsLoaded['mypets'] = false;
  btn.textContent='Adopt!'; btn.disabled=false;
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
  var res = await supabaseClient.from('user_pets').select('*, pets(name, image_file, vtuber_name, twitch_url)').eq('user_id',currentUser.id).order('adopted_at',{ascending:true});
  if (res.error) { container.textContent='Could not load pets.'; return; }
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
    // Use updated_at as the "last activity" timestamp for HP regen
    var currentHP = (pet.current_hp !== null && pet.current_hp !== undefined) ? pet.current_hp : (pet.base_hp || 25);
    var maxHP = pet.max_hp || pet.base_hp || 25;
    
    // Only regenerate if HP > 0 (don't auto-revive fainted pets!)
    var regenedHP = currentHP > 0 ? calculateHPRegen(currentHP, maxHP, pet.updated_at) : 0;
    
    console.log('🐾 Loading pet:', pet.nickname, 'DB HP:', pet.current_hp, 'Displayed HP:', regenedHP);
    
    petState[pet.id] = Object.assign({}, pet, {
      energy: decayedEnergy,
      hunger: decayedHunger,
      happiness: decayedHappiness,
      current_hp: regenedHP
    });
  });
  var grid = document.createElement('div');
  grid.className = 'mypets-grid';
  Object.values(petState).forEach(function(pet) { grid.appendChild(makeMyPetCard(pet)); });
  container.innerHTML = '';
  container.appendChild(grid);
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
  sel.appendChild(makeEl('option', {value:''}, '— Select an item —'));
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

async function useItem(petId) {
  var sel = el('sel-'+petId); 
  if (!sel || !sel.value) return;
  
  var idx = inventoryItems.findIndex(function(i){ return i.invId === sel.value; }); 
  if (idx === -1) return;
  
  var item = inventoryItems[idx]; 
  var pet = petState[petId]; 
  if (!pet) return;
  
  var btn = el('usebtn-'+petId); 
  btn.disabled = true; 
  btn.textContent = '...';
  
  var updates = {};
  
  console.log('=== USE ITEM DEBUG ===');
  console.log('Item:', item);
  console.log('Item effect:', item.effect);
  console.log('Item value:', item.value);
  console.log('Item effect_value:', item.effect_value);
  
  // Handle healing items (HP restoration)
  var healValue = item.value || item.effect_value || 0;
  console.log('Heal value calculated:', healValue);
  console.log('Is healing item?', item.effect === 'healing', healValue > 0);
  
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
    
    console.log('🩹 Healing - Current HP:', currentHP, 'Max HP:', maxHP, 'Heal amount:', healValue);
    
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
  var xpNext = pet.level * 120;
  var hPct = Math.round(pet.hunger/pet.max_hunger*100);
  var hapPct = Math.round(pet.happiness/pet.max_happiness*100);
  var ePct = Math.round(pet.energy/pet.max_energy*100);
  var xpPct = Math.min(pet.xp/xpNext*100, 100);
  var mood = getPetMood(pet.hunger, pet.energy, pet.happiness, pet.max_hunger, pet.max_energy, pet.max_happiness);
  var moodEmoji = mood.emoji;
  var achievements = getAchievements(pet);
  var lastSeen = getLastSeenText(pet.last_fed, pet.last_played);

  var card = makeEl('div', {class:'my-pet-card', id:'petcard-'+pet.id});

  // Habitat banner
  var habitat = makeEl('div', {class:'pet-habitat'});
  habitat.setAttribute('style', getHabitatStyle(info.vtuber_name));

  // Floating avatar with mood badge
  var avatarWrap = makeEl('div', {class:'pet-avatar-wrap'});
  var avatar = makeEl('div', {class:'pet-avatar'});
  if (info.image_file) {
    var img = makeEl('img', {src:'images/'+info.image_file, alt:pet.nickname});
    img.onerror = function(){ this.parentElement.innerHTML='&#128062;'; };
    avatar.appendChild(img);
  } else { avatar.innerHTML='&#128062;'; }
  var moodBadge = makeEl('div', {class:'mood-badge'});
  moodBadge.innerHTML = moodEmoji;
  avatarWrap.appendChild(avatar);
  avatarWrap.appendChild(moodBadge);
  habitat.appendChild(avatarWrap);
  card.appendChild(habitat);

  // Card body
  var body = makeEl('div', {class:'pet-card-body'});

  // Name and info
  var headerInfo = makeEl('div', {class:'pet-card-header-info'});
  
  // Add evolution stage emoji
  var evolutionStage = getEvolutionStage(pet.level);
  var evolutionEmoji = getEvolutionEmoji(evolutionStage);
  var stageName = evolutionStage.charAt(0).toUpperCase() + evolutionStage.slice(1);
  
  headerInfo.appendChild(makeEl('div', {class:'pet-card-nickname'}, evolutionEmoji + ' ' + pet.nickname + ' (' + stageName + ')'));
  var speciesEl = makeEl('div', {class:'pet-card-species'});
  if (info.vtuber_name) speciesEl.textContent = info.vtuber_name;
  if (info.twitch_url) {
    var tLink = makeEl('a', {href:info.twitch_url, target:'_blank'});
    tLink.style.cssText = 'font-size:0.72rem;background:#9146ff;color:white;padding:2px 7px;border-radius:10px;font-family:Fredoka One,cursive;text-decoration:none;margin-left:6px;';
    tLink.textContent = 'Watch Live';
    speciesEl.appendChild(tLink);
  }
  headerInfo.appendChild(speciesEl);
  headerInfo.appendChild(makeEl('div', {class:'pet-card-level', id:'lvl-'+pet.id}, 'Lv. '+pet.level+' | Max Stats: '+pet.max_hunger));
  body.appendChild(headerInfo);

  // Last interaction
  body.appendChild(makeEl('div', {class:'pet-last-seen'}, 'Last interaction: ' + lastSeen));

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

  // Battle Stats (if they exist)
  if (pet.base_hp || pet.base_attack || pet.base_defense || pet.base_speed) {
    var battleStats = makeEl('div', {class:'pet-battle-stats'});
    battleStats.style.cssText = 'display:flex;justify-content:space-around;padding:12px;margin:10px 0;background:rgba(176,106,255,0.1);border:2px solid var(--purple-light);border-radius:12px;';
    
    // HP with current/max display - FIX: Respect 0 HP!
    var currentHP = (pet.current_hp !== null && pet.current_hp !== undefined) ? pet.current_hp : (pet.base_hp || 30);
    var maxHP = pet.max_hp || pet.base_hp || 30;
    var hpPercent = Math.round((currentHP / maxHP) * 100);
    var hpColor = hpPercent > 50 ? '#5dde7a' : hpPercent > 25 ? '#ffaa00' : '#ff6b6b';
    
    var hpStat = makeEl('div', {class:'battle-stat-mini'});
    hpStat.innerHTML = '<div style="font-size:0.7rem;color:var(--text-light);text-transform:uppercase;">HP</div>' +
      '<div style="font-weight:bold;color:var(--purple);font-size:1.1rem;">' + currentHP + '/' + maxHP + '</div>' +
      '<div style="width:60px;height:4px;background:#e0e0e0;border-radius:2px;margin-top:4px;overflow:hidden;">' +
      '<div style="width:' + hpPercent + '%;height:100%;background:' + hpColor + ';transition:width 0.3s;"></div></div>';
    battleStats.appendChild(hpStat);
    
    var atkStat = makeEl('div', {class:'battle-stat-mini', id:'atk-stat-'+pet.id});
    atkStat.innerHTML = '<div style="font-size:0.7rem;color:var(--text-light);text-transform:uppercase;">ATK</div><div style="font-weight:bold;color:var(--purple);font-size:1.1rem;">' + (pet.base_attack || 5) + '</div>';
    battleStats.appendChild(atkStat);
    
    var defStat = makeEl('div', {class:'battle-stat-mini', id:'def-stat-'+pet.id});
    defStat.innerHTML = '<div style="font-size:0.7rem;color:var(--text-light);text-transform:uppercase;">DEF</div><div style="font-weight:bold;color:var(--purple);font-size:1.1rem;">' + (pet.base_defense || 3) + '</div>';
    battleStats.appendChild(defStat);
    
    var spdStat = makeEl('div', {class:'battle-stat-mini', id:'spd-stat-'+pet.id});
    spdStat.innerHTML = '<div style="font-size:0.7rem;color:var(--text-light);text-transform:uppercase;">SPD</div><div style="font-weight:bold;color:var(--purple);font-size:1.1rem;">' + (pet.base_speed || 4) + '</div>';
    battleStats.appendChild(spdStat);
    
    body.appendChild(battleStats);
    
    // Update stats with equipment bonuses (async)
    updatePetStatsDisplay(pet.id, pet.base_attack || 5, pet.base_defense || 3, pet.base_speed || 4);
  }

  // Equipped Items Display (NEW!)
  var equipSection = makeEl('div', {class:'equipped-items-section'});
  equipSection.style.cssText = 'margin:10px 0;padding:10px;background:rgba(93,222,122,0.1);border:2px solid #5dde7a;border-radius:12px;';
  
  var equipTitle = makeEl('div', {style:'font-weight:bold;color:var(--purple);margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;'});
  equipTitle.innerHTML = '<span>⚔️ Equipment</span>';
  
  var manageBtn = makeEl('button', {class:'btn-sm', style:'font-size:0.7rem;padding:4px 8px;'});
  manageBtn.textContent = 'Manage';
  manageBtn.onclick = function() { showEquipmentModal(pet.id); };
  equipTitle.appendChild(manageBtn);
  
  equipSection.appendChild(equipTitle);
  
  // Show equipped weapon and armor (we'll load this async)
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

  // Action buttons
  var actions = makeEl('div', {class:'pet-actions'});
  var feedBtn = makeEl('button', {class:'btn-action btn-feed', id:'feed-'+pet.id}, pet.hunger<pet.max_hunger?'Feed':'Full!');
  if (pet.hunger >= pet.max_hunger) feedBtn.disabled=true;
  feedBtn.onclick = function(){ feed(pet.id); };
  var playBtn = makeEl('button', {class:'btn-action btn-play', id:'play-'+pet.id}, pet.energy>=10?'Play':'Tired!');
  if (pet.energy < 10) playBtn.disabled=true;
  playBtn.onclick = function(){ play(pet.id); };
  
  // Check if already used today and update button states
  var feedKey = 'feed_' + pet.id + '_' + today;
  var playKey = 'play_' + pet.id + '_' + today;
  
  if (localStorage.getItem(feedKey) === 'done') {
    feedBtn.textContent = 'Fed Today!';
    feedBtn.disabled = true;
    feedBtn.style.opacity = '0.6';
  }
  
  if (localStorage.getItem(playKey) === 'done') {
    playBtn.textContent = 'Played Today!';
    playBtn.disabled = true;
    playBtn.style.opacity = '0.6';
  }
  
  actions.appendChild(feedBtn); actions.appendChild(playBtn);
  body.appendChild(actions);

  body.appendChild(makeDropdown(pet.id));
  body.appendChild(makeEl('div', {class:'stat-flash', id:'flash-'+pet.id}));
  card.appendChild(body);
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
    if (!display) {
      console.error('Equipment display element not found for pet:', petId);
      return;
    }
    
    try {
      // Get equipped items for this pet
      var equipRes = await supabaseClient
        .from('player_equipment')
        .select('equipment(*), equipped_slot')
        .eq('user_id', currentUser.id)
        .eq('is_equipped', true);
      
      console.log('Equipment query result:', equipRes);
      
      if (equipRes.error) {
        console.error('Equipment query error:', equipRes.error);
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
  // Fetch equipment and update stat display
  setTimeout(async function() {
    try {
      var equipRes = await supabaseClient
        .from('player_equipment')
        .select('equipment(*)')
        .eq('user_id', currentUser.id)
        .eq('is_equipped', true);
      
      if (equipRes.error || !equipRes.data) return;
      
      var totalAtk = baseAtk;
      var totalDef = baseDef;
      var totalSpd = baseSpd;
      
      equipRes.data.forEach(function(item) {
        var equip = item.equipment;
        totalAtk += equip.attack_bonus || 0;
        totalDef += equip.defense_bonus || 0;
        totalSpd += equip.speed_bonus || 0;
      });
      
      // Update the display
      var atkEl = el('atk-stat-' + petId);
      var defEl = el('def-stat-' + petId);
      var spdEl = el('spd-stat-' + petId);
      
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
  
  // Regenerate 5% per hour
  var regenRate = 5; // 5% per hour
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
  var xpNeeded = currentLevel * 120; // Increased from 100 to 120 for slower leveling
  
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

async function feed(petId) {
  var pet = petState[petId]; 
  if (!pet || pet.hunger >= pet.max_hunger) return;
  
  // Check daily limit (once per day per pet)
  var feedKey = 'feed_' + petId + '_' + today;
  if (localStorage.getItem(feedKey) === 'done') {
    showFlash(petId, 'Already fed today! Use items for more.', '#ff9f43');
    return;
  }
  
  var btn = el('feed-'+petId); btn.disabled=true; btn.textContent='...';
  var nh=Math.min(pet.hunger+20,pet.max_hunger);
  var nhap=Math.min(pet.happiness+5,pet.max_happiness);
  var lu=calculateLevelUp(
    pet.xp+10,
    pet.level,
    pet.max_hunger,
    pet.max_energy,
    pet.max_happiness,
    pet.base_hp || 25,
    pet.base_attack || 4,
    pet.base_defense || 2,
    pet.base_speed || 3
  );
  var upd={hunger:nh,happiness:nhap,xp:lu.xp,level:lu.level,last_fed:new Date().toISOString()};
  if(lu.leveled){
    upd.max_hunger=lu.maxHunger;
    upd.max_energy=lu.maxEnergy;
    upd.max_happiness=lu.maxHappiness;
    upd.base_hp=lu.base_hp;
    upd.base_attack=lu.base_attack;
    upd.base_defense=lu.base_defense;
    upd.base_speed=lu.base_speed;
    upd.max_hp=lu.base_hp; // Update max_hp to match new base_hp
  }
  var res=await supabaseClient.from('user_pets').update(upd).eq('id',petId);
  if(res.error){showFlash(petId,'Error!','#ff6eb4');btn.disabled=false;btn.textContent='Feed';return;}
  Object.assign(petState[petId],upd);
  updateBar(petId,'hunger',nh,lu.maxHunger); updateBar(petId,'happiness',nhap,lu.maxHappiness); updateXpBar(petId,lu.xp,lu.level);
  
  // Mark as used today
  localStorage.setItem(feedKey, 'done');
  
  if(lu.leveled){
    // Build stat increase message
    var statMsg = 'Level '+lu.level+'! +5 Max Stats';
    if (lu.statIncreases.hp) statMsg += ', +' + lu.statIncreases.hp + ' HP';
    if (lu.statIncreases.atk) statMsg += ', +' + lu.statIncreases.atk + ' ATK';
    if (lu.statIncreases.def) statMsg += ', +' + lu.statIncreases.def + ' DEF';
    if (lu.statIncreases.spd) statMsg += ', +' + lu.statIncreases.spd + ' SPD';
    
    showFlash(petId, statMsg, '#b06aff');
    updateLvl(petId,lu.level,lu.maxHunger);
    
    // Reload the pet card to show new stats
    tabsLoaded['mypets'] = false;
    
    // Award level badges
    if (lu.level === 5) await awardBadge('level_5');
    if (lu.level === 10) await awardBadge('level_10');
    if (lu.level === 20) await awardBadge('level_20');
  }
  else showFlash(petId,'+20 Hunger +5 Happiness +10 XP','#5dde7a');
  
  // Update button to show already used
  btn.textContent='Fed Today!';
  btn.disabled=true;
  btn.style.opacity='0.6';
}

async function play(petId) {
  var pet = petState[petId]; 
  if (!pet || pet.energy < 10) return;
  
  // Check daily limit (once per day per pet)
  var playKey = 'play_' + petId + '_' + today;
  if (localStorage.getItem(playKey) === 'done') {
    showFlash(petId, 'Already played today! Use items for more.', '#ff9f43');
    return;
  }
  
  var btn=el('play-'+petId); btn.disabled=true; btn.textContent='...';
  var ne=Math.max(pet.energy-10,0);
  var nhap=Math.min(pet.happiness+15,pet.max_happiness);
  var lu=calculateLevelUp(
    pet.xp+15,
    pet.level,
    pet.max_hunger,
    pet.max_energy,
    pet.max_happiness,
    pet.base_hp || 25,
    pet.base_attack || 4,
    pet.base_defense || 2,
    pet.base_speed || 3
  );
  var upd={energy:ne,happiness:nhap,xp:lu.xp,level:lu.level,last_played:new Date().toISOString()};
  if(lu.leveled){
    upd.max_hunger=lu.maxHunger;
    upd.max_energy=lu.maxEnergy;
    upd.max_happiness=lu.maxHappiness;
    upd.base_hp=lu.base_hp;
    upd.base_attack=lu.base_attack;
    upd.base_defense=lu.base_defense;
    upd.base_speed=lu.base_speed;
    upd.max_hp=lu.base_hp;
  }
  var res=await supabaseClient.from('user_pets').update(upd).eq('id',petId);
  if(res.error){showFlash(petId,'Error!','#ff6eb4');btn.disabled=false;btn.textContent='Play';return;}
  Object.assign(petState[petId],upd);
  updateBar(petId,'energy',ne,lu.maxEnergy); updateBar(petId,'happiness',nhap,lu.maxHappiness); updateXpBar(petId,lu.xp,lu.level);
  
  // Mark as used today
  localStorage.setItem(playKey, 'done');
  
  if(lu.leveled){
    // Build stat increase message
    var statMsg = 'Level '+lu.level+'! +5 Max Stats';
    if (lu.statIncreases.hp) statMsg += ', +' + lu.statIncreases.hp + ' HP';
    if (lu.statIncreases.atk) statMsg += ', +' + lu.statIncreases.atk + ' ATK';
    if (lu.statIncreases.def) statMsg += ', +' + lu.statIncreases.def + ' DEF';
    if (lu.statIncreases.spd) statMsg += ', +' + lu.statIncreases.spd + ' SPD';
    
    showFlash(petId, statMsg, '#b06aff');
    updateLvl(petId,lu.level,lu.maxHunger);
    
    // Reload the pet card to show new stats
    tabsLoaded['mypets'] = false;
    
    // Award level badges
    if (lu.level === 5) await awardBadge('level_5');
    if (lu.level === 10) await awardBadge('level_10');
    if (lu.level === 20) await awardBadge('level_20');
  }
  else showFlash(petId,'-10 Energy +15 Happiness +15 XP','#5dde7a');
  
  // Update button to show already used
  btn.textContent='Played Today!';
  btn.disabled=true;
  btn.style.opacity='0.6';
}

function updateBar(petId,stat,val,max) {
  var pct=Math.round(val/max*100);
  var b=el(stat+'-bar-'+petId); if(b)b.style.width=pct+'%';
  var v=el(stat+'-val-'+petId); if(v)v.textContent=val+'/'+max;
}
function updateXpBar(petId,xp,level) {
  var next=level*120; var pct=Math.min(xp/next*100,100);
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

// ── SHOP TAB ─────────────────────────────
function showShopTab(tab) {
  // Update tab buttons
  el('shop-tab-btn').classList.remove('active');
  el('equip-tab-btn').classList.remove('active');
  el('inv-tab-btn').classList.remove('active');
  
  // Hide all panels
  el('shop-items-panel').style.display = 'none';
  el('shop-equipment-panel').style.display = 'none';
  el('shop-inv-panel').style.display = 'none';
  
  if (tab === 'items') {
    el('shop-tab-btn').classList.add('active');
    el('shop-items-panel').style.display = 'block';
  } else if (tab === 'equipment') {
    el('equip-tab-btn').classList.add('active');
    el('shop-equipment-panel').style.display = 'block';
    loadEquipmentShop();
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


async function loadShop() {
  var grid = el('shop-grid');
  
  // Exclude boss drops from shop! Boss items can only be obtained by defeating bosses
  var res = await supabaseClient
    .from('items')
    .select('*')
    .or('is_boss_drop.is.null,is_boss_drop.eq.false')
    .order('price', {ascending: true});
  
  if (res.error||!res.data||!res.data.length) { 
    grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:36px;color:var(--text-light)">No items yet!</div>'; 
    return; 
  }
  
  // Dedupe items
  var seen={}, deduped=[];
  res.data.forEach(function(item){ var k=item.name.toLowerCase().trim(); if(!seen[k]||item.price<seen[k].price)seen[k]=item; });
  Object.values(seen).forEach(function(i){deduped.push(i);});
  
  // Categorize items
  var categories = {
    food: [],
    toys: [],
    energy: [],
    healing: [],
    equipment: [],
    other: []
  };
  
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
      categories.food.push(item);
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
    
    // Render items in this category
    items.forEach(function(item) {
      var card=makeEl('div',{class:'shop-card'});
      var iconDiv=makeEl('div',{class:'shop-item-icon'});
      if(item.image_url){var img=makeEl('img',{src:item.image_url,alt:item.name});img.onerror=function(){this.parentElement.innerHTML=itemEmoji(item.item_type);};iconDiv.appendChild(img);}
      else iconDiv.innerHTML=itemEmoji(item.item_type);
      card.appendChild(iconDiv);
      card.appendChild(makeEl('div',{class:'shop-item-name'},item.name));
      card.appendChild(makeEl('div',{class:'shop-item-desc'},item.description||''));
      var tags=makeEl('div',{class:'shop-effects'});
      if(item.hunger_effect>0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.hunger_effect+' Hunger'));
      if(item.energy_effect>0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.energy_effect+' Energy'));
      if(item.happiness_effect>0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.happiness_effect+' Happiness'));
      if(item.xp_effect>0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.xp_effect+' XP'));
      if(item.effect === 'healing' && item.effect_value > 0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.effect_value+' HP'));
      if(item.attack_bonus>0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.attack_bonus+' ATK'));
      if(item.defense_bonus>0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.defense_bonus+' DEF'));
      if(item.hp_bonus>0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.hp_bonus+' HP'));
      if(item.speed_bonus>0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.speed_bonus+' SPD'));
      if(tags.children.length)card.appendChild(tags);
      card.appendChild(makeEl('div',{class:'shop-item-price'},'🪙 '+item.price+' PP'));
      var canAfford=currentPoints>=item.price;
      var buyBtn=makeEl('button',{class:'btn-buy'},canAfford?'Buy':'Need '+item.price+' PP');
      if(!canAfford)buyBtn.disabled=true;
      buyBtn.onclick=function(){buyItem(item.id,item.name,item.price);};
      card.appendChild(buyBtn);
      grid.appendChild(card);
    });
  });
  
  // Add any uncategorized items at the end
  if (categories.other.length > 0) {
    var header = makeEl('div', {class: 'shop-category-header'});
    header.style.cssText = 'grid-column: 1 / -1; padding: 20px 10px 10px; border-bottom: 3px solid var(--purple-light); margin-bottom: 10px;';
    header.innerHTML = '<div style="font-size: 1.4rem; font-weight: bold; color: var(--purple);">📦 Other Items</div>';
    grid.appendChild(header);
    
    categories.other.forEach(function(item) {
      var card=makeEl('div',{class:'shop-card'});
      var iconDiv=makeEl('div',{class:'shop-item-icon'});
      if(item.image_url){var img=makeEl('img',{src:item.image_url,alt:item.name});img.onerror=function(){this.parentElement.innerHTML=itemEmoji(item.item_type);};iconDiv.appendChild(img);}
      else iconDiv.innerHTML=itemEmoji(item.item_type);
      card.appendChild(iconDiv);
      card.appendChild(makeEl('div',{class:'shop-item-name'},item.name));
      card.appendChild(makeEl('div',{class:'shop-item-desc'},item.description||''));
      card.appendChild(makeEl('div',{class:'shop-item-price'},'🪙 '+item.price+' PP'));
      var canAfford=currentPoints>=item.price;
      var buyBtn=makeEl('button',{class:'btn-buy'},canAfford?'Buy':'Need '+item.price+' PP');
      if(!canAfford)buyBtn.disabled=true;
      buyBtn.onclick=function(){buyItem(item.id,item.name,item.price);};
      card.appendChild(buyBtn);
      grid.appendChild(card);
    });
  }
}

async function buyItem(itemId,itemName,price) {
  if(currentPoints<price||!currentUser)return;
  var np=currentPoints-price;
  
  // Get current total_spent first
  var playerRes = await supabaseClient.from('players').select('total_spent').eq('id',currentUser.id).single();
  var newTotalSpent = (playerRes.data?.total_spent || 0) + price;
  
  // Update points AND total_spent
  var r1=await supabaseClient.from('players').update({
    pawketpoints:np,
    total_spent: newTotalSpent
  }).eq('id',currentUser.id);
  
  if(r1.error){showToast('Error deducting points.');return;}
  
  // Check spending badges
  if (newTotalSpent >= 500) {
    await awardBadge('mega_spender');
  } else if (newTotalSpent >= 100) {
    await awardBadge('big_spender');
  }
  
  var existing=await supabaseClient.from('user_inventory').select('id,quantity').eq('user_id',currentUser.id).eq('item_id',itemId).limit(1);
  if(existing.data&&existing.data.length>0){
    await supabaseClient.from('user_inventory').update({quantity:existing.data[0].quantity+1}).eq('id',existing.data[0].id);
  } else {
    var ins=await supabaseClient.from('user_inventory').insert([{user_id:currentUser.id,item_id:itemId,quantity:1}]);
    if(ins.error){showToast('Bought but inventory failed: '+ins.error.message);return;}
  }
  updateAllPoints(np);
  showToast('Bought '+itemName+'!');
  tabsLoaded['shop']=false; loadShop(); loadInventory();
  tabsLoaded['mypets']=false;
}

async function loadInventory() {
  var grid=el('inventory-grid'); if(!currentUser)return;
  var invRes=await supabaseClient.from('user_inventory').select('id,item_id,quantity').eq('user_id',currentUser.id).gt('quantity',0);
  if(invRes.error||!invRes.data||!invRes.data.length){grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:36px;color:var(--text-light)">Inventory empty!</div>';return;}
  var itemIds=invRes.data.map(function(r){return r.item_id;});
  var itemsRes=await supabaseClient.from('items').select('id,name,item_type,image_url').in('id',itemIds);
  var itemMap={};
  if(itemsRes.data)itemsRes.data.forEach(function(i){itemMap[i.id]=i;});
  grid.innerHTML='';
  invRes.data.forEach(function(row){
    var item=itemMap[row.item_id]||{};
    var card=makeEl('div',{class:'inv-card'});
    var icon=makeEl('div',{class:'inv-icon'});
    if(item.image_url){var img=makeEl('img',{src:item.image_url,alt:item.name||'',style:'width:100%;height:100%;object-fit:cover;'});img.onerror=function(){this.parentElement.innerHTML=itemEmoji(item.item_type);};icon.appendChild(img);}
    else icon.innerHTML=itemEmoji(item.item_type);
    card.appendChild(icon);
    card.appendChild(makeEl('div',{class:'inv-name'},item.name||'Item'));
    card.appendChild(makeEl('div',{class:'inv-qty'},'x'+row.quantity));
    var useBtn=makeEl('button',{class:'btn btn-sm btn-primary'},'Use');
    useBtn.onclick=(function(rId,iName){return function(){openUseModal(rId,iName);};})(row.id, item.name||'Item');
    card.appendChild(useBtn);
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
  await supabaseClient.from('user_pets').update(updates).eq('id',petId);
  var qty=invRow.data.quantity;
  if(qty<=1)await supabaseClient.from('user_inventory').delete().eq('id',invId);
  else await supabaseClient.from('user_inventory').update({quantity:qty-1}).eq('id',invId);
  showToast('Used '+itemName+' on '+petNickname+'!');
  await loadInventory(); tabsLoaded['mypets']=false;
}

// ══════════════════════════════════════════════════════════════════════════
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
  console.log('[Badges] User has earned:', earnedBadges);
}

async function awardBadge(badgeKey, showNotification = true) {
  if (!currentUser) return;
  
  // Check if already earned
  if (earnedBadges.includes(badgeKey)) {
    console.log('[Badges] Already earned:', badgeKey);
    return;
  }
  
  // Get badge info
  var badgeRes = await supabaseClient
    .from('badges')
    .select('*')
    .eq('badge_key', badgeKey)
    .single();
  
  if (badgeRes.error || !badgeRes.data) {
    console.error('[Badges] Badge not found:', badgeKey);
    return;
  }
  
  var badge = badgeRes.data;
  
  // Award badge
  var res = await supabaseClient
    .from('user_badges')
    .insert([{
      user_id: currentUser.id,
      badge_id: badge.id
    }]);
  
  if (res.error) {
    // Might be duplicate - that's ok
    console.log('[Badges] Error awarding (probably duplicate):', res.error);
    return;
  }
  
  // Add to cache
  earnedBadges.push(badgeKey);
  
  // Log activity to feed
  await logActivity('badge_earned', {
    badge_name: badge.name,
    badge_icon: badge.icon
  });
  
  // Show notification
  if (showNotification) {
    showBadgeNotification(badge);
  }
  
  console.log('[Badges] Awarded:', badgeKey);
}

function showBadgeNotification(badge) {
  var notification = makeEl('div', {class: 'badge-notification'});
  notification.innerHTML = `
    <div class="badge-notif-icon">${badge.icon}</div>
    <div class="badge-notif-content">
      <div class="badge-notif-title">Badge Earned!</div>
      <div class="badge-notif-name">${badge.name}</div>
      <div class="badge-notif-desc">${badge.description || ''}</div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => notification.classList.add('show'), 10);
  
  // Remove after 5 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 5000);
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
}

async function awardPP(amount) {
  if(!currentUser)return;
  var np=currentPoints+amount;
  await supabaseClient.from('players').update({pawketpoints:np}).eq('id',currentUser.id);
  updateAllPoints(np);
  
  // Check if user is now in top 10
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
async function rollDice() {
  if(isCD('dice'))return;
  var btn=el('roll-btn'); btn.disabled=true;
  var d1=el('die1'); var d2=el('die2');
  var res=el('dice-result'); res.textContent=''; res.style.opacity='0';
  d1.classList.add('rolling'); d2.classList.add('rolling');
  var ri=setInterval(function(){d1.innerHTML=diceFaces[Math.floor(Math.random()*6)];d2.innerHTML=diceFaces[Math.floor(Math.random()*6)];},100);
  setTimeout(async function(){
    clearInterval(ri); d1.classList.remove('rolling'); d2.classList.remove('rolling');
    var v1=Math.floor(Math.random()*6)+1; var v2=Math.floor(Math.random()*6)+1;
    d1.innerHTML=diceFaces[v1-1]; d2.innerHTML=diceFaces[v2-1];
    var total=v1+v2; var isDouble=v1===v2; var earned=isDouble?total*3:total;
    await awardPP(earned); setCD('dice');
    
    // Award badges
    await awardBadge('dice_first_play'); // First time playing
    if (isDouble) {
      await awardBadge('lucky_doubles'); // Any doubles
      if (v1 === 1) await awardBadge('snake_eyes'); // Double 1s
      if (v1 === 6) await awardBadge('boxcars'); // Double 6s
    }
    
    res.style.opacity='1';
    res.textContent=isDouble?'DOUBLE '+v1+'s! +'+earned+' PP!':'Rolled '+v1+'+'+v2+'='+total+'! +'+earned+' PP!';
    res.style.color=isDouble?'#b06aff':'#5dde7a';
    btn.style.display='none'; el('dice-cooldown').style.display='block';
  },1200);
}

var guessAttempts = 0; // Track attempts for badge

function initGuess(){
  secretNumber=Math.floor(Math.random()*10)+1;
  guessesLeft=3;
  guessAttempts=0;
  el('guess-input').value='';
  el('guess-result').textContent='';
  el('attempts-left').textContent='3 guesses remaining';
}

async function makeGuess() {
  if(isCD('guess'))return;
  var input=el('guess-input'); var guess=parseInt(input.value);
  var result=el('guess-result'); var attEl=el('attempts-left');
  if(!guess||guess<1||guess>10){result.textContent='Enter a number 1-10!';result.style.color='#ff6eb4';return;}
  
  guessesLeft--;
  guessAttempts++;
  
  if(guess===secretNumber){
    await awardPP(25); setCD('guess');
    
    // Award badges
    await awardBadge('guess_first_play'); // First time playing
    if (guessAttempts === 1) {
      await awardBadge('first_try'); // Got it on first try!
      
      // Track first-try wins for Mind Reader badge
      var playerRes = await supabaseClient.from('players').select('first_try_wins').eq('id',currentUser.id).single();
      var newCount = (playerRes.data?.first_try_wins || 0) + 1;
      await supabaseClient.from('players').update({first_try_wins: newCount}).eq('id',currentUser.id);
      
      if (newCount >= 5) {
        await awardBadge('mind_reader'); // 5 first-try wins!
      }
    }
    
    result.textContent='Correct! +25 PP!'; result.style.color='#5dde7a';
    el('guess-play').style.display='none'; el('guess-cooldown').style.display='block';
  } else if(guessesLeft===0){
    setCD('guess');
    await awardBadge('guess_first_play'); // Award badge even if lost
    result.textContent='The number was '+secretNumber+'. Better luck tomorrow!'; result.style.color='#ff6eb4';
    el('guess-play').style.display='none'; el('guess-cooldown').style.display='block';
  } else {
    result.textContent=(guess<secretNumber?'Too low!':'Too high!')+' '+guessesLeft+' left.'; result.style.color='#ff9f43';
    attEl.textContent=guessesLeft+' guess'+(guessesLeft===1?'':'es')+' remaining';
    input.value=''; input.focus();
  }
}

function shuffle(arr){var a=arr.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
function initMemory() {
  if(isCD('memory'))return;
  memoryCards=shuffle(memoryEmojis.concat(memoryEmojis));
  flippedCards=[]; matchedPairs=0; triesLeft=15; memoryEarned=0; memoryLocked=false;
  el('match-count').textContent='0'; el('tries-left').textContent='15'; el('memory-earned').textContent='0'; el('memory-result').textContent='';
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
      
      if(matchedPairs===6){
        // Game complete!
        awardPP(memoryEarned);setCD('memory');
        
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
          awardPP(memoryEarned);setCD('memory');
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
  var targetAngle = (360 / wheelPrizes.length) * winningIndex;
  var totalRotation = (rotations * 360) + targetAngle;
  
  var startTime = Date.now();
  var duration = 4000;
  
  function animate() {
    var elapsed = Date.now() - startTime;
    var progress = Math.min(elapsed / duration, 1);
    var easeOut = 1 - Math.pow(1 - progress, 3);
    var currentRotation = totalRotation * easeOut;
    
    canvas.style.transform = 'rotate(' + currentRotation + 'deg)';
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      wheelSpinning = false;
      awardPP(winningPrize);
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

function startWhack() {
  if (isCD('whack')) return;
  whackScore = 0;
  var timeLeft = 30;
  
  el('whack-score').textContent = '0';
  el('whack-earned').textContent = '0';
  el('whack-time').textContent = timeLeft;
  el('whack-btn').disabled = true;
  el('whack-result').textContent = '';
  
  // Pop moles randomly
  whackInterval = setInterval(function() {
    var moleId = Math.floor(Math.random() * 6);
    var mole = el('mole-' + moleId);
    if (!mole.classList.contains('active')) {
      mole.classList.add('active');
      setTimeout(function() {
        mole.classList.remove('active');
      }, 800);
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
    mole.classList.add('hit');
    mole.classList.remove('active');
    whackScore++;
    var earned = whackScore * 5;
    el('whack-score').textContent = whackScore;
    el('whack-earned').textContent = earned;
    setTimeout(function() {
      mole.classList.remove('hit');
      mole.style.bottom = '-60px';
    }, 300);
  }
}

function endWhack() {
  clearInterval(whackTimer);
  clearInterval(whackInterval);
  var earned = Math.min(whackScore * 5, 50);
  awardPP(earned);
  setCD('whack');
  var r = el('whack-result');
  r.textContent = 'Game over! +' + earned + ' PP!';
  r.style.color = '#5dde7a';
  el('whack-cooldown').style.display = 'block';
  el('whack-btn').disabled = true;
  document.querySelectorAll('.mole').forEach(function(m) {
    m.classList.remove('active');
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
  
  // Show egg under all shells briefly
  for (var i = 0; i < 3; i++) {
    el('shell-' + i).textContent = i === shellWinningPos ? '🥚✨' : '🥚';
  }
  
  setTimeout(function() {
    for (var i = 0; i < 3; i++) {
      el('shell-' + i).textContent = '🥚';
    }
  }, 1000);
  
  // Animate shuffle
  var shells = [el('shell-0'), el('shell-1'), el('shell-2')];
  var shuffles = 0;
  var shuffleInterval = setInterval(function() {
    shells.forEach(function(s) { s.classList.add('shuffle'); });
    setTimeout(function() {
      shells.forEach(function(s) { s.classList.remove('shuffle'); });
    }, 400);
    shuffles++;
    if (shuffles >= 5) {
      clearInterval(shuffleInterval);
      shellShuffling = false;
    }
  }, 500);
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
        awardPP(30);
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
  awardPP(earned);
  setCD('typing');
  var r = el('typing-result');
  r.textContent = 'Time\'s up! +' + earned + ' PP!';
  r.style.color = '#5dde7a';
  el('typing-cooldown').style.display = 'block';
  el('typing-input').disabled = true;
  el('typing-btn').disabled = true;
}

// ── FISHING GAME ──────────────────────────────
var fishingCasts = 10;
var fishingTotal = 0;

function castLine() {
  if (isCD('fishing') || fishingCasts <= 0) return;
  
  var btn = el('fishing-btn');
  btn.disabled = true;
  btn.textContent = 'Casting...';
  
  var line = el('fishing-line');
  line.style.display = 'block';
  
  setTimeout(function() {
    line.style.display = 'none';
    
    // Random catch
    var catches = [
      { name: 'Old Boot', pp: 0, emoji: '👢' },
      { name: 'Seaweed', pp: 1, emoji: '🌿' },
      { name: 'Small Fish', pp: 3, emoji: '🐟' },
      { name: 'Medium Fish', pp: 5, emoji: '🐠' },
      { name: 'Big Fish', pp: 8, emoji: '🐡' },
      { name: 'Rare Fish', pp: 12, emoji: '🦈' }
    ];
    
    var rand = Math.random();
    var caught;
    if (rand < 0.2) caught = catches[0]; // Boot
    else if (rand < 0.4) caught = catches[1]; // Seaweed
    else if (rand < 0.65) caught = catches[2]; // Small
    else if (rand < 0.85) caught = catches[3]; // Medium
    else if (rand < 0.95) caught = catches[4]; // Big
    else caught = catches[5]; // Rare
    
    fishingCasts--;
    fishingTotal += caught.pp;
    
    el('fishing-casts').textContent = fishingCasts;
    el('fishing-earned').textContent = fishingTotal;
    
    document.querySelector('.pond-text').textContent = caught.emoji + ' Caught: ' + caught.name + ' (+' + caught.pp + ' PP)';
    
    if (fishingCasts <= 0) {
      awardPP(fishingTotal);
      setCD('fishing');
      setTimeout(function() {
        var r = el('fishing-result');
        r.textContent = 'All casts used! +' + fishingTotal + ' PP total!';
        r.style.color = '#5dde7a';
        el('fishing-cooldown').style.display = 'block';
      }, 2000);
    } else {
      btn.disabled = false;
      btn.textContent = 'Cast Again!';
    }
  }, 1500);
}

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
  var pr = await supabaseClient.from('players').select('pawketpoints').eq('id', userId).single();
  if (!pr.data) return { awarded: false };
  
  var newTotal = pr.data.pawketpoints + bonusAmount;
  await supabaseClient.from('players').update({ pawketpoints: newTotal }).eq('id', userId);
  
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
async function loadSidebarNews() {
  var widget = el('sidebar-news-container');
  if (!widget) {
    console.error('[loadSidebarNews] Widget not found!');
    return;
  }
  
  console.log('[loadSidebarNews] Loading news...');
  var res = await supabaseClient.from('news').select('*').eq('is_published',true).order('published_at',{ascending:false}).limit(3);
  
  console.log('[loadSidebarNews] Result:', res);
  
  if (res.error || !res.data || !res.data.length) {
    widget.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-light);">No news yet!</div>';
    return;
  }
  
  widget.innerHTML = '';
  res.data.forEach(function(post){
    var date = new Date(post.published_at || post.created_at).toLocaleDateString('en-US', {month:'short',day:'numeric'});
    var item = makeEl('div', {class:'news-item'});
    item.innerHTML = '<div class="news-date">' + date + '</div><div class="news-title">' + (post.content || 'No content') + '</div>';
    widget.appendChild(item);
  });
}

async function loadNews() {
  var container=el('news-container');
  var res=await supabaseClient.from('news').select('*').eq('is_published',true).order('published_at',{ascending:false});
  if(res.error||!res.data||!res.data.length){container.innerHTML='<div class="card" style="text-align:center;padding:56px 36px;"><div style="font-size:2.8rem;margin-bottom:14px;">&#128235;</div><h2 style="color:var(--purple-dark);margin-bottom:10px;">No news yet!</h2><p style="color:var(--text-light)">Check back soon!</p></div>';return;}
  container.innerHTML='';
  res.data.forEach(function(post){
    var date=new Date(post.published_at||post.created_at).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
    var div=makeEl('div',{class:'news-post'});
    div.appendChild(makeEl('div',{class:'news-post-date'},date));
    div.appendChild(makeEl('h3',{},post.title||'Untitled'));
    div.appendChild(makeEl('p',{},post.content||''));
    if(post.author)div.appendChild(makeEl('div',{class:'news-author'},'- '+post.author));
    container.appendChild(div);
  });
}

// ── TWITCH ───────────────────────────────
async function initTwitchTab() {
  var hash=window.location.hash;
  if(hash&&hash.includes('access_token')){
    var params={};
    hash.substring(1).split('&').forEach(function(part){var pair=part.split('=');params[pair[0]]=decodeURIComponent(pair[1]||'');});
    var token=params['access_token'];
    if(token){
      var td = document.getElementById('token-display');
      if(td) td.value=token;
      var tb = document.getElementById('token-box');
      if(tb) tb.style.display='block';
      await handleTwitchCallback(token);
    }
    window.history.replaceState({},'',window.location.pathname);
  }
  await checkTwitchLinked();
  await loadTeamShowcase();
}

// Team members config — add new members here as they join
var TEAM_MEMBERS = [
  { name: 'Embertail', login: 'embertail', twitchUrl: 'https://twitch.tv/Embertail', petName: 'Ember' },
  { name: 'Pyxshuul',  login: 'pyxshuul',  twitchUrl: 'https://twitch.tv/Pyxshuul',  petName: 'Pyxie' }
];

async function loadTeamShowcase() {
  var showcase = document.getElementById('team-showcase');
  if (!showcase) return;
  showcase.innerHTML = '';

  // Check live status for each member using Twitch API if user has linked their account
  // Falls back to showing static cards if not linked
  var liveData = {};
  try {
    var user = currentUser;
    if (user) {
      var pr = await supabaseClient.from('players').select('twitch_token').eq('id', user.id).single();
      if (pr.data && pr.data.twitch_token) {
        var logins = TEAM_MEMBERS.map(function(m){ return 'user_login='+m.login; }).join('&');
        var resp = await fetch('https://api.twitch.tv/helix/streams?' + logins, {
          headers: { 'Client-Id': TWITCH_CLIENT_ID, 'Authorization': 'Bearer ' + pr.data.twitch_token }
        });
        var data = await resp.json();
        if (data.data) {
          data.data.forEach(function(stream) {
            liveData[stream.user_login.toLowerCase()] = {
              live: true,
              viewers: stream.viewer_count,
              title: stream.title
            };
          });
        }
      }
    }
  } catch(e) { console.log('Could not check live status:', e); }

  TEAM_MEMBERS.forEach(function(member) {
    var card = document.createElement('div');
    card.className = 'team-member-card';

    // Avatar placeholder (uses first letter of name)
    var avatarDiv = document.createElement('div');
    avatarDiv.className = 'team-avatar';
    avatarDiv.style.cssText = 'display:flex;align-items:center;justify-content:center;font-family:Fredoka One,cursive;font-size:2rem;color:var(--purple-dark);background:var(--purple-light);';
    avatarDiv.textContent = member.name.charAt(0);
    card.appendChild(avatarDiv);

    card.appendChild(makeEl('div', {class:'team-name'}, member.name));

    var liveStatus = liveData[member.login.toLowerCase()];
    var badge = makeEl('span', {class: liveStatus ? 'team-live-badge live' : 'team-live-badge offline'});
    badge.textContent = liveStatus ? '&#128308; LIVE' : 'Offline';
    badge.innerHTML = liveStatus ? '&#128308; LIVE' : 'Offline';
    card.appendChild(badge);

    if (liveStatus && liveStatus.viewers) {
      card.appendChild(makeEl('div', {class:'team-viewers'}, liveStatus.viewers.toLocaleString() + ' viewers'));
    }

    if (liveStatus && liveStatus.title) {
      var title = makeEl('div', {style:'font-size:0.78rem;color:var(--text-light);line-height:1.3;max-height:36px;overflow:hidden;'});
      title.textContent = liveStatus.title;
      card.appendChild(title);
    }

    var watchBtn = makeEl('a', {href:member.twitchUrl, target:'_blank', class:'btn-watch'}, 'Watch on Twitch');
    card.appendChild(watchBtn);

    showcase.appendChild(card);
  });
}
async function checkTwitchLinked() {
  if(!currentUser)return;
  var res=await supabaseClient.from('players').select('twitch_username,twitch_id,twitch_token,twitch_follow_rewards').eq('id',currentUser.id).single();
  if(res.data&&res.data.twitch_username){
    el('twitch-not-linked').style.display='none';
    el('twitch-linked').style.display='block';
    el('twitch-username').textContent=res.data.twitch_username;
    var rewards=res.data.twitch_follow_rewards||{};
    if(rewards.embertail){var b=el('follow-ember-badge');b.textContent='Claimed';b.className='status-badge status-done';b.style.display='inline-block';}
    if(rewards.pyxshuul){var b2=el('follow-pyxs-badge');b2.textContent='Claimed';b2.className='status-badge status-done';b2.style.display='inline-block';}
  }
}

async function checkFollows() {
  var btn=el('check-follows-btn'); btn.disabled=true; btn.textContent='Checking...';
  if(!currentUser)return;
  var pr=await supabaseClient.from('players').select('twitch_id,twitch_token,pawketpoints,twitch_follow_rewards').eq('id',currentUser.id).single();
  if(!pr.data||!pr.data.twitch_token){showToast('Twitch not linked!');btn.disabled=false;btn.textContent='Check Follows';return;}
  var twitchId=pr.data.twitch_id; var token=pr.data.twitch_token;
  var rewards=pr.data.twitch_follow_rewards||{}; var earned=0;
  for(var key in STREAMER_IDS){
    if(rewards[key])continue;
    var sid=STREAMER_IDS[key]; if(sid.indexOf('TWITCH_USER_ID')!==-1)continue;
    try{
      var fr=await fetch('https://api.twitch.tv/helix/channels/followed?user_id='+twitchId+'&broadcaster_id='+sid,{headers:{'Client-Id':TWITCH_CLIENT_ID,'Authorization':'Bearer '+token}});
      var fd=await fr.json();
      if(fd.data&&fd.data.length>0){
        rewards[key]=true; earned+=50;
        var b=el('follow-'+key+'-badge');
        if(b){b.textContent='Claimed';b.className='status-badge status-done';b.style.display='inline-block';}
      } else {
        var b2=el('follow-'+key+'-badge');
        if(b2){b2.textContent='Not following';b2.className='status-badge status-pending';b2.style.display='inline-block';}
      }
    }catch(e){console.warn('Follow check error',key,e);}
  }
  var np=(pr.data.pawketpoints||0)+earned;
  await supabaseClient.from('players').update({pawketpoints:np,twitch_follow_rewards:rewards}).eq('id',currentUser.id);
  if(earned>0){updateAllPoints(np);showToast('You earned '+earned+' PP!');}
  else showToast('No new rewards. Follow our streamers!');
  btn.disabled=false; btn.textContent='Check Follows & Claim Rewards';
}

async function unlinkTwitch(){
  if(!currentUser)return;
  await supabaseClient.from('players').update({twitch_id:null,twitch_username:null,twitch_token:null}).eq('id',currentUser.id);
  el('twitch-not-linked').style.display='block';
  el('twitch-linked').style.display='none';
  showToast('Twitch unlinked.');
}
// ── REDEEM CODES ─────────────────────────────

// Update the points counter in the redeem tab too
// We need to patch updateAllPoints to include redeem-points.
// Find your updateAllPoints function and add 'redeem-points' to the forEach array like this:
//   ['adopt-points','mypets-points','shop-points','games-points','redeem-points']

async function redeemCode() {
  if (!currentUser) return;
  var input = el('redeem-code-input');
  var btn   = el('redeem-btn');
  var errEl = el('redeem-error');
  var successPanel = el('redeem-success-panel');
  var code  = input.value.trim().toUpperCase();

  // Reset state
  errEl.classList.remove('show');
  errEl.textContent = '';
  successPanel.style.display = 'none';

  if (!code) {
    errEl.textContent = 'Please enter a code!';
    errEl.classList.add('show');
    return;
  }

  btn.textContent = 'Checking...';
  btn.disabled = true;

  try {
    // 1. Look up the promo code (case-insensitive via upper())
    var codeRes = await supabaseClient
      .from('promo_codes')
      .select('id, code, pp_reward, lore_page, description, max_uses, times_used, is_active')
      .eq('code', code)
      .eq('is_active', true)
      .single();

    if (codeRes.error || !codeRes.data) {
      errEl.textContent = 'That code doesn\'t exist or is no longer active. Check for typos!';
      errEl.classList.add('show');
      btn.textContent = '✨ Redeem!';
      btn.disabled = false;
      return;
    }

    var promo = codeRes.data;

    // 2. Check max uses
    if (promo.max_uses !== null && promo.times_used >= promo.max_uses) {
      errEl.textContent = 'This code has been fully claimed — sorry!';
      errEl.classList.add('show');
      btn.textContent = '✨ Redeem!';
      btn.disabled = false;
      return;
    }

    // 3. Check if THIS player already redeemed it (skip for unlimited codes)
    if (promo.max_uses !== null) {
      var alreadyRes = await supabaseClient
        .from('redeemed_codes')
        .select('id')
        .eq('player_id', currentUser.id)
        .eq('code_id', promo.id)
        .maybeSingle();

      if (alreadyRes.data) {
        errEl.textContent = 'You\'ve already redeemed this code! Each code is one per account.';
        errEl.classList.add('show');
        btn.textContent = '✨ Redeem!';
        btn.disabled = false;
        return;
      }
    }

    // 4. All good — award the PP
    if (promo.pp_reward && promo.pp_reward > 0) {
      var newPoints = currentPoints + promo.pp_reward;
      var ppRes = await supabaseClient
        .from('players')
        .update({ pawketpoints: newPoints })
        .eq('id', currentUser.id);
      if (ppRes.error) throw new Error(ppRes.error.message);
      updateAllPoints(newPoints);
    }

    // 5. Log the redemption in redeemed_codes (only if max_uses is set)
    if (promo.max_uses !== null) {
      await supabaseClient.from('redeemed_codes').insert([{
        player_id: currentUser.id,
        code_id: promo.id,
        redeemed_at: new Date().toISOString()
      }]);
    }

    // 6. Increment times_used on promo_codes
    await supabaseClient
      .from('promo_codes')
      .update({ times_used: (promo.times_used || 0) + 1 })
      .eq('id', promo.id);

    // 6.5. SPOOKY EFFECT for THEYWENTMISSING code
    if (code === 'THEYWENTMISSING') {
      triggerSpookyEffect();
    }

    // 7. Show success panel
    input.value = '';
    successPanel.style.display = 'block';

    var titleEl = el('redeem-success-title');
    var msgEl   = el('redeem-success-msg');
    var loreBtn = el('redeem-lore-btn');

    // 7. If it's a lore code (spooky easter egg), hide normal messages
    if (promo.lore_page) {
      titleEl.textContent = '...';
      msgEl.textContent = ''; // No description shown
      loreBtn.style.display = 'inline-block';
      loreBtn.href = promo.lore_page;
      loreBtn.textContent = '🔍 Something feels... off. Click here.';
    } else {
      // Normal reward codes
      if (promo.pp_reward && promo.pp_reward > 0) {
        titleEl.textContent = '+' + promo.pp_reward + ' PawketPoints!';
        msgEl.textContent = promo.description || 'Code redeemed successfully!';
      } else {
        titleEl.textContent = 'Code Accepted.';
        msgEl.textContent = promo.description || 'Something has been unlocked...';
      }
      loreBtn.style.display = 'none';
    }

    // Reload history
    loadRedeemHistory();
    showToast('Code redeemed! 🎉');

  } catch(err) {
    errEl.textContent = 'Something went wrong: ' + err.message;
    errEl.classList.add('show');
  }

  btn.textContent = '✨ Redeem!';
  btn.disabled = false;
}

async function loadRedeemHistory() {
  var container = el('redeem-history');
  if (!currentUser) return;
  container.innerHTML = '<div class="spinner"></div>';

  var res = await supabaseClient
    .from('redeemed_codes')
    .select('redeemed_at, code_id, promo_codes(code, pp_reward, description)')
    .eq('player_id', currentUser.id)
    .order('redeemed_at', { ascending: false })
    .limit(10);

  if (res.error || !res.data || !res.data.length) {
    container.innerHTML = '<div class="redeem-empty">No codes redeemed yet!<br>Check streams and socials for codes. 🎟</div>';
    return;
  }

  container.innerHTML = '';
  res.data.forEach(function(row) {
    var promo = row.promo_codes || {};
    var date  = new Date(row.redeemed_at).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
    var item  = document.createElement('div');
    item.className = 'redeem-history-item';
    item.innerHTML =
      '<span class="rhi-code">🎟 ' + (promo.code || '???') + '</span>' +
      '<span style="flex:1;padding:0 12px;font-size:0.82rem;color:var(--text-light);">' + (promo.description || '') + '</span>' +
      (promo.pp_reward ? '<span class="rhi-pp">+' + promo.pp_reward + ' PP</span>' : '<span class="rhi-pp" style="color:var(--purple)">🔍 Lore</span>') +
      '<span class="rhi-date" style="margin-left:12px;">' + date + '</span>';
    container.appendChild(item);
  });
}


// ── BOOT ─────────────────────────────────
// Initialize new minigames
setTimeout(function() {
  drawWheel();
  
  // Check cooldowns for new games
  if (isCD('wheel')) {
    el('wheel-cooldown').style.display = 'block';
    el('wheel-btn').disabled = true;
  }
  if (isCD('whack')) {
    el('whack-cooldown').style.display = 'block';
    el('whack-btn').disabled = true;
  }
  if (isCD('shell')) {
    el('shell-cooldown').style.display = 'block';
    el('shell-btn').disabled = true;
  }
  if (isCD('typing')) {
    el('typing-cooldown').style.display = 'block';
    el('typing-btn').disabled = true;
  }
  if (isCD('fishing')) {
    el('fishing-cooldown').style.display = 'block';
    el('fishing-btn').disabled = true;
  }
}, 1000);

// ══════════════════════════════════════════════════════════════════════════
// LEADERBOARDS
// ══════════════════════════════════════════════════════════════════════════

var currentLeaderboard = 'points';
var leaderboardCache = {
  points: null,
  pets: null,
  levels: null
};

function switchLeaderboard(type) {
  currentLeaderboard = type;
  
  // Update tab styles
  var tabs = document.querySelectorAll('.leaderboard-tab');
  tabs.forEach(function(tab) {
    tab.classList.remove('active');
  });
  event.target.classList.add('active');
  
  // Show correct list
  document.querySelectorAll('.leaderboard-list').forEach(function(list) {
    list.classList.remove('active');
  });
  el('leaderboard-' + type).classList.add('active');
  
  // Load data if not cached
  if (!leaderboardCache[type]) {
    loadLeaderboard(type);
  }
}

async function loadLeaderboard(type) {
  var container = el('leaderboard-' + type);
  container.innerHTML = '<div class="spinner"></div>';
  
  try {
    var data;
    
    if (type === 'points') {
      // Top players by PawketPoints (top 10)
      var res = await supabaseClient
        .from('players')
        .select('id, username, pawketpoints')
        .order('pawketpoints', { ascending: false })
        .limit(10);
      
      console.log('Leaderboard points query result:', res);
      
      if (res.error) throw res.error;
      
      // Filter out players with null usernames
      data = res.data
        .filter(function(p) { return p.username != null; })
        .map(function(p) {
          return {
            username: p.username,
            value: p.pawketpoints + ' PP',
            stat: p.pawketpoints + ' PawketPoints'
          };
        });
      
    } else if (type === 'pets') {
      // Top players by pet count
      var res = await supabaseClient.rpc('get_leaderboard_pets');
      
      if (res.error) {
        // Fallback if RPC doesn't exist - manual query
        var petsRes = await supabaseClient
          .from('user_pets')
          .select('user_id, players(username)');
        
        if (petsRes.error) throw petsRes.error;
        
        var counts = {};
        petsRes.data.forEach(function(pet) {
          var username = pet.players.username;
          counts[username] = (counts[username] || 0) + 1;
        });
        
        data = Object.entries(counts)
          .sort(function(a, b) { return b[1] - a[1]; })
          .slice(0, 10)
          .map(function(entry) {
            return {
              username: entry[0],
              value: entry[1] + ' pets',
              stat: entry[1] + ' pets owned'
            };
          });
      } else {
        data = res.data.map(function(p) {
          return {
            username: p.username,
            value: p.pet_count + ' pets',
            stat: p.pet_count + ' pets owned'
          };
        });
      }
      
    } else if (type === 'levels') {
      // Top players by total pet levels
      var res = await supabaseClient.rpc('get_leaderboard_levels');
      
      if (res.error) {
        // Fallback if RPC doesn't exist
        var levelsRes = await supabaseClient
          .from('user_pets')
          .select('user_id, level, players(username)');
        
        if (levelsRes.error) throw levelsRes.error;
        
        var totals = {};
        levelsRes.data.forEach(function(pet) {
          var username = pet.players.username;
          totals[username] = (totals[username] || 0) + pet.level;
        });
        
        data = Object.entries(totals)
          .sort(function(a, b) { return b[1] - a[1]; })
          .slice(0, 10)
          .map(function(entry) {
            return {
              username: entry[0],
              value: 'Lvl ' + entry[1],
              stat: 'Total level: ' + entry[1]
            };
          });
      } else {
        data = res.data.map(function(p) {
          return {
            username: p.username,
            value: 'Lvl ' + p.total_level,
            stat: 'Total level: ' + p.total_level
          };
        });
      }
    }
    
    else if (type === 'badges') {
      // Top players by badge count
      // Query both tables separately to avoid foreign key issues
      var badgesRes = await supabaseClient
        .from('user_badges')
        .select('user_id');
      
      if (badgesRes.error) throw badgesRes.error;
      
      // Count badges per user
      var badgeCounts = {};
      badgesRes.data.forEach(function(badge) {
        badgeCounts[badge.user_id] = (badgeCounts[badge.user_id] || 0) + 1;
      });
      
      // Get usernames for users with badges
      var userIds = Object.keys(badgeCounts);
      var usersRes = await supabaseClient
        .from('players')
        .select('id, username')
        .in('id', userIds);
      
      if (usersRes.error) throw usersRes.error;
      
      // Build leaderboard data
      data = usersRes.data
        .map(function(user) {
          return {
            username: user.username,
            count: badgeCounts[user.id],
            value: badgeCounts[user.id] + ' badges',
            stat: badgeCounts[user.id] + ' badges earned'
          };
        })
        .sort(function(a, b) { return b.count - a.count; })
        .slice(0, 10);
    }
    
    // Cache the data
    leaderboardCache[type] = data;
    
    // Render leaderboard
    if (data.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No data yet! Be the first! 🌟</p></div>';
      return;
    }
    
    var html = '';
    data.forEach(function(player, index) {
      // Skip players with null/undefined username
      if (!player.username) {
        console.warn('Skipping player with null username:', player);
        return;
      }
      
      var rank = index + 1;
      var rankClass = '';
      var rankEmoji = rank + '.';
      
      if (rank === 1) {
        rankClass = 'top1';
        rankEmoji = '🥇';
      } else if (rank === 2) {
        rankClass = 'top2';
        rankEmoji = '🥈';
      } else if (rank === 3) {
        rankClass = 'top3';
        rankEmoji = '🥉';
      }
      
      html += '<div class="leaderboard-item" onclick="viewProfile(\'' + escapeHtml(player.username) + '\')">';
      html += '  <div class="leaderboard-rank ' + rankClass + '">' + rankEmoji + '</div>';
      html += '  <div class="leaderboard-avatar">' + player.username.charAt(0).toUpperCase() + '</div>';
      html += '  <div class="leaderboard-info">';
      html += '    <div class="leaderboard-username">' + escapeHtml(player.username) + '</div>';
      html += '    <div class="leaderboard-stats">' + player.stat + '</div>';
      html += '  </div>';
      html += '  <div class="leaderboard-value">' + player.value + '</div>';
      html += '</div>';
    });
    
    container.innerHTML = html;
    
  } catch (err) {
    container.innerHTML = '<div class="empty-state"><p>Failed to load leaderboard: ' + err.message + '</p></div>';
  }
}

function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Load points leaderboard when tab is opened
tabsLoaded.leaderboard = function() {
  if (!leaderboardCache.points) {
    loadLeaderboard('points');
  }
};

// ══════════════════════════════════════════════════════════════════════════
// PUBLIC PROFILES
// ══════════════════════════════════════════════════════════════════════════

function viewProfile(username) {
  // Store the username and show profile tab
  window.currentProfileUsername = username;
  showTab('profile');
}

async function loadProfile(username) {
  console.log('[loadProfile] Starting for username:', username);
  
  // Set loading states immediately
  el('profile-username').textContent = 'Loading...';
  el('profile-pet-count').textContent = '...';
  el('profile-total-level').textContent = '...';
  el('profile-rank').textContent = '...';
  el('profile-badge-count').textContent = '...';
  el('profile-pets-grid').innerHTML = '<div class="spinner"></div>';
  
  try {
    // Get profile data
    console.log('[loadProfile] Calling RPC get_player_profile...');
    var profileRes = await supabaseClient.rpc('get_player_profile', { p_username: username });
    
    console.log('[loadProfile] RPC result:', profileRes);
    
    if (profileRes.error || !profileRes.data || profileRes.data.length === 0) {
      console.log('Using fallback query, RPC error:', profileRes.error);
      // Fallback if RPC doesn't exist
      var playerRes = await supabaseClient
        .from('players')
        .select('id, username, pawketpoints, created_at, bio')
        .ilike('username', username)
        .single();
      
      console.log('Player query result:', playerRes);
      
      if (playerRes.error) {
        console.error('Player query failed:', playerRes.error);
        throw new Error('Player "' + username + '" not found. Error: ' + playerRes.error.message);
      }
      
      if (!playerRes.data) {
        throw new Error('Player "' + username + '" does not exist in the database.');
      }
      
      var player = playerRes.data;
      
      // Get pet stats separately
      var petsRes = await supabaseClient
        .from('user_pets')
        .select('level')
        .eq('user_id', player.id);
      
      console.log('Pets query result:', petsRes);
      
      var totalPets = petsRes.data ? petsRes.data.length : 0;
      var totalLevels = petsRes.data ? petsRes.data.reduce(function(sum, p) { return sum + p.level; }, 0) : 0;
      var highestLevel = petsRes.data && petsRes.data.length > 0 ? Math.max(...petsRes.data.map(function(p) { return p.level; })) : 0;
      
      profileRes.data = [{
        id: player.id,
        username: player.username,
        pawketpoints: player.pawketpoints,
        created_at: player.created_at,
        bio: player.bio,
        total_pets: totalPets,
        total_levels: totalLevels,
        highest_level: highestLevel
      }];
    }
    
    var profile = profileRes.data[0];
    console.log('Final profile data:', profile);
    
    // If RPC didn't include pet stats, calculate them
    if (profile.total_pets === undefined || profile.total_pets === null) {
      console.log('Pet stats missing, calculating manually...');
      var petsRes = await supabaseClient
        .from('user_pets')
        .select('level')
        .eq('user_id', profile.id);
      
      console.log('Manual pets query:', petsRes);
      
      profile.total_pets = petsRes.data ? petsRes.data.length : 0;
      profile.total_levels = petsRes.data ? petsRes.data.reduce(function(sum, p) { return sum + (p.level || 0); }, 0) : 0;
    }
    
    // Update UI
    console.log('[loadProfile] Updating UI with profile data:', profile);
    el('profile-avatar').textContent = profile.username.charAt(0).toUpperCase();
    el('profile-username').textContent = profile.username;
    el('profile-bio').textContent = profile.bio || 'No bio yet';
    
    var joinDate = new Date(profile.created_at);
    el('profile-joined').textContent = 'Joined: ' + joinDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    console.log('[loadProfile] Setting stats - Points:', profile.pawketpoints, 'Pets:', profile.total_pets, 'Levels:', profile.total_levels);
    el('profile-points').textContent = (profile.pawketpoints || 0).toLocaleString();
    el('profile-pet-count').textContent = profile.total_pets || 0;
    el('profile-total-level').textContent = profile.total_levels || 0;
    
    // Get their rank
    var rankRes = await supabaseClient
      .from('players')
      .select('pawketpoints')
      .order('pawketpoints', { ascending: false });
    
    if (!rankRes.error && rankRes.data) {
      var rank = rankRes.data.findIndex(function(p) { return p.pawketpoints <= profile.pawketpoints; }) + 1;
      el('profile-rank').textContent = '#' + rank;
    } else {
      el('profile-rank').textContent = '-';
    }
    
    // Load their pets
    var petsGrid = el('profile-pets-grid');
    petsGrid.innerHTML = '<div class="spinner"></div>';
    
    console.log('[loadProfile] Loading pets for user_id:', profile.id);
    
    var petsRes = await supabaseClient
      .from('user_pets')
      .select('*, pets(name, image_file, vtuber_name)')
      .eq('user_id', profile.id)
      .order('adopted_at', { ascending: true });
    
    console.log('[loadProfile] Pets query result:', petsRes);
    
    if (petsRes.error) throw petsRes.error;
    
    if (petsRes.data.length === 0) {
      petsGrid.innerHTML = '<div class="empty-state"><p>No pets yet! 🐾</p></div>';
      return;
    }
    
    // Render pets
    var html = '';
    petsRes.data.forEach(function(userPet) {
      var pet = userPet.pets;
      var mood = getPetMood(userPet.hunger, userPet.energy, userPet.happiness);
      var displayName = userPet.nickname || pet.name;
      
      html += '<div class="pet-card">';
      html += '  <div class="pet-card-image">';
      html += '    <img src="images/pets/' + pet.image_file + '" alt="' + pet.name + '" />';
      html += '  </div>';
      html += '  <div class="pet-card-body">';
      html += '    <div class="pet-card-header">';
      html += '      <h3>' + escapeHtml(displayName) + '</h3>';
      html += '      <span class="pet-level">Lv ' + userPet.level + '</span>';
      html += '    </div>';
      html += '    <div class="pet-mood-display" style="border-color: ' + mood.color + '; background: ' + mood.color + '22;">';
      html += '      <span style="font-size: 1.2rem;">' + mood.emoji + '</span>';
      html += '      <span>Mood: ' + mood.mood + '</span>';
      html += '    </div>';
      html += '  </div>';
      html += '</div>';
    });
    
    petsGrid.innerHTML = html;
    
    // Load badges
    await loadProfileBadges(profile.id);
    
  } catch (err) {
    el('profile-username').textContent = 'Error loading profile';
    el('profile-pets-grid').innerHTML = '<div class="empty-state"><p>' + err.message + '</p></div>';
  }
}

// Load profile when tab is opened
tabsLoaded.profile = function() {
  if (window.currentProfileUsername) {
    loadProfile(window.currentProfileUsername);
  }
};

// ══════════════════════════════════════════════════════════════
// MY PROFILE (Edit Own Profile)
// ══════════════════════════════════════════════════════════════

async function loadMyProfile() {
  console.log('[loadMyProfile] Starting...');
  if (!currentUser) {
    console.error('[loadMyProfile] No currentUser!');
    return;
  }
  
  try {
    console.log('[loadMyProfile] Fetching player data for user:', currentUser.id);
    // Get player data
    var res = await supabaseClient
      .from('players')
      .select('*')
      .eq('id', currentUser.id)
      .single();
    
    console.log('[loadMyProfile] Player data result:', res);
    
    if (res.error) throw res.error;
    var player = res.data;
    
    // Get pet count and levels
    var petsRes = await supabaseClient
      .from('user_pets')
      .select('level')
      .eq('user_id', currentUser.id);
    
    var totalPets = petsRes.data ? petsRes.data.length : 0;
    var totalLevels = petsRes.data ? petsRes.data.reduce(function(sum, p) { return sum + p.level; }, 0) : 0;
    
    // Update preview
    var username = player.username || 'User';
    el('myprofile-avatar-preview').textContent = username.charAt(0).toUpperCase();
    el('myprofile-username-preview').textContent = username;
    el('myprofile-bio-preview').textContent = player.bio || 'No bio yet';
    
    var joinDate = new Date(player.created_at).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    el('myprofile-joined-preview').textContent = 'Joined: ' + joinDate;
    
    // Update form
    el('edit-username').value = username;
    el('edit-bio').value = player.bio || '';
    
    // Update stats
    el('myprofile-points').textContent = player.pawketpoints || 0;
    el('myprofile-pets').textContent = totalPets;
    el('myprofile-levels').textContent = totalLevels;
    
    // Get rank from leaderboard
    var rankRes = await supabaseClient
      .from('players')
      .select('id, pawketpoints')
      .order('pawketpoints', { ascending: false });
    
    if (rankRes.data) {
      var rank = rankRes.data.findIndex(function(p) { return p.id === currentUser.id; }) + 1;
      el('myprofile-rank').textContent = rank > 0 ? '#' + rank : '-';
    }
    
    // Load badges
    console.log('[loadMyProfile] About to load badges...');
    try {
      await loadMyProfileBadges();
      console.log('[loadMyProfile] Badges loaded successfully');
    } catch (badgeErr) {
      console.error('[loadMyProfile] Error loading badges:', badgeErr);
    }
    
  } catch (err) {
    console.error('Error loading profile:', err);
    el('myprofile-username-preview').textContent = 'Error loading profile';
    el('myprofile-joined-preview').textContent = 'Please refresh the page';
  }
}

async function loadMyProfileBadges() {
  console.log('[loadMyProfileBadges] Function called!');
  var badgesGrid = el('myprofile-badges-grid');
  console.log('[loadMyProfileBadges] Badge grid element:', badgesGrid);
  
  if (!badgesGrid) {
    console.error('[loadMyProfileBadges] Grid element not found!');
    return;
  }
  
  badgesGrid.innerHTML = '<div class="spinner"></div>';
  
  // Get all badges
  var allBadgesRes = await supabaseClient
    .from('badges')
    .select('*')
    .order('sort_order', { ascending: true });
  
  // Get user's earned badges
  var earnedRes = await supabaseClient
    .from('user_badges')
    .select('badge_id, earned_at, badges(*)')
    .eq('user_id', currentUser.id);
  
  if (allBadgesRes.error || earnedRes.error) {
    badgesGrid.innerHTML = '<p style="text-align:center;color:var(--text-light);">Error loading badges</p>';
    return;
  }
  
  var allBadges = allBadgesRes.data;
  var earnedBadgeIds = earnedRes.data.map(b => b.badge_id);
  var earnedBadgesMap = {};
  earnedRes.data.forEach(b => {
    earnedBadgesMap[b.badge_id] = b.earned_at;
  });
  
  // Update badge count
  el('myprofile-badges').textContent = earnedBadgeIds.length;
  
  badgesGrid.innerHTML = '';
  
  allBadges.forEach(function(badge) {
    var isEarned = earnedBadgeIds.includes(badge.id);
    var card = makeEl('div', { class: 'badge-card' + (isEarned ? '' : ' locked') });
    
    if (badge.rarity && badge.rarity !== 'common') {
      var rarityBadge = makeEl('div', { class: 'badge-rarity ' + badge.rarity });
      rarityBadge.textContent = badge.rarity;
      card.appendChild(rarityBadge);
    }
    
    var icon = makeEl('div', { class: 'badge-icon' });
    icon.textContent = badge.icon;
    card.appendChild(icon);
    
    var name = makeEl('div', { class: 'badge-name' });
    name.textContent = isEarned ? badge.name : '???';
    card.appendChild(name);
    
    var desc = makeEl('div', { class: 'badge-description' });
    desc.textContent = isEarned ? badge.description : 'Not yet earned';
    card.appendChild(desc);
    
    if (isEarned && earnedBadgesMap[badge.id]) {
      var earnedDate = new Date(earnedBadgesMap[badge.id]);
      var dateStr = earnedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      var dateEl = makeEl('div', { class: 'badge-earned-date' });
      dateEl.textContent = 'Earned ' + dateStr;
      card.appendChild(dateEl);
    }
    
    badgesGrid.appendChild(card);
  });
}

async function saveProfile() {
  if (!currentUser) return;
  
  var errorEl = el('profile-edit-error');
  var successEl = el('profile-edit-success');
  var saveBtn = el('save-profile-btn');
  
  errorEl.style.display = 'none';
  successEl.style.display = 'none';
  
  // Show loading state
  var originalBtnText = saveBtn.innerHTML;
  saveBtn.innerHTML = '⏳ Saving...';
  saveBtn.disabled = true;
  saveBtn.style.opacity = '0.6';
  
  var newUsername = el('edit-username').value.trim();
  var newBio = el('edit-bio').value.trim();
  
  // Validation
  if (!newUsername) {
    errorEl.textContent = 'Username cannot be empty!';
    errorEl.style.display = 'block';
    saveBtn.innerHTML = originalBtnText;
    saveBtn.disabled = false;
    saveBtn.style.opacity = '1';
    return;
  }
  
  if (newUsername.length > 20) {
    errorEl.textContent = 'Username must be 20 characters or less!';
    errorEl.style.display = 'block';
    saveBtn.innerHTML = originalBtnText;
    saveBtn.disabled = false;
    saveBtn.style.opacity = '1';
    return;
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
    errorEl.textContent = 'Username can only contain letters, numbers, and underscores!';
    errorEl.style.display = 'block';
    saveBtn.innerHTML = originalBtnText;
    saveBtn.disabled = false;
    saveBtn.style.opacity = '1';
    return;
  }
  
  if (newBio.length > 200) {
    errorEl.textContent = 'Bio must be 200 characters or less!';
    errorEl.style.display = 'block';
    saveBtn.innerHTML = originalBtnText;
    saveBtn.disabled = false;
    saveBtn.style.opacity = '1';
    return;
  }
  
  try {
    // Check if username is taken (if changed)
    var currentUsername = el('myprofile-username-preview').textContent;
    if (newUsername !== currentUsername) {
      var checkRes = await supabaseClient
        .from('players')
        .select('id')
        .ilike('username', newUsername)
        .neq('id', currentUser.id);
      
      if (checkRes.data && checkRes.data.length > 0) {
        errorEl.textContent = 'Username "' + newUsername + '" is already taken!';
        errorEl.style.display = 'block';
        saveBtn.innerHTML = originalBtnText;
        saveBtn.disabled = false;
        saveBtn.style.opacity = '1';
        return;
      }
    }
    
    // Update username and bio
    var updateRes = await supabaseClient
      .from('players')
      .update({ username: newUsername, bio: newBio })
      .eq('id', currentUser.id);
    
    if (updateRes.error) throw updateRes.error;
    
    // Update preview
    el('myprofile-username-preview').textContent = newUsername;
    el('myprofile-avatar-preview').textContent = newUsername.charAt(0).toUpperCase();
    el('myprofile-bio-preview').textContent = newBio || 'No bio yet';
    
    // Update header
    el('nav-user').textContent = newUsername;
    
    // Restore button state
    saveBtn.innerHTML = '✅ Saved!';
    saveBtn.disabled = false;
    saveBtn.style.opacity = '1';
    
    // Reset button after 2 seconds
    setTimeout(function() {
      saveBtn.innerHTML = originalBtnText;
    }, 2000);
    
    // Show success message with animation
    successEl.innerHTML = '✅ <strong>Profile saved successfully!</strong> Your changes are now visible.';
    successEl.style.display = 'block';
    successEl.style.animation = 'none';
    setTimeout(function() {
      successEl.style.animation = 'slideInDown 0.3s ease-out';
    }, 10);
    
    // Scroll to success message
    successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Hide success message after 5 seconds
    setTimeout(function() {
      successEl.style.opacity = '0';
      successEl.style.transition = 'opacity 0.3s ease-out';
      setTimeout(function() {
        successEl.style.display = 'none';
        successEl.style.opacity = '1';
      }, 300);
    }, 5000);
    
  } catch (err) {
    console.error('Error saving profile:', err);
    errorEl.textContent = 'Failed to save profile: ' + err.message;
    errorEl.style.display = 'block';
    
    // Restore button state
    saveBtn.innerHTML = originalBtnText;
    saveBtn.disabled = false;
    saveBtn.style.opacity = '1';
  }
}

async function viewMyPublicProfile() {
  if (!currentUser) return;
  
  // Get username from database instead of preview element
  var res = await supabaseClient
    .from('players')
    .select('username')
    .eq('id', currentUser.id)
    .single();
  
  if (res.data && res.data.username) {
    viewProfile(res.data.username);
  }
}

// Load profile data when tab is shown
tabsLoaded.myprofile = function() {
  loadMyProfile();
};

initApp();

async function loadProfileBadges(userId) {
  var badgesGrid = el('profile-badges-grid');
  badgesGrid.innerHTML = '<div class="spinner"></div>';
  
  var earnedRes = await supabaseClient
    .from('user_badges')
    .select('badge_id, earned_at, badges(*)')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false});
  
  if (earnedRes.error) {
    badgesGrid.innerHTML = '<p style="text-align:center;color:var(--text-light);">Error loading badges</p>';
    return;
  }
  
  console.log('[loadProfileBadges] Loading badges for userId:', userId);
  console.log('[loadProfileBadges] Found', earnedRes.data.length, 'badges');
  
  el('profile-badge-count').textContent = earnedRes.data.length;
  
  if (earnedRes.data.length === 0) {
    badgesGrid.innerHTML = '<div class="empty-state"><p>No badges earned yet! 🎖️</p></div>';
    return;
  }
  
  badgesGrid.innerHTML = '';
  
  earnedRes.data.forEach(function(userBadge) {
    var badge = userBadge.badges;
    var card = makeEl('div', { class: 'badge-card' });
    
    if (badge.rarity && badge.rarity !== 'common') {
      var rarityBadge = makeEl('div', { class: 'badge-rarity ' + badge.rarity });
      rarityBadge.textContent = badge.rarity;
      card.appendChild(rarityBadge);
    }
    
    var icon = makeEl('div', { class: 'badge-icon' });
    icon.textContent = badge.icon;
    card.appendChild(icon);
    
    var name = makeEl('div', { class: 'badge-name' });
    name.textContent = badge.name;
    card.appendChild(name);
    
    var desc = makeEl('div', { class: 'badge-description' });
    desc.textContent = badge.description;
    card.appendChild(desc);
    
    var earnedDate = new Date(userBadge.earned_at);
    var dateStr = earnedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    var dateEl = makeEl('div', { class: 'badge-earned-date' });
    dateEl.textContent = 'Earned ' + dateStr;
    card.appendChild(dateEl);
    
    badgesGrid.appendChild(card);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// EQUIPMENT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

var currentEquipmentFilter = 'all';

async function loadEquipmentShop() {
  var grid = el('equipment-shop-grid');
  grid.innerHTML = '<div class="spinner"></div>';
  
  var query = supabaseClient
    .from('equipment')
    .select('*')
    .order('tier', { ascending: true })
    .order('price', { ascending: true });
  
  if (currentEquipmentFilter !== 'all') {
    query = query.eq('equipment_type', currentEquipmentFilter);
  }
  
  var res = await query;
  
  if (res.error) {
    grid.innerHTML = '<p style="text-align:center;color:var(--text-light);">Error loading equipment</p>';
    return;
  }
  
  if (res.data.length === 0) {
    grid.innerHTML = '<div class="empty-state"><p>No equipment available! 🗡️</p></div>';
    return;
  }
  
  grid.innerHTML = '';
  
  // Group items by tier
  var tiers = {};
  res.data.forEach(function(item) {
    if (!tiers[item.tier]) {
      tiers[item.tier] = [];
    }
    tiers[item.tier].push(item);
  });
  
  // Render each tier with headers
  Object.keys(tiers).sort(function(a, b) { return parseInt(a) - parseInt(b); }).forEach(function(tier) {
    // Tier header
    var header = makeEl('div', { class: 'shop-category-header' });
    header.style.cssText = 'grid-column: 1 / -1; padding: 15px 20px; margin-top: 10px; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); border-radius: 12px; color: white; font-weight: bold; font-size: 18px;';
    header.textContent = '⚔️ Tier ' + tier;
    grid.appendChild(header);
    
    // Items in this tier
    tiers[tier].forEach(function(item) {
      var card = makeEl('div', { class: 'equipment-card' });
    
    // Tier badge
    var tierBadge = makeEl('div', { class: 'equipment-tier' });
    tierBadge.textContent = 'Tier ' + item.tier;
    card.appendChild(tierBadge);
    
    // Weight class badge
    var weightBadge = makeEl('div', { class: 'equipment-weight weight-' + item.weight_class });
    weightBadge.textContent = item.weight_class;
    card.appendChild(weightBadge);
    
    // Icon (weapon or armor emoji)
    var icon = makeEl('div', { class: 'equipment-icon' });
    icon.textContent = item.equipment_type === 'weapon' ? '⚔️' : '🛡️';
    card.appendChild(icon);
    
    // Name
    var name = makeEl('div', { class: 'equipment-name' });
    name.textContent = item.name;
    card.appendChild(name);
    
    // Description
    var desc = makeEl('div', { class: 'equipment-desc' });
    desc.textContent = item.description;
    card.appendChild(desc);
    
    // Stats
    var statsDiv = makeEl('div', { class: 'equipment-stats' });
    if (item.attack_bonus !== 0) {
      var attackStat = makeEl('div', { class: 'equipment-stat' });
      attackStat.innerHTML = '<span>Attack:</span><span class="' + (item.attack_bonus > 0 ? 'equipment-stat-positive' : 'equipment-stat-negative') + '">' + (item.attack_bonus > 0 ? '+' : '') + item.attack_bonus + '</span>';
      statsDiv.appendChild(attackStat);
    }
    if (item.defense_bonus !== 0) {
      var defStat = makeEl('div', { class: 'equipment-stat' });
      defStat.innerHTML = '<span>Defense:</span><span class="' + (item.defense_bonus > 0 ? 'equipment-stat-positive' : 'equipment-stat-negative') + '">' + (item.defense_bonus > 0 ? '+' : '') + item.defense_bonus + '</span>';
      statsDiv.appendChild(defStat);
    }
    if (item.speed_bonus !== 0) {
      var speedStat = makeEl('div', { class: 'equipment-stat' });
      speedStat.innerHTML = '<span>Speed:</span><span class="' + (item.speed_bonus > 0 ? 'equipment-stat-positive' : 'equipment-stat-negative') + '">' + (item.speed_bonus > 0 ? '+' : '') + item.speed_bonus + '</span>';
      statsDiv.appendChild(speedStat);
    }
    if (item.hp_bonus !== 0) {
      var hpStat = makeEl('div', { class: 'equipment-stat' });
      hpStat.innerHTML = '<span>HP:</span><span class="' + (item.hp_bonus > 0 ? 'equipment-stat-positive' : 'equipment-stat-negative') + '">' + (item.hp_bonus > 0 ? '+' : '') + item.hp_bonus + '</span>';
      statsDiv.appendChild(hpStat);
    }
    card.appendChild(statsDiv);
    
    // Price
    var price = makeEl('div', { class: 'equipment-price' });
    price.textContent = item.price + ' PP';
    card.appendChild(price);
    
    // Buy button
    var buyBtn = makeEl('button', { class: 'btn btn-primary' });
    buyBtn.textContent = 'Buy';
    buyBtn.onclick = function() { buyEquipment(item.id, item.name, item.price); };
    card.appendChild(buyBtn);
    
    grid.appendChild(card);
    }); // Close items forEach
  }); // Close tiers forEach
}

async function buyEquipment(equipmentId, equipmentName, price) {
  if (!currentUser) return;
  if (currentPoints < price) {
    showToast('Not enough PawketPoints!');
    return;
  }
  
  // Deduct points
  var newPoints = currentPoints - price;
  
  // Get current total_spent
  var playerRes = await supabaseClient.from('players').select('total_spent').eq('id', currentUser.id).single();
  var newTotalSpent = (playerRes.data?.total_spent || 0) + price;
  
  var updateRes = await supabaseClient
    .from('players')
    .update({ 
      pawketpoints: newPoints,
      total_spent: newTotalSpent
    })
    .eq('id', currentUser.id);
  
  if (updateRes.error) {
    showToast('Error deducting points!');
    return;
  }
  
  // Check spending badges
  if (newTotalSpent >= 500) {
    await awardBadge('mega_spender');
  } else if (newTotalSpent >= 100) {
    await awardBadge('big_spender');
  }
  
  // Add to player equipment
  var existingRes = await supabaseClient
    .from('player_equipment')
    .select('id, quantity')
    .eq('user_id', currentUser.id)
    .eq('equipment_id', equipmentId)
    .limit(1);
  
  if (existingRes.data && existingRes.data.length > 0) {
    // Already owns - increase quantity
    await supabaseClient
      .from('player_equipment')
      .update({ quantity: existingRes.data[0].quantity + 1 })
      .eq('id', existingRes.data[0].id);
  } else {
    // New purchase
    var insertRes = await supabaseClient
      .from('player_equipment')
      .insert([{ 
        user_id: currentUser.id, 
        equipment_id: equipmentId,
        quantity: 1
      }]);
    
    if (insertRes.error) {
      showToast('Purchase failed!');
      return;
    }
  }
  
  updateAllPoints(newPoints);
  showToast('Bought ' + equipmentName + '!');
  loadEquipmentShop();
}

function filterEquipment(type) {
  currentEquipmentFilter = type;
  
  // Update active tab
  var tabs = document.querySelectorAll('.filter-tab');
  tabs.forEach(function(tab) {
    tab.classList.remove('active');
  });
  event.target.classList.add('active');
  
  loadEquipmentShop();
}

async function loadPetEquipment(petId) {
  // Get equipped items for this pet
  var res = await supabaseClient
    .from('player_equipment')
    .select('equipment_id, equipped_slot, equipment(*)')
    .eq('user_id', currentUser.id)
    .eq('is_equipped', true);
  
  if (res.error) return { weapon: null, armor: null };
  
  var weapon = null;
  var armor = null;
  
  res.data.forEach(function(item) {
    if (item.equipped_slot === 'weapon') {
      weapon = item.equipment;
    } else if (item.equipped_slot === 'armor') {
      armor = item.equipment;
    }
  });
  
  return { weapon: weapon, armor: armor };
}

async function showEquipmentModal(petId) {
  console.log('=== EQUIPMENT MODAL DEBUG ===');
  console.log('Opening equipment modal for pet:', petId);
  
  try {
    // Get pet's current equipment
    var equipped = await loadPetEquipment(petId);
    console.log('Currently equipped:', equipped);
    
    // Get all owned equipment
    var allEquipRes = await supabaseClient
      .from('player_equipment')
      .select('*, equipment(*)')
      .eq('user_id', currentUser.id)
      .gt('quantity', 0);
    
    console.log('All owned equipment:', allEquipRes);
    
    if (allEquipRes.error) {
      console.error('Error loading equipment:', allEquipRes.error);
      showToast('Error loading equipment!');
      return;
    }
    
    if (!allEquipRes.data || allEquipRes.data.length === 0) {
      showToast('You don\'t own any equipment yet! Visit the shop to buy some.');
      return;
    }
  
  console.log('Creating modal...');
  
  // Create modal with !important inline styles to override any CSS
  var modal = makeEl('div', { class: 'equipment-modal-dynamic' });
  modal.style.cssText = 'position:fixed !important;top:0 !important;left:0 !important;right:0 !important;bottom:0 !important;width:100vw !important;height:100vh !important;background:rgba(0,0,0,0.8) !important;display:flex !important;align-items:center !important;justify-content:center !important;z-index:999999 !important;';
  modal.id = 'equipment-modal-' + Date.now();
  console.log('Modal overlay created:', modal);
  console.log('Modal styles:', modal.style.cssText);
  
  modal.onclick = function(e) { 
    if (e.target === modal) {
      document.body.removeChild(modal); 
    }
  };
  
  var modalContent = makeEl('div', { class: 'equipment-modal-content' });
  modalContent.style.cssText = 'background:white !important;border-radius:16px !important;padding:30px !important;max-width:600px !important;width:90% !important;max-height:80vh !important;overflow-y:auto !important;box-shadow:0 8px 32px rgba(0,0,0,0.3) !important;position:relative !important;z-index:1000000 !important;display:block !important;';
  modalContent.onclick = function(e) { e.stopPropagation(); };
  
  var title = makeEl('h2');
  title.textContent = 'Manage Equipment';
  modalContent.appendChild(title);
  
  console.log('Modal content created');
  
  // Equipment slots display
  var slotsDiv = makeEl('div', { class: 'equipment-slots' });
  
  // Weapon slot
  var weaponSlot = makeEl('div', { class: 'equipment-slot' + (equipped.weapon ? ' equipped' : '') });
  var weaponLabel = makeEl('div', { class: 'equipment-slot-label' });
  weaponLabel.textContent = '⚔️ Weapon';
  weaponSlot.appendChild(weaponLabel);
  
  if (equipped.weapon) {
    var weaponIcon = makeEl('div', { class: 'equipment-slot-icon' });
    weaponIcon.textContent = '⚔️';
    weaponSlot.appendChild(weaponIcon);
    
    var weaponName = makeEl('div', { class: 'equipment-slot-name' });
    weaponName.textContent = equipped.weapon.name;
    weaponSlot.appendChild(weaponName);
    
    // Show stat bonuses
    var bonuses = [];
    if (equipped.weapon.attack_bonus) bonuses.push('+' + equipped.weapon.attack_bonus + ' ATK');
    if (equipped.weapon.defense_bonus) bonuses.push('+' + equipped.weapon.defense_bonus + ' DEF');
    if (equipped.weapon.speed_bonus) bonuses.push('+' + equipped.weapon.speed_bonus + ' SPD');
    if (equipped.weapon.hp_bonus) bonuses.push('+' + equipped.weapon.hp_bonus + ' HP');
    if (bonuses.length > 0) {
      var bonusText = makeEl('div', { class: 'equipment-slot-bonus' });
      bonusText.style.cssText = 'font-size:0.75rem;color:#666;margin-top:4px;';
      bonusText.textContent = bonuses.join(', ');
      weaponSlot.appendChild(bonusText);
    }
    
    var unequipBtn = makeEl('button', { class: 'btn btn-sm btn-unequip' });
    unequipBtn.textContent = 'Unequip';
    unequipBtn.onclick = function() { 
      unequipItem('weapon');
      document.body.removeChild(modal);
    };
    weaponSlot.appendChild(unequipBtn);
  } else {
    var emptyText = makeEl('div', { class: 'equipment-slot-empty' });
    emptyText.textContent = 'No weapon equipped';
    weaponSlot.appendChild(emptyText);
  }
  slotsDiv.appendChild(weaponSlot);
  
  // Armor slot
  var armorSlot = makeEl('div', { class: 'equipment-slot' + (equipped.armor ? ' equipped' : '') });
  var armorLabel = makeEl('div', { class: 'equipment-slot-label' });
  armorLabel.textContent = '🛡️ Armor';
  armorSlot.appendChild(armorLabel);
  
  if (equipped.armor) {
    var armorIcon = makeEl('div', { class: 'equipment-slot-icon' });
    armorIcon.textContent = '🛡️';
    armorSlot.appendChild(armorIcon);
    
    var armorName = makeEl('div', { class: 'equipment-slot-name' });
    armorName.textContent = equipped.armor.name;
    armorSlot.appendChild(armorName);
    
    // Show stat bonuses
    var bonuses = [];
    if (equipped.armor.attack_bonus) bonuses.push('+' + equipped.armor.attack_bonus + ' ATK');
    if (equipped.armor.defense_bonus) bonuses.push('+' + equipped.armor.defense_bonus + ' DEF');
    if (equipped.armor.speed_bonus) bonuses.push('+' + equipped.armor.speed_bonus + ' SPD');
    if (equipped.armor.hp_bonus) bonuses.push('+' + equipped.armor.hp_bonus + ' HP');
    if (bonuses.length > 0) {
      var bonusText = makeEl('div', { class: 'equipment-slot-bonus' });
      bonusText.style.cssText = 'font-size:0.75rem;color:#666;margin-top:4px;';
      bonusText.textContent = bonuses.join(', ');
      armorSlot.appendChild(bonusText);
    }
    
    var unequipBtn2 = makeEl('button', { class: 'btn btn-sm btn-unequip' });
    unequipBtn2.textContent = 'Unequip';
    unequipBtn2.onclick = function() { 
      unequipItem('armor');
      document.body.removeChild(modal);
    };
    armorSlot.appendChild(unequipBtn2);
  } else {
    var emptyText2 = makeEl('div', { class: 'equipment-slot-empty' });
    emptyText2.textContent = 'No armor equipped';
    armorSlot.appendChild(emptyText2);
  }
  slotsDiv.appendChild(armorSlot);
  
  modalContent.appendChild(slotsDiv);
  
  // List available equipment to equip
  var availableTitle = makeEl('h3');
  availableTitle.textContent = 'Available Equipment';
  availableTitle.style.marginTop = '20px';
  modalContent.appendChild(availableTitle);
  
  var equipGrid = makeEl('div', { class: 'shop-grid' });
  
  allEquipRes.data.forEach(function(playerEquip) {
    var item = playerEquip.equipment;
    var card = makeEl('div', { class: 'equipment-card' });
    card.style.cssText = 'font-size:0.85rem;padding:15px;border:2px solid var(--purple-light);border-radius:12px;text-align:center;';
    
    var icon = makeEl('div', { class: 'equipment-icon' });
    icon.style.fontSize = '2.5rem';
    icon.textContent = item.equipment_type === 'weapon' ? '⚔️' : '🛡️';
    card.appendChild(icon);
    
    var name = makeEl('div', { class: 'equipment-name' });
    name.style.cssText = 'font-weight:bold;color:var(--purple);margin:8px 0;';
    name.textContent = item.name;
    card.appendChild(name);
    
    // Show stat bonuses
    var bonuses = [];
    if (item.attack_bonus) bonuses.push('+' + item.attack_bonus + ' ATK');
    if (item.defense_bonus) bonuses.push('+' + item.defense_bonus + ' DEF');
    if (item.speed_bonus) bonuses.push('+' + item.speed_bonus + ' SPD');
    if (item.hp_bonus) bonuses.push('+' + item.hp_bonus + ' HP');
    if (bonuses.length > 0) {
      var bonusDiv = makeEl('div', { class: 'equipment-bonuses' });
      bonusDiv.style.cssText = 'font-size:0.75rem;color:#5dde7a;margin:8px 0;';
      bonusDiv.textContent = bonuses.join(', ');
      card.appendChild(bonusDiv);
    }
    
    var equipBtn = makeEl('button', { class: 'btn btn-sm btn-primary' });
    equipBtn.textContent = 'Equip';
    equipBtn.style.marginTop = '10px';
    equipBtn.onclick = function() { 
      equipItem(playerEquip.id, item.equipment_type);
      document.body.removeChild(modal);
    };
    card.appendChild(equipBtn);
    
    equipGrid.appendChild(card);
  });
  
  modalContent.appendChild(equipGrid);
  
  var closeBtn = makeEl('button', { class: 'btn btn-outline' });
  closeBtn.textContent = 'Close';
  closeBtn.style.marginTop = '20px';
  closeBtn.onclick = function() { document.body.removeChild(modal); };
  modalContent.appendChild(closeBtn);
  
  console.log('About to append modal to body...');
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  console.log('Modal appended! Should be visible now.');
  console.log('Modal element in DOM:', document.getElementById(modal.id));
  console.log('Modal computed style display:', window.getComputedStyle(modal).display);
  console.log('Modal computed style z-index:', window.getComputedStyle(modal).zIndex);
  } catch (error) {
    console.error('Error in showEquipmentModal:', error);
    showToast('Error opening equipment manager!');
  }
}

async function equipItem(playerEquipmentId, equipmentType) {
  // Unequip any existing item in that slot
  await supabaseClient
    .from('player_equipment')
    .update({ is_equipped: false, equipped_slot: null })
    .eq('user_id', currentUser.id)
    .eq('equipped_slot', equipmentType);
  
  // Equip new item
  await supabaseClient
    .from('player_equipment')
    .update({ is_equipped: true, equipped_slot: equipmentType })
    .eq('id', playerEquipmentId);
  
  showToast('Equipment equipped!');
  tabsLoaded['mypets'] = false;
  loadMyPets();
}

async function unequipItem(slot) {
  await supabaseClient
    .from('player_equipment')
    .update({ is_equipped: false, equipped_slot: null })
    .eq('user_id', currentUser.id)
    .eq('equipped_slot', slot);
  
  showToast('Equipment unequipped!');
  tabsLoaded['mypets'] = false;
  loadMyPets();
}

// ═══════════════════════════════════════════════════════════════════════════
// BATTLE SYSTEM - Auto-Battle Engine
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate pet's total stats including equipment bonuses
 */
async function calculatePetStats(petId) {
  // Get pet base stats including special skill
  var petRes = await supabaseClient
    .from('user_pets')
    .select('*, pets!inner(name, image_file, special_skill)')
    .eq('id', petId)
    .single();
  
  if (petRes.error) return null;
  
  var pet = petRes.data;
  
  // Determine evolution stage based on level
  var evolutionStage = getEvolutionStage(pet.level);
  var evolutionBonuses = getEvolutionBonuses(evolutionStage);
  
  // Calculate max HP from base + evolution + equipment
  var maxHP = (pet.base_hp || 30) + evolutionBonuses.hp;
  
  // Get equipped items
  var equipRes = await supabaseClient
    .from('player_equipment')
    .select('equipment(*)')
    .eq('user_id', currentUser.id)
    .eq('is_equipped', true);
  
  if (!equipRes.error && equipRes.data) {
    equipRes.data.forEach(function(item) {
      var equip = item.equipment;
      maxHP += equip.hp_bonus || 0;
    });
  }
  
  // Update max_hp in database if changed
  if (pet.max_hp !== maxHP) {
    await supabaseClient
      .from('user_pets')
      .update({ max_hp: maxHP })
      .eq('id', petId);
  }
  
  // Use current_hp if available (even if 0!), otherwise use maxHP for new pets
  var currentHP = (pet.current_hp !== null && pet.current_hp !== undefined) ? pet.current_hp : maxHP;
  
  console.log('📊 Pet HP loaded:', {
    petId: petId,
    current_hp_from_db: pet.current_hp,
    maxHP: maxHP,
    currentHP_calculated: currentHP
  });
  
  // Make sure current_hp doesn't exceed max_hp
  if (currentHP > maxHP) {
    currentHP = maxHP;
    await supabaseClient
      .from('user_pets')
      .update({ current_hp: maxHP })
      .eq('id', petId);
  }
  
  var stats = {
    hp: currentHP,  // Start battle with current HP, not full HP!
    maxHP: maxHP,
    attack: (pet.base_attack || 5) + evolutionBonuses.attack,
    defense: (pet.base_defense || 3) + evolutionBonuses.defense,
    speed: (pet.base_speed || 4) + evolutionBonuses.speed
  };
  
  // Apply equipment bonuses
  if (!equipRes.error && equipRes.data) {
    equipRes.data.forEach(function(item) {
      var equip = item.equipment;
      stats.attack += equip.attack_bonus || 0;
      stats.defense += equip.defense_bonus || 0;
      stats.speed += equip.speed_bonus || 0;
    });
  }
  
  return {
    id: pet.id,
    name: pet.nickname || pet.pets.name || 'Your Pet',
    imageFile: pet.pets.image_file,
    stats: stats,
    currentHP: currentHP,
    maxHP: maxHP,
    energy: pet.energy || 50,
    maxEnergy: pet.max_energy || 100,
    specialSkill: pet.pets.special_skill || null
  };
}

/**
 * Simulate an entire battle and return the log
 * Returns: { victory: boolean, log: [...], playerFinalHP: number, enemyFinalHP: number }
 */
function simulateBattle(playerStats, enemyStats) {
  var log = [];
  var playerHP = playerStats.currentHP;
  var enemyHP = enemyStats.hp;
  var turn = 0;
  var maxTurns = 50; // prevent infinite loops
  
  // Determine who goes first based on speed
  var playerFirst = playerStats.stats.speed >= enemyStats.speed;
  
  log.push({
    type: 'start',
    text: 'Battle begins! ' + playerStats.name + ' vs ' + enemyStats.name + '!',
    playerHP: playerHP,
    enemyHP: enemyHP
  });
  
  while (playerHP > 0 && enemyHP > 0 && turn < maxTurns) {
    turn++;
    
    // Player's turn
    if (playerFirst || turn > 1) {
      // Check if player uses a special skill
      var usedSkill = false;
      var skillResult = null;
      
      if (playerStats.specialSkill && Math.random() < playerStats.specialSkill.trigger_chance) {
        // Player uses special skill!
        usedSkill = true;
        var baseDamage = playerStats.stats.attack - enemyStats.defense;
        var skillDamage = Math.max(1, Math.floor(baseDamage * playerStats.specialSkill.damage_multiplier));
        
        enemyHP -= skillDamage;
        
        // Calculate heal if skill has healing
        var healAmount = 0;
        if (playerStats.specialSkill.heal_percent > 0) {
          healAmount = Math.floor(skillDamage * playerStats.specialSkill.heal_percent);
          playerHP = Math.min(playerStats.maxHP, playerHP + healAmount);
        }
        
        skillResult = {
          damage: skillDamage,
          heal: healAmount,
          skillName: playerStats.specialSkill.name,
          skillIcon: playerStats.specialSkill.icon
        };
        
        var skillText = playerStats.name + ' uses ' + playerStats.specialSkill.name + '! ' + playerStats.specialSkill.icon + ' ' + skillDamage + ' damage!';
        if (healAmount > 0) {
          skillText += ' (Healed ' + healAmount + ' HP!)';
        }
        
        log.push({
          type: 'player_attack',
          attacker: 'player',
          damage: skillDamage,
          variance: 1, // Skills count as crits for sound effects
          isSkill: true,
          skillData: skillResult,
          text: skillText,
          playerHP: playerHP,
          enemyHP: Math.max(0, enemyHP)
        });
      } else {
        // Normal attack
        var playerDamageResult = calculateDamage(playerStats.stats.attack, enemyStats.defense, false);
        enemyHP -= playerDamageResult.damage;
        
        log.push({
          type: 'player_attack',
          attacker: 'player',
          damage: playerDamageResult.damage,
          variance: playerDamageResult.variance,
          isSkill: false,
          text: playerStats.name + ' attacks for ' + playerDamageResult.damage + ' damage! ' + playerDamageResult.flavor,
          playerHP: playerHP,
          enemyHP: Math.max(0, enemyHP)
        });
      }
      
      if (enemyHP <= 0) break;
    }
    
    // Enemy's turn
    var isBossAttack = enemyStats.is_boss || false;
    var enemyDamageResult = calculateDamage(enemyStats.attack, playerStats.stats.defense, isBossAttack);
    playerHP -= enemyDamageResult.damage;
    
    log.push({
      type: 'enemy_attack',
      attacker: 'enemy',
      damage: enemyDamageResult.damage,
      variance: enemyDamageResult.variance,
      text: enemyStats.name + ' attacks for ' + enemyDamageResult.damage + ' damage! ' + enemyDamageResult.flavor,
      playerHP: Math.max(0, playerHP),
      enemyHP: Math.max(0, enemyHP)
    });
    
    if (playerHP <= 0) break;
  }
  
  var victory = playerHP > 0;
  
  log.push({
    type: 'end',
    text: victory ? 'Victory! ' + playerStats.name + ' wins!' : 'Defeat! ' + playerStats.name + ' fainted!',
    playerHP: Math.max(0, playerHP),
    enemyHP: Math.max(0, enemyHP)
  });
  
  return {
    victory: victory,
    log: log,
    turns: turn,
    playerFinalHP: Math.max(0, playerHP),
    enemyFinalHP: Math.max(0, enemyHP)
  };
}

/**
 * Calculate damage with variance
 */
function calculateDamage(attack, defense, isBossAttack) {
  var baseDamage = attack - defense;
  var variance = Math.floor(Math.random() * 3) - 1; // -1, 0, or +1
  var damage = Math.max(1, baseDamage + variance);
  
  // Flavor text based on variance
  var flavor = '';
  
  // Special boss flavor text!
  if (isBossAttack) {
    if (variance === -1) {
      var bosLowFlavors = [
        'Piper\'s flute makes your head spin...',
        'The haunting melody disorients you!',
        'A distant note echoes in your mind...',
        'The sound barely reaches you...',
        'A faint whistle brushes past you...'
      ];
      flavor = bosLowFlavors[Math.floor(Math.random() * bosLowFlavors.length)];
    } else if (variance === 0) {
      var bossNormalFlavors = [
        'Piper\'s flute makes you feel sick!',
        'The melody pierces through you!',
        'Reality wavers to the tune!',
        'The haunting song grips your mind!',
        'The flute\'s cry echoes in your bones!'
      ];
      flavor = bossNormalFlavors[Math.floor(Math.random() * bossNormalFlavors.length)];
    } else { // variance === +1
      var bossCritFlavors = [
        'Piper\'s flute distorts reality itself!',
        'The melody SHATTERS your senses!',
        'Reality BREAKS under the song!',
        'The flute\'s scream tears through existence!',
        'The haunting tune OVERWHELMS everything!'
      ];
      flavor = bossCritFlavors[Math.floor(Math.random() * bossCritFlavors.length)];
    }
  } else {
    // Normal flavor text
    if (variance === -1) {
      var lowHitFlavors = [
        'Barely scratched them!',
        'A glancing blow!',
        'Just grazed them!',
        'Wasn\'t very effective...',
        'A weak hit!'
      ];
      flavor = lowHitFlavors[Math.floor(Math.random() * lowHitFlavors.length)];
    } else if (variance === 0) {
      var normalHitFlavors = [
        'A solid hit!',
        'Good wallop!',
        'Nice strike!',
        'Connected cleanly!',
        'That hurt!'
      ];
      flavor = normalHitFlavors[Math.floor(Math.random() * normalHitFlavors.length)];
    } else { // variance === +1
      var critHitFlavors = [
        'Critical hit!',
        'A devastating blow!',
        'Super effective!',
        'Absolutely crushed them!',
        'WHAM! Direct hit!'
      ];
      flavor = critHitFlavors[Math.floor(Math.random() * critHitFlavors.length)];
    }
  }
  
  return { damage: damage, flavor: flavor, variance: variance };
}

/**
 * Start a battle against an enemy
 */
async function startBattle(petId, enemyId) {
  if (!currentUser) return;
  
  // Get player pet stats (includes current HP and energy)
  var playerStats = await calculatePetStats(petId);
  if (!playerStats) {
    showToast('Error loading pet stats!');
    return;
  }
  
  // Check if pet has enough energy (need at least 5)
  if (playerStats.energy < 5) {
    showToast('🥱 Your pet is too tired! Feed them to restore energy.');
    return;
  }
  
  // Check if pet has HP left
  if (playerStats.currentHP <= 0) {
    showToast('💔 Your pet is fainted! Use a healing item first!');
    return;
  }
  
  // Get enemy stats
  var enemyRes = await supabaseClient
    .from('enemy_pets')
    .select('*')
    .eq('id', enemyId)
    .single();
  
  if (enemyRes.error) {
    showToast('Error loading enemy!');
    return;
  }
  
  var enemy = enemyRes.data;
  var enemyStats = {
    id: enemy.id,
    name: enemy.name,
    species: enemy.species,
    hp: enemy.base_hp,
    attack: enemy.base_attack,
    defense: enemy.base_defense,
    speed: enemy.base_speed,
    exp_reward: enemy.exp_reward,
    pp_reward: enemy.pp_reward,
    sprite_sheet: enemy.sprite_sheet,
    sprite_frames: enemy.sprite_frames
  };
  
  // Continue with battle logic...
  await executeBattle(playerStats, enemyStats, petId);
}

/**
 * Start battle with pre-generated enemy (for level-scaled enemies)
 */
async function startBattleWithEnemy(petId, enemy) {
  if (!currentUser) return;
  
  console.log('⚔️ BATTLE START - Pet ID:', petId, 'Enemy:', enemy.name);
  
  // Get player pet stats (includes current HP and energy)
  var playerStats = await calculatePetStats(petId);
  if (!playerStats) {
    showToast('Error loading pet stats!');
    return;
  }
  
  console.log('👤 Player HP at battle start:', playerStats.currentHP);
  
  // Check if pet has enough energy (need at least 5)
  if (playerStats.energy < 5) {
    showToast('🥱 Your pet is too tired! Feed them to restore energy.');
    return;
  }
  
  // Check if pet has HP left
  if (playerStats.currentHP <= 0) {
    showToast('💔 Your pet is fainted! Use a healing item first!');
    return;
  }
  
  // Use the pre-scaled enemy stats
  var enemyStats = {
    id: enemy.id,
    name: enemy.name + ' (Lv.' + enemy.level + ')',
    species: enemy.species,
    level: enemy.level,
    hp: enemy.base_hp,
    attack: enemy.base_attack,
    defense: enemy.base_defense,
    speed: enemy.base_speed,
    exp_reward: enemy.exp_reward || calculateReward(enemy.level, enemy.forest_zone, 'xp'),
    pp_reward: enemy.pp_reward || calculateReward(enemy.level, enemy.forest_zone, 'pp'),
    sprite_sheet: enemy.sprite_sheet || null,
    sprite_frames: enemy.sprite_frames || null,
    is_boss: enemy.is_boss || false
  };
  
  // BOSS ENTRANCE SEQUENCE!
  if (enemy.is_boss) {
    triggerBossEntrance();
  }
  
  // Continue with battle logic...
  await executeBattle(playerStats, enemyStats, petId);
}

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
async function executeBattle(playerStats, enemyStats, petId) {
  // Deduct 5 energy from pet BEFORE battle
  // Get fresh energy value from database to be sure
  var freshPet = await supabaseClient
    .from('user_pets')
    .select('energy')
    .eq('id', petId)
    .single();
  
  console.log('=== ENERGY DEDUCTION DEBUG ===');
  console.log('Pet ID:', petId);
  console.log('Fresh pet query result:', freshPet);
  
  if (freshPet.data) {
    var currentEnergy = freshPet.data.energy || 100;
    var newEnergy = Math.max(0, currentEnergy - 5);
    
    console.log('Energy deduction: ' + currentEnergy + ' -> ' + newEnergy);
    showToast('⚡ Energy: ' + currentEnergy + ' → ' + newEnergy);
    
    var updateRes = await supabaseClient
      .from('user_pets')
      .update({ energy: newEnergy })
      .eq('id', petId);
    
    console.log('Energy update result:', updateRes);
    
    if (updateRes.error) {
      console.error('Energy update error:', updateRes.error);
      showToast('❌ Energy update failed!');
    } else {
      console.log('Energy updated successfully!');
      showToast('✅ Energy updated to ' + newEnergy);
    }
  } else {
    console.error('Failed to fetch pet energy!');
  }
  console.log('=== END ENERGY DEBUG ===');
  
  // Simulate the battle
  var battleResult = simulateBattle(playerStats, enemyStats);
  
  console.log('🎲 BATTLE RESULT:', {
    victory: battleResult.victory,
    playerFinalHP: battleResult.playerFinalHP,
    enemyFinalHP: battleResult.enemyFinalHP,
    turns: battleResult.turns
  });
  
  // Show battle UI and play it back
  isBossBattle = enemyStats.is_boss || false;  // Track if this is a boss battle
  showBattleUI(playerStats, enemyStats, battleResult);
  
  // Save battle to history and get rewards
  // For dynamically scaled enemies, use the base enemy ID
  console.log('💾 About to save battle - Victory:', battleResult.victory, 'Final HP:', battleResult.playerFinalHP);
  battleRewards = await saveBattleHistory(petId, enemyStats.id, battleResult, enemyStats);
  
  console.log('✅ saveBattleHistory completed. Rewards:', battleRewards);
  
  // CRITICAL: Force reload pet data AFTER HP is saved
  console.log('🔄 Forcing pet data reload after battle...');
  await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to ensure DB write completes
  tabsLoaded['mypets'] = false;
  tabsLoaded['battle'] = false;
}

/**
 * Save battle to database
 */
async function saveBattleHistory(petId, enemyId, battleResult, enemyStats) {
  console.log('💾 saveBattleHistory called - Victory:', battleResult.victory, 'Final HP:', battleResult.playerFinalHP);
  
  var expGained = battleResult.victory ? enemyStats.exp_reward : 0;
  var ppGained = battleResult.victory ? enemyStats.pp_reward : 0;
  
  // Scale rewards based on enemy variant and level
  if (battleResult.victory && enemyStats.variant) {
    var variantMultiplier = 1.0;
    
    // Variant bonuses
    if (enemyStats.variant === 'adult') variantMultiplier = 1.3;
    else if (enemyStats.variant === 'elder') variantMultiplier = 1.6;
    else if (enemyStats.variant === 'king') variantMultiplier = 2.0;
    
    // Elemental bonus
    if (enemyStats.elementalType) {
      variantMultiplier *= 1.2;
    }
    
    // Apply multipliers
    expGained = Math.floor(expGained * variantMultiplier);
    ppGained = Math.floor(ppGained * variantMultiplier);
    
    console.log('💰 Rewards scaled by variant:', enemyStats.variant, 'Elemental:', enemyStats.elementalType, 'Multiplier:', variantMultiplier);
  }
  
  var itemDropped = null;
  
  // BOSS DROP - Guaranteed item if you beat a boss!
  if (battleResult.victory && enemyStats.is_boss) {
    console.log('🎁 Boss defeated! Rolling for exclusive drop...');
    
    // Log boss defeat activity
    await logActivity('boss_defeated', {
      boss_name: enemyStats.name
    });
    
    // Get boss drops for this specific boss zone
    var bossDropRes = await supabaseClient
      .from('items')
      .select('*')
      .eq('is_boss_drop', true)
      .ilike('boss_source', '%' + enemyStats.forest_zone + '%');
    
    if (!bossDropRes.error && bossDropRes.data && bossDropRes.data.length > 0) {
      // Random drop from this boss's loot table
      itemDropped = bossDropRes.data[Math.floor(Math.random() * bossDropRes.data.length)];
      
      console.log('🎉 Boss dropped:', itemDropped.name);
      
      // Check if player already has this item
      var existingItem = await supabaseClient
        .from('user_inventory')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('item_id', itemDropped.id)
        .single();
      
      if (existingItem.data) {
        // Increase quantity
        await supabaseClient
          .from('user_inventory')
          .update({ quantity: existingItem.data.quantity + 1 })
          .eq('id', existingItem.data.id);
      } else {
        // Add new item to inventory
        await supabaseClient
          .from('user_inventory')
          .insert([{
            user_id: currentUser.id,
            item_id: itemDropped.id,
            quantity: 1
          }]);
      }
    }
  }
  
  // Normal 10% chance for item drop on victory (only if not boss)
  if (battleResult.victory && !enemyStats.is_boss && Math.random() < 0.1) {
    // Get random cheap item from shop (under 100 PP)
    var itemsRes = await supabaseClient
      .from('items')
      .select('*')
      .lte('price', 100)
      .limit(20);
    
    if (!itemsRes.error && itemsRes.data && itemsRes.data.length > 0) {
      itemDropped = itemsRes.data[Math.floor(Math.random() * itemsRes.data.length)];
      
      // Add to player inventory
      await supabaseClient
        .from('user_inventory')
        .insert([{
          user_id: currentUser.id,
          item_id: itemDropped.id,
          quantity: 1
        }]);
    }
  }
  
  // Save to battle_history
  await supabaseClient
    .from('battle_history')
    .insert([{
      user_id: currentUser.id,
      pet_id: petId,
      enemy_id: enemyId,
      victory: battleResult.victory,
      turns_taken: battleResult.turns,
      exp_gained: expGained,
      pp_gained: ppGained,
      battle_log: battleResult.log
    }]);
  
  // Update pet stats AND save current HP
  if (battleResult.victory) {
    // Get current stats first to check for level up
    var petData = await supabaseClient
      .from('user_pets')
      .select('xp, level, max_hunger, max_energy, max_happiness, base_hp, base_attack, base_defense, base_speed, total_battles, battles_won, energy')
      .eq('id', petId)
      .single();
    
    if (petData.data) {
      var pet = petData.data;
      var newXp = (pet.xp || 0) + expGained;
      
      // Deduct 5 energy for the battle
      var newEnergy = Math.max((pet.energy || 0) - 5, 0);
      
      console.log('⚡ Energy deducted - Was:', pet.energy, 'Now:', newEnergy);
      
      // Check for level up with combat stat scaling
      var lu = calculateLevelUp(
        newXp,
        pet.level,
        pet.max_hunger,
        pet.max_energy,
        pet.max_happiness,
        pet.base_hp || 25,
        pet.base_attack || 4,
        pet.base_defense || 2,
        pet.base_speed || 3
      );
      
      var updates = {
        xp: lu.xp,
        level: lu.level,
        total_battles: (pet.total_battles || 0) + 1,
        battles_won: (pet.battles_won || 0) + 1,
        current_hp: battleResult.playerFinalHP,  // SAVE HP!
        energy: newEnergy  // SAVE reduced energy!
      };
      
      // If leveled up, add the stat increases
      if (lu.leveled) {
        updates.max_hunger = lu.maxHunger;
        updates.max_energy = lu.maxEnergy;
        updates.max_happiness = lu.maxHappiness;
        updates.base_hp = lu.base_hp;
        updates.base_attack = lu.base_attack;
        updates.base_defense = lu.base_defense;
        updates.base_speed = lu.base_speed;
        updates.max_hp = lu.base_hp;
      }
      
      await supabaseClient
        .from('user_pets')
        .update(updates)
        .eq('id', petId);
      
      // Store level up info for the rewards modal
      if (lu.leveled) {
        var oldStage = getEvolutionStage(pet.level);
        var newStage = getEvolutionStage(lu.level);
        
        battleRewards.leveledUp = true;
        battleRewards.newLevel = lu.level;
        battleRewards.statIncreases = lu.statIncreases;
        
        // Log level up activity
        var petInfo = await supabaseClient
          .from('user_pets')
          .select('nickname, pets(name)')
          .eq('id', petId)
          .single();
        
        var petName = petInfo.data ? (petInfo.data.nickname || petInfo.data.pets.name) : 'Pet';
        
        await logActivity('level_up', {
          pet_name: petName,
          level: lu.level
        });
        
        // Check if pet evolved to a new stage
        if (oldStage !== newStage) {
          battleRewards.evolved = true;
          battleRewards.evolutionStage = newStage;
          battleRewards.evolutionEmoji = getEvolutionEmoji(newStage);
        }
      }
    }
    
    // Award PP to player
    await awardPP(ppGained);
  } else {
    // Loss - just update battle count, HP, and deduct energy
    console.log('🔴 DEFEAT - Saving HP:', battleResult.playerFinalHP);
    
    var petData = await supabaseClient
      .from('user_pets')
      .select('total_battles, energy')
      .eq('id', petId)
      .single();
    
    if (petData.data) {
      // Deduct 5 energy even on loss
      var newEnergy = Math.max((petData.data.energy || 0) - 5, 0);
      
      console.log('⚡ Energy deducted (loss) - Was:', petData.data.energy, 'Now:', newEnergy);
      
      var updateResult = await supabaseClient
        .from('user_pets')
        .update({
          total_battles: (petData.data.total_battles || 0) + 1,
          current_hp: battleResult.playerFinalHP,  // SAVE HP even on loss!
          energy: newEnergy  // SAVE reduced energy!
        })
        .eq('id', petId);
      
      console.log('💾 HP Update Result:', updateResult.error || 'Success!', 'New HP:', battleResult.playerFinalHP, 'New Energy:', newEnergy);
    }
  }
  
  // Store rewards for the modal
  return {
    victory: battleResult.victory,
    expGained: expGained,
    ppGained: ppGained,
    itemDropped: itemDropped
  };
}

/**
 * Show battle UI (will be expanded in Chunk 3)
 */
var currentBattleLog = [];
var currentBattleIndex = 0;
var battlePlaybackInterval = null;
var isBossBattle = false;  // Track if current battle is against a boss
var selectedBattlePetId = null;
var selectedBattleZone = 'outskirts'; // Default to easy zone

function selectZone(zone) {
  selectedBattleZone = zone;
  
  // Update UI - remove selected class from all
  var allZones = document.querySelectorAll('.zone-btn');
  allZones.forEach(function(btn) {
    btn.classList.remove('zone-selected');
    btn.style.border = '3px solid var(--purple-light)';
    btn.style.transform = 'scale(1)';
  });
  
  // Add selected class to clicked zone
  var selectedBtn = document.getElementById('zone-' + zone);
  if (selectedBtn && !selectedBtn.classList.contains('zone-locked')) {
    selectedBtn.classList.add('zone-selected');
    selectedBtn.style.border = '3px solid var(--green)';
    selectedBtn.style.transform = 'scale(1.02)';
    
    var helperText = document.getElementById('battle-helper-text');
    var findBtn = document.getElementById('find-battle-btn');
    
    if (zone === 'dungeon') {
      // Dungeon mode
      if (helperText && selectedBattlePetId) {
        helperText.textContent = 'Ready to challenge the Shallow Cave!';
      }
      if (findBtn) {
        findBtn.textContent = '⛰️ Enter Dungeon';
        findBtn.onclick = startDungeon;
      }
    } else {
      // Normal exploration
      if (helperText && selectedBattlePetId) {
        var zoneName = zone === 'outskirts' ? 'City Outskirts' : 
                       zone === 'glade' ? 'Forest Glade' : 
                       zone === 'deepwoods' ? 'Deep Woods' : 
                       zone === 'ruins' ? 'Outside The Ruins' : 'this zone';
        helperText.textContent = 'Ready to explore ' + zoneName + '!';
      }
      if (findBtn) {
        findBtn.textContent = '🌲 Go Exploring';
        findBtn.onclick = goExploring;
      }
    }
  }
}
var battleRewards = null;  // Store rewards globally

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
  
  // Set enemy sprite based on species
  var enemySprite = el('enemy-battle-sprite');
  
  // BOSS SPRITE - Show glitchy question mark
  if (enemyStats.is_boss) {
    enemySprite.style.backgroundImage = 'none';
    enemySprite.innerHTML = '<div class="boss-sprite">?</div>';
  } else {
    enemySprite.innerHTML = '';
    var spriteFile = getSpriteFile(enemyStats.species);
    enemySprite.style.backgroundImage = 'url(images/' + spriteFile + ')';
    enemySprite.style.backgroundPosition = '0 0'; // idle animation top row
  }
  
  // Clear battle log
  el('battle-log').innerHTML = '';
  
  // Start playback
  el('battle-skip-btn').style.display = 'inline-block';
  el('battle-continue-btn').style.display = 'none';
  
  playBattleTurn();
}

function getSpriteFile(species) {
  var spriteMap = {
    'bird': 'MiniBird.png',
    'bunny': 'MiniBunny.png',
    'rabbit': 'MiniBunny.png',
    'squirrel': 'MiniBunny.png', // using bunny as placeholder
    'fox': 'MiniFox.png',
    'raccoon': 'MiniFox.png', // using fox as placeholder
    'boar': 'MiniBoar.png',
    'wolf': 'MiniWolf.png',
    'bear': 'MiniB earng',
    'deer': 'MiniDeer1.png'
  };
  return spriteMap[species] || 'MiniBird.png';
}

function playBattleTurn() {
  if (currentBattleIndex >= currentBattleLog.length) {
    // Battle finished
    endBattlePlayback();
    return;
  }
  
  var entry = currentBattleLog[currentBattleIndex];
  
  // Add log entry
  var logEntry = makeEl('div', { class: 'battle-log-entry' });
  if (entry.type === 'player_attack') {
    logEntry.classList.add('player-attack');
    // Add special styling for skill attacks
    if (entry.isSkill) {
      logEntry.classList.add('skill-attack');
    }
  } else if (entry.type === 'enemy_attack') {
    logEntry.classList.add('enemy-attack');
  } else if (entry.type === 'end') {
    logEntry.classList.add(entry.text.includes('Victory') ? 'victory' : 'defeat');
  }
  logEntry.textContent = entry.text;
  var battleLog = el('battle-log');
  battleLog.appendChild(logEntry);
  
  // COMPLETELY NEW APPROACH - Use scrollIntoView which forces the element into view
  // This is MORE RELIABLE than scrollTop in many browsers
  try {
    logEntry.scrollIntoView({ behavior: 'instant', block: 'end', inline: 'nearest' });
  } catch (e) {
    // Fallback for older browsers
    battleLog.scrollTop = battleLog.scrollHeight;
  }
  
  // Double-check with a slight delay
  setTimeout(function() {
    try {
      logEntry.scrollIntoView({ behavior: 'instant', block: 'end', inline: 'nearest' });
    } catch (e) {
      battleLog.scrollTop = battleLog.scrollHeight;
    }
  }, 10);
  
  // Update HP bars
  updateHPBar('player', entry.playerHP, currentBattleLog[0].playerHP);
  updateHPBar('enemy', entry.enemyHP, currentBattleLog[0].enemyHP);
  
  // Animate hit
  if (entry.type === 'player_attack') {
    animateHit('enemy');
    
    // Play player attack sound with volume based on variance
    if (entry.variance !== undefined) {
      var soundKey = getBattleSoundKey('player', entry.variance);
      var playerVolume = 0.21; // Reduced 40% (was 0.35)
      
      if (entry.variance === 1) { // Crit
        playerVolume = 0.08; // Reduced 40% (was 0.14)
      }
      
      playBattleSound(soundKey, playerVolume);
    }
  } else if (entry.type === 'enemy_attack') {
    animateHit('player');
    
    // Play enemy attack sound - special sounds for boss with variance!
    if (isBossBattle && entry.variance !== undefined) {
      // Boss uses different flute sounds based on hit strength
      var bossSoundKey = 'boss' + (entry.variance === -1 ? 'Light' : entry.variance === 0 ? 'Normal' : 'Crit');
      
      // Volume adjustments: Light/Normal +20% louder, Crit 25% quieter
      var bossVolume = 0.42; // Default for light/normal (was 0.35, now +20%)
      if (entry.variance === 1) { // Crit
        bossVolume = 0.26; // Crit quieter (was 0.35, now -25%)
      }
      
      playBattleSound(bossSoundKey, bossVolume, true); // Allow boss sounds to overlap
    } else if (entry.variance !== undefined) {
      var soundKey = getBattleSoundKey('enemy', entry.variance);
      
      // Reduced 40% from original volumes
      var enemyVolume = 0.18; // Reduced 40% (was 0.30)
      if (entry.variance === 1) { // Crit
        enemyVolume = 0.08; // Reduced 40% (was 0.14)
      }
      
      playBattleSound(soundKey, enemyVolume);
    }
  } else if (entry.type === 'end') {
    // Play victory/defeat sound
    if (entry.text.includes('Victory')) {
      playBattleSound('victory', 0.40);
    } else {
      playBattleSound('defeat', 0.35);
    }
  }
  
  currentBattleIndex++;
  
  // Dynamic turn speed - give boss attacks more time for long sound effects
  var turnDelay = 1200; // Default 1.2 seconds
  
  if (isBossBattle && entry.type === 'enemy_attack') {
    turnDelay = 4500; // 4.5 seconds for boss attacks (allows 4s sound to finish)
  }
  
  // Continue to next turn
  battlePlaybackInterval = setTimeout(playBattleTurn, turnDelay);
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

function skipBattle() {
  if (battlePlaybackInterval) {
    clearTimeout(battlePlaybackInterval);
  }
  
  // Jump to end
  currentBattleIndex = currentBattleLog.length - 1;
  var lastEntry = currentBattleLog[currentBattleIndex];
  
  // Update final HP
  updateHPBar('player', lastEntry.playerHP, currentBattleLog[0].playerHP);
  updateHPBar('enemy', lastEntry.enemyHP, currentBattleLog[0].enemyHP);
  
  // Show final message
  var logEntry = makeEl('div', { class: 'battle-log-entry' });
  logEntry.classList.add(lastEntry.text.includes('Victory') ? 'victory' : 'defeat');
  logEntry.textContent = lastEntry.text;
  el('battle-log').appendChild(logEntry);
  
  endBattlePlayback();
}

function endBattlePlayback() {
  el('battle-skip-btn').style.display = 'none';
  el('battle-continue-btn').style.display = 'none';
  
  // Check if player lost to a boss - trigger special death screen!
  if (isBossBattle && battleRewards && !battleRewards.victory) {
    triggerBossDeathScreen();
    return; // Don't show normal rewards modal
  }
  
  // Clean up boss effects
  clearBossEffects();
  
  // Show rewards modal
  showBattleRewardsModal();
}

function showBattleRewardsModal() {
  if (!battleRewards) return;
  
  var modal = el('battle-rewards-modal');
  if (!modal) {
    console.error('Battle rewards modal not found in HTML!');
    // Fallback to toast
    if (battleRewards.victory) {
      showToast('Victory! +' + battleRewards.expGained + ' EXP, +' + battleRewards.ppGained + ' PP!');
    } else {
      showToast('Defeat! Better luck next time!');
    }
    return;
  }
  
  // Update modal content
  var title = el('rewards-title');
  var expText = el('rewards-exp');
  var ppText = el('rewards-pp');
  var itemText = el('rewards-item');
  
  if (battleRewards.victory) {
    title.textContent = '🎉 Victory!';
    title.style.color = 'var(--green)';
    expText.textContent = '+' + battleRewards.expGained + ' EXP';
    ppText.textContent = '+' + battleRewards.ppGained + ' PP';
    
    // Check for level up
    if (battleRewards.leveledUp) {
      var levelUpText = '⭐ LEVEL UP! Now Level ' + battleRewards.newLevel + '!\n';
      
      // Check for evolution!
      if (battleRewards.evolved) {
        levelUpText = battleRewards.evolutionEmoji + ' EVOLUTION! ' + battleRewards.evolutionStage.toUpperCase() + ' STAGE!\n';
        levelUpText += 'Your pet is now Level ' + battleRewards.newLevel + '!\n';
      }
      
      var stats = battleRewards.statIncreases;
      if (stats.hp) levelUpText += '+' + stats.hp + ' HP ';
      if (stats.atk) levelUpText += '+' + stats.atk + ' ATK ';
      if (stats.def) levelUpText += '+' + stats.def + ' DEF ';
      if (stats.spd) levelUpText += '+' + stats.spd + ' SPD';
      
      expText.textContent = levelUpText;
      expText.style.color = battleRewards.evolved ? 'var(--pink)' : 'var(--purple)';
      expText.style.fontWeight = 'bold';
      expText.style.fontSize = battleRewards.evolved ? '1.2rem' : '1.1rem';
    } else {
      expText.style.color = '';
      expText.style.fontWeight = '';
      expText.style.fontSize = '';
    }
    
    if (battleRewards.itemDropped) {
      itemText.textContent = '🎁 Bonus: Found ' + battleRewards.itemDropped.name + '!';
      itemText.style.display = 'block';
    } else {
      itemText.style.display = 'none';
    }
  } else {
    title.textContent = '💀 Defeat!';
    title.style.color = 'var(--red)';
    expText.textContent = 'No EXP gained';
    ppText.textContent = 'No PP gained';
    itemText.style.display = 'none';
  }
  
  modal.classList.add('show');
}

function closeBattleRewardsModal() {
  var modal = el('battle-rewards-modal');
  if (modal) modal.classList.remove('show');
  
  // Always reload My Pets tab to show updated HP and stats
  tabsLoaded['mypets'] = false;
  
  // Reset battle state
  battleRewards = null;
  closeBattle();
}

function closeBattle() {
  el('battle-screen').style.display = 'none';
  el('forest-exploration').style.display = 'block';
  
  // Reload pet selector to show updated stats
  loadBattlePets();
}

// Load pets for battle selection
async function loadBattlePets() {
  var grid = el('battle-pet-select');
  grid.innerHTML = '<div class="spinner"></div>';
  
  if (!currentUser) {
    grid.innerHTML = '<div class="empty-state"><p>Please log in first! 🐾</p></div>';
    return;
  }
  
  var res = await supabaseClient
    .from('user_pets')
    .select('id, nickname, level, base_hp, base_attack, base_defense, base_speed, current_hp, max_hp, energy, max_energy, pet_id, pets!inner(name, image_file)')
    .eq('user_id', currentUser.id);
  
  if (res.error) {
    console.error('Battle pets query error:', res.error);
    grid.innerHTML = '<div class="empty-state"><p>Error loading pets: ' + res.error.message + '</p></div>';
    return;
  }
  
  if (!res.data || res.data.length === 0) {
    grid.innerHTML = '<div class="empty-state"><p>You need a pet to battle! Adopt one first. 🐾</p></div>';
    return;
  }
  
  grid.innerHTML = '';
  
  res.data.forEach(function(userPet) {
    var pet = userPet.pets;
    var card = makeEl('div', { class: 'battle-pet-card' });
    card.onclick = function() { selectBattlePet(userPet.id, card); };
    
    var img = makeEl('img');
    img.src = 'images/pets/' + pet.image_file;
    img.alt = pet.name;
    card.appendChild(img);
    
    var name = makeEl('div', { class: 'battle-pet-card-name' });
    name.textContent = userPet.nickname || pet.name;
    card.appendChild(name);
    
    var level = makeEl('div', { class: 'battle-pet-card-level' });
    level.textContent = 'Level ' + userPet.level;
    card.appendChild(level);
    
    var stats = makeEl('div', { class: 'battle-pet-card-stats' });
    
    var hpStat = makeEl('div', { class: 'battle-pet-stat' });
    var currentHP = userPet.current_hp || userPet.base_hp || 30;
    var maxHP = userPet.max_hp || userPet.base_hp || 30;
    hpStat.innerHTML = '<div class="battle-pet-stat-label">HP</div><div class="battle-pet-stat-value">' + currentHP + '/' + maxHP + '</div>';
    stats.appendChild(hpStat);
    
    var atkStat = makeEl('div', { class: 'battle-pet-stat' });
    atkStat.innerHTML = '<div class="battle-pet-stat-label">ATK</div><div class="battle-pet-stat-value">' + userPet.base_attack + '</div>';
    stats.appendChild(atkStat);
    
    var defStat = makeEl('div', { class: 'battle-pet-stat' });
    defStat.innerHTML = '<div class="battle-pet-stat-label">DEF</div><div class="battle-pet-stat-value">' + userPet.base_defense + '</div>';
    stats.appendChild(defStat);
    
    var spdStat = makeEl('div', { class: 'battle-pet-stat' });
    spdStat.innerHTML = '<div class="battle-pet-stat-label">SPD</div><div class="battle-pet-stat-value">' + userPet.base_speed + '</div>';
    stats.appendChild(spdStat);
    
    card.appendChild(stats);
    
    grid.appendChild(card);
  });
}

function selectBattlePet(petId, cardElement) {
  selectedBattlePetId = petId;
  
  // Update visual selection
  var cards = document.querySelectorAll('.battle-pet-card');
  cards.forEach(function(card) {
    card.classList.remove('selected');
  });
  cardElement.classList.add('selected');
  
  // Enable battle button
  el('find-battle-btn').disabled = false;
}

// ═══════════════════════════════════════════════════════════════════════════
// RANDOM ENCOUNTERS SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

var pendingBattleEnemy = null;

async function goExploring() {
  if (!selectedBattlePetId) {
    showPixelToast('Select a pet first!', 'warning');
    return;
  }
  
  // Check daily energy cap
  var today = new Date().toISOString().split('T')[0];
  var energyKey = 'energy_used_' + today;
  var energyUsedToday = parseInt(localStorage.getItem(energyKey)) || 0;
  
  if (energyUsedToday >= 250) {
    showPixelToast('⚡ Daily battle limit reached! Come back tomorrow!', 'warning');
    return;
  }
  
  // Track energy used
  localStorage.setItem(energyKey, energyUsedToday + 5);
  
  // Roll for encounter type
  var roll = Math.random();
  
  if (roll < 0.70) {
    // 70% - Normal Battle
    await handleBattleEncounter();
  } else if (roll < 0.85) {
    // 15% - Found Item
    await handleItemEncounter();
  } else if (roll < 0.95) {
    // 10% - Found Treasure
    await handleTreasureEncounter();
  } else {
    // 5% - Flavor Event
    await handleFlavorEncounter();
  }
}

async function handleBattleEncounter() {
  // Get player level
  var playerPetRes = await supabaseClient
    .from('user_pets')
    .select('level')
    .eq('id', selectedBattlePetId)
    .single();
  
  if (playerPetRes.error || !playerPetRes.data) {
    showPixelToast('Error loading your pet!', 'error');
    return;
  }
  
  var playerLevel = playerPetRes.data.level || 1;
  
  // Get random enemy
  var enemy = await getRandomEnemy(selectedBattleZone, playerLevel);
  
  if (!enemy) {
    showPixelToast('No enemies found in this zone!', 'error');
    return;
  }
  
  // Store enemy and show modal
  pendingBattleEnemy = enemy;
  
  var modal = document.getElementById('exploration-modal');
  document.getElementById('exploration-title').textContent = '⚔️ Wild Encounter!';
  document.getElementById('exploration-result').innerHTML = 
    'A wild <strong style="color: var(--purple);">' + enemy.name + '</strong> appears!';
  document.getElementById('exploration-rewards').innerHTML = '';
  
  var continueBtn = document.getElementById('exploration-continue-btn');
  continueBtn.textContent = 'Battle!';
  continueBtn.onclick = async function() {
    closeExplorationModal();
    await startBattleWithEnemy(selectedBattlePetId, pendingBattleEnemy);
  };
  
  modal.classList.add('show');
}

async function handleItemEncounter() {
  // Get random common item
  var itemsRes = await supabaseClient
    .from('items')
    .select('*')
    .eq('tier', 1)
    .limit(20);
  
  if (itemsRes.error || !itemsRes.data || itemsRes.data.length === 0) {
    // Fallback to battle if no items found
    await handleBattleEncounter();
    return;
  }
  
  var randomItem = itemsRes.data[Math.floor(Math.random() * itemsRes.data.length)];
  var ppReward = 10 + Math.floor(Math.random() * 11); // 10-20 PP
  
  // Add item to inventory
  var existingItem = await supabaseClient
    .from('user_inventory')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('item_id', randomItem.id)
    .single();
  
  if (existingItem.data) {
    await supabaseClient
      .from('user_inventory')
      .update({ quantity: existingItem.data.quantity + 1 })
      .eq('id', existingItem.data.id);
  } else {
    await supabaseClient
      .from('user_inventory')
      .insert([{
        user_id: currentUser.id,
        item_id: randomItem.id,
        quantity: 1
      }]);
  }
  
  // Award PP
  await awardPP(ppReward);
  
  // Show result
  var modal = document.getElementById('exploration-modal');
  document.getElementById('exploration-title').textContent = '🎁 Item Found!';
  document.getElementById('exploration-result').innerHTML = 
    'You found a <strong style="color: var(--purple);">' + randomItem.name + '</strong> while exploring!';
  document.getElementById('exploration-rewards').innerHTML = 
    '<div style="color: var(--green); font-weight: bold;">+' + ppReward + ' PP</div>' +
    '<div style="color: var(--text-light); font-size: 0.9rem; margin-top: 8px;">Added to your inventory!</div>';
  
  var continueBtn = document.getElementById('exploration-continue-btn');
  continueBtn.textContent = 'Continue';
  continueBtn.onclick = closeExplorationModal;
  
  modal.classList.add('show');
}

async function handleTreasureEncounter() {
  // Get random rare item (tier 2 or 3)
  var tier = Math.random() < 0.7 ? 2 : 3; // 70% tier 2, 30% tier 3
  
  var itemsRes = await supabaseClient
    .from('items')
    .select('*')
    .eq('tier', tier)
    .limit(15);
  
  if (itemsRes.error || !itemsRes.data || itemsRes.data.length === 0) {
    // Fallback to item encounter
    await handleItemEncounter();
    return;
  }
  
  var randomItem = itemsRes.data[Math.floor(Math.random() * itemsRes.data.length)];
  var ppReward = 30 + Math.floor(Math.random() * 21); // 30-50 PP
  
  // Add item to inventory
  var existingItem = await supabaseClient
    .from('user_inventory')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('item_id', randomItem.id)
    .single();
  
  if (existingItem.data) {
    await supabaseClient
      .from('user_inventory')
      .update({ quantity: existingItem.data.quantity + 1 })
      .eq('id', existingItem.data.id);
  } else {
    await supabaseClient
      .from('user_inventory')
      .insert([{
        user_id: currentUser.id,
        item_id: randomItem.id,
        quantity: 1
      }]);
  }
  
  // Award PP
  await awardPP(ppReward);
  
  // Show result
  var modal = document.getElementById('exploration-modal');
  document.getElementById('exploration-title').textContent = '💎 Treasure Discovered!';
  document.getElementById('exploration-result').innerHTML = 
    'You discovered a hidden treasure chest!<br>' +
    'Inside you found: <strong style="color: var(--purple);">' + randomItem.name + '</strong>!';
  document.getElementById('exploration-rewards').innerHTML = 
    '<div style="color: var(--green); font-weight: bold; font-size: 1.2rem;">+' + ppReward + ' PP</div>' +
    '<div style="color: var(--text-light); font-size: 0.9rem; margin-top: 8px;">Rare item added to inventory!</div>';
  
  var continueBtn = document.getElementById('exploration-continue-btn');
  continueBtn.textContent = 'Amazing!';
  continueBtn.onclick = closeExplorationModal;
  
  modal.classList.add('show');
}

async function handleFlavorEncounter() {
  var flavorEvents = [
    { text: "Your pet chased a butterfly and got distracted!", pp: 5, emoji: "🦋" },
    { text: "You found a cozy spot to rest. Your pet feels refreshed!", pp: 10, emoji: "🌸" },
    { text: "A friendly traveler shared some snacks with you!", pp: 15, emoji: "🍞" },
    { text: "You discovered some ancient markings on a tree... strange.", pp: 10, emoji: "🌳" },
    { text: "A cool breeze blows through. Your pet seems energized!", pp: 8, emoji: "💨" },
    { text: "You found some shiny pebbles along the path!", pp: 12, emoji: "✨" },
    { text: "Your pet rolled in some flowers. They smell lovely now!", pp: 7, emoji: "🌺" },
    { text: "You spotted a rainbow in the distance. How lucky!", pp: 15, emoji: "🌈" },
    { text: "A small bird dropped a berry in front of you!", pp: 9, emoji: "🫐" },
    { text: "You heard a mysterious melody in the wind...", pp: 11, emoji: "🎵" },
    { text: "Your pet found a comfortable sunny spot and napped!", pp: 8, emoji: "☀️" },
    { text: "You discovered a patch of four-leaf clovers!", pp: 13, emoji: "🍀" },
    { text: "A firefly landed on your pet's nose. How magical!", pp: 10, emoji: "✨" },
    { text: "You found an old coin half-buried in the dirt!", pp: 14, emoji: "🪙" }
  ];
  
  var event = flavorEvents[Math.floor(Math.random() * flavorEvents.length)];
  
  // Award PP
  await awardPP(event.pp);
  
  // Show result
  var modal = document.getElementById('exploration-modal');
  document.getElementById('exploration-title').textContent = event.emoji + ' Peaceful Moment';
  document.getElementById('exploration-result').innerHTML = event.text;
  document.getElementById('exploration-rewards').innerHTML = 
    '<div style="color: var(--green); font-weight: bold;">+' + event.pp + ' PP</div>';
  
  var continueBtn = document.getElementById('exploration-continue-btn');
  continueBtn.textContent = 'Nice!';
  continueBtn.onclick = closeExplorationModal;
  
  modal.classList.add('show');
}

function closeExplorationModal() {
  document.getElementById('exploration-modal').classList.remove('show');
  pendingBattleEnemy = null;
}

// ═══════════════════════════════════════════════════════════════════════════
// BATTLE SYSTEM (Original findBattle function)
// ═══════════════════════════════════════════════════════════════════════════

async function findBattle() {
  if (!selectedBattlePetId) {
    showToast('Select a pet first!');
    return;
  }
  
  // Check daily energy cap (250 energy = 50 battles per day)
  var today = new Date().toISOString().split('T')[0];
  var energyKey = 'energy_used_' + today;
  var energyUsedToday = parseInt(localStorage.getItem(energyKey)) || 0;
  
  if (energyUsedToday >= 250) {
    showToast('⚡ Daily battle limit reached! Your pet needs rest. Come back tomorrow!');
    return;
  }
  
  // Get player pet level
  var playerPetRes = await supabaseClient
    .from('user_pets')
    .select('level')
    .eq('id', selectedBattlePetId)
    .single();
  
  if (playerPetRes.error || !playerPetRes.data) {
    showToast('Error loading your pet!');
    return;
  }
  
  var playerLevel = playerPetRes.data.level || 1;
  
  // Get random enemy from selected zone with level variance
  var enemy = await getRandomEnemy(selectedBattleZone, playerLevel);
  
  if (!enemy) {
    showToast('No enemies found in this zone!');
    return;
  }
  
  // Track energy used today
  localStorage.setItem(energyKey, energyUsedToday + 5);
  
  // Start battle with the scaled enemy (pass the enemy object directly, not ID)
  await startBattleWithEnemy(selectedBattlePetId, enemy);
}

// Load battle pets when tab is opened
/**
 * Get random enemy from zone with level scaling
 */
async function getRandomEnemy(zone, playerLevel) {
  // ═══════════════════════════════════════════════════════════════════════
  // BOSS ENCOUNTER CHECK - 3% chance to encounter Shadow of Piper
  // ═══════════════════════════════════════════════════════════════════════
  var bossRoll = Math.random();
  if (bossRoll < 0.03) {  // 3% chance (~1 in 33 battles)
    console.log('🔥 BOSS ENCOUNTER! Shadow of Piper appears!');
    return await getBossEnemy(zone, playerLevel);
  }
  
  // Determine level range based on zone
  var minLevel, maxLevel;
  
  if (zone === 'outskirts') {
    // City Outskirts: -1 to +1 of player level (easier, more forgiving)
    minLevel = Math.max(1, playerLevel - 1);
    maxLevel = playerLevel + 1;
  } else if (zone === 'glade') {
    // Forest Glade: +0 to +2 of player level (harder)
    minLevel = playerLevel;
    maxLevel = playerLevel + 2;
  } else if (zone === 'deepwoods') {
    // Deep Woods: +1 to +3 of player level (very hard)
    minLevel = playerLevel + 1;
    maxLevel = playerLevel + 3;
  } else if (zone === 'ruins') {
    // Outside The Ruins: +2 to +5 of player level (extreme)
    minLevel = playerLevel + 2;
    maxLevel = playerLevel + 5;
  } else {
    // Default
    minLevel = playerLevel;
    maxLevel = playerLevel;
  }
  
  // Get base enemies for this zone
  var res = await supabaseClient
    .from('enemy_pets')
    .select('*')
    .eq('forest_zone', zone || 'outskirts');
  
  if (res.error || !res.data || res.data.length === 0) {
    console.error('No enemies found for zone:', zone, res.error);
    return null;
  }
  
  // Pick random base enemy
  var randomIndex = Math.floor(Math.random() * res.data.length);
  var baseEnemy = res.data[randomIndex];
  
  // Pick random level within range
  var enemyLevel = minLevel + Math.floor(Math.random() * (maxLevel - minLevel + 1));
  
  // ═══════════════════════════════════════════════════════════════════════
  // VARIANT SYSTEM - Baby/Adult/Elder + Elemental
  // ═══════════════════════════════════════════════════════════════════════
  
  var variant = 'baby';
  var elementalType = null;
  var statMultiplier = 1.0;
  
  if (zone === 'outskirts') {
    // City Outskirts: 100% Baby, no elementals
    variant = 'baby';
    statMultiplier = 0.8;
    
  } else if (zone === 'glade') {
    // Forest Glade: 50% Baby, 50% Adult, 10% chance of elemental
    var roll = Math.random();
    if (roll < 0.50) {
      variant = 'baby';
      statMultiplier = 0.8;
    } else {
      variant = 'adult';
      statMultiplier = 1.5;
    }
    
    // 10% chance for elemental variant
    if (Math.random() < 0.10) {
      var elementals = ['shadow', 'flame', 'frost'];
      elementalType = elementals[Math.floor(Math.random() * elementals.length)];
      statMultiplier *= 1.3; // Elementals are 30% stronger
    }
    
  } else if (zone === 'deepwoods') {
    // Deep Woods: 50% Adult, 50% Elder, 25% chance of elemental
    var roll = Math.random();
    if (roll < 0.50) {
      variant = 'adult';
      statMultiplier = 1.5;
    } else {
      variant = 'elder';
      statMultiplier = 2.2;
    }
    
    // 25% chance for elemental variant
    if (Math.random() < 0.25) {
      var elementals = ['shadow', 'flame', 'frost', 'storm'];
      elementalType = elementals[Math.floor(Math.random() * elementals.length)];
      statMultiplier *= 1.3; // Elementals are 30% stronger
    }
    
  } else if (zone === 'ruins') {
    // Outside The Ruins: 50% Adult, 50% Elder, 35% chance of elemental
    var roll = Math.random();
    if (roll < 0.50) {
      variant = 'adult';
      statMultiplier = 1.5;
    } else {
      variant = 'elder';
      statMultiplier = 2.2;
    }
    
    // 35% chance for elemental variant (higher than Deep Woods)
    if (Math.random() < 0.35) {
      var elementals = ['shadow', 'flame', 'frost', 'storm', 'void'];
      elementalType = elementals[Math.floor(Math.random() * elementals.length)];
      statMultiplier *= 1.3; // Elementals are 30% stronger
    }
  }
  
  // Build variant name
  var variantName = '';
  if (elementalType) {
    var elementalPrefix = {
      'shadow': 'Shadow',
      'flame': 'Flame',
      'frost': 'Frost',
      'storm': 'Storm',
      'void': 'Void'
    };
    variantName = elementalPrefix[elementalType] + ' ' + baseEnemy.name;
  } else {
    var variantPrefix = {
      'baby': 'Baby',
      'adult': 'Adult',
      'elder': 'Elder'
    };
    variantName = variantPrefix[variant] + ' ' + baseEnemy.name;
  }
  
  // Scale stats based on level (base stats + scaling per level)
  var levelBonus = enemyLevel - 1;
  var baseHP = Math.floor((baseEnemy.base_hp + (levelBonus * 8)) * statMultiplier);
  var baseATK = Math.floor((baseEnemy.base_attack + levelBonus) * statMultiplier);
  var baseDEF = Math.floor((baseEnemy.base_defense + Math.floor(levelBonus * 0.5)) * statMultiplier);
  var baseSPD = Math.floor((baseEnemy.base_speed + Math.floor(levelBonus * 0.5)) * statMultiplier);
  
  var scaledEnemy = {
    id: baseEnemy.id,
    species: baseEnemy.species,
    name: variantName,
    level: enemyLevel,
    base_hp: baseHP,
    base_attack: baseATK,
    base_defense: baseDEF,
    base_speed: baseSPD,
    image_file: baseEnemy.image_file,
    forest_zone: baseEnemy.forest_zone,
    difficulty_tier: baseEnemy.difficulty_tier,
    variant: variant,
    elementalType: elementalType
  };
  
  console.log('Generated enemy:', scaledEnemy.name, 'Level', enemyLevel, 'Variant:', variant, 'Elemental:', elementalType, 'Stats:', {
    hp: scaledEnemy.base_hp,
    atk: scaledEnemy.base_attack,
    def: scaledEnemy.base_defense,
    spd: scaledEnemy.base_speed
  });
  
  return scaledEnemy;
}

// ═══════════════════════════════════════════════════════════════════════
// BOSS ENCOUNTER SYSTEM - Shadow of Piper
// ═══════════════════════════════════════════════════════════════════════

async function getBossEnemy(zone, playerLevel) {
  // Convert zone shorthand to full name for database lookup
  var zoneNameMap = {
    'outskirts': 'City Outskirts',
    'glade': 'Forest Glade',
    'deepwoods': 'Deep Woods'
  };
  
  var fullZoneName = zoneNameMap[zone] || zone;
  
  // Fetch the boss from database
  var res = await supabaseClient
    .from('enemy_pets')
    .select('*')
    .eq('is_boss', true)
    .eq('forest_zone', fullZoneName)
    .single();
  
  if (res.error || !res.data) {
    console.error('Boss not found, falling back to normal enemy');
    return null;
  }
  
  var boss = res.data;
  
  // Scale boss level to player (+2 levels to make it scary)
  var bossLevel = playerLevel + 2;
  
  // Boss already has massive HP, just add level scaling
  var levelBonus = bossLevel - 1;
  
  return {
    id: boss.id,
    species: boss.species,
    name: boss.name,
    level: bossLevel,
    base_hp: boss.base_hp + (levelBonus * 15),  // Bosses scale faster!
    base_attack: boss.base_attack + levelBonus,
    base_defense: boss.base_defense + Math.floor(levelBonus * 0.5),
    base_speed: boss.base_speed + Math.floor(levelBonus * 0.5),
    image_file: boss.image_file,
    forest_zone: boss.forest_zone,
    difficulty_tier: boss.difficulty_tier,
    is_boss: true,
    exp_reward: boss.exp_reward,
    pp_reward: boss.pp_reward
  };
}

function triggerBossEntrance() {
  console.log('🔥 Triggering boss entrance sequence...');
  
  // Add UI fragmentation effect to entire page
  document.body.classList.add('boss-ui-glitch');
  
  // Stop ALL audio on the page (normal music, any other sounds)
  document.querySelectorAll('audio').forEach(function(audio) {
    audio.pause();
    audio.volume = 0;
  });
  
  // Play boss theme at lower volume
  if (!window.bossThemeAudio) {
    window.bossThemeAudio = new Audio('/boss-theme.mp3');
    window.bossThemeAudio.loop = true;
    window.bossThemeAudio.volume = 0.16;  // Reduced 20% (was 0.20)
    window.bossThemeAudio.onerror = function() {
      console.log('⚠️ Boss music file not found: /boss-theme.mp3');
      console.log('💡 Upload boss-theme.mp3 to your repo root to enable boss music!');
    };
  }
  window.bossThemeAudio.currentTime = 0;
  window.bossThemeAudio.volume = 0.16;  // Reduced 20% (was 0.20)
  
  window.bossThemeAudio.play().then(function() {
    console.log('🎵 Boss music playing!');
  }).catch(function(err) {
    console.log('⚠️ Boss music failed to play:', err.message);
  });
  
  // Add screen glitch effect - STAYS FOR ENTIRE FIGHT!
  var glitchOverlay = document.createElement('div');
  glitchOverlay.className = 'screen-glitch';
  glitchOverlay.id = 'boss-glitch-overlay';
  document.body.appendChild(glitchOverlay);
  
  // DON'T remove the glitch - it stays until battle ends!
  
  // Add boss entrance class to battle screen
  var battleScreen = el('battle-tab');
  if (battleScreen) {
    battleScreen.classList.add('boss-entrance', 'boss-battle-bg');
  }
  
  // Add BOSS BATTLE indicator
  var battleArea = el('battle-area');
  if (battleArea && !document.getElementById('boss-indicator')) {
    var indicator = document.createElement('div');
    indicator.id = 'boss-indicator';
    indicator.className = 'boss-battle-indicator';
    indicator.innerHTML = '⚠️ BOSS BATTLE ⚠️';
    battleArea.insertBefore(indicator, battleArea.firstChild);
  }
  
  // Start spawning creepy warning text
  startBossWarningText();
}

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
  console.log('💀 Boss death screen triggered...');
  
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
  
  // After fade completes, clean up and go home (now 6 seconds total)
  setTimeout(function() {
    // Remove all boss effects
    clearBossEffects();
    
    // Remove death warnings
    document.querySelectorAll('.boss-death-warning').forEach(function(w) {
      w.remove();
    });
    
    // Remove fade overlay
    fadeOverlay.remove();
    
    // Stop boss music and resume normal
    resumeNormalMusic();
    
    // Go to home tab
    showTab('home');
    
    // Show defeat toast
    showToast('💀 You were defeated by Shadow of Piper...');
  }, 6000); // Extended from 3500ms to 6000ms (6 seconds)
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
      console.log('Web Audio API not supported, falling back to simple fade');
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

function clearBossEffects() {
  // Remove boss effects after battle
  var battleScreen = el('battle-tab');
  if (battleScreen) {
    battleScreen.classList.remove('boss-entrance', 'boss-battle-bg');
  }
  
  // Remove UI fragmentation effect
  document.body.classList.remove('boss-ui-glitch');
  
  var indicator = document.getElementById('boss-indicator');
  if (indicator) indicator.remove();
  
  var glitch = document.getElementById('boss-glitch-overlay');
  if (glitch) glitch.remove();
  
  // Reset boss battle flag
  isBossBattle = false;
  
  // Stop creepy warning text
  stopBossWarningText();
  
  // Stop boss music
  if (window.bossThemeAudio) {
    window.bossThemeAudio.pause();
    window.bossThemeAudio.currentTime = 0;
  }
  
  // Resume ALL audio on page (restore normal music)
  document.querySelectorAll('audio').forEach(function(audio) {
    if (audio !== window.bossThemeAudio) {
      audio.volume = 0.5;  // Set to normal volume
      audio.play().catch(function() {}); // Silently fail if can't autoplay
    }
  });
}

// ========================================
// MELON MASCOT SPOOKY DIALOGUE SYSTEM
// ========================================

var melonDialogueTimeout = null;

function initMelonDialogue() {
  var dialogueEl = document.getElementById('melon-dialogue');
  if (!dialogueEl) return;
  
  // 3% chance for spooky dialogue (was 10%, now much rarer!)
  var isSpooky = Math.random() < 0.03;
  
  if (isSpooky) {
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
  
  // TRIGGER PAGE GLITCH EFFECT!
  var shopSection = document.getElementById('section-shop');
  if (shopSection) {
    shopSection.classList.add('page-glitch');
    // Remove glitch class after animation completes
    setTimeout(function() {
      shopSection.classList.remove('page-glitch');
    }, 800);
  }
  
  // Spooky message with glitchy "Piper"
  dialogueEl.innerHTML = 'I have to run the shop now that <span class="glitch-text">Piper</span> has gone missing';
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

var currentFriendTab = 'list';
var currentProfileUserId = null; // Track the profile being viewed
var currentFriendshipId = null; // Track friendship ID for current profile

// Update friend request notification badge
async function updateFriendRequestBadge() {
  if (!currentUser) return;
  
  try {
    var { data, error } = await supabaseClient
      .from('friendships')
      .select('id')
      .eq('addressee_id', currentUser.id)
      .eq('status', 'pending');
    
    if (error) throw error;
    
    var count = data ? data.length : 0;
    var badge = document.getElementById('friend-request-badge');
    
    if (badge) {
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
    
    // Also update the requests tab badge
    var requestsBadge = document.getElementById('requests-count-badge');
    if (requestsBadge) {
      if (count > 0) {
        requestsBadge.textContent = count;
        requestsBadge.style.display = 'inline';
      } else {
        requestsBadge.style.display = 'none';
      }
    }
  } catch (err) {
    console.error('Error updating friend request badge:', err);
  }
}

// Switch between friends tabs
function switchFriendsTab(tab) {
  currentFriendTab = tab;
  
  // Update tab buttons
  document.getElementById('tab-friends-list').classList.toggle('active', tab === 'list');
  document.getElementById('tab-friend-requests').classList.toggle('active', tab === 'requests');
  document.getElementById('tab-blocked-users').classList.toggle('active', tab === 'blocked');
  
  // Show/hide containers
  document.getElementById('friends-list-container').style.display = tab === 'list' ? 'block' : 'none';
  document.getElementById('friend-requests-container').style.display = tab === 'requests' ? 'block' : 'none';
  document.getElementById('blocked-users-container').style.display = tab === 'blocked' ? 'block' : 'none';
  
  // Load appropriate data
  if (tab === 'list') {
    loadFriendsList();
  } else if (tab === 'requests') {
    loadFriendRequests();
  } else if (tab === 'blocked') {
    loadBlockedUsers();
  }
}

// Load friends list
async function loadFriendsList() {
  if (!currentUser) return;
  
  var container = document.getElementById('friends-list-container');
  container.innerHTML = '<div class="spinner"></div>';
  
  try {
    // Get friendships where current user is either requester or addressee and status is accepted
    var { data: friendships, error } = await supabaseClient
      .from('friendships')
      .select('id, requester_id, addressee_id, created_at')
      .eq('status', 'accepted')
      .or('requester_id.eq.' + currentUser.id + ',addressee_id.eq.' + currentUser.id);
    
    if (error) throw error;
    
    if (!friendships || friendships.length === 0) {
      container.innerHTML = '<div class="empty-state"><div style="font-size:3rem;margin-bottom:12px;">👥</div><p>No friends yet!</p><p style="color:var(--text-light);font-size:0.9rem;">Search for players above to send friend requests.</p></div>';
      document.getElementById('friends-count-badge').textContent = '0';
      return;
    }
    
    // Get the friend user IDs (the other person in each friendship)
    var friendIds = friendships.map(function(f) {
      return f.requester_id === currentUser.id ? f.addressee_id : f.requester_id;
    });
    
    // Fetch friend data
    var { data: friends, error: friendError } = await supabaseClient
      .from('players')
      .select('id, username, pawketpoints, created_at')
      .in('id', friendIds);
    
    if (friendError) throw friendError;
    
    // Get pet counts and levels for each friend
    var { data: petData, error: petError } = await supabaseClient
      .from('user_pets')
      .select('user_id, level')
      .in('user_id', friendIds);
    
    if (petError) throw petError;
    
    // Get badge counts for each friend
    var { data: badgeData, error: badgeError } = await supabaseClient
      .from('user_badges')
      .select('user_id')
      .in('user_id', friendIds);
    
    if (badgeError) throw badgeError;
    
    // Calculate stats for each friend
    friends.forEach(function(friend) {
      var pets = petData.filter(function(p) { return p.user_id === friend.id; });
      friend.petCount = pets.length;
      friend.totalLevel = pets.reduce(function(sum, p) { return sum + (p.level || 0); }, 0);
      friend.badgeCount = badgeData.filter(function(b) { return b.user_id === friend.id; }).length;
      friend.friendshipId = friendships.find(function(f) {
        return f.requester_id === friend.id || f.addressee_id === friend.id;
      }).id;
    });
    
    // Sort by points
    friends.sort(function(a, b) { return (b.pawketpoints || 0) - (a.pawketpoints || 0); });
    
    // Render friend cards
    var html = '';
    friends.forEach(function(friend) {
      html += renderFriendCard(friend, 'friend');
    });
    
    container.innerHTML = html;
    document.getElementById('friends-count-badge').textContent = friends.length;
    
  } catch (err) {
    container.innerHTML = '<div class="empty-state"><p>Error loading friends: ' + err.message + '</p></div>';
    console.error('Error loading friends:', err);
  }
}

// Load friend requests
async function loadFriendRequests() {
  if (!currentUser) return;
  
  var container = document.getElementById('friend-requests-container');
  container.innerHTML = '<div class="spinner"></div>';
  
  try {
    // Get pending requests where current user is the addressee
    var { data: requests, error } = await supabaseClient
      .from('friendships')
      .select('id, requester_id, created_at')
      .eq('addressee_id', currentUser.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    if (!requests || requests.length === 0) {
      container.innerHTML = '<div class="empty-state"><div style="font-size:3rem;margin-bottom:12px;">📬</div><p>No pending friend requests</p></div>';
      return;
    }
    
    // Get requester user data
    var requesterIds = requests.map(function(r) { return r.requester_id; });
    var { data: requesters, error: requesterError } = await supabaseClient
      .from('players')
      .select('id, username, pawketpoints, created_at')
      .in('id', requesterIds);
    
    if (requesterError) throw requesterError;
    
    // Get stats for each requester
    var { data: petData, error: petError } = await supabaseClient
      .from('user_pets')
      .select('user_id, level')
      .in('user_id', requesterIds);
    
    if (petError) throw petError;
    
    var { data: badgeData, error: badgeError } = await supabaseClient
      .from('user_badges')
      .select('user_id')
      .in('user_id', requesterIds);
    
    if (badgeError) throw badgeError;
    
    // Match up data
    requesters.forEach(function(requester) {
      var pets = petData.filter(function(p) { return p.user_id === requester.id; });
      requester.petCount = pets.length;
      requester.totalLevel = pets.reduce(function(sum, p) { return sum + (p.level || 0); }, 0);
      requester.badgeCount = badgeData.filter(function(b) { return b.user_id === requester.id; }).length;
      requester.friendshipId = requests.find(function(r) { return r.requester_id === requester.id; }).id;
    });
    
    // Render request cards
    var html = '';
    requesters.forEach(function(requester) {
      html += renderFriendCard(requester, 'request');
    });
    
    container.innerHTML = html;
    
  } catch (err) {
    container.innerHTML = '<div class="empty-state"><p>Error loading requests: ' + err.message + '</p></div>';
    console.error('Error loading friend requests:', err);
  }
}

// Load blocked users
async function loadBlockedUsers() {
  if (!currentUser) return;
  
  var container = document.getElementById('blocked-users-container');
  container.innerHTML = '<div class="spinner"></div>';
  
  try {
    var { data: blocks, error } = await supabaseClient
      .from('blocked_users')
      .select('id, blocked_user_id, created_at')
      .eq('blocker_id', currentUser.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    if (!blocks || blocks.length === 0) {
      container.innerHTML = '<div class="empty-state"><div style="font-size:3rem;margin-bottom:12px;">✅</div><p>No blocked users</p></div>';
      document.getElementById('blocked-count-badge').style.display = 'none';
      return;
    }
    
    // Get blocked user data
    var blockedIds = blocks.map(function(b) { return b.blocked_user_id; });
    var { data: blockedUsers, error: userError } = await supabaseClient
      .from('players')
      .select('id, username, created_at')
      .in('id', blockedIds);
    
    if (userError) throw userError;
    
    // Match up block IDs
    blockedUsers.forEach(function(user) {
      user.blockId = blocks.find(function(b) { return b.blocked_user_id === user.id; }).id;
    });
    
    // Render blocked user cards
    var html = '';
    blockedUsers.forEach(function(user) {
      html += renderFriendCard(user, 'blocked');
    });
    
    container.innerHTML = html;
    document.getElementById('blocked-count-badge').textContent = blockedUsers.length;
    document.getElementById('blocked-count-badge').style.display = 'inline';
    
  } catch (err) {
    container.innerHTML = '<div class="empty-state"><p>Error loading blocked users: ' + err.message + '</p></div>';
    console.error('Error loading blocked users:', err);
  }
}

// Render friend card (used for friends, requests, and blocked users)
function renderFriendCard(user, type) {
  var cardClass = type === 'request' ? 'friend-request-card' : type === 'blocked' ? 'blocked-user-card' : '';
  
  var html = '<div class="friend-card ' + cardClass + '">';
  html += '  <div class="friend-avatar">' + user.username.charAt(0).toUpperCase() + '</div>';
  html += '  <div class="friend-info">';
  html += '    <div class="friend-username" onclick="viewProfile(\'' + escapeHtml(user.username) + '\')">' + escapeHtml(user.username) + '</div>';
  
  if (type !== 'blocked') {
    html += '    <div class="friend-stats">';
    html += '      <span class="friend-stat">🪙 ' + (user.pawketpoints || 0).toLocaleString() + ' PP</span>';
    html += '      <span class="friend-stat">🐾 ' + (user.petCount || 0) + ' Pets</span>';
    html += '      <span class="friend-stat">⭐ Level ' + (user.totalLevel || 0) + '</span>';
    html += '      <span class="friend-stat">🎖️ ' + (user.badgeCount || 0) + ' Badges</span>';
    html += '    </div>';
  }
  
  html += '  </div>';
  html += '  <div class="friend-actions">';
  
  if (type === 'friend') {
    html += '<button class="btn btn-outline btn-sm" onclick="viewProfile(\'' + escapeHtml(user.username) + '\')">View Profile</button>';
    html += '<button class="btn btn-outline btn-sm btn-danger" onclick="confirmRemoveFriend(\'' + user.friendshipId + '\', \'' + escapeHtml(user.username) + '\')">Remove Friend</button>';
  } else if (type === 'request') {
    html += '<button class="btn btn-primary btn-sm" onclick="acceptFriendRequest(\'' + user.friendshipId + '\')">Accept</button>';
    html += '<button class="btn btn-outline btn-sm" onclick="declineFriendRequest(\'' + user.friendshipId + '\')">Decline</button>';
  } else if (type === 'blocked') {
    html += '<button class="btn btn-outline btn-sm" onclick="confirmUnblock(\'' + user.blockId + '\', \'' + escapeHtml(user.username) + '\')">Unblock</button>';
  }
  
  html += '  </div>';
  html += '</div>';
  
  return html;
}

// Search for players
async function searchPlayers() {
  var searchInput = document.getElementById('friend-search-input');
  var query = searchInput.value.trim();
  var resultsContainer = document.getElementById('friend-search-results');
  
  if (!query) {
    resultsContainer.innerHTML = '';
    return;
  }
  
  resultsContainer.innerHTML = '<div class="spinner"></div>';
  
  try {
    var { data: players, error } = await supabaseClient
      .from('players')
      .select('id, username, pawketpoints, created_at')
      .ilike('username', '%' + query + '%')
      .limit(5);
    
    if (error) throw error;
    
    if (!players || players.length === 0) {
      resultsContainer.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:16px;">No players found matching "' + escapeHtml(query) + '"</p>';
      return;
    }
    
    // Get stats for each player
    var playerIds = players.map(function(p) { return p.id; });
    
    var { data: petData } = await supabaseClient
      .from('user_pets')
      .select('user_id, level')
      .in('user_id', playerIds);
    
    var { data: badgeData } = await supabaseClient
      .from('user_badges')
      .select('user_id')
      .in('user_id', playerIds);
    
    // Check friendship status for each
    var { data: friendships } = await supabaseClient
      .from('friendships')
      .select('requester_id, addressee_id, status')
      .or('requester_id.eq.' + currentUser.id + ',addressee_id.eq.' + currentUser.id)
      .in('requester_id', playerIds.concat([currentUser.id]))
      .in('addressee_id', playerIds.concat([currentUser.id]));
    
    players.forEach(function(player) {
      var pets = petData ? petData.filter(function(p) { return p.user_id === player.id; }) : [];
      player.petCount = pets.length;
      player.totalLevel = pets.reduce(function(sum, p) { return sum + (p.level || 0); }, 0);
      player.badgeCount = badgeData ? badgeData.filter(function(b) { return b.user_id === player.id; }).length : 0;
      
      // Check friendship status
      var friendship = friendships ? friendships.find(function(f) {
        return (f.requester_id === currentUser.id && f.addressee_id === player.id) ||
               (f.addressee_id === currentUser.id && f.requester_id === player.id);
      }) : null;
      
      player.friendshipStatus = friendship ? friendship.status : null;
      player.isSelf = player.id === currentUser.id;
    });
    
    // Render search results
    var html = '';
    players.forEach(function(player) {
      html += '<div class="friend-card search-result-card">';
      html += '  <div class="friend-avatar">' + player.username.charAt(0).toUpperCase() + '</div>';
      html += '  <div class="friend-info">';
      html += '    <div class="friend-username" onclick="viewProfile(\'' + escapeHtml(player.username) + '\')">' + escapeHtml(player.username) + '</div>';
      html += '    <div class="friend-stats">';
      html += '      <span class="friend-stat">🪙 ' + (player.pawketpoints || 0).toLocaleString() + ' PP</span>';
      html += '      <span class="friend-stat">🐾 ' + player.petCount + ' Pets</span>';
      html += '      <span class="friend-stat">⭐ Level ' + player.totalLevel + '</span>';
      html += '      <span class="friend-stat">🎖️ ' + player.badgeCount + ' Badges</span>';
      html += '    </div>';
      html += '  </div>';
      html += '  <div class="friend-actions">';
      
      if (player.isSelf) {
        html += '<span style="color:var(--text-light);font-size:0.9rem;">This is you!</span>';
      } else if (player.friendshipStatus === 'accepted') {
        html += '<button class="btn btn-success btn-sm" disabled>✅ Friends</button>';
      } else if (player.friendshipStatus === 'pending') {
        html += '<button class="btn btn-outline btn-sm" disabled>⏳ Request Pending</button>';
      } else {
        html += '<button class="btn btn-primary btn-sm" onclick="sendFriendRequestToUser(\'' + player.id + '\', \'' + escapeHtml(player.username) + '\')">➕ Add Friend</button>';
      }
      
      html += '<button class="btn btn-outline btn-sm" onclick="viewProfile(\'' + escapeHtml(player.username) + '\')">View Profile</button>';
      html += '  </div>';
      html += '</div>';
    });
    
    resultsContainer.innerHTML = html;
    
  } catch (err) {
    resultsContainer.innerHTML = '<p style="text-align:center;color:var(--red);padding:16px;">Error: ' + err.message + '</p>';
    console.error('Error searching players:', err);
  }
}

// Send friend request from search results
async function sendFriendRequestToUser(userId, username) {
  if (!currentUser) return;
  
  try {
    var { error } = await supabaseClient
      .from('friendships')
      .insert([{
        requester_id: currentUser.id,
        addressee_id: userId,
        status: 'pending'
      }]);
    
    if (error) throw error;
    
    showToast('Friend request sent to ' + username + '! 🎉');
    searchPlayers(); // Refresh search results
    
  } catch (err) {
    showToast('Error sending friend request: ' + err.message);
    console.error('Error sending friend request:', err);
  }
}

// Send friend request from profile page
async function sendFriendRequest() {
  if (!currentUser || !currentProfileUserId) return;
  
  try {
    var { error } = await supabaseClient
      .from('friendships')
      .insert([{
        requester_id: currentUser.id,
        addressee_id: currentProfileUserId,
        status: 'pending'
      }]);
    
    if (error) throw error;
    
    showToast('Friend request sent! 🎉');
    updateProfileButtons(); // Refresh button state
    
  } catch (err) {
    showToast('Error: ' + err.message);
    console.error('Error sending friend request:', err);
  }
}

// Accept friend request
async function acceptFriendRequest(friendshipId) {
  try {
    var { error } = await supabaseClient
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);
    
    if (error) throw error;
    
    showToast('Friend request accepted! 🎉');
    await updateFriendRequestBadge();
    loadFriendRequests();
    
  } catch (err) {
    showToast('Error: ' + err.message);
    console.error('Error accepting friend request:', err);
  }
}

// Decline friend request
async function declineFriendRequest(friendshipId) {
  try {
    var { error } = await supabaseClient
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    
    if (error) throw error;
    
    showToast('Friend request declined');
    await updateFriendRequestBadge();
    loadFriendRequests();
    
  } catch (err) {
    showToast('Error: ' + err.message);
    console.error('Error declining friend request:', err);
  }
}

// Confirm and remove friend
function confirmRemoveFriend(friendshipId, username) {
  if (confirm('Remove ' + username + ' from your friends list?')) {
    removeFriendById(friendshipId);
  }
}

async function removeFriendById(friendshipId) {
  try {
    var { error } = await supabaseClient
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    
    if (error) throw error;
    
    showToast('Friend removed');
    loadFriendsList();
    
  } catch (err) {
    showToast('Error: ' + err.message);
    console.error('Error removing friend:', err);
  }
}

// Remove friend from profile page
async function removeFriend() {
  if (!currentFriendshipId) return;
  
  var username = document.getElementById('profile-username').textContent;
  if (confirm('Remove ' + username + ' from your friends list?')) {
    removeFriendById(currentFriendshipId);
    updateProfileButtons();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOCKING SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

// Block user from profile
async function blockUser() {
  if (!currentUser || !currentProfileUserId) return;
  
  var username = document.getElementById('profile-username').textContent;
  if (!confirm('Block ' + username + '? They will not be able to view your profile or send you messages.')) {
    return;
  }
  
  try {
    // Remove friendship if exists
    await supabaseClient
      .from('friendships')
      .delete()
      .or('and(requester_id.eq.' + currentUser.id + ',addressee_id.eq.' + currentProfileUserId + '),and(requester_id.eq.' + currentProfileUserId + ',addressee_id.eq.' + currentUser.id + ')');
    
    // Add to blocked users
    var { error } = await supabaseClient
      .from('blocked_users')
      .insert([{
        blocker_id: currentUser.id,
        blocked_user_id: currentProfileUserId
      }]);
    
    if (error) throw error;
    
    showToast('User blocked');
    updateProfileButtons();
    
  } catch (err) {
    showToast('Error: ' + err.message);
    console.error('Error blocking user:', err);
  }
}

// Unblock user from profile
async function unblockUser() {
  if (!currentUser || !currentProfileUserId) return;
  
  try {
    var { error } = await supabaseClient
      .from('blocked_users')
      .delete()
      .eq('blocker_id', currentUser.id)
      .eq('blocked_user_id', currentProfileUserId);
    
    if (error) throw error;
    
    showToast('User unblocked');
    updateProfileButtons();
    
  } catch (err) {
    showToast('Error: ' + err.message);
    console.error('Error unblocking user:', err);
  }
}

// Confirm and unblock from blocked users list
function confirmUnblock(blockId, username) {
  if (confirm('Unblock ' + username + '?')) {
    unblockById(blockId);
  }
}

async function unblockById(blockId) {
  try {
    var { error } = await supabaseClient
      .from('blocked_users')
      .delete()
      .eq('id', blockId);
    
    if (error) throw error;
    
    showToast('User unblocked');
    loadBlockedUsers();
    
  } catch (err) {
    showToast('Error: ' + err.message);
    console.error('Error unblocking user:', err);
  }
}

// Update profile action buttons based on relationship status
async function updateProfileButtons() {
  if (!currentUser || !currentProfileUserId) return;
  
  var actionsDiv = document.getElementById('profile-actions');
  var addFriendBtn = document.getElementById('add-friend-btn');
  var pendingBtn = document.getElementById('pending-friend-btn');
  var alreadyFriendsBtn = document.getElementById('already-friends-btn');
  var removeFriendBtn = document.getElementById('remove-friend-btn');
  var blockBtn = document.getElementById('block-user-btn');
  var unblockBtn = document.getElementById('unblock-user-btn');
  var guestbookForm = document.getElementById('guestbook-post-form');
  
  // Hide all buttons initially
  [addFriendBtn, pendingBtn, alreadyFriendsBtn, removeFriendBtn, blockBtn, unblockBtn].forEach(function(btn) {
    if (btn) btn.style.display = 'none';
  });
  
  // Check if viewing own profile
  if (currentProfileUserId === currentUser.id) {
    actionsDiv.style.display = 'none';
    if (guestbookForm) guestbookForm.style.display = 'none';
    return;
  }
  
  actionsDiv.style.display = 'flex';
  
  try {
    // Check if blocked
    var { data: blockCheck } = await supabaseClient
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', currentUser.id)
      .eq('blocked_user_id', currentProfileUserId)
      .single();
    
    if (blockCheck) {
      // User is blocked
      if (unblockBtn) unblockBtn.style.display = 'inline-block';
      if (guestbookForm) guestbookForm.style.display = 'none';
      return;
    }
    
    // Show block button
    if (blockBtn) blockBtn.style.display = 'inline-block';
    
    // Check friendship status
    var { data: friendship } = await supabaseClient
      .from('friendships')
      .select('id, status, requester_id, addressee_id')
      .or('and(requester_id.eq.' + currentUser.id + ',addressee_id.eq.' + currentProfileUserId + '),and(requester_id.eq.' + currentProfileUserId + ',addressee_id.eq.' + currentUser.id + ')')
      .single();
    
    if (friendship) {
      currentFriendshipId = friendship.id;
      
      if (friendship.status === 'accepted') {
        // Already friends
        if (alreadyFriendsBtn) alreadyFriendsBtn.style.display = 'inline-block';
        if (removeFriendBtn) removeFriendBtn.style.display = 'inline-block';
      } else if (friendship.status === 'pending') {
        // Request pending
        if (pendingBtn) pendingBtn.style.display = 'inline-block';
      }
    } else {
      // No friendship - show add friend button
      currentFriendshipId = null;
      if (addFriendBtn) addFriendBtn.style.display = 'inline-block';
    }
    
    // Show guestbook form if not blocked
    if (guestbookForm) guestbookForm.style.display = 'block';
    
  } catch (err) {
    console.error('Error updating profile buttons:', err);
    // If error, show add friend button as default
    if (addFriendBtn) addFriendBtn.style.display = 'inline-block';
    if (blockBtn) blockBtn.style.display = 'inline-block';
    if (guestbookForm) guestbookForm.style.display = 'block';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GUESTBOOK SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

// Character counter for guestbook
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

// Post guestbook message
async function postGuestbookMessage() {
  if (!currentUser || !currentProfileUserId) return;
  
  var messageInput = document.getElementById('guestbook-message-input');
  var message = messageInput.value.trim();
  
  if (!message) {
    showToast('Please enter a message');
    return;
  }
  
  if (message.length > 500) {
    showToast('Message is too long (max 500 characters)');
    return;
  }
  
  try {
    var { error } = await supabaseClient
      .from('guestbook_entries')
      .insert([{
        profile_user_id: currentProfileUserId,
        author_id: currentUser.id,
        message: message
      }]);
    
    if (error) throw error;
    
    showToast('Message posted! 💖');
    messageInput.value = '';
    document.getElementById('guestbook-char-count').textContent = '0 / 500';
    loadGuestbookEntries(currentProfileUserId);
    
  } catch (err) {
    showToast('Error posting message: ' + err.message);
    console.error('Error posting guestbook message:', err);
  }
}

// Load guestbook entries
async function loadGuestbookEntries(profileUserId) {
  var container = document.getElementById('guestbook-entries');
  if (!container) return;
  
  container.innerHTML = '<div class="spinner"></div>';
  
  try {
    // Get guestbook entries with author info
    var { data: entries, error } = await supabaseClient
      .from('guestbook_entries')
      .select('id, author_id, message, created_at, players!guestbook_entries_author_id_fkey(username)')
      .eq('profile_user_id', profileUserId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) throw error;
    
    if (!entries || entries.length === 0) {
      container.innerHTML = '<div class="guestbook-empty"><div class="guestbook-empty-icon">📖</div><p>No messages yet!</p><p style="font-size:0.9rem;color:var(--text-light);margin-top:8px;">Be the first to leave a message!</p></div>';
      return;
    }
    
    // Render entries
    var html = '';
    entries.forEach(function(entry) {
      var author = entry.players;
      var authorName = author ? author.username : 'Unknown User';
      var canDelete = currentUser && (entry.author_id === currentUser.id || profileUserId === currentUser.id);
      
      var timestamp = new Date(entry.created_at);
      var timeAgo = getTimeAgo(timestamp);
      
      html += '<div class="guestbook-entry">';
      html += '  <div class="guestbook-header">';
      html += '    <div class="guestbook-author">';
      html += '      <div class="guestbook-author-avatar">' + authorName.charAt(0).toUpperCase() + '</div>';
      html += '      <div class="guestbook-author-info">';
      html += '        <div class="guestbook-author-name" onclick="viewProfile(\'' + escapeHtml(authorName) + '\')">' + escapeHtml(authorName) + '</div>';
      html += '        <div class="guestbook-timestamp">' + timeAgo + '</div>';
      html += '      </div>';
      html += '    </div>';
      
      if (canDelete) {
        html += '    <div class="guestbook-actions">';
        html += '      <button class="btn btn-outline btn-sm btn-danger" onclick="deleteGuestbookEntry(\'' + entry.id + '\')">Delete</button>';
        html += '    </div>';
      }
      
      html += '  </div>';
      html += '  <div class="guestbook-message">' + escapeHtml(entry.message) + '</div>';
      html += '</div>';
    });
    
    container.innerHTML = html;
    
  } catch (err) {
    container.innerHTML = '<div class="guestbook-empty"><p>Error loading messages: ' + err.message + '</p></div>';
    console.error('Error loading guestbook entries:', err);
  }
}

// Delete guestbook entry
async function deleteGuestbookEntry(entryId) {
  if (!confirm('Delete this message?')) return;
  
  try {
    var { error } = await supabaseClient
      .from('guestbook_entries')
      .delete()
      .eq('id', entryId);
    
    if (error) throw error;
    
    showToast('Message deleted');
    loadGuestbookEntries(currentProfileUserId);
    
  } catch (err) {
    showToast('Error: ' + err.message);
    console.error('Error deleting guestbook entry:', err);
  }
}

// Helper function to get "time ago" string
function getTimeAgo(date) {
  var now = new Date();
  var seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return 'Just now';
  
  var minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + ' minute' + (minutes === 1 ? '' : 's') + ' ago';
  
  var hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + ' hour' + (hours === 1 ? '' : 's') + ' ago';
  
  var days = Math.floor(hours / 24);
  if (days < 30) return days + ' day' + (days === 1 ? '' : 's') + ' ago';
  
  var months = Math.floor(days / 30);
  if (months < 12) return months + ' month' + (months === 1 ? '' : 's') + ' ago';
  
  var years = Math.floor(months / 12);
  return years + ' year' + (years === 1 ? '' : 's') + ' ago';
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE EXISTING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

// Modify the existing loadProfile function to integrate new features
var originalLoadProfile = loadProfile;
loadProfile = async function(username) {
  await originalLoadProfile(username);
  
  // Get the profile user ID
  var profileRes = await supabaseClient
    .from('players')
    .select('id')
    .ilike('username', username)
    .single();
  
  if (profileRes.data) {
    currentProfileUserId = profileRes.data.id;
    
    // Update action buttons
    await updateProfileButtons();
    
    // Load guestbook
    await loadGuestbookEntries(currentProfileUserId);
  }
};

// Add friends tab to tabsLoaded
tabsLoaded.friends = function() {
  updateFriendRequestBadge();
  switchFriendsTab('list');
};

// Update the init function to load friend request badge
var originalInit = init;
init = async function() {
  await originalInit();
  await updateFriendRequestBadge();
  
  // Poll for friend requests every 30 seconds
  setInterval(updateFriendRequestBadge, 30000);
};


// ═══════════════════════════════════════════════════════════════════════════
// ACTIVITY FEED BOX (Sidebar)
// ═══════════════════════════════════════════════════════════════════════════

var activityFeedInterval = null;
var currentActivities = [];
var currentActivityIndex = 0;

// Start the activity feed rotation
async function startActivityFeed() {
  if (!currentUser) return;
  
  // Load activities initially
  await loadFriendActivities();
  
  // Rotate through activities every 5 seconds
  activityFeedInterval = setInterval(rotateActivity, 5000);
}

// Stop the activity feed rotation
function stopActivityFeed() {
  if (activityFeedInterval) {
    clearInterval(activityFeedInterval);
    activityFeedInterval = null;
  }
}

// Load friend activities from database
async function loadFriendActivities() {
  if (!currentUser) return;
  
  try {
    // Get friend IDs
    var { data: friendships, error: friendError } = await supabaseClient
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or('requester_id.eq.' + currentUser.id + ',addressee_id.eq.' + currentUser.id);
    
    if (friendError) throw friendError;
    
    if (!friendships || friendships.length === 0) {
      // No friends - show default message
      currentActivities = [];
      updateActivityFeedDisplay();
      return;
    }
    
    // Get friend user IDs
    var friendIds = friendships.map(function(f) {
      return f.requester_id === currentUser.id ? f.addressee_id : f.requester_id;
    });
    
    // Get recent activities from friends (last 50)
    var { data: activities, error: actError } = await supabaseClient
      .from('activity_feed')
      .select('*, players(username)')
      .in('user_id', friendIds)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (actError) throw actError;
    
    currentActivities = activities || [];
    currentActivityIndex = 0;
    updateActivityFeedDisplay();
    
  } catch (err) {
    console.error('Error loading friend activities:', err);
  }
}

// Rotate to next activity
function rotateActivity() {
  if (currentActivities.length === 0) return;
  
  currentActivityIndex = (currentActivityIndex + 1) % currentActivities.length;
  updateActivityFeedDisplay();
}

// Update the activity feed display
function updateActivityFeedDisplay() {
  var messageEl = document.getElementById('activity-feed-message');
  if (!messageEl) return;
  
  if (currentActivities.length === 0) {
    messageEl.textContent = 'Add friends to see their activity!';
    messageEl.style.color = 'var(--text-light)';
    return;
  }
  
  var activity = currentActivities[currentActivityIndex];
  var username = activity.players ? activity.players.username : 'Someone';
  var message = formatActivityMessage(activity, username);
  
  // Fade out, change text, fade in
  messageEl.style.animation = 'none';
  setTimeout(function() {
    messageEl.textContent = message;
    messageEl.style.color = 'var(--text)';
    messageEl.style.animation = 'activity-fade-in 0.5s ease-in-out';
  }, 50);
}

// Log an activity to the activity_feed table
async function logActivity(activityType, activityData) {
  if (!currentUser) return;
  
  try {
    await supabaseClient
      .from('activity_feed')
      .insert([{
        user_id: currentUser.id,
        activity_type: activityType,
        activity_data: activityData,
        is_public: true
      }]);
    
    console.log('📢 Activity logged:', activityType, activityData);
  } catch (err) {
    console.error('Error logging activity:', err);
  }
}

// Format activity message based on type
function formatActivityMessage(activity, username) {
  var type = activity.activity_type;
  var data = activity.activity_data || {};
  
  switch(type) {
    case 'badge_earned':
      return username + ' just earned the ' + (data.badge_name || 'Badge') + '! ' + (data.badge_icon || '🎖️');
    
    case 'level_up':
      var petName = data.pet_name || 'their pet';
      var level = data.level || '?';
      return username + "'s " + petName + ' just hit level ' + level + '! 🎉';
    
    case 'pet_adopted':
      var petName = data.pet_name || 'a new pet';
      return username + ' just adopted ' + petName + '! 🐾';
    
    case 'achievement_unlocked':
      return username + ' unlocked: ' + (data.achievement_name || 'Achievement') + '! ⭐';
    
    case 'battle_victory':
      var enemy = data.enemy_name || 'an enemy';
      return username + ' defeated ' + enemy + '! ⚔️';
    
    case 'boss_defeated':
      var boss = data.boss_name || 'a boss';
      return username + ' defeated ' + boss + '! 💀🎉';
    
    default:
      return username + ' did something cool! ✨';
  }
}

// Refresh activity feed (call this periodically)
async function refreshActivityFeed() {
  await loadFriendActivities();
}

// Update init function to start activity feed
var originalInitForActivity = init;
init = async function() {
  await originalInitForActivity();
  await startActivityFeed();
  
  // Refresh activity feed every 2 minutes
  setInterval(refreshActivityFeed, 120000);
};


// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

var notificationDropdownOpen = false;
var currentNotifications = [];

// Toggle notification dropdown
function toggleNotificationDropdown() {
  var dropdown = document.getElementById('notification-dropdown');
  
  if (notificationDropdownOpen) {
    closeNotificationDropdown();
  } else {
    openNotificationDropdown();
  }
}

// Open notification dropdown
async function openNotificationDropdown() {
  var dropdown = document.getElementById('notification-dropdown');
  dropdown.style.display = 'block';
  notificationDropdownOpen = true;
  
  // Add overlay to close when clicking outside
  var overlay = document.createElement('div');
  overlay.className = 'notification-overlay';
  overlay.id = 'notification-overlay';
  overlay.onclick = closeNotificationDropdown;
  document.body.appendChild(overlay);
  
  // Load notifications
  await loadNotifications();
}

// Close notification dropdown
function closeNotificationDropdown() {
  var dropdown = document.getElementById('notification-dropdown');
  dropdown.style.display = 'none';
  notificationDropdownOpen = false;
  
  var overlay = document.getElementById('notification-overlay');
  if (overlay) overlay.remove();
}

// Load notifications
async function loadNotifications() {
  if (!currentUser) return;
  
  var listEl = document.getElementById('notification-list');
  listEl.innerHTML = '<div class="spinner"></div>';
  
  try {
    var { data: notifications, error } = await supabaseClient
      .from('notifications')
      .select('*, players!notifications_from_user_id_fkey(username)')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) throw error;
    
    currentNotifications = notifications || [];
    
    if (currentNotifications.length === 0) {
      listEl.innerHTML = '<div class="notification-empty">No notifications</div>';
      return;
    }
    
    // Render notifications
    var html = '';
    currentNotifications.forEach(function(notif) {
      html += renderNotification(notif);
    });
    
    listEl.innerHTML = html;
    
  } catch (err) {
    console.error('Error loading notifications:', err);
    listEl.innerHTML = '<div class="notification-empty">Error loading notifications</div>';
  }
}

// Render a single notification
function renderNotification(notif) {
  var icon = getNotificationIcon(notif.type);
  var timeAgo = getTimeAgo(new Date(notif.created_at));
  var unreadClass = notif.is_read ? '' : 'unread';
  var fromUsername = notif.players ? notif.players.username : 'Someone';
  
  var html = '<div class="notification-item ' + unreadClass + '" onclick="handleNotificationClick(\'' + notif.id + '\', \'' + (notif.link || '') + '\')">';
  html += '  <span class="notification-icon">' + icon + '</span>';
  html += '  <div class="notification-content">';
  html += '    <div class="notification-title">' + escapeHtml(notif.title) + '</div>';
  html += '    <div class="notification-message">' + escapeHtml(notif.message) + '</div>';
  html += '    <div class="notification-time">' + timeAgo + '</div>';
  html += '  </div>';
  html += '</div>';
  
  return html;
}

// Get icon for notification type
function getNotificationIcon(type) {
  switch(type) {
    case 'friend_request': return '👥';
    case 'friend_accepted': return '✅';
    case 'guestbook_message': return '📝';
    case 'badge_earned': return '🎖️';
    case 'level_up': return '⭐';
    default: return '🔔';
  }
}

// Handle notification click
async function handleNotificationClick(notificationId, link) {
  // Mark as read
  await markNotificationRead(notificationId);
  
  // Close dropdown
  closeNotificationDropdown();
  
  // Navigate to link
  if (link) {
    if (link.startsWith('tab:')) {
      var tab = link.replace('tab:', '');
      showTab(tab);
    } else if (link.startsWith('profile:')) {
      var username = link.replace('profile:', '');
      viewProfile(username);
    }
  }
  
  // Refresh notification badge
  await updateNotificationBadge();
}

// Mark notification as read
async function markNotificationRead(notificationId) {
  try {
    await supabaseClient
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
  } catch (err) {
    console.error('Error marking notification as read:', err);
  }
}

// Mark all notifications as read
async function markAllNotificationsRead() {
  if (!currentUser) return;
  
  try {
    await supabaseClient
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', currentUser.id)
      .eq('is_read', false);
    
    await loadNotifications();
    await updateNotificationBadge();
    
  } catch (err) {
    console.error('Error marking all as read:', err);
  }
}

// Update notification badge count
async function updateNotificationBadge() {
  if (!currentUser) return;
  
  try {
    var { data, error } = await supabaseClient
      .from('notifications')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('is_read', false);
    
    if (error) throw error;
    
    var count = data ? data.length : 0;
    var badge = document.getElementById('notification-badge');
    var bell = document.getElementById('notification-bell');
    
    if (count > 0) {
      if (badge) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'flex';
      }
      if (bell) bell.style.display = 'inline-flex';
    } else {
      if (badge) badge.style.display = 'none';
      if (bell) bell.style.display = 'inline-flex'; // Still show bell, just no badge
    }
    
  } catch (err) {
    console.error('Error updating notification badge:', err);
  }
}

// Create a notification (helper function)
async function createNotification(userId, type, title, message, link, fromUserId) {
  try {
    await supabaseClient
      .from('notifications')
      .insert([{
        user_id: userId,
        type: type,
        title: title,
        message: message,
        link: link || null,
        from_user_id: fromUserId || null
      }]);
  } catch (err) {
    console.error('Error creating notification:', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATE NOTIFICATIONS INTO EXISTING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

// Modified sendFriendRequest to create notification
var originalSendFriendRequest = sendFriendRequest;
sendFriendRequest = async function() {
  if (!currentUser || !currentProfileUserId) return;
  
  try {
    var { error } = await supabaseClient
      .from('friendships')
      .insert([{
        requester_id: currentUser.id,
        addressee_id: currentProfileUserId,
        status: 'pending'
      }]);
    
    if (error) throw error;
    
    // Create notification for the other user
    var username = document.getElementById('profile-username').textContent;
    await createNotification(
      currentProfileUserId,
      'friend_request',
      'New Friend Request',
      currentUser.email.split('@')[0] + ' sent you a friend request!',
      'tab:friends',
      currentUser.id
    );
    
    showToast('Friend request sent! 🎉');
    updateProfileButtons();
    
  } catch (err) {
    showToast('Error: ' + err.message);
    console.error('Error sending friend request:', err);
  }
};

// Modified acceptFriendRequest to create notification
var originalAcceptFriendRequest = acceptFriendRequest;
acceptFriendRequest = async function(friendshipId) {
  try {
    // Get friendship details first to notify the requester
    var { data: friendship } = await supabaseClient
      .from('friendships')
      .select('requester_id')
      .eq('id', friendshipId)
      .single();
    
    var { error } = await supabaseClient
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);
    
    if (error) throw error;
    
    // Create notification for the requester
    if (friendship) {
      var { data: player } = await supabaseClient
        .from('players')
        .select('username')
        .eq('id', currentUser.id)
        .single();
      
      await createNotification(
        friendship.requester_id,
        'friend_accepted',
        'Friend Request Accepted!',
        (player ? player.username : 'Someone') + ' accepted your friend request!',
        'tab:friends',
        currentUser.id
      );
    }
    
    showToast('Friend request accepted! 🎉');
    await updateFriendRequestBadge();
    loadFriendRequests();
    
  } catch (err) {
    showToast('Error: ' + err.message);
    console.error('Error accepting friend request:', err);
  }
};

// Modified postGuestbookMessage to create notification
var originalPostGuestbookMessage = postGuestbookMessage;
postGuestbookMessage = async function() {
  if (!currentUser || !currentProfileUserId) return;
  
  var messageInput = document.getElementById('guestbook-message-input');
  var message = messageInput.value.trim();
  
  if (!message) {
    showToast('Please enter a message');
    return;
  }
  
  if (message.length > 500) {
    showToast('Message is too long (max 500 characters)');
    return;
  }
  
  try {
    var { error } = await supabaseClient
      .from('guestbook_entries')
      .insert([{
        profile_user_id: currentProfileUserId,
        author_id: currentUser.id,
        message: message
      }]);
    
    if (error) throw error;
    
    // Create notification for profile owner (if not posting on own profile)
    if (currentProfileUserId !== currentUser.id) {
      var { data: player } = await supabaseClient
        .from('players')
        .select('username')
        .eq('id', currentUser.id)
        .single();
      
      var username = player ? player.username : 'Someone';
      
      await createNotification(
        currentProfileUserId,
        'guestbook_message',
        'New Guestbook Message',
        username + ' left a message on your guestbook!',
        'tab:profile',
        currentUser.id
      );
    }
    
    showToast('Message posted! 💖');
    messageInput.value = '';
    document.getElementById('guestbook-char-count').textContent = '0 / 500';
    loadGuestbookEntries(currentProfileUserId);
    
  } catch (err) {
    showToast('Error posting message: ' + err.message);
    console.error('Error posting guestbook message:', err);
  }
};

// Update showApp to initialize notification system
var originalShowAppForNotifications = showApp;
showApp = async function(user) {
  await originalShowAppForNotifications(user);
  
  // Initialize notifications
  await updateNotificationBadge();
  
  // Poll for new notifications every 30 seconds
  setInterval(updateNotificationBadge, 30000);
};


// ═══════════════════════════════════════════════════════════════════════════
// DAILY TIPS SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

function loadDailyTip() {
  console.log('🎯 loadDailyTip called!');
  var tipEl = document.getElementById('daily-tip-content');
  console.log('📝 Tip element:', tipEl);
  if (!tipEl) {
    console.log('❌ Tip element not found!');
    return;
  }
  
  // Get today's date as seed for consistent daily tip
  var today = new Date();
  var seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  
  // Use seed to pick consistent tip for the day
  var tipIndex = seed % dailyTips.length;
  var tip = dailyTips[tipIndex];
  
  console.log('💡 Selected tip:', tip);
  tipEl.textContent = tip;
}


// ═══════════════════════════════════════════════════════════════════════════
// STARTER DUNGEON SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

var dungeonState = {
  active: false,
  currentWave: 0,
  petId: null,
  petHP: 0,
  petMaxHP: 0,
  enemies: [],
  rewards: {
    pp: 0,
    xp: 0
  }
};

async function startDungeon() {
  if (!selectedBattlePetId) {
    showPixelToast('Select a pet first!', 'warning');
    return;
  }
  
  // Check daily energy cap
  var today = new Date().toISOString().split('T')[0];
  var energyKey = 'energy_used_' + today;
  var energyUsedToday = parseInt(localStorage.getItem(energyKey)) || 0;
  
  // Dungeon costs 15 energy (3 battles × 5)
  if (energyUsedToday >= 250 - 15) {
    showPixelToast('⚡ Not enough energy for dungeon run!', 'warning');
    return;
  }
  
  // Track energy used
  localStorage.setItem(energyKey, energyUsedToday + 15);
  
  // Get player pet stats
  var petStats = await calculatePetStats(selectedBattlePetId);
  if (!petStats) {
    showPixelToast('Error loading pet stats!', 'error');
    return;
  }
  
  // Initialize dungeon state
  dungeonState.active = true;
  dungeonState.currentWave = 1;
  dungeonState.petId = selectedBattlePetId;
  dungeonState.petHP = petStats.currentHP;
  dungeonState.petMaxHP = petStats.maxHP;
  dungeonState.rewards = { pp: 0, xp: 0 };
  
  // Generate 3 enemies
  dungeonState.enemies = await generateDungeonEnemies(petStats.stats);
  
  // Show dungeon intro modal
  showDungeonIntro();
}

async function generateDungeonEnemies(playerStats) {
  var playerLevel = Math.floor((playerStats.attack + playerStats.defense + playerStats.speed) / 5);
  
  // Get random base enemy from outskirts (easier creatures for starter dungeon)
  var res = await supabaseClient
    .from('enemy_pets')
    .select('*')
    .eq('forest_zone', 'outskirts');
  
  if (res.error || !res.data || res.data.length === 0) {
    return [];
  }
  
  var baseEnemy = res.data[Math.floor(Math.random() * res.data.length)];
  var enemies = [];
  
  // Wave 1: Baby variant (-1 level, 0.7x stats)
  var wave1 = createDungeonEnemy(baseEnemy, Math.max(1, playerLevel - 1), 'baby', 0.7);
  enemies.push(wave1);
  
  // Wave 2: Adult variant (player level, 1.3x stats)
  var wave2 = createDungeonEnemy(baseEnemy, playerLevel, 'adult', 1.3);
  enemies.push(wave2);
  
  // Wave 3: KING BOSS (+2 levels, 2.5x stats)
  var wave3 = createDungeonEnemy(baseEnemy, playerLevel + 2, 'king', 2.5);
  enemies.push(wave3);
  
  return enemies;
}

function createDungeonEnemy(baseEnemy, level, variant, statMultiplier) {
  var levelBonus = level - 1;
  var baseHP = Math.floor((baseEnemy.base_hp + (levelBonus * 8)) * statMultiplier);
  var baseATK = Math.floor((baseEnemy.base_attack + levelBonus) * statMultiplier);
  var baseDEF = Math.floor((baseEnemy.base_defense + Math.floor(levelBonus * 0.5)) * statMultiplier);
  var baseSPD = Math.floor((baseEnemy.base_speed + Math.floor(levelBonus * 0.5)) * statMultiplier);
  
  var variantNames = {
    'baby': 'Baby',
    'adult': 'Adult',
    'king': '👑 KING'
  };
  
  var name = variantNames[variant] + ' ' + baseEnemy.name;
  
  return {
    id: baseEnemy.id,
    species: baseEnemy.species,
    name: name,
    level: level,
    hp: baseHP,
    attack: baseATK,
    defense: baseDEF,
    speed: baseSPD,
    base_hp: baseHP,
    base_attack: baseATK,
    base_defense: baseDEF,
    base_speed: baseSPD,
    image_file: baseEnemy.image_file,
    forest_zone: baseEnemy.forest_zone,
    difficulty_tier: baseEnemy.difficulty_tier,
    variant: variant,
    exp_reward: Math.floor(baseEnemy.exp_reward * statMultiplier),
    pp_reward: Math.floor(baseEnemy.pp_reward * statMultiplier)
  };
}

function showDungeonIntro() {
  var modal = document.getElementById('exploration-modal');
  var enemy = dungeonState.enemies[0];
  
  document.getElementById('exploration-title').textContent = '⛰️ Shallow Cave - Wave 1/3';
  document.getElementById('exploration-result').innerHTML = 
    '<strong style="color: var(--purple);">Dungeon Challenge Started!</strong><br><br>' +
    'Fight 3 waves back-to-back. Your HP carries over between battles!<br><br>' +
    'First enemy: <strong>' + enemy.name + '</strong> (Level ' + enemy.level + ')';
  document.getElementById('exploration-rewards').innerHTML = 
    '<div style="color: var(--text-light); font-size: 0.9rem;">⚠️ No healing between waves!</div>';
  
  var continueBtn = document.getElementById('exploration-continue-btn');
  continueBtn.textContent = 'Start Wave 1!';
  continueBtn.onclick = function() {
    closeExplorationModal();
    startDungeonWave();
  };
  
  modal.classList.add('show');
}

async function startDungeonWave() {
  if (!dungeonState.active || dungeonState.currentWave > 3) return;
  
  var enemy = dungeonState.enemies[dungeonState.currentWave - 1];
  var petStats = await calculatePetStats(dungeonState.petId);
  
  if (!petStats) {
    showPixelToast('Error loading pet!', 'error');
    endDungeon(false);
    return;
  }
  
  // Override pet HP with dungeon state (persistent HP)
  petStats.currentHP = dungeonState.petHP;
  
  // Start battle
  await startDungeonBattle(petStats, enemy);
}

async function startDungeonBattle(playerStats, enemyStats) {
  // Hide exploration UI
  document.getElementById('forest-exploration').style.display = 'none';
  document.getElementById('battle-screen').style.display = 'block';
  
  // Set up player side
  var playerNameEl = el('player-battle-name');
  playerNameEl.textContent = playerStats.name;
  
  el('player-hp-text').textContent = playerStats.currentHP + '/' + playerStats.maxHP;
  el('player-hp-fill').style.width = ((playerStats.currentHP / playerStats.maxHP) * 100) + '%';
  
  var playerSprite = el('player-battle-sprite');
  playerSprite.style.backgroundImage = 'url(images/' + playerStats.imageFile + ')';
  
  // Set up enemy side
  el('enemy-battle-name').textContent = enemyStats.name;
  el('enemy-hp-text').textContent = enemyStats.hp + '/' + enemyStats.hp;
  el('enemy-hp-fill').style.width = '100%';
  
  var enemySprite = el('enemy-battle-sprite');
  enemySprite.innerHTML = '';
  var spriteFile = getSpriteFile(enemyStats.species);
  enemySprite.style.backgroundImage = 'url(images/' + spriteFile + ')';
  
  // Clear battle log
  el('battle-log').innerHTML = '';
  
  // Simulate battle
  var battleResult = simulateBattle(playerStats, enemyStats);
  
  // Store dungeon HP after battle
  dungeonState.petHP = Math.max(0, battleResult.playerFinalHP);
  
  // Play battle
  currentBattleLog = battleResult.log;
  currentBattleIndex = 0;
  
  el('battle-skip-btn').style.display = 'inline-block';
  el('battle-continue-btn').style.display = 'none';
  
  playBattleTurn();
}

function endBattlePlayback() {
  el('battle-skip-btn').style.display = 'none';
  el('battle-continue-btn').style.display = 'inline-block';
  
  // Check if dungeon is active
  if (dungeonState.active) {
    handleDungeonBattleEnd();
  }
}

async function handleDungeonBattleEnd() {
  var victory = dungeonState.petHP > 0;
  var enemy = dungeonState.enemies[dungeonState.currentWave - 1];
  
  if (victory) {
    // Add rewards
    dungeonState.rewards.pp += enemy.pp_reward;
    dungeonState.rewards.xp += enemy.exp_reward;
    
    // Check if dungeon complete
    if (dungeonState.currentWave === 3) {
      // DUNGEON COMPLETE!
      await completeDungeon();
    } else {
      // Next wave
      dungeonState.currentWave++;
      showNextWaveModal();
    }
  } else {
    // Dungeon failed
    await failDungeon();
  }
}

function showNextWaveModal() {
  document.getElementById('battle-screen').style.display = 'none';
  document.getElementById('forest-exploration').style.display = 'block';
  
  var modal = document.getElementById('exploration-modal');
  var enemy = dungeonState.enemies[dungeonState.currentWave - 1];
  
  document.getElementById('exploration-title').textContent = 
    '⛰️ Wave ' + dungeonState.currentWave + '/3' + 
    (dungeonState.currentWave === 3 ? ' - BOSS!' : '');
  
  document.getElementById('exploration-result').innerHTML = 
    '<strong style="color: var(--green);">Wave ' + (dungeonState.currentWave - 1) + ' Complete!</strong><br><br>' +
    'Next enemy: <strong style="color: ' + (dungeonState.currentWave === 3 ? 'var(--pink)' : 'var(--purple)') + ';">' + 
    enemy.name + '</strong> (Level ' + enemy.level + ')<br><br>' +
    'Your HP: <strong>' + dungeonState.petHP + '/' + dungeonState.petMaxHP + '</strong>';
  
  document.getElementById('exploration-rewards').innerHTML = 
    '<div style="color: var(--text-light); font-size: 0.9rem;">⚠️ Remember: No healing!</div>';
  
  var continueBtn = document.getElementById('exploration-continue-btn');
  continueBtn.textContent = dungeonState.currentWave === 3 ? 'Fight the KING!' : 'Continue to Wave ' + dungeonState.currentWave;
  continueBtn.onclick = function() {
    closeExplorationModal();
    startDungeonWave();
  };
  
  modal.classList.add('show');
}

async function completeDungeon() {
  // Award bonus PP for completing dungeon
  var bonusPP = 100;
  dungeonState.rewards.pp += bonusPP;
  
  // Save rewards
  await awardPP(dungeonState.rewards.pp);
  
  // Award XP to pet
  var petData = await supabaseClient
    .from('user_pets')
    .select('xp, level, max_hunger, max_energy, max_happiness, base_hp, base_attack, base_defense, base_speed')
    .eq('id', dungeonState.petId)
    .single();
  
  if (petData.data) {
    var pet = petData.data;
    var newXp = (pet.xp || 0) + dungeonState.rewards.xp;
    
    var lu = calculateLevelUp(
      newXp,
      pet.level,
      pet.max_hunger,
      pet.max_energy,
      pet.max_happiness,
      pet.base_hp || 25,
      pet.base_attack || 4,
      pet.base_defense || 2,
      pet.base_speed || 3
    );
    
    var updates = { xp: lu.xp, level: lu.level };
    
    if (lu.leveled) {
      updates.max_hunger = lu.maxHunger;
      updates.max_energy = lu.maxEnergy;
      updates.max_happiness = lu.maxHappiness;
      updates.base_hp = lu.base_hp;
      updates.base_attack = lu.base_attack;
      updates.base_defense = lu.base_defense;
      updates.base_speed = lu.base_speed;
      updates.max_hp = lu.base_hp;
    }
    
    await supabaseClient
      .from('user_pets')
      .update(updates)
      .eq('id', dungeonState.petId);
  }
  
  // Show completion modal
  document.getElementById('battle-screen').style.display = 'none';
  document.getElementById('forest-exploration').style.display = 'block';
  
  var modal = document.getElementById('exploration-modal');
  document.getElementById('exploration-title').textContent = '🎉 Dungeon Complete!';
  document.getElementById('exploration-result').innerHTML = 
    '<strong style="color: var(--green); font-size: 1.3rem;">VICTORY!</strong><br><br>' +
    'You conquered the Shallow Cave!';
  document.getElementById('exploration-rewards').innerHTML = 
    '<div style="color: var(--green); font-weight: bold; font-size: 1.2rem; margin: 10px 0;">+' + dungeonState.rewards.pp + ' PP</div>' +
    '<div style="color: var(--purple); font-weight: bold; margin: 5px 0;">+' + dungeonState.rewards.xp + ' XP</div>' +
    '<div style="color: var(--pink); font-weight: bold; margin: 10px 0;">+' + bonusPP + ' Completion Bonus!</div>';
  
  var continueBtn = document.getElementById('exploration-continue-btn');
  continueBtn.textContent = 'Amazing!';
  continueBtn.onclick = function() {
    closeExplorationModal();
    endDungeon(true);
  };
  
  modal.classList.add('show');
  
  // Reset dungeon state
  dungeonState.active = false;
}

async function failDungeon() {
  // Show failure modal
  document.getElementById('battle-screen').style.display = 'none';
  document.getElementById('forest-exploration').style.display = 'block';
  
  var modal = document.getElementById('exploration-modal');
  document.getElementById('exploration-title').textContent = '💔 Dungeon Failed';
  document.getElementById('exploration-result').innerHTML = 
    '<strong style="color: var(--text-light);">Your pet fainted on Wave ' + dungeonState.currentWave + '</strong><br><br>' +
    'Better luck next time!';
  document.getElementById('exploration-rewards').innerHTML = 
    '<div style="color: var(--text-light); font-size: 0.9rem;">No rewards for incomplete runs</div>';
  
  var continueBtn = document.getElementById('exploration-continue-btn');
  continueBtn.textContent = 'Try Again Later';
  continueBtn.onclick = function() {
    closeExplorationModal();
    endDungeon(false);
  };
  
  modal.classList.add('show');
  
  // Reset dungeon state
  dungeonState.active = false;
}

function endDungeon(success) {
  dungeonState.active = false;
  dungeonState.currentWave = 0;
  dungeonState.petId = null;
  dungeonState.enemies = [];
  
  // Reload pets to show updated HP/stats
  if (tabsLoaded['battle']) {
    loadBattlePets();
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// DAILY RANDOM EVENTS SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

var randomEvents = [
  { text: "A wild creature dropped some coins in front of you!", pp: 25, icon: "🪙" },
  { text: "Your pet found a shiny gem while exploring!", pp: 30, icon: "💎" },
  { text: "A mysterious traveler gave you a gift!", pp: 20, icon: "🎁" },
  { text: "You discovered a hidden stash of PawketPoints!", pp: 35, icon: "✨" },
  { text: "A friendly bird dropped something shiny!", pp: 15, icon: "🐦" },
  { text: "Your pet dug up a buried treasure!", pp: 40, icon: "🏴‍☠️" },
  { text: "A lucky four-leaf clover appeared at your feet!", pp: 20, icon: "🍀" },
  { text: "The forest spirits blessed you with a gift!", pp: 25, icon: "🧚" },
  { text: "You found an old coin purse on the ground!", pp: 30, icon: "👛" },
  { text: "A shooting star granted your wish!", pp: 35, icon: "🌠" },
  { text: "Your pet made a new friend who shared their snacks!", pp: 15, icon: "🍪" },
  { text: "A rainbow appeared! Good fortune is coming your way!", pp: 25, icon: "🌈" },
  { text: "You stumbled upon an abandoned merchant cart!", pp: 45, icon: "🛒" },
  { text: "A magical mushroom ring appeared around you!", pp: 20, icon: "🍄" },
  { text: "The wind carried a pouch of coins to your feet!", pp: 30, icon: "💨" }
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
  
  // Award PP
  awardPP(event.pp);
  
  // Show modal
  var modal = document.getElementById('exploration-modal');
  if (!modal) return;
  
  document.getElementById('exploration-title').textContent = event.icon + ' Random Event!';
  document.getElementById('exploration-result').innerHTML = event.text;
  document.getElementById('exploration-rewards').innerHTML = 
    '<div style="color: var(--green); font-weight: bold; font-size: 1.2rem;">+' + event.pp + ' PP</div>';
  
  var continueBtn = document.getElementById('exploration-continue-btn');
  continueBtn.textContent = 'Nice!';
  continueBtn.onclick = closeExplorationModal;
  
  modal.classList.add('show');
  
  console.log('🎲 Random event triggered:', event.text);
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


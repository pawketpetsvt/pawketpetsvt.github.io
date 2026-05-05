'use strict';

// ══════════════════════════════════════════════════════════════════════════
// SUPABASE INITIALIZATION
// ══════════════════════════════════════════════════════════════════════════
var SUPABASE_URL = 'https://hqzugbxutgefjilgmxqu.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxenVnYnh1dGdlZmppbGdteHF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MTE5NjEsImV4cCI6MjA5MDQ4Nzk2MX0.A3bQMriwY8j9GasUywq_8hKlnkEQQNMyB2ykSaQR68c';

// Initialize supabaseClient - wait for library to load
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
function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 3000);
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
  
  // Load user's badges
  await loadUserBadges();
  
  // Award welcome badge if new user
  await awardBadge('welcome');

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
    user_id:currentUser.id, pet_id:selectedPet.id, nickname:nickname,
    level:1, xp:0, hunger:50, energy:50, happiness:50, max_hunger:100, max_energy:100, max_happiness:100
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
  var itemsRes = await supabaseClient.from('items').select('id,name,hunger_effect,energy_effect,happiness_effect,xp_effect').in('id',itemIds);
  var itemMap = {};
  if (itemsRes.data) itemsRes.data.forEach(function(i){ itemMap[i.id]=i; });
  invRes.data.forEach(function(row) {
    var item = itemMap[row.item_id] || {};
    inventoryItems.push({invId:row.id, itemId:row.item_id, name:item.name||'Item', qty:row.quantity, h:item.hunger_effect||0, e:item.energy_effect||0, hap:item.happiness_effect||0, xp:item.xp_effect||0});
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
  res.data.forEach(function(pet) {
    petState[pet.id] = Object.assign({}, pet, {
      energy: calculateEnergyRegen(pet.energy, pet.max_energy, pet.last_played),
      hunger: calculateHungerDecay(pet.hunger, pet.last_fed),
      happiness: calculateHappinessDecay(pet.happiness, pet.last_fed, pet.last_played)
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
  var sel = el('sel-'+petId); if (!sel || !sel.value) return;
  var idx = inventoryItems.findIndex(function(i){ return i.invId === sel.value; }); if (idx===-1) return;
  var item = inventoryItems[idx]; var pet = petState[petId]; if (!pet) return;
  var btn = el('usebtn-'+petId); btn.disabled=true; btn.textContent='...';
  var updates = {};
  if (item.h>0) updates.hunger=Math.min(pet.hunger+item.h, pet.max_hunger);
  if (item.e>0) updates.energy=Math.min(pet.energy+item.e, pet.max_energy);
  if (item.hap>0) updates.happiness=Math.min(pet.happiness+item.hap, pet.max_happiness);
  if (item.xp>0) updates.xp=pet.xp+item.xp;
  if (!Object.keys(updates).length) { showToast('No effects configured.'); btn.disabled=false; btn.textContent='Use'; return; }
  var res = await supabaseClient.from('user_pets').update(updates).eq('id', petId);
  if (res.error) { showToast('Error: '+res.error.message); btn.disabled=false; btn.textContent='Use'; return; }
  if (item.qty <= 1) { await supabaseClient.from('user_inventory').delete().eq('id', item.invId); inventoryItems.splice(idx,1); }
  else { await supabaseClient.from('user_inventory').update({quantity:item.qty-1}).eq('id', item.invId); inventoryItems[idx].qty=item.qty-1; }
  if (updates.hunger!==undefined) { petState[petId].hunger=updates.hunger; updateBar(petId,'hunger',updates.hunger,pet.max_hunger); }
  if (updates.energy!==undefined) { petState[petId].energy=updates.energy; updateBar(petId,'energy',updates.energy,pet.max_energy); }
  if (updates.happiness!==undefined) { petState[petId].happiness=updates.happiness; updateBar(petId,'happiness',updates.happiness,pet.max_happiness); }
  if (updates.xp!==undefined) { petState[petId].xp=updates.xp; updateXpBar(petId,updates.xp,pet.level); }
  showFlash(petId, item.name+': '+getEffectText(item), '#b06aff');
  showToast('Used '+item.name+'!');
  var card = el('petcard-'+petId);
  if (card) { var old=card.querySelector('.use-item-section'); if(old) old.replaceWith(makeDropdown(petId)); }
  btn.disabled=false; btn.textContent='Use';
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
  var xpNext = pet.level * 100;
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
  headerInfo.appendChild(makeEl('div', {class:'pet-card-nickname'}, pet.nickname));
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

function calculateHungerDecay(currentHunger, lastFedTimestamp) {
  if (!lastFedTimestamp) return currentHunger;
  
  var now = new Date();
  var lastFed = new Date(lastFedTimestamp);
  var hoursPassed = (now - lastFed) / (1000 * 60 * 60);
  
  // Hunger decreases 10 points per hour
  var decayRate = 10; // points per hour
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
  
  // Happiness decreases 8 points per hour
  var decayRate = 8; // points per hour
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

function calculateLevelUp(newXp, currentLevel, currentMaxHunger, currentMaxEnergy, currentMaxHappiness) {
  var xpNeeded = currentLevel * 100;
  
  if (newXp >= xpNeeded) {
    // Level up!
    return {
      xp: newXp - xpNeeded, // Carry over excess XP
      level: currentLevel + 1,
      maxHunger: currentMaxHunger + 5,
      maxEnergy: currentMaxEnergy + 5,
      maxHappiness: currentMaxHappiness + 5,
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
  var lu=calculateLevelUp(pet.xp+10,pet.level,pet.max_hunger,pet.max_energy,pet.max_happiness);
  var upd={hunger:nh,happiness:nhap,xp:lu.xp,level:lu.level,last_fed:new Date().toISOString()};
  if(lu.leveled){upd.max_hunger=lu.maxHunger;upd.max_energy=lu.maxEnergy;upd.max_happiness=lu.maxHappiness;}
  var res=await supabaseClient.from('user_pets').update(upd).eq('id',petId);
  if(res.error){showFlash(petId,'Error!','#ff6eb4');btn.disabled=false;btn.textContent='Feed';return;}
  Object.assign(petState[petId],upd);
  updateBar(petId,'hunger',nh,lu.maxHunger); updateBar(petId,'happiness',nhap,lu.maxHappiness); updateXpBar(petId,lu.xp,lu.level);
  
  // Mark as used today
  localStorage.setItem(feedKey, 'done');
  
  if(lu.leveled){
    showFlash(petId,'Level '+lu.level+'! Max stats +5!','#b06aff');
    updateLvl(petId,lu.level,lu.maxHunger);
    
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
  var lu=calculateLevelUp(pet.xp+15,pet.level,pet.max_hunger,pet.max_energy,pet.max_happiness);
  var upd={energy:ne,happiness:nhap,xp:lu.xp,level:lu.level,last_played:new Date().toISOString()};
  if(lu.leveled){upd.max_hunger=lu.maxHunger;upd.max_energy=lu.maxEnergy;upd.max_happiness=lu.maxHappiness;}
  var res=await supabaseClient.from('user_pets').update(upd).eq('id',petId);
  if(res.error){showFlash(petId,'Error!','#ff6eb4');btn.disabled=false;btn.textContent='Play';return;}
  Object.assign(petState[petId],upd);
  updateBar(petId,'energy',ne,lu.maxEnergy); updateBar(petId,'happiness',nhap,lu.maxHappiness); updateXpBar(petId,lu.xp,lu.level);
  
  // Mark as used today
  localStorage.setItem(playKey, 'done');
  
  if(lu.leveled){
    showFlash(petId,'Level '+lu.level+'! Max stats +5!','#b06aff');
    updateLvl(petId,lu.level,lu.maxHunger);
    
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
  var next=level*100; var pct=Math.min(xp/next*100,100);
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
  var res = await supabaseClient.from('items').select('*').order('price',{ascending:true});
  if (res.error||!res.data||!res.data.length) { grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:36px;color:var(--text-light)">No items yet!</div>'; return; }
  var seen={}, deduped=[];
  res.data.forEach(function(item){ var k=item.name.toLowerCase().trim(); if(!seen[k]||item.price<seen[k].price)seen[k]=item; });
  Object.values(seen).sort(function(a,b){return a.price-b.price;}).forEach(function(i){deduped.push(i);});
  grid.innerHTML='';
  deduped.forEach(function(item) {
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
    if(tags.children.length)card.appendChild(tags);
    card.appendChild(makeEl('div',{class:'shop-item-price'},'\uD83E\uDE99 '+item.price+' PP'));
    var canAfford=currentPoints>=item.price;
    var buyBtn=makeEl('button',{class:'btn-buy'},canAfford?'Buy':'Need '+item.price+' PP');
    if(!canAfford)buyBtn.disabled=true;
    buyBtn.onclick=function(){buyItem(item.id,item.name,item.price);};
    card.appendChild(buyBtn);
    grid.appendChild(card);
  });
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
  console.log('Loading profile for:', username);
  try {
    // Get profile data
    var profileRes = await supabaseClient.rpc('get_player_profile', { p_username: username });
    
    console.log('RPC result:', profileRes);
    
    if (profileRes.error || !profileRes.data || profileRes.data.length === 0) {
      console.log('Using fallback query, RPC error:', profileRes.error);
      // Fallback if RPC doesn't exist
      var playerRes = await supabaseClient
        .from('players')
        .select('id, username, pawketpoints, created_at')
        .ilike('username', username)
        .single();
      
      console.log('Player query result:', playerRes);
      
      if (playerRes.error) throw new Error('Player not found: ' + playerRes.error.message);
      
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
    el('profile-avatar').textContent = profile.username.charAt(0).toUpperCase();
    el('profile-username').textContent = profile.username;
    
    var joinDate = new Date(profile.created_at);
    el('profile-joined').textContent = 'Joined: ' + joinDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
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
  errorEl.style.display = 'none';
  successEl.style.display = 'none';
  
  var newUsername = el('edit-username').value.trim();
  var newBio = el('edit-bio').value.trim();
  
  // Validation
  if (!newUsername) {
    errorEl.textContent = 'Username cannot be empty!';
    errorEl.style.display = 'block';
    return;
  }
  
  if (newUsername.length > 20) {
    errorEl.textContent = 'Username must be 20 characters or less!';
    errorEl.style.display = 'block';
    return;
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
    errorEl.textContent = 'Username can only contain letters, numbers, and underscores!';
    errorEl.style.display = 'block';
    return;
  }
  
  if (newBio.length > 200) {
    errorEl.textContent = 'Bio must be 200 characters or less!';
    errorEl.style.display = 'block';
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
    
    // Update header
    el('nav-user').textContent = newUsername;
    
    successEl.textContent = '✅ Profile saved successfully!';
    successEl.style.display = 'block';
    
    // Hide success message after 3 seconds
    setTimeout(function() {
      successEl.style.display = 'none';
    }, 3000);
    
  } catch (err) {
    console.error('Error saving profile:', err);
    errorEl.textContent = 'Failed to save profile: ' + err.message;
    errorEl.style.display = 'block';
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
  
  res.data.forEach(function(item) {
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
  });
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
  // Get pet's current equipment
  var equipped = await loadPetEquipment(petId);
  
  // Get all owned equipment
  var allEquipRes = await supabaseClient
    .from('player_equipment')
    .select('*, equipment(*)')
    .eq('user_id', currentUser.id)
    .gt('quantity', 0);
  
  if (allEquipRes.error) {
    showToast('Error loading equipment!');
    return;
  }
  
  // Create modal (simplified for now - will expand later)
  var modal = makeEl('div', { class: 'modal-overlay' });
  modal.onclick = function() { document.body.removeChild(modal); };
  
  var modalContent = makeEl('div', { class: 'modal' });
  modalContent.onclick = function(e) { e.stopPropagation(); };
  
  var title = makeEl('h2');
  title.textContent = 'Manage Equipment';
  modalContent.appendChild(title);
  
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
    card.style.fontSize = '0.85rem';
    
    var icon = makeEl('div', { class: 'equipment-icon' });
    icon.style.fontSize = '2rem';
    icon.textContent = item.equipment_type === 'weapon' ? '⚔️' : '🛡️';
    card.appendChild(icon);
    
    var name = makeEl('div', { class: 'equipment-name' });
    name.textContent = item.name;
    card.appendChild(name);
    
    var equipBtn = makeEl('button', { class: 'btn btn-sm btn-primary' });
    equipBtn.textContent = 'Equip';
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
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
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
  // Get pet base stats
  var petRes = await supabaseClient
    .from('user_pets')
    .select('*')
    .eq('id', petId)
    .single();
  
  if (petRes.error) return null;
  
  var pet = petRes.data;
  var stats = {
    hp: pet.base_hp || 30,
    attack: pet.base_attack || 5,
    defense: pet.base_defense || 3,
    speed: pet.base_speed || 4
  };
  
  // Get equipped items
  var equipRes = await supabaseClient
    .from('player_equipment')
    .select('equipment(*)')
    .eq('user_id', currentUser.id)
    .eq('is_equipped', true);
  
  if (!equipRes.error && equipRes.data) {
    equipRes.data.forEach(function(item) {
      var equip = item.equipment;
      stats.attack += equip.attack_bonus || 0;
      stats.defense += equip.defense_bonus || 0;
      stats.speed += equip.speed_bonus || 0;
      stats.hp += equip.hp_bonus || 0;
    });
  }
  
  return {
    id: pet.id,
    name: pet.nickname || 'Your Pet',
    stats: stats,
    currentHP: stats.hp
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
      var playerDamage = calculateDamage(playerStats.stats.attack, enemyStats.defense);
      enemyHP -= playerDamage;
      
      log.push({
        type: 'player_attack',
        attacker: 'player',
        damage: playerDamage,
        text: playerStats.name + ' attacks for ' + playerDamage + ' damage!',
        playerHP: playerHP,
        enemyHP: Math.max(0, enemyHP)
      });
      
      if (enemyHP <= 0) break;
    }
    
    // Enemy's turn
    var enemyDamage = calculateDamage(enemyStats.attack, playerStats.stats.defense);
    playerHP -= enemyDamage;
    
    log.push({
      type: 'enemy_attack',
      attacker: 'enemy',
      damage: enemyDamage,
      text: enemyStats.name + ' attacks for ' + enemyDamage + ' damage!',
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
function calculateDamage(attack, defense) {
  var baseDamage = attack - defense;
  var variance = Math.floor(Math.random() * 3) - 1; // -1, 0, or +1
  var damage = Math.max(1, baseDamage + variance);
  return damage;
}

/**
 * Start a battle against an enemy
 */
async function startBattle(petId, enemyId) {
  if (!currentUser) return;
  
  // Get player pet stats
  var playerStats = await calculatePetStats(petId);
  if (!playerStats) {
    showToast('Error loading pet stats!');
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
  
  // Simulate the battle
  var battleResult = simulateBattle(playerStats, enemyStats);
  
  // Show battle UI and play it back
  showBattleUI(playerStats, enemyStats, battleResult);
  
  // Save battle to history
  await saveBattleHistory(petId, enemyId, battleResult, enemyStats);
}

/**
 * Save battle to database
 */
async function saveBattleHistory(petId, enemyId, battleResult, enemyStats) {
  var expGained = battleResult.victory ? enemyStats.exp_reward : 0;
  var ppGained = battleResult.victory ? enemyStats.pp_reward : 0;
  
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
  
  // Update pet stats
  if (battleResult.victory) {
    await supabaseClient
      .from('user_pets')
      .update({
        experience: supabaseClient.raw('experience + ' + expGained),
        total_battles: supabaseClient.raw('total_battles + 1'),
        battles_won: supabaseClient.raw('battles_won + 1')
      })
      .eq('id', petId);
    
    // Award PP to player
    await awardPP(ppGained);
  } else {
    await supabaseClient
      .from('user_pets')
      .update({
        total_battles: supabaseClient.raw('total_battles + 1')
      })
      .eq('id', petId);
  }
}

/**
 * Show battle UI (will be expanded in Chunk 3)
 */
function showBattleUI(playerStats, enemyStats, battleResult) {
  console.log('=== BATTLE START ===');
  console.log('Player:', playerStats);
  console.log('Enemy:', enemyStats);
  console.log('Result:', battleResult);
  console.log('Battle Log:');
  battleResult.log.forEach(function(entry) {
    console.log('  ' + entry.text + ' (Player: ' + entry.playerHP + ' HP, Enemy: ' + entry.enemyHP + ' HP)');
  });
  console.log('=== BATTLE END ===');
  
  // TODO: Implement visual battle UI in Chunk 3
  // For now, just show result
  setTimeout(function() {
    if (battleResult.victory) {
      showToast('Victory! +' + enemyStats.exp_reward + ' EXP, +' + enemyStats.pp_reward + ' PP');
    } else {
      showToast('Defeat! Your pet fainted!');
    }
  }, 1000);
}

/**
 * Get random enemy from zone
 */
async function getRandomEnemy(zone, difficultyTier) {
  var query = supabaseClient
    .from('enemy_pets')
    .select('*')
    .eq('forest_zone', zone || 'wildwood');
  
  if (difficultyTier) {
    query = query.eq('difficulty_tier', difficultyTier);
  }
  
  var res = await query;
  
  if (res.error || !res.data || res.data.length === 0) {
    return null;
  }
  
  // Pick random enemy
  var randomIndex = Math.floor(Math.random() * res.data.length);
  return res.data[randomIndex];
}

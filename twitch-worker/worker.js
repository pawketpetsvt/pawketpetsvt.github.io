// PawketPetsVT — Cloudflare Worker
// Twitch EventSub stream rewards, "Our Streamers" live status, the OBS overlay
// API, and the Discord bot (slash commands + announcement relay).
//
// Deployed as the existing `pawketpets-twitch` worker (same address), replacing
// its original code in 2026-10 and moving it to the new Twitch app. Rollout
// steps are in README.md next to this file.
//
// What changed from the original, and why:
//   • Rewards are awarded by two Supabase functions (twitch_chat_activity /
//     twitch_award, supabase/migrations/2026-10-09_twitch_rewards.sql), each one
//     transaction. The original added PP here AND queued it for the site, which
//     paid it again — every reward was paid twice — and its read-add-write of the
//     balance could undo a purchase made in between.
//   • No KV store. Cooldowns, stats and pending rewards live in Supabase; the
//     original's ~4 KV writes per rewarded chat would exhaust the free plan's
//     1,000 writes a day on one busy stream. (Its KV namespace turned out to be
//     empty — the original never recorded a reward — so nothing was carried over.)
//   • Follow rewards are recorded under the SITE's key for each streamer
//     (FOLLOW_KEYS), not the Twitch login, so the site's "Check Follows" and this
//     worker can no longer both pay the same follow.
//   • Twitch's at-least-once delivery: redelivered notifications are rejected by
//     message id, and anything older than 10 minutes is refused (Twitch's own
//     replay-protection guidance).
//   • /setup and /clear (and the new /subscriptions) need ?key=ADMIN_KEY — the
//     originals were open, so anyone could delete every EventSub subscription.
//   • /discord/relay needs the X-Relay-Secret header — it was open, so anyone
//     could post announcements to the Discord channel.
//   • New /api/live: who's streaming, via the app's own token, so the site's
//     "Our Streamers" no longer needs each player's personal Twitch token.
//   • /api/rewards, /api/rewards/claim and /api/rewards/stats are gone; the site
//     reads its own rewards from Supabase.
//
// Variables (Settings → Variables and Secrets):
//   SUPABASE_URL          Text    https://hqzugbxutgefjilgmxqu.supabase.co
//   TWITCH_CLIENT_ID      Text    the Twitch app's client ID
//   BROADCASTER_IDS       Text    comma-separated Twitch user ids of team channels
//   BOT_USER_ID           Text    Twitch user id of the account that reads chat
//   DISCORD_PUBLIC_KEY    Text    the Discord application's public key
//   SUPABASE_SERVICE_KEY  Secret  Supabase service_role key
//   TWITCH_CLIENT_SECRET  Secret  the Twitch app's client secret
//   TWITCH_SECRET         Secret  random string; signs EventSub webhooks
//   ADMIN_KEY             Secret  random string; unlocks /setup, /clear, /subscriptions
//   RELAY_SECRET          Secret  random string; Supabase webhooks send it to /discord/relay
//   DISCORD_WEBHOOK_URL   Secret  Discord channel webhook for announcements
//
// No bindings are needed.

const PP_PER_CHAT = 2;
const CHAT_COOLDOWN_SECONDS = 300;
const CHAT_POPUP_COOLDOWN_SECONDS = 60;
const PP_PER_FOLLOW = 50;
const PP_PER_SUB = 200;
const BITS_PER_PP = 10;
const MAX_MESSAGE_AGE_MS = 10 * 60 * 1000;
const LIVE_CACHE_SECONDS = 60;

// Twitch user id → the key the site stores in players.twitch_follow_rewards.
// MUST match FOLLOW_STREAMERS in webapp/src/data/twitchData.js; those keys are
// already persisted, so renaming one would make that follow claimable again.
const FOLLOW_KEYS = {
  '91821604': 'embertail',
  '1459912293': 'pyxshuul',
  '1445288832': 'aria',
  '659500662': 'blushimia',
  '203845195': 'cowbee',
  '121490227': 'kelta',
  '88727356': 'jess',
  '531222973': 'gnarly',
  '755193792': 'cypurr'
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export default {
  async fetch(request, env, ctx) {
    var url = new URL(request.url);
    var path = url.pathname;
    var method = request.method;

    if (method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (path === '/health') return new Response('PawketPetsVT Worker OK', { status: 200 });

    if (path === '/twitch/eventsub' && method === 'POST') return handleEventSub(request, env);

    if (path === '/api/overlay' && method === 'GET') return handleOverlayRequest(request, env);
    if (path === '/api/live' && method === 'GET') return handleLive(request, env, ctx);

    if (path === '/setup' && method === 'GET') return requireAdmin(url, env) || handleSetup(request, env);
    if (path === '/clear' && method === 'GET') return requireAdmin(url, env) || handleClear(env);
    if (path === '/subscriptions' && method === 'GET') return requireAdmin(url, env) || handleListSubs(env);

    if (path === '/discord/interactions' && method === 'POST') return handleDiscordInteraction(request, env);
    if (path === '/discord/relay' && method === 'POST') return handleDiscordRelay(request, env);

    return new Response('Not found', { status: 404 });
  }
};

// =============================================
// EVENTSUB
// =============================================
async function handleEventSub(request, env) {
  var body = await request.text();

  if (!(await verifyTwitchSignature(request, body, env.TWITCH_SECRET))) {
    return new Response('Forbidden', { status: 403 });
  }

  var sentAt = Date.parse(request.headers.get('Twitch-Eventsub-Message-Timestamp') || '');
  if (!sentAt || Math.abs(Date.now() - sentAt) > MAX_MESSAGE_AGE_MS) {
    return new Response('Stale message', { status: 403 });
  }

  var data = JSON.parse(body);
  var messageType = request.headers.get('Twitch-Eventsub-Message-Type');
  var messageId = request.headers.get('Twitch-Eventsub-Message-Id');

  if (messageType === 'webhook_callback_verification') {
    return new Response(data.challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  if (messageType === 'revocation') {
    // Twitch revokes a subscription when its authorization is withdrawn (e.g. a
    // streamer disconnects the app). Logged so it shows up in the worker's logs;
    // re-run /setup after the streamer re-authorizes.
    console.warn('EventSub revoked:', data.subscription.type, data.subscription.condition, data.subscription.status);
    return new Response('OK', { status: 200 });
  }

  if (messageType === 'notification') {
    try {
      await routeNotification(data.subscription.type, data.event, messageId, env);
    } catch (e) {
      // A 5xx makes Twitch retry; the message-id check stops a retry paying twice.
      console.error('EventSub handling failed:', data.subscription.type, e.message);
      return new Response('Error', { status: 500 });
    }
  }

  return new Response('OK', { status: 200 });
}

async function routeNotification(type, event, messageId, env) {
  if (type === 'channel.chat.message') {
    await onChat(event, messageId, env);
  } else if (type === 'channel.follow') {
    await award(env, event.user_id, 'follow', PP_PER_FOLLOW,
      'following ' + (event.broadcaster_user_name || event.broadcaster_user_login), messageId,
      FOLLOW_KEYS[event.broadcaster_user_id] || (event.broadcaster_user_login || '').toLowerCase());
  } else if (type === 'channel.subscribe') {
    // Fires for gift RECIPIENTS too (is_gift) — they're rewarded as well, as
    // the original worker did.
    await award(env, event.user_id, 'sub', PP_PER_SUB, 'subscribing / gifting a sub', messageId);
  } else if (type === 'channel.subscription.gift') {
    // user_id is the gifter; it's null for an anonymous gift.
    if (event.is_anonymous || !event.user_id) return;
    await award(env, event.user_id, 'sub', PP_PER_SUB, 'subscribing / gifting a sub', messageId);
  } else if (type === 'channel.cheer') {
    if (event.is_anonymous || !event.user_id) return;
    var pp = Math.floor((event.bits || 0) / BITS_PER_PP);
    if (pp > 0) await award(env, event.user_id, 'cheer', pp, event.bits + ' bits cheered', messageId);
  } else if (type === 'stream.online' || type === 'stream.offline') {
    console.log(type, event.broadcaster_user_login);
  }
}

// =============================================
// REWARDS
// =============================================
async function onChat(event, messageId, env) {
  if (!event.chatter_user_id) return;
  var r = await rpc(env, 'twitch_chat_activity', {
    p_twitch_id: String(event.chatter_user_id),
    p_message_id: messageId,
    p_amount: PP_PER_CHAT,
    p_cooldown_seconds: CHAT_COOLDOWN_SECONDS,
    p_popup_seconds: CHAT_POPUP_COOLDOWN_SECONDS
  });
  if (!r || !r.linked) return;
  if (r.awarded) console.log('Awarded', PP_PER_CHAT, 'PP to', event.chatter_user_login, 'for chatting');
  if (r.popup) await triggerChatPetPopup(r.player_id, event.chatter_user_login, event.broadcaster_user_login, env);
}

async function award(env, twitchUserId, type, amount, reason, messageId, followKey) {
  if (!twitchUserId) return;
  var r = await rpc(env, 'twitch_award', {
    p_twitch_id: String(twitchUserId),
    p_type: type,
    p_amount: amount,
    p_reason: reason,
    p_message_id: messageId,
    p_follow_key: followKey || null
  });
  if (r && r.awarded) console.log('Awarded', amount, 'PP to', twitchUserId, 'for', type);
}

// =============================================
// OBS CHAT-TRIGGERED PET POP-UP
// =============================================
// The 60-second cooldown is decided inside twitch_chat_activity.
async function triggerChatPetPopup(playerId, viewerUsername, broadcasterLogin, env) {
  if (!broadcasterLogin) return;
  try {
    var players = await sbGet(env, '/rest/v1/players?id=eq.' + playerId + '&select=companion_pet_id');
    if (!players || !players[0] || !players[0].companion_pet_id) return;

    var pets = await sbGet(env, '/rest/v1/user_pets?id=eq.' + players[0].companion_pet_id + '&select=nickname,pets(name,image_file)');
    if (!pets || !pets[0]) return;
    var pet = pets[0];

    await fetch(env.SUPABASE_URL + '/rest/v1/chat_pet_triggers', {
      method: 'POST',
      headers: sbHeaders(env, { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
      body: JSON.stringify({
        streamer_login: broadcasterLogin.toLowerCase(),
        viewer_username: viewerUsername,
        pet_name: pet.nickname || (pet.pets && pet.pets.name) || 'Pet',
        pet_image: (pet.pets && pet.pets.image_file) || null
      })
    });
  } catch (e) {
    console.error('Chat pet trigger failed:', e.message);
  }
}

// =============================================
// LIVE STATUS  (GET /api/live?logins=a,b,c)
// =============================================
// Answered with the app's own token, so it works for every visitor, and cached
// for a minute so the sidebar's polling costs about one Twitch call per minute.
// Two caches: Cloudflare's edge cache (which only works on a custom domain, not
// on *.workers.dev) and this isolate's memory (which works everywhere).
var liveMemo = {};

async function handleLive(request, env, ctx) {
  try {
    return await liveResponse(request, env, ctx);
  } catch (e) {
    console.error('Live status failed:', e.message);
    return jsonResponse({ error: 'Live status unavailable' }, 502);
  }
}

async function liveResponse(request, env, ctx) {
  var url = new URL(request.url);
  var logins = (url.searchParams.get('logins') || '').toLowerCase().split(',')
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return /^[a-z0-9_]{1,25}$/.test(s); })
    .slice(0, 100)
    .sort();
  if (!logins.length) return jsonResponse({ error: 'Missing logins' }, 400);

  var memoKey = logins.join(',');
  var cacheHeaders = { 'Cache-Control': 'public, max-age=' + LIVE_CACHE_SECONDS };
  var memo = liveMemo[memoKey];
  if (memo && Date.now() < memo.expires) return jsonResponse({ live: memo.live }, 200, cacheHeaders);

  var cacheKey = new Request(url.origin + '/api/live?logins=' + memoKey);
  var cache = caches.default;
  var hit = await cache.match(cacheKey);
  if (hit) return hit;

  var qs = logins.map(function (l) { return 'user_login=' + l; }).join('&');
  var resp = await twitchApi(env, 'https://api.twitch.tv/helix/streams?first=100&' + qs);
  if (!resp.ok) return jsonResponse({ error: 'Twitch error ' + resp.status }, 502);
  var data = await resp.json();

  var live = (data.data || []).map(function (s) {
    return { login: s.user_login, viewers: s.viewer_count, title: s.title, game: s.game_name };
  });
  liveMemo[memoKey] = { live: live, expires: Date.now() + LIVE_CACHE_SECONDS * 1000 };
  var out = jsonResponse({ live: live }, 200, cacheHeaders);
  ctx.waitUntil(cache.put(cacheKey, out.clone()));
  return out;
}

// =============================================
// ADMIN: SETUP / CLEAR / LIST
// =============================================
function requireAdmin(url, env) {
  var key = url.searchParams.get('key') || '';
  if (env.ADMIN_KEY && safeEqual(key, env.ADMIN_KEY)) return null;
  return new Response('Forbidden', { status: 403 });
}

// Registers every subscription for every team channel. Each line of the result
// says whether Twitch accepted it; a 403 means that streamer (or the chat bot)
// hasn't authorized the app with the scope that subscription needs — see the
// "For streamers" section of the site's Twitch page.
async function handleSetup(request, env) {
  var callbackUrl = new URL(request.url).origin + '/twitch/eventsub';
  var results = [];

  var ids = broadcasterIds(env);
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var subs = [
      { type: 'stream.online', version: '1', condition: { broadcaster_user_id: id } },
      { type: 'stream.offline', version: '1', condition: { broadcaster_user_id: id } },
      { type: 'channel.subscribe', version: '1', condition: { broadcaster_user_id: id } },
      { type: 'channel.subscription.gift', version: '1', condition: { broadcaster_user_id: id } },
      { type: 'channel.cheer', version: '1', condition: { broadcaster_user_id: id } },
      { type: 'channel.follow', version: '2', condition: { broadcaster_user_id: id, moderator_user_id: id } },
      { type: 'channel.chat.message', version: '1', condition: { broadcaster_user_id: id, user_id: env.BOT_USER_ID || id } }
    ];
    for (var j = 0; j < subs.length; j++) {
      var r = await registerSub(subs[j], callbackUrl, env);
      results.push({ type: subs[j].type, broadcaster: id, status: r.status, result: r.result });
    }
  }

  return jsonResponse(results);
}

async function handleClear(env) {
  var subs = await listAllSubs(env);
  var deleted = [];
  for (var i = 0; i < subs.length; i++) {
    await twitchApi(env, 'https://api.twitch.tv/helix/eventsub/subscriptions?id=' + subs[i].id, { method: 'DELETE' });
    deleted.push(subs[i].type + ' (' + subs[i].id + ')');
  }
  return new Response('Deleted ' + deleted.length + ' subscriptions:\n' + deleted.join('\n'), {
    status: 200, headers: { 'Content-Type': 'text/plain' }
  });
}

async function handleListSubs(env) {
  var subs = await listAllSubs(env);
  return jsonResponse(subs.map(function (s) {
    return { type: s.type, status: s.status, condition: s.condition, callback: s.transport && s.transport.callback };
  }));
}

async function listAllSubs(env) {
  var all = [];
  var cursor = '';
  do {
    var resp = await twitchApi(env, 'https://api.twitch.tv/helix/eventsub/subscriptions' + (cursor ? '?after=' + cursor : ''));
    var data = await resp.json();
    all = all.concat(data.data || []);
    cursor = data.pagination && data.pagination.cursor;
  } while (cursor);
  return all;
}

async function registerSub(sub, callbackUrl, env) {
  try {
    var resp = await twitchApi(env, 'https://api.twitch.tv/helix/eventsub/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: sub.type,
        version: sub.version,
        condition: sub.condition,
        transport: { method: 'webhook', callback: callbackUrl, secret: env.TWITCH_SECRET }
      })
    });
    var data = await resp.json();
    return { status: resp.status, result: (data.data && data.data.length) ? 'OK' : (data.message || JSON.stringify(data)) };
  } catch (e) {
    return { status: 'error', result: e.message };
  }
}

// =============================================
// DISCORD — slash commands  (unchanged from the original)
// =============================================
async function handleDiscordInteraction(request, env) {
  var body = await request.text();

  if (!(await verifyDiscordSignature(request, body, env.DISCORD_PUBLIC_KEY))) {
    return new Response('Invalid request signature', { status: 401 });
  }

  var interaction = JSON.parse(body);

  if (interaction.type === 1) return jsonResponse({ type: 1 });

  if (interaction.type === 2) {
    var commandName = interaction.data.name;
    var discordUserId = (interaction.member && interaction.member.user && interaction.member.user.id) ||
                        (interaction.user && interaction.user.id);

    if (commandName === 'mypet') return handleDiscordMyPet(discordUserId, env);
    if (commandName === 'corruption') return handleDiscordCorruption(env);
    if (commandName === 'leaderboard') return handleDiscordLeaderboard(env);
    if (commandName === 'link') {
      var codeOption = interaction.data.options && interaction.data.options[0];
      return handleDiscordLink(discordUserId, codeOption ? codeOption.value : null, env);
    }
  }

  return jsonResponse({ type: 4, data: { content: "I don't recognize that command yet." } });
}

async function verifyDiscordSignature(request, body, publicKeyHex) {
  try {
    var signature = request.headers.get('X-Signature-Ed25519');
    var timestamp = request.headers.get('X-Signature-Timestamp');
    if (!signature || !timestamp || !publicKeyHex) return false;
    var key = await crypto.subtle.importKey('raw', hexToBytes(publicKeyHex), { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify('Ed25519', key, hexToBytes(signature), new TextEncoder().encode(timestamp + body));
  } catch (e) {
    console.error('Discord signature verification error:', e);
    return false;
  }
}

function hexToBytes(hex) {
  var bytes = new Uint8Array(hex.length / 2);
  for (var i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

async function handleDiscordMyPet(discordUserId, env) {
  var players = await sbGet(env, '/rest/v1/players?discord_id=eq.' + discordUserId + '&select=id,username,companion_pet_id');
  if (!players || players.length === 0) {
    return jsonResponse({ type: 4, data: { content: "Your Discord account isn't linked yet! Use `/link` with a code from your PawketPets profile settings." } });
  }
  var player = players[0];
  if (!player.companion_pet_id) {
    return jsonResponse({ type: 4, data: { content: player.username + " hasn't set a companion pet yet!" } });
  }

  var pets = await sbGet(env, '/rest/v1/user_pets?id=eq.' + player.companion_pet_id + '&select=*,pets(name,image_file)');
  if (!pets || pets.length === 0) return jsonResponse({ type: 4, data: { content: 'Pet not found.' } });
  var pet = pets[0];

  var titleText = 'None equipped';
  if (pet.active_pet_title_id) {
    var titles = await sbGet(env, '/rest/v1/pet_titles?id=eq.' + pet.active_pet_title_id + '&select=display_name');
    if (titles && titles[0]) titleText = titles[0].display_name;
  }

  var equipped = await sbGet(env, '/rest/v1/player_equipment?pet_id=eq.' + pet.id + '&is_equipped=eq.true&select=equipment(name,equipment_type,rarity)');
  var weaponText = 'None equipped';
  var armorText = 'None equipped';
  (equipped || []).forEach(function (row) {
    if (!row.equipment) return;
    var label = row.equipment.name + ' (' + row.equipment.rarity + ')';
    if (row.equipment.equipment_type === 'weapon') weaponText = label;
    if (row.equipment.equipment_type === 'armor') armorText = label;
  });

  var speciesName = (pet.pets && pet.pets.name) || 'Pet';
  var displayName = pet.nickname || speciesName;
  var variantInfo = discordVariantInfo(pet.current_variant);
  var wins = pet.battles_won || 0;
  var losses = Math.max(0, (pet.total_battles || 0) - wins);
  var imageUrl = buildPetImageUrl(pet.pets && pet.pets.image_file);
  var isFainted = pet.current_hp <= 0;
  var mood = discordMood(pet.hunger, pet.max_hunger, pet.energy, pet.max_energy, pet.happiness, pet.max_happiness);

  var descLines = [];
  descLines.push('Level ' + pet.level + ' ' + speciesName + (variantInfo ? '  .  ' + variantInfo.icon + ' ' + variantInfo.label : ''));
  if (isFainted) descLines.push('Fainted! Needs healing before its next battle.');
  else descLines.push(mood.icon + ' Feeling **' + mood.label + '**');

  var embed = {
    author: { name: player.username + "'s Companion Card", icon_url: 'https://pawketpets.net/images/pawket-logo.png' },
    title: 'Companion: ' + displayName,
    description: descLines.join('\n'),
    color: isFainted ? 0x888888 : (variantInfo ? variantInfo.color : 0x9966FF),
    fields: [
      { name: 'HP', value: pet.current_hp + '/' + pet.max_hp, inline: true },
      { name: 'Hunger', value: pet.hunger + '/' + pet.max_hunger, inline: true },
      { name: 'Energy', value: pet.energy + '/' + pet.max_energy, inline: true },
      { name: 'Happiness', value: pet.happiness + '/' + pet.max_happiness, inline: true },
      { name: 'Battle Record', value: wins + 'W / ' + losses + 'L', inline: true },
      { name: 'Title', value: titleText, inline: true },
      { name: 'Weapon', value: weaponText, inline: true },
      { name: 'Armor', value: armorText, inline: true }
    ],
    footer: { text: 'PawketPetsVT - pawketpets.net', icon_url: 'https://pawketpets.net/images/pawket-logo.png' },
    timestamp: new Date().toISOString()
  };
  if (imageUrl) embed.thumbnail = { url: imageUrl };

  return jsonResponse({ type: 4, data: { embeds: [embed] } });
}

function buildPetImageUrl(imageFile) {
  if (!imageFile) return null;
  return 'https://pawketpets.net/images/pets/' + imageFile.split('/').pop();
}

function discordMood(hunger, maxHunger, energy, maxEnergy, happiness, maxHappiness) {
  var score = ((hunger || 0) + (energy || 0) + (happiness || 0)) /
    ((maxHunger || 100) + (maxEnergy || 100) + (maxHappiness || 100));
  if (score > 0.75) return { label: 'Thriving', icon: '😄' };
  if (score > 0.5) return { label: 'Happy', icon: '😊' };
  if (score > 0.25) return { label: 'Okay', icon: '😐' };
  return { label: 'Needs Care', icon: '😢' };
}

function discordVariantInfo(variant) {
  if (!variant) return null;
  var basic = {
    golden: { label: 'Golden', icon: '✨', color: 0xFFD700 },
    shiny: { label: 'Shiny', icon: '🌈', color: 0xE0E0E0 },
    cosmic: { label: 'Cosmic', icon: '🌌', color: 0x4B0082 },
    shadow: { label: 'Shadow', icon: '🌑', color: 0x2C2C2C },
    fire: { label: 'Fire', icon: '🔥', color: 0xFF4500 },
    ice: { label: 'Ice', icon: '❄️', color: 0x99DFFF },
    electric: { label: 'Electric', icon: '⚡', color: 0xFFEA00 },
    nature: { label: 'Nature', icon: '🌿', color: 0x66BB6A },
    crystal: { label: 'Crystal', icon: '💎', color: 0xB9F2FF },
    ghost: { label: 'Ghost', icon: '👻', color: 0xB39DDB }
  };
  if (basic[variant]) return basic[variant];
  var special = ['emi', 'numi', 'tob', 'shondo', 'merry', 'vienna', 'lily', 'sleepy', 'cottontail', 'yuno', 'susu', 'sinder', 'snuffy', 'bat', 'zen', 'bao'];
  if (special.indexOf(variant) !== -1) {
    return { label: variant.charAt(0).toUpperCase() + variant.slice(1), icon: '🎨', color: 0x9966FF };
  }
  return null;
}

async function handleDiscordCorruption(env) {
  var rows = await sbGet(env, '/rest/v1/world_state_flags?flag_key=eq.corruption_level&select=value');
  var level = (rows && rows[0]) ? Math.round(rows[0].value) : 50;
  var desc = level >= 75 ? 'The corruption is spreading fast -- the forest needs heroes!'
    : level >= 50 ? "The corruption lingers, held at bay by every trainer's effort."
    : level >= 25 ? 'The world feels a little safer today.'
    : 'The corruption has been pushed back significantly. Well done, everyone.';
  return jsonResponse({ type: 4, data: { content: 'World Corruption: **' + level + '%**\n' + desc } });
}

async function handleDiscordLeaderboard(env) {
  var rows = await rpc(env, 'get_leaderboard_levels', {}).catch(function () { return null; });
  if (!rows || rows.length === 0) return jsonResponse({ type: 4, data: { content: 'No leaderboard data yet.' } });
  var lines = rows.slice(0, 10).map(function (r, i) {
    return (i + 1) + '. **' + r.username + '** -- Total Level ' + r.total_level;
  });
  return jsonResponse({ type: 4, data: { content: '**Top Trainers by Total Level**\n' + lines.join('\n') } });
}

async function handleDiscordLink(discordUserId, code, env) {
  if (!code) {
    return jsonResponse({ type: 4, data: { content: 'Please provide your link code, e.g. `/link code:ABC123`. Generate one from your PawketPets profile settings.' } });
  }
  var upper = encodeURIComponent(code.toUpperCase());
  var codes = await sbGet(env, '/rest/v1/discord_link_codes?code=eq.' + upper + '&used=eq.false&select=*');
  if (!codes || codes.length === 0) {
    return jsonResponse({ type: 4, data: { content: 'Invalid or already-used code. Generate a new one from your PawketPets profile settings.' } });
  }
  var codeRow = codes[0];
  if (new Date(codeRow.expires_at) < new Date()) {
    return jsonResponse({ type: 4, data: { content: 'That code has expired. Generate a new one from your PawketPets profile settings.' } });
  }
  await sbPatch(env, '/rest/v1/players?id=eq.' + codeRow.user_id, { discord_id: discordUserId });
  await sbPatch(env, '/rest/v1/discord_link_codes?code=eq.' + upper, { used: true });
  return jsonResponse({ type: 4, data: { content: 'Your Discord account is now linked to PawketPetsVT! Try `/mypet` to check your companion.' } });
}

// =============================================
// DISCORD — announcement relay (Supabase Database Webhooks)
// =============================================
async function handleDiscordRelay(request, env) {
  if (!env.RELAY_SECRET || !safeEqual(request.headers.get('X-Relay-Secret') || '', env.RELAY_SECRET)) {
    return new Response('Forbidden', { status: 403 });
  }
  try {
    var payload = await request.json();
    var table = payload.table;
    var type = payload.type;
    var record = payload.record;
    var oldRecord = payload.old_record;
    var message = null;

    if (table === 'activity_feed' && type === 'INSERT' && record.is_public) {
      message = formatActivityForDiscord(record);
    } else if (table === 'community_goals') {
      if (type === 'INSERT') {
        message = 'New Community Goal: ' + record.title + '\n' + (record.description || '');
      } else if (type === 'UPDATE' && oldRecord && !oldRecord.is_completed && record.is_completed) {
        message = 'Community Goal Complete! ' + record.title + ' has been achieved!';
      }
    } else if (table === 'active_world_event' && type === 'UPDATE' && oldRecord && oldRecord.event_id !== record.event_id) {
      message = record.event_id ? 'A new world event has begun!' : 'The world event has ended -- the forest returns to normal.';
    } else if (table === 'world_state_flags' && type === 'UPDATE') {
      if (record.flag_key === 'celebration_buff' && (!oldRecord || oldRecord.expires_at !== record.expires_at)) {
        message = '10 bosses defeated by the community! Everyone gets a 1-hour +15% XP/PP bonus!';
      } else if (record.flag_key === 'corruption_level' && oldRecord) {
        if (Math.floor(oldRecord.value / 25) !== Math.floor(record.value / 25)) {
          message = 'World corruption has shifted to **' + Math.round(record.value) + '%**.';
        }
      }
    }

    if (message && env.DISCORD_WEBHOOK_URL) {
      await fetch(env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message })
      });
    }
    return new Response('OK', { status: 200 });
  } catch (e) {
    console.error('Discord relay error:', e);
    return new Response('Error', { status: 500 });
  }
}

// activity_data can arrive as a JSON string from Supabase Database Webhooks, so
// it is parsed before reading fields (the original's fix, kept).
function formatActivityForDiscord(row) {
  var data = {};
  try {
    data = typeof row.activity_data === 'string' ? JSON.parse(row.activity_data) : (row.activity_data || {});
  } catch (e) {
    console.error('Failed to parse activity_data:', e);
  }
  var user = data.username || 'Someone';
  switch (row.activity_type) {
    case 'pet_adopted':
      var species = data.species || data.pet_name || 'a pet';
      return user + ' adopted a ' + species + (data.nickname ? ' and named it **' + data.nickname + '**!' : '!');
    case 'pet_fainted':
      return (data.pet_name || (user + "'s pet")) + ' was defeated in battle against ' + (data.enemy || 'an enemy') + '...';
    case 'boss_defeated':
      return '**' + user + '** defeated ' + (data.boss_name || 'a boss') + '!';
    case 'level_up':
      return (data.pet_name || (user + "'s pet")) + ' just hit level ' + (data.level || '?') + '!';
    case 'badge_earned':
      return '**' + user + '** just earned the ' + (data.badge_name || 'a badge') + ' badge!';
    case 'achievement_unlocked':
      return '**' + user + '** unlocked ' + (data.achievement_name || 'an achievement') + '!';
    case 'title_unlocked':
      return '**' + user + '** unlocked the title "' + (data.title_name || 'a new title') + '"!';
    default:
      return null;
  }
}

// =============================================
// OVERLAY API  (unchanged from the original)
// =============================================
async function handleOverlayRequest(request, env) {
  var streamerName = new URL(request.url).searchParams.get('streamer');
  if (!streamerName) return jsonResponse({ error: 'Missing streamer parameter' }, 400);

  try {
    var players = await sbGet(env, '/rest/v1/players?username=eq.' + encodeURIComponent(streamerName) + '&select=id,companion_pet_id');
    if (!players || players.length === 0) return jsonResponse({ error: 'Streamer not found' }, 404);

    var player = players[0];
    if (!player.companion_pet_id) {
      return jsonResponse({ error: 'No companion pet set', message: streamerName + " hasn't set a companion pet yet!" });
    }

    var pets = await sbGet(env, '/rest/v1/user_pets?id=eq.' + player.companion_pet_id + '&select=*,pets(name,image_file)');
    if (!pets || pets.length === 0) return jsonResponse({ error: 'Pet not found' }, 404);

    var pet = pets[0];
    var pct = function (cur, max) { return Math.round((cur / max) * 100); };
    return jsonResponse({
      success: true,
      pet: {
        id: pet.id,
        name: pet.nickname || (pet.pets && pet.pets.name) || 'Pet',
        species: (pet.pets && pet.pets.name) || 'Pet',
        level: pet.level,
        image: (pet.pets && pet.pets.image_file) || null,
        variant: pet.current_variant || null,
        stats: {
          hp: { current: pet.current_hp, max: pet.max_hp, percent: pct(pet.current_hp, pet.max_hp) },
          hunger: { current: pet.hunger, max: pet.max_hunger, percent: pct(pet.hunger, pet.max_hunger) },
          energy: { current: pet.energy, max: pet.max_energy, percent: pct(pet.energy, pet.max_energy) },
          happiness: { current: pet.happiness, max: pet.max_happiness, percent: pct(pet.happiness, pet.max_happiness) }
        }
      }
    });
  } catch (error) {
    console.error('Overlay API error:', error);
    return jsonResponse({ error: 'Server error' }, 500);
  }
}

// =============================================
// HELPERS
// =============================================
function broadcasterIds(env) {
  return (env.BROADCASTER_IDS || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

function jsonResponse(data, status, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, CORS, extraHeaders || {})
  });
}

// Constant-time string comparison, for signatures and shared secrets.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyTwitchSignature(request, body, secret) {
  if (!secret) return false;
  var messageId = request.headers.get('Twitch-Eventsub-Message-Id') || '';
  var timestamp = request.headers.get('Twitch-Eventsub-Message-Timestamp') || '';
  var signature = request.headers.get('Twitch-Eventsub-Message-Signature') || '';
  var enc = new TextEncoder();
  var key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  var sig = await crypto.subtle.sign('HMAC', key, enc.encode(messageId + timestamp + body));
  var hex = 'sha256=' + Array.from(new Uint8Array(sig)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  return safeEqual(hex, signature);
}

function sbHeaders(env, extra) {
  return Object.assign({
    'apikey': env.SUPABASE_SERVICE_KEY,
    'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY
  }, extra || {});
}

async function sbGet(env, path) {
  var resp = await fetch(env.SUPABASE_URL + path, { headers: sbHeaders(env) });
  if (!resp.ok) throw new Error('Supabase GET ' + path.split('?')[0] + ' failed: ' + resp.status);
  return resp.json();
}

async function sbPatch(env, path, body) {
  return fetch(env.SUPABASE_URL + path, {
    method: 'PATCH',
    headers: sbHeaders(env, { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
    body: JSON.stringify(body)
  });
}

async function rpc(env, fn, args) {
  var resp = await fetch(env.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: sbHeaders(env, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(args)
  });
  if (!resp.ok) throw new Error(fn + ' failed: ' + resp.status + ' ' + (await resp.text()));
  return resp.json();
}

// App access token (client credentials), kept for the isolate's lifetime and
// refreshed shortly before it expires or when Twitch rejects it.
var appToken = null;
var appTokenExpires = 0;

async function getAppToken(env, force) {
  if (!force && appToken && Date.now() < appTokenExpires) return appToken;
  var resp = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'client_id=' + encodeURIComponent(env.TWITCH_CLIENT_ID) +
      '&client_secret=' + encodeURIComponent(env.TWITCH_CLIENT_SECRET) +
      '&grant_type=client_credentials'
  });
  var data = await resp.json();
  if (!data.access_token) throw new Error('Twitch app token failed: ' + JSON.stringify(data));
  appToken = data.access_token;
  appTokenExpires = Date.now() + Math.max(0, (data.expires_in || 3600) - 300) * 1000;
  return appToken;
}

async function twitchApi(env, url, init) {
  init = init || {};
  var call = async function (force) {
    var token = await getAppToken(env, force);
    return fetch(url, Object.assign({}, init, {
      headers: Object.assign({ 'Client-ID': env.TWITCH_CLIENT_ID, 'Authorization': 'Bearer ' + token }, init.headers || {})
    }));
  };
  var resp = await call(false);
  if (resp.status === 401) resp = await call(true);
  return resp;
}

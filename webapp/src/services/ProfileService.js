import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { ProfileData } from '../models/ProfileData.js'
import { TITLE_RARITY_COLORS, DEFAULT_EQUIPPED, MAX_EQUIPPED_BADGES, COSMETICS_CATALOG } from '../data/cosmeticsData.js'

class ProfileService {
  // Ports loadProfile(), game.js:11702-11905. Tries get_player_profile first,
  // falling back to direct queries the same way legacy does.
  async loadProfile(username) {
    let row = null
    const rpcRes = await supabase.rpc('get_player_profile', { p_username: username })
    if (!rpcRes.error && rpcRes.data && rpcRes.data.length) {
      row = rpcRes.data[0]
    } else {
      const playerRes = await supabase
        .from('players')
        .select('id, username, pawketpoints, created_at, bio')
        .ilike('username', username)
        .maybeSingle()
      if (playerRes.error || !playerRes.data) throw new Error('Player "' + username + '" not found.')
      row = playerRes.data
    }

    // The RPC may not include pet rollups — compute them if missing.
    if (row.total_pets === undefined || row.total_pets === null) {
      const petsRes = await supabase.from('user_pets').select('level').eq('user_id', row.id)
      const pets = petsRes.data || []
      row.total_pets = pets.length
      row.total_levels = pets.reduce((sum, p) => sum + (p.level || 0), 0)
      row.highest_level = pets.length ? Math.max(...pets.map(p => p.level || 0)) : 0
    }

    const [titleRes, rankRes, cosmeticsRes] = await Promise.all([
      supabase.from('players').select('active_player_title_id, player_titles(*)').eq('id', row.id).maybeSingle(),
      supabase.from('players').select('pawketpoints').order('pawketpoints', { ascending: false }),
      supabase.from('players').select('equipped_cosmetics').eq('id', row.id).maybeSingle()
    ])

    if (titleRes.data && titleRes.data.active_player_title_id && titleRes.data.player_titles) {
      row.title = decorateTitle(titleRes.data.player_titles)
    }
    if (rankRes.data) {
      const idx = rankRes.data.findIndex(p => p.pawketpoints <= row.pawketpoints)
      row.rank = idx >= 0 ? idx + 1 : null
    }
    row.equipped_cosmetics = normalizeEquipped(cosmeticsRes.data && cosmeticsRes.data.equipped_cosmetics)

    return new ProfileData(row)
  }

  // Ports the pets grid query in loadProfile(), game.js:11847-11851.
  async loadProfilePets(userId) {
    const { data } = await supabase
      .from('user_pets')
      .select('*, pets(name, image_file, vtuber_name)')
      .eq('user_id', userId)
      .order('adopted_at', { ascending: true })
    return data || []
  }

  // Ports loadProfileBadges(), game.js:12284-12341 — earned badges only.
  async loadEarnedBadges(userId) {
    const { data } = await supabase
      .from('user_badges')
      .select('badge_id, earned_at, badges(*)')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false })
    return (data || []).filter(b => b.badges)
  }

  // Ports loadMyProfileBadges(), game.js:12029-12102 — the full catalog with
  // locked/unlocked state, which only the owner's own profile shows.
  async loadAllBadgesWithProgress(userId) {
    const [allRes, earnedRes] = await Promise.all([
      supabase.from('badges').select('*').order('sort_order', { ascending: true }),
      supabase.from('user_badges').select('badge_id, earned_at').eq('user_id', userId)
    ])
    const earnedMap = {}
    ;(earnedRes.data || []).forEach(b => { earnedMap[b.badge_id] = b.earned_at })
    return (allRes.data || []).map(badge => ({
      ...badge,
      earned: Object.prototype.hasOwnProperty.call(earnedMap, badge.id),
      earnedAt: earnedMap[badge.id] || null
    }))
  }

  async loadMyProfile(userId) {
    const res = await supabase.from('players').select('*').eq('id', userId).maybeSingle()
    if (!res.data) throw new Error('Could not load your profile.')
    const row = res.data

    const [petsRes, rankRes] = await Promise.all([
      supabase.from('user_pets').select('level').eq('user_id', userId),
      supabase.from('players').select('id, pawketpoints').order('pawketpoints', { ascending: false })
    ])
    const pets = petsRes.data || []
    row.total_pets = pets.length
    row.total_levels = pets.reduce((sum, p) => sum + (p.level || 0), 0)
    row.highest_level = pets.length ? Math.max(...pets.map(p => p.level || 0)) : 0
    if (rankRes.data) {
      const idx = rankRes.data.findIndex(p => p.id === userId)
      row.rank = idx >= 0 ? idx + 1 : null
    }
    row.equipped_cosmetics = normalizeEquipped(row.equipped_cosmetics)

    if (row.active_player_title_id) {
      const t = await supabase.from('players').select('player_titles(*)').eq('id', userId).maybeSingle()
      if (t.data && t.data.player_titles) row.title = decorateTitle(t.data.player_titles)
    }
    return new ProfileData(row)
  }

  // Ports saveProfile()'s validation + update, game.js:12104-12260. Throws on
  // any validation failure so the page can surface one message.
  async saveProfile(userId, username, bio, currentUsername) {
    const { containsProfanity } = await import('../utils/profanity.js')
    const name = (username || '').trim()
    const newBio = (bio || '').trim()

    if (!name) throw new Error('Username cannot be empty!')
    if (name.length > 20) throw new Error('Username must be 20 characters or less!')
    if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error('Username can only contain letters, numbers, and underscores!')
    if (newBio.length > 200) throw new Error('Bio must be 200 characters or less!')
    if (containsProfanity(name)) throw new Error('Name cannot contain offensive language')
    if (containsProfanity(newBio)) throw new Error('Bio cannot contain offensive language')

    if (name !== currentUsername) {
      const check = await supabase.from('players').select('id').ilike('username', name).neq('id', userId)
      if (check.data && check.data.length) throw new Error('Username "' + name + '" is already taken!')
    }

    const { error } = await supabase.from('players').update({ username: name, bio: newBio }).eq('id', userId)
    if (error) throw error
    if (AppState.player) {
      AppState.player.username = name
      AppState.player.bio = newBio
    }
  }

  // Player titles — ports loadAllPlayerTitles/loadPlayerTitles/setActivePlayerTitle,
  // game.js:31162-31224 and 31287-31320.
  async loadTitleOptions(userId) {
    const [allRes, ownedRes, activeRes] = await Promise.all([
      supabase.from('player_titles').select('*').order('rarity', { ascending: false }),
      supabase.from('user_player_titles').select('player_title_id').eq('user_id', userId),
      supabase.from('players').select('active_player_title_id').eq('id', userId).maybeSingle()
    ])
    const ownedIds = (ownedRes.data || []).map(t => t.player_title_id)
    return {
      titles: (allRes.data || []).map(t => ({ ...t, unlocked: ownedIds.includes(t.id) })),
      activeId: (activeRes.data && activeRes.data.active_player_title_id) || ''
    }
  }

  async setActiveTitle(userId, titleId) {
    const { error } = await supabase.from('players').update({ active_player_title_id: titleId || null }).eq('id', userId)
    if (error) throw error
  }

  // Cosmetics — equipped selection now persists server-side (see
  // supabase/migrations/2026-08-23_cosmetics_equipped.sql). game.js kept this
  // in localStorage only, so it never followed the account across devices and
  // was invisible to anyone else viewing the profile.
  async saveEquipped(userId, equipped) {
    const { error } = await supabase.from('players').update({ equipped_cosmetics: equipped }).eq('id', userId)
    if (error) throw error
    if (AppState.player) AppState.player.equipped_cosmetics = equipped
  }

  isOwned(type, id, unlockedIds = []) {
    const item = (COSMETICS_CATALOG[type + 's'] || []).find(c => c.id === id)
    if (!item) return false
    if (item.alwaysUnlocked) return true
    return unlockedIds.includes(id)
  }

  // Ports the equip/toggle rules from cosmetics_equip(), game.js:639-660 —
  // badges toggle and cap at 3 (oldest drops off), others are single-select.
  applyEquip(equipped, type, id) {
    const next = { background: equipped.background, frame: equipped.frame, badges: [...equipped.badges] }
    if (type === 'badge') {
      const idx = next.badges.indexOf(id)
      if (idx !== -1) next.badges.splice(idx, 1)
      else {
        if (next.badges.length >= MAX_EQUIPPED_BADGES) next.badges.shift()
        next.badges.push(id)
      }
    } else {
      next[type] = id
    }
    return next
  }
}

function decorateTitle(title) {
  return { ...title, resolvedColor: title.color || TITLE_RARITY_COLORS[title.rarity] || '#8e8e8e' }
}

function normalizeEquipped(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_EQUIPPED }
  return {
    background: raw.background || DEFAULT_EQUIPPED.background,
    frame: raw.frame || DEFAULT_EQUIPPED.frame,
    badges: Array.isArray(raw.badges) ? raw.badges : []
  }
}

export const profileService = new ProfileService()

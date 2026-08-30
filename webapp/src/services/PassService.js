import { reactive } from 'vue'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { playerService } from './PlayerService.js'
import { inventoryService } from './InventoryService.js'
import { awardService } from './AwardService.js'
import { toastService } from './ToastService.js'
import {
  PASS_REWARDS, PASS_MAX_LEVEL, PASS_SEASON,
  PASS_ITEM_CATEGORIES, passItemLabel,
  xpForLevel, DAILY_XP_CAPS
} from '../data/passData.js'

// Ports the PawketPass (game.js:10782-11110) — a 50-level season track fed by
// XP from almost every activity, with per-source daily caps.
//
// Five services have deferred "grant Pass XP" hooks since Phase 3; this is what
// closes them. `passService.addXP(n, source)` is the only entry point they need.
//
// SERVER-AUTHORITATIVE where the RPCs exist. `pending-sql/pass_server_side.sql`
// adds pass_seasons / pass_reward_tracks / pass_xp_sources plus
// pass_add_xp_secure / pass_claim_reward_secure / pass_get_progress, so the
// daily caps, the level check and the reward amounts all live on the server and
// the client only ever names a source or a level.
//
// Every method below tries its RPC first and falls back to the legacy
// client-side path when the function is absent, so the Pass works before the
// SQL is applied — the same pattern as redeem and racing gear. The fallback
// carries the original trust assumptions (localStorage caps, client-checked
// eligibility); once the SQL is in, none of that is reachable.
export const passState = reactive({
  level: 1,
  xp: 0,
  xpToNext: xpForLevel(2),
  claimed: [],
  loaded: false,
  // Set once pass_get_progress answers: the server owns caps, eligibility and
  // reward amounts, and `track` is its copy of the reward table.
  serverSide: false,
  serverCaps: {},
  track: [],
  // Season identity, from the server when available so a future season with a
  // different name or level cap renders correctly without a code change.
  seasonNumber: PASS_SEASON,
  seasonName: null,
  maxLevel: PASS_MAX_LEVEL
})

const capsKey = () => 'daily_xp_caps_' + new Date().toISOString().slice(0, 10)

function readCaps() {
  try {
    const raw = localStorage.getItem(capsKey())
    if (raw) return JSON.parse(raw)
  } catch { /* unreadable — start fresh */ }
  // Keyed by today's date, so yesterday's entry is simply never read again.
  return Object.fromEntries(Object.keys(DAILY_XP_CAPS).map(k => [k, 0]))
}

function writeCaps(caps) {
  try { localStorage.setItem(capsKey(), JSON.stringify(caps)) } catch { /* private mode */ }
}

class PassService {
  async load() {
    if (!AppState.user) return
    try {
      // Server path: one call returns progress AND the season's reward track,
      // so the client's own PASS_REWARDS copy becomes a fallback rather than
      // the source of truth.
      const rpc = await supabase.rpc('pass_get_progress')
      if (!rpc.error && rpc.data && rpc.data.ok) {
        const d = rpc.data
        passState.level = d.level
        passState.xp = d.xp
        passState.xpToNext = d.xp_to_next
        passState.claimed = d.claimed || []
        passState.serverCaps = d.daily_caps || {}
        passState.track = d.track || []
        passState.seasonNumber = d.season_number
        passState.seasonName = d.season_name
        passState.maxLevel = d.max_level || PASS_MAX_LEVEL
        passState.serverSide = true
        passState.loaded = true
        return
      }

      const { data } = await supabase
        .from('user_pass_progress').select('*')
        .eq('user_id', AppState.user.id).eq('season', PASS_SEASON).maybeSingle()

      if (data) {
        passState.level = data.level || 1
        passState.xp = data.xp || 0
        passState.claimed = data.claimed_rewards || []
      } else {
        await supabase.from('user_pass_progress').insert({
          user_id: AppState.user.id, season: PASS_SEASON,
          level: 1, xp: 0, claimed_rewards: []
        })
        passState.level = 1
        passState.xp = 0
        passState.claimed = []
      }
      passState.xpToNext = xpForLevel(passState.level + 1)
      passState.loaded = true
    } catch (e) {
      console.error('[pass] load failed:', e)
    }
  }

  // How much XP this source can still earn today. Reads the server's counters
  // when the RPCs are live, the localStorage ones otherwise.
  remainingToday(source) {
    const max = DAILY_XP_CAPS[source]
    if (max === undefined) return Infinity   // uncapped source
    const used = passState.serverSide
      ? (passState.serverCaps[source] || 0)
      : (readCaps()[source] || 0)
    return Math.max(0, max - used)
  }

  // The single entry point every other service uses. Never throws.
  async addXP(amount, source) {
    if (!AppState.user || !(amount > 0)) return null
    try {
      if (!passState.loaded) await this.load()

      // Server path: the cap is applied and the level-up computed server-side.
      const rpc = await supabase.rpc('pass_add_xp_secure', { p_source: source, p_amount: amount })
      if (!rpc.error && rpc.data && rpc.data.ok) {
        const before = passState.level
        passState.level = rpc.data.level
        passState.xp = rpc.data.xp
        passState.xpToNext = rpc.data.xp_to_next
        if (rpc.data.level > before) {
          toastService.success(`🎫 Pass Level Up! Now Level ${rpc.data.level}!`)
        }
        return { level: rpc.data.level, gained: rpc.data.levels_gained || 0 }
      }

      // A capped-out source is a normal answer, not a problem. Anything else
      // means the server refused the grant and the client path below is about to
      // write a level the server did not agree to — worth seeing in the console
      // rather than silently diverging. Phase 9.5 added a dozen new sources
      // (cooking, racing, guild_*, grand_prix_*, poll_vote, recipe_book,
      // secret_discovery); if any of them are not rows in `pass_xp_sources`,
      // this is where it will show up.
      if (passState.serverSide && rpc.data && rpc.data.reason !== 'capped') {
        console.warn('[pass] server refused XP for source', source, '-', rpc.data.reason || rpc.error)
      }

      // Trim to whatever the daily cap allows, as legacy does.
      if (DAILY_XP_CAPS[source] !== undefined) {
        const caps = readCaps()
        const remaining = DAILY_XP_CAPS[source] - (caps[source] || 0)
        if (remaining <= 0) return null
        amount = Math.min(amount, remaining)
        caps[source] = (caps[source] || 0) + amount
        writeCaps(caps)
      }

      passState.xp += amount
      let gained = 0
      while (passState.xp >= passState.xpToNext && passState.level < PASS_MAX_LEVEL) {
        passState.xp -= passState.xpToNext
        passState.level++
        passState.xpToNext = xpForLevel(passState.level + 1)
        gained++
      }

      const { error } = await supabase.from('user_pass_progress').upsert({
        user_id: AppState.user.id,
        season: PASS_SEASON,
        level: passState.level,
        xp: passState.xp,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,season' })
      if (error) console.error('[pass] save failed:', error)

      if (gained > 0) {
        toastService.success(`🎫 Pass Level Up! Now Level ${passState.level}!`)
      }

      // Mini-seasons receive the same XP. Fire-and-forget: the RPC belongs to a
      // system that isn't migrated, so a missing function must not fail the Pass.
      supabase.rpc('add_season_pass_xp', { p_amount: amount }).then(null, () => {})

      return { level: passState.level, gained }
    } catch (e) {
      console.error('[pass] addXP failed:', e)
      return null
    }
  }

  reward(level) { return PASS_REWARDS[level] || null }

  canClaim(level) {
    return passState.level >= level && !passState.claimed.includes(level)
  }

  async claim(level) {
    if (!AppState.user) return
    if (passState.claimed.includes(level)) throw new Error('You already claimed this reward!')
    if (passState.level < level) throw new Error(`Reach Level ${level} to claim this reward!`)

    const rpc = await supabase.rpc('pass_claim_reward_secure', { p_level: level })
    if (!rpc.error && rpc.data) {
      if (!rpc.data.ok) throw new Error(rpc.data.error || 'Could not claim that reward.')
      passState.claimed = [...passState.claimed, level]
      this._announce(rpc.data.reward_type, rpc.data.reward_data)
      return rpc.data
    }

    const reward = PASS_REWARDS[level]
    if (!reward) return

    await this._grant(level, reward)

    passState.claimed = [...passState.claimed, level]
    await supabase.from('user_pass_progress')
      .update({ claimed_rewards: passState.claimed })
      .eq('user_id', AppState.user.id).eq('season', PASS_SEASON)

    return reward
  }

  // Announces what the SERVER just granted. The server path does the granting
  // itself, so this only reports it — the shapes match pass_reward_tracks.
  _announce(type, data) {
    data = data || {}
    if (type === 'points') {
      toastService.success(`✨ +${data.amount} PawketPoints!`)
    } else if (type === 'skin_key') {
      toastService.success(`🔑 +${data.amount || 1} Skin Key`)
    } else if (type === 'title') {
      toastService.success(`🏆 Title unlocked: "${(data.title_key || '').replace(/_/g, ' ')}"!`)
    } else if (type === 'item') {
      // `granted_name` / `granted_name2` are what the RPC resolved a category
      // token to, so the toast can name the actual item drawn rather than the
      // category. It falls back to the label for a fixed reward.
      const shown = (ref, resolved) => resolved || passItemLabel(ref)
      toastService.success(`📦 +${data.quantity || 1}x ${shown(data.item, data.granted_name)}`)
      if (data.item2) {
        toastService.success(`📦 +${data.quantity2 || 1}x ${shown(data.item2, data.granted_name2)}`)
      }
    }
  }

  // Mirror of the server's `pass_resolve_item`, for the fallback path only.
  // A reference is one of three things:
  //   • a category token  -> a random item matching that category
  //   • a uuid            -> that item
  //   • anything else     -> an item NAME, underscores read as spaces
  // Returns null when nothing matches, so the caller can refuse the claim
  // rather than record it and grant nothing.
  async _resolveItem(ref) {
    const category = PASS_ITEM_CATEGORIES[ref]
    if (category) {
      let q = supabase.from('items').select('id,name').eq('item_type', category.item_type)
      if (category.food_category) {
        q = Array.isArray(category.food_category)
          ? q.in('food_category', category.food_category)
          : q.eq('food_category', category.food_category)
      }
      const { data } = await q
      if (!data || !data.length) return null
      return data[Math.floor(Math.random() * data.length)]
    }

    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref)) {
      const { data } = await supabase.from('items').select('id,name').eq('id', ref).maybeSingle()
      return data || null
    }

    const { data } = await supabase.from('items').select('id,name')
      .ilike('name', String(ref).replace(/_/g, ' ')).maybeSingle()
    return data || null
  }

  async _grant(level, reward) {
    if (reward.type === 'points') {
      await playerService.awardPoints(reward.amount, 'pass_level_' + level)
      toastService.success(`✨ +${reward.amount} PawketPoints!`)
      return
    }

    if (reward.type === 'item') {
      for (const [ref, qty] of [[reward.itemId, reward.quantity], [reward.itemId2, reward.quantity2]]) {
        if (!ref) continue
        const item = await this._resolveItem(ref)
        // Refuse rather than grant nothing. This is the fallback path, so a
        // miss here means the same thing it means server-side: the reference
        // does not name a real item, and burning the level for it is exactly
        // the legacy behaviour being corrected.
        if (!item) {
          console.error('[pass] could not resolve reward item:', ref)
          toastService.error('That reward could not be granted — nothing was consumed.')
          throw new Error('unresolved pass item: ' + ref)
        }
        await inventoryService.grant(AppState.user.id, item.id, qty || 1)
        toastService.success(`📦 +${qty || 1}x ${item.name}`)
      }
      return
    }

    if (reward.type === 'title') {
      // LEGACY BUG: after awarding, legacy looked the title up in a `titles`
      // table to name it in a toast — but every other reference in the codebase
      // uses `player_titles`. `titles` does not exist, so that lookup returns
      // nothing and the confirmation toast never appears; the title IS granted,
      // silently. awardPlayerTitle returns the row, so the name is on hand here.
      const title = await awardService.awardPlayerTitle(reward.titleKey, 'PawketPass reward')
      if (title) toastService.success(`🏆 Title unlocked: "${title.display_name}"!`)
      return
    }
  }

  // How many rewards are sitting unclaimed — what the navbar badge shows.
  // Counts against the server's track when it is loaded, so a season with a
  // different set of levels is counted correctly.
  unclaimedCount() {
    if (passState.track && passState.track.length) {
      return passState.track.filter(
        r => r.level <= passState.level && !passState.claimed.includes(r.level)
      ).length
    }
    let n = 0
    for (let lvl = 1; lvl <= passState.level; lvl++) {
      if (PASS_REWARDS[lvl] && !passState.claimed.includes(lvl)) n++
    }
    return n
  }
}

export const passService = new PassService()

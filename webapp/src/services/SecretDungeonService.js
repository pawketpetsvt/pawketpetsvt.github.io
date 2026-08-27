import { reactive } from 'vue'
import * as badgeHooks from './BadgeHooks.js'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { taskTracker } from './TaskTrackerService.js'
import { SECRET_DUNGEONS, DISCOVERY_CHANCE, DISCOVERY_PP } from '../data/secretDungeonData.js'

// Ports handleSecretDungeonEncounter / secretDungeon_isUnlocked /
// secretDungeon_loadFromDB (game.js:5743-5825) — the discovery that reveals the
// two hidden battle zones.
//
// Both zones were already fully built on the Vue side; without this they simply
// never appeared in the zone picker, which filters on `secret`.
export const secretDungeonState = reactive({
  unlocked: [],   // unlock_key[]
  loaded: false
})

class SecretDungeonService {
  // Read from `player_unlocks` directly rather than legacy's localStorage
  // mirror, so a cleared browser or a new device can't hide a zone the player
  // has already found.
  async loadUnlocks() {
    if (!AppState.user) return
    try {
      const res = await supabase.from('player_unlocks')
        .select('unlock_key')
        .eq('user_id', AppState.user.id)
        .in('unlock_key', SECRET_DUNGEONS.map(d => d.key))
      secretDungeonState.unlocked = (res.data || []).map(r => r.unlock_key)
    } catch (e) {
      console.error('[secretDungeonService.loadUnlocks]', e)
      secretDungeonState.unlocked = []
    } finally {
      secretDungeonState.loaded = true
    }
  }

  isUnlocked(key) {
    return secretDungeonState.unlocked.includes(key)
  }

  // Which dungeons could still be found while exploring `zoneKey`.
  eligible(zoneKey) {
    return SECRET_DUNGEONS.filter(d =>
      d.requiredZones.includes(zoneKey) && !this.isUnlocked(d.key))
  }

  // Rolls the discovery. Returns the dungeon that was found, or null — either
  // because the roll missed or because there is nothing left to find from here.
  //
  // Legacy falls through to a flavour encounter when nothing is eligible; the
  // caller decides that here, since the expedition claim already has its own
  // result to show.
  async roll(zoneKey) {
    if (!AppState.user || !zoneKey) return null
    if (Math.random() >= DISCOVERY_CHANCE) return null

    if (!secretDungeonState.loaded) await this.loadUnlocks()
    const options = this.eligible(zoneKey)
    if (!options.length) return null

    return this.discover(options[Math.floor(Math.random() * options.length)])
  }

  async discover(dungeon) {
    try {
      const res = await supabase.from('player_unlocks').upsert({
        user_id: AppState.user.id,
        unlock_key: dungeon.key,
        unlocked_at: new Date().toISOString()
      }, { onConflict: 'user_id,unlock_key' })
      if (res.error) throw res.error
    } catch (e) {
      // A failed write means the zone would vanish on reload, so don't claim
      // the discovery happened.
      console.error('[secretDungeonService.discover]', e)
      return null
    }

    if (!secretDungeonState.unlocked.includes(dungeon.key)) {
      secretDungeonState.unlocked = [...secretDungeonState.unlocked, dungeon.key]
    }

    const { playerService } = await import('./PlayerService.js')
    await playerService.awardPoints(DISCOVERY_PP, 'secret_dungeon_found')
    taskTracker.report('find_secret_dungeon')
    badgeHooks.onSecretDungeonFound(dungeon.key)

    // The `secret_dungeon_<key>` badge IS granted (see the hook above, Phase
    // 9.5). Pass XP is not — UNBLOCKED BY: the PawketPass port.
    return { dungeon, pp: DISCOVERY_PP }
  }

  // Ports checkSecretDiscovery() (game.js:8873) — a SECOND, separate secret
  // system from the hidden battle zones above. These are `exploration_secrets`
  // rows gated on an exploration STREAK rather than a random roll, so they are
  // rewards for returning a pet to the same zone repeatedly.
  //
  // Deferred through Phases 7-8 because streaks were unported. They now exist
  // (ExpeditionService.bumpStreak), so this is live.
  //
  // LEGACY BUG this port fixes: `expeditions.discovered_secrets` is READ here
  // and written NOWHERE in the entire codebase, so `foundKeys` is always empty.
  // Every qualifying claim re-announces the same secret AND re-awards its PP —
  // a repeatable payout, not just a repeated toast. The discovery is recorded
  // below so each secret pays once.
  async checkExplorationSecret(petId, zone, streak) {
    if (!AppState.user) return null
    try {
      const { data: all, error } = await supabase
        .from('exploration_secrets').select('*').eq('zone', zone)
      if (error) return null

      // The threshold column name varies between environments, so legacy
      // filters client-side across three possible names rather than risking a
      // 400 on a column that may not exist. Kept.
      const eligible = (all || []).filter(s => {
        const threshold = s.required_expedition_count || s.min_expeditions || s.expedition_count || 0
        return streak >= threshold
      })
      if (!eligible.length) return null

      const { data: rows } = await supabase
        .from('expeditions')
        .select('id, discovered_secrets')
        .eq('user_id', AppState.user.id)
        .not('discovered_secrets', 'is', null)
        .limit(50)

      const found = new Set()
      ;(rows || []).forEach(r => (r.discovered_secrets || []).forEach(s => found.add(s)))

      // Only the first undiscovered secret, so several never stack at once.
      const secret = eligible.find(s => !found.has(s.secret_key))
      if (!secret) return null

      // Record it against the most recent expedition for this pet+zone, which
      // is the row the claim just completed.
      const { data: recent } = await supabase
        .from('expeditions')
        .select('id, discovered_secrets')
        .eq('user_id', AppState.user.id)
        .eq('pet_id', petId)
        .eq('zone', zone)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (recent && recent.id) {
        const next = [...(recent.discovered_secrets || []), secret.secret_key]
        const { error: writeErr } = await supabase
          .from('expeditions')
          .update({ discovered_secrets: next })
          .eq('id', recent.id)
        // If the discovery can't be recorded, don't pay for it — otherwise the
        // exploit legacy has is reproduced here.
        if (writeErr) {
          console.warn('[secrets] could not record discovery, skipping reward:', writeErr.message)
          return null
        }
      } else {
        return null
      }

      if (secret.reward_pp) {
        // Imported lazily, as in discover() above — PlayerService pulls in a
        // chunk this service otherwise never needs.
        const { playerService } = await import('./PlayerService.js')
        await playerService.awardPoints(secret.reward_pp, 'secret_discovery')
      }

      // Badge (`secret.badge_reward`) and Pass XP are not granted — both systems
      // are unmigrated, same as the hidden-zone discovery above.
      return {
        key: secret.secret_key,
        name: secret.name || 'Hidden Location',
        description: secret.description || '',
        pp: secret.reward_pp || 0
      }
    } catch (e) {
      console.error('[secrets] exploration secret check failed:', e)
      return null
    }
  }
}

export const secretDungeonService = new SecretDungeonService()

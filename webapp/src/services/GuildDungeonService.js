import { supabase } from './SupabaseService.js'
import { passService } from './PassService.js'
import { AppState } from '../AppState.js'
import { playerService } from './PlayerService.js'
import { expeditionService } from './ExpeditionService.js'
import { taskTracker } from './TaskTrackerService.js'
import { guildState, GuildError } from './GuildService.js'
import { canPerformAction } from '../utils/RateLimit.js'
import { buildWaves, createBattle } from './GuildDungeonEngine.js'
import { MAX_PARTY_GUILDMATES } from '../data/guildDungeonData.js'

// Everything in guild dungeons that touches the database. The combat rules live
// in GuildDungeonEngine, which is pure.
class GuildDungeonService {
  async loadDungeons() {
    const { data } = await supabase
      .from('guild_dungeons').select('*').order('base_enemy_level', { ascending: true })
    return data || []
  }

  isLocked(dungeon) {
    return (guildState.myGuild?.guild_level || 1) < (dungeon.required_guild_level || 1)
  }

  // Guildmates who have set a liaison pet, for the party builder.
  async loadGuildmates() {
    if (!guildState.myGuild) return []
    const { data } = await supabase.rpc('get_guild_liaisons', {
      p_guild_id: guildState.myGuild.guild_id,
      p_exclude_user_id: AppState.user.id
    })
    return data || []
  }

  // Re-read from the DB rather than trusting guildState.liaisonPetId, which can
  // be stale if the pet was changed in another tab — legacy does the same here,
  // and for the same reason.
  async myLiaison() {
    if (!guildState.myGuild) return null
    const { data } = await supabase
      .from('guild_liaisons')
      .select('pet_id, user_pets(nickname, level, current_variant, max_hp, current_hp, base_hp, base_attack, base_defense, base_speed)')
      .eq('guild_id', guildState.myGuild.guild_id)
      .eq('user_id', AppState.user.id)
      .eq('is_active', true)
      .maybeSingle()
    if (data && data.pet_id) guildState.liaisonPetId = data.pet_id
    return data || null
  }

  // Ports guild_startDungeon(). Charges the entry fee, assembles the party and
  // hands back a battle state for the engine to drive.
  //
  // Legacy built the player's own party entry from `petState` — an in-memory
  // cache only populated by visiting My Pets — so opening Guild first sent a
  // pet with the fallback 60/5/3/4 stat block into the dungeon regardless of its
  // real stats. The liaison row carries the real columns instead.
  async start(dungeonKey, guildmateIds = []) {
    if (!guildState.myGuild) throw new GuildError('You are not in a guild.')
    if (!canPerformAction('guild_dungeon', 5000)) throw new GuildError('Slow down a moment!')

    const { data: dungeon } = await supabase
      .from('guild_dungeons').select('*').eq('dungeon_key', dungeonKey).maybeSingle()
    if (!dungeon) throw new GuildError('Dungeon not found')

    const liaison = await this.myLiaison()
    if (!liaison || !liaison.pet_id) throw new GuildError('Set a Guild Pet first!')

    const cost = dungeon.entry_cost_pp || 0
    if ((AppState.player?.pawketpoints || 0) < cost) {
      throw new GuildError(`Need ${cost} PP to enter!`)
    }
    if (cost > 0) {
      const spent = await playerService.spendPoints(cost, 'guild_dungeon_entry')
      if (spent === null) throw new GuildError('Could not deduct entry cost. Please try again.')
    }

    const up = liaison.user_pets || {}
    const maxHp = up.max_hp || up.base_hp || 60
    const party = [{
      id: liaison.pet_id,
      name: up.nickname || 'Your Pet',
      ownerName: 'You',
      isPlayer: true,
      icon: '🐾',
      variant: up.current_variant || null,
      maxHp,
      currentHp: up.current_hp || maxHp,
      attack: up.base_attack || 5,
      defense: up.base_defense || 3,
      speed: up.base_speed || 4
    }]

    if (guildmateIds.length) {
      const liaisons = await this.loadGuildmates()
      guildmateIds.slice(0, MAX_PARTY_GUILDMATES).forEach(userId => {
        const l = liaisons.find(x => x.user_id === userId)
        if (!l) return
        party.push({
          id: l.pet_id,
          name: l.pet_name || 'Pet',
          ownerName: l.username || 'Guildmate',
          isPlayer: false,
          icon: '🐾',
          variant: l.pet_variant || null,
          maxHp: l.pet_max_hp || 30,
          currentHp: l.pet_max_hp || 30,
          attack: l.pet_attack || 5,
          defense: l.pet_defense || 3,
          speed: l.pet_speed || 4
        })
      })
    }

    const waves = buildWaves(dungeonKey, dungeon.base_enemy_level || 5, dungeon.waves || 3)
    return createBattle(dungeon, party, waves)
  }

  // Ports guild_endDungeon(), game.js:8703.
  //
  // LEGACY BUG — no guild dungeon has ever paid out. That function opens with
  //     var s = window._guildBattleState;
  //     if (!s) { guild_renderDungeons(); return; }
  // and `window._guildBattleState` is NEVER ASSIGNED anywhere in the codebase —
  // it is only read here and nulled at the end. The battle state actually lives
  // in `_guildManualState`, a plain var, so the guard always fires and the
  // function returns immediately. On the live site that means the entry fee IS
  // charged and then NOTHING is granted: no PP, no pet XP, no guild XP, no guild
  // tokens, and no row in `guild_dungeon_runs` — which is also why "Recent Runs"
  // is always empty. Half-applied rename, same shape as the `_old` suffix left
  // on the dead referral path.
  //
  // Here the caller passes the real battle state, so the payout runs.
  async finish(battle, victory, wavesCleared) {
    const dungeon = battle.dungeon
    const totalWaves = battle.waves.length
    const guildId = guildState.myGuild.guild_id

    const { data: pet } = await supabase
      .from('user_pets').select('level').eq('id', guildState.liaisonPetId).maybeSingle()

    const levelBonus = Math.min(1.5, 1 + ((pet?.level || 1) / 100))
    const clearRatio = totalWaves ? wavesCleared / totalWaves : 0
    const ppReward = Math.floor((dungeon.base_pp_reward || 0) * levelBonus * clearRatio)
    const xpReward = Math.floor((dungeon.base_xp_reward || 0) * levelBonus * clearRatio)
    const guildXp = Math.floor((dungeon.base_guild_xp_reward || 0) * clearRatio)
    const tokens = Math.floor((dungeon.base_pp_reward || 0) * clearRatio / 20)

    if (ppReward > 0) await playerService.awardPoints(ppReward, 'guild_dungeon')
    // Reuses the shared XP curve rather than a second copy of the level-up loop.
    if (xpReward > 0) await expeditionService.awardPetXP(guildState.liaisonPetId, xpReward)

    if (tokens > 0) {
      const newTokens = (guildState.myGuild.guild_tokens || 0) + tokens
      await supabase.from('guilds').update({ guild_tokens: newTokens }).eq('id', guildId)
      guildState.myGuild.guild_tokens = newTokens
    }
    if (guildXp > 0) {
      await supabase.rpc('add_guild_xp', { p_guild_id: guildId, p_xp_amount: guildXp })
        .then(null, () => {})
    }

    await supabase.from('guild_dungeon_runs').insert({
      guild_id: guildId,
      user_id: AppState.user.id,
      dungeon_id: dungeon.id,
      party: battle.party.map(p => ({ pet_id: p.id, owner: p.ownerName })),
      enemies_defeated: wavesCleared,
      victory,
      rewards_claimed: true,
      completed_at: new Date().toISOString()
    }).then(null, () => {})

    taskTracker.report('guild_dungeon')
    passService.addXP(15, 'guild_dungeon')

    return { ppReward, xpReward, guildXp, tokens, victory, wavesCleared, totalWaves }
  }

  async loadHistory(limit = 5) {
    if (!guildState.myGuild) return []
    const { data } = await supabase
      .from('guild_dungeon_runs')
      .select('*, guild_dungeons(name, icon)')
      .eq('guild_id', guildState.myGuild.guild_id)
      .order('started_at', { ascending: false })
      .limit(limit)
    return data || []
  }
}

export const guildDungeonService = new GuildDungeonService()

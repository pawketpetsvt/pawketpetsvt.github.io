import { reactive } from 'vue'
import * as badgeHooks from './BadgeHooks.js'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { playerService } from './PlayerService.js'
import { guildPerkService } from './GuildPerkService.js'
import { containsProfanity } from '../utils/profanity.js'
import { canPerformAction } from '../utils/RateLimit.js'
import { taskTracker } from './TaskTrackerService.js'
import {
  GUILD_MAX_MEMBERS, GUILD_CREATE_COST, GUILD_MIN_PET_LEVEL, GUILDS_PER_PAGE,
  CHAT_MAX_LEN, CHAT_LIMIT, DONATE_MIN, PROPOSAL_COSTS, PERK_DEFAULT_PERCENT,
  VOTE_PASS_THRESHOLD
} from '../data/guildData.js'

export const guildState = reactive({
  myGuild: null,      // the guilds row, plus guild_id
  myRole: null,       // 'leader' | 'officer' | 'member'
  liaisonPetId: null,
  loading: true,
  // Browse
  guilds: [],
  invitations: [],
  totalGuilds: 0,
  currentPage: 1,
  // Member view
  members: [],
  liaisons: {},
  joinRequests: []
})

// Thrown for anything the UI should show as a plain message rather than a crash.
class GuildError extends Error {}

class GuildService {
  get isOfficer() { return guildState.myRole === 'leader' || guildState.myRole === 'officer' }
  get isLeader() { return guildState.myRole === 'leader' }

  // Ports guild_checkUserStatus(), game.js:6869 — the single source of truth
  // for "am I in a guild".
  async checkStatus() {
    if (!AppState.user) return false
    try {
      const { data, error } = await supabase
        .from('guild_members')
        .select('guild_id, role, guilds(*)')
        .eq('user_id', AppState.user.id)
        .maybeSingle()

      if (error) {
        console.error('[guild] status check failed:', error)
        guildState.myGuild = null
        guildState.myRole = null
        return false
      }

      if (data && data.guilds) {
        guildState.myGuild = { ...data.guilds, guild_id: data.guild_id }
        guildState.myRole = data.role

        const { data: liaison } = await supabase
          .from('guild_liaisons')
          .select('pet_id')
          .eq('guild_id', data.guild_id)
          .eq('user_id', AppState.user.id)
          .eq('is_active', true)
          .maybeSingle()
        guildState.liaisonPetId = liaison ? liaison.pet_id : null

        guildPerkService.restore(data.guild_id)
        return true
      }

      // A guild_members row whose guild_id points at a deleted guild. Legacy
      // self-heals rather than leaving the player stuck "in" a guild that
      // cannot be opened or left.
      if (data && !data.guilds) {
        await supabase.from('guild_members').delete().eq('user_id', AppState.user.id)
        await supabase.from('guild_liaisons').update({ is_active: false }).eq('user_id', AppState.user.id)
      }

      guildState.myGuild = null
      guildState.myRole = null
      guildState.liaisonPetId = null
      guildPerkService.restore(null)
      return false
    } catch (e) {
      console.error('[guild] status check threw:', e)
      return false
    }
  }

  // ── Browse ────────────────────────────────────────────────────────────────
  async loadBrowser() {
    guildState.loading = true
    try {
      guildState.invitations = await this.loadMyInvitations()

      const { count } = await supabase.from('guilds').select('*', { count: 'exact', head: true })
      guildState.totalGuilds = count || 0

      const offset = (guildState.currentPage - 1) * GUILDS_PER_PAGE
      const { data, error } = await supabase
        .from('guilds')
        .select('*')
        .order('member_count', { ascending: false })
        .range(offset, offset + GUILDS_PER_PAGE - 1)
      if (error) throw error
      guildState.guilds = data || []
    } finally {
      guildState.loading = false
    }
  }

  get totalPages() {
    return Math.max(1, Math.ceil(guildState.totalGuilds / GUILDS_PER_PAGE))
  }

  // Ports guild_loadMyInvitations(), game.js:7492. The inviter's username is
  // fetched in a second query rather than joined — legacy's own note: joining
  // it would mean guessing the FK constraint name, since `guild_invitations`
  // has two columns pointing at `players`.
  async loadMyInvitations() {
    if (!AppState.user) return []
    try {
      const { data, error } = await supabase
        .from('guild_invitations')
        .select('id, guild_id, invited_by, created_at, guilds(name, tag, emblem_emoji)')
        .eq('invited_user_id', AppState.user.id)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
      if (error || !data || !data.length) return []

      const inviterIds = data.map(i => i.invited_by).filter(Boolean)
      const inviterMap = {}
      if (inviterIds.length) {
        const { data: inviters } = await supabase
          .from('players').select('id, username').in('id', inviterIds)
        ;(inviters || []).forEach(p => { inviterMap[p.id] = p.username })
      }
      return data.map(inv => ({ ...inv, inviterUsername: inviterMap[inv.invited_by] || 'Someone' }))
    } catch {
      return []
    }
  }

  // ── Create ────────────────────────────────────────────────────────────────
  // Ports guild_create(), game.js:7045.
  async create({ name, tag, emblem, bio }) {
    name = (name || '').trim()
    tag = (tag || '').trim().toUpperCase()
    emblem = (emblem || '').trim() || '🏛️'
    bio = (bio || '').trim()

    if (name.length < 3 || name.length > 20) throw new GuildError('Guild name must be 3–20 characters')
    if (!/^[A-Z0-9]{3,5}$/.test(tag)) throw new GuildError('Tag must be 3–5 uppercase letters/numbers')
    if (containsProfanity(name) || containsProfanity(tag) || containsProfanity(bio)) {
      throw new GuildError('Please keep the name/tag/bio family-friendly 💖')
    }
    if (!canPerformAction('guild_create', 5000)) throw new GuildError('Slow down a moment!')

    // Re-checked immediately before creating, not just when the form opened.
    if (await this.checkStatus()) {
      throw new GuildError(`You are already in "${guildState.myGuild.name}". Leave it first!`)
    }

    const { data: taken } = await supabase.from('guilds').select('name').eq('name', name).maybeSingle()
    if (taken) throw new GuildError(`Guild name "${name}" is already taken!`)

    const { data: myPets, error: petErr } = await supabase
      .from('user_pets').select('id, level, nickname').eq('user_id', AppState.user.id)
    if (petErr) throw new GuildError('Error checking pets: ' + petErr.message)
    if (!myPets || !myPets.some(p => (p.level || 1) >= GUILD_MIN_PET_LEVEL)) {
      throw new GuildError(`You need a level ${GUILD_MIN_PET_LEVEL}+ pet to create a guild!`)
    }
    if ((AppState.player?.pawketpoints || 0) < GUILD_CREATE_COST) {
      throw new GuildError(`Need ${GUILD_CREATE_COST} PP to create a guild!`)
    }

    await playerService.adjustPoints(-GUILD_CREATE_COST, 'guild_creation')

    const { data: guild, error: gErr } = await supabase.from('guilds').insert({
      name, tag, emblem_emoji: emblem, description: bio,
      owner_id: AppState.user.id,
      guild_level: 1, guild_xp: 0, guild_treasury: 0, member_count: 1
    }).select().single()

    if (gErr) {
      // Refund before surfacing, so a failed create never costs PP.
      await playerService.adjustPoints(GUILD_CREATE_COST, 'guild_creation_refund').catch(() => {})
      throw new GuildError(gErr.code === '23505'
        ? 'Guild name already taken!'
        : 'Failed to create guild: ' + gErr.message)
    }

    const { error: mErr } = await supabase.from('guild_members')
      .insert({ guild_id: guild.id, user_id: AppState.user.id, role: 'leader' })
    if (mErr) {
      // The guild exists but the player is not in it — refunding here would
      // leave an ownerless guild AND the PP back, so legacy tells them to
      // refresh instead. Same choice, made explicit.
      throw new GuildError('Guild created, but adding you as a member failed. Please refresh.')
    }

    const bestPet = [...myPets].sort((a, b) => (b.level || 1) - (a.level || 1))[0]
    if (bestPet) await this._setLiaisonRow(guild.id, bestPet.id).catch(() => {})

    await this.checkStatus()
    return guild
  }

  // ── Join ──────────────────────────────────────────────────────────────────
  async join(guildId) {
    if (!canPerformAction('guild_join', 3000)) throw new GuildError('Slow down a moment!')
    if (await this.checkStatus()) throw new GuildError('You are already in a guild!')

    const { data: guild } = await supabase
      .from('guilds').select('member_count').eq('id', guildId).maybeSingle()
    if (guild && (guild.member_count || 0) >= GUILD_MAX_MEMBERS) {
      throw new GuildError('This guild is full!')
    }

    const { error } = await supabase.from('guild_members')
      .insert({ guild_id: guildId, user_id: AppState.user.id, role: 'member' })
    if (error) throw new GuildError('Could not join: ' + error.message)

    // Legacy wrote `member_count + 1` from a value it had just read, which two
    // simultaneous joins would clobber. Recomputing from the real row count
    // costs one extra call and cannot drift — and legacy already has this
    // function, precisely because the count DOES drift.
    await this.syncMemberCount(guildId)
    await this._autoAssignLiaison(guildId)
    await this.checkStatus()
  }

  async requestJoin(guildId) {
    if (!canPerformAction('guild_request', 3000)) throw new GuildError('Slow down a moment!')
    if (await this.checkStatus()) throw new GuildError('You are already in a guild!')

    const { error } = await supabase.from('guild_join_requests')
      .insert({ guild_id: guildId, user_id: AppState.user.id, status: 'pending' })
    if (error) {
      throw new GuildError(error.code === '23505'
        ? 'You already have a pending request for this guild.'
        : 'Failed to send request: ' + error.message)
    }
  }

  // ── Member view ───────────────────────────────────────────────────────────
  async loadMemberView() {
    const g = guildState.myGuild
    if (!g) return
    guildState.loading = true
    try {
      const { data: members } = await supabase
        .from('guild_members')
        .select('user_id, role, total_contributions, players(username)')
        .eq('guild_id', g.guild_id)
        .order('role', { ascending: true })
      guildState.members = members || []

      const { data: liaisons } = await supabase
        .from('guild_liaisons')
        .select('user_id, pet_id, user_pets(nickname, level, current_variant, pets(name, image_file))')
        .eq('guild_id', g.guild_id)
        .eq('is_active', true)

      const map = {}
      ;(liaisons || []).forEach(l => { map[l.user_id] = l })
      guildState.liaisons = map
      guildState.liaisonPetId = map[AppState.user.id] ? map[AppState.user.id].pet_id : null

      if (this.isOfficer) {
        const { data: reqs } = await supabase
          .from('guild_join_requests')
          .select('id, user_id, players(username), created_at')
          .eq('guild_id', g.guild_id)
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
        guildState.joinRequests = reqs || []
      } else {
        guildState.joinRequests = []
      }
    } finally {
      guildState.loading = false
    }
  }

  // ── Liaison ("guild pet") ─────────────────────────────────────────────────
  _setLiaisonRow(guildId, petId) {
    return supabase.from('guild_liaisons').upsert(
      { guild_id: guildId, user_id: AppState.user.id, pet_id: petId, is_active: true },
      { onConflict: 'guild_id,user_id' }
    )
  }

  async _autoAssignLiaison(guildId) {
    const { data: pets } = await supabase
      .from('user_pets').select('id, level').eq('user_id', AppState.user.id)
    const best = (pets || [])
      .filter(p => (p.level || 1) >= GUILD_MIN_PET_LEVEL)
      .sort((a, b) => (b.level || 1) - (a.level || 1))[0]
    if (best) await this._setLiaisonRow(guildId, best.id).catch(() => {})
  }

  async setLiaison(pet) {
    if (!guildState.myGuild) return
    if (!pet || (pet.level || 1) < GUILD_MIN_PET_LEVEL) {
      throw new GuildError(`Pet must be level ${GUILD_MIN_PET_LEVEL}+!`)
    }
    const { error } = await this._setLiaisonRow(guildState.myGuild.guild_id, pet.id)
    if (error) throw new GuildError('Failed to set guild pet: ' + error.message)
    guildState.liaisonPetId = pet.id
    await this.loadMemberView()
  }

  // ── Leader / officer actions ──────────────────────────────────────────────
  async saveBio(bio) {
    if (!guildState.myGuild) return
    bio = (bio || '').trim()
    if (containsProfanity(bio)) throw new GuildError('Please keep bio family-friendly 💖')
    await supabase.from('guilds').update({ description: bio }).eq('id', guildState.myGuild.guild_id)
    guildState.myGuild.description = bio
  }

  async kickMember(guildId, userId) {
    await supabase.from('guild_members').delete().eq('guild_id', guildId).eq('user_id', userId)
    await supabase.from('guild_liaisons').update({ is_active: false })
      .eq('guild_id', guildId).eq('user_id', userId)
    await this.syncMemberCount(guildId)
    await this.loadMemberView()
  }

  async setMemberRole(guildId, userId, newRole) {
    if (!this.isLeader) throw new GuildError('Only the guild leader can promote or demote members.')
    const { error } = await supabase.from('guild_members')
      .update({ role: newRole }).eq('guild_id', guildId).eq('user_id', userId)
    if (error) throw new GuildError('Error updating role: ' + error.message)
    await this.loadMemberView()
  }

  // Ports guild_syncMemberCount(), game.js:7405 — RPC first, direct count as
  // fallback, exactly as legacy does.
  async syncMemberCount(guildId) {
    try {
      const { data: count, error } = await supabase.rpc('get_guild_member_count', { p_guild_id: guildId })
      if (error) throw error
      await supabase.from('guilds').update({ member_count: count || 0 }).eq('id', guildId)
    } catch {
      const { count } = await supabase.from('guild_members')
        .select('*', { count: 'exact', head: true }).eq('guild_id', guildId)
      await supabase.from('guilds').update({ member_count: count || 0 }).eq('id', guildId)
    }
  }

  async acceptRequest(requestId, guildId, userId) {
    const { data: guild } = await supabase
      .from('guilds').select('member_count').eq('id', guildId).maybeSingle()
    if (guild && (guild.member_count || 0) >= GUILD_MAX_MEMBERS) throw new GuildError('Guild is full!')

    await supabase.from('guild_join_requests').update({ status: 'accepted' }).eq('id', requestId)
    await supabase.from('guild_members').insert({ guild_id: guildId, user_id: userId, role: 'member' })
    await this.syncMemberCount(guildId)
    await this.loadMemberView()
  }

  async declineRequest(requestId) {
    await supabase.from('guild_join_requests').update({ status: 'declined' }).eq('id', requestId)
    await this.loadMemberView()
  }

  // ── Invitations ───────────────────────────────────────────────────────────
  async sendInvite(username) {
    username = (username || '').trim()
    if (!username) throw new GuildError('Enter a username')
    if (!guildState.myGuild) return

    const { data: player, error: pErr } = await supabase
      .from('players').select('id, username').ilike('username', username).maybeSingle()
    if (pErr) throw new GuildError(pErr.message)
    if (!player) throw new GuildError('No player found with that username.')
    if (player.id === AppState.user.id) throw new GuildError("You can't invite yourself!")

    const { data: existing } = await supabase
      .from('guild_members').select('guild_id').eq('user_id', player.id).maybeSingle()
    if (existing) throw new GuildError(player.username + ' is already in a guild.')

    const { error } = await supabase.from('guild_invitations').insert({
      guild_id: guildState.myGuild.guild_id,
      invited_user_id: player.id,
      invited_by: AppState.user.id,
      status: 'pending'
    })
    if (error) {
      throw new GuildError(error.code === '23505'
        ? player.username + ' already has a pending invite.'
        : 'Failed to send invite: ' + error.message)
    }
    return player.username
  }

  async acceptInvite(inviteId, guildId) {
    const { data: guild } = await supabase
      .from('guilds').select('member_count').eq('id', guildId).maybeSingle()
    if (guild && (guild.member_count || 0) >= GUILD_MAX_MEMBERS) {
      throw new GuildError('That guild is now full!')
    }

    const { error } = await supabase.from('guild_members')
      .insert({ guild_id: guildId, user_id: AppState.user.id, role: 'member' })
    if (error) throw new GuildError('Failed to accept: ' + error.message)

    await this.syncMemberCount(guildId)
    await supabase.from('guild_invitations').update({ status: 'accepted' }).eq('id', inviteId)
    await this._autoAssignLiaison(guildId)
    await this.checkStatus()
  }

  async declineInvite(inviteId) {
    await supabase.from('guild_invitations').update({ status: 'declined' }).eq('id', inviteId)
    guildState.invitations = guildState.invitations.filter(i => i.id !== inviteId)
  }

  // ── Leaving / disbanding ──────────────────────────────────────────────────
  // Ports guild_leaveConfirmed(), game.js:8114. A leader cannot leave — the
  // page offers disband instead, which is where that branch lives now.
  async leave() {
    if (!guildState.myGuild) return
    const guildId = guildState.myGuild.guild_id
    guildPerkService.clear(guildId)
    await supabase.from('guild_members').delete()
      .eq('guild_id', guildId).eq('user_id', AppState.user.id)
    await supabase.from('guild_liaisons').update({ is_active: false })
      .eq('guild_id', guildId).eq('user_id', AppState.user.id)
    await this.syncMemberCount(guildId)
    guildState.myGuild = null
    guildState.myRole = null
    guildState.liaisonPetId = null
  }

  // ── Chat ──────────────────────────────────────────────────────────────────
  // Ports guild_loadChatMessages()/guild_postChatMessage(), game.js:7675-7752.
  // Author names are resolved in a second query rather than joined, for the same
  // reason as invitations: `guild_chat_messages` has no unambiguous FK name.
  async loadChat(limit = CHAT_LIMIT) {
    const g = guildState.myGuild
    if (!g) return []
    const { data: messages, error } = await supabase
      .from('guild_chat_messages')
      .select('id, author_id, message, created_at')
      .eq('guild_id', g.guild_id)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw new GuildError('Could not load messages: ' + error.message)
    if (!messages || !messages.length) return []

    const authorIds = [...new Set(messages.map(m => m.author_id).filter(Boolean))]
    const authorMap = {}
    if (authorIds.length) {
      const { data: authors } = await supabase
        .from('players').select('id, username').in('id', authorIds)
      ;(authors || []).forEach(p => { authorMap[p.id] = p.username })
    }

    return messages.map(m => ({
      id: m.id,
      message: m.message,
      createdAt: m.created_at,
      author: authorMap[m.author_id] || 'Unknown',
      isMe: m.author_id === AppState.user.id
    }))
  }

  async postChat(message) {
    if (!guildState.myGuild) return
    if (!canPerformAction('guild_chat_post', 2000)) {
      throw new GuildError('Please wait before posting again!')
    }
    message = (message || '').trim()
    if (!message) throw new GuildError('Please enter a message')
    if (message.length > CHAT_MAX_LEN) {
      throw new GuildError(`Message is too long (max ${CHAT_MAX_LEN} characters)`)
    }
    if (containsProfanity(message)) {
      throw new GuildError('Please keep guild chat family-friendly 💖')
    }

    const { error } = await supabase.from('guild_chat_messages').insert({
      guild_id: guildState.myGuild.guild_id,
      author_id: AppState.user.id,
      message
    })
    if (error) throw new GuildError('Could not send message: ' + error.message)
  }

  // ── Treasury ──────────────────────────────────────────────────────────────
  async loadTreasury() {
    const g = guildState.myGuild
    if (!g) return null
    const guildId = g.guild_id

    // Close out anything whose timer ran down before rendering, so the view
    // never shows a proposal that should already have resolved.
    await this.resolveExpiredVotes()

    const [{ data: guildRow }, { data: votes }, { data: logs }] = await Promise.all([
      supabase.from('guilds').select('guild_treasury').eq('id', guildId).maybeSingle(),
      supabase.from('guild_treasury_votes').select('*')
        .eq('guild_id', guildId).eq('status', 'active')
        .order('created_at', { ascending: false }),
      supabase.from('guild_treasury_logs').select('*, players(username)')
        .eq('guild_id', guildId).order('created_at', { ascending: false }).limit(10)
    ])

    const treasury = (guildRow && guildRow.guild_treasury) || 0
    if (guildState.myGuild) guildState.myGuild.guild_treasury = treasury

    return {
      treasury,
      votes: votes || [],
      logs: logs || [],
      myVotes: await this.loadMyVotes((votes || []).map(v => v.id))
    }
  }

  // Which of these proposals this player has already voted on.
  //
  // Legacy tracked this ENTIRELY in localStorage (`guild_voted_<id>_<user>`),
  // which means clearing site data lets one player vote as many times as they
  // like — and three "yes" votes pass a proposal that spends 1,000-2,000 PP of
  // the guild's treasury. `guild_vote_records` closes that; the localStorage key
  // is still written and read as a fallback so the UI behaves before the table
  // exists.
  async loadMyVotes(voteIds) {
    const voted = new Set()
    if (!voteIds.length) return voted

    const { data, error } = await supabase
      .from('guild_vote_records')
      .select('vote_id')
      .eq('user_id', AppState.user.id)
      .in('vote_id', voteIds)

    if (!error && data) {
      data.forEach(r => voted.add(r.vote_id))
      return voted
    }

    voteIds.forEach(id => {
      try {
        if (localStorage.getItem('guild_voted_' + id + '_' + AppState.user.id)) voted.add(id)
      } catch { /* private mode */ }
    })
    return voted
  }

  async donate(amount) {
    amount = parseInt(amount, 10)
    if (!amount || amount < DONATE_MIN) throw new GuildError(`Minimum donation is ${DONATE_MIN} PP`)
    if ((AppState.player?.pawketpoints || 0) < amount) throw new GuildError('Not enough PP!')
    if (!guildState.myGuild) return
    const guildId = guildState.myGuild.guild_id

    const spent = await playerService.spendPoints(amount, 'guild_donation')
    if (spent === null) throw new GuildError('Not enough PP or error deducting. Please try again.')

    const { error: rpcErr } = await supabase.rpc('add_to_guild_treasury', {
      p_guild_id: guildId,
      p_user_id: AppState.user.id,
      p_amount: amount,
      p_action: 'donate',
      p_description: 'Player donated ' + amount + ' PP'
    })
    if (rpcErr) {
      // The PP is already gone and direct writes to guild_treasury are blocked,
      // so refund rather than leaving it in limbo — legacy's own handling.
      await playerService.awardPoints(amount, 'guild_donation_refund').catch(() => {})
      throw new GuildError('Could not add to treasury. Your PP has been refunded.')
    }

    const { data: m } = await supabase.from('guild_members')
      .select('total_contributions').eq('guild_id', guildId)
      .eq('user_id', AppState.user.id).maybeSingle()
    await supabase.from('guild_members')
      .update({ total_contributions: ((m && m.total_contributions) || 0) + amount })
      .eq('guild_id', guildId).eq('user_id', AppState.user.id)

    taskTracker.report('donate_guild')
    badgeHooks.onGuildDonation()
    return amount
  }

  async createProposal({ title, description, effect, durationHours }) {
    title = (title || '').trim()
    description = (description || '').trim()
    if (!title) throw new GuildError('Please enter a proposal title')
    if (!guildState.myGuild) return
    if (containsProfanity(title) || containsProfanity(description)) {
      throw new GuildError('Please keep proposals family-friendly 💖')
    }

    const duration = Math.min(72, Math.max(1, parseInt(durationHours, 10) || 24))
    const cost = PROPOSAL_COSTS[effect] || 1000

    const { error } = await supabase.from('guild_treasury_votes').insert({
      guild_id: guildState.myGuild.guild_id,
      proposal: title,
      description,
      cost,
      effect_type: effect,
      effect_value: { percent: PERK_DEFAULT_PERCENT[effect] },
      duration_hours: duration,
      created_by: AppState.user.id,
      ends_at: new Date(Date.now() + duration * 3600000).toISOString()
    })
    if (error) throw new GuildError('Failed: ' + error.message)
  }

  async castVote(voteId, inFavor) {
    if (!canPerformAction('guild_vote', 2000)) throw new GuildError('Slow down a moment!')

    const { data: vote, error: fetchErr } = await supabase
      .from('guild_treasury_votes').select('*').eq('id', voteId).maybeSingle()
    if (fetchErr) throw new GuildError(fetchErr.message)
    if (!vote || vote.status !== 'active') throw new GuildError('This proposal is no longer active.')

    // One row per (vote, user), enforced by a unique constraint — this is the
    // real double-vote guard. A duplicate-key error means they already voted.
    const rec = await supabase.from('guild_vote_records')
      .insert({ vote_id: voteId, user_id: AppState.user.id, in_favor: inFavor })
    if (rec.error) {
      if (rec.error.code === '23505') throw new GuildError('You have already voted on this proposal.')
      // Table absent — fall back to legacy's localStorage guard rather than
      // blocking voting entirely.
      const key = 'guild_voted_' + voteId + '_' + AppState.user.id
      try {
        if (localStorage.getItem(key)) throw new GuildError('You have already voted on this proposal.')
      } catch (e) {
        if (e instanceof GuildError) throw e
      }
    }

    const field = inFavor ? 'votes_for' : 'votes_against'
    const { error: rpcErr } = await supabase.rpc('increment_guild_vote', {
      p_vote_id: voteId, p_field: field
    })
    if (rpcErr) {
      const { error: fallbackErr } = await supabase
        .from('guild_treasury_votes')
        .update({ [field]: (vote[field] || 0) + 1 })
        .eq('id', voteId)
      if (fallbackErr) throw new GuildError('Vote failed: ' + fallbackErr.message)
    }

    try { localStorage.setItem('guild_voted_' + voteId + '_' + AppState.user.id, '1') } catch { /* private mode */ }
    taskTracker.report('vote_in_guild')

    // Re-read rather than reasoning from the row fetched before the increment —
    // legacy computed the new tally from its own stale copy, which mis-decides
    // whenever anyone else voted in between.
    const { data: fresh } = await supabase
      .from('guild_treasury_votes').select('*').eq('id', voteId).maybeSingle()
    if (fresh && fresh.status === 'active' &&
        (fresh.votes_for || 0) >= VOTE_PASS_THRESHOLD &&
        (fresh.votes_for || 0) > (fresh.votes_against || 0)) {
      await this.processPassedVote(fresh)
    }
    return inFavor
  }

  // Ports guild_processPassedVote(), game.js:8055. The treasury deduction has
  // to succeed FIRST — if it doesn't, the vote stays active rather than granting
  // a perk nobody paid for.
  async processPassedVote(vote) {
    const { error } = await supabase.rpc('remove_from_guild_treasury', {
      p_guild_id: vote.guild_id,
      p_amount: vote.cost,
      p_action: 'proposal_passed',
      p_description: vote.proposal + ' (proposal passed)'
    })
    if (error) {
      console.warn('[guild] treasury deduction failed; vote left active:', error.message)
      return null
    }

    await supabase.from('guild_treasury_votes').update({ status: 'passed' }).eq('id', vote.id)
    if (vote.effect_type && vote.effect_value) {
      guildPerkService.apply(vote.guild_id, vote.effect_type, vote.effect_value, vote.duration_hours || 24)
      return vote.effect_type
    }
    return null
  }

  // The vote closer, ported from loadActiveGuildPerks()'s second half
  // (game.js:7610-7639): anything past its deadline passes or fails on the
  // final tally.
  async resolveExpiredVotes() {
    const g = guildState.myGuild
    if (!g) return
    const { data: expired } = await supabase
      .from('guild_treasury_votes').select('*')
      .eq('guild_id', g.guild_id).eq('status', 'active')
      .lt('ends_at', new Date().toISOString())

    for (const v of expired || []) {
      if ((v.votes_for || 0) > (v.votes_against || 0) && (v.votes_for || 0) >= 1) {
        await this.processPassedVote(v)
      } else {
        await supabase.from('guild_treasury_votes').update({ status: 'failed' }).eq('id', v.id)
      }
    }
  }

  async disband() {
    if (!guildState.myGuild || !this.isLeader) return
    const guildId = guildState.myGuild.guild_id
    const name = guildState.myGuild.name || 'this guild'
    // Order matters: liaisons, then members, then the guild itself, so no FK
    // reference outlives its target.
    await supabase.from('guild_liaisons').update({ is_active: false }).eq('guild_id', guildId)
    await supabase.from('guild_members').delete().eq('guild_id', guildId)
    await supabase.from('guilds').delete().eq('id', guildId)
    guildPerkService.clear(guildId)
    guildState.myGuild = null
    guildState.myRole = null
    guildState.liaisonPetId = null
    return name
  }
}

export const guildService = new GuildService()
export { GuildError }

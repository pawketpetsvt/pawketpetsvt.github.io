import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { adminService } from './AdminService.js'
import { notificationService } from './NotificationService.js'
import { grandPrixService } from './GrandPrixService.js'
import { GP_VARIANT_BONUS, TRAINING_CAP } from '../data/grandPrixData.js'

// Ports the gp_admin* family (game.js:20529-20949) plus simulateGrandPrix
// (game.js:9750) — deliberately held back from Phase 8c because the player-side
// and admin halves of the gp_* block are interleaved, so they migrate together.

// The replay flavour text written for the top 10 finishers.
const REPLAY_TEMPLATES = {
  first: [
    '🏁 {name} launches out of the gate! The crowd erupts as they take an early lead. No one can catch them, {name} crosses the finish line FIRST! 🏆',
    '{name} races with pure determination, pulling ahead at every turn. An unforgettable champion performance! 👑'
  ],
  top3: [
    '{name} battles fiercely for position and earns a well-deserved podium finish! 🥉',
    'What heart from {name}! A strong push on the final lap secures a podium spot! 🌟'
  ],
  top10: [
    '{name} holds their own against fierce competition. A solid top 10 finish! 💪',
    '{name} pushes hard every lap and earns a spot in the top 10! 🎉'
  ]
}

// The scoring formula, shared by the simulation and the recalculate action so
// the two can't drift — legacy had two near-identical copies of it.
export function scoreEntry(entry) {
  const pet = entry.user_pets || {}
  const spd = Math.min(50, (pet.base_speed || 4) * 5)
  const lvl = Math.min(100, (pet.level || 1) * 2)
  const hap = ((pet.happiness || 50) / (pet.max_happiness || 100)) * 20
  const vrnt = GP_VARIANT_BONUS[pet.current_variant || ''] || 0
  const trn = Math.min(TRAINING_CAP, entry.training_bonus || 0)
  const rnd = Math.random() * 15
  return Math.min(200, spd + lvl + hap + vrnt + trn + rnd)
}

function isoWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7)
}

class GrandPrixAdminService {
  _guard() {
    if (!adminService.isAdmin()) throw new Error('Admin access required')
  }

  // Every action needs the current event id. Legacy repeated this lookup (with
  // its fallback) in each function; one place here.
  async currentEventId({ allowIncomplete = false } = {}) {
    try {
      const { data } = await supabase.rpc('get_current_grand_prix')
      if (data && data.length) return data[0].id
    } catch { /* fall through */ }
    if (!allowIncomplete) return null
    const { data } = await supabase.from('grand_prix_events')
      .select('id').neq('status', 'complete')
      .order('week_number', { ascending: false }).limit(1).maybeSingle()
    return data ? data.id : null
  }

  async currentEvent() {
    try {
      const { data } = await supabase.rpc('get_current_grand_prix')
      if (data && data.length) return data[0]
    } catch { /* fall through */ }
    return null
  }

  async listEntries(eventId) {
    const { data } = await supabase
      .from('grand_prix_entries')
      .select('id, user_id, pet_id, training_bonus, race_score, final_rank, players(username), user_pets(nickname, level, base_speed, happiness, max_happiness, current_variant)')
      .eq('event_id', eventId)
      .order('final_rank', { ascending: true })
    return data || []
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  async recalcScores() {
    this._guard()
    const evId = await this.currentEventId()
    if (!evId) throw new Error('No active event')

    const entries = await this.listEntries(evId)
    if (!entries.length) throw new Error('No entries')

    await Promise.all(entries.map(e =>
      supabase.from('grand_prix_entries').update({ race_score: scoreEntry(e) }).eq('id', e.id)
    ))
    await adminService.log('gp_recalc_scores', { event_id: evId, updated: entries.length })
    return entries.length
  }

  // Ranks by current score, sharing a rank across ties.
  async fixRankings() {
    this._guard()
    const evId = await this.currentEventId()
    if (!evId) throw new Error('No active event')

    const { data: entries } = await supabase
      .from('grand_prix_entries').select('id, race_score')
      .eq('event_id', evId).order('race_score', { ascending: false })
    if (!entries || !entries.length) throw new Error('No entries')

    let prevScore = null
    let counter = 0
    let rank = 1
    const updates = []
    for (const e of entries) {
      counter++
      if (e.race_score !== prevScore) rank = counter
      updates.push(supabase.from('grand_prix_entries').update({ final_rank: rank }).eq('id', e.id))
      prevScore = e.race_score
    }
    await Promise.all(updates)
    await adminService.log('gp_fix_rankings', { event_id: evId, count: entries.length })
    return entries.length
  }

  // Ports gp_adminSetWinner(). Legacy shifted "everyone at rank <= 1" down by
  // one, which only ever moves the single existing rank-1 entry — that is the
  // intent (make room at the top), so it is kept.
  async setWinner(entryId, username) {
    this._guard()
    const evId = await this.currentEventId()
    if (!evId) throw new Error('No active event')

    const { data: all } = await supabase
      .from('grand_prix_entries').select('id, final_rank')
      .eq('event_id', evId).order('final_rank', { ascending: true })

    for (const e of all || []) {
      if (e.id !== entryId && (e.final_rank || 99) <= 1) {
        await supabase.from('grand_prix_entries')
          .update({ final_rank: (e.final_rank || 1) + 1 }).eq('id', e.id)
      }
    }
    await supabase.from('grand_prix_entries')
      .update({ final_rank: 1, race_score: 200 }).eq('id', entryId)
    await adminService.log('gp_set_winner', { entryId, username })
  }

  async forceStatus(status) {
    this._guard()
    const evId = await this.currentEventId({ allowIncomplete: true })
    if (!evId) throw new Error('No event found to update')
    const { error } = await supabase.from('grand_prix_events')
      .update({ status }).eq('id', evId)
    if (error) throw new Error(error.message)
    await adminService.log('gp_force_status_' + status, { event_id: evId })
  }

  async adjustPrize(delta) {
    this._guard()
    const ev = await this.currentEvent()
    if (!ev) throw new Error('No active event')
    const newPool = Math.max(0, (ev.prize_pool || 0) + delta)
    await supabase.from('grand_prix_events').update({ prize_pool: newPool }).eq('id', ev.id)
    await adminService.log('gp_adjust_prize', { delta, new_pool: newPool })
    return newPool
  }

  async setPrize(amount) {
    this._guard()
    amount = parseInt(amount, 10)
    if (isNaN(amount) || amount < 0) throw new Error('Enter a valid amount')
    const evId = await this.currentEventId()
    if (!evId) throw new Error('No active event')
    await supabase.from('grand_prix_events').update({ prize_pool: amount }).eq('id', evId)
    await adminService.log('gp_set_prize', { amount })
    return amount
  }

  async editTraining(entryId, value) {
    this._guard()
    const val = Math.min(TRAINING_CAP, Math.max(0, parseInt(value, 10) || 0))
    await supabase.from('grand_prix_entries').update({ training_bonus: val }).eq('id', entryId)
    await adminService.log('gp_edit_training', { entryId, val })
    return val
  }

  async removeEntry(entryId, username) {
    this._guard()
    await supabase.from('grand_prix_entries').delete().eq('id', entryId)
    await adminService.log('gp_remove_entry', { entryId, username })
  }

  async sendNotification(target, message) {
    this._guard()
    message = (message || '').trim()
    if (!message) throw new Error('Enter a message')
    const evId = await this.currentEventId()
    if (!evId) throw new Error('No active event')

    let q = supabase.from('grand_prix_entries').select('user_id, final_rank').eq('event_id', evId)
    if (target === 'top10') q = q.lte('final_rank', 10)
    const { data: targets } = await q

    let sent = 0
    for (const t of targets || []) {
      await notificationService.create(
        t.user_id, 'grand_prix_results', '🏁 Grand Prix Admin Message', message, 'tab:racing'
      ).catch(() => {})
      sent++
    }
    await adminService.log('gp_send_notif', { target, message, sent })
    return sent
  }

  async createEvent() {
    this._guard()
    const now = new Date()
    const saturday = new Date(now)
    saturday.setUTCDate(saturday.getUTCDate() + ((6 - saturday.getUTCDay() + 7) % 7))
    saturday.setUTCHours(0, 0, 0, 0)
    const monday = new Date(saturday)
    monday.setUTCDate(monday.getUTCDate() + 2)

    const { error } = await supabase.from('grand_prix_events').insert({
      week_number: isoWeek(now),
      year: now.getFullYear(),
      start_time: saturday.toISOString(),
      end_time: monday.toISOString(),
      registration_close: saturday.toISOString(),
      status: 'registration',
      prize_pool: 0
    })
    if (error) throw new Error(error.message)
    await adminService.log('gp_create_event', { week: isoWeek(now) })
  }

  // Ports simulateGrandPrix() — scores every entry, ranks them, writes replay
  // text for the top 10, moves the event to reward_claim and notifies everyone.
  async simulate() {
    this._guard()
    const evId = await this.currentEventId()
    if (!evId) throw new Error('No active event')
    await adminService.log('gp_force_simulate', { event_id: evId })

    const entries = await this.listEntries(evId)
    if (!entries.length) throw new Error('No entries to simulate')

    entries.forEach(e => { e._score = scoreEntry(e) })
    entries.sort((a, b) => b._score - a._score)
    entries.forEach((e, i) => { e._rank = i + 1 })

    await Promise.all(entries.map(e =>
      supabase.from('grand_prix_entries')
        .update({ race_score: e._score, final_rank: e._rank }).eq('id', e.id)
    ))

    for (const e of entries.slice(0, 10)) {
      const petName = (e.user_pets && e.user_pets.nickname) || 'Your pet'
      const pool = e._rank === 1 ? REPLAY_TEMPLATES.first
        : e._rank <= 3 ? REPLAY_TEMPLATES.top3
        : REPLAY_TEMPLATES.top10
      const text = pool[Math.floor(Math.random() * pool.length)].replace(/\{name\}/g, petName)
      const finishMs = Math.floor((80 + (e._rank - 1) * 0.3 + Math.random() * 2) * 1000)
      await supabase.from('grand_prix_replays').upsert({
        event_id: evId, user_id: e.user_id,
        replay_text: text, finish_time_ms: finishMs, rank: e._rank
      }, { onConflict: 'event_id,user_id' }).then(null, () => {})
    }

    await supabase.from('grand_prix_events')
      .update({ status: 'reward_claim' }).eq('id', evId)

    entries.forEach(e => {
      const petName = (e.user_pets && e.user_pets.nickname) || 'Your pet'
      notificationService.create(
        e.user_id, 'grand_prix_results', '🏁 Grand Prix Results Ready!',
        `${petName} placed #${e._rank}! Claim your rewards now!`, 'tab:racing'
      ).catch(() => {})
    })

    // Refresh the player-side view if it is loaded, so the admin sees the
    // result immediately rather than on next navigation.
    grandPrixService.load().catch(() => {})
    return entries.length
  }

  logs() {
    return adminService.recentLogs('gp_', 30)
  }
}

export const grandPrixAdminService = new GrandPrixAdminService()

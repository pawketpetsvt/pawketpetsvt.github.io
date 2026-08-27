import { ref } from 'vue'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'

// Ports isAdmin() (game.js:20952) plus the poll-management and player-report
// admin surfaces (game.js:20958-21290).
//
// ON THE GATE: legacy checks a hardcoded UUID list in the CLIENT. That is a UI
// gate, not a security boundary — anyone can call these tables directly, so the
// real enforcement has to be the RLS policies on `polls`, `poll_votes`,
// `player_reports` and `admin_logs`. Ported as-is rather than redesigned: moving
// the admin list server-side is a schema/policy change, and getting it wrong
// would lock the owner out of their own tools. Flagged, not silently "fixed".
const ADMIN_IDS = ['c8310873-c1f9-4d6e-a71a-1dad03974f5b']

export const isAdminRef = ref(false)

export const POLL_TYPES = [
  { value: 'community', label: 'Community Decision' },
  { value: 'event', label: 'Event Selection' },
  { value: 'feature', label: 'Feature Request' },
  { value: 'weather', label: 'Weather Vote' }
]

export const POLL_DURATIONS = [
  { value: 1, label: '1 day' },
  { value: 3, label: '3 days' },
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' }
]

export const MAX_POLL_OPTIONS = 5

export const REPORT_TYPE_LABELS = {
  bug: '🐛 Bug', bad_username: '🚫 Username', bad_language: '🤬 Language',
  cheating: '⚖️ Cheating', guestbook: '📖 Guestbook', other: '❓ Other'
}

export const REPORT_STATUS_COLORS = {
  open: '#ff6b6b', reviewing: '#fbbf24',
  resolved: '#5dde7a', dismissed: 'var(--text-light)'
}

class AdminService {
  isAdmin() {
    return !!AppState.user && ADMIN_IDS.includes(AppState.user.id)
  }

  // Called once the session is known, so the Settings page can reveal its
  // admin block — legacy did the same from showApp().
  refresh() {
    isAdminRef.value = this.isAdmin()
    return isAdminRef.value
  }

  // Every admin action writes an audit row. Never allowed to throw: losing the
  // log entry must not undo the action that already happened.
  async log(action, details = {}) {
    if (!AppState.user) return
    try {
      await supabase.from('admin_logs').insert({
        admin_id: AppState.user.id, action, details
      })
    } catch (e) {
      console.warn('[admin] could not write log for ' + action, e)
    }
  }

  async recentLogs(prefix = null, limit = 30) {
    let q = supabase.from('admin_logs')
      .select('action, details, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (prefix) q = q.like('action', prefix + '%')
    const { data } = await q
    return data || []
  }

  // ── Polls ─────────────────────────────────────────────────────────────────
  async listPolls() {
    const { data } = await supabase
      .from('polls').select('*').order('starts_at', { ascending: false })
    return data || []
  }

  async createPoll({ question, pollType, durationDays, options }) {
    question = (question || '').trim()
    if (!question) throw new Error('Enter a question')
    const clean = (options || [])
      .map(o => ({
        icon: (o.icon || '').trim() || '📌',
        text: (o.text || '').trim(),
        description: (o.description || '').trim()
      }))
      .filter(o => o.text)
    if (clean.length < 2) throw new Error('At least 2 options required')

    const { error } = await supabase.from('polls').insert({
      poll_type: pollType,
      question,
      options: clean,
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + durationDays * 86400000).toISOString()
    })
    if (error) throw new Error(error.message)
    await this.log('poll_create', { question, options: clean.length })
  }

  async pollResults(pollId) {
    const [{ data: poll }, { data: votes }] = await Promise.all([
      supabase.from('polls').select('*').eq('id', pollId).maybeSingle(),
      supabase.from('poll_votes').select('option_index').eq('poll_id', pollId)
    ])
    const total = (votes || []).length
    const counts = {}
    ;(votes || []).forEach(v => { counts[v.option_index] = (counts[v.option_index] || 0) + 1 })

    return {
      poll,
      total,
      rows: ((poll && poll.options) || []).map((opt, i) => {
        const count = counts[i] || 0
        return { ...opt, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }
      })
    }
  }

  async endPoll(pollId) {
    const { error } = await supabase.from('polls')
      .update({ is_active: false, ends_at: new Date().toISOString() })
      .eq('id', pollId)
    if (error) throw new Error(error.message)
    await this.log('poll_end', { pollId })
  }

  async deletePoll(pollId) {
    // Votes first: they reference the poll.
    await supabase.from('poll_votes').delete().eq('poll_id', pollId)
    const { error } = await supabase.from('polls').delete().eq('id', pollId)
    if (error) throw new Error(error.message)
    await this.log('poll_delete', { pollId })
  }

  // ── Player reports ────────────────────────────────────────────────────────
  async listReports(limit = 100) {
    const { data, error } = await supabase
      .from('player_reports')
      .select('id, reporter_id, report_type, target_text, description, status, created_at, players(username)')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw new Error('Could not load reports: ' + error.message)
    return data || []
  }

  async setReportStatus(reportId, status) {
    const { error } = await supabase
      .from('player_reports').update({ status }).eq('id', reportId)
    if (error) throw new Error(error.message)
    await this.log('report_' + status, { reportId })
  }
}

export const adminService = new AdminService()

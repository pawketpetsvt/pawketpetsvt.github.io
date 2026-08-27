import { reactive } from 'vue'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { toastService } from './ToastService.js'
import { taskTracker } from './TaskTrackerService.js'
import { canPerformAction } from '../utils/RateLimit.js'

// Ports pollSystem (game.js:39849+) — community polls, shown two at a time on
// the Home page. Voting pays 25 PP, once per poll.
export const pollState = reactive({
  polls: [],
  votes: {},      // pollId -> optionIndex (-1 means "voted, choice unknown")
  loaded: false
})

const VOTE_PP = 25

class PollService {
  async load() {
    if (!AppState.user) return
    try {
      const { data: polls } = await supabase
        .from('polls')
        .select('*')
        .eq('is_active', true)
        .gte('ends_at', new Date().toISOString())
        .order('ends_at', { ascending: true })

      pollState.polls = polls || []

      if (pollState.polls.length) {
        const ids = pollState.polls.map(p => p.id)
        const { data: votes } = await supabase
          .from('poll_votes')
          .select('poll_id, option_index')
          .eq('user_id', AppState.user.id)
          .in('poll_id', ids)
        const map = {}
        for (const v of votes || []) map[v.poll_id] = v.option_index
        pollState.votes = map
      }
    } catch (e) {
      console.error('[pollService.load]', e)
    } finally {
      pollState.loaded = true
    }
  }

  hasVoted(pollId) {
    return pollState.votes[pollId] !== undefined
  }

  // Percentage for one option. `total_votes` is the poll's own running counter.
  percent(poll, index) {
    const total = poll.total_votes || 0
    if (!total) return 0
    const counts = poll.option_counts || []
    return Math.round(((counts[index] || 0) / total) * 100)
  }

  // Ports pollSystem.vote(). The guard chain is legacy's and is kept in full,
  // because each link catches something the others don't:
  //   1. a rate limit, against double-click spam
  //   2. a DB read for an existing vote — the in-memory map resets on reload,
  //      so without this a refresh would allow re-voting for PP each time
  //   3. a re-check that the poll is still open
  //   4. the unique-constraint code (23505), which catches the race the read
  //      in step 2 cannot
  async vote(pollId, optionIndex) {
    if (!AppState.user) return false
    if (!canPerformAction('poll_vote_' + pollId, 5000)) {
      toastService.info('Please wait before voting again!')
      return false
    }

    try {
      const { data: existing } = await supabase
        .from('poll_votes').select('id')
        .eq('poll_id', pollId).eq('user_id', AppState.user.id).maybeSingle()
      if (existing) {
        pollState.votes = { ...pollState.votes, [pollId]: -1 }
        toastService.info('You already voted on this poll!')
        return false
      }

      const { data: poll } = await supabase
        .from('polls').select('is_active, ends_at').eq('id', pollId).single()
      if (poll && (!poll.is_active || new Date(poll.ends_at) < new Date())) {
        toastService.info('This poll has ended!')
        return false
      }

      const { error } = await supabase.from('poll_votes')
        .insert({ poll_id: pollId, user_id: AppState.user.id, option_index: optionIndex })
      if (error) {
        if (error.code === '23505') {
          pollState.votes = { ...pollState.votes, [pollId]: -1 }
          toastService.info('You already voted on this poll!')
          return false
        }
        throw error
      }

      // Best-effort: legacy tolerates this RPC not existing.
      supabase.rpc('increment_poll_votes', { poll_id_param: pollId }).then(null, () => {})

      pollState.votes = { ...pollState.votes, [pollId]: optionIndex }

      const { playerService } = await import('./PlayerService.js')
      await playerService.awardPoints(VOTE_PP, 'poll_vote')
      taskTracker.report('vote_poll')

      toastService.success(`🗳️ Vote counted! +${VOTE_PP} PP`)
      await this.load()
      return true
    } catch (e) {
      console.error('[pollService.vote]', e)
      toastService.error('Could not record your vote.')
      return false
    }
  }
}

export const pollService = new PollService()

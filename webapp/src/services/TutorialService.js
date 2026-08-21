import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'

// The real walkthrough UI (a `Tutorial` object with steps/dialogue/highlight
// logic) lives in an inline <script> in index.html, AFTER game.js — it's a
// genuine, working feature in the live site, not dead code (corrected from
// an earlier, wrong claim that only grepped game.js and missed it). Porting
// the full walkthrough is real, separate scope; this service just
// persists/reads the `tutorial_completed` flag for now.
class TutorialService {
  async checkStatus(userId) {
    const { data } = await supabase.from('players').select('tutorial_completed').eq('id', userId).maybeSingle()
    const completed = data ? !!data.tutorial_completed : false
    if (AppState.player) AppState.player.tutorial_completed = completed
    return completed
  }

  async markCompleted(userId) {
    await supabase.from('players').update({ tutorial_completed: true }).eq('id', userId)
    if (AppState.player) AppState.player.tutorial_completed = true
  }
}

export const tutorialService = new TutorialService()

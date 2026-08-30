import { reactive } from 'vue'

// Ports the PP transaction log (`_ppHistory` + pp_logTransaction, game.js:1451).
// The navbar's PP counter opens it — click the balance to see where the last 20
// movements came from.
//
// Deliberately client-side, as legacy is: this is a convenience log of what
// happened in front of the player, not an audit trail. The server keeps its own
// record via award_pp_secure/spend_pp_secure's reason strings.
//
// Legacy kept TWO copies — an in-memory array and a localStorage one — and
// merged them on open by matching on `time` and `amount`, so two identical
// awards in the same second collapsed into one row. One reactive list backed by
// localStorage removes the merge and the collision with it.
const STORAGE_KEY = 'pp_history'
const MAX_ENTRIES = 20

export const ppHistoryState = reactive({
  entries: []
})

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ppHistoryState.entries))
  } catch (e) { /* private mode */ }
}

class PPHistoryService {
  load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      if (Array.isArray(raw)) ppHistoryState.entries = raw.slice(0, MAX_ENTRIES)
    } catch (e) {
      ppHistoryState.entries = []
    }
  }

  log(amount, reason, newBalance) {
    if (!amount) return
    ppHistoryState.entries.unshift({
      amount,
      reason: reason || 'unknown',
      balance: newBalance,
      at: Date.now()
    })
    if (ppHistoryState.entries.length > MAX_ENTRIES) {
      ppHistoryState.entries.length = MAX_ENTRIES
    }
    persist()
  }

  clear() {
    ppHistoryState.entries = []
    persist()
  }

  // 'battle_victory' → 'battle victory'. Legacy does the same replace inline.
  label(reason) {
    return (reason || 'unknown').replace(/_/g, ' ')
  }

  time(entry) {
    // Legacy stored a pre-formatted locale string, which meant a log written in
    // one locale rendered wrong in another and could not be sorted. The epoch is
    // stored instead and formatted on read; an old pre-format entry still shows.
    if (typeof entry.at === 'number') return new Date(entry.at).toLocaleTimeString()
    return entry.time || ''
  }
}

export const ppHistoryService = new PPHistoryService()

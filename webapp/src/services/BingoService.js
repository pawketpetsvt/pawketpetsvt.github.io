import { reactive } from 'vue'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { playerService } from './PlayerService.js'
import { passService } from './PassService.js'
import { taskTracker } from './TaskTrackerService.js'
import { toastService } from './ToastService.js'
import { inventoryService } from './InventoryService.js'
import {
  BINGO_DRAWABLE, BINGO_LINES, BINGO_SQUARES, BINGO_LINE_PP, BINGO_LINE_XP,
  BINGO_SQUARE_XP, BINGO_BLACKOUT_PP, BINGO_BLACKOUT_XP, SKIN_KEY_ITEM_ID
} from '../data/bingoData.js'

// Ports the Daily Bingo (game.js:11406-11760).
//
// STRUCTURAL NOTE: legacy's `updateBingoProgress(taskType, n)` was the single
// function every feature in the game called to announce "the player did X" —
// which is why Bingo ended up owning progress reporting for Melon's Requests,
// the PawketPass and the weekly challenges, all of which hooked themselves into
// it. TaskTrackerService (Phase 8b) separated announcing from listening
// precisely so this system could become one subscriber among several. This
// service subscribes; it announces nothing.
export const bingoState = reactive({
  date: null,
  squares: [],
  completedLines: [],
  blackoutCompleted: false,
  loaded: false
})

const today = () => new Date().toISOString().slice(0, 10)
const claimedKey = () => 'bingo_claimed_' + bingoState.date

// Which ISO-ish week a blackout counts toward, for the once-a-week Skin Key.
function weekKey() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const days = Math.floor((now - start) / 86400000)
  return 'bingo_blackout_week_' + Math.ceil(days / 7) + '_' + now.getFullYear()
}

function readClaimed() {
  try { return JSON.parse(localStorage.getItem(claimedKey()) || '[]') } catch { return [] }
}

function writeClaimed(list) {
  try { localStorage.setItem(claimedKey(), JSON.stringify(list)) } catch { /* private mode */ }
}

// Ports generateDailyBingo(). Twelve tasks drawn at random, with the cheapest
// one pre-completed as the free space.
function generateBoard() {
  const pool = BINGO_DRAWABLE.slice()
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const squares = pool.slice(0, BINGO_SQUARES).map(t => ({
    id: t.id, name: t.name, target: t.target, taskType: t.taskType,
    rewardPoints: t.rewardPoints, progress: 0, completed: false
  }))

  let easiest = 0
  squares.forEach((s, i) => { if (s.rewardPoints < squares[easiest].rewardPoints) easiest = i })
  squares[easiest].completed = true
  squares[easiest].progress = squares[easiest].target
  squares[easiest].freeSpace = true
  return squares
}

class BingoService {
  // Legacy read localStorage first and treated the DB as a backup copy. Here
  // the DB row wins when it exists, so a cleared browser or a second device
  // doesn't hand the player a fresh board (and a fresh set of rewards).
  async load() {
    if (!AppState.user) return
    const d = today()

    try {
      const { data } = await supabase
        .from('user_bingo_progress')
        .select('bingo_data')
        .eq('user_id', AppState.user.id)
        .eq('date', d)
        .maybeSingle()

      if (data && data.bingo_data) {
        const parsed = typeof data.bingo_data === 'string'
          ? JSON.parse(data.bingo_data)
          : data.bingo_data
        if (parsed && parsed.date === d && Array.isArray(parsed.squares)) {
          Object.assign(bingoState, parsed, { loaded: true })
          return
        }
      }
    } catch (e) {
      console.error('[bingo] load failed, falling back to local:', e)
    }

    try {
      const saved = JSON.parse(localStorage.getItem('daily_bingo') || 'null')
      if (saved && saved.date === d) {
        Object.assign(bingoState, saved, { loaded: true })
        return
      }
    } catch { /* unreadable */ }

    bingoState.date = d
    bingoState.squares = generateBoard()
    bingoState.completedLines = []
    bingoState.blackoutCompleted = false
    bingoState.loaded = true
    await this.save()
  }

  async save() {
    const snapshot = {
      date: bingoState.date,
      squares: bingoState.squares,
      completedLines: bingoState.completedLines,
      blackoutCompleted: bingoState.blackoutCompleted
    }
    try { localStorage.setItem('daily_bingo', JSON.stringify(snapshot)) } catch { /* private mode */ }
    if (!AppState.user) return
    try {
      await supabase.from('user_bingo_progress').upsert({
        user_id: AppState.user.id,
        date: bingoState.date,
        bingo_data: JSON.stringify(snapshot)
      }, { onConflict: 'user_id,date' })
    } catch (e) {
      console.error('[bingo] save failed:', e)
    }
  }

  completedCount() {
    return bingoState.squares.filter(s => s.completed).length
  }

  // The TaskTracker subscriber. Ports updateBingoProgress().
  async onTask(taskType, amount = 1) {
    if (!AppState.user) return
    if (!bingoState.loaded || bingoState.date !== today()) await this.load()

    const square = bingoState.squares.find(s => s.taskType === taskType)
    if (!square || square.completed) return

    square.progress = Math.min(square.progress + (amount || 1), square.target)
    if (square.progress < square.target) {
      await this.save()
      return
    }

    square.completed = true

    // A per-day claimed list, so a square can't pay twice across reloads.
    const claimed = readClaimed()
    if (!claimed.includes(taskType)) {
      claimed.push(taskType)
      writeClaimed(claimed)
      await playerService.awardPoints(square.rewardPoints, 'bingo_' + taskType)
      passService.addXP(BINGO_SQUARE_XP, 'bingo_square')
      toastService.success(
        `✓ Bingo: ${square.name} complete! +${square.rewardPoints} PP, +${BINGO_SQUARE_XP} XP`
      )
      await this.checkLines()
    }

    await this.save()
  }

  async checkLines() {
    for (let i = 0; i < BINGO_LINES.length; i++) {
      const key = 'line_' + i
      if (bingoState.completedLines.includes(key)) continue
      if (!BINGO_LINES[i].every(c => bingoState.squares[c] && bingoState.squares[c].completed)) continue

      bingoState.completedLines.push(key)
      await playerService.awardPoints(BINGO_LINE_PP, 'Bingo Line Complete')
      passService.addXP(BINGO_LINE_XP, 'bingo_line')
      toastService.success(`🎯 Bingo Line Complete! +${BINGO_LINE_PP} PP, +${BINGO_LINE_XP} XP`)
    }

    if (!bingoState.blackoutCompleted && bingoState.squares.every(s => s.completed)) {
      bingoState.blackoutCompleted = true
      await playerService.awardPoints(BINGO_BLACKOUT_PP, 'Bingo Blackout!')
      passService.addXP(BINGO_BLACKOUT_XP, 'bingo_blackout')

      // A Skin Key for the first blackout of the week only.
      let alreadyThisWeek = false
      try { alreadyThisWeek = localStorage.getItem(weekKey()) === 'true' } catch { /* private mode */ }

      if (!alreadyThisWeek) {
        await inventoryService.grant(AppState.user.id, SKIN_KEY_ITEM_ID, 1)
        try { localStorage.setItem(weekKey(), 'true') } catch { /* private mode */ }
        toastService.success(
          `🏆 WEEKLY BLACKOUT! +${BINGO_BLACKOUT_PP} PP, +${BINGO_BLACKOUT_XP} XP, +1 Skin Key!`
        )
      } else {
        toastService.success(`🏆 BLACKOUT BINGO! +${BINGO_BLACKOUT_PP} PP, +${BINGO_BLACKOUT_XP} XP`)
      }
    }

    await this.save()
  }

  // Registered once from main.js. Returns the unsubscribe, which nothing calls
  // — this listener is meant to outlive every component.
  subscribe() {
    return taskTracker.subscribe((taskType, amount) => {
      this.onTask(taskType, amount).catch(e => console.error('[bingo] task failed:', e))
    })
  }
}

export const bingoService = new BingoService()

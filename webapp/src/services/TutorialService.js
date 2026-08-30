import { reactive } from 'vue'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { settingsState } from './SettingsService.js'
import { TUTORIAL_STEPS } from '../data/tutorialSteps.js'
import { TUTORIAL_PP_REWARD, TUTORIAL_SKIP_PP } from '../constants.js'

// Ports the `Tutorial` object from the legacy index.html's inline <script>
// (index.html:1090-1560). It lived there rather than in game.js, which is why
// it survived every earlier deletion pass untouched — and why it would have
// been dropped silently when cutover replaces that file.
//
// The rules are here; TutorialOverlay.vue renders `tutorialState`. Legacy built
// its overlay by assigning innerHTML strings and wired its buttons with inline
// `onclick="Tutorial.next()"` handlers, which is exactly the interleaving of
// logic and DOM this migration has been unpicking everywhere else.

const PROGRESS_KEY = 'tutorial_step'

// Which nav group has to be open for a highlighted tab's button to be visible
// and measurable. Legacy kept two copies of this map (one in _highlightTabBtn,
// one in runStep) that had already drifted — the runStep copy was missing the
// `settings: 'more'` entry. Derived from the shared menu instead so it cannot
// drift from the menu it describes.
import { NAV_GROUPS } from '../data/navMenu.js'
const TAB_GROUP = {}
for (const g of NAV_GROUPS) for (const item of g.items) TAB_GROUP[item.tab] = g.key

// Legacy dims the backdrop less for steps where the player is meant to look at
// (or click) the page behind it.
const INTERACTIVE_STEPS = ['adoption', 'shop', 'mypets', 'equipment', 'battle', 'minigames', 'fishing', 'racing', 'guild']

export const tutorialState = reactive({
  active: false,
  isReplay: false,
  stepIndex: 0,
  dialogueIndex: 0,
  waitingForPet: false,
  // null while running; set to the chosen spooky flag when the recap shows.
  recap: null,
  spookyChosen: false,
  highlightTab: null
})

class TutorialService {
  get steps() { return TUTORIAL_STEPS }

  get step() { return TUTORIAL_STEPS[tutorialState.stepIndex] || null }

  get dialogue() {
    const s = this.step
    return s ? s.dialogue[tutorialState.dialogueIndex] || null : null
  }

  get interactive() {
    const s = this.step
    return !!s && INTERACTIVE_STEPS.includes(s.id)
  }

  async checkStatus(userId) {
    const { data } = await supabase.from('players').select('tutorial_completed').eq('id', userId).maybeSingle()
    const completed = data ? !!data.tutorial_completed : false
    if (AppState.player) AppState.player.tutorial_completed = completed
    return completed
  }

  // There is deliberately no separate markCompleted(): `complete()` is the one
  // path that finishes the tutorial, and it has to write the spooky choice and
  // pay the reward in the same breath. A second, partial "mark it done" method
  // is how those three end up out of step.

  // ── progress ──────────────────────────────────────────────────────────────
  _save() {
    try { localStorage.setItem(PROGRESS_KEY, String(tutorialState.stepIndex)) } catch (e) {}
  }

  _load() {
    try { return parseInt(localStorage.getItem(PROGRESS_KEY) || '0', 10) || 0 } catch (e) { return 0 }
  }

  _clear() {
    try { localStorage.removeItem(PROGRESS_KEY) } catch (e) {}
  }

  // ── lifecycle ─────────────────────────────────────────────────────────────
  start(router) {
    if (tutorialState.active) return
    this._router = router
    tutorialState.active = true
    tutorialState.isReplay = false
    tutorialState.waitingForPet = false
    tutorialState.recap = null

    // Resume where a closed tab left off, as legacy did.
    const saved = this._load()
    tutorialState.stepIndex = (saved > 0 && saved < TUTORIAL_STEPS.length) ? saved : 0
    if (tutorialState.stepIndex === 0) this._clear()
    this.runStep()
  }

  replay(router) {
    if (tutorialState.active) return
    this._router = router
    tutorialState.active = true
    tutorialState.isReplay = true
    tutorialState.stepIndex = 0
    tutorialState.waitingForPet = false
    tutorialState.recap = null
    this._clear()
    this.runStep()
  }

  runStep() {
    const step = this.step
    if (!step) return this.complete(false)
    this._save()
    tutorialState.dialogueIndex = 0
    this.applyDialogue()

    if (step.tab && this._router) {
      // Open the containing nav group BEFORE navigating, so the tab's button is
      // laid out by the time the highlight tries to measure it.
      const group = TAB_GROUP[step.tab]
      if (group) AppState.navOpenGroup = group
      this._router.push('/' + step.tab)
    }
  }

  applyDialogue() {
    const d = this.dialogue
    if (!d) return
    tutorialState.waitingForPet = !!d.waitForPet
    tutorialState.highlightTab = d.highlightTab || null
    if (d.highlightTab && TAB_GROUP[d.highlightTab]) {
      AppState.navOpenGroup = TAB_GROUP[d.highlightTab]
    }
  }

  next() {
    const step = this.step
    if (!step) return
    const nextIdx = tutorialState.dialogueIndex + 1
    if (nextIdx < step.dialogue.length) {
      tutorialState.dialogueIndex = nextIdx
      this.applyDialogue()
      return
    }
    tutorialState.highlightTab = null
    tutorialState.stepIndex++
    if (tutorialState.stepIndex >= TUTORIAL_STEPS.length) return this.complete(false)
    this.runStep()
  }

  // Called by the adoption flow. Legacy polled every 150ms for the success
  // modal to close, with a 10s safety timeout; the Vue adoption flow calls this
  // once the modal is actually dismissed, so the poll is unnecessary.
  onPetAdopted() {
    if (!tutorialState.active || !tutorialState.waitingForPet) return
    tutorialState.waitingForPet = false
    setTimeout(() => { if (tutorialState.active) this.next() }, 500)
  }

  makeChoice(enableSpooky) {
    this.complete(enableSpooky)
  }

  skip() {
    this.complete(false, true)
  }

  // First run pays in full; skipping still pays, which the skip prompt promises.
  // A replay pays nothing.
  rewardFor(isSkip) {
    if (tutorialState.isReplay) return 0
    return isSkip ? TUTORIAL_SKIP_PP : TUTORIAL_PP_REWARD
  }

  async complete(spookyEnabled, isSkip = false) {
    tutorialState.highlightTab = null
    const reward = this.rewardFor(isSkip)

    if (AppState.user) {
      try {
        const update = { tutorial_completed: true, spooky_enabled: !!spookyEnabled }
        // Legacy recomputed the balance on the client and wrote it back, which
        // loses any PP earned elsewhere between load and completion. Award
        // through the normal path instead so the write is server-side and the
        // grant shows up in PP history like every other award.
        await supabase.from('players').update(update).eq('id', AppState.user.id)
        if (AppState.player) AppState.player.tutorial_completed = true
        settingsState.spooky_enabled = !!spookyEnabled

        if (reward > 0) {
          const { playerService } = await import('./PlayerService.js')
          await playerService.awardPoints(reward, 'tutorial')
        }
        this._clear()
      } catch (err) {
        console.error('[tutorial] could not save completion:', err)
      }
    }

    if (isSkip) return this.close()
    tutorialState.spookyChosen = !!spookyEnabled
    tutorialState.recap = { reward }
  }

  close() {
    tutorialState.active = false
    tutorialState.waitingForPet = false
    tutorialState.highlightTab = null
    tutorialState.recap = null
  }
}

export const tutorialService = new TutorialService()

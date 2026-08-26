import { reactive, watch } from 'vue'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { settingsState } from './SettingsService.js'
import { cosmeticsState, petCosmeticsService } from './PetCosmeticsService.js'
import { SKILL_KEY_MAP } from '../data/petKeys.js'
import {
  COMPANION_MESSAGES, PET_COMPANION_MESSAGES, SPOOKY_PHRASES,
  COMPANION_TIMING, SPOOKY_CHANCE, MEMORY_CHANCE, PET_LINE_CHANCE
} from '../data/companionData.js'

// Ports the CompanionBuddy object (game.js) — the pet that floats in the
// bottom-right corner once you set a companion on its card, drifting up and
// down and speaking every so often.
//
// Split of responsibility: this service owns the companion, the timers and the
// message selection; CompanionBuddy.vue owns the DOM. Legacy did both from one
// object, reaching into the page by element id.
export const companionState = reactive({
  pet: null,        // the user_pets row (with its `pets` catalog join)
  message: '',
  spooky: false,    // renders with glitch styling and lingers longer
  showBubble: false
})

// Legacy read the active `.page-section` id; the router's tabKey is the exact
// same set of names, so the mapping is a direct lookup.
const CONTEXT_TABS = ['shop', 'minigames', 'battle', 'adopt', 'mypets', 'home']

class CompanionService {
  constructor() {
    this.rotateTimer = null
    this.firstTimer = null
    this.bubbleTimer = null
    // Contextual memory, ported from CompanionBuddy's own fields.
    this.lastBattleResult = null   // { victory, enemyName, finalHP }
    this.lastFoodUsed = null       // item name
    this.started = false
    this.inited = false
  }

  // ── companion selection ───────────────────────────────────────────────────
  // The id itself lives in cosmeticsState (PetCosmeticsService owns the write),
  // so this watches it rather than keeping a second copy that could drift.
  //
  // It also loads that id itself rather than relying on MyPetsPage, which was
  // the only caller of loadCompanion() — the buddy has to appear on every page,
  // including for someone who never opens My Pets this session.
  init() {
    if (this.inited) return
    this.inited = true
    watch(() => AppState.user && AppState.user.id, (id) => {
      if (id) petCosmeticsService.loadCompanion(id)
      else cosmeticsState.companionPetId = null
    }, { immediate: true })
    watch(() => cosmeticsState.companionPetId, () => this.loadPet(), { immediate: true })
  }

  async loadPet() {
    const petId = cosmeticsState.companionPetId
    if (!petId || !AppState.user) {
      companionState.pet = null
      companionState.showBubble = false
      return
    }
    try {
      const res = await supabase
        .from('user_pets')
        .select('*, pets(*)')
        .eq('id', petId)
        .maybeSingle()
      companionState.pet = res.data || null
    } catch (e) {
      console.error('[companionService.loadPet]', e)
      companionState.pet = null
    }
  }

  async set(petId) {
    await petCosmeticsService.setCompanion(petId)
  }

  // Ports nothing in legacy — legacy had no way to remove a companion once set,
  // so the button stayed permanently disabled. Clearing the column is the
  // obvious counterpart and the same write with a null.
  async clear() {
    await petCosmeticsService.setCompanion(null)
    companionState.showBubble = false
  }

  // ── message selection ─────────────────────────────────────────────────────
  context() {
    const tab = AppState.tabKey || ''
    return CONTEXT_TABS.includes(tab) ? tab : 'idle'
  }

  // Ports getPetPersonalityMessage(). The pool key is resolved through
  // SKILL_KEY_MAP so a pet named `Kleat` finds the `kelta` pool and the streamer
  // aliases land too — see the bug note in companionData.js.
  petLine() {
    const pet = companionState.pet
    if (!pet) return null
    const raw = ((pet.pets && pet.pets.name) || '').toLowerCase()
    const pool = PET_COMPANION_MESSAGES[SKILL_KEY_MAP[raw] || raw]
    if (!pool || !pool.length) return null
    return pool[Math.floor(Math.random() * pool.length)]
  }

  // Ports getMemoryMessage(). The weather branch is deliberately omitted: the
  // weather system is not migrated, so legacy's `currentWeather` is the same
  // undefined it would be here and that branch contributes nothing either way.
  memoryLine(context) {
    const msgs = []
    const streak = (AppState.player && AppState.player.login_streak) || 0

    if (this.lastBattleResult && context !== 'shop') {
      if (this.lastBattleResult.victory) {
        msgs.push(`That battle earlier was amazing! 💪 You really showed ${this.lastBattleResult.enemyName || 'them'} who was boss!`)
        if (this.lastBattleResult.finalHP && this.lastBattleResult.finalHP < 10) {
          msgs.push('That last fight was SO close... 😰 Let us heal up before the next one!')
        }
      } else {
        msgs.push('Do not worry about that last battle... 💕 We will get them next time!')
      }
    }

    if (this.lastFoodUsed && context === 'shop') {
      msgs.push(`Last time you used a ${this.lastFoodUsed}! Should we grab another? 😋`)
    }

    if (streak >= 7) msgs.push(`${streak} days in a row! 🔥 You are so dedicated!`)
    if (streak >= 30) msgs.push('A whole month together! 💖 So glad you keep coming back!')

    const hour = new Date().getHours()
    if (hour < 6) msgs.push('You are up so late! 🌙 Or... really early? Either way, I am here!')
    if (hour >= 6 && hour < 10) msgs.push('Good morning! ☀️ Ready to start the day?')
    if (hour >= 22) msgs.push('Getting late... 🌙 One more adventure before bed?')

    if (!msgs.length) return null
    return msgs[Math.floor(Math.random() * msgs.length)]
  }

  // Ports getRandomMessage()'s cascade, odds unchanged.
  //
  // Legacy signalled a spooky line by prefixing the string with a NUL byte and
  // slicing it back off in showMessage. Here it is a second return value, so
  // nothing has to smuggle a flag through the text.
  pick(context) {
    if (settingsState.spooky_enabled && Math.random() < SPOOKY_CHANCE) {
      return { text: SPOOKY_PHRASES[Math.floor(Math.random() * SPOOKY_PHRASES.length)], spooky: true }
    }
    if (Math.random() < MEMORY_CHANCE) {
      const mem = this.memoryLine(context)
      if (mem) return { text: mem, spooky: false }
    }
    if (Math.random() < PET_LINE_CHANCE) {
      const line = this.petLine()
      if (line) return { text: line, spooky: false }
    }
    const pool = COMPANION_MESSAGES[context] || COMPANION_MESSAGES.idle
    return { text: pool[Math.floor(Math.random() * pool.length)], spooky: false }
  }

  // ── speaking ──────────────────────────────────────────────────────────────
  // Public so the rest of the game can make the companion react to something,
  // as legacy's CompanionBuddy.showMessage() call sites do.
  say(text, spooky = false) {
    if (!companionState.pet || !text) return
    if (this.bubbleTimer) clearTimeout(this.bubbleTimer)
    companionState.message = text
    companionState.spooky = spooky
    companionState.showBubble = true
    const dwell = spooky ? COMPANION_TIMING.SPOOKY_BUBBLE_MS : COMPANION_TIMING.BUBBLE_MS
    this.bubbleTimer = setTimeout(() => { companionState.showBubble = false }, dwell)
  }

  // Picks one line at random from a pool — the shape every legacy reaction hook
  // uses (`showMessage(msgs[Math.floor(Math.random() * msgs.length)])`).
  react(pool, delayMs = 0) {
    if (!companionState.pet || !pool || !pool.length) return
    const line = pool[Math.floor(Math.random() * pool.length)]
    if (delayMs > 0) setTimeout(() => this.say(line), delayMs)
    else this.say(line)
  }

  remember(patch) {
    Object.assign(this, patch)
  }

  speakNow() {
    const { text, spooky } = this.pick(this.context())
    this.say(text, spooky)
  }

  // ── rotation ──────────────────────────────────────────────────────────────
  start() {
    if (this.started) return
    this.started = true
    this.firstTimer = setTimeout(() => this.speakNow(), COMPANION_TIMING.FIRST_MESSAGE_MS)
    this.rotateTimer = setInterval(() => this.speakNow(), COMPANION_TIMING.ROTATE_MS)
  }

  stop() {
    this.started = false
    clearTimeout(this.firstTimer)
    clearInterval(this.rotateTimer)
    clearTimeout(this.bubbleTimer)
    this.firstTimer = this.rotateTimer = this.bubbleTimer = null
    companionState.showBubble = false
  }
}

export const companionService = new CompanionService()

import { reactive } from 'vue'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { playerService } from './PlayerService.js'
import { inventoryService } from './InventoryService.js'
import { toastService } from './ToastService.js'
import { settingsState } from './SettingsService.js'
import { AD_POOL } from '../data/adpocalypseData.js'

// Ports the Ad-pocalypse weather event (adpocalypse_*, game.js:32229-32320) —
// fake popup ads from "Melon Interactive" that drift in while that weather is
// running. One of them is quietly horrible.
//
// Porting this is what lets `adpocalypse` back into the weather roll:
// WeatherService excluded it deliberately, because rolling it would have
// announced "Ads appear!" and then produced none.
export const adpocalypseState = reactive({
  active: false,
  popups: []   // { key, ad, position }
})

const FIRST_AD_MS = 8000
const MIN_GAP_MS = 25000
const EXTRA_GAP_MS = 15000
const AUTO_CLOSE_MS = 12000

// Legacy's five screen positions — deliberately never dead centre, where the
// page's own content is.
const POSITIONS = [
  { top: '8%', right: '3%' },
  { top: '8%', left: '2%' },
  { bottom: '10%', right: '3%' },
  { bottom: '10%', left: '2%' },
  { top: '35%', right: '2%' }
]

let nextKey = 1

class AdpocalypseService {
  constructor() {
    this.firstTimer = null
    this.interval = null
  }

  pickAd() {
    const total = AD_POOL.reduce((s, a) => s + a.weight, 0)
    let roll = Math.random() * total
    for (const ad of AD_POOL) {
      roll -= ad.weight
      if (roll < 0) return ad
    }
    return AD_POOL[0]
  }

  start() {
    if (adpocalypseState.active) return
    if (!AppState.user) return
    adpocalypseState.active = true
    toastService.info('📢 Ad-pocalypse weather! Watch out for ads...')

    this.firstTimer = setTimeout(() => {
      this.show()
      this.interval = setInterval(() => {
        if (!adpocalypseState.active) return this.stop()
        this.show()
      }, MIN_GAP_MS + Math.random() * EXTRA_GAP_MS)
    }, FIRST_AD_MS)
  }

  stop() {
    adpocalypseState.active = false
    clearTimeout(this.firstTimer)
    clearInterval(this.interval)
    this.firstTimer = null
    this.interval = null
    adpocalypseState.popups = []
  }

  show() {
    if (!adpocalypseState.active || !AppState.user) return
    const ad = this.pickAd()
    // Spooky mode off means the horror ad is skipped and a different one is
    // drawn — it is genuinely unsettling and the setting exists to opt out.
    if (ad.horror && !settingsState.spooky_enabled) return

    const key = nextKey++
    adpocalypseState.popups.push({
      key,
      ad,
      position: POSITIONS[Math.floor(Math.random() * POSITIONS.length)]
    })
    setTimeout(() => this.close(key), AUTO_CLOSE_MS)
  }

  close(key) {
    adpocalypseState.popups = adpocalypseState.popups.filter(p => p.key !== key)
  }

  // Ports each ad's `outcome`. Named here rather than carried on the data row,
  // so adpocalypseData.js stays pure data.
  async resolve(ad) {
    this.close(ad.__key)
    try {
      switch (ad.id) {
        case 'ad_free_pp':
          await playerService.awardPoints(25, 'adpocalypse_ad')
          toastService.success('🎉 You got 25 free PP from an ad! Melon is feeling generous.')
          break

        case 'ad_item_drop': {
          const res = await supabase.from('items').select('id,name')
            .in('name', ['Honey Cookies', 'Popcorn', 'Rice Crackers', 'Gummy Worms', 'Grape Juice'])
            .limit(5)
          if (res.data && res.data.length) {
            const item = res.data[Math.floor(Math.random() * res.data.length)]
            await inventoryService.grant(AppState.user.id, item.id, 1)
            toastService.success(`🎁 Ad reward: 1x ${item.name} added to your inventory!`)
          } else {
            toastService.info('🎁 The prize got lost in the mail. Sorry!')
          }
          break
        }

        case 'ad_pp_loss':
          await playerService.adjustPoints(-50, 'adpocalypse_scam')
          toastService.warning('😈 You bought PetCare Pro™! -50 PP. The product does not exist.')
          break

        case 'ad_happiness_drain': {
          // Legacy drains 10 happiness from every pet via its in-memory
          // petState. The owned pets are the same list here, and each write is
          // mirrored onto the reactive model so the cards update at once.
          for (const pet of AppState.ownedPets || []) {
            const next = Math.max(0, (pet.happiness || 0) - 10)
            pet.happiness = next
            await supabase.from('user_pets').update({ happiness: next }).eq('id', pet.id)
          }
          toastService.warning('😢 The guilt ad worked. All your pets lost 10 happiness.')
          break
        }

        case 'ad_nothing':
          toastService.info('There was nothing there. Thank you for your participation. 🙂')
          break

        case 'ad_horror': {
          toastService.info('...noted. please continue playing.')
          // A small nudge toward corruption — the ad is part of the ARG layer.
          await supabase.rpc('nudge_world_state', {
            p_flag_key: 'corruption_level', p_delta: 0.5
          })
          const { worldStateService } = await import('./WorldStateService.js')
          await worldStateService.loadFlags(true)
          break
        }
      }
    } catch (e) {
      console.error('[adpocalypse] outcome failed:', e)
    }
  }
}

export const adpocalypseService = new AdpocalypseService()

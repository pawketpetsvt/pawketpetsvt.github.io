import { supabase } from './SupabaseService.js'

class JournalService {
  // Ports loadJournalDiscoveries(), game.js:21482-21512.
  async loadDiscoveries(userId) {
    const { data, error } = await supabase.from('pet_journal').select('*').eq('user_id', userId)
    if (error) {
      console.error('[Journal] Error loading:', error)
      return {}
    }
    const discoveries = {}
    ;(data || []).forEach(entry => {
      const petType = entry.entry_data && entry.entry_data.pet_type
      if (!petType) return
      let normalized = petType.charAt(0).toUpperCase() + petType.slice(1).toLowerCase()
      if (/^steve$/i.test(petType) || /^cowbee$/i.test(petType)) normalized = 'Steve'
      if (/^kleat$/i.test(petType) || /^kelta$/i.test(petType)) normalized = 'Kleat'
      if (/^cypurr/i.test(petType)) normalized = 'Cypurr'
      if (!discoveries[normalized]) discoveries[normalized] = {}
      discoveries[normalized][entry.entry_type] = true
    })
    return discoveries
  }

  // Ports logJournalDiscovery(), game.js:21514-21542. Not yet called from
  // anywhere in webapp/ — the systems that would trigger it (feeding
  // reactions, battle wins, expeditions, leveling) aren't migrated yet.
  // Exposed now so those phases can call it without re-deriving this.
  async logDiscovery(userId, petType, discoveries, discoveryType, itemName) {
    if (!userId || !petType) return
    if (discoveries[petType] && discoveries[petType][discoveryType]) return
    try {
      await supabase.from('pet_journal').insert({
        user_id: userId,
        entry_type: discoveryType,
        entry_data: { pet_type: petType, item_name: itemName, discovered_at: new Date().toISOString() }
      })
      if (!discoveries[petType]) discoveries[petType] = {}
      discoveries[petType][discoveryType] = true
    } catch (err) {
      console.error('[Journal] Error logging:', err)
    }
  }
}

export const journalService = new JournalService()

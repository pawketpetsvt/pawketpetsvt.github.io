import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { Pet } from '../models/Pet.js'

class PetsService {
  async getCatalog() {
    const res = await supabase.from('pets').select('*').order('created_at', { ascending: true })
    if (res.error || !res.data) {
      AppState.petCatalog = []
      throw new Error('Could not load pets.')
    }
    AppState.petCatalog = res.data.map(p => new Pet(p))
    return AppState.petCatalog
  }
}

export const petsService = new PetsService()

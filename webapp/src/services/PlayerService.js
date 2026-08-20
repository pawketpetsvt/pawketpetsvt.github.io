import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { Player } from '../models/Player.js'

const BONUS = 50

class PlayerService {
  async getPlayer(userId) {
    const pr = await supabase.from('players').select('pawketpoints, username, id').eq('id', userId).single()
    if (pr.data) AppState.player = new Player(pr.data)
    return AppState.player
  }

  async checkDailyBonus(userId) {
    const today = new Date().toISOString().split('T')[0]
    const key = 'daily_bonus_' + userId
    if (localStorage.getItem(key) === today) return { awarded: false }
    const pr = await supabase.from('players').select('pawketpoints').eq('id', userId).single()
    if (!pr.data) return { awarded: false }
    const newPoints = pr.data.pawketpoints + BONUS
    const res = await supabase.from('players').update({ pawketpoints: newPoints }).eq('id', userId)
    if (!res.error) {
      localStorage.setItem(key, today)
      if (AppState.player) AppState.player.pawketpoints = newPoints
      return { awarded: true, amount: BONUS, newTotal: newPoints }
    }
    return { awarded: false }
  }

  deductPoints(amount) {
    if (AppState.player) AppState.player.pawketpoints -= amount
  }
}

export const playerService = new PlayerService()

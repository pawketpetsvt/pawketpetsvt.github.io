import { supabase } from './SupabaseService.js'
import * as badgeHooks from './BadgeHooks.js'
import { AppState } from '../AppState.js'
import { playerService } from './PlayerService.js'
import { notificationService } from './NotificationService.js'
import { modalService } from './ModalService.js'
import { STREAK_MILESTONES } from '../constants.js'

class StreakService {
  nextMilestoneText(streak) {
    const next = STREAK_MILESTONES.find(m => streak < m)
    return next ? `🎯 ${next - streak} more for ${next}-day reward!` : '🏆 Legendary streak!'
  }

  // Ports checkDailyLogin(), game.js:27512-27688. The item/skin-key/scrapbook/
  // furniture/guild-perk side effects there belong to systems not yet
  // migrated (Shop/Inventory, skin keys, Scrapbook, Housing, Guild) — this
  // keeps the core streak + PP reward + notification, and intentionally
  // skips those cross-system rewards until their own migration phases land.
  async checkDailyLogin(userId) {
    const today = new Date().toISOString().split('T')[0]
    const key = 'lastLoginDate_' + userId
    if (localStorage.getItem(key) === today) return { awarded: false }

    const { data: player, error } = await supabase
      .from('players')
      .select('last_login, login_streak')
      .eq('id', userId)
      .maybeSingle()
    if (error || !player) return { awarded: false }

    let streak = player.login_streak || 0
    const lastDate = player.last_login ? new Date(player.last_login).toISOString().split('T')[0] : null
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    if (lastDate === yesterdayStr) streak++
    else if (lastDate !== today) streak = 1

    let ppReward = 50 + streak * 5
    if (streak >= 7) ppReward += 50
    if (streak >= 14) ppReward += 100
    if (streak >= 30) ppReward += 200

    await supabase.from('players').update({ last_login: new Date().toISOString(), login_streak: streak }).eq('id', userId)
    await playerService.awardPoints(ppReward, 'daily_login_day_' + streak)

    localStorage.setItem(key, today)
    if (AppState.player) AppState.player.login_streak = streak
    AppState.sidebarStats.streak = streak

    await notificationService.create(userId, 'daily_reward', '🎁 Daily Login Reward!', `Day ${streak} streak! Earned ${ppReward} PP`, 'tab:home')

    // Each pet's room grants a daily happiness bonus from the furniture in it.
    // Non-blocking, as legacy also fires it: the login reward should not wait on
    // it, and a failure here must not cost the player their streak.
    this.applyRoomBonuses().catch(() => {})

    badgeHooks.onStreak(streak)
    badgeHooks.onLogin()
    return { awarded: true, streak, ppReward }
  }

  // Ports furniture_applyDailyBonus()'s call site. Legacy read the pet ids from
  // its `petState` global; here they come from the owned-pets list, loading it
  // first if the player hasn't opened My Pets yet this session.
  async applyRoomBonuses() {
    const { furnitureService } = await import('./FurnitureService.js')
    let pets = AppState.ownedPets || []
    if (!pets.length) {
      const { ownedPetsService } = await import('./OwnedPetsService.js')
      pets = await ownedPetsService.getMyPets(AppState.user.id)
    }
    await furnitureService.applyDailyBonus((pets || []).map(p => p.id))
  }

  showDailyLoginReward(streak, ppReward) {
    return modalService.alert(
      'Daily Login Reward!',
      `🔥 ${streak} Day Streak! 🪙 +${ppReward} PawketPoints`,
      '🎁'
    )
  }
}

export const streakService = new StreakService()

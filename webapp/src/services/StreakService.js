import { supabase } from './SupabaseService.js'
import { referralService } from './ReferralService.js'
import { scrapbookService } from './ScrapbookService.js'
import { passService } from './PassService.js'
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

  // Ports checkDailyLogin(), game.js:27512-27688. Every cross-system side
  // effect legacy fires from here is live: the room happiness bonus (Housing),
  // referral milestones, badges, Pass XP, and — as of Phase 9.5 — the daily
  // random scrapbook memory and the neglect-recovery memory for pets that have
  // been left alone for two days.
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
    passService.addXP(10, 'login')
    referralService.claimPendingMilestones()
    badgeHooks.onLogin()
    this.recordDailyMemories().catch(() => {})
    return { awarded: true, streak, ppReward }
  }

  // Ports the two scrapbook hooks legacy fires around a daily login: one random
  // flavour memory on a random pet (main:6091), and a quiet 'neglect_recovery'
  // note for any pet untouched for 48 hours (main:12785, inside
  // newFeatures_init's welcome-back block).
  async recordDailyMemories() {
    // Lazily imported, as applyRoomBonuses() below does — OwnedPetsService
    // imports this one back, so a static import would be a cycle.
    let pets = AppState.ownedPets || []
    if (!pets.length) {
      const { ownedPetsService } = await import('./OwnedPetsService.js')
      pets = await ownedPetsService.getMyPets(AppState.user.id)
    }
    if (!pets || !pets.length) return

    const pick = pets[Math.floor(Math.random() * pets.length)]
    await scrapbookService.addRandomDaily(pick.id)

    const now = Date.now()
    for (const pet of pets) {
      const last = pet.last_played || pet.last_fed
      if (!last) continue
      const hoursGone = (now - new Date(last).getTime()) / 3600000
      if (hoursGone >= 48) await scrapbookService.add(pet.id, 'neglect_recovery', {})
    }
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

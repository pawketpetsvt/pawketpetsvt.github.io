import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { passService } from './PassService.js'
import { playerService } from './PlayerService.js'
import { awardService } from './AwardService.js'
import { toastService } from './ToastService.js'

// Ports checkAchievementTierProgress() (game.js:25193-25272) — the five-tier
// progression layered on top of each per-pet achievement in `pet_achievements`.
//
// Tier 1 is the base (always held); tiers 2-5 each have a requirement and a
// reward column on the achievement row, so the whole ladder is data rather than
// code and new achievements need no client change.
const MAX_TIER = 5

// Which milestone badge a newly reached tier earns.
function tierBadge(tier) {
  if (tier >= 5) return 'gold_collector'
  if (tier >= 4) return 'silver_collector'
  if (tier >= 2) return 'bronze_collector'
  return null
}

class AchievementTierService {
  // `currentValue` is whatever that achievement counts — an expedition streak,
  // a feed count, a race win. Never throws: a tier check must not be able to
  // break the action that triggered it.
  async check(achievementKey, petId, currentValue) {
    if (!AppState.user || !petId || !achievementKey) return null
    try {
      const { data: achievement } = await supabase
        .from('pet_achievements')
        .select('id, name, tier2_requirement, tier3_requirement, tier4_requirement, tier5_requirement, tier2_reward, tier3_reward, tier4_reward, tier5_reward')
        .eq('achievement_key', achievementKey)
        .maybeSingle()
      if (!achievement) return null

      const { data: userAch } = await supabase
        .from('user_pet_achievements')
        .select('id, current_tier, progress')
        .eq('user_id', AppState.user.id)
        .eq('pet_id', petId)
        .eq('achievement_id', achievement.id)
        .maybeSingle()

      const currentTier = (userAch && userAch.current_tier) || 1
      // Index 0 is tier 1, which has no requirement.
      const requirements = [null, achievement.tier2_requirement, achievement.tier3_requirement,
        achievement.tier4_requirement, achievement.tier5_requirement]
      const rewards = [null, achievement.tier2_reward, achievement.tier3_reward,
        achievement.tier4_reward, achievement.tier5_reward]

      let newTier = currentTier
      for (let t = currentTier; t < MAX_TIER; t++) {
        const req = requirements[t]
        if (req && currentValue >= req) newTier = t + 1
        else break
      }
      if (newTier <= currentTier) return null

      if (userAch) {
        await supabase.from('user_pet_achievements')
          .update({ current_tier: newTier, progress: currentValue, tier_completed_at: new Date().toISOString() })
          .eq('id', userAch.id)
      } else {
        await supabase.from('user_pet_achievements').insert({
          user_id: AppState.user.id,
          pet_id: petId,
          achievement_id: achievement.id,
          current_tier: newTier,
          progress: currentValue,
          tier_completed_at: new Date().toISOString()
        })
      }

      const reward = rewards[newTier - 1]
      if (reward) {
        if (reward.pp) await playerService.awardPoints(reward.pp, 'tier_reward')
        if (reward.badge) await awardService.awardBadge(reward.badge)
        if (reward.title) await awardService.awardPlayerTitle(reward.title, 'achievement_tier')
      }

      const badge = tierBadge(newTier)
      if (badge) await awardService.awardBadge(badge)

      toastService.success(`🏆 ${achievement.name || achievementKey} reached Tier ${newTier}!`)
      passService.addXP(10 * newTier, 'tier_unlock')
      awardService._logActivity('achievement_unlocked', {
        achievement_name: `${achievement.name || achievementKey} (Tier ${newTier})`
      })
      return newTier
    } catch (e) {
      console.error('[achievementTiers] check failed:', e)
      return null
    }
  }
}

export const achievementTierService = new AchievementTierService()

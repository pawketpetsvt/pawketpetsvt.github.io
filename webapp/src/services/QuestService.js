import { reactive } from 'vue'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { passService } from './PassService.js'
import { playerService } from './PlayerService.js'
import { awardService } from './AwardService.js'
import { toastService } from './ToastService.js'
import { taskTracker } from './TaskTrackerService.js'

// Ports the personality quest arcs (assignQuestArc / progressQuestArc /
// personality_renderQuestWidget, game.js:25282-25420).
//
// Each pet can be on a three-day story arc drawn from `personality_quests`,
// matched to the personality PetMoodService assigns it that day. Each day names
// an action; doing it advances the arc and pays out, and finishing all three
// pays a completion reward.
//
// This is the second of the two systems that were blocking a quarantined Bingo
// square — `complete_quest`.
export const questState = reactive({
  // petId -> { arc, day, completed }
  byPet: {},
  celebrating: null
})

const DAY_REWARD_FALLBACK = 25
const COMPLETION_FALLBACK = 100
const ARC_DAYS = 3

class QuestService {
  quest(petId) {
    return questState.byPet[petId] || null
  }

  // Ports assignQuestArc(). Called when a pet's daily mood is set up, so the
  // arc's personality always matches the one the pet is actually showing.
  async assign(petId, personality) {
    if (!AppState.user || !petId) return null
    const existing = questState.byPet[petId]
    if (existing && !existing.completed && existing.day < ARC_DAYS) return existing

    const today = new Date().toISOString().slice(0, 10)
    try {
      const { data: arcs, error } = await supabase
        .from('personality_quests')
        .select('*')
        .eq('personality', personality || 'playful')
      if (error || !arcs || !arcs.length) return null

      const arc = arcs[Math.floor(Math.random() * arcs.length)]

      await supabase.from('pet_daily_moods')
        .update({ quest_arc: arc.quest_key, quest_day: 1, quest_data: arc })
        .eq('pet_id', petId).eq('date', today)

      questState.byPet[petId] = { arc, day: 1, completed: false }
      return questState.byPet[petId]
    } catch (e) {
      console.error('[quests] assign failed:', e)
      return null
    }
  }

  // Restores an in-progress arc from the pet's mood row, so a reload doesn't
  // lose it. Legacy did this lazily inside its render function.
  hydrate(petId, moodRow) {
    if (!moodRow || !moodRow.quest_arc || !moodRow.quest_data) return null
    questState.byPet[petId] = {
      arc: moodRow.quest_data,
      day: moodRow.quest_day || 1,
      completed: false
    }
    return questState.byPet[petId]
  }

  // What today's step is asking for, for the widget's hint line.
  todaysHint(petId) {
    const q = this.quest(petId)
    if (!q || q.completed) return null
    return q.arc['day' + q.day + '_hint'] || "Complete today's action to progress!"
  }

  percent(petId) {
    const q = this.quest(petId)
    if (!q) return 0
    return Math.round(((q.day - 1) / ARC_DAYS) * 100)
  }

  // Ports progressQuestArc(). `actionKey` is one of feed / play / expedition /
  // race — the vocabulary the arc rows are authored against.
  async progress(petId, actionKey) {
    const q = this.quest(petId)
    if (!q || q.completed) return null

    const arc = q.arc
    const required = arc['day' + q.day + '_action']
    if (!required) return null
    const actions = Array.isArray(required) ? required : [required]
    if (!actions.includes(actionKey)) return null

    const finishedDay = q.day
    q.day = finishedDay + 1

    const today = new Date().toISOString().slice(0, 10)
    const dayReward = arc['day' + finishedDay + '_reward'] || DAY_REWARD_FALLBACK

    await playerService.awardPoints(dayReward, 'quest_day_' + finishedDay)
    passService.addXP(10, 'quest_progress')
    taskTracker.report('complete_quest')

    const story = arc['day' + finishedDay + '_story'] || ''
    toastService.success(
      `📖 Quest Day ${finishedDay}/${ARC_DAYS} complete! +${dayReward} PP` + (story ? ` · ${story}` : '')
    )

    if (q.day > ARC_DAYS) {
      await this.complete(petId, arc, today)
      return { finished: true, arc }
    }

    await supabase.from('pet_daily_moods')
      .update({ quest_day: q.day }).eq('pet_id', petId).eq('date', today)
    return { finished: false, day: q.day, arc }
  }

  async complete(petId, arc, today) {
    const q = questState.byPet[petId]
    if (q) q.completed = true

    const finalReward = arc.completion_reward || COMPLETION_FALLBACK
    await playerService.awardPoints(finalReward, 'quest_complete')
    passService.addXP(50, 'quest_complete')
    if (arc.reward_badge) await awardService.awardBadge(arc.reward_badge)
    if (arc.reward_title) await awardService.awardPlayerTitle(arc.reward_title, 'quest_complete')

    // The celebration panel reads this; legacy opened a modal from here.
    questState.celebrating = {
      name: arc.name || 'Adventure',
      story: arc.completion_story || '',
      pp: finalReward,
      badge: !!arc.reward_badge
    }

    await supabase.from('pet_daily_moods')
      .update({ quest_arc: null, quest_day: null })
      .eq('pet_id', petId).eq('date', today)
    delete questState.byPet[petId]
  }

  dismissCelebration() {
    questState.celebrating = null
  }

}

export const questService = new QuestService()

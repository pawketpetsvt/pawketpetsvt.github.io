import { reactive } from 'vue'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { passService } from './PassService.js'
import { taskTracker } from './TaskTrackerService.js'
import { inventoryService } from './InventoryService.js'
import { notificationService } from './NotificationService.js'
import { awardService } from './AwardService.js'

// Ports the friendship gifting system (giftSystem + gift_*, game.js:39516-39850).
//
// Deferred since Phase 5, when Friends shipped with its "🎁 Send Gift" button
// stubbed, and again in Phase 6 on the profile page. It is also one of the two
// systems blocking a quarantined Bingo square (`send_gift`).
export const GIFT_LIMITS = {
  DAILY_SEND: 5,
  DAILY_RECV: 10,
  FRIENDSHIP_DAYS_MIN: 1,
  ACCOUNT_AGE_DAYS: 14,
  EXPIRY_DAYS: 7
}

// Economy protection — these never appear in the gift picker.
export const BLOCKED_ITEM_TYPES = ['skin_key', 'pass_key', 'premium']

export const giftState = reactive({
  inbox: [],
  inboxCount: 0,
  loaded: false
})

const todayISO = () => new Date().toISOString().split('T')[0]

class GiftService {
  // Ports giftSystem.canSendGift(). Every rule is re-checked at send time as
  // well, since the modal can sit open while a limit is reached elsewhere.
  async canSend(toUserId) {
    if (!AppState.user) return { ok: false, reason: 'Not logged in' }
    if (toUserId === AppState.user.id) return { ok: false, reason: "You can't gift yourself!" }

    const { data: me } = await supabase
      .from('players').select('created_at').eq('id', AppState.user.id).maybeSingle()
    if (me && me.created_at) {
      const ageDays = (Date.now() - new Date(me.created_at).getTime()) / 86400000
      if (ageDays < GIFT_LIMITS.ACCOUNT_AGE_DAYS) {
        return {
          ok: false,
          reason: `Your account must be at least ${GIFT_LIMITS.ACCOUNT_AGE_DAYS} days old to send gifts.`
        }
      }
    }

    const { data: friendship } = await supabase
      .from('friendships')
      .select('created_at, status')
      .or(`and(requester_id.eq.${AppState.user.id},addressee_id.eq.${toUserId}),and(requester_id.eq.${toUserId},addressee_id.eq.${AppState.user.id})`)
      .eq('status', 'accepted')
      .maybeSingle()

    if (!friendship) return { ok: false, reason: 'You can only gift friends.' }
    const friendDays = (Date.now() - new Date(friendship.created_at).getTime()) / 86400000
    if (friendDays < GIFT_LIMITS.FRIENDSHIP_DAYS_MIN) {
      const left = Math.ceil(GIFT_LIMITS.FRIENDSHIP_DAYS_MIN - friendDays)
      return {
        ok: false,
        reason: `You must be friends for at least ${GIFT_LIMITS.FRIENDSHIP_DAYS_MIN} day first. (${left} day${left !== 1 ? 's' : ''} to go)`
      }
    }

    const today = todayISO()
    const { count: sentToday } = await supabase
      .from('gifts').select('id', { count: 'exact', head: true })
      .eq('from_user_id', AppState.user.id).gte('sent_at', today)
    if ((sentToday || 0) >= GIFT_LIMITS.DAILY_SEND) {
      return { ok: false, reason: `You've sent ${GIFT_LIMITS.DAILY_SEND} gifts today. Come back tomorrow!` }
    }

    const { count: recvToday } = await supabase
      .from('gifts').select('id', { count: 'exact', head: true })
      .eq('to_user_id', toUserId).gte('sent_at', today)
    if ((recvToday || 0) >= GIFT_LIMITS.DAILY_RECV) {
      return { ok: false, reason: "This player's gift inbox is full today. Try tomorrow!" }
    }

    return { ok: true, sentToday: sentToday || 0, remaining: GIFT_LIMITS.DAILY_SEND - (sentToday || 0) }
  }

  // What this player can actually give away.
  async giftableInventory() {
    if (!AppState.user) return []
    const { data } = await supabase
      .from('user_inventory')
      .select('id, quantity, items(id, name, item_type, image_url)')
      .eq('user_id', AppState.user.id)
      .gt('quantity', 0)
    return (data || [])
      .filter(row => row.items && !BLOCKED_ITEM_TYPES.includes(row.items.item_type))
      .map(row => ({ ...row.items, quantity: row.quantity }))
  }

  // Ports gift_sendGift(). Throws with the reason, so the caller surfaces it.
  async send({ toUserId, toUsername, itemId, quantity, message }) {
    const check = await this.canSend(toUserId)
    if (!check.ok) throw new Error(check.reason)
    if (!itemId) throw new Error('Please select an item')

    const qty = Math.max(1, quantity || 1)

    const { error } = await supabase.from('gifts').insert({
      from_user_id: AppState.user.id,
      to_user_id: toUserId,
      item_id: itemId,
      quantity: qty,
      message: (message || '').trim().slice(0, 140),
      expires_at: new Date(Date.now() + GIFT_LIMITS.EXPIRY_DAYS * 86400000).toISOString()
    })
    if (error) throw new Error(error.message)

    // Deduct from the sender's inventory.
    const { data: invRow } = await supabase
      .from('user_inventory').select('id, quantity')
      .eq('user_id', AppState.user.id).eq('item_id', itemId).maybeSingle()
    if (invRow) {
      if (invRow.quantity <= qty) {
        await supabase.from('user_inventory').delete().eq('id', invRow.id)
      } else {
        await supabase.from('user_inventory').update({ quantity: invRow.quantity - qty }).eq('id', invRow.id)
      }
    }

    await this.addFriendshipPoints(AppState.user.id, 5, 'sent')

    await notificationService.create(
      toUserId, 'gift_received', '🎁 You got a gift!',
      `${(AppState.player && AppState.player.username) || 'Someone'} sent you a gift! Open your inbox to claim it.`,
      'gift:inbox', AppState.user.id
    )

    taskTracker.report('send_gift')
    passService.addXP(10, 'gift_sent')
    await this.checkSenderBadges()

    return { toUsername, qty }
  }

  // Ports the three gifting badges.
  //
  // LEGACY BUG: `secret_santa` is tested with `totalSent === 1`, so a player
  // whose count ever skips exactly 1 — two gifts sent in quick succession, or a
  // count read after a second insert landed — loses it permanently. The other
  // two already use `>=`. Same strict-equality family as the battle win
  // milestones fixed in increment 1. awardBadge is idempotent, so `>=` here
  // simply grants what was earned.
  async checkSenderBadges() {
    const { count } = await supabase
      .from('gifts').select('id', { count: 'exact', head: true })
      .eq('from_user_id', AppState.user.id)
    const total = count || 0
    if (total >= 1) await awardService.awardBadge('secret_santa')
    if (total >= 10) await awardService.awardBadge('generous_soul')
    if (total >= 50) await awardService.awardBadge('philanthropist')
  }

  // Ports gift_loadInbox().
  //
  // LEGACY BUG: legacy's own comment says "Expire old gifts client-side
  // display", but it only ever COMPUTES a days-remaining number for the label —
  // nothing filters on `expires_at` and nothing marks a lapsed gift expired. A
  // gift sent a year ago is still sitting there, claimable. The 7-day expiry is
  // decorative. Expired gifts are filtered out here and marked so they stop
  // being counted.
  async loadInbox() {
    if (!AppState.user) return []
    const { data } = await supabase
      .from('gifts')
      .select('*, items(name, image_url)')
      .eq('to_user_id', AppState.user.id)
      .eq('status', 'pending')
      .order('sent_at', { ascending: false })

    const all = data || []
    const now = Date.now()
    const live = []
    const lapsed = []
    for (const g of all) {
      if (g.expires_at && new Date(g.expires_at).getTime() < now) lapsed.push(g.id)
      else live.push(g)
    }
    if (lapsed.length) {
      supabase.from('gifts').update({ status: 'expired' }).in('id', lapsed)
        .then(null, e => console.error('[gifts] expiry sweep failed:', e))
    }

    // Sender names in a second query — the FK name is ambiguous on this table,
    // the same reason guild invitations and chat resolve theirs separately.
    const senderIds = [...new Set(live.map(g => g.from_user_id))]
    let names = {}
    if (senderIds.length) {
      const { data: senders } = await supabase
        .from('players').select('id, username').in('id', senderIds)
      names = Object.fromEntries((senders || []).map(s => [s.id, s.username]))
    }

    giftState.inbox = live.map(g => ({
      ...g,
      senderName: names[g.from_user_id] || 'Someone',
      itemName: g.items ? g.items.name : (g.cosmetic_id || 'Gift'),
      expiresInDays: Math.max(0, Math.ceil((new Date(g.expires_at) - now) / 86400000))
    }))
    giftState.inboxCount = giftState.inbox.length
    giftState.loaded = true
    return giftState.inbox
  }

  async accept(giftId) {
    const { data: gift } = await supabase.from('gifts').select('*').eq('id', giftId).maybeSingle()
    if (!gift) throw new Error('Gift not found')

    if (gift.item_id) {
      await inventoryService.grant(AppState.user.id, gift.item_id, gift.quantity || 1)
    } else if (gift.cosmetic_type && gift.cosmetic_id) {
      const { cosmeticUnlockService } = await import('./CosmeticUnlockService.js')
      await cosmeticUnlockService.unlock(gift.cosmetic_type, gift.cosmetic_id)
    }

    await supabase.from('gifts')
      .update({ status: 'accepted', claimed_at: new Date().toISOString() })
      .eq('id', giftId)

    await this.addFriendshipPoints(AppState.user.id, 10, 'received')

    giftState.inbox = giftState.inbox.filter(g => g.id !== giftId)
    giftState.inboxCount = giftState.inbox.length
  }

  async decline(giftId) {
    await supabase.from('gifts').update({ status: 'declined' }).eq('id', giftId)
    giftState.inbox = giftState.inbox.filter(g => g.id !== giftId)
    giftState.inboxCount = giftState.inbox.length
  }

  // Ports gift_addFriendshipPoints().
  //
  // LEGACY BUG: it decides which counter to bump with `userId === currentUser.id`
  // — but BOTH call sites pass `currentUser.id` (the sender credits themselves
  // on send, the recipient credits themselves on accept), so the
  // `userId !== currentUser.id` branch is unreachable and
  // `friendship_points.gifts_received` has never been incremented for anyone.
  // Which counter to move is passed in explicitly here.
  async addFriendshipPoints(userId, points, kind) {
    try {
      const { data: existing } = await supabase
        .from('friendship_points').select('*').eq('user_id', userId).maybeSingle()
      if (existing) {
        await supabase.from('friendship_points').update({
          total_points: (existing.total_points || 0) + points,
          gifts_sent: (existing.gifts_sent || 0) + (kind === 'sent' ? 1 : 0),
          gifts_received: (existing.gifts_received || 0) + (kind === 'received' ? 1 : 0)
        }).eq('user_id', userId)
      } else {
        await supabase.from('friendship_points').insert({
          user_id: userId,
          total_points: points,
          gifts_sent: kind === 'sent' ? 1 : 0,
          gifts_received: kind === 'received' ? 1 : 0
        })
      }
    } catch (e) {
      console.error('[gifts] friendship points update failed:', e)
    }
  }

  // Cheap count for the navbar/home badge, without pulling the whole inbox.
  async refreshCount() {
    if (!AppState.user) return 0
    const { count } = await supabase
      .from('gifts').select('id', { count: 'exact', head: true })
      .eq('to_user_id', AppState.user.id)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
    giftState.inboxCount = count || 0
    return giftState.inboxCount
  }
}

export const giftService = new GiftService()

import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { playerService } from './PlayerService.js'
import { notificationService } from './NotificationService.js'
import { awardService } from './AwardService.js'
import { cosmeticUnlockService } from './CosmeticUnlockService.js'
import { skinKeyService } from './SkinKeyService.js'
import { REFERRAL_MILESTONES, REFERRER_PP, REFEREE_PP } from '../data/referralData.js'

function generateReferralCode(username) {
  let base = username.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8)
  while (base.length < 6) base += Math.floor(Math.random() * 10)
  base += Math.floor(Math.random() * 90 + 10)
  return base
}

class ReferralService {
  // Ports showReferralModal()'s data-fetch half, game.js:27985-28074 (the
  // rendering half becomes ReferralModal markup instead of DOM-built HTML).
  async getOrCreateReferral(userId) {
    const { data: player, error } = await supabase
      .from('players')
      .select('username, referral_code, referral_count')
      .eq('id', userId)
      .single()
    if (error) throw error

    let code = player.referral_code
    if (!code) {
      code = generateReferralCode(player.username)
      await supabase.from('players').update({ referral_code: code }).eq('id', userId)
    }

    return {
      // Built from the running origin, as legacy does
      // (`window.location.origin + window.location.pathname + '?ref='`), rather
      // than a hardcoded domain — the previous literal here was
      // `https://pawketpets.vt`, which is not the site's address.
      link: window.location.origin + window.location.pathname + '?ref=' + code,
      count: player.referral_count || 0,
      code
    }
  }

  // Grants any referral milestone this player has reached but not yet been
  // given. Runs for the signed-in player, which is the only account whose
  // badges/titles/keys this session is allowed to write — see the note in
  // processPendingReferral about why the referrer can't be paid inline.
  //
  // Idempotent: awardBadge / awardPlayerTitle short-circuit on anything already
  // held, and the skin keys are gated on a `player_unlocks` marker so a
  // milestone can't pay twice.
  async claimPendingMilestones() {
    if (!AppState.user) return
    try {
      const { data: player } = await supabase
        .from('players').select('referral_count').eq('id', AppState.user.id).maybeSingle()
      const count = (player && player.referral_count) || 0
      if (!count) return

      for (const m of REFERRAL_MILESTONES) {
        if (count < m.count) continue
        if (m.badge) await awardService.awardBadge(m.badge)
        if (m.title) await awardService.awardPlayerTitle(m.title, `${m.count} referrals`)
        // The cosmetic profile frame, unblocked by the cosmetic-unlock port.
        if (m.frame) await cosmeticUnlockService.unlock('frame', m.frame)
        if (m.skinKeys > 0) {
          const key = 'referral_milestone_' + m.count
          const { data: already } = await supabase
            .from('player_unlocks').select('unlock_key')
            .eq('user_id', AppState.user.id).eq('unlock_key', key).maybeSingle()
          if (already) continue
          const ok = await skinKeyService.grant(m.skinKeys, key)
          if (ok) {
            await supabase.from('player_unlocks').upsert(
              { user_id: AppState.user.id, unlock_key: key, unlocked_at: new Date().toISOString() },
              { onConflict: 'user_id,unlock_key' }
            )
          }
        }
      }
    } catch (e) {
      console.error('[referral] milestone claim failed:', e)
    }
  }

  // Where the player sits on the milestone ladder, and how far to the next one.
  //
  // LEGACY BUG this port avoids: loadReferralData() — the Home card's own
  // loader — selects `referrals_count`, while showReferralModal() selects
  // `referral_count`. Only one column exists, and it is `referral_count`
  // (Phase 6's Stats page reads it and was verified working). A select naming a
  // column that does not exist returns an error, and loadReferralData checks
  // `if (!player) return` BEFORE it checks the error — so it bails silently and
  // never sets `display:block`. **The Home referral card has never rendered on
  // the live site**, which is why it wasn't in the list of missing sections.
  milestoneProgress(count) {
    const next = REFERRAL_MILESTONES.find(m => m.count > count) || null
    let prev = null
    for (let i = REFERRAL_MILESTONES.length - 1; i >= 0; i--) {
      if (REFERRAL_MILESTONES[i].count <= count) { prev = REFERRAL_MILESTONES[i]; break }
    }
    const from = prev ? prev.count : 0
    const pct = next
      ? Math.round(((count - from) / Math.max(1, next.count - from)) * 100)
      : 100
    return { next, prev, pct: Math.max(0, Math.min(100, pct)) }
  }

  // ── Crediting a referral ──────────────────────────────────────────────────
  //
  // This half was DROPPED, not deferred. On the deployed site `checkReferralCode()`
  // ran from showApp() (main:2132) and `processReferral()` ran right after a
  // first pet adoption (main:3205) — both inside blocks Phase 1/6.75 deleted as
  // "migrated shell". Nothing in the Vue app has consumed `?ref=` since, so the
  // Home referral card could show a link and a milestone ladder that no signup
  // could ever advance. Restored here.
  //
  // Legacy ran TWO crediting paths at once, which is where the conflicting
  // reward figures came from:
  //   • processReferral() — finds the referrer by `referral_code`, awards the
  //     referrer 250 PP, increments `referral_count`, notifies. Referee got 0.
  //   • initReferralSystem() — separately fired `referral_increment` with the
  //     referrer's USERNAME, while the links it generated used the username too.
  // A third path (initReferralSystem_old / awardReferralRewards, 200 + 100 PP
  // with milestones) was already dead code.
  //
  // This port keeps ONE path, code-based, and pays the figures the card
  // actually shows the player — 200 to the referrer and 100 to the referee (see
  // referralData.js). The card is the only promise a player could have read;
  // paying 250/0 instead would make the page lie about its own rewards.
  capturePendingCode() {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const code = params.get('ref')
    if (!code) return
    try {
      localStorage.setItem('pendingReferralCode', code)
    } catch { /* private mode — the referral is simply lost, as in legacy */ }
  }

  pendingCode() {
    try { return localStorage.getItem('pendingReferralCode') } catch { return null }
  }

  clearPendingCode() {
    try { localStorage.removeItem('pendingReferralCode') } catch { /* private mode */ }
  }

  // Called once the new player adopts their first pet, matching legacy's
  // trigger point. Returns the referrer's username when a referral was credited,
  // null otherwise. Never throws — a failed referral must not break adoption.
  async processPendingReferral() {
    const code = this.pendingCode()
    if (!code || !AppState.user) return null

    try {
      const { data: referrer } = await supabase
        .from('players')
        .select('id, username, referral_count')
        .eq('referral_code', code)
        .maybeSingle()

      if (!referrer || referrer.id === AppState.user.id) {
        this.clearPendingCode()
        return null
      }

      // Legacy's live path had NO already-referred guard — it only removed the
      // localStorage key, so re-setting that key credited the same referrer
      // again. The guard below is from the dead `_old` path, which had it right.
      const { data: me, error: meErr } = await supabase
        .from('players')
        .select('referred_by')
        .eq('id', AppState.user.id)
        .maybeSingle()

      if (!meErr && me && me.referred_by) {
        this.clearPendingCode()
        return null
      }

      if (!meErr) {
        await supabase.from('players')
          .update({ referred_by: referrer.id })
          .eq('id', AppState.user.id)
      }

      const newCount = (referrer.referral_count || 0) + 1
      await supabase.from('players')
        .update({ referral_count: newCount })
        .eq('id', referrer.id)

      // Ports grantReferralMilestone(). Badges, titles and skin keys are all
      // migrated as of Phase 9.5, so a milestone now actually pays out.
      //
      // NOTE: these grant to the REFERRER, who is a different user, and every
      // award path here is scoped to `auth.uid()` — so they cannot be issued
      // from this session. The milestone is recorded by the incremented
      // `referral_count`; `claimPendingMilestones()` below hands them over the
      // next time that player is the one signed in — including the cosmetic
      // frame, which is live as of the cosmetic-unlock port.


      // Cross-user award needs the dedicated RPC; the referee uses their own.
      await supabase.rpc('award_pp_to_user_secure', {
        p_target_user_id: referrer.id,
        p_amount: REFERRER_PP,
        p_reason: 'referral_award'
      })
      await playerService.awardPoints(REFEREE_PP, 'referral_welcome')

      await notificationService.create(
        referrer.id, 'referral', '🎁 New Referral!',
        'Someone joined PawketPets with your link! +' + REFERRER_PP + ' PP',
        'tab:home'
      ).catch(() => {})

      this.clearPendingCode()
      return referrer.username
    } catch (e) {
      console.error('[referral] crediting failed:', e)
      return null
    }
  }
}

export const referralService = new ReferralService()

// Read at module load so the query string can be captured before anything
// strips or replaces it — the visitor signs up some minutes later.
referralService.capturePendingCode()

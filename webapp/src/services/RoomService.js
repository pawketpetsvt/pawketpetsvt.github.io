import { reactive } from 'vue'
import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { furnitureService } from './FurnitureService.js'
import { playerService } from './PlayerService.js'
import { ROOM_SLOTS, ROOM_THEMES, ROOM_BONUS_LABELS, VIBE_MAX } from '../data/roomData.js'

// The PLAYER room — the Housing tab. Ports the room_* family (game.js:22339+).
// One room per account, laid out across seven fixed slots, stored on the player
// row itself. See roomData.js for how this differs from the per-pet rooms.
export const roomState = reactive({
  layout: { slots: {}, theme: 'cottage' },
  loaded: false,
  // Themes this player has bought. Server-side (players.room_themes_unlocked)
  // rather than legacy's localStorage — see setTheme().
  unlocked: ['cottage'],
  // Bonuses from whatever is currently placed. Legacy stashed these in a
  // module-level `_roomActiveBonuses` for other systems to read — see the note
  // on getBonus() below.
  bonuses: {}
})

class RoomService {
  async load() {
    roomState.loaded = false
    await furnitureService.load()

    const res = await supabase.from('players')
      .select('room_layout, room_theme, room_themes_unlocked')
      .eq('id', AppState.user.id)
      .maybeSingle()

    roomState.layout = {
      slots: (res.data && res.data.room_layout) || {},
      theme: (res.data && res.data.room_theme) || 'cottage'
    }
    roomState.unlocked = (res.data && res.data.room_themes_unlocked) || ['cottage']
    roomState.loaded = true
    this.applyBonuses()
  }

  async save() {
    const res = await supabase.from('players').update({
      room_layout: roomState.layout.slots,
      room_theme: roomState.layout.theme
    }).eq('id', AppState.user.id)
    if (res.error) throw new Error('Could not save your room.')
  }

  // ── layout ────────────────────────────────────────────────────────────────
  itemInSlot(slotId, layout = roomState.layout) {
    const id = layout.slots[slotId]
    return id ? furnitureService.byId(id) : null
  }

  isPlaced(furnitureId, layout = roomState.layout) {
    return Object.values(layout.slots).includes(furnitureId)
  }

  // Ports room_placeItem(). Passing null empties the slot, which is also how
  // room_removeSlot() is implemented in legacy.
  async place(slotId, furnitureId) {
    const slots = { ...roomState.layout.slots }
    if (this.isPlaced(furnitureId)) {
      // Remove the furniture from its current slot if it's already placed
      for (const [existingSlotId, existingFurnitureId] of Object.entries(slots)) {
        if (existingFurnitureId === furnitureId) {
          delete slots[existingSlotId]
          break
        }
      }
    }
    if (furnitureId) slots[slotId] = furnitureId
    else delete slots[slotId]
    roomState.layout = { ...roomState.layout, slots }
    await this.save()
    this.applyBonuses()
  }

  // ── themes ────────────────────────────────────────────────────────────────
  isThemeUnlocked(key) {
    const theme = ROOM_THEMES[key]
    if (!theme) return false
    return theme.price === 0 || roomState.unlocked.includes(key)
  }

  // Ports room_setTheme(), but not its storage.
  //
  // Legacy kept the unlock list in localStorage, so clearing site data made a
  // player re-pay for a theme they already owned. It also charged and switched
  // in two separate steps, which could take the PP and then fail to apply.
  //
  // `unlock_room_theme_secure` does both in one transaction and owns the price
  // list itself — the client only names a theme, so the price can't be
  // tampered with — and it re-checks ownership server-side, so a second click
  // can never charge twice.
  async setTheme(key) {
    const theme = ROOM_THEMES[key]
    if (!theme) return null

    const { data, error } = await supabase.rpc('unlock_room_theme_secure', { p_theme: key })
    if (error) throw new Error('Could not change the theme.')
    if (!data || data.success === false) {
      throw new Error((data && data.error) || 'Could not change the theme.')
    }

    if (!roomState.unlocked.includes(key)) roomState.unlocked = [...roomState.unlocked, key]
    roomState.layout = { ...roomState.layout, theme: key }
    // The RPC writes room_theme itself, so there is nothing left to save.
    // The charge is recorded in PP History here: the RPC took the PP itself, so
    // it never passed through spendPoints and would otherwise be invisible to
    // the player — a balance dropping with no matching entry.
    if (data.charged) {
      await playerService.noteExternalSpend(data.charged, 'room_theme', data.points)
    } else if (AppState.player && typeof data.points === 'number') {
      AppState.player.pawketpoints = data.points
    }
    return data.charged || null
  }

  // ── bonuses & vibe ────────────────────────────────────────────────────────
  activeBonuses(layout = roomState.layout) {
    const out = []
    for (const fid of Object.values(layout.slots)) {
      if (!fid) continue
      const item = furnitureService.byId(fid)
      if (item && item.bonus_type && item.bonus_value) {
        const label = (ROOM_BONUS_LABELS[item.bonus_type] || item.bonus_type)
          .replace('{v}', item.bonus_value)
        out.push({ type: item.bonus_type, value: item.bonus_value, label, itemName: item.name })
      }
    }
    return out
  }

  applyBonuses() {
    const totals = {}
    for (const b of this.activeBonuses()) {
      totals[b.type] = (totals[b.type] || 0) + b.value
    }
    roomState.bonuses = totals
  }

  // Ports room_getBonus().
  //
  // LEGACY GAP worth recording: room_getBonus() is defined and never called
  // anywhere in game.js, so every room bonus — battle XP, expedition PP, extra
  // fishing casts, minigame PP, ingredient drops, energy regen — is displayed as
  // "Active" while affecting nothing at all. Ported here so the seam exists and
  // reads correctly, but nothing consumes it yet either; wiring each one into
  // its own system is a behaviour change per system, not part of this port.
  getBonus(type) {
    return roomState.bonuses[type] || 0
  }

  // Ports room_calcVibeScore() — furniture with a real bonus is worth more, and
  // the total is capped.
  vibeScore(layout = roomState.layout) {
    let score = 0
    for (const fid of Object.values(layout.slots)) {
      if (!fid) continue
      const item = furnitureService.byId(fid)
      if (item) score += (item.happiness_bonus || 1) + (item.bonus_value ? 3 : 0)
    }
    return Math.min(VIBE_MAX, score)
  }

  vibeStars(score) {
    const stars = Math.round((score / VIBE_MAX) * 5)
    return '⭐'.repeat(stars) + '☆'.repeat(5 - stars)
  }

  // ── visiting ──────────────────────────────────────────────────────────────
  // Ports room_visitPlayer()'s data half. Legacy swapped the visitor's layout
  // into the shared _roomState, rendered, then swapped it back — a read-only
  // view is just a different layout object here, so nothing is mutated.
  async loadVisitorRoom(username) {
    await furnitureService.loadCatalog()
    const res = await supabase.from('players')
      .select('id, username, room_layout, room_theme')
      .eq('username', username)
      .maybeSingle()
    if (!res.data) return null
    return {
      username: res.data.username,
      layout: {
        slots: res.data.room_layout || {},
        theme: res.data.room_theme || 'cottage'
      }
    }
  }

  // Ports room_share(). The link now points at a route that actually exists —
  // legacy's room_checkUrlHash() (the handler for `#room/<username>`) is defined
  // and never called anywhere, so every shared room link on the live site opens
  // the home page instead of the room.
  shareUrl(username) {
    return `${window.location.origin}${window.location.pathname}#/room/${encodeURIComponent(username)}`
  }

  slots() {
    return ROOM_SLOTS
  }
}

export const roomService = new RoomService()

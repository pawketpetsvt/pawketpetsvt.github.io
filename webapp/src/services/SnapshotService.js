import { supabase } from './SupabaseService.js'
import { AppState } from '../AppState.js'
import { weatherService } from './WeatherService.js'
import { scrapbookService } from './ScrapbookService.js'
import { awardService } from './AwardService.js'
import { getPetMood } from '../utils/petMood.js'
import { evolutionStage } from '../utils/petSkills.js'
import { getEvolutionEmoji, getEvolutionStageName } from '../utils/petCard.js'
import { PET_VARIANTS, BASIC_VARIANTS, PET_BACKSTORIES } from '../data/petCardData.js'

// Ports screenshot_generate() (game.js:38545-38905) — the shareable pet card
// behind the "📸 Snapshot" button on every pet card.
//
// That button has been emitting into nothing since the Phase 7 pet-card rebuild;
// this is the handler it was waiting for. Everything is drawn onto a canvas and
// handed back as a blob URL.
const W = 600
const H = 820

const RARITY_COLORS = {
  common: '#8e8e8e', uncommon: '#5cb85c', rare: '#5bc0de',
  epic: '#9c27b0', legendary: '#ff9800'
}

const TYPE_EMOJI = {
  fire: '🔥', water: '💧', grass: '🌿', electric: '⚡', ice: '❄️', normal: '⭐'
}

// Legacy's fallback chain for a pet's portrait.
const NAME_MAP = {
  Ember: 'ember.png', Pyxie: 'pyxie.png', Steve: 'cowbee.png', Kleat: 'kelta.png',
  Blushimia: 'blushimia.png', Cypurr: 'cy.png', Aria: 'aria.png',
  Jess: 'jess.png', Gnarly: 'gnarly.png'
}

function darken(hex, amt) {
  try {
    const n = parseInt(hex.replace('#', ''), 16)
    const r = Math.max(0, (n >> 16) - Math.round(255 * amt))
    const g = Math.max(0, ((n >> 8) & 0xff) - Math.round(255 * amt))
    const b = Math.max(0, (n & 0xff) - Math.round(255 * amt))
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)
  } catch { return hex }
}

function lighten(hex, amt) {
  try {
    const n = parseInt(hex.replace('#', ''), 16)
    const r = Math.min(255, (n >> 16) + Math.round(255 * amt))
    const g = Math.min(255, ((n >> 8) & 0xff) + Math.round(255 * amt))
    const b = Math.min(255, (n & 0xff) + Math.round(255 * amt))
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)
  } catch { return hex }
}

function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

class SnapshotService {
  async gather(petId) {
    const petRes = await supabase.from('user_pets').select('*').eq('id', petId).single()
    if (petRes.error || !petRes.data) throw new Error('Pet not found')
    const pet = petRes.data

    const [ownerRes, speciesRes, equipRes, passRes, memory] = await Promise.all([
      supabase.from('players').select('username').eq('id', pet.user_id).single(),
      supabase.from('pets').select('name, image_file, special_skill').eq('id', pet.pet_id).single(),
      supabase.from('player_equipment')
        .select('equipped_slot, equipment(name, rarity)')
        .eq('user_id', pet.user_id).eq('pet_id', petId).eq('is_equipped', true),
      supabase.from('user_pass_progress').select('level').eq('user_id', pet.user_id).maybeSingle(),
      scrapbookService.latest(petId)
    ])

    let petTitle = null
    if (pet.active_pet_title_id) {
      const { data } = await supabase.from('pet_titles')
        .select('display_name, icon, rarity').eq('id', pet.active_pet_title_id).maybeSingle()
      petTitle = data || null
    }

    return {
      pet,
      owner: ownerRes.data || {},
      species: speciesRes.data || {},
      equips: equipRes.data || [],
      passLevel: (passRes.data && passRes.data.level) || 1,
      memory,
      petTitle
    }
  }

  // Ports the whole canvas composition. Returns { url, fileName, tagline }.
  async generate(petId) {
    const { pet, owner, species, equips, passLevel, memory, petTitle } = await this.gather(petId)

    const petName = pet.nickname || species.name || 'Pet'
    const petType = species.name || pet.pet_type || 'Pet'
    const petLevel = pet.level || 1

    // LEGACY INCONSISTENCY: the snapshot hardcodes its own thresholds here
    // (Adult at 20, Teen at 10) while the game's real evolutionStage() uses 10
    // and 5. So a level-12 pet is an Adult everywhere in the game and a Teen on
    // its own shareable card. The shared helpers are used instead, which is also
    // what the pet card beside it renders.
    const evo = evolutionStage(petLevel)
    const stage = getEvolutionStageName(evo)
    const stageEmoji = getEvolutionEmoji(evo)

    const mood = getPetMood(
      pet.hunger, pet.energy, pet.happiness,
      pet.max_hunger, pet.max_energy, pet.max_happiness
    )

    const weather = weatherService.currentId()
    const weatherDef = weatherService.byId(weather)
    const season = scrapbookService.season()

    const variantKey = pet.current_variant || null
    const variantDef = variantKey ? (PET_VARIANTS[variantKey] || BASIC_VARIANTS[variantKey]) : null
    const variantColor = variantDef ? variantDef.color : null

    const gradA = variantColor || '#667eea'
    const gradB = variantColor ? darken(variantColor, 0.4) : '#764ba2'
    const gradC = variantColor ? lighten(variantColor, 0.3) : '#9966ff'

    const weapon = equips.find(e => e.equipped_slot === 'weapon' && e.equipment)
    const armor = equips.find(e => e.equipped_slot === 'armor' && e.equipment)

    const battlesWon = pet.battles_won || 0
    const totalBattle = pet.total_battles || 0
    const winRate = totalBattle > 0 ? Math.round(battlesWon / totalBattle * 100) : 0

    const titleText = petTitle
      ? `${petTitle.icon || ''} ${petTitle.display_name || ''}`.trim() : ''
    const titleColor = petTitle ? (RARITY_COLORS[petTitle.rarity] || '#9966ff') : '#9966ff'
    const typeEmoji = TYPE_EMOJI[pet.pet_type] || '🐾'

    const maxHP = Math.max(1, pet.max_hp || pet.base_hp || 60)
    const hpPct = Math.min(1, (pet.current_hp ?? pet.base_hp ?? 60) / maxHP)

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, W, H)
    bg.addColorStop(0, gradA)
    bg.addColorStop(0.5, gradB)
    bg.addColorStop(1, gradC)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // Sparkles
    ctx.save()
    ctx.globalAlpha = 0.12
    ctx.fillStyle = '#ffffff'
    ctx.font = '18px serif'
    ctx.textAlign = 'center'
    for (const [x, y] of [[60, 60], [180, 35], [420, 55], [540, 80], [30, 200], [570, 180],
      [90, 400], [510, 380], [150, 650], [450, 630], [280, 790], [80, 760], [520, 750]]) {
      ctx.fillText('✦', x, y)
    }
    ctx.restore()

    // Card panel + header strip
    ctx.fillStyle = 'rgba(255,255,255,0.96)'
    ctx.fillRect(24, 24, W - 48, H - 48)
    const hdr = ctx.createLinearGradient(24, 24, W - 24, 160)
    hdr.addColorStop(0, gradA + 'ee')
    hdr.addColorStop(1, gradB + 'cc')
    ctx.fillStyle = hdr
    ctx.fillRect(24, 24, W - 48, 160)

    // Portrait, with legacy's path fallback chain
    const paths = []
    if (species.image_file) paths.push('/images/' + species.image_file)
    if (NAME_MAP[petType]) paths.push('/images/pets/' + NAME_MAP[petType])
    paths.push('/images/pets/' + petType.toLowerCase() + '.png')
    paths.push('/images/pets/' + petType.toLowerCase() + '.gif')

    let img = null
    for (const p of paths) {
      img = await loadImage(p)
      if (img) break
    }

    if (img) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(W / 2, 120, 72, 0, Math.PI * 2)
      ctx.closePath()
      ctx.shadowColor = variantColor || '#9966ff'
      ctx.shadowBlur = 20
      ctx.clip()
      ctx.drawImage(img, W / 2 - 72, 48, 144, 144)
      ctx.restore()
      ctx.shadowBlur = 0
    } else {
      const g = ctx.createRadialGradient(W / 2, 120, 0, W / 2, 120, 72)
      g.addColorStop(0, gradC)
      g.addColorStop(1, gradA)
      ctx.save()
      ctx.beginPath()
      ctx.arc(W / 2, 120, 72, 0, Math.PI * 2)
      ctx.closePath()
      ctx.fillStyle = g
      ctx.fill()
      ctx.restore()
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.font = 'bold 56px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(petName.charAt(0).toUpperCase(), W / 2, 142)
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(W / 2, 120, 73, 0, Math.PI * 2)
    ctx.stroke()

    if (variantDef) {
      ctx.fillStyle = variantColor
      ctx.fillRect(420, 32, 150, 34)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 15px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(`${variantDef.icon} ${variantDef.name}`, 495, 54)
    }

    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillRect(28, 32, 100, 30)
    ctx.fillStyle = '#ffffff'
    ctx.font = '13px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`${stageEmoji} ${stage}`, 78, 52)

    ctx.fillStyle = '#1a1a2e'
    ctx.font = 'bold 34px Arial'
    ctx.fillText(petName.length > 20 ? petName.slice(0, 17) + '…' : petName, W / 2, 220)

    if (titleText) {
      ctx.fillStyle = titleColor
      ctx.font = 'bold 16px Arial'
      ctx.fillText(titleText, W / 2, 244)
    }

    ctx.fillStyle = '#f0ecff'
    ctx.fillRect(190, 256, 220, 30)
    ctx.fillStyle = '#5a3fa0'
    ctx.font = '14px Arial'
    ctx.fillText(`${typeEmoji} ${petType}  •  Lv. ${petLevel}`, W / 2, 276)

    const bits = [
      weatherDef ? `${weatherDef.icon} ${weatherDef.name}` : '',
      season ? `${season.icon} ${season.name}` : ''
    ].filter(Boolean).join(' · ')
    ctx.fillStyle = '#888'
    ctx.font = '13px Arial'
    ctx.fillText(
      `${mood.emoji} ${mood.mood}  |  🎮 Lv.${passLevel}${bits ? '  |  ' + bits : ''}`,
      W / 2, 300
    )

    ctx.strokeStyle = '#e0d5ff'
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(40, 316); ctx.lineTo(W - 40, 316); ctx.stroke()

    ctx.fillStyle = gradA
    ctx.font = 'bold 13px Arial'
    ctx.textAlign = 'left'
    ctx.fillText('BATTLE STATS', 40, 340)

    const stats = [
      { label: 'HP', val: `${pet.current_hp ?? pet.base_hp ?? 30}/${pet.max_hp || pet.base_hp || 30}`, icon: '❤️', x: 80 },
      { label: 'ATK', val: pet.base_attack || 5, icon: '⚔️', x: 220 },
      { label: 'DEF', val: pet.base_defense || 3, icon: '🛡️', x: 360 },
      { label: 'SPD', val: pet.base_speed || 4, icon: '💨', x: 500 }
    ]
    for (const s of stats) {
      const y = 390
      ctx.fillStyle = '#f4f0ff'
      ctx.fillRect(s.x - 56, y - 30, 112, 50)
      ctx.textAlign = 'center'
      ctx.fillStyle = '#333'
      ctx.font = 'bold 14px Arial'
      ctx.fillText(s.icon, s.x, y - 10)
      ctx.font = '12px Arial'
      ctx.fillStyle = '#666'
      ctx.fillText(s.label, s.x, y + 4)
      ctx.font = 'bold 15px Arial'
      ctx.fillStyle = '#1a1a2e'
      ctx.fillText(String(s.val), s.x, y + 20)
    }

    ctx.fillStyle = '#eee'
    ctx.fillRect(40, 420, W - 80, 12)
    ctx.fillStyle = hpPct > 0.6 ? '#4ade80' : hpPct > 0.3 ? '#fbbf24' : '#ff6b6b'
    ctx.fillRect(40, 420, (W - 80) * hpPct, 12)
    ctx.fillStyle = '#888'
    ctx.font = '10px Arial'
    ctx.textAlign = 'right'
    ctx.fillText(Math.round(hpPct * 100) + '% HP', W - 40, 418)

    ctx.fillStyle = '#555'
    ctx.font = '13px Arial'
    ctx.textAlign = 'left'
    ctx.fillText(`⚔️ ${battlesWon}W  /  ${totalBattle} Battles  •  ${winRate}% Win Rate`, 40, 456)

    ctx.fillStyle = gradA
    ctx.font = 'bold 13px Arial'
    ctx.fillText('EQUIPMENT', 40, 480)
    ctx.fillStyle = '#444'
    ctx.font = '13px Arial'
    const weaponText = weapon && weapon.equipment ? '⚔️ ' + weapon.equipment.name : '⚔️ None'
    const armorText = armor && armor.equipment ? '🛡️ ' + armor.equipment.name : '🛡️ None'
    ctx.fillText(weaponText + '   ' + armorText, 40, 498)

    ctx.strokeStyle = '#e0d5ff'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(40, 514); ctx.lineTo(W - 40, 514); ctx.stroke()

    if (memory) {
      ctx.fillStyle = '#fdf6ff'
      ctx.fillRect(40, 522, W - 80, 52)
      ctx.strokeStyle = '#d4b8ff'
      ctx.lineWidth = 1.2
      ctx.strokeRect(40, 522, W - 80, 52)
      ctx.fillStyle = '#7a5ca0'
      ctx.font = 'italic 13px Arial'
      ctx.textAlign = 'center'
      const t = memory.length > 72 ? memory.slice(0, 69) + '…' : memory
      ctx.fillText('💭 ' + t, W / 2, 553)
    }

    const backstory = PET_BACKSTORIES[petType] || ''
    if (backstory) {
      ctx.fillStyle = '#888'
      ctx.font = 'italic 12px Arial'
      ctx.textAlign = 'center'
      const t = backstory.length > 80 ? backstory.slice(0, 77) + '…' : backstory
      ctx.fillText(t, W / 2, memory ? 596 : 534)
    }

    const footerY = 660
    ctx.strokeStyle = '#e0d5ff'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(40, footerY); ctx.lineTo(W - 40, footerY); ctx.stroke()

    ctx.fillStyle = '#aaa'
    ctx.font = '13px Arial'
    ctx.textAlign = 'left'
    ctx.fillText('👤 ' + (owner.username || 'Trainer'), 40, footerY + 22)
    ctx.textAlign = 'right'
    ctx.fillText('📅 ' + new Date().toLocaleDateString(), W - 40, footerY + 22)

    const ft = ctx.createLinearGradient(24, footerY + 36, W - 24, H - 24)
    ft.addColorStop(0, gradA + 'dd')
    ft.addColorStop(1, gradB + 'dd')
    ctx.fillStyle = ft
    ctx.fillRect(24, footerY + 36, W - 48, H - (footerY + 36) - 24)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('🐾 PawketPetsVT', W / 2, footerY + 64)
    ctx.font = '11px Arial'
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    // Legacy prints `pawketpetsvt.com`, which is not this site's address — the
    // same wrong-domain slip as the referral links. Derived from the origin.
    ctx.fillText(window.location.host, W / 2, footerY + 82)

    const variantLabel = variantDef ? variantDef.name + ' ' : ''
    const tagline = `I just raised my ${variantLabel}${petName} to Level ${petLevel}! 🐾 #PawketPets #VTuber`

    const url = await new Promise(resolve => {
      canvas.toBlob(blob => resolve(URL.createObjectURL(blob)), 'image/png')
    })

    return {
      url,
      fileName: petName.replace(/[^a-zA-Z0-9]/g, '_') + '_snapshot.png',
      tagline
    }
  }

  // Ports the badge half of screenshot_showModal(). Legacy counts snapshots in
  // localStorage and tests `=== 1` / `=== 5`, so clearing site data re-arms the
  // first badge and a skipped count loses the second permanently — the same
  // strict-equality family as the battle win milestones. Counted the same way
  // (there is no server-side record of snapshots) but compared with `>=`, and
  // awardBadge is idempotent so nothing is granted twice.
  recordShare() {
    // Ports fulfillSnapshotWish() — a pet can wish for a glamour shot.
    import('./PetMoodService.js')
      .then(m => m.petMoodService.completeWishAll('take_snapshot'))
      .catch(() => {})
    const key = 'screenshots_shared_' + (AppState.user ? AppState.user.id : 'guest')
    let count = 0
    try {
      count = parseInt(localStorage.getItem(key), 10) || 0
      count += 1
      localStorage.setItem(key, String(count))
    } catch {
      count = 1
    }
    if (count >= 1) awardService.awardBadge('snapshot_moment')
    if (count >= 5) awardService.awardBadge('social_butterfly')
    return count
  }
}

export const snapshotService = new SnapshotService()

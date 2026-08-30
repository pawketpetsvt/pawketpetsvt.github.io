<template>
  <PetModal title="📚 Quick Guide" width="520px" @close="$emit('close')">
    <section v-for="section in SECTIONS" :key="section.title" class="mb-3">
      <div class="qg-heading mb-px6">{{ section.title }}</div>
      <div class="qg-body">
        <p v-for="(line, i) in section.lines" :key="i" class="m-0" v-html="line"></p>
      </div>
    </section>
  </PetModal>
</template>

<script setup>
import PetModal from './pet/PetModal.vue'
import { DAILY_XP_CAPS } from '../data/passData.js'
import { BINGO_SQUARE_XP, BINGO_LINE_XP, BINGO_BLACKOUT_XP } from '../data/bingoData.js'

// Ports showHelpModal() (game.js:16547) — the navbar's ❓ button.
//
// Legacy hardcodes every number in this copy as literal text, so the guide
// silently goes stale the moment a cap or a reward is retuned. The figures that
// have a single source of truth in the app are interpolated from it instead:
// the Pass daily caps and the three Bingo XP awards. Anything still written out
// (the racing payout curve, the PP sources) has no constant to point at.
defineEmits(['close'])

const SECTIONS = [
  {
    title: '🐾 Pet Stats',
    lines: [
      '<b>❤️ HP</b>: Health Points. Carries between battles! Heal with potions or wait for regen.',
      '<b>⚔️ Attack</b>: Battle damage dealt. Increase via level-ups &amp; weapons.',
      '<b>🛡️ Defense</b>: Damage reduction. Increase via level-ups &amp; armor.',
      '<b>💨 Speed</b>: Turn order in battles &amp; race performance. Level up or equip speed gear.'
    ]
  },
  {
    title: '🪙 PawketPoints (PP)',
    lines: [
      'Earn from: Daily login · Battles · Racing · Bingo · PawketPass rewards · Expeditions · Guilds',
      'Spend on: Shop items · Equipment · Furniture · Guild creation'
    ]
  },
  {
    title: '🎫 PawketPass XP Sources',
    lines: [
      `🍖 Feed pets: 2 XP (cap ${DAILY_XP_CAPS.feed}/day)`,
      `🎾 Play with pets: 2 XP (cap ${DAILY_XP_CAPS.play}/day)`,
      `⚔️ Battles: 23 XP win / 5 XP loss (cap ${DAILY_XP_CAPS.battle}/day)`,
      `📅 Daily login: ${DAILY_XP_CAPS.login} XP`,
      `🎯 Bingo square: ${BINGO_SQUARE_XP} XP · Line: ${BINGO_LINE_XP} XP · Blackout: ${BINGO_BLACKOUT_XP} XP`,
      `🌲 Expeditions: 10 XP (cap ${DAILY_XP_CAPS.expedition}/day) · 🏁 Race: 5 XP (cap ${DAILY_XP_CAPS.race}/day)`
    ]
  },
  {
    title: '🌤️ Weather &amp; Events',
    lines: [
      'The badge in the navbar shows today\'s weather — or a world event, when one is running.',
      'Both change what you earn: XP, PP, drop chances, shop prices and energy regen all shift with them.',
      'Hover the badge for the exact bonuses, or click it for the 7-day forecast.'
    ]
  },
  {
    title: '🏁 Racing',
    lines: [
      '1st: Win 1.5×–3× your bet · 2nd: Get your bet back · 3rd: Half bet back · 4th: Lose bet',
      'Higher Speed stat = better odds and bigger wins!'
    ]
  },
  {
    title: '🎯 Daily Bingo',
    lines: [
      'Complete tasks to mark squares. Each gives PP + Pass XP.',
      'Complete a full line for bonus rewards! Blackout for BIG rewards.',
      'Resets daily at midnight.'
    ]
  },
  {
    title: '💡 Tips',
    lines: [
      'Hover any stat (ATK/DEF/SPD/HP) on a pet card for more info.',
      'Furniture bought once works in ALL pet rooms and gives daily happiness.',
      'Guilds unlock Dungeons, treasury perks, and XP boosts for the whole team.'
    ]
  }
]
</script>

<style lang="scss" scoped>
// Legacy wrote this modal as one inline-styled HTML string; there is no
// `.help-*` rule in the global stylesheet, so the component owns its styling.
.qg-heading {
  font-weight: 700;
  color: var(--purple-dark);
  font-size: 0.9rem;
}

.qg-body {
  font-size: 0.82rem;
  color: var(--text-light);
  line-height: 1.7;
}

// Legacy separated these with <br>, which makes every line one paragraph the
// browser cannot space. Real <p> elements carrying `m-0` instead, so the
// `.qg-body` line-height sets the rhythm.
</style>

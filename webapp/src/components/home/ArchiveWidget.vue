<template>
  <!-- Ports #archive-home-widget (index.html:1461 on main). Legacy keeps it at
       `display:none` and reveals it the first time a log drops; here it simply
       does not render until the player owns one. Its absence IS the design —
       nothing should hint the Archive exists before then. -->
  <!-- Single root on purpose. The card and the modal used to sit side by side,
       which made this a fragment — so the `class` the Home page passes down had
       no element to land on and Vue logged an extraneous-attributes warning.
       The wrapper only exists when a log has been found, so nothing renders
       before then either way. -->
  <div v-if="argLogService.revealed">
    <div class="aw-card d-flex align-items-center gap-px14 rounded-4 position-relative overflow-hidden"
      @click="open = true">
      <div class="aw-icon flex-shrink-0">📓</div>
      <div>
        <div class="aw-title">ARCHIVE</div>
        <div class="aw-sub mt-px2">Something has been recovered. Click to view.</div>
      </div>
      <div class="aw-dot position-absolute rounded-circle"></div>
    </div>

    <ArchiveModal v-if="open" @close="open = false" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ArchiveModal from '../ArchiveModal.vue'
import { argLogService } from '../../services/ArgLogService.js'

const open = ref(false)
</script>

<style lang="scss" scoped>
// Legacy styles this entirely inline; only the `archive-pulse` keyframes exist
// in style.css, and the dot below uses them.
.aw-card {
  cursor: pointer;
  background: linear-gradient(135deg, rgba(30, 0, 60, 0.92), rgba(80, 0, 80, 0.85));
  border: 1px solid rgba(153, 102, 255, 0.4);
  // 18px horizontal has no spacer token (the scale steps 16 -> 20), so the
  // shorthand stays rather than drifting to `px-3`.
  padding: 14px 18px;
}

.aw-icon { font-size: 2rem; }

.aw-title {
  font-weight: 700;
  color: #e8d0ff;
  font-size: 0.95rem;
  letter-spacing: 1px;
}

.aw-sub {
  color: rgba(220, 180, 255, 0.75);
  font-size: 0.78rem;
}

.aw-dot {
  top: 10px;
  right: 12px;
  width: 10px;
  height: 10px;
  background: #ff66cc;
  box-shadow: 0 0 8px #ff66cc;
  // `archive-pulse` IS defined in style.css, unlike several other keyframe sets
  // this migration has had to write. Left global deliberately: redeclaring it in
  // this scoped block would make Vue rename it and shadow the real one.
  animation: archive-pulse 2s ease-in-out infinite;
}
</style>

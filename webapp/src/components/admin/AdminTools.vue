<template>
  <!-- Ports the `#admin-panel-section` block at the bottom of the Settings page
       (index.html:3619-3628), which showApp() revealed only for admins. Kept in
       the same place rather than given its own route, so the tools sit exactly
       where they always have. -->
  <div v-if="isAdminRef" class="admin-tools">
    <div class="ad-warn">⚠️ ADMIN CONTROLS: USE WITH CAUTION</div>
    <h3 class="at-heading">⚙️ Admin Tools</h3>
    <div class="d-flex gap-2 flex-wrap">
      <button class="btn btn-primary at-btn at-polls" @click="open = 'polls'">🗳️ Manage Polls</button>
      <button class="btn btn-primary at-btn at-gp" @click="open = 'gp'">🏁 Grand Prix</button>
      <button class="btn btn-primary at-btn at-reports" @click="open = 'reports'">🚩 Player Reports</button>
    </div>

    <AdminPolls v-if="open === 'polls'" @close="open = null" />
    <AdminReports v-if="open === 'reports'" @close="open = null" />
    <GrandPrixAdmin v-if="open === 'gp'" @close="open = null" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { adminService, isAdminRef } from '../../services/AdminService.js'
import AdminPolls from './AdminPolls.vue'
import AdminReports from './AdminReports.vue'
import GrandPrixAdmin from './GrandPrixAdmin.vue'

const open = ref(null)

onMounted(() => adminService.refresh())
</script>

<style lang="scss" scoped>
@import '../../assets/scss/admin.scss';

.admin-tools {
  margin-top: 30px;
  padding-top: 24px;
  border-top: 2px solid var(--border);
}

.at-heading { color: #ff4500; margin-bottom: 10px; }

// The three buttons carry their own gradients in legacy; kept, since they are
// the visual cue that these are destructive-capable controls.
.at-btn { border: none; }
.at-polls { background: linear-gradient(135deg, #ff4500, #ff6b35); }
.at-gp { background: linear-gradient(135deg, #cc0000, #ff4500); }
.at-reports { background: linear-gradient(135deg, #9966ff, #ff66cc); }
</style>

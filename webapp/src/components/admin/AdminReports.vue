<template>
  <PetModal
    title="🚩 Player Reports"
    :subtitle="loading ? '' : `${openCount} open · showing last ${reports.length}`"
    @close="$emit('close')"
  >
    <div v-if="loading" class="spinner"></div>
    <div v-else-if="!reports.length" class="ad-empty">No reports yet.</div>

    <div v-else class="ad-scroll">
      <div
        v-for="r in reports"
        :key="r.id"
        class="ad-report"
        :class="{ open: r.status === 'open' }"
      >
        <div class="d-flex justify-content-between align-items-center mb-1">
          <span class="ad-report-type">{{ REPORT_TYPE_LABELS[r.report_type] || r.report_type }}</span>
          <span class="ad-report-status" :style="{ color: REPORT_STATUS_COLORS[r.status] }">
            {{ r.status }}
          </span>
        </div>
        <div class="ad-report-meta">
          From: {{ (r.players && r.players.username) || 'Unknown' }}<template v-if="r.target_text"> · About: {{ r.target_text }}</template>
          · {{ new Date(r.created_at).toLocaleString() }}
        </div>
        <div class="ad-report-body">{{ r.description }}</div>
        <div class="d-flex gap-1 flex-wrap">
          <button
            v-if="r.status !== 'reviewing'"
            class="btn btn-sm btn-outline"
            :disabled="busy"
            @click="setStatus(r, 'reviewing')"
          >👀 Mark Reviewing</button>
          <button
            v-if="r.status !== 'resolved'"
            class="btn btn-sm btn-outline"
            :disabled="busy"
            @click="setStatus(r, 'resolved')"
          >✅ Resolve</button>
          <button
            v-if="r.status !== 'dismissed'"
            class="btn btn-sm btn-outline ad-danger"
            :disabled="busy"
            @click="setStatus(r, 'dismissed')"
          >🗑️ Dismiss</button>
        </div>
      </div>
    </div>
  </PetModal>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import PetModal from '../pet/PetModal.vue'
import { toastService } from '../../services/ToastService.js'
import {
  adminService, REPORT_TYPE_LABELS, REPORT_STATUS_COLORS
} from '../../services/AdminService.js'

defineEmits(['close'])

const reports = ref([])
const loading = ref(true)
const busy = ref(false)

const openCount = computed(() => reports.value.filter(r => r.status === 'open').length)

async function load() {
  loading.value = true
  try {
    reports.value = await adminService.listReports()
  } catch (e) {
    toastService.error(e.message)
  } finally {
    loading.value = false
  }
}

async function setStatus(report, status) {
  busy.value = true
  try {
    await adminService.setReportStatus(report.id, status)
    // Patch in place rather than refetching the whole list — legacy re-rendered
    // the entire modal, which lost the reader's scroll position every click.
    report.status = status
    toastService.info('Report marked as ' + status)
  } catch (e) {
    toastService.error(e.message)
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
@import '../../assets/scss/admin.scss';
</style>

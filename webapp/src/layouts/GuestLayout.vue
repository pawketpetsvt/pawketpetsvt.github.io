<template>
  <router-view />
  <ToastHost />
  <CenteredModal />
</template>

<script setup>
import ToastHost from '../components/ToastHost.vue'
import CenteredModal from '../components/CenteredModal.vue'
</script>

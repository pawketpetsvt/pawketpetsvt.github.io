<template>
  <div class="page-wrap">
    <div class="welcome-panel" style="padding:10px 16px 8px;margin-bottom:8px;">
      <div style="display:flex;align-items:center;gap:10px;justify-content:center;">
        <img src="/images/logo.png" alt="PawketPetsVT" class="logo-hero" style="width:36px;height:36px;margin:0;" />
        <h1 style="font-size:1.2rem;margin:0;">Welcome to PawketPetsVT!</h1>
      </div>
      <p style="font-size:0.8rem;margin:4px 0 6px;color:var(--text-light);">Adopt virtual pets based on your favourite VTubers, play games, and earn rewards ✨</p>
      <div style="margin-top:6px;display:flex;gap:10px;justify-content:center;">
        <button class="btn btn-primary btn-lg" @click="router.push('/mypets')">My Pets</button>
        <button class="btn btn-secondary btn-lg" @click="router.push('/adopt')">Adopt More</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

/**
 * PawketPetsVT — Cursor Trail (optimised)
 * 
 * Changes from original:
 * - Throttled to max 20 particles/sec (was unlimited)
 * - Particle pool of 30 max — oldest removed when limit hit
 * - requestAnimationFrame for cleanup instead of setTimeout per-particle
 * - Passive event listener (doesn't block scroll)
 * - Skips mobile (pointermove doesn't give trail on touch anyway)
 */
(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────────────
  var MAX_PARTICLES = 30;     // hard cap on DOM nodes
  var THROTTLE_MS   = 50;     // min ms between spawns (~20/sec)
  var LIFE_MS       = 600;    // how long each particle lives

  // Skip on touch-only devices — no cursor to trail
  if (!window.matchMedia('(pointer: fine)').matches) return;

  // ── State ────────────────────────────────────────────────────────────────
  var particles  = [];   // { el, born }
  var lastSpawn  = 0;
  var rafId      = null;

  // ── Particle pool cleanup via single RAF loop ─────────────────────────────
  function cleanupLoop(now) {
    var alive = [];
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var age = now - p.born;
      if (age >= LIFE_MS) {
        // Remove from DOM
        if (p.el.parentNode) p.el.parentNode.removeChild(p.el);
      } else {
        // Fade out proportionally
        p.el.style.opacity = (1 - age / LIFE_MS).toFixed(2);
        alive.push(p);
      }
    }
    particles = alive;
    rafId = particles.length > 0 ? requestAnimationFrame(cleanupLoop) : null;
  }

  // ── Spawn one particle ─────────────────────────────────────────────────────
  function spawn(x, y) {
    var now = performance.now();

    // Throttle
    if (now - lastSpawn < THROTTLE_MS) return;
    lastSpawn = now;

    // Hard cap — evict oldest if over limit
    if (particles.length >= MAX_PARTICLES) {
      var oldest = particles.shift();
      if (oldest.el.parentNode) oldest.el.parentNode.removeChild(oldest.el);
    }

    // Pick emoji — match game's pastel-gothic feel
    var emojis = ['✨','🌸','⭐','💫','🌟','🍃','💜','🩷'];
    var emoji = emojis[Math.floor(Math.random() * emojis.length)];

    var el = document.createElement('div');
    el.textContent = emoji;
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = [
      'position:fixed',
      'left:' + (x - 8) + 'px',
      'top:'  + (y - 8) + 'px',
      'font-size:' + (12 + Math.random() * 8) + 'px',
      'pointer-events:none',
      'user-select:none',
      'z-index:999998',
      'transition:opacity ' + LIFE_MS + 'ms linear',
      'will-change:opacity',
    ].join(';');

    document.body.appendChild(el);
    particles.push({ el: el, born: now });

    // Start cleanup RAF if not already running
    if (!rafId) rafId = requestAnimationFrame(cleanupLoop);
  }

  // ── Listen ────────────────────────────────────────────────────────────────
  document.addEventListener('mousemove', function (e) {
    spawn(e.clientX, e.clientY);
  }, { passive: true });

})();

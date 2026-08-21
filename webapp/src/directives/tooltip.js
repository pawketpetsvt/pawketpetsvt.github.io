let tipEl = null

function show(el, text) {
  hide()
  tipEl = document.createElement('div')
  tipEl.id = 'global-tooltip'
  tipEl.innerHTML = text.replace(/\n/g, '<br>')
  tipEl.style.cssText = 'position:fixed;background:#1a1a2e;color:#e8d5ff;padding:8px 13px;border-radius:10px;font-size:0.78rem;max-width:240px;z-index:100000;border:1px solid #9966ff;box-shadow:0 4px 16px rgba(0,0,0,0.4);pointer-events:none;line-height:1.5;'
  document.body.appendChild(tipEl)
  const r = el.getBoundingClientRect()
  const left = Math.min(r.left, window.innerWidth - 260)
  let top = r.bottom + 8
  if (top + 120 > window.innerHeight) top = r.top - 10 - tipEl.offsetHeight
  tipEl.style.left = Math.max(8, left) + 'px'
  tipEl.style.top = top + 'px'
}

function hide() {
  if (tipEl) { tipEl.remove(); tipEl = null }
}

export const vTooltip = {
  mounted(el, binding) {
    el.addEventListener('mouseover', () => show(el, binding.value))
    el.addEventListener('mouseleave', hide)
    el.addEventListener('touchstart', hide)
  },
  updated(el, binding) {
    el._tooltipText = binding.value
  },
  unmounted() {
    hide()
  }
}

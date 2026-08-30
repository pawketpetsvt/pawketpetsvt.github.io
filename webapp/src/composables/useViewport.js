import { ref } from 'vue'

// One reactive answer to "is this a desktop-width viewport?", shared by every
// component that needs it.
//
// The threshold is Bootstrap's `lg` (992px) because that is where AppShell's
// `d-none d-lg-block` stops showing the two sidebars. Tying the mobile navbar
// and its drawers to the same number is what keeps them in step: the drawers
// exist to carry whatever the layout has just taken away, so they have to
// appear at exactly the width where it is taken away.
//
// It was NOT always the same number, and the gap was a real hole. the global stylesheet
// hides the hamburger at `min-width: 769px`, while the sidebars disappear at
// 992px — so between 769px and 991px the sidebars were gone AND there was no
// hamburger to replace them, leaving no way to reach any page but Home and
// Profile. NavBar's scoped block now overrides that 769px cutoff to match.
export const DESKTOP_MIN_WIDTH = 992

const query = typeof window !== 'undefined'
  ? window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`)
  : null

export const isDesktop = ref(query ? query.matches : true)

if (query) {
  // Module-level and never removed on purpose: this tracks the viewport for the
  // lifetime of the app, not of any one component, and components mount and
  // unmount underneath it as the width changes.
  query.addEventListener('change', e => { isDesktop.value = e.matches })
}

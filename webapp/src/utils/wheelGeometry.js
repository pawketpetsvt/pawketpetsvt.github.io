// Treasure Wheel geometry, kept pure so it can be asserted without a browser.
//
// This has been "fixed" twice and come back both times, so the maths now lives
// here with `wheel-smoke.mjs` proving the two halves agree.
//
// ONE CONVENTION THROUGHOUT: degrees measured CLOCKWISE FROM EAST. That is
// canvas 2D's own convention — `ctx.arc()` starts at the +x axis and, because
// the y axis grows downward, increasing angles sweep clockwise. CSS
// `rotate()` turns the same direction, so the two compose by simple addition.
//
//   East = 0   South = 90   West = 180   NORTH = 270
//
// The pointer is drawn at 12 o'clock, so the target is 270 — not 0/360, which
// is what legacy solved for (main:8605) while drawing the pointer at the top.

// Middle of slice `index`, clockwise from East.
export function sliceMidAngle(index, sliceCount) {
  const sliceDeg = 360 / sliceCount
  return sliceDeg * index + sliceDeg / 2
}

// The rotation to apply so slice `winningIndex` finishes under the pointer.
//
// `turns` MUST be an integer. A fractional value makes `turns * 360` something
// other than a whole number of revolutions, which silently adds a uniformly
// random 0-360 degree offset — legacy's `5 + Math.random() * 3` did exactly
// that, and it is why the wheel awarded a prize unrelated to where it stopped.
export function wheelFinalRotation(winningIndex, sliceCount, turns) {
  if (!Number.isInteger(turns)) {
    throw new Error('wheelFinalRotation: `turns` must be a whole number of revolutions')
  }
  let landing = (270 - sliceMidAngle(winningIndex, sliceCount)) % 360
  if (landing < 0) landing += 360
  return turns * 360 + landing
}

// Which slice ends up under the pointer after rotating by `rotation`.
// The inverse of the above, and what the smoke test checks it against.
export function wheelLandedIndex(rotation, sliceCount) {
  const sliceDeg = 360 / sliceCount
  let a = (270 - rotation) % 360
  if (a < 0) a += 360
  return Math.floor(a / sliceDeg) % sliceCount
}

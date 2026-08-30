// Treasure Wheel: does the prize awarded match the slice the wheel stops on?
//
// This bug shipped twice. The first pass corrected the pointer offset (270 vs
// 360 degrees) but left `turns` fractional, which re-randomised the landing and
// hid the fix. Pure geometry, so it runs under plain Node with no loader hooks.
//
//   node wheel-smoke.mjs
import { WHEEL_PRIZES } from './src/data/minigamesData.js'
import { wheelFinalRotation, wheelLandedIndex, sliceMidAngle } from './src/utils/wheelGeometry.js'

const N = WHEEL_PRIZES.length
const RUNS = 20000
let mismatches = 0

for (let i = 0; i < RUNS; i++) {
  const winningIndex = Math.floor(Math.random() * N)
  const turns = Math.floor(5 + Math.random() * 3)
  const rotation = wheelFinalRotation(winningIndex, N, turns)
  if (wheelLandedIndex(rotation, N) !== winningIndex) mismatches++
}

// Every slice must be reachable, and each must land dead-centre under the
// pointer rather than merely inside its own wedge.
const sliceDeg = 360 / N
let offCentre = 0
for (let i = 0; i < N; i++) {
  const rotation = wheelFinalRotation(i, N, 5)
  let mid = (sliceMidAngle(i, N) + rotation) % 360
  if (mid < 0) mid += 360
  if (Math.abs(mid - 270) > 1e-9) offCentre++
}

// A fractional `turns` is the exact defect this guards; it must be rejected.
let rejectedFractional = false
try {
  wheelFinalRotation(0, N, 5.5)
} catch {
  rejectedFractional = true
}

console.log(`slices: ${N} (${sliceDeg} deg each)   spins: ${RUNS}`)
console.log(`award matches the slice under the pointer: ${(((RUNS - mismatches) / RUNS) * 100).toFixed(1)}%`)
console.log(`slices landing dead-centre under the pointer: ${N - offCentre}/${N}`)
console.log(`fractional turns rejected: ${rejectedFractional}`)

if (mismatches || offCentre || !rejectedFractional) {
  console.error('FAILED — the wheel would pay out a prize it did not land on')
  process.exit(1)
}
console.log('OK — every spin pays the slice it stops on')

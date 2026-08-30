// css-dead.mjs — rules in the global SCSS partials that NOTHING can consume.
//
// A wrong answer here is a silent visual regression that no build step catches,
// so a name must survive three independent checks before it counts as dead:
//
//   1. exact token match across every consumer
//   2. prefix guard, both directions — class names are assembled at runtime all
//      over this app ('gp-' + key, `wk-${stat}`), so `.gp-lane` is live if any
//      consumer merely contains `gp-`
//   3. raw substring search — catches a name built inside any string literal,
//      however it was concatenated
//
// Stage 2 is what took the Phase 6.75 estimate from ~9,300 lines to 58 real
// orphans; stage 3 is the backstop that confirmed all 58.
//
//   node css-dead.mjs              # summary
//   node css-dead.mjs --list       # every dead rule
//   node css-dead.mjs --names      # every dead class name

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCss, tokensOf, splitSelectorList, branchNames, stripComments, tokensInSource } from './css-inventory.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')

// ── consumers ───────────────────────────────────────────────────────────────
// Everything that can put a class onto an element in the deployed app. The
// SCSS files count too: a partial may target a class it does not itself define.
function walk(dir, test, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'dist') walk(p, test, out) }
    else if (test(e.name)) out.push(p)
  }
  return out
}

const consumerFiles = [
  ...walk(path.join(HERE, 'src'), n => /\.(vue|js|ts|scss)$/.test(n)),
  path.join(HERE, 'index.html')
].filter(f => fs.existsSync(f))

// Comments stripped first — this project annotates removed markup by name, and
// a comment saying a class WAS used is evidence it is not.
const sources = consumerFiles.map(f => stripComments(fs.readFileSync(f, 'utf8')))
const blob = sources.join('\n')

const tokens = new Set()
for (const s of sources) for (const t of tokensInSource(s)) tokens.add(t)

// Stage 2, done precisely. A blanket "is any token a prefix of this name"
// guard is useless at this scale — it marks `.pass-info` live merely because
// the token `pass` exists somewhere — so instead collect the prefixes the code
// ACTUALLY concatenates class names from:
//
//   :class="'gp-' + key"        -> a string literal ending in '-'
//   :class="`wk-${stat}`"       -> a template literal's static head
//
// Only names starting with one of those are treated as possibly-dynamic.
const dynPrefixes = new Set()
for (const s of sources) {
  for (const m of s.matchAll(/['"]([a-zA-Z][\w-]*-)['"]/g)) dynPrefixes.add(m[1])
  for (const m of s.matchAll(/`([a-zA-Z][\w-]*-)\$\{/g)) dynPrefixes.add(m[1])
}
const dynList = [...dynPrefixes].filter(p => p.length >= 3)

// Stage 3, the backstop: a strict-boundary search for the whole name anywhere
// in the sources. `blob.includes(name)` is not good enough — it reports `.footer`
// as live on the strength of `site-footer`, and `.card` on `.pet-card`. The name
// must stand alone, and an HTML tag of that name does not count as a class.
const esc = s => s.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&')
function occursStandalone(name) {
  const re = new RegExp(`(?<![\\w-])${esc(name)}(?![\\w-])`, 'g')
  let m
  while ((m = re.exec(blob)) !== null) {
    if (!/<\/?$/.test(blob.slice(Math.max(0, m.index - 2), m.index))) return true
  }
  return false
}

const liveCache = new Map()
function isLive(name) {
  if (liveCache.has(name)) return liveCache.get(name)
  let live = tokens.has(name)                                  // stage 1
  if (!live) live = dynList.some(p => name.startsWith(p))      // stage 2
  if (!live) live = occursStandalone(name)                     // stage 3
  liveCache.set(name, live)
  return live
}

// ── classify ────────────────────────────────────────────────────────────────
// Scans the global partials. Component-scoped blocks are deliberately NOT
// scanned: a rule there is already next to the markup it styles, so "is it
// used" is answerable by reading one file. The risk this tool exists for is a
// global rule outliving its markup, which is how the root style.css grew 6,500
// unreachable lines without anyone noticing.
const SCSS_DIR = path.join(HERE, 'src', 'assets', 'scss')
const partials = fs.readdirSync(SCSS_DIR)
  .filter(f => /^_.*\.scss$/.test(f))
  .map(f => path.join(SCSS_DIR, f))
const css = partials.map(p => fs.readFileSync(p, 'utf8')).join('\n')
const rules = parseCss(css)

const STATE = new Set()
for (const r of rules) {
  for (const m of r.selector.matchAll(/(?:^|[\s,>+~])(?:body|html)((?:\.[-\w]+)+)/g)) {
    for (const c of m[1].split('.').filter(Boolean)) STATE.add(c)
  }
}

// Keyframe names referenced by any surviving declaration, so a @keyframes block
// is never cut while an `animation:` still names it.
const usedKeyframes = new Set()
for (const m of css.matchAll(/animation(?:-name)?\s*:[^;}]+/g)) {
  for (const w of m[0].matchAll(/[A-Za-z_][\w-]*/g)) usedKeyframes.add(w[0])
}
for (const s of sources) {
  for (const m of s.matchAll(/animation(?:-name)?\s*:[^;}'"`]+/g)) {
    for (const w of m[0].matchAll(/[A-Za-z_][\w-]*/g)) usedKeyframes.add(w[0])
  }
}

const dead = []
for (const r of rules) {
  const t = tokensOf(r.selector)
  if (t.keyframe) continue                                  // handled via the @keyframes at-rule
  const names = [...[...t.classes].filter(c => !STATE.has(c)), ...t.ids]
  if (!names.length) continue                               // element/base/state-only: never "dead"
  // A rule survives if ANY BRANCH of its selector list can still match. Within
  // a branch every named part must be live — `.bingo-modal .modal-content`
  // cannot match once `.bingo-modal` is gone, however live `.modal-content` is.
  const branches = splitSelectorList(r.selector)
  const anyLive = branches.some(b => {
    const bn = branchNames(b, STATE)
    return bn.length === 0 ? true : bn.every(isLive)        // element-only branch: keep
  })
  if (anyLive) continue
  // inside a @keyframes still in use? (shouldn't happen, keyframe steps skipped)
  if (r.at.some(a => a.startsWith('@keyframes') && [...usedKeyframes].some(k => a.includes(k)))) continue
  dead.push({ ...r, names })
}

const arg = () => process.argv.slice(2)
const lines = a => a.reduce((s, r) => s + (r.endLine - r.startLine + 1), 0)

if (arg().includes('--names')) {
  const all = new Set()
  for (const r of dead) for (const n of r.names) all.add(n)
  for (const n of [...all].sort()) console.log(n)
  process.exit(0)
}
if (arg().includes('--list')) {
  for (const r of dead) {
    console.log(`${String(r.startLine).padStart(6)}-${String(r.endLine).padEnd(6)} ${r.at.length ? '[' + r.at.join(' / ') + '] ' : ''}${r.selector.replace(/\s+/g, ' ').slice(0, 130)}`)
  }
  console.log(`\n${dead.length} rules, ${lines(dead)} lines`)
  process.exit(0)
}

console.log(`consumers scanned: ${consumerFiles.length} files, ${tokens.size} distinct tokens`)
console.log(`global partials: ${partials.length} files, ${rules.length} rules`)
console.log(`DEAD after all three checks: ${dead.length} rules, ${lines(dead)} lines`)

const byPrefix = new Map()
for (const r of dead) {
  const p = (r.names[0] || '?').split('-').slice(0, 2).join('-')
  byPrefix.set(p, (byPrefix.get(p) || 0) + (r.endLine - r.startLine + 1))
}
console.log('\nby name prefix:')
for (const [p, n] of [...byPrefix].sort((a, b) => b[1] - a[1]).slice(0, 30)) {
  console.log(`  ${String(n).padStart(5)}L  ${p}`)
}

export { dead }

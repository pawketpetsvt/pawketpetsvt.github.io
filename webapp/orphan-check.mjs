// Orphan-module sweep: every .js/.vue under src/ that nothing else imports.
//
// Run: node orphan-check.mjs   (from webapp/)
//
// This catches the "built but never consumed" failure mode this migration keeps
// hitting — a service written, wired to nothing, and quietly inert (the calendar
// bonuses, the sidebar news widget, onPPEarned). A clean run is not proof a
// module is USED, only that it is reachable; it is a floor, not a ceiling.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'src'
const ENTRY = new Set(['src/main.js', 'src/App.vue', 'src/router.js', 'src/env.js'])

const files = []
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name).split(path.sep).join('/')
    if (e.isDirectory()) walk(p)
    else if (/\.(js|vue)$/.test(e.name)) files.push(p)
  }
}
walk(ROOT)

const bodies = new Map(files.map(f => [f, fs.readFileSync(f, 'utf8')]))
const orphans = []

for (const f of files) {
  if (ENTRY.has(f)) continue
  const base = path.basename(f)
  let used = false
  for (const [g, body] of bodies) {
    if (g === f) continue
    // Matches both relative and aliased import specifiers ending in the
    // filename, which is enough given every basename here is unique.
    if (body.includes('/' + base) || body.includes("'./" + base) || body.includes('"./' + base)) {
      used = true
      break
    }
  }
  if (!used) orphans.push(f)
}

console.log('modules:', files.length)
if (orphans.length) {
  console.log('ORPHANS (' + orphans.length + '):')
  orphans.forEach(o => console.log('  ' + o))
  process.exitCode = 1
} else {
  console.log('OK — none unimported')
}

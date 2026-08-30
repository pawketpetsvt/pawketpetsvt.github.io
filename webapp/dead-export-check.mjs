// Finds exported functions/consts that nothing else in the app imports or calls.
//
// This is the "built but never consumed" failure mode: a service written,
// wired to nothing, and quietly inert. It has bitten this migration repeatedly
// — the calendar bonuses, the sidebar news widget, `onPPEarned`, the weather
// bonus table. The orphan check only proves a MODULE is imported; this goes one
// level down to the individual export.
//
// Run: node dead-export-check.mjs   (from webapp/)
import fs from 'node:fs'
import path from 'node:path'

const files = []
;(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(js|vue)$/.test(e.name)) files.push(p.split(path.sep).join('/'))
  }
})('src')

const bodies = new Map(files.map(f => [f, fs.readFileSync(f, 'utf8')]))

// Named exports, plus the public methods of an exported singleton class.
const dead = []
for (const [file, src] of bodies) {
  if (!file.endsWith('.js')) continue

  const names = new Set()
  for (const m of src.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1])
  for (const m of src.matchAll(/^export\s+const\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1])

  // Methods on the service class in this file.
  const methods = new Set()
  for (const m of src.matchAll(/^ {2}(?:async\s+)?([a-z][\w$]*)\s*\(/gm)) {
    if (['if', 'for', 'while', 'switch', 'catch', 'return', 'constructor'].includes(m[1])) continue
    methods.add(m[1])
  }

  const others = [...bodies].filter(([f]) => f !== file).map(([, b]) => b).join('\n')

  for (const n of names) {
    // A name used anywhere else, or referenced within its own module.
    const rx = new RegExp('\\b' + n.replace(/\$/g, '\\$') + '\\b')
    if (rx.test(others)) continue
    const selfUses = (src.match(new RegExp('\\b' + n.replace(/\$/g, '\\$') + '\\b', 'g')) || []).length
    if (selfUses > 1) continue
    dead.push(`${file} -> export ${n}`)
  }

  for (const n of methods) {
    const rx = new RegExp('\\.' + n.replace(/\$/g, '\\$') + '\\s*\\(')
    if (rx.test(others)) continue
    if (rx.test(src)) continue
    dead.push(`${file} -> method ${n}()`)
  }
}

if (dead.length) {
  console.log(`EXPORTS / METHODS NOTHING CALLS (${dead.length}):`)
  dead.forEach(d => console.log('  ' + d))
} else {
  console.log('OK — every export and service method has a consumer')
}

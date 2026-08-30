// Finds classes a component uses that have NO rule anywhere — neither in the
// global style.css nor in the component's own scoped block.
//
// This is the "class referenced, rule missing" failure mode this migration keeps
// hitting: `.ach-badge`, the spooky keyframes, `.adpoc-*`, `.nav-pass-dot`,
// `.unlock-cel-detail`. Each rendered as unstyled text with nothing to show it
// was wrong.
//
// Run: node class-check.mjs   (from webapp/)
import fs from 'node:fs'
import path from 'node:path'

// The global stylesheet PLUS the app's own shared SCSS (admin.scss, globals)
// — a class defined in a shared partial is not a gap either.
let css = fs.readFileSync('../style.css', 'utf8')
for (const f of fs.readdirSync('src/assets/scss')) {
  css += '\n' + fs.readFileSync('src/assets/scss/' + f, 'utf8')
}

// Bootstrap utilities and framework classes are provided by the bundle, not by
// style.css or a scoped block, so they are not gaps.
const FRAMEWORK = /^(row|col|d-|g-|gx-|gy-|m[tbxyeslr]?-|p[tbxyeslr]?-|w-|h-|mw-|mh-|text-|btn|flex-|align-|justify-|gap-|rounded|border|bg-|fw-|fs-|min-w-|position-|top-|start-|end-|bottom-|overflow-|small|spinner|order-|shadow|opacity-|visually-|table|form-|input-|nav-link|ratio|float-|user-select-|pe-|z-|container|show|active|disabled|fade|collapse|invalid|valid)/

const files = []
;(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (e.name.endsWith('.vue')) files.push(p.split(path.sep).join('/'))
  }
})('src')

const missing = []
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8')
  const tpl = (s.match(/<template>[\s\S]*<\/template>/) || [''])[0]
  const style = (s.match(/<style[\s\S]*<\/style>/) || [''])[0]

  const classes = new Set()
  // Static class attributes. The lookbehind is load-bearing: without it
  // `class="` also matches the tail of `:class="`, so every binding EXPRESSION
  // got split on whitespace and reported as a pile of nonsense class names.
  for (const m of tpl.matchAll(/(?<![:\w-])class="([^"{]*)"/g)) {
    m[1].split(/\s+/).filter(Boolean).forEach(c => classes.add(c))
  }
  // Quoted class names inside :class bindings — object keys and ternary arms.
  // Only well-formed class tokens; a binding EXPRESSION is not a class.
  for (const m of tpl.matchAll(/:class="([^"]*)"/g)) {
    for (const q of m[1].matchAll(/'([a-z][a-z0-9-]*)'/g)) classes.add(q[1])
  }

  for (const c of classes) {
    if (FRAMEWORK.test(c)) continue
    if (css.includes('.' + c)) continue
    if (style.includes('.' + c)) continue
    missing.push(`${f} -> .${c}`)
  }
}

if (missing.length) {
  console.log(`CLASSES WITH NO RULE (${missing.length}):`)
  missing.forEach(m => console.log('  ' + m))
  process.exitCode = 1
} else {
  console.log(`OK — every class in ${files.length} components has a rule`)
}

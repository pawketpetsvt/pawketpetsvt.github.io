// asset-check.mjs — media files in the repo that nothing references.
//
// Run from webapp/:  node asset-check.mjs
//
// The consumer set has to include more than the Vue app. The OBS overlays, the
// ARG pages and the two SEO landing pages are all deliberately outside the
// migration but still served, and each one loads images of its own — so an
// "unused asset" sweep that only reads webapp/src would recommend deleting
// files those pages need.
//
// Matching is deliberately generous: full path, bare filename, and the filename
// without its extension (pet art is addressed as `pets/cy.png` from a DB column,
// and icons are built as `'icons/' + category + '.png'`).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')

const MEDIA = /\.(png|jpe?g|gif|svg|webp|mp3|wav|ogg|ico|woff2?|ttf)$/i

function walk(dir, test, out = []) {
  const abs = path.join(ROOT, dir)
  if (!fs.existsSync(abs)) return out
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (!['node_modules', 'dist', '.git'].includes(e.name)) walk(rel, test, out)
    } else if (test(e.name)) out.push(rel.split(path.sep).join('/'))
  }
  return out
}

// All media now lives under one of these three directories. The two loose mp3s
// that used to sit at the repo root are gone: `boss-theme.mp3` was orphaned, and
// the background theme moved to `music/sitetheme.mp3`.
const assets = [
  ...walk('images', n => MEDIA.test(n)),
  ...walk('music', n => MEDIA.test(n)),
  ...walk('sounds', n => MEDIA.test(n))
]

// README.txt is deliberately NOT in this list. Documentation that NAMES a file
// is not a thing that LOADS it — and counting it as a consumer is what hid
// `boss-theme.mp3`, a 4MB orphan referenced nowhere in the app, in legacy
// game.js, in legacy index.html, or in the overlays. Same lesson as comments
// not counting as CSS usage.
const consumers = [
  ...walk('webapp/src', n => /\.(vue|js|scss)$/.test(n)),
  ...['obs.html', 'overlay.html', 'overlay.js', 'overlay.css', 'secret.html',
    'webapp/index.html', 'sitemap.xml', 'google12380d30d802559a.html'
  ].filter(f => fs.existsSync(path.join(ROOT, f)))
]

const blob = consumers.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n')

const unref = assets.filter(a => {
  const base = path.basename(a)
  const stem = base.replace(/\.[^.]+$/, '')
  return !blob.includes(a) && !blob.includes(base) && !blob.includes(stem)
})

console.log(`assets: ${assets.length}   consumers scanned: ${consumers.length}   unreferenced: ${unref.length}`)
const byDir = new Map()
for (const u of unref) {
  const d = path.dirname(u)
  if (!byDir.has(d)) byDir.set(d, [])
  byDir.get(d).push(path.basename(u))
}
for (const [d, list] of [...byDir].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n  ${d}  (${list.length})`)
  console.log('    ' + list.join('\n    '))
}

// Referenced but absent — the opposite failure, and the more damaging one.
const missing = new Set()
for (const f of consumers) {
  const text = fs.readFileSync(path.join(ROOT, f), 'utf8')
  for (const m of text.matchAll(/["'(]([\w./-]*(?:images|sounds|music)\/[\w./-]+\.(?:png|jpe?g|gif|svg|webp|mp3|wav|ogg))["')]/gi)) {
    const rel = m[1].replace(/^[./]+/, '')
    if (!fs.existsSync(path.join(ROOT, rel))) missing.add(`${f}  ->  ${m[1]}`)
  }
}
if (missing.size) {
  console.log(`\nREFERENCED BUT MISSING (${missing.size}):`)
  for (const m of [...missing].sort()) console.log('  ' + m)
}

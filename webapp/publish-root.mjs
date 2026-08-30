// Copies the Vite build into the repository root, which is what GitHub Pages
// serves for this site.
//
// This repo is `pawketpetsvt.github.io` — a USER Pages site with no workflow
// file — so Pages publishes the root of `main` directly. The deployed artifact
// is therefore the repo itself, which is why the build output is committed
// rather than produced by CI. Run as part of `npm run build`, so building and
// publishing to the root can't drift apart.
//
// What lands at the root:
//   index.html   the built entry (replaces the legacy hand-written SPA)
//   assets/      hashed JS/CSS, owned entirely by this script
//
// Everything else at the root is left strictly alone — images/, music/,
// sounds/, obs.html, overlay.*, secret.html, CNAME, sitemap.xml and the Search
// Console verification file. The app requests media at
// `/images/...` etc., which resolve against those real folders; that is why
// vite.config.js sets `copyPublicDir: false` instead of duplicating the media
// into the output.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(here, 'dist')
const root = path.resolve(here, '..')

const distIndex = path.join(dist, 'index.html')
const distAssets = path.join(dist, 'assets')

// Refuse to touch the root unless there is a real build to publish. Without
// this, a failed or half-finished build could blank the deployed page.
if (!fs.existsSync(distIndex) || !fs.existsSync(distAssets)) {
  console.error('[publish] no build found in webapp/dist — run vite build first. Root left untouched.')
  process.exit(1)
}

// `assets/` is generated wholly by Vite and its filenames are content-hashed,
// so stale files from an earlier build would otherwise pile up forever. This is
// the ONLY directory this script deletes, and it is recreated immediately.
const rootAssets = path.join(root, 'assets')
fs.rmSync(rootAssets, { recursive: true, force: true })
fs.cpSync(distAssets, rootAssets, { recursive: true })
fs.copyFileSync(distIndex, path.join(root, 'index.html'))

const files = fs.readdirSync(rootAssets)
const bytes = files.reduce((n, f) => n + fs.statSync(path.join(rootAssets, f)).size, 0)
console.log(`[publish] index.html + assets/ (${files.length} files, ${(bytes / 1024 / 1024).toFixed(1)} MB) -> repo root`)
console.log('[publish] commit and push to make it live.')

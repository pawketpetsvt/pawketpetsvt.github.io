// css-inventory.mjs — parses the root style.css into an addressable list of
// rules, then attributes each rule to the Vue files that could consume it.
//
// This is the CSS counterpart of the game.js inventory tool used from Phase 6.75
// onward, and it exists for the same reason: 18,000 lines cannot be split by
// eye, and a wrong guess here is a silent visual regression rather than a
// build error.
//
// Output: scratch/css-inventory.json + a summary table on stdout.
//
//   node css-inventory.mjs [--json <path>]

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const CSS = path.join(ROOT, 'style.css')
const SRC = path.join(HERE, 'src')

// ── 1. Parse ────────────────────────────────────────────────────────────────
// A hand-rolled tokeniser rather than a library: the brace walker has to be
// aware of strings, comments and url() so that a `content: "}"` or a data-URI
// cannot desync it. That exact class of desync corrupted the game.js extent
// walker twice (Phase 8c and Phase 9), so it is handled explicitly here.

export function parseCss(text) {
  const rules = []          // { selector, at[], start, end, body, decls }
  const stack = []          // open blocks: { kind, prelude, start }
  let i = 0
  let buf = ''              // prelude accumulator
  // Offset where the current prelude's first non-whitespace character sits. A
  // rule's extent MUST begin here and not at its `{`: a grouped selector spans
  // several lines, so anchoring at the brace leaves `.a,\n.b,` behind as a
  // dangling fragment when the rule is deleted. That is exactly what broke the
  // first run of this tool, and postcss caught it as "Unknown word .pass-button,".
  let preludeStart = -1
  const n = text.length

  const lineOf = buildLineIndex(text)

  // Records where the prelude actually starts, the first time a non-blank
  // character joins it.
  const note = (offset, chunk) => {
    if (preludeStart === -1 && chunk.trim() !== '') preludeStart = offset + chunk.search(/\S/)
  }

  while (i < n) {
    const c = text[i]

    // comments
    if (c === '/' && text[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2)
      i = close === -1 ? n : close + 2
      continue
    }
    // strings
    if (c === '"' || c === "'") {
      const q = c
      let j = i + 1
      while (j < n) {
        if (text[j] === '\\') { j += 2; continue }
        if (text[j] === q) break
        j++
      }
      note(i, text.slice(i, j + 1))
      buf += text.slice(i, j + 1)
      i = j + 1
      continue
    }
    // url( ... ) — may contain unquoted braces/semicolons
    if ((c === 'u' || c === 'U') && /url\s*\(/iy.test(setLast(text, i))) {
      const open = text.indexOf('(', i)
      let depth = 1
      let j = open + 1
      while (j < n && depth > 0) {
        if (text[j] === '(') depth++
        else if (text[j] === ')') depth--
        j++
      }
      note(i, text.slice(i, j))
      buf += text.slice(i, j)
      i = j
      continue
    }

    if (c === '{') {
      const prelude = buf.trim()
      buf = ''
      const kind = prelude.startsWith('@') ? 'at' : 'rule'
      stack.push({ kind, prelude, start: preludeStart === -1 ? i : preludeStart, bodyStart: i + 1 })
      preludeStart = -1
      i++
      continue
    }

    if (c === '}') {
      const blk = stack.pop()
      if (blk) {
        if (blk.kind === 'rule') {
          rules.push({
            selector: blk.prelude,
            at: stack.filter(s => s.kind === 'at').map(s => s.prelude),
            start: blk.start,
            end: i,
            startLine: lineOf(blk.start),
            endLine: lineOf(i),
            body: text.slice(blk.bodyStart, i)
          })
        }
      }
      buf = ''
      preludeStart = -1
      i++
      continue
    }

    if (c === ';' && stack.every(s => s.kind === 'at')) {
      // top-level / at-level statement (@import, @charset)
      buf = ''
      preludeStart = -1
      i++
      continue
    }

    note(i, c)
    buf += c
    i++
  }

  if (stack.length) {
    console.error(`WARNING: ${stack.length} unclosed block(s); file may be malformed.`)
  }
  return rules
}

function setLast(text, i) { return text.slice(i, i + 8) }

function buildLineIndex(text) {
  const starts = [0]
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1)
  return offset => {
    let lo = 0, hi = starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (starts[mid] <= offset) lo = mid; else hi = mid - 1
    }
    return lo + 1
  }
}

// Splits a selector list on its TOP-LEVEL commas only. `:not(a, b)`,
// `:is(x, y)` and `[attr="a,b"]` all contain commas that are not separators.
export function splitSelectorList(sel) {
  const out = []
  let depth = 0, quote = null, cur = ''
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i]
    if (quote) { cur += c; if (c === quote && sel[i - 1] !== '\\') quote = null; continue }
    if (c === '"' || c === "'") { quote = c; cur += c; continue }
    if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue }
    cur += c
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

// The class/id names ONE branch of a selector list depends on. A branch is a
// conjunction: `.a .b` needs both `.a` and `.b` to exist somewhere in the same
// tree, so if either is gone the branch can never match. Treating a rule as
// live because ANY of its names is live — the obvious first implementation —
// keeps rules like `.bingo-modal .modal-content` alive forever on the strength
// of `.modal-content`, even though `.bingo-modal` exists nowhere.
export function branchNames(branch, stateClasses = new Set()) {
  const t = tokensOf(branch)
  return [...[...t.classes].filter(c => !stateClasses.has(c)), ...t.ids]
}

// ── 2. Selector → tokens ────────────────────────────────────────────────────
// Every class, id, element and body-state class a selector depends on.

export function tokensOf(selector) {
  const classes = new Set()
  const ids = new Set()
  const attrs = new Set()   // [class*="navbar"] style substring matchers
  const elements = new Set()
  const keyframe = /^\d|^(from|to)$/.test(selector.trim())

  // strip pseudo-element/class arguments that contain selectors we don't want
  // counted as separate rules (:hover, ::before), but keep :not()/:has() inner
  // selectors, which really do reference other classes.
  const cleaned = selector
    .replace(/::[a-zA-Z-]+/g, ' ')
    .replace(/:(hover|focus|focus-visible|active|disabled|checked|first-child|last-child|first-of-type|last-of-type|nth-child\([^)]*\)|nth-of-type\([^)]*\)|empty|root|target|placeholder|indeterminate|valid|invalid|required|read-only)/g, ' ')

  for (const m of cleaned.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) classes.add(m[1])
  for (const m of cleaned.matchAll(/#(-?[_a-zA-Z][\w-]*)/g)) ids.add(m[1])
  for (const m of cleaned.matchAll(/\[class\s*([*^$~|]?)=\s*["']([^"']+)["']\]/g)) attrs.add(m[2])
  for (const m of cleaned.matchAll(/(^|[\s>+~,(])([a-zA-Z][a-zA-Z0-9]*)\b(?![\w-]*["'])/g)) {
    const t = m[2].toLowerCase()
    if (!['and', 'or', 'not', 'has', 'is', 'where', 'deep'].includes(t)) elements.add(t)
  }

  return { classes, ids, attrs, elements, keyframe }
}

// ── 3. Consumers ────────────────────────────────────────────────────────────

export function collectVueFiles(dir = SRC, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) collectVueFiles(p, out)
    else if (/\.(vue|js)$/.test(e.name)) out.push(p)
  }
  return out
}

// Comments are NOT usage. This codebase documents its own history heavily —
// "was `.team-profiles-grid` (auto-fill minmax 350px)", "#dice-don-btns
// display:none default" — and counting that prose as a live reference keeps the
// very rules those comments describe as REMOVED alive forever, and mis-assigns
// them to whichever component happens to mention them.
export function stripComments(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, ' ')                       // HTML / Vue template
    .replace(/\/\*[\s\S]*?\*\//g, ' ')                      // block
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1 ')             // line, but not a URL's //
}

// Tokens a source file could apply as a class name. Deliberately broad on
// everything that is not a comment: class names get assembled at runtime
// ('gp-' + x, `wk-${key}`), so a raw token scan is the only safe read.
//
// One exclusion, and it is not optional: a token whose ONLY appearances are as
// an HTML tag is not a class. `SiteFooter.vue` renders `<footer class=
// "site-footer">`, and counting the tag as a use of the class `.footer` kept a
// dead 9-declaration rule alive — the class it actually renders is
// `.site-footer`. Same trap waits for .header, .main, .nav, .section.
export function tokensInSource(text) {
  const src = stripComments(text)
  const out = new Set()
  const tagOnly = new Map()      // token -> true while every sighting is a tag
  for (const m of src.matchAll(/[A-Za-z_][\w-]{1,}/g)) {
    const before = src.slice(Math.max(0, m.index - 2), m.index)
    const isTag = /<\/?$/.test(before)
    if (!tagOnly.has(m[0])) tagOnly.set(m[0], isTag)
    else if (!isTag) tagOnly.set(m[0], false)
    out.add(m[0])
  }
  for (const [tok, only] of tagOnly) if (only) out.delete(tok)
  return out
}

function main() {
  const css = fs.readFileSync(CSS, 'utf8')
  const rules = parseCss(css)

  const files = collectVueFiles()
  const perFile = new Map()
  for (const f of files) {
    perFile.set(f, tokensInSource(fs.readFileSync(f, 'utf8')))
  }

  const records = rules.map((r, idx) => {
    const t = tokensOf(r.selector)
    const names = [...t.classes, ...t.ids]
    const users = []
    if (names.length) {
      for (const [f, toks] of perFile) {
        if (names.some(nm => toks.has(nm))) users.push(path.relative(HERE, f).replace(/\\/g, '/'))
      }
    }
    return {
      idx,
      selector: r.selector,
      at: r.at,
      startLine: r.startLine,
      endLine: r.endLine,
      lines: r.endLine - r.startLine + 1,
      classes: [...t.classes],
      ids: [...t.ids],
      attrs: [...t.attrs],
      elementOnly: t.classes.size === 0 && t.ids.size === 0 && t.attrs.size === 0,
      keyframe: t.keyframe,
      declCount: (r.body.match(/;/g) || []).length,
      users
    }
  })

  const outPath = path.join(HERE, 'scratch-css-inventory.json')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify({ rules: records }, null, 1))

  // ── summary ──
  const total = records.length
  const byUsers = { none: 0, one: 0, many: 0 }
  for (const r of records) {
    if (r.keyframe) continue
    if (r.users.length === 0) byUsers.none++
    else if (r.users.length === 1) byUsers.one++
    else byUsers.many++
  }
  console.log(`style.css: ${css.split('\n').length} lines, ${total} rules`)
  console.log(`  element/at-rule only : ${records.filter(r => r.elementOnly && !r.keyframe).length}`)
  console.log(`  keyframe steps       : ${records.filter(r => r.keyframe).length}`)
  console.log(`  consumed by 1 file   : ${byUsers.one}`)
  console.log(`  consumed by 2+ files : ${byUsers.many}`)
  console.log(`  consumed by 0 files  : ${byUsers.none}`)
  console.log(`\nwrote ${path.relative(ROOT, outPath)}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main()

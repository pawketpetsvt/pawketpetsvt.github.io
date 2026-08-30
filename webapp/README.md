# Pawket Pets — the app

This is the whole site. It began as a proof-of-concept covering auth, Adopt and
My Pets, and that description survived in this file long after it stopped being
true — it now covers all 31 routes across 139 components and 88 services, and
the legacy `game.js` (42,705 lines) and root `style.css` (18,816 lines) it was
migrated away from have both been deleted.

## Run it

```
npm install
cp .env.example .env      # then paste the Supabase anon key
npm run dev
```

http://localhost:5174

## Build and deploy

`pawketpetsvt.github.io` is a user Pages repo with no workflow file, so Pages
serves the root of `main` directly. The build therefore has to land in the repo
root, and `npm run build` does both steps:

```
npm run build        # vite build && node publish-root.mjs
```

`publish-root.mjs` copies `dist/index.html` and `dist/assets/` to the repo root.
It wipes only the root `assets/` directory — the content hashes in those
filenames mean stale bundles would otherwise pile up forever — and touches
nothing else. **Nothing is live until the result is committed and pushed.**

`npm run build:only` builds without publishing.

Media (`images/`, `music/`, `sounds/`) is served straight from the repo root,
not bundled. `public/` holds directory junctions to those three folders so they
resolve identically in dev; they are gitignored. `vite.config.js` sets
`build.copyPublicDir: false` so the build does not duplicate 15MB of media into
`dist/` — note it is NOT `publicDir: false`, which breaks the build, because
publicDir is also what resolves a root-relative `<img src="/images/…">` in a
template.

## Where things live

    src/pages/          one per route
    src/components/     shared and page-specific components
    src/services/       singleton service classes; the only things that mutate state
    src/models/         plain classes with defaulting constructors
    src/data/           static game data extracted from the legacy source
    src/AppState.js     a plain reactive({}) singleton — no Pinia
    src/assets/scss/    the global stylesheet, as nine themed partials

CSS lives in exactly two places: a component's own `<style lang="scss" scoped>`
block if only that component uses it, or a partial under `src/assets/scss` if
two or more do. `globals.scss` imports the partials in a deliberate order and
`main.js` imports it immediately before `bootstrap.scss` — Bootstrap is a
grid-and-utilities-only build whose `!important` utilities have to win their
ties by loading last.

## Checks

Run these at the end of any substantial change; each exists because it caught a
real bug that the build did not.

    node orphan-check.mjs        modules nothing imports
    node dead-export-check.mjs   exports and methods nothing calls
    node class-check.mjs         classes with no rule anywhere
    node css-dead.mjs            global CSS rules nothing can reach
    node asset-check.mjs         media nothing loads, and refs to missing files

    node --experimental-loader ./smoke-hooks.mjs battle-smoke.mjs
    node race-smoke.mjs
    node guild-dungeon-smoke.mjs
    node wheel-smoke.mjs

The battle suite needs the loader flag: it drives the real `BattleService`,
which reaches for `src/env.js`. The other three are pure engines and run under
plain Node.

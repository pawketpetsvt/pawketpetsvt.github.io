# PawketPetsVT

Live at https://pawketpets.net (GitHub Pages, custom domain via CNAME).

The site is a Vue 3 single-page app. Its source lives in `webapp/`; the built
output is committed to the repository root, which is what GitHub Pages serves.


## Deploying

    cd webapp
    npm install          # first time only
    npm run build
    git add -A && git commit && git push     # to main

`npm run build` compiles the app AND copies the result to the repo root
(`index.html` + `assets/`) via `webapp/publish-root.mjs`. The two are one
command on purpose — building without publishing would leave the deployed page
on the previous version with no sign anything was missed.

**Pushing without building does not update the site.** The root `index.html`
and `assets/` are the deployed artifact; nothing in CI rebuilds them.

Pages is configured to deploy from the branch root (no workflow file). This is
a user/organisation Pages repo (`pawketpetsvt.github.io`), so the root of `main`
is served directly.


## Developing

    cd webapp
    npm run dev          # http://localhost:5174

`webapp/public/{images,music,sounds}` are symlinks to the folders of the same
name at the repo root, so the dev server serves media at the same `/images/...`
paths production uses. Those symlinks are deliberately NOT copied into the
build (`copyPublicDir: false`) — in production the real folders are already at
the domain root, and copying them would add 41MB of duplicates to every deploy.

`webapp/.env` holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; see
`.env.example`. Both are baked into the bundle at build time, which is fine —
the anon key is a public, RLS-protected key by design.


## Layout

    index.html          built — do not edit (edit webapp/index.html)
    assets/             built — do not edit, regenerated every build
    webapp/             app source

    There is no longer a root style.css. It reached 18,816 lines and was split
    up in Phase 11: rules used by one component moved into that component's
    <style scoped> block, genuinely shared rules became the nine partials in
    webapp/src/assets/scss (imported by globals.scss), and about 6,500 lines
    that nothing could reach were deleted.

    images/ music/ sounds/
                        media, served straight from the root.
                        music/  = long tracks — sitetheme.mp3 (the background
                                  theme the navbar plays) plus the three battle
                                  themes
                        sounds/ = short one-shots (hit SFX, victory, glitch)

    obs.html overlay.*  OBS browser sources for streams
    secret.html         ARG page — an in-fiction news clipping disguised as a
                        404. It is NOT unreferenced: the Redeem page links to it
                        from `promo_codes.lore_page` in Supabase, so nothing in
                        this repo mentions the URL. Redeeming THEYWENTMISSING is
                        what surfaces the link. Do not delete it as an orphan.
    CNAME sitemap.xml google*.html
                        domain, sitemap, Search Console verification

Everything outside `index.html` and `assets/` is hand-maintained and is not
touched by the build.


## Verifying

From `webapp/`:

    node orphan-check.mjs        modules nothing imports
    node dead-export-check.mjs   exports and methods nothing calls
    node class-check.mjs         CSS classes with no rule anywhere

    node --experimental-loader ./smoke-hooks.mjs battle-smoke.mjs
    node race-smoke.mjs
    node guild-dungeon-smoke.mjs
    node wheel-smoke.mjs

The smoke suites drive the battle, racing, guild-dungeon and prize-wheel engines
over many thousands of simulated turns, asserting they terminate and never
produce NaN or out-of-bounds state.

# Pawket Pets — Vue 3 POC

Proof-of-concept migration of the Auth + Adopt + My Pets flow into Vue 3, modeled on the
`AppState` / `models` / `services` pattern from easilySWADE. This is additive only — it does
not modify any file outside this folder, and the live site is unaffected.

## Run it

```
npm install
npm run dev
```

Open http://localhost:5174

## Scope

Covers: register, login, adopt a pet, view/feed/play with pets, use inventory items, logout.
Does not cover: `game.js` or any of its ~60 systems, the other standalone pages (shop,
minigames, etc.), or deployment.

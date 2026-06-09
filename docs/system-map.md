# Royal Armies — System Map

Quick "where do I look first" reference for debugging and feature work.
Layers: **NEXUS** (server), **MAP** (HTML), **RIFT** (client JS), **FLEX** (CSS).

## Golden rules

1. **One canonical owner per piece of data.** If a value appears wrong on
   screen, find the canonical owner below, fix it there, then check whether a
   fallback copy also needs a mirror update.
2. **Files marked `FALLBACK ONLY` are never the first place to edit.** They
   exist for pages that load a script without its canonical module.
3. **Static assets are edge-cached.** Any change to a `.js`/`.css`/image under
   `public/` needs a `?v=` bump on every HTML page that references it
   (see `.cursor/rules/cloudflare-static-cache.mdc`).
4. **Error codes route you to the layer.** `NEXUS-*` = server/API
   (`nexus-error-codes.js`), `RIFT-*` = client-only (`public/rift-error-codes.js`,
   displayed via `public/rift-error-display.js`).

## Commander class & rank titles (most duplicated system — read this first)

Data flow:

```
ledger (db.json) commander.path ('PHYS' | 'MAG')
  → server: nexus-commander-class.js (path → class id, labels, portraits)
  → API payloads (server.js, nexus-age-class-onboarding.js, nexus-age-commander-gear.js, …)
  → client: global.player.path
  → rift-commander-rank-titles.js (canonical client tables + path/class helpers)
  → HUD / nametags / modals (rift-age-commander-rank.js, commander-hub.js, …)
```

| Concern | Canonical owner | Mirrors / fallbacks |
|---|---|---|
| path → class id (server) | `nexus-commander-class.js` | none — always require it |
| path → class id (client) | `public/rift-commander-rank-titles.js` (`RoyalArmiesCommanderRankTitles.normalizeCommanderPathCode` / `resolveCommanderPathId`) | small load-order fallbacks in `rift-age-commander-rank.js`, `rift-unit-purchase-catalog.js`, `rift-banner-army-advisor.js`, `commander-hub.js` |
| Rank titles 1–22 (server) | `nexus-commander-rank-titles.js` | keep in sync with client |
| Rank titles 1–22 (client) | `public/rift-commander-rank-titles.js` | FALLBACK copies in `rift-age-commander-rank.js`; seed copies in `rank-data.js` (overwritten at runtime by `hydrateRankDataCommanderTitles()`) |
| Rank titles 23–48 (Chronicle ladder) | `public/rank-data.js` | none |
| Class labels/portraits (server) | `nexus-commander-class.js` | none |
| Class picker UI / class ids (`battlemaster` / `battlemage`) | `public/game-class-picker.js` (`normalizeGameClassId` maps legacy `archmage`) | CSS keeps legacy `-archmage` selectors in `style2.css` for old cached HTML |
| Class selection persistence | `nexus-age-class-onboarding.js` (lock + dev reselect) → `POST /api/portal/game/onboarding-class` in `server.js` | dev override: `public/dev-environment.js` (`applyDevPreviewClassPathOverride`) |
| Class perks in combat | `nexus-age-battle-modifiers.js` (consumed by `nexus-age-battle-sim.js`) | client copy of perk text: `public/rift-class-perk-catalog.js` |

To change a rank title: edit `public/rift-commander-rank-titles.js` **and**
`nexus-commander-rank-titles.js`, then mirror the same string in
`rift-age-commander-rank.js` (fallback) and `rank-data.js` (seed), then bump
`?v=` on pages loading those scripts.

## Server (NEXUS)

- `server.js` — Express app, all `/api/*` routes, ledger read/write (`db.json`
  in dev). Routes mostly delegate to `nexus-*` modules.
- Identity/account: `nexus-onboarding.js`, `nexus-commander-class.js`,
  `nexus-commander-rank-titles.js`, `nexus-age-class-onboarding.js`,
  `nexus-age-commander-gear.js`, `nexus-age-commander-reset.js`
- Combat: `nexus-age-battle-sim.js` (engine), `nexus-age-battle-modifiers.js`
  (class perks/banners/gear), `nexus-age-city-battle.js`,
  `nexus-age-army-group-battle.js`, `nexus-age-border-assault-casualty.js`,
  `nexus-emerald-barrier-skills.js`, `nexus-infirmary-recovery.js`
- Army/economy: `nexus-age-roster.js`, `nexus-age-recruitment.js`,
  `nexus-age-unit-xp.js`, `nexus-age-army-groups.js`, `nexus-nation-treasury.js`
- World/movement: `nexus-age-movement.js`, `nexus-age-watchtower.js`,
  `nexus-age-headquarters.js`, `nexus-age-hq-intel.js`, `nexus-age-records.js`
- Guilds: `nexus-age-guild.js`, `nexus-age-guild-hub.js`,
  `nexus-age-guild-xp.js`, `nexus-age-guild-bounties.js`
- Infra: `nexus-error-codes.js` + `nexus-response-errors.js` (error registry),
  `nexus-request-audit.js`, `nexus-balance-monitor.js`, `nexus-deploy-revision.js`,
  `nexus-age-ledger-admin.js`, `nexus-dev-nation-switch.js` (dev only)

## Client (RIFT) — main entry pages

- `public/main.html` + `script.js` / `script2.js` — portal (legacy monoliths;
  search by feature string first)
- `public/game.html` + `game.js` — game onboarding, class picker
  (`game-class-picker.js`, `rift-class-perk-catalog.js`)
- `public/agealpha.html` + `age-page.js` — Age HUD; rank HUD =
  `rift-age-commander-rank.js`, guild = `age-adventurers-guild.js`,
  movement = `rift-age-movement.js` / `age-movement-panel.js`
- `public/headquarters.html`, `settlement.html`, `commander-hub.js` — hub views
- `public/dev-environment.js` — localhost-only auth/API patches and dev
  overrides; if behavior differs between Live Server (`:5500`) and `:3000`,
  look here first

## Conventions

- New server helpers: `nexus-*.js` at repo root, required from `server.js`.
- New client modules: IIFE exposing one `RoyalArmies*` global under `public/`.
- Seasonal Age of War files must not be pushed to `main`
  (`.cursor/rules/age-of-war-season-hold.mdc`).

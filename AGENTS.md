# AGENTS.md

Guidance for AI agents working in the Royal Armies repository.

## Cursor Cloud specific instructions

### Stack overview

Single-package Node app (**NEXUS**): `server.js` serves `public/` and `/api/*` on one port. Client is vanilla HTML/CSS/JS (**MAP** / **RIFT** / **FLEX**). Dev ledger is `db.json` at repo root (created/updated by the server).

### Services to run

| Service | Required | Start | URL |
|---------|----------|-------|-----|
| NEXUS (`npm start`) | Yes | `npm start` or `node server.js` | `http://localhost:3000` |
| VS Code Live Server | No | VS Code “Go Live” on `public/` (see `.vscode/settings.json`) | e.g. `http://localhost:5500` — `/api` proxied to `:3000` via `public/dev-environment.js` |

Only NEXUS is required for full-stack local dev. Open `http://localhost:3000/main` (or `/` which routes to main).

### Dependency refresh

On VM startup, run `npm install` from repo root (see cloud update script). No Docker, devcontainer, or bootstrap shell scripts.

### Local dev auth

`public/dev-environment.js` enables localhost conveniences: API origin patching for Live Server, extensionless vs `.html` routes, and auto-login via `POST /api/auth/dev-session` (default user `caleb_admin`). Use the dev banner to switch owner/player/guest modes. Health check: `GET /api/portal/metrics`.

### Lint / tests

- **Lint:** No ESLint/Prettier config in repo; nothing to run unless you add tooling.
- **Tests:** `npm test` is a placeholder and exits 1. Optional: `node game-sim-test.js` (CLI sim; not wired into npm).

### Deploy / branch rules (summary)

- Pushing `main` deploys production ([royalarmies.com](https://royalarmies.com)).
- **Age of War** seasonal paths must not go to `main` until release — see `.cursor/rules/age-of-war-season-hold.mdc`.
- After changing cached static assets under `public/`, bump `?v=` on all HTML references — see `.cursor/rules/cloudflare-static-cache.mdc`.

### Optional tooling

- Trailer render: `npm run render:trailer` (Puppeteer + ffmpeg; heavy).
- Python scripts under `scripts/` for map/asset maintenance (run per script as needed).
- **Split services:** `npm run start:portal`, `start:game`, `start:status` — see `docs/nexus-service-tier-deployment.md`.
- **Status page:** `/status` (component health + email alerts when split or unified with monitor enabled).

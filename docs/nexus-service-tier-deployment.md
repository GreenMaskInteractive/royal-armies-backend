# NEXUS service tier deployment

Royal Armies can run as one process (**unified**) or as three isolated Render web services behind Cloudflare path routing:

| Tier | Entry | Purpose |
|------|-------|---------|
| **portal** | `server-portal.js` | Main hub, auth, mailbox, community chat |
| **game** | `server-game.js` | Age/game clients, game chat, battle systems |
| **status** | `server-status.js` | Public `/status` dashboard + alert monitor |
| **unified** | `server.js` | Local dev default (all routes) |

## Why split?

If the game tier crashes or is redeployed, the **portal tier keeps community chat and the main page online** so players and staff can communicate during an incident.

The **status tier** probes portal + game components and emails operations staff when anything reports **hiccups** (yellow) or **offline** (red).

## Required production env vars

### All tiers (shared)

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | **Required for split deploy.** Render Postgres shared by portal + game. Without it each tier uses its own disk and data diverges. |
| `SESSION_SECRET` | Same value on portal + game so login cookies work across tiers on one domain. |
| `RESEND_API_KEY` | Resend API key for verification/reset mail and status alerts. |

### Status alerts

| Variable | Notes |
|----------|--------|
| `STATUS_ALERT_EMAIL` | Your email for yellow/red incident notifications. |
| `STATUS_ALERT_COOLDOWN_MS` | Optional. Default 15 minutes between duplicate alerts. |
| `STATUS_MONITOR_INTERVAL_MS` | Optional. Default 30 seconds between probe passes. |

### Peer URLs (split deploy)

Set on the **status** service so probes reach the right backends:

| Variable | Example |
|----------|---------|
| `NEXUS_PORTAL_PEER_URL` | `https://portal.royalarmies.com` or path-routed `https://royalarmies.com` |
| `NEXUS_GAME_PEER_URL` | `https://game.royalarmies.com` |
| `NEXUS_STATUS_PEER_URL` | `https://royalarmies.com` |
| `ROYAL_ARMIES_PUBLIC_URL` | `https://royalarmies.com` |

Portal and game tiers should also set peer URLs so cross-links redirect correctly when a player hits the wrong tier.

## Local development

```bash
npm start                 # unified — everything on :3000
npm run start:portal      # portal only (:3000)
npm run start:game        # game only (:3001 if PORT=3001)
npm run start:status      # status page + monitor
```

For local split testing:

```powershell
$env:DATABASE_URL="postgres://..."
$env:NEXUS_PORTAL_PEER_URL="http://localhost:3000"
$env:NEXUS_GAME_PEER_URL="http://localhost:3001"
$env:STATUS_ALERT_EMAIL="you@example.com"
$env:RESEND_API_KEY="re_..."

# Terminal 1
npm run start:portal

# Terminal 2
$env:PORT=3001; npm run start:game

# Terminal 3
$env:PORT=3002; npm run start:status
```

Open:

- Main portal → `http://localhost:3000/main`
- Game → `http://localhost:3001/game`
- Status → `http://localhost:3002/status`

## Render blueprint

Use `render.yaml` in the repo root. Create one Postgres database and attach `DATABASE_URL` to portal, game, and status services.

## Cloudflare routing (recommended)

Route by path on one public domain:

| Path | Backend |
|------|---------|
| `/`, `/main`, `/api/login`, `/api/auth/*`, `/api/portal/mailbox*`, `/api/portal/community-chat*` | Portal service |
| `/game`, `/agealpha`, `/headquarters`, `/api/portal/age/*`, `/api/portal/game-chat*` | Game service |
| `/status`, `/api/status/*` | Status service |
| `/api/health/*` | Origin tier that owns the component (or proxy all health paths to both) |

## Status page

Public URL: **`/status`**

Shows green / yellow / red for:

- Main Portal
- Community Chat
- Commander Messaging
- Authentication
- Game Client
- Game Chat
- Battle Simulation
- Age Movement
- Status Page (self-check)

Yellow and red transitions email `STATUS_ALERT_EMAIL` with component detail.

## Migrating existing production data to Postgres

1. Create Render Postgres.
2. Set `DATABASE_URL` on a one-off unified boot locally with your production `db.json` present.
3. On first boot with Postgres empty, the ledger hydrator seeds from `db.json` automatically.
4. Verify data, then deploy split services with the same `DATABASE_URL`.

## Rollback

Set `NEXUS_SERVICE_TIER=unified` (or use `npm start`) and deploy a single service until split routing is fully verified.

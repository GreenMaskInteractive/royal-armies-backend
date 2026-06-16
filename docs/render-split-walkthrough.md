# Render split deploy — step-by-step walkthrough

Use this checklist to move [royalarmies.com](https://royalarmies.com) from one Render web service to **portal + game + status** with shared Postgres.

**Estimated time:** 1–2 hours (plus DNS propagation if you change subdomains).

---

## Before you start — gather these

| Item | Where to get it |
|------|-----------------|
| **Resend API key** | [resend.com](https://resend.com) → API Keys |
| **STATUS_ALERT_EMAIL** | Your ops inbox (e.g. accountsdept@royalarmies.com) |
| **SESSION_SECRET** | Render → current web service → Environment (copy existing value) |
| **MAINTENANCE_ALERT_DEV_KEY** | Same (if you use `signal-update-imminent.js`) |
| **Production `db.json`** | Render Shell on current service: `cat /data/db.json` → save locally |

**Code must be on GitHub:** commit and push `render.yaml`, `server-portal.js`, `server-game.js`, `server-status.js`, and all `nexus-*` split files before using the Blueprint.

---

## Step 0 — Push split code to GitHub

From your repo root, commit the service-tier work and push to `main` (or the branch Render tracks).

Render will not see `server-portal.js` until this is done.

---

## Step 1 — Create Render Postgres

1. Open [dashboard.render.com](https://dashboard.render.com)
2. **New +** → **PostgreSQL**
3. Name: `royal-armies-db`
4. Region: **Oregon** (match your web services)
5. Plan: **Basic** (256 MB is fine to start)
6. Create database
7. Copy **Internal Database URL** (for Render services) — you'll attach this via Blueprint automatically

Do **not** delete your existing web service yet.

---

## Step 2 — Seed Postgres from production data

This is the most important step. Without it, split services start with an empty ledger.

### 2a. Download production ledger

1. Render → your **current** Royal Armies web service
2. **Shell** tab
3. Run: `cat /data/db.json`
4. Copy output → save as `production-db.json` on your PC (**never commit this file**)

### 2b. Run seed script locally

```powershell
cd "path\to\royal-armies-backend"
$env:DATABASE_URL = "postgres://..."   # External Database URL from Render Postgres → Connect
node scripts/seed-postgres-ledger.js "C:\path\to\production-db.json"
```

You should see: `[seed-postgres-ledger] ok — revision 1`

---

## Step 3 — Deploy three services (Blueprint)

### Option A — Blueprint (recommended)

1. Render → **New +** → **Blueprint**
2. Connect your GitHub repo
3. Render reads `render.yaml` and proposes:
   - `royal-armies-db` (skip if you already created Postgres in Step 1 — merge or delete duplicate)
   - `royal-armies-portal`
   - `royal-armies-game`
   - `royal-armies-status`
4. Apply blueprint

### Option B — Manual (three web services)

Create three **Web Services** from the same repo:

| Service name | Start command |
|--------------|---------------|
| royal-armies-portal | `node server-portal.js` |
| royal-armies-game | `node server-game.js` |
| royal-armies-status | `node server-status.js` |

Attach the **same** `DATABASE_URL` from Postgres to all three.

---

## Step 4 — Set environment variables

### On **royal-armies-portal** (set manually)

| Key | Value |
|-----|--------|
| `RESEND_API_KEY` | `re_...` from Resend |
| `STATUS_ALERT_EMAIL` | your email |
| `NEXUS_GAME_PEER_URL` | see Step 6 (routing choice) |
| `NEXUS_STATUS_PEER_URL` | see Step 6 |

`SESSION_SECRET` — Blueprint generates it; or paste your **existing** secret from the old service so current player sessions stay valid.

Copy from old service if needed:

- `MAINTENANCE_ALERT_DEV_KEY`
- Any other secrets you already use (`STRIPE_*`, etc.) — portal tier owns auth/mail

### On **royal-armies-game**

| Key | Value |
|-----|--------|
| `NEXUS_PORTAL_PEER_URL` | see Step 6 |
| `NEXUS_STATUS_PEER_URL` | see Step 6 |

`SESSION_SECRET` and `DATABASE_URL` — Blueprint links these from portal + Postgres.

### On **royal-armies-status**

| Key | Value |
|-----|--------|
| `NEXUS_PORTAL_PEER_URL` | **required** — public URL that reaches portal |
| `NEXUS_GAME_PEER_URL` | **required** — public URL that reaches game |

`RESEND_API_KEY` and `STATUS_ALERT_EMAIL` — Blueprint copies from portal.

---

## Step 5 — Verify Render URLs before cutover

Each service gets a `*.onrender.com` URL. Test directly:

```
https://royal-armies-portal.onrender.com/api/health/live
https://royal-armies-game.onrender.com/api/health/live
https://royal-armies-status.onrender.com/status
https://royal-armies-status.onrender.com/api/status/snapshot
```

All should respond before you touch Cloudflare.

---

## Step 6 — Routing (choose one approach)

### Approach A — Subdomains (easier, recommended first)

| Hostname | Render service | Custom domain in Render |
|----------|----------------|-------------------------|
| `royalarmies.com` + `www` | portal | Add custom domain on portal service |
| `game.royalarmies.com` | game | Add on game service |
| `status.royalarmies.com` | status | Add on status service |

**Peer URLs:**

```
NEXUS_PORTAL_PEER_URL=https://royalarmies.com
NEXUS_GAME_PEER_URL=https://game.royalarmies.com
NEXUS_STATUS_PEER_URL=https://status.royalarmies.com
```

**Cloudflare DNS** (proxied orange cloud):

| Type | Name | Target |
|------|------|--------|
| CNAME | `@` or A | portal's Render DNS target |
| CNAME | `www` | portal |
| CNAME | `game` | game service |
| CNAME | `status` | status service |

When a player on `royalarmies.com` clicks **Game**, portal redirects to `game.royalarmies.com/game` automatically (tier gate + peer URL).

Optional: add **System Status** link on main → `https://status.royalarmies.com/status`

---

### Approach B — Single domain path routing (royalarmies.com only)

All public URLs stay on `https://royalarmies.com`. Requires a **Cloudflare Worker** to route paths to three Render origins.

**Peer URLs (all the same hostname):**

```
NEXUS_PORTAL_PEER_URL=https://royalarmies.com
NEXUS_GAME_PEER_URL=https://royalarmies.com
NEXUS_STATUS_PEER_URL=https://royalarmies.com
```

Worker pseudologic:

- `/status`, `/api/status/*` → status `*.onrender.com`
- `/game`, `/agealpha`, `/headquarters`, `/api/portal/age/*`, `/api/portal/game-chat*` → game origin
- Everything else → portal origin

This is more work but keeps one domain for players. Consider Approach A first, then migrate to B later.

---

## Step 7 — Cloudflare (if using Approach A)

1. **SSL/TLS** → Full (strict)
2. Add DNS records from Step 6
3. On each Render service → **Settings → Custom Domains** → add hostname → follow Render's verify steps
4. Keep your existing **Cache Rules** for static extensions (`js`, `css`, images, etc.)

After cutover, bump `?v=` on changed assets per project rules.

---

## Step 8 — Smoke test after cutover

| Check | URL |
|-------|-----|
| Main portal | `https://royalarmies.com/main` |
| Login | sign in with a test account |
| Community chat | send a test message |
| Game | open game / age from portal |
| Status page | all green (or yellow with detail) |
| Email | temporarily stop game service → status should email you within ~30s (restore after!) |

---

## Step 9 — Retire old unified service

Only after 24–48 hours of stable traffic:

1. Confirm custom domain removed from **old** web service
2. Suspend or delete old single-service deploy
3. Keep Postgres backups enabled

---

## Rollback

Point `royalarmies.com` DNS back to the **old** Render service and redeploy unified `node server.js` until issues are fixed. Postgres data remains if you need to re-seed.

---

## Quick reference — env vars by service

```
PORTAL:  NEXUS_SERVICE_TIER=portal, DATABASE_URL, SESSION_SECRET, RESEND_API_KEY, STATUS_ALERT_EMAIL, NEXUS_GAME_PEER_URL, NEXUS_STATUS_PEER_URL
GAME:    NEXUS_SERVICE_TIER=game,   DATABASE_URL, SESSION_SECRET, NEXUS_PORTAL_PEER_URL, NEXUS_STATUS_PEER_URL
STATUS:  NEXUS_SERVICE_TIER=status, DATABASE_URL, RESEND_API_KEY, STATUS_ALERT_EMAIL, NEXUS_PORTAL_PEER_URL, NEXUS_GAME_PEER_URL, ROYAL_ARMIES_PUBLIC_URL
```

Render sets `RENDER=true` automatically — do not override.

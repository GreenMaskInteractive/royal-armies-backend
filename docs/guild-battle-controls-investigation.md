# Guild battle controls — change log & open investigation

**Status:** Charge ring UI can complete; training battle API often still does not run (user report, post-`9245dd7`).

**Primary files:** `public/age-adventurers-guild.js`, `public/rift-age-guild-training.js`, `public/agealpha.html`, `public/style2.css`

---

## Timeline of work (git)

| Commit | Summary |
|--------|---------|
| `6598aa8` | Charge time 2s → 1s (JS + CSS animation) |
| `3c4e526`–`086f253` | Multiple hold-to-repeat fixes (pointer capture, arena-level listeners, simplified hold) — **still broken** |
| `613146c` | **Full rebuild:** removed old state machine, new `battle` module on `#age-guild-battle-wrap` |
| `9245dd7` | `lostpointercapture` fix, `battleChargeGen`, optional debug logs, reference docs |
| `4cb4d92` | Extensionless URLs (unrelated to battle logic) |

---

## What was removed (old system)

Top-level flags and helpers deleted in the `613146c` rebuild:

- `battleInFlight`, `battleHeld`, `battleHoldPointerId`, `chargeTimerId`, `chargePending`, `autoHealEnabled`
- `stopBattleHold()`, `scheduleBattleCharge()`, `fireTrainingBattle()`, `resumeBattleHoldIfNeeded()`, `runAutoHealAfterBattle()`
- `clearChargeTimer()`, `resetChargeRing()`, `startChargeRing()`
- Arena-scoped binding: `onBattlePointerDown` / `onBattlePointerUp` on `#age-guild-training-arena`
- **Global** `pointerup` / `pointercancel` on `window` (could cancel charge from outside the wrap)
- Duplicate `healUnits()` and duplicate `getUnitsUninjuredCount()`

Old pattern disabled the battle `<button>` during flight (`disabled=true`), which broke pointer streams for hold-to-repeat.

---

## What was added (current system)

### State (`battle` object)

```text
holdActive, fighting, chargeTimer, pointerId, autoHeal, bound, wrap
```

Plus module-level `battleChargeGen` (invalidates stale `setTimeout` callbacks).

### Constants

- `BATTLE_CHARGE_MS = 1000`
- `BATTLE_RING_CIRCUMFERENCE = 2 * Math.PI * 46`
- `BATTLE_DEBUG` via `?guildBattleDebug=1` or `localStorage rift-guild-battle-debug=1`

### Core functions

| Function | Role |
|----------|------|
| `battleOnWrapPointerDown` | Start hold on `#age-guild-battle-wrap`, capture pointer, schedule charge |
| `battleStartCharge` | 1s `setTimeout` → `battleExecute()` |
| `battleExecute` | `RoyalArmiesAgeGuildTraining.runTrainingBattle({ trainingMode })` |
| `battleEndHold` / `battleControlsReset` | Cancel or end hold (close view, Escape, blur) |
| `battleSyncUi` | Button stays `disabled=false`; uses `aria-disabled` + CSS classes |
| `battleControlsBind` | One-time `pointerdown` on wrap + window `blur` |
| `battleRunAutoHealLoop` | Auto-heal between chained fights when enabled |

### Debug (`9245dd7`)

- `battleLog()` on charge, execute, end-hold, pointer events
- `rift-age-guild-training.js` logs fetch start/done when debug enabled
- Louder `console.error` when API missing or fetch throws

### Docs

- `docs/guild-battle-controls-code-reference.md`
- `docs/guild-battle-controls-styles.extract.css`

### HTML cache bust

- `age-adventurers-guild.js?v=guild-battle-debug-1`
- `rift-age-guild-training.js?v=guild-battle-debug-1`

---

## What was changed (behavior / fixes attempted)

1. **Pointer target:** listeners only on `#age-guild-battle-wrap`, not whole arena + global document.
2. **Button never disabled mid-hold** — avoids losing pointer capture on re-enable.
3. **`lostpointercapture`:** ignore while `battle.chargeTimer != null` (timer or `pointerup` owns teardown).
4. **`battleChargeGen`:** if timer is cleared, callback bails with log `charge callback aborted (superseded)`.
5. **Charge visual vs hold class:** `battleClearChargeVisual()` removes `is-charging` only (not `is-hold-active`) when fight starts.
6. **API errors:** log to console even when `error.code` is missing (e.g. “Commander session required”).

**Not changed:** CSS charge ring still runs on `.is-charging` for 1s via `@keyframes age-guild-charge-ring` — **independent of JS timer**.

---

## Intended flow

```text
pointerdown (wrap)
  → holdActive=true, setPointerCapture, battleStartCharge()
  → add .is-charging, setTimeout(1000ms)
  → [timer] charge callback → battleExecute()
  → runTrainingBattle POST /api/portal/age/guild/training-battle
  → render battle log, XP float, loot
  → if still holding → battleStartCharge() again
pointerup while timer active → battleEndHold(true) → clear timer, no API
pointerup after timer fired → battleEndHold(false) → stop chaining only
```

---

## API binding (verified in code)

```javascript
// age-adventurers-guild.js
resolveApi() → global.RoyalArmiesAgeGuildTraining

// rift-age-guild-training.js (loaded before guild JS in agealpha.html)
global.RoyalArmiesAgeGuildTraining = { runTrainingBattle, healUnits, ... }
```

Script order in `agealpha.html` is correct. Binding looks fine **if both scripts load**.

---

## What I think is still wrong (ranked)

### 1. CSS ring ≠ JS timer (high confidence)

The ring animates whenever `.is-charging` is present for 1s. The API only runs when the **JS `setTimeout` callback** fires.

You can see a “complete” ring with **no fight** if:

- `pointerup` / `pointercancel` fired during the second → `battleEndHold(true)` clears timer
- `window blur` during charge → same
- `battleChargeGen` advanced → callback logs `charge callback aborted (superseded)` and exits

**Symptom:** UI looks successful; Network tab has no `training-battle` POST.

**Debug:** Open `/agealpha?guildBattleDebug=1`, hold Battle, watch for:

- Missing line: `charge callback firing → battleExecute`
- Present line: `battleEndHold { cancelCharge: true }` or `charge timer cleared`

### 2. `pointerup` / `pointercancel` still cancel during charge (high confidence)

Only `lostpointercapture` was guarded. **`battleOnWrapPointerUp` still calls `battleEndHold(true)` when `battle.chargeTimer` is set.**

On some mice, trackpads, or browsers, `pointercancel` or an early `pointerup` can fire while the user believes they are still holding. That matches “ring finishes, no battle” if they release at ~900–990ms or the browser drops the pointer stream.

**Unsure:** How often this happens on the user’s exact device without console logs.

### 3. Stale Cloudflare / browser cache (medium confidence)

Production serves static JS with edge TTL. Cache bust is `guild-battle-debug-1`. If an older bundle is cached, user still runs pre-rebuild logic (global pointerup, etc.).

**Check:** View source on live site — script `?v=` token. Hard refresh or purge cache.

### 4. `unitsUninjured === 0` (medium confidence)

`battleCanFight()` requires `guildState.unitsUninjured > 0`. If guild state never loaded or army is empty:

- `battleOnWrapPointerDown` returns immediately — **no charge, no ring**
- If units drop to 0 mid-hold, `battleStartCharge` aborts

**Unsure:** Whether user sees the ring (would imply charge started, so units > 0 at least initially).

### 5. API / session failure after `battleExecute` starts (medium confidence)

`runTrainingBattle` throws if:

- No username (`getActiveCommanderUsername()` / `localStorage activeCommanderUser` empty)
- NEXUS error (no units, cooldown, etc.)

Errors **with** `error.code` use `showRiftError`; others only `console.error` / `console.warn` — easy to miss.

**Debug:** Look for `[RIFT][guild-battle] runTrainingBattle failed` or `[RIFT][guild-training-api] runTrainingBattle rejected`.

### 6. `battle.fighting` stuck or double-entry (low confidence)

Early return `if (battle.fighting) return` at top of `battleExecute`. Should reset in `finally`. Would block **repeat** fights more than the first unless an exception prevented `finally` (unlikely).

### 7. `battleControlsBind` never runs or wrap missing (low confidence)

If `#age-guild-battle-wrap` is absent when `bindGuild()` runs, binding is skipped (`battle.bound` stays false until `onTrainingViewOpen` / `openTrainingJob` calls `battleControlsBind` again).

If ring animates, `battleStartCharge` ran → bind worked at least once.

---

## What I am unsure about

1. **Exact console output on production** — debug is off by default; we have not seen a log trace from the user’s session.
2. **Whether `battleExecute` runs but fetch fails** vs **timer never firing** — Network tab would distinguish; not confirmed.
3. **Whether `<button>` inside wrap** causes duplicate or swallowed events on specific browsers — capture is on wrap; should be OK.
4. **Whether `renderGuildPanel()` or guild sync events** fire during the 1s window and indirectly reset state — no direct call to `battleControlsReset` from render path, but not exhaustively proven.
5. **Whether dev bypass / persona modes** on port 5500 affect commander username for the API differently than production login.
6. **NEXUS-side rejection** (`executeGuildTrainingBattleWithLedger`) — client would show fetch done with error payload; needs server log or Network response.

---

## Recommended next steps (not yet implemented)

1. **User runs with `?guildBattleDebug=1`** and shares last 10 `[RIFT][guild-battle]` lines after one hold.
2. **Decouple fight trigger from CSS:** fire `battleExecute` from `animationend` on `.age-guild-charge-ring-progress` *or* drop CSS animation and drive ring from JS progress — one source of truth.
3. **Stop cancelling charge on `pointercancel`** during hold; only `pointerup` with matching `pointerId` cancels (with grace period).
4. **Always surface API errors in UI** (toast even without NEXUS code).
5. **Log one unconditional line** (no debug flag) when charge callback fires — e.g. `console.info('[RIFT] guild battle charge complete')` — to verify deploy/cache.

---

## Quick reference — files touched

| File | Battle-related changes |
|------|------------------------|
| `public/age-adventurers-guild.js` | Entire battle module, debug, heal/auto-heal wiring |
| `public/rift-age-guild-training.js` | Debug logs on `runTrainingBattle` |
| `public/agealpha.html` | Battle dock markup, script cache bust |
| `public/style2.css` | Charge ring 1s, battle panel position, pointer-events on dock/board |
| `server.js` | `POST /api/portal/age/guild/training-battle` (unchanged in this work) |

*Last updated: investigation notes after user report that battles still do not fire.*

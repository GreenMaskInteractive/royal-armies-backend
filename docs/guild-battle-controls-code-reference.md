# Guild battle controls — complete code reference

Reference snapshot of **all code pertaining to Street Patrol / guild training battle controls** (hold-to-battle, heal, auto-heal, battle report panel, progress bars, XP float).

**Canonical sources (do not treat this file as runtime):**

| Layer | File |
|-------|------|
| MAP | `public/agealpha.html` |
| RIFT | `public/age-adventurers-guild.js`, `public/rift-age-guild-training.js` |
| FLEX | `public/style2.css` |
| NEXUS | `server.js` (`POST /api/portal/age/guild/training-battle`, `POST /api/portal/age/guild/heal`) |

**Expected behavior**

1. Hold **Battle** for 1s (charge ring) → training battle API runs → report updates.
2. Keep holding → charge → fight cycles until release or no uninjured units.
3. Release during charge cancels; release after fight stops cycling.
4. **Heal** / **Heal All** / **Auto-heal** work alongside; auto-heal runs between chained fights when enabled.

---

## MAP — `public/agealpha.html`

Battle panel (left), controls dock (bottom center), and progression bars inside `#age-guild-training-arena`:

```html
<!-- Battle results panel -->
<aside class="age-guild-battle-panel" aria-label="Battle results">
    <div class="age-guild-battle-panel-inner">
        <div class="age-hud-rail-tabs age-guild-battle-tabs" role="tablist" aria-label="Battle report tabs">
            <button type="button" class="age-hud-rail-tab age-guild-battle-tab is-active" data-guild-battle-tab="details" role="tab" aria-selected="true" aria-controls="age-guild-battle-tab-details" id="age-guild-battle-tab-btn-details">Battle Report</button>
            <button type="button" class="age-hud-rail-tab age-guild-battle-tab" data-guild-battle-tab="loot" role="tab" aria-selected="false" aria-controls="age-guild-battle-tab-loot" id="age-guild-battle-tab-btn-loot" tabindex="-1">Loot</button>
        </div>
        <div id="age-guild-battle-tab-details" class="age-hud-rail-tabpanel age-guild-battle-tabpanel is-active" role="tabpanel" aria-labelledby="age-guild-battle-tab-btn-details" aria-live="polite">
            <div id="age-guild-log" class="age-guild-log"></div>
        </div>
        <div id="age-guild-battle-tab-loot" class="age-hud-rail-tabpanel age-guild-battle-tabpanel" role="tabpanel" aria-labelledby="age-guild-battle-tab-btn-loot" hidden aria-live="polite">
            <div id="age-guild-loot-log" class="age-guild-loot-log"></div>
        </div>
    </div>
</aside>

<!-- Battle controls dock -->
<div class="age-guild-battle-controls-dock" aria-label="Battle controls">
    <div id="age-guild-xp-float-host" class="age-guild-xp-float-host" aria-live="polite" aria-atomic="true"></div>
    <div id="age-guild-battle-deck" class="age-guild-battle-board">
        <div class="age-guild-battle-board-slab" aria-hidden="true"></div>
        <div class="age-guild-battle-board-layout">
            <div class="age-guild-battle-board-side age-guild-battle-board-side--left">
                <button type="button" id="age-guild-heal-one" class="age-guild-board-pill age-guild-satellite-btn age-guild-satellite-btn--heal">Heal</button>
                <button type="button" id="age-guild-heal-all" class="age-guild-board-pill age-guild-satellite-btn age-guild-satellite-btn--heal-all">Heal All</button>
            </div>
            <div class="age-guild-battle-board-war-hub">
                <div class="age-guild-battle-board-war-pedestal" aria-hidden="true"></div>
                <div id="age-guild-battle-wrap" class="age-guild-battle-btn-wrap">
                    <svg class="age-guild-charge-ring" viewBox="0 0 100 100" aria-hidden="true">
                        <circle class="age-guild-charge-ring-track" cx="50" cy="50" r="46" />
                        <circle class="age-guild-charge-ring-progress" cx="50" cy="50" r="46" />
                    </svg>
                    <button type="button" id="age-guild-battle-btn" class="age-guild-battle-circle" aria-label="Hold to battle">Battle</button>
                </div>
            </div>
            <div class="age-guild-battle-board-side age-guild-battle-board-side--right">
                <button type="button" id="age-guild-auto-heal" class="age-guild-board-pill age-guild-satellite-btn age-guild-satellite-btn--auto-heal" aria-pressed="false">Auto-heal</button>
            </div>
        </div>
    </div>
    <div class="age-guild-progress-stack age-guild-battle-progress-stack" aria-label="Guild progression">
        <div class="age-guild-xp-row">
            <span class="age-guild-bar-label">Rank <strong id="age-guild-rank">1</strong></span>
            <div class="age-guild-xp-bar-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="age-guild-xp-bar">
                <div id="age-guild-xp-fill" class="age-guild-xp-bar-fill"></div>
            </div>
            <span id="age-guild-xp-text" class="age-guild-bar-meta">0 / 95 XP</span>
        </div>
        <div class="age-guild-units-row">
            <span class="age-guild-bar-label">Units</span>
            <div class="age-guild-units-bar-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100" id="age-guild-units-bar">
                <div id="age-guild-units-fill" class="age-guild-units-bar-fill"></div>
            </div>
            <span id="age-guild-units-text" class="age-guild-bar-meta">0 / 0</span>
        </div>
    </div>
</div>
```

**Script / stylesheet cache bust** (in `agealpha.html` head and script tags):

```html
<link rel="stylesheet" href="style2.css?v=guild-battle-rebuild-1">
<script src="age-adventurers-guild.js?v=guild-battle-rebuild-1"></script>
```

---

## RIFT — `public/age-adventurers-guild.js`

### Constants and battle-related module state

```javascript
const BATTLE_CHARGE_MS = 1000;
const BATTLE_RING_CIRCUMFERENCE = 2 * Math.PI * 46;

// Related guild state (same file, top-level):
// lastBattleResult, activeBattleTab, lootTabAlert, lootLog,
// activeTrainingMode, activeTrainingLabel, guildState
```

### Battle report tabs, loot log, XP float

```javascript
function setBattleTab(tabId) {
    activeBattleTab = tabId === 'loot' ? 'loot' : 'details';
    const tabs = global.document.querySelectorAll('[data-guild-battle-tab]');
    tabs.forEach((tab) => {
        const isActive = tab.getAttribute('data-guild-battle-tab') === activeBattleTab;
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tab.tabIndex = isActive ? 0 : -1;
    });

    const lootPanel = global.document.getElementById('age-guild-battle-tab-loot');
    const detailsPanel = global.document.getElementById('age-guild-battle-tab-details');
    if (lootPanel) {
        lootPanel.hidden = activeBattleTab !== 'loot';
        lootPanel.classList.toggle('is-active', activeBattleTab === 'loot');
    }
    if (detailsPanel) {
        detailsPanel.hidden = activeBattleTab !== 'details';
        detailsPanel.classList.toggle('is-active', activeBattleTab === 'details');
    }

    if (activeBattleTab === 'loot') {
        lootTabAlert = false;
    }
    updateLootTabAlert();
}

function updateLootTabAlert() {
    const lootTab = global.document.getElementById('age-guild-battle-tab-btn-loot');
    if (!lootTab) return;
    lootTab.classList.toggle('is-loot-found', lootTabAlert && activeBattleTab !== 'loot');
    lootTab.setAttribute('aria-label', lootTabAlert && activeBattleTab !== 'loot'
        ? 'Loot — new findings available'
        : 'Loot');
}

function renderLootLog() { /* writes #age-guild-loot-log */ }

function appendLootEntries(entries) { /* unshifts into lootLog, sets lootTabAlert */ }

function showXpFloat(xpGain) {
    const host = global.document.getElementById('age-guild-xp-float-host');
    if (!host) return;
    const amount = Math.max(0, Math.floor(Number(xpGain) || 0));
    if (!amount) return;

    host.innerHTML = `<span class="age-guild-xp-float">+${amount} XP</span>`;
    global.setTimeout(() => {
        if (host.firstElementChild?.classList.contains('age-guild-xp-float')) {
            host.innerHTML = '';
        }
    }, 2800);
}

function formatWinnerLabel(winner) {
    if (winner === 'commander') return 'Victory';
    if (winner === 'npc') return 'Defeat';
    return 'Draw';
}
```

### Progress bars and battle log rendering

```javascript
function updateProgressBars() {
    const state = guildState || {};
    const rankEl = global.document.getElementById('age-guild-rank');
    const xpFill = global.document.getElementById('age-guild-xp-fill');
    const xpText = global.document.getElementById('age-guild-xp-text');
    const xpBar = global.document.getElementById('age-guild-xp-bar');
    const unitsFill = global.document.getElementById('age-guild-units-fill');
    const unitsText = global.document.getElementById('age-guild-units-text');
    const unitsBar = global.document.getElementById('age-guild-units-bar');

    const rank = Math.max(1, Math.floor(Number(state.rank) || 0));
    const xp = Math.max(0, Math.floor(Number(state.ageGuildXp) || 0));
    const xpRequired = Math.max(0, Math.floor(Number(state.ageGuildXpRequired) || 0));
    const xpProgress = state.rankAtMax ? 1 : Math.min(1, Math.max(0, Number(state.ageGuildXpProgress) || 0));
    const unitsTotal = Math.max(0, Math.floor(Number(state.unitsTotal) || 0));
    const unitsUninjured = Math.max(0, Math.floor(Number(state.unitsUninjured) || 0));
    const healthProgress = unitsTotal > 0 ? Math.min(1, unitsUninjured / unitsTotal) : 1;

    if (rankEl) rankEl.textContent = String(rank);
    if (xpFill) xpFill.style.width = `${(xpProgress * 100).toFixed(1)}%`;
    if (xpText) {
        xpText.textContent = state.rankAtMax ? `${xp} XP · Max rank` : `${xp} / ${xpRequired} XP`;
    }
    if (xpBar) xpBar.setAttribute('aria-valuenow', String(Math.round(xpProgress * 100)));
    if (unitsFill) unitsFill.style.width = `${(healthProgress * 100).toFixed(1)}%`;
    if (unitsText) unitsText.textContent = `${unitsUninjured} / ${unitsTotal}`;
    if (unitsBar) unitsBar.setAttribute('aria-valuenow', String(Math.round(healthProgress * 100)));
}

function formatEndReason(result) {
    if (result.endReason === 'annihilation') return 'Annihilation';
    if (result.endReason === 'routing') return 'Morale rout';
    if (result.endReason === 'infantry_phase') return 'Infantry phase';
    if (result.endReason === 'mutual_rout') return 'Mutual rout';
    return 'Concluded';
}

function renderBattleLog() {
    const logEl = global.document.getElementById('age-guild-log');
    if (!logEl) return;

    const titleEl = global.document.getElementById('age-guild-training-title');
    if (titleEl) titleEl.textContent = activeTrainingLabel;

    if (!lastBattleResult) {
        logEl.innerHTML = (
            '<div class="age-guild-log-idle">'
            + `<p class="age-guild-log-title">${escapeHtml(activeTrainingLabel)}</p>`
            + '<p>Hold <strong>Battle</strong> to charge a bout. Release to cancel. Injuries apply — heal with gold when needed.</p>'
            + '</div>'
        );
        return;
    }

    const result = lastBattleResult;
    const winnerClass = result.winner === 'commander' ? 'is-victory' : (result.winner === 'npc' ? 'is-defeat' : 'is-draw');
    const xpBreakdown = result.xpBreakdown && typeof result.xpBreakdown === 'object' ? result.xpBreakdown : null;
    const survivorMeta = xpBreakdown && Number.isFinite(xpBreakdown.totalSurviving)
        ? ` · ${xpBreakdown.totalSurviving} survivor(s)`
        : '';
    const logLines = (Array.isArray(result.log) ? result.log : [])
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join('');
    const rankLine = result.rankPromoted
        ? `<p class="age-guild-log-promotion">Promoted to rank ${escapeHtml(result.rank)}`
        + `${result.provisionsGranted ? ` · +${escapeHtml(result.provisionsGranted)} provisions` : ''}</p>`
        : '';

    logEl.innerHTML = (
        `<article class="age-guild-log-entry ${winnerClass}">`
        + '<header class="age-guild-log-head">'
        + `<p class="age-guild-log-outcome">${escapeHtml(formatWinnerLabel(result.winner))}</p>`
        + `<p class="age-guild-log-meta">${escapeHtml(formatEndReason(result))} · +${escapeHtml(result.xpGain ?? 0)} XP${escapeHtml(survivorMeta)}`
        + `${result.injuriesApplied ? ` · ${escapeHtml(result.injuriesApplied)} injured` : ''}</p>`
        + rankLine
        + '</header>'
        + `<ol class="age-guild-battle-log">${logLines}</ol>`
        + '</article>'
    );
    logEl.scrollTop = 0;
}
```

### Battle controls module (core)

```javascript
function getUnitsUninjuredCount() {
    return Math.max(0, Math.floor(Number(guildState?.unitsUninjured) || 0));
}

function getUnitsInjuredCount() {
    return Math.max(0, Math.floor(Number(guildState?.unitsInjured) || 0));
}

/** @type {{ holdActive: boolean, fighting: boolean, chargeTimer: ReturnType<typeof setTimeout> | null, pointerId: number | null, autoHeal: boolean, bound: boolean, wrap: HTMLElement | null }} */
const battle = {
    holdActive: false,
    fighting: false,
    chargeTimer: null,
    pointerId: null,
    autoHeal: false,
    bound: false,
    wrap: null
};

function battleCanFight() {
    return getUnitsUninjuredCount() > 0 && !battle.fighting;
}

function battleGetWrap() {
    return battle.wrap || global.document.getElementById('age-guild-battle-wrap');
}

function battleClearChargeVisual() {
    const wrap = battleGetWrap();
    if (!wrap) return;
    wrap.classList.remove('is-charging');
    const progress = wrap.querySelector('.age-guild-charge-ring-progress');
    if (!progress) return;
    progress.style.animation = 'none';
    progress.getBoundingClientRect();
    progress.style.animation = '';
}

function battleClearChargeTimer() {
    if (battle.chargeTimer) {
        global.clearTimeout(battle.chargeTimer);
        battle.chargeTimer = null;
    }
}

function battleDetachHoldListeners() {
    const wrap = battleGetWrap();
    if (!wrap) return;
    wrap.removeEventListener('pointerup', battleOnWrapPointerUp);
    wrap.removeEventListener('pointercancel', battleOnWrapPointerUp);
    wrap.removeEventListener('lostpointercapture', battleOnWrapPointerLost);
    if (battle.pointerId != null && wrap.hasPointerCapture?.(battle.pointerId)) {
        try {
            wrap.releasePointerCapture(battle.pointerId);
        } catch (err) {
            // Pointer already released.
        }
    }
}

function battleEndHold(cancelCharge) {
    battleDetachHoldListeners();
    battle.holdActive = false;
    battle.pointerId = null;
    if (cancelCharge) {
        battleClearChargeTimer();
        battleClearChargeVisual();
    } else {
        battleGetWrap()?.classList.remove('is-hold-active');
    }
    battleSyncUi();
}

function battleStartCharge() {
    battleClearChargeTimer();
    if (!battle.holdActive || battle.fighting || !battleCanFight()) {
        if (!battleCanFight()) battleEndHold(true);
        return;
    }

    const wrap = battleGetWrap();
    if (!wrap) return;

    wrap.classList.add('is-charging');
    battle.chargeTimer = global.setTimeout(() => {
        battle.chargeTimer = null;
        wrap.classList.remove('is-charging');
        void battleExecute();
    }, BATTLE_CHARGE_MS);
}

async function battleRunAutoHealLoop() {
    if (!battle.autoHeal || battle.fighting) return;
    const api = resolveApi();
    if (!api?.healUnits) return;

    let safety = 200;
    while (safety > 0 && battle.autoHeal && isOpen()) {
        safety -= 1;
        if (!getUnitsInjuredCount()) break;
        try {
            mergeGuildState(await api.healUnits({ mode: 'one' }));
        } catch (error) {
            if (error?.code === 'NEXUS-AGE-011' || error?.code === 'NEXUS-AGE-019') break;
            if (typeof global.showRiftError === 'function' && error?.code) {
                global.showRiftError(error.code, error.message);
            }
            break;
        }
    }
    renderGuildPanel();
}

async function battleExecute() {
    if (battle.fighting) return;

    const api = resolveApi();
    if (!api?.runTrainingBattle) {
        console.error('[RIFT] RoyalArmiesAgeGuildTraining.runTrainingBattle is unavailable');
        battleEndHold(true);
        return;
    }

    battle.fighting = true;
    battleClearChargeTimer();
    battleClearChargeVisual();
    battleSyncUi();

    try {
        lastBattleResult = await api.runTrainingBattle({ trainingMode: activeTrainingMode });
        mergeGuildState(lastBattleResult);
        appendLootEntries(lastBattleResult.lootEntries);
        showXpFloat(lastBattleResult.xpGain);
        if (Array.isArray(lastBattleResult.lootEntries) && lastBattleResult.lootEntries.length) {
            lootTabAlert = true;
        }
        setBattleTab('details');
        renderGuildPanel();
        if (!battle.holdActive && battle.autoHeal) {
            await battleRunAutoHealLoop();
        }
    } catch (error) {
        if (typeof global.showRiftError === 'function' && error?.code) {
            global.showRiftError(error.code, error.message);
        }
        battleEndHold(true);
    } finally {
        battle.fighting = false;
        renderGuildPanel();

        if (!battle.holdActive) {
            battleSyncUi();
            return;
        }

        if (!getUnitsUninjuredCount() && battle.autoHeal) {
            await battleRunAutoHealLoop();
        }

        if (!battle.holdActive) {
            battleSyncUi();
            return;
        }

        if (battleCanFight()) {
            battleStartCharge();
        } else {
            battleEndHold(true);
        }
    }
}

function battleOnWrapPointerDown(event) {
    if (event.button !== 0 || battle.fighting || battle.holdActive) return;
    if (!event.currentTarget?.contains(event.target)) return;
    if (!battleCanFight()) return;

    event.preventDefault();

    const wrap = event.currentTarget;
    battle.holdActive = true;
    battle.pointerId = event.pointerId;
    wrap.classList.add('is-hold-active');

    wrap.addEventListener('pointerup', battleOnWrapPointerUp);
    wrap.addEventListener('pointercancel', battleOnWrapPointerUp);
    wrap.addEventListener('lostpointercapture', battleOnWrapPointerLost);

    if (typeof wrap.setPointerCapture === 'function') {
        try {
            wrap.setPointerCapture(event.pointerId);
        } catch (err) {
            // Continue without capture; wrap-level pointerup still ends the hold.
        }
    }

    battleSyncUi();
    battleStartCharge();
}

function battleOnWrapPointerUp(event) {
    if (battle.pointerId == null || event.pointerId !== battle.pointerId) return;
    battleEndHold(Boolean(battle.chargeTimer));
}

function battleOnWrapPointerLost(event) {
    if (battle.pointerId == null || event.pointerId !== battle.pointerId) return;
    battleEndHold(Boolean(battle.chargeTimer));
}

function battleSyncUi() {
    const battleBtn = global.document.getElementById('age-guild-battle-btn');
    const healOneBtn = global.document.getElementById('age-guild-heal-one');
    const healAllBtn = global.document.getElementById('age-guild-heal-all');
    const autoHealBtn = global.document.getElementById('age-guild-auto-heal');
    const unitsUninjured = getUnitsUninjuredCount();
    const unitsInjured = getUnitsInjuredCount();
    const canFight = unitsUninjured > 0 && !battle.fighting;
    const showReady = battle.holdActive ? unitsUninjured > 0 : canFight;

    if (battleBtn) {
        battleBtn.disabled = false;
        battleBtn.setAttribute('aria-disabled', showReady ? 'false' : 'true');
        battleBtn.classList.toggle('is-ready', showReady);
        battleBtn.classList.toggle('is-disabled', !showReady);
        battleBtn.classList.toggle('is-busy', battle.fighting);
        battleBtn.setAttribute('aria-busy', battle.fighting ? 'true' : 'false');
    }
    if (healOneBtn) healOneBtn.disabled = !unitsInjured || battle.fighting;
    if (healAllBtn) healAllBtn.disabled = !unitsInjured || battle.fighting;
    if (autoHealBtn) {
        autoHealBtn.classList.toggle('is-active', battle.autoHeal);
        autoHealBtn.setAttribute('aria-pressed', battle.autoHeal ? 'true' : 'false');
    }
}

function battleControlsReset() {
    battleEndHold(true);
    battle.fighting = false;
    battleSyncUi();
}

function battleControlsBind() {
    const wrap = global.document.getElementById('age-guild-battle-wrap');
    const progressRing = global.document.getElementById('age-guild-training-arena')
        ?.querySelector('.age-guild-charge-ring-progress');

    if (!wrap) return;

    battle.wrap = wrap;
    wrap.style.setProperty('--age-guild-charge-circumference', String(BATTLE_RING_CIRCUMFERENCE));

    if (progressRing) {
        progressRing.style.strokeDasharray = `${BATTLE_RING_CIRCUMFERENCE}`;
        progressRing.style.strokeDashoffset = `${BATTLE_RING_CIRCUMFERENCE}`;
    }

    if (battle.bound) return;
    battle.bound = true;

    wrap.addEventListener('pointerdown', battleOnWrapPointerDown);
    global.window.addEventListener('blur', battleOnWindowBlur);
}

function battleOnWindowBlur() {
    if (battle.holdActive || battle.chargeTimer) {
        battleEndHold(true);
    }
}

async function healUnits(mode) {
    if (battle.fighting) return;
    const api = resolveApi();
    if (!api?.healUnits) return;
    try {
        mergeGuildState(await api.healUnits({ mode }));
        renderGuildPanel();
    } catch (error) {
        if (typeof global.showRiftError === 'function' && error?.code) {
            global.showRiftError(error.code, error.message);
        }
    }
}

function updateControlStates() {
    battleSyncUi();
}
```

### Lifecycle and event wiring (integration touchpoints)

```javascript
function closeJobWorkspace() {
    battleControlsReset();
    // ...
}

function closeTrainingView(options = {}) {
    battleControlsReset();
    // ...
}

function onTrainingViewOpen() {
    setTrainingViewOpen(true);
    battleControlsBind();
    renderGuildPanel();
}

function renderGuildPanel() {
    // ...
    updateProgressBars();
    renderLootLog();
    renderBattleLog();
    setBattleTab(activeBattleTab);
    updateLootTabAlert();
    updateControlStates();
}

function openTrainingJob(job) {
    activeTrainingMode = job.id;
    activeTrainingLabel = job.label;
    lastBattleResult = null;
    activeBattleTab = 'details';
    lootTabAlert = false;

    void loadGuildState().then(() => {
        // open training view ...
        renderGuildPanel();
        battleControlsBind();
    });
}

// onWorkspaceClick — battle-related branches:
//   [data-guild-battle-tab] → setBattleTab
//   #age-guild-heal-one → healUnits('one')
//   #age-guild-heal-all → healUnits('all')
//   #age-guild-auto-heal → battle.autoHeal toggle
//   back/return → battleControlsReset()

// onWorkspaceKeydown — Escape → battleControlsReset()

function bindGuild() {
    battleControlsBind();
    workspace?.addEventListener('click', onWorkspaceClick);
    global.document.addEventListener('keydown', onWorkspaceKeydown);
}
```

---

## RIFT — `public/rift-age-guild-training.js` (API client)

```javascript
async function runTrainingBattle(options = {}) {
    const username = String(options.username || resolveUsername() || '').trim();
    const trainingMode = String(options.trainingMode || 'street-patrol').trim().toLowerCase();
    if (!username) {
        throw new Error('Commander session required.');
    }

    const response = await global.fetch(resolveApiUrl('/api/portal/age/guild/training-battle'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
            username,
            trainingMode,
            settlementTier: getSettlementTier()
        })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.status !== 'ok') {
        const err = new Error(payload.message || 'Training battle failed.');
        err.code = payload.code || payload.errorCode || '';
        throw err;
    }

    applyGuildPayload(payload);
    return payload;
}

async function healUnits(options = {}) {
    const username = String(options.username || resolveUsername() || '').trim();
    const mode = String(options.mode || 'one').trim().toLowerCase();
    if (!username) {
        throw new Error('Commander session required.');
    }

    const response = await global.fetch(resolveApiUrl('/api/portal/age/guild/heal'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username, mode })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.status !== 'ok') {
        const err = new Error(payload.message || 'Healing failed.');
        err.code = payload.code || payload.errorCode || '';
        throw err;
    }

    applyGuildPayload(payload);
    return payload;
}

global.RoyalArmiesAgeGuildTraining = {
    fetchGuildState,
    runTrainingBattle,
    healUnits,
    // ...
};
```

---

## NEXUS — `server.js` (endpoints)

```javascript
app.post('/api/portal/age/guild/training-battle', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    // ... validation, executeGuildTrainingBattleWithLedger ...
    res.json({
        status: 'ok',
        action: 'guild-training-battle',
        trainingMode: result.trainingMode,
        winner: result.winner,
        endReason: result.endReason,
        log: result.log,
        xpGain: result.xpGain,
        lootEntries: result.lootEntries || [],
        injuriesApplied: result.injuriesApplied,
        rankPromoted: result.rankPromoted,
        unitsTotal: result.unitsTotal,
        unitsUninjured: result.unitsUninjured,
        unitsInjured: result.unitsInjured,
        // ... full guild state payload ...
    });
});

app.post('/api/portal/age/guild/heal', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    // ... executeGuildHeal(commander, req.body?.mode) ...
});
```

Battle simulation logic lives in server helpers (`executeGuildTrainingBattleWithLedger`, `executeGuildHeal`) — not duplicated here.

---

## FLEX — `public/style2.css`

Battle panel, controls dock, war board, charge ring, buttons, progress bars, battle log, loot log, XP float.

**Line ranges in canonical file:** ~21764–21832 (battle panel), ~22064–22087 (loot log), ~22089–22141 (controls dock), ~22182–22375 (battle board), ~22377–22416 (XP float), ~22429–22439 (pointer-events), ~22501–22573 (progress bars), ~22575–22639 (battle log), ~22641–22812 (battle deck, charge ring, battle circle, satellite buttons).

```css
#age-page-canvas .age-guild-battle-panel {
    position: absolute;
    top: 8px;
    left: 200px;
    width: min(400px, 44vw);
    max-height: min(48vh, 400px);
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 10px 12px 12px;
    box-sizing: border-box;
    overflow: hidden;
    pointer-events: auto;
    z-index: 2;
    border-radius: 6px;
    border: 1px solid var(--age-hud-rail-border);
    background:
        var(--age-hud-rail-sheen),
        var(--age-hud-rail-bg);
    box-shadow: var(--age-hud-rail-inset), var(--age-hud-rail-shadow);
    color: #f1e0ac;
}

.age-guild-battle-panel-inner {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
    flex: 1 1 auto;
}

#age-page-canvas .age-guild-battle-tabs {
    margin-bottom: 2px;
}

#age-page-canvas .age-guild-battle-tab.is-loot-found {
    border-color: rgba(255, 215, 120, 0.92);
    color: #ffe7a8;
    background:
        linear-gradient(180deg, rgba(255, 215, 120, 0.28) 0%, rgba(72, 52, 18, 0.92) 100%);
    box-shadow:
        inset 0 1px 0 rgba(255, 235, 180, 0.35),
        0 0 16px rgba(255, 196, 88, 0.45);
    animation: age-guild-loot-tab-glow 1.6s ease-in-out infinite;
}

@keyframes age-guild-loot-tab-glow {
    0%, 100% {
        box-shadow:
            inset 0 1px 0 rgba(255, 235, 180, 0.35),
            0 0 12px rgba(255, 196, 88, 0.32);
    }
    50% {
        box-shadow:
            inset 0 1px 0 rgba(255, 245, 210, 0.5),
            0 0 22px rgba(255, 215, 120, 0.62);
    }
}

#age-page-canvas .age-guild-battle-tabpanel {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    padding: 2px 0 0;
}

#age-page-canvas .age-guild-battle-tabpanel[hidden] {
    display: none !important;
}

.age-guild-loot-log {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.age-guild-loot-idle,
.age-guild-loot-entry {
    margin: 0;
    font-size: 0.82rem;
    line-height: 1.45;
    color: rgba(244, 232, 200, 0.84);
}

.age-guild-loot-entry {
    padding: 8px 10px;
    border-left: 2px solid rgba(255, 215, 120, 0.55);
    background: rgba(0, 0, 0, 0.22);
}

.age-guild-loot-entry-gold {
    color: #ffd978;
    font-weight: 700;
}

.age-guild-battle-controls-dock {
    position: absolute;
    left: 50%;
    bottom: 10px;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    width: min(680px, calc(100% - 32px));
    pointer-events: none;
    z-index: 3;
}

.age-guild-battle-controls-dock .age-guild-xp-float-host {
    position: relative;
    min-height: 52px;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: flex-end;
    pointer-events: none;
}

.age-guild-battle-controls-dock .age-guild-battle-progress-stack {
    width: 100%;
    margin: 0;
    padding: 8px 10px 2px;
    box-sizing: border-box;
    gap: 8px;
    pointer-events: auto;
    border-radius: 6px;
    border: 1px solid rgba(108, 78, 36, 0.55);
    background:
        linear-gradient(180deg, rgba(255, 215, 128, 0.05) 0%, transparent 36%),
        linear-gradient(165deg, rgba(22, 16, 10, 0.92) 0%, rgba(8, 6, 4, 0.88) 100%);
    box-shadow:
        inset 0 1px 0 rgba(255, 215, 120, 0.1),
        0 6px 18px rgba(0, 0, 0, 0.28);
}

.age-guild-battle-controls-dock .age-guild-xp-row,
.age-guild-battle-controls-dock .age-guild-units-row {
    grid-template-columns: 76px minmax(0, 1fr) auto;
    gap: 10px;
    width: 100%;
}

.age-guild-battle-controls-dock .age-guild-bar-meta {
    min-width: 88px;
    font-size: 0.72rem;
}

.age-guild-battle-board {
    position: relative;
    pointer-events: auto;
    width: min(620px, 100%);
    padding: 0 0 6px;
    box-sizing: border-box;
}

.age-guild-battle-board-slab { /* decorative base */ }
.age-guild-battle-board-layout { /* 3-column grid */ }
.age-guild-battle-board-side { /* heal pill columns */ }
.age-guild-board-pill { /* Heal / Heal All / Auto-heal pills */ }
.age-guild-board-pill.is-active { /* auto-heal on */ }
.age-guild-battle-board-war-hub { /* center pedestal */ }
.age-guild-battle-board .age-guild-battle-btn-wrap { /* 112×112 wrap */ }
.age-guild-battle-board .age-guild-battle-circle { /* gold battle button */ }
.age-guild-battle-board .age-guild-charge-ring-track,
.age-guild-battle-board .age-guild-charge-ring-progress { /* ring strokes */ }

.age-guild-xp-float-host { pointer-events: none; }
.age-guild-xp-float {
    animation: age-guild-xp-float-rise 2.6s ease-out forwards;
}

@keyframes age-guild-xp-float-rise {
    0% { opacity: 0; transform: translateY(16px); }
    12% { opacity: 1; transform: translateY(0); }
    72% { opacity: 1; transform: translateY(-32px); }
    100% { opacity: 0; transform: translateY(-56px); }
}

.age-guild-battle-deck,
.age-guild-battle-board,
.age-guild-battle-board-war-hub,
.age-guild-battle-btn-wrap {
    pointer-events: auto;
}

.age-guild-progress-stack { /* XP + units rows container */ }
.age-guild-xp-row,
.age-guild-units-row { /* grid layout for bars */ }
.age-guild-xp-bar-track,
.age-guild-units-bar-track,
.age-guild-xp-bar-fill,
.age-guild-units-bar-fill { /* progress bar visuals */ }

.age-guild-log { /* battle report scroll area */ }
.age-guild-log-entry.is-victory .age-guild-log-outcome { color: #9fd88d; }
.age-guild-log-entry.is-defeat .age-guild-log-outcome { color: #e59a9a; }
.age-guild-battle-log { /* ordered combat log lines */ }

.age-guild-battle-btn-wrap {
    position: relative;
    width: 132px;
    height: 132px;
    display: grid;
    place-items: center;
    touch-action: none;
}

.age-guild-charge-ring {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
    pointer-events: none;
}

.age-guild-charge-ring-progress {
    fill: none;
    stroke: #ffd978;
    stroke-width: 6;
    stroke-linecap: round;
    opacity: 0;
    transition: opacity 0.12s ease;
}

.age-guild-battle-btn-wrap.is-charging .age-guild-charge-ring-progress {
    opacity: 1;
    animation: age-guild-charge-ring 1s linear forwards;
}

@keyframes age-guild-charge-ring {
    from { stroke-dashoffset: var(--age-guild-charge-circumference, 289); }
    to { stroke-dashoffset: 0; }
}

.age-guild-battle-circle {
    position: relative;
    z-index: 1;
    width: 104px;
    height: 104px;
    border: 5px solid rgba(255, 215, 120, 0.82);
    border-radius: 50%;
    cursor: not-allowed;
    touch-action: none;
    user-select: none;
}

.age-guild-battle-circle.is-ready:not(:disabled) {
    cursor: pointer;
    color: #1a1208;
    background: linear-gradient(180deg, #e8c56a 0%, #c9982f 100%);
}

.age-guild-battle-circle.is-disabled {
    opacity: 0.45;
    cursor: not-allowed;
    filter: grayscale(0.35);
}

.age-guild-battle-circle.is-busy:not(:disabled) {
    opacity: 0.82;
}

.age-guild-battle-btn-wrap.is-charging .age-guild-battle-circle.is-ready:not(:disabled) {
    box-shadow:
        inset 0 1px 0 rgba(255, 215, 120, 0.28),
        0 0 0 4px rgba(255, 215, 120, 0.12),
        0 10px 24px rgba(0, 0, 0, 0.45);
}
```

**Full verbatim CSS extract:** `docs/guild-battle-controls-styles.extract.css` (copied from `public/style2.css` lines 21764–22812).

---

## DOM / class contract

| ID / selector | Purpose |
|---------------|---------|
| `#age-guild-battle-wrap` | Pointer target; `is-charging`, `is-hold-active` |
| `#age-guild-battle-btn` | Battle button; `is-ready`, `is-disabled`, `is-busy` |
| `.age-guild-charge-ring-progress` | SVG stroke animated via CSS + JS dasharray |
| `#age-guild-heal-one` / `#age-guild-heal-all` | Manual heal |
| `#age-guild-auto-heal` | Toggle; `is-active`, `aria-pressed` |
| `#age-guild-log` | Battle report body |
| `#age-guild-loot-log` | Loot tab body |
| `#age-guild-xp-float-host` | Floating +XP text |
| `#age-guild-rank`, `#age-guild-xp-*`, `#age-guild-units-*` | Progress bars |

---

*Generated reference — edit canonical source files, not this document.*

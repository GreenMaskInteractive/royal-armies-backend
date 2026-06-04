/**
 * RIFT — Dedicated Headquarters dev page (headquarters.html).
 */
(function initRoyalArmiesCouncilRoomPage(global) {
    'use strict';

    const ACTIVE_AGE_STORAGE_KEY = 'savedCommanderInActiveAge';
    const GAME_PRESENCE_HEARTBEAT_MS = 20000;

    let presenceHeartbeatTimer = null;
    let ageSessionLeaveSent = false;

    function isCouncilRoomPage() {
        return global.document.body?.dataset?.ageCouncilRoomPage === 'true';
    }

    function resolveApiUrl(path) {
        if (typeof global.resolveRoyalArmiesApiUrl === 'function') {
            return global.resolveRoyalArmiesApiUrl(path);
        }
        return path;
    }

    function resolvePageUsername() {
        const saved = global.localStorage.getItem('activeCommanderUser');
        if (saved && saved.trim()) return saved.trim();

        if (typeof global.getActiveCommanderUsername === 'function') {
            const name = String(global.getActiveCommanderUsername() || '').trim();
            if (name && name.toLowerCase() !== 'testaccount') return name;
        }

        return '';
    }

    function isDevNavigatorHost() {
        return typeof global.isDevPageNavigatorEnabled === 'function'
            && global.isDevPageNavigatorEnabled();
    }

    function shouldAllowCouncilRoomAccess() {
        if (!isDevNavigatorHost()) return false;
        try {
            if (new URLSearchParams(global.location.search).get('riftAgeDevBypass') === '1') {
                return true;
            }
        } catch (_err) {
            /* ignore */
        }
        return isCouncilRoomPage();
    }

    function consumeAgeDevBypassQuery() {
        try {
            const url = new URL(global.location.href);
            if (!url.searchParams.has('riftAgeDevBypass')) return;
            url.searchParams.delete('riftAgeDevBypass');
            global.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
        } catch (_err) {
            /* ignore */
        }
    }

    function markPlayingActiveAgeLocally() {
        try {
            global.localStorage.setItem(ACTIVE_AGE_STORAGE_KEY, 'true');
        } catch (_err) {
            /* ignore */
        }
    }

    function clearPlayingActiveAgeLocally() {
        try {
            global.localStorage.removeItem(ACTIVE_AGE_STORAGE_KEY);
        } catch (_err) {
            /* ignore */
        }
    }

    async function postAgeJoin() {
        const username = resolvePageUsername();
        if (!username) return;

        try {
            const response = await global.fetch(resolveApiUrl('/api/portal/age/join'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    ageSlug: global.document.body?.dataset?.ageSlug || 'alpha',
                    armyFocus: global.RoyalArmiesAgeMovementPanel?.computeLocalArmyFocus?.() || ''
                }),
                cache: 'no-store',
                credentials: 'include'
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload.status === 'error') {
                console.warn('[RIFT] Council Room age join sync failed:', payload?.message || payload);
            }
        } catch (err) {
            console.warn('[RIFT] Council Room age join sync failed:', err);
        }
    }

    async function postAgeLeave(useKeepalive) {
        if (ageSessionLeaveSent) return;
        const username = resolvePageUsername();
        if (!username) return;

        ageSessionLeaveSent = true;
        clearPlayingActiveAgeLocally();

        const fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username }),
            cache: 'no-store',
            credentials: 'include'
        };
        if (useKeepalive) fetchOptions.keepalive = true;

        try {
            await global.fetch(resolveApiUrl('/api/portal/age/leave'), fetchOptions);
        } catch (err) {
            console.warn('[RIFT] Council Room age leave sync failed:', err);
        }
    }

    async function sendPresenceHeartbeat() {
        const username = resolvePageUsername();
        if (!username || username.toLowerCase() === 'testaccount') return;
        if (typeof global.shouldSuppressRepeatedLocalDevApiWarnings === 'function'
            && global.shouldSuppressRepeatedLocalDevApiWarnings()) {
            return;
        }

        try {
            await global.fetch(resolveApiUrl('/api/portal/presence'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, inAge: true }),
                cache: 'no-store',
                credentials: 'include'
            });
        } catch (err) {
            if (typeof global.shouldSuppressRepeatedLocalDevApiWarnings !== 'function'
                || !global.shouldSuppressRepeatedLocalDevApiWarnings()) {
                console.warn('[RIFT] Council Room presence heartbeat failed:', err);
            }
        }
    }

    function startPresenceLoop() {
        if (presenceHeartbeatTimer) {
            global.clearInterval(presenceHeartbeatTimer);
        }
        sendPresenceHeartbeat();
        presenceHeartbeatTimer = global.setInterval(sendPresenceHeartbeat, GAME_PRESENCE_HEARTBEAT_MS);
    }

    function stopPresenceLoop() {
        if (presenceHeartbeatTimer) {
            global.clearInterval(presenceHeartbeatTimer);
            presenceHeartbeatTimer = null;
        }
    }

    function formatUniversalGameTimeClock(now = new Date()) {
        const hours = String(now.getUTCHours()).padStart(2, '0');
        const minutes = String(now.getUTCMinutes()).padStart(2, '0');
        const seconds = String(now.getUTCSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    function initializeGameTimeClock() {
        const display = global.document.getElementById('portal-universal-game-time-display');
        if (!display) return;

        const tick = () => {
            display.textContent = formatUniversalGameTimeClock(new Date());
            display.setAttribute('aria-label', `Game time ${display.textContent}`);
        };

        tick();
        global.setInterval(tick, 1000);
    }

    function refreshHudMovePoints() {
        const el = global.document.getElementById('age-hud-move-points');
        if (!el) return;

        const movement = global.RoyalArmiesAgeMovement;
        const current = movement && typeof movement.getMovePoints === 'function'
            ? movement.getMovePoints()
            : 3;
        const max = movement && typeof movement.getMovePointsMax === 'function'
            ? movement.getMovePointsMax()
            : 3;

        const clampedMax = Math.max(1, Math.min(3, Math.floor(Number(max) || 3)));
        const clampedCurrent = Math.max(0, Math.min(clampedMax, Math.floor(Number(current) || 0)));
        el.textContent = String(clampedCurrent);
    }

    function refreshHudUnits() {
        const movement = global.RoyalArmiesAgeMovement;
        const uninjuredEl = global.document.getElementById('age-hud-units-uninjured');
        const totalEl = global.document.getElementById('age-hud-units-total');
        if (!uninjuredEl || !totalEl) return;

        let uninjured = 0;
        let total = 0;
        if (movement && typeof movement.getUnitsTotal === 'function') {
            total = movement.getUnitsTotal();
            uninjured = movement.getUnitsUninjured();
        }

        uninjuredEl.textContent = String(Math.max(0, Math.floor(Number(uninjured) || 0)));
        totalEl.textContent = String(Math.max(0, Math.floor(Number(total) || 0)));
    }

    function wireWorldMapLink() {
        const link = global.document.getElementById('age-council-room-world-map-link');
        if (!link) return;

        const href = typeof global.RoyalArmiesPagePaths?.buildAgeAlphaUrl === 'function'
            ? global.RoyalArmiesPagePaths.buildAgeAlphaUrl({ riftAgeDevBypass: true })
            : (typeof global.resolveRoyalArmiesPageUrl === 'function'
                ? `${global.resolveRoyalArmiesPageUrl('agealpha')}?riftAgeDevBypass=1`
                : '/agealpha?riftAgeDevBypass=1');
        link.href = href;
    }

    function registerUnloadHandlers() {
        global.addEventListener('pagehide', () => {
            stopPresenceLoop();
            postAgeLeave(true);
        });
        global.addEventListener('beforeunload', () => {
            stopPresenceLoop();
            postAgeLeave(true);
        });
    }

    async function bootstrapCouncilRoomSession() {
        if (typeof global.ensurePortalAuthRestored === 'function') {
            await global.ensurePortalAuthRestored();
        }

        if (typeof global.applyLocalDevAutoLogin === 'function' && !resolvePageUsername()) {
            await global.applyLocalDevAutoLogin();
        }

        const username = resolvePageUsername();
        if (!username) {
            const main = typeof global.resolveRoyalArmiesPageUrl === 'function'
                ? global.resolveRoyalArmiesPageUrl('main')
                : '/main';
            global.location.replace(main);
            return;
        }

        if (typeof global.syncPlayerFromActiveCommanderStorage === 'function') {
            global.syncPlayerFromActiveCommanderStorage();
        }

        markPlayingActiveAgeLocally();
        await postAgeJoin();
        startPresenceLoop();

        if (typeof global.fetchCommanderDossierFromServer === 'function') {
            await global.fetchCommanderDossierFromServer();
        }

        global.refreshAgeHudGold?.();
        global.refreshAgeHudProvisions?.();
        global.refreshAgeHudCommanderRank?.();

        if (global.RoyalArmiesAgeMovement?.refresh) {
            try {
                await global.RoyalArmiesAgeMovement.refresh();
            } catch (_err) {
                /* optional */
            }
            refreshHudMovePoints();
            refreshHudUnits();
        }
    }

    async function bootCouncilRoomPage() {
        if (!isCouncilRoomPage()) return;

        if (!shouldAllowCouncilRoomAccess()) {
            const main = typeof global.resolveRoyalArmiesPageUrl === 'function'
                ? global.resolveRoyalArmiesPageUrl('main')
                : '/main';
            global.location.replace(main);
            return;
        }

        consumeAgeDevBypassQuery();
        registerUnloadHandlers();

        const gate = global.RoyalArmiesPageLoadingGate;
        if (gate?.retain) gate.retain('council-room-page');

        try {
            await global.RoyalArmiesAgeAreaShell?.ensureAreaShellMounted?.();
            await bootstrapCouncilRoomSession();
            global.RoyalArmiesAgeAreaShell?.refreshCommanderNavChrome?.();

            if (typeof global.enableAgeMovementPanel === 'function') {
                global.enableAgeMovementPanel();
            }

            if (typeof global.enableAgeHeadquarters === 'function') {
                global.enableAgeHeadquarters();
            }

            if (typeof global.enableAgeDispatchAlert === 'function') {
                await global.enableAgeDispatchAlert();
            }

            if (typeof global.RoyalArmiesAgeHeadquarters?.openCouncilRoomPageView === 'function') {
                await global.RoyalArmiesAgeHeadquarters.openCouncilRoomPageView();
            } else if (typeof global.RoyalArmiesAgeHeadquarters?.onViewOpen === 'function') {
                await global.RoyalArmiesAgeHeadquarters.onViewOpen();
            }
        } finally {
            if (gate?.release) {
                await gate.release('council-room-page');
            }
        }
    }

    global.RoyalArmiesCouncilRoomPage = {
        isCouncilRoomPage,
        bootCouncilRoomPage
    };

    global.addEventListener('royalarmies:age-movement-updated', () => {
        refreshHudMovePoints();
        refreshHudUnits();
    });

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', bootCouncilRoomPage);
    } else {
        bootCouncilRoomPage();
    }
})(window);

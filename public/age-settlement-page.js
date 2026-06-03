/**
 * RIFT — Dedicated settlement dev page (settlement.html).
 */
(function initRoyalArmiesSettlementPage(global) {
    'use strict';

    const ACTIVE_AGE_STORAGE_KEY = 'savedCommanderInActiveAge';
    const GAME_PRESENCE_HEARTBEAT_MS = 20000;
    const AGE_HUD_MOVE_POINTS_MAX = 3;

    let presenceHeartbeatTimer = null;
    let ageSessionLeaveSent = false;
    let devTierOverride = '';

    function isSettlementPage() {
        return global.document.body?.dataset?.ageSettlementPage === 'true';
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

    function shouldAllowSettlementAccess() {
        if (!isDevNavigatorHost()) return false;
        try {
            if (new URLSearchParams(global.location.search).get('riftAgeDevBypass') === '1') {
                return true;
            }
        } catch (_err) {
            /* ignore */
        }
        return isSettlementPage();
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

    function getGameSessionStartedStorageKey() {
        const username = resolvePageUsername();
        if (!username) return '';
        return `royalArmies_${username.toLowerCase()}_gameSessionStarted`;
    }

    function markGameSessionStarted() {
        const storageKey = getGameSessionStartedStorageKey();
        if (!storageKey) return;
        try {
            global.localStorage.setItem(storageKey, 'true');
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
                console.warn('[RIFT] Settlement age join sync failed:', payload?.message || payload);
            }
        } catch (err) {
            console.warn('[RIFT] Settlement age join sync failed:', err);
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
            console.warn('[RIFT] Settlement age leave sync failed:', err);
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
                console.warn('[RIFT] Settlement presence heartbeat failed:', err);
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
            : AGE_HUD_MOVE_POINTS_MAX;
        const max = movement && typeof movement.getMovePointsMax === 'function'
            ? movement.getMovePointsMax()
            : AGE_HUD_MOVE_POINTS_MAX;

        const clampedMax = Math.max(1, Math.min(AGE_HUD_MOVE_POINTS_MAX, Math.floor(Number(max) || AGE_HUD_MOVE_POINTS_MAX)));
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

    function refreshNavChrome() {
        const username = resolvePageUsername();
        const avatar = resolveGameAvatarUrl();

        const tags = [
            global.document.getElementById('logged-user-tag'),
            global.document.getElementById('game-mobile-nav-username')
        ];
        tags.forEach((el) => {
            if (el) el.textContent = username || 'Loading...';
        });

        const avatars = [
            global.document.getElementById('nav-embedded-avatar-crest'),
            global.document.getElementById('game-mobile-nav-avatar')
        ];
        avatars.forEach((el) => {
            if (el) el.src = avatar;
        });
    }

    function resolveGameAvatarUrl() {
        const saved = global.localStorage.getItem('savedProfileAvatarUrl');
        if (saved && saved.trim()) return saved.trim();
        return 'images/avatars/commanderprofile01.png';
    }

    async function returnToAgePortal() {
        stopPresenceLoop();
        await postAgeLeave(false);
        const target = typeof global.resolveRoyalArmiesPageUrl === 'function'
            ? global.resolveRoyalArmiesPageUrl('main')
            : '/main';
        if (global.RoyalArmiesPageRouteTransition?.navigateTo) {
            await global.RoyalArmiesPageRouteTransition.navigateTo(target);
            return;
        }
        global.location.href = target;
    }

    function closeMobileCommanderSubmenu() {
        const submenu = global.document.getElementById('game-mobile-commander-submenu');
        const toggle = global.document.getElementById('game-mobile-commander-toggle');
        const clip = global.document.getElementById('game-mobile-commander-clip');
        if (!submenu || !toggle) return;

        submenu.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        if (clip) clip.classList.remove('is-commander-open');
    }

    function toggleMobileCommanderSubmenu(event) {
        if (event) event.stopPropagation();
        const submenu = global.document.getElementById('game-mobile-commander-submenu');
        const toggle = global.document.getElementById('game-mobile-commander-toggle');
        const clip = global.document.getElementById('game-mobile-commander-clip');
        if (!submenu || !toggle) return;

        const willOpen = submenu.hidden;
        submenu.hidden = !willOpen;
        toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        if (clip) clip.classList.toggle('is-commander-open', willOpen);
    }

    function gameMobileNavCommanderAction(action, event) {
        if (event) event.stopPropagation();
        closeMobileCommanderSubmenu();

        switch (action) {
            case 'view-profile':
                global.openPublicCommanderProfileCard?.(event);
                break;
            case 'edit-profile':
                global.openCommanderHubModal?.('profile', event);
                break;
            case 'messages':
                global.openCommanderHubMessagesInbox?.(event);
                break;
            case 'settings':
                global.openCommanderHubModal?.('settings', event);
                break;
            case 'chronicles-battle-pass':
                global.openAgeChroniclesBattlePassModal?.(event);
                break;
            case 'return-to-portal':
                void returnToAgePortal();
                break;
            case 'logout':
                if (typeof global.handleHeaderAuthAction === 'function') {
                    global.handleHeaderAuthAction();
                } else {
                    global.triggerMainDashboardLogout?.();
                }
                break;
            default:
                break;
        }
    }

    function bindPageNavigation() {
        global.document.addEventListener('click', (event) => {
            const clip = global.document.getElementById('game-mobile-commander-clip');
            if (!clip || !clip.classList.contains('is-commander-open')) return;
            if (event.target.closest('#game-mobile-commander-clip')) return;
            closeMobileCommanderSubmenu();
        });
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

    function wireWorldMapLink() {
        const link = global.document.getElementById('age-settlement-world-map-link');
        if (!link) return;

        const href = typeof global.RoyalArmiesPagePaths?.buildAgeAlphaUrl === 'function'
            ? global.RoyalArmiesPagePaths.buildAgeAlphaUrl({ riftAgeDevBypass: true })
            : (typeof global.resolveRoyalArmiesPageUrl === 'function'
                ? `${global.resolveRoyalArmiesPageUrl('agealpha')}?riftAgeDevBypass=1`
                : '/agealpha?riftAgeDevBypass=1');
        link.href = href;
    }

    function bindDevTierSelect() {
        const select = global.document.getElementById('age-settlement-dev-tier-select');
        if (!select) return;

        const applyTier = () => {
            devTierOverride = String(select.value || '').trim().toLowerCase();
            global.RoyalArmiesAgeViewTabs?.refresh?.();
            global.RoyalArmiesAgeViewTabs?.setActiveView?.('city', { force: true });
        };

        select.addEventListener('change', applyTier);
        applyTier();
    }

    function getDevTierOverride() {
        return devTierOverride;
    }

    async function bootstrapSettlementSession() {
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

        refreshNavChrome();
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

    async function bootSettlementPage() {
        if (!isSettlementPage()) return;

        if (!shouldAllowSettlementAccess()) {
            const main = typeof global.resolveRoyalArmiesPageUrl === 'function'
                ? global.resolveRoyalArmiesPageUrl('main')
                : '/main';
            global.location.replace(main);
            return;
        }

        markGameSessionStarted();
        consumeAgeDevBypassQuery();

        wireWorldMapLink();
        bindPageNavigation();
        registerUnloadHandlers();
        initializeGameTimeClock();
        bindDevTierSelect();

        const gate = global.RoyalArmiesPageLoadingGate;
        if (gate?.retain) gate.retain('settlement-page');

        try {
            await bootstrapSettlementSession();

            if (typeof global.enableAgeMovementPanel === 'function') {
                global.enableAgeMovementPanel();
            }

            if (typeof global.enableAgeViewTabs === 'function') {
                global.enableAgeViewTabs();
            }

            if (typeof global.enableAgeBarracks === 'function') {
                global.enableAgeBarracks();
            }
            if (typeof global.enableAgeAdventurersGuild === 'function') {
                global.enableAgeAdventurersGuild();
            }
            if (typeof global.enableAgeUnitEvolution === 'function') {
                global.enableAgeUnitEvolution();
            }

            if (typeof global.bindPortalNewMessagesBarNavigation === 'function') {
                global.bindPortalNewMessagesBarNavigation();
            }
            if (typeof global.fetchCommanderMailboxFromServer === 'function') {
                await global.fetchCommanderMailboxFromServer();
            }
            if (typeof global.startPortalMailboxPolling === 'function') {
                global.startPortalMailboxPolling();
            }

            global.RoyalArmiesAgeViewTabs?.setActiveView?.('city', { force: true });
        } finally {
            if (gate?.release) {
                await gate.release('settlement-page');
            }
        }
    }

    global.RoyalArmiesSettlementPage = {
        getDevTierOverride,
        isSettlementPage
    };

    global.returnToGameAgePortal = returnToAgePortal;
    global.toggleGameMobileCommanderSubmenu = toggleMobileCommanderSubmenu;
    global.gameMobileNavCommanderAction = gameMobileNavCommanderAction;

    global.addEventListener('royalarmies:age-movement-updated', () => {
        refreshHudMovePoints();
        refreshHudUnits();
    });

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', bootSettlementPage);
    } else {
        bootSettlementPage();
    }
})(window);

/**
 * RIFT — Official age session page (agealpha.html, later age[N].html).
 */
(function initRoyalArmiesAgePage(global) {
    'use strict';

    const GAME_PRESENCE_HEARTBEAT_MS = 20000;
    const ACTIVE_AGE_STORAGE_KEY = 'savedCommanderInActiveAge';
    const COUNCIL_BOARD_MAP_GAP_PX = 10;
    const COUNCIL_BOARD_LEFT_POSITION_PX = 16;
    const COUNCIL_BOARD_MIN_WIDTH_PX = 220;
    const COUNCIL_BOARD_MIN_HEIGHT_PX = 160;
    const RIGHT_REPORTS_MIN_HEIGHT_PX = 150;
    const LEFT_COLUMN_CHAT_CLEARANCE_PX = 10;
    const AGE_MOBILE_LAYOUT_MQ = '(max-width: 1024px)';
    const HQ_PLANNING_BASE_MAP_PX = 480;
    const HQ_PLANNING_BASE_RAIL_PX = 168;
    const HQ_PLANNING_BASE_TOOLBAR_PX = 148;
    const HQ_PLANNING_BASE_COMMAND_RAIL_PX = 292;
    const HQ_PLANNING_BASE_GAP_PX = 12;
    const HQ_PLANNING_LAYOUT_CLEARANCE_PX = 16;
    const HQ_PLANNING_EDGE_BLEED_PX = 16;
    const MAP_FRAME_LAYOUT_MAX_EDGE = 1642;
    const COUNCIL_LAYOUT_RETRY_MAX_FRAMES = 90;

    let councilBoardLayoutObserver = null;
    let councilLayoutStabilizeRaf = 0;
    let councilLayoutStableFrames = 0;
    let lastCouncilLayoutKey = '';

    /** Matches countdowntimermodal.png: thin wings (L/R), tall center crest (MM). */
    const PORTAL_GAME_TIME_CHAR_SCALE_CLASSES = [
        'portal-game-time-char--wing-outer',
        'portal-game-time-char--wing-inner',
        'portal-game-time-char--sep',
        'portal-game-time-char--center',
        'portal-game-time-char--center',
        'portal-game-time-char--sep',
        'portal-game-time-char--wing-inner',
        'portal-game-time-char--wing-outer'
    ];

    let presenceHeartbeatTimer = null;
    let ageSessionLeaveSent = false;

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

    function resolveGameAvatarUrl() {
        const saved = global.localStorage.getItem('savedProfileAvatarUrl');
        if (saved && saved.trim()) return saved.trim();
        return 'images/avatars/commanderprofile01.png';
    }

    function formatUniversalGameTimeClock(now = new Date()) {
        const hours = String(now.getUTCHours()).padStart(2, '0');
        const minutes = String(now.getUTCMinutes()).padStart(2, '0');
        const seconds = String(now.getUTCSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    function renderUniversalGameTimeDisplay(display, timeString) {
        if (!display) return;

        const chars = String(timeString || '').padEnd(8, '-').slice(0, 8);
        const slots = display.querySelectorAll('.portal-game-time-char');

        if (slots.length !== 8) {
            display.innerHTML = chars.split('').map((ch, index) => {
                const scaleClass = PORTAL_GAME_TIME_CHAR_SCALE_CLASSES[index] || 'portal-game-time-char--wing-inner';
                return `<span class="portal-game-time-char ${scaleClass}" data-slot="${index}">${ch}</span>`;
            }).join('');
        } else {
            slots.forEach((slot, index) => {
                slot.textContent = chars[index];
            });
        }

        display.setAttribute('aria-label', `Game time ${chars}`);
    }

    function initializeAgePageUniversalGameTimeClock() {
        const display = global.document.getElementById('portal-universal-game-time-display');
        if (!display) return;

        const tick = () => {
            renderUniversalGameTimeDisplay(display, formatUniversalGameTimeClock(new Date()));
        };

        tick();
        global.setInterval(tick, 1000);
    }

    function getGameSessionStartedStorageKey() {
        const username = resolvePageUsername();
        if (!username) return '';
        return `royalArmies_${username.toLowerCase()}_gameSessionStarted`;
    }

    function isGameSessionStarted() {
        const storageKey = getGameSessionStartedStorageKey();
        if (!storageKey) return false;
        try {
            return global.localStorage.getItem(storageKey) === 'true';
        } catch (_err) {
            return false;
        }
    }

    function markGameSessionStarted() {
        const storageKey = getGameSessionStartedStorageKey();
        if (!storageKey) return false;

        try {
            global.localStorage.setItem(storageKey, 'true');
        } catch (_err) {
            return false;
        }

        return true;
    }

    function shouldAllowAgeDevBypass() {
        if (!global.isDevPageNavigatorEnabled || !global.isDevPageNavigatorEnabled()) {
            return false;
        }
        try {
            return new URLSearchParams(global.location.search).get('riftAgeDevBypass') === '1';
        } catch (_err) {
            return false;
        }
    }

    function consumeAgeDevBypassQuery() {
        try {
            const url = new URL(global.location.href);
            if (!url.searchParams.has('riftAgeDevBypass')) return;
            url.searchParams.delete('riftAgeDevBypass');
            const next = `${url.pathname}${url.search}${url.hash}`;
            global.history.replaceState(null, '', next);
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
                console.warn('Age join sync failed:', payload?.message || payload);
            }
        } catch (err) {
            console.warn('Age join sync failed:', err);
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
            console.warn('Age leave sync failed:', err);
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
                console.warn('Age presence heartbeat failed:', err);
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

    async function returnToAgePortal() {
        stopPresenceLoop();
        await postAgeLeave(false);
        if (global.RoyalArmiesPageRouteTransition && typeof global.RoyalArmiesPageRouteTransition.navigateTo === 'function') {
            await global.RoyalArmiesPageRouteTransition.navigateTo('/main');
            return;
        }
        global.location.href = '/main';
    }

    function formatAgeHudUnitsDisplay(uninjured, total) {
        const safeTotal = Math.max(0, Math.floor(Number(total) || 0));
        const safeUninjured = Math.max(0, Math.min(safeTotal, Math.floor(Number(uninjured) || 0)));
        return `${safeUninjured} | ${safeTotal}`;
    }

    const AGE_HUD_UNITS_LOW_HEALTH_RATIO = 0.6;
    const AGE_HUD_UNITS_CRITICAL_HEALTH_RATIO = 0.25;

    function getAgeHudUnitsHealthCounts(uninjured, total) {
        const safeTotal = Math.max(0, Math.floor(Number(total) || 0));
        const safeUninjured = Math.max(0, Math.min(safeTotal, Math.floor(Number(uninjured) || 0)));
        const ratio = safeTotal > 0 ? safeUninjured / safeTotal : 1;
        return { safeTotal, safeUninjured, ratio };
    }

    function isAgeHudUnitsLowHealth(uninjured, total) {
        const { ratio } = getAgeHudUnitsHealthCounts(uninjured, total);
        return ratio < AGE_HUD_UNITS_LOW_HEALTH_RATIO;
    }

    function isAgeHudUnitsCriticalHealth(uninjured, total) {
        const { safeTotal, ratio } = getAgeHudUnitsHealthCounts(uninjured, total);
        if (!safeTotal) return false;
        return ratio < AGE_HUD_UNITS_CRITICAL_HEALTH_RATIO;
    }

    function setAgeHudUnitsDisplay(uninjured, total) {
        const root = global.document.getElementById('age-hud-units');
        const item = global.document.getElementById('age-hud-units-item');
        const uninjuredEl = global.document.getElementById('age-hud-units-uninjured');
        const totalEl = global.document.getElementById('age-hud-units-total');
        if (!root || !uninjuredEl || !totalEl) return;

        const { safeTotal, safeUninjured } = getAgeHudUnitsHealthCounts(uninjured, total);
        const lowHealth = isAgeHudUnitsLowHealth(safeUninjured, safeTotal);
        const criticalHealth = isAgeHudUnitsCriticalHealth(safeUninjured, safeTotal);

        uninjuredEl.textContent = String(safeUninjured);
        totalEl.textContent = String(safeTotal);
        root.setAttribute(
            'aria-label',
            `${safeUninjured} uninjured ${safeUninjured === 1 ? 'unit' : 'units'} of ${safeTotal} total`
        );

        if (item) {
            item.classList.toggle('is-units-low-health', lowHealth);
            item.classList.toggle('is-units-critical-health', criticalHealth);
            item.setAttribute('aria-live', lowHealth || criticalHealth ? 'polite' : 'off');
        }
        root.classList.toggle('is-units-low-health', lowHealth);
        root.classList.toggle('is-units-critical-health', criticalHealth);
    }

    function countLocalArmyUnits(army) {
        let total = 0;
        let injured = 0;

        (Array.isArray(army) ? army : []).forEach((stack) => {
            if (!stack || typeof stack !== 'object') return;
            const qty = Math.max(0, Math.floor(Number(stack.qty) || 0));
            if (!qty) return;
            const stackInjured = Math.max(
                0,
                Math.min(qty, Math.floor(Number(stack.injuredQty ?? stack.injured) || 0))
            );
            total += qty;
            injured += stackInjured;
        });

        return {
            total,
            uninjured: Math.max(0, total - injured)
        };
    }

    function resolveAgeHudUnitsCounts() {
        const movement = global.RoyalArmiesAgeMovement;
        if (movement && typeof movement.getUnitsTotal === 'function') {
            return {
                total: movement.getUnitsTotal(),
                uninjured: movement.getUnitsUninjured()
            };
        }

        const army = global.player?.ageArmy || global.player?.army;
        const localCounts = countLocalArmyUnits(army);
        return { uninjured: localCounts.uninjured, total: localCounts.total };
    }

    function refreshAgeHudUnits() {
        const { uninjured, total } = resolveAgeHudUnitsCounts();
        setAgeHudUnitsDisplay(uninjured, total);
    }

    const AGE_HUD_MOVE_POINTS_MAX = 3;
    const AGE_HUD_MOVE_POINT_REGEN_TICK_MINUTES = 30;
    let ageMovePointTickRefreshTimer = null;

    function scheduleAgeMovePointHalfHourRefresh() {
        if (ageMovePointTickRefreshTimer) {
            global.clearTimeout(ageMovePointTickRefreshTimer);
            ageMovePointTickRefreshTimer = null;
        }

        const movement = global.RoyalArmiesAgeMovement;
        const nextTickIso = movement && typeof movement.getNextMovePointTickAt === 'function'
            ? movement.getNextMovePointTickAt()
            : null;
        const nextTickMs = nextTickIso ? Date.parse(nextTickIso) : NaN;
        const delay = Number.isFinite(nextTickMs)
            ? Math.max(500, nextTickMs - Date.now() + 300)
            : AGE_HUD_MOVE_POINT_REGEN_TICK_MINUTES * 60 * 1000;

        ageMovePointTickRefreshTimer = global.setTimeout(() => {
            ageMovePointTickRefreshTimer = null;
            refreshAgeHudMovePoints();
            refreshAgeHudUnits();
            global.dispatchEvent(new CustomEvent('royalarmies:age-movement-updated'));

            if (movement && typeof movement.refresh === 'function') {
                movement.refresh()
                    .then(() => {
                        refreshAgeHudMovePoints();
                        refreshAgeHudUnits();
                        scheduleAgeMovePointHalfHourRefresh();
                    })
                    .catch(() => scheduleAgeMovePointHalfHourRefresh());
                return;
            }

            scheduleAgeMovePointHalfHourRefresh();
        }, delay);
    }

    function setAgeHudMovePointsDisplay(current, max = AGE_HUD_MOVE_POINTS_MAX) {
        const el = global.document.getElementById('age-hud-move-points');
        const item = global.document.getElementById('age-hud-move-points-item');
        if (!el) return;

        const clampedMax = Math.min(AGE_HUD_MOVE_POINTS_MAX, Math.max(1, Math.floor(Number(max) || AGE_HUD_MOVE_POINTS_MAX)));
        const clampedCurrent = Math.max(0, Math.min(clampedMax, Math.floor(Number(current) || 0)));

        el.textContent = String(clampedCurrent);
        el.setAttribute(
            'aria-label',
            `${clampedCurrent} of ${clampedMax} move points. Regain 1 at each game-clock half-hour tick (:00 and :30 UTC).`
        );

        const title = `Regain 1 move point at every :00 and :30 on the game clock (max ${clampedMax}).`;
        if (item) item.setAttribute('title', title);
    }

    function refreshAgeHudMovePoints() {
        const movement = global.RoyalArmiesAgeMovement;
        if (movement && typeof movement.getMovePoints === 'function') {
            setAgeHudMovePointsDisplay(movement.getMovePoints(), movement.getMovePointsMax());
            return;
        }
        setAgeHudMovePointsDisplay(AGE_HUD_MOVE_POINTS_MAX);
    }

    function isAgeMobileLayout() {
        return global.matchMedia(AGE_MOBILE_LAYOUT_MQ).matches;
    }

    function closeAgeMobileHudPanels() {
        const canvas = global.document.getElementById('age-page-canvas');
        const backdrop = global.document.getElementById('age-mobile-hud-backdrop');
        if (canvas) {
            canvas.classList.remove('is-age-mobile-reports-open', 'is-age-mobile-city-info-open');
        }

        ['age-mobile-toggle-reports', 'age-mobile-toggle-city-info'].forEach((id) => {
            const button = global.document.getElementById(id);
            if (button) button.setAttribute('aria-expanded', 'false');
        });

        if (backdrop) {
            backdrop.hidden = true;
            backdrop.setAttribute('aria-hidden', 'true');
        }
    }

    function openAgeMobileHudPanel(panel) {
        const canvas = global.document.getElementById('age-page-canvas');
        const backdrop = global.document.getElementById('age-mobile-hud-backdrop');
        if (!canvas) return;

        closeAgeMobileHudPanels();

        if (panel === 'reports') {
            canvas.classList.add('is-age-mobile-reports-open');
            global.document.getElementById('age-mobile-toggle-reports')?.setAttribute('aria-expanded', 'true');
        } else if (panel === 'city-info') {
            canvas.classList.add('is-age-mobile-city-info-open');
            global.document.getElementById('age-mobile-toggle-city-info')?.setAttribute('aria-expanded', 'true');
        }

        if (backdrop) {
            backdrop.hidden = false;
            backdrop.setAttribute('aria-hidden', 'false');
        }
    }

    function toggleAgeMobileHudPanel(panel) {
        const canvas = global.document.getElementById('age-page-canvas');
        if (!canvas) return;

        const openClass = panel === 'reports'
            ? 'is-age-mobile-reports-open'
            : 'is-age-mobile-city-info-open';

        if (canvas.classList.contains(openClass)) {
            closeAgeMobileHudPanels();
            return;
        }

        openAgeMobileHudPanel(panel);
    }

    function bindAgeMobileHudControls() {
        const reportsBtn = global.document.getElementById('age-mobile-toggle-reports');
        const cityBtn = global.document.getElementById('age-mobile-toggle-city-info');
        const backdrop = global.document.getElementById('age-mobile-hud-backdrop');

        if (reportsBtn && reportsBtn.dataset.ageMobileHudBound !== 'true') {
            reportsBtn.dataset.ageMobileHudBound = 'true';
            reportsBtn.addEventListener('click', () => toggleAgeMobileHudPanel('reports'));
        }

        if (cityBtn && cityBtn.dataset.ageMobileHudBound !== 'true') {
            cityBtn.dataset.ageMobileHudBound = 'true';
            cityBtn.addEventListener('click', () => toggleAgeMobileHudPanel('city-info'));
        }

        if (backdrop && backdrop.dataset.ageMobileHudBound !== 'true') {
            backdrop.dataset.ageMobileHudBound = 'true';
            backdrop.addEventListener('click', closeAgeMobileHudPanels);
        }

        if (global.document.body.dataset.ageMobileHudResizeBound !== 'true') {
            global.document.body.dataset.ageMobileHudResizeBound = 'true';
            global.addEventListener('resize', () => {
                if (!isAgeMobileLayout()) closeAgeMobileHudPanels();
            }, { passive: true });
        }

        global.document.addEventListener('click', (event) => {
            const viewTab = event.target.closest('[data-age-view-tab]');
            if (viewTab && viewTab.getAttribute('data-age-view-tab') !== 'map') {
                closeAgeMobileHudPanels();
            }
        });

        global.document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            closeAgeMobileHudPanels();
        });
    }

    function refreshNavChrome() {
        const username = resolvePageUsername();
        const avatarUrl = resolveGameAvatarUrl();

        const tag = global.document.getElementById('logged-user-tag');
        const mobileName = global.document.getElementById('game-mobile-nav-username');
        const avatarDesktop = global.document.getElementById('nav-embedded-avatar-crest');
        const avatarMobile = global.document.getElementById('game-mobile-nav-avatar');

        if (tag) tag.textContent = username || 'Commander';
        if (mobileName) mobileName.textContent = username || 'Commander';
        if (avatarDesktop) avatarDesktop.src = avatarUrl;
        if (avatarMobile) avatarMobile.src = avatarUrl;

        if (typeof global.refreshLoggedUserTagDisplay === 'function') {
            global.refreshLoggedUserTagDisplay();
        }
        if (typeof global.hydrateCommanderMembershipFromStorage === 'function') {
            global.hydrateCommanderMembershipFromStorage();
        }
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
                if (typeof global.openPublicCommanderProfileCard === 'function') {
                    global.openPublicCommanderProfileCard(event);
                }
                break;
            case 'edit-profile':
                if (typeof global.openCommanderHubModal === 'function') {
                    global.openCommanderHubModal('profile', event);
                }
                break;
            case 'messages':
                if (typeof global.openCommanderHubMessagesInbox === 'function') {
                    global.openCommanderHubMessagesInbox(event);
                }
                break;
            case 'settings':
                if (typeof global.openCommanderHubModal === 'function') {
                    global.openCommanderHubModal('settings', event);
                }
                break;
            case 'discoveries':
                if (typeof global.openDiscoveriesWorkspace === 'function') {
                    global.openDiscoveriesWorkspace(event);
                }
                break;
            case 'chronicles-battle-pass':
                if (typeof global.openAgeChroniclesBattlePassModal === 'function') {
                    global.openAgeChroniclesBattlePassModal(event);
                }
                break;
            case 'return-to-portal':
                returnToAgePortal();
                break;
            case 'report-player':
                if (typeof global.openReportPlayerFromCommanderMenu === 'function') {
                    global.openReportPlayerFromCommanderMenu(event);
                } else if (global.RoyalArmiesPlayerReport?.openFromCommanderMenu) {
                    global.RoyalArmiesPlayerReport.openFromCommanderMenu(event);
                }
                break;
            case 'logout':
                if (typeof global.handleHeaderAuthAction === 'function') {
                    global.handleHeaderAuthAction();
                } else if (typeof global.triggerMainDashboardLogout === 'function') {
                    global.triggerMainDashboardLogout();
                }
                break;
            default:
                break;
        }
    }

    function redirectToProgression() {
        const target = '/game';
        if (global.RoyalArmiesPageRouteTransition && typeof global.RoyalArmiesPageRouteTransition.navigateTo === 'function') {
            global.RoyalArmiesPageRouteTransition.navigateTo(target);
            return;
        }
        global.location.replace(target);
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

    function bindPageNavigation() {
        global.document.addEventListener('click', (event) => {
            const clip = global.document.getElementById('game-mobile-commander-clip');
            if (!clip || !clip.classList.contains('is-commander-open')) return;
            if (event.target.closest('#game-mobile-commander-clip')) return;
            closeMobileCommanderSubmenu();
        });
    }

    async function bootstrapAgePageSession() {
        if (typeof global.ensurePortalAuthRestored === 'function') {
            await global.ensurePortalAuthRestored();
        }

        if (typeof global.applyLocalDevAutoLogin === 'function' && !resolvePageUsername()) {
            await global.applyLocalDevAutoLogin();
        }

        const username = resolvePageUsername();
        if (!username) {
            global.location.replace('/main');
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
        if (typeof global.refreshAgeHudGold === 'function') {
            global.refreshAgeHudGold();
        }
        if (typeof global.refreshAgeHudProvisions === 'function') {
            global.refreshAgeHudProvisions();
        }

        if (global.RoyalArmiesNationTreasury && typeof global.RoyalArmiesNationTreasury.refresh === 'function') {
            await global.RoyalArmiesNationTreasury.refresh();
        }

        if (global.RoyalArmiesAgeMovement && typeof global.RoyalArmiesAgeMovement.refresh === 'function') {
            try {
                await global.RoyalArmiesAgeMovement.refresh();
            } catch (_err) {
                /* movement sync is optional during boot */
            }
            refreshAgeHudMovePoints();
            refreshAgeHudUnits();
            if (typeof global.refreshAgeHudCommanderRank === 'function') {
                global.refreshAgeHudCommanderRank();
            }
        }

        scheduleAgeMovePointHalfHourRefresh();

        global.setInterval(() => {
            if (global.RoyalArmiesAgeMovement && typeof global.RoyalArmiesAgeMovement.refresh === 'function') {
                global.RoyalArmiesAgeMovement.refresh()
                    .then(() => {
                        refreshAgeHudMovePoints();
                        refreshAgeHudUnits();
                    })
                    .catch(() => {});
            }
        }, 5 * 60 * 1000);
    }

    function applyAgeMapShellLabels() {
        const slug = global.document.body?.dataset?.ageSlug || 'alpha';
        const title = global.document.getElementById('age-map-age-title');
        const label = slug === 'alpha'
            ? 'Age Alpha'
            : `Age ${String(slug).replace(/[^0-9]/g, '') || slug}`;

        if (title) title.textContent = label;
        global.document.title = `Royal Armies — ${label}`;
    }

    function mapViewportRectToLayoutSpace(rect) {
        if (!rect) return rect;
        if (typeof global.RoyalArmiesViewportMetrics?.clientRectToDesign === 'function') {
            return global.RoyalArmiesViewportMetrics.clientRectToDesign(rect);
        }
        return rect;
    }

    function resolveLeftColumnBottomLimitPx() {
        const clearance = LEFT_COLUMN_CHAT_CLEARANCE_PX;
        const chatMessages = global.document.getElementById('age-map-bottom-chat-messages-host');
        if (chatMessages) {
            const messagesRect = mapViewportRectToLayoutSpace(chatMessages.getBoundingClientRect());
            if (messagesRect.height > 4 && messagesRect.width > 4) {
                return messagesRect.top - clearance;
            }
        }

        const chatCompose = global.document.getElementById('age-map-bottom-chat-compose-host');
        if (chatCompose) {
            const composeRect = mapViewportRectToLayoutSpace(chatCompose.getBoundingClientRect());
            if (composeRect.height > 4 && composeRect.width > 4) {
                return composeRect.top - clearance;
            }
        }

        const bottomDock = global.document.querySelector('#age-page-canvas .age-map-hud--bottom');
        if (bottomDock) {
            const dockRect = mapViewportRectToLayoutSpace(bottomDock.getBoundingClientRect());
            if (dockRect.height > 4) {
                return dockRect.top - clearance;
            }
        }

        const canvas = global.document.getElementById('age-page-canvas');
        const layoutHeight = canvas
            ? parseFloat(global.getComputedStyle(canvas).getPropertyValue('--ra-layout-vh'))
            : NaN;
        if (Number.isFinite(layoutHeight) && layoutHeight > 0) {
            return layoutHeight;
        }

        return global.window.innerHeight;
    }

    function retainAgePageLoadingGate() {
        global.RoyalArmiesPageLoadingGate?.retain?.('age-page-boot');
    }

    async function releaseAgePageLoadingGate() {
        scheduleCouncilBoardLayoutUntilStable(24);
        await new Promise((resolve) => {
            global.requestAnimationFrame(() => {
                try {
                    syncCouncilBoardLayoutToMap();
                } catch (err) {
                    console.warn('[RIFT] Council board layout sync failed during boot release:', err);
                }
                global.requestAnimationFrame(resolve);
            });
        });
        await global.RoyalArmiesPageLoadingGate?.release?.('age-page-boot');
    }

    function readAgeMapSlotTopPx(canvas) {
        if (!canvas) return 0;
        const raw = global.getComputedStyle(canvas).getPropertyValue('--age-map-slot-top');
        const parsed = parseFloat(raw);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function resolveMapFrameLayoutRect(mapFrame) {
        const anchor = mapFrame.closest('.age-map-anchor');
        const measured = mapFrame.getBoundingClientRect();
        if (!anchor) {
            return measured.width >= 8 && measured.height >= 8
                ? mapViewportRectToLayoutSpace(measured)
                : null;
        }

        const anchorRect = anchor.getBoundingClientRect();
        if (anchorRect.width < 8 || anchorRect.height < 8) {
            return measured.width >= 8 && measured.height >= 8
                ? mapViewportRectToLayoutSpace(measured)
                : null;
        }

        const mapSize = Math.min(MAP_FRAME_LAYOUT_MAX_EDGE, anchorRect.width, anchorRect.height);
        const estimated = {
            left: anchorRect.left + ((anchorRect.width - mapSize) / 2),
            top: anchorRect.top + ((anchorRect.height - mapSize) / 2),
            width: mapSize,
            height: mapSize,
            right: anchorRect.left + ((anchorRect.width + mapSize) / 2),
            bottom: anchorRect.top + ((anchorRect.height + mapSize) / 2)
        };

        if (measured.width < 8 || measured.height < 8) {
            return mapViewportRectToLayoutSpace(estimated);
        }

        const canvas = global.document.getElementById('age-page-canvas');
        const slotTop = readAgeMapSlotTopPx(canvas);
        const layoutMeasured = mapViewportRectToLayoutSpace(measured);
        const minTop = slotTop > 0 ? slotTop - 12 : layoutMeasured.top;
        const measuredLooksStaged = layoutMeasured.top < minTop
            || (
                measured.width >= anchorRect.width * 0.94
                && measured.height >= anchorRect.height * 0.94
                && Math.abs(measured.left - anchorRect.left) < 3
            );
        const layoutEstimated = mapViewportRectToLayoutSpace(estimated);

        if (measuredLooksStaged) {
            return layoutEstimated;
        }

        const deltaLeft = Math.abs(layoutMeasured.left - layoutEstimated.left);
        const deltaTop = Math.abs(layoutMeasured.top - layoutEstimated.top);
        const deltaSize = Math.abs(layoutMeasured.width - layoutEstimated.width);
        if (deltaLeft > 48 || deltaTop > 48 || deltaSize > 48) {
            return layoutEstimated;
        }

        return layoutMeasured;
    }

    function scheduleCouncilBoardLayoutUntilStable(maxFrames = COUNCIL_LAYOUT_RETRY_MAX_FRAMES) {
        if (councilLayoutStabilizeRaf) {
            global.cancelAnimationFrame(councilLayoutStabilizeRaf);
        }
        councilLayoutStableFrames = 0;

        let frames = 0;
        const tick = () => {
            councilLayoutStabilizeRaf = 0;
            frames += 1;
            const before = lastCouncilLayoutKey;
            syncCouncilBoardLayoutToMap();
            const stable = Boolean(before) && before === lastCouncilLayoutKey;
            councilLayoutStableFrames = stable ? councilLayoutStableFrames + 1 : 0;
            if (councilLayoutStableFrames >= 2 || frames >= maxFrames) return;
            councilLayoutStabilizeRaf = global.requestAnimationFrame(tick);
        };

        councilLayoutStabilizeRaf = global.requestAnimationFrame(tick);
    }

    function measureReportsPanelHeightPx(reportsPanel) {
        if (!reportsPanel) return RIGHT_REPORTS_MIN_HEIGHT_PX;

        const tabs = reportsPanel.querySelector('.age-left-reports-tabs');
        const activePanel = reportsPanel.querySelector('.age-left-reports-tabpanel:not([hidden])')
            || reportsPanel.querySelector('.age-left-reports-tabpanel.is-active');
        const styles = global.getComputedStyle(reportsPanel);
        const paddingY = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
        const gap = parseFloat(styles.rowGap || styles.gap) || 0;
        const tabsHeight = tabs ? Math.ceil(tabs.getBoundingClientRect().height) : 0;
        const panelContentHeight = activePanel ? Math.ceil(activePanel.scrollHeight) : 0;

        return Math.max(
            RIGHT_REPORTS_MIN_HEIGHT_PX,
            Math.ceil(paddingY + tabsHeight + (tabsHeight > 0 ? gap : 0) + panelContentHeight)
        );
    }

    function isAgeMapWorkspaceOverlayActive() {
        const body = global.document.body;
        if (
            body?.classList.contains('age-barracks-open')
            || body?.classList.contains('age-unit-evolution-open')
            || body?.classList.contains('age-guild-training-open')
            || body?.classList.contains('age-guild-overlay-open')
            || body?.classList.contains('age-council-room-open')
            || body?.classList.contains('age-records-open')
            || body?.classList.contains('age-war-room-open')
        ) {
            return true;
        }

        return Boolean(
            global.RoyalArmiesAgeHeadquarters?.isCouncilRoomOpen?.()
            || global.RoyalArmiesAgeRecords?.isWorkspaceOpen?.()
            || global.RoyalArmiesAgeArmyGroups?.isWorkspaceOpen?.()
        );
    }

    function syncCouncilBoardLayoutToMap() {
        const canvas = global.document.getElementById('age-page-canvas');
        const mapFrame = global.document.querySelector('#age-page-canvas .age-map-frame');
        if (!canvas || !mapFrame) return;

        if (isAgeMapWorkspaceOverlayActive()) {
            return;
        }

        if (isAgeMobileLayout()) {
            canvas.classList.remove('is-age-hud-layout-pending');
            [
                '--age-council-board-top',
                '--age-council-board-left',
                '--age-council-board-width',
                '--age-council-board-height',
                '--age-left-column-height',
                '--age-right-hud-height',
                '--age-right-reports-height'
            ].forEach((prop) => canvas.style.removeProperty(prop));
            lastCouncilLayoutKey = '';
            return;
        }

        const gap = COUNCIL_BOARD_MAP_GAP_PX;
        const leftPosition = Math.max(
            COUNCIL_BOARD_LEFT_POSITION_PX,
            parseFloat(global.getComputedStyle(canvas).getPropertyValue('padding-left')) || 0
        );
        canvas.style.setProperty('--age-council-board-left', `${leftPosition}px`);

        const mapRect = resolveMapFrameLayoutRect(mapFrame);
        if (!mapRect || mapRect.width < 8 || mapRect.height < 8) {
            canvas.classList.add('is-age-hud-layout-pending');
            return;
        }

        const width = Math.max(
            COUNCIL_BOARD_MIN_WIDTH_PX,
            mapRect.left - gap - leftPosition
        );
        const top = mapRect.top;
        const councilHeight = Math.max(COUNCIL_BOARD_MIN_HEIGHT_PX, mapRect.height);

        canvas.style.setProperty('--age-council-board-top', `${top}px`);
        canvas.style.setProperty('--age-council-board-width', `${width}px`);
        canvas.style.setProperty('--age-council-board-height', `${councilHeight}px`);
        canvas.style.removeProperty('--age-left-reports-height');
        canvas.style.setProperty('--age-left-column-height', `${councilHeight}px`);

        const rightHud = global.document.getElementById('age-map-hud-right');
        const reportsPanel = rightHud?.querySelector('.age-left-reports-panel');
        const playersOpen = Boolean(rightHud?.classList.contains('is-city-info-players-open'));
        const settlementOpen = Boolean(rightHud?.classList.contains('is-settlement-view-open'));

        if (rightHud && reportsPanel && !playersOpen && !settlementOpen) {
            const reportsContentHeight = measureReportsPanelHeightPx(reportsPanel);
            const finalReportsHeight = Math.max(RIGHT_REPORTS_MIN_HEIGHT_PX, reportsContentHeight);

            canvas.style.setProperty('--age-right-reports-height', `${finalReportsHeight}px`);
        } else {
            canvas.style.removeProperty('--age-right-reports-height');
        }

        canvas.style.removeProperty('--age-right-hud-height');
        canvas.classList.remove('is-age-hud-layout-pending');
        lastCouncilLayoutKey = `${top}|${width}|${councilHeight}|${leftPosition}`;
        syncHeadquartersPlanningLayout();

        if (global.RoyalArmiesCouncilBoard?.syncEditorPreviewViewport) {
            global.RoyalArmiesCouncilBoard.syncEditorPreviewViewport();
        }
    }

    function clearHeadquartersPlanningLayoutVars(canvas) {
        if (!canvas) return;
        [
            '--age-hq-planning-scale',
            '--age-hq-planning-map-size',
            '--age-hq-planning-stage-height',
            '--age-hq-planning-hint-block',
            '--age-hq-command-rail-translate-x',
            '--age-hq-command-rail-translate-y'
        ].forEach((prop) => canvas.style.removeProperty(prop));
    }

    function syncHeadquartersPlanningLayout() {
        const canvas = global.document.getElementById('age-page-canvas');
        if (!canvas || !global.RoyalArmiesAgeHeadquarters?.isCouncilRoomOpen?.()) {
            clearHeadquartersPlanningLayoutVars(canvas);
            return;
        }

        if (isAgeMobileLayout()) {
            clearHeadquartersPlanningLayoutVars(canvas);
            return;
        }

        const workspace = global.document.getElementById('age-council-room-workspace');
        const planningColumn = workspace?.querySelector('.age-council-room-planning-block:not([hidden])');
        if (!workspace || !planningColumn) {
            clearHeadquartersPlanningLayoutVars(canvas);
            return;
        }

        const hint = planningColumn.querySelector('.age-hq-planning-hint');
        const columnRect = planningColumn.getBoundingClientRect();
        const columnStyles = global.getComputedStyle(planningColumn);
        const padTop = parseFloat(columnStyles.paddingTop) || 0;
        const padBottom = parseFloat(columnStyles.paddingBottom) || 0;
        const columnGap = parseFloat(columnStyles.gap) || 0;
        const hintHeight = hint ? Math.ceil(hint.getBoundingClientRect().height) : 0;
        const hintBlock = hintHeight > 0 ? hintHeight + columnGap : 0;

        const workspaceRect = workspace.getBoundingClientRect();
        const bottomLimit = Math.min(
            resolveLeftColumnBottomLimitPx(),
            workspaceRect.bottom
        );
        const availableHeight = Math.max(
            HQ_PLANNING_BASE_MAP_PX,
            bottomLimit - columnRect.top - padTop - padBottom - hintBlock
                - HQ_PLANNING_LAYOUT_CLEARANCE_PX - HQ_PLANNING_EDGE_BLEED_PX
        );

        const chromeBase = HQ_PLANNING_BASE_RAIL_PX
            + HQ_PLANNING_BASE_TOOLBAR_PX
            + HQ_PLANNING_BASE_COMMAND_RAIL_PX
            + (HQ_PLANNING_BASE_GAP_PX * 3);
        const widthDenominator = chromeBase + HQ_PLANNING_BASE_MAP_PX;
        const availableWidth = Math.max(widthDenominator, planningColumn.clientWidth);

        const scaleFromHeight = availableHeight / HQ_PLANNING_BASE_MAP_PX;
        const scaleFromWidth = availableWidth / widthDenominator;
        const scale = Math.max(1, Math.min(scaleFromHeight, scaleFromWidth));
        const mapSize = Math.floor(HQ_PLANNING_BASE_MAP_PX * scale);

        canvas.style.setProperty('--age-hq-planning-scale', scale.toFixed(4));
        canvas.style.setProperty('--age-hq-planning-map-size', `${mapSize}px`);
        canvas.style.setProperty('--age-hq-planning-stage-height', `${mapSize}px`);
        canvas.style.setProperty('--age-hq-planning-hint-block', `${hintBlock + padBottom}px`);
        global.requestAnimationFrame(syncHeadquartersCommandRailLayout);
    }

    function readHeadquartersLayoutVar(canvas, name) {
        const raw = canvas.style.getPropertyValue(name);
        const parsed = parseFloat(raw);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function syncHeadquartersCommandRailLayout() {
        const canvas = global.document.getElementById('age-page-canvas');
        if (!canvas || !global.RoyalArmiesAgeHeadquarters?.isCouncilRoomOpen?.()) {
            return;
        }

        canvas.style.removeProperty('--age-hq-command-rail-translate-x');
        canvas.style.removeProperty('--age-hq-command-rail-translate-y');

        const commandRail = global.document.querySelector('.age-council-room-council-grid:not([hidden])');
        const toolbar = global.document.getElementById('age-hq-planning-toolbar');
        const treasuryRail = global.document.querySelector('.age-council-room-fortifications');
        if (!commandRail || !toolbar || !treasuryRail) {
            return;
        }

        const toolbarRect = toolbar.getBoundingClientRect();
        const treasuryRect = treasuryRail.getBoundingClientRect();
        const commandRect = commandRail.getBoundingClientRect();
        const commandWidth = commandRect.width;
        const commandHeight = commandRect.height;
        if (commandWidth < 8 || commandHeight < 8 || toolbarRect.width < 8 || treasuryRect.width < 8) {
            return;
        }

        const prevTranslateX = readHeadquartersLayoutVar(canvas, '--age-hq-command-rail-translate-x');
        const prevTranslateY = readHeadquartersLayoutVar(canvas, '--age-hq-command-rail-translate-y');
        const naturalLeft = commandRect.left - prevTranslateX;
        const naturalTop = commandRect.top - prevTranslateY;

        const stage = commandRail.closest('.age-hq-planning-stage');
        const stageGap = stage
            ? (parseFloat(global.getComputedStyle(stage).columnGap || global.getComputedStyle(stage).gap) || 0)
            : 0;
        const gapLeft = toolbarRect.right + stageGap;
        const gapRight = treasuryRect.left;
        const gapWidth = gapRight - gapLeft;
        const gapTop = Math.min(toolbarRect.top, treasuryRect.top);
        const gapBottom = Math.max(toolbarRect.bottom, treasuryRect.bottom);
        const gapHeight = gapBottom - gapTop;

        let translateX = 0;
        if (gapWidth > commandWidth) {
            const targetLeft = gapLeft + ((gapWidth - commandWidth) / 2);
            translateX = targetLeft - naturalLeft;
        }

        let translateY = 0;
        if (gapHeight > commandHeight) {
            const targetTop = gapTop + ((gapHeight - commandHeight) / 2);
            translateY = targetTop - naturalTop;
        }

        canvas.style.setProperty('--age-hq-command-rail-translate-x', `${translateX.toFixed(2)}px`);
        canvas.style.setProperty('--age-hq-command-rail-translate-y', `${translateY.toFixed(2)}px`);
    }

    global.syncAgeHeadquartersCommandRailLayout = syncHeadquartersCommandRailLayout;

    global.syncAgeMapHudLayout = syncCouncilBoardLayoutToMap;
    global.syncAgeHeadquartersPlanningLayout = syncHeadquartersPlanningLayout;

    function bindCouncilBoardLayoutSync() {
        const mapFrame = global.document.querySelector('#age-page-canvas .age-map-frame');
        if (!mapFrame) return;

        const runSync = () => {
            if (typeof global.RoyalArmiesViewportMetrics?.schedule === 'function') {
                global.RoyalArmiesViewportMetrics.schedule();
            }
            global.requestAnimationFrame(() => {
                syncCouncilBoardLayoutToMap();
                syncHeadquartersPlanningLayout();
                syncHeadquartersCommandRailLayout();
                global.RoyalArmiesAgeHeadquartersPlanningMap?.refreshLayout?.();
                scheduleCouncilBoardLayoutUntilStable(48);
            });
        };

        runSync();

        const mapBgImage = global.document.getElementById('age-world-map-bg-image');
        if (mapBgImage && mapBgImage.dataset.ageCouncilLayoutBound !== 'true') {
            mapBgImage.dataset.ageCouncilLayoutBound = 'true';
            if (mapBgImage.complete) {
                runSync();
            } else {
                mapBgImage.addEventListener('load', runSync, { once: true, passive: true });
            }
        }

        global.addEventListener('load', runSync, { once: true, passive: true });
        global.addEventListener('resize', runSync, { passive: true });
        global.addEventListener('royalarmies:viewport-metrics-updated', runSync, { passive: true });
        if (global.visualViewport) {
            global.visualViewport.addEventListener('resize', runSync, { passive: true });
        }

        if (typeof global.ResizeObserver === 'function') {
            if (councilBoardLayoutObserver) {
                councilBoardLayoutObserver.disconnect();
            }
            councilBoardLayoutObserver = new global.ResizeObserver(runSync);
            councilBoardLayoutObserver.observe(mapFrame);

            const anchor = global.document.querySelector('#age-page-canvas .age-map-anchor');
            if (anchor) councilBoardLayoutObserver.observe(anchor);

            const chatMessages = global.document.getElementById('age-map-bottom-chat-messages-host');
            const chatCompose = global.document.getElementById('age-map-bottom-chat-compose-host');
            const bottomDock = global.document.querySelector('#age-page-canvas .age-map-hud--bottom');
            const rightHud = global.document.getElementById('age-map-hud-right');
            const reportsPanel = rightHud?.querySelector('.age-left-reports-panel');
            const cityInfoPanel = rightHud?.querySelector('.age-city-info-panel');
            if (chatMessages) councilBoardLayoutObserver.observe(chatMessages);
            if (chatCompose) councilBoardLayoutObserver.observe(chatCompose);
            if (bottomDock) councilBoardLayoutObserver.observe(bottomDock);
            if (rightHud) councilBoardLayoutObserver.observe(rightHud);
            if (reportsPanel) councilBoardLayoutObserver.observe(reportsPanel);
            if (cityInfoPanel) councilBoardLayoutObserver.observe(cityInfoPanel);

            const hqWorkspace = global.document.getElementById('age-council-room-workspace');
            const hqPlanningColumn = hqWorkspace?.querySelector('.age-council-room-planning-block');
            const hqPlanningStage = hqWorkspace?.querySelector('.age-council-room-planning-stage');
            const hqCommandRail = hqWorkspace?.querySelector('.age-council-room-council-grid');
            const hqTreasuryRail = hqWorkspace?.querySelector('.age-council-room-fortifications');
            const hqToolbar = global.document.getElementById('age-hq-planning-toolbar');
            if (hqWorkspace) councilBoardLayoutObserver.observe(hqWorkspace);
            if (hqPlanningColumn) councilBoardLayoutObserver.observe(hqPlanningColumn);
            if (hqPlanningStage) councilBoardLayoutObserver.observe(hqPlanningStage);
            if (hqCommandRail) councilBoardLayoutObserver.observe(hqCommandRail);
            if (hqTreasuryRail) councilBoardLayoutObserver.observe(hqTreasuryRail);
            if (hqToolbar) councilBoardLayoutObserver.observe(hqToolbar);
        }
    }

    async function bootAgePageDeferred() {
        if (typeof global.enableAgeCouncilBoard === 'function') {
            await global.enableAgeCouncilBoard();
        }

        if (typeof global.enableAgeLeftReportsPanel === 'function') {
            global.enableAgeLeftReportsPanel();
        }

        if (typeof global.enableAgeQuickTipsPanel === 'function') {
            global.enableAgeQuickTipsPanel();
        }

        if (typeof global.enableAgeWarLedger === 'function') {
            global.enableAgeWarLedger();
        }

        if (typeof global.enableAgeRecords === 'function') {
            global.enableAgeRecords();
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
    }

    async function bootAgePage() {
        if (shouldAllowAgeDevBypass()) {
            markGameSessionStarted();
            consumeAgeDevBypassQuery();
        } else if (!isGameSessionStarted()) {
            redirectToProgression();
            return;
        }

        applyAgeMapShellLabels();
        refreshAgeHudMovePoints();
        bindCouncilBoardLayoutSync();

        bindPageNavigation();
        bindAgeMobileHudControls();
        registerUnloadHandlers();

        retainAgePageLoadingGate();
        try {
            try {
                await bootstrapAgePageSession();
            } catch (err) {
                console.warn('[RIFT] Age page bootstrap failed:', err);
            }

            initializeAgePageUniversalGameTimeClock();

            const criticalBoot = [];

            if (typeof global.enableAgeWorldMap === 'function') {
                criticalBoot.push(
                    global.enableAgeWorldMap().catch((err) => {
                        console.warn('[RIFT] Age world map failed to initialize:', err);
                    })
                );
            }
            if (typeof global.RoyalArmiesGameChat?.enableForOfficialAge === 'function') {
                criticalBoot.push(global.RoyalArmiesGameChat.enableForOfficialAge());
            }

            await Promise.all(criticalBoot);

            if (typeof global.enableAgeWorldPlanOverlay === 'function') {
                global.enableAgeWorldPlanOverlay().catch((err) => {
                    console.warn('[RIFT] Age world plan overlay failed to initialize:', err);
                });
            }

            if (typeof global.enableAgeDispatchAlert === 'function') {
                global.enableAgeDispatchAlert().catch((err) => {
                    console.warn('[RIFT] Age dispatch alert failed to initialize:', err);
                });
            }

            if (typeof global.enableAgeMovementPanel === 'function') {
                global.enableAgeMovementPanel();
            }

            const bootCatalogCityId = global.RoyalArmiesAgeMovement?.getCatalogCityId?.();
            if (bootCatalogCityId) {
                global.RoyalArmiesAgeMovementPanel?.syncCatalogCity?.(bootCatalogCityId);
                global.RoyalArmiesAgeWorldMap?.refreshPlayerCity?.();
            }
            global.RoyalArmiesAgeWorldMap?.refreshNationCityHighlights?.();

            if (typeof global.enableAgeViewTabs === 'function') {
                global.enableAgeViewTabs();
            }

            if (typeof global.enableAgeHeadquarters === 'function') {
                global.enableAgeHeadquarters();
            }

            if (typeof global.requestAnimationFrame === 'function') {
                global.requestAnimationFrame(syncCouncilBoardLayoutToMap);
            }

            await bootAgePageDeferred();
        } finally {
            await releaseAgePageLoadingGate();
            if (typeof global.RoyalArmiesDiscoveries?.runPendingStarterSongDiscoveries === 'function') {
                global.RoyalArmiesDiscoveries.runPendingStarterSongDiscoveries();
            }
        }
    }

    global.returnToGameAgePortal = returnToAgePortal;
    global.toggleGameMobileCommanderSubmenu = toggleMobileCommanderSubmenu;
    global.gameMobileNavCommanderAction = gameMobileNavCommanderAction;
    global.setAgeHudUnitsDisplay = setAgeHudUnitsDisplay;
    global.refreshAgeHudUnits = refreshAgeHudUnits;
    global.formatAgeHudUnitsDisplay = formatAgeHudUnitsDisplay;
    global.isAgeHudUnitsLowHealth = isAgeHudUnitsLowHealth;
    global.isAgeHudUnitsCriticalHealth = isAgeHudUnitsCriticalHealth;
    global.setAgeHudMovePointsDisplay = setAgeHudMovePointsDisplay;
    global.refreshAgeHudMovePoints = refreshAgeHudMovePoints;
    global.AGE_HUD_MOVE_POINTS_MAX = AGE_HUD_MOVE_POINTS_MAX;
    global.AGE_HUD_MOVE_POINT_REGEN_TICK_MINUTES = AGE_HUD_MOVE_POINT_REGEN_TICK_MINUTES;

    global.addEventListener('royalarmies:age-movement-updated', () => {
        refreshAgeHudMovePoints();
        refreshAgeHudUnits();
    });

    global.document.addEventListener('visibilitychange', () => {
        if (global.document.visibilityState !== 'visible') return;
        refreshAgeHudMovePoints();
        scheduleAgeMovePointHalfHourRefresh();
        if (global.RoyalArmiesAgeMovement && typeof global.RoyalArmiesAgeMovement.refresh === 'function') {
            global.RoyalArmiesAgeMovement.refresh()
                .then(() => {
                    refreshAgeHudMovePoints();
                    refreshAgeHudUnits();
                })
                .catch(() => {});
        }
    });

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', bootAgePage);
    } else {
        bootAgePage();
    }
})(window);

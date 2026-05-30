/**
 * RIFT — Official age session page (agealpha.html, later age[N].html).
 */
(function initRoyalArmiesAgePage(global) {
    'use strict';

    const GAME_PRESENCE_HEARTBEAT_MS = 20000;
    const ACTIVE_AGE_STORAGE_KEY = 'savedCommanderInActiveAge';
    const COUNCIL_BOARD_MAP_GAP_PX = 10;
    const COUNCIL_BOARD_LEFT_POSITION_PX = 166;
    const COUNCIL_BOARD_RIGHT_INSET_EXTRA_PX = 20;
    const COUNCIL_BOARD_MIN_WIDTH_PX = 220;
    const COUNCIL_BOARD_MIN_HEIGHT_PX = 160;
    const LEFT_HUD_STACK_GAP_PX = 10;
    const LEFT_REPORTS_MIN_HEIGHT_PX = 150;
    const LEFT_COLUMN_CHAT_CLEARANCE_PX = 10;

    let councilBoardLayoutObserver = null;

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
                    ageSlug: global.document.body?.dataset?.ageSlug || 'alpha'
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

        try {
            await global.fetch(resolveApiUrl('/api/portal/presence'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, inAge: true }),
                cache: 'no-store',
                credentials: 'include'
            });
        } catch (err) {
            console.warn('Age presence heartbeat failed:', err);
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
            await global.RoyalArmiesPageRouteTransition.navigateTo('/main.html');
            return;
        }
        global.location.href = '/main.html';
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

    function refreshAgeHudUnits() {
        setAgeHudUnitsDisplay(2, 12);
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
            global.dispatchEvent(new CustomEvent('royalarmies:age-movement-updated'));

            if (movement && typeof movement.refresh === 'function') {
                movement.refresh()
                    .then(() => {
                        refreshAgeHudMovePoints();
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
            case 'return-to-portal':
                returnToAgePortal();
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
        const target = '/game.html';
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
            global.location.replace('/main.html');
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
        }

        scheduleAgeMovePointHalfHourRefresh();

        global.setInterval(() => {
            if (global.RoyalArmiesAgeMovement && typeof global.RoyalArmiesAgeMovement.refresh === 'function') {
                global.RoyalArmiesAgeMovement.refresh()
                    .then(() => refreshAgeHudMovePoints())
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

    function resolveLeftColumnBottomLimitPx() {
        const clearance = LEFT_COLUMN_CHAT_CLEARANCE_PX;
        const chatMessages = global.document.getElementById('age-map-bottom-chat-messages-host');
        if (chatMessages) {
            const messagesRect = chatMessages.getBoundingClientRect();
            if (messagesRect.height > 4 && messagesRect.width > 4) {
                return messagesRect.top - clearance;
            }
        }

        const chatCompose = global.document.getElementById('age-map-bottom-chat-compose-host');
        if (chatCompose) {
            const composeRect = chatCompose.getBoundingClientRect();
            if (composeRect.height > 4 && composeRect.width > 4) {
                return composeRect.top - clearance;
            }
        }

        const bottomDock = global.document.querySelector('#age-page-canvas .age-map-hud--bottom');
        if (bottomDock) {
            const dockRect = bottomDock.getBoundingClientRect();
            if (dockRect.height > 4) {
                return dockRect.top - clearance;
            }
        }

        return global.window.innerHeight;
    }

    function syncCouncilBoardLayoutToMap() {
        const canvas = global.document.getElementById('age-page-canvas');
        const mapFrame = global.document.querySelector('#age-page-canvas .age-map-frame');
        if (!canvas || !mapFrame) return;

        const mapRect = mapFrame.getBoundingClientRect();
        if (mapRect.width < 8 || mapRect.height < 8) return;

        const gap = COUNCIL_BOARD_MAP_GAP_PX;
        const leftPosition = COUNCIL_BOARD_LEFT_POSITION_PX;
        const width = Math.max(
            COUNCIL_BOARD_MIN_WIDTH_PX,
            mapRect.left - gap - COUNCIL_BOARD_RIGHT_INSET_EXTRA_PX - leftPosition
        );
        const top = mapRect.top + gap;
        const bottomLimit = resolveLeftColumnBottomLimitPx();
        const availableHeight = Math.max(
            COUNCIL_BOARD_MIN_HEIGHT_PX + LEFT_HUD_STACK_GAP_PX + LEFT_REPORTS_MIN_HEIGHT_PX,
            bottomLimit - top
        );
        const councilHeight = Math.max(
            COUNCIL_BOARD_MIN_HEIGHT_PX,
            Math.min(availableHeight - LEFT_HUD_STACK_GAP_PX - LEFT_REPORTS_MIN_HEIGHT_PX, availableHeight * 0.5)
        );
        const reportsHeight = Math.max(
            LEFT_REPORTS_MIN_HEIGHT_PX,
            availableHeight - councilHeight - LEFT_HUD_STACK_GAP_PX
        );
        const leftColumnHeight = councilHeight + LEFT_HUD_STACK_GAP_PX + reportsHeight;

        canvas.style.setProperty('--age-council-board-top', `${top}px`);
        canvas.style.setProperty('--age-council-board-left', `${leftPosition}px`);
        canvas.style.setProperty('--age-council-board-width', `${width}px`);
        canvas.style.setProperty('--age-council-board-height', `${councilHeight}px`);
        canvas.style.setProperty('--age-left-column-height', `${leftColumnHeight}px`);
        canvas.style.setProperty('--age-left-reports-height', `${reportsHeight}px`);
    }

    function bindCouncilBoardLayoutSync() {
        const mapFrame = global.document.querySelector('#age-page-canvas .age-map-frame');
        if (!mapFrame) return;

        const runSync = () => {
            global.requestAnimationFrame(syncCouncilBoardLayoutToMap);
        };

        runSync();
        global.addEventListener('resize', runSync, { passive: true });

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
            if (chatMessages) councilBoardLayoutObserver.observe(chatMessages);
            if (chatCompose) councilBoardLayoutObserver.observe(chatCompose);
            if (bottomDock) councilBoardLayoutObserver.observe(bottomDock);
        }
    }

    async function bootAgePageDeferred() {
        if (typeof global.enableAgeCouncilBoard === 'function') {
            await global.enableAgeCouncilBoard();
        }

        if (typeof global.enableAgeLeftReportsPanel === 'function') {
            global.enableAgeLeftReportsPanel();
        }

        bindCouncilBoardLayoutSync();

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
        refreshAgeHudUnits();
        refreshAgeHudMovePoints();

        bindPageNavigation();
        registerUnloadHandlers();
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

        if (typeof global.requestAnimationFrame === 'function') {
            global.requestAnimationFrame(syncCouncilBoardLayoutToMap);
        }

        if (typeof global.requestAnimationFrame === 'function') {
            global.requestAnimationFrame(() => {
                void bootAgePageDeferred();
            });
        } else {
            void bootAgePageDeferred();
        }
    }

    global.returnToGameAgePortal = returnToAgePortal;
    global.toggleGameMobileCommanderSubmenu = toggleMobileCommanderSubmenu;
    global.gameMobileNavCommanderAction = gameMobileNavCommanderAction;
    global.setAgeHudUnitsDisplay = setAgeHudUnitsDisplay;
    global.formatAgeHudUnitsDisplay = formatAgeHudUnitsDisplay;
    global.isAgeHudUnitsLowHealth = isAgeHudUnitsLowHealth;
    global.isAgeHudUnitsCriticalHealth = isAgeHudUnitsCriticalHealth;
    global.setAgeHudMovePointsDisplay = setAgeHudMovePointsDisplay;
    global.refreshAgeHudMovePoints = refreshAgeHudMovePoints;
    global.AGE_HUD_MOVE_POINTS_MAX = AGE_HUD_MOVE_POINTS_MAX;
    global.AGE_HUD_MOVE_POINT_REGEN_TICK_MINUTES = AGE_HUD_MOVE_POINT_REGEN_TICK_MINUTES;

    global.addEventListener('royalarmies:age-movement-updated', () => {
        refreshAgeHudMovePoints();
    });

    global.document.addEventListener('visibilitychange', () => {
        if (global.document.visibilityState !== 'visible') return;
        refreshAgeHudMovePoints();
        scheduleAgeMovePointHalfHourRefresh();
        if (global.RoyalArmiesAgeMovement && typeof global.RoyalArmiesAgeMovement.refresh === 'function') {
            global.RoyalArmiesAgeMovement.refresh()
                .then(() => refreshAgeHudMovePoints())
                .catch(() => {});
        }
    });

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', bootAgePage);
    } else {
        bootAgePage();
    }
})(window);

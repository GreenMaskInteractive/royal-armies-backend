/**
 * RIFT — Age Alpha map-only shell (world map + plan tools + map HUD report/city-info tabs).
 */
(function initAgeMapOnlyPage(global) {
    'use strict';

    const MAP_ROOT_ID = 'age-world-map';
    const MAP_INTERACTIVE_SELECTOR = [
        `#${MAP_ROOT_ID}`,
        `#${MAP_ROOT_ID} *`,
        '#age-world-map-frame',
        '#age-world-map-frame *',
        '.age-world-map-labels-host .age-world-map-label--city'
    ].join(', ');

    const COUNCIL_BOARD_MAP_GAP_PX = 10;
    const COUNCIL_BOARD_LEFT_OFFSET_PX = 150;
    const COUNCIL_BOARD_RIGHT_TRIM_PX = 10;
    const COUNCIL_BOARD_BOTTOM_TRIM_PX = 500;
    const COUNCIL_BOARD_REPORTS_LIFT_PX = 35;
    const COUNCIL_BOARD_MIN_WIDTH_PX = 220;
    const COUNCIL_BOARD_MIN_HEIGHT_PX = 160;
    const LEFT_HUD_STACK_GAP_PX = 10;
    const LEFT_REPORTS_MIN_HEIGHT_PX = 120;
    const MAP_FRAME_LAYOUT_MAX_EDGE = 1642;
    const AGE_MOBILE_LAYOUT_MQ = '(max-width: 1024px)';
    const GAME_PRESENCE_HEARTBEAT_MS = 20000;

    let presenceHeartbeatTimer = null;
    let ageSessionLeaveSent = false;

    /** Hub/profile/menu scripts — production agealpha.html omits these; load on demand. */
    const AGE_NAMETAG_HUB_SCRIPT_CHAIN = [
        'rift-error-codes.js?v=commander-nametag-hub-2',
        'rift-error-display.js?v=commander-nametag-hub-2',
        'commander-dossier-sync.js?v=map-ambient-effects-1',
        'rank-data.js?v=commander-nametag-hub-2',
        'rift-ui-sfx.js?v=commander-nametag-hub-2',
        'script.js?v=update-post-logout-1',
        'commander-hub.js?v=modal-close-audit-1',
        'game-chat.js?v=commander-nametag-hub-2',
        'portal-commander-identity-menu.js?v=remove-return-portal-1'
    ];

    const ageNametagHubScriptsLoaded = new Set();
    let ageNametagHubEnsurePromise = null;

    function loadAgeNametagHubScript(src) {
        if (ageNametagHubScriptsLoaded.has(src)) {
            return Promise.resolve();
        }

        const existing = global.document.querySelector(`script[src="${src}"]`);
        if (existing) {
            ageNametagHubScriptsLoaded.add(src);
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const script = global.document.createElement('script');
            script.src = src;
            script.async = false;
            script.onload = () => {
                ageNametagHubScriptsLoaded.add(src);
                resolve();
            };
            script.onerror = () => reject(new Error(`[RIFT] Failed to load ${src}`));
            global.document.head.appendChild(script);
        });
    }

    async function ensureAgeCommanderNametagHub() {
        if (typeof global.openCommanderHubModal === 'function'
            && typeof global.portalDesktopCommanderMenuAction === 'function') {
            global.bindPortalCommanderIdentityMenu?.();
            return;
        }

        if (ageNametagHubEnsurePromise) {
            await ageNametagHubEnsurePromise;
            return;
        }

        ageNametagHubEnsurePromise = (async () => {
            for (const src of AGE_NAMETAG_HUB_SCRIPT_CHAIN) {
                await loadAgeNametagHubScript(src);
            }
            global.bindPortalCommanderIdentityMenu?.();
        })();

        try {
            await ageNametagHubEnsurePromise;
        } catch (err) {
            ageNametagHubEnsurePromise = null;
            console.warn('[RIFT] Age commander nametag hub scripts failed to load:', err);
        }
    }

    function resolveAgeCommanderMenuAction(button) {
        if (!button) return null;
        if (button.classList.contains('dropdown-action-item-view-profile')) return 'view-profile';
        if (button.id === 'nav-dropdown-messages-btn') return 'messages';
        if (button.classList.contains('dropdown-action-item-discoveries')) return 'discoveries';
        if (button.id === 'game-nav-dropdown-logout-btn') return 'exit-server';
        if (button.classList.contains('dropdown-action-item-report-player')) return 'report-player';

        const label = String(button.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (label === 'edit profile') return 'edit-profile';
        if (label === 'settings') return 'settings';
        if (label === 'exit server') return 'exit-server';
        return null;
    }

    function bindAgeCommanderNametagMenuDelegation() {
        if (global.document.documentElement.dataset.ageNametagMenuDelegated === 'true') return;
        global.document.documentElement.dataset.ageNametagMenuDelegated = 'true';

        global.document.addEventListener('click', (event) => {
            const button = event.target.closest(
                '#portal-desktop-commander-menu .dropdown-action-item,'
                + ' .portal-commander-identity-menu--age-floating .dropdown-action-item'
            );
            if (!button) return;

            const menu = button.closest('#portal-desktop-commander-menu, .portal-commander-identity-menu--age-floating');
            if (menu?.dataset?.commanderMenuActionsBound === 'true') return;

            const action = resolveAgeCommanderMenuAction(button);
            if (!action) return;

            event.preventDefault();
            event.stopPropagation();

            ensureAgeCommanderNametagHub().then(() => {
                if (typeof global.portalDesktopCommanderMenuAction === 'function') {
                    global.portalDesktopCommanderMenuAction(action, event);
                }
            });
        });
    }

    let councilLayoutObserver = null;
    let councilLayoutStabilizeRaf = 0;
    let lastCouncilLayoutKey = '';

    function isMapOnlyPage() {
        return global.document.body?.dataset?.ageMapOnly === 'true';
    }

    function isInsideMap(target) {
        if (!target || typeof target.closest !== 'function') return false;
        return Boolean(target.closest(`#${MAP_ROOT_ID}`));
    }

    function isInsideNationHub(target) {
        if (!target || typeof target.closest !== 'function') return false;
        return Boolean(
            target.closest('.age-nation-hub')
            || target.closest('[data-age-hub-menu]')
            || target.closest('.age-nation-hub-menu--box.is-open')
            || target.closest('#age-nation-hub-menu:not([hidden])')
            || target.closest('#age-nation-hub-radial.is-open')
        );
    }

    /** Open age workspaces/modals — must stay clickable on map-only shell (capture-phase block bypass). */
    function isOpenAgeOverlayTarget(target) {
        if (!target || typeof target.closest !== 'function') return false;
        if (global.document.body?.classList.contains('age-rank-promotion-open')
            && target.closest('#age-rank-promotion-overlay')) {
            return true;
        }
        if (global.document.body?.classList.contains('age-gear-level-up-open')
            && target.closest('#age-gear-level-up-overlay')) {
            return true;
        }
        return Boolean(target.closest(
            '.age-age-center-modal:not([hidden]),'
            + '.age-war-ledger-modal:not([hidden]),'
            + '.age-world-battle-report-modal:not([hidden]),'
            + '.age-war-room-modal:not([hidden]),'
            + '#age-council-board-editor:not([hidden]),'
            + '.age-unit-evolution-workspace:not([hidden]),'
            + '.age-roster-review-workspace:not([hidden]),'
            + '.age-barracks-workspace:not([hidden]),'
            + '.age-watchtower-workspace:not([hidden]),'
            + '.age-guild-workspace:not([hidden]),'
            + '#age-guild-jobs-arena:not([hidden]),'
            + '.age-guild-jobs-hub-arena:not([hidden]),'
            + '.age-guild-job-arena:not([hidden]),'
            + '.age-settlement-venue-workspace:not([hidden]),'
            + '#age-rank-promotion-overlay:not([hidden]),'
            + '#age-gear-level-up-overlay:not([hidden]),'
            + '.rift-discoveries-workspace-modal:not([hidden]),'
            + '.rift-banner-workspace-modal:not([hidden]),'
            + '.blessed-banners-modal:not([hidden]),'
            + '.age-chronicles-battle-pass-modal:not([hidden]),'
            + '.age-commander-rank-ladder-modal:not([hidden])'
        ));
    }

    /** @deprecated alias — use isOpenAgeOverlayTarget */
    function isNationHubDestinationModal(target) {
        return isOpenAgeOverlayTarget(target);
    }

    function isPortalAlertModal(target) {
        if (!target || typeof target.closest !== 'function') return false;
        return Boolean(
            target.closest('#royal-armies-portal-alert-modal:not(.main-portal-modal-hidden)')
        );
    }

    function isMapCitySearchTarget(target) {
        if (!target || typeof target.closest !== 'function') return false;
        return Boolean(target.closest('.age-world-map-city-search'));
    }

    function isMapPlanToolTarget(target) {
        if (!target || typeof target.closest !== 'function') return false;
        return Boolean(
            target.closest('.age-world-map-terrain-controls')
            || target.closest('.age-world-map-city-search')
            || target.closest('.age-world-map-plan-tool-dock')
            || target.closest('#age-world-map-plan-add')
            || target.closest('#age-world-map-plan-post')
            || target.closest('#age-world-map-plan-toggle')
        );
    }

    function isInsideMapHudSidePanels(target) {
        if (!target || typeof target.closest !== 'function') return false;
        return Boolean(
            target.closest('.age-city-info-panel')
            || target.closest('.age-left-reports-panel')
            || target.closest('.age-quick-tips-panel')
        );
    }

    function isBottomHudTarget(target) {
        if (!target || typeof target.closest !== 'function') return false;
        return Boolean(
            target.closest('.age-map-bottom-dock')
            || target.closest('#portal-commander-identity-shell')
            || target.closest('#portal-desktop-commander-menu')
            || target.closest('.portal-commander-identity-menu--age-floating')
        );
    }

    function isCommanderMenuOverlayTarget(target) {
        if (!target || typeof target.closest !== 'function') return false;
        return Boolean(
            target.closest('.commander-hub-overlay.is-visible')
            || target.closest('.public-profile-overlay.is-visible')
            || target.closest('#player-report-modal:not([hidden])')
        );
    }

    function isWorldCityDrawerTarget(target) {
        if (!target || typeof target.closest !== 'function') return false;
        return Boolean(
            target.closest('.age-world-city-drawer:not([hidden])')
            || target.closest('.age-world-battle-report-modal:not([hidden])')
        );
    }

    function isWarRoomModalTarget(target) {
        if (!target || typeof target.closest !== 'function') return false;
        return Boolean(
            target.closest('.age-war-room-modal:not([hidden])')
            || target.closest('#age-war-room-players-panel.is-open')
        );
    }

    function isSettlementOverlayTarget(target) {
        if (!target || typeof target.closest !== 'function') return false;
        const body = global.document.body;
        if (body?.classList.contains('age-settlement-venue-open')
            || body?.classList.contains('age-army-workspace-open')) {
            if (target.closest('.age-settlement-venue-workspace:not([hidden])')
                || target.closest('.age-army-workspace:not([hidden])')) {
                return true;
            }
        }
        if (body?.classList.contains('age-barracks-open') && target.closest('.age-barracks-workspace')) {
            return true;
        }
        if (body?.classList.contains('age-roster-review-open') && target.closest('.age-roster-review-workspace')) {
            return true;
        }
        if (body?.classList.contains('age-watchtower-open') && target.closest('.age-watchtower-workspace')) {
            return true;
        }
        if (body?.classList.contains('age-guild-training-open') && target.closest('.age-guild-workspace')) {
            return true;
        }
        return false;
    }

    function isDevPageNavigatorTarget(target) {
        if (!target || typeof target.closest !== 'function') return false;
        return Boolean(target.closest('#dev-page-navigator, .dev-page-navigator'));
    }

    function isAgeMapHudTarget(target) {
        if (!target || typeof target.closest !== 'function') return false;
        return Boolean(target.closest('.age-map-hud'));
    }

    function isMapInteractionAllowed(target) {
        return isInsideMap(target)
            || isAgeMapHudTarget(target)
            || isInsideNationHub(target)
            || isOpenAgeOverlayTarget(target)
            || isPortalAlertModal(target)
            || isMapCitySearchTarget(target)
            || isMapPlanToolTarget(target)
            || isInsideMapHudSidePanels(target)
            || isBottomHudTarget(target)
            || isCommanderMenuOverlayTarget(target)
            || isWorldCityDrawerTarget(target)
            || isWarRoomModalTarget(target)
            || isSettlementOverlayTarget(target)
            || isDevPageNavigatorTarget(target);
    }

    function maybeOpenSettlementFromQuery() {
        try {
            const params = new URLSearchParams(global.location.search);
            if (params.get('openSettlement') !== '1') return;
            global.RoyalArmiesAgeViewTabs?.openMapSettlementPanel?.();
        } catch (_err) {
            /* ignore */
        }
    }

    function enableMapSettlementModules() {
        global.enableAgeSettlementVenueWorkspaces?.();
        global.enableAgeBarracks?.();
        global.RoyalArmiesAgeWatchtower?.enable?.();
        global.enableAgeAdventurersGuild?.();
        global.enableAgeUnitEvolution?.();
        global.enableAgeRosterReview?.();
        global.enableAgeRecords?.();
    }

    function retainLoadingGate() {
        const gate = global.RoyalArmiesPageLoadingGate;
        if (gate && typeof gate.retain === 'function') {
            gate.retain('age-map-only');
        }
    }

    async function releaseLoadingGate() {
        scheduleCouncilBoardLayoutUntilStable(24);
        await new Promise((resolve) => {
            global.requestAnimationFrame(() => {
                syncCouncilBoardLayoutToMap();
                global.requestAnimationFrame(resolve);
            });
        });
        const gate = global.RoyalArmiesPageLoadingGate;
        if (gate && typeof gate.release === 'function') {
            await gate.release('age-map-only');
        }
    }

    function mapViewportRectToLayoutSpace(rect) {
        if (!rect) return rect;
        if (typeof global.RoyalArmiesViewportMetrics?.clientRectToDesign === 'function') {
            return global.RoyalArmiesViewportMetrics.clientRectToDesign(rect);
        }
        return rect;
    }

    function readAgeMapSlotTopPx(canvas) {
        if (!canvas) return 0;
        const parsed = parseFloat(global.getComputedStyle(canvas).getPropertyValue('--age-map-slot-top'));
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
            height: mapSize
        };

        if (measured.width < 8 || measured.height < 8) {
            return mapViewportRectToLayoutSpace(estimated);
        }

        const canvas = global.document.getElementById('age-page-canvas');
        const slotTop = readAgeMapSlotTopPx(canvas);
        const layoutMeasured = mapViewportRectToLayoutSpace(measured);
        const minTop = slotTop > 0 ? slotTop - 12 : layoutMeasured.top;
        const layoutEstimated = mapViewportRectToLayoutSpace(estimated);
        const measuredLooksStaged = layoutMeasured.top < minTop
            || (
                measured.width >= anchorRect.width * 0.94
                && measured.height >= anchorRect.height * 0.94
                && Math.abs(measured.left - anchorRect.left) < 3
            );

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

    function resolveCouncilBoardLeftPx() {
        const canvas = global.document.getElementById('age-page-canvas');
        if (!canvas) return 16;
        const styles = global.getComputedStyle(canvas);
        const safeLeft = parseFloat(styles.getPropertyValue('padding-left')) || 0;
        const envInset = 16;
        return Math.max(envInset, safeLeft, 0);
    }

    function isAgeMobileLayout() {
        return global.matchMedia(AGE_MOBILE_LAYOUT_MQ).matches;
    }

    function measureLeftReportsPanelHeightPx(reportsPanel) {
        if (!reportsPanel) return 0;

        const tabs = reportsPanel.querySelector('.age-left-reports-tabs');
        const activePanel = reportsPanel.querySelector('.age-left-reports-tabpanel:not([hidden])')
            || reportsPanel.querySelector('.age-left-reports-tabpanel.is-active');
        const styles = global.getComputedStyle(reportsPanel);
        const paddingY = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
        const gap = parseFloat(styles.rowGap || styles.gap) || 0;
        const tabsHeight = tabs ? Math.ceil(tabs.getBoundingClientRect().height) : 0;
        const panelContentHeight = activePanel ? Math.ceil(activePanel.scrollHeight) : 0;

        return Math.max(
            LEFT_REPORTS_MIN_HEIGHT_PX,
            Math.ceil(paddingY + tabsHeight + (tabsHeight > 0 ? gap : 0) + panelContentHeight)
        );
    }

    function syncCouncilBoardLayoutToMap() {
        const canvas = global.document.getElementById('age-page-canvas');
        const mapFrame = global.document.querySelector('#age-page-canvas .age-map-frame');
        if (!canvas || !mapFrame) return;

        if (isAgeMobileLayout()) {
            canvas.classList.remove('is-age-hud-layout-pending');
            [
                '--age-council-board-top',
                '--age-council-board-left',
                '--age-council-board-width',
                '--age-council-board-height',
                '--age-left-column-height',
                '--age-quick-tips-block-height'
            ].forEach((prop) => canvas.style.removeProperty(prop));
            lastCouncilLayoutKey = '';
            return;
        }

        const gap = COUNCIL_BOARD_MAP_GAP_PX + COUNCIL_BOARD_RIGHT_TRIM_PX;
        const leftPosition = resolveCouncilBoardLeftPx() + COUNCIL_BOARD_LEFT_OFFSET_PX;
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
        const totalColumnHeight = Math.max(
            COUNCIL_BOARD_MIN_HEIGHT_PX,
            mapRect.height - COUNCIL_BOARD_BOTTOM_TRIM_PX
        );
        const councilHeight = Math.max(
            COUNCIL_BOARD_MIN_HEIGHT_PX,
            totalColumnHeight - COUNCIL_BOARD_REPORTS_LIFT_PX
        );
        const reportsPanel = global.document.querySelector('#age-map-hud-left .age-left-reports-panel');
        const reportsPanelHeight = measureLeftReportsPanelHeightPx(reportsPanel);
        const leftColumnHeight = councilHeight
            + (reportsPanelHeight > 0 ? LEFT_HUD_STACK_GAP_PX + reportsPanelHeight : 0);

        canvas.style.setProperty('--age-council-board-top', `${top}px`);
        canvas.style.setProperty('--age-council-board-width', `${width}px`);
        canvas.style.setProperty('--age-council-board-height', `${councilHeight}px`);
        canvas.style.setProperty('--age-left-column-height', `${leftColumnHeight}px`);
        canvas.style.removeProperty('--age-quick-tips-block-height');

        const mapClientRect = mapFrame.getBoundingClientRect();
        if (mapClientRect.width >= 8 && mapClientRect.height >= 8) {
            const searchTop = Math.max(0, mapClientRect.top + 12);
            const searchRight = Math.max(12, global.innerWidth - mapClientRect.right + 12);
            canvas.style.setProperty('--age-map-search-top', `${searchTop}px`);
            canvas.style.setProperty('--age-map-search-right', `${searchRight}px`);
        }

        canvas.classList.remove('is-age-hud-layout-pending');
        lastCouncilLayoutKey = `${top}|${width}|${councilHeight}|${leftPosition}|${reportsPanelHeight}`;
    }

    function scheduleCouncilBoardLayoutUntilStable(maxFrames = 48) {
        if (councilLayoutStabilizeRaf) {
            global.cancelAnimationFrame(councilLayoutStabilizeRaf);
        }

        let frames = 0;
        const tick = () => {
            councilLayoutStabilizeRaf = 0;
            frames += 1;
            const before = lastCouncilLayoutKey;
            syncCouncilBoardLayoutToMap();
            const stable = Boolean(before) && before === lastCouncilLayoutKey;
            if (stable && frames >= 2 || frames >= maxFrames) return;
            councilLayoutStabilizeRaf = global.requestAnimationFrame(tick);
        };

        councilLayoutStabilizeRaf = global.requestAnimationFrame(tick);
    }

    function bindCouncilBoardLayoutSync() {
        const mapFrame = global.document.querySelector('#age-page-canvas .age-map-frame');
        const anchor = mapFrame?.closest('.age-map-anchor');
        if (!mapFrame) return;

        global.addEventListener('resize', () => scheduleCouncilBoardLayoutUntilStable(12));
        global.addEventListener('royalarmies:viewport-metrics-updated', () => scheduleCouncilBoardLayoutUntilStable(12));

        if (typeof global.ResizeObserver === 'function') {
            councilLayoutObserver = new global.ResizeObserver(() => scheduleCouncilBoardLayoutUntilStable(8));
            councilLayoutObserver.observe(mapFrame);
            if (anchor) councilLayoutObserver.observe(anchor);
            const leftReportsPanel = global.document.querySelector('#age-map-hud-left .age-left-reports-panel');
            if (leftReportsPanel) councilLayoutObserver.observe(leftReportsPanel);
        }
    }

    function applyMapOnlyShellState() {
        const canvas = global.document.getElementById('age-page-canvas');
        if (canvas) {
            canvas.dataset.ageView = 'map';
        }

        global.document.querySelectorAll(
            '.age-barracks-workspace, .age-unit-evolution-workspace, .age-roster-review-workspace, .age-guild-workspace,'
            + ' .age-age-center-modal, .age-war-ledger-modal,'
            + ' .age-chronicles-battle-pass-modal, .rift-discoveries-workspace-modal, .rift-banner-workspace-modal, .blessed-banners-modal, #age-rank-promotion-overlay, #age-gear-level-up-overlay'
        ).forEach((node) => {
            node.hidden = true;
            node.setAttribute('aria-hidden', 'true');
        });
    }

    function stripNonMapInlineHandlers() {
        global.document.querySelectorAll('[onclick]').forEach((node) => {
            if (isInsideMap(node)) return;
            if (node.closest?.('#portal-commander-identity-shell, #portal-desktop-commander-menu')) return;
            node.removeAttribute('onclick');
        });

        global.document.querySelectorAll('a[href]').forEach((anchor) => {
            if (isInsideMap(anchor)) return;
            const href = String(anchor.getAttribute('href') || '').trim();
            if (!href || href.startsWith('#')) return;
            anchor.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
            });
        });
    }

    function blockNonMapInteraction() {
        const block = (event) => {
            if (!isMapOnlyPage()) return;
            if (isMapInteractionAllowed(event.target)) return;
            const tag = String(event.target?.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select') {
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            if (event.target?.closest?.('button, a[href], [role="button"], [role="menuitem"], [role="tab"]')) {
                event.preventDefault();
                event.stopPropagation();
            }
        };

        global.document.addEventListener('click', block, true);
        global.document.addEventListener('pointerdown', block, true);
        global.document.addEventListener('keydown', (event) => {
            if (!isMapOnlyPage()) return;
            if (isMapInteractionAllowed(event.target)) return;
            if (event.key === 'Enter' || event.key === ' ') {
                const interactive = event.target?.closest?.('button, a[href], [role="button"], [role="menuitem"], [role="tab"]');
                if (interactive && !isMapInteractionAllowed(interactive)) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            }
        }, true);
    }

    function enableMapPlanToolsEarly() {
        global.RoyalArmiesUniversalGameTimeClock?.enable?.();
        global.enableAgeWorldMapPlanEditor?.();
    }

    async function postAgeLeave(useKeepalive) {
        if (ageSessionLeaveSent) return;
        const username = resolvePageUsername();
        if (!username) return;

        ageSessionLeaveSent = true;
        stopPresenceLoop();

        if (typeof global.notifyAgePortalSessionLeave === 'function') {
            await global.notifyAgePortalSessionLeave({ useKeepalive: useKeepalive === true });
            return;
        }

        try {
            global.localStorage.removeItem('savedCommanderInActiveAge');
        } catch (_err) {
            /* ignore */
        }

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
            console.warn('[RIFT] Age leave sync failed:', err);
        }
    }

    async function returnToAgePortal() {
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

    function registerUnloadHandlers() {
        const onLeave = () => {
            if (typeof global.sendAgeServerLeaveBeacon === 'function') {
                global.sendAgeServerLeaveBeacon();
                return;
            }
            void postAgeLeave(true);
        };

        global.addEventListener('pagehide', onLeave);
        global.addEventListener('beforeunload', onLeave);
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
        if (typeof global.portalDesktopCommanderMenuAction === 'function') {
            global.portalDesktopCommanderMenuAction(action, event);
            return;
        }
        if (event) event.stopPropagation();
        closeMobileCommanderSubmenu();
    }

    function bindMobileCommanderMenuHandlers() {
        const toggle = global.document.getElementById('game-mobile-commander-toggle');
        if (toggle && toggle.dataset.mobileCommanderBound !== 'true') {
            toggle.dataset.mobileCommanderBound = 'true';
            toggle.addEventListener('click', toggleMobileCommanderSubmenu);
        }

        const submenu = global.document.getElementById('game-mobile-commander-submenu');
        if (!submenu || submenu.dataset.mobileCommanderActionsBound === 'true') return;
        submenu.dataset.mobileCommanderActionsBound = 'true';

        const actionById = {
            'game-mobile-messages-btn': 'messages',
            'game-mobile-dropdown-logout-btn': 'exit-server'
        };

        submenu.querySelectorAll('.portal-mobile-submenu-item').forEach((button) => {
            let action = actionById[button.id] || null;
            if (!action) {
                const label = String(button.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
                if (label === 'view profile card') action = 'view-profile';
                else if (label === 'edit profile') action = 'edit-profile';
                else if (label === 'settings') action = 'settings';
                else if (label === 'exit server') action = 'exit-server';
            }
            if (!action) return;
            button.addEventListener('click', (event) => {
                gameMobileNavCommanderAction(action, event);
            });
        });

        global.document.addEventListener('click', (event) => {
            const clip = global.document.getElementById('game-mobile-commander-clip');
            if (!clip || !clip.classList.contains('is-commander-open')) return;
            if (event.target.closest('#game-mobile-commander-clip')) return;
            closeMobileCommanderSubmenu();
        });
    }

    const NATION_WELCOME_LABELS = {
        aesthene: 'Aesthine'
    };

    const NATION_CREST_URLS = {
        aesthene: 'images/aesthenecrest.png',
        lyllis: 'images/lylliscrest.png'
    };

    function resolveMapOnlyCommanderNationId() {
        const movementNation = global.RoyalArmiesAgeMovement?.resolvePlayerNationId?.();
        if (movementNation) return String(movementNation).trim().toLowerCase();

        const ledgerNation = global.RoyalArmiesAgeMovement?.resolveLedgerNationId?.();
        if (ledgerNation) return String(ledgerNation).trim().toLowerCase();

        const playerNation = global.player?.gameNation || global.player?.nation;
        if (playerNation) return String(playerNation).trim().toLowerCase();

        if (typeof global.RoyalArmiesAgeMovementPanel?.getCommanderNationId === 'function') {
            const panelNation = global.RoyalArmiesAgeMovementPanel.getCommanderNationId();
            if (panelNation) return String(panelNation).trim().toLowerCase();
        }

        return '';
    }

    function resolveNationWelcomeLabel(nationId) {
        if (!nationId) return '';
        if (NATION_WELCOME_LABELS[nationId]) return NATION_WELCOME_LABELS[nationId];

        const catalog = global.RoyalArmiesAgeWorldMap?.getCatalog?.();
        const nation = catalog?.nations?.find((entry) => entry.id === nationId);
        if (nation?.name) return nation.name;

        return nationId.charAt(0).toUpperCase() + nationId.slice(1);
    }

    function resolveNationCrestUrl(nationId) {
        if (NATION_CREST_URLS[nationId]) return NATION_CREST_URLS[nationId];
        if (nationId) return `images/${nationId}crest.png`;
        return 'images/aesthenecrest.png';
    }

    function refreshAgeNationWelcomeChrome() {
        const textEl = global.document.getElementById('age-nation-welcome-text');
        const crestEl = global.document.getElementById('age-nation-welcome-crest');
        if (!textEl && !crestEl) return;

        const nationId = resolveMapOnlyCommanderNationId();
        const label = resolveNationWelcomeLabel(nationId);
        if (!label) return;

        if (textEl) {
            const welcomeText = `Welcome to ${label}`;
            if (textEl.textContent !== welcomeText) {
                textEl.textContent = welcomeText;
            }
        }
        if (crestEl) {
            const crestUrl = resolveNationCrestUrl(nationId);
            const crestAlt = `${label} crest`;
            if (crestEl.getAttribute('src') !== crestUrl) {
                crestEl.src = crestUrl;
            }
            if (crestEl.getAttribute('alt') !== crestAlt) {
                crestEl.setAttribute('alt', crestAlt);
            }
        }
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

    function setAgeHudMovePointsDisplay(current, max) {
        if (global.RoyalArmiesAgeMovement?.applyAgeHudMovePointsToDom) {
            global.RoyalArmiesAgeMovement.applyAgeHudMovePointsToDom(current, max);
            return;
        }
        const el = global.document.getElementById('age-hud-move-points');
        if (!el) return;
        el.textContent = String(Math.max(0, Math.floor(Number(current) || 0)));
    }

    function refreshAgeHudMovePoints() {
        const movement = global.RoyalArmiesAgeMovement;
        if (movement?.applyAgeHudMovePointsToDom) {
            movement.applyAgeHudMovePointsToDom(
                movement.getMovePoints?.(),
                movement.getMovePointsMax?.()
            );
            return;
        }
        if (movement && typeof movement.getMovePoints === 'function') {
            setAgeHudMovePointsDisplay(movement.getMovePoints(), movement.getMovePointsMax());
            return;
        }
        setAgeHudMovePointsDisplay(3, 3);
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

    async function postAgeJoin() {
        const username = resolvePageUsername();
        if (!username) return { ok: false, evicted: false };

        if (global.RoyalArmiesOfficialAge?.resumeAgePortalSessionJoin) {
            return global.RoyalArmiesOfficialAge.resumeAgePortalSessionJoin(resolveApiUrl, {
                armyFocus: global.RoyalArmiesAgeMovementPanel?.computeLocalArmyFocus?.() || ''
            });
        }

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
                console.warn('[RIFT] Age join sync failed:', payload?.message || payload);
                return { ok: false, evicted: false, payload };
            }
            return { ok: true, evicted: false, payload };
        } catch (err) {
            console.warn('[RIFT] Age join sync failed:', err);
            return { ok: false, evicted: false };
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
            const response = await global.fetch(resolveApiUrl('/api/portal/presence'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, inAge: true }),
                cache: 'no-store',
                credentials: 'include'
            });
            const payload = await response.json().catch(() => ({}));
            global.RoyalArmiesOfficialAge?.maybeEvictForAccountResetPayload?.(payload, resolveApiUrl);
        } catch (err) {
            if (typeof global.shouldSuppressRepeatedLocalDevApiWarnings !== 'function'
                || !global.shouldSuppressRepeatedLocalDevApiWarnings()) {
                console.warn('[RIFT] Age map presence heartbeat failed:', err);
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

    async function bootstrapMapSession() {
        if (typeof global.ensurePortalAuthRestored === 'function') {
            await global.ensurePortalAuthRestored();
        }

        if (typeof global.applyLocalDevAutoLogin === 'function') {
            const saved = global.localStorage.getItem('activeCommanderUser');
            if (!saved || !String(saved).trim()) {
                await global.applyLocalDevAutoLogin();
            }
        }

        if (typeof global.syncPlayerFromActiveCommanderStorage === 'function') {
            global.syncPlayerFromActiveCommanderStorage();
        }

        const joinResult = await postAgeJoin();

        if (global.__royalArmiesAgeEvictionInFlight) {
            return;
        }

        if (joinResult?.ok && joinResult.payload) {
            if (global.RoyalArmiesAgeMovement?.applyStatePayload) {
                global.RoyalArmiesAgeMovement.applyStatePayload(joinResult.payload);
            }
            if (joinResult.payload.gameNation && typeof global.player !== 'undefined') {
                global.player.gameNation = joinResult.payload.gameNation;
            }
            if (joinResult.payload.commanderAccountResetAt) {
                if (typeof global.storeCommanderAccountResetAck === 'function') {
                    global.storeCommanderAccountResetAck(joinResult.payload.commanderAccountResetAt);
                } else if (global.RoyalArmiesOfficialAge?.storeCommanderAccountResetAck) {
                    global.RoyalArmiesOfficialAge.storeCommanderAccountResetAck(joinResult.payload.commanderAccountResetAt);
                }
            }
        } else if (!joinResult?.ok) {
            const joinCode = String(joinResult?.payload?.code || '').trim();
            if (joinResult?.evicted || joinCode === 'NEXUS-AGE-038') {
                const mainUrl = typeof global.resolveRoyalArmiesPageUrl === 'function'
                    ? global.resolveRoyalArmiesPageUrl('main')
                    : '/main';
                global.location.replace(mainUrl);
                return;
            }
            console.warn('[RIFT] Age map session join did not complete:', joinResult?.payload?.message || joinCode || 'unknown');
            if (typeof global.showPortalAlert === 'function' && joinResult?.payload?.message) {
                await global.showPortalAlert(joinResult.payload.message, joinResult.payload.title || 'Cannot join Age');
            }
            const mainUrl = typeof global.resolveRoyalArmiesPageUrl === 'function'
                ? global.resolveRoyalArmiesPageUrl('main')
                : '/main';
            global.location.replace(mainUrl);
            return;
        }

        global.RoyalArmiesOfficialAge?.startCommanderAccountResetEvictionWatch?.(resolveApiUrl);
        startPresenceLoop();

        if (typeof global.fetchCommanderDossierFromServer === 'function') {
            try {
                await global.fetchCommanderDossierFromServer();
            } catch (_err) {
                /* dossier sync optional during map preview */
            }
        }

        if (typeof global.enableAgeMovementPanel === 'function') {
            global.enableAgeMovementPanel();
        }

        if (global.RoyalArmiesAgeMovement && typeof global.RoyalArmiesAgeMovement.refresh === 'function') {
            try {
                await global.RoyalArmiesAgeMovement.refresh();
            } catch (_err) {
                /* movement sync optional for map preview */
            }
        }

        refreshAgeHudMovePoints();
        refreshAgeHudUnits();

        if (global.RoyalArmiesAgeCommanderRank?.hydrateCommanderClassPathFromServer) {
            try {
                await global.RoyalArmiesAgeCommanderRank.hydrateCommanderClassPathFromServer();
            } catch (_err) {
                /* class path sync optional during map preview */
            }
        }

        if (typeof global.applyDevPreviewClassPathOverride === 'function') {
            global.applyDevPreviewClassPathOverride();
        }

        if (typeof global.refreshAgeHudCommanderRank === 'function') {
            global.refreshAgeHudCommanderRank();
        }

        refreshAgeNationWelcomeChrome();
    }

    async function bootMapOnlyPage() {
        if (!isMapOnlyPage()) return;

        enableMapPlanToolsEarly();

        applyMapOnlyShellState();
        stripNonMapInlineHandlers();
        blockNonMapInteraction();

        retainLoadingGate();
        bindAgeCommanderNametagMenuDelegation();
        registerUnloadHandlers();

        try {
            await ensureAgeCommanderNametagHub();
            await bootstrapMapSession();

            if (global.__royalArmiesAgeEvictionInFlight) {
                return;
            }

            if (typeof global.enableAgeWorldMap === 'function') {
                await global.enableAgeWorldMap();
            }

            global.enableAgeWorldMapCitySearch?.();

            if (typeof global.enableAgeWorldPlanOverlay === 'function') {
                try {
                    await global.enableAgeWorldPlanOverlay();
                } catch (err) {
                    console.warn('[RIFT] Age world plan overlay failed:', err);
                }
            }

            const catalogCityId = global.RoyalArmiesAgeMovement?.getCatalogCityId?.();
            if (catalogCityId) {
                global.RoyalArmiesAgeMovementPanel?.syncCatalogCity?.(catalogCityId);
                global.RoyalArmiesAgeWorldMap?.refreshPlayerCity?.();
            }
            global.RoyalArmiesAgeWorldMap?.refreshNationCityHighlights?.();
            bindCouncilBoardLayoutSync();
            scheduleCouncilBoardLayoutUntilStable(32);

            if (typeof global.enableAgeViewTabs === 'function') {
                global.enableAgeViewTabs();
            }
            enableMapSettlementModules();
            maybeOpenSettlementFromQuery();
            if (typeof global.enableAgeLeftReportsPanel === 'function') {
                global.enableAgeLeftReportsPanel();
            }
            if (typeof global.enableAgeQuickTipsPanel === 'function') {
                global.enableAgeQuickTipsPanel();
            }
            global.RoyalArmiesAgeNationHub?.enable?.();
            global.enableAgeWorldMapPlanEditor?.();
            global.RoyalArmiesAgeWorldMapPlanEditor?.enable?.();
            global.RoyalArmiesAgeWorldMapPlanDraft?.refreshPlanAuthorAccess?.();
            if (typeof global.enableAgeWarLedger === 'function') {
                global.enableAgeWarLedger();
            }
            if (typeof global.enableAgeCouncilBoard === 'function') {
                void global.enableAgeCouncilBoard();
            }
            bindMobileCommanderMenuHandlers();
            await ensureAgeCommanderNametagHub();
            refreshAgeNationWelcomeChrome();
        } finally {
            await releaseLoadingGate();
        }
    }

    global.refreshAgeNationWelcomeChrome = refreshAgeNationWelcomeChrome;
    global.refreshAgeHudMovePoints = refreshAgeHudMovePoints;
    global.refreshAgeHudUnits = refreshAgeHudUnits;
    global.setAgeHudMovePointsDisplay = setAgeHudMovePointsDisplay;
    global.addEventListener('royalarmies:age-movement-updated', refreshAgeNationWelcomeChrome);
    global.addEventListener('royalarmies:age-movement-updated', refreshAgeHudMovePoints);
    global.addEventListener('royalarmies:age-movement-updated', refreshAgeHudUnits);
    global.addEventListener('royalarmies:age-recruitment-updated', refreshAgeHudUnits);

    global.syncAgeMapHudLayout = syncCouncilBoardLayoutToMap;

    global.returnToGameAgePortal = returnToAgePortal;
    global.toggleGameMobileCommanderSubmenu = toggleMobileCommanderSubmenu;
    global.gameMobileNavCommanderAction = gameMobileNavCommanderAction;

    global.RoyalArmiesAgeMapOnlyPage = {
        isMapOnlyPage,
        boot: bootMapOnlyPage,
        syncCouncilBoardLayoutToMap
    };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', bootMapOnlyPage);
    } else {
        bootMapOnlyPage();
    }
})(window);

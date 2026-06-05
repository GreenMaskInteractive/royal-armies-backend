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
    const COUNCIL_BOARD_MIN_WIDTH_PX = 220;
    const COUNCIL_BOARD_MIN_HEIGHT_PX = 160;
    const MAP_FRAME_LAYOUT_MAX_EDGE = 1642;
    const AGE_MOBILE_LAYOUT_MQ = '(max-width: 1024px)';

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
            || target.closest('#age-nation-hub-menu:not([hidden])')
            || target.closest('#age-nation-hub-radial.is-open')
        );
    }

    /** Modals opened from Game Hub menu — must stay clickable on map-only shell */
    function isNationHubDestinationModal(target) {
        if (!target || typeof target.closest !== 'function') return false;
        return Boolean(
            target.closest('.age-age-center-modal:not([hidden])')
            || target.closest('.rift-discoveries-workspace-modal:not([hidden])')
            || target.closest('.age-chronicles-battle-pass-modal:not([hidden])')
        );
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
        if (body?.classList.contains('age-settlement-venue-open')) {
            if (target.closest('.age-settlement-venue-workspace:not([hidden])')) return true;
        }
        if (body?.classList.contains('age-barracks-open') && target.closest('.age-barracks-workspace')) {
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

    function isMapInteractionAllowed(target) {
        return isInsideMap(target)
            || isInsideNationHub(target)
            || isNationHubDestinationModal(target)
            || isPortalAlertModal(target)
            || isMapCitySearchTarget(target)
            || isMapPlanToolTarget(target)
            || isInsideMapHudSidePanels(target)
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
        global.enableAgeAdventurersGuild?.();
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
                '--age-left-column-height'
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
        const quickTipsPanel = global.document.getElementById('age-quick-tips-panel');
        const quickTipsStyle = quickTipsPanel ? global.getComputedStyle(quickTipsPanel) : null;
        const quickTipsVisible = quickTipsPanel
            && quickTipsStyle
            && quickTipsStyle.display !== 'none'
            && quickTipsStyle.visibility !== 'hidden';
        const quickTipsHeight = quickTipsVisible
            ? Math.max(88, Math.ceil(quickTipsPanel.getBoundingClientRect().height) || 88)
            : 0;
        const quickTipsStack = quickTipsHeight > 0 ? quickTipsHeight + 10 : 0;
        const councilHeight = Math.max(
            COUNCIL_BOARD_MIN_HEIGHT_PX,
            totalColumnHeight - quickTipsStack
        );

        canvas.style.setProperty('--age-council-board-top', `${top}px`);
        canvas.style.setProperty('--age-council-board-width', `${width}px`);
        canvas.style.setProperty('--age-council-board-height', `${councilHeight}px`);
        canvas.style.setProperty('--age-left-column-height', `${totalColumnHeight}px`);

        const mapClientRect = mapFrame.getBoundingClientRect();
        if (mapClientRect.width >= 8 && mapClientRect.height >= 8) {
            const searchTop = Math.max(0, mapClientRect.top + 12);
            const searchRight = Math.max(12, global.innerWidth - mapClientRect.right + 12);
            canvas.style.setProperty('--age-map-search-top', `${searchTop}px`);
            canvas.style.setProperty('--age-map-search-right', `${searchRight}px`);
        }

        canvas.classList.remove('is-age-hud-layout-pending');
        lastCouncilLayoutKey = `${top}|${width}|${councilHeight}|${leftPosition}`;
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
        }
    }

    function applyMapOnlyShellState() {
        const canvas = global.document.getElementById('age-page-canvas');
        if (canvas) {
            canvas.dataset.ageView = 'map';
        }

        global.document.querySelectorAll(
            '.age-barracks-workspace, .age-unit-evolution-workspace, .age-guild-workspace,'
            + ' .age-age-center-modal, .age-war-ledger-modal,'
            + ' .commander-hub-overlay, .public-profile-overlay, .player-report-modal,'
            + ' .age-chronicles-battle-pass-modal, .rift-discoveries-workspace-modal, #age-rank-promotion-overlay'
        ).forEach((node) => {
            node.hidden = true;
            node.setAttribute('aria-hidden', 'true');
        });
    }

    function stripNonMapInlineHandlers() {
        global.document.querySelectorAll('[onclick]').forEach((node) => {
            if (isInsideMap(node)) return;
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
    }

    async function bootMapOnlyPage() {
        if (!isMapOnlyPage()) return;

        enableMapPlanToolsEarly();

        applyMapOnlyShellState();
        stripNonMapInlineHandlers();
        blockNonMapInteraction();

        retainLoadingGate();

        try {
            await bootstrapMapSession();

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
        } finally {
            await releaseLoadingGate();
        }
    }

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

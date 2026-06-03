/**
 * RIFT — Age Alpha map-only shell (visual HUD retained; interaction limited to world map).
 */
(function initAgeMapOnlyPage(global) {
    'use strict';

    const MAP_ROOT_ID = 'age-world-map';
    const MAP_INTERACTIVE_SELECTOR = [
        `#${MAP_ROOT_ID}`,
        `#${MAP_ROOT_ID} *`,
        '#age-world-map-frame',
        '#age-world-map-frame *'
    ].join(', ');

    function isMapOnlyPage() {
        return global.document.body?.dataset?.ageMapOnly === 'true';
    }

    function isInsideMap(target) {
        if (!target || typeof target.closest !== 'function') return false;
        return Boolean(target.closest(`#${MAP_ROOT_ID}`));
    }

    function retainLoadingGate() {
        const gate = global.RoyalArmiesPageLoadingGate;
        if (gate && typeof gate.retain === 'function') {
            gate.retain('age-map-only');
        }
    }

    async function releaseLoadingGate() {
        const gate = global.RoyalArmiesPageLoadingGate;
        if (gate && typeof gate.release === 'function') {
            await gate.release('age-map-only');
        }
    }

    function applyMapOnlyShellState() {
        const canvas = global.document.getElementById('age-page-canvas');
        if (canvas) {
            canvas.dataset.ageView = 'map';
        }

        global.document.querySelectorAll(
            '.age-barracks-workspace, .age-unit-evolution-workspace, .age-guild-workspace,'
            + ' .age-age-center-modal, .age-war-room-modal, .age-war-ledger-modal,'
            + ' .commander-hub-overlay, .public-profile-overlay, .player-report-modal,'
            + ' .age-chronicles-battle-pass-modal, #age-rank-promotion-overlay'
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
            if (isInsideMap(event.target)) return;
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
        global.document.addEventListener('keydown', (event) => {
            if (!isMapOnlyPage()) return;
            if (isInsideMap(event.target)) return;
            if (event.key === 'Enter' || event.key === ' ') {
                const interactive = event.target?.closest?.('button, a[href], [role="button"], [role="menuitem"], [role="tab"]');
                if (interactive && !isInsideMap(interactive)) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            }
        }, true);
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

        applyMapOnlyShellState();
        stripNonMapInlineHandlers();
        blockNonMapInteraction();

        retainLoadingGate();

        try {
            await bootstrapMapSession();

            if (typeof global.enableAgeWorldMap === 'function') {
                await global.enableAgeWorldMap();
            }

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
        } finally {
            await releaseLoadingGate();
        }
    }

    global.RoyalArmiesAgeMapOnlyPage = {
        isMapOnlyPage,
        boot: bootMapOnlyPage
    };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', bootMapOnlyPage);
    } else {
        bootMapOnlyPage();
    }
})(window);

/**
 * RIFT — Sync reliable viewport CSS variables site-wide (zoom, OS scale, dvh fallbacks).
 *
 * New MAP pages: load rift-page-loading-gate.js immediately after this file for the
 * site-wide "Loading game..." overlay during slow boots.
 */
(function initRoyalArmiesViewportMetrics(global) {
    'use strict';

    const CANVAS_SELECTORS = [
        '#main-dashboard-canvas',
        '#game-page-canvas',
        '.game-page-canvas',
        '#age-page-canvas',
        '.age-page-canvas',
        '#how-did-you-get-here-canvas',
        '.how-did-you-get-here-canvas',
        '#age-of-war-cinematic-canvas',
        '#royal-armies-ageofwar-trailer-canvas'
    ];

    const DESIGN_SURFACE_CLEANUP_PROPS = [
        '--ra-design-width',
        '--ra-design-height',
        '--ra-design-scale',
        '--ra-design-translate-x',
        '--ra-design-translate-y',
        '--ra-design-fit-width',
        '--ra-design-fit-height',
        '--ra-design-browser-zoom'
    ];

    let rafId = 0;
    let lastPatchKey = '';

    function resolveMetricTargets() {
        const targets = [];
        const seen = new Set();
        CANVAS_SELECTORS.forEach((selector) => {
            global.document.querySelectorAll(selector).forEach((node) => {
                if (!seen.has(node)) {
                    seen.add(node);
                    targets.push(node);
                }
            });
        });
        if (!targets.length && global.document.documentElement) {
            targets.push(global.document.documentElement);
        }
        return targets;
    }

    function resolveDesignSurfaceCleanupTargets() {
        const targets = [];
        const seen = new Set();
        CANVAS_SELECTORS.forEach((selector) => {
            global.document.querySelectorAll(selector).forEach((node) => {
                if (!seen.has(node)) {
                    seen.add(node);
                    targets.push(node);
                }
            });
        });
        if (global.document.body && !seen.has(global.document.body)) {
            targets.push(global.document.body);
        }
        return targets;
    }

    function resolveViewportFrame() {
        const docEl = global.document.documentElement;
        const layoutWidth = docEl.clientWidth || global.innerWidth || 0;
        const layoutHeight = docEl.clientHeight || global.innerHeight || 0;
        const visualViewport = global.visualViewport;
        const visualWidth = visualViewport ? visualViewport.width : layoutWidth;
        const visualHeight = visualViewport ? visualViewport.height : layoutHeight;
        const safeHeight = Math.max(320, Math.round(Math.min(layoutHeight, visualHeight)));

        return {
            layoutWidth,
            layoutHeight,
            visualWidth,
            visualHeight,
            safeHeight,
            browserZoom: visualViewport && Number.isFinite(visualViewport.scale) ? visualViewport.scale : 1
        };
    }

    function buildViewportPatch(frame) {
        return {
            '--ra-layout-vw': `${Math.max(320, Math.round(frame.layoutWidth))}px`,
            '--ra-layout-vh': `${frame.safeHeight}px`,
            '--ra-layout-vv-w': `${Math.max(320, Math.round(frame.visualWidth))}px`,
            '--ra-layout-vv-h': `${Math.max(320, Math.round(frame.visualHeight))}px`,
            '--ra-layout-dpr': String(global.devicePixelRatio || 1),
            '--game-layout-vw': `${Math.max(320, Math.round(frame.layoutWidth))}px`,
            '--game-layout-vh': `${frame.safeHeight}px`,
            '--game-layout-vv-w': `${Math.max(320, Math.round(frame.visualWidth))}px`,
            '--game-layout-vv-h': `${Math.max(320, Math.round(frame.visualHeight))}px`,
            '--game-layout-dpr': String(global.devicePixelRatio || 1)
        };
    }

    function applyStylePatch(node, patch) {
        Object.keys(patch).forEach((key) => {
            node.style.setProperty(key, patch[key]);
        });
    }

    function clearLegacyDesignScaleArtifacts() {
        const docEl = global.document.documentElement;
        if (!docEl) return;

        docEl.classList.remove('ra-design-scale-on');

        const legacyStylesheet = global.document.getElementById('ra-design-scale-css');
        if (legacyStylesheet) {
            legacyStylesheet.remove();
        }

        DESIGN_SURFACE_CLEANUP_PROPS.forEach((key) => {
            docEl.style.removeProperty(key);
        });

        resolveDesignSurfaceCleanupTargets().forEach((node) => {
            node.classList.remove('ra-design-surface');
            DESIGN_SURFACE_CLEANUP_PROPS.forEach((key) => {
                node.style.removeProperty(key);
            });
        });
    }

    function applyViewportMetrics() {
        const docEl = global.document.documentElement;
        const frame = resolveViewportFrame();
        const patch = buildViewportPatch(frame);
        const patchKey = Object.keys(patch).map((key) => `${key}:${patch[key]}`).join('|');

        if (patchKey === lastPatchKey) return;
        lastPatchKey = patchKey;

        clearLegacyDesignScaleArtifacts();

        const targets = resolveMetricTargets();
        targets.forEach((node) => {
            applyStylePatch(node, patch);
        });

        applyStylePatch(docEl, patch);

        if (global.RoyalArmiesDisplayResolution && typeof global.RoyalArmiesDisplayResolution.sync === 'function') {
            global.RoyalArmiesDisplayResolution.sync({
                layoutWidth: frame.layoutWidth,
                layoutHeight: frame.layoutHeight,
                visualWidth: frame.visualWidth,
                visualHeight: frame.visualHeight
            });
        }

        global.document.dispatchEvent(new CustomEvent('royalarmies:viewport-metrics-updated', {
            detail: {
                layoutWidth: frame.layoutWidth,
                layoutHeight: frame.layoutHeight,
                visualWidth: frame.visualWidth,
                visualHeight: frame.visualHeight,
                devicePixelRatio: global.devicePixelRatio || 1,
                designEnabled: false,
                browserZoom: frame.browserZoom
            }
        }));
    }

    function scheduleViewportMetrics() {
        if (rafId) global.cancelAnimationFrame(rafId);
        rafId = global.requestAnimationFrame(() => {
            rafId = 0;
            applyViewportMetrics();
        });
    }

    function bindDeferredAssetRemeasure() {
        global.addEventListener('load', scheduleViewportMetrics, { passive: true });
        global.document.addEventListener('royalarmies:viewport-resync-request', scheduleViewportMetrics);
    }

    function bindViewportMetrics() {
        global.addEventListener('resize', scheduleViewportMetrics, { passive: true });
        global.addEventListener('orientationchange', scheduleViewportMetrics, { passive: true });
        global.addEventListener('pageshow', scheduleViewportMetrics, { passive: true });
        if (global.visualViewport) {
            global.visualViewport.addEventListener('resize', scheduleViewportMetrics, { passive: true });
            global.visualViewport.addEventListener('scroll', scheduleViewportMetrics, { passive: true });
        }
        if (global.document.fonts && typeof global.document.fonts.ready?.then === 'function') {
            global.document.fonts.ready.then(scheduleViewportMetrics).catch(() => {});
        }
        bindDeferredAssetRemeasure();
        scheduleViewportMetrics();
    }

    function clientPointToDesign(clientX, clientY) {
        return { x: clientX, y: clientY };
    }

    function clientRectToDesign(rect) {
        return rect;
    }

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', bindViewportMetrics);
    } else {
        bindViewportMetrics();
    }

    global.RoyalArmiesViewportMetrics = {
        sync: applyViewportMetrics,
        schedule: scheduleViewportMetrics,
        isDesignScaleEnabled: () => false,
        clientPointToDesign,
        clientRectToDesign
    };
}(typeof window !== 'undefined' ? window : globalThis);

/**
 * RIFT — Sync reliable viewport CSS variables site-wide (zoom, OS scale, dvh fallbacks).
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
        '.how-did-you-get-here-canvas'
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

    function buildViewportPatch() {
        const docEl = global.document.documentElement;
        const layoutWidth = docEl.clientWidth || global.innerWidth || 0;
        const layoutHeight = global.innerHeight || 0;
        const visualViewport = global.visualViewport;
        const visualWidth = visualViewport ? visualViewport.width : layoutWidth;
        const visualHeight = visualViewport ? visualViewport.height : layoutHeight;
        const safeHeight = Math.max(320, Math.round(Math.min(layoutHeight, visualHeight)));

        return {
            '--ra-layout-vw': `${Math.max(320, Math.round(layoutWidth))}px`,
            '--ra-layout-vh': `${safeHeight}px`,
            '--ra-layout-vv-w': `${Math.max(320, Math.round(visualWidth))}px`,
            '--ra-layout-vv-h': `${Math.max(320, Math.round(visualHeight))}px`,
            '--ra-layout-dpr': String(global.devicePixelRatio || 1),
            '--game-layout-vw': `${Math.max(320, Math.round(layoutWidth))}px`,
            '--game-layout-vh': `${safeHeight}px`,
            '--game-layout-vv-w': `${Math.max(320, Math.round(visualWidth))}px`,
            '--game-layout-vv-h': `${Math.max(320, Math.round(visualHeight))}px`,
            '--game-layout-dpr': String(global.devicePixelRatio || 1)
        };
    }

    function applyViewportMetrics() {
        const docEl = global.document.documentElement;
        const patch = buildViewportPatch();
        const patchKey = Object.keys(patch).map((key) => `${key}:${patch[key]}`).join('|');

        if (patchKey === lastPatchKey) return;
        lastPatchKey = patchKey;

        const targets = resolveMetricTargets();
        targets.forEach((node) => {
            Object.keys(patch).forEach((key) => {
                node.style.setProperty(key, patch[key]);
            });
        });

        Object.keys(patch).forEach((key) => {
            docEl.style.setProperty(key, patch[key]);
        });

        global.document.dispatchEvent(new CustomEvent('royalarmies:viewport-metrics-updated', {
            detail: {
                layoutWidth: parseFloat(patch['--ra-layout-vw']),
                layoutHeight: parseFloat(patch['--ra-layout-vh']),
                visualWidth: parseFloat(patch['--ra-layout-vv-w']),
                visualHeight: parseFloat(patch['--ra-layout-vv-h']),
                devicePixelRatio: global.devicePixelRatio || 1
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

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', bindViewportMetrics);
    } else {
        bindViewportMetrics();
    }

    global.RoyalArmiesViewportMetrics = {
        sync: applyViewportMetrics,
        schedule: scheduleViewportMetrics
    };
}(typeof window !== 'undefined' ? window : globalThis));

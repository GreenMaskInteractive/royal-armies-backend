/**
 * RIFT — Sync reliable viewport CSS variables (zoom, OS scale, dvh fallbacks).
 */
(function initRoyalArmiesViewportMetrics(global) {
    'use strict';

    const ROOT_SELECTORS = ['#game-page-canvas', '#age-page-canvas', '.how-did-you-get-here-canvas'];
    let rafId = 0;

    function resolveMetricTargets() {
        const targets = [];
        ROOT_SELECTORS.forEach((selector) => {
            const node = global.document.querySelector(selector);
            if (node) targets.push(node);
        });
        if (!targets.length && global.document.documentElement) {
            targets.push(global.document.documentElement);
        }
        return targets;
    }

    function applyViewportMetrics() {
        const docEl = global.document.documentElement;
        const layoutWidth = docEl.clientWidth || global.innerWidth || 0;
        const layoutHeight = global.innerHeight || 0;
        const visualViewport = global.visualViewport;
        const visualWidth = visualViewport ? visualViewport.width : layoutWidth;
        const visualHeight = visualViewport ? visualViewport.height : layoutHeight;
        const safeHeight = Math.max(320, Math.round(Math.min(layoutHeight, visualHeight)));

        const patch = {
            '--game-layout-vw': `${Math.max(320, Math.round(layoutWidth))}px`,
            '--game-layout-vh': `${safeHeight}px`,
            '--game-layout-vv-w': `${Math.max(320, Math.round(visualWidth))}px`,
            '--game-layout-vv-h': `${Math.max(320, Math.round(visualHeight))}px`,
            '--game-layout-dpr': String(global.devicePixelRatio || 1)
        };

        const targets = resolveMetricTargets();
        targets.forEach((node) => {
            Object.keys(patch).forEach((key) => {
                node.style.setProperty(key, patch[key]);
            });
        });
        docEl.style.setProperty('--game-layout-vw', patch['--game-layout-vw']);
        docEl.style.setProperty('--game-layout-vh', patch['--game-layout-vh']);
    }

    function scheduleViewportMetrics() {
        if (rafId) global.cancelAnimationFrame(rafId);
        rafId = global.requestAnimationFrame(() => {
            rafId = 0;
            applyViewportMetrics();
        });
    }

    function bindViewportMetrics() {
        global.addEventListener('resize', scheduleViewportMetrics, { passive: true });
        global.addEventListener('orientationchange', scheduleViewportMetrics, { passive: true });
        if (global.visualViewport) {
            global.visualViewport.addEventListener('resize', scheduleViewportMetrics, { passive: true });
            global.visualViewport.addEventListener('scroll', scheduleViewportMetrics, { passive: true });
        }
        if (global.document.fonts && typeof global.document.fonts.ready?.then === 'function') {
            global.document.fonts.ready.then(scheduleViewportMetrics).catch(() => {});
        }
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

/**
 * RIFT — Viewport metrics + 3840×2160 proportional design canvas scaling.
 * Window resize and browser zoom (visualViewport) keep layout positions stable.
 *
 * New MAP pages: load rift-page-loading-gate.js immediately after this file for the
 * site-wide "Loading game..." overlay during slow boots.
 */
(function initRoyalArmiesViewportMetrics(global) {
    'use strict';

    const DESIGN_WIDTH = 3840;
    const DESIGN_HEIGHT = 2160;
    const DESIGN_SCALE_STYLESHEET_ID = 'ra-design-scale-css';
    const DESIGN_SCALE_STYLESHEET_HREF = 'rift-design-scale.css?v=design-scale-hud-fix-1';
    const DESKTOP_SCALE_MIN_WIDTH = 1025;

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

    let rafId = 0;
    let lastPatchKey = '';

    function ensureDesignScaleStylesheet() {
        if (!global.document || global.document.getElementById(DESIGN_SCALE_STYLESHEET_ID)) {
            return;
        }

        const link = global.document.createElement('link');
        link.id = DESIGN_SCALE_STYLESHEET_ID;
        link.rel = 'stylesheet';
        link.href = DESIGN_SCALE_STYLESHEET_HREF;
        (global.document.head || global.document.documentElement).appendChild(link);
    }

    function shouldUseDesignCanvasScale() {
        const body = global.document.body;
        if (body && body.dataset.trailerRender === '1') {
            return false;
        }
        try {
            return global.matchMedia(`(min-width: ${DESKTOP_SCALE_MIN_WIDTH}px)`).matches;
        } catch (_err) {
            return true;
        }
    }

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

    function resolveDesignSurfaces() {
        const surfaces = [];
        const seen = new Set();
        CANVAS_SELECTORS.forEach((selector) => {
            global.document.querySelectorAll(selector).forEach((node) => {
                if (!seen.has(node)) {
                    seen.add(node);
                    surfaces.push(node);
                }
            });
        });

        if (!surfaces.length && global.document.body) {
            surfaces.push(global.document.body);
        }

        return surfaces;
    }

    function readUiScaleMultiplier() {
        const docEl = global.document.documentElement;
        if (!docEl) return 1;
        const raw = global.getComputedStyle(docEl).getPropertyValue('--ui-scale');
        const parsed = Number.parseFloat(String(raw || '').trim());
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
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
            offsetLeft: visualViewport ? visualViewport.offsetLeft : 0,
            offsetTop: visualViewport ? visualViewport.offsetTop : 0,
            browserZoom: visualViewport && Number.isFinite(visualViewport.scale) ? visualViewport.scale : 1
        };
    }

    function buildDesignScalePatch(frame, enabled) {
        if (!enabled) {
            return {
                '--ra-design-width': '',
                '--ra-design-height': '',
                '--ra-design-scale': '',
                '--ra-design-translate-x': '',
                '--ra-design-translate-y': '',
                '--ra-design-fit-width': '',
                '--ra-design-fit-height': '',
                '--ra-design-browser-zoom': ''
            };
        }

        const fitScale = Math.min(
            Math.max(0.05, frame.visualWidth / DESIGN_WIDTH),
            Math.max(0.05, frame.visualHeight / DESIGN_HEIGHT)
        );
        const uiScale = readUiScaleMultiplier();
        const combinedScale = fitScale * uiScale;
        const fitWidth = DESIGN_WIDTH * fitScale;
        const fitHeight = DESIGN_HEIGHT * fitScale;
        const offsetX = (frame.layoutWidth - fitWidth) / 2;
        const offsetY = (frame.layoutHeight - fitHeight) / 2;

        return {
            '--ra-design-width': `${DESIGN_WIDTH}px`,
            '--ra-design-height': `${DESIGN_HEIGHT}px`,
            '--ra-design-scale': String(combinedScale),
            '--ra-design-translate-x': `${offsetX}px`,
            '--ra-design-translate-y': `${offsetY}px`,
            '--ra-design-fit-width': `${fitWidth}px`,
            '--ra-design-fit-height': `${fitHeight}px`,
            '--ra-design-browser-zoom': String(frame.browserZoom)
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
            const value = patch[key];
            if (value === '') {
                node.style.removeProperty(key);
            } else {
                node.style.setProperty(key, value);
            }
        });
    }

    function readDesignTransform() {
        const docEl = global.document.documentElement;
        if (!docEl || !docEl.classList.contains('ra-design-scale-on')) {
            return null;
        }

        const styles = global.getComputedStyle(docEl);
        const scale = Number.parseFloat(styles.getPropertyValue('--ra-design-scale'));
        const tx = Number.parseFloat(styles.getPropertyValue('--ra-design-translate-x'));
        const ty = Number.parseFloat(styles.getPropertyValue('--ra-design-translate-y'));

        if (!Number.isFinite(scale) || scale <= 0) {
            return null;
        }

        return {
            scale,
            tx: Number.isFinite(tx) ? tx : 0,
            ty: Number.isFinite(ty) ? ty : 0
        };
    }

    function clientPointToDesign(clientX, clientY) {
        const transform = readDesignTransform();
        if (!transform) {
            return { x: clientX, y: clientY };
        }

        return {
            x: (clientX - transform.tx) / transform.scale,
            y: (clientY - transform.ty) / transform.scale
        };
    }

    function clientRectToDesign(rect) {
        const transform = readDesignTransform();
        if (!transform || !rect) {
            return rect;
        }

        const left = (rect.left - transform.tx) / transform.scale;
        const top = (rect.top - transform.ty) / transform.scale;
        const width = rect.width / transform.scale;
        const height = rect.height / transform.scale;

        return {
            left,
            top,
            right: left + width,
            bottom: top + height,
            width,
            height,
            x: rect.x,
            y: rect.y
        };
    }

    function applyViewportMetrics() {
        const docEl = global.document.documentElement;
        const frame = resolveViewportFrame();
        const designEnabled = shouldUseDesignCanvasScale();
        const viewportPatch = buildViewportPatch(frame);
        const designPatch = buildDesignScalePatch(frame, designEnabled);
        const patch = Object.assign({}, viewportPatch, designPatch);
        const patchKey = Object.keys(patch).map((key) => `${key}:${patch[key]}`).join('|');

        if (patchKey === lastPatchKey) return;
        lastPatchKey = patchKey;

        docEl.classList.toggle('ra-design-scale-on', designEnabled);

        const metricTargets = resolveMetricTargets();
        const designSpacePatch = designEnabled
            ? Object.assign({}, viewportPatch, {
                '--ra-layout-vw': `${DESIGN_WIDTH}px`,
                '--ra-layout-vh': `${DESIGN_HEIGHT}px`,
                '--ra-layout-vv-w': `${DESIGN_WIDTH}px`,
                '--ra-layout-vv-h': `${DESIGN_HEIGHT}px`,
                '--game-layout-vw': `${DESIGN_WIDTH}px`,
                '--game-layout-vh': `${DESIGN_HEIGHT}px`,
                '--game-layout-vv-w': `${DESIGN_WIDTH}px`,
                '--game-layout-vv-h': `${DESIGN_HEIGHT}px`
            })
            : viewportPatch;

        metricTargets.forEach((node) => {
            applyStylePatch(node, designEnabled ? designSpacePatch : patch);
        });

        applyStylePatch(docEl, patch);

        const designSurfaces = resolveDesignSurfaces();
        designSurfaces.forEach((surface) => {
            surface.classList.toggle('ra-design-surface', designEnabled);
            if (!designEnabled) {
                [
                    '--ra-design-width',
                    '--ra-design-height',
                    '--ra-design-scale',
                    '--ra-design-translate-x',
                    '--ra-design-translate-y',
                    '--ra-design-fit-width',
                    '--ra-design-fit-height',
                    '--ra-design-browser-zoom'
                ].forEach((key) => surface.style.removeProperty(key));
            } else {
                applyStylePatch(surface, designPatch);
            }
        });

        const fitScale = designEnabled
            ? Math.min(frame.visualWidth / DESIGN_WIDTH, frame.visualHeight / DESIGN_HEIGHT)
            : 1;

        global.document.dispatchEvent(new CustomEvent('royalarmies:viewport-metrics-updated', {
            detail: {
                layoutWidth: frame.layoutWidth,
                layoutHeight: frame.layoutHeight,
                visualWidth: frame.visualWidth,
                visualHeight: frame.visualHeight,
                devicePixelRatio: global.devicePixelRatio || 1,
                designWidth: DESIGN_WIDTH,
                designHeight: DESIGN_HEIGHT,
                designScale: designEnabled ? fitScale * readUiScaleMultiplier() : 1,
                designFitScale: fitScale,
                designEnabled,
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
        ensureDesignScaleStylesheet();
        global.addEventListener('resize', scheduleViewportMetrics, { passive: true });
        global.addEventListener('orientationchange', scheduleViewportMetrics, { passive: true });
        global.addEventListener('pageshow', scheduleViewportMetrics, { passive: true });
        if (global.visualViewport) {
            global.visualViewport.addEventListener('resize', scheduleViewportMetrics, { passive: true });
            global.visualViewport.addEventListener('scroll', scheduleViewportMetrics, { passive: true });
        }
        if (global.matchMedia) {
            const desktopMq = global.matchMedia(`(min-width: ${DESKTOP_SCALE_MIN_WIDTH}px)`);
            if (typeof desktopMq.addEventListener === 'function') {
                desktopMq.addEventListener('change', scheduleViewportMetrics);
            } else if (typeof desktopMq.addListener === 'function') {
                desktopMq.addListener(scheduleViewportMetrics);
            }
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
        schedule: scheduleViewportMetrics,
        designWidth: DESIGN_WIDTH,
        designHeight: DESIGN_HEIGHT,
        isDesignScaleEnabled: () => Boolean(readDesignTransform()),
        clientPointToDesign,
        clientRectToDesign
    };
}(typeof window !== 'undefined' ? window : globalThis));

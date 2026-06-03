/**
 * Custom gauntlet pointer (images/cursor.png) with a click burst at the index fingertip.
 * Full-size source: images/gamecursor.png — rebuild via scripts/build-gamecursor.py
 */
(function initRoyalArmiesCustomCursor() {
    'use strict';

    const CURSOR_IMAGE_SRC = 'images/cursor.png';
    const CURSOR_DISPLAY_PX = 56;
    const FINGERTIP_HOTSPOT_X = 3;
    const FINGERTIP_HOTSPOT_Y = 3;
    const ROOT_CLASS = 'royal-armies-custom-cursor';
    const TOUCH_CLASS = 'royal-armies-touch-device';
    const NATIVE_HIDE_STYLE_ID = 'royal-armies-native-cursor-hide';
    const NATIVE_HIDE_CSS = [
        'html.royal-armies-custom-cursor,',
        'html.royal-armies-custom-cursor body,',
        'html.royal-armies-custom-cursor body#main-dashboard-canvas,',
        'html.royal-armies-custom-cursor body#game-page-canvas,',
        'html.royal-armies-custom-cursor body#age-page-canvas,',
        'html.royal-armies-custom-cursor *,',
        'html.royal-armies-custom-cursor *::before,',
        'html.royal-armies-custom-cursor *::after,',
        'html.royal-armies-custom-cursor body#main-dashboard-canvas *,',
        'html.royal-armies-custom-cursor body#game-page-canvas *,',
        'html.royal-armies-custom-cursor body#age-page-canvas *,',
        'html.royal-armies-custom-cursor body#main-dashboard-canvas *::before,',
        'html.royal-armies-custom-cursor body#main-dashboard-canvas *::after,',
        'html.royal-armies-custom-cursor body#game-page-canvas *::before,',
        'html.royal-armies-custom-cursor body#game-page-canvas *::after,',
        'html.royal-armies-custom-cursor body#age-page-canvas *::before,',
        'html.royal-armies-custom-cursor body#age-page-canvas *::after,',
        'html.royal-armies-custom-cursor body#main-dashboard-canvas [class],',
        'html.royal-armies-custom-cursor body#game-page-canvas [class],',
        'html.royal-armies-custom-cursor body#age-page-canvas [class],',
        'html.royal-armies-custom-cursor body#main-dashboard-canvas [id],',
        'html.royal-armies-custom-cursor body#game-page-canvas [id],',
        'html.royal-armies-custom-cursor body#age-page-canvas [id],',
        'html.royal-armies-custom-cursor body#main-dashboard-canvas :is(',
        'html.royal-armies-custom-cursor body#game-page-canvas :is(',
        'html.royal-armies-custom-cursor body#age-page-canvas :is(',
        '    a, button, input, select, textarea, label, summary,',
        '    [role="button"], [role="link"], [role="tab"],',
        '    [href], [onclick], .nav-tab, .footer-icon-link',
        '),',
        'html.royal-armies-custom-cursor body#main-dashboard-canvas *::-webkit-slider-thumb,',
        'html.royal-armies-custom-cursor body#game-page-canvas *::-webkit-slider-thumb,',
        'html.royal-armies-custom-cursor body#age-page-canvas *::-webkit-slider-thumb,',
        'html.royal-armies-custom-cursor body#main-dashboard-canvas *::-moz-range-thumb,',
        'html.royal-armies-custom-cursor body#game-page-canvas *::-moz-range-thumb,',
        'html.royal-armies-custom-cursor body#age-page-canvas *::-moz-range-thumb,',
        'html.royal-armies-custom-cursor *::-webkit-scrollbar,',
        'html.royal-armies-custom-cursor *::-webkit-scrollbar-track,',
        'html.royal-armies-custom-cursor *::-webkit-scrollbar-thumb,',
        'html.royal-armies-custom-cursor *::-webkit-scrollbar-corner {',
        '    cursor: none !important;',
        '}',
        '/* Native scrollbar thumbs steal the OS pointer; hide bars but keep wheel/trackpad scroll. */',
        'html.royal-armies-custom-cursor,',
        'html.royal-armies-custom-cursor * {',
        '    scrollbar-width: none !important;',
        '    -ms-overflow-style: none !important;',
        '}',
        'html.royal-armies-custom-cursor *::-webkit-scrollbar {',
        '    width: 0 !important;',
        '    height: 0 !important;',
        '    display: none !important;',
        '    background: transparent !important;',
        '}',
        'html.royal-armies-custom-cursor *::-webkit-scrollbar-thumb,',
        'html.royal-armies-custom-cursor *::-webkit-scrollbar-track {',
        '    display: none !important;',
        '}'
    ].join('\n');
    const CURSOR_OVERLAY_IDS = new Set(['royal-armies-custom-cursor', 'cursor-click-fx-layer']);
    const MQ_DESKTOP_LAYOUT = '(min-width: 1025px)';
    const MQ_MOBILE_LAYOUT = '(max-width: 1024px)';
    const MQ_TOUCH_PRIMARY = '(hover: none) and (pointer: coarse)';

    /** Desktop layout always keeps the gauntlet; mobile/tablet uses native cursor. */
    function shouldEnableCustomCursor() {
        if (window.matchMedia(MQ_DESKTOP_LAYOUT).matches) return true;
        if (window.matchMedia(MQ_MOBILE_LAYOUT).matches) return false;
        return !window.matchMedia(MQ_TOUCH_PRIMARY).matches;
    }

    let cursorShell = null;
    let clickFxLayer = null;
    let cursorVisible = false;
    let clickPulseTimer = 0;
    let listenersBound = false;
    let pointerButtonHeld = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    /** Elements receiving inline cursor:none (beats #id .class pointer on buttons/links). */
    let cursorHideStyledElements = new Set();

    function isCursorOverlayElement(el) {
        if (!(el instanceof Element)) return false;
        if (el.id && CURSOR_OVERLAY_IDS.has(el.id)) return true;
        return Boolean(el.closest('#royal-armies-custom-cursor, #cursor-click-fx-layer'));
    }

    function clearCursorHideInlineStyles() {
        cursorHideStyledElements.forEach((el) => {
            el.style.removeProperty('cursor');
        });
        cursorHideStyledElements.clear();
    }

    /** Force-hide OS pointer on the hit stack (buttons/links often beat stylesheet specificity). */
    function enforceNativeCursorHiddenAtPoint(clientX, clientY) {
        if (!shouldEnableCustomCursor()) return;

        const nextStyled = new Set();
        const stack = document.elementsFromPoint(clientX, clientY);

        stack.forEach((node) => {
            if (!(node instanceof Element) || isCursorOverlayElement(node)) return;
            node.style.setProperty('cursor', 'none', 'important');
            nextStyled.add(node);
        });

        cursorHideStyledElements.forEach((el) => {
            if (!nextStyled.has(el)) el.style.removeProperty('cursor');
        });
        cursorHideStyledElements = nextStyled;
    }

    function positionCursor(clientX, clientY) {
        if (!cursorShell) return;
        cursorShell.style.left = `${clientX - FINGERTIP_HOTSPOT_X}px`;
        cursorShell.style.top = `${clientY - FINGERTIP_HOTSPOT_Y}px`;
        cursorShell.style.removeProperty('transform');
        if (!cursorVisible) {
            cursorShell.classList.add('is-visible');
            cursorVisible = true;
        }
    }

    function hideCursor() {
        if (!cursorShell) return;
        cursorShell.classList.remove('is-visible');
        cursorVisible = false;
    }

    function pulseCursorPress() {
        if (!cursorShell) return;
        cursorShell.classList.add('is-clicking');
        window.clearTimeout(clickPulseTimer);
        clickPulseTimer = window.setTimeout(() => {
            cursorShell.classList.remove('is-clicking');
        }, 130);
    }

    function spawnFingertipClickBurst(clientX, clientY) {
        if (!clickFxLayer) return;
        const burst = document.createElement('span');
        burst.className = 'cursor-fingertip-click-burst';
        burst.style.left = `${clientX}px`;
        burst.style.top = `${clientY}px`;
        clickFxLayer.appendChild(burst);

        const removeBurst = () => burst.remove();
        burst.addEventListener('animationend', removeBurst, { once: true });
        window.setTimeout(removeBurst, 520);
    }

    function handlePress(clientX, clientY) {
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
        positionCursor(clientX, clientY);
        spawnFingertipClickBurst(clientX, clientY);
        pulseCursorPress();
    }

    function trackPointer(clientX, clientY) {
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
        lastPointerX = clientX;
        lastPointerY = clientY;
        positionCursor(clientX, clientY);
        enforceNativeCursorHiddenAtPoint(clientX, clientY);
    }

    function bindCursorListeners() {
        if (listenersBound) return;
        listenersBound = true;

        window.addEventListener('mousemove', (event) => {
            if (!shouldEnableCustomCursor()) return;
            trackPointer(event.clientX, event.clientY);
        }, true);

        window.addEventListener('pointermove', (event) => {
            if (!shouldEnableCustomCursor()) return;
            trackPointer(event.clientX, event.clientY);
        }, true);

        window.addEventListener('mousedown', (event) => {
            if (!shouldEnableCustomCursor() || event.button !== 0) return;
            pointerButtonHeld = true;
            trackPointer(event.clientX, event.clientY);
            handlePress(event.clientX, event.clientY);
        }, true);

        window.addEventListener('mouseup', (event) => {
            if (!shouldEnableCustomCursor()) return;
            pointerButtonHeld = false;
            trackPointer(event.clientX, event.clientY);
        }, true);

        window.addEventListener('scroll', () => {
            if (!shouldEnableCustomCursor() || !pointerButtonHeld) return;
            trackPointer(lastPointerX, lastPointerY);
        }, true);

        document.documentElement.addEventListener('mouseleave', (event) => {
            if (!shouldEnableCustomCursor() || pointerButtonHeld) return;
            if (event.relatedTarget instanceof Node) return;
            hideCursor();
        }, { passive: true });

        window.addEventListener('blur', () => {
            pointerButtonHeld = false;
            hideCursor();
        }, { passive: true });

        window.addEventListener('royalarmies:viewport-metrics-updated', () => {
            if (!shouldEnableCustomCursor() || !cursorVisible) return;
            trackPointer(lastPointerX, lastPointerY);
        }, { passive: true });
    }

    function syncNativeCursorHidden(enable) {
        const root = document.documentElement;
        const body = document.body;
        let styleEl = document.getElementById(NATIVE_HIDE_STYLE_ID);

        if (!enable) {
            root.style.removeProperty('cursor');
            if (body) body.style.removeProperty('cursor');
            styleEl?.remove();
            clearCursorHideInlineStyles();
            return;
        }

        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = NATIVE_HIDE_STYLE_ID;
        }
        styleEl.textContent = NATIVE_HIDE_CSS;
        document.head.appendChild(styleEl);
        root.style.setProperty('cursor', 'none', 'important');
        if (body) body.style.setProperty('cursor', 'none', 'important');
    }

    function resolveCursorMountRoot() {
        return document.documentElement || document.body;
    }

    function reparentCursorOverlay(node) {
        if (!(node instanceof Element)) return;
        const mountRoot = resolveCursorMountRoot();
        if (node.parentElement !== mountRoot) {
            mountRoot.appendChild(node);
        }
    }

    function mountCustomCursorElements() {
        const existingShell = document.getElementById('royal-armies-custom-cursor');
        const existingFxLayer = document.getElementById('cursor-click-fx-layer');
        if (existingShell) cursorShell = existingShell;
        if (existingFxLayer) clickFxLayer = existingFxLayer;

        if (!cursorShell) {
            cursorShell = document.createElement('div');
            cursorShell.id = 'royal-armies-custom-cursor';
            cursorShell.setAttribute('aria-hidden', 'true');

            const cursorStack = document.createElement('div');
            cursorStack.className = 'royal-armies-cursor-stack';

            const cursorHand = document.createElement('img');
            cursorHand.className = 'royal-armies-cursor-hand';
            cursorHand.src = CURSOR_IMAGE_SRC;
            cursorHand.width = CURSOR_DISPLAY_PX;
            cursorHand.height = CURSOR_DISPLAY_PX;
            cursorHand.alt = '';
            cursorHand.draggable = false;
            cursorHand.decoding = 'async';

            const cursorFinger = document.createElement('img');
            cursorFinger.className = 'royal-armies-cursor-finger';
            cursorFinger.src = CURSOR_IMAGE_SRC;
            cursorFinger.width = CURSOR_DISPLAY_PX;
            cursorFinger.height = CURSOR_DISPLAY_PX;
            cursorFinger.alt = '';
            cursorFinger.draggable = false;
            cursorFinger.decoding = 'async';
            cursorFinger.setAttribute('aria-hidden', 'true');

            cursorStack.appendChild(cursorHand);
            cursorStack.appendChild(cursorFinger);
            cursorShell.appendChild(cursorStack);
        }

        if (!clickFxLayer) {
            clickFxLayer = document.createElement('div');
            clickFxLayer.id = 'cursor-click-fx-layer';
            clickFxLayer.setAttribute('aria-hidden', 'true');
        }

        reparentCursorOverlay(clickFxLayer);
        reparentCursorOverlay(cursorShell);
        bindCursorListeners();
    }

    function applyCustomCursorMode() {
        const enable = shouldEnableCustomCursor();
        document.documentElement.classList.toggle(TOUCH_CLASS, !enable);
        document.documentElement.classList.toggle(ROOT_CLASS, enable);
        syncNativeCursorHidden(enable);

        if (!enable) {
            pointerButtonHeld = false;
            hideCursor();
            return;
        }

        mountCustomCursorElements();
    }

    function watchCursorLayoutQueries() {
        [MQ_DESKTOP_LAYOUT, MQ_MOBILE_LAYOUT, MQ_TOUCH_PRIMARY].forEach((query) => {
            const mq = window.matchMedia(query);
            if (typeof mq.addEventListener === 'function') {
                mq.addEventListener('change', applyCustomCursorMode);
            } else if (typeof mq.addListener === 'function') {
                mq.addListener(applyCustomCursorMode);
            }
        });
    }

    if (!document.body) {
        document.addEventListener('DOMContentLoaded', initRoyalArmiesCustomCursor);
        return;
    }

    applyCustomCursorMode();
    watchCursorLayoutQueries();
})();

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

    function positionCursor(clientX, clientY) {
        if (!cursorShell) return;
        cursorShell.style.transform = `translate(${clientX - FINGERTIP_HOTSPOT_X}px, ${clientY - FINGERTIP_HOTSPOT_Y}px)`;
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

    function bindCursorListeners() {
        if (listenersBound) return;
        listenersBound = true;

        document.addEventListener('mousemove', (event) => {
            if (!shouldEnableCustomCursor()) return;
            positionCursor(event.clientX, event.clientY);
        }, { passive: true });

        document.addEventListener('mousedown', (event) => {
            if (!shouldEnableCustomCursor() || event.button !== 0) return;
            handlePress(event.clientX, event.clientY);
        }, { passive: true });

        document.addEventListener('mouseleave', () => {
            if (!shouldEnableCustomCursor()) return;
            hideCursor();
        }, { passive: true });
    }

    function mountCustomCursorElements() {
        if (cursorShell) return;

        cursorShell = document.createElement('div');
        cursorShell.id = 'royal-armies-custom-cursor';
        cursorShell.setAttribute('aria-hidden', 'true');

        const cursorImage = document.createElement('img');
        cursorImage.src = CURSOR_IMAGE_SRC;
        cursorImage.width = CURSOR_DISPLAY_PX;
        cursorImage.height = CURSOR_DISPLAY_PX;
        cursorImage.alt = '';
        cursorImage.draggable = false;
        cursorImage.decoding = 'async';
        cursorShell.appendChild(cursorImage);

        clickFxLayer = document.createElement('div');
        clickFxLayer.id = 'cursor-click-fx-layer';
        clickFxLayer.setAttribute('aria-hidden', 'true');

        document.body.appendChild(clickFxLayer);
        document.body.appendChild(cursorShell);
        bindCursorListeners();
    }

    function applyCustomCursorMode() {
        const enable = shouldEnableCustomCursor();
        document.documentElement.classList.toggle(TOUCH_CLASS, !enable);
        document.documentElement.classList.toggle(ROOT_CLASS, enable);

        if (!enable) {
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

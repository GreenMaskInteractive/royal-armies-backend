/**
 * Custom finger cursor (images/cursor.png) with a click burst at the fingertip hotspot.
 */
(function initRoyalArmiesCustomCursor() {
    'use strict';

    const CURSOR_IMAGE_SRC = 'images/cursor.png';
    const FINGERTIP_HOTSPOT_X = 7;
    const FINGERTIP_HOTSPOT_Y = 7;
    const ROOT_CLASS = 'royal-armies-custom-cursor';

    if (!document.body) {
        document.addEventListener('DOMContentLoaded', initRoyalArmiesCustomCursor);
        return;
    }

    document.documentElement.classList.add(ROOT_CLASS);

    const cursorShell = document.createElement('div');
    cursorShell.id = 'royal-armies-custom-cursor';
    cursorShell.setAttribute('aria-hidden', 'true');

    const cursorImage = document.createElement('img');
    cursorImage.src = CURSOR_IMAGE_SRC;
    cursorImage.width = 32;
    cursorImage.height = 32;
    cursorImage.alt = '';
    cursorImage.draggable = false;
    cursorImage.decoding = 'async';
    cursorShell.appendChild(cursorImage);

    const clickFxLayer = document.createElement('div');
    clickFxLayer.id = 'cursor-click-fx-layer';
    clickFxLayer.setAttribute('aria-hidden', 'true');

    document.body.appendChild(clickFxLayer);
    document.body.appendChild(cursorShell);

    let cursorVisible = false;
    let clickPulseTimer = 0;

    function positionCursor(clientX, clientY) {
        cursorShell.style.transform = `translate(${clientX - FINGERTIP_HOTSPOT_X}px, ${clientY - FINGERTIP_HOTSPOT_Y}px)`;
        if (!cursorVisible) {
            cursorShell.classList.add('is-visible');
            cursorVisible = true;
        }
    }

    function hideCursor() {
        cursorShell.classList.remove('is-visible');
        cursorVisible = false;
    }

    function pulseCursorPress() {
        cursorShell.classList.add('is-clicking');
        window.clearTimeout(clickPulseTimer);
        clickPulseTimer = window.setTimeout(() => {
            cursorShell.classList.remove('is-clicking');
        }, 130);
    }

    function spawnFingertipClickBurst(clientX, clientY) {
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

    document.addEventListener('mousemove', (event) => {
        positionCursor(event.clientX, event.clientY);
    }, { passive: true });

    document.addEventListener('mousedown', (event) => {
        if (event.button !== 0) return;
        handlePress(event.clientX, event.clientY);
    }, { passive: true });

    document.addEventListener('mouseleave', hideCursor, { passive: true });

    document.addEventListener('touchstart', (event) => {
        const touch = event.touches && event.touches[0];
        if (!touch) return;
        handlePress(touch.clientX, touch.clientY);
    }, { passive: true });
})();

/**
 * Slow fade-out / fade-in when navigating between the Age Portal and game page.
 */
(function initRoyalArmiesPageRouteTransition(global) {
    'use strict';

    const STORAGE_KEY = 'royalArmiesRouteFadeIn';
    const FADE_MS = 1100;

    function ensureOverlay() {
        let overlay = global.document.getElementById('royal-armies-route-transition');
        if (!overlay) {
            overlay = global.document.createElement('div');
            overlay.id = 'royal-armies-route-transition';
            overlay.className = 'royal-armies-route-transition';
            overlay.setAttribute('aria-hidden', 'true');
            const mountTarget = global.document.body || global.document.documentElement;
            mountTarget.appendChild(overlay);
        }
        return overlay;
    }

    function wait(ms) {
        return new Promise((resolve) => {
            global.setTimeout(resolve, ms);
        });
    }

    function waitForNextPaint() {
        return new Promise((resolve) => {
            global.requestAnimationFrame(() => {
                global.requestAnimationFrame(resolve);
            });
        });
    }

    function readPendingEnterFade() {
        try {
            return global.sessionStorage.getItem(STORAGE_KEY) === '1';
        } catch (_err) {
            return false;
        }
    }

    function markPendingEnterFade() {
        try {
            global.sessionStorage.setItem(STORAGE_KEY, '1');
        } catch (_err) {
            /* ignore */
        }
    }

    function clearPendingEnterFade() {
        try {
            global.sessionStorage.removeItem(STORAGE_KEY);
        } catch (_err) {
            /* ignore */
        }
    }

    async function navigateTo(url) {
        const overlay = ensureOverlay();
        overlay.classList.remove('is-revealing', 'is-covered');
        overlay.classList.add('is-visible', 'is-fading-out');
        await waitForNextPaint();
        await wait(FADE_MS);
        markPendingEnterFade();
        global.location.assign(url);
    }

    async function runEnterFadeIfNeeded() {
        if (!readPendingEnterFade()) return;
        clearPendingEnterFade();

        const overlay = ensureOverlay();
        overlay.classList.add('is-visible', 'is-covered');
        overlay.classList.remove('is-fading-out', 'is-revealing');
        await waitForNextPaint();
        overlay.classList.remove('is-covered');
        overlay.classList.add('is-revealing');
        await wait(FADE_MS + 80);
        overlay.classList.remove('is-visible', 'is-revealing', 'is-fading-out');
    }

    if (readPendingEnterFade()) {
        ensureOverlay().classList.add('is-visible', 'is-covered');
    }

    global.RoyalArmiesPageRouteTransition = {
        navigateTo,
        FADE_MS,
        STORAGE_KEY
    };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', () => {
            runEnterFadeIfNeeded();
        }, { once: true });
    } else {
        runEnterFadeIfNeeded();
    }
})(window);

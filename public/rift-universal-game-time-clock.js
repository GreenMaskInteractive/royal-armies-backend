/**
 * RIFT — Universal UTC game clock (portal + Age top bar).
 * Starts on DOM ready; independent of page loading gate retain/release.
 */
(function initRoyalArmiesUniversalGameTimeClock(global) {
    'use strict';

    const DISPLAY_ID = 'portal-universal-game-time-display';
    const PANEL_ID = 'portal-universal-game-time-panel';
    const TICK_MS = 1000;

    let tickTimer = null;

    function formatUniversalGameTimeClock(now = new Date()) {
        const hours = String(now.getUTCHours()).padStart(2, '0');
        const minutes = String(now.getUTCMinutes()).padStart(2, '0');
        const seconds = String(now.getUTCSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    function renderUniversalGameTimeDisplay(display, timeString) {
        if (!display) return;

        const text = String(timeString || '--:--:--');
        display.textContent = text;
        display.setAttribute('aria-label', `Game time ${text}`);
    }

    function revealClockChrome() {
        const panel = global.document.getElementById(PANEL_ID);
        if (panel) {
            panel.hidden = false;
            panel.removeAttribute('hidden');
        }
        const cluster = global.document.querySelector('.age-map-top-bar-clock-cluster');
        if (cluster) {
            cluster.hidden = false;
            cluster.removeAttribute('hidden');
        }
    }

    function tickClock() {
        const display = global.document.getElementById(DISPLAY_ID);
        if (!display) return false;
        renderUniversalGameTimeDisplay(display, formatUniversalGameTimeClock(new Date()));
        return true;
    }

    function enable() {
        revealClockChrome();
        if (tickTimer) return;
        if (!tickClock()) return;
        tickTimer = global.setInterval(tickClock, TICK_MS);
    }

    function boot() {
        if (global.document.readyState === 'loading') {
            global.document.addEventListener('DOMContentLoaded', enable, { once: true });
            return;
        }
        enable();
    }

    global.RoyalArmiesUniversalGameTimeClock = {
        enable,
        format: formatUniversalGameTimeClock,
        render: renderUniversalGameTimeDisplay
    };

    boot();
})(window);

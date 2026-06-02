/**
 * RIFT — Site-wide page loading gate (dark overlay + "Loading game…").
 *
 * Include on every MAP page immediately after rift-viewport-metrics.js:
 *   <script src="rift-page-loading-gate.js?v=page-loading-gate-1"></script>
 *
 * Opt out: <body data-ra-page-loading="off"> or data-ra-page-loading="false"
 *
 * API:
 *   RoyalArmiesPageLoadingGate.retain(reason?)  — hold overlay while work runs
 *   RoyalArmiesPageLoadingGate.release(reason?)  — release one hold (async fade)
 *   RoyalArmiesPageLoadingGate.trackBoot(fn)     — await async boot helper
 *   RoyalArmiesPageLoadingGate.setMessage(text)  — change popup copy
 *
 * Events (for pages that cannot import this file directly):
 *   royalarmies:page-loading-retain  — detail: { reason }
 *   royalarmies:page-loading-release — detail: { reason }
 */
(function initRoyalArmiesPageLoadingGate(global) {
    'use strict';

    const OVERLAY_ID = 'ra-page-loading-gate';
    const SHOW_DELAY_MS = 120;
    const FADE_MS = 220;
    const DEFAULT_MESSAGE = 'Loading game...';

    let retainCount = 0;
    let showTimer = 0;
    let hideTimer = 0;
    let overlayVisible = false;
    let messageText = DEFAULT_MESSAGE;

    function isGateDisabled() {
        const body = global.document.body;
        if (!body) return false;
        const flag = String(body.getAttribute('data-ra-page-loading') || '').trim().toLowerCase();
        return flag === 'off' || flag === 'false' || flag === '0' || flag === 'no';
    }

    function waitMs(ms) {
        return new Promise((resolve) => {
            global.setTimeout(resolve, ms);
        });
    }

    function ensureGateStyles() {
        if (global.document.getElementById('ra-page-loading-gate-styles')) return;
        const style = global.document.createElement('style');
        style.id = 'ra-page-loading-gate-styles';
        style.textContent = ''
            + '.ra-page-loading-gate{position:fixed;inset:0;z-index:2147483640;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;pointer-events:none;opacity:0;transition:opacity .22s ease}'
            + '.ra-page-loading-gate.is-visible{pointer-events:auto;opacity:1}'
            + '.ra-page-loading-gate[hidden]{display:none!important}'
            + '.ra-page-loading-gate-backdrop{position:absolute;inset:0;background:rgba(4,3,2,.62)}'
            + '.ra-page-loading-gate-dialog{position:relative;z-index:1;width:min(420px,calc(100vw - 48px));margin:0;border:1px solid rgba(197,160,89,.42);border-radius:6px;background:linear-gradient(145deg,rgba(28,22,14,.96),rgba(8,6,4,.98));box-shadow:0 12px 28px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,215,0,.12);padding:22px 28px;text-align:center}'
            + '.ra-page-loading-gate-message{margin:0;font-family:Cinzel,Georgia,serif;font-size:.95rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#ffd978}';
        (global.document.head || global.document.documentElement).appendChild(style);
    }

    function ensureOverlay() {
        ensureGateStyles();
        let overlay = global.document.getElementById(OVERLAY_ID);
        if (!overlay) {
            overlay = global.document.createElement('div');
            overlay.id = OVERLAY_ID;
            overlay.className = 'ra-page-loading-gate';
            overlay.hidden = true;
            overlay.setAttribute('role', 'status');
            overlay.setAttribute('aria-live', 'polite');
            overlay.setAttribute('aria-busy', 'false');
            overlay.innerHTML = ''
                + '<div class="ra-page-loading-gate-backdrop" aria-hidden="true"></div>'
                + '<div class="ra-page-loading-gate-dialog portal-deployment-server-panel" role="document">'
                + '<div class="portal-server-panel-controls game-page-panel-bezel">'
                + `<p class="ra-page-loading-gate-message" id="${OVERLAY_ID}-message">${DEFAULT_MESSAGE}</p>`
                + '</div>'
                + '</div>';
            const mountTarget = global.document.body || global.document.documentElement;
            mountTarget.appendChild(overlay);
        }
        return overlay;
    }

    function syncOverlayMessage() {
        const messageEl = global.document.getElementById(`${OVERLAY_ID}-message`);
        if (messageEl) messageEl.textContent = messageText;
    }

    function showOverlay() {
        if (isGateDisabled() || overlayVisible) return;
        const overlay = ensureOverlay();
        syncOverlayMessage();
        overlay.hidden = false;
        overlay.classList.add('is-visible');
        overlay.setAttribute('aria-busy', 'true');
        overlayVisible = true;
    }

    async function hideOverlay() {
        if (!overlayVisible) return;
        const overlay = ensureOverlay();
        overlay.classList.remove('is-visible');
        overlay.setAttribute('aria-busy', 'false');
        overlayVisible = false;
        await waitMs(FADE_MS);
        if (!overlayVisible && retainCount === 0) {
            overlay.hidden = true;
        }
    }

    function scheduleShow() {
        if (isGateDisabled() || overlayVisible || showTimer) return;
        showTimer = global.setTimeout(() => {
            showTimer = 0;
            if (retainCount > 0) showOverlay();
        }, SHOW_DELAY_MS);
    }

    function cancelScheduledShow() {
        if (!showTimer) return;
        global.clearTimeout(showTimer);
        showTimer = 0;
    }

    function scheduleHide() {
        cancelScheduledShow();
        if (hideTimer) global.clearTimeout(hideTimer);
        hideTimer = global.setTimeout(() => {
            hideTimer = 0;
            if (retainCount === 0) {
                void hideOverlay();
            }
        }, 0);
    }

    function retain(reason) {
        if (isGateDisabled()) return;
        retainCount += 1;
        if (retainCount === 1) scheduleShow();
        void reason;
    }

    async function release(reason) {
        if (isGateDisabled()) return;
        retainCount = Math.max(0, retainCount - 1);
        void reason;
        if (retainCount === 0) scheduleHide();
    }

    function setMessage(text) {
        const next = String(text || '').trim();
        messageText = next || DEFAULT_MESSAGE;
        syncOverlayMessage();
    }

    async function trackBoot(bootFn, reason) {
        retain(reason || 'boot');
        try {
            return await bootFn();
        } finally {
            await release(reason || 'boot');
        }
    }

    function bindBaselineDocumentLoad() {
        if (isGateDisabled()) return;
        retain('document');

        if (global.document.readyState === 'complete') {
            void release('document');
            return;
        }

        global.addEventListener('load', () => {
            void release('document');
        }, { once: true, passive: true });
    }

    function bindLoadingGateEvents() {
        global.document.addEventListener('royalarmies:page-loading-retain', (event) => {
            retain(event?.detail?.reason || 'event');
        });
        global.document.addEventListener('royalarmies:page-loading-release', (event) => {
            void release(event?.detail?.reason || 'event');
        });
    }

    global.RoyalArmiesPageLoadingGate = {
        retain,
        release,
        trackBoot,
        setMessage,
        SHOW_DELAY_MS,
        FADE_MS,
        DEFAULT_MESSAGE
    };

    bindLoadingGateEvents();
    bindBaselineDocumentLoad();
})(window);

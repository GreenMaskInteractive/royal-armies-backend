/**
 * RIFT — Full-screen enrollment loading theatre (first Age join / exile re-entry).
 */
(function initRoyalArmiesAgeEnrollmentLoading(global) {
    'use strict';

    const OVERLAY_ID = 'age-enrollment-loading';
    const STORAGE_KEY = 'royalarmies:age-enrollment-loading';
    const LORE_TOOL_SRC = 'images/royalarmiesloretool.png';
    const MIN_DISPLAY_MS = 5600;
    const SHORT_MIN_DISPLAY_MS = 2000;
    const STATUS_ROTATE_MS = 2400;
    const TIP_ROTATE_MS = 7800;
    const FADE_MS = 380;

    const STATUS_LINES = Object.freeze([
        'Loading game...',
        'Activating nation randomizer',
        'Assigning realm allegiance',
        'Travelling to capital city',
        'Registering commander dossier',
        'Synchronizing world geography',
        'Mustering settlement garrisons',
        'Calibrating march routes',
        'Opening the Age war ledger',
        'Preparing council channels',
        'Issuing deployment clearance'
    ]);

    const ENROLLMENT_TIPS = Object.freeze([
        {
            title: 'Game Hub',
            body: 'Open MENU (Game Hub) for Headquarters, Records, Discoveries, Banner, and Battle Pass.',
            imageSrc: ''
        },
        {
            title: 'Settlement Buildings',
            body: 'Open Buildings on the right HUD to reach the Adventurers Guild, Barracks, Church, and Infirmary.',
            imageSrc: ''
        },
        {
            title: 'World Map Cities',
            body: 'Click any city on the world map to open City Info, movement routes, and the Watchtower.',
            imageSrc: ''
        },
        {
            title: 'Guild Training',
            body: 'Hold Battle in the Adventurers Guild until the charge ring completes to earn commander rank and guild XP.',
            imageSrc: ''
        },
        {
            title: 'Balanced Armies',
            body: 'Spread recruits across artillery, beasts, cavalry, and infantry — mixed rosters earn stronger bonuses in PvP.',
            imageSrc: ''
        },
        {
            title: 'Nation Status',
            body: 'Nation Status on the left HUD lists terrain bonuses for cities across your realm.',
            imageSrc: ''
        },
        {
            title: 'Council Board',
            body: 'Council Board posts nation notices and scheduled strike-force windows for your country.',
            imageSrc: ''
        },
        {
            title: 'Commander Gear',
            body: 'Battle gear bonuses apply in city assault and border PvP — not guild training drills.',
            imageSrc: ''
        }
    ]);

    let active = false;
    let freshEnrollment = false;
    let statusIndex = 0;
    let tipIndex = 0;
    let statusTimer = 0;
    let tipTimer = 0;
    let activatedAt = 0;

    function waitMs(ms) {
        return new Promise((resolve) => {
            global.setTimeout(resolve, ms);
        });
    }

    function markPendingFromExile() {
        try {
            global.sessionStorage.setItem(STORAGE_KEY, '1');
        } catch (_err) {
            /* ignore */
        }
    }

    function clearPendingFlag() {
        try {
            global.sessionStorage.removeItem(STORAGE_KEY);
        } catch (_err) {
            /* ignore */
        }
    }

    function hasPendingExileFlag() {
        try {
            return global.sessionStorage.getItem(STORAGE_KEY) === '1';
        } catch (_err) {
            return false;
        }
    }

    function shouldPreflightActivate() {
        if (freshEnrollment) return true;
        if (hasPendingExileFlag()) return true;
        if (typeof global.isCommanderGameSessionStarted === 'function') {
            return !global.isCommanderGameSessionStarted();
        }
        return false;
    }

    function disableGenericLoadingGate() {
        const body = global.document.body;
        if (!body) return;
        body.setAttribute('data-ra-page-loading', 'off');
    }

    function ensureOverlay() {
        let overlay = global.document.getElementById(OVERLAY_ID);
        if (overlay) return overlay;

        overlay = global.document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.className = 'age-enrollment-loading';
        overlay.hidden = true;
        overlay.setAttribute('role', 'status');
        overlay.setAttribute('aria-live', 'polite');
        overlay.setAttribute('aria-busy', 'true');
        overlay.innerHTML = (
            '<div class="age-enrollment-loading-inner">'
            + '<div class="age-enrollment-loading-head">'
            + `<img class="age-enrollment-loading-lore-tool" src="${LORE_TOOL_SRC}" alt="" width="96" height="96" decoding="async">`
            + '<div class="age-enrollment-loading-status-wrap">'
            + `<p class="age-enrollment-loading-status" id="${OVERLAY_ID}-status">${STATUS_LINES[0]}</p>`
            + '</div>'
            + '</div>'
            + '<div class="age-enrollment-loading-tip">'
            + `<div class="age-enrollment-loading-tip-visual" id="${OVERLAY_ID}-tip-visual">`
            + '<span class="age-enrollment-loading-tip-visual-label">Tip illustration forthcoming</span>'
            + `<img class="age-enrollment-loading-tip-visual-img" id="${OVERLAY_ID}-tip-image" alt="" hidden>`
            + '</div>'
            + `<h2 class="age-enrollment-loading-tip-title" id="${OVERLAY_ID}-tip-title"></h2>`
            + `<p class="age-enrollment-loading-tip-body" id="${OVERLAY_ID}-tip-body"></p>`
            + '</div>'
            + '</div>'
        );

        const mountTarget = global.document.body || global.document.documentElement;
        mountTarget.appendChild(overlay);
        return overlay;
    }

    function renderStatusLine(index) {
        const statusEl = global.document.getElementById(`${OVERLAY_ID}-status`);
        if (!statusEl) return;
        const line = STATUS_LINES[index % STATUS_LINES.length] || STATUS_LINES[0];
        statusEl.textContent = line;
    }

    function renderTip(index) {
        const tip = ENROLLMENT_TIPS[index % ENROLLMENT_TIPS.length] || ENROLLMENT_TIPS[0];
        const titleEl = global.document.getElementById(`${OVERLAY_ID}-tip-title`);
        const bodyEl = global.document.getElementById(`${OVERLAY_ID}-tip-body`);
        const visualEl = global.document.getElementById(`${OVERLAY_ID}-tip-visual`);
        const imageEl = global.document.getElementById(`${OVERLAY_ID}-tip-image`);

        if (titleEl) titleEl.textContent = tip.title || '';
        if (bodyEl) bodyEl.textContent = tip.body || '';

        const imageSrc = String(tip.imageSrc || '').trim();
        if (visualEl && imageEl) {
            if (imageSrc) {
                imageEl.src = imageSrc;
                imageEl.alt = tip.title || 'Tip illustration';
                imageEl.hidden = false;
                visualEl.classList.add('has-image');
            } else {
                imageEl.removeAttribute('src');
                imageEl.hidden = true;
                visualEl.classList.remove('has-image');
            }
        }
    }

    function fadeSwapStatus() {
        const statusEl = global.document.getElementById(`${OVERLAY_ID}-status`);
        if (!statusEl) return;
        statusEl.classList.add('is-fading');
        global.setTimeout(() => {
            statusIndex = (statusIndex + 1) % STATUS_LINES.length;
            renderStatusLine(statusIndex);
            statusEl.classList.remove('is-fading');
        }, 180);
    }

    function fadeSwapTip() {
        const bodyEl = global.document.getElementById(`${OVERLAY_ID}-tip-body`);
        if (!bodyEl) return;
        bodyEl.classList.add('is-fading');
        global.setTimeout(() => {
            tipIndex = (tipIndex + 1) % ENROLLMENT_TIPS.length;
            renderTip(tipIndex);
            bodyEl.classList.remove('is-fading');
        }, 180);
    }

    function startRotators() {
        stopRotators();
        statusIndex = 0;
        tipIndex = Math.floor(Math.random() * ENROLLMENT_TIPS.length);
        renderStatusLine(statusIndex);
        renderTip(tipIndex);
        statusTimer = global.setInterval(fadeSwapStatus, STATUS_ROTATE_MS);
        tipTimer = global.setInterval(fadeSwapTip, TIP_ROTATE_MS);
    }

    function stopRotators() {
        if (statusTimer) {
            global.clearInterval(statusTimer);
            statusTimer = 0;
        }
        if (tipTimer) {
            global.clearInterval(tipTimer);
            tipTimer = 0;
        }
    }

    function activate() {
        if (active) return;
        active = true;
        freshEnrollment = freshEnrollment || hasPendingExileFlag();
        activatedAt = Date.now();
        disableGenericLoadingGate();
        const overlay = ensureOverlay();
        overlay.hidden = false;
        overlay.classList.remove('is-hiding');
        overlay.setAttribute('aria-busy', 'true');
        global.document.body?.classList.add('age-enrollment-loading-open');
        startRotators();
    }

    function confirmFreshEnrollment() {
        freshEnrollment = true;
        if (!active) activate();
    }

    async function complete(options) {
        if (!active) return;

        const useShort = Boolean(options?.short) && !freshEnrollment;
        const minMs = useShort ? SHORT_MIN_DISPLAY_MS : MIN_DISPLAY_MS;
        const elapsed = Date.now() - activatedAt;
        const wait = Math.max(0, minMs - elapsed);
        if (wait) await waitMs(wait);

        stopRotators();
        const overlay = global.document.getElementById(OVERLAY_ID);
        if (overlay) {
            overlay.classList.add('is-hiding');
            overlay.setAttribute('aria-busy', 'false');
        }

        await waitMs(FADE_MS);

        if (overlay) {
            overlay.hidden = true;
            overlay.classList.remove('is-hiding');
        }

        active = false;
        freshEnrollment = false;
        clearPendingFlag();
        global.document.body?.classList.remove('age-enrollment-loading-open');
    }

    function maybeActivateOnBoot() {
        if (shouldPreflightActivate()) activate();
    }

    global.RoyalArmiesAgeEnrollmentLoading = Object.freeze({
        activate,
        complete,
        confirmFreshEnrollment,
        markPendingFromExile,
        isActive: () => active,
        wasFreshEnrollment: () => freshEnrollment
    });

    global.markPendingAgeEnrollmentLoading = markPendingFromExile;

    if (global.document.body) {
        maybeActivateOnBoot();
    } else {
        global.document.addEventListener('DOMContentLoaded', maybeActivateOnBoot, { once: true });
    }
}(typeof window !== 'undefined' ? window : globalThis));

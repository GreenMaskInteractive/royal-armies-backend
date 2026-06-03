/**
 * RIFT — Nation Hub dropdown (views, War Room, War Ledger) on the Age top bar.
 */
(function initAgeNationHub(global) {
    'use strict';

    let bound = false;
    let escapeHandler = null;
    let layoutHandler = null;
    let closeFinishTimer = 0;
    const MENU_TOGGLE_GAP_PX = 0;
    const MENU_OFFSET_RIGHT_PX = 60;

    function getHub() {
        return global.document.getElementById('age-nation-hub');
    }

    function getMenu() {
        return global.document.getElementById('age-nation-hub-menu');
    }

    function getToggle() {
        return global.document.getElementById('age-nation-hub-toggle');
    }

    function isHubOpen() {
        return Boolean(getHub()?.classList.contains('is-open'));
    }

    function isHubClosing() {
        return Boolean(getHub()?.classList.contains('is-hub-closing'));
    }

    function finishHubClose() {
        const hub = getHub();
        if (!hub) return;
        hub.classList.remove('is-hub-closing');
        if (closeFinishTimer) {
            global.clearTimeout(closeFinishTimer);
            closeFinishTimer = 0;
        }
    }

    function beginHubClose() {
        const hub = getHub();
        const menu = getMenu();
        const toggle = getToggle();
        if (!hub || !menu || !toggle) return;

        hub.classList.remove('is-open');
        hub.classList.add('is-hub-closing');
        toggle.setAttribute('aria-expanded', 'false');
        menu.setAttribute('aria-hidden', 'true');

        clearMenuPositionWatch();
        if (escapeHandler) {
            global.document.removeEventListener('keydown', escapeHandler);
            escapeHandler = null;
        }

        const onTransitionEnd = (event) => {
            if (event.target !== menu || event.propertyName !== 'grid-template-rows') return;
            menu.removeEventListener('transitionend', onTransitionEnd);
            finishHubClose();
        };
        menu.addEventListener('transitionend', onTransitionEnd);
        if (closeFinishTimer) {
            global.clearTimeout(closeFinishTimer);
        }
        closeFinishTimer = global.setTimeout(finishHubClose, 520);
    }

    function clearMenuPositionWatch() {
        if (layoutHandler) {
            global.removeEventListener('resize', layoutHandler);
            global.removeEventListener('royalarmies:viewport-metrics-updated', layoutHandler);
            layoutHandler = null;
        }
    }

    function syncMenuPosition() {
        const toggle = getToggle();
        const menu = getMenu();
        if (!toggle || !menu) return;

        const rect = toggle.getBoundingClientRect();
        menu.style.setProperty('--age-nation-hub-menu-top', `${Math.round(rect.bottom + MENU_TOGGLE_GAP_PX)}px`);
        menu.style.setProperty(
            '--age-nation-hub-menu-right',
            `${Math.round(global.window.innerWidth - rect.right - MENU_OFFSET_RIGHT_PX)}px`
        );
        menu.style.setProperty(
            '--age-nation-hub-menu-min-width',
            `${Math.max(196, Math.round(rect.width))}px`
        );
        menu.classList.add('is-menu-position-synced');
    }

    function ensureMenuPositionWatch() {
        if (layoutHandler) return;
        layoutHandler = () => {
            syncMenuPosition();
        };
        global.addEventListener('resize', layoutHandler, { passive: true });
        global.addEventListener('royalarmies:viewport-metrics-updated', layoutHandler, { passive: true });
    }

    function setHubOpen(open) {
        const hub = getHub();
        const menu = getMenu();
        const toggle = getToggle();
        if (!hub || !menu || !toggle) return;

        const nextOpen = Boolean(open);
        syncMenuPosition();

        if (nextOpen) {
            finishHubClose();
            hub.classList.remove('is-hub-closing');
            hub.classList.add('is-open');
            toggle.setAttribute('aria-expanded', 'true');
            menu.setAttribute('aria-hidden', 'false');
            ensureMenuPositionWatch();
            global.requestAnimationFrame(syncMenuPosition);
            if (!escapeHandler) {
                escapeHandler = (event) => {
                    if (event.key === 'Escape') {
                        setHubOpen(false);
                    }
                };
                global.document.addEventListener('keydown', escapeHandler);
            }
            return;
        }

        if (isHubClosing()) {
            return;
        }

        if (isHubOpen()) {
            beginHubClose();
            return;
        }

        finishHubClose();
        hub.classList.remove('is-open', 'is-hub-closing');
        toggle.setAttribute('aria-expanded', 'false');
        menu.setAttribute('aria-hidden', 'true');
    }

    function closeHub() {
        setHubOpen(false);
    }

    function toggleHub() {
        if (isHubClosing()) return;
        setHubOpen(!isHubOpen());
    }

    function onDocumentPointerDown(event) {
        if (!isHubOpen() && !isHubClosing()) return;
        const hub = getHub();
        if (!hub || hub.contains(event.target)) return;
        closeHub();
    }

    function onMenuItemActivate(event) {
        const item = event.target.closest('.age-nation-hub-menu-item, [data-age-view-tab]');
        if (!item || !getMenu()?.contains(item)) return;

        if (item.id === 'age-war-room-open') {
            event.preventDefault();
            closeHub();
            global.RoyalArmiesAgeArmyGroups?.openWorkspace?.();
            return;
        }

        if (item.id === 'age-war-ledger-open') {
            closeHub();
            return;
        }

        if (item.hasAttribute('data-age-view-tab')) {
            closeHub();
        }
    }

    function bindNationHub() {
        if (bound) return;
        bound = true;

        getToggle()?.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleHub();
        });

        getMenu()?.addEventListener('click', onMenuItemActivate);

        global.document.addEventListener('pointerdown', onDocumentPointerDown, true);

        global.addEventListener('royalarmies:age-war-room-open-change', (event) => {
            if (event.detail?.open) {
                closeHub();
            }
        });
    }

    function enableNationHub() {
        bindNationHub();
        syncMenuPosition();
    }

    function init() {
        if (global.document.readyState === 'loading') {
            global.document.addEventListener('DOMContentLoaded', enableNationHub, { once: true });
        } else {
            enableNationHub();
        }
    }

    global.RoyalArmiesAgeNationHub = {
        enable: enableNationHub,
        open: () => setHubOpen(true),
        close: closeHub,
        toggle: toggleHub,
        isOpen: isHubOpen
    };

    init();
})(window);

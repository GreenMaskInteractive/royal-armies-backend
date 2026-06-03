/**
 * RIFT — Nation Hub dropdown (views, War Room, War Ledger) on the Age top bar.
 */
(function initAgeNationHub(global) {
    'use strict';

    let bound = false;
    let escapeHandler = null;

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

    function setHubOpen(open) {
        const hub = getHub();
        const menu = getMenu();
        const toggle = getToggle();
        if (!hub || !menu || !toggle) return;

        const nextOpen = Boolean(open);
        hub.classList.toggle('is-open', nextOpen);
        toggle.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
        menu.setAttribute('aria-hidden', nextOpen ? 'false' : 'true');

        if (nextOpen && !escapeHandler) {
            escapeHandler = (event) => {
                if (event.key === 'Escape') {
                    setHubOpen(false);
                }
            };
            global.document.addEventListener('keydown', escapeHandler);
        } else if (!nextOpen && escapeHandler) {
            global.document.removeEventListener('keydown', escapeHandler);
            escapeHandler = null;
        }
    }

    function closeHub() {
        setHubOpen(false);
    }

    function toggleHub() {
        setHubOpen(!isHubOpen());
    }

    function onDocumentPointerDown(event) {
        if (!isHubOpen()) return;
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

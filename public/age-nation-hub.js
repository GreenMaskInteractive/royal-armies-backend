/**
 * RIFT — Nation Hub menu on the Age top bar (box menu active; radial saved for restore).
 */
(function initAgeNationHub(global) {
    'use strict';

    /** Set true to restore full-screen radial menu (go-to design in style-age-nation-hub-radial.css). */
    const ENABLE_RADIAL_HUB_MENU = false;

    const BOX_BUILD_VERSION = 'nation-hub-box-2';
    const RADIAL_MENU_IMAGE = 'images/radialmenu.png?v=radialmenu-accent-3';
    const RADIAL_BUILD_VERSION = 'radialmenu-accent-3';
    const RADIAL_WEDGE_ANGLES_DEG = Object.freeze([-67.5, -22.5, 22.5, 67.5, 112.5]);

    const HUB_ITEMS = Object.freeze([
        { id: 'nation', label: 'Nation' },
        { id: 'records', label: 'Records' },
        { id: 'discoveries', label: 'Discoveries' },
        { id: 'banner', label: 'Banner' },
        { id: 'battle-pass', label: 'Battle Pass' }
    ]);

    const BOX_MENU_COLUMN_SPLIT = 3;

    let bound = false;
    let escapeHandler = null;
    let boxMenuLayoutHandler = null;

    function getHub() {
        return global.document.getElementById('age-nation-hub');
    }

    function getMenu() {
        return global.document.getElementById('age-nation-hub-menu');
    }

    function getMenuColumns() {
        return global.document.getElementById('age-nation-hub-menu-columns');
    }

    function getRadial() {
        return global.document.getElementById('age-nation-hub-radial');
    }

    function getDial() {
        return global.document.getElementById('age-nation-hub-radial-dial');
    }

    function getToggle() {
        return global.document.getElementById('age-nation-hub-toggle');
    }

    function isHubOpen() {
        return Boolean(getHub()?.classList.contains('is-open'));
    }

    function ensureRadialPortal() {
        const radial = getRadial();
        if (!radial || radial.dataset.ageRadialPortaled === 'true') return;
        global.document.body.appendChild(radial);
        radial.dataset.ageRadialPortaled = 'true';
    }

    function ensureBoxMenuPortal() {
        const menu = getMenu();
        if (!menu || menu.dataset.ageBoxPortaled === 'true') return;
        global.document.body.appendChild(menu);
        menu.classList.add('is-box-menu-portaled');
        menu.dataset.ageBoxPortaled = 'true';
    }

    function syncBoxMenuPosition() {
        const menu = getMenu();
        const toggle = getToggle();
        if (!menu || !toggle) return;

        const rect = toggle.getBoundingClientRect();
        const gapPx = 8;
        menu.style.setProperty('--age-nation-hub-box-top', `${Math.round(rect.bottom + gapPx)}px`);
        menu.style.setProperty('--age-nation-hub-box-left', `${Math.round(rect.left)}px`);
    }

    function bindBoxMenuLayoutSync() {
        if (boxMenuLayoutHandler) return;
        boxMenuLayoutHandler = () => {
            if (!isHubOpen()) return;
            syncBoxMenuPosition();
        };
        global.addEventListener('resize', boxMenuLayoutHandler);
        global.addEventListener('scroll', boxMenuLayoutHandler, true);
    }

    function setHubOpen(open) {
        const hub = getHub();
        const toggle = getToggle();
        if (!hub || !toggle) return;

        const nextOpen = Boolean(open);

        if (ENABLE_RADIAL_HUB_MENU) {
            setHubOpenRadial(nextOpen, hub, toggle);
        } else {
            setHubOpenBox(nextOpen, hub, toggle);
        }

        if (nextOpen) {
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

        if (escapeHandler) {
            global.document.removeEventListener('keydown', escapeHandler);
            escapeHandler = null;
        }
    }

    function setHubOpenBox(open, hub, toggle) {
        const menu = getMenu();
        const nextOpen = Boolean(open);

        hub.classList.toggle('is-open', nextOpen);
        toggle.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');

        if (!menu) return;

        if (nextOpen) {
            ensureBoxMenuPortal();
            syncBoxMenuPosition();
            menu.classList.add('is-box-menu-open');
            menu.hidden = false;
            menu.removeAttribute('hidden');
            menu.setAttribute('aria-hidden', 'false');
            return;
        }

        menu.classList.remove('is-box-menu-open');
        menu.hidden = true;
        menu.setAttribute('hidden', '');
        menu.setAttribute('aria-hidden', 'true');
    }

    function setHubOpenRadial(open, hub, toggle) {
        const radial = getRadial();
        if (!radial) return;

        const nextOpen = Boolean(open);

        if (nextOpen) {
            ensureRadialPortal();
            hub.classList.add('is-open');
            radial.classList.add('is-open');
            toggle.setAttribute('aria-expanded', 'true');
            radial.hidden = false;
            radial.removeAttribute('hidden');
            radial.setAttribute('aria-hidden', 'false');
            return;
        }

        hub.classList.remove('is-open');
        radial.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        radial.hidden = true;
        radial.setAttribute('hidden', '');
        radial.setAttribute('aria-hidden', 'true');
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
        const radial = getRadial();
        if (!hub) return;
        if (hub.contains(event.target)) return;
        if (getMenu()?.contains(event.target)) return;
        if (ENABLE_RADIAL_HUB_MENU && radial?.contains(event.target)) return;
        closeHub();
    }

    function openNationCouncilRoom() {
        global.RoyalArmiesAdventurersGuild?.dismissGuildWorkspacesForSettlementAction?.();

        if (global.document.body?.dataset?.ageCouncilRoomPage === 'true') {
            return;
        }

        if (typeof global.RoyalArmiesPagePaths?.navigateToCouncilRoomPage === 'function') {
            void global.RoyalArmiesPagePaths.navigateToCouncilRoomPage();
            return;
        }

        if (typeof global.RoyalArmiesAgeHeadquarters?.openCouncilRoom === 'function') {
            global.RoyalArmiesAgeHeadquarters.openCouncilRoom();
            return;
        }

        if (typeof global.RoyalArmiesAgeViewTabs?.setActiveView === 'function') {
            global.RoyalArmiesAgeViewTabs.setActiveView('council-room');
        }
    }

    function openRecordsWorkspace() {
        if (typeof global.enableAgeRecords === 'function') {
            global.enableAgeRecords();
        }
        global.RoyalArmiesAgeRecords?.openWorkspace?.();
    }

    function openDiscoveriesWorkspace(event) {
        if (typeof global.openDiscoveriesWorkspace === 'function') {
            global.openDiscoveriesWorkspace(event);
            return;
        }
        if (typeof global.showPortalAlert === 'function') {
            void global.showPortalAlert('Discoveries is unavailable in this session.', 'Discoveries');
        }
    }

    function openBannerWorkspace() {
        if (typeof global.showPortalAlert === 'function') {
            void global.showPortalAlert('Banner management is coming soon.', 'Banner');
            return;
        }
        global.console.info('[RIFT] Banner workspace (coming soon).');
    }

    function openBattlePassWorkspace(event) {
        if (typeof global.openAgeChroniclesBattlePassModal === 'function') {
            global.openAgeChroniclesBattlePassModal(event);
            return;
        }
        if (typeof global.showPortalAlert === 'function') {
            void global.showPortalAlert('Battle Pass is unavailable in this session.', 'Battle Pass');
        }
    }

    function activateHubItem(itemId, event) {
        const normalizedId = String(itemId || '').trim().toLowerCase();

        switch (normalizedId) {
            case 'nation':
                openNationCouncilRoom();
                break;
            case 'records':
                openRecordsWorkspace();
                break;
            case 'discoveries':
                openDiscoveriesWorkspace(event);
                break;
            case 'banner':
                openBannerWorkspace();
                break;
            case 'battle-pass':
                openBattlePassWorkspace(event);
                break;
            default:
                break;
        }
    }

    function onMenuActivate(event) {
        const item = event.target.closest('[data-age-hub-menu]');
        if (!item || !getMenu()?.contains(item)) return;

        event.preventDefault();
        const itemId = item.getAttribute('data-age-hub-menu');
        closeHub();
        activateHubItem(itemId, event);
    }

    function onRadialActivate(event) {
        const slot = event.target.closest('.age-nation-hub-radial-wedge[data-age-hub-radial]');
        if (!slot || !getDial()?.contains(slot)) return;

        event.preventDefault();
        const itemId = slot.getAttribute('data-age-hub-radial');
        closeHub();
        activateHubItem(itemId, event);
    }

    function renderBoxMenu() {
        const colsRoot = getMenuColumns();
        if (!colsRoot || colsRoot.dataset.ageMenuVersion === BOX_BUILD_VERSION) return;

        const leftItems = HUB_ITEMS.slice(0, BOX_MENU_COLUMN_SPLIT);
        const rightItems = HUB_ITEMS.slice(BOX_MENU_COLUMN_SPLIT);

        const renderCol = (items) => (
            '<div class="age-nation-hub-menu-col">'
            + items.map((item) => (
                `<button type="button" class="age-nation-hub-menu-item age-nation-hub-menu-item--${item.id}"`
                + ` data-age-hub-menu="${item.id}" role="menuitem">${item.label}</button>`
            )).join('')
            + '</div>'
        );

        colsRoot.innerHTML = renderCol(leftItems) + renderCol(rightItems);
        colsRoot.dataset.ageMenuVersion = BOX_BUILD_VERSION;

        colsRoot.querySelectorAll('[data-age-hub-menu]').forEach((btn) => {
            btn.addEventListener('click', onMenuActivate);
        });
    }

    function renderRadialSlots() {
        const dial = getDial();
        if (!dial || dial.dataset.ageRadialVersion === RADIAL_BUILD_VERSION) return;

        const trackHtml = (
            '<div class="age-nation-hub-radial-track" aria-hidden="true">'
            + `<img class="age-nation-hub-radial-wheel-plate" src="${RADIAL_MENU_IMAGE}" alt="" decoding="async">`
            + '</div>'
        );

        const slotsHtml = HUB_ITEMS.map((item, index) => {
            const angleDeg = RADIAL_WEDGE_ANGLES_DEG[index] ?? -67.5;
            const delaySec = (0.06 + 0.05 * index).toFixed(3);
            return (
                `<button type="button" class="age-nation-hub-radial-wedge age-nation-hub-radial-wedge--${item.id}"`
                + ` style="--age-radial-wedge-angle: ${angleDeg}deg; --age-radial-wedge-delay: ${delaySec}s;"`
                + ` data-age-hub-radial="${item.id}"`
                + ` data-age-hub-radial-label="${item.label}"`
                + ` role="menuitem"`
                + ` aria-label="${item.label}"></button>`
            );
        }).join('');

        dial.innerHTML = trackHtml + slotsHtml;
        dial.dataset.ageRadialVersion = RADIAL_BUILD_VERSION;
    }

    function bindNationHub() {
        if (bound) return;
        bound = true;

        if (ENABLE_RADIAL_HUB_MENU) {
            ensureRadialPortal();
            renderRadialSlots();
            getRadial()?.querySelector('.age-nation-hub-radial-backdrop')?.addEventListener('click', (event) => {
                event.preventDefault();
                closeHub();
            });
            getDial()?.addEventListener('click', onRadialActivate);
        } else {
            ensureBoxMenuPortal();
            renderBoxMenu();
            bindBoxMenuLayoutSync();
        }

        getToggle()?.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleHub();
        });

        global.document.addEventListener('pointerdown', onDocumentPointerDown, true);

        global.addEventListener('royalarmies:age-war-room-open-change', (event) => {
            if (event.detail?.open) {
                closeHub();
            }
        });
    }

    function enableNationHub() {
        bindNationHub();
        global.enableAgeRecords?.();
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
        isOpen: isHubOpen,
        useRadialMenu: ENABLE_RADIAL_HUB_MENU
    };

    init();
})(window);

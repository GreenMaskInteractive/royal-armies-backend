/**
 * RIFT — Game Hub menu on the Age top bar (box menu active; radial saved for restore).
 */
(function initAgeNationHub(global) {
    'use strict';

    /** Set true to restore full-screen radial menu (go-to design in style-age-nation-hub-radial.css). */
    const ENABLE_RADIAL_HUB_MENU = false;

    const BOX_BUILD_VERSION = 'nation-hub-box-vertical-list-1';

    const BOX_ITEM_META = Object.freeze({
        nation: { glyph: '◆', hint: 'Council & command' },
        records: { glyph: '☰', hint: 'Archives & ledgers' },
        discoveries: { glyph: '✦', hint: 'Relics & mysteries' },
        banner: { glyph: '⚑', hint: 'Heraldry & colors' },
        'battle-pass': { glyph: '◈', hint: 'Chronicles rewards' }
    });
    const RADIAL_MENU_IMAGE = 'images/radialmenu.png?v=radialmenu-accent-3';
    const RADIAL_BUILD_VERSION = 'radialmenu-accent-3';
    const RADIAL_WEDGE_ANGLES_DEG = Object.freeze([-67.5, -22.5, 22.5, 67.5, 112.5]);

    const HUB_ITEMS = Object.freeze([
        { id: 'nation', label: 'Headquarters' },
        { id: 'records', label: 'Records' },
        { id: 'discoveries', label: 'Discoveries' },
        { id: 'banner', label: 'Banner' },
        { id: 'battle-pass', label: 'Battle Pass' }
    ]);

    let bound = false;
    let escapeHandler = null;

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
        if (ENABLE_RADIAL_HUB_MENU) {
            return Boolean(getRadial()?.classList.contains('is-open'));
        }
        const menu = getMenu();
        return Boolean(menu && !menu.hidden && menu.classList.contains('is-open'));
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
        menu.dataset.ageBoxPortaled = 'true';
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
            menu.classList.add('is-open');
            menu.hidden = false;
            menu.removeAttribute('hidden');
            menu.setAttribute('aria-hidden', 'false');
            return;
        }

        menu.classList.remove('is-open');
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

    function hasHeadquartersWorkspaceOnPage() {
        return Boolean(global.document.getElementById('age-council-room-modal'));
    }

    function openNationCouncilRoom() {
        global.RoyalArmiesAdventurersGuild?.dismissGuildWorkspacesForSettlementAction?.();

        if (global.document.body?.dataset?.ageCouncilRoomPage === 'true') {
            return;
        }

        if (hasHeadquartersWorkspaceOnPage()
            && typeof global.RoyalArmiesAgeHeadquarters?.openCouncilRoom === 'function') {
            global.RoyalArmiesAgeHeadquarters.openCouncilRoom();
            return;
        }

        if (typeof global.RoyalArmiesPagePaths?.navigateToHeadquartersPage === 'function') {
            void global.RoyalArmiesPagePaths.navigateToHeadquartersPage();
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

    function getHubItem(itemId) {
        return HUB_ITEMS.find((item) => item.id === itemId);
    }

    function renderBoxMenuItem(item, itemIndex) {
        const meta = BOX_ITEM_META[item.id] || { glyph: '•', hint: '' };
        const delaySec = (0.04 + 0.05 * itemIndex).toFixed(2);
        return (
            `<button type="button" class="age-nation-hub-menu-item age-nation-hub-menu-item--${item.id}"`
            + ` data-age-hub-menu="${item.id}" role="menuitem"`
            + ` style="--age-hub-menu-item-delay: ${delaySec}s;">`
            + `<span class="age-nation-hub-menu-item-glyph" aria-hidden="true">${meta.glyph}</span>`
            + '<span class="age-nation-hub-menu-item-copy">'
            + `<span class="age-nation-hub-menu-item-label">${item.label}</span>`
            + `<span class="age-nation-hub-menu-item-hint">${meta.hint}</span>`
            + '</span>'
            + '<span class="age-nation-hub-menu-item-chevron" aria-hidden="true"></span>'
            + '</button>'
        );
    }

    function renderBoxMenu() {
        const colsRoot = getMenuColumns();
        if (!colsRoot || colsRoot.dataset.ageMenuVersion === BOX_BUILD_VERSION) return;

        colsRoot.innerHTML = HUB_ITEMS.map((item, itemIndex) => (
            renderBoxMenuItem(item, itemIndex)
        )).join('');

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
            getMenu()?.addEventListener('click', (event) => {
                if (!event.target.closest('.age-nation-hub-menu-backdrop, .age-nation-hub-menu-close')) {
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                closeHub();
            });
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

/**
 * RIFT — Game Hub menu on the Age top bar (box menu active; radial saved for restore).
 */
(function initAgeNationHub(global) {
    'use strict';

    /** Set true to restore full-screen radial menu (go-to design in style-age-nation-hub-radial.css). */
    const ENABLE_RADIAL_HUB_MENU = false;

    const BOX_BUILD_VERSION = 'hub-suicide-menu-3';

    const HUB_DISABLED_ITEM_IDS = Object.freeze(['discoveries', 'banner', 'battle-pass']);

    const HUB_SUICIDE_ITEMS = Object.freeze([
        { id: 'secede-rank', label: 'Secede Rank', glyph: '↓', hint: 'Return to rank 1' },
        { id: 'suicide-exile', label: 'Suicide out of Country', glyph: '☠', hint: 'Leave this Age' }
    ]);

    const AGE_SUICIDE_SCRIPT_CHAIN = Object.freeze([
        'rift-error-codes.js?v=update-notice-momentarily-1',
        'rift-error-display.js?v=update-notice-momentarily-1',
        'commander-dossier-sync.js?v=map-ambient-effects-1',
        'script.js?v=settings-suicide-tab-2'
    ]);

    const BOX_ITEM_META = Object.freeze({
        nation: { glyph: '◆', hint: 'Council & command' },
        records: { glyph: '☰', hint: 'Archives & ledgers' },
        discoveries: { glyph: '✦', hint: 'Relics & mysteries' },
        banner: { glyph: '⚑', hint: 'Banner Skill Tree' },
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
            renderBoxMenu(true);
            menu.classList.add('is-open');
            menu.hidden = false;
            menu.removeAttribute('hidden');
            menu.setAttribute('aria-hidden', 'false');
            void ensureSuicideFlowReady();
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

    function openBannerWorkspace(event) {
        if (typeof global.openBannerWorkspace === 'function') {
            global.openBannerWorkspace(event);
            return;
        }
        if (typeof global.showPortalAlert === 'function') {
            void global.showPortalAlert('Banner perks are unavailable in this session.', 'Banner');
        }
    }

    function openBattlePassWorkspace(event) {
        if (typeof global.openAgeChroniclesBattlePassModal === 'function') {
            global.openAgeChroniclesBattlePassModal(event);
            return;
        }
        if (typeof global.showPortalAlert === 'function') {
            void global.showPortalAlert('Battle Pass is unavailable on this page.', 'Battle Pass');
        }
    }

    function activateHubItem(itemId, event) {
        const normalizedId = String(itemId || '').trim().toLowerCase();
        if (isHubItemDisabled(normalizedId)) return;

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
            case 'secede-rank':
                void activateHubSuicideMode('rank', event);
                break;
            case 'suicide-exile':
                void activateHubSuicideMode('exile', event);
                break;
            default:
                break;
        }
    }

    function onMenuActivate(event) {
        const item = event.target.closest('[data-age-hub-menu]');
        if (!item || !getMenu()?.contains(item)) return;
        if (item.disabled || item.classList.contains('is-disabled')) return;

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

    function isHubItemDisabled(itemId) {
        return HUB_DISABLED_ITEM_IDS.includes(String(itemId || '').trim().toLowerCase());
    }

    function getHubItem(itemId) {
        return HUB_ITEMS.find((item) => item.id === itemId)
            || HUB_SUICIDE_ITEMS.find((item) => item.id === itemId);
    }

    let ageSuicideScriptsLoaded = new Set();
    let ageSuicideEnsurePromise = null;

    async function loadAgeSuicideScript(src) {
        if (ageSuicideScriptsLoaded.has(src)) return;

        const existing = global.document.querySelector(`script[src="${src}"]`);
        if (existing) {
            ageSuicideScriptsLoaded.add(src);
            return;
        }

        await new Promise((resolve, reject) => {
            const script = global.document.createElement('script');
            script.src = src;
            script.async = false;
            script.onload = () => {
                ageSuicideScriptsLoaded.add(src);
                resolve();
            };
            script.onerror = () => reject(new Error(`[RIFT] Failed to load ${src}`));
            global.document.head.appendChild(script);
        });
    }

    async function ensureSuicideFlowReady() {
        if (typeof global.triggerCommanderSuicide === 'function') return;

        if (typeof global.ensureAgeCommanderNametagHub === 'function') {
            await global.ensureAgeCommanderNametagHub();
            if (typeof global.triggerCommanderSuicide === 'function') return;
        }

        if (ageSuicideEnsurePromise) {
            await ageSuicideEnsurePromise;
            return;
        }

        ageSuicideEnsurePromise = (async () => {
            for (const src of AGE_SUICIDE_SCRIPT_CHAIN) {
                await loadAgeSuicideScript(src);
            }
        })();

        try {
            await ageSuicideEnsurePromise;
        } catch (err) {
            ageSuicideEnsurePromise = null;
            throw err;
        }
    }

    async function activateHubSuicideMode(mode, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        const normalizedMode = mode === 'rank' ? 'rank' : 'exile';

        try {
            await ensureSuicideFlowReady();
        } catch (err) {
            console.warn('[RIFT] Game Hub suicide scripts failed to load:', err);
            if (typeof global.showPortalAlert === 'function') {
                void global.showPortalAlert('Suicide options are unavailable in this session.', 'Suicide');
            }
            return;
        }

        if (typeof global.triggerCommanderSuicide === 'function') {
            global.triggerCommanderSuicide(normalizedMode);
            return;
        }

        if (typeof global.showPortalAlert === 'function') {
            void global.showPortalAlert('Suicide options are unavailable in this session.', 'Suicide');
        }
    }

    function renderHubSuicideSection(startIndex) {
        const labelDelay = (0.04 + 0.05 * startIndex).toFixed(2);
        const rowsHtml = HUB_SUICIDE_ITEMS.map((item, offset) => (
            renderBoxMenuItem(item, startIndex + 1 + offset, { danger: true })
        )).join('');

        return (
            `<p class="age-nation-hub-menu-suicide-label" style="--age-hub-menu-item-delay: ${labelDelay}s;">Suicide</p>`
            + rowsHtml
        );
    }

    function bindHubMenuButton(btn, itemId) {
        if (!btn || btn.dataset.ageHubMenuBound === 'true') return;
        btn.dataset.ageHubMenuBound = 'true';

        const activate = (event) => {
            if (event.type === 'pointerup' && event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            closeHub();
            activateHubItem(itemId, event);
        };

        btn.addEventListener('pointerup', activate, true);
        btn.addEventListener('click', activate, true);
    }

    function renderBoxMenuItem(item, itemIndex, options = {}) {
        const disabled = isHubItemDisabled(item.id);
        const meta = BOX_ITEM_META[item.id] || {
            glyph: item.glyph || '•',
            hint: item.hint || ''
        };
        const danger = options.danger === true;
        const hint = disabled ? 'Coming soon' : meta.hint;
        const delaySec = (0.04 + 0.05 * itemIndex).toFixed(2);
        return (
            `<button type="button" class="age-nation-hub-menu-item age-nation-hub-menu-item--${item.id}${danger ? ' age-nation-hub-menu-item--danger' : ''}${disabled ? ' is-disabled' : ''}"`
            + ` data-age-hub-menu="${item.id}" role="menuitem"`
            + (danger ? ` data-commander-reset-mode="${item.id === 'secede-rank' ? 'rank' : 'exile'}"` : '')
            + (disabled ? ' disabled aria-disabled="true"' : '')
            + ` style="--age-hub-menu-item-delay: ${delaySec}s;">`
            + `<span class="age-nation-hub-menu-item-glyph" aria-hidden="true">${meta.glyph || item.glyph || '•'}</span>`
            + '<span class="age-nation-hub-menu-item-copy">'
            + `<span class="age-nation-hub-menu-item-label">${item.label}</span>`
            + `<span class="age-nation-hub-menu-item-hint">${hint}</span>`
            + '</span>'
            + '<span class="age-nation-hub-menu-item-chevron" aria-hidden="true"></span>'
            + '</button>'
        );
    }

    function renderBoxMenu(force) {
        const colsRoot = getMenuColumns();
        if (!colsRoot) return;
        if (!force && colsRoot.dataset.ageMenuVersion === BOX_BUILD_VERSION) return;

        colsRoot.innerHTML = HUB_ITEMS.map((item, itemIndex) => (
            renderBoxMenuItem(item, itemIndex)
        )).join('') + renderHubSuicideSection(HUB_ITEMS.length);

        colsRoot.dataset.ageMenuVersion = BOX_BUILD_VERSION;

        colsRoot.querySelectorAll('[data-age-hub-menu]').forEach((btn) => {
            if (btn.disabled || btn.classList.contains('is-disabled')) return;
            bindHubMenuButton(btn, btn.getAttribute('data-age-hub-menu'));
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
            const menu = getMenu();
            if (menu && menu.dataset.ageMenuClickBound !== 'true') {
                menu.dataset.ageMenuClickBound = 'true';
                const onBoxMenuPointer = (event) => {
                    if (event.button !== 0) return;
                    const item = event.target.closest('[data-age-hub-menu]');
                    if (item && !item.disabled && !item.classList.contains('is-disabled')) {
                        onMenuActivate(event);
                        return;
                    }
                    if (!event.target.closest('.age-nation-hub-menu-backdrop, .age-nation-hub-menu-close')) {
                        return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    closeHub();
                };
                menu.addEventListener('pointerup', onBoxMenuPointer, true);
                menu.addEventListener('click', onBoxMenuPointer, true);
            }
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

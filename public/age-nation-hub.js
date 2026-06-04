/**
 * RIFT — Nation Hub radial menu on the Age top bar.
 */
(function initAgeNationHub(global) {
    'use strict';

    const DEFAULT_CENTER_LABEL = 'MENU';
    const SLOT_COUNT = 5;
    const SLOT_START_ANGLE_DEG = -90;

    const RADIAL_ITEMS = Object.freeze([
        { id: 'nation', label: 'Nation' },
        { id: 'records', label: 'Records' },
        { id: 'discoveries', label: 'Discoveries' },
        { id: 'banner', label: 'Banner' },
        { id: 'battle-pass', label: 'Battle Pass' }
    ]);

    let bound = false;
    let escapeHandler = null;
    let layoutHandler = null;

    function getHub() {
        return global.document.getElementById('age-nation-hub');
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

    function getCenterLabelEl() {
        return global.document.getElementById('age-nation-hub-radial-label');
    }

    function isHubOpen() {
        return Boolean(getHub()?.classList.contains('is-open'));
    }

    function setCenterLabel(text) {
        const el = getCenterLabelEl();
        if (!el) return;
        el.textContent = String(text || DEFAULT_CENTER_LABEL).trim() || DEFAULT_CENTER_LABEL;
    }

    function ensureRadialPortal() {
        const radial = getRadial();
        if (!radial || radial.dataset.ageRadialPortaled === 'true') return;
        global.document.body.appendChild(radial);
        radial.dataset.ageRadialPortaled = 'true';
    }

    function setHubOpen(open) {
        const hub = getHub();
        const radial = getRadial();
        const toggle = getToggle();
        if (!hub || !radial || !toggle) return;

        const nextOpen = Boolean(open);

        if (nextOpen) {
            ensureRadialPortal();
            syncRadialAnchorPosition();
            ensureRadialPositionWatch();
            hub.classList.add('is-open');
            radial.classList.add('is-open');
            toggle.setAttribute('aria-expanded', 'true');
            radial.hidden = false;
            radial.removeAttribute('hidden');
            radial.setAttribute('aria-hidden', 'false');
            setCenterLabel(DEFAULT_CENTER_LABEL);

            if (!escapeHandler) {
                escapeHandler = (event) => {
                    if (event.key === 'Escape') {
                        setHubOpen(false);
                    }
                };
                global.document.addEventListener('keydown', escapeHandler);
            }
            global.requestAnimationFrame(syncRadialAnchorPosition);
            return;
        }

        hub.classList.remove('is-open');
        radial.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        radial.hidden = true;
        radial.setAttribute('hidden', '');
        radial.setAttribute('aria-hidden', 'true');
        setCenterLabel(DEFAULT_CENTER_LABEL);
        clearRadialPositionWatch();

        if (escapeHandler) {
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
        const radial = getRadial();
        if (!hub) return;
        if (hub.contains(event.target) || radial?.contains(event.target)) return;
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

    function activateRadialItem(itemId, event) {
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

    function onRadialSlotPointerEnter(event) {
        const slot = event.currentTarget;
        if (!slot) return;
        setCenterLabel(slot.getAttribute('data-age-hub-radial-label') || DEFAULT_CENTER_LABEL);
    }

    function onRadialSlotPointerLeave() {
        if (!isHubOpen()) return;
        setCenterLabel(DEFAULT_CENTER_LABEL);
    }

    function onRadialActivate(event) {
        const slot = event.target.closest('[data-age-hub-radial]');
        if (!slot || !getDial()?.contains(slot)) return;

        event.preventDefault();
        const itemId = slot.getAttribute('data-age-hub-radial');
        closeHub();
        activateRadialItem(itemId, event);
    }

    function buildPlaceholderSvgDataUri(label, index) {
        const hue = 38 + index * 14;
        const safeLabel = String(label || 'Slot').slice(0, 12);
        const svg = (
            `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">`
            + `<rect width="64" height="64" rx="10" fill="hsl(${hue} 28% 18%)"/>`
            + `<rect x="6" y="6" width="52" height="52" rx="8" fill="none" stroke="hsl(${hue} 55% 52%)" stroke-width="2" stroke-dasharray="5 4"/>`
            + `<text x="32" y="36" text-anchor="middle" font-family="Cinzel,serif" font-size="9" fill="hsl(${hue} 40% 78%)">${safeLabel}</text>`
            + '</svg>'
        );
        return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }

    function renderRadialSlots() {
        const dial = getDial();
        if (!dial || dial.dataset.ageRadialBuilt === 'true') return;

        const centerHtml = (
            '<div class="age-nation-hub-radial-center" aria-live="polite">'
            + `<span id="age-nation-hub-radial-label" class="age-nation-hub-radial-center-label">${DEFAULT_CENTER_LABEL}</span>`
            + '</div>'
        );

        const stepDeg = 360 / SLOT_COUNT;
        const slotsHtml = RADIAL_ITEMS.map((item, index) => {
            const angleDeg = SLOT_START_ANGLE_DEG + stepDeg * index;
            const placeholderSrc = buildPlaceholderSvgDataUri(item.label, index);
            const delaySec = (0.03 * index).toFixed(2);
            return (
                `<button type="button" class="age-nation-hub-radial-slot age-nation-hub-radial-slot--${item.id}"`
                + ` data-age-hub-radial="${item.id}"`
                + ` data-age-hub-radial-label="${item.label}"`
                + ` style="--age-radial-slot-angle: ${angleDeg}deg; transition-delay: ${delaySec}s;"`
                + ` role="menuitem"`
                + ` aria-label="${item.label}">`
                + '<span class="age-nation-hub-radial-slot-frame">'
                + `<img class="age-nation-hub-radial-slot-img" src="${placeholderSrc}" alt="" decoding="async">`
                + '</span>'
                + '</button>'
            );
        }).join('');

        dial.innerHTML = centerHtml + slotsHtml;
        dial.dataset.ageRadialBuilt = 'true';

        dial.querySelectorAll('[data-age-hub-radial]').forEach((slot) => {
            slot.addEventListener('pointerenter', onRadialSlotPointerEnter);
            slot.addEventListener('pointerleave', onRadialSlotPointerLeave);
            slot.addEventListener('focus', onRadialSlotPointerEnter);
            slot.addEventListener('blur', onRadialSlotPointerLeave);
        });
    }

    function bindNationHub() {
        if (bound) return;
        bound = true;

        ensureRadialPortal();
        renderRadialSlots();

        getToggle()?.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleHub();
        });

        getRadial()?.querySelector('.age-nation-hub-radial-backdrop')?.addEventListener('click', (event) => {
            event.preventDefault();
            closeHub();
        });

        getDial()?.addEventListener('click', onRadialActivate);

        global.document.addEventListener('pointerdown', onDocumentPointerDown, true);

        global.addEventListener('royalarmies:age-war-room-open-change', (event) => {
            if (event.detail?.open) {
                closeHub();
            }
        });
    }

    function enableNationHub() {
        bindNationHub();
        syncRadialAnchorPosition();
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
        isOpen: isHubOpen
    };

    init();
})(window);

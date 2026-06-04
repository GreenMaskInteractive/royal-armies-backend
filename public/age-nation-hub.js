/**
 * RIFT — Nation Hub radial menu on the Age top bar.
 */
(function initAgeNationHub(global) {
    'use strict';

    const DEFAULT_CENTER_LABEL = 'MENU';
    const RADIAL_BUILD_VERSION = 'premium-1';
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
            return;
        }

        hub.classList.remove('is-open');
        radial.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        radial.hidden = true;
        radial.setAttribute('hidden', '');
        radial.setAttribute('aria-hidden', 'true');
        setCenterLabel(DEFAULT_CENTER_LABEL);

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

    const RADIAL_SLOT_ICONS = Object.freeze({
        nation: '<path d="M32 14l14 8v16l-14 8-14-8V22z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="32" cy="32" r="5" fill="currentColor" opacity="0.85"/>',
        records: '<path d="M22 18h20v28H22z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M26 24h12M26 30h12M26 36h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
        discoveries: '<path d="M32 16l4 10h10l-8 6 3 10-9-7-9 7 3-10-8-6h10z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
        banner: '<path d="M20 20h8v24h-8zM36 20v24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M28 20c8 0 12 4 12 12s-4 12-12 12" fill="none" stroke="currentColor" stroke-width="2"/>',
        'battle-pass': '<path d="M18 40c6-10 22-10 28 0" fill="none" stroke="currentColor" stroke-width="2"/><path d="M24 26h16v8H24z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M28 22h8v4h-8z" fill="currentColor" opacity="0.7"/>'
    });

    function buildPlaceholderSvgDataUri(itemId, label, index) {
        const hue = 38 + index * 16;
        const glyph = RADIAL_SLOT_ICONS[itemId] || '';
        const safeLabel = String(label || 'Slot').slice(0, 14);
        const svg = (
            `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 64 64">`
            + `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">`
            + `<stop offset="0%" stop-color="hsl(${hue} 32% 24%)"/>`
            + `<stop offset="100%" stop-color="hsl(${hue} 22% 10%)"/>`
            + `</linearGradient></defs>`
            + `<rect width="64" height="64" rx="12" fill="url(#bg)"/>`
            + `<rect x="5" y="5" width="54" height="54" rx="10" fill="none" stroke="hsl(${hue} 62% 58%)" stroke-width="1.5" opacity="0.55"/>`
            + `<g color="hsl(${hue} 55% 78%)" transform="translate(0 2)">${glyph}</g>`
            + `<text x="32" y="54" text-anchor="middle" font-family="Cinzel,serif" font-size="7" letter-spacing="0.08em" fill="hsl(${hue} 35% 82%)" opacity="0.92">${safeLabel}</text>`
            + '</svg>'
        );
        return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }

    function renderRadialSlots() {
        const dial = getDial();
        if (!dial || dial.dataset.ageRadialVersion === RADIAL_BUILD_VERSION) return;

        const trackHtml = (
            '<div class="age-nation-hub-radial-track" aria-hidden="true">'
            + '<div class="age-nation-hub-radial-track-aura"></div>'
            + '<div class="age-nation-hub-radial-track-ring"></div>'
            + '<div class="age-nation-hub-radial-track-ticks"></div>'
            + '</div>'
        );

        const centerHtml = (
            '<div class="age-nation-hub-radial-center" aria-live="polite">'
            + '<div class="age-nation-hub-radial-center-halo" aria-hidden="true"></div>'
            + '<div class="age-nation-hub-radial-center-ring" aria-hidden="true"></div>'
            + `<span id="age-nation-hub-radial-label" class="age-nation-hub-radial-center-label">${DEFAULT_CENTER_LABEL}</span>`
            + '</div>'
        );

        const stepDeg = 360 / SLOT_COUNT;
        const slotsHtml = RADIAL_ITEMS.map((item, index) => {
            const angleDeg = SLOT_START_ANGLE_DEG + stepDeg * index;
            const placeholderSrc = buildPlaceholderSvgDataUri(item.id, item.label, index);
            const delaySec = (0.07 + 0.055 * index).toFixed(3);
            return (
                `<div class="age-nation-hub-radial-slot-well age-nation-hub-radial-slot-well--${item.id}"`
                + ` style="--age-radial-slot-angle: ${angleDeg}deg; --age-radial-slot-delay: ${delaySec}s; --age-radial-slot-index: ${index};" aria-hidden="true">`
                + `<button type="button" class="age-nation-hub-radial-slot age-nation-hub-radial-slot--${item.id}"`
                + ` data-age-hub-radial="${item.id}"`
                + ` data-age-hub-radial-label="${item.label}"`
                + ` role="menuitem"`
                + ` aria-label="${item.label}">`
                + '<span class="age-nation-hub-radial-slot-frame">'
                + `<img class="age-nation-hub-radial-slot-img" src="${placeholderSrc}" alt="" decoding="async">`
                + '</span>'
                + '</button>'
                + '</div>'
            );
        }).join('');

        dial.innerHTML = trackHtml + slotsHtml + centerHtml;
        dial.dataset.ageRadialVersion = RADIAL_BUILD_VERSION;

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

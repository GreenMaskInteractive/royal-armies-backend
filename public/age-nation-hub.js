/**
 * RIFT — Nation Hub radial menu on the Age top bar.
 */
(function initAgeNationHub(global) {
    'use strict';

    const DEFAULT_CENTER_LABEL = 'MENU';
    const RADIAL_BUILD_VERSION = 'rpg-wheel-10';
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

    function setCenterLabel(_text) {
        /* Center label hidden — slots use aria-label only */
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

    function polarPoint(cx, cy, radius, angleDeg) {
        const rad = ((angleDeg - 90) * Math.PI) / 180;
        return {
            x: cx + radius * Math.cos(rad),
            y: cy + radius * Math.sin(rad)
        };
    }

    function buildWedgePath(cx, cy, innerR, outerR, startDeg, endDeg) {
        const startOuter = polarPoint(cx, cy, outerR, startDeg);
        const endOuter = polarPoint(cx, cy, outerR, endDeg);
        const endInner = polarPoint(cx, cy, innerR, endDeg);
        const startInner = polarPoint(cx, cy, innerR, startDeg);
        const largeArc = endDeg - startDeg > 180 ? 1 : 0;
        return [
            `M ${startInner.x.toFixed(1)} ${startInner.y.toFixed(1)}`,
            `L ${startOuter.x.toFixed(1)} ${startOuter.y.toFixed(1)}`,
            `A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x.toFixed(1)} ${endOuter.y.toFixed(1)}`,
            `L ${endInner.x.toFixed(1)} ${endInner.y.toFixed(1)}`,
            `A ${innerR} ${innerR} 0 ${largeArc} 0 ${startInner.x.toFixed(1)} ${startInner.y.toFixed(1)}`,
            'Z'
        ].join(' ');
    }

    function buildOrnateWheelSvg() {
        const cx = 260;
        const cy = 260;
        const step = 360 / SLOT_COUNT;
        const wedgeDefs = [];
        const wedgePaths = [];
        RADIAL_ITEMS.forEach((item, index) => {
            const start = SLOT_START_ANGLE_DEG + step * index + 1.2;
            const end = SLOT_START_ANGLE_DEG + step * (index + 1) - 1.2;
            const fillA = index % 2 === 0 ? '#2a2218' : '#1e1812';
            const fillB = index % 2 === 0 ? '#342a1e' : '#261f16';
            const path = buildWedgePath(cx, cy, 92, 228, start, end);
            const mid = (start + end) / 2;
            const rune = polarPoint(cx, cy, 178, mid);
            wedgeDefs.push(
                `<linearGradient id="wedge-${index}" x1="0" y1="0" x2="1" y2="1">`
                + `<stop offset="0%" stop-color="${fillB}"/><stop offset="100%" stop-color="${fillA}"/>`
                + '</linearGradient>'
            );
            wedgePaths.push(
                `<path d="${path}" fill="url(#wedge-${index})" stroke="#5c4a28" stroke-width="1.2"/>`
                + `<path d="${path}" fill="none" stroke="rgba(255,215,128,0.18)" stroke-width="0.8"/>`
                + `<circle cx="${rune.x.toFixed(1)}" cy="${rune.y.toFixed(1)}" r="4" fill="#c9a227" opacity="0.7"/>`
                + `<circle cx="${rune.x.toFixed(1)}" cy="${rune.y.toFixed(1)}" r="6" fill="none" stroke="rgba(255,215,128,0.25)" stroke-width="1"/>`
            );
        });

        const svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" width="520" height="520">'
            + '<defs>'
            + '<radialGradient id="wheel-bg" cx="50%" cy="42%" r="58%">'
            + '<stop offset="0%" stop-color="#3d3224"/><stop offset="55%" stop-color="#16120c"/><stop offset="100%" stop-color="#080604"/>'
            + '</radialGradient>'
            + '<linearGradient id="gold-ring" x1="0" y1="0" x2="0" y2="1">'
            + '<stop offset="0%" stop-color="#ffe9a8"/><stop offset="45%" stop-color="#c9a227"/><stop offset="100%" stop-color="#6b4e18"/>'
            + '</linearGradient>'
            + '<filter id="wheel-shadow"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.65"/></filter>'
            + wedgeDefs.join('')
            + '</defs>'
            + '<circle cx="260" cy="260" r="250" fill="url(#wheel-bg)" filter="url(#wheel-shadow)"/>'
            + wedgePaths.join('')
            + '<circle cx="260" cy="260" r="228" fill="none" stroke="url(#gold-ring)" stroke-width="5" opacity="0.95"/>'
            + '<circle cx="260" cy="260" r="218" fill="none" stroke="#3d3018" stroke-width="2"/>'
            + '<circle cx="260" cy="260" r="92" fill="#120e0a" stroke="url(#gold-ring)" stroke-width="3"/>'
            + '<circle cx="260" cy="260" r="84" fill="none" stroke="rgba(255,215,128,0.2)" stroke-width="1" stroke-dasharray="4 6"/>'
            + '</svg>'
        );
        return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }

    function buildPlaceholderSvgDataUri(itemId, label, index) {
        const hue = 38 + index * 16;
        const svg = (
            `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="80" viewBox="0 0 72 64">`
            + `<defs>`
            + `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">`
            + `<stop offset="0%" stop-color="hsl(${hue} 28% 32%)"/>`
            + `<stop offset="100%" stop-color="hsl(${hue} 22% 12%)"/>`
            + `</linearGradient>`
            + `<linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">`
            + `<stop offset="0%" stop-color="#ffe9a8"/><stop offset="100%" stop-color="#8a6d2e"/>`
            + `</linearGradient>`
            + `</defs>`
            + `<path d="M36 10 L56 21 V43 L36 54 L16 43 V21 Z" fill="url(#bg)" stroke="url(#rim)" stroke-width="2"/>`
            + `<path d="M36 16 L51 24 V40 L36 48 L21 40 V24 Z" fill="none" stroke="hsl(${hue} 50% 55%)" stroke-width="1" opacity="0.5"/>`
            + '</svg>'
        );
        return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }

    function renderRadialSlots() {
        const dial = getDial();
        if (!dial || dial.dataset.ageRadialVersion === RADIAL_BUILD_VERSION) return;

        const wheelSrc = buildOrnateWheelSvg();
        const trackHtml = (
            '<div class="age-nation-hub-radial-track" aria-hidden="true">'
            + `<img class="age-nation-hub-radial-wheel-plate" src="${wheelSrc}" alt="" decoding="async">`
            + '<div class="age-nation-hub-radial-wheel-rim" aria-hidden="true"></div>'
            + '</div>'
        );

        const centerHtml = (
            '<div class="age-nation-hub-radial-center" aria-hidden="true">'
            + '<div class="age-nation-hub-radial-center-plate" aria-hidden="true"></div>'
            + '<div class="age-nation-hub-radial-center-octagon" aria-hidden="true"></div>'
            + '<div class="age-nation-hub-radial-center-core" aria-hidden="true"></div>'
            + '</div>'
        );

        const stepDeg = 360 / SLOT_COUNT;
        const slotsHtml = RADIAL_ITEMS.map((item, index) => {
            const angleDeg = SLOT_START_ANGLE_DEG + stepDeg * index;
            const placeholderSrc = buildPlaceholderSvgDataUri(item.id, item.label, index);
            const delaySec = (0.07 + 0.055 * index).toFixed(3);
            return (
                `<div class="age-nation-hub-radial-slot-well age-nation-hub-radial-slot-well--${item.id}"`
                + ` style="--age-radial-slot-angle: ${angleDeg}deg; --age-radial-slot-delay: ${delaySec}s; --age-radial-slot-index: ${index};">`
                + `<button type="button" class="age-nation-hub-radial-slot age-nation-hub-radial-slot--${item.id}"`
                + ` data-age-hub-radial="${item.id}"`
                + ` data-age-hub-radial-label="${item.label}"`
                + ` role="menuitem"`
                + ` aria-label="${item.label}">`
                + '<span class="age-nation-hub-radial-slot-frame">'
                + `<img class="age-nation-hub-radial-slot-img" src="${placeholderSrc}" alt="" decoding="async">`
                + '</span>'
                + '</button>'
                + `<span class="age-nation-hub-radial-slot-caption">${item.label}</span>`
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

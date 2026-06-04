/**
 * RIFT — Nation Hub radial menu on the Age top bar.
 */
(function initAgeNationHub(global) {
    'use strict';

    const DEFAULT_CENTER_LABEL = 'MENU';
    const RADIAL_BUILD_VERSION = 'steampunk-wheel-1';
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
        const slot = event.target.closest('.age-nation-hub-radial-wedge[data-age-hub-radial]');
        if (!slot || !getDial()?.contains(slot)) return;

        event.preventDefault();
        const itemId = slot.getAttribute('data-age-hub-radial');
        closeHub();
        activateRadialItem(itemId, event);
    }

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

    function buildSteampunkWheelSvg() {
        const cx = 260;
        const cy = 260;
        const innerR = 100;
        const outerR = 234;
        const step = 360 / SLOT_COUNT;
        const wedgeDefs = [];
        const wedgePaths = [];
        const dividers = [];

        RADIAL_ITEMS.forEach((item, index) => {
            const start = SLOT_START_ANGLE_DEG + step * index + 0.8;
            const end = SLOT_START_ANGLE_DEG + step * (index + 1) - 0.8;
            const fillTop = index % 2 === 0 ? '#3d3428' : '#2e2720';
            const fillBot = index % 2 === 0 ? '#252018' : '#1a1612';
            const path = buildWedgePath(cx, cy, innerR, outerR, start, end);
            wedgeDefs.push(
                `<linearGradient id="wedge-${index}" x1="0" y1="0" x2="0.6" y2="1">`
                + `<stop offset="0%" stop-color="${fillTop}"/>`
                + `<stop offset="100%" stop-color="${fillBot}"/>`
                + '</linearGradient>'
            );
            wedgePaths.push(
                `<path d="${path}" fill="url(#wedge-${index})"/>`
                + `<path d="${path}" fill="none" stroke="rgba(77, 232, 212, 0.22)" stroke-width="1.2"/>`
            );
        });

        for (let i = 0; i < SLOT_COUNT; i += 1) {
            const edge = SLOT_START_ANGLE_DEG + step * i;
            const p1 = polarPoint(cx, cy, innerR - 4, edge);
            const p2 = polarPoint(cx, cy, outerR + 2, edge);
            dividers.push(
                `<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}"`
                + ` stroke="rgba(61, 217, 196, 0.55)" stroke-width="2.5" stroke-linecap="round"/>`
            );
        }

        const outerNodes = [0, 90, 180, 270].map((deg) => {
            const p = polarPoint(cx, cy, 246, deg);
            return (
                `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="11" fill="#2a2318" stroke="#5a4a32" stroke-width="2"/>`
                + `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="7" fill="none" stroke="rgba(61, 217, 196, 0.35)" stroke-width="1"/>`
            );
        }).join('');

        const svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" width="520" height="520">'
            + '<defs>'
            + '<radialGradient id="wheel-bg" cx="50%" cy="48%" r="55%">'
            + '<stop offset="0%" stop-color="#2a241c"/>'
            + '<stop offset="70%" stop-color="#12100c"/>'
            + '<stop offset="100%" stop-color="#060504"/>'
            + '</radialGradient>'
            + '<linearGradient id="bronze-rim" x1="0" y1="0" x2="0" y2="1">'
            + '<stop offset="0%" stop-color="#6b5a42"/>'
            + '<stop offset="50%" stop-color="#3d3428"/>'
            + '<stop offset="100%" stop-color="#1e1a14"/>'
            + '</linearGradient>'
            + '<filter id="cyan-glow" x="-20%" y="-20%" width="140%" height="140%">'
            + '<feGaussianBlur stdDeviation="2.5" result="blur"/>'
            + '<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>'
            + '</filter>'
            + '<filter id="wheel-shadow"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity="0.7"/></filter>'
            + wedgeDefs.join('')
            + '</defs>'
            + '<circle cx="260" cy="260" r="252" fill="#0a0908" filter="url(#wheel-shadow)"/>'
            + '<circle cx="260" cy="260" r="252" fill="none" stroke="url(#bronze-rim)" stroke-width="14"/>'
            + '<circle cx="260" cy="260" r="245" fill="none" stroke="#1a1612" stroke-width="2"/>'
            + outerNodes
            + '<circle cx="260" cy="260" r="238" fill="url(#wheel-bg)"/>'
            + wedgePaths.join('')
            + dividers.join('')
            + '<circle cx="260" cy="260" r="232" fill="none" stroke="rgba(61, 217, 196, 0.28)" stroke-width="2"/>'
            + '<circle cx="260" cy="260" r="108" fill="none" stroke="rgba(61, 217, 196, 0.45)" stroke-width="2.5" filter="url(#cyan-glow)"/>'
            + '<circle cx="260" cy="260" r="100" fill="#0c0a08" stroke="rgba(77, 232, 212, 0.35)" stroke-width="2"/>'
            + '</svg>'
        );
        return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }

    function buildSteampunkCenterSvg() {
        const svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">'
            + '<defs>'
            + '<radialGradient id="core-glow" cx="50%" cy="50%" r="50%">'
            + '<stop offset="0%" stop-color="rgba(61, 217, 196, 0.35)"/>'
            + '<stop offset="100%" stop-color="rgba(8, 12, 14, 0.95)"/>'
            + '</radialGradient>'
            + '<linearGradient id="frame-bronze" x1="0" y1="0" x2="1" y2="1">'
            + '<stop offset="0%" stop-color="#7a6548"/>'
            + '<stop offset="100%" stop-color="#2e261c"/>'
            + '</linearGradient>'
            + '</defs>'
            + '<path d="M100 28 L148 52 L148 108 L100 172 L52 108 L52 52 Z" fill="url(#frame-bronze)" stroke="#5a4a32" stroke-width="3"/>'
            + '<path d="M100 40 L136 58 L136 102 L100 156 L64 102 L64 58 Z" fill="url(#core-glow)" stroke="rgba(61, 217, 196, 0.5)" stroke-width="2"/>'
            + '<circle cx="100" cy="98" r="28" fill="none" stroke="rgba(77, 232, 212, 0.5)" stroke-width="2"/>'
            + '<circle cx="100" cy="98" r="18" fill="none" stroke="rgba(77, 232, 212, 0.35)" stroke-width="1.5"/>'
            + '<g stroke="rgba(77, 232, 212, 0.55)" stroke-width="2" fill="none" stroke-linecap="round">'
            + '<circle cx="100" cy="98" r="10"/>'
            + '<path d="M100 88 L100 78 M100 108 L100 118 M90 98 L80 98 M110 98 L120 98"/>'
            + '<path d="M94 92 L88 86 M106 92 L112 86 M106 104 L112 110 M94 104 L88 110"/>'
            + '</g>'
            + '<circle cx="100" cy="98" r="4" fill="rgba(77, 232, 212, 0.8)"/>'
            + '</svg>'
        );
        return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }

    function renderRadialSlots() {
        const dial = getDial();
        if (!dial || dial.dataset.ageRadialVersion === RADIAL_BUILD_VERSION) return;

        const wheelSrc = buildSteampunkWheelSvg();
        const centerSrc = buildSteampunkCenterSvg();
        const trackHtml = (
            '<div class="age-nation-hub-radial-track" aria-hidden="true">'
            + `<img class="age-nation-hub-radial-wheel-plate" src="${wheelSrc}" alt="" decoding="async">`
            + '</div>'
        );

        const centerHtml = (
            '<div class="age-nation-hub-radial-center" aria-hidden="true">'
            + `<img class="age-nation-hub-radial-center-art" src="${centerSrc}" alt="" decoding="async">`
            + '</div>'
        );

        const stepDeg = 360 / SLOT_COUNT;
        const slotsHtml = RADIAL_ITEMS.map((item, index) => {
            const angleDeg = SLOT_START_ANGLE_DEG + stepDeg * index + stepDeg / 2;
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

        dial.innerHTML = trackHtml + slotsHtml + centerHtml;
        dial.dataset.ageRadialVersion = RADIAL_BUILD_VERSION;

        dial.querySelectorAll('.age-nation-hub-radial-wedge[data-age-hub-radial]').forEach((slot) => {
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

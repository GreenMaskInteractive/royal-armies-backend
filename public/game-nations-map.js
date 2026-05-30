/**
 * RIFT — Nation picker: list panel drives map highlights; confirm advances onboarding.
 */
(function initGameNationsMap(global) {
    'use strict';

    const ONBOARDING_ALLOWED_NATION_IDS = Object.freeze(['aesthene']);
    const ONBOARDING_DEFAULT_REGION_ID = 'region-3';

    const NATION_PATHS_URL = 'data/game-nation-paths.json?v=game-nation-paths-3';

    let nationsCatalog = [];
    let nationById = {};

    let activeNationId = null;
    let selectedNationId = null;
    let pathsReady = false;

    function isOnboardingNationAllowed(nationId) {
        const id = String(nationId || '').trim().toLowerCase();
        return ONBOARDING_ALLOWED_NATION_IDS.includes(id);
    }

    function filterOnboardingNations(nations) {
        return (Array.isArray(nations) ? nations : []).filter((nation) => (
            isOnboardingNationAllowed(nation.id)
        ));
    }

    function getListPanel() {
        return global.document.getElementById('game-nation-list-panel');
    }

    function getListRoot() {
        return global.document.getElementById('game-nation-list');
    }

    function getMapRoot() {
        return global.document.getElementById('game-nation-map');
    }

    function getVisualLayer() {
        return global.document.getElementById('game-nation-map-visual');
    }

    function getMapCluster() {
        return global.document.querySelector('.game-nation-map-cluster');
    }

    function getConfirmButton() {
        return global.document.getElementById('game-nation-confirm-btn');
    }

    function isNationViewActive() {
        const nationView = global.document.querySelector('.game-page-view--nation');
        return Boolean(nationView && !nationView.hidden && nationView.classList.contains('is-active'));
    }

    function measureClusterCssPx(cluster, customProperty, fallback) {
        if (!cluster) return fallback;
        const raw = global.getComputedStyle(cluster).getPropertyValue(customProperty).trim();
        if (!raw) return fallback;
        const probe = global.document.createElement('div');
        probe.style.width = raw;
        probe.style.position = 'absolute';
        probe.style.visibility = 'hidden';
        global.document.body.appendChild(probe);
        const width = probe.getBoundingClientRect().width;
        probe.remove();
        return width || fallback;
    }

    function readClusterSignedPx(cluster, customProperty, fallback) {
        if (!cluster) return fallback;
        const raw = global.getComputedStyle(cluster).getPropertyValue(customProperty).trim();
        if (!raw) return fallback;
        const parsed = parseFloat(raw);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function syncNationFlankLayout() {
        const cluster = getMapCluster();
        const mapRoot = getMapRoot();
        if (!cluster || !mapRoot) return;

        const listPanel = getListPanel();
        const frame = mapRoot.querySelector('.game-nation-map-frame');
        if (!frame) return;

        const frameRect = frame.getBoundingClientRect();
        const listMapGapPx = measureClusterCssPx(cluster, '--game-nation-list-map-gap', 12);
        const listOffsetPx = readClusterSignedPx(cluster, '--game-nation-list-offset-x', -30);

        if (listPanel) {
            listPanel.style.setProperty('--game-nation-flank-max-height', `${Math.round(frameRect.height)}px`, 'important');
        }

        const clusterWidth = frameRect.width + listMapGapPx + (listPanel ? listPanel.getBoundingClientRect().width : 0);
        const viewportWidth = global.innerWidth || frameRect.width;
        const centerOffset = (viewportWidth - clusterWidth) / 2 - frameRect.left;
        cluster.style.transform = `translateX(${Math.round(centerOffset + listOffsetPx)}px)`;
    }

    function scheduleNationFlankLayout() {
        if (!isNationViewActive()) return;
        global.requestAnimationFrame(syncNationFlankLayout);
    }

    function bindNationLayoutSync() {
        if (global.__riftGameNationLayoutBound) return;
        global.__riftGameNationLayoutBound = true;
        global.addEventListener('resize', scheduleNationFlankLayout);
        global.addEventListener('orientationchange', scheduleNationFlankLayout);
    }

    function getNationMeta(nationId) {
        return nationById[nationId] || null;
    }

    function applyNationsCatalog(records) {
        nationsCatalog = filterOnboardingNations(records.map((record) => ({
            id: record.id,
            name: record.name,
            accent: record.accent || '#9a8a6a',
            kind: record.kind || 'minor',
            mapId: record.mapId || ''
        })));
        nationById = Object.fromEntries(nationsCatalog.map((nation) => [nation.id, nation]));
        buildNationList();
    }

    function getVisualPathsForNation(nationId) {
        const layer = getVisualLayer();
        if (!layer || !nationId) return [];
        return Array.from(layer.querySelectorAll(`path[data-nation-id="${CSS.escape(nationId)}"]`));
    }

    function withoutMapPathTransition(pathEls, fn) {
        if (!pathEls.length) {
            fn();
            return;
        }
        pathEls.forEach((pathEl) => {
            pathEl.style.setProperty('transition', 'none');
        });
        fn();
        void pathEls[0].getBoundingClientRect();
        pathEls.forEach((pathEl) => {
            pathEl.style.removeProperty('transition');
        });
    }

    function setNationMapHighlight(nationId, isActive) {
        getVisualPathsForNation(nationId).forEach((pathEl) => {
            pathEl.classList.toggle('is-hovered', isActive);
        });
    }

    function setNationMapSelected(nationId, isSelected) {
        getVisualPathsForNation(nationId).forEach((pathEl) => {
            pathEl.classList.toggle('is-selected', isSelected);
        });
    }

    function clearAllMapNationStates() {
        const layer = getVisualLayer();
        if (!layer) return;
        const activePaths = Array.from(layer.querySelectorAll('path.is-hovered, path.is-selected'));
        if (!activePaths.length) return;
        withoutMapPathTransition(activePaths, () => {
            activePaths.forEach((pathEl) => {
                pathEl.classList.remove('is-hovered', 'is-selected');
            });
        });
    }

    function updateListButtonStates() {
        getListButtons().forEach((btn) => {
            const nationId = btn.getAttribute('data-nation-id');
            const isSelected = Boolean(selectedNationId && nationId === selectedNationId);
            const isHovered = Boolean(activeNationId && nationId === activeNationId && !isSelected);
            btn.classList.toggle('is-selected', isSelected);
            btn.classList.toggle('is-hovered', isHovered);
            btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        });
    }

    function updateConfirmButtonVisibility() {
        const confirmBtn = getConfirmButton();
        if (!confirmBtn) return;
        const show = Boolean(selectedNationId);
        confirmBtn.hidden = !show;
        confirmBtn.disabled = !show;
        confirmBtn.setAttribute('aria-disabled', show ? 'false' : 'true');
    }

    function applyActiveNation(nationId) {
        if (activeNationId && activeNationId !== selectedNationId) {
            setNationMapHighlight(activeNationId, false);
        }
        activeNationId = nationId || null;
        if (activeNationId && activeNationId !== selectedNationId) {
            setNationMapHighlight(activeNationId, true);
        }
        updateListButtonStates();
    }

    function applySelectedNation(nationId) {
        const nextNationId = nationId || null;
        if (nextNationId && !isOnboardingNationAllowed(nextNationId)) {
            return;
        }
        clearAllMapNationStates();

        selectedNationId = nextNationId;
        activeNationId = null;

        if (selectedNationId) {
            setNationMapSelected(selectedNationId, true);
        }

        updateListButtonStates();
        updateConfirmButtonVisibility();

        global.dispatchEvent(new CustomEvent('royalarmies:nation-selected', {
            detail: {
                nationId: selectedNationId,
                nation: selectedNationId ? getNationMeta(selectedNationId) : null
            }
        }));
    }

    function onListPointerOver(event) {
        const btn = event.target.closest('.game-nation-list-btn');
        if (!btn) return;
        applyActiveNation(btn.getAttribute('data-nation-id'));
    }

    function onListPointerOut(event) {
        const btn = event.target.closest('.game-nation-list-btn');
        if (!btn) return;
        const related = event.relatedTarget;
        if (related && btn.contains(related)) return;
        applyActiveNation(null);
    }

    function onListClick(event) {
        const btn = event.target.closest('.game-nation-list-btn');
        if (!btn) return;
        event.preventDefault();
        applySelectedNation(btn.getAttribute('data-nation-id'));
    }

    function onListKeydown(event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const btn = event.target.closest('.game-nation-list-btn');
        if (!btn) return;
        event.preventDefault();
        applySelectedNation(btn.getAttribute('data-nation-id'));
    }

    async function onNationConfirmClick(event) {
        if (event) event.preventDefault();
        if (!selectedNationId || !isOnboardingNationAllowed(selectedNationId)) return;

        const confirmBtn = getConfirmButton();
        if (confirmBtn) confirmBtn.disabled = true;

        let saved = false;
        if (global.RoyalArmiesGameRegionsMap
            && typeof global.RoyalArmiesGameRegionsMap.persistOnboardingNationSelection === 'function') {
            saved = await global.RoyalArmiesGameRegionsMap.persistOnboardingNationSelection(
                selectedNationId,
                ONBOARDING_DEFAULT_REGION_ID
            );
        }

        updateConfirmButtonVisibility();
        if (!saved) return;

        if (typeof global.advanceGameOnboarding === 'function') {
            global.advanceGameOnboarding();
        }
    }

    function getListButtons() {
        const panel = getListPanel();
        if (!panel) return [];
        return Array.from(panel.querySelectorAll('.game-nation-list-btn'));
    }

    function buildNationList() {
        const list = getListRoot();
        if (!list) return;

        list.textContent = '';
        if (!nationsCatalog.length) {
            const empty = global.document.createElement('li');
            empty.className = 'game-nation-list-item game-nation-list-item--empty';
            empty.textContent = 'Loading territories…';
            list.appendChild(empty);
            return;
        }

        nationsCatalog.forEach((nation) => {
            if (!isOnboardingNationAllowed(nation.id)) return;
            const item = global.document.createElement('li');
            item.className = 'game-nation-list-item';
            item.setAttribute('role', 'presentation');

            const btn = global.document.createElement('button');
            btn.type = 'button';
            const isMajor = nation.kind === 'major';
            btn.className = isMajor
                ? 'game-nation-list-btn game-nation-list-btn--major'
                : 'game-nation-list-btn';
            btn.setAttribute('data-nation-id', nation.id);
            btn.setAttribute('role', 'option');
            btn.setAttribute('aria-selected', 'false');
            if (nation.accent) {
                btn.style.setProperty('--game-nation-accent', nation.accent);
            }

            const label = global.document.createElement('span');
            label.className = 'game-nation-list-btn-label';
            label.textContent = nation.name;
            btn.appendChild(label);

            item.appendChild(btn);
            list.appendChild(item);
        });
    }

    function injectNationPaths(pathRecords) {
        const layer = getVisualLayer();
        if (!layer) return;

        layer.textContent = '';
        const fragment = global.document.createDocumentFragment();

        pathRecords.forEach((record) => {
            if (!record.id || !record.d) return;

            const pathEl = global.document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathEl.setAttribute('class', 'game-nation-zone game-nation-visual');
            pathEl.setAttribute('data-nation-id', record.id);
            pathEl.setAttribute('d', record.d);
            pathEl.setAttribute('fill', 'transparent');
            fragment.appendChild(pathEl);
        });

        layer.appendChild(fragment);
        pathsReady = true;
    }

    async function loadNationPaths() {
        const layer = getVisualLayer();
        if (!layer || pathsReady) return true;

        try {
            const response = await fetch(NATION_PATHS_URL, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const payload = await response.json();
            const records = Array.isArray(payload?.nations) ? payload.nations : [];
            if (!records.length) {
                throw new Error('No nation paths in payload');
            }
            applyNationsCatalog(records);
            injectNationPaths(records);
            return true;
        } catch (err) {
            console.error('[RIFT] Failed to load nation map paths:', err);
            return false;
        }
    }

    function bindNationPicker() {
        const listPanel = getListPanel();
        if (!listPanel || listPanel.dataset.riftBound === '1') return;
        listPanel.dataset.riftBound = '1';

        listPanel.addEventListener('pointerover', onListPointerOver);
        listPanel.addEventListener('pointerout', onListPointerOut);
        listPanel.addEventListener('click', onListClick);
        listPanel.addEventListener('keydown', onListKeydown);

        const confirmBtn = getConfirmButton();
        if (confirmBtn && confirmBtn.dataset.riftBound !== '1') {
            confirmBtn.dataset.riftBound = '1';
            confirmBtn.addEventListener('click', onNationConfirmClick);
        }
    }

    async function init() {
        if (!getMapRoot() || !getVisualLayer() || !getListPanel()) return;

        bindNationPicker();
        bindNationLayoutSync();
        await loadNationPaths();
        clearAllMapNationStates();
        applySelectedNation(null);
        if (nationsCatalog.length === 1) {
            applySelectedNation(nationsCatalog[0].id);
        }
        scheduleNationFlankLayout();
    }

    global.RoyalArmiesGameNationsMap = {
        init,
        loadPaths: loadNationPaths,
        syncFlankLayout: syncNationFlankLayout,
        scheduleFlankLayout: scheduleNationFlankLayout,
        getNations: () => nationsCatalog.map((nation) => ({ ...nation })),
        getActiveNationId: () => activeNationId,
        getSelectedNationId: () => selectedNationId,
        setSelectedNationId: applySelectedNation,
        setActiveNationId: applyActiveNation
    };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);

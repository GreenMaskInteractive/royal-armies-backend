/**
 * RIFT — Player map location pins (solo, transport, group hold/SF, nation main).
 *
 * Group types (future UI): transport | hold | sf | main | temp-main
 * Only the nation leader may designate the official Main force.
 */
(function initRoyalArmiesPlayerLocPins(global) {
    'use strict';

    const CACHE_TOKEN = 'player-loc-pins-2';
    const STORAGE_SUFFIX = 'ageDeploymentPinMode';

    /** Resolved pin shown on the map. */
    const PIN_MODES = Object.freeze({
        alone: 'alone',
        transport: 'transport',
        grouped: 'grouped',
        main: 'main'
    });

    /**
     * Future group purpose when creating/joining a roster (Last Knights–style).
     * hold / sf / rally → grouped pin; taxi → transport pin; main / temp-main → main pin.
     */
    const GROUP_TYPES = Object.freeze({
        transport: 'transport',
        hold: 'hold',
        sf: 'sf',
        main: 'main',
        tempMain: 'temp-main'
    });

    const PIN_ASSETS = Object.freeze({
        alone: `images/playeralonelocpin.png?v=${CACHE_TOKEN}`,
        transport: `images/playertransportlocpin.png?v=${CACHE_TOKEN}`,
        grouped: `images/playergroupedlocpin.png?v=${CACHE_TOKEN}`,
        main: `images/playermainlocpin.png?v=${CACHE_TOKEN}`
    });

    const PIN_LABELS = Object.freeze({
        alone: 'Solo march',
        transport: 'Army transport',
        grouped: 'Group hold or SF',
        main: 'Nation main force'
    });

    let hostEl = null;
    let mapPointToFrame = null;
    let resolveCatalogCity = null;
    let localPinEl = null;
    /** Live pin mode — only changes when roster sync or explicit deployment actions update it. */
    let runtimePinMode = PIN_MODES.alone;

    function resolveUsername() {
        const saved = global.localStorage.getItem('activeCommanderUser');
        if (saved && saved.trim()) return saved.trim();
        if (typeof global.getActiveCommanderUsername === 'function') {
            return String(global.getActiveCommanderUsername() || '').trim();
        }
        return '';
    }

    function storageKey() {
        const username = resolveUsername();
        if (!username) return '';
        return `royalArmies_${username}_${STORAGE_SUFFIX}`;
    }

    function clearLegacyDeploymentPinStorage() {
        const key = storageKey();
        if (!key) return;
        try {
            global.localStorage.removeItem(key);
        } catch (_err) {
            /* ignore */
        }
    }

    function normalizePinMode(value) {
        const mode = String(value || '').trim().toLowerCase();
        return Object.prototype.hasOwnProperty.call(PIN_MODES, mode) ? mode : PIN_MODES.alone;
    }

    function normalizeGroupType(value) {
        const type = String(value || '').trim().toLowerCase();
        if (type === GROUP_TYPES.tempMain) return GROUP_TYPES.tempMain;
        if (type === GROUP_TYPES.transport) return GROUP_TYPES.transport;
        if (type === GROUP_TYPES.hold) return GROUP_TYPES.hold;
        if (type === GROUP_TYPES.sf) return GROUP_TYPES.sf;
        if (type === GROUP_TYPES.main) return GROUP_TYPES.main;
        return '';
    }

    function resolvePinModeFromGroupType(groupType) {
        const raw = String(groupType || '').trim().toLowerCase();
        const type = normalizeGroupType(groupType) || raw;
        if (!type) return PIN_MODES.alone;
        if (type === GROUP_TYPES.transport || raw === 'taxi') return PIN_MODES.transport;
        if (type === GROUP_TYPES.main || type === GROUP_TYPES.tempMain) return PIN_MODES.main;
        if (type === GROUP_TYPES.hold || type === GROUP_TYPES.sf || raw === 'rally') return PIN_MODES.grouped;
        return PIN_MODES.alone;
    }

    function getDeploymentPinMode() {
        return normalizePinMode(runtimePinMode);
    }

    function setDeploymentPinMode(mode) {
        const next = normalizePinMode(mode);
        runtimePinMode = next;
        refreshLocalPlayerPin();
        return next;
    }

    function setDeploymentFromGroupType(groupType) {
        const mode = resolvePinModeFromGroupType(groupType);
        return setDeploymentPinMode(mode);
    }

    function resolvePinAsset(mode) {
        return PIN_ASSETS[normalizePinMode(mode)] || PIN_ASSETS.alone;
    }

    function resolveLocalCatalogCity() {
        if (typeof resolveCatalogCity === 'function') {
            return resolveCatalogCity();
        }
        return null;
    }

    function ensureLocalPinElement() {
        if (!hostEl) return null;
        if (localPinEl && localPinEl.isConnected) return localPinEl;

        localPinEl = global.document.createElement('div');
        localPinEl.className = 'age-world-map-player-pin age-world-map-player-pin--local';
        localPinEl.id = 'age-world-map-player-pin-local';
        localPinEl.hidden = true;

        const img = global.document.createElement('img');
        img.className = 'age-world-map-player-pin-image';
        img.alt = '';
        img.decoding = 'async';
        img.draggable = false;
        img.addEventListener('error', () => {
            img.src = PIN_ASSETS.alone;
        }, { once: true });

        localPinEl.appendChild(img);
        hostEl.appendChild(localPinEl);
        return localPinEl;
    }

    function syncLocalPlayerPinPosition() {
        const pin = ensureLocalPinElement();
        if (!pin || !mapPointToFrame) return;

        const city = resolveLocalCatalogCity();
        if (!city?.centroid) {
            pin.hidden = true;
            return;
        }

        const mode = getDeploymentPinMode();
        const img = pin.querySelector('.age-world-map-player-pin-image');
        if (img) {
            const asset = resolvePinAsset(mode);
            if (img.getAttribute('src') !== asset) {
                img.src = asset;
            }
            img.alt = PIN_LABELS[mode] || PIN_LABELS.alone;
        }

        const point = mapPointToFrame(city.centroid.x, city.centroid.y);
        pin.style.left = `${point.x}px`;
        pin.style.top = `${point.y}px`;
        pin.dataset.pinMode = mode;
        pin.setAttribute('aria-label', PIN_LABELS[mode] || PIN_LABELS.alone);
        pin.hidden = false;
    }

    function refreshLocalPlayerPin() {
        syncLocalPlayerPinPosition();
    }

    function enable(options = {}) {
        hostEl = options.host || global.document.getElementById('age-world-map-player-pins');
        mapPointToFrame = typeof options.mapPointToFrame === 'function' ? options.mapPointToFrame : null;
        resolveCatalogCity = typeof options.resolveCatalogCity === 'function' ? options.resolveCatalogCity : null;

        if (!hostEl || !mapPointToFrame) return false;

        runtimePinMode = PIN_MODES.alone;
        clearLegacyDeploymentPinStorage();
        refreshLocalPlayerPin();
        return true;
    }

    function syncPositions() {
        syncLocalPlayerPinPosition();
    }

    global.RoyalArmiesPlayerLocPins = {
        enable,
        syncPositions,
        refreshLocalPlayerPin,
        getDeploymentPinMode,
        setDeploymentPinMode,
        setDeploymentFromGroupType,
        resolvePinModeFromGroupType,
        resolvePinAsset,
        PIN_MODES,
        GROUP_TYPES,
        PIN_ASSETS,
        PIN_LABELS
    };

    clearLegacyDeploymentPinStorage();
})(window);

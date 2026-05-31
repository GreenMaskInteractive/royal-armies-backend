/**
 * RIFT — Age map movement (travel, assault, ally transfer, move points).
 */
(function initRoyalArmiesAgeMovement(global) {
    'use strict';

    const STORAGE_CATALOG_CITY_SUFFIX = 'ageCatalogCityId';

    const MAP_NATION_ID_ALIASES = {
        aesthine: 'aesthene'
    };

    const MOVE_POINT_TICK_MS = 30 * 60 * 1000;

    function getMovePointTickBoundaryMs(timestampMs) {
        const d = new Date(timestampMs);
        const boundaryMinutes = d.getUTCMinutes() >= 30 ? 30 : 0;
        return Date.UTC(
            d.getUTCFullYear(),
            d.getUTCMonth(),
            d.getUTCDate(),
            d.getUTCHours(),
            boundaryMinutes,
            0,
            0
        );
    }

    function getNextMovePointTickBoundaryMs(timestampMs) {
        return getMovePointTickBoundaryMs(timestampMs) + MOVE_POINT_TICK_MS;
    }

    function applyLocalMovePointRegen(nowMs = Date.now()) {
        const max = state.movePointsMax || state.rules.movePointsMax || 3;
        let movePoints = Math.max(0, Math.min(max, Math.floor(Number(state.movePoints) || 0)));

        if (movePoints >= max) {
            return {
                movePoints: max,
                lastMovePointRegenAt: new Date(getMovePointTickBoundaryMs(nowMs)).toISOString()
            };
        }

        let lastRegenMs = Date.parse(state.lastMovePointRegenAt);
        if (!Number.isFinite(lastRegenMs)) {
            lastRegenMs = getMovePointTickBoundaryMs(nowMs);
        }

        let lastBoundary = getMovePointTickBoundaryMs(lastRegenMs);
        const currentBoundary = getMovePointTickBoundaryMs(nowMs);

        while (
            lastBoundary + MOVE_POINT_TICK_MS <= currentBoundary
            && movePoints < max
        ) {
            movePoints += state.rules.movePointRegenPerTick || 1;
            lastBoundary += MOVE_POINT_TICK_MS;
        }

        if (movePoints >= max) {
            lastBoundary = getMovePointTickBoundaryMs(nowMs);
        }

        return {
            movePoints: Math.min(max, movePoints),
            lastMovePointRegenAt: new Date(lastBoundary).toISOString()
        };
    }

    function compactNationToken(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
    }

    function resolveMapNationKey(rawNationKey) {
        let key = String(rawNationKey || '').trim().toLowerCase();
        if (!key) return '';

        if (MAP_NATION_ID_ALIASES[key]) {
            key = MAP_NATION_ID_ALIASES[key];
        }

        const catalog = global.RoyalArmiesAgeWorldMap?.getCatalog?.();
        const nations = catalog?.nations || [];
        if (!nations.length) {
            const compact = compactNationToken(key);
            if (MAP_NATION_ID_ALIASES[compact]) return MAP_NATION_ID_ALIASES[compact];
            return /^[a-z0-9-]+$/.test(key) ? key : '';
        }

        let match = nations.find((nation) => nation.id === key);
        if (match) return match.id;

        const compact = compactNationToken(key);
        if (MAP_NATION_ID_ALIASES[compact]) {
            match = nations.find((nation) => nation.id === MAP_NATION_ID_ALIASES[compact]);
            if (match) return match.id;
        }

        match = nations.find((nation) => compactNationToken(nation.id) === compact);
        if (match) return match.id;

        match = nations.find((nation) => compactNationToken(nation.name) === compact);
        return match ? match.id : '';
    }

    function resolveCatalogCityId(rawCityId) {
        const catalog = global.RoyalArmiesAgeWorldMap?.getCatalog?.();
        const nation = resolveMapNationKey(state.mapNation) || 'aesthene';
        const id = String(rawCityId || '').trim();

        if (id && catalog?.cities) {
            const direct = catalog.cities.find((city) => city.id === id);
            if (direct) return direct.id;

            const stub = id.replace(/^[^-]+-/, '');
            const match = catalog.cities.find((city) => {
                if (city.nationId !== nation) return false;
                if (city.id === id || city.id === `${nation}-${id}` || city.id === `${nation}-${stub}`) {
                    return true;
                }
                return city.id.endsWith(`-${stub}`) || city.id.endsWith(`-${id}`);
            });
            if (match) return match.id;
        }

        if (catalog?.cities) {
            const capital = catalog.cities.find((city) => city.nationId === nation && city.isCapital);
            if (capital) return capital.id;
            const fallback = catalog.cities.find((city) => city.nationId === nation);
            if (fallback) return fallback.id;
        }

        return id;
    }

    let state = {
        catalogCityId: '',
        movePoints: 3,
        movePointsMax: 3,
        lastMovePointRegenAt: null,
        gameNation: '',
        cityHolders: {},
        cityLosers: {},
        alliedNationIds: [],
        rules: {
            movePointsMax: 3,
            movePointRegenPerTick: 1,
            movePointTickMinutes: 30,
            transferOwnershipRsdCost: 250
        },
        unitsTotal: 0,
        unitsUninjured: 0
    };

    function resolveApiUrl(path) {
        if (typeof global.resolveRoyalArmiesApiUrl === 'function') {
            return global.resolveRoyalArmiesApiUrl(path);
        }
        return path;
    }

    function resolveUsername() {
        const saved = global.localStorage.getItem('activeCommanderUser');
        if (saved && saved.trim()) return saved.trim();
        if (typeof global.getActiveCommanderUsername === 'function') {
            return String(global.getActiveCommanderUsername() || '').trim();
        }
        return '';
    }

    function storageKey(suffix) {
        const username = resolveUsername();
        if (!username) return '';
        return `royalArmies_${username}_${suffix}`;
    }

    function readStoredCatalogCityId() {
        const stored = global.localStorage.getItem(storageKey(STORAGE_CATALOG_CITY_SUFFIX));
        return stored && stored.trim() ? stored.trim() : '';
    }

    function writeStoredCatalogCityId(cityId) {
        const key = storageKey(STORAGE_CATALOG_CITY_SUFFIX);
        if (!key) return;
        const id = String(cityId || '').trim();
        if (!id) {
            global.localStorage.removeItem(key);
            return;
        }
        global.localStorage.setItem(key, id);
    }

    function applyStatePayload(payload) {
        if (!payload || typeof payload !== 'object') return;

        if (payload.gameNation) {
            state.gameNation = String(payload.gameNation).trim().toLowerCase();
        }
        if (payload.mapNation) {
            state.mapNation = resolveMapNationKey(payload.mapNation) || String(payload.mapNation).trim().toLowerCase();
        } else if (!state.mapNation) {
            const resolvedCouncilNation = resolveMapNationKey(payload.gameNation);
            if (resolvedCouncilNation) {
                state.mapNation = resolvedCouncilNation;
            }
        }
        if (payload.catalogCityId !== undefined && payload.catalogCityId !== null) {
            const resolvedCityId = resolveCatalogCityId(payload.catalogCityId);
            if (resolvedCityId) {
                state.catalogCityId = resolvedCityId;
                writeStoredCatalogCityId(resolvedCityId);
            }
        }
        if (payload.movePoints !== undefined) {
            state.movePoints = Math.max(0, Math.floor(Number(payload.movePoints) || 0));
        }
        if (payload.movePointsMax !== undefined) {
            state.movePointsMax = Math.max(1, Math.floor(Number(payload.movePointsMax) || state.rules.movePointsMax));
        }
        if (payload.lastMovePointRegenAt) {
            state.lastMovePointRegenAt = payload.lastMovePointRegenAt;
        }
        if (payload.cityHolders && typeof payload.cityHolders === 'object') {
            state.cityHolders = { ...payload.cityHolders };
        }
        if (payload.cityLosers && typeof payload.cityLosers === 'object') {
            state.cityLosers = { ...payload.cityLosers };
        }
        if (Array.isArray(payload.alliedNationIds)) {
            state.alliedNationIds = payload.alliedNationIds
                .map((id) => String(id || '').trim().toLowerCase())
                .filter(Boolean);
        }
        if (payload.rules && typeof payload.rules === 'object') {
            state.rules = { ...state.rules, ...payload.rules };
        }
        if (payload.unitsTotal !== undefined) {
            state.unitsTotal = Math.max(0, Math.floor(Number(payload.unitsTotal) || 0));
        }
        if (payload.unitsUninjured !== undefined) {
            state.unitsUninjured = Math.max(0, Math.floor(Number(payload.unitsUninjured) || 0));
        }
        if (Array.isArray(payload.ageArmy) && typeof global.player !== 'undefined') {
            global.player.ageArmy = payload.ageArmy.slice();
        }
        if (payload.ageGold !== undefined && global.RoyalArmiesAgeGold?.setAgeCommanderGold) {
            global.RoyalArmiesAgeGold.setAgeCommanderGold(
                Math.max(0, Math.floor(Number(payload.ageGold) || 0)),
                { source: 'server-sync', silent: true }
            );
        }
        if (payload.ageProvisions !== undefined && global.RoyalArmiesAgeProvisions?.setAgeCommanderProvisions) {
            global.RoyalArmiesAgeProvisions.setAgeCommanderProvisions(
                Math.max(0, Math.floor(Number(payload.ageProvisions) || 0)),
                { source: 'server-sync', silent: true }
            );
        }

        global.dispatchEvent(new CustomEvent('royalarmies:age-movement-updated', {
            detail: { ...state }
        }));
    }

    async function parseResponse(response) {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            const code = payload.code || payload.errorCode || '';
            const err = new Error(payload.message || 'Movement request failed.');
            err.code = code;
            throw err;
        }
        return payload;
    }

    async function refresh() {
        const username = resolveUsername();
        if (!username) return null;

        try {
            const response = await fetch(
                resolveApiUrl(`/api/portal/age/movement-state?username=${encodeURIComponent(username)}`),
                { credentials: 'same-origin' }
            );
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                return null;
            }
            applyStatePayload(payload);
            return payload;
        } catch (_err) {
            return null;
        }
    }

    function ensureLocalMovementDefaults() {
        if (!state.mapNation && typeof global.RoyalArmiesAgeMovementPanel?.getCommanderNationId === 'function') {
            const panelNation = global.RoyalArmiesAgeMovementPanel.getCommanderNationId();
            const resolvedPanelNation = resolveMapNationKey(panelNation);
            if (resolvedPanelNation) {
                state.mapNation = resolvedPanelNation;
            }
        }
        if (!state.mapNation || !resolveMapNationKey(state.mapNation)) {
            state.mapNation = 'aesthene';
        }

        const rawCityId = state.catalogCityId || readStoredCatalogCityId();
        const resolvedCityId = resolveCatalogCityId(rawCityId);
        if (resolvedCityId) {
            state.catalogCityId = resolvedCityId;
            writeStoredCatalogCityId(resolvedCityId);
        }
    }

    function areCatalogCitiesAdjacent(cityA, cityB) {
        if (!cityA || !cityB) return false;
        if (cityA.id === cityB.id) return true;
        const aToB = Array.isArray(cityA.neighbors) && cityA.neighbors.includes(cityB.id);
        const bToA = Array.isArray(cityB.neighbors) && cityB.neighbors.includes(cityA.id);
        return aToB || bToA;
    }

    async function postAction(path, targetCityId, extra = {}) {
        const username = resolveUsername();
        if (!username) {
            const err = new Error('Commander session required.');
            err.code = 'NEXUS-GEN-002';
            throw err;
        }

        const response = await fetch(resolveApiUrl(path), {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                targetCityId,
                ...extra
            })
        });

        const payload = await parseResponse(response);
        applyStatePayload(payload);
        return payload;
    }

    async function travel(targetCityId) {
        return postAction('/api/portal/age/travel', targetCityId);
    }

    async function assault(targetCityId, options = {}) {
        return postAction('/api/portal/age/assault', targetCityId, {
            playersInCity: options.playersInCity
        });
    }

    async function transferOwnership(targetCityId) {
        return postAction('/api/portal/age/transfer-ownership', targetCityId);
    }

    function resolveCityHolder(city) {
        if (!city) return '';
        const override = state.cityHolders[city.id];
        if (override) return String(override).trim().toLowerCase();
        return String(city.holderNationId || city.nationId || '').trim().toLowerCase();
    }

    function resolveCityLoser(city) {
        if (!city) return '';
        const override = state.cityLosers[city.id];
        if (override) return String(override).trim().toLowerCase();
        return String(city.loserNationId || '').trim().toLowerCase();
    }

    function resolvePlayerNationId() {
        ensureLocalMovementDefaults();
        const resolvedMapNation = resolveMapNationKey(state.mapNation);
        if (resolvedMapNation) return resolvedMapNation;

        if (typeof global.RoyalArmiesAgeMovementPanel?.getCommanderNationId === 'function') {
            const panelNation = global.RoyalArmiesAgeMovementPanel.getCommanderNationId();
            const resolvedPanelNation = resolveMapNationKey(panelNation);
            if (resolvedPanelNation) return resolvedPanelNation;
        }

        return 'aesthene';
    }

    function getCatalogCityId() {
        ensureLocalMovementDefaults();
        return resolveCatalogCityId(state.catalogCityId || readStoredCatalogCityId());
    }

    function getBorderActionHints(targetCity, playerCityId) {
        const playerCatalogCityId = resolveCatalogCityId(playerCityId || getCatalogCityId());
        if (!targetCity || !playerCatalogCityId) {
            return { canTravel: false, canAssault: false, canTransfer: false, canScout: false };
        }

        if (targetCity.id === playerCatalogCityId) {
            return { canTravel: false, canAssault: false, canTransfer: false, canScout: false, relationship: 'current' };
        }

        const catalog = global.RoyalArmiesAgeWorldMap?.getCatalog?.();
        const playerCity = catalog?.cities?.find((city) => city.id === playerCatalogCityId);
        const waterRoutes = global.RoyalArmiesAgeWaterRoutes;
        const connection = waterRoutes?.resolveCityConnection
            ? waterRoutes.resolveCityConnection(playerCity, targetCity)
            : (areCatalogCitiesAdjacent(playerCity, targetCity) ? { type: 'land', movePointCost: 1 } : null);

        const playerNation = resolvePlayerNationId();
        const holder = resolveCityHolder(targetCity);
        let relationship = 'hostile';
        if (holder === playerNation) {
            relationship = 'own';
        } else if (state.alliedNationIds.includes(holder)) {
            relationship = 'ally';
        }

        if (!connection) {
            return { canTravel: false, canAssault: false, canTransfer: false, canScout: false, relationship: 'remote' };
        }

        const movePointCost = connection.movePointCost || 1;
        const isForeignBorder = relationship !== 'own';

        return {
            relationship,
            connectionType: connection.type || 'land',
            canTravel: relationship === 'own',
            canAssault: relationship === 'hostile',
            canTransfer: relationship === 'ally',
            canScout: isForeignBorder,
            transferRsdCost: state.rules.transferOwnershipRsdCost || 250,
            movePointCost
        };
    }

    function getMovePoints() {
        return applyLocalMovePointRegen().movePoints;
    }

    function getMovePointsMax() {
        return state.movePointsMax || state.rules.movePointsMax || 3;
    }

    function getNextMovePointTickAt() {
        return new Date(getNextMovePointTickBoundaryMs(Date.now())).toISOString();
    }

    function getCityHolders() {
        return { ...state.cityHolders };
    }

    function getCityLosers() {
        return { ...state.cityLosers };
    }

    function getRules() {
        return { ...state.rules };
    }

    function getAlliedNationIds() {
        return [...state.alliedNationIds];
    }

    function getWarNationIds() {
        return Array.isArray(state.warNationIds) ? [...state.warNationIds] : [];
    }

    function getUnitsTotal() {
        return Math.max(0, Math.floor(Number(state.unitsTotal) || 0));
    }

    function getUnitsUninjured() {
        const total = getUnitsTotal();
        const uninjured = Math.max(0, Math.floor(Number(state.unitsUninjured) || 0));
        return Math.min(total, uninjured);
    }

    global.RoyalArmiesAgeMovement = {
        refresh,
        travel,
        assault,
        transferOwnership,
        resolveCityHolder,
        resolveCityLoser,
        getBorderActionHints,
        getCatalogCityId,
        getMovePoints,
        getMovePointsMax,
        getNextMovePointTickAt,
        applyLocalMovePointRegen,
        getCityHolders,
        getCityLosers,
        getRules,
        resolvePlayerNationId,
        getAlliedNationIds,
        getWarNationIds,
        getUnitsTotal,
        getUnitsUninjured,
        applyStatePayload
    };

    if (global.RoyalArmiesAgeWaterRoutes?.loadRoutes) {
        global.RoyalArmiesAgeWaterRoutes.loadRoutes();
    }
})(window);

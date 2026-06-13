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

    function isInfiniteMovePointsEnabled() {
        if (typeof global.isPortalDirectAgeJoinEnabled === 'function' && global.isPortalDirectAgeJoinEnabled()) {
            return true;
        }
        if (state.infiniteMovePoints === true) return true;
        if (state.rules?.infiniteMovePoints === true) return true;
        if (typeof global.isInfiniteMovePointsEnabled === 'function') {
            return global.isInfiniteMovePointsEnabled();
        }
        if (global.RoyalArmiesDev?.isInfiniteMovePointsEnabled?.()) return true;
        return false;
    }

    function applyLocalMovePointRegen(nowMs = Date.now()) {
        const max = getMovePointsMax();
        if (isInfiniteMovePointsEnabled()) {
            return {
                movePoints: max,
                lastMovePointRegenAt: new Date(getMovePointTickBoundaryMs(nowMs)).toISOString()
            };
        }

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

    function resolveCatalogCityRecord(cityId) {
        const id = String(cityId || '').trim();
        if (!id) return null;

        if (typeof global.RoyalArmiesAgeWorldMap?.getCityById === 'function') {
            const fromMap = global.RoyalArmiesAgeWorldMap.getCityById(id);
            if (fromMap) return fromMap;
        }

        const catalog = global.RoyalArmiesAgeWorldMap?.getCatalog?.();
        return catalog?.cities?.find((city) => city.id === id) || null;
    }

    function resolveMovementTargetCityId(rawCityId) {
        const id = String(rawCityId || '').trim();
        if (!id) return '';

        const fromMap = resolveCatalogCityRecord(id);
        if (fromMap) return fromMap.id;

        const catalog = global.RoyalArmiesAgeWorldMap?.getCatalog?.();
        if (catalog?.cities) {
            const stub = id.replace(/^[^-]+-/, '');
            const match = catalog.cities.find((city) => (
                city.id === id
                || city.id.endsWith(`-${stub}`)
                || city.id.endsWith(`-${id}`)
            ));
            if (match) return match.id;
        }

        return id;
    }

    function resolveLedgerNationId() {
        return resolveMapNationKey(state.gameNation)
            || resolveMapNationKey(global.player?.gameNation)
            || resolveMapNationKey(global.player?.nation)
            || '';
    }

    function resolveActiveMapNationKey() {
        return resolveLedgerNationId()
            || resolveMapNationKey(state.mapNation)
            || (typeof global.RoyalArmiesAgeMovementPanel?.getCommanderNationId === 'function'
                ? resolveMapNationKey(global.RoyalArmiesAgeMovementPanel.getCommanderNationId())
                : '');
    }

    function applyAuthoritativeCatalogCityId(rawCityId) {
        const id = String(rawCityId ?? '').trim();
        const nation = resolveActiveMapNationKey();

        if (!id) {
            return nation ? resolveCatalogCityId('', nation) : '';
        }

        const resolved = resolveMovementTargetCityId(id);
        const city = resolveCatalogCityRecord(resolved);
        if (city) {
            if (!nation || city.nationId === nation) {
                return resolved;
            }
            return resolveCatalogCityId('', nation);
        }

        return resolveCatalogCityId(id, nation);
    }

    function resolveCatalogCityId(rawCityId, nationKey) {
        const catalog = global.RoyalArmiesAgeWorldMap?.getCatalog?.();
        const nation = resolveMapNationKey(nationKey)
            || resolveActiveMapNationKey()
            || 'aesthene';
        const id = String(rawCityId || '').trim();

        if (id && catalog?.cities) {
            const direct = catalog.cities.find((city) => city.id === id);
            if (direct) {
                if (!nation || direct.nationId === nation) {
                    return direct.id;
                }
            } else {

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

    function usesCrossOriginApi() {
        return typeof global.isLiveStaticPreviewHost === 'function' && global.isLiveStaticPreviewHost();
    }

    function resolveApiFetchInit(overrides) {
        return {
            credentials: usesCrossOriginApi() ? 'include' : 'same-origin',
            cache: 'no-store',
            ...overrides
        };
    }

    function isFetchConnectionFailure(err) {
        const msg = String(err?.message || err || '').toLowerCase();
        return msg.includes('failed to fetch')
            || msg.includes('fetch failed')
            || msg.includes('networkerror')
            || msg.includes('network request failed')
            || msg.includes('connection refused')
            || msg.includes('load failed');
    }

    function formatActionError(err) {
        if (typeof global.isRoyalArmiesApiReachable === 'function' && !global.isRoyalArmiesApiReachable()) {
            return {
                code: 'RIFT-NET-001',
                message: 'Could not reach the game server. Run node server.js on port 3000 while using Live Server (:5500).'
            };
        }

        if (isFetchConnectionFailure(err)) {
            if (usesCrossOriginApi()) {
                return {
                    code: 'RIFT-NET-001',
                    message: 'Could not reach the game server. Run node server.js on port 3000 while using Live Server (:5500).'
                };
            }
            if (typeof global.isLocalDevelopmentHost === 'function' && global.isLocalDevelopmentHost()) {
                return {
                    code: 'RIFT-NET-001',
                    message: 'Could not reach the game server. Start it with node server.js.'
                };
            }
            return { code: 'RIFT-NET-001' };
        }

        const code = String(err?.code || '').trim();
        if (code) {
            return { code, message: String(err?.message || '').trim() || undefined };
        }

        return {
            code: 'NEXUS-GEN-001',
            message: String(err?.message || 'Movement request failed.').trim()
        };
    }

    function toMovementError(err) {
        const formatted = formatActionError(err);
        const next = new Error(formatted.message || 'Movement request failed.');
        next.code = formatted.code;
        return next;
    }

    async function fetchMovementApi(path, init) {
        try {
            const response = await fetch(resolveApiUrl(path), resolveApiFetchInit(init));
            if (typeof global.markRoyalArmiesApiReachable === 'function') {
                global.markRoyalArmiesApiReachable();
            }
            return response;
        } catch (err) {
            if (typeof global.markRoyalArmiesApiUnreachable === 'function') {
                global.markRoyalArmiesApiUnreachable();
            }
            throw toMovementError(err);
        }
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

    function applyStatePayload(payload, options = {}) {
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
            const resolvedCityId = applyAuthoritativeCatalogCityId(payload.catalogCityId);
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
            if (payload.rules.infiniteMovePoints !== undefined) {
                state.infiniteMovePoints = Boolean(payload.rules.infiniteMovePoints);
            }
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
        if (
            payload.rank !== undefined
            || payload.path !== undefined
            || payload.rankTitleGender !== undefined
        ) {
            if (global.RoyalArmiesAgeCommanderRank?.applyCommanderRankPayload) {
                global.RoyalArmiesAgeCommanderRank.applyCommanderRankPayload(payload, { source: 'movement-sync' });
            } else if (payload.rank !== undefined) {
                const rank = Math.max(1, Math.floor(Number(payload.rank) || 1));
                if (typeof global.player !== 'undefined') {
                    global.player.rank = rank;
                }
                if (global.RoyalArmiesAgeCommanderRank?.setAgeCommanderRank) {
                    global.RoyalArmiesAgeCommanderRank.setAgeCommanderRank(rank, {
                        source: 'server-sync',
                        silent: true,
                        path: payload.path,
                        rankTitleGender: payload.rankTitleGender
                    });
                } else if (typeof global.refreshAgeHudCommanderRank === 'function') {
                    global.refreshAgeHudCommanderRank();
                }
            }
        }
        if (payload.ageGuildXp !== undefined && typeof global.player !== 'undefined') {
            global.player.ageGuildXp = Math.max(0, Math.floor(Number(payload.ageGuildXp) || 0));
        }
        if (options.eventSource !== 'guild-sync' && global.RoyalArmiesAgeGuildTraining?.applyGuildPayload) {
            global.RoyalArmiesAgeGuildTraining.applyGuildPayload(payload);
        }

        reconcileCatalogCityWithPlayerNation();

        global.dispatchEvent(new CustomEvent('royalarmies:age-movement-updated', {
            detail: {
                ...state,
                eventSource: String(options.eventSource || 'movement-sync').trim() || 'movement-sync'
            }
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
            const response = await fetchMovementApi(
                `/api/portal/age/movement-state?username=${encodeURIComponent(username)}`,
                { method: 'GET' }
            );
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                return null;
            }
            applyStatePayload(payload);
            if (typeof global.applyDevPreviewNationOverride === 'function') {
                global.applyDevPreviewNationOverride();
            }
            if (typeof global.applyDevPreviewClassPathOverride === 'function') {
                global.applyDevPreviewClassPathOverride();
            }
            return payload;
        } catch (_err) {
            if (typeof global.applyDevPreviewNationOverride === 'function') {
                global.applyDevPreviewNationOverride();
            }
            if (typeof global.applyDevPreviewClassPathOverride === 'function') {
                global.applyDevPreviewClassPathOverride();
            }
            return null;
        }
    }

    function reconcileCatalogCityWithPlayerNation() {
        const nation = resolveActiveMapNationKey();
        if (!nation) return;

        state.mapNation = nation;
        const rawCityId = state.catalogCityId || readStoredCatalogCityId();
        const resolvedCityId = resolveCatalogCityId(rawCityId, nation);
        if (!resolvedCityId) return;

        state.catalogCityId = resolvedCityId;
        writeStoredCatalogCityId(resolvedCityId);
    }

    function ensureLocalMovementDefaults() {
        const ledgerNation = resolveLedgerNationId();
        if (ledgerNation) {
            state.mapNation = ledgerNation;
        } else if (!state.mapNation && state.gameNation) {
            const resolvedGameNation = resolveMapNationKey(state.gameNation);
            if (resolvedGameNation) {
                state.mapNation = resolvedGameNation;
            }
        }

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

        reconcileCatalogCityWithPlayerNation();
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

        ensureLocalMovementDefaults();
        const resolvedTargetCityId = resolveMovementTargetCityId(targetCityId);

        const response = await fetchMovementApi(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                targetCityId: resolvedTargetCityId,
                ...extra
            })
        });

        const payload = await parseResponse(response);
        applyStatePayload(payload);
        return payload;
    }

    async function ensureMovementStateSynced() {
        const username = resolveUsername();
        if (!username) {
            const err = new Error('Commander session required.');
            err.code = 'NEXUS-GEN-002';
            throw err;
        }

        const refreshed = await refresh();
        ensureLocalMovementDefaults();
        return refreshed;
    }

    function assertCanTravelToCity(targetCityId) {
        const resolvedTargetId = resolveMovementTargetCityId(targetCityId);
        const targetCity = resolveCatalogCityRecord(resolvedTargetId);
        if (!targetCity) {
            const err = new Error('Unknown city or invalid movement target.');
            err.code = 'NEXUS-AGE-003';
            throw err;
        }

        const hints = getBorderActionHints(targetCity, getCatalogCityId());
        if (hints.relationship === 'current') {
            const err = new Error('You are already in that city.');
            err.code = 'NEXUS-AGE-009';
            throw err;
        }
        if (!hints.canTravel) {
            if (hints.relationship === 'restricted') {
                const err = new Error('That location is restricted. No army may enter or leave it.');
                err.code = 'NEXUS-AGE-037';
                throw err;
            }
            const err = new Error(
                hints.relationship === 'remote'
                    ? 'That city does not border your current position.'
                    : 'You can only travel to cities owned by your nation.'
            );
            err.code = hints.relationship === 'remote' ? 'NEXUS-AGE-002' : 'NEXUS-AGE-006';
            throw err;
        }

        const movePointCost = Math.max(1, Math.floor(Number(hints.movePointCost) || 1));
        if (!isInfiniteMovePointsEnabled() && getMovePoints() < movePointCost) {
            const err = new Error('No move points remaining. Regain 1 at each game-clock half-hour tick (:00 and :30 UTC, max 3).');
            err.code = 'NEXUS-AGE-001';
            throw err;
        }

        return { targetCity, hints, resolvedTargetId };
    }

    function resolveCityDisplayName(city, cityId) {
        if (city?.name) return String(city.name).trim();
        const fromMap = global.RoyalArmiesAgeWorldMap?.getCityById?.(cityId);
        if (fromMap?.name) return String(fromMap.name).trim();
        const id = String(cityId || '').trim();
        return id || 'that city';
    }

    async function confirmTravelToCity(travelCheck) {
        if (!travelCheck || typeof travelCheck !== 'object') return true;
        if (typeof global.showPortalConfirm !== 'function') return true;

        const { targetCity, hints, resolvedTargetId } = travelCheck;
        const movePointCost = Math.max(1, Math.floor(Number(hints?.movePointCost) || 1));
        const currentCityId = getCatalogCityId();
        const currentCity = resolveCatalogCityRecord(currentCityId);
        const fromName = resolveCityDisplayName(currentCity, currentCityId);
        const toName = resolveCityDisplayName(targetCity, resolvedTargetId);
        const costLabel = movePointCost === 1 ? '1 move point' : `${movePointCost} move points`;
        const waterNote = hints?.connectionType === 'water' ? ' via water crossing' : '';

        return global.showPortalConfirm(
            `Move from ${fromName} to ${toName}? This will spend ${costLabel}${waterNote}.`,
            {
                title: 'Confirm Travel',
                confirmLabel: 'Travel',
                cancelLabel: 'Stay'
            }
        );
    }

    async function travel(targetCityId, options = {}) {
        await ensureMovementStateSynced();
        const travelCheck = assertCanTravelToCity(targetCityId);
        const opts = options && typeof options === 'object' ? options : {};

        if (!opts.skipConfirm) {
            const confirmed = await confirmTravelToCity(travelCheck);
            if (!confirmed) return null;
        }

        return postAction('/api/portal/age/travel', targetCityId);
    }

    async function assault(targetCityId, options = {}) {
        const ledGroup = typeof global.RoyalArmiesAgeArmyGroups?.getLedArmyGroup === 'function'
            ? global.RoyalArmiesAgeArmyGroups.getLedArmyGroup()
            : null;
        if (ledGroup?.id) {
            const username = resolveUsername();
            if (!username) {
                const err = new Error('Commander session required.');
                err.code = 'NEXUS-GEN-002';
                throw err;
            }

            const response = await fetchMovementApi('/api/portal/age/army-groups/attack', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    groupId: ledGroup.id,
                    targetCityId,
                    playersInCity: options.playersInCity
                })
            });

            const payload = await parseResponse(response);
            applyStatePayload(payload);
            global.RoyalArmiesAgeAssaultRisk?.clearAssaultCasualtyCache?.();
            if (typeof global.RoyalArmiesAgeArmyGroups?.refresh === 'function') {
                global.RoyalArmiesAgeArmyGroups.refresh({ silent: true });
            }
            return payload;
        }

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
        const ledgerNation = resolveLedgerNationId();
        if (ledgerNation) return ledgerNation;

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
        return applyAuthoritativeCatalogCityId(state.catalogCityId || readStoredCatalogCityId());
    }

    function getBorderActionHints(targetCity, playerCityId) {
        const playerCatalogCityId = playerCityId
            ? applyAuthoritativeCatalogCityId(playerCityId)
            : getCatalogCityId();
        if (!targetCity || !playerCatalogCityId) {
            return { canTravel: false, canAssault: false, canTransfer: false, canScout: false };
        }

        if (targetCity.id === playerCatalogCityId) {
            return { canTravel: false, canAssault: false, canTransfer: false, canScout: false, relationship: 'current' };
        }

        const playerCity = resolveCatalogCityRecord(playerCatalogCityId);

        if (targetCity.masked || playerCity?.masked) {
            return { canTravel: false, canAssault: false, canTransfer: false, canScout: false, relationship: 'restricted' };
        }
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
        if (isInfiniteMovePointsEnabled()) {
            return getMovePointsMax();
        }
        return applyLocalMovePointRegen().movePoints;
    }

    function getMovePointsMax() {
        if (isInfiniteMovePointsEnabled()) {
            return Math.max(99, state.movePointsMax || state.rules.movePointsMax || 99);
        }
        return state.movePointsMax || state.rules.movePointsMax || 3;
    }

    const MOVE_POINTS_INFINITY_SYMBOL = '\u221E';

    function formatMovePointsHudLabel(current) {
        if (isInfiniteMovePointsEnabled()) {
            return MOVE_POINTS_INFINITY_SYMBOL;
        }
        const max = getMovePointsMax();
        const clamped = Math.max(0, Math.min(max, Math.floor(Number(current) || 0)));
        return String(clamped);
    }

    function formatMovePointsHudAriaLabel(current, max) {
        if (isInfiniteMovePointsEnabled()) {
            return 'Unlimited move points.';
        }
        const clampedMax = Math.max(1, Math.min(3, Math.floor(Number(max) || getMovePointsMax())));
        const clampedCurrent = Math.max(0, Math.min(clampedMax, Math.floor(Number(current) || 0)));
        return `${clampedCurrent} of ${clampedMax} move points. Regain 1 at each game-clock half-hour tick (:00 and :30 UTC).`;
    }

    function formatMovePointsSummaryLabel(current, max) {
        if (isInfiniteMovePointsEnabled()) {
            return `${MOVE_POINTS_INFINITY_SYMBOL} move points`;
        }
        const clampedMax = Math.max(1, Math.floor(Number(max) || getMovePointsMax()));
        const clampedCurrent = Math.max(0, Math.min(clampedMax, Math.floor(Number(current) || 0)));
        return `${clampedCurrent}/${clampedMax} move points`;
    }

    function applyAgeHudMovePointsToDom(current, max) {
        const el = global.document.getElementById('age-hud-move-points');
        const item = global.document.getElementById('age-hud-move-points-item');
        if (!el) return;

        const infinite = isInfiniteMovePointsEnabled();
        el.textContent = formatMovePointsHudLabel(current);
        el.classList.toggle('is-infinite-move-points', infinite);
        el.setAttribute('aria-label', formatMovePointsHudAriaLabel(current, max));

        const resolvedMax = Math.max(1, Math.min(3, Math.floor(Number(max) || getMovePointsMax())));
        const title = infinite
            ? 'Alpha testing — move points are unlimited during direct Age join.'
            : `Regain 1 move point at every :00 and :30 on the game clock (max ${resolvedMax}).`;
        if (item) item.setAttribute('title', title);
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
        ensureMovementStateSynced,
        assertCanTravelToCity,
        resolveMovementTargetCityId,
        resolveCatalogCityRecord,
        applyAuthoritativeCatalogCityId,
        travel,
        assault,
        transferOwnership,
        formatActionError,
        resolveCityHolder,
        resolveCityLoser,
        getBorderActionHints,
        getCatalogCityId,
        getMovePoints,
        getMovePointsMax,
        isInfiniteMovePointsEnabled,
        formatMovePointsHudLabel,
        formatMovePointsHudAriaLabel,
        formatMovePointsSummaryLabel,
        applyAgeHudMovePointsToDom,
        getNextMovePointTickAt,
        applyLocalMovePointRegen,
        getCityHolders,
        getCityLosers,
        getRules,
        resolvePlayerNationId,
        resolveLedgerNationId,
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

/**
 * NEXUS — Age map movement: move points, travel, assault, ally transfer.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const MOVE_POINTS_MAX = 3;
const MOVE_POINT_REGEN_PER_TICK = 1;
const MOVE_POINT_TICK_MINUTES = 30;
const MOVE_POINT_TICK_MS = MOVE_POINT_TICK_MINUTES * 60 * 1000;
const TRANSFER_OWNERSHIP_RSD_COST = 250;
const AGE_ALPHA_DEFAULT_MAP_NATION = 'aesthene';

const CATALOG_PATH = path.join(__dirname, 'public', 'data', 'age-world-cities.json');
const WATER_ROUTES_PATH = path.join(__dirname, 'public', 'data', 'age-world-water-routes.json');
const CROSS_BORDER_ADJACENCY_PAD = 4;

let cityCatalogCache = null;
let cityByIdCache = null;
let waterRoutesCache = null;
let waterRoutePairIndex = null;

function cityBoxesTouch(bboxA, bboxB, pad = CROSS_BORDER_ADJACENCY_PAD) {
    if (!bboxA || !bboxB) return false;
    return !(
        bboxA.maxX + pad < bboxB.minX - pad
        || bboxB.maxX + pad < bboxA.minX - pad
        || bboxA.maxY + pad < bboxB.minY - pad
        || bboxB.maxY + pad < bboxA.minY - pad
    );
}

function catalogHasCrossBorderNeighbors(cities) {
    if (!Array.isArray(cities) || !cities.length) return false;
    const byId = new Map(cities.map((city) => [city.id, city]));
    for (const city of cities) {
        for (const neighborId of city.neighbors || []) {
            const neighbor = byId.get(neighborId);
            if (neighbor && neighbor.nationId !== city.nationId) return true;
        }
    }
    return false;
}

function augmentCrossBorderNeighbors(cities) {
    if (!Array.isArray(cities) || !cities.length || catalogHasCrossBorderNeighbors(cities)) {
        return;
    }

    for (let i = 0; i < cities.length; i += 1) {
        for (let j = i + 1; j < cities.length; j += 1) {
            const cityA = cities[i];
            const cityB = cities[j];
            if (!cityA || !cityB || cityA.nationId === cityB.nationId) continue;
            if (!cityBoxesTouch(cityA.bbox, cityB.bbox)) continue;

            if (!Array.isArray(cityA.neighbors)) cityA.neighbors = [];
            if (!Array.isArray(cityB.neighbors)) cityB.neighbors = [];
            if (!cityA.neighbors.includes(cityB.id)) cityA.neighbors.push(cityB.id);
            if (!cityB.neighbors.includes(cityA.id)) cityB.neighbors.push(cityA.id);
        }
    }
}

function loadCityCatalog() {
    if (cityCatalogCache) return cityCatalogCache;
    const raw = fs.readFileSync(CATALOG_PATH, 'utf8');
    cityCatalogCache = JSON.parse(raw);
    augmentCrossBorderNeighbors(cityCatalogCache.cities || []);
    cityByIdCache = null;
    return cityCatalogCache;
}

function getCityByIdMap() {
    if (cityByIdCache) return cityByIdCache;
    const catalog = loadCityCatalog();
    cityByIdCache = new Map();
    (catalog.cities || []).forEach((city) => {
        cityByIdCache.set(city.id, city);
    });
    return cityByIdCache;
}

function getCatalogCity(cityId) {
    return getCityByIdMap().get(String(cityId || '').trim()) || null;
}

function loadWaterRoutes() {
    if (waterRoutesCache) return waterRoutesCache;
    const raw = fs.readFileSync(WATER_ROUTES_PATH, 'utf8');
    waterRoutesCache = JSON.parse(raw);
    waterRoutePairIndex = null;
    return waterRoutesCache;
}

function waterRoutePairKey(cityAId, cityBId) {
    return [String(cityAId || ''), String(cityBId || '')].sort().join('::');
}

function getWaterRoutePairIndex() {
    if (waterRoutePairIndex) return waterRoutePairIndex;
    const payload = loadWaterRoutes();
    waterRoutePairIndex = new Map();
    (payload.routes || []).forEach((route) => {
        const fromId = String(route.fromCityId || '').trim();
        const toId = String(route.toCityId || '').trim();
        if (!fromId || !toId) return;
        waterRoutePairIndex.set(waterRoutePairKey(fromId, toId), route);
        if (route.bidirectional !== false) {
            waterRoutePairIndex.set(waterRoutePairKey(toId, fromId), route);
        }
    });
    return waterRoutePairIndex;
}

function findWaterRoute(cityAId, cityBId) {
    return getWaterRoutePairIndex().get(waterRoutePairKey(cityAId, cityBId)) || null;
}

const MAP_NATION_ID_ALIASES = {
    aesthine: 'aesthene'
};

function compactNationToken(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function resolveCatalogNationKey(rawNationKey) {
    let key = String(rawNationKey || '').trim().toLowerCase();
    if (!key) return '';

    if (MAP_NATION_ID_ALIASES[key]) {
        key = MAP_NATION_ID_ALIASES[key];
    }

    const catalog = loadCityCatalog();
    const nations = catalog.nations || [];
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

function resolveDefaultCapitalCityId(nationKey) {
    const needle = resolveCatalogNationKey(nationKey);
    if (!needle) return '';
    const catalog = loadCityCatalog();
    const capital = (catalog.cities || []).find(
        (city) => city.nationId === needle && city.isCapital
    );
    if (capital) return capital.id;
    const fallback = (catalog.cities || []).find((city) => city.nationId === needle);
    return fallback ? fallback.id : '';
}

function resolveMovementTargetCityId(rawCityId) {
    const id = String(rawCityId || '').trim();
    if (!id) return '';

    const direct = getCatalogCity(id);
    if (direct) return direct.id;

    const catalog = loadCityCatalog();
    const stub = id.replace(/^[^-]+-/, '');
    const match = (catalog.cities || []).find((city) => (
        city.id === id
        || city.id.endsWith(`-${stub}`)
        || city.id.endsWith(`-${id}`)
    ));
    return match ? match.id : id;
}

function resolveCatalogCityId(rawCityId, nationKey) {
    const catalog = loadCityCatalog();
    const nation = resolveCatalogNationKey(nationKey);
    const id = String(rawCityId || '').trim();

    if (id) {
        const direct = getCatalogCity(id);
        if (direct) return direct.id;

        if (nation) {
            const stub = id.replace(/^[^-]+-/, '');
            const match = (catalog.cities || []).find((city) => {
                if (city.nationId !== nation) return false;
                if (city.id === id || city.id === `${nation}-${id}` || city.id === `${nation}-${stub}`) {
                    return true;
                }
                return city.id.endsWith(`-${stub}`) || city.id.endsWith(`-${id}`);
            });
            if (match) return match.id;
        }
    }

    return resolveDefaultCapitalCityId(nationKey);
}

/** Most recent UTC half-hour tick (:00 or :30) at or before timestampMs. */
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

/** Next UTC half-hour tick (:00 or :30) strictly after timestampMs. */
function getNextMovePointTickBoundaryMs(timestampMs) {
    return getMovePointTickBoundaryMs(timestampMs) + MOVE_POINT_TICK_MS;
}

function normalizeArmyFocusValue(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'ranking' || normalized === 'rank' || normalized === 'rankdrop' || normalized === 'rank_drop') {
        return 'ranking';
    }
    if (normalized === 'pvp') return 'pvp';
    return '';
}

function computeArmyFocusFromStacks(stacks) {
    if (!Array.isArray(stacks) || !stacks.length) return '';

    let rankingWeight = 0;
    let pvpWeight = 0;

    stacks.forEach((stack) => {
        if (!stack || typeof stack !== 'object') return;
        const qty = Math.max(0, Math.floor(Number(stack.qty) || 0));
        if (!qty) return;

        const purpose = normalizeArmyFocusValue(stack.purpose || stack.role || stack.armyRole || '');
        if (purpose === 'ranking') rankingWeight += qty;
        else if (purpose === 'pvp') pvpWeight += qty;
    });

    if (!rankingWeight && !pvpWeight) return '';
    if (rankingWeight === pvpWeight) return '';
    return rankingWeight > pvpWeight ? 'ranking' : 'pvp';
}

function resolveCommanderArmyFocus(commander, movementRecord) {
    const fromMovement = normalizeArmyFocusValue(movementRecord?.armyFocus);
    if (fromMovement) return fromMovement;

    const explicit = normalizeArmyFocusValue(commander?.armyFocus);
    if (explicit) return explicit;

    const army = Array.isArray(commander?.ageArmy)
        ? commander.ageArmy
        : (Array.isArray(commander?.army) ? commander.army : []);
    return computeArmyFocusFromStacks(army);
}

function normalizeCommanderMovementRecord(raw, nationKey) {
    const record = raw && typeof raw === 'object' ? raw : {};
    const catalogCityId = resolveCatalogCityId(record.catalogCityId, nationKey);
    const movePoints = Math.max(
        0,
        Math.min(MOVE_POINTS_MAX, Math.floor(Number(record.movePoints ?? MOVE_POINTS_MAX)))
    );
    const lastMovePointRegenAt = record.lastMovePointRegenAt
        ? String(record.lastMovePointRegenAt)
        : new Date(getMovePointTickBoundaryMs(Date.now())).toISOString();
    const armyFocus = normalizeArmyFocusValue(record.armyFocus);
    return {
        catalogCityId,
        movePoints,
        lastMovePointRegenAt,
        armyFocus
    };
}

function getDefaultCommanderMovementRecord(nationKey) {
    return normalizeCommanderMovementRecord({}, nationKey);
}

function applyMovePointRegen(record, nowMs = Date.now()) {
    let movePoints = Math.max(
        0,
        Math.min(MOVE_POINTS_MAX, Math.floor(Number(record?.movePoints ?? MOVE_POINTS_MAX)))
    );

    if (movePoints >= MOVE_POINTS_MAX) {
        return {
            movePoints: MOVE_POINTS_MAX,
            lastMovePointRegenAt: new Date(getMovePointTickBoundaryMs(nowMs)).toISOString()
        };
    }

    let lastRegenMs = Date.parse(record?.lastMovePointRegenAt);
    if (!Number.isFinite(lastRegenMs)) {
        lastRegenMs = getMovePointTickBoundaryMs(nowMs);
    }

    let lastBoundary = getMovePointTickBoundaryMs(lastRegenMs);
    const currentBoundary = getMovePointTickBoundaryMs(nowMs);

    while (
        lastBoundary + MOVE_POINT_TICK_MS <= currentBoundary
        && movePoints < MOVE_POINTS_MAX
    ) {
        movePoints += MOVE_POINT_REGEN_PER_TICK;
        lastBoundary += MOVE_POINT_TICK_MS;
    }

    if (movePoints >= MOVE_POINTS_MAX) {
        lastBoundary = getMovePointTickBoundaryMs(nowMs);
    }

    return {
        movePoints: Math.min(MOVE_POINTS_MAX, movePoints),
        lastMovePointRegenAt: new Date(lastBoundary).toISOString()
    };
}

function spendMovePoint(record, nowMs = Date.now()) {
    return spendMovePoints(record, 1, nowMs);
}

function spendMovePoints(record, cost = 1, nowMs = Date.now()) {
    const moveCost = Math.max(1, Math.min(MOVE_POINTS_MAX, Math.floor(Number(cost) || 1)));
    const regen = applyMovePointRegen(record, nowMs);
    if (regen.movePoints < moveCost) {
        return { errorCode: 'NEXUS-AGE-001' };
    }

    const wasAtMax = regen.movePoints >= MOVE_POINTS_MAX;
    return {
        movePoints: regen.movePoints - moveCost,
        lastMovePointRegenAt: wasAtMax
            ? new Date(getMovePointTickBoundaryMs(nowMs)).toISOString()
            : regen.lastMovePointRegenAt
    };
}

function resolveCityHolder(city, cityHolders = {}) {
    if (!city) return '';
    const override = cityHolders[city.id];
    if (override) return String(override).trim().toLowerCase();
    return String(city.holderNationId || city.nationId || '').trim().toLowerCase();
}

function resolveCityLoser(city, cityLosers = {}) {
    if (!city) return '';
    const override = cityLosers[city.id];
    if (override) return String(override).trim().toLowerCase();
    return String(city.loserNationId || '').trim().toLowerCase();
}

function areCitiesAdjacent(cityAId, cityBId) {
    const cityA = getCatalogCity(cityAId);
    const cityB = getCatalogCity(cityBId);
    if (!cityA || !cityB) return false;
    if (cityA.id === cityB.id) return true;
    const aToB = Array.isArray(cityA.neighbors) && cityA.neighbors.includes(cityB.id);
    const bToA = Array.isArray(cityB.neighbors) && cityB.neighbors.includes(cityA.id);
    if (aToB || bToA) return true;
    if (cityA.nationId !== cityB.nationId && cityBoxesTouch(cityA.bbox, cityB.bbox)) return true;
    return false;
}

function listNationHeldCityIds(nationId, cityHolders = {}) {
    const nation = resolveCatalogNationKey(nationId) || String(nationId || '').trim().toLowerCase();
    if (!nation) return [];

    const ids = [];
    (loadCityCatalog().cities || []).forEach((city) => {
        if (resolveCityHolder(city, cityHolders) === nation) {
            ids.push(city.id);
        }
    });
    return ids;
}

function computeMinGraphDistanceFromCities(originCityIds, targetCityId) {
    const uniqueOrigins = [...new Set((Array.isArray(originCityIds) ? originCityIds : []).filter(Boolean))];
    const target = String(targetCityId || '').trim();
    if (!target || !uniqueOrigins.length) return null;
    if (uniqueOrigins.includes(target)) return 0;

    const visited = new Set(uniqueOrigins);
    const queue = uniqueOrigins.map((id) => ({ id, dist: 0 }));

    while (queue.length) {
        const { id, dist } = queue.shift();
        const city = getCatalogCity(id);
        if (!city) continue;

        for (const neighborId of city.neighbors || []) {
            if (neighborId === target) return dist + 1;
            if (!visited.has(neighborId)) {
                visited.add(neighborId);
                queue.push({ id: neighborId, dist: dist + 1 });
            }
        }
    }

    return null;
}

function resolveNationLastCapturedCity(nationId, cityHolders = {}, cityLosers = {}, cityCaptureAt = {}) {
    const nation = resolveCatalogNationKey(nationId) || String(nationId || '').trim().toLowerCase();
    if (!nation) return null;

    const holders = cityHolders && typeof cityHolders === 'object' ? cityHolders : {};
    const losers = cityLosers && typeof cityLosers === 'object' ? cityLosers : {};
    const captureAt = cityCaptureAt && typeof cityCaptureAt === 'object' ? cityCaptureAt : {};

    let bestCity = null;
    let bestAt = -1;
    let bestCityId = '';

    (loadCityCatalog().cities || []).forEach((city) => {
        if (resolveCityHolder(city, holders) !== nation) return;
        if (!resolveCityLoser(city, losers)) return;

        const capturedMs = Date.parse(captureAt[city.id] || '');
        const at = Number.isFinite(capturedMs) ? capturedMs : 0;
        if (at > bestAt || (at === bestAt && String(city.id) > bestCityId)) {
            bestCity = city;
            bestAt = at;
            bestCityId = String(city.id);
        }
    });

    return bestCity;
}

function computeNationBorderDistanceFromLastCapture(
    viewerNation,
    targetNation,
    cityHolders = {},
    cityLosers = {},
    cityCaptureAt = {}
) {
    const viewer = resolveCatalogNationKey(viewerNation) || String(viewerNation || '').trim().toLowerCase();
    const target = resolveCatalogNationKey(targetNation) || String(targetNation || '').trim().toLowerCase();
    if (!viewer || !target || viewer === target) return null;

    const viewerCities = listNationHeldCityIds(viewer, cityHolders);
    if (!viewerCities.length) return null;

    const anchorCity = resolveNationLastCapturedCity(target, cityHolders, cityLosers, cityCaptureAt);
    if (anchorCity) {
        const anchorDistance = computeMinGraphDistanceFromCities(viewerCities, anchorCity.id);
        if (anchorDistance !== null) return anchorDistance;
    }

    const targetCities = listNationHeldCityIds(target, cityHolders);
    let minDistance = null;
    targetCities.forEach((cityId) => {
        const distance = computeMinGraphDistanceFromCities(viewerCities, cityId);
        if (distance !== null && (minDistance === null || distance < minDistance)) {
            minDistance = distance;
        }
    });
    return minDistance;
}

function recordCityCapture(store, cityId, newHolderNationKey, previousHolderNationKey) {
    const id = String(cityId || '').trim();
    const holder = String(newHolderNationKey || '').trim().toLowerCase();
    const loser = String(previousHolderNationKey || '').trim().toLowerCase();
    if (!id || !holder) return store;

    if (!store.cityHolders || typeof store.cityHolders !== 'object') store.cityHolders = {};
    if (!store.cityLosers || typeof store.cityLosers !== 'object') store.cityLosers = {};
    if (!store.cityCaptureAt || typeof store.cityCaptureAt !== 'object') store.cityCaptureAt = {};

    store.cityHolders[id] = holder;
    store.cityLosers[id] = loser;
    store.cityCaptureAt[id] = new Date().toISOString();
    return store;
}

function resolveCityConnection(cityAId, cityBId) {
    const cityA = getCatalogCity(cityAId);
    const cityB = getCatalogCity(cityBId);
    if (!cityA || !cityB || cityA.id === cityB.id) return null;
    if (areCitiesAdjacent(cityA.id, cityB.id)) {
        return { type: 'land', movePointCost: 1 };
    }
    const route = findWaterRoute(cityA.id, cityB.id);
    if (!route) return null;
    return {
        type: 'water',
        movePointCost: Math.max(1, Math.min(3, Math.floor(Number(route.movePointCost) || 1))),
        routeId: route.id
    };
}

function classifyBorderRelationship(playerNation, targetCity, cityHolders, isAlliedFn) {
    const nation = resolveCatalogNationKey(playerNation) || String(playerNation || '').trim().toLowerCase();
    const holder = resolveCityHolder(targetCity, cityHolders);
    if (!nation || !targetCity) return 'unknown';
    if (holder === nation) return 'own';
    if (typeof isAlliedFn === 'function' && holder && isAlliedFn(nation, holder)) {
        return 'ally';
    }
    return 'hostile';
}

function validateBorderTarget(playerCityId, targetCityId) {
    const playerCity = getCatalogCity(String(playerCityId || '').trim());
    const targetCity = getCatalogCity(String(targetCityId || '').trim());
    if (!playerCity || !targetCity) {
        return { errorCode: 'NEXUS-AGE-003' };
    }
    if (playerCity.id === targetCity.id) {
        return { errorCode: 'NEXUS-AGE-009' };
    }
    const connection = resolveCityConnection(playerCity.id, targetCity.id);
    if (!connection) {
        return { errorCode: 'NEXUS-AGE-002' };
    }
    return { playerCity, targetCity, connection };
}

function validateTravel(playerNation, playerCityId, targetCityId, cityHolders) {
    if (!playerNation) return { errorCode: 'NEXUS-AGE-008' };
    const border = validateBorderTarget(playerCityId, targetCityId);
    if (border.errorCode) return border;

    const holder = resolveCityHolder(border.targetCity, cityHolders);
    const mapNation = resolveCatalogNationKey(playerNation) || String(playerNation || '').trim().toLowerCase();
    if (holder !== mapNation) {
        return { errorCode: 'NEXUS-AGE-006' };
    }

    return border;
}

function validateAssault(playerNation, playerCityId, targetCityId, cityHolders, isAlliedFn) {
    if (!playerNation) return { errorCode: 'NEXUS-AGE-008' };
    const border = validateBorderTarget(playerCityId, targetCityId);
    if (border.errorCode) return border;

    const relationship = classifyBorderRelationship(
        playerNation,
        border.targetCity,
        cityHolders,
        isAlliedFn
    );
    if (relationship === 'own') {
        return { errorCode: 'NEXUS-AGE-010' };
    }
    if (relationship === 'ally') {
        return { errorCode: 'NEXUS-AGE-005' };
    }

    return border;
}

function validateTransfer(playerNation, playerCityId, targetCityId, cityHolders, isAlliedFn) {
    if (!playerNation) return { errorCode: 'NEXUS-AGE-008' };
    const border = validateBorderTarget(playerCityId, targetCityId);
    if (border.errorCode) return border;

    const relationship = classifyBorderRelationship(
        playerNation,
        border.targetCity,
        cityHolders,
        isAlliedFn
    );
    if (relationship !== 'ally') {
        return { errorCode: 'NEXUS-AGE-007' };
    }

    return {
        ...border,
        allyNationId: resolveCityHolder(border.targetCity, cityHolders),
        transferRsdCost: TRANSFER_OWNERSHIP_RSD_COST
    };
}

function getMovePointRules() {
    return {
        movePointsMax: MOVE_POINTS_MAX,
        movePointRegenPerTick: MOVE_POINT_REGEN_PER_TICK,
        movePointTickMinutes: MOVE_POINT_TICK_MINUTES,
        movePointTickAlignUtc: true,
        transferOwnershipRsdCost: TRANSFER_OWNERSHIP_RSD_COST
    };
}

function buildBorderActionHints(playerNation, playerCityId, targetCityId, cityHolders, isAlliedFn) {
    const border = validateBorderTarget(playerCityId, targetCityId);
    if (border.errorCode) {
        return { canTravel: false, canAssault: false, canTransfer: false, canScout: false };
    }

    const relationship = classifyBorderRelationship(
        playerNation,
        border.targetCity,
        cityHolders,
        isAlliedFn
    );
    const movePointCost = border.connection?.movePointCost || 1;
    const isForeignBorder = relationship !== 'own';

    return {
        relationship,
        connectionType: border.connection?.type || 'land',
        canTravel: relationship === 'own',
        canAssault: relationship === 'hostile',
        canTransfer: relationship === 'ally',
        canScout: isForeignBorder,
        transferRsdCost: TRANSFER_OWNERSHIP_RSD_COST,
        movePointCost
    };
}

module.exports = {
    MOVE_POINTS_MAX,
    MOVE_POINT_REGEN_PER_TICK,
    MOVE_POINT_TICK_MINUTES,
    MOVE_POINT_TICK_MS,
    TRANSFER_OWNERSHIP_RSD_COST,
    AGE_ALPHA_DEFAULT_MAP_NATION,
    loadCityCatalog,
    getCatalogCity,
    resolveCatalogNationKey,
    resolveCatalogCityId,
    resolveMovementTargetCityId,
    resolveDefaultCapitalCityId,
    normalizeCommanderMovementRecord,
    normalizeArmyFocusValue,
    computeArmyFocusFromStacks,
    resolveCommanderArmyFocus,
    getDefaultCommanderMovementRecord,
    getMovePointTickBoundaryMs,
    getNextMovePointTickBoundaryMs,
    applyMovePointRegen,
    spendMovePoint,
    spendMovePoints,
    resolveCityConnection,
    findWaterRoute,
    resolveCityHolder,
    resolveCityLoser,
    listNationHeldCityIds,
    computeMinGraphDistanceFromCities,
    resolveNationLastCapturedCity,
    computeNationBorderDistanceFromLastCapture,
    recordCityCapture,
    areCitiesAdjacent,
    classifyBorderRelationship,
    validateBorderTarget,
    validateTravel,
    validateAssault,
    validateTransfer,
    getMovePointRules,
    buildBorderActionHints
};

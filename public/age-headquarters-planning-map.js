/**
 * RIFT — Headquarters SF planning mini-map (zoom/pan, diplomacy tinting, marker pills).
 */
(function initAgeHeadquartersPlanningMap(global) {
    'use strict';

    const DATA_URL = 'data/age-world-cities.json?v=thruun-cities-1';
    const REGION_PATHS_URL = 'data/age-world-region-paths.json?v=map-label-centroids-1';
    const NATION_PATHS_URL = 'data/game-nation-paths.json?v=veyanor-restore-1';
    const MAP_BG_SRC = 'images/amnekmap.png';
    const NATIVE_SIZE = 1642;
    const LERP = 0.08;
    const WHEEL_ZOOM_FACTOR = 0.00135;
    const MAX_ZOOM_MULT = 3.35;
    const CITY_FADE_START = 1.85;
    const CITY_FADE_FULL = 2.75;
    const REGION_BORDER_FADE_OUT_END = CITY_FADE_START + 0.18;
    const SMALL_CITY_SPAN = 26;
    const SMALL_CITY_HIT_RADIUS = 14;
    const BORDER_CITY_HIT_RADIUS = 22;
    const VIEWPORT_CLEAR_X = 0.24;
    const VIEWPORT_CLEAR_Y = 0.24;
    const VIEWPORT_FADE_OUTER = 0.46;
    const PILL_STACK_OFFSET_PX = 22;
    const PILL_LABEL_CLEARANCE_PX = 28;

    const PILL_MARKER_TYPES = new Set(['hold']);
    const ARROW_MARKER_TYPES = new Set(['sf', 'mf', 'move', 'taxi', 'temp-main']);
    const MP_LIMITED_ARROW_TYPES = new Set(['move', 'mf']);
    const IN_CITY_HOLD_ARROW_TYPES = new Set(['move', 'taxi']);
    const MAX_PLANNING_MOVE_MP = 3;

    const HQ_TINT = {
        own: { fill: 'rgba(255, 196, 48, 0.46)', stroke: 'rgba(255, 228, 120, 1)' },
        current: { fill: 'rgba(72, 220, 120, 0.52)', stroke: 'rgba(120, 255, 168, 1)' },
        ally: { fill: 'rgba(64, 128, 255, 0.44)', stroke: 'rgba(120, 176, 255, 1)' },
        neutral: { fill: 'rgba(255, 72, 72, 0.38)', stroke: 'rgba(255, 120, 120, 1)' },
        enemy: { fill: 'rgba(140, 16, 24, 0.55)', stroke: 'rgba(200, 40, 48, 1)' }
    };

    let hostEl = null;
    let frameEl = null;
    let canvasEl = null;
    let svgEl = null;
    let regionLayer = null;
    let nationLayer = null;
    let visualLayer = null;
    let ownershipLayer = null;
    let hitLayer = null;
    let highlightLayer = null;
    let waterRoutesLayer = null;
    let labelsRegion = null;
    let labelsCity = null;
    let pillsLayer = null;
    let arrowsLayer = null;

    let catalog = null;
    let regionPaths = [];
    let nationPaths = [];
    let cityById = new Map();
    let nationById = new Map();

    let baseScale = 1;
    let minScale = 1;
    let maxScale = 1;
    let scale = 1;
    let targetScale = 1;
    let tx = 0;
    let ty = 0;
    let targetTx = 0;
    let targetTy = 0;
    let rafId = 0;
    let dragging = false;
    let dragStart = null;
    let panMoved = false;
    let layoutBaseW = 0;
    let layoutBaseH = 0;
    let labelOpacities = { region: 0, city: 0 };
    let enabled = false;
    let bound = false;

    let playerMapCityId = '';
    let selectedBorderCityId = '';
    let activeMarkerType = '';
    let pills = [];
    let arrowMarkers = [];
    let pillIdCounter = 0;
    let arrowIdCounter = 0;

    let onBorderCitySelected = null;
    let onPillsChanged = null;
    let onMoveMfMpChanged = null;
    let onPlanningSyncRequested = null;
    let onPlanningPlacementBlocked = null;
    let planningSyncSuppressed = false;
    let planningLocked = false;

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function smoothstep(t) {
        const x = clamp(t, 0, 1);
        return x * x * (3 - 2 * x);
    }

    function fadeRange(ratio, start, end) {
        if (ratio <= start) return 0;
        if (ratio >= end) return 1;
        return smoothstep((ratio - start) / (end - start));
    }

    function scaleRatio() {
        return baseScale > 0 ? scale / baseScale : 1;
    }

    function mapOverlayHostRect() {
        const host = canvasEl || frameEl;
        if (!host) {
            return { left: 0, top: 0, width: 0, height: 0 };
        }
        const rect = host.getBoundingClientRect();
        return {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height
        };
    }

    function syncMapViewBox() {
        if (!svgEl) return;
        const vp = mapViewportMetrics();
        if (!scale || !vp.meetScale) return;

        const vbW = NATIVE_SIZE / scale;
        const vbH = NATIVE_SIZE / scale;
        const maxVbX = Math.max(0, NATIVE_SIZE - vbW);
        const maxVbY = Math.max(0, NATIVE_SIZE - vbH);
        const vbX = clamp((-tx / scale - vp.offsetX) / vp.meetScale, 0, maxVbX);
        const vbY = clamp((-ty / scale - vp.offsetY) / vp.meetScale, 0, maxVbY);
        const viewBox = `${vbX} ${vbY} ${vbW} ${vbH}`;
        svgEl.setAttribute('viewBox', viewBox);
    }

    function pathSpan(d) {
        const nums = String(d).match(/[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g);
        if (!nums || nums.length < 4) return 0;
        const values = nums.map(Number);
        const xs = [];
        const ys = [];
        for (let i = 0; i + 1 < values.length; i += 2) {
            xs.push(values[i]);
            ys.push(values[i + 1]);
        }
        if (!xs.length) return 0;
        return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    }

    function resolveCityOutlinePath(city) {
        return city.outlinePath || '';
    }

    function resolvePlayerNationForOwnership() {
        if (global.RoyalArmiesAgeMovement?.resolvePlayerNationId) {
            return global.RoyalArmiesAgeMovement.resolvePlayerNationId();
        }
        const city = global.RoyalArmiesAgeMovementPanel?.getCurrentCity?.();
        return String(city?.nationId || '').trim().toLowerCase();
    }

    function resolveLiveCityHolder(city) {
        if (global.RoyalArmiesAgeMovement?.resolveCityHolder) {
            return global.RoyalArmiesAgeMovement.resolveCityHolder(city);
        }
        return String(city?.holderNationId || city?.nationId || '').trim().toLowerCase();
    }

    function resolveWarNationIds() {
        if (typeof global.RoyalArmiesAgeMovement?.getWarNationIds === 'function') {
            return new Set(global.RoyalArmiesAgeMovement.getWarNationIds());
        }
        return new Set();
    }

    function resolvePlayerMapCityId() {
        const movementCityId = global.RoyalArmiesAgeMovement?.getCatalogCityId?.();
        if (movementCityId && cityById.has(movementCityId)) return movementCityId;
        const current = global.RoyalArmiesAgeMovementPanel?.getCurrentCity?.();
        if (!current || !catalog?.cities) return '';
        const capital = catalog.cities.find((city) => city.nationId === current.nationId && city.isCapital);
        return capital ? capital.id : '';
    }

    function isArrowMarkerType(type) {
        return ARROW_MARKER_TYPES.has(type);
    }

    function isPillMarkerType(type) {
        return PILL_MARKER_TYPES.has(type);
    }

    function cityHasHoldPill(cityId) {
        if (!cityId) return false;
        return pills.some((pill) => pill.cityId === cityId && pill.type === 'hold');
    }

    function canPlaceInCityHoldArrow(city, type) {
        if (!city || !cityHasHoldPill(city.id)) return false;
        return IN_CITY_HOLD_ARROW_TYPES.has(type);
    }

    function getTempMainArrow() {
        return arrowMarkers.find((arrow) => arrow.type === 'temp-main') || null;
    }

    function getTempMainCityId() {
        return getTempMainArrow()?.toCityId || '';
    }

    function resolveLegMovePointCost(fromCity, toCity) {
        if (!fromCity || !toCity) return Infinity;
        if (fromCity.id === toCity.id) return 0;

        if (global.RoyalArmiesAgeWaterRoutes?.resolveCityConnection) {
            const connection = global.RoyalArmiesAgeWaterRoutes.resolveCityConnection(fromCity, toCity);
            if (connection?.movePointCost) {
                return Math.max(1, Math.min(MAX_PLANNING_MOVE_MP, Math.floor(Number(connection.movePointCost)) || 1));
            }
        }

        if (citiesAreConnected(fromCity, toCity)) return 1;
        return Infinity;
    }

    function countTrailingMoveMfMpUsed() {
        const steps = getAllPlanningSteps();
        let mpUsed = 0;

        for (let i = steps.length - 1; i >= 0; i -= 1) {
            const step = steps[i];
            if (step.kind !== 'arrow' || !MP_LIMITED_ARROW_TYPES.has(step.type)) break;

            const fromCity = cityById.get(step.fromCityId);
            const toCity = cityById.get(step.toCityId);
            const legCost = resolveLegMovePointCost(fromCity, toCity);
            if (!Number.isFinite(legCost) || legCost <= 0) continue;
            mpUsed += legCost;
        }

        return mpUsed;
    }

    function getMoveMfMpBudget() {
        const used = countTrailingMoveMfMpUsed();
        return {
            used,
            max: MAX_PLANNING_MOVE_MP,
            remaining: Math.max(0, MAX_PLANNING_MOVE_MP - used)
        };
    }

    function notifyPlanningChanged() {
        if (typeof onPillsChanged === 'function') onPillsChanged(getAllPlanningSteps());
        if (typeof onMoveMfMpChanged === 'function') onMoveMfMpChanged(getMoveMfMpBudget());
        if (!planningLocked && !planningSyncSuppressed && typeof onPlanningSyncRequested === 'function') {
            onPlanningSyncRequested(getPlanningSnapshot());
        }
    }

    function getAllPlanningSteps() {
        const steps = pills.map((pill) => ({ kind: 'pill', ...pill }))
            .concat(arrowMarkers.map((arrow) => ({ kind: 'arrow', ...arrow })));
        return steps.sort((a, b) => a.order - b.order);
    }

    function getChainAnchorCityId() {
        const steps = getAllPlanningSteps();
        if (!steps.length) return playerMapCityId || '';
        const last = steps[steps.length - 1];
        return last.kind === 'pill' ? last.cityId : last.toCityId;
    }

    /** Owned/current staging cities in chain order — anchor first, then earlier endpoints. */
    function buildSfMfStagingSearchOrder() {
        const ordered = [];
        const seen = new Set();
        const push = (id) => {
            if (!id || seen.has(id)) return;
            seen.add(id);
            ordered.push(id);
        };

        const steps = getAllPlanningSteps();
        if (!steps.length) {
            push(playerMapCityId);
            return ordered;
        }

        const last = steps[steps.length - 1];
        push(last.kind === 'pill' ? last.cityId : last.toCityId);

        if (selectedBorderCityId) push(selectedBorderCityId);

        for (let i = steps.length - 1; i >= 0; i -= 1) {
            const step = steps[i];
            if (step.kind === 'pill') {
                push(step.cityId);
            } else {
                push(step.toCityId);
                push(step.fromCityId);
            }
        }
        push(playerMapCityId);
        return ordered;
    }

    function isMoveChainStagingCity(cityId) {
        if (!cityId) return false;
        if (cityId === playerMapCityId) return true;
        for (const step of getAllPlanningSteps()) {
            if (step.kind !== 'arrow' || step.type !== 'move') continue;
            if (step.toCityId === cityId || step.fromCityId === cityId) return true;
        }
        return false;
    }

    function isOwnedOrCurrentStagingCity(city) {
        if (!city) return false;
        const kind = resolveCityOwnershipKind(city);
        if (kind === 'own' || kind === 'current') return true;
        if (isMoveChainStagingCity(city.id)) return true;
        return cityHasHoldPill(city.id);
    }

    /** SF/MF may launch from owned cities, move-chain endpoints, or Hold cities that border the target. */
    function resolveSfMfOriginCityId(targetCity) {
        if (!targetCity) return '';
        for (const cityId of buildSfMfStagingSearchOrder()) {
            const stagingCity = cityById.get(cityId);
            if (!stagingCity || stagingCity.id === targetCity.id) continue;
            if (!isOwnedOrCurrentStagingCity(stagingCity)) continue;
            if (!citiesAreConnected(stagingCity, targetCity)) continue;
            return cityId;
        }
        return '';
    }

    function resolveArrowFromCityId(targetCity, type) {
        if (type === 'sf' || type === 'mf') {
            return resolveSfMfOriginCityId(targetCity);
        }
        if (type === 'temp-main') {
            return playerMapCityId || '';
        }
        if (targetCity && canPlaceInCityHoldArrow(targetCity, type) && getChainAnchorCityId() === targetCity.id) {
            return targetCity.id;
        }
        return getChainAnchorCityId();
    }

    function citiesAreConnected(cityA, cityB) {
        if (!cityA || !cityB || cityA.id === cityB.id) return false;

        const aToB = Array.isArray(cityA.neighbors) && cityA.neighbors.includes(cityB.id);
        const bToA = Array.isArray(cityB.neighbors) && cityB.neighbors.includes(cityA.id);
        if (aToB || bToA) return true;

        if (global.RoyalArmiesAgeWaterRoutes?.areCatalogCitiesAdjacent) {
            return global.RoyalArmiesAgeWaterRoutes.areCatalogCitiesAdjacent(cityA, cityB);
        }

        if (global.RoyalArmiesAgeWaterRoutes?.resolveCityConnection) {
            return Boolean(global.RoyalArmiesAgeWaterRoutes.resolveCityConnection(cityA, cityB));
        }

        return false;
    }

    function cityBordersPlayer(city) {
        if (!playerMapCityId || !city) return false;
        if (city.id === playerMapCityId) return false;

        const playerCity = cityById.get(playerMapCityId);
        if (!playerCity) return false;

        return citiesAreConnected(playerCity, city);
    }

    function getLastPlacedPill() {
        if (!pills.length) return null;
        return pills.reduce((latest, pill) => (pill.order > latest.order ? pill : latest));
    }

    function resolveStepCityId(step, edge) {
        if (step.kind === 'pill') return step.cityId;
        return edge === 'from' ? step.fromCityId : step.toCityId;
    }

    function buildArrowGeometry(fromCity, toCity) {
        if (!fromCity?.centroid || !toCity?.centroid) return null;

        const start = mapPointToFramePixels(fromCity.centroid.x, fromCity.centroid.y);
        const end = mapPointToFramePixels(toCity.centroid.x, toCity.centroid.y);

        if (fromCity.id === toCity.id) {
            const offset = 16;
            return {
                d: `M ${(start.x - offset).toFixed(2)} ${start.y.toFixed(2)} L ${(start.x + offset).toFixed(2)} ${start.y.toFixed(2)}`
            };
        }

        return {
            d: `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} L ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
        };
    }

    function canPlacePillAtCity(city) {
        if (!city || city.id === playerMapCityId) return false;

        const steps = getAllPlanningSteps();
        if (!steps.length) {
            return cityBordersPlayer(city);
        }

        const anchorId = getChainAnchorCityId();
        if (!anchorId) return cityBordersPlayer(city);
        if (anchorId === city.id) return true;

        const anchorCity = cityById.get(anchorId);
        if (!anchorCity) return cityBordersPlayer(city);

        return citiesAreConnected(anchorCity, city);
    }

    function canPlaceArrowAtCity(city, type) {
        return !describeArrowPlacementBlock(city, type);
    }

    function describeArrowPlacementBlock(city, type) {
        if (!city || !isArrowMarkerType(type)) return 'Invalid arrow placement.';

        if (type === 'sf' || type === 'mf') {
            const ownership = resolveCityOwnershipKind(city);
            if (ownership === 'own' || ownership === 'ally' || ownership === 'current') {
                return 'SF and MF arrows must target neutral or enemy cities.';
            }

            const fromId = resolveSfMfOriginCityId(city);
            const fromCity = cityById.get(fromId);
            if (!fromCity) {
                return 'No staging city borders that target — move or Hold on a city adjacent to it first.';
            }

            if (type === 'mf') {
                const legCost = resolveLegMovePointCost(fromCity, city);
                if (!Number.isFinite(legCost) || legCost <= 0) {
                    return 'No valid route to that city for Main Force.';
                }
                const budget = getMoveMfMpBudget();
                if (budget.used + legCost > MAX_PLANNING_MOVE_MP) {
                    return `Move chain is out of MP (${budget.used}/${MAX_PLANNING_MOVE_MP} used; this leg costs ${legCost}). Place SF or a Hold pill to start a new chain.`;
                }
            }
            return '';
        }

        if (type === 'temp-main') {
            if (!canPlaceTempMainAtCity(city)) {
                return 'Temp Main must be placed on an owned city other than your Main army city.';
            }
            return '';
        }

        const fromId = getChainAnchorCityId();
        const fromCity = cityById.get(fromId);
        if (!fromCity) return 'Place your first order from your Main army city or an existing chain step.';

        if (fromCity.id === city.id) {
            if (canPlaceInCityHoldArrow(city, type)) return '';
            return 'Pick a different city than your current chain endpoint, or place Hold here first for an in-city order.';
        }

        if (!citiesAreConnected(fromCity, city)) {
            const anchorName = fromCity.name || 'your chain endpoint';
            return `That city must border ${anchorName} — not only your Main army.`;
        }

        const ownership = resolveCityOwnershipKind(city);
        const fromOwnership = resolveCityOwnershipKind(fromCity);

        if (type === 'move' || type === 'taxi') {
            if (fromOwnership !== 'own' && fromOwnership !== 'current') {
                return 'Move and Taxi must continue from owned or current territory.';
            }
            if (ownership !== 'own' && ownership !== 'current') {
                return 'Move and Taxi arrows must end on owned or current territory.';
            }
            if (type === 'move') {
                const legCost = resolveLegMovePointCost(fromCity, city);
                if (!Number.isFinite(legCost) || legCost <= 0) {
                    return 'No valid route to that city for this move.';
                }
                const budget = getMoveMfMpBudget();
                if (budget.used + legCost > MAX_PLANNING_MOVE_MP) {
                    return `Move chain is out of MP (${budget.used}/${MAX_PLANNING_MOVE_MP} used; this leg costs ${legCost}). Place SF/MF or a Hold pill to start a new chain.`;
                }
            }
            return '';
        }

        return 'Invalid arrow placement.';
    }

    function notifyArrowPlacementBlocked(city, type) {
        const reason = describeArrowPlacementBlock(city, type);
        if (!reason) return;
        if (typeof onPlanningPlacementBlocked === 'function') {
            onPlanningPlacementBlocked(reason, type, city);
        }
    }

    function canPlaceTempMainAtCity(city) {
        if (!city || city.id === playerMapCityId) return false;

        const ownership = resolveCityOwnershipKind(city);
        return ownership === 'own';
    }

    function canHighlightCityForActiveTool(city) {
        if (!city) return false;
        if (activeMarkerType && isArrowMarkerType(activeMarkerType)) {
            return canPlaceArrowAtCity(city, activeMarkerType);
        }
        return canPlacePillAtCity(city);
    }

    function canSelectPlanningCity(city) {
        return canPlacePillAtCity(city);
    }

    function isSelectedCityPlannable() {
        if (!selectedBorderCityId) return false;
        if (activeMarkerType && isPillMarkerType(activeMarkerType)) {
            return canPlacePillAtCity(cityById.get(selectedBorderCityId));
        }
        return canPlacePillAtCity(cityById.get(selectedBorderCityId));
    }

    /** @deprecated use cityBordersPlayer — kept for callers expecting this name */
    function playerBordersCity(city) {
        return cityBordersPlayer(city);
    }

    function isPlanningMapPanBlockedTarget(target) {
        if (!target || typeof target.closest !== 'function') return false;
        return Boolean(
            target.closest('.age-hq-planning-pill')
            || target.closest('.age-hq-city-hit-path')
        );
    }

    function handleMapCityClick(event, didPan) {
        if (!enabled || planningLocked || didPan || event?.button !== 0) return;
        let cityId = resolveCityHitTarget(event.target);
        if (!cityId) {
            const pillNode = event.target.closest?.('.age-hq-planning-pill[data-city-id]');
            if (pillNode && activeMarkerType && isArrowMarkerType(activeMarkerType)) {
                cityId = pillNode.dataset.cityId || '';
            }
        }
        if (!cityId) return;
        const city = cityById.get(cityId);
        if (!city) return;

        if (activeMarkerType && isArrowMarkerType(activeMarkerType)) {
            if (!canPlaceArrowAtCity(city, activeMarkerType)) {
                notifyArrowPlacementBlocked(city, activeMarkerType);
                return;
            }
            addArrowMarker(resolveArrowFromCityId(city, activeMarkerType), cityId, activeMarkerType);
            return;
        }

        if (!canPlacePillAtCity(city)) return;
        setSelectedBorderCity(cityId);
    }

    function resolveCityOwnershipKind(city) {
        if (!city) return 'neutral';
        if (city.id === playerMapCityId) return 'current';

        const playerNation = resolvePlayerNationForOwnership();
        const holder = resolveLiveCityHolder(city);
        const allied = new Set(global.RoyalArmiesAgeMovement?.getAlliedNationIds?.() || []);
        const atWar = resolveWarNationIds();

        if (playerNation && holder === playerNation) return 'own';
        if (holder && allied.has(holder)) return 'ally';
        if (holder && atWar.has(holder)) return 'enemy';
        return 'neutral';
    }

    function mapViewportMetrics() {
        const canvasW = canvasEl?.clientWidth || layoutBaseW;
        const canvasH = canvasEl?.clientHeight || layoutBaseH;
        if (!canvasW || !canvasH) {
            return { canvasW: 0, canvasH: 0, meetScale: 0, offsetX: 0, offsetY: 0 };
        }
        const meetScale = Math.min(canvasW / NATIVE_SIZE, canvasH / NATIVE_SIZE);
        const renderW = NATIVE_SIZE * meetScale;
        const renderH = NATIVE_SIZE * meetScale;
        return {
            canvasW,
            canvasH,
            meetScale,
            offsetX: (canvasW - renderW) / 2,
            offsetY: (canvasH - renderH) / 2
        };
    }

    function mapPointToFramePixels(mapX, mapY) {
        if (!svgEl) {
            return { x: 0, y: 0 };
        }

        const point = svgEl.createSVGPoint();
        point.x = mapX;
        point.y = mapY;
        const matrix = svgEl.getScreenCTM();
        if (!matrix) {
            return { x: 0, y: 0 };
        }

        const screen = point.matrixTransform(matrix);
        const hostRect = mapOverlayHostRect();
        return {
            x: screen.x - hostRect.left,
            y: screen.y - hostRect.top
        };
    }

    function resolveLabelOpacities(ratio) {
        const cityIn = fadeRange(ratio, CITY_FADE_START, CITY_FADE_FULL);
        return {
            region: 1 - cityIn,
            city: cityIn
        };
    }

    function resolveLabelViewportFade(frameX, frameY, frameW, frameH) {
        const centerX = frameW / 2;
        const centerY = frameH / 2;
        const clearHalfW = frameW * VIEWPORT_CLEAR_X;
        const clearHalfH = frameH * VIEWPORT_CLEAR_Y;
        const dx = Math.max(0, Math.abs(frameX - centerX) - clearHalfW);
        const dy = Math.max(0, Math.abs(frameY - centerY) - clearHalfH);
        const dist = Math.hypot(dx, dy);
        const fadeEnd = Math.min(frameW, frameH) * VIEWPORT_FADE_OUTER;
        if (dist <= 0) return 1;
        if (dist >= fadeEnd) return 0;
        return 1 - smoothstep(dist / fadeEnd);
    }

    function measureLayoutBase() {
        if (!canvasEl) return;
        const prev = canvasEl.style.transform;
        canvasEl.style.transform = 'translate3d(0px, 0px, 0) scale(1)';
        layoutBaseW = canvasEl.clientWidth;
        layoutBaseH = canvasEl.clientHeight;
        canvasEl.style.transform = prev;
    }

    function clampTargets() {
        targetScale = clamp(targetScale, minScale, maxScale);
        if (!layoutBaseW || !layoutBaseH) measureLayoutBase();
        const vp = mapViewportMetrics();
        const vbW = NATIVE_SIZE / targetScale;
        const vbH = NATIVE_SIZE / targetScale;
        const maxVbX = Math.max(0, NATIVE_SIZE - vbW);
        const maxVbY = Math.max(0, NATIVE_SIZE - vbH);
        const minTx = -targetScale * (maxVbX * vp.meetScale + vp.offsetX);
        const minTy = -targetScale * (maxVbY * vp.meetScale + vp.offsetY);
        const maxTx = -targetScale * vp.offsetX;
        const maxTy = -targetScale * vp.offsetY;
        targetTx = clamp(targetTx, minTx, maxTx);
        targetTy = clamp(targetTy, minTy, maxTy);
    }

    function applyTransform() {
        if (!canvasEl) return;
        canvasEl.style.transform = '';
        syncMapViewBox();
        labelOpacities = resolveLabelOpacities(scaleRatio());
        syncLabelLayers();
        syncBorderVisuals();
        syncOwnershipVisuals();
        syncPillPositions();
        syncArrowPaths();
    }

    function zoomAt(clientX, clientY, deltaY) {
        if (!frameEl) return;
        const frameRect = frameEl.getBoundingClientRect();
        const px = clientX - frameRect.left;
        const py = clientY - frameRect.top;
        const worldX = (px - tx) / scale;
        const worldY = (py - ty) / scale;
        const zoomDelta = -deltaY * WHEEL_ZOOM_FACTOR * targetScale;
        const nextScale = clamp(targetScale + zoomDelta, minScale, maxScale);
        targetTx = px - worldX * nextScale;
        targetTy = py - worldY * nextScale;
        targetScale = nextScale;
        clampTargets();
        scheduleTick();
    }

    function tick() {
        const ds = targetScale - scale;
        const dx = targetTx - tx;
        const dy = targetTy - ty;
        scale += ds * LERP;
        tx += dx * LERP;
        ty += dy * LERP;

        if (Math.abs(ds) < 0.0004 && Math.abs(dx) < 0.25 && Math.abs(dy) < 0.25) {
            scale = targetScale;
            tx = targetTx;
            ty = targetTy;
            rafId = 0;
        } else {
            rafId = global.requestAnimationFrame(tick);
        }
        applyTransform();
    }

    function scheduleTick() {
        if (!rafId) rafId = global.requestAnimationFrame(tick);
    }

    function recomputeBaseScale() {
        if (!frameEl || !canvasEl) return;
        measureLayoutBase();
        baseScale = 1;
        minScale = 1;
        maxScale = MAX_ZOOM_MULT;
        scale = 1;
        targetScale = 1;
        tx = 0;
        ty = 0;
        targetTx = 0;
        targetTy = 0;
        clampTargets();
        applyTransform();
    }

    function appendBorderPaths(layer, records, className, idKey, centroidLookup) {
        if (!layer) return;
        layer.innerHTML = '';
        records.forEach((record) => {
            const paths = Array.isArray(record.paths) ? record.paths : record.d ? [record.d] : [];
            if (!paths.length) return;

            const group = global.document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.setAttribute('class', className);
            const recordId = record[idKey] || record.id;
            if (recordId) group.dataset[idKey] = recordId;

            const centroid = centroidLookup
                ? (typeof centroidLookup === 'function' ? centroidLookup(record) : centroidLookup.get(recordId))
                : record.centroid;
            if (centroid) {
                group.dataset.centroidX = String(centroid.x);
                group.dataset.centroidY = String(centroid.y);
            }

            paths.forEach((d) => {
                const pathEl = global.document.createElementNS('http://www.w3.org/2000/svg', 'path');
                pathEl.setAttribute('d', d);
                pathEl.setAttribute('vector-effect', 'non-scaling-stroke');
                group.appendChild(pathEl);
            });
            layer.appendChild(group);
        });
    }

    function resolveRegionPathDataList(region) {
        if (!region) return [];
        if (Array.isArray(region.paths) && region.paths.length) return region.paths;
        if (region.d) return [region.d];
        return [];
    }

    function resolveSvgPathDataBBoxCenter(pathDataList, svgRoot) {
        if (!svgRoot || !pathDataList?.length) return null;

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let measured = false;

        pathDataList.forEach((pathData) => {
            if (!pathData) return;
            const pathEl = global.document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathEl.setAttribute('d', pathData);
            svgRoot.appendChild(pathEl);
            try {
                const box = pathEl.getBBox();
                if (!Number.isFinite(box.width) || !Number.isFinite(box.height)) return;
                minX = Math.min(minX, box.x);
                minY = Math.min(minY, box.y);
                maxX = Math.max(maxX, box.x + box.width);
                maxY = Math.max(maxY, box.y + box.height);
                measured = true;
            } catch (err) {
                // Unmeasurable path segment — skip.
            } finally {
                pathEl.remove();
            }
        });

        if (!measured) return null;
        return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    }

    function resolveRegionBorderCentroid(regionOrId) {
        const region = typeof regionOrId === 'string'
            ? regionPaths.find((entry) => (entry.regionId || entry.id) === regionOrId)
            : regionOrId;
        const regionId = region?.regionId || region?.id || (typeof regionOrId === 'string' ? regionOrId : '');
        if (!regionId) return null;

        if (regionLayer) {
            const group = regionLayer.querySelector(
                `.age-hq-region-border[data-region-id="${CSS.escape(regionId)}"]`
            );
            if (group) {
                const pathDataList = Array.from(group.querySelectorAll('path'))
                    .map((pathEl) => pathEl.getAttribute('d') || '')
                    .filter(Boolean);
                const center = resolveSvgPathDataBBoxCenter(pathDataList, svgEl);
                if (center) return center;
            }
        }

        if (region && svgEl) {
            return resolveSvgPathDataBBoxCenter(resolveRegionPathDataList(region), svgEl);
        }

        return null;
    }

    function buildRegionCentroidMap() {
        const centroids = new Map();
        regionPaths.forEach((region) => {
            const regionId = region.regionId || region.id;
            const centroid = resolveRegionBorderCentroid(region);
            if (regionId && centroid) centroids.set(regionId, centroid);
        });
        return centroids;
    }

    function applyBorderElementOpacity(node, mapX, mapY, tierOpacity, frameW, frameH) {
        const point = mapPointToFramePixels(mapX, mapY);
        const viewportFade = resolveLabelViewportFade(point.x, point.y, frameW, frameH);
        const opacity = tierOpacity * viewportFade;
        node.style.opacity = String(opacity);
        node.style.visibility = opacity > 0.02 ? 'visible' : 'hidden';
    }

    function syncBorderLayer(layer, tierOpacity, frameW, frameH) {
        if (!layer) return;
        layer.querySelectorAll('[data-centroid-x][data-centroid-y]').forEach((node) => {
            applyBorderElementOpacity(
                node,
                Number(node.dataset.centroidX),
                Number(node.dataset.centroidY),
                tierOpacity,
                frameW,
                frameH
            );
        });
    }

    function syncRegionBorderLayer(layer, tierOpacity, frameW, frameH) {
        if (!layer) return;
        layer.querySelectorAll('.age-hq-region-border').forEach((group) => {
            const mapX = Number(group.dataset.centroidX);
            const mapY = Number(group.dataset.centroidY);
            let opacity = tierOpacity;
            if (Number.isFinite(mapX) && Number.isFinite(mapY)) {
                const point = mapPointToFramePixels(mapX, mapY);
                const viewportFade = resolveLabelViewportFade(point.x, point.y, frameW, frameH);
                opacity = tierOpacity * viewportFade;
            }
            group.style.opacity = String(opacity);
            group.style.visibility = opacity > 0.02 ? 'visible' : 'hidden';
        });
    }

    function resolveRegionBorderOpacity(ratio) {
        return 1 - fadeRange(ratio, CITY_FADE_START, REGION_BORDER_FADE_OUT_END);
    }

    function resolveWaterRouteOpacity(ratio) {
        return 1 - fadeRange(ratio, CITY_FADE_START, REGION_BORDER_FADE_OUT_END);
    }

    function syncBorderVisuals() {
        if (!frameEl) return;
        const hostW = frameEl.clientWidth;
        const hostH = frameEl.clientHeight;
        const ratio = scaleRatio();
        const borderOpacities = {
            region: resolveRegionBorderOpacity(ratio),
            nation: 0,
            city: resolveLabelOpacities(ratio).city
        };
        const waterRouteOpacity = resolveWaterRouteOpacity(ratio);
        syncRegionBorderLayer(regionLayer, borderOpacities.region, hostW, hostH);
        syncBorderLayer(nationLayer, borderOpacities.nation, hostW, hostH);
        syncBorderLayer(visualLayer, borderOpacities.city, hostW, hostH);
        syncBorderLayer(waterRoutesLayer, waterRouteOpacity, hostW, hostH);
    }

    function buildWaterRoutesLayer() {
        if (!waterRoutesLayer || !global.RoyalArmiesAgeWaterRoutes) return;
        waterRoutesLayer.innerHTML = '';

        const routes = global.RoyalArmiesAgeWaterRoutes.getRoutes();
        if (!routes.length) return;

        const frag = global.document.createDocumentFragment();
        routes.forEach((route) => {
            const geom = global.RoyalArmiesAgeWaterRoutes.resolveRouteGeometry(route, cityById);
            if (!geom) return;

            const group = global.document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.setAttribute('class', 'age-world-water-route');
            group.dataset.centroidX = String(geom.labelX);
            group.dataset.centroidY = String(geom.labelY);

            const track = global.document.createElementNS('http://www.w3.org/2000/svg', 'path');
            track.setAttribute('class', 'age-world-water-route-path age-world-water-route-path--track');
            track.setAttribute('d', geom.pathD);
            track.setAttribute('vector-effect', 'non-scaling-stroke');

            const march = global.document.createElementNS('http://www.w3.org/2000/svg', 'path');
            march.setAttribute('class', 'age-world-water-route-path age-world-water-route-path--march');
            march.setAttribute('d', geom.pathD);
            march.setAttribute('vector-effect', 'non-scaling-stroke');

            const badge = global.document.createElementNS('http://www.w3.org/2000/svg', 'g');
            badge.setAttribute('class', 'age-world-water-route-cost');
            badge.setAttribute('transform', `translate(${geom.labelX.toFixed(2)} ${geom.labelY.toFixed(2)})`);

            const badgeRect = global.document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            badgeRect.setAttribute('class', 'age-world-water-route-cost-bg');
            badgeRect.setAttribute('x', '-16');
            badgeRect.setAttribute('y', '-9');
            badgeRect.setAttribute('width', '32');
            badgeRect.setAttribute('height', '18');
            badgeRect.setAttribute('rx', '9');

            const badgeText = global.document.createElementNS('http://www.w3.org/2000/svg', 'text');
            badgeText.setAttribute('class', 'age-world-water-route-cost-label');
            badgeText.setAttribute('text-anchor', 'middle');
            badgeText.setAttribute('dominant-baseline', 'middle');
            badgeText.textContent = `${geom.movePointCost} MP`;

            badge.appendChild(badgeRect);
            badge.appendChild(badgeText);
            group.appendChild(track);
            group.appendChild(march);
            group.appendChild(badge);
            frag.appendChild(group);
        });

        waterRoutesLayer.appendChild(frag);
    }

    function applyOwnershipTint(node, kind) {
        const palette = HQ_TINT[kind] || HQ_TINT.neutral;
        node.setAttribute('fill', palette.fill);
        node.setAttribute('stroke', palette.stroke);
        node.setAttribute('stroke-width', '2.5');
        node.style.opacity = '1';
        node.style.visibility = 'visible';
    }

    function syncOwnershipVisuals() {
        if (!ownershipLayer) return;
        ownershipLayer.querySelectorAll('.age-hq-city-ownership-path').forEach((node) => {
            const cityId = node.getAttribute('data-city-id');
            const city = cityById.get(cityId);
            applyOwnershipTint(node, resolveCityOwnershipKind(city));
        });
    }

    function syncLabelHostPositions(container, tierOpacity) {
        if (!container || !frameEl || tierOpacity <= 0.02) {
            if (container) container.style.opacity = '0';
            return;
        }
        container.style.opacity = String(tierOpacity);
        const hostW = frameEl.clientWidth;
        const hostH = frameEl.clientHeight;
        container.querySelectorAll('.age-hq-map-label[data-centroid-x]').forEach((node) => {
            const point = mapPointToFramePixels(Number(node.dataset.centroidX), Number(node.dataset.centroidY));
            node.style.left = `${point.x}px`;
            node.style.top = `${point.y}px`;
            const offsetX = Number(node.dataset.offsetX || 0);
            const offsetY = Number(node.dataset.offsetY || 0);
            const viewportFade = resolveLabelViewportFade(point.x + offsetX, point.y + offsetY, hostW, hostH);
            node.style.opacity = String(viewportFade);
            node.style.visibility = viewportFade > 0.02 ? 'visible' : 'hidden';
        });
    }

    function syncLabelLayers() {
        syncLabelHostPositions(labelsRegion, labelOpacities.region);
        syncLabelHostPositions(labelsCity, labelOpacities.city);
    }

    function buildCityLayers() {
        if (!catalog?.cities || !visualLayer || !hitLayer || !ownershipLayer || !highlightLayer) return;

        visualLayer.innerHTML = '';
        hitLayer.innerHTML = '';
        ownershipLayer.innerHTML = '';
        highlightLayer.innerHTML = '';
        if (labelsCity) labelsCity.innerHTML = '';

        const visualFrag = global.document.createDocumentFragment();
        const hitFrag = global.document.createDocumentFragment();
        const ownershipFrag = global.document.createDocumentFragment();

        catalog.cities.forEach((city) => {
            const outlineD = resolveCityOutlinePath(city);
            if (!outlineD) return;

            const visualPath = global.document.createElementNS('http://www.w3.org/2000/svg', 'path');
            visualPath.setAttribute('class', 'age-hq-city-visual-path');
            visualPath.setAttribute('d', outlineD);
            visualPath.setAttribute('vector-effect', 'non-scaling-stroke');
            visualPath.dataset.centroidX = String(city.centroid?.x || 0);
            visualPath.dataset.centroidY = String(city.centroid?.y || 0);
            visualFrag.appendChild(visualPath);

            const ownershipPath = global.document.createElementNS('http://www.w3.org/2000/svg', 'path');
            ownershipPath.setAttribute('class', 'age-hq-city-ownership-path');
            ownershipPath.setAttribute('data-city-id', city.id);
            ownershipPath.setAttribute('d', outlineD);
            ownershipPath.setAttribute('vector-effect', 'non-scaling-stroke');
            ownershipFrag.appendChild(ownershipPath);

            const hitPath = global.document.createElementNS('http://www.w3.org/2000/svg', 'path');
            hitPath.setAttribute('class', 'age-hq-city-hit-path');
            hitPath.setAttribute('data-city-id', city.id);
            hitPath.setAttribute('d', outlineD);
            hitPath.setAttribute('vector-effect', 'non-scaling-stroke');
            hitFrag.appendChild(hitPath);

            const needsHitBoost = city.centroid && (
                pathSpan(outlineD) < SMALL_CITY_SPAN
                || canHighlightCityForActiveTool(city)
            );
            if (needsHitBoost) {
                const hitCircle = global.document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                hitCircle.setAttribute('class', 'age-hq-city-hit-path age-hq-city-hit-boost');
                hitCircle.setAttribute('data-city-id', city.id);
                hitCircle.setAttribute('cx', String(city.centroid.x));
                hitCircle.setAttribute('cy', String(city.centroid.y));
                hitCircle.setAttribute(
                    'r',
                    String(canHighlightCityForActiveTool(city) ? BORDER_CITY_HIT_RADIUS : SMALL_CITY_HIT_RADIUS)
                );
                hitFrag.appendChild(hitCircle);
            }

            if (labelsCity && city.centroid && city.name) {
                const label = global.document.createElement('div');
                label.className = 'age-hq-map-label age-hq-map-label--city';
                label.dataset.centroidX = String(city.centroid.x);
                label.dataset.centroidY = String(city.centroid.y);
                label.dataset.offsetX = '0';
                label.dataset.offsetY = '-18';
                label.innerHTML = `<span class="age-hq-map-label-title">${city.name}</span>`;
                labelsCity.appendChild(label);
            }
        });

        visualLayer.appendChild(visualFrag);
        hitLayer.appendChild(hitFrag);
        ownershipLayer.appendChild(ownershipFrag);
        syncOwnershipVisuals();
    }

    function buildRegionLabels() {
        if (!labelsRegion) return;
        labelsRegion.innerHTML = '';
        regionPaths.forEach((region) => {
            const regionId = region.regionId || region.id;
            const centroid = resolveRegionBorderCentroid(region);
            const name = region.name;
            if (!centroid || !name) return;
            const label = global.document.createElement('div');
            label.className = 'age-hq-map-label age-hq-map-label--region';
            label.dataset.centroidX = String(centroid.x);
            label.dataset.centroidY = String(centroid.y);
            label.innerHTML = `<span class="age-hq-map-label-title">${name}</span>`;
            labelsRegion.appendChild(label);
        });
    }

    function resolveCityHitTarget(target) {
        const node = target?.closest?.('.age-hq-city-hit-path[data-city-id]');
        return node?.dataset.cityId || '';
    }

    function setSelectedBorderCity(cityId) {
        selectedBorderCityId = cityId || '';
        if (hitLayer) {
            hitLayer.querySelectorAll('.age-hq-city-hit-path.is-selected').forEach((node) => {
                node.classList.remove('is-selected');
            });
            if (selectedBorderCityId) {
                hitLayer.querySelectorAll(`.age-hq-city-hit-path[data-city-id="${selectedBorderCityId}"]`).forEach((node) => {
                    node.classList.add('is-selected');
                });
            }
        }
        if (typeof onBorderCitySelected === 'function') {
            onBorderCitySelected(selectedBorderCityId, cityById.get(selectedBorderCityId) || null);
        }
    }

    function pillLabelFor(type) {
        if (type === 'hold') return 'Hold';
        return type;
    }

    function arrowLabelFor(type) {
        if (type === 'sf') return 'SF';
        if (type === 'mf') return 'MF';
        if (type === 'move') return 'Move';
        if (type === 'taxi') return 'Taxi';
        if (type === 'temp-main') return 'Temp Main';
        return type;
    }

    function normalizeStoredArrow(arrow) {
        if (!arrow || typeof arrow !== 'object') return arrow;
        if (arrow.type === 'sf') {
            return { ...arrow, label: 'SF' };
        }
        return arrow;
    }

    function nextPlanningOrder() {
        const orders = getAllPlanningSteps().map((step) => Math.max(0, Math.floor(Number(step.order) || 0)));
        if (!orders.length) return 0;
        return Math.max(...orders) + 1;
    }

    function pillsAtCity(cityId) {
        return pills.filter((pill) => pill.cityId === cityId);
    }

    function resolvePillStackIndex(pill) {
        const sameCity = pillsAtCity(pill.cityId);
        return sameCity.findIndex((entry) => entry.id === pill.id);
    }

    function resolvePillOffsetPx(pill) {
        const stackIndex = resolvePillStackIndex(pill);
        const city = cityById.get(pill.cityId);
        const baseX = 12;
        let baseY = -16 - stackIndex * PILL_STACK_OFFSET_PX;

        if (city?.centroid && labelsCity) {
            const label = labelsCity.querySelector(`.age-hq-map-label--city[data-centroid-x="${city.centroid.x}"][data-centroid-y="${city.centroid.y}"]`);
            if (label) {
                const point = mapPointToFramePixels(city.centroid.x, city.centroid.y);
                const labelRect = label.getBoundingClientRect();
                const frameRect = frameEl.getBoundingClientRect();
                const labelBottom = labelRect.bottom - frameRect.top;
                const pillTop = point.y + baseY;
                if (pillTop < labelBottom + PILL_LABEL_CLEARANCE_PX) {
                    baseY = labelBottom + PILL_LABEL_CLEARANCE_PX - point.y;
                }
            }
        }

        return { x: baseX, y: baseY };
    }

    function renderPills() {
        if (!pillsLayer) return;
        pillsLayer.innerHTML = '';

        pills.forEach((pill) => {
            const city = cityById.get(pill.cityId);
            if (!city?.centroid) return;
            if (!isPillMarkerType(pill.type)) return;

            const button = global.document.createElement('button');
            button.type = 'button';
            button.className = `age-hq-planning-pill age-hq-planning-pill--${pill.type}`;
            button.dataset.pillId = pill.id;
            button.dataset.cityId = pill.cityId;
            button.title = 'Click to replace Hold marker';
            button.textContent = pillLabelFor(pill.type);
            pillsLayer.appendChild(button);
        });

        renderArmyLocationMarkers();

        syncPillPositions();
        syncArrowPaths();
        buildCityLayers();
        if (selectedBorderCityId) {
            setSelectedBorderCity(selectedBorderCityId);
        }
    }

    function renderArmyLocationMarker(cityId, type, label, title) {
        const city = cityById.get(cityId);
        if (!city?.centroid || !pillsLayer) return;

        const node = global.document.createElement('div');
        node.className = `age-hq-planning-pill age-hq-army-location-marker age-hq-planning-pill--${type}`;
        node.dataset.cityId = cityId;
        node.dataset.armyMarker = type;
        node.title = title;
        node.setAttribute('role', 'img');
        node.setAttribute('aria-label', label);
        node.textContent = label;
        pillsLayer.appendChild(node);
    }

    function renderArmyLocationMarkers() {
        if (!playerMapCityId) return;

        renderArmyLocationMarker(
            playerMapCityId,
            'main',
            'Main',
            'Primary main army location'
        );
    }

    function renderPlanningMarkers() {
        renderPills();
    }

    function syncPillPositions() {
        if (!pillsLayer || !frameEl) return;
        pillsLayer.querySelectorAll('.age-hq-planning-pill').forEach((node) => {
            const pill = pills.find((entry) => entry.id === node.dataset.pillId);
            const cityId = pill?.cityId || node.dataset.cityId;
            const city = cityById.get(cityId || '');
            if (!city?.centroid) return;

            const point = mapPointToFramePixels(city.centroid.x, city.centroid.y);
            let offsetX = 12;
            let offsetY = -16;

            if (pill) {
                const offset = resolvePillOffsetPx(pill);
                offsetX = offset.x;
                offsetY = offset.y;
            } else if (node.dataset.armyMarker === 'main') {
                offsetX = -42;
                offsetY = -18;
            } else if (node.dataset.armyMarker === 'temp-main') {
                offsetX = 12;
                offsetY = -34;
            }

            node.style.left = `${Math.round(point.x + offsetX)}px`;
            node.style.top = `${Math.round(point.y + offsetY)}px`;
        });
    }

    function appendArrowStrokes(d, variant, frag, withHead) {
        const shadow = global.document.createElementNS('http://www.w3.org/2000/svg', 'path');
        shadow.setAttribute('class', `age-hq-planning-arrow age-hq-planning-arrow--shadow age-hq-planning-arrow--${variant}`);
        shadow.setAttribute('d', d);
        frag.appendChild(shadow);

        const main = global.document.createElementNS('http://www.w3.org/2000/svg', 'path');
        main.setAttribute('class', `age-hq-planning-arrow age-hq-planning-arrow--main age-hq-planning-arrow--${variant}`);
        main.setAttribute('d', d);
        if (withHead) {
            main.setAttribute('marker-end', 'url(#age-hq-arrowhead)');
        }
        frag.appendChild(main);
    }

    function appendPlainConnector(fromCityId, toCityId, frag) {
        const fromCity = cityById.get(fromCityId);
        const toCity = cityById.get(toCityId);
        const geom = buildArrowGeometry(fromCity, toCity);
        if (!geom) return;

        appendArrowStrokes(geom.d, 'link', frag, true);
    }

    function appendLabeledArrow(arrow, frag, defsFrag) {
        const fromCity = cityById.get(arrow.fromCityId);
        const toCity = cityById.get(arrow.toCityId);
        const geom = buildArrowGeometry(fromCity, toCity);
        if (!geom) return;

        const pathId = `age-hq-arrow-path-${arrow.id}`;
        const pathDef = global.document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathDef.setAttribute('id', pathId);
        pathDef.setAttribute('d', geom.d);
        defsFrag.appendChild(pathDef);

        const group = global.document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', `age-hq-planning-arrow-group age-hq-planning-arrow-group--${arrow.type}`);
        group.dataset.arrowId = arrow.id;

        appendArrowStrokes(geom.d, 'order', group, true);

        const label = global.document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('class', 'age-hq-planning-arrow-label');

        const textPath = global.document.createElementNS('http://www.w3.org/2000/svg', 'textPath');
        textPath.setAttribute('href', `#${pathId}`);
        textPath.setAttribute('startOffset', '50%');
        textPath.setAttribute('text-anchor', 'middle');
        textPath.textContent = arrow.label;

        label.appendChild(textPath);
        group.appendChild(label);
        frag.appendChild(group);
    }

    function syncArrowPaths() {
        if (!arrowsLayer) return;
        arrowsLayer.innerHTML = '';

        const defsHost = frameEl?.querySelector('.age-hq-planning-arrows-defs');
        if (defsHost) defsHost.innerHTML = '';

        const frag = global.document.createDocumentFragment();
        const defsFrag = global.document.createDocumentFragment();

        arrowMarkers.forEach((arrow) => {
            appendLabeledArrow(arrow, frag, defsFrag);
        });

        const steps = getAllPlanningSteps();
        for (let i = 0; i < steps.length - 1; i += 1) {
            const current = steps[i];
            const next = steps[i + 1];
            if (next.kind === 'arrow') continue;

            const fromId = resolveStepCityId(current, 'to');
            const toId = resolveStepCityId(next, 'from');
            if (fromId && toId && fromId !== toId) {
                appendPlainConnector(fromId, toId, frag);
            }
        }

        if (defsHost) defsHost.appendChild(defsFrag);
        arrowsLayer.appendChild(frag);
    }

    function replacePill(pillId, type) {
        if (!isPillMarkerType(type)) return;
        const pill = pills.find((entry) => entry.id === pillId);
        if (!pill) return;
        pill.type = type;
        renderPlanningMarkers();
        notifyPlanningChanged();
    }

    function addPillAtCity(cityId, type) {
        if (!cityId || !isPillMarkerType(type)) return;
        const city = cityById.get(cityId);
        if (!canPlacePillAtCity(city)) return;

        const existing = pills.find((entry) => entry.cityId === cityId && entry.type === type);
        if (existing) {
            replacePill(existing.id, type);
            return;
        }
        pills.push({
            id: `hq-pill-${pillIdCounter += 1}`,
            cityId,
            type,
            order: nextPlanningOrder()
        });
        renderPlanningMarkers();
        notifyPlanningChanged();
    }

    function addArrowMarker(fromCityId, toCityId, type) {
        if (!toCityId || !isArrowMarkerType(type)) return false;
        const toCity = cityById.get(toCityId);
        if (!canPlaceArrowAtCity(toCity, type)) {
            notifyArrowPlacementBlocked(toCity, type);
            return false;
        }

        fromCityId = resolveArrowFromCityId(toCity, type);
        if (!fromCityId) {
            notifyArrowPlacementBlocked(toCity, type);
            return false;
        }

        if (type === 'temp-main') {
            arrowMarkers = arrowMarkers.filter((arrow) => arrow.type !== 'temp-main');
        }

        arrowMarkers.push({
            id: `hq-arrow-${arrowIdCounter += 1}`,
            fromCityId,
            toCityId,
            type,
            label: arrowLabelFor(type),
            order: nextPlanningOrder()
        });
        setSelectedBorderCity('');
        renderPlanningMarkers();
        notifyPlanningChanged();
        return true;
    }

    function placeMarkerOnSelectedCity(type) {
        if (planningLocked || !selectedBorderCityId || !type) return false;
        if (isPillMarkerType(type)) {
            if (!isSelectedCityPlannable()) return false;
            addPillAtCity(selectedBorderCityId, type);
            return true;
        }
        if (isArrowMarkerType(type)) {
            return addArrowMarker(getChainAnchorCityId(), selectedBorderCityId, type);
        }
        return false;
    }

    function handlePillClick(pillId) {
        if (planningLocked || !activeMarkerType || !isPillMarkerType(activeMarkerType)) return;
        replacePill(pillId, activeMarkerType);
    }

    function bindMapEvents() {
        if (!frameEl || bound) return;
        bound = true;

        frameEl.addEventListener('wheel', (event) => {
            if (!enabled) return;
            event.preventDefault();
            zoomAt(event.clientX, event.clientY, event.deltaY);
        }, { passive: false });

        frameEl.addEventListener('pointerdown', (event) => {
            if (!enabled || event.button !== 0) return;
            if (isPlanningMapPanBlockedTarget(event.target)) return;
            dragging = true;
            panMoved = false;
            dragStart = { x: event.clientX, y: event.clientY, tx: targetTx, ty: targetTy };
            frameEl.classList.add('is-dragging');
            frameEl.setPointerCapture(event.pointerId);
        });

        frameEl.addEventListener('pointermove', (event) => {
            if (!dragging || !dragStart) return;
            const dx = event.clientX - dragStart.x;
            const dy = event.clientY - dragStart.y;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) panMoved = true;
            targetTx = dragStart.tx + dx;
            targetTy = dragStart.ty + dy;
            clampTargets();
            scheduleTick();
        });

        const endDrag = (event) => {
            const didPan = panMoved;
            dragging = false;
            dragStart = null;
            frameEl?.classList.remove('is-dragging');
            handleMapCityClick(event, didPan);
        };
        frameEl.addEventListener('pointerup', endDrag);
        frameEl.addEventListener('pointercancel', endDrag);

        hitLayer?.addEventListener('pointerover', (event) => {
            const cityId = resolveCityHitTarget(event.target);
            if (!cityId) return;
            const city = cityById.get(cityId);
            if (!canHighlightCityForActiveTool(city)) return;
            hitLayer.querySelectorAll('.age-hq-city-hit-path.is-hover').forEach((node) => {
                node.classList.remove('is-hover');
            });
            hitLayer.querySelectorAll(`.age-hq-city-hit-path[data-city-id="${cityId}"]`).forEach((node) => {
                node.classList.add('is-hover');
            });
        });

        hitLayer?.addEventListener('pointerout', (event) => {
            const node = event.target.closest?.('.age-hq-city-hit-path[data-city-id]');
            if (!node) return;
            hitLayer.querySelectorAll('.age-hq-city-hit-path.is-hover').forEach((hoverNode) => {
                hoverNode.classList.remove('is-hover');
            });
        });

        pillsLayer?.addEventListener('click', (event) => {
            const pillNode = event.target.closest('.age-hq-planning-pill');
            if (!pillNode) return;
            event.preventDefault();
            event.stopPropagation();

            if (activeMarkerType && isArrowMarkerType(activeMarkerType)) {
                const cityId = pillNode.dataset.cityId || '';
                const city = cityById.get(cityId);
                if (!city) return;
                if (!canPlaceArrowAtCity(city, activeMarkerType)) {
                    notifyArrowPlacementBlocked(city, activeMarkerType);
                    return;
                }
                addArrowMarker(resolveArrowFromCityId(city, activeMarkerType), cityId, activeMarkerType);
                return;
            }

            handlePillClick(pillNode.dataset.pillId);
        });

        global.addEventListener('resize', () => {
            if (enabled) recomputeBaseScale();
        });

        global.addEventListener('royalarmies:age-movement-updated', () => {
            const previousSelection = selectedBorderCityId;
            playerMapCityId = resolvePlayerMapCityId();
            buildCityLayers();
            syncOwnershipVisuals();
            if (previousSelection && canHighlightCityForActiveTool(cityById.get(previousSelection))) {
                setSelectedBorderCity(previousSelection);
            } else if (previousSelection && canPlacePillAtCity(cityById.get(previousSelection))) {
                setSelectedBorderCity(previousSelection);
            } else if (previousSelection) {
                setSelectedBorderCity('');
            }
        });
    }

    function buildMapEdgeFogMarkup(variant) {
        const variantClass = variant === 'hq' ? 'age-map-edge-fog--hq' : 'age-map-edge-fog--world';
        return `
            <div class="age-map-edge-fog ${variantClass}" aria-hidden="true">
                <span class="age-map-edge-fog__vignette"></span>
                <span class="age-map-edge-fog__mist age-map-edge-fog__mist--north"></span>
                <span class="age-map-edge-fog__mist age-map-edge-fog__mist--south"></span>
                <span class="age-map-edge-fog__mist age-map-edge-fog__mist--east"></span>
                <span class="age-map-edge-fog__mist age-map-edge-fog__mist--west"></span>
                <span class="age-map-edge-fog__mist age-map-edge-fog__mist--drift-a"></span>
                <span class="age-map-edge-fog__mist age-map-edge-fog__mist--drift-b"></span>
            </div>
        `.trim();
    }

    function buildDom() {
        if (!hostEl) return;
        hostEl.innerHTML = `
            <div class="age-hq-planning-map-frame" id="age-hq-planning-map-frame">
                <div class="age-hq-planning-map-canvas" id="age-hq-planning-map-canvas">
                    <svg class="age-hq-planning-map-svg" viewBox="0 0 ${NATIVE_SIZE} ${NATIVE_SIZE}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                        <image href="${MAP_BG_SRC}" xlink:href="${MAP_BG_SRC}" width="${NATIVE_SIZE}" height="${NATIVE_SIZE}" x="0" y="0" preserveAspectRatio="none"></image>
                        <g class="age-hq-layer age-hq-layer--regions"></g>
                        <g class="age-hq-layer age-hq-layer--nations"></g>
                        <g class="age-hq-layer age-hq-layer--visual"></g>
                        <g class="age-hq-layer age-hq-layer--ownership"></g>
                        <g class="age-hq-layer age-hq-layer--water-routes"></g>
                        <g class="age-hq-layer age-hq-layer--hit"></g>
                        <g class="age-hq-layer age-hq-layer--highlight"></g>
                    </svg>
                </div>
                <svg class="age-hq-planning-arrows" aria-hidden="true">
                    <defs>
                        <filter id="age-hq-arrow-glow" x="-40%" y="-40%" width="180%" height="180%">
                            <feDropShadow dx="0" dy="0" stdDeviation="2.8" flood-color="#FFE566" flood-opacity="0.55"></feDropShadow>
                            <feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-color="#000000" flood-opacity="0.9"></feDropShadow>
                        </filter>
                        <marker id="age-hq-arrowhead" markerWidth="12" markerHeight="12" refX="10.5" refY="6" orient="auto" markerUnits="userSpaceOnUse">
                            <path d="M0,1 L11,6 L0,11 Z" class="age-hq-planning-arrow-head"></path>
                        </marker>
                        <g class="age-hq-planning-arrows-defs"></g>
                    </defs>
                    <g class="age-hq-planning-arrows-layer"></g>
                </svg>
                <div class="age-hq-planning-labels age-hq-planning-labels--region"></div>
                <div class="age-hq-planning-labels age-hq-planning-labels--city"></div>
                <div class="age-hq-planning-pills"></div>
                ${buildMapEdgeFogMarkup('hq')}
            </div>
        `;

        frameEl = hostEl.querySelector('#age-hq-planning-map-frame');
        canvasEl = hostEl.querySelector('#age-hq-planning-map-canvas');
        svgEl = hostEl.querySelector('.age-hq-planning-map-svg');
        regionLayer = svgEl.querySelector('.age-hq-layer--regions');
        nationLayer = svgEl.querySelector('.age-hq-layer--nations');
        visualLayer = svgEl.querySelector('.age-hq-layer--visual');
        ownershipLayer = svgEl.querySelector('.age-hq-layer--ownership');
        waterRoutesLayer = svgEl.querySelector('.age-hq-layer--water-routes');
        hitLayer = svgEl.querySelector('.age-hq-layer--hit');
        highlightLayer = svgEl.querySelector('.age-hq-layer--highlight');
        labelsRegion = frameEl.querySelector('.age-hq-planning-labels--region');
        labelsCity = frameEl.querySelector('.age-hq-planning-labels--city');
        pillsLayer = frameEl.querySelector('.age-hq-planning-pills');
        arrowsLayer = frameEl.querySelector('.age-hq-planning-arrows-layer');
    }

    function ensureCatalogCrossBorderNeighbors() {
        if (!catalog?.cities?.length) return;
        global.RoyalArmiesAgeWaterRoutes?.augmentCrossBorderNeighbors?.(catalog.cities);
    }

    async function loadCatalogData() {
        const existing = global.RoyalArmiesAgeWorldMap?.getCatalog?.();
        if (existing?.cities?.length) {
            catalog = existing;
            ensureCatalogCrossBorderNeighbors();
            return;
        }

        const [citiesRes, regionsRes, nationsRes] = await Promise.all([
            fetch(DATA_URL, { credentials: 'same-origin' }),
            fetch(REGION_PATHS_URL, { credentials: 'same-origin' }),
            fetch(NATION_PATHS_URL, { credentials: 'same-origin' })
        ]);

        if (!citiesRes.ok || !regionsRes.ok || !nationsRes.ok) {
            throw new Error('Failed to load planning map data');
        }

        catalog = await citiesRes.json();
        ensureCatalogCrossBorderNeighbors();
        const regionPayload = await regionsRes.json();
        const nationPayload = await nationsRes.json();
        regionPaths = regionPayload.regions || regionPayload || [];
        nationPaths = nationPayload.nations || nationPayload || [];
    }

    function indexCatalog() {
        cityById = new Map();
        nationById = new Map();
        catalog?.cities?.forEach((city) => cityById.set(city.id, city));
        if (Array.isArray(catalog?.nations)) {
            catalog.nations.forEach((nation) => {
                const id = String(nation.id || '').trim().toLowerCase();
                if (id) nationById.set(id, nation);
            });
        }
        nationPaths.forEach((nation) => {
            const id = String(nation.id || nation.nationId || '').trim().toLowerCase();
            if (id && !nationById.has(id)) nationById.set(id, nation);
        });
    }

    function renderMapLayers() {
        const regionCentroids = buildRegionCentroidMap();
        appendBorderPaths(regionLayer, regionPaths, 'age-hq-region-border', 'regionId', regionCentroids);
        appendBorderPaths(nationLayer, nationPaths, 'age-hq-nation-border', 'nationId', null);
        playerMapCityId = resolvePlayerMapCityId();
        buildRegionLabels();
        buildCityLayers();
        buildWaterRoutesLayer();
        syncOwnershipVisuals();
        global.requestAnimationFrame(() => {
            recomputeBaseScale();
            renderPlanningMarkers();
        });
    }

    function refreshLayout() {
        recomputeBaseScale();
        renderPlanningMarkers();
    }

    async function mount(host) {
        hostEl = host;
        if (!hostEl) return false;
        buildDom();
        bindMapEvents();

        try {
            await loadCatalogData();
            if (global.RoyalArmiesAgeWaterRoutes?.loadRoutes) {
                await global.RoyalArmiesAgeWaterRoutes.loadRoutes();
            }
            if (!regionPaths.length || !nationPaths.length) {
                const [regionsRes, nationsRes] = await Promise.all([
                    fetch(REGION_PATHS_URL, { credentials: 'same-origin' }),
                    fetch(NATION_PATHS_URL, { credentials: 'same-origin' })
                ]);
                regionPaths = regionsRes.ok ? (await regionsRes.json()).regions || [] : [];
                nationPaths = nationsRes.ok ? (await nationsRes.json()).nations || [] : [];
            }
            indexCatalog();
            renderMapLayers();
            return true;
        } catch (err) {
            console.warn('[RIFT] HQ planning map failed to load:', err.message);
            hostEl.innerHTML = '<p class="age-hq-planning-map-error">Planning map unavailable.</p>';
            return false;
        }
    }

    function setPlanningLocked(locked) {
        planningLocked = Boolean(locked);
        if (planningLocked) {
            activeMarkerType = '';
            selectedBorderCityId = '';
        }
        frameEl?.classList.toggle('is-planning-locked', planningLocked);
        buildCityLayers();
    }

    function setEnabled(next) {
        enabled = !!next;
        if (enabled) {
            playerMapCityId = resolvePlayerMapCityId();
            syncOwnershipVisuals();
            global.requestAnimationFrame(() => recomputeBaseScale());
        }
    }

    function setActiveMarkerType(type) {
        activeMarkerType = type || '';
        buildCityLayers();
        if (selectedBorderCityId) {
            setSelectedBorderCity(selectedBorderCityId);
        }
    }

    function getPills() {
        return pills.slice();
    }

    function getArrowMarkers() {
        return arrowMarkers.slice();
    }

    function getPlanningSteps() {
        return getAllPlanningSteps();
    }

    function migratePlanningSnapshot(snapshot) {
        const combined = [];
        (Array.isArray(snapshot?.pills) ? snapshot.pills : []).forEach((pill) => {
            combined.push({ ...pill, kind: 'pill' });
        });
        (Array.isArray(snapshot?.arrows) ? snapshot.arrows : []).forEach((arrow) => {
            combined.push({ ...arrow, kind: 'arrow' });
        });
        combined.sort((a, b) => (a.order || 0) - (b.order || 0));

        const pills = [];
        const arrows = [];
        let anchorId = playerMapCityId || '';

        combined.forEach((step) => {
            if (step.kind === 'pill' || (!step.fromCityId && step.cityId)) {
                if (step.type === 'hold') {
                    pills.push({
                        id: step.id,
                        cityId: step.cityId,
                        type: 'hold',
                        order: step.order
                    });
                    anchorId = step.cityId;
                    return;
                }
                if (step.type === 'taxi') {
                    arrows.push(normalizeStoredArrow({
                        id: step.id,
                        fromCityId: anchorId,
                        toCityId: step.cityId,
                        type: 'taxi',
                        label: 'Taxi',
                        order: step.order
                    }));
                    anchorId = step.cityId;
                }
                return;
            }

            arrows.push(normalizeStoredArrow({ ...step }));
            anchorId = step.toCityId || anchorId;
        });

        const legacyTempMainCityId = String(snapshot?.tempMainCityId || '').trim();
        if (legacyTempMainCityId && !arrows.some((arrow) => arrow.type === 'temp-main')) {
            const maxOrder = combined.reduce((max, step) => Math.max(max, Math.floor(Number(step.order) || 0)), -1);
            arrows.push(normalizeStoredArrow({
                id: `hq-arrow-temp-main-legacy`,
                fromCityId: playerMapCityId || legacyTempMainCityId,
                toCityId: legacyTempMainCityId,
                type: 'temp-main',
                label: 'Temp Main',
                order: maxOrder + 1
            }));
        }

        return { pills, arrows };
    }

    function getPlanningSnapshot() {
        return {
            pills: pills.map((pill) => ({
                id: pill.id,
                cityId: pill.cityId,
                type: pill.type,
                order: pill.order
            })),
            arrows: arrowMarkers.map((arrow) => ({
                id: arrow.id,
                fromCityId: arrow.fromCityId,
                toCityId: arrow.toCityId,
                type: arrow.type,
                label: arrow.label,
                order: arrow.order
            })),
            tempMainCityId: getTempMainCityId()
        };
    }

    function applyPlanningSnapshot(snapshot) {
        planningSyncSuppressed = true;
        const migrated = migratePlanningSnapshot(snapshot || {});
        pills = migrated.pills;
        arrowMarkers = migrated.arrows;
        selectedBorderCityId = '';
        renderPlanningMarkers();
        planningSyncSuppressed = false;
    }

    function clearPlanningMarkers() {
        pills = [];
        arrowMarkers = [];
        renderPlanningMarkers();
        notifyPlanningChanged();
    }

    function resetPlanningMap() {
        planningSyncSuppressed = true;
        pills = [];
        arrowMarkers = [];
        selectedBorderCityId = '';
        activeMarkerType = '';
        renderPlanningMarkers();
        planningSyncSuppressed = false;
        if (typeof onPillsChanged === 'function') onPillsChanged(getAllPlanningSteps());
        if (typeof onMoveMfMpChanged === 'function') onMoveMfMpChanged(getMoveMfMpBudget());
    }

    global.RoyalArmiesAgeHeadquartersPlanningMap = {
        mount,
        setEnabled,
        setPlanningLocked,
        setActiveMarkerType,
        placeMarkerOnSelectedCity,
        getSelectedBorderCityId: () => selectedBorderCityId,
        getChainAnchorCityId,
        describeArrowPlacementBlock,
        isSelectedCityPlannable,
        canSelectPlanningCityById: (cityId) => canPlacePillAtCity(cityById.get(cityId)),
        canHighlightCityForActiveToolById: (cityId) => canHighlightCityForActiveTool(cityById.get(cityId)),
        getPills,
        getArrowMarkers,
        getPlanningSteps,
        getPlanningSnapshot,
        applyPlanningSnapshot,
        getMoveMfMpBudget,
        getTempMainCityId,
        clearPlanningMarkers,
        resetPlanningMap,
        refreshLayout,
        set onBorderCitySelected(fn) { onBorderCitySelected = fn; },
        set onPillsChanged(fn) { onPillsChanged = fn; },
        set onMoveMfMpChanged(fn) { onMoveMfMpChanged = fn; },
        set onPlanningSyncRequested(fn) { onPlanningSyncRequested = fn; },
        set onPlanningPlacementBlocked(fn) { onPlanningPlacementBlocked = fn; }
    };
})(window);

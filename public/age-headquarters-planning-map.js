/**
 * RIFT — Headquarters SF planning mini-map (zoom/pan, diplomacy tinting, marker pills).
 */
(function initAgeHeadquartersPlanningMap(global) {
    'use strict';

    const DATA_URL = 'data/age-world-cities.json?v=no-snow-terrain-note-1';
    const REGION_PATHS_URL = 'data/age-world-region-paths.json?v=glifora-border-fix-2';
    const NATION_PATHS_URL = 'data/game-nation-paths.json?v=game-nation-paths-3';
    const MAP_BG_SRC = 'images/amnekmap.png';
    const NATIVE_SIZE = 1642;
    const LERP = 0.08;
    const WHEEL_ZOOM_FACTOR = 0.00135;
    const MAX_ZOOM_MULT = 3.35;
    const REGION_LABEL_FADE_START = 1;
    const REGION_LABEL_FADE_PEAK = 1.35;
    const CITY_FADE_START = 1.85;
    const CITY_FADE_FULL = 2.75;
    const REGION_BORDER_FADE_IN_END = REGION_LABEL_FADE_START + 0.08;
    const REGION_BORDER_FADE_OUT_END = CITY_FADE_START + 0.18;
    const SMALL_CITY_SPAN = 26;
    const SMALL_CITY_HIT_RADIUS = 14;
    const BORDER_CITY_HIT_RADIUS = 22;
    const VIEWPORT_CLEAR_X = 0.24;
    const VIEWPORT_CLEAR_Y = 0.24;
    const VIEWPORT_FADE_OUTER = 0.46;
    const PILL_STACK_OFFSET_PX = 22;
    const PILL_LABEL_CLEARANCE_PX = 28;

    const PILL_MARKER_TYPES = new Set(['hold', 'taxi']);
    const ARROW_MARKER_TYPES = new Set(['sf', 'mf', 'move']);

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
    let sfArrowCounter = 0;

    let onBorderCitySelected = null;
    let onPillsChanged = null;

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

    function citiesAreConnected(cityA, cityB) {
        if (!cityA || !cityB || cityA.id === cityB.id) return false;

        if (global.RoyalArmiesAgeWaterRoutes?.resolveCityConnection) {
            return Boolean(global.RoyalArmiesAgeWaterRoutes.resolveCityConnection(cityA, cityB));
        }

        const aToB = Array.isArray(cityA.neighbors) && cityA.neighbors.includes(cityB.id);
        const bToA = Array.isArray(cityB.neighbors) && cityB.neighbors.includes(cityA.id);
        return aToB || bToA;
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
        if (!city || !isArrowMarkerType(type)) return false;

        const fromId = getChainAnchorCityId();
        const fromCity = cityById.get(fromId);
        if (!fromCity || fromCity.id === city.id) return false;
        if (!citiesAreConnected(fromCity, city)) return false;

        const ownership = resolveCityOwnershipKind(city);
        const fromOwnership = resolveCityOwnershipKind(fromCity);

        if (type === 'move') {
            const destOk = ownership === 'own' || ownership === 'current';
            const fromOk = fromOwnership === 'own' || fromOwnership === 'current';
            return destOk && fromOk;
        }

        if (type === 'sf' || type === 'mf') {
            return ownership !== 'own' && ownership !== 'ally' && ownership !== 'current';
        }

        return false;
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
        if (!enabled || didPan || event?.button !== 0) return;
        const cityId = resolveCityHitTarget(event.target);
        if (!cityId) return;
        const city = cityById.get(cityId);
        if (!city) return;

        if (activeMarkerType && isArrowMarkerType(activeMarkerType)) {
            if (!canPlaceArrowAtCity(city, activeMarkerType)) return;
            addArrowMarker(getChainAnchorCityId(), cityId, activeMarkerType);
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
        const regionIn = fadeRange(ratio, REGION_LABEL_FADE_START, REGION_LABEL_FADE_PEAK);
        const cityIn = fadeRange(ratio, CITY_FADE_START, CITY_FADE_FULL);
        return {
            region: regionIn * (1 - cityIn),
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

    function buildRegionCentroidMap() {
        const sums = new Map();
        if (!catalog?.cities) return new Map();
        catalog.cities.forEach((city) => {
            if (!city.regionId || !city.centroid) return;
            const entry = sums.get(city.regionId) || { x: 0, y: 0, n: 0 };
            entry.x += city.centroid.x;
            entry.y += city.centroid.y;
            entry.n += 1;
            sums.set(city.regionId, entry);
        });
        const centroids = new Map();
        sums.forEach((entry, regionId) => {
            if (entry.n) centroids.set(regionId, { x: entry.x / entry.n, y: entry.y / entry.n });
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

    function resolveRegionBorderOpacity(ratio) {
        const fadeIn = fadeRange(ratio, REGION_LABEL_FADE_START, REGION_BORDER_FADE_IN_END);
        const fadeOut = 1 - fadeRange(ratio, CITY_FADE_START, REGION_BORDER_FADE_OUT_END);
        return fadeIn * fadeOut;
    }

    function resolveWaterRouteOpacity(ratio) {
        return fadeRange(ratio, REGION_LABEL_FADE_PEAK, CITY_FADE_START);
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
        syncBorderLayer(regionLayer, borderOpacities.region, hostW, hostH);
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
        const centroids = buildRegionCentroidMap();
        regionPaths.forEach((region) => {
            const regionId = region.regionId || region.id;
            const centroid = centroids.get(regionId);
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
        if (type === 'taxi') return 'Taxi';
        return type;
    }

    function arrowLabelFor(type, sfIndex) {
        if (type === 'sf') return `${sfIndex} SF`;
        if (type === 'mf') return 'MF';
        if (type === 'move') return 'Move';
        return type;
    }

    function nextPlanningOrder() {
        return pills.length + arrowMarkers.length;
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
            button.title = 'Click to replace with Hold or Taxi';
            button.textContent = pillLabelFor(pill.type);
            pillsLayer.appendChild(button);
        });

        syncPillPositions();
        syncArrowPaths();
        buildCityLayers();
        if (selectedBorderCityId) {
            setSelectedBorderCity(selectedBorderCityId);
        }
        if (typeof onPillsChanged === 'function') onPillsChanged(getAllPlanningSteps());
    }

    function renderPlanningMarkers() {
        renderPills();
    }

    function syncPillPositions() {
        if (!pillsLayer || !frameEl) return;
        pillsLayer.querySelectorAll('.age-hq-planning-pill').forEach((node) => {
            const pill = pills.find((entry) => entry.id === node.dataset.pillId);
            const city = cityById.get(pill?.cityId || '');
            if (!pill || !city?.centroid) return;

            const point = mapPointToFramePixels(city.centroid.x, city.centroid.y);
            const offset = resolvePillOffsetPx(pill);
            node.style.left = `${Math.round(point.x + offset.x)}px`;
            node.style.top = `${Math.round(point.y + offset.y)}px`;
        });
    }

    function buildArrowGeometry(fromCity, toCity) {
        if (!fromCity?.centroid || !toCity?.centroid) return null;

        const start = mapPointToFramePixels(fromCity.centroid.x, fromCity.centroid.y);
        const end = mapPointToFramePixels(toCity.centroid.x, toCity.centroid.y);
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const dist = Math.hypot(dx, dy) || 1;
        const curve = Math.min(80, dist * 0.28);
        const cx = midX - (dy / dist) * curve;
        const cy = midY + (dx / dist) * curve;

        return {
            d: `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
        };
    }

    function appendPlainConnector(fromCityId, toCityId, frag, defsFrag) {
        const fromCity = cityById.get(fromCityId);
        const toCity = cityById.get(toCityId);
        const geom = buildArrowGeometry(fromCity, toCity);
        if (!geom) return;

        const path = global.document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'age-hq-planning-arrow age-hq-planning-arrow--link');
        path.setAttribute('d', geom.d);
        path.setAttribute('marker-end', 'url(#age-hq-arrowhead)');
        frag.appendChild(path);
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

        const path = global.document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', `age-hq-planning-arrow age-hq-planning-arrow--${arrow.type}`);
        path.setAttribute('d', geom.d);
        path.setAttribute('marker-end', 'url(#age-hq-arrowhead)');

        const label = global.document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('class', `age-hq-planning-arrow-label age-hq-planning-arrow-label--${arrow.type}`);

        const textPath = global.document.createElementNS('http://www.w3.org/2000/svg', 'textPath');
        textPath.setAttribute('href', `#${pathId}`);
        textPath.setAttribute('startOffset', '50%');
        textPath.setAttribute('text-anchor', 'middle');
        textPath.textContent = arrow.label;

        label.appendChild(textPath);
        group.appendChild(path);
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
                appendPlainConnector(fromId, toId, frag, defsFrag);
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
    }

    function addArrowMarker(fromCityId, toCityId, type) {
        if (!fromCityId || !toCityId || !isArrowMarkerType(type)) return;
        const toCity = cityById.get(toCityId);
        if (!canPlaceArrowAtCity(toCity, type)) return;

        let sfIndex = 0;
        if (type === 'sf') {
            sfArrowCounter += 1;
            sfIndex = sfArrowCounter;
        }

        arrowMarkers.push({
            id: `hq-arrow-${arrowIdCounter += 1}`,
            fromCityId,
            toCityId,
            type,
            sfIndex,
            label: arrowLabelFor(type, sfIndex),
            order: nextPlanningOrder()
        });
        renderPlanningMarkers();
    }

    function placeMarkerOnSelectedCity(type) {
        if (!selectedBorderCityId || !type) return;
        if (isPillMarkerType(type)) {
            if (!isSelectedCityPlannable()) return;
            addPillAtCity(selectedBorderCityId, type);
            return;
        }
        if (isArrowMarkerType(type)) {
            addArrowMarker(getChainAnchorCityId(), selectedBorderCityId, type);
        }
    }

    function handlePillClick(pillId) {
        if (!activeMarkerType || !isPillMarkerType(activeMarkerType)) return;
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
                        <marker id="age-hq-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                            <path d="M0,0 L8,4 L0,8 Z" class="age-hq-planning-arrow-head"></path>
                        </marker>
                        <g class="age-hq-planning-arrows-defs"></g>
                    </defs>
                    <g class="age-hq-planning-arrows-layer"></g>
                </svg>
                <div class="age-hq-planning-labels age-hq-planning-labels--region"></div>
                <div class="age-hq-planning-labels age-hq-planning-labels--city"></div>
                <div class="age-hq-planning-pills"></div>
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

    async function loadCatalogData() {
        const existing = global.RoyalArmiesAgeWorldMap?.getCatalog?.();
        if (existing?.cities?.length) {
            catalog = existing;
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
        recomputeBaseScale();
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

    function clearPlanningMarkers() {
        pills = [];
        arrowMarkers = [];
        sfArrowCounter = 0;
        renderPlanningMarkers();
    }

    function resetPlanningMap() {
        clearPlanningMarkers();
        activeMarkerType = '';
        setSelectedBorderCity('');
    }

    global.RoyalArmiesAgeHeadquartersPlanningMap = {
        mount,
        setEnabled,
        setActiveMarkerType,
        placeMarkerOnSelectedCity,
        getSelectedBorderCityId: () => selectedBorderCityId,
        isSelectedCityPlannable,
        canSelectPlanningCityById: (cityId) => canPlacePillAtCity(cityById.get(cityId)),
        canHighlightCityForActiveToolById: (cityId) => canHighlightCityForActiveTool(cityById.get(cityId)),
        getPills,
        getArrowMarkers,
        getPlanningSteps,
        clearPlanningMarkers,
        resetPlanningMap,
        set onBorderCitySelected(fn) { onBorderCitySelected = fn; },
        set onPillsChanged(fn) { onPillsChanged = fn; }
    };
})(window);

/**
 * RIFT — Amnek world map: city SVG overlay, smooth zoom/pan, semantic labels, city intel drawer.
 *
 * Settlement terrain tags: Forest, Plains, Desert, Mountains only. Snow is not on this map.
 */
(function initAgeWorldMap(global) {
    'use strict';

    const DATA_URL = 'data/age-world-cities.json?v=cross-border-neighbors-2';
    const REGION_PATHS_URL = 'data/age-world-region-paths.json?v=glifora-border-fix-2';
    const NATION_PATHS_URL = 'data/game-nation-paths.json?v=nation-centroid-labels-1';
    const NATIVE_SIZE = 1642;
    const LERP = 0.08;
    const WHEEL_ZOOM_FACTOR = 0.00135;
    const MAX_ZOOM_MULT = 3.35;
    const NATION_FADE_START = 1;
    const NATION_FADE_PEAK = 1.35;
    const CITY_FADE_START = 1.85;
    const CITY_FADE_FULL = 2.75;
    const REGION_BORDER_FADE_IN_END = NATION_FADE_START + 0.08;
    const REGION_BORDER_FADE_OUT_END = CITY_FADE_START + 0.18;
    const SMALL_CITY_SPAN = 26;
    const SMALL_CITY_HIT_RADIUS = 14;
    const PLAYER_PIN_HIT_PAD_PX = 6;
    const SETTLEMENT_TIER_PRIORITY = {
        kingdom: 5,
        citadel: 4,
        city: 3,
        town: 2,
        village: 1
    };
    const LABEL_COLLISION_PAD = 4;
    const LABEL_OFFSET_RINGS = 7;
    /** Inner map view (fraction of half-frame) kept at full label opacity. */
    const VIEWPORT_CLEAR_X = 0.24;
    const VIEWPORT_CLEAR_Y = 0.24;
    /** Distance beyond the clear zone (fraction of min frame size) where labels reach 0 opacity. */
    const VIEWPORT_FADE_OUTER = 0.46;
    const TERRAIN_OVERLAY_FRAME_CLASS = 'is-terrain-overlay-on';
    const OWNERSHIP_TINT = {
        own: {
            fill: 'rgba(255, 196, 48, 0.46)',
            stroke: 'rgba(255, 228, 120, 1)'
        },
        ally: {
            fill: 'rgba(64, 128, 255, 0.44)',
            stroke: 'rgba(120, 176, 255, 1)'
        },
        none: {
            fill: 'transparent',
            stroke: 'transparent'
        }
    };

    const els = {
        stage: null,
        frame: null,
        canvas: null,
        mapImage: null,
        terrainOverlay: null,
        terrainToggle: null,
        terrainLegend: null,
        svg: null,
        regionLayer: null,
        nationLayer: null,
        ownershipLayer: null,
        visualLayer: null,
        hitLayer: null,
        highlightLayer: null,
        waterRoutesLayer: null,
        highlightCanvas: null,
        highlightStage: null,
        highlightMapSvg: null,
        highlightSvg: null,
        labelsNation: null,
        labelsCity: null,
        continentLabel: null,
        drawer: null,
        drawerClose: null,
        drawerTitle: null,
        drawerMeta: null,
        drawerStructures: null,
        drawerFog: null,
        drawerTierBadge: null,
        drawerCapitalBadge: null,
        battleReportOpen: null,
        battleModal: null,
        battleModalBody: null
    };

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
    const PAN_LOCK_ROOT_CLASS = 'age-world-map-pan-locked';
    let selectedCityId = '';
    let playerMapCityId = '';
    let labelPhase = '';
    let labelOpacities = { continent: 1, nation: 0, city: 0 };
    let labelsNationMounted = false;
    let labelsCityMounted = false;
    let hoveredCityId = '';
    let layoutBaseW = 0;
    let layoutBaseH = 0;
    let terrainOverlayOn = false;
    let drawerActiveTab = 'info';

    function setCityDrawerTab(tabId) {
        const target = tabId === 'defenses' ? 'defenses' : 'info';
        drawerActiveTab = target;

        if (els.drawerSideTabs) {
            els.drawerSideTabs.querySelectorAll('[data-city-drawer-tab]').forEach((button) => {
                const isActive = button.getAttribute('data-city-drawer-tab') === target;
                button.classList.toggle('is-active', isActive);
                button.setAttribute('aria-selected', isActive ? 'true' : 'false');
                button.tabIndex = isActive ? 0 : -1;
            });
        }

        if (els.drawerPanelInfo) {
            const showInfo = target === 'info';
            els.drawerPanelInfo.hidden = !showInfo;
            els.drawerPanelInfo.classList.toggle('is-active', showInfo);
        }

        if (els.drawerPanelDefenses) {
            const showDefenses = target === 'defenses';
            els.drawerPanelDefenses.hidden = !showDefenses;
            els.drawerPanelDefenses.classList.toggle('is-active', showDefenses);
        }
    }

    function bindCityDrawerTabs() {
        if (!els.drawerSideTabs || els.drawerSideTabs.dataset.drawerTabsBound === 'true') return;
        els.drawerSideTabs.dataset.drawerTabsBound = 'true';

        els.drawerSideTabs.addEventListener('click', (event) => {
            const tab = event.target.closest('[data-city-drawer-tab]');
            if (!tab) return;
            event.preventDefault();
            setCityDrawerTab(tab.getAttribute('data-city-drawer-tab'));
        });
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function scaleRatio() {
        return scale / baseScale;
    }

    function fadeRange(ratio, start, end) {
        if (end <= start) return ratio >= end ? 1 : 0;
        if (ratio <= start) return 0;
        if (ratio >= end) return 1;
        return (ratio - start) / (end - start);
    }

    function resolveLabelOpacities(ratio) {
        const nationIn = fadeRange(ratio, NATION_FADE_START, NATION_FADE_PEAK);
        const cityIn = fadeRange(ratio, CITY_FADE_START, CITY_FADE_FULL);
        return {
            continent: 1 - nationIn,
            nation: nationIn * (1 - cityIn),
            city: cityIn
        };
    }

    function resolveTypoPhase(opacities) {
        if (opacities.city >= opacities.nation && opacities.city >= opacities.continent) return 'city';
        if (opacities.nation >= opacities.continent) return 'nation';
        return 'continent';
    }

    function smoothstep(t) {
        const x = clamp(t, 0, 1);
        return x * x * (3 - 2 * x);
    }

    function resolveLabelViewportFade(frameX, frameY, frameW, frameH) {
        if (!frameW || !frameH) return 1;

        const centerX = frameW * 0.5;
        const centerY = frameH * 0.5;
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

    function applyLabelViewportFade(node, frameX, frameY, frameW, frameH) {
        const viewportFade = resolveLabelViewportFade(frameX, frameY, frameW, frameH);
        node.style.opacity = String(viewportFade);
        node.style.visibility = viewportFade > 0.02 ? 'visible' : 'hidden';
    }

    function labelLayerIsVisible(opacity) {
        return opacity > 0.02;
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

    function cityDomIds(city) {
        const cityKey = String(city.id || '').replace(/^[^-]+-/, '');
        return {
            hitId: `city-hit-${city.nationId}-${cityKey}`,
            highlightId: `city-highlight-${city.nationId}-${cityKey}`
        };
    }

    function resolvePlayerMapCityId() {
        const movementCityId = global.RoyalArmiesAgeMovement?.getCatalogCityId?.();
        if (movementCityId && cityById.has(movementCityId)) {
            return movementCityId;
        }

        const movement = global.RoyalArmiesAgeMovementPanel;
        if (!movement || typeof movement.getCurrentCity !== 'function') return '';
        const current = movement.getCurrentCity();
        if (!current || !catalog?.cities) return '';

        const capital = catalog.cities.find((city) => city.nationId === current.nationId && city.isCapital);
        return capital ? capital.id : '';
    }

    function resolveLiveCityHolder(city) {
        if (global.RoyalArmiesAgeMovement && typeof global.RoyalArmiesAgeMovement.resolveCityHolder === 'function') {
            return global.RoyalArmiesAgeMovement.resolveCityHolder(city);
        }
        return String(city?.holderNationId || city?.nationId || '').trim().toLowerCase();
    }

    function resolveLiveCityLoser(city) {
        if (global.RoyalArmiesAgeMovement && typeof global.RoyalArmiesAgeMovement.resolveCityLoser === 'function') {
            return global.RoyalArmiesAgeMovement.resolveCityLoser(city);
        }
        return String(city?.loserNationId || '').trim().toLowerCase();
    }

    function resolveNationName(nationId) {
        return nationById.get(nationId)?.name || nationId;
    }

    function mapViewportMetrics() {
        const canvasW = els.canvas?.clientWidth || layoutBaseW;
        const canvasH = els.canvas?.clientHeight || layoutBaseH;
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

    function applyTransform() {
        if (!els.canvas) return;
        els.canvas.style.transform = '';
        syncMapViewBox();
        syncLabelScreenPositions();
        syncBorderVisuals();
        if (typeof global.RoyalArmiesAgeWorldPlanOverlay?.syncLayout === 'function') {
            global.RoyalArmiesAgeWorldPlanOverlay.syncLayout();
        }
        global.dispatchEvent(new CustomEvent('royalarmies:age-map-overlay-layout'));
    }

    function syncMapViewBox() {
        if (!els.svg) return;
        const vp = mapViewportMetrics();
        if (!scale || !vp.meetScale) return;

        const vbW = NATIVE_SIZE / scale;
        const vbH = NATIVE_SIZE / scale;
        const maxVbX = Math.max(0, NATIVE_SIZE - vbW);
        const maxVbY = Math.max(0, NATIVE_SIZE - vbH);
        const vbX = clamp((-tx / scale - vp.offsetX) / vp.meetScale, 0, maxVbX);
        const vbY = clamp((-ty / scale - vp.offsetY) / vp.meetScale, 0, maxVbY);
        const viewBox = `${vbX} ${vbY} ${vbW} ${vbH}`;

        els.svg.setAttribute('viewBox', viewBox);

        if (els.highlightMapSvg) {
            els.highlightMapSvg.setAttribute('viewBox', viewBox);
            els.highlightMapSvg.setAttribute('width', String(vp.canvasW));
            els.highlightMapSvg.setAttribute('height', String(vp.canvasH));
        }
        if (els.highlightStage) {
            els.highlightStage.removeAttribute('transform');
        }
    }

    function mapOverlayHostEl() {
        return els.canvas || els.frame;
    }

    function mapOverlayHostRect() {
        const host = mapOverlayHostEl();
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

    function mapPointToFramePixels(mapX, mapY) {
        if (!els.svg) {
            return { x: 0, y: 0 };
        }

        const point = els.svg.createSVGPoint();
        point.x = mapX;
        point.y = mapY;
        const matrix = els.svg.getScreenCTM();
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

    function mapCentroidToFramePixels(centroid) {
        return mapPointToFramePixels(centroid.x, centroid.y);
    }

    function labelPosition(centroid) {
        const point = mapCentroidToFramePixels(centroid);
        return { left: `${point.x}px`, top: `${point.y}px` };
    }

    function syncLabelScreenPositions() {
        if (labelLayerIsVisible(labelOpacities.nation)) {
            syncLabelHostPositions(els.labelsNation);
        }
        if (labelLayerIsVisible(labelOpacities.city)) {
            syncLabelHostPositions(els.labelsCity);
        }
        if (global.RoyalArmiesPlayerLocPins && typeof global.RoyalArmiesPlayerLocPins.syncPositions === 'function') {
            global.RoyalArmiesPlayerLocPins.syncPositions();
        }
        syncPlayerCityPinHitTarget();
    }

    function mapPixelsPerMapUnit(mapX, mapY) {
        const center = mapPointToFramePixels(mapX, mapY);
        const east = mapPointToFramePixels(mapX + 1, mapY);
        return Math.hypot(east.x - center.x, east.y - center.y) || 0.001;
    }

    function resolvePlayerPinHitRadiusMapUnits(city) {
        if (!city?.centroid) return SMALL_CITY_HIT_RADIUS;

        const pin = global.document.getElementById('age-world-map-player-pin-local');
        if (pin && !pin.hidden) {
            const rect = pin.getBoundingClientRect();
            const hitPx = Math.max(rect.width, rect.height) * 0.52 + PLAYER_PIN_HIT_PAD_PX;
            const pxPerUnit = mapPixelsPerMapUnit(city.centroid.x, city.centroid.y);
            return Math.max(SMALL_CITY_HIT_RADIUS, hitPx / pxPerUnit);
        }

        return Math.max(SMALL_CITY_HIT_RADIUS, 32);
    }

    /** Invisible hit disc under the location pin so the occupied city stays hover/clickable. */
    function syncPlayerCityPinHitTarget() {
        if (!els.hitLayer) return;

        const existing = els.hitLayer.querySelector('.age-world-city-hit-pin-zone');
        if (!playerMapCityId || !cityById.has(playerMapCityId)) {
            existing?.remove();
            return;
        }

        const city = cityById.get(playerMapCityId);
        if (!city?.centroid) {
            existing?.remove();
            return;
        }

        let circle = existing;
        if (circle && circle.getAttribute('data-city-id') !== playerMapCityId) {
            circle.remove();
            circle = null;
        }

        if (!circle) {
            circle = global.document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('class', 'age-world-city-hit-path age-world-city-hit-boost age-world-city-hit-pin-zone');
            circle.setAttribute('data-city-id', playerMapCityId);
            els.hitLayer.appendChild(circle);
        }

        circle.setAttribute('cx', String(city.centroid.x));
        circle.setAttribute('cy', String(city.centroid.y));
        circle.setAttribute('r', String(resolvePlayerPinHitRadiusMapUnits(city)));
    }

    function resolveLocalPlayerPinRect() {
        const pin = global.document.getElementById('age-world-map-player-pin-local');
        if (!pin || pin.hidden) return null;
        const opacity = Number(global.getComputedStyle(pin).opacity);
        if (opacity < 0.06) return null;
        return labelRect(pin);
    }

    function refreshPlayerLocPinAndLabelCollisions() {
        global.RoyalArmiesPlayerLocPins?.refreshLocalPlayerPin?.();
        syncPlayerCityPinHitTarget();
        refreshActiveLabelCollisions();
    }

    function resolvePlayerLocatorCity() {
        if (playerMapCityId && cityById.has(playerMapCityId)) {
            return cityById.get(playerMapCityId);
        }
        return null;
    }

    function enablePlayerLocPins() {
        if (!global.RoyalArmiesPlayerLocPins || typeof global.RoyalArmiesPlayerLocPins.enable !== 'function') {
            return;
        }
        global.RoyalArmiesPlayerLocPins.enable({
            host: global.document.getElementById('age-world-map-player-pins'),
            mapPointToFrame: (mapX, mapY) => mapPointToFramePixels(mapX, mapY),
            resolveCatalogCity: resolvePlayerLocatorCity
        });
    }

    function syncLabelHostPositions(container) {
        if (!container || !els.frame) return;
        const layerOpacity = Number(container.style.opacity || 0);
        if (!labelLayerIsVisible(layerOpacity)) return;

        const hostRect = mapOverlayHostRect();
        const hostW = hostRect.width || mapOverlayHostEl()?.clientWidth || els.frame.clientWidth;
        const hostH = hostRect.height || mapOverlayHostEl()?.clientHeight || els.frame.clientHeight;

        container.querySelectorAll('.age-world-map-label[data-centroid-x]').forEach((node) => {
            const centroid = {
                x: Number(node.dataset.centroidX),
                y: Number(node.dataset.centroidY)
            };
            if (!Number.isFinite(centroid.x) || !Number.isFinite(centroid.y)) return;

            const point = mapCentroidToFramePixels(centroid);
            node.style.left = `${point.x}px`;
            node.style.top = `${point.y}px`;

            const offsetX = Number(node.dataset.offsetX || 0);
            const offsetY = Number(node.dataset.offsetY || 0);
            applyLabelViewportFade(
                node,
                point.x + offsetX,
                point.y + offsetY,
                hostW,
                hostH
            );

            if (node.dataset.collisionSuppressed === '1') {
                node.style.opacity = '0';
                node.style.visibility = 'hidden';
            }
        });
    }

    function stampLabelCentroid(node, centroid) {
        node.dataset.centroidX = String(centroid.x);
        node.dataset.centroidY = String(centroid.y);
    }

    function stampCentroidOnNode(node, centroid) {
        if (!node || !centroid) return;
        node.dataset.centroidX = String(centroid.x);
        node.dataset.centroidY = String(centroid.y);
    }

    function buildRegionCentroidMap() {
        const sums = new Map();
        if (!catalog?.nations) return sums;

        catalog.nations.forEach((nation) => {
            if (!nation.centroid || !nation.regionId) return;
            const entry = sums.get(nation.regionId) || { x: 0, y: 0, n: 0 };
            entry.x += nation.centroid.x;
            entry.y += nation.centroid.y;
            entry.n += 1;
            sums.set(nation.regionId, entry);
        });

        const centroids = new Map();
        sums.forEach((entry, regionId) => {
            if (!entry.n) return;
            centroids.set(regionId, { x: entry.x / entry.n, y: entry.y / entry.n });
        });
        return centroids;
    }

    function resolveRegionBorderOpacity(ratio) {
        const fadeIn = fadeRange(ratio, NATION_FADE_START, REGION_BORDER_FADE_IN_END);
        const fadeOut = 1 - fadeRange(ratio, CITY_FADE_START, REGION_BORDER_FADE_OUT_END);
        return fadeIn * fadeOut;
    }

    function resolveBorderOpacities(ratio) {
        const opacities = resolveLabelOpacities(ratio);
        return {
            region: resolveRegionBorderOpacity(ratio),
            nation: 0,
            city: opacities.city
        };
    }

    function applyBorderElementOpacity(node, mapX, mapY, tierOpacity, frameW, frameH) {
        if (!node) return;
        const point = mapPointToFramePixels(mapX, mapY);
        const viewportFade = resolveLabelViewportFade(point.x, point.y, frameW, frameH);
        const opacity = tierOpacity * viewportFade;
        node.style.opacity = String(opacity);
        node.style.visibility = opacity > 0.02 ? 'visible' : 'hidden';
    }

    function syncBorderLayer(layer, tierOpacity, frameW, frameH) {
        if (!layer) return;
        layer.querySelectorAll('[data-centroid-x][data-centroid-y]').forEach((node) => {
            const mapX = Number(node.dataset.centroidX);
            const mapY = Number(node.dataset.centroidY);
            if (!Number.isFinite(mapX) || !Number.isFinite(mapY)) return;
            applyBorderElementOpacity(node, mapX, mapY, tierOpacity, frameW, frameH);
        });
    }

    function applyOwnershipTint(node, kind) {
        if (!node) return;
        const palette = OWNERSHIP_TINT[kind] || OWNERSHIP_TINT.none;
        node.setAttribute('fill', palette.fill);
        node.setAttribute('stroke', palette.stroke);
        node.setAttribute('stroke-width', '2.5');
        node.style.opacity = kind === 'none' ? '0' : '1';
        node.style.visibility = kind === 'none' ? 'hidden' : 'visible';
    }

    function syncOwnershipVisuals() {
        if (!els.ownershipLayer) return;
        els.ownershipLayer.querySelectorAll('.age-world-city-ownership-path').forEach((node) => {
            let kind = 'none';
            if (node.classList.contains('is-nation-own')) {
                kind = 'own';
            } else if (node.classList.contains('is-nation-ally')) {
                kind = 'ally';
            }
            applyOwnershipTint(node, kind);
        });
    }

    function resolveWaterRouteOpacity(ratio) {
        const fadeIn = fadeRange(ratio, NATION_FADE_PEAK, CITY_FADE_START);
        return fadeIn;
    }

    function syncBorderVisuals() {
        if (!els.frame) return;
        const hostRect = mapOverlayHostRect();
        const hostW = hostRect.width || mapOverlayHostEl()?.clientWidth || els.frame.clientWidth;
        const hostH = hostRect.height || mapOverlayHostEl()?.clientHeight || els.frame.clientHeight;
        const borderOpacities = resolveBorderOpacities(scaleRatio());
        const waterRouteOpacity = resolveWaterRouteOpacity(scaleRatio());

        syncBorderLayer(els.regionLayer, borderOpacities.region, hostW, hostH);
        syncBorderLayer(els.nationLayer, borderOpacities.nation, hostW, hostH);
        syncBorderLayer(els.visualLayer, borderOpacities.city, hostW, hostH);
        syncBorderLayer(els.waterRoutesLayer, waterRouteOpacity, hostW, hostH);
        syncOwnershipVisuals();
    }

    function measureLayoutBase() {
        if (!els.canvas) return;
        const prevTransform = els.canvas.style.transform;
        els.canvas.style.transform = 'translate3d(0px, 0px, 0) scale(1)';
        layoutBaseW = els.canvas.clientWidth;
        layoutBaseH = els.canvas.clientHeight;
        els.canvas.style.transform = prevTransform;
    }

    function clampTargets() {
        targetScale = clamp(targetScale, minScale, maxScale);
        if (!layoutBaseW || !layoutBaseH) {
            measureLayoutBase();
        }

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
        syncTypography();
        if (!rafId) {
            refreshActiveLabelCollisions();
        }
    }

    function requestTick() {
        if (!rafId) {
            rafId = global.requestAnimationFrame(tick);
        }
    }

    function recomputeBaseScale() {
        if (!els.frame || !els.canvas) return;
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
        applyTransform();
        labelPhase = '';
        syncTypography();
    }

    function zoomAt(clientX, clientY, deltaY) {
        const frameRect = els.frame.getBoundingClientRect();
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
        requestTick();
    }

    function ensureLabelLayersMounted() {
        if (!catalog) return;

        if (els.labelsNation && !labelsNationMounted) {
            els.labelsNation.hidden = false;
            els.labelsNation.innerHTML = '';
            mountNationLabels(els.labelsNation);
            labelsNationMounted = true;
        }

        if (els.labelsCity && !labelsCityMounted) {
            els.labelsCity.hidden = false;
            els.labelsCity.innerHTML = '';
            mountCityLabels(els.labelsCity);
            labelsCityMounted = true;
        }
    }

    function applyLabelLayerOpacity(node, opacity) {
        if (!node) return;
        const visible = labelLayerIsVisible(opacity);
        node.hidden = false;
        node.style.opacity = String(opacity);
        node.style.visibility = visible ? 'visible' : 'hidden';
        node.setAttribute('aria-hidden', visible ? 'false' : 'true');
    }

    function syncTypography() {
        ensureLabelLayersMounted();
        labelOpacities = resolveLabelOpacities(scaleRatio());
        labelPhase = resolveTypoPhase(labelOpacities);

        applyLabelLayerOpacity(els.continentLabel, labelOpacities.continent);
        applyLabelLayerOpacity(els.labelsNation, labelOpacities.nation);
        applyLabelLayerOpacity(els.labelsCity, labelOpacities.city);
        syncBorderVisuals();
    }

    function compareCityLabelPriority(a, b) {
        const tierDiff = (SETTLEMENT_TIER_PRIORITY[b.settlementTier] || 0)
            - (SETTLEMENT_TIER_PRIORITY[a.settlementTier] || 0);
        if (tierDiff !== 0) return tierDiff;
        if (a.isCapital !== b.isCapital) return a.isCapital ? -1 : 1;
        return String(a.name).localeCompare(String(b.name));
    }

    function labelRect(node) {
        const rect = node.getBoundingClientRect();
        return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom
        };
    }

    function rectsOverlap(a, b, pad = LABEL_COLLISION_PAD) {
        return !(
            a.right + pad <= b.left
            || b.right + pad <= a.left
            || a.bottom + pad <= b.top
            || b.bottom + pad <= a.top
        );
    }

    function setLabelTransform(node, offsetX, offsetY) {
        node.dataset.offsetX = String(offsetX || 0);
        node.dataset.offsetY = String(offsetY || 0);
        if (!offsetX && !offsetY) {
            node.style.transform = 'translate(-50%, -50%)';
            return;
        }
        node.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
    }

    function resolveLabelCollisions(nodes, seedPlaced = []) {
        const placed = seedPlaced.map((entry) => ({ rect: entry.rect }));
        const directions = [
            { x: 0, y: 0 },
            { x: 0, y: -1 },
            { x: 0, y: 1 },
            { x: -1, y: 0 },
            { x: 1, y: 0 },
            { x: -1, y: -1 },
            { x: 1, y: -1 },
            { x: -1, y: 1 },
            { x: 1, y: 1 }
        ];

        nodes.forEach((node) => {
            delete node.dataset.collisionSuppressed;
            setLabelTransform(node, 0, 0);
            const baseHeight = Math.max(node.offsetHeight, 14);
            let placedSuccessfully = false;

            for (let ring = 0; ring < LABEL_OFFSET_RINGS && !placedSuccessfully; ring += 1) {
                const distance = baseHeight * (0.7 + ring * 0.48);
                for (let d = 0; d < directions.length; d += 1) {
                    const dir = directions[d];
                    const offsetX = dir.x * distance;
                    const offsetY = dir.y * distance;
                    setLabelTransform(node, offsetX, offsetY);
                    const rect = labelRect(node);
                    const overlaps = placed.some((entry) => rectsOverlap(rect, entry.rect));
                    if (!overlaps) {
                        placed.push({ node, rect });
                        placedSuccessfully = true;
                        break;
                    }
                }
            }

            if (!placedSuccessfully) {
                node.dataset.collisionSuppressed = '1';
            }
        });
    }

    function getVisibleLabelNodes(container) {
        if (!container) return [];
        return [...container.querySelectorAll('.age-world-map-label[data-centroid-x]')].filter((node) => (
            Number(node.style.opacity || 0) > 0.06
        ));
    }

    function refreshContainerLabelCollisions(container) {
        if (!container || !els.frame) return;
        const layerOpacity = Number(container.style.opacity || 0);
        if (!labelLayerIsVisible(layerOpacity)) return;

        container.querySelectorAll('.age-world-map-label[data-centroid-x]').forEach((node) => {
            delete node.dataset.collisionSuppressed;
        });
        syncLabelHostPositions(container);
        if (container === els.labelsCity) {
            global.RoyalArmiesPlayerLocPins?.syncPositions?.();
        }
        const candidates = getVisibleLabelNodes(container);
        const seedPlaced = [];
        if (container === els.labelsCity) {
            const pinRect = resolveLocalPlayerPinRect();
            if (pinRect) {
                seedPlaced.push({ rect: pinRect });
            }
        }
        if (candidates.length) {
            resolveLabelCollisions(candidates, seedPlaced);
        }
        syncLabelHostPositions(container);
    }

    function refreshActiveLabelCollisions() {
        refreshContainerLabelCollisions(els.labelsNation);
        refreshContainerLabelCollisions(els.labelsCity);
    }

    function scheduleLabelCollisionPass(container) {
        global.requestAnimationFrame(() => {
            refreshContainerLabelCollisions(container);
        });
    }

    function mountNationLabels(container) {
        const nodes = [];
        catalog.nations.forEach((nation) => {
            const terrains = nation.terrainTypes.join(', ');
            const labelCentroid = nation?.centroid || null;
            if (!labelCentroid) return;
            const pos = labelPosition(labelCentroid);
            const node = global.document.createElement('div');
            node.className = 'age-world-map-label age-world-map-label--nation';
            node.id = `age-label-nation-${nation.id}`;
            node.style.left = pos.left;
            node.style.top = pos.top;
            stampLabelCentroid(node, labelCentroid);
            node.innerHTML = `
                <span class="age-world-map-label-title">${nation.name}</span>
                <span class="age-world-map-label-sub">Terrains: ${terrains}</span>
            `;
            container.appendChild(node);
            nodes.push(node);
        });
        scheduleLabelCollisionPass(container);
    }

    function mountCityLabels(container) {
        const nodes = [];
        const cities = catalog.cities.slice().sort(compareCityLabelPriority);

        cities.forEach((city) => {
            const pos = labelPosition(city.centroid);
            const tierLabel = city.settlementTier.charAt(0).toUpperCase() + city.settlementTier.slice(1);
            const node = global.document.createElement('div');
            node.className = 'age-world-map-label age-world-map-label--city';
            node.id = `age-label-city-${city.nationId}-${city.id.replace(/^[^-]+-/, '')}`;
            node.dataset.cityId = city.id;
            node.style.left = pos.left;
            node.style.top = pos.top;
            stampLabelCentroid(node, city.centroid);
            node.innerHTML = `
                <span class="age-world-map-label-title">${city.name}</span>
                <span class="age-world-map-label-sub">${city.terrain} · ${tierLabel}</span>
            `;
            container.appendChild(node);
            nodes.push(node);
        });
        scheduleLabelCollisionPass(container);
    }

    function appendBorderPaths(layer, records, className, idKey, centroidLookup) {
        if (!layer) return;
        layer.innerHTML = '';
        records.forEach((record) => {
            const paths = Array.isArray(record.paths)
                ? record.paths
                : record.d
                  ? [record.d]
                  : [];
            if (!paths.length) return;

            const group = global.document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.setAttribute('class', className);
            const recordId = record[idKey] || record.id;
            if (recordId) {
                group.dataset[idKey] = recordId;
            }

            if (centroidLookup) {
                const centroid = typeof centroidLookup === 'function'
                    ? centroidLookup(record)
                    : centroidLookup.get(recordId);
                stampCentroidOnNode(group, centroid);
            } else if (record.centroid) {
                stampCentroidOnNode(group, record.centroid);
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

    function resolveCityHitTarget(target) {
        if (!target || typeof target.closest !== 'function') return '';
        const node = target.closest('.age-world-city-hit-path[data-city-id]');
        return node?.dataset.cityId || '';
    }

    function bindCityHitDelegation() {
        if (!els.hitLayer || els.hitLayer.dataset.hitBound === '1') return;
        els.hitLayer.dataset.hitBound = '1';

        els.hitLayer.addEventListener('pointerover', (event) => {
            const cityId = resolveCityHitTarget(event.target);
            if (cityId) showCityHighlight(cityId);
        });

        els.hitLayer.addEventListener('pointerout', (event) => {
            const node = event.target.closest?.('.age-world-city-hit-path[data-city-id]');
            if (!node) return;
            const leavingId = node.dataset.cityId;
            const entering = event.relatedTarget?.closest?.('.age-world-city-hit-path[data-city-id]');
            if (entering?.dataset.cityId === leavingId) return;
            if (hoveredCityId === leavingId) clearCityHighlight();
        });

        els.hitLayer.addEventListener('pointerup', (event) => {
            if (event.button !== 0 || dragging || panMoved) return;
            const cityId = resolveCityHitTarget(event.target);
            if (cityId) openCityDrawer(cityId, event.clientX, event.clientY);
        });
    }

    function appendSmallCityHitBoost(city, outlineD, hitFrag, highlightFrag, ownershipFrag) {
        const span = pathSpan(outlineD);
        if (span >= SMALL_CITY_SPAN || !city.centroid || !hitFrag) {
            return;
        }

        const cx = city.centroid.x;
        const cy = city.centroid.y;
        const hitCircle = global.document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        hitCircle.setAttribute('class', 'age-world-city-hit-path age-world-city-hit-boost');
        hitCircle.setAttribute('data-city-id', city.id);
        hitCircle.setAttribute('cx', String(cx));
        hitCircle.setAttribute('cy', String(cy));
        hitCircle.setAttribute('r', String(SMALL_CITY_HIT_RADIUS));
        hitFrag.appendChild(hitCircle);

        if (highlightFrag) {
            const highlightCircle = global.document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            highlightCircle.setAttribute('class', 'age-world-city-highlight-path age-world-city-highlight-boost');
            highlightCircle.setAttribute('data-city-id', city.id);
            highlightCircle.setAttribute('cx', String(cx));
            highlightCircle.setAttribute('cy', String(cy));
            highlightCircle.setAttribute('r', String(SMALL_CITY_HIT_RADIUS));
            highlightFrag.appendChild(highlightCircle);
        }
    }

    function resolvePlayerNationForOwnership() {
        global.RoyalArmiesAgeMovement?.getCatalogCityId?.();

        const movementNation = global.RoyalArmiesAgeMovement?.resolvePlayerNationId?.();
        if (movementNation) return movementNation;

        const panelNation = global.RoyalArmiesAgeMovementPanel?.getCommanderNationId?.();
        if (panelNation) return panelNation;

        return 'aesthene';
    }

    function ensureOwnershipLayer() {
        if (els.ownershipLayer) return;
        if (!els.svg) return;

        const layer = global.document.createElementNS('http://www.w3.org/2000/svg', 'g');
        layer.setAttribute('id', 'age-world-map-ownership-layer');
        layer.setAttribute('class', 'age-world-map-layer--ownership');

        if (els.hitLayer && els.hitLayer.parentNode === els.svg) {
            els.svg.insertBefore(layer, els.hitLayer);
        } else if (els.visualLayer && els.visualLayer.parentNode === els.svg) {
            els.visualLayer.insertAdjacentElement('afterend', layer);
        } else {
            els.svg.appendChild(layer);
        }

        els.ownershipLayer = layer;
    }

    function ensureWaterRoutesLayer() {
        if (els.waterRoutesLayer) return;
        if (!els.svg) return;

        const layer = global.document.createElementNS('http://www.w3.org/2000/svg', 'g');
        layer.setAttribute('id', 'age-world-map-water-routes-layer');
        layer.setAttribute('class', 'age-world-map-layer--water-routes');

        if (els.hitLayer && els.hitLayer.parentNode === els.svg) {
            els.svg.insertBefore(layer, els.hitLayer);
        } else if (els.ownershipLayer && els.ownershipLayer.parentNode === els.svg) {
            els.ownershipLayer.insertAdjacentElement('afterend', layer);
        } else {
            els.svg.appendChild(layer);
        }

        els.waterRoutesLayer = layer;
    }

    function buildWaterRoutesLayer() {
        ensureWaterRoutesLayer();
        if (!els.waterRoutesLayer || !global.RoyalArmiesAgeWaterRoutes) return;

        els.waterRoutesLayer.innerHTML = '';
        const routes = global.RoyalArmiesAgeWaterRoutes.getRoutes();
        if (!routes.length) return;

        const frag = global.document.createDocumentFragment();
        routes.forEach((route) => {
            const geom = global.RoyalArmiesAgeWaterRoutes.resolveRouteGeometry(route, cityById);
            if (!geom) return;

            const group = global.document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.setAttribute('class', 'age-world-water-route');
            group.setAttribute('data-route-id', route.id);
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
            badgeText.setAttribute('y', '0');
            badgeText.textContent = `${geom.movePointCost} MP`;

            badge.appendChild(badgeRect);
            badge.appendChild(badgeText);
            group.appendChild(track);
            group.appendChild(march);
            group.appendChild(badge);
            frag.appendChild(group);
        });

        els.waterRoutesLayer.appendChild(frag);
    }

    function buildSvgLayers() {
        const regionCentroids = buildRegionCentroidMap();
        appendBorderPaths(
            els.regionLayer,
            regionPaths,
            'age-world-region-border',
            'regionId',
            regionCentroids
        );
        appendBorderPaths(
            els.nationLayer,
            nationPaths.map((record) => ({ ...record, nationId: record.id })),
            'age-world-nation-border',
            'nationId',
            (record) => record.centroid
        );

        els.visualLayer.innerHTML = '';
        els.hitLayer.innerHTML = '';
        if (els.ownershipLayer) {
            els.ownershipLayer.innerHTML = '';
        }
        if (els.highlightLayer) {
            els.highlightLayer.innerHTML = '';
        }

        const visualFrag = global.document.createDocumentFragment();
        const ownershipFrag = els.ownershipLayer
            ? global.document.createDocumentFragment()
            : null;
        const hitFrag = global.document.createDocumentFragment();
        const highlightFrag = els.highlightLayer
            ? global.document.createDocumentFragment()
            : null;

        catalog.cities.forEach((city) => {
            const outlineD = resolveCityOutlinePath(city);
            if (!outlineD) return;

            const { hitId, highlightId } = cityDomIds(city);

            if (ownershipFrag) {
                const ownershipPath = global.document.createElementNS('http://www.w3.org/2000/svg', 'path');
                ownershipPath.setAttribute('class', 'age-world-city-ownership-path');
                ownershipPath.setAttribute('d', outlineD);
                ownershipPath.setAttribute('data-city-id', city.id);
                ownershipPath.setAttribute('vector-effect', 'non-scaling-stroke');
                ownershipFrag.appendChild(ownershipPath);
            }

            const borderPath = global.document.createElementNS('http://www.w3.org/2000/svg', 'path');
            borderPath.setAttribute('id', `city-border-${city.nationId}-${city.id.replace(/^[^-]+-/, '')}`);
            borderPath.setAttribute('class', 'age-world-city-border-path');
            borderPath.setAttribute('d', outlineD);
            borderPath.setAttribute('data-city-id', city.id);
            borderPath.setAttribute('vector-effect', 'non-scaling-stroke');
            stampCentroidOnNode(borderPath, city.centroid);
            visualFrag.appendChild(borderPath);

            const hitPath = global.document.createElementNS('http://www.w3.org/2000/svg', 'path');
            hitPath.setAttribute('id', hitId);
            hitPath.setAttribute('class', 'age-world-city-hit-path');
            hitPath.setAttribute('d', outlineD);
            hitPath.setAttribute('data-city-id', city.id);
            hitPath.setAttribute('vector-effect', 'non-scaling-stroke');
            hitFrag.appendChild(hitPath);

            if (highlightFrag) {
                const highlightPath = global.document.createElementNS('http://www.w3.org/2000/svg', 'path');
                highlightPath.setAttribute('id', highlightId);
                highlightPath.setAttribute('class', 'age-world-city-highlight-path');
                highlightPath.setAttribute('d', outlineD);
                highlightPath.setAttribute('data-city-id', city.id);
                highlightPath.setAttribute('vector-effect', 'non-scaling-stroke');
                highlightFrag.appendChild(highlightPath);
            }

            appendSmallCityHitBoost(city, outlineD, hitFrag, highlightFrag, ownershipFrag);
        });

        if (ownershipFrag && els.ownershipLayer) {
            els.ownershipLayer.appendChild(ownershipFrag);
        }
        els.visualLayer.appendChild(visualFrag);
        els.hitLayer.appendChild(hitFrag);
        if (highlightFrag && els.highlightLayer) {
            els.highlightLayer.appendChild(highlightFrag);
        }
        bindCityHitDelegation();
        refreshNationCityHighlights();
    }

    function refreshNationCityHighlights() {
        if (!catalog) return;

        const playerNation = resolvePlayerNationForOwnership();
        const alliedNationIds = new Set(
            global.RoyalArmiesAgeMovement?.getAlliedNationIds?.() || []
        );

        if (els.ownershipLayer) {
            els.ownershipLayer.querySelectorAll('.age-world-city-ownership-path').forEach((node) => {
                node.classList.remove('is-nation-own', 'is-nation-ally');

                const cityId = node.getAttribute('data-city-id');
                const city = cityById.get(cityId);
                if (!city || !playerNation) return;

                const holder = resolveLiveCityHolder(city);
                if (holder === playerNation) {
                    node.classList.add('is-nation-own');
                } else if (holder && alliedNationIds.has(holder)) {
                    node.classList.add('is-nation-ally');
                }
            });
        }

        syncOwnershipVisuals();
    }

    function showCityHighlight(cityId) {
        if (!cityId || !els.highlightLayer) return;
        clearCityHighlight();
        hoveredCityId = cityId;
        els.highlightLayer.querySelectorAll(
            `.age-world-city-highlight-path[data-city-id="${cityId}"]`
        ).forEach((node) => {
            node.classList.add('is-active');
        });
    }

    function clearCityHighlight() {
        hoveredCityId = '';
        if (!els.highlightLayer) return;
        els.highlightLayer.querySelectorAll('.age-world-city-highlight-path.is-active, .age-world-city-highlight-boost.is-active').forEach((node) => {
            node.classList.remove('is-active');
        });
    }

    function playerBordersCity(city) {
        if (!playerMapCityId) return false;
        if (city.id === playerMapCityId) return true;
        const occupied = cityById.get(playerMapCityId);
        if (!occupied) return false;
        return Array.isArray(city.neighbors) && city.neighbors.includes(playerMapCityId);
    }

    function positionCityDrawer(clientX, clientY) {
        if (!els.drawer || !els.frame) return;

        const pad = 12;
        const gap = 14;
        const frameRect = els.frame.getBoundingClientRect();
        const drawerW = els.drawer.offsetWidth || 280;
        const drawerH = els.drawer.offsetHeight || 320;

        let left = clientX - frameRect.left + gap;
        let top = clientY - frameRect.top + gap;

        const maxLeft = Math.max(pad, frameRect.width - drawerW - pad);
        const maxTop = Math.max(pad, frameRect.height - drawerH - pad);

        if (left > maxLeft) {
            left = clientX - frameRect.left - drawerW - gap;
        }
        if (top > maxTop) {
            top = clientY - frameRect.top - drawerH - gap;
        }

        left = clamp(left, pad, maxLeft);
        top = clamp(top, pad, maxTop);

        els.drawer.style.left = `${Math.round(left)}px`;
        els.drawer.style.top = `${Math.round(top)}px`;
        els.drawer.style.right = 'auto';
        els.drawer.style.bottom = 'auto';
    }

    function settlementTierLabel(tier) {
        const key = String(tier || 'city').toLowerCase();
        return key.charAt(0).toUpperCase() + key.slice(1);
    }

    function cityHasCaptureHistory(city) {
        if (!city) return false;
        if (city.hasBeenCaptured === true || city.lastCaptureAt) return true;

        const holderId = resolveLiveCityHolder(city);
        const nationId = String(city.nationId || '').trim();
        const loserId = resolveLiveCityLoser(city);
        if (!loserId) return false;
        if (holderId && nationId && holderId !== nationId) return true;
        if (holderId && loserId && loserId !== holderId) return true;
        return false;
    }

    function resolveLastCaptureDisplay(city) {
        if (!cityHasCaptureHistory(city)) return '—';
        return resolveNationName(resolveLiveCityLoser(city));
    }

    function refreshDrawerMovementActions(city) {
        const actionsHost = els.drawerMovementActions;
        if (!actionsHost || !city) return;

        const hints = global.RoyalArmiesAgeMovement?.getBorderActionHints?.(city, playerMapCityId) || {};
        const movePoints = global.RoyalArmiesAgeMovement?.getMovePoints?.() ?? 0;
        const movePointCost = Math.max(1, Math.floor(Number(hints.movePointCost) || 1));
        const hasMovePoint = movePoints >= movePointCost;
        const moveCostLabel = movePointCost === 1 ? '1 Move' : `${movePointCost} Moves`;
        const waterNote = hints.connectionType === 'water' ? ' via water crossing' : '';
        const showAny = hints.canTravel || hints.canAssault || hints.canTransfer || hints.canScout;

        actionsHost.hidden = !showAny;
        if (!showAny) {
            actionsHost.innerHTML = '';
            return;
        }

        const transferCost = hints.transferRsdCost || 250;
        const buttons = [];

        if (hints.canTravel) {
            buttons.push(`
                <button
                    type="button"
                    class="age-world-city-action-btn age-world-city-action-btn--travel"
                    data-age-city-action="travel"
                    ${hasMovePoint ? '' : 'disabled aria-disabled="true"'}
                    title="${hasMovePoint ? `Spend ${movePointCost} move point${movePointCost > 1 ? 's' : ''} to travel here${waterNote}.` : 'Not enough move points remaining.'}">
                    Travel <span class="age-world-city-action-cost">(${moveCostLabel})</span>
                </button>
            `);
        }

        if (hints.canAssault) {
            buttons.push(`
                <button
                    type="button"
                    class="age-world-city-action-btn age-world-city-action-btn--assault"
                    data-age-city-action="assault"
                    ${hasMovePoint ? '' : 'disabled aria-disabled="true"'}
                    title="${hasMovePoint ? `Spend ${movePointCost} move point${movePointCost > 1 ? 's' : ''} to begin assault${waterNote}.` : 'Not enough move points remaining.'}">
                    Begin Assault <span class="age-world-city-action-cost">(${moveCostLabel})</span>
                </button>
            `);
        }

        if (hints.canTransfer) {
            buttons.push(`
                <button
                    type="button"
                    class="age-world-city-action-btn age-world-city-action-btn--transfer"
                    data-age-city-action="transfer"
                    title="Pay ${transferCost} RSD into the ally treasury to take ownership.">
                    Transfer Ownership <span class="age-world-city-action-cost">(${transferCost} RSD)</span>
                </button>
            `);
        }

        if (hints.canScout) {
            const scoutTitle = hints.relationship === 'ally'
                ? 'Send a scout to survey allied commanders and armies in this bordering city.'
                : 'Send a scout to attempt intel on all commanders and armies in this bordering city.';
            buttons.push(`
                <button
                    type="button"
                    class="age-world-city-action-btn age-world-city-action-btn--scout"
                    data-age-city-action="scout"
                    title="${scoutTitle}">
                    Send Scout <span class="age-world-city-action-cost">(Border Intel)</span>
                </button>
            `);
        }

        actionsHost.innerHTML = buttons.join('');
    }

    const scoutedCityReports = new Map();

    function buildScoutIntelMarkup(city) {
        const nationName = resolveNationName(city.nationId);
        return (
            `<p class="age-world-city-drawer-scout-intel-title">Border Scout Report — ${city.name}</p>`
            + `<p class="age-world-city-drawer-scout-intel-copy">`
            + `Scout dispatched to ${nationName} holdings at ${city.name}. `
            + `Commander roster and army strength for this bordering city will appear here when the report returns.`
            + `</p>`
        );
    }

    function refreshDrawerScoutIntel(city, hints) {
        if (!els.drawerScoutIntel || !city) return;

        if (!hints?.canScout) {
            els.drawerScoutIntel.hidden = true;
            els.drawerScoutIntel.innerHTML = '';
            return;
        }

        const reportHtml = scoutedCityReports.get(city.id);
        if (!reportHtml) {
            els.drawerScoutIntel.hidden = true;
            els.drawerScoutIntel.innerHTML = '';
            return;
        }

        els.drawerScoutIntel.hidden = false;
        els.drawerScoutIntel.innerHTML = reportHtml;
    }

    function handleDrawerScoutAction() {
        const city = cityById.get(selectedCityId);
        const movement = global.RoyalArmiesAgeMovement;
        if (!city || !movement) return;

        const hints = movement.getBorderActionHints?.(city, playerMapCityId) || {};
        if (!hints.canScout) return;

        const reportHtml = buildScoutIntelMarkup(city);
        scoutedCityReports.set(city.id, reportHtml);

        if (els.drawerScoutIntel) {
            els.drawerScoutIntel.hidden = false;
            els.drawerScoutIntel.innerHTML = reportHtml;
        }

        global.dispatchEvent(new CustomEvent('royal-armies-city-scout-request', {
            detail: {
                cityId: city.id,
                cityName: city.name,
                nationId: city.nationId,
                relationship: hints.relationship,
                playerCityId: playerMapCityId
            }
        }));
    }

    let drawerMovementBusy = false;

    async function handleDrawerMovementAction(action) {
        const city = cityById.get(selectedCityId);
        const movement = global.RoyalArmiesAgeMovement;
        if (!city || !movement || drawerMovementBusy) return;

        const drawerLeft = els.drawer?.style.left;
        const drawerTop = els.drawer?.style.top;

        drawerMovementBusy = true;
        try {
            if (action === 'travel') {
                await movement.travel(city.id);
            } else if (action === 'assault') {
                await movement.assault(city.id);
            } else if (action === 'transfer') {
                await movement.transferOwnership(city.id);
            } else {
                return;
            }

            const traveledCityId = movement.getCatalogCityId();
            playerMapCityId = traveledCityId || resolvePlayerMapCityId();
            global.RoyalArmiesAgeMovementPanel?.syncCatalogCity?.(traveledCityId);
            global.RoyalArmiesPlayerLocPins?.refreshLocalPlayerPin?.();
            refreshPlayerLocPinAndLabelCollisions();
            refreshNationCityHighlights();
            global.refreshAgeHudMovePoints?.();
            global.RoyalArmiesNationTreasury?.requestRefresh?.();

            openCityDrawer(city.id);
            if (drawerLeft && drawerTop && els.drawer) {
                els.drawer.style.left = drawerLeft;
                els.drawer.style.top = drawerTop;
            }
        } catch (err) {
            if (typeof global.showRiftError === 'function') {
                await global.showRiftError(err?.code || err?.message || err, 'Movement');
            } else if (typeof global.showPortalAlert === 'function') {
                await global.showPortalAlert(err?.message || 'Movement action failed.', 'Movement');
            }
        } finally {
            drawerMovementBusy = false;
        }
    }

    function renderCityDrawerStat(label, value, modifierClass) {
        const mod = modifierClass ? ` age-world-city-drawer-stat--${modifierClass}` : '';
        const valueClass = value === '—' ? ' age-world-city-drawer-stat-value--empty' : '';
        return `
            <div class="age-world-city-drawer-stat${mod}">
                <dt class="age-world-city-drawer-stat-label">${label}</dt>
                <dd class="age-world-city-drawer-stat-value${valueClass}">${value}</dd>
            </div>
        `;
    }

    function openCityDrawer(cityId, clientX, clientY) {
        const city = cityById.get(cityId);
        if (!city) return;
        selectedCityId = cityId;
        playerMapCityId = resolvePlayerMapCityId();

        const holder = resolveNationName(resolveLiveCityHolder(city));
        const lastCapture = resolveLastCaptureDisplay(city);
        const lastCaptureEmpty = lastCapture === '—';
        const tierKey = String(city.settlementTier || 'city').toLowerCase();
        const tierLabel = settlementTierLabel(tierKey);
        const nationName = resolveNationName(city.nationId);

        els.drawer.dataset.settlementTier = tierKey;
        els.drawer.classList.toggle('is-capital', Boolean(city.isCapital));
        els.drawerTitle.textContent = city.name;

        if (els.drawerTierBadge) {
            els.drawerTierBadge.textContent = tierLabel;
            els.drawerTierBadge.hidden = false;
        }
        if (els.drawerCapitalBadge) {
            els.drawerCapitalBadge.hidden = !city.isCapital;
        }

        els.drawerMeta.innerHTML = `
            <dl class="age-world-city-drawer-stat-grid">
                ${renderCityDrawerStat('Nation', nationName)}
                ${renderCityDrawerStat('Terrain', city.terrain, 'terrain')}
                ${renderCityDrawerStat('Settlement Size', tierLabel, 'tier')}
                ${renderCityDrawerStat('Ownership', holder, 'holder')}
                ${renderCityDrawerStat(
                    'Last Capture',
                    lastCapture,
                    lastCaptureEmpty ? 'capture-empty' : 'capture'
                )}
            </dl>
        `;

        if (els.battleReportOpen) {
            els.battleReportOpen.disabled = !cityHasCaptureHistory(city);
            els.battleReportOpen.setAttribute(
                'aria-disabled',
                cityHasCaptureHistory(city) ? 'false' : 'true'
            );
        }

        refreshDrawerMovementActions(city);
        const borderHints = global.RoyalArmiesAgeMovement?.getBorderActionHints?.(city, playerMapCityId) || {};
        refreshDrawerScoutIntel(city, borderHints);
        setCityDrawerTab('info');

        const canScout = playerBordersCity(city);
        els.drawerStructures.innerHTML = '';
        els.drawerFog.hidden = canScout;

        if (canScout) {
            city.defensiveStructures.forEach((structure) => {
                const btn = global.document.createElement('button');
                btn.type = 'button';
                btn.className = 'age-world-structure-card';
                btn.setAttribute('aria-label', structure.label);
                btn.innerHTML = `
                    <span class="age-world-structure-card-glyph" aria-hidden="true">⛨</span>
                    <span class="age-world-structure-card-label">${structure.label}</span>
                `;
                els.drawerStructures.appendChild(btn);
            });
            if (!city.defensiveStructures.length) {
                const empty = global.document.createElement('p');
                empty.className = 'age-world-city-drawer-empty';
                empty.textContent = 'No registered defensive structures.';
                els.drawerStructures.appendChild(empty);
            }
        }

        els.drawer.hidden = false;
        els.drawer.setAttribute('aria-hidden', 'false');

        if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
            positionCityDrawer(clientX, clientY);
            global.requestAnimationFrame(() => {
                positionCityDrawer(clientX, clientY);
            });
        }
    }

    function closeCityDrawer() {
        if (!els.drawer) return;
        els.drawer.hidden = true;
        els.drawer.setAttribute('aria-hidden', 'true');
        selectedCityId = '';
        clearCityHighlight();
    }

    function openBattleReportModal() {
        const city = cityById.get(selectedCityId);
        if (!city) return;
        if (!cityHasCaptureHistory(city)) {
            els.battleModalBody.innerHTML = `
                <p class="age-world-battle-report-lead">Most recent capture — ${city.name}</p>
                <p class="age-world-battle-report-empty">No capture battles recorded for this settlement yet.</p>
            `;
        } else {
            els.battleModalBody.innerHTML = `
                <p class="age-world-battle-report-lead">Most recent capture — ${city.name}</p>
                <p>Attacker: <strong>${resolveNationName(city.holderNationId)}</strong></p>
                <p>Defender routed: <strong>${resolveLastCaptureDisplay(city)}</strong></p>
                <p class="age-world-battle-report-note">Full battle ledger will sync from NEXUS when live capture data is wired.</p>
            `;
        }
        els.battleModal.hidden = false;
        els.battleModal.setAttribute('aria-hidden', 'false');
    }

    function closeBattleReportModal() {
        if (!els.battleModal) return;
        els.battleModal.hidden = true;
        els.battleModal.setAttribute('aria-hidden', 'true');
    }

    function isMapChromeTarget(target) {
        if (!target || typeof target.closest !== 'function') return false;
        return Boolean(
            target.closest('.age-world-city-drawer')
            || target.closest('.age-world-battle-report-modal')
            || target.closest('.age-world-city-hit-path')
            || target.closest('.age-world-map-terrain-controls')
            || target.closest('.age-war-room-modal')
            || target.closest('.age-nation-hub')
        );
    }

    function setTerrainOverlayEnabled(enabled) {
        terrainOverlayOn = Boolean(enabled);
        els.frame?.classList.toggle(TERRAIN_OVERLAY_FRAME_CLASS, terrainOverlayOn);
        if (els.terrainToggle) {
            els.terrainToggle.classList.toggle('is-active', terrainOverlayOn);
            els.terrainToggle.setAttribute('aria-pressed', terrainOverlayOn ? 'true' : 'false');
            els.terrainToggle.setAttribute('aria-expanded', terrainOverlayOn ? 'true' : 'false');
        }
        if (els.terrainLegend) {
            els.terrainLegend.hidden = !terrainOverlayOn;
            els.terrainLegend.setAttribute('aria-hidden', terrainOverlayOn ? 'false' : 'true');
        }
    }

    function toggleTerrainOverlay() {
        setTerrainOverlayEnabled(!terrainOverlayOn);
    }

    function bindTerrainOverlayControls() {
        if (!els.terrainToggle || els.terrainToggle.dataset.bound === '1') return;
        els.terrainToggle.dataset.bound = '1';
        els.terrainToggle.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleTerrainOverlay();
        });
        els.terrainToggle.addEventListener('pointerdown', (event) => {
            event.stopPropagation();
        });
        setTerrainOverlayEnabled(false);
    }

    function setMapPanLockChrome(active) {
        global.document.documentElement.classList.toggle(PAN_LOCK_ROOT_CLASS, active);
    }

    function requestMapPointerLock() {
        if (!els.frame?.requestPointerLock) return;
        const lockReq = els.frame.requestPointerLock();
        if (lockReq && typeof lockReq.catch === 'function') {
            lockReq.catch(() => {});
        }
    }

    function releaseMapPointerLock() {
        if (global.document.pointerLockElement === els.frame && global.document.exitPointerLock) {
            global.document.exitPointerLock();
        }
    }

    function applyPanDelta(dx, dy) {
        if (!dragging) return;
        if (dx || dy) panMoved = true;
        if (global.document.pointerLockElement === els.frame) {
            targetTx += dx;
            targetTy += dy;
        } else if (dragStart) {
            targetTx = dragStart.tx + dx;
            targetTy = dragStart.ty + dy;
        }
        clampTargets();
        requestTick();
    }

    function startMapPan(event) {
        dragging = true;
        panMoved = false;
        dragStart = { x: event.clientX, y: event.clientY, tx: targetTx, ty: targetTy };
        els.frame.classList.add('is-dragging');
        setMapPanLockChrome(true);
        els.frame.setPointerCapture(event.pointerId);
        requestMapPointerLock();
    }

    function endMapPan(event) {
        if (!dragging) return;
        dragging = false;
        dragStart = null;
        panMoved = false;
        els.frame.classList.remove('is-dragging');
        if (event?.pointerId != null && els.frame.hasPointerCapture(event.pointerId)) {
            els.frame.releasePointerCapture(event.pointerId);
        }
        if (global.document.pointerLockElement === els.frame) {
            releaseMapPointerLock();
        } else {
            setMapPanLockChrome(false);
        }
    }

    function bindMapEvents() {
        els.frame.addEventListener(
            'wheel',
            (event) => {
                if (global.document.getElementById('age-page-canvas')?.dataset.ageView !== 'map') return;
                event.preventDefault();
                zoomAt(event.clientX, event.clientY, event.deltaY);
            },
            { passive: false }
        );

        els.frame.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            if (isMapChromeTarget(event.target)) return;
            event.preventDefault();
            startMapPan(event);
        });

        els.frame.addEventListener('pointermove', (event) => {
            if (!dragging || !dragStart) return;
            if (global.document.pointerLockElement === els.frame) {
                applyPanDelta(event.movementX, event.movementY);
                return;
            }
            applyPanDelta(event.clientX - dragStart.x, event.clientY - dragStart.y);
        });

        const endDrag = (event) => {
            endMapPan(event);
        };
        els.frame.addEventListener('pointerup', endDrag);
        els.frame.addEventListener('pointercancel', endDrag);

        global.document.addEventListener('pointerlockchange', () => {
            if (global.document.pointerLockElement === els.frame) {
                setMapPanLockChrome(true);
                return;
            }
            setMapPanLockChrome(false);
            if (dragging) {
                dragging = false;
                dragStart = null;
                panMoved = false;
                els.frame.classList.remove('is-dragging');
            }
        });

        if (els.drawerClose) {
            els.drawerClose.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                closeCityDrawer();
            });
            els.drawerClose.addEventListener('pointerdown', (event) => {
                event.stopPropagation();
            });
        }

        if (els.drawer) {
            els.drawer.addEventListener('pointerdown', (event) => {
                event.stopPropagation();
            });
        }

        global.document.getElementById('age-world-battle-report-open')?.addEventListener('click', openBattleReportModal);
        els.drawerMovementActions?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-age-city-action]');
            if (!button || button.disabled) return;
            event.preventDefault();
            const action = button.getAttribute('data-age-city-action');
            if (action === 'scout') {
                handleDrawerScoutAction();
                return;
            }
            handleDrawerMovementAction(action);
        });
        global.document.getElementById('age-world-battle-report-close')?.addEventListener('click', closeBattleReportModal);
        global.document.getElementById('age-world-battle-report-backdrop')?.addEventListener('click', closeBattleReportModal);

        global.document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            if (els.battleModal && !els.battleModal.hidden) {
                closeBattleReportModal();
                return;
            }
            if (els.drawer && !els.drawer.hidden) {
                closeCityDrawer();
            }
        });

        global.addEventListener('royalarmies:age-movement-updated', (event) => {
            if (event?.detail?.eventSource === 'guild-sync') {
                return;
            }
            playerMapCityId = global.RoyalArmiesAgeMovement?.getCatalogCityId?.() || resolvePlayerMapCityId();
            global.RoyalArmiesAgeMovementPanel?.syncCatalogCity?.(playerMapCityId);
            global.RoyalArmiesPlayerLocPins?.refreshLocalPlayerPin?.();
            refreshPlayerLocPinAndLabelCollisions();
            refreshNationCityHighlights();
            if (selectedCityId && els.drawer && !els.drawer.hidden) {
                const city = cityById.get(selectedCityId);
                if (city) {
                    refreshDrawerMovementActions(city);
                    const borderHints = global.RoyalArmiesAgeMovement?.getBorderActionHints?.(city, playerMapCityId) || {};
                    refreshDrawerScoutIntel(city, borderHints);
                }
            }
        });

        global.addEventListener('resize', () => {
            recomputeBaseScale();
        });
    }

    function cacheElements() {
        els.stage = global.document.getElementById('age-world-map');
        els.frame = global.document.getElementById('age-world-map-frame');
        els.canvas = global.document.getElementById('age-world-map-canvas');
        els.mapImage = global.document.getElementById('age-world-map-bg-image');
        els.terrainOverlay = global.document.getElementById('age-world-map-terrain-overlay');
        els.terrainToggle = global.document.getElementById('age-world-map-terrain-toggle');
        els.terrainLegend = global.document.getElementById('age-world-map-terrain-legend');
        els.svg = global.document.getElementById('age-world-map-svg');
        els.regionLayer = global.document.getElementById('age-world-map-region-layer');
        els.nationLayer = global.document.getElementById('age-world-map-nation-layer');
        els.ownershipLayer = global.document.getElementById('age-world-map-ownership-layer');
        els.visualLayer = global.document.getElementById('age-world-map-layer');
        els.hitLayer = global.document.getElementById('age-world-map-hit-layer');
        els.highlightLayer = global.document.getElementById('age-world-map-highlight-layer');
        els.highlightCanvas = global.document.getElementById('age-world-map-highlight-canvas');
        els.highlightStage = global.document.getElementById('age-world-map-highlight-stage');
        els.highlightMapSvg = global.document.getElementById('age-world-map-highlight-map');
        els.highlightSvg = global.document.getElementById('age-world-map-highlight-svg');
        els.labelsNation = global.document.getElementById('age-world-map-labels-nation');
        els.labelsCity = global.document.getElementById('age-world-map-labels-city');
        els.continentLabel = global.document.getElementById('age-world-map-continent-label');
        els.drawer = global.document.getElementById('age-world-city-drawer');
        els.drawerClose = global.document.getElementById('age-world-city-drawer-close');
        els.drawerTitle = global.document.getElementById('age-world-city-drawer-title');
        els.drawerMeta = global.document.getElementById('age-world-city-drawer-meta');
        els.drawerStructures = global.document.getElementById('age-world-city-drawer-structures');
        els.drawerFog = global.document.getElementById('age-world-city-drawer-fog');
        els.drawerTierBadge = global.document.getElementById('age-world-city-drawer-tier-badge');
        els.drawerCapitalBadge = global.document.getElementById('age-world-city-drawer-capital-badge');
        els.drawerMovementActions = global.document.getElementById('age-world-city-drawer-movement-actions');
        els.drawerScoutIntel = global.document.getElementById('age-world-city-drawer-scout-intel');
        els.drawerSideTabs = global.document.getElementById('age-world-city-drawer-side-tabs');
        els.drawerPanelInfo = global.document.getElementById('age-world-city-drawer-panel-info');
        els.drawerPanelDefenses = global.document.getElementById('age-world-city-drawer-panel-defenses');
        bindCityDrawerTabs();
        els.battleReportOpen = global.document.getElementById('age-world-battle-report-open');
        els.battleModal = global.document.getElementById('age-world-battle-report-modal');
        els.battleModalBody = global.document.getElementById('age-world-battle-report-body');
    }

    async function loadCatalog() {
        const [citiesRes, regionsRes, nationsRes] = await Promise.all([
            fetch(DATA_URL, { credentials: 'same-origin' }),
            fetch(REGION_PATHS_URL, { credentials: 'same-origin' }),
            fetch(NATION_PATHS_URL, { credentials: 'same-origin' })
        ]);

        if (!citiesRes.ok) {
            throw new Error(`Failed to load ${DATA_URL}`);
        }
        if (!regionsRes.ok) {
            throw new Error(`Failed to load ${REGION_PATHS_URL}`);
        }
        if (!nationsRes.ok) {
            throw new Error(`Failed to load ${NATION_PATHS_URL}`);
        }

        catalog = await citiesRes.json();
        global.RoyalArmiesAgeWaterRoutes?.augmentCrossBorderNeighbors?.(catalog.cities);
        const regionPayload = await regionsRes.json();
        const nationPayload = await nationsRes.json();

        regionPaths = Array.isArray(regionPayload?.regions) ? regionPayload.regions : [];
        nationPaths = Array.isArray(nationPayload?.nations) ? nationPayload.nations : [];

        cityById = new Map(catalog.cities.map((city) => [city.id, city]));
        nationById = new Map(catalog.nations.map((nation) => [nation.id, nation]));
    }

    async function enableAgeWorldMap() {
        cacheElements();
        ensureOwnershipLayer();
        if (
            !els.frame
            || !els.canvas
            || !els.regionLayer
            || !els.nationLayer
            || !els.visualLayer
            || !els.hitLayer
            || !els.highlightLayer
            || !els.highlightCanvas
            || !els.highlightStage
            || !els.highlightMapSvg
        ) {
            return;
        }

        await loadCatalog();
        if (global.RoyalArmiesAgeWaterRoutes?.loadRoutes) {
            await global.RoyalArmiesAgeWaterRoutes.loadRoutes();
        }
        buildSvgLayers();
        buildWaterRoutesLayer();
        ensureLabelLayersMounted();
        bindTerrainOverlayControls();
        enablePlayerLocPins();
        applyTransform();
        bindMapEvents();
        global.requestAnimationFrame(() => {
            recomputeBaseScale();
        });
        closeCityDrawer();
        closeBattleReportModal();
        playerMapCityId = resolvePlayerMapCityId();
        refreshPlayerLocPinAndLabelCollisions();
        refreshNationCityHighlights();
    }

    function onViewModeChange(viewId) {
        if (viewId !== 'map') {
            setTerrainOverlayEnabled(false);
        }
        if (viewId === 'map') {
            global.requestAnimationFrame(() => {
                recomputeBaseScale();
            });
        }
    }

    global.RoyalArmiesAgeWorldMap = {
        enable: enableAgeWorldMap,
        onViewModeChange,
        setTerrainOverlayEnabled,
        refreshPlayerCity: () => {
            playerMapCityId = resolvePlayerMapCityId();
            refreshPlayerLocPinAndLabelCollisions();
            syncPlayerCityPinHitTarget();
        },
        refreshNationCityHighlights,
        getCatalog: () => catalog,
        mapPointToFramePixels
    };
    global.enableAgeWorldMap = enableAgeWorldMap;
})(window);

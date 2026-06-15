/**
 * RIFT — Amnek world map: city SVG overlay, smooth zoom/pan, semantic labels, city intel drawer.
 *
 * Settlement terrain tags: Forest, Plains, Desert, Mountains only. Snow is not on this map.
 */
(function initAgeWorldMap(global) {
    'use strict';

    const DATA_URL = 'data/age-world-cities.json?v=zevros-cities-1';
    const REGION_PATHS_URL = 'data/age-world-region-paths.json?v=map-label-centroids-1';
    const NATION_PATHS_URL = 'data/game-nation-paths.json?v=veyanor-restore-1';
    const NATIVE_SIZE = 1642;
    const LERP = 0.12;
    const ZOOM_SETTLE_EPS_SCALE = 0.0004;
    const ZOOM_SETTLE_EPS_PX = 0.25;
    const BORDER_SYNC_RATIO_STEP = 0.035;
    const OWNERSHIP_ZOOM_OPACITY_STEP = 0.025;
    const MAP_TRANSFORM_EVENT_INTERVAL = 4;
    const WHEEL_ZOOM_FACTOR = 0.00135;
    const MAX_ZOOM_MULT = 3.35;
    const CONTINENT_FADE_END = 1.1;
    const NATION_FADE_START = 1.1;
    const NATION_FADE_PEAK = 1.35;
    const CITY_FADE_START = 1.85;
    const CITY_FADE_FULL = 2.75;
    const CITY_BORDER_FADE_IN_START = 1.54;
    const CITY_BORDER_FADE_IN_END = 1.82;
    const SMALL_CITY_HIT_RADIUS = 14;
    const MAP_PAN_CLICK_THRESHOLD_PX = 6;
    const SETTLEMENT_HIT_TIER_PRIORITY = {
        citadel: 0,
        kingdom: 1,
        city: 2,
        town: 3,
        village: 4
    };
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
    const VIEWPORT_CLEAR_X = 0.30;
    const VIEWPORT_CLEAR_Y = 0.24;
    /** Distance beyond the clear zone (fraction of min frame size) where labels reach 0 opacity. */
    const VIEWPORT_FADE_OUTER = 0.46;
    const TERRAIN_OVERLAY_FRAME_CLASS = 'is-terrain-overlay-on';
    const COLOR_MAP_FRAME_CLASS = 'is-color-map-on';
    const COLOR_MAP_NATIONS_CLASS = 'is-color-map-nations';
    const COLOR_MAP_TERRAIN_CLASS = 'is-color-map-terrain';
    const COLOR_MAP_BACKDROP_FILL = '#182430';
    const COLOR_MAP_MODES = Object.freeze({
        off: 'off',
        nations: 'nations',
        terrain: 'terrain'
    });
    const MAP_STYLE_MODES = Object.freeze({
        topology: 'topology',
        color: 'color'
    });
    /** Matches movement-panel terrain name border colors (age-movement-terrain-name--*). */
    const TERRAIN_FILL_COLORS = Object.freeze({
        forest: 'rgba(52, 128, 68, 0.68)',
        plains: 'rgba(126, 186, 78, 0.68)',
        desert: 'rgba(210, 165, 90, 0.68)',
        mountains: 'rgba(136, 118, 96, 0.68)',
        marshlands: 'rgba(48, 138, 158, 0.68)',
        snow: 'rgba(236, 244, 252, 0.68)'
    });
    const OWNERSHIP_TINT = {
        own: {
            fill: 'rgba(255, 196, 48, 0.24)',
            stroke: 'rgba(255, 228, 120, 1)'
        },
        ally: {
            fill: 'rgba(64, 128, 255, 0.24)',
            stroke: 'rgba(120, 176, 255, 1)'
        },
        nap: {
            fill: 'rgba(140, 210, 255, 0.24)',
            stroke: 'rgba(190, 232, 255, 1)'
        },
        enemy: {
            fill: 'rgba(220, 72, 72, 0.24)',
            stroke: 'rgba(255, 120, 120, 1)'
        },
        neutral: {
            fill: 'rgba(168, 168, 168, 0.24)',
            stroke: 'rgba(0, 0, 0, 0.85)'
        },
        none: {
            fill: 'transparent',
            stroke: 'transparent'
        }
    };
    const OWNERSHIP_CLASS_NAMES = Object.freeze([
        'is-nation-own',
        'is-nation-ally',
        'is-nation-nap',
        'is-nation-enemy',
        'is-nation-neutral',
        'is-player-city'
    ]);
    const CITY_SETTLEMENT_OUTLINE_STROKE = 'rgba(0, 0, 0, 0.85)';
    const COLOR_MAP_CITY_BORDER_STROKE = '#000000';

    const els = {
        stage: null,
        frame: null,
        canvas: null,
        mapImage: null,
        terrainOverlay: null,
        terrainToggle: null,
        terrainLegend: null,
        colorBackdrop: null,
        colorLayer: null,
        colorLayerNations: null,
        colorLayerTerrain: null,
        styleToggle: null,
        colorLegend: null,
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
        labelsRegion: null,
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
        infiltrateOpen: null,
        battleModal: null,
        battleModalBody: null,
        cloudLayer: null,
        cloudEyeVeil: null,
        rainLayer: null,
        surfaceFogLayer: null,
        sunLayer: null,
        daylightLayer: null,
        daylightBase: null,
        daylightSweep: null,
        nightLayer: null,
        nightShadeHoles: null
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
    let labelOpacities = { continent: 1, region: 0, nation: 0, city: 0 };
    let labelsRegionMounted = false;
    let labelsNationMounted = false;
    let labelsCityMounted = false;
    let hoveredCityId = '';
    let planCityPickMode = false;
    let planPressCityId = '';
    let planClickHandledSeq = 0;
    let mapCityPointerUpHandled = false;
    let mapPressCityId = '';
    let layoutBaseW = 0;
    let layoutBaseH = 0;
    let mapStyleMode = MAP_STYLE_MODES.topology;
    let lastAmbientMapStyleMode = '';
    let terrainDetailOn = false;
    let terrainOverlayOn = false;
    let colorMapMode = COLOR_MAP_MODES.off;
    let drawerActiveTab = 'info';
    let diplomacyNationSets = {
        allies: new Set(),
        naps: new Set(),
        enemies: new Set()
    };
    let diplomacyRefreshPromise = null;
    let mapScreenTransformCache = null;
    let mapSvgPoint = null;
    let lastBorderSyncKey = '';
    let lastOwnershipZoomOpacity = -1;
    let mapTransformEventFrame = 0;

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
            continent: 1 - fadeRange(ratio, 1, CONTINENT_FADE_END),
            region: 1 - nationIn,
            nation: nationIn * (1 - cityIn),
            city: cityIn
        };
    }

    function resolveTypoPhase(opacities) {
        if (opacities.city >= opacities.nation && opacities.city >= opacities.region && opacities.city >= opacities.continent) {
            return 'city';
        }
        if (opacities.nation >= opacities.region && opacities.nation >= opacities.continent) return 'nation';
        if (opacities.region >= opacities.continent) return 'region';
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

    function resolveLabelHostLayerOpacity(container) {
        if (container === els.labelsRegion) {
            return labelOpacities.region;
        }
        if (container === els.labelsNation) {
            return labelOpacities.nation;
        }
        if (container === els.labelsCity) {
            return labelOpacities.city;
        }
        return Number(container?.style.opacity || 0);
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

    function resolveActivePlayerCatalogCityId() {
        const movementCityId = global.RoyalArmiesAgeMovement?.getCatalogCityId?.();
        if (movementCityId && cityById.has(movementCityId)) {
            return movementCityId;
        }

        const fallbackCityId = resolvePlayerMapCityId();
        if (fallbackCityId && cityById.has(fallbackCityId)) {
            return fallbackCityId;
        }

        return movementCityId || fallbackCityId || '';
    }

    function syncPlayerMapCityFromMovement() {
        playerMapCityId = resolveActivePlayerCatalogCityId();
        return playerMapCityId;
    }

    async function refreshDrawerMovementContext(cityId) {
        const movement = global.RoyalArmiesAgeMovement;
        if (!movement || !cityId) return;

        if (typeof movement.ensureMovementStateSynced === 'function') {
            await movement.ensureMovementStateSynced();
        } else if (typeof movement.refresh === 'function') {
            await movement.refresh();
        }

        if (selectedCityId !== cityId) return;

        syncPlayerMapCityFromMovement();
        const city = cityById.get(cityId);
        if (!city || !els.drawer || els.drawer.hidden) return;

        refreshDrawerMovementActions(city);
        const borderHints = movement.getBorderActionHints?.(city, resolveActivePlayerCatalogCityId()) || {};
        refreshDrawerWatchtowerButton(city, borderHints);
        refreshDrawerInfiltrateButton(city);
        refreshDrawerScoutIntel(city, borderHints);
        void refreshDrawerAssaultRisk(city, borderHints);
    }

    function isMaskedCity(city) {
        return Boolean(city?.masked);
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

    let rainMapAnchorCache = null;

    function computeRainMapAnchor() {
        if (!els.svg) return null;
        const vb = els.svg.viewBox.baseVal;
        const pxPerUnit = mapPixelsPerMapUnit(vb.x + vb.width / 2, vb.y + vb.height / 2);
        if (!pxPerUnit) return null;
        const tileOffset = (mapUnits, tileSize) => {
            const px = mapUnits * pxPerUnit;
            return -((px % tileSize) + tileSize) % tileSize;
        };
        return {
            near: `${tileOffset(vb.x, 260)}px ${tileOffset(vb.y, 260)}px`,
            far: `${tileOffset(vb.x, 200)}px ${tileOffset(vb.y, 200)}px`
        };
    }

    function syncRainMapAnchor() {
        const layer = els.rainLayer;
        if (!layer || !els.svg) return;
        const zoomAnimating = Math.abs(scale - targetScale) > 0.0005;
        if (!zoomAnimating) {
            const next = computeRainMapAnchor();
            if (next) rainMapAnchorCache = next;
        } else if (!rainMapAnchorCache) {
            rainMapAnchorCache = computeRainMapAnchor();
        }
        const anchor = rainMapAnchorCache;
        if (!anchor) return;
        layer.querySelectorAll('.age-world-map-rain-fall--a, .age-world-map-rain-fall--b').forEach((node) => {
            node.style.backgroundPosition = anchor.near;
        });
        layer.querySelectorAll('.age-world-map-rain-fall--c, .age-world-map-rain-fall--d').forEach((node) => {
            node.style.backgroundPosition = anchor.far;
        });
    }

    function applyTransform(options = {}) {
        if (!els.canvas) return;
        labelOpacities = resolveLabelOpacities(scaleRatio());
        const zoomAnimating = options.zoomAnimating ?? isMapScaleAnimating();
        invalidateMapScreenTransformCache();
        els.canvas.style.transform = '';
        syncMapViewBox();
        syncRainMapAnchor();
        if (Math.abs(scale - targetScale) > 0.0005 || rainZoomHoldFrames > 0) {
            syncRainLayer();
            requestRainEffectTick();
        }
        syncLabelScreenPositions();
        if (fogSurfaceLightsActive()) {
            syncFogSurfaceLights();
        }
        syncBorderVisuals({ zoomAnimating, force: Boolean(options.force) });
        if (!zoomAnimating && typeof global.RoyalArmiesAgeWorldPlanOverlay?.syncLayout === 'function') {
            global.RoyalArmiesAgeWorldPlanOverlay.syncLayout();
        }
        dispatchMapTransformEvents(zoomAnimating, Boolean(options.force));
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

    function invalidateMapScreenTransformCache() {
        mapScreenTransformCache = null;
    }

    function resolveMapScreenTransformCache() {
        if (mapScreenTransformCache) {
            return mapScreenTransformCache;
        }
        if (!els.svg) {
            return null;
        }

        const matrix = els.svg.getScreenCTM();
        if (!matrix) {
            return null;
        }

        const hostRect = mapOverlayHostRect();
        mapScreenTransformCache = {
            matrix,
            hostLeft: hostRect.left,
            hostTop: hostRect.top
        };
        return mapScreenTransformCache;
    }

    function mapPointToFramePixels(mapX, mapY) {
        const cache = resolveMapScreenTransformCache();
        if (!cache || !els.svg) {
            return { x: 0, y: 0 };
        }

        if (!mapSvgPoint && typeof els.svg.createSVGPoint === 'function') {
            mapSvgPoint = els.svg.createSVGPoint();
        }
        if (!mapSvgPoint) {
            return { x: 0, y: 0 };
        }

        mapSvgPoint.x = mapX;
        mapSvgPoint.y = mapY;
        const screen = mapSvgPoint.matrixTransform(cache.matrix);
        return {
            x: screen.x - cache.hostLeft,
            y: screen.y - cache.hostTop
        };
    }

    function isMapScaleAnimating() {
        return Math.abs(targetScale - scale) > ZOOM_SETTLE_EPS_SCALE;
    }

    function isMapMotionAnimating() {
        return isMapScaleAnimating()
            || Math.abs(targetTx - tx) > ZOOM_SETTLE_EPS_PX
            || Math.abs(targetTy - ty) > ZOOM_SETTLE_EPS_PX;
    }

    function dispatchMapTransformEvents(zoomAnimating, force) {
        if (force) {
            mapTransformEventFrame = 0;
            global.dispatchEvent(new CustomEvent('royalarmies:age-map-overlay-layout'));
            global.dispatchEvent(new CustomEvent('royalarmies:age-map-transform'));
            return;
        }

        mapTransformEventFrame += 1;
        if (!zoomAnimating || mapTransformEventFrame % MAP_TRANSFORM_EVENT_INTERVAL === 0) {
            global.dispatchEvent(new CustomEvent('royalarmies:age-map-overlay-layout'));
            global.dispatchEvent(new CustomEvent('royalarmies:age-map-transform'));
        }
    }

    function mapCentroidToFramePixels(centroid) {
        return mapPointToFramePixels(centroid.x, centroid.y);
    }

    function labelPosition(centroid) {
        const point = mapCentroidToFramePixels(centroid);
        return { left: `${point.x}px`, top: `${point.y}px` };
    }

    function syncLabelScreenPositions() {
        // Always track map coordinates on every transform tick — even when a label
        // layer is fully transparent. Otherwise fade-in reuses stale left/top from
        // the last zoom level and names float offset until the layer stays visible.
        if (els.labelsRegion) syncLabelHostPositions(els.labelsRegion);
        if (els.labelsNation) syncLabelHostPositions(els.labelsNation);
        if (els.labelsCity) syncLabelHostPositions(els.labelsCity);
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
        const layerOpacity = resolveLabelHostLayerOpacity(container);
        const layerVisible = labelLayerIsVisible(layerOpacity);
        const labelSelector = container === els.labelsCity
            ? '.age-world-map-label--city[data-centroid-x]'
            : '.age-world-map-label[data-centroid-x]';

        const hostRect = mapOverlayHostRect();
        const hostW = hostRect.width || mapOverlayHostEl()?.clientWidth || els.frame.clientWidth;
        const hostH = hostRect.height || mapOverlayHostEl()?.clientHeight || els.frame.clientHeight;

        container.querySelectorAll(labelSelector).forEach((node) => {
            const centroid = {
                x: Number(node.dataset.centroidX),
                y: Number(node.dataset.centroidY)
            };
            if (!Number.isFinite(centroid.x) || !Number.isFinite(centroid.y)) return;

            const point = mapCentroidToFramePixels(centroid);
            node.style.left = `${point.x}px`;
            node.style.top = `${point.y}px`;

            if (!layerVisible) {
                node.style.opacity = '0';
                node.style.visibility = 'hidden';
                return;
            }

            const offsetX = Number(node.dataset.offsetX || 0);
            const offsetY = Number(node.dataset.offsetY || 0);
            const frameX = point.x + offsetX;
            const frameY = point.y + offsetY;

            if (container === els.labelsRegion) {
                if (node.dataset.collisionSuppressed === '1') {
                    node.style.opacity = '0';
                    node.style.visibility = 'hidden';
                    return;
                }
                const viewportFade = resolveLabelViewportFade(frameX, frameY, hostW, hostH);
                const visible = viewportFade > 0.02;
                node.style.opacity = visible ? '1' : '0';
                node.style.visibility = visible ? 'visible' : 'hidden';
                return;
            }

            applyLabelViewportFade(node, frameX, frameY, hostW, hostH);

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

        if (els.regionLayer) {
            const group = els.regionLayer.querySelector(
                `.age-world-region-border[data-region-id="${CSS.escape(regionId)}"]`
            );
            if (group) {
                const pathDataList = Array.from(group.querySelectorAll('path'))
                    .map((pathEl) => pathEl.getAttribute('d') || '')
                    .filter(Boolean);
                const center = resolveSvgPathDataBBoxCenter(pathDataList, els.svg);
                if (center) return center;
            }
        }

        if (region && els.svg) {
            return resolveSvgPathDataBBoxCenter(resolveRegionPathDataList(region), els.svg);
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

    function resolveNationLabelCentroid(nationId) {
        const normalizedId = String(nationId || '').trim().toLowerCase();
        const cities = (catalog?.cities || []).filter((city) => (
            String(city.nationId || '').trim().toLowerCase() === normalizedId && city.centroid
        ));

        if (cities.length) {
            let sumX = 0;
            let sumY = 0;
            cities.forEach((city) => {
                sumX += city.centroid.x;
                sumY += city.centroid.y;
            });
            return { x: sumX / cities.length, y: sumY / cities.length };
        }

        const catalogNation = catalog?.nations?.find((nation) => (
            String(nation.id || '').trim().toLowerCase() === normalizedId
        ));
        return catalogNation?.centroid || null;
    }

    function ensureLabelsRegionHost() {
        if (els.labelsRegion) return;
        const existing = global.document.getElementById('age-world-map-labels-region');
        if (existing) {
            els.labelsRegion = existing;
            return;
        }
        if (!els.frame) return;

        const host = global.document.createElement('div');
        host.id = 'age-world-map-labels-region';
        host.className = 'age-world-map-labels-host age-world-map-labels-host--region';
        host.setAttribute('aria-hidden', 'true');
        if (els.labelsNation?.parentNode) {
            els.labelsNation.parentNode.insertBefore(host, els.labelsNation);
        } else {
            els.frame.appendChild(host);
        }
        els.labelsRegion = host;
    }

    function isColorMapStyleActive() {
        return mapStyleMode === MAP_STYLE_MODES.color;
    }

    function resolveRegionBorderOpacity(_ratio) {
        return 0;
    }

    /** Settlement outlines fade in only after region borders have cleared. */
    function resolveCityBorderOpacity(ratio) {
        if (isColorMapStyleActive()) {
            return 1;
        }
        return smoothstep(fadeRange(ratio, CITY_BORDER_FADE_IN_START, CITY_BORDER_FADE_IN_END));
    }

    function resolveBorderOpacities(ratio) {
        return {
            region: resolveRegionBorderOpacity(ratio),
            nation: 0,
            city: resolveCityBorderOpacity(ratio)
        };
    }

    function applyBorderElementOpacity(node, mapX, mapY, tierOpacity, frameW, frameH, skipViewportFade) {
        if (!node) return;
        if (isColorMapStyleActive() && node.classList.contains('age-world-city-border-path')) {
            node.style.opacity = '1';
            node.style.visibility = 'visible';
            return;
        }
        let opacity = tierOpacity;
        if (!skipViewportFade) {
            const point = mapPointToFramePixels(mapX, mapY);
            const viewportFade = resolveLabelViewportFade(point.x, point.y, frameW, frameH);
            opacity = tierOpacity * viewportFade;
        }
        node.style.opacity = String(opacity);
        node.style.visibility = opacity > 0.008 ? 'visible' : 'hidden';
    }

    function applyRegionBorderGroupOpacity(group, opacity) {
        if (!group) return;
        group.style.opacity = String(opacity);
        group.style.visibility = opacity > 0.008 ? 'visible' : 'hidden';
    }

    function syncBorderLayer(layer, tierOpacity, frameW, frameH, skipViewportFade) {
        if (!layer) return;
        layer.querySelectorAll('[data-centroid-x][data-centroid-y]').forEach((node) => {
            const mapX = Number(node.dataset.centroidX);
            const mapY = Number(node.dataset.centroidY);
            if (!Number.isFinite(mapX) || !Number.isFinite(mapY)) return;
            applyBorderElementOpacity(node, mapX, mapY, tierOpacity, frameW, frameH, skipViewportFade);
        });
    }

    function syncRegionBorderLayer(layer, tierOpacity, frameW, frameH, skipViewportFade) {
        if (!layer) return;
        layer.querySelectorAll('.age-world-region-border').forEach((group) => {
            const mapX = Number(group.dataset.centroidX);
            const mapY = Number(group.dataset.centroidY);
            let opacity = tierOpacity;
            if (!skipViewportFade && Number.isFinite(mapX) && Number.isFinite(mapY)) {
                const point = mapPointToFramePixels(mapX, mapY);
                const viewportFade = resolveLabelViewportFade(point.x, point.y, frameW, frameH);
                opacity = tierOpacity * viewportFade;
            }
            applyRegionBorderGroupOpacity(group, opacity);
        });
    }

    function resolveTopologyOwnershipOpacity() {
        return fadeRange(scaleRatio(), CITY_FADE_START, CITY_FADE_FULL);
    }

    function applyOwnershipTint(node, kind) {
        if (!node) return;
        const palette = OWNERSHIP_TINT[kind] || OWNERSHIP_TINT.none;
        const colorMapOn = colorMapMode !== COLOR_MAP_MODES.off;
        const isPlayerCity = node.classList.contains('is-player-city');

        if (colorMapOn && isPlayerCity) {
            node.setAttribute('fill', 'transparent');
            node.setAttribute('stroke', COLOR_MAP_CITY_BORDER_STROKE);
            node.setAttribute('stroke-width', '1.5');
            node.style.opacity = '1';
            node.style.visibility = 'visible';
            return;
        }

        if (kind === 'none') {
            node.setAttribute('fill', palette.fill);
            node.setAttribute('stroke', palette.stroke);
            node.setAttribute('stroke-width', '2.5');
            node.style.opacity = '0';
            node.style.visibility = 'hidden';
            return;
        }
        if (colorMapOn) {
            if (kind === 'none' && !isPlayerCity) {
                node.setAttribute('fill', 'transparent');
                node.setAttribute('stroke', 'transparent');
                node.style.opacity = '0';
                node.style.visibility = 'hidden';
                return;
            }

            node.setAttribute('fill', 'transparent');
            node.setAttribute('stroke', COLOR_MAP_CITY_BORDER_STROKE);
            node.setAttribute('stroke-width', '1.5');
            node.style.opacity = '1';
            node.style.visibility = 'visible';
            return;
        }

        node.setAttribute('fill', palette.fill);
        node.setAttribute('stroke', palette.stroke);
        node.setAttribute('stroke-width', '2.5');
        node.style.removeProperty('opacity');
        node.style.removeProperty('visibility');
    }

    function syncOwnershipZoomOpacity(ratio, force) {
        if (!els.frame || isColorMapStyleActive()) return;

        const zoomOpacity = fadeRange(ratio, CITY_FADE_START, CITY_FADE_FULL);
        const bucket = Math.round(zoomOpacity / OWNERSHIP_ZOOM_OPACITY_STEP) * OWNERSHIP_ZOOM_OPACITY_STEP;
        if (!force && bucket === lastOwnershipZoomOpacity) return;
        lastOwnershipZoomOpacity = bucket;
        els.frame.style.setProperty('--age-topology-ownership-opacity', String(bucket));
    }

    function resolveOwnershipKindFromNode(node) {
        if (!node) return 'none';
        if (node.classList.contains('is-nation-own')) return 'own';
        if (node.classList.contains('is-nation-ally')) return 'ally';
        if (node.classList.contains('is-nation-nap')) return 'nap';
        if (node.classList.contains('is-nation-enemy')) return 'enemy';
        if (node.classList.contains('is-nation-neutral')) return 'neutral';
        return 'none';
    }

    function syncOwnershipVisuals() {
        if (!els.ownershipLayer) return;
        els.ownershipLayer.querySelectorAll('.age-world-city-ownership-path').forEach((node) => {
            applyOwnershipTint(node, resolveOwnershipKindFromNode(node));
        });
    }

    function resolveWaterRouteOpacity(ratio) {
        const fadeIn = fadeRange(ratio, NATION_FADE_PEAK, CITY_FADE_START);
        return fadeIn;
    }

    function syncColorMapCityBorders() {
        if (!isColorMapStyleActive()) return;

        if (els.visualLayer) {
            els.visualLayer.querySelectorAll('.age-world-city-border-path').forEach((node) => {
                node.style.opacity = '1';
                node.style.visibility = 'visible';
                applyCityBorderRelationshipStroke(node);
            });
        }

        [els.colorLayerNations, els.colorLayerTerrain].forEach((layer) => {
            if (!layer) return;
            layer.querySelectorAll('.age-world-nation-color-fill, .age-world-terrain-color-fill').forEach((node) => {
                node.style.opacity = '1';
                node.style.visibility = 'visible';
            });
        });
    }

    function syncBorderVisuals(options = {}) {
        if (!els.frame) return;

        const scaleAnimating = options.zoomAnimating ?? isMapScaleAnimating();
        const force = Boolean(options.force);
        const ratio = scaleRatio();
        const colorMapOn = isColorMapStyleActive();
        const syncKey = [
            Math.round(ratio / BORDER_SYNC_RATIO_STEP),
            scaleAnimating ? 'z' : 's',
            colorMapOn ? 'c' : 't'
        ].join('|');

        if (!colorMapOn) {
            syncOwnershipZoomOpacity(ratio, force);
        } else if (force) {
            syncOwnershipVisuals();
        }

        if (!force && !scaleAnimating && syncKey === lastBorderSyncKey) {
            return;
        }
        lastBorderSyncKey = syncKey;

        const hostRect = mapOverlayHostRect();
        const hostW = hostRect.width || mapOverlayHostEl()?.clientWidth || els.frame.clientWidth;
        const hostH = hostRect.height || mapOverlayHostEl()?.clientHeight || els.frame.clientHeight;
        const borderOpacities = resolveBorderOpacities(ratio);
        const waterRouteOpacity = resolveWaterRouteOpacity(ratio);
        const skipViewportFade = scaleAnimating && !colorMapOn;

        syncRegionBorderLayer(els.regionLayer, borderOpacities.region, hostW, hostH, skipViewportFade);
        syncBorderLayer(els.nationLayer, borderOpacities.nation, hostW, hostH, skipViewportFade);
        if (colorMapOn) {
            syncColorMapCityBorders();
            if (force) {
                syncOwnershipVisuals();
            }
        } else {
            syncBorderLayer(els.visualLayer, borderOpacities.city, hostW, hostH, skipViewportFade);
        }
        syncBorderLayer(els.waterRoutesLayer, waterRouteOpacity, hostW, hostH, skipViewportFade);
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

        const motionAnimating = Math.abs(ds) >= ZOOM_SETTLE_EPS_SCALE
            || Math.abs(dx) >= ZOOM_SETTLE_EPS_PX
            || Math.abs(dy) >= ZOOM_SETTLE_EPS_PX;
        const scaleAnimating = Math.abs(ds) >= ZOOM_SETTLE_EPS_SCALE;

        if (!motionAnimating) {
            scale = targetScale;
            tx = targetTx;
            ty = targetTy;
            rafId = 0;
        } else {
            rafId = global.requestAnimationFrame(tick);
        }

        els.frame?.classList.toggle('is-zoom-animating', scaleAnimating);
        labelOpacities = resolveLabelOpacities(scaleRatio());
        applyTransform({ zoomAnimating: scaleAnimating });
        syncTypography({ zoomAnimating: scaleAnimating, skipClouds: true });
        if (isMapAmbientEffectsEnabled()) {
            syncCloudLayer({ zoomAnimating: scaleAnimating });
        }

        if (!rafId) {
            lastBorderSyncKey = '';
            lastOwnershipZoomOpacity = -1;
            applyTransform({ zoomAnimating: false, force: true });
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
        rainMapAnchorCache = null;
        rainRafId = 0;
        invalidateRainFallAnims();
        rainPlaybackRate = 1;
        rainZoomDirection = 0;
        rainZoomHoldFrames = 0;
        lastRainPlaybackApplied = -1;
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

    function focusOnMapCoordinates(mapX, mapY, options = {}) {
        if (!els.frame || !Number.isFinite(mapX) || !Number.isFinite(mapY)) {
            return false;
        }

        measureLayoutBase();
        const preserveZoom = Boolean(options.preserveZoom) && !options.zoomToMax;
        const nextScale = options.zoomToMax
            ? maxScale
            : preserveZoom
                ? clamp(targetScale, minScale, maxScale)
                : clamp(
                    (Number.isFinite(Number(options.zoomScale)) && Number(options.zoomScale) > 0
                        ? Number(options.zoomScale)
                        : 2.15) * baseScale,
                    minScale,
                    maxScale
                );
        const vp = mapViewportMetrics();
        const vbW = NATIVE_SIZE / nextScale;
        const vbH = NATIVE_SIZE / nextScale;
        const maxVbX = Math.max(0, NATIVE_SIZE - vbW);
        const maxVbY = Math.max(0, NATIVE_SIZE - vbH);
        const vbX = clamp(mapX - vbW / 2, 0, maxVbX);
        const vbY = clamp(mapY - vbH / 2, 0, maxVbY);

        targetScale = nextScale;
        targetTx = -targetScale * (vp.meetScale * vbX + vp.offsetX);
        targetTy = -targetScale * (vp.meetScale * vbY + vp.offsetY);
        clampTargets();
        requestTick();
        return true;
    }

    function focusOnPlannerLocation(options = {}) {
        const cityId = global.RoyalArmiesAgeMovement?.getCatalogCityId?.()
            || playerMapCityId
            || resolvePlayerMapCityId();
        const city = cityId ? cityById.get(cityId) : null;
        if (!city?.centroid) {
            return false;
        }
        return focusOnMapCoordinates(city.centroid.x, city.centroid.y, options);
    }

    const SEARCH_FOCUS_ZOOM_BY_TIER = {
        citadel: 2.55,
        kingdom: 2.35,
        city: 2.2,
        town: 2.05,
        village: 1.95
    };
    // Fixed map zoom for travel redirects — not tier-based, so chain travel does not step zoom in.
    const MOVEMENT_REDIRECT_ZOOM_RATIO = 2.15;

    let searchHighlightClearTimer = 0;

    const CITY_HIGHLIGHT_INTERACTION_CLASSES = [
        'is-active',
        'is-selected-city',
        'is-restricted-selected-city',
        'is-bordering-neighbor',
        'is-restricted-neighbor'
    ];

    function isCityDrawerOpen() {
        return Boolean(els.drawer && !els.drawer.hidden);
    }

    function toggleCityDrawerFromClick(cityId, clientX, clientY) {
        if (selectedCityId === cityId && isCityDrawerOpen()) {
            closeCityDrawer();
            return;
        }
        setDrawerMovementStatus('');
        openCityDrawer(cityId, clientX, clientY);
    }

    function resolveBorderingCityIds(cityId) {
        const city = cityById.get(cityId);
        if (!city || !Array.isArray(city.neighbors)) return [];
        return city.neighbors.filter((neighborId) => cityById.has(neighborId));
    }

    function forEachCityHighlightNode(cityId, callback) {
        if (!cityId || !els.highlightLayer || typeof callback !== 'function') return;
        els.highlightLayer.querySelectorAll(
            `.age-world-city-highlight-path[data-city-id="${cityId}"], `
            + `.age-world-city-highlight-boost[data-city-id="${cityId}"]`
        ).forEach(callback);
    }

    function clearCitySearchHighlight(cityId) {
        if (!els.highlightLayer) return;
        const selector = cityId
            ? (
                `.age-world-city-highlight-path[data-city-id="${cityId}"], `
                + `.age-world-city-highlight-boost[data-city-id="${cityId}"]`
            )
            : '.age-world-city-highlight-path.is-search-center-flash, .age-world-city-highlight-boost.is-search-center-flash';
        els.highlightLayer.querySelectorAll(selector).forEach((node) => {
            node.classList.remove('is-search-center-flash');
            CITY_HIGHLIGHT_INTERACTION_CLASSES.forEach((className) => {
                node.classList.remove(className);
            });
        });
    }

    function flashCitySearchHighlight(cityId, durationMs = 3200) {
        if (!cityId || !els.highlightLayer) return;
        if (searchHighlightClearTimer) {
            global.clearTimeout(searchHighlightClearTimer);
            searchHighlightClearTimer = 0;
        }
        clearCitySearchHighlight('');
        els.highlightLayer.querySelectorAll(
            `.age-world-city-highlight-path[data-city-id="${cityId}"], `
            + `.age-world-city-highlight-boost[data-city-id="${cityId}"]`
        ).forEach((node) => {
            node.classList.remove('is-search-center-flash');
            void node.offsetWidth;
            node.classList.add('is-search-center-flash', 'is-active');
        });
        searchHighlightClearTimer = global.setTimeout(() => {
            clearCitySearchHighlight(cityId);
            searchHighlightClearTimer = 0;
        }, durationMs);
    }

    function resolveSearchZoomScale(city, options = {}) {
        if (Number.isFinite(Number(options.zoomScale)) && Number(options.zoomScale) > 0) {
            return Number(options.zoomScale);
        }
        const tier = String(city?.settlementTier || 'city').trim().toLowerCase();
        return SEARCH_FOCUS_ZOOM_BY_TIER[tier] ?? 2.2;
    }

    function focusOnCity(cityId, options = {}) {
        const city = cityById.get(cityId);
        if (!city?.centroid) return false;
        const movementRedirect = Boolean(options.movementRedirect);
        const ok = focusOnMapCoordinates(city.centroid.x, city.centroid.y, {
            zoomScale: movementRedirect
                ? MOVEMENT_REDIRECT_ZOOM_RATIO
                : resolveSearchZoomScale(city, options),
            zoomToMax: Boolean(options.zoomToMax),
            preserveZoom: Boolean(options.preserveZoom) && !movementRedirect && !options.zoomToMax
        });
        if (ok && options.highlight !== false) {
            flashCitySearchHighlight(cityId, options.highlightMs ?? 3200);
        }
        return ok;
    }

    function resolveCityByQuery(query) {
        const q = String(query || '').trim().toLowerCase();
        if (!q || !catalog?.cities?.length) return null;

        const slug = q.replace(/\s+/g, '-');
        const cities = catalog.cities;
        const scoreCity = (city) => {
            const name = String(city.name || '').trim().toLowerCase();
            const id = String(city.id || '').trim().toLowerCase();
            const shortId = id.replace(/^[^-]+-/, '');
            if (name === q || id === q || shortId === q || shortId === slug) return 0;
            if (name.startsWith(q) || shortId.startsWith(slug)) return 1;
            if (name.includes(q) || id.includes(q) || shortId.includes(slug)) return 2;
            return 99;
        };

        let best = null;
        let bestScore = 99;
        cities.forEach((city) => {
            const score = scoreCity(city);
            if (score >= bestScore) return;
            bestScore = score;
            best = city;
        });

        return bestScore < 99 ? best : null;
    }

    function ensureLabelLayersMounted() {
        if (!catalog) return;

        ensureLabelsRegionHost();

        if (els.labelsRegion && !labelsRegionMounted) {
            els.labelsRegion.hidden = false;
            els.labelsRegion.innerHTML = '';
            mountRegionLabels(els.labelsRegion);
            labelsRegionMounted = true;
        }

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
        // Region pills stay fully opaque whenever the layer is shown — zoom and
        // viewport only toggle visibility, never partial transparency.
        if (node === els.labelsRegion) {
            node.style.opacity = '1';
        } else {
            node.style.opacity = String(opacity);
        }
        node.style.visibility = visible ? 'visible' : 'hidden';
        node.setAttribute('aria-hidden', visible ? 'false' : 'true');
    }

    function syncTypography(options = {}) {
        ensureLabelLayersMounted();
        labelOpacities = resolveLabelOpacities(scaleRatio());
        labelPhase = resolveTypoPhase(labelOpacities);
        syncNeighborHighlightZoomVisibility();
        if (!options.skipClouds) {
            syncCloudLayer({ zoomAnimating: options.zoomAnimating });
        }

        applyLabelLayerOpacity(els.continentLabel, labelOpacities.continent);
        applyLabelLayerOpacity(els.labelsRegion, labelOpacities.region);
        applyLabelLayerOpacity(els.labelsNation, labelOpacities.nation);
        applyLabelLayerOpacity(els.labelsCity, labelOpacities.city);
        // Re-anchor every label after host opacity changes so fade-in city names
        // pick up viewport fade the same frame they become eligible to show.
        syncLabelScreenPositions();
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

    function refreshContainerLabelCollisions(container, options = {}) {
        if (!container || !els.frame) return;
        syncLabelHostPositions(container);
        const layerOpacity = resolveLabelHostLayerOpacity(container);
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
        if (options.avoidPin || container === els.labelsCity) {
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
        global.RoyalArmiesPlayerLocPins?.syncPositions?.();
        refreshContainerLabelCollisions(els.labelsRegion, { avoidPin: true });
        refreshContainerLabelCollisions(els.labelsNation, { avoidPin: true });
        refreshContainerLabelCollisions(els.labelsCity);
    }

    function scheduleLabelCollisionPass(container) {
        global.requestAnimationFrame(() => {
            refreshContainerLabelCollisions(container);
        });
    }

    function mountRegionLabels(container) {
        regionPaths.forEach((region) => {
            const regionId = region.regionId || region.id;
            const labelCentroid = resolveRegionBorderCentroid(region);
            const name = region.name;
            if (!labelCentroid || !name) return;

            const pos = labelPosition(labelCentroid);
            const node = global.document.createElement('div');
            node.className = 'age-world-map-label age-world-map-label--region';
            node.id = `age-label-region-${regionId}`;
            node.style.left = pos.left;
            node.style.top = pos.top;
            stampLabelCentroid(node, labelCentroid);
            node.innerHTML = `<span class="age-world-map-label-title">${name}</span>`;
            container.appendChild(node);
        });
        scheduleLabelCollisionPass(container);
    }

    function mountNationLabels(container) {
        const nodes = [];
        catalog.nations.forEach((nation) => {
            const terrains = nation.terrainTypes.join(', ');
            const labelCentroid = resolveNationLabelCentroid(nation.id);
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
            const centroid = city?.centroid;
            if (!centroid || !Number.isFinite(centroid.x) || !Number.isFinite(centroid.y)) return;

            const pos = labelPosition(centroid);
            const tierLabel = city.settlementTier.charAt(0).toUpperCase() + city.settlementTier.slice(1);
            const node = global.document.createElement('div');
            node.className = 'age-world-map-label age-world-map-label--city';
            node.id = `age-label-city-${city.nationId}-${city.id.replace(/^[^-]+-/, '')}`;
            node.dataset.cityId = city.id;
            node.setAttribute('role', 'button');
            node.setAttribute('tabindex', '0');
            node.setAttribute('aria-label', `Open ${city.name}`);
            node.style.left = pos.left;
            node.style.top = pos.top;
            stampLabelCentroid(node, centroid);
            const subLabel = isMaskedCity(city) ? 'Unknown' : `${city.terrain} · ${tierLabel}`;
            node.innerHTML = `
                <span class="age-world-map-label-title">${city.name}</span>
                <span class="age-world-map-label-sub">${subLabel}</span>
            `;
            container.appendChild(node);
            nodes.push(node);
        });
        scheduleLabelCollisionPass(container);
    }

    function resolveNationAccent(nationId) {
        const pathRecord = nationPaths.find((record) => record.id === nationId);
        return pathRecord?.accent || '#9a8a6a';
    }

    function normalizeTerrainKey(terrain) {
        return String(terrain || '').trim().toLowerCase();
    }

    function resolveTerrainFillColor(terrain) {
        return TERRAIN_FILL_COLORS[normalizeTerrainKey(terrain)] || TERRAIN_FILL_COLORS.mountains;
    }

    function resolveCityHolderNationId(city) {
        if (!city) return '';
        return resolveLiveCityHolder(city) || String(city.nationId || '').trim().toLowerCase();
    }

    function appendNationColorFills(layer) {
        if (!layer || !catalog?.cities?.length) return;
        layer.innerHTML = '';
        const frag = global.document.createDocumentFragment();

        catalog.cities.forEach((city) => {
            const outlineD = resolveCityOutlinePath(city);
            if (!outlineD) return;

            const holderId = resolveCityHolderNationId(city);
            const pathEl = global.document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathEl.setAttribute('class', 'age-world-nation-color-fill');
            pathEl.setAttribute('d', outlineD);
            pathEl.setAttribute('fill', resolveNationAccent(holderId));
            pathEl.setAttribute('data-city-id', city.id);
            pathEl.setAttribute('data-holder-nation-id', holderId);
            pathEl.setAttribute('vector-effect', 'non-scaling-stroke');
            stampCentroidOnNode(pathEl, city.centroid);
            frag.appendChild(pathEl);
        });

        layer.appendChild(frag);
    }

    function refreshNationColorFills() {
        if (!els.colorLayerNations) return;
        els.colorLayerNations.querySelectorAll('.age-world-nation-color-fill').forEach((node) => {
            const cityId = node.getAttribute('data-city-id');
            const city = cityById.get(cityId);
            if (!city) return;

            const holderId = resolveCityHolderNationId(city);
            node.setAttribute('data-holder-nation-id', holderId);
            node.setAttribute('fill', resolveNationAccent(holderId));
        });
    }

    function appendTerrainColorFills(layer) {
        if (!layer || !catalog?.cities?.length) return;
        layer.innerHTML = '';
        const frag = global.document.createDocumentFragment();

        catalog.cities.forEach((city) => {
            const outlineD = resolveCityOutlinePath(city);
            if (!outlineD) return;

            const terrainKey = normalizeTerrainKey(city.terrain);
            const pathEl = global.document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathEl.setAttribute('class', `age-world-terrain-color-fill age-world-terrain-color-fill--${terrainKey}`);
            pathEl.setAttribute('d', outlineD);
            pathEl.setAttribute('fill', resolveTerrainFillColor(city.terrain));
            pathEl.setAttribute('data-city-id', city.id);
            pathEl.setAttribute('data-terrain', terrainKey);
            pathEl.setAttribute('vector-effect', 'non-scaling-stroke');
            stampCentroidOnNode(pathEl, city.centroid);
            frag.appendChild(pathEl);
        });

        layer.appendChild(frag);
    }

    function renderColorMapLegend() {
        if (!els.colorLegend || !catalog?.nations?.length) return;
        els.colorLegend.innerHTML = '';
        catalog.nations.forEach((nation) => {
            const accent = resolveNationAccent(nation.id);
            const item = global.document.createElement('li');
            const swatch = global.document.createElement('span');
            swatch.className = 'age-world-map-color-swatch';
            swatch.style.background = accent;
            item.appendChild(swatch);
            item.appendChild(global.document.createTextNode(nation.name));
            els.colorLegend.appendChild(item);
        });
    }

    function syncMapKeyVisibility() {
        const isColor = mapStyleMode === MAP_STYLE_MODES.color;
        if (els.terrainLegend) {
            const showTerrainKey = terrainDetailOn;
            els.terrainLegend.hidden = !showTerrainKey;
            els.terrainLegend.setAttribute('aria-hidden', showTerrainKey ? 'false' : 'true');
        }
        if (els.colorLegend) {
            const showNationKey = isColor && !terrainDetailOn;
            els.colorLegend.hidden = !showNationKey;
            els.colorLegend.setAttribute('aria-hidden', showNationKey ? 'false' : 'true');
        }
    }

    function applyMapDisplayState() {
        const isColor = mapStyleMode === MAP_STYLE_MODES.color;
        const showTerrainPng = !isColor && terrainDetailOn;
        const showNationFills = isColor && !terrainDetailOn;
        const showTerrainFills = isColor && terrainDetailOn;
        const nextColorMapMode = showNationFills
            ? COLOR_MAP_MODES.nations
            : showTerrainFills
              ? COLOR_MAP_MODES.terrain
              : COLOR_MAP_MODES.off;
        const colorMapChanged = nextColorMapMode !== colorMapMode;

        colorMapMode = nextColorMapMode;
        terrainOverlayOn = showTerrainPng;

        els.frame?.classList.toggle(TERRAIN_OVERLAY_FRAME_CLASS, terrainOverlayOn);
        els.frame?.classList.toggle(COLOR_MAP_FRAME_CLASS, isColor);
        els.frame?.classList.toggle(COLOR_MAP_NATIONS_CLASS, showNationFills);
        els.frame?.classList.toggle(COLOR_MAP_TERRAIN_CLASS, showTerrainFills);

        if (els.colorBackdrop) {
            els.colorBackdrop.setAttribute('fill', COLOR_MAP_BACKDROP_FILL);
            els.colorBackdrop.setAttribute('aria-hidden', isColor ? 'false' : 'true');
        }
        if (els.colorLayer) {
            els.colorLayer.setAttribute('aria-hidden', isColor ? 'false' : 'true');
        }
        if (els.styleToggle) {
            els.styleToggle.classList.toggle('is-active', isColor);
            els.styleToggle.setAttribute('aria-pressed', isColor ? 'true' : 'false');
        }
        if (els.terrainToggle) {
            els.terrainToggle.classList.toggle('is-active', terrainDetailOn);
            els.terrainToggle.setAttribute('aria-pressed', terrainDetailOn ? 'true' : 'false');
        }

        syncMapKeyVisibility();
        if (colorMapChanged || isColor) {
            syncOwnershipVisuals();
            refreshNationColorFills();
        }
        syncBorderVisuals({ force: true });
        syncPlayerNationCapitalShine();
        if (isColor) {
            suppressAmbientMapEffects();
            lastAmbientMapStyleMode = mapStyleMode;
        } else if (mapStyleMode !== lastAmbientMapStyleMode) {
            if (isMapAmbientEffectsEnabled()) {
                restoreAmbientMapEffects();
            }
            lastAmbientMapStyleMode = mapStyleMode;
        }
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
        const hitNode = target.closest('.age-world-city-hit-path[data-city-id]');
        if (hitNode?.dataset?.cityId) return hitNode.dataset.cityId;

        const labelNode = target.closest('.age-world-map-label--city[data-city-id]');
        return labelNode?.dataset.cityId || '';
    }

    function mapClientPointToCatalog(clientX, clientY) {
        if (!els.svg || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;

        const matrix = els.svg.getScreenCTM();
        if (!matrix) return null;

        const point = els.svg.createSVGPoint();
        point.x = clientX;
        point.y = clientY;
        const svgPoint = point.matrixTransform(matrix.inverse());
        return { x: svgPoint.x, y: svgPoint.y };
    }

    function cityBboxContains(city, catalogPoint, pad = 2) {
        const box = city?.bbox;
        if (!box || !catalogPoint) return false;
        return catalogPoint.x >= box.minX - pad
            && catalogPoint.x <= box.maxX + pad
            && catalogPoint.y >= box.minY - pad
            && catalogPoint.y <= box.maxY + pad;
    }

    function cityBboxArea(city) {
        const box = city?.bbox;
        if (!box) return 0;
        return Math.max(0, box.maxX - box.minX) * Math.max(0, box.maxY - box.minY);
    }

    function settlementTierPriority(city) {
        const tier = String(city?.settlementTier || 'city').trim().toLowerCase();
        return SETTLEMENT_HIT_TIER_PRIORITY[tier] ?? 5;
    }

    function pathContainsCatalogPoint(path, catalogPoint) {
        if (!path || !catalogPoint) return false;
        if (typeof path.isPointInFill !== 'function' || typeof global.DOMPoint !== 'function') {
            return false;
        }
        try {
            return path.isPointInFill(new global.DOMPoint(catalogPoint.x, catalogPoint.y));
        } catch (err) {
            return false;
        }
    }

    function collectCityHitIdsAtClientPoint(clientX, clientY) {
        const ids = [];
        if (!els.hitLayer) return ids;

        const stack = global.document.elementsFromPoint(clientX, clientY);
        for (let i = 0; i < stack.length; i += 1) {
            const node = stack[i];
            if (!node || !els.hitLayer.contains(node)) continue;
            const hitNode = node.closest?.('.age-world-city-hit-path[data-city-id]');
            const id = hitNode?.dataset?.cityId || '';
            if (id && !ids.includes(id)) ids.push(id);
        }
        if (ids.length) return ids;

        const catalogPoint = mapClientPointToCatalog(clientX, clientY);
        if (!catalogPoint) return ids;

        els.hitLayer.querySelectorAll('.age-world-city-hit-path[data-city-id]').forEach((path) => {
            const id = path.getAttribute('data-city-id') || '';
            if (!id || ids.includes(id)) return;

            const city = cityById.get(id);
            if (city?.bbox && !cityBboxContains(city, catalogPoint, 2)) return;
            if (pathContainsCatalogPoint(path, catalogPoint)) ids.push(id);
        });

        return ids;
    }

    function pickBestCityIdFromCandidates(candidateIds, catalogPoint, clientX, clientY) {
        const cities = candidateIds
            .map((id) => cityById.get(id))
            .filter(Boolean);
        if (!cities.length) return '';

        let pool = cities;
        if (catalogPoint) {
            const inBbox = cities.filter((city) => cityBboxContains(city, catalogPoint));
            if (inBbox.length) pool = inBbox;
        }

        const hostRect = mapOverlayHostRect();
        const localX = Number.isFinite(clientX) ? clientX - hostRect.left : null;
        const localY = Number.isFinite(clientY) ? clientY - hostRect.top : null;

        pool.sort((left, right) => {
            const tierDelta = settlementTierPriority(left) - settlementTierPriority(right);
            if (tierDelta !== 0) return tierDelta;

            if (Number.isFinite(localX) && Number.isFinite(localY)) {
                const leftPoint = mapPointToFramePixels(left.centroid.x, left.centroid.y);
                const rightPoint = mapPointToFramePixels(right.centroid.x, right.centroid.y);
                const leftDist = Math.hypot(leftPoint.x - localX, leftPoint.y - localY);
                const rightDist = Math.hypot(rightPoint.x - localX, rightPoint.y - localY);
                if (leftDist !== rightDist) return leftDist - rightDist;
            }

            return cityBboxArea(right) - cityBboxArea(left);
        });

        return pool[0]?.id || '';
    }

    function resolveCityIdAtClientPoint(clientX, clientY) {
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return '';

        const catalogPoint = mapClientPointToCatalog(clientX, clientY);
        const hitCandidates = collectCityHitIdsAtClientPoint(clientX, clientY);
        if (hitCandidates.length) {
            const picked = pickBestCityIdFromCandidates(hitCandidates, catalogPoint, clientX, clientY);
            if (picked) return picked;
        }

        // Strict hit-testing: only clicks inside a city's outline select it.
        // No bbox or nearest-centroid fallback.
        return '';
    }

    function resolveCityIdAtPointer(event) {
        let cityId = resolveCityHitTarget(event?.target);
        if (cityId) return cityId;
        if (!event || !Number.isFinite(event.clientX)) return '';
        return resolveCityIdAtClientPoint(event.clientX, event.clientY);
    }

    function tryHandleMapCityPointerUp(event, options = {}) {
        if (!event || event.button !== 0) return false;
        if (isPlanCityPickActive()) return false;
        if (options.didPan) return false;
        if (isMapChromeTarget(event.target)) return false;

        const cityId = mapPressCityId || resolveCityIdAtPointer(event);
        if (!cityId) return false;

        const city = cityById.get(cityId);
        if (!city) return false;

        mapCityPointerUpHandled = true;

        toggleCityDrawerFromClick(cityId, event.clientX, event.clientY);
        return true;
    }

    function cancelActiveMapPan(event) {
        if (!dragging && global.document.pointerLockElement !== els.frame) return;
        endMapPan(event);
    }

    function syncPlanEditorHighlights(anchorCityId, armedCityId) {
        if (!els.highlightLayer) return;

        els.highlightLayer.querySelectorAll(
            '.age-world-city-highlight-path, .age-world-city-highlight-boost'
        ).forEach((node) => {
            const cityId = node.getAttribute('data-city-id') || '';
            node.classList.remove('is-plan-anchor', 'is-plan-armed', 'is-plan-anchor-flash');
            if (anchorCityId && cityId === anchorCityId) {
                node.classList.add('is-plan-anchor');
            } else if (armedCityId && cityId === armedCityId) {
                node.classList.add('is-plan-armed');
            }
        });

        if (anchorCityId) {
            showCityHighlight(anchorCityId);
        } else if (!armedCityId) {
            clearCityHighlight();
        }
    }

    function clearPlanEditorHighlights() {
        syncPlanEditorHighlights('', '');
    }

    function flashPlanAnchorFeedback(cityId) {
        if (!cityId || !els.highlightLayer) return;
        els.highlightLayer.querySelectorAll(
            `.age-world-city-highlight-path[data-city-id="${cityId}"], `
            + `.age-world-city-highlight-boost[data-city-id="${cityId}"]`
        ).forEach((node) => {
            node.classList.remove('is-plan-anchor-flash');
            void node.offsetWidth;
            node.classList.add('is-plan-anchor-flash');
        });
    }

    function isPlanCityPickActive() {
        return planCityPickMode || Boolean(global.RoyalArmiesAgeWorldMapPlanDraft?.isSessionActive?.());
    }

    function isAssigningPlanRoute() {
        return Boolean(global.RoyalArmiesAgeWorldMapPlanEditor?.getActiveRouteType?.())
            || Boolean(global.RoyalArmiesAgeWorldMapPlanEditor?.isClearArrowMode?.());
    }

    function resolveDraftArrowIdAtClientPoint(clientX, clientY) {
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return '';

        const overlay = global.document.getElementById('age-world-map-plan-draft-overlay');
        if (!overlay || overlay.hidden) return '';

        const stack = global.document.elementsFromPoint(clientX, clientY);
        for (let i = 0; i < stack.length; i += 1) {
            const node = stack[i];
            if (!overlay.contains(node)) continue;
            const path = node.closest?.('[data-draft-arrow-id]');
            const arrowId = path?.getAttribute('data-draft-arrow-id') || '';
            if (arrowId) return arrowId;
        }

        return '';
    }

    function isPlanArrowInteractionTarget(event) {
        if (!event) return false;
        return Boolean(
            event.target?.closest?.('[data-draft-arrow-id]')
            || event.target?.closest?.('.age-world-map-plan-arrow-hit')
            || resolveDraftArrowIdAtClientPoint(event.clientX, event.clientY)
        );
    }

    function shouldAcceptPlanCityPick(event) {
        if (!isPlanCityPickActive()) return false;
        if (isAssigningPlanRoute()) return false;
        if (isPlanArrowInteractionTarget(event)) return false;
        return true;
    }

    function processPlanDraftArrowPick(event) {
        if (!event || event.button !== 0) return false;
        if (!global.RoyalArmiesAgeWorldMapPlanDraft?.isSessionActive?.()) return false;
        if (!isAssigningPlanRoute()) return false;

        const arrowId = resolveDraftArrowIdAtClientPoint(event.clientX, event.clientY)
            || event.target?.closest?.('[data-draft-arrow-id]')?.getAttribute('data-draft-arrow-id')
            || '';
        if (!arrowId) return false;

        if (global.RoyalArmiesAgeWorldMapPlanDraft?.handleArrowPointerUp?.(event, arrowId)) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
            planPressCityId = '';
            planClickHandledSeq += 1;
            return true;
        }

        return false;
    }

    function syncPlanRouteAssignChrome() {
        const armed = isAssigningPlanRoute();
        els.frame?.classList.toggle('is-plan-route-assign', armed);
    }

    function processPlanCityPick(cityId, event) {
        if (!cityId || !shouldAcceptPlanCityPick(event)) return false;

        cancelActiveMapPan(event);

        if (global.RoyalArmiesAgeWorldMapPlanDraft?.handleCityClick?.(cityId)) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation?.();
            }
            flashPlanAnchorFeedback(cityId);
            return true;
        }

        return false;
    }

    function setPlanCityPickMode(active) {
        planCityPickMode = Boolean(active);
        if (!planCityPickMode) {
            planPressCityId = '';
            planClickHandledSeq = 0;
            cancelActiveMapPan();
        } else {
            cancelActiveMapPan();
        }
        els.frame?.classList.toggle('is-plan-city-pick', planCityPickMode);
        els.hitLayer?.classList.toggle('is-plan-city-pick', planCityPickMode);
    }

    function onPlanHitPointerDown(event) {
        if (!shouldAcceptPlanCityPick(event) || event.button !== 0) return;
        cancelActiveMapPan(event);
        planPressCityId = resolveCityIdAtPointer(event) || '';
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
    }

    function onPlanHitClick(event) {
        if (!shouldAcceptPlanCityPick(event)) return;

        const cityId = resolveCityHitTarget(event.target) || planPressCityId;
        if (!cityId) return;

        if (processPlanCityPick(cityId, event)) {
            planClickHandledSeq += 1;
            planPressCityId = '';
        }
    }

    function onPlanHitPointerUp(event) {
        if (!shouldAcceptPlanCityPick(event) || event.button !== 0) return false;

        cancelActiveMapPan(event);

        const pressId = planPressCityId;
        const cityId = pressId || resolveCityIdAtPointer(event);
        planPressCityId = '';

        if (cityId && !panMoved && processPlanCityPick(cityId, event)) {
            planClickHandledSeq += 1;
            return true;
        }

        const seqAtStart = planClickHandledSeq;
        const clientX = event.clientX;
        const clientY = event.clientY;
        const target = event.target;

        global.requestAnimationFrame(() => {
            if (planClickHandledSeq !== seqAtStart) return;

            const fallbackId = resolveCityHitTarget(target)
                || resolveCityIdAtClientPoint(clientX, clientY);
            if (!fallbackId || panMoved) return;
            if (processPlanCityPick(fallbackId, event)) {
                planClickHandledSeq += 1;
            }
        });

        return true;
    }

    function bindPlanMapClickFallback() {
        if (els.frame?.dataset.planMapFallbackBound === '1') return;
        if (!els.frame) return;
        els.frame.dataset.planMapFallbackBound = '1';

        els.frame.addEventListener('pointerup', (event) => {
            if (processPlanDraftArrowPick(event)) return;
        }, true);

        els.frame.addEventListener('click', (event) => {
            if (processPlanDraftArrowPick(event)) return;
            if (!shouldAcceptPlanCityPick(event)) return;
            if (event.target?.closest?.('.age-world-city-hit-path[data-city-id]')) return;
            if (event.target?.closest?.('.age-world-map-plan-tool-dock, #age-world-map-plan-add, #age-world-map-plan-post')) {
                return;
            }

            const cityId = resolveCityIdAtClientPoint(event.clientX, event.clientY);
            if (!cityId) return;
            processPlanCityPick(cityId, event);
        }, true);

        global.addEventListener('royalarmies:age-map-plan-route-armed', () => {
            syncPlanRouteAssignChrome();
        });
        global.addEventListener('royalarmies:age-map-plan-draft-changed', () => {
            syncPlanRouteAssignChrome();
        });
    }

    function bindCityHitDelegation() {
        if (!els.hitLayer || els.hitLayer.dataset.hitBound === '1') return;
        els.hitLayer.dataset.hitBound = '1';

        els.hitLayer.addEventListener('pointerover', (event) => {
            if (isCityDrawerOpen()) return;
            const cityId = resolveCityHitTarget(event.target);
            if (cityId) showCityHighlight(cityId);
        });

        els.hitLayer.addEventListener('pointerout', (event) => {
            if (isCityDrawerOpen()) return;
            const node = event.target.closest?.('.age-world-city-hit-path[data-city-id]');
            if (!node) return;
            const leavingId = node.dataset.cityId;
            const entering = event.relatedTarget?.closest?.('.age-world-city-hit-path[data-city-id]');
            if (entering?.dataset.cityId === leavingId) return;
            if (hoveredCityId === leavingId) clearCityHighlight();
        });

        els.hitLayer.addEventListener('pointerdown', onPlanHitPointerDown, true);
        els.hitLayer.addEventListener('click', onPlanHitClick, true);

        els.hitLayer.addEventListener('pointerup', (event) => {
            if (event.button !== 0) return;

            mapCityPointerUpHandled = false;

            let didPan = false;
            if (dragging) {
                didPan = endMapPan(event);
            }

            if (processPlanDraftArrowPick(event)) {
                return;
            }

            if (isPlanCityPickActive()) {
                if (onPlanHitPointerUp(event)) {
                    event.preventDefault();
                }
                return;
            }

            if (tryHandleMapCityPointerUp(event, { didPan })) {
                event.preventDefault();
                event.stopPropagation();
            }
        }, true);
    }

    function resolvePlayerNationForOwnership() {
        global.RoyalArmiesAgeMovement?.getCatalogCityId?.();

        const movementNation = global.RoyalArmiesAgeMovement?.resolvePlayerNationId?.();
        if (movementNation) return movementNation;

        const panelNation = global.RoyalArmiesAgeMovementPanel?.getCommanderNationId?.();
        if (panelNation) return panelNation;

        return 'aesthene';
    }

    function nationIdsFromDiplomacyRows(rows) {
        return new Set(
            (Array.isArray(rows) ? rows : [])
                .map((row) => String(row?.nationId || row?.nationName || '').trim().toLowerCase())
                .filter(Boolean)
        );
    }

    function applyDiplomacyPublicSlice(slice) {
        diplomacyNationSets = {
            allies: nationIdsFromDiplomacyRows(slice?.allies),
            naps: nationIdsFromDiplomacyRows(slice?.naps),
            enemies: nationIdsFromDiplomacyRows(slice?.enemies)
        };

        (global.RoyalArmiesAgeMovement?.getAlliedNationIds?.() || []).forEach((nationId) => {
            const normalized = String(nationId || '').trim().toLowerCase();
            if (normalized) diplomacyNationSets.allies.add(normalized);
        });
        (global.RoyalArmiesAgeMovement?.getWarNationIds?.() || []).forEach((nationId) => {
            const normalized = String(nationId || '').trim().toLowerCase();
            if (normalized) diplomacyNationSets.enemies.add(normalized);
        });
    }

    function ensureDiplomacyNationSets() {
        if (diplomacyRefreshPromise) return diplomacyRefreshPromise;

        const username = resolveScoutUsername();
        if (!username) {
            applyDiplomacyPublicSlice({ allies: [], naps: [], enemies: [] });
            return Promise.resolve();
        }

        diplomacyRefreshPromise = (async () => {
            let diplomacyPublic = { allies: [], naps: [], enemies: [] };

            try {
                const response = await global.fetch(
                    resolveScoutApiUrl(`/api/portal/age/headquarters?username=${encodeURIComponent(username)}`),
                    { credentials: 'same-origin', cache: 'no-store' }
                );
                const payload = await response.json().catch(() => ({}));
                if (response.ok && payload?.status === 'ok' && payload?.workspace) {
                    diplomacyPublic = payload.workspace.diplomacyPublic || diplomacyPublic;
                }
            } catch (_error) {
                /* keep movement fallbacks only */
            }

            applyDiplomacyPublicSlice(diplomacyPublic);
        })().finally(() => {
            diplomacyRefreshPromise = null;
        });

        return diplomacyRefreshPromise;
    }

    function stampDiplomacyClassesOnCityNode(node, city, playerNation) {
        if (!node || !city) return;
        node.classList.remove(...OWNERSHIP_CLASS_NAMES);

        if (city.id === playerMapCityId) {
            node.classList.add('is-player-city');
        }

        if (!playerNation) return;

        const holder = resolveLiveCityHolder(city);
        if (holder === playerNation) {
            node.classList.add('is-nation-own');
            return;
        }

        const foreignClass = resolveForeignOwnershipClass(holder, playerNation);
        if (foreignClass) {
            node.classList.add(foreignClass);
        }
    }

    function applyCityBorderRelationshipStroke(node) {
        if (!node) return;

        const colorMapOn = isColorMapStyleActive();
        if (colorMapOn) {
            node.style.setProperty('stroke', COLOR_MAP_CITY_BORDER_STROKE);
            node.style.setProperty('stroke-width', '1.5px');
            return;
        }

        const isPlayerCity = node.classList.contains('is-player-city');

        if (isPlayerCity) {
            node.style.setProperty('stroke', 'rgba(64, 128, 255, 1)');
            node.style.setProperty('stroke-width', '2.5px');
            return;
        }

        const kind = resolveOwnershipKindFromNode(node);
        const palette = OWNERSHIP_TINT[kind] || OWNERSHIP_TINT.none;
        const useSettlementOutline = kind === 'none' || kind === 'neutral' || kind === 'own';

        if (useSettlementOutline) {
            node.style.setProperty('stroke', CITY_SETTLEMENT_OUTLINE_STROKE);
            node.style.setProperty('stroke-width', '2px');
            return;
        }

        node.style.setProperty('stroke', palette.stroke);
        node.style.setProperty('stroke-width', '2.5px');
    }

    function syncCityBorderRelationshipStrokes() {
        if (!els.visualLayer) return;
        els.visualLayer.querySelectorAll('.age-world-city-border-path').forEach((node) => {
            applyCityBorderRelationshipStroke(node);
        });
    }

    function resolveForeignOwnershipClass(holder, playerNation) {
        const normalizedHolder = String(holder || '').trim().toLowerCase();
        if (!normalizedHolder || !playerNation || normalizedHolder === playerNation) {
            return '';
        }

        if (diplomacyNationSets.allies.has(normalizedHolder)) {
            return 'is-nation-ally';
        }
        if (diplomacyNationSets.naps.has(normalizedHolder)) {
            return 'is-nation-nap';
        }
        if (diplomacyNationSets.enemies.has(normalizedHolder)) {
            return 'is-nation-enemy';
        }

        return 'is-nation-neutral';
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

    function ensureRestrictedPatternDef() {
        if (!els.svg || els.svg.querySelector('#age-world-restricted-hatch')) return;
        const svgNs = 'http://www.w3.org/2000/svg';
        let defs = els.svg.querySelector('defs');
        if (!defs) {
            defs = global.document.createElementNS(svgNs, 'defs');
            els.svg.insertBefore(defs, els.svg.firstChild);
        }
        const pattern = global.document.createElementNS(svgNs, 'pattern');
        pattern.setAttribute('id', 'age-world-restricted-hatch');
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        pattern.setAttribute('width', '7');
        pattern.setAttribute('height', '7');
        pattern.setAttribute('patternTransform', 'rotate(45)');
        const stripe = global.document.createElementNS(svgNs, 'rect');
        stripe.setAttribute('x', '0');
        stripe.setAttribute('y', '0');
        stripe.setAttribute('width', '2.6');
        stripe.setAttribute('height', '7');
        stripe.setAttribute('fill', 'rgb(110, 24, 24)');
        pattern.appendChild(stripe);
        defs.appendChild(pattern);
    }

    const CAPITAL_SHINE_CLIP_ID = 'age-world-capital-shine-clip';
    const CAPITAL_SHINE_GRAD_ID = 'age-world-capital-shine-grad';

    function ensureSvgDefsRoot() {
        if (!els.svg) return null;
        const svgNs = 'http://www.w3.org/2000/svg';
        let defs = els.svg.querySelector('defs');
        if (!defs) {
            defs = global.document.createElementNS(svgNs, 'defs');
            els.svg.insertBefore(defs, els.svg.firstChild);
        }
        return defs;
    }

    function clearCapitalShineDefs() {
        const defs = ensureSvgDefsRoot();
        if (!defs) return;
        defs.querySelector(`#${CAPITAL_SHINE_CLIP_ID}`)?.remove();
        defs.querySelector(`#${CAPITAL_SHINE_GRAD_ID}`)?.remove();
    }

    function resolvePlayerNationCapitalCity() {
        const playerNation = String(resolvePlayerNationForOwnership() || '').trim().toLowerCase();
        if (!playerNation || !catalog?.cities) return null;

        const capital = catalog.cities.find((city) => (
            city.nationId === playerNation && city.isCapital
        ));
        if (!capital || isMaskedCity(capital)) return null;
        if (!resolveCityOutlinePath(capital)) return null;
        return capital;
    }

    function ensureCapitalShineLayer() {
        if (!els.visualLayer) return null;
        const svgNs = 'http://www.w3.org/2000/svg';
        let layer = els.visualLayer.querySelector('#age-world-map-capital-shine-layer');
        if (!layer) {
            layer = global.document.createElementNS(svgNs, 'g');
            layer.setAttribute('id', 'age-world-map-capital-shine-layer');
            layer.setAttribute('class', 'age-world-map-capital-shine-layer');
            layer.setAttribute('pointer-events', 'none');
            els.visualLayer.appendChild(layer);
        }
        return layer;
    }

    function syncPlayerNationCapitalShine() {
        const layer = ensureCapitalShineLayer();
        if (!layer) return;

        layer.replaceChildren();
        clearCapitalShineDefs();

        if (isColorMapStyleActive()) return;

        const capital = resolvePlayerNationCapitalCity();
        if (!capital) return;

        const outlineD = resolveCityOutlinePath(capital);
        const bbox = capital.bbox || {};
        const minX = Number(bbox.minX);
        const minY = Number(bbox.minY);
        const maxX = Number(bbox.maxX);
        const maxY = Number(bbox.maxY);
        if (!outlineD || !Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
            return;
        }

        const svgNs = 'http://www.w3.org/2000/svg';
        const defs = ensureSvgDefsRoot();
        if (!defs) return;

        const clipPath = global.document.createElementNS(svgNs, 'clipPath');
        clipPath.setAttribute('id', CAPITAL_SHINE_CLIP_ID);
        const clipShape = global.document.createElementNS(svgNs, 'path');
        clipShape.setAttribute('d', outlineD);
        clipPath.appendChild(clipShape);
        defs.appendChild(clipPath);

        const gradient = global.document.createElementNS(svgNs, 'linearGradient');
        gradient.setAttribute('id', CAPITAL_SHINE_GRAD_ID);
        gradient.setAttribute('gradientUnits', 'objectBoundingBox');
        gradient.setAttribute('x1', '0');
        gradient.setAttribute('y1', '0');
        gradient.setAttribute('x2', '1');
        gradient.setAttribute('y2', '0');
        gradient.setAttribute('gradientTransform', 'rotate(24)');
        [
            ['0%', '#fff4cc', '0'],
            ['38%', '#fff4cc', '0'],
            ['48%', '#ffe08a', '0.92'],
            ['54%', '#fff8e8', '0.48'],
            ['62%', '#fff4cc', '0'],
            ['100%', '#fff4cc', '0']
        ].forEach(([offset, color, opacity]) => {
            const stop = global.document.createElementNS(svgNs, 'stop');
            stop.setAttribute('offset', offset);
            stop.setAttribute('stop-color', color);
            stop.setAttribute('stop-opacity', opacity);
            gradient.appendChild(stop);
        });
        defs.appendChild(gradient);

        const width = Math.max(maxX - minX, 12);
        const height = Math.max(maxY - minY, 12);
        const span = Math.max(width, height);
        const cx = Number.isFinite(capital.centroid?.x) ? capital.centroid.x : minX + width / 2;
        const cy = Number.isFinite(capital.centroid?.y) ? capital.centroid.y : minY + height / 2;
        const sweepSize = span * 2.85;

        const shineGroup = global.document.createElementNS(svgNs, 'g');
        shineGroup.setAttribute('class', 'age-world-capital-shine-clip');
        shineGroup.setAttribute('clip-path', `url(#${CAPITAL_SHINE_CLIP_ID})`);
        shineGroup.setAttribute('data-city-id', capital.id);

        const sweepRect = global.document.createElementNS(svgNs, 'rect');
        sweepRect.setAttribute('class', 'age-world-capital-shine-sweep');
        sweepRect.setAttribute('x', String(cx - sweepSize / 2));
        sweepRect.setAttribute('y', String(cy - sweepSize / 2));
        sweepRect.setAttribute('width', String(sweepSize));
        sweepRect.setAttribute('height', String(sweepSize));
        sweepRect.setAttribute('fill', `url(#${CAPITAL_SHINE_GRAD_ID})`);

        shineGroup.appendChild(sweepRect);
        layer.appendChild(shineGroup);
    }

    // Night lights: each nation lights its settlements after dark in its own way.
    // Martial and brutal cultures burn open flame; the arcane, mystic, and
    // ritualistic nations conjure magic light instead. One shared color per
    // kind: warm torchfire amber, cool arcane blue.
    const NIGHT_LIGHT_KIND_STYLES = {
        torch: { core: '#ffd27a', halo: 'rgba(255, 170, 60, 0)' },
        magic: { core: '#9fc0ff', halo: 'rgba(120, 150, 255, 0)' }
    };
    const NATION_NIGHT_LIGHT_KINDS = {
        trex: 'torch',
        krall: 'torch',
        dravic: 'torch',
        gorz: 'torch',
        vaerenth: 'torch',
        aesthene: 'magic',
        aethelgard: 'magic',
        saelthine: 'magic',
        lyllis: 'magic'
    };
    // Earth-at-night look: every settlement is a granular speckle cluster of
    // tiny points — a dense packed core with sparse stray homesteads trailing
    // into the countryside — plus one soft ambient glow hugging the core.
    // `spread` is the sampling radius relative to the territory size (lower =
    // tighter core); `glow` is the ambient ground-glow radius in map units.
    const TIER_NIGHT_LIGHT_LAYOUTS = {
        village: { count: 8, spread: 0.5, glow: 15 },
        town: { count: 14, spread: 0.46, glow: 21 },
        city: { count: 26, spread: 0.42, glow: 30 },
        citadel: { count: 38, spread: 0.38, glow: 40 },
        kingdom: { count: 52, spread: 0.34, glow: 50 }
    };
    const NIGHT_LIGHT_DEFAULT_LAYOUT = TIER_NIGHT_LIGHT_LAYOUTS.town;
    // Share of a settlement's lights packed into its bright urban core; the
    // rest scatter wide as lone countryside specks, like the NASA photo's
    // filaments thinning away from city centers.
    const NIGHT_LIGHT_CORE_SHARE = 0.62;
    // At sunset only a handful of core lamps are tagged on — roughly one early
    // flame per ~28 settlements continent-wide.
    const SUNSET_EARLY_LIGHT_MODULO = 56;
    const SUNSET_EARLY_LIGHT_MAX_INDEX = 2;

    function hashNightLightSeed(value) {
        let hash = 2166136261;
        const text = String(value || '');
        for (let i = 0; i < text.length; i += 1) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    // Deterministic PRNG (mulberry32): seeded by city id, so every commander
    // sees the identical fixed constellation of lights in every session.
    function createNightLightRandom(seed) {
        let state = seed >>> 0;
        return function nextRandom() {
            state = (state + 0x6D2B79F5) >>> 0;
            let t = state;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function nightLightPathContains(path, x, y) {
        if (!path || typeof path.isPointInFill !== 'function' || typeof global.DOMPoint !== 'function') {
            return true;
        }
        try {
            return path.isPointInFill(new global.DOMPoint(x, y));
        } catch (err) {
            return true;
        }
    }

    // Triangular-distribution sampling biased toward the settlement core, then
    // rejected against the actual border outline so no light sits outside it.
    function sampleNightLightPoint(path, bbox, centroid, rand, spread) {
        const cx = Number.isFinite(centroid?.x) ? centroid.x : bbox.x + bbox.width / 2;
        const cy = Number.isFinite(centroid?.y) ? centroid.y : bbox.y + bbox.height / 2;
        for (let attempt = 0; attempt < 36; attempt += 1) {
            const x = cx + (rand() + rand() - 1) * bbox.width * spread;
            const y = cy + (rand() + rand() - 1) * bbox.height * spread;
            if (nightLightPathContains(path, x, y)) return { x, y };
        }
        return { x: cx, y: cy };
    }

    function ensureNightLightGradientDefs() {
        if (!els.svg || els.svg.querySelector('#age-night-light-torch')) return;
        const svgNs = 'http://www.w3.org/2000/svg';
        let defs = els.svg.querySelector('defs');
        if (!defs) {
            defs = global.document.createElementNS(svgNs, 'defs');
            els.svg.insertBefore(defs, els.svg.firstChild);
        }
        const appendGradient = (id, stops) => {
            const gradient = global.document.createElementNS(svgNs, 'radialGradient');
            gradient.setAttribute('id', id);
            stops.forEach(([offset, color, opacity]) => {
                const stop = global.document.createElementNS(svgNs, 'stop');
                stop.setAttribute('offset', offset);
                stop.setAttribute('stop-color', color);
                stop.setAttribute('stop-opacity', opacity);
                gradient.appendChild(stop);
            });
            defs.appendChild(gradient);
        };
        Object.keys(NIGHT_LIGHT_KIND_STYLES).forEach((kind) => {
            const style = NIGHT_LIGHT_KIND_STYLES[kind];
            // Open-air light: a pin-prick of white heat with a small tight
            // bloom — granular like city lights seen from orbit. Density does
            // the glowing: packed cores read bright because hundreds of these
            // tiny blooms overlap.
            appendGradient(`age-night-light-${kind}`, [
                ['0%', '#fffdf2', '1'],
                ['18%', style.core, '0.9'],
                ['45%', style.core, '0.35'],
                ['100%', style.halo, '0']
            ]);
            // Canopy light: the same light seen through forest cover — no
            // white-hot core, dimmer, and diffused across a longer falloff,
            // like a glow pushing up through the leaves.
            appendGradient(`age-night-light-${kind}-canopy`, [
                ['0%', style.core, '0.6'],
                ['38%', style.core, '0.3'],
                ['100%', style.halo, '0']
            ]);
        });
        // Ambient settlement glow punched through the night shade. Painted
        // black-on-white inside the shade mask: black erases shade (lit
        // ground), the alpha falloff feathers it out — a dim halo hugging the
        // city core, not a floodlit field, like the bloom in orbital photos.
        appendGradient('age-night-hole-grad', [
            ['0%', '#000000', '0.92'],
            ['50%', '#000000', '0.62'],
            ['100%', '#000000', '0']
        ]);
        const mask = global.document.createElementNS(svgNs, 'mask');
        mask.setAttribute('id', 'age-world-night-shade-mask');
        mask.setAttribute('maskUnits', 'userSpaceOnUse');
        mask.setAttribute('x', '0');
        mask.setAttribute('y', '0');
        mask.setAttribute('width', String(NATIVE_SIZE));
        mask.setAttribute('height', String(NATIVE_SIZE));
        const maskBackdrop = global.document.createElementNS(svgNs, 'rect');
        maskBackdrop.setAttribute('x', '0');
        maskBackdrop.setAttribute('y', '0');
        maskBackdrop.setAttribute('width', String(NATIVE_SIZE));
        maskBackdrop.setAttribute('height', String(NATIVE_SIZE));
        maskBackdrop.setAttribute('fill', '#ffffff');
        mask.appendChild(maskBackdrop);
        const holes = global.document.createElementNS(svgNs, 'g');
        holes.setAttribute('class', 'age-world-night-hole-group');
        mask.appendChild(holes);
        defs.appendChild(mask);
        els.nightShadeHoles = holes;
    }

    // The night shade lives inside the SVG (so it pans/zooms with the land)
    // and sits just above the city visuals; the lamps render on top of it so
    // each one visibly holds back the dark.
    function ensureNightLayer() {
        if (els.nightLayer || !els.visualLayer || !els.svg) return;
        const svgNs = 'http://www.w3.org/2000/svg';
        const layer = global.document.createElementNS(svgNs, 'g');
        layer.setAttribute('class', 'age-world-night-layer');
        layer.setAttribute('aria-hidden', 'true');
        const shade = global.document.createElementNS(svgNs, 'rect');
        shade.setAttribute('class', 'age-world-night-shade');
        shade.setAttribute('x', '0');
        shade.setAttribute('y', '0');
        shade.setAttribute('width', String(NATIVE_SIZE));
        shade.setAttribute('height', String(NATIVE_SIZE));
        shade.setAttribute('fill', '#04081a');
        shade.setAttribute('pointer-events', 'none');
        shade.setAttribute('mask', 'url(#age-world-night-shade-mask)');
        layer.appendChild(shade);
        els.visualLayer.after(layer);
        els.nightLayer = layer;
    }

    // Must run after the border paths are live in the DOM (isPointInFill +
    // getBBox need real geometry). One group holds every dot so the whole
    // constellation fades with a single animated opacity.
    function buildNightLights(entries) {
        if (!els.visualLayer || !Array.isArray(entries)) return;
        ensureNightLightGradientDefs();
        ensureNightLayer();
        const stale = els.nightLayer
            ? els.nightLayer.querySelector('.age-world-night-light-group')
            : els.visualLayer.querySelector('.age-world-night-light-group');
        if (stale) stale.remove();
        if (els.nightShadeHoles) els.nightShadeHoles.innerHTML = '';
        const svgNs = 'http://www.w3.org/2000/svg';
        const group = global.document.createElementNS(svgNs, 'g');
        group.setAttribute('class', 'age-world-night-light-group');
        group.setAttribute('aria-hidden', 'true');
        entries.forEach(({ city, path }) => {
            let bbox;
            try {
                bbox = path.getBBox();
            } catch (err) {
                return;
            }
            if (!bbox || !bbox.width || !bbox.height) return;
            const kind = NATION_NIGHT_LIGHT_KINDS[city.nationId] || 'torch';
            const tier = String(city.settlementTier || '').toLowerCase();
            const layout = TIER_NIGHT_LIGHT_LAYOUTS[tier] || NIGHT_LIGHT_DEFAULT_LAYOUT;
            const rand = createNightLightRandom(hashNightLightSeed(city.id));
            // Forest settlements sit under the canopy: their lights diffuse
            // through the leaves instead of shining as sharp points.
            const underCanopy = normalizeTerrainKey(city.terrain) === 'forest';
            const gradientId = underCanopy
                ? `age-night-light-${kind}-canopy`
                : `age-night-light-${kind}`;
            const radius = (kind === 'magic' ? 2.6 : 2.2) + (underCanopy ? 0.4 : 0);
            for (let i = 0; i < layout.count; i += 1) {
                // Core lights huddle tight; the rest stray wide — lone farms
                // and hamlet specks in the dark countryside.
                const inCore = rand() < NIGHT_LIGHT_CORE_SHARE;
                const sampleSpread = inCore
                    ? layout.spread * 0.5
                    : Math.min(layout.spread * 1.4, 0.5);
                const point = sampleNightLightPoint(path, bbox, city.centroid, rand, sampleSpread);
                // Only some flames flicker (keeps thousands of dots cheap and
                // reads better: a city core shimmers rather than strobes).
                const flickers = kind === 'torch' && i % 3 === 0;
                const sunsetEarly = i < SUNSET_EARLY_LIGHT_MAX_INDEX
                    && (hashNightLightSeed(`${city.id}|sunset|${i}`) % SUNSET_EARLY_LIGHT_MODULO === 0);
                const dot = global.document.createElementNS(svgNs, 'circle');
                dot.setAttribute(
                    'class',
                    `age-world-city-torch age-world-city-torch--${kind}` +
                        `${flickers ? ' age-world-city-torch--flicker' : ''}` +
                        `${underCanopy ? ' age-world-city-torch--canopy' : ''}` +
                        `${sunsetEarly ? ' age-world-city-torch--sunset-early' : ''}`
                );
                dot.setAttribute('cx', point.x.toFixed(1));
                dot.setAttribute('cy', point.y.toFixed(1));
                dot.setAttribute('r', String(radius));
                dot.setAttribute('fill', `url(#${gradientId})`);
                // Staggered lighting: every dot keeps its own deterministic
                // delay (rand*rand biases most lights early, with stragglers up
                // to ~6 minutes late) and fade speed, so dusk looks like real
                // people lighting up — and dousing — whenever they please.
                // Same seed stream as the positions, so the order is identical
                // for every commander, every night.
                dot.style.transitionDelay = `${Math.round(rand() * rand() * 360)}s`;
                dot.style.transitionDuration = `${(2 + rand() * 4).toFixed(1)}s`;
                if (flickers) {
                    // The flicker dip lives on fill-opacity so it never fights
                    // the dusk fade, which runs on opacity. Magic lights hold
                    // a steady glow.
                    dot.style.animationDuration = `${(6 + rand() * 9).toFixed(1)}s`;
                    dot.style.animationDelay = `${(rand() * 9).toFixed(1)}s`;
                }
                group.appendChild(dot);
            }
            // One ambient glow per settlement: a soft halo of lit ground
            // hugging the urban core (like the bloom around cities in orbital
            // night photos) — stray countryside specks stay islands in the
            // dark. Conjured magic light is fictionally stronger than open
            // flame, so it throws further; forest canopy swallows throw.
            if (els.nightShadeHoles) {
                const glowRadius = Math.round(
                    layout.glow * (kind === 'magic' ? 1.3 : 1) * (underCanopy ? 0.72 : 1)
                );
                const cx = Number.isFinite(city.centroid?.x) ? city.centroid.x : bbox.x + bbox.width / 2;
                const cy = Number.isFinite(city.centroid?.y) ? city.centroid.y : bbox.y + bbox.height / 2;
                const hole = global.document.createElementNS(svgNs, 'circle');
                hole.setAttribute('class', 'age-world-night-hole');
                hole.setAttribute('cx', cx.toFixed(1));
                hole.setAttribute('cy', cy.toFixed(1));
                hole.setAttribute('r', String(glowRadius));
                hole.setAttribute('fill', 'url(#age-night-hole-grad)');
                // The city glow blooms in slowly as its lights accumulate.
                hole.style.transitionDelay = `${Math.round(rand() * 90)}s`;
                hole.style.transitionDuration = `${Math.round(60 + rand() * 60)}s`;
                els.nightShadeHoles.appendChild(hole);
            }
        });
        (els.nightLayer || els.visualLayer).appendChild(group);
        rebuildFogSurfaceTorchCache();
        requestFogSurfaceLightLoop();
        syncSettlementSurfaceLights();
    }

    function buildSvgLayers() {
        ensureRestrictedPatternDef();
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
        appendNationColorFills(els.colorLayerNations);
        appendTerrainColorFills(els.colorLayerTerrain);
        renderColorMapLegend();

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
        const nightLightEntries = [];

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

            // Night lights are generated after the fragment lands in the DOM —
            // scattering them inside the borders needs live path geometry.
            // The secret masked settlement never lights up.
            if (!isMaskedCity(city)) {
                nightLightEntries.push({ city, path: borderPath });
            }

            if (isMaskedCity(city)) {
                const restrictedPath = global.document.createElementNS('http://www.w3.org/2000/svg', 'path');
                restrictedPath.setAttribute('class', 'age-world-city-restricted-path');
                restrictedPath.setAttribute('d', outlineD);
                restrictedPath.setAttribute('data-city-id', city.id);
                restrictedPath.setAttribute('fill', 'url(#age-world-restricted-hatch)');
                restrictedPath.setAttribute('stroke', 'rgb(110, 24, 24)');
                restrictedPath.setAttribute('stroke-width', '1.4');
                restrictedPath.setAttribute('vector-effect', 'non-scaling-stroke');
                restrictedPath.setAttribute('pointer-events', 'none');
                visualFrag.appendChild(restrictedPath);
            }

            const hitPath = global.document.createElementNS('http://www.w3.org/2000/svg', 'path');
            hitPath.setAttribute('id', hitId);
            hitPath.setAttribute('class', 'age-world-city-hit-path');
            hitPath.setAttribute('d', outlineD);
            hitPath.setAttribute('data-city-id', city.id);
            hitPath.setAttribute('vector-effect', 'non-scaling-stroke');
            hitFrag.appendChild(hitPath);

            if (highlightFrag) {
                const terrainKey = normalizeTerrainKey(city.terrain);
                const highlightPath = global.document.createElementNS('http://www.w3.org/2000/svg', 'path');
                highlightPath.setAttribute('id', highlightId);
                highlightPath.setAttribute('class', 'age-world-city-highlight-path');
                highlightPath.setAttribute('d', outlineD);
                highlightPath.setAttribute('data-city-id', city.id);
                highlightPath.setAttribute('data-terrain', terrainKey);
                highlightPath.setAttribute('vector-effect', 'non-scaling-stroke');
                highlightFrag.appendChild(highlightPath);
            }

        });

        if (ownershipFrag && els.ownershipLayer) {
            els.ownershipLayer.appendChild(ownershipFrag);
        }
        els.visualLayer.appendChild(visualFrag);
        els.hitLayer.appendChild(hitFrag);
        if (highlightFrag && els.highlightLayer) {
            els.highlightLayer.appendChild(highlightFrag);
        }
        cachedNightLightEntries = nightLightEntries;
        if (isMapAmbientEffectsEnabled()) {
            buildNightLights(nightLightEntries);
        }
        bindCityHitDelegation();
        refreshNationCityHighlights();
    }

    function refreshNationCityHighlights() {
        if (!catalog) return;

        const playerNation = resolvePlayerNationForOwnership();

        if (els.ownershipLayer) {
            els.ownershipLayer.querySelectorAll('.age-world-city-ownership-path').forEach((node) => {
                const city = cityById.get(node.getAttribute('data-city-id'));
                if (!city) return;
                stampDiplomacyClassesOnCityNode(node, city, playerNation);
            });
        }

        if (els.visualLayer) {
            els.visualLayer.querySelectorAll('.age-world-city-border-path').forEach((node) => {
                const city = cityById.get(node.getAttribute('data-city-id'));
                if (!city) return;
                stampDiplomacyClassesOnCityNode(node, city, playerNation);
                applyCityBorderRelationshipStroke(node);
            });
        }

        syncOwnershipVisuals();
        refreshNationColorFills();
        syncPlayerNationCapitalShine();
    }

    function refreshNationCityHighlightsWithDiplomacy() {
        void ensureDiplomacyNationSets().then(() => {
            refreshNationCityHighlights();
        });
    }

    function showCityHighlight(cityId) {
        if (!cityId || !els.highlightLayer) return;
        clearCityHighlight();
        hoveredCityId = cityId;
        forEachCityHighlightNode(cityId, (node) => {
            node.classList.add('is-active');
        });
    }

    // At (or near) full zoom out, hide bordering-neighbor highlights and the
    // Color Map city fills/borders; only the clicked city keeps its glow.
    const FULL_ZOOM_OUT_RATIO = 1.02;

    function syncNeighborHighlightZoomVisibility() {
        // Use targetScale (the zoom intent) instead of the eased scale so the
        // overlays start fading the instant the player rolls the wheel.
        const zoomedOut = (targetScale / baseScale) <= FULL_ZOOM_OUT_RATIO;
        els.highlightLayer?.classList.toggle('is-full-zoom-out', zoomedOut);
        els.frame?.classList.toggle('is-full-zoom-out', zoomedOut);
    }

    // Cloud deck over the continent at full zoom out; zooming in pushes through it.
    // Heavier weather hangs lower: rain decks stay in view deeper into the zoom,
    // while fair-weather puffs sit high and clear almost immediately.
    const CLOUD_CLEAR_RANGES = {
        rainy: { start: 1.0, end: 3.05 },
        cloudy: { start: 1.05, end: 2.35 },
        sunny: { start: 1.02, end: 1.95 },
        clear: { start: 1.12, end: 1.72 }
    };
    const CLOUD_CLEAR_DEFAULT = CLOUD_CLEAR_RANGES.cloudy;
    const CLOUD_MASS_TRANSIT_MS = 14500;
    const CLOUD_TRANSIT_FRAME_MS = 80;

    let cloudMassTransit = 0;
    let cloudMassTransitLastTs = 0;
    let cloudTransitRafId = 0;
    let lastRainyCloudVarsSig = '';
    let lastRainyPierceSig = -1;
    let lastCloudEyeActive = false;
    let lastCloudMassTransitActive = false;

    // Rainy push-through: approach → eye (dark mass) → drift exit → pierce (see surface).

    function resolveCloudMasterPush() {
        const range = CLOUD_CLEAR_RANGES[activeWeatherType] || CLOUD_CLEAR_DEFAULT;
        return smoothstep(fadeRange(scaleRatio(), range.start, range.end));
    }

    function resolveRainyApproach(zoomPush, pierce) {
        const rush = smoothstep(fadeRange(zoomPush, 0.05, 0.44));
        const decay = 1 - smoothstep(fadeRange(zoomPush, 0.52, 0.82));
        const raw = rush * (0.18 + decay * 0.82);
        return clamp(raw * (1 - pierce * 0.98), 0, 1);
    }

    function resolveRainyEye(zoomPush, transit) {
        const enter = smoothstep(fadeRange(zoomPush, 0.32, 0.50));
        const exitZoom = smoothstep(fadeRange(zoomPush, 0.70, 0.90));
        const exitTransit = smoothstep(transit);
        return clamp(enter * (1 - exitZoom) * (1 - exitTransit * 0.94), 0, 1);
    }

    function resolveRainyPierce(zoomPush, transit) {
        const pierceZoom = smoothstep(fadeRange(zoomPush, 0.46, 0.92));
        const pierceTransit = smoothstep(transit) * 0.58;
        return clamp(Math.max(pierceZoom, pierceTransit), 0, 1);
    }

    function resetRainyCloudTransit() {
        cloudMassTransit = 0;
        cloudMassTransitLastTs = 0;
        lastRainyCloudVarsSig = '';
        lastRainyPierceSig = -1;
        lastCloudEyeActive = false;
        lastCloudMassTransitActive = false;
        if (cloudTransitRafId) {
            global.clearTimeout(cloudTransitRafId);
            cloudTransitRafId = 0;
        }
        els.frame?.classList.remove('is-cloud-eye-active', 'is-cloud-mass-transit');
        ['--age-cloud-eye', '--age-cloud-pierce', '--age-cloud-approach', '--age-cloud-transit', '--age-cloud-zoom-push']
            .forEach((prop) => els.frame?.style.removeProperty(prop));
        if (els.cloudEyeVeil) {
            els.cloudEyeVeil.style.opacity = '0';
        }
    }

    function stopCloudTransitLoop() {
        if (cloudTransitRafId) {
            global.clearTimeout(cloudTransitRafId);
            cloudTransitRafId = 0;
        }
    }

    function scheduleCloudTransitLoop() {
        if (cloudTransitRafId) return;
        cloudTransitRafId = global.setTimeout(cloudTransitLoop, CLOUD_TRANSIT_FRAME_MS);
    }

    function cloudTransitLoop() {
        cloudTransitRafId = 0;
        if (activeWeatherType !== 'rainy' || isColorMapStyleActive() || isMapScaleAnimating()) return;
        const zoomPush = Math.min(1, resolveCloudMasterPush());
        tickRainyCloudMassTransit(zoomPush, false);
        if (els.cloudLayer) {
            applyRainyCloudVars(els.cloudLayer, zoomPush, false);
        }
        if (lastCloudMassTransitActive && cloudMassTransit < 0.999) {
            cloudTransitRafId = global.setTimeout(cloudTransitLoop, CLOUD_TRANSIT_FRAME_MS);
        }
    }

    function tickRainyCloudMassTransit(zoomPush, zoomAnimating) {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const inBand = zoomPush >= 0.34 && zoomPush < 0.84;
        const eyeHold = resolveRainyEye(zoomPush, cloudMassTransit) > 0.28;

        if (zoomPush < 0.26) {
            cloudMassTransit = 0;
            cloudMassTransitLastTs = 0;
            return;
        }

        if (!inBand || zoomAnimating || zoomPush >= 0.82 || !eyeHold) {
            if (!eyeHold || zoomPush >= 0.82) {
                cloudMassTransitLastTs = 0;
            }
            return;
        }

        if (!cloudMassTransitLastTs) cloudMassTransitLastTs = now;
        const dt = Math.min(48, now - cloudMassTransitLastTs);
        cloudMassTransitLastTs = now;
        if (cloudMassTransit < 1) {
            cloudMassTransit = Math.min(1, cloudMassTransit + dt / CLOUD_MASS_TRANSIT_MS);
        }
    }

    function applyRainyCloudVars(layer, zoomPush, zoomAnimating) {
        tickRainyCloudMassTransit(zoomPush, zoomAnimating);
        const pierce = resolveRainyPierce(zoomPush, cloudMassTransit);
        const approach = resolveRainyApproach(zoomPush, pierce);
        const eye = resolveRainyEye(zoomPush, cloudMassTransit);
        const quantStep = zoomAnimating ? 32 : 64;
        const varsSig = [
            Math.round(approach * quantStep),
            Math.round(eye * quantStep),
            Math.round(pierce * quantStep),
            Math.round(cloudMassTransit * quantStep),
            Math.round(zoomPush * quantStep)
        ].join('|');
        const pierceSig = Math.round(pierce * 64);
        const eyeActive = eye > 0.08;
        const massTransitActive = cloudMassTransit > 0.02 && eye > 0.2;

        if (layer && varsSig !== lastRainyCloudVarsSig) {
            lastRainyCloudVarsSig = varsSig;
            const layerVars = {
                '--age-cloud-push': String(zoomPush),
                '--age-cloud-zoom-push': String(zoomPush),
                '--age-cloud-approach': String(approach),
                '--age-cloud-eye': String(eye),
                '--age-cloud-pierce': String(pierce),
                '--age-cloud-transit': String(cloudMassTransit)
            };
            Object.entries(layerVars).forEach(([prop, value]) => {
                layer.style.setProperty(prop, value);
            });
            if (els.cloudEyeVeil) {
                els.cloudEyeVeil.style.opacity = String(eye);
            }
        }

        if (pierceSig !== lastRainyPierceSig) {
            lastRainyPierceSig = pierceSig;
            els.frame?.style.setProperty('--age-cloud-pierce', String(pierce));
        }

        if (eyeActive !== lastCloudEyeActive) {
            lastCloudEyeActive = eyeActive;
            els.frame?.classList.toggle('is-cloud-eye-active', eyeActive);
        }
        if (massTransitActive !== lastCloudMassTransitActive) {
            lastCloudMassTransitActive = massTransitActive;
            els.frame?.classList.toggle('is-cloud-mass-transit', massTransitActive);
        }

        if (massTransitActive && !zoomAnimating && cloudMassTransit < 0.999) {
            scheduleCloudTransitLoop();
        } else {
            stopCloudTransitLoop();
        }
        return pierce;
    }

    function ensureCloudEyeVeil() {
        if (!els.frame || els.cloudEyeVeil) return;
        const veil = global.document.createElement('div');
        veil.className = 'age-world-map-cloud-eye-veil';
        veil.setAttribute('aria-hidden', 'true');
        els.frame.insertBefore(veil, els.cloudLayer || null);
        els.cloudEyeVeil = veil;
    }

    function resolveCloudPushThrough() {
        return resolveCloudMasterPush();
    }

    function isCloudLayerFullyThrough(punchThrough, zoomAnimating) {
        if (activeWeatherType === 'rainy') {
            const pierce = resolveRainyPierce(punchThrough, cloudMassTransit);
            return pierce >= 0.998 && !zoomAnimating;
        }
        return punchThrough >= 0.999 && !zoomAnimating;
    }

    function appendSunnyCloudDeck(sub) {
        if (!sub) return;
        const drift = sub.querySelector('.age-world-map-cloud-drift--sunny');
        if (!drift) return;
        if (!sub.querySelector('.age-world-map-cloud-shadow--sunny')) {
            const shadow = global.document.createElement('div');
            shadow.className = 'age-world-map-cloud-shadow age-world-map-cloud-shadow--sunny';
            sub.insertBefore(shadow, drift);
        }
        if (!sub.querySelector('.age-world-map-cloud-shadow--sunny-mega')) {
            const shadowMega = global.document.createElement('div');
            shadowMega.className = 'age-world-map-cloud-shadow age-world-map-cloud-shadow--sunny-mega';
            sub.insertBefore(shadowMega, drift);
        }
        if (!sub.querySelector('.age-world-map-cloud-drift--sunny-mega')) {
            const driftMega = global.document.createElement('div');
            driftMega.className = 'age-world-map-cloud-drift age-world-map-cloud-drift--sunny-mega';
            const surfaceMega = global.document.createElement('div');
            surfaceMega.className = 'age-world-map-cloud-drift-surface';
            driftMega.appendChild(surfaceMega);
            sub.appendChild(driftMega);
        }
    }

    function restoreOriginalSunnyCloud(drift) {
        if (!drift) return;
        drift.querySelectorAll([
            '.age-world-map-cloud-sunny-stack',
            '.age-world-map-cloud-sunny-sheet',
            '.age-world-map-cloud-sunny-shadow-sheet',
            '.age-world-map-cloud-puff-field'
        ].join(', ')).forEach((node) => {
            node.remove();
        });
        const surface = drift.querySelector('.age-world-map-cloud-drift-surface');
        if (surface) {
            surface.classList.remove('age-world-map-cloud-drift-surface--sunny-puffs');
            surface.style.display = '';
        }
        appendSunnyCloudDeck(drift.parentElement);
        global.document.getElementById('age-sunny-cloud-filters')?.remove();
    }

    function ensureCloudLayer() {
        if (!els.frame) return;
        if (els.cloudLayer) {
            ensureCloudLightningSlots();
            ensureCloudEyeVeil();
            restoreOriginalSunnyCloud(els.cloudLayer.querySelector('.age-world-map-cloud-drift--sunny'));
            return;
        }
        const layer = global.document.createElement('div');
        layer.className = 'age-world-map-cloud-layer';
        layer.setAttribute('aria-hidden', 'true');
        // 'storm' renders only on rainy days (CSS-gated): a near-opaque dark deck.
        // 'sunny' renders only on sunny days: a few scattered fair-weather puffs.
        // Rainy stack (bottom → top): a, lightning, b, lightning, c, lightning, storm, sunny.
        const rainyStack = [
            { kind: 'cloud', variant: 'a' },
            { kind: 'lightning', gap: 'b-a' },
            { kind: 'cloud', variant: 'b' },
            { kind: 'lightning', gap: 'c-b' },
            { kind: 'cloud', variant: 'c' },
            { kind: 'lightning', gap: 'storm-c' },
            { kind: 'cloud', variant: 'storm' },
            { kind: 'cloud', variant: 'sunny' }
        ];
        rainyStack.forEach((entry) => {
            if (entry.kind === 'lightning') {
                layer.appendChild(createCloudLightningTrack(entry.gap));
                return;
            }
            const variant = entry.variant;
            const sub = global.document.createElement('div');
            sub.className = `age-world-map-cloud-sub age-world-map-cloud-sub--${variant}`;
            const drift = global.document.createElement('div');
            drift.className = `age-world-map-cloud-drift age-world-map-cloud-drift--${variant}`;
            const surface = global.document.createElement('div');
            surface.className = 'age-world-map-cloud-drift-surface';
            drift.appendChild(surface);
            sub.appendChild(drift);
            if (variant === 'sunny') {
                appendSunnyCloudDeck(sub);
            }
            layer.appendChild(sub);
        });
        els.frame.appendChild(layer);
        els.cloudLayer = layer;
        ensureCloudEyeVeil();
        ensureCloudLightningSlots();
    }

    const CLOUD_LIGHTNING_GAPS = [
        { id: 'storm-c', upper: 'storm', lower: 'c', origin: 'storm' },
        { id: 'c-b', upper: 'c', lower: 'b', origin: 'c' },
        { id: 'b-a', upper: 'b', lower: 'a', origin: 'b' }
    ];
    const CLOUD_LIGHTNING_FADE_MS = 2250;
    const CLOUD_LIGHTNING_VIEW_ORIGIN = {
        a: { x: 1500, y: 1500 },
        b: { x: 0, y: 0 },
        c: { x: 3200, y: 3200 },
        storm: { x: 2800, y: 2800 }
    };

    function appendCloudLightningSlots(container) {
        if (!container) return;
        for (let slotIdx = container.querySelectorAll('.age-world-map-cloud-lightning-slot').length; slotIdx < 2; slotIdx += 1) {
            const slot = global.document.createElement('div');
            slot.className = 'age-world-map-cloud-lightning-slot';
            container.appendChild(slot);
        }
    }

    function createCloudLightningTrack(gapId) {
        const track = global.document.createElement('div');
        track.className = `age-world-map-cloud-lightning-track age-world-map-cloud-lightning-track--${gapId}`;
        track.setAttribute('aria-hidden', 'true');
        appendCloudLightningSlots(track);
        return track;
    }

    function ensureCloudLightningTrack(gapId) {
        if (!els.cloudLayer) return null;
        let track = els.cloudLayer.querySelector(`.age-world-map-cloud-lightning-track--${gapId}`);
        if (!track) {
            track = createCloudLightningTrack(gapId);
        } else {
            appendCloudLightningSlots(track);
        }
        return track;
    }

    function normalizeCloudLayerOrder() {
        if (!els.cloudLayer) return;
        const layer = els.cloudLayer;

        layer.querySelectorAll('.age-world-map-cloud-drift .age-world-map-cloud-lightning-slot').forEach((slot) => {
            slot.remove();
        });
        layer.querySelectorAll('[class*="age-world-map-cloud-lightning-track--"]').forEach((track) => {
            if (!CLOUD_LIGHTNING_GAPS.some((gap) => track.classList.contains(`age-world-map-cloud-lightning-track--${gap.id}`))) {
                track.remove();
            }
        });

        const tracks = {};
        CLOUD_LIGHTNING_GAPS.forEach((gap) => {
            tracks[gap.id] = ensureCloudLightningTrack(gap.id);
        });

        const subs = {};
        ['a', 'b', 'c', 'storm', 'sunny'].forEach((variant) => {
            subs[variant] = layer.querySelector(`.age-world-map-cloud-sub--${variant}`);
        });

        [
            subs.a,
            tracks['b-a'],
            subs.b,
            tracks['c-b'],
            subs.c,
            tracks['storm-c'],
            subs.storm,
            subs.sunny
        ].filter(Boolean).forEach((node) => {
            layer.appendChild(node);
        });
    }

    function ensureDriftStructure(sub, variant) {
        if (!sub) return { drift: null, surface: null };
        const drift = sub.querySelector(`.age-world-map-cloud-drift--${variant}`);
        if (!drift) return { drift: null, surface: null };

        let surface = drift.querySelector('.age-world-map-cloud-drift-surface');
        if (!surface) {
            surface = global.document.createElement('div');
            surface.className = 'age-world-map-cloud-drift-surface';
            drift.insertBefore(surface, drift.firstChild);
        }

        const legacyTrack = sub.querySelector(`.age-world-map-cloud-lightning-track--${variant}`);
        if (legacyTrack) {
            legacyTrack.remove();
        }

        return { drift, surface };
    }

    function placeLightningSlot(slot, container, originKey) {
        if (!slot || !container) return;
        const origin = CLOUD_LIGHTNING_VIEW_ORIGIN[originKey] || { x: 0, y: 0 };
        const viewW = container.offsetWidth || container.clientWidth || 0;
        const viewH = container.offsetHeight || container.clientHeight || 0;
        if (!viewW || !viewH) return;

        const x = origin.x + (0.08 + Math.random() * 0.84) * viewW;
        const y = origin.y + (0.04 + Math.random() * 0.58) * viewH;
        const w = 200 + Math.random() * 160;
        const h = 140 + Math.random() * 110;
        slot.style.left = `${x.toFixed(0)}px`;
        slot.style.top = `${y.toFixed(0)}px`;
        slot.style.width = `${w.toFixed(0)}px`;
        slot.style.height = `${h.toFixed(0)}px`;
    }

    function flashCloudSurface(surface) {
        if (!surface) return;
        surface.classList.remove('is-cloud-lit');
        void surface.offsetWidth;
        surface.classList.add('is-cloud-lit');
        global.setTimeout(() => {
            surface.classList.remove('is-cloud-lit');
        }, CLOUD_LIGHTNING_FADE_MS);
    }

    function resolveCloudSubSurface(variant) {
        if (!els.cloudLayer || !variant) return null;
        const sub = els.cloudLayer.querySelector(`.age-world-map-cloud-sub--${variant}`);
        const { surface } = ensureDriftStructure(sub, variant);
        return surface;
    }

    function ensureCloudLightningSlots() {
        if (!els.cloudLayer) return;
        const legacy = els.cloudLayer.querySelector('.age-world-map-lightning-layer');
        if (legacy) legacy.remove();
        ['a', 'b', 'c', 'storm', 'sunny'].forEach((variant) => {
            const sub = els.cloudLayer.querySelector(`.age-world-map-cloud-sub--${variant}`);
            ensureDriftStructure(sub, variant);
        });
        normalizeCloudLayerOrder();
    }

    const THUNDER_AUDIO_SRCS = [
        'audio/thunder1.wav?v=thunder-sfx-1',
        'audio/thunder2.wav?v=thunder-sfx-1',
        'audio/thunder3.wav?v=thunder-sfx-1',
        'audio/thunder4.wav?v=thunder-sfx-1',
        'audio/thunder5.wav?v=thunder-sfx-1'
    ];
    const THUNDER_BELOW_CLOUDS_VOLUME = 0.12;
    const THUNDER_PAST_CLOUDS_VOLUME = 1;
    const HEAVY_RAIN_AUDIO_SRC = 'audio/Heavy%20Rain.wav?v=heavy-rain-loop-3';
    const HEAVY_RAIN_MIN_VOLUME = 0.025;
    const HEAVY_RAIN_MAX_VOLUME = 0.46;
    const HEAVY_RAIN_VOLUME_LERP = 0.12;
    const HEAVY_RAIN_LOOP_TRIM_START = 0.04;
    const HEAVY_RAIN_LOOP_TRIM_END = 0.14;
    let heavyRainCtx = null;
    let heavyRainGain = null;
    let heavyRainSource = null;
    let heavyRainBuffer = null;
    let heavyRainBufferPromise = null;
    let heavyRainMasterVolume = 0;
    let lastHeavyRainVolume = -1;
    let lightningTimer = null;
    let lightningFlashSeq = 0;
    let thunderAudioPool = [];
    let thunderPlayOrder = [];
    let thunderOrderIdx = 0;
    let thunderPlaying = false;

    function resolveMapAmbientVolumeScale() {
        if (typeof global.currentPortalSfxVol === 'number'
            && typeof global.currentPortalMasterVol === 'number') {
            return Math.max(0, Math.min(1, global.currentPortalSfxVol * global.currentPortalMasterVol));
        }
        return 1;
    }

    function resolveThunderPushThrough() {
        if (activeWeatherType !== 'rainy') return 0;
        const zoomPush = resolveCloudMasterPush();
        return resolveRainyPierce(zoomPush, cloudMassTransit);
    }

    function resolveThunderCloudMix() {
        const push = resolveThunderPushThrough();
        if (push <= 0) return 0;
        if (push >= 0.72) return 1;
        return smoothstep01((push - 0.08) / 0.64);
    }

    function resolveMapThunderVolume() {
        const portalScale = resolveMapAmbientVolumeScale();
        const mix = resolveThunderCloudMix();
        const level = THUNDER_BELOW_CLOUDS_VOLUME
            + (THUNDER_PAST_CLOUDS_VOLUME - THUNDER_BELOW_CLOUDS_VOLUME) * mix;
        return Math.max(0, Math.min(1, level * portalScale));
    }

    function smoothstep01(value) {
        const t = clamp(value, 0, 1);
        return t * t * (3 - 2 * t);
    }

    function purgeLegacyHeavyRainElements() {
        ['age-world-heavy-rain-audio', 'age-world-heavy-rain-audio-a', 'age-world-heavy-rain-audio-b'].forEach((id) => {
            global.document.getElementById(id)?.remove();
        });
    }

    function ensureHeavyRainContext() {
        if (heavyRainCtx) return heavyRainCtx;
        const Ctx = global.AudioContext || global.webkitAudioContext;
        if (!Ctx) return null;
        heavyRainCtx = new Ctx();
        heavyRainGain = heavyRainCtx.createGain();
        heavyRainGain.gain.value = 0;
        heavyRainGain.connect(heavyRainCtx.destination);
        return heavyRainCtx;
    }

    function loadHeavyRainBuffer() {
        if (heavyRainBuffer) return Promise.resolve(heavyRainBuffer);
        if (heavyRainBufferPromise) return heavyRainBufferPromise;
        const ctx = ensureHeavyRainContext();
        if (!ctx) return Promise.resolve(null);
        heavyRainBufferPromise = fetch(HEAVY_RAIN_AUDIO_SRC, { credentials: 'same-origin' })
            .then((response) => {
                if (!response.ok) throw new Error('heavy rain fetch failed');
                return response.arrayBuffer();
            })
            .then((arrayBuffer) => ctx.decodeAudioData(arrayBuffer))
            .then((decoded) => {
                heavyRainBuffer = decoded;
                return decoded;
            })
            .catch(() => {
                heavyRainBufferPromise = null;
                return null;
            });
        return heavyRainBufferPromise;
    }

    function startHeavyRainSource() {
        if (heavyRainSource || !heavyRainBuffer || !heavyRainCtx || !heavyRainGain) return;
        const source = heavyRainCtx.createBufferSource();
        source.buffer = heavyRainBuffer;
        source.loop = true;
        source.loopStart = HEAVY_RAIN_LOOP_TRIM_START;
        source.loopEnd = Math.max(
            HEAVY_RAIN_LOOP_TRIM_START + 0.5,
            heavyRainBuffer.duration - HEAVY_RAIN_LOOP_TRIM_END
        );
        source.connect(heavyRainGain);
        source.start(0);
        heavyRainSource = source;
    }

    function setHeavyRainGainVolume(volume) {
        if (!heavyRainGain || !heavyRainCtx) return;
        heavyRainGain.gain.setTargetAtTime(
            Math.max(0, Math.min(1, volume)),
            heavyRainCtx.currentTime,
            0.1
        );
    }

    function stopHeavyRainAudio() {
        purgeLegacyHeavyRainElements();
        if (heavyRainSource) {
            try {
                heavyRainSource.stop();
            } catch (_err) {
                /* already stopped */
            }
            heavyRainSource.disconnect();
            heavyRainSource = null;
        }
        heavyRainMasterVolume = 0;
        lastHeavyRainVolume = -1;
        setHeavyRainGainVolume(0);
    }

    function syncHeavyRainAudio() {
        if (isColorMapStyleActive() || activeWeatherType !== 'rainy') {
            stopHeavyRainAudio();
            return;
        }

        purgeLegacyHeavyRainElements();
        const ctx = ensureHeavyRainContext();
        if (!ctx) return;

        const pushThrough = resolveCloudPushThrough();
        const targetVolume = (
            HEAVY_RAIN_MIN_VOLUME
            + (HEAVY_RAIN_MAX_VOLUME - HEAVY_RAIN_MIN_VOLUME) * smoothstep01(pushThrough)
        ) * resolveMapAmbientVolumeScale();
        const nextVolume = heavyRainMasterVolume
            + (targetVolume - heavyRainMasterVolume) * HEAVY_RAIN_VOLUME_LERP;

        if (!heavyRainBuffer) {
            loadHeavyRainBuffer().then((decoded) => {
                if (decoded && activeWeatherType === 'rainy') {
                    syncHeavyRainAudio();
                }
            });
            return;
        }

        if (Math.abs(nextVolume - lastHeavyRainVolume) < 0.001
            && Math.abs(targetVolume - nextVolume) < 0.001) {
            return;
        }
        lastHeavyRainVolume = nextVolume;
        heavyRainMasterVolume = Math.max(0, Math.min(1, nextVolume));

        if (targetVolume <= 0.004) {
            setHeavyRainGainVolume(0);
            return;
        }

        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }
        startHeavyRainSource();
        setHeavyRainGainVolume(heavyRainMasterVolume);
    }

    function shuffleThunderPlayOrder() {
        thunderPlayOrder = THUNDER_AUDIO_SRCS.map((_src, index) => index);
        for (let i = thunderPlayOrder.length - 1; i > 0; i -= 1) {
            const swapIdx = Math.floor(Math.random() * (i + 1));
            const hold = thunderPlayOrder[i];
            thunderPlayOrder[i] = thunderPlayOrder[swapIdx];
            thunderPlayOrder[swapIdx] = hold;
        }
        thunderOrderIdx = 0;
    }

    function ensureThunderAudioPool() {
        if (thunderAudioPool.length) return;
        const root = global.document.body || global.document.documentElement;
        THUNDER_AUDIO_SRCS.forEach((src, index) => {
            const audio = global.document.createElement('audio');
            audio.preload = 'auto';
            audio.setAttribute('playsinline', '');
            audio.dataset.thunderIndex = String(index);
            audio.src = src;
            root.appendChild(audio);
            thunderAudioPool.push(audio);
        });
        shuffleThunderPlayOrder();
    }

    function nextThunderAudio() {
        ensureThunderAudioPool();
        if (!thunderPlayOrder.length) return null;
        if (thunderOrderIdx >= thunderPlayOrder.length) {
            shuffleThunderPlayOrder();
        }
        const audioIndex = thunderPlayOrder[thunderOrderIdx];
        thunderOrderIdx += 1;
        return thunderAudioPool[audioIndex] || null;
    }

    function stopThunderAudio() {
        thunderAudioPool.forEach((audio) => {
            audio.onended = null;
            audio.onerror = null;
            audio.pause();
            audio.currentTime = 0;
        });
        thunderPlaying = false;
    }

    function playThunderForLightningStrike() {
        const audio = nextThunderAudio();
        if (!audio) return Promise.resolve();

        thunderPlaying = true;
        audio.volume = resolveMapThunderVolume();
        audio.currentTime = 0;

        return new Promise((resolve) => {
            const finish = () => {
                audio.onended = null;
                audio.onerror = null;
                thunderPlaying = false;
                resolve();
            };
            audio.onended = finish;
            audio.onerror = finish;
            audio.play().catch(finish);
        });
    }

    function isLightningStrikeBlocked() {
        return thunderPlaying;
    }

    function stopLightning() {
        if (lightningTimer) {
            global.clearTimeout(lightningTimer);
            lightningTimer = null;
        }
        stopThunderAudio();
        if (!els.cloudLayer) return;
        els.cloudLayer.querySelectorAll('.age-world-map-cloud-drift-surface').forEach((surface) => {
            surface.classList.remove('is-cloud-lit');
        });
        els.cloudLayer.querySelectorAll('.age-world-map-cloud-lightning-slot').forEach((node) => {
            node.classList.remove('is-striking');
        });
    }

    function nextLightningDelayMs() {
        lightningFlashSeq += 1;
        const hash = hashWeatherKey(`${weatherTickKey()}-ltn-${lightningFlashSeq}`);
        return 9000 + (hash % 15000);
    }

    function scheduleLightningStrike() {
        if (lightningTimer) {
            global.clearTimeout(lightningTimer);
            lightningTimer = null;
        }
        if (activeWeatherType !== 'rainy' || isLightningStrikeBlocked()) return;
        lightningTimer = global.setTimeout(() => {
            lightningTimer = null;
            triggerLightningStrike();
        }, nextLightningDelayMs());
    }

    function triggerLightningStrike() {
        if (activeWeatherType !== 'rainy' || !els.cloudLayer || isLightningStrikeBlocked()) return;
        const gapDef = CLOUD_LIGHTNING_GAPS[Math.floor(Math.random() * CLOUD_LIGHTNING_GAPS.length)];
        const track = ensureCloudLightningTrack(gapDef.id);
        if (!track) {
            scheduleLightningStrike();
            return;
        }

        const slots = track.querySelectorAll('.age-world-map-cloud-lightning-slot');
        if (!slots.length) {
            scheduleLightningStrike();
            return;
        }
        const open = Array.from(slots).filter((node) => !node.classList.contains('is-striking'));
        const slot = (open.length ? open : slots)[Math.floor(Math.random() * slots.length)];
        if (!slot) {
            scheduleLightningStrike();
            return;
        }

        placeLightningSlot(slot, track, gapDef.origin);
        flashCloudSurface(resolveCloudSubSurface(gapDef.upper));
        flashCloudSurface(resolveCloudSubSurface(gapDef.lower));

        slot.classList.remove('is-striking');
        void slot.offsetWidth;
        slot.classList.add('is-striking');
        global.setTimeout(() => {
            slot.classList.remove('is-striking');
        }, CLOUD_LIGHTNING_FADE_MS);

        playThunderForLightningStrike().then(() => {
            scheduleLightningStrike();
        });
    }

    function syncLightningState() {
        if (!isMapAmbientEffectsEnabled()) {
            stopLightning();
            return;
        }
        if (isColorMapStyleActive()) {
            stopLightning();
            return;
        }
        if (activeWeatherType === 'rainy') {
            scheduleLightningStrike();
        } else {
            stopLightning();
        }
    }

    // Weather over Amnek, re-rolled every game tick (30 minutes, UTC-aligned).
    // Each tick is an independent random roll — one tick of rain can be followed by
    // sun, or rain can hold for several ticks in a row. Deterministic from the tick
    // index, so every commander sees the same sky without any server round-trip.
    const WEATHER_TYPES = ['clear', 'sunny', 'cloudy', 'rainy'];
    const WEATHER_TICK_MS = 30 * 60 * 1000;
    let activeWeatherType = '';
    let activeSurfaceFogPhase = '';
    let weatherOverrideType = '';
    let weatherTimer = null;
    let cachedNightLightEntries = null;

    function isMapAmbientEffectsEnabled() {
        if (global.RoyalArmiesMapAmbientEffects?.isEnabled) {
            return global.RoyalArmiesMapAmbientEffects.isEnabled();
        }
        return global.localStorage?.getItem('savedMapAmbientEffects') === 'true';
    }

    function weatherTickIndex(atMs = Date.now()) {
        return Math.floor(atMs / WEATHER_TICK_MS);
    }

    function weatherTickKeyForIndex(tickIndex) {
        return `amnek-weather-tick-${tickIndex}`;
    }

    function weatherTickKey(atMs = Date.now()) {
        return weatherTickKeyForIndex(weatherTickIndex(atMs));
    }

    function hashWeatherKey(key) {
        let hash = 0;
        for (let i = 0; i < key.length; i += 1) {
            hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
        }
        return Math.abs(hash);
    }

    function resolveWeatherForTickOffset(offset = 0, atMs = Date.now()) {
        if (offset === 0 && weatherOverrideType) return weatherOverrideType;
        const tickIndex = weatherTickIndex(atMs) + offset;
        return WEATHER_TYPES[hashWeatherKey(weatherTickKeyForIndex(tickIndex)) % WEATHER_TYPES.length];
    }

    function resolveTickWeatherType() {
        return resolveWeatherForTickOffset(0);
    }

    function resolveWeatherForecast(atMs = Date.now()) {
        return {
            current: resolveWeatherForTickOffset(0, atMs),
            previous: resolveWeatherForTickOffset(-1, atMs),
            next: resolveWeatherForTickOffset(1, atMs),
            tickIndex: weatherTickIndex(atMs),
            tickMs: WEATHER_TICK_MS,
            msUntilNextTick: WEATHER_TICK_MS - (atMs % WEATHER_TICK_MS)
        };
    }

    // Surface fog bookends rain: the tick before rain arrives, and the first
    // non-rainy tick after a rainy spell — never during rain itself.
    function resolveSurfaceFogPhase(atMs = Date.now()) {
        const forecast = resolveWeatherForecast(atMs);
        if (forecast.current === 'rainy') return '';
        if (forecast.next === 'rainy') return 'pre-rain';
        if (forecast.previous === 'rainy') return 'post-rain';
        return '';
    }

    function syncSurfaceFogState() {
        if (!els.frame) return;
        if (isColorMapStyleActive()) {
            activeSurfaceFogPhase = '';
            els.frame.classList.remove('is-surface-fog-pre-rain', 'is-surface-fog-post-rain');
            stopFogSurfaceLightLoop();
            return;
        }
        const phase = resolveSurfaceFogPhase();
        if (phase === activeSurfaceFogPhase) return;
        activeSurfaceFogPhase = phase;
        els.frame.classList.toggle('is-surface-fog-pre-rain', phase === 'pre-rain');
        els.frame.classList.toggle('is-surface-fog-post-rain', phase === 'post-rain');
        requestFogSurfaceLightLoop();
    }

    function ensureRainPlungeLayers(rain) {
        if (!rain || rain.querySelector('.age-world-map-rain-fall--a')) return;
        rain.querySelectorAll('.age-world-map-rain-field').forEach((node) => node.remove());
        ['a', 'b', 'c', 'd'].forEach((variant) => {
            const sub = global.document.createElement('div');
            sub.className = `age-world-map-rain-sub age-world-map-rain-sub--${variant}`;
            const fall = global.document.createElement('div');
            fall.className = `age-world-map-rain-fall age-world-map-rain-fall--${variant}`;
            sub.appendChild(fall);
            rain.appendChild(sub);
        });
        invalidateRainFallAnims();
    }

    const SURFACE_FOG_SIZE_ORDER = ['s', 'm', 'm', 'l', 'l', 'xl', 's', 'm', 'l', 's', 'm', 'xl', 's', 'l', 'm', 'xl'];
    const SURFACE_FOG_PATCH_COUNT = SURFACE_FOG_SIZE_ORDER.length;

    function resolveSurfaceFogPatchLayout(index) {
        const hash = hashWeatherKey(`surface-fog-patch-${index}`);
        const size = SURFACE_FOG_SIZE_ORDER[index] || 'm';
        return {
            size,
            x: 5 + (hash % 860) / 10,
            y: 7 + ((hash >> 5) % 780) / 10,
            duration: 48 + (hash % 92),
            delay: -((hash >> 3) % 220),
            peak: 0.38 + (hash % 34) / 100
        };
    }

    function ensureSurfaceFogPatches(layer) {
        if (!layer || layer.querySelector('.age-world-map-surface-fog-patch')) return;
        for (let patchIdx = 0; patchIdx < SURFACE_FOG_PATCH_COUNT; patchIdx += 1) {
            const layout = resolveSurfaceFogPatchLayout(patchIdx);
            const patch = global.document.createElement('div');
            patch.className = `age-world-map-surface-fog-patch age-world-map-surface-fog-patch--${layout.size}`;
            patch.style.left = `${layout.x.toFixed(2)}%`;
            patch.style.top = `${layout.y.toFixed(2)}%`;
            patch.style.setProperty('--fog-duration', `${layout.duration}s`);
            patch.style.setProperty('--fog-delay', `${layout.delay}s`);
            patch.style.setProperty('--fog-peak', layout.peak.toFixed(2));
            const mist = global.document.createElement('div');
            mist.className = 'age-world-map-surface-fog-patch-mist';
            patch.appendChild(mist);
            layer.appendChild(patch);
        }
    }

    function ensureSurfaceFogLayer() {
        if (!els.frame) return;
        if (!els.surfaceFogLayer) {
            const fog = global.document.createElement('div');
            fog.className = 'age-world-map-surface-fog-layer';
            fog.setAttribute('aria-hidden', 'true');
            ensureSurfaceFogPatches(fog);
            els.frame.insertBefore(fog, els.cloudLayer || null);
            els.surfaceFogLayer = fog;
        } else {
            ensureSurfaceFogPatches(els.surfaceFogLayer);
        }
        const pushThrough = Math.min(1, resolveCloudPushThrough());
        els.surfaceFogLayer.style.setProperty('--age-cloud-push', String(pushThrough));
        requestFogSurfaceLightLoop();
    }

    // Full lamps at evening/night; sunset gets a sparse early set; fog is the
    // daytime exception.
    const SETTLEMENT_LIGHT_NIGHT_PHASES = ['evening', 'night'];
    const SETTLEMENT_LIGHT_SUNSET_PHASE = 'sunset';
    const SETTLEMENT_FOG_LIGHT_PHASES = ['sunrise', 'morning', 'afternoon', 'sunset'];
    const FOG_SURFACE_LIGHT_MIN = 0.1;
    const FOG_SURFACE_LIGHT_SYNC_MS = 180;
    let fogSurfaceTorchCache = [];
    let fogSurfaceLightTimer = 0;

    function settlementNightLightsActive() {
        return SETTLEMENT_LIGHT_NIGHT_PHASES.includes(activeDaylightPhase);
    }

    function settlementSunsetLightsActive() {
        return activeDaylightPhase === SETTLEMENT_LIGHT_SUNSET_PHASE;
    }

    function fogSurfaceLightsActive() {
        return Boolean(activeSurfaceFogPhase)
            && SETTLEMENT_FOG_LIGHT_PHASES.includes(activeDaylightPhase)
            && !settlementNightLightsActive()
            && !isColorMapStyleActive();
    }

    function rebuildFogSurfaceTorchCache() {
        fogSurfaceTorchCache = [];
        const group = els.nightLayer?.querySelector('.age-world-night-light-group')
            || els.visualLayer?.querySelector('.age-world-night-light-group');
        if (!group) return;
        group.querySelectorAll('.age-world-city-torch').forEach((torchEl) => {
            const cx = Number.parseFloat(torchEl.getAttribute('cx'));
            const cy = Number.parseFloat(torchEl.getAttribute('cy'));
            if (Number.isFinite(cx) && Number.isFinite(cy)) {
                fogSurfaceTorchCache.push({ el: torchEl, cx, cy });
            }
        });
    }

    function mapPointToFogLayerPercent(mapX, mapY) {
        const fogLayer = els.surfaceFogLayer;
        if (!fogLayer || !els.svg) return null;
        const fogRect = fogLayer.getBoundingClientRect();
        if (!fogRect.width || !fogRect.height) return null;
        const cache = resolveMapScreenTransformCache();
        if (!cache) return null;
        if (!mapSvgPoint && typeof els.svg.createSVGPoint === 'function') {
            mapSvgPoint = els.svg.createSVGPoint();
        }
        if (!mapSvgPoint) return null;
        mapSvgPoint.x = mapX;
        mapSvgPoint.y = mapY;
        const screen = mapSvgPoint.matrixTransform(cache.matrix);
        return {
            x: ((screen.x - fogRect.left) / fogRect.width) * 100,
            y: ((screen.y - fogRect.top) / fogRect.height) * 100
        };
    }

    function resolveFogPatchBounds(patch, fogRect) {
        const patchRect = patch.getBoundingClientRect();
        const centerX = Number.parseFloat(patch.style.left);
        const centerY = Number.parseFloat(patch.style.top);
        if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) return null;
        return {
            cx: centerX,
            cy: centerY,
            rx: (patchRect.width / fogRect.width) * 50,
            ry: (patchRect.height / fogRect.height) * 50,
            opacity: Number.parseFloat(global.getComputedStyle(patch).opacity) || 0
        };
    }

    function torchInsideFogPatch(point, bounds) {
        if (!point || !bounds || bounds.opacity < FOG_SURFACE_LIGHT_MIN) return 0;
        const dx = (point.x - bounds.cx) / Math.max(bounds.rx, 0.001);
        const dy = (point.y - bounds.cy) / Math.max(bounds.ry, 0.001);
        if ((dx * dx) + (dy * dy) > 1) return 0;
        return bounds.opacity;
    }

    function clearFogSurfaceLights() {
        fogSurfaceTorchCache.forEach(({ el }) => {
            el.classList.remove('is-fog-surface-lit');
            el.style.removeProperty('--fog-light-strength');
        });
        syncSettlementSurfaceLights();
    }

    function syncSettlementSurfaceLights() {
        if (!fogSurfaceTorchCache.length) return;
        if (isColorMapStyleActive()) {
            fogSurfaceTorchCache.forEach(({ el }) => {
                el.classList.remove('is-fog-surface-lit');
                el.style.opacity = '0';
                el.style.removeProperty('--fog-light-strength');
            });
            return;
        }
        if (settlementNightLightsActive()) {
            fogSurfaceTorchCache.forEach(({ el }) => {
                el.classList.remove('is-fog-surface-lit');
                el.style.removeProperty('opacity');
                el.style.removeProperty('--fog-light-strength');
            });
            return;
        }
        if (settlementSunsetLightsActive()) {
            fogSurfaceTorchCache.forEach(({ el }) => {
                const strength = Number.parseFloat(el.style.getPropertyValue('--fog-light-strength') || '0');
                const fogLit = el.classList.contains('is-fog-surface-lit')
                    && fogSurfaceLightsActive()
                    && strength >= FOG_SURFACE_LIGHT_MIN;
                if (fogLit) {
                    el.style.opacity = String(strength * 0.9);
                    return;
                }
                el.classList.remove('is-fog-surface-lit');
                el.style.removeProperty('opacity');
                el.style.removeProperty('--fog-light-strength');
            });
            return;
        }
        fogSurfaceTorchCache.forEach(({ el }) => {
            const strength = Number.parseFloat(el.style.getPropertyValue('--fog-light-strength') || '0');
            const fogLit = el.classList.contains('is-fog-surface-lit')
                && fogSurfaceLightsActive()
                && strength >= FOG_SURFACE_LIGHT_MIN;
            if (fogLit) {
                el.style.opacity = String(strength * 0.9);
                return;
            }
            el.classList.remove('is-fog-surface-lit');
            el.style.opacity = '0';
            el.style.removeProperty('--fog-light-strength');
        });
    }

    function syncFogSurfaceLights() {
        if (!fogSurfaceLightsActive() || !els.surfaceFogLayer || !fogSurfaceTorchCache.length) {
            clearFogSurfaceLights();
            return;
        }
        const fogRect = els.surfaceFogLayer.getBoundingClientRect();
        if (!fogRect.width || !fogRect.height) return;
        const patchBounds = [];
        els.surfaceFogLayer.querySelectorAll('.age-world-map-surface-fog-patch').forEach((patch) => {
            const bounds = resolveFogPatchBounds(patch, fogRect);
            if (bounds && bounds.opacity >= FOG_SURFACE_LIGHT_MIN) {
                patchBounds.push(bounds);
            }
        });
        if (!patchBounds.length) {
            clearFogSurfaceLights();
            return;
        }
        fogSurfaceTorchCache.forEach(({ el, cx, cy }) => {
            const point = mapPointToFogLayerPercent(cx, cy);
            let strength = 0;
            if (point) {
                patchBounds.forEach((bounds) => {
                    strength = Math.max(strength, torchInsideFogPatch(point, bounds));
                });
            }
            if (strength >= FOG_SURFACE_LIGHT_MIN) {
                el.classList.add('is-fog-surface-lit');
                el.style.setProperty('--fog-light-strength', strength.toFixed(3));
            } else {
                el.classList.remove('is-fog-surface-lit');
                el.style.removeProperty('--fog-light-strength');
            }
        });
        syncSettlementSurfaceLights();
    }

    function stopFogSurfaceLightLoop() {
        if (fogSurfaceLightTimer) {
            global.clearTimeout(fogSurfaceLightTimer);
            fogSurfaceLightTimer = 0;
        }
        clearFogSurfaceLights();
    }

    function fogSurfaceLightTick() {
        fogSurfaceLightTimer = 0;
        if (!fogSurfaceLightsActive()) {
            stopFogSurfaceLightLoop();
            return;
        }
        syncFogSurfaceLights();
        fogSurfaceLightTimer = global.setTimeout(fogSurfaceLightTick, FOG_SURFACE_LIGHT_SYNC_MS);
    }

    function requestFogSurfaceLightLoop() {
        if (!fogSurfaceLightsActive()) {
            stopFogSurfaceLightLoop();
            return;
        }
        if (!fogSurfaceLightTimer) {
            fogSurfaceLightTick();
        }
    }

    function ensureWeatherLayers() {
        if (!els.frame) return;
        if (!els.rainLayer) {
            const rain = global.document.createElement('div');
            rain.className = 'age-world-map-rain-layer';
            rain.setAttribute('aria-hidden', 'true');
            ensureRainPlungeLayers(rain);
            els.frame.insertBefore(rain, els.cloudLayer || null);
            els.rainLayer = rain;
        } else {
            ensureRainPlungeLayers(els.rainLayer);
        }
        ensureSurfaceFogLayer();
        if (!els.sunLayer) {
            const sun = global.document.createElement('div');
            sun.className = 'age-world-map-sun-layer';
            sun.setAttribute('aria-hidden', 'true');
            const sheen = global.document.createElement('div');
            sheen.className = 'age-world-map-sun-sheen';
            sun.appendChild(sheen);
            els.frame.insertBefore(sun, els.cloudLayer || null);
            els.sunLayer = sun;
        }
    }

    function applyWeatherState() {
        if (!els.frame) return;
        if (!isMapAmbientEffectsEnabled()) return;
        if (isColorMapStyleActive()) return;
        syncSurfaceFogState();
        const next = resolveTickWeatherType();
        if (next === activeWeatherType) return;
        if (activeWeatherType === 'rainy' || next !== 'rainy') {
            resetRainyCloudTransit();
        }
        activeWeatherType = next;
        WEATHER_TYPES.forEach((type) => {
            els.frame.classList.toggle(`is-weather-${type}`, type === next);
        });
        // Cloud altitude depends on the weather — re-sync the push-through state.
        lastCloudPush = -1;
        syncCloudLayer();
        syncHeavyRainAudio();
        if (next === 'rainy') {
            invalidateRainFallAnims();
            lastRainPlaybackApplied = -1;
            global.requestAnimationFrame(() => {
                invalidateRainFallAnims();
                syncRainLayer();
            });
        }
        syncLightningState();
        // Snap sky grade to storm-cooled tints and clear any warm terminator sweep.
        activeDaylightPhase = '';
        applyDaylightState({ forceRefresh: true });
        syncTypography();
    }

    // Day/night cycle over Amnek, driven by the UTC game clock so every commander
    // shares the same sky. The phase advances every 4 game-time hours.
    const DAYLIGHT_PHASES = ['sunrise', 'morning', 'afternoon', 'sunset', 'evening', 'night'];
    let activeDaylightPhase = '';
    let daylightOverridePhase = '';

    // Six phases x 4 game-time (UTC) hours each = one full cycle per day:
    // 00-04 night, 04-08 sunrise, 08-12 morning, 12-16 afternoon,
    // 16-20 sunset, 20-24 evening.
    const DAYLIGHT_SCHEDULE = ['night', 'sunrise', 'morning', 'afternoon', 'sunset', 'evening'];

    function resolveDaylightPhase() {
        if (daylightOverridePhase) return daylightOverridePhase;
        const block = Math.floor(new Date().getUTCHours() / 4);
        return DAYLIGHT_SCHEDULE[block] || 'night';
    }

    // Sky tints per phase. Stored in JS (not per-phase CSS) so the terminator
    // sweep can paint the outgoing tint as a sliding gradient band. The heavy
    // darkness lives on the in-SVG night shade (which the settlement lights
    // punch through); this layer is just the sky grade over clouds and land,
    // so lit pools stay bright under it.
    const DAYLIGHT_TINTS = {
        sunrise: 'rgba(255, 165, 105, 0.13)',
        morning: 'rgba(255, 236, 200, 0.05)',
        afternoon: 'rgba(255, 236, 200, 0)',
        sunset: 'rgba(255, 125, 62, 0.16)',
        evening: 'rgba(62, 54, 102, 0.16)',
        night: 'rgba(8, 14, 38, 0.22)'
    };
    // Rain replaces warm sky grades with cool storm light so no orange terminator
    // or sunset rim bleeds through on the west edge of the map.
    const RAINY_DAYLIGHT_TINTS = {
        sunrise: 'rgba(22, 26, 34, 0.14)',
        morning: 'rgba(24, 28, 36, 0.08)',
        afternoon: 'rgba(20, 24, 32, 0.03)',
        sunset: 'rgba(18, 22, 30, 0.16)',
        evening: 'rgba(14, 18, 26, 0.20)',
        night: 'rgba(10, 12, 18, 0.26)'
    };

    function resolveDaylightTint(phase) {
        const palette = activeWeatherType === 'rainy' ? RAINY_DAYLIGHT_TINTS : DAYLIGHT_TINTS;
        return palette[phase] || 'rgba(0, 0, 0, 0)';
    }
    // How long the terminator takes to cross Amnek east → west.
    const DAYLIGHT_SWEEP_MS = 60000;
    let daylightSweepTimer = null;

    function daylightTintAtZeroAlpha(tint) {
        return tint.replace(/[\d.]+\)$/u, '0)');
    }

    function applyDaylightState(options = {}) {
        if (!els.frame) return;
        if (!isMapAmbientEffectsEnabled()) return;
        if (isColorMapStyleActive()) return;
        const forceRefresh = options.forceRefresh === true;
        const next = resolveDaylightPhase();
        if (!forceRefresh && next === activeDaylightPhase) return;
        const previous = forceRefresh ? '' : activeDaylightPhase;
        activeDaylightPhase = next;
        DAYLIGHT_PHASES.forEach((phase) => {
            els.frame.classList.toggle(`is-daylight-${phase}`, phase === next);
        });
        requestFogSurfaceLightLoop();
        syncSettlementSurfaceLights();
        const base = els.daylightBase;
        const sweep = els.daylightSweep;
        if (!base) return;
        const nextTint = resolveDaylightTint(next);
        if (!previous || !sweep || activeWeatherType === 'rainy') {
            if (sweep) {
                sweep.style.transition = 'none';
                sweep.style.opacity = '0';
            }
            base.style.backgroundColor = nextTint;
            return;
        }
        // Directional handoff, like the real terminator: the incoming sky takes
        // the east (right) edge first, then the outgoing sky — painted on the
        // sweep band with a feathered western edge — slides off to the west, so
        // players watch day get consumed by night from east to west.
        if (daylightSweepTimer) {
            global.clearTimeout(daylightSweepTimer);
            daylightSweepTimer = null;
        }
        const prevTint = resolveDaylightTint(previous);
        base.style.backgroundColor = nextTint;
        sweep.style.background = `linear-gradient(90deg, ${prevTint} 0%, ${prevTint} 70%, ${daylightTintAtZeroAlpha(prevTint)} 100%)`;
        sweep.style.transition = 'none';
        sweep.style.transform = 'translate3d(0, 0, 0)';
        sweep.style.opacity = '1';
        void sweep.offsetWidth;
        sweep.style.transition = `transform ${DAYLIGHT_SWEEP_MS}ms linear`;
        sweep.style.transform = 'translate3d(-100%, 0, 0)';
        daylightSweepTimer = global.setTimeout(() => {
            daylightSweepTimer = null;
            sweep.style.transition = 'none';
            sweep.style.opacity = '0';
        }, DAYLIGHT_SWEEP_MS + 120);
    }

    function hideAmbientOverlayLayer(node) {
        if (!node) return;
        node.style.display = 'none';
        node.style.visibility = 'hidden';
        node.style.opacity = '0';
    }

    function revealAmbientOverlayLayer(node) {
        if (!node) return;
        node.style.removeProperty('display');
        node.style.removeProperty('visibility');
        node.style.removeProperty('opacity');
    }

    function stopWeatherWatch() {
        if (weatherTimer) {
            global.clearInterval(weatherTimer);
            weatherTimer = null;
        }
        if (daylightSweepTimer) {
            global.clearTimeout(daylightSweepTimer);
            daylightSweepTimer = null;
        }
        stopCloudTransitLoop();
        resetRainyCloudTransit();
        if (rainRafId) {
            global.cancelAnimationFrame(rainRafId);
            rainRafId = 0;
        }
    }

    function suppressAmbientMapEffects() {
        if (!els.frame) return;
        WEATHER_TYPES.forEach((type) => {
            els.frame.classList.remove(`is-weather-${type}`);
        });
        DAYLIGHT_PHASES.forEach((phase) => {
            els.frame.classList.remove(`is-daylight-${phase}`);
        });
        activeSurfaceFogPhase = '';
        els.frame.classList.remove('is-surface-fog-pre-rain', 'is-surface-fog-post-rain');
        if (els.daylightBase) {
            els.daylightBase.style.backgroundColor = 'transparent';
        }
        if (els.daylightSweep) {
            els.daylightSweep.style.transition = 'none';
            els.daylightSweep.style.opacity = '0';
        }
        if (els.nightLayer) {
            els.nightLayer.style.transition = 'none';
            els.nightLayer.style.opacity = '0';
            els.nightLayer.style.visibility = 'hidden';
        }
        stopLightning();
        stopHeavyRainAudio();
        stopFogSurfaceLightLoop();
        syncSettlementSurfaceLights();
        lastCloudPush = -1;
        hideAmbientOverlayLayer(els.cloudLayer);
        hideAmbientOverlayLayer(els.rainLayer);
        hideAmbientOverlayLayer(els.sunLayer);
        hideAmbientOverlayLayer(els.surfaceFogLayer);
        hideAmbientOverlayLayer(els.daylightLayer);
        if (els.cloudEyeVeil) {
            els.cloudEyeVeil.style.opacity = '0';
        }
        els.frame.classList.remove('is-cloud-pushed-through', 'is-cloud-eye-active', 'is-cloud-mass-transit');
    }

    function restoreAmbientMapEffects() {
        revealAmbientOverlayLayer(els.cloudLayer);
        revealAmbientOverlayLayer(els.rainLayer);
        revealAmbientOverlayLayer(els.sunLayer);
        revealAmbientOverlayLayer(els.surfaceFogLayer);
        revealAmbientOverlayLayer(els.daylightLayer);
        if (els.nightLayer) {
            els.nightLayer.style.removeProperty('transition');
            els.nightLayer.style.removeProperty('opacity');
            els.nightLayer.style.removeProperty('visibility');
        }
        activeWeatherType = '';
        activeDaylightPhase = '';
        applyWeatherState();
        applyDaylightState();
        syncSettlementSurfaceLights();
        lastCloudPush = -1;
        syncCloudLayer({ force: true });
    }

    function disableMapAmbientEffectsRuntime() {
        stopWeatherWatch();
        suppressAmbientMapEffects();
    }

    function enableMapAmbientEffectsRuntime() {
        if (!els.frame || isColorMapStyleActive()) return;
        ensureCloudLayer();
        ensureWeatherLayers();
        ensureDaylightLayer();
        syncRainMapAnchor();
        revealAmbientOverlayLayer(els.cloudLayer);
        revealAmbientOverlayLayer(els.rainLayer);
        revealAmbientOverlayLayer(els.sunLayer);
        revealAmbientOverlayLayer(els.surfaceFogLayer);
        revealAmbientOverlayLayer(els.daylightLayer);
        if (cachedNightLightEntries?.length) {
            buildNightLights(cachedNightLightEntries);
        }
        restoreAmbientMapEffects();
        syncRainLayer();
        startWeatherWatch();
    }

    function ensureDaylightLayer() {
        if (els.daylightLayer || !els.frame) return;
        const layer = global.document.createElement('div');
        layer.className = 'age-world-map-daylight-layer';
        layer.setAttribute('aria-hidden', 'true');
        const base = global.document.createElement('div');
        base.className = 'age-world-map-daylight-base';
        layer.appendChild(base);
        const sweep = global.document.createElement('div');
        sweep.className = 'age-world-map-daylight-sweep';
        layer.appendChild(sweep);
        // Appended after the cloud deck so the day/night grade tints clouds too.
        els.frame.appendChild(layer);
        els.daylightLayer = layer;
        els.daylightBase = base;
        els.daylightSweep = sweep;
    }

    function startWeatherWatch() {
        if (!isMapAmbientEffectsEnabled()) return;
        applyWeatherState();
        applyDaylightState();
        if (weatherTimer) return;
        // Re-check often enough that the sky flips within seconds of each boundary.
        weatherTimer = global.setInterval(() => {
            applyWeatherState();
            applyDaylightState();
        }, 15000);
    }

    global.RoyalArmiesAgeWeather = {
        getType: () => activeWeatherType,
        getForecast: () => ({
            ...resolveWeatherForecast(),
            surfaceFog: resolveSurfaceFogPhase()
        }),
        getNextType: () => resolveWeatherForTickOffset(1),
        getPreviousType: () => resolveWeatherForTickOffset(-1),
        getSurfaceFogPhase: () => resolveSurfaceFogPhase(),
        setOverride(type) {
            weatherOverrideType = WEATHER_TYPES.includes(type) ? type : '';
            activeSurfaceFogPhase = '';
            applyWeatherState();
        },
        clearOverride() {
            weatherOverrideType = '';
            activeSurfaceFogPhase = '';
            applyWeatherState();
        },
        getPhase: () => activeDaylightPhase,
        setPhaseOverride(phase) {
            daylightOverridePhase = DAYLIGHT_PHASES.includes(phase) ? phase : '';
            applyDaylightState();
        },
        clearPhaseOverride() {
            daylightOverridePhase = '';
            applyDaylightState();
        }
    };

    let lastCloudPush = -1;
    let lastCloudRainAudioPush = -1;
    let rainRafId = 0;
    let rainFallAnims = null;
    let rainPlaybackRate = 1;
    let rainZoomDirection = 0;
    let rainZoomHoldFrames = 0;
    let lastRainPlaybackApplied = -1;

    const RAIN_ZOOM_IN_PLAYBACK = 0.34;
    const RAIN_ZOOM_OUT_PLAYBACK = 1.55;
    const RAIN_ZOOM_APPROACH_LERP = 0.065;
    const RAIN_ZOOM_RECOVERY_LERP = 0.026;
    const RAIN_ZOOM_HOLD_FRAMES = 22;
    const RAIN_ZOOM_ACTIVE_EPS = 0.0005;

    function invalidateRainFallAnims() {
        rainFallAnims = null;
    }

    function rainFallAnimations() {
        if (rainFallAnims && rainFallAnims.length) return rainFallAnims;
        const layer = els.rainLayer;
        if (!layer) return [];
        rainFallAnims = [];
        layer.querySelectorAll('.age-world-map-rain-fall').forEach((node) => {
            const anims = node.getAnimations();
            if (anims.length) rainFallAnims.push(...anims);
        });
        return rainFallAnims;
    }

    function applyRainPlaybackRate(rate) {
        rainFallAnimations().forEach((anim) => {
            anim.playbackRate = rate;
        });
    }

    function rainEffectNeedsFrames() {
        return Math.abs(rainPlaybackRate - 1) > 0.012
            || Math.abs(scale - targetScale) > RAIN_ZOOM_ACTIVE_EPS
            || rainZoomHoldFrames > 0;
    }

    function rainEffectTick() {
        syncRainLayer();
        if (rainEffectNeedsFrames()) {
            rainRafId = global.requestAnimationFrame(rainEffectTick);
        } else {
            rainRafId = 0;
        }
    }

    function requestRainEffectTick() {
        if (!rainRafId) {
            rainRafId = global.requestAnimationFrame(rainEffectTick);
        }
    }

    function syncRainLayer() {
        const layer = els.rainLayer;
        if (!layer) return;
        if (!isMapAmbientEffectsEnabled()) return;
        if (isColorMapStyleActive()) return;

        const zoomAnimating = Math.abs(scale - targetScale) > RAIN_ZOOM_ACTIVE_EPS;
        let targetPlayback = 1;

        if (zoomAnimating) {
            const zoomDir = Math.sign(targetScale - scale);
            if (zoomDir) rainZoomDirection = zoomDir;
            const zoomRemain = Math.abs(targetScale - scale) / Math.max(baseScale, 0.001);
            const intensity = Math.min(1, zoomRemain / (baseScale * 0.09));
            if (rainZoomDirection > 0) {
                targetPlayback = 1 - intensity * (1 - RAIN_ZOOM_IN_PLAYBACK);
            } else if (rainZoomDirection < 0) {
                targetPlayback = 1 + intensity * (RAIN_ZOOM_OUT_PLAYBACK - 1);
            }
            rainZoomHoldFrames = RAIN_ZOOM_HOLD_FRAMES;
        } else if (rainZoomHoldFrames > 0) {
            const holdT = 1 - (rainZoomHoldFrames / RAIN_ZOOM_HOLD_FRAMES);
            const heldPlayback = rainZoomDirection > 0 ? RAIN_ZOOM_IN_PLAYBACK : RAIN_ZOOM_OUT_PLAYBACK;
            targetPlayback = heldPlayback + holdT * (1 - heldPlayback);
            rainZoomHoldFrames -= 1;
        } else {
            targetPlayback = 1;
            rainZoomDirection = 0;
        }

        const lerp = zoomAnimating ? RAIN_ZOOM_APPROACH_LERP : RAIN_ZOOM_RECOVERY_LERP;
        rainPlaybackRate += (targetPlayback - rainPlaybackRate) * lerp;
        if (!zoomAnimating && rainZoomHoldFrames <= 0 && Math.abs(rainPlaybackRate - 1) < 0.008) {
            rainPlaybackRate = 1;
        }

        if (Math.abs(rainPlaybackRate - lastRainPlaybackApplied) < 0.006) return;
        lastRainPlaybackApplied = rainPlaybackRate;
        applyRainPlaybackRate(rainPlaybackRate);
        if (rainEffectNeedsFrames()) {
            requestRainEffectTick();
        }
    }

    function syncCloudLayer(options = {}) {
        const layer = els.cloudLayer;
        if (!layer) return;
        if (!isMapAmbientEffectsEnabled()) return;
        if (isColorMapStyleActive()) {
            layer.style.visibility = 'hidden';
            layer.style.opacity = '0';
            layer.style.setProperty('--age-cloud-push', '0');
            resetRainyCloudTransit();
            els.frame?.classList.remove('is-cloud-pushed-through');
            return;
        }
        if (activeWeatherType === 'clear') {
            layer.style.visibility = 'hidden';
            layer.style.opacity = '0';
            layer.style.setProperty('--age-cloud-push', '0');
            if (els.surfaceFogLayer) {
                els.surfaceFogLayer.style.setProperty('--age-cloud-push', '0');
            }
            resetRainyCloudTransit();
            els.frame?.classList.remove('is-cloud-pushed-through');
            lastCloudPush = 0;
            return;
        }

        const zoomAnimating = options.zoomAnimating ?? isMapScaleAnimating();
        const punchThrough = Math.min(1, resolveCloudMasterPush());
        const pushDelta = Math.abs(punchThrough - lastCloudPush);
        const transitNeedsFrame = activeWeatherType === 'rainy' && lastCloudMassTransitActive;
        if (!options.force && !zoomAnimating && pushDelta < 0.0005 && !transitNeedsFrame) return;
        if (!options.force && zoomAnimating && pushDelta < 0.0018) return;
        lastCloudPush = punchThrough;

        let hideDeck = false;
        if (activeWeatherType === 'rainy') {
            ensureCloudEyeVeil();
            const pierce = applyRainyCloudVars(layer, punchThrough, zoomAnimating);
            hideDeck = pierce >= 0.97 && !zoomAnimating;
            layer.style.visibility = hideDeck ? 'hidden' : 'visible';
            layer.style.opacity = '1';
            if (hideDeck) {
                els.frame?.style.setProperty('--age-cloud-pierce', '1');
                els.frame?.style.setProperty('--age-cloud-approach', '0');
                els.frame?.style.setProperty('--age-cloud-eye', '0');
            }
        } else {
            hideDeck = isCloudLayerFullyThrough(punchThrough, zoomAnimating);
            layer.style.visibility = hideDeck ? 'hidden' : 'visible';
            layer.style.opacity = String(Math.max(0, 1 - punchThrough));
            layer.style.setProperty('--age-cloud-push', String(punchThrough));
        }

        els.frame?.classList.toggle('is-cloud-pushed-through', hideDeck);

        if (els.surfaceFogLayer) {
            const fogPush = activeWeatherType === 'rainy'
                ? resolveRainyPierce(punchThrough, cloudMassTransit)
                : punchThrough;
            els.surfaceFogLayer.style.setProperty('--age-cloud-push', String(fogPush));
            if (hideDeck) {
                els.surfaceFogLayer.style.visibility = 'hidden';
                els.surfaceFogLayer.style.opacity = '0';
            } else {
                els.surfaceFogLayer.style.removeProperty('visibility');
                els.surfaceFogLayer.style.removeProperty('opacity');
            }
        }

        if (hideDeck && els.cloudEyeVeil) {
            els.cloudEyeVeil.style.opacity = '0';
        }

        if (activeWeatherType === 'rainy') {
            const rainPush = resolveRainyPierce(punchThrough, cloudMassTransit);
            if (Math.abs(rainPush - lastCloudRainAudioPush) >= 0.03) {
                lastCloudRainAudioPush = rainPush;
                syncHeavyRainAudio();
            }
        }
    }

    function showCitySelectionHighlight(cityId) {
        if (!cityId || !els.highlightLayer) return;
        clearCityHighlight();
        hoveredCityId = '';

        const maskedSelection = isMaskedCity(cityById.get(cityId));

        forEachCityHighlightNode(cityId, (node) => {
            node.classList.add(maskedSelection ? 'is-restricted-selected-city' : 'is-selected-city');
        });

        if (maskedSelection) return;

        resolveBorderingCityIds(cityId).forEach((neighborId) => {
            const neighborClass = isMaskedCity(cityById.get(neighborId))
                ? 'is-restricted-neighbor'
                : 'is-bordering-neighbor';
            forEachCityHighlightNode(neighborId, (node) => {
                node.classList.add(neighborClass);
            });
        });
    }

    function clearCityHighlight() {
        hoveredCityId = '';
        if (!els.highlightLayer) return;
        els.highlightLayer.querySelectorAll('.age-world-city-highlight-path, .age-world-city-highlight-boost').forEach((node) => {
            CITY_HIGHLIGHT_INTERACTION_CLASSES.forEach((className) => {
                node.classList.remove(className);
            });
        });
    }

    function playerBordersCity(city) {
        if (!playerMapCityId) return false;
        if (city.id === playerMapCityId) return true;
        const occupied = cityById.get(playerMapCityId);
        if (!occupied) return false;
        return Array.isArray(city.neighbors) && city.neighbors.includes(playerMapCityId);
    }

    function canShowInfiltrationButton(city) {
        if (!isMaskedCity(city) || !playerMapCityId) return false;
        if (city.id === playerMapCityId) return false;
        return Array.isArray(city.neighbors) && city.neighbors.includes(playerMapCityId);
    }

    function positionCityDrawer() {
        if (!els.drawer || !els.frame) return;

        const pad = 12;
        const frameH = els.frame.clientHeight || 0;
        const maxDrawerH = Math.max(180, frameH - pad * 2);
        const drawerBox = els.drawer.querySelector('.age-world-city-drawer-box');
        const drawerChrome = els.drawer.querySelector('.age-world-city-drawer-chrome');

        els.drawer.style.left = `${pad}px`;
        els.drawer.style.bottom = `${pad}px`;
        els.drawer.style.top = 'auto';
        els.drawer.style.right = 'auto';

        if (drawerBox) drawerBox.style.maxHeight = `${maxDrawerH}px`;
        if (drawerChrome) drawerChrome.style.maxHeight = `${maxDrawerH}px`;
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

        const hints = global.RoyalArmiesAgeMovement?.getBorderActionHints?.(
            city,
            resolveActivePlayerCatalogCityId()
        ) || {};
        const movePoints = global.RoyalArmiesAgeMovement?.getMovePoints?.() ?? 0;
        const movePointCost = Math.max(1, Math.floor(Number(hints.movePointCost) || 1));
        const hasMovePoint = movePoints >= movePointCost;
        const moveCostLabel = movePointCost === 1 ? '1 Move' : `${movePointCost} Moves`;
        const waterNote = hints.connectionType === 'water' ? ' via water crossing' : '';
        const showAny = hints.canTravel || hints.canAssault || hints.canTransfer;

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

        actionsHost.innerHTML = buttons.join('');

        let statusEl = global.document.getElementById('age-world-city-drawer-movement-status');
        if (!statusEl) {
            statusEl = global.document.createElement('p');
            statusEl.id = 'age-world-city-drawer-movement-status';
            statusEl.className = 'age-world-city-drawer-movement-status';
            statusEl.setAttribute('aria-live', 'polite');
            statusEl.hidden = true;
            actionsHost.insertAdjacentElement('afterend', statusEl);
        }
    }

    function refreshDrawerWatchtowerButton(city, hints) {
        const button = els.drawerWatchtowerOpen;
        if (!button || !city) return;

        if (isMaskedCity(city)) {
            button.hidden = true;
            button.disabled = true;
            button.setAttribute('aria-disabled', 'true');
            return;
        }

        const relationship = String(hints?.relationship || 'remote').trim().toLowerCase();
        const isBordering = relationship !== 'remote' && relationship !== 'current';
        const canUseWatchtower = isBordering && relationship === 'hostile';

        button.hidden = false;
        button.disabled = !canUseWatchtower;
        button.setAttribute('aria-disabled', canUseWatchtower ? 'false' : 'true');

        if (!isBordering) {
            button.title = relationship === 'current'
                ? 'Your current city — border a hostile or neutral settlement to use the Watchtower.'
                : 'Establish a bordering presence on this city to use the Watchtower.';
            return;
        }

        if (relationship === 'ally') {
            button.title = 'Watchtower intel is for hostile and neutral borders only.';
            return;
        }

        button.title = 'Open the Watchtower to spy the garrison, scout commanders, and seize hostile players.';
    }

    const INFILTRATE_BUTTON_LABEL = 'Attempt Infiltration';
    let infiltrateAttemptTimer = null;

    function refreshDrawerInfiltrateButton(city) {
        const button = els.infiltrateOpen;
        if (!button || !city) return;

        const canInfiltrate = canShowInfiltrationButton(city);
        button.hidden = !canInfiltrate;
        if (!canInfiltrate) {
            button.disabled = false;
            button.setAttribute('aria-disabled', 'false');
            button.title = '';
            return;
        }

        button.disabled = false;
        button.setAttribute('aria-disabled', 'false');
        button.title = 'Attempt to infiltrate this unknown settlement from your bordering city.';
    }

    function resetInfiltrateButton() {
        if (infiltrateAttemptTimer) {
            global.clearTimeout(infiltrateAttemptTimer);
            infiltrateAttemptTimer = null;
        }
        const button = els.infiltrateOpen;
        if (button) {
            button.disabled = false;
            button.textContent = INFILTRATE_BUTTON_LABEL;
        }
        els.drawer?.querySelector('.age-world-city-infiltrate-result')?.remove();
    }

    function handleInfiltrateAttempt() {
        const button = els.infiltrateOpen;
        if (!button || button.disabled) return;
        els.drawer?.querySelector('.age-world-city-infiltrate-result')?.remove();
        button.disabled = true;
        button.textContent = 'Searching for a way in…';
        infiltrateAttemptTimer = global.setTimeout(() => {
            infiltrateAttemptTimer = null;
            button.disabled = false;
            button.textContent = INFILTRATE_BUTTON_LABEL;
            const note = global.document.createElement('p');
            note.className = 'age-world-city-infiltrate-result';
            note.textContent = 'Every approach is sealed and watched. Whatever lies within does not want to be found.';
            const actions = button.closest('.age-world-city-drawer-actions');
            (actions || button).insertAdjacentElement('afterend', note);
        }, 1600);
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

    async function resolveEnemyPlayersInCityCount(cityId) {
        const username = typeof global.resolveActiveCommanderUsername === 'function'
            ? global.resolveActiveCommanderUsername()
            : '';
        if (!username || !cityId) return 1;

        try {
            const query = new URLSearchParams({
                username,
                catalogCityId: String(cityId)
            });
            const apiUrl = typeof global.resolveApiUrl === 'function'
                ? global.resolveApiUrl(`/api/portal/age/city-players?${query.toString()}`)
                : `/api/portal/age/city-players?${query.toString()}`;
            const response = await global.fetch(apiUrl, { credentials: 'same-origin' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) return 1;

            const playerNation = global.RoyalArmiesAgeMovement?.resolvePlayerNationId?.() || '';
            const allied = global.RoyalArmiesAgeMovement?.getAlliedNationIds?.() || [];
            const enemies = (payload.players || []).filter((player) => {
                if (player.isSelf) return false;
                const nation = String(player.nationId || '').trim().toLowerCase();
                if (!nation || nation === playerNation) return false;
                return !allied.includes(nation);
            });
            return Math.max(1, enemies.length);
        } catch (_err) {
            return 1;
        }
    }

    async function refreshDrawerAssaultRisk(city, hints) {
        if (!els.drawerAssaultRisk || !city) return;

        const ledGroup = global.RoyalArmiesAgeArmyGroups?.getLedArmyGroup?.();
        const canPreview = !isMaskedCity(city)
            && Boolean(hints?.canAssault && ledGroup?.id && global.RoyalArmiesAgeAssaultRisk);

        if (!canPreview) {
            els.drawerAssaultRisk.hidden = true;
            els.drawerAssaultRisk.innerHTML = '';
            return;
        }

        els.drawerAssaultRisk.hidden = false;
        els.drawerAssaultRisk.innerHTML = '<p class="age-assault-risk-copy">Calculating casualty pressure…</p>';

        try {
            const playersInCity = await resolveEnemyPlayersInCityCount(city.id);
            const payload = await global.RoyalArmiesAgeAssaultRisk.fetchAssaultCasualtyEstimate(city.id, {
                playersInCity,
                forceRefresh: true
            });
            els.drawerAssaultRisk.innerHTML = global.RoyalArmiesAgeAssaultRisk.formatRiskMarkup(payload);

            const assaultBtn = els.drawerMovementActions?.querySelector('[data-age-city-action="assault"]');
            if (assaultBtn && payload?.casualtyRisk?.injuryPercent?.label) {
                const injury = payload.casualtyRisk.injuryPercent.label;
                const death = payload.casualtyRisk.deathPercent?.label || '';
                assaultBtn.title = `Casualty pressure (not win odds): injuries ${injury}, deaths ${death}. Launch group assault.`;
            }
        } catch (err) {
            els.drawerAssaultRisk.innerHTML = (
                `<p class="age-assault-risk-copy">${String(err?.message || 'Could not estimate casualties.')}</p>`
            );
        }
    }

    function refreshDrawerScoutIntel(city, hints) {
        if (!els.drawerScoutIntel || !city) return;

        if (isMaskedCity(city) || !hints?.canScout) {
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

    function resolveScoutApiUrl(path) {
        if (typeof global.resolveApiUrl === 'function') {
            return global.resolveApiUrl(path);
        }
        return path;
    }

    function resolveScoutUsername() {
        if (typeof global.resolveActiveCommanderUsername === 'function') {
            return global.resolveActiveCommanderUsername() || '';
        }
        try {
            return String(global.localStorage.getItem('activeCommanderUser') || '').trim();
        } catch (_err) {
            return '';
        }
    }

    function buildScoutResultMarkup(city, payload, errorMessage) {
        const nationName = resolveNationName(city.nationId);
        if (errorMessage) {
            return (
                `<p class="age-world-city-drawer-scout-intel-title">Border Scout — ${city.name}</p>`
                + `<p class="age-world-city-drawer-scout-intel-copy">${errorMessage}</p>`
            );
        }

        const added = Number(payload?.addedCount) || 0;
        const partial = Boolean(payload?.partial);
        let copy = `Scout returned from ${nationName} at ${city.name}. `;
        if (!added) {
            copy += 'No new intel was filed (spy log may be full — delete a report at Headquarters).';
        } else {
            copy += `${added} army report${added === 1 ? '' : 's'} posted to Headquarters Spy Logs.`;
            if (partial) {
                copy += ' Log was full — only some reports were saved.';
            }
        }
        return (
            `<p class="age-world-city-drawer-scout-intel-title">Border Scout Report — ${city.name}</p>`
            + `<p class="age-world-city-drawer-scout-intel-copy">${copy}</p>`
        );
    }

    async function handleDrawerScoutAction() {
        const city = cityById.get(selectedCityId);
        const movement = global.RoyalArmiesAgeMovement;
        if (!city || !movement) return;

        const hints = movement.getBorderActionHints?.(city, resolveActivePlayerCatalogCityId()) || {};
        if (!hints.canScout) return;

        const username = resolveScoutUsername();
        const pendingHtml = buildScoutIntelMarkup(city);
        scoutedCityReports.set(city.id, pendingHtml);
        if (els.drawerScoutIntel) {
            els.drawerScoutIntel.hidden = false;
            els.drawerScoutIntel.innerHTML = pendingHtml;
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

        if (!username) {
            const errorHtml = buildScoutResultMarkup(city, null, 'Sign in as a commander to file spy reports.');
            scoutedCityReports.set(city.id, errorHtml);
            if (els.drawerScoutIntel) els.drawerScoutIntel.innerHTML = errorHtml;
            return;
        }

        try {
            const response = await global.fetch(resolveScoutApiUrl('/api/portal/age/scout-city'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, cityId: city.id })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                const message = payload?.message || payload?.code || `Scout failed (${response.status})`;
                const errorHtml = buildScoutResultMarkup(city, null, message);
                scoutedCityReports.set(city.id, errorHtml);
                if (els.drawerScoutIntel) els.drawerScoutIntel.innerHTML = errorHtml;
                return;
            }

            const resultHtml = buildScoutResultMarkup(city, payload);
            scoutedCityReports.set(city.id, resultHtml);
            if (els.drawerScoutIntel) els.drawerScoutIntel.innerHTML = resultHtml;

            if (payload?.workspace) {
                global.RoyalArmiesAgeHeadquarters?.applyWorkspace?.(payload.workspace, { silent: true });
            }
        } catch (err) {
            const errorHtml = buildScoutResultMarkup(city, null, err?.message || 'Scout request failed.');
            scoutedCityReports.set(city.id, errorHtml);
            if (els.drawerScoutIntel) els.drawerScoutIntel.innerHTML = errorHtml;
        }
    }

    let drawerMovementBusy = false;

    function setDrawerMovementStatus(message) {
        const statusEl = global.document.getElementById('age-world-city-drawer-movement-status');
        if (!statusEl) return;
        const text = String(message || '').trim();
        statusEl.textContent = text;
        statusEl.hidden = !text;
    }

    function reportMovementFailure(err, fallbackTitle) {
        const payload = global.RoyalArmiesAgeMovement?.formatActionError?.(err) || err || {};
        const message = String(payload?.message || err?.message || 'Movement action failed.').trim();
        setDrawerMovementStatus(message);
        if (typeof global.showRiftError === 'function') {
            return global.showRiftError(
                payload?.code ? { code: payload.code, message } : { message },
                fallbackTitle || 'Movement'
            );
        }
        if (typeof global.showPortalAlert === 'function') {
            return global.showPortalAlert(message, fallbackTitle || 'Movement');
        }
        return Promise.resolve();
    }

    async function handleDrawerMovementAction(action) {
        const city = cityById.get(selectedCityId);
        const movement = global.RoyalArmiesAgeMovement;
        if (!city || !movement || drawerMovementBusy) return;

        drawerMovementBusy = true;
        setDrawerMovementStatus(
            action === 'travel'
                ? `Traveling to ${city.name}…`
                : action === 'assault'
                    ? `Launching assault on ${city.name}…`
                    : `Transferring ownership of ${city.name}…`
        );
        try {
            if (action === 'travel') {
                const payload = await movement.travel(city.id);
                if (payload === null) {
                    setDrawerMovementStatus('');
                    return;
                }
            } else if (action === 'assault') {
                await movement.assault(city.id);
            } else if (action === 'transfer') {
                await movement.transferOwnership(city.id);
            } else {
                return;
            }

            const resolvedTargetCityId = movement.resolveMovementTargetCityId?.(city.id) || city.id;
            const traveledCityId = movement.getCatalogCityId();
            syncPlayerMapCityFromMovement();
            global.RoyalArmiesAgeMovementPanel?.syncCatalogCity?.(traveledCityId);
            global.RoyalArmiesAgeMovementPanel?.renderMovementRoutes?.();
            global.RoyalArmiesPlayerLocPins?.refreshLocalPlayerPin?.();
            refreshPlayerLocPinAndLabelCollisions();
            refreshNationCityHighlightsWithDiplomacy();
            global.refreshAgeHudMovePoints?.();
            global.RoyalArmiesNationTreasury?.requestRefresh?.();

            if (action === 'travel') {
                if (traveledCityId !== resolvedTargetCityId) {
                    const err = new Error(
                        `Travel completed but your position is still ${cityById.get(traveledCityId)?.name || 'unchanged'}. `
                        + 'Hard refresh the Age page, then try Travel again.'
                    );
                    err.code = 'RIFT-AGE-001';
                    throw err;
                }

                const destinationName = cityById.get(traveledCityId)?.name || city.name;
                focusOnCity(traveledCityId, { highlightMs: 2400, movementRedirect: true });
                setDrawerMovementStatus(`Moved to ${destinationName}.`);
                openCityDrawer(traveledCityId);
            } else {
                setDrawerMovementStatus('');
                openCityDrawer(city.id);
            }
        } catch (err) {
            await reportMovementFailure(err, 'Movement');
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
        syncPlayerMapCityFromMovement();

        const masked = isMaskedCity(city);
        const holder = masked ? 'Unknown' : resolveNationName(resolveLiveCityHolder(city));
        const lastCapture = masked ? 'Unknown' : resolveLastCaptureDisplay(city);
        const lastCaptureEmpty = lastCapture === '—';
        const tierKey = masked ? 'city' : String(city.settlementTier || 'city').toLowerCase();
        const tierLabel = masked ? 'Unknown' : settlementTierLabel(tierKey);
        const nationName = masked ? 'Unknown' : resolveNationName(city.nationId);
        const terrainLabel = masked ? 'Unknown' : city.terrain;

        els.drawer.dataset.settlementTier = tierKey;
        els.drawer.classList.toggle('is-capital', !masked && Boolean(city.isCapital));
        els.drawerTitle.textContent = city.name;

        if (els.drawerTierBadge) {
            els.drawerTierBadge.textContent = tierLabel;
            els.drawerTierBadge.hidden = false;
        }
        if (els.drawerCapitalBadge) {
            els.drawerCapitalBadge.hidden = masked || !city.isCapital;
        }

        els.drawerMeta.innerHTML = `
            <dl class="age-world-city-drawer-stat-grid">
                ${renderCityDrawerStat('Nation', nationName)}
                ${renderCityDrawerStat('Terrain', terrainLabel, 'terrain')}
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
            const canOpenReport = !masked && cityHasCaptureHistory(city);
            els.battleReportOpen.hidden = masked;
            els.battleReportOpen.disabled = !canOpenReport;
            els.battleReportOpen.setAttribute(
                'aria-disabled',
                canOpenReport ? 'false' : 'true'
            );
        }
        resetInfiltrateButton();
        refreshDrawerInfiltrateButton(city);

        refreshDrawerMovementActions(city);
        const borderHints = global.RoyalArmiesAgeMovement?.getBorderActionHints?.(
            city,
            resolveActivePlayerCatalogCityId()
        ) || {};
        refreshDrawerWatchtowerButton(city, borderHints);
        refreshDrawerScoutIntel(city, borderHints);
        void refreshDrawerAssaultRisk(city, borderHints);
        void refreshDrawerMovementContext(cityId);
        if (els.drawerSideTabs) els.drawerSideTabs.hidden = masked;
        setCityDrawerTab('info');

        const canScout = !masked && playerBordersCity(city);
        els.drawerStructures.innerHTML = '';
        els.drawerFog.hidden = canScout || masked;

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

        positionCityDrawer();
        global.requestAnimationFrame(() => {
            positionCityDrawer();
        });

        showCitySelectionHighlight(cityId);
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
            || target.closest('.age-world-map-label--city')
            || target.closest('.age-world-map-city-search')
            || target.closest('.age-world-map-terrain-controls')
            || target.closest('.age-world-map-plan-tool-dock')
            || target.closest('#age-world-map-plan-add')
            || target.closest('#age-world-map-plan-post')
            || target.closest('#age-world-map-plan-draft-overlay')
            || target.closest('#age-world-map-plan-toggle')
            || target.closest('.age-war-room-modal')
            || target.closest('.age-age-center-modal')
            || target.closest('.age-nation-hub')
        );
    }

    function setTerrainOverlayEnabled(enabled) {
        const next = Boolean(enabled);
        if (next === terrainDetailOn) return;
        terrainDetailOn = next;
        applyMapDisplayState();
    }

    function toggleTerrainDetail() {
        terrainDetailOn = !terrainDetailOn;
        applyMapDisplayState();
    }

    function setColorMapMode(mode) {
        if (mode === COLOR_MAP_MODES.off) {
            mapStyleMode = MAP_STYLE_MODES.topology;
        } else {
            mapStyleMode = MAP_STYLE_MODES.color;
            terrainDetailOn = mode === COLOR_MAP_MODES.terrain;
        }
        applyMapDisplayState();
    }

    function setColorMapEnabled(enabled) {
        if (!enabled) {
            setColorMapMode(COLOR_MAP_MODES.off);
            return;
        }
        if (mapStyleMode === MAP_STYLE_MODES.color && terrainDetailOn) {
            return;
        }
        setColorMapMode(COLOR_MAP_MODES.nations);
    }

    function toggleMapStyle() {
        mapStyleMode = mapStyleMode === MAP_STYLE_MODES.color
            ? MAP_STYLE_MODES.topology
            : MAP_STYLE_MODES.color;
        applyMapDisplayState();
    }

    function bindMapDisplayControls() {
        if (els.styleToggle && els.styleToggle.dataset.bound !== '1') {
            els.styleToggle.dataset.bound = '1';
            els.styleToggle.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                toggleMapStyle();
            });
            els.styleToggle.addEventListener('pointerdown', (event) => {
                event.stopPropagation();
            });
        }
        if (els.terrainToggle && els.terrainToggle.dataset.bound !== '1') {
            els.terrainToggle.dataset.bound = '1';
            els.terrainToggle.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                toggleTerrainDetail();
            });
            els.terrainToggle.addEventListener('pointerdown', (event) => {
                event.stopPropagation();
            });
        }
        mapStyleMode = MAP_STYLE_MODES.topology;
        terrainDetailOn = false;
        applyMapDisplayState();
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
        if (!dragging || !panMoved) return;
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

    function updatePanGesture(event) {
        if (!dragging || !dragStart || !event) return;

        const dist = Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y);
        if (dist < MAP_PAN_CLICK_THRESHOLD_PX) return;

        if (!panMoved) {
            panMoved = true;
            els.frame.classList.add('is-dragging');
            setMapPanLockChrome(true);
            if (!isPlanCityPickActive() && !global.RoyalArmiesAgeWorldMapPlanDraft?.isSessionActive?.()) {
                requestMapPointerLock();
            }
        }

        if (global.document.pointerLockElement === els.frame) {
            applyPanDelta(event.movementX, event.movementY);
        } else {
            applyPanDelta(event.clientX - dragStart.x, event.clientY - dragStart.y);
        }
    }

    function startMapPan(event) {
        dragging = true;
        panMoved = false;
        dragStart = { x: event.clientX, y: event.clientY, tx: targetTx, ty: targetTy };
        els.frame.setPointerCapture(event.pointerId);
    }

    function endMapPan(event) {
        if (!dragging) return false;
        const didMove = panMoved;
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
        return didMove;
    }

    function bindCityLabelClicks() {
        if (!els.labelsCity || els.labelsCity.dataset.cityLabelClickBound === '1') return;
        els.labelsCity.dataset.cityLabelClickBound = '1';

        const openFromLabel = (event) => {
            const label = event.target.closest('.age-world-map-label--city[data-city-id]');
            if (!label || !els.labelsCity.contains(label)) return;

            event.preventDefault();
            event.stopPropagation();
            mapCityPointerUpHandled = true;

            const cityId = String(label.dataset.cityId || '').trim();
            if (!cityId || !cityById.has(cityId)) return;

            if (isPlanCityPickActive()) {
                processPlanCityPick(cityId, event);
                return;
            }

            const wasAlreadySelected = selectedCityId === cityId && isCityDrawerOpen();
            toggleCityDrawerFromClick(cityId, event.clientX, event.clientY);
            if (!wasAlreadySelected) {
                const city = cityById.get(cityId);
                if (city) maybeAutoTravelToBorderCity(city);
            }
        };

        els.labelsCity.addEventListener('click', openFromLabel);
        els.labelsCity.addEventListener('pointerup', (event) => {
            if (event.button !== 0) return;
            openFromLabel(event);
        });
    }

    function bindMapEvents() {
        bindCityLabelClicks();

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
            if (!isPlanCityPickActive()) return;
            const planCityId = resolveCityIdAtPointer(event);
            if (planCityId) {
                planPressCityId = planCityId;
                cancelActiveMapPan(event);
            }
        }, true);

        els.frame.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            if (isMapChromeTarget(event.target)) return;
            if (isPlanCityPickActive()) {
                if (resolveCityIdAtPointer(event) || planPressCityId) {
                    return;
                }
                if (!event.shiftKey) {
                    return;
                }
            }
            mapPressCityId = resolveCityIdAtPointer(event) || '';
            event.preventDefault();
            startMapPan(event);
        });

        bindPlanMapClickFallback();

        let cityHoverRaf = 0;
        els.frame.addEventListener('pointermove', (event) => {
            if (dragging && dragStart) {
                updatePanGesture(event);
                return;
            }

            if (cityHoverRaf) return;
            cityHoverRaf = global.requestAnimationFrame(() => {
                cityHoverRaf = 0;
                if (!els.frame || dragging) return;
                const cityId = resolveCityIdAtClientPoint(event.clientX, event.clientY);
                const showPointer = Boolean(cityId && !isPlanCityPickActive());
                els.frame.classList.toggle('is-over-city', showPointer);
                if (isCityDrawerOpen() || isPlanCityPickActive()) return;
                if (cityId) {
                    showCityHighlight(cityId);
                } else if (hoveredCityId) {
                    clearCityHighlight();
                }
            });
        });

        const endDrag = (event) => {
            const didPan = endMapPan(event);
            els.frame?.classList.remove('is-over-city');
            if (!didPan && !mapCityPointerUpHandled && !isMapChromeTarget(event.target)) {
                tryHandleMapCityPointerUp(event, { didPan: false });
            }
            mapCityPointerUpHandled = false;
            mapPressCityId = '';
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

        if (els.drawer) {
            const stopDrawerEventToMap = (event) => {
                event.stopPropagation();
            };
            els.drawer.addEventListener('pointerdown', stopDrawerEventToMap);
            els.drawer.addEventListener('pointerup', stopDrawerEventToMap);
            els.drawer.addEventListener('click', stopDrawerEventToMap);
        }

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

        global.document.getElementById('age-world-battle-report-open')?.addEventListener('click', openBattleReportModal);
        els.drawerMovementActions?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-age-city-action]');
            if (!button || button.disabled) return;
            event.preventDefault();
            event.stopPropagation();
            const action = button.getAttribute('data-age-city-action');
            void handleDrawerMovementAction(action);
        });
        els.infiltrateOpen?.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            handleInfiltrateAttempt();
        });
        els.drawerWatchtowerOpen?.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (els.drawerWatchtowerOpen?.disabled) return;
            const city = cityById.get(selectedCityId);
            if (!city) return;
            global.RoyalArmiesAgeWatchtower?.open?.(city.id, city.name);
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
            syncPlayerMapCityFromMovement();
            global.RoyalArmiesAgeMovementPanel?.syncCatalogCity?.(playerMapCityId);
            global.RoyalArmiesPlayerLocPins?.refreshLocalPlayerPin?.();
            refreshPlayerLocPinAndLabelCollisions();
            refreshNationCityHighlightsWithDiplomacy();
            if (selectedCityId && els.drawer && !els.drawer.hidden) {
                const city = cityById.get(selectedCityId);
                if (city) {
                    refreshDrawerMovementActions(city);
                    const borderHints = global.RoyalArmiesAgeMovement?.getBorderActionHints?.(
                        city,
                        resolveActivePlayerCatalogCityId()
                    ) || {};
                    refreshDrawerWatchtowerButton(city, borderHints);
                    refreshDrawerInfiltrateButton(city);
                    refreshDrawerScoutIntel(city, borderHints);
                    void refreshDrawerAssaultRisk(city, borderHints);
                    showCitySelectionHighlight(selectedCityId);
                }
            }
        });

        global.addEventListener('resize', () => {
            recomputeBaseScale();
            if (selectedCityId && els.drawer && !els.drawer.hidden) {
                positionCityDrawer();
            }
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
        els.colorBackdrop = global.document.getElementById('age-world-map-color-backdrop');
        els.colorLayer = global.document.getElementById('age-world-map-color-layer');
        els.colorLayerNations = global.document.getElementById('age-world-map-color-layer-nations');
        els.colorLayerTerrain = global.document.getElementById('age-world-map-color-layer-terrain');
        els.styleToggle = global.document.getElementById('age-world-map-style-toggle');
        els.colorLegend = global.document.getElementById('age-world-map-color-legend');
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
        els.labelsRegion = global.document.getElementById('age-world-map-labels-region');
        els.labelsNation = global.document.getElementById('age-world-map-labels-nation');
        els.labelsCity = global.document.getElementById('age-world-map-labels-city');
        els.continentLabel = global.document.getElementById('age-world-map-continent-label');
        ensureLabelsRegionHost();
        els.drawer = global.document.getElementById('age-world-city-drawer');
        els.drawerClose = global.document.getElementById('age-world-city-drawer-close');
        els.drawerTitle = global.document.getElementById('age-world-city-drawer-title');
        els.drawerMeta = global.document.getElementById('age-world-city-drawer-meta');
        els.drawerStructures = global.document.getElementById('age-world-city-drawer-structures');
        els.drawerFog = global.document.getElementById('age-world-city-drawer-fog');
        els.drawerTierBadge = global.document.getElementById('age-world-city-drawer-tier-badge');
        els.drawerCapitalBadge = global.document.getElementById('age-world-city-drawer-capital-badge');
        els.drawerMovementActions = global.document.getElementById('age-world-city-drawer-movement-actions');
        els.drawerWatchtowerOpen = global.document.getElementById('age-world-city-watchtower-open');
        els.drawerScoutIntel = global.document.getElementById('age-world-city-drawer-scout-intel');
        els.drawerAssaultRisk = global.document.getElementById('age-world-city-drawer-assault-risk');
        els.drawerSideTabs = global.document.getElementById('age-world-city-drawer-side-tabs');
        els.drawerPanelInfo = global.document.getElementById('age-world-city-drawer-panel-info');
        els.drawerPanelDefenses = global.document.getElementById('age-world-city-drawer-panel-defenses');
        bindCityDrawerTabs();
        els.battleReportOpen = global.document.getElementById('age-world-battle-report-open');
        els.infiltrateOpen = global.document.getElementById('age-world-city-infiltrate-open');
        els.battleModal = global.document.getElementById('age-world-battle-report-modal');
        els.battleModalBody = global.document.getElementById('age-world-battle-report-body');
        if (isMapAmbientEffectsEnabled()) {
            ensureCloudLayer();
            syncCloudLayer();
            ensureWeatherLayers();
            ensureDaylightLayer();
            syncRainMapAnchor();
            syncRainLayer();
            startWeatherWatch();
        }
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
        bindMapDisplayControls();
        enablePlayerLocPins();
        applyTransform();
        bindMapEvents();
        global.requestAnimationFrame(() => {
            recomputeBaseScale();
        });
        closeCityDrawer();
        closeBattleReportModal();
        syncPlayerMapCityFromMovement();
        refreshPlayerLocPinAndLabelCollisions();
        refreshNationCityHighlightsWithDiplomacy();
        global.enableAgeWorldMapCitySearch?.();
        global.RoyalArmiesAgeWorldMapCitySearch?.refreshCatalog?.();
    }

    function onViewModeChange(viewId) {
        if (viewId !== 'map') {
            mapStyleMode = MAP_STYLE_MODES.topology;
            terrainDetailOn = false;
            applyMapDisplayState();
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
        setColorMapEnabled,
        setColorMapMode,
        refreshPlayerCity: () => {
            syncPlayerMapCityFromMovement();
            refreshPlayerLocPinAndLabelCollisions();
            syncPlayerCityPinHitTarget();
        },
        refreshNationCityHighlights,
        refreshNationCityHighlightsWithDiplomacy,
        getCatalog: () => catalog,
        getCityById: (cityId) => cityById.get(cityId) || null,
        getPlayerMapCityId: () => playerMapCityId,
        mapPointToFramePixels,
        focusOnMapCoordinates,
        focusOnPlannerLocation,
        focusOnCity,
        flashCitySearchHighlight,
        resolveCityByQuery,
        resolveCityIdAtClientPoint,
        setPlanCityPickMode,
        syncPlanEditorHighlights,
        clearPlanEditorHighlights
    };
    global.RoyalArmiesAgeWorldMapAmbient = {
        isEnabled: isMapAmbientEffectsEnabled,
        setEnabled(enabled) {
            if (enabled) {
                enableMapAmbientEffectsRuntime();
            } else {
                disableMapAmbientEffectsRuntime();
            }
        }
    };
    global.enableAgeWorldMap = enableAgeWorldMap;
})(window);

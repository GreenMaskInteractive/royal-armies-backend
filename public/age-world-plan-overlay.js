/**
 * RIFT — Published nation SF plan overlay on the Amnek world map.
 */
(function initAgeWorldPlanOverlay(global) {
    'use strict';

    const SVG_NS = 'http://www.w3.org/2000/svg';

    let overlayEl = null;
    let toggleEl = null;
    let pillsLayer = null;
    let arrowsLayer = null;
    let planVisible = false;
    let publishedPlan = null;
    let cityById = new Map();
    let bound = false;

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

    function mapPointToPixels(mapX, mapY) {
        if (typeof global.RoyalArmiesAgeWorldMap?.mapPointToFramePixels === 'function') {
            return global.RoyalArmiesAgeWorldMap.mapPointToFramePixels(mapX, mapY);
        }
        return { x: 0, y: 0 };
    }

    function buildRouteGeometry(fromCity, toCity) {
        const from = mapPointToPixels(fromCity.centroid.x, fromCity.centroid.y);
        const to = mapPointToPixels(toCity.centroid.x, toCity.centroid.y);
        if (fromCity.id === toCity.id) {
            return {
                d: `M ${from.x - 12} ${from.y} L ${from.x + 12} ${from.y}`,
                startX: from.x - 12,
                startY: from.y,
                endX: from.x + 12,
                endY: from.y,
                labelX: from.x,
                labelY: from.y - 8
            };
        }

        const curved = global.RoyalArmiesAgeWorldMapPlanArrows?.buildCurvedRoutePath?.(from, to);
        if (curved) return curved;

        return {
            d: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
            startX: from.x,
            startY: from.y,
            endX: to.x,
            endY: to.y,
            labelX: (from.x + to.x) / 2,
            labelY: (from.y + to.y) / 2
        };
    }

    function appendRallyEndpointPulse(cityId) {
        if (!pillsLayer || !cityId) return;

        const city = cityById.get(cityId);
        if (!city?.centroid) return;

        const point = mapPointToPixels(city.centroid.x, city.centroid.y);
        const node = global.document.createElement('span');
        node.className = 'age-world-map-plan-rally-pulse';
        node.setAttribute('aria-hidden', 'true');
        node.title = 'Hold or Taxi will be placed here';
        node.innerHTML = '<span class="age-world-map-plan-rally-pulse__wave age-world-map-plan-rally-pulse__wave--a"></span>'
            + '<span class="age-world-map-plan-rally-pulse__wave age-world-map-plan-rally-pulse__wave--b"></span>'
            + '<span class="age-world-map-plan-rally-pulse__wave age-world-map-plan-rally-pulse__wave--c"></span>'
            + '<span class="age-world-map-plan-rally-pulse__core"></span>'
            + '<span class="age-world-map-plan-rally-pulse__label">Hold · Taxi</span>';
        node.style.left = `${Math.round(point.x)}px`;
        node.style.top = `${Math.round(point.y)}px`;
        pillsLayer.appendChild(node);
    }

    function appendPublishedRoute(layer, geometry, routeType) {
        global.RoyalArmiesAgeWorldMapPlanRouteStyle?.appendPublishedRoute?.(layer, geometry, routeType);
    }

    function pillLabel(type) {
        if (type === 'hold') return 'Hold';
        if (type === 'taxi') return 'Taxi';
        if (type === 'main') return 'Main';
        if (type === 'temp-main') return 'Temp Main';
        return String(type || '').toUpperCase();
    }

    function arrowLabel(arrow) {
        if (arrow?.type === 'sf') return 'SF';
        if (arrow?.label) return arrow.label;
        if (arrow?.type === 'mf') return 'MF';
        if (arrow?.type === 'move') return 'Move';
        if (arrow?.type === 'taxi') return 'Taxi';
        if (arrow?.type === 'temp-main') return 'Temp Main';
        return String(arrow?.type || '').toUpperCase();
    }

    const DEV_MAP_PLAN_SUPPRESSED_PREFIX = 'ra-dev-hq-map-plan-suppressed:';

    function devMapPlanSuppressedKey(username) {
        return `${DEV_MAP_PLAN_SUPPRESSED_PREFIX}${String(username || '').trim().toLowerCase()}`;
    }

    function isDevMapPlanSuppressed(username) {
        try {
            return global.sessionStorage.getItem(devMapPlanSuppressedKey(username)) === '1';
        } catch (_) {
            return false;
        }
    }

    function setDevMapPlanSuppressed(username, suppressed) {
        try {
            const key = devMapPlanSuppressedKey(username);
            if (suppressed) {
                global.sessionStorage.setItem(key, '1');
            } else {
                global.sessionStorage.removeItem(key);
            }
        } catch (_) {
            /* ignore quota errors */
        }
    }

    function indexCatalog() {
        cityById = new Map();
        const catalog = global.RoyalArmiesAgeWorldMap?.getCatalog?.();
        (catalog?.cities || []).forEach((city) => {
            if (city?.id) cityById.set(city.id, city);
        });
    }

    function renderOverlay() {
        if (!pillsLayer || !arrowsLayer) return;

        pillsLayer.innerHTML = '';
        arrowsLayer.innerHTML = '';

        if (!publishedPlan || !planVisible) {
            if (overlayEl) {
                overlayEl.hidden = true;
                overlayEl.setAttribute('aria-hidden', 'true');
            }
            return;
        }

        if (overlayEl) {
            overlayEl.hidden = false;
            overlayEl.setAttribute('aria-hidden', 'false');
        }

        (publishedPlan.pills || []).forEach((pill) => {
            if (pill.type !== 'hold') return;
            const city = cityById.get(pill.cityId);
            if (!city?.centroid) return;
            const point = mapPointToPixels(city.centroid.x, city.centroid.y);
            const node = global.document.createElement('span');
            node.className = `age-world-map-plan-pill age-world-map-plan-pill--${pill.type}`;
            node.textContent = pillLabel(pill.type);
            node.style.left = `${Math.round(point.x)}px`;
            node.style.top = `${Math.round(point.y - 14)}px`;
            pillsLayer.appendChild(node);
        });

        const tempMainArrow = (publishedPlan.arrows || []).find((arrow) => arrow.type === 'temp-main');
        const legacyTempMainCityId = publishedPlan.tempMainCityId;
        if (!tempMainArrow && legacyTempMainCityId) {
            const city = cityById.get(legacyTempMainCityId);
            if (city?.centroid) {
                const point = mapPointToPixels(city.centroid.x, city.centroid.y);
                const node = global.document.createElement('span');
                node.className = 'age-world-map-plan-pill age-world-map-plan-pill--temp-main';
                node.textContent = 'Temp Main';
                node.style.left = `${Math.round(point.x)}px`;
                node.style.top = `${Math.round(point.y - 28)}px`;
                pillsLayer.appendChild(node);
            }
        }

        const rallyEndpointIds = new Set();
        (publishedPlan.arrows || []).forEach((arrow) => {
            const fromCity = cityById.get(arrow.fromCityId);
            const toCity = cityById.get(arrow.toCityId);
            if (!fromCity?.centroid || !toCity?.centroid) return;

            const geometry = buildRouteGeometry(fromCity, toCity);
            appendPublishedRoute(arrowsLayer, geometry, arrow.type);

            if (arrow.type === 'taxi' && arrow.toCityId) {
                rallyEndpointIds.add(arrow.toCityId);
            }
        });

        rallyEndpointIds.forEach((cityId) => appendRallyEndpointPulse(cityId));
    }

    function setPlanVisible(next) {
        planVisible = Boolean(next);
        if (toggleEl) {
            toggleEl.classList.toggle('is-active', planVisible);
            toggleEl.setAttribute('aria-pressed', planVisible ? 'true' : 'false');
        }
        renderOverlay();
    }

    function updateToggleVisibility() {
        if (!toggleEl) return;
        const show = Boolean(publishedPlan);
        toggleEl.hidden = !show;
        if (!show) {
            setPlanVisible(false);
        }
    }

    async function refreshNationPlan() {
        const username = resolveUsername();
        if (!username) {
            publishedPlan = null;
            updateToggleVisibility();
            renderOverlay();
            return null;
        }

        if (isDevMapPlanSuppressed(username)) {
            publishedPlan = null;
            indexCatalog();
            updateToggleVisibility();
            setPlanVisible(false);
            return null;
        }

        try {
            const response = await global.fetch(
                resolveApiUrl(`/api/portal/age/nation-plan?username=${encodeURIComponent(username)}`),
                { credentials: 'same-origin', cache: 'no-store' }
            );
            const payload = await response.json();
            if (!response.ok || payload?.status !== 'ok') {
                throw new Error(payload?.code || `nation-plan ${response.status}`);
            }

            publishedPlan = payload.hasPlan ? payload.plan : null;
        } catch (error) {
            publishedPlan = null;
            console.warn('[RIFT] Nation plan fetch failed:', error.message);
        }

        indexCatalog();
        updateToggleVisibility();
        if (!publishedPlan) {
            setPlanVisible(false);
        }
        renderOverlay();
        return publishedPlan;
    }

    function bindControls() {
        if (bound) return;
        bound = true;

        overlayEl = global.document.getElementById('age-world-map-plan-overlay');
        toggleEl = global.document.getElementById('age-world-map-plan-toggle');
        pillsLayer = overlayEl?.querySelector('.age-world-map-plan-pills') || null;
        arrowsLayer = overlayEl?.querySelector('.age-world-map-plan-arrows-layer') || null;

        toggleEl?.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!publishedPlan) return;
            setPlanVisible(!planVisible);
        });

        toggleEl?.addEventListener('pointerdown', (event) => {
            event.stopPropagation();
        });

        global.addEventListener('royalarmies:nation-plan-cleared', () => {
            void refreshNationPlan();
        });
    }

    function onViewModeChange(viewId) {
        if (viewId !== 'map') {
            setPlanVisible(false);
            return;
        }

        void refreshNationPlan().then(() => {
            indexCatalog();
            renderOverlay();
        });
    }

    async function enableAgeWorldPlanOverlay() {
        bindControls();
        await refreshNationPlan();
    }

    global.RoyalArmiesAgeWorldPlanOverlay = {
        enable: enableAgeWorldPlanOverlay,
        refreshNationPlan,
        syncLayout: renderOverlay,
        onViewModeChange,
        setDevMapPlanSuppressed,
        isDevMapPlanSuppressed
    };
    global.enableAgeWorldPlanOverlay = enableAgeWorldPlanOverlay;
})(window);

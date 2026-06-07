/**
 * RIFT — In-map nation plan draft (anchor city, route arrows, action assignment).
 */
(function initAgeWorldMapPlanDraft(global) {
    'use strict';

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const ROUTE_UI_TYPES = new Set(['sf', 'mf', 'move', 'main', 'rally']);
    const ROUTE_TO_ARROW = {
        sf: 'sf',
        mf: 'mf',
        move: 'move',
        main: 'temp-main',
        rally: 'taxi'
    };
    const DRAFT_STORAGE_PREFIX = 'ra-age-map-plan-draft:v1:';
    const DRAFT_AUTOSAVE_MS = 400;
    const SERVER_AUTOSAVE_MS = 900;

    let sessionActive = false;
    let uiVisible = false;
    let anchorCityId = '';
    let armedFromCityId = '';
    let arrows = [];
    let arrowIdCounter = 0;
    let orderCounter = 0;

    let overlayEl = null;
    let draftArrowsLayer = null;
    let draftPillsLayer = null;
    let cityById = new Map();
    let playerMapCityId = '';
    let bound = false;
    let localSaveTimer = 0;
    let serverSaveTimer = 0;
    let lastRallyAssignedArrowId = '';
    let publicPlanPosted = false;
    let cancelingPublicPlan = false;

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

    function draftStorageKey() {
        const username = resolveUsername().toLowerCase();
        const nation = resolvePlayerNation();
        if (!username || !nation) return '';
        return `${DRAFT_STORAGE_PREFIX}${username}:${nation}`;
    }

    function serializeDraftState() {
        return {
            anchorCityId,
            armedFromCityId,
            arrows: arrows.map((arrow) => ({ ...arrow })),
            arrowIdCounter,
            orderCounter,
            updatedAt: Date.now()
        };
    }

    function hasDraftContent(state) {
        if (!state || typeof state !== 'object') return false;
        return Boolean(state.anchorCityId) || (Array.isArray(state.arrows) && state.arrows.length > 0);
    }

    function applyDraftState(state) {
        if (!hasDraftContent(state)) {
            anchorCityId = '';
            armedFromCityId = '';
            arrows = [];
            return;
        }

        anchorCityId = String(state.anchorCityId || '').trim();
        armedFromCityId = String(state.armedFromCityId || '').trim();
        arrows = (Array.isArray(state.arrows) ? state.arrows : [])
            .filter((arrow) => arrow?.fromCityId && arrow?.toCityId)
            .map((arrow) => ({
                id: String(arrow.id || `draft-arrow-${arrowIdCounter += 1}`),
                fromCityId: arrow.fromCityId,
                toCityId: arrow.toCityId,
                type: String(arrow.type || '').trim(),
                order: Number(arrow.order) || 0
            }));

        let maxArrowId = 0;
        let maxOrder = 0;
        arrows.forEach((arrow) => {
            const match = /^draft-arrow-(\d+)$/.exec(arrow.id);
            if (match) maxArrowId = Math.max(maxArrowId, Number(match[1]));
            maxOrder = Math.max(maxOrder, arrow.order);
        });
        arrowIdCounter = Math.max(arrowIdCounter, maxArrowId);
        orderCounter = Math.max(orderCounter, maxOrder);
    }

    function loadPersistedDraft() {
        const key = draftStorageKey();
        if (!key) return false;

        try {
            const raw = global.localStorage.getItem(key);
            if (!raw) return false;
            const parsed = JSON.parse(raw);
            indexCatalog();
            applyDraftState(parsed);
            return hasDraftContent(parsed);
        } catch (_) {
            return false;
        }
    }

    function clearPersistedDraft() {
        const key = draftStorageKey();
        if (!key) return;
        try {
            global.localStorage.removeItem(key);
        } catch (_) {
            /* ignore */
        }
    }

    function persistDraftLocal() {
        const key = draftStorageKey();
        if (!key || !sessionActive) return;

        try {
            if (!hasDraftContent(serializeDraftState())) {
                global.localStorage.removeItem(key);
                return;
            }
            global.localStorage.setItem(key, JSON.stringify(serializeDraftState()));
        } catch (_) {
            /* ignore quota */
        }
    }

    async function persistDraftServer() {
        if (!sessionActive || !hasDraftContent(serializeDraftState())) return;

        const username = resolveUsername();
        if (!username) return;

        const snapshot = getPlanningSnapshot();

        try {
            await global.fetch(resolveApiUrl('/api/portal/age/headquarters'), {
                method: 'PATCH',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, planning: snapshot })
            });
        } catch (error) {
            console.warn('[RIFT] Plan draft server autosave failed:', error.message);
        }
    }

    function schedulePersistDraft() {
        if (!sessionActive) return;

        if (localSaveTimer) global.clearTimeout(localSaveTimer);
        localSaveTimer = global.setTimeout(() => {
            localSaveTimer = 0;
            persistDraftLocal();
        }, DRAFT_AUTOSAVE_MS);

        if (serverSaveTimer) global.clearTimeout(serverSaveTimer);
        serverSaveTimer = global.setTimeout(() => {
            serverSaveTimer = 0;
            void persistDraftServer();
        }, SERVER_AUTOSAVE_MS);
    }

    function flushPersistDraft() {
        if (localSaveTimer) {
            global.clearTimeout(localSaveTimer);
            localSaveTimer = 0;
        }
        if (serverSaveTimer) {
            global.clearTimeout(serverSaveTimer);
            serverSaveTimer = 0;
        }
        persistDraftLocal();
        return persistDraftServer();
    }

    function syncPlanEditorVisuals() {
        global.RoyalArmiesAgeWorldMap?.syncPlanEditorHighlights?.(anchorCityId, armedFromCityId);
        renderDraft();
    }

    function notifyDraftChanged() {
        schedulePersistDraft();
        syncPostButton();
        syncPlanEditorVisuals();
        global.dispatchEvent(new CustomEvent('royalarmies:age-map-plan-draft-changed', {
            detail: {
                anchorCityId,
                armedFromCityId,
                arrowCount: arrows.length
            }
        }));
    }

    function indexCatalog() {
        cityById = new Map();
        const catalog = global.RoyalArmiesAgeWorldMap?.getCatalog?.();
        const cities = Array.isArray(catalog?.cities) ? catalog.cities : [];
        if (cities.length && global.RoyalArmiesAgeWaterRoutes?.augmentCrossBorderNeighbors) {
            global.RoyalArmiesAgeWaterRoutes.augmentCrossBorderNeighbors(cities);
        }
        cities.forEach((city) => {
            if (city?.id) cityById.set(city.id, city);
        });
        playerMapCityId = global.RoyalArmiesAgeMovement?.getCatalogCityId?.()
            || global.RoyalArmiesAgeWorldMap?.getPlayerMapCityId?.()
            || '';
    }

    function mapPointToPixels(mapX, mapY) {
        if (typeof global.RoyalArmiesAgeWorldMap?.mapPointToFramePixels === 'function') {
            return global.RoyalArmiesAgeWorldMap.mapPointToFramePixels(mapX, mapY);
        }
        return { x: 0, y: 0 };
    }

    function resolvePlayerNation() {
        const movement = global.RoyalArmiesAgeMovement;
        if (movement && typeof movement.getPlayerNationId === 'function') {
            return String(movement.getPlayerNationId() || '').trim().toLowerCase();
        }
        const city = playerMapCityId ? cityById.get(playerMapCityId) : null;
        return String(city?.nationId || '').trim().toLowerCase();
    }

    function resolveLiveCityHolder(city) {
        if (global.RoyalArmiesAgeMovement?.resolveCityHolder) {
            return global.RoyalArmiesAgeMovement.resolveCityHolder(city);
        }
        return String(city?.holderNationId || city?.nationId || '').trim().toLowerCase();
    }

    function resolveCityOwnershipKind(city) {
        if (!city) return 'neutral';
        if (city.id === playerMapCityId) return 'current';

        const playerNation = resolvePlayerNation();
        const holder = resolveLiveCityHolder(city);
        const allied = new Set(global.RoyalArmiesAgeMovement?.getAlliedNationIds?.() || []);
        const atWar = new Set(global.RoyalArmiesAgeMovement?.getWarNationIds?.() || []);

        if (playerNation && holder === playerNation) return 'own';
        if (holder && allied.has(holder)) return 'ally';
        if (holder && atWar.has(holder)) return 'enemy';
        return 'neutral';
    }

    function isOwnedKind(kind) {
        return kind === 'own' || kind === 'current' || kind === 'ally';
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

    function maxOutgoingFromCity(cityId) {
        const city = cityById.get(cityId);
        if (!city) return 0;
        const adjacent = new Set(Array.isArray(city.neighbors) ? city.neighbors : []);
        cityById.forEach((other) => {
            if (other.id !== city.id && citiesAreConnected(city, other)) {
                adjacent.add(other.id);
            }
        });
        return adjacent.size;
    }

    function outgoingCountFrom(cityId) {
        return arrows.filter((arrow) => arrow.fromCityId === cityId).length;
    }

    function notifyBlocked(message) {
        if (!message) return;
        global.dispatchEvent(new CustomEvent('royalarmies:age-map-plan-draft-blocked', {
            detail: { message }
        }));
        console.warn('[RIFT] Plan draft:', message);
    }

    function arrowLabel(type) {
        if (type === 'sf') return 'SF';
        if (type === 'mf') return 'MF';
        if (type === 'move') return 'Move';
        if (type === 'temp-main') return 'Main';
        if (type === 'taxi') return 'Rally';
        return '';
    }

    function uiTypeForArrow(type) {
        if (type === 'taxi') return 'rally';
        if (type === 'temp-main') return 'temp-main';
        return type || 'draft';
    }

    function canAssignRouteToArrow(arrow, routeUiType) {
        if (!arrow || !ROUTE_UI_TYPES.has(routeUiType)) {
            return { ok: false, reason: 'Select SF, MF, Move, Main, or Rally first.' };
        }

        const arrowType = ROUTE_TO_ARROW[routeUiType];
        const fromCity = cityById.get(arrow.fromCityId);
        const toCity = cityById.get(arrow.toCityId);
        if (!fromCity || !toCity) {
            return { ok: false, reason: 'That route is no longer valid.' };
        }

        const fromKind = resolveCityOwnershipKind(fromCity);
        const toKind = resolveCityOwnershipKind(toCity);
        const fromOwned = isOwnedKind(fromKind);
        const toOwned = isOwnedKind(toKind);
        const toHostile = toKind === 'neutral' || toKind === 'enemy';

        if ((arrowType === 'sf' || arrowType === 'mf') && fromOwned && toOwned) {
            return { ok: false, reason: 'SF and MF cannot be assigned on a route between two owned cities.' };
        }

        if ((arrowType === 'sf' || arrowType === 'mf') && fromOwned && !toHostile) {
            return { ok: false, reason: 'SF and MF must target a neutral or enemy city.' };
        }

        if ((arrowType === 'move' || arrowType === 'taxi') && fromOwned && toHostile) {
            return { ok: false, reason: 'Move and Rally cannot target neutral or enemy cities from owned territory.' };
        }

        if (arrowType === 'temp-main' && !toOwned) {
            return { ok: false, reason: 'Main must target an owned or current city.' };
        }

        return { ok: true, arrowType };
    }

    function canAddArrow(fromCityId, toCityId) {
        if (!fromCityId || !toCityId || fromCityId === toCityId) {
            return { ok: false, reason: 'Pick a different bordering city.' };
        }

        const fromCity = cityById.get(fromCityId);
        const toCity = cityById.get(toCityId);
        if (!fromCity || !toCity) {
            return { ok: false, reason: 'Unknown city.' };
        }

        if (!citiesAreConnected(fromCity, toCity)) {
            return { ok: false, reason: 'That city must border your selected route endpoint.' };
        }

        if (outgoingCountFrom(fromCityId) >= maxOutgoingFromCity(fromCityId)) {
            return { ok: false, reason: 'This city already has the maximum number of outgoing routes.' };
        }

        const duplicate = arrows.some((arrow) => arrow.fromCityId === fromCityId && arrow.toCityId === toCityId);
        if (duplicate) {
            return { ok: false, reason: 'That route already exists on the map.' };
        }

        const lastArrow = arrows[arrows.length - 1];
        if (lastArrow && lastArrow.fromCityId === toCityId && lastArrow.toCityId === fromCityId) {
            return { ok: false, reason: 'Cannot draw a route straight back to the city you just left.' };
        }

        return { ok: true };
    }

    function addArrow(fromCityId, toCityId) {
        const check = canAddArrow(fromCityId, toCityId);
        if (!check.ok) {
            notifyBlocked(check.reason);
            return false;
        }

        arrows.push({
            id: `draft-arrow-${arrowIdCounter += 1}`,
            fromCityId,
            toCityId,
            type: '',
            order: orderCounter += 1
        });
        armedFromCityId = '';
        notifyDraftChanged();
        return true;
    }

    function chainEndpointCityId() {
        if (!arrows.length) return anchorCityId;
        return arrows[arrows.length - 1].toCityId;
    }

    function routeEndpointCityIds() {
        const ids = [];
        if (anchorCityId) ids.push(anchorCityId);
        arrows.forEach((arrow) => {
            if (arrow.toCityId) ids.push(arrow.toCityId);
        });
        return ids;
    }

    function resolveFromCityForTarget(targetCityId) {
        if (!anchorCityId || !targetCityId || targetCityId === anchorCityId) {
            return '';
        }

        const tryFrom = (fromId) => {
            if (!fromId || fromId === targetCityId) return '';
            return canAddArrow(fromId, targetCityId).ok ? fromId : '';
        };

        if (armedFromCityId) {
            const armed = tryFrom(armedFromCityId);
            if (armed) return armed;
        }

        const tip = tryFrom(chainEndpointCityId());
        if (tip) return tip;

        const seen = new Set();
        const endpoints = routeEndpointCityIds().slice().reverse();
        for (let i = 0; i < endpoints.length; i += 1) {
            const fromId = endpoints[i];
            if (seen.has(fromId)) continue;
            seen.add(fromId);
            const match = tryFrom(fromId);
            if (match) return match;
        }

        return '';
    }

    function setAnchor(cityId) {
        if (!cityById.has(cityId)) return;
        anchorCityId = cityId;
        armedFromCityId = cityId;
        const city = cityById.get(cityId);
        global.dispatchEvent(new CustomEvent('royalarmies:age-map-plan-anchor-set', {
            detail: {
                cityId,
                cityName: city?.name || cityId
            }
        }));
        notifyDraftChanged();
    }

    function handleCityClick(cityId) {
        if (!sessionActive || !cityId) return false;
        if (!cityById.size) indexCatalog();
        if (!cityById.has(cityId)) {
            const mapCity = global.RoyalArmiesAgeWorldMap?.getCityById?.(cityId);
            if (mapCity?.id) {
                cityById.set(mapCity.id, mapCity);
            }
        }
        if (!cityById.has(cityId)) return false;

        if (!anchorCityId) {
            setAnchor(cityId);
            return true;
        }

        if (cityId === anchorCityId && !arrows.length) {
            armedFromCityId = cityId;
            notifyDraftChanged();
            return true;
        }

        const fromId = resolveFromCityForTarget(cityId);
        if (!fromId) {
            if (routeEndpointCityIds().includes(cityId)) {
                armedFromCityId = cityId;
                notifyDraftChanged();
                return true;
            }
            notifyBlocked('That city must border your plan start or an existing route endpoint.');
            return true;
        }

        if (addArrow(fromId, cityId)) {
            armedFromCityId = cityId;
        }
        return true;
    }

    function assignRouteToArrow(arrowId, routeUiType) {
        const arrow = arrows.find((entry) => entry.id === arrowId);
        if (!arrow) return false;

        const check = canAssignRouteToArrow(arrow, routeUiType);
        if (!check.ok) {
            notifyBlocked(check.reason);
            return false;
        }

        arrow.type = check.arrowType;
        if (check.arrowType === 'taxi') {
            lastRallyAssignedArrowId = arrow.id;
        }
        notifyDraftChanged();
        return true;
    }

    function removeArrowAndDescendants(arrowId) {
        const index = arrows.findIndex((entry) => entry.id === arrowId);
        if (index < 0) return false;

        const removedOrders = new Set(arrows.slice(index).map((entry) => entry.order));
        arrows = arrows.filter((entry) => !removedOrders.has(entry.order));

        armedFromCityId = '';

        notifyDraftChanged();
        return true;
    }

    function clearAll() {
        anchorCityId = '';
        armedFromCityId = '';
        arrows = [];
        arrowIdCounter = 0;
        orderCounter = 0;
        clearPersistedDraft();
        notifyDraftChanged();
    }

    function allArrowsAssigned() {
        return arrows.length > 0 && arrows.every((arrow) => Boolean(arrow.type));
    }

    function getPlanningSnapshot() {
        const pillOrder = 0;
        const pills = anchorCityId
            ? [{
                id: 'draft-anchor-pill',
                cityId: anchorCityId,
                type: 'hold',
                order: pillOrder
            }]
            : [];

        const arrowSteps = arrows.map((arrow, index) => ({
            id: arrow.id,
            fromCityId: arrow.fromCityId,
            toCityId: arrow.toCityId,
            type: arrow.type,
            label: arrowLabel(arrow.type),
            order: pillOrder + index + 1
        }));

        return {
            pills,
            arrows: arrowSteps,
            tempMainCityId: ''
        };
    }

    async function refreshPublicPlanPostedState() {
        const username = resolveUsername();
        if (!username) {
            publicPlanPosted = false;
            syncPostButton();
            return false;
        }

        try {
            const response = await global.fetch(
                resolveApiUrl(`/api/portal/age/nation-plan?username=${encodeURIComponent(username)}`),
                { credentials: 'same-origin', cache: 'no-store' }
            );
            const payload = await response.json();
            publicPlanPosted = Boolean(response.ok && payload?.status === 'ok' && payload?.hasPlan);
        } catch (_error) {
            publicPlanPosted = false;
        }

        syncPostButton();
        return publicPlanPosted;
    }

    async function showCancelPlanConfirm() {
        if (typeof global.showPortalConfirm !== 'function') {
            console.warn('[RIFT] Cancel Plan confirm unavailable — portal-alerts.js must load before plan draft.');
            return false;
        }
        return global.showPortalConfirm(
            'Remove the published nation plan from the public world map?',
            {
                title: 'Cancel Plan',
                confirmLabel: 'Cancel Plan',
                cancelLabel: 'Keep Plan'
            }
        );
    }

    async function cancelPublishedPlan() {
        if (!publicPlanPosted || cancelingPublicPlan) return false;

        const confirmed = await showCancelPlanConfirm();
        if (!confirmed) return false;

        const username = resolveUsername();
        if (!username) {
            notifyBlocked('Sign in as a commander to cancel a nation plan.');
            return false;
        }

        cancelingPublicPlan = true;
        syncPostButton();

        try {
            const response = await global.fetch(resolveApiUrl('/api/portal/age/headquarters'), {
                method: 'PATCH',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, clearPublishedPlan: true })
            });
            const payload = await response.json();
            if (!response.ok || payload?.status !== 'ok') {
                throw new Error(payload?.message || payload?.code || `plan-clear-${response.status}`);
            }

            if (payload?.workspace?.planning?.hasPublishedPlan) {
                notifyBlocked('The nation plan is still on the public map. Try again in a moment.');
                return false;
            }

            publicPlanPosted = false;
            global.RoyalArmiesAgeWorldPlanOverlay?.setDevMapPlanSuppressed?.(username, false);
            await global.RoyalArmiesAgeWorldPlanOverlay?.refreshNationPlan?.();
            global.dispatchEvent(new CustomEvent('royalarmies:nation-plan-cleared'));
            syncPostButton();
            return true;
        } catch (error) {
            notifyBlocked(error.message || 'Unable to cancel the nation plan.');
            return false;
        } finally {
            cancelingPublicPlan = false;
            syncPostButton();
        }
    }

    async function postPlan() {
        if (publicPlanPosted) {
            return cancelPublishedPlan();
        }

        if (!allArrowsAssigned()) {
            notifyBlocked('Assign SF, Move, Main, or Rally to every route before posting.');
            return false;
        }

        const username = resolveUsername();
        if (!username) {
            notifyBlocked('Sign in as a commander to post a nation plan.');
            return false;
        }

        const snapshot = getPlanningSnapshot();

        try {
            const saveRes = await global.fetch(resolveApiUrl('/api/portal/age/headquarters'), {
                method: 'PATCH',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, planning: snapshot })
            });
            const savePayload = await saveRes.json();
            if (!saveRes.ok || savePayload?.status !== 'ok') {
                throw new Error(savePayload?.message || savePayload?.code || `plan-save-${saveRes.status}`);
            }

            const confirmRes = await global.fetch(resolveApiUrl('/api/portal/age/headquarters'), {
                method: 'PATCH',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, confirmPlanning: true })
            });
            const confirmPayload = await confirmRes.json();
            if (!confirmRes.ok || confirmPayload?.status !== 'ok') {
                throw new Error(confirmPayload?.message || confirmPayload?.code || `plan-confirm-${confirmRes.status}`);
            }

            clearAll();
            publicPlanPosted = true;
            global.RoyalArmiesAgeWorldPlanOverlay?.setDevMapPlanSuppressed?.(username, false);
            await global.RoyalArmiesAgeWorldPlanOverlay?.refreshNationPlan?.();
            global.dispatchEvent(new CustomEvent('royalarmies:age-map-plan-posted'));
            syncPostButton();
            return true;
        } catch (error) {
            notifyBlocked(error.message || 'Unable to post the nation plan.');
            return false;
        }
    }

    function appendRallyEndpointPulse(cityId, options) {
        if (!draftPillsLayer || !cityId) return;

        const city = cityById.get(cityId);
        if (!city?.centroid) return;

        const point = mapPointToPixels(city.centroid.x, city.centroid.y);
        const node = global.document.createElement('span');
        node.className = 'age-world-map-plan-rally-pulse';
        if (options?.isNew) {
            node.classList.add('is-new');
        }
        node.setAttribute('aria-hidden', 'true');
        node.title = 'Hold or Taxi will be placed here';
        node.innerHTML = '<span class="age-world-map-plan-rally-pulse__wave age-world-map-plan-rally-pulse__wave--a"></span>'
            + '<span class="age-world-map-plan-rally-pulse__wave age-world-map-plan-rally-pulse__wave--b"></span>'
            + '<span class="age-world-map-plan-rally-pulse__wave age-world-map-plan-rally-pulse__wave--c"></span>'
            + '<span class="age-world-map-plan-rally-pulse__core"></span>'
            + '<span class="age-world-map-plan-rally-pulse__label">Hold · Taxi</span>';
        node.style.left = `${Math.round(point.x)}px`;
        node.style.top = `${Math.round(point.y)}px`;
        draftPillsLayer.appendChild(node);

        if (options?.isNew) {
            global.requestAnimationFrame(() => node.classList.remove('is-new'));
        }
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

    function appendStyledRoute(layer, geometry, uiType, options) {
        return global.RoyalArmiesAgeWorldMapPlanRouteStyle?.appendDraftRoute?.(layer, geometry, uiType, options) || null;
    }

    function renderDraft() {
        if (!draftArrowsLayer || !draftPillsLayer) return;

        draftArrowsLayer.innerHTML = '';
        draftPillsLayer.innerHTML = '';

        const showOverlay = sessionActive && uiVisible;
        if (!showOverlay) {
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

        if (anchorCityId) {
            const anchorCity = cityById.get(anchorCityId);
            if (anchorCity?.centroid) {
                const point = mapPointToPixels(anchorCity.centroid.x, anchorCity.centroid.y);
                const marker = global.document.createElement('span');
                marker.className = 'age-world-map-plan-anchor-marker';
                marker.setAttribute('aria-hidden', 'true');
                marker.innerHTML = '<span class="age-world-map-plan-anchor-marker__ring"></span>'
                    + '<span class="age-world-map-plan-anchor-marker__core"></span>'
                    + '<span class="age-world-map-plan-anchor-marker__label">Anchor</span>';
                marker.style.left = `${Math.round(point.x)}px`;
                marker.style.top = `${Math.round(point.y)}px`;
                draftPillsLayer.appendChild(marker);
            }
        }

        const rallyEndpointIds = new Set();
        const newlyAssignedRallyId = lastRallyAssignedArrowId;
        lastRallyAssignedArrowId = '';

        arrows.forEach((arrow) => {
            const fromCity = cityById.get(arrow.fromCityId);
            const toCity = cityById.get(arrow.toCityId);
            if (!fromCity?.centroid || !toCity?.centroid) return;

            const uiType = uiTypeForArrow(arrow.type);
            const geometry = buildRouteGeometry(fromCity, toCity);
            const path = appendStyledRoute(draftArrowsLayer, geometry, uiType, {
                arrowId: arrow.id,
                isDraft: !arrow.type
            });

            if (arrow.type === 'taxi' && arrow.toCityId) {
                rallyEndpointIds.add(arrow.toCityId);
            }

            if (path && !arrow.type) {
                path.classList.add('is-new');
                global.requestAnimationFrame(() => path.classList.remove('is-new'));
            }
        });

        rallyEndpointIds.forEach((cityId) => {
            appendRallyEndpointPulse(cityId, {
                isNew: arrows.some((arrow) => arrow.type === 'taxi'
                    && arrow.toCityId === cityId
                    && arrow.id === newlyAssignedRallyId)
            });
        });
    }

    function syncPostButton() {
        const postBtn = global.document.getElementById('age-world-map-plan-post');
        if (!postBtn) return;

        if (publicPlanPosted) {
            postBtn.textContent = 'Cancel Plan';
            postBtn.classList.add('is-cancel-plan');
            postBtn.dataset.planPostMode = 'cancel';
            postBtn.disabled = cancelingPublicPlan;
            postBtn.setAttribute('aria-disabled', cancelingPublicPlan ? 'true' : 'false');
            postBtn.setAttribute('aria-label', 'Cancel published nation plan on the world map');
            return;
        }

        postBtn.textContent = 'Post Plan';
        postBtn.classList.remove('is-cancel-plan');
        postBtn.dataset.planPostMode = 'post';
        postBtn.setAttribute('aria-label', 'Post nation plan to the world map');
        const ready = sessionActive && allArrowsAssigned();
        postBtn.disabled = !ready;
        postBtn.setAttribute('aria-disabled', ready ? 'false' : 'true');
    }

    function setSessionActive(next) {
        sessionActive = Boolean(next);
        global.RoyalArmiesAgeWorldMap?.setPlanCityPickMode?.(sessionActive);
        if (!sessionActive) {
            if (overlayEl) {
                overlayEl.classList.remove('is-interactive');
            }
            global.RoyalArmiesAgeWorldMap?.clearPlanEditorHighlights?.();
            renderDraft();
            syncPostButton();
            return;
        }

        indexCatalog();
        loadPersistedDraft();
        if (overlayEl) {
            overlayEl.classList.add('is-interactive');
        }
        syncPlanEditorVisuals();
        syncPostButton();
        schedulePersistDraft();
    }

    function setUiVisible(next) {
        uiVisible = Boolean(next);
        syncPlanEditorVisuals();
    }

    function handleArrowPointerUp(event, arrowId) {
        if (!sessionActive || !arrowId) return false;

        const routeUiType = global.RoyalArmiesAgeWorldMapPlanEditor?.getActiveRouteType?.() || '';
        const clearMode = global.RoyalArmiesAgeWorldMapPlanEditor?.isClearArrowMode?.();

        if (clearMode) {
            removeArrowAndDescendants(arrowId);
            return true;
        }

        if (routeUiType) {
            assignRouteToArrow(arrowId, routeUiType);
            return true;
        }

        return false;
    }

    function bindDraftArrowPick(svgEl) {
        if (!svgEl || svgEl.dataset.arrowPickBound === '1') return;
        svgEl.dataset.arrowPickBound = '1';

        const onArrowPick = (event) => {
            if (event.button !== 0 && event.type === 'pointerup') return;
            const path = event.target.closest?.('[data-draft-arrow-id]');
            if (!path) return;

            if (handleArrowPointerUp(event, path.getAttribute('data-draft-arrow-id'))) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
            }
        };

        svgEl.addEventListener('pointerdown', (event) => {
            if (event.target.closest?.('[data-draft-arrow-id]')) {
                event.stopPropagation();
            }
        }, true);

        svgEl.addEventListener('pointerup', onArrowPick, true);
        svgEl.addEventListener('click', onArrowPick, true);
    }

    function bindDraftLayer() {
        if (!draftArrowsLayer || draftArrowsLayer.dataset.bound === '1') return;
        draftArrowsLayer.dataset.bound = '1';
        bindDraftArrowPick(overlayEl?.querySelector('.age-world-map-plan-arrows') || null);
    }

    function bindControls() {
        if (bound) return;
        bound = true;

        overlayEl = global.document.getElementById('age-world-map-plan-draft-overlay');
        draftArrowsLayer = overlayEl?.querySelector('.age-world-map-plan-draft-arrows-layer') || null;
        draftPillsLayer = overlayEl?.querySelector('.age-world-map-plan-draft-pills') || null;
        bindDraftLayer();

        global.addEventListener('royalarmies:age-map-transform', renderDraft);
        global.addEventListener('royalarmies:age-map-overlay-layout', renderDraft);
        global.addEventListener('royalarmies:age-movement-updated', () => {
            if (sessionActive) {
                indexCatalog();
                renderDraft();
            }
        });

        global.addEventListener('beforeunload', () => {
            if (sessionActive) {
                persistDraftLocal();
            }
        });

        global.document.getElementById('age-world-map-plan-post')?.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            void postPlan();
        });

        global.addEventListener('royalarmies:nation-plan-cleared', () => {
            publicPlanPosted = false;
            syncPostButton();
        });

        void refreshPublicPlanPostedState();
    }

    function enableAgeWorldMapPlanDraft() {
        bindControls();
    }

    global.RoyalArmiesAgeWorldMapPlanDraft = {
        enable: enableAgeWorldMapPlanDraft,
        setSessionActive,
        setUiVisible,
        handleCityClick,
        handleArrowPointerUp,
        clearAll,
        allArrowsAssigned,
        getPlanningSnapshot,
        postPlan,
        cancelPublishedPlan,
        refreshPublicPlanPostedState,
        flushPersistDraft,
        hasPersistedDraft: () => {
            const key = draftStorageKey();
            if (!key) return false;
            try {
                return hasDraftContent(JSON.parse(global.localStorage.getItem(key) || 'null'));
            } catch (_) {
                return false;
            }
        },
        isSessionActive: () => sessionActive
    };
    global.enableAgeWorldMapPlanDraft = enableAgeWorldMapPlanDraft;

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', enableAgeWorldMapPlanDraft, { once: true });
    } else {
        enableAgeWorldMapPlanDraft();
    }
})(window);

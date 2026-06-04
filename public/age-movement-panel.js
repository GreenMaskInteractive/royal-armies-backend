/**
 * RIFT — Age map HUD movement panel (current city + regional terrain).
 */
(function initAgeMovementPanel(global) {
    'use strict';

    const STORAGE_CITY_SUFFIX = 'ageCurrentCityId';
    const STORAGE_NATION_SUFFIX = 'ageDeploymentNationId';

    const AMNEK_REGIONS = {
        'region-1': {
            id: 'region-1',
            name: 'Caldera Highlands',
            terrain: 'High-altitude volcanic craters, black obsidian ridges, active sulfur pools, sheer cliffs, and alpine ash plains with continuous geothermal steam vents.',
            terrainTypes: ['Snow', 'Plains', 'Mountains']
        },
        'region-2': {
            id: 'region-2',
            name: 'North-Gale Woodlands',
            terrain: 'Ancient pine and spruce forests, moss-covered ravines, frozen peat bogs, rocky foothills, and wind-scoured northern gales.',
            terrainTypes: ['Mountains', 'Marshlands', 'Forest']
        },
        'region-3': {
            id: 'region-3',
            name: 'Crescent Ridge',
            terrain: 'Sweeping limestone and sandstone escarpments, chalk-white cliffs, windswept arches, deep canyons, and dry scrub highlands.',
            terrainTypes: ['Desert', 'Mountains']
        },
        'region-4': {
            id: 'region-4',
            name: 'Verdant Basin',
            terrain: 'Glacial meltwater rivers, fertile floodplains, dense wetlands, winding deltas, and thick broadleaf forest belts.',
            terrainTypes: ['Marshlands', 'Forest', 'Plains']
        },
        'region-5': {
            id: 'region-5',
            name: 'Wyrmtooth Gulf',
            terrain: 'Tooth-like sea rocks, sheer coastlines, wind-whipped bays, hidden sea caves, salt marshes, and treacherous coral reefs.',
            terrainTypes: ['Marshlands', 'Mountains']
        },
        'region-6': {
            id: 'region-6',
            name: 'Dreadforge Reach',
            terrain: 'A central snow-capped mountain spine, northern grasslands, coastal forests, eastern marshlands, and deep subterranean foundry vaults.',
            terrainTypes: ['Snow', 'Marshlands', 'Forest', 'Plains', 'Mountains']
        }
    };

    /** Nation capitals used until live map placement is wired. settlementTier: village | city | kingdom */
    const AMNEK_CITIES = [
        { id: 'basalt-crown', name: 'Basalt Crown', nationId: 'trex', regionId: 'region-1', settlementTier: 'village' },
        { id: 'cinder-maw', name: 'Cinder Maw', nationId: 'gorz', regionId: 'region-1', settlementTier: 'village' },
        { id: 'ember-veil', name: 'Ember Veil', nationId: 'lyllis', regionId: 'region-1', settlementTier: 'village' },
        { id: 'frostglass-grove', name: 'Frostglass Grove', nationId: 'aethelgard', regionId: 'region-2', settlementTier: 'village' },
        { id: 'gnarlheart', name: 'Gnarlheart', nationId: 'krall', regionId: 'region-2', settlementTier: 'village' },
        { id: 'whisperpine', name: 'Whisperpine', nationId: 'saelthine', regionId: 'region-2', settlementTier: 'village' },
        { id: 'whitecrest', name: 'Whitecrest', nationId: 'dravic', regionId: 'region-3', settlementTier: 'city' },
        { id: 'phariis', name: 'Phariis', nationId: 'aesthene', regionId: 'region-3', settlementTier: 'kingdom' },
        { id: 'stillwind', name: 'Stillwind', nationId: 'vaerenth', regionId: 'region-3', settlementTier: 'village' },
        { id: 'mirecourt', name: 'Mirecourt', nationId: 'thruun', regionId: 'region-4', settlementTier: 'village' },
        { id: 'greenhollow', name: 'Greenhollow', nationId: 'zevros', regionId: 'region-4', settlementTier: 'village' },
        { id: 'pearl-gate', name: 'Pearl Gate', nationId: 'vaelior', regionId: 'region-5', settlementTier: 'village' },
        { id: 'blackreef', name: 'Blackreef', nationId: 'skaros', regionId: 'region-5', settlementTier: 'village' },
        { id: 'northvale', name: 'Northvale', nationId: 'mynor', regionId: 'region-6', settlementTier: 'city' },
        { id: 'ironspine', name: 'Ironspine', nationId: 'khaerant', regionId: 'region-6', settlementTier: 'kingdom' }
    ];

    const DEFAULT_CITY_ID = 'phariis';
    const DEFAULT_NATION_ID = 'aesthene';

    const SETTLEMENT_TIER_LABELS = {
        village: 'Village',
        town: 'Town',
        city: 'City',
        kingdom: 'Kingdom',
        citadel: 'Citadel'
    };

    const SETTLEMENT_TERRAIN_STYLE_CLASS = {
        mountains: 'mountains',
        marshlands: 'marshlands',
        forest: 'forest',
        plains: 'plains',
        desert: 'desert',
        snow: 'snow'
    };

    let currentCityId = '';
    let mapPlayersOnlineOnly = false;
    let hqPlayersOnlineOnly = false;
    let hqPlayersSortByMovePointsDesc = false;
    let hqPlayersArmyFocusFilter = 'all';
    let cityPlayersCache = [];
    let cityPlayersMeta = {
        catalogCityId: '',
        cityName: '',
        loading: false
    };
    let cityPlayersRefreshPromise = null;

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

    function normalizeNationId(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '');
    }

    function findCityById(cityId) {
        const id = String(cityId || '').trim().toLowerCase();
        return AMNEK_CITIES.find((city) => city.id === id) || null;
    }

    function findCityByNationId(nationId) {
        const needle = normalizeNationId(nationId);
        if (!needle) return null;
        return AMNEK_CITIES.find((city) => city.nationId === needle) || null;
    }

    function findRegionById(regionId) {
        return AMNEK_REGIONS[String(regionId || '').trim()] || null;
    }

    function resolveCommanderNationId() {
        const stored = global.localStorage.getItem(storageKey(STORAGE_NATION_SUFFIX));
        if (stored && stored.trim()) return normalizeNationId(stored);

        const playerNation = global.player?.gameNation || global.player?.nation;
        if (playerNation) return normalizeNationId(playerNation);

        return '';
    }

    function readStoredCityId() {
        const stored = global.localStorage.getItem(storageKey(STORAGE_CITY_SUFFIX));
        return stored && stored.trim() ? stored.trim().toLowerCase() : '';
    }

    function writeStoredCityId(cityId) {
        const key = storageKey(STORAGE_CITY_SUFFIX);
        if (!key) return;
        const id = String(cityId || '').trim().toLowerCase();
        if (!id) {
            global.localStorage.removeItem(key);
            return;
        }
        global.localStorage.setItem(key, id);
    }

    function ensureDeploymentNationDefaults() {
        const nationKey = storageKey(STORAGE_NATION_SUFFIX);
        if (nationKey && !global.localStorage.getItem(nationKey)) {
            global.localStorage.setItem(nationKey, DEFAULT_NATION_ID);
        }
    }

    function writeStoredNationId(nationId) {
        const key = storageKey(STORAGE_NATION_SUFFIX);
        if (!key) return;
        const id = normalizeNationId(nationId);
        if (!id) return;
        global.localStorage.setItem(key, id);
    }

    function formatSettlementTier(tier) {
        const key = String(tier || 'city').trim().toLowerCase();
        return SETTLEMENT_TIER_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1);
    }

    function resolveDisplayedCity() {
        const catalogId = global.RoyalArmiesAgeMovement?.getCatalogCityId?.();
        const catalog = global.RoyalArmiesAgeWorldMap?.getCatalog?.();
        if (catalogId && catalog?.cities) {
            const catalogCity = catalog.cities.find((entry) => entry.id === catalogId);
            if (catalogCity) return catalogCity;
        }
        return getCurrentCity();
    }

    function syncCityInfoPanelHeader(city) {
        const tier = formatSettlementTier(city?.settlementTier);
        const settlementName = String(city?.name || '').trim() || 'Settlement';
        const infoTabLabel = 'Settlement Info';

        const tabBtn = global.document.getElementById('age-city-info-tab-btn-city');
        if (tabBtn) {
            tabBtn.textContent = infoTabLabel;
        }

        const settlementTabBtn = global.document.getElementById('age-city-info-tab-btn-settlement');
        if (settlementTabBtn) {
            settlementTabBtn.textContent = settlementName;
            settlementTabBtn.setAttribute('title', settlementName);
        }

        const kindLabel = global.document.getElementById('age-movement-settlement-kind-label');
        if (kindLabel) {
            kindLabel.textContent = `Current ${tier}`;
        }

        const cityInfoPanel = global.document.querySelector('#age-page-canvas .age-city-info-panel');
        if (cityInfoPanel) {
            cityInfoPanel.setAttribute('aria-label', 'Settlement info, venues, and players');
        }

        const tablist = global.document.querySelector('.age-city-info-tabs');
        if (tablist) {
            tablist.setAttribute('aria-label', 'Settlement panel views');
        }

        const hudRight = global.document.getElementById('age-map-hud-right');
        if (hudRight && !hudRight.classList.contains('is-settlement-view-open')) {
            hudRight.setAttribute('aria-label', `${settlementName} — settlement panel`);
        }

        const viewTabCity = global.document.getElementById('age-map-view-tab-city');
        if (viewTabCity) {
            viewTabCity.textContent = tier;
        }
    }

    function refreshCityInfoPanelHeader() {
        syncCityInfoPanelHeader(resolveDisplayedCity());
    }

    function syncCatalogCity(catalogCityId) {
        const previousCityId = currentCityId;
        const catalog = global.RoyalArmiesAgeWorldMap?.getCatalog?.();
        const match = catalog?.cities?.find((city) => city.id === String(catalogCityId || '').trim());
        if (match) {
            writeStoredNationId(match.nationId);
            const stub = findCityByNationId(match.nationId);
            if (stub) {
                currentCityId = stub.id;
                writeStoredCityId(stub.id);
            }
        }
        renderMovementPanel();
        refreshCityPlayersFromServer();
        global.RoyalArmiesPlayerLocPins?.refreshLocalPlayerPin?.();
        if (previousCityId !== currentCityId && typeof global.refreshAgeViewTabs === 'function') {
            global.refreshAgeViewTabs();
        }
    }

    function resolveDefaultCity() {
        const storedId = readStoredCityId();
        if (storedId) {
            const storedCity = findCityById(storedId);
            if (storedCity) return storedCity;
        }

        const nationCity = findCityByNationId(resolveCommanderNationId());
        if (nationCity) return nationCity;

        return findCityById(DEFAULT_CITY_ID) || AMNEK_CITIES[0];
    }

    function getCurrentCity() {
        return findCityById(currentCityId) || resolveDefaultCity();
    }

    function resolveSettlementTerrainName(city, region) {
        const fromCity = String(city?.terrain || '').trim();
        if (fromCity) return fromCity;

        const types = Array.isArray(region?.terrainTypes) ? region.terrainTypes : [];
        if (types.length) return String(types[0] || '').trim();

        return '';
    }

    function resolveSettlementTerrainStyleClass(terrainName) {
        const key = String(terrainName || '').trim().toLowerCase();
        return SETTLEMENT_TERRAIN_STYLE_CLASS[key] || '';
    }

    function applySettlementTerrainNameStyle(terrainEl, terrainName) {
        if (!terrainEl) return;

        [...terrainEl.classList].forEach((className) => {
            if (className.startsWith('age-movement-terrain-name--')) {
                terrainEl.classList.remove(className);
            }
        });

        const styleClass = resolveSettlementTerrainStyleClass(terrainName);
        if (styleClass) {
            terrainEl.classList.add(`age-movement-terrain-name--${styleClass}`);
        }
    }

    function renderMovementPanel() {
        const cityEl = global.document.getElementById('age-movement-city-name');
        const regionEl = global.document.getElementById('age-movement-region-name');
        const terrainEl = global.document.getElementById('age-movement-terrain-name')
            || global.document.getElementById('age-movement-terrain-copy');
        const capitalHud = global.document.getElementById('age-hud-capital');

        const city = resolveDisplayedCity();
        const region = city ? findRegionById(city.regionId) : null;

        syncCityInfoPanelHeader(city);

        if (cityEl) {
            cityEl.textContent = city?.name || '—';
        }

        if (regionEl) {
            regionEl.textContent = region?.name || '—';
        }

        if (terrainEl) {
            const terrainName = resolveSettlementTerrainName(city, region);
            terrainEl.textContent = terrainName || 'Terrain data unavailable for this location.';
            terrainEl.classList.toggle('is-empty', !terrainName);
            applySettlementTerrainNameStyle(terrainEl, terrainName);
        }

        if (capitalHud && city?.name) {
            capitalHud.textContent = city.name;
        }
    }

    function setCurrentCity(cityId, options = {}) {
        const city = findCityById(cityId);
        if (!city) return false;

        currentCityId = city.id;
        if (options.persist !== false) {
            writeStoredCityId(city.id);
        }

        renderMovementPanel();
        renderPlayersTab();
        global.RoyalArmiesPlayerLocPins?.refreshLocalPlayerPin?.();
        return true;
    }

    function setCurrentCityByNationId(nationId, options = {}) {
        const city = findCityByNationId(nationId);
        if (!city) return false;
        return setCurrentCity(city.id, options);
    }

    function syncCityInfoPanelLayoutMode(tabId) {
        const hud = global.document.querySelector('#age-page-canvas .age-map-hud--right');
        if (!hud) return;
        const target = String(tabId || 'city').trim().toLowerCase();
        hud.classList.toggle('is-city-info-players-open', target === 'players');
        hud.classList.toggle('is-city-info-settlement-open', target === 'settlement');
        if (typeof global.syncAgeMapHudLayout === 'function') {
            global.requestAnimationFrame(global.syncAgeMapHudLayout);
        }
    }

    function activateCityInfoTab(tabId) {
        const tabs = global.document.querySelectorAll('[data-age-city-info-tab]');
        const panels = global.document.querySelectorAll('.age-city-info-tabpanel');
        const target = String(tabId || 'city').trim().toLowerCase();

        tabs.forEach((tab) => {
            const isActive = tab.getAttribute('data-age-city-info-tab') === target;
            tab.classList.toggle('is-active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
            tab.tabIndex = isActive ? 0 : -1;
        });

        panels.forEach((panel) => {
            const isActive = panel.id === `age-city-info-tab-${target}`;
            panel.classList.toggle('is-active', isActive);
            panel.hidden = !isActive;
        });

        syncCityInfoPanelLayoutMode(target);
        if (target === 'players') {
            refreshCityPlayersFromServer();
        } else         if (target === 'settlement') {
            if (typeof global.RoyalArmiesAgeViewTabs?.renderSettlementMenu === 'function') {
                global.RoyalArmiesAgeViewTabs.renderSettlementMenu();
            }
        }
    }

    function resolveApiUrl(path) {
        if (typeof global.resolveRoyalArmiesApiUrl === 'function') {
            return global.resolveRoyalArmiesApiUrl(path);
        }
        const origin = global.location?.origin || '';
        if (String(path || '').startsWith('http')) return path;
        if (String(path || '').startsWith('/')) return `${origin}${path}`;
        return `${origin}/${path}`;
    }

    function resolveViewerCatalogCityId() {
        return String(global.RoyalArmiesAgeMovement?.getCatalogCityId?.() || '').trim();
    }

    function resolveCityDisplayName() {
        if (cityPlayersMeta.cityName) return cityPlayersMeta.cityName;

        const catalogCityId = resolveViewerCatalogCityId();
        if (!catalogCityId) return getCurrentCity()?.name || '';

        const catalog = global.RoyalArmiesAgeWorldMap?.getCatalog?.();
        const catalogCity = catalog?.cities?.find((entry) => entry.id === catalogCityId);
        return catalogCity?.name || getCurrentCity()?.name || '';
    }

    function applyNationForcesHud(totalForces) {
        const el = global.document.getElementById('age-hud-armies');
        if (!el || !Number.isFinite(totalForces)) return;
        el.textContent = String(totalForces);
    }

    function getCityPlayers() {
        return cityPlayersCache.slice();
    }

    async function refreshCityPlayersFromServer() {
        const username = resolveUsername();
        if (!username) {
            cityPlayersCache = [];
            cityPlayersMeta.loading = false;
            renderPlayersTab();
            return;
        }

        if (cityPlayersRefreshPromise) {
            return cityPlayersRefreshPromise;
        }

        const catalogCityId = resolveViewerCatalogCityId();
        cityPlayersMeta.loading = true;
        renderPlayersTab();

        cityPlayersRefreshPromise = (async () => {
            try {
                const query = new URLSearchParams({ username });
                if (catalogCityId) {
                    query.set('catalogCityId', catalogCityId);
                }
                const url = resolveApiUrl(`/api/portal/age/city-players?${query.toString()}`);
                const response = await fetch(url, { credentials: 'same-origin' });
                const data = await response.json();
                if (data?.status === 'ok' && Array.isArray(data.players)) {
                    cityPlayersCache = data.players;
                    cityPlayersMeta.catalogCityId = data.catalogCityId || catalogCityId;
                    cityPlayersMeta.cityName = data.cityName || resolveCityDisplayName();
                    applyNationForcesHud(data.totalForces);
                }
            } catch (error) {
                // Keep the last roster if refresh fails.
            } finally {
                cityPlayersMeta.loading = false;
                cityPlayersRefreshPromise = null;
                renderPlayersTab();
            }
        })();

        return cityPlayersRefreshPromise;
    }

    function escapePlayerHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function buildCityPlayerIdentityHtml(displayName, player) {
        const rankTitles = global.RoyalArmiesCommanderRankTitles;
        const rank = Number(player?.rank);
        if (!rankTitles || !Number.isFinite(rank) || rank < 1) {
            return `<span class="commander-identity-name">${escapePlayerHtml(displayName)}</span>`;
        }
        if (!rankTitles.shouldShowCommanderRankPill(rank, { inAge: true })) {
            return `<span class="commander-identity-name">${escapePlayerHtml(displayName)}</span>`;
        }
        if (typeof rankTitles.buildCommanderIdentityNameHtml !== 'function') {
            return `<span class="commander-identity-name">${escapePlayerHtml(displayName)}</span>`;
        }
        return rankTitles.buildCommanderIdentityNameHtml(displayName, {
            rank,
            path: player.path,
            rankTitleGender: player.rankTitleGender,
            compact: true,
            inAge: true
        });
    }

    function isRoyaltyMembershipTitle(title) {
        const normalized = String(title || '').trim().toLowerCase();
        return normalized === 'royalty' || normalized === 'premium';
    }

    function formatPlayerMovePointsLabel(player) {
        const current = Number(player?.movePoints);
        if (!Number.isFinite(current)) return '—';
        return String(current);
    }

    function computeLocalArmyFocus() {
        const army = global.player?.ageArmy || global.player?.army;
        if (!Array.isArray(army) || !army.length) return '';

        let rankingWeight = 0;
        let pvpWeight = 0;

        army.forEach((stack) => {
            if (!stack || typeof stack !== 'object') return;
            const qty = Math.max(0, Math.floor(Number(stack.qty) || 0));
            if (!qty) return;

            const purpose = String(stack.purpose || stack.role || stack.armyRole || '')
                .trim()
                .toLowerCase();
            if (purpose === 'ranking' || purpose === 'rank' || purpose === 'rankdrop' || purpose === 'rank_drop') {
                rankingWeight += qty;
            } else if (purpose === 'pvp') {
                pvpWeight += qty;
            }
        });

        if (!rankingWeight && !pvpWeight) return '';
        if (rankingWeight === pvpWeight) return '';
        return rankingWeight > pvpWeight ? 'ranking' : 'pvp';
    }

    function formatArmyFocusLabel(armyFocus) {
        const focus = String(armyFocus || '').trim().toLowerCase();
        if (focus === 'ranking') return 'Ranking';
        if (focus === 'pvp') return 'PvP';
        return '';
    }

    function formatArmyFocusBadgeHtml(player) {
        const label = formatArmyFocusLabel(player?.armyFocus);
        if (!label) return '';
        const modifier = label === 'Ranking' ? 'ranking' : 'pvp';
        return (
            `<span class="age-city-info-player-army-focus age-city-info-player-army-focus--${modifier}" `
            + `title="${escapePlayerHtml(label)} army" aria-label="${escapePlayerHtml(label)} army">${escapePlayerHtml(label)}</span>`
        );
    }

    function formatPlayerMovePointsAria(player) {
        const current = Number(player?.movePoints);
        if (!Number.isFinite(current)) return 'Move points unknown';
        return `${current} move points`;
    }

    function buildPlayersFilterSummary(allPlayers, visiblePlayers, filters, variant) {
        if (!allPlayers.length) return '';

        if (variant === 'map') {
            const onlineCount = allPlayers.filter((player) => player.online).length;
            if (filters.onlineOnly) {
                return `Showing ${visiblePlayers.length} online of ${allPlayers.length} commanders`;
            }
            return `${allPlayers.length} commanders · ${onlineCount} online`;
        }

        const parts = [`Showing ${visiblePlayers.length} of ${allPlayers.length}`];
        const activeFilters = [];

        if (filters.onlineOnly) activeFilters.push('online');
        if (filters.armyFocus === 'ranking') activeFilters.push('ranking army');
        else if (filters.armyFocus === 'pvp') activeFilters.push('PvP army');

        if (activeFilters.length) {
            parts.push(`filtered by ${activeFilters.join(', ')}`);
        }

        if (filters.sortByMovePointsDesc) {
            parts.push('sorted by MP high→low');
        } else if (!activeFilters.length) {
            const onlineCount = allPlayers.filter((player) => player.online).length;
            parts.push(`${onlineCount} online`);
        }

        return parts.join(' · ');
    }

    function buildPlayersEmptyMessage(cityName, allPlayers, filters, variant) {
        const place = cityName || 'this city';
        if (!allPlayers.length) {
            return cityName ? `No commanders in ${cityName} yet.` : 'No commanders in this city yet.';
        }

        if (variant === 'map') {
            if (!filters.onlineOnly) {
                return cityName ? `No commanders in ${cityName} yet.` : 'No commanders in this city yet.';
            }
            return `No commanders online in ${place}.`;
        }

        const activeFilters = [];
        if (filters.onlineOnly) activeFilters.push('online');
        if (filters.armyFocus === 'ranking') activeFilters.push('with a ranking army');
        else if (filters.armyFocus === 'pvp') activeFilters.push('with a PvP army');

        if (activeFilters.length) {
            return `No commanders in ${place} match ${activeFilters.join(' and ')}.`;
        }

        return cityName ? `No commanders in ${cityName} yet.` : 'No commanders in this city yet.';
    }

    function resolvePlayerMovePointsValue(player) {
        const movePoints = Number(player?.movePoints);
        return Number.isFinite(movePoints) ? movePoints : null;
    }

    function sortCityPlayers(players, filters) {
        return players.slice().sort((left, right) => {
            if (filters?.sortByMovePointsDesc) {
                const leftMp = resolvePlayerMovePointsValue(left);
                const rightMp = resolvePlayerMovePointsValue(right);

                if (leftMp !== null && rightMp !== null && leftMp !== rightMp) {
                    return rightMp - leftMp;
                }
                if (leftMp !== null && rightMp === null) return -1;
                if (leftMp === null && rightMp !== null) return 1;
            }

            if (left.online !== right.online) {
                return left.online ? -1 : 1;
            }

            return left.displayName.localeCompare(right.displayName, undefined, { sensitivity: 'base' });
        });
    }

    function getPlayersFilterState(variant) {
        if (variant === 'map') {
            return {
                onlineOnly: mapPlayersOnlineOnly,
                sortByMovePointsDesc: false,
                armyFocus: 'all'
            };
        }

        return {
            onlineOnly: hqPlayersOnlineOnly,
            sortByMovePointsDesc: hqPlayersSortByMovePointsDesc,
            armyFocus: hqPlayersArmyFocusFilter
        };
    }

    function filterCityPlayers(players, filters) {
        let result = players.slice();

        if (filters?.onlineOnly) {
            result = result.filter((player) => player.online);
        }

        const armyFocus = String(filters?.armyFocus || 'all').trim().toLowerCase();
        if (armyFocus === 'ranking' || armyFocus === 'pvp') {
            result = result.filter((player) => String(player?.armyFocus || '').toLowerCase() === armyFocus);
        }

        return result;
    }

    function syncMapPlayersFilterControls(root) {
        if (!root) return;

        root.querySelectorAll('[data-age-players-filter]').forEach((button) => {
            const mode = String(button.getAttribute('data-age-players-filter') || 'all').trim().toLowerCase();
            const isActive = mode === 'online' ? mapPlayersOnlineOnly : !mapPlayersOnlineOnly;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    function syncHqPlayersFilterControls(root) {
        if (!root) return;

        root.querySelectorAll('[data-age-players-filter]').forEach((button) => {
            const mode = String(button.getAttribute('data-age-players-filter') || 'all').trim().toLowerCase();
            const isActive = mode === 'online' ? hqPlayersOnlineOnly : !hqPlayersOnlineOnly;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });

        root.querySelectorAll('[data-age-players-mp-sort]').forEach((button) => {
            const mode = String(button.getAttribute('data-age-players-mp-sort') || 'default').trim().toLowerCase();
            const isActive = mode === 'desc' ? hqPlayersSortByMovePointsDesc : !hqPlayersSortByMovePointsDesc;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });

        root.querySelectorAll('[data-age-players-army-filter]').forEach((button) => {
            const mode = String(button.getAttribute('data-age-players-army-filter') || 'all').trim().toLowerCase();
            const isActive = mode === hqPlayersArmyFocusFilter;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    function syncPlayersFilterControls() {
        syncMapPlayersFilterControls(global.document.querySelector('#age-city-info-tab-players .age-city-info-players-body'));
        syncHqPlayersFilterControls(global.document.querySelector('.age-headquarters-players-body'));
    }

    function bindMapPlayersFilterControls(root) {
        if (!root || root.dataset.mapPlayersFilterBound === 'true') return;
        root.dataset.mapPlayersFilterBound = 'true';

        root.addEventListener('click', (event) => {
            const button = event.target.closest('[data-age-players-filter]');
            if (!button || !root.contains(button)) return;

            event.preventDefault();
            const mode = String(button.getAttribute('data-age-players-filter') || 'all').trim().toLowerCase();
            mapPlayersOnlineOnly = mode === 'online';
            syncMapPlayersFilterControls(root);
            renderPlayersTab();
        });
    }

    function bindHqPlayersFilterControls(root) {
        if (!root || root.dataset.hqPlayersFilterBound === 'true') return;
        root.dataset.hqPlayersFilterBound = 'true';

        root.addEventListener('click', (event) => {
            const presenceButton = event.target.closest('[data-age-players-filter]');
            if (presenceButton && root.contains(presenceButton)) {
                event.preventDefault();
                const mode = String(presenceButton.getAttribute('data-age-players-filter') || 'all').trim().toLowerCase();
                hqPlayersOnlineOnly = mode === 'online';
                syncHqPlayersFilterControls(root);
                renderPlayersTab();
                return;
            }

            const movePointsButton = event.target.closest('[data-age-players-mp-sort]');
            if (movePointsButton && root.contains(movePointsButton)) {
                event.preventDefault();
                const mode = String(movePointsButton.getAttribute('data-age-players-mp-sort') || 'default').trim().toLowerCase();
                hqPlayersSortByMovePointsDesc = mode === 'desc';
                syncHqPlayersFilterControls(root);
                renderPlayersTab();
                return;
            }

            const armyButton = event.target.closest('[data-age-players-army-filter]');
            if (armyButton && root.contains(armyButton)) {
                event.preventDefault();
                const mode = String(armyButton.getAttribute('data-age-players-army-filter') || 'all').trim().toLowerCase();
                hqPlayersArmyFocusFilter = (mode === 'ranking' || mode === 'pvp') ? mode : 'all';
                syncHqPlayersFilterControls(root);
                renderPlayersTab();
            }
        });
    }

    function bindPlayersTabControls() {
        bindMapPlayersFilterControls(global.document.querySelector('#age-city-info-tab-players .age-city-info-players-body'));
        bindHqPlayersFilterControls(global.document.querySelector('.age-headquarters-players-body'));
        syncPlayersFilterControls();
    }

    function bindCityInfoTabs() {
        const tablist = global.document.querySelector('.age-city-info-tabs');
        if (!tablist || tablist.dataset.cityInfoTabsBound === 'true') return;

        tablist.dataset.cityInfoTabsBound = 'true';
        tablist.addEventListener('click', (event) => {
            const tab = event.target.closest('[data-age-city-info-tab]');
            if (!tab) return;
            event.preventDefault();
            activateCityInfoTab(tab.getAttribute('data-age-city-info-tab'));
        });

        tablist.addEventListener('keydown', (event) => {
            const tabs = Array.from(tablist.querySelectorAll('[data-age-city-info-tab]'));
            const currentIndex = tabs.findIndex((tab) => tab.classList.contains('is-active'));
            if (currentIndex < 0) return;

            let nextIndex = currentIndex;
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                nextIndex = (currentIndex + 1) % tabs.length;
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
            } else {
                return;
            }

            event.preventDefault();
            const nextTab = tabs[nextIndex];
            activateCityInfoTab(nextTab.getAttribute('data-age-city-info-tab'));
            nextTab.focus();
        });
    }

    function resolvePlayersRenderHosts() {
        const hosts = [
            {
                variant: 'map',
                cityLabel: global.document.getElementById('age-city-info-players-city'),
                summary: global.document.getElementById('age-city-info-players-summary'),
                list: global.document.getElementById('age-city-info-players-list'),
                empty: global.document.getElementById('age-city-info-players-empty')
            },
            {
                variant: 'hq',
                cityLabel: global.document.getElementById('age-hq-players-city'),
                summary: global.document.getElementById('age-hq-players-summary'),
                list: global.document.getElementById('age-hq-players-list'),
                empty: global.document.getElementById('age-hq-players-empty')
            }
        ];
        return hosts.filter((host) => host.list || host.empty || host.summary || host.cityLabel);
    }

    function renderPlayersIntoHost(host, state) {
        const {
            cityName,
            loading,
            allPlayers,
            visiblePlayers,
            filters,
            variant
        } = state;
        const showArmyBadge = variant === 'hq';

        if (host.cityLabel) {
            if (cityName) {
                host.cityLabel.textContent = `Commanders in ${cityName}`;
                host.cityLabel.hidden = false;
            } else {
                host.cityLabel.textContent = '';
                host.cityLabel.hidden = true;
            }
        }

        if (loading && !allPlayers.length) {
            if (host.summary) {
                host.summary.textContent = '';
                host.summary.hidden = true;
            }
            if (host.list) {
                host.list.innerHTML = '';
                host.list.hidden = true;
            }
            if (host.empty) {
                host.empty.textContent = 'Loading commanders…';
                host.empty.hidden = false;
            }
            return;
        }

        if (host.summary) {
            if (!allPlayers.length) {
                host.summary.textContent = '';
                host.summary.hidden = true;
            } else {
                host.summary.textContent = buildPlayersFilterSummary(allPlayers, visiblePlayers, filters, variant);
                host.summary.hidden = false;
            }
        }

        if (host.list) {
            if (!visiblePlayers.length) {
                host.list.innerHTML = '';
                host.list.hidden = true;
            } else {
                host.list.hidden = false;
                host.list.innerHTML = visiblePlayers.map((player) => {
                    const displayName = player.isSelf
                        ? `${player.displayName} (you)`
                        : player.displayName;
                    const movePointsLabel = formatPlayerMovePointsLabel(player);
                    const movePointsAria = formatPlayerMovePointsAria(player);
                    const reportButtonMarkup = !player.isSelf
                        ? (
                            `<button type="button" class="age-city-info-player-report-btn" data-player-report-open`
                            + ` data-age-player-report="${escapePlayerHtml(player.username)}"`
                            + ` data-player-report-target="${escapePlayerHtml(player.username)}"`
                            + ` data-player-report-source="age_city_roster"`
                            + ` data-player-report-context="${escapePlayerHtml(`City roster — ${cityName || 'current city'}`)}"`
                            + ` title="Report commander" aria-label="Report ${escapePlayerHtml(player.displayName)}">Report</button>`
                        )
                        : '';
                    return (
                        `<li class="age-city-info-player-row${player.online ? ' is-online' : ''}${player.isSelf ? ' is-self' : ''}">`
                        + (isRoyaltyMembershipTitle(player.membershipTitle)
                            ? '<img class="age-city-info-player-royalty-badge" src="images/royaltybadge.png" alt="Royalty premium member" loading="lazy" decoding="async">'
                            : '')
                        + `<span class="age-city-info-player-identity">${buildCityPlayerIdentityHtml(displayName, player)}</span>`
                        + (showArmyBadge ? formatArmyFocusBadgeHtml(player) : '')
                        + `<span class="age-city-info-player-move-points" title="Move points" aria-label="${escapePlayerHtml(movePointsAria)}">${escapePlayerHtml(movePointsLabel)}</span>`
                        + `<span class="age-city-info-player-presence">${player.online ? 'Online' : 'Offline'}</span>`
                        + reportButtonMarkup
                        + '</li>'
                    );
                }).join('');
            }
        }

        if (host.empty) {
            if (!allPlayers.length) {
                host.empty.textContent = cityName
                    ? `No commanders in ${cityName} yet.`
                    : 'No commanders in this city yet.';
                host.empty.hidden = false;
            } else if (!visiblePlayers.length) {
                host.empty.textContent = buildPlayersEmptyMessage(cityName, allPlayers, filters, variant);
                host.empty.hidden = false;
            } else {
                host.empty.hidden = true;
            }
        }
    }

    function renderPlayersTab() {
        syncPlayersFilterControls();

        const cityName = resolveCityDisplayName();
        const allPlayers = getCityPlayers();

        resolvePlayersRenderHosts().forEach((host) => {
            const variant = host.variant === 'hq' ? 'hq' : 'map';
            const filters = getPlayersFilterState(variant);
            const visiblePlayers = sortCityPlayers(filterCityPlayers(allPlayers, filters), filters);
            renderPlayersIntoHost(host, {
                cityName,
                loading: cityPlayersMeta.loading,
                allPlayers,
                visiblePlayers,
                filters,
                variant
            });
        });
    }

    function enableMovementPanel() {
        ensureDeploymentNationDefaults();
        currentCityId = resolveDefaultCity()?.id || '';
        if (currentCityId) {
            writeStoredCityId(currentCityId);
        }
        bindCityInfoTabs();
        bindPlayersTabControls();
        syncCityInfoPanelLayoutMode('city');
        renderMovementPanel();
        refreshCityPlayersFromServer();

        if (typeof global.refreshAgeViewTabs === 'function') {
            global.refreshAgeViewTabs();
        }

        global.RoyalArmiesPlayerLocPins?.refreshLocalPlayerPin?.();
    }

    function refreshMovementPanel() {
        if (!currentCityId) {
            currentCityId = resolveDefaultCity()?.id || '';
        }
        renderMovementPanel();
        refreshCityPlayersFromServer();

        if (typeof global.refreshAgeViewTabs === 'function') {
            global.refreshAgeViewTabs();
        }
    }

    global.addEventListener('royalarmies:age-movement-updated', () => {
        refreshCityPlayersFromServer();
    });

    global.RoyalArmiesAgeMovementPanel = {
        enable: enableMovementPanel,
        refresh: refreshMovementPanel,
        setCurrentCity,
        setCurrentCityByNationId,
        getCurrentCity,
        getDisplayedCity: resolveDisplayedCity,
        activateCityInfoTab,
        formatSettlementTier,
        refreshCityInfoPanelHeader,
        getCommanderNationId: resolveCommanderNationId,
        syncCatalogCity,
        refreshCityPlayers: refreshCityPlayersFromServer,
        computeLocalArmyFocus,
        getCities: () => AMNEK_CITIES.map((city) => ({ ...city })),
        getRegions: () => Object.values(AMNEK_REGIONS).map((region) => ({ ...region }))
    };

    global.enableAgeMovementPanel = enableMovementPanel;
    global.refreshAgeMovementPanel = refreshMovementPanel;
})(window);

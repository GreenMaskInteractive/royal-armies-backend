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

    let currentCityId = '';
    let playersOnlineOnly = false;
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
        const infoTabLabel = `${tier} Info`;

        const tabBtn = global.document.getElementById('age-city-info-tab-btn-city');
        if (tabBtn) {
            tabBtn.textContent = infoTabLabel;
        }

        const kindLabel = global.document.getElementById('age-movement-settlement-kind-label');
        if (kindLabel) {
            kindLabel.textContent = `Current ${tier}`;
        }

        const cityInfoPanel = global.document.querySelector('#age-page-canvas .age-city-info-panel');
        if (cityInfoPanel) {
            cityInfoPanel.setAttribute('aria-label', `${tier} and players`);
        }

        const tablist = global.document.querySelector('.age-city-info-tabs');
        if (tablist) {
            tablist.setAttribute('aria-label', `${tier} info views`);
        }

        const hudRight = global.document.getElementById('age-map-hud-right');
        if (hudRight && !hudRight.classList.contains('is-settlement-view-open')) {
            hudRight.setAttribute('aria-label', `${tier} info`);
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
        if (typeof global.refreshAgeViewTabs === 'function') {
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

    function renderTerrainTypesList(region) {
        const list = global.document.getElementById('age-movement-terrain-types');
        if (!list) return;

        const types = Array.isArray(region?.terrainTypes) ? region.terrainTypes : [];
        if (!types.length) {
            list.innerHTML = '';
            list.hidden = true;
            return;
        }

        list.hidden = false;
        list.innerHTML = types.map((terrainName, index) => (
            `<li class="age-movement-terrain-type${index === 0 ? ' age-movement-terrain-type--primary' : ''}">${terrainName}</li>`
        )).join('');
    }

    function renderMovementPanel() {
        const cityEl = global.document.getElementById('age-movement-city-name');
        const regionEl = global.document.getElementById('age-movement-region-name');
        const terrainEl = global.document.getElementById('age-movement-terrain-copy');
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
            const terrainCopy = String(region?.terrain || '').trim();
            terrainEl.textContent = terrainCopy || 'Terrain data unavailable for this location.';
            terrainEl.classList.toggle('is-empty', !terrainCopy);
        }

        renderTerrainTypesList(region);

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
            const panelId = panel.id || '';
            const isCity = panelId === 'age-city-info-tab-city';
            const isPlayers = panelId === 'age-city-info-tab-players';
            const isActive = (target === 'city' && isCity) || (target === 'players' && isPlayers);
            panel.classList.toggle('is-active', isActive);
            panel.hidden = !isActive;
        });

        syncCityInfoPanelLayoutMode(target);
        if (target === 'players') {
            refreshCityPlayersFromServer();
        }
    }

    function resolveApiUrl(path) {
        if (typeof global.resolveApiUrl === 'function') {
            return global.resolveApiUrl(path);
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

    function isRoyaltyMembershipTitle(title) {
        const normalized = String(title || '').trim().toLowerCase();
        return normalized === 'royalty' || normalized === 'premium';
    }

    function formatPlayerMovePointsLabel(player) {
        const current = Number(player?.movePoints);
        if (!Number.isFinite(current)) return '—';
        return String(current);
    }

    function formatPlayerMovePointsAria(player) {
        const current = Number(player?.movePoints);
        if (!Number.isFinite(current)) return 'Move points unknown';
        return `${current} move points`;
    }

    function sortCityPlayers(players) {
        return players.slice().sort((left, right) => {
            if (left.online !== right.online) {
                return left.online ? -1 : 1;
            }
            return left.displayName.localeCompare(right.displayName, undefined, { sensitivity: 'base' });
        });
    }

    function filterCityPlayers(players, onlineOnly) {
        if (!onlineOnly) return players;
        return players.filter((player) => player.online);
    }

    function setPlayersFilterMode(onlineOnly) {
        playersOnlineOnly = Boolean(onlineOnly);
        global.document.querySelectorAll('[data-age-players-filter]').forEach((button) => {
            const mode = String(button.getAttribute('data-age-players-filter') || 'all').trim().toLowerCase();
            const isActive = mode === 'online' ? playersOnlineOnly : !playersOnlineOnly;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    function bindPlayersFilterToggle(toggle) {
        if (!toggle || toggle.dataset.playersFilterBound === 'true') return;
        toggle.dataset.playersFilterBound = 'true';

        toggle.addEventListener('click', (event) => {
            const button = event.target.closest('[data-age-players-filter]');
            if (!button) return;
            event.preventDefault();
            const mode = String(button.getAttribute('data-age-players-filter') || 'all').trim().toLowerCase();
            setPlayersFilterMode(mode === 'online');
            renderPlayersTab();
        });
    }

    function bindPlayersTabControls() {
        global.document.querySelectorAll('.age-city-info-players-filter-toggle, .age-hq-players-filter-toggle').forEach((toggle) => {
            bindPlayersFilterToggle(toggle);
        });
        setPlayersFilterMode(false);
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
                cityLabel: global.document.getElementById('age-city-info-players-city'),
                summary: global.document.getElementById('age-city-info-players-summary'),
                list: global.document.getElementById('age-city-info-players-list'),
                empty: global.document.getElementById('age-city-info-players-empty')
            },
            {
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
            onlineOnly
        } = state;

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

        const onlineCount = allPlayers.filter((player) => player.online).length;

        if (host.summary) {
            if (!allPlayers.length) {
                host.summary.textContent = '';
                host.summary.hidden = true;
            } else if (onlineOnly) {
                host.summary.textContent = `Showing ${visiblePlayers.length} online of ${allPlayers.length} commanders`;
                host.summary.hidden = false;
            } else {
                host.summary.textContent = `${allPlayers.length} commanders · ${onlineCount} online`;
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
                    return (
                        `<li class="age-city-info-player-row${player.online ? ' is-online' : ''}${player.isSelf ? ' is-self' : ''}">`
                        + (isRoyaltyMembershipTitle(player.membershipTitle)
                            ? '<img class="age-city-info-player-royalty-badge" src="images/royaltybadge.png" alt="Royalty premium member" loading="lazy" decoding="async">'
                            : '')
                        + `<span class="age-city-info-player-name">${escapePlayerHtml(displayName)}</span>`
                        + `<span class="age-city-info-player-move-points" title="Move points" aria-label="${escapePlayerHtml(movePointsAria)}">${escapePlayerHtml(movePointsLabel)}</span>`
                        + `<span class="age-city-info-player-presence">${player.online ? 'Online' : 'Offline'}</span>`
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
                host.empty.textContent = onlineOnly
                    ? `No commanders online in ${cityName || 'this city'}.`
                    : (cityName ? `No commanders in ${cityName} yet.` : 'No commanders in this city yet.');
                host.empty.hidden = false;
            } else {
                host.empty.hidden = true;
            }
        }
    }

    function renderPlayersTab() {
        setPlayersFilterMode(playersOnlineOnly);

        const cityName = resolveCityDisplayName();
        const allPlayers = getCityPlayers();
        const visiblePlayers = sortCityPlayers(filterCityPlayers(allPlayers, playersOnlineOnly));
        const state = {
            cityName,
            loading: cityPlayersMeta.loading,
            allPlayers,
            visiblePlayers,
            onlineOnly: playersOnlineOnly
        };

        resolvePlayersRenderHosts().forEach((host) => {
            renderPlayersIntoHost(host, state);
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
        formatSettlementTier,
        refreshCityInfoPanelHeader,
        getCommanderNationId: resolveCommanderNationId,
        syncCatalogCity,
        refreshCityPlayers: refreshCityPlayersFromServer,
        getCities: () => AMNEK_CITIES.map((city) => ({ ...city })),
        getRegions: () => Object.values(AMNEK_REGIONS).map((region) => ({ ...region }))
    };

    global.enableAgeMovementPanel = enableMovementPanel;
    global.refreshAgeMovementPanel = refreshMovementPanel;
})(window);

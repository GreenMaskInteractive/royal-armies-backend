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
    const LOCAL_DEV_CITY_PLAYER_COUNT = 100;

    let currentCityId = '';
    let localDevCityPlayers = null;
    let playersOnlineOnly = false;

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
        renderPlayersTab();
        global.RoyalArmiesPlayerLocPins?.refreshLocalPlayerPin?.();
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

        const catalogId = global.RoyalArmiesAgeMovement?.getCatalogCityId?.();
        const catalog = global.RoyalArmiesAgeWorldMap?.getCatalog?.();
        const catalogCity = catalogId
            ? catalog?.cities?.find((entry) => entry.id === catalogId)
            : null;
        const city = catalogCity || getCurrentCity();
        const region = city ? findRegionById(city.regionId) : null;

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

    function isLocalDevCityPlayersEnabled() {
        return typeof global.isLocalDevelopmentHost === 'function' && global.isLocalDevelopmentHost();
    }

    function buildLocalDevCityPlayers() {
        const prefixes = ['Ash', 'Bryn', 'Cade', 'Dorn', 'Eira', 'Fen', 'Garr', 'Hale', 'Iris', 'Jorn'];
        const players = [];

        for (let index = 1; index <= LOCAL_DEV_CITY_PLAYER_COUNT; index += 1) {
            const prefix = prefixes[index % prefixes.length];
            const number = String(index).padStart(3, '0');
            players.push({
                username: `dev_${prefix.toLowerCase()}_${number}`,
                displayName: `${prefix} Commander ${number}`,
                online: (index * 7) % 10 < 4,
                membershipTitle: index % 5 === 0 ? 'Royalty' : 'Basic'
            });
        }

        return players;
    }

    function getCityPlayers() {
        if (isLocalDevCityPlayersEnabled()) {
            if (!localDevCityPlayers) {
                localDevCityPlayers = buildLocalDevCityPlayers();
            }
            return localDevCityPlayers.slice();
        }
        return [];
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
        const allBtn = global.document.getElementById('age-city-info-players-filter-all');
        const onlineBtn = global.document.getElementById('age-city-info-players-filter-online');

        if (allBtn) {
            const isAll = !playersOnlineOnly;
            allBtn.classList.toggle('is-active', isAll);
            allBtn.setAttribute('aria-pressed', isAll ? 'true' : 'false');
        }

        if (onlineBtn) {
            const isOnline = playersOnlineOnly;
            onlineBtn.classList.toggle('is-active', isOnline);
            onlineBtn.setAttribute('aria-pressed', isOnline ? 'true' : 'false');
        }
    }

    function bindPlayersTabControls() {
        const toggle = global.document.querySelector('.age-city-info-players-filter-toggle');
        if (!toggle || toggle.dataset.playersFilterBound === 'true') return;

        toggle.dataset.playersFilterBound = 'true';
        setPlayersFilterMode(false);

        toggle.addEventListener('click', (event) => {
            const button = event.target.closest('[data-age-players-filter]');
            if (!button) return;
            event.preventDefault();
            const mode = String(button.getAttribute('data-age-players-filter') || 'all').trim().toLowerCase();
            setPlayersFilterMode(mode === 'online');
            renderPlayersTab();
        });
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

    function renderPlayersTab() {
        const cityLabel = global.document.getElementById('age-city-info-players-city');
        const summary = global.document.getElementById('age-city-info-players-summary');
        const list = global.document.getElementById('age-city-info-players-list');
        const empty = global.document.getElementById('age-city-info-players-empty');
        const city = getCurrentCity();

        setPlayersFilterMode(playersOnlineOnly);

        if (cityLabel) {
            const name = city?.name || '';
            if (name) {
                cityLabel.textContent = `Commanders in ${name}`;
                cityLabel.hidden = false;
            } else {
                cityLabel.textContent = '';
                cityLabel.hidden = true;
            }
        }

        const allPlayers = getCityPlayers();
        const onlineCount = allPlayers.filter((player) => player.online).length;
        const visiblePlayers = sortCityPlayers(filterCityPlayers(allPlayers, playersOnlineOnly));

        if (summary) {
            if (!allPlayers.length) {
                summary.textContent = '';
                summary.hidden = true;
            } else if (playersOnlineOnly) {
                summary.textContent = `Showing ${visiblePlayers.length} online of ${allPlayers.length} commanders`;
                summary.hidden = false;
            } else {
                summary.textContent = `${allPlayers.length} commanders · ${onlineCount} online`;
                summary.hidden = false;
            }
        }

        if (list) {
            if (!visiblePlayers.length) {
                list.innerHTML = '';
                list.hidden = true;
            } else {
                list.hidden = false;
                list.innerHTML = visiblePlayers.map((player) => (
                    `<li class="age-city-info-player-row${player.online ? ' is-online' : ''}">`
                    + (isRoyaltyMembershipTitle(player.membershipTitle)
                        ? '<img class="age-city-info-player-royalty-badge" src="images/royaltybadge.png" alt="Royalty premium member" loading="lazy" decoding="async">'
                        : '')
                    + `<span class="age-city-info-player-name">${escapePlayerHtml(player.displayName)}</span>`
                    + `<span class="age-city-info-player-presence">${player.online ? 'Online' : 'Offline'}</span>`
                    + '</li>'
                )).join('');
            }
        }

        if (empty) {
            if (!allPlayers.length) {
                empty.textContent = 'No commanders in this city yet.';
                empty.hidden = false;
            } else if (!visiblePlayers.length) {
                empty.textContent = playersOnlineOnly
                    ? 'No commanders online in this city.'
                    : 'No commanders in this city yet.';
                empty.hidden = false;
            } else {
                empty.hidden = true;
            }
        }
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
        renderPlayersTab();

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
        renderPlayersTab();

        if (typeof global.refreshAgeViewTabs === 'function') {
            global.refreshAgeViewTabs();
        }
    }

    global.RoyalArmiesAgeMovementPanel = {
        enable: enableMovementPanel,
        refresh: refreshMovementPanel,
        setCurrentCity,
        setCurrentCityByNationId,
        getCurrentCity,
        getCommanderNationId: resolveCommanderNationId,
        syncCatalogCity,
        getCities: () => AMNEK_CITIES.map((city) => ({ ...city })),
        getRegions: () => Object.values(AMNEK_REGIONS).map((region) => ({ ...region }))
    };

    global.enableAgeMovementPanel = enableMovementPanel;
    global.refreshAgeMovementPanel = refreshMovementPanel;
})(window);

/**
 * RIFT — Age map view tabs (world map / settlement / headquarters / records).
 */
(function initAgeViewTabs(global) {
    'use strict';

    const VIEW_MAP = 'map';
    const VIEW_CITY = 'city';
    const VIEW_HEADQUARTERS = 'headquarters';
    const VIEW_RECORDS = 'records';
    const VIEW_GUILD_TRAINING = 'guild-training';

    const WORLD_MAP_SRC = 'images/amnekmap.png';
    const SETTLEMENT_MAP_SRC = {
        village: 'images/village.png',
        town: 'images/town.png',
        city: 'images/city.png',
        kingdom: 'images/kingdom.png',
        citadel: 'images/citadel.png'
    };

    const SETTLEMENT_TIER_LABEL = {
        village: 'Village',
        town: 'Town',
        city: 'City',
        kingdom: 'Kingdom',
        citadel: 'Citadel'
    };

    const ADVENTURERS_GUILD_JOBS = {
        village: 'NPC Battle Simulation Training, Street Patrol, Civilian Transport, Trade Convoy',
        town: 'NPC Battle Simulation Training, Street Patrol, Civilian Transport, Trade Convoy, Border Patrol',
        city: 'NPC Battle Simulation Training, Street Patrol, Civilian Transport, Border Patrol',
        citadel: 'NPC Battle Simulation Training, Street Patrol, Civilian Transport, Trade Convoy, Border Patrol, Player Bounties (PvP Quests)',
        kingdom: 'NPC Battle Simulation Training, Street Patrol, Civilian Transport, Trade Convoy, Border Patrol, Player Bounties (PvP Quests)'
    };

    const BORDER_VENUE_COPY = {
        village: 'View ally, neutral, or enemy armies bordering your current city, if any.',
        town: 'View bordering armies; engage in PvP when at war with a bordering nation; spy on individual player armies to gauge strength before attacking.',
        city: 'View ally, neutral, or enemy armies bordering your current city, if any.',
        citadel: 'View ally, neutral, or enemy armies bordering your current city, if any.',
        kingdom: 'View ally, neutral, or enemy armies bordering your current city, if any.'
    };

    const VENUE_MARKS = {
        'village-center': '◆',
        'town-square': '◆',
        'city-hall': '◆',
        'citadel-court': '◆',
        'grand-embassy': '◆',
        'adventurers-guild': '⚑',
        'infirmary': '✚',
        church: '✦',
        barracks: '⚔',
        blacksmith: '⚒',
        armory: '⧉',
        arenas: '⚜',
        border: '⌁'
    };

    function resolveVenueMark(venueId) {
        return VENUE_MARKS[venueId] || '•';
    }

    function escapeSettlementMenuHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    const SETTLEMENT_VENUES = {
        village: [
            {
                id: 'village-center',
                label: 'Village Center',
                description: 'Purchase defense improvements.'
            },
            {
                id: 'adventurers-guild',
                label: "Adventurer's Guild",
                description: `Accept jobs: ${ADVENTURERS_GUILD_JOBS.village}.`
            },
            {
                id: 'blacksmith',
                label: 'Blacksmith',
                description: 'Purchase weapons, armor, and other battle-useful tools.'
            },
            {
                id: 'border',
                label: 'Border',
                description: BORDER_VENUE_COPY.village,
                placement: 'bottom'
            }
        ],
        town: [
            {
                id: 'town-square',
                label: 'Town Square',
                description: 'Purchase defense improvements.'
            },
            {
                id: 'adventurers-guild',
                label: "Adventurer's Guild",
                description: `Accept jobs: ${ADVENTURERS_GUILD_JOBS.town}.`
            },
            {
                id: 'infirmary',
                label: 'Infirmary',
                description: 'Heal units. Towns can restore up to 50% of your entire army each tick.'
            },
            {
                id: 'blacksmith',
                label: 'Blacksmith',
                description: 'Purchase weapons, armor, and other battle-useful tools.'
            },
            {
                id: 'border',
                label: 'Border',
                description: BORDER_VENUE_COPY.town,
                placement: 'bottom'
            }
        ],
        city: [
            {
                id: 'city-hall',
                label: 'City Hall',
                description: 'Purchase defense improvements.'
            },
            {
                id: 'adventurers-guild',
                label: "Adventurer's Guild",
                description: `Accept jobs: ${ADVENTURERS_GUILD_JOBS.city}.`
            },
            {
                id: 'infirmary',
                label: 'Infirmary',
                description: 'Heal units.'
            },
            {
                id: 'church',
                label: 'Church',
                description: 'Obtain a blessed banner and manage its perk tree.'
            },
            {
                id: 'barracks',
                label: 'Barracks',
                description: 'Garrison Registry and Unit Evolution Workspace.'
            },
            {
                id: 'blacksmith',
                label: 'Blacksmith',
                description: 'Purchase weapons, armor, and other battle-useful tools.'
            },
            {
                id: 'armory',
                label: 'Armory',
                description: 'Upgrade weapons, armor, and effects for battle-useful tools.'
            },
            {
                id: 'border',
                label: 'Border',
                description: BORDER_VENUE_COPY.city,
                placement: 'bottom'
            }
        ],
        citadel: [
            {
                id: 'citadel-court',
                label: 'Citadel Court',
                description: 'Purchase defense improvements.'
            },
            {
                id: 'arenas',
                label: 'Arenas',
                description: 'Continent-wide commander tournaments and spectator betting — citadel cities only.'
            },
            {
                id: 'adventurers-guild',
                label: "Adventurer's Guild",
                description: `Accept jobs: ${ADVENTURERS_GUILD_JOBS.citadel}.`
            },
            {
                id: 'infirmary',
                label: 'Infirmary',
                description: 'Heal units.'
            },
            {
                id: 'church',
                label: 'Church',
                description: 'Obtain a blessed banner and manage its perk tree.'
            },
            {
                id: 'barracks',
                label: 'Barracks',
                description: 'Garrison Registry and Unit Evolution Workspace.'
            },
            {
                id: 'blacksmith',
                label: 'Blacksmith',
                description: 'Purchase weapons, armor, and other battle-useful tools.'
            },
            {
                id: 'armory',
                label: 'Armory',
                description: 'Upgrade weapons, armor, and effects for battle-useful tools.'
            },
            {
                id: 'border',
                label: 'Border',
                description: BORDER_VENUE_COPY.citadel,
                placement: 'bottom'
            }
        ],
        kingdom: [
            {
                id: 'grand-embassy',
                label: 'Grand Embassy',
                description: 'Purchase defense improvements.'
            },
            {
                id: 'adventurers-guild',
                label: "Adventurer's Guild",
                description: `Accept jobs: ${ADVENTURERS_GUILD_JOBS.kingdom}.`
            },
            {
                id: 'infirmary',
                label: 'Infirmary',
                description: 'Heal units.'
            },
            {
                id: 'church',
                label: 'Church',
                description: 'Obtain a blessed banner and manage its perk tree.'
            },
            {
                id: 'barracks',
                label: 'Barracks',
                description: 'Garrison Registry and Unit Evolution Workspace.'
            },
            {
                id: 'blacksmith',
                label: 'Blacksmith',
                description: 'Purchase weapons, armor, and other battle-useful tools.'
            },
            {
                id: 'armory',
                label: 'Armory',
                description: 'Upgrade weapons, armor, and effects for battle-useful tools.'
            },
            {
                id: 'border',
                label: 'Border',
                description: BORDER_VENUE_COPY.kingdom,
                placement: 'bottom'
            }
        ]
    };

    let activeView = VIEW_MAP;
    let bound = false;

    function resolveCanvas() {
        return global.document.getElementById('age-page-canvas');
    }

    function resolveCurrentCity() {
        if (typeof global.RoyalArmiesAgeMovementPanel?.getCurrentCity === 'function') {
            return global.RoyalArmiesAgeMovementPanel.getCurrentCity();
        }
        return null;
    }

    function resolveDisplayedCity() {
        if (typeof global.RoyalArmiesAgeMovementPanel?.getDisplayedCity === 'function') {
            return global.RoyalArmiesAgeMovementPanel.getDisplayedCity();
        }
        return resolveCurrentCity();
    }

    function resolveSettlementTierDisplayLabel() {
        const city = resolveDisplayedCity();
        const tier = String(city?.settlementTier || 'village').trim().toLowerCase();
        if (typeof global.RoyalArmiesAgeMovementPanel?.formatSettlementTier === 'function') {
            return global.RoyalArmiesAgeMovementPanel.formatSettlementTier(tier);
        }
        return SETTLEMENT_TIER_LABEL[tier] || 'Village';
    }

    function resolveSettlementTier() {
        const city = resolveDisplayedCity();
        const tier = String(city?.settlementTier || 'village').trim().toLowerCase();
        if (SETTLEMENT_MAP_SRC[tier]) return tier;
        return 'village';
    }

    function resolveSettlementMapSrc(tier) {
        return SETTLEMENT_MAP_SRC[tier] || SETTLEMENT_MAP_SRC.village;
    }

    function resolveVenuesForTier(tier) {
        return SETTLEMENT_VENUES[tier] || SETTLEMENT_VENUES.village;
    }

    function getViewTabs() {
        return Array.from(global.document.querySelectorAll('[data-age-view-tab]'));
    }

    function isWorkspaceOverlayView(view) {
        return view === VIEW_HEADQUARTERS || view === VIEW_RECORDS || view === VIEW_GUILD_TRAINING;
    }

    function normalizeView(view) {
        if (view === VIEW_CITY || view === VIEW_HEADQUARTERS || view === VIEW_RECORDS || view === VIEW_GUILD_TRAINING) {
            return view;
        }
        return VIEW_MAP;
    }

    function syncViewTabButtons() {
        getViewTabs().forEach((tab) => {
            const view = tab.getAttribute('data-age-view-tab');
            const isActive = view === activeView
                || (activeView === VIEW_GUILD_TRAINING && view === VIEW_CITY);
            tab.classList.toggle('is-active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
            tab.tabIndex = isActive ? 0 : -1;
        });
    }

    function syncRightHudPanels() {
        const canvas = resolveCanvas();
        const cityInfoPanel = global.document.querySelector('#age-page-canvas .age-city-info-panel');
        const settlementPanel = global.document.getElementById('age-settlement-menu-panel');
        const rightHud = global.document.querySelector('#age-page-canvas .age-map-hud--right');

        const inSettlementView = activeView === VIEW_CITY;
        const inHeadquartersView = activeView === VIEW_HEADQUARTERS;
        const inRecordsView = activeView === VIEW_RECORDS;
        const inGuildTrainingView = activeView === VIEW_GUILD_TRAINING;
        const inWorkspaceOverlay = isWorkspaceOverlayView(activeView);

        if (canvas) {
            canvas.dataset.ageView = activeView;
            global.dispatchEvent(new CustomEvent('royalarmies:age-view-changed', {
                detail: { view: activeView }
            }));
        }

        if (rightHud) {
            rightHud.classList.toggle('is-settlement-view-open', inSettlementView);
            rightHud.classList.toggle('is-headquarters-view-open', inHeadquartersView || inRecordsView);
            if (inSettlementView) {
                rightHud.classList.remove('is-city-info-players-open');
                rightHud.setAttribute('aria-label', `${resolveSettlementTierDisplayLabel()} venues`);
            } else if (!inWorkspaceOverlay) {
                global.RoyalArmiesAgeMovementPanel?.refreshCityInfoPanelHeader?.();
            }
        }

        if (cityInfoPanel) {
            cityInfoPanel.hidden = inSettlementView || inWorkspaceOverlay;
        }

        if (settlementPanel) {
            settlementPanel.hidden = !inSettlementView;
        }

        const hqWorkspace = global.document.getElementById('age-headquarters-workspace');
        if (hqWorkspace) {
            hqWorkspace.hidden = !inHeadquartersView;
            hqWorkspace.setAttribute('aria-hidden', inHeadquartersView ? 'false' : 'true');
        }

        const recordsWorkspace = global.document.getElementById('age-records-workspace');
        if (recordsWorkspace) {
            recordsWorkspace.hidden = !inRecordsView;
            recordsWorkspace.setAttribute('aria-hidden', inRecordsView ? 'false' : 'true');
        }

        const guildWorkspace = global.document.getElementById('age-guild-workspace');
        const guildTrainingArena = global.document.getElementById('age-guild-training-arena');
        const guildOverlayOpen = typeof global.RoyalArmiesAdventurersGuild?.isOverlayOpen === 'function'
            && global.RoyalArmiesAdventurersGuild.isOverlayOpen();
        const showGuildWorkspace = inGuildTrainingView || guildOverlayOpen;
        if (guildWorkspace) {
            guildWorkspace.hidden = !showGuildWorkspace;
            guildWorkspace.setAttribute('aria-hidden', showGuildWorkspace ? 'false' : 'true');
        }
        if (guildTrainingArena) {
            guildTrainingArena.hidden = !inGuildTrainingView;
            guildTrainingArena.setAttribute('aria-hidden', inGuildTrainingView ? 'false' : 'true');
        }
    }

    function syncMapStage() {
        const mapImage = global.document.getElementById('age-world-map-bg-image');
        const mapSvg = global.document.getElementById('age-world-map-svg');
        const settlementBg = global.document.getElementById('age-world-map-settlement-bg');
        const mapCanvas = global.document.getElementById('age-world-map-canvas');
        const highlightCanvas = global.document.getElementById('age-world-map-highlight-canvas');
        const mapStage = global.document.getElementById('age-world-map');
        const mapFrame = global.document.querySelector('#age-page-canvas .age-map-frame');
        const city = resolveDisplayedCity();
        const tier = resolveSettlementTier();
        const inSettlementView = activeView === VIEW_CITY;
        const inHeadquartersView = activeView === VIEW_HEADQUARTERS;
        const inRecordsView = activeView === VIEW_RECORDS;
        const inGuildTrainingView = activeView === VIEW_GUILD_TRAINING;
        const hideWorldMapLayers = isWorkspaceOverlayView(activeView);

        if (mapFrame) {
            mapFrame.classList.toggle('is-settlement-map-frame', inSettlementView);
        }

        if (mapSvg) {
            mapSvg.hidden = inSettlementView || hideWorldMapLayers;
        }

        if (mapCanvas) {
            mapCanvas.hidden = inSettlementView || hideWorldMapLayers;
        }

        if (highlightCanvas) {
            highlightCanvas.hidden = inSettlementView || hideWorldMapLayers;
        }

        if (settlementBg) {
            if (inSettlementView) {
                settlementBg.src = resolveSettlementMapSrc(tier);
                settlementBg.alt = city?.name
                    ? `${city.name} — ${SETTLEMENT_TIER_LABEL[tier] || 'Settlement'}`
                    : 'Settlement map';
                settlementBg.hidden = false;
            } else {
                settlementBg.hidden = true;
            }
        }

        if (global.RoyalArmiesAgeWorldMap && typeof global.RoyalArmiesAgeWorldMap.onViewModeChange === 'function') {
            global.RoyalArmiesAgeWorldMap.onViewModeChange(activeView);
        }

        if (global.RoyalArmiesAgeWorldPlanOverlay?.onViewModeChange) {
            global.RoyalArmiesAgeWorldPlanOverlay.onViewModeChange(activeView);
        }

        if (activeView === 'map' && typeof global.RoyalArmiesAgeWorldPlanOverlay?.refreshNationPlan === 'function') {
            void global.RoyalArmiesAgeWorldPlanOverlay.refreshNationPlan();
        }

        if (inHeadquartersView) {
            global.RoyalArmiesAgeHeadquarters?.onViewOpen?.();
        } else {
            global.RoyalArmiesAgeHeadquarters?.onViewClose?.();
        }

        if (inRecordsView) {
            global.RoyalArmiesAgeRecords?.onViewOpen?.();
        } else {
            global.RoyalArmiesAgeRecords?.onViewClose?.();
        }

        if (inGuildTrainingView) {
            global.RoyalArmiesAdventurersGuild?.onTrainingViewOpen?.();
        } else {
            global.RoyalArmiesAdventurersGuild?.onTrainingViewClose?.();
        }

        if (mapImage && !inSettlementView && !hideWorldMapLayers) {
            const worldHref = mapImage.dataset.worldHref || WORLD_MAP_SRC;
            mapImage.setAttribute('href', worldHref);
            mapImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', worldHref);
        }

        if (mapStage) {
            mapStage.setAttribute(
                'aria-label',
                activeView === VIEW_CITY
                    ? `${city?.name || 'Settlement'} local map`
                    : activeView === VIEW_HEADQUARTERS
                        ? 'Nation headquarters'
                        : activeView === VIEW_RECORDS
                            ? 'Age records'
                            : activeView === VIEW_GUILD_TRAINING
                                ? 'Guild training battle'
                                : 'Amnek world map'
            );
        }
    }

    function buildSettlementMenuHtml(tier) {
        const venues = resolveVenuesForTier(tier);

        return venues.map((venue) => {
            const placementClass = venue.placement === 'bottom'
                ? ' age-settlement-menu-item--bottom'
                : '';
            const borderClass = venue.id === 'border'
                ? ' age-settlement-menu-item--border'
                : '';
            const description = venue.description
                ? `<span class="age-settlement-menu-item-desc">${escapeSettlementMenuHtml(venue.description)}</span>`
                : '';
            const mark = escapeSettlementMenuHtml(resolveVenueMark(venue.id));
            const label = escapeSettlementMenuHtml(venue.label);
            const isExpandable = venue.id === 'adventurers-guild' || venue.id === 'barracks';
            const subPanelId = venue.id === 'adventurers-guild'
                ? 'age-settlement-guild-jobs'
                : (venue.id === 'barracks' ? 'age-settlement-garrison-options' : '');
            const wrapClass = venue.id === 'adventurers-guild'
                ? 'age-settlement-menu-guild-wrap'
                : (venue.id === 'barracks' ? 'age-settlement-menu-garrison-wrap' : '');
            const itemHtml = (
                `<button type="button" class="age-settlement-menu-item${placementClass}${borderClass}${isExpandable ? ' age-settlement-menu-item--expandable' : ''}"`
                + ` data-settlement-venue="${escapeSettlementMenuHtml(venue.id)}"`
                + `${isExpandable ? ` aria-expanded="false" aria-controls="${subPanelId}"` : ''}>`
                + `<span class="age-settlement-menu-item-mark" aria-hidden="true">${mark}</span>`
                + `<span class="age-settlement-menu-item-body">`
                + `<span class="age-settlement-menu-item-label">${label}</span>`
                + description
                + '</span>'
                + `<span class="age-settlement-menu-item-chevron" aria-hidden="true">${isExpandable ? '▾' : '›'}</span>`
                + '</button>'
            );

            if (venue.id === 'adventurers-guild') {
                return (
                    `<div class="${wrapClass}">`
                    + itemHtml
                    + '<div id="age-settlement-guild-jobs" class="age-settlement-guild-jobs" hidden></div>'
                    + '</div>'
                );
            }

            if (venue.id === 'barracks') {
                return (
                    `<div class="${wrapClass}">`
                    + itemHtml
                    + '<div id="age-settlement-garrison-options" class="age-settlement-garrison-options" hidden></div>'
                    + '</div>'
                );
            }

            return itemHtml;
        }).join('');
    }

    function renderSettlementMenu() {
        const titleEl = global.document.getElementById('age-settlement-menu-title');
        const tierEl = global.document.getElementById('age-settlement-menu-tier-label');
        const listEl = global.document.getElementById('age-settlement-menu-list');

        const city = resolveDisplayedCity();
        const tier = resolveSettlementTier();

        if (titleEl) {
            titleEl.textContent = city?.name || 'Settlement';
        }

        if (tierEl) {
            tierEl.textContent = resolveSettlementTierDisplayLabel();
        }

        if (!listEl) return;

        const nextHtml = buildSettlementMenuHtml(tier);
        if (listEl.innerHTML !== nextHtml) {
            listEl.innerHTML = nextHtml;
        }

        if (typeof global.RoyalArmiesAdventurersGuild?.syncSettlementMenuGuild === 'function') {
            global.RoyalArmiesAdventurersGuild.syncSettlementMenuGuild();
        }

        if (typeof global.RoyalArmiesAgeBarracks?.syncSettlementMenuGarrison === 'function') {
            global.RoyalArmiesAgeBarracks.syncSettlementMenuGarrison();
        }
    }

    function handleVenueClick(venueId) {
        const tier = resolveSettlementTier();

        if (venueId === 'adventurers-guild') {
            if (typeof global.RoyalArmiesAdventurersGuild?.toggleSettlementJobs === 'function') {
                void global.RoyalArmiesAdventurersGuild.toggleSettlementJobs({
                    settlementTier: tier,
                    city: resolveCurrentCity()
                });
            }
            return;
        }

        if (venueId === 'barracks') {
            if (typeof global.RoyalArmiesAgeBarracks?.toggleSettlementGarrisonMenu === 'function') {
                global.RoyalArmiesAgeBarracks.toggleSettlementGarrisonMenu();
            }
            return;
        }

        global.dispatchEvent(new CustomEvent('royal-armies-settlement-venue-open', {
            detail: {
                venueId,
                settlementTier: tier,
                city: resolveCurrentCity()
            }
        }));

        if (venueId === 'border') {
            global.console.info('[RIFT] Border selected — battle training (coming soon).');
        }
    }

    function setActiveView(view, options = {}) {
        const nextView = normalizeView(view);
        if (!options.force && nextView === activeView) {
            syncViewTabButtons();
            return;
        }

        if (activeView === VIEW_GUILD_TRAINING && nextView !== VIEW_GUILD_TRAINING) {
            global.RoyalArmiesAdventurersGuild?.closeTrainingView?.({ skipViewRestore: true });
        }

        activeView = nextView;
        syncViewTabButtons();
        syncRightHudPanels();
        syncMapStage();

        if (activeView === VIEW_HEADQUARTERS && typeof global.syncAgeHeadquartersPlanningLayout === 'function') {
            global.requestAnimationFrame(() => {
                global.syncAgeHeadquartersPlanningLayout();
                global.RoyalArmiesAgeHeadquartersPlanningMap?.refreshLayout?.();
            });
        }

        if (activeView === VIEW_CITY) {
            renderSettlementMenu();
            void global.RoyalArmiesAdventurersGuild?.ensureSettlementGuildHubLoaded?.({
                settlementTier: resolveSettlementTier()
            });
        }
    }

    function onViewTabClick(event) {
        const tab = event.target.closest('[data-age-view-tab]');
        if (!tab) return;
        event.preventDefault();
        setActiveView(tab.getAttribute('data-age-view-tab'));
    }

    function onViewTabKeydown(event) {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

        const tablist = event.currentTarget;
        const tabs = Array.from(tablist.querySelectorAll('[data-age-view-tab]'));
        const currentIndex = tabs.findIndex((tab) => tab.classList.contains('is-active'));
        if (currentIndex < 0) return;

        event.preventDefault();
        const delta = event.key === 'ArrowRight' ? 1 : -1;
        const nextIndex = (currentIndex + delta + tabs.length) % tabs.length;
        const nextTab = tabs[nextIndex];
        if (!nextTab) return;

        setActiveView(nextTab.getAttribute('data-age-view-tab'));
        nextTab.focus();
    }

    function onSettlementMenuClick(event) {
        if (event.target.closest('[data-guild-job]')) {
            return;
        }
        if (event.target.closest('[data-garrison-option]')) {
            return;
        }
        const button = event.target.closest('[data-settlement-venue]');
        if (!button) return;
        handleVenueClick(button.getAttribute('data-settlement-venue'));
    }

    function bindViewTabs() {
        if (bound) return;
        bound = true;

        const tablist = global.document.querySelector('.age-map-view-tabs');
        const menuList = global.document.getElementById('age-settlement-menu-list');

        if (tablist) {
            tablist.addEventListener('click', onViewTabClick);
            tablist.addEventListener('keydown', onViewTabKeydown);
        }

        if (menuList) {
            menuList.addEventListener('click', onSettlementMenuClick);
        }
    }

    function enableAgeViewTabs() {
        const mapImage = global.document.getElementById('age-world-map-bg-image');
        if (mapImage && !mapImage.dataset.worldHref) {
            const href = mapImage.getAttribute('href') || WORLD_MAP_SRC;
            mapImage.dataset.worldHref = href;
        }

        bindViewTabs();
        setActiveView(VIEW_MAP, { force: true });
    }

    function refreshAgeViewTabs() {
        if (activeView === VIEW_CITY) {
            renderSettlementMenu();
            syncMapStage();
        }
    }

    global.RoyalArmiesAgeViewTabs = {
        enable: enableAgeViewTabs,
        refresh: refreshAgeViewTabs,
        setActiveView,
        getActiveView: () => activeView,
        getSettlementVenues: resolveVenuesForTier,
        VIEW_GUILD_TRAINING
    };

    global.enableAgeViewTabs = enableAgeViewTabs;
    global.refreshAgeViewTabs = refreshAgeViewTabs;
})(window);

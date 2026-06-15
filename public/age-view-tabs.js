/**
 * RIFT — Age map view tabs (world map, settlement city, guild training).
 * Council Room, Records, and War Room open via Game Hub center modals.
 */
(function initAgeViewTabs(global) {
    'use strict';

    const VIEW_MAP = 'map';
    const VIEW_CITY = 'city';
    const VIEW_COUNCIL_ROOM = 'council-room';
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
        village: 'Settlement Patrol, Trade Escort (skill)',
        town: 'Settlement Patrol, Civilian Escort, Trade Escort (skill), Border Patrol',
        city: 'Settlement Patrol, Civilian Escort, Trade Escort (skill), Border Patrol',
        citadel: 'Settlement Patrol, Civilian Escort, Trade Escort (skill), Border Patrol, Player Bounties',
        kingdom: 'Settlement Patrol, Civilian Escort, Trade Escort (skill), Border Patrol, Player Bounties'
    };

    const VENUE_RANK_GATES = Object.freeze({
        blacksmith: 2,
        armory: 2,
        church: 7
    });

    const VENUE_MARKS = {
        'adventurers-guild': '⚑',
        'infirmary': '✚',
        church: '✦',
        barracks: '⚔',
        blacksmith: '⚒',
        armory: '⧉',
        arenas: '⚜',
        'war-room': '⚔'
    };

    const SETTLEMENT_WAR_ROOM_VENUE = Object.freeze({
        id: 'war-room',
        label: 'WARROOM',
        description: 'Nation formations, SF Lead pool, and rescue signals.'
    });

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
                id: 'adventurers-guild',
                label: "Adventurer's Guild",
                description: `Accept jobs: ${ADVENTURERS_GUILD_JOBS.village}.`
            },
            {
                id: 'blacksmith',
                label: 'Blacksmith',
                description: 'Purchase weapons, armor, and other battle-useful tools.'
            }
        ],
        town: [
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
            }
        ],
        city: [
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
                description: 'Garrison Registry and Unit Evolution.'
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
            }
        ],
        citadel: [
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
                description: 'Garrison Registry and Unit Evolution.'
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
            }
        ],
        kingdom: [
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
                description: 'Garrison Registry and Unit Evolution.'
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
            }
        ]
    };

    let activeView = VIEW_MAP;
    let bound = false;

    function resolveCommanderRank() {
        return Math.max(1, Math.floor(Number(global.player?.rank) || 1));
    }

    function resolveVenueRankGate(venueId) {
        const normalizedId = String(venueId || '').trim().toLowerCase();
        const minRank = VENUE_RANK_GATES[normalizedId];
        if (!minRank) {
            return { locked: false, lockReason: '', minRank: 0 };
        }

        const rank = resolveCommanderRank();
        if (rank >= minRank) {
            return { locked: false, lockReason: '', minRank };
        }

        const rankTitles = global.RoyalArmiesCommanderRankTitles;
        const meta = rankTitles?.resolveSelfCommanderRankMeta?.() || {};
        const thresholdLabel = rankTitles?.formatCommanderRankLabel
            ? rankTitles.formatCommanderRankLabel(minRank, meta.path, meta.rankTitleGender)
            : `rank ${minRank}`;

        return {
            locked: true,
            lockReason: `Unlocks at ${thresholdLabel}.`,
            minRank
        };
    }

    function isSettlementVenueLocked(venueId) {
        return resolveVenueRankGate(venueId).locked;
    }

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

    function isSettlementOnlyPage() {
        return global.document.body?.dataset?.ageSettlementPage === 'true';
    }

    function isMapOnlyPage() {
        return global.document.body?.dataset?.ageMapOnly === 'true';
    }

    function isCityInfoSettlementTabOpen() {
        return Boolean(
            global.document.querySelector('#age-page-canvas .age-map-hud--right')
                ?.classList.contains('is-city-info-settlement-open')
        );
    }

    function hasSettlementVenueWorkspace() {
        return Boolean(global.document.getElementById('age-settlement-venue-workspace'));
    }

    function openMapSettlementPanel() {
        global.RoyalArmiesSettlementVenueWorkspaces?.dismissAll?.();
        global.RoyalArmiesAdventurersGuild?.dismissGuildWorkspacesForSettlementAction?.();

        if (activeView === VIEW_GUILD_TRAINING) {
            global.RoyalArmiesAdventurersGuild?.closeTrainingView?.({ skipViewRestore: true });
        }

        if (activeView !== VIEW_MAP) {
            activeView = VIEW_MAP;
            syncViewTabButtons();
            syncRightHudPanels();
            syncMapStage();
        }

        if (typeof global.RoyalArmiesAgeMovementPanel?.activateCityInfoTab === 'function') {
            global.RoyalArmiesAgeMovementPanel.activateCityInfoTab('settlement');
        }

        renderSettlementMenu();
        void global.RoyalArmiesAdventurersGuild?.ensureSettlementGuildHubLoaded?.({
            settlementTier: resolveSettlementTier()
        });
    }

    function resolveSettlementTier() {
        const override = global.RoyalArmiesSettlementPage?.getDevTierOverride?.();
        if (override && SETTLEMENT_MAP_SRC[override]) {
            return override;
        }

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

    function resolveSettlementVenueMeta(venueId, tier) {
        const normalizedId = String(venueId || '').trim().toLowerCase();
        if (normalizedId === SETTLEMENT_WAR_ROOM_VENUE.id) {
            return { ...SETTLEMENT_WAR_ROOM_VENUE };
        }
        const venues = resolveVenuesForTier(tier);
        return venues.find((venue) => venue.id === normalizedId) || {
            id: normalizedId,
            label: normalizedId || 'Venue',
            description: ''
        };
    }

    function getViewTabs() {
        const hubItems = global.document.querySelectorAll(
            '.age-nation-hub-menu-ladder [data-age-view-tab]'
        );
        if (hubItems.length) {
            return Array.from(hubItems);
        }
        return Array.from(global.document.querySelectorAll('[data-age-view-tab]'));
    }

    function isWorkspaceOverlayView(view) {
        return view === VIEW_GUILD_TRAINING;
    }

    function normalizeView(view) {
        if (view === VIEW_CITY || view === VIEW_GUILD_TRAINING) {
            return view;
        }
        return VIEW_MAP;
    }

    function syncViewTabButtons() {
        const settlementTabOpen = isCityInfoSettlementTabOpen();
        getViewTabs().forEach((tab) => {
            const view = tab.getAttribute('data-age-view-tab');
            const isActive = view === activeView
                || (activeView === VIEW_GUILD_TRAINING && view === VIEW_CITY)
                || (view === VIEW_CITY && activeView === VIEW_MAP && settlementTabOpen);
            tab.classList.toggle('is-active', isActive);
            if (tab.getAttribute('role') === 'menuitem') {
                if (isActive) {
                    tab.setAttribute('aria-current', 'true');
                } else {
                    tab.removeAttribute('aria-current');
                }
                tab.removeAttribute('aria-selected');
            } else {
                tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
                tab.removeAttribute('aria-current');
            }
            tab.tabIndex = isActive ? 0 : -1;
        });
    }

    function syncRightHudPanels() {
        const canvas = resolveCanvas();
        const cityInfoPanel = global.document.querySelector('#age-page-canvas .age-city-info-panel');
        const settlementPanel = global.document.getElementById('age-settlement-menu-panel');
        const rightHud = global.document.querySelector('#age-page-canvas .age-map-hud--right');

        const inSettlementView = activeView === VIEW_CITY && !isMapOnlyPage();
        const inGuildTrainingView = activeView === VIEW_GUILD_TRAINING;
        const inWorkspaceOverlay = isWorkspaceOverlayView(activeView);

        if (canvas) {
            canvas.dataset.ageView = activeView;
            global.dispatchEvent(new CustomEvent('royalarmies:age-map-view-change', {
                detail: { view: activeView }
            }));
        }

        if (rightHud) {
            rightHud.classList.toggle('is-settlement-view-open', inSettlementView);
            rightHud.classList.remove('is-headquarters-view-open');
            if (inSettlementView) {
                rightHud.classList.remove('is-city-info-players-open');
                rightHud.classList.remove('is-city-info-settlement-open');
                rightHud.setAttribute('aria-label', `${resolveSettlementTierDisplayLabel()} venues`);
            } else if (!inWorkspaceOverlay) {
                global.RoyalArmiesAgeMovementPanel?.refreshCityInfoPanelHeader?.();
            }
        }

        if (cityInfoPanel) {
            cityInfoPanel.hidden = inSettlementView || inWorkspaceOverlay;
        }

        if (settlementPanel) {
            const embeddedInCityInfo = Boolean(global.document.getElementById('age-city-info-tab-settlement'));
            settlementPanel.hidden = embeddedInCityInfo || (isSettlementOnlyPage() ? false : !inSettlementView);
        }

        const guildWorkspace = global.document.getElementById('age-guild-workspace');
        const guildTrainingArena = global.document.getElementById('age-guild-training-arena');
        const guildTrainingOpen = typeof global.RoyalArmiesAdventurersGuild?.isTrainingOpen === 'function'
            && global.RoyalArmiesAdventurersGuild.isTrainingOpen();
        const guildOverlayOpen = typeof global.RoyalArmiesAdventurersGuild?.isOverlayOpen === 'function'
            && global.RoyalArmiesAdventurersGuild.isOverlayOpen();
        const guildWorkspaceOpen = typeof global.RoyalArmiesAdventurersGuild?.isOpen === 'function'
            && global.RoyalArmiesAdventurersGuild.isOpen();
        const showGuildWorkspace = guildTrainingOpen || guildOverlayOpen || guildWorkspaceOpen;
        if (guildWorkspace) {
            guildWorkspace.hidden = !showGuildWorkspace;
            guildWorkspace.setAttribute('aria-hidden', showGuildWorkspace ? 'false' : 'true');
        }
        if (guildTrainingArena) {
            guildTrainingArena.hidden = !guildTrainingOpen;
            guildTrainingArena.setAttribute('aria-hidden', guildTrainingOpen ? 'false' : 'true');
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
        const inSettlementView = activeView === VIEW_CITY && !isMapOnlyPage();
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

        if (inGuildTrainingView) {
            global.RoyalArmiesAdventurersGuild?.onTrainingViewOpen?.();
        } else if (!global.RoyalArmiesAdventurersGuild?.isTrainingOpen?.()) {
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
                    : activeView === VIEW_GUILD_TRAINING
                                ? 'Guild training battle'
                                : 'Amnek world map'
            );
        }
    }

    function isSettlementMenuFlatLayout() {
        return isSettlementOnlyPage()
            || Boolean(global.document.getElementById('age-city-info-tab-settlement'));
    }

    function buildSettlementMenuHtml(tier) {
        const venues = resolveVenuesForTier(tier);

        return venues.map((venue) => {
            const placementClass = venue.placement === 'bottom'
                ? ' age-settlement-menu-item--bottom'
                : '';
            const mark = escapeSettlementMenuHtml(resolveVenueMark(venue.id));
            const label = escapeSettlementMenuHtml(venue.label);
            const gate = resolveVenueRankGate(venue.id);
            const lockedClass = gate.locked ? ' is-locked' : '';
            const disabledAttr = gate.locked ? ' disabled aria-disabled="true"' : '';
            const lockTagline = gate.locked
                ? `<span class="age-settlement-menu-item-tagline age-settlement-menu-item-lock">${escapeSettlementMenuHtml(gate.lockReason)}</span>`
                : '';
            const isExpandable = venue.id === 'adventurers-guild' || venue.id === 'barracks';
            const subPanelId = venue.id === 'adventurers-guild'
                ? 'age-settlement-guild-jobs'
                : (venue.id === 'barracks' ? 'age-settlement-garrison-options' : '');
            const wrapClass = venue.id === 'adventurers-guild'
                ? 'age-settlement-menu-guild-wrap'
                : (venue.id === 'barracks' ? 'age-settlement-menu-garrison-wrap' : '');
            const itemHtml = (
                `<button type="button" class="age-settlement-menu-item${placementClass}${lockedClass}${isExpandable ? ' age-settlement-menu-item--expandable' : ''}"`
                + ` data-settlement-venue="${escapeSettlementMenuHtml(venue.id)}"`
                + `${disabledAttr}`
                + `${isExpandable ? ` aria-expanded="false" aria-controls="${subPanelId}"` : ''}`
                + ` aria-label="${gate.locked
                    ? `${label} locked — ${escapeSettlementMenuHtml(gate.lockReason)}`
                    : (isExpandable ? `Toggle ${label} options` : `Open ${label} workspace`)}">`
                + `<span class="age-settlement-menu-item-mark" aria-hidden="true">${mark}</span>`
                + `<span class="age-settlement-menu-item-body">`
                + `<span class="age-settlement-menu-item-label">${label}</span>`
                + lockTagline
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

    function buildSettlementWarRoomSlotHtml() {
        const mark = escapeSettlementMenuHtml(resolveVenueMark(SETTLEMENT_WAR_ROOM_VENUE.id));
        const label = escapeSettlementMenuHtml(SETTLEMENT_WAR_ROOM_VENUE.label);
        return (
            '<p class="age-settlement-menu-war-room-eyebrow">Nation Command</p>'
            + '<button type="button"'
            + ' class="age-settlement-menu-item age-settlement-menu-item--war-room"'
            + ` data-settlement-venue="${escapeSettlementMenuHtml(SETTLEMENT_WAR_ROOM_VENUE.id)}"`
            + ' aria-label="Open War Room">'
            + `<span class="age-settlement-menu-item-mark age-settlement-menu-item-mark--war-room" aria-hidden="true">${mark}</span>`
            + '<span class="age-settlement-menu-item-body">'
            + `<span class="age-settlement-menu-item-label">${label}</span>`
            + '<span class="age-settlement-menu-item-tagline">Formations · SF Lead · Rescue</span>'
            + '</span>'
            + '<span class="age-settlement-menu-item-chevron" aria-hidden="true">›</span>'
            + '</button>'
        );
    }

    function shouldShowSettlementWarRoomSlot() {
        if (!global.document.getElementById('age-settlement-menu-war-room-slot')) {
            return false;
        }
        return isSettlementOnlyPage() || isSettlementMenuFlatLayout();
    }

    function renderSettlementWarRoomSlot() {
        const slotEl = global.document.getElementById('age-settlement-menu-war-room-slot');
        if (!slotEl) return;

        if (!shouldShowSettlementWarRoomSlot()) {
            slotEl.hidden = true;
            slotEl.innerHTML = '';
            return;
        }

        const nextHtml = buildSettlementWarRoomSlotHtml();
        slotEl.hidden = false;
        if (slotEl.innerHTML !== nextHtml) {
            slotEl.innerHTML = nextHtml;
        }
    }

    function renderSettlementMenu() {
        const titleEl = global.document.getElementById('age-settlement-menu-title');
        const settlementTabBtn = global.document.getElementById('age-city-info-tab-btn-settlement');
        const tierEl = global.document.getElementById('age-settlement-menu-tier-label');
        const listEl = global.document.getElementById('age-settlement-menu-list');

        const city = resolveDisplayedCity();
        const tier = resolveSettlementTier();
        const settlementName = city?.name || 'Settlement';

        if (titleEl) {
            titleEl.textContent = settlementName;
        }

        if (settlementTabBtn) {
            settlementTabBtn.textContent = 'Buildings';
            settlementTabBtn.setAttribute('title', 'Buildings');
        }

        if (tierEl) {
            tierEl.textContent = resolveSettlementTierDisplayLabel();
        }

        if (!listEl) {
            renderSettlementWarRoomSlot();
            return;
        }

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

        renderSettlementWarRoomSlot();
    }

    function openSettlementWarRoom() {
        global.RoyalArmiesSettlementVenueWorkspaces?.dismissAll?.();
        global.RoyalArmiesAdventurersGuild?.dismissGuildWorkspacesForSettlementAction?.();
        global.RoyalArmiesAgeNationHub?.close?.();

        const warRoom = global.RoyalArmiesAgeArmyGroups;
        if (!warRoom) {
            if (typeof global.showPortalAlert === 'function') {
                void global.showPortalAlert('War Room is unavailable in this session.', 'War Room');
            }
            return;
        }

        if (typeof warRoom.enable === 'function') {
            warRoom.enable();
        }

        if (warRoom.isWorkspaceOpen?.()) {
            warRoom.closeWorkspace?.();
            return;
        }

        if (typeof warRoom.openWorkspace === 'function') {
            warRoom.openWorkspace();
            return;
        }

        if (typeof global.showPortalAlert === 'function') {
            void global.showPortalAlert('War Room is unavailable in this session.', 'War Room');
        }
    }

    function collapseOtherSettlementMenuDropdowns(activeVenueId) {
        const active = String(activeVenueId || '').trim().toLowerCase();
        if (active !== 'adventurers-guild') {
            global.RoyalArmiesAdventurersGuild?.collapseSettlementJobs?.();
        }
        if (active !== 'barracks') {
            global.RoyalArmiesAgeBarracks?.collapseSettlementGarrisonMenu?.();
        }
    }

    function handleVenueClick(venueId) {
        const normalizedVenueId = String(venueId || '').trim().toLowerCase();
        if (isSettlementVenueLocked(normalizedVenueId)) {
            return;
        }

        if (normalizedVenueId === 'war-room') {
            openSettlementWarRoom();
            return;
        }

        const tier = resolveSettlementTier();

        if (normalizedVenueId === 'adventurers-guild') {
            collapseOtherSettlementMenuDropdowns(normalizedVenueId);
            if (typeof global.RoyalArmiesAdventurersGuild?.toggleSettlementJobs === 'function') {
                void global.RoyalArmiesAdventurersGuild.toggleSettlementJobs({
                    settlementTier: tier,
                    city: resolveCurrentCity()
                });
            }
            return;
        }

        if (normalizedVenueId === 'barracks') {
            collapseOtherSettlementMenuDropdowns(normalizedVenueId);
            if (typeof global.RoyalArmiesAgeBarracks?.toggleSettlementGarrisonMenu === 'function') {
                global.RoyalArmiesAgeBarracks.toggleSettlementGarrisonMenu();
            }
            return;
        }

        const detail = {
            venueId: normalizedVenueId,
            settlementTier: tier,
            city: resolveCurrentCity(),
            venue: resolveSettlementVenueMeta(normalizedVenueId, tier)
        };

        if (hasSettlementVenueWorkspace() && typeof global.RoyalArmiesSettlementVenueWorkspaces?.open === 'function') {
            void global.RoyalArmiesSettlementVenueWorkspaces.open(detail);
            return;
        }

        global.dispatchEvent(new CustomEvent('royal-armies-settlement-venue-open', { detail }));
    }

    function setActiveView(view, options = {}) {
        if (view === VIEW_CITY && (isMapOnlyPage() || hasSettlementVenueWorkspace())) {
            openMapSettlementPanel();
            return;
        }

        if (view === VIEW_COUNCIL_ROOM) {
            if (global.document.body?.dataset?.ageCouncilRoomPage === 'true') {
                return;
            }
            if (global.document.getElementById('age-council-room-modal')
                && typeof global.RoyalArmiesAgeHeadquarters?.openCouncilRoom === 'function') {
                global.RoyalArmiesAgeHeadquarters.openCouncilRoom();
                return;
            }
            if (typeof global.RoyalArmiesPagePaths?.navigateToHeadquartersPage === 'function') {
                void global.RoyalArmiesPagePaths.navigateToHeadquartersPage();
                return;
            }
            if (typeof global.RoyalArmiesPagePaths?.navigateToCouncilRoomPage === 'function') {
                void global.RoyalArmiesPagePaths.navigateToCouncilRoomPage();
                return;
            }
            global.RoyalArmiesAgeHeadquarters?.openCouncilRoom?.();
            return;
        }
        if (view === VIEW_RECORDS) {
            global.RoyalArmiesAgeRecords?.openWorkspace?.();
            return;
        }

        const nextView = normalizeView(view);
        if (!options.force && nextView === activeView) {
            syncViewTabButtons();
            return;
        }

        if (activeView === VIEW_GUILD_TRAINING && nextView !== VIEW_GUILD_TRAINING) {
            global.RoyalArmiesAdventurersGuild?.closeTrainingView?.({ skipViewRestore: true });
        }

        if (activeView === VIEW_CITY && nextView !== VIEW_CITY) {
            global.RoyalArmiesAdventurersGuild?.dismissGuildWorkspacesForSettlementAction?.();
        }

        activeView = nextView;
        syncViewTabButtons();
        syncRightHudPanels();
        syncMapStage();

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
        const isHubLadder = event.currentTarget.classList.contains('age-nation-hub-menu-ladder');
        const prevKey = isHubLadder ? 'ArrowUp' : 'ArrowLeft';
        const nextKey = isHubLadder ? 'ArrowDown' : 'ArrowRight';
        if (event.key !== prevKey && event.key !== nextKey) return;

        const tablist = event.currentTarget;
        const tabs = Array.from(
            tablist.querySelectorAll(isHubLadder ? '.age-nation-hub-menu-item' : '[data-age-view-tab]')
        );
        const currentIndex = tabs.findIndex((tab) => tab.classList.contains('is-active'));
        if (currentIndex < 0) return;

        event.preventDefault();
        const delta = (event.key === nextKey) ? 1 : -1;
        const nextIndex = (currentIndex + delta + tabs.length) % tabs.length;
        const nextTab = tabs[nextIndex];
        if (!nextTab) return;

        setActiveView(nextTab.getAttribute('data-age-view-tab'));
        nextTab.focus();
    }

    function onSettlementMenuClick(event) {
        const button = event.target.closest('[data-settlement-venue]');
        if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
        event.preventDefault();
        event.stopPropagation();
        handleVenueClick(button.getAttribute('data-settlement-venue'));
    }

    function bindSettlementMenuClicks(host) {
        if (!host || host.dataset.ageSettlementMenuBound === 'true') return;
        host.dataset.ageSettlementMenuBound = 'true';
        host.addEventListener('click', onSettlementMenuClick);
    }

    function bindViewTabs() {
        if (bound) return;
        bound = true;

        const hubLadder = global.document.querySelector('.age-nation-hub-menu-ladder');
        const tablist = hubLadder || global.document.querySelector('.age-map-view-tabs');

        if (tablist) {
            tablist.addEventListener('click', onViewTabClick);
            tablist.addEventListener('keydown', onViewTabKeydown);
        }

        [
            global.document.getElementById('age-settlement-menu-panel'),
            global.document.getElementById('age-settlement-menu-list'),
            global.document.getElementById('age-city-info-tab-settlement'),
            global.document.querySelector('.age-city-info-settlement-shell'),
            global.document.getElementById('age-settlement-menu-war-room-slot')
        ].forEach(bindSettlementMenuClicks);
    }

    function enableAgeViewTabs() {
        const mapImage = global.document.getElementById('age-world-map-bg-image');
        if (mapImage && !mapImage.dataset.worldHref) {
            const href = mapImage.getAttribute('href') || WORLD_MAP_SRC;
            mapImage.dataset.worldHref = href;
        }

        bindViewTabs();
        global.addEventListener('royalarmies:age-commander-rank-updated', () => {
            if (activeView === VIEW_CITY) {
                renderSettlementMenu();
            }
        });
        if (isSettlementOnlyPage()) {
            setActiveView(VIEW_CITY, { force: true });
        } else {
            setActiveView(VIEW_MAP, { force: true });
        }
    }

    function refreshAgeViewTabs() {
        if (global.document.getElementById('age-settlement-menu-list')
            || global.document.getElementById('age-settlement-menu-war-room-slot')) {
            renderSettlementMenu();
        }
        if (activeView === VIEW_CITY) {
            syncMapStage();
        }
    }

    global.RoyalArmiesAgeViewTabs = {
        enable: enableAgeViewTabs,
        refresh: refreshAgeViewTabs,
        renderSettlementMenu,
        openMapSettlementPanel,
        openSettlementWarRoom,
        setActiveView,
        getActiveView: () => activeView,
        getSettlementVenues: resolveVenuesForTier,
        VIEW_GUILD_TRAINING
    };

    global.enableAgeViewTabs = enableAgeViewTabs;
    global.refreshAgeViewTabs = refreshAgeViewTabs;
})(window);

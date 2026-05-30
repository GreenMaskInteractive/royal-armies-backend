/**
 * RIFT — Age map view tabs (world map / settlement / realm).
 */
(function initAgeViewTabs(global) {
    'use strict';

    const VIEW_MAP = 'map';
    const VIEW_CITY = 'city';
    const VIEW_REALM = 'realm';

    const WORLD_MAP_SRC = 'images/amnekmap.png';
    const SETTLEMENT_MAP_SRC = {
        village: 'images/village.png',
        city: 'images/village.png',
        kingdom: 'images/village.png'
    };

    const SETTLEMENT_TIER_LABEL = {
        village: 'Village',
        city: 'City',
        kingdom: 'Kingdom'
    };

    const SETTLEMENT_VENUES = {
        village: [
            {
                id: 'town-hall',
                label: 'Town Hall',
                description: 'Improve your village.'
            },
            {
                id: 'marketplace',
                label: 'Marketplace',
                description: 'Buy supplies.'
            },
            {
                id: 'adventurers-guild',
                label: "Adventurer's Guild",
                description: 'First come, first serve quests.'
            },
            {
                id: 'blacksmith',
                label: 'Blacksmith',
                description: 'Improve your commander.'
            },
            {
                id: 'border',
                label: 'Border',
                description: 'Battle training grounds.',
                placement: 'bottom'
            }
        ],
        city: [
            {
                id: 'town-hall',
                label: 'Town Hall',
                description: 'City improvements and governance.'
            },
            {
                id: 'marketplace',
                label: 'Marketplace',
                description: 'Trade supplies and goods.'
            },
            {
                id: 'adventurers-guild',
                label: "Adventurer's Guild",
                description: 'City quests and contracts.'
            },
            {
                id: 'barracks',
                label: 'Barracks',
                description: 'Train and muster armies.'
            },
            {
                id: 'border',
                label: 'Border',
                description: 'Battle training grounds.',
                placement: 'bottom'
            }
        ],
        kingdom: [
            {
                id: 'royal-court',
                label: 'Royal Court',
                description: 'Kingdom decrees and diplomacy.'
            },
            {
                id: 'grand-market',
                label: 'Grand Market',
                description: 'Kingdom trade and provisions.'
            },
            {
                id: 'war-council',
                label: 'War Council',
                description: 'Kingdom military planning.'
            },
            {
                id: 'adventurers-guild',
                label: "Adventurer's Guild",
                description: 'Kingdom-wide quest board.'
            },
            {
                id: 'border',
                label: 'Border',
                description: 'Battle training grounds.',
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

    function resolveSettlementTier() {
        const city = resolveCurrentCity();
        const tier = String(city?.settlementTier || 'village').trim().toLowerCase();
        if (tier === 'city' || tier === 'kingdom') return tier;
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

    function syncViewTabButtons() {
        getViewTabs().forEach((tab) => {
            const view = tab.getAttribute('data-age-view-tab');
            const isActive = view === activeView;
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

        if (canvas) {
            canvas.dataset.ageView = activeView;
        }

        if (rightHud) {
            rightHud.classList.toggle('is-settlement-view-open', inSettlementView);
            if (inSettlementView) {
                rightHud.classList.remove('is-city-info-players-open');
            }
        }

        if (cityInfoPanel) {
            cityInfoPanel.hidden = inSettlementView;
        }

        if (settlementPanel) {
            settlementPanel.hidden = !inSettlementView;
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
        const city = resolveCurrentCity();
        const tier = resolveSettlementTier();
        const inSettlementView = activeView === VIEW_CITY;

        if (mapFrame) {
            mapFrame.classList.toggle('is-settlement-map-frame', inSettlementView);
        }

        if (mapSvg) {
            mapSvg.hidden = inSettlementView;
        }

        if (mapCanvas) {
            mapCanvas.hidden = inSettlementView;
        }

        if (highlightCanvas) {
            highlightCanvas.hidden = inSettlementView;
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

        if (mapImage && !inSettlementView) {
            const worldHref = mapImage.dataset.worldHref || WORLD_MAP_SRC;
            mapImage.setAttribute('href', worldHref);
            mapImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', worldHref);
        }

        if (mapStage) {
            mapStage.setAttribute(
                'aria-label',
                activeView === VIEW_CITY
                    ? `${city?.name || 'Settlement'} local map`
                    : 'Amnek world map'
            );
        }
    }

    function renderSettlementMenu() {
        const titleEl = global.document.getElementById('age-settlement-menu-title');
        const tierEl = global.document.getElementById('age-settlement-menu-tier-label');
        const listEl = global.document.getElementById('age-settlement-menu-list');

        const city = resolveCurrentCity();
        const tier = resolveSettlementTier();
        const venues = resolveVenuesForTier(tier);

        if (titleEl) {
            titleEl.textContent = city?.name || 'Settlement';
        }

        if (tierEl) {
            tierEl.textContent = SETTLEMENT_TIER_LABEL[tier] || 'Village';
        }

        if (!listEl) return;

        listEl.innerHTML = venues.map((venue) => {
            const placementClass = venue.placement === 'bottom'
                ? ' age-settlement-menu-item--bottom'
                : '';
            const description = venue.description
                ? `<span class="age-settlement-menu-item-desc">${venue.description}</span>`
                : '';
            return (
                `<button type="button" class="age-settlement-menu-item${placementClass}"`
                + ` data-settlement-venue="${venue.id}">`
                + `<span class="age-settlement-menu-item-label">${venue.label}</span>`
                + description
                + '</button>'
            );
        }).join('');
    }

    function handleVenueClick(venueId) {
        const tier = resolveSettlementTier();
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
        const nextView = view === VIEW_CITY || view === VIEW_REALM ? view : VIEW_MAP;
        if (!options.force && nextView === activeView) {
            syncViewTabButtons();
            return;
        }

        activeView = nextView;
        syncViewTabButtons();
        syncRightHudPanels();
        syncMapStage();

        if (activeView === VIEW_CITY) {
            renderSettlementMenu();
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
        getSettlementVenues: resolveVenuesForTier
    };

    global.enableAgeViewTabs = enableAgeViewTabs;
    global.refreshAgeViewTabs = refreshAgeViewTabs;
})(window);

/**
 * RIFT — Settlement venue buttons → full-screen army workspaces on the map settlement tab.
 */
(function initRoyalArmiesSettlementVenueWorkspaces(global) {
    'use strict';

    const DEFENSE_VENUE_IDS = new Set([
        'village-center',
        'town-square',
        'city-hall',
        'citadel-court',
        'grand-embassy'
    ]);

    const BLACKSMITH_CATALOG = Object.freeze([
        { id: 'blade', mark: '⚔', title: 'Field Blades', desc: 'Standard issue weapons for front-line companies.', cost: '120 gold' },
        { id: 'mail', mark: '🛡', title: 'Reinforced Mail', desc: 'Layered armor kits sized for your active roster.', cost: '95 gold' },
        { id: 'kit', mark: '⚙', title: 'Campaign Kits', desc: 'Field tools, rations packs, and march consumables.', cost: '48 gold' },
        { id: 'bows', mark: '🏹', title: 'Skirmish Bows', desc: 'Ranged kits for screening and harassment lanes.', cost: '110 gold' }
    ]);

    const ARMORY_SLOTS = Object.freeze([
        { id: 'weapon', label: 'Primary Weapon', tier: 'Tier II', status: 'Ready to upgrade' },
        { id: 'armor', label: 'Chest Armor', tier: 'Tier I', status: 'Eligible' },
        { id: 'banner', label: 'Formation Banner', tier: 'Locked', status: 'Requires Church blessing' },
        { id: 'trinket', label: 'Command Trinket', tier: 'Tier I', status: 'Eligible' }
    ]);

    const DEFENSE_MODULES = Object.freeze([
        { id: 'walls', mark: '▣', title: 'Palisade Reinforcement', desc: 'Raises local garrison defense for this settlement.' },
        { id: 'towers', mark: '◈', title: 'Watch Towers', desc: 'Extends scout response time against raids.' },
        { id: 'stores', mark: '◆', title: 'Supply Stores', desc: 'Improves provision recovery between battles.' },
        { id: 'wards', mark: '✦', title: 'Arcane Wards', desc: 'Adds spell shielding to settlement defenses.' }
    ]);

    let bound = false;
    let activeVenueId = '';

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function resolveVenueWorkspace() {
        return global.document.getElementById('age-settlement-venue-workspace');
    }

    function setVenueWorkspaceOpen(isOpen) {
        global.document.body.classList.toggle('age-settlement-venue-open', isOpen);
        global.document.body.classList.toggle('age-army-workspace-open', isOpen);
        global.RoyalArmiesImmersiveWorkspace?.sync?.();
    }

    function dismissAllWorkspaces() {
        global.RoyalArmiesAgeBarracks?.close?.();
        global.RoyalArmiesAgeUnitEvolution?.close?.();
        global.RoyalArmiesAdventurersGuild?.dismissGuildWorkspacesForSettlementAction?.();
        closeArmyWorkspace();
    }

    function closeArmyWorkspace() {
        const workspace = resolveVenueWorkspace();
        if (!workspace) return;

        workspace.hidden = true;
        workspace.setAttribute('aria-hidden', 'true');
        setVenueWorkspaceOpen(false);
        activeVenueId = '';
    }

    function openArmyWorkspace(options = {}) {
        const workspace = resolveVenueWorkspace();
        const titleEl = global.document.getElementById('age-settlement-venue-title');
        const eyebrowEl = global.document.getElementById('age-settlement-venue-eyebrow');
        const subtitleEl = global.document.getElementById('age-settlement-venue-subtitle');
        const bodyEl = global.document.getElementById('age-settlement-venue-body');
        if (!workspace || !titleEl || !bodyEl) return;

        dismissAllWorkspaces();

        if (eyebrowEl) eyebrowEl.textContent = options.eyebrow || 'Personal Army';
        titleEl.textContent = options.title || 'Workspace';
        if (subtitleEl) {
            const subtitle = String(options.subtitle || '').trim();
            subtitleEl.textContent = subtitle;
            subtitleEl.hidden = !subtitle;
        }
        bodyEl.innerHTML = options.bodyHtml || '';

        workspace.hidden = false;
        workspace.setAttribute('aria-hidden', 'false');
        setVenueWorkspaceOpen(true);
        activeVenueId = String(options.venueId || '').trim();

        global.document.getElementById('age-settlement-venue-close')?.focus();
    }

    function renderCatalogCards(items, actionLabel) {
        return (
            '<div class="age-army-workspace-grid" role="list">'
            + items.map((item) => (
                `<article class="age-army-workspace-card" role="listitem">`
                + `<span class="age-army-workspace-card-mark" aria-hidden="true">${escapeHtml(item.mark)}</span>`
                + `<h3 class="age-army-workspace-card-title">${escapeHtml(item.title)}</h3>`
                + `<p class="age-army-workspace-card-desc">${escapeHtml(item.desc)}</p>`
                + `<div class="age-army-workspace-card-meta">${escapeHtml(item.cost || item.tier || '')}</div>`
                + `<button type="button" class="age-army-workspace-card-btn" data-army-workspace-action="${escapeHtml(item.id)}">`
                + `${escapeHtml(actionLabel)}</button>`
                + '</article>'
            )).join('')
            + '</div>'
        );
    }

    function renderBlacksmithBody() {
        return (
            '<div class="age-army-workspace-toolbar">'
            + '<p class="age-army-workspace-toolbar-note">Forge and outfit your companies with weapons, armor, and campaign kits. Purchases sync to your roster when the ledger API is connected.</p>'
            + '<div class="age-army-workspace-pill-row">'
            + '<span class="age-army-workspace-pill">Outfit</span>'
            + '<span class="age-army-workspace-pill">Maintain</span>'
            + '</div></div>'
            + renderCatalogCards(BLACKSMITH_CATALOG, 'Purchase')
        );
    }

    function renderArmoryBody() {
        const list = ARMORY_SLOTS.map((slot) => (
            `<li class="age-army-workspace-list-item">`
            + `<span class="age-army-workspace-list-label">${escapeHtml(slot.label)}</span>`
            + `<span class="age-army-workspace-list-value">${escapeHtml(slot.tier)}</span>`
            + '</li>'
        )).join('');

        return (
            '<div class="age-army-workspace-split">'
            + '<section class="age-army-workspace-panel" aria-label="Equipped loadout">'
            + '<h3 class="age-army-workspace-panel-title">Equipped Loadout</h3>'
            + `<ul class="age-army-workspace-list">${list}</ul>`
            + '<p class="age-army-workspace-toolbar-note">Upgrade slots improve combat stats and special effects for units assigned to this settlement.</p>'
            + '</section>'
            + '<section class="age-army-workspace-panel" aria-label="Upgrade queue">'
            + '<h3 class="age-army-workspace-panel-title">Upgrade Queue</h3>'
            + renderCatalogCards(
                ARMORY_SLOTS.filter((slot) => slot.status === 'Eligible').map((slot) => ({
                    id: slot.id,
                    mark: '↑',
                    title: slot.label,
                    desc: slot.status,
                    cost: '24 provisions'
                })),
                'Upgrade'
            )
            + '</section></div>'
        );
    }

    function renderDefenseBody() {
        return (
            '<div class="age-army-workspace-toolbar">'
            + '<p class="age-army-workspace-toolbar-note">Invest in settlement defenses to protect your army between deployments and harden this city against assaults.</p>'
            + '</div>'
            + renderCatalogCards(
                DEFENSE_MODULES.map((mod) => ({
                    id: mod.id,
                    mark: mod.mark,
                    title: mod.title,
                    desc: mod.desc,
                    cost: 'Defense points'
                })),
                'Improve'
            )
        );
    }

    function renderChurchBody() {
        return (
            '<div class="age-army-workspace-split">'
            + '<section class="age-army-workspace-panel">'
            + '<h3 class="age-army-workspace-panel-title">Blessed Banner</h3>'
            + '<p class="age-army-workspace-toolbar-note">Claim a blessed banner to unlock formation perks and morale bonuses for your personal army.</p>'
            + '<div class="age-army-workspace-link-row">'
            + '<button type="button" class="age-army-workspace-link-btn" data-army-workspace-action="claim-banner">Claim Banner</button>'
            + '</div></section>'
            + '<section class="age-army-workspace-panel">'
            + '<h3 class="age-army-workspace-panel-title">Perk Tree</h3>'
            + renderCatalogCards([
                { id: 'morale', mark: '✦', title: 'Steadfast Morale', desc: 'Reduces attrition after defensive battles.', cost: '1 perk point' },
                { id: 'march', mark: '✦', title: 'Swift March', desc: 'Improves move point recovery on friendly borders.', cost: '2 perk points' },
                { id: 'guard', mark: '✦', title: 'Veteran Guard', desc: 'Buffs garrison units stationed in this city.', cost: '2 perk points' }
            ], 'Unlock')
            + '</section></div>'
        );
    }

    function renderInfirmaryBody() {
        return (
            '<div class="age-settlement-venue-infirmary">'
            + '<p class="age-settlement-venue-infirmary-copy">Restore injured units at this settlement infirmary. Maintaining readiness keeps your army field-effective.</p>'
            + '<div class="age-settlement-venue-infirmary-actions">'
            + '<button type="button" class="age-settlement-venue-infirmary-btn" data-settlement-infirmary-heal="one">Heal One Unit</button>'
            + '<button type="button" class="age-settlement-venue-infirmary-btn age-settlement-venue-infirmary-btn--primary" data-settlement-infirmary-heal="all">Heal Entire Army</button>'
            + '</div>'
            + '<p id="age-settlement-infirmary-status" class="age-settlement-venue-infirmary-status" aria-live="polite"></p>'
            + '</div>'
        );
    }

    function renderPlaceholderBody(note) {
        return (
            '<div class="age-settlement-venue-placeholder">'
            + `<p class="age-settlement-venue-placeholder-copy">${escapeHtml(note)}</p>`
            + '</div>'
        );
    }

    async function healAtInfirmary(mode) {
        const statusEl = global.document.getElementById('age-settlement-infirmary-status');
        const api = global.RoyalArmiesAgeGuildTraining;
        if (!api?.healUnits) {
            if (statusEl) statusEl.textContent = 'Healing is unavailable in this session.';
            return;
        }

        if (statusEl) statusEl.textContent = 'Healing…';
        try {
            await api.healUnits({ mode });
            if (statusEl) statusEl.textContent = 'Healing complete.';
            global.dispatchEvent(new CustomEvent('royalarmies:age-movement-updated'));
        } catch (error) {
            if (statusEl) statusEl.textContent = error?.message || 'Healing failed.';
            if (typeof global.showRiftError === 'function' && error?.code) {
                global.showRiftError(error.code, error.message);
            }
        }
    }

    function openBlacksmith(detail) {
        const venue = detail?.venue || {};
        openArmyWorkspace({
            venueId: 'blacksmith',
            eyebrow: 'Blacksmith',
            title: venue.label || 'Blacksmith',
            subtitle: venue.description || '',
            bodyHtml: renderBlacksmithBody()
        });
    }

    function openArmory(detail) {
        const venue = detail?.venue || {};
        openArmyWorkspace({
            venueId: 'armory',
            eyebrow: 'Armory',
            title: venue.label || 'Armory',
            subtitle: venue.description || '',
            bodyHtml: renderArmoryBody()
        });
    }

    function openDefenseVenue(detail) {
        const venue = detail?.venue || {};
        openArmyWorkspace({
            venueId: detail?.venueId || '',
            eyebrow: 'Settlement Defense',
            title: venue.label || 'Defense',
            subtitle: venue.description || '',
            bodyHtml: renderDefenseBody()
        });
    }

    function openChurch(detail) {
        const venue = detail?.venue || {};
        openArmyWorkspace({
            venueId: 'church',
            eyebrow: 'Church',
            title: venue.label || 'Church',
            subtitle: venue.description || '',
            bodyHtml: renderChurchBody()
        });
    }

    async function openInfirmary(detail) {
        const venue = detail?.venue || {};
        const tier = String(detail?.settlementTier || 'village').trim().toLowerCase();
        global.RoyalArmiesAgeGuildTraining?.setSettlementTier?.(tier);

        openArmyWorkspace({
            venueId: 'infirmary',
            eyebrow: 'Infirmary',
            title: venue.label || 'Infirmary',
            subtitle: venue.description || '',
            bodyHtml: renderInfirmaryBody()
        });
    }

    function openPlaceholderVenue(detail) {
        const venue = detail?.venue || {};
        let placeholderNote = venue?.placeholderNote
            || 'This workspace is under construction. Check back after the next Age of War update.';

        if (detail?.venueId === 'border') {
            placeholderNote = 'Border battle training and assault drills will open here. Use Army Groups on the world map until this workspace ships.';
        } else if (detail?.venueId === 'arenas') {
            placeholderNote = 'Continent-wide commander tournaments and spectator betting will open here for citadel settlements.';
        }

        openArmyWorkspace({
            venueId: detail?.venueId || '',
            eyebrow: 'Settlement',
            title: venue.label || detail?.venueId || 'Venue',
            subtitle: venue.description || '',
            bodyHtml: renderPlaceholderBody(placeholderNote)
        });
    }

    async function openVenue(detail = {}) {
        if (!resolveVenueWorkspace()) return;

        const venueId = String(detail?.venueId || '').trim().toLowerCase();
        if (!venueId) return;

        if (venueId === 'war-room') {
            if (typeof global.RoyalArmiesAgeViewTabs?.openSettlementWarRoom === 'function') {
                global.RoyalArmiesAgeViewTabs.openSettlementWarRoom();
            }
            return;
        }

        if (venueId === 'adventurers-guild') {
            await global.RoyalArmiesAdventurersGuild?.openSettlementHub?.(detail);
            return;
        }

        if (venueId === 'barracks') {
            await global.RoyalArmiesAgeBarracks?.open?.();
            return;
        }

        if (venueId === 'blacksmith') {
            openBlacksmith(detail);
            return;
        }

        if (venueId === 'armory') {
            openArmory(detail);
            return;
        }

        if (DEFENSE_VENUE_IDS.has(venueId)) {
            openDefenseVenue(detail);
            return;
        }

        if (venueId === 'church') {
            openChurch(detail);
            return;
        }

        if (venueId === 'infirmary') {
            await openInfirmary(detail);
            return;
        }

        openPlaceholderVenue(detail);
    }

    function onArmyWorkspaceActionClick(event) {
        const actionBtn = event.target.closest('[data-army-workspace-action]');
        if (!actionBtn) return;

        event.preventDefault();
        const actionId = actionBtn.getAttribute('data-army-workspace-action');

        if (actionId === 'open-registry') {
            closeArmyWorkspace();
            void global.RoyalArmiesAgeBarracks?.open?.();
            return;
        }
        if (actionId === 'open-evolution') {
            closeArmyWorkspace();
            void global.RoyalArmiesAgeUnitEvolution?.open?.({ highlightReady: true });
            return;
        }

        if (typeof global.showPortalAlert === 'function') {
            void global.showPortalAlert('This action will connect to your army ledger in a future update.', 'Army');
        }
    }

    function onInfirmaryClick(event) {
        const healBtn = event.target.closest('[data-settlement-infirmary-heal]');
        if (!healBtn || activeVenueId !== 'infirmary') return;
        event.preventDefault();
        void healAtInfirmary(healBtn.getAttribute('data-settlement-infirmary-heal'));
    }

    function onVenueWorkspaceClick(event) {
        if (event.target.closest('#age-settlement-venue-close')) {
            event.preventDefault();
            closeArmyWorkspace();
            return;
        }
        onArmyWorkspaceActionClick(event);
        onInfirmaryClick(event);
    }

    function onVenueWorkspaceKeydown(event) {
        if (event.key !== 'Escape') return;
        const workspace = resolveVenueWorkspace();
        if (!workspace || workspace.hidden) return;
        event.preventDefault();
        closeArmyWorkspace();
    }

    function bindSettlementVenueWorkspaces() {
        if (bound) return;
        bound = true;

        const workspace = resolveVenueWorkspace();
        workspace?.addEventListener('click', onVenueWorkspaceClick);
        global.document.addEventListener('keydown', onVenueWorkspaceKeydown);
    }

    function enableAgeSettlementVenueWorkspaces() {
        if (!resolveVenueWorkspace()) return;
        bindSettlementVenueWorkspaces();
    }

    global.RoyalArmiesSettlementVenueWorkspaces = {
        open: openVenue,
        close: closeArmyWorkspace,
        dismissAll: dismissAllWorkspaces,
        enableAgeSettlementVenueWorkspaces
    };
    global.enableAgeSettlementVenueWorkspaces = enableAgeSettlementVenueWorkspaces;
})(window);

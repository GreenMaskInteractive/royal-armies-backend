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
        { id: 'walls', mark: '▣', title: 'Palisade Reinforcement', desc: 'Raises local garrison defense for this settlement.', cost: '250 RSD' },
        { id: 'towers', mark: '◈', title: 'Watch Towers', desc: 'Extends scout response time against raids.', cost: '180 RSD' },
        { id: 'stores', mark: '◆', title: 'Supply Stores', desc: 'Improves provision recovery between battles.', cost: '120 RSD' },
        { id: 'wards', mark: '✦', title: 'Arcane Wards', desc: 'Adds spell shielding to settlement defenses.', cost: '320 RSD' }
    ]);

    const INFIRMARY_DEMO_INJURED_UNITS = Object.freeze([
        { id: 'shieldman', mark: '🛡', name: 'Recruit Shieldman (A)', injured: 3, severity: 'Light wounds', recovery: '1 cycle' },
        { id: 'longbow', mark: '🏹', name: 'Longbowman (B)', injured: 2, severity: 'Field trauma', recovery: '2 cycles' },
        { id: 'lancer', mark: '⚔', name: 'Royal Lancer (A/B)', injured: 1, severity: 'Mount fatigue', recovery: '1 cycle' },
        { id: 'warder', mark: '✦', name: 'Warder (A)', injured: 2, severity: 'Arcane strain', recovery: '3 cycles' },
        { id: 'wolf', mark: '🐺', name: 'War-Howler (A-2)', injured: 1, severity: 'Deep lacerations', recovery: '2 cycles' }
    ]);

    let bound = false;
    let activeVenueId = '';
    /** @type {Array<{ id: string, mark: string, name: string, injured: number, severity: string, recovery: string }>} */
    let infirmaryInjuredStacks = [];
    /** @type {{ id: string } | null} */
    let defenseUpgradeQueue = null;

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

    function formatRsdAmount(value) {
        if (global.RoyalArmiesNationTreasury?.formatRsd) {
            return global.RoyalArmiesNationTreasury.formatRsd(value);
        }
        return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('en-US');
    }

    function hideSettlementVenueRsdWallet() {
        const wallet = global.document.getElementById('age-settlement-venue-rsd-wallet');
        if (wallet) wallet.hidden = true;
    }

    async function syncSettlementVenueRsdWallet() {
        const wallet = global.document.getElementById('age-settlement-venue-rsd-wallet');
        const amountEl = global.document.getElementById('age-settlement-venue-rsd-amount');
        if (!wallet || !amountEl) return;

        wallet.hidden = false;
        const hudAmount = global.document.getElementById('age-hud-nation-treasury-amount');
        if (hudAmount?.textContent) {
            amountEl.textContent = hudAmount.textContent.trim();
        }

        if (typeof global.RoyalArmiesNationTreasury?.refresh === 'function') {
            const payload = await global.RoyalArmiesNationTreasury.refresh();
            if (payload != null) {
                amountEl.textContent = formatRsdAmount(payload.rsd);
            }
        }
    }

    function closeArmyWorkspace() {
        const workspace = resolveVenueWorkspace();
        if (!workspace) return;

        workspace.hidden = true;
        workspace.setAttribute('aria-hidden', 'true');
        setVenueWorkspaceOpen(false);
        if (DEFENSE_VENUE_IDS.has(activeVenueId)) {
            defenseUpgradeQueue = null;
        }
        activeVenueId = '';
        hideSettlementVenueRsdWallet();
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

        if (options.showNationTreasury) {
            syncSettlementVenueRsdWallet();
        } else {
            hideSettlementVenueRsdWallet();
        }

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

    function findDefenseModule(moduleId) {
        return DEFENSE_MODULES.find((entry) => entry.id === moduleId) || null;
    }

    function setDefenseWorkspaceStatus(message, isError) {
        const statusEl = global.document.getElementById('age-defense-workspace-status');
        if (!statusEl) return;
        const text = String(message || '').trim();
        if (!text) {
            statusEl.hidden = true;
            statusEl.textContent = '';
            statusEl.classList.remove('is-error');
            return;
        }
        statusEl.hidden = false;
        statusEl.textContent = text;
        statusEl.classList.toggle('is-error', Boolean(isError));
    }

    function renderDefenseQueueSlot() {
        const queued = defenseUpgradeQueue ? findDefenseModule(defenseUpgradeQueue.id) : null;
        if (!queued) {
            return (
                '<section class="age-defense-queue" aria-label="Defense upgrade queue">'
                + '<h3 class="age-defense-queue-title">Upgrade Queue</h3>'
                + '<div class="age-defense-queue-slot age-defense-queue-slot--empty">'
                + '<p class="age-defense-queue-empty">No upgrade queued. One improvement may wait here at a time—choose from the list below.</p>'
                + '</div>'
                + '</section>'
            );
        }

        return (
            '<section class="age-defense-queue" aria-label="Defense upgrade queue">'
            + '<h3 class="age-defense-queue-title">Upgrade Queue</h3>'
            + '<div class="age-defense-queue-slot age-defense-queue-slot--filled">'
            + `<span class="age-defense-queue-mark" aria-hidden="true">${escapeHtml(queued.mark)}</span>`
            + '<div class="age-defense-queue-copy">'
            + `<p class="age-defense-queue-name">${escapeHtml(queued.title)}</p>`
            + `<p class="age-defense-queue-desc">${escapeHtml(queued.desc)}</p>`
            + `<p class="age-defense-queue-cost">${escapeHtml(queued.cost)}</p>`
            + '</div>'
            + '<button type="button" class="age-defense-queue-cancel" data-defense-cancel-queue>Remove from queue</button>'
            + '</div>'
            + '</section>'
        );
    }

    function renderDefenseUpgradeList() {
        const queuedId = defenseUpgradeQueue?.id || '';
        return (
            '<section class="age-defense-upgrades" aria-label="Available defense upgrades">'
            + '<h3 class="age-defense-upgrades-title">Available Improvements</h3>'
            + '<ul class="age-defense-upgrade-list">'
            + DEFENSE_MODULES.map((mod) => {
                const isQueued = queuedId === mod.id;
                const slotTaken = Boolean(queuedId) && !isQueued;
                return (
                    `<li class="age-defense-upgrade-row${isQueued ? ' is-queued' : ''}${slotTaken ? ' is-slot-taken' : ''}">`
                    + `<span class="age-defense-upgrade-mark" aria-hidden="true">${escapeHtml(mod.mark)}</span>`
                    + '<div class="age-defense-upgrade-main">'
                    + `<span class="age-defense-upgrade-title">${escapeHtml(mod.title)}</span>`
                    + `<span class="age-defense-upgrade-desc">${escapeHtml(mod.desc)}</span>`
                    + '</div>'
                    + `<span class="age-defense-upgrade-cost">${escapeHtml(mod.cost)}</span>`
                    + (isQueued
                        ? '<span class="age-defense-upgrade-status">In queue</span>'
                        : `<button type="button" class="age-defense-upgrade-queue-btn" data-defense-queue="${escapeHtml(mod.id)}"${slotTaken ? ' disabled' : ''}>Queue</button>`)
                    + '</li>'
                );
            }).join('')
            + '</ul>'
            + '</section>'
        );
    }

    function renderDefenseBody() {
        return (
            '<div class="age-defense-workspace">'
            + '<p class="age-army-workspace-toolbar-note">Invest nation treasury RSD in settlement defenses. Only one upgrade can be queued at a time; additional choices unlock after the queue clears.</p>'
            + renderDefenseQueueSlot()
            + renderDefenseUpgradeList()
            + '<p id="age-defense-workspace-status" class="age-defense-workspace-status" aria-live="polite" hidden></p>'
            + '</div>'
        );
    }

    function refreshDefenseWorkspaceBody() {
        if (!DEFENSE_VENUE_IDS.has(activeVenueId)) return;
        const bodyEl = global.document.getElementById('age-settlement-venue-body');
        if (!bodyEl) return;
        bodyEl.innerHTML = renderDefenseBody();
    }

    function queueDefenseUpgrade(moduleId) {
        const mod = findDefenseModule(moduleId);
        if (!mod) return;

        if (defenseUpgradeQueue?.id === mod.id) {
            setDefenseWorkspaceStatus(`${mod.title} is already in the queue.`);
            return;
        }

        if (defenseUpgradeQueue?.id) {
            const previous = findDefenseModule(defenseUpgradeQueue.id);
            defenseUpgradeQueue = { id: mod.id };
            refreshDefenseWorkspaceBody();
            setDefenseWorkspaceStatus(
                previous
                    ? `Replaced ${previous.title} with ${mod.title} in the queue.`
                    : `${mod.title} queued for construction.`
            );
            return;
        }

        defenseUpgradeQueue = { id: mod.id };
        refreshDefenseWorkspaceBody();
        setDefenseWorkspaceStatus(`${mod.title} queued. Treasury will be charged when construction begins.`);
    }

    function cancelDefenseQueue() {
        if (!defenseUpgradeQueue) {
            setDefenseWorkspaceStatus('The queue is already empty.');
            return;
        }
        const previous = findDefenseModule(defenseUpgradeQueue.id);
        defenseUpgradeQueue = null;
        refreshDefenseWorkspaceBody();
        setDefenseWorkspaceStatus(previous ? `${previous.title} removed from the queue.` : 'Queue cleared.');
    }

    function onDefenseWorkspaceClick(event) {
        if (!DEFENSE_VENUE_IDS.has(activeVenueId)) return false;

        const cancelBtn = event.target.closest('[data-defense-cancel-queue]');
        if (cancelBtn) {
            event.preventDefault();
            cancelDefenseQueue();
            return true;
        }

        const queueBtn = event.target.closest('[data-defense-queue]');
        if (queueBtn && !queueBtn.disabled) {
            event.preventDefault();
            queueDefenseUpgrade(queueBtn.getAttribute('data-defense-queue'));
            return true;
        }

        return false;
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

    function resetInfirmaryInjuredStacks() {
        infirmaryInjuredStacks = INFIRMARY_DEMO_INJURED_UNITS.map((entry) => ({ ...entry }));
    }

    function countInfirmaryInjuredUnits() {
        return infirmaryInjuredStacks.reduce((sum, stack) => sum + Math.max(0, stack.injured), 0);
    }

    function renderInfirmaryInjuredList() {
        const totalInjured = countInfirmaryInjuredUnits();
        if (!totalInjured) {
            return (
                '<section class="age-infirmary-injured" aria-label="Injured roster">'
                + '<h3 class="age-infirmary-injured-title">Injured Roster</h3>'
                + '<div class="age-infirmary-injured-empty">'
                + '<p class="age-infirmary-injured-empty-copy">No injured units are resting here. Your roster is ready for the field.</p>'
                + '</div>'
                + '</section>'
            );
        }

        const summaryLabel = `${totalInjured} injured ${totalInjured === 1 ? 'unit' : 'units'} awaiting treatment`;
        return (
            '<section class="age-infirmary-injured" aria-label="Injured roster">'
            + '<div class="age-infirmary-injured-head">'
            + '<h3 class="age-infirmary-injured-title">Injured Roster</h3>'
            + `<p class="age-infirmary-injured-summary">${escapeHtml(summaryLabel)}</p>`
            + '</div>'
            + '<ul class="age-infirmary-injured-list">'
            + infirmaryInjuredStacks.map((stack) => (
                `<li class="age-infirmary-injured-row">`
                + `<span class="age-infirmary-injured-mark" aria-hidden="true">${escapeHtml(stack.mark)}</span>`
                + '<div class="age-infirmary-injured-main">'
                + `<span class="age-infirmary-injured-name">${escapeHtml(stack.name)}</span>`
                + `<span class="age-infirmary-injured-meta">${escapeHtml(stack.severity)} · ${escapeHtml(stack.recovery)}</span>`
                + '</div>'
                + `<span class="age-infirmary-injured-count">${escapeHtml(stack.injured)} injured</span>`
                + '</li>'
            )).join('')
            + '</ul>'
            + '</section>'
        );
    }

    function renderInfirmaryBody() {
        return (
            '<div class="age-infirmary-workspace">'
            + '<p class="age-settlement-venue-infirmary-copy">Restore injured units at this settlement infirmary. Maintaining readiness keeps your army field-effective.</p>'
            + renderInfirmaryInjuredList()
            + '<section class="age-infirmary-actions" aria-label="Infirmary healing actions">'
            + '<div class="age-settlement-venue-infirmary-actions">'
            + '<button type="button" class="age-settlement-venue-infirmary-btn" data-settlement-infirmary-heal="one">Heal One Unit</button>'
            + '<button type="button" class="age-settlement-venue-infirmary-btn age-settlement-venue-infirmary-btn--primary" data-settlement-infirmary-heal="all">Heal Entire Army</button>'
            + '</div>'
            + '<p id="age-settlement-infirmary-status" class="age-settlement-venue-infirmary-status" aria-live="polite"></p>'
            + '</section>'
            + '</div>'
        );
    }

    function refreshInfirmaryWorkspaceBody() {
        if (activeVenueId !== 'infirmary') return;
        const bodyEl = global.document.getElementById('age-settlement-venue-body');
        if (!bodyEl) return;
        bodyEl.innerHTML = renderInfirmaryBody();
    }

    function healFakeInfirmaryUnit(mode) {
        const healMode = String(mode || 'one').trim().toLowerCase();
        if (!infirmaryInjuredStacks.length) {
            return { healed: 0, message: 'No injured units are resting in the infirmary.' };
        }

        if (healMode === 'all') {
            const healed = countInfirmaryInjuredUnits();
            infirmaryInjuredStacks = [];
            refreshInfirmaryWorkspaceBody();
            return {
                healed,
                message: healed === 1 ? '1 unit restored to fighting strength.' : `${healed} units restored to fighting strength.`
            };
        }

        const first = infirmaryInjuredStacks[0];
        if (first.injured > 1) {
            first.injured -= 1;
        } else {
            infirmaryInjuredStacks.shift();
        }
        refreshInfirmaryWorkspaceBody();
        return { healed: 1, message: '1 unit restored to fighting strength.' };
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
        const demoResult = healFakeInfirmaryUnit(mode);
        if (statusEl) statusEl.textContent = demoResult.message;

        const api = global.RoyalArmiesAgeGuildTraining;
        if (!api?.healUnits) return;

        try {
            await api.healUnits({ mode });
            global.dispatchEvent(new CustomEvent('royalarmies:age-movement-updated'));
        } catch (error) {
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
        defenseUpgradeQueue = null;
        const venue = detail?.venue || {};
        openArmyWorkspace({
            venueId: detail?.venueId || '',
            eyebrow: 'Settlement Defense',
            title: venue.label || 'Defense',
            subtitle: venue.description || '',
            bodyHtml: renderDefenseBody(),
            showNationTreasury: true
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
        resetInfirmaryInjuredStacks();

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
        if (onDefenseWorkspaceClick(event)) return;
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

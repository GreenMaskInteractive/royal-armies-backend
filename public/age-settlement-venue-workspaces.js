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

    const HQ_DEFENSE_HOST_ID = 'age-hq-defense-upgrades-host';
    const HQ_DEFENSE_STATUS_ID = 'age-hq-defense-status';

    let defensePanelContext = { hostId: '', statusId: 'age-defense-workspace-status' };
    let hqDefenseBound = false;

    const DEFENSE_MODULES = Object.freeze([
        { id: 'walls', mark: '▣', title: 'Palisade Reinforcement', desc: 'Raises local garrison defense for this settlement.', cost: '250 RSD' },
        { id: 'towers', mark: '◈', title: 'Watch Towers', desc: 'Extends scout response time against raids.', cost: '180 RSD' },
        { id: 'stores', mark: '◆', title: 'Supply Stores', desc: 'Improves provision recovery between battles.', cost: '120 RSD' },
        { id: 'wards', mark: '✦', title: 'Arcane Wards', desc: 'Adds spell shielding to settlement defenses.', cost: '320 RSD' }
    ]);

    const INFIRMARY_UNIT_TYPE_ORDER = Object.freeze(['infantry', 'cavalry', 'artillery', 'beasts']);
    const INFIRMARY_UNIT_TYPE_LABELS = Object.freeze({
        infantry: 'Infantry',
        cavalry: 'Cavalry',
        artillery: 'Artillery',
        beasts: 'Beasts'
    });
    const INFIRMARY_PROMOTION_ORDER = Object.freeze(['elite', 'mst', 'vet', 'std', 'app']);
    const INFIRMARY_PROMOTION_LABELS = Object.freeze({
        app: 'Apprentice',
        std: 'Standard',
        vet: 'Veteran',
        mst: 'Master',
        elite: 'Elite'
    });

    const INFIRMARY_DEMO_INJURED_UNITS = Object.freeze([
        { stackId: 'shieldman-vet', mark: '🛡', name: 'Recruit Shieldman (A)', categoryId: 'infantry', tier: 1, promotion: 'vet', goldCost: 350, ticksTotal: 2, count: 2 },
        { stackId: 'shieldman-std', mark: '🛡', name: 'Recruit Shieldman (A)', categoryId: 'infantry', tier: 1, promotion: 'std', goldCost: 350, ticksTotal: 2, count: 1 },
        { stackId: 'shield-sergeant-elt', mark: '🛡', name: 'Shield Sergeant (A)', categoryId: 'infantry', tier: 2, promotion: 'elite', goldCost: 2100, ticksTotal: 3, count: 1 },
        { stackId: 'bulwark-leg', mark: '🛡', name: 'Bulwark Guard (A)', categoryId: 'infantry', tier: 4, promotion: 'leg', goldCost: 13120, ticksTotal: 3, count: 8 },
        { stackId: 'citadel-elite', mark: '🛡', name: 'Citadel Guardian (A)', categoryId: 'infantry', tier: 6, promotion: 'elite', goldCost: 66210, ticksTotal: 3, count: 2 },
        { stackId: 'lancer-vet', mark: '⚔', name: 'Royal Lancer (A/B)', categoryId: 'cavalry', tier: 3, promotion: 'vet', goldCost: 26800, ticksTotal: 2, count: 1 },
        { stackId: 'dread-knight-std', mark: '⚔', name: 'Dread Knight (A/B)', categoryId: 'cavalry', tier: 2, promotion: 'std', goldCost: 4350, ticksTotal: 3, count: 1 },
        { stackId: 'longbow-std', mark: '🏹', name: 'Longbowman (B)', categoryId: 'artillery', tier: 2, promotion: 'std', goldCost: 1220, ticksTotal: 3, count: 2 },
        { stackId: 'sentinel-mst', mark: '✦', name: 'Arcane Sentinel (A)', categoryId: 'magic-infantry', tier: 4, promotion: 'mst', goldCost: 18400, ticksTotal: 3, count: 6 },
        { stackId: 'steeljaw-vet', mark: '🐺', name: 'Steeljaw (A-1)', categoryId: 'beasts', tier: 4, promotion: 'vet', goldCost: 11500, ticksTotal: 3, count: 4 },
        { stackId: 'wolf-mst', mark: '🐺', name: 'War-Howler (A-2)', categoryId: 'beasts', tier: 3, promotion: 'mst', goldCost: 1300, ticksTotal: 3, count: 1 }
    ]);

    function resolveCommanderRank() {
        return Math.max(1, Math.floor(Number(global.player?.rank) || 1));
    }

    function resolveEquipmentRankLockReason() {
        return global.RoyalArmiesAgeGearShop?.resolveEquipmentRankLockReason?.()
            || '';
    }

    function setDefensePanelContext(hostId, statusId) {
        defensePanelContext = {
            hostId: String(hostId || '').trim(),
            statusId: String(statusId || 'age-defense-workspace-status').trim()
        };
    }

    function clearDefensePanelContext() {
        defensePanelContext = { hostId: '', statusId: 'age-defense-workspace-status' };
    }

    let bound = false;
    let infirmaryTickBound = false;
    let infirmaryGoldBound = false;
    let activeVenueId = '';
    /** @type {Array<{ id: string, stackId: string, mark: string, name: string, label: string, categoryId: string, unitType: string, tier: number, promotion: string, goldCost: number, ticksTotal: number, ticksRemaining: number }>} */
    let infirmaryInjuredUnits = [];
    /** @type {Set<string>} */
    let infirmarySelectedUnitIds = new Set();
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
        global.RoyalArmiesAgeRosterReview?.close?.();
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
        if (!wallet) return;
        wallet.hidden = true;
        wallet.classList.remove('is-visible');
    }

    function resolveCommanderGold() {
        if (global.RoyalArmiesAgeGold?.resolveAgeCommanderGold) {
            return Math.max(0, Math.floor(Number(global.RoyalArmiesAgeGold.resolveAgeCommanderGold()) || 0));
        }
        if (typeof global.resolveAgeCommanderGold === 'function') {
            return Math.max(0, Math.floor(Number(global.resolveAgeCommanderGold()) || 0));
        }
        const hudEl = global.document.getElementById('age-hud-gold');
        if (hudEl?.textContent) {
            const parsed = Number(String(hudEl.textContent).replace(/[^\d]/g, ''));
            if (Number.isFinite(parsed) && parsed >= 0) return Math.floor(parsed);
        }
        return 0;
    }

    function formatCommanderGoldDisplay(amount) {
        if (global.RoyalArmiesAgeGold?.formatAgeHudGoldDisplay) {
            return global.RoyalArmiesAgeGold.formatAgeHudGoldDisplay(amount);
        }
        return Math.max(0, Math.floor(Number(amount) || 0)).toLocaleString('en-US');
    }

    function syncInfirmaryGoldWallet() {
        const wallet = global.document.getElementById('age-settlement-venue-gold-wallet');
        const amountEl = global.document.getElementById('age-settlement-venue-gold-amount');
        if (!wallet || !amountEl) return;
        amountEl.textContent = formatCommanderGoldDisplay(resolveCommanderGold());
    }

    function hideInfirmaryGoldWallet() {
        const wallet = global.document.getElementById('age-settlement-venue-gold-wallet');
        if (!wallet) return;
        wallet.hidden = true;
        wallet.classList.remove('is-visible');
    }

    function showVenueGoldWallet() {
        const wallet = global.document.getElementById('age-settlement-venue-gold-wallet');
        if (!wallet) return;
        wallet.hidden = false;
        wallet.classList.add('is-visible');
        syncInfirmaryGoldWallet();
    }

    function showInfirmaryGoldWallet() {
        const wallet = global.document.getElementById('age-settlement-venue-gold-wallet');
        if (!wallet) return;
        wallet.hidden = false;
        wallet.classList.add('is-visible');
        syncInfirmaryGoldWallet();
    }

    async function syncSettlementVenueRsdWallet() {
        const wallet = global.document.getElementById('age-settlement-venue-rsd-wallet');
        const amountEl = global.document.getElementById('age-settlement-venue-rsd-amount');
        if (!wallet || !amountEl) return;

        wallet.hidden = false;
        wallet.classList.add('is-visible');

        const cached = global.RoyalArmiesNationTreasury?.getLastPayload?.();
        if (cached != null) {
            amountEl.textContent = formatRsdAmount(cached.rsd);
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
            clearDefensePanelContext();
        }
        activeVenueId = '';
        hideSettlementVenueRsdWallet();
        hideInfirmaryGoldWallet();
        global.document.getElementById('age-settlement-venue-body')?.classList.remove('is-gear-shop-layout');
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

        activeVenueId = String(options.venueId || '').trim();
        bodyEl.classList.toggle('is-gear-shop-layout', activeVenueId === 'blacksmith' || activeVenueId === 'armory');
        hideSettlementVenueRsdWallet();
        hideInfirmaryGoldWallet();
        if (DEFENSE_VENUE_IDS.has(activeVenueId)) {
            void syncSettlementVenueRsdWallet();
        }

        workspace.hidden = false;
        workspace.setAttribute('aria-hidden', 'false');
        setVenueWorkspaceOpen(true);

        global.document.getElementById('age-settlement-venue-close')?.focus();
    }

    function renderVenueCatalogList(items, options = {}) {
        const sectionTitle = String(options.sectionTitle || 'Available').trim();
        const sectionAriaLabel = String(options.sectionAriaLabel || sectionTitle).trim();
        const actionLabel = String(options.actionLabel || 'Select').trim();
        const actionAttr = String(options.actionAttr || 'data-army-workspace-action').trim();
        const resolveStatus = typeof options.resolveStatus === 'function' ? options.resolveStatus : null;
        const resolveDisabled = typeof options.resolveDisabled === 'function' ? options.resolveDisabled : null;

        return (
            '<section class="age-defense-upgrades" aria-label="'
            + escapeHtml(sectionAriaLabel)
            + '">'
            + '<h3 class="age-defense-upgrades-title">'
            + escapeHtml(sectionTitle)
            + '</h3>'
            + '<ul class="age-defense-upgrade-list">'
            + items.map((item) => {
                const title = String(item.title || item.label || '').trim();
                const desc = String(item.desc || '').trim();
                const cost = String(
                    item.status === 'Eligible'
                        ? (item.upgradeCost || item.cost || item.tier || '')
                        : (item.cost || item.tier || item.upgradeCost || '')
                ).trim();
                const statusText = resolveStatus ? resolveStatus(item) : '';
                const disabled = resolveDisabled?.(item) ? ' disabled' : '';
                const actionCell = statusText
                    ? `<span class="age-defense-upgrade-status">${escapeHtml(statusText)}</span>`
                    : (
                        `<button type="button" class="age-defense-upgrade-queue-btn" `
                        + `${actionAttr}="${escapeHtml(item.id)}"${disabled}>`
                        + `${escapeHtml(actionLabel)}</button>`
                    );

                return (
                    `<li class="age-defense-upgrade-row${statusText ? ' is-slot-taken' : ''}">`
                    + `<span class="age-defense-upgrade-mark" aria-hidden="true">${escapeHtml(item.mark || '•')}</span>`
                    + '<div class="age-defense-upgrade-main">'
                    + `<span class="age-defense-upgrade-title">${escapeHtml(title)}</span>`
                    + `<span class="age-defense-upgrade-desc">${escapeHtml(desc)}</span>`
                    + '</div>'
                    + `<span class="age-defense-upgrade-cost">${escapeHtml(cost)}</span>`
                    + actionCell
                    + '</li>'
                );
            }).join('')
            + '</ul>'
            + '</section>'
        );
    }

    function renderBlacksmithBody() {
        if (typeof global.RoyalArmiesAgeGearShop?.renderForgeBody === 'function') {
            return global.RoyalArmiesAgeGearShop.renderForgeBody();
        }
        return (
            '<div class="age-settlement-venue-placeholder">'
            + '<p class="age-settlement-venue-placeholder-copy">Forge catalog is loading. Refresh the page if this message persists.</p>'
            + '</div>'
        );
    }

    function renderArmoryBody() {
        if (typeof global.RoyalArmiesAgeGearShop?.renderArmoryBody === 'function') {
            return global.RoyalArmiesAgeGearShop.renderArmoryBody();
        }
        return (
            '<div class="age-settlement-venue-placeholder">'
            + '<p class="age-settlement-venue-placeholder-copy">Armory upgrades are loading. Refresh the page if this message persists.</p>'
            + '</div>'
        );
    }

    function findDefenseModule(moduleId) {
        return DEFENSE_MODULES.find((entry) => entry.id === moduleId) || null;
    }

    function setDefenseWorkspaceStatus(message, isError) {
        const statusEl = global.document.getElementById(defensePanelContext.statusId || 'age-defense-workspace-status');
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

    function renderDefenseBody(options = {}) {
        const statusId = String(options.statusId || defensePanelContext.statusId || 'age-defense-workspace-status').trim();
        return (
            '<div class="age-defense-workspace">'
            + '<p class="age-army-workspace-toolbar-note">Invest nation treasury RSD in settlement defenses. Only one upgrade can be queued at a time; additional choices unlock after the queue clears.</p>'
            + renderDefenseQueueSlot()
            + renderDefenseUpgradeList()
            + `<p id="${escapeHtml(statusId)}" class="age-defense-workspace-status" aria-live="polite" hidden></p>`
            + '</div>'
        );
    }

    function refreshDefensePanel(hostId, statusId) {
        const host = global.document.getElementById(hostId);
        if (!host) return;
        setDefensePanelContext(hostId, statusId);
        host.innerHTML = renderDefenseBody({ statusId });
    }

    function refreshDefenseWorkspaceBody() {
        if (defensePanelContext.hostId) {
            refreshDefensePanel(defensePanelContext.hostId, defensePanelContext.statusId);
            return;
        }

        if (!DEFENSE_VENUE_IDS.has(activeVenueId)) return;
        const bodyEl = global.document.getElementById('age-settlement-venue-body');
        if (!bodyEl) return;
        bodyEl.innerHTML = renderDefenseBody();
    }

    function mountHeadquartersDefensePanel() {
        const host = global.document.getElementById(HQ_DEFENSE_HOST_ID);
        if (!host) return;

        refreshDefensePanel(HQ_DEFENSE_HOST_ID, HQ_DEFENSE_STATUS_ID);

        if (!hqDefenseBound) {
            hqDefenseBound = true;
            host.addEventListener('click', onHeadquartersDefenseClick);
        }
    }

    function onHeadquartersDefenseClick(event) {
        setDefensePanelContext(HQ_DEFENSE_HOST_ID, HQ_DEFENSE_STATUS_ID);
        onDefenseWorkspaceClick(event);
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
        const inHq = Boolean(event.target.closest(`#${HQ_DEFENSE_HOST_ID}`));
        const inSettlement = DEFENSE_VENUE_IDS.has(activeVenueId);
        if (!inHq && !inSettlement) return false;

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
        if (typeof global.RoyalArmiesBanner?.buildChurchWorkspaceHtml === 'function') {
            return global.RoyalArmiesBanner.buildChurchWorkspaceHtml();
        }
        return (
            '<div class="age-settlement-venue-placeholder">'
            + '<p class="age-settlement-venue-placeholder-copy">Church blessings are loading. Refresh the page if this message persists.</p>'
            + '</div>'
        );
    }

    function refreshChurchWorkspaceBody() {
        if (activeVenueId !== 'church') return;
        const bodyEl = global.document.getElementById('age-settlement-venue-body');
        if (!bodyEl) return;
        bodyEl.innerHTML = renderChurchBody();
    }

    function resolveInfirmaryUnitType(categoryId) {
        const raw = String(categoryId || '').trim().toLowerCase();
        if (raw.startsWith('magic-')) return raw.slice('magic-'.length);
        return raw;
    }

    function resolveInfirmaryPromotionLabel(promotion) {
        const key = String(promotion || '').trim().toLowerCase();
        return INFIRMARY_PROMOTION_LABELS[key] || key.toUpperCase();
    }

    function compareInfirmaryPromotionRank(left, right) {
        const leftIndex = INFIRMARY_PROMOTION_ORDER.indexOf(String(left || '').toLowerCase());
        const rightIndex = INFIRMARY_PROMOTION_ORDER.indexOf(String(right || '').toLowerCase());
        return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex);
    }

    function sortInfirmaryUnitsByPromotion(units) {
        return [...units].sort((left, right) => {
            const rankOrder = compareInfirmaryPromotionRank(left.promotion, right.promotion);
            if (rankOrder !== 0) return rankOrder;
            const nameOrder = String(left.name || '').localeCompare(String(right.name || ''));
            if (nameOrder !== 0) return nameOrder;
            return String(left.id || '').localeCompare(String(right.id || ''));
        });
    }

    function infirmaryRecoveryApi() {
        return global.RoyalArmiesInfirmaryRecovery || null;
    }

    function resolveInfirmaryUnitHealCost(unit) {
        const api = infirmaryRecoveryApi();
        if (api?.resolveInfirmaryHealCost) {
            return api.resolveInfirmaryHealCost(unit);
        }
        return Math.max(0, Math.floor(Number(unit?.goldCost) || 0));
    }

    function formatInfirmaryHealGold(amount) {
        const api = infirmaryRecoveryApi();
        if (api?.formatInfirmaryGold) {
            return api.formatInfirmaryGold(amount);
        }
        return `${Math.max(0, Math.floor(Number(amount) || 0)).toLocaleString('en-US')} gold`;
    }

    function formatInfirmaryTicksRemaining(ticksRemaining) {
        const api = infirmaryRecoveryApi();
        if (api?.formatTicksRemaining) {
            return api.formatTicksRemaining(ticksRemaining);
        }
        const ticks = Math.max(0, Math.floor(Number(ticksRemaining) || 0));
        return ticks === 1 ? '1 tick' : `${ticks} ticks`;
    }

    function sumSelectedInfirmaryHealCost() {
        const selected = infirmaryInjuredUnits.filter((unit) => infirmarySelectedUnitIds.has(unit.id));
        const api = infirmaryRecoveryApi();
        if (api?.sumInfirmaryHealCosts) {
            return api.sumInfirmaryHealCosts(selected);
        }
        return selected.reduce((sum, unit) => sum + resolveInfirmaryUnitHealCost(unit), 0);
    }

    function sumAllInfirmaryHealCost() {
        const api = infirmaryRecoveryApi();
        if (api?.sumInfirmaryHealCosts) {
            return api.sumInfirmaryHealCosts(infirmaryInjuredUnits);
        }
        return infirmaryInjuredUnits.reduce((sum, unit) => sum + resolveInfirmaryUnitHealCost(unit), 0);
    }

    function buildInfirmaryUnitRoster() {
        const units = [];
        INFIRMARY_DEMO_INJURED_UNITS.forEach((stack) => {
            const count = Math.max(0, Math.floor(Number(stack.count) || 0));
            const unitType = resolveInfirmaryUnitType(stack.categoryId);
            const tier = Math.max(1, Math.floor(Number(stack.tier) || 1));
            const promotion = String(stack.promotion || 'std').trim().toLowerCase();
            const goldCost = Math.max(0, Math.floor(Number(stack.goldCost) || 0));
            const ticksTotal = Math.max(1, Math.floor(Number(stack.ticksTotal) || 1));
            for (let index = 0; index < count; index += 1) {
                const slot = index + 1;
                units.push({
                    id: `${stack.stackId}-${slot}`,
                    stackId: stack.stackId,
                    mark: stack.mark,
                    name: stack.name,
                    label: count > 1 ? `${stack.name} #${slot}` : stack.name,
                    categoryId: stack.categoryId,
                    unitType,
                    tier,
                    promotion,
                    goldCost,
                    ticksTotal,
                    ticksRemaining: ticksTotal
                });
            }
        });
        return units;
    }

    function advanceInfirmaryRecoveryTicks(stepCount = 1) {
        const step = Math.max(1, Math.floor(Number(stepCount) || 1));
        if (!infirmaryInjuredUnits.length) return { recovered: 0 };

        let recovered = 0;
        infirmaryInjuredUnits = infirmaryInjuredUnits.flatMap((unit) => {
            const nextRemaining = Math.max(0, Math.floor(Number(unit.ticksRemaining) || 0) - step);
            if (nextRemaining <= 0) {
                recovered += 1;
                infirmarySelectedUnitIds.delete(unit.id);
                return [];
            }
            return [{ ...unit, ticksRemaining: nextRemaining }];
        });

        if (activeVenueId === 'infirmary') {
            refreshInfirmaryWorkspaceBody();
        }
        return { recovered };
    }

    function onInfirmaryGameTick() {
        advanceInfirmaryRecoveryTicks(1);
    }

    function groupInfirmaryUnitsForDisplay(units) {
        const typeMap = new Map();

        units.forEach((unit) => {
            const unitType = unit.unitType || resolveInfirmaryUnitType(unit.categoryId);
            if (!typeMap.has(unitType)) {
                typeMap.set(unitType, new Map());
            }
            const tierMap = typeMap.get(unitType);
            const tier = Math.max(1, Math.floor(Number(unit.tier) || 1));
            if (!tierMap.has(tier)) {
                tierMap.set(tier, []);
            }
            tierMap.get(tier).push(unit);
        });

        return INFIRMARY_UNIT_TYPE_ORDER
            .filter((unitType) => typeMap.has(unitType))
            .map((unitType) => {
                const tierMap = typeMap.get(unitType);
                const tiers = [...tierMap.keys()]
                    .sort((left, right) => right - left)
                    .map((tier) => ({
                        tier,
                        units: sortInfirmaryUnitsByPromotion(tierMap.get(tier))
                    }));
                return {
                    unitType,
                    typeLabel: INFIRMARY_UNIT_TYPE_LABELS[unitType] || unitType,
                    tiers
                };
            });
    }

    function resetInfirmaryInjuredStacks() {
        infirmaryInjuredUnits = buildInfirmaryUnitRoster();
        infirmarySelectedUnitIds = new Set();
    }

    function countInfirmaryInjuredUnits() {
        return infirmaryInjuredUnits.length;
    }

    function countInfirmarySelectedUnits() {
        return infirmaryInjuredUnits.filter((unit) => infirmarySelectedUnitIds.has(unit.id)).length;
    }

    function formatInfirmarySelectionSummary() {
        const totalInjured = countInfirmaryInjuredUnits();
        const selectedCount = countInfirmarySelectedUnits();
        if (!totalInjured) return '';
        if (!selectedCount) {
            return `${totalInjured} injured ${totalInjured === 1 ? 'unit' : 'units'} · heal gold drops each tick · click to select`;
        }
        return `${selectedCount} selected · ${formatInfirmaryHealGold(sumSelectedInfirmaryHealCost())} · ${totalInjured} injured total`;
    }

    function renderInfirmaryUnitRow(unit) {
        const isSelected = infirmarySelectedUnitIds.has(unit.id);
        const healCost = resolveInfirmaryUnitHealCost(unit);
        const tickLabel = formatInfirmaryTicksRemaining(unit.ticksRemaining);
        const healGoldLabel = formatInfirmaryHealGold(healCost);
        return (
            `<li class="age-infirmary-injured-item" role="presentation">`
            + `<button type="button" class="age-infirmary-injured-row${isSelected ? ' is-selected' : ''}"`
            + ` data-infirmary-unit-id="${escapeHtml(unit.id)}"`
            + ` role="option"`
            + ` aria-selected="${isSelected ? 'true' : 'false'}"`
            + ` aria-label="${escapeHtml(unit.label)} — ${escapeHtml(resolveInfirmaryPromotionLabel(unit.promotion))} — ${escapeHtml(tickLabel)} — ${escapeHtml(healGoldLabel)}">`
            + `<span class="age-infirmary-injured-mark" aria-hidden="true">${escapeHtml(unit.mark)}</span>`
            + '<div class="age-infirmary-injured-main">'
            + `<span class="age-infirmary-injured-name">${escapeHtml(unit.label)}</span>`
            + `<span class="age-infirmary-injured-meta">${escapeHtml(resolveInfirmaryPromotionLabel(unit.promotion))} · ${escapeHtml(tickLabel)} · ${escapeHtml(healGoldLabel)}</span>`
            + '</div>'
            + `<span class="age-infirmary-injured-status">${isSelected ? 'Selected' : 'Injured'}</span>`
            + '</button>'
            + '</li>'
        );
    }

    function renderInfirmaryGroupedRoster() {
        const groups = groupInfirmaryUnitsForDisplay(infirmaryInjuredUnits);
        return groups.map((typeGroup) => (
            '<section class="age-infirmary-type-group"'
            + ` aria-label="${escapeHtml(typeGroup.typeLabel)} injured units">`
            + `<h4 class="age-infirmary-type-title">${escapeHtml(typeGroup.typeLabel)}</h4>`
            + typeGroup.tiers.map((tierGroup) => (
                '<section class="age-infirmary-tier-group"'
                + ` aria-label="Tier ${escapeHtml(tierGroup.tier)} ${escapeHtml(typeGroup.typeLabel)}">`
                + `<h5 class="age-infirmary-tier-title">Tier ${escapeHtml(tierGroup.tier)}</h5>`
                + '<ul class="age-infirmary-injured-list" role="listbox"'
                + ` aria-label="Tier ${escapeHtml(tierGroup.tier)} injured units" aria-multiselectable="true">`
                + tierGroup.units.map((unit) => renderInfirmaryUnitRow(unit)).join('')
                + '</ul>'
                + '</section>'
            )).join('')
            + '</section>'
        )).join('');
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

        const selectedCount = countInfirmarySelectedUnits();
        const selectedCostLabel = selectedCount
            ? ` · ${formatInfirmaryHealGold(sumSelectedInfirmaryHealCost())}`
            : '';
        return (
            '<section class="age-infirmary-injured" aria-label="Injured roster">'
            + '<div class="age-infirmary-injured-head">'
            + '<h3 class="age-infirmary-injured-title">Injured Roster</h3>'
            + `<p class="age-infirmary-injured-summary">${escapeHtml(formatInfirmarySelectionSummary())}</p>`
            + '</div>'
            + '<div class="age-infirmary-grouped-roster">'
            + renderInfirmaryGroupedRoster()
            + '</div>'
            + '<section class="age-infirmary-heal-toolbar" aria-label="Heal selected units">'
            + `<button type="button" class="age-settlement-venue-infirmary-btn age-settlement-venue-infirmary-btn--primary"`
            + ` data-settlement-infirmary-heal="selected"${selectedCount ? '' : ' disabled'}>`
            + `Heal Selected${selectedCount ? ` (${selectedCount})${selectedCostLabel}` : ''}</button>`
            + '</section>'
            + '</section>'
        );
    }

    function renderInfirmaryBody() {
        const allCostLabel = formatInfirmaryHealGold(sumAllInfirmaryHealCost());
        return (
            '<div class="age-infirmary-workspace">'
            + '<p class="age-settlement-venue-infirmary-copy">Restore injured units at this settlement infirmary. Each unit\'s heal gold rises with tier and how many recovery ticks the wound needs—no single unit exceeds five hundred thousand gold, but full high-tier rosters can still total millions—then costs drop each tick until the final tick before natural recovery (10% above catalog purchase cost), and units recover for free.</p>'
            + renderInfirmaryInjuredList()
            + '<section class="age-infirmary-actions" aria-label="Infirmary healing actions">'
            + '<div class="age-settlement-venue-infirmary-actions">'
            + `<button type="button" class="age-settlement-venue-infirmary-btn" data-settlement-infirmary-heal="all">Heal Entire Army · ${escapeHtml(allCostLabel)}</button>`
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
        syncInfirmaryGoldWallet();
    }

    function toggleInfirmaryUnitSelection(unitId) {
        const id = String(unitId || '').trim();
        if (!id || !infirmaryInjuredUnits.some((unit) => unit.id === id)) return;

        if (infirmarySelectedUnitIds.has(id)) {
            infirmarySelectedUnitIds.delete(id);
        } else {
            infirmarySelectedUnitIds.add(id);
        }
        refreshInfirmaryWorkspaceBody();
    }

    function healFakeInfirmaryUnit(mode) {
        const healMode = String(mode || 'selected').trim().toLowerCase();
        if (!infirmaryInjuredUnits.length) {
            return { healed: 0, message: 'No injured units are resting in the infirmary.' };
        }

        const commanderGold = resolveCommanderGold();

        if (healMode === 'all') {
            const healed = countInfirmaryInjuredUnits();
            const goldSpent = sumAllInfirmaryHealCost();
            if (goldSpent > commanderGold) {
                return {
                    healed: 0,
                    message: `Not enough gold. Heal entire army costs ${formatInfirmaryHealGold(goldSpent)}.`
                };
            }
            infirmaryInjuredUnits = [];
            infirmarySelectedUnitIds = new Set();
            if (goldSpent > 0) {
                global.RoyalArmiesAgeGold?.applyAgeCommanderGoldDelta?.(-goldSpent, { source: 'infirmary-heal' });
            }
            refreshInfirmaryWorkspaceBody();
            const countLabel = healed === 1 ? '1 unit' : `${healed} units`;
            return {
                healed,
                goldSpent,
                message: `${countLabel} restored for ${formatInfirmaryHealGold(goldSpent)}.`
            };
        }

        const selectedUnits = infirmaryInjuredUnits.filter((unit) => infirmarySelectedUnitIds.has(unit.id));
        if (!selectedUnits.length) {
            return { healed: 0, goldSpent: 0, message: 'Select injured units to heal, then choose Heal Selected.' };
        }

        const goldSpent = sumSelectedInfirmaryHealCost();
        if (goldSpent > commanderGold) {
            return {
                healed: 0,
                goldSpent: 0,
                message: `Not enough gold. Selected heals cost ${formatInfirmaryHealGold(goldSpent)}.`
            };
        }
        const selectedIdSet = new Set(selectedUnits.map((unit) => unit.id));
        infirmaryInjuredUnits = infirmaryInjuredUnits.filter((unit) => !selectedIdSet.has(unit.id));
        infirmarySelectedUnitIds = new Set(
            [...infirmarySelectedUnitIds].filter((id) => !selectedIdSet.has(id))
        );
        if (goldSpent > 0) {
            global.RoyalArmiesAgeGold?.applyAgeCommanderGoldDelta?.(-goldSpent, { source: 'infirmary-heal' });
        }
        refreshInfirmaryWorkspaceBody();

        const healed = selectedUnits.length;
        const countLabel = healed === 1 ? '1 unit' : `${healed} units`;
        return {
            healed,
            goldSpent,
            message: `${countLabel} restored for ${formatInfirmaryHealGold(goldSpent)}.`
        };
    }

    function renderPlaceholderBody(note) {
        return (
            '<div class="age-settlement-venue-placeholder">'
            + `<p class="age-settlement-venue-placeholder-copy">${escapeHtml(note)}</p>`
            + '</div>'
        );
    }

    async function healAtInfirmary(mode) {
        const healMode = String(mode || 'selected').trim().toLowerCase();
        const statusEl = global.document.getElementById('age-settlement-infirmary-status');
        const demoResult = healFakeInfirmaryUnit(healMode);
        if (statusEl) statusEl.textContent = demoResult.message;
        if (!demoResult.healed) return;

        const api = global.RoyalArmiesAgeGuildTraining;
        if (!api?.healUnits) return;

        const apiMode = healMode === 'all' ? 'all' : 'one';
        try {
            if (apiMode === 'all') {
                await api.healUnits({ mode: 'all' });
            } else {
                for (let index = 0; index < demoResult.healed; index += 1) {
                    await api.healUnits({ mode: 'one' });
                }
            }
            global.dispatchEvent(new CustomEvent('royalarmies:age-movement-updated'));
        } catch (error) {
            if (typeof global.showRiftError === 'function' && error?.code) {
                global.showRiftError(error.code, error.message);
            }
        }
    }

    function openBlacksmith(detail) {
        const lockReason = resolveEquipmentRankLockReason();
        if (lockReason) {
            if (typeof global.showPortalAlert === 'function') {
                void global.showPortalAlert(lockReason, 'Blacksmith');
            }
            return;
        }

        const venue = detail?.venue || {};
        const tier = String(detail?.settlementTier || 'city').trim().toLowerCase();
        const eyebrow = global.RoyalArmiesAgeGearShop?.resolveForgeEyebrow?.(tier) || 'Blacksmith';
        openArmyWorkspace({
            venueId: 'blacksmith',
            eyebrow,
            title: venue.label || eyebrow,
            subtitle: venue.description || '',
            bodyHtml: renderBlacksmithBody()
        });
        showVenueGoldWallet();
        if (activeVenueId === 'blacksmith') {
            global.RoyalArmiesAgeGearShop?.refreshActiveBody?.('blacksmith');
        }
    }

    function openArmory(detail) {
        const lockReason = resolveEquipmentRankLockReason();
        if (lockReason) {
            if (typeof global.showPortalAlert === 'function') {
                void global.showPortalAlert(lockReason, 'Armory');
            }
            return;
        }

        const venue = detail?.venue || {};
        const tier = String(detail?.settlementTier || 'city').trim().toLowerCase();
        const eyebrow = global.RoyalArmiesAgeGearShop?.resolveArmoryEyebrow?.(tier) || 'Armory';
        openArmyWorkspace({
            venueId: 'armory',
            eyebrow,
            title: venue.label || eyebrow,
            subtitle: venue.description || '',
            bodyHtml: renderArmoryBody()
        });
        showVenueGoldWallet();
        if (activeVenueId === 'armory') {
            global.RoyalArmiesAgeGearShop?.refreshActiveBody?.('armory');
        }
    }

    function openDefenseVenue(detail) {
        const venue = detail?.venue || {};
        setDefensePanelContext('age-settlement-venue-body', 'age-defense-workspace-status');
        openArmyWorkspace({
            venueId: detail?.venueId || '',
            eyebrow: 'Settlement Defense',
            title: venue.label || 'Defense',
            subtitle: venue.description || '',
            bodyHtml: renderDefenseBody()
        });
    }

    function resolveChurchRankLockReason() {
        const rank = resolveCommanderRank();
        const churchMinRank = 7;
        if (rank >= churchMinRank) return '';

        const rankTitles = global.RoyalArmiesCommanderRankTitles;
        const meta = rankTitles?.resolveSelfCommanderRankMeta?.() || {};
        const thresholdLabel = rankTitles?.formatCommanderRankLabel
            ? rankTitles.formatCommanderRankLabel(churchMinRank, meta.path, meta.rankTitleGender)
            : `rank ${churchMinRank}`;
        return `Unlocks at ${thresholdLabel}.`;
    }

    function openChurch(detail) {
        const lockReason = resolveChurchRankLockReason();
        if (lockReason) {
            if (typeof global.showPortalAlert === 'function') {
                void global.showPortalAlert(lockReason, 'Church');
            }
            return;
        }

        const venue = detail?.venue || {};
        openArmyWorkspace({
            venueId: 'church',
            eyebrow: 'Church',
            title: venue.label || 'Church',
            subtitle: venue.description || '',
            bodyHtml: renderChurchBody()
        });
        if (typeof global.RoyalArmiesBanner?.refreshArmyAdvisor === 'function') {
            void global.RoyalArmiesBanner.refreshArmyAdvisor().then(() => {
                refreshChurchWorkspaceBody();
            });
        }
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
        showInfirmaryGoldWallet();
    }

    function onInfirmaryGoldUpdated() {
        if (activeVenueId === 'infirmary') {
            syncInfirmaryGoldWallet();
            return;
        }
        if (activeVenueId === 'blacksmith' || activeVenueId === 'armory') {
            syncInfirmaryGoldWallet();
        }
    }

    function openPlaceholderVenue(detail) {
        const venue = detail?.venue || {};
        let placeholderNote = venue?.placeholderNote
            || 'This workspace is under construction. Check back after the next Age of War update.';

        if (detail?.venueId === 'arenas') {
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
        if (global.RoyalArmiesAgeGearShop?.onGearShopClick?.(event, activeVenueId)) {
            return;
        }

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
        if (activeVenueId !== 'infirmary') return false;

        const unitBtn = event.target.closest('[data-infirmary-unit-id]');
        if (unitBtn) {
            event.preventDefault();
            toggleInfirmaryUnitSelection(unitBtn.getAttribute('data-infirmary-unit-id'));
            return true;
        }

        const healBtn = event.target.closest('[data-settlement-infirmary-heal]');
        if (!healBtn || healBtn.disabled) return false;
        event.preventDefault();
        void healAtInfirmary(healBtn.getAttribute('data-settlement-infirmary-heal'));
        return true;
    }

    function onVenueWorkspaceClick(event) {
        if (event.target.closest('#age-settlement-venue-close')) {
            event.preventDefault();
            closeArmyWorkspace();
            return;
        }
        if (onDefenseWorkspaceClick(event)) return;
        if (onInfirmaryClick(event)) return;
        onArmyWorkspaceActionClick(event);
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

        if (!infirmaryTickBound) {
            infirmaryTickBound = true;
            global.addEventListener('royalarmies:age-game-tick', onInfirmaryGameTick);
        }

        if (!infirmaryGoldBound) {
            infirmaryGoldBound = true;
            global.addEventListener(
                global.RoyalArmiesAgeGold?.AGE_GOLD_UPDATED_EVENT || 'royalarmies:age-gold-updated',
                onInfirmaryGoldUpdated
            );
        }

        global.addEventListener('royalarmies:church-blessing-ui-refresh', refreshChurchWorkspaceBody);
        global.addEventListener('royalarmies:banner-advisor-updated', refreshChurchWorkspaceBody);
    }

    function enableAgeSettlementVenueWorkspaces() {
        if (!resolveVenueWorkspace()) return;
        bindSettlementVenueWorkspaces();
    }

    global.RoyalArmiesSettlementVenueWorkspaces = {
        open: openVenue,
        close: closeArmyWorkspace,
        dismissAll: dismissAllWorkspaces,
        enableAgeSettlementVenueWorkspaces,
        getActiveVenueId: () => activeVenueId
    };
    global.RoyalArmiesSettlementDefense = {
        mountHeadquartersPanel: mountHeadquartersDefensePanel,
        refreshHeadquartersPanel: () => refreshDefensePanel(HQ_DEFENSE_HOST_ID, HQ_DEFENSE_STATUS_ID)
    };
    global.enableAgeSettlementVenueWorkspaces = enableAgeSettlementVenueWorkspaces;
})(window);

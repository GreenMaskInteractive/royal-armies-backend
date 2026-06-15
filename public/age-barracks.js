/**
 * RIFT — Age Barracks (unit purchase catalog UI).
 */
(function initAgeBarracks(global) {
    'use strict';

    const catalogApi = () => global.RoyalArmiesUnitPurchaseCatalog;

    let bound = false;
    let catalog = null;
    let activeCategoryId = 'infantry';
    let selectedUnitId = '';
    let selectedPurchasePreset = '1';
    let purchaseInFlight = false;
    let purchaseMessage = '';
    let garrisonMenuExpanded = false;

    const GARRISON_MENU_OPTIONS = Object.freeze([
        {
            id: 'registry',
            label: 'Garrison Registry',
            description: 'Recruit units and review promotion paths.'
        },
        {
            id: 'evolution',
            label: 'Unit Evolution Workspace',
            description: 'Spend provisions on rank promotions and tier evolutions.'
        }
    ]);

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getCommanderContext() {
        const api = catalogApi();
        return api?.resolveCommanderRecruitmentContext?.() || {
            rank: 1,
            path: 'PHYS',
            classId: 'battlemaster',
            classLabel: 'Battlemaster'
        };
    }

    function formatCommanderRankLabel(rank, options = {}) {
        const commander = getCommanderContext();
        const rankTitles = global.RoyalArmiesCommanderRankTitles;
        const path = options.path ?? commander.path ?? 'PHYS';
        const rankTitleGender = options.rankTitleGender ?? commander.rankTitleGender;
        if (rankTitles?.formatCommanderRankLabel) {
            return rankTitles.formatCommanderRankLabel(rank, path, rankTitleGender);
        }
        if (rankTitles?.getCommanderRankDisplayTitle) {
            const title = rankTitles.getCommanderRankDisplayTitle(rank, path, rankTitleGender);
            if (title) return title;
        }
        return String(Math.max(1, Math.floor(Number(rank) || 1)));
    }

    function getCatalogOptions() {
        return { filterByClass: true, commander: getCommanderContext() };
    }

    function parseDisplayNumber(raw) {
        const parsed = Number(String(raw ?? '').replace(/[^\d]/g, ''));
        return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
    }

    function parseDisplayGold(raw) {
        return parseDisplayNumber(raw);
    }

    function resolveCommanderProvisions() {
        if (global.RoyalArmiesAgeProvisions?.resolveAgeCommanderProvisions) {
            return global.RoyalArmiesAgeProvisions.resolveAgeCommanderProvisions();
        }
        if (typeof global.resolveAgeCommanderProvisions === 'function') {
            return global.resolveAgeCommanderProvisions();
        }

        const hudEl = global.document.getElementById('age-hud-provisions');
        if (hudEl?.textContent) {
            const fromHud = parseDisplayNumber(hudEl.textContent);
            if (fromHud != null) return fromHud;
        }
        return 132;
    }

    function resolveCommanderGold() {
        const hudEl = global.document.getElementById('age-hud-gold');
        if (hudEl?.textContent) {
            const fromHud = parseDisplayGold(hudEl.textContent);
            if (fromHud != null) return fromHud;
        }

        if (global.RoyalArmiesAgeGold?.resolveAgeCommanderGold) {
            return global.RoyalArmiesAgeGold.resolveAgeCommanderGold();
        }
        if (typeof global.resolveAgeCommanderGold === 'function') {
            return global.resolveAgeCommanderGold();
        }
        return 20000;
    }

    function computeMaxAffordableByGold(gold, unitCost) {
        const cost = Math.max(0, Math.floor(Number(unitCost) || 0));
        if (!cost) return 0;
        return Math.floor(Math.max(0, Number(gold) || 0) / cost);
    }

    function computeMaxAffordableByProvisions(provisions, upcPerUnit) {
        const upc = Math.max(0, Math.floor(Number(upcPerUnit) || 0));
        if (!upc) return 0;
        return Math.floor(Math.max(0, Number(provisions) || 0) / upc);
    }

    function resolveMaxRecruitQuantityForUnit(unit) {
        const api = catalogApi();
        if (api?.resolveMaxRecruitBatchQuantity) {
            return api.resolveMaxRecruitBatchQuantity(unit, catalog);
        }
        return global.RoyalArmiesAgeRecruitment?.MAX_RECRUIT_QUANTITY || 15;
    }

    function isSwarmRecruitUnit(unit) {
        const api = catalogApi();
        if (api?.isSwarmRecruitUnit) {
            return api.isSwarmRecruitUnit(unit, catalog);
        }
        return Math.max(1, Math.floor(Number(unit?.tier) || 1)) === 1;
    }

    function computeMaxAffordable(gold, unitCost, provisions, upcPerUnit, unit) {
        const byGold = computeMaxAffordableByGold(gold, unitCost);
        const byProvisions = computeMaxAffordableByProvisions(provisions, upcPerUnit);
        if (!byGold || !byProvisions) return 0;
        return Math.min(resolveMaxRecruitQuantityForUnit(unit), byGold, byProvisions);
    }

    function resolvePurchaseQuantity(preset, gold, unitCost, provisions, upcPerUnit, unit) {
        const maxAffordable = computeMaxAffordable(gold, unitCost, provisions, upcPerUnit, unit);
        if (!maxAffordable) return 0;

        const normalizedPreset = String(preset || '').trim().toLowerCase();
        if (normalizedPreset === 'max') {
            return maxAffordable;
        }

        const requested = Math.max(1, Math.floor(Number(normalizedPreset) || 0));
        if (!requested) return 0;
        return Math.min(requested, maxAffordable);
    }

    function syncCommanderStatus() {
        const statusEl = global.document.getElementById('age-barracks-commander-status');
        if (!statusEl) return;

        const commander = getCommanderContext();
        statusEl.textContent = `${commander.classLabel} · ${formatCommanderRankLabel(commander.rank)}`;
    }

    function syncCommanderGold() {
        const goldEl = global.document.getElementById('age-barracks-commander-gold');
        if (!goldEl) return;

        const api = catalogApi();
        const gold = resolveCommanderGold();
        goldEl.textContent = api?.formatGold ? api.formatGold(gold) : gold.toLocaleString('en-US');
    }

    function syncCommanderProvisions() {
        const provisionsEl = global.document.getElementById('age-barracks-commander-provisions');
        if (!provisionsEl) return;

        const provisions = resolveCommanderProvisions();
        provisionsEl.textContent = provisions.toLocaleString('en-US');
    }

    function ensureValidActiveCategory() {
        if (!catalog) return;

        const api = catalogApi();
        const categories = api.getCategories(catalog, getCatalogOptions());
        if (!categories.length) return;

        if (!categories.some((category) => category.id === activeCategoryId)) {
            activeCategoryId = categories[0].id;
            selectedUnitId = '';
        }
    }

    function resolveWorkspace() {
        return global.document.getElementById('age-barracks-workspace');
    }

    function resolveGarrisonMenuWrap() {
        return global.document.querySelector('.age-settlement-menu-garrison-wrap');
    }

    function resolveGarrisonOptionsContainer() {
        return global.document.getElementById('age-settlement-garrison-options');
    }

    function renderSettlementGarrisonOptions() {
        const optionsEl = resolveGarrisonOptionsContainer();
        if (!optionsEl) return;

        optionsEl.innerHTML = GARRISON_MENU_OPTIONS.map((option) => (
            `<button type="button" class="age-settlement-garrison-option" data-garrison-option="${escapeHtml(option.id)}">`
            + `<span class="age-settlement-garrison-option-label">${escapeHtml(option.label)}</span>`
            + `<span class="age-settlement-garrison-option-desc">${escapeHtml(option.description)}</span>`
            + '</button>'
        )).join('');
    }

    function syncSettlementMenuGarrison() {
        const wrap = resolveGarrisonMenuWrap();
        const optionsEl = resolveGarrisonOptionsContainer();
        const toggleBtn = wrap?.querySelector('[data-settlement-venue="barracks"]');
        if (!wrap || !optionsEl) return;

        if (garrisonMenuExpanded) {
            wrap.classList.add('is-expanded');
            optionsEl.hidden = false;
            toggleBtn?.setAttribute('aria-expanded', 'true');
            renderSettlementGarrisonOptions();
            return;
        }

        wrap.classList.remove('is-expanded');
        optionsEl.hidden = true;
        toggleBtn?.setAttribute('aria-expanded', 'false');
    }

    function toggleSettlementGarrisonMenu() {
        garrisonMenuExpanded = !garrisonMenuExpanded;
        syncSettlementMenuGarrison();
    }

    function openGarrisonMenuOption(optionId) {
        garrisonMenuExpanded = false;
        syncSettlementMenuGarrison();

        const normalized = String(optionId || '').trim().toLowerCase();
        if (normalized === 'registry') {
            void open();
            return;
        }
        if (normalized === 'evolution') {
            global.RoyalArmiesAgeUnitEvolution?.open({ highlightReady: true });
        }
    }

    function isOpen() {
        const workspace = resolveWorkspace();
        return Boolean(workspace && !workspace.hidden);
    }

    function buildPurchaseQuote(unit) {
        const api = catalogApi();
        const gold = resolveCommanderGold();
        const provisions = resolveCommanderProvisions();
        const unitCost = Math.max(0, Math.floor(Number(unit?.goldCost) || 0));
        const upcPerUnit = api?.resolveRecruitUnitUpc ? api.resolveRecruitUnitUpc(unit) : 0;
        const maxByGold = computeMaxAffordableByGold(gold, unitCost);
        const maxByProvisions = computeMaxAffordableByProvisions(provisions, upcPerUnit);
        const maxAffordable = computeMaxAffordable(gold, unitCost, provisions, upcPerUnit, unit);
        const quantity = resolvePurchaseQuantity(
            selectedPurchasePreset,
            gold,
            unitCost,
            provisions,
            upcPerUnit,
            unit
        );
        const totalGoldCost = unitCost * quantity;
        const totalProvisionsCost = upcPerUnit * quantity;
        const batchCap = resolveMaxRecruitQuantityForUnit(unit);
        const swarmRecruit = isSwarmRecruitUnit(unit);
        const rawMax = Math.min(
            maxByGold || 0,
            maxByProvisions || 0
        );
        const limitedByBatch = !swarmRecruit && rawMax > batchCap && maxAffordable === batchCap;
        const limitedByProvisions = !limitedByBatch
            && maxByProvisions > 0
            && maxByProvisions <= maxByGold;

        return {
            gold,
            provisions,
            unitCost,
            upcPerUnit,
            maxByGold,
            maxByProvisions,
            maxAffordable,
            batchCap,
            swarmRecruit,
            limitedByBatch,
            limitedByProvisions,
            quantity,
            totalGoldCost,
            totalProvisionsCost,
            canAffordAny: maxAffordable > 0,
            canAffordSelection: quantity > 0
                && totalGoldCost <= gold
                && totalProvisionsCost <= provisions,
            formatGold: (value) => (api?.formatGold ? api.formatGold(value) : String(value))
        };
    }

    function renderPurchaseControls(unit, access) {
        if (!access.allowed) {
            return (
                `<div class="age-barracks-detail-actions">`
                + `<button type="button" class="age-barracks-purchase-btn" disabled`
                + ` title="${escapeHtml(access.reason)}">${escapeHtml(access.reason)}</button>`
                + '</div>'
            );
        }

        const quote = buildPurchaseQuote(unit);
        const presets = ['1', '5', '10', 'max'];
        const qtyButtons = presets.map((preset) => {
            const isActive = selectedPurchasePreset === preset;
            const disabled = preset === 'max'
                ? !quote.canAffordAny
                : resolvePurchaseQuantity(
                    preset,
                    quote.gold,
                    quote.unitCost,
                    quote.provisions,
                    quote.upcPerUnit,
                    unit
                ) < 1;
            const label = preset === 'max'
                ? `Max (${quote.maxAffordable})`
                : preset;
            return (
                `<button type="button"`
                + ` class="age-barracks-qty-btn${isActive ? ' is-active' : ''}"`
                + ` data-barracks-qty="${escapeHtml(preset)}"`
                + ` aria-pressed="${isActive ? 'true' : 'false'}"`
                + ` aria-label="${escapeHtml(preset === 'max' ? `Recruit maximum affordable units (${quote.maxAffordable})` : `Recruit ${preset} units`)}"`
                + `${disabled ? ' disabled' : ''}>${escapeHtml(label)}</button>`
            );
        }).join('');

        const buyDisabled = purchaseInFlight || !quote.canAffordSelection;
        const buyLabel = purchaseInFlight
            ? 'Recruiting…'
            : `Recruit — ${quote.formatGold(quote.totalGoldCost)}`;
        const messageLine = purchaseMessage
            ? `<p class="age-barracks-detail-message${purchaseMessage.startsWith('Recruited') ? ' is-success' : ' is-error'}">${escapeHtml(purchaseMessage)}</p>`
            : '';

        return (
            `<div class="age-barracks-purchase-panel">`
            + `<div class="age-barracks-qty-picker">`
            + `<span class="age-barracks-qty-label">Quantity</span>`
            + `<div class="age-barracks-qty-options" role="group" aria-label="Recruit quantity">${qtyButtons}</div>`
            + '</div>'
            + messageLine
            + `<div class="age-barracks-detail-actions">`
            + `<button type="button" id="age-barracks-purchase-btn"`
            + ` class="age-barracks-purchase-btn${buyDisabled ? '' : ' is-ready'}"`
            + `${buyDisabled ? ' disabled' : ''}`
            + ` title="${escapeHtml(buyDisabled && !purchaseInFlight
                ? (quote.limitedByProvisions ? 'Insufficient Provisions for this quantity.' : 'Insufficient gold for this quantity.')
                : `Recruit ${quote.quantity} unit(s)`)}">`
            + `${escapeHtml(buyLabel)}`
            + '</button>'
            + '</div>'
            + '</div>'
        );
    }

    function refreshSelectedUnitDetail() {
        if (!catalog || !selectedUnitId) return;
        const api = catalogApi();
        renderUnitDetail(api.getUnitById(catalog, selectedUnitId));
    }

    function renderPromotionTable(unit) {
        const api = catalogApi();
        if (!api || !unit?.stats) return '';

        const ranged = api.unitHasRangedStats(unit);
        const headerCells = [
            '<th scope="col">Rank</th>',
            '<th scope="col">HP</th>',
            '<th scope="col">Str</th>'
        ];
        if (ranged) headerCells.push('<th scope="col">Rng</th>');
        headerCells.push('<th scope="col">UPC</th>');

        const rows = (unit.promotions || []).map((rankKey) => {
            const row = unit.stats[rankKey];
            if (!row) return '';
            const cells = [
                `<td>${escapeHtml(api.formatPromotionLabel(rankKey))}</td>`,
                `<td>${escapeHtml(row.hp)}</td>`,
                `<td>${escapeHtml(row.str)}</td>`
            ];
            if (ranged) {
                cells.push(`<td>${escapeHtml(row.rng ?? '—')}</td>`);
            }
            cells.push(`<td>${escapeHtml(row.upc)}</td>`);
            return `<tr>${cells.join('')}</tr>`;
        }).join('');

        return (
            `<div class="age-barracks-promo-table-wrap">`
            + `<table class="age-barracks-promo-table">`
            + `<thead><tr>${headerCells.join('')}</tr></thead>`
            + `<tbody>${rows}</tbody>`
            + '</table>'
            + '</div>'
        );
    }

    function renderPortraitImg(className, portraitUrl, options = {}) {
        const placeholderClass = options.placeholder ? ' is-placeholder' : '';
        const loading = options.eager ? 'eager' : 'lazy';
        const decoding = options.eager ? 'sync' : 'async';
        return (
            `<img class="${className}${placeholderClass}"`
            + ` src="${escapeHtml(portraitUrl)}" alt="" width="1024" height="1024"`
            + ` loading="${loading}" decoding="${decoding}">`
        );
    }

    function renderUnitDetail(unit) {
        const panel = global.document.getElementById('age-barracks-unit-detail');
        if (!panel) return;

        if (!unit) {
            panel.hidden = true;
            panel.innerHTML = '';
            return;
        }

        const api = catalogApi();
        const commander = getCommanderContext();
        const access = api.evaluateUnitPurchaseAccess(unit, commander);
        const portraitUrl = api.resolveUnitPortraitUrl(unit, catalog);
        const branchLine = unit.branch
            ? `<p class="age-barracks-detail-branch">Branch ${escapeHtml(unit.branch)} · Tier ${escapeHtml(unit.tier)} · ${escapeHtml(unit.roleLabel || 'Rank')}</p>`
            : `<p class="age-barracks-detail-branch">Tier ${escapeHtml(unit.tier)} · ${escapeHtml(unit.roleLabel || 'Rank')}</p>`;
        const lockLine = access.allowed
            ? ''
            : `<p class="age-barracks-detail-lock">${escapeHtml(access.reason)}</p>`;
        const specialLine = unit.special
            ? `<p class="age-barracks-detail-special">${escapeHtml(unit.special.replace(/_/g, ' '))}</p>`
            : '';
        const capNotes = unit.promotionCapNotes
            ? `<p class="age-barracks-detail-cap-notes">${escapeHtml(unit.promotionCapNotes)}</p>`
            : '';

        panel.hidden = false;
        panel.innerHTML = (
            `<div class="age-barracks-detail-inner">`
            + `<div class="age-barracks-detail-header">`
            + `<div class="age-barracks-detail-portrait-wrap">`
            + renderPortraitImg(
                'age-barracks-detail-portrait',
                portraitUrl,
                { placeholder: Boolean(unit.portraitPlaceholder), eager: true }
            )
            + (unit.portraitPlaceholder
                ? `<span class="age-barracks-detail-portrait-badge">Portrait coming soon</span>`
                : '')
            + '</div>'
            + `<div class="age-barracks-detail-summary">`
            + `<h3 class="age-barracks-detail-title">${escapeHtml(unit.displayName || unit.name)}</h3>`
            + branchLine
            + specialLine
            + `<dl class="age-barracks-detail-costs">`
            + `<div><dt>Recruit</dt><dd>${escapeHtml(api.formatGold(unit.goldCost))}</dd></div>`
            + `<div><dt>Tier evolution</dt><dd>${escapeHtml(unit.tierEvolutionCost)} Provisions</dd></div>`
            + `<div><dt>Role</dt><dd>${escapeHtml(unit.roleLabel || 'Rank')}</dd></div>`
            + `<div><dt>Class</dt><dd>${escapeHtml(unit.combatType || '—')}</dd></div>`
            + '</dl>'
            + lockLine
            + capNotes
            + '</div>'
            + '</div>'
            + `<div class="age-barracks-detail-recruit-section">`
            + renderPromotionTable(unit)
            + renderPurchaseControls(unit, access)
            + '</div>'
            + '</div>'
        );
    }

    async function submitPurchase() {
        if (purchaseInFlight || !catalog || !selectedUnitId) return;

        const api = catalogApi();
        const unit = api.getUnitById(catalog, selectedUnitId);
        if (!unit) return;

        const access = api.evaluateUnitPurchaseAccess(unit, getCommanderContext());
        if (!access.allowed) return;

        const quote = buildPurchaseQuote(unit);
        if (!quote.canAffordSelection || !quote.quantity) {
            purchaseMessage = quote.limitedByProvisions
                ? 'Not enough Provisions for this recruitment.'
                : 'Not enough gold for this recruitment.';
            refreshSelectedUnitDetail();
            return;
        }

        const recruitmentApi = global.RoyalArmiesAgeRecruitment;
        if (!recruitmentApi?.recruitUnits) {
            purchaseMessage = 'Recruitment checkout is unavailable right now.';
            refreshSelectedUnitDetail();
            return;
        }

        purchaseInFlight = true;
        purchaseMessage = '';
        refreshSelectedUnitDetail();

        try {
            const result = await recruitmentApi.recruitUnits({
                unitId: unit.id,
                quantity: quote.quantity
            });
            purchaseMessage = `Recruited ${result.quantity} ${result.quantity === 1 ? 'unit' : 'units'} for ${api.formatGold(result.goldSpent)} and ${result.provisionsSpent} Provisions.`;
            selectedPurchasePreset = '1';
        } catch (error) {
            purchaseMessage = error?.message || 'Recruitment failed. Try again shortly.';
            if (typeof global.showRiftError === 'function' && error?.code) {
                global.showRiftError(error.code, error.message);
            }
        } finally {
            purchaseInFlight = false;
            syncCommanderGold();
            syncCommanderProvisions();
            if (typeof global.refreshAgeHudProvisions === 'function') {
                global.refreshAgeHudProvisions();
            }
            refreshSelectedUnitDetail();
        }
    }

    function formatUnitCardUnlockLine(unit) {
        const api = catalogApi();
        const catalogRef = catalog || api.getCachedCatalog?.();
        const gameTier = Number.isFinite(Number(unit?.gameTier))
            ? Math.max(1, Math.floor(Number(unit.gameTier)))
            : (catalogRef && api.resolveGameTierForUnit
                ? api.resolveGameTierForUnit(catalogRef, unit)
                : Math.max(1, Math.floor(Number(unit?.tier) || 1)));
        const unlockRank = Math.max(1, Math.floor(Number(unit?.unlockRank) || 1));
        const unlockLabel = formatCommanderRankLabel(unlockRank);
        return `Tier ${gameTier} · Unlocks at ${unlockLabel}`;
    }

    function renderUnitGrid() {
        const grid = global.document.getElementById('age-barracks-unit-grid');
        if (!grid || !catalog) return;

        const api = catalogApi();
        const commander = getCommanderContext();
        const units = api.getUnitsForCategory(catalog, activeCategoryId, getCatalogOptions());
        if (!units.length) {
            grid.innerHTML = '<p class="age-barracks-empty">No units listed for this class yet.</p>';
            renderUnitDetail(null);
            return;
        }

        if (!selectedUnitId || !units.some((unit) => unit.id === selectedUnitId)) {
            selectedUnitId = units[0].id;
        }

        grid.innerHTML = units.map((unit) => {
            const portraitUrl = api.resolveUnitPortraitUrl(unit, catalog);
            const access = api.evaluateUnitPurchaseAccess(unit, commander);
            const isActive = unit.id === selectedUnitId;
            const unlockLine = formatUnitCardUnlockLine(unit);
            const metaMarkup = access.allowed
                ? ''
                : `<span class="age-barracks-unit-card-meta">${escapeHtml(unlockLine)}</span>`;
            return (
                `<button type="button"`
                + ` class="age-barracks-unit-card${isActive ? ' is-active' : ''}${access.allowed ? '' : ' is-locked'}"`
                + ` data-barracks-unit-id="${escapeHtml(unit.id)}"`
                + ` aria-pressed="${isActive ? 'true' : 'false'}"`
                + ` title="${escapeHtml(access.allowed ? (unit.displayName || unit.name) : access.reason)}">`
                + `<span class="age-barracks-unit-card-portrait-wrap">`
                + renderPortraitImg(
                    'age-barracks-unit-card-portrait',
                    portraitUrl,
                    { placeholder: Boolean(unit.portraitPlaceholder) }
                )
                + '</span>'
                + `<span class="age-barracks-unit-card-body">`
                + `<span class="age-barracks-unit-card-name">${escapeHtml(unit.displayName || unit.name)}</span>`
                + metaMarkup
                + '</span>'
                + '</button>'
            );
        }).join('');

        renderUnitDetail(api.getUnitById(catalog, selectedUnitId));
    }

    function resolveCategoryNavTitle() {
        const commander = getCommanderContext();
        return commander.classId === 'battlemage' ? 'Magic Unit Classes' : 'Unit Classes';
    }

    function renderCategoryNav() {
        const nav = global.document.getElementById('age-barracks-category-nav');
        if (!nav || !catalog) return;

        const api = catalogApi();
        nav.innerHTML = (
            `<p class="age-army-workspace-panel-title age-barracks-category-nav-title">${escapeHtml(resolveCategoryNavTitle())}</p>`
            + api.getCategories(catalog, getCatalogOptions()).map((category) => {
            const isActive = category.id === activeCategoryId;
            return (
                `<button type="button"`
                + ` class="age-barracks-category-btn${isActive ? ' is-active' : ''}"`
                + ` data-barracks-category="${escapeHtml(category.id)}"`
                + ` aria-pressed="${isActive ? 'true' : 'false'}">`
                + `<span class="age-barracks-category-label">${escapeHtml(category.label)}</span>`
                + '</button>'
            );
        }).join('')
        );
    }

    function syncCategoryLabel() {
        const labelEl = global.document.getElementById('age-barracks-active-category-label');
        if (!labelEl || !catalog) return;
        const category = catalog.categories.find((entry) => entry.id === activeCategoryId);
        labelEl.textContent = category?.label || 'Units';
    }

    function renderBarracks() {
        ensureValidActiveCategory();
        syncCommanderStatus();
        syncCommanderGold();
        syncCommanderProvisions();
        renderCategoryNav();
        syncCategoryLabel();
        renderUnitGrid();
    }

    async function ensureCatalogLoaded() {
        if (catalog) return catalog;
        const api = catalogApi();
        if (!api) throw new Error('Unit catalog module unavailable');
        catalog = await api.loadCatalog();
        return catalog;
    }

    async function open(options = {}) {
        const workspace = resolveWorkspace();
        if (!workspace) return;

        global.RoyalArmiesSettlementVenueWorkspaces?.close?.();
        global.RoyalArmiesAdventurersGuild?.dismissGuildWorkspacesForSettlementAction?.();
        global.RoyalArmiesAgeUnitEvolution?.close?.();

        try {
            await ensureCatalogLoaded();
        } catch (error) {
            console.warn('[RIFT] Barracks catalog load failed:', error);
            workspace.hidden = false;
            workspace.setAttribute('aria-hidden', 'false');
            const grid = global.document.getElementById('age-barracks-unit-grid');
            if (grid) {
                grid.innerHTML = '<p class="age-barracks-empty">Could not load the unit catalog. Try again shortly.</p>';
            }
            return;
        }

        if (options.categoryId) {
            activeCategoryId = String(options.categoryId);
        }

        ensureValidActiveCategory();

        workspace.hidden = false;
        workspace.setAttribute('aria-hidden', 'false');
        global.document.body.classList.add('age-barracks-open');
        global.RoyalArmiesImmersiveWorkspace?.sync?.();

        renderBarracks();

        const closeBtn = global.document.getElementById('age-barracks-close');
        closeBtn?.focus();
    }

    function close() {
        const workspace = resolveWorkspace();
        if (!workspace) return;

        workspace.hidden = true;
        workspace.setAttribute('aria-hidden', 'true');
        global.document.body.classList.remove('age-barracks-open');
        global.RoyalArmiesImmersiveWorkspace?.sync?.();
        selectedUnitId = '';
        selectedPurchasePreset = '1';
        purchaseMessage = '';
        purchaseInFlight = false;
    }

    function onWorkspaceClick(event) {
        const categoryBtn = event.target.closest('[data-barracks-category]');
        if (categoryBtn) {
            activeCategoryId = categoryBtn.getAttribute('data-barracks-category') || 'infantry';
            selectedUnitId = '';
            selectedPurchasePreset = '1';
            purchaseMessage = '';
            renderBarracks();
            return;
        }

        const qtyBtn = event.target.closest('[data-barracks-qty]');
        if (qtyBtn && !qtyBtn.disabled) {
            selectedPurchasePreset = qtyBtn.getAttribute('data-barracks-qty') || '1';
            purchaseMessage = '';
            refreshSelectedUnitDetail();
            return;
        }

        if (event.target.closest('#age-barracks-purchase-btn')) {
            event.preventDefault();
            void submitPurchase();
            return;
        }

        const unitBtn = event.target.closest('[data-barracks-unit-id]');
        if (unitBtn) {
            selectedUnitId = unitBtn.getAttribute('data-barracks-unit-id') || '';
            selectedPurchasePreset = '1';
            purchaseMessage = '';
            renderUnitGrid();
            return;
        }

        if (event.target.closest('#age-barracks-close')) {
            event.preventDefault();
            close();
        }
    }

    function onWorkspaceKeydown(event) {
        if (event.key === 'Escape' && isOpen()) {
            event.preventDefault();
            close();
        }
    }

    function onAgeGoldUpdated() {
        syncCommanderGold();
        if (isOpen() && selectedUnitId) {
            refreshSelectedUnitDetail();
        }
    }

    function onAgeProvisionsUpdated() {
        syncCommanderProvisions();
        if (isOpen() && selectedUnitId) {
            refreshSelectedUnitDetail();
        }
    }

    function onAgeMovementUpdated() {
        syncCommanderGold();
        syncCommanderProvisions();
        if (isOpen() && selectedUnitId) {
            refreshSelectedUnitDetail();
        }
    }

    function onSettlementMenuClick(event) {
        const optionBtn = event.target.closest('[data-garrison-option]');
        if (!optionBtn) return;

        event.preventDefault();
        event.stopPropagation();
        openGarrisonMenuOption(optionBtn.getAttribute('data-garrison-option'));
    }

    function bindBarracks() {
        if (bound) return;
        bound = true;

        const workspace = resolveWorkspace();
        workspace?.addEventListener('click', onWorkspaceClick);
        global.document.addEventListener('keydown', onWorkspaceKeydown);
        global.document.getElementById('age-settlement-menu-list')?.addEventListener('click', onSettlementMenuClick, true);
        global.addEventListener(
            global.RoyalArmiesAgeGold?.AGE_GOLD_UPDATED_EVENT || 'royalarmies:age-gold-updated',
            onAgeGoldUpdated
        );
        global.addEventListener(
            global.RoyalArmiesAgeProvisions?.AGE_PROVISIONS_UPDATED_EVENT || 'royalarmies:age-provisions-updated',
            onAgeProvisionsUpdated
        );
        global.addEventListener('royalarmies:age-movement-updated', onAgeMovementUpdated);
        global.addEventListener('royalarmies:age-recruitment-updated', onAgeMovementUpdated);
    }

    function enableAgeBarracks() {
        bindBarracks();
    }

    global.RoyalArmiesAgeBarracks = {
        open,
        close,
        isOpen,
        enableAgeBarracks,
        toggleSettlementGarrisonMenu,
        syncSettlementMenuGarrison
    };

    global.enableAgeBarracks = enableAgeBarracks;
})(window);

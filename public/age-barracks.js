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

    function getCatalogOptions() {
        return { filterByClass: true, commander: getCommanderContext() };
    }

    function resolveCommanderGold() {
        if (global.RoyalArmiesAgeGold?.resolveAgeCommanderGold) {
            return global.RoyalArmiesAgeGold.resolveAgeCommanderGold();
        }
        if (typeof global.resolveAgeCommanderGold === 'function') {
            return global.resolveAgeCommanderGold();
        }
        return 20000;
    }

    function syncCommanderStatus() {
        const statusEl = global.document.getElementById('age-barracks-commander-status');
        if (!statusEl) return;

        const commander = getCommanderContext();
        statusEl.textContent = `${commander.classLabel} · Commander Rank ${commander.rank}`;
    }

    function syncCommanderGold() {
        const goldEl = global.document.getElementById('age-barracks-commander-gold');
        if (!goldEl) return;

        const api = catalogApi();
        const gold = resolveCommanderGold();
        goldEl.textContent = api?.formatGold ? api.formatGold(gold) : gold.toLocaleString('en-US');
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

    function isOpen() {
        const workspace = resolveWorkspace();
        return Boolean(workspace && !workspace.hidden);
    }

    function computeMaxAffordable(gold, unitCost) {
        const cost = Math.max(0, Math.floor(Number(unitCost) || 0));
        if (!cost) return 0;
        return Math.max(0, Math.floor(Number(gold) || 0) / cost);
    }

    function resolvePurchaseQuantity(preset, gold, unitCost) {
        const maxAffordable = computeMaxAffordable(gold, unitCost);
        if (!maxAffordable) return 0;

        if (String(preset || '').toLowerCase() === 'max') {
            return maxAffordable;
        }

        const requested = Math.max(1, Math.floor(Number(preset) || 1));
        return Math.min(requested, maxAffordable);
    }

    function buildPurchaseQuote(unit) {
        const api = catalogApi();
        const gold = resolveCommanderGold();
        const unitCost = Math.max(0, Math.floor(Number(unit?.goldCost) || 0));
        const maxAffordable = computeMaxAffordable(gold, unitCost);
        const quantity = resolvePurchaseQuantity(selectedPurchasePreset, gold, unitCost);
        const totalCost = unitCost * quantity;

        return {
            gold,
            unitCost,
            maxAffordable,
            quantity,
            totalCost,
            canAffordAny: maxAffordable > 0,
            canAffordSelection: quantity > 0 && totalCost <= gold,
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
        const presetLabels = { max: 'Max' };
        const qtyButtons = presets.map((preset) => {
            const isActive = selectedPurchasePreset === preset;
            const disabled = preset === 'max'
                ? !quote.canAffordAny
                : resolvePurchaseQuantity(preset, quote.gold, quote.unitCost) < 1;
            const label = presetLabels[preset] || preset;
            return (
                `<button type="button"`
                + ` class="age-barracks-qty-btn${isActive ? ' is-active' : ''}"`
                + ` data-barracks-qty="${escapeHtml(preset)}"`
                + ` aria-pressed="${isActive ? 'true' : 'false'}"`
                + `${disabled ? ' disabled' : ''}>${escapeHtml(label)}</button>`
            );
        }).join('');

        const buyDisabled = purchaseInFlight || !quote.canAffordSelection;
        const buyLabel = purchaseInFlight
            ? 'Purchasing…'
            : `Buy — ${quote.formatGold(quote.totalCost)}`;
        const summaryLine = quote.quantity
            ? `${quote.quantity} ${quote.quantity === 1 ? 'unit' : 'units'} · ${quote.formatGold(quote.totalCost)}`
            : 'Not enough gold for this unit.';
        const messageLine = purchaseMessage
            ? `<p class="age-barracks-detail-message${purchaseMessage.startsWith('Recruited') ? ' is-success' : ' is-error'}">${escapeHtml(purchaseMessage)}</p>`
            : '';

        return (
            `<div class="age-barracks-purchase-panel">`
            + `<div class="age-barracks-qty-picker">`
            + `<span class="age-barracks-qty-label">Quantity</span>`
            + `<div class="age-barracks-qty-options" role="group" aria-label="Purchase quantity">${qtyButtons}</div>`
            + `<p class="age-barracks-qty-summary">${escapeHtml(summaryLine)}</p>`
            + '</div>'
            + messageLine
            + `<div class="age-barracks-detail-actions">`
            + `<button type="button" id="age-barracks-purchase-btn"`
            + ` class="age-barracks-purchase-btn${buyDisabled ? '' : ' is-ready'}"`
            + `${buyDisabled ? ' disabled' : ''}`
            + ` title="${escapeHtml(buyDisabled && !purchaseInFlight ? 'Insufficient gold for this quantity.' : `Purchase ${quote.quantity} unit(s)`)}">`
            + `${escapeHtml(buyLabel)}`
            + '</button>'
            + `<p class="age-barracks-detail-footnote">${escapeHtml(quote.formatGold(unit.goldCost))} per unit · ${quote.maxAffordable} max affordable</p>`
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
            `<div class="age-barracks-detail-card">`
            + `<div class="age-barracks-detail-portrait-wrap">`
            + `<img class="age-barracks-detail-portrait${unit.portraitPlaceholder ? ' is-placeholder' : ''}"`
            + ` src="${escapeHtml(portraitUrl)}" alt="" loading="lazy" decoding="async">`
            + (unit.portraitPlaceholder
                ? `<span class="age-barracks-detail-portrait-badge">Portrait coming soon</span>`
                : '')
            + '</div>'
            + `<div class="age-barracks-detail-body">`
            + `<h3 class="age-barracks-detail-title">${escapeHtml(unit.displayName || unit.name)}</h3>`
            + branchLine
            + specialLine
            + `<dl class="age-barracks-detail-costs">`
            + `<div><dt>Purchase</dt><dd>${escapeHtml(api.formatGold(unit.goldCost))}</dd></div>`
            + `<div><dt>Tier evolution</dt><dd>${escapeHtml(unit.tierEvolutionCost)} Provisions</dd></div>`
            + `<div><dt>Unlock</dt><dd>Commander Rank ${escapeHtml(unit.unlockRank ?? '—')}</dd></div>`
            + `<div><dt>Role</dt><dd>${escapeHtml(unit.roleLabel || 'Rank')}</dd></div>`
            + `<div><dt>Class</dt><dd>${escapeHtml(unit.combatType || '—')}</dd></div>`
            + '</dl>'
            + lockLine
            + capNotes
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
            purchaseMessage = 'Not enough gold for this purchase.';
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
            purchaseMessage = `Recruited ${result.quantity} ${result.quantity === 1 ? 'unit' : 'units'} for ${api.formatGold(result.goldSpent)}.`;
            selectedPurchasePreset = '1';
        } catch (error) {
            purchaseMessage = error?.message || 'Recruitment failed. Try again shortly.';
            if (typeof global.showRiftError === 'function' && error?.code) {
                global.showRiftError(error.code, error.message);
            }
        } finally {
            purchaseInFlight = false;
            refreshSelectedUnitDetail();
            syncCommanderGold();
        }
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
            const lockBadge = access.allowed
                ? ''
                : `<span class="age-barracks-unit-card-lock">${escapeHtml(access.reason)}</span>`;
            return (
                `<button type="button"`
                + ` class="age-barracks-unit-card${isActive ? ' is-active' : ''}${access.allowed ? '' : ' is-locked'}"`
                + ` data-barracks-unit-id="${escapeHtml(unit.id)}"`
                + ` aria-pressed="${isActive ? 'true' : 'false'}"`
                + ` title="${escapeHtml(access.allowed ? '' : access.reason)}">`
                + `<span class="age-barracks-unit-card-portrait-wrap">`
                + `<img class="age-barracks-unit-card-portrait${unit.portraitPlaceholder ? ' is-placeholder' : ''}"`
                + ` src="${escapeHtml(portraitUrl)}" alt="" loading="lazy" decoding="async">`
                + '</span>'
                + `<span class="age-barracks-unit-card-body">`
                + `<span class="age-barracks-unit-card-name">${escapeHtml(unit.displayName || unit.name)}</span>`
                + `<span class="age-barracks-unit-card-meta">Tier ${escapeHtml(unit.tier)} · Rank ${escapeHtml(unit.unlockRank)} · ${escapeHtml(unit.roleLabel || 'Rank')}</span>`
                + `<span class="age-barracks-unit-card-promos">${escapeHtml((unit.promotions || []).map(api.formatPromotionLabel).join(' · '))}</span>`
                + lockBadge
                + '</span>'
                + '</button>'
            );
        }).join('');

        renderUnitDetail(api.getUnitById(catalog, selectedUnitId));
    }

    function renderCategoryNav() {
        const nav = global.document.getElementById('age-barracks-category-nav');
        if (!nav || !catalog) return;

        const api = catalogApi();
        nav.innerHTML = api.getCategories(catalog, getCatalogOptions()).map((category) => {
            const isActive = category.id === activeCategoryId;
            return (
                `<button type="button"`
                + ` class="age-barracks-category-btn${isActive ? ' is-active' : ''}"`
                + ` data-barracks-category="${escapeHtml(category.id)}"`
                + ` aria-pressed="${isActive ? 'true' : 'false'}">`
                + `<span class="age-barracks-category-label">${escapeHtml(category.label)}</span>`
                + `<span class="age-barracks-category-path">${escapeHtml(category.path)}</span>`
                + '</button>'
            );
        }).join('');
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

    function onAgeMovementUpdated() {
        syncCommanderGold();
        if (isOpen() && selectedUnitId) {
            refreshSelectedUnitDetail();
        }
    }

    function onSettlementVenueOpen(event) {
        const venueId = event?.detail?.venueId;
        if (venueId !== 'barracks') return;
        void open();
    }

    function bindBarracks() {
        if (bound) return;
        bound = true;

        const workspace = resolveWorkspace();
        workspace?.addEventListener('click', onWorkspaceClick);
        global.document.addEventListener('keydown', onWorkspaceKeydown);
        global.addEventListener('royal-armies-settlement-venue-open', onSettlementVenueOpen);
        global.addEventListener(
            global.RoyalArmiesAgeGold?.AGE_GOLD_UPDATED_EVENT || 'royalarmies:age-gold-updated',
            onAgeGoldUpdated
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
        enableAgeBarracks
    };

    global.enableAgeBarracks = enableAgeBarracks;
})(window);

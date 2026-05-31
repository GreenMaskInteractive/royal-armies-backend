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
        const player = typeof global.player !== 'undefined' ? global.player : null;
        const gold = Number(player?.gold);
        return Number.isFinite(gold) ? Math.max(0, Math.floor(gold)) : 0;
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
            + `<div class="age-barracks-detail-actions">`
            + `<button type="button" class="age-barracks-purchase-btn"${access.allowed ? '' : ' disabled'}`
            + ` title="${escapeHtml(access.allowed
                ? 'Recruitment checkout will connect to your ledger in a future update.'
                : access.reason)}">`
            + (access.allowed
                ? `Recruit — ${escapeHtml(api.formatGold(unit.goldCost))}`
                : escapeHtml(access.reason))
            + '</button>'
            + `<p class="age-barracks-detail-footnote">Purchases debit commander gold when recruitment goes live.</p>`
            + '</div>'
            + '</div>'
            + '</div>'
        );
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
    }

    function onWorkspaceClick(event) {
        const categoryBtn = event.target.closest('[data-barracks-category]');
        if (categoryBtn) {
            activeCategoryId = categoryBtn.getAttribute('data-barracks-category') || 'infantry';
            selectedUnitId = '';
            renderBarracks();
            return;
        }

        const unitBtn = event.target.closest('[data-barracks-unit-id]');
        if (unitBtn) {
            selectedUnitId = unitBtn.getAttribute('data-barracks-unit-id') || '';
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

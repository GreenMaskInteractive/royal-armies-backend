/**
 * RIFT — Unit Evolution workspace (rank promotions and tier evolution).
 */
(function initRoyalArmiesAgeUnitEvolution(global) {
    'use strict';

    let bound = false;
    let evolutionState = null;
    let actionInFlight = false;
    let statusMessage = '';
    const selectedQuantities = new Map();

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function resolveWorkspace() {
        return global.document.getElementById('age-unit-evolution-workspace');
    }

    function resolveApi() {
        return global.RoyalArmiesAgeUnitEvolutionApi || null;
    }

    function isOpen() {
        const workspace = resolveWorkspace();
        return Boolean(workspace && !workspace.hidden);
    }

    function stackActionKey(catalogUnitId, rank, action) {
        return `${String(catalogUnitId || '').trim()}|${Math.floor(Number(rank) || 1)}|${action}`;
    }

    function resolveSelectedQuantity(stack, action) {
        const key = stackActionKey(stack.catalogUnitId, stack.rank, action);
        const maxQty = action === 'promote-rank'
            ? Math.max(0, Math.floor(Number(stack.maxRankPromoteQty) || 0))
            : Math.max(0, Math.floor(Number(stack.maxEvolveQty) || 0));
        const raw = selectedQuantities.get(key);
        const parsed = Math.floor(Number(raw) || 0);
        if (parsed >= 1 && parsed <= maxQty) return parsed;
        return maxQty > 0 ? 1 : 0;
    }

    function setSelectedQuantity(catalogUnitId, rank, action, quantity, maxQty) {
        const max = Math.max(0, Math.floor(Number(maxQty) || 0));
        let parsed = Math.floor(Number(quantity) || 0);
        if (max > 0) {
            parsed = Math.min(max, Math.max(1, parsed));
        } else {
            parsed = Math.max(1, parsed);
        }
        selectedQuantities.set(
            stackActionKey(catalogUnitId, rank, action),
            parsed
        );
        return parsed;
    }

    function findStackForAction(catalogUnitId, rank, action) {
        const id = String(catalogUnitId || '').trim();
        const rankNum = Math.floor(Number(rank) || 1);
        const categoryId = action === 'evolve-tier' ? 'tier-evolution' : 'rank-promotion';
        const categories = Array.isArray(evolutionState?.categories) ? evolutionState.categories : [];

        for (const category of categories) {
            if (category.id !== categoryId) continue;
            for (const group of Array.isArray(category.groups) ? category.groups : []) {
                for (const stack of Array.isArray(group.stacks) ? group.stacks : []) {
                    if (
                        stack
                        && String(stack.catalogUnitId || '').trim() === id
                        && Math.floor(Number(stack.rank) || 0) === rankNum
                    ) {
                        return stack;
                    }
                }
            }
        }
        return null;
    }

    function resolveStackMaxQuantity(stack, action) {
        return action === 'promote-rank'
            ? Math.max(0, Math.floor(Number(stack.maxRankPromoteQty) || 0))
            : Math.max(0, Math.floor(Number(stack.maxEvolveQty) || 0));
    }

    function syncQuantityPickerCard(card, stack, action, selectedQty) {
        if (!card || !stack) return;

        const perUnit = action === 'promote-rank'
            ? Math.max(0, Math.floor(Number(stack.rankPromotionCostPerUnit) || 0))
            : Math.max(0, Math.floor(Number(stack.tierEvolutionCostPerUnit) || 0));
        const totalCost = perUnit * selectedQty;

        const input = card.querySelector('[data-evolution-qty-input]');
        if (input && global.document.activeElement !== input) {
            input.value = String(selectedQty);
        }

        const summary = card.querySelector('.age-unit-evolution-qty-summary');
        if (summary) {
            summary.textContent = `${selectedQty} unit(s) · ${totalCost} provisions (${perUnit} each)`;
        }

        const actionBtn = card.querySelector('[data-evolution-action]');
        if (actionBtn) {
            actionBtn.setAttribute('data-action-qty', String(selectedQty));
            actionBtn.disabled = selectedQty < 1;
            if (action === 'promote-rank') {
                actionBtn.textContent = `Promote ${selectedQty} to ${stack.nextPromotionLabel} (${totalCost} provisions)`;
            } else {
                actionBtn.textContent = `Evolve ${selectedQty} to ${stack.evolveTargetName} (${totalCost} provisions)`;
            }
        }

        card.querySelectorAll('[data-evolution-qty]').forEach((btn) => {
            const value = Math.floor(Number(btn.getAttribute('data-qty-value')) || 0);
            const isActive = value === selectedQty;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });

        const customLabel = card.querySelector('.age-unit-evolution-qty-custom');
        if (customLabel) {
            const presetValues = Array.from(card.querySelectorAll('[data-evolution-qty]')).map((btn) => (
                Math.floor(Number(btn.getAttribute('data-qty-value')) || 0)
            ));
            customLabel.classList.toggle('is-custom-active', !presetValues.includes(selectedQty));
        }
    }

    function handleManualQuantityInput(input) {
        const catalogUnitId = input.getAttribute('data-catalog-unit-id') || '';
        const rank = input.getAttribute('data-stack-rank') || '';
        const action = input.getAttribute('data-evolution-qty-input') || '';
        const stack = findStackForAction(catalogUnitId, rank, action);
        if (!stack) return;

        const maxQty = resolveStackMaxQuantity(stack, action);
        const card = input.closest('.age-unit-evolution-stack');
        const raw = String(input.value ?? '').trim();

        if (!raw) {
            return;
        }

        let parsed = Math.floor(Number(raw) || 0);
        if (!Number.isFinite(parsed) || parsed < 1) {
            return;
        }

        if (parsed > maxQty) {
            parsed = maxQty;
            input.value = String(parsed);
        }

        parsed = setSelectedQuantity(catalogUnitId, rank, action, parsed, maxQty);
        syncQuantityPickerCard(card, stack, action, parsed);
    }

    function commitManualQuantityInput(input) {
        const catalogUnitId = input.getAttribute('data-catalog-unit-id') || '';
        const rank = input.getAttribute('data-stack-rank') || '';
        const action = input.getAttribute('data-evolution-qty-input') || '';
        const stack = findStackForAction(catalogUnitId, rank, action);
        if (!stack) return;

        const maxQty = resolveStackMaxQuantity(stack, action);
        const card = input.closest('.age-unit-evolution-stack');
        const raw = String(input.value ?? '').trim();
        let parsed = Math.floor(Number(raw) || 0);

        if (!raw || !Number.isFinite(parsed) || parsed < 1) {
            parsed = resolveSelectedQuantity(stack, action) || 1;
        }

        parsed = setSelectedQuantity(catalogUnitId, rank, action, parsed, maxQty);
        input.value = String(parsed);
        syncQuantityPickerCard(card, stack, action, parsed);
    }

    function clearSelectedQuantities() {
        selectedQuantities.clear();
    }

    function syncProvisionsDisplay() {
        const el = global.document.getElementById('age-unit-evolution-provisions');
        if (!el) return;
        const provisions = evolutionState?.ageProvisions;
        if (provisions !== undefined) {
            el.textContent = Math.max(0, Math.floor(Number(provisions) || 0)).toLocaleString('en-US');
        }
    }

    function resolveQuantityPresets(maxQty) {
        const max = Math.max(0, Math.floor(Number(maxQty) || 0));
        const presets = ['1'];
        if (max >= 5) presets.push('5');
        if (max >= 10) presets.push('10');
        if (max > 1) presets.push('max');
        return { presets, max };
    }

    function formatStackXpLabel(stack) {
        const min = Math.max(0, Math.floor(Number(stack.unitXpMin) || 0));
        const max = Math.max(0, Math.floor(Number(stack.unitXpMax) || min));
        const required = Math.max(0, Math.floor(Number(stack.unitXpRequired) || 0));
        if (min === max) return `${min} | ${required}`;
        return `${min}–${max} | ${required}`;
    }

    function renderQuantityPicker(stack, action) {
        const maxQty = action === 'promote-rank'
            ? Math.max(0, Math.floor(Number(stack.maxRankPromoteQty) || 0))
            : Math.max(0, Math.floor(Number(stack.maxEvolveQty) || 0));
        if (!maxQty) return '';

        const selectedQty = resolveSelectedQuantity(stack, action);
        const perUnit = action === 'promote-rank'
            ? Math.max(0, Math.floor(Number(stack.rankPromotionCostPerUnit) || 0))
            : Math.max(0, Math.floor(Number(stack.tierEvolutionCostPerUnit) || 0));
        const totalCost = perUnit * selectedQty;
        const { presets, max } = resolveQuantityPresets(maxQty);

        const qtyButtons = presets.map((preset) => {
            const isMax = preset === 'max';
            const value = isMax ? max : Math.min(max, Math.floor(Number(preset) || 1));
            const isActive = selectedQty === value;
            const label = isMax ? `Max (${max})` : preset;
            return (
                `<button type="button"`
                + ` class="age-unit-evolution-qty-btn${isActive ? ' is-active' : ''}"`
                + ` data-evolution-qty="${escapeHtml(action)}"`
                + ` data-catalog-unit-id="${escapeHtml(stack.catalogUnitId)}"`
                + ` data-stack-rank="${escapeHtml(stack.rank)}"`
                + ` data-qty-value="${escapeHtml(value)}"`
                + ` data-qty-max="${escapeHtml(max)}"`
                + ` aria-pressed="${isActive ? 'true' : 'false'}">${escapeHtml(label)}</button>`
            );
        }).join('');

        const customPresetActive = !presets.some((preset) => {
            const isMax = preset === 'max';
            const value = isMax ? max : Math.min(max, Math.floor(Number(preset) || 1));
            return selectedQty === value;
        });

        return (
            `<div class="age-unit-evolution-qty-picker">`
            + `<span class="age-unit-evolution-qty-label">Quantity</span>`
            + `<div class="age-unit-evolution-qty-options" role="group" aria-label="Promotion quantity">${qtyButtons}</div>`
            + `<label class="age-unit-evolution-qty-custom${customPresetActive ? ' is-custom-active' : ''}">`
            + `<span class="age-unit-evolution-qty-custom-label">Custom</span>`
            + `<input type="number" class="age-unit-evolution-qty-input"`
            + ` data-evolution-qty-input="${escapeHtml(action)}"`
            + ` data-catalog-unit-id="${escapeHtml(stack.catalogUnitId)}"`
            + ` data-stack-rank="${escapeHtml(stack.rank)}"`
            + ` min="1" max="${escapeHtml(max)}" step="1" inputmode="numeric"`
            + ` value="${escapeHtml(selectedQty)}"`
            + ` aria-label="Custom promotion quantity (1 to ${escapeHtml(max)})">`
            + '</label>'
            + `<p class="age-unit-evolution-qty-summary">${escapeHtml(selectedQty)} unit(s) · ${escapeHtml(totalCost)} provisions (${escapeHtml(perUnit)} each)</p>`
            + '</div>'
        );
    }

    function renderStackCard(stack, action) {
        const selectedQty = resolveSelectedQuantity(stack, action);
        const readyBadge = stack.readyToPromote && action === 'promote-rank'
            ? '<span class="age-unit-evolution-ready-badge">Ready</span>'
            : '';

        let actionButton = '';
        if (action === 'promote-rank' && stack.canPromoteRank) {
            const cost = Math.max(0, Math.floor(Number(stack.rankPromotionCostPerUnit) || 0)) * selectedQty;
            actionButton = (
                `<button type="button" class="age-unit-evolution-action-btn"`
                + ` data-evolution-action="promote-rank"`
                + ` data-catalog-unit-id="${escapeHtml(stack.catalogUnitId)}"`
                + ` data-stack-rank="${escapeHtml(stack.rank)}"`
                + ` data-action-qty="${escapeHtml(selectedQty)}"`
                + `${selectedQty < 1 ? ' disabled' : ''}>`
                + `Promote ${escapeHtml(selectedQty)} to ${escapeHtml(stack.nextPromotionLabel)} (${escapeHtml(cost)} provisions)`
                + '</button>'
            );
        } else if (action === 'evolve-tier' && stack.canEvolveTier) {
            const cost = Math.max(0, Math.floor(Number(stack.tierEvolutionCostPerUnit) || 0)) * selectedQty;
            actionButton = (
                `<button type="button" class="age-unit-evolution-action-btn age-unit-evolution-action-btn--evolve"`
                + ` data-evolution-action="evolve-tier"`
                + ` data-catalog-unit-id="${escapeHtml(stack.catalogUnitId)}"`
                + ` data-stack-rank="${escapeHtml(stack.rank)}"`
                + ` data-action-qty="${escapeHtml(selectedQty)}"`
                + `${selectedQty < 1 ? ' disabled' : ''}>`
                + `Evolve ${escapeHtml(selectedQty)} to ${escapeHtml(stack.evolveTargetName)} (${escapeHtml(cost)} provisions)`
                + '</button>'
            );
        }

        if (!actionButton) return '';

        const metaDetail = action === 'evolve-tier'
            ? `${escapeHtml(stack.evolveBandLabel || `Tier ${stack.tier}`)} · ${escapeHtml(stack.evolveTargetName || 'Next tier')}`
            : escapeHtml(stack.promotionBandLabel || stack.currentPromotionLabel);
        const readyMeta = action === 'promote-rank' && stack.readyUnitCount
            ? `${escapeHtml(stack.readyUnitCount)} ready · `
            : '';
        const xpLine = (
            `<p class="age-unit-evolution-stack-xp" aria-label="Unit promotion XP range">`
            + `${escapeHtml(formatStackXpLabel(stack))}`
            + '</p>'
        );

        return (
            `<article class="age-unit-evolution-stack${stack.readyToPromote && action === 'promote-rank' ? ' is-ready' : ''}">`
            + `<header class="age-unit-evolution-stack-head">`
            + `<h3 class="age-unit-evolution-stack-name">${escapeHtml(stack.name)}</h3>`
            + readyBadge
            + '</header>'
            + `<p class="age-unit-evolution-stack-meta">${escapeHtml(stack.healthyQty)} healthy · ${readyMeta}${metaDetail}</p>`
            + xpLine
            + renderQuantityPicker(stack, action)
            + `<div class="age-unit-evolution-stack-actions">${actionButton}</div>`
            + '</article>'
        );
    }

    function renderStackList() {
        const listEl = global.document.getElementById('age-unit-evolution-stack-list');
        if (!listEl) return;

        const categories = Array.isArray(evolutionState?.categories) ? evolutionState.categories : [];
        if (!categories.length) {
            listEl.innerHTML = (
                '<p class="age-unit-evolution-empty">'
                + 'No promotions or tier evolutions are available right now. '
                + 'Units earn XP from battles they fight and survive — ready stacks will appear here when you can spend provisions.'
                + '</p>'
            );
            return;
        }

        listEl.innerHTML = categories.map((category) => {
            const action = category.id === 'tier-evolution' ? 'evolve-tier' : 'promote-rank';
            const groupsHtml = (Array.isArray(category.groups) ? category.groups : []).map((group) => {
                const stacksHtml = (Array.isArray(group.stacks) ? group.stacks : [])
                    .map((stack) => renderStackCard(stack, action))
                    .filter(Boolean)
                    .join('');
                if (!stacksHtml) return '';

                return (
                    `<section class="age-unit-evolution-group">`
                    + `<h3 class="age-unit-evolution-group-title">${escapeHtml(group.label)}</h3>`
                    + `<div class="age-unit-evolution-group-stacks">${stacksHtml}</div>`
                    + '</section>'
                );
            }).filter(Boolean).join('');

            if (!groupsHtml) return '';

            return (
                `<section class="age-unit-evolution-category" data-evolution-category="${escapeHtml(category.id)}">`
                + `<h2 class="age-unit-evolution-category-title">${escapeHtml(category.label)}</h2>`
                + groupsHtml
                + '</section>'
            );
        }).filter(Boolean).join('');
    }

    function renderStatus() {
        const statusEl = global.document.getElementById('age-unit-evolution-status');
        if (!statusEl) return;
        statusEl.textContent = statusMessage || '';
        statusEl.hidden = !statusMessage;
    }

    function renderEvolution() {
        syncProvisionsDisplay();
        renderStackList();
        renderStatus();

        const readyEl = global.document.getElementById('age-unit-evolution-ready-count');
        if (readyEl) {
            const categories = Array.isArray(evolutionState?.categories) ? evolutionState.categories : [];
            const stackCount = categories.reduce((sum, category) => (
                sum + (Array.isArray(category.groups) ? category.groups : []).reduce((groupSum, group) => (
                    groupSum + (Array.isArray(group.stacks) ? group.stacks.length : 0)
                ), 0)
            ), 0);
            readyEl.textContent = stackCount
                ? `${stackCount} stack(s) ready for provisions spend`
                : '';
            readyEl.hidden = !stackCount;
        }
    }

    async function refreshState() {
        const api = resolveApi();
        if (!api?.fetchEvolutionState) {
            throw new Error('Unit evolution API unavailable.');
        }
        evolutionState = await api.fetchEvolutionState();
        renderEvolution();
        return evolutionState;
    }

    async function open(options = {}) {
        bindEvolution();

        const workspace = resolveWorkspace();
        if (!workspace) return;

        global.RoyalArmiesSettlementVenueWorkspaces?.close?.();
        global.RoyalArmiesAdventurersGuild?.dismissGuildWorkspacesForSettlementAction?.();
        global.RoyalArmiesAgeBarracks?.close?.();

        workspace.hidden = false;
        workspace.setAttribute('aria-hidden', 'false');
        global.document.body.classList.add('age-unit-evolution-open');
        global.RoyalArmiesImmersiveWorkspace?.sync?.();
        statusMessage = '';
        clearSelectedQuantities();

        const listEl = global.document.getElementById('age-unit-evolution-stack-list');
        if (listEl) {
            listEl.innerHTML = '<p class="age-unit-evolution-empty">Loading army stacks…</p>';
        }

        try {
            await refreshState();
            if (options.highlightReady) {
                const firstReady = workspace.querySelector('.age-unit-evolution-stack.is-ready');
                firstReady?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        } catch (error) {
            console.warn('[RIFT] Unit evolution load failed:', error);
            if (listEl) {
                listEl.innerHTML = '<p class="age-unit-evolution-empty">Could not load unit evolution data. Try again shortly.</p>';
            }
            if (typeof global.showRiftError === 'function' && error?.code) {
                global.showRiftError(error.code, error.message);
            }
        }

        global.document.getElementById('age-unit-evolution-close')?.focus();
    }

    function close() {
        const workspace = resolveWorkspace();
        if (!workspace) return;

        workspace.hidden = true;
        workspace.setAttribute('aria-hidden', 'true');
        global.document.body.classList.remove('age-unit-evolution-open');
        global.RoyalArmiesImmersiveWorkspace?.sync?.();
        statusMessage = '';
        clearSelectedQuantities();
    }

    async function handlePromoteRank(catalogUnitId, rank, quantity) {
        if (actionInFlight) return;
        const api = resolveApi();
        if (!api?.promoteUnitRank) return;

        actionInFlight = true;
        statusMessage = 'Promoting unit rank…';
        renderStatus();

        try {
            const result = await api.promoteUnitRank({ catalogUnitId, rank, quantity });
            evolutionState = result;
            clearSelectedQuantities();
            statusMessage = `${result.quantityPromoted || quantity || 0} ${result.unitName || 'unit'}(s) promoted to ${result.promotionLabel || 'next rank'}.`;
            renderEvolution();
        } catch (error) {
            statusMessage = '';
            if (typeof global.showRiftError === 'function' && error?.code) {
                global.showRiftError(error.code, error.message);
            }
        } finally {
            actionInFlight = false;
        }
    }

    async function handleEvolveTier(catalogUnitId, rank, quantity) {
        if (actionInFlight) return;
        const api = resolveApi();
        if (!api?.evolveUnitTier) return;

        actionInFlight = true;
        statusMessage = 'Evolving unit tier…';
        renderStatus();

        try {
            const result = await api.evolveUnitTier({ catalogUnitId, rank, quantity });
            evolutionState = result;
            clearSelectedQuantities();
            statusMessage = `${result.unitsEvolved || quantity || 0} unit(s) evolved to ${result.toName || 'next tier'}.`;
            renderEvolution();
        } catch (error) {
            statusMessage = '';
            if (typeof global.showRiftError === 'function' && error?.code) {
                global.showRiftError(error.code, error.message);
            }
        } finally {
            actionInFlight = false;
        }
    }

    function onWorkspaceClick(event) {
        if (event.target.closest('#age-unit-evolution-close')) {
            event.preventDefault();
            close();
            return;
        }

        if (event.target.closest('#age-unit-evolution-open-barracks')) {
            event.preventDefault();
            close();
            global.RoyalArmiesAgeBarracks?.open();
            return;
        }

        const qtyBtn = event.target.closest('[data-evolution-qty]');
        if (qtyBtn) {
            event.preventDefault();
            const maxQty = Math.max(1, Math.floor(Number(qtyBtn.getAttribute('data-qty-max')) || 1));
            setSelectedQuantity(
                qtyBtn.getAttribute('data-catalog-unit-id'),
                qtyBtn.getAttribute('data-stack-rank'),
                qtyBtn.getAttribute('data-evolution-qty'),
                qtyBtn.getAttribute('data-qty-value'),
                maxQty
            );
            renderEvolution();
            return;
        }

        const actionBtn = event.target.closest('[data-evolution-action]');
        if (!actionBtn || actionBtn.disabled) return;

        const catalogUnitId = actionBtn.getAttribute('data-catalog-unit-id') || '';
        const rank = actionBtn.getAttribute('data-stack-rank') || '';
        const quantity = actionBtn.getAttribute('data-action-qty') || '1';
        const action = actionBtn.getAttribute('data-evolution-action') || '';

        if (action === 'promote-rank') {
            event.preventDefault();
            void handlePromoteRank(catalogUnitId, rank, quantity);
        } else if (action === 'evolve-tier') {
            event.preventDefault();
            void handleEvolveTier(catalogUnitId, rank, quantity);
        }
    }

    function onWorkspaceKeydown(event) {
        if (event.key === 'Escape' && isOpen()) {
            event.preventDefault();
            close();
        }
    }

    function onEvolutionUpdated(event) {
        if (!isOpen()) return;
        evolutionState = event?.detail || evolutionState;
        renderEvolution();
    }

    function onWorkspaceInput(event) {
        const input = event.target.closest('[data-evolution-qty-input]');
        if (!input) return;
        handleManualQuantityInput(input);
    }

    function onWorkspaceChange(event) {
        const input = event.target.closest('[data-evolution-qty-input]');
        if (!input) return;
        commitManualQuantityInput(input);
    }

    function bindEvolutionChrome() {
        if (global.document.documentElement.dataset.ageUnitEvolutionChromeBound === 'true') return;
        global.document.documentElement.dataset.ageUnitEvolutionChromeBound = 'true';

        global.document.addEventListener('click', (event) => {
            if (!event.target.closest('#age-unit-evolution-close')) return;
            event.preventDefault();
            event.stopPropagation();
            close();
        }, true);
    }

    function bindEvolution() {
        if (bound) return;
        bound = true;

        bindEvolutionChrome();

        const workspace = resolveWorkspace();
        workspace?.addEventListener('click', onWorkspaceClick);
        workspace?.addEventListener('input', onWorkspaceInput);
        workspace?.addEventListener('change', onWorkspaceChange);
        global.document.addEventListener('keydown', onWorkspaceKeydown);
        global.addEventListener('royalarmies:age-unit-evolution-updated', onEvolutionUpdated);
        global.addEventListener('royalarmies:age-guild-updated', onEvolutionUpdated);
    }

    function enableAgeUnitEvolution() {
        bindEvolution();
    }

    global.RoyalArmiesAgeUnitEvolution = {
        open,
        close,
        isOpen,
        refreshState,
        enableAgeUnitEvolution
    };

    global.enableAgeUnitEvolution = enableAgeUnitEvolution;

    bindEvolutionChrome();
    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', bindEvolution, { once: true });
    } else {
        bindEvolution();
    }
})(window);

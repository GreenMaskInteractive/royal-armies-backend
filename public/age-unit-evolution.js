/**
 * RIFT — Unit Evolution workspace (rank promotions and tier evolution).
 */
(function initRoyalArmiesAgeUnitEvolution(global) {
    'use strict';

    let bound = false;
    let evolutionState = null;
    let actionInFlight = false;
    let statusMessage = '';

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

    function syncProvisionsDisplay() {
        const el = global.document.getElementById('age-unit-evolution-provisions');
        if (!el) return;
        const provisions = evolutionState?.ageProvisions;
        if (provisions !== undefined) {
            el.textContent = Math.max(0, Math.floor(Number(provisions) || 0)).toLocaleString('en-US');
        }
    }

    function resolveActionableStacks(stacks) {
        return (Array.isArray(stacks) ? stacks : []).filter((stack) => (
            stack && (stack.canPromoteRank || stack.canEvolveTier)
        ));
    }

    function renderStackList() {
        const listEl = global.document.getElementById('age-unit-evolution-stack-list');
        if (!listEl) return;

        const stacks = resolveActionableStacks(evolutionState?.stacks);
        if (!stacks.length) {
            listEl.innerHTML = (
                '<p class="age-unit-evolution-empty">'
                + 'No promotions or tier evolutions are available right now. '
                + 'Units earn XP from battles they fight and survive — ready stacks will appear here when you can spend provisions.'
                + '</p>'
            );
            return;
        }

        listEl.innerHTML = stacks.map((stack) => {
            const readyBadge = stack.readyToPromote
                ? '<span class="age-unit-evolution-ready-badge">Ready</span>'
                : '';

            const actionButtons = [];
            if (stack.canPromoteRank) {
                actionButtons.push(
                    `<button type="button" class="age-unit-evolution-action-btn" data-evolution-action="promote-rank" data-catalog-unit-id="${escapeHtml(stack.catalogUnitId)}" data-stack-rank="${escapeHtml(stack.rank)}">Promote to ${escapeHtml(stack.nextPromotionLabel)} (${escapeHtml(stack.rankPromotionCost)} provisions)</button>`
                );
            }
            if (stack.canEvolveTier) {
                actionButtons.push(
                    `<button type="button" class="age-unit-evolution-action-btn age-unit-evolution-action-btn--evolve" data-evolution-action="evolve-tier" data-catalog-unit-id="${escapeHtml(stack.catalogUnitId)}" data-stack-rank="${escapeHtml(stack.rank)}">Evolve to ${escapeHtml(stack.evolveTargetName)} (${escapeHtml(stack.tierEvolutionCost)} provisions)</button>`
                );
            }

            return (
                `<article class="age-unit-evolution-stack${stack.readyToPromote ? ' is-ready' : ''}">`
                + `<header class="age-unit-evolution-stack-head">`
                + `<h3 class="age-unit-evolution-stack-name">${escapeHtml(stack.name)}</h3>`
                + readyBadge
                + '</header>'
                + `<p class="age-unit-evolution-stack-meta">${escapeHtml(stack.healthyQty)} healthy · Tier ${escapeHtml(stack.tier)} · ${escapeHtml(stack.currentPromotionLabel)}</p>`
                + `<div class="age-unit-evolution-stack-actions">${actionButtons.join('')}</div>`
                + '</article>'
            );
        }).join('');
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
            const actionable = resolveActionableStacks(evolutionState?.stacks).length;
            readyEl.textContent = actionable
                ? `${actionable} stack(s) ready for provisions spend`
                : '';
            readyEl.hidden = !actionable;
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
        const workspace = resolveWorkspace();
        if (!workspace) return;

        workspace.hidden = false;
        workspace.setAttribute('aria-hidden', 'false');
        global.document.body.classList.add('age-unit-evolution-open');
        statusMessage = '';

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
        statusMessage = '';
    }

    async function handlePromoteRank(catalogUnitId, rank) {
        if (actionInFlight) return;
        const api = resolveApi();
        if (!api?.promoteUnitRank) return;

        actionInFlight = true;
        statusMessage = 'Promoting unit rank…';
        renderStatus();

        try {
            const result = await api.promoteUnitRank({ catalogUnitId, rank });
            evolutionState = result;
            statusMessage = `${result.unitName || 'Unit'} promoted to ${result.promotionLabel || 'next rank'}.`;
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

    async function handleEvolveTier(catalogUnitId, rank) {
        if (actionInFlight) return;
        const api = resolveApi();
        if (!api?.evolveUnitTier) return;

        actionInFlight = true;
        statusMessage = 'Evolving unit tier…';
        renderStatus();

        try {
            const result = await api.evolveUnitTier({ catalogUnitId, rank });
            evolutionState = result;
            statusMessage = `${result.unitsEvolved || 0} unit(s) evolved to ${result.toName || 'next tier'}.`;
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

        const actionBtn = event.target.closest('[data-evolution-action]');
        if (!actionBtn || actionBtn.disabled) return;

        const catalogUnitId = actionBtn.getAttribute('data-catalog-unit-id') || '';
        const rank = actionBtn.getAttribute('data-stack-rank') || '';
        const action = actionBtn.getAttribute('data-evolution-action') || '';

        if (action === 'promote-rank') {
            event.preventDefault();
            void handlePromoteRank(catalogUnitId, rank);
        } else if (action === 'evolve-tier') {
            event.preventDefault();
            void handleEvolveTier(catalogUnitId, rank);
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

    function bindEvolution() {
        if (bound) return;
        bound = true;

        const workspace = resolveWorkspace();
        workspace?.addEventListener('click', onWorkspaceClick);
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
})(window);

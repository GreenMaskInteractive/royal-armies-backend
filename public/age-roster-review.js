/**
 * RIFT — Garrison roster review workspace (unit stats and dismissal).
 */
(function initRoyalArmiesAgeRosterReview(global) {
    'use strict';

    let bound = false;
    let rosterState = null;
    let selectedUnitIds = new Set();
    let actionInFlight = false;
    let statusMessage = '';
    let dismissConfirmPending = false;

    const UNIT_TYPE_ORDER = Object.freeze([
        'infantry',
        'cavalry',
        'beasts',
        'ranged',
        'artillery',
        'magic'
    ]);

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function resolveWorkspace() {
        return global.document.getElementById('age-roster-review-workspace');
    }

    function resolveApi() {
        return global.RoyalArmiesAgeRosterReviewApi || null;
    }

    function isOpen() {
        const workspace = resolveWorkspace();
        return Boolean(workspace && !workspace.hidden);
    }

    function formatCommanderRankLabel(rank, path, rankTitleGender) {
        const rankTitles = global.RoyalArmiesCommanderRankTitles;
        if (rankTitles?.formatCommanderRankLabel) {
            return rankTitles.formatCommanderRankLabel(rank, path, rankTitleGender);
        }
        return String(Math.max(1, Math.floor(Number(rank) || 1)));
    }

    function resolveCommanderRankTitleGender() {
        const player = typeof global.player !== 'undefined' ? global.player : null;
        if (global.RoyalArmiesCommanderRankTitles?.resolveCommanderRankTitleGender) {
            return global.RoyalArmiesCommanderRankTitles.resolveCommanderRankTitleGender(
                player?.rankTitleGender ?? global.RoyalArmiesCommanderRankTitles.readSelfRankTitleGender?.()
            );
        }
        return String(player?.rankTitleGender || 'male').trim().toLowerCase() === 'female'
            ? 'female'
            : 'male';
    }

    function formatGold(value) {
        const api = global.RoyalArmiesUnitPurchaseCatalog;
        if (api?.formatGold) return api.formatGold(value);
        return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('en-US');
    }

    function getRosterUnits() {
        return Array.isArray(rosterState?.units) ? rosterState.units : [];
    }

    function getRosterGroups() {
        if (Array.isArray(rosterState?.groups) && rosterState.groups.length) {
            return rosterState.groups;
        }
        return groupUnitsForDisplay(getRosterUnits());
    }

    function groupUnitsForDisplay(units) {
        const typeMap = new Map();

        units.forEach((unit) => {
            const unitType = unit.unitType || 'infantry';
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

        return UNIT_TYPE_ORDER
            .filter((unitType) => typeMap.has(unitType))
            .map((unitType) => {
                const tierMap = typeMap.get(unitType);
                const tiers = [...tierMap.keys()]
                    .sort((left, right) => right - left)
                    .map((tier) => ({
                        tier,
                        units: tierMap.get(tier)
                    }));
                return {
                    unitType,
                    typeLabel: unit.typeLabel || unitType,
                    tiers
                };
            });
    }

    function countSelectedUnits() {
        return getRosterUnits().filter((unit) => selectedUnitIds.has(unit.id)).length;
    }

    function formatSelectionSummary() {
        const totalUnits = getRosterUnits().length;
        const selectedCount = countSelectedUnits();
        if (!totalUnits) return 'No units in garrison.';
        if (!selectedCount) {
            return `${totalUnits} garrison ${totalUnits === 1 ? 'unit' : 'units'} · click rows to select for dismissal`;
        }
        return `${selectedCount} selected · ${totalUnits} garrison total`;
    }

    function formatUnitStatsMeta(unit) {
        const parts = [
            unit.promotionLabel || 'Apprentice',
            `HP ${unit.hp ?? '—'}`,
            `Str ${unit.str ?? '—'}`
        ];
        if (unit.rng !== null && unit.rng !== undefined) {
            parts.push(`Rng ${unit.rng}`);
        }
        parts.push(`UPC ${unit.upc ?? '—'}`);
        parts.push(`XP ${Math.max(0, Math.floor(Number(unit.unitXp) || 0))}/${Math.max(0, Math.floor(Number(unit.unitXpRequired) || 0))}`);
        if (unit.isInjured) parts.push('Injured');
        if (unit.purpose === 'pvp') parts.push('PvP');
        return parts.join(' · ');
    }

    function renderUnitRow(unit) {
        const isSelected = selectedUnitIds.has(unit.id);
        const statusLabel = isSelected ? 'Selected' : (unit.isInjured ? 'Injured' : 'Ready');
        return (
            `<li class="age-roster-review-unit-item" role="presentation">`
            + `<button type="button" class="age-roster-review-unit-row${isSelected ? ' is-selected' : ''}${unit.isInjured ? ' is-injured' : ''}"`
            + ` data-roster-unit-id="${escapeHtml(unit.id)}"`
            + ` role="option"`
            + ` aria-selected="${isSelected ? 'true' : 'false'}"`
            + ` aria-label="${escapeHtml(unit.label)} — ${escapeHtml(formatUnitStatsMeta(unit))}">`
            + `<span class="age-roster-review-unit-mark" aria-hidden="true">${escapeHtml(unit.mark || 'U')}</span>`
            + '<div class="age-roster-review-unit-main">'
            + `<span class="age-roster-review-unit-name">${escapeHtml(unit.label)}</span>`
            + `<span class="age-roster-review-unit-meta">${escapeHtml(formatUnitStatsMeta(unit))}</span>`
            + '</div>'
            + `<span class="age-roster-review-unit-status">${escapeHtml(statusLabel)}</span>`
            + '</button>'
            + '</li>'
        );
    }

    function renderGroupedRoster() {
        const groups = getRosterGroups();
        return groups.map((typeGroup) => (
            '<section class="age-roster-review-type-group"'
            + ` aria-label="${escapeHtml(typeGroup.typeLabel)} units">`
            + `<h4 class="age-roster-review-type-title">${escapeHtml(typeGroup.typeLabel)}</h4>`
            + typeGroup.tiers.map((tierGroup) => (
                '<section class="age-roster-review-tier-group"'
                + ` aria-label="Tier ${escapeHtml(tierGroup.tier)} ${escapeHtml(typeGroup.typeLabel)}">`
                + `<h5 class="age-roster-review-tier-title">Tier ${escapeHtml(tierGroup.tier)}</h5>`
                + '<ul class="age-roster-review-unit-list" role="listbox"'
                + ` aria-label="Tier ${escapeHtml(tierGroup.tier)} units" aria-multiselectable="true">`
                + tierGroup.units.map((unit) => renderUnitRow(unit)).join('')
                + '</ul>'
                + '</section>'
            )).join('')
            + '</section>'
        )).join('');
    }

    function renderRosterBody() {
        const totalUnits = getRosterUnits().length;
        if (!totalUnits) {
            return (
                '<section class="age-roster-review-roster" aria-label="Garrison roster">'
                + '<div class="age-roster-review-roster-empty">'
                + '<p class="age-roster-review-roster-empty-copy">Your garrison is empty. Recruit units from the Garrison Registry to build your army.</p>'
                + '</div>'
                + '</section>'
            );
        }

        const selectedCount = countSelectedUnits();
        return (
            '<section class="age-roster-review-roster" aria-label="Garrison roster">'
            + '<div class="age-roster-review-roster-head">'
            + '<h3 class="age-roster-review-roster-title">Garrison Units</h3>'
            + `<p class="age-roster-review-roster-summary">${escapeHtml(formatSelectionSummary())}</p>`
            + '</div>'
            + '<div class="age-roster-review-grouped-roster">'
            + renderGroupedRoster()
            + '</div>'
            + '<section class="age-roster-review-dismiss-toolbar" aria-label="Dismiss selected units">'
            + `<button type="button" class="age-roster-review-dismiss-btn age-roster-review-dismiss-btn--primary"`
            + ` data-roster-dismiss="selected"${selectedCount ? '' : ' disabled'}>`
            + `Dismiss Selected${selectedCount ? ` (${selectedCount})` : ''}</button>`
            + '</section>'
            + '</section>'
        );
    }

    function syncCommanderHeader() {
        const commander = rosterState?.commander || {};
        const player = typeof global.player !== 'undefined' ? global.player : null;
        const displayName = commander.displayName
            || player?.name
            || player?.username
            || commander.username
            || 'Commander';
        const rankLabel = formatCommanderRankLabel(
            commander.rank,
            commander.path,
            resolveCommanderRankTitleGender()
        );

        const nameEl = global.document.getElementById('age-roster-review-commander-name');
        if (nameEl) nameEl.textContent = displayName;

        const classEl = global.document.getElementById('age-roster-review-commander-class');
        if (classEl) {
            classEl.textContent = `${commander.classLabel || 'Battlemaster'} · ${rankLabel}`;
        }

        const armyEl = global.document.getElementById('age-roster-review-commander-army');
        if (armyEl) {
            const total = Math.max(0, Math.floor(Number(commander.unitsTotal) || 0));
            const injured = Math.max(0, Math.floor(Number(commander.unitsInjured) || 0));
            const healthy = Math.max(0, Math.floor(Number(commander.unitsHealthy) || 0));
            armyEl.textContent = `${total} total · ${healthy} ready · ${injured} injured`;
        }

        const goldEl = global.document.getElementById('age-roster-review-commander-gold');
        if (goldEl) goldEl.textContent = formatGold(commander.ageGold);

        const provisionsEl = global.document.getElementById('age-roster-review-commander-provisions');
        if (provisionsEl) {
            provisionsEl.textContent = Math.max(0, Math.floor(Number(commander.ageProvisions) || 0)).toLocaleString('en-US');
        }
    }

    function syncStatusMessage() {
        const statusEl = global.document.getElementById('age-roster-review-status');
        if (!statusEl) return;
        if (!statusMessage) {
            statusEl.hidden = true;
            statusEl.textContent = '';
            return;
        }
        statusEl.hidden = false;
        statusEl.textContent = statusMessage;
    }

    function renderRosterReview() {
        syncCommanderHeader();
        syncStatusMessage();

        const bodyEl = global.document.getElementById('age-roster-review-body');
        if (bodyEl) {
            bodyEl.innerHTML = renderRosterBody();
        }
    }

    function pruneSelectedUnitIds() {
        const validIds = new Set(getRosterUnits().map((unit) => unit.id));
        selectedUnitIds = new Set([...selectedUnitIds].filter((id) => validIds.has(id)));
    }

    async function refreshState() {
        const api = resolveApi();
        if (!api?.fetchRosterReviewState) {
            throw new Error('Roster review API unavailable.');
        }
        rosterState = await api.fetchRosterReviewState();
        pruneSelectedUnitIds();
        renderRosterReview();
        return rosterState;
    }

    function toggleUnitSelection(unitId) {
        const id = String(unitId || '').trim();
        if (!id || !getRosterUnits().some((unit) => unit.id === id)) return;

        if (selectedUnitIds.has(id)) {
            selectedUnitIds.delete(id);
        } else {
            selectedUnitIds.add(id);
        }
        statusMessage = '';
        renderRosterReview();
    }

    async function dismissSelectedUnits() {
        if (actionInFlight || dismissConfirmPending) return;

        const selected = getRosterUnits()
            .filter((unit) => selectedUnitIds.has(unit.id))
            .map((unit) => unit.id);
        if (!selected.length) {
            statusMessage = 'Select units to dismiss, then choose Dismiss Selected.';
            renderRosterReview();
            return;
        }

        const countLabel = selected.length === 1 ? '1 unit' : `${selected.length} units`;
        const confirmMessage = `Dismiss ${countLabel} from your garrison? This cannot be undone.`;

        if (typeof global.showPortalConfirm === 'function') {
            dismissConfirmPending = true;
            const confirmed = await global.showPortalConfirm({
                title: 'Dismiss garrison units',
                message: confirmMessage,
                confirmLabel: 'Dismiss',
                cancelLabel: 'Keep units'
            });
            dismissConfirmPending = false;
            if (!confirmed) return;
        } else if (!global.confirm(confirmMessage)) {
            return;
        }

        const api = resolveApi();
        if (!api?.dismissRosterUnits) return;

        actionInFlight = true;
        statusMessage = 'Dismissing selected units…';
        renderRosterReview();

        try {
            const payload = await api.dismissRosterUnits({ unitIds: selected });
            selectedUnitIds = new Set();
            rosterState = payload;
            const dismissed = Math.max(0, Math.floor(Number(payload.unitsDismissed) || selected.length));
            const dismissedLabel = dismissed === 1 ? '1 unit' : `${dismissed} units`;
            statusMessage = `${dismissedLabel} dismissed from garrison.`;
            renderRosterReview();
        } catch (error) {
            console.warn('[RIFT] Roster dismiss failed:', error);
            statusMessage = error?.message || 'Could not dismiss selected units.';
            renderRosterReview();
            if (typeof global.showRiftError === 'function' && error?.code) {
                global.showRiftError(error.code, error.message);
            }
        } finally {
            actionInFlight = false;
        }
    }

    async function open() {
        bindRosterReview();

        const workspace = resolveWorkspace();
        if (!workspace) return;

        global.RoyalArmiesSettlementVenueWorkspaces?.close?.();
        global.RoyalArmiesAdventurersGuild?.dismissGuildWorkspacesForSettlementAction?.();
        global.RoyalArmiesAgeBarracks?.close?.();
        global.RoyalArmiesAgeUnitEvolution?.close?.();

        workspace.hidden = false;
        workspace.setAttribute('aria-hidden', 'false');
        global.document.body.classList.add('age-roster-review-open');
        global.RoyalArmiesImmersiveWorkspace?.sync?.();
        statusMessage = '';
        selectedUnitIds = new Set();

        const bodyEl = global.document.getElementById('age-roster-review-body');
        if (bodyEl) {
            bodyEl.innerHTML = '<p class="age-roster-review-loading">Loading garrison roster…</p>';
        }

        try {
            await refreshState();
        } catch (error) {
            console.warn('[RIFT] Roster review load failed:', error);
            if (bodyEl) {
                bodyEl.innerHTML = '<p class="age-roster-review-empty">Could not load garrison roster. Try again shortly.</p>';
            }
            if (typeof global.showRiftError === 'function' && error?.code) {
                global.showRiftError(error.code, error.message);
            }
        }

        global.document.getElementById('age-roster-review-close')?.focus();
    }

    function close() {
        const workspace = resolveWorkspace();
        if (!workspace) return;

        workspace.hidden = true;
        workspace.setAttribute('aria-hidden', 'true');
        global.document.body.classList.remove('age-roster-review-open');
        global.RoyalArmiesImmersiveWorkspace?.sync?.();
        statusMessage = '';
        selectedUnitIds = new Set();
        dismissConfirmPending = false;
    }

    function onWorkspaceClick(event) {
        const unitBtn = event.target.closest('[data-roster-unit-id]');
        if (unitBtn) {
            event.preventDefault();
            toggleUnitSelection(unitBtn.getAttribute('data-roster-unit-id'));
            return;
        }

        if (event.target.closest('[data-roster-dismiss="selected"]')) {
            event.preventDefault();
            void dismissSelectedUnits();
            return;
        }

        if (event.target.closest('#age-roster-review-close')) {
            event.preventDefault();
            close();
            return;
        }

        if (event.target.closest('#age-roster-review-open-registry')) {
            event.preventDefault();
            close();
            global.RoyalArmiesAgeBarracks?.open?.();
        }
    }

    function onWorkspaceKeydown(event) {
        if (event.key === 'Escape' && isOpen()) {
            event.preventDefault();
            close();
        }
    }

    function onRosterUpdated() {
        if (!isOpen()) return;
        void refreshState().catch((error) => {
            console.warn('[RIFT] Roster review refresh failed:', error);
        });
    }

    function bindRosterReview() {
        if (bound) return;
        bound = true;

        const workspace = resolveWorkspace();
        workspace?.addEventListener('click', onWorkspaceClick);
        global.document.addEventListener('keydown', onWorkspaceKeydown);
        global.addEventListener('royalarmies:age-roster-review-updated', onRosterUpdated);
        global.addEventListener('royalarmies:age-recruitment-updated', onRosterUpdated);
    }

    global.RoyalArmiesAgeRosterReview = Object.freeze({
        open,
        close,
        isOpen,
        bindRosterReview,
        enableAgeRosterReview: bindRosterReview
    });

    global.enableAgeRosterReview = bindRosterReview;

    if (global.document?.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', bindRosterReview, { once: true });
    } else {
        bindRosterReview();
    }
})(typeof window !== 'undefined' ? window : globalThis);

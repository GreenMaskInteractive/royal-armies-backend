/**
 * RIFT — Settlement venue buttons → full-screen workspaces (map city-info tab or legacy settlement page).
 */
(function initRoyalArmiesSettlementVenueWorkspaces(global) {
    'use strict';

    const GARRISON_HUB_ACTIONS = Object.freeze([
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
    }

    function dismissAllWorkspaces() {
        global.RoyalArmiesAgeBarracks?.close?.();
        global.RoyalArmiesAgeUnitEvolution?.close?.();
        global.RoyalArmiesAdventurersGuild?.dismissGuildWorkspacesForSettlementAction?.();
        closeGenericVenueWorkspace();
    }

    function closeGenericVenueWorkspace() {
        const workspace = resolveVenueWorkspace();
        if (!workspace) return;

        workspace.hidden = true;
        workspace.setAttribute('aria-hidden', 'true');
        setVenueWorkspaceOpen(false);
        activeVenueId = '';
    }

    function openGenericVenueWorkspace(options = {}) {
        const workspace = resolveVenueWorkspace();
        const titleEl = global.document.getElementById('age-settlement-venue-title');
        const eyebrowEl = global.document.getElementById('age-settlement-venue-eyebrow');
        const subtitleEl = global.document.getElementById('age-settlement-venue-subtitle');
        const bodyEl = global.document.getElementById('age-settlement-venue-body');
        if (!workspace || !titleEl || !bodyEl) return;

        if (eyebrowEl) eyebrowEl.textContent = options.eyebrow || 'Settlement';
        titleEl.textContent = options.title || 'Venue';
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
    }

    function renderActionHub(actions, actionAttr) {
        return (
            '<div class="age-settlement-venue-action-hub" role="list">'
            + actions.map((action) => (
                `<button type="button" class="age-settlement-venue-action" role="listitem"`
                + ` ${actionAttr}="${escapeHtml(action.id)}">`
                + `<span class="age-settlement-venue-action-label">${escapeHtml(action.label)}</span>`
                + `<span class="age-settlement-venue-action-desc">${escapeHtml(action.description)}</span>`
                + '</button>'
            )).join('')
            + '</div>'
        );
    }

    function renderPlaceholderBody(venue) {
        const note = venue?.placeholderNote
            || 'This workspace is under construction. Check back after the next Age of War update.';
        return (
            '<div class="age-settlement-venue-placeholder">'
            + `<p class="age-settlement-venue-placeholder-copy">${escapeHtml(note)}</p>`
            + '</div>'
        );
    }

    function renderInfirmaryBody() {
        return (
            '<div class="age-settlement-venue-infirmary">'
            + '<p class="age-settlement-venue-infirmary-copy">Restore injured units at this settlement infirmary.</p>'
            + '<div class="age-settlement-venue-infirmary-actions">'
            + '<button type="button" class="age-settlement-venue-infirmary-btn" data-settlement-infirmary-heal="one">Heal One Unit</button>'
            + '<button type="button" class="age-settlement-venue-infirmary-btn age-settlement-venue-infirmary-btn--primary" data-settlement-infirmary-heal="all">Heal Entire Army</button>'
            + '</div>'
            + '<p id="age-settlement-infirmary-status" class="age-settlement-venue-infirmary-status" aria-live="polite"></p>'
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

    function openBarracksHub(detail) {
        const venue = detail?.venue || {};
        openGenericVenueWorkspace({
            venueId: 'barracks',
            eyebrow: 'Barracks',
            title: venue.label || 'Barracks',
            subtitle: venue.description || '',
            bodyHtml: renderActionHub(GARRISON_HUB_ACTIONS, 'data-barracks-hub-action')
        });
    }

    function openPlaceholderVenue(detail) {
        const venue = detail?.venue || {};
        let placeholderNote = '';

        if (detail?.venueId === 'border') {
            placeholderNote = 'Border battle training and assault drills will open here. Use the world map Army Groups panel until this workspace ships.';
        } else if (detail?.venueId === 'arenas') {
            placeholderNote = 'Continent-wide commander tournaments and spectator betting will open here for citadel settlements.';
        }

        openGenericVenueWorkspace({
            venueId: detail?.venueId || '',
            eyebrow: 'Settlement',
            title: venue.label || detail?.venueId || 'Venue',
            subtitle: venue.description || '',
            bodyHtml: renderPlaceholderBody({ placeholderNote })
        });
    }

    async function openInfirmary(detail) {
        const venue = detail?.venue || {};
        const tier = String(detail?.settlementTier || 'village').trim().toLowerCase();
        global.RoyalArmiesAgeGuildTraining?.setSettlementTier?.(tier);

        openGenericVenueWorkspace({
            venueId: 'infirmary',
            eyebrow: 'Infirmary',
            title: venue.label || 'Infirmary',
            subtitle: venue.description || '',
            bodyHtml: renderInfirmaryBody()
        });
    }

    async function openVenue(detail = {}) {
        if (!resolveVenueWorkspace()) return;

        const venueId = String(detail?.venueId || '').trim().toLowerCase();
        if (!venueId) return;

        dismissAllWorkspaces();

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
            openBarracksHub(detail);
            return;
        }

        if (venueId === 'infirmary') {
            await openInfirmary(detail);
            return;
        }

        openPlaceholderVenue(detail);
    }

    function onBarracksHubClick(event) {
        const actionBtn = event.target.closest('[data-barracks-hub-action]');
        if (!actionBtn || activeVenueId !== 'barracks') return;

        event.preventDefault();
        const actionId = actionBtn.getAttribute('data-barracks-hub-action');
        closeGenericVenueWorkspace();

        if (actionId === 'registry') {
            void global.RoyalArmiesAgeBarracks?.open?.();
            return;
        }
        if (actionId === 'evolution') {
            void global.RoyalArmiesAgeUnitEvolution?.open?.({ highlightReady: true });
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
            closeGenericVenueWorkspace();
            return;
        }
        onBarracksHubClick(event);
        onInfirmaryClick(event);
    }

    function onVenueWorkspaceKeydown(event) {
        if (event.key !== 'Escape') return;
        const workspace = resolveVenueWorkspace();
        if (!workspace || workspace.hidden) return;
        event.preventDefault();
        closeGenericVenueWorkspace();
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
        close: closeGenericVenueWorkspace,
        dismissAll: dismissAllWorkspaces,
        enableAgeSettlementVenueWorkspaces
    };
    global.enableAgeSettlementVenueWorkspaces = enableAgeSettlementVenueWorkspaces;
})(window);

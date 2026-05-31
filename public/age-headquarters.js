/**
 * RIFT — Age Headquarters (nation leadership workspace + SF planning).
 */
(function initAgeHeadquarters(global) {
    'use strict';

    const MOCK_DIPLO_INCOMING = [
        { id: 'nap-1', type: 'NAP', nation: 'Lyllis', status: 'Awaiting council review' },
        { id: 'ally-1', type: 'Alliance', nation: 'Saelthine', status: 'Awaiting council review' }
    ];

    const MOCK_DIPLO_OUTGOING = [
        { id: 'out-1', type: 'Alliance', nation: 'Mynor', status: 'Pending response' }
    ];

    const MOCK_VOTE_CANDIDATES = [
        { id: 'cmd-a', name: 'Commander Aldric', roleHint: 'Field Marshal' },
        { id: 'cmd-b', name: 'Commander Brenna', roleHint: 'Quartermaster' },
        { id: 'cmd-c', name: 'Commander Corin', roleHint: 'Scout Captain' },
        { id: 'cmd-d', name: 'Commander Dara', roleHint: 'Diplomat' }
    ];

    let workspaceEl = null;
    let mounted = false;
    let activeDiploTab = 'incoming';
    let activeMarkerType = '';
    let leaderVote = '';
    let viceVote = '';
    let councilAccess = false;

    function resolveUsername() {
        const saved = global.localStorage.getItem('activeCommanderUser');
        if (saved && saved.trim()) return saved.trim();
        if (typeof global.getActiveCommanderUsername === 'function') {
            return String(global.getActiveCommanderUsername() || '').trim();
        }
        return '';
    }

    function resolveCouncilLeadershipAccess() {
        if (!resolveUsername()) return false;
        // Alpha stub — server role sync will replace this gate.
        return global.localStorage.getItem('ageHqCouncilAccess') !== 'false';
    }

    function setCouncilAccessUI(hasAccess) {
        councilAccess = hasAccess;
        global.document.querySelectorAll('[data-hq-council-only]').forEach((node) => {
            node.hidden = !hasAccess;
        });
        const restricted = global.document.getElementById('age-hq-council-restricted-notice');
        if (restricted) restricted.hidden = hasAccess;
        const councilNote = global.document.querySelector('.age-headquarters-council-only-note');
        if (councilNote) councilNote.hidden = hasAccess;
    }

    function renderDiploRequests() {
        const listEl = global.document.getElementById('age-hq-diplo-request-list');
        if (!listEl) return;

        const rows = activeDiploTab === 'outgoing' ? MOCK_DIPLO_OUTGOING : MOCK_DIPLO_INCOMING;
        if (!rows.length) {
            listEl.innerHTML = '<li class="age-headquarters-request-empty">No requests in this queue.</li>';
            return;
        }

        listEl.innerHTML = rows.map((row) => (
            `<li class="age-headquarters-request-item">`
            + `<span class="age-headquarters-request-type">${row.type}</span>`
            + `<strong class="age-headquarters-request-nation">${row.nation}</strong>`
            + `<span class="age-headquarters-request-status">${row.status}</span>`
            + `<div class="age-headquarters-request-actions">`
            + `<button type="button" class="age-headquarters-request-btn" data-hq-diplo-action="review" data-request-id="${row.id}">Review</button>`
            + `</div>`
            + `</li>`
        )).join('');
    }

    function populateWarTargetSelect() {
        const select = global.document.getElementById('age-hq-war-target-select');
        if (!select) return;

        const catalog = global.RoyalArmiesAgeWorldMap?.getCatalog?.();
        const playerNation = global.RoyalArmiesAgeMovement?.resolvePlayerNationId?.() || '';
        const nations = new Map();

        (catalog?.cities || []).forEach((city) => {
            const id = String(city.nationId || '').trim().toLowerCase();
            if (!id || id === playerNation) return;
            if (!nations.has(id)) {
                nations.set(id, city.nationName || id);
            }
        });

        const previous = select.value;
        select.innerHTML = '<option value="">Select nation…</option>'
            + Array.from(nations.entries())
                .sort((a, b) => a[1].localeCompare(b[1]))
                .map(([id, name]) => `<option value="${id}">${name}</option>`)
                .join('');
        if (previous && nations.has(previous)) select.value = previous;
    }

    function renderLeaderVoteSlots() {
        const host = global.document.getElementById('age-hq-leader-vote-slots');
        if (!host) return;

        host.innerHTML = MOCK_VOTE_CANDIDATES.map((candidate) => (
            `<article class="age-headquarters-vote-card" data-candidate-id="${candidate.id}">`
            + `<header class="age-headquarters-vote-card-head">`
            + `<h4 class="age-headquarters-vote-name">${candidate.name}</h4>`
            + `<p class="age-headquarters-vote-role">${candidate.roleHint}</p>`
            + `</header>`
            + `<div class="age-headquarters-vote-actions">`
            + `<button type="button" class="age-headquarters-vote-btn${leaderVote === candidate.id ? ' is-selected' : ''}" data-hq-vote-role="leader" data-candidate-id="${candidate.id}">Vote Leader</button>`
            + `<button type="button" class="age-headquarters-vote-btn${viceVote === candidate.id ? ' is-selected' : ''}" data-hq-vote-role="vice" data-candidate-id="${candidate.id}">Vote Vice</button>`
            + `</div>`
            + `</article>`
        )).join('');
    }

    function updateVoteStatus() {
        const statusEl = global.document.getElementById('age-hq-vote-status');
        if (!statusEl) return;

        const leaderName = MOCK_VOTE_CANDIDATES.find((c) => c.id === leaderVote)?.name || '—';
        const viceName = MOCK_VOTE_CANDIDATES.find((c) => c.id === viceVote)?.name || '—';
        statusEl.textContent = `Leader: ${leaderName} · Vice Leader: ${viceName}`;
    }

    function syncToolbarState() {
        const toolbar = global.document.getElementById('age-hq-planning-toolbar');
        if (!toolbar) return;

        const planningMap = global.RoyalArmiesAgeHeadquartersPlanningMap;
        const hasPills = (planningMap?.getPills?.() || []).length > 0;
        const hasSelection = Boolean(planningMap?.getSelectedBorderCityId?.());
        const canPlaceMarker = Boolean(planningMap?.isSelectedCityPlannable?.());
        const canReset = councilAccess && (hasPills || hasSelection || activeMarkerType);

        toolbar.querySelectorAll('[data-hq-marker]').forEach((button) => {
            button.disabled = !canPlaceMarker || !councilAccess;
            button.classList.toggle('is-active', canPlaceMarker && button.getAttribute('data-hq-marker') === activeMarkerType);
        });

        const resetBtn = global.document.getElementById('age-hq-planning-reset-btn');
        if (resetBtn) resetBtn.disabled = !canReset;

        const statusEl = global.document.getElementById('age-hq-planning-toolbar-status');
        if (statusEl) {
            if (!councilAccess) {
                statusEl.textContent = 'Council access required';
            } else if (activeMarkerType) {
                statusEl.textContent = `Active · ${activeMarkerType.toUpperCase()}`;
            } else if (hasPills) {
                statusEl.textContent = `${(planningMap?.getPills?.() || []).length} markers placed`;
            } else if (canPlaceMarker) {
                statusEl.textContent = 'Target city selected';
            } else if (hasSelection) {
                statusEl.textContent = 'Invalid chain target';
            } else {
                statusEl.textContent = 'Awaiting first border city';
            }
        }

        const hint = global.document.getElementById('age-hq-planning-hint');
        if (hint) {
            if (!councilAccess) {
                hint.textContent = 'SF Planning markers require Council or Leader access.';
            } else if (!canPlaceMarker && !hasPills) {
                hint.textContent = 'Select a city bordering your current location to start the plan.';
            } else if (!canPlaceMarker && hasPills) {
                hint.textContent = 'Select the next city bordering your previous marker to extend the plan.';
            } else if (activeMarkerType) {
                hint.textContent = `Active marker: ${activeMarkerType.toUpperCase()}. Click the map city again or use Set SF to stack multiple SFs. Hover a pill and click to replace it.`;
            } else if (hasPills) {
                hint.textContent = 'Extend the chain: select a city bordering your last marker, then choose a tool.';
            } else {
                hint.textContent = 'Choose a marker tool, then place it on the selected border city.';
            }
        }
    }

    function resetPlanningMap() {
        global.RoyalArmiesAgeHeadquartersPlanningMap?.resetPlanningMap?.();
        setActiveMarkerType('');
        syncToolbarState();
    }

    function setActiveMarkerType(type) {
        activeMarkerType = type || '';
        global.RoyalArmiesAgeHeadquartersPlanningMap?.setActiveMarkerType(activeMarkerType);
        syncToolbarState();
    }

    function onBorderCitySelected() {
        syncToolbarState();
    }

    function bindUi() {
        if (mounted) return;
        mounted = true;

        workspaceEl = global.document.getElementById('age-headquarters-workspace');

        global.document.querySelectorAll('[data-hq-diplo-tab]').forEach((tab) => {
            tab.addEventListener('click', () => {
                activeDiploTab = tab.getAttribute('data-hq-diplo-tab') || 'incoming';
                global.document.querySelectorAll('[data-hq-diplo-tab]').forEach((node) => {
                    const isActive = node === tab;
                    node.classList.toggle('is-active', isActive);
                    node.setAttribute('aria-selected', isActive ? 'true' : 'false');
                    node.tabIndex = isActive ? 0 : -1;
                });
                renderDiploRequests();
            });
        });

        global.document.getElementById('age-hq-diplo-compose-btn')?.addEventListener('click', () => {
            global.console.info('[RIFT] Alliance request composer — coming soon.');
        });

        global.document.getElementById('age-hq-war-declare-btn')?.addEventListener('click', () => {
            const select = global.document.getElementById('age-hq-war-target-select');
            const feedback = global.document.getElementById('age-hq-war-feedback');
            const target = select?.value || '';
            if (!feedback) return;

            if (!target) {
                feedback.hidden = false;
                feedback.textContent = 'Select a target nation before sending a declaration.';
                feedback.classList.add('is-error');
                return;
            }

            feedback.hidden = false;
            feedback.textContent = `Declaration draft prepared against ${select.options[select.selectedIndex].text}. Server confirmation coming soon.`;
            feedback.classList.remove('is-error');
        });

        global.document.getElementById('age-hq-planning-toolbar')?.addEventListener('click', (event) => {
            const resetButton = event.target.closest('[data-hq-planning-reset]');
            if (resetButton) {
                if (resetButton.disabled) return;
                resetPlanningMap();
                return;
            }

            const button = event.target.closest('[data-hq-marker]');
            if (!button || button.disabled) return;
            const type = button.getAttribute('data-hq-marker');
            setActiveMarkerType(type);

            if (type === 'sf') {
                global.RoyalArmiesAgeHeadquartersPlanningMap?.placeMarkerOnSelectedCity?.(type);
            } else {
                global.RoyalArmiesAgeHeadquartersPlanningMap?.placeMarkerOnSelectedCity?.(type);
            }
        });

        global.document.getElementById('age-hq-leader-vote-slots')?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-hq-vote-role]');
            if (!button) return;
            const role = button.getAttribute('data-hq-vote-role');
            const candidateId = button.getAttribute('data-candidate-id');
            if (role === 'leader') {
                leaderVote = candidateId;
                if (viceVote === candidateId) viceVote = '';
            } else if (role === 'vice') {
                viceVote = candidateId;
                if (leaderVote === candidateId) leaderVote = '';
            }
            renderLeaderVoteSlots();
            updateVoteStatus();
        });

        global.document.getElementById('age-hq-diplo-request-list')?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-hq-diplo-action]');
            if (!button) return;
            global.console.info('[RIFT] Diplomacy review — coming soon.', button.dataset.requestId);
        });
    }

    async function ensurePlanningMap() {
        const host = global.document.getElementById('age-hq-planning-map-host');
        if (!host || host.dataset.hqMapMounted === 'true') return;

        const planningMap = global.RoyalArmiesAgeHeadquartersPlanningMap;
        if (!planningMap) return;

        planningMap.onBorderCitySelected = onBorderCitySelected;
        planningMap.onPillsChanged = () => syncToolbarState();

        const ok = await planningMap.mount(host);
        if (ok) host.dataset.hqMapMounted = 'true';
    }

    async function onViewOpen() {
        bindUi();
        setCouncilAccessUI(resolveCouncilLeadershipAccess());
        await ensurePlanningMap();
        populateWarTargetSelect();
        renderDiploRequests();
        renderLeaderVoteSlots();
        updateVoteStatus();
        syncToolbarState();
        global.RoyalArmiesAgeHeadquartersPlanningMap?.setEnabled(true);
        global.RoyalArmiesAgeMovementPanel?.refreshCityPlayers?.();
    }

    function onViewClose() {
        setActiveMarkerType('');
        global.RoyalArmiesAgeHeadquartersPlanningMap?.setEnabled(false);
    }

    function enable() {
        bindUi();
    }

    global.RoyalArmiesAgeHeadquarters = {
        enable,
        onViewOpen,
        onViewClose,
        resolveCouncilLeadershipAccess
    };

    global.enableAgeHeadquarters = enable;
})(window);

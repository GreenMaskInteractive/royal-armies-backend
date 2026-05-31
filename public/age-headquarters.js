/**
 * RIFT — Age Headquarters (nation leadership workspace + SF planning).
 */
(function initAgeHeadquarters(global) {
    'use strict';

    let workspaceEl = null;
    let mounted = false;
    let activeDiploTab = 'incoming';
    let activeMarkerType = '';
    let leaderVote = '';
    let viceVote = '';
    let voteCandidates = [];
    let diplomacyIncoming = [];
    let diplomacyOutgoing = [];
    let warTargets = [];
    let planningSaveTimer = 0;

    const PILL_MARKER_TYPES = new Set(['hold', 'taxi']);
    const ARROW_MARKER_TYPES = new Set(['sf', 'mf', 'move']);
    const TEMP_MAIN_MARKER_TYPE = 'temp-main';

    function isArrowMarkerType(type) {
        return ARROW_MARKER_TYPES.has(type);
    }

    function isPillMarkerType(type) {
        return PILL_MARKER_TYPES.has(type);
    }

    function isTempMainMarkerType(type) {
        return type === TEMP_MAIN_MARKER_TYPE;
    }

    function markerTypeLabel(type) {
        if (type === 'sf') return 'Strike Force';
        if (type === 'mf') return 'Main Force';
        if (type === 'move') return 'Move';
        if (type === 'hold') return 'Hold';
        if (type === 'taxi') return 'Taxi';
        if (type === 'temp-main') return 'Temp Main';
        return String(type || '').toUpperCase();
    }

    let councilAccess = false;
    let leaderAccess = false;
    let viceLeaderAccess = false;

    function resolveApiUrl(path) {
        if (typeof global.resolveRoyalArmiesApiUrl === 'function') {
            return global.resolveRoyalArmiesApiUrl(path);
        }
        return path;
    }

    function resolveUsername() {
        const saved = global.localStorage.getItem('activeCommanderUser');
        if (saved && saved.trim()) return saved.trim();
        if (typeof global.getActiveCommanderUsername === 'function') {
            return String(global.getActiveCommanderUsername() || '').trim();
        }
        return '';
    }

    function setCouncilAccessUI(hasAccess) {
        councilAccess = hasAccess;
        global.document.querySelectorAll('[data-hq-council-only]').forEach((node) => {
            node.hidden = !hasAccess;
        });
        const restricted = global.document.getElementById('age-hq-council-restricted-notice');
        if (restricted) restricted.hidden = hasAccess;
        const shell = global.document.querySelector('.age-headquarters-shell');
        if (shell) shell.classList.toggle('age-headquarters-shell--member-view', !hasAccess);
    }

    function setViceLeaderAccessUI(hasAccess) {
        viceLeaderAccess = hasAccess;
        global.document.querySelectorAll('[data-hq-vice-only]').forEach((node) => {
            node.hidden = !hasAccess;
        });
    }

    function applyWorkspace(workspace) {
        if (!workspace) return false;

        leaderAccess = Boolean(workspace.access?.leader);
        setCouncilAccessUI(Boolean(workspace.access?.council));
        setViceLeaderAccessUI(Boolean(workspace.access?.viceLeader));

        voteCandidates = Array.isArray(workspace.vote?.candidates) ? workspace.vote.candidates : [];
        leaderVote = String(workspace.vote?.myVotes?.leaderCandidateId || '');
        viceVote = String(workspace.vote?.myVotes?.viceCandidateId || '');

        diplomacyIncoming = Array.isArray(workspace.diplomacy?.incoming) ? workspace.diplomacy.incoming : [];
        diplomacyOutgoing = Array.isArray(workspace.diplomacy?.outgoing) ? workspace.diplomacy.outgoing : [];
        warTargets = Array.isArray(workspace.warTargets) ? workspace.warTargets : [];

        global.RoyalArmiesAgeHeadquartersPlanningMap?.applyPlanningSnapshot?.(workspace.planning || {});
        populateWarTargetSelect();
        renderDiploRequests();
        renderLeaderVoteSlots();
        updateVoteStatus();
        syncToolbarState();

        return Boolean(workspace.access?.council);
    }

    async function fetchHeadquartersWorkspace() {
        const username = resolveUsername();
        if (!username) {
            applyWorkspace(null);
            setCouncilAccessUI(false);
            setViceLeaderAccessUI(false);
            leaderAccess = false;
            return false;
        }

        try {
            const response = await global.fetch(
                resolveApiUrl(`/api/portal/age/headquarters?username=${encodeURIComponent(username)}`),
                { credentials: 'same-origin' }
            );
            if (!response.ok) {
                throw new Error(`headquarters workspace ${response.status}`);
            }

            const payload = await response.json();
            return applyWorkspace(payload?.workspace || null);
        } catch (err) {
            console.warn('[RIFT] Headquarters workspace load failed:', err.message);
            setCouncilAccessUI(false);
            setViceLeaderAccessUI(false);
            leaderAccess = false;
            return false;
        }
    }

    async function patchHeadquarters(body) {
        const username = resolveUsername();
        if (!username) return null;

        try {
            const response = await global.fetch(resolveApiUrl('/api/portal/age/headquarters'), {
                method: 'PATCH',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, ...body })
            });

            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                await fetchHeadquartersWorkspace();
                throw new Error(payload?.code || payload?.message || `headquarters patch ${response.status}`);
            }

            if (payload?.workspace) {
                applyWorkspace(payload.workspace);
            }
            return payload;
        } catch (err) {
            console.warn('[RIFT] Headquarters update failed:', err.message);
            return null;
        }
    }

    function schedulePlanningSave(snapshot) {
        if (!councilAccess || !snapshot) return;
        if (planningSaveTimer) {
            global.clearTimeout(planningSaveTimer);
        }
        planningSaveTimer = global.setTimeout(() => {
            planningSaveTimer = 0;
            patchHeadquarters({ planning: snapshot });
        }, 350);
    }

    async function refreshHeadquartersAccess() {
        return fetchHeadquartersWorkspace();
    }

    function renderDiploRequests() {
        const listEl = global.document.getElementById('age-hq-diplo-request-list');
        if (!listEl) return;

        const rows = activeDiploTab === 'outgoing' ? diplomacyOutgoing : diplomacyIncoming;
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

        const previous = select.value;
        select.innerHTML = '<option value="">Select nation…</option>'
            + warTargets
                .map(({ id, name }) => `<option value="${id}">${name}</option>`)
                .join('');
        if (previous && warTargets.some((row) => row.id === previous)) {
            select.value = previous;
        }
    }

    function renderLeaderVoteSlots() {
        const host = global.document.getElementById('age-hq-leader-vote-slots');
        if (!host) return;

        if (!voteCandidates.length) {
            host.innerHTML = '<p class="age-headquarters-request-empty">No eligible commanders found for this nation yet.</p>';
            return;
        }

        host.innerHTML = voteCandidates.map((candidate) => (
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

        const leaderName = voteCandidates.find((c) => c.id === leaderVote)?.name || '—';
        const viceName = voteCandidates.find((c) => c.id === viceVote)?.name || '—';
        statusEl.textContent = `Leader: ${leaderName} · Vice Leader: ${viceName}`;
    }

    function syncToolbarState() {
        const toolbar = global.document.getElementById('age-hq-planning-toolbar');
        if (!toolbar) return;

        const planningMap = global.RoyalArmiesAgeHeadquartersPlanningMap;
        const steps = planningMap?.getPlanningSteps?.() || [];
        const mpBudget = planningMap?.getMoveMfMpBudget?.() || { used: 0, max: 3, remaining: 3 };
        const hasSteps = steps.length > 0;
        const hasSelection = Boolean(planningMap?.getSelectedBorderCityId?.());
        const canPlacePill = Boolean(planningMap?.isSelectedCityPlannable?.());
        const hasTempMain = Boolean(planningMap?.getTempMainCityId?.());
        const canReset = councilAccess && (hasSteps || hasSelection || activeMarkerType || hasTempMain);

        toolbar.querySelectorAll('[data-hq-marker]').forEach((button) => {
            const type = button.getAttribute('data-hq-marker') || '';
            const isViceOnly = button.hasAttribute('data-hq-vice-only');
            const isArrowTool = isArrowMarkerType(type) || isTempMainMarkerType(type);
            let enabled = false;

            if (isViceOnly) {
                enabled = viceLeaderAccess;
            } else {
                enabled = councilAccess && (isArrowTool || canPlacePill);
            }

            button.disabled = !enabled;
            button.classList.toggle('is-active', enabled && type === activeMarkerType);
        });

        const resetBtn = global.document.getElementById('age-hq-planning-reset-btn');
        if (resetBtn) resetBtn.disabled = !canReset;

        const statusEl = global.document.getElementById('age-hq-planning-toolbar-status');
        if (statusEl) {
            if (!councilAccess) {
                statusEl.textContent = 'Council access required';
            } else if (activeMarkerType === 'move' || activeMarkerType === 'mf') {
                statusEl.textContent = `Place ${markerTypeLabel(activeMarkerType)} · ${mpBudget.used}/${mpBudget.max} MP`;
            } else if (activeMarkerType && isArrowMarkerType(activeMarkerType)) {
                statusEl.textContent = `Place ${markerTypeLabel(activeMarkerType)} on map`;
            } else if (activeMarkerType === 'temp-main') {
                statusEl.textContent = 'Place Temp Main on owned city';
            } else if (activeMarkerType) {
                statusEl.textContent = `Active · ${markerTypeLabel(activeMarkerType)}`;
            } else if (hasSteps) {
                statusEl.textContent = `${steps.length} orders placed`;
            } else if (canPlacePill) {
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
            } else if (activeMarkerType && isArrowMarkerType(activeMarkerType)) {
                if (activeMarkerType === 'move') {
                    hint.textContent = `Click a bordering owned city for Move (${mpBudget.remaining} of ${mpBudget.max} MP left this chain). Water crossings may cost extra.`;
                } else if (activeMarkerType === 'mf') {
                    hint.textContent = `Click a bordering neutral or enemy city for MF (${mpBudget.remaining} of ${mpBudget.max} MP left this chain). Own and ally cities are blocked.`;
                } else if (activeMarkerType === 'sf') {
                    hint.textContent = 'Click a bordering neutral or enemy city to place a numbered SF arrow. Own and ally cities are blocked.';
                } else {
                    hint.textContent = `Click a valid bordering city to place ${markerTypeLabel(activeMarkerType)}.`;
                }
            } else if (activeMarkerType === 'temp-main') {
                hint.textContent = 'Vice Leader only: click an owned city to plant a Temp Main decoy. Your real Main stays at your current city.';
            } else if (!canPlacePill && !hasSteps) {
                hint.textContent = 'Select a bordering city for Hold or Taxi. SF, MF, and Move can be armed immediately.';
            } else if (!canPlacePill && hasSteps) {
                hint.textContent = 'Select the next city bordering your last order to place Hold or Taxi pills.';
            } else if (activeMarkerType && isPillMarkerType(activeMarkerType)) {
                hint.textContent = `${markerTypeLabel(activeMarkerType)} armed — click the selected city again or pick Hold/Taxi to replace an existing pill.`;
            } else if (hasSteps) {
                hint.textContent = 'Arm SF, MF, or Move to draw labeled arrows, or select a city for Hold/Taxi pills.';
            } else {
                hint.textContent = 'Arm SF, MF, or Move, or select a bordering city first for Hold/Taxi.';
            }
        }
    }

    async function resetPlanningMap() {
        setActiveMarkerType('');
        await patchHeadquarters({ resetPlanning: true });
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

        global.document.getElementById('age-hq-war-declare-btn')?.addEventListener('click', async () => {
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

            const result = await patchHeadquarters({
                warDeclarationDraft: { targetNationId: target }
            });

            feedback.hidden = false;
            if (!result?.warDeclarationDraft) {
                feedback.textContent = 'Unable to prepare war declaration on the server.';
                feedback.classList.add('is-error');
                return;
            }

            feedback.textContent = `Declaration draft prepared against ${result.warDeclarationDraft.targetNationName}. Server confirmation coming soon.`;
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

            if (isPillMarkerType(type)) {
                global.RoyalArmiesAgeHeadquartersPlanningMap?.placeMarkerOnSelectedCity?.(type);
            }
        });

        global.document.getElementById('age-hq-leader-vote-slots')?.addEventListener('click', async (event) => {
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

            await patchHeadquarters({
                vote: {
                    leaderCandidateId: leaderVote,
                    viceCandidateId: viceVote
                }
            });
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
        planningMap.onMoveMfMpChanged = () => syncToolbarState();
        planningMap.onPlanningSyncRequested = schedulePlanningSave;

        const ok = await planningMap.mount(host);
        if (ok) host.dataset.hqMapMounted = 'true';
    }

    async function onViewOpen() {
        bindUi();
        const hasCouncilAccess = await fetchHeadquartersWorkspace();
        if (hasCouncilAccess) {
            await ensurePlanningMap();
            global.RoyalArmiesAgeHeadquartersPlanningMap?.setEnabled(true);
            global.RoyalArmiesAgeMovementPanel?.refreshCityPlayers?.();
        } else {
            setActiveMarkerType('');
            global.RoyalArmiesAgeHeadquartersPlanningMap?.setEnabled(false);
        }
    }

    function onViewClose() {
        if (planningSaveTimer) {
            global.clearTimeout(planningSaveTimer);
            planningSaveTimer = 0;
        }
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
        refreshHeadquartersAccess,
        fetchHeadquartersWorkspace,
        hasCouncilAccess: () => councilAccess,
        hasLeaderAccess: () => leaderAccess,
        hasViceLeaderAccess: () => viceLeaderAccess
    };

    global.enableAgeHeadquarters = enable;
})(window);

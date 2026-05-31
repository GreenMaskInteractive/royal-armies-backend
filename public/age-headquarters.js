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
    let pendingPlanningSnapshot = null;
    let votingOpen = false;
    let planningConfirmed = false;
    let hasPublishedPlan = false;
    let clearingPublishedPlan = false;

    const PILL_MARKER_TYPES = new Set(['hold']);
    const ARROW_MARKER_TYPES = new Set(['sf', 'mf', 'move', 'taxi', 'temp-main']);

    function isArrowMarkerType(type) {
        return ARROW_MARKER_TYPES.has(type);
    }

    function isPillMarkerType(type) {
        return PILL_MARKER_TYPES.has(type);
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
    let lastCabinetState = null;

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
        const opsRail = global.document.querySelector('.age-headquarters-ops-rail');
        if (opsRail) opsRail.hidden = hasAccess;
        const shell = global.document.querySelector('.age-headquarters-shell');
        if (shell) shell.classList.toggle('age-headquarters-shell--member-view', !hasAccess);
    }

    function waitForLayout() {
        return new Promise((resolve) => {
            global.requestAnimationFrame(() => {
                global.requestAnimationFrame(resolve);
            });
        });
    }

    function applyPlanningSnapshotToMap(snapshot) {
        pendingPlanningSnapshot = snapshot || null;
        if (!pendingPlanningSnapshot) return;

        const planningMap = global.RoyalArmiesAgeHeadquartersPlanningMap;
        const localSnapshot = planningMap?.getPlanningSnapshot?.();
        if (localSnapshot && !planningConfirmed && planningSaveTimer) {
            const localSteps = (localSnapshot.pills?.length || 0) + (localSnapshot.arrows?.length || 0);
            const remoteSteps = (pendingPlanningSnapshot.pills?.length || 0) + (pendingPlanningSnapshot.arrows?.length || 0);
            if (localSteps > remoteSteps) {
                return;
            }
        }

        planningMap?.applyPlanningSnapshot?.(pendingPlanningSnapshot);
    }

    function refreshPlanningMapLayout() {
        if (typeof global.syncAgeHeadquartersPlanningLayout === 'function') {
            global.syncAgeHeadquartersPlanningLayout();
        }
        global.RoyalArmiesAgeHeadquartersPlanningMap?.refreshLayout?.();
    }

    function isDevOwnerHeadquartersBypass(username) {
        const normalized = String(username || '').trim().toLowerCase();
        if (normalized !== 'caleb_admin') return false;

        const port = String(global.location?.port || '');
        if (!['3000', '5500'].includes(port)) return false;

        const devMode = typeof global.getLocalDevViewMode === 'function'
            ? global.getLocalDevViewMode()
            : 'owner';
        return devMode === 'owner';
    }

    const DEV_PLANNING_STORAGE_PREFIX = 'ra-dev-hq-planning:';

    function devPlanningStorageKey(username) {
        return `${DEV_PLANNING_STORAGE_PREFIX}${normalizedUsername(username)}`;
    }

    function readDevPlanningSnapshot(username) {
        if (!isDevOwnerHeadquartersBypass(username)) return null;
        try {
            const raw = global.sessionStorage.getItem(devPlanningStorageKey(username));
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (_) {
            return null;
        }
    }

    function writeDevPlanningSnapshot(username, planning) {
        if (!isDevOwnerHeadquartersBypass(username) || !planning) return;
        try {
            global.sessionStorage.setItem(devPlanningStorageKey(username), JSON.stringify(planning));
        } catch (_) {
            /* ignore quota errors */
        }
    }

    function getDefaultDevPlanningState() {
        return {
            pills: [],
            arrows: [],
            tempMainCityId: '',
            confirmed: false,
            hasPublishedPlan: false
        };
    }

    function buildDevOwnerFallbackWorkspace(username) {
        if (!isDevOwnerHeadquartersBypass(username)) return null;

        const savedPlanning = readDevPlanningSnapshot(username);

        return {
            access: { council: true, leader: true, viceLeader: true },
            planning: savedPlanning || getDefaultDevPlanningState(),
            diplomacy: { incoming: [], outgoing: [] },
            vote: {
                isOpen: false,
                candidates: [{
                    id: normalizedUsername(username),
                    username,
                    name: username,
                    roleHint: 'Commander'
                }],
                myVotes: { leaderCandidateId: '', viceCandidateId: '' },
                electedLeader: null,
                electedViceLeader: null,
                lockedUntil: null,
                lockDays: 7
            },
            cabinet: {
                leader: { username: normalizedUsername(username), name: username },
                viceLeader: null,
                councilMembers: [],
                planners: []
            },
            warTargets: [],
            fortifiedCities: []
        };
    }

    function isPlanningOnlyPatch(body) {
        if (!body || typeof body !== 'object') return false;
        const keys = Object.keys(body).filter((key) => key !== 'username');
        return keys.length === 1 && keys[0] === 'planning';
    }

    function setPlanningPlacementHint(message, isError) {
        const hint = global.document.getElementById('age-hq-planning-hint');
        if (!hint) return;
        hint.textContent = message;
        hint.classList.toggle('is-error', Boolean(isError));
    }

    function onPlanningPlacementBlocked(reason) {
        if (!reason) return;
        setPlanningPlacementHint(reason, true);
    }

    function setPlanningSaveError(message) {
        setPlanningPlacementHint(message, true);
    }

    function clearPlanningSaveError() {
        const hint = global.document.getElementById('age-hq-planning-hint');
        if (!hint) return;
        hint.classList.remove('is-error');
    }

    async function showHeadquartersAlert(message, title) {
        if (typeof global.showPortalAlert === 'function') {
            await global.showPortalAlert(message, title || 'Headquarters');
            return;
        }
        global.alert(message);
    }

    async function showClearPlanConfirm() {
        if (typeof global.showPortalConfirm === 'function') {
            return global.showPortalConfirm(
                'Remove the confirmed nation plan from the world map?',
                {
                    title: 'Clear Plan',
                    confirmLabel: 'Clear Plan',
                    cancelLabel: 'Keep Plan'
                }
            );
        }
        return global.confirm('Remove the confirmed nation plan from the world map?');
    }

    function normalizedUsername(value) {
        return String(value || '').trim().toLowerCase();
    }

    function setViceLeaderAccessUI(hasAccess) {
        viceLeaderAccess = hasAccess;
        global.document.querySelectorAll('[data-hq-vice-only]').forEach((node) => {
            node.hidden = !hasAccess;
        });
    }

    function formatVoteReopenLabel(lockedUntil) {
        if (!lockedUntil) return '';
        const reopenMs = Date.parse(lockedUntil);
        if (!Number.isFinite(reopenMs)) return '';
        const reopenDate = new Date(reopenMs);
        const formatted = reopenDate.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
        return `Voting reopens on ${formatted}.`;
    }

    function setVotingPanelUI(voteState) {
        votingOpen = Boolean(voteState?.isOpen) && !councilAccess;
        const hasCouncilAccessNow = councilAccess;

        global.document.querySelectorAll('[data-hq-vote-only]').forEach((node) => {
            node.hidden = !votingOpen;
        });

        const summary = global.document.querySelector('[data-hq-leadership-summary]');
        const showLeadershipSummary = !votingOpen && !hasCouncilAccessNow
            && Boolean(voteState?.electedLeader || voteState?.electedViceLeader);
        if (summary) summary.hidden = !showLeadershipSummary;

        const restricted = global.document.getElementById('age-hq-council-restricted-notice');
        if (restricted) {
            if (hasCouncilAccessNow) {
                restricted.hidden = true;
            } else if (votingOpen) {
                restricted.hidden = false;
                restricted.querySelector('.age-headquarters-restricted-copy').textContent =
                    'Council and Leader planning tools are restricted to appointed nation leadership. You can cast Leader and Vice Leader votes below.';
            } else {
                restricted.hidden = showLeadershipSummary;
                if (!restricted.hidden) {
                    restricted.querySelector('.age-headquarters-restricted-copy').textContent =
                        'Council and Leader planning tools are restricted to appointed nation leadership.';
                }
            }
        }

        const leaderNameEl = global.document.getElementById('age-hq-elected-leader-name');
        const viceNameEl = global.document.getElementById('age-hq-elected-vice-name');
        const reopenEl = global.document.getElementById('age-hq-vote-reopens-at');
        if (leaderNameEl) {
            leaderNameEl.textContent = voteState?.electedLeader?.name || '—';
        }
        if (viceNameEl) {
            viceNameEl.textContent = voteState?.electedViceLeader?.name || '—';
        }
        if (reopenEl) {
            const reopenText = formatVoteReopenLabel(voteState?.lockedUntil);
            reopenEl.textContent = reopenText;
            reopenEl.hidden = !reopenText;
        }

        renderNationCabinet(lastCabinetState, voteState);
    }

    function renderCabinetMemberList(listEl, members, emptyLabel) {
        if (!listEl) return;
        listEl.textContent = '';
        const rows = Array.isArray(members) ? members : [];
        if (!rows.length) {
            const emptyItem = global.document.createElement('li');
            emptyItem.className = 'age-hq-cabinet-list-empty';
            emptyItem.textContent = emptyLabel;
            listEl.appendChild(emptyItem);
            return;
        }

        rows.forEach((member) => {
            const item = global.document.createElement('li');
            item.className = 'age-hq-cabinet-list-item';
            item.textContent = member?.name || member?.username || '—';
            listEl.appendChild(item);
        });
    }

    function renderNationCabinet(cabinet, voteState) {
        const leaderEl = global.document.getElementById('age-hq-cabinet-leader-name');
        const viceEl = global.document.getElementById('age-hq-cabinet-vice-name');
        const councilList = global.document.getElementById('age-hq-cabinet-council-list');
        const plannersList = global.document.getElementById('age-hq-cabinet-planners-list');
        if (!leaderEl && !viceEl && !councilList && !plannersList) return;

        const leader = cabinet?.leader || voteState?.electedLeader || null;
        const viceLeader = cabinet?.viceLeader || voteState?.electedViceLeader || null;

        if (leaderEl) leaderEl.textContent = leader?.name || '—';
        if (viceEl) viceEl.textContent = viceLeader?.name || '—';
        renderCabinetMemberList(councilList, cabinet?.councilMembers, 'None appointed yet.');
        renderCabinetMemberList(plannersList, cabinet?.planners, 'None appointed yet.');

        if (typeof global.syncAgeHeadquartersPlanningLayout === 'function') {
            global.requestAnimationFrame(global.syncAgeHeadquartersPlanningLayout);
        }
        if (typeof global.syncAgeHeadquartersCommandRailLayout === 'function') {
            global.requestAnimationFrame(global.syncAgeHeadquartersCommandRailLayout);
        }
    }

    function renderTreasuryFortifications(fortifiedCities) {
        const listEl = global.document.getElementById('age-hq-treasury-fort-list');
        const emptyEl = global.document.getElementById('age-hq-treasury-fort-empty');
        if (!listEl) return;

        const rows = Array.isArray(fortifiedCities) ? fortifiedCities : [];
        listEl.innerHTML = '';

        if (!rows.length) {
            if (emptyEl) emptyEl.hidden = false;
            return;
        }

        if (emptyEl) emptyEl.hidden = true;

        rows.forEach((city, index) => {
            const cityId = String(city?.id || `city-${index}`).trim();
            const panelId = `age-hq-fort-panel-${cityId.replace(/[^a-z0-9_-]/gi, '-')}`;
            const cityLabel = city?.name || cityId || 'Unknown city';
            const fortifications = Array.isArray(city?.fortifications) ? city.fortifications : [];

            const item = global.document.createElement('li');
            item.className = 'age-hq-treasury-fort-item';

            const toggle = global.document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'age-hq-treasury-fort-toggle';
            toggle.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-controls', panelId);

            const cityHead = global.document.createElement('span');
            cityHead.className = 'age-hq-treasury-fort-city';
            cityHead.textContent = cityLabel;

            const chevron = global.document.createElement('span');
            chevron.className = 'age-hq-treasury-fort-chevron';
            chevron.setAttribute('aria-hidden', 'true');
            chevron.textContent = '›';

            toggle.append(cityHead, chevron);

            const panel = global.document.createElement('div');
            panel.id = panelId;
            panel.className = 'age-hq-treasury-fort-panel';
            panel.hidden = true;

            const structureList = global.document.createElement('ul');
            structureList.className = 'age-hq-treasury-structure-list';

            if (fortifications.length) {
                fortifications.forEach((structure) => {
                    const structureItem = global.document.createElement('li');
                    structureItem.className = 'age-hq-treasury-structure-item';
                    structureItem.textContent = structure?.label || 'Unknown fortification';
                    structureList.appendChild(structureItem);
                });
            } else {
                const structureItem = global.document.createElement('li');
                structureItem.className = 'age-hq-treasury-structure-item age-hq-treasury-structure-item--empty';
                structureItem.textContent = 'No fortifications listed.';
                structureList.appendChild(structureItem);
            }

            panel.appendChild(structureList);
            item.append(toggle, panel);
            listEl.appendChild(item);
        });
    }

    function onTreasuryFortListClick(event) {
        const toggle = event.target.closest('.age-hq-treasury-fort-toggle');
        if (!toggle) return;

        const item = toggle.closest('.age-hq-treasury-fort-item');
        const panelId = toggle.getAttribute('aria-controls');
        const panel = panelId ? global.document.getElementById(panelId) : null;
        if (!panel) return;

        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        panel.hidden = expanded;
        item?.classList.toggle('is-expanded', !expanded);
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

        setVotingPanelUI(workspace.vote || {});
        lastCabinetState = workspace.cabinet || null;
        renderNationCabinet(lastCabinetState, workspace.vote || {});
        renderTreasuryFortifications(workspace.fortifiedCities || []);
        planningConfirmed = Boolean(workspace.planning?.confirmed);
        hasPublishedPlan = Boolean(workspace.planning?.hasPublishedPlan);
        applyPlanningSnapshotToMap(workspace.planning || {});
        global.RoyalArmiesAgeHeadquartersPlanningMap?.setPlanningLocked?.(planningConfirmed);
        populateWarTargetSelect();
        renderDiploRequests();
        if (votingOpen) {
            renderLeaderVoteSlots();
            updateVoteStatus();
        } else {
            leaderVote = '';
            viceVote = '';
        }
        syncToolbarState();
        void global.RoyalArmiesAgeWorldPlanOverlay?.refreshNationPlan?.();

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

            const fallback = buildDevOwnerFallbackWorkspace(username);
            if (fallback) {
                console.warn('[RIFT] Using dev owner Headquarters fallback. Restart NEXUS (node server.js) if server sync is missing.');
                return applyWorkspace(fallback);
            }

            setCouncilAccessUI(false);
            setViceLeaderAccessUI(false);
            leaderAccess = false;
            return false;
        }
    }

    function isResetPlanningPatch(body) {
        return body?.resetPlanning === true;
    }

    function isClearPublishedPlanPatch(body) {
        return body?.clearPublishedPlan === true;
    }

    function getEmptyDevPlanningSnapshot() {
        return {
            pills: [],
            arrows: [],
            tempMainCityId: ''
        };
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
                if (isResetPlanningPatch(body) && isDevOwnerHeadquartersBypass(username)) {
                    writeDevPlanningSnapshot(username, getEmptyDevPlanningSnapshot());
                    applyPlanningSnapshotToMap(getEmptyDevPlanningSnapshot());
                    clearPlanningSaveError();
                    console.warn('[RIFT] Using dev planning reset fallback. Restart NEXUS (node server.js) for live nation sync.');
                    return {
                        workspace: buildDevOwnerFallbackWorkspace(username)
                    };
                }

                if (isClearPublishedPlanPatch(body) && isDevOwnerHeadquartersBypass(username)) {
                    global.RoyalArmiesAgeWorldPlanOverlay?.setDevMapPlanSuppressed?.(username, true);
                    clearPlanningSaveError();
                    const fallbackWorkspace = buildDevOwnerFallbackWorkspace(username);
                    console.warn('[RIFT] Using dev clear-plan fallback. Restart NEXUS (node server.js) for live nation sync.');
                    return {
                        workspace: {
                            ...fallbackWorkspace,
                            planning: {
                                ...(fallbackWorkspace?.planning || getDefaultDevPlanningState()),
                                confirmed: false,
                                hasPublishedPlan: false
                            }
                        }
                    };
                }

                if (isPlanningOnlyPatch(body)) {
                    if (isDevOwnerHeadquartersBypass(username) && body.planning) {
                        writeDevPlanningSnapshot(username, body.planning);
                        applyPlanningSnapshotToMap(body.planning);
                        setPlanningSaveError('Planning saved locally for dev. Restart NEXUS (node server.js) for live nation sync.');
                        console.warn('[RIFT] Using dev planning fallback. Restart NEXUS for server-backed HQ planning.');
                        return {
                            workspace: buildDevOwnerFallbackWorkspace(username)
                        };
                    }

                    setPlanningSaveError('Unable to save planning orders. Restart NEXUS if this route was recently added.');
                    console.warn(
                        '[RIFT] Headquarters planning save failed:',
                        payload?.code || payload?.message || `headquarters patch ${response.status}`
                    );
                    return null;
                }

                await fetchHeadquartersWorkspace();
                throw new Error(payload?.code || payload?.message || `headquarters patch ${response.status}`);
            }

            clearPlanningSaveError();
            if (isDevOwnerHeadquartersBypass(username)) {
                if (body.planning) {
                    writeDevPlanningSnapshot(username, body.planning);
                } else if (isResetPlanningPatch(body)) {
                    writeDevPlanningSnapshot(username, getEmptyDevPlanningSnapshot());
                }
            }

            if (payload?.workspace) {
                applyWorkspace(payload.workspace);
            }

            if (isClearPublishedPlanPatch(body)) {
                if (payload?.workspace?.planning?.hasPublishedPlan) {
                    if (isDevOwnerHeadquartersBypass(username)) {
                        global.RoyalArmiesAgeWorldPlanOverlay?.setDevMapPlanSuppressed?.(username, true);
                        applyWorkspace({
                            ...payload.workspace,
                            planning: {
                                ...payload.workspace.planning,
                                confirmed: false,
                                hasPublishedPlan: false
                            }
                        });
                        await global.RoyalArmiesAgeWorldPlanOverlay?.refreshNationPlan?.();
                        return {
                            ...payload,
                            workspace: {
                                ...payload.workspace,
                                planning: {
                                    ...payload.workspace.planning,
                                    confirmed: false,
                                    hasPublishedPlan: false
                                }
                            }
                        };
                    }
                } else {
                    global.RoyalArmiesAgeWorldPlanOverlay?.setDevMapPlanSuppressed?.(username, false);
                    await global.RoyalArmiesAgeWorldPlanOverlay?.refreshNationPlan?.();
                }
            }

            return payload;
        } catch (err) {
            console.warn('[RIFT] Headquarters update failed:', err.message);
            return null;
        }
    }

    function schedulePlanningSave(snapshot) {
        if (!councilAccess || !snapshot || planningConfirmed) return;
        if (planningSaveTimer) {
            global.clearTimeout(planningSaveTimer);
        }
        planningSaveTimer = global.setTimeout(() => {
            planningSaveTimer = 0;
            patchHeadquarters({ planning: snapshot });
        }, 350);
    }

    async function flushPlanningSave() {
        if (planningSaveTimer) {
            global.clearTimeout(planningSaveTimer);
            planningSaveTimer = 0;
        }
        const snapshot = global.RoyalArmiesAgeHeadquartersPlanningMap?.getPlanningSnapshot?.();
        if (!snapshot || planningConfirmed) return true;
        const result = await patchHeadquarters({ planning: snapshot });
        return Boolean(result?.workspace);
    }

    async function confirmPlanning() {
        if (!councilAccess || planningConfirmed) return;
        await flushPlanningSave();
        const steps = global.RoyalArmiesAgeHeadquartersPlanningMap?.getPlanningSteps?.() || [];
        if (!steps.length) {
            const hint = global.document.getElementById('age-hq-planning-hint');
            if (hint) {
                hint.textContent = 'Place at least one order before confirming the plan.';
            }
            return;
        }
        await patchHeadquarters({ confirmPlanning: true });
        global.RoyalArmiesAgeWorldPlanOverlay?.setDevMapPlanSuppressed?.(resolveUsername(), false);
    }

    async function editPlanning() {
        if (!councilAccess || !planningConfirmed) return;
        setActiveMarkerType('');
        await patchHeadquarters({ editPlanning: true });
    }

    async function clearPublishedPlanFromMap() {
        if (!councilAccess || !hasPublishedPlan || clearingPublishedPlan) return;

        const confirmed = await showClearPlanConfirm();
        if (!confirmed) {
            return;
        }

        clearingPublishedPlan = true;
        syncToolbarState();

        try {
            const result = await patchHeadquarters({ clearPublishedPlan: true });
            if (!result?.workspace) {
                await showHeadquartersAlert(
                    'Unable to clear the nation plan right now. Try again in a moment.',
                    'Clear Plan'
                );
                return;
            }

            if (result.workspace.planning?.hasPublishedPlan) {
                await showHeadquartersAlert(
                    'The nation plan is still published on the server. Restart NEXUS locally (node server.js) or wait for the latest deploy on production, then try Clear Plan again.',
                    'Clear Plan'
                );
                return;
            }

            hasPublishedPlan = false;
            syncToolbarState();
            global.dispatchEvent(new CustomEvent('royalarmies:nation-plan-cleared'));
            await global.RoyalArmiesAgeWorldPlanOverlay?.refreshNationPlan?.();
        } finally {
            clearingPublishedPlan = false;
            syncToolbarState();
        }
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
        const canReset = councilAccess && !planningConfirmed && (hasSteps || hasSelection || activeMarkerType || hasTempMain);

        toolbar.querySelectorAll('[data-hq-marker]').forEach((button) => {
            const type = button.getAttribute('data-hq-marker') || '';
            const isViceOnly = button.hasAttribute('data-hq-vice-only');
            const isArrowTool = isArrowMarkerType(type);
            let enabled = false;

            if (planningConfirmed) {
                enabled = false;
            } else if (isViceOnly) {
                enabled = viceLeaderAccess;
            } else if (type === 'hold') {
                enabled = councilAccess && canPlacePill;
            } else {
                enabled = councilAccess && isArrowTool;
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
            } else if (planningConfirmed) {
                statusEl.textContent = 'Plan live on world map';
            } else if (hasPublishedPlan) {
                statusEl.textContent = 'Published plan on world map';
            } else if (activeMarkerType === 'move' || activeMarkerType === 'mf') {
                statusEl.textContent = `Place ${markerTypeLabel(activeMarkerType)} · ${mpBudget.used}/${mpBudget.max} MP`;
            } else if (activeMarkerType && isArrowMarkerType(activeMarkerType)) {
                statusEl.textContent = `Place ${markerTypeLabel(activeMarkerType)} on map`;
            } else if (activeMarkerType === 'hold') {
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
        if (hint && !hint.classList.contains('is-error')) {
            if (!councilAccess) {
                hint.textContent = 'SF Planning markers require Council or Leader access.';
            } else if (planningConfirmed) {
                hint.textContent = 'Plan is live on the world map. Edit Plan to adjust orders, or Clear Plan when the operation is complete.';
            } else if (hasPublishedPlan) {
                hint.textContent = 'A published plan is still on the world map. Clear Plan when the operation is complete.';
            } else if (activeMarkerType && isArrowMarkerType(activeMarkerType)) {
                if (activeMarkerType === 'move') {
                    hint.textContent = `Click an owned city bordering your chain endpoint for Move (${mpBudget.remaining} of ${mpBudget.max} MP left), or click a Hold city again for an in-city Move arrow.`;
                } else if (activeMarkerType === 'mf') {
                    hint.textContent = `Click a bordering neutral or enemy city for MF (${mpBudget.remaining} of ${mpBudget.max} MP left this chain). Launch from owned or Hold cities.`;
                } else if (activeMarkerType === 'sf') {
                    hint.textContent = 'Click a bordering neutral or enemy city for SF. Launch from owned or Hold cities along your chain.';
                } else if (activeMarkerType === 'taxi') {
                    hint.textContent = 'Click an owned city bordering your chain endpoint for Taxi, or click a Hold city again for an in-city Taxi arrow.';
                } else if (activeMarkerType === 'temp-main') {
                    hint.textContent = 'Vice Leader only: click an owned city to draw a Temp Main arrow from your real Main.';
                } else {
                    hint.textContent = `Click a valid bordering city to place ${markerTypeLabel(activeMarkerType)}.`;
                }
            } else if (activeMarkerType === 'hold') {
                hint.textContent = `${markerTypeLabel(activeMarkerType)} armed — click the selected city again or pick an existing Hold marker to replace it.`;
            } else if (!canPlacePill && !hasSteps) {
                hint.textContent = 'Select a bordering city for Hold. SF, MF, Move, and Taxi can be armed immediately.';
            } else if (!canPlacePill && hasSteps) {
                hint.textContent = 'Select the next city bordering your last order to place Hold.';
            } else if (hasSteps) {
                hint.textContent = 'Arm SF, MF, Move, or Taxi to draw arrows, or select a city for Hold.';
            } else {
                hint.textContent = 'Arm SF, MF, Move, or Taxi, or select a bordering city first for Hold.';
            }
        }

        const confirmBtn = global.document.getElementById('age-hq-planning-confirm-btn');
        if (confirmBtn) {
            const canConfirm = councilAccess && !planningConfirmed && hasSteps;
            const canEdit = councilAccess && planningConfirmed;
            confirmBtn.disabled = !(canConfirm || canEdit);
            confirmBtn.textContent = planningConfirmed ? 'Edit Plan' : 'Confirm Plan';
            confirmBtn.classList.toggle('is-edit-mode', planningConfirmed);
            confirmBtn.setAttribute('data-hq-planning-mode', planningConfirmed ? 'edit' : 'confirm');
        }

        const clearBtn = global.document.getElementById('age-hq-planning-clear-btn');
        if (clearBtn) {
            const showClear = councilAccess && hasPublishedPlan;
            clearBtn.hidden = !showClear;
            clearBtn.disabled = !showClear || clearingPublishedPlan;
        }
    }

    async function resetPlanningMap() {
        if (planningSaveTimer) {
            global.clearTimeout(planningSaveTimer);
            planningSaveTimer = 0;
        }

        setActiveMarkerType('');
        global.RoyalArmiesAgeHeadquartersPlanningMap?.resetPlanningMap?.();

        const username = resolveUsername();
        if (isDevOwnerHeadquartersBypass(username)) {
            writeDevPlanningSnapshot(username, getEmptyDevPlanningSnapshot());
        }

        const result = await patchHeadquarters({ resetPlanning: true });
        if (!result) {
            setPlanningSaveError('Unable to reset planning. Restart NEXUS if this route was recently added.');
        } else {
            clearPlanningSaveError();
        }
        syncToolbarState();
    }

    function setActiveMarkerType(type) {
        activeMarkerType = type || '';
        if (activeMarkerType) {
            const hint = global.document.getElementById('age-hq-planning-hint');
            if (hint) hint.classList.remove('is-error');
        }
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

        global.document.getElementById('age-hq-treasury-fort-list')?.addEventListener('click', onTreasuryFortListClick);

        global.addEventListener('royalarmies:nation-plan-cleared', () => {
            fetchHeadquartersWorkspace();
        });

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
            const confirmButton = event.target.closest('[data-hq-planning-confirm]');
            if (confirmButton) {
                if (confirmButton.disabled) return;
                if (planningConfirmed) {
                    editPlanning();
                } else {
                    confirmPlanning();
                }
                return;
            }

            const resetButton = event.target.closest('[data-hq-planning-reset]');
            if (resetButton) {
                if (resetButton.disabled) return;
                resetPlanningMap();
                return;
            }

            const clearButton = event.target.closest('[data-hq-planning-clear]');
            if (clearButton) {
                if (clearButton.disabled || clearButton.hidden) return;
                clearPublishedPlanFromMap();
                return;
            }

            const button = event.target.closest('[data-hq-marker]');
            if (!button || button.disabled) return;
            const type = button.getAttribute('data-hq-marker');
            const wasActive = type === activeMarkerType;
            const planningMap = global.RoyalArmiesAgeHeadquartersPlanningMap;
            setActiveMarkerType(type);

            if (isPillMarkerType(type)) {
                if (!wasActive) {
                    planningMap?.placeMarkerOnSelectedCity?.(type);
                }
                return;
            }

            if (isArrowMarkerType(type)) {
                if (wasActive) return;
                const selectedId = planningMap?.getSelectedBorderCityId?.();
                const anchorId = planningMap?.getChainAnchorCityId?.() || '';
                if (!selectedId || selectedId === anchorId) return;
                planningMap?.placeMarkerOnSelectedCity?.(type);
            }
        });

        global.document.getElementById('age-hq-leader-vote-slots')?.addEventListener('click', async (event) => {
            const button = event.target.closest('[data-hq-vote-role]');
            if (!button || !votingOpen) return;
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
        if (!host) return false;

        const planningMap = global.RoyalArmiesAgeHeadquartersPlanningMap;
        if (!planningMap) return false;

        planningMap.onBorderCitySelected = onBorderCitySelected;
        planningMap.onPillsChanged = () => syncToolbarState();
        planningMap.onMoveMfMpChanged = () => syncToolbarState();
        planningMap.onPlanningSyncRequested = schedulePlanningSave;
        planningMap.onPlanningPlacementBlocked = onPlanningPlacementBlocked;

        if (host.dataset.hqMapMounted !== 'true') {
            await waitForLayout();
            const ok = await planningMap.mount(host);
            if (!ok) return false;
            host.dataset.hqMapMounted = 'true';
        }

        await waitForLayout();
        if (pendingPlanningSnapshot) {
            planningMap.applyPlanningSnapshot?.(pendingPlanningSnapshot);
        }
        refreshPlanningMapLayout();
        return true;
    }

    async function onViewOpen() {
        bindUi();
        const hasCouncilAccess = await fetchHeadquartersWorkspace();
        if (hasCouncilAccess) {
            await ensurePlanningMap();
            global.RoyalArmiesAgeHeadquartersPlanningMap?.setEnabled(true);
            await waitForLayout();
            refreshPlanningMapLayout();
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

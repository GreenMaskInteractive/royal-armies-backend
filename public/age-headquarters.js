/**
 * RIFT — Council Room (multipurpose nation workspace: elections, ledger, SF planning, council ops).
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
    let lastVoteState = null;
    let fullAuthority = false;
    let memberHubActive = false;
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
    let hqManagerEligible = false;
    let hqManagerModeOpen = false;
    let hqManagerOpenRequested = false;
    let hqViewOpenGeneration = 0;
    let councilRoomModalOpen = false;
    let councilRoomEscapeHandler = null;
    let lastCabinetState = null;
    let lastAppliedWorkspace = null;
    let lastWorkspaceRevision = '';
    let hqLiveRefreshTimer = 0;

    const HQ_LIVE_REFRESH_MS = 4000;
    const HQ_MANAGER_LABEL_OPEN = 'Open HQ Manager';
    const HQ_MANAGER_LABEL_CLOSE = 'Close HQ Manager';

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

    function resolveLocalDevOwnerUsername() {
        return String(global.LOCAL_DEV_AUTO_LOGIN_USERNAME || 'caleb_admin').trim();
    }

    function isLocalDevOwnerPortalView() {
        if (typeof global.isLocalDevOwnerPortalView === 'function') {
            return global.isLocalDevOwnerPortalView();
        }
        if (typeof global.isProductionRoyalArmiesHost === 'function' && global.isProductionRoyalArmiesHost()) {
            return false;
        }
        if (typeof global.isLocalDevelopmentHost === 'function' && !global.isLocalDevelopmentHost()) {
            return false;
        }
        const devMode = typeof global.getLocalDevViewMode === 'function'
            ? global.getLocalDevViewMode()
            : 'owner';
        return devMode === 'owner';
    }

    function resolveHeadquartersUsername() {
        const username = resolveUsername();
        if (username) return username;
        if (isLocalDevOwnerPortalView()) return resolveLocalDevOwnerUsername();
        return '';
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function setHeadquartersLoadStatus(message, tone = 'info') {
        const el = global.document.getElementById('age-hq-load-status');
        if (!el) return;

        if (!message) {
            el.hidden = true;
            el.textContent = '';
            el.className = 'age-hq-load-status';
            return;
        }

        el.hidden = false;
        el.textContent = message;
        el.className = `age-hq-load-status age-hq-load-status--${tone}`;
    }

    function describeHeadquartersAccessGap(workspace) {
        if (!workspace) {
            return {
                message: 'Council Room data did not load. In F12 → Network, open the headquarters request and check status (200 = OK). Try signing out and back in, or hard-refresh (Ctrl+Shift+R).',
                tone: 'error'
            };
        }

        if (workspace.gameNation) {
            return null;
        }

        if (!workspace.gameNation) {
            return {
                message: 'This commander has no nation assigned yet. Choose a nation on the Age map, then open the Council Room.',
                tone: 'warn'
            };
        }

        return {
            message: 'You are not on this nation\'s member roster yet. If you already enlisted, wait a moment and refresh — otherwise contact nation staff.',
            tone: 'warn'
        };
    }

    function logHeadquartersWorkspaceSummary(workspace, source) {
        if (!workspace) {
            console.info(`[RIFT] Headquarters workspace empty (${source})`);
            return;
        }

        console.info(`[RIFT] Headquarters workspace loaded (${source})`, {
            gameNation: workspace.gameNation || '',
            access: workspace.access || {},
            voteOpen: Boolean(workspace.vote?.isOpen),
            nationPlayers: workspace.vote?.nationPlayerCount ?? null
        });
    }

    function getCouncilRoomModal() {
        return global.document.getElementById('age-council-room-modal');
    }

    function isCouncilRoomPage() {
        return global.document.body?.dataset?.ageCouncilRoomPage === 'true';
    }

    function isCouncilRoomViewActive() {
        return councilRoomModalOpen || isCouncilRoomPage();
    }

    function hasActiveManagerControls() {
        return Boolean(hqManagerEligible && hqManagerModeOpen);
    }

    function isHqManagerToggleActive() {
        return hasActiveManagerControls();
    }

    function isHqManagerOpenPending() {
        return Boolean(hqManagerOpenRequested && !hqManagerModeOpen);
    }

    function resetHeadquartersManagerMode() {
        hqManagerModeOpen = false;
        hqManagerOpenRequested = false;
    }

    function applyPendingHqManagerMode() {
        if (!hqManagerEligible) {
            if (!hqManagerOpenRequested) {
                hqManagerModeOpen = false;
            }
            return;
        }
        if (hqManagerOpenRequested) {
            hqManagerModeOpen = true;
            hqManagerOpenRequested = false;
        }
    }

    function flushHeadquartersViewMode() {
        syncHeadquartersViewMode(lastAppliedWorkspace);
        global.requestAnimationFrame(() => {
            syncHeadquartersViewMode(lastAppliedWorkspace);
            syncDispatchPanel(isCouncilRoomViewActive());
            syncHeadquartersShellLayout();
        });
    }

    function resolveHqManagerEligible(access) {
        if (!access) return false;
        return Boolean(access.council || access.leader || access.viceLeader);
    }

    function buildWorkspaceRevision(workspace) {
        if (!workspace) return '';
        return JSON.stringify({
            gameNation: workspace.gameNation || '',
            access: workspace.access || {},
            diplomacyPublic: workspace.diplomacyPublic || {},
            warLedger: workspace.warLedger || {},
            cabinet: workspace.cabinet || {},
            vote: {
                isOpen: Boolean(workspace.vote?.isOpen),
                electionStatus: workspace.vote?.electionStatus || '',
                electedLeader: workspace.vote?.electedLeader?.id || '',
                electedViceLeader: workspace.vote?.electedViceLeader?.id || '',
                nationPlayerCount: workspace.vote?.nationPlayerCount || 0
            },
            planning: {
                confirmed: Boolean(workspace.planning?.confirmed),
                hasPublishedPlan: Boolean(workspace.planning?.hasPublishedPlan),
                pills: workspace.planning?.pills?.length || 0,
                arrows: workspace.planning?.arrows?.length || 0
            },
            diplomacy: {
                incoming: workspace.diplomacy?.incoming?.length || 0,
                outgoing: workspace.diplomacy?.outgoing?.length || 0
            },
            fortifiedCities: workspace.fortifiedCities?.length || 0,
            threatMatrix: (workspace.threatMatrix || []).map((row) => (
                `${row.nationId}:${row.militaryPower}:${row.hostility}`
            )).join('|'),
            spyLogs: (workspace.spyLogs || []).map((log) => (
                `${log.id}:${log.outdated ? 1 : 0}:${log.currentPower}`
            )).join('|'),
            hqBounties: {
                cycleId: workspace.hqBounties?.cycleId || '',
                feed: (workspace.hqBounties?.feed || []).length,
                targets: (workspace.hqBounties?.targets || []).map((row) => (
                    `${row.targetUsername}:${row.resolved ? 1 : 0}`
                )).join('|')
            }
        });
    }

    function setNodeHidden(node, hidden) {
        if (!node) return;
        node.hidden = hidden;
        if (hidden) {
            node.setAttribute('hidden', '');
        } else {
            node.removeAttribute('hidden');
        }
    }

    function syncDispatchPanel(showOnCouncilRoomView) {
        const panel = global.document.getElementById('age-hq-dispatch-panel');
        if (!panel) return;

        const shouldShow = Boolean(showOnCouncilRoomView && hasActiveManagerControls());
        setNodeHidden(panel, !shouldShow);
    }

    function syncHeadquartersViewMode(workspace) {
        const root = global.document.getElementById('age-council-room-workspace');
        const canViewPublic = Boolean(workspace?.gameNation);
        const showManagerControls = hasActiveManagerControls();
        const showMemberElections = Boolean(memberHubActive && !councilAccess);

        if (root) {
            root.classList.toggle('is-access-denied', !canViewPublic);
            root.classList.toggle('is-hq-manager-open', showManagerControls);
            root.classList.toggle('has-hq-manager-access', hqManagerEligible);
            root.classList.toggle('is-hq-public-view', canViewPublic && !showManagerControls);
        }

        global.document.querySelectorAll('[data-hq-public]').forEach((node) => {
            setNodeHidden(node, !canViewPublic);
        });

        global.document.querySelectorAll('[data-hq-member-only]').forEach((node) => {
            setNodeHidden(node, !showMemberElections);
        });

        global.document.querySelectorAll('[data-hq-council-only]').forEach((node) => {
            setNodeHidden(node, !showManagerControls);
        });

        const managerBtn = global.document.getElementById('age-hq-manager-toggle');
        if (managerBtn) {
            setNodeHidden(managerBtn, !hqManagerEligible);
            const managerOpen = isHqManagerToggleActive();
            const managerPending = isHqManagerOpenPending();
            const label = managerOpen ? HQ_MANAGER_LABEL_CLOSE : HQ_MANAGER_LABEL_OPEN;
            managerBtn.textContent = label;
            managerBtn.setAttribute('aria-label', label);
            managerBtn.setAttribute('aria-pressed', managerOpen ? 'true' : 'false');
            managerBtn.classList.toggle('is-active', managerOpen);
            managerBtn.classList.toggle('is-pending', managerPending);
            managerBtn.disabled = managerPending;
            managerBtn.title = managerPending
                ? 'Opening HQ Manager…'
                : managerOpen
                    ? 'Close council planning, diplomacy, and dispatch controls'
                    : 'Open council planning, diplomacy, and dispatch controls';
        }

        syncDispatchPanel(isCouncilRoomViewActive());

        const planningBlock = global.document.querySelector('.age-council-room-planning-block');
        const lockForMembers = Boolean(memberHubActive && !councilAccess && showManagerControls);
        if (planningBlock) {
            planningBlock.classList.toggle('is-planning-locked', lockForMembers);
        }
        setMemberPlanningLock(lockForMembers);
    }

    function setCouncilAccessUI(hasAccess) {
        councilAccess = hasAccess;
        syncHeadquartersViewMode(lastAppliedWorkspace);
    }

    function setHqManagerModeOpen(open) {
        const wantOpen = Boolean(open);

        if (!wantOpen) {
            resetHeadquartersManagerMode();
            flushHeadquartersViewMode();
            setActiveMarkerType('');
            global.RoyalArmiesAgeHeadquartersPlanningMap?.setEnabled(false);
            return;
        }

        if (!hqManagerEligible) {
            hqManagerOpenRequested = true;
            flushHeadquartersViewMode();
            return;
        }

        hqManagerOpenRequested = false;
        hqManagerModeOpen = true;
        flushHeadquartersViewMode();
        void ensureManagerPlanningSurface();
    }

    function toggleHqManagerMode() {
        if (hasActiveManagerControls()) {
            setHqManagerModeOpen(false);
            return;
        }
        if (isHqManagerOpenPending()) {
            resetHeadquartersManagerMode();
            flushHeadquartersViewMode();
            return;
        }
        setHqManagerModeOpen(true);
    }

    function startHeadquartersLiveRefresh() {
        stopHeadquartersLiveRefresh();
        if (!isCouncilRoomViewActive()) return;

        hqLiveRefreshTimer = global.setInterval(() => {
            if (!isCouncilRoomViewActive()) {
                stopHeadquartersLiveRefresh();
                return;
            }
            void fetchHeadquartersWorkspace({ silent: true });
        }, HQ_LIVE_REFRESH_MS);
    }

    function stopHeadquartersLiveRefresh() {
        if (!hqLiveRefreshTimer) return;
        global.clearInterval(hqLiveRefreshTimer);
        hqLiveRefreshTimer = 0;
    }

    function setMemberPlanningLock(locked) {
        const lockEl = global.document.getElementById('age-hq-planning-lock');
        const planningBlock = global.document.querySelector('.age-council-room-planning-block');
        if (lockEl) {
            lockEl.hidden = !locked;
            lockEl.setAttribute('aria-hidden', locked ? 'false' : 'true');
        }
        if (planningBlock) planningBlock.classList.toggle('is-planning-locked', locked);
    }

    function setAuthorityGates(workspace) {
        const auth = workspace?.nationAuthority || {};
        const banner = global.document.getElementById('age-hq-authority-banner');
        const lockCopy = global.document.getElementById('age-hq-planning-lock-copy');
        const pendingAuthority = Boolean(workspace?.access?.memberHub) && !workspace?.access?.fullAuthority;
        const bannerText = pendingAuthority
            ? `Nation authority pending: ${auth.rank14Count || 0} of ${auth.requiredCount || 7} commanders at rank ${auth.requiredRank || 14}. Planning, council appointments, and diplomacy unlock when authority is established.`
            : '';

        if (banner) {
            banner.hidden = !pendingAuthority;
            banner.textContent = bannerText;
        }
        if (lockCopy && pendingAuthority) {
            lockCopy.textContent = bannerText;
        }

        const warBtn = global.document.getElementById('age-hq-war-declare-btn');
        const composeBtn = global.document.getElementById('age-hq-diplo-compose-btn');
        const councilLocked = !workspace?.access?.fullAuthority;
        if (warBtn) warBtn.disabled = councilLocked || !workspace?.access?.leader;
        if (composeBtn) composeBtn.disabled = councilLocked || !workspace?.access?.leader;
    }

    function formatElectionCountdown(closesAt) {
        if (!closesAt) return '';
        const remainingMs = Date.parse(closesAt) - Date.now();
        if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
            return 'Poll closing soon.';
        }
        const hours = Math.floor(remainingMs / 3600000);
        const minutes = Math.floor((remainingMs % 3600000) / 60000);
        if (hours > 0) return `${hours}h ${minutes}m remaining`;
        return `${minutes}m remaining`;
    }

    function renderDiplomacyPublicSlice(diplomacyPublic) {
        if (typeof global.RoyalArmiesAgeLeftReportsPanel?.renderDiplomacyAccordsLists === 'function') {
            global.RoyalArmiesAgeLeftReportsPanel.renderDiplomacyAccordsLists(diplomacyPublic);
            return;
        }

        const listEl = global.document.getElementById('age-hq-relations-list');
        if (!listEl) return;

        const rows = [];
        (Array.isArray(diplomacyPublic?.allies) ? diplomacyPublic.allies : []).forEach((row) => {
            rows.push({ type: 'Ally', name: row.nationName || row.nationId });
        });
        (Array.isArray(diplomacyPublic?.naps) ? diplomacyPublic.naps : []).forEach((row) => {
            rows.push({ type: 'NAP', name: row.nationName || row.nationId });
        });

        if (!rows.length) {
            listEl.innerHTML = '<li class="age-hq-relations-empty">No alliances or non-aggression pacts on record.</li>';
            return;
        }

        listEl.innerHTML = rows.map((row) => (
            `<li class="age-hq-relations-item">`
            + `<span class="age-hq-relations-type">${escapeHtml(row.type)}</span>`
            + `<strong class="age-hq-relations-name">${escapeHtml(row.name)}</strong>`
            + `</li>`
        )).join('');
    }

    function renderWarLedgerEmbed(warLedger) {
        global.RoyalArmiesAgeWarLedger?.renderInto?.(
            global.document.getElementById('age-hq-war-ledger-list'),
            warLedger
        );
    }

    function renderMemberHubPanels(workspace) {
        renderDiplomacyPublicSlice(workspace?.diplomacyPublic || {});
        renderWarLedgerEmbed(workspace?.warLedger || {});
        setAuthorityGates(workspace);
        global.RoyalArmiesAgeHeadquartersIntel?.applyWorkspace?.(workspace);
    }

    function renderElectionPoll(role, voteState) {
        const hostId = role === 'leader' ? 'age-hq-vote-leader-candidates' : 'age-hq-vote-vice-candidates';
        const metaId = role === 'leader' ? 'age-hq-poll-leader-meta' : 'age-hq-poll-vice-meta';
        const submitId = role === 'leader' ? 'age-hq-vote-leader-submit' : 'age-hq-vote-vice-submit';
        const host = global.document.getElementById(hostId);
        const selection = role === 'leader' ? leaderVote : viceVote;
        const poll = voteState?.polls?.[role];
        const hasVoted = Boolean(poll?.hasVoted);

        if (!host) return;

        if (!voteCandidates.length) {
            host.innerHTML = '<p class="age-headquarters-request-empty">No eligible commanders found for this nation yet.</p>';
            return;
        }

        host.innerHTML = voteCandidates.map((candidate) => {
            const selected = selection === candidate.id;
            const disabledAttr = votingOpen ? '' : ' disabled';
            return (
                `<button type="button" class="age-hq-vote-candidate-btn${selected ? ' is-selected' : ''}"`
                + ` data-hq-poll="${role}" data-candidate-id="${escapeHtml(candidate.id)}"${disabledAttr}>`
                + `${escapeHtml(candidate.name)}`
                + `</button>`
            );
        }).join('');

        const metaEl = global.document.getElementById(metaId);
        if (metaEl) {
            metaEl.textContent = hasVoted
                ? 'Ballot recorded (anonymous).'
                : 'Select one commander, then cast your vote.';
        }

        const submitEl = global.document.getElementById(submitId);
        if (submitEl) {
            submitEl.disabled = !votingOpen || !selection || hasVoted;
        }
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

    function isHeadquartersOwnerBypass(username) {
        return String(username || '').trim().toLowerCase() === 'caleb_admin';
    }

    /** Portal owner (production + local) or local Owner dev persona. */
    function isDevOwnerHeadquartersBypass(username) {
        const normalized = String(username || '').trim().toLowerCase();
        if (isHeadquartersOwnerBypass(normalized)) return true;
        if (!isLocalDevOwnerPortalView()) return false;
        if (!normalized) return true;
        return normalized === resolveLocalDevOwnerUsername().toLowerCase();
    }

    function applyDevOwnerCouncilAccessUI() {
        const username = resolveHeadquartersUsername();
        if (!isDevOwnerHeadquartersBypass(username)) return;

        memberHubActive = true;
        fullAuthority = true;
        leaderAccess = true;
        hqManagerEligible = true;
        setCouncilAccessUI(true);
        setViceLeaderAccessUI(true);
        setMemberPlanningLock(false);
        syncHeadquartersViewMode(lastAppliedWorkspace);

        const workspace = global.document.getElementById('age-council-room-workspace');
        if (workspace) {
            workspace.classList.remove('is-access-denied');
        }
        const planningBlock = global.document.querySelector('.age-council-room-planning-block');
        if (planningBlock) {
            planningBlock.classList.remove('is-planning-locked');
        }
        const banner = global.document.getElementById('age-hq-authority-banner');
        if (banner) {
            banner.hidden = true;
        }
    }

    function syncHeadquartersShellLayout() {
        if (typeof global.syncAgeHeadquartersPlanningLayout === 'function') {
            global.requestAnimationFrame(() => {
                global.syncAgeHeadquartersPlanningLayout();
                global.syncAgeHeadquartersCommandRailLayout?.();
                global.RoyalArmiesAgeHeadquartersPlanningMap?.refreshLayout?.();
            });
        }
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
        const displayName = String(username || '').trim() || 'caleb_admin';
        const devLeader = { username: normalizedUsername(displayName), name: displayName };

        return {
            access: {
                council: true,
                leader: true,
                viceLeader: true,
                fullAuthority: true,
                memberHub: true
            },
            nationAuthority: {
                established: true,
                rank14Count: 7,
                requiredCount: 7,
                requiredRank: 14
            },
            planning: savedPlanning || getDefaultDevPlanningState(),
            diplomacy: { incoming: [], outgoing: [] },
            diplomacyPublic: { allies: [], naps: [], enemies: [] },
            warLedger: { wars: [], relations: { allies: [], naps: [], enemies: [] } },
            vote: {
                isOpen: false,
                candidates: [{
                    id: devLeader.username,
                    username: displayName,
                    name: displayName,
                    roleHint: 'Commander'
                }],
                myVotes: { leaderCandidateId: '', viceCandidateId: '' },
                electedLeader: devLeader,
                electedViceLeader: null,
                lockedUntil: null,
                lockDays: 7
            },
            cabinet: {
                leader: devLeader,
                viceLeader: null,
                councilMembers: [devLeader],
                planners: []
            },
            warTargets: resolveDevWarTargets(),
            fortifiedCities: []
        };
    }

    function resolveDevWarTargets() {
        const catalog = global.RoyalArmiesAgeWorldMap?.getCatalog?.();
        const nations = new Map();
        const playerNation = String(
            global.RoyalArmiesAgeMovement?.getNationId?.()
            || global.RoyalArmiesAgeWorldMap?.getPlayerNationId?.()
            || ''
        ).trim().toLowerCase();

        (catalog?.cities || []).forEach((city) => {
            const id = String(city?.nationId || '').trim().toLowerCase();
            if (!id || id === playerNation) return;
            if (!nations.has(id)) {
                nations.set(id, String(city.nationName || city.nationId || id));
            }
        });

        return Array.from(nations.entries())
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([id, name]) => ({ id, name }));
    }

    /** Owner dev on :5500/:3000 — full HQ even when NEXUS returns member-level access. */
    function mergeDevOwnerHeadquartersWorkspace(workspace, username) {
        if (!isDevOwnerHeadquartersBypass(username)) {
            return workspace;
        }

        const fallback = buildDevOwnerFallbackWorkspace(username);
        if (!fallback) return workspace;

        const base = workspace && typeof workspace === 'object' ? workspace : {};
        const serverPlanning = base.planning && typeof base.planning === 'object' ? base.planning : {};
        const devPlanning = fallback.planning || getDefaultDevPlanningState();
        const serverCabinet = base.cabinet && typeof base.cabinet === 'object' ? base.cabinet : {};
        const serverVote = base.vote && typeof base.vote === 'object' ? base.vote : {};

        const mergedCabinet = {
            leader: serverCabinet.leader || fallback.cabinet.leader,
            viceLeader: serverCabinet.viceLeader ?? fallback.cabinet.viceLeader,
            councilMembers: Array.isArray(serverCabinet.councilMembers) && serverCabinet.councilMembers.length
                ? serverCabinet.councilMembers
                : fallback.cabinet.councilMembers,
            planners: Array.isArray(serverCabinet.planners) ? serverCabinet.planners : []
        };

        return {
            ...fallback,
            ...base,
            access: {
                council: true,
                leader: true,
                viceLeader: true,
                fullAuthority: true,
                memberHub: true
            },
            nationAuthority: base.nationAuthority || fallback.nationAuthority,
            diplomacyPublic: base.diplomacyPublic || fallback.diplomacyPublic,
            warLedger: base.warLedger || fallback.warLedger,
            planning: {
                ...getDefaultDevPlanningState(),
                ...devPlanning,
                ...serverPlanning,
                pills: Array.isArray(serverPlanning.pills) && serverPlanning.pills.length
                    ? serverPlanning.pills
                    : (Array.isArray(devPlanning.pills) ? devPlanning.pills : []),
                arrows: Array.isArray(serverPlanning.arrows) && serverPlanning.arrows.length
                    ? serverPlanning.arrows
                    : (Array.isArray(devPlanning.arrows) ? devPlanning.arrows : []),
                tempMainCityId: serverPlanning.tempMainCityId || devPlanning.tempMainCityId || '',
                confirmed: Boolean(serverPlanning.confirmed ?? devPlanning.confirmed),
                hasPublishedPlan: Boolean(serverPlanning.hasPublishedPlan ?? devPlanning.hasPublishedPlan)
            },
            diplomacy: {
                incoming: Array.isArray(base.diplomacy?.incoming) ? base.diplomacy.incoming : [],
                outgoing: Array.isArray(base.diplomacy?.outgoing) ? base.diplomacy.outgoing : []
            },
            vote: {
                ...fallback.vote,
                ...serverVote,
                isOpen: false,
                electedLeader: serverVote.electedLeader || mergedCabinet.leader,
                electedViceLeader: serverVote.electedViceLeader || mergedCabinet.viceLeader || null
            },
            cabinet: mergedCabinet,
            warTargets: Array.isArray(base.warTargets) && base.warTargets.length
                ? base.warTargets
                : fallback.warTargets,
            fortifiedCities: Array.isArray(base.fortifiedCities) ? base.fortifiedCities : fallback.fortifiedCities
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
        if (typeof global.showPortalAlert !== 'function') {
            console.warn('[RIFT] Headquarters notice (portal alert unavailable):', title || 'Headquarters', message);
            return;
        }
        await global.showPortalAlert(message, title || 'Headquarters');
    }

    async function showClearPlanConfirm() {
        if (typeof global.showPortalConfirm !== 'function') {
            console.warn('[RIFT] Clear Plan confirm unavailable — portal-alerts.js must load before headquarters.');
            return false;
        }
        return global.showPortalConfirm(
            'Remove the confirmed nation plan from the world map?',
            {
                title: 'Clear Plan',
                confirmLabel: 'Clear Plan',
                cancelLabel: 'Keep Plan'
            }
        );
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
        lastVoteState = voteState || null;
        votingOpen = Boolean(voteState?.isOpen) && !councilAccess;
        const electionsClosed = !votingOpen;
        const electionsHost = global.document.getElementById('age-hq-elections-host');
        const closedOverlay = global.document.getElementById('age-hq-elections-closed-overlay');

        if (electionsHost) {
            electionsHost.classList.toggle('is-elections-closed', electionsClosed);
        }
        if (closedOverlay) {
            closedOverlay.hidden = !electionsClosed;
            closedOverlay.setAttribute('aria-hidden', electionsClosed ? 'false' : 'true');
        }

        const voteMeta = global.document.getElementById('age-hq-vote-meta');
        if (voteMeta) {
            if (votingOpen) {
                voteMeta.textContent = `Anonymous ballots · ${formatElectionCountdown(voteState?.closesAt) || 'Poll open'}`;
            } else if (voteState?.electionStatus === 'idle') {
                const minPlayers = voteState?.minNationPlayers || 10;
                const count = voteState?.nationPlayerCount || 0;
                voteMeta.textContent = `Elections open when ${minPlayers}+ commanders enlist (${count} now).`;
            } else {
                voteMeta.textContent = 'Elections are currently closed.';
            }
        }

        if (votingOpen) {
            renderElectionPoll('leader', voteState);
            renderElectionPoll('vice', voteState);
        } else {
            global.document.querySelectorAll('.age-hq-vote-candidate-btn, .age-hq-poll-submit').forEach((node) => {
                node.disabled = true;
            });
        }

        const statusEl = global.document.getElementById('age-hq-vote-status');
        if (statusEl) {
            if (votingOpen && voteState?.anonymous) {
                statusEl.hidden = false;
                statusEl.textContent = 'All votes are anonymous. Polls close when every commander has voted or after 12 hours.';
            } else {
                statusEl.hidden = true;
            }
        }

        const summary = global.document.querySelector('[data-hq-leadership-summary]');
        const showLeadershipSummary = Boolean(voteState?.electedLeader || voteState?.electedViceLeader);
        if (summary) {
            setNodeHidden(summary, !showLeadershipSummary);
        }

        const leaderName = voteState?.electedLeader?.name || '—';
        const viceName = voteState?.electedViceLeader?.name || '—';
        global.document.querySelectorAll('[data-hq-elected-leader-display]').forEach((node) => {
            node.textContent = leaderName;
        });
        global.document.querySelectorAll('[data-hq-elected-vice-display]').forEach((node) => {
            node.textContent = viceName;
        });
        global.document.querySelectorAll('[data-hq-vote-reopens-display]').forEach((reopenEl) => {
            const reopenText = formatVoteReopenLabel(voteState?.lockedUntil);
            reopenEl.textContent = reopenText;
            setNodeHidden(reopenEl, !reopenText);
        });

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

    function applyWorkspace(workspace, options = {}) {
        const silent = Boolean(options?.silent);
        const username = resolveHeadquartersUsername();
        workspace = mergeDevOwnerHeadquartersWorkspace(workspace, username);
        if (!workspace) {
            if (!silent) {
                setHeadquartersLoadStatus(describeHeadquartersAccessGap(null)?.message || '', 'error');
            }
            lastAppliedWorkspace = null;
            lastWorkspaceRevision = '';
            syncHeadquartersViewMode(null);
            return false;
        }

        if (!silent) {
            const accessGap = describeHeadquartersAccessGap(workspace);
            setHeadquartersLoadStatus(accessGap?.message || '', accessGap?.tone || 'info');
        }

        const previousRevision = lastWorkspaceRevision;
        const nextRevision = buildWorkspaceRevision(workspace);
        const revisionChanged = Boolean(nextRevision && nextRevision !== previousRevision);

        lastAppliedWorkspace = workspace;
        lastWorkspaceRevision = nextRevision;

        fullAuthority = Boolean(workspace.access?.fullAuthority);
        memberHubActive = Boolean(workspace.access?.memberHub);
        leaderAccess = Boolean(workspace.access?.leader);
        hqManagerEligible = resolveHqManagerEligible(workspace.access);
        if (!hqManagerEligible) {
            resetHeadquartersManagerMode();
        } else {
            applyPendingHqManagerMode();
        }
        setCouncilAccessUI(Boolean(workspace.access?.council));
        setViceLeaderAccessUI(Boolean(workspace.access?.viceLeader));
        syncHeadquartersViewMode(workspace);
        if (hqManagerModeOpen) {
            flushHeadquartersViewMode();
        }

        voteCandidates = Array.isArray(workspace.vote?.candidates) ? workspace.vote.candidates : [];
        leaderVote = String(workspace.vote?.myVotes?.leaderCandidateId || '');
        viceVote = String(workspace.vote?.myVotes?.viceCandidateId || '');

        diplomacyIncoming = Array.isArray(workspace.diplomacy?.incoming) ? workspace.diplomacy.incoming : [];
        diplomacyOutgoing = Array.isArray(workspace.diplomacy?.outgoing) ? workspace.diplomacy.outgoing : [];
        warTargets = Array.isArray(workspace.warTargets) ? workspace.warTargets : [];

        setVotingPanelUI(workspace.vote || {});
        renderMemberHubPanels(workspace);
        lastCabinetState = workspace.cabinet || null;
        renderNationCabinet(lastCabinetState, workspace.vote || {});
        renderTreasuryFortifications(workspace.fortifiedCities || []);
        planningConfirmed = Boolean(workspace.planning?.confirmed);
        hasPublishedPlan = Boolean(workspace.planning?.hasPublishedPlan);
        applyPlanningSnapshotToMap(workspace.planning || {});
        global.RoyalArmiesAgeHeadquartersPlanningMap?.setPlanningLocked?.(planningConfirmed);
        populateWarTargetSelect();
        renderDiploRequests();
        if (!votingOpen) {
            leaderVote = String(workspace.vote?.myVotes?.leaderCandidateId || '');
            viceVote = String(workspace.vote?.myVotes?.viceCandidateId || '');
        }
        syncToolbarState();
        void global.RoyalArmiesAgeWorldPlanOverlay?.refreshNationPlan?.();

        if (hasActiveManagerControls()) {
            syncHeadquartersShellLayout();
            if (revisionChanged) {
                void ensureManagerPlanningSurface();
            }
        }

        if (isDevOwnerHeadquartersBypass(username)) {
            applyDevOwnerCouncilAccessUI();
            setAuthorityGates(workspace);
            return true;
        }

        return Boolean(workspace.access?.council);
    }

    async function fetchHeadquartersWorkspace(options = {}) {
        const silent = Boolean(options?.silent);

        if (typeof global.shouldSuppressRepeatedLocalDevApiWarnings === 'function'
            && global.shouldSuppressRepeatedLocalDevApiWarnings()) {
            const fallback = buildDevOwnerFallbackWorkspace(resolveHeadquartersUsername());
            if (fallback) {
                return applyWorkspace(fallback, options);
            }
        }

        const username = resolveHeadquartersUsername();
        if (!username) {
            if (!isLocalDevOwnerPortalView()) {
                if (!silent) {
                    setHeadquartersLoadStatus(
                        'No active commander session. Sign in from the portal, then open Headquarters again.',
                        'warn'
                    );
                }
                applyWorkspace(null, options);
                setCouncilAccessUI(false);
                setViceLeaderAccessUI(false);
                leaderAccess = false;
                hqManagerEligible = false;
                resetHeadquartersManagerMode();
                syncHeadquartersViewMode(null);
            }
            return false;
        }

        if (!silent) {
            setHeadquartersLoadStatus('Loading Council Room…', 'info');
        }

        try {
            const response = await global.fetch(
                resolveApiUrl(`/api/portal/age/headquarters?username=${encodeURIComponent(username)}`),
                { credentials: 'same-origin' }
            );
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                if (!silent && typeof global.showRiftError === 'function') {
                    await global.showRiftError(payload, 'Headquarters');
                }
                throw new Error(`headquarters workspace ${response.status}`);
            }

            if (!payload?.workspace) {
                if (!silent) {
                    setHeadquartersLoadStatus(
                        'Server responded but returned no headquarters workspace. Check F12 → Network → headquarters.',
                        'error'
                    );
                }
                logHeadquartersWorkspaceSummary(null, 'missing-workspace');
                return applyWorkspace(null, options);
            }

            logHeadquartersWorkspaceSummary(payload.workspace, silent ? 'api-poll' : 'api');
            return applyWorkspace(payload.workspace, { silent });
        } catch (err) {
            console.warn('[RIFT] Headquarters workspace load failed:', err.message);

            const fallback = buildDevOwnerFallbackWorkspace(username);
            if (fallback) {
                console.warn('[RIFT] Using dev owner Headquarters fallback. Restart NEXUS (node server.js) if server sync is missing.');
                logHeadquartersWorkspaceSummary(fallback, 'dev-fallback');
                return applyWorkspace(fallback, options);
            }

            if (!silent) {
                setHeadquartersLoadStatus(
                    `Headquarters request failed (${err.message}). Open F12 → Network and inspect /api/portal/age/headquarters.`,
                    'error'
                );
            }
            setCouncilAccessUI(false);
            setViceLeaderAccessUI(false);
            leaderAccess = false;
            hqManagerEligible = false;
            resetHeadquartersManagerMode();
            syncHeadquartersViewMode(null);
            return false;
        }
    }

    function activateHeadquartersView() {
        bindUi();
        bindCouncilRoomModalChrome();
        applyDevOwnerCouncilAccessUI();
        syncHeadquartersViewMode(lastAppliedWorkspace);
        startHeadquartersLiveRefresh();
        if (hasActiveManagerControls()) {
            void ensureManagerPlanningSurface();
        }
        void fetchHeadquartersWorkspace({ silent: true });
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
        const username = resolveHeadquartersUsername();
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
        if (!hasActiveManagerControls() || !snapshot || planningConfirmed) return;
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
        if (!hasActiveManagerControls() || planningConfirmed) return;
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
        global.RoyalArmiesAgeWorldPlanOverlay?.setDevMapPlanSuppressed?.(resolveHeadquartersUsername(), false);
    }

    async function editPlanning() {
        if (!hasActiveManagerControls() || !planningConfirmed) return;
        setActiveMarkerType('');
        await patchHeadquarters({ editPlanning: true });
    }

    async function clearPublishedPlanFromMap() {
        if (!hasActiveManagerControls() || !hasPublishedPlan || clearingPublishedPlan) return;

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

    function onElectionCandidateClick(event, role) {
        const button = event.target.closest('[data-hq-poll]');
        if (!button || button.disabled || !votingOpen) return;
        if (button.getAttribute('data-hq-poll') !== role) return;

        const candidateId = button.getAttribute('data-candidate-id') || '';
        if (role === 'leader') {
            leaderVote = candidateId;
            if (viceVote === candidateId) viceVote = '';
        } else {
            viceVote = candidateId;
            if (leaderVote === candidateId) leaderVote = '';
        }

        renderElectionPoll('leader', lastVoteState);
        renderElectionPoll('vice', lastVoteState);
    }

    async function submitElectionPoll(role) {
        if (!votingOpen) return;

        const patch = role === 'leader'
            ? { vote: { leaderCandidateId: leaderVote } }
            : { vote: { viceCandidateId: viceVote } };

        await patchHeadquarters(patch);
        await fetchHeadquartersWorkspace();
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
        const canReset = hasActiveManagerControls() && !planningConfirmed && (hasSteps || hasSelection || activeMarkerType || hasTempMain);

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
                enabled = hasActiveManagerControls() && canPlacePill;
            } else {
                enabled = hasActiveManagerControls() && isArrowTool;
            }

            button.disabled = !enabled;
            button.classList.toggle('is-active', enabled && type === activeMarkerType);
        });

        const resetBtn = global.document.getElementById('age-hq-planning-reset-btn');
        if (resetBtn) resetBtn.disabled = !canReset;

        const statusEl = global.document.getElementById('age-hq-planning-toolbar-status');
        if (statusEl) {
            if (!hasActiveManagerControls()) {
                statusEl.textContent = !hqManagerModeOpen && hqManagerEligible
                    ? 'Open HQ Manager to edit SF Planning'
                    : fullAuthority
                        ? 'Council access required'
                        : 'Nation authority required for SF Planning';
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
            if (!hasActiveManagerControls()) {
                hint.textContent = hqManagerEligible
                    ? 'Open HQ Manager to place SF Planning orders.'
                    : 'SF Planning markers require Council access.';
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
            const canConfirm = hasActiveManagerControls() && !planningConfirmed && hasSteps;
            const canEdit = hasActiveManagerControls() && planningConfirmed;
            confirmBtn.disabled = !(canConfirm || canEdit);
            confirmBtn.textContent = planningConfirmed ? 'Edit Plan' : 'Confirm Plan';
            confirmBtn.classList.toggle('is-edit-mode', planningConfirmed);
            confirmBtn.setAttribute('data-hq-planning-mode', planningConfirmed ? 'edit' : 'confirm');
        }

        const clearBtn = global.document.getElementById('age-hq-planning-clear-btn');
        if (clearBtn) {
            const showClear = hasActiveManagerControls() && hasPublishedPlan;
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

        const username = resolveHeadquartersUsername();
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

    function bindCouncilRoomModalChrome() {
        const managerBtn = global.document.getElementById('age-hq-manager-toggle');
        if (managerBtn && managerBtn.dataset.hqModalChromeBound !== '1') {
            managerBtn.dataset.hqModalChromeBound = '1';
            managerBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                toggleHqManagerMode();
            });
        }

        const closeBtn = global.document.getElementById('age-council-room-close');
        if (closeBtn && closeBtn.dataset.hqModalChromeBound !== '1') {
            closeBtn.dataset.hqModalChromeBound = '1';
            closeBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                setCouncilRoomModalOpen(false);
            });
        }

        const backdrop = global.document.getElementById('age-council-room-backdrop');
        if (backdrop && backdrop.dataset.hqModalChromeBound !== '1') {
            backdrop.dataset.hqModalChromeBound = '1';
            backdrop.addEventListener('click', () => {
                setCouncilRoomModalOpen(false);
            });
        }

        const dialog = getCouncilRoomModal()?.querySelector('.age-council-room-dialog');
        if (dialog && dialog.dataset.hqModalChromeBound !== '1') {
            dialog.dataset.hqModalChromeBound = '1';
            dialog.addEventListener('click', (event) => {
                event.stopPropagation();
            });
        }
    }

    function bindUi() {
        if (mounted) return;
        mounted = true;

        workspaceEl = global.document.getElementById('age-council-room-workspace');
        bindCouncilRoomModalChrome();

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
                warDeclarationRecord: { targetNationId: target }
            });

            feedback.hidden = false;
            if (!result?.warRecord) {
                feedback.textContent = 'Unable to record war declaration. Nation authority and Leader status are required.';
                feedback.classList.add('is-error');
                return;
            }

            const opponent = result.warRecord.opponentNationName || target;
            feedback.textContent = `War with ${opponent} is now permanently recorded in the War Ledger.`;
            feedback.classList.remove('is-error');
            await fetchHeadquartersWorkspace();
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

        global.document.getElementById('age-hq-vote-leader-candidates')?.addEventListener('click', (event) => {
            onElectionCandidateClick(event, 'leader');
        });
        global.document.getElementById('age-hq-vote-vice-candidates')?.addEventListener('click', (event) => {
            onElectionCandidateClick(event, 'vice');
        });
        global.document.getElementById('age-hq-vote-leader-submit')?.addEventListener('click', () => {
            submitElectionPoll('leader');
        });
        global.document.getElementById('age-hq-vote-vice-submit')?.addEventListener('click', () => {
            submitElectionPoll('vice');
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
            if (!ok) {
                console.warn('[RIFT] Headquarters planning map failed to mount.');
                setHeadquartersLoadStatus(
                    'SF planning map could not initialize. Hard-refresh the page (Ctrl+Shift+R) to load the latest scripts.',
                    'warn'
                );
                return false;
            }
            host.dataset.hqMapMounted = 'true';
        }

        await waitForLayout();
        if (pendingPlanningSnapshot) {
            planningMap.applyPlanningSnapshot?.(pendingPlanningSnapshot);
        }
        refreshPlanningMapLayout();
        return true;
    }

    async function openCouncilRoomPageView() {
        if (!isCouncilRoomPage()) return;

        resetHeadquartersManagerMode();
        councilRoomModalOpen = true;
        global.document.body.classList.add('age-council-room-open');

        const workspace = global.document.getElementById('age-council-room-workspace');
        if (workspace) {
            workspace.hidden = false;
            workspace.removeAttribute('hidden');
            workspace.setAttribute('aria-hidden', 'false');
        }

        await onViewOpen();
    }

    function setCouncilRoomModalOpen(open) {
        if (isCouncilRoomPage()) {
            if (open) {
                void openCouncilRoomPageView();
            }
            return;
        }

        const modal = getCouncilRoomModal();
        const nextOpen = Boolean(open);
        if (!modal) return;

        const wasOpen = councilRoomModalOpen;
        if (nextOpen && !wasOpen) {
            resetHeadquartersManagerMode();
        }

        councilRoomModalOpen = nextOpen;
        modal.hidden = !nextOpen;
        modal.setAttribute('aria-hidden', nextOpen ? 'false' : 'true');
        global.document.getElementById('age-council-room-open')?.classList.toggle('is-active', nextOpen);
        global.document.body.classList.toggle('age-council-room-open', nextOpen);

        if (!nextOpen) {
            onViewClose();
            if (councilRoomEscapeHandler) {
                global.document.removeEventListener('keydown', councilRoomEscapeHandler);
                councilRoomEscapeHandler = null;
            }
            return;
        }

        void onViewOpen();
        global.document.getElementById('age-council-room-close')?.focus?.()
            || modal.querySelector('.age-age-center-modal-close')?.focus?.();

        if (!councilRoomEscapeHandler) {
            councilRoomEscapeHandler = (event) => {
                if (event.key === 'Escape') {
                    setCouncilRoomModalOpen(false);
                }
            };
            global.document.addEventListener('keydown', councilRoomEscapeHandler);
        }
    }

    async function ensureManagerPlanningSurface() {
        const planningHost = global.document.getElementById('age-hq-planning-map-host');
        if (!planningHost || !hasActiveManagerControls()) {
            global.RoyalArmiesAgeHeadquartersPlanningMap?.setEnabled(false);
            return;
        }

        const ownerBypass = isDevOwnerHeadquartersBypass(resolveHeadquartersUsername());
        const canMountPlanningMap = !isCouncilRoomPage() || hasActiveManagerControls() || ownerBypass;
        if (!canMountPlanningMap) {
            global.RoyalArmiesAgeHeadquartersPlanningMap?.setEnabled(false);
            return;
        }

        await ensurePlanningMap();
        global.RoyalArmiesAgeHeadquartersPlanningMap?.setEnabled(true);
        await waitForLayout();
        refreshPlanningMapLayout();
        syncHeadquartersShellLayout();
        global.RoyalArmiesAgeMovementPanel?.refreshCityPlayers?.();
        syncToolbarState();
    }

    async function onViewOpen() {
        const generation = ++hqViewOpenGeneration;
        bindUi();
        bindCouncilRoomModalChrome();
        applyDevOwnerCouncilAccessUI();
        const ownerBypass = isDevOwnerHeadquartersBypass(resolveHeadquartersUsername());
        await fetchHeadquartersWorkspace();
        if (generation !== hqViewOpenGeneration) return;

        if (ownerBypass) {
            applyDevOwnerCouncilAccessUI();
        }
        applyPendingHqManagerMode();
        flushHeadquartersViewMode();
        startHeadquartersLiveRefresh();

        if (hasActiveManagerControls() || ownerBypass) {
            await ensureManagerPlanningSurface();
        } else {
            setActiveMarkerType('');
            global.RoyalArmiesAgeHeadquartersPlanningMap?.setEnabled(false);
        }
    }

    function onViewClose() {
        hqViewOpenGeneration += 1;
        stopHeadquartersLiveRefresh();
        resetHeadquartersManagerMode();
        syncHeadquartersViewMode(lastAppliedWorkspace);
        syncDispatchPanel(false);
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
        applyWorkspace,
        onViewOpen,
        onViewClose,
        activateHeadquartersView,
        openCouncilRoom: () => setCouncilRoomModalOpen(true),
        openCouncilRoomPageView,
        closeCouncilRoom: () => setCouncilRoomModalOpen(false),
        isCouncilRoomOpen: () => isCouncilRoomViewActive(),
        refreshHeadquartersAccess,
        fetchHeadquartersWorkspace,
        syncDispatchPanel,
        hasCouncilAccess: () => councilAccess,
        hasLeaderAccess: () => leaderAccess,
        hasViceLeaderAccess: () => viceLeaderAccess,
        hasActiveManagerControls,
        isHqManagerOpen: () => hqManagerModeOpen,
        setHqManagerModeOpen,
        refreshHeadquartersWorkspace: () => fetchHeadquartersWorkspace({ silent: true })
    };

    global.RoyalArmiesAgeCouncilRoom = global.RoyalArmiesAgeHeadquarters;
    global.enableAgeHeadquarters = enable;
    global.enableAgeCouncilRoom = enable;
})(window);

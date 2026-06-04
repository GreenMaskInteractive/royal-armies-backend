/**
 * NEXUS — Age Headquarters workspace (planning, votes, diplomacy ledger).
 */
'use strict';

const {
    MOVE_POINTS_MAX,
    getCatalogCity,
    loadCityCatalog,
    resolveCityConnection,
    resolveCatalogNationKey,
    classifyBorderRelationship
} = require('./nexus-age-movement');
const { normalizeDispatchAlert } = require('./nexus-age-dispatch-alert');
const { normalizeSpyLogs } = require('./nexus-age-hq-intel');

const PILL_MARKER_TYPES = new Set(['hold']);
const ARROW_MARKER_TYPES = new Set(['sf', 'mf', 'move', 'taxi', 'temp-main']);
const MP_LIMITED_ARROW_TYPES = new Set(['move', 'mf']);
const IN_CITY_HOLD_ARROW_TYPES = new Set(['move', 'taxi']);
const MAX_PLANNING_STEPS = 64;
const MAX_DIPLO_REQUESTS = 40;
const LEADERSHIP_LOCK_DAYS = 7;
const LEADERSHIP_LOCK_MS = LEADERSHIP_LOCK_DAYS * 24 * 60 * 60 * 1000;
const MIN_NATION_ELECTION_PLAYERS = 10;
const ELECTION_WINDOW_MS = 12 * 60 * 60 * 1000;
const NATION_AUTHORITY_RANK = 14;
const NATION_AUTHORITY_MIN_RANK14 = 7;

function normalizeUsername(value) {
    return String(value || '').trim().toLowerCase();
}

function getDefaultPlanningState() {
    return {
        pills: [],
        arrows: [],
        tempMainCityId: '',
        updatedAt: null,
        updatedBy: null
    };
}

function getDefaultWarLedgerState() {
    return {
        wars: [],
        relations: {
            allies: [],
            naps: [],
            enemies: []
        }
    };
}

function getDefaultNationHeadquartersState() {
    return {
        planning: getDefaultPlanningState(),
        publishedPlanning: null,
        planningConfirmed: false,
        diplomacy: {
            incoming: [],
            outgoing: []
        },
        votesByUsername: {},
        election: getDefaultElectionState(),
        warLedger: getDefaultWarLedgerState(),
        dispatchAlert: null,
        spyLogs: [],
        updatedAt: null
    };
}

function getDefaultElectionState() {
    return {
        status: 'idle',
        openedAt: null,
        closesAt: null,
        closedAt: null,
        closedReason: null,
        lockedUntil: null,
        electedAt: null
    };
}

function normalizeElectionState(raw) {
    const statusRaw = String(raw?.status || '').trim().toLowerCase();
    const status = statusRaw === 'open' || statusRaw === 'closed' ? statusRaw : 'idle';
    return {
        status,
        openedAt: String(raw?.openedAt || '').trim() || null,
        closesAt: String(raw?.closesAt || '').trim() || null,
        closedAt: String(raw?.closedAt || '').trim() || null,
        closedReason: String(raw?.closedReason || '').trim() || null,
        lockedUntil: String(raw?.lockedUntil || '').trim() || null,
        electedAt: String(raw?.electedAt || '').trim() || null
    };
}

function normalizeWarLedgerEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || '').trim().slice(0, 64);
    const opponentNationId = resolveCatalogNationKey(raw.opponentNationId || raw.targetNationId);
    const opponentNationName = String(raw.opponentNationName || raw.targetNationName || opponentNationId || '').trim().slice(0, 80);
    const declaredAt = String(raw.declaredAt || '').trim() || null;
    const status = String(raw.status || 'active').trim().toLowerCase() === 'ended' ? 'ended' : 'active';
    if (!id || !opponentNationId || !declaredAt) return null;
    return {
        id,
        opponentNationId,
        opponentNationName: opponentNationName || opponentNationId,
        declaredAt,
        declaredBy: normalizeUsername(raw.declaredBy),
        status,
        endedAt: String(raw.endedAt || '').trim() || null,
        endedReason: String(raw.endedReason || '').trim().slice(0, 120) || null
    };
}

function normalizeRelationEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const nationId = resolveCatalogNationKey(raw.nationId || raw.id);
    const nationName = String(raw.nationName || raw.nation || nationId || '').trim().slice(0, 80);
    if (!nationId) return null;
    return { nationId, nationName: nationName || nationId };
}

function normalizeWarLedgerState(raw) {
    const wars = Array.isArray(raw?.wars) ? raw.wars : [];
    const relations = raw?.relations && typeof raw.relations === 'object' ? raw.relations : {};
    return {
        wars: wars.map(normalizeWarLedgerEntry).filter(Boolean),
        relations: {
            allies: (Array.isArray(relations.allies) ? relations.allies : []).map(normalizeRelationEntry).filter(Boolean),
            naps: (Array.isArray(relations.naps) ? relations.naps : []).map(normalizeRelationEntry).filter(Boolean),
            enemies: (Array.isArray(relations.enemies) ? relations.enemies : []).map(normalizeRelationEntry).filter(Boolean)
        }
    };
}

function normalizeDiplomacyRequest(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || '').trim().slice(0, 64);
    const type = String(raw.type || '').trim().slice(0, 32);
    const nation = String(raw.nation || '').trim().slice(0, 80);
    const status = String(raw.status || '').trim().slice(0, 120);
    if (!id || !type || !nation) return null;
    return { id, type, nation, status: status || 'Pending' };
}

function normalizeDiplomacyState(raw) {
    const incoming = Array.isArray(raw?.incoming) ? raw.incoming : [];
    const outgoing = Array.isArray(raw?.outgoing) ? raw.outgoing : [];
    return {
        incoming: incoming.map(normalizeDiplomacyRequest).filter(Boolean).slice(0, MAX_DIPLO_REQUESTS),
        outgoing: outgoing.map(normalizeDiplomacyRequest).filter(Boolean).slice(0, MAX_DIPLO_REQUESTS)
    };
}

function normalizePill(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || '').trim().slice(0, 64);
    const cityId = String(raw.cityId || '').trim();
    const type = String(raw.type || '').trim().toLowerCase();
    const order = Math.max(0, Math.floor(Number(raw.order) || 0));
    if (!id || !cityId || !PILL_MARKER_TYPES.has(type)) return null;
    if (!getCatalogCity(cityId)) return null;
    return { id, cityId, type, order };
}

function normalizeArrow(raw, holdCityIds) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || '').trim().slice(0, 64);
    const fromCityId = String(raw.fromCityId || '').trim();
    const toCityId = String(raw.toCityId || '').trim();
    const type = String(raw.type || '').trim().toLowerCase();
    const order = Math.max(0, Math.floor(Number(raw.order) || 0));
    if (!id || !fromCityId || !toCityId) return null;
    if (fromCityId === toCityId) {
        const holdSet = holdCityIds instanceof Set ? holdCityIds : new Set();
        if (!IN_CITY_HOLD_ARROW_TYPES.has(type) || !holdSet.has(fromCityId)) {
            return null;
        }
    }
    if (!ARROW_MARKER_TYPES.has(type)) return null;
    if (!getCatalogCity(fromCityId) || !getCatalogCity(toCityId)) return null;

    let label = String(raw.label || '').trim().slice(0, 32);
    if (!label) {
        if (type === 'sf') label = 'SF';
        else if (type === 'mf') label = 'MF';
        else if (type === 'move') label = 'Move';
        else if (type === 'taxi') label = 'Taxi';
        else if (type === 'temp-main') label = 'Temp Main';
    } else if (type === 'sf') {
        label = 'SF';
    }

    return {
        id,
        fromCityId,
        toCityId,
        type,
        label,
        order
    };
}

function resolveLegMovePointCost(fromCityId, toCityId) {
    const fromCity = getCatalogCity(fromCityId);
    const toCity = getCatalogCity(toCityId);
    if (!fromCity || !toCity) return Infinity;
    if (fromCity.id === toCity.id) return 0;

    const connection = resolveCityConnection(fromCityId, toCityId);
    if (connection?.movePointCost) {
        return Math.max(1, Math.min(MOVE_POINTS_MAX, Math.floor(Number(connection.movePointCost)) || 1));
    }

    return Infinity;
}

function getCombinedPlanningSteps(pills, arrows) {
    const pillSteps = (Array.isArray(pills) ? pills : []).map((pill) => ({ kind: 'pill', ...pill }));
    const arrowSteps = (Array.isArray(arrows) ? arrows : []).map((arrow) => ({ kind: 'arrow', ...arrow }));
    return pillSteps.concat(arrowSteps).sort((a, b) => a.order - b.order);
}

function countTrailingMoveMfMpUsed(planningOrArrows) {
    const steps = Array.isArray(planningOrArrows)
        ? getCombinedPlanningSteps([], planningOrArrows)
        : getCombinedPlanningSteps(planningOrArrows?.pills, planningOrArrows?.arrows);

    let mpUsed = 0;

    for (let i = steps.length - 1; i >= 0; i -= 1) {
        const step = steps[i];
        if (step.kind !== 'arrow' || !MP_LIMITED_ARROW_TYPES.has(step.type)) break;

        const legCost = resolveLegMovePointCost(step.fromCityId, step.toCityId);
        if (!Number.isFinite(legCost) || legCost <= 0) continue;
        mpUsed += legCost;
    }

    return mpUsed;
}

function planningMpBudget(planning) {
    const used = countTrailingMoveMfMpUsed(planning);
    return {
        used,
        max: MOVE_POINTS_MAX,
        remaining: Math.max(0, MOVE_POINTS_MAX - used)
    };
}

function normalizePlanningState(raw, options = {}) {
    const allowTempMain = Boolean(options.allowTempMain);
    const pills = (Array.isArray(raw?.pills) ? raw.pills : [])
        .map(normalizePill)
        .filter(Boolean)
        .slice(0, MAX_PLANNING_STEPS);
    const holdCityIds = new Set(
        pills.filter((pill) => pill.type === 'hold').map((pill) => pill.cityId)
    );
    const arrows = (Array.isArray(raw?.arrows) ? raw.arrows : [])
        .map((arrow) => normalizeArrow(arrow, holdCityIds))
        .filter(Boolean)
        .slice(0, MAX_PLANNING_STEPS);

    const combinedCount = pills.length + arrows.length;
    if (combinedCount > MAX_PLANNING_STEPS) {
        return { errorCode: 'HQ_PLANNING_TOO_LARGE' };
    }

    if (countTrailingMoveMfMpUsed({ pills, arrows }) > MOVE_POINTS_MAX) {
        return { errorCode: 'HQ_PLANNING_MP_EXCEEDED' };
    }

    let tempMainCityId = arrows.find((arrow) => arrow.type === 'temp-main')?.toCityId
        || String(raw?.tempMainCityId || '').trim();
    if (!allowTempMain) {
        tempMainCityId = '';
        for (let i = arrows.length - 1; i >= 0; i -= 1) {
            if (arrows[i].type === 'temp-main') arrows.splice(i, 1);
        }
    } else if (tempMainCityId && !getCatalogCity(tempMainCityId)) {
        tempMainCityId = '';
    }

    return {
        planning: {
            pills,
            arrows,
            tempMainCityId,
            updatedAt: raw?.updatedAt || null,
            updatedBy: raw?.updatedBy || null
        }
    };
}

function normalizePublishedPlanning(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const normalized = normalizePlanningState(raw, { allowTempMain: true });
    if (normalized.errorCode) return null;

    const plan = normalized.planning;
    if (!hasPublishedPlanContent(plan)) return null;

    return {
        pills: plan.pills,
        arrows: plan.arrows,
        tempMainCityId: plan.tempMainCityId,
        publishedAt: String(raw.publishedAt || '').trim() || null,
        publishedBy: String(raw.publishedBy || '').trim() || null
    };
}

function hasPublishedPlanContent(plan) {
    if (!plan || typeof plan !== 'object') return false;
    const pills = Array.isArray(plan.pills) ? plan.pills : [];
    const arrows = Array.isArray(plan.arrows) ? plan.arrows : [];
    return pills.length > 0 || arrows.length > 0 || Boolean(String(plan.tempMainCityId || '').trim());
}

function normalizeNationHeadquartersState(raw) {
    const base = getDefaultNationHeadquartersState();
    if (!raw || typeof raw !== 'object') return base;

    const planningResult = normalizePlanningState(raw.planning || {}, { allowTempMain: true });
    const planning = planningResult.errorCode ? getDefaultPlanningState() : planningResult.planning;
    const publishedPlanning = normalizePublishedPlanning(raw.publishedPlanning);
    const planningConfirmed = Boolean(raw.planningConfirmed) && Boolean(publishedPlanning);

    const votesByUsername = {};
    if (raw.votesByUsername && typeof raw.votesByUsername === 'object') {
        Object.keys(raw.votesByUsername).forEach((key) => {
            const username = normalizeUsername(key);
            const entry = raw.votesByUsername[key];
            if (!username || !entry || typeof entry !== 'object') return;
            votesByUsername[username] = {
                leaderCandidateId: String(entry.leaderCandidateId || '').trim().slice(0, 64),
                viceCandidateId: String(entry.viceCandidateId || '').trim().slice(0, 64),
                updatedAt: entry.updatedAt || null
            };
        });
    }

    return {
        planning,
        publishedPlanning,
        planningConfirmed,
        diplomacy: normalizeDiplomacyState(raw.diplomacy),
        votesByUsername,
        election: normalizeElectionState(raw.election),
        warLedger: normalizeWarLedgerState(raw.warLedger),
        dispatchAlert: normalizeDispatchAlert(raw.dispatchAlert),
        spyLogs: normalizeSpyLogs(raw.spyLogs),
        updatedAt: raw.updatedAt || null
    };
}

function countEligibleNationMembers(voteCandidates) {
    return Array.isArray(voteCandidates) ? voteCandidates.length : 0;
}

function hasCompleteBallot(entry) {
    return Boolean(entry?.leaderCandidateId && entry?.viceCandidateId);
}

function countCompleteBallots(votesByUsername) {
    return Object.values(votesByUsername || {}).filter((entry) => hasCompleteBallot(entry)).length;
}

function syncWarLedgerRelations(warLedger, diplomacy) {
    const ledger = normalizeWarLedgerState(warLedger);
    const relationMap = {
        allies: new Map(ledger.relations.allies.map((row) => [row.nationId, row])),
        naps: new Map(ledger.relations.naps.map((row) => [row.nationId, row])),
        enemies: new Map(ledger.relations.enemies.map((row) => [row.nationId, row]))
    };

    const ingest = (rows, bucket) => {
        (rows || []).forEach((row) => {
            const type = String(row?.type || '').toLowerCase();
            const nationName = String(row?.nation || '').trim();
            const nationId = resolveCatalogNationKey(row?.nationId || nationName);
            if (!nationId) return;
            if (type.includes('alliance') || type.includes('ally')) {
                relationMap.allies.set(nationId, { nationId, nationName: nationName || nationId });
            } else if (type.includes('nap') || type.includes('non-aggression') || type.includes('non aggression')) {
                relationMap.naps.set(nationId, { nationId, nationName: nationName || nationId });
            }
        });
    };

    ingest(diplomacy?.incoming, 'incoming');
    ingest(diplomacy?.outgoing, 'outgoing');

    ledger.wars.forEach((war) => {
        if (war.status !== 'active') return;
        relationMap.enemies.set(war.opponentNationId, {
            nationId: war.opponentNationId,
            nationName: war.opponentNationName
        });
        relationMap.allies.delete(war.opponentNationId);
        relationMap.naps.delete(war.opponentNationId);
    });

    return {
        wars: ledger.wars,
        relations: {
            allies: Array.from(relationMap.allies.values()),
            naps: Array.from(relationMap.naps.values()),
            enemies: Array.from(relationMap.enemies.values())
        }
    };
}

function buildDiplomacyPublicSlice(diplomacy, warLedger) {
    const ledger = syncWarLedgerRelations(warLedger, diplomacy);
    return {
        allies: ledger.relations.allies,
        naps: ledger.relations.naps,
        enemies: ledger.relations.enemies,
        note: 'Alliances and non-aggression pacts apply only to neutral nations. Active enemies cannot become allies.'
    };
}

function buildWarLedgerSlice(warLedger) {
    const ledger = normalizeWarLedgerState(warLedger);
    return {
        wars: ledger.wars.slice().sort((a, b) => Date.parse(b.declaredAt) - Date.parse(a.declaredAt)),
        relations: ledger.relations
    };
}

function recordRecognizedWarDeclaration(nationState, payload) {
    const targetNationId = resolveCatalogNationKey(payload?.targetNationId);
    if (!targetNationId) {
        return { errorCode: 'HQ_WAR_TARGET_REQUIRED' };
    }

    const ledger = normalizeWarLedgerState(nationState?.warLedger);
    const alreadyActive = ledger.wars.some((war) => war.opponentNationId === targetNationId && war.status === 'active');
    if (alreadyActive) {
        return { errorCode: 'HQ_WAR_ALREADY_ACTIVE' };
    }

    const opponentNationName = String(payload?.targetNationName || targetNationId).trim().slice(0, 80);
    const entry = {
        id: `war-${Date.now()}`,
        opponentNationId: targetNationId,
        opponentNationName,
        declaredAt: new Date().toISOString(),
        declaredBy: normalizeUsername(payload?.declaredBy),
        status: 'active',
        endedAt: null,
        endedReason: null
    };

    ledger.wars.push(entry);
    ledger.relations.enemies = [
        ...ledger.relations.enemies.filter((row) => row.nationId !== targetNationId),
        { nationId: targetNationId, nationName: opponentNationName }
    ];
    ledger.relations.allies = ledger.relations.allies.filter((row) => row.nationId !== targetNationId);
    ledger.relations.naps = ledger.relations.naps.filter((row) => row.nationId !== targetNationId);

    return {
        warLedger: ledger,
        warRecord: entry
    };
}

function hasElectedLeadership(leadership) {
    return Boolean(leadership?.leaderUsername && leadership?.viceLeaderUsername);
}

function isVotingLocked(election, nowMs = Date.now()) {
    if (!election?.lockedUntil) return false;
    const lockedUntilMs = Date.parse(election.lockedUntil);
    if (!Number.isFinite(lockedUntilMs)) return false;
    return lockedUntilMs > nowMs;
}

function pickPluralityWinner(counts) {
    let bestId = '';
    let bestCount = 0;
    let tied = false;

    counts.forEach((count, candidateId) => {
        if (count > bestCount) {
            bestCount = count;
            bestId = candidateId;
            tied = false;
        } else if (count === bestCount && count > 0) {
            tied = true;
        }
    });

    if (!bestId || bestCount <= 0 || tied) return '';
    return bestId;
}

function tallyLeadershipVotes(votesByUsername) {
    const leaderCounts = new Map();
    const viceCounts = new Map();

    Object.values(votesByUsername || {}).forEach((entry) => {
        const leaderId = normalizeUsername(entry?.leaderCandidateId);
        const viceId = normalizeUsername(entry?.viceCandidateId);
        if (leaderId) leaderCounts.set(leaderId, (leaderCounts.get(leaderId) || 0) + 1);
        if (viceId) viceCounts.set(viceId, (viceCounts.get(viceId) || 0) + 1);
    });

    return {
        leaderWinner: pickPluralityWinner(leaderCounts),
        viceWinner: pickPluralityWinner(viceCounts)
    };
}

function reconcileHeadquartersElection(nationState, leadership, voteCandidates, nowMs = Date.now()) {
    const election = normalizeElectionState(nationState?.election);
    let votesByUsername = { ...(nationState?.votesByUsername || {}) };
    let nextLeadership = leadership ? { ...leadership } : null;
    let changed = false;
    const nationSize = countEligibleNationMembers(voteCandidates);
    const canHoldElection = nationSize >= MIN_NATION_ELECTION_PLAYERS;

    if (hasElectedLeadership(nextLeadership) && !election.electedAt) {
        election.electedAt = new Date(nowMs).toISOString();
        election.status = 'closed';
        election.closedAt = election.electedAt;
        election.closedReason = election.closedReason || 'results';
        changed = true;
    }

    if (hasElectedLeadership(nextLeadership) && !election.lockedUntil) {
        election.lockedUntil = new Date(nowMs + LEADERSHIP_LOCK_MS).toISOString();
        changed = true;
    }

    if (!hasElectedLeadership(nextLeadership) && canHoldElection) {
        if (election.status !== 'open') {
            election.status = 'open';
            election.openedAt = new Date(nowMs).toISOString();
            election.closesAt = new Date(nowMs + ELECTION_WINDOW_MS).toISOString();
            election.closedAt = null;
            election.closedReason = null;
            changed = true;
        }
    } else if (!canHoldElection && !hasElectedLeadership(nextLeadership)) {
        if (election.status === 'open') {
            election.status = 'idle';
            election.openedAt = null;
            election.closesAt = null;
            changed = true;
        }
    }

    let shouldFinalize = false;
    let finalizeReason = '';
    if (election.status === 'open') {
        const closesAtMs = Date.parse(election.closesAt || '');
        const ballotsComplete = countCompleteBallots(votesByUsername);
        const allVoted = nationSize > 0 && ballotsComplete >= nationSize;
        const timedOut = Number.isFinite(closesAtMs) && closesAtMs <= nowMs;
        if (allVoted) {
            shouldFinalize = true;
            finalizeReason = 'quorum';
        } else if (timedOut) {
            shouldFinalize = true;
            finalizeReason = 'timeout';
        }
    }

    if (shouldFinalize) {
        const finalizeResult = tryFinalizeElectionFromVotes(
            { ...nationState, votesByUsername, election },
            nextLeadership,
            voteCandidates
        );
        if (finalizeResult) {
            nextLeadership = finalizeResult.leadership;
            votesByUsername = finalizeResult.nationState.votesByUsername;
            Object.assign(election, finalizeResult.nationState.election);
            election.status = 'closed';
            election.closedAt = election.electedAt || new Date(nowMs).toISOString();
            election.closedReason = finalizeReason || 'results';
            changed = true;
        } else if (finalizeReason === 'timeout') {
            election.status = 'closed';
            election.closedAt = new Date(nowMs).toISOString();
            election.closedReason = 'timeout';
            changed = true;
        }
    }

    if (election.lockedUntil) {
        const lockedUntilMs = Date.parse(election.lockedUntil);
        if (Number.isFinite(lockedUntilMs) && lockedUntilMs <= nowMs && hasElectedLeadership(nextLeadership)) {
            election.lockedUntil = null;
            election.electedAt = null;
            votesByUsername = {};
            election.status = canHoldElection ? 'open' : 'idle';
            election.openedAt = canHoldElection ? new Date(nowMs).toISOString() : null;
            election.closesAt = canHoldElection ? new Date(nowMs + ELECTION_WINDOW_MS).toISOString() : null;
            election.closedAt = null;
            election.closedReason = null;
            nextLeadership = {
                leaderUsername: '',
                viceLeaderUsername: '',
                councilUsernames: nextLeadership.councilUsernames || [],
                plannerUsernames: nextLeadership.plannerUsernames || []
            };
            changed = true;
        }
    }

    const isOpen = election.status === 'open' && canHoldElection && !hasElectedLeadership(nextLeadership);

    return {
        nationState: {
            ...nationState,
            votesByUsername,
            election
        },
        leadership: nextLeadership,
        isOpen,
        changed,
        shouldPersistLeadership: Boolean(shouldFinalize && hasElectedLeadership(nextLeadership))
    };
}

function tryFinalizeElectionFromVotes(nationState, leadership, voteCandidates) {
    const allowedIds = new Set((voteCandidates || []).map((candidate) => candidate.id));
    const { leaderWinner, viceWinner } = tallyLeadershipVotes(nationState?.votesByUsername);

    if (!leaderWinner || !viceWinner || leaderWinner === viceWinner) {
        return null;
    }
    if (!allowedIds.has(leaderWinner) || !allowedIds.has(viceWinner)) {
        return null;
    }

    const nowMs = Date.now();
    const electedAt = new Date(nowMs).toISOString();
    const lockedUntil = new Date(nowMs + LEADERSHIP_LOCK_MS).toISOString();

    return {
        leadership: {
            leaderUsername: leaderWinner,
            viceLeaderUsername: viceWinner,
            councilUsernames: Array.isArray(leadership?.councilUsernames)
                ? leadership.councilUsernames.slice()
                : [],
            plannerUsernames: Array.isArray(leadership?.plannerUsernames)
                ? leadership.plannerUsernames.slice()
                : []
        },
        nationState: {
            ...nationState,
            votesByUsername: {},
            election: {
                status: 'closed',
                openedAt: nationState?.election?.openedAt || null,
                closesAt: nationState?.election?.closesAt || null,
                closedAt: electedAt,
                closedReason: 'results',
                lockedUntil,
                electedAt
            }
        }
    };
}

function resolveLeadershipDisplayName(username, voteCandidates) {
    const normalized = normalizeUsername(username);
    if (!normalized) return '—';
    const candidate = (voteCandidates || []).find((row) => row.id === normalized);
    return candidate?.name || candidate?.username || normalized;
}

function buildCabinetMemberRow(username, voteCandidates) {
    const normalized = normalizeUsername(username);
    if (!normalized) return null;
    return {
        username: normalized,
        name: resolveLeadershipDisplayName(normalized, voteCandidates)
    };
}

function buildCabinetSlice(leadership, voteCandidates) {
    const leaderUsername = normalizeUsername(leadership?.leaderUsername);
    const viceLeaderUsername = normalizeUsername(leadership?.viceLeaderUsername);
    const reserved = new Set([leaderUsername, viceLeaderUsername].filter(Boolean));

    const councilMembers = (Array.isArray(leadership?.councilUsernames) ? leadership.councilUsernames : [])
        .map(normalizeUsername)
        .filter((username) => username && !reserved.has(username))
        .map((username) => buildCabinetMemberRow(username, voteCandidates))
        .filter(Boolean);

    const councilSet = new Set(councilMembers.map((member) => member.username));
    const planners = (Array.isArray(leadership?.plannerUsernames) ? leadership.plannerUsernames : [])
        .map(normalizeUsername)
        .filter((username) => username && !reserved.has(username) && !councilSet.has(username))
        .map((username) => buildCabinetMemberRow(username, voteCandidates))
        .filter(Boolean);

    return {
        leader: leaderUsername ? buildCabinetMemberRow(leaderUsername, voteCandidates) : null,
        viceLeader: viceLeaderUsername ? buildCabinetMemberRow(viceLeaderUsername, voteCandidates) : null,
        councilMembers,
        planners
    };
}

function buildVoteWorkspaceSlice(options) {
    const {
        nationState,
        leadership,
        voteCandidates,
        username,
        isOpen
    } = options;

    const election = normalizeElectionState(nationState?.election);
    const leaderUsername = leadership?.leaderUsername || '';
    const viceLeaderUsername = leadership?.viceLeaderUsername || '';

    const myVotes = resolveMyVotes(nationState?.votesByUsername, username);
    const nationSize = countEligibleNationMembers(voteCandidates);
    const ballotsComplete = countCompleteBallots(nationState?.votesByUsername);

    return {
        isOpen: Boolean(isOpen),
        electionStatus: election.status,
        lockedUntil: election.lockedUntil,
        electedAt: election.electedAt,
        openedAt: election.openedAt,
        closesAt: election.closesAt,
        closedAt: election.closedAt,
        closedReason: election.closedReason,
        lockDays: LEADERSHIP_LOCK_DAYS,
        minNationPlayers: MIN_NATION_ELECTION_PLAYERS,
        nationPlayerCount: nationSize,
        ballotsComplete,
        anonymous: true,
        electedLeader: leaderUsername
            ? {
                username: leaderUsername,
                name: resolveLeadershipDisplayName(leaderUsername, voteCandidates)
            }
            : null,
        electedViceLeader: viceLeaderUsername
            ? {
                username: viceLeaderUsername,
                name: resolveLeadershipDisplayName(viceLeaderUsername, voteCandidates)
            }
            : null,
        candidates: isOpen ? voteCandidates : [],
        myVotes: isOpen ? myVotes : {
            leaderCandidateId: '',
            viceCandidateId: ''
        },
        polls: {
            leader: {
                role: 'leader',
                title: 'Leader (LD)',
                mySelectionId: isOpen ? myVotes.leaderCandidateId : '',
                hasVoted: Boolean(myVotes.leaderCandidateId)
            },
            vice: {
                role: 'vice',
                title: 'Vice Leader (VLD)',
                mySelectionId: isOpen ? myVotes.viceCandidateId : '',
                hasVoted: Boolean(myVotes.viceCandidateId)
            }
        }
    };
}

function listNationFortifiedCities(playerNationKey) {
    const catalog = loadCityCatalog();
    const playerNation = resolveCatalogNationKey(playerNationKey);
    if (!playerNation) return [];

    return (catalog.cities || [])
        .filter((city) => {
            const holder = resolveCatalogNationKey(city.holderNationId || city.nationId);
            if (holder !== playerNation) return false;
            const structures = Array.isArray(city.defensiveStructures) ? city.defensiveStructures : [];
            return structures.length > 0;
        })
        .map((city) => ({
            id: city.id,
            name: String(city.name || city.id),
            settlementTier: String(city.settlementTier || ''),
            isCapital: Boolean(city.isCapital),
            fortifications: (city.defensiveStructures || []).map((structure) => ({
                id: String(structure.id || ''),
                label: String(structure.label || 'Unknown fortification')
            }))
        }))
        .sort((a, b) => {
            if (a.isCapital !== b.isCapital) return a.isCapital ? -1 : 1;
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });
}

function listWarTargetNations(playerNationKey) {
    const catalog = loadCityCatalog();
    const playerNation = resolveCatalogNationKey(playerNationKey);
    const nations = new Map();

    (catalog?.cities || []).forEach((city) => {
        const id = resolveCatalogNationKey(city.nationId);
        if (!id || id === playerNation) return;
        if (!nations.has(id)) {
            nations.set(id, String(city.nationName || id));
        }
    });

    return Array.from(nations.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([id, name]) => ({ id, name }));
}

function listNationVoteCandidates(commanders, nationStorageKey, resolveNationKeyFn) {
    const rows = [];
    (commanders || []).forEach((commander) => {
        const commanderNation = resolveNationKeyFn(commander);
        if (commanderNation !== nationStorageKey) return;
        const username = String(commander.username || '').trim();
        const id = normalizeUsername(username);
        if (!id) return;
        rows.push({
            id,
            username,
            name: username,
            roleHint: String(commander.membershipTitle || 'Commander').slice(0, 64)
        });
    });
    return rows.sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }));
}

function resolveMyVotes(votesByUsername, username) {
    const entry = votesByUsername?.[normalizeUsername(username)] || {};
    return {
        leaderCandidateId: String(entry.leaderCandidateId || ''),
        viceCandidateId: String(entry.viceCandidateId || '')
    };
}

function buildHeadquartersWorkspacePayload(options) {
    const {
        access,
        nationState,
        voteCandidates,
        warTargets,
        username,
        leadership,
        votingOpen
    } = options;

    const planning = nationState?.planning || getDefaultPlanningState();
    const mpBudget = planningMpBudget(planning);
    const isOpen = Boolean(votingOpen);

    const warLedger = syncWarLedgerRelations(nationState?.warLedger, nationState?.diplomacy);

    return {
        gameNation: access.gameNation,
        access: {
            council: access.council,
            leader: access.leader,
            viceLeader: access.viceLeader,
            fullAuthority: Boolean(access.fullAuthority),
            memberHub: Boolean(access.memberHub !== false)
        },
        nationAuthority: access.nationAuthority || {
            established: false,
            rank14Count: 0,
            requiredCount: NATION_AUTHORITY_MIN_RANK14,
            requiredRank: NATION_AUTHORITY_RANK
        },
        planning: {
            pills: planning.pills,
            arrows: planning.arrows,
            tempMainCityId: access.viceLeader ? planning.tempMainCityId : '',
            mpBudget,
            confirmed: Boolean(nationState?.planningConfirmed),
            hasPublishedPlan: hasPublishedPlanContent(nationState?.publishedPlanning)
        },
        diplomacy: nationState?.diplomacy || { incoming: [], outgoing: [] },
        vote: buildVoteWorkspaceSlice({
            nationState,
            leadership,
            voteCandidates,
            username,
            isOpen: isOpen && !access.council
        }),
        cabinet: buildCabinetSlice(leadership, voteCandidates),
        warTargets,
        fortifiedCities: listNationFortifiedCities(access.gameNation),
        diplomacyPublic: buildDiplomacyPublicSlice(nationState?.diplomacy, warLedger),
        warLedger: buildWarLedgerSlice(warLedger)
    };
}

function buildPublishedPlanningSnapshot(planning, actorUsername) {
    const normalized = normalizePlanningState(planning || {}, { allowTempMain: true });
    if (normalized.errorCode) {
        return { errorCode: normalized.errorCode };
    }

    const plan = normalized.planning;
    if (!hasPublishedPlanContent(plan)) {
        return { errorCode: 'HQ_PLANNING_PUBLISH_EMPTY' };
    }

    return {
        publishedPlanning: {
            pills: plan.pills,
            arrows: plan.arrows,
            tempMainCityId: plan.tempMainCityId,
            publishedAt: new Date().toISOString(),
            publishedBy: actorUsername
        },
        planningConfirmed: true
    };
}

function applyConfirmPlanningPatch(currentState, actorUsername, access) {
    if (!access?.council) {
        return { errorCode: 'HQ_COUNCIL_REQUIRED' };
    }

    return buildPublishedPlanningSnapshot(currentState?.planning, actorUsername);
}

function applyEditPlanningPatch(currentState, actorUsername, access) {
    void currentState;
    void actorUsername;
    if (!access?.council) {
        return { errorCode: 'HQ_COUNCIL_REQUIRED' };
    }

    if (!currentState?.planningConfirmed) {
        return { errorCode: 'HQ_PLANNING_NOT_CONFIRMED' };
    }

    return {
        planningConfirmed: false
    };
}

function applyClearPublishedPlanPatch(currentState, actorUsername, access) {
    void actorUsername;
    if (!access?.council) {
        return { errorCode: 'HQ_COUNCIL_REQUIRED' };
    }

    if (!hasPublishedPlanContent(currentState?.publishedPlanning)) {
        return { errorCode: 'HQ_PLANNING_NO_PUBLISHED' };
    }

    return {
        publishedPlanning: null,
        planningConfirmed: false
    };
}

function buildNationPlanPayload(nationState) {
    const publishedPlanning = normalizePublishedPlanning(nationState?.publishedPlanning);
    return {
        hasPlan: Boolean(publishedPlanning),
        plan: publishedPlanning
    };
}

function applyPlanningPatch(currentState, patch, actorUsername, access) {
    if (!access?.council) {
        return { errorCode: 'HQ_COUNCIL_REQUIRED' };
    }

    if (currentState?.planningConfirmed) {
        return { errorCode: 'HQ_PLANNING_LOCKED' };
    }

    const allowTempMain = Boolean(access.viceLeader);
    const normalized = normalizePlanningState(patch, { allowTempMain });
    if (normalized.errorCode) {
        return { errorCode: normalized.errorCode };
    }

    const nextPlanning = {
        ...normalized.planning,
        updatedAt: new Date().toISOString(),
        updatedBy: actorUsername
    };

    if (!allowTempMain) {
        nextPlanning.tempMainCityId = String(currentState?.planning?.tempMainCityId || '');
    }

    return {
        planning: nextPlanning
    };
}

function applyResetPlanningPatch(currentState, actorUsername, access) {
    if (!access?.council) {
        return { errorCode: 'HQ_COUNCIL_REQUIRED' };
    }

    if (currentState?.planningConfirmed) {
        return { errorCode: 'HQ_PLANNING_LOCKED' };
    }

    return {
        planning: {
            ...getDefaultPlanningState(),
            updatedAt: new Date().toISOString(),
            updatedBy: actorUsername
        }
    };
}

function applyVotePatch(currentState, patch, actorUsername, voteCandidates, options = {}) {
    if (!options?.votingOpen) {
        return { errorCode: 'HQ_VOTING_CLOSED' };
    }

    const allowedIds = new Set((voteCandidates || []).map((candidate) => candidate.id));
    const actorKey = normalizeUsername(actorUsername);
    const prior = currentState?.votesByUsername?.[actorKey] || {};
    const leaderCandidateId = patch?.leaderCandidateId !== undefined
        ? String(patch.leaderCandidateId || '').trim()
        : String(prior.leaderCandidateId || '').trim();
    const viceCandidateId = patch?.viceCandidateId !== undefined
        ? String(patch.viceCandidateId || '').trim()
        : String(prior.viceCandidateId || '').trim();

    if (leaderCandidateId && !allowedIds.has(normalizeUsername(leaderCandidateId))) {
        return { errorCode: 'HQ_VOTE_CANDIDATE_INVALID' };
    }
    if (viceCandidateId && !allowedIds.has(normalizeUsername(viceCandidateId))) {
        return { errorCode: 'HQ_VOTE_CANDIDATE_INVALID' };
    }
    if (leaderCandidateId && viceCandidateId && normalizeUsername(leaderCandidateId) === normalizeUsername(viceCandidateId)) {
        return { errorCode: 'HQ_VOTE_DUPLICATE_CANDIDATE' };
    }

    const votesByUsername = {
        ...(currentState?.votesByUsername || {})
    };
    votesByUsername[actorKey] = {
        leaderCandidateId: leaderCandidateId ? normalizeUsername(leaderCandidateId) : '',
        viceCandidateId: viceCandidateId ? normalizeUsername(viceCandidateId) : '',
        updatedAt: new Date().toISOString()
    };

    return { votesByUsername };
}

function applyWarDeclarationDraft(currentState, patch, actorUsername, access) {
    if (!access?.council) {
        return { errorCode: 'HQ_COUNCIL_REQUIRED' };
    }

    const targetNationId = resolveCatalogNationKey(patch?.targetNationId);
    if (!targetNationId) {
        return { errorCode: 'HQ_WAR_TARGET_REQUIRED' };
    }

    return {
        warDeclarationDraft: {
            targetNationId,
            preparedAt: new Date().toISOString(),
            preparedBy: actorUsername
        }
    };
}

module.exports = {
    getDefaultNationHeadquartersState,
    getDefaultPlanningState,
    getDefaultElectionState,
    normalizeNationHeadquartersState,
    normalizePlanningState,
    planningMpBudget,
    listWarTargetNations,
    listNationVoteCandidates,
    buildHeadquartersWorkspacePayload,
    buildVoteWorkspaceSlice,
    reconcileHeadquartersElection,
    tryFinalizeElectionFromVotes,
    hasElectedLeadership,
    isVotingLocked,
    applyPlanningPatch,
    applyConfirmPlanningPatch,
    applyEditPlanningPatch,
    applyClearPublishedPlanPatch,
    applyResetPlanningPatch,
    buildNationPlanPayload,
    hasPublishedPlanContent,
    applyVotePatch,
    applyWarDeclarationDraft,
    recordRecognizedWarDeclaration,
    buildDiplomacyPublicSlice,
    buildWarLedgerSlice,
    countEligibleNationMembers,
    syncWarLedgerRelations,
    normalizeUsername,
    LEADERSHIP_LOCK_DAYS,
    MIN_NATION_ELECTION_PLAYERS,
    ELECTION_WINDOW_MS,
    NATION_AUTHORITY_RANK,
    NATION_AUTHORITY_MIN_RANK14
};

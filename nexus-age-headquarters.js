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

const PILL_MARKER_TYPES = new Set(['hold', 'taxi']);
const ARROW_MARKER_TYPES = new Set(['sf', 'mf', 'move']);
const MP_LIMITED_ARROW_TYPES = new Set(['move', 'mf']);
const MAX_PLANNING_STEPS = 64;
const MAX_DIPLO_REQUESTS = 40;

function normalizeUsername(value) {
    return String(value || '').trim().toLowerCase();
}

function getDefaultPlanningState() {
    return {
        pills: [],
        arrows: [],
        tempMainCityId: '',
        sfArrowCounter: 0,
        updatedAt: null,
        updatedBy: null
    };
}

function getDefaultNationHeadquartersState() {
    return {
        planning: getDefaultPlanningState(),
        diplomacy: {
            incoming: [],
            outgoing: []
        },
        votesByUsername: {},
        updatedAt: null
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

function normalizeArrow(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || '').trim().slice(0, 64);
    const fromCityId = String(raw.fromCityId || '').trim();
    const toCityId = String(raw.toCityId || '').trim();
    const type = String(raw.type || '').trim().toLowerCase();
    const order = Math.max(0, Math.floor(Number(raw.order) || 0));
    const sfIndex = Math.max(0, Math.floor(Number(raw.sfIndex) || 0));
    if (!id || !fromCityId || !toCityId || fromCityId === toCityId) return null;
    if (!ARROW_MARKER_TYPES.has(type)) return null;
    if (!getCatalogCity(fromCityId) || !getCatalogCity(toCityId)) return null;

    let label = String(raw.label || '').trim().slice(0, 32);
    if (!label) {
        if (type === 'sf') label = sfIndex ? `${sfIndex} SF` : 'SF';
        else if (type === 'mf') label = 'MF';
        else if (type === 'move') label = 'Move';
    }

    return {
        id,
        fromCityId,
        toCityId,
        type,
        sfIndex,
        label,
        order
    };
}

function resolveLegMovePointCost(fromCityId, toCityId) {
    const fromCity = getCatalogCity(fromCityId);
    const toCity = getCatalogCity(toCityId);
    if (!fromCity || !toCity) return Infinity;

    const connection = resolveCityConnection(fromCity, toCity);
    if (connection?.movePointCost) {
        return Math.max(1, Math.min(MOVE_POINTS_MAX, Math.floor(Number(connection.movePointCost)) || 1));
    }

    return Infinity;
}

function countTrailingMoveMfMpUsed(arrows) {
    let mpUsed = 0;
    const ordered = (Array.isArray(arrows) ? arrows : []).slice().sort((a, b) => a.order - b.order);

    for (let i = ordered.length - 1; i >= 0; i -= 1) {
        const arrow = ordered[i];
        if (!MP_LIMITED_ARROW_TYPES.has(arrow.type)) break;
        mpUsed += resolveLegMovePointCost(arrow.fromCityId, arrow.toCityId);
    }

    return mpUsed;
}

function planningMpBudget(arrows) {
    const used = countTrailingMoveMfMpUsed(arrows);
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
    const arrows = (Array.isArray(raw?.arrows) ? raw.arrows : [])
        .map(normalizeArrow)
        .filter(Boolean)
        .slice(0, MAX_PLANNING_STEPS);

    const combinedCount = pills.length + arrows.length;
    if (combinedCount > MAX_PLANNING_STEPS) {
        return { errorCode: 'HQ_PLANNING_TOO_LARGE' };
    }

    if (countTrailingMoveMfMpUsed(arrows) > MOVE_POINTS_MAX) {
        return { errorCode: 'HQ_PLANNING_MP_EXCEEDED' };
    }

    let tempMainCityId = String(raw?.tempMainCityId || '').trim();
    if (!allowTempMain) {
        tempMainCityId = '';
    } else if (tempMainCityId && !getCatalogCity(tempMainCityId)) {
        tempMainCityId = '';
    }

    const sfArrowCounter = Math.max(
        0,
        Math.floor(Number(raw?.sfArrowCounter) || 0),
        ...arrows.filter((arrow) => arrow.type === 'sf').map((arrow) => arrow.sfIndex)
    );

    return {
        planning: {
            pills,
            arrows,
            tempMainCityId,
            sfArrowCounter,
            updatedAt: raw?.updatedAt || null,
            updatedBy: raw?.updatedBy || null
        }
    };
}

function normalizeNationHeadquartersState(raw) {
    const base = getDefaultNationHeadquartersState();
    if (!raw || typeof raw !== 'object') return base;

    const planningResult = normalizePlanningState(raw.planning || {}, { allowTempMain: true });
    const planning = planningResult.errorCode ? getDefaultPlanningState() : planningResult.planning;

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
        diplomacy: normalizeDiplomacyState(raw.diplomacy),
        votesByUsername,
        updatedAt: raw.updatedAt || null
    };
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
        username
    } = options;

    const planning = nationState?.planning || getDefaultPlanningState();
    const mpBudget = planningMpBudget(planning.arrows);

    return {
        gameNation: access.gameNation,
        access: {
            council: access.council,
            leader: access.leader,
            viceLeader: access.viceLeader
        },
        planning: {
            pills: planning.pills,
            arrows: planning.arrows,
            tempMainCityId: access.viceLeader ? planning.tempMainCityId : '',
            sfArrowCounter: planning.sfArrowCounter,
            mpBudget
        },
        diplomacy: nationState?.diplomacy || { incoming: [], outgoing: [] },
        vote: {
            candidates: voteCandidates,
            myVotes: resolveMyVotes(nationState?.votesByUsername, username)
        },
        warTargets
    };
}

function applyPlanningPatch(currentState, patch, actorUsername, access) {
    if (!access?.council) {
        return { errorCode: 'HQ_COUNCIL_REQUIRED' };
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

    return {
        planning: {
            ...getDefaultPlanningState(),
            updatedAt: new Date().toISOString(),
            updatedBy: actorUsername
        }
    };
}

function applyVotePatch(currentState, patch, actorUsername, voteCandidates) {
    const allowedIds = new Set((voteCandidates || []).map((candidate) => candidate.id));
    const leaderCandidateId = String(patch?.leaderCandidateId || '').trim();
    const viceCandidateId = String(patch?.viceCandidateId || '').trim();

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
    votesByUsername[normalizeUsername(actorUsername)] = {
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
    normalizeNationHeadquartersState,
    normalizePlanningState,
    planningMpBudget,
    listWarTargetNations,
    listNationVoteCandidates,
    buildHeadquartersWorkspacePayload,
    applyPlanningPatch,
    applyResetPlanningPatch,
    applyVotePatch,
    applyWarDeclarationDraft,
    normalizeUsername
};

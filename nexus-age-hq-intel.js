/**
 * NEXUS — Headquarters intel: threat matrix, spy logs, nation bounty live feed.
 */
'use strict';

const {
    loadCityCatalog,
    getCatalogCity,
    resolveCatalogNationKey,
    resolveCommanderGameNationKey,
    resolveCityHolder,
    computeNationBorderDistanceFromLastCapture
} = require('./nexus-age-movement');
const { resolveCommanderAgeArmy } = require('./nexus-age-roster');
const { buildBattleArmy } = require('./nexus-age-battle-sim');
const { loadUnitPurchaseCatalog } = require('./nexus-age-recruitment');
const { buildCommanderRankMeta } = require('./nexus-commander-rank-titles');

const SPY_LOG_MAX = 3;
const SPY_OUTDATED_GROWTH = 0.1;
const HQ_BOUNTY_DURATION_MS = 24 * 60 * 60 * 1000;
const HQ_BOUNTY_FEED_MAX = 48;

function normalizeUsername(value) {
    return String(value || '').trim();
}

function normalizeNationKey(value) {
    return resolveCatalogNationKey(value) || String(value || '').trim().toLowerCase();
}

function createIntelId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function computeArmyPowerScore(commander) {
    const catalog = loadUnitPurchaseCatalog();
    const army = resolveCommanderAgeArmy(commander);
    if (!army.length) return 0;
    const battleArmy = buildBattleArmy('intel', army, catalog);
    return Math.max(0, Math.round(Number(battleArmy?.startingHp) || 0));
}

function computeNationPowerScore(nationId, commanders, nationRecordsMap) {
    const nation = normalizeNationKey(nationId);
    if (!nation) return 0;

    let power = 0;
    (Array.isArray(commanders) ? commanders : []).forEach((commander) => {
        const commanderNation = normalizeNationKey(resolveCommanderGameNationKey(commander));
        if (commanderNation !== nation) return;
        power += computeArmyPowerScore(commander);
    });

    const records = nationRecordsMap?.[nation] || nationRecordsMap?.[String(nation).toLowerCase()];
    const recordStrength = Number(records?.overallStrength ?? records?.overallPvpStrength);
    if (Number.isFinite(recordStrength) && recordStrength > power) {
        power = Math.round(recordStrength);
    }

    return Math.max(0, Math.round(power));
}

function resolveHostilityLevel(nationId, viewerNation, warLedger) {
    const target = normalizeNationKey(nationId);
    const viewer = normalizeNationKey(viewerNation);
    if (!target || !viewer) return 'unknown';

    const ledger = warLedger || {};
    const wars = Array.isArray(ledger.wars) ? ledger.wars : [];
    const activeWar = wars.some((war) => (
        war?.status !== 'ended'
        && normalizeNationKey(war?.opponentNationId) === target
    ));
    if (activeWar) return 'at_war';

    const relations = ledger.relations || {};
    const enemies = Array.isArray(relations.enemies) ? relations.enemies : [];
    if (enemies.some((row) => normalizeNationKey(row?.nationId || row?.id) === target)) {
        return 'hostile';
    }

    const allies = Array.isArray(relations.allies) ? relations.allies : [];
    const naps = Array.isArray(relations.naps) ? relations.naps : [];
    if (allies.some((row) => normalizeNationKey(row?.nationId || row?.id) === target)
        || naps.some((row) => normalizeNationKey(row?.nationId || row?.id) === target)) {
        return 'allied';
    }

    return 'neutral';
}

function findBorderingNationMetrics(viewerNation, cityHolders, cityLosers, cityCaptureAt) {
    const catalog = loadCityCatalog();
    const viewer = normalizeNationKey(viewerNation);
    if (!viewer) return new Map();

    const holders = cityHolders && typeof cityHolders === 'object' ? cityHolders : {};
    const losers = cityLosers && typeof cityLosers === 'object' ? cityLosers : {};
    const captureAt = cityCaptureAt && typeof cityCaptureAt === 'object' ? cityCaptureAt : {};
    const cities = catalog.cities || [];
    const neighborNations = new Map();

    cities.forEach((city) => {
        const holder = resolveCityHolder(city, holders);
        if (holder !== viewer) return;

        (Array.isArray(city.neighbors) ? city.neighbors : []).forEach((neighborId) => {
            const neighborCity = getCatalogCity(neighborId);
            if (!neighborCity) return;
            const neighborNation = resolveCityHolder(neighborCity, holders)
                || normalizeNationKey(neighborCity.nationId);
            if (!neighborNation || neighborNation === viewer) return;

            if (!neighborNations.has(neighborNation)) {
                neighborNations.set(neighborNation, String(neighborCity.nationName || neighborNation));
            }
        });
    });

    const metrics = new Map();
    neighborNations.forEach((nationName, nationId) => {
        const borderDistance = computeNationBorderDistanceFromLastCapture(
            viewer,
            nationId,
            holders,
            losers,
            captureAt
        );
        if (borderDistance === null) return;

        metrics.set(nationId, {
            nationId,
            nationName,
            borderDistance
        });
    });

    return metrics;
}

function buildThreatAssessmentMatrix(options) {
    const {
        viewerNation,
        cityHolders,
        cityLosers,
        cityCaptureAt,
        warLedger,
        commanders,
        nationRecordsMap,
        resolveCatalogNationDisplayName
    } = options;

    const viewer = normalizeNationKey(viewerNation);
    if (!viewer) return [];

    const bordering = findBorderingNationMetrics(viewer, cityHolders, cityLosers, cityCaptureAt);
    const rows = [];

    bordering.forEach((metric, nationId) => {
        const nationName = typeof resolveCatalogNationDisplayName === 'function'
            ? (resolveCatalogNationDisplayName(nationId) || metric.nationName)
            : metric.nationName;
        const militaryPower = computeNationPowerScore(nationId, commanders, nationRecordsMap);
        rows.push({
            nationId,
            nationName,
            militaryPower,
            hostility: resolveHostilityLevel(nationId, viewer, warLedger),
            borderDistance: metric.borderDistance
        });
    });

    return rows.sort((left, right) => {
        if (right.militaryPower !== left.militaryPower) {
            return right.militaryPower - left.militaryPower;
        }
        if (left.borderDistance !== right.borderDistance) {
            return left.borderDistance - right.borderDistance;
        }
        return left.nationName.localeCompare(right.nationName, undefined, { sensitivity: 'base' });
    });
}

function summarizeArmyForSpyLog(commander) {
    const army = resolveCommanderAgeArmy(commander);
    const units = army.reduce((sum, stack) => sum + Math.max(0, Math.floor(Number(stack?.qty) || 0)), 0);
    const rankMeta = buildCommanderRankMeta(commander);
    return {
        unitCount: units,
        stackCount: army.length,
        rank: rankMeta.rank,
        path: rankMeta.path
    };
}

function normalizeSpyLogEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || '').trim().slice(0, 80);
    if (!id) return null;

    return {
        id,
        createdAt: String(raw.createdAt || '').trim() || new Date().toISOString(),
        createdBy: normalizeUsername(raw.createdBy),
        subjectUsername: normalizeUsername(raw.subjectUsername),
        subjectNationId: normalizeNationKey(raw.subjectNationId),
        subjectNationName: String(raw.subjectNationName || '').trim().slice(0, 80),
        cityId: String(raw.cityId || '').trim().slice(0, 64),
        cityName: String(raw.cityName || '').trim().slice(0, 80),
        snapshotPower: Math.max(0, Math.round(Number(raw.snapshotPower) || 0)),
        armySummary: raw.armySummary && typeof raw.armySummary === 'object'
            ? {
                unitCount: Math.max(0, Math.floor(Number(raw.armySummary.unitCount) || 0)),
                stackCount: Math.max(0, Math.floor(Number(raw.armySummary.stackCount) || 0)),
                rank: Math.max(1, Math.floor(Number(raw.armySummary.rank) || 1)),
                path: String(raw.armySummary.path || '').trim().slice(0, 32)
            }
            : { unitCount: 0, stackCount: 0, rank: 1, path: '' },
        forwardedTo: Array.isArray(raw.forwardedTo)
            ? raw.forwardedTo.map(normalizeNationKey).filter(Boolean).slice(0, 24)
            : []
    };
}

function normalizeSpyLogs(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeSpyLogEntry).filter(Boolean).slice(0, SPY_LOG_MAX);
}

function evaluateSpyLogEntry(log, currentPower) {
    const snapshot = Math.max(0, Math.round(Number(log?.snapshotPower) || 0));
    const live = Math.max(0, Math.round(Number(currentPower) || 0));
    const threshold = snapshot * (1 + SPY_OUTDATED_GROWTH);
    const outdated = snapshot > 0 && live > threshold;
    return {
        outdated,
        canReview: !outdated,
        currentPower: live,
        growthPercent: snapshot > 0 ? Math.round(((live - snapshot) / snapshot) * 100) : 0
    };
}

function buildSpyLogsWorkspaceSlice(spyLogs, context) {
    const { commanders, allyNationIds } = context;
    return normalizeSpyLogs(spyLogs).map((log) => {
        const subject = (commanders || []).find((commander) => (
            normalizeUsername(commander?.username).toLowerCase()
            === log.subjectUsername.toLowerCase()
        ));
        const status = evaluateSpyLogEntry(log, computeArmyPowerScore(subject));
        return {
            ...log,
            ...status,
            forwardedToAllies: log.forwardedTo.some((nationId) => (
                Array.isArray(allyNationIds) && allyNationIds.includes(nationId)
            ))
        };
    });
}

function buildSpyReportFromCommander(commander, meta) {
    const username = normalizeUsername(commander?.username);
    if (!username) return null;

    return {
        id: createIntelId('spy'),
        createdAt: new Date().toISOString(),
        createdBy: normalizeUsername(meta?.createdBy),
        subjectUsername: username,
        subjectNationId: normalizeNationKey(resolveCommanderGameNationKey(commander)),
        subjectNationName: String(meta?.subjectNationName || '').trim().slice(0, 80),
        cityId: String(meta?.cityId || '').trim().slice(0, 64),
        cityName: String(meta?.cityName || '').trim().slice(0, 80),
        snapshotPower: computeArmyPowerScore(commander),
        armySummary: summarizeArmyForSpyLog(commander),
        forwardedTo: []
    };
}

function appendSpyLogs(currentLogs, newReports) {
    const logs = normalizeSpyLogs(currentLogs);
    const incoming = (Array.isArray(newReports) ? newReports : [])
        .map(normalizeSpyLogEntry)
        .filter(Boolean);

    if (!incoming.length) {
        return { logs, added: [], errorCode: null };
    }

    const remainingSlots = SPY_LOG_MAX - logs.length;
    if (remainingSlots <= 0) {
        return { logs, added: [], errorCode: 'HQ_SPY_LOG_FULL' };
    }

    const added = incoming.slice(0, remainingSlots);
    return {
        logs: normalizeSpyLogs([...added, ...logs]),
        added,
        errorCode: incoming.length > remainingSlots ? 'HQ_SPY_LOG_PARTIAL' : null
    };
}

function deleteSpyLog(currentLogs, logId) {
    const logs = normalizeSpyLogs(currentLogs);
    const next = logs.filter((entry) => entry.id !== String(logId || '').trim());
    if (next.length === logs.length) {
        return { logs, errorCode: 'HQ_SPY_LOG_NOT_FOUND' };
    }
    return { logs: next, errorCode: null };
}

function forwardSpyLog(currentLogs, logId, allyNationId) {
    const logs = normalizeSpyLogs(currentLogs);
    const ally = normalizeNationKey(allyNationId);
    if (!ally) return { logs, errorCode: 'HQ_SPY_ALLY_REQUIRED' };

    let found = false;
    const next = logs.map((entry) => {
        if (entry.id !== String(logId || '').trim()) return entry;
        found = true;
        if (entry.forwardedTo.includes(ally)) return entry;
        return {
            ...entry,
            forwardedTo: [...entry.forwardedTo, ally]
        };
    });

    if (!found) return { logs, errorCode: 'HQ_SPY_LOG_NOT_FOUND' };
    return { logs: next, errorCode: null };
}

function normalizeHqBountyFeedEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || '').trim().slice(0, 80);
    const type = String(raw.type || '').trim().toLowerCase();
    if (!id || !type) return null;

    return {
        id,
        type,
        at: String(raw.at || '').trim() || new Date().toISOString(),
        targetUsername: normalizeUsername(raw.targetUsername),
        targetNationId: normalizeNationKey(raw.targetNationId),
        targetNationName: String(raw.targetNationName || '').trim().slice(0, 80),
        targetRank: Math.max(1, Math.floor(Number(raw.targetRank) || 1)),
        actorUsername: normalizeUsername(raw.actorUsername),
        actorNationId: normalizeNationKey(raw.actorNationId),
        message: String(raw.message || '').trim().slice(0, 240)
    };
}

function normalizeHqBountyProgram(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
        cycleId: String(source.cycleId || '').trim().slice(0, 80),
        issuedAt: String(source.issuedAt || '').trim() || null,
        expiresAt: String(source.expiresAt || '').trim() || null,
        targets: Array.isArray(source.targets)
            ? source.targets.map((row) => ({
                nationId: normalizeNationKey(row?.nationId),
                nationName: String(row?.nationName || '').trim().slice(0, 80),
                targetUsername: normalizeUsername(row?.targetUsername),
                targetRank: Math.max(1, Math.floor(Number(row?.targetRank) || 1)),
                resolved: Boolean(row?.resolved),
                resolution: String(row?.resolution || '').trim().slice(0, 24) || null
            })).filter((row) => row.nationId && row.targetUsername)
            : [],
        feed: Array.isArray(source.feed)
            ? source.feed.map(normalizeHqBountyFeedEntry).filter(Boolean).slice(0, HQ_BOUNTY_FEED_MAX)
            : []
    };
}

function listActiveNations(commanders, cityHolders) {
    const nations = new Map();
    (Array.isArray(commanders) ? commanders : []).forEach((commander) => {
        const nation = normalizeNationKey(resolveCommanderGameNationKey(commander));
        if (!nation) return;
        if (!nations.has(nation)) {
            nations.set(nation, String(resolveCommanderGameNationKey(commander) || nation));
        }
    });

    const catalog = loadCityCatalog();
    (catalog.cities || []).forEach((city) => {
        const holder = resolveCityHolder(city, cityHolders);
        if (!holder) return;
        if (!nations.has(holder)) {
            nations.set(holder, String(city.nationName || holder));
        }
    });

    return Array.from(nations.entries()).map(([nationId, nationName]) => ({ nationId, nationName }));
}

function pickRandomCommanderForNation(commanders, nationId) {
    const nation = normalizeNationKey(nationId);
    const pool = (Array.isArray(commanders) ? commanders : []).filter((commander) => (
        normalizeNationKey(resolveCommanderGameNationKey(commander)) === nation
        && normalizeUsername(commander?.username)
    ));
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
}

function pushFeedEntry(program, entry) {
    const feed = [normalizeHqBountyFeedEntry(entry), ...program.feed].filter(Boolean);
    return {
        ...program,
        feed: feed.slice(0, HQ_BOUNTY_FEED_MAX)
    };
}

function issueHqBountyCycle(commanders, cityHolders, resolveCatalogNationDisplayName) {
    const now = new Date();
    const nowMs = now.getTime();
    const expiresAt = new Date(nowMs + HQ_BOUNTY_DURATION_MS).toISOString();
    const activeNations = listActiveNations(commanders, cityHolders);
    const targets = [];
    const feed = [];

    activeNations.forEach(({ nationId, nationName }) => {
        const commander = pickRandomCommanderForNation(commanders, nationId);
        if (!commander) return;
        const rankMeta = buildCommanderRankMeta(commander);
        const displayNation = typeof resolveCatalogNationDisplayName === 'function'
            ? (resolveCatalogNationDisplayName(nationId) || nationName)
            : nationName;
        targets.push({
            nationId,
            nationName: displayNation,
            targetUsername: normalizeUsername(commander.username),
            targetRank: rankMeta.rank,
            resolved: false,
            resolution: null
        });
        feed.push(normalizeHqBountyFeedEntry({
            id: createIntelId('bounty-issued'),
            type: 'issued',
            at: now.toISOString(),
            targetUsername: normalizeUsername(commander.username),
            targetNationId: nationId,
            targetNationName: displayNation,
            targetRank: rankMeta.rank,
            message: `${normalizeUsername(commander.username)} (Rank ${rankMeta.rank}, ${displayNation}) marked for bounty.`
        }));
    });

    return {
        cycleId: createIntelId('hq-cycle'),
        issuedAt: now.toISOString(),
        expiresAt,
        targets,
        feed: feed.filter(Boolean)
    };
}

function isHqBountyCycleExpired(program, nowMs = Date.now()) {
    const expiresMs = Date.parse(program?.expiresAt || '');
    return !Number.isFinite(expiresMs) || expiresMs <= nowMs;
}

function resolveHqBountyCycle(program, commanders, cityHolders, resolveCatalogNationDisplayName) {
    let next = normalizeHqBountyProgram(program);
    const nowMs = Date.now();

    if (!next.cycleId || isHqBountyCycleExpired(next, nowMs)) {
        if (next.targets.length) {
            next.targets.forEach((target) => {
                if (target.resolved) return;
                next = pushFeedEntry(next, {
                    id: createIntelId('bounty-evaded'),
                    type: 'evaded',
                    at: new Date(nowMs).toISOString(),
                    targetUsername: target.targetUsername,
                    targetNationId: target.nationId,
                    targetNationName: target.nationName,
                    targetRank: target.targetRank,
                    message: `${target.targetUsername} successfully evaded the nation bounty.`
                });
                target.resolved = true;
                target.resolution = 'evaded';
            });
        }
        next = issueHqBountyCycle(commanders, cityHolders, resolveCatalogNationDisplayName);
    }

    return next;
}

function buildHqBountyWorkspaceSlice(program, viewerNation) {
    const viewer = normalizeNationKey(viewerNation);
    const normalized = normalizeHqBountyProgram(program);
    const nowMs = Date.now();
    const msLeft = Math.max(0, Date.parse(normalized.expiresAt || '') - nowMs);

    return {
        cycleId: normalized.cycleId,
        issuedAt: normalized.issuedAt,
        expiresAt: normalized.expiresAt,
        hoursRemaining: Math.ceil(msLeft / (60 * 60 * 1000)),
        targets: normalized.targets.map((target) => ({
            ...target,
            highlightNation: viewer && target.nationId === viewer
        })),
        feed: normalized.feed.map((entry) => ({
            ...entry,
            highlightNation: viewer && entry.targetNationId === viewer
        }))
    };
}

function claimHqBountyPvpVictory(program, hunterCommander, targetUsername) {
    const hunter = normalizeUsername(hunterCommander?.username);
    const target = normalizeUsername(targetUsername);
    if (!hunter || !target) {
        return { ok: false, errorCode: 'NEXUS-AGE-023' };
    }

    let next = normalizeHqBountyProgram(program);
    const row = next.targets.find((entry) => (
        !entry.resolved
        && entry.targetUsername.toLowerCase() === target.toLowerCase()
    ));

    if (!row || isHqBountyCycleExpired(next)) {
        return { ok: false, errorCode: 'NEXUS-AGE-023' };
    }

    row.resolved = true;
    row.resolution = 'collected';
    const hunterNation = normalizeNationKey(resolveCommanderGameNationKey(hunterCommander));
    next = pushFeedEntry(next, {
        id: createIntelId('bounty-collected'),
        type: 'collected',
        at: new Date().toISOString(),
        targetUsername: row.targetUsername,
        targetNationId: row.nationId,
        targetNationName: row.nationName,
        targetRank: row.targetRank,
        actorUsername: hunter,
        actorNationId: hunterNation,
        message: `${row.targetUsername} was defeated by ${hunter}. Bounty collected.`
    });

    return { ok: true, program: next, target: row };
}

function resolveCommanderCatalogCityId(commander) {
    const movementCity = String(commander?.movement?.catalogCityId || '').trim();
    if (movementCity) return movementCity;
    return String(commander?.catalogCityId || '').trim();
}

function buildSpyLogsFromCityScouts(commanders, cityId, cityName, createdBy, resolveCommanderCityId) {
    const resolvedCityId = String(cityId || '').trim();
    const city = getCatalogCity(resolvedCityId);
    if (!city) return [];

    return (Array.isArray(commanders) ? commanders : [])
        .filter((commander) => {
            const username = normalizeUsername(commander?.username);
            if (!username) return false;
            const commanderCityId = typeof resolveCommanderCityId === 'function'
                ? resolveCommanderCityId(commander)
                : resolveCommanderCatalogCityId(commander);
            return commanderCityId === resolvedCityId;
        })
        .map((commander) => buildSpyReportFromCommander(commander, {
            createdBy,
            cityId: resolvedCityId,
            cityName: cityName || city.name || '',
            subjectNationName: String(city.nationName || '').trim()
        }))
        .filter(Boolean);
}

module.exports = {
    SPY_LOG_MAX,
    SPY_OUTDATED_GROWTH,
    HQ_BOUNTY_DURATION_MS,
    normalizeSpyLogs,
    normalizeHqBountyProgram,
    buildThreatAssessmentMatrix,
    buildSpyLogsWorkspaceSlice,
    buildHqBountyWorkspaceSlice,
    appendSpyLogs,
    deleteSpyLog,
    forwardSpyLog,
    evaluateSpyLogEntry,
    buildSpyReportFromCommander,
    buildSpyLogsFromCityScouts,
    resolveHqBountyCycle,
    claimHqBountyPvpVictory,
    computeArmyPowerScore,
    computeNationPowerScore
};

/**
 * NEXUS — Age player records (participation stats + tick-based leaderboard ranking).
 * Ranking mechanics mirror Last Knights officer/PvP composite scoring; commander rank
 * replaces hero-build contribution.
 */
'use strict';

const { getMovePointTickBoundaryMs, getNextMovePointTickBoundaryMs, MOVE_POINT_TICK_MS, resolveCatalogNationKey, resolveCommanderGameNationKey } = require('./nexus-age-movement');
const { buildCommanderRankMeta } = require('./nexus-commander-rank-titles');
const { sumSideTotals } = require('./nexus-age-battle-report');

const PVP_SCORE_BATTLE_WON = 100;
const PVP_SCORE_BATTLE_LOST = 25;
const PVP_SCORE_SF_CITY_BATTLE = 75;
const PVP_SCORE_KILL_ATTACK = 8;
const PVP_SCORE_CAPTURE_ATTACK = 12;
const RANK_SCORE_PER_LEVEL = 10;

function numberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function normalizePlayerAgeRecords(raw) {
    if (!raw || typeof raw !== 'object') {
        return {
            currentRank: null,
            overallPvpScore: null,
            overallRankScore: null,
            battlesWon: null,
            battlesLost: null,
            sfCityBattles: null,
            pvpKillsAttack: null,
            pvpCapturesAttack: null
        };
    }

    return {
        currentRank: numberOrNull(raw.currentRank),
        overallPvpScore: numberOrNull(raw.overallPvpScore),
        overallRankScore: numberOrNull(raw.overallRankScore),
        battlesWon: numberOrNull(raw.battlesWon),
        battlesLost: numberOrNull(raw.battlesLost),
        sfCityBattles: numberOrNull(raw.sfCityBattles),
        pvpKillsAttack: numberOrNull(raw.pvpKillsAttack),
        pvpCapturesAttack: numberOrNull(raw.pvpCapturesAttack)
    };
}

function commanderHasJoinedAge(commander) {
    return Boolean(resolveCatalogNationKey(commander?.gameNation || resolveCommanderGameNationKey(commander)));
}

function numberOrZero(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

function readAgePlayerRecordsMeta(portal) {
    const raw = portal?.agePlayerRecordsMeta;
    if (!raw || typeof raw !== 'object') {
        return { lastRankingTickBoundaryMs: null };
    }
    const boundary = Number(raw.lastRankingTickBoundaryMs);
    return {
        lastRankingTickBoundaryMs: Number.isFinite(boundary) ? Math.floor(boundary) : null
    };
}

function writeAgePlayerRecordsMeta(db, meta) {
    const portal = db.get('portal').value() || {};
    const next = {
        ...readAgePlayerRecordsMeta(portal),
        ...(meta && typeof meta === 'object' ? meta : {})
    };
    db.get('portal').assign({ agePlayerRecordsMeta: next }).write();
    return next;
}

function resolveFirstAgeRecordsRankingBoundaryMs(activeStartedAt) {
    const startedMs = Date.parse(String(activeStartedAt || '').trim());
    if (!Number.isFinite(startedMs)) return null;
    return getNextMovePointTickBoundaryMs(startedMs);
}

function isAgeRecordsRankingLive(activeStartedAt, nowMs = Date.now()) {
    const firstBoundary = resolveFirstAgeRecordsRankingBoundaryMs(activeStartedAt);
    if (firstBoundary == null) return false;
    return nowMs >= firstBoundary;
}

function resolveAgeRecordsRankingMeta(activeStartedAt, nowMs = Date.now()) {
    const firstBoundary = resolveFirstAgeRecordsRankingBoundaryMs(activeStartedAt);
    const live = firstBoundary != null && nowMs >= firstBoundary;
    const currentBoundary = getMovePointTickBoundaryMs(nowMs);
    const nextBoundary = currentBoundary + MOVE_POINT_TICK_MS;
    return {
        live,
        firstRankingAt: firstBoundary != null ? new Date(firstBoundary).toISOString() : null,
        currentTickBoundaryAt: new Date(currentBoundary).toISOString(),
        nextRankingTickAt: new Date(nextBoundary).toISOString()
    };
}

function computeOverallRankScoreFromCommander(commander) {
    const meta = buildCommanderRankMeta(commander);
    const rank = Math.max(1, Math.floor(Number(meta?.rank) || 1));
    return rank * rank * RANK_SCORE_PER_LEVEL;
}

function computeOverallPvpScoreFromStats(stats) {
    return (
        numberOrZero(stats.battlesWon) * PVP_SCORE_BATTLE_WON
        + numberOrZero(stats.battlesLost) * PVP_SCORE_BATTLE_LOST
        + numberOrZero(stats.sfCityBattles) * PVP_SCORE_SF_CITY_BATTLE
        + numberOrZero(stats.pvpKillsAttack) * PVP_SCORE_KILL_ATTACK
        + numberOrZero(stats.pvpCapturesAttack) * PVP_SCORE_CAPTURE_ATTACK
    );
}

function computeCompositeRecordsScore(stats) {
    return numberOrZero(stats.overallPvpScore) + numberOrZero(stats.overallRankScore);
}

function mergeAgeRecordsPatch(existing, patch) {
    const base = normalizePlayerAgeRecords(existing);
    const next = { ...base };

    Object.entries(patch || {}).forEach(([key, delta]) => {
        if (typeof delta === 'number' && Number.isFinite(delta)) {
            next[key] = numberOrZero(base[key]) + Math.floor(delta);
            return;
        }
        if (delta !== undefined) {
            next[key] = delta;
        }
    });

    return next;
}

function persistCommanderAgeRecords(db, username, patch) {
    const canonical = String(username || '').trim().toLowerCase();
    if (!canonical) return null;

    const commander = db.get('commanders').find({ username: canonical }).value();
    if (!commander) return null;

    const ageRecords = mergeAgeRecordsPatch(commander.ageRecords, patch);
    db.get('commanders').find({ username: canonical }).assign({ ageRecords }).write();
    return ageRecords;
}

function attackerWonBattleReport(battleReport) {
    const winner = String(battleReport?.winner || '').trim().toLowerCase();
    return winner === 'attacker' || winner === 'commander';
}

function resolveDefenderCombatTotals(battleReport) {
    const defender = battleReport?.defender;
    if (!defender) return { dead: 0, captured: 0 };
    const totals = defender.totals || sumSideTotals(defender.unitLines);
    return {
        dead: numberOrZero(totals.dead),
        captured: numberOrZero(totals.captured)
    };
}

function applyAgeRecordsBattleOutcome(db, options = {}) {
    const battleReport = options.battleReport;
    if (!battleReport || typeof battleReport !== 'object') return;

    const attackerUsername = String(options.attackerUsername || battleReport.attacker?.username || '').trim().toLowerCase();
    const defenderUsername = String(options.defenderUsername || battleReport.defender?.username || '').trim().toLowerCase();
    const attackerWon = attackerWonBattleReport(battleReport);
    const draw = String(battleReport.winner || '').trim().toLowerCase() === 'draw';
    const combatTotals = resolveDefenderCombatTotals(battleReport);

    if (attackerUsername) {
        persistCommanderAgeRecords(db, attackerUsername, {
            battlesWon: attackerWon ? 1 : 0,
            battlesLost: !attackerWon && !draw ? 1 : 0,
            sfCityBattles: options.isSfCityBattle ? 1 : 0,
            pvpKillsAttack: combatTotals.dead,
            pvpCapturesAttack: combatTotals.captured
        });
    }

    if (defenderUsername) {
        persistCommanderAgeRecords(db, defenderUsername, {
            battlesWon: !attackerWon && !draw ? 1 : 0,
            battlesLost: attackerWon ? 1 : 0,
            sfCityBattles: options.isSfCityBattle ? 1 : 0
        });
    }

    (Array.isArray(options.participantUsernames) ? options.participantUsernames : []).forEach((rawUsername) => {
        const participant = String(rawUsername || '').trim().toLowerCase();
        if (!participant || participant === attackerUsername || participant === defenderUsername) return;

        persistCommanderAgeRecords(db, participant, {
            battlesWon: attackerWon ? 1 : 0,
            battlesLost: !attackerWon && !draw ? 1 : 0,
            sfCityBattles: options.isSfCityBattle ? 1 : 0
        });
    });
}

function recalculatePlayerAgeRecordsRankings(commanders, activeStartedAt, nowMs = Date.now()) {
    const rankingMeta = resolveAgeRecordsRankingMeta(activeStartedAt, nowMs);
    if (!rankingMeta.live) {
        return {
            rankingMeta,
            updated: []
        };
    }

    const eligible = (Array.isArray(commanders) ? commanders : [])
        .filter((commander) => commander?.username && commanderHasJoinedAge(commander))
        .map((commander) => {
            const stats = normalizePlayerAgeRecords(commander.ageRecords);
            const overallRankScore = computeOverallRankScoreFromCommander(commander);
            const overallPvpScore = computeOverallPvpScoreFromStats(stats);
            const compositeScore = overallPvpScore + overallRankScore;
            return {
                username: String(commander.username).trim().toLowerCase(),
                stats,
                overallRankScore,
                overallPvpScore,
                compositeScore
            };
        });

    eligible.sort((left, right) => {
        if (right.compositeScore !== left.compositeScore) {
            return right.compositeScore - left.compositeScore;
        }
        if (numberOrZero(right.stats.battlesWon) !== numberOrZero(left.stats.battlesWon)) {
            return numberOrZero(right.stats.battlesWon) - numberOrZero(left.stats.battlesWon);
        }
        return left.username.localeCompare(right.username);
    });

    const updated = eligible.map((entry, index) => ({
        username: entry.username,
        ageRecords: {
            ...entry.stats,
            overallRankScore: entry.overallRankScore,
            overallPvpScore: entry.overallPvpScore,
            currentRank: index + 1
        }
    }));

    return {
        rankingMeta,
        updated
    };
}

function persistPlayerAgeRecordsRankings(db, activeStartedAt, nowMs = Date.now()) {
    const commanders = db.get('commanders').value() || [];
    const { rankingMeta, updated } = recalculatePlayerAgeRecordsRankings(commanders, activeStartedAt, nowMs);

    updated.forEach((entry) => {
        db.get('commanders').find({ username: entry.username }).assign({
            ageRecords: entry.ageRecords
        }).write();
    });

    if (rankingMeta.live) {
        writeAgePlayerRecordsMeta(db, {
            lastRankingTickBoundaryMs: getMovePointTickBoundaryMs(nowMs)
        });
    }

    return {
        rankingMeta,
        rankedCount: updated.length
    };
}

function maybeRunAgePlayerRecordsRankingTick(db, activeStartedAt, nowMs = Date.now()) {
    if (!db || !activeStartedAt) return null;

    const rankingMeta = resolveAgeRecordsRankingMeta(activeStartedAt, nowMs);
    if (!rankingMeta.live) return { action: 'idle', reason: 'rankings_not_live', rankingMeta };

    const currentBoundary = getMovePointTickBoundaryMs(nowMs);
    const portal = db.get('portal').value() || {};
    const meta = readAgePlayerRecordsMeta(portal);
    if (meta.lastRankingTickBoundaryMs === currentBoundary) {
        return { action: 'idle', reason: 'already_ranked_this_tick', rankingMeta };
    }

    const result = persistPlayerAgeRecordsRankings(db, activeStartedAt, nowMs);
    return {
        action: 'ranked',
        rankedCount: result.rankedCount,
        rankingMeta: result.rankingMeta
    };
}

module.exports = {
    PVP_SCORE_BATTLE_WON,
    PVP_SCORE_BATTLE_LOST,
    PVP_SCORE_SF_CITY_BATTLE,
    PVP_SCORE_KILL_ATTACK,
    PVP_SCORE_CAPTURE_ATTACK,
    RANK_SCORE_PER_LEVEL,
    readAgePlayerRecordsMeta,
    writeAgePlayerRecordsMeta,
    resolveFirstAgeRecordsRankingBoundaryMs,
    isAgeRecordsRankingLive,
    resolveAgeRecordsRankingMeta,
    computeOverallRankScoreFromCommander,
    computeOverallPvpScoreFromStats,
    computeCompositeRecordsScore,
    mergeAgeRecordsPatch,
    persistCommanderAgeRecords,
    applyAgeRecordsBattleOutcome,
    recalculatePlayerAgeRecordsRankings,
    persistPlayerAgeRecordsRankings,
    maybeRunAgePlayerRecordsRankingTick
};

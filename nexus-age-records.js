/**
 * NEXUS — Age Records leaderboard (personal, national, and global rankings).
 */
'use strict';

const { loadCityCatalog, resolveCatalogNationKey } = require('./nexus-age-movement');
const { buildCommanderRankMeta, getCommanderRankDisplayTitle } = require('./nexus-commander-rank-titles');
const {
    resolveAgeRecordsRankingMeta,
    computeOverallRankScoreFromCommander,
    computeOverallPvpScoreFromStats,
    normalizePlayerAgeRecords,
    resolveCommanderNationKey
} = require('./nexus-age-player-records');

function numberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function commanderHasJoinedAge(commander) {
    return Boolean(resolveCatalogNationKey(commander?.gameNation));
}

function buildCommanderRankTitle(commander, joinedAge) {
    if (!joinedAge) return null;
    const rankMeta = buildCommanderRankMeta(commander);
    if (!rankMeta) return null;
    return getCommanderRankDisplayTitle(
        rankMeta.rank,
        rankMeta.path,
        rankMeta.rankTitleGender
    ) || null;
}

function buildFullPlayerRecord(commander, resolveDisplayName, rankingContext = {}) {
    const username = String(commander?.username || '').trim();
    const stats = normalizePlayerAgeRecords(commander?.ageRecords);
    const joinedAge = commanderHasJoinedAge(commander);
    const rankMeta = joinedAge ? buildCommanderRankMeta(commander) : null;
    const commanderRankTitle = buildCommanderRankTitle(commander, joinedAge);
    const nationId = resolveCommanderNationKey(commander);
    const rankingLive = rankingContext.rankingLive === true;
    const overallRankScore = rankingLive
        ? (stats.overallRankScore ?? computeOverallRankScoreFromCommander(commander))
        : null;
    const overallPvpScore = rankingLive
        ? (stats.overallPvpScore ?? computeOverallPvpScoreFromStats(stats))
        : null;

    return {
        username,
        playerName: resolveDisplayName(username) || username,
        nationId,
        nationName: rankingContext.resolveNationDisplayName?.(nationId) || nationId || null,
        hasJoinedAge: joinedAge,
        commanderRank: joinedAge && rankMeta ? rankMeta.rank : null,
        commanderRankTitle: commanderRankTitle || null,
        commanderRankPath: joinedAge && rankMeta ? rankMeta.path : null,
        commanderRankTitleGender: joinedAge && rankMeta ? rankMeta.rankTitleGender : null,
        globalRanking: rankingLive && joinedAge ? stats.currentRank : null,
        nationRanking: rankingLive && joinedAge ? stats.nationRank : null,
        overallPvpScore,
        overallRankScore,
        pvpBattlesWon: stats.pvpBattlesWon,
        pvpBattlesLost: stats.pvpBattlesLost,
        cityBattlesWon: stats.cityBattlesWon,
        cityBattlesLost: stats.cityBattlesLost,
        sfParticipations: stats.sfParticipations,
        sfCityBattles: stats.sfCityBattles,
        pvpKillsAttack: stats.pvpKillsAttack,
        pvpCapturesAttack: stats.pvpCapturesAttack,
        cityKillsAttack: stats.cityKillsAttack,
        cityCapturesAttack: stats.cityCapturesAttack
    };
}

function toGlobalPlayerRecord(record) {
    return {
        username: record.username,
        playerName: record.playerName,
        nationId: record.nationId,
        nationName: record.nationName,
        hasJoinedAge: record.hasJoinedAge,
        commanderRankTitle: record.commanderRankTitle,
        globalRanking: record.globalRanking,
        sfParticipations: record.sfParticipations,
        overallPvpScore: record.overallPvpScore,
        overallRankScore: record.overallRankScore,
        pvpBattlesWon: record.pvpBattlesWon,
        pvpBattlesLost: record.pvpBattlesLost,
        pvpKillsAttack: record.pvpKillsAttack,
        pvpCapturesAttack: record.pvpCapturesAttack
    };
}

function toNationalPlayerRecord(record) {
    return {
        username: record.username,
        playerName: record.playerName,
        nationId: record.nationId,
        hasJoinedAge: record.hasJoinedAge,
        commanderRankTitle: record.commanderRankTitle,
        globalRanking: record.globalRanking,
        nationRanking: record.nationRanking,
        sfParticipations: record.sfParticipations,
        cityBattlesWon: record.cityBattlesWon,
        cityBattlesLost: record.cityBattlesLost,
        sfCityBattles: record.sfCityBattles,
        cityKillsAttack: record.cityKillsAttack,
        cityCapturesAttack: record.cityCapturesAttack
    };
}

function sortGlobalRows(rows, rankingLive) {
    return rows.slice().sort((left, right) => {
        if (rankingLive) {
            const leftRank = Number(left.globalRanking);
            const rightRank = Number(right.globalRanking);
            const leftHasRank = Number.isFinite(leftRank) && leftRank > 0;
            const rightHasRank = Number.isFinite(rightRank) && rightRank > 0;
            if (leftHasRank && rightHasRank && leftRank !== rightRank) {
                return leftRank - rightRank;
            }
            if (leftHasRank !== rightHasRank) {
                return leftHasRank ? -1 : 1;
            }
        }
        return left.playerName.localeCompare(right.playerName, undefined, { sensitivity: 'base' });
    });
}

function sortNationalRows(rows, rankingLive) {
    return rows.slice().sort((left, right) => {
        if (rankingLive) {
            const leftRank = Number(left.nationRanking);
            const rightRank = Number(right.nationRanking);
            const leftHasRank = Number.isFinite(leftRank) && leftRank > 0;
            const rightHasRank = Number.isFinite(rightRank) && rightRank > 0;
            if (leftHasRank && rightHasRank && leftRank !== rightRank) {
                return leftRank - rightRank;
            }
            if (leftHasRank !== rightHasRank) {
                return leftHasRank ? -1 : 1;
            }
        }
        return left.playerName.localeCompare(right.playerName, undefined, { sensitivity: 'base' });
    });
}

function buildAgeRecordsPayload({
    commanders,
    isHiddenUsername,
    resolveNationLeadershipDisplayName,
    resolveCatalogNationDisplayName,
    viewerUsername = '',
    viewerNationId = null,
    ageCampaignActiveStartedAt = null,
    nowMs = Date.now()
}) {
    const rankingMeta = resolveAgeRecordsRankingMeta(ageCampaignActiveStartedAt, nowMs);
    const rankingContext = {
        rankingLive: rankingMeta.live,
        resolveNationDisplayName: resolveCatalogNationDisplayName
    };
    const canonicalViewer = String(viewerUsername || '').trim().toLowerCase();
    const viewerNationKey = resolveCatalogNationKey(viewerNationId);

    const fullRows = (Array.isArray(commanders) ? commanders : [])
        .filter((commander) => commander?.username && !isHiddenUsername(commander.username))
        .map((commander) => buildFullPlayerRecord(
            commander,
            resolveNationLeadershipDisplayName,
            rankingContext
        ));

    const personal = fullRows.find((row) => row.username.toLowerCase() === canonicalViewer) || null;
    const globalPlayers = sortGlobalRows(
        fullRows.filter((row) => row.hasJoinedAge).map(toGlobalPlayerRecord),
        rankingMeta.live
    );
    const nationalPlayers = sortNationalRows(
        fullRows
            .filter((row) => row.hasJoinedAge && viewerNationKey && row.nationId === viewerNationKey)
            .map(toNationalPlayerRecord),
        rankingMeta.live
    );

    return {
        personal,
        global: {
            players: globalPlayers
        },
        national: {
            nationId: viewerNationKey,
            nationName: viewerNationKey
                ? (resolveCatalogNationDisplayName(viewerNationKey) || viewerNationKey)
                : null,
            players: nationalPlayers
        },
        recordsRanking: rankingMeta,
        viewerNationId: viewerNationKey,
        updatedAt: new Date().toISOString()
    };
}

module.exports = {
    buildAgeRecordsPayload,
    buildFullPlayerRecord,
    commanderHasJoinedAge,
    normalizePlayerAgeRecords: normalizePlayerAgeRecords
};

/**
 * NEXUS — Age Records leaderboard (personal, national, and global rankings).
 */
'use strict';

const { loadCityCatalog, resolveCatalogNationKey, resolveCityHolder } = require('./nexus-age-movement');
const { buildCommanderRankMeta, getCommanderRankDisplayTitle } = require('./nexus-commander-rank-titles');
const {
    resolveAgeRecordsRankingMeta,
    computeOverallRankScoreFromCommander,
    computeOverallPvpScoreFromStats,
    normalizePlayerAgeRecords,
    resolveCommanderNationKey
} = require('./nexus-age-player-records');

const DEFAULT_NATION_TOTAL_CITIES = 15;

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

function normalizeNationAgeRecords(raw) {
    if (!raw || typeof raw !== 'object') {
        return {
            points: null,
            overallStrength: null,
            cityCaptureBattlePoints: null,
            cityCaptures: null,
            overallPvpStrength: null,
            successfulDropsPerformed: null,
            successfulDropsAgainstNation: null
        };
    }

    return {
        points: numberOrNull(raw.points),
        overallStrength: numberOrNull(raw.overallStrength),
        cityCaptureBattlePoints: numberOrNull(raw.cityCaptureBattlePoints),
        cityCaptures: numberOrNull(raw.cityCaptures),
        overallPvpStrength: numberOrNull(raw.overallPvpStrength),
        successfulDropsPerformed: numberOrNull(raw.successfulDropsPerformed),
        successfulDropsAgainstNation: numberOrNull(raw.successfulDropsAgainstNation)
    };
}

function buildNationCitiesOwnedMap(cityHolders) {
    const catalog = loadCityCatalog();
    const holders = cityHolders && typeof cityHolders === 'object' ? cityHolders : {};
    const counts = new Map();

    (catalog.cities || []).forEach((city) => {
        const holderKey = resolveCatalogNationKey(resolveCityHolder(city, holders));
        if (!holderKey) return;
        counts.set(holderKey, (counts.get(holderKey) || 0) + 1);
    });

    return counts;
}

function buildNationTotalCitiesMap(catalog) {
    const counts = new Map();

    (catalog?.cities || []).forEach((city) => {
        const nationKey = resolveCatalogNationKey(city?.nationId);
        if (!nationKey) return;
        counts.set(nationKey, (counts.get(nationKey) || 0) + 1);
    });

    return counts;
}

function buildNationPlayersInNationMap(commanders, isHiddenUsername, resolveCommanderMapNationKey) {
    const counts = new Map();

    (Array.isArray(commanders) ? commanders : []).forEach((commander) => {
        if (!commander?.username || isHiddenUsername(commander.username)) return;

        const nationId = resolveCatalogNationKey(resolveCommanderMapNationKey(commander));
        if (!nationId) return;

        counts.set(nationId, (counts.get(nationId) || 0) + 1);
    });

    return counts;
}

function resolveNationStatNumber(value, defaultValue = 0) {
    const numeric = numberOrNull(value);
    return numeric === null ? defaultValue : numeric;
}

function serializeNationAgeRecord({
    nationId,
    nationName,
    leadership,
    nationRecords,
    citiesOwned,
    totalCities,
    playersInNation,
    resolveNationLeadershipDisplayName
}) {
    const stats = normalizeNationAgeRecords(nationRecords);
    const leaderUsername = leadership?.leaderUsername || '';
    const viceLeaderUsername = leadership?.viceLeaderUsername || '';

    return {
        nationId,
        nationName,
        globalRanking: null,
        points: resolveNationStatNumber(stats.points, 0),
        citiesOwned: Number.isFinite(Number(citiesOwned)) ? Number(citiesOwned) : 0,
        totalCities: Number.isFinite(Number(totalCities)) ? Number(totalCities) : DEFAULT_NATION_TOTAL_CITIES,
        playersInNation: Number.isFinite(Number(playersInNation)) ? Number(playersInNation) : 0,
        cityCaptures: resolveNationStatNumber(stats.cityCaptures, 0),
        successfulDropsPerformed: resolveNationStatNumber(stats.successfulDropsPerformed, 0),
        leaderUsername,
        viceLeaderUsername,
        leader: leaderUsername
            ? (resolveNationLeadershipDisplayName(leaderUsername) || leaderUsername)
            : 'None',
        viceLeader: viceLeaderUsername
            ? (resolveNationLeadershipDisplayName(viceLeaderUsername) || viceLeaderUsername)
            : 'None'
    };
}

function toGlobalNationRecord(record) {
    return {
        nationId: record.nationId,
        nationName: record.nationName,
        globalRanking: record.globalRanking,
        points: record.points,
        citiesOwned: record.citiesOwned,
        totalCities: record.totalCities,
        playersInNation: record.playersInNation,
        cityCaptures: record.cityCaptures,
        successfulDropsPerformed: record.successfulDropsPerformed,
        leader: record.leader,
        viceLeader: record.viceLeader
    };
}

function sortGlobalNationRows(rows, rankingLive) {
    const sorted = rows.slice().sort((left, right) => {
        if (right.points !== left.points) {
            return right.points - left.points;
        }
        if (right.cityCaptures !== left.cityCaptures) {
            return right.cityCaptures - left.cityCaptures;
        }
        return left.nationName.localeCompare(right.nationName, undefined, { sensitivity: 'base' });
    });

    if (!rankingLive) {
        return sorted.map((row) => ({ ...row, globalRanking: null }));
    }

    return sorted.map((row, index) => ({
        ...row,
        globalRanking: index + 1
    }));
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
    nationRecordsMap,
    cityHolders,
    isHiddenUsername,
    resolveCommanderMapNationKey,
    readNationLeadershipForNation,
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
    const catalog = loadCityCatalog();
    const catalogNations = Array.isArray(catalog.nations) ? catalog.nations : [];
    const recordsMap = nationRecordsMap && typeof nationRecordsMap === 'object' ? nationRecordsMap : {};
    const citiesOwnedByNation = buildNationCitiesOwnedMap(cityHolders);
    const totalCitiesByNation = buildNationTotalCitiesMap(catalog);
    const playersInNationByNation = buildNationPlayersInNationMap(
        commanders,
        isHiddenUsername,
        resolveCommanderMapNationKey
    );

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

    const nationRows = catalogNations
        .map((nation) => {
            const nationId = resolveCatalogNationKey(nation.id);
            if (!nationId) return null;

            const nationName = resolveCatalogNationDisplayName(nationId) || String(nation.name || nationId).trim();
            const leadership = readNationLeadershipForNation(nationId);
            const nationRecords = recordsMap[nationId] || recordsMap[String(nationId).toLowerCase()] || null;

            return serializeNationAgeRecord({
                nationId,
                nationName,
                leadership,
                nationRecords,
                citiesOwned: citiesOwnedByNation.get(nationId) ?? 0,
                totalCities: totalCitiesByNation.get(nationId) ?? DEFAULT_NATION_TOTAL_CITIES,
                playersInNation: playersInNationByNation.get(nationId) ?? 0,
                resolveNationLeadershipDisplayName
            });
        })
        .filter(Boolean);

    const globalNations = sortGlobalNationRows(
        nationRows.map(toGlobalNationRecord),
        rankingMeta.live
    );

    return {
        personal,
        global: {
            players: globalPlayers,
            nations: globalNations
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
    normalizePlayerAgeRecords: normalizePlayerAgeRecords,
    normalizeNationAgeRecords
};

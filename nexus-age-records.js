/**
 * NEXUS — Age Records leaderboard (all commanders and nations).
 */
'use strict';

const { loadCityCatalog, resolveCatalogNationKey, resolveCityHolder } = require('./nexus-age-movement');
const { buildCommanderRankMeta, getCommanderRankDisplayTitle } = require('./nexus-commander-rank-titles');
const {
    isAgeRecordsRankingLive,
    resolveAgeRecordsRankingMeta,
    computeOverallRankScoreFromCommander,
    computeOverallPvpScoreFromStats
} = require('./nexus-age-player-records');

const DEFAULT_NATION_TOTAL_CITIES = 15;

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

function commanderHasJoinedAge(commander) {
    return Boolean(resolveCatalogNationKey(commander?.gameNation));
}

function serializeCommanderAgeRecord(commander, resolveDisplayName, rankingContext = {}) {
    const username = String(commander?.username || '').trim();
    const stats = normalizePlayerAgeRecords(commander?.ageRecords);
    const joinedAge = commanderHasJoinedAge(commander);
    const rankMeta = joinedAge ? buildCommanderRankMeta(commander) : null;
    const commanderRankTitle = joinedAge && rankMeta
        ? getCommanderRankDisplayTitle(
            rankMeta.rank,
            rankMeta.path,
            rankMeta.rankTitleGender
        )
        : null;
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
        hasJoinedAge: joinedAge,
        commanderRank: joinedAge && rankMeta ? rankMeta.rank : null,
        commanderRankTitle: commanderRankTitle || null,
        commanderRankPath: joinedAge && rankMeta ? rankMeta.path : null,
        commanderRankTitleGender: joinedAge && rankMeta ? rankMeta.rankTitleGender : null,
        ranking: rankingLive && joinedAge ? stats.currentRank : null,
        overallPvpScore,
        overallRankScore,
        battlesWon: stats.battlesWon,
        battlesLost: stats.battlesLost,
        sfCityBattles: stats.sfCityBattles,
        pvpKillsAttack: stats.pvpKillsAttack,
        pvpCapturesAttack: stats.pvpCapturesAttack
    };
}

function resolveNationGoldWealth(treasury) {
    if (!treasury || typeof treasury !== 'object') return 'N/A';

    const updatedAt = treasury.updatedAt ? String(treasury.updatedAt).trim() : '';
    const rsd = numberOrNull(treasury.rsd);

    if (!updatedAt && (rsd === null || rsd === 0)) {
        return 'N/A';
    }

    return rsd;
}

function resolveNationStatNumber(value, defaultValue = 0) {
    const numeric = numberOrNull(value);
    return numeric === null ? defaultValue : numeric;
}

function resolveNationOptionalNumber(value) {
    const numeric = numberOrNull(value);
    return numeric === null ? 'N/A' : numeric;
}

function assignDefaultNationRanks(nationRows) {
    return nationRows.map((row, index) => ({
        ...row,
        rank: index + 1
    }));
}

function serializeNationAgeRecord({
    nationId,
    nationName,
    treasury,
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
        rank: null,
        points: resolveNationStatNumber(stats.points, 0),
        citiesOwned: Number.isFinite(Number(citiesOwned)) ? Number(citiesOwned) : 0,
        totalCities: Number.isFinite(Number(totalCities)) ? Number(totalCities) : DEFAULT_NATION_TOTAL_CITIES,
        playersInNation: Number.isFinite(Number(playersInNation)) ? Number(playersInNation) : 0,
        cityCaptures: resolveNationStatNumber(stats.cityCaptures, 0),
        overallStrength: resolveNationOptionalNumber(stats.overallStrength),
        overallGoldWealth: resolveNationGoldWealth(treasury),
        cityCaptureBattlePoints: resolveNationStatNumber(stats.cityCaptureBattlePoints, 0),
        overallPvpStrength: resolveNationOptionalNumber(stats.overallPvpStrength),
        successfulDropsPerformed: resolveNationStatNumber(stats.successfulDropsPerformed, 0),
        successfulDropsAgainstNation: resolveNationStatNumber(stats.successfulDropsAgainstNation, 0),
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

function buildAgeRecordsPayload({
    commanders,
    nationRecordsMap,
    cityHolders,
    isHiddenUsername,
    resolveCommanderMapNationKey,
    readNationTreasuryForNation,
    readNationLeadershipForNation,
    resolveNationLeadershipDisplayName,
    resolveCatalogNationDisplayName,
    ageCampaignActiveStartedAt = null,
    nowMs = Date.now()
}) {
    const rankingMeta = resolveAgeRecordsRankingMeta(ageCampaignActiveStartedAt, nowMs);
    const rankingContext = { rankingLive: rankingMeta.live };
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

    const players = (Array.isArray(commanders) ? commanders : [])
        .filter((commander) => commander?.username && !isHiddenUsername(commander.username))
        .map((commander) => serializeCommanderAgeRecord(
            commander,
            resolveNationLeadershipDisplayName,
            rankingContext
        ))
        .sort((left, right) => {
            if (rankingMeta.live) {
                const leftRank = Number(left.ranking);
                const rightRank = Number(right.ranking);
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

    const nationRows = catalogNations
        .map((nation) => {
            const nationId = resolveCatalogNationKey(nation.id);
            if (!nationId) return null;

            const nationName = resolveCatalogNationDisplayName(nationId) || String(nation.name || nationId).trim();
            const treasury = readNationTreasuryForNation(nationId);
            const leadership = readNationLeadershipForNation(nationId);
            const nationRecords = recordsMap[nationId] || recordsMap[String(nationId).toLowerCase()] || null;

            const row = serializeNationAgeRecord({
                nationId,
                nationName,
                treasury,
                leadership,
                nationRecords,
                citiesOwned: citiesOwnedByNation.get(nationId) ?? 0,
                totalCities: totalCitiesByNation.get(nationId) ?? DEFAULT_NATION_TOTAL_CITIES,
                playersInNation: playersInNationByNation.get(nationId) ?? 0,
                resolveNationLeadershipDisplayName
            });

            return row;
        })
        .filter(Boolean)
        .sort((left, right) => left.nationName.localeCompare(right.nationName, undefined, { sensitivity: 'base' }));

    const nations = assignDefaultNationRanks(nationRows);

    return {
        players,
        nations,
        recordsRanking: rankingMeta,
        updatedAt: new Date().toISOString()
    };
}

module.exports = {
    buildAgeRecordsPayload,
    commanderHasJoinedAge,
    normalizePlayerAgeRecords,
    normalizeNationAgeRecords
};

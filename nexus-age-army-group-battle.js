/**
 * NEXUS — Army group assault, one-leader limit, and defeat relocation.
 */
'use strict';

const {
    loadCityCatalog,
    getCatalogCity,
    getCityByIdMap,
    resolveCityHolder,
    validateAssault
} = require('./nexus-age-movement');
const { executeCityAssaultBattleWithLedger } = require('./nexus-age-guild');
const {
    buildAssaultCasualtyContext,
    estimateAssaultCasualtyRisk,
    resolveAssaultCasualtiesForMembers,
    filterEnemyCommandersInCity
} = require('./nexus-age-border-assault-casualty');
const { loadUnitPurchaseCatalog } = require('./nexus-age-recruitment');
const { resolveCommanderAgeArmy, normalizeAgeArmy } = require('./nexus-age-roster');
const {
    applyDismissArmyGroup,
    isMainArmyType,
    findArmyGroupContainingMember,
    findArmyGroupLedBy,
    validateNotAlreadyLeadingGroup
} = require('./nexus-age-army-groups');

const SETTLEMENT_TIER_PRIORITY = Object.freeze({
    kingdom: 5,
    citadel: 4,
    city: 3,
    town: 2,
    village: 1
});

function normalizeUsername(value) {
    return String(value || '').trim().toLowerCase();
}

function countArmyUnits(stacks) {
    return normalizeAgeArmy(stacks).reduce(
        (sum, stack) => sum + Math.max(0, Math.floor(Number(stack?.qty) || 0)),
        0
    );
}

function combineMemberArmies(commanders) {
    const merged = new Map();

    (commanders || []).forEach((commander) => {
        resolveCommanderAgeArmy(commander).forEach((stack) => {
            const key = String(stack.catalogUnitId || stack.name || stack.class || 'unit').trim().toLowerCase();
            const existing = merged.get(key);
            if (!existing) {
                merged.set(key, { ...stack });
                return;
            }
            existing.qty += stack.qty;
            existing.injuredQty = Math.min(
                existing.qty,
                (existing.injuredQty || 0) + (stack.injuredQty || 0)
            );
            if (Array.isArray(stack.unitXpEach) && stack.unitXpEach.length) {
                existing.unitXpEach = [...(existing.unitXpEach || []), ...stack.unitXpEach];
            }
        });
    });

    return normalizeAgeArmy([...merged.values()]);
}

function scaleArmyBySurvivalRatio(army, ratio) {
    const clamped = Math.max(0, Math.min(1, Number(ratio) || 0));
    if (!clamped) {
        return normalizeAgeArmy(army).map((stack) => ({
            ...stack,
            qty: 0,
            injuredQty: 0,
            unitXpEach: []
        })).filter((stack) => stack.qty > 0);
    }

    return normalizeAgeArmy(army).map((stack) => {
        const qty = Math.max(0, Math.floor(Math.floor(Number(stack.qty) || 0) * clamped));
        if (!qty) return null;
        const injuredQty = Math.min(
            qty,
            Math.max(0, Math.floor(Math.floor(Number(stack.injuredQty) || 0) * clamped))
        );
        const unitXpEach = Array.isArray(stack.unitXpEach)
            ? stack.unitXpEach.slice(0, qty)
            : [];
        return { ...stack, qty, injuredQty, unitXpEach };
    }).filter(Boolean);
}

function resolveBattleSurvivalRatio(battleResult) {
    const force = battleResult?.commanderForce;
    if (!force) return 1;
    const start = Math.max(0, Math.floor(Number(force.units) || 0));
    const remaining = Math.max(0, Math.floor(Number(force.unitsRemaining) || 0));
    if (!start) return 0;
    return remaining / start;
}

function applyCasualtiesToMemberArmies(members, survivalRatio) {
    return (members || []).map((entry) => ({
        username: entry.username,
        ageArmy: scaleArmyBySurvivalRatio(entry.army, survivalRatio)
    }));
}

function resolveEnemyHeldCityIds(nationKey, cityHolders, isAlliedFn) {
    const catalog = loadCityCatalog();
    const self = String(nationKey || '').trim().toLowerCase();
    const enemyIds = [];

    (catalog.cities || []).forEach((city) => {
        const holder = resolveCityHolder(city, cityHolders);
        if (!holder || holder === self) return;
        if (typeof isAlliedFn === 'function' && isAlliedFn(self, holder)) return;
        enemyIds.push(city.id);
    });

    return enemyIds;
}

function resolveNationOwnedCityIds(nationKey, cityHolders) {
    const catalog = loadCityCatalog();
    const self = String(nationKey || '').trim().toLowerCase();

    return (catalog.cities || [])
        .filter((city) => resolveCityHolder(city, cityHolders) === self)
        .map((city) => city.id);
}

function computeMinDistancesFromSources(sourceCityIds, cityById) {
    const dist = new Map();
    const queue = [];

    (sourceCityIds || []).forEach((cityId) => {
        if (!cityId || dist.has(cityId)) return;
        dist.set(cityId, 0);
        queue.push(cityId);
    });

    while (queue.length) {
        const id = queue.shift();
        const depth = dist.get(id);
        const city = cityById.get(id);
        if (!city) continue;

        (city.neighbors || []).forEach((neighborId) => {
            if (dist.has(neighborId)) return;
            dist.set(neighborId, depth + 1);
            queue.push(neighborId);
        });
    }

    return dist;
}

function settlementTierScore(city) {
    const tier = String(city?.settlementTier || 'village').trim().toLowerCase();
    return SETTLEMENT_TIER_PRIORITY[tier] || 1;
}

function pickFurthestEvacuationCityId(ownedCityIds, enemyCityIds, cityById) {
    if (!ownedCityIds.length) return '';

    const distances = computeMinDistancesFromSources(enemyCityIds, cityById);
    const scored = ownedCityIds.map((cityId) => {
        const city = cityById.get(cityId);
        const minDist = distances.has(cityId) ? distances.get(cityId) : 9999;
        return {
            cityId,
            minDist,
            tierScore: settlementTierScore(city),
            isVillage: String(city?.settlementTier || '').toLowerCase() === 'village'
        };
    });

    const maxDist = Math.max(...scored.map((entry) => entry.minDist));
    let candidates = scored.filter((entry) => entry.minDist === maxDist);
    const nonVillage = candidates.filter((entry) => !entry.isVillage);
    if (nonVillage.length) {
        candidates = nonVillage;
    }

    candidates.sort((a, b) => {
        if (b.tierScore !== a.tierScore) return b.tierScore - a.tierScore;
        return a.cityId.localeCompare(b.cityId);
    });

    return candidates[0]?.cityId || ownedCityIds[0];
}

function buildScatterRelocation(memberUsernames, ownedCityIds) {
    const assignments = {};
    if (!ownedCityIds.length) {
        (memberUsernames || []).forEach((username) => {
            assignments[normalizeUsername(username)] = '';
        });
        return assignments;
    }

    (memberUsernames || []).forEach((username) => {
        const key = normalizeUsername(username);
        const pick = ownedCityIds[Math.floor(Math.random() * ownedCityIds.length)];
        assignments[key] = pick;
    });

    return assignments;
}

function buildDefeatRelocationPlan(group, nationKey, cityHolders, isAlliedFn) {
    const ownedCityIds = resolveNationOwnedCityIds(nationKey, cityHolders);
    const members = group.memberUsernames.map((username) => normalizeUsername(username));

    if (isMainArmyType(group.type)) {
        const enemyCityIds = resolveEnemyHeldCityIds(nationKey, cityHolders, isAlliedFn);
        const cityById = getCityByIdMap();
        const evacuationCityId = pickFurthestEvacuationCityId(ownedCityIds, enemyCityIds, cityById);
        const assignments = {};
        members.forEach((username) => {
            assignments[username] = evacuationCityId;
        });
        return {
            mode: 'evacuate-together',
            evacuationCityId,
            assignments
        };
    }

    return {
        mode: 'scatter',
        assignments: buildScatterRelocation(members, ownedCityIds)
    };
}

function buildVictoryRelocationPlan(group, targetCityId) {
    const target = String(targetCityId || '').trim();
    const assignments = {};
    group.memberUsernames.forEach((username) => {
        assignments[normalizeUsername(username)] = target;
    });
    return { mode: 'capture', assignments };
}

function buildArmyGroupAssaultCasualtyEstimate({
    memberCommanders,
    targetCity,
    nationKey,
    playersInCity = 1,
    allCommanders = null,
    isAlliedFn = null,
    resolveCommanderCityId = null
}) {
    const catalog = loadUnitPurchaseCatalog();
    const enemyCommanders = filterEnemyCommandersInCity(
        allCommanders || memberCommanders,
        targetCity?.id,
        nationKey,
        isAlliedFn,
        resolveCommanderCityId
    );
    const context = buildAssaultCasualtyContext({
        memberCommanders,
        targetCity,
        enemyCommanders,
        playersInCity,
        catalog,
        commanderRankHint: Math.max(1, Math.floor(Number(leaderCommanderRank(memberCommanders)) || 1))
    });
    const risk = estimateAssaultCasualtyRisk(context);
    return {
        context,
        risk,
        enemyCommanders: enemyCommanders.map((commander) => String(commander.username || '').trim()).filter(Boolean)
    };
}

function leaderCommanderRank(memberCommanders) {
    const leader = (memberCommanders || []).find(Boolean);
    return Math.max(1, Math.floor(Number(leader?.rank) || 1));
}

function prepareArmyGroupAttack({
    state,
    groupId,
    leaderUsername,
    leaderCommander,
    memberCommanders,
    nationKey,
    originCityId,
    targetCityId,
    cityHolders,
    isAlliedFn,
    playersInCity = 1,
    allCommanders = null,
    resolveCommanderCityId = null
}) {
    const self = normalizeUsername(leaderUsername);
    if (!self) {
        return { errorCode: 'NEXUS-GEN-002' };
    }

    const lookup = findArmyGroupContainingMember(state, groupId);
    if (lookup.errorCode) return lookup;

    const { normalized, group } = lookup;
    if (group.leaderUsername !== self) {
        return {
            errorCode: 'NEXUS-AGE-029',
            message: 'Only the army group leader can launch a group attack.'
        };
    }

    const validation = validateAssault(
        nationKey,
        originCityId,
        targetCityId,
        cityHolders,
        isAlliedFn
    );
    if (validation.errorCode) {
        return validation;
    }

    const combinedArmy = combineMemberArmies(memberCommanders);
    if (!countArmyUnits(combinedArmy)) {
        return { errorCode: 'NEXUS-AGE-017' };
    }

    const syntheticCommander = {
        ...leaderCommander,
        ageArmy: combinedArmy
    };

    const battleResult = executeCityAssaultBattleWithLedger(
        syntheticCommander,
        validation.targetCity,
        playersInCity
    );
    if (!battleResult.ok) {
        return battleResult;
    }

    const memberSnapshots = (memberCommanders || []).map((commander) => ({
        username: normalizeUsername(commander?.username),
        army: resolveCommanderAgeArmy(commander)
    }));

    const casualtyEstimate = buildArmyGroupAssaultCasualtyEstimate({
        memberCommanders,
        targetCity: validation.targetCity,
        nationKey,
        playersInCity,
        allCommanders,
        isAlliedFn,
        resolveCommanderCityId
    });
    const casualtyUpdates = resolveAssaultCasualtiesForMembers(
        memberSnapshots,
        casualtyEstimate.risk,
        battleResult,
        casualtyEstimate.context.catalog,
        {
            targetCity: validation.targetCity,
            commanderRank: battleResult.commanderRank
        }
    );
    const assaultVictory = battleResult.winner === 'commander';

    let relocationPlan;
    if (assaultVictory) {
        relocationPlan = buildVictoryRelocationPlan(group, targetCityId);
    } else {
        relocationPlan = buildDefeatRelocationPlan(
            group,
            nationKey,
            cityHolders,
            isAlliedFn
        );
    }

    const dismissResult = applyDismissArmyGroup(normalized, { groupId, username: self });
    if (dismissResult.errorCode) {
        return dismissResult;
    }

    return {
        ok: true,
        normalizedState: dismissResult.state,
        dismissedGroupId: group.id,
        groupType: group.type,
        battleResult,
        assaultVictory,
        relocationPlan,
        casualtyUpdates,
        casualtyRisk: casualtyEstimate.risk,
        casualtyContext: {
            hasEnemyPlayers: casualtyEstimate.context.hasEnemyPlayers,
            enemyCommanderCount: casualtyEstimate.enemyCommanders.length,
            attackerHp: casualtyEstimate.context.attacker.hp,
            defenderHp: casualtyEstimate.context.defender.hp
        },
        targetCity: validation.targetCity,
        connection: validation.connection
    };
}

function prepareArmyGroupDefeatForMember({
    state,
    defeatedUsername,
    nationKey,
    cityHolders,
    isAlliedFn
}) {
    const lookup = findArmyGroupContainingMember(state, null, defeatedUsername);
    if (lookup.errorCode || !lookup.group) {
        return { ok: false, skipped: true };
    }

    const { normalized, group } = lookup;
    const relocationPlan = buildDefeatRelocationPlan(
        group,
        nationKey,
        cityHolders,
        isAlliedFn
    );
    const dismissResult = applyDismissArmyGroup(normalized, {
        groupId: group.id,
        username: group.leaderUsername
    });
    if (dismissResult.errorCode) {
        return dismissResult;
    }

    return {
        ok: true,
        skipped: false,
        normalizedState: dismissResult.state,
        dismissedGroupId: group.id,
        groupType: group.type,
        relocationPlan,
        memberUsernames: group.memberUsernames.map((entry) => normalizeUsername(entry))
    };
}

module.exports = {
    SETTLEMENT_TIER_PRIORITY,
    combineMemberArmies,
    scaleArmyBySurvivalRatio,
    resolveBattleSurvivalRatio,
    applyCasualtiesToMemberArmies,
    resolveNationOwnedCityIds,
    resolveEnemyHeldCityIds,
    pickFurthestEvacuationCityId,
    buildDefeatRelocationPlan,
    buildVictoryRelocationPlan,
    buildArmyGroupAssaultCasualtyEstimate,
    prepareArmyGroupAttack,
    prepareArmyGroupDefeatForMember
};

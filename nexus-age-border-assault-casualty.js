/**
 * NEXUS — Border assault casualty risk (injury/death ranges), not victory odds.
 *
 * Higher displayed injury pressure → wider injury range and higher death sub-range.
 * Resolution skews below the midpoint when pressure is under 50% (deaths rarer than injuries).
 */
'use strict';

const { loadUnitPurchaseCatalog } = require('./nexus-age-recruitment');
const { resolveCommanderAgeArmy, normalizeAgeArmy } = require('./nexus-age-roster');
const { buildBattleArmy } = require('./nexus-age-battle-sim');
const {
    buildCityGarrisonArmy,
    buildHealthyBattleStacks,
    normalizePlayersInCityCount
} = require('./nexus-age-city-battle');
const {
    resolveCommanderInjuryMitigation,
    distributeInjuriesWeighted
} = require('./nexus-age-guild');
const { resolveCommanderGameNationKey } = require('./nexus-age-movement');
const { buildCommanderRankMeta } = require('./nexus-commander-rank-titles');

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
        });
    });

    return normalizeAgeArmy([...merged.values()]);
}

function clampPercent(value) {
    return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function buildPercentRange(min, max) {
    const low = clampPercent(Math.min(min, max));
    const high = clampPercent(Math.max(min, max));
    return {
        min: low,
        max: high,
        label: low === high ? `${low}%` : `${low}–${high}%`
    };
}

function summarizeArmyForce(army, catalog) {
    const stacks = buildHealthyBattleStacks(army);
    const battleArmy = buildBattleArmy('force', stacks, catalog);
    const units = stacks.reduce(
        (sum, stack) => sum + Math.max(0, Math.floor(Number(stack?.qty) || 0)),
        0
    );
    return {
        hp: Math.max(0, Math.round(Number(battleArmy?.startingHp) || 0)),
        units,
        stacks: stacks.length
    };
}

function averageCommanderRank(commanders) {
    const list = Array.isArray(commanders) ? commanders : [];
    if (!list.length) return 1;
    const sum = list.reduce((total, commander) => (
        total + Math.max(1, Math.floor(Number(buildCommanderRankMeta(commander).rank) || 1))
    ), 0);
    return Math.max(1, Math.round(sum / list.length));
}

function averageMitigation(commanders, catalog) {
    const list = Array.isArray(commanders) ? commanders : [];
    if (!list.length) return 0;
    const sum = list.reduce(
        (total, commander) => total + resolveCommanderInjuryMitigation(commander, catalog),
        0
    );
    return sum / list.length;
}

function buildAttackerForceProfile(memberCommanders, catalog) {
    const members = Array.isArray(memberCommanders) ? memberCommanders.filter(Boolean) : [];
    const army = combineMemberArmies(members);
    const force = summarizeArmyForce(army, catalog);
    return {
        army,
        commanders: members.length,
        avgRank: averageCommanderRank(members),
        mitigation: averageMitigation(members, catalog),
        ...force
    };
}

function buildDefenderForceProfile({
    city,
    enemyCommanders,
    playersInCity,
    catalog,
    commanderRankHint = 1
}) {
    const enemies = Array.isArray(enemyCommanders) ? enemyCommanders.filter(Boolean) : [];
    const enemyArmy = combineMemberArmies(enemies);
    const enemyForce = summarizeArmyForce(enemyArmy, catalog);
    const rank = averageCommanderRank(enemies) || commanderRankHint;
    const comrades = normalizePlayersInCityCount(
        enemies.length > 0 ? enemies.length : playersInCity
    );
    const garrison = buildCityGarrisonArmy(catalog, rank, city, comrades);
    const garrisonForce = summarizeArmyForce(garrison, catalog);

    return {
        enemyCommanders: enemies.length,
        playersInCity: comrades,
        garrisonUnits: garrisonForce.units,
        garrisonHp: garrisonForce.hp,
        armyHp: enemyForce.hp,
        armyUnits: enemyForce.units,
        hp: garrisonForce.hp + enemyForce.hp,
        units: garrisonForce.units + enemyForce.units,
        mitigation: averageMitigation(enemies, catalog)
    };
}

function buildAssaultCasualtyContext(options) {
    const catalog = options?.catalog || loadUnitPurchaseCatalog();
    const attacker = buildAttackerForceProfile(options?.memberCommanders, catalog);
    const defender = buildDefenderForceProfile({
        city: options?.targetCity,
        enemyCommanders: options?.enemyCommanders,
        playersInCity: options?.playersInCity,
        catalog,
        commanderRankHint: options?.commanderRankHint || attacker.avgRank
    });

    return {
        catalog,
        attacker,
        defender,
        hasEnemyPlayers: defender.enemyCommanders > 0
    };
}

function estimateAssaultCasualtyRisk(context) {
    const attackerHp = Math.max(1, Number(context?.attacker?.hp) || 1);
    const defenderHp = Math.max(0, Number(context?.defender?.hp) || 0);
    const pressure = Math.min(2.35, Math.max(0.12, defenderHp / attackerHp));

    const mitigation = Math.min(
        0.42,
        Math.max(0, Number(context?.attacker?.mitigation) || 0)
        - Math.max(0, Number(context?.defender?.mitigation) || 0) * 0.35
    );
    const mitigationEase = mitigation * 18;

    let injuryMid = 10 + (pressure / 2.35) * 58 - mitigationEase;
    injuryMid = Math.max(6, Math.min(88, injuryMid));

    const injurySpread = 4 + pressure * 8 + (context?.hasEnemyPlayers ? 3 : 0);
    const injuryMin = clampPercent(injuryMid - injurySpread * 0.58);
    const injuryMax = clampPercent(injuryMid + injurySpread * 0.42);

    const deathRatio = 0.2 + Math.min(0.32, pressure * 0.14);
    let deathMid = injuryMid * deathRatio - mitigationEase * 0.35;
    deathMid = Math.max(2, Math.min(injuryMid * 0.72, deathMid));

    const deathSpread = 2 + pressure * 4;
    const deathMin = clampPercent(deathMid - deathSpread * 0.5);
    const deathMax = clampPercent(Math.min(injuryMax * 0.85, deathMid + deathSpread * 0.45));

    return {
        pressureIndex: Math.round(pressure * 100) / 100,
        injuryPercent: buildPercentRange(injuryMin, injuryMax),
        deathPercent: buildPercentRange(deathMin, Math.max(deathMin, deathMax)),
        injuryMid: Math.round(injuryMid),
        deathMid: Math.round(deathMid),
        summary: buildRiskSummary(injuryMin, injuryMax, deathMin, deathMax)
    };
}

function buildRiskSummary(injuryMin, injuryMax, deathMin, deathMax) {
    const injuryMid = (injuryMin + injuryMax) / 2;
    if (injuryMid >= 50) {
        return 'Heavy casualty pressure — expect substantial injuries and meaningful losses even if you win.';
    }
    if (injuryMid >= 35) {
        return 'Moderate casualty pressure — injuries are likely; deaths are possible.';
    }
    return 'Light casualty pressure — injuries are possible; deaths are less likely.';
}

function resolveRollBias(injuryMid) {
    if (injuryMid >= 50) return 1.05;
    if (injuryMid >= 35) return 0.82;
    return 0.62;
}

function rollPercentInRange(range, biasExponent) {
    const min = clampPercent(range?.min);
    const max = clampPercent(range?.max);
    if (max <= min) return min;
    const t = Math.pow(Math.random(), Math.max(0.35, Number(biasExponent) || 1));
    return min + (max - min) * t;
}

function resolveOutcomePressureMultiplier(winner) {
    if (winner === 'commander') return 0.68;
    if (winner === 'npc') return 1.22;
    return 0.95;
}

function removeUnitsFromArmy(army, unitsToRemove, catalog) {
    let remaining = Math.max(0, Math.floor(Number(unitsToRemove) || 0));
    if (!remaining) return normalizeAgeArmy(army);

    const stacks = normalizeAgeArmy(army).map((stack) => ({ ...stack }));
    for (let index = 0; index < stacks.length && remaining > 0; index += 1) {
        const stack = stacks[index];
        const qty = Math.max(0, Math.floor(Number(stack.qty) || 0));
        const injured = Math.min(qty, Math.max(0, Math.floor(Number(stack.injuredQty) || 0)));
        const healthy = Math.max(0, qty - injured);
        if (!healthy) continue;

        const removed = Math.min(healthy, remaining);
        stack.qty = qty - removed;
        stack.injuredQty = Math.min(stack.qty, injured);
        if (Array.isArray(stack.unitXpEach) && stack.unitXpEach.length) {
            stack.unitXpEach = stack.unitXpEach.slice(0, stack.qty);
        }
        remaining -= removed;
    }

    return normalizeAgeArmy(stacks.filter((stack) => Math.max(0, Number(stack.qty) || 0) > 0));
}

function countHealthyUnits(army) {
    return normalizeAgeArmy(army).reduce((sum, stack) => {
        const qty = Math.max(0, Math.floor(Number(stack.qty) || 0));
        const injured = Math.min(qty, Math.max(0, Math.floor(Number(stack.injuredQty) || 0)));
        return sum + Math.max(0, qty - injured);
    }, 0);
}

function applyPercentCasualtiesToArmy(army, deathPercent, injuryPercent, catalog) {
    const catalogRef = catalog || loadUnitPurchaseCatalog();
    let working = normalizeAgeArmy(army);
    const healthyBefore = countHealthyUnits(working);
    if (!healthyBefore) return working;

    const deaths = Math.min(
        healthyBefore,
        Math.max(0, Math.floor(healthyBefore * (deathPercent / 100)))
    );
    working = removeUnitsFromArmy(working, deaths, catalogRef);

    const healthyAfterDeaths = countHealthyUnits(working);
    const injuries = Math.min(
        healthyAfterDeaths,
        Math.max(0, Math.floor(healthyAfterDeaths * (injuryPercent / 100)))
    );

    if (injuries > 0) {
        working = distributeInjuriesWeighted(working, injuries, catalogRef);
    }

    return working;
}

function resolveAssaultCasualtiesForMembers(memberSnapshots, riskEstimate, battleResult, catalog) {
    const injuryMid = Number(riskEstimate?.injuryMid) || (
        (riskEstimate?.injuryPercent?.min || 0) + (riskEstimate?.injuryPercent?.max || 0)
    ) / 2;
    const bias = resolveRollBias(injuryMid);
    const outcomeMult = resolveOutcomePressureMultiplier(battleResult?.winner);

    const injuryRoll = rollPercentInRange(riskEstimate?.injuryPercent, bias) * outcomeMult;
    const deathRoll = rollPercentInRange(riskEstimate?.deathPercent, Math.max(0.5, bias - 0.12)) * outcomeMult;

    const battleLossRatio = Math.max(0, Math.min(1, 1 - (
        Math.max(0, Number(battleResult?.commanderForce?.unitsRemaining) || 0)
        / Math.max(1, Number(battleResult?.commanderForce?.units) || 1)
    )));

    const injuryPercent = Math.min(95, injuryRoll + battleLossRatio * 8);
    const deathPercent = Math.min(80, deathRoll + battleLossRatio * 12);

    return (memberSnapshots || []).map((entry) => ({
        username: entry.username,
        ageArmy: applyPercentCasualtiesToArmy(
            entry.army,
            deathPercent,
            injuryPercent,
            catalog
        ),
        casualtyRoll: {
            injuryPercent: Math.round(injuryPercent),
            deathPercent: Math.round(deathPercent)
        }
    }));
}

function filterEnemyCommandersInCity(commanders, cityId, attackerNation, isAlliedFn, resolveCommanderCityId) {
    const resolvedCityId = String(cityId || '').trim();
    const attacker = String(attackerNation || '').trim().toLowerCase();
    if (!resolvedCityId || !attacker) return [];

    return (Array.isArray(commanders) ? commanders : []).filter((commander) => {
        const username = String(commander?.username || '').trim();
        if (!username) return false;
        const commanderCityId = typeof resolveCommanderCityId === 'function'
            ? String(resolveCommanderCityId(commander) || '').trim()
            : String(
                commander?.movement?.catalogCityId
                || commander?.catalogCityId
                || ''
            ).trim();
        if (commanderCityId !== resolvedCityId) return false;

        const nation = String(resolveCommanderGameNationKey(commander) || '').trim().toLowerCase();
        if (!nation || nation === attacker) return false;
        if (typeof isAlliedFn === 'function' && isAlliedFn(attacker, nation)) return false;
        return true;
    });
}

module.exports = {
    buildAssaultCasualtyContext,
    estimateAssaultCasualtyRisk,
    resolveAssaultCasualtiesForMembers,
    filterEnemyCommandersInCity,
    buildPercentRange,
    summarizeArmyForce
};

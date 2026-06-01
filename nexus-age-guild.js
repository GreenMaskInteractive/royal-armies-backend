/**
 * NEXUS — Adventurer's Guild training (XP, injuries, healing, rank promotions).
 */
'use strict';

const {
    loadUnitPurchaseCatalog,
    getCatalogUnitById,
    resolveCommanderAgeGold,
    resolveCommanderAgeProvisions,
    AGE_COMMANDER_PROVISIONS_DEFAULT
} = require('./nexus-age-recruitment');
const {
    normalizeAgeArmy,
    resolveCommanderAgeArmy,
    countAgeArmyUnits,
    buildAgeRosterHudPayload
} = require('./nexus-age-roster');
const { executeGuildTrainingBattle } = require('./nexus-age-battle-sim');
const { resolveTrainingModeAvailability } = require('./nexus-age-guild-hub');
const {
    calculateGuildTrainingBattleXp,
    appendGuildTrainingXpLogLines,
    calculateCityBattleGuildXp,
    calculatePvpBattleGuildXp,
    appendBattleXpLogLines,
    appendPvpBattleXpLogLines
} = require('./nexus-age-guild-xp');
const { executeCityAssaultBattle } = require('./nexus-age-city-battle');
const {
    buildCommanderGearPanelPayload,
    buildCommanderEquipmentBonuses,
    commanderHasAcquiredGear
} = require('./nexus-age-commander-gear');
const {
    distributeTrainingUnitXp,
    scanArmyReadyToPromote,
    buildUnitEvolutionPayload,
    executeUnitRankPromotion,
    executeUnitTierEvolution,
    swapRandomHealthyUnitToInjured,
    swapRandomInjuredUnitToHealthy
} = require('./nexus-age-unit-xp');
const { recordBalanceEvent } = require('./nexus-balance-monitor');

const TRADE_CONVOY_LOTS = Object.freeze([
    { id: 'guild-spice-crate', label: 'Spice Crate', costGold: 2400, resaleGold: 3120 },
    { id: 'guild-silk-bale', label: 'Silk Bale', costGold: 4200, resaleGold: 5460 },
    { id: 'guild-iron-ingots', label: 'Iron Ingots', costGold: 1800, resaleGold: 2340 }
]);

function normalizeGuildMerch(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const id = String(entry.id || '').trim().slice(0, 64);
        const label = String(entry.label || 'Merchandise').trim().slice(0, 80);
        const qty = Math.max(0, Math.floor(Number(entry.qty) || 0));
        const resaleGold = Math.max(0, Math.floor(Number(entry.resaleGold) || 0));
        if (!id || !qty) return null;
        return { id, label, qty, resaleGold };
    }).filter(Boolean);
}

function buildGuildMerchPayload(commander) {
    return {
        ageGuildMerch: normalizeGuildMerch(commander?.ageGuildMerch),
        tradeConvoyLots: TRADE_CONVOY_LOTS.map((lot) => ({ ...lot }))
    };
}

const HEAL_COST_MULTIPLIER_BY_RANK = {
    1: 1,
    2: 1,
    3: 1.015,
    4: 1.02,
    5: 1.03,
    6: 1.05
};

const RANK_UP_PROVISIONS_BY_NEW_RANK = Object.freeze([
    { maxRank: 4, grant: 55 },
    { maxRank: 7, grant: 70 },
    { maxRank: 10, grant: 85 },
    { maxRank: 14, grant: 95 },
    { maxRank: 21, grant: 105 }
]);
const MAX_COMMANDER_RANK = 22;

const GUILD_XP_BY_OUTCOME = Object.freeze({
    commander: 36,
    draw: 18,
    npc: 10
});

/** @deprecated Use TRAINING_DRILL_OUTCOME_BASE in nexus-age-guild-xp for solo drills. */

const STREET_PATROL_LOOT_TABLE = Object.freeze([
    { label: 'You found a silver bracelet', goldMin: 85, goldMax: 120 },
    { label: 'You recovered a dropped coin pouch', goldMin: 42, goldMax: 78 },
    { label: 'You seized contraband from a pickpocket', goldMin: 65, goldMax: 110 },
    { label: 'You collected a guild reward stipend', goldMin: 55, goldMax: 95 },
    { label: 'You found a bent gold signet ring', goldMin: 96, goldMax: 145 }
]);

function rollInteger(minValue, maxValue) {
    const min = Math.floor(Number(minValue) || 0);
    const max = Math.floor(Number(maxValue) || min);
    if (max <= min) return min;
    return min + Math.floor(Math.random() * (max - min + 1));
}

function resolveTrainingBattleLoot(trainingMode, winner) {
    if (winner !== 'commander') {
        return { lootEntries: [], lootGoldTotal: 0 };
    }

    const mode = String(trainingMode || 'street-patrol').trim().toLowerCase();
    if (mode !== 'street-patrol') {
        return { lootEntries: [], lootGoldTotal: 0 };
    }

    if (Math.random() > 0.58) {
        return { lootEntries: [], lootGoldTotal: 0 };
    }

    const template = STREET_PATROL_LOOT_TABLE[Math.floor(Math.random() * STREET_PATROL_LOOT_TABLE.length)];
    const gold = rollInteger(template.goldMin, template.goldMax);
    return {
        lootEntries: [{ label: template.label, gold }],
        lootGoldTotal: gold
    };
}

const PVP_STACK_INJURY_WEIGHT = 2.25;

/**
 * Cumulative injury roll thresholds [p0, p1, p2, p3, p4] at anchor ranks.
 * Rank 1 ≈ 94% none / 5% one / 0.5% two; each promotion nudges toward rank-22 values.
 */
const TRAINING_INJURY_RANK_ANCHORS = [
    { rank: 1, thresholds: [0.940, 0.995, 1.000, 1.000, 1.000] },
    { rank: 6, thresholds: [0.915, 0.988, 0.998, 1.000, 1.000] },
    { rank: 10, thresholds: [0.875, 0.968, 0.990, 0.998, 1.000] },
    { rank: 14, thresholds: [0.700, 0.900, 0.975, 0.992, 1.000] },
    { rank: 18, thresholds: [0.480, 0.760, 0.915, 0.970, 1.000] },
    { rank: 22, thresholds: [0.300, 0.650, 0.870, 0.970, 1.000] }
];

/** Defeat with zero rolled injuries → chance of forcing one injury (rank 1 ≈ 38%). */
const DEFEAT_ZERO_TO_ONE_ANCHORS = [
    { rank: 1, value: 0.38 },
    { rank: 6, value: 0.42 },
    { rank: 10, value: 0.50 },
    { rank: 14, value: 0.62 },
    { rank: 18, value: 0.76 },
    { rank: 22, value: 0.90 }
];

/** Expected extra injuries on defeat when the base roll already injured someone. */
const DEFEAT_EXTRA_WHEN_HIT_ANCHORS = [
    { rank: 1, value: 0 },
    { rank: 6, value: 0 },
    { rank: 10, value: 0.35 },
    { rank: 14, value: 1.0 },
    { rank: 18, value: 1.45 },
    { rank: 22, value: 2.0 }
];

/** Draw outcome: chance of +1 injury (scales gently with rank). */
const DRAW_EXTRA_INJURY_ANCHORS = [
    { rank: 1, value: 0.28 },
    { rank: 10, value: 0.32 },
    { rank: 22, value: 0.40 }
];

/** Border patrol: chance of +1 injury when any injuries rolled (scales with rank). */
const BORDER_PATROL_EXTRA_INJURY_ANCHORS = [
    { rank: 1, value: 0.32 },
    { rank: 14, value: 0.38 },
    { rank: 22, value: 0.46 }
];

function lerpNumber(from, to, t) {
    return from + ((to - from) * t);
}

function resolveAnchoredScalar(anchors, rank) {
    const commanderRank = Math.max(1, Math.min(MAX_COMMANDER_RANK, Math.floor(Number(rank) || 1)));
    if (!anchors.length) return 0;
    if (commanderRank <= anchors[0].rank) return anchors[0].value;
    for (let index = 0; index < anchors.length - 1; index += 1) {
        const lo = anchors[index];
        const hi = anchors[index + 1];
        if (commanderRank <= hi.rank) {
            const span = hi.rank - lo.rank;
            const t = span > 0 ? (commanderRank - lo.rank) / span : 0;
            return lerpNumber(lo.value, hi.value, t);
        }
    }
    return anchors[anchors.length - 1].value;
}

function resolveTrainingInjuryThresholds(rank) {
    const commanderRank = Math.max(1, Math.min(MAX_COMMANDER_RANK, Math.floor(Number(rank) || 1)));
    if (commanderRank <= TRAINING_INJURY_RANK_ANCHORS[0].rank) {
        return [...TRAINING_INJURY_RANK_ANCHORS[0].thresholds];
    }
    for (let index = 0; index < TRAINING_INJURY_RANK_ANCHORS.length - 1; index += 1) {
        const lo = TRAINING_INJURY_RANK_ANCHORS[index];
        const hi = TRAINING_INJURY_RANK_ANCHORS[index + 1];
        if (commanderRank <= hi.rank) {
            const span = hi.rank - lo.rank;
            const t = span > 0 ? (commanderRank - lo.rank) / span : 0;
            return lo.thresholds.map((value, thresholdIndex) => (
                lerpNumber(value, hi.thresholds[thresholdIndex], t)
            ));
        }
    }
    return [...TRAINING_INJURY_RANK_ANCHORS[TRAINING_INJURY_RANK_ANCHORS.length - 1].thresholds];
}

function sampleExpectedExtra(expectedExtra) {
    const extra = Math.max(0, Number(expectedExtra) || 0);
    const base = Math.floor(extra);
    const fractional = extra - base;
    return base + (Math.random() < fractional ? 1 : 0);
}

function resolveCommanderRank(commander) {
    return Math.max(1, Math.min(MAX_COMMANDER_RANK, Math.floor(Number(commander?.rank) || 1)));
}

function resolveGuildXp(commander) {
    return Math.max(0, Math.floor(Number(commander?.ageGuildXp) || 0));
}

function resolveGuildXpRequired(rank) {
    const r = Math.max(1, Math.floor(Number(rank) || 1));
    return 70 + (r * 25);
}

function resolveRankUpProvisionsGrant(newRank) {
    if (newRank <= 1 || newRank > 21) return 0;
    const normalized = Math.max(2, Math.floor(Number(newRank) || 2));
    const bucket = RANK_UP_PROVISIONS_BY_NEW_RANK.find((entry) => normalized <= entry.maxRank);
    return Math.max(0, Math.floor(Number(bucket?.grant) || 0));
}

function buildGuildProgressPayload(commander) {
    const rank = resolveCommanderRank(commander);
    const xp = resolveGuildXp(commander);
    const xpRequired = rank >= MAX_COMMANDER_RANK ? 0 : resolveGuildXpRequired(rank);

    return {
        rank,
        ageGuildXp: xp,
        ageGuildXpRequired: xpRequired,
        ageGuildXpProgress: xpRequired > 0 ? Math.min(1, xp / xpRequired) : 1,
        rankAtMax: rank >= MAX_COMMANDER_RANK
    };
}

function buildGuildRosterPayload(commander) {
    const army = resolveCommanderAgeArmy(commander);
    const counts = countAgeArmyUnits(army);
    const total = counts.total;
    const uninjured = counts.uninjured;

    return {
        ageArmy: army,
        unitsTotal: total,
        unitsUninjured: uninjured,
        unitsInjured: counts.injured,
        unitsHealthProgress: total > 0 ? uninjured / total : 1
    };
}

function buildGuildStatePayload(commander) {
    const roster = buildGuildRosterPayload(commander);
    const progress = buildGuildProgressPayload(commander);
    const merch = buildGuildMerchPayload(commander);
    const commanderGear = buildCommanderGearPanelPayload(commander);

    return {
        ...progress,
        ...roster,
        ...merch,
        commanderGear,
        ageGold: resolveCommanderAgeGold(commander),
        ageProvisions: resolveCommanderAgeProvisions(commander),
        ageGuildAcceptedBountyId: String(commander?.ageGuildAcceptedBountyId || '').trim() || null
    };
}

function distributeInjuries(army, injuryCount) {
    const next = normalizeAgeArmy(army);
    let remaining = Math.max(0, Math.floor(Number(injuryCount) || 0));
    if (!remaining) return next;

    next.forEach((stack) => {
        if (!remaining) return;
        const qty = Math.max(0, Math.floor(Number(stack.qty) || 0));
        const injured = Math.min(qty, Math.max(0, Math.floor(Number(stack.injuredQty) || 0)));
        const healthy = Math.max(0, qty - injured);
        const apply = Math.min(remaining, healthy);
        if (!apply) return;
        stack.injuredQty = injured + apply;
        remaining -= apply;
    });

    return normalizeAgeArmy(next);
}

function isStackPvpUnit(catalog, stack) {
    const unit = getCatalogUnitById(catalog, stack?.catalogUnitId);
    if (!unit) return false;
    return String(unit.unitRole || '').trim().toLowerCase() === 'pvp';
}

function distributeInjuriesWeighted(army, injuryCount, catalog) {
    const next = normalizeAgeArmy(army);
    let remaining = Math.max(0, Math.floor(Number(injuryCount) || 0));
    if (!remaining) return next;

    const catalogRef = catalog || loadUnitPurchaseCatalog();

    while (remaining > 0) {
        const weighted = [];
        let totalWeight = 0;

        next.forEach((stack, index) => {
            const qty = Math.max(0, Math.floor(Number(stack.qty) || 0));
            const injured = Math.min(qty, Math.max(0, Math.floor(Number(stack.injuredQty) || 0)));
            const healthy = Math.max(0, qty - injured);
            if (!healthy) return;

            const weight = healthy * (isStackPvpUnit(catalogRef, stack) ? PVP_STACK_INJURY_WEIGHT : 1);
            weighted.push({ index, weight });
            totalWeight += weight;
        });

        if (!totalWeight) break;

        let roll = Math.random() * totalWeight;
        let picked = weighted[weighted.length - 1];
        for (let i = 0; i < weighted.length; i += 1) {
            roll -= weighted[i].weight;
            if (roll <= 0) {
                picked = weighted[i];
                break;
            }
        }

        const stack = next[picked.index];
        next[picked.index] = swapRandomHealthyUnitToInjured(stack);
        remaining -= 1;
    }

    return normalizeAgeArmy(next);
}

function resolveArmyQualityMitigation(army, catalog) {
    const stacks = normalizeAgeArmy(army);
    let qtySum = 0;
    let tierSum = 0;
    let rankSum = 0;

    stacks.forEach((stack) => {
        const qty = Math.max(0, Math.floor(Number(stack.qty) || 0));
        if (!qty) return;
        const unit = getCatalogUnitById(catalog, stack.catalogUnitId);
        const tier = Math.max(1, Math.floor(Number(unit?.tier ?? stack.tier) || 1));
        const rank = Math.max(1, Math.min(6, Math.floor(Number(stack.rank) || 1)));
        qtySum += qty;
        tierSum += tier * qty;
        rankSum += rank * qty;
    });

    if (!qtySum) return 0;

    const avgTier = tierSum / qtySum;
    const avgRank = rankSum / qtySum;
    return Math.min(0.22, ((avgRank - 1) / 5) * 0.14 + ((avgTier - 1) / 2) * 0.10);
}

function resolveCommanderInjuryMitigation(commander, catalog) {
    const army = resolveCommanderAgeArmy(commander);
    let mitigation = resolveArmyQualityMitigation(army, catalog);

    const bonuses = commander?.ageGuildBonuses;
    if (bonuses && typeof bonuses === 'object') {
        mitigation += Math.max(0, Number(bonuses.injuryMitigation) || 0);
    }

    const equipment = commanderHasAcquiredGear(commander)
        ? buildCommanderEquipmentBonuses(commander)
        : null;
    if (equipment && typeof equipment === 'object') {
        mitigation += Math.max(0, Number(equipment.injuryMitigation) || 0);
    }

    const legacyEquipment = commander?.ageEquipment;
    if (legacyEquipment && typeof legacyEquipment === 'object') {
        mitigation += Math.max(0, Number(legacyEquipment.injuryMitigation) || 0);
    }

    const banner = commander?.ageBannerPerks;
    if (banner && typeof banner === 'object') {
        mitigation += Math.max(0, Number(banner.injuryMitigation) || 0);
    }

    return Math.min(0.48, Math.max(0, mitigation));
}

function rollInjuryCountFromBand(thresholds, mitigation) {
    const shift = Math.min(0.18, mitigation * 0.35);
    const r = Math.random();
    if (r < thresholds[0] + shift) return 0;
    if (r < thresholds[1] + shift) return 1;
    if (r < thresholds[2] + shift) return 2;
    if (r < thresholds[3] + shift) return 3;
    return 4;
}

function resolveBattleInjuryCount(commander, battleResult, trainingMode = 'street-patrol', catalog) {
    const catalogRef = catalog || loadUnitPurchaseCatalog();
    const rosterBefore = countAgeArmyUnits(resolveCommanderAgeArmy(commander));
    const healthyBefore = rosterBefore.uninjured;
    if (!healthyBefore) return 0;

    const rank = resolveCommanderRank(commander);
    const mitigation = resolveCommanderInjuryMitigation(commander, catalogRef);
    const thresholds = resolveTrainingInjuryThresholds(rank);
    let injuryCount = rollInjuryCountFromBand(thresholds, mitigation);

    if (battleResult.winner === 'npc') {
        if (injuryCount === 0) {
            const zeroToOneChance = resolveAnchoredScalar(DEFEAT_ZERO_TO_ONE_ANCHORS, rank);
            injuryCount = Math.random() < zeroToOneChance ? 1 : 0;
        } else {
            const extra = sampleExpectedExtra(resolveAnchoredScalar(DEFEAT_EXTRA_WHEN_HIT_ANCHORS, rank));
            injuryCount = Math.min(healthyBefore, injuryCount + extra);
        }
    } else if (battleResult.winner === 'draw') {
        const drawExtraChance = resolveAnchoredScalar(DRAW_EXTRA_INJURY_ANCHORS, rank);
        injuryCount = Math.min(healthyBefore, injuryCount + (Math.random() < drawExtraChance ? 1 : 0));
    }

    if (trainingMode === 'border-patrol' && injuryCount > 0) {
        const borderExtraChance = resolveAnchoredScalar(BORDER_PATROL_EXTRA_INJURY_ANCHORS, rank);
        injuryCount = Math.min(healthyBefore, injuryCount + (Math.random() < borderExtraChance ? 1 : 0));
    }

    if (injuryCount > 0 && mitigation > 0) {
        const reductionRoll = mitigation + (resolveArmyQualityMitigation(resolveCommanderAgeArmy(commander), catalogRef) * 0.5);
        if (Math.random() < Math.min(0.72, reductionRoll)) {
            injuryCount = Math.max(0, injuryCount - 1);
        }
    }

    return Math.min(healthyBefore, Math.max(0, injuryCount));
}

function resolveStackHealCost(catalog, stack) {
    const unit = getCatalogUnitById(catalog, stack?.catalogUnitId);
    if (!unit) return 0;

    const baseGold = Math.max(0, Math.floor(Number(unit.goldCost) || 0));
    if (!baseGold) return 0;

    const rank = Math.max(1, Math.min(6, Math.floor(Number(stack.rank) || 1)));
    const multiplier = HEAL_COST_MULTIPLIER_BY_RANK[rank] || 1;
    return Math.max(1, Math.ceil(baseGold * multiplier));
}

function findNextInjuredStack(army, catalog) {
    const stacks = normalizeAgeArmy(army);
    for (let index = 0; index < stacks.length; index += 1) {
        const stack = stacks[index];
        const qty = Math.max(0, Math.floor(Number(stack.qty) || 0));
        const injured = Math.min(qty, Math.max(0, Math.floor(Number(stack.injuredQty) || 0)));
        if (injured <= 0) continue;

        const cost = resolveStackHealCost(catalog, stack);
        if (!cost) continue;

        return { index, stack, cost };
    }
    return null;
}

function healOneInjuredUnit(army, catalog, availableGold) {
    const stacks = normalizeAgeArmy(army);
    const target = findNextInjuredStack(stacks, catalog);
    if (!target) {
        return { ok: false, errorCode: 'NEXUS-AGE-019' };
    }
    if (availableGold < target.cost) {
        return { ok: false, errorCode: 'NEXUS-AGE-011' };
    }

    stacks[target.index] = swapRandomInjuredUnitToHealthy(target.stack);

    return {
        ok: true,
        ageArmy: normalizeAgeArmy(stacks),
        goldSpent: target.cost,
        healedStack: target.stack.catalogUnitId || target.stack.name,
        healCost: target.cost
    };
}

function healAllInjuredUnits(army, catalog, availableGold) {
    let goldSpent = 0;
    let healedCount = 0;
    let stacks = normalizeAgeArmy(army);
    let goldLeft = Math.max(0, Math.floor(Number(availableGold) || 0));

    while (goldLeft > 0) {
        const result = healOneInjuredUnit(stacks, catalog, goldLeft);
        if (!result.ok) break;
        stacks = result.ageArmy;
        goldSpent += result.goldSpent;
        goldLeft -= result.goldSpent;
        healedCount += 1;
    }

    if (!healedCount) {
        const probe = findNextInjuredStack(stacks, catalog);
        if (!probe) return { ok: false, errorCode: 'NEXUS-AGE-019' };
        return { ok: false, errorCode: 'NEXUS-AGE-011' };
    }

    return {
        ok: true,
        ageArmy: stacks,
        goldSpent,
        healedCount
    };
}

function applyGuildRankXp(commander, xpGain) {
    const rank = resolveCommanderRank(commander);
    if (rank >= MAX_COMMANDER_RANK) {
        return {
            rank,
            ageGuildXp: resolveGuildXp(commander),
            ageGuildXpRequired: 0,
            rankPromoted: false,
            provisionsGranted: 0,
            promotions: []
        };
    }

    let nextRank = rank;
    let xpPool = resolveGuildXp(commander) + Math.max(0, Math.floor(Number(xpGain) || 0));
    let provisionsGranted = 0;
    const promotions = [];

    while (nextRank < MAX_COMMANDER_RANK) {
        const required = resolveGuildXpRequired(nextRank);
        if (xpPool < required) break;

        xpPool -= required;
        const previousRank = nextRank;
        nextRank += 1;
        const grant = resolveRankUpProvisionsGrant(nextRank);
        provisionsGranted += grant;
        promotions.push({ fromRank: previousRank, toRank: nextRank, provisionsGranted: grant });
    }

    return {
        rank: nextRank,
        ageGuildXp: xpPool,
        ageGuildXpRequired: nextRank >= MAX_COMMANDER_RANK ? 0 : resolveGuildXpRequired(nextRank),
        rankPromoted: promotions.length > 0,
        provisionsGranted,
        promotions
    };
}

function executeGuildTrainingBattleWithLedger(commander, trainingMode = 'street-patrol', settlementTier = 'village') {
    const modeCheck = resolveTrainingModeAvailability(commander, settlementTier, trainingMode);
    if (!modeCheck.ok) return modeCheck;

    const catalog = loadUnitPurchaseCatalog();
    const battle = executeGuildTrainingBattle(commander, trainingMode);
    if (!battle.ok) return battle;

    const injuryMitigation = resolveCommanderInjuryMitigation(commander, catalog);
    const injuryCount = resolveBattleInjuryCount(commander, battle, trainingMode, catalog);
    const preArmy = resolveCommanderAgeArmy(commander);
    const unitXpResult = distributeTrainingUnitXp(battle, preArmy, catalog, trainingMode);
    const nextArmy = distributeInjuriesWeighted(
        unitXpResult.ageArmy,
        injuryCount,
        catalog
    );
    const unitsReadyToPromote = scanArmyReadyToPromote(nextArmy, catalog);
    if (Array.isArray(battle.log) && unitXpResult.unitXpLogLines?.length) {
        battle.log.push('— Unit experience —');
        unitXpResult.unitXpLogLines.forEach((line) => battle.log.push(line));
    }
    const xpCalc = calculateGuildTrainingBattleXp(battle, trainingMode, commander);
    const xpGain = xpCalc.xpGain;
    if (Array.isArray(battle.log)) {
        appendGuildTrainingXpLogLines(battle.log, xpCalc);
    }
    const xpResult = applyGuildRankXp(commander, xpGain);

    const nextProvisions = Math.max(
        0,
        Math.floor(Number(resolveCommanderAgeProvisions(commander)) || AGE_COMMANDER_PROVISIONS_DEFAULT)
            + xpResult.provisionsGranted
    );

    const roster = buildAgeRosterHudPayload({
        ...commander,
        ageArmy: nextArmy
    });

    const lootResult = resolveTrainingBattleLoot(trainingMode, battle.winner);
    const nextGold = Math.max(
        0,
        Math.floor(Number(resolveCommanderAgeGold(commander)) || 0) + lootResult.lootGoldTotal
    );

    const commanderGear = buildCommanderGearPanelPayload({
        ...commander,
        rank: xpResult.rank,
        ageArmy: nextArmy
    });

    recordBalanceEvent('rank-progression', {
        source: 'guild-training',
        username: String(commander?.username || '').trim() || null,
        rankBefore: resolveCommanderRank(commander),
        rankAfter: xpResult.rank,
        promotionsCount: Array.isArray(xpResult.promotions) ? xpResult.promotions.length : 0,
        provisionsGranted: xpResult.provisionsGranted,
        ageProvisionsAfter: nextProvisions
    });
    recordBalanceEvent('training-battle', {
        source: 'guild-training',
        username: String(commander?.username || '').trim() || null,
        trainingMode: String(trainingMode || 'street-patrol').trim().toLowerCase(),
        winner: String(battle?.winner || ''),
        xpGain,
        injuriesApplied: injuryCount
    });

    return {
        ok: true,
        ...battle,
        xpGain,
        xpBreakdown: xpCalc.xpBreakdown,
        commanderGear,
        lootEntries: lootResult.lootEntries,
        lootGoldTotal: lootResult.lootGoldTotal,
        ageGold: nextGold,
        injuriesApplied: injuryCount,
        injuryMitigation,
        ageArmy: nextArmy,
        rank: xpResult.rank,
        ageGuildXp: xpResult.ageGuildXp,
        ageGuildXpRequired: xpResult.ageGuildXpRequired,
        ageGuildXpProgress: xpResult.ageGuildXpRequired > 0
            ? Math.min(1, xpResult.ageGuildXp / xpResult.ageGuildXpRequired)
            : 1,
        rankPromoted: xpResult.rankPromoted,
        rankPromotions: xpResult.promotions,
        provisionsGranted: xpResult.provisionsGranted,
        ageProvisions: nextProvisions,
        unitXpGains: unitXpResult.unitXpGains,
        unitsReadyToPromote,
        unitsReadyToPromoteCount: unitsReadyToPromote.length,
        unitsTotal: roster.unitsTotal,
        unitsUninjured: roster.unitsUninjured,
        unitsInjured: roster.unitsTotal - roster.unitsUninjured,
        unitsHealthProgress: roster.unitsTotal > 0 ? roster.unitsUninjured / roster.unitsTotal : 1
    };
}

function executeCityAssaultBattleWithLedger(commander, city, playersInCity = 1) {
    const battle = executeCityAssaultBattle(commander, city, playersInCity);
    if (!battle.ok) return battle;

    const xpCalc = calculateCityBattleGuildXp(battle, {
        battleRole: 'assault',
        playersInCity: battle.playersInCity
    });

    if (Array.isArray(battle.log)) {
        appendBattleXpLogLines(battle.log, xpCalc, 'city-battle');
    }

    const xpResult = applyGuildRankXp(commander, xpCalc.xpGain);

    recordBalanceEvent('rank-progression', {
        source: 'city-assault',
        username: String(commander?.username || '').trim() || null,
        rankBefore: resolveCommanderRank(commander),
        rankAfter: xpResult.rank,
        promotionsCount: Array.isArray(xpResult.promotions) ? xpResult.promotions.length : 0,
        provisionsGranted: xpResult.provisionsGranted
    });

    return {
        ok: true,
        ...battle,
        xpGain: xpCalc.xpGain,
        xpBreakdown: xpCalc.xpBreakdown,
        rank: xpResult.rank,
        ageGuildXp: xpResult.ageGuildXp,
        ageGuildXpRequired: xpResult.ageGuildXpRequired,
        ageGuildXpProgress: xpResult.ageGuildXpRequired > 0
            ? Math.min(1, xpResult.ageGuildXp / xpResult.ageGuildXpRequired)
            : 1,
        rankPromoted: xpResult.rankPromoted,
        rankPromotions: xpResult.promotions,
        provisionsGranted: xpResult.provisionsGranted
    };
}

function executeGuildHeal(commander, mode) {
    const catalog = loadUnitPurchaseCatalog();
    const army = resolveCommanderAgeArmy(commander);
    const gold = resolveCommanderAgeGold(commander);
    const healMode = String(mode || 'one').trim().toLowerCase();

    const result = healMode === 'all'
        ? healAllInjuredUnits(army, catalog, gold)
        : healOneInjuredUnit(army, catalog, gold);

    if (!result.ok) return result;

    const nextGold = gold - result.goldSpent;
    const roster = buildAgeRosterHudPayload({ ...commander, ageArmy: result.ageArmy });

    return {
        ok: true,
        mode: healMode,
        goldSpent: result.goldSpent,
        healedCount: result.healedCount || 1,
        ageGold: nextGold,
        ageArmy: result.ageArmy,
        unitsTotal: roster.unitsTotal,
        unitsUninjured: roster.unitsUninjured,
        unitsInjured: roster.unitsTotal - roster.unitsUninjured,
        unitsHealthProgress: roster.unitsTotal > 0 ? roster.unitsUninjured / roster.unitsTotal : 1
    };
}

function executeTradeConvoyPurchase(commander, lotId) {
    const lot = TRADE_CONVOY_LOTS.find((entry) => entry.id === String(lotId || '').trim());
    if (!lot) {
        return { ok: false, errorCode: 'NEXUS-GEN-002' };
    }

    const gold = resolveCommanderAgeGold(commander);
    if (gold < lot.costGold) {
        return { ok: false, errorCode: 'NEXUS-AGE-011' };
    }

    const merch = normalizeGuildMerch(commander?.ageGuildMerch);
    const existing = merch.find((entry) => entry.id === lot.id);
    if (existing) {
        existing.qty += 1;
    } else {
        merch.push({
            id: lot.id,
            label: lot.label,
            qty: 1,
            resaleGold: lot.resaleGold
        });
    }

    return {
        ok: true,
        lot,
        goldSpent: lot.costGold,
        ageGold: gold - lot.costGold,
        ageGuildMerch: merch
    };
}

module.exports = {
    HEAL_COST_MULTIPLIER_BY_RANK,
    GUILD_XP_BY_OUTCOME,
    TRADE_CONVOY_LOTS,
    resolveGuildXpRequired,
    buildGuildStatePayload,
    executeGuildTrainingBattleWithLedger,
    executeCityAssaultBattleWithLedger,
    executeGuildHeal,
    executeTradeConvoyPurchase,
    calculatePvpBattleGuildXp,
    appendPvpBattleXpLogLines,
    resolveStackHealCost,
    resolveCommanderInjuryMitigation,
    resolveBattleInjuryCount,
    distributeInjuries,
    distributeInjuriesWeighted,
    buildUnitEvolutionPayload,
    executeUnitRankPromotion,
    executeUnitTierEvolution
};

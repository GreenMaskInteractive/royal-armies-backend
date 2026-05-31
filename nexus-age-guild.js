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

const RANK_UP_PROVISIONS = 110;
const MAX_COMMANDER_RANK = 22;

const GUILD_XP_BY_OUTCOME = {
    commander: 36,
    draw: 18,
    npc: 10
};

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
    return RANK_UP_PROVISIONS;
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

    return {
        ...progress,
        ...roster,
        ...merch,
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

    stacks[target.index] = {
        ...target.stack,
        injuredQty: Math.max(0, Math.floor(Number(target.stack.injuredQty) || 0) - 1)
    };

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

function resolveBattleInjuryCount(commander, battleResult) {
    const rosterBefore = countAgeArmyUnits(resolveCommanderAgeArmy(commander));
    const healthyBefore = rosterBefore.uninjured;
    if (!healthyBefore) return 0;

    const startUnits = Math.max(0, Math.floor(Number(battleResult.commanderUnits) || 0));
    const endUnits = Math.max(0, Math.floor(Number(battleResult.commanderUnitsRemaining) || 0));
    if (!startUnits) return 0;

    const simulatedLoss = Math.max(0, startUnits - endUnits);
    if (battleResult.winner === 'commander') {
        return Math.min(healthyBefore, Math.max(1, Math.floor(simulatedLoss * 0.35)));
    }
    if (battleResult.winner === 'npc') {
        return Math.min(healthyBefore, Math.max(1, Math.floor(simulatedLoss * 0.65)));
    }
    return Math.min(healthyBefore, Math.max(0, Math.floor(simulatedLoss * 0.45)));
}

function executeGuildTrainingBattleWithLedger(commander, trainingMode = 'street-patrol', settlementTier = 'village') {
    const modeCheck = resolveTrainingModeAvailability(commander, settlementTier, trainingMode);
    if (!modeCheck.ok) return modeCheck;

    const battle = executeGuildTrainingBattle(commander, trainingMode);
    if (!battle.ok) return battle;

    const injuryCount = resolveBattleInjuryCount(commander, battle);
    const nextArmy = distributeInjuries(resolveCommanderAgeArmy(commander), injuryCount);
    const xpGain = GUILD_XP_BY_OUTCOME[battle.winner] || GUILD_XP_BY_OUTCOME.draw;
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

    return {
        ok: true,
        ...battle,
        xpGain,
        injuriesApplied: injuryCount,
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
        unitsTotal: roster.unitsTotal,
        unitsUninjured: roster.unitsUninjured,
        unitsInjured: roster.unitsTotal - roster.unitsUninjured,
        unitsHealthProgress: roster.unitsTotal > 0 ? roster.unitsUninjured / roster.unitsTotal : 1
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
    executeGuildHeal,
    executeTradeConvoyPurchase,
    resolveStackHealCost,
    distributeInjuries
};

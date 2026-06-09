/**
 * NEXUS — Age barracks unit recruitment (catalog validation + ledger updates).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const {
    normalizeAgeArmy,
    resolveCommanderAgeArmy,
    buildAgeRosterHudPayload,
    normalizeUnitXpEachSlots
} = require('./nexus-age-roster');
const { recordBalanceEvent } = require('./nexus-balance-monitor');

const CATALOG_PATH = path.join(__dirname, 'public', 'data', 'unit-purchase-catalog.json');
const AGE_COMMANDER_GOLD_DEFAULT = 20000;
const AGE_COMMANDER_PROVISIONS_DEFAULT = 132;
const MAX_RECRUIT_QUANTITY_DEFAULT = 15;
const SWARM_RECRUIT_BATCH_CEILING_DEFAULT = 999;
const FOUR_TIER_UNLOCK_RANKS = [1, 7, 14, 18];
const EXTENDED_UNLOCK_RANKS = [1, 7, 14, 18, 20, 21, 22];
const CLASS_BY_PATH = {
    Physical: 'battlemaster',
    Magic: 'battlemage'
};
const PROMOTION_RANK = {
    app: 1,
    std: 2,
    vet: 3,
    mst: 4,
    leg: 5,
    elite: 6
};

let catalogCache = null;

function loadUnitPurchaseCatalog() {
    if (catalogCache) return catalogCache;
    const raw = fs.readFileSync(CATALOG_PATH, 'utf8');
    catalogCache = JSON.parse(raw);
    return catalogCache;
}

function resolveCommanderClassId(commander) {
    const rawPath = String(commander?.path || 'PHYS').trim().toUpperCase();
    if (rawPath === 'MAG' || rawPath === 'MAGIC') return 'battlemage';
    return 'battlemaster';
}

function resolveCommanderRank(commander) {
    return Math.max(1, Math.floor(Number(commander?.rank) || 1));
}

function resolveCommanderAgeGold(commander) {
    const value = Number(commander?.ageGold);
    if (Number.isFinite(value) && value >= 0) {
        return Math.floor(value);
    }
    return AGE_COMMANDER_GOLD_DEFAULT;
}

function buildCommanderAgeGoldSeedPatch(commander) {
    const value = Number(commander?.ageGold);
    if (Number.isFinite(value) && value >= 0) return {};
    return { ageGold: AGE_COMMANDER_GOLD_DEFAULT };
}

function resolveCommanderAgeProvisions(commander) {
    const value = Number(commander?.ageProvisions);
    if (Number.isFinite(value) && value >= 0) {
        return Math.floor(value);
    }
    return AGE_COMMANDER_PROVISIONS_DEFAULT;
}

function buildCommanderAgeProvisionsSeedPatch(commander) {
    const value = Number(commander?.ageProvisions);
    if (Number.isFinite(value) && value >= 0) return {};
    return { ageProvisions: AGE_COMMANDER_PROVISIONS_DEFAULT };
}

function resolveRecruitUnitUpc(unit) {
    const firstPromotion = Array.isArray(unit?.promotions) && unit.promotions.length
        ? unit.promotions[0]
        : 'app';
    const upc = Number(unit?.stats?.[firstPromotion]?.upc);
    return Number.isFinite(upc) && upc > 0 ? Math.floor(upc) : 0;
}

function resolveRecruitBalanceRules(catalog) {
    return catalog?.meta?.recruitBalance || {};
}

function isSwarmRecruitUnit(unit, catalog) {
    if (!unit) return false;
    if (unit.swarmRecruitEligible === true) return true;
    if (unit.swarmRecruitEligible === false) return false;

    const tier = Math.max(1, Math.floor(Number(unit.tier) || 1));
    if (tier === 1) return true;

    const rules = resolveRecruitBalanceRules(catalog || loadUnitPurchaseCatalog());
    const swarmMaxUpc = Math.max(1, Math.floor(Number(rules.swarmRecruitMaxUpc) || 11));
    const upc = resolveRecruitUnitUpc(unit);
    return upc > 0 && upc <= swarmMaxUpc;
}

function resolveMaxRecruitBatchQuantity(unit) {
    const catalog = loadUnitPurchaseCatalog();
    const rules = resolveRecruitBalanceRules(catalog);
    if (isSwarmRecruitUnit(unit, catalog)) {
        const swarmCeiling = Number(rules.swarmRecruitMaxBatchQuantity);
        return Number.isFinite(swarmCeiling) && swarmCeiling > 0
            ? Math.floor(swarmCeiling)
            : SWARM_RECRUIT_BATCH_CEILING_DEFAULT;
    }

    return resolveMaxRecruitQuantity();
}

function resolveMaxRecruitQuantity() {
    const catalog = loadUnitPurchaseCatalog();
    const fromMeta = catalog?.meta?.recruitBalance?.maxBatchQuantity;
    if (Number.isFinite(Number(fromMeta)) && Number(fromMeta) > 0) {
        return Math.floor(Number(fromMeta));
    }
    return MAX_RECRUIT_QUANTITY_DEFAULT;
}

function computeMaxRecruitQuantityByGold(gold, unitCost) {
    const cost = Math.max(0, Math.floor(Number(unitCost) || 0));
    if (!cost) return 0;
    return Math.floor(Math.max(0, Number(gold) || 0) / cost);
}

function computeMaxRecruitQuantityByProvisions(provisions, upcPerUnit) {
    const upc = Math.max(0, Math.floor(Number(upcPerUnit) || 0));
    if (!upc) return 0;
    return Math.floor(Math.max(0, Number(provisions) || 0) / upc);
}

function computeMaxRecruitQuantity(gold, provisions, unitCost, upcPerUnit, unit) {
    const byGold = computeMaxRecruitQuantityByGold(gold, unitCost);
    const byProvisions = computeMaxRecruitQuantityByProvisions(provisions, upcPerUnit);
    if (!byGold || !byProvisions) return 0;
    const batchCap = unit ? resolveMaxRecruitBatchQuantity(unit) : resolveMaxRecruitQuantity();
    return Math.min(batchCap, byGold, byProvisions);
}

function getCategoryMaxTier(catalog, categoryId) {
    return (catalog?.units || [])
        .filter((unit) => unit.categoryId === categoryId)
        .reduce((max, unit) => Math.max(max, Number(unit.tier) || 0), 0);
}

function enrichCatalogUnit(catalog, unit) {
    if (!unit || typeof unit !== 'object') return null;

    const category = (catalog?.categories || []).find((entry) => entry.id === unit.categoryId);
    const categoryPath = category?.path || 'Physical';
    const requiredClass = unit.requiredClass || CLASS_BY_PATH[categoryPath] || 'battlemaster';
    const unlockRank = Number.isFinite(Number(unit.unlockRank))
        ? Number(unit.unlockRank)
        : resolveUnlockRankForTier(catalog, unit.tier, unit.categoryId);

    return {
        ...unit,
        requiredClass,
        unlockRank
    };
}

function resolveUnlockRankForTier(catalog, tier, categoryId) {
    const rules = catalog?.meta?.tierUnlockRules;
    const fourTier = Array.isArray(rules?.fourTierUnlockRanks)
        ? rules.fourTierUnlockRanks
        : FOUR_TIER_UNLOCK_RANKS;
    const extended = Array.isArray(rules?.extendedUnlockRanks)
        ? rules.extendedUnlockRanks
        : EXTENDED_UNLOCK_RANKS;
    const gameTier = Math.max(1, Math.floor(Number(tier) || 1));
    const maxTier = getCategoryMaxTier(catalog, categoryId);
    const table = maxTier > 4 ? extended : fourTier;
    const index = Math.max(0, Math.min(table.length - 1, gameTier - 1));
    return table[index];
}

function getCatalogUnitById(catalog, unitId) {
    const id = String(unitId || '').trim();
    const unit = (catalog?.units || []).find((entry) => entry.id === id) || null;
    return unit ? enrichCatalogUnit(catalog, unit) : null;
}

function evaluateUnitPurchaseAccess(unit, commander) {
    if (!unit) {
        return { allowed: false, errorCode: 'NEXUS-AGE-012' };
    }

    const classId = resolveCommanderClassId(commander);
    if (unit.requiredClass && unit.requiredClass !== classId) {
        return { allowed: false, errorCode: 'NEXUS-AGE-014' };
    }

    const unlockRank = Math.max(1, Math.floor(Number(unit.unlockRank) || 1));
    const commanderRank = resolveCommanderRank(commander);
    if (commanderRank < unlockRank) {
        return { allowed: false, errorCode: 'NEXUS-AGE-015', unlockRank };
    }

    return { allowed: true };
}

function normalizeRecruitQuantity(rawQuantity, unit) {
    const quantity = Math.floor(Number(rawQuantity) || 0);
    if (!Number.isFinite(quantity) || quantity < 1) return 0;
    const batchCap = unit ? resolveMaxRecruitBatchQuantity(unit) : resolveMaxRecruitQuantity();
    return Math.min(batchCap, quantity);
}

function resolveUnitPurpose(unitRole) {
    if (unitRole === 'pvp') return 'pvp';
    return 'rank';
}

function buildRecruitStack(unit, quantity) {
    const firstPromotion = Array.isArray(unit.promotions) && unit.promotions.length
        ? unit.promotions[0]
        : 'app';

    return {
        catalogUnitId: String(unit.id || '').slice(0, 64),
        class: String(unit.combatType || 'INFANTRY').trim().slice(0, 32) || 'INFANTRY',
        name: String(unit.name || 'Recruit').trim().slice(0, 64) || 'Recruit',
        tier: Math.max(1, Math.floor(Number(unit.tier) || 1)),
        rank: PROMOTION_RANK[firstPromotion] || 1,
        qty: quantity,
        injuredQty: 0,
        unitXpEach: Array(Math.max(1, Math.floor(Number(quantity) || 1))).fill(0),
        purpose: resolveUnitPurpose(unit.unitRole)
    };
}

function mergeRecruitStackIntoArmy(army, recruitStack) {
    const next = Array.isArray(army) ? army.slice() : [];
    const matchIndex = next.findIndex((stack) => (
        stack
        && stack.catalogUnitId === recruitStack.catalogUnitId
        && Math.floor(Number(stack.rank) || 0) === recruitStack.rank
    ));

    if (matchIndex >= 0) {
        const existing = next[matchIndex];
        const existingQty = Math.max(0, Math.floor(Number(existing.qty) || 0));
        const recruitQty = Math.max(0, Math.floor(Number(recruitStack.qty) || 0));
        next[matchIndex] = {
            ...existing,
            qty: existingQty + recruitQty,
            unitXpEach: normalizeUnitXpEachSlots(existing, existingQty)
                .concat(normalizeUnitXpEachSlots(recruitStack, recruitQty))
        };
    } else {
        next.push({
            ...recruitStack,
            unitXpEach: normalizeUnitXpEachSlots(recruitStack, recruitStack.qty)
        });
    }

    return normalizeAgeArmy(next);
}

function executeAgeUnitRecruitment({ commander, unitId, quantity }) {
    const catalog = loadUnitPurchaseCatalog();
    const unit = getCatalogUnitById(catalog, unitId);
    const normalizedQuantity = normalizeRecruitQuantity(quantity, unit);

    if (!unit) {
        return { ok: false, errorCode: 'NEXUS-AGE-012' };
    }
    if (!normalizedQuantity) {
        return { ok: false, errorCode: 'NEXUS-AGE-013' };
    }

    const access = evaluateUnitPurchaseAccess(unit, commander);
    if (!access.allowed) {
        return { ok: false, errorCode: access.errorCode, unlockRank: access.unlockRank };
    }

    const unitCost = Math.max(0, Math.floor(Number(unit.goldCost) || 0));
    const upcPerUnit = resolveRecruitUnitUpc(unit);
    if (!unitCost || !upcPerUnit) {
        return { ok: false, errorCode: 'NEXUS-AGE-012' };
    }

    const currentGold = resolveCommanderAgeGold(commander);
    const currentProvisions = resolveCommanderAgeProvisions(commander);
    const maxAllowed = computeMaxRecruitQuantity(currentGold, currentProvisions, unitCost, upcPerUnit, unit);
    if (normalizedQuantity > maxAllowed) {
        const maxByGold = computeMaxRecruitQuantityByGold(currentGold, unitCost);
        const maxByProvisions = computeMaxRecruitQuantityByProvisions(currentProvisions, upcPerUnit);
        if (maxByProvisions < maxByGold) {
            return { ok: false, errorCode: 'NEXUS-AGE-016' };
        }
        return { ok: false, errorCode: 'NEXUS-AGE-011' };
    }

    const totalGoldCost = unitCost * normalizedQuantity;
    const totalProvisionsCost = upcPerUnit * normalizedQuantity;
    if (currentGold < totalGoldCost) {
        return { ok: false, errorCode: 'NEXUS-AGE-011' };
    }
    if (currentProvisions < totalProvisionsCost) {
        return { ok: false, errorCode: 'NEXUS-AGE-016' };
    }

    const recruitStack = buildRecruitStack(unit, normalizedQuantity);
    const nextArmy = mergeRecruitStackIntoArmy(resolveCommanderAgeArmy(commander), recruitStack);
    const nextGold = currentGold - totalGoldCost;
    const nextProvisions = currentProvisions - totalProvisionsCost;
    const roster = buildAgeRosterHudPayload({ ...commander, ageArmy: nextArmy });

    return {
        ok: true,
        unitId: unit.id,
        quantity: normalizedQuantity,
        unitCost,
        upcPerUnit,
        goldSpent: totalGoldCost,
        provisionsSpent: totalProvisionsCost,
        ageGold: nextGold,
        ageProvisions: nextProvisions,
        ageArmy: nextArmy,
        unitsTotal: roster.unitsTotal,
        unitsUninjured: roster.unitsUninjured,
        maxByGold: computeMaxRecruitQuantityByGold(currentGold, unitCost),
        maxByProvisions: computeMaxRecruitQuantityByProvisions(currentProvisions, upcPerUnit)
    };
}

function executeAgeUnitRecruitmentWithBalanceAudit({ commander, unitId, quantity }) {
    const result = executeAgeUnitRecruitment({ commander, unitId, quantity });
    if (!result?.ok) return result;

    recordBalanceEvent('recruitment', {
        username: String(commander?.username || '').trim() || null,
        commanderRank: Math.max(1, Math.floor(Number(commander?.rank) || 1)),
        unitId: result.unitId,
        quantity: result.quantity,
        upcPerUnit: result.upcPerUnit,
        provisionsSpent: result.provisionsSpent,
        provisionsAfter: result.ageProvisions,
        unitsTotal: result.unitsTotal
    });

    return result;
}

module.exports = {
    AGE_COMMANDER_GOLD_DEFAULT,
    AGE_COMMANDER_PROVISIONS_DEFAULT,
    MAX_RECRUIT_QUANTITY: MAX_RECRUIT_QUANTITY_DEFAULT,
    SWARM_RECRUIT_BATCH_CEILING_DEFAULT,
    resolveMaxRecruitQuantity,
    resolveMaxRecruitBatchQuantity,
    isSwarmRecruitUnit,
    loadUnitPurchaseCatalog,
    resolveCommanderAgeGold,
    resolveCommanderAgeProvisions,
    buildCommanderAgeGoldSeedPatch,
    buildCommanderAgeProvisionsSeedPatch,
    resolveRecruitUnitUpc,
    computeMaxRecruitQuantity,
    computeMaxRecruitQuantityByGold,
    computeMaxRecruitQuantityByProvisions,
    evaluateUnitPurchaseAccess,
    executeAgeUnitRecruitment,
    executeAgeUnitRecruitmentWithBalanceAudit,
    getCatalogUnitById
};

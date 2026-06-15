/**
 * NEXUS — Garrison roster review and unit dismissal.
 */
'use strict';

const {
    loadUnitPurchaseCatalog,
    getCatalogUnitById,
    resolveCommanderAgeGold,
    resolveCommanderAgeProvisions
} = require('./nexus-age-recruitment');
const {
    normalizeAgeArmy,
    resolveCommanderAgeArmy,
    countAgeArmyUnits,
    normalizeUnitXpEachSlots
} = require('./nexus-age-roster');
const {
    PROMOTION_BY_RANK,
    PROMOTION_LABELS,
    formatPromotionRankLabel,
    resolveUnitPromotionXpRequired,
    resolveStackUnitXpSummary
} = require('./nexus-age-unit-xp');

const UNIT_TYPE_LABELS = Object.freeze({
    infantry: 'Infantry',
    cavalry: 'Cavalry',
    beasts: 'Beasts',
    ranged: 'Ranged',
    artillery: 'Artillery',
    magic: 'Magic'
});

const UNIT_TYPE_ORDER = Object.freeze([
    'infantry',
    'cavalry',
    'beasts',
    'ranged',
    'artillery',
    'magic'
]);

function floorNonNegative(value) {
    const numeric = Math.floor(Number(value) || 0);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function resolveCommanderClassId(commander) {
    const path = String(commander?.path || '').trim().toUpperCase();
    return path === 'MAG' ? 'battlemage' : 'battlemaster';
}

function resolveCommanderClassLabel(commander) {
    return resolveCommanderClassId(commander) === 'battlemage' ? 'Battlemage' : 'Battlemaster';
}

function resolveStackPromotionKey(stack, catalogUnit) {
    const rank = Math.max(1, Math.floor(Number(stack?.rank) || 1));
    const fromRank = PROMOTION_BY_RANK[rank];
    if (fromRank && catalogUnit?.stats?.[fromRank]) return fromRank;

    const first = Array.isArray(catalogUnit?.promotions) && catalogUnit.promotions.length
        ? catalogUnit.promotions[0]
        : 'app';
    return first;
}

function resolveUnitType(catalogUnit, stack) {
    const categoryId = String(catalogUnit?.categoryId || stack?.class || '').trim().toLowerCase();
    if (UNIT_TYPE_LABELS[categoryId]) return categoryId;

    const combatType = String(stack?.class || catalogUnit?.combatType || 'infantry').trim().toLowerCase();
    if (UNIT_TYPE_LABELS[combatType]) return combatType;
    return 'infantry';
}

function buildRosterUnitId(catalogUnitId, rank, slotIndex) {
    return `${String(catalogUnitId || '').trim()}|${Math.floor(Number(rank) || 1)}|${Math.floor(Number(slotIndex) || 0)}`;
}

function parseRosterUnitId(unitId) {
    const parts = String(unitId || '').split('|');
    if (parts.length < 3) return null;

    const catalogUnitId = String(parts[0] || '').trim();
    const rank = Math.floor(Number(parts[1]) || 0);
    const slotIndex = Math.floor(Number(parts[2]) || 0);
    if (!catalogUnitId || rank < 1 || slotIndex < 0) return null;

    return { catalogUnitId, rank, slotIndex };
}

function resolveStackMark(name) {
    const trimmed = String(name || '').trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : 'U';
}

function buildRosterReviewUnitRows(stack, catalogUnit) {
    const qty = floorNonNegative(stack?.qty);
    if (!qty) return [];

    const promotionKey = resolveStackPromotionKey(stack, catalogUnit);
    const stats = catalogUnit?.stats?.[promotionKey] || {};
    const promotionLabel = PROMOTION_LABELS[promotionKey]
        || formatPromotionRankLabel(stack.rank);
    const unitType = resolveUnitType(catalogUnit, stack);
    const name = String(catalogUnit?.displayName || catalogUnit?.name || stack?.name || 'Unit').trim();
    const tier = Math.max(1, Math.floor(Number(stack?.tier) || 1));
    const rank = Math.max(1, Math.floor(Number(stack?.rank) || 1));
    const injuredQty = Math.min(qty, floorNonNegative(stack?.injuredQty ?? stack?.injured));
    const xpSlots = normalizeUnitXpEachSlots(stack, qty);
    const xpRequired = resolveUnitPromotionXpRequired(rank, tier);
    const hasRanged = stats.rng !== undefined && stats.rng !== null && stats.rng !== '';

    const rows = [];
    for (let slotIndex = 0; slotIndex < qty; slotIndex += 1) {
        const slot = slotIndex + 1;
        const isInjured = slotIndex < injuredQty;
        rows.push({
            id: buildRosterUnitId(stack.catalogUnitId, rank, slotIndex),
            catalogUnitId: stack.catalogUnitId,
            rank,
            slotIndex,
            name,
            label: qty > 1 ? `${name} #${slot}` : name,
            mark: resolveStackMark(name),
            tier,
            promotionKey,
            promotionLabel,
            unitType,
            typeLabel: UNIT_TYPE_LABELS[unitType] || unitType,
            class: String(stack?.class || catalogUnit?.combatType || 'INFANTRY').trim(),
            purpose: String(stack?.purpose || '').trim() || 'rank',
            isInjured,
            hp: stats.hp ?? '—',
            str: stats.str ?? '—',
            rng: hasRanged ? (stats.rng ?? '—') : null,
            upc: stats.upc ?? '—',
            unitXp: Math.max(0, Math.floor(Number(xpSlots[slotIndex]) || 0)),
            unitXpRequired: xpRequired
        });
    }

    return rows;
}

function groupRosterUnitsForDisplay(units) {
    const typeMap = new Map();

    (Array.isArray(units) ? units : []).forEach((unit) => {
        const unitType = unit.unitType || 'infantry';
        if (!typeMap.has(unitType)) {
            typeMap.set(unitType, new Map());
        }
        const tierMap = typeMap.get(unitType);
        const tier = Math.max(1, Math.floor(Number(unit.tier) || 1));
        if (!tierMap.has(tier)) {
            tierMap.set(tier, []);
        }
        tierMap.get(tier).push(unit);
    });

    return UNIT_TYPE_ORDER
        .filter((unitType) => typeMap.has(unitType))
        .map((unitType) => {
            const tierMap = typeMap.get(unitType);
            const tiers = [...tierMap.keys()]
                .sort((left, right) => right - left)
                .map((tier) => ({
                    tier,
                    units: tierMap.get(tier).slice().sort((left, right) => {
                        const rankDiff = Math.floor(Number(left.rank) || 0) - Math.floor(Number(right.rank) || 0);
                        if (rankDiff) return rankDiff;
                        const slotDiff = Math.floor(Number(left.slotIndex) || 0) - Math.floor(Number(right.slotIndex) || 0);
                        if (slotDiff) return slotDiff;
                        return String(left.label || '').localeCompare(String(right.label || ''));
                    })
                }));
            return {
                unitType,
                typeLabel: UNIT_TYPE_LABELS[unitType] || unitType,
                tiers
            };
        });
}

function buildGarrisonRosterReviewPayload(commander, catalog) {
    const catalogRef = catalog || loadUnitPurchaseCatalog();
    const army = resolveCommanderAgeArmy(commander);
    const counts = countAgeArmyUnits(army);
    const commanderRank = Math.max(1, Math.floor(Number(commander?.rank) || 1));

    const units = [];
    normalizeAgeArmy(army).forEach((stack) => {
        const catalogUnit = getCatalogUnitById(catalogRef, stack?.catalogUnitId) || null;
        units.push(...buildRosterReviewUnitRows(stack, catalogUnit));
    });

    const stackSummaries = normalizeAgeArmy(army).map((stack) => {
        const catalogUnit = getCatalogUnitById(catalogRef, stack?.catalogUnitId);
        if (!catalogUnit) return null;

        const promotionKey = resolveStackPromotionKey(stack, catalogUnit);
        const stats = catalogUnit.stats?.[promotionKey] || {};
        const xpRequired = resolveUnitPromotionXpRequired(stack.rank, stack.tier);
        const xpSummary = resolveStackUnitXpSummary(stack, xpRequired);
        const injuredQty = Math.min(
            floorNonNegative(stack.qty),
            floorNonNegative(stack.injuredQty ?? stack.injured)
        );
        const healthyQty = Math.max(0, floorNonNegative(stack.qty) - injuredQty);

        return {
            catalogUnitId: stack.catalogUnitId,
            rank: stack.rank,
            tier: stack.tier,
            qty: stack.qty,
            healthyQty,
            injuredQty,
            name: catalogUnit.displayName || catalogUnit.name || stack.name,
            promotionLabel: PROMOTION_LABELS[promotionKey] || formatPromotionRankLabel(stack.rank),
            hp: stats.hp ?? null,
            str: stats.str ?? null,
            rng: stats.rng ?? null,
            upc: stats.upc ?? null,
            unitXpMin: xpSummary.unitXpMin,
            unitXpMax: xpSummary.unitXpMax,
            unitXpRequired: xpRequired,
            readyUnitCount: xpSummary.readyUnitCount,
            purpose: String(stack.purpose || '').trim() || 'rank'
        };
    }).filter(Boolean);

    return {
        commander: {
            username: String(commander?.username || '').trim(),
            displayName: String(commander?.name || commander?.username || '').trim(),
            rank: commanderRank,
            path: String(commander?.path || 'PHYS').trim(),
            classId: resolveCommanderClassId(commander),
            classLabel: resolveCommanderClassLabel(commander),
            ageGold: resolveCommanderAgeGold(commander),
            ageProvisions: resolveCommanderAgeProvisions(commander),
            unitsTotal: counts.total,
            unitsInjured: counts.injured,
            unitsHealthy: counts.uninjured
        },
        units,
        groups: groupRosterUnitsForDisplay(units),
        stacks: stackSummaries
    };
}

function findArmyStackIndex(army, catalogUnitId, rank) {
    const id = String(catalogUnitId || '').trim();
    const rankNum = Math.max(1, Math.floor(Number(rank) || 1));
    return (Array.isArray(army) ? army : []).findIndex((stack) => (
        stack
        && String(stack.catalogUnitId || '').trim() === id
        && Math.floor(Number(stack.rank) || 0) === rankNum
    ));
}

function removeUnitsFromArmy(army, removalsByStack) {
    const next = Array.isArray(army) ? army.slice() : [];

    removalsByStack.forEach((indices, stackKey) => {
        const separator = stackKey.lastIndexOf('|');
        if (separator < 0) return;

        const catalogUnitId = stackKey.slice(0, separator);
        const rank = Math.floor(Number(stackKey.slice(separator + 1)) || 0);
        const stackIndex = findArmyStackIndex(next, catalogUnitId, rank);
        if (stackIndex < 0) return;

        const stack = next[stackIndex];
        const slots = normalizeUnitXpEachSlots(stack, stack.qty);
        const sortedIndices = [...indices]
            .map((value) => Math.floor(Number(value) || 0))
            .filter((value) => value >= 0 && value < slots.length)
            .sort((left, right) => right - left);

        if (!sortedIndices.length) return;

        let currentInjured = Math.min(
            floorNonNegative(stack.qty),
            floorNonNegative(stack.injuredQty ?? stack.injured)
        );

        sortedIndices.forEach((slotIndex) => {
            if (slotIndex < currentInjured) {
                currentInjured -= 1;
            }
            slots.splice(slotIndex, 1);
        });

        const removedCount = sortedIndices.length;
        const newQty = Math.max(0, floorNonNegative(stack.qty) - removedCount);

        if (newQty <= 0) {
            next.splice(stackIndex, 1);
            return;
        }

        next[stackIndex] = {
            ...stack,
            qty: newQty,
            injuredQty: Math.max(0, Math.min(newQty, currentInjured)),
            unitXpEach: slots
        };
    });

    return normalizeAgeArmy(next);
}

function executeDismissRosterUnits(commander, unitIds) {
    const ids = Array.isArray(unitIds) ? unitIds : [];
    const normalizedIds = ids
        .map((entry) => String(entry || '').trim())
        .filter(Boolean);

    if (!normalizedIds.length) {
        return { ok: false, errorCode: 'NEXUS-AGE-039' };
    }

    const army = resolveCommanderAgeArmy(commander);
    const payload = buildGarrisonRosterReviewPayload(commander);
    const validIdSet = new Set((payload.units || []).map((unit) => unit.id));
    const invalid = normalizedIds.filter((id) => !validIdSet.has(id));

    if (invalid.length) {
        return { ok: false, errorCode: 'NEXUS-AGE-040', invalidUnitIds: invalid };
    }

    const removalsByStack = new Map();
    normalizedIds.forEach((unitId) => {
        const parsed = parseRosterUnitId(unitId);
        if (!parsed) return;
        const stackKey = `${parsed.catalogUnitId}|${parsed.rank}`;
        if (!removalsByStack.has(stackKey)) {
            removalsByStack.set(stackKey, new Set());
        }
        removalsByStack.get(stackKey).add(parsed.slotIndex);
    });

    if (!removalsByStack.size) {
        return { ok: false, errorCode: 'NEXUS-AGE-039' };
    }

    const ageArmy = removeUnitsFromArmy(army, removalsByStack);
    const counts = countAgeArmyUnits(ageArmy);

    return {
        ok: true,
        ageArmy,
        unitsDismissed: normalizedIds.length,
        unitsTotal: counts.total,
        unitsUninjured: counts.uninjured
    };
}

module.exports = {
    buildGarrisonRosterReviewPayload,
    executeDismissRosterUnits,
    buildRosterUnitId,
    parseRosterUnitId,
    groupRosterUnitsForDisplay
};

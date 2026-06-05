/**
 * NEXUS — Infirmary injury recovery ticks and decaying heal-gold costs.
 *
 * Peak heal gold scales exponentially by unit tier (tier 4+ reaches millions for
 * full high-tier rosters). Costs decay each Age tick until the penultimate tick,
 * then units recover for free on the final tick.
 */
'use strict';

/** Catalog purchase gold + this fraction on the last tick before free recovery. */
const INFIRMARY_PENULTIMATE_TICK_PREMIUM = 0.10;

/** Peak instant-heal multiplier applied on the injury tick (before decay). */
const INFIRMARY_PEAK_HEAL_MULTIPLIER = 2;

const HEAL_COST_MULTIPLIER_BY_RANK = Object.freeze({
    1: 1,
    2: 1,
    3: 1.015,
    4: 1.02,
    5: 1.03,
    6: 1.05
});

const RANK_BY_PROMOTION = Object.freeze({
    app: 1,
    std: 2,
    vet: 3,
    mst: 4,
    leg: 5,
    elite: 6
});

const PROMOTION_BY_RANK = Object.freeze({
    1: 'app',
    2: 'std',
    3: 'vet',
    4: 'mst',
    5: 'leg',
    6: 'elite'
});

/**
 * Each tier doubles the peak heal surcharge (tier 4 = 8×, tier 6 = 32×).
 * Floor heal stays at catalog purchase + penultimate premium (no tier surcharge).
 */
function resolveTierHealMultiplier(tier) {
    const normalizedTier = Math.max(1, Math.min(6, Math.floor(Number(tier) || 1)));
    return Math.pow(2, normalizedTier - 1);
}

function resolvePromotionRank(promotion) {
    return RANK_BY_PROMOTION[String(promotion || '').trim().toLowerCase()] || 1;
}

function resolvePeakHealCost(purchaseGold, promotion, tier) {
    const purchase = Math.max(0, Math.floor(Number(purchaseGold) || 0));
    if (!purchase) return 0;
    const rank = resolvePromotionRank(promotion);
    const rankMultiplier = HEAL_COST_MULTIPLIER_BY_RANK[rank] || 1;
    const tierMultiplier = resolveTierHealMultiplier(tier);
    return Math.max(1, Math.ceil(purchase * INFIRMARY_PEAK_HEAL_MULTIPLIER * rankMultiplier * tierMultiplier));
}

function resolvePenultimateHealCost(purchaseGold) {
    const purchase = Math.max(0, Math.floor(Number(purchaseGold) || 0));
    if (!purchase) return 0;
    return Math.max(1, Math.ceil(purchase * (1 + INFIRMARY_PENULTIMATE_TICK_PREMIUM)));
}

function resolveInfirmaryHealCost(unit) {
    const purchaseGold = Math.max(0, Math.floor(Number(unit?.goldCost ?? unit?.purchaseGold) || 0));
    if (!purchaseGold) return 0;

    const ticksTotal = Math.max(1, Math.floor(Number(unit?.ticksTotal) || 1));
    const ticksRemaining = Math.max(0, Math.floor(Number(unit?.ticksRemaining) || 0));
    if (ticksRemaining <= 0) return 0;

    const peakCost = resolvePeakHealCost(purchaseGold, unit?.promotion, unit?.tier);
    const floorCost = resolvePenultimateHealCost(purchaseGold);

    if (ticksTotal <= 1 || ticksRemaining <= 1) {
        return floorCost;
    }

    const elapsedTicks = ticksTotal - ticksRemaining;
    const decaySpan = Math.max(1, ticksTotal - 1);
    const progress = Math.min(1, Math.max(0, elapsedTicks / decaySpan));
    const interpolated = Math.ceil(peakCost - ((peakCost - floorCost) * progress));
    return Math.max(floorCost, interpolated);
}

function resolveStackInfirmaryHealCost(catalogUnit, stack) {
    if (!catalogUnit) return 0;

    const rank = Math.max(1, Math.min(6, Math.floor(Number(stack?.rank) || 1)));
    const ticksTotal = Math.max(1, Math.floor(Number(stack?.injuryTicksTotal) || 3));
    const ticksRemaining = stack?.injuryTicksRemaining != null
        ? Math.max(0, Math.floor(Number(stack.injuryTicksRemaining)))
        : ticksTotal;

    return resolveInfirmaryHealCost({
        goldCost: catalogUnit.goldCost,
        tier: catalogUnit.tier,
        promotion: PROMOTION_BY_RANK[rank] || 'std',
        ticksTotal,
        ticksRemaining
    });
}

function sumInfirmaryHealCosts(units) {
    if (!Array.isArray(units)) return 0;
    return units.reduce((sum, unit) => sum + resolveInfirmaryHealCost(unit), 0);
}

module.exports = {
    INFIRMARY_PENULTIMATE_TICK_PREMIUM,
    INFIRMARY_PEAK_HEAL_MULTIPLIER,
    HEAL_COST_MULTIPLIER_BY_RANK,
    resolveTierHealMultiplier,
    resolveInfirmaryHealCost,
    resolvePeakHealCost,
    resolvePenultimateHealCost,
    resolveStackInfirmaryHealCost,
    sumInfirmaryHealCosts
};

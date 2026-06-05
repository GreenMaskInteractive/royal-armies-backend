/**
 * NEXUS — Infirmary injury recovery ticks and decaying heal-gold costs.
 *
 * Per-unit heal gold rises with tier and injury length (recovery ticks), capped
 * below half a million. Full high-tier rosters still reach millions in total.
 */
'use strict';

/** Catalog purchase gold + this fraction on the last tick before free recovery. */
const INFIRMARY_PENULTIMATE_TICK_PREMIUM = 0.10;

/** Peak instant-heal multiplier applied on the injury tick (before decay). */
const INFIRMARY_PEAK_HEAL_MULTIPLIER = 2;

/** No single injured unit may exceed this rush-heal cost. */
const INFIRMARY_MAX_UNIT_HEAL_COST = 499999;

/** Each extra recovery tick deepens the peak heal bill (+25% per tick beyond the first). */
const INFIRMARY_INJURY_TICK_STEP = 0.25;

const HEAL_COST_MULTIPLIER_BY_RANK = Object.freeze({
    1: 1,
    2: 1,
    3: 1.015,
    4: 1.02,
    5: 1.03,
    6: 1.05
});

/** Additive tier surcharge on peak heal (tier 4 ≈ +55%, tier 6 ≈ +110%). */
const INFIRMARY_TIER_HEAL_SURCHARGE = Object.freeze({
    1: 0.10,
    2: 0.20,
    3: 0.35,
    4: 0.55,
    5: 0.80,
    6: 1.10
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

function normalizeTier(tier) {
    return Math.max(1, Math.min(6, Math.floor(Number(tier) || 1)));
}

function normalizeTicksTotal(ticksTotal) {
    return Math.max(1, Math.min(6, Math.floor(Number(ticksTotal) || 1)));
}

function resolveTierHealSurcharge(tier) {
    return INFIRMARY_TIER_HEAL_SURCHARGE[normalizeTier(tier)] || INFIRMARY_TIER_HEAL_SURCHARGE[1];
}

/** @deprecated Prefer resolveTierHealSurcharge; returns 1 + surcharge for legacy callers. */
function resolveTierHealMultiplier(tier) {
    return 1 + resolveTierHealSurcharge(tier);
}

function resolveInjuryTickMultiplier(ticksTotal) {
    const ticks = normalizeTicksTotal(ticksTotal);
    return 1 + ((ticks - 1) * INFIRMARY_INJURY_TICK_STEP);
}

function resolvePromotionRank(promotion) {
    return RANK_BY_PROMOTION[String(promotion || '').trim().toLowerCase()] || 1;
}

function clampUnitHealCost(amount) {
    const value = Math.max(0, Math.floor(Number(amount) || 0));
    if (!value) return 0;
    return Math.min(INFIRMARY_MAX_UNIT_HEAL_COST, value);
}

function resolvePeakHealCost(purchaseGold, promotion, tier, ticksTotal) {
    const purchase = Math.max(0, Math.floor(Number(purchaseGold) || 0));
    if (!purchase) return 0;
    const rank = resolvePromotionRank(promotion);
    const rankMultiplier = HEAL_COST_MULTIPLIER_BY_RANK[rank] || 1;
    const tierMultiplier = 1 + resolveTierHealSurcharge(tier);
    const injuryTickMultiplier = resolveInjuryTickMultiplier(ticksTotal);
    const raw = Math.ceil(
        purchase * INFIRMARY_PEAK_HEAL_MULTIPLIER * rankMultiplier * tierMultiplier * injuryTickMultiplier
    );
    return Math.max(1, clampUnitHealCost(raw));
}

function resolvePenultimateHealCost(purchaseGold) {
    const purchase = Math.max(0, Math.floor(Number(purchaseGold) || 0));
    if (!purchase) return 0;
    return Math.max(1, Math.ceil(purchase * (1 + INFIRMARY_PENULTIMATE_TICK_PREMIUM)));
}

function resolveInfirmaryHealCost(unit) {
    const purchaseGold = Math.max(0, Math.floor(Number(unit?.goldCost ?? unit?.purchaseGold) || 0));
    if (!purchaseGold) return 0;

    const ticksTotal = normalizeTicksTotal(unit?.ticksTotal);
    const ticksRemaining = Math.max(0, Math.floor(Number(unit?.ticksRemaining) || 0));
    if (ticksRemaining <= 0) return 0;

    const peakCost = resolvePeakHealCost(purchaseGold, unit?.promotion, unit?.tier, ticksTotal);
    const floorCost = resolvePenultimateHealCost(purchaseGold);

    if (ticksTotal <= 1 || ticksRemaining <= 1) {
        return floorCost;
    }

    const elapsedTicks = ticksTotal - ticksRemaining;
    const decaySpan = Math.max(1, ticksTotal - 1);
    const progress = Math.min(1, Math.max(0, elapsedTicks / decaySpan));
    const interpolated = Math.ceil(peakCost - ((peakCost - floorCost) * progress));
    return Math.max(floorCost, clampUnitHealCost(interpolated));
}

function resolveStackInfirmaryHealCost(catalogUnit, stack) {
    if (!catalogUnit) return 0;

    const rank = Math.max(1, Math.min(6, Math.floor(Number(stack?.rank) || 1)));
    const ticksTotal = normalizeTicksTotal(stack?.injuryTicksTotal || 3);
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
    INFIRMARY_MAX_UNIT_HEAL_COST,
    INFIRMARY_INJURY_TICK_STEP,
    INFIRMARY_TIER_HEAL_SURCHARGE,
    HEAL_COST_MULTIPLIER_BY_RANK,
    resolveTierHealSurcharge,
    resolveTierHealMultiplier,
    resolveInjuryTickMultiplier,
    resolveInfirmaryHealCost,
    resolvePeakHealCost,
    resolvePenultimateHealCost,
    resolveStackInfirmaryHealCost,
    sumInfirmaryHealCosts
};

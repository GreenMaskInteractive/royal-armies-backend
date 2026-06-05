/**
 * RIFT — Infirmary injury recovery ticks and decaying heal-gold costs.
 *
 * Heal gold starts high when a unit is first injured and steps down each Age tick
 * until the tick before natural recovery, when it reaches catalog purchase gold
 * plus INFIRMARY_PENULTIMATE_TICK_PREMIUM (10% above list price).
 */
(function initRoyalArmiesInfirmaryRecovery(global) {
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

    function resolvePromotionRank(promotion) {
        return RANK_BY_PROMOTION[String(promotion || '').trim().toLowerCase()] || 1;
    }

    function resolvePeakHealCost(purchaseGold, promotion) {
        const purchase = Math.max(0, Math.floor(Number(purchaseGold) || 0));
        if (!purchase) return 0;
        const rank = resolvePromotionRank(promotion);
        const rankMultiplier = HEAL_COST_MULTIPLIER_BY_RANK[rank] || 1;
        return Math.max(1, Math.ceil(purchase * INFIRMARY_PEAK_HEAL_MULTIPLIER * rankMultiplier));
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

        const peakCost = resolvePeakHealCost(purchaseGold, unit?.promotion);
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

    function formatInfirmaryGold(amount) {
        const value = Math.max(0, Math.floor(Number(amount) || 0));
        return `${value.toLocaleString('en-US')} gold`;
    }

    function formatTicksRemaining(ticksRemaining) {
        const ticks = Math.max(0, Math.floor(Number(ticksRemaining) || 0));
        if (!ticks) return 'Recovered';
        return ticks === 1 ? '1 tick' : `${ticks} ticks`;
    }

    function sumInfirmaryHealCosts(units) {
        if (!Array.isArray(units)) return 0;
        return units.reduce((sum, unit) => sum + resolveInfirmaryHealCost(unit), 0);
    }

    global.RoyalArmiesInfirmaryRecovery = {
        INFIRMARY_PENULTIMATE_TICK_PREMIUM,
        INFIRMARY_PEAK_HEAL_MULTIPLIER,
        HEAL_COST_MULTIPLIER_BY_RANK,
        resolveInfirmaryHealCost,
        resolvePeakHealCost,
        resolvePenultimateHealCost,
        formatInfirmaryGold,
        formatTicksRemaining,
        sumInfirmaryHealCosts
    };
})(window);

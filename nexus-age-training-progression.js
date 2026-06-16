/**
 * NEXUS — Training progression curves.
 *
 * NPC drill hosts follow a fixed concave curve keyed only to commander rank (1–22).
 * Every player at the same rank faces the same curve target; individual progression
 * (recruitment pace, army quality, gear choices) is never fed back into NPC scaling.
 *
 * The rank baseline reference is a theoretical full roster used only to anchor NPC
 * HP calibration — not a read of the player's actual ledger army.
 *
 * Player-side outcomes still vary: sim uses their real stacks; injuries use roster fill.
 * Combat modifiers stay off unless NEXUS_TRAINING_COMBAT_MODIFIERS=true.
 */
'use strict';

const MAX_COMMANDER_RANK = 22;

/** Linear rank baseline for curve anchoring — not any one player's actual roster. */
const PLAYER_REFERENCE_ANCHORS = Object.freeze([
    { rank: 1, units: 11, avgStackRank: 1 },
    { rank: 8, units: 18, avgStackRank: 2 },
    { rank: 15, units: 27, avgStackRank: 3.6 },
    { rank: 22, units: 35, avgStackRank: 5.2 }
]);

/** Recruit-era mix used to estimate reference HP (linear player baseline). */
const PLAYER_REFERENCE_STACK_TEMPLATE = Object.freeze([
    { catalogUnitId: 'recruit-shieldman-a', weight: 3 },
    { catalogUnitId: 'levy-archer-b', weight: 2 },
    { catalogUnitId: 'squire-rider', weight: 2 },
    { catalogUnitId: 'wild-wolf-a', weight: 2 },
    { catalogUnitId: 'acolyte', weight: 2 }
]);

/** NPC strength as a fraction of player reference HP at the same rank (ease-out curve). */
const NPC_STRENGTH_RATIO_AT_MIN_RANK = 0.48;
const NPC_STRENGTH_RATIO_AT_MAX_RANK = 0.902;

function getBattleSimExports() {
    return require('./nexus-age-battle-sim');
}

function clampCommanderRank(commanderRank) {
    return Math.max(1, Math.min(MAX_COMMANDER_RANK, Math.floor(Number(commanderRank) || 1)));
}

function lerpAnchoredValue(anchors, rank, field) {
    const list = Array.isArray(anchors) ? anchors : [];
    if (!list.length) return 0;
    const r = clampCommanderRank(rank);
    if (r <= list[0].rank) return Number(list[0][field]) || 0;
    for (let index = 0; index < list.length - 1; index += 1) {
        const lo = list[index];
        const hi = list[index + 1];
        if (r <= hi.rank) {
            const span = hi.rank - lo.rank;
            const t = span > 0 ? (r - lo.rank) / span : 0;
            return (Number(lo[field]) || 0) + (((Number(hi[field]) || 0) - (Number(lo[field]) || 0)) * t);
        }
    }
    return Number(list[list.length - 1][field]) || 0;
}

function resolvePlayerReferenceTotalUnits(commanderRank) {
    return Math.max(1, Math.round(lerpAnchoredValue(PLAYER_REFERENCE_ANCHORS, commanderRank, 'units')));
}

function resolvePlayerReferenceAvgStackRank(commanderRank) {
    const avg = lerpAnchoredValue(PLAYER_REFERENCE_ANCHORS, commanderRank, 'avgStackRank');
    return Math.max(1, Math.min(6, Math.round(avg * 10) / 10));
}

/**
 * Concave catch-up curve: low early, accelerates mid-ranks, plateaus below full parity.
 * @returns {number} 0.48 (rank 1) → ~0.90 (rank 22)
 */
function resolveTrainingNpcStrengthRatio(commanderRank) {
    const rank = clampCommanderRank(commanderRank);
    const t = (rank - 1) / (MAX_COMMANDER_RANK - 1);
    const curved = 1 - Math.pow(1 - t, 1.72);
    return NPC_STRENGTH_RATIO_AT_MIN_RANK
        + (curved * (NPC_STRENGTH_RATIO_AT_MAX_RANK - NPC_STRENGTH_RATIO_AT_MIN_RANK));
}

function distributeWeightedQuantities(template, targetTotal) {
    const entries = (Array.isArray(template) ? template : []).filter(Boolean);
    const total = Math.max(1, Math.floor(Number(targetTotal) || 1));
    if (!entries.length) return [];

    const weights = entries.map((entry) => Math.max(1, Math.floor(Number(entry.weight) || 1)));
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
    const exact = weights.map((weight) => (total * weight) / weightSum);
    const quantities = exact.map((value) => Math.floor(value));
    let remainder = total - quantities.reduce((sum, qty) => sum + qty, 0);

    const fractionalOrder = exact
        .map((value, index) => ({ index, fractional: value - Math.floor(value) }))
        .sort((left, right) => right.fractional - left.fractional);

    for (let step = 0; step < remainder; step += 1) {
        quantities[fractionalOrder[step % fractionalOrder.length].index] += 1;
    }

    return entries
        .map((entry, index) => ({ entry, qty: quantities[index] }))
        .filter((row) => row.qty > 0);
}

/**
 * Theoretical full roster at rank (baseline diagonal). Used only to calibrate the
 * global NPC curve — never derived from a commander's actual ageArmy.
 */
function buildPlayerReferenceStacks(commanderRank, catalog) {
    const { loadUnitPurchaseCatalog, getCatalogUnitById } = require('./nexus-age-recruitment');
    const { resolveTrainingNpcRankBand } = getBattleSimExports();
    const catalogRef = catalog || loadUnitPurchaseCatalog();
    const rank = clampCommanderRank(commanderRank);
    const totalUnits = resolvePlayerReferenceTotalUnits(rank);
    const stackRank = Math.max(1, Math.min(6, Math.round(resolvePlayerReferenceAvgStackRank(rank))));

    const band = resolveTrainingNpcRankBand(rank);
    const templateSource = Array.isArray(band?.stacks) && band.stacks.length
        ? band.stacks
        : PLAYER_REFERENCE_STACK_TEMPLATE;
    const template = templateSource.map((entry) => ({
        catalogUnitId: entry.catalogUnitId,
        weight: Math.max(1, Math.floor(Number(entry.weight ?? entry.qty) || 1))
    }));

    return distributeWeightedQuantities(template, totalUnits).map(({ entry, qty }) => {
        const catalogUnit = getCatalogUnitById(catalogRef, entry.catalogUnitId);
        return {
            catalogUnitId: entry.catalogUnitId,
            class: catalogUnit?.combatType || 'PHYS_INF',
            name: catalogUnit?.name || entry.catalogUnitId,
            tier: catalogUnit?.tier || 1,
            rank: stackRank,
            qty,
            injuredQty: 0,
            purpose: 'reference'
        };
    });
}

function measureTrainingArmyHp(stacks, catalog) {
    if (!Array.isArray(stacks) || !stacks.length) return 0;
    const { buildBattleArmy } = getBattleSimExports();
    return Math.max(0, Math.floor(Number(buildBattleArmy('Measure', stacks, catalog).startingHp) || 0));
}

function scaleTrainingStackQuantities(stacks, factor) {
    const f = Math.max(0.25, Math.min(2.5, Number(factor) || 1));
    return stacks.map((stack) => {
        const qty = Math.max(0, Math.floor(Number(stack?.qty) || 0));
        if (!qty) return { ...stack, qty: 0 };
        return {
            ...stack,
            qty: Math.max(1, Math.round(qty * f))
        };
    }).filter((stack) => Math.max(0, Math.floor(Number(stack?.qty) || 0)) > 0);
}

function adjustTrainingStackRanks(stacks, delta) {
    const shift = Math.floor(Number(delta) || 0);
    if (!shift) return stacks.map((stack) => ({ ...stack }));
    return stacks.map((stack) => ({
        ...stack,
        rank: Math.max(1, Math.min(6, Math.floor(Number(stack?.rank) || 1) + shift))
    }));
}

function sumTrainingStackUnits(stacks) {
    return (Array.isArray(stacks) ? stacks : []).reduce(
        (sum, stack) => sum + Math.max(0, Math.floor(Number(stack?.qty) || 0)),
        0
    );
}

/**
 * Fit rolled training host to the rank-only strength curve (randomized composition,
 * fixed curve target for this commander rank).
 */
function calibrateTrainingNpcStacks(stacks, commanderRank, catalog, modeScale = 1) {
    let calibrated = (Array.isArray(stacks) ? stacks : []).map((stack) => ({ ...stack }));
    if (!calibrated.length) return calibrated;

    const rank = clampCommanderRank(commanderRank);
    const { TRAINING_NPC_MAX_UNITS } = getBattleSimExports();
    const refHp = measureTrainingArmyHp(buildPlayerReferenceStacks(rank, catalog), catalog);
    if (!refHp) return calibrated;

    const targetHp = Math.max(
        1,
        Math.floor(refHp * resolveTrainingNpcStrengthRatio(rank) * Math.max(0.5, Math.min(1.5, Number(modeScale) || 1)))
    );

    let hp = measureTrainingArmyHp(calibrated, catalog);
    let units = sumTrainingStackUnits(calibrated);
    for (let pass = 0; pass < 10; pass += 1) {
        if (!hp) break;
        if (Math.abs(hp - targetHp) / targetHp <= 0.03) break;
        calibrated = scaleTrainingStackQuantities(calibrated, targetHp / hp);
        units = sumTrainingStackUnits(calibrated);
        if (units > TRAINING_NPC_MAX_UNITS) {
            calibrated = scaleTrainingStackQuantities(calibrated, TRAINING_NPC_MAX_UNITS / units);
        }
        hp = measureTrainingArmyHp(calibrated, catalog);
    }

    for (let step = 0; step < 24; step += 1) {
        if (hp >= targetHp * 0.97) break;

        units = sumTrainingStackUnits(calibrated);
        const maxRank = Math.max(...calibrated.map((stack) => Math.floor(Number(stack?.rank) || 1)));

        if (units < TRAINING_NPC_MAX_UNITS && hp > 0) {
            const lift = Math.min(1.1, Math.max(1.02, targetHp / hp));
            calibrated = scaleTrainingStackQuantities(calibrated, lift);
        } else if (maxRank < 6) {
            calibrated = adjustTrainingStackRanks(calibrated, 1);
        } else {
            break;
        }

        units = sumTrainingStackUnits(calibrated);
        if (units > TRAINING_NPC_MAX_UNITS) {
            calibrated = scaleTrainingStackQuantities(calibrated, TRAINING_NPC_MAX_UNITS / units);
        }
        hp = measureTrainingArmyHp(calibrated, catalog);
    }

    if (hp > targetHp * 1.04) {
        calibrated = scaleTrainingStackQuantities(calibrated, targetHp / hp);
    }

    return calibrated;
}

function resolveCurvedTrainingNpcTargetTotal(commanderRank, modeScale = 1) {
    const rank = clampCommanderRank(commanderRank);
    const refUnits = resolvePlayerReferenceTotalUnits(rank);
    const ratio = resolveTrainingNpcStrengthRatio(rank);
    const scale = Math.max(0.5, Math.min(1.5, Number(modeScale) || 1));
    const { TRAINING_NPC_MAX_UNITS } = getBattleSimExports();
    return Math.min(
        TRAINING_NPC_MAX_UNITS,
        Math.max(5, Math.round(refUnits * (0.52 + ratio * 0.46) * scale))
    );
}

module.exports = {
    MAX_COMMANDER_RANK,
    PLAYER_REFERENCE_ANCHORS,
    NPC_STRENGTH_RATIO_AT_MIN_RANK,
    NPC_STRENGTH_RATIO_AT_MAX_RANK,
    resolvePlayerReferenceTotalUnits,
    resolvePlayerReferenceAvgStackRank,
    resolveTrainingNpcStrengthRatio,
    buildPlayerReferenceStacks,
    measureTrainingArmyHp,
    calibrateTrainingNpcStacks,
    resolveCurvedTrainingNpcTargetTotal
};

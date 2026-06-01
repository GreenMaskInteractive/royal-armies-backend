/**
 * NEXUS — Per-unit battle XP, rank promotions, and tier evolution.
 *
 * Last Knights-style: only stacks whose units survived and fought in the bout earn XP,
 * weighted by lane (infantry > cavalry/beasts > ranged) toward the next promotion rank.
 */
'use strict';

const {
    loadUnitPurchaseCatalog,
    getCatalogUnitById,
    resolveCommanderAgeProvisions
} = require('./nexus-age-recruitment');
const { normalizeAgeArmy, resolveCommanderAgeArmy } = require('./nexus-age-roster');
const {
    resolveTrainingOutcomeMultiplier,
    resolveTrainingBattleDurationFactor,
    TRAINING_MODE_XP_MULTIPLIER
} = require('./nexus-age-guild-xp');

const PROMOTION_BY_RANK = Object.freeze({
    1: 'app',
    2: 'std',
    3: 'vet',
    4: 'mst',
    5: 'leg',
    6: 'elite'
});

const RANK_BY_PROMOTION = Object.freeze({
    app: 1,
    std: 2,
    vet: 3,
    mst: 4,
    leg: 5,
    elite: 6
});

/** Per-survivor XP weight by combat lane — infantry ranks fastest. */
const UNIT_LANE_XP_RATE = Object.freeze({
    infantry: 5,
    cavalry: 3.5,
    beasts: 3.5,
    ranged: 2.5
});

const PROMOTION_LABELS = Object.freeze({
    app: 'Apprentice',
    std: 'Standard',
    vet: 'Veteran',
    mst: 'Master',
    leg: 'Legendary',
    elite: 'Elite'
});

function resolveCommanderRank(commander) {
    return Math.max(1, Math.floor(Number(commander?.rank) || 1));
}

function floorNonNegative(value) {
    const numeric = Math.floor(Number(value) || 0);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
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

function resolveUnitPromotionXpRequired(currentRank, tier) {
    const rank = Math.max(1, Math.floor(Number(currentRank) || 1));
    const tierNum = Math.max(1, Math.floor(Number(tier) || 1));
    const base = 24 + rank * 8;
    const tierScale = 1 + (tierNum - 1) * 0.35;
    return Math.round(base * tierScale);
}

function resolveNextPromotionRank(stack, catalogUnit) {
    const currentRank = Math.max(1, Math.floor(Number(stack?.rank) || 1));
    const promotions = Array.isArray(catalogUnit?.promotions) ? catalogUnit.promotions : [];
    if (!promotions.length) return null;

    const currentKey = resolveStackPromotionKey(stack, catalogUnit);
    const idx = promotions.indexOf(currentKey);
    if (idx < 0 || idx >= promotions.length - 1) return null;

    const nextKey = promotions[idx + 1];
    return RANK_BY_PROMOTION[nextKey] || null;
}

function formatPromotionRankLabel(rank) {
    const key = PROMOTION_BY_RANK[Math.max(1, Math.floor(Number(rank) || 1))];
    return PROMOTION_LABELS[key] || `Rank ${rank}`;
}

function resolveTierEvolutionTarget(catalog, catalogUnitId) {
    const unit = getCatalogUnitById(catalog, catalogUnitId);
    if (!unit) return null;

    const nextTier = Math.max(1, Math.floor(Number(unit.tier) || 1)) + 1;
    const branch = String(unit.branch || 'A').trim();
    const categoryId = String(unit.categoryId || '').trim();

    return (catalog?.units || []).find((entry) => (
        entry
        && String(entry.categoryId || '').trim() === categoryId
        && String(entry.branch || 'A').trim() === branch
        && Math.floor(Number(entry.tier) || 0) === nextTier
    )) || null;
}

function stackHealthyQty(stack) {
    const qty = floorNonNegative(stack?.qty);
    const injured = Math.min(qty, floorNonNegative(stack?.injuredQty ?? stack?.injured));
    return Math.max(0, qty - injured);
}

function isStackReadyToPromote(stack, catalog) {
    const catalogUnit = getCatalogUnitById(catalog, stack?.catalogUnitId);
    if (!catalogUnit) return false;

    const nextRank = resolveNextPromotionRank(stack, catalogUnit);
    if (!nextRank) return false;

    const required = resolveUnitPromotionXpRequired(stack.rank, stack.tier);
    const unitXp = floorNonNegative(stack?.unitXp);
    return unitXp >= required;
}

function findArmyStackMatch(army, catalogUnitId, rank) {
    const id = String(catalogUnitId || '').trim();
    const rankNum = Math.max(1, Math.floor(Number(rank) || 1));
    return (Array.isArray(army) ? army : []).findIndex((stack) => (
        stack
        && String(stack.catalogUnitId || '').trim() === id
        && Math.floor(Number(stack.rank) || 0) === rankNum
    ));
}

function applyUnitXpVolatility(value) {
    const jitter = 0.92 + Math.random() * 0.16;
    return Math.max(0, Math.round(value * jitter));
}

function distributeTrainingUnitXp(battle, army, catalog, trainingMode = 'street-patrol') {
    const catalogRef = catalog || loadUnitPurchaseCatalog();
    const nextArmy = normalizeAgeArmy(army);
    const force = battle?.commanderForce;
    const battleStacks = Array.isArray(force?.stacks) ? force.stacks : [];

    if (!battleStacks.length) {
        return {
            ageArmy: nextArmy,
            unitXpGains: [],
            unitsReadyToPromote: [],
            unitXpLogLines: []
        };
    }

    const outcomeMult = resolveTrainingOutcomeMultiplier(battle);
    const duration = resolveTrainingBattleDurationFactor(battle);
    const mode = TRAINING_MODE_XP_MULTIPLIER[String(trainingMode || '').trim().toLowerCase()]
        ? String(trainingMode).trim().toLowerCase()
        : 'street-patrol';
    const modeMult = TRAINING_MODE_XP_MULTIPLIER[mode] || 0.5;

    const unitXpGains = [];
    const unitXpLogLines = [];

    battleStacks.forEach((stack) => {
        const participatingRounds = Math.max(0, Math.floor(Number(stack?.participatedRounds) || 0));
        const survivors = Math.max(0, Math.floor(Number(stack?.survivorsQty) || 0));
        if (!participatingRounds || !survivors) return;

        const catalogUnitId = String(stack?.catalogUnitId || '').trim();
        const rank = Math.max(1, Math.floor(Number(stack?.rank) || 1));
        const armyIndex = findArmyStackMatch(nextArmy, catalogUnitId, rank);
        if (armyIndex < 0) return;

        const lane = String(stack?.phaseLane || 'infantry').trim().toLowerCase();
        const laneRate = UNIT_LANE_XP_RATE[lane] || 3;
        const perSurvivor = participatingRounds * laneRate * outcomeMult * duration.factor * modeMult;
        const xpGained = applyUnitXpVolatility(perSurvivor) * survivors;
        if (!xpGained) return;

        const existing = nextArmy[armyIndex];
        const priorXp = floorNonNegative(existing?.unitXp);
        const newUnitXp = priorXp + xpGained;
        nextArmy[armyIndex] = {
            ...existing,
            unitXp: newUnitXp
        };

        const catalogUnit = getCatalogUnitById(catalogRef, catalogUnitId);
        const displayName = catalogUnit?.displayName || catalogUnit?.name || stack?.name || 'Unit';
        const required = resolveUnitPromotionXpRequired(existing.rank, existing.tier);
        const ready = isStackReadyToPromote(nextArmy[armyIndex], catalogRef);
        const nextRank = resolveNextPromotionRank(nextArmy[armyIndex], catalogUnit);

        unitXpGains.push({
            catalogUnitId,
            rank,
            name: displayName,
            lane,
            survivors,
            participatingRounds,
            xpGained,
            unitXp: newUnitXp,
            unitXpRequired: required,
            readyToPromote: ready,
            nextPromotionRank: nextRank,
            nextPromotionLabel: nextRank ? formatPromotionRankLabel(nextRank) : null
        });

        let line = `${displayName}: ${survivors} participating survivor(s) earned ${xpGained} XP (${newUnitXp}/${required})`;
        if (ready && nextRank) {
            line += ` — ready for ${formatPromotionRankLabel(nextRank)} promotion`;
        }
        unitXpLogLines.push(line);
    });

    const unitsReadyToPromote = unitXpGains
        .filter((entry) => entry.readyToPromote)
        .map((entry) => ({
            catalogUnitId: entry.catalogUnitId,
            rank: entry.rank,
            name: entry.name,
            unitXp: entry.unitXp,
            unitXpRequired: entry.unitXpRequired,
            nextPromotionRank: entry.nextPromotionRank,
            nextPromotionLabel: entry.nextPromotionLabel
        }));

    return {
        ageArmy: nextArmy,
        unitXpGains,
        unitsReadyToPromote,
        unitXpLogLines
    };
}

function scanArmyReadyToPromote(army, catalog) {
    const catalogRef = catalog || loadUnitPurchaseCatalog();
    const ready = [];

    normalizeAgeArmy(army).forEach((stack) => {
        if (!isStackReadyToPromote(stack, catalogRef)) return;

        const catalogUnit = getCatalogUnitById(catalogRef, stack.catalogUnitId);
        const nextRank = resolveNextPromotionRank(stack, catalogUnit);
        ready.push({
            catalogUnitId: stack.catalogUnitId,
            rank: stack.rank,
            name: catalogUnit?.displayName || catalogUnit?.name || stack.name || 'Unit',
            qty: stackHealthyQty(stack),
            unitXp: floorNonNegative(stack.unitXp),
            unitXpRequired: resolveUnitPromotionXpRequired(stack.rank, stack.tier),
            nextPromotionRank: nextRank,
            nextPromotionLabel: nextRank ? formatPromotionRankLabel(nextRank) : null,
            tier: stack.tier
        });
    });

    return ready;
}

function resolveRankPromotionProvisionCost(stack, catalog) {
    const catalogUnit = getCatalogUnitById(catalog, stack?.catalogUnitId);
    if (!catalogUnit) return 0;

    const nextRank = resolveNextPromotionRank(stack, catalogUnit);
    if (!nextRank) return 0;

    const nextKey = PROMOTION_BY_RANK[nextRank];
    const upc = Math.max(0, Math.floor(Number(catalogUnit?.stats?.[nextKey]?.upc) || 0));
    return upc * stackHealthyQty(stack);
}

function resolveTierEvolutionProvisionCost(stack, catalog) {
    const catalogUnit = getCatalogUnitById(catalog, stack?.catalogUnitId);
    if (!catalogUnit) return 0;

    const perUnit = Math.max(0, Math.floor(Number(catalogUnit.tierEvolutionCost) || 0));
    return perUnit * stackHealthyQty(stack);
}

function buildUnitEvolutionStackRow(stack, catalog, commanderRank) {
    const catalogUnit = getCatalogUnitById(catalog, stack?.catalogUnitId);
    if (!catalogUnit) return null;

    const healthyQty = stackHealthyQty(stack);
    if (!healthyQty) return null;

    const nextRank = resolveNextPromotionRank(stack, catalogUnit);
    const xpRequired = resolveUnitPromotionXpRequired(stack.rank, stack.tier);
    const unitXp = floorNonNegative(stack?.unitXp);
    const rankCost = nextRank ? resolveRankPromotionProvisionCost(stack, catalog) : 0;
    const evolveTarget = resolveTierEvolutionTarget(catalog, stack.catalogUnitId);
    const tierCost = evolveTarget ? resolveTierEvolutionProvisionCost(stack, catalog) : 0;
    const evolveUnlockRank = evolveTarget ? Math.max(1, Math.floor(Number(evolveTarget.unlockRank) || 1)) : 0;

    return {
        catalogUnitId: stack.catalogUnitId,
        rank: stack.rank,
        tier: stack.tier,
        qty: stack.qty,
        healthyQty,
        injuredQty: Math.min(floorNonNegative(stack.qty), floorNonNegative(stack.injuredQty)),
        name: catalogUnit.displayName || catalogUnit.name || stack.name,
        unitXp,
        unitXpRequired: xpRequired,
        readyToPromote: Boolean(nextRank && unitXp >= xpRequired),
        currentPromotionLabel: formatPromotionRankLabel(stack.rank),
        nextPromotionRank: nextRank,
        nextPromotionLabel: nextRank ? formatPromotionRankLabel(nextRank) : null,
        rankPromotionCost: rankCost,
        canPromoteRank: Boolean(
            nextRank
            && unitXp >= xpRequired
            && rankCost > 0
        ),
        evolveTargetId: evolveTarget?.id || null,
        evolveTargetName: evolveTarget?.displayName || evolveTarget?.name || null,
        evolveTargetTier: evolveTarget?.tier || null,
        tierEvolutionCost: tierCost,
        canEvolveTier: Boolean(
            evolveTarget
            && commanderRank >= evolveUnlockRank
            && tierCost > 0
        ),
        evolveUnlockRank
    };
}

function buildUnitEvolutionPayload(commander, catalog) {
    const catalogRef = catalog || loadUnitPurchaseCatalog();
    const army = resolveCommanderAgeArmy(commander);
    const commanderRank = resolveCommanderRank(commander);
    const provisions = resolveCommanderAgeProvisions(commander);

    const stacks = normalizeAgeArmy(army)
        .map((stack) => buildUnitEvolutionStackRow(stack, catalogRef, commanderRank))
        .filter(Boolean);

    return {
        ageProvisions: provisions,
        commanderRank,
        stacks,
        readyCount: stacks.filter((row) => row.readyToPromote).length
    };
}

function mergeEvolvedStackIntoArmy(army, evolvedStack) {
    const next = Array.isArray(army) ? army.slice() : [];
    const matchIndex = next.findIndex((stack) => (
        stack
        && stack.catalogUnitId === evolvedStack.catalogUnitId
        && Math.floor(Number(stack.rank) || 0) === evolvedStack.rank
    ));

    if (matchIndex >= 0) {
        const existing = next[matchIndex];
        next[matchIndex] = {
            ...existing,
            qty: floorNonNegative(existing.qty) + floorNonNegative(evolvedStack.qty),
            injuredQty: floorNonNegative(existing.injuredQty) + floorNonNegative(evolvedStack.injuredQty)
        };
    } else {
        next.push(evolvedStack);
    }

    return normalizeAgeArmy(next);
}

function executeUnitRankPromotion(commander, catalogUnitId, rank) {
    const catalog = loadUnitPurchaseCatalog();
    const army = resolveCommanderAgeArmy(commander);
    const id = String(catalogUnitId || '').trim();
    const rankNum = Math.max(1, Math.floor(Number(rank) || 1));
    const stackIndex = findArmyStackMatch(army, id, rankNum);

    if (stackIndex < 0) {
        return { ok: false, errorCode: 'NEXUS-AGE-012' };
    }

    const stack = army[stackIndex];
    const catalogUnit = getCatalogUnitById(catalog, id);
    if (!catalogUnit) {
        return { ok: false, errorCode: 'NEXUS-AGE-012' };
    }

    if (!isStackReadyToPromote(stack, catalog)) {
        return { ok: false, errorCode: 'NEXUS-AGE-027' };
    }

    const nextRank = resolveNextPromotionRank(stack, catalogUnit);
    if (!nextRank) {
        return { ok: false, errorCode: 'NEXUS-AGE-027' };
    }

    const provisionCost = resolveRankPromotionProvisionCost(stack, catalog);
    const provisions = resolveCommanderAgeProvisions(commander);
    if (provisionCost <= 0 || provisions < provisionCost) {
        return { ok: false, errorCode: 'NEXUS-AGE-016' };
    }

    const nextArmy = army.slice();
    nextArmy[stackIndex] = {
        ...stack,
        rank: nextRank,
        unitXp: 0
    };

    return {
        ok: true,
        ageArmy: normalizeAgeArmy(nextArmy),
        ageProvisions: provisions - provisionCost,
        provisionsSpent: provisionCost,
        promotedFrom: rankNum,
        promotedTo: nextRank,
        promotionLabel: formatPromotionRankLabel(nextRank),
        unitName: catalogUnit.displayName || catalogUnit.name
    };
}

function executeUnitTierEvolution(commander, catalogUnitId, rank) {
    const catalog = loadUnitPurchaseCatalog();
    const army = resolveCommanderAgeArmy(commander);
    const id = String(catalogUnitId || '').trim();
    const rankNum = Math.max(1, Math.floor(Number(rank) || 1));
    const stackIndex = findArmyStackMatch(army, id, rankNum);

    if (stackIndex < 0) {
        return { ok: false, errorCode: 'NEXUS-AGE-012' };
    }

    const stack = army[stackIndex];
    const catalogUnit = getCatalogUnitById(catalog, id);
    const evolveTarget = resolveTierEvolutionTarget(catalog, id);

    if (!catalogUnit || !evolveTarget) {
        return { ok: false, errorCode: 'NEXUS-AGE-012' };
    }

    const commanderRank = resolveCommanderRank(commander);
    const unlockRank = Math.max(1, Math.floor(Number(evolveTarget.unlockRank) || 1));
    if (commanderRank < unlockRank) {
        return { ok: false, errorCode: 'NEXUS-AGE-015', unlockRank };
    }

    const healthyQty = stackHealthyQty(stack);
    if (!healthyQty) {
        return { ok: false, errorCode: 'NEXUS-AGE-017' };
    }

    const provisionCost = resolveTierEvolutionProvisionCost(stack, catalog);
    const provisions = resolveCommanderAgeProvisions(commander);
    if (provisionCost <= 0 || provisions < provisionCost) {
        return { ok: false, errorCode: 'NEXUS-AGE-016' };
    }

    const firstPromotion = Array.isArray(evolveTarget.promotions) && evolveTarget.promotions.length
        ? evolveTarget.promotions[0]
        : 'app';
    const newRank = RANK_BY_PROMOTION[firstPromotion] || 1;

    const evolvedStack = {
        catalogUnitId: evolveTarget.id,
        class: String(evolveTarget.combatType || stack.class || 'PHYS_INF').trim(),
        name: String(evolveTarget.name || stack.name).trim(),
        tier: Math.max(1, Math.floor(Number(evolveTarget.tier) || 1)),
        rank: newRank,
        qty: healthyQty,
        injuredQty: 0,
        unitXp: 0,
        purpose: stack.purpose || 'rank'
    };

    let nextArmy = army.slice();
    const remainingQty = floorNonNegative(stack.qty) - healthyQty;
    const remainingInjured = Math.min(
        remainingQty,
        floorNonNegative(stack.injuredQty)
    );

    if (remainingQty > 0) {
        nextArmy[stackIndex] = {
            ...stack,
            qty: remainingQty,
            injuredQty: remainingInjured
        };
    } else {
        nextArmy.splice(stackIndex, 1);
    }

    nextArmy = mergeEvolvedStackIntoArmy(nextArmy, evolvedStack);

    return {
        ok: true,
        ageArmy: normalizeAgeArmy(nextArmy),
        ageProvisions: provisions - provisionCost,
        provisionsSpent: provisionCost,
        fromUnitId: id,
        toUnitId: evolveTarget.id,
        fromName: catalogUnit.displayName || catalogUnit.name,
        toName: evolveTarget.displayName || evolveTarget.name,
        unitsEvolved: healthyQty
    };
}

module.exports = {
    PROMOTION_BY_RANK,
    RANK_BY_PROMOTION,
    PROMOTION_LABELS,
    UNIT_LANE_XP_RATE,
    formatPromotionRankLabel,
    resolveUnitPromotionXpRequired,
    resolveNextPromotionRank,
    resolveTierEvolutionTarget,
    isStackReadyToPromote,
    distributeTrainingUnitXp,
    scanArmyReadyToPromote,
    buildUnitEvolutionPayload,
    executeUnitRankPromotion,
    executeUnitTierEvolution,
    resolveRankPromotionProvisionCost,
    resolveTierEvolutionProvisionCost
};

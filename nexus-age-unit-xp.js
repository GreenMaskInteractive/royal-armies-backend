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
const { normalizeAgeArmy, resolveCommanderAgeArmy, normalizeUnitXpEachSlots } = require('./nexus-age-roster');
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
    infantry: 4.2,
    cavalry: 3,
    beasts: 3,
    ranged: 2.1
});

/** Solo guild drills only — commander guild XP uses separate curves in nexus-age-guild-xp.js. */
const UNIT_TRAINING_XP_SCALE = 0.72;

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
    const base = 38 + rank * 11;
    const tierScale = 1 + (tierNum - 1) * 0.38;
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

function ensureUnitXpEach(stack) {
    const qty = floorNonNegative(stack?.qty);
    return normalizeUnitXpEachSlots(stack, qty);
}

function resolveHealthyUnitXpValues(stack) {
    const slots = ensureUnitXpEach(stack);
    const healthyQty = stackHealthyQty(stack);
    return slots.slice(0, healthyQty);
}

function resolveStackUnitXpSummary(stack, xpRequired) {
    const healthyXp = resolveHealthyUnitXpValues(stack);
    const required = Math.max(0, Math.floor(Number(xpRequired) || 0));
    const unitXpMin = healthyXp.length ? Math.min(...healthyXp) : 0;
    const unitXpMax = healthyXp.length ? Math.max(...healthyXp) : 0;
    const readyUnitCount = required > 0
        ? healthyXp.filter((xp) => xp >= required).length
        : 0;

    return {
        unitXpMin,
        unitXpMax,
        readyUnitCount,
        unitXpEach: ensureUnitXpEach(stack)
    };
}

function pickRandomIndices(count, poolSize) {
    const take = Math.min(Math.max(0, Math.floor(Number(count) || 0)), poolSize);
    const indices = Array.from({ length: poolSize }, (_, index) => index);
    const picked = [];

    for (let step = 0; step < take; step += 1) {
        const slot = Math.floor(Math.random() * indices.length);
        picked.push(indices.splice(slot, 1)[0]);
    }

    return picked;
}

function swapRandomHealthyUnitToInjured(stack) {
    const qty = floorNonNegative(stack?.qty);
    const injuredQty = Math.min(qty, floorNonNegative(stack?.injuredQty ?? stack?.injured));
    const healthyQty = Math.max(0, qty - injuredQty);
    if (!healthyQty) return stack;

    const slots = ensureUnitXpEach(stack);
    const pick = Math.floor(Math.random() * healthyQty);
    const boundary = healthyQty - 1;
    if (pick !== boundary) {
        const temp = slots[pick];
        slots[pick] = slots[boundary];
        slots[boundary] = temp;
    }

    return {
        ...stack,
        unitXpEach: slots,
        injuredQty: injuredQty + 1
    };
}

function swapRandomInjuredUnitToHealthy(stack) {
    const qty = floorNonNegative(stack?.qty);
    const injuredQty = Math.min(qty, floorNonNegative(stack?.injuredQty ?? stack?.injured));
    if (!injuredQty) return stack;

    const healthyQty = qty - injuredQty;
    const slots = ensureUnitXpEach(stack);
    const pick = healthyQty + Math.floor(Math.random() * injuredQty);
    const boundary = healthyQty - 1;
    if (pick !== boundary) {
        const temp = slots[pick];
        slots[pick] = slots[boundary];
        slots[boundary] = temp;
    }

    return {
        ...stack,
        unitXpEach: slots,
        injuredQty: injuredQty - 1
    };
}

function isStackReadyToPromote(stack, catalog) {
    const catalogUnit = getCatalogUnitById(catalog, stack?.catalogUnitId);
    if (!catalogUnit) return false;

    const nextRank = resolveNextPromotionRank(stack, catalogUnit);
    if (!nextRank) return false;

    const required = resolveUnitPromotionXpRequired(stack.rank, stack.tier);
    return resolveStackUnitXpSummary(stack, required).readyUnitCount > 0;
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
        const perSurvivor = participatingRounds * laneRate * outcomeMult * duration.factor * modeMult * UNIT_TRAINING_XP_SCALE;
        if (!perSurvivor) return;

        const existing = nextArmy[armyIndex];
        const slots = ensureUnitXpEach(existing);
        const healthyQty = stackHealthyQty(existing);
        const survivorCount = Math.min(survivors, healthyQty);
        const participantIndices = pickRandomIndices(survivorCount, healthyQty);
        if (!participantIndices.length) return;

        let totalXpGained = 0;
        participantIndices.forEach((slotIndex) => {
            const gain = applyUnitXpVolatility(perSurvivor);
            slots[slotIndex] = floorNonNegative(slots[slotIndex]) + gain;
            totalXpGained += gain;
        });
        if (!totalXpGained) return;

        nextArmy[armyIndex] = {
            ...existing,
            unitXpEach: slots
        };

        const catalogUnit = getCatalogUnitById(catalogRef, catalogUnitId);
        const displayName = catalogUnit?.displayName || catalogUnit?.name || stack?.name || 'Unit';
        const required = resolveUnitPromotionXpRequired(existing.rank, existing.tier);
        const xpSummary = resolveStackUnitXpSummary(nextArmy[armyIndex], required);
        const ready = isStackReadyToPromote(nextArmy[armyIndex], catalogRef);
        const nextRank = resolveNextPromotionRank(nextArmy[armyIndex], catalogUnit);

        unitXpGains.push({
            catalogUnitId,
            rank,
            name: displayName,
            lane,
            survivors: survivorCount,
            participatingRounds,
            xpGained: totalXpGained,
            unitXpMin: xpSummary.unitXpMin,
            unitXpMax: xpSummary.unitXpMax,
            readyUnitCount: xpSummary.readyUnitCount,
            unitXpRequired: required,
            readyToPromote: ready,
            nextPromotionRank: nextRank,
            nextPromotionLabel: nextRank ? formatPromotionRankLabel(nextRank) : null
        });

        const xpRangeLabel = xpSummary.unitXpMin === xpSummary.unitXpMax
            ? `${xpSummary.unitXpMin}`
            : `${xpSummary.unitXpMin}–${xpSummary.unitXpMax}`;
        let line = `${displayName}: ${survivorCount} participating survivor(s) earned ${totalXpGained} XP (${xpRangeLabel}/${required})`;
        if (ready && nextRank) {
            line += ` — ${xpSummary.readyUnitCount} ready for ${formatPromotionRankLabel(nextRank)} promotion`;
        }
        unitXpLogLines.push(line);
    });

    const unitsReadyToPromote = unitXpGains
        .filter((entry) => entry.readyToPromote)
        .map((entry) => ({
            catalogUnitId: entry.catalogUnitId,
            rank: entry.rank,
            name: entry.name,
            qty: entry.readyUnitCount,
            unitXpMin: entry.unitXpMin,
            unitXpMax: entry.unitXpMax,
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
        const unitXpRequired = resolveUnitPromotionXpRequired(stack.rank, stack.tier);
        const xpSummary = resolveStackUnitXpSummary(stack, unitXpRequired);
        ready.push({
            catalogUnitId: stack.catalogUnitId,
            rank: stack.rank,
            name: catalogUnit?.displayName || catalogUnit?.name || stack.name || 'Unit',
            qty: xpSummary.readyUnitCount,
            unitXpMin: xpSummary.unitXpMin,
            unitXpMax: xpSummary.unitXpMax,
            unitXpRequired,
            nextPromotionRank: nextRank,
            nextPromotionLabel: nextRank ? formatPromotionRankLabel(nextRank) : null,
            tier: stack.tier
        });
    });

    return ready;
}

function resolveRankPromotionProvisionCost(stack, catalog, quantity) {
    const catalogUnit = getCatalogUnitById(catalog, stack?.catalogUnitId);
    if (!catalogUnit) return 0;

    const nextRank = resolveNextPromotionRank(stack, catalogUnit);
    if (!nextRank) return 0;

    const nextKey = PROMOTION_BY_RANK[nextRank];
    const upc = Math.max(0, Math.floor(Number(catalogUnit?.stats?.[nextKey]?.upc) || 0));
    const qty = normalizeActionQuantity(quantity, stackHealthyQty(stack));
    return upc * qty;
}

function resolveRankPromotionProvisionCostPerUnit(stack, catalog) {
    const catalogUnit = getCatalogUnitById(catalog, stack?.catalogUnitId);
    if (!catalogUnit) return 0;

    const nextRank = resolveNextPromotionRank(stack, catalogUnit);
    if (!nextRank) return 0;

    const nextKey = PROMOTION_BY_RANK[nextRank];
    return Math.max(0, Math.floor(Number(catalogUnit?.stats?.[nextKey]?.upc) || 0));
}

function resolveTierEvolutionProvisionCost(stack, catalog, quantity) {
    const catalogUnit = getCatalogUnitById(catalog, stack?.catalogUnitId);
    if (!catalogUnit) return 0;

    const perUnit = Math.max(0, Math.floor(Number(catalogUnit.tierEvolutionCost) || 0));
    const qty = normalizeActionQuantity(quantity, stackHealthyQty(stack));
    return perUnit * qty;
}

function resolveTierEvolutionProvisionCostPerUnit(stack, catalog) {
    const catalogUnit = getCatalogUnitById(catalog, stack?.catalogUnitId);
    if (!catalogUnit) return 0;
    return Math.max(0, Math.floor(Number(catalogUnit.tierEvolutionCost) || 0));
}

function normalizeActionQuantity(rawQuantity, maxQuantity) {
    const max = Math.max(0, Math.floor(Number(maxQuantity) || 0));
    if (!max) return 0;

    const quantity = Math.floor(Number(rawQuantity) || 0);
    if (!Number.isFinite(quantity) || quantity < 1) return 0;
    return Math.min(max, quantity);
}

function subtractHealthyUnitsFromStack(stack, count) {
    return extractHealthyUnitsFromStack(stack, count);
}

function extractHealthyUnitsFromStack(stack, count, options = {}) {
    const qty = floorNonNegative(stack?.qty);
    const injuredQty = Math.min(qty, floorNonNegative(stack?.injuredQty ?? stack?.injured));
    const healthyQty = Math.max(0, qty - injuredQty);
    const take = Math.min(Math.max(0, Math.floor(Number(count) || 0)), healthyQty);
    const xpRequired = Math.max(0, Math.floor(Number(options.xpRequired) || 0));
    const slots = ensureUnitXpEach(stack);

    const eligible = [];
    for (let index = 0; index < healthyQty; index += 1) {
        if (xpRequired > 0 && slots[index] < xpRequired) continue;
        eligible.push({ index, xp: slots[index] });
    }

    if (xpRequired > 0) {
        eligible.sort((left, right) => right.xp - left.xp);
    }

    const picked = eligible.slice(0, take);
    if (picked.length < take) {
        return { take: 0, remaining: stack, extractedSlots: [] };
    }

    const removeIndices = new Set(picked.map((entry) => entry.index));
    const extractedSlots = picked.map((entry) => entry.xp);
    const remainingSlots = slots.filter((_, index) => !removeIndices.has(index));

    return {
        take,
        extractedSlots,
        remaining: {
            ...stack,
            qty: qty - take,
            injuredQty,
            unitXpEach: remainingSlots
        }
    };
}

function resolveMaxAffordableQuantity(provisions, perUnitCost, maxQuantity) {
    const perUnit = Math.max(0, Math.floor(Number(perUnitCost) || 0));
    const max = Math.max(0, Math.floor(Number(maxQuantity) || 0));
    if (!max) return 0;
    if (!perUnit) return max;

    const provisionCap = Math.floor(Math.max(0, Math.floor(Number(provisions) || 0)) / perUnit);
    return Math.min(max, provisionCap);
}

function buildUnitEvolutionStackRow(stack, catalog, commanderRank, provisions) {
    const catalogUnit = getCatalogUnitById(catalog, stack?.catalogUnitId);
    if (!catalogUnit) return null;

    const healthyQty = stackHealthyQty(stack);
    if (!healthyQty) return null;

    const nextRank = resolveNextPromotionRank(stack, catalogUnit);
    const xpRequired = resolveUnitPromotionXpRequired(stack.rank, stack.tier);
    const xpSummary = resolveStackUnitXpSummary(stack, xpRequired);
    const rankCostPerUnit = nextRank ? resolveRankPromotionProvisionCostPerUnit(stack, catalog) : 0;
    const evolveTarget = resolveTierEvolutionTarget(catalog, stack.catalogUnitId);
    const tierCostPerUnit = resolveTierEvolutionProvisionCostPerUnit(stack, catalog);
    const evolveUnlockRank = evolveTarget ? Math.max(1, Math.floor(Number(evolveTarget.unlockRank) || 1)) : 0;
    const readyToPromote = Boolean(nextRank && xpSummary.readyUnitCount > 0);
    const maxRankPromoteQty = readyToPromote
        ? resolveMaxAffordableQuantity(provisions, rankCostPerUnit, xpSummary.readyUnitCount)
        : 0;
    const maxEvolveQty = evolveTarget && commanderRank >= evolveUnlockRank
        ? resolveMaxAffordableQuantity(provisions, tierCostPerUnit, healthyQty)
        : 0;

    return {
        catalogUnitId: stack.catalogUnitId,
        rank: stack.rank,
        tier: stack.tier,
        qty: stack.qty,
        healthyQty,
        injuredQty: Math.min(floorNonNegative(stack.qty), floorNonNegative(stack.injuredQty)),
        name: catalogUnit.displayName || catalogUnit.name || stack.name,
        unitXpMin: xpSummary.unitXpMin,
        unitXpMax: xpSummary.unitXpMax,
        readyUnitCount: xpSummary.readyUnitCount,
        unitXpRequired: xpRequired,
        readyToPromote,
        currentPromotionLabel: formatPromotionRankLabel(stack.rank),
        nextPromotionRank: nextRank,
        nextPromotionLabel: nextRank ? formatPromotionRankLabel(nextRank) : null,
        promotionBandLabel: nextRank
            ? `${formatPromotionRankLabel(stack.rank)} → ${formatPromotionRankLabel(nextRank)}`
            : formatPromotionRankLabel(stack.rank),
        rankPromotionCostPerUnit: rankCostPerUnit,
        rankPromotionCost: rankCostPerUnit * healthyQty,
        maxRankPromoteQty,
        canPromoteRank: Boolean(readyToPromote && maxRankPromoteQty > 0 && rankCostPerUnit > 0),
        evolveTargetId: evolveTarget?.id || null,
        evolveTargetName: evolveTarget?.displayName || evolveTarget?.name || null,
        evolveTargetTier: evolveTarget?.tier || null,
        tierEvolutionCostPerUnit: tierCostPerUnit,
        tierEvolutionCost: tierCostPerUnit * healthyQty,
        maxEvolveQty,
        canEvolveTier: Boolean(
            evolveTarget
            && commanderRank >= evolveUnlockRank
            && maxEvolveQty > 0
            && tierCostPerUnit > 0
        ),
        evolveUnlockRank,
        evolveBandLabel: evolveTarget
            ? `Tier ${stack.tier} → Tier ${evolveTarget.tier}`
            : null
    };
}

function groupStacksByPromotionBand(stacks) {
    const map = new Map();

    (Array.isArray(stacks) ? stacks : []).forEach((stack) => {
        const label = String(stack?.promotionBandLabel || stack?.currentPromotionLabel || 'Promotion').trim();
        if (!map.has(label)) {
            map.set(label, {
                id: `band-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
                label,
                stacks: []
            });
        }
        map.get(label).stacks.push(stack);
    });

    return Array.from(map.values())
        .sort((left, right) => {
            const leftTier = Math.min(...left.stacks.map((s) => Math.floor(Number(s.tier) || 1)));
            const rightTier = Math.min(...right.stacks.map((s) => Math.floor(Number(s.tier) || 1)));
            if (leftTier !== rightTier) return leftTier - rightTier;
            const leftRank = Math.min(...left.stacks.map((s) => Math.floor(Number(s.rank) || 1)));
            const rightRank = Math.min(...right.stacks.map((s) => Math.floor(Number(s.rank) || 1)));
            if (leftRank !== rightRank) return leftRank - rightRank;
            return String(left.label).localeCompare(String(right.label));
        })
        .map((group) => ({
            ...group,
            stacks: group.stacks.slice().sort((left, right) => {
                const tierDiff = Math.floor(Number(left.tier) || 0) - Math.floor(Number(right.tier) || 0);
                if (tierDiff) return tierDiff;
                const rankDiff = Math.floor(Number(left.rank) || 0) - Math.floor(Number(right.rank) || 0);
                if (rankDiff) return rankDiff;
                return String(left.name || '').localeCompare(String(right.name || ''));
            })
        }));
}

function groupStacksByTier(stacks) {
    const map = new Map();

    (Array.isArray(stacks) ? stacks : []).forEach((stack) => {
        const tier = Math.max(1, Math.floor(Number(stack?.tier) || 1));
        if (!map.has(tier)) {
            map.set(tier, {
                id: `tier-${tier}`,
                tier,
                label: `Tier ${tier}`,
                stacks: []
            });
        }
        map.get(tier).stacks.push(stack);
    });

    return Array.from(map.values())
        .sort((left, right) => left.tier - right.tier)
        .map((group) => ({
            ...group,
            stacks: group.stacks.slice().sort((left, right) => {
                const rankDiff = Math.floor(Number(left.rank) || 0) - Math.floor(Number(right.rank) || 0);
                if (rankDiff) return rankDiff;
                return String(left.name || '').localeCompare(String(right.name || ''));
            })
        }));
}

function groupEvolveStacksByTransition(stacks) {
    const map = new Map();

    (Array.isArray(stacks) ? stacks : []).forEach((stack) => {
        const fromTier = Math.max(1, Math.floor(Number(stack?.tier) || 1));
        const toTier = Math.max(fromTier + 1, Math.floor(Number(stack?.evolveTargetTier) || fromTier + 1));
        const key = `${fromTier}-${toTier}`;
        if (!map.has(key)) {
            map.set(key, {
                id: `evolve-${key}`,
                fromTier,
                toTier,
                label: `Tier ${fromTier} → Tier ${toTier}`,
                stacks: []
            });
        }
        map.get(key).stacks.push(stack);
    });

    return Array.from(map.values()).sort((left, right) => left.fromTier - right.fromTier);
}

function buildUnitEvolutionCategories(stacks) {
    const rankStacks = (Array.isArray(stacks) ? stacks : []).filter((stack) => stack?.canPromoteRank);
    const evolveStacks = (Array.isArray(stacks) ? stacks : []).filter((stack) => stack?.canEvolveTier);
    const categories = [];

    if (rankStacks.length) {
        categories.push({
            id: 'rank-promotion',
            label: 'Rank promotions ready',
            groups: groupStacksByPromotionBand(rankStacks)
        });
    }

    if (evolveStacks.length) {
        categories.push({
            id: 'tier-evolution',
            label: 'Tier evolution available',
            groups: groupEvolveStacksByTransition(evolveStacks)
        });
    }

    return categories;
}

function buildUnitEvolutionPayload(commander, catalog) {
    const catalogRef = catalog || loadUnitPurchaseCatalog();
    const army = resolveCommanderAgeArmy(commander);
    const commanderRank = resolveCommanderRank(commander);
    const provisions = resolveCommanderAgeProvisions(commander);

    const stacks = normalizeAgeArmy(army)
        .map((stack) => buildUnitEvolutionStackRow(stack, catalogRef, commanderRank, provisions))
        .filter(Boolean);

    const categories = buildUnitEvolutionCategories(stacks);

    return {
        ageProvisions: provisions,
        commanderRank,
        stacks,
        categories,
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
        const existingSlots = ensureUnitXpEach(existing);
        const evolvedSlots = ensureUnitXpEach(evolvedStack);
        next[matchIndex] = {
            ...existing,
            qty: floorNonNegative(existing.qty) + floorNonNegative(evolvedStack.qty),
            injuredQty: floorNonNegative(existing.injuredQty) + floorNonNegative(evolvedStack.injuredQty),
            unitXpEach: existingSlots.concat(evolvedSlots)
        };
    } else {
        next.push({
            ...evolvedStack,
            unitXpEach: ensureUnitXpEach(evolvedStack)
        });
    }

    return normalizeAgeArmy(next);
}

function executeUnitRankPromotion(commander, catalogUnitId, rank, quantity) {
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

    const healthyQty = stackHealthyQty(stack);
    const xpRequired = resolveUnitPromotionXpRequired(stack.rank, stack.tier);
    const readyCount = resolveStackUnitXpSummary(stack, xpRequired).readyUnitCount;
    const promoteQty = normalizeActionQuantity(quantity, Math.min(healthyQty, readyCount));
    if (!promoteQty) {
        return { ok: false, errorCode: 'NEXUS-AGE-013' };
    }

    const upcPerUnit = resolveRankPromotionProvisionCostPerUnit(stack, catalog);
    const provisionCost = upcPerUnit * promoteQty;
    const provisions = resolveCommanderAgeProvisions(commander);
    if (provisionCost <= 0 || provisions < provisionCost) {
        return { ok: false, errorCode: 'NEXUS-AGE-016' };
    }

    const extraction = extractHealthyUnitsFromStack(stack, promoteQty, { xpRequired });
    if (!extraction.take) {
        return { ok: false, errorCode: 'NEXUS-AGE-017' };
    }

    let nextArmy = army.slice();
    if (floorNonNegative(extraction.remaining.qty) > 0) {
        nextArmy[stackIndex] = extraction.remaining;
    } else {
        nextArmy.splice(stackIndex, 1);
    }

    const promotedStack = {
        ...stack,
        rank: nextRank,
        qty: extraction.take,
        injuredQty: 0,
        unitXpEach: Array(extraction.take).fill(0)
    };
    nextArmy = mergeEvolvedStackIntoArmy(nextArmy, promotedStack);

    return {
        ok: true,
        ageArmy: normalizeAgeArmy(nextArmy),
        ageProvisions: provisions - provisionCost,
        provisionsSpent: provisionCost,
        quantityPromoted: extraction.take,
        promotedFrom: rankNum,
        promotedTo: nextRank,
        promotionLabel: formatPromotionRankLabel(nextRank),
        unitName: catalogUnit.displayName || catalogUnit.name
    };
}

function executeUnitTierEvolution(commander, catalogUnitId, rank, quantity) {
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
    const evolveQty = normalizeActionQuantity(quantity, healthyQty);
    if (!evolveQty) {
        return { ok: false, errorCode: 'NEXUS-AGE-013' };
    }

    const perUnit = resolveTierEvolutionProvisionCostPerUnit(stack, catalog);
    const provisionCost = perUnit * evolveQty;
    const provisions = resolveCommanderAgeProvisions(commander);
    if (provisionCost <= 0 || provisions < provisionCost) {
        return { ok: false, errorCode: 'NEXUS-AGE-016' };
    }

    const firstPromotion = Array.isArray(evolveTarget.promotions) && evolveTarget.promotions.length
        ? evolveTarget.promotions[0]
        : 'app';
    const newRank = RANK_BY_PROMOTION[firstPromotion] || 1;

    const extraction = extractHealthyUnitsFromStack(stack, evolveQty);
    if (!extraction.take) {
        return { ok: false, errorCode: 'NEXUS-AGE-017' };
    }

    const evolvedStack = {
        catalogUnitId: evolveTarget.id,
        class: String(evolveTarget.combatType || stack.class || 'PHYS_INF').trim(),
        name: String(evolveTarget.name || stack.name).trim(),
        tier: Math.max(1, Math.floor(Number(evolveTarget.tier) || 1)),
        rank: newRank,
        qty: extraction.take,
        injuredQty: 0,
        unitXpEach: Array(extraction.take).fill(0),
        purpose: stack.purpose || 'rank'
    };

    let nextArmy = army.slice();
    if (floorNonNegative(extraction.remaining.qty) > 0) {
        nextArmy[stackIndex] = extraction.remaining;
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
        unitsEvolved: extraction.take
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
    swapRandomHealthyUnitToInjured,
    swapRandomInjuredUnitToHealthy,
    ensureUnitXpEach,
    resolveStackUnitXpSummary,
    distributeTrainingUnitXp,
    scanArmyReadyToPromote,
    buildUnitEvolutionPayload,
    buildUnitEvolutionCategories,
    executeUnitRankPromotion,
    executeUnitTierEvolution,
    resolveRankPromotionProvisionCost,
    resolveRankPromotionProvisionCostPerUnit,
    resolveTierEvolutionProvisionCost,
    resolveTierEvolutionProvisionCostPerUnit,
    normalizeActionQuantity
};

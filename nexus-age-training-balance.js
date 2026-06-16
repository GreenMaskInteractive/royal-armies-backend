/**
 * NEXUS — Guild training roster context (fill, power, army quality).
 * Post-battle injury depth only — does not influence NPC host generation.
 * Win/loss emerges from rank-scaled NPC sim + the commander's actual fielded army.
 */
'use strict';

function getTrainingSimExports() {
    return require('./nexus-age-battle-sim');
}

function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}

function isTrainingCombatModifiersEnabled() {
    return String(process.env.NEXUS_TRAINING_COMBAT_MODIFIERS || '').trim().toLowerCase() === 'true';
}

function resolveExpectedTrainingHostUnits(commanderRank, trainingMode = 'street-patrol') {
    const { TRAINING_MODE_NPC_SCALE } = getTrainingSimExports();
    const { resolvePlayerReferenceTotalUnits } = require('./nexus-age-training-progression');
    const rank = Math.max(1, Math.min(22, Math.floor(Number(commanderRank) || 1)));
    const mode = String(trainingMode || 'street-patrol').trim().toLowerCase();
    const modeScale = TRAINING_MODE_NPC_SCALE[mode] || TRAINING_MODE_NPC_SCALE['street-patrol'];
    return Math.max(1, Math.round(resolvePlayerReferenceTotalUnits(rank) * modeScale));
}

function resolveArmyQualityFromHealthyStacks(stacks, catalog) {
    if (!Array.isArray(stacks) || !stacks.length || !catalog) return 0;

    const { getCatalogUnitById } = require('./nexus-age-recruitment');
    let qtySum = 0;
    let tierSum = 0;
    let rankSum = 0;

    stacks.forEach((stack) => {
        const qty = Math.max(0, Math.floor(Number(stack?.qty) || 0));
        if (!qty) return;
        const unit = getCatalogUnitById(catalog, stack?.catalogUnitId);
        const tier = Math.max(1, Math.floor(Number(unit?.tier ?? stack?.tier) || 1));
        const rank = Math.max(1, Math.min(6, Math.floor(Number(stack?.rank) || 1)));
        qtySum += qty;
        tierSum += tier * qty;
        rankSum += rank * qty;
    });

    if (!qtySum) return 0;

    const avgTier = tierSum / qtySum;
    const avgRank = rankSum / qtySum;
    return Math.min(0.22, ((avgRank - 1) / 5) * 0.14 + ((avgTier - 1) / 2) * 0.10);
}

/**
 * Injury uplift from roster fill. Full roster (~85%+) = 1× (sim + base injury roll only).
 * 60–80% = noticeably more injuries unless army quality / power ratio compensates.
 */
function resolveTrainingInjuryFillMultiplier(fillRatio, armyQuality = 0, powerRatio = 1) {
    const fill = clamp01(fillRatio);
    const quality = Math.max(0, Math.min(0.22, Number(armyQuality) || 0));
    const power = Math.max(0.25, Number(powerRatio) || 1);

    if (fill >= 0.85) return 1;

    if (fill >= 0.6) {
        const bandT = (0.8 - Math.min(fill, 0.8)) / 0.2;
        let mult = 1 + bandT * 0.38;
        mult -= quality * 1.6 * bandT;
        mult -= Math.max(0, power - 1) * 0.35 * bandT;
        return Math.max(1, Math.round(mult * 1000) / 1000);
    }

    if (fill >= 0.3) {
        const bandT = (0.6 - fill) / 0.3;
        let mult = 1.38 + bandT * 0.42;
        mult -= quality * 1.1 * bandT;
        mult -= Math.max(0, power - 1) * 0.22 * bandT;
        return Math.max(1.15, Math.round(mult * 1000) / 1000);
    }

    const bandT = (0.3 - fill) / 0.3;
    let mult = 1.8 + bandT * 0.55;
    mult -= quality * 0.75 * bandT;
    return Math.max(1.35, Math.round(mult * 1000) / 1000);
}

function computeTrainingRosterContext(options = {}) {
    const healthyUnits = Math.max(0, Math.floor(Number(options.healthyUnits) || 0));
    const commanderRank = Math.max(1, Math.min(22, Math.floor(Number(options.commanderRank) || 1)));
    const trainingMode = String(options.trainingMode || 'street-patrol').trim().toLowerCase();
    const expectedHostUnits = resolveExpectedTrainingHostUnits(commanderRank, trainingMode);
    const rosterFillRatio = Math.min(1, healthyUnits / expectedHostUnits);

    const catalog = options.catalog;
    const battleStacks = options.battleStacks;
    const npcStacks = options.npcStacks;
    const armyQuality = resolveArmyQualityFromHealthyStacks(battleStacks, catalog);

    let powerRatio = null;
    if (catalog && Array.isArray(battleStacks) && Array.isArray(npcStacks) && battleStacks.length && npcStacks.length) {
        const { buildBattleArmy } = getTrainingSimExports();
        const commanderArmy = buildBattleArmy('You', battleStacks, catalog);
        const npcArmy = buildBattleArmy('Host', npcStacks, catalog);
        powerRatio = commanderArmy.startingHp / Math.max(1, npcArmy.startingHp);
    }

    const injuryFillMultiplier = resolveTrainingInjuryFillMultiplier(
        rosterFillRatio,
        armyQuality,
        powerRatio == null ? 1 : powerRatio
    );

    return {
        healthyUnits,
        expectedHostUnits,
        rosterFillRatio: Math.round(rosterFillRatio * 1000) / 1000,
        powerRatio: powerRatio == null ? null : Math.round(powerRatio * 1000) / 1000,
        armyQuality: Math.round(armyQuality * 1000) / 1000,
        injuryFillMultiplier,
        combatModifiersEnabled: isTrainingCombatModifiersEnabled()
    };
}

/** @deprecated alias */
const computeTrainingReadiness = computeTrainingRosterContext;

function appendTrainingModifiersLogLine(log, rosterContext) {
    if (!Array.isArray(log) || !rosterContext?.combatModifiersEnabled) return;
    log.push('Combat modifiers active — perks, banners, and battle gear affect strikes.');
}

/**
 * Post-battle injury overlay — no combat debuffs. Full roster relies on sim + base injury bands.
 */
function resolveTrainingCasualtyOverlay(options = {}) {
    const healthyBefore = Math.max(0, Math.floor(Number(options.healthyBefore) || 0));
    const fillRatio = clamp01(options.rosterFillRatio);
    const armyQuality = Math.max(0, Math.min(0.22, Number(options.armyQuality) || 0));
    const powerRatio = Math.max(0.25, Number(options.powerRatio) || 1);
    const winner = String(options.winner || '').trim().toLowerCase();
    let injuryCount = Math.max(0, Math.floor(Number(options.baseInjuryCount) || 0));
    let deathCount = 0;

    if (!healthyBefore || fillRatio >= 0.85) {
        return { injuryCount: Math.min(healthyBefore, injuryCount), deathCount: 0 };
    }

    const injuryMult = resolveTrainingInjuryFillMultiplier(fillRatio, armyQuality, powerRatio);
    const loss = winner === 'npc';

    if (fillRatio >= 0.6) {
        if (injuryCount > 0) {
            injuryCount = Math.min(healthyBefore, Math.ceil(injuryCount * injuryMult));
        } else if (loss && Math.random() < 0.12 * (injuryMult - 1) / 0.38) {
            injuryCount = 1;
        } else if (!loss && Math.random() < 0.08 * (injuryMult - 1) / 0.38) {
            injuryCount = 1;
        }
    } else if (fillRatio >= 0.3) {
        const floorRate = (loss ? 0.28 : 0.12) + (0.6 - fillRatio) * (loss ? 0.42 : 0.22);
        const qualityRelief = armyQuality * 0.45 + Math.max(0, powerRatio - 1) * 0.12;
        const minInjuries = Math.ceil(healthyBefore * Math.max(0.08, floorRate - qualityRelief) * (injuryMult / 1.35));
        injuryCount = Math.max(injuryCount, Math.min(healthyBefore, minInjuries));
    } else {
        const floorRate = (loss ? 0.45 : 0.2) + (0.3 - fillRatio) * (loss ? 0.35 : 0.25);
        const qualityRelief = armyQuality * 0.35 + Math.max(0, powerRatio - 1) * 0.1;
        const minInjuries = Math.ceil(healthyBefore * Math.max(0.15, floorRate - qualityRelief));
        injuryCount = Math.max(injuryCount, Math.min(healthyBefore, minInjuries));

        if (loss && fillRatio < 0.18 && Math.random() < 0.1 + (0.18 - fillRatio) * 0.35) {
            deathCount = Math.min(
                Math.max(0, healthyBefore - injuryCount),
                Math.max(1, Math.floor(healthyBefore * 0.06))
            );
        }
    }

    injuryCount = Math.min(healthyBefore - deathCount, injuryCount);

    return {
        injuryCount: Math.max(0, injuryCount),
        deathCount: Math.max(0, deathCount)
    };
}

module.exports = {
    isTrainingCombatModifiersEnabled,
    resolveExpectedTrainingHostUnits,
    resolveArmyQualityFromHealthyStacks,
    resolveTrainingInjuryFillMultiplier,
    computeTrainingRosterContext,
    computeTrainingReadiness,
    appendTrainingModifiersLogLine,
    resolveTrainingCasualtyOverlay
};

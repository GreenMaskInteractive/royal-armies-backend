/**
 * NEXUS — Age battle modifiers (phase-linking composition, class perks, banners, gear, settlement defenses).
 * Guild training runs set combatModifiersDisabled on battle context and skip these effects.
 * Consumed by nexus-age-battle-sim.js. All combat math here is deterministic (no RNG).
 */
'use strict';

const path = require('path');
const fs = require('fs');

const { resolveCommanderClassId } = require('./nexus-commander-class');

const PVP_MATRIX_PATH = path.join(__dirname, 'docs', 'pvp-class-opposition-matrix.json');

const LANE_IDS = Object.freeze(['ranged', 'beasts', 'cavalry', 'infantry']);
const EARLY_PHASE_LANES = Object.freeze(['ranged', 'beasts', 'cavalry']);
const VALID_LANE_HP_THRESHOLD = 0.15;
const COUNTER_BONUS_CAP = 1.5;

const CLASS_PERK_IDS = Object.freeze({
    battlemaster: Object.freeze({
        vanguardCleave: 'bm-vanguard-cleave',
        cavalryFlankingCover: 'bm-cavalry-flanking-cover',
        thickHideTraining: 'bm-thick-hide-training'
    }),
    battlemage: Object.freeze({
        feedbackOverload: 'am-feedback-overload',
        arcaneConduits: 'am-arcane-conduits',
        moraleResonance: 'am-morale-resonance',
        wardingRunes: 'am-warding-runes'
    })
});

/** Perk 1 at Age start: Option A = offensive buff, Option B = protective cover. */
const CLASS_PERK1_BRANCH = Object.freeze({
    buff: 'A',
    cover: 'B'
});

const BANNER_IDS = Object.freeze({
    trueWar: 'true-war',
    sachielsBlessing: 'sachiels-blessing',
    emeraldBarrier: 'emerald-barrier',
    fortunesGratitude: 'fortunes-gratitude'
});

const {
    resolveEmeraldBannerContext,
    resolveValidLaneHpThreshold,
    applyEmeraldBarrierInit,
    resolveEmeraldMatrixDisruption,
    applyEmeraldIncomingDamageModifiers,
    applyEmeraldOutgoingDamageModifiers,
    resolveMoralAnchorMoraleFactor,
    NODE: EMERALD_NODE
} = require('./nexus-emerald-barrier-skills');

const GEAR_BATTLE_IDS = Object.freeze({
    signalHorn: 'gear-commanders-signal-horn',
    mageSlayerHarpoon: 'gear-mage-slayer-harpoon',
    linkedResilientPlating: 'gear-linked-resilient-plating',
    nullStoneAegis: 'gear-null-stone-aegis'
});

const SETTLEMENT_DEFENSE_IDS = Object.freeze({
    matrixEqualizer: 'matrix-equalizer-spire',
    antiSynergyField: 'anti-synergy-field-spire'
});

const MATRIX_COUNTER_PAIRS = Object.freeze({
    'bm-thick-hide-training': new Set(['physical_beasts', 'magic_infantry']),
    'am-warding-runes': new Set(['physical_artillery', 'magic_beasts']),
    'gear-null-stone-aegis': new Set(['magic_artillery', 'magic_infantry'])
});

let advantageLookupCache = null;

function loadAdvantageLookup() {
    if (advantageLookupCache) return advantageLookupCache;

    const lookup = new Map();
    try {
        const raw = fs.readFileSync(PVP_MATRIX_PATH, 'utf8');
        const matrix = JSON.parse(raw);
        (matrix.advantagePairs || []).forEach((pair) => {
            const attacker = String(pair.attacker || '').trim();
            const defender = String(pair.defender || '').trim();
            if (!attacker || !defender) return;
            if (!lookup.has(attacker)) lookup.set(attacker, new Set());
            lookup.get(attacker).add(defender);
        });
    } catch (_err) {
        /* fallback empty */
    }

    advantageLookupCache = lookup;
    return lookup;
}

function laneNaturallyCountersDefender(atkLane, defenderClassId) {
    if (!defenderClassId || !atkLane?.classWeight) return false;

    const lookup = loadAdvantageLookup();
    return Object.entries(atkLane.classWeight).some(([classId, weight]) => (
        weight > 0 && lookup.get(classId)?.has(defenderClassId)
    ));
}

function resolveClassPerk1Branch(commander) {
    const choices = commander?.ageClassPerkChoices;
    if (choices && typeof choices === 'object') {
        const raw = String(choices.perk1 || choices.perk1Branch || '').trim().toUpperCase();
        if (raw === 'A' || raw === 'BUFF' || raw === 'OFFENSE') return CLASS_PERK1_BRANCH.buff;
        if (raw === 'B' || raw === 'COVER' || raw === 'DEFENSE') return CLASS_PERK1_BRANCH.cover;
    }

    const legacy = String(commander?.ageClassPerk1Branch || '').trim().toUpperCase();
    if (legacy === 'A' || legacy === 'BUFF') return CLASS_PERK1_BRANCH.buff;
    if (legacy === 'B' || legacy === 'COVER') return CLASS_PERK1_BRANCH.cover;

    return null;
}

function resolveDominantLaneTier(lane) {
    const weights = lane?.tierWeight;
    if (!weights || typeof weights !== 'object') return null;

    let bestTier = null;
    let bestWeight = 0;
    Object.entries(weights).forEach(([tierKey, weight]) => {
        const qty = Math.max(0, Math.floor(Number(weight) || 0));
        if (qty > bestWeight) {
            bestWeight = qty;
            bestTier = Math.max(1, Math.floor(Number(tierKey) || 1));
        }
    });
    return bestTier;
}

function normalizeBannerState(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const bannerId = String(raw.bannerId || raw.id || '').trim();
    if (!bannerId) return null;
    const unlocked = Array.isArray(raw.unlockedPerkIds)
        ? raw.unlockedPerkIds.map((id) => String(id || '').trim()).filter(Boolean)
        : [];
    const keystoneId = String(raw.keystoneId || raw.activePerkId || '').trim();
    const branchPerkId = unlocked.find((id) => id !== keystoneId) || '';
    return {
        bannerId,
        keystoneId,
        branchPerkId,
        unlockedPerkIds: unlocked
    };
}

function resolveBannerBranchId(bannerState) {
    if (!bannerState) return '';
    const branch = String(bannerState.branchPerkId || '').trim();
    if (branch) return branch;
    const unlocked = bannerState.unlockedPerkIds || [];
    return unlocked.find((id) => id !== bannerState.keystoneId) || '';
}

function commanderHasGear(commander, gearId) {
    const slots = commander?.ageGearSlots;
    if (!slots || typeof slots !== 'object') return false;
    const target = String(gearId || '').trim();
    return Object.values(slots).some((id) => String(id || '').trim() === target);
}

function resolveEquippedGearIds(commander) {
    const slots = commander?.ageGearSlots;
    if (!slots || typeof slots !== 'object') return [];
    return Object.values(slots)
        .map((id) => String(id || '').trim())
        .filter(Boolean);
}

/**
 * @param {object} commander
 * @param {'attacker'|'defender'} battleRole
 * @param {object} [extra]
 */
function isCombatModifiersDisabled(context) {
    return Boolean(context?.combatModifiersDisabled);
}

function buildStrippedCombatContext(commander, battleRole = 'attacker', extra = {}) {
    const base = buildBattleContextFromCommander(commander, battleRole, extra);
    return {
        ...base,
        combatModifiersDisabled: true,
        classPerks: {},
        perk1Branch: null,
        banner: null,
        bannerBranchId: '',
        gearIds: [],
        settlementDefenses: [],
        antiSynergyField: false,
        alliedAttackers: 0,
        isNationAssault: false,
        isNationDefense: false
    };
}

function buildBattleContextFromCommander(commander, battleRole = 'attacker', extra = {}) {
    const settlementDefenses = Array.isArray(extra.settlementDefenses)
        ? extra.settlementDefenses.map((id) => String(id || '').trim()).filter(Boolean)
        : [];

    if (!commander) {
        return {
            battleRole,
            commanderClass: null,
            classPerks: {},
            perk1Branch: null,
            banner: null,
            bannerBranchId: '',
            gearIds: [],
            settlementDefenses,
            isNationAssault: Boolean(extra.isNationAssault),
            isNationDefense: Boolean(extra.isNationDefense),
            alliedAttackers: Math.max(0, Math.floor(Number(extra.alliedAttackers) || 0)),
            antiSynergyField: Boolean(extra.antiSynergyField)
                || settlementDefenses.includes(SETTLEMENT_DEFENSE_IDS.antiSynergyField)
        };
    }

    const commanderClass = resolveCommanderClassId(commander);
    const classPerks = CLASS_PERK_IDS[commanderClass] || CLASS_PERK_IDS.battlemaster;
    const perk1Branch = resolveClassPerk1Branch(commander);
    const banner = normalizeBannerState(commander?.ageBannerState || commander?.ageBannerPerks);
    const bannerBranchId = resolveBannerBranchId(banner);
    const gearIds = resolveEquippedGearIds(commander);
    return {
        battleRole,
        commanderClass,
        classPerks: { ...classPerks },
        perk1Branch,
        banner,
        bannerBranchId,
        gearIds,
        settlementDefenses,
        isNationAssault: Boolean(extra.isNationAssault),
        isNationDefense: Boolean(extra.isNationDefense),
        alliedAttackers: Math.max(0, Math.floor(Number(extra.alliedAttackers) || 0)),
        antiSynergyField: Boolean(extra.antiSynergyField)
            || settlementDefenses.includes(SETTLEMENT_DEFENSE_IDS.antiSynergyField)
    };
}

function evaluateArmyComposition(army, options = {}) {
    const totalHp = Math.max(1, Math.floor(Number(army?.startingHp) || 0));
    const laneStartingHp = {};
    const laneAttack = {};

    LANE_IDS.forEach((laneId) => {
        const lane = army.lanes[laneId];
        laneStartingHp[laneId] = Math.max(0, Math.floor(Number(lane?.startingHp ?? lane?.hp) || 0));
        laneAttack[laneId] = Math.max(0, Math.floor(Number(lane?.attack) || 0));
    });

    const laneThreshold = Math.max(
        0.05,
        Math.min(0.5, Number(options.validLaneHpThreshold) || VALID_LANE_HP_THRESHOLD)
    );
    const validActiveLanes = LANE_IDS.filter((laneId) => (laneStartingHp[laneId] / totalHp) >= laneThreshold);
    const activeHpValues = validActiveLanes.map((laneId) => laneStartingHp[laneId]);
    const lowestActiveHp = activeHpValues.length ? Math.min(...activeHpValues) : 0;
    const highestActiveHp = activeHpValues.length ? Math.max(...activeHpValues) : 0;
    const compositionEfficiency = highestActiveHp > 0 ? lowestActiveHp / highestActiveHp : 0;

    let archetype = 'mono';
    if (validActiveLanes.length === 2) archetype = 'dual';
    else if (validActiveLanes.length === 3) archetype = 'tri';
    else if (validActiveLanes.length >= 4) archetype = 'grand';

    const totalAttack = LANE_IDS.reduce((sum, laneId) => sum + laneAttack[laneId], 0);

    return {
        validActiveLanes,
        validActiveLaneCount: validActiveLanes.length,
        compositionEfficiency,
        archetype,
        laneStartingHp,
        laneAttack,
        totalAttack,
        validLaneHpThreshold: laneThreshold
    };
}

function applyDualPhaseAttackBonus(army, log) {
    const comp = army.composition;
    if (!comp || comp.archetype !== 'dual') return;

    const attackBonus = 1 + (0.25 * comp.compositionEfficiency);
    comp.validActiveLanes.forEach((laneId) => {
        const lane = army.lanes[laneId];
        if (!lane?.attack) return;
        lane.attack = Math.max(0, Math.floor(lane.attack * attackBonus));
    });

    if (log) {
        log.push(
            `${army.label} — Dual-Phase lineup: +${Math.round((attackBonus - 1) * 100)}% attack `
            + `on ${comp.validActiveLanes.join(' & ')} (efficiency ${(comp.compositionEfficiency * 100).toFixed(0)}%).`
        );
    }
}

function applyMatrixEqualizer(army, log) {
    const comp = army.composition;
    if (!comp?.totalAttack) return;

    const dominant = LANE_IDS
        .map((laneId) => ({ laneId, attack: army.lanes[laneId]?.attack || 0 }))
        .sort((left, right) => right.attack - left.attack)[0];

    if (!dominant || dominant.attack <= 0) return;
    const dominanceRatio = dominant.attack / comp.totalAttack;
    if (dominanceRatio <= 0.6) return;

    const activeCount = Math.max(1, comp.validActiveLaneCount || LANE_IDS.filter((id) => army.lanes[id]?.attack > 0).length);
    const baselineAttack = Math.max(1, Math.floor(comp.totalAttack / activeCount));
    const lane = army.lanes[dominant.laneId];
    if (!lane) return;

    lane.attack = baselineAttack;
    if (log) {
        log.push(
            `Matrix Equalizer — ${army.label} ${dominant.laneId} lane attack normalized `
            + `(${(dominanceRatio * 100).toFixed(0)}% lethality → baseline ${baselineAttack}).`
        );
    }
}

function initializeArmyBattleState(army, context, log) {
    LANE_IDS.forEach((laneId) => {
        const lane = army.lanes[laneId];
        lane.startingHp = Math.max(0, Math.floor(Number(lane.hp) || 0));
        lane.currentHp = lane.startingHp;
        lane.startingAttack = Math.max(0, Math.floor(Number(lane.attack) || 0));
        lane.startingUnits = Math.max(0, Math.floor(Number(lane.startingUnits ?? lane.units) || 0));
    });

    const emeraldCtx = resolveEmeraldBannerContext(context);
    const laneThreshold = emeraldCtx
        ? resolveValidLaneHpThreshold(emeraldCtx)
        : VALID_LANE_HP_THRESHOLD;

    army.composition = evaluateArmyComposition(army, { validLaneHpThreshold: laneThreshold });
    army.battleState = {
        context: context || null,
        manaResonance: 0,
        markedStackIndexes: new Set(),
        infantryShieldRemaining: 0,
        infantryRound: 0,
        lanesDamaged: new Set(),
        grandShieldApplied: false,
        defenderDealtRanged: false
    };

    if (!isCombatModifiersDisabled(context)) {
        applyDualPhaseAttackBonus(army, log);
        applyEmeraldBarrierInit(army, context, log);
        army.composition = evaluateArmyComposition(army, { validLaneHpThreshold: laneThreshold });
    }
}

function resolveLaneSurvivalRatio(army, laneId) {
    const lane = army.lanes[laneId];
    const start = Math.max(0, Math.floor(Number(lane?.startingHp) || 0));
    const current = Math.max(0, Math.floor(Number(lane?.currentHp) || 0));
    if (!start) return 0;
    return current / start;
}

function computeGrandArmyInfantryShield(army) {
    const comp = army.composition;
    if (!comp || comp.archetype !== 'grand') return 0;

    let shield = 0;
    EARLY_PHASE_LANES.forEach((laneId) => {
        const startHp = comp.laneStartingHp[laneId] || 0;
        shield += startHp * resolveLaneSurvivalRatio(army, laneId);
    });

    return Math.max(0, Math.floor(shield * 0.20));
}

function resolveTriPhaseCounterMultiplier(normalCounter, defenderArmy) {
    const comp = defenderArmy?.composition;
    if (!comp || comp.archetype !== 'tri' || normalCounter <= 1) return normalCounter;
    return Math.max(1, COUNTER_BONUS_CAP - (0.40 * comp.compositionEfficiency));
}

function resolveMatrixDisruptionCounterMultiplier(normalCounter, defenderArmy, defenderContext) {
    const emerald = defenderArmy?.battleState?.emeraldBarrier
        || resolveEmeraldBannerContext(defenderContext);
    if (!emerald) return normalCounter;
    return resolveEmeraldMatrixDisruption(normalCounter, defenderArmy, emerald);
}

function laneHasMagicUnits(lane) {
    if (!lane?.classWeight) return false;
    return Object.keys(lane.classWeight).some((classId) => String(classId).startsWith('magic_'));
}

function laneHasPhysicalUnits(lane) {
    if (!lane?.classWeight) return false;
    return Object.keys(lane.classWeight).some((classId) => String(classId).startsWith('physical_'));
}

function resolveMageSlayerMultiplier(attackerLane, defenderLane, attackerContext) {
    if (!attackerContext?.gearIds?.includes(GEAR_BATTLE_IDS.mageSlayerHarpoon)) return 1;
    if (!laneHasPhysicalUnits(attackerLane) || !laneHasMagicUnits(defenderLane)) return 1;

    const attackerTier = resolveDominantLaneTier(attackerLane);
    const defenderTier = resolveDominantLaneTier(defenderLane);
    if (!attackerTier || !defenderTier || attackerTier !== defenderTier) return 1;

    return 1.4;
}

/** Battlemaster Perk 1-A: +20% cavalry damage only on natural matrix counters. */
function resolveVanguardCleaveMultiplier(phaseId, attackerLane, defenderClassId, attackerContext, hasNaturalCounter) {
    if (phaseId !== 'cavalry') return 1;
    if (attackerContext?.commanderClass !== 'battlemaster') return 1;
    if (attackerContext?.perk1Branch !== CLASS_PERK1_BRANCH.buff) return 1;
    if (!laneHasPhysicalUnits(attackerLane)) return 1;
    if (!hasNaturalCounter && !laneNaturallyCountersDefender(attackerLane, defenderClassId)) return 1;
    return 1.2;
}

/** Battlemage Perk 1-A: +20% magic artillery damage only on natural matrix counters. */
function resolveFeedbackOverloadMultiplier(phaseId, attackerLane, defenderClassId, attackerContext, hasNaturalCounter) {
    if (phaseId !== 'ranged') return 1;
    if (attackerContext?.commanderClass !== 'battlemage') return 1;
    if (attackerContext?.perk1Branch !== CLASS_PERK1_BRANCH.buff) return 1;
    if (!laneHasMagicArtillery(attackerLane)) return 1;
    if (!hasNaturalCounter && !laneNaturallyCountersDefender(attackerLane, defenderClassId)) return 1;
    return 1.2;
}

function laneHasMagicArtillery(lane) {
    return Boolean(lane?.classWeight?.magic_artillery);
}

function resolveArcaneConduitMultiplier(phaseId, attackerContext, battleState) {
    if (!attackerContext || attackerContext.commanderClass !== 'battlemage') return 1;
    if (phaseId !== 'beasts' && phaseId !== 'cavalry') return 1;
    const resonance = Math.max(0, Number(battleState?.manaResonance) || 0);
    if (!resonance) return 1;
    const bonus = Math.min(0.20, resonance * 0.20);
    return 1 + bonus;
}

function resolveCombinedArmsBlitzMultiplier(_phaseId, _attackerArmy, _attackerContext) {
    return 1;
}

function resolveSignalHornMultiplier(defenderStackIndex, battleState) {
    if (!battleState?.markedStackIndexes?.has(defenderStackIndex)) return 1;
    return 1.2;
}

function resolveThickHideCounterMitigation(atkLane, defenderPrimaryClass, defenderLane, defenderContext, phaseId, hasNaturalCounter) {
    if (!hasNaturalCounter) return 0;
    if (phaseId !== 'infantry') return 0;
    if (defenderContext?.commanderClass !== 'battlemaster') return 0;
    if (defenderContext?.perk1Branch !== CLASS_PERK1_BRANCH.cover) return 0;
    if (!laneHasPhysicalUnits(defenderLane)) return 0;

    const lookup = loadAdvantageLookup();
    const threatenedByBeastsOrCasters = ['physical_beasts', 'magic_infantry'].some((attackerClass) => (
        (atkLane.classWeight?.[attackerClass] || 0) > 0
        && lookup.get(attackerClass)?.has(defenderPrimaryClass)
    ));
    return threatenedByBeastsOrCasters ? 0.15 : 0;
}

/** Battlemage Perk 1-B: flat 15% damage absorb when struck by natural matrix counters. */
function resolveWardingRuneDamageFactor(defenderLane, defenderContext, hasNaturalCounter) {
    if (!hasNaturalCounter) return 1;
    if (defenderContext?.commanderClass !== 'battlemage') return 1;
    if (defenderContext?.perk1Branch !== CLASS_PERK1_BRANCH.cover) return 1;
    if (!laneHasMagicUnits(defenderLane)) return 1;
    return 0.85;
}

function resolveNullStoneMitigation(defenderClassId, defenderLane, defenderContext) {
    if (!defenderContext?.gearIds?.includes(GEAR_BATTLE_IDS.nullStoneAegis)) return 0;
    if (!laneHasPhysicalUnits(defenderLane)) return 0;
    if (!MATRIX_COUNTER_PAIRS['gear-null-stone-aegis'].has(defenderClassId)) return 0;
    return 0.35;
}

function resolveLinkedResilientPlatingDefense(defenderArmy) {
    const gearIds = defenderArmy?.battleState?.context?.gearIds || [];
    if (!gearIds.includes(GEAR_BATTLE_IDS.linkedResilientPlating)) return 0;
    const cavalryHp = Math.max(0, Math.floor(Number(defenderArmy.lanes.cavalry?.currentHp) || 0));
    const beastsHp = Math.max(0, Math.floor(Number(defenderArmy.lanes.beasts?.currentHp) || 0));
    return Math.floor((cavalryHp + beastsHp) * 0.05);
}

function shouldIgnoreInfantryCounter(attackerArmy, defenderArmy, infantryRound, attackerContext) {
    if (isCombatModifiersDisabled(attackerContext)) return false;
    if (infantryRound > 2) return false;
    if (attackerContext?.commanderClass !== 'battlemaster') return false;
    const atkCav = Math.max(0, Math.floor(Number(attackerArmy.lanes.cavalry?.units) || 0));
    const defCav = Math.max(0, Math.floor(Number(defenderArmy.lanes.cavalry?.units) || 0));
    if (atkCav <= defCav) return false;
    return laneHasPhysicalUnits(attackerArmy.lanes.infantry);
}

function resolveMoraleShockFactor(defenderArmy, defenderContext) {
    if (isCombatModifiersDisabled(defenderContext)) return 45;
    const comp = defenderArmy?.composition;
    if (defenderContext?.commanderClass === 'battlemage'
        && comp?.archetype === 'grand'
        && comp.validActiveLaneCount >= 4) {
        return 30;
    }
    return 45;
}

function markRangedDamageStacks(defenderArmy, dealt, attackerContext) {
    if (isCombatModifiersDisabled(attackerContext)) return;
    if (!dealt || !attackerContext?.gearIds?.includes(GEAR_BATTLE_IDS.signalHorn)) return;
    const stacks = Array.isArray(defenderArmy?.stacks) ? defenderArmy.stacks : [];
    stacks.forEach((stack, index) => {
        if (Math.max(0, Math.floor(Number(stack?.survivorsQty) || 0)) > 0) {
            defenderArmy.battleState.markedStackIndexes.add(index);
        }
    });
}

function recordLaneDamage(attackerArmy, phaseId, dealt) {
    if (!dealt || !attackerArmy?.battleState) return;
    const comp = attackerArmy.composition;
    if (!comp?.validActiveLanes?.includes(phaseId)) return;
    attackerArmy.battleState.lanesDamaged.add(phaseId);
}

function absorbDamageWithShield(army, damage) {
    const shield = Math.max(0, Math.floor(Number(army?.battleState?.infantryShieldRemaining) || 0));
    if (!shield || damage <= 0) return damage;

    const absorbed = Math.min(shield, damage);
    army.battleState.infantryShieldRemaining = shield - absorbed;
    return Math.max(0, damage - absorbed);
}

/**
 * Nation strategy — Combined Logistics move cost (not used inside strike loop).
 */
function resolveCombinedLogisticsMoveMultiplier(_commander, _armyComposition, _context = {}) {
    return 1;
}

module.exports = {
    LANE_IDS,
    EARLY_PHASE_LANES,
    VALID_LANE_HP_THRESHOLD,
    CLASS_PERK_IDS,
    BANNER_IDS,
    GEAR_BATTLE_IDS,
    SETTLEMENT_DEFENSE_IDS,
    isCombatModifiersDisabled,
    buildStrippedCombatContext,
    buildBattleContextFromCommander,
    evaluateArmyComposition,
    initializeArmyBattleState,
    applyMatrixEqualizer,
    computeGrandArmyInfantryShield,
    applyEmeraldIncomingDamageModifiers,
    applyEmeraldOutgoingDamageModifiers,
    resolveMoralAnchorMoraleFactor,
    EMERALD_NODE,
    resolveTriPhaseCounterMultiplier,
    resolveMatrixDisruptionCounterMultiplier,
    CLASS_PERK1_BRANCH,
    resolveClassPerk1Branch,
    laneNaturallyCountersDefender,
    resolveMageSlayerMultiplier,
    resolveVanguardCleaveMultiplier,
    resolveFeedbackOverloadMultiplier,
    resolveArcaneConduitMultiplier,
    resolveCombinedArmsBlitzMultiplier,
    resolveSignalHornMultiplier,
    resolveThickHideCounterMitigation,
    resolveWardingRuneDamageFactor,
    resolveNullStoneMitigation,
    resolveLinkedResilientPlatingDefense,
    shouldIgnoreInfantryCounter,
    resolveMoraleShockFactor,
    markRangedDamageStacks,
    recordLaneDamage,
    absorbDamageWithShield,
    resolveCombinedLogisticsMoveMultiplier,
    resolveLaneSurvivalRatio
};

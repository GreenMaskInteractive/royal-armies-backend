/**
 * NEXUS — Guild commander XP.
 *
 * Participation XP (survivors × combat rounds) applies only when your fight helps
 * Solo guild training drills use outcome, fight duration (rounds to resolve), and
 * host mix — not participation credit. Acquired gear Trainer / guild XP perks apply
 * only when stored on the commander ledger (see resolveAcquiredGuildTrainingXpMultiplier).
 *
 * Tier gap: training ≪ PvP ≪ city battles / main drops.
 */
'use strict';

const { resolveAcquiredGuildTrainingXpMultiplier } = require('./nexus-age-commander-gear');

/** Per-survivor XP weight by phase lane — participation profiles only. */
const BASE_LANE_RATES = Object.freeze({
    ranged: 2.5,
    beasts: 3.5,
    cavalry: 4.5,
    infantry: 7
});

const TRAINING_MODE_XP_MULTIPLIER = Object.freeze({
    'street-patrol': 0.5,
    'civilian-transport': 0.65,
    'border-patrol': 0.8
});

/** Solo drill outcome anchors (scaled by training mode). Not participation XP. */
const TRAINING_DRILL_OUTCOME_BASE = Object.freeze({
    commander: 8,
    draw: 5,
    npc: 2
});

const ENGAGEMENT_XP_PROFILES = Object.freeze({
    'city-battle': Object.freeze({
        label: 'city battle',
        laneRateScale: 1.65,
        globalScale: 1.35,
        minXpGain: 1,
        enforceMinimum: true,
        resolveContextMultiplier(mode, options = {}) {
            const role = String(mode || 'assault').trim().toLowerCase();
            const roleMult = role === 'defense' ? 1.1 : 1;
            const comrades = Math.max(1, Math.floor(Number(options.playersInCity) || 1));
            const allyMult = 1 + Math.min(0.4, Math.max(0, comrades - 1) * 0.06);
            return roleMult * allyMult;
        }
    }),
    'pvp-battle': Object.freeze({
        label: 'PvP',
        laneRateScale: 1.15,
        globalScale: 1.05,
        minXpGain: 1,
        enforceMinimum: true,
        resolveContextMultiplier(mode, options = {}) {
            const role = String(mode || 'attack').trim().toLowerCase();
            const roleMult = role === 'defense' ? 1.05 : 1;
            const comrades = Math.max(1, Math.floor(Number(options.playersInEngagement) || 1));
            const allyMult = 1 + Math.min(0.25, Math.max(0, comrades - 1) * 0.04);
            return roleMult * allyMult;
        }
    })
});

function normalizeTrainingMode(trainingMode) {
    const mode = String(trainingMode || 'street-patrol').trim().toLowerCase();
    return TRAINING_MODE_XP_MULTIPLIER[mode] ? mode : 'street-patrol';
}

function resolvePhaseParticipation(battle) {
    if (battle?.phaseParticipation && typeof battle.phaseParticipation === 'object') {
        return {
            ranged: Boolean(battle.phaseParticipation.ranged),
            beasts: Boolean(battle.phaseParticipation.beasts),
            cavalry: Boolean(battle.phaseParticipation.cavalry),
            infantryRounds: Math.max(0, Math.floor(Number(battle.phaseParticipation.infantryRounds) || 0))
        };
    }

    const infantryRounds = Math.max(0, Math.floor(Number(battle?.infantryRounds) || 0));
    const roundsPlayed = Math.max(0, Math.floor(Number(battle?.roundsPlayed) || 0));
    const phaseRounds = Math.max(0, roundsPlayed - infantryRounds);

    return {
        ranged: phaseRounds >= 1,
        beasts: phaseRounds >= 2,
        cavalry: phaseRounds >= 3,
        infantryRounds
    };
}

function countStackParticipationRounds(phaseLane, participation) {
    const lane = String(phaseLane || 'infantry').trim().toLowerCase();
    if (lane === 'ranged') return participation.ranged ? 1 : 0;
    if (lane === 'beasts') return participation.beasts ? 1 : 0;
    if (lane === 'cavalry') return participation.cavalry ? 1 : 0;
    if (lane === 'infantry') return participation.infantryRounds;
    return 0;
}

/** Shorter fights yield less participation XP; deep infantry grinds earn the most. */
function resolveBattleLengthFactor(participation, profileKey) {
    let engagementWeight = 0;
    if (participation.ranged) engagementWeight += 1;
    if (participation.beasts) engagementWeight += 1;
    if (participation.cavalry) engagementWeight += 1;
    engagementWeight += participation.infantryRounds;

    if (profileKey === 'pvp-battle') {
        if (engagementWeight <= 0) return 0.6;
        if (engagementWeight <= 1) return 0.76;
        if (engagementWeight <= 2) return 0.88;
        if (engagementWeight <= 3) return 0.95;
        if (engagementWeight <= 4) return 0.98;
        return 1;
    }

    if (engagementWeight <= 0) return 0.55;
    if (engagementWeight <= 1) return 0.72;
    if (engagementWeight <= 2) return 0.86;
    if (engagementWeight <= 3) return 0.94;
    if (engagementWeight <= 4) return 0.98;
    return 1;
}

function resolveLaneRate(lane, profile) {
    const base = BASE_LANE_RATES[lane] || 4;
    return base * (profile?.laneRateScale || 1);
}

function allocateStackSurvivors(stacks, totalSurviving) {
    const rows = (Array.isArray(stacks) ? stacks : []).map((stack) => ({
        stack,
        startingQty: Math.max(0, Math.floor(Number(stack?.qty) || 0))
    })).filter((row) => row.startingQty > 0);

    const totalStarting = rows.reduce((sum, row) => sum + row.startingQty, 0);
    if (!totalStarting || totalSurviving <= 0) {
        return rows.map((row) => ({ ...row, survivors: 0 }));
    }

    const cappedSurvivors = Math.min(totalStarting, Math.max(0, Math.floor(totalSurviving)));
    const exact = rows.map((row) => (cappedSurvivors * row.startingQty) / totalStarting);
    const survivors = exact.map((value) => Math.floor(value));
    let remainder = cappedSurvivors - survivors.reduce((sum, qty) => sum + qty, 0);

    const fractionalOrder = exact
        .map((value, index) => ({ index, fractional: value - Math.floor(value) }))
        .sort((left, right) => right.fractional - left.fractional);

    for (let step = 0; step < remainder; step += 1) {
        survivors[fractionalOrder[step % fractionalOrder.length].index] += 1;
    }

    return rows.map((row, index) => ({ ...row, survivors: survivors[index] }));
}

function calculateParticipationBattleXp(battle, profileKey = 'city-battle', options = {}) {
    const profile = ENGAGEMENT_XP_PROFILES[profileKey] || ENGAGEMENT_XP_PROFILES['city-battle'];
    const force = battle?.commanderForce;
    const stacks = Array.isArray(force?.stacks) ? force.stacks : [];
    const totalStarting = Math.max(0, Math.floor(Number(force?.units) || 0));
    const totalSurviving = Math.max(0, Math.floor(Number(force?.unitsRemaining) || 0));

    const contextMode = options.mode || options.battleRole || options.pvpRole || 'assault';
    const contextMultiplier = profile.resolveContextMultiplier(contextMode, options);

    if (!totalStarting || !totalSurviving || !stacks.length) {
        return {
            xpGain: 0,
            xpBreakdown: {
                profile: profile.label,
                totalStarting,
                totalSurviving,
                participationRounds: 0,
                contextMode,
                contextMultiplier,
                globalScale: profile.globalScale,
                lengthFactor: 0,
                rawXp: 0,
                stackLines: []
            }
        };
    }

    const participation = resolvePhaseParticipation(battle);
    const lengthFactor = resolveBattleLengthFactor(participation, profileKey);

    const allocated = allocateStackSurvivors(stacks, totalSurviving);
    const stackLines = [];
    let rawXp = 0;
    let participationRounds = 0;

    allocated.forEach(({ stack, survivors }) => {
        if (!survivors) return;

        const lane = String(stack?.phaseLane || 'infantry').trim().toLowerCase();
        const rounds = countStackParticipationRounds(lane, participation);
        if (!rounds) return;

        participationRounds += rounds;
        const rate = resolveLaneRate(lane, profile);
        const stackXp = Math.round(survivors * rounds * rate);
        rawXp += stackXp;

        stackLines.push({
            name: stack?.name || 'Unit',
            lane,
            survivors,
            rounds,
            rate,
            xp: stackXp
        });
    });

    const scaledXp = rawXp * contextMultiplier * profile.globalScale * lengthFactor;
    let xpGain = Math.max(0, Math.round(scaledXp));
    if (profile.enforceMinimum && rawXp > 0) {
        xpGain = Math.max(profile.minXpGain, xpGain);
    }

    return {
        xpGain,
        xpBreakdown: {
            profile: profile.label,
            totalStarting,
            totalSurviving,
            participation,
            participationRounds,
            contextMode,
            contextMultiplier,
            globalScale: profile.globalScale,
            lengthFactor,
            rawXp,
            stackLines
        }
    };
}

function resolveTrainingOutcomeMultiplier(battle) {
    const winner = String(battle?.winner || 'npc').trim().toLowerCase();
    const force = battle?.commanderForce;
    const startUnits = Math.max(1, Math.floor(Number(force?.units) || 1));
    const remainUnits = Math.max(0, Math.floor(Number(force?.unitsRemaining) || 0));
    const startHp = Math.max(1, Math.floor(Number(force?.hp) || 1));
    const remainHp = Math.max(0, Math.floor(Number(force?.hpRemaining) || 0));
    const survivalRatio = remainUnits / startUnits;
    const hpRatio = remainHp / startHp;
    const margin = (survivalRatio + hpRatio) / 2;

    if (winner === 'commander') {
        return 0.9 + margin * 0.2;
    }
    if (winner === 'draw') {
        return 0.55 + margin * 0.25;
    }
    return 0.35 + margin * 0.25;
}

/** Max engagement rounds in training: 3 phase exchanges + 5 infantry rounds. */
const TRAINING_MAX_ENGAGEMENT_ROUNDS = 8;

function resolveTrainingEngagementRounds(battle) {
    const participation = resolvePhaseParticipation(battle);
    let engagementRounds = 0;
    if (participation.ranged) engagementRounds += 1;
    if (participation.beasts) engagementRounds += 1;
    if (participation.cavalry) engagementRounds += 1;
    engagementRounds += participation.infantryRounds;

    const endReason = String(battle?.endReason || '').trim().toLowerCase();
    const endedBeforeInfantry = participation.infantryRounds === 0 && endReason === 'routing';

    return {
        participation,
        engagementRounds,
        infantryRounds: participation.infantryRounds,
        endedBeforeInfantry
    };
}

/**
 * Longer training fights earn more drill XP; quick routs earn less (Last Knights-style).
 * Returns multiplier ~0.76 (blitz) through ~1.16 (deep infantry grind).
 */
function resolveTrainingBattleDurationFactor(battle) {
    const { engagementRounds, endedBeforeInfantry } = resolveTrainingEngagementRounds(battle);

    if (engagementRounds <= 0) {
        return { factor: 0.74, engagementRounds: 0 };
    }

    if (endedBeforeInfantry) {
        const quickRatio = Math.max(1, engagementRounds) / 3;
        const factor = 0.76 + quickRatio * 0.1;
        return {
            factor: Math.round(factor * 1000) / 1000,
            engagementRounds
        };
    }

    const ratio = Math.min(1, engagementRounds / TRAINING_MAX_ENGAGEMENT_ROUNDS);
    const factor = 0.84 + ratio * 0.32;
    return {
        factor: Math.round(factor * 1000) / 1000,
        engagementRounds
    };
}

function resolveTrainingHostMixBonus(battle) {
    const npcStacks = battle?.npcForce?.stacks;
    if (!Array.isArray(npcStacks) || !npcStacks.length) return 0;

    const lanes = new Set();
    npcStacks.forEach((stack) => {
        lanes.add(String(stack?.phaseLane || 'infantry').trim().toLowerCase());
    });

    const bonus = Math.max(0, lanes.size - 1) + Math.max(0, npcStacks.length - 1);
    return Math.min(4, bonus);
}

/** Small per-fight variance tied to battle shape plus light volatility (Last Knights-style). */
function resolveTrainingDrillVarianceBonus(battle) {
    const rounds = Math.max(0, Math.floor(Number(battle?.roundsPlayed) || 0));
    const npcUnits = Math.max(0, Math.floor(Number(battle?.npcUnits) || 0));
    const shapeBonus = (rounds + npcUnits) % 3;
    const jitter = Math.floor(Math.random() * 3);
    return shapeBonus + jitter;
}

function applyTrainingDrillVolatility(rawXp) {
    const volatility = 0.86 + Math.random() * 0.26;
    return Math.max(0, Math.round(rawXp * volatility));
}

function calculateGuildTrainingBattleXp(battle, trainingMode = 'street-patrol', commander = null) {
    const mode = normalizeTrainingMode(trainingMode);
    const modeMult = TRAINING_MODE_XP_MULTIPLIER[mode] || 0.5;
    const modeRel = modeMult / TRAINING_MODE_XP_MULTIPLIER['street-patrol'];
    const winner = String(battle?.winner || 'npc').trim().toLowerCase();
    const outcomeKey = winner === 'commander' || winner === 'draw' ? winner : 'npc';
    const baseXp = Math.round((TRAINING_DRILL_OUTCOME_BASE[outcomeKey] || 0) * modeRel);
    const outcomeMult = resolveTrainingOutcomeMultiplier(battle);
    const { factor: durationFactor, engagementRounds } = resolveTrainingBattleDurationFactor(battle);
    const hostBonus = resolveTrainingHostMixBonus(battle);
    const varianceBonus = resolveTrainingDrillVarianceBonus(battle);
    const coreXp = baseXp * outcomeMult + hostBonus + varianceBonus;
    const preVolatilityXp = Math.max(0, Math.round(coreXp * durationFactor));
    const preBonusXp = applyTrainingDrillVolatility(preVolatilityXp);
    const acquiredBonus = commander
        ? resolveAcquiredGuildTrainingXpMultiplier(commander, winner)
        : { multiplier: 1, sources: [] };
    const xpGain = Math.max(0, Math.round(preBonusXp * acquiredBonus.multiplier));

    const force = battle?.commanderForce;

    return {
        xpGain,
        xpBreakdown: {
            profile: 'solo training drill',
            trainingMode: mode,
            trainingMultiplier: modeMult,
            outcome: outcomeKey,
            baseXp,
            outcomeMultiplier: Math.round(outcomeMult * 1000) / 1000,
            engagementRounds,
            durationFactor,
            hostMixBonus: hostBonus,
            varianceBonus,
            preVolatilityXp,
            preBonusXp,
            coreXp: Math.round(coreXp * 1000) / 1000,
            acquiredBonusMultiplier: acquiredBonus.multiplier,
            acquiredBonusSources: acquiredBonus.sources,
            totalSurviving: Math.max(0, Math.floor(Number(force?.unitsRemaining) || 0)),
            infantryRounds: Math.max(0, Math.floor(Number(battle?.infantryRounds) || 0)),
            roundsPlayed: Math.max(0, Math.floor(Number(battle?.roundsPlayed) || 0))
        }
    };
}

function calculateCityBattleGuildXp(battle, options = {}) {
    const xpCalc = calculateParticipationBattleXp(battle, 'city-battle', {
        battleRole: options.battleRole || 'assault',
        playersInCity: options.playersInCity
    });
    return {
        ...xpCalc,
        xpBreakdown: {
            ...xpCalc.xpBreakdown,
            battleRole: String(options.battleRole || 'assault').trim().toLowerCase(),
            playersInCity: Math.max(1, Math.floor(Number(options.playersInCity) || 1))
        }
    };
}

function calculatePvpBattleGuildXp(battle, options = {}) {
    const xpCalc = calculateParticipationBattleXp(battle, 'pvp-battle', {
        pvpRole: options.pvpRole || options.battleRole || 'attack',
        playersInEngagement: options.playersInEngagement || options.playersInCity || 1
    });
    return {
        ...xpCalc,
        xpBreakdown: {
            ...xpCalc.xpBreakdown,
            pvpRole: String(options.pvpRole || options.battleRole || 'attack').trim().toLowerCase(),
            playersInEngagement: Math.max(1, Math.floor(Number(options.playersInEngagement || options.playersInCity) || 1))
        }
    };
}

function appendBattleXpLogLines(log, xpCalc, profileKey = 'city-battle') {
    if (!Array.isArray(log) || !xpCalc) return;

    const breakdown = xpCalc.xpBreakdown || {};
    const profileLabel = breakdown.profile || profileKey;

    if (!xpCalc.xpGain) {
        if (profileKey === 'solo-training') {
            log.push('Experience: no guild XP — training drill yielded no credit.');
            return;
        }
        if ((breakdown.totalSurviving || 0) <= 0) {
            log.push(`Experience: no guild XP — no units survived the ${profileLabel}.`);
        } else {
            log.push(`Experience: no guild XP — survivors did not participate in combat rounds.`);
        }
        return;
    }

    if (profileKey === 'solo-training') {
        const rounds = breakdown.engagementRounds ?? 0;
        const duration = breakdown.durationFactor;
        const bonusMult = breakdown.acquiredBonusMultiplier;
        log.push(
            `Experience: +${xpCalc.xpGain} guild XP from solo training`
            + ` (${breakdown.outcome || 'npc'} · ${rounds} engagement round(s)`
            + `${Number.isFinite(duration) ? ` · duration ×${duration}` : ''}`
            + `${breakdown.hostMixBonus ? ` · host mix +${breakdown.hostMixBonus}` : ''}`
            + `${bonusMult > 1 ? ` · acquired bonus ×${bonusMult}` : ''}).`
        );
        return;
    }

    if (profileKey === 'city-battle') {
        log.push(
            `Experience: +${xpCalc.xpGain} guild XP from ${breakdown.totalSurviving || 0}`
            + ` surviving unit(s) in the ${profileLabel}`
            + ` (ally scale ×${Math.round((breakdown.contextMultiplier || 1) * 100) / 100}).`
        );
    } else if (profileKey === 'pvp-battle') {
        log.push(
            `Experience: +${xpCalc.xpGain} guild XP from ${breakdown.totalSurviving || 0}`
            + ` surviving unit(s) in ${profileLabel}`
            + ` (engagement scale ×${Math.round((breakdown.contextMultiplier || 1) * 100) / 100}).`
        );
    }

    (breakdown.stackLines || []).slice(0, 5).forEach((line) => {
        log.push(
            `  · ${line.survivors} ${line.name} — ${line.rounds} round(s) as ${line.lane} → ${line.xp} XP`
        );
    });

    if ((breakdown.stackLines || []).length > 5) {
        log.push(`  · …and ${breakdown.stackLines.length - 5} more stack contribution(s).`);
    }
}

function appendGuildTrainingXpLogLines(log, xpCalc) {
    appendBattleXpLogLines(log, xpCalc, 'solo-training');
}

function appendPvpBattleXpLogLines(log, xpCalc) {
    appendBattleXpLogLines(log, xpCalc, 'pvp-battle');
}

module.exports = {
    BASE_LANE_RATES,
    TRAINING_MODE_XP_MULTIPLIER,
    TRAINING_DRILL_OUTCOME_BASE,
    TRAINING_MAX_ENGAGEMENT_ROUNDS,
    ENGAGEMENT_XP_PROFILES,
    calculateParticipationBattleXp,
    calculateGuildTrainingBattleXp,
    calculateCityBattleGuildXp,
    calculatePvpBattleGuildXp,
    appendGuildTrainingXpLogLines,
    appendPvpBattleXpLogLines,
    appendBattleXpLogLines,
    resolvePhaseParticipation,
    countStackParticipationRounds
};

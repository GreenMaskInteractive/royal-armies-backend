/**
 * NEXUS — Guild commander XP (Last Knights style: survival + round participation).
 *
 * Training pays extremely little so early progression stays local; city battles pay
 * much more so commanders graduate toward fighting alongside comrades on the map.
 */
'use strict';

/** Per-survivor XP weight by phase lane — tuned per engagement profile below. */
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

const ENGAGEMENT_XP_PROFILES = Object.freeze({
    training: Object.freeze({
        label: 'training',
        laneRateScale: 0.06,
        globalScale: 0.07,
        minXpGain: 0,
        enforceMinimum: false,
        resolveContextMultiplier(mode) {
            return TRAINING_MODE_XP_MULTIPLIER[normalizeTrainingMode(mode)] || TRAINING_MODE_XP_MULTIPLIER['street-patrol'];
        }
    }),
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

/** Shorter fights yield less XP; deep infantry grinds earn the most. */
function resolveBattleLengthFactor(participation, profileKey) {
    let engagementWeight = 0;
    if (participation.ranged) engagementWeight += 1;
    if (participation.beasts) engagementWeight += 1;
    if (participation.cavalry) engagementWeight += 1;
    engagementWeight += participation.infantryRounds;

    if (profileKey === 'city-battle') {
        if (engagementWeight <= 0) return 0.55;
        if (engagementWeight <= 1) return 0.72;
        if (engagementWeight <= 2) return 0.86;
        if (engagementWeight <= 3) return 0.94;
        if (engagementWeight <= 4) return 0.98;
        return 1;
    }

    if (engagementWeight <= 0) return 0.35;
    if (engagementWeight <= 1) return 0.45;
    if (engagementWeight <= 2) return 0.62;
    if (engagementWeight <= 3) return 0.78;
    if (engagementWeight <= 4) return 0.9;
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

function calculateParticipationBattleXp(battle, profileKey = 'training', options = {}) {
    const profile = ENGAGEMENT_XP_PROFILES[profileKey] || ENGAGEMENT_XP_PROFILES.training;
    const force = battle?.commanderForce;
    const stacks = Array.isArray(force?.stacks) ? force.stacks : [];
    const totalStarting = Math.max(0, Math.floor(Number(force?.units) || 0));
    const totalSurviving = Math.max(0, Math.floor(Number(force?.unitsRemaining) || 0));

    const contextMode = options.mode || options.trainingMode || options.battleRole || 'street-patrol';
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

function calculateGuildTrainingBattleXp(battle, trainingMode = 'street-patrol') {
    const xpCalc = calculateParticipationBattleXp(battle, 'training', { trainingMode });
    const mode = normalizeTrainingMode(trainingMode);
    return {
        ...xpCalc,
        xpBreakdown: {
            ...xpCalc.xpBreakdown,
            trainingMode: mode,
            trainingMultiplier: TRAINING_MODE_XP_MULTIPLIER[mode]
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

function appendBattleXpLogLines(log, xpCalc, profileKey = 'training') {
    if (!Array.isArray(log) || !xpCalc) return;

    const breakdown = xpCalc.xpBreakdown || {};
    const profileLabel = breakdown.profile || profileKey;

    if (!xpCalc.xpGain) {
        if ((breakdown.totalSurviving || 0) <= 0) {
            log.push(`Experience: no guild XP — no units survived the ${profileLabel}.`);
        } else {
            log.push(`Experience: no guild XP — survivors did not participate in combat rounds.`);
        }
        return;
    }

    if (profileKey === 'city-battle') {
        log.push(
            `Experience: +${xpCalc.xpGain} guild XP from ${breakdown.totalSurviving || 0}`
            + ` surviving unit(s) in the ${profileLabel}`
            + ` (ally scale ×${Math.round((breakdown.contextMultiplier || 1) * 100) / 100}).`
        );
    } else {
        log.push(
            `Experience: +${xpCalc.xpGain} guild XP from ${breakdown.totalSurviving || 0}`
            + ` surviving unit(s) across combat rounds`
            + ` (training scale ×${breakdown.trainingMultiplier ?? breakdown.contextMultiplier}).`
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
    appendBattleXpLogLines(log, xpCalc, 'training');
}

module.exports = {
    BASE_LANE_RATES,
    TRAINING_MODE_XP_MULTIPLIER,
    ENGAGEMENT_XP_PROFILES,
    calculateParticipationBattleXp,
    calculateGuildTrainingBattleXp,
    calculateCityBattleGuildXp,
    appendGuildTrainingXpLogLines,
    appendBattleXpLogLines,
    resolvePhaseParticipation,
    countStackParticipationRounds
};

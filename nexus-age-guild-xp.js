/**
 * NEXUS — Guild training XP (Last Knights style: survival + round participation).
 *
 * XP is not a flat win/loss reward. Surviving units earn XP per combat round they
 * actually fight in; shorter training engagements pay significantly less.
 */
'use strict';

/** XP weight per surviving unit per round it participates in (by phase lane). */
const XP_PER_SURVIVOR_ROUND_BY_LANE = Object.freeze({
    ranged: 2.5,
    beasts: 3.5,
    cavalry: 4.5,
    infantry: 7
});

/** Training scenarios pay far less than real SF battles. */
const TRAINING_MODE_XP_MULTIPLIER = Object.freeze({
    'street-patrol': 0.34,
    'civilian-transport': 0.54,
    'border-patrol': 0.74
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

/** Shorter training fights yield less XP per engagement. */
function resolveBattleLengthFactor(participation) {
    let engagementWeight = 0;
    if (participation.ranged) engagementWeight += 1;
    if (participation.beasts) engagementWeight += 1;
    if (participation.cavalry) engagementWeight += 1;
    engagementWeight += participation.infantryRounds;

    if (engagementWeight <= 0) return 0.4;
    if (engagementWeight <= 1) return 0.5;
    if (engagementWeight <= 2) return 0.68;
    if (engagementWeight <= 3) return 0.84;
    if (engagementWeight <= 4) return 0.94;
    return 1;
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

function calculateGuildTrainingBattleXp(battle, trainingMode = 'street-patrol') {
    const force = battle?.commanderForce;
    const stacks = Array.isArray(force?.stacks) ? force.stacks : [];
    const totalStarting = Math.max(0, Math.floor(Number(force?.units) || 0));
    const totalSurviving = Math.max(0, Math.floor(Number(force?.unitsRemaining) || 0));

    if (!totalStarting || !totalSurviving || !stacks.length) {
        return {
            xpGain: 0,
            xpBreakdown: {
                totalStarting,
                totalSurviving,
                participationRounds: 0,
                trainingMultiplier: TRAINING_MODE_XP_MULTIPLIER[normalizeTrainingMode(trainingMode)],
                lengthFactor: 0,
                rawXp: 0,
                stackLines: []
            }
        };
    }

    const participation = resolvePhaseParticipation(battle);
    const mode = normalizeTrainingMode(trainingMode);
    const trainingMultiplier = TRAINING_MODE_XP_MULTIPLIER[mode];
    const lengthFactor = resolveBattleLengthFactor(participation);

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
        const rate = XP_PER_SURVIVOR_ROUND_BY_LANE[lane] || 4;
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

    const scaledXp = rawXp * trainingMultiplier * lengthFactor;
    const xpGain = rawXp > 0 ? Math.max(1, Math.round(scaledXp)) : 0;

    return {
        xpGain,
        xpBreakdown: {
            totalStarting,
            totalSurviving,
            participation,
            participationRounds,
            trainingMode: mode,
            trainingMultiplier,
            lengthFactor,
            rawXp,
            stackLines
        }
    };
}

function appendGuildTrainingXpLogLines(log, xpCalc) {
    if (!Array.isArray(log) || !xpCalc) return;

    const breakdown = xpCalc.xpBreakdown || {};
    if (!xpCalc.xpGain) {
        if ((breakdown.totalSurviving || 0) <= 0) {
            log.push('Experience: no guild XP — no units survived the engagement.');
        } else {
            log.push('Experience: no guild XP — surviving units did not participate in combat rounds.');
        }
        return;
    }

    log.push(
        `Experience: +${xpCalc.xpGain} guild XP from ${breakdown.totalSurviving || 0}`
        + ` surviving unit(s) across combat rounds (training scale ×${breakdown.trainingMultiplier}).`
    );

    (breakdown.stackLines || []).slice(0, 5).forEach((line) => {
        log.push(
            `  · ${line.survivors} ${line.name} — ${line.rounds} round(s) as ${line.lane} → ${line.xp} XP`
        );
    });

    if ((breakdown.stackLines || []).length > 5) {
        log.push(`  · …and ${breakdown.stackLines.length - 5} more stack contribution(s).`);
    }
}

module.exports = {
    XP_PER_SURVIVOR_ROUND_BY_LANE,
    TRAINING_MODE_XP_MULTIPLIER,
    calculateGuildTrainingBattleXp,
    appendGuildTrainingXpLogLines,
    resolvePhaseParticipation,
    countStackParticipationRounds
};

/**
 * NEXUS — Solo / leader city assault capture thresholds and casualty pressure by rank.
 */
'use strict';

const SETTLEMENT_TIER_LABEL = Object.freeze({
    village: 'village',
    town: 'town',
    city: 'city',
    citadel: 'citadel',
    kingdom: 'kingdom'
});

/** Garrison NPC rank keyed to settlement size (not the attacker's rank). */
const SETTLEMENT_DEFENDER_RANK = Object.freeze({
    village: 8,
    town: 11,
    city: 14,
    citadel: 17,
    kingdom: 20
});

/** Minimum commander rank required to seize a settlement solo (or as assault leader). */
const SETTLEMENT_MIN_SOLO_CAPTURE_RANK = Object.freeze({
    village: 6,
    town: 8,
    city: 11,
    citadel: 14,
    kingdom: 17
});

function clampCommanderRank(raw) {
    return Math.max(1, Math.min(22, Math.floor(Number(raw) || 1)));
}

function normalizeSettlementTier(raw) {
    const tier = String(raw || 'village').trim().toLowerCase();
    return SETTLEMENT_TIER_LABEL[tier] ? tier : 'village';
}

function resolveSettlementDefenderRank(city) {
    const tier = normalizeSettlementTier(city?.settlementTier);
    return SETTLEMENT_DEFENDER_RANK[tier] || SETTLEMENT_DEFENDER_RANK.village;
}

function resolveSoloCaptureEligibility(commanderRank, city) {
    const rank = clampCommanderRank(commanderRank);
    const tier = normalizeSettlementTier(city?.settlementTier);
    const minRank = SETTLEMENT_MIN_SOLO_CAPTURE_RANK[tier] || SETTLEMENT_MIN_SOLO_CAPTURE_RANK.village;
    const defenderRank = resolveSettlementDefenderRank(city);
    const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

    return {
        eligible: rank >= minRank,
        commanderRank: rank,
        minRank,
        defenderRank,
        tier,
        tierLabel,
        rankShortfall: Math.max(0, minRank - rank),
        defenderGap: Math.max(0, defenderRank - rank)
    };
}

function applySoloCaptureRankOutcome(battle, commanderRank, city) {
    if (!battle?.ok) return battle;

    const eligibility = resolveSoloCaptureEligibility(commanderRank, city);
    const base = {
        ...battle,
        captureEligible: eligibility.eligible,
        minCaptureRank: eligibility.minRank,
        settlementDefenderRank: eligibility.defenderRank,
        settlementTier: eligibility.tier
    };

    if (battle.winner !== 'commander' || eligibility.eligible) {
        return base;
    }

    const log = Array.isArray(battle.log) ? battle.log.slice() : [];
    log.push(
        `RESULT: Defeat — Rank ${eligibility.commanderRank} cannot seize this ${eligibility.tierLabel} `
        + `(requires rank ${eligibility.minRank}). The garrison holds the walls.`
    );

    return {
        ...base,
        winner: 'npc',
        endReason: 'rank_threshold',
        captureEligible: false,
        log
    };
}

function resolveRankAssaultCasualtyModifiers(commanderRank, city, battleResult) {
    const eligibility = resolveSoloCaptureEligibility(commanderRank, city);
    const winner = String(battleResult?.winner || '').trim().toLowerCase();
    const tier = eligibility.tier;

    let injuryBonus = 0;
    let deathBonus = 0;

    if (winner === 'commander') {
        injuryBonus = 10 + eligibility.defenderRank * 0.95;
        deathBonus = 3 + eligibility.defenderRank * 0.28;
        if (eligibility.commanderRank <= eligibility.minRank + 2) {
            injuryBonus += 14;
            deathBonus += 7;
        }
        if (tier === 'citadel' || tier === 'kingdom') {
            injuryBonus += 8;
            deathBonus += 5;
        }
    } else {
        injuryBonus = 6 + eligibility.defenderGap * 1.35;
        deathBonus = 2 + eligibility.defenderGap * 0.42;
        if (eligibility.rankShortfall > 0) {
            injuryBonus += 8 + eligibility.rankShortfall * 2.2;
            deathBonus += 3 + eligibility.rankShortfall * 1.1;
        }
    }

    return {
        injuryBonus: Math.max(0, Math.round(injuryBonus)),
        deathBonus: Math.max(0, Math.round(deathBonus)),
        eligibility
    };
}

function buildRankAssaultRiskSummary(eligibility, injuryMid) {
    if (eligibility.rankShortfall > 0) {
        return `Rank ${eligibility.commanderRank} is below the rank ${eligibility.minRank} threshold for this `
            + `${eligibility.tierLabel} — capture is unlikely; expect defeat and heavy casualties.`;
    }
    if (injuryMid >= 55) {
        return 'Severe casualty pressure — even a successful assault will likely cost many injured and some dead.';
    }
    if (injuryMid >= 40) {
        return 'Heavy casualty pressure — injuries are expected; deaths are likely if you prevail.';
    }
    if (injuryMid >= 28) {
        return 'Moderate casualty pressure — injuries are likely; deaths are possible.';
    }
    return 'Light casualty pressure — injuries are possible; deaths are less likely.';
}

module.exports = {
    SETTLEMENT_DEFENDER_RANK,
    SETTLEMENT_MIN_SOLO_CAPTURE_RANK,
    clampCommanderRank,
    normalizeSettlementTier,
    resolveSettlementDefenderRank,
    resolveSoloCaptureEligibility,
    applySoloCaptureRankOutcome,
    resolveRankAssaultCasualtyModifiers,
    buildRankAssaultRiskSummary
};

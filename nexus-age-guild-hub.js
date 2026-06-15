/**

 * NEXUS — Adventurer's Guild hub jobs (settlement tier + commander rank gates).

 */

'use strict';



const { buildCommanderRankMeta, getCommanderRankDisplayTitle } = require('./nexus-commander-rank-titles');

const {

    commanderHasGuildUnlockSkill,

    formatGuildUnlockSkillLabel

} = require('./nexus-age-guild-skills');



const SETTLEMENT_TIER_ORDER = Object.freeze({

    village: 1,

    town: 2,

    city: 3,

    citadel: 4,

    kingdom: 5

});



const GUILD_HUB_JOBS = Object.freeze([

    {

        id: 'street-patrol',

        label: 'Settlement Patrol',

        description: 'NPC battle training · Low-Tier Difficulty (Ranks 1–7).',

        accessSummary: 'All settlement sizes',

        difficultyLabel: 'Low-Tier',

        kind: 'training',

        minRank: 1,

        maxRank: 7,

        minSettlementTier: 'village',

        excludeSettlementTiers: []

    },

    {

        id: 'civilian-transport',

        label: 'Civilian Escort',

        description: 'NPC battle training · Mid-Tier Difficulty (Ranks 7–14). Next tier above Settlement Patrol.',

        accessSummary: 'Town settlement or larger',

        difficultyLabel: 'Mid-Tier',

        kind: 'training',

        minRank: 7,

        maxRank: 14,

        minSettlementTier: 'town',

        excludeSettlementTiers: []

    },

    {

        id: 'trade-convoy',

        label: 'Trade Escort',

        description: 'Obtain high-reward merchant claim cards redeemable for gold.',

        accessSummary: "Merchant's Assistant skill",

        kind: 'trade',

        minRank: 1,

        maxRank: null,

        minSettlementTier: 'village',

        excludeSettlementTiers: [],

        requiredSkillId: 'merchants-assistant'

    },

    {

        id: 'border-patrol',

        label: 'Border Patrol',

        description: 'NPC battle training · High-Tier Difficulty (Rank 14–max).',

        accessSummary: 'Town settlement or larger',

        difficultyLabel: 'High-Tier',

        kind: 'training',

        minRank: 14,

        maxRank: null,

        minSettlementTier: 'town',

        excludeSettlementTiers: []

    },

    {

        id: 'player-bounties',

        label: 'Player Bounties (PvP Quests)',

        description: 'Accept a marked commander bounty. Win as the attacker within 24 hours for battle pass XP, gold, and nation RSD.',

        kind: 'bounties',

        minRank: 7,

        maxRank: null,

        minSettlementTier: 'citadel',

        excludeSettlementTiers: []

    }

]);



function normalizeSettlementTier(value) {

    const tier = String(value || 'village').trim().toLowerCase();

    return SETTLEMENT_TIER_ORDER[tier] ? tier : 'village';

}



function resolveCommanderRank(commander) {

    return Math.max(1, Math.min(22, Math.floor(Number(commander?.rank) || 1)));

}



function resolveTierRank(tier) {

    return SETTLEMENT_TIER_ORDER[normalizeSettlementTier(tier)] || 1;

}



function formatCommanderRankThreshold(rank, commander) {

    const rankMeta = buildCommanderRankMeta(commander);

    const threshold = Math.max(1, Math.floor(Number(rank) || 1));

    return getCommanderRankDisplayTitle(threshold, rankMeta.path, rankMeta.rankTitleGender)

        || `rank ${threshold}`;

}



function resolveJobLockReason(job, rank, settlementTier, commander) {

    const tier = normalizeSettlementTier(settlementTier);

    const tierRank = resolveTierRank(tier);



    if (job.minSettlementTier && resolveTierRank(job.minSettlementTier) > tierRank) {

        const required = job.minSettlementTier.charAt(0).toUpperCase() + job.minSettlementTier.slice(1);

        return `Requires a ${required} settlement or larger.`;

    }



    if (Array.isArray(job.excludeSettlementTiers) && job.excludeSettlementTiers.includes(tier)) {

        return `Not offered in ${tier} settlements.`;

    }



    if (job.requiredSkillId && !commanderHasGuildUnlockSkill(commander, job.requiredSkillId)) {

        return `Acquire the ${formatGuildUnlockSkillLabel(job.requiredSkillId)} skill to unlock.`;

    }



    if (job.maxRank != null && rank > job.maxRank) {

        if (job.id === 'street-patrol') {

            return `Settlement Patrol closes once you reach ${formatCommanderRankThreshold(job.maxRank + 1, commander)}.`;

        }

        if (job.id === 'civilian-transport') {

            return `Border Patrol is now required — Civilian Escort is retired at ${formatCommanderRankThreshold(job.maxRank + 1, commander)}.`;

        }

        return `Requires ${formatCommanderRankThreshold(job.maxRank, commander)} or lower.`;

    }



    if (rank < job.minRank) {

        return `Unlocks at ${formatCommanderRankThreshold(job.minRank, commander)}.`;

    }



    return '';

}



function buildGuildHubJobEntry(job, rank, settlementTier, commander) {

    const lockReason = resolveJobLockReason(job, rank, settlementTier, commander);

    const available = !lockReason;



    let featured = false;

    if (available && job.kind === 'training') {

        if (rank >= 14 && job.id === 'border-patrol') featured = true;

        else if (rank >= 7 && rank < 14 && job.id === 'civilian-transport') featured = true;

        else if (rank < 7 && job.id === 'street-patrol') featured = true;

    }



    return {

        id: job.id,

        label: job.label,

        description: job.description,

        accessSummary: job.accessSummary || '',

        difficultyLabel: job.difficultyLabel || '',

        kind: job.kind,

        available,

        featured,

        lockReason,

        minRank: job.minRank,

        maxRank: job.maxRank

    };

}



function buildGuildHubManifest(commander, settlementTier) {

    const rank = resolveCommanderRank(commander);

    const tier = normalizeSettlementTier(settlementTier);

    const jobs = GUILD_HUB_JOBS.map((job) => buildGuildHubJobEntry(job, rank, tier, commander));



    return {

        settlementTier: tier,

        settlementTierLabel: tier.charAt(0).toUpperCase() + tier.slice(1),

        rank,

        jobs,

        primaryTrainingJobId: rank >= 14

            ? 'border-patrol'

            : (rank >= 7 ? 'civilian-transport' : 'street-patrol')

    };

}



function resolveTrainingModeAvailability(commander, settlementTier, trainingMode) {

    const manifest = buildGuildHubManifest(commander, settlementTier);

    const job = manifest.jobs.find((entry) => entry.id === trainingMode);

    if (!job) {

        return { ok: false, errorCode: 'NEXUS-AGE-020', message: 'Unknown guild training mode.' };

    }

    if (job.kind !== 'training') {

        return { ok: false, errorCode: 'NEXUS-AGE-020', message: 'Selected guild activity is not a training mode.' };

    }

    if (!job.available) {

        return { ok: false, errorCode: 'NEXUS-AGE-020', message: job.lockReason || 'Training mode unavailable.' };

    }

    return { ok: true, job };

}



function isBountyVenueTier(settlementTier) {

    const tier = normalizeSettlementTier(settlementTier);

    return tier === 'citadel' || tier === 'kingdom';

}



module.exports = {

    GUILD_HUB_JOBS,

    SETTLEMENT_TIER_ORDER,

    normalizeSettlementTier,

    buildGuildHubManifest,

    resolveTrainingModeAvailability,

    isBountyVenueTier,

    resolveCommanderRank

};


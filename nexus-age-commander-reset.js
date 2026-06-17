/**
 * NEXUS — Commander rank / exile reset (Age ledger).
 */
'use strict';

const {
    buildAdminGoldRestorePatch,
    buildCommanderAgeArmyResetPatch
} = require('./nexus-age-ledger-admin');

const COMMANDER_RANK_RESET_LIMIT = 3;
const COMMANDER_EXILE_RESET_LIMIT = 1;

function buildCommanderAgeGearResetLedgerPatch() {
    return {
        ageGearSlots: null,
        ageGearLocked: false,
        ageGuildMerch: [],
        ageGuildPerks: null,
        ageGuildBonuses: null,
        ageGuildUnlockSkills: []
    };
}

function buildCommanderRankResetLedgerPatch() {
    return {
        rank: 1,
        ageGuildXp: 0,
        ageGuildAcceptedBountyId: null,
        ...buildAdminGoldRestorePatch(),
        ...buildCommanderAgeArmyResetPatch(),
        ...buildCommanderAgeGearResetLedgerPatch()
    };
}

function buildCommanderExileResetLedgerPatch() {
    return {
        ...buildCommanderRankResetLedgerPatch(),
        gameNation: '',
        onboardingRegionId: '',
        allianceId: ''
    };
}

function resolveAgeResetUsageEntry(usage, userKey, sessionKey) {
    const store = usage && typeof usage === 'object' ? usage : {};
    const key = String(userKey || '').trim().toLowerCase().slice(0, 64);
    const session = String(sessionKey || '').trim().slice(0, 128);
    if (!key || !session) {
        return null;
    }

    const existing = store[key];
    if (existing && typeof existing === 'object' && existing.sessionKey === session) {
        return {
            sessionKey: session,
            rankResetsUsed: Math.max(0, Math.min(COMMANDER_RANK_RESET_LIMIT, parseInt(existing.rankResetsUsed, 10) || 0)),
            exileResetsUsed: Math.max(0, Math.min(COMMANDER_EXILE_RESET_LIMIT, parseInt(existing.exileResetsUsed, 10) || 0))
        };
    }

    return {
        sessionKey: session,
        rankResetsUsed: 0,
        exileResetsUsed: 0
    };
}

function getAgeResetRemaining(entry, mode) {
    if (!entry) return 0;
    if (mode === 'exile') {
        return Math.max(0, COMMANDER_EXILE_RESET_LIMIT - entry.exileResetsUsed);
    }
    return Math.max(0, COMMANDER_RANK_RESET_LIMIT - entry.rankResetsUsed);
}

function canApplyCommanderAgeReset(usage, userKey, sessionKey, mode) {
    if (mode !== 'rank' && mode !== 'exile') return false;
    const entry = resolveAgeResetUsageEntry(usage, userKey, sessionKey);
    if (!entry) return false;
    return getAgeResetRemaining(entry, mode) > 0;
}

function incrementAgeResetUsage(usage, userKey, sessionKey, mode) {
    const store = usage && typeof usage === 'object' ? { ...usage } : {};
    const key = String(userKey || '').trim().toLowerCase().slice(0, 64);
    const entry = resolveAgeResetUsageEntry(store, userKey, sessionKey);
    if (!entry) return store;

    if (mode === 'exile') {
        entry.exileResetsUsed = Math.min(COMMANDER_EXILE_RESET_LIMIT, entry.exileResetsUsed + 1);
    } else {
        entry.rankResetsUsed = Math.min(COMMANDER_RANK_RESET_LIMIT, entry.rankResetsUsed + 1);
    }

    store[key] = entry;
    return store;
}

module.exports = {
    COMMANDER_RANK_RESET_LIMIT,
    COMMANDER_EXILE_RESET_LIMIT,
    buildCommanderAgeGearResetLedgerPatch,
    buildCommanderRankResetLedgerPatch,
    buildCommanderExileResetLedgerPatch,
    resolveAgeResetUsageEntry,
    getAgeResetRemaining,
    canApplyCommanderAgeReset,
    incrementAgeResetUsage
};

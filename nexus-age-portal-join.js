/**
 * NEXUS — Temporary portal direct-to-age join + commander account reset helpers.
 */
'use strict';

const {
    buildCommanderExileResetLedgerPatch
} = require('./nexus-age-commander-reset');
const {
    normalizeCommanderMovementRecord,
    applyMovePointRegen
} = require('./nexus-age-movement');
const {
    getOnboardingOpenConfig,
    resolveOnboardingNationId,
    resolveOnboardingRegionIdForNation
} = require('./nexus-onboarding');
const { DEV_NATION_REGION_IDS } = require('./nexus-dev-nation-switch');

/** When true, main portal Join skips game.html and routes straight to agealpha. */
const PORTAL_DIRECT_AGE_JOIN_ENABLED = true;

function isPortalDirectAgeJoinEnabled() {
    return PORTAL_DIRECT_AGE_JOIN_ENABLED;
}

function resolveOnboardingRegionForNation(nationId) {
    const nation = resolveOnboardingNationId(nationId);
    if (!nation) return '';
    return resolveOnboardingRegionIdForNation(nation)
        || DEV_NATION_REGION_IDS[nation]
        || getOnboardingOpenConfig().defaultRegionId
        || 'region-3';
}

function pickRandomOpenNationId(rng = Math.random) {
    const nations = getOnboardingOpenConfig().nationIds.filter(Boolean);
    if (!nations.length) {
        return getOnboardingOpenConfig().defaultNationId || 'aesthene';
    }
    const roll = typeof rng === 'function' ? rng() : Math.random();
    const index = Math.min(nations.length - 1, Math.floor(roll * nations.length));
    return nations[index];
}

function buildDirectAgeJoinMovementRefillRecord(existingRecord, nationKey) {
    const normalized = normalizeCommanderMovementRecord(
        existingRecord && typeof existingRecord === 'object'
            ? {
                catalogCityId: existingRecord.catalogCityId,
                armyFocus: existingRecord.armyFocus || ''
            }
            : {},
        nationKey
    );
    const regen = applyMovePointRegen(normalized);
    return {
        ...normalized,
        movePoints: regen.movePoints,
        lastMovePointRegenAt: regen.lastMovePointRegenAt
    };
}
function buildRandomNationEnrollmentPatch(rawNationId, options = {}) {
    const nationId = resolveOnboardingNationId(rawNationId)
        || (options.allowRandom !== false ? pickRandomOpenNationId(options.rng) : '');
    if (!nationId) return null;

    return {
        gameNation: nationId,
        onboardingRegionId: resolveOnboardingRegionForNation(nationId),
        gameNationSetAt: new Date().toISOString()
    };
}

function buildCommanderAccountResetPatch(commander) {
    const awards = Array.isArray(commander?.awards) ? commander.awards : [];
    const medals = Array.isArray(commander?.medals) ? commander.medals : [];

    return {
        ...buildCommanderExileResetLedgerPatch(),
        awards,
        medals,
        ageGearSlots: null,
        ageGearLocked: false,
        ageGuildMerch: [],
        ageGuildPerks: null,
        ageGuildBonuses: null,
        ageGuildUnlockSkills: [],
        ageResetUsage: {},
        path: '',
        ageClassPerkChoices: null,
        ageClassPerk1Branch: '',
        ageClassConfirmedAt: null,
        ageRosterSeededAt: null,
        agePortalEnrolledAt: null,
        dossierUpdatedAt: new Date().toISOString()
    };
}

function resetCommanderRecordPreservingAchievements(commander) {
    if (!commander || typeof commander !== 'object') return commander;
    return {
        ...commander,
        ...buildCommanderAccountResetPatch(commander)
    };
}

module.exports = {
    PORTAL_DIRECT_AGE_JOIN_ENABLED,
    isPortalDirectAgeJoinEnabled,
    resolveOnboardingRegionForNation,
    pickRandomOpenNationId,
    buildRandomNationEnrollmentPatch,
    buildDirectAgeJoinMovementRefillRecord,
    buildCommanderAccountResetPatch,
    resetCommanderRecordPreservingAchievements
};

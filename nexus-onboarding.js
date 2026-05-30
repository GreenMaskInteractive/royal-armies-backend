/**
 * NEXUS — onboarding gates (open nations/regions during alpha).
 */
'use strict';

const { resolveCatalogNationKey } = require('./nexus-age-movement');

/** Catalog nation ids currently selectable in onboarding. */
const ONBOARDING_OPEN_NATION_IDS = Object.freeze(['aesthene']);

/** Region ids that may be chosen before nation pledge (must include open nations). */
const ONBOARDING_OPEN_REGION_IDS = Object.freeze(['region-3']);

function isOnboardingNationAllowed(rawNationId) {
    const resolved = resolveCatalogNationKey(rawNationId);
    return Boolean(resolved && ONBOARDING_OPEN_NATION_IDS.includes(resolved));
}

function isOnboardingRegionAllowed(rawRegionId) {
    const regionId = String(rawRegionId || '').trim();
    return Boolean(regionId && ONBOARDING_OPEN_REGION_IDS.includes(regionId));
}

function resolveOnboardingNationId(rawNationId) {
    if (!isOnboardingNationAllowed(rawNationId)) {
        return '';
    }
    return resolveCatalogNationKey(rawNationId);
}

function getOnboardingOpenConfig() {
    return {
        nationIds: [...ONBOARDING_OPEN_NATION_IDS],
        regionIds: [...ONBOARDING_OPEN_REGION_IDS],
        defaultNationId: ONBOARDING_OPEN_NATION_IDS[0] || 'aesthene',
        defaultRegionId: ONBOARDING_OPEN_REGION_IDS[0] || 'region-3'
    };
}

module.exports = {
    ONBOARDING_OPEN_NATION_IDS,
    ONBOARDING_OPEN_REGION_IDS,
    isOnboardingNationAllowed,
    isOnboardingRegionAllowed,
    resolveOnboardingNationId,
    getOnboardingOpenConfig
};

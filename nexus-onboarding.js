/**
 * NEXUS — onboarding gates (open nations/regions during alpha).
 */
'use strict';

const {
    resolveCatalogNationKey,
    listCatalogNationsWithCities,
    resolveCatalogNationRegionId,
    loadCityCatalog
} = require('./nexus-age-movement');

function getOnboardingOpenNationIds() {
    return listCatalogNationsWithCities();
}

function getOnboardingOpenRegionIds() {
    const catalog = loadCityCatalog();
    const regionSet = new Set();
    (catalog.nations || []).forEach((nation) => {
        if (!Array.isArray(nation.cityIds) || !nation.cityIds.length) return;
        const regionId = String(nation.regionId || '').trim();
        if (regionId) regionSet.add(regionId);
    });
    return [...regionSet].sort((a, b) => a.localeCompare(b));
}

function isOnboardingNationAllowed(rawNationId) {
    const resolved = resolveCatalogNationKey(rawNationId);
    return Boolean(resolved && getOnboardingOpenNationIds().includes(resolved));
}

function isOnboardingRegionAllowed(rawRegionId) {
    const regionId = String(rawRegionId || '').trim();
    return Boolean(regionId && getOnboardingOpenRegionIds().includes(regionId));
}

function resolveOnboardingNationId(rawNationId) {
    if (!isOnboardingNationAllowed(rawNationId)) {
        return '';
    }
    return resolveCatalogNationKey(rawNationId);
}

function getOnboardingOpenConfig() {
    const nationIds = getOnboardingOpenNationIds();
    const regionIds = getOnboardingOpenRegionIds();
    return {
        nationIds,
        regionIds,
        defaultNationId: nationIds[0] || 'aesthene',
        defaultRegionId: regionIds.includes('region-3') ? 'region-3' : (regionIds[0] || 'region-3')
    };
}

function resolveOnboardingRegionIdForNation(rawNationId) {
    const nationId = resolveOnboardingNationId(rawNationId);
    if (!nationId) return '';
    return resolveCatalogNationRegionId(nationId)
        || getOnboardingOpenConfig().defaultRegionId
        || 'region-3';
}

module.exports = {
    getOnboardingOpenNationIds,
    getOnboardingOpenRegionIds,
    isOnboardingNationAllowed,
    isOnboardingRegionAllowed,
    resolveOnboardingNationId,
    resolveOnboardingRegionIdForNation,
    getOnboardingOpenConfig
};

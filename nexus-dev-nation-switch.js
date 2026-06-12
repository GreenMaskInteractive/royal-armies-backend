/**
 * NEXUS — local dev nation switch (bypass onboarding lock).
 */
'use strict';

const { resolveCatalogNationKey } = require('./nexus-age-movement');

const { listCatalogNationsWithCities, resolveCatalogNationRegionId } = require('./nexus-age-movement');

/** Nations exposed in the dev bypass panel — all catalog nations with playable cities. */
function getDevSwitchableNationIds() {
    return listCatalogNationsWithCities();
}

const DEV_SWITCHABLE_NATION_IDS = Object.freeze(getDevSwitchableNationIds());

const DEV_NATION_REGION_IDS = Object.freeze({
    lyllis: 'region-1',
    trex: 'region-1',
    aesthene: 'region-3',
    dravic: 'region-3',
    vaerenth: 'region-3'
});

const DEV_NATION_LABELS = Object.freeze({
    aesthene: 'Aesthene',
    lyllis: 'Lyllis',
    dravic: 'Dravic',
    vaerenth: 'Vaerenth',
    trex: 'Trex'
});

function resolveDevSwitchNationId(rawNationId) {
    const nationId = resolveCatalogNationKey(rawNationId);
    if (!nationId || !DEV_SWITCHABLE_NATION_IDS.includes(nationId)) {
        return '';
    }
    return nationId;
}

function resolveDevNationRegionId(rawNationId) {
    const nationId = resolveDevSwitchNationId(rawNationId);
    if (!nationId) return '';
    return resolveCatalogNationRegionId(nationId) || DEV_NATION_REGION_IDS[nationId] || '';
}

function buildDevNationSwitchLedgerPatch(rawNationId) {
    const nationId = resolveDevSwitchNationId(rawNationId);
    const regionId = resolveDevNationRegionId(nationId);
    if (!nationId || !regionId) return null;

    return {
        gameNation: nationId,
        onboardingRegionId: regionId,
        gameNationSetAt: new Date().toISOString()
    };
}

module.exports = {
    DEV_SWITCHABLE_NATION_IDS,
    DEV_NATION_REGION_IDS,
    DEV_NATION_LABELS,
    resolveDevSwitchNationId,
    resolveDevNationRegionId,
    buildDevNationSwitchLedgerPatch
};

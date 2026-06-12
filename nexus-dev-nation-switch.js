/**
 * NEXUS — local dev nation switch (bypass onboarding lock).
 */
'use strict';

const { resolveCatalogNationKey } = require('./nexus-age-movement');

/** Nations exposed in the dev bypass panel — not gated by onboarding alpha list. */
const DEV_SWITCHABLE_NATION_IDS = Object.freeze(['aesthene', 'lyllis', 'dravic', 'vaerenth', 'trex']);

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
    return DEV_NATION_REGION_IDS[nationId] || '';
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

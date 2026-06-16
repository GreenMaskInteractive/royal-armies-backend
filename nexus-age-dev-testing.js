/**
 * NEXUS — temporary Age alpha testing toggles (global war, solo city assault tuning).
 * Remove or disable flags before a production diplomacy release.
 */
'use strict';

const {
    listCatalogNationsWithCities,
    resolveCatalogNationKey
} = require('./nexus-age-movement');

/** All playable nations are at war with every other nation. */
const DEV_GLOBAL_NATION_WAR_ENABLED = true;

/** Weaker city garrisons so solo commanders can capture bordering settlements during testing. */
const DEV_SOLO_CITY_ASSAULT_EASIER = true;

/** Multiplier applied to generated garrison size when solo-assault easing is on (0–1). */
const DEV_CITY_ASSAULT_GARRISON_MULTIPLIER = 0.4;

function isDevGlobalNationWarEnabled() {
    return DEV_GLOBAL_NATION_WAR_ENABLED;
}

function isDevSoloCityAssaultEasierEnabled() {
    return DEV_SOLO_CITY_ASSAULT_EASIER;
}

function getDevCityAssaultGarrisonMultiplier() {
    return isDevSoloCityAssaultEasierEnabled()
        ? Math.max(0.15, Math.min(1, Number(DEV_CITY_ASSAULT_GARRISON_MULTIPLIER) || 0.4))
        : 1;
}

function resolveDevGlobalWarEnemyNationIds(viewerNation) {
    if (!isDevGlobalNationWarEnabled()) return [];
    const selfKey = resolveCatalogNationKey(viewerNation);
    if (!selfKey) return [];
    return listCatalogNationsWithCities().filter((nationId) => nationId !== selfKey);
}

function resolveDevGlobalWarLedger(viewerNation) {
    const selfKey = resolveCatalogNationKey(viewerNation);
    const enemies = resolveDevGlobalWarEnemyNationIds(selfKey);
    const now = new Date().toISOString();

    return {
        wars: enemies.map((nationId) => ({
            id: `dev-war-${nationId}`,
            opponentNationId: nationId,
            opponentNationName: nationId,
            declaredAt: now,
            declaredBy: 'dev-testing',
            status: 'active',
            endedAt: null,
            endedReason: null
        })),
        relations: {
            allies: [],
            naps: [],
            enemies: enemies.map((nationId) => ({
                nationId,
                nationName: nationId
            }))
        }
    };
}

function areNationsAlliedForAgeCombat(nationA, nationB, baseIsAlliedFn) {
    const a = resolveCatalogNationKey(nationA);
    const b = resolveCatalogNationKey(nationB);
    if (!a || !b) return false;
    if (a === b) return true;
    if (isDevGlobalNationWarEnabled()) return false;
    return typeof baseIsAlliedFn === 'function' ? baseIsAlliedFn(a, b) : false;
}

module.exports = {
    DEV_GLOBAL_NATION_WAR_ENABLED,
    DEV_SOLO_CITY_ASSAULT_EASIER,
    isDevGlobalNationWarEnabled,
    isDevSoloCityAssaultEasierEnabled,
    getDevCityAssaultGarrisonMultiplier,
    resolveDevGlobalWarEnemyNationIds,
    resolveDevGlobalWarLedger,
    areNationsAlliedForAgeCombat
};

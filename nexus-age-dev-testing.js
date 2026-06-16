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

/** During alpha assault testing, battle deaths become injuries instead of removing stacks. */
const DEV_ASSAULT_NO_PERMANENT_DEATH = true;

/** Multiplier applied to generated garrison size when solo-assault easing is on (0–1). */
const DEV_CITY_ASSAULT_GARRISON_MULTIPLIER = 0.62;

function isDevGlobalNationWarEnabled() {
    return DEV_GLOBAL_NATION_WAR_ENABLED;
}

function isDevSoloCityAssaultEasierEnabled() {
    return DEV_SOLO_CITY_ASSAULT_EASIER;
}

function isDevAssaultNoPermanentDeathEnabled() {
    return DEV_ASSAULT_NO_PERMANENT_DEATH;
}

function reviveCommanderArmyFromSnapshot(commander) {
    const { normalizeAgeArmy, resolveCommanderAgeArmy, countAgeArmyUnits } = require('./nexus-age-roster');
    const lastAssault = commander?.ageArmyLastAssaultArmy;
    const snapshot = commander?.ageArmyPreBattleSnapshot;
    const sourceArmy = (Array.isArray(lastAssault) && lastAssault.length)
        ? lastAssault
        : ((Array.isArray(snapshot) && snapshot.length) ? snapshot : null);
    let army;

    if (sourceArmy) {
        army = normalizeAgeArmy(JSON.parse(JSON.stringify(sourceArmy)));
    } else {
        army = normalizeAgeArmy(resolveCommanderAgeArmy(commander));
    }

    const restored = army
        .map((stack) => ({
            ...stack,
            injuredQty: 0
        }))
        .filter((stack) => Math.max(0, Math.floor(Number(stack.qty) || 0)) > 0);

    return {
        ageArmy: restored,
        restoredFromSnapshot: Boolean(sourceArmy),
        unitsTotal: countAgeArmyUnits(restored).total,
        unitsUninjured: countAgeArmyUnits(restored).uninjured
    };
}

function getDevCityAssaultGarrisonMultiplier(commanderRank, city) {
    if (!isDevSoloCityAssaultEasierEnabled()) return 1;
    const base = Math.max(0.15, Math.min(1, Number(DEV_CITY_ASSAULT_GARRISON_MULTIPLIER) || 0.62));
    if (!city) return base;

    const rank = Math.max(1, Math.min(22, Math.floor(Number(commanderRank) || 1)));
    const tier = String(city?.settlementTier || 'village').trim().toLowerCase();
    const minCaptureByTier = {
        village: 6,
        town: 8,
        city: 11,
        citadel: 14,
        kingdom: 17
    };
    const minRank = minCaptureByTier[tier] || minCaptureByTier.village;
    if (rank < minRank) {
        return Math.min(1, base + 0.22);
    }
    const headroom = rank - minRank;
    return Math.max(0.42, base - headroom * 0.025);
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
    DEV_ASSAULT_NO_PERMANENT_DEATH,
    isDevGlobalNationWarEnabled,
    isDevSoloCityAssaultEasierEnabled,
    isDevAssaultNoPermanentDeathEnabled,
    reviveCommanderArmyFromSnapshot,
    getDevCityAssaultGarrisonMultiplier,
    resolveDevGlobalWarEnemyNationIds,
    resolveDevGlobalWarLedger,
    areNationsAlliedForAgeCombat
};

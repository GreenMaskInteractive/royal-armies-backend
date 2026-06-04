/**
 * NEXUS — Age city assault battles (commander army vs city garrison).
 */
'use strict';

const { loadUnitPurchaseCatalog } = require('./nexus-age-recruitment');
const { resolveCommanderAgeArmy, normalizeAgeArmy } = require('./nexus-age-roster');
const {
    simulateTrainingBattle,
    buildTrainingNpcArmy,
    TRAINING_MODE_LABELS
} = require('./nexus-age-battle-sim');

const CITY_BATTLE_MODE = 'city-assault';

const SETTLEMENT_GARRISON_SCALE = Object.freeze({
    village: 1,
    town: 1.12,
    city: 1.38,
    citadel: 1.62,
    kingdom: 1.95
});

function normalizeSettlementTier(raw) {
    const tier = String(raw || 'village').trim().toLowerCase();
    return SETTLEMENT_GARRISON_SCALE[tier] ? tier : 'village';
}

function normalizePlayersInCityCount(raw) {
    const count = Math.floor(Number(raw) || 0);
    if (!Number.isFinite(count) || count < 1) return 1;
    return Math.min(24, count);
}

function buildHealthyBattleStacks(army) {
    return normalizeAgeArmy(army).map((stack) => {
        const qty = Math.max(0, Math.floor(Number(stack?.qty) || 0));
        const injured = Math.min(qty, Math.max(0, Math.floor(Number(stack?.injuredQty) || 0)));
        const healthy = Math.max(0, qty - injured);
        if (!healthy) return null;
        return { ...stack, qty: healthy, injuredQty: 0 };
    }).filter(Boolean);
}

function scaleGarrisonStacks(stacks, multiplier) {
    const scale = Math.max(0.5, Number(multiplier) || 1);
    return (Array.isArray(stacks) ? stacks : []).map((stack) => ({
        ...stack,
        qty: Math.max(1, Math.round(Math.max(1, Math.floor(Number(stack?.qty) || 1)) * scale))
    }));
}

function buildCityGarrisonArmy(catalog, commanderRank, city, playersInCity = 1) {
    const catalogRef = catalog || loadUnitPurchaseCatalog();
    const tier = normalizeSettlementTier(city?.settlementTier);
    const tierScale = SETTLEMENT_GARRISON_SCALE[tier] || 1;
    const allyScale = 1 + (Math.max(0, normalizePlayersInCityCount(playersInCity) - 1) * 0.1);
    const rank = Math.max(1, Math.min(22, Math.floor(Number(commanderRank) || 1)));

    const baseGarrison = buildTrainingNpcArmy(catalogRef, undefined, 'border-patrol', rank);
    return scaleGarrisonStacks(baseGarrison, tierScale * allyScale);
}

function executeCityAssaultBattle(commander, city, playersInCity = 1) {
    const catalog = loadUnitPurchaseCatalog();
    const army = resolveCommanderAgeArmy(commander);
    const battleStacks = buildHealthyBattleStacks(army);
    const totalUnits = battleStacks.reduce((sum, stack) => sum + Math.max(0, Math.floor(Number(stack?.qty) || 0)), 0);

    if (!totalUnits) {
        return { ok: false, errorCode: 'NEXUS-AGE-017' };
    }

    const commanderRank = Math.max(1, Math.min(22, Math.floor(Number(commander?.rank) || 1)));
    const comrades = normalizePlayersInCityCount(playersInCity);
    const garrison = buildCityGarrisonArmy(catalog, commanderRank, city, comrades);
    const battle = simulateTrainingBattle(battleStacks, garrison, catalog, CITY_BATTLE_MODE);
    if (!battle.ok) return battle;

    return {
        ok: true,
        battleRole: 'assault',
        playersInCity: comrades,
        cityId: String(city?.id || '').trim(),
        cityName: String(city?.name || 'City').trim(),
        trainingMode: CITY_BATTLE_MODE,
        trainingModeLabel: TRAINING_MODE_LABELS[CITY_BATTLE_MODE] || 'City Assault',
        commanderRank,
        ...battle,
        commanderUnits: totalUnits,
        npcUnits: garrison.reduce((sum, stack) => sum + stack.qty, 0)
    };
}

module.exports = {
    CITY_BATTLE_MODE,
    SETTLEMENT_GARRISON_SCALE,
    executeCityAssaultBattle,
    buildCityGarrisonArmy,
    buildHealthyBattleStacks,
    normalizePlayersInCityCount
};

/**
 * NEXUS — Age ledger admin utilities (roster reset, gold restore).
 */
'use strict';

const {
    AGE_COMMANDER_GOLD_DEFAULT,
    AGE_COMMANDER_PROVISIONS_DEFAULT
} = require('./nexus-age-recruitment');
const { reviveCommanderArmyFromSnapshot } = require('./nexus-age-dev-testing');

function isAgeLedgerAdminUsername(username) {
    return String(username || '').trim().toLowerCase() === 'caleb_admin';
}

function buildCommanderAgeArmyResetPatch() {
    return {
        ageArmy: [],
        army: []
    };
}

function buildAdminGoldRestorePatch() {
    return {
        ageGold: AGE_COMMANDER_GOLD_DEFAULT,
        ageProvisions: AGE_COMMANDER_PROVISIONS_DEFAULT
    };
}

function resetAllCommanderAgeArmies(commanders) {
    const list = Array.isArray(commanders) ? commanders : [];
    let resetCount = 0;

    list.forEach((commander) => {
        if (!commander?.username) return;
        commander.ageArmy = [];
        if (Array.isArray(commander.army)) {
            commander.army = [];
        }
        resetCount += 1;
    });

    return resetCount;
}

function applyAdminLedgerRestore(commander) {
    if (!commander || typeof commander !== 'object') return commander;
    return {
        ...commander,
        ...buildAdminGoldRestorePatch(),
        ageArmy: []
    };
}

function reviveAdminCommanderArmy(commander) {
    const revivedArmy = reviveCommanderArmyFromSnapshot(commander);
    return {
        ageArmy: revivedArmy,
        ageArmyPreBattleSnapshot: null
    };
}

module.exports = {
    isAgeLedgerAdminUsername,
    buildCommanderAgeArmyResetPatch,
    buildAdminGoldRestorePatch,
    resetAllCommanderAgeArmies,
    applyAdminLedgerRestore,
    reviveAdminCommanderArmy
};

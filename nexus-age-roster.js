/**
 * NEXUS — Age commander roster (army unit counts for HUD and ledger).
 */
'use strict';

function floorNonNegative(value) {
    const numeric = Math.floor(Number(value) || 0);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function normalizeAgeArmyStack(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const qty = floorNonNegative(raw.qty);
    if (!qty) return null;

    const injuredQty = Math.min(qty, floorNonNegative(raw.injuredQty ?? raw.injured));

    return {
        class: String(raw.class || raw.type || 'INFANTRY').trim().slice(0, 32) || 'INFANTRY',
        name: String(raw.name || 'Recruit Shieldman').trim().slice(0, 64) || 'Recruit Shieldman',
        rank: Math.max(1, Math.floor(Number(raw.rank) || 1)),
        tier: Math.max(1, Math.floor(Number(raw.tier) || 1)),
        qty,
        injuredQty,
        purpose: String(raw.purpose || raw.role || raw.armyRole || '').trim().slice(0, 24)
    };
}

function normalizeAgeArmy(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeAgeArmyStack).filter(Boolean);
}

function resolveCommanderAgeArmy(commander) {
    const fromAge = normalizeAgeArmy(commander?.ageArmy);
    if (fromAge.length) return fromAge;

    const fromLegacy = normalizeAgeArmy(commander?.army);
    if (fromLegacy.length) return fromLegacy;

    return [];
}

function countAgeArmyUnits(stacks) {
    let total = 0;
    let injured = 0;

    (Array.isArray(stacks) ? stacks : []).forEach((stack) => {
        const qty = floorNonNegative(stack?.qty);
        if (!qty) return;

        const stackInjured = Math.min(qty, floorNonNegative(stack?.injuredQty ?? stack?.injured));
        total += qty;
        injured += stackInjured;
    });

    return {
        total,
        injured,
        uninjured: Math.max(0, total - injured)
    };
}

function buildAgeRosterHudPayload(commander) {
    const ageArmy = resolveCommanderAgeArmy(commander);
    const counts = countAgeArmyUnits(ageArmy);

    return {
        ageArmy,
        unitsTotal: counts.total,
        unitsUninjured: counts.uninjured
    };
}

function buildCommanderAgeRosterSeedPatch(commander) {
    const patch = {};
    const hasAgeArmyField = Array.isArray(commander?.ageArmy);
    const hasLegacyArmy = Array.isArray(commander?.army) && commander.army.length > 0;

    if (!hasAgeArmyField && !hasLegacyArmy) {
        patch.ageArmy = [];
    }

    return patch;
}

module.exports = {
    normalizeAgeArmyStack,
    normalizeAgeArmy,
    resolveCommanderAgeArmy,
    countAgeArmyUnits,
    buildAgeRosterHudPayload,
    buildCommanderAgeRosterSeedPatch
};

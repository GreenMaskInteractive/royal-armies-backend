/**
 * NEXUS — Nation Treasury (Royal Silver Dollars / RSD).
 * Awarded to the capturing nation on successful city captures and main drops.
 */
'use strict';

const NATION_TREASURY_CITY_CAPTURE_BASE_RSD = 125;
const NATION_TREASURY_PLAYER_IN_CITY_RSD = 100;

const NATION_TREASURY_REWARD_EVENT_TYPES = Object.freeze([
    'city-capture',
    'main-drop'
]);

function normalizeNationTreasuryEventType(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return NATION_TREASURY_REWARD_EVENT_TYPES.includes(normalized) ? normalized : '';
}

function normalizePlayersInCityCount(value) {
    const count = Math.floor(Number(value));
    if (!Number.isFinite(count) || count < 0) return 0;
    return Math.min(count, 500);
}

function calculateNationTreasuryCaptureReward(playersInCityCount) {
    const players = normalizePlayersInCityCount(playersInCityCount);
    return NATION_TREASURY_CITY_CAPTURE_BASE_RSD + (players * NATION_TREASURY_PLAYER_IN_CITY_RSD);
}

function getDefaultNationTreasuryRecord() {
    return {
        rsd: 0,
        updatedAt: null
    };
}

function normalizeNationTreasuryRecord(raw) {
    const record = raw && typeof raw === 'object' ? raw : {};
    const rsd = Math.max(0, Math.floor(Number(record.rsd) || 0));
    const updatedAt = record.updatedAt ? String(record.updatedAt) : null;
    return { rsd, updatedAt };
}

function buildNationTreasuryRewardMeta({
    eventType,
    playersInCity,
    cityId,
    cityName,
    awardedBy
}) {
    return {
        eventType: normalizeNationTreasuryEventType(eventType) || 'city-capture',
        playersInCity: normalizePlayersInCityCount(playersInCity),
        cityId: String(cityId || '').trim().slice(0, 80) || null,
        cityName: String(cityName || '').trim().slice(0, 120) || null,
        awardedBy: String(awardedBy || '').trim().slice(0, 80) || null,
        awardedAt: new Date().toISOString()
    };
}

function getNationTreasuryRewardRules() {
    return {
        currency: 'RSD',
        currencyLabel: 'Royal Silver Dollars',
        cityCaptureBaseRsd: NATION_TREASURY_CITY_CAPTURE_BASE_RSD,
        playerInCityRsd: NATION_TREASURY_PLAYER_IN_CITY_RSD,
        eventTypes: [...NATION_TREASURY_REWARD_EVENT_TYPES]
    };
}

module.exports = {
    NATION_TREASURY_CITY_CAPTURE_BASE_RSD,
    NATION_TREASURY_PLAYER_IN_CITY_RSD,
    NATION_TREASURY_REWARD_EVENT_TYPES,
    normalizeNationTreasuryEventType,
    normalizePlayersInCityCount,
    calculateNationTreasuryCaptureReward,
    getDefaultNationTreasuryRecord,
    normalizeNationTreasuryRecord,
    buildNationTreasuryRewardMeta,
    getNationTreasuryRewardRules
};

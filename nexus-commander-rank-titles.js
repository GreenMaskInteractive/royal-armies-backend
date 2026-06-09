/**
 * NEXUS — Commander rank display titles (Battlemaster / Battlemage, ranks 1–22).
 */
'use strict';

const COMMANDER_RANK_TITLE_MAX = 22;

const BATTLEMASTER_RANK_TITLES_MALE = Object.freeze([
    'Vintenary Commander',
    'Decurion Commander',
    'Warden Commander',
    'Serjeant Commander',
    'Provost Commander',
    'Centenary Commander',
    'Herald Commander',
    'Bachelor Commander',
    'Banneret Commander',
    'Castellan Commander',
    'Seneschal Commander',
    'Constable Commander',
    'Millenary Commander',
    'Baronial Commander',
    'Comital Commander',
    'Marcher Commander',
    'Palatine Commander',
    'Marshal Commander',
    'Duchal Commander',
    'Viceroy Commander',
    'Sovereign Commander',
    'Lord-High Commander'
]);

const BATTLEMASTER_RANK_TITLES_FEMALE = Object.freeze([
    'Vintenary Commandress',
    'Decurion Commandress',
    'Warden Commandress',
    'Serjeant Commandress',
    'Provost Commandress',
    'Centenary Commandress',
    'Herald Commandress',
    'Bachelor Commandress',
    'Banneret Commandress',
    'Castellan Commandress',
    'Seneschal Commandress',
    'Constable Commandress',
    'Millenary Commandress',
    'Baronial Commandress',
    'Comital Commandress',
    'Marcher Commandress',
    'Palatine Commandress',
    'Marshal Commandress',
    'Duchal Commandress',
    'Viceroy Commandress',
    'Sovereign Commandress',
    'Lord-High Commandress'
]);

const BATTLEMAGE_RANK_TITLES_MALE = Object.freeze([
    'Initiate Magus',
    'Apprentice Magus',
    'Acolyte Magus',
    'Evoker Magus',
    'Channeler Magus',
    'Circle Magus',
    'Signifier Magus',
    'Scholastic Magus',
    'Weaver Magus',
    'Warden Magus',
    'Preceptor Magus',
    'High Magus',
    'Grand Magus',
    'Arcanist Magus',
    'Archmagus',
    'Sorcerer-General',
    'Coven-Lord',
    'Master of Spheres',
    'Nexus-Thane Magus',
    'Void-Exarch Magus',
    'Hierophant Magus',
    'Aether-Sovereign Magus'
]);

const BATTLEMAGE_RANK_TITLES_FEMALE = Object.freeze([
    'Initiate Maga',
    'Apprentice Maga',
    'Acolyte Maga',
    'Evoker Maga',
    'Channeler Maga',
    'Circle Maga',
    'Signifier Maga',
    'Scholastic Maga',
    'Weaver Maga',
    'Warden Maga',
    'Preceptor Maga',
    'High Maga',
    'Grand Maga',
    'Arcanist Maga',
    'Archmaga',
    'Sorceress-General',
    'Coven-Lady',
    'Mistress of Spheres',
    'Nexus-Thane Maga',
    'Void-Exarch Maga',
    'Hierophant Maga',
    'Aether-Sovereign Maga'
]);

function clampCommanderRank(rank) {
    const parsed = Math.floor(Number(rank) || 1);
    if (!Number.isFinite(parsed) || parsed < 1) return 1;
    return parsed;
}

function resolveCommanderPathId(pathCode) {
    const path = String(pathCode || '').trim().toUpperCase();
    if (path === 'MAG' || path === 'MAGIC') return 'battlemage';
    return 'battlemaster';
}

function resolveCommanderRankTitleGender(raw) {
    const value = String(raw || '').trim().toLowerCase();
    return value === 'female' ? 'female' : 'male';
}

function getCommanderRankTitleTable(pathCode, gender) {
    const pathId = resolveCommanderPathId(pathCode);
    const useFemale = resolveCommanderRankTitleGender(gender) === 'female';
    if (pathId === 'battlemage') {
        return useFemale ? BATTLEMAGE_RANK_TITLES_FEMALE : BATTLEMAGE_RANK_TITLES_MALE;
    }
    return useFemale ? BATTLEMASTER_RANK_TITLES_FEMALE : BATTLEMASTER_RANK_TITLES_MALE;
}

function getCommanderRankDisplayTitle(rank, pathCode, gender) {
    const normalizedRank = clampCommanderRank(rank);
    if (normalizedRank > COMMANDER_RANK_TITLE_MAX) {
        return '';
    }
    const table = getCommanderRankTitleTable(pathCode, gender);
    return table[normalizedRank - 1] || '';
}

function getCommanderRankPillTier(rank) {
    const normalizedRank = clampCommanderRank(rank);
    if (normalizedRank > COMMANDER_RANK_TITLE_MAX) return 0;
    if (normalizedRank <= 6) return 1;
    if (normalizedRank <= 13) return 2;
    if (normalizedRank <= 16) return 3;
    if (normalizedRank <= 18) return 4;
    if (normalizedRank === 19) return 5;
    if (normalizedRank === 20) return 6;
    if (normalizedRank === 21) return 7;
    if (normalizedRank === 22) return 8;
    return 0;
}

function buildCommanderRankMeta(commander) {
    if (!commander || typeof commander !== 'object') {
        return {
            rank: 1,
            path: 'PHYS',
            rankTitleGender: 'male'
        };
    }
    return {
        rank: Math.min(
            COMMANDER_RANK_TITLE_MAX,
            Math.max(1, Math.floor(Number(commander.rank) || 1))
        ),
        path: String(commander.path || 'PHYS').trim().slice(0, 16) || 'PHYS',
        rankTitleGender: resolveCommanderRankTitleGender(commander.preferences?.rankTitleGender)
    };
}

function buildChatSenderRankMeta(commander) {
    const meta = buildCommanderRankMeta(commander);
    return {
        senderRank: meta.rank,
        senderPath: meta.path,
        senderRankTitleGender: meta.rankTitleGender
    };
}

module.exports = {
    COMMANDER_RANK_TITLE_MAX,
    BATTLEMASTER_RANK_TITLES_MALE,
    BATTLEMASTER_RANK_TITLES_FEMALE,
    BATTLEMAGE_RANK_TITLES_MALE,
    BATTLEMAGE_RANK_TITLES_FEMALE,
    clampCommanderRank,
    resolveCommanderPathId,
    resolveCommanderRankTitleGender,
    getCommanderRankTitleTable,
    getCommanderRankDisplayTitle,
    getCommanderRankPillTier,
    buildCommanderRankMeta,
    buildChatSenderRankMeta
};

/**
 * RIFT — Commander rank display titles & name pills (Battlemaster / Archmage).
 */
(function initRoyalArmiesCommanderRankTitles(global) {
    'use strict';

    const COMMANDER_RANK_TITLE_MAX = 22;

    const BATTLEMASTER_RANK_TITLES_MALE = [
        'Vintenary Commander', 'Decurion Commander', 'Warden Commander', 'Serjeant Commander',
        'Provost Commander', 'Centenary Commander', 'Herald Commander', 'Bachelor Commander',
        'Banneret Commander', 'Castellan Commander', 'Seneschal Commander', 'Constable Commander',
        'Millenary Commander', 'Baronial Commander', 'Comital Commander', 'Marcher Commander',
        'Palatine Commander', 'Marshal Commander', 'Duchal Commander', 'Viceroy Commander',
        'Sovereign Commander', 'Lord-High Commander'
    ];

    const BATTLEMASTER_RANK_TITLES_FEMALE = [
        'Vintenary Commandress', 'Decurion Commandress', 'Warden Commandress', 'Serjeant Commandress',
        'Provost Commandress', 'Centenary Commandress', 'Herald Commandress', 'Bachelor Commandress',
        'Banneret Commandress', 'Castellan Commandress', 'Seneschal Commandress', 'Constable Commandress',
        'Millenary Commandress', 'Baronial Commandress', 'Comital Commandress', 'Marcher Commandress',
        'Palatine Commandress', 'Marshal Commandress', 'Duchal Commandress', 'Viceroy Commandress',
        'Sovereign Commandress', 'Lord-High Commandress'
    ];

    const ARCHMAGE_RANK_TITLES_MALE = [
        'Initiate Magus', 'Apprentice Magus', 'Acolyte Magus', 'Evoker Magus', 'Channeler Magus',
        'Circle Magus', 'Signifier Magus', 'Scholastic Magus', 'Weaver Magus', 'Warden Magus',
        'Preceptor Magus', 'High Magus', 'Grand Magus', 'Arcanist Magus', 'Archmagus',
        'Sorcerer-General', 'Coven-Lord', 'Master of Spheres', 'Nexus-Thane Magus',
        'Void-Exarch Magus', 'Hierophant Magus', 'Aether-Sovereign Magus'
    ];

    const ARCHMAGE_RANK_TITLES_FEMALE = [
        'Initiate Maga', 'Apprentice Maga', 'Acolyte Maga', 'Evoker Maga', 'Channeler Maga',
        'Circle Maga', 'Signifier Maga', 'Scholastic Maga', 'Weaver Maga', 'Warden Maga',
        'Preceptor Maga', 'High Maga', 'Grand Maga', 'Arcanist Maga', 'Archmaga',
        'Sorceress-General', 'Coven-Lady', 'Mistress of Spheres', 'Nexus-Thane Maga',
        'Void-Exarch Maga', 'Hierophant Maga', 'Aether-Sovereign Maga'
    ];

    function clampCommanderRank(rank) {
        const parsed = Math.floor(Number(rank) || 1);
        if (!Number.isFinite(parsed) || parsed < 1) return 1;
        return parsed;
    }

    function resolveCommanderPathId(pathCode) {
        const path = String(pathCode || '').trim().toUpperCase();
        if (path === 'MAG' || path === 'MAGIC') return 'archmage';
        return 'battlemaster';
    }

    function resolveCommanderRankTitleGender(raw) {
        const value = String(raw || '').trim().toLowerCase();
        return value === 'female' ? 'female' : 'male';
    }

    function readSelfRankTitleGender() {
        if (typeof global.player !== 'undefined' && global.player.rankTitleGender) {
            return resolveCommanderRankTitleGender(global.player.rankTitleGender);
        }
        if (typeof global.confirmedRankTitleGender !== 'undefined') {
            return resolveCommanderRankTitleGender(global.confirmedRankTitleGender);
        }
        try {
            return resolveCommanderRankTitleGender(global.localStorage.getItem('savedRankTitleGender'));
        } catch (_err) {
            return 'male';
        }
    }

    function getCommanderRankTitleTable(pathCode, gender) {
        const pathId = resolveCommanderPathId(pathCode);
        const useFemale = resolveCommanderRankTitleGender(gender) === 'female';
        if (pathId === 'archmage') {
            return useFemale ? ARCHMAGE_RANK_TITLES_FEMALE : ARCHMAGE_RANK_TITLES_MALE;
        }
        return useFemale ? BATTLEMASTER_RANK_TITLES_FEMALE : BATTLEMASTER_RANK_TITLES_MALE;
    }

    function getCommanderRankDisplayTitle(rank, pathCode, gender) {
        const normalizedRank = clampCommanderRank(rank);
        if (normalizedRank > COMMANDER_RANK_TITLE_MAX) return '';
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

    function escapeRankHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function shouldShowCommanderRankPill(rank, options) {
        if (options?.forceShow) return true;
        if (options?.inAge === false) return false;
        if (typeof global.isCommanderEnrolledInActiveAgeRound === 'function') {
            return global.isCommanderEnrolledInActiveAgeRound();
        }
        if (options?.inAge === true) return true;
        return global.localStorage?.getItem('savedCommanderInActiveAge') === 'true';
    }

    function buildCommanderRankPillHtml(title, rank, options) {
        const tier = getCommanderRankPillTier(rank);
        if (!tier || !title) return '';
        const compact = options?.compact ? ' commander-rank-pill--compact' : '';
        const nametag = options?.nametag ? ' commander-rank-pill--nametag' : '';
        return `<span class="commander-rank-pill commander-rank-pill--tier-${tier}${compact}${nametag}" title="${escapeRankHtml(title)}">${escapeRankHtml(title)}</span>`;
    }

    function buildCommanderIdentityNameHtml(name, options) {
        const safeName = escapeRankHtml(name || 'Commander');
        const rank = clampCommanderRank(options?.rank);
        const path = options?.path || (typeof global.player !== 'undefined' ? global.player.path : 'PHYS');
        const gender = resolveCommanderRankTitleGender(
            options?.rankTitleGender != null ? options.rankTitleGender : readSelfRankTitleGender()
        );
        const title = getCommanderRankDisplayTitle(rank, path, gender);
        const showPill = shouldShowCommanderRankPill(rank, options) && title;

        if (!showPill) {
            return `<span class="commander-identity-name">${safeName}</span>`;
        }

        const pill = buildCommanderRankPillHtml(title, rank, options);
        return `<span class="commander-identity-name-row"><span class="commander-identity-name">${safeName}</span>${pill}</span>`;
    }

    function hydrateRankDataCommanderTitles() {
        if (typeof global.groundRanks === 'undefined' || typeof global.magicRanks === 'undefined') return;
        for (let rank = 1; rank <= COMMANDER_RANK_TITLE_MAX; rank += 1) {
            if (global.groundRanks[rank]) {
                global.groundRanks[rank].title = BATTLEMASTER_RANK_TITLES_MALE[rank - 1];
                global.groundRanks[rank].displayTitleMale = BATTLEMASTER_RANK_TITLES_MALE[rank - 1];
                global.groundRanks[rank].displayTitleFemale = BATTLEMASTER_RANK_TITLES_FEMALE[rank - 1];
            }
            if (global.magicRanks[rank]) {
                global.magicRanks[rank].title = ARCHMAGE_RANK_TITLES_MALE[rank - 1];
                global.magicRanks[rank].displayTitleMale = ARCHMAGE_RANK_TITLES_MALE[rank - 1];
                global.magicRanks[rank].displayTitleFemale = ARCHMAGE_RANK_TITLES_FEMALE[rank - 1];
            }
        }
    }

    const api = {
        COMMANDER_RANK_TITLE_MAX,
        clampCommanderRank,
        resolveCommanderPathId,
        resolveCommanderRankTitleGender,
        readSelfRankTitleGender,
        getCommanderRankTitleTable,
        getCommanderRankDisplayTitle,
        getCommanderRankPillTier,
        buildCommanderRankPillHtml,
        buildCommanderIdentityNameHtml,
        shouldShowCommanderRankPill,
        hydrateRankDataCommanderTitles
    };

    global.RoyalArmiesCommanderRankTitles = api;
    global.getCommanderRankDisplayTitle = (rank, path, gender) => api.getCommanderRankDisplayTitle(rank, path, gender);
    global.buildCommanderIdentityNameHtml = (name, options) => api.buildCommanderIdentityNameHtml(name, options);
    global.refreshCommanderRankTitleDisplays = function refreshCommanderRankTitleDisplays() {
        api.hydrateRankDataCommanderTitles();
        if (typeof global.refreshLoggedUserTagDisplay === 'function') {
            global.refreshLoggedUserTagDisplay();
        }
        if (typeof global.renderCommunityChatOnlineRoster === 'function') {
            const bin = global.document.getElementById('chat-online-roster-dock');
            global.renderCommunityChatOnlineRoster(bin);
        }
        if (global.RoyalArmiesGameChat && typeof global.RoyalArmiesGameChat.renderActiveChatStream === 'function') {
            global.RoyalArmiesGameChat.renderActiveChatStream();
        }
    };

    if (typeof global.groundRanks !== 'undefined') {
        hydrateRankDataCommanderTitles();
    } else {
        global.addEventListener('load', () => {
            hydrateRankDataCommanderTitles();
        }, { once: true });
    }
})(window);

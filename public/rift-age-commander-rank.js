/**
 * RIFT — Age commander rank HUD sync (Adventurer's Guild progression).
 */
(function initRoyalArmiesAgeCommanderRank(global) {
    'use strict';

    const AGE_COMMANDER_RANK_DEFAULT = 1;
    const AGE_COMMANDER_RANK_MAX = 22;
    const AGE_COMMANDER_RANK_UPDATED_EVENT = 'royalarmies:age-commander-rank-updated';

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

    let commanderRankMeta = {
        path: 'PHYS',
        rankTitleGender: 'male'
    };

    function clampCommanderRank(value) {
        const rank = Math.floor(Number(value) || AGE_COMMANDER_RANK_DEFAULT);
        if (!Number.isFinite(rank)) return AGE_COMMANDER_RANK_DEFAULT;
        return Math.max(AGE_COMMANDER_RANK_DEFAULT, Math.min(AGE_COMMANDER_RANK_MAX, rank));
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

    function readStoredRankTitleGender() {
        try {
            return resolveCommanderRankTitleGender(global.localStorage?.getItem('savedRankTitleGender'));
        } catch (_err) {
            return 'male';
        }
    }

    function getLocalCommanderRankTitleTable(pathCode, gender) {
        const pathId = resolveCommanderPathId(pathCode);
        const useFemale = resolveCommanderRankTitleGender(gender) === 'female';
        if (pathId === 'archmage') {
            return useFemale ? ARCHMAGE_RANK_TITLES_FEMALE : ARCHMAGE_RANK_TITLES_MALE;
        }
        return useFemale ? BATTLEMASTER_RANK_TITLES_FEMALE : BATTLEMASTER_RANK_TITLES_MALE;
    }

    function getLocalCommanderRankDisplayTitle(rank, pathCode, gender) {
        const normalizedRank = clampCommanderRank(rank);
        if (normalizedRank > AGE_COMMANDER_RANK_MAX) return '';
        const table = getLocalCommanderRankTitleTable(pathCode, gender);
        return table[normalizedRank - 1] || '';
    }

    function formatLocalCommanderRankLabel(rank, pathCode, gender) {
        const normalizedRank = clampCommanderRank(rank);
        const title = getLocalCommanderRankDisplayTitle(normalizedRank, pathCode, gender);
        return title || `Rank ${normalizedRank}`;
    }

    function ensureCommanderRankTitleApi() {
        if (global.RoyalArmiesCommanderRankTitles?.getCommanderRankDisplayTitle) {
            return global.RoyalArmiesCommanderRankTitles;
        }

        const api = {
            clampCommanderRank,
            resolveCommanderRankTitleGender,
            getCommanderRankDisplayTitle: getLocalCommanderRankDisplayTitle,
            formatCommanderRankLabel: formatLocalCommanderRankLabel,
            resolveSelfCommanderRankMeta: resolveHudRankTitleMeta
        };

        global.RoyalArmiesCommanderRankTitles = api;
        if (typeof global.getCommanderRankDisplayTitle !== 'function') {
            global.getCommanderRankDisplayTitle = api.getCommanderRankDisplayTitle;
        }
        if (typeof global.formatCommanderRankLabel !== 'function') {
            global.formatCommanderRankLabel = api.formatCommanderRankLabel;
        }
        return api;
    }

    function getPlayer() {
        return typeof global.player !== 'undefined' ? global.player : null;
    }

    function ensureAgeCommanderPlayerStub() {
        if (typeof global.player === 'undefined') {
            global.player = {
                rank: AGE_COMMANDER_RANK_DEFAULT,
                path: commanderRankMeta.path,
                rankTitleGender: commanderRankMeta.rankTitleGender
            };
        }
        return global.player;
    }

    function syncCommanderRankMeta(partial) {
        if (!partial || typeof partial !== 'object') return commanderRankMeta;

        if (partial.path != null && String(partial.path).trim()) {
            commanderRankMeta.path = String(partial.path).trim().slice(0, 16);
        }
        if (partial.rankTitleGender != null) {
            commanderRankMeta.rankTitleGender = resolveCommanderRankTitleGender(partial.rankTitleGender);
        }

        const player = getPlayer();
        if (player) {
            if (partial.path != null && String(partial.path).trim()) {
                player.path = commanderRankMeta.path;
            }
            if (partial.rankTitleGender != null) {
                player.rankTitleGender = commanderRankMeta.rankTitleGender;
            }
        }

        return commanderRankMeta;
    }

    function readHudRankElement() {
        const el = global.document.getElementById('age-hud-commander-rank');
        if (!el) return null;
        const fromDataset = Math.floor(Number(el.dataset.commanderRank) || 0);
        if (fromDataset >= 1) return fromDataset;
        const parsed = Math.floor(Number(String(el.textContent).replace(/[^\d]/g, '')) || 0);
        return parsed >= 1 ? parsed : null;
    }

    function resolveHudRankTitleMeta() {
        const rankTitles = ensureCommanderRankTitleApi();
        if (rankTitles?.resolveSelfCommanderRankMeta && global.RoyalArmiesCommanderRankTitles !== rankTitles) {
            return rankTitles.resolveSelfCommanderRankMeta();
        }

        const player = getPlayer();
        return {
            rank: clampCommanderRank(player?.rank || readHudRankElement() || AGE_COMMANDER_RANK_DEFAULT),
            path: player?.path || commanderRankMeta.path || 'PHYS',
            rankTitleGender: resolveCommanderRankTitleGender(
                player?.rankTitleGender != null ? player.rankTitleGender : (
                    commanderRankMeta.rankTitleGender || readStoredRankTitleGender()
                )
            )
        };
    }

    function resolveCommanderRankDisplayLabel(rank, options = {}) {
        const rankTitles = ensureCommanderRankTitleApi();
        const meta = resolveHudRankTitleMeta();
        const normalizedRank = clampCommanderRank(rank);
        const path = options.path ?? meta.path;
        const rankTitleGender = options.rankTitleGender ?? meta.rankTitleGender;

        if (options.rankDisplayTitle) return options.rankDisplayTitle;
        if (options.rankTitle) return options.rankTitle;
        if (options.targetRankTitle) return options.targetRankTitle;

        if (rankTitles?.formatCommanderRankLabel) {
            return rankTitles.formatCommanderRankLabel(normalizedRank, path, rankTitleGender);
        }
        if (rankTitles?.getCommanderRankDisplayTitle) {
            const title = rankTitles.getCommanderRankDisplayTitle(normalizedRank, path, rankTitleGender);
            if (title) return title;
        }
        return formatLocalCommanderRankLabel(normalizedRank, path, rankTitleGender);
    }

    function formatAgeHudCommanderRankDisplay(value) {
        return resolveCommanderRankDisplayLabel(value);
    }

    function ensureAgeCommanderRankInitialized() {
        ensureAgeCommanderPlayerStub();
        const player = getPlayer();
        if (!player) return AGE_COMMANDER_RANK_DEFAULT;

        const existing = Number(player.rank);
        if (Number.isFinite(existing) && existing >= 1) {
            return clampCommanderRank(existing);
        }

        const fromHud = readHudRankElement();
        const seeded = fromHud != null ? fromHud : AGE_COMMANDER_RANK_DEFAULT;
        player.rank = seeded;
        return seeded;
    }

    function resolveAgeCommanderRank() {
        return ensureAgeCommanderRankInitialized();
    }

    function setAgeHudCommanderRankDisplay(value) {
        const el = global.document.getElementById('age-hud-commander-rank');
        if (!el) return;
        const rank = clampCommanderRank(value);
        const label = formatAgeHudCommanderRankDisplay(rank);
        el.textContent = label;
        el.dataset.commanderRank = String(rank);
        el.setAttribute('aria-label', `Commander rank ${label}`);
        el.setAttribute('title', label);
    }

    function dispatchAgeCommanderRankUpdated(detail) {
        global.dispatchEvent(new CustomEvent(AGE_COMMANDER_RANK_UPDATED_EVENT, { detail }));
    }

    function refreshAgeHudCommanderRank() {
        ensureCommanderRankTitleApi();
        ensureAgeCommanderRankInitialized();
        setAgeHudCommanderRankDisplay(resolveAgeCommanderRank());
    }

    function setAgeCommanderRank(nextRank, options = {}) {
        ensureCommanderRankTitleApi();
        syncCommanderRankMeta(options);
        ensureAgeCommanderRankInitialized();
        const player = getPlayer();
        const previous = resolveAgeCommanderRank();
        const normalized = clampCommanderRank(nextRank);

        if (player) {
            player.rank = normalized;
        }

        setAgeHudCommanderRankDisplay(normalized);

        if (!options.silent) {
            dispatchAgeCommanderRankUpdated({
                rank: normalized,
                previous,
                delta: normalized - previous,
                source: options.source || 'set'
            });
        }

        if (typeof global.refreshCommanderRankTitleDisplays === 'function') {
            global.refreshCommanderRankTitleDisplays();
        } else if (typeof global.refreshLoggedUserTagDisplay === 'function') {
            global.refreshLoggedUserTagDisplay();
        }

        return normalized;
    }

    function applyCommanderRankPayload(payload, options = {}) {
        if (!payload || typeof payload !== 'object') return;
        syncCommanderRankMeta(payload);
        if (payload.rank === undefined) return;
        const rank = clampCommanderRank(payload.rank);
        setAgeCommanderRank(rank, {
            source: options.source || 'payload-sync',
            silent: true,
            path: payload.path,
            rankTitleGender: payload.rankTitleGender
        });
    }

    function bootAgeCommanderRank() {
        ensureCommanderRankTitleApi();
        refreshAgeHudCommanderRank();
    }

    global.RoyalArmiesAgeCommanderRank = {
        AGE_COMMANDER_RANK_DEFAULT,
        AGE_COMMANDER_RANK_MAX,
        AGE_COMMANDER_RANK_UPDATED_EVENT,
        resolveAgeCommanderRank,
        resolveCommanderRankDisplayLabel,
        formatAgeHudCommanderRankDisplay,
        syncCommanderRankMeta,
        applyCommanderRankPayload,
        setAgeCommanderRank,
        refreshAgeHudCommanderRank,
        ensureAgeCommanderRankInitialized
    };

    global.resolveAgeCommanderRank = resolveAgeCommanderRank;
    global.resolveCommanderRankDisplayLabel = resolveCommanderRankDisplayLabel;
    global.refreshAgeHudCommanderRank = refreshAgeHudCommanderRank;
    global.setAgeCommanderRank = setAgeCommanderRank;

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', bootAgeCommanderRank);
    } else {
        bootAgeCommanderRank();
    }
})(window);

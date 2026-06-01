/**
 * RIFT — Age commander rank HUD sync (Adventurer's Guild progression).
 */
(function initRoyalArmiesAgeCommanderRank(global) {
    'use strict';

    const AGE_COMMANDER_RANK_DEFAULT = 1;
    const AGE_COMMANDER_RANK_MAX = 22;
    const AGE_COMMANDER_RANK_UPDATED_EVENT = 'royalarmies:age-commander-rank-updated';

    function getPlayer() {
        return typeof global.player !== 'undefined' ? global.player : null;
    }

    function clampCommanderRank(value) {
        const rank = Math.floor(Number(value) || AGE_COMMANDER_RANK_DEFAULT);
        if (!Number.isFinite(rank)) return AGE_COMMANDER_RANK_DEFAULT;
        return Math.max(AGE_COMMANDER_RANK_DEFAULT, Math.min(AGE_COMMANDER_RANK_MAX, rank));
    }

    function readHudRankElement() {
        const el = global.document.getElementById('age-hud-commander-rank');
        if (!el?.textContent) return null;
        const parsed = Math.floor(Number(String(el.textContent).replace(/[^\d]/g, '')) || 0);
        return parsed >= 1 ? parsed : null;
    }

    function ensureAgeCommanderRankInitialized() {
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

    function formatAgeHudCommanderRankDisplay(value) {
        return String(clampCommanderRank(value));
    }

    function setAgeHudCommanderRankDisplay(value) {
        const el = global.document.getElementById('age-hud-commander-rank');
        if (!el) return;
        const rank = clampCommanderRank(value);
        el.textContent = formatAgeHudCommanderRankDisplay(rank);
        el.setAttribute('aria-label', `Commander rank ${rank}`);
    }

    function dispatchAgeCommanderRankUpdated(detail) {
        global.dispatchEvent(new CustomEvent(AGE_COMMANDER_RANK_UPDATED_EVENT, { detail }));
    }

    function refreshAgeHudCommanderRank() {
        ensureAgeCommanderRankInitialized();
        setAgeHudCommanderRankDisplay(resolveAgeCommanderRank());
    }

    function setAgeCommanderRank(nextRank, options = {}) {
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

        return normalized;
    }

    function bootAgeCommanderRank() {
        refreshAgeHudCommanderRank();
    }

    global.RoyalArmiesAgeCommanderRank = {
        AGE_COMMANDER_RANK_DEFAULT,
        AGE_COMMANDER_RANK_MAX,
        AGE_COMMANDER_RANK_UPDATED_EVENT,
        resolveAgeCommanderRank,
        formatAgeHudCommanderRankDisplay,
        setAgeCommanderRank,
        refreshAgeHudCommanderRank,
        ensureAgeCommanderRankInitialized
    };

    global.resolveAgeCommanderRank = resolveAgeCommanderRank;
    global.refreshAgeHudCommanderRank = refreshAgeHudCommanderRank;
    global.setAgeCommanderRank = setAgeCommanderRank;

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', bootAgeCommanderRank);
    } else {
        bootAgeCommanderRank();
    }
})(window);

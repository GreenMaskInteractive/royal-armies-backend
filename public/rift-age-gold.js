/**
 * RIFT — Age commander gold ledger (canonical balance + HUD sync).
 * All Age gold gains and losses must go through setAgeCommanderGold / applyAgeCommanderGoldDelta.
 */
(function initRoyalArmiesAgeGold(global) {
    'use strict';

    const AGE_COMMANDER_GOLD_DEFAULT = 20000;
    const AGE_GOLD_UPDATED_EVENT = 'royalarmies:age-gold-updated';

    function getPlayer() {
        return typeof global.player !== 'undefined' ? global.player : null;
    }

    function parseGoldText(raw) {
        const parsed = Number(String(raw ?? '').replace(/[^\d-]/g, ''));
        return Number.isFinite(parsed) ? parsed : null;
    }

    function readHudGoldElement() {
        const el = global.document.getElementById('age-hud-gold');
        if (!el?.textContent) return null;
        const parsed = parseGoldText(el.textContent);
        return parsed != null && parsed >= 0 ? Math.floor(parsed) : null;
    }

    function ensureAgeCommanderGoldInitialized() {
        const player = getPlayer();
        if (!player) return AGE_COMMANDER_GOLD_DEFAULT;

        const existing = Number(player.ageGold);
        if (Number.isFinite(existing) && existing >= 0) {
            return Math.floor(existing);
        }

        const fromHud = readHudGoldElement();
        const seeded = fromHud != null ? fromHud : AGE_COMMANDER_GOLD_DEFAULT;
        player.ageGold = seeded;
        return seeded;
    }

    function resolveAgeCommanderGold() {
        return ensureAgeCommanderGoldInitialized();
    }

    function formatAgeHudGoldDisplay(value) {
        return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('en-US');
    }

    function setAgeHudGoldDisplay(value) {
        const el = global.document.getElementById('age-hud-gold');
        if (!el) return;
        el.textContent = formatAgeHudGoldDisplay(value);
    }

    function dispatchAgeGoldUpdated(detail) {
        global.dispatchEvent(new CustomEvent(AGE_GOLD_UPDATED_EVENT, { detail }));
    }

    function refreshAgeHudGold() {
        ensureAgeCommanderGoldInitialized();
        setAgeHudGoldDisplay(resolveAgeCommanderGold());
    }

    function setAgeCommanderGold(nextGold, options = {}) {
        ensureAgeCommanderGoldInitialized();
        const player = getPlayer();
        const previous = resolveAgeCommanderGold();
        const normalized = Math.max(0, Math.floor(Number(nextGold) || 0));

        if (player) {
            player.ageGold = normalized;
        }

        setAgeHudGoldDisplay(normalized);

        if (!options.silent) {
            dispatchAgeGoldUpdated({
                gold: normalized,
                previous,
                delta: normalized - previous,
                source: options.source || 'set'
            });
        }

        return normalized;
    }

    function applyAgeCommanderGoldDelta(delta, options = {}) {
        const change = Math.floor(Number(delta) || 0);
        if (!change) return resolveAgeCommanderGold();
        return setAgeCommanderGold(resolveAgeCommanderGold() + change, options);
    }

    function bootAgeCommanderGold() {
        refreshAgeHudGold();
    }

    global.RoyalArmiesAgeGold = {
        AGE_COMMANDER_GOLD_DEFAULT,
        AGE_GOLD_UPDATED_EVENT,
        resolveAgeCommanderGold,
        formatAgeHudGoldDisplay,
        setAgeCommanderGold,
        applyAgeCommanderGoldDelta,
        refreshAgeHudGold,
        ensureAgeCommanderGoldInitialized
    };

    global.resolveAgeCommanderGold = resolveAgeCommanderGold;
    global.formatAgeHudGoldDisplay = formatAgeHudGoldDisplay;
    global.refreshAgeHudGold = refreshAgeHudGold;
    global.setAgeCommanderGold = setAgeCommanderGold;
    global.applyAgeCommanderGoldDelta = applyAgeCommanderGoldDelta;
    global.AGE_COMMANDER_GOLD_DEFAULT = AGE_COMMANDER_GOLD_DEFAULT;

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', bootAgeCommanderGold);
    } else {
        bootAgeCommanderGold();
    }
})(window);

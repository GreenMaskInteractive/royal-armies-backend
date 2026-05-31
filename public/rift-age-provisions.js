/**
 * RIFT — Age commander provisions ledger (canonical balance + HUD sync).
 * All Age provision gains and losses must go through setAgeCommanderProvisions / applyAgeCommanderProvisionsDelta.
 */
(function initRoyalArmiesAgeProvisions(global) {
    'use strict';

    const AGE_COMMANDER_PROVISIONS_DEFAULT = 132;
    const AGE_PROVISIONS_UPDATED_EVENT = 'royalarmies:age-provisions-updated';

    function getPlayer() {
        return typeof global.player !== 'undefined' ? global.player : null;
    }

    function parseProvisionsText(raw) {
        const parsed = Number(String(raw ?? '').replace(/[^\d-]/g, ''));
        return Number.isFinite(parsed) ? parsed : null;
    }

    function readHudProvisionsElement() {
        const el = global.document.getElementById('age-hud-provisions');
        if (!el?.textContent) return null;
        const parsed = parseProvisionsText(el.textContent);
        return parsed != null && parsed >= 0 ? Math.floor(parsed) : null;
    }

    function ensureAgeCommanderProvisionsInitialized() {
        const player = getPlayer();
        if (!player) return AGE_COMMANDER_PROVISIONS_DEFAULT;

        const existing = Number(player.ageProvisions);
        if (Number.isFinite(existing) && existing >= 0) {
            return Math.floor(existing);
        }

        const fromHud = readHudProvisionsElement();
        const seeded = fromHud != null ? fromHud : AGE_COMMANDER_PROVISIONS_DEFAULT;
        player.ageProvisions = seeded;
        return seeded;
    }

    function resolveAgeCommanderProvisions() {
        return ensureAgeCommanderProvisionsInitialized();
    }

    function formatAgeHudProvisionsDisplay(value) {
        return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('en-US');
    }

    function setAgeHudProvisionsDisplay(value) {
        const el = global.document.getElementById('age-hud-provisions');
        if (!el) return;
        el.textContent = formatAgeHudProvisionsDisplay(value);
    }

    function dispatchAgeProvisionsUpdated(detail) {
        global.dispatchEvent(new CustomEvent(AGE_PROVISIONS_UPDATED_EVENT, { detail }));
    }

    function refreshAgeHudProvisions() {
        ensureAgeCommanderProvisionsInitialized();
        setAgeHudProvisionsDisplay(resolveAgeCommanderProvisions());
    }

    function setAgeCommanderProvisions(nextProvisions, options = {}) {
        ensureAgeCommanderProvisionsInitialized();
        const player = getPlayer();
        const previous = resolveAgeCommanderProvisions();
        const normalized = Math.max(0, Math.floor(Number(nextProvisions) || 0));

        if (player) {
            player.ageProvisions = normalized;
        }

        setAgeHudProvisionsDisplay(normalized);

        if (!options.silent) {
            dispatchAgeProvisionsUpdated({
                provisions: normalized,
                previous,
                delta: normalized - previous,
                source: options.source || 'set'
            });
        }

        return normalized;
    }

    function applyAgeCommanderProvisionsDelta(delta, options = {}) {
        const change = Math.floor(Number(delta) || 0);
        if (!change) return resolveAgeCommanderProvisions();
        return setAgeCommanderProvisions(resolveAgeCommanderProvisions() + change, options);
    }

    function bootAgeCommanderProvisions() {
        refreshAgeHudProvisions();
    }

    global.RoyalArmiesAgeProvisions = {
        AGE_COMMANDER_PROVISIONS_DEFAULT,
        AGE_PROVISIONS_UPDATED_EVENT,
        resolveAgeCommanderProvisions,
        formatAgeHudProvisionsDisplay,
        setAgeCommanderProvisions,
        applyAgeCommanderProvisionsDelta,
        refreshAgeHudProvisions,
        ensureAgeCommanderProvisionsInitialized
    };

    global.resolveAgeCommanderProvisions = resolveAgeCommanderProvisions;
    global.refreshAgeHudProvisions = refreshAgeHudProvisions;
    global.setAgeCommanderProvisions = setAgeCommanderProvisions;
    global.applyAgeCommanderProvisionsDelta = applyAgeCommanderProvisionsDelta;
    global.AGE_COMMANDER_PROVISIONS_DEFAULT = AGE_COMMANDER_PROVISIONS_DEFAULT;

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', bootAgeCommanderProvisions);
    } else {
        bootAgeCommanderProvisions();
    }
})(window);

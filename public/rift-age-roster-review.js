/**
 * RIFT — Garrison roster review API (unit inspection and dismissal).
 */
(function initRoyalArmiesAgeRosterReviewApi(global) {
    'use strict';

    function resolveApiUrl(path) {
        if (typeof global.resolveRoyalArmiesApiUrl === 'function') {
            return global.resolveRoyalArmiesApiUrl(path);
        }
        const origin = global.location?.origin || '';
        if (String(path || '').startsWith('http')) return path;
        if (String(path || '').startsWith('/')) return `${origin}${path}`;
        return `${origin}/${path}`;
    }

    function resolveUsername() {
        if (typeof global.getActiveCommanderUsername === 'function') {
            return global.getActiveCommanderUsername();
        }
        const saved = global.localStorage?.getItem('activeCommanderUser');
        return saved && saved.trim() ? saved.trim() : '';
    }

    function applyRosterReviewPayload(payload) {
        if (!payload || typeof payload !== 'object') return;

        if (Array.isArray(payload.ageArmy) && typeof global.player !== 'undefined') {
            global.player.ageArmy = payload.ageArmy.slice();
        }

        if (payload.commander?.ageGold !== undefined && global.RoyalArmiesAgeGold?.setAgeCommanderGold) {
            global.RoyalArmiesAgeGold.setAgeCommanderGold(
                Math.max(0, Math.floor(Number(payload.commander.ageGold) || 0)),
                { source: 'roster-review' }
            );
        }

        if (payload.commander?.ageProvisions !== undefined && global.RoyalArmiesAgeProvisions?.setAgeCommanderProvisions) {
            global.RoyalArmiesAgeProvisions.setAgeCommanderProvisions(
                Math.max(0, Math.floor(Number(payload.commander.ageProvisions) || 0)),
                { source: 'roster-review' }
            );
        }

        if (payload.unitsTotal !== undefined && typeof global.refreshAgeHudUnits === 'function') {
            global.refreshAgeHudUnits();
        }

        global.dispatchEvent(new CustomEvent('royalarmies:age-roster-review-updated', {
            detail: { ...payload }
        }));
        global.dispatchEvent(new CustomEvent('royalarmies:age-recruitment-updated', {
            detail: { ...payload }
        }));
    }

    async function fetchRosterReviewState(options = {}) {
        const username = String(options.username || resolveUsername() || '').trim();
        if (!username) {
            throw new Error('Commander session required.');
        }

        const response = await global.fetch(
            resolveApiUrl(`/api/portal/age/units/roster-review?username=${encodeURIComponent(username)}`),
            { credentials: 'same-origin', cache: 'no-store' }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.status !== 'ok') {
            const err = new Error(payload.message || 'Garrison roster unavailable.');
            err.code = payload.code || payload.errorCode || '';
            throw err;
        }

        applyRosterReviewPayload(payload);
        return payload;
    }

    async function dismissRosterUnits(options = {}) {
        const username = String(options.username || resolveUsername() || '').trim();
        if (!username) {
            throw new Error('Commander session required.');
        }

        const unitIds = Array.isArray(options.unitIds) ? options.unitIds : [];
        const response = await global.fetch(resolveApiUrl('/api/portal/age/units/dismiss'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                username,
                unitIds
            })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.status !== 'ok') {
            const err = new Error(payload.message || 'Unit dismissal failed.');
            err.code = payload.code || payload.errorCode || '';
            throw err;
        }

        applyRosterReviewPayload(payload);
        return payload;
    }

    global.RoyalArmiesAgeRosterReviewApi = Object.freeze({
        fetchRosterReviewState,
        dismissRosterUnits
    });
})(typeof window !== 'undefined' ? window : globalThis);

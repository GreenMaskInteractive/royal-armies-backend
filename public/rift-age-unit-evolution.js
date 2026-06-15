/**
 * RIFT — Unit evolution API (rank promotions and tier evolution).
 */
(function initRoyalArmiesAgeUnitEvolutionApi(global) {
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

    function applyEvolutionPayload(payload) {
        if (!payload || typeof payload !== 'object') return;

        if (global.RoyalArmiesAgeGuildTraining?.applyGuildPayload) {
            global.RoyalArmiesAgeGuildTraining.applyGuildPayload(payload);
        } else {
            if (Array.isArray(payload.ageArmy) && typeof global.player !== 'undefined') {
                global.player.ageArmy = payload.ageArmy.slice();
            }
            if (payload.ageProvisions !== undefined && global.RoyalArmiesAgeProvisions?.setAgeCommanderProvisions) {
                global.RoyalArmiesAgeProvisions.setAgeCommanderProvisions(
                    Math.max(0, Math.floor(Number(payload.ageProvisions) || 0)),
                    { source: 'unit-evolution' }
                );
            }
        }

        global.dispatchEvent(new CustomEvent('royalarmies:age-unit-evolution-updated', {
            detail: { ...payload }
        }));
    }

    async function fetchEvolutionState(options = {}) {
        const username = String(options.username || resolveUsername() || '').trim();
        if (!username) {
            throw new Error('Commander session required.');
        }

        const response = await global.fetch(
            resolveApiUrl(`/api/portal/age/units/evolution?username=${encodeURIComponent(username)}`),
            { credentials: 'same-origin', cache: 'no-store' }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.status !== 'ok') {
            const err = new Error(payload.message || 'Unit evolution state unavailable.');
            err.code = payload.code || payload.errorCode || '';
            throw err;
        }

        applyEvolutionPayload(payload);
        return payload;
    }

    async function promoteUnitRank(options = {}) {
        const username = String(options.username || resolveUsername() || '').trim();
        if (!username) {
            throw new Error('Commander session required.');
        }

        const response = await global.fetch(resolveApiUrl('/api/portal/age/units/promote-rank'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                username,
                catalogUnitId: options.catalogUnitId,
                rank: options.rank,
                quantity: options.quantity
            })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.status !== 'ok') {
            const err = new Error(payload.message || 'Unit rank promotion failed.');
            err.code = payload.code || payload.errorCode || '';
            throw err;
        }

        applyEvolutionPayload(payload);
        return payload;
    }

    async function evolveUnitTier(options = {}) {
        const username = String(options.username || resolveUsername() || '').trim();
        if (!username) {
            throw new Error('Commander session required.');
        }

        const response = await global.fetch(resolveApiUrl('/api/portal/age/units/evolve-tier'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                username,
                catalogUnitId: options.catalogUnitId,
                rank: options.rank,
                quantity: options.quantity
            })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.status !== 'ok') {
            const err = new Error(payload.message || 'Unit tier evolution failed.');
            err.code = payload.code || payload.errorCode || '';
            throw err;
        }

        applyEvolutionPayload(payload);
        return payload;
    }

    async function promoteAllEligibleRanks(options = {}) {
        const username = String(options.username || resolveUsername() || '').trim();
        if (!username) {
            throw new Error('Commander session required.');
        }

        const response = await global.fetch(resolveApiUrl('/api/portal/age/units/promote-all'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ username })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.status !== 'ok') {
            const err = new Error(payload.message || 'Bulk rank promotion failed.');
            err.code = payload.code || payload.errorCode || '';
            throw err;
        }

        applyEvolutionPayload(payload);
        return payload;
    }

    async function evolveAllEligibleTiers(options = {}) {
        const username = String(options.username || resolveUsername() || '').trim();
        if (!username) {
            throw new Error('Commander session required.');
        }

        const response = await global.fetch(resolveApiUrl('/api/portal/age/units/evolve-all'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ username })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.status !== 'ok') {
            const err = new Error(payload.message || 'Bulk tier evolution failed.');
            err.code = payload.code || payload.errorCode || '';
            throw err;
        }

        applyEvolutionPayload(payload);
        return payload;
    }

    global.RoyalArmiesAgeUnitEvolutionApi = {
        fetchEvolutionState,
        promoteUnitRank,
        evolveUnitTier,
        promoteAllEligibleRanks,
        evolveAllEligibleTiers,
        applyEvolutionPayload
    };
})(window);

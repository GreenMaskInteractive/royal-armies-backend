/**
 * RIFT — Adventurer's Guild training battle (server-backed simulator).
 */
(function initRoyalArmiesAgeGuildTraining(global) {
    'use strict';

    let settlementTier = 'village';

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

    function guildTrainingDebugEnabled() {
        return (
            new URLSearchParams(global.location?.search || '').has('guildBattleDebug')
            || global.localStorage?.getItem('rift-guild-battle-debug') === '1'
        );
    }

    function guildTrainingLog(label, extra) {
        if (!guildTrainingDebugEnabled()) return;
        console.log('[RIFT][guild-training-api]', label, extra ?? '');
    }

    function setSettlementTier(tier) {
        settlementTier = String(tier || 'village').trim().toLowerCase() || 'village';
    }

    function getSettlementTier() {
        return settlementTier;
    }

    function applyGuildPayload(payload) {
        if (!payload || typeof payload !== 'object') return;

        if (
            payload.rank !== undefined
            || payload.path !== undefined
            || payload.rankTitleGender !== undefined
        ) {
            if (global.RoyalArmiesAgeCommanderRank?.applyCommanderRankPayload) {
                global.RoyalArmiesAgeCommanderRank.applyCommanderRankPayload(payload, { source: 'guild-sync' });
            } else if (payload.rank !== undefined) {
                const rank = Math.max(1, Math.floor(Number(payload.rank) || 1));
                if (typeof global.player !== 'undefined') {
                    global.player.rank = rank;
                }
                if (global.RoyalArmiesAgeCommanderRank?.setAgeCommanderRank) {
                    global.RoyalArmiesAgeCommanderRank.setAgeCommanderRank(rank, {
                        source: 'guild-sync',
                        silent: true,
                        path: payload.path,
                        rankTitleGender: payload.rankTitleGender
                    });
                } else if (typeof global.refreshAgeHudCommanderRank === 'function') {
                    global.refreshAgeHudCommanderRank();
                }
            }
        }
        if (payload.ageGuildXp !== undefined && typeof global.player !== 'undefined') {
            global.player.ageGuildXp = Math.max(0, Math.floor(Number(payload.ageGuildXp) || 0));
        }

        if (global.RoyalArmiesAgeMovement?.applyStatePayload) {
            global.RoyalArmiesAgeMovement.applyStatePayload(payload, { eventSource: 'guild-sync' });
        } else if (Array.isArray(payload.ageArmy) && typeof global.player !== 'undefined') {
            global.player.ageArmy = payload.ageArmy.slice();
        }

        if (payload.ageGold !== undefined && global.RoyalArmiesAgeGold?.setAgeCommanderGold) {
            global.RoyalArmiesAgeGold.setAgeCommanderGold(
                Math.max(0, Math.floor(Number(payload.ageGold) || 0)),
                { source: 'guild-sync' }
            );
        }

        if (payload.ageProvisions !== undefined && global.RoyalArmiesAgeProvisions?.setAgeCommanderProvisions) {
            global.RoyalArmiesAgeProvisions.setAgeCommanderProvisions(
                Math.max(0, Math.floor(Number(payload.ageProvisions) || 0)),
                { source: 'guild-sync' }
            );
        }

        if (typeof global.refreshAgeHudUnits === 'function') {
            global.refreshAgeHudUnits();
        }

        global.dispatchEvent(new CustomEvent('royalarmies:age-guild-updated', {
            detail: { ...payload }
        }));
    }

    async function fetchGuildState(options = {}) {
        const username = String(options.username || resolveUsername() || '').trim();
        if (!username) {
            throw new Error('Commander session required.');
        }

        if (options.settlementTier) {
            setSettlementTier(options.settlementTier);
        }

        const tier = encodeURIComponent(getSettlementTier());
        const response = await global.fetch(
            resolveApiUrl(`/api/portal/age/guild/state?username=${encodeURIComponent(username)}&settlementTier=${tier}`),
            { credentials: 'same-origin', cache: 'no-store' }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.status !== 'ok') {
            const err = new Error(payload.message || 'Guild state unavailable.');
            err.code = payload.code || payload.errorCode || '';
            throw err;
        }

        if (payload.settlementTier) {
            setSettlementTier(payload.settlementTier);
        }

        applyGuildPayload(payload);
        return payload;
    }

    async function runTrainingBattle(options = {}) {
        const username = String(options.username || resolveUsername() || '').trim();
        const trainingMode = String(options.trainingMode || 'street-patrol').trim().toLowerCase();
        guildTrainingLog('runTrainingBattle called', { username: username || '(empty)', trainingMode, settlementTier: getSettlementTier() });
        if (!username) {
            const err = new Error('Commander session required.');
            guildTrainingLog('runTrainingBattle rejected', { reason: err.message });
            throw err;
        }

        const url = resolveApiUrl('/api/portal/age/guild/training-battle');
        guildTrainingLog('runTrainingBattle fetch start', { url });

        const response = await global.fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                username,
                trainingMode,
                settlementTier: getSettlementTier()
            })
        });

        const payload = await response.json().catch(() => ({}));
        guildTrainingLog('runTrainingBattle fetch done', {
            ok: response.ok,
            status: response.status,
            payloadStatus: payload.status,
            code: payload.code || payload.errorCode
        });
        if (!response.ok || payload.status !== 'ok') {
            const err = new Error(
                payload.message
                || (response.status === 500
                    ? 'Training battle failed — server error (check Render logs for [NEXUS] guild training-battle).'
                    : `Training battle failed (HTTP ${response.status}).`)
            );
            err.code = payload.code || payload.errorCode || (response.status === 500 ? 'NEXUS-GEN-001' : '');
            err.httpStatus = response.status;
            throw err;
        }

        applyGuildPayload(payload);
        return payload;
    }

    async function healUnits(options = {}) {
        const username = String(options.username || resolveUsername() || '').trim();
        const mode = String(options.mode || 'one').trim().toLowerCase();
        if (!username) {
            throw new Error('Commander session required.');
        }

        const response = await global.fetch(resolveApiUrl('/api/portal/age/guild/heal'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ username, mode })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.status !== 'ok') {
            const err = new Error(payload.message || 'Healing failed.');
            err.code = payload.code || payload.errorCode || '';
            throw err;
        }

        applyGuildPayload(payload);
        return payload;
    }

    async function purchaseTradeConvoyLot(options = {}) {
        const username = String(options.username || resolveUsername() || '').trim();
        if (!username) {
            throw new Error('Commander session required.');
        }

        const response = await global.fetch(resolveApiUrl('/api/portal/age/guild/trade-convoy/purchase'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                username,
                lotId: options.lotId,
                settlementTier: getSettlementTier()
            })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.status !== 'ok') {
            const err = new Error(payload.message || 'Trade purchase failed.');
            err.code = payload.code || payload.errorCode || '';
            throw err;
        }

        applyGuildPayload(payload);
        return payload;
    }

    async function acceptBounty(options = {}) {
        const username = String(options.username || resolveUsername() || '').trim();
        if (!username) {
            throw new Error('Commander session required.');
        }

        const response = await global.fetch(resolveApiUrl('/api/portal/age/guild/bounties/accept'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                username,
                bountyId: options.bountyId,
                settlementTier: getSettlementTier()
            })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.status !== 'ok') {
            const err = new Error(payload.message || 'Bounty acceptance failed.');
            err.code = payload.code || payload.errorCode || '';
            throw err;
        }

        applyGuildPayload(payload);
        return payload;
    }

    global.RoyalArmiesAgeGuildTraining = {
        fetchGuildState,
        runTrainingBattle,
        healUnits,
        purchaseTradeConvoyLot,
        acceptBounty,
        applyGuildPayload,
        setSettlementTier,
        getSettlementTier
    };
})(window);

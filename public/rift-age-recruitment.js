/**
 * RIFT — Age barracks unit recruitment (server ledger checkout).
 */
(function initRoyalArmiesAgeRecruitment(global) {
    'use strict';

    function resolveApiUrl(path) {
        if (typeof global.resolveRoyalArmiesApiUrl === 'function') {
            return global.resolveRoyalArmiesApiUrl(path);
        }
        if (typeof global.resolveApiUrl === 'function') {
            return global.resolveApiUrl(path);
        }
        return path;
    }

    function resolveUsername() {
        if (typeof global.getActiveCommanderUsername === 'function') {
            return global.getActiveCommanderUsername();
        }
        if (typeof global.getMailboxApiUsername === 'function') {
            return global.getMailboxApiUsername();
        }
        const saved = global.localStorage?.getItem('activeCommanderUser');
        return saved && saved.trim() ? saved.trim() : '';
    }

    function applyRecruitmentPayload(payload) {
        if (!payload || typeof payload !== 'object') return;

        if (payload.ageGold !== undefined && global.RoyalArmiesAgeGold?.setAgeCommanderGold) {
            global.RoyalArmiesAgeGold.setAgeCommanderGold(
                Math.max(0, Math.floor(Number(payload.ageGold) || 0)),
                { source: 'barracks-recruit' }
            );
        }

        if (global.RoyalArmiesAgeMovement?.applyStatePayload) {
            global.RoyalArmiesAgeMovement.applyStatePayload(payload);
        } else {
            if (Array.isArray(payload.ageArmy) && typeof global.player !== 'undefined') {
                global.player.ageArmy = payload.ageArmy.slice();
            }
            if (typeof global.refreshAgeHudUnits === 'function') {
                global.refreshAgeHudUnits();
            }
        }

        global.dispatchEvent(new CustomEvent('royalarmies:age-recruitment-updated', {
            detail: { ...payload }
        }));
    }

    async function recruitUnits({ unitId, quantity, username }) {
        const resolvedUsername = String(username || resolveUsername() || '').trim();
        const resolvedUnitId = String(unitId || '').trim();
        const resolvedQuantity = Math.floor(Number(quantity) || 0);

        if (!resolvedUsername) {
            throw new Error('Commander session required.');
        }
        if (!resolvedUnitId) {
            throw new Error('Select a unit to recruit.');
        }
        if (!resolvedQuantity) {
            throw new Error('Choose a valid unit quantity.');
        }

        const response = await global.fetch(resolveApiUrl('/api/portal/age/recruit-units'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                username: resolvedUsername,
                unitId: resolvedUnitId,
                quantity: resolvedQuantity
            })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.status !== 'ok') {
            const err = new Error(payload.message || 'Recruitment failed.');
            err.code = payload.code || payload.errorCode || '';
            throw err;
        }

        applyRecruitmentPayload(payload);
        return payload;
    }

    global.RoyalArmiesAgeRecruitment = {
        recruitUnits,
        applyRecruitmentPayload
    };
})(window);

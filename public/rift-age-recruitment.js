/**
 * RIFT — Age barracks unit recruitment (server ledger checkout).
 */
(function initRoyalArmiesAgeRecruitment(global) {
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
        if (typeof global.getMailboxApiUsername === 'function') {
            return global.getMailboxApiUsername();
        }
        const saved = global.localStorage?.getItem('activeCommanderUser');
        return saved && saved.trim() ? saved.trim() : '';
    }

    function syncRecruitmentResources(payload) {
        if (!payload || typeof payload !== 'object') return;

        const nextGold = payload.ageGold !== undefined
            ? Math.max(0, Math.floor(Number(payload.ageGold) || 0))
            : null;
        const nextProvisions = payload.ageProvisions !== undefined
            ? Math.max(0, Math.floor(Number(payload.ageProvisions) || 0))
            : null;
        const goldSpent = Math.max(0, Math.floor(Number(payload.goldSpent) || 0));
        const provisionsSpent = Math.max(0, Math.floor(Number(payload.provisionsSpent) || 0));

        if (nextGold != null && global.RoyalArmiesAgeGold?.setAgeCommanderGold) {
            global.RoyalArmiesAgeGold.setAgeCommanderGold(nextGold, { source: 'barracks-recruit' });
        } else if (goldSpent && global.RoyalArmiesAgeGold?.applyAgeCommanderGoldDelta) {
            global.RoyalArmiesAgeGold.applyAgeCommanderGoldDelta(-goldSpent, { source: 'barracks-recruit' });
        }

        if (nextProvisions != null && global.RoyalArmiesAgeProvisions?.setAgeCommanderProvisions) {
            global.RoyalArmiesAgeProvisions.setAgeCommanderProvisions(nextProvisions, { source: 'barracks-recruit' });
        } else if (provisionsSpent && global.RoyalArmiesAgeProvisions?.applyAgeCommanderProvisionsDelta) {
            global.RoyalArmiesAgeProvisions.applyAgeCommanderProvisionsDelta(-provisionsSpent, { source: 'barracks-recruit' });
        } else if (nextProvisions != null) {
            writeHudProvisionsFallback(nextProvisions);
        } else if (provisionsSpent) {
            writeHudProvisionsFallback(
                Math.max(0, resolveHudProvisionsFallback() - provisionsSpent)
            );
        }
    }

    function resolveHudProvisionsFallback() {
        if (typeof global.player !== 'undefined' && Number.isFinite(Number(global.player.ageProvisions))) {
            return Math.max(0, Math.floor(Number(global.player.ageProvisions)));
        }
        const el = global.document.getElementById('age-hud-provisions');
        if (!el?.textContent) return 0;
        const parsed = Number(String(el.textContent).replace(/[^\d]/g, ''));
        return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
    }

    function writeHudProvisionsFallback(value) {
        const normalized = Math.max(0, Math.floor(Number(value) || 0));
        const el = global.document.getElementById('age-hud-provisions');
        if (el) {
            el.textContent = normalized.toLocaleString('en-US');
        }
        if (typeof global.player !== 'undefined') {
            global.player.ageProvisions = normalized;
        }
        global.dispatchEvent(new CustomEvent('royalarmies:age-provisions-updated', {
            detail: { provisions: normalized, source: 'barracks-recruit-fallback' }
        }));
    }

    function applyRecruitmentPayload(payload) {
        if (!payload || typeof payload !== 'object') return;

        if (global.RoyalArmiesAgeMovement?.applyStatePayload) {
            global.RoyalArmiesAgeMovement.applyStatePayload(payload);
        } else if (Array.isArray(payload.ageArmy) && typeof global.player !== 'undefined') {
            global.player.ageArmy = payload.ageArmy.slice();
        }

        if (typeof global.refreshAgeHudUnits === 'function') {
            global.refreshAgeHudUnits();
        }

        syncRecruitmentResources(payload);

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
        MAX_RECRUIT_QUANTITY: 15,
        recruitUnits,
        applyRecruitmentPayload
    };
})(window);

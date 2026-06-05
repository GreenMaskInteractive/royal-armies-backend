/**
 * RIFT — Nation Treasury HUD (Royal Silver Dollars / RSD).
 */
(function initRoyalArmiesNationTreasury(global) {
    'use strict';

    const REFRESH_EVENT = 'royal-armies-nation-treasury-refresh';
    let lastTreasuryPayload = { rsd: 0 };

    function resolveApiUrl(path) {
        if (typeof global.resolveRoyalArmiesApiUrl === 'function') {
            return global.resolveRoyalArmiesApiUrl(path);
        }
        return path;
    }

    function resolveUsername() {
        const saved = global.localStorage.getItem('activeCommanderUser');
        if (saved && saved.trim()) return saved.trim();

        if (typeof global.getActiveCommanderUsername === 'function') {
            const name = String(global.getActiveCommanderUsername() || '').trim();
            if (name && name.toLowerCase() !== 'testaccount') return name;
        }

        return '';
    }

    function formatRsd(value) {
        const amount = Math.max(0, Math.floor(Number(value) || 0));
        return amount.toLocaleString('en-US');
    }

    function hideTreasuryHud() {
        const itemEl = global.document.getElementById('age-hud-nation-treasury-item');
        if (itemEl) {
            itemEl.hidden = true;
            itemEl.setAttribute('aria-hidden', 'true');
        }
    }

    function rememberTreasuryPayload(payload) {
        const rsd = Math.max(0, Math.floor(Number(payload?.rsd) || 0));
        lastTreasuryPayload = {
            ...lastTreasuryPayload,
            ...payload,
            rsd
        };
        return lastTreasuryPayload;
    }

    async function refreshNationTreasury() {
        const username = resolveUsername();
        hideTreasuryHud();

        if (!username) {
            return rememberTreasuryPayload({ rsd: 0 });
        }

        try {
            const response = await fetch(
                resolveApiUrl(`/api/portal/age/nation-treasury?username=${encodeURIComponent(username)}`),
                { credentials: 'same-origin' }
            );
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                return rememberTreasuryPayload({ rsd: 0, rewardRules: payload?.rewardRules });
            }

            return rememberTreasuryPayload(payload);
        } catch (_err) {
            return rememberTreasuryPayload({ rsd: 0 });
        }
    }

    function bindRefreshListener() {
        if (global.__royalArmiesNationTreasuryBound) return;
        global.__royalArmiesNationTreasuryBound = true;
        global.addEventListener(REFRESH_EVENT, () => {
            refreshNationTreasury();
        });
    }

    function requestRefresh() {
        global.dispatchEvent(new CustomEvent(REFRESH_EVENT));
    }

    global.RoyalArmiesNationTreasury = {
        refresh: refreshNationTreasury,
        requestRefresh,
        formatRsd,
        getLastPayload: () => ({ ...lastTreasuryPayload })
    };

    bindRefreshListener();
    hideTreasuryHud();
    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', () => {
            hideTreasuryHud();
            refreshNationTreasury();
        });
    } else {
        refreshNationTreasury();
    }
})(window);

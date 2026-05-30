/**
 * RIFT — Nation Treasury HUD (Royal Silver Dollars / RSD).
 */
(function initRoyalArmiesNationTreasury(global) {
    'use strict';

    const REFRESH_EVENT = 'royal-armies-nation-treasury-refresh';

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

    function renderTreasuryHud(payload) {
        const amountEl = global.document.getElementById('age-hud-nation-treasury-amount');
        const itemEl = global.document.getElementById('age-hud-nation-treasury-item');
        if (!amountEl) return;

        const rsd = payload?.rsd ?? 0;
        amountEl.textContent = formatRsd(rsd);

        if (itemEl) {
            itemEl.setAttribute(
                'aria-label',
                `Nation Treasury ${formatRsd(rsd)} Royal Silver Dollar`
            );
        }
    }

    async function refreshNationTreasury() {
        const username = resolveUsername();
        if (!username) {
            renderTreasuryHud({ rsd: 0 });
            return null;
        }

        try {
            const response = await fetch(
                resolveApiUrl(`/api/portal/age/nation-treasury?username=${encodeURIComponent(username)}`),
                { credentials: 'same-origin' }
            );
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                renderTreasuryHud({ rsd: 0, rewardRules: payload?.rewardRules });
                return null;
            }

            renderTreasuryHud(payload);
            return payload;
        } catch (_err) {
            renderTreasuryHud({ rsd: 0 });
            return null;
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
        formatRsd
    };
})(window);

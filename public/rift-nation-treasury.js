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

    function paintTreasuryHud(payload) {
        const itemEl = global.document.getElementById('age-hud-nation-treasury-item');
        const amountEl = global.document.getElementById('age-hud-nation-treasury-amount');
        const treasuryEl = global.document.getElementById('age-hud-nation-treasury');
        if (!itemEl || !amountEl) return;

        const rsd = Math.max(0, Math.floor(Number(payload?.rsd) || 0));
        const formatted = formatRsd(rsd);
        amountEl.textContent = formatted;
        if (treasuryEl) {
            treasuryEl.setAttribute('aria-label', `${formatted} Royal Silver Dollars`);
        }

        itemEl.hidden = false;
        itemEl.removeAttribute('aria-hidden');
    }

    function refreshNationTreasuryHud() {
        paintTreasuryHud(lastTreasuryPayload);
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

        if (!username) {
            hideTreasuryHud();
            return rememberTreasuryPayload({ rsd: 0 });
        }

        try {
            const response = await fetch(
                resolveApiUrl(`/api/portal/age/nation-treasury?username=${encodeURIComponent(username)}`),
                { credentials: 'same-origin' }
            );
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                const remembered = rememberTreasuryPayload({ rsd: 0, rewardRules: payload?.rewardRules });
                paintTreasuryHud(remembered);
                return remembered;
            }

            const remembered = rememberTreasuryPayload(payload);
            paintTreasuryHud(remembered);
            return remembered;
        } catch (_err) {
            const remembered = rememberTreasuryPayload({ rsd: 0 });
            paintTreasuryHud(remembered);
            return remembered;
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
        getLastPayload: () => ({ ...lastTreasuryPayload }),
        paintHud: paintTreasuryHud
    };
    global.refreshNationTreasuryHud = refreshNationTreasuryHud;

    bindRefreshListener();
    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', () => {
            refreshNationTreasury();
        });
    } else {
        refreshNationTreasury();
    }
})(window);

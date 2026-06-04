/**
 * RIFT — Border assault casualty risk preview (injury/death ranges, not victory odds).
 */
(function initRiftAgeAssaultRisk(global) {
    'use strict';

    const estimateCache = new Map();

    function resolveApiUrl(path) {
        if (typeof global.resolveApiUrl === 'function') {
            return global.resolveApiUrl(path);
        }
        return path;
    }

    function resolveUsername() {
        if (typeof global.resolveActiveCommanderUsername === 'function') {
            return global.resolveActiveCommanderUsername() || '';
        }
        try {
            return String(global.localStorage.getItem('activeCommanderUser') || '').trim();
        } catch (_err) {
            return '';
        }
    }

    function cacheKey(targetCityId, groupId, playersInCity) {
        return `${targetCityId}|${groupId || ''}|${playersInCity || 1}`;
    }

    function formatRiskMarkup(payload) {
        const risk = payload?.casualtyRisk;
        if (!risk) {
            return '<p class="age-assault-risk-copy">Casualty estimate unavailable.</p>';
        }

        const enemyCount = Array.isArray(payload.enemyCommanders)
            ? payload.enemyCommanders.length
            : Number(payload.defender?.enemyCommanders) || 0;
        const enemyLine = enemyCount > 0
            ? `${enemyCount} enemy commander${enemyCount === 1 ? '' : 's'} in city`
            : 'Garrison only (no enemy commanders spotted)';

        return (
            '<p class="age-assault-risk-eyebrow">Casualty pressure (not victory odds)</p>'
            + `<p class="age-assault-risk-copy">${escapeHtml(risk.summary || '')}</p>`
            + '<dl class="age-assault-risk-stats">'
            + `<div><dt>Injury risk</dt><dd>${escapeHtml(risk.injuryPercent?.label || '—')}</dd></div>`
            + `<div><dt>Death risk</dt><dd>${escapeHtml(risk.deathPercent?.label || '—')}</dd></div>`
            + `<div><dt>Defenders</dt><dd>${escapeHtml(enemyLine)}</dd></div>`
            + '</dl>'
            + '<p class="age-assault-risk-note">Lower ranges usually mean fewer casualties in practice; deaths stay rarer than injuries. You may still win or lose regardless.</p>'
        );
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    async function fetchAssaultCasualtyEstimate(targetCityId, options = {}) {
        const cityId = String(targetCityId || '').trim();
        if (!cityId) return null;

        const username = resolveUsername();
        if (!username) return null;

        const ledGroup = global.RoyalArmiesAgeArmyGroups?.getLedArmyGroup?.();
        const groupId = options.groupId || ledGroup?.id || '';
        const playersInCity = options.playersInCity;
        const key = cacheKey(cityId, groupId, playersInCity);

        if (!options.forceRefresh && estimateCache.has(key)) {
            return estimateCache.get(key);
        }

        const response = await global.fetch(resolveApiUrl('/api/portal/age/assault-casualty-estimate'), {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                targetCityId: cityId,
                groupId: groupId || undefined,
                playersInCity
            })
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload) {
            const err = new Error(payload?.message || payload?.code || `Estimate failed (${response.status})`);
            err.code = payload?.code;
            throw err;
        }

        estimateCache.set(key, payload);
        return payload;
    }

    function clearAssaultCasualtyCache() {
        estimateCache.clear();
    }

    global.RoyalArmiesAgeAssaultRisk = {
        fetchAssaultCasualtyEstimate,
        formatRiskMarkup,
        clearAssaultCasualtyCache
    };
})(typeof window !== 'undefined' ? window : global);

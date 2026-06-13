/**
 * RIFT — Official live-age page slug/path (extensionless /age[slug] URLs).
 * Pre-age production uses agealpha.html; later slugs mirror the active round number.
 */
(function initRiftOfficialAge(global) {
    'use strict';

    const PRE_AGE_SLUG = 'alpha';

    /** Temporary — main portal Join skips game.html onboarding and routes to agealpha. */
    const PORTAL_DIRECT_AGE_JOIN_ENABLED = true;
    const PORTAL_DIRECT_AGE_JOIN_STORAGE_KEY = 'royalArmiesPortalDirectAgeJoin';

    try {
        if (PORTAL_DIRECT_AGE_JOIN_ENABLED) {
            global.localStorage.setItem(PORTAL_DIRECT_AGE_JOIN_STORAGE_KEY, 'true');
        } else {
            global.localStorage.removeItem(PORTAL_DIRECT_AGE_JOIN_STORAGE_KEY);
        }
    } catch (_err) {
        /* ignore */
    }

    const COMMANDER_ACCOUNT_RESET_ACK_KEY = 'royalArmiesCommanderAccountResetAck';
    const AGE_SESSION_EVICTED_CODE = 'NEXUS-AGE-038';
    const ACCOUNT_RESET_EVICTION_POLL_MS = 30000;

    let accountResetEvictionTimer = null;

    function isPortalDirectAgeJoinEnabled() {
        return PORTAL_DIRECT_AGE_JOIN_ENABLED;
    }

    function getOfficialAgeSlug() {
        return PRE_AGE_SLUG;
    }

    function getOfficialAgePageFileName() {
        return `age${getOfficialAgeSlug()}.html`;
    }

    function getOfficialAgePagePath() {
        const slug = `age${getOfficialAgeSlug()}`;
        if (typeof global.resolveRoyalArmiesPageUrl === 'function') {
            return global.resolveRoyalArmiesPageUrl(slug);
        }
        return `/${slug}`;
    }

    function isOfficialAgePageActive() {
        const canvas = global.document.getElementById('age-page-canvas');
        return Boolean(canvas && canvas.classList.contains('age-page-canvas'));
    }

    /** Published nation terrain bonus table (false while Age Alpha is pre-release). */
    function isNationTerrainBonusDataLive() {
        const canvas = global.document.getElementById('age-page-canvas');
        const slug = String(canvas?.dataset?.ageSlug || getOfficialAgeSlug()).trim().toLowerCase();
        return slug !== PRE_AGE_SLUG;
    }

    function readCommanderAccountResetAck() {
        try {
            return String(global.localStorage.getItem(COMMANDER_ACCOUNT_RESET_ACK_KEY) || '').trim();
        } catch (_err) {
            return '';
        }
    }

    function storeCommanderAccountResetAck(isoTimestamp) {
        const resetAt = String(isoTimestamp || '').trim();
        if (!resetAt) return;
        try {
            global.localStorage.setItem(COMMANDER_ACCOUNT_RESET_ACK_KEY, resetAt);
        } catch (_err) {
            /* ignore */
        }
    }

    function clearCommanderAccountResetAck() {
        try {
            global.localStorage.removeItem(COMMANDER_ACCOUNT_RESET_ACK_KEY);
        } catch (_err) {
            /* ignore */
        }
    }

    function shouldEvictForCommanderAccountReset(serverResetAt) {
        const resetAt = String(serverResetAt || '').trim();
        if (!resetAt) return false;

        const ack = readCommanderAccountResetAck();
        if (!ack) return true;

        const resetMs = Date.parse(resetAt);
        const ackMs = Date.parse(ack);
        if (!Number.isFinite(resetMs)) return false;
        if (!Number.isFinite(ackMs)) return true;
        return resetMs > ackMs;
    }

    function clearLocalAgeSessionEnrollmentFlags() {
        try {
            global.localStorage.removeItem('savedCommanderInActiveAge');
            const user = global.localStorage.getItem('activeCommanderUser');
            if (user && user.trim()) {
                global.localStorage.removeItem(`royalArmies_${user.trim()}_gameSessionStarted`);
            }
        } catch (_err) {
            /* ignore */
        }
    }

    function resolveAgeSessionUsername() {
        const saved = global.localStorage.getItem('activeCommanderUser');
        if (saved && saved.trim()) return saved.trim();
        if (typeof global.getActiveCommanderUsername === 'function') {
            const name = String(global.getActiveCommanderUsername() || '').trim();
            if (name && name.toLowerCase() !== 'testaccount') return name;
        }
        return '';
    }

    function resolveAgeSessionApiUrl(path) {
        if (typeof global.resolveRoyalArmiesApiUrl === 'function') {
            return global.resolveRoyalArmiesApiUrl(path);
        }
        return path;
    }

    function isAgeSessionEvictedJoinResponse(payload) {
        if (!payload || typeof payload !== 'object') return false;
        if (payload.evicted === true) return true;
        return String(payload.code || '').trim() === AGE_SESSION_EVICTED_CODE;
    }

    async function postAgeLeaveForEviction(username, resolveApiUrl) {
        if (!username) return;
        const url = typeof resolveApiUrl === 'function'
            ? resolveApiUrl('/api/portal/age/leave')
            : resolveAgeSessionApiUrl('/api/portal/age/leave');

        try {
            await global.fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username }),
                cache: 'no-store',
                credentials: 'include',
                keepalive: true
            });
        } catch (_err) {
            /* ignore */
        }
    }

    async function evictAgePageToMainAfterAccountReset(options) {
        if (global.__royalArmiesAgeEvictionInFlight) return true;
        global.__royalArmiesAgeEvictionInFlight = true;

        if (accountResetEvictionTimer) {
            global.clearInterval(accountResetEvictionTimer);
            accountResetEvictionTimer = null;
        }

        const username = options?.username || resolveAgeSessionUsername();
        clearLocalAgeSessionEnrollmentFlags();
        clearCommanderAccountResetAck();
        await postAgeLeaveForEviction(username, options?.resolveApiUrl);

        const target = typeof global.resolveRoyalArmiesPageUrl === 'function'
            ? global.resolveRoyalArmiesPageUrl('main')
            : '/main';

        if (global.RoyalArmiesPageRouteTransition?.navigateTo) {
            await global.RoyalArmiesPageRouteTransition.navigateTo(target);
        } else {
            global.location.replace(target);
        }
        return true;
    }

    function maybeEvictForAccountResetPayload(payload, resolveApiUrl) {
        if (!shouldEvictForCommanderAccountReset(payload?.commanderAccountResetAt)) {
            return false;
        }
        void evictAgePageToMainAfterAccountReset({
            username: resolveAgeSessionUsername(),
            resolveApiUrl
        });
        return true;
    }

    async function checkCommanderAccountResetEvictionFromMetrics(resolveApiUrl) {
        const url = typeof resolveApiUrl === 'function'
            ? resolveApiUrl('/api/portal/metrics')
            : resolveAgeSessionApiUrl('/api/portal/metrics');

        try {
            const response = await global.fetch(url, {
                cache: 'no-store',
                credentials: 'include'
            });
            const payload = await response.json().catch(() => ({}));
            return maybeEvictForAccountResetPayload(payload, resolveApiUrl);
        } catch (_err) {
            return false;
        }
    }

    function startCommanderAccountResetEvictionWatch(resolveApiUrl) {
        if (accountResetEvictionTimer) return accountResetEvictionTimer;

        const tick = () => {
            void checkCommanderAccountResetEvictionFromMetrics(resolveApiUrl);
        };

        tick();
        accountResetEvictionTimer = global.setInterval(tick, ACCOUNT_RESET_EVICTION_POLL_MS);
        return accountResetEvictionTimer;
    }

    async function resumeAgePortalSessionJoin(resolveApiUrl, bodyExtras) {
        const username = resolveAgeSessionUsername();
        if (!username) {
            return { ok: false, evicted: false, payload: { message: 'No commander session.' } };
        }

        if (await checkCommanderAccountResetEvictionFromMetrics(resolveApiUrl)) {
            return { ok: false, evicted: true, payload: { code: AGE_SESSION_EVICTED_CODE } };
        }

        const url = typeof resolveApiUrl === 'function'
            ? resolveApiUrl('/api/portal/age/join')
            : resolveAgeSessionApiUrl('/api/portal/age/join');

        const requestBody = {
            username,
            ageSlug: global.document.body?.dataset?.ageSlug || getOfficialAgeSlug(),
            ...(bodyExtras && typeof bodyExtras === 'object' ? bodyExtras : {})
        };

        try {
            const response = await global.fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                cache: 'no-store',
                credentials: 'include'
            });
            const payload = await response.json().catch(() => ({}));

            if (isAgeSessionEvictedJoinResponse(payload)
                || shouldEvictForCommanderAccountReset(payload?.commanderAccountResetAt)) {
                await evictAgePageToMainAfterAccountReset({ username, resolveApiUrl });
                return { ok: false, evicted: true, payload };
            }

            if (!response.ok || payload.status === 'error') {
                if (isAgeSessionEvictedJoinResponse(payload)) {
                    await evictAgePageToMainAfterAccountReset({ username, resolveApiUrl });
                    return { ok: false, evicted: true, payload };
                }
                return { ok: false, evicted: false, payload };
            }

            return { ok: true, evicted: false, payload };
        } catch (err) {
            console.warn('[RIFT] Age session resume failed:', err);
            return { ok: false, evicted: false, payload: { message: 'Connection error.' } };
        }
    }

    global.RoyalArmiesOfficialAge = {
        getOfficialAgeSlug,
        getOfficialAgePageFileName,
        getOfficialAgePagePath,
        isOfficialAgePageActive,
        isNationTerrainBonusDataLive,
        isPortalDirectAgeJoinEnabled,
        readCommanderAccountResetAck,
        storeCommanderAccountResetAck,
        clearCommanderAccountResetAck,
        shouldEvictForCommanderAccountReset,
        isAgeSessionEvictedJoinResponse,
        maybeEvictForAccountResetPayload,
        checkCommanderAccountResetEvictionFromMetrics,
        startCommanderAccountResetEvictionWatch,
        resumeAgePortalSessionJoin,
        evictAgePageToMainAfterAccountReset
    };

    global.getOfficialAgePagePath = getOfficialAgePagePath;
    global.isOfficialAgePageActive = isOfficialAgePageActive;
    global.isNationTerrainBonusDataLive = isNationTerrainBonusDataLive;
    global.isPortalDirectAgeJoinEnabled = isPortalDirectAgeJoinEnabled;
    global.storeCommanderAccountResetAck = storeCommanderAccountResetAck;
    global.readCommanderAccountResetAck = readCommanderAccountResetAck;
})(window);

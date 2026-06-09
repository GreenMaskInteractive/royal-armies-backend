/**
 * Local development helpers — Live Server (:5500, etc.), localhost:3000, file:// previews.
 * Load this script before script.js / script2.js on index.html and main.html.
 */
(function initRoyalArmiesDevEnvironment(global) {
    'use strict';

    const LIVE_SERVER_API_ORIGIN = 'http://localhost:3000';
    const LOCAL_DEV_AUTO_LOGIN_USERNAME = 'caleb_admin';
    const LOCAL_DEV_PLAYER_BYPASS_USERNAME = 'DevPlayer';
    const LOCAL_DEV_LOGOUT_FLAG = 'royalArmiesDevLogout';
    const LOCAL_DEV_VIEW_MODE_KEY = 'royalArmiesDevViewMode';
    const LOCAL_DEV_VIEW_MODES = Object.freeze({
        owner: 'owner',
        player: 'player',
        guest: 'guest'
    });

    function isLocalDevelopmentHost() {
        const host = (global.location.hostname || '').toLowerCase();
        const protocol = global.location.protocol || '';

        if (protocol === 'file:') return true;
        if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return true;
        if (host.endsWith('.local')) return true;

        return false;
    }

    function isProductionRoyalArmiesHost() {
        const host = (global.location.hostname || '').toLowerCase();
        return host === 'royalarmies.com' || host === 'www.royalarmies.com';
    }

    /** Page is served by Node (static + API on the same origin). */
    function isNexusBackendSameOrigin() {
        if (isProductionRoyalArmiesHost()) return true;
        if (!isLocalDevelopmentHost()) return false;

        const port = global.location.port;
        return port === '3000' || port === '';
    }

    /** VS Code Live Server, other static hosts — API on port 3000. */
    function isLiveStaticPreviewHost() {
        return isLocalDevelopmentHost() && !isNexusBackendSameOrigin();
    }

    /** Live Server default port — legal terms gate is bypassed for local preview only. */
    function isLiveServerPort5500() {
        if (!isLocalDevelopmentHost()) return false;
        return String(global.location.port || '').trim() === '5500';
    }

    /** Alias used by terms-acceptance and login/onboarding flows. */
    function isTermsLockBypassedForDev() {
        return isLiveServerPort5500();
    }

    const LIVE_PREVIEW_TERMS_BYPASS_HEADER = 'X-Royal-Armies-Live-Preview';

    function withLivePreviewFetchInit(init) {
        if (!isLiveStaticPreviewHost()) return init;

        const nextInit = init ? { ...init } : {};
        const headers = new Headers(nextInit.headers || {});
        const previewPort = String(global.location.port || '5500').trim() || '5500';
        headers.set(LIVE_PREVIEW_TERMS_BYPASS_HEADER, previewPort);
        nextInit.headers = headers;
        return nextInit;
    }

    function isLocalNexusApiUrl(urlString, apiOrigin) {
        try {
            const parsed = new URL(urlString, global.location.href);
            if (!parsed.pathname.startsWith('/api')) return false;

            const host = parsed.hostname.toLowerCase();
            const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
            if (!isLocalHost) return false;

            if (!apiOrigin) return true;

            const apiBase = new URL(apiOrigin);
            const parsedPort = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
            const apiPort = apiBase.port || (apiBase.protocol === 'https:' ? '443' : '80');
            return parsed.hostname.toLowerCase() === apiBase.hostname.toLowerCase() && parsedPort === apiPort;
        } catch (_err) {
            return false;
        }
    }

    function getRoyalArmiesApiOrigin() {
        if (isNexusBackendSameOrigin()) return '';
        if (isLocalDevelopmentHost()) return LIVE_SERVER_API_ORIGIN;
        return '';
    }

    function resolveRoyalArmiesApiUrl(path) {
        const route = String(path || '');
        if (!route.startsWith('/')) return route;
        const origin = getRoyalArmiesApiOrigin();
        return origin ? `${origin}${route}` : route;
    }

    /** Live Server / file:// previews need literal *.html paths; production uses extensionless slugs. */
    function shouldUseHtmlPageExtensions() {
        if (isProductionRoyalArmiesHost()) return false;
        return isLocalDevelopmentHost();
    }

    function normalizeRoyalArmiesPageQuery(query) {
        if (query == null || query === '') return '';
        if (query instanceof URLSearchParams) {
            const serialized = query.toString();
            return serialized ? `?${serialized}` : '';
        }
        const raw = String(query);
        return raw.startsWith('?') ? raw : `?${raw}`;
    }

    function resolveRoyalArmiesPageUrl(pageSlug, query) {
        const slug = String(pageSlug || '')
            .trim()
            .replace(/^\//, '')
            .replace(/\.html$/i, '');
        const safeSlug = slug || 'main';
        const path = shouldUseHtmlPageExtensions()
            ? `/${safeSlug}.html`
            : `/${safeSlug}`;
        return `${path}${normalizeRoyalArmiesPageQuery(query)}`;
    }

    function isPortalPreviewNavEnabled() {
        return isLocalDevelopmentHost();
    }

    function isLandingServedByNexusBackend() {
        return isNexusBackendSameOrigin();
    }

    function isMailboxApiAvailable() {
        if (isNexusBackendSameOrigin()) return true;
        if (!isRoyalArmiesApiReachable()) return false;
        return isLocalDevelopmentHost();
    }

    let royalArmiesApiReachable = null;

    function isRoyalArmiesApiReachable() {
        if (isNexusBackendSameOrigin()) return true;
        if (!isLiveStaticPreviewHost()) return true;
        return royalArmiesApiReachable !== false;
    }

    function shouldSuppressRepeatedLocalDevApiWarnings() {
        return isLiveStaticPreviewHost() && royalArmiesApiReachable === false;
    }

    function isFetchConnectionFailure(err) {
        const msg = String(err && (err.message || err)).toLowerCase();
        return msg.includes('failed to fetch')
            || msg.includes('networkerror')
            || msg.includes('network request failed')
            || msg.includes('connection refused')
            || msg.includes('load failed');
    }

    function markRoyalArmiesApiReachable() {
        royalArmiesApiReachable = true;
    }

    function markRoyalArmiesApiUnreachable() {
        if (royalArmiesApiReachable === false) return;
        royalArmiesApiReachable = false;
        console.warn(
            '[RIFT] Royal Armies API is not running at http://localhost:3000. '
            + 'Live Server only serves HTML/CSS/JS — start the backend with `node server.js`, '
            + 'or open http://localhost:3000/main instead.'
        );
        try {
            global.dispatchEvent(new CustomEvent('royalarmies:api-unreachable'));
        } catch (_err) {
            /* ignore */
        }
    }

    /** Auto sign-in as caleb_admin on local dev (port 3000, Live Server :5500, etc.). */
    function isLocalDevAutoLoginEnabled() {
        return isLocalDevelopmentHost() && !isProductionRoyalArmiesHost();
    }

    /** Hide NEXUS/RIFT error code footers in alerts while developing locally. */
    function shouldShowRiftErrorCodes() {
        return !isLocalDevelopmentHost();
    }

    /** Skip error popups on localhost / Live Server / file:// previews. */
    function shouldSuppressLocalDevErrorPopups() {
        return isLocalDevelopmentHost();
    }

    function isErrorLikePortalAlert(message, title) {
        const t = String(title || '').trim().toLowerCase();
        const m = String(message || '').trim().toLowerCase();

        if (t === 'message sent' || t === 'draft saved' || t === 'messages purged') {
            return false;
        }

        if (t === 'registration' && (m.includes('saved') || m.includes('check your email') || m.includes('confirm'))) {
            return false;
        }

        if (t === 'password reset' && (m.includes('one-time password') || m.includes('e-mail provided'))) {
            return false;
        }

        const errorTitleFragments = ['failed', 'error', 'denied', 'not sent', 'connection'];
        if (errorTitleFragments.some((frag) => t.includes(frag))) {
            return true;
        }

        const errorMessageFragments = [
            'could not',
            'cannot reach',
            'make sure node',
            'server.js is running',
            'nexus-',
            'rift-',
            'login failed',
            'invalid username',
            'invalid password',
            'already registered',
            'already taken',
            'please enter',
            'please fill',
            'do not match',
            'log in with',
            'choose at least',
            'check your username',
            'check your email and try again',
            'check recipients',
            'enter the email',
            'enter your current password',
            'enter a valid',
            're-verify your credentials'
        ];
        return errorMessageFragments.some((frag) => m.includes(frag));
    }

    function getLocalDevViewMode() {
        try {
            const stored = global.sessionStorage.getItem(LOCAL_DEV_VIEW_MODE_KEY);
            if (stored === LOCAL_DEV_VIEW_MODES.player) return LOCAL_DEV_VIEW_MODES.player;
            if (stored === LOCAL_DEV_VIEW_MODES.guest) return LOCAL_DEV_VIEW_MODES.guest;
            return LOCAL_DEV_VIEW_MODES.owner;
        } catch (_err) {
            return LOCAL_DEV_VIEW_MODES.owner;
        }
    }

    function setLocalDevViewMode(mode) {
        const next = String(mode || '').toLowerCase();
        const resolved = next === LOCAL_DEV_VIEW_MODES.player
            ? LOCAL_DEV_VIEW_MODES.player
            : (next === LOCAL_DEV_VIEW_MODES.guest ? LOCAL_DEV_VIEW_MODES.guest : LOCAL_DEV_VIEW_MODES.owner);

        try {
            global.sessionStorage.setItem(LOCAL_DEV_VIEW_MODE_KEY, resolved);
        } catch (_err) {
            /* ignore */
        }

        try {
            if (resolved === LOCAL_DEV_VIEW_MODES.guest) {
                global.sessionStorage.setItem(LOCAL_DEV_LOGOUT_FLAG, '1');
            } else {
                global.sessionStorage.removeItem(LOCAL_DEV_LOGOUT_FLAG);
            }
        } catch (_err) {
            /* ignore */
        }

        return resolved;
    }

    function isLocalDevPlayerBypassActive() {
        return isLocalDevAutoLoginEnabled() && getLocalDevViewMode() === LOCAL_DEV_VIEW_MODES.player;
    }

    /** Owner persona on localhost / Live Server — not production. */
    function isLocalDevOwnerPortalView() {
        if (isProductionRoyalArmiesHost()) return false;
        if (!isLocalDevelopmentHost()) return false;
        return getLocalDevViewMode() === LOCAL_DEV_VIEW_MODES.owner;
    }

    /** Unlocks guest-locked and preview-only nav while using a non-owner dev account. */
    function isPortalDevFullAccessBypass() {
        return isLocalDevPlayerBypassActive();
    }

    /** Local game.html — preview onboarding progression instead of resuming agealpha. */
    function shouldAllowLocalGameProgressionPreview() {
        return isLocalDevelopmentHost() && !isProductionRoyalArmiesHost();
    }

    function shouldSkipLocalDevAutoLogin() {
        if (getLocalDevViewMode() === LOCAL_DEV_VIEW_MODES.guest) return true;
        try {
            return global.sessionStorage.getItem(LOCAL_DEV_LOGOUT_FLAG) === '1';
        } catch (_err) {
            return false;
        }
    }

    function markLocalDevLogoutForGuestPreview() {
        return setLocalDevViewMode(LOCAL_DEV_VIEW_MODES.guest);
    }

    function clearLocalDevLogoutFlag() {
        try {
            global.sessionStorage.removeItem(LOCAL_DEV_LOGOUT_FLAG);
        } catch (_err) {
            /* ignore */
        }
    }

    const DEV_PREVIEW_NATION_SUFFIX = 'ageDeploymentNationId';
    const DEV_PREVIEW_CATALOG_CITY_SUFFIX = 'ageCatalogCityId';

    function readDevPreviewCommanderStorage(username, suffix) {
        const owner = String(username || '').trim();
        if (!owner) return '';
        try {
            return String(global.localStorage.getItem(`royalArmies_${owner}_${suffix}`) || '').trim();
        } catch (_err) {
            return '';
        }
    }

    function resolveDevPreviewUsername() {
        const saved = global.localStorage.getItem('activeCommanderUser');
        if (saved && saved.trim()) return saved.trim();
        if (typeof global.getActiveCommanderUsername === 'function') {
            return String(global.getActiveCommanderUsername() || '').trim();
        }
        if (global.player?.username) return String(global.player.username).trim();
        return '';
    }

    /** Live Server (:5500) — keep dev-panel nation choice over server ledger sync. */
    function applyDevPreviewNationOverride() {
        if (!isLiveStaticPreviewHost()) return null;

        const username = resolveDevPreviewUsername();
        const nationId = readDevPreviewCommanderStorage(username, DEV_PREVIEW_NATION_SUFFIX).toLowerCase();
        if (!nationId) return null;

        const catalogCityId = readDevPreviewCommanderStorage(username, DEV_PREVIEW_CATALOG_CITY_SUFFIX);

        if (global.player && typeof global.player === 'object') {
            global.player.gameNation = nationId;
        }

        if (typeof global.RoyalArmiesAgeMovement?.applyStatePayload === 'function') {
            global.RoyalArmiesAgeMovement.applyStatePayload({
                gameNation: nationId,
                mapNation: nationId,
                catalogCityId: catalogCityId || undefined
            }, { eventSource: 'dev-preview-nation-override' });
        }

        if (typeof global.applyCommanderDossierToClient === 'function') {
            global.applyCommanderDossierToClient({ gameNation: nationId });
        }

        if (typeof global.refreshAgeNationWelcomeChrome === 'function') {
            global.refreshAgeNationWelcomeChrome();
        }

        return { nationId, catalogCityId };
    }

    function readDevPreviewOnboardingClassPath(username) {
        const owner = String(username || '').trim().toLowerCase();
        if (!owner) return '';
        try {
            const raw = global.localStorage.getItem(`royalArmies_${owner}_devOnboardingClass`);
            if (!raw) return '';
            const cached = JSON.parse(raw);
            return String(cached?.path || '').trim().toUpperCase();
        } catch (_err) {
            return '';
        }
    }

    /** Live Server (:5500) — keep dev class picker choice over stale ledger PHYS. */
    function applyDevPreviewClassPathOverride() {
        if (!isLiveStaticPreviewHost()) return null;

        const username = resolveDevPreviewUsername();
        const pathCode = readDevPreviewOnboardingClassPath(username);
        if (pathCode !== 'MAG' && pathCode !== 'PHYS') return null;

        if (global.player && typeof global.player === 'object') {
            global.player.path = pathCode;
        }

        if (global.RoyalArmiesAgeCommanderRank?.applyCommanderRankPayload) {
            global.RoyalArmiesAgeCommanderRank.applyCommanderRankPayload(
                { path: pathCode },
                { source: 'dev-preview-class-override' }
            );
        } else if (global.RoyalArmiesAgeCommanderRank?.syncCommanderRankMeta) {
            global.RoyalArmiesAgeCommanderRank.syncCommanderRankMeta({ path: pathCode });
            global.refreshAgeHudCommanderRank?.();
        }

        if (typeof global.refreshCommanderRankTitleDisplays === 'function') {
            global.refreshCommanderRankTitleDisplays();
        }

        return { path: pathCode };
    }

    function patchFetchForLiveStaticPreview() {
        const apiOrigin = getRoyalArmiesApiOrigin();
        if (!apiOrigin || global.__royalArmiesFetchPatched) return;

        const nativeFetch = global.fetch.bind(global);
        global.fetch = function patchedRoyalArmiesFetch(input, init) {
            let requestPromise;
            const patchedInit = withLivePreviewFetchInit(init);

            if (typeof input === 'string') {
                if (input.startsWith('/api')) {
                    requestPromise = nativeFetch(`${apiOrigin}${input}`, patchedInit);
                } else if (isLocalNexusApiUrl(input, apiOrigin)) {
                    requestPromise = nativeFetch(input, patchedInit);
                }
            } else if (input instanceof Request) {
                const requestUrl = input.url;
                try {
                    const parsed = new URL(requestUrl, global.location.href);
                    if (!parsed.pathname.startsWith('/api')) {
                        throw new Error('not api');
                    }

                    const targetUrl = requestUrl.startsWith('/api')
                        ? `${apiOrigin}${parsed.pathname}${parsed.search}`
                        : (isLocalNexusApiUrl(requestUrl, apiOrigin) ? requestUrl : null);

                    if (targetUrl) {
                        const forwardedHeaders = new Headers(input.headers);
                        if (isLiveStaticPreviewHost()) {
                            const previewPort = String(global.location.port || '5500').trim() || '5500';
                            forwardedHeaders.set(LIVE_PREVIEW_TERMS_BYPASS_HEADER, previewPort);
                        }
                        requestPromise = nativeFetch(
                            new Request(targetUrl, {
                                method: input.method,
                                headers: forwardedHeaders,
                                body: input.body,
                                mode: input.mode,
                                credentials: input.credentials,
                                cache: input.cache,
                                redirect: input.redirect,
                                referrer: input.referrer,
                                integrity: input.integrity
                            }),
                            patchedInit
                        );
                    }
                } catch (_err) {
                    /* fall through */
                }
            }

            if (!requestPromise) {
                return nativeFetch(input, patchedInit);
            }

            return requestPromise
                .then((response) => {
                    markRoyalArmiesApiReachable();
                    return response;
                })
                .catch((err) => {
                    if (isFetchConnectionFailure(err)) {
                        markRoyalArmiesApiUnreachable();
                    }
                    throw err;
                });
        };

        global.__royalArmiesFetchPatched = true;
    }

    patchFetchForLiveStaticPreview();

    global.isLocalDevelopmentHost = isLocalDevelopmentHost;
    global.isLiveStaticPreviewHost = isLiveStaticPreviewHost;
    global.isNexusBackendSameOrigin = isNexusBackendSameOrigin;
    global.isPortalPreviewNavEnabled = isPortalPreviewNavEnabled;
    global.isLandingServedByNexusBackend = isLandingServedByNexusBackend;
    global.isMailboxApiAvailable = isMailboxApiAvailable;
    global.isLocalDevAutoLoginEnabled = isLocalDevAutoLoginEnabled;
    global.shouldShowRiftErrorCodes = shouldShowRiftErrorCodes;
    global.shouldSuppressLocalDevErrorPopups = shouldSuppressLocalDevErrorPopups;
    global.isErrorLikePortalAlert = isErrorLikePortalAlert;
    global.shouldSkipLocalDevAutoLogin = shouldSkipLocalDevAutoLogin;
    global.markLocalDevLogoutForGuestPreview = markLocalDevLogoutForGuestPreview;
    global.clearLocalDevLogoutFlag = clearLocalDevLogoutFlag;
    global.LOCAL_DEV_AUTO_LOGIN_USERNAME = LOCAL_DEV_AUTO_LOGIN_USERNAME;
    global.LOCAL_DEV_PLAYER_BYPASS_USERNAME = LOCAL_DEV_PLAYER_BYPASS_USERNAME;
    global.getLocalDevViewMode = getLocalDevViewMode;
    global.setLocalDevViewMode = setLocalDevViewMode;
    global.isLocalDevPlayerBypassActive = isLocalDevPlayerBypassActive;
    global.isLocalDevOwnerPortalView = isLocalDevOwnerPortalView;
    global.isPortalDevFullAccessBypass = isPortalDevFullAccessBypass;
    global.shouldAllowLocalGameProgressionPreview = shouldAllowLocalGameProgressionPreview;
    global.getRoyalArmiesApiOrigin = getRoyalArmiesApiOrigin;
    global.resolveRoyalArmiesApiUrl = resolveRoyalArmiesApiUrl;
    global.shouldUseHtmlPageExtensions = shouldUseHtmlPageExtensions;
    global.resolveRoyalArmiesPageUrl = resolveRoyalArmiesPageUrl;
    global.isRoyalArmiesApiReachable = isRoyalArmiesApiReachable;
    global.shouldSuppressRepeatedLocalDevApiWarnings = shouldSuppressRepeatedLocalDevApiWarnings;
    global.isLiveServerPort5500 = isLiveServerPort5500;
    global.isTermsLockBypassedForDev = isTermsLockBypassedForDev;
    global.buildLivePreviewApiFetchInit = withLivePreviewFetchInit;
    global.applyDevPreviewNationOverride = applyDevPreviewNationOverride;
    global.applyDevPreviewClassPathOverride = applyDevPreviewClassPathOverride;
    global.RoyalArmiesDev = {
        isLocalDevelopmentHost,
        isLiveStaticPreviewHost,
        isLiveServerPort5500,
        isTermsLockBypassedForDev,
        isNexusBackendSameOrigin,
        isPortalPreviewNavEnabled,
        isLandingServedByNexusBackend,
        isMailboxApiAvailable,
        isLocalDevAutoLoginEnabled,
        shouldShowRiftErrorCodes,
        shouldSuppressLocalDevErrorPopups,
        isErrorLikePortalAlert,
        shouldSkipLocalDevAutoLogin,
        markLocalDevLogoutForGuestPreview,
        clearLocalDevLogoutFlag,
        getLocalDevViewMode,
        setLocalDevViewMode,
        isLocalDevPlayerBypassActive,
        isLocalDevOwnerPortalView,
        isPortalDevFullAccessBypass,
        shouldAllowLocalGameProgressionPreview,
        localDevAutoLoginUsername: LOCAL_DEV_AUTO_LOGIN_USERNAME,
        localDevPlayerBypassUsername: LOCAL_DEV_PLAYER_BYPASS_USERNAME,
        viewModes: LOCAL_DEV_VIEW_MODES,
        getRoyalArmiesApiOrigin,
        resolveRoyalArmiesApiUrl,
        shouldUseHtmlPageExtensions,
        resolveRoyalArmiesPageUrl,
        isRoyalArmiesApiReachable,
        shouldSuppressRepeatedLocalDevApiWarnings,
        liveServerApiOrigin: LIVE_SERVER_API_ORIGIN,
        applyDevPreviewNationOverride,
        applyDevPreviewClassPathOverride
    };
})(window);

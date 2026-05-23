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

    function isPortalPreviewNavEnabled() {
        return isLocalDevelopmentHost();
    }

    function isLandingServedByNexusBackend() {
        return isNexusBackendSameOrigin();
    }

    function isMailboxApiAvailable() {
        return isNexusBackendSameOrigin() || isLocalDevelopmentHost();
    }

    /** Auto sign-in as caleb_admin on local dev (port 3000, Live Server :5500, etc.). */
    function isLocalDevAutoLoginEnabled() {
        return isLocalDevelopmentHost() && !isProductionRoyalArmiesHost();
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

    /** Unlocks guest-locked and preview-only nav while using a non-owner dev account. */
    function isPortalDevFullAccessBypass() {
        return isLocalDevPlayerBypassActive();
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

    function patchFetchForLiveStaticPreview() {
        const apiOrigin = getRoyalArmiesApiOrigin();
        if (!apiOrigin || global.__royalArmiesFetchPatched) return;

        const nativeFetch = global.fetch.bind(global);
        global.fetch = function patchedRoyalArmiesFetch(input, init) {
            if (typeof input === 'string' && input.startsWith('/api')) {
                return nativeFetch(`${apiOrigin}${input}`, init);
            }

            if (input instanceof Request) {
                const requestUrl = input.url;
                try {
                    const parsed = new URL(requestUrl, global.location.href);
                    if (parsed.pathname.startsWith('/api')) {
                        return nativeFetch(
                            new Request(`${apiOrigin}${parsed.pathname}${parsed.search}`, input),
                            init
                        );
                    }
                } catch (_err) {
                    /* fall through */
                }
            }

            return nativeFetch(input, init);
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
    global.shouldSkipLocalDevAutoLogin = shouldSkipLocalDevAutoLogin;
    global.markLocalDevLogoutForGuestPreview = markLocalDevLogoutForGuestPreview;
    global.clearLocalDevLogoutFlag = clearLocalDevLogoutFlag;
    global.LOCAL_DEV_AUTO_LOGIN_USERNAME = LOCAL_DEV_AUTO_LOGIN_USERNAME;
    global.LOCAL_DEV_PLAYER_BYPASS_USERNAME = LOCAL_DEV_PLAYER_BYPASS_USERNAME;
    global.getLocalDevViewMode = getLocalDevViewMode;
    global.setLocalDevViewMode = setLocalDevViewMode;
    global.isLocalDevPlayerBypassActive = isLocalDevPlayerBypassActive;
    global.isPortalDevFullAccessBypass = isPortalDevFullAccessBypass;
    global.getRoyalArmiesApiOrigin = getRoyalArmiesApiOrigin;
    global.resolveRoyalArmiesApiUrl = resolveRoyalArmiesApiUrl;
    global.RoyalArmiesDev = {
        isLocalDevelopmentHost,
        isLiveStaticPreviewHost,
        isNexusBackendSameOrigin,
        isPortalPreviewNavEnabled,
        isLandingServedByNexusBackend,
        isMailboxApiAvailable,
        isLocalDevAutoLoginEnabled,
        shouldSkipLocalDevAutoLogin,
        markLocalDevLogoutForGuestPreview,
        clearLocalDevLogoutFlag,
        getLocalDevViewMode,
        setLocalDevViewMode,
        isLocalDevPlayerBypassActive,
        isPortalDevFullAccessBypass,
        localDevAutoLoginUsername: LOCAL_DEV_AUTO_LOGIN_USERNAME,
        localDevPlayerBypassUsername: LOCAL_DEV_PLAYER_BYPASS_USERNAME,
        viewModes: LOCAL_DEV_VIEW_MODES,
        getRoyalArmiesApiOrigin,
        resolveRoyalArmiesApiUrl,
        liveServerApiOrigin: LIVE_SERVER_API_ORIGIN
    };
})(window);

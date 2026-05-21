/**
 * Local development helpers — Live Server (:5500, etc.), localhost:3000, file:// previews.
 * Load this script before script.js / script2.js on index.html and main.html.
 */
(function initRoyalArmiesDevEnvironment(global) {
    'use strict';

    const LIVE_SERVER_API_ORIGIN = 'http://localhost:3000';

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
    global.getRoyalArmiesApiOrigin = getRoyalArmiesApiOrigin;
    global.resolveRoyalArmiesApiUrl = resolveRoyalArmiesApiUrl;
    global.RoyalArmiesDev = {
        isLocalDevelopmentHost,
        isLiveStaticPreviewHost,
        isNexusBackendSameOrigin,
        isPortalPreviewNavEnabled,
        isLandingServedByNexusBackend,
        isMailboxApiAvailable,
        getRoyalArmiesApiOrigin,
        resolveRoyalArmiesApiUrl,
        liveServerApiOrigin: LIVE_SERVER_API_ORIGIN
    };
})(window);

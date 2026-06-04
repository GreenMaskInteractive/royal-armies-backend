/**
 * RIFT — Canonical extensionless page paths (browser-visible URLs without .html).
 */
(function initRoyalArmiesPagePaths(global) {
    'use strict';

    const PATHS = Object.freeze({
        main: '/main',
        game: '/game',
        agealpha: '/agealpha',
        settlement: '/settlement',
        headquarters: '/headquarters',
        'council-room': '/headquarters',
        terms: '/terms',
        resetPassword: '/reset-password',
        howDidYouGetHere: '/how-did-you-get-here'
    });

    function buildGameUrl(options = {}) {
        const url = new URL(PATHS.game, global.location?.origin || 'https://royalarmies.com');
        if (options.tutorial != null) url.searchParams.set('tutorial', String(options.tutorial));
        if (options.joinAge != null) url.searchParams.set('joinAge', String(options.joinAge));
        if (options.server) url.searchParams.set('server', String(options.server));
        if (options.riftProgressionReset) url.searchParams.set('riftProgressionReset', '1');
        const query = url.searchParams.toString();
        return query ? `${url.pathname}?${query}` : url.pathname;
    }

    function buildAgeAlphaUrl(options = {}) {
        const url = new URL(PATHS.agealpha, global.location?.origin || 'https://royalarmies.com');
        if (options.riftAgeDevBypass) url.searchParams.set('riftAgeDevBypass', '1');
        if (options.openSettlement) url.searchParams.set('openSettlement', '1');
        const query = url.searchParams.toString();
        return query ? `${url.pathname}?${query}` : url.pathname;
    }

    function buildSettlementUrl(options = {}) {
        if (options.useAgeAlphaTab === true) {
            return buildAgeAlphaUrl({
                riftAgeDevBypass: options.riftAgeDevBypass !== false,
                openSettlement: options.openSettlement !== false
            });
        }

        const url = new URL(PATHS.settlement, global.location?.origin || 'https://royalarmies.com');
        if (options.riftAgeDevBypass !== false) {
            url.searchParams.set('riftAgeDevBypass', '1');
        }
        const query = url.searchParams.toString();
        return query ? `${url.pathname}?${query}` : url.pathname;
    }

    function buildHeadquartersUrl(options = {}) {
        const url = new URL(PATHS.headquarters, global.location?.origin || 'https://royalarmies.com');
        if (options.riftAgeDevBypass) url.searchParams.set('riftAgeDevBypass', '1');
        const query = url.searchParams.toString();
        return query ? `${url.pathname}?${query}` : url.pathname;
    }

    function buildCouncilRoomUrl(options = {}) {
        return buildHeadquartersUrl(options);
    }

    function navigateToHeadquartersPage(options = {}) {
        const target = buildHeadquartersUrl({
            riftAgeDevBypass: options.riftAgeDevBypass !== false
        });
        if (global.RoyalArmiesPageRouteTransition?.navigateTo) {
            return global.RoyalArmiesPageRouteTransition.navigateTo(target);
        }
        global.location.href = target;
        return Promise.resolve();
    }

    function navigateToCouncilRoomPage(options = {}) {
        return navigateToHeadquartersPage(options);
    }

    function navigateToSettlementPage(options = {}) {
        const target = buildSettlementUrl({
            riftAgeDevBypass: options.riftAgeDevBypass !== false,
            useAgeAlphaTab: options.useAgeAlphaTab === true,
            openSettlement: options.openSettlement !== false
        });
        if (global.RoyalArmiesPageRouteTransition?.navigateTo) {
            return global.RoyalArmiesPageRouteTransition.navigateTo(target);
        }
        global.location.href = target;
        return Promise.resolve();
    }

    global.RoyalArmiesPagePaths = {
        ...PATHS,
        buildGameUrl,
        buildAgeAlphaUrl,
        buildSettlementUrl,
        buildHeadquartersUrl,
        buildCouncilRoomUrl,
        navigateToHeadquartersPage,
        navigateToCouncilRoomPage,
        navigateToSettlementPage
    };
})(window);

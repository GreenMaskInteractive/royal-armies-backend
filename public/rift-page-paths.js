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
        'council-room': '/council-room',
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
        return buildAgeAlphaUrl({
            riftAgeDevBypass: options.riftAgeDevBypass !== false,
            openSettlement: options.openSettlement !== false
        });
    }

    function buildCouncilRoomUrl(options = {}) {
        const url = new URL(PATHS['council-room'], global.location?.origin || 'https://royalarmies.com');
        if (options.riftAgeDevBypass) url.searchParams.set('riftAgeDevBypass', '1');
        const query = url.searchParams.toString();
        return query ? `${url.pathname}?${query}` : url.pathname;
    }

    function navigateToCouncilRoomPage(options = {}) {
        const target = buildCouncilRoomUrl({
            riftAgeDevBypass: options.riftAgeDevBypass !== false
        });
        if (global.RoyalArmiesPageRouteTransition?.navigateTo) {
            return global.RoyalArmiesPageRouteTransition.navigateTo(target);
        }
        global.location.href = target;
        return Promise.resolve();
    }

    function navigateToSettlementPage(options = {}) {
        const target = buildSettlementUrl({
            riftAgeDevBypass: options.riftAgeDevBypass !== false,
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
        buildCouncilRoomUrl,
        navigateToCouncilRoomPage,
        navigateToSettlementPage
    };
})(window);

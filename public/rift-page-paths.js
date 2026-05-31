/**
 * RIFT — Canonical extensionless page paths (browser-visible URLs without .html).
 */
(function initRoyalArmiesPagePaths(global) {
    'use strict';

    const PATHS = Object.freeze({
        main: '/main',
        game: '/game',
        agealpha: '/agealpha',
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
        const query = url.searchParams.toString();
        return query ? `${url.pathname}?${query}` : url.pathname;
    }

    global.RoyalArmiesPagePaths = {
        ...PATHS,
        buildGameUrl,
        buildAgeAlphaUrl
    };
})(window);

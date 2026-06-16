/**
 * NEXUS — Multi-tier service routing (portal / game / status / unified).
 * Used when Royal Armies runs as split Render services behind Cloudflare path routing.
 */
'use strict';

const path = require('path');

const VALID_TIERS = new Set(['unified', 'portal', 'game', 'status']);

const PORTAL_PAGE_SLUGS = new Set([
    'main',
    'reset-password',
    'terms'
]);

const GAME_PAGE_SLUGS = new Set([
    'game',
    'agealpha',
    'headquarters'
]);

const PORTAL_API_PREFIXES = [
    '/api/login',
    '/api/auth/',
    '/api/portal/account/',
    '/api/portal/mailbox',
    '/api/portal/community-chat',
    '/api/portal/player-reports',
    '/api/portal/metrics',
    '/api/portal/maintenance-alert',
    '/api/portal/error-codes',
    '/api/portal/legal/',
    '/api/portal/billing/',
    '/api/portal/commanders/',
    '/api/portal/trailer/',
    '/api/portal/mailbox-recipient-roster'
];

const GAME_API_PREFIXES = [
    '/api/portal/game-chat',
    '/api/portal/age/',
    '/api/portal/game/',
    '/api/portal/admin/',
    '/api/dev/'
];

const SHARED_API_PREFIXES = [
    '/api/health',
    '/api/status'
];

const PORTAL_HTML_PREFIXES = [
    '/main',
    '/reset-password',
    '/terms',
    '/verify',
    '/verify-email-change',
    '/register',
    '/forgot'
];

const GAME_HTML_PREFIXES = [
    '/game',
    '/agealpha',
    '/headquarters',
    '/settlement',
    '/council-room',
    '/how-did-you-get-here',
    '/ageofwar-trailer',
    '/royalarmies-ageofwar-trailer',
    '/ageportal',
    '/index',
    '/legal'
];

const STATUS_HTML_PREFIXES = [
    '/status'
];

const PORTAL_STATIC_PATTERNS = [
    /^main\.html$/i,
    /^reset-password\.html$/i,
    /^terms\.html$/i,
    /^script2\.js$/i,
    /^maintenance-alert\.js$/i,
    /^rift-error-display\.js$/i,
    /^rift-viewport-metrics\.js$/i,
    /^rift-display-resolution\.js$/i,
    /^rift-page-loading-gate\.js$/i,
    /^page-route-transition\.js$/i,
    /^dev-environment\.js$/i,
    /^dev-page-navigator\.(js|css)$/i,
    /^terms-acceptance\.js$/i,
    /^custom-cursor\.js$/i,
    /^rift-ui-sfx\.js$/i,
    /^rift-chat-mentions\.js$/i,
    /^rift-player-report\.js$/i,
    /^nexus-account-validation\.js$/i,
    /^style\.css$/i,
    /^style2\.css$/i,
    /^mobile-responsive\.css$/i,
    /^custom-cursor\.css$/i,
    /^dev-page-navigator\.css$/i,
    /^style-player-report\.css$/i,
    /^images\//i,
    /^audio\//i,
    /^data\//i,
    /^fonts\//i,
    /^favicon/i
];

const GAME_STATIC_PATTERNS = [
    /^game\.html$/i,
    /^agealpha\.html$/i,
    /^headquarters\.html$/i,
    /^settlement\.html$/i,
    /^age-/i,
    /^rift-age-/i,
    /^rift-banner-/i,
    /^rift-song-/i,
    /^rift-universal-/i,
    /^game-/i,
    /^game\.js$/i,
    /^game-chat\.js$/i,
    /^game-class-picker\.js$/i,
    /^game-nations-map\.js$/i,
    /^game-regions-map\.js$/i,
    /^battle-engine\.js$/i,
    /^blessed-banners-/i,
    /^style-age-/i,
    /^season\//i,
    /^season-/i,
    /^images\//i,
    /^audio\//i,
    /^data\//i,
    /^fonts\//i,
    /^public\//i
];

const STATUS_STATIC_PATTERNS = [
    /^status\.html$/i,
    /^rift-status-dashboard\.js$/i,
    /^style-status-dashboard\.css$/i,
    /^style\.css$/i,
    /^style2\.css$/i,
    /^custom-cursor\.(js|css)$/i,
    /^dev-environment\.js$/i,
    /^images\//i,
    /^favicon/i
];

function normalizeTier(raw) {
    const tier = String(raw || 'unified').trim().toLowerCase();
    return VALID_TIERS.has(tier) ? tier : 'unified';
}

function resolveServiceTier() {
    return normalizeTier(process.env.NEXUS_SERVICE_TIER);
}

function trimTrailingSlash(value) {
    return String(value || '').trim().replace(/\/+$/, '');
}

function resolvePeerUrls() {
    const portal = trimTrailingSlash(process.env.NEXUS_PORTAL_PEER_URL || process.env.ROYAL_ARMIES_PORTAL_URL || '');
    const game = trimTrailingSlash(process.env.NEXUS_GAME_PEER_URL || process.env.ROYAL_ARMIES_GAME_URL || '');
    const status = trimTrailingSlash(process.env.NEXUS_STATUS_PEER_URL || process.env.ROYAL_ARMIES_STATUS_URL || '');

    return {
        portal: portal || null,
        game: game || null,
        status: status || null
    };
}

function resolveServiceTierConfig() {
    const tier = resolveServiceTier();
    const peers = resolvePeerUrls();

    return {
        tier,
        isUnified: tier === 'unified',
        isPortal: tier === 'portal',
        isGame: tier === 'game',
        isStatus: tier === 'status',
        peers,
        publicSiteUrl: trimTrailingSlash(process.env.ROYAL_ARMIES_PUBLIC_URL || 'https://royalarmies.com') || 'https://royalarmies.com'
    };
}

function normalizeRequestPath(requestPath) {
    const raw = String(requestPath || '/').split('?')[0].trim() || '/';
    if (raw.length > 1 && raw.endsWith('/')) {
        return raw.slice(0, -1);
    }
    return raw;
}

function matchesPrefix(pathname, prefixes) {
    return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

function matchesStaticPattern(relativePath, patterns) {
    const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
    return patterns.some((pattern) => pattern.test(normalized));
}

function isPortalApiPath(pathname) {
    return matchesPrefix(pathname, PORTAL_API_PREFIXES);
}

function isGameApiPath(pathname) {
    return matchesPrefix(pathname, GAME_API_PREFIXES);
}

function isSharedApiPath(pathname) {
    return matchesPrefix(pathname, SHARED_API_PREFIXES);
}

function isPortalHtmlPath(pathname) {
    if (pathname === '/' || pathname === '/index' || pathname === '/index.html' || pathname === '/ageportal') {
        return true;
    }
    return matchesPrefix(pathname, PORTAL_HTML_PREFIXES);
}

function isGameHtmlPath(pathname) {
    return matchesPrefix(pathname, GAME_HTML_PREFIXES);
}

function isStatusHtmlPath(pathname) {
    return matchesPrefix(pathname, STATUS_HTML_PREFIXES);
}

function resolvePathTier(pathname) {
    if (isSharedApiPath(pathname)) return 'shared';
    if (isStatusHtmlPath(pathname)) return 'status';
    if (pathname === '/register' || pathname.startsWith('/verify')) return 'portal';
    if (isPortalApiPath(pathname) || isPortalHtmlPath(pathname)) return 'portal';
    if (isGameApiPath(pathname) || isGameHtmlPath(pathname)) return 'game';
    if (pathname.startsWith('/season-0')) return 'game';
    if (pathname.startsWith('/api/')) return 'game';
    return 'static';
}

function isPathAllowedForTier(pathname, tier) {
    if (tier === 'unified') return true;

    const pathTier = resolvePathTier(pathname);
    if (pathTier === 'shared') return true;

    if (tier === 'portal') {
        return pathTier === 'portal' || pathTier === 'static';
    }
    if (tier === 'game') {
        return pathTier === 'game' || pathTier === 'static';
    }
    if (tier === 'status') {
        return pathTier === 'status' || pathTier === 'shared' || pathTier === 'static';
    }

    return false;
}

function isStaticAssetAllowedForTier(relativePath, tier) {
    if (tier === 'unified') return true;

    const normalized = String(relativePath || '').replace(/\\/g, '/');
    const basename = path.basename(normalized);

    if (tier === 'portal') {
        return matchesStaticPattern(normalized, PORTAL_STATIC_PATTERNS)
            || matchesStaticPattern(basename, PORTAL_STATIC_PATTERNS);
    }
    if (tier === 'game') {
        return matchesStaticPattern(normalized, GAME_STATIC_PATTERNS)
            || matchesStaticPattern(basename, GAME_STATIC_PATTERNS);
    }
    if (tier === 'status') {
        return matchesStaticPattern(normalized, STATUS_STATIC_PATTERNS)
            || matchesStaticPattern(basename, STATUS_STATIC_PATTERNS);
    }

    return false;
}

function resolvePeerRedirectUrl(pathname, tierConfig) {
    const pathnameNorm = normalizeRequestPath(pathname);
    const pathTier = resolvePathTier(pathnameNorm);

    if (pathTier === 'portal' && tierConfig.tier === 'game' && tierConfig.peers.portal) {
        return `${tierConfig.peers.portal}${pathnameNorm}`;
    }
    if (pathTier === 'game' && tierConfig.tier === 'portal' && tierConfig.peers.game) {
        return `${tierConfig.peers.game}${pathnameNorm}`;
    }
    if (pathTier === 'status' && tierConfig.tier !== 'status' && tierConfig.peers.status) {
        return `${tierConfig.peers.status}${pathnameNorm}`;
    }
    if ((pathnameNorm === '/' || pathnameNorm === '/main') && tierConfig.tier === 'status') {
        return '/status';
    }

    return null;
}

function createServiceTierGateMiddleware(tierConfig = resolveServiceTierConfig()) {
    return function serviceTierGate(req, res, next) {
        if (tierConfig.isUnified) return next();

        const pathname = normalizeRequestPath(req.path || req.url || '/');
        if (isPathAllowedForTier(pathname, tierConfig.tier)) {
            return next();
        }

        const redirectTarget = resolvePeerRedirectUrl(pathname, tierConfig);
        if (redirectTarget) {
            return res.redirect(302, redirectTarget);
        }

        return res.status(503).json({
            status: 'error',
            code: 'NEXUS-TIER-001',
            message: 'This route is not available on the current service tier.',
            tier: tierConfig.tier,
            path: pathname
        });
    };
}

function createTierStaticFilterMiddleware(tierConfig = resolveServiceTierConfig()) {
    return function tierStaticFilter(req, res, next) {
        if (tierConfig.isUnified) return next();

        const relativePath = decodeURIComponent(String(req.path || '').replace(/^\/+/, ''));
        if (!relativePath) return next();

        if (isStaticAssetAllowedForTier(relativePath, tierConfig.tier)) {
            return next();
        }

        return res.status(404).send('Not found');
    };
}

function shouldRunAgeCampaignLifecycle(tierConfig = resolveServiceTierConfig()) {
    return tierConfig.isUnified || tierConfig.isGame;
}

function shouldRunPortalBackgroundJobs(tierConfig = resolveServiceTierConfig()) {
    return tierConfig.isUnified || tierConfig.isPortal;
}

function shouldRunStatusMonitor(tierConfig = resolveServiceTierConfig()) {
    return tierConfig.isUnified || tierConfig.isStatus;
}

function resolveLocalProbeBaseUrl() {
    const explicit = trimTrailingSlash(process.env.NEXUS_STATUS_PROBE_BASE_URL || '');
    if (explicit) return explicit;

    if (process.env.RENDER === 'true') return null;

    const port = Number(process.env.PORT) || 3000;
    return `http://127.0.0.1:${port}`;
}

function resolveStatusMonitorPeerConfig(tierConfig = resolveServiceTierConfig()) {
    const peers = tierConfig.peers;
    const publicSite = tierConfig.publicSiteUrl;
    const localBase = resolveLocalProbeBaseUrl();

    if (localBase && tierConfig.isUnified) {
        return {
            portalBaseUrl: localBase,
            gameBaseUrl: localBase,
            statusBaseUrl: localBase
        };
    }

    return {
        portalBaseUrl: peers.portal || (tierConfig.isPortal ? localBase : publicSite),
        gameBaseUrl: peers.game || (tierConfig.isGame ? localBase : publicSite),
        statusBaseUrl: peers.status || (tierConfig.isStatus ? localBase : publicSite)
    };
}

module.exports = {
    VALID_TIERS,
    PORTAL_PAGE_SLUGS,
    GAME_PAGE_SLUGS,
    resolveServiceTier,
    resolveServiceTierConfig,
    resolvePeerUrls,
    normalizeRequestPath,
    isPathAllowedForTier,
    isStaticAssetAllowedForTier,
    createServiceTierGateMiddleware,
    createTierStaticFilterMiddleware,
    shouldRunAgeCampaignLifecycle,
    shouldRunPortalBackgroundJobs,
    shouldRunStatusMonitor,
    resolveStatusMonitorPeerConfig,
    resolvePathTier,
    resolveLocalProbeBaseUrl
};

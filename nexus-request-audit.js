/**
 * NEXUS — Client request metadata for account security audit fields.
 */

function resolveClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const first = String(forwarded).split(',')[0].trim();
        if (first) return first.slice(0, 64);
    }

    const socketIp = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
    return String(socketIp).trim().slice(0, 64);
}

function resolveClientUserAgent(req) {
    return String(req.headers['user-agent'] || '').trim().slice(0, 512);
}

function buildCommanderRegistrationAuditPatch(req) {
    const patch = {};
    const ip = resolveClientIp(req);
    const userAgent = resolveClientUserAgent(req);

    if (ip) {
        patch.registrationIp = ip;
        patch.lastLoginIp = ip;
    }
    if (userAgent) {
        patch.registrationUserAgent = userAgent;
        patch.lastLoginUserAgent = userAgent;
    }

    const at = new Date().toISOString();
    patch.lastLoginAt = at;
    return patch;
}

function buildCommanderLoginAuditPatch(req) {
    const patch = { lastLoginAt: new Date().toISOString() };
    const ip = resolveClientIp(req);
    const userAgent = resolveClientUserAgent(req);

    if (ip) patch.lastLoginIp = ip;
    if (userAgent) patch.lastLoginUserAgent = userAgent;
    return patch;
}

module.exports = {
    resolveClientIp,
    resolveClientUserAgent,
    buildCommanderRegistrationAuditPatch,
    buildCommanderLoginAuditPatch
};

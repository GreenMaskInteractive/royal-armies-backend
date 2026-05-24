/**
 * NEXUS — server-side API error response helpers.
 * Network Environment Xypher Utility System.
 */
const {
    getErrorDefinition,
    resolveErrorCode,
    buildErrorPayload
} = require('./nexus-error-codes');

function sendApiError(res, codeOrLegacy, overrides = {}) {
    const resolved = resolveErrorCode(codeOrLegacy);
    const def = getErrorDefinition(resolved);
    const httpStatus = overrides.http || def?.http || 400;
    const payload = buildErrorPayload(resolved, overrides);
    return res.status(httpStatus).json(payload);
}

function sendStoreError(res, result, overrides = {}) {
    if (!result) return sendApiError(res, 'NEXUS-GEN-001', overrides);
    if (result.errorCode) return sendApiError(res, result.errorCode, overrides);
    if (result.error) return sendApiError(res, result.error, overrides);
    return sendApiError(res, 'NEXUS-GEN-001', overrides);
}

function storeErrorHttpStatus(result, fallback = 400) {
    if (!result) return fallback;
    const code = result.errorCode
        ? resolveErrorCode(result.errorCode)
        : resolveErrorCode(result.error);
    const def = getErrorDefinition(code);
    return def?.http || fallback;
}

module.exports = {
    sendApiError,
    sendStoreError,
    storeErrorHttpStatus
};

/**
 * RIFT — client-side error code resolution and in-game alerts.
 * Runtime Instruction Flow Terminal.
 */
(function initRiftErrorDisplay(global) {
    'use strict';

    const registry = global.RiftErrorCodes || global.NexusErrorCodes || global.RoyalArmiesErrorCodes || {};
    const resolveErrorCode = registry.resolveErrorCode || function fallbackResolve(code) {
        return String(code || 'NEXUS-GEN-001');
    };
    const buildErrorPayload = registry.buildErrorPayload || function fallbackBuild(code) {
        return {
            status: 'error',
            code: String(code || 'NEXUS-GEN-001'),
            title: 'Error',
            message: String(code || 'An error occurred.')
        };
    };

    function normalizeErrorPayload(input, fallbackTitle) {
        if (!input || typeof input !== 'object') {
            return buildErrorPayload('NEXUS-GEN-001', { title: fallbackTitle || 'Error' });
        }

        const code = input.code ? resolveErrorCode(input.code) : resolveErrorCode(input.message);
        const built = buildErrorPayload(code, {
            title: input.title || fallbackTitle,
            message: input.message
        });

        return {
            status: 'error',
            code: built.code,
            title: built.title || fallbackTitle || 'Error',
            message: built.message,
            category: built.category
        };
    }

    function shouldAppendErrorCodeFooter() {
        if (typeof global.shouldShowRiftErrorCodes === 'function') {
            return global.shouldShowRiftErrorCodes();
        }
        if (typeof global.isLocalDevelopmentHost === 'function') {
            return !global.isLocalDevelopmentHost();
        }
        return true;
    }

    function formatRiftErrorText(payload) {
        const normalized = normalizeErrorPayload(payload);
        if (!shouldAppendErrorCodeFooter()) {
            return normalized.message;
        }
        return `${normalized.message}\n\nError code: ${normalized.code}`;
    }

    function shouldSuppressRiftErrorPopup() {
        if (typeof global.shouldSuppressLocalDevErrorPopups === 'function') {
            return global.shouldSuppressLocalDevErrorPopups();
        }
        if (typeof global.isLocalDevelopmentHost === 'function') {
            return global.isLocalDevelopmentHost();
        }
        return false;
    }

    async function showRiftError(input, fallbackTitle) {
        const normalized = normalizeErrorPayload(input, fallbackTitle);

        if (shouldSuppressRiftErrorPopup()) {
            console.warn('[RIFT — local dev] Error popup suppressed:', normalized.title, normalized.message, normalized.code);
            return normalized;
        }

        const body = formatRiftErrorText(normalized);

        if (typeof global.showPortalAlert === 'function') {
            await global.showPortalAlert(body, normalized.title);
            return normalized;
        }

        global.alert(`${normalized.title}\n\n${body}`);
        return normalized;
    }

    async function handleRiftApiFailure(response, payload, fallbackTitle) {
        const merged = payload && typeof payload === 'object'
            ? payload
            : { message: fallbackTitle || 'Request failed.' };

        if (response && !merged.code && merged.message) {
            merged.code = resolveErrorCode(merged.message);
        }

        return showRiftError(merged, fallbackTitle);
    }

    async function showRiftNetworkError(fallbackTitle) {
        return showRiftError({ code: 'RIFT-NET-001' }, fallbackTitle || 'Connection error');
    }

    const UPDATE_DOWNTIME_HTTP_STATUSES = new Set([502, 503, 504, 521, 522, 523, 524]);
    let updateUnderwayNoticeShown = false;

    function isServerUpdateDowntime(response, payload, err) {
        if (typeof global.isLocalDevelopmentHost === 'function' && global.isLocalDevelopmentHost()) {
            return false;
        }

        if (err) return true;

        if (!response) return false;

        const status = Number(response.status) || 0;
        if (UPDATE_DOWNTIME_HTTP_STATUSES.has(status)) return true;
        if (status === 0) return true;

        if (!response.ok) {
            const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase();
            if (contentType.includes('text/html')) return true;

            const payloadStatus = String(payload?.status || '').trim().toLowerCase();
            const hasKnownError = Boolean(String(payload?.code || payload?.errorCode || '').trim())
                || payloadStatus === 'error';
            if (!hasKnownError && status >= 500) return true;
        }

        return false;
    }

    function markServerReachableAgain() {
        updateUnderwayNoticeShown = false;
    }

    async function showRiftUpdateUnderwayNotice(fallbackTitle) {
        if (typeof global.isLocalDevelopmentHost === 'function' && global.isLocalDevelopmentHost()) {
            return showRiftNetworkError(fallbackTitle);
        }

        const normalized = buildErrorPayload('RIFT-NET-002');

        if (updateUnderwayNoticeShown) {
            return normalized;
        }

        updateUnderwayNoticeShown = true;

        if (shouldSuppressRiftErrorPopup()) {
            console.warn('[RIFT — local dev] Update notice suppressed:', normalized.message);
            return normalized;
        }

        if (typeof global.showPortalAlert === 'function') {
            await global.showPortalAlert(normalized.message, normalized.title);
            return normalized;
        }

        global.alert(`${normalized.title}\n\n${normalized.message}`);
        return normalized;
    }

    global.normalizeRiftErrorPayload = normalizeErrorPayload;
    global.formatRiftErrorText = formatRiftErrorText;
    global.showRiftError = showRiftError;
    global.handleRiftApiFailure = handleRiftApiFailure;
    global.showRiftNetworkError = showRiftNetworkError;
    global.isServerUpdateDowntime = isServerUpdateDowntime;
    global.showRiftUpdateUnderwayNotice = showRiftUpdateUnderwayNotice;
    global.markServerReachableAgain = markServerReachableAgain;

    global.normalizeRoyalArmiesErrorPayload = normalizeErrorPayload;
    global.formatRoyalArmiesErrorText = formatRiftErrorText;
    global.showRoyalArmiesError = showRiftError;
    global.handleRoyalArmiesApiFailure = handleRiftApiFailure;
    global.showRoyalArmiesNetworkError = showRiftNetworkError;
    global.isRoyalArmiesUpdateDowntime = isServerUpdateDowntime;
    global.showRoyalArmiesUpdateUnderwayNotice = showRiftUpdateUnderwayNotice;
    global.markRoyalArmiesServerReachableAgain = markServerReachableAgain;
})(window);

/**
 * Royal Armies — client-side error code resolution and in-game alerts.
 */
(function initRoyalArmiesErrorDisplay(global) {
    'use strict';

    const registry = global.RoyalArmiesErrorCodes || {};
    const resolveErrorCode = registry.resolveErrorCode || function fallbackResolve(code) {
        return String(code || 'RA-GEN-001');
    };
    const buildErrorPayload = registry.buildErrorPayload || function fallbackBuild(code) {
        return {
            status: 'error',
            code: String(code || 'RA-GEN-001'),
            title: 'Error',
            message: String(code || 'An error occurred.')
        };
    };

    function normalizeErrorPayload(input, fallbackTitle) {
        if (!input || typeof input !== 'object') {
            return buildErrorPayload('RA-GEN-001', { title: fallbackTitle || 'Error' });
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

    function formatRoyalArmiesErrorText(payload) {
        const normalized = normalizeErrorPayload(payload);
        return `${normalized.message}\n\nError code: ${normalized.code}`;
    }

    async function showRoyalArmiesError(input, fallbackTitle) {
        const normalized = normalizeErrorPayload(input, fallbackTitle);
        const body = formatRoyalArmiesErrorText(normalized);

        if (typeof global.showPortalAlert === 'function') {
            await global.showPortalAlert(body, normalized.title);
            return normalized;
        }

        global.alert(`${normalized.title}\n\n${body}`);
        return normalized;
    }

    async function handleRoyalArmiesApiFailure(response, payload, fallbackTitle) {
        const merged = payload && typeof payload === 'object'
            ? payload
            : { message: fallbackTitle || 'Request failed.' };

        if (response && !merged.code && merged.message) {
            merged.code = resolveErrorCode(merged.message);
        }

        return showRoyalArmiesError(merged, fallbackTitle);
    }

    async function showRoyalArmiesNetworkError(fallbackTitle) {
        return showRoyalArmiesError({ code: 'RA-NET-001' }, fallbackTitle || 'Connection error');
    }

    global.normalizeRoyalArmiesErrorPayload = normalizeErrorPayload;
    global.formatRoyalArmiesErrorText = formatRoyalArmiesErrorText;
    global.showRoyalArmiesError = showRoyalArmiesError;
    global.handleRoyalArmiesApiFailure = handleRoyalArmiesApiFailure;
    global.showRoyalArmiesNetworkError = showRoyalArmiesNetworkError;
})(window);

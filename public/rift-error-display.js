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

    const UPDATE_DOWNTIME_HTTP_STATUSES = new Set([502, 503, 504, 521, 522, 523, 524]);
    const UPDATE_GATEWAY_POLL_MS = 1000;
    const UPDATE_GATEWAY_ESTIMATE_SEC = 45;

    let updateUnderwayNoticeShown = false;
    let updateUnderwayCountdownTimer = null;
    let updateUnderwayGatewayPollTimer = null;
    let updateUnderwayCountdownEndsAt = 0;

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

    function isUpdateGatewayHardDownResponse(response) {
        if (!response) return false;
        const status = Number(response.status) || 0;
        if (!UPDATE_DOWNTIME_HTTP_STATUSES.has(status)) return false;

        const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase();
        return contentType.includes('text/html');
    }

    function resolveUpdateGatewayProbeUrl() {
        if (typeof global.resolveRoyalArmiesApiUrl === 'function') {
            return global.resolveRoyalArmiesApiUrl('/api/portal/metrics');
        }
        return '/api/portal/metrics';
    }

    function formatUpdateCountdownLabel(secondsRemaining) {
        const total = Math.max(0, Math.ceil(secondsRemaining));
        if (total <= 0) return 'Now';
        const minutes = Math.floor(total / 60);
        const seconds = total % 60;
        if (minutes > 0) {
            return `${minutes}:${String(seconds).padStart(2, '0')}`;
        }
        return String(total);
    }

    function stopUpdateUnderwayWatchers() {
        if (updateUnderwayCountdownTimer) {
            global.clearInterval(updateUnderwayCountdownTimer);
            updateUnderwayCountdownTimer = null;
        }
        if (updateUnderwayGatewayPollTimer) {
            global.clearInterval(updateUnderwayGatewayPollTimer);
            updateUnderwayGatewayPollTimer = null;
        }
    }

    function tickUpdateUnderwayCountdown() {
        const remaining = (updateUnderwayCountdownEndsAt - Date.now()) / 1000;
        const label = formatUpdateCountdownLabel(remaining);
        const hint = remaining > 0
            ? 'Estimated until the gateway outage page (502 or 504) may appear.'
            : 'Gateway outage page may appear at any moment.';

        if (typeof global.setPortalUpdateUnderwayCountdown === 'function') {
            global.setPortalUpdateUnderwayCountdown(label, hint);
        }
    }

    function triggerUpdateGatewayHardDown() {
        stopUpdateUnderwayWatchers();
        if (typeof global.closePortalAlertModal === 'function') {
            global.closePortalAlertModal(true);
        }
        try {
            global.location.reload();
        } catch (_err) {
            /* ignore */
        }
    }

    async function probeUpdateGatewayState() {
        try {
            const response = await global.fetch(resolveUpdateGatewayProbeUrl(), {
                method: 'GET',
                cache: 'no-store',
                credentials: 'include'
            });

            if (response.ok) {
                markServerReachableAgain();
                stopUpdateUnderwayWatchers();
                return;
            }

            if (isUpdateGatewayHardDownResponse(response)) {
                triggerUpdateGatewayHardDown();
            }
        } catch (_err) {
            /* soft outage — keep countdown and polling */
        }
    }

    function startUpdateUnderwayWatchers() {
        stopUpdateUnderwayWatchers();
        updateUnderwayCountdownEndsAt = Date.now() + (UPDATE_GATEWAY_ESTIMATE_SEC * 1000);
        tickUpdateUnderwayCountdown();

        updateUnderwayCountdownTimer = global.setInterval(tickUpdateUnderwayCountdown, 1000);
        updateUnderwayGatewayPollTimer = global.setInterval(() => {
            probeUpdateGatewayState();
        }, UPDATE_GATEWAY_POLL_MS);
        probeUpdateGatewayState();
    }

    function markServerReachableAgain() {
        updateUnderwayNoticeShown = false;
        stopUpdateUnderwayWatchers();
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

        const onClose = () => {
            stopUpdateUnderwayWatchers();
        };

        if (typeof global.showPortalUpdateUnderwayAlert === 'function') {
            await global.showPortalUpdateUnderwayAlert({
                title: normalized.title,
                message: normalized.message,
                countdownLabel: formatUpdateCountdownLabel(UPDATE_GATEWAY_ESTIMATE_SEC),
                onClose
            });
            startUpdateUnderwayWatchers();
            return normalized;
        }

        if (typeof global.showPortalAlert === 'function') {
            await global.showPortalAlert(normalized.message, normalized.title);
            startUpdateUnderwayWatchers();
            return normalized;
        }

        global.alert(`${normalized.title}\n\n${normalized.message}`);
        startUpdateUnderwayWatchers();
        return normalized;
    }

    async function handleRiftApiFailure(response, payload, fallbackTitle) {
        if (isServerUpdateDowntime(response, payload, null)) {
            return showRiftUpdateUnderwayNotice(fallbackTitle);
        }

        const merged = payload && typeof payload === 'object'
            ? payload
            : { message: fallbackTitle || 'Request failed.' };

        if (response && !merged.code && merged.message) {
            merged.code = resolveErrorCode(merged.message);
        }

        return showRiftError(merged, fallbackTitle);
    }

    async function showRiftNetworkError(fallbackTitle) {
        if (typeof global.isLocalDevelopmentHost === 'function' && global.isLocalDevelopmentHost()) {
            return showRiftError({ code: 'RIFT-NET-001' }, fallbackTitle || 'Connection error');
        }
        return showRiftUpdateUnderwayNotice(fallbackTitle);
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

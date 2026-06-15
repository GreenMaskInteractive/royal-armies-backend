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

        console.warn('[RIFT] Error notice (portal alert unavailable):', normalized.title, body);
        return normalized;
    }

    const UPDATE_DOWNTIME_HTTP_STATUSES = new Set([502, 503, 504, 521, 522, 523, 524]);
    const UPDATE_GATEWAY_BAD_GATEWAY_STATUS = 502;
    const UPDATE_GATEWAY_POLL_MS = 1000;
    const DEPLOY_WATCH_POLL_VISIBLE_MS = 2500;
    const DEPLOY_WATCH_POLL_HIDDEN_MS = 8000;
    const DEPLOY_WATCH_FAIL_STREAK_THRESHOLD = 2;
    const UPDATE_GATEWAY_STANDALONE_RELOAD_MS = 6000;

    const UPDATE_UNDERWAY_SESSION_KEY = 'riftUpdateUnderwayActive';

    let updateUnderwayNoticeShown = false;
    let updateAwaitingRecoveryConfirm = false;
    let updateCompleteNoticeShown = false;
    let updateUnderwayGatewayPollTimer = null;
    let updateGatewayReloadTriggered = false;
    let deployWatchTimer = null;
    let deployWatchBaselineKey = '';
    let deployWatchFailStreak = 0;
    let deployWatchPrimed = false;

    function markUpdateUnderwaySessionActive() {
        try {
            global.sessionStorage.setItem(UPDATE_UNDERWAY_SESSION_KEY, '1');
        } catch (_err) {
            /* ignore */
        }
    }

    function clearUpdateUnderwaySession() {
        try {
            global.sessionStorage.removeItem(UPDATE_UNDERWAY_SESSION_KEY);
        } catch (_err) {
            /* ignore */
        }
    }

    function wasUpdateUnderwaySessionActive() {
        try {
            return global.sessionStorage.getItem(UPDATE_UNDERWAY_SESSION_KEY) === '1';
        } catch (_err) {
            return false;
        }
    }

    function shouldTrackUpdateRecovery() {
        return updateAwaitingRecoveryConfirm || wasUpdateUnderwaySessionActive();
    }

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

    function isUpdateGateway502Response(response) {
        return Boolean(response) && Number(response.status) === UPDATE_GATEWAY_BAD_GATEWAY_STATUS;
    }

    async function responseBodyLooksLike502Gateway(response) {
        if (!isUpdateGateway502Response(response)) return false;

        const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase();
        if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
            return true;
        }

        try {
            const snippet = String(await response.clone().text()).slice(0, 1200).toLowerCase();
            if (!snippet.trim()) return true;
            return snippet.includes('bad gateway')
                || snippet.includes('502')
                || snippet.includes('cloudflare')
                || snippet.includes('render');
        } catch (_err) {
            return true;
        }
    }

    function resolveDeployWatchApiUrl(path) {
        return typeof global.resolveRoyalArmiesApiUrl === 'function'
            ? global.resolveRoyalArmiesApiUrl(path)
            : path;
    }

    function isDeployWatchEnabled() {
        if (typeof global.isLocalDevelopmentHost === 'function' && global.isLocalDevelopmentHost()) {
            return false;
        }
        return true;
    }

    function buildDeployWatchKey(snapshot) {
        const bootId = String(snapshot?.bootId || '').trim();
        const revision = String(snapshot?.revision || '').trim();
        if (!bootId && !revision) return '';
        return `${bootId}::${revision}`;
    }

    async function fetchDeployWatchSnapshot() {
        const response = await global.fetch(resolveDeployWatchApiUrl('/api/portal/metrics'), {
            method: 'GET',
            cache: 'no-store',
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error('deploy-watch-metrics-failed');
        }
        const payload = await response.json().catch(() => ({}));
        const deploy = payload?.deploy && typeof payload.deploy === 'object' ? payload.deploy : {};
        const snapshot = {
            bootId: String(deploy.bootId || '').trim(),
            revision: String(deploy.revision || '').trim()
        };
        if (typeof global.checkDeployBootForPostUpdateLogout === 'function') {
            global.checkDeployBootForPostUpdateLogout(snapshot);
        }
        return snapshot;
    }

    async function fetchMaintenanceUpdateImminent() {
        const response = await global.fetch(resolveDeployWatchApiUrl('/api/portal/maintenance-alert'), {
            method: 'GET',
            cache: 'no-store',
            credentials: 'include'
        });
        if (!response.ok) return false;
        const payload = await response.json().catch(() => ({}));
        return payload?.updateImminent === true;
    }

    function stopDeployWatch() {
        if (deployWatchTimer) {
            global.clearInterval(deployWatchTimer);
            deployWatchTimer = null;
        }
    }

    function scheduleDeployWatch() {
        if (!isDeployWatchEnabled()) return;
        stopDeployWatch();
        const intervalMs = global.document?.hidden
            ? DEPLOY_WATCH_POLL_HIDDEN_MS
            : DEPLOY_WATCH_POLL_VISIBLE_MS;
        deployWatchTimer = global.setInterval(() => {
            void tickDeployWatch();
        }, intervalMs);
    }

    async function tickDeployWatch() {
        if (!isDeployWatchEnabled()) return;
        if (updateUnderwayNoticeShown) return;

        try {
            if (await fetchMaintenanceUpdateImminent()) {
                deployWatchFailStreak = 0;
                await showRiftUpdateUnderwayNotice('Site update');
                return;
            }
        } catch (_err) {
            /* maintenance-alert probe failed — fall through to metrics */
        }

        try {
            const snapshot = await fetchDeployWatchSnapshot();
            const nextKey = buildDeployWatchKey(snapshot);
            deployWatchFailStreak = 0;

            if (!deployWatchPrimed) {
                deployWatchPrimed = true;
                deployWatchBaselineKey = nextKey;
                return;
            }

            if (nextKey && deployWatchBaselineKey && nextKey !== deployWatchBaselineKey) {
                deployWatchBaselineKey = nextKey;
                await showRiftUpdateUnderwayNotice('Site update');
                return;
            }

            if (nextKey) {
                deployWatchBaselineKey = nextKey;
            }
        } catch (_err) {
            if (!deployWatchPrimed) return;
            deployWatchFailStreak += 1;
            if (deployWatchFailStreak >= DEPLOY_WATCH_FAIL_STREAK_THRESHOLD) {
                deployWatchFailStreak = 0;
                await showRiftUpdateUnderwayNotice('Site update');
            }
        }
    }

    function startDeployWatch() {
        if (!isDeployWatchEnabled()) return;
        void tickDeployWatch();
        scheduleDeployWatch();
        if (!global.document?.deployWatchVisibilityBound) {
            global.document.deployWatchVisibilityBound = true;
            global.document.addEventListener('visibilitychange', () => {
                if (!updateUnderwayNoticeShown) {
                    scheduleDeployWatch();
                }
            });
        }
    }

    function resolveUpdateGatewayProbeUrls() {
        const urls = [];
        const add = (path) => {
            const resolved = typeof global.resolveRoyalArmiesApiUrl === 'function'
                ? global.resolveRoyalArmiesApiUrl(path)
                : path;
            if (resolved && !urls.includes(resolved)) urls.push(resolved);
        };

        add('/api/portal/metrics');
        add(global.location?.pathname || '/');
        add('/');
        return urls;
    }

    function stopUpdateUnderwayWatchers() {
        if (updateUnderwayGatewayPollTimer) {
            global.clearInterval(updateUnderwayGatewayPollTimer);
            updateUnderwayGatewayPollTimer = null;
        }
    }

    function triggerUpdateGateway502Refresh() {
        if (updateGatewayReloadTriggered) return;
        updateGatewayReloadTriggered = true;
        markUpdateUnderwaySessionActive();
        stopUpdateUnderwayWatchers();
        if (typeof global.closePortalAlertModal === 'function') {
            global.closePortalAlertModal(true);
        }
        try {
            global.location.reload();
        } catch (_err) {
            updateGatewayReloadTriggered = false;
        }
    }

    async function probeUpdateGatewayState() {
        const urls = resolveUpdateGatewayProbeUrls();
        let sawHealthyResponse = false;

        for (const url of urls) {
            try {
                const response = await global.fetch(url, {
                    method: 'GET',
                    cache: 'no-store',
                    credentials: 'include'
                });

                if (response.ok) {
                    sawHealthyResponse = true;
                    continue;
                }

                if (isUpdateGateway502Response(response) && await responseBodyLooksLike502Gateway(response)) {
                    triggerUpdateGateway502Refresh();
                    return;
                }
            } catch (_err) {
                /* soft outage — try other probe URLs */
            }
        }

        if (sawHealthyResponse) {
            markServerReachableAgain();
        }
    }

    async function probeSiteHealthyOnce() {
        const urls = resolveUpdateGatewayProbeUrls();
        for (const url of urls) {
            try {
                const response = await global.fetch(url, {
                    method: 'GET',
                    cache: 'no-store',
                    credentials: 'include'
                });
                if (response.ok) return true;
            } catch (_err) {
                /* try next probe */
            }
        }
        return false;
    }

    function isStandalone502GatewayDocument() {
        if (global.document.getElementById('age-page-canvas')
            || global.document.getElementById('main-dashboard-canvas')
            || global.document.getElementById('game-page-canvas')) {
            return false;
        }

        const title = String(global.document.title || '').toLowerCase();
        const body = String(global.document.body?.innerText || '').toLowerCase().slice(0, 2000);
        return (title.includes('502') || body.includes('502'))
            && body.includes('bad gateway');
    }

    function startStandalone502GatewayAutoRefresh() {
        if (typeof global.isLocalDevelopmentHost === 'function' && global.isLocalDevelopmentHost()) {
            return;
        }
        if (!isStandalone502GatewayDocument()) return;

        global.setInterval(() => {
            try {
                global.location.reload();
            } catch (_err) {
                /* ignore */
            }
        }, UPDATE_GATEWAY_STANDALONE_RELOAD_MS);
    }

    function startUpdateUnderwayWatchers() {
        stopUpdateUnderwayWatchers();
        updateUnderwayGatewayPollTimer = global.setInterval(() => {
            probeUpdateGatewayState();
        }, UPDATE_GATEWAY_POLL_MS);
        probeUpdateGatewayState();
    }

    async function showRiftUpdateCompleteNotice() {
        if (updateCompleteNoticeShown) return;

        if (typeof global.isLocalDevelopmentHost === 'function' && global.isLocalDevelopmentHost()) {
            clearUpdateUnderwaySession();
            updateAwaitingRecoveryConfirm = false;
            return;
        }

        if (shouldSuppressRiftErrorPopup()) {
            console.warn('[RIFT — local dev] Update complete popup suppressed.');
            clearUpdateUnderwaySession();
            updateAwaitingRecoveryConfirm = false;
            return;
        }

        updateCompleteNoticeShown = true;
        clearUpdateUnderwaySession();
        updateAwaitingRecoveryConfirm = false;
        updateUnderwayNoticeShown = false;
        stopUpdateUnderwayWatchers();

        if (typeof global.closePortalAlertModal === 'function') {
            global.closePortalAlertModal(true);
        }

        let deployBootId = '';
        try {
            const snapshot = await fetchDeployWatchSnapshot();
            deployBootId = snapshot?.bootId || '';
        } catch (_err) {
            /* ignore */
        }

        const hasAuth = typeof global.isPortalUserAuthenticated === 'function'
            ? global.isPortalUserAuthenticated()
            : Boolean(String(global.localStorage?.getItem?.('activeCommanderUser') || '').trim());

        if (hasAuth && typeof global.performPostUpdatePlayerbaseLogout === 'function') {
            await global.performPostUpdatePlayerbaseLogout({ deployBootId });
            return;
        }

        if (deployBootId && typeof global.storeKnownDeployBootId === 'function') {
            global.storeKnownDeployBootId(deployBootId);
        }

        const normalized = buildErrorPayload('RIFT-NET-003');

        if (typeof global.showPortalUpdateCompleteAlert === 'function') {
            await global.showPortalUpdateCompleteAlert({
                title: normalized.title,
                message: normalized.message,
                confirmLabel: 'Continue'
            });
            return;
        }

        if (typeof global.showPortalAlert === 'function') {
            await global.showPortalAlert(normalized.message, normalized.title);
            return;
        }

        console.warn('[RIFT] Update complete notice (portal alert unavailable):', normalized.title, normalized.message);
    }

    function markServerReachableAgain() {
        const shouldConfirmRecovery = shouldTrackUpdateRecovery();
        stopUpdateUnderwayWatchers();
        updateGatewayReloadTriggered = false;

        if (shouldConfirmRecovery) {
            void showRiftUpdateCompleteNotice();
            return;
        }

        updateUnderwayNoticeShown = false;
        updateAwaitingRecoveryConfirm = false;
        clearUpdateUnderwaySession();
    }

    async function checkUpdateRecoveryOnLoad() {
        if (typeof global.isLocalDevelopmentHost === 'function' && global.isLocalDevelopmentHost()) {
            return;
        }
        if (!wasUpdateUnderwaySessionActive()) return;

        const healthy = await probeSiteHealthyOnce();
        if (healthy) {
            await showRiftUpdateCompleteNotice();
        } else {
            updateAwaitingRecoveryConfirm = true;
            startUpdateUnderwayWatchers();
        }
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
        updateAwaitingRecoveryConfirm = true;
        updateCompleteNoticeShown = false;
        markUpdateUnderwaySessionActive();

        if (shouldSuppressRiftErrorPopup()) {
            console.warn('[RIFT — local dev] Update notice suppressed:', normalized.message);
            return normalized;
        }

        startUpdateUnderwayWatchers();

        if (typeof global.showPortalUpdateUnderwayAlert === 'function') {
            void global.showPortalUpdateUnderwayAlert({
                title: normalized.title,
                message: normalized.message,
                confirmLabel: 'Continue'
            });
            return normalized;
        }

        if (typeof global.showPortalAlert === 'function') {
            void global.showPortalAlert(normalized.message, normalized.title);
            return normalized;
        }

        console.warn('[RIFT] Update underway notice (portal alert unavailable):', normalized.title, normalized.message);
        return normalized;
    }

    async function handleRiftApiFailure(response, payload, fallbackTitle) {
        if (isServerUpdateDowntime(response, payload, null)) {
            const normalized = await showRiftUpdateUnderwayNotice(fallbackTitle);
            if (isUpdateGateway502Response(response)) {
                triggerUpdateGateway502Refresh();
            }
            return normalized;
        }

        const merged = payload && typeof payload === 'object'
            ? payload
            : { message: fallbackTitle || 'Request failed.' };

        if (response && !merged.code && merged.message) {
            merged.code = resolveErrorCode(merged.message);
        }

        if ((merged.code === 'NEXUS-GAME-011' || merged.requiresTermsAcceptance)
            && typeof global.isTermsLockBypassedForDev === 'function'
            && global.isTermsLockBypassedForDev()) {
            return merged;
        }

        return showRiftError(merged, fallbackTitle);
    }

    async function showRiftNetworkError(fallbackTitle) {
        if (typeof global.shouldSuppressRepeatedLocalDevApiWarnings === 'function'
            && global.shouldSuppressRepeatedLocalDevApiWarnings()) {
            return normalizeErrorPayload({ code: 'RIFT-NET-001' }, fallbackTitle || 'Connection error');
        }
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

    startStandalone502GatewayAutoRefresh();

    function initUpdateNoticeRuntime() {
        startDeployWatch();
        global.setTimeout(() => void checkUpdateRecoveryOnLoad(), 400);
    }

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', initUpdateNoticeRuntime, { once: true });
    } else {
        initUpdateNoticeRuntime();
    }
})(window);

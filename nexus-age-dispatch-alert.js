/**
 * NEXUS — Age Emergency Dispatch alerts (nation-wide SF / border / drop signals).
 */
'use strict';

const DISPATCH_ALERT_TYPES = ['rally', 'border', 'drop'];
const DISPATCH_ALERT_DURATION_MS = 60 * 1000;

function isDispatchAlertType(value) {
    return DISPATCH_ALERT_TYPES.includes(String(value || '').trim());
}

function normalizeDispatchAlert(raw, nowMs = Date.now()) {
    if (!raw || typeof raw !== 'object') return null;

    const type = isDispatchAlertType(raw.type) ? String(raw.type).trim() : null;
    if (!type) return null;

    const alertId = String(raw.alertId || '').trim().slice(0, 80);
    const triggeredAt = String(raw.triggeredAt || '').trim();
    const expiresAt = String(raw.expiresAt || '').trim();
    const expiresMs = Date.parse(expiresAt);

    if (!alertId || !Number.isFinite(expiresMs) || expiresMs <= nowMs) {
        return null;
    }

    return {
        alertId,
        type,
        triggeredAt: triggeredAt || new Date(nowMs).toISOString(),
        expiresAt,
        triggeredBy: String(raw.triggeredBy || '').trim().slice(0, 80) || null
    };
}

function buildDispatchAlert(type, actorUsername) {
    const now = new Date();
    const expires = new Date(now.getTime() + DISPATCH_ALERT_DURATION_MS);

    return {
        alertId: `dispatch-${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`,
        type,
        triggeredAt: now.toISOString(),
        expiresAt: expires.toISOString(),
        triggeredBy: String(actorUsername || '').trim().slice(0, 80) || null
    };
}

function formatDispatchAlertSystemMessage(alert, actorUsername) {
    const actor = String(actorUsername || alert?.triggeredBy || '').trim();
    const bySuffix = actor ? ` — ${actor}` : '';

    if (alert?.type === 'rally') {
        return `EMERGENCY DISPATCH: Rally Troops! Nation leadership is ready to start SFs. Assemble now${bySuffix}.`;
    }
    if (alert?.type === 'border') {
        return `EMERGENCY DISPATCH: PvP alert! Hostile forces may be at our borders — prepare for combat${bySuffix}.`;
    }
    if (alert?.type === 'drop') {
        return `EMERGENCY DISPATCH: Drop alert! A nation drop is planned or imminent${bySuffix}.`;
    }

    return `EMERGENCY DISPATCH activated${bySuffix}.`;
}

function applyDispatchAlertPatch(currentState, alertType, actorUsername, access, nowMs = Date.now()) {
    if (!access?.council) {
        return { errorCode: 'HQ_COUNCIL_REQUIRED' };
    }

    if (!isDispatchAlertType(alertType)) {
        return { errorCode: 'HQ_DISPATCH_TYPE_INVALID' };
    }

    const activeAlert = getActiveDispatchAlert(currentState, nowMs);
    if (activeAlert) {
        return { errorCode: 'HQ_DISPATCH_ACTIVE', activeAlert };
    }

    const alert = buildDispatchAlert(alertType, actorUsername);
    return {
        dispatchAlert: alert,
        systemMessageText: formatDispatchAlertSystemMessage(alert, actorUsername)
    };
}

function getActiveDispatchAlert(nationState, nowMs = Date.now()) {
    return normalizeDispatchAlert(nationState?.dispatchAlert, nowMs);
}

module.exports = {
    DISPATCH_ALERT_TYPES,
    DISPATCH_ALERT_DURATION_MS,
    isDispatchAlertType,
    normalizeDispatchAlert,
    buildDispatchAlert,
    formatDispatchAlertSystemMessage,
    applyDispatchAlertPatch,
    getActiveDispatchAlert
};

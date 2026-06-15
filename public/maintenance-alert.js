/**
 * Developer maintenance alert — fixed banner while active.
 * Server: GET/POST /api/portal/maintenance-alert (POST requires X-Dev-Key, default local-dev-maintenance)
 *
 * Browser console (local dev):
 *   DeveloperMaintenanceAlert.activate('We are patching chat.', 'Today 3:00–4:00 PM EST');
 *   DeveloperMaintenanceAlert.deactivate();
 */

const MAINTENANCE_ALERT_POLL_MS = 60000;
const MAINTENANCE_ALERT_DEFAULT_DEV_KEY = 'local-dev-maintenance';

const PORTAL_EARLY_ACCESS_MAINTENANCE = {
    active: true,
    title: 'Site under active development',
    message: 'Royal Armies is still being built. You may hit brief outages, broken pages, or restarts while we finish the main website and game portal. Thanks for your patience during early access.',
    windowLabel: 'Expect occasional downtime until the main site launch is complete.'
};

function resolveMaintenanceAlertApiUrl(path) {
    if (typeof resolveRoyalArmiesApiUrl === 'function') {
        return resolveRoyalArmiesApiUrl(path);
    }
    return path;
}

function hasMaintenanceAlertBarElement() {
    return !!document.getElementById('developer-maintenance-alert-bar');
}

function isMaintenanceAlertPayloadActive(payload) {
    const data = payload || {};
    return data.active === true && String(data.message || '').trim().length > 0;
}

function normalizeMaintenanceAlertPayload(raw) {
    if (!raw || typeof raw !== 'object') {
        return {};
    }
    const { status, ...rest } = raw;
    return rest;
}

function resolveMaintenanceAlertPayload(payload) {
    const data = normalizeMaintenanceAlertPayload(payload);
    if (isMaintenanceAlertPayloadActive(data)) {
        return data;
    }
    if (data.active === false) {
        return data;
    }
    if (hasMaintenanceAlertBarElement()) {
        return { ...PORTAL_EARLY_ACCESS_MAINTENANCE };
    }
    return data;
}

let maintenanceAlertPollTimer = null;
let maintenanceAlertLastPayload = null;
let maintenanceAlertInitialized = false;
let maintenanceAlertRefreshGeneration = 0;
let maintenanceAlertResizeBound = false;
let maintenanceAlertVisibilityBound = false;

function getMaintenanceAlertElements() {
    return {
        bar: document.getElementById('developer-maintenance-alert-bar'),
        title: document.getElementById('developer-maintenance-alert-title'),
        message: document.getElementById('developer-maintenance-alert-message'),
        windowLabel: document.getElementById('developer-maintenance-alert-window')
    };
}

function isMainPortalMobileMaintenanceLayout() {
    return window.matchMedia('(max-width: 1024px)').matches;
}

function isAgePageMaintenanceLayout() {
    return document.body && document.body.id === 'age-page-canvas';
}

function syncMaintenanceAlertPageOffset(barEl) {
    const height = barEl && !barEl.hidden ? Math.ceil(barEl.getBoundingClientRect().height) : 0;
    const onMainPortal = document.body && document.body.id === 'main-dashboard-canvas';

    if (onMainPortal && isMainPortalMobileMaintenanceLayout()) {
        document.documentElement.style.setProperty('--developer-maintenance-alert-offset', '0px');
        document.body.classList.toggle('developer-maintenance-alert-active', height > 0);
        return;
    }

    if (isAgePageMaintenanceLayout()) {
        document.documentElement.style.setProperty('--developer-maintenance-alert-offset', '0px');
        document.body.classList.toggle('developer-maintenance-alert-active', height > 0);
        return;
    }

    document.documentElement.style.setProperty('--developer-maintenance-alert-offset', `${height}px`);
    document.body.classList.toggle('developer-maintenance-alert-active', height > 0);
}

function applyDeveloperMaintenanceAlert(payload) {
    const { bar, title, message, windowLabel } = getMaintenanceAlertElements();
    if (!bar) return;

    const data = payload || {};
    const isActive = isMaintenanceAlertPayloadActive(data);
    maintenanceAlertLastPayload = isActive ? data : maintenanceAlertLastPayload;

    if (!isActive) {
        bar.hidden = true;
        bar.setAttribute('aria-hidden', 'true');
        syncMaintenanceAlertPageOffset(null);
        return;
    }

    maintenanceAlertLastPayload = data;

    if (title) {
        title.textContent = data.title || PORTAL_EARLY_ACCESS_MAINTENANCE.title;
    }
    if (message) {
        message.textContent = data.message;
    }
    if (windowLabel) {
        const windowText = String(data.windowLabel || '').trim();
        if (windowText) {
            windowLabel.textContent = windowText;
            windowLabel.hidden = false;
        } else {
            windowLabel.textContent = '';
            windowLabel.hidden = true;
        }
    }

    bar.hidden = false;
    bar.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => syncMaintenanceAlertPageOffset(bar));
}

function primeMaintenanceAlertBanner() {
    if (hasMaintenanceAlertBarElement()) {
        applyDeveloperMaintenanceAlert(PORTAL_EARLY_ACCESS_MAINTENANCE);
    }
}

async function fetchDeveloperMaintenanceAlert() {
    const response = await fetch(resolveMaintenanceAlertApiUrl('/api/portal/maintenance-alert'), { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Maintenance alert fetch failed (${response.status})`);
    }

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
        throw new Error('Maintenance alert response was not JSON (use node server.js, not a static-only host)');
    }

    const payload = await response.json();
    if (typeof payload.active !== 'boolean') {
        throw new Error('Maintenance alert payload missing active flag');
    }

    return normalizeMaintenanceAlertPayload(payload);
}

async function refreshDeveloperMaintenanceAlert() {
    const generation = ++maintenanceAlertRefreshGeneration;

    try {
        const payload = await fetchDeveloperMaintenanceAlert();
        if (generation !== maintenanceAlertRefreshGeneration) {
            return maintenanceAlertLastPayload;
        }

        const resolved = resolveMaintenanceAlertPayload(payload);
        applyDeveloperMaintenanceAlert(resolved);
        return resolved;
    } catch (err) {
        if (generation !== maintenanceAlertRefreshGeneration) {
            return maintenanceAlertLastPayload;
        }
        if (typeof shouldSuppressRepeatedLocalDevApiWarnings === 'function' && shouldSuppressRepeatedLocalDevApiWarnings()) {
            return maintenanceAlertLastPayload;
        }
        console.warn('Developer maintenance alert unavailable:', err.message);
        if (maintenanceAlertLastPayload && isMaintenanceAlertPayloadActive(maintenanceAlertLastPayload)) {
            applyDeveloperMaintenanceAlert(maintenanceAlertLastPayload);
            return maintenanceAlertLastPayload;
        }
        if (hasMaintenanceAlertBarElement()) {
            applyDeveloperMaintenanceAlert(PORTAL_EARLY_ACCESS_MAINTENANCE);
            return PORTAL_EARLY_ACCESS_MAINTENANCE;
        }
        applyDeveloperMaintenanceAlert({ active: false });
        return null;
    }
}

async function postDeveloperMaintenanceAlert(patch, devKey) {
    const response = await fetch(resolveMaintenanceAlertApiUrl('/api/portal/maintenance-alert'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Dev-Key': devKey || MAINTENANCE_ALERT_DEFAULT_DEV_KEY
        },
        body: JSON.stringify(patch || {})
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.message || `Maintenance alert update failed (${response.status})`);
    }

    maintenanceAlertRefreshGeneration += 1;
    const resolved = resolveMaintenanceAlertPayload(normalizeMaintenanceAlertPayload(payload));
    applyDeveloperMaintenanceAlert(resolved);
    return maintenanceAlertLastPayload;
}

function bindMaintenanceAlertVisibilityRefresh() {
    if (maintenanceAlertVisibilityBound) return;
    maintenanceAlertVisibilityBound = true;

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            refreshDeveloperMaintenanceAlert();
        }
    });

    window.addEventListener('focus', () => {
        refreshDeveloperMaintenanceAlert();
    });
}

function initializeDeveloperMaintenanceAlert() {
    if (maintenanceAlertInitialized) {
        return;
    }
    maintenanceAlertInitialized = true;

    primeMaintenanceAlertBanner();
    refreshDeveloperMaintenanceAlert();

    if (maintenanceAlertPollTimer) {
        clearInterval(maintenanceAlertPollTimer);
    }
    maintenanceAlertPollTimer = setInterval(refreshDeveloperMaintenanceAlert, MAINTENANCE_ALERT_POLL_MS);

    if (!maintenanceAlertResizeBound) {
        maintenanceAlertResizeBound = true;
        window.addEventListener('resize', () => {
            const { bar } = getMaintenanceAlertElements();
            if (bar && !bar.hidden) {
                syncMaintenanceAlertPageOffset(bar);
            }
        });
    }

    bindMaintenanceAlertVisibilityRefresh();
}

const DeveloperMaintenanceAlert = {
    refresh: refreshDeveloperMaintenanceAlert,
    configure: (patch, devKey) => postDeveloperMaintenanceAlert(patch, devKey),
    activate: (message, windowLabel, title) => postDeveloperMaintenanceAlert({
        active: true,
        dismissed: false,
        title: title || PORTAL_EARLY_ACCESS_MAINTENANCE.title,
        message: message || PORTAL_EARLY_ACCESS_MAINTENANCE.message,
        windowLabel: windowLabel || PORTAL_EARLY_ACCESS_MAINTENANCE.windowLabel
    }),
    deactivate: () => postDeveloperMaintenanceAlert({ active: false, dismissed: true }),
    getLastPayload: () => maintenanceAlertLastPayload
};

window.initializeDeveloperMaintenanceAlert = initializeDeveloperMaintenanceAlert;
window.DeveloperMaintenanceAlert = DeveloperMaintenanceAlert;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDeveloperMaintenanceAlert);
} else {
    initializeDeveloperMaintenanceAlert();
}

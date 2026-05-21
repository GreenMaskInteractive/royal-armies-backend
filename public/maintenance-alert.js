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

let maintenanceAlertPollTimer = null;
let maintenanceAlertLastPayload = null;

function getMaintenanceAlertElements() {
    return {
        bar: document.getElementById('developer-maintenance-alert-bar'),
        title: document.getElementById('developer-maintenance-alert-title'),
        message: document.getElementById('developer-maintenance-alert-message'),
        windowLabel: document.getElementById('developer-maintenance-alert-window')
    };
}

function syncMaintenanceAlertPageOffset(barEl) {
    const height = barEl && !barEl.hidden ? Math.ceil(barEl.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty('--developer-maintenance-alert-offset', `${height}px`);
    document.body.classList.toggle('developer-maintenance-alert-active', height > 0);
}

function applyDeveloperMaintenanceAlert(payload) {
    const { bar, title, message, windowLabel } = getMaintenanceAlertElements();
    if (!bar) return;

    const data = payload || {};
    const isActive = data.active === true && String(data.message || '').trim().length > 0;
    maintenanceAlertLastPayload = data;

    if (!isActive) {
        bar.hidden = true;
        bar.setAttribute('aria-hidden', 'true');
        syncMaintenanceAlertPageOffset(null);
        return;
    }

    if (title) {
        title.textContent = data.title || 'Scheduled maintenance';
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

async function fetchDeveloperMaintenanceAlert() {
    const response = await fetch('/api/portal/maintenance-alert', { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Maintenance alert fetch failed (${response.status})`);
    }
    return response.json();
}

async function refreshDeveloperMaintenanceAlert() {
    try {
        const payload = await fetchDeveloperMaintenanceAlert();
        applyDeveloperMaintenanceAlert(payload);
        return payload;
    } catch (err) {
        console.warn('Developer maintenance alert unavailable:', err.message);
        applyDeveloperMaintenanceAlert({ active: false });
        return null;
    }
}

async function postDeveloperMaintenanceAlert(patch, devKey) {
    const response = await fetch('/api/portal/maintenance-alert', {
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

    applyDeveloperMaintenanceAlert(payload);
    return payload;
}

function initializeDeveloperMaintenanceAlert() {
    refreshDeveloperMaintenanceAlert();

    if (maintenanceAlertPollTimer) {
        clearInterval(maintenanceAlertPollTimer);
    }
    maintenanceAlertPollTimer = setInterval(refreshDeveloperMaintenanceAlert, MAINTENANCE_ALERT_POLL_MS);

    window.addEventListener('resize', () => {
        const { bar } = getMaintenanceAlertElements();
        if (bar && !bar.hidden) {
            syncMaintenanceAlertPageOffset(bar);
        }
    });
}

const DeveloperMaintenanceAlert = {
    refresh: refreshDeveloperMaintenanceAlert,
    configure: (patch, devKey) => postDeveloperMaintenanceAlert(patch, devKey),
    activate: (message, windowLabel, title) => postDeveloperMaintenanceAlert({
        active: true,
        title: title || 'Scheduled maintenance',
        message: message || 'The site will be briefly unavailable while we apply fixes and updates.',
        windowLabel: windowLabel || ''
    }),
    deactivate: () => postDeveloperMaintenanceAlert({ active: false }),
    getLastPayload: () => maintenanceAlertLastPayload
};

window.initializeDeveloperMaintenanceAlert = initializeDeveloperMaintenanceAlert;
window.DeveloperMaintenanceAlert = DeveloperMaintenanceAlert;

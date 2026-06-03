/**
 * RIFT — Emergency Dispatch alerts (nation-wide border pulse + system chat).
 */
(function initAgeDispatchAlert(global) {
    'use strict';

    const POLL_MS = 2500;
    const ALERT_DURATION_MS = 60 * 1000;
    const DISPATCH_ALERT_TYPES = new Set(['rally', 'border', 'drop']);

    let borderEl = null;
    let pollTimer = null;
    let clearTimer = null;
    let buttonUnlockTimer = null;
    let bound = false;
    let sessionEnabled = false;
    let lastHandledAlertId = '';
    let activeAlertId = '';
    let dispatchPanelLocked = false;
    let dismissedAlertIds = new Set();
    let dismissBtnEl = null;

    function resolveApiUrl(path) {
        if (typeof global.resolveRoyalArmiesApiUrl === 'function') {
            return global.resolveRoyalArmiesApiUrl(path);
        }
        return path;
    }

    function resolveUsername() {
        const saved = global.localStorage.getItem('activeCommanderUser');
        if (saved && saved.trim()) return saved.trim();
        if (typeof global.getActiveCommanderUsername === 'function') {
            return String(global.getActiveCommanderUsername() || '').trim();
        }
        return '';
    }

    function isAgePageActive() {
        if (typeof global.isOfficialAgePageActive === 'function') {
            return global.isOfficialAgePageActive();
        }
        return Boolean(global.document.getElementById('age-page-canvas'));
    }

    /** Local dev only (localhost / Live Server) — not royalarmies.com production. */
    function isDevDispatchBypass(username) {
        if (typeof global.isProductionRoyalArmiesHost === 'function' && global.isProductionRoyalArmiesHost()) {
            return false;
        }
        if (typeof global.isLocalDevelopmentHost === 'function' && !global.isLocalDevelopmentHost()) {
            return false;
        }

        const normalized = String(username || '').trim().toLowerCase();
        if (normalized !== 'caleb_admin') return false;

        const port = String(global.location?.port || '');
        if (!['3000', '5500', ''].includes(port)) return false;

        const devMode = typeof global.getLocalDevViewMode === 'function'
            ? global.getLocalDevViewMode()
            : 'owner';
        return devMode === 'owner';
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

    function buildLocalDispatchAlert(alertType, username) {
        const now = Date.now();
        return {
            alertId: `local-dispatch-${now}-${alertType}`,
            type: alertType,
            triggeredAt: new Date(now).toISOString(),
            expiresAt: new Date(now + ALERT_DURATION_MS).toISOString(),
            triggeredBy: username || null
        };
    }

    function getDispatchButtons() {
        return Array.from(
            global.document.querySelectorAll('#age-hq-dispatch-panel [data-dispatch-alert]')
        );
    }

    function setDispatchPanelNote(text, isError) {
        const note = global.document.getElementById('age-hq-dispatch-panel-note');
        if (!note) return;
        note.textContent = text;
        note.classList.toggle('is-error', Boolean(isError));
    }

    function lockDispatchPanel(alert) {
        const expiresMs = Date.parse(alert?.expiresAt || '');
        if (!alert || !DISPATCH_ALERT_TYPES.has(alert.type) || !Number.isFinite(expiresMs)) return;

        dispatchPanelLocked = true;
        getDispatchButtons().forEach((button) => {
            const type = button.getAttribute('data-dispatch-alert') || '';
            button.disabled = true;
            button.classList.add('is-cooling-down');
            button.classList.toggle('is-dispatch-active', type === alert.type);
            button.setAttribute('aria-disabled', 'true');
        });

        if (buttonUnlockTimer) {
            global.clearTimeout(buttonUnlockTimer);
        }

        const remainingMs = Math.max(0, expiresMs - Date.now());
        buttonUnlockTimer = global.setTimeout(unlockDispatchButtons, remainingMs + 50);
    }

    function unlockDispatchButtons() {
        dispatchPanelLocked = false;
        if (buttonUnlockTimer) {
            global.clearTimeout(buttonUnlockTimer);
            buttonUnlockTimer = 0;
        }

        getDispatchButtons().forEach((button) => {
            button.disabled = false;
            button.classList.remove('is-cooling-down', 'is-dispatch-active');
            button.removeAttribute('aria-disabled');
        });
    }

    function ensureBorderOverlay() {
        if (borderEl) return borderEl;

        borderEl = global.document.getElementById('age-dispatch-alert-border');
        if (!borderEl) {
            borderEl = global.document.createElement('div');
            borderEl.id = 'age-dispatch-alert-border';
            borderEl.className = 'age-dispatch-alert-border';
            borderEl.setAttribute('aria-hidden', 'true');
            global.document.body.appendChild(borderEl);
        }
        return borderEl;
    }

    function playDispatchAlertSound(type) {
        /* SFX assets will be wired to these alert types later. */
        global.dispatchEvent(new CustomEvent('royalarmies:dispatch-alert-sound', {
            detail: { type: String(type || '') }
        }));
    }

    function dismissAlertLabel(type) {
        if (type === 'rally') return 'Dismiss Rally Alert';
        if (type === 'border') return 'Dismiss PvP Alert';
        if (type === 'drop') return 'Dismiss Drop Alert';
        return 'Dismiss Alert';
    }

    function ensureDismissButton() {
        if (dismissBtnEl) return dismissBtnEl;

        dismissBtnEl = global.document.getElementById('age-dispatch-alert-dismiss');
        if (!dismissBtnEl) {
            const host = ensureBorderOverlay();
            dismissBtnEl = global.document.createElement('button');
            dismissBtnEl.type = 'button';
            dismissBtnEl.id = 'age-dispatch-alert-dismiss';
            dismissBtnEl.className = 'age-dispatch-alert-dismiss';
            dismissBtnEl.setAttribute('aria-label', 'Dismiss emergency dispatch alert');
            dismissBtnEl.textContent = 'Dismiss Alert';
            host.appendChild(dismissBtnEl);
        }
        return dismissBtnEl;
    }

    function showDismissButton(alert) {
        const button = ensureDismissButton();
        if (!button || !alert) return;

        button.textContent = dismissAlertLabel(alert.type);
        button.classList.remove(
            'age-dispatch-alert-dismiss--rally',
            'age-dispatch-alert-dismiss--border',
            'age-dispatch-alert-dismiss--drop'
        );
        button.classList.add(`age-dispatch-alert-dismiss--${alert.type}`);
        button.hidden = false;
        button.removeAttribute('hidden');
    }

    function hideDismissButton() {
        const button = ensureDismissButton();
        if (!button) return;
        button.hidden = true;
        button.setAttribute('hidden', '');
        button.classList.remove(
            'age-dispatch-alert-dismiss--rally',
            'age-dispatch-alert-dismiss--border',
            'age-dispatch-alert-dismiss--drop'
        );
    }

    function hideAlertVisualOnly() {
        const node = ensureBorderOverlay();
        node.hidden = true;
        node.setAttribute('aria-hidden', 'true');
        node.classList.remove(
            'age-dispatch-alert-border--rally',
            'age-dispatch-alert-border--border',
            'age-dispatch-alert-border--drop',
            'is-active'
        );
        hideDismissButton();
    }

    function dismissActiveAlertVisual() {
        if (!activeAlertId) return;
        dismissedAlertIds.add(activeAlertId);
        if (clearTimer) {
            global.clearTimeout(clearTimer);
            clearTimer = 0;
        }
        hideAlertVisualOnly();
    }

    function onAlertExpired() {
        activeAlertId = '';
        hideAlertVisualOnly();
        unlockDispatchButtons();
    }

    function hideBorderPulse() {
        if (clearTimer) {
            global.clearTimeout(clearTimer);
            clearTimer = 0;
        }
        onAlertExpired();
    }

    function showBorderPulse(alert, options = {}) {
        if (!alert || !DISPATCH_ALERT_TYPES.has(alert.type)) return;

        const expiresMs = Date.parse(alert.expiresAt || '');
        if (!Number.isFinite(expiresMs)) return;

        const remainingMs = expiresMs - Date.now();
        if (remainingMs <= 0) {
            hideBorderPulse();
            return;
        }

        if (alert.alertId && dismissedAlertIds.has(alert.alertId)) {
            activeAlertId = alert.alertId;
            return;
        }

        const isSameAlert = Boolean(alert.alertId && alert.alertId === activeAlertId);
        activeAlertId = alert.alertId || activeAlertId || '';

        const node = ensureBorderOverlay();
        node.classList.remove(
            'age-dispatch-alert-border--rally',
            'age-dispatch-alert-border--border',
            'age-dispatch-alert-border--drop'
        );
        node.classList.add(`age-dispatch-alert-border--${alert.type}`, 'is-active');
        node.hidden = false;
        node.removeAttribute('hidden');
        node.setAttribute('aria-hidden', 'false');

        if (!isSameAlert && alert.alertId && alert.alertId !== lastHandledAlertId) {
            lastHandledAlertId = alert.alertId;
            if (options.playSound !== false) {
                playDispatchAlertSound(alert.type);
            }
        }

        if (clearTimer) {
            global.clearTimeout(clearTimer);
        }
        clearTimer = global.setTimeout(onAlertExpired, remainingMs + 50);

        showDismissButton(alert);
    }

    function syncDispatchPanelFromAlert(alert) {
        if (!alert) {
            if (!activeAlertId) {
                unlockDispatchButtons();
            }
            return;
        }

        const expiresMs = Date.parse(alert.expiresAt || '');
        if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) {
            hideBorderPulse();
            return;
        }

        lockDispatchPanel(alert);
    }

    function handleIncomingAlert(alert) {
        if (!alert) {
            hideBorderPulse();
            return;
        }

        syncDispatchPanelFromAlert(alert);

        if (alert.alertId && dismissedAlertIds.has(alert.alertId)) {
            activeAlertId = alert.alertId;
            return;
        }

        showBorderPulse(alert, { playSound: true });
    }

    async function refreshDispatchAlert() {
        const username = resolveUsername();
        if (!username || !isAgePageActive()) {
            return null;
        }

        try {
            const response = await global.fetch(
                resolveApiUrl(`/api/portal/age/dispatch-alert?username=${encodeURIComponent(username)}`),
                { credentials: 'same-origin', cache: 'no-store' }
            );

            if (response.status === 404 && isDevDispatchBypass(username)) {
                return null;
            }

            const payload = await response.json();
            if (!response.ok || payload?.status !== 'ok') {
                throw new Error(payload?.code || `dispatch-alert ${response.status}`);
            }

            handleIncomingAlert(payload.alert || null);
            return payload.alert || null;
        } catch (error) {
            console.warn('[RIFT] Dispatch alert sync failed:', error.message);
            return null;
        }
    }

    async function applyDispatchAlertResult(alert, options = {}) {
        if (!alert) return null;

        lastHandledAlertId = options.forceSound ? '' : lastHandledAlertId;
        handleIncomingAlert(alert);

        if (options.systemMessageText && typeof global.RoyalArmiesGameChat?.appendSystemEvent === 'function') {
            await global.RoyalArmiesGameChat.appendSystemEvent(options.systemMessageText);
        } else if (typeof global.RoyalArmiesGameChat?.refresh === 'function') {
            global.RoyalArmiesGameChat.refresh();
        }

        return alert;
    }

    async function triggerDispatchAlert(alertType, triggerButton) {
        void triggerButton;

        const username = resolveUsername();
        if (!username) {
            setDispatchPanelNote('Sign in to send dispatch alerts.', true);
            return null;
        }

        if (dispatchPanelLocked) {
            return null;
        }

        let alert = null;
        let usedDevFallback = false;

        try {
            const response = await global.fetch(resolveApiUrl('/api/portal/age/dispatch-alert'), {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, alertType })
            });

            const payload = await response.json().catch(() => ({}));

            if (response.status === 409 && payload?.alert) {
                handleIncomingAlert(payload.alert);
                setDispatchPanelNote('A dispatch alert is already active for your nation.', false);
                return payload.alert;
            }

            if (response.ok && payload?.status === 'ok' && payload.alert) {
                const alert = payload.alert;
                await applyDispatchAlertResult(alert, {
                    forceSound: true,
                    systemMessageText: payload.systemMessage ? null : formatDispatchAlertSystemMessage(alert, username)
                });
                if (payload.systemMessage && typeof global.RoyalArmiesGameChat?.refresh === 'function') {
                    global.RoyalArmiesGameChat.refresh();
                }
                setDispatchPanelNote('Triggers a 60-second nation-wide alert on all Age views.', false);
                return alert;
            }

            if (isDevDispatchBypass(username)) {
                usedDevFallback = true;
            } else {
                throw new Error(payload?.code || payload?.message || `dispatch-alert ${response.status}`);
            }
        } catch (error) {
            if (!isDevDispatchBypass(username)) {
                console.warn('[RIFT] Dispatch alert trigger failed:', error.message);
                setDispatchPanelNote('Unable to send dispatch alert. Restart NEXUS if this route is new.', true);
                if (!dispatchPanelLocked) {
                    unlockDispatchButtons();
                }
                return null;
            }
            usedDevFallback = true;
        }

        if (usedDevFallback) {
            alert = buildLocalDispatchAlert(alertType, username);
            console.warn('[RIFT] Using dev dispatch alert fallback. Restart NEXUS (node server.js) for server-backed alerts.');
            await applyDispatchAlertResult(alert, {
                forceSound: true,
                systemMessageText: formatDispatchAlertSystemMessage(alert, username)
            });
            setDispatchPanelNote('Dev fallback alert active locally. Restart NEXUS for live nation sync.', false);
        }

        return alert;
    }

    function startPolling() {
        if (pollTimer) return;
        pollTimer = global.setInterval(refreshDispatchAlert, POLL_MS);
    }

    function stopPolling() {
        if (pollTimer) {
            global.clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    function bindControls() {
        if (bound) return;
        bound = true;

        global.document.getElementById('age-hq-dispatch-panel')?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-dispatch-alert]');
            if (!button || button.disabled || dispatchPanelLocked) return;
            const alertType = button.getAttribute('data-dispatch-alert');
            if (!DISPATCH_ALERT_TYPES.has(alertType)) return;
            event.preventDefault();
            triggerDispatchAlert(alertType, button);
        });

        ensureDismissButton()?.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            dismissActiveAlertVisual();
        });
    }

    async function enableAgeDispatchAlert() {
        bindControls();
        ensureBorderOverlay();

        if (!isAgePageActive()) return;

        if (sessionEnabled) {
            await refreshDispatchAlert();
            return;
        }

        sessionEnabled = true;
        await refreshDispatchAlert();
        startPolling();
    }

    function disableAgeDispatchAlert() {
        sessionEnabled = false;
        stopPolling();
        hideBorderPulse();
        lastHandledAlertId = '';
        dismissedAlertIds.clear();
    }

    global.RoyalArmiesAgeDispatchAlert = {
        enable: enableAgeDispatchAlert,
        disable: disableAgeDispatchAlert,
        refresh: refreshDispatchAlert,
        trigger: triggerDispatchAlert
    };
    global.enableAgeDispatchAlert = enableAgeDispatchAlert;

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', bindControls);
    } else {
        bindControls();
    }
})(window);

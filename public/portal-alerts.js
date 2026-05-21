/**
 * Royal Armies — in-game alert / confirm dialogs (replaces window.alert & window.confirm).
 */
(function initRoyalArmiesPortalAlerts() {
    'use strict';

    let portalAlertResolve = null;
    let portalAlertBackdropBound = false;

    function escapePortalAlertHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function normalizePortalAlertMessage(message) {
        return String(message ?? '');
    }

    function ensurePortalAlertShell() {
        if (document.getElementById('royal-armies-portal-alert-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'royal-armies-portal-alert-modal';
        modal.className = 'main-portal-modal-hidden';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-hidden', 'true');
        modal.style.setProperty('display', 'none', 'important');
        modal.innerHTML = `
            <div class="portal-overlay-modal-bezel portal-alert-bezel bordered-modal-panel">
                <h3 id="portal-alert-title" class="modal-alert-header portal-alert-header--info">Notice</h3>
                <p id="portal-alert-body" class="modal-alert-body"></p>
                <div id="portal-alert-actions" class="modal-action-btn-row"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    function bindPortalAlertModalEvents(modal) {
        if (portalAlertBackdropBound) return;
        portalAlertBackdropBound = true;

        modal.addEventListener('click', (event) => {
            if (event.target === modal && modal.dataset.mode === 'confirm') {
                closePortalAlertModal(false);
            }
        });

        document.addEventListener('keydown', (event) => {
            if (modal.style.display === 'none' || modal.classList.contains('main-portal-modal-hidden')) return;
            if (event.key === 'Escape') {
                closePortalAlertModal(modal.dataset.mode === 'confirm' ? false : true);
            }
        });
    }

    function closePortalAlertModal(result) {
        const modal = document.getElementById('royal-armies-portal-alert-modal');
        if (!modal) return;

        modal.style.setProperty('display', 'none', 'important');
        modal.classList.add('main-portal-modal-hidden');
        modal.setAttribute('aria-hidden', 'true');

        if (portalAlertResolve) {
            const resolve = portalAlertResolve;
            portalAlertResolve = null;
            resolve(result);
        }
    }

    function openPortalAlertModal(config) {
        ensurePortalAlertShell();
        const modal = document.getElementById('royal-armies-portal-alert-modal');
        const titleEl = document.getElementById('portal-alert-title');
        const bodyEl = document.getElementById('portal-alert-body');
        const actionsEl = document.getElementById('portal-alert-actions');
        if (!modal || !titleEl || !bodyEl || !actionsEl) {
            return Promise.resolve(config.mode === 'confirm' ? false : undefined);
        }

        bindPortalAlertModalEvents(modal);

        return new Promise((resolve) => {
            portalAlertResolve = resolve;

            const isConfirm = config.mode === 'confirm';
            modal.dataset.mode = isConfirm ? 'confirm' : 'alert';

            titleEl.textContent = config.title || (isConfirm ? 'Confirm' : 'Notice');
            titleEl.className = `modal-alert-header ${isConfirm ? 'portal-alert-header--confirm' : 'portal-alert-header--info'}`;

            const message = normalizePortalAlertMessage(config.message);
            bodyEl.textContent = message;

            if (isConfirm) {
                actionsEl.innerHTML = `
                    <button type="button" class="modal-action-btn confirm" data-portal-alert-action="confirm">${escapePortalAlertHtml(config.confirmLabel || 'Confirm')}</button>
                    <button type="button" class="modal-action-btn cancel" data-portal-alert-action="cancel">${escapePortalAlertHtml(config.cancelLabel || 'Cancel')}</button>
                `;
            } else {
                actionsEl.innerHTML = `
                    <button type="button" class="modal-action-btn confirm portal-alert-ok-btn" data-portal-alert-action="confirm">${escapePortalAlertHtml(config.confirmLabel || 'OK')}</button>
                `;
            }

            actionsEl.querySelectorAll('[data-portal-alert-action]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const action = btn.getAttribute('data-portal-alert-action');
                    closePortalAlertModal(action === 'confirm');
                }, { once: true });
            });

            modal.classList.remove('main-portal-modal-hidden');
            modal.style.setProperty('display', 'flex', 'important');
            modal.setAttribute('aria-hidden', 'false');

            const primaryBtn = actionsEl.querySelector('[data-portal-alert-action="confirm"]');
            if (primaryBtn) primaryBtn.focus();
        });
    }

    function showPortalAlert(message, title) {
        return openPortalAlertModal({
            mode: 'alert',
            message,
            title: title || 'Notice',
            confirmLabel: 'OK'
        }).then(() => undefined);
    }

    function showPortalConfirm(message, options) {
        const opts = options && typeof options === 'object' ? options : {};
        return openPortalAlertModal({
            mode: 'confirm',
            message,
            title: opts.title || 'Confirm',
            confirmLabel: opts.confirmLabel || 'Confirm',
            cancelLabel: opts.cancelLabel || 'Cancel'
        });
    }

    window.showPortalAlert = showPortalAlert;
    window.showPortalConfirm = showPortalConfirm;
    window.closePortalAlertModal = closePortalAlertModal;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensurePortalAlertShell);
    } else {
        ensurePortalAlertShell();
    }
})();

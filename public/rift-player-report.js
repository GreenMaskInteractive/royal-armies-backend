/**
 * RIFT — Report a commander modal (portal + Age surfaces).
 */
(function initRoyalArmiesPlayerReport(global) {
    'use strict';

    const DETAILS_MIN = 20;
    const DETAILS_MAX = 2000;

    const REPORT_CATEGORIES = [
        { id: 'harassment', label: 'Harassment or bullying' },
        { id: 'hate_speech', label: 'Hate speech or slurs' },
        { id: 'cheating', label: 'Cheating or exploits' },
        { id: 'spam', label: 'Spam or scam attempts' },
        { id: 'impersonation', label: 'Impersonation or fraud' },
        { id: 'other', label: 'Other rule violation' }
    ];

    let pendingContext = null;
    let submitting = false;

    function resolveApiUrl(path) {
        if (typeof global.resolveApiUrl === 'function') {
            return global.resolveApiUrl(path);
        }
        return path;
    }

    function getActiveUsername() {
        if (typeof global.getActiveCommanderUsername === 'function') {
            const active = global.getActiveCommanderUsername();
            if (active && String(active).trim()) return String(active).trim();
        }
        return String(global.localStorage?.getItem('activeCommanderUser') || '').trim();
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getModalElements() {
        return {
            root: global.document.getElementById('player-report-modal'),
            scrim: global.document.querySelector('#player-report-modal .player-report-modal-scrim'),
            targetField: global.document.getElementById('player-report-target'),
            categoryField: global.document.getElementById('player-report-category'),
            detailsField: global.document.getElementById('player-report-details'),
            contextBlock: global.document.getElementById('player-report-context-block'),
            contextText: global.document.getElementById('player-report-context-text'),
            counter: global.document.getElementById('player-report-details-counter'),
            feedback: global.document.getElementById('player-report-feedback'),
            submitBtn: global.document.getElementById('player-report-submit-btn'),
            cancelBtn: global.document.getElementById('player-report-cancel-btn'),
            closeBtn: global.document.getElementById('player-report-close-btn')
        };
    }

    function setFeedback(message, isError) {
        const { feedback } = getModalElements();
        if (!feedback) return;
        if (!message) {
            feedback.hidden = true;
            feedback.textContent = '';
            feedback.classList.remove('is-error', 'is-success');
            return;
        }
        feedback.hidden = false;
        feedback.textContent = message;
        feedback.classList.toggle('is-error', !!isError);
        feedback.classList.toggle('is-success', !isError);
    }

    function updateDetailsCounter() {
        const { detailsField, counter, submitBtn } = getModalElements();
        if (!detailsField || !counter) return;

        const length = String(detailsField.value || '').trim().length;
        counter.textContent = `${length} / ${DETAILS_MAX} (minimum ${DETAILS_MIN})`;
        counter.classList.toggle('is-valid', length >= DETAILS_MIN);
        counter.classList.toggle('is-invalid', length > 0 && length < DETAILS_MIN);

        if (submitBtn) {
            const category = String(getModalElements().categoryField?.value || '').trim();
            submitBtn.disabled = submitting || !category || length < DETAILS_MIN;
            submitBtn.setAttribute('aria-disabled', submitBtn.disabled ? 'true' : 'false');
        }
    }

    function populateCategoryOptions(selectedId) {
        const { categoryField } = getModalElements();
        if (!categoryField) return;

        categoryField.innerHTML = [
            '<option value="">Select a category…</option>',
            ...REPORT_CATEGORIES.map((entry) => (
                `<option value="${escapeHtml(entry.id)}"${entry.id === selectedId ? ' selected' : ''}>${escapeHtml(entry.label)}</option>`
            ))
        ].join('');
    }

    function renderContextBlock(contextLabel) {
        const { contextBlock, contextText } = getModalElements();
        const label = String(contextLabel || '').trim();
        if (!contextBlock || !contextText) return;

        if (!label) {
            contextBlock.hidden = true;
            contextText.textContent = '';
            return;
        }

        contextBlock.hidden = false;
        contextText.textContent = label;
    }

    function configureTargetField(targetField, targetUsername, allowTargetEntry) {
        if (!targetField) return;

        if (allowTargetEntry) {
            targetField.readOnly = false;
            targetField.removeAttribute('readonly');
            targetField.tabIndex = 0;
            targetField.placeholder = 'Commander username';
            targetField.value = targetUsername;
            targetField.setAttribute('aria-label', 'Commander to report');
            targetField.classList.add('player-report-field-input--editable');
        } else {
            targetField.readOnly = true;
            targetField.setAttribute('readonly', 'readonly');
            targetField.tabIndex = -1;
            targetField.removeAttribute('placeholder');
            targetField.value = targetUsername;
            targetField.setAttribute('aria-label', 'Commander');
            targetField.classList.remove('player-report-field-input--editable');
        }
    }

    function open(options = {}, clickEvent) {
        if (clickEvent) {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
        }

        const username = getActiveUsername();
        if (!username) {
            if (typeof global.showPortalAlert === 'function') {
                global.showPortalAlert('Sign in before reporting a commander.', 'Report a commander');
            }
            return;
        }

        const allowTargetEntry = Boolean(options.allowTargetEntry);
        const targetUsername = String(options.targetUsername || '').trim();

        if (!allowTargetEntry && !targetUsername) {
            if (typeof global.showPortalAlert === 'function') {
                global.showPortalAlert('No commander was selected for this report.', 'Report a commander');
            }
            return;
        }

        if (targetUsername && targetUsername.toLowerCase() === username.toLowerCase()) {
            if (typeof global.showRiftError === 'function') {
                global.showRiftError({ code: 'NEXUS-REPORT-002' });
            }
            return;
        }

        const { root, targetField, detailsField, submitBtn } = getModalElements();
        if (!root || !targetField || !detailsField) return;

        pendingContext = {
            targetUsername,
            allowTargetEntry,
            source: String(options.source || 'other').trim() || 'other',
            contextLabel: String(options.contextLabel || '').trim(),
            contextMeta: options.contextMeta && typeof options.contextMeta === 'object'
                ? options.contextMeta
                : {}
        };

        populateCategoryOptions('');
        configureTargetField(targetField, targetUsername, allowTargetEntry);
        detailsField.value = '';
        renderContextBlock(pendingContext.contextLabel);
        setFeedback('', false);
        submitting = false;

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.setAttribute('aria-disabled', 'true');
            submitBtn.textContent = 'Submit report';
        }

        root.hidden = false;
        root.setAttribute('aria-hidden', 'false');
        global.document.body.classList.add('player-report-modal-open');

        updateDetailsCounter();

        global.setTimeout(() => {
            const { categoryField } = getModalElements();
            if (allowTargetEntry && targetField) {
                targetField.focus();
                return;
            }
            if (categoryField) categoryField.focus();
        }, 0);
    }

    function openFromCommanderMenu(event) {
        open({
            allowTargetEntry: true,
            source: 'commander_menu',
            contextLabel: 'Commander menu'
        }, event);
    }

    function close(clickEvent) {
        if (clickEvent) {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
        }

        const { root } = getModalElements();
        if (!root) return;

        pendingContext = null;
        submitting = false;
        root.hidden = true;
        root.setAttribute('aria-hidden', 'true');
        global.document.body.classList.remove('player-report-modal-open');
        setFeedback('', false);
    }

    async function submit(clickEvent) {
        if (clickEvent) {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
        }
        if (submitting || !pendingContext) return;

        const username = getActiveUsername();
        if (!username) {
            setFeedback('Sign in before submitting a report.', true);
            return;
        }

        const { targetField, categoryField, detailsField, submitBtn } = getModalElements();
        const targetUsername = pendingContext.allowTargetEntry
            ? String(targetField?.value || '').trim()
            : String(pendingContext.targetUsername || '').trim();

        if (!targetUsername) {
            setFeedback('Enter the commander you are reporting.', true);
            if (targetField) targetField.focus();
            return;
        }

        if (targetUsername.toLowerCase() === username.toLowerCase()) {
            if (typeof global.showRiftError === 'function') {
                global.showRiftError({ code: 'NEXUS-REPORT-002' });
            } else {
                setFeedback('You cannot report your own account.', true);
            }
            return;
        }

        pendingContext.targetUsername = targetUsername;

        const category = String(categoryField?.value || '').trim();
        const details = String(detailsField?.value || '').trim();

        if (!category) {
            setFeedback('Choose a report category.', true);
            return;
        }
        if (details.length < DETAILS_MIN) {
            setFeedback(`Describe the incident in at least ${DETAILS_MIN} characters.`, true);
            return;
        }

        submitting = true;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.setAttribute('aria-disabled', 'true');
            submitBtn.textContent = 'Submitting…';
        }
        setFeedback('', false);

        try {
            const response = await global.fetch(resolveApiUrl('/api/portal/player-reports'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    username,
                    targetUsername: pendingContext.targetUsername,
                    category,
                    details,
                    source: pendingContext.source,
                    contextLabel: pendingContext.contextLabel,
                    contextMeta: pendingContext.contextMeta
                })
            });

            const payload = await response.json().catch(() => ({}));

            if (!response.ok || payload.status === 'error') {
                if (typeof global.showRiftError === 'function') {
                    await global.showRiftError(payload, 'Report a commander');
                } else {
                    setFeedback(payload.message || 'Could not submit report.', true);
                }
                submitting = false;
                if (submitBtn) {
                    submitBtn.textContent = 'Submit report';
                    updateDetailsCounter();
                }
                return;
            }

            setFeedback('Report submitted. Moderators will review it shortly.', false);
            if (submitBtn) submitBtn.textContent = 'Submitted';

            global.setTimeout(() => {
                close();
                if (typeof global.showPortalAlert === 'function') {
                    global.showPortalAlert(
                        'Thank you. Your report was sent to the moderation team.',
                        'Report received'
                    );
                }
            }, 700);
        } catch (_err) {
            submitting = false;
            if (typeof global.showRiftNetworkError === 'function') {
                global.showRiftNetworkError('Report a commander');
            } else {
                setFeedback('Cannot reach the server. Try again shortly.', true);
            }
            if (submitBtn) {
                submitBtn.textContent = 'Submit report';
                updateDetailsCounter();
            }
        }
    }

    function handleDocumentKeydown(event) {
        const { root } = getModalElements();
        if (!root || root.hidden) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
        }
    }

    function bindModalControls() {
        const {
            root,
            scrim,
            detailsField,
            categoryField,
            submitBtn,
            cancelBtn,
            closeBtn
        } = getModalElements();

        if (!root || root.dataset.playerReportBound === 'true') return;
        root.dataset.playerReportBound = 'true';

        scrim?.addEventListener('click', close);
        cancelBtn?.addEventListener('click', close);
        closeBtn?.addEventListener('click', close);
        submitBtn?.addEventListener('click', submit);
        detailsField?.addEventListener('input', updateDetailsCounter);
        categoryField?.addEventListener('change', updateDetailsCounter);

        global.document.addEventListener('keydown', handleDocumentKeydown);
        global.document.addEventListener('click', (event) => {
            const trigger = event.target.closest('[data-player-report-open]');
            if (!trigger) return;

            const targetUsername = String(
                trigger.getAttribute('data-player-report-target')
                || trigger.getAttribute('data-age-player-report')
                || ''
            ).trim();
            const source = String(trigger.getAttribute('data-player-report-source') || 'other').trim();
            const contextLabel = String(trigger.getAttribute('data-player-report-context') || '').trim();

            open({
                targetUsername,
                source,
                contextLabel
            }, event);
        });
    }

    function buildReportPlayerMenuButton(className, actionHandlerName) {
        const btn = global.document.createElement('button');
        btn.type = 'button';
        btn.className = className;
        btn.setAttribute('role', 'menuitem');
        btn.setAttribute('data-commander-menu-action', 'report-player');
        btn.textContent = 'Report a Player';
        btn.addEventListener('click', (event) => {
            if (actionHandlerName && typeof global[actionHandlerName] === 'function') {
                global[actionHandlerName]('report-player', event);
                return;
            }
            if (typeof global.portalDesktopCommanderMenuAction === 'function') {
                global.portalDesktopCommanderMenuAction('report-player', event);
            } else {
                openFromCommanderMenu(event);
            }
        });
        return btn;
    }

    function findCommanderMenuLogoutButton(menu) {
        if (!menu) return null;
        return menu.querySelector(
            '.dropdown-action-item-logout, .portal-mobile-submenu-item-logout, [id*="logout"][role="menuitem"], [onclick*="logout"]'
        );
    }

    function injectReportPlayerMenuItems() {
        if (!global.document.getElementById('player-report-modal')) return;

        global.document.querySelectorAll('#portal-desktop-commander-menu').forEach((menu) => {
            if (menu.querySelector('[data-commander-menu-action="report-player"]')) return;
            const logoutBtn = findCommanderMenuLogoutButton(menu);
            if (!logoutBtn) return;
            logoutBtn.insertAdjacentElement('beforebegin', buildReportPlayerMenuButton(
                'dropdown-action-item dropdown-action-item-report-player'
            ));
        });

        [
            { id: 'portal-mobile-commander-submenu', handler: 'portalMobileNavCommanderAction' },
            { id: 'game-mobile-commander-submenu', handler: 'gameMobileNavCommanderAction' }
        ].forEach(({ id, handler }) => {
            const submenu = global.document.getElementById(id);
            if (!submenu || submenu.querySelector('[data-commander-menu-action="report-player"]')) return;
            const logoutBtn = findCommanderMenuLogoutButton(submenu);
            if (!logoutBtn) return;
            logoutBtn.insertAdjacentElement('beforebegin', buildReportPlayerMenuButton(
                'portal-mobile-submenu-item portal-mobile-submenu-item-report-player',
                handler
            ));
        });
    }

    function boot() {
        bindModalControls();
        injectReportPlayerMenuItems();
    }

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    const api = {
        open,
        openFromCommanderMenu,
        close,
        submit,
        injectReportPlayerMenuItems,
        DETAILS_MIN,
        DETAILS_MAX,
        REPORT_CATEGORIES
    };

    global.RoyalArmiesPlayerReport = api;
    global.openPlayerReportDialog = open;
    global.openReportPlayerFromCommanderMenu = openFromCommanderMenu;
}(typeof window !== 'undefined' ? window : globalThis));

/**
 * RIFT — Report a commander modal (portal + Age surfaces).
 */
(function initRoyalArmiesPlayerReport(global) {
    'use strict';

    const DETAILS_MIN = 20;
    const DETAILS_MAX = 2000;
    const SCREENSHOT_MAX_BYTES = 2 * 1024 * 1024;
    const SCREENSHOT_ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

    const catalog = global.RoyalArmiesPlayerReportCatalog || {};
    const REPORT_CATEGORY_GROUPS = catalog.REPORT_CATEGORY_GROUPS || [];
    const REPORT_CATEGORIES_MAP = catalog.REPORT_CATEGORIES || {};
    const DEFAULT_DETAILS_PLACEHOLDER = catalog.DEFAULT_DETAILS_PLACEHOLDER
        || 'Describe the incident with enough detail for moderators to investigate (dates, channels, quotes, etc.).';

    let pendingContext = null;
    let pendingScreenshot = null;
    let screenshotPreviewUrl = '';
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
            categoryGroupField: global.document.getElementById('player-report-category-group'),
            reasonField: global.document.getElementById('player-report-reason'),
            detailsField: global.document.getElementById('player-report-details'),
            contextBlock: global.document.getElementById('player-report-context-block'),
            contextText: global.document.getElementById('player-report-context-text'),
            counter: global.document.getElementById('player-report-details-counter'),
            categoryHint: global.document.getElementById('player-report-category-hint'),
            feedback: global.document.getElementById('player-report-feedback'),
            submitBtn: global.document.getElementById('player-report-submit-btn'),
            cancelBtn: global.document.getElementById('player-report-cancel-btn'),
            closeBtn: global.document.getElementById('player-report-close-btn'),
            screenshotInput: global.document.getElementById('player-report-screenshot-input'),
            screenshotAddBtn: global.document.getElementById('player-report-screenshot-add-btn'),
            screenshotClearBtn: global.document.getElementById('player-report-screenshot-clear-btn'),
            screenshotPreview: global.document.getElementById('player-report-screenshot-preview'),
            screenshotPreviewImg: global.document.getElementById('player-report-screenshot-preview-img')
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

    function getSelectedReasonId() {
        return String(getModalElements().reasonField?.value || '').trim();
    }

    function updateDetailsCounter() {
        const { detailsField, counter, submitBtn } = getModalElements();
        if (!detailsField || !counter) return;

        const length = String(detailsField.value || '').trim().length;
        const reason = getSelectedReasonId();
        counter.textContent = `${length} / ${DETAILS_MAX} (minimum ${DETAILS_MIN})`;
        counter.classList.toggle('is-valid', length >= DETAILS_MIN);
        counter.classList.toggle('is-invalid', length > 0 && length < DETAILS_MIN);

        if (submitBtn) {
            submitBtn.disabled = submitting || !reason || length < DETAILS_MIN;
            submitBtn.setAttribute('aria-disabled', submitBtn.disabled ? 'true' : 'false');
        }
    }

    function getCategoryMeta(categoryId) {
        return REPORT_CATEGORIES_MAP[String(categoryId || '').trim().toLowerCase()] || null;
    }

    function findReportGroup(groupId) {
        const id = String(groupId || '').trim();
        return REPORT_CATEGORY_GROUPS.find((group) => group.id === id) || null;
    }

    function populateGroupOptions(selectedGroupId) {
        const { categoryGroupField } = getModalElements();
        if (!categoryGroupField) return;

        categoryGroupField.innerHTML = [
            '<option value="">Select a category…</option>',
            ...REPORT_CATEGORY_GROUPS.map((group) => (
                `<option value="${escapeHtml(group.id)}"${group.id === selectedGroupId ? ' selected' : ''}>${escapeHtml(group.label)}</option>`
            ))
        ].join('');

        populateReasonOptions(selectedGroupId, '');
    }

    function populateReasonOptions(groupId, selectedReasonId) {
        const { reasonField } = getModalElements();
        if (!reasonField) return;

        const group = findReportGroup(groupId);
        if (!group) {
            reasonField.innerHTML = '<option value="">Select a reason…</option>';
            reasonField.value = '';
            reasonField.disabled = true;
            updateCategoryHint('');
            return;
        }

        reasonField.disabled = false;
        reasonField.innerHTML = [
            '<option value="">Select a reason…</option>',
            ...(group.categories || []).map((entry) => (
                `<option value="${escapeHtml(entry.id)}"${entry.id === selectedReasonId ? ' selected' : ''}>${escapeHtml(entry.label)}</option>`
            ))
        ].join('');

        if (selectedReasonId) {
            reasonField.value = selectedReasonId;
        }

        updateCategoryHint(selectedReasonId || reasonField.value);
    }

    function updateCategoryHint(categoryId) {
        const { categoryHint, detailsField } = getModalElements();
        const selectedId = categoryId || getSelectedReasonId();
        const meta = getCategoryMeta(selectedId);

        if (categoryHint) {
            const hint = String(meta?.hint || '').trim();
            categoryHint.hidden = !hint;
            categoryHint.textContent = hint;
        }

        if (detailsField && !String(detailsField.value || '').trim()) {
            detailsField.placeholder = meta?.hint
                ? `${DEFAULT_DETAILS_PLACEHOLDER} ${meta.hint}`
                : DEFAULT_DETAILS_PLACEHOLDER;
        }
    }

    function revokeScreenshotPreviewUrl() {
        if (screenshotPreviewUrl) {
            URL.revokeObjectURL(screenshotPreviewUrl);
            screenshotPreviewUrl = '';
        }
    }

    function renderScreenshotPreview() {
        const {
            screenshotPreview,
            screenshotPreviewImg,
            screenshotClearBtn,
            screenshotAddBtn
        } = getModalElements();

        if (!screenshotPreview || !screenshotPreviewImg) return;

        if (!pendingScreenshot?.previewUrl) {
            screenshotPreview.hidden = true;
            screenshotPreviewImg.removeAttribute('src');
            if (screenshotClearBtn) screenshotClearBtn.hidden = true;
            if (screenshotAddBtn) screenshotAddBtn.textContent = 'Attach screenshot';
            return;
        }

        screenshotPreview.hidden = false;
        screenshotPreviewImg.src = pendingScreenshot.previewUrl;
        if (screenshotClearBtn) screenshotClearBtn.hidden = false;
        if (screenshotAddBtn) screenshotAddBtn.textContent = 'Replace screenshot';
    }

    function clearScreenshot() {
        pendingScreenshot = null;
        revokeScreenshotPreviewUrl();

        const { screenshotInput } = getModalElements();
        if (screenshotInput) screenshotInput.value = '';
        renderScreenshotPreview();
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('read_failed'));
            reader.readAsDataURL(file);
        });
    }

    async function attachScreenshotFile(file) {
        if (!file) return;

        const mimeType = String(file.type || '').toLowerCase();
        if (!SCREENSHOT_ACCEPT.includes(mimeType)) {
            setFeedback('Screenshot must be PNG, JPG, WebP, or GIF.', true);
            return;
        }
        if (file.size > SCREENSHOT_MAX_BYTES) {
            setFeedback('Screenshot must be 2 MB or smaller.', true);
            return;
        }

        try {
            const dataUrl = await readFileAsDataUrl(file);
            revokeScreenshotPreviewUrl();
            screenshotPreviewUrl = URL.createObjectURL(file);
            pendingScreenshot = {
                dataUrl,
                mimeType: mimeType === 'image/jpg' ? 'image/jpeg' : mimeType,
                name: String(file.name || 'screenshot').slice(0, 120),
                byteSize: file.size,
                previewUrl: screenshotPreviewUrl
            };
            setFeedback('', false);
            renderScreenshotPreview();
        } catch (_err) {
            setFeedback('Could not read that image file. Try another screenshot.', true);
        }
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

        populateGroupOptions('');
        configureTargetField(targetField, targetUsername, allowTargetEntry);
        detailsField.value = '';
        clearScreenshot();
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
            const { categoryGroupField } = getModalElements();
            if (allowTargetEntry && targetField) {
                targetField.focus();
                return;
            }
            if (categoryGroupField) categoryGroupField.focus();
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
        clearScreenshot();
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

        const { targetField, detailsField, submitBtn } = getModalElements();
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

        const category = getSelectedReasonId();
        const details = String(detailsField?.value || '').trim();

        if (!category) {
            setFeedback('Choose a category and reason.', true);
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

        const payload = {
            username,
            targetUsername: pendingContext.targetUsername,
            category,
            details,
            source: pendingContext.source,
            contextLabel: pendingContext.contextLabel,
            contextMeta: pendingContext.contextMeta
        };

        if (pendingScreenshot?.dataUrl) {
            payload.screenshot = {
                dataUrl: pendingScreenshot.dataUrl,
                mimeType: pendingScreenshot.mimeType,
                name: pendingScreenshot.name
            };
        }

        try {
            const response = await global.fetch(resolveApiUrl('/api/portal/player-reports'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(payload)
            });

            const responsePayload = await response.json().catch(() => ({}));

            if (!response.ok || responsePayload.status === 'error') {
                if (typeof global.showRiftError === 'function') {
                    await global.showRiftError(responsePayload, 'Report a commander');
                } else {
                    setFeedback(responsePayload.message || 'Could not submit report.', true);
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
            categoryGroupField,
            reasonField,
            submitBtn,
            cancelBtn,
            closeBtn,
            screenshotInput,
            screenshotAddBtn,
            screenshotClearBtn
        } = getModalElements();

        if (!root || root.dataset.playerReportBound === 'true') return;
        root.dataset.playerReportBound = 'true';

        scrim?.addEventListener('click', close);
        cancelBtn?.addEventListener('click', close);
        closeBtn?.addEventListener('click', close);
        submitBtn?.addEventListener('click', submit);
        detailsField?.addEventListener('input', updateDetailsCounter);

        categoryGroupField?.addEventListener('change', () => {
            populateReasonOptions(String(categoryGroupField.value || '').trim(), '');
            updateDetailsCounter();
        });

        reasonField?.addEventListener('change', () => {
            updateCategoryHint();
            updateDetailsCounter();
        });

        screenshotAddBtn?.addEventListener('click', (event) => {
            event.preventDefault();
            screenshotInput?.click();
        });

        screenshotClearBtn?.addEventListener('click', (event) => {
            event.preventDefault();
            clearScreenshot();
        });

        screenshotInput?.addEventListener('change', () => {
            const file = screenshotInput.files && screenshotInput.files[0];
            if (file) attachScreenshotFile(file);
        });

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
        REPORT_CATEGORY_GROUPS,
        REPORT_CATEGORIES: REPORT_CATEGORIES_MAP
    };

    global.RoyalArmiesPlayerReport = api;
    global.openPlayerReportDialog = open;
    global.openReportPlayerFromCommanderMenu = openFromCommanderMenu;
}(typeof window !== 'undefined' ? window : globalThis));

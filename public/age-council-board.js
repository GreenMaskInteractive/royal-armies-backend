/**
 * RIFT — Nation council / notice board (age map HUD).
 */
(function initAgeCouncilBoard(global) {
    'use strict';

    const POLL_MS = 12000;
    const ENEMY_BORDER_ALERT_DELAY_MS = 10000;
    const SF_PULSE_DURATION_MS = 30000;

    const STATUS_META = {
        'training-permitted': { label: 'Training Permitted', className: 'training-permitted' },
        'light-training-permitted': { label: 'Light Training Permitted', className: 'light-training-permitted' },
        'stop-training': { label: 'Stop Training', className: 'stop-training' },
        'enemy-bordering': { label: 'Enemy Bordering', className: 'enemy-bordering' },
        'sf-time': { label: 'SF Time', className: 'sf-time' },
        rejoin: { label: 'Rejoin', className: 'rejoin' }
    };

    let pollTimer = null;
    let enemyBorderTimer = null;
    let sfPulseTimer = null;
    let boardState = null;
    let canEdit = false;
    let gameNation = '';
    let statusCatalog = [];
    let enemyBorderPending = false;

    const alertAudio = global.document.getElementById('age-council-alert-sfx');

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

    function getStatusMeta(statusId) {
        return STATUS_META[statusId] || STATUS_META['training-permitted'];
    }

    function getDefaultBoardState() {
        return {
            statusId: 'training-permitted',
            previousStatusId: null,
            noticeText: '',
            nextSfTime: '',
            expectedPvpTime: '',
            updatedAt: null,
            updatedBy: null
        };
    }

    function formatCouncilBoardEditedAt(isoValue) {
        const raw = String(isoValue || '').trim();
        if (!raw) return '';

        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) return '';

        const datePart = parsed.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC'
        });
        const timePart = parsed.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'UTC'
        });

        return `${datePart} · ${timePart} UTC`;
    }

    function formatCouncilBoardEditedByLine(state) {
        const editor = String(state?.updatedBy || '').trim();
        if (!editor) return '';

        const when = formatCouncilBoardEditedAt(state?.updatedAt);
        return when ? `Edited by ${editor} · ${when}` : `Edited by ${editor}`;
    }

    const COUNCIL_NOTICE_LINE_PREFIX_RE = /^(#{1,3}|-)\s+/;

    function escapeCouncilNoticeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatCouncilNoticeInlineMarkup(text) {
        let line = escapeCouncilNoticeHtml(text);
        line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        line = line.replace(/__(.+?)__/g, '<u>$1</u>');
        line = line.replace(/\*(.+?)\*/g, '<em>$1</em>');
        return line;
    }

    function formatCouncilNoticeMarkup(raw) {
        const source = String(raw || '');
        if (!source.trim()) return '';

        return source.split('\n').map((row) => {
            const line = row.trimEnd();
            const trimmed = line.trim();

            if (!trimmed) {
                return '<br class="age-council-notice-gap" aria-hidden="true">';
            }

            if (/^###\s+/.test(trimmed)) {
                const body = trimmed.replace(/^###\s+/, '');
                return `<h4 class="age-council-notice-heading age-council-notice-heading--sub">${formatCouncilNoticeInlineMarkup(body)}</h4>`;
            }

            if (/^##\s+/.test(trimmed)) {
                const body = trimmed.replace(/^##\s+/, '');
                return `<h3 class="age-council-notice-heading">${formatCouncilNoticeInlineMarkup(body)}</h3>`;
            }

            if (/^#\s+/.test(trimmed)) {
                const body = trimmed.replace(/^#\s+/, '');
                return `<h3 class="age-council-notice-heading">${formatCouncilNoticeInlineMarkup(body)}</h3>`;
            }

            if (/^-\s+/.test(trimmed)) {
                const body = trimmed.replace(/^-\s+/, '');
                return `<p class="age-council-notice-bullet"><span class="age-council-notice-bullet-mark" aria-hidden="true">•</span> ${formatCouncilNoticeInlineMarkup(body)}</p>`;
            }

            return `<p class="age-council-notice-line">${formatCouncilNoticeInlineMarkup(line)}</p>`;
        }).join('');
    }

    function renderCouncilNoticeDisplay(noticeEl, raw) {
        const notice = String(raw || '').trim();

        if (!notice) {
            noticeEl.textContent = 'No council notice posted yet.';
            noticeEl.classList.add('is-empty');
            noticeEl.classList.remove('age-council-board-notice--rich');
            return;
        }

        noticeEl.innerHTML = formatCouncilNoticeMarkup(notice);
        noticeEl.classList.remove('is-empty');
        noticeEl.classList.add('age-council-board-notice--rich');
    }

    function getCouncilNoticeTextarea() {
        return global.document.getElementById('age-council-board-editor-notice');
    }

    function renderCouncilEditorPreview(raw) {
        const previewEl = global.document.getElementById('age-council-board-editor-preview');
        if (!previewEl) return;
        renderCouncilNoticeDisplay(previewEl, raw);
        syncCouncilEditorPreviewViewport();
    }

    let councilNoticeResizeObserver = null;
    let councilEditorLayoutListener = null;

    function measureCouncilNoticeViewport() {
        const noticeEl = global.document.getElementById('age-council-board-notice');
        if (!noticeEl) return null;

        const width = Math.round(noticeEl.clientWidth);
        const height = Math.round(Math.max(noticeEl.clientHeight, noticeEl.scrollHeight));
        if (height < 1 || width < 1) return null;

        return { height, width };
    }

    function applyCouncilEditorPreviewViewport(size) {
        const canvas = global.document.getElementById('age-page-canvas');
        const previewEl = global.document.getElementById('age-council-board-editor-preview');
        const previewShell = previewEl?.closest('.age-council-board-editor-preview-shell');
        if (!size || !previewEl) return;

        if (canvas) {
            canvas.style.setProperty('--age-council-notice-viewport-height', `${size.height}px`);
            canvas.style.setProperty('--age-council-notice-viewport-width', `${size.width}px`);
        }

        previewEl.style.width = `${size.width}px`;
        previewEl.style.minHeight = `${size.height}px`;
        previewEl.style.height = 'auto';
        previewEl.style.maxHeight = 'none';

        if (previewShell) {
            previewShell.style.width = `${size.width}px`;
            previewShell.style.maxWidth = '100%';
        }
    }

    function syncCouncilEditorPreviewViewport() {
        const size = measureCouncilNoticeViewport();
        if (!size) return;

        applyCouncilEditorPreviewViewport(size);

        const previewEl = global.document.getElementById('age-council-board-editor-preview');
        if (!previewEl) return;

        const contentHeight = Math.round(Math.max(size.height, previewEl.scrollHeight));
        if (contentHeight > size.height) {
            applyCouncilEditorPreviewViewport({ width: size.width, height: contentHeight });
        }
    }

    function startCouncilEditorPreviewViewportSync() {
        global.requestAnimationFrame(() => {
            global.requestAnimationFrame(() => {
                syncCouncilEditorPreviewViewport();
            });
        });

        const noticeEl = global.document.getElementById('age-council-board-notice');
        if (!noticeEl || typeof ResizeObserver === 'undefined') return;

        if (councilNoticeResizeObserver) {
            councilNoticeResizeObserver.disconnect();
        }

        councilNoticeResizeObserver = new ResizeObserver(() => {
            syncCouncilEditorPreviewViewport();
        });
        councilNoticeResizeObserver.observe(noticeEl);

        if (!councilEditorLayoutListener) {
            councilEditorLayoutListener = () => syncCouncilEditorPreviewViewport();
            global.addEventListener('resize', councilEditorLayoutListener);
        }
    }

    function stopCouncilEditorPreviewViewportSync() {
        if (councilNoticeResizeObserver) {
            councilNoticeResizeObserver.disconnect();
            councilNoticeResizeObserver = null;
        }

        if (councilEditorLayoutListener) {
            global.removeEventListener('resize', councilEditorLayoutListener);
            councilEditorLayoutListener = null;
        }
    }

    function replaceCouncilNoticeTextareaValue(textarea, nextValue, selectionStart, selectionEnd) {
        const maxLength = Number(textarea.getAttribute('maxlength')) || 2000;
        const capped = String(nextValue || '').slice(0, maxLength);
        textarea.value = capped;
        renderCouncilEditorPreview(capped);

        const start = Math.min(selectionStart, capped.length);
        const end = Math.min(selectionEnd, capped.length);
        textarea.focus();
        textarea.setSelectionRange(start, end);
    }

    function wrapCouncilNoticeSelection(before, after = before) {
        const textarea = getCouncilNoticeTextarea();
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        const selected = value.slice(start, end);
        const open = before || '';
        const close = after ?? before ?? '';

        if (selected) {
            const replacement = `${open}${selected}${close}`;
            const nextValue = value.slice(0, start) + replacement + value.slice(end);
            replaceCouncilNoticeTextareaValue(textarea, nextValue, start + replacement.length, start + replacement.length);
            return;
        }

        const replacement = `${open}${close}`;
        const nextValue = value.slice(0, start) + replacement + value.slice(end);
        const cursor = start + open.length;
        replaceCouncilNoticeTextareaValue(textarea, nextValue, cursor, cursor);
    }

    function getCouncilNoticeLineRange(textarea) {
        const value = textarea.value;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
        const lineEndIndex = value.indexOf('\n', end);
        const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;

        return { value, lineStart, lineEnd };
    }

    function stripCouncilNoticeLinePrefix(line) {
        return String(line || '').replace(COUNCIL_NOTICE_LINE_PREFIX_RE, '');
    }

    function applyCouncilNoticeLinePrefix(prefix) {
        const textarea = getCouncilNoticeTextarea();
        if (!textarea) return;

        const { value, lineStart, lineEnd } = getCouncilNoticeLineRange(textarea);
        const block = value.slice(lineStart, lineEnd);
        const lines = block.split('\n');
        const normalizedPrefix = String(prefix || '');
        const allHavePrefix = lines.length > 0 && lines.every((line) => {
            const trimmed = line.trim();
            if (!normalizedPrefix) return !COUNCIL_NOTICE_LINE_PREFIX_RE.test(trimmed);
            return trimmed.startsWith(normalizedPrefix);
        });

        const nextLines = lines.map((line) => {
            const stripped = stripCouncilNoticeLinePrefix(line);
            if (allHavePrefix) return stripped;
            if (!normalizedPrefix) return stripped;
            return `${normalizedPrefix}${stripped}`;
        });

        const replacement = nextLines.join('\n');
        const nextValue = value.slice(0, lineStart) + replacement + value.slice(lineEnd);
        replaceCouncilNoticeTextareaValue(
            textarea,
            nextValue,
            lineStart,
            lineStart + replacement.length
        );
    }

    function applyCouncilNoticeFormat(formatId) {
        switch (formatId) {
            case 'bold':
                wrapCouncilNoticeSelection('**');
                break;
            case 'italic':
                wrapCouncilNoticeSelection('*');
                break;
            case 'underline':
                wrapCouncilNoticeSelection('__');
                break;
            case 'heading':
                applyCouncilNoticeLinePrefix('## ');
                break;
            case 'subheading':
                applyCouncilNoticeLinePrefix('### ');
                break;
            case 'list':
                applyCouncilNoticeLinePrefix('- ');
                break;
            default:
                break;
        }
    }

    function buildStatusCatalog() {
        return Object.keys(STATUS_META).map((id) => ({
            id,
            label: STATUS_META[id].label
        }));
    }

    function isDevPlayerPortalPersonaActive() {
        return typeof global.isLocalDevPlayerBypassActive === 'function'
            && global.isLocalDevPlayerBypassActive();
    }

    function isPortalOwnerCouncilEditor() {
        if (isDevPlayerPortalPersonaActive()) return false;
        const username = resolveUsername();
        if (!username) return false;
        return typeof global.isPortalSiteOwner === 'function' && global.isPortalSiteOwner(username);
    }

    function canUseCouncilEditor() {
        if (!resolveUsername()) return false;
        return Boolean(canEdit || isPortalOwnerCouncilEditor());
    }

    function ensureCouncilBoardEditButtonMarkup() {
        const editBtn = global.document.getElementById('age-council-board-edit-btn');
        if (!editBtn || editBtn.dataset.councilEditGlyphReady === 'true') return;

        editBtn.dataset.councilEditGlyphReady = 'true';
        editBtn.innerHTML = '<span class="age-council-board-edit-glyph" aria-hidden="true"></span>';
    }

    function applyCouncilBoardFallback() {
        gameNation = '';
        canEdit = false;
        boardState = getDefaultBoardState();
        statusCatalog = buildStatusCatalog();
        renderBoard();
    }

    function playCouncilAlertSfx() {
        if (!alertAudio) return;
        try {
            alertAudio.currentTime = 0;
            const vol = parseFloat(global.localStorage.getItem('savedMasterVol'));
            alertAudio.volume = Number.isFinite(vol) ? Math.min(1, Math.max(0, vol)) : 0.85;
            alertAudio.play().catch(() => {});
        } catch (_err) {
            /* ignore */
        }
    }

    function triggerSfTimeEffects() {
        const canvas = global.document.getElementById('age-page-canvas');
        if (!canvas) return;

        canvas.classList.add('age-sf-time-pulse-active');
        playCouncilAlertSfx();

        if (sfPulseTimer) global.clearTimeout(sfPulseTimer);
        sfPulseTimer = global.setTimeout(() => {
            canvas.classList.remove('age-sf-time-pulse-active');
            sfPulseTimer = null;
        }, SF_PULSE_DURATION_MS);
    }

    function applyStatusSideEffects(previousStatusId, nextStatusId, options = {}) {
        if (nextStatusId === 'sf-time' && previousStatusId !== 'sf-time') {
            triggerSfTimeEffects();
        }
        if (nextStatusId === 'enemy-bordering' && options.playBorderAlert) {
            if (enemyBorderTimer) global.clearTimeout(enemyBorderTimer);
            enemyBorderTimer = global.setTimeout(() => {
                enemyBorderTimer = null;
                if (boardState?.statusId === 'enemy-bordering') {
                    playCouncilAlertSfx();
                }
            }, ENEMY_BORDER_ALERT_DELAY_MS);
        }
    }

    function renderBoard() {
        const statusEl = global.document.getElementById('age-council-board-status');
        const noticeEl = global.document.getElementById('age-council-board-notice');
        const sfEl = global.document.getElementById('age-council-board-sf-time');
        const pvpEl = global.document.getElementById('age-council-board-pvp-time');
        const editedByEl = global.document.getElementById('age-council-board-edited-by');
        const editBtn = global.document.getElementById('age-council-board-edit-btn');

        if (!statusEl || !noticeEl) return;

        const state = boardState || getDefaultBoardState();
        const meta = getStatusMeta(state.statusId);

        statusEl.textContent = meta.label;
        statusEl.className = `age-council-board-status age-council-board-status--${meta.className}`;

        renderCouncilNoticeDisplay(noticeEl, state.noticeText);

        if (sfEl) sfEl.textContent = String(state.nextSfTime || '').trim() || '—';
        if (pvpEl) pvpEl.textContent = String(state.expectedPvpTime || '').trim() || '—';

        if (editedByEl) {
            const editedByLine = formatCouncilBoardEditedByLine(state);
            editedByEl.textContent = editedByLine;
            editedByEl.hidden = !editedByLine;
        }

        ensureCouncilBoardEditButtonMarkup();

        if (editBtn) {
            const mayEdit = canUseCouncilEditor();
            editBtn.hidden = !mayEdit;
            editBtn.disabled = !mayEdit;
            editBtn.setAttribute('aria-hidden', mayEdit ? 'false' : 'true');
            editBtn.classList.toggle('is-council-edit-allowed', mayEdit);
        }
    }

    function setEditorFeedback(message, tone = 'error') {
        const feedback = global.document.getElementById('age-council-board-editor-feedback');
        if (!feedback) return;

        const text = String(message || '').trim();
        if (!text) {
            feedback.hidden = true;
            feedback.textContent = '';
            feedback.classList.remove('is-error', 'is-success');
            return;
        }

        feedback.hidden = false;
        feedback.textContent = text;
        feedback.classList.toggle('is-error', tone === 'error');
        feedback.classList.toggle('is-success', tone === 'success');
    }

    function clearEditorFeedback() {
        setEditorFeedback('');
    }

    function setSaveInProgress(isSaving) {
        const saveBtn = global.document.getElementById('age-council-board-editor-save');
        if (!saveBtn) return;

        saveBtn.disabled = Boolean(isSaving);
        saveBtn.classList.toggle('is-saving', Boolean(isSaving));
        saveBtn.textContent = isSaving ? 'Saving…' : 'Save Board';
    }

    async function notifyCouncilPatchFailure(response, payload) {
        let message = 'Could not save the council board. Try again.';

        if (typeof global.handleRiftApiFailure === 'function') {
            const normalized = await global.handleRiftApiFailure(response, payload, 'Council board');
            if (normalized?.message) message = normalized.message;
        } else if (payload && typeof payload === 'object' && payload.message) {
            message = String(payload.message);
        } else if (typeof global.showPortalAlert === 'function') {
            await global.showPortalAlert(message, 'Council board');
        }

        console.warn('[RIFT] Council board save failed:', message, payload);
        setEditorFeedback(message, 'error');
    }

    function populateEditorFields() {
        const state = boardState || {};
        const statusSelect = global.document.getElementById('age-council-board-editor-status');
        const noticeInput = global.document.getElementById('age-council-board-editor-notice');
        const sfInput = global.document.getElementById('age-council-board-editor-sf');
        const pvpInput = global.document.getElementById('age-council-board-editor-pvp');

        if (statusSelect) {
            const options = (statusCatalog.length ? statusCatalog : Object.keys(STATUS_META).map((id) => ({
                id,
                label: STATUS_META[id].label
            })));
            statusSelect.innerHTML = options.map((entry) => (
                `<option value="${entry.id}">${entry.label}</option>`
            )).join('');
            statusSelect.value = state.statusId || 'training-permitted';
        }
        if (noticeInput) noticeInput.value = state.noticeText || '';
        if (sfInput) sfInput.value = state.nextSfTime || '';
        if (pvpInput) pvpInput.value = state.expectedPvpTime || '';
        renderCouncilEditorPreview(state.noticeText || '');
    }

    function openEditor() {
        if (!canUseCouncilEditor()) return;

        clearEditorFeedback();
        setSaveInProgress(false);
        populateEditorFields();
        const editor = global.document.getElementById('age-council-board-editor');
        if (!editor) return;

        editor.hidden = false;
        editor.classList.add('is-open');
        editor.setAttribute('aria-hidden', 'false');
        startCouncilEditorPreviewViewportSync();

        const statusSelect = global.document.getElementById('age-council-board-editor-status');
        if (statusSelect) {
            global.requestAnimationFrame(() => statusSelect.focus());
        }
    }

    function closeEditor() {
        const editor = global.document.getElementById('age-council-board-editor');
        if (!editor) return;

        setSaveInProgress(false);
        clearEditorFeedback();
        stopCouncilEditorPreviewViewportSync();
        editor.hidden = true;
        editor.classList.remove('is-open');
        editor.setAttribute('aria-hidden', 'true');
    }

    async function patchCouncilBoard(patch) {
        const username = resolveUsername();
        if (!username) {
            setEditorFeedback('Sign in is required to save the council board.', 'error');
            return null;
        }

        try {
            const response = await global.fetch(resolveApiUrl('/api/portal/age/council-board'), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                cache: 'no-store',
                body: JSON.stringify({ username, ...patch })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload.status !== 'ok') {
                await notifyCouncilPatchFailure(response, payload);
                return null;
            }

            if (payload.gameNation) {
                gameNation = String(payload.gameNation).trim();
            }

            const previousStatusId = boardState?.statusId;
            boardState = payload.board || boardState || getDefaultBoardState();
            renderBoard();

            if (payload.statusChanged) {
                applyStatusSideEffects(previousStatusId, boardState.statusId, {
                    playBorderAlert: boardState.statusId === 'enemy-bordering'
                });
                if (typeof global.RoyalArmiesGameChat?.refresh === 'function') {
                    await global.RoyalArmiesGameChat.refresh();
                }
            }

            return payload;
        } catch (err) {
            console.warn('[RIFT] Council board save failed:', err);
            if (typeof global.showRiftNetworkError === 'function') {
                await global.showRiftNetworkError('Council board');
            }
            setEditorFeedback('Could not reach the server. Check your connection and try again.', 'error');
            return null;
        }
    }

    async function fetchCouncilBoard() {
        const username = resolveUsername();
        if (!username) return;

        try {
            const response = await global.fetch(
                resolveApiUrl(`/api/portal/age/council-board?username=${encodeURIComponent(username)}`),
                { credentials: 'include', cache: 'no-store' }
            );
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload.status !== 'ok') {
                applyCouncilBoardFallback();
                return;
            }

            const previousStatusId = boardState?.statusId;
            gameNation = String(payload.gameNation || '').trim();
            canEdit = Boolean(payload.canEdit);
            statusCatalog = Array.isArray(payload.statusCatalog) ? payload.statusCatalog : buildStatusCatalog();
            boardState = payload.board || getDefaultBoardState();

            renderBoard();

            if (previousStatusId && boardState?.statusId && previousStatusId !== boardState.statusId) {
                applyStatusSideEffects(previousStatusId, boardState.statusId);
            }
        } catch (err) {
            console.warn('[RIFT] Council board fetch failed:', err);
            applyCouncilBoardFallback();
        }
    }

    async function saveEditor() {
        if (!canUseCouncilEditor()) {
            setEditorFeedback(
                'Only nation Leaders, Vice Leaders, Council members, and Planners can edit the council board.',
                'error'
            );
            return;
        }

        const saveBtn = global.document.getElementById('age-council-board-editor-save');
        if (saveBtn?.disabled) return;

        const statusSelect = global.document.getElementById('age-council-board-editor-status');
        const noticeInput = global.document.getElementById('age-council-board-editor-notice');
        const sfInput = global.document.getElementById('age-council-board-editor-sf');
        const pvpInput = global.document.getElementById('age-council-board-editor-pvp');

        clearEditorFeedback();
        setSaveInProgress(true);

        try {
            const result = await patchCouncilBoard({
                statusId: statusSelect?.value,
                noticeText: noticeInput?.value ?? '',
                nextSfTime: sfInput?.value ?? '',
                expectedPvpTime: pvpInput?.value ?? ''
            });

            if (result) {
                closeEditor();
            }
        } finally {
            setSaveInProgress(false);
        }
    }

    async function setCouncilStatus(statusId, options = {}) {
        const patch = options.revertFromEnemyBordering
            ? { revertFromEnemyBordering: true }
            : (isCouncilStatusId(statusId) ? { statusId } : null);
        if (!patch) return false;

        const result = await patchCouncilBoard(patch);
        return Boolean(result);
    }

    function isCouncilStatusId(statusId) {
        return Boolean(STATUS_META[statusId]);
    }

  /** Nation attacked or rally armies → stop training (or SF time for rally leaders). */
    async function notifyNationAttacked() {
        if (!gameNation) return;
        const current = boardState?.statusId;
        if (current === 'stop-training' || current === 'sf-time') return;
        await setCouncilStatus('stop-training');
    }

    async function notifyEnemyAtBorder(detected) {
        if (!gameNation || !detected) return;
        if (enemyBorderPending) return;
        enemyBorderPending = true;
        await setCouncilStatus('enemy-bordering');
    }

    async function notifyEnemyBorderClear() {
        if (!gameNation || boardState?.statusId !== 'enemy-bordering') return;
        enemyBorderPending = false;
        await patchCouncilBoard({ revertFromEnemyBordering: true });
    }

    /** Leader / council rally — SF Time (+ screen pulse + alert). */
    async function rallyArmies() {
        if (!gameNation) return;
        await setCouncilStatus('sf-time');
    }

    async function notifyLeaderDrop() {
        if (!gameNation) return;
        await setCouncilStatus('rejoin');
    }

    function bindUi() {
        const editBtn = global.document.getElementById('age-council-board-edit-btn');
        const editor = global.document.getElementById('age-council-board-editor');

        if (editor && editor.dataset.councilUiBound !== 'true') {
            editor.dataset.councilUiBound = 'true';

            editor.addEventListener('click', (event) => {
                const formatBtn = event.target.closest('[data-council-format]');
                if (formatBtn) {
                    event.preventDefault();
                    applyCouncilNoticeFormat(formatBtn.getAttribute('data-council-format'));
                    return;
                }

                if (event.target.closest('#age-council-board-editor-save')) {
                    event.preventDefault();
                    void saveEditor();
                    return;
                }

                if (event.target.closest('#age-council-board-editor-close')
                    || event.target.closest('#age-council-board-editor-cancel')) {
                    event.preventDefault();
                    closeEditor();
                    return;
                }

                if (event.target.closest('#age-council-board-editor-backdrop')) {
                    closeEditor();
                }
            });

            editor.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    closeEditor();
                    return;
                }

                if (!event.target.closest('#age-council-board-editor-notice') || (!event.ctrlKey && !event.metaKey)) {
                    return;
                }

                const shortcutMap = {
                    b: 'bold',
                    i: 'italic',
                    u: 'underline'
                };
                const formatId = shortcutMap[String(event.key || '').toLowerCase()];
                if (!formatId) return;

                event.preventDefault();
                applyCouncilNoticeFormat(formatId);
            });

            editor.addEventListener('input', (event) => {
                if (!event.target.closest('#age-council-board-editor-notice')) return;
                renderCouncilEditorPreview(event.target.value || '');
            });
        }

        if (editBtn && editBtn.dataset.councilUiBound !== 'true') {
            editBtn.dataset.councilUiBound = 'true';
            editBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                openEditor();
            });
        }
    }

    function startPolling() {
        if (pollTimer) global.clearInterval(pollTimer);
        pollTimer = global.setInterval(() => {
            fetchCouncilBoard();
        }, POLL_MS);
    }

    function stopPolling() {
        if (pollTimer) {
            global.clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    async function enableCouncilBoard() {
        bindUi();
        ensureCouncilBoardEditButtonMarkup();
        canEdit = false;
        boardState = getDefaultBoardState();
        statusCatalog = buildStatusCatalog();
        renderBoard();
        await fetchCouncilBoard();
        startPolling();
    }

    global.RoyalArmiesCouncilBoard = {
        refresh: fetchCouncilBoard,
        syncEditorPreviewViewport: syncCouncilEditorPreviewViewport,
        setStatus: setCouncilStatus,
        notifyNationAttacked,
        notifyEnemyAtBorder,
        notifyEnemyBorderClear,
        rallyArmies,
        notifyLeaderDrop,
        getBoardState: () => boardState,
        getGameNation: () => gameNation
    };

    global.enableAgeCouncilBoard = enableCouncilBoard;
    global.stopAgeCouncilBoard = stopPolling;
})(window);

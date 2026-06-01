/**
 * RIFT — @ mention autocomplete and shoutout rendering for game chat compose.
 */
(function initRoyalArmiesChatMentions(global) {
    'use strict';

    const MENTION_SUGGESTION_MAX = 8;
    const MENTION_PREVIEW_MAX_CHARS = 110;
    const MENTION_ALERT_MAX_VISIBLE = 4;

    let rosterCache = [];
    let rosterLoadPromise = null;
    let suggestState = null;
    let alertCounter = 0;
    const alertedMessageIds = new Set();

    function resolveApiUrl(path) {
        if (typeof global.resolveRoyalArmiesApiUrl === 'function') {
            return global.resolveRoyalArmiesApiUrl(path);
        }
        return path;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function normalizeUsername(name) {
        return String(name || '').trim().toLowerCase();
    }

    function isBlockedMentionName(name) {
        const key = normalizeUsername(name);
        return !key || key === 'testaccount' || key === 'royal guard bot';
    }

    function extractMentionedUsernamesFromChatText(text) {
        const matches = String(text || '').match(/@([a-zA-Z0-9_\-]+)/g) || [];
        return matches.map((token) => token.slice(1).toLowerCase());
    }

    function formatChatMentionBodyHtml(text) {
        return escapeHtml(text).replace(
            /(@[a-zA-Z0-9_\-]+)/g,
            '<span class="chat-shoutout-mention-badge">$1</span>'
        );
    }

    function buildMentionPreviewSnippet(text) {
        const compact = String(text || '').replace(/\s+/g, ' ').trim();
        if (compact.length <= MENTION_PREVIEW_MAX_CHARS) return compact;
        return `${compact.slice(0, MENTION_PREVIEW_MAX_CHARS)}…`;
    }

    function getMentionCandidatePool() {
        const seen = new Set();
        const pool = [];

        const pushName = (name) => {
            const trimmed = String(name || '').trim();
            const key = normalizeUsername(trimmed);
            if (isBlockedMentionName(trimmed) || seen.has(key)) return;
            seen.add(key);
            pool.push(trimmed);
        };

        rosterCache.forEach(pushName);
        return pool.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }

    async function loadMentionRoster(forceReload) {
        if (!forceReload && rosterCache.length) {
            return getMentionCandidatePool();
        }
        if (!forceReload && rosterLoadPromise) {
            return rosterLoadPromise;
        }

        rosterLoadPromise = global.fetch(resolveApiUrl('/api/portal/community-chat/mention-roster'), {
            credentials: 'same-origin',
            cache: 'no-store'
        })
            .then((response) => (response.ok ? response.json() : null))
            .then((payload) => {
                if (payload?.status === 'ok' && Array.isArray(payload.usernames)) {
                    rosterCache = payload.usernames
                        .map((name) => String(name || '').trim())
                        .filter((name) => name && !isBlockedMentionName(name));
                }
                return getMentionCandidatePool();
            })
            .catch(() => getMentionCandidatePool())
            .finally(() => {
                rosterLoadPromise = null;
            });

        return rosterLoadPromise;
    }

    function getActiveMentionQuery(field) {
        if (!field) return null;

        const value = String(field.value || '');
        const caret = Number.isFinite(field.selectionStart) ? field.selectionStart : value.length;
        const beforeCaret = value.slice(0, caret);
        const match = beforeCaret.match(/@([a-zA-Z0-9_\-]*)$/);
        if (!match) return null;

        return {
            query: match[1] || '',
            startIndex: caret - match[0].length,
            endIndex: caret
        };
    }

    function filterMentionCandidates(query) {
        const pool = getMentionCandidatePool();
        const normalizedQuery = String(query || '').trim().toLowerCase();

        let matches = pool;
        if (normalizedQuery) {
            matches = pool.filter((name) => normalizeUsername(name).includes(normalizedQuery));
        }

        matches = matches.slice().sort((left, right) => {
            const leftKey = normalizeUsername(left);
            const rightKey = normalizeUsername(right);
            const leftStarts = normalizedQuery && leftKey.startsWith(normalizedQuery) ? 0 : 1;
            const rightStarts = normalizedQuery && rightKey.startsWith(normalizedQuery) ? 0 : 1;
            if (leftStarts !== rightStarts) return leftStarts - rightStarts;
            return left.localeCompare(right, undefined, { sensitivity: 'base' });
        });

        return matches.slice(0, MENTION_SUGGESTION_MAX);
    }

    function resolveMentionDropdown(field) {
        const anchor = field?.closest('.chat-input-mention-anchor');
        if (!anchor) return null;
        return anchor.querySelector('.chat-mention-suggest-dropdown');
    }

    function hideMentionSuggestDropdown() {
        suggestState = null;
        global.document.querySelectorAll('.chat-mention-suggest-dropdown').forEach((dropdown) => {
            dropdown.hidden = true;
            dropdown.innerHTML = '';
        });
    }

    function renderMentionSuggestDropdown(field, matches, highlightIndex) {
        const dropdown = resolveMentionDropdown(field);
        if (!dropdown) return;

        if (!matches.length) {
            dropdown.innerHTML = '<p class="chat-mention-suggest-empty">No matching commanders</p>';
            dropdown.hidden = false;
            return;
        }

        dropdown.innerHTML = matches.map((name, index) => {
            const highlighted = index === highlightIndex ? ' is-highlighted' : '';
            return (
                `<button type="button"`
                + ` class="chat-mention-suggest-item${highlighted}"`
                + ` role="option"`
                + ` aria-selected="${index === highlightIndex ? 'true' : 'false'}"`
                + ` data-mention-username="${escapeHtml(name)}"`
                + `><span class="chat-mention-suggest-at" aria-hidden="true">@</span>${escapeHtml(name)}</button>`
            );
        }).join('');
        dropdown.hidden = false;
    }

    function refreshMentionSuggestFromField(field) {
        const active = getActiveMentionQuery(field);
        if (!active) {
            hideMentionSuggestDropdown();
            return;
        }

        const matches = filterMentionCandidates(active.query);
        if (!matches.length) {
            suggestState = {
                field,
                matches: [],
                highlightIndex: 0,
                startIndex: active.startIndex,
                endIndex: active.endIndex
            };
            renderMentionSuggestDropdown(field, [], 0);
            return;
        }

        const previousHighlight = suggestState?.field === field
            ? (suggestState.highlightIndex || 0)
            : 0;
        const highlightIndex = Math.min(previousHighlight, matches.length - 1);

        suggestState = {
            field,
            matches,
            highlightIndex,
            startIndex: active.startIndex,
            endIndex: active.endIndex
        };

        renderMentionSuggestDropdown(field, matches, highlightIndex);
    }

    function applyMentionSelection(field, username) {
        const active = suggestState?.field === field
            ? suggestState
            : getActiveMentionQuery(field);
        if (!field || !active || !username) return;

        const value = String(field.value || '');
        const before = value.slice(0, active.startIndex);
        const after = value.slice(active.endIndex);
        const mentionToken = `@${String(username).trim()} `;
        field.value = `${before}${mentionToken}${after}`;

        const caret = (before + mentionToken).length;
        field.setSelectionRange(caret, caret);
        hideMentionSuggestDropdown();
        field.focus();
    }

    function isMentionSuggestOpen(field) {
        const dropdown = resolveMentionDropdown(field);
        return Boolean(dropdown && !dropdown.hidden && suggestState?.field === field);
    }

    function handleMentionInput(event) {
        const field = event?.target;
        if (!field?.closest('.chat-input-mention-anchor')) return;

        void loadMentionRoster().then(() => {
            refreshMentionSuggestFromField(field);
        });
    }

    function handleMentionKeydown(event) {
        const field = event?.target;
        if (!field?.closest('.chat-input-mention-anchor')) return false;

        const isOpen = isMentionSuggestOpen(field);
        const state = suggestState?.field === field ? suggestState : null;

        if (isOpen && state?.matches?.length) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                state.highlightIndex = (state.highlightIndex + 1) % state.matches.length;
                renderMentionSuggestDropdown(field, state.matches, state.highlightIndex);
                return true;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                state.highlightIndex = (state.highlightIndex - 1 + state.matches.length) % state.matches.length;
                renderMentionSuggestDropdown(field, state.matches, state.highlightIndex);
                return true;
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault();
                applyMentionSelection(field, state.matches[state.highlightIndex]);
                return true;
            }
        }

        if (event.key === 'Escape' && isOpen) {
            event.preventDefault();
            hideMentionSuggestDropdown();
            return true;
        }

        global.setTimeout(() => {
            if (getActiveMentionQuery(field)) {
                refreshMentionSuggestFromField(field);
            } else {
                hideMentionSuggestDropdown();
            }
        }, 0);

        return false;
    }

    function wireMentionAutocomplete(field) {
        if (!field || field.dataset.mentionAutocompleteWired === 'true') return;
        field.dataset.mentionAutocompleteWired = 'true';

        field.addEventListener('input', handleMentionInput);
        field.addEventListener('click', handleMentionInput);
        field.addEventListener('blur', () => {
            global.setTimeout(() => hideMentionSuggestDropdown(), 140);
        });

        const anchor = field.closest('.chat-input-mention-anchor');
        if (anchor && anchor.dataset.mentionSuggestWired !== 'true') {
            anchor.dataset.mentionSuggestWired = 'true';
            anchor.addEventListener('mousedown', (clickEvent) => {
                const option = clickEvent.target.closest('[data-mention-username]');
                if (!option) return;
                clickEvent.preventDefault();
                applyMentionSelection(field, option.getAttribute('data-mention-username') || '');
            });
        }

        void loadMentionRoster();
    }

    function ensureMentionAlertStack() {
        let stack = global.document.getElementById('chat-mention-alert-stack');
        if (!stack) {
            stack = global.document.createElement('div');
            stack.id = 'chat-mention-alert-stack';
            stack.className = 'chat-mention-alert-stack';
            stack.setAttribute('aria-live', 'polite');
            stack.setAttribute('aria-label', 'Chat shoutout alerts');
            global.document.body.appendChild(stack);
        }
        return stack;
    }

    function dismissMentionAlert(alertId) {
        const card = global.document.querySelector(`.chat-mention-alert-card[data-alert-id="${alertId}"]`);
        card?.remove();
        const stack = global.document.getElementById('chat-mention-alert-stack');
        if (stack && !stack.children.length) {
            stack.remove();
        }
    }

    function showMentionAlert(payload) {
        const stack = ensureMentionAlertStack();
        const alertId = `chat-mention-alert-${++alertCounter}`;
        const sender = String(payload?.sender || 'Commander').trim();
        const preview = buildMentionPreviewSnippet(payload?.preview || '');
        const channelLabel = String(payload?.channelLabel || 'Chat').trim();

        const card = global.document.createElement('button');
        card.type = 'button';
        card.className = 'chat-mention-alert-card';
        card.dataset.alertId = alertId;
        card.innerHTML = (
            `<div class="chat-mention-alert-card-header">`
            + `<span class="chat-mention-alert-eyebrow">@ Shoutout · ${escapeHtml(channelLabel)}</span>`
            + `<span class="chat-mention-alert-dismiss-btn" role="presentation" aria-hidden="true">×</span>`
            + '</div>'
            + `<div class="chat-mention-alert-sender">${escapeHtml(sender)} called you out</div>`
            + `<div class="chat-mention-alert-preview">"${escapeHtml(preview)}"</div>`
            + `<div class="chat-mention-alert-cta">Click to open ${escapeHtml(channelLabel)} →</div>`
        );

        card.addEventListener('click', (event) => {
            if (event.target.closest('.chat-mention-alert-dismiss-btn')) {
                event.stopPropagation();
                dismissMentionAlert(alertId);
                return;
            }
            dismissMentionAlert(alertId);
            if (typeof global.RoyalArmiesGameChat?.setActiveTab === 'function' && payload?.channelId) {
                global.RoyalArmiesGameChat.setActiveTab(payload.channelId);
            }
            global.document.getElementById('game-chat-compose-input')?.focus();
        });

        stack.prepend(card);

        const cards = stack.querySelectorAll('.chat-mention-alert-card');
        if (cards.length > MENTION_ALERT_MAX_VISIBLE) {
            cards[cards.length - 1]?.remove();
        }
    }

    function processIncomingMessagesForMentionAlerts(entries, viewerUsername, channelLabel, channelId) {
        const viewer = normalizeUsername(viewerUsername);
        if (!viewer) return;

        (Array.isArray(entries) ? entries : []).forEach((entry) => {
            if (!entry || entry.pending || entry.visible === false || entry.recipientAlertOnly) return;
            if (!entry.id || alertedMessageIds.has(entry.id)) return;
            if (normalizeUsername(entry.author) === viewer) return;

            const mentions = extractMentionedUsernamesFromChatText(entry.text);
            if (!mentions.includes(viewer)) return;

            alertedMessageIds.add(entry.id);
            showMentionAlert({
                sender: entry.author,
                preview: entry.text,
                channelLabel,
                channelId
            });
        });
    }

    global.RoyalArmiesChatMentions = {
        loadMentionRoster,
        wireMentionAutocomplete,
        handleMentionKeydown,
        formatChatMentionBodyHtml,
        extractMentionedUsernamesFromChatText,
        processIncomingMessagesForMentionAlerts,
        hideMentionSuggestDropdown
    };
})(window);

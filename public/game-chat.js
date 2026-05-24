/**
 * Royal Armies in-game chat — server-backed module (messages, UI prefs, community feed).
 */
(function initRoyalArmiesGameChat(global) {
    'use strict';

    const TAB_LABELS = {
        system: 'System',
        global: 'Global',
        country: 'Country',
        alliance: 'Alliance'
    };

    const SYNC_POLL_MS = 12000;
    const UI_SAVE_DEBOUNCE_MS = 350;
    const MIN_WIDTH = 280;
    const MIN_HEIGHT = 200;
    const DEFAULT_WIDTH = 380;
    const DEFAULT_HEIGHT = 320;

    let activeTab = 'global';
    let messagesByChannel = {
        system: [],
        global: [],
        country: [],
        alliance: []
    };
    let communityMessages = [];
    let hasAlliance = false;
    let syncPollTimer = null;
    let uiSaveTimer = null;

    function resolveApiUrl(path) {
        if (typeof global.resolveRoyalArmiesApiUrl === 'function') {
            return global.resolveRoyalArmiesApiUrl(path);
        }
        return path;
    }

    function resolveUsername() {
        const saved = global.localStorage.getItem('activeCommanderUser');
        if (saved && saved.trim()) return saved.trim();
        return '';
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatClockTime(isoOrDate) {
        const date = isoOrDate ? new Date(isoOrDate) : new Date();
        if (Number.isNaN(date.getTime())) return '--:--';
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    function normalizeGameMessage(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const sentAt = raw.sentAt || new Date().toISOString();
        return {
            id: `game-${raw.id}`,
            channel: String(raw.channel || 'global').trim(),
            source: raw.source === 'system' ? 'system' : 'game',
            author: String(raw.sender || 'Commander').trim(),
            text: String(raw.text || '').trim(),
            sentAt,
            displayTime: String(raw.time || '').trim() || formatClockTime(sentAt)
        };
    }

    function normalizeCommunityMessage(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const sentAt = raw.sentAt || new Date().toISOString();
        return {
            id: `community-${raw.id}`,
            channel: 'global',
            source: 'community',
            author: String(raw.sender || 'Commander').trim(),
            text: String(raw.text || '').trim(),
            sentAt,
            displayTime: String(raw.time || '').trim() || formatClockTime(sentAt),
            communityChannel: String(raw.channel || 'general').trim()
        };
    }

    function flattenGameMessages() {
        return Object.keys(messagesByChannel).flatMap((key) => messagesByChannel[key] || []);
    }

    function applyServerPayload(payload) {
        if (!payload || payload.status !== 'ok') return false;

        messagesByChannel = {
            system: (payload.messagesByChannel?.system || []).map(normalizeGameMessage).filter(Boolean),
            global: (payload.messagesByChannel?.global || []).map(normalizeGameMessage).filter(Boolean),
            country: (payload.messagesByChannel?.country || []).map(normalizeGameMessage).filter(Boolean),
            alliance: (payload.messagesByChannel?.alliance || []).map(normalizeGameMessage).filter(Boolean)
        };

        communityMessages = (payload.communityMessages || [])
            .map(normalizeCommunityMessage)
            .filter(Boolean);

        hasAlliance = payload.hasAlliance === true;

        if (payload.ui) {
            applyUiFromServer(payload.ui, { skipServerSave: true });
        }

        updateAllianceTabVisibility();
        updateComposeState();
        renderActiveChatStream();
        return true;
    }

    async function fetchGameChatFromServer() {
        const username = resolveUsername();
        if (!username) return false;

        try {
            const response = await global.fetch(
                resolveApiUrl(`/api/portal/game-chat?username=${encodeURIComponent(username)}`),
                { cache: 'no-store', credentials: 'include' }
            );
            if (!response.ok) return false;
            const payload = await response.json();
            return applyServerPayload(payload);
        } catch (err) {
            console.warn('Game chat sync failed:', err);
            return false;
        }
    }

    async function postGameChatMessage(channel, text) {
        const username = resolveUsername();
        if (!username || !text) return false;

        try {
            const response = await global.fetch(resolveApiUrl('/api/portal/game-chat/messages'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                cache: 'no-store',
                body: JSON.stringify({ username, channel, text })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload.status !== 'ok') {
                console.warn('Game chat post failed:', payload.message || response.status);
                return false;
            }
            return applyServerPayload(payload);
        } catch (err) {
            console.warn('Game chat post error:', err);
            return false;
        }
    }

    async function postSystemEvent(text) {
        const username = resolveUsername();
        if (!username || !text) return false;

        try {
            const response = await global.fetch(resolveApiUrl('/api/portal/game-chat/system-events'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                cache: 'no-store',
                body: JSON.stringify({ username, text })
            });
            if (!response.ok) return false;
            await fetchGameChatFromServer();
            return true;
        } catch (err) {
            console.warn('Game chat system event failed:', err);
            return false;
        }
    }

    function scheduleUiSave(patch) {
        if (uiSaveTimer) global.clearTimeout(uiSaveTimer);
        uiSaveTimer = global.setTimeout(() => {
            uiSaveTimer = null;
            saveUiToServer(patch);
        }, UI_SAVE_DEBOUNCE_MS);
    }

    async function saveUiToServer(patch) {
        const username = resolveUsername();
        if (!username) return;

        try {
            await global.fetch(resolveApiUrl('/api/portal/game-chat/ui'), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                cache: 'no-store',
                body: JSON.stringify({ username, ...patch })
            });
        } catch (err) {
            console.warn('Game chat UI save failed:', err);
        }
    }

    function getMessagesForActiveTab() {
        if (activeTab === 'global') {
            return [...flattenGameMessages(), ...communityMessages]
                .sort((a, b) => Date.parse(a.sentAt || '') - Date.parse(b.sentAt || ''));
        }

        if (activeTab === 'system') {
            return (messagesByChannel.system || [])
                .slice()
                .sort((a, b) => Date.parse(a.sentAt || '') - Date.parse(b.sentAt || ''));
        }

        return (messagesByChannel[activeTab] || [])
            .slice()
            .sort((a, b) => Date.parse(a.sentAt || '') - Date.parse(b.sentAt || ''));
    }

    function resolveMessageToneClass(entry) {
        if (entry.channel === 'system' || entry.source === 'system') {
            return 'game-chat-msg--system';
        }
        if (entry.source === 'community') {
            return 'game-chat-msg--global';
        }
        if (entry.channel === 'country') {
            return 'game-chat-msg--country';
        }
        if (entry.channel === 'alliance') {
            return 'game-chat-msg--alliance';
        }
        return 'game-chat-msg--global';
    }

    function renderActiveChatStream() {
        const viewport = global.document.getElementById('game-chat-messages');
        if (!viewport) return;

        const entries = getMessagesForActiveTab();
        if (!entries.length) {
            viewport.innerHTML = `<div class="game-chat-empty">${escapeHtml(TAB_LABELS[activeTab] || 'Chat')} has no messages yet.</div>`;
            return;
        }

        viewport.innerHTML = entries.map((entry) => {
            const toneClass = resolveMessageToneClass(entry);
            const authorLabel = entry.channel === 'system'
                ? 'System Event'
                : escapeHtml(entry.author || 'Commander');
            const communityTag = entry.source === 'community'
                ? `<span class="game-chat-msg-tag">Community · ${escapeHtml(entry.communityChannel || 'general')}</span>`
                : '';
            const body = entry.channel === 'system'
                ? escapeHtml(entry.text)
                : `<strong class="game-chat-msg-author">${authorLabel}</strong> ${escapeHtml(entry.text)}`;

            return `
                <article class="game-chat-msg ${toneClass}" data-message-id="${escapeHtml(entry.id)}">
                    <div class="game-chat-msg-meta">
                        <span class="game-chat-msg-time">${escapeHtml(entry.displayTime || '--:--')}</span>
                        ${communityTag}
                    </div>
                    <div class="game-chat-msg-body">${body}</div>
                </article>
            `;
        }).join('');

        viewport.scrollTop = viewport.scrollHeight;
    }

    function setActiveTab(tabId, options = {}) {
        if (!TAB_LABELS[tabId]) return;
        if (tabId === 'alliance' && !hasAlliance) return;

        activeTab = tabId;

        global.document.querySelectorAll('.game-chat-tab[data-game-chat-tab]').forEach((btn) => {
            const isActive = btn.getAttribute('data-game-chat-tab') === tabId;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        updateComposeState();
        renderActiveChatStream();

        if (!options.skipServerSave) {
            scheduleUiSave({ activeTab: tabId });
        }
    }

    function updateComposeState() {
        const input = global.document.getElementById('game-chat-compose-input');
        const sendBtn = global.document.getElementById('game-chat-compose-send');
        const hint = global.document.getElementById('game-chat-compose-hint');
        const readOnly = activeTab === 'system';
        const allianceBlocked = activeTab === 'alliance' && !hasAlliance;

        if (input) {
            input.disabled = readOnly || allianceBlocked;
            input.placeholder = readOnly
                ? 'System events appear here automatically.'
                : `Message ${TAB_LABELS[activeTab] || 'chat'}…`;
        }
        if (sendBtn) sendBtn.disabled = readOnly || allianceBlocked;
        if (hint) {
            hint.textContent = readOnly
                ? 'System feed is read-only.'
                : (allianceBlocked ? 'Alliance chat unlocks when your nation forms an alliance.' : '');
            hint.hidden = !(readOnly || allianceBlocked);
        }
    }

    function updateAllianceTabVisibility() {
        const tab = global.document.getElementById('game-chat-tab-alliance');
        if (tab) {
            tab.hidden = !hasAlliance;
            tab.setAttribute('aria-hidden', hasAlliance ? 'false' : 'true');
        }
        if (!hasAlliance && activeTab === 'alliance') {
            setActiveTab('global', { skipServerSave: false });
        }
    }

    function applyPanelOpacity(percent, options = {}) {
        const clamped = Math.max(15, Math.min(100, Number(percent) || 85));
        const alpha = clamped / 100;
        const module = global.document.getElementById('game-chat-module');

        if (module) {
            module.style.setProperty('--game-chat-panel-opacity', String(alpha));
        }

        if (!options.skipPreferenceSync && typeof global.confirmedGameChatOpacity !== 'undefined') {
            global.confirmedGameChatOpacity = clamped;
            global.stagedGameChatOpacity = clamped;
        }

        if (!options.skipSettingsUi) {
            const settingsLabel = global.document.getElementById('game-chat-opacity-value');
            const settingsSlider = global.document.getElementById('game-chat-opacity-slider');
            if (settingsLabel) settingsLabel.textContent = `${clamped}%`;
            if (settingsSlider && Number(settingsSlider.value) !== clamped) {
                settingsSlider.value = String(clamped);
            }
        }
    }

    function applyUiFromServer(ui, options = {}) {
        if (!ui || typeof ui !== 'object') return;

        const module = global.document.getElementById('game-chat-module');
        if (module) {
            const width = Math.max(MIN_WIDTH, Number(ui.width) || DEFAULT_WIDTH);
            const height = Math.max(MIN_HEIGHT, Number(ui.height) || DEFAULT_HEIGHT);
            module.style.setProperty('--game-chat-width', `${width}px`);
            module.style.setProperty('--game-chat-height', `${height}px`);
        }

        applyPanelOpacity(ui.opacity, { skipSettingsUi: true });

        const tab = String(ui.activeTab || 'global').trim();
        if (TAB_LABELS[tab]) {
            setActiveTab(tab, { skipServerSave: true });
        }
    }

    function getFreeformResizeLimits(module, anchorLeft) {
        const sideInset = 16;
        const bottomInset = 16;
        const topInset = 72;
        const maxWidth = Math.max(MIN_WIDTH, Math.floor(global.innerWidth - anchorLeft - sideInset));
        const maxHeight = Math.max(MIN_HEIGHT, Math.floor(global.innerHeight - bottomInset - topInset));
        return { maxWidth, maxHeight };
    }

    function bindResizeHandle() {
        const module = global.document.getElementById('game-chat-module');
        const handle = global.document.getElementById('game-chat-resize-handle');
        if (!module || !handle) return;

        let startX = 0;
        let startY = 0;
        let startWidth = 0;
        let startHeight = 0;
        let anchorLeft = 0;

        const onPointerMove = (event) => {
            const { maxWidth, maxHeight } = getFreeformResizeLimits(module, anchorLeft);
            const deltaX = event.clientX - startX;
            const deltaY = event.clientY - startY;
            const nextWidth = Math.max(MIN_WIDTH, Math.min(maxWidth, startWidth + deltaX));
            const nextHeight = Math.max(MIN_HEIGHT, Math.min(maxHeight, startHeight - deltaY));
            module.style.setProperty('--game-chat-width', `${nextWidth}px`);
            module.style.setProperty('--game-chat-height', `${nextHeight}px`);
        };

        const endResize = (event) => {
            if (event && handle.hasPointerCapture(event.pointerId)) {
                handle.releasePointerCapture(event.pointerId);
            }
            global.document.removeEventListener('pointermove', onPointerMove);
            global.document.removeEventListener('pointerup', endResize);
            global.document.removeEventListener('pointercancel', endResize);
            module.classList.remove('is-resizing');
            scheduleUiSave({
                width: module.offsetWidth,
                height: module.offsetHeight
            });
        };

        handle.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            startX = event.clientX;
            startY = event.clientY;
            startWidth = module.offsetWidth;
            startHeight = module.offsetHeight;
            anchorLeft = module.getBoundingClientRect().left;
            module.classList.add('is-resizing');
            handle.setPointerCapture(event.pointerId);
            global.document.addEventListener('pointermove', onPointerMove);
            global.document.addEventListener('pointerup', endResize);
            global.document.addEventListener('pointercancel', endResize);
        });
    }

    async function handleComposeSubmit(event) {
        event.preventDefault();
        if (activeTab === 'system') return;
        if (activeTab === 'alliance' && !hasAlliance) return;

        const input = global.document.getElementById('game-chat-compose-input');
        const sendBtn = global.document.getElementById('game-chat-compose-send');
        const text = String(input?.value || '').trim();
        if (!text) return;

        if (sendBtn) sendBtn.disabled = true;
        const ok = await postGameChatMessage(activeTab, text);
        if (ok && input) input.value = '';
        updateComposeState();
    }

    function bindGameChatControls() {
        global.document.querySelectorAll('.game-chat-tab[data-game-chat-tab]').forEach((btn) => {
            btn.addEventListener('click', () => {
                setActiveTab(btn.getAttribute('data-game-chat-tab') || 'global');
            });
        });

        const form = global.document.getElementById('game-chat-compose-form');
        if (form) form.addEventListener('submit', handleComposeSubmit);
    }

    function startSyncPoll() {
        if (syncPollTimer) global.clearInterval(syncPollTimer);
        syncPollTimer = global.setInterval(fetchGameChatFromServer, SYNC_POLL_MS);
    }

    function stopSyncPoll() {
        if (syncPollTimer) {
            global.clearInterval(syncPollTimer);
            syncPollTimer = null;
        }
    }

    function mountGameChatModule() {
        if (!global.document.getElementById('game-page-canvas')) return;
        if (global.document.getElementById('game-chat-module')) return;

        const wrapper = global.document.createElement('div');
        wrapper.innerHTML = `
            <aside id="game-chat-module" class="game-chat-module" aria-label="In-game chat">
                <div class="game-chat-module-panel">
                    <header class="game-chat-module-header">
                        <nav class="game-chat-tabs" role="tablist" aria-label="Chat categories">
                            <button type="button" class="game-chat-tab" data-game-chat-tab="system" role="tab" aria-selected="false">System</button>
                            <button type="button" class="game-chat-tab is-active" data-game-chat-tab="global" role="tab" aria-selected="true">Global</button>
                            <button type="button" class="game-chat-tab" data-game-chat-tab="country" role="tab" aria-selected="false">Country</button>
                            <button type="button" class="game-chat-tab" data-game-chat-tab="alliance" role="tab" aria-selected="false" id="game-chat-tab-alliance" hidden>Alliance</button>
                        </nav>
                        <button type="button" id="game-chat-resize-handle" class="game-chat-resize-handle" aria-label="Resize chat panel" title="Drag to resize"></button>
                    </header>

                    <div id="game-chat-messages" class="game-chat-messages" role="log" aria-live="polite" aria-relevant="additions"></div>

                    <p id="game-chat-compose-hint" class="game-chat-compose-hint" hidden></p>

                    <form id="game-chat-compose-form" class="game-chat-compose-form">
                        <input id="game-chat-compose-input" class="game-chat-compose-input" type="text" maxlength="500" autocomplete="off" placeholder="Message Global…">
                        <button id="game-chat-compose-send" type="submit" class="game-chat-compose-send">Send</button>
                    </form>
                </div>
            </aside>
        `.trim();

        const module = wrapper.firstElementChild;
        if (!module) return;
        global.document.body.appendChild(module);
    }

    async function bootGameChatModule() {
        if (!global.document.getElementById('game-page-canvas')) return;

        mountGameChatModule();
        bindGameChatControls();
        bindResizeHandle();

        await fetchGameChatFromServer();
        startSyncPoll();

        global.addEventListener('pagehide', stopSyncPoll);
    }

    global.RoyalArmiesGameChat = {
        refresh: fetchGameChatFromServer,
        appendSystemEvent: postSystemEvent,
        setActiveTab,
        getActiveTab: () => activeTab,
        applyPanelOpacity
    };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', () => {
            bootGameChatModule();
        });
    } else {
        bootGameChatModule();
    }
})(window);

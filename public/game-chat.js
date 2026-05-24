/**
 * Royal Armies in-game chat — fixed lower-left module with category tabs,
 * transparency settings, resize, and community chat aggregation for Global.
 */
(function initRoyalArmiesGameChat(global) {
    'use strict';

    const STORAGE_MESSAGES_KEY = 'royalArmiesGameChatMessages';
    const STORAGE_OPACITY_KEY = 'savedGameChatOpacity';
    const STORAGE_SIZE_KEY = 'savedGameChatPanelSize';
    const STORAGE_ALLIANCE_KEY = 'gameAllianceActive';
    const STORAGE_ACTIVE_TAB_KEY = 'savedGameChatActiveTab';

    const TAB_LABELS = {
        system: 'System',
        global: 'Global',
        country: 'Country',
        alliance: 'Alliance'
    };

    const CHANNELS = ['system', 'global', 'country', 'alliance'];
    const COMMUNITY_POLL_MS = 30000;
    const MIN_WIDTH = 280;
    const MIN_HEIGHT = 200;
    const DEFAULT_WIDTH = 380;
    const DEFAULT_HEIGHT = 320;

    let activeTab = 'global';
    let gameMessages = [];
    let communityMessages = [];
    let communityPollTimer = null;

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

    function hasActiveAlliance() {
        return global.localStorage.getItem(STORAGE_ALLIANCE_KEY) === 'true';
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

    function loadStoredMessages() {
        try {
            const raw = global.localStorage.getItem(STORAGE_MESSAGES_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            gameMessages = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
        } catch (_err) {
            gameMessages = [];
        }
    }

    function saveStoredMessages() {
        try {
            global.localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(gameMessages.slice(-400)));
        } catch (_err) {
            /* ignore */
        }
    }

    function createMessage(channel, text, author, source) {
        const sentAt = new Date().toISOString();
        return {
            id: `game-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            channel,
            source: source || 'game',
            author: author || 'System',
            text: String(text || '').trim(),
            sentAt,
            displayTime: formatClockTime(sentAt)
        };
    }

    function appendGameMessage(channel, text, author, source) {
        const entry = createMessage(channel, text, author, source);
        if (!entry.text) return null;
        gameMessages.push(entry);
        saveStoredMessages();
        renderActiveChatStream();
        return entry;
    }

    function seedDemoMessagesIfEmpty() {
        if (gameMessages.some((entry) => entry.channel === 'system')) return;
        appendGameMessage(
            'system',
            'Khaeran has captured Thornwall from Aethelgard.',
            'System',
            'game'
        );
        appendGameMessage(
            'global',
            'Commanders, rally at the capital gates before the next Age cycle.',
            'Herald',
            'game'
        );
        appendGameMessage(
            'country',
            'Country channel secured — same-nation allies only.',
            'System',
            'game'
        );
        if (hasActiveAlliance()) {
            appendGameMessage(
                'alliance',
                'Alliance channel online — coordinate with allied nations here.',
                'System',
                'game'
            );
        }
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

    async function fetchCommunityMessagesForGlobalFeed() {
        try {
            const response = await global.fetch(resolveApiUrl('/api/portal/community-chat'), {
                cache: 'no-store',
                credentials: 'include'
            });
            if (!response.ok) return;

            const payload = await response.json();
            if (payload.status !== 'ok' || !Array.isArray(payload.messages)) return;

            communityMessages = payload.messages
                .map(normalizeCommunityMessage)
                .filter(Boolean);
            renderActiveChatStream();
        } catch (err) {
            console.warn('Game chat community sync failed:', err);
        }
    }

    function startCommunityPoll() {
        if (communityPollTimer) global.clearInterval(communityPollTimer);
        fetchCommunityMessagesForGlobalFeed();
        communityPollTimer = global.setInterval(fetchCommunityMessagesForGlobalFeed, COMMUNITY_POLL_MS);
    }

    function stopCommunityPoll() {
        if (communityPollTimer) {
            global.clearInterval(communityPollTimer);
            communityPollTimer = null;
        }
    }

    function getMessagesForActiveTab() {
        const combined = [
            ...gameMessages,
            ...communityMessages
        ];

        if (activeTab === 'global') {
            return [...gameMessages, ...communityMessages]
                .sort((a, b) => Date.parse(a.sentAt || '') - Date.parse(b.sentAt || ''));
        }

        if (activeTab === 'system') {
            return gameMessages
                .filter((entry) => entry.channel === 'system')
                .sort((a, b) => Date.parse(a.sentAt || '') - Date.parse(b.sentAt || ''));
        }

        return combined
            .filter((entry) => entry.channel === activeTab)
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

    function setActiveTab(tabId) {
        if (!TAB_LABELS[tabId]) return;
        if (tabId === 'alliance' && !hasActiveAlliance()) return;

        activeTab = tabId;
        try {
            global.localStorage.setItem(STORAGE_ACTIVE_TAB_KEY, tabId);
        } catch (_err) {
            /* ignore */
        }

        global.document.querySelectorAll('.game-chat-tab[data-game-chat-tab]').forEach((btn) => {
            const isActive = btn.getAttribute('data-game-chat-tab') === tabId;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        updateComposeState();
        renderActiveChatStream();
    }

    function updateComposeState() {
        const input = global.document.getElementById('game-chat-compose-input');
        const sendBtn = global.document.getElementById('game-chat-compose-send');
        const hint = global.document.getElementById('game-chat-compose-hint');
        const readOnly = activeTab === 'system';
        const allianceBlocked = activeTab === 'alliance' && !hasActiveAlliance();

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
        const visible = hasActiveAlliance();
        if (tab) {
            tab.hidden = !visible;
            tab.setAttribute('aria-hidden', visible ? 'false' : 'true');
        }
        if (!visible && activeTab === 'alliance') {
            setActiveTab('global');
        }
    }

    function applyOpacityPercent(percent) {
        const clamped = Math.max(15, Math.min(100, Number(percent) || 85));
        const alpha = clamped / 100;
        const module = global.document.getElementById('game-chat-module');
        const readout = global.document.getElementById('game-chat-opacity-value');
        const slider = global.document.getElementById('game-chat-opacity-slider');

        if (module) {
            module.style.setProperty('--game-chat-panel-opacity', String(alpha));
        }
        if (readout) readout.textContent = `${clamped}%`;
        if (slider && Number(slider.value) !== clamped) slider.value = String(clamped);

        try {
            global.localStorage.setItem(STORAGE_OPACITY_KEY, String(clamped));
        } catch (_err) {
            /* ignore */
        }
    }

    function restoreOpacitySetting() {
        const stored = Number(global.localStorage.getItem(STORAGE_OPACITY_KEY));
        applyOpacityPercent(Number.isFinite(stored) ? stored : 85);
    }

    function restorePanelSize() {
        const module = global.document.getElementById('game-chat-module');
        if (!module) return;

        try {
            const raw = global.localStorage.getItem(STORAGE_SIZE_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            if (parsed && Number(parsed.width) >= MIN_WIDTH && Number(parsed.height) >= MIN_HEIGHT) {
                module.style.width = `${parsed.width}px`;
                module.style.height = `${parsed.height}px`;
                return;
            }
        } catch (_err) {
            /* ignore */
        }

        module.style.width = `${DEFAULT_WIDTH}px`;
        module.style.height = `${DEFAULT_HEIGHT}px`;
    }

    function persistPanelSize() {
        const module = global.document.getElementById('game-chat-module');
        if (!module) return;
        try {
            global.localStorage.setItem(STORAGE_SIZE_KEY, JSON.stringify({
                width: module.offsetWidth,
                height: module.offsetHeight
            }));
        } catch (_err) {
            /* ignore */
        }
    }

    function bindResizeHandle() {
        const module = global.document.getElementById('game-chat-module');
        const handle = global.document.getElementById('game-chat-resize-handle');
        if (!module || !handle) return;

        let startX = 0;
        let startY = 0;
        let startWidth = 0;
        let startHeight = 0;

        const onPointerMove = (event) => {
            const maxWidth = Math.min(global.innerWidth - 32, Math.floor(global.innerWidth * 0.55));
            const maxHeight = Math.min(global.innerHeight - 120, Math.floor(global.innerHeight * 0.65));
            const nextWidth = Math.max(MIN_WIDTH, Math.min(maxWidth, startWidth + (event.clientX - startX)));
            const nextHeight = Math.max(MIN_HEIGHT, Math.min(maxHeight, startHeight - (event.clientY - startY)));
            module.style.width = `${nextWidth}px`;
            module.style.height = `${nextHeight}px`;
        };

        const onPointerUp = () => {
            global.document.removeEventListener('pointermove', onPointerMove);
            global.document.removeEventListener('pointerup', onPointerUp);
            module.classList.remove('is-resizing');
            persistPanelSize();
        };

        handle.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            startX = event.clientX;
            startY = event.clientY;
            startWidth = module.offsetWidth;
            startHeight = module.offsetHeight;
            module.classList.add('is-resizing');
            global.document.addEventListener('pointermove', onPointerMove);
            global.document.addEventListener('pointerup', onPointerUp);
        });
    }

    function handleComposeSubmit(event) {
        event.preventDefault();
        if (activeTab === 'system') return;
        if (activeTab === 'alliance' && !hasActiveAlliance()) return;

        const input = global.document.getElementById('game-chat-compose-input');
        const text = String(input?.value || '').trim();
        if (!text) return;

        appendGameMessage(activeTab, text, resolveUsername() || 'Commander', 'game');
        if (input) input.value = '';
    }

    function bindGameChatControls() {
        global.document.querySelectorAll('.game-chat-tab[data-game-chat-tab]').forEach((btn) => {
            btn.addEventListener('click', () => {
                setActiveTab(btn.getAttribute('data-game-chat-tab') || 'global');
            });
        });

        const form = global.document.getElementById('game-chat-compose-form');
        if (form) form.addEventListener('submit', handleComposeSubmit);

        const slider = global.document.getElementById('game-chat-opacity-slider');
        if (slider) {
            slider.addEventListener('input', () => {
                applyOpacityPercent(slider.value);
            });
        }
    }

    function restoreActiveTab() {
        const stored = global.localStorage.getItem(STORAGE_ACTIVE_TAB_KEY);
        if (stored && TAB_LABELS[stored]) {
            if (stored === 'alliance' && !hasActiveAlliance()) {
                setActiveTab('global');
                return;
            }
            setActiveTab(stored);
            return;
        }
        setActiveTab('global');
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
                    </header>

                    <div class="game-chat-settings-bar" aria-label="Chat module settings">
                        <label class="game-chat-settings-label" for="game-chat-opacity-slider">Transparency</label>
                        <input type="range" id="game-chat-opacity-slider" class="game-chat-opacity-slider" min="15" max="100" step="5" value="85">
                        <span id="game-chat-opacity-value" class="game-chat-opacity-value">85%</span>
                    </div>

                    <div id="game-chat-messages" class="game-chat-messages" role="log" aria-live="polite" aria-relevant="additions"></div>

                    <p id="game-chat-compose-hint" class="game-chat-compose-hint" hidden></p>

                    <form id="game-chat-compose-form" class="game-chat-compose-form">
                        <input id="game-chat-compose-input" class="game-chat-compose-input" type="text" maxlength="500" autocomplete="off" placeholder="Message Global…">
                        <button id="game-chat-compose-send" type="submit" class="game-chat-compose-send">Send</button>
                    </form>
                </div>
                <button type="button" id="game-chat-resize-handle" class="game-chat-resize-handle" aria-label="Resize chat panel"></button>
            </aside>
        `.trim();

        const module = wrapper.firstElementChild;
        if (!module) return;
        global.document.body.appendChild(module);
    }

    function bootGameChatModule() {
        if (!global.document.getElementById('game-page-canvas')) return;

        mountGameChatModule();
        loadStoredMessages();
        seedDemoMessagesIfEmpty();
        restorePanelSize();
        restoreOpacitySetting();
        updateAllianceTabVisibility();
        bindGameChatControls();
        bindResizeHandle();
        restoreActiveTab();
        startCommunityPoll();

        global.addEventListener('pagehide', stopCommunityPoll);
    }

    global.RoyalArmiesGameChat = {
        setAllianceActive(active) {
            try {
                global.localStorage.setItem(STORAGE_ALLIANCE_KEY, active ? 'true' : 'false');
            } catch (_err) {
                /* ignore */
            }
            updateAllianceTabVisibility();
            renderActiveChatStream();
            updateComposeState();
        },
        appendSystemEvent(text) {
            return appendGameMessage('system', text, 'System', 'game');
        },
        refreshCommunityFeed: fetchCommunityMessagesForGlobalFeed,
        setActiveTab,
        getActiveTab: () => activeTab
    };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', bootGameChatModule);
    } else {
        bootGameChatModule();
    }
})(window);

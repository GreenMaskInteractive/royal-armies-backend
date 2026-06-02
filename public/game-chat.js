/**
 * Royal Armies in-game chat — server-backed module (messages, UI prefs, community feed).
 */
(function initRoyalArmiesGameChat(global) {
    'use strict';

    const TAB_LABELS = {
        system: 'System',
        global: 'Global',
        country: 'Country',
        alliance: 'Alliance',
        music: 'Music'
    };

    const SYNC_POLL_LIVE_MS = 2500;
    const SYNC_POLL_BACKGROUND_MS = 10000;
    const UI_SAVE_DEBOUNCE_MS = 350;
    const MIN_WIDTH = 280;
    const MIN_HEIGHT = 200;
    const MAX_WIDTH = 960;
    const MAX_HEIGHT = 840;
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
    let viewerRestrictions = null;
    let composeErrorMessage = '';
    let hasAlliance = false;
    let syncPollTimer = null;
    let uiSaveTimer = null;
    let chatSessionEnabled = false;
    let chatSyncSince = '';
    let chatPollInFlight = false;
    let ageChatPoppedOut = false;

    function isGameChatUnlocked() {
        if (typeof global.isOfficialAgePageActive === 'function') {
            return global.isOfficialAgePageActive();
        }
        if (global.RoyalArmiesOfficialAge && typeof global.RoyalArmiesOfficialAge.isOfficialAgePageActive === 'function') {
            return global.RoyalArmiesOfficialAge.isOfficialAgePageActive();
        }
        return false;
    }

    function getAgeBottomChatMessagesHost() {
        return global.document.getElementById('age-map-bottom-chat-messages-host');
    }

    function getAgeBottomChatComposeHost() {
        return global.document.getElementById('age-map-bottom-chat-compose-host');
    }

    function getAgeChatDockHosts() {
        const messagesHost = getAgeBottomChatMessagesHost();
        const composeHost = getAgeBottomChatComposeHost();
        if (!messagesHost || !composeHost) return [];
        return [messagesHost, composeHost];
    }

    function isAgeChatDocked() {
        return Boolean(getAgeChatDockHosts().length) && isGameChatUnlocked() && !ageChatPoppedOut;
    }

    function getAgeChatDockColumn() {
        return global.document.querySelector('.age-map-bottom-dock-chat-column');
    }

    function buildAgeChatPopoutToggleMarkup() {
        return `
            <button
                type="button"
                id="age-game-chat-popout-toggle"
                class="game-chat-popout-toggle"
                aria-pressed="false"
                aria-label="Pop chat out to a larger window"
                title="Pop out chat">
                <span class="game-chat-popout-toggle-label">Pop out</span>
            </button>
        `.trim();
    }

    function ensureAgeChatPopoutOverlay() {
        let overlay = global.document.getElementById('age-game-chat-popout-overlay');
        if (overlay) return overlay;

        overlay = global.document.createElement('div');
        overlay.id = 'age-game-chat-popout-overlay';
        overlay.className = 'age-game-chat-popout-overlay';
        overlay.hidden = true;
        overlay.setAttribute('role', 'presentation');
        overlay.innerHTML = `
            <div class="age-game-chat-popout-panel" role="dialog" aria-modal="true" aria-label="Game chat">
                <div id="age-game-chat-popout-shell" class="age-game-chat-popout-shell"></div>
            </div>
        `.trim();
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                setAgeChatPoppedOut(false);
            }
        });
        global.document.body.appendChild(overlay);
        return overlay;
    }

    function ensureAgeChatDockPlaceholder() {
        const column = getAgeChatDockColumn();
        if (!column) return null;

        let placeholder = global.document.getElementById('age-map-bottom-chat-docked-placeholder');
        if (placeholder) return placeholder;

        placeholder = global.document.createElement('div');
        placeholder.id = 'age-map-bottom-chat-docked-placeholder';
        placeholder.className = 'age-map-bottom-chat-docked-placeholder';
        placeholder.hidden = true;
        placeholder.innerHTML = `
            <button
                type="button"
                id="age-game-chat-dock-restore-btn"
                class="age-game-chat-dock-restore-btn">
                Chat open — dock
            </button>
        `.trim();
        column.appendChild(placeholder);
        return placeholder;
    }

    function updateAgeChatPopoutToggle() {
        const toggle = global.document.getElementById('age-game-chat-popout-toggle');
        if (!toggle) return;

        const label = toggle.querySelector('.game-chat-popout-toggle-label');
        const popped = ageChatPoppedOut;
        toggle.setAttribute('aria-pressed', popped ? 'true' : 'false');
        toggle.setAttribute(
            'aria-label',
            popped ? 'Dock chat back to the map bar' : 'Pop chat out to a larger window'
        );
        toggle.title = popped ? 'Dock chat' : 'Pop out chat';
        if (label) {
            label.textContent = popped ? 'Dock' : 'Pop out';
        }
    }

    function syncAgeHudLayoutAfterChatMove() {
        if (typeof global.syncAgeMapHudLayout === 'function') {
            global.syncAgeMapHudLayout();
            global.requestAnimationFrame(() => {
                global.syncAgeMapHudLayout();
            });
        }
    }

    function setAgeChatPoppedOut(popped) {
        if (!getAgeChatDockHosts().length) return;
        if (ageChatPoppedOut === popped) return;

        const messagesHost = getAgeBottomChatMessagesHost();
        const composeHost = getAgeBottomChatComposeHost();
        const column = getAgeChatDockColumn();
        const overlay = ensureAgeChatPopoutOverlay();
        const shell = overlay.querySelector('#age-game-chat-popout-shell');
        const placeholder = ensureAgeChatDockPlaceholder();
        if (!messagesHost || !composeHost || !shell || !column) return;

        ageChatPoppedOut = popped;
        global.document.body.classList.toggle('age-game-chat-is-popped-out', popped);

        if (popped) {
            shell.appendChild(messagesHost);
            shell.appendChild(composeHost);
            messagesHost.classList.add('is-age-chat-popped-out');
            composeHost.classList.add('is-age-chat-popped-out');
            overlay.hidden = false;
            if (placeholder) placeholder.hidden = false;
        } else {
            column.insertBefore(messagesHost, placeholder || null);
            if (placeholder && placeholder.parentNode === column) {
                column.insertBefore(composeHost, placeholder);
            } else {
                column.appendChild(composeHost);
            }
            messagesHost.classList.remove('is-age-chat-popped-out');
            composeHost.classList.remove('is-age-chat-popped-out');
            overlay.hidden = true;
            if (placeholder) placeholder.hidden = true;
        }

        updateAgeChatPopoutToggle();
        syncAgeHudLayoutAfterChatMove();
    }

    function toggleAgeChatPopout() {
        if (!getAgeChatDockHosts().length) return;
        setAgeChatPoppedOut(!ageChatPoppedOut);
    }

    function ensureAgeChatPopoutControl() {
        if (!getAgeChatDockHosts().length) return;
        const header = global.document.querySelector(
            '.age-map-bottom-chat-messages-host .game-chat-module-header'
        );
        if (!header || header.querySelector('#age-game-chat-popout-toggle')) return;

        header.insertAdjacentHTML('beforeend', buildAgeChatPopoutToggleMarkup());
        updateAgeChatPopoutToggle();
    }

    function setAgeChatDockVisibility(unlocked) {
        if (!unlocked && ageChatPoppedOut) {
            setAgeChatPoppedOut(false);
        }

        getAgeChatDockHosts().forEach((host) => {
            host.hidden = !unlocked;
            host.setAttribute('aria-hidden', unlocked ? 'false' : 'true');
            host.classList.toggle('is-age-chat-gated', !unlocked);
        });

        const placeholder = global.document.getElementById('age-map-bottom-chat-docked-placeholder');
        if (placeholder) {
            placeholder.hidden = !unlocked || !ageChatPoppedOut;
            placeholder.setAttribute('aria-hidden', (!unlocked || !ageChatPoppedOut) ? 'true' : 'false');
            placeholder.classList.toggle('is-age-chat-gated', !unlocked);
        }

        const overlay = global.document.getElementById('age-game-chat-popout-overlay');
        if (overlay) {
            overlay.hidden = !unlocked || !ageChatPoppedOut;
            overlay.setAttribute('aria-hidden', (!unlocked || !ageChatPoppedOut) ? 'true' : 'false');
            overlay.classList.toggle('is-age-chat-gated', !unlocked);
        }
    }

    function refreshGameChatVisibility() {
        const dockHosts = getAgeChatDockHosts();
        const unlocked = isGameChatUnlocked() && chatSessionEnabled;

        if (dockHosts.length) {
            setAgeChatDockVisibility(unlocked);
            return;
        }

        const module = global.document.getElementById('game-chat-module');
        if (!module) return;

        module.hidden = !unlocked;
        module.setAttribute('aria-hidden', unlocked ? 'false' : 'true');
        module.classList.toggle('is-age-chat-gated', !unlocked);
    }

    function resolveApiUrl(path) {
        if (typeof global.resolveRoyalArmiesApiUrl === 'function') {
            return global.resolveRoyalArmiesApiUrl(path);
        }
        return path;
    }

    function resolveUsername() {
        const saved = global.localStorage.getItem('activeCommanderUser');
        if (saved && saved.trim()) {
            const name = saved.trim();
            if (name.toLowerCase() !== 'testaccount') return name;
        }

        if (typeof global.getActiveCommanderUsername === 'function') {
            const name = String(global.getActiveCommanderUsername() || '').trim();
            if (name && name.toLowerCase() !== 'testaccount') return name;
        }

        return '';
    }

    function resolveComposeErrorMessage(response, payload, err) {
        if (err) {
            if (typeof global.isServerUpdateDowntime === 'function'
                && global.isServerUpdateDowntime(response, payload, err)) {
                return 'An update is underway. Expect a moment of downtime.';
            }
            const isLocal = typeof global.isLocalDevelopmentHost === 'function' && global.isLocalDevelopmentHost();
            const isLiveStatic = typeof global.isLiveStaticPreviewHost === 'function' && global.isLiveStaticPreviewHost();
            if (isLocal && isLiveStatic) {
                return 'Could not reach the game server. Run node server.js on port 3000 while using Live Server.';
            }
            if (isLocal) {
                return 'Could not reach the game server. Start it with node server.js.';
            }
            return 'Could not send your message. Check your connection and try again.';
        }

        if (typeof global.isServerUpdateDowntime === 'function'
            && global.isServerUpdateDowntime(response, payload, null)) {
            return 'An update is underway. Expect a moment of downtime.';
        }

        const code = String(payload?.code || payload?.errorCode || '').trim();
        if (code === 'NEXUS-GEN-004') {
            return 'Your commander account was not found on the server. Log in again from the portal.';
        }
        if (code === 'NEXUS-CHAT-010') {
            return 'You are banned from global chat for 15 days because of repeated rule violations.';
        }
        if (code === 'NEXUS-CHAT-011') {
            return 'You are temporarily muted from global chat. The mute lifts in 30 minutes.';
        }
        if (code === 'NEXUS-GEN-002') {
            return 'Sign in from the portal before sending chat messages.';
        }

        const message = String(payload?.message || '').trim();
        if (message) return message;
        if (response && !response.ok) {
            return `Message could not be sent (HTTP ${response.status}).`;
        }
        return 'Message could not be sent. Try again in a moment.';
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

    function isGeneralCommunityChannel(channelId) {
        return String(channelId || 'general').trim().toLowerCase() === 'general';
    }

    function normalizeCommunityMessage(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const communityChannel = String(raw.channel || 'general').trim();
        if (!isGeneralCommunityChannel(communityChannel)) return null;
        const sentAt = raw.sentAt || new Date().toISOString();
        return {
            id: `community-${raw.id}`,
            channel: 'global',
            source: 'community',
            author: String(raw.sender || 'Commander').trim(),
            text: String(raw.text || '').trim(),
            sentAt,
            displayTime: String(raw.time || '').trim() || formatClockTime(sentAt),
            communityChannel,
            visible: raw.visible !== false,
            recipientAlertOnly: raw.recipientAlertOnly === true
        };
    }

    function normalizeViewerKey(value) {
        return String(value || '').trim().toLowerCase();
    }

    function isRoyalGuardBotAuthor(name) {
        if (typeof global.isRoyalGuardBotAccount === 'function') {
            return global.isRoyalGuardBotAccount(name);
        }
        return normalizeViewerKey(name) === 'royal guard bot';
    }

    function isMessageVisibleInGlobalTab(entry, viewerUsername) {
        if (!entry) return false;
        if (isRoyalGuardBotAuthor(entry.author)) return false;

        if (entry.visible === false) {
            if (
                entry.recipientAlertOnly
                && viewerUsername
                && normalizeViewerKey(entry.author) === normalizeViewerKey(viewerUsername)
            ) {
                return true;
            }
            return false;
        }

        return true;
    }

    function applyViewerRestrictionsFromServer(restrictions) {
        viewerRestrictions = restrictions && typeof restrictions === 'object' ? restrictions : null;
    }

    function getActiveGlobalChatRestriction() {
        const active = viewerRestrictions?.active;
        if (!active || !active.until) return null;

        const untilMs = Date.parse(active.until);
        if (!Number.isFinite(untilMs) || untilMs <= Date.now()) return null;
        return active;
    }

    function isGlobalChatComposeBlocked() {
        return activeTab === 'global' && Boolean(getActiveGlobalChatRestriction());
    }

    function flattenGameMessages() {
        return Object.keys(messagesByChannel).flatMap((key) => messagesByChannel[key] || []);
    }

    function sortMessagesBySentAt(entries) {
        return entries.slice().sort((a, b) => Date.parse(a.sentAt || '') - Date.parse(b.sentAt || ''));
    }

    function mergeMessageList(existing, incoming) {
        const merged = new Map();
        (existing || []).forEach((entry) => {
            if (entry && entry.id) merged.set(entry.id, entry);
        });
        (incoming || []).forEach((entry) => {
            if (entry && entry.id) merged.set(entry.id, entry);
        });
        return sortMessagesBySentAt(Array.from(merged.values()));
    }

    function computeChatSyncSince() {
        const candidates = [
            ...flattenGameMessages(),
            ...communityMessages
        ];
        let maxMs = 0;
        candidates.forEach((entry) => {
            const sentMs = Date.parse(entry.sentAt || '');
            if (Number.isFinite(sentMs) && sentMs > maxMs) {
                maxMs = sentMs;
            }
        });
        return maxMs > 0 ? new Date(maxMs).toISOString() : '';
    }

    function replaceChannelsFromServer(payload) {
        messagesByChannel = {
            system: (payload.messagesByChannel?.system || []).map(normalizeGameMessage).filter(Boolean),
            global: (payload.messagesByChannel?.global || []).map(normalizeGameMessage).filter(Boolean),
            country: (payload.messagesByChannel?.country || []).map(normalizeGameMessage).filter(Boolean),
            alliance: (payload.messagesByChannel?.alliance || []).map(normalizeGameMessage).filter(Boolean)
        };

        communityMessages = (payload.communityMessages || [])
            .map(normalizeCommunityMessage)
            .filter(Boolean);
    }

    function mergeChannelsFromServer(payload) {
        Object.keys(messagesByChannel).forEach((channelId) => {
            const incoming = (payload.messagesByChannel?.[channelId] || [])
                .map(normalizeGameMessage)
                .filter(Boolean);
            if (!incoming.length) return;
            processMentionAlertsForEntries(incoming, TAB_LABELS[channelId] || channelId, channelId);
            messagesByChannel[channelId] = mergeMessageList(messagesByChannel[channelId], incoming);
        });

        const incomingCommunity = (payload.communityMessages || [])
            .map(normalizeCommunityMessage)
            .filter(Boolean);
        if (incomingCommunity.length) {
            processMentionAlertsForEntries(incomingCommunity, TAB_LABELS.global, 'global');
            communityMessages = mergeMessageList(communityMessages, incomingCommunity);
        }
    }

    function upsertConfirmedMessageFromServer(channel, serverMessage) {
        if (!serverMessage || typeof serverMessage !== 'object') return;

        if (channel === 'global') {
            const normalized = normalizeCommunityMessage({
                ...serverMessage,
                channel: serverMessage.channel || 'general'
            });
            if (!normalized) return;
            communityMessages = mergeMessageList(
                communityMessages.filter((entry) => !entry.pending),
                [normalized]
            );
            return;
        }

        const normalized = normalizeGameMessage({
            ...serverMessage,
            channel: serverMessage.channel || channel
        });
        if (!normalized) return;
        messagesByChannel[channel] = mergeMessageList(
            (messagesByChannel[channel] || []).filter((entry) => !entry.pending),
            [normalized]
        );
    }

    function applyServerPayload(payload) {
        if (!payload || payload.status !== 'ok') return false;

        if (payload.syncMode === 'incremental' && chatSyncSince) {
            mergeChannelsFromServer(payload);
        } else {
            replaceChannelsFromServer(payload);
        }

        composeErrorMessage = '';

        hasAlliance = payload.hasAlliance === true;
        applyViewerRestrictionsFromServer(payload.viewerRestrictions);
        chatSyncSince = computeChatSyncSince();

        if (typeof global.markServerReachableAgain === 'function') {
            global.markServerReachableAgain();
        }

        if (payload.ui) {
            applyUiFromServer(payload.ui, { skipServerSave: true });
        }

        updateAllianceTabVisibility();
        updateComposeState();
        renderActiveChatStream();
        return true;
    }

    function buildOptimisticMessage(channel, text) {
        const username = resolveUsername();
        const sentAt = new Date().toISOString();
        return {
            id: `pending-${Date.now()}`,
            channel,
            source: 'game',
            author: username || 'Commander',
            text,
            sentAt,
            displayTime: formatClockTime(sentAt),
            pending: true
        };
    }

    async function notifyGameError(response, payload, fallbackTitle, err) {
        if (typeof global.isServerUpdateDowntime === 'function'
            && global.isServerUpdateDowntime(response, payload, err)) {
            if (typeof global.showRiftUpdateUnderwayNotice === 'function') {
                await global.showRiftUpdateUnderwayNotice(fallbackTitle || 'Game chat');
                return;
            }
        }

        if (typeof global.handleRiftApiFailure === 'function') {
            await global.handleRiftApiFailure(response, payload, fallbackTitle || 'Game chat');
            return;
        }
        if (typeof global.handleRoyalArmiesApiFailure === 'function') {
            await global.handleRoyalArmiesApiFailure(response, payload, fallbackTitle || 'Game chat');
            return;
        }
        if (typeof global.showRiftError === 'function') {
            await global.showRiftError(payload, fallbackTitle || 'Game chat');
            return;
        }
        console.warn(fallbackTitle || 'Game chat error:', payload?.message || payload);
    }

    async function fetchGameChatFromServer() {
        const username = resolveUsername();
        if (!username || !chatSessionEnabled) return false;
        if (chatPollInFlight) return false;

        chatPollInFlight = true;

        try {
            const url = new URL(resolveApiUrl('/api/portal/game-chat'), global.location.href);
            url.searchParams.set('username', username);
            if (chatSyncSince) {
                url.searchParams.set('since', chatSyncSince);
            }

            const response = await global.fetch(url.toString(), {
                cache: 'no-store',
                credentials: 'include'
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload.status === 'error') {
                await notifyGameError(response, payload, 'Game chat');
                return false;
            }
            return applyServerPayload(payload);
        } catch (err) {
            console.warn('Game chat sync failed:', err);
            if (typeof global.isServerUpdateDowntime === 'function'
                && global.isServerUpdateDowntime(null, null, err)) {
                if (typeof global.showRiftUpdateUnderwayNotice === 'function') {
                    await global.showRiftUpdateUnderwayNotice('Game chat');
                }
                return false;
            }
            if (typeof global.showRiftNetworkError === 'function') {
                await global.showRiftNetworkError('Game chat');
            } else if (typeof global.showRoyalArmiesNetworkError === 'function') {
                await global.showRoyalArmiesNetworkError('Game chat');
            }
            return false;
        } finally {
            chatPollInFlight = false;
        }
    }

    async function postGameChatMessage(channel, text) {
        const username = resolveUsername();
        if (!username) {
            composeErrorMessage = 'Sign in from the portal before sending chat messages.';
            updateComposeState();
            return false;
        }
        if (!text) return false;

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
                composeErrorMessage = resolveComposeErrorMessage(response, payload, null);
                await notifyGameError(response, payload, 'Game chat');
                updateComposeState();
                return false;
            }

            upsertConfirmedMessageFromServer(channel, payload.message);
            return applyServerPayload(payload);
        } catch (err) {
            console.warn('Game chat post error:', err);
            composeErrorMessage = resolveComposeErrorMessage(null, null, err);
            updateComposeState();
            if (typeof global.isServerUpdateDowntime === 'function'
                && global.isServerUpdateDowntime(null, null, err)) {
                if (typeof global.showRiftUpdateUnderwayNotice === 'function') {
                    await global.showRiftUpdateUnderwayNotice('Game chat');
                }
                return false;
            }
            if (typeof global.showRiftNetworkError === 'function') {
                await global.showRiftNetworkError('Game chat');
            } else if (typeof global.showRoyalArmiesNetworkError === 'function') {
                await global.showRoyalArmiesNetworkError('Game chat');
            }
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
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload.status !== 'ok') {
                await notifyGameError(response, payload, 'System event');
                return false;
            }
            await fetchGameChatFromServer();
            return true;
        } catch (err) {
            console.warn('Game chat system event failed:', err);
            if (typeof global.isServerUpdateDowntime === 'function'
                && global.isServerUpdateDowntime(null, null, err)) {
                if (typeof global.showRiftUpdateUnderwayNotice === 'function') {
                    await global.showRiftUpdateUnderwayNotice('System event');
                }
                return false;
            }
            if (typeof global.showRoyalArmiesNetworkError === 'function') {
                await global.showRoyalArmiesNetworkError('System event');
            }
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
        if (activeTab === 'music') {
            return [];
        }

        if (activeTab === 'global') {
            const viewerUsername = resolveUsername();
            const gameGlobal = messagesByChannel.global || [];
            const merged = sortMessagesBySentAt([...gameGlobal, ...communityMessages]);
            return merged.filter((entry) => isMessageVisibleInGlobalTab(entry, viewerUsername));
        }

        if (activeTab === 'system') {
            return sortMessagesBySentAt(messagesByChannel.system || []);
        }

        return sortMessagesBySentAt(messagesByChannel[activeTab] || []);
    }

    function formatMessageBodyHtml(entry) {
        if (entry.channel === 'system') {
            return escapeHtml(entry.text);
        }

        const authorLabel = escapeHtml(entry.author || 'Commander');
        const textHtml = global.RoyalArmiesChatMentions?.formatChatMentionBodyHtml
            ? global.RoyalArmiesChatMentions.formatChatMentionBodyHtml(entry.text)
            : escapeHtml(entry.text);

        return `<strong class="game-chat-msg-author">${authorLabel}</strong> ${textHtml}`;
    }

    function processMentionAlertsForEntries(entries, channelLabel, channelId) {
        if (!global.RoyalArmiesChatMentions?.processIncomingMessagesForMentionAlerts) return;
        global.RoyalArmiesChatMentions.processIncomingMessagesForMentionAlerts(
            entries,
            resolveUsername(),
            channelLabel,
            channelId
        );
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
        if (activeTab === 'music') {
            if (global.RoyalArmiesMusicFlow && typeof global.RoyalArmiesMusicFlow.refreshChatMusicPanel === 'function') {
                global.RoyalArmiesMusicFlow.refreshChatMusicPanel();
            }
            return;
        }

        const viewport = global.document.getElementById('game-chat-messages');
        if (!viewport) return;

        const entries = getMessagesForActiveTab();
        if (!entries.length) {
            viewport.innerHTML = `<div class="game-chat-empty">${escapeHtml(TAB_LABELS[activeTab] || 'Chat')} has no messages yet.</div>`;
            return;
        }

        viewport.innerHTML = entries.map((entry) => {
            const toneClass = resolveMessageToneClass(entry);
            const communityTag = entry.source === 'community'
                ? `<span class="game-chat-msg-tag">Community · ${escapeHtml(entry.communityChannel || 'general')}</span>`
                : '';
            const body = formatMessageBodyHtml(entry);

            const pendingClass = entry.pending ? ' is-pending' : '';

            return `
                <article class="game-chat-msg ${toneClass}${pendingClass}" data-message-id="${escapeHtml(entry.id)}">
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

        updateMusicTabLayout();
        updateComposeState();
        renderActiveChatStream();

        if (!options.skipServerSave) {
            scheduleUiSave({ activeTab: tabId });
        }
    }

    function updateMusicTabLayout() {
        const isMusic = activeTab === 'music';
        const messages = global.document.getElementById('game-chat-messages');
        const musicPanel = global.document.getElementById('game-chat-music-panel');
        const composeHost = getAgeBottomChatComposeHost();
        const modulePanel = global.document.querySelector('#game-chat-module .game-chat-module-panel');

        if (messages) messages.hidden = isMusic;
        if (musicPanel) musicPanel.hidden = !isMusic;
        if (composeHost) composeHost.hidden = isMusic;
        if (modulePanel) modulePanel.classList.toggle('game-chat-module-panel--music-tab', isMusic);
    }

    function updateComposeState() {
        const input = global.document.getElementById('game-chat-compose-input');
        const sendBtn = global.document.getElementById('game-chat-compose-send');
        const hint = global.document.getElementById('game-chat-compose-hint');
        const readOnly = activeTab === 'system' || activeTab === 'music';
        const isMusicTab = activeTab === 'music';
        const allianceBlocked = activeTab === 'alliance' && !hasAlliance;
        const globalRestriction = getActiveGlobalChatRestriction();
        const globalBlocked = isGlobalChatComposeBlocked();

        if (input) {
            input.disabled = readOnly || allianceBlocked || globalBlocked;
            if (globalBlocked && globalRestriction?.type === 'ban') {
                input.placeholder = 'You are banned from global chat.';
            } else if (globalBlocked && globalRestriction?.type === 'mute') {
                input.placeholder = 'You are temporarily muted from global chat.';
            } else {
                input.placeholder = readOnly
                    ? 'System events appear here automatically.'
                    : `Message ${TAB_LABELS[activeTab] || 'chat'}…`;
            }
        }
        if (sendBtn) sendBtn.disabled = readOnly || allianceBlocked || globalBlocked;
        if (hint) {
            if (composeErrorMessage) {
                hint.textContent = composeErrorMessage;
            } else if (globalBlocked && globalRestriction?.type === 'ban') {
                hint.textContent = '🔴 You are banned from global chat for 15 days because of repeated rule violations.';
            } else if (globalBlocked && globalRestriction?.type === 'mute') {
                hint.textContent = '⏳ You are temporarily muted from global chat. The mute lifts in 30 minutes.';
            } else {
                hint.textContent = readOnly
                    ? 'System feed is read-only.'
                    : (allianceBlocked ? 'Alliance chat unlocks when your nation forms an alliance.' : '');
            }
            hint.hidden = isMusicTab || !(composeErrorMessage || readOnly || allianceBlocked || globalBlocked);
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

    function clampChatPanelSize(width, height, anchorLeft) {
        const sideInset = 16;
        const bottomInset = 16;
        const topInset = 72;
        const viewportMaxWidth = Math.floor(global.innerWidth - anchorLeft - sideInset);
        const viewportMaxHeight = Math.floor(global.innerHeight - bottomInset - topInset);
        const maxWidth = Math.min(MAX_WIDTH, viewportMaxWidth);
        const maxHeight = Math.min(MAX_HEIGHT, viewportMaxHeight);

        return {
            width: Math.max(MIN_WIDTH, Math.min(maxWidth, Math.round(width))),
            height: Math.max(MIN_HEIGHT, Math.min(maxHeight, Math.round(height)))
        };
    }

    function applyUiFromServer(ui, options = {}) {
        if (!ui || typeof ui !== 'object') return;

        const module = global.document.getElementById('game-chat-module');
        if (module && !getAgeChatDockHosts().length) {
            const anchorLeft = module.getBoundingClientRect().left;
            const { width, height } = clampChatPanelSize(
                Number(ui.width) || DEFAULT_WIDTH,
                Number(ui.height) || DEFAULT_HEIGHT,
                anchorLeft
            );
            module.style.setProperty('--game-chat-width', `${width}px`);
            module.style.setProperty('--game-chat-height', `${height}px`);
        }

        applyPanelOpacity(ui.opacity, { skipSettingsUi: true });

        const tab = String(ui.activeTab || 'global').trim();
        if (TAB_LABELS[tab]) {
            const staleServerTab = activeTab === 'music' && tab !== 'music';
            if (!staleServerTab) {
                setActiveTab(tab, { skipServerSave: true });
            }
        }
    }

    function bindResizeHandle() {
        if (global.__riftGameChatResizeBound) return;
        global.__riftGameChatResizeBound = true;

        const module = global.document.getElementById('game-chat-module');
        const handle = global.document.getElementById('game-chat-resize-handle');
        if (!module || !handle || getAgeChatDockHosts().length) return;

        let startX = 0;
        let startY = 0;
        let startWidth = 0;
        let startHeight = 0;
        let anchorLeft = 0;

        const onPointerMove = (event) => {
            const deltaX = event.clientX - startX;
            const deltaY = event.clientY - startY;
            const { width, height } = clampChatPanelSize(
                startWidth + deltaX,
                startHeight - deltaY,
                anchorLeft
            );
            module.style.setProperty('--game-chat-width', `${width}px`);
            module.style.setProperty('--game-chat-height', `${height}px`);
        };

        const endResize = (event) => {
            if (event && handle.hasPointerCapture(event.pointerId)) {
                handle.releasePointerCapture(event.pointerId);
            }
            global.document.removeEventListener('pointermove', onPointerMove);
            global.document.removeEventListener('pointerup', endResize);
            global.document.removeEventListener('pointercancel', endResize);
            module.classList.remove('is-resizing');
            const { width, height } = clampChatPanelSize(
                module.offsetWidth,
                module.offsetHeight,
                anchorLeft
            );
            module.style.setProperty('--game-chat-width', `${width}px`);
            module.style.setProperty('--game-chat-height', `${height}px`);
            scheduleUiSave({ width, height });
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
        if (activeTab === 'system' || activeTab === 'music') return;
        if (activeTab === 'alliance' && !hasAlliance) return;
        if (isGlobalChatComposeBlocked()) return;

        const input = global.document.getElementById('game-chat-compose-input');
        const sendBtn = global.document.getElementById('game-chat-compose-send');
        const text = String(input?.value || '').trim();
        if (!text) return;

        composeErrorMessage = '';

        const optimistic = buildOptimisticMessage(activeTab, text);
        if (activeTab === 'global') {
            communityMessages = [...communityMessages, {
                ...optimistic,
                source: 'community',
                communityChannel: 'general',
                visible: true,
                recipientAlertOnly: false
            }];
        } else {
            messagesByChannel[activeTab] = [...(messagesByChannel[activeTab] || []), optimistic];
        }
        if (input) input.value = '';
        global.RoyalArmiesChatMentions?.hideMentionSuggestDropdown?.();
        renderActiveChatStream();

        if (sendBtn) sendBtn.disabled = true;
        try {
            const ok = await postGameChatMessage(activeTab, text);
            if (!ok) {
                if (activeTab === 'global') {
                    communityMessages = communityMessages.filter((entry) => entry.id !== optimistic.id);
                } else {
                    messagesByChannel[activeTab] = (messagesByChannel[activeTab] || [])
                        .filter((entry) => entry.id !== optimistic.id);
                }
                if (input) input.value = text;
                renderActiveChatStream();
            }
            updateComposeState();
        } finally {
            if (sendBtn) sendBtn.disabled = false;
        }
    }

    function bindGameChatControls() {
        if (global.__riftGameChatControlsBound) return;
        global.__riftGameChatControlsBound = true;

        global.document.addEventListener('click', (event) => {
            if (event.target.closest('#age-game-chat-popout-toggle, #age-game-chat-dock-restore-btn')) {
                event.preventDefault();
                toggleAgeChatPopout();
                return;
            }

            const tab = event.target.closest('.game-chat-tab[data-game-chat-tab]');
            if (!tab) return;
            setActiveTab(tab.getAttribute('data-game-chat-tab') || 'global');
        });

        global.document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && ageChatPoppedOut) {
                event.preventDefault();
                setAgeChatPoppedOut(false);
            }
        });

        global.document.addEventListener('submit', (event) => {
            const form = event.target.closest('#game-chat-compose-form');
            if (!form) return;
            handleComposeSubmit(event);
        });

        global.document.addEventListener('keydown', (event) => {
            const input = event.target;
            if (input?.id === 'game-chat-compose-input') {
                if (global.RoyalArmiesChatMentions?.handleMentionKeydown?.(event)) {
                    return;
                }
            }

            if (event.key !== 'Enter' || event.shiftKey) return;
            if (!input || input.id !== 'game-chat-compose-input') return;
            if (input.disabled) return;

            event.preventDefault();

            const form = global.document.getElementById('game-chat-compose-form');
            if (form && typeof form.requestSubmit === 'function') {
                form.requestSubmit();
                return;
            }

            handleComposeSubmit(event);
        });
    }

    function getSyncPollIntervalMs() {
        if (global.document.hidden) return SYNC_POLL_BACKGROUND_MS;
        return SYNC_POLL_LIVE_MS;
    }

    function startSyncPoll() {
        if (syncPollTimer) global.clearInterval(syncPollTimer);
        syncPollTimer = global.setInterval(fetchGameChatFromServer, getSyncPollIntervalMs());
    }

    function restartSyncPoll() {
        if (!chatSessionEnabled) return;
        startSyncPoll();
    }

    function stopSyncPoll() {
        if (syncPollTimer) {
            global.clearInterval(syncPollTimer);
            syncPollTimer = null;
        }
    }

    function buildGameChatTabsMarkup() {
        return `
            <nav class="game-chat-tabs" role="tablist" aria-label="Chat categories">
                <button type="button" class="game-chat-tab" data-game-chat-tab="system" role="tab" aria-selected="false">System</button>
                <button type="button" class="game-chat-tab is-active" data-game-chat-tab="global" role="tab" aria-selected="true">Global</button>
                <button type="button" class="game-chat-tab" data-game-chat-tab="country" role="tab" aria-selected="false">Country</button>
                <button type="button" class="game-chat-tab" data-game-chat-tab="alliance" role="tab" aria-selected="false" id="game-chat-tab-alliance" hidden>Alliance</button>
                <button type="button" class="game-chat-tab" data-game-chat-tab="music" role="tab" aria-selected="false">Music</button>
            </nav>
        `.trim();
    }

    function buildGameChatMusicPanelMarkup() {
        return '<div id="game-chat-music-panel" class="game-chat-music-panel" hidden aria-label="Soundtrack player"></div>';
    }

    function buildGameChatComposeMarkup() {
        return `
            <form id="game-chat-compose-form" class="game-chat-compose-form">
                <div class="chat-input-mention-anchor game-chat-compose-mention-anchor">
                    <input id="game-chat-compose-input" class="game-chat-compose-input" type="text" maxlength="500" autocomplete="off" placeholder="Message Global…" aria-label="Chat message">
                    <div class="chat-mention-suggest-dropdown" role="listbox" aria-label="Mention suggestions" hidden></div>
                </div>
                <button id="game-chat-compose-send" type="submit" class="game-chat-compose-send">Send</button>
            </form>
        `.trim();
    }

    function wireGameChatMentionAutocomplete() {
        const input = global.document.getElementById('game-chat-compose-input');
        global.RoyalArmiesChatMentions?.wireMentionAutocomplete?.(input);
    }

    function mountAgeDockedChatSplit() {
        const messagesHost = getAgeBottomChatMessagesHost();
        const composeHost = getAgeBottomChatComposeHost();
        if (!messagesHost || !composeHost) return;
        if (global.document.getElementById('game-chat-messages')) return;

        messagesHost.classList.add('age-map-hud-panel', 'game-chat-module--age-docked');
        messagesHost.setAttribute('aria-label', 'Chat messages');
        messagesHost.innerHTML = `
            <header class="game-chat-module-header">
                ${buildGameChatTabsMarkup()}
                ${buildAgeChatPopoutToggleMarkup()}
            </header>
            <div id="game-chat-messages" class="game-chat-messages" role="log" aria-live="polite" aria-relevant="additions"></div>
            ${buildGameChatMusicPanelMarkup()}
            <p id="game-chat-compose-hint" class="game-chat-compose-hint" hidden></p>
        `.trim();

        composeHost.classList.add('game-chat-module--age-docked');
        composeHost.setAttribute('aria-label', 'Chat message');
        composeHost.innerHTML = buildGameChatComposeMarkup();
        wireGameChatMentionAutocomplete();
    }

    function mountGameChatModule() {
        if (!isGameChatUnlocked()) return;
        if (global.document.getElementById('game-chat-messages')) return;

        if (getAgeChatDockHosts().length) {
            mountAgeDockedChatSplit();
            return;
        }

        const resizeHandleMarkup = '<button type="button" id="game-chat-resize-handle" class="game-chat-resize-handle" aria-label="Resize chat panel" title="Drag to resize"></button>';

        const wrapper = global.document.createElement('div');
        wrapper.innerHTML = `
            <aside id="game-chat-module" class="game-chat-module" aria-label="In-game chat">
                <div class="game-chat-module-panel">
                    <header class="game-chat-module-header">
                        ${buildGameChatTabsMarkup()}
                        ${resizeHandleMarkup}
                    </header>

                    <div id="game-chat-messages" class="game-chat-messages" role="log" aria-live="polite" aria-relevant="additions"></div>
                    ${buildGameChatMusicPanelMarkup()}

                    <p id="game-chat-compose-hint" class="game-chat-compose-hint" hidden></p>

                    ${buildGameChatComposeMarkup()}
                </div>
            </aside>
        `.trim();

        const module = wrapper.firstElementChild;
        if (!module) return;
        global.document.body.appendChild(module);
        wireGameChatMentionAutocomplete();
    }

    async function enableGameChatForOfficialAge() {
        if (!isGameChatUnlocked()) return;

        mountGameChatModule();
        bindGameChatControls();
        updateMusicTabLayout();

        if (global.RoyalArmiesMusicFlow && typeof global.RoyalArmiesMusicFlow.mountAgeChatMusicPlayer === 'function') {
            global.RoyalArmiesMusicFlow.mountAgeChatMusicPlayer();
        }
        global.dispatchEvent(new CustomEvent('royalarmies:age-chat-ready'));

        if (getAgeChatDockHosts().length) {
            ensureAgeChatPopoutControl();
        } else {
            bindResizeHandle();
        }

        if (chatSessionEnabled) {
            refreshGameChatVisibility();
            return;
        }

        chatSessionEnabled = true;
        chatSyncSince = '';
        refreshGameChatVisibility();
        await fetchGameChatFromServer();
        startSyncPoll();
    }

    async function bootGameChatModule() {
        if (!isGameChatUnlocked()) return;

        global.addEventListener('pagehide', stopSyncPoll);
        global.document.addEventListener('visibilitychange', restartSyncPoll);
    }

    global.RoyalArmiesGameChat = {
        refresh: fetchGameChatFromServer,
        appendSystemEvent: postSystemEvent,
        setActiveTab,
        getActiveTab: () => activeTab,
        applyPanelOpacity,
        refreshVisibility: refreshGameChatVisibility,
        enableForOfficialAge: enableGameChatForOfficialAge,
        isAgeChatPoppedOut: () => ageChatPoppedOut,
        setAgeChatPoppedOut,
        toggleAgeChatPopout
    };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', () => {
            bootGameChatModule();
        });
    } else {
        bootGameChatModule();
    }
})(window);

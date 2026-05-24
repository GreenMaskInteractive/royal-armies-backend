/**
 * server.js - Royal Armies
 * The NEXUS (Node-Encryption X-System & Utility Server)
 * The Heart of the RAGE Engine & AVI Interface
 */

/* ==========================================
   NEXUS MODULE: CORE & ENVIRONMENT
   ========================================== */

/* --- Section: Dependencies & Database Bootstrap --- */

/* Block 1: Core Module Imports */
const path = require('path');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

/* Block 2: Environment Path Resolution */
const isProduction = process.env.RENDER === 'true';
const dbPath = isProduction ? '/data/db.json' : path.join(__dirname, 'db.json');

/* Block 3: Ledger Database Initialization */
const adapter = new FileSync(dbPath);
const db = low(adapter);
db.defaults({
    commanders: [],
    portal: {
        maintenanceAlert: {
            active: !isProduction,
            title: isProduction ? 'Scheduled maintenance' : 'Site under active development',
            message: isProduction
                ? ''
                : 'Royal Armies is still being built. You may hit brief outages, broken pages, or restarts while we finish the main website and game portal. Thanks for your patience during early access.',
            windowLabel: isProduction
                ? ''
                : 'Expect occasional downtime until the main site launch is complete.'
        },
        communityChat: {
            lastPurgeAt: null,
            nextMessageId: 1,
            channels: {
                general: [],
                bugs: [],
                gameplay: [],
                help: [],
                offtopic: []
            },
            archive: []
        },
        gameChat: {
            nextMessageId: 1,
            channels: {
                system: [],
                global: [],
                country: [],
                alliance: []
            },
            archive: []
        }
    },
    mailbox: {
        messages: [],
        drafts: []
    }
}).write();

const PORTAL_EARLY_ACCESS_MAINTENANCE = {
    active: true,
    title: 'Site under active development',
    message: 'Royal Armies is still being built. You may hit brief outages, broken pages, or restarts while we finish the main website and game portal. Thanks for your patience during early access.',
    windowLabel: 'Expect occasional downtime until the main site launch is complete.'
};

function getPortalMaintenanceAlert() {
    const stored = db.get('portal.maintenanceAlert').value() || {};

    if (stored.dismissed === true) {
        return {
            active: false,
            title: String(stored.title || 'Scheduled maintenance').trim().slice(0, 120),
            message: '',
            windowLabel: ''
        };
    }

    const message = String(stored.message || '').trim();
    const windowLabel = String(stored.windowLabel || '').trim();

    return {
        active: true,
        title: String(stored.title || PORTAL_EARLY_ACCESS_MAINTENANCE.title).trim().slice(0, 120),
        message: (message || PORTAL_EARLY_ACCESS_MAINTENANCE.message).slice(0, 600),
        windowLabel: (windowLabel || PORTAL_EARLY_ACCESS_MAINTENANCE.windowLabel).slice(0, 160)
    };
}

function setPortalMaintenanceAlert(patch = {}) {
    const stored = db.get('portal.maintenanceAlert').value() || {};
    const next = {
        active: stored.active !== false,
        dismissed: stored.dismissed === true,
        title: stored.title || PORTAL_EARLY_ACCESS_MAINTENANCE.title,
        message: stored.message || '',
        windowLabel: stored.windowLabel || ''
    };

    if (patch.active === false) {
        next.active = false;
        next.dismissed = patch.dismissed !== false;
    } else if (patch.active === true) {
        next.active = true;
        next.dismissed = false;
    }

    if (patch.dismissed === true) {
        next.dismissed = true;
        next.active = false;
    } else if (patch.dismissed === false) {
        next.dismissed = false;
        next.active = true;
    }

    if (patch.title !== undefined) {
        next.title = String(patch.title || PORTAL_EARLY_ACCESS_MAINTENANCE.title).trim().slice(0, 120);
    }
    if (patch.message !== undefined) {
        next.message = String(patch.message || '').trim().slice(0, 600);
    }
    if (patch.windowLabel !== undefined) {
        next.windowLabel = String(patch.windowLabel || '').trim().slice(0, 160);
    }

    if (next.active && !next.message) {
        next.message = PORTAL_EARLY_ACCESS_MAINTENANCE.message;
    }
    if (next.active && !next.windowLabel) {
        next.windowLabel = PORTAL_EARLY_ACCESS_MAINTENANCE.windowLabel;
    }

    db.set('portal.maintenanceAlert', next).write();
    return getPortalMaintenanceAlert();
}

const MAINTENANCE_ALERT_DEV_KEY = process.env.MAINTENANCE_ALERT_DEV_KEY || 'local-dev-maintenance';

/* --- Section: Age Portal live presence (in-memory; no mock accounts) --- */
const AGE_SESSION_ONLINE_TTL_MS = 5 * 60 * 1000;
const PORTAL_BROWSE_ONLINE_TTL_MS = 90 * 1000;
const CHAT_PRESENCE_ACTIVE_MS = 25 * 1000;
const PORTAL_PRESENCE_IDLE_MS = 10 * 60 * 1000;
const HIDDEN_REGISTRATION_USERNAMES = new Set(['testaccount']);
const ageSessionByUser = new Map();
const portalBrowseSessionByUser = new Map();

function isHiddenRegistrationUsername(username) {
    return HIDDEN_REGISTRATION_USERNAMES.has(String(username || '').trim().toLowerCase());
}

/** Accounts that may load the full ledger recipient roster in Messages (compose ➕ list). */
function isMailboxRecipientRosterAdmin(username) {
    return String(username || '').trim().toLowerCase() === 'caleb_admin';
}

/* --- Section: Community chat (ledger-backed, 100 active per channel, 15-day purge) --- */
const COMMUNITY_CHAT_CHANNEL_IDS = ['general', 'bugs', 'gameplay', 'help', 'offtopic'];
const COMMUNITY_CHAT_MAX_ACTIVE_PER_CHANNEL = 100;
const COMMUNITY_CHAT_PURGE_EVERY_MS = 15 * 24 * 60 * 60 * 1000;
const COMMUNITY_CHAT_TEXT_MAX = 1200;
const COMMUNITY_CHAT_ARCHIVE_MAX = 50000;
const ROYAL_GUARD_BOT_SENDER = 'Royal Guard Bot';

const GAME_CHAT_CHANNEL_IDS = ['system', 'global', 'country', 'alliance'];
const GAME_CHAT_UI_TABS = new Set(GAME_CHAT_CHANNEL_IDS);
const GAME_CHAT_TEXT_MAX = 500;
const GAME_CHAT_MAX_PER_CHANNEL = 300;
const GAME_CHAT_ARCHIVE_MAX = 10000;

function isCommunityChatChannelId(channelId) {
    return COMMUNITY_CHAT_CHANNEL_IDS.includes(String(channelId || '').trim());
}

function normalizeCommunityChatReplyTo(replyTo) {
    if (!replyTo || typeof replyTo !== 'object') return null;
    const sender = String(replyTo.sender || '').trim().slice(0, 80);
    if (!sender) return null;
    return {
        id: Number.isFinite(Number(replyTo.id)) ? Number(replyTo.id) : null,
        sender,
        snippet: String(replyTo.snippet || '').trim().slice(0, 220)
    };
}

function sanitizeCommunityChatMessageEntry(raw = {}) {
    const sentAt = raw.sentAt || raw.createdAt || new Date().toISOString();
    const time = String(raw.time || '').trim().slice(0, 12)
        || new Date(sentAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

    return {
        id: Number(raw.id),
        channel: isCommunityChatChannelId(raw.channel) ? raw.channel : 'general',
        sender: String(raw.sender || '').trim().slice(0, 80),
        text: String(raw.text || '').trim().slice(0, COMMUNITY_CHAT_TEXT_MAX),
        time,
        sentAt,
        visible: raw.visible !== false,
        originalText: String(raw.originalText || raw.text || '').trim().slice(0, COMMUNITY_CHAT_TEXT_MAX),
        recipientAlertOnly: raw.recipientAlertOnly === true,
        replyTo: normalizeCommunityChatReplyTo(raw.replyTo),
        isEdited: raw.isEdited === true,
        editedAt: raw.editedAt ? String(raw.editedAt).slice(0, 32) : null
    };
}

function normalizeCommunityChatStore(stored) {
    const channels = {};
    COMMUNITY_CHAT_CHANNEL_IDS.forEach((channelId) => {
        const rows = Array.isArray(stored?.channels?.[channelId]) ? stored.channels[channelId] : [];
        channels[channelId] = rows
            .map(sanitizeCommunityChatMessageEntry)
            .filter((row) => Number.isFinite(row.id) && row.sender && row.text);
    });

    const archive = Array.isArray(stored?.archive) ? stored.archive : [];

    return {
        lastPurgeAt: stored?.lastPurgeAt ? String(stored.lastPurgeAt) : null,
        nextMessageId: Math.max(1, parseInt(stored?.nextMessageId, 10) || 1),
        channels,
        archive: archive.slice(-COMMUNITY_CHAT_ARCHIVE_MAX)
    };
}

function readCommunityChatStore() {
    const stored = db.get('portal.communityChat').value();
    const normalized = normalizeCommunityChatStore(stored || {});
    if (!stored) {
        db.set('portal.communityChat', normalized).write();
    }
    return normalized;
}

function writeCommunityChatStore(store) {
    const next = normalizeCommunityChatStore(store);
    db.set('portal.communityChat', next).write();
    return next;
}

function archiveCommunityChatMessage(message, reason) {
    return {
        ...sanitizeCommunityChatMessageEntry(message),
        archivedAt: new Date().toISOString(),
        archiveReason: reason === 'scheduled_purge' ? 'scheduled_purge' : 'cap_trim'
    };
}

function trimCommunityChatChannelToCap(store, channelId) {
    const list = store.channels[channelId];
    while (list.length > COMMUNITY_CHAT_MAX_ACTIVE_PER_CHANNEL) {
        const removed = list.shift();
        store.archive.push(archiveCommunityChatMessage(removed, 'cap_trim'));
    }
    if (store.archive.length > COMMUNITY_CHAT_ARCHIVE_MAX) {
        store.archive = store.archive.slice(-COMMUNITY_CHAT_ARCHIVE_MAX);
    }
}

function maybeRunScheduledCommunityChatPurge(store) {
    const now = Date.now();
    if (!store.lastPurgeAt) {
        store.lastPurgeAt = new Date(now).toISOString();
        return store;
    }

    const lastMs = Date.parse(store.lastPurgeAt);
    if (!Number.isFinite(lastMs) || now - lastMs < COMMUNITY_CHAT_PURGE_EVERY_MS) {
        return store;
    }

    COMMUNITY_CHAT_CHANNEL_IDS.forEach((channelId) => {
        const list = store.channels[channelId];
        while (list.length) {
            const removed = list.shift();
            store.archive.push(archiveCommunityChatMessage(removed, 'scheduled_purge'));
        }
    });

    if (store.archive.length > COMMUNITY_CHAT_ARCHIVE_MAX) {
        store.archive = store.archive.slice(-COMMUNITY_CHAT_ARCHIVE_MAX);
    }

    store.lastPurgeAt = new Date(now).toISOString();
    return store;
}

function getCommunityChatRetentionMeta(store) {
    const lastMs = store.lastPurgeAt ? Date.parse(store.lastPurgeAt) : Date.now();
    const nextPurgeMs = (Number.isFinite(lastMs) ? lastMs : Date.now()) + COMMUNITY_CHAT_PURGE_EVERY_MS;
    return {
        maxActivePerChannel: COMMUNITY_CHAT_MAX_ACTIVE_PER_CHANNEL,
        purgeIntervalDays: 15,
        lastPurgeAt: store.lastPurgeAt,
        nextPurgeAt: new Date(nextPurgeMs).toISOString()
    };
}

function flattenCommunityChatActiveMessages(store) {
    const rows = [];
    COMMUNITY_CHAT_CHANNEL_IDS.forEach((channelId) => {
        store.channels[channelId].forEach((entry) => rows.push(entry));
    });
    rows.sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt));
    return rows;
}

function appendCommunityChatMessageToStore(store, payload) {
    const channel = isCommunityChatChannelId(payload.channel) ? payload.channel : 'general';
    const sender = String(payload.sender || '').trim().slice(0, 80);
    const text = String(payload.text || '').trim().slice(0, COMMUNITY_CHAT_TEXT_MAX);

    if (!sender || !text) {
        return { error: 'Sender and message text are required.' };
    }

    const poster = String(payload.posterUsername || payload.username || '').trim().toLowerCase();
    const senderKey = sender.toLowerCase();
    const isBot = senderKey === ROYAL_GUARD_BOT_SENDER.toLowerCase();

    if (isBot && payload.systemBot !== true) {
        return { error: 'System bot messages require authorization.' };
    }

    if (!isBot && poster && poster !== senderKey) {
        return { error: 'Sender must match the posting commander.' };
    }

    const replyTo = normalizeCommunityChatReplyTo(payload.replyTo);
    if (replyTo && !isBot) {
        const replySenderKey = String(replyTo.sender || '').trim().toLowerCase();
        if (replySenderKey && replySenderKey === senderKey) {
            return { error: 'You cannot reply to your own message.' };
        }
    }

    const entry = sanitizeCommunityChatMessageEntry({
        id: store.nextMessageId++,
        channel,
        sender,
        text,
        time: payload.time,
        sentAt: new Date().toISOString(),
        visible: payload.visible !== false,
        originalText: payload.originalText || text,
        recipientAlertOnly: false,
        replyTo,
        isEdited: false,
        editedAt: null
    });

    store.channels[channel].push(entry);
    trimCommunityChatChannelToCap(store, channel);
    return { entry, channelMessages: store.channels[channel] };
}

function updateCommunityChatMessageInStore(store, messageId, posterUsername, patch) {
    const id = Number(messageId);
    if (!Number.isFinite(id)) {
        return { error: 'Invalid message id.' };
    }

    const poster = String(posterUsername || '').trim().toLowerCase();
    const text = String(patch.text || '').trim().slice(0, COMMUNITY_CHAT_TEXT_MAX);
    if (!text) {
        return { error: 'Message text cannot be empty.' };
    }

    for (const channelId of COMMUNITY_CHAT_CHANNEL_IDS) {
        const list = store.channels[channelId];
        const index = list.findIndex((row) => row.id === id);
        if (index === -1) continue;

        const row = list[index];
        if (String(row.sender || '').trim().toLowerCase() !== poster) {
            return { error: 'You can only edit your own messages.' };
        }

        const editedAt = new Date().toISOString();
        row.text = text;
        row.originalText = text;
        row.isEdited = true;
        row.editedAt = new Date(editedAt).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        row.sentAt = editedAt;

        return { entry: row, channelMessages: list };
    }

    return { error: 'Message not found.' };
}

function isGameChatChannelId(channelId) {
    return GAME_CHAT_CHANNEL_IDS.includes(String(channelId || '').trim());
}

function sanitizeGameChatMessageEntry(raw = {}) {
    const sentAt = raw.sentAt || new Date().toISOString();
    const time = String(raw.time || '').trim().slice(0, 12)
        || new Date(sentAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const channel = isGameChatChannelId(raw.channel) ? raw.channel : 'global';

    return {
        id: Number(raw.id),
        channel,
        sender: String(raw.sender || '').trim().slice(0, 80),
        text: String(raw.text || '').trim().slice(0, GAME_CHAT_TEXT_MAX),
        time,
        sentAt,
        source: raw.source === 'system' ? 'system' : 'game',
        nationKey: String(raw.nationKey || '').trim().slice(0, 80) || null,
        allianceId: String(raw.allianceId || '').trim().slice(0, 80) || null
    };
}

function normalizeGameChatStore(stored) {
    const channels = {};
    GAME_CHAT_CHANNEL_IDS.forEach((channelId) => {
        const rows = Array.isArray(stored?.channels?.[channelId]) ? stored.channels[channelId] : [];
        channels[channelId] = rows
            .map(sanitizeGameChatMessageEntry)
            .filter((row) => Number.isFinite(row.id) && row.sender && row.text);
    });

    return {
        nextMessageId: Math.max(1, parseInt(stored?.nextMessageId, 10) || 1),
        channels,
        archive: Array.isArray(stored?.archive) ? stored.archive.slice(-GAME_CHAT_ARCHIVE_MAX) : []
    };
}

function readGameChatStore() {
    const stored = db.get('portal.gameChat').value();
    const normalized = normalizeGameChatStore(stored || {});
    if (!stored) {
        db.set('portal.gameChat', normalized).write();
    }
    return normalized;
}

function writeGameChatStore(store) {
    const next = normalizeGameChatStore(store);
    db.set('portal.gameChat', next).write();
    return next;
}

function trimGameChatChannelToCap(store, channelId) {
    const list = store.channels[channelId];
    while (list.length > GAME_CHAT_MAX_PER_CHANNEL) {
        const removed = list.shift();
        store.archive.push({
            ...sanitizeGameChatMessageEntry(removed),
            archivedAt: new Date().toISOString()
        });
    }
    if (store.archive.length > GAME_CHAT_ARCHIVE_MAX) {
        store.archive = store.archive.slice(-GAME_CHAT_ARCHIVE_MAX);
    }
}

function appendGameChatSystemEventToStore(store, text) {
    const messageText = String(text || '').trim().slice(0, GAME_CHAT_TEXT_MAX);
    if (!messageText) {
        return { error: 'System event text is required.' };
    }

    const entry = sanitizeGameChatMessageEntry({
        id: store.nextMessageId++,
        channel: 'system',
        sender: 'System',
        text: messageText,
        sentAt: new Date().toISOString(),
        source: 'system'
    });

    store.channels.system.push(entry);
    trimGameChatChannelToCap(store, 'system');
    return { entry };
}

function ensureGameChatSeedMessages(store) {
    if (store.channels.system.length) return store;
    appendGameChatSystemEventToStore(
        store,
        'Khaeran has captured Thornwall from Aethelgard.'
    );
    return store;
}

function appendGameChatMessageToStore(store, payload, commander) {
    const channel = isGameChatChannelId(payload.channel) ? payload.channel : 'global';
    if (channel === 'system') {
        return { error: 'System channel is read-only.' };
    }

    const sender = String(payload.sender || commander?.username || '').trim().slice(0, 80);
    const text = String(payload.text || '').trim().slice(0, GAME_CHAT_TEXT_MAX);
    if (!sender || !text) {
        return { error: 'Sender and message text are required.' };
    }

    const poster = String(payload.posterUsername || payload.username || commander?.username || '').trim().toLowerCase();
    if (poster && poster !== sender.toLowerCase()) {
        return { error: 'Sender must match the posting commander.' };
    }

    const gameNation = String(commander?.gameNation || '').trim();
    const allianceId = String(commander?.allianceId || '').trim();

    if (channel === 'country' && !gameNation) {
        return { error: 'Nation assignment required before using country chat.' };
    }
    if (channel === 'alliance' && !allianceId) {
        return { error: 'Alliance chat unlocks once your nation forms an alliance.' };
    }

    const entry = sanitizeGameChatMessageEntry({
        id: store.nextMessageId++,
        channel,
        sender,
        text,
        sentAt: new Date().toISOString(),
        source: 'game',
        nationKey: channel === 'country' ? gameNation : null,
        allianceId: channel === 'alliance' ? allianceId : null
    });

    store.channels[channel].push(entry);
    trimGameChatChannelToCap(store, channel);
    return { entry, channelMessages: store.channels[channel] };
}

function getGameChatUiFromCommander(commander) {
    const prefs = normalizeCommanderPreferences(commander?.preferences);
    return {
        opacity: prefs.gameChatOpacity,
        width: prefs.gameChatPanelWidth,
        height: prefs.gameChatPanelHeight,
        activeTab: prefs.gameChatActiveTab
    };
}

function filterGameChatMessagesForViewer(store, commander) {
    const gameNation = String(commander?.gameNation || '').trim();
    const allianceId = String(commander?.allianceId || '').trim();
    const nationKey = gameNation.toLowerCase();
    const allianceKey = allianceId.toLowerCase();

    const visible = {};
    GAME_CHAT_CHANNEL_IDS.forEach((channelId) => {
        visible[channelId] = (store.channels[channelId] || []).filter((entry) => {
            if (channelId === 'country') {
                return nationKey && String(entry.nationKey || '').trim().toLowerCase() === nationKey;
            }
            if (channelId === 'alliance') {
                return allianceKey && String(entry.allianceId || '').trim().toLowerCase() === allianceKey;
            }
            return true;
        });
    });

    return {
        messagesByChannel: visible,
        hasAlliance: !!allianceId,
        gameNation,
        allianceId
    };
}

function patchGameChatUiPreferences(commander, body = {}) {
    const current = normalizeCommanderPreferences(commander.preferences);
    const next = { ...current };

    if (body.opacity !== undefined) {
        next.gameChatOpacity = clampNumber(body.opacity, 15, 100, current.gameChatOpacity);
    }
    if (body.width !== undefined) {
        next.gameChatPanelWidth = clampNumber(body.width, 280, 960, current.gameChatPanelWidth);
    }
    if (body.height !== undefined) {
        next.gameChatPanelHeight = clampNumber(body.height, 200, 840, current.gameChatPanelHeight);
    }
    if (body.activeTab !== undefined) {
        const tab = String(body.activeTab || '').trim();
        if (GAME_CHAT_UI_TABS.has(tab)) {
            next.gameChatActiveTab = tab;
        }
    }

    return next;
}

/* --- Section: Commander mailbox (ledger-backed player mail) --- */
const MAILBOX_TOPIC_MAX = 60;
const COMMANDER_PROFILE_BIO_MAX = 250;
const MAILBOX_BODY_MAX = 4000;
const MAILBOX_RECIPIENTS_MAX = 25;
const ROYAL_ARMIES_DISCORD_INVITE_URL = 'https://discord.gg/7tGBCt7cXX';
const WELCOME_SYSTEM_MESSAGE_KEY = 'welcome_to_royal_armies_v1';
const WELCOME_SYSTEM_MESSAGE_FROM = 'Ledger System';
const WELCOME_SYSTEM_MESSAGE_TOPIC = 'Welcome to the Royal Armies!';

function formatMailboxDisplayDate(isoValue) {
    const parsed = Date.parse(isoValue || '');
    if (!Number.isFinite(parsed)) return '';
    return new Date(parsed).toISOString().slice(0, 16).replace('T', ' ');
}

function createMailboxRecordId(seed = Date.now()) {
    return Number(seed);
}

function resolveLedgerCommanderUsername(username) {
    const needle = normalizeLedgerUsername(username);
    if (!needle || isHiddenRegistrationUsername(needle)) return null;

    const commanders = db.get('commanders').value() || [];
    const hit = commanders.find(
        (entry) => String(entry?.username || '').trim().toLowerCase() === needle.toLowerCase()
    );
    return hit ? String(hit.username).trim() : null;
}

function getMailboxMessageStore() {
    const rows = db.get('mailbox.messages').value();
    return Array.isArray(rows) ? rows : [];
}

function getMailboxDraftStore() {
    const rows = db.get('mailbox.drafts').value();
    return Array.isArray(rows) ? rows : [];
}

function writeMailboxMessageStore(rows) {
    db.set('mailbox.messages', rows).write();
}

function writeMailboxDraftStore(rows) {
    db.set('mailbox.drafts', rows).write();
}

function serializeMailboxMessageForClient(row) {
    if (!row) return null;
    return {
        id: row.id,
        from: row.from || '',
        to: row.to || '',
        topic: row.topic || 'No subject',
        body: row.body || '',
        bodyFormat: row.bodyFormat === 'html' ? 'html' : 'text',
        read: !!row.read,
        date: formatMailboxDisplayDate(row.sentAt),
        sentAt: row.sentAt || null
    };
}

function buildWelcomeSystemMessageBodyHtml() {
    return [
        'We are so excited to have you on board! Royal Armies is planned to be the greatest evolutionary version of the PBBG franchise ever made and you will be able to see its development first hand. We hope you enjoy what this game has to offer and can tell all of your friends about it!',
        '',
        `If you would like to be a part of the growing community we have built outside of the game you can always join our official discord <a href="${ROYAL_ARMIES_DISCORD_INVITE_URL}" target="_blank" rel="noopener noreferrer" style="color:#ffd700;text-decoration:underline;">here</a>.`
    ].join('\n\n');
}

function commanderHasWelcomeSystemMessage(messages, ownerLower) {
    return messages.some((row) => row
        && row.channel === 'system'
        && String(row.to || '').toLowerCase() === ownerLower
        && row.systemMessageKey === WELCOME_SYSTEM_MESSAGE_KEY);
}

function ensureWelcomeSystemMessageForCommander(username, options = {}) {
    const owner = resolveLedgerCommanderUsername(username);
    if (!owner) {
        return { delivered: false, reason: 'unknown_commander' };
    }

    const ownerLower = owner.toLowerCase();
    const messages = options.messages || getMailboxMessageStore();

    if (commanderHasWelcomeSystemMessage(messages, ownerLower)) {
        return { delivered: false, reason: 'already_delivered' };
    }

    messages.push({
        id: createMailboxRecordId(),
        channel: 'system',
        systemMessageKey: WELCOME_SYSTEM_MESSAGE_KEY,
        from: WELCOME_SYSTEM_MESSAGE_FROM,
        to: owner,
        topic: WELCOME_SYSTEM_MESSAGE_TOPIC,
        body: buildWelcomeSystemMessageBodyHtml(),
        bodyFormat: 'html',
        read: false,
        sentAt: new Date().toISOString()
    });

    if (options.deferWrite !== true) {
        writeMailboxMessageStore(messages);
    }

    return { delivered: true, reason: 'delivered' };
}

function backfillWelcomeSystemMessagesForAllCommanders() {
    const commanders = db.get('commanders').value() || [];
    const messages = getMailboxMessageStore();
    let delivered = 0;

    commanders.forEach((entry) => {
        const username = String(entry?.username || '').trim();
        if (!username || isHiddenRegistrationUsername(username)) return;
        const result = ensureWelcomeSystemMessageForCommander(username, { messages, deferWrite: true });
        if (result.delivered) delivered += 1;
    });

    let relabeled = 0;
    messages.forEach((row) => {
        if (!row || row.channel !== 'system' || row.systemMessageKey !== WELCOME_SYSTEM_MESSAGE_KEY) return;
        if (String(row.from || '').trim() !== WELCOME_SYSTEM_MESSAGE_FROM) {
            row.from = WELCOME_SYSTEM_MESSAGE_FROM;
            relabeled += 1;
        }
    });

    if (delivered > 0 || relabeled > 0) {
        writeMailboxMessageStore(messages);
        if (delivered > 0) {
            console.log(`[NEXUS] Delivered welcome system message to ${delivered} commander(s).`);
        }
        if (relabeled > 0) {
            console.log(`[NEXUS] Updated welcome system message sender label for ${relabeled} message(s).`);
        }
    }
}

function serializeMailboxSentForClient(row) {
    if (!row) return null;
    const recipients = Array.isArray(row.recipients) && row.recipients.length
        ? row.recipients
        : String(row.to || '')
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean);
    return {
        id: row.id,
        from: row.from || '',
        recipients,
        to: recipients.join(', '),
        topic: row.topic || 'No subject',
        body: row.body || '',
        read: true,
        date: formatMailboxDisplayDate(row.sentAt),
        sentAt: row.sentAt || null
    };
}

function outboundSentGroupKey(row) {
    return `${row.sentAt || ''}|${row.topic || ''}|${row.body || ''}`;
}

/** Creates sent-folder rows for outbound mail that predates sent-channel storage (e.g. live sends). */
function ensureSentCopiesForOutboundMail(owner) {
    const ownerLower = owner.toLowerCase();
    const messages = getMailboxMessageStore();
    const groups = new Map();

    messages.forEach((row) => {
        if (!row || row.channel !== 'inbox') return;
        if (String(row.from || '').trim().toLowerCase() !== ownerLower) return;
        const key = outboundSentGroupKey(row);
        if (!groups.has(key)) {
            groups.set(key, {
                from: row.from,
                topic: row.topic,
                body: row.body,
                sentAt: row.sentAt,
                recipients: []
            });
        }
        const bucket = groups.get(key);
        if (row.to && !bucket.recipients.includes(row.to)) {
            bucket.recipients.push(row.to);
        }
    });

    let changed = false;
    groups.forEach((group, key) => {
        const alreadyStored = messages.some(
            (row) => row.channel === 'sent'
                && String(row.from || '').trim().toLowerCase() === ownerLower
                && outboundSentGroupKey(row) === key
        );
        if (alreadyStored) return;

        messages.push({
            id: createMailboxRecordId(),
            channel: 'sent',
            from: group.from,
            recipients: group.recipients,
            to: group.recipients.join(', '),
            topic: group.topic,
            body: group.body,
            read: true,
            sentAt: group.sentAt || new Date().toISOString()
        });
        changed = true;
    });

    if (changed) writeMailboxMessageStore(messages);
}

function serializeMailboxDraftForClient(row) {
    if (!row) return null;
    return {
        id: row.id,
        recipients: Array.isArray(row.recipients) ? row.recipients : [],
        topic: row.topic || 'Untitled Draft',
        body: row.body || '',
        date: formatMailboxDisplayDate(row.updatedAt) || 'Draft'
    };
}

function getMailboxPayloadForUser(username) {
    const owner = resolveLedgerCommanderUsername(username);
    if (!owner) {
        return { status: 'error', message: 'Unknown commander account.' };
    }

    ensureWelcomeSystemMessageForCommander(owner);

    const ownerLower = owner.toLowerCase();
    const inbox = getMailboxMessageStore()
        .filter((row) => row && row.channel === 'inbox' && String(row.to || '').toLowerCase() === ownerLower)
        .sort((a, b) => Date.parse(b.sentAt || 0) - Date.parse(a.sentAt || 0))
        .map(serializeMailboxMessageForClient);

    const system = getMailboxMessageStore()
        .filter((row) => row && row.channel === 'system' && String(row.to || '').toLowerCase() === ownerLower)
        .sort((a, b) => Date.parse(b.sentAt || 0) - Date.parse(a.sentAt || 0))
        .map(serializeMailboxMessageForClient);

    const drafts = getMailboxDraftStore()
        .filter((row) => row && String(row.owner || '').toLowerCase() === ownerLower)
        .sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0))
        .map(serializeMailboxDraftForClient);

    ensureSentCopiesForOutboundMail(owner);

    const sent = getMailboxMessageStore()
        .filter(
            (row) => row && row.channel === 'sent' && String(row.from || '').toLowerCase() === ownerLower
        )
        .sort((a, b) => Date.parse(b.sentAt || 0) - Date.parse(a.sentAt || 0))
        .map(serializeMailboxSentForClient);

    return { status: 'ok', username: owner, inbox, system, drafts, sent };
}

function pruneAgeSessionOnlineState() {
    const now = Date.now();
    for (const [username, session] of ageSessionByUser.entries()) {
        if (!session) continue;
        session.isOnline = (now - session.lastSeen) <= AGE_SESSION_ONLINE_TTL_MS;
        ageSessionByUser.set(username, session);
    }
}

function touchPortalBrowseSession(username, options = {}) {
    const normalized = normalizeLedgerUsername(username);
    if (!normalized || isHiddenRegistrationUsername(normalized)) return null;

    const now = Date.now();
    const existing = portalBrowseSessionByUser.get(normalized) || {};
    const activityAt = Number(options.lastActivityAt);
    const next = {
        lastSeen: now,
        chatLastSeen: options.onCommunityChat === true
            ? now
            : (existing.chatLastSeen || null),
        lastActivityAt: Number.isFinite(activityAt) && activityAt > 0
            ? Math.max(existing.lastActivityAt || 0, activityAt)
            : (existing.lastActivityAt || now)
    };

    portalBrowseSessionByUser.set(normalized, next);
    return normalized;
}

function resolvePortalBrowsePresenceState(session, now = Date.now()) {
    if (!session) return null;
    if ((now - session.lastSeen) > PORTAL_BROWSE_ONLINE_TTL_MS) return null;

    const lastActivity = session.lastActivityAt || session.lastSeen;
    if ((now - lastActivity) >= PORTAL_PRESENCE_IDLE_MS) return 'idle';

    const chatLastSeen = session.chatLastSeen || 0;
    if (chatLastSeen && (now - chatLastSeen) <= CHAT_PRESENCE_ACTIVE_MS) return 'chat';

    return 'portal';
}

function removePortalBrowseSession(username) {
    const normalized = normalizeLedgerUsername(username);
    if (!normalized) return;
    portalBrowseSessionByUser.delete(normalized);
}

function prunePortalBrowseSessions() {
    const now = Date.now();
    for (const [username, session] of portalBrowseSessionByUser.entries()) {
        if (!session || (now - session.lastSeen) > PORTAL_BROWSE_ONLINE_TTL_MS) {
            portalBrowseSessionByUser.delete(username);
        }
    }
}

function getPortalBrowseMetrics() {
    prunePortalBrowseSessions();

    const now = Date.now();
    const portalBrowsingPlayers = [...portalBrowseSessionByUser.entries()]
        .map(([username, session]) => {
            const presence = resolvePortalBrowsePresenceState(session, now);
            if (!presence) return null;
            return { username, presence };
        })
        .filter(Boolean)
        .sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }));

    return {
        portalBrowsingCount: portalBrowsingPlayers.length,
        portalBrowsingPlayers
    };
}

function getPortalLiveMetricsPayload() {
    const commanders = db.get('commanders').value() || [];
    const visibleCommanders = commanders.filter(
        (entry) => entry && entry.username && !isHiddenRegistrationUsername(entry.username)
    );

    const recentRegistrations = [...visibleCommanders]
        .sort((a, b) => {
            const aTime = Date.parse(a.joinedAt || 0) || 0;
            const bTime = Date.parse(b.joinedAt || 0) || 0;
            return bTime - aTime;
        })
        .slice(0, 25)
        .map((entry) => ({
            username: entry.username,
            joinedAt: entry.joinedAt || null
        }));

    return {
        registeredCount: visibleCommanders.length,
        recentRegistrations,
        ...getAgeSessionMetrics(),
        ...getPortalBrowseMetrics()
    };
}

function getAgeSessionMetrics() {
    pruneAgeSessionOnlineState();

    const playingEntries = [...ageSessionByUser.entries()]
        .filter(([username]) => !isHiddenRegistrationUsername(username))
        .map(([username, session]) => ({
            username,
            joinedAt: session.joinedAt || null,
            isOnline: !!session.isOnline
        }));

    const agePlayingPlayers = playingEntries
        .map((entry) => entry.username)
        .sort((a, b) => a.localeCompare(b));

    const ageOnlinePlayers = playingEntries
        .filter((entry) => entry.isOnline)
        .map((entry) => entry.username)
        .sort((a, b) => a.localeCompare(b));

    return {
        ageOnlineCount: ageOnlinePlayers.length,
        agePlayingCount: agePlayingPlayers.length,
        ageOnlinePlayers,
        agePlayingPlayers
    };
}

function touchAgeSession(username, options = {}) {
    const normalized = normalizeLedgerUsername(username);
    if (!normalized || isHiddenRegistrationUsername(normalized)) return null;

    const now = Date.now();
    const existing = ageSessionByUser.get(normalized);
    const nextSession = {
        joinedAt: existing?.joinedAt || now,
        lastSeen: now,
        isOnline: options.markOnline !== false
    };

    ageSessionByUser.set(normalized, nextSession);
    return nextSession;
}

function removeAgeSession(username) {
    const normalized = normalizeLedgerUsername(username);
    if (!normalized) return;
    ageSessionByUser.delete(normalized);
}

function normalizeLedgerUsername(value) {
    return String(value || '').trim();
}

function normalizeLedgerEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function findCommanderByUsernameOrEmail(identifier) {
    const needle = String(identifier || '').trim();
    if (!needle) return null;

    const commanders = db.get('commanders').value() || [];
    const lowerNeedle = needle.toLowerCase();

    return commanders.find((entry) => {
        if (!entry) return false;
        const username = String(entry.username || '').trim().toLowerCase();
        const email = normalizeLedgerEmail(entry.email);
        return username === lowerNeedle || email === lowerNeedle;
    }) || null;
}

function findCommanderByUsername(username) {
    const normalized = normalizeLedgerUsername(username).toLowerCase();
    if (!normalized) return null;

    const commanders = db.get('commanders').value() || [];
    return commanders.find((entry) => {
        if (!entry) return false;
        return String(entry.username || '').trim().toLowerCase() === normalized;
    }) || null;
}

function normalizeCommanderProfilePrivacy(value) {
    return String(value || '').trim() === 'Private' ? 'Private' : 'Public';
}

function getDefaultCommanderChronicleXp() {
    return {
        version: 2,
        totalXp: 0,
        byActivity: {
            cityBattles: { actions: 0, xp: 0 },
            pvpAttacks: { actions: 0, xp: 0 },
            loreDiscoveries: { actions: 0, xp: 0 }
        },
        lastGain: null
    };
}

function getDefaultCommanderPreferences() {
    return {
        uiScale: 1,
        textScale: 1,
        highContrast: false,
        masterVol: 1,
        musicVol: 0.5,
        narrationVol: 1,
        sfxVol: 0.2,
        verbosity: 'Detailed',
        pings: 'Enabled',
        safetyLock: 'Double-Click',
        dyslexiaFont: false,
        portalMasterVol: 1,
        portalMusicVol: 0.5,
        portalNarrationVol: 1,
        portalSfxVol: 0.2,
        gameChatOpacity: 85,
        gameChatPanelWidth: 380,
        gameChatPanelHeight: 320,
        gameChatActiveTab: 'global'
    };
}

function clampNumber(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

function normalizeCommanderPreferences(raw) {
    const defaults = getDefaultCommanderPreferences();
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
        uiScale: clampNumber(source.uiScale, 0.5, 2, defaults.uiScale),
        textScale: clampNumber(source.textScale, 0.75, 1.5, defaults.textScale),
        highContrast: !!source.highContrast,
        masterVol: clampNumber(source.masterVol, 0, 1, defaults.masterVol),
        musicVol: clampNumber(source.musicVol, 0, 1, defaults.musicVol),
        narrationVol: clampNumber(source.narrationVol, 0, 1, defaults.narrationVol),
        sfxVol: clampNumber(source.sfxVol, 0, 1, defaults.sfxVol),
        verbosity: String(source.verbosity || defaults.verbosity),
        pings: String(source.pings || defaults.pings),
        safetyLock: String(source.safetyLock || defaults.safetyLock),
        dyslexiaFont: !!source.dyslexiaFont,
        portalMasterVol: clampNumber(source.portalMasterVol, 0, 1, defaults.portalMasterVol),
        portalMusicVol: clampNumber(source.portalMusicVol, 0, 1, defaults.portalMusicVol),
        portalNarrationVol: clampNumber(source.portalNarrationVol, 0, 1, defaults.portalNarrationVol),
        portalSfxVol: clampNumber(source.portalSfxVol, 0, 1, defaults.portalSfxVol),
        gameChatOpacity: clampNumber(source.gameChatOpacity, 15, 100, defaults.gameChatOpacity),
        gameChatPanelWidth: clampNumber(source.gameChatPanelWidth, 280, 960, defaults.gameChatPanelWidth),
        gameChatPanelHeight: clampNumber(source.gameChatPanelHeight, 200, 840, defaults.gameChatPanelHeight),
        gameChatActiveTab: GAME_CHAT_UI_TABS.has(String(source.gameChatActiveTab || '').trim())
            ? String(source.gameChatActiveTab).trim()
            : defaults.gameChatActiveTab
    };
}

function normalizeCommanderChronicleXp(raw) {
    const defaults = getDefaultCommanderChronicleXp();
    if (!raw || typeof raw !== 'object') return defaults;
    const byActivity = { ...defaults.byActivity };
    if (raw.byActivity && typeof raw.byActivity === 'object') {
        for (const key of Object.keys(byActivity)) {
            const bucket = raw.byActivity[key];
            if (bucket && typeof bucket === 'object') {
                byActivity[key] = {
                    actions: Math.max(0, parseInt(bucket.actions, 10) || 0),
                    xp: Math.max(0, parseInt(bucket.xp, 10) || 0)
                };
            }
        }
    }
    return {
        version: 2,
        totalXp: Math.max(0, parseInt(raw.totalXp, 10) || 0),
        byActivity,
        lastGain: raw.lastGain && typeof raw.lastGain === 'object' ? raw.lastGain : null
    };
}

function normalizeCommanderDossierArray(raw, maxItems = 200) {
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, maxItems).filter((entry) => entry && typeof entry === 'object');
}

const ACHIEVEMENT_CATALOG_ORDER = ['first_timer', 'whoa_slow_down'];

const ACHIEVEMENT_CATALOG = Object.freeze({
    first_timer: Object.freeze({
        id: 'first_timer',
        label: 'First Timer',
        achievement: 'Logging in for the first time',
        iconUrl: 'images/first_timer.png',
        xpReward: 15
    }),
    whoa_slow_down: Object.freeze({
        id: 'whoa_slow_down',
        label: "Whoa, slow down! We're not finished yet.",
        achievement: 'Attempt to JOIN AGE before the game engine has been developed.',
        iconUrl: 'images/whoa_slow_down_icon.png',
        xpReward: 30
    })
});

function commanderAwardsIncludeId(awards, achievementId) {
    const id = String(achievementId || '').trim();
    if (!id) return false;
    return awards.some((entry) => String(entry?.id || entry?.achievementId || '').trim() === id);
}

function sortCommanderAwardsByCatalog(awards) {
    const orderIndex = (entry) => {
        const id = String(entry?.id || entry?.achievementId || '').trim();
        const idx = ACHIEVEMENT_CATALOG_ORDER.indexOf(id);
        return idx === -1 ? ACHIEVEMENT_CATALOG_ORDER.length + 1 : idx;
    };

    return awards.slice().sort((a, b) => {
        const orderDiff = orderIndex(a) - orderIndex(b);
        if (orderDiff !== 0) return orderDiff;
        const aTime = Date.parse(a?.earnedAt || '') || 0;
        const bTime = Date.parse(b?.earnedAt || '') || 0;
        return aTime - bTime;
    });
}

function buildCommanderAchievementRecord(definition, username) {
    const subject = String(username || '').trim();
    const copy = definition.achievement || definition.description || '';
    return {
        id: definition.id,
        label: definition.label,
        achievement: copy,
        description: copy,
        iconUrl: String(definition.iconUrl || '').trim(),
        xpReward: Number(definition.xpReward ?? definition.xp ?? 0) || 0,
        username: subject,
        earnedAt: new Date().toISOString()
    };
}

function enrichCommanderAwardsForClient(awards) {
    const list = normalizeCommanderDossierArray(awards, 100);
    return sortCommanderAwardsByCatalog(list.map((entry) => {
        const id = String(entry?.id || entry?.achievementId || '').trim();
        const definition = ACHIEVEMENT_CATALOG[id];
        const copy = entry?.achievement || entry?.description || definition?.achievement || '';

        if (!definition) {
            const iconUrl = String(entry?.iconUrl || entry?.icon || '').trim();
            return iconUrl ? { ...entry, iconUrl } : entry;
        }

        return {
            ...entry,
            id: definition.id,
            label: entry.label || definition.label,
            achievement: copy,
            description: copy,
            iconUrl: String(definition.iconUrl).trim(),
            xpReward: Number(entry.xpReward ?? entry.xp ?? definition.xpReward) || 0
        };
    }));
}

function insertCommanderAchievementInCatalogOrder(awards, record) {
    const next = awards.slice();
    const recordId = String(record?.id || '').trim();
    const recordOrder = ACHIEVEMENT_CATALOG_ORDER.indexOf(recordId);
    let insertAt = next.length;

    for (let i = 0; i < next.length; i += 1) {
        const existingId = String(next[i]?.id || next[i]?.achievementId || '').trim();
        const existingOrder = ACHIEVEMENT_CATALOG_ORDER.indexOf(existingId);
        if (existingOrder !== -1 && recordOrder !== -1 && existingOrder > recordOrder) {
            insertAt = i;
            break;
        }
    }

    next.splice(insertAt, 0, record);
    return sortCommanderAwardsByCatalog(next);
}

function ensureFirstTimerAchievementForCommander(commander, options = {}) {
    if (!commander || !commander.username) {
        return { added: false, record: null, reason: 'unknown_commander' };
    }

    const definition = ACHIEVEMENT_CATALOG.first_timer;
    const awards = normalizeCommanderDossierArray(commander.awards, 100);
    if (commanderAwardsIncludeId(awards, definition.id)) {
        const enriched = enrichCommanderAwardsForClient(awards);
        const repaired = JSON.stringify(enriched) !== JSON.stringify(awards);
        commander.awards = enriched;
        if (repaired && options.deferWrite !== true) {
            db.get('commanders')
                .find({ username: commander.username })
                .assign({ awards: commander.awards })
                .write();
        }
        return { added: false, record: null, reason: repaired ? 'repaired_metadata' : 'already_owned' };
    }

    const record = buildCommanderAchievementRecord(definition, commander.username);
    commander.awards = insertCommanderAchievementInCatalogOrder(awards, record);

    if (options.deferWrite !== true) {
        db.get('commanders')
            .find({ username: commander.username })
            .assign({ awards: commander.awards })
            .write();
    }

    return { added: true, record, reason: 'granted' };
}

function backfillFirstTimerAchievementForAllCommanders() {
    const commanders = db.get('commanders').value() || [];
    let added = 0;
    let repaired = 0;

    commanders.forEach((commander) => {
        const username = String(commander?.username || '').trim();
        if (!username || isHiddenRegistrationUsername(username)) return;

        const before = JSON.stringify(commander.awards || []);
        commander.awards = enrichCommanderAwardsForClient(commander.awards);
        if (JSON.stringify(commander.awards) !== before) repaired += 1;

        const result = ensureFirstTimerAchievementForCommander(commander, { deferWrite: true });
        if (result.added) added += 1;
    });

    if (added > 0 || repaired > 0) {
        db.set('commanders', commanders).write();
        if (added > 0) {
            console.log(`[NEXUS] Granted First Timer achievement to ${added} commander(s).`);
        }
        if (repaired > 0) {
            console.log(`[NEXUS] Repaired achievement icon metadata for ${repaired} commander(s).`);
        }
    }
}

function normalizeCommanderAgeResetUsage(raw) {
    if (!raw || typeof raw !== 'object') return {};
    const next = {};
    for (const [key, value] of Object.entries(raw)) {
        if (!value || typeof value !== 'object') continue;
        next[String(key).slice(0, 64)] = {
            sessionKey: String(value.sessionKey || '').slice(0, 128),
            rankResetsUsed: Math.max(0, Math.min(10, parseInt(value.rankResetsUsed, 10) || 0)),
            exileResetsUsed: Math.max(0, Math.min(10, parseInt(value.exileResetsUsed, 10) || 0))
        };
    }
    return next;
}

function serializeCommanderProfileForClient(commander) {
    if (!commander) return null;
    const dossier = serializeCommanderDossierForClient(commander);
    return {
        status: 'ok',
        username: dossier.username,
        bio: dossier.bio,
        privacy: dossier.privacy,
        profileUpdatedAt: dossier.profileUpdatedAt
    };
}

function serializeCommanderDossierForClient(commander) {
    if (!commander) return null;
    const legacyBio = commander.description != null ? String(commander.description) : '';
    const bioSource = commander.bio != null ? String(commander.bio) : legacyBio;
    return {
        status: 'ok',
        username: commander.username,
        bio: bioSource.trim().slice(0, COMMANDER_PROFILE_BIO_MAX),
        privacy: normalizeCommanderProfilePrivacy(commander.privacy),
        avatarUrl: String(commander.avatarUrl || '').slice(0, 512),
        country: String(commander.country || '').trim().slice(0, 120),
        timezone: String(commander.timezone || '').trim().slice(0, 120),
        gameNation: String(commander.gameNation || '').trim().slice(0, 80),
        allianceId: String(commander.allianceId || '').trim().slice(0, 80),
        ageHistory: normalizeCommanderDossierArray(commander.ageHistory, 50),
        awards: enrichCommanderAwardsForClient(commander.awards),
        medals: normalizeCommanderDossierArray(commander.medals, 100),
        membershipTitle: String(commander.membershipTitle || 'Basic').slice(0, 64),
        premiumMember: !!commander.premiumMember,
        chronicleXp: normalizeCommanderChronicleXp(commander.chronicleXp),
        ageResetUsage: normalizeCommanderAgeResetUsage(commander.ageResetUsage),
        preferences: normalizeCommanderPreferences(commander.preferences),
        profileUpdatedAt: commander.profileUpdatedAt || null,
        dossierUpdatedAt: commander.dossierUpdatedAt || null
    };
}

function buildCommanderDossierPatch(body) {
    const patch = {};
    if (!body || typeof body !== 'object') return patch;

    if ('bio' in body) {
        patch.bio = String(body.bio ?? '').trim().slice(0, COMMANDER_PROFILE_BIO_MAX);
    }
    if ('privacy' in body) {
        patch.privacy = normalizeCommanderProfilePrivacy(body.privacy);
    }
    if ('avatarUrl' in body) {
        patch.avatarUrl = String(body.avatarUrl ?? '').trim().slice(0, 512);
    }
    if ('country' in body) {
        patch.country = String(body.country ?? '').trim().slice(0, 120);
    }
    if ('timezone' in body) {
        patch.timezone = String(body.timezone ?? '').trim().slice(0, 120);
    }
    if ('ageHistory' in body) {
        patch.ageHistory = normalizeCommanderDossierArray(body.ageHistory, 50);
    }
    if ('awards' in body) {
        patch.awards = enrichCommanderAwardsForClient(body.awards);
    }
    if ('medals' in body) {
        patch.medals = normalizeCommanderDossierArray(body.medals, 100);
    }
    if ('membershipTitle' in body) {
        patch.membershipTitle = String(body.membershipTitle ?? 'Basic').slice(0, 64);
    }
    if ('premiumMember' in body) {
        patch.premiumMember = !!body.premiumMember;
    }
    if ('chronicleXp' in body) {
        patch.chronicleXp = normalizeCommanderChronicleXp(body.chronicleXp);
    }
    if ('ageResetUsage' in body) {
        patch.ageResetUsage = normalizeCommanderAgeResetUsage(body.ageResetUsage);
    }
    if ('preferences' in body) {
        patch.preferences = normalizeCommanderPreferences(body.preferences);
    }

    if (Object.keys(patch).length) {
        patch.dossierUpdatedAt = new Date().toISOString();
    }
    if ('bio' in patch || 'privacy' in patch || 'avatarUrl' in patch || 'country' in patch || 'timezone' in patch) {
        patch.profileUpdatedAt = patch.dossierUpdatedAt || new Date().toISOString();
    }

    return patch;
}

function getPublicSiteOrigin(req) {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const forwardedHost = req.headers['x-forwarded-host'];
    if (forwardedProto && forwardedHost) {
        const proto = String(forwardedProto).split(',')[0].trim();
        const host = String(forwardedHost).split(',')[0].trim();
        return `${proto}://${host}`;
    }
    const host = req.get('host');
    const protocol = req.protocol || 'http';
    return host ? `${protocol}://${host}` : 'https://royalarmies.com';
}

/* ==========================================
   NEXUS MODULE: SERVER CONFIGURATION
   ========================================== */

/* --- Section: Application Assembly --- */

/* Block 4: Framework & Service Imports */
const express = require('express');
const session = require('express-session');
const fs = require('fs');
const compression = require('compression');
const { Resend } = require('resend');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

/* Block 5: Runtime Constants & Express Instance */
const app = express();
const PORT = process.env.PORT || 3000;
const resend = new Resend('re_eMzwshB5_EmorLivvuzwbHk6jpAzWtpWE');

/* ==========================================
   NEXUS MODULE: SECURITY & MIDDLEWARE
   ========================================== */

/* --- Section: Middleware Token Handlers --- */

/* Block 6: Compression & Body Parsers */
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORTAL_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

app.use(session({
    name: 'royalArmiesPortalSid',
    secret: process.env.SESSION_SECRET || 'royal-armies-nexus-dev-session',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: PORTAL_SESSION_MAX_AGE_MS
    }
}));

function setPortalSessionForUser(req, username, rememberMe = true) {
    req.session.username = String(username || '').trim();
    if (!req.session.username) return;
    if (rememberMe === false) {
        req.session.cookie.maxAge = null;
    } else {
        req.session.cookie.maxAge = PORTAL_SESSION_MAX_AGE_MS;
    }
}

/* Local dev: allow Live Server / static preview origins to call the API on port 3000 */
if (!isProduction) {
    app.use((req, res, next) => {
        const origin = req.headers.origin;
        if (origin && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Dev-Key, Authorization');
            res.setHeader('Vary', 'Origin');
        }
        if (req.method === 'OPTIONS') {
            return res.sendStatus(204);
        }
        next();
    });
}

const PUBLIC_DIR = path.join(__dirname, 'public');

const PORTAL_HTML_PAGES = {
    main: 'main.html',
    game: 'game.html',
    'reset-password': 'reset-password.html'
};

/* Extensionless portal URLs (before static so the address bar never shows .html) */
app.get(['/ageportal', '/ageportal.html', '/index.html'], (req, res) => {
    res.redirect(301, '/main');
});

app.get(['/main.html', '/game.html', '/reset-password.html'], (req, res) => {
    const slug = req.path.replace(/^\//, '').replace(/\.html$/i, '');
    res.redirect(301, `/${slug}`);
});

Object.entries(PORTAL_HTML_PAGES).forEach(([slug, fileName]) => {
    app.get(`/${slug}`, (req, res) => {
        res.sendFile(path.join(PUBLIC_DIR, fileName));
    });
});

app.get(['/', '/index'], (req, res) => {
    res.redirect(301, '/main');
});

/* Block 6b: Portal maintenance alert API (before static so routes are never shadowed) */
app.get('/api/portal/maintenance-alert', (req, res) => {
    res.json(getPortalMaintenanceAlert());
});

app.post('/api/portal/maintenance-alert', (req, res) => {
    const devKey = String(req.headers['x-dev-key'] || req.body?.devKey || '').trim();
    if (!devKey || devKey !== MAINTENANCE_ALERT_DEV_KEY) {
        return res.status(403).json({
            status: 'error',
            message: 'Invalid or missing developer key (X-Dev-Key header).'
        });
    }

    const payload = setPortalMaintenanceAlert(req.body || {});
    res.json({ status: 'ok', ...payload });
});

app.use(express.static(PUBLIC_DIR));

/* --- Section: Email Dispatch Engine --- */

/* Block 7: Welcome Verification Scroll Generator */
const sendWelcomeEmail = async (playerEmail, playerName, token) => {
    try {
        const verificationLink = `https://royalarmies.com/verify?token=${token}`;

        const { data, error } = await resend.emails.send({
            from: 'Royal Armies <noreply@royalarmies.com>',
            to: [playerEmail],
            subject: '📜 Email Verification: Royal Armies',
            html: `
                <div style="font-family: 'Georgia', serif; background-color: #000; color: #f1e0ac; padding: 40px; border: 2px solid #d4af37; text-align: center;">
                    <h1 style="color: #d4af37; text-align: center;">WELCOME, COMMANDER ${playerName.toUpperCase()}</h1>
                    
                    <p style="font-size: 1.1rem; line-height: 1.6; font-style: italic;">
                        Your registration for the Royal Armies MMORTS has been logged. 
                        Please proceed to verify your e-mail by clicking the link below.
                    </p>
                    
                    <div style="margin: 30px 0;">
                        <a href="${verificationLink}" style="background-color: #d4af37; color: #000; padding: 15px 30px; text-decoration: none; font-weight: bold; border-radius: 4px; text-transform: uppercase; display: inline-block;">
                            Verify E-Mail
                        </a>
                    </div>

                    <p style="font-size: 0.8rem; color: #888;">If the button above does not work, copy and paste this link:<br>${verificationLink}</p>
                    
                    <hr style="border: 0; border-top: 1px solid #d4af37; margin: 20px 0;" />
                    <p style="text-align: center; color: #888;">© 2026 GREEN MASK INTERACTIVE</p>
                </div>
            `
        });

        if (error) {
            console.error("❌ Resend Error:", error);
            throw error; 
        }
        console.log("📜 Verification Scroll Sent! ID:", data.id);
        return data;
    } catch (err) {
        console.error("❌ Fatal Post Office Failure:", err);
        throw err; 
    }
};

const PORTAL_PASSWORD_RESET_OK_MESSAGE =
    'If that email matches your account, a password reset link has been sent. Check your inbox.';

const sendPasswordResetEmail = async (req, commanderEmail, commanderUsername, resetToken) => {
    const origin = getPublicSiteOrigin(req);
    const resetLink = `${origin}/reset-password?token=${encodeURIComponent(resetToken)}`;
    const { data, error } = await resend.emails.send({
        from: 'Royal Armies <noreply@royalarmies.com>',
        to: [commanderEmail],
        subject: '📜 Password Reset: Royal Armies',
        html: `
            <div style="background:#000; color:#d4af37; padding:40px; text-align:center; border:2px solid #d4af37; font-family: Georgia, serif;">
                <h1>COMMANDER ${String(commanderUsername).toUpperCase()}</h1>
                <p style="font-style: italic;">Use the link below to set a new password for your Royal Armies account.</p>
                <div style="margin:30px 0;">
                    <a href="${resetLink}" style="background:#d4af37; color:#000; padding:15px 30px; text-decoration:none; font-weight:bold; text-transform:uppercase; display:inline-block;">
                        Reset Password
                    </a>
                </div>
                <p style="font-size:0.8rem; color:#888;">If the button does not work, copy and paste this link:<br>${resetLink}</p>
            </div>`
    });
    if (error) throw error;
    return data;
};

const sendEmailChangeVerificationEmail = async (req, newEmail, commanderUsername, emailChangeToken) => {
    const origin = getPublicSiteOrigin(req);
    const verifyLink = `${origin}/verify-email-change?token=${encodeURIComponent(emailChangeToken)}`;
    const { data, error } = await resend.emails.send({
        from: 'Royal Armies <noreply@royalarmies.com>',
        to: [newEmail],
        subject: '📜 Confirm Your New Email: Royal Armies',
        html: `
            <div style="background:#000; color:#d4af37; padding:40px; text-align:center; border:2px solid #d4af37; font-family: Georgia, serif;">
                <h1>CONFIRM EMAIL CHANGE</h1>
                <p style="font-style: italic;">Commander <strong>${String(commanderUsername).toUpperCase()}</strong> requested to update the account email to this address.</p>
                <p>Click below to confirm. If you did not request this, ignore this message.</p>
                <div style="margin:30px 0;">
                    <a href="${verifyLink}" style="background:#d4af37; color:#000; padding:15px 30px; text-decoration:none; font-weight:bold; text-transform:uppercase; display:inline-block;">
                        Confirm New Email
                    </a>
                </div>
                <p style="font-size:0.8rem; color:#888;">If the button does not work, copy and paste this link:<br>${verifyLink}</p>
            </div>`
    });
    if (error) throw error;
    return data;
};

/* --- Section: API Route Handlers --- */

/* Block 8: Commander Registration Endpoint */
app.post('/register', async (req, res) => {
    const username = normalizeLedgerUsername(req.body?.username);
    const email = normalizeLedgerEmail(req.body?.email);
    const password = String(req.body?.password || '');

    if (!username || !email || !password) {
        return res.status(400).json({
            status: 'error',
            message: 'Username, email, and password are required.'
        });
    }

    const commanders = db.get('commanders').value() || [];
    const emailTaken = commanders.some((entry) => normalizeLedgerEmail(entry?.email) === email);
    const usernameTaken = commanders.some(
        (entry) => String(entry?.username || '').trim().toLowerCase() === username.toLowerCase()
    );

    if (emailTaken) {
        console.log(`[NEXUS] Registration Denied: ${email} already exists.`);
        return res.status(400).json({ 
            status: 'error',
            message: 'This E-Mail is already registered. Contact accountsdept@royalarmies.com!'
        });
    }

    if (usernameTaken) {
        console.log(`[NEXUS] Registration Denied: ${username} already exists.`);
        return res.status(400).json({
            status: 'error',
            message: 'This username is already taken. Choose a different commander name.'
        });
    }

    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const token = crypto.randomBytes(16).toString('hex');
        const joinedAt = new Date().toISOString();
        console.log(`[NEXUS] Handshake Received: Creating ledger entry for ${username}`);

        db.get('commanders').push({ 
            username,
            email,
            password: hashedPassword,
            token,
            verified: false,
            joinedAt,
            bio: '',
            privacy: 'Public',
            avatarUrl: '',
            country: '',
            timezone: '',
            gameNation: '',
            allianceId: '',
            ageHistory: [],
            awards: [],
            medals: [],
            membershipTitle: 'Basic',
            premiumMember: false,
            chronicleXp: getDefaultCommanderChronicleXp(),
            ageResetUsage: {},
            preferences: getDefaultCommanderPreferences()
        }).write();

        console.log(`[NEXUS] Success: ${username} added to the Ledger.`);

        let emailSent = false;
        try {
            await sendWelcomeEmail(email, username, token);
            emailSent = true;
        } catch (emailError) {
            console.error(`[NEXUS] Ledger saved for ${username}, but verification email failed:`, emailError);
        }

        res.status(200).json({
            status: 'logged',
            emailSent,
            username,
            message: emailSent
                ? 'Registration saved. Check your email for the confirmation scroll.'
                : 'Registration saved, but the verification email could not be sent. You may still log in; contact accountsdept@royalarmies.com if you need the verify link resent.'
        });
    } catch (error) {
        console.error('❌ NEXUS Critical Error:', error);
        res.status(500).json({ status: 'error', message: 'Could not save registration. Please try again.' });
    }
});

/* Block 8b: Commander Login (ledger-backed) */
app.post('/api/login', async (req, res) => {
    const identifier = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!identifier || !password) {
        return res.status(400).json({
            status: 'error',
            message: 'Username and password are required.'
        });
    }

    const commander = findCommanderByUsernameOrEmail(identifier);
    if (!commander || !commander.password) {
        return res.status(401).json({
            status: 'error',
            message: 'No registered commander found with those credentials.'
        });
    }

    try {
        const passwordMatches = await bcrypt.compare(password, commander.password);
        if (!passwordMatches) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid password for that commander account.'
            });
        }

        const rememberMe = req.body?.rememberMe !== false;
        setPortalSessionForUser(req, commander.username, rememberMe);

        const achievementUnlocks = [];
        const firstTimerResult = ensureFirstTimerAchievementForCommander(commander);
        if (firstTimerResult.added && firstTimerResult.record) {
            achievementUnlocks.push(firstTimerResult.record);
        }

        ensureWelcomeSystemMessageForCommander(commander.username);

        const localePatch = buildCommanderDossierPatch({
            country: req.body?.country,
            timezone: req.body?.timezone
        });
        if (localePatch.country || localePatch.timezone) {
            db.get('commanders')
                .find({ username: commander.username })
                .assign(localePatch)
                .write();
        }

        res.status(200).json({
            status: 'success',
            username: commander.username,
            verified: !!commander.verified,
            rememberMe,
            achievementUnlocks
        });
    } catch (error) {
        console.error('[NEXUS] Login compare failed:', error);
        res.status(500).json({ status: 'error', message: 'Login could not be completed.' });
    }
});

app.get('/api/auth/session', (req, res) => {
    const username = String(req.session?.username || '').trim();
    if (!username) {
        return res.json({ authenticated: false });
    }
    res.json({
        authenticated: true,
        username
    });
});

/** Local port 3000 only — bootstrap session as caleb_admin for full portal QA. */
app.post('/api/auth/dev-session', (req, res) => {
    if (isProduction) {
        return res.status(403).json({ status: 'error', message: 'Not available in production.' });
    }

    const host = String(req.hostname || '').toLowerCase();
    if (host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]') {
        return res.status(403).json({ status: 'error', message: 'Local development only.' });
    }

    const mode = String(req.body?.mode || 'owner').toLowerCase();
    const username = mode === 'player' ? 'DevPlayer' : 'caleb_admin';
    setPortalSessionForUser(req, username, true);
    res.json({ authenticated: true, username, dev: true, mode: mode === 'player' ? 'player' : 'owner' });
});

app.post('/api/auth/logout', (req, res) => {
    const finish = () => res.json({ status: 'ok' });
    if (typeof req.session?.destroy === 'function') {
        return req.session.destroy((err) => {
            if (err) {
                console.warn('[NEXUS] Session destroy failed:', err);
            }
            res.clearCookie('royalArmiesPortalSid');
            finish();
        });
    }
    res.clearCookie('royalArmiesPortalSid');
    finish();
});

/* Block 9: Password Reset Request Dispatch */
app.post('/request-reset', async (req, res) => {
    const email = normalizeLedgerEmail(req.body?.email);
    console.log(`[NEXUS] Recovery Handshake: Request for ${email}`);
    const commander = findCommanderByUsernameOrEmail(email);

    if (!commander) {
        console.log('⚠️ Recovery Denied: Email not in Ledger.');
        return res.status(200).json({ status: 'success' });
    }

    const resetToken = crypto.randomBytes(16).toString('hex');
    db.get('commanders')
        .find({ username: commander.username })
        .assign({ resetToken })
        .write();

    try {
        await sendPasswordResetEmail(req, commander.email, commander.username, resetToken);
        res.status(200).json({ status: 'success' });
    } catch (err) {
        console.error('[NEXUS] Password reset email failed:', err);
        res.status(500).json({ status: 'error' });
    }
});

/* Block 11: Final Password Reset & Token Destruction */
app.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    
    const commander = db.get('commanders').find({ resetToken: token }).value();

    if (!commander) {
        console.log("⚠️ Invalid or already-used token attempted.");
        return res.status(400).json({ status: "error", message: "Invalid Scroll." });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        db.get('commanders')
          .find({ email: commander.email })
          .assign({ 
              password: hashedPassword, 
              resetToken: null
          })
          .write();

        console.log(`[NEXUS] Password reset successful for: ${commander.username}`);
        res.status(200).json({ status: "success" });
    } catch (err) {
        res.status(500).json({ status: "error" });
    }
});

/* Block 12: Email Verification Landing Pad */
app.get('/verify', (req, res) => {
    const token = req.query.token;
    const commander = db.get('commanders').find({ token }).value();
    if (commander) {
        db.get('commanders').find({ token }).assign({ verified: true }).write();
        res.send(`
            <body style="background: #000; color: #d4af37; font-family: Georgia, serif; text-align: center; padding: 100px 20px; border: 10px solid #1a1a1a; height: 100vh; margin: 0;">
                <h1 style="font-size: 3rem;">EMAIL VERIFIED</h1>
                <p>Thank You for verifying your E-Mail, ${commander.username}.</p>
                <a href="https://royalarmies.com" style="color: #fff;">Return to Royal Armies</a>
            </body>`);
    } else {
        res.status(400).send("<h1>❌ INVALID TOKEN</h1>");
    }
});

/* Block 12b: Portal account security (profile settings) */
app.get('/api/portal/account/security-profile', (req, res) => {
    const username = normalizeLedgerUsername(req.query?.username);
    if (!username) {
        return res.status(400).json({ status: 'error', message: 'Username is required.' });
    }

    const commander = findCommanderByUsername(username);
    if (!commander) {
        return res.status(404).json({ status: 'error', message: 'Commander not found.' });
    }

    res.status(200).json({
        status: 'ok',
        email: commander.email || '',
        verified: !!commander.verified
    });
});

app.get('/api/portal/commanders/:username/public-profile', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.params?.username || '');
    if (!username || isHiddenRegistrationUsername(username)) {
        return res.status(404).json({ status: 'error', message: 'Commander not found.' });
    }

    const commander = findCommanderByUsername(username);
    if (!commander) {
        return res.status(404).json({ status: 'error', message: 'Commander not found.' });
    }

    const dossier = serializeCommanderDossierForClient(commander);
    res.status(200).json({
        ...dossier,
        rank: Number(commander.rank) || 1,
        path: String(commander.path || '').slice(0, 16),
        country: String(commander.country || '—').slice(0, 120),
        timezone: String(commander.timezone || '—').slice(0, 120)
    });
});

app.get('/api/portal/account/profile', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.query?.username || '');
    if (!username) {
        return res.status(400).json({ status: 'error', message: 'Valid commander account required.' });
    }

    const commander = findCommanderByUsername(username);
    if (!commander) {
        return res.status(404).json({ status: 'error', message: 'Commander not found.' });
    }

    res.status(200).json(serializeCommanderProfileForClient(commander));
});

app.patch('/api/portal/account/profile', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return res.status(400).json({ status: 'error', message: 'Valid commander account required.' });
    }

    const commander = findCommanderByUsername(username);
    if (!commander) {
        return res.status(404).json({ status: 'error', message: 'Commander not found.' });
    }

    const patch = buildCommanderDossierPatch({
        bio: req.body?.bio,
        privacy: req.body?.privacy,
        avatarUrl: req.body?.avatarUrl
    });
    if (!Object.keys(patch).length) {
        return res.status(400).json({ status: 'error', message: 'No profile fields to update.' });
    }

    db.get('commanders')
        .find({ username: commander.username })
        .assign(patch)
        .write();

    const updated = findCommanderByUsername(username);
    res.status(200).json(serializeCommanderProfileForClient(updated));
});

app.get('/api/portal/account/dossier', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.query?.username || '');
    if (!username) {
        return res.status(400).json({ status: 'error', message: 'Valid commander account required.' });
    }

    const commander = findCommanderByUsername(username);
    if (!commander) {
        return res.status(404).json({ status: 'error', message: 'Commander not found.' });
    }

    res.status(200).json(serializeCommanderDossierForClient(commander));
});

app.patch('/api/portal/account/dossier', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return res.status(400).json({ status: 'error', message: 'Valid commander account required.' });
    }

    const commander = findCommanderByUsername(username);
    if (!commander) {
        return res.status(404).json({ status: 'error', message: 'Commander not found.' });
    }

    const patch = buildCommanderDossierPatch(req.body?.patch || req.body);
    if (!Object.keys(patch).length) {
        return res.status(400).json({ status: 'error', message: 'No dossier fields to update.' });
    }

    db.get('commanders')
        .find({ username: commander.username })
        .assign(patch)
        .write();

    const updated = findCommanderByUsername(username);
    res.status(200).json(serializeCommanderDossierForClient(updated));
});

app.post('/api/portal/account/request-password-reset', async (req, res) => {
    const username = normalizeLedgerUsername(req.body?.username);
    const email = normalizeLedgerEmail(req.body?.email);

    if (!username || !email) {
        return res.status(400).json({
            status: 'error',
            message: 'Username and signup email are required.'
        });
    }

    const commander = findCommanderByUsername(username);
    const emailMatches = commander && normalizeLedgerEmail(commander.email) === email;

    if (!emailMatches) {
        console.log(`[NEXUS] Portal password reset denied for ${username} (email mismatch or unknown).`);
        return res.status(200).json({
            status: 'ok',
            message: PORTAL_PASSWORD_RESET_OK_MESSAGE
        });
    }

    try {
        const resetToken = crypto.randomBytes(16).toString('hex');
        db.get('commanders')
            .find({ username: commander.username })
            .assign({ resetToken })
            .write();

        await sendPasswordResetEmail(req, commander.email, commander.username, resetToken);
        console.log(`[NEXUS] Portal password reset email sent for ${commander.username}`);
        res.status(200).json({
            status: 'ok',
            message: PORTAL_PASSWORD_RESET_OK_MESSAGE
        });
    } catch (err) {
        console.error('[NEXUS] Portal password reset email failed:', err);
        res.status(500).json({
            status: 'error',
            message: 'Could not send the reset email. Try again shortly.'
        });
    }
});

app.post('/api/portal/account/request-email-change', async (req, res) => {
    const username = normalizeLedgerUsername(req.body?.username);
    const password = String(req.body?.password || '');
    const newEmail = normalizeLedgerEmail(req.body?.newEmail);

    if (!username || !password || !newEmail) {
        return res.status(400).json({
            status: 'error',
            message: 'Username, password, and new email are required.'
        });
    }

    const commander = findCommanderByUsername(username);
    if (!commander || !commander.password) {
        return res.status(401).json({
            status: 'error',
            message: 'Invalid password or commander account.'
        });
    }

    try {
        const passwordMatches = await bcrypt.compare(password, commander.password);
        if (!passwordMatches) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid password or commander account.'
            });
        }

        if (normalizeLedgerEmail(commander.email) === newEmail) {
            return res.status(400).json({
                status: 'error',
                message: 'That email is already on your account.'
            });
        }

        const commanders = db.get('commanders').value() || [];
        const emailTaken = commanders.some((entry) => {
            if (!entry) return false;
            if (String(entry.username || '').trim().toLowerCase() === username.toLowerCase()) {
                return false;
            }
            return normalizeLedgerEmail(entry.email) === newEmail;
        });

        if (emailTaken) {
            return res.status(400).json({
                status: 'error',
                message: 'That email is already registered to another commander.'
            });
        }

        const emailChangeToken = crypto.randomBytes(16).toString('hex');
        db.get('commanders')
            .find({ username: commander.username })
            .assign({
                pendingNewEmail: newEmail,
                emailChangeToken,
                emailChangeRequestedAt: new Date().toISOString()
            })
            .write();

        await sendEmailChangeVerificationEmail(req, newEmail, commander.username, emailChangeToken);
        console.log(`[NEXUS] Email change confirmation sent for ${commander.username} → ${newEmail}`);

        res.status(200).json({
            status: 'ok',
            message: `A confirmation link was sent to ${newEmail}. Open that inbox and click the link to finish updating your email.`
        });
    } catch (err) {
        console.error('[NEXUS] Email change request failed:', err);
        res.status(500).json({
            status: 'error',
            message: 'Could not send the confirmation email. Try again shortly.'
        });
    }
});

app.get('/verify-email-change', (req, res) => {
    const token = String(req.query?.token || '').trim();
    const commander = db.get('commanders').find({ emailChangeToken: token }).value();

    if (!commander || !commander.pendingNewEmail) {
        return res.status(400).send(`
            <body style="background:#000;color:#d4af37;font-family:Georgia,serif;text-align:center;padding:80px 20px;">
                <h1>INVALID OR EXPIRED LINK</h1>
                <p>This email change link is no longer valid.</p>
                <a href="/main" style="color:#fff;">Return to portal</a>
            </body>`);
    }

    const newEmail = normalizeLedgerEmail(commander.pendingNewEmail);
    const commanders = db.get('commanders').value() || [];
    const emailTaken = commanders.some((entry) => {
        if (!entry) return false;
        if (String(entry.username || '').trim().toLowerCase() === String(commander.username).trim().toLowerCase()) {
            return false;
        }
        return normalizeLedgerEmail(entry.email) === newEmail;
    });

    if (emailTaken) {
        db.get('commanders')
            .find({ username: commander.username })
            .assign({
                pendingNewEmail: null,
                emailChangeToken: null,
                emailChangeRequestedAt: null
            })
            .write();

        return res.status(400).send(`
            <body style="background:#000;color:#d4af37;font-family:Georgia,serif;text-align:center;padding:80px 20px;">
                <h1>EMAIL UNAVAILABLE</h1>
                <p>That address is already registered to another commander. Request a new change from your profile.</p>
                <a href="/main" style="color:#fff;">Return to portal</a>
            </body>`);
    }

    db.get('commanders')
        .find({ username: commander.username })
        .assign({
            email: newEmail,
            pendingNewEmail: null,
            emailChangeToken: null,
            emailChangeRequestedAt: null
        })
        .write();

    console.log(`[NEXUS] Email updated for ${commander.username} → ${newEmail}`);
    res.send(`
        <body style="background:#000;color:#d4af37;font-family:Georgia,serif;text-align:center;padding:80px 20px;">
            <h1>EMAIL UPDATED</h1>
            <p>Your account email for <strong>${commander.username}</strong> is now <strong>${newEmail}</strong>.</p>
            <a href="/main" style="color:#fff;">Return to portal</a>
        </body>`);
});

/* Block 13: Age Portal live metrics & presence */
app.get('/api/portal/metrics', (req, res) => {
    res.json(getPortalLiveMetricsPayload());
});

app.get('/api/portal/mailbox-recipient-roster', (req, res) => {
    const requester = normalizeLedgerUsername(req.query?.requester || '');
    if (!isMailboxRecipientRosterAdmin(requester)) {
        return res.json({ allowed: false });
    }

    const commanders = db.get('commanders').value() || [];
    const visible = commanders
        .filter((entry) => entry?.username && !isHiddenRegistrationUsername(entry.username))
        .map((entry) => ({
            username: entry.username,
            verified: !!entry.verified
        }))
        .sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }));

    const all = visible.map((entry) => entry.username);
    const verified = visible.filter((entry) => entry.verified).map((entry) => entry.username);
    const unverified = visible.filter((entry) => !entry.verified).map((entry) => entry.username);

    res.json({
        allowed: true,
        categories: { all, verified, unverified }
    });
});

app.get('/api/portal/mailbox', (req, res) => {
    const username = normalizeLedgerUsername(req.query?.username || '');
    if (!username) {
        return res.status(400).json({ status: 'error', message: 'Username required.' });
    }

    const payload = getMailboxPayloadForUser(username);
    if (payload.status === 'error') {
        return res.status(404).json(payload);
    }

    res.json(payload);
});

app.post('/api/portal/mailbox/send', (req, res) => {
    const sender = resolveLedgerCommanderUsername(req.body?.sender || '');
    const recipientsRaw = Array.isArray(req.body?.recipients) ? req.body.recipients : [];
    const topic = String(req.body?.topic || '').trim().slice(0, MAILBOX_TOPIC_MAX);
    const body = String(req.body?.body || '').trim().slice(0, MAILBOX_BODY_MAX);

    if (!sender) {
        return res.status(400).json({ status: 'error', message: 'Valid sender commander required.' });
    }
    if (!topic || !body) {
        return res.status(400).json({ status: 'error', message: 'Subject and message body are required.' });
    }

    const recipients = [];
    const seen = new Set();
    for (const entry of recipientsRaw) {
        const resolved = resolveLedgerCommanderUsername(entry);
        if (!resolved) continue;
        const key = resolved.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        recipients.push(resolved);
        if (recipients.length >= MAILBOX_RECIPIENTS_MAX) break;
    }

    if (!recipients.length) {
        return res.status(400).json({ status: 'error', message: 'Choose at least one valid recipient.' });
    }

    const sentAt = new Date().toISOString();
    const messages = getMailboxMessageStore();
    const created = [];
    let idSeed = Date.now();

    recipients.forEach((recipient) => {
        const row = {
            id: createMailboxRecordId(idSeed),
            channel: 'inbox',
            from: sender,
            to: recipient,
            topic,
            body,
            read: false,
            sentAt
        };
        idSeed += 1;
        messages.push(row);
        created.push(serializeMailboxMessageForClient(row));
    });

    const sentRow = {
        id: createMailboxRecordId(idSeed),
        channel: 'sent',
        from: sender,
        recipients: recipients.slice(),
        to: recipients.join(', '),
        topic,
        body,
        read: true,
        sentAt
    };
    messages.push(sentRow);

    writeMailboxMessageStore(messages);

    res.status(200).json({
        status: 'ok',
        delivered: created.length,
        recipients,
        messages: created,
        sent: serializeMailboxSentForClient(sentRow)
    });
});

app.post('/api/portal/mailbox/inject', (req, res) => {
    const to = resolveLedgerCommanderUsername(req.body?.to || req.body?.recipient || '');
    const channel = String(req.body?.channel || 'inbox').toLowerCase();
    const topic = String(req.body?.topic || '').trim().slice(0, MAILBOX_TOPIC_MAX) || 'No subject';
    const body = String(req.body?.body || '').trim().slice(0, MAILBOX_BODY_MAX);
    const systemMessageKey = String(req.body?.systemMessageKey || '').trim().slice(0, 80);

    if (!to) {
        return res.status(400).json({ status: 'error', message: 'Valid recipient commander required.' });
    }
    if (channel !== 'inbox' && channel !== 'system') {
        return res.status(400).json({ status: 'error', message: 'Channel must be inbox or system.' });
    }

    const from = channel === 'system'
        ? WELCOME_SYSTEM_MESSAGE_FROM
        : String(req.body?.from || '').trim().slice(0, 80);

    if (channel === 'inbox' && !from) {
        return res.status(400).json({ status: 'error', message: 'Sender name required.' });
    }

    const messages = getMailboxMessageStore();
    if (channel === 'system' && systemMessageKey) {
        const ownerLower = to.toLowerCase();
        const alreadyDelivered = messages.some(
            (row) => row
                && row.channel === 'system'
                && String(row.to || '').toLowerCase() === ownerLower
                && row.systemMessageKey === systemMessageKey
        );
        if (alreadyDelivered) {
            return res.status(200).json({ status: 'ok', message: 'System message already delivered.', skipped: true });
        }
    }

    const sentAt = new Date().toISOString();
    const row = {
        id: createMailboxRecordId(),
        channel,
        from,
        to,
        topic,
        body,
        read: false,
        sentAt
    };

    if (channel === 'system') {
        row.bodyFormat = req.body?.bodyFormat === 'html' ? 'html' : 'text';
        if (systemMessageKey) row.systemMessageKey = systemMessageKey;
    }

    messages.push(row);
    writeMailboxMessageStore(messages);

    res.status(200).json({ status: 'ok', message: serializeMailboxMessageForClient(row) });
});

app.patch('/api/portal/mailbox/:messageId/read', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || req.query?.username || '');
    const messageId = Number(req.params.messageId);

    if (!username) {
        return res.status(400).json({ status: 'error', message: 'Valid commander username required.' });
    }
    if (!Number.isFinite(messageId)) {
        return res.status(400).json({ status: 'error', message: 'Invalid message id.' });
    }

    const ownerLower = username.toLowerCase();
    const messages = getMailboxMessageStore();
    const hit = messages.find(
        (row) => row.id === messageId && String(row.to || '').toLowerCase() === ownerLower
    );

    if (!hit) {
        return res.status(404).json({ status: 'error', message: 'Message not found for this commander.' });
    }

    hit.read = true;
    writeMailboxMessageStore(messages);

    res.json({ status: 'ok', message: serializeMailboxMessageForClient(hit) });
});

app.delete('/api/portal/mailbox/:messageId', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || req.query?.username || '');
    const messageId = Number(req.params.messageId);
    const channel = String(req.body?.channel || req.query?.channel || 'inbox').toLowerCase();

    if (!username) {
        return res.status(400).json({ status: 'error', message: 'Valid commander username required.' });
    }
    if (!Number.isFinite(messageId)) {
        return res.status(400).json({ status: 'error', message: 'Invalid message id.' });
    }

    const ownerLower = username.toLowerCase();
    const messages = getMailboxMessageStore();
    const nextMessages = messages.filter((row) => {
        if (row.id !== messageId) return true;
        if (channel === 'sent') {
            return !(
                row.channel === 'sent'
                && String(row.from || '').toLowerCase() === ownerLower
            );
        }
        if (String(row.to || '').toLowerCase() !== ownerLower) return true;
        if (channel === 'system') return row.channel === 'system';
        return row.channel === 'inbox';
    });

    if (nextMessages.length === messages.length) {
        return res.status(404).json({ status: 'error', message: 'Message not found for this commander.' });
    }

    writeMailboxMessageStore(nextMessages);
    res.json({ status: 'ok', removedId: messageId });
});

app.post('/api/portal/mailbox/purge', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    const channel = String(req.body?.channel || 'inbox').toLowerCase();
    const idsRaw = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const ids = new Set(idsRaw.map((id) => Number(id)).filter((id) => Number.isFinite(id)));

    if (!username) {
        return res.status(400).json({ status: 'error', message: 'Valid commander username required.' });
    }
    if (!ids.size) {
        return res.status(400).json({ status: 'error', message: 'No message ids supplied.' });
    }

    const ownerLower = username.toLowerCase();
    const messages = getMailboxMessageStore();
    let removed = 0;
    const nextMessages = messages.filter((row) => {
        if (!ids.has(row.id)) return true;
        if (channel === 'sent') {
            if (row.channel !== 'sent' || String(row.from || '').toLowerCase() !== ownerLower) return true;
            removed += 1;
            return false;
        }
        if (String(row.to || '').toLowerCase() !== ownerLower) return true;
        if (channel === 'system' && row.channel !== 'system') return true;
        if (channel !== 'system' && row.channel !== 'inbox') return true;
        removed += 1;
        return false;
    });

    writeMailboxMessageStore(nextMessages);
    res.json({ status: 'ok', removed });
});

app.post('/api/portal/mailbox/drafts', (req, res) => {
    const owner = resolveLedgerCommanderUsername(req.body?.owner || req.body?.username || '');
    const recipientsRaw = Array.isArray(req.body?.recipients) ? req.body.recipients : [];
    const topic = String(req.body?.topic || '').trim().slice(0, MAILBOX_TOPIC_MAX) || 'Untitled Draft';
    const body = String(req.body?.body || '').trim().slice(0, MAILBOX_BODY_MAX);
    const draftId = Number(req.body?.id);

    if (!owner) {
        return res.status(400).json({ status: 'error', message: 'Valid commander account required.' });
    }

    const recipients = [];
    const seen = new Set();
    for (const entry of recipientsRaw) {
        const resolved = resolveLedgerCommanderUsername(entry);
        if (!resolved) continue;
        const key = resolved.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        recipients.push(resolved);
    }

    const updatedAt = new Date().toISOString();
    const drafts = getMailboxDraftStore();
    let row;

    if (Number.isFinite(draftId)) {
        const hit = drafts.find(
            (entry) => entry.id === draftId && String(entry.owner || '').toLowerCase() === owner.toLowerCase()
        );
        if (hit) {
            hit.recipients = recipients;
            hit.topic = topic;
            hit.body = body;
            hit.updatedAt = updatedAt;
            row = hit;
        }
    }

    if (!row) {
        row = {
            id: createMailboxRecordId(),
            owner,
            recipients,
            topic,
            body,
            updatedAt
        };
        drafts.unshift(row);
    }

    writeMailboxDraftStore(drafts);
    res.status(200).json({ status: 'ok', draft: serializeMailboxDraftForClient(row) });
});

app.delete('/api/portal/mailbox/drafts/:draftId', (req, res) => {
    const owner = resolveLedgerCommanderUsername(req.body?.username || req.query?.username || '');
    const draftId = Number(req.params.draftId);

    if (!owner) {
        return res.status(400).json({ status: 'error', message: 'Valid commander account required.' });
    }
    if (!Number.isFinite(draftId)) {
        return res.status(400).json({ status: 'error', message: 'Invalid draft id.' });
    }

    const ownerLower = owner.toLowerCase();
    const drafts = getMailboxDraftStore();
    const nextDrafts = drafts.filter((row) => {
        if (row.id !== draftId) return true;
        return String(row.owner || '').toLowerCase() !== ownerLower;
    });

    if (nextDrafts.length === drafts.length) {
        return res.status(404).json({ status: 'error', message: 'Draft not found for this commander.' });
    }

    writeMailboxDraftStore(nextDrafts);
    res.json({ status: 'ok', removedId: draftId });
});

function getCommunityChatMentionRosterPayload() {
    const commanders = db.get('commanders').value() || [];
    const usernames = commanders
        .filter((entry) => entry?.username && !isHiddenRegistrationUsername(entry.username))
        .map((entry) => String(entry.username).trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    return { status: 'ok', usernames };
}

app.get('/api/portal/community-chat/mention-roster', (req, res) => {
    res.json(getCommunityChatMentionRosterPayload());
});

app.get('/api/portal/community-chat', (req, res) => {
    let store = readCommunityChatStore();
    store = maybeRunScheduledCommunityChatPurge(store);
    writeCommunityChatStore(store);

    const channel = String(req.query?.channel || '').trim();
    const messages = flattenCommunityChatActiveMessages(store);
    const messagesByChannel = {};
    COMMUNITY_CHAT_CHANNEL_IDS.forEach((channelId) => {
        messagesByChannel[channelId] = store.channels[channelId];
    });

    res.json({
        status: 'ok',
        messages,
        messagesByChannel,
        channelMessages: channel && isCommunityChatChannelId(channel) ? store.channels[channel] : null,
        retention: getCommunityChatRetentionMeta(store)
    });
});

app.post('/api/portal/community-chat/messages', (req, res) => {
    const posterUsername = resolveLedgerCommanderUsername(req.body?.username || req.body?.posterUsername || '');
    if (!posterUsername) {
        return res.status(400).json({ status: 'error', message: 'Username required.' });
    }

    let store = readCommunityChatStore();
    store = maybeRunScheduledCommunityChatPurge(store);

    const result = appendCommunityChatMessageToStore(store, {
        ...req.body,
        posterUsername
    });

    if (result.error) {
        return res.status(400).json({ status: 'error', message: result.error });
    }

    store = writeCommunityChatStore(store);

    res.json({
        status: 'ok',
        message: result.entry,
        channelMessages: result.channelMessages,
        messages: flattenCommunityChatActiveMessages(store),
        retention: getCommunityChatRetentionMeta(store)
    });
});

app.patch('/api/portal/community-chat/messages/:messageId', (req, res) => {
    const posterUsername = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!posterUsername) {
        return res.status(400).json({ status: 'error', message: 'Username required.' });
    }

    let store = readCommunityChatStore();
    store = maybeRunScheduledCommunityChatPurge(store);

    const result = updateCommunityChatMessageInStore(store, req.params.messageId, posterUsername, req.body || {});

    if (result.error) {
        return res.status(result.error === 'Message not found.' ? 404 : 403).json({
            status: 'error',
            message: result.error
        });
    }

    store = writeCommunityChatStore(store);

    res.json({
        status: 'ok',
        message: result.entry,
        channelMessages: result.channelMessages,
        messages: flattenCommunityChatActiveMessages(store),
        retention: getCommunityChatRetentionMeta(store)
    });
});

app.get('/api/portal/community-chat/archive', (req, res) => {
    const requester = resolveLedgerCommanderUsername(req.query?.username || '');
    if (!isMailboxRecipientRosterAdmin(requester)) {
        return res.status(403).json({ status: 'error', message: 'Owner access required for chat archives.' });
    }

    let store = readCommunityChatStore();
    store = maybeRunScheduledCommunityChatPurge(store);
    writeCommunityChatStore(store);

    const channel = String(req.query?.channel || '').trim();
    const limit = Math.min(5000, Math.max(1, parseInt(req.query?.limit, 10) || 500));
    let archive = store.archive.slice();

    if (channel && isCommunityChatChannelId(channel)) {
        archive = archive.filter((row) => row.channel === channel);
    }

    archive = archive.slice(-limit);

    res.json({
        status: 'ok',
        archive,
        count: archive.length,
        totalArchived: store.archive.length,
        retention: getCommunityChatRetentionMeta(store)
    });
});

app.get('/api/portal/game-chat', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.query?.username || '');
    if (!username) {
        return res.status(400).json({ status: 'error', message: 'Username required.' });
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return res.status(404).json({ status: 'error', message: 'Commander not found.' });
    }

    let gameStore = readGameChatStore();
    gameStore = ensureGameChatSeedMessages(gameStore);
    writeGameChatStore(gameStore);

    let communityStore = readCommunityChatStore();
    communityStore = maybeRunScheduledCommunityChatPurge(communityStore);
    writeCommunityChatStore(communityStore);

    const filtered = filterGameChatMessagesForViewer(gameStore, commander);

    res.json({
        status: 'ok',
        messagesByChannel: filtered.messagesByChannel,
        communityMessages: flattenCommunityChatActiveMessages(communityStore),
        hasAlliance: filtered.hasAlliance,
        gameNation: filtered.gameNation,
        allianceId: filtered.allianceId,
        ui: getGameChatUiFromCommander(commander)
    });
});

app.post('/api/portal/game-chat/messages', (req, res) => {
    const posterUsername = resolveLedgerCommanderUsername(req.body?.username || req.body?.posterUsername || '');
    if (!posterUsername) {
        return res.status(400).json({ status: 'error', message: 'Username required.' });
    }

    const commander = db.get('commanders').find({ username: posterUsername }).value();
    if (!commander) {
        return res.status(404).json({ status: 'error', message: 'Commander not found.' });
    }

    let store = readGameChatStore();
    store = ensureGameChatSeedMessages(store);

    const result = appendGameChatMessageToStore(store, {
        ...req.body,
        posterUsername,
        sender: posterUsername
    }, commander);

    if (result.error) {
        return res.status(400).json({ status: 'error', message: result.error });
    }

    store = writeGameChatStore(store);
    let communityStore = readCommunityChatStore();
    communityStore = maybeRunScheduledCommunityChatPurge(communityStore);
    writeCommunityChatStore(communityStore);

    const filtered = filterGameChatMessagesForViewer(store, commander);

    res.json({
        status: 'ok',
        message: result.entry,
        messagesByChannel: filtered.messagesByChannel,
        communityMessages: flattenCommunityChatActiveMessages(communityStore),
        hasAlliance: filtered.hasAlliance,
        gameNation: filtered.gameNation,
        allianceId: filtered.allianceId,
        ui: getGameChatUiFromCommander(commander)
    });
});

app.post('/api/portal/game-chat/system-events', (req, res) => {
    const requester = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!requester || !isMailboxRecipientRosterAdmin(requester)) {
        return res.status(403).json({ status: 'error', message: 'Owner access required for system events.' });
    }

    let store = readGameChatStore();
    const result = appendGameChatSystemEventToStore(store, req.body?.text);
    if (result.error) {
        return res.status(400).json({ status: 'error', message: result.error });
    }

    store = writeGameChatStore(store);
    res.json({ status: 'ok', message: result.entry });
});

app.patch('/api/portal/game-chat/ui', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    if (!username) {
        return res.status(400).json({ status: 'error', message: 'Username required.' });
    }

    const commander = db.get('commanders').find({ username }).value();
    if (!commander) {
        return res.status(404).json({ status: 'error', message: 'Commander not found.' });
    }

    const nextPreferences = patchGameChatUiPreferences(commander, req.body || {});
    db.get('commanders')
        .find({ username })
        .assign({
            preferences: nextPreferences,
            dossierUpdatedAt: new Date().toISOString()
        })
        .write();

    res.json({
        status: 'ok',
        ui: getGameChatUiFromCommander({ preferences: nextPreferences })
    });
});

app.post('/api/portal/presence', (req, res) => {
    const username = String(req.body?.username || '').trim();
    const inAge = req.body?.inAge === true;
    const onCommunityChat = req.body?.onCommunityChat === true;
    const lastActivityAt = Number(req.body?.lastActivityAt);

    if (!username) {
        return res.status(400).json({ status: 'error', message: 'Username required.' });
    }

    touchPortalBrowseSession(username, {
        onCommunityChat,
        lastActivityAt: Number.isFinite(lastActivityAt) && lastActivityAt > 0 ? lastActivityAt : undefined
    });

    if (inAge) {
        touchAgeSession(username, { markOnline: true });
    } else {
        const normalized = normalizeLedgerUsername(username);
        const existing = normalized ? ageSessionByUser.get(normalized) : null;
        if (existing) {
            existing.lastSeen = Date.now();
            existing.isOnline = false;
            ageSessionByUser.set(normalized, existing);
        }
    }

    res.json({ status: 'ok', ...getPortalLiveMetricsPayload() });
});

app.post('/api/portal/presence/leave', (req, res) => {
    const username = String(req.body?.username || '').trim();
    if (username) {
        removeAgeSession(username);
        removePortalBrowseSession(username);
    }
    res.json({ status: 'ok', ...getPortalLiveMetricsPayload() });
});

app.post('/api/portal/age/join', (req, res) => {
    const username = String(req.body?.username || '').trim();
    if (!username) {
        return res.status(400).json({ status: 'error', message: 'Username required.' });
    }

    touchPortalBrowseSession(username);
    touchAgeSession(username, { markOnline: true });
    res.json({ status: 'ok', ...getPortalLiveMetricsPayload() });
});

app.post('/api/portal/age/leave', (req, res) => {
    const username = String(req.body?.username || '').trim();
    if (!username) {
        return res.status(400).json({ status: 'error', message: 'Username required.' });
    }

    removeAgeSession(username);
    res.json({ status: 'ok', ...getPortalLiveMetricsPayload() });
});

/* ==========================================
   NEXUS MODULE: IGNITION
   ========================================== */

/* --- Section: Server Boot --- */

/* Block 15: Nexus Engine Ignition */
app.listen(PORT, () => {
    backfillWelcomeSystemMessagesForAllCommanders();
    backfillFirstTimerAchievementForAllCommanders();
    console.log(`========================================`);
    console.log(` NEXUS ENGINE ONLINE: Port ${PORT}`);
    console.log(` GREEN MASK INTERACTIVE: ALPHA 0.1.11`);
    console.log(`========================================`);
});

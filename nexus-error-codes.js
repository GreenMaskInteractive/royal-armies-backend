/**
 * NEXUS — canonical API error code registry (NEXUS-XXX-NNN). Network Environment Xypher Utility System.
 * Used by server.js and exposed to clients via public/rift-error-codes.js.
 */
(function buildNexusErrorRegistry(root, factory) {
    const registry = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = registry;
    } else {
        root.RiftErrorCodes = registry;
        root.NexusErrorCodes = registry;
        root.RoyalArmiesErrorCodes = registry;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createNexusErrorRegistry() {
    'use strict';

    /** @type {Record<string, { http: number, title: string, message: string, category: string }>} */
    const ERROR_CODES = {
        /* --- General --- */
        'NEXUS-GEN-001': {
            http: 500,
            title: 'Server error',
            message: 'An unexpected error occurred. Please try again.',
            category: 'general'
        },
        'NEXUS-GEN-002': {
            http: 400,
            title: 'Missing username',
            message: 'Username required.',
            category: 'general'
        },
        'NEXUS-GEN-003': {
            http: 400,
            title: 'Invalid account',
            message: 'Valid commander account required.',
            category: 'general'
        },
        'NEXUS-GEN-004': {
            http: 404,
            title: 'Commander not found',
            message: 'Commander not found.',
            category: 'general'
        },
        'NEXUS-GEN-005': {
            http: 400,
            title: 'Unknown commander',
            message: 'Unknown commander account.',
            category: 'general'
        },
        'NEXUS-GEN-006': {
            http: 400,
            title: 'Username required',
            message: 'Username is required.',
            category: 'general'
        },
        'NEXUS-GEN-007': {
            http: 400,
            title: 'Valid username required',
            message: 'Valid commander username required.',
            category: 'general'
        },

        /* --- Authentication --- */
        'NEXUS-AUTH-001': {
            http: 400,
            title: 'Login failed',
            message: 'Username and password are required.',
            category: 'auth'
        },
        'NEXUS-AUTH-002': {
            http: 401,
            title: 'Login failed',
            message: 'No registered commander found with those credentials.',
            category: 'auth'
        },
        'NEXUS-AUTH-003': {
            http: 401,
            title: 'Login failed',
            message: 'Invalid password for that commander account.',
            category: 'auth'
        },
        'NEXUS-AUTH-004': {
            http: 500,
            title: 'Login failed',
            message: 'Login could not be completed.',
            category: 'auth'
        },
        'NEXUS-AUTH-005': {
            http: 400,
            title: 'Registration failed',
            message: 'Username, email, and password are required.',
            category: 'auth'
        },
        'NEXUS-AUTH-006': {
            http: 400,
            title: 'Registration failed',
            message: 'This E-Mail is already registered. Contact accountsdept@royalarmies.com!',
            category: 'auth'
        },
        'NEXUS-AUTH-007': {
            http: 400,
            title: 'Registration failed',
            message: 'This username is already taken. Choose a different commander name.',
            category: 'auth'
        },
        'NEXUS-AUTH-008': {
            http: 500,
            title: 'Registration failed',
            message: 'Could not save registration. Please try again.',
            category: 'auth'
        },
        'NEXUS-AUTH-009': {
            http: 403,
            title: 'Not available',
            message: 'Not available in production.',
            category: 'auth'
        },
        'NEXUS-AUTH-010': {
            http: 403,
            title: 'Not available',
            message: 'Local development only.',
            category: 'auth'
        },
        'NEXUS-AUTH-011': {
            http: 403,
            title: 'Access denied',
            message: 'Invalid or missing developer key (X-Dev-Key header).',
            category: 'auth'
        },
        'NEXUS-AUTH-012': {
            http: 400,
            title: 'Registration failed',
            message: 'Username must be at least 5 characters.',
            category: 'auth'
        },
        'NEXUS-AUTH-013': {
            http: 400,
            title: 'Registration failed',
            message: 'Username must be 15 characters or fewer.',
            category: 'auth'
        },
        'NEXUS-AUTH-014': {
            http: 400,
            title: 'Registration failed',
            message: 'Username may only use letters and numbers, with at most one period (.), one underscore (_), and one dash (-).',
            category: 'auth'
        },
        'NEXUS-AUTH-015': {
            http: 400,
            title: 'Registration failed',
            message: 'You must confirm that you are at least 13 years old and agree to the Terms of Service and Privacy Policy.',
            category: 'auth'
        },
        'NEXUS-AUTH-016': {
            http: 403,
            title: 'Terms required',
            message: 'You must accept the Terms of Service and Privacy Policy before continuing.',
            category: 'auth'
        },
        'NEXUS-AUTH-017': {
            http: 401,
            title: 'Session expired',
            message: 'Your portal session expired after 6 hours of inactivity. Please sign in again.',
            category: 'auth'
        },

        /* --- Account / profile --- */
        'NEXUS-ACCT-001': {
            http: 400,
            title: 'Password reset',
            message: 'Username and signup email are required.',
            category: 'account'
        },
        'NEXUS-ACCT-002': {
            http: 500,
            title: 'Password reset',
            message: 'Could not send the reset email. Try again shortly.',
            category: 'account'
        },
        'NEXUS-ACCT-003': {
            http: 400,
            title: 'Email change',
            message: 'Username, password, and new email are required.',
            category: 'account'
        },
        'NEXUS-ACCT-004': {
            http: 401,
            title: 'Email change',
            message: 'Invalid password or commander account.',
            category: 'account'
        },
        'NEXUS-ACCT-005': {
            http: 400,
            title: 'Email change',
            message: 'That email is already on your account.',
            category: 'account'
        },
        'NEXUS-ACCT-006': {
            http: 400,
            title: 'Email change',
            message: 'That email is already registered to another commander.',
            category: 'account'
        },
        'NEXUS-ACCT-007': {
            http: 500,
            title: 'Email change',
            message: 'Could not send the confirmation email. Try again shortly.',
            category: 'account'
        },
        'NEXUS-ACCT-008': {
            http: 400,
            title: 'Profile update',
            message: 'No profile fields to update.',
            category: 'account'
        },
        'NEXUS-ACCT-009': {
            http: 400,
            title: 'Dossier update',
            message: 'No dossier fields to update.',
            category: 'account'
        },

        /* --- Mailbox --- */
        'NEXUS-MAIL-001': {
            http: 400,
            title: 'Mailbox',
            message: 'Valid sender commander required.',
            category: 'mailbox'
        },
        'NEXUS-MAIL-002': {
            http: 400,
            title: 'Mailbox',
            message: 'Subject and message body are required.',
            category: 'mailbox'
        },
        'NEXUS-MAIL-003': {
            http: 400,
            title: 'Mailbox',
            message: 'Choose at least one valid recipient.',
            category: 'mailbox'
        },
        'NEXUS-MAIL-004': {
            http: 400,
            title: 'Mailbox',
            message: 'Valid recipient commander required.',
            category: 'mailbox'
        },
        'NEXUS-MAIL-005': {
            http: 400,
            title: 'Mailbox',
            message: 'Channel must be inbox or system.',
            category: 'mailbox'
        },
        'NEXUS-MAIL-006': {
            http: 400,
            title: 'Mailbox',
            message: 'Sender name required.',
            category: 'mailbox'
        },
        'NEXUS-MAIL-007': {
            http: 400,
            title: 'Mailbox',
            message: 'Invalid message id.',
            category: 'mailbox'
        },
        'NEXUS-MAIL-008': {
            http: 404,
            title: 'Mailbox',
            message: 'Message not found for this commander.',
            category: 'mailbox'
        },
        'NEXUS-MAIL-009': {
            http: 400,
            title: 'Mailbox',
            message: 'No message ids supplied.',
            category: 'mailbox'
        },
        'NEXUS-MAIL-010': {
            http: 400,
            title: 'Mailbox',
            message: 'Invalid draft id.',
            category: 'mailbox'
        },
        'NEXUS-MAIL-011': {
            http: 404,
            title: 'Mailbox',
            message: 'Draft not found for this commander.',
            category: 'mailbox'
        },

        /* --- Community chat --- */
        'NEXUS-CHAT-001': {
            http: 400,
            title: 'Community chat',
            message: 'Sender and message text are required.',
            category: 'community-chat'
        },
        'NEXUS-CHAT-002': {
            http: 403,
            title: 'Community chat',
            message: 'System bot messages require authorization.',
            category: 'community-chat'
        },
        'NEXUS-CHAT-003': {
            http: 403,
            title: 'Community chat',
            message: 'Sender must match the posting commander.',
            category: 'community-chat'
        },
        'NEXUS-CHAT-004': {
            http: 400,
            title: 'Community chat',
            message: 'You cannot reply to your own message.',
            category: 'community-chat'
        },
        'NEXUS-CHAT-005': {
            http: 400,
            title: 'Community chat',
            message: 'Invalid message id.',
            category: 'community-chat'
        },
        'NEXUS-CHAT-006': {
            http: 400,
            title: 'Community chat',
            message: 'Message text cannot be empty.',
            category: 'community-chat'
        },
        'NEXUS-CHAT-007': {
            http: 403,
            title: 'Community chat',
            message: 'You can only edit your own messages.',
            category: 'community-chat'
        },
        'NEXUS-CHAT-008': {
            http: 404,
            title: 'Community chat',
            message: 'Message not found.',
            category: 'community-chat'
        },
        'NEXUS-CHAT-009': {
            http: 403,
            title: 'Community chat',
            message: 'Owner access required for chat archives.',
            category: 'community-chat'
        },
        'NEXUS-CHAT-010': {
            http: 403,
            title: 'Community chat',
            message: 'You are banned from chat because of repeated rule violations.',
            category: 'community-chat'
        },
        'NEXUS-CHAT-011': {
            http: 403,
            title: 'Community chat',
            message: 'You are temporarily muted from chat.',
            category: 'community-chat'
        },

        /* --- In-game chat & session --- */
        'NEXUS-GAME-001': {
            http: 400,
            title: 'Game chat',
            message: 'System event text is required.',
            category: 'game'
        },
        'NEXUS-GAME-002': {
            http: 403,
            title: 'Game chat',
            message: 'System channel is read-only.',
            category: 'game'
        },
        'NEXUS-GAME-003': {
            http: 400,
            title: 'Game chat',
            message: 'Nation assignment required before using country chat.',
            category: 'game'
        },
        'NEXUS-GAME-004': {
            http: 403,
            title: 'Game chat',
            message: 'Alliance chat unlocks once your nation forms an alliance.',
            category: 'game'
        },
        'NEXUS-GAME-005': {
            http: 403,
            title: 'Game chat',
            message: 'Owner access required for system events.',
            category: 'game'
        },
        'NEXUS-GAME-006': {
            http: 400,
            title: 'Age session',
            message: 'Could not join the active age session.',
            category: 'game'
        },
        'NEXUS-GAME-007': {
            http: 400,
            title: 'Age session',
            message: 'Could not leave the active age session.',
            category: 'game'
        },
        'NEXUS-GAME-008': {
            http: 400,
            title: 'Presence',
            message: 'Could not update your in-age presence.',
            category: 'game'
        },
        'NEXUS-GAME-009': {
            http: 400,
            title: 'Game chat',
            message: 'Could not load game chat.',
            category: 'game'
        },
        'NEXUS-GAME-010': {
            http: 400,
            title: 'Game chat',
            message: 'Could not save chat panel settings.',
            category: 'game'
        },
        'NEXUS-GAME-011': {
            http: 403,
            title: 'Terms required',
            message: 'You must accept the terms before joining this round.',
            category: 'game'
        },
        'NEXUS-GAME-012': {
            http: 400,
            title: 'Starting nation',
            message: 'That nation is not open for onboarding during this alpha.',
            category: 'game'
        },
        'NEXUS-GAME-013': {
            http: 400,
            title: 'Starting region',
            message: 'That region is not open for onboarding during this alpha.',
            category: 'game'
        },
        'NEXUS-GAME-014': {
            http: 409,
            title: 'Starting nation',
            message: 'You have already pledged to a nation for this Age.',
            category: 'game'
        },
        'NEXUS-GAME-015': {
            http: 403,
            title: 'Battle Pass',
            message: 'The Chronicles Battle Pass is not available on the server yet.',
            category: 'game'
        },

        /* --- Age map movement --- */
        'NEXUS-AGE-001': {
            http: 400,
            title: 'Move points',
            message: 'No move points remaining. Regain 1 at each game-clock half-hour tick (:00 and :30 UTC, max 3).',
            category: 'game'
        },
        'NEXUS-AGE-002': {
            http: 400,
            title: 'Movement',
            message: 'That city does not border your current position.',
            category: 'game'
        },
        'NEXUS-AGE-003': {
            http: 400,
            title: 'Movement',
            message: 'Unknown city or invalid movement target.',
            category: 'game'
        },
        'NEXUS-AGE-004': {
            http: 400,
            title: 'Nation Treasury',
            message: 'Insufficient Royal Silver Dollars in your nation treasury.',
            category: 'game'
        },
        'NEXUS-AGE-005': {
            http: 400,
            title: 'Assault',
            message: 'You cannot assault an allied city.',
            category: 'game'
        },
        'NEXUS-AGE-006': {
            http: 400,
            title: 'Travel',
            message: 'You can only travel to cities owned by your nation.',
            category: 'game'
        },
        'NEXUS-AGE-007': {
            http: 400,
            title: 'Transfer',
            message: 'Ownership can only be transferred from a bordering allied city.',
            category: 'game'
        },
        'NEXUS-AGE-008': {
            http: 400,
            title: 'Movement',
            message: 'Nation assignment required before moving on the map.',
            category: 'game'
        },
        'NEXUS-AGE-009': {
            http: 400,
            title: 'Movement',
            message: 'You are already in that city.',
            category: 'game'
        },
        'NEXUS-AGE-010': {
            http: 400,
            title: 'Assault',
            message: 'You already hold that city.',
            category: 'game'
        },

        /* --- Client-only network --- */
        'RIFT-NET-001': {
            http: 0,
            title: 'Connection error',
            message: 'Cannot reach the Royal Armies server. Check your connection and try again.',
            category: 'network'
        },
        'RIFT-NET-002': {
            http: 0,
            title: 'Update in progress',
            message: 'An update is underway. Expect a moment of downtime.',
            category: 'network'
        }
    };


    const LEGACY_RA_CODE_ALIASES = Object.create(null);
    Object.keys(ERROR_CODES).forEach((code) => {
        if (code.startsWith('NEXUS-')) {
            LEGACY_RA_CODE_ALIASES[code.replace(/^NEXUS-/, 'RA-')] = code;
        }
        if (code.startsWith('RIFT-')) {
            LEGACY_RA_CODE_ALIASES[code.replace(/^RIFT-/, 'RA-')] = code;
        }
    });

    const LEGACY_MESSAGE_TO_CODE = Object.create(null);
    Object.keys(ERROR_CODES).forEach((code) => {
        const entry = ERROR_CODES[code];
        if (entry && entry.message) {
            LEGACY_MESSAGE_TO_CODE[entry.message] = code;
        }
    });

    const STORE_ERROR_CODE_BY_KEY = {
        CHAT_SENDER_TEXT_REQUIRED: 'NEXUS-CHAT-001',
        CHAT_BOT_AUTH_REQUIRED: 'NEXUS-CHAT-002',
        CHAT_SENDER_MISMATCH: 'NEXUS-CHAT-003',
        CHAT_SELF_REPLY: 'NEXUS-CHAT-004',
        CHAT_INVALID_MESSAGE_ID: 'NEXUS-CHAT-005',
        CHAT_EMPTY_MESSAGE: 'NEXUS-CHAT-006',
        CHAT_EDIT_OWN_ONLY: 'NEXUS-CHAT-007',
        CHAT_MESSAGE_NOT_FOUND: 'NEXUS-CHAT-008',
        CHAT_USER_BANNED: 'NEXUS-CHAT-010',
        CHAT_USER_MUTED: 'NEXUS-CHAT-011',
        GAME_SYSTEM_TEXT_REQUIRED: 'NEXUS-GAME-001',
        GAME_SYSTEM_READ_ONLY: 'NEXUS-GAME-002',
        GAME_NATION_REQUIRED: 'NEXUS-GAME-003',
        GAME_ALLIANCE_REQUIRED: 'NEXUS-GAME-004'
    };

    function getErrorDefinition(code) {
        return ERROR_CODES[code] || null;
    }

    function resolveErrorCode(input) {
        if (!input) return 'NEXUS-GEN-001';
        const key = String(input).trim();
        if (ERROR_CODES[key]) return key;
        if (LEGACY_RA_CODE_ALIASES[key]) return LEGACY_RA_CODE_ALIASES[key];
        if (STORE_ERROR_CODE_BY_KEY[key]) return STORE_ERROR_CODE_BY_KEY[key];
        if (LEGACY_MESSAGE_TO_CODE[key]) return LEGACY_MESSAGE_TO_CODE[key];
        return 'NEXUS-GEN-001';
    }

    function buildErrorPayload(code, overrides = {}) {
        const resolved = resolveErrorCode(code);
        const def = getErrorDefinition(resolved) || ERROR_CODES['NEXUS-GEN-001'];
        return {
            status: 'error',
            code: resolved,
            title: overrides.title || def.title,
            message: overrides.message || def.message,
            category: def.category
        };
    }

    function listErrorCodes() {
        return Object.keys(ERROR_CODES)
            .sort()
            .map((code) => ({
                code,
                ...ERROR_CODES[code]
            }));
    }

    return {
        ERROR_CODES,
        LEGACY_MESSAGE_TO_CODE,
        STORE_ERROR_CODE_BY_KEY,
        getErrorDefinition,
        resolveErrorCode,
        buildErrorPayload,
        listErrorCodes
    };
});

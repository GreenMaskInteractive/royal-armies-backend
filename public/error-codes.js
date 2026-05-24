/**
 * Royal Armies — canonical API error code registry (RA-XXX-NNN).
 * Used by server.js and exposed to clients via public/error-codes.js.
 */
(function buildRoyalArmiesErrorRegistry(root, factory) {
    const registry = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = registry;
    } else {
        root.RoyalArmiesErrorCodes = registry;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createRoyalArmiesErrorRegistry() {
    'use strict';

    /** @type {Record<string, { http: number, title: string, message: string, category: string }>} */
    const ERROR_CODES = {
        /* --- General --- */
        'RA-GEN-001': {
            http: 500,
            title: 'Server error',
            message: 'An unexpected error occurred. Please try again.',
            category: 'general'
        },
        'RA-GEN-002': {
            http: 400,
            title: 'Missing username',
            message: 'Username required.',
            category: 'general'
        },
        'RA-GEN-003': {
            http: 400,
            title: 'Invalid account',
            message: 'Valid commander account required.',
            category: 'general'
        },
        'RA-GEN-004': {
            http: 404,
            title: 'Commander not found',
            message: 'Commander not found.',
            category: 'general'
        },
        'RA-GEN-005': {
            http: 400,
            title: 'Unknown commander',
            message: 'Unknown commander account.',
            category: 'general'
        },
        'RA-GEN-006': {
            http: 400,
            title: 'Username required',
            message: 'Username is required.',
            category: 'general'
        },
        'RA-GEN-007': {
            http: 400,
            title: 'Valid username required',
            message: 'Valid commander username required.',
            category: 'general'
        },

        /* --- Authentication --- */
        'RA-AUTH-001': {
            http: 400,
            title: 'Login failed',
            message: 'Username and password are required.',
            category: 'auth'
        },
        'RA-AUTH-002': {
            http: 401,
            title: 'Login failed',
            message: 'No registered commander found with those credentials.',
            category: 'auth'
        },
        'RA-AUTH-003': {
            http: 401,
            title: 'Login failed',
            message: 'Invalid password for that commander account.',
            category: 'auth'
        },
        'RA-AUTH-004': {
            http: 500,
            title: 'Login failed',
            message: 'Login could not be completed.',
            category: 'auth'
        },
        'RA-AUTH-005': {
            http: 400,
            title: 'Registration failed',
            message: 'Username, email, and password are required.',
            category: 'auth'
        },
        'RA-AUTH-006': {
            http: 400,
            title: 'Registration failed',
            message: 'This E-Mail is already registered. Contact accountsdept@royalarmies.com!',
            category: 'auth'
        },
        'RA-AUTH-007': {
            http: 400,
            title: 'Registration failed',
            message: 'This username is already taken. Choose a different commander name.',
            category: 'auth'
        },
        'RA-AUTH-008': {
            http: 500,
            title: 'Registration failed',
            message: 'Could not save registration. Please try again.',
            category: 'auth'
        },
        'RA-AUTH-009': {
            http: 403,
            title: 'Not available',
            message: 'Not available in production.',
            category: 'auth'
        },
        'RA-AUTH-010': {
            http: 403,
            title: 'Not available',
            message: 'Local development only.',
            category: 'auth'
        },
        'RA-AUTH-011': {
            http: 403,
            title: 'Access denied',
            message: 'Invalid or missing developer key (X-Dev-Key header).',
            category: 'auth'
        },

        /* --- Account / profile --- */
        'RA-ACCT-001': {
            http: 400,
            title: 'Password reset',
            message: 'Username and signup email are required.',
            category: 'account'
        },
        'RA-ACCT-002': {
            http: 500,
            title: 'Password reset',
            message: 'Could not send the reset email. Try again shortly.',
            category: 'account'
        },
        'RA-ACCT-003': {
            http: 400,
            title: 'Email change',
            message: 'Username, password, and new email are required.',
            category: 'account'
        },
        'RA-ACCT-004': {
            http: 401,
            title: 'Email change',
            message: 'Invalid password or commander account.',
            category: 'account'
        },
        'RA-ACCT-005': {
            http: 400,
            title: 'Email change',
            message: 'That email is already on your account.',
            category: 'account'
        },
        'RA-ACCT-006': {
            http: 400,
            title: 'Email change',
            message: 'That email is already registered to another commander.',
            category: 'account'
        },
        'RA-ACCT-007': {
            http: 500,
            title: 'Email change',
            message: 'Could not send the confirmation email. Try again shortly.',
            category: 'account'
        },
        'RA-ACCT-008': {
            http: 400,
            title: 'Profile update',
            message: 'No profile fields to update.',
            category: 'account'
        },
        'RA-ACCT-009': {
            http: 400,
            title: 'Dossier update',
            message: 'No dossier fields to update.',
            category: 'account'
        },

        /* --- Mailbox --- */
        'RA-MAIL-001': {
            http: 400,
            title: 'Mailbox',
            message: 'Valid sender commander required.',
            category: 'mailbox'
        },
        'RA-MAIL-002': {
            http: 400,
            title: 'Mailbox',
            message: 'Subject and message body are required.',
            category: 'mailbox'
        },
        'RA-MAIL-003': {
            http: 400,
            title: 'Mailbox',
            message: 'Choose at least one valid recipient.',
            category: 'mailbox'
        },
        'RA-MAIL-004': {
            http: 400,
            title: 'Mailbox',
            message: 'Valid recipient commander required.',
            category: 'mailbox'
        },
        'RA-MAIL-005': {
            http: 400,
            title: 'Mailbox',
            message: 'Channel must be inbox or system.',
            category: 'mailbox'
        },
        'RA-MAIL-006': {
            http: 400,
            title: 'Mailbox',
            message: 'Sender name required.',
            category: 'mailbox'
        },
        'RA-MAIL-007': {
            http: 400,
            title: 'Mailbox',
            message: 'Invalid message id.',
            category: 'mailbox'
        },
        'RA-MAIL-008': {
            http: 404,
            title: 'Mailbox',
            message: 'Message not found for this commander.',
            category: 'mailbox'
        },
        'RA-MAIL-009': {
            http: 400,
            title: 'Mailbox',
            message: 'No message ids supplied.',
            category: 'mailbox'
        },
        'RA-MAIL-010': {
            http: 400,
            title: 'Mailbox',
            message: 'Invalid draft id.',
            category: 'mailbox'
        },
        'RA-MAIL-011': {
            http: 404,
            title: 'Mailbox',
            message: 'Draft not found for this commander.',
            category: 'mailbox'
        },

        /* --- Community chat --- */
        'RA-CHAT-001': {
            http: 400,
            title: 'Community chat',
            message: 'Sender and message text are required.',
            category: 'community-chat'
        },
        'RA-CHAT-002': {
            http: 403,
            title: 'Community chat',
            message: 'System bot messages require authorization.',
            category: 'community-chat'
        },
        'RA-CHAT-003': {
            http: 403,
            title: 'Community chat',
            message: 'Sender must match the posting commander.',
            category: 'community-chat'
        },
        'RA-CHAT-004': {
            http: 400,
            title: 'Community chat',
            message: 'You cannot reply to your own message.',
            category: 'community-chat'
        },
        'RA-CHAT-005': {
            http: 400,
            title: 'Community chat',
            message: 'Invalid message id.',
            category: 'community-chat'
        },
        'RA-CHAT-006': {
            http: 400,
            title: 'Community chat',
            message: 'Message text cannot be empty.',
            category: 'community-chat'
        },
        'RA-CHAT-007': {
            http: 403,
            title: 'Community chat',
            message: 'You can only edit your own messages.',
            category: 'community-chat'
        },
        'RA-CHAT-008': {
            http: 404,
            title: 'Community chat',
            message: 'Message not found.',
            category: 'community-chat'
        },
        'RA-CHAT-009': {
            http: 403,
            title: 'Community chat',
            message: 'Owner access required for chat archives.',
            category: 'community-chat'
        },

        /* --- In-game chat & session --- */
        'RA-GAME-001': {
            http: 400,
            title: 'Game chat',
            message: 'System event text is required.',
            category: 'game'
        },
        'RA-GAME-002': {
            http: 403,
            title: 'Game chat',
            message: 'System channel is read-only.',
            category: 'game'
        },
        'RA-GAME-003': {
            http: 400,
            title: 'Game chat',
            message: 'Nation assignment required before using country chat.',
            category: 'game'
        },
        'RA-GAME-004': {
            http: 403,
            title: 'Game chat',
            message: 'Alliance chat unlocks once your nation forms an alliance.',
            category: 'game'
        },
        'RA-GAME-005': {
            http: 403,
            title: 'Game chat',
            message: 'Owner access required for system events.',
            category: 'game'
        },
        'RA-GAME-006': {
            http: 400,
            title: 'Age session',
            message: 'Could not join the active age session.',
            category: 'game'
        },
        'RA-GAME-007': {
            http: 400,
            title: 'Age session',
            message: 'Could not leave the active age session.',
            category: 'game'
        },
        'RA-GAME-008': {
            http: 400,
            title: 'Presence',
            message: 'Could not update your in-age presence.',
            category: 'game'
        },
        'RA-GAME-009': {
            http: 400,
            title: 'Game chat',
            message: 'Could not load game chat.',
            category: 'game'
        },
        'RA-GAME-010': {
            http: 400,
            title: 'Game chat',
            message: 'Could not save chat panel settings.',
            category: 'game'
        },

        /* --- Client-only network --- */
        'RA-NET-001': {
            http: 0,
            title: 'Connection error',
            message: 'Cannot reach the Royal Armies server. Check your connection and try again.',
            category: 'network'
        }
    };

    const LEGACY_MESSAGE_TO_CODE = Object.create(null);
    Object.keys(ERROR_CODES).forEach((code) => {
        const entry = ERROR_CODES[code];
        if (entry && entry.message) {
            LEGACY_MESSAGE_TO_CODE[entry.message] = code;
        }
    });

    const STORE_ERROR_CODE_BY_KEY = {
        CHAT_SENDER_TEXT_REQUIRED: 'RA-CHAT-001',
        CHAT_BOT_AUTH_REQUIRED: 'RA-CHAT-002',
        CHAT_SENDER_MISMATCH: 'RA-CHAT-003',
        CHAT_SELF_REPLY: 'RA-CHAT-004',
        CHAT_INVALID_MESSAGE_ID: 'RA-CHAT-005',
        CHAT_EMPTY_MESSAGE: 'RA-CHAT-006',
        CHAT_EDIT_OWN_ONLY: 'RA-CHAT-007',
        CHAT_MESSAGE_NOT_FOUND: 'RA-CHAT-008',
        GAME_SYSTEM_TEXT_REQUIRED: 'RA-GAME-001',
        GAME_SYSTEM_READ_ONLY: 'RA-GAME-002',
        GAME_NATION_REQUIRED: 'RA-GAME-003',
        GAME_ALLIANCE_REQUIRED: 'RA-GAME-004'
    };

    function getErrorDefinition(code) {
        return ERROR_CODES[code] || null;
    }

    function resolveErrorCode(input) {
        if (!input) return 'RA-GEN-001';
        const key = String(input).trim();
        if (ERROR_CODES[key]) return key;
        if (STORE_ERROR_CODE_BY_KEY[key]) return STORE_ERROR_CODE_BY_KEY[key];
        if (LEGACY_MESSAGE_TO_CODE[key]) return LEGACY_MESSAGE_TO_CODE[key];
        return 'RA-GEN-001';
    }

    function buildErrorPayload(code, overrides = {}) {
        const resolved = resolveErrorCode(code);
        const def = getErrorDefinition(resolved) || ERROR_CODES['RA-GEN-001'];
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

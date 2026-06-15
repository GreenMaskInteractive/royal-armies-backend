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
        'NEXUS-GAME-018': {
            http: 400,
            title: 'Class path',
            message: 'That class path is not valid for onboarding.',
            category: 'game'
        },
        'NEXUS-GAME-019': {
            http: 400,
            title: 'Class perk',
            message: 'Choose Perk 1 Option A or Option B before confirming your class.',
            category: 'game'
        },
        'NEXUS-GAME-020': {
            http: 409,
            title: 'Class locked',
            message: 'Your class and Perk 1 choices are already locked for this Age.',
            category: 'game'
        },

        /* --- Age Headquarters --- */
        'NEXUS-HQ-001': {
            http: 400,
            title: 'SF Planning',
            message: 'Too many planning markers for this nation.',
            category: 'game'
        },
        'NEXUS-HQ-002': {
            http: 400,
            title: 'SF Planning',
            message: 'Move and Main Force arrows exceed the 3 MP chain limit.',
            category: 'game'
        },
        'NEXUS-HQ-003': {
            http: 400,
            title: 'Leadership vote',
            message: 'That commander is not eligible for this vote.',
            category: 'game'
        },
        'NEXUS-HQ-004': {
            http: 400,
            title: 'Leadership vote',
            message: 'Leader and Vice Leader votes must be for different commanders.',
            category: 'game'
        },
        'NEXUS-HQ-005': {
            http: 400,
            title: 'War declaration',
            message: 'Select a valid target nation before sending a declaration.',
            category: 'game'
        },
        'NEXUS-HQ-006': {
            http: 403,
            title: 'Headquarters',
            message: 'Council or Leader access is required for this action.',
            category: 'game'
        },
        'NEXUS-HQ-007': {
            http: 403,
            title: 'Leadership vote',
            message: 'Leadership voting is closed until the next election window opens.',
            category: 'game'
        },
        'NEXUS-HQ-008': {
            http: 403,
            title: 'SF Planning',
            message: 'The plan is confirmed. Click Edit Plan before making changes.',
            category: 'game'
        },
        'NEXUS-HQ-009': {
            http: 400,
            title: 'SF Planning',
            message: 'Place at least one order on the map before confirming the plan.',
            category: 'game'
        },
        'NEXUS-HQ-010': {
            http: 400,
            title: 'SF Planning',
            message: 'The plan is not confirmed yet.',
            category: 'game'
        },
        'NEXUS-HQ-011': {
            http: 400,
            title: 'Emergency Dispatch',
            message: 'That dispatch alert type is not recognized.',
            category: 'game'
        },
        'NEXUS-HQ-012': {
            http: 409,
            title: 'Emergency Dispatch',
            message: 'A dispatch alert is already active for your nation. Wait for it to finish before sending another.',
            category: 'game'
        },
        'NEXUS-HQ-013': {
            http: 400,
            title: 'SF Planning',
            message: 'There is no confirmed plan on the world map to clear.',
            category: 'game'
        },
        'NEXUS-HQ-014': {
            http: 403,
            title: 'Nation authority',
            message: 'Full nation authority requires seven commanders at rank 14 before leadership may declare war or set diplomacy.',
            category: 'game'
        },
        'NEXUS-HQ-015': {
            http: 409,
            title: 'War ledger',
            message: 'A recognized war with that nation is already recorded.',
            category: 'game'
        },
        'NEXUS-HQ-016': {
            http: 409,
            title: 'Spy log full',
            message: 'Headquarters spy log is full (3 reports). Delete one to archive a new report.',
            category: 'game'
        },
        'NEXUS-HQ-017': {
            http: 200,
            title: 'Spy log partial',
            message: 'Only some scout reports were saved because the spy log is nearly full.',
            category: 'game'
        },
        'NEXUS-HQ-018': {
            http: 404,
            title: 'Spy log',
            message: 'That spy report was not found.',
            category: 'game'
        },
        'NEXUS-HQ-019': {
            http: 400,
            title: 'Spy forward',
            message: 'Select an allied nation to forward this spy report.',
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
        'NEXUS-AGE-011': {
            http: 400,
            title: 'Recruitment',
            message: 'Insufficient gold for this purchase.',
            category: 'game'
        },
        'NEXUS-AGE-012': {
            http: 400,
            title: 'Recruitment',
            message: 'That unit is not available in the barracks catalog.',
            category: 'game'
        },
        'NEXUS-AGE-013': {
            http: 400,
            title: 'Recruitment',
            message: 'Choose a valid unit quantity before purchasing.',
            category: 'game'
        },
        'NEXUS-AGE-014': {
            http: 400,
            title: 'Recruitment',
            message: 'Your commander class cannot recruit this unit line.',
            category: 'game'
        },
        'NEXUS-AGE-015': {
            http: 400,
            title: 'Recruitment',
            message: 'Your commander rank is too low to recruit this unit.',
            category: 'game'
        },
        'NEXUS-AGE-016': {
            http: 400,
            title: 'Recruitment',
            message: 'Insufficient Provisions for this purchase.',
            category: 'game'
        },
        'NEXUS-AGE-017': {
            http: 400,
            title: 'Training battle',
            message: 'Recruit units at the Barracks before starting guild training.',
            category: 'game'
        },
        'NEXUS-AGE-018': {
            http: 403,
            title: 'Admin only',
            message: 'This ledger action requires administrator access.',
            category: 'auth'
        },
        'NEXUS-AGE-019': {
            http: 400,
            title: 'Healing',
            message: 'No injured units are available to heal.',
            category: 'game'
        },
        'NEXUS-AGE-020': {
            http: 403,
            title: 'Guild job',
            message: 'This Adventurer\'s Guild job is not available at your rank or settlement.',
            category: 'game'
        },
        'NEXUS-AGE-021': {
            http: 403,
            title: 'Player bounties',
            message: 'Player bounties can only be accepted at citadels and kingdoms.',
            category: 'game'
        },
        'NEXUS-AGE-022': {
            http: 400,
            title: 'Player bounties',
            message: 'You may only accept one guild bounty at a time.',
            category: 'game'
        },
        'NEXUS-AGE-023': {
            http: 400,
            title: 'Player bounties',
            message: 'That bounty contract is unavailable or has expired.',
            category: 'game'
        },
        'NEXUS-AGE-024': {
            http: 403,
            title: 'Rank reset',
            message: 'Rank reset is only available while you are actively playing an Age.',
            category: 'game'
        },
        'NEXUS-AGE-025': {
            http: 429,
            title: 'Rank reset',
            message: 'You have used all rank or exile resets allowed for this Age session.',
            category: 'game'
        },
        'NEXUS-AGE-026': {
            http: 400,
            title: 'Rank reset',
            message: 'Choose a valid rank reset type (rank or exile).',
            category: 'game'
        },
        'NEXUS-AGE-027': {
            http: 400,
            title: 'Unit promotion',
            message: 'This unit stack has not earned enough experience for the next promotion rank.',
            category: 'game'
        },
        'NEXUS-AGE-028': {
            http: 409,
            title: 'Army group',
            message: 'You already lead an army group. Dismiss it before creating or leading another.',
            category: 'game'
        },
        'NEXUS-AGE-029': {
            http: 403,
            title: 'Army group attack',
            message: 'Only the army group leader can launch a group attack.',
            category: 'game'
        },
        'NEXUS-AGE-030': {
            http: 403,
            title: 'Army group assault',
            message: 'Launch assaults from the map while leading an army group — your group attacks together and disbands afterward.',
            category: 'game'
        },
        'NEXUS-AGE-031': {
            http: 403,
            title: 'Watchtower',
            message: 'Establish a bordering presence before using the Watchtower on this city.',
            category: 'game'
        },
        'NEXUS-AGE-032': {
            http: 409,
            title: 'Garrison spy',
            message: 'You have already filed a garrison spy report for this city this Age.',
            category: 'game'
        },
        'NEXUS-AGE-033': {
            http: 402,
            title: 'Scout raid',
            message: 'Not enough gold for a scout raid (150 gold required).',
            category: 'game'
        },
        'NEXUS-AGE-034': {
            http: 404,
            title: 'Watchtower target',
            message: 'That commander is not in this bordering city.',
            category: 'game'
        },
        'NEXUS-AGE-035': {
            http: 403,
            title: 'Border seize',
            message: 'You cannot seize allied or friendly commanders from the Watchtower.',
            category: 'game'
        },
        'NEXUS-AGE-036': {
            http: 400,
            title: 'Garrison compiler',
            message: 'Upload at least one garrison spy fragment before compiling a report.',
            category: 'game'
        },
        'NEXUS-AGE-037': {
            http: 403,
            title: 'Movement',
            message: 'That location is restricted. No army may enter or leave it.',
            category: 'game'
        },
        'NEXUS-AGE-038': {
            http: 403,
            title: 'Age session ended',
            message: 'Commander accounts were reset. Return to the portal and join the Age again.',
            category: 'game'
        },
        'NEXUS-AGE-039': {
            http: 400,
            title: 'Garrison roster',
            message: 'Select at least one unit to dismiss from your garrison roster.',
            category: 'game'
        },
        'NEXUS-AGE-040': {
            http: 400,
            title: 'Garrison roster',
            message: 'One or more selected units could not be found in your roster.',
            category: 'game'
        },
        'NEXUS-AGE-041': {
            http: 400,
            title: 'Unit evolution',
            message: 'No rank promotions or tier evolutions are available with your current provisions.',
            category: 'game'
        },

        /* --- Player conduct reports --- */
        'NEXUS-REPORT-001': {
            http: 400,
            title: 'Report a commander',
            message: 'Complete all required report fields before submitting.',
            category: 'moderation'
        },
        'NEXUS-REPORT-002': {
            http: 400,
            title: 'Report a commander',
            message: 'You cannot report your own account.',
            category: 'moderation'
        },
        'NEXUS-REPORT-003': {
            http: 400,
            title: 'Report a commander',
            message: 'Choose a valid report category.',
            category: 'moderation'
        },
        'NEXUS-REPORT-004': {
            http: 429,
            title: 'Report a commander',
            message: 'You have reached the report limit. Try again later or contact support if urgent.',
            category: 'moderation'
        },
        'NEXUS-REPORT-005': {
            http: 404,
            title: 'Report a commander',
            message: 'That commander could not be found.',
            category: 'moderation'
        },
        'NEXUS-REPORT-006': {
            http: 400,
            title: 'Report a commander',
            message: 'The screenshot could not be attached. Use PNG, JPG, WebP, or GIF up to 2 MB.',
            category: 'moderation'
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
            title: 'NOTICE!',
            message: 'A site update is rolling out. Service will be interrupted momentarily. You may dismiss this notice and keep playing until the connection drops.',
            category: 'network'
        },
        'RIFT-NET-003': {
            http: 0,
            title: 'UPDATE COMPLETE',
            message: 'Royal Armies is back online. Thank you for your patience.',
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
        GAME_ALLIANCE_REQUIRED: 'NEXUS-GAME-004',
        HQ_PLANNING_TOO_LARGE: 'NEXUS-HQ-001',
        HQ_PLANNING_MP_EXCEEDED: 'NEXUS-HQ-002',
        HQ_VOTE_CANDIDATE_INVALID: 'NEXUS-HQ-003',
        HQ_VOTE_DUPLICATE_CANDIDATE: 'NEXUS-HQ-004',
        HQ_WAR_TARGET_REQUIRED: 'NEXUS-HQ-005',
        HQ_COUNCIL_REQUIRED: 'NEXUS-HQ-006',
        HQ_VOTING_CLOSED: 'NEXUS-HQ-007',
        HQ_PLANNING_LOCKED: 'NEXUS-HQ-008',
        HQ_PLANNING_PUBLISH_EMPTY: 'NEXUS-HQ-009',
        HQ_PLANNING_NOT_CONFIRMED: 'NEXUS-HQ-010',
        HQ_PLANNING_NO_PUBLISHED: 'NEXUS-HQ-013',
        HQ_DISPATCH_TYPE_INVALID: 'NEXUS-HQ-011',
        HQ_DISPATCH_ACTIVE: 'NEXUS-HQ-012',
        HQ_AUTHORITY_REQUIRED: 'NEXUS-HQ-014',
        HQ_WAR_ALREADY_ACTIVE: 'NEXUS-HQ-015',
        HQ_SPY_LOG_FULL: 'NEXUS-HQ-016',
        HQ_SPY_LOG_PARTIAL: 'NEXUS-HQ-017',
        HQ_SPY_LOG_NOT_FOUND: 'NEXUS-HQ-018',
        HQ_SPY_ALLY_REQUIRED: 'NEXUS-HQ-019'
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

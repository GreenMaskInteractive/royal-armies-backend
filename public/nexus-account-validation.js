/**
 * Registration username rules (shared by portal client and Node server).
 */
(function initNexusAccountValidation(root, factory) {
    'use strict';

    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    root.NexusAccountValidation = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function buildNexusAccountValidationApi() {
    const USERNAME_MIN_LENGTH = 5;
    const USERNAME_MAX_LENGTH = 15;
    const USERNAME_ALLOWED_CHARS = /^[a-zA-Z0-9._-]+$/;

    const USERNAME_VALIDATION_MESSAGES = {
        'NEXUS-AUTH-012': 'Username must be at least 5 characters.',
        'NEXUS-AUTH-013': 'Username must be 15 characters or fewer.',
        'NEXUS-AUTH-014': 'Username may only use letters and numbers, with at most one period (.), one underscore (_), and one dash (-).'
    };

    function countChar(value, char) {
        let total = 0;
        for (let i = 0; i < value.length; i += 1) {
            if (value[i] === char) total += 1;
        }
        return total;
    }

    function validateRegistrationUsername(rawUsername) {
        const username = String(rawUsername || '').trim();

        if (!username) {
            return {
                ok: false,
                code: 'NEXUS-AUTH-005',
                message: 'Username, email, and password are required.'
            };
        }

        if (username.length < USERNAME_MIN_LENGTH) {
            return {
                ok: false,
                code: 'NEXUS-AUTH-012',
                message: USERNAME_VALIDATION_MESSAGES['NEXUS-AUTH-012']
            };
        }

        if (username.length > USERNAME_MAX_LENGTH) {
            return {
                ok: false,
                code: 'NEXUS-AUTH-013',
                message: USERNAME_VALIDATION_MESSAGES['NEXUS-AUTH-013']
            };
        }

        if (!USERNAME_ALLOWED_CHARS.test(username)) {
            return {
                ok: false,
                code: 'NEXUS-AUTH-014',
                message: USERNAME_VALIDATION_MESSAGES['NEXUS-AUTH-014']
            };
        }

        if (countChar(username, '.') > 1 || countChar(username, '_') > 1 || countChar(username, '-') > 1) {
            return {
                ok: false,
                code: 'NEXUS-AUTH-014',
                message: USERNAME_VALIDATION_MESSAGES['NEXUS-AUTH-014']
            };
        }

        return { ok: true, username };
    }

    return {
        USERNAME_MIN_LENGTH,
        USERNAME_MAX_LENGTH,
        validateRegistrationUsername
    };
});

/**
 * Royal Armies game shell — under-development placeholder with live Age presence.
 */
(function initRoyalArmiesGamePage(global) {
    'use strict';

    const GAME_PRESENCE_HEARTBEAT_MS = 20000;
    const ACTIVE_AGE_STORAGE_KEY = 'savedCommanderInActiveAge';

    let presenceHeartbeatTimer = null;
    let ageSessionLeaveSent = false;

    function resolveApiUrl(path) {
        if (typeof global.resolveRoyalArmiesApiUrl === 'function') {
            return global.resolveRoyalArmiesApiUrl(path);
        }
        return path;
    }

    function resolveGamePageUsername() {
        const saved = global.localStorage.getItem('activeCommanderUser');
        if (saved && saved.trim()) return saved.trim();

        if (typeof global.getActiveCommanderUsername === 'function') {
            const name = String(global.getActiveCommanderUsername() || '').trim();
            if (name && name.toLowerCase() !== 'testaccount') return name;
        }

        return '';
    }

    function markPlayingActiveAgeLocally() {
        try {
            global.localStorage.setItem(ACTIVE_AGE_STORAGE_KEY, 'true');
        } catch (_err) {
            /* ignore */
        }
    }

    function clearPlayingActiveAgeLocally() {
        try {
            global.localStorage.removeItem(ACTIVE_AGE_STORAGE_KEY);
        } catch (_err) {
            /* ignore */
        }
    }

    async function postAgeJoin() {
        const username = resolveGamePageUsername();
        if (!username) return;

        try {
            await global.fetch(resolveApiUrl('/api/portal/age/join'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username }),
                cache: 'no-store',
                credentials: 'include'
            });
        } catch (err) {
            console.warn('Age join sync failed:', err);
        }
    }

    async function postAgeLeave(useKeepalive) {
        if (ageSessionLeaveSent) return;
        const username = resolveGamePageUsername();
        if (!username) return;

        ageSessionLeaveSent = true;
        clearPlayingActiveAgeLocally();

        const fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username }),
            cache: 'no-store',
            credentials: 'include'
        };
        if (useKeepalive) fetchOptions.keepalive = true;

        try {
            await global.fetch(resolveApiUrl('/api/portal/age/leave'), fetchOptions);
        } catch (err) {
            console.warn('Age leave sync failed:', err);
        }
    }

    async function sendGamePresenceHeartbeat() {
        const username = resolveGamePageUsername();
        if (!username || username.toLowerCase() === 'testaccount') return;

        try {
            await global.fetch(resolveApiUrl('/api/portal/presence'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, inAge: true }),
                cache: 'no-store',
                credentials: 'include'
            });
        } catch (err) {
            console.warn('Game presence heartbeat failed:', err);
        }
    }

    function startGamePresenceLoop() {
        if (presenceHeartbeatTimer) {
            global.clearInterval(presenceHeartbeatTimer);
        }
        sendGamePresenceHeartbeat();
        presenceHeartbeatTimer = global.setInterval(sendGamePresenceHeartbeat, GAME_PRESENCE_HEARTBEAT_MS);
    }

    function stopGamePresenceLoop() {
        if (presenceHeartbeatTimer) {
            global.clearInterval(presenceHeartbeatTimer);
            presenceHeartbeatTimer = null;
        }
    }

    function bindReturnToPortalButton() {
        const button = global.document.getElementById('game-return-portal-btn');
        if (!button) return;

        button.addEventListener('click', async (event) => {
            event.preventDefault();
            stopGamePresenceLoop();
            await postAgeLeave(false);
            global.location.href = 'main.html';
        });
    }

    function bindTutorialLabel() {
        const params = new URLSearchParams(global.location.search || '');
        const isTutorial = params.get('tutorial') === 'true';
        const label = global.document.getElementById('game-age-mode-label');
        if (label) {
            label.textContent = isTutorial ? 'Tutorial Age' : 'Active Age';
        }
    }

    async function bootstrapGamePageSession() {
        if (typeof global.ensurePortalAuthRestored === 'function') {
            await global.ensurePortalAuthRestored();
        }

        if (typeof global.applyLocalDevAutoLogin === 'function' && !resolveGamePageUsername()) {
            await global.applyLocalDevAutoLogin();
        }

        const username = resolveGamePageUsername();
        if (!username) {
            global.location.replace('main.html');
            return;
        }

        markPlayingActiveAgeLocally();
        await postAgeJoin();
        startGamePresenceLoop();

        if (typeof global.fetchCommanderDossierFromServer === 'function') {
            await global.fetchCommanderDossierFromServer();
        }
    }

    async function handleJoinAgeAchievementUnlock() {
        if (typeof global.tryGrantWhoaSlowDownFromJoinAttempt !== 'function') return;

        const result = await global.tryGrantWhoaSlowDownFromJoinAttempt(resolveGamePageUsername());
        if (result && result.granted && result.award && typeof global.showAchievementUnlockPopup === 'function') {
            global.showAchievementUnlockPopup(result.award);
        }
    }

    function registerUnloadHandlers() {
        global.addEventListener('pagehide', () => {
            stopGamePresenceLoop();
            postAgeLeave(true);
        });

        global.addEventListener('beforeunload', () => {
            stopGamePresenceLoop();
            postAgeLeave(true);
        });
    }

    async function bootGamePage() {
        bindTutorialLabel();
        bindReturnToPortalButton();
        registerUnloadHandlers();
        await bootstrapGamePageSession();
        await handleJoinAgeAchievementUnlock();

        if (global.RoyalArmiesAchievements && typeof global.RoyalArmiesAchievements.maybeRunDevAchievementPopupFromQuery === 'function') {
            global.RoyalArmiesAchievements.maybeRunDevAchievementPopupFromQuery();
        }
    }

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', () => {
            bootGamePage();
        });
    } else {
        bootGamePage();
    }
})(window);

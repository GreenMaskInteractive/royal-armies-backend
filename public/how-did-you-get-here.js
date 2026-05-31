/**
 * Join Age placeholder — Age session metrics + apology handoff page.
 */
(function initHowDidYouGetHerePage(global) {
    'use strict';

    const PRESENCE_HEARTBEAT_MS = 20000;
    const ACTIVE_AGE_STORAGE_KEY = 'savedCommanderInActiveAge';

    let presenceHeartbeatTimer = null;
    let ageSessionLeaveSent = false;

    function resolveApiUrl(path) {
        if (typeof global.resolveRoyalArmiesApiUrl === 'function') {
            return global.resolveRoyalArmiesApiUrl(path);
        }
        return path;
    }

    function resolvePageUsername() {
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
        const username = resolvePageUsername();
        if (!username) return;

        try {
            const response = await global.fetch(resolveApiUrl('/api/portal/age/join'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username }),
                cache: 'no-store',
                credentials: 'include'
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload.status === 'error') {
                console.warn('Age join sync failed:', payload?.message || payload);
            }
        } catch (err) {
            console.warn('Age join sync failed:', err);
        }
    }

    async function postAgeLeave(useKeepalive) {
        if (ageSessionLeaveSent) return;
        const username = resolvePageUsername();
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

    async function sendPresenceHeartbeat() {
        const username = resolvePageUsername();
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
            console.warn('Presence heartbeat failed:', err);
        }
    }

    function startPresenceLoop() {
        if (presenceHeartbeatTimer) {
            global.clearInterval(presenceHeartbeatTimer);
        }
        sendPresenceHeartbeat();
        presenceHeartbeatTimer = global.setInterval(sendPresenceHeartbeat, PRESENCE_HEARTBEAT_MS);
    }

    function stopPresenceLoop() {
        if (presenceHeartbeatTimer) {
            global.clearInterval(presenceHeartbeatTimer);
            presenceHeartbeatTimer = null;
        }
    }

    function persistAgeDeploymentPanelUnlockFromQuery() {
        try {
            const username = String(global.localStorage.getItem('activeCommanderUser') || '').trim().toLowerCase();
            if (!username) return;

            global.localStorage.setItem(`royalArmies_${username}_ageDeploymentPanelUnlocked`, 'true');

            const params = new URLSearchParams(global.location.search);
            global.localStorage.setItem(
                `royalArmies_${username}_ageDeploymentTutorialMode`,
                params.get('tutorial') === 'true' ? 'true' : 'false'
            );

            const serverKey = `royalArmies_${username}_ageDeploymentSelectedServerId`;
            const serverFromQuery = params.get('server');
            if (serverFromQuery) {
                global.localStorage.setItem(serverKey, serverFromQuery);
            } else if (!global.localStorage.getItem(serverKey)) {
                global.localStorage.setItem(serverKey, 'amnek');
            }
        } catch (_err) {
            /* ignore */
        }
    }

    function applyTutorialAgeLabel() {
        const label = global.document.getElementById('how-did-you-get-here-age-label');
        if (!label) return;

        const params = new URLSearchParams(global.location.search);
        const isTutorial = params.get('tutorial') === 'true';
        label.textContent = isTutorial ? 'Tutorial Age' : 'Active Age';
    }

    async function returnToAgePortal() {
        stopPresenceLoop();
        await postAgeLeave(false);
        if (global.RoyalArmiesPageRouteTransition && typeof global.RoyalArmiesPageRouteTransition.navigateTo === 'function') {
            await global.RoyalArmiesPageRouteTransition.navigateTo('/main');
            return;
        }
        global.location.href = '/main';
    }

    function registerUnloadHandlers() {
        global.addEventListener('pagehide', () => {
            stopPresenceLoop();
            postAgeLeave(true);
        });

        global.addEventListener('beforeunload', () => {
            stopPresenceLoop();
            postAgeLeave(true);
        });
    }

    function bindReturnButton() {
        const button = global.document.getElementById('how-did-you-get-here-return-btn');
        if (!button) return;

        button.addEventListener('click', async (event) => {
            event.preventDefault();
            await returnToAgePortal();
        });
    }

    async function handleJoinAgeAchievementUnlock() {
        if (typeof global.tryGrantWhoaSlowDownFromJoinAttempt !== 'function') return;

        const result = await global.tryGrantWhoaSlowDownFromJoinAttempt(resolvePageUsername());
        if (result && result.granted && result.award && typeof global.showAchievementUnlockPopup === 'function') {
            global.showAchievementUnlockPopup(result.award);
        }
    }

    async function bootstrapPageSession() {
        if (typeof global.ensurePortalAuthRestored === 'function') {
            await global.ensurePortalAuthRestored();
        }

        if (typeof global.applyLocalDevAutoLogin === 'function' && !resolvePageUsername()) {
            await global.applyLocalDevAutoLogin();
        }

        const username = resolvePageUsername();
        if (!username) {
            global.location.replace('/main');
            return;
        }

        if (typeof global.syncPlayerFromActiveCommanderStorage === 'function') {
            global.syncPlayerFromActiveCommanderStorage();
        }

        persistAgeDeploymentPanelUnlockFromQuery();
        applyTutorialAgeLabel();
        markPlayingActiveAgeLocally();
        await postAgeJoin();
        startPresenceLoop();

        if (typeof global.fetchCommanderDossierFromServer === 'function') {
            await global.fetchCommanderDossierFromServer();
        }
    }

    async function showHandoffAchievementUnlocks() {
        if (global.RoyalArmiesAchievements && typeof global.RoyalArmiesAchievements.maybeShowPendingLoginAchievementUnlocks === 'function') {
            await global.RoyalArmiesAchievements.maybeShowPendingLoginAchievementUnlocks();
        } else if (typeof global.maybeShowPendingLoginAchievementUnlocks === 'function') {
            await global.maybeShowPendingLoginAchievementUnlocks();
        }
    }

    async function bootHowDidYouGetHerePage() {
        registerUnloadHandlers();
        bindReturnButton();
        await bootstrapPageSession();
        await showHandoffAchievementUnlocks();
        await handleJoinAgeAchievementUnlock();

        if (global.RoyalArmiesAchievements && typeof global.RoyalArmiesAchievements.maybeRunDevAchievementPopupFromQuery === 'function') {
            global.RoyalArmiesAchievements.maybeRunDevAchievementPopupFromQuery();
        }
    }

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', () => {
            bootHowDidYouGetHerePage();
        });
    } else {
        bootHowDidYouGetHerePage();
    }
})(window);

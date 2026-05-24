/**
 * Royal Armies game shell — Age presence, game nav, and session handoff.
 */
(function initRoyalArmiesGamePage(global) {
    'use strict';

    const GAME_PRESENCE_HEARTBEAT_MS = 20000;
    const ACTIVE_AGE_STORAGE_KEY = 'savedCommanderInActiveAge';
    const GAME_VIEW_LABELS = {
        overview: 'Overview',
        city: 'City',
        map: 'Map'
    };

    let presenceHeartbeatTimer = null;
    let ageSessionLeaveSent = false;
    let activeGameView = 'overview';

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

    function resolveGameAvatarUrl() {
        const saved = global.localStorage.getItem('savedProfileAvatarUrl');
        if (saved && saved.trim()) return saved.trim();
        return 'images/avatars/commanderprofile01.png';
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

    async function notifyGameSessionError(response, payload, fallbackTitle, networkCode) {
        if (typeof global.handleRiftApiFailure === 'function') {
            await global.handleRiftApiFailure(response, payload, fallbackTitle);
            return;
        }
        if (typeof global.handleRoyalArmiesApiFailure === 'function') {
            await global.handleRoyalArmiesApiFailure(response, payload, fallbackTitle);
            return;
        }
        if (typeof global.showRiftError === 'function') {
            await global.showRiftError(payload || { code: networkCode }, fallbackTitle);
            return;
        }
        console.warn(fallbackTitle, payload?.message || payload);
    }

    async function postAgeJoin() {
        const username = resolveGamePageUsername();
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
                await notifyGameSessionError(response, payload, 'Age session', 'NEXUS-GAME-006');
            }
        } catch (err) {
            console.warn('Age join sync failed:', err);
            if (typeof global.showRiftNetworkError === 'function') {
                await global.showRiftNetworkError('Age session');
            } else if (typeof global.showRoyalArmiesNetworkError === 'function') {
                await global.showRoyalArmiesNetworkError('Age session');
            }
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
            const response = await global.fetch(resolveApiUrl('/api/portal/age/leave'), fetchOptions);
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload.status === 'error') {
                await notifyGameSessionError(response, payload, 'Age session', 'NEXUS-GAME-007');
            }
        } catch (err) {
            console.warn('Age leave sync failed:', err);
            if (typeof global.showRiftNetworkError === 'function') {
                await global.showRiftNetworkError('Age session');
            } else if (typeof global.showRoyalArmiesNetworkError === 'function') {
                await global.showRoyalArmiesNetworkError('Age session');
            }
        }
    }

    async function sendGamePresenceHeartbeat() {
        const username = resolveGamePageUsername();
        if (!username || username.toLowerCase() === 'testaccount') return;

        try {
            const response = await global.fetch(resolveApiUrl('/api/portal/presence'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, inAge: true }),
                cache: 'no-store',
                credentials: 'include'
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload.status === 'error') {
                await notifyGameSessionError(response, payload, 'Presence', 'NEXUS-GAME-008');
            }
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

    async function returnToAgePortal() {
        stopGamePresenceLoop();
        await postAgeLeave(false);
        if (global.RoyalArmiesPageRouteTransition && typeof global.RoyalArmiesPageRouteTransition.navigateTo === 'function') {
            await global.RoyalArmiesPageRouteTransition.navigateTo('/main');
            return;
        }
        global.location.href = '/main';
    }

    function refreshGamePageNavChrome() {
        const username = resolveGamePageUsername();
        const avatarUrl = resolveGameAvatarUrl();

        const tag = global.document.getElementById('logged-user-tag');
        const mobileName = global.document.getElementById('game-mobile-nav-username');
        const avatarDesktop = global.document.getElementById('nav-embedded-avatar-crest');
        const avatarMobile = global.document.getElementById('game-mobile-nav-avatar');

        if (tag) tag.textContent = username || 'Commander';
        if (mobileName) mobileName.textContent = username || 'Commander';
        if (avatarDesktop) avatarDesktop.src = avatarUrl;
        if (avatarMobile) avatarMobile.src = avatarUrl;

        if (typeof global.refreshLoggedUserTagDisplay === 'function') {
            global.refreshLoggedUserTagDisplay();
        }
        if (typeof global.hydrateCommanderMembershipFromStorage === 'function') {
            global.hydrateCommanderMembershipFromStorage();
        }
    }

    function syncGameMobileNavLabel(viewId) {
        const label = global.document.getElementById('game-mobile-nav-current-label');
        if (label) {
            label.textContent = GAME_VIEW_LABELS[viewId] || GAME_VIEW_LABELS.overview;
        }
    }

    function setActiveGameView(viewId, clickEvent) {
        const nextView = GAME_VIEW_LABELS[viewId] ? viewId : 'overview';
        activeGameView = nextView;

        if (clickEvent) {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
        }

        global.document.querySelectorAll('.game-page-view[data-game-view]').forEach((panel) => {
            const isActive = panel.getAttribute('data-game-view') === nextView;
            panel.classList.toggle('is-active', isActive);
            panel.hidden = !isActive;
        });

        global.document.querySelectorAll('.game-page-nav-tabs .nav-tab[data-game-view]').forEach((tab) => {
            tab.classList.toggle('active', tab.getAttribute('data-game-view') === nextView);
        });

        global.document.querySelectorAll('#game-mobile-nav-pages .portal-mobile-nav-page-item[data-game-view]').forEach((btn) => {
            btn.classList.toggle('is-active', btn.getAttribute('data-game-view') === nextView);
        });

        syncGameMobileNavLabel(nextView);
        closeGameMobileNavMenu();
    }

    function isGameMobileNavLayout() {
        return global.matchMedia('(max-width: 1024px)').matches;
    }

    function closeGameMobileNavMenu() {
        const shell = global.document.getElementById('game-mobile-nav-shell');
        const menu = global.document.getElementById('game-mobile-nav-menu');
        const toggle = global.document.getElementById('game-mobile-nav-toggle');
        if (!shell || !menu || !toggle) return;

        shell.classList.remove('is-nav-open');
        menu.hidden = true;
        menu.classList.remove('is-menu-open');
        menu.setAttribute('inert', '');
        toggle.setAttribute('aria-expanded', 'false');
    }

    function openGameMobileNavMenu() {
        const shell = global.document.getElementById('game-mobile-nav-shell');
        const menu = global.document.getElementById('game-mobile-nav-menu');
        const toggle = global.document.getElementById('game-mobile-nav-toggle');
        if (!shell || !menu || !toggle) return;

        shell.classList.add('is-nav-open');
        menu.hidden = false;
        menu.classList.add('is-menu-open');
        menu.removeAttribute('inert');
        toggle.setAttribute('aria-expanded', 'true');
    }

    function toggleGameMobileNavMenu(event) {
        if (event) event.preventDefault();
        const shell = global.document.getElementById('game-mobile-nav-shell');
        if (!shell) return;
        if (shell.classList.contains('is-nav-open')) {
            closeGameMobileNavMenu();
            return;
        }
        openGameMobileNavMenu();
    }

    function toggleGameMobileCommanderSubmenu(event) {
        if (event) event.stopPropagation();
        const submenu = global.document.getElementById('game-mobile-commander-submenu');
        const toggle = global.document.getElementById('game-mobile-commander-toggle');
        if (!submenu || !toggle) return;

        const menu = global.document.getElementById('game-mobile-nav-menu');
        const willOpen = submenu.hidden;
        submenu.hidden = !willOpen;
        toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        if (menu) {
            menu.classList.toggle('is-commander-submenu-open', willOpen);
        }
    }

    function gameMobileNavCommanderAction(action, event) {
        if (event) event.stopPropagation();
        closeGameMobileNavMenu();

        switch (action) {
            case 'view-profile':
                if (typeof global.openPublicCommanderProfileCard === 'function') {
                    global.openPublicCommanderProfileCard(event);
                }
                break;
            case 'edit-profile':
                if (typeof global.openCommanderHubModal === 'function') {
                    global.openCommanderHubModal('profile', event);
                }
                break;
            case 'messages':
                if (typeof global.openCommanderHubMessagesInbox === 'function') {
                    global.openCommanderHubMessagesInbox(event);
                }
                break;
            case 'settings':
                if (typeof global.openCommanderHubModal === 'function') {
                    global.openCommanderHubModal('settings', event);
                }
                break;
            case 'return-to-portal':
                returnToAgePortal();
                break;
            case 'logout':
                if (typeof global.handleHeaderAuthAction === 'function') {
                    global.handleHeaderAuthAction();
                } else if (typeof global.triggerMainDashboardLogout === 'function') {
                    global.triggerMainDashboardLogout();
                }
                break;
            default:
                break;
        }
    }

    function bindGamePageNavigation() {
        global.document.querySelectorAll('.game-page-nav-tabs .nav-tab[data-game-view]').forEach((tab) => {
            tab.addEventListener('click', (event) => {
                setActiveGameView(tab.getAttribute('data-game-view') || 'overview', event);
            });
            tab.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                setActiveGameView(tab.getAttribute('data-game-view') || 'overview', event);
            });
        });

        global.document.querySelectorAll('#game-mobile-nav-pages .portal-mobile-nav-page-item[data-game-view]').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                setActiveGameView(btn.getAttribute('data-game-view') || 'overview', event);
            });
        });

        const mobileToggle = global.document.getElementById('game-mobile-nav-toggle');
        if (mobileToggle) {
            mobileToggle.addEventListener('click', toggleGameMobileNavMenu);
        }

        global.document.addEventListener('click', (event) => {
            if (!isGameMobileNavLayout()) return;
            const shell = global.document.getElementById('game-mobile-nav-shell');
            if (!shell || !shell.classList.contains('is-nav-open')) return;
            if (event.target.closest('#game-mobile-nav-shell')) return;
            closeGameMobileNavMenu();
        });

        global.addEventListener('resize', () => {
            if (!isGameMobileNavLayout()) {
                closeGameMobileNavMenu();
            }
        });
    }

    function persistAgeDeploymentPanelUnlockFromGamePage() {
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
            if (!global.localStorage.getItem(serverKey)) {
                global.localStorage.setItem(serverKey, 'amnek');
            }
        } catch (_err) {
            /* ignore */
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
            global.location.replace('/main');
            return;
        }

        if (typeof global.syncPlayerFromActiveCommanderStorage === 'function') {
            global.syncPlayerFromActiveCommanderStorage();
        }

        persistAgeDeploymentPanelUnlockFromGamePage();

        markPlayingActiveAgeLocally();
        await postAgeJoin();
        startGamePresenceLoop();

        if (typeof global.fetchCommanderDossierFromServer === 'function') {
            await global.fetchCommanderDossierFromServer();
        }

        refreshGamePageNavChrome();
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
        bindGamePageNavigation();
        registerUnloadHandlers();
        setActiveGameView('overview');
        await bootstrapGamePageSession();

        if (typeof global.bindPortalNewMessagesBarNavigation === 'function') {
            global.bindPortalNewMessagesBarNavigation();
        }
        if (typeof global.fetchCommanderMailboxFromServer === 'function') {
            await global.fetchCommanderMailboxFromServer();
        }
        if (typeof global.startPortalMailboxPolling === 'function') {
            global.startPortalMailboxPolling();
        }
    }

    global.switchGamePageView = setActiveGameView;
    global.returnToGameAgePortal = returnToAgePortal;
    global.toggleGameMobileCommanderSubmenu = toggleGameMobileCommanderSubmenu;
    global.gameMobileNavCommanderAction = gameMobileNavCommanderAction;

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', () => {
            bootGamePage();
        });
    } else {
        bootGamePage();
    }
})(window);

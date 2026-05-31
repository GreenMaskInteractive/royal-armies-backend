/**
 * Royal Armies game shell — Age presence, game nav, and session handoff.
 */
(function initRoyalArmiesGamePage(global) {
    'use strict';

    const GAME_PRESENCE_HEARTBEAT_MS = 20000;
    const ACTIVE_AGE_STORAGE_KEY = 'savedCommanderInActiveAge';
    const GAME_ONBOARDING_STEPS = ['class', 'region', 'tutorial', 'join-battle'];
    const GAME_VIEW_LABELS = {
        class: 'Choose a Class',
        region: 'Choose Starting Location',
        tutorial: 'Tutorial',
        'join-battle': 'Join the Battle'
    };
    const GAME_ONBOARDING_SLIDE_MS = 480;
    const GAME_SESSION_FADE_MS = 900;

    let presenceHeartbeatTimer = null;
    let ageSessionLeaveSent = false;
    let activeGameView = 'class';
    let furthestUnlockedStepIndex = 0;
    let isOnboardingViewAnimating = false;
    let onboardingViewTransitionTimer = null;

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

    function getGameTutorialConcludedStorageKey() {
        const username = resolveGamePageUsername();
        if (!username) return '';
        return `royalArmies_${username.toLowerCase()}_gameTutorialConcluded`;
    }

    function getGameSessionStartedStorageKey() {
        const username = resolveGamePageUsername();
        if (!username) return '';
        return `royalArmies_${username.toLowerCase()}_gameSessionStarted`;
    }

    function isGameSessionStarted() {
        const storageKey = getGameSessionStartedStorageKey();
        if (!storageKey) return false;
        try {
            return global.localStorage.getItem(storageKey) === 'true';
        } catch (_err) {
            return false;
        }
    }

    function markGameSessionStarted() {
        const storageKey = getGameSessionStartedStorageKey();
        if (!storageKey) return false;

        try {
            global.localStorage.setItem(storageKey, 'true');
        } catch (_err) {
            return false;
        }

        return true;
    }

    function clearGameSessionStarted() {
        const storageKey = getGameSessionStartedStorageKey();
        if (!storageKey) return false;

        try {
            global.localStorage.removeItem(storageKey);
        } catch (_err) {
            return false;
        }

        return true;
    }

    function clearGameTutorialConcluded() {
        const storageKey = getGameTutorialConcludedStorageKey();
        if (!storageKey) return false;

        try {
            global.localStorage.removeItem(storageKey);
        } catch (_err) {
            return false;
        }

        return true;
    }

    function shouldResetProgressionFromDevBypass() {
        try {
            return new URLSearchParams(global.location.search).get('riftProgressionReset') === '1';
        } catch (_err) {
            return false;
        }
    }

    function isLocalGameProgressionPreviewActive() {
        return typeof global.shouldAllowLocalGameProgressionPreview === 'function'
            && global.shouldAllowLocalGameProgressionPreview();
    }

    function shouldResumeActiveAgeSession() {
        return isGameSessionStarted() && !isLocalGameProgressionPreviewActive();
    }

    function shouldBlockOnboardingProgression() {
        return isOnboardingViewAnimating || shouldResumeActiveAgeSession();
    }

    function consumeProgressionResetQuery() {
        try {
            const url = new URL(global.location.href);
            if (!url.searchParams.has('riftProgressionReset')) return;
            url.searchParams.delete('riftProgressionReset');
            const next = `${url.pathname}${url.search}${url.hash}`;
            global.history.replaceState(null, '', next);
        } catch (_err) {
            /* ignore */
        }
    }

    function resetGameProgressionToStart() {
        clearGameSessionStarted();
        clearGameTutorialConcluded();
        furthestUnlockedStepIndex = 0;
        resetGameOnboardingSelections();
        applyGameTutorialConcludedChrome();
        applyGameSessionChrome();
        setActiveGameViewInstant('class');

        if (global.RoyalArmiesGameRegionsMap && typeof global.RoyalArmiesGameRegionsMap.scheduleFlankLayout === 'function') {
            global.RoyalArmiesGameRegionsMap.scheduleFlankLayout();
        }
    }

    function resetGameOnboardingSelections() {
        if (typeof global.clearGameClassPickerSelection === 'function') {
            global.clearGameClassPickerSelection();
        }
        if (global.RoyalArmiesGameRegionsMap && typeof global.RoyalArmiesGameRegionsMap.resetLocationPicker === 'function') {
            global.RoyalArmiesGameRegionsMap.resetLocationPicker();
        } else if (global.RoyalArmiesGameRegionsMap && typeof global.RoyalArmiesGameRegionsMap.setSelectedRegionId === 'function') {
            global.RoyalArmiesGameRegionsMap.setSelectedRegionId(null);
        }
    }

    function returnToGameOnboardingStart(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (isOnboardingViewAnimating) {
            return false;
        }

        clearGameSessionStarted();
        furthestUnlockedStepIndex = 0;
        resetGameOnboardingSelections();

        applyGameSessionChrome();
        setActiveGameViewInstant('class');

        if (global.RoyalArmiesGameRegionsMap && typeof global.RoyalArmiesGameRegionsMap.scheduleFlankLayout === 'function') {
            global.RoyalArmiesGameRegionsMap.scheduleFlankLayout();
        }

        return true;
    }

    function prefersReducedGameMotion() {
        try {
            return global.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (_err) {
            return false;
        }
    }

    function waitGameTransition(ms) {
        return new Promise((resolve) => {
            global.setTimeout(resolve, ms);
        });
    }

    function waitForGameTransitionPaint() {
        return new Promise((resolve) => {
            global.requestAnimationFrame(() => {
                global.requestAnimationFrame(resolve);
            });
        });
    }

    function ensureGameSessionTransitionOverlay() {
        let overlay = global.document.getElementById('game-onboarding-session-transition');
        if (!overlay) {
            overlay = global.document.createElement('div');
            overlay.id = 'game-onboarding-session-transition';
            overlay.className = 'game-onboarding-session-transition';
            overlay.setAttribute('aria-hidden', 'true');
            const mountTarget = global.document.body || global.document.documentElement;
            mountTarget.appendChild(overlay);
        }
        return overlay;
    }

    function applyGameSessionChrome() {
        const canvas = global.document.getElementById('game-page-canvas');
        const viewport = global.document.getElementById('game-page-viewport');
        const progress = global.document.getElementById('game-onboarding-progress');
        const sessionStage = global.document.getElementById('game-session-stage');
        const started = shouldResumeActiveAgeSession();

        if (canvas) {
            canvas.classList.toggle('game-session-active', started);
            canvas.classList.toggle('game-onboarding-active', !started);
        }
        if (viewport) viewport.hidden = started;
        if (progress) progress.hidden = started;
        if (sessionStage) sessionStage.hidden = !started;
    }

    function isGameTutorialConcluded() {
        const storageKey = getGameTutorialConcludedStorageKey();
        if (!storageKey) return false;
        try {
            return global.localStorage.getItem(storageKey) === 'true';
        } catch (_err) {
            return false;
        }
    }

    function applyGameTutorialConcludedChrome() {
        const canvas = global.document.getElementById('game-page-canvas');
        if (canvas) {
            canvas.classList.toggle('game-tutorial-concluded', isGameTutorialConcluded());
        }

        const completeBtn = global.document.getElementById('game-tutorial-complete-btn');
        if (completeBtn) {
            completeBtn.hidden = isGameTutorialConcluded();
        }
    }

    function markGameTutorialConcluded(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        const storageKey = getGameTutorialConcludedStorageKey();
        if (!storageKey) return false;

        try {
            global.localStorage.setItem(storageKey, 'true');
        } catch (_err) {
            return false;
        }

        applyGameTutorialConcludedChrome();

        if (activeGameView === 'tutorial') {
            advanceGameOnboarding();
        }

        return true;
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

        applyGameTutorialConcludedChrome();
    }

    function getGameOnboardingStepIndex(viewId) {
        return GAME_ONBOARDING_STEPS.indexOf(viewId);
    }

    function canNavigateBackToOnboardingStep(stepId, fromViewId) {
        return stepId === 'class' && fromViewId === 'region';
    }

    function refreshGameOnboardingProgress(viewId) {
        const activeIndex = getGameOnboardingStepIndex(viewId);

        global.document.querySelectorAll('.game-onboarding-step[data-game-view]').forEach((step) => {
            const stepId = step.getAttribute('data-game-view');
            const stepIndex = getGameOnboardingStepIndex(stepId);
            const isActive = stepId === viewId;
            const isComplete = stepIndex >= 0 && stepIndex < activeIndex;
            const isUpcoming = stepIndex > activeIndex;
            const isClickable = isComplete && canNavigateBackToOnboardingStep(stepId, viewId);

            step.classList.toggle('is-active', isActive);
            step.classList.toggle('is-complete', isComplete);
            step.classList.toggle('is-upcoming', isUpcoming);
            step.classList.toggle('is-clickable', isClickable);

            if (isActive) {
                step.setAttribute('aria-current', 'step');
            } else {
                step.removeAttribute('aria-current');
            }

            if (isClickable) {
                step.setAttribute('role', 'button');
                step.setAttribute('tabindex', '0');
                step.removeAttribute('aria-disabled');
            } else {
                step.removeAttribute('role');
                step.removeAttribute('tabindex');
            }

            if (isUpcoming) {
                step.setAttribute('aria-disabled', 'true');
            } else if (!isClickable) {
                step.removeAttribute('aria-disabled');
            }
        });

        const progressRoot = global.document.getElementById('game-onboarding-progress');
        if (progressRoot && activeIndex >= 0) {
            const fillPct = GAME_ONBOARDING_STEPS.length > 1
                ? (activeIndex / (GAME_ONBOARDING_STEPS.length - 1)) * 100
                : 0;
            progressRoot.style.setProperty('--game-onboarding-fill', `${fillPct}%`);
            progressRoot.dataset.activeStep = viewId;
        }
    }

    function getGameOnboardingViewPanel(viewId) {
        return global.document.querySelector(`.game-page-view[data-game-view="${viewId}"]`);
    }

    function scheduleRegionFlankLayoutIfNeeded(viewId) {
        if (viewId === 'region' && global.RoyalArmiesGameRegionsMap && typeof global.RoyalArmiesGameRegionsMap.scheduleFlankLayout === 'function') {
            global.RoyalArmiesGameRegionsMap.scheduleFlankLayout();
        }
    }

    function clearOnboardingViewTransitionTimer() {
        if (onboardingViewTransitionTimer) {
            global.clearTimeout(onboardingViewTransitionTimer);
            onboardingViewTransitionTimer = null;
        }
    }

    function finishOnboardingViewTransition(incomingPanel, nextView) {
        clearOnboardingViewTransitionTimer();

        if (incomingPanel) {
            incomingPanel.classList.remove('is-onboarding-entering');
        }

        isOnboardingViewAnimating = false;
        scheduleRegionFlankLayoutIfNeeded(nextView);
    }

    function setActiveGameViewInstant(nextView) {
        activeGameView = nextView;

        global.document.querySelectorAll('.game-page-view[data-game-view]').forEach((panel) => {
            const isActive = panel.getAttribute('data-game-view') === nextView;
            panel.classList.remove('is-onboarding-entering', 'is-onboarding-exiting');
            panel.classList.toggle('is-active', isActive);
            panel.hidden = !isActive;
        });

        refreshGameOnboardingProgress(nextView);
        scheduleRegionFlankLayoutIfNeeded(nextView);
        closeGameMobileCommanderSubmenu();
    }

    function setActiveGameViewAnimated(nextView) {
        const outgoingPanel = getGameOnboardingViewPanel(activeGameView);
        const incomingPanel = getGameOnboardingViewPanel(nextView);

        if (!incomingPanel || activeGameView === nextView) {
            return;
        }

        if (prefersReducedGameMotion() || !outgoingPanel) {
            setActiveGameViewInstant(nextView);
            return;
        }

        if (isOnboardingViewAnimating) {
            return;
        }

        isOnboardingViewAnimating = true;
        activeGameView = nextView;
        refreshGameOnboardingProgress(nextView);
        closeGameMobileCommanderSubmenu();

        incomingPanel.hidden = true;
        incomingPanel.classList.remove('is-active', 'is-onboarding-entering');
        outgoingPanel.classList.remove('is-onboarding-exiting');
        void outgoingPanel.offsetWidth;
        outgoingPanel.classList.add('is-onboarding-exiting');

        let exitPhaseDone = false;

        const beginIncomingSlide = () => {
            if (exitPhaseDone) return;
            exitPhaseDone = true;
            clearOnboardingViewTransitionTimer();

            outgoingPanel.classList.remove('is-onboarding-exiting', 'is-active');
            outgoingPanel.hidden = true;

            incomingPanel.hidden = false;
            incomingPanel.classList.add('is-active');
            incomingPanel.classList.remove('is-onboarding-entering');

            let enterPhaseDone = false;

            const completeTransition = () => {
                if (enterPhaseDone || !isOnboardingViewAnimating) return;
                enterPhaseDone = true;
                clearOnboardingViewTransitionTimer();
                finishOnboardingViewTransition(incomingPanel, nextView);
            };

            const bindEnterCompletion = () => {
                incomingPanel.addEventListener('animationend', (event) => {
                    if (event.target !== incomingPanel) return;
                    if (event.animationName !== 'game-onboarding-view-slide-in') return;
                    completeTransition();
                }, { once: true });

                clearOnboardingViewTransitionTimer();
                onboardingViewTransitionTimer = global.setTimeout(completeTransition, GAME_ONBOARDING_SLIDE_MS + 80);
            };

            global.requestAnimationFrame(() => {
                global.requestAnimationFrame(() => {
                    void incomingPanel.offsetWidth;
                    incomingPanel.classList.add('is-onboarding-entering');
                    bindEnterCompletion();
                });
            });
        };

        outgoingPanel.addEventListener('animationend', (event) => {
            if (event.target !== outgoingPanel) return;
            if (event.animationName !== 'game-onboarding-view-slide-out') return;
            beginIncomingSlide();
        }, { once: true });

        clearOnboardingViewTransitionTimer();
        onboardingViewTransitionTimer = global.setTimeout(beginIncomingSlide, GAME_ONBOARDING_SLIDE_MS + 80);
    }

    function setActiveGameView(viewId, clickEvent, options) {
        if (clickEvent) {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
            return;
        }

        const nextView = GAME_VIEW_LABELS[viewId] ? viewId : 'class';
        const nextIndex = getGameOnboardingStepIndex(nextView);
        if (nextIndex < 0 || nextIndex !== furthestUnlockedStepIndex) {
            return;
        }

        const animate = options && options.animate === true;
        if (animate) {
            setActiveGameViewAnimated(nextView);
            return;
        }

        setActiveGameViewInstant(nextView);
    }

    async function runGameSessionFadeTransition(runWhileCovered) {
        const overlay = ensureGameSessionTransitionOverlay();
        overlay.classList.remove('is-revealing');
        overlay.classList.add('is-visible', 'is-covered');
        overlay.setAttribute('aria-hidden', 'false');

        await waitForGameTransitionPaint();
        await waitGameTransition(GAME_SESSION_FADE_MS);

        if (typeof runWhileCovered === 'function') {
            await runWhileCovered();
        }

        overlay.classList.remove('is-covered');
        overlay.classList.add('is-revealing');
        await waitForGameTransitionPaint();
        await waitGameTransition(GAME_SESSION_FADE_MS + 80);

        overlay.classList.remove('is-visible', 'is-revealing');
        overlay.setAttribute('aria-hidden', 'true');
    }

    function resolveOfficialAgePagePath() {
        if (typeof global.getOfficialAgePagePath === 'function') {
            return global.getOfficialAgePagePath();
        }
        return '/agealpha';
    }

    async function enterGameSessionFromOnboarding() {
        if (shouldBlockOnboardingProgression()) {
            return false;
        }
        if (activeGameView !== 'join-battle') {
            return false;
        }

        const agePath = resolveOfficialAgePagePath();

        await runGameSessionFadeTransition(async () => {
            if (!markGameSessionStarted()) return;
            if (global.RoyalArmiesPageRouteTransition && typeof global.RoyalArmiesPageRouteTransition.navigateTo === 'function') {
                await global.RoyalArmiesPageRouteTransition.navigateTo(agePath);
                return;
            }
            global.location.assign(agePath);
        });

        return true;
    }

    function closeGameMobileCommanderSubmenu() {
        const submenu = global.document.getElementById('game-mobile-commander-submenu');
        const toggle = global.document.getElementById('game-mobile-commander-toggle');
        const clip = global.document.getElementById('game-mobile-commander-clip');
        if (!submenu || !toggle) return;

        submenu.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        if (clip) clip.classList.remove('is-commander-open');
    }

    function toggleGameMobileCommanderSubmenu(event) {
        if (event) event.stopPropagation();
        const submenu = global.document.getElementById('game-mobile-commander-submenu');
        const toggle = global.document.getElementById('game-mobile-commander-toggle');
        const clip = global.document.getElementById('game-mobile-commander-clip');
        if (!submenu || !toggle) return;

        const willOpen = submenu.hidden;
        submenu.hidden = !willOpen;
        toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        if (clip) clip.classList.toggle('is-commander-open', willOpen);
    }

    function gameMobileNavCommanderAction(action, event) {
        if (event) event.stopPropagation();
        closeGameMobileCommanderSubmenu();

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

    function advanceGameOnboarding() {
        if (shouldBlockOnboardingProgression()) {
            return false;
        }

        const currentIndex = getGameOnboardingStepIndex(activeGameView);
        if (currentIndex < 0 || currentIndex >= GAME_ONBOARDING_STEPS.length - 1) {
            return false;
        }

        const nextIndex = currentIndex + 1;
        furthestUnlockedStepIndex = Math.max(furthestUnlockedStepIndex, nextIndex);
        setActiveGameView(GAME_ONBOARDING_STEPS[nextIndex], null, { animate: true });
        return true;
    }

    function returnToClassFromLocationPicker(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (shouldBlockOnboardingProgression() || activeGameView !== 'region') {
            return false;
        }

        if (global.RoyalArmiesGameRegionsMap && typeof global.RoyalArmiesGameRegionsMap.resetLocationPicker === 'function') {
            global.RoyalArmiesGameRegionsMap.resetLocationPicker();
        }

        furthestUnlockedStepIndex = 0;
        setActiveGameView('class', null, { animate: true });
        return true;
    }

    function onOnboardingProgressStepClick(event) {
        const step = event.target.closest('.game-onboarding-step.is-clickable');
        if (!step) return;

        const stepId = step.getAttribute('data-game-view');
        if (stepId === 'class') {
            returnToClassFromLocationPicker(event);
        }
    }

    function onOnboardingProgressStepKeydown(event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const step = event.target.closest('.game-onboarding-step.is-clickable');
        if (!step) return;
        event.preventDefault();
        onOnboardingProgressStepClick(event);
    }

    function bindGameOnboardingProgression() {
        const progressTrack = global.document.querySelector('.game-onboarding-progress-track');
        if (progressTrack && progressTrack.dataset.riftBound !== '1') {
            progressTrack.dataset.riftBound = '1';
            progressTrack.addEventListener('click', onOnboardingProgressStepClick);
            progressTrack.addEventListener('keydown', onOnboardingProgressStepKeydown);
        }

        global.addEventListener('royalarmies:class-confirmed', () => {
            if (activeGameView !== 'class') return;
            advanceGameOnboarding();
        });

        const joinBattleBtn = global.document.getElementById('game-join-battle-continue-btn');
        if (joinBattleBtn) {
            joinBattleBtn.addEventListener('click', () => {
                if (activeGameView !== 'join-battle' || isOnboardingViewAnimating) return;
                enterGameSessionFromOnboarding();
            });
        }

        const sessionBackBtn = global.document.getElementById('game-session-back-to-onboarding-btn');
        if (sessionBackBtn && sessionBackBtn.dataset.riftBound !== '1') {
            sessionBackBtn.dataset.riftBound = '1';
            sessionBackBtn.addEventListener('click', (event) => {
                returnToGameOnboardingStart(event);
            });
        }
    }

    function bindGamePageNavigation() {
        global.document.addEventListener('click', (event) => {
            const clip = global.document.getElementById('game-mobile-commander-clip');
            if (!clip || !clip.classList.contains('is-commander-open')) return;
            if (event.target.closest('#game-mobile-commander-clip')) return;
            closeGameMobileCommanderSubmenu();
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
        if (shouldResetProgressionFromDevBypass()) {
            resetGameProgressionToStart();
            consumeProgressionResetQuery();
        }

        if (shouldResumeActiveAgeSession()) {
            const agePath = resolveOfficialAgePagePath();
            if (global.RoyalArmiesPageRouteTransition && typeof global.RoyalArmiesPageRouteTransition.navigateTo === 'function') {
                await global.RoyalArmiesPageRouteTransition.navigateTo(agePath);
                return;
            }
            global.location.replace(agePath);
            return;
        }

        applyGameTutorialConcludedChrome();
        applyGameSessionChrome();
        bindGameOnboardingProgression();
        bindGamePageNavigation();
        registerUnloadHandlers();
        setActiveGameView('class');

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

    global.switchGamePageView = function switchGamePageView(viewId) {
        setActiveGameView(viewId);
    };
    global.advanceGameOnboarding = advanceGameOnboarding;
    global.returnToClassFromLocationPicker = returnToClassFromLocationPicker;
    global.enterGameSessionFromOnboarding = enterGameSessionFromOnboarding;
    global.returnToGameOnboardingStart = returnToGameOnboardingStart;
    global.isGameSessionStarted = isGameSessionStarted;
    global.isGameOnboardingViewAnimating = function isGameOnboardingViewAnimating() {
        return isOnboardingViewAnimating;
    };
    global.getFurthestUnlockedGameOnboardingStepIndex = function getFurthestUnlockedGameOnboardingStepIndex() {
        return furthestUnlockedStepIndex;
    };
    global.returnToGameAgePortal = returnToAgePortal;
    global.toggleGameMobileCommanderSubmenu = toggleGameMobileCommanderSubmenu;
    global.gameMobileNavCommanderAction = gameMobileNavCommanderAction;
    global.isGameTutorialConcluded = isGameTutorialConcluded;
    global.markGameTutorialConcluded = markGameTutorialConcluded;

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', () => {
            bootGamePage();
        });
    } else {
        bootGamePage();
    }
})(window);

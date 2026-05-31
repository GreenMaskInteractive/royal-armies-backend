/* ==========================================================================
   SECTION 1: DASHBOARD INITIALIZATION & LOCAL STATE MANAGEMENT
   ========================================================================== */

/* Block 1: HARDWARE INITIALIZATION SERVICE RUNTIME */
window.onload = async () => {
    console.log("Age Portal Matrix Loaded. Isolated Core Active.");

    if (typeof ensurePortalAuthRestored === 'function') {
        await ensurePortalAuthRestored();
    }

    // A. SECURE LOCAL RETRIEVAL HANDSHAKES: Pull saved keys directly out from device profile caches
    const savedCommanderUser = (typeof getActiveCommanderUsername === 'function')
        ? getActiveCommanderUsername()
        : (localStorage.getItem('activeCommanderUser') || '').trim();

    if (typeof syncPlayerFromActiveCommanderStorage === "function") {
        syncPlayerFromActiveCommanderStorage();
    }
    if (typeof hydrateCommanderMembershipFromStorage === "function") {
        hydrateCommanderMembershipFromStorage();
    } else if (typeof player !== "undefined") {
        player.name = savedCommanderUser;
    }
    
    // Fallback default avatar url string path automatically loads if memory registry pass is vacant
    const savedCommanderAvatar = localStorage.getItem("savedProfileAvatarUrl") || "images/avatars/commanderprofile01.png";
    
    // B. TARGET DOM INJECTIONS: Populate text and image fields simultaneously on screen load
    if (typeof refreshMainPortalAuthChrome === 'function') {
        refreshMainPortalAuthChrome();
    } else if (typeof refreshLoggedUserTagDisplay === 'function') {
        refreshLoggedUserTagDisplay();
    }

    syncPortalMobileNavIdentity();
    syncPortalMobileNavChrome(activeMainPortalView);
    applyPortalMobileNavPreviewRestrictions();
    bindPortalMobileNavDismissHandlers();
    applyPortalMobileNavLayoutMode();
    const avatarCrestElement = document.getElementById("nav-embedded-avatar-crest");
    if (avatarCrestElement) {
        avatarCrestElement.src = savedCommanderAvatar;
    }
    
    // Initialize mock statistics data models counters (guarded — elements exist only on legacy layouts)
    const metricsRoundDay = document.getElementById("metrics-round-day-val");
    const metricsCastleCount = document.getElementById("metrics-castle-count-val");
    const metricsPlayerPopulation = document.getElementById("metrics-player-population-val");
    if (metricsRoundDay) metricsRoundDay.innerText = "Day 14 / 60";
    if (metricsCastleCount) metricsCastleCount.innerText = "412 Bastions Secured";
    if (metricsPlayerPopulation) metricsPlayerPopulation.innerText = "8,240 Armies Standing";
    
    // Launch active chronometer ticker sand-clock calculations loop
    initializeServerAgeClockTickerCountdown();
    initializeUniversalGameTimeClock();
    initializePortalLivePlayerMetrics();

    applyPortalNavAccessRestrictions();
    applyPortalGuestDeploymentChrome();
    hydrateDevelopersLogDock();
    mountAgePortalHomeLayout();
    applyPortalAlphaVersionLabels();

    if (typeof loadCommanderMailboxDossiersFromStorage === 'function') {
        loadCommanderMailboxDossiersFromStorage();
    }
    if (typeof fetchCommanderMailboxFromServer === 'function') {
        fetchCommanderMailboxFromServer().then(() => {
            if (typeof syncNavMailboxIndicators === 'function') syncNavMailboxIndicators();
        });
    } else if (typeof syncNavMailboxIndicators === 'function') {
        syncNavMailboxIndicators();
    }

    if (typeof startPortalMailboxPolling === 'function') {
        startPortalMailboxPolling();
    }

    window.cachedAgePortalViewportHTML = snapshotAgePortalViewportForCache();
};

/* Block 2: Persistent Era Time Countdown Ticker */
const PORTAL_COUNTDOWN_TIMERS_PAUSED = true;
const PORTAL_COUNTDOWN_PAUSED_READOUT = '-- : -- : -- : --';

function arePortalCountdownTimersPaused() {
    return PORTAL_COUNTDOWN_TIMERS_PAUSED === true;
}

function formatUniversalGameTimeClock(now = new Date()) {
    const hours = String(now.getUTCHours()).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    const seconds = String(now.getUTCSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

/** Matches countdowntimermodal.png: thin wings (L/R), tall center crest (MM). */
const PORTAL_GAME_TIME_CHAR_SCALE_CLASSES = [
    'portal-game-time-char--wing-outer',
    'portal-game-time-char--wing-inner',
    'portal-game-time-char--sep',
    'portal-game-time-char--center',
    'portal-game-time-char--center',
    'portal-game-time-char--sep',
    'portal-game-time-char--wing-inner',
    'portal-game-time-char--wing-outer'
];

function renderUniversalGameTimeDisplay(display, timeString) {
    if (!display) return;

    const chars = String(timeString || '').padEnd(8, '-').slice(0, 8);
    const slots = display.querySelectorAll('.portal-game-time-char');

    if (slots.length !== 8) {
        display.innerHTML = chars.split('').map((ch, index) => {
            const scaleClass = PORTAL_GAME_TIME_CHAR_SCALE_CLASSES[index] || 'portal-game-time-char--wing-inner';
            return `<span class="portal-game-time-char ${scaleClass}" data-slot="${index}">${ch}</span>`;
        }).join('');
    } else {
        slots.forEach((slot, index) => {
            slot.textContent = chars[index];
        });
    }

    display.setAttribute('aria-label', `Game time ${chars}`);
}

function initializeUniversalGameTimeClock() {
    const display = document.getElementById('portal-universal-game-time-display');
    if (!display) return;

    const tick = () => {
        renderUniversalGameTimeDisplay(display, formatUniversalGameTimeClock(new Date()));
    };

    tick();
    window.setInterval(tick, 1000);
}

function applyPausedPortalCountdownReadouts() {
    const readout = PORTAL_COUNTDOWN_PAUSED_READOUT;
    const transitionCountdown = document.getElementById('metrics-transition-countdown-display');
    const subTimerDisplay = document.getElementById('dynamic-age-sub-timer-display');
    const metricsCountdown = document.getElementById('metrics-countdown-clock-val');

    if (transitionCountdown) transitionCountdown.innerText = readout;
    if (metricsCountdown) metricsCountdown.innerText = readout;

    if (subTimerDisplay) {
        subTimerDisplay.textContent = readout;
        subTimerDisplay.classList.remove('timer-readout-active', 'timer-readout-alert');
        subTimerDisplay.style.removeProperty('color');
    }
}

function initializeServerAgeClockTickerCountdown() {
    if (arePortalCountdownTimersPaused()) {
        applyPausedPortalCountdownReadouts();
        return;
    }

    let daysRemaining = 46;
    let hoursRemaining = 13;
    let minutesRemaining = 5;
    
    setInterval(() => {
        minutesRemaining--;
        if (minutesRemaining < 0) {
            minutesRemaining = 59;
            hoursRemaining--;
            if (hoursRemaining < 0) {
                hoursRemaining = 23;
                daysRemaining--;
                if (daysRemaining < 0) daysRemaining = 0;
            }
        }
        
        const countdownElement = document.getElementById("metrics-countdown-clock-val");
        // THE CRITICAL FIX: Explicit null checking prevents background thread crashes
        if (countdownElement !== null) {
            countdownElement.innerText = `${daysRemaining}d : ${hoursRemaining}h : ${minutesRemaining.toString().padStart(2, '0')}m`;
        } else {
            console.log("Chronometer tracking loop active | Viewport offset held safely.");
        }
    }, 60000); 
}


/* ==========================================================================
   SECTION 2: WORKSPACE VIEW CONTROLLERS & INTERFACE REDIRECTS
   ========================================================================== */

let activeMainPortalView = 'portal';

const PORTAL_PREVIEW_ONLY_VIEWS = ['royalty', 'chronicles'];
const PORTAL_GUEST_LOCKED_VIEWS = ['chat', 'lore', 'royalty', 'chronicles', 'commander'];

function isPortalDevFullAccessBypassActive() {
    return typeof isPortalDevFullAccessBypass === 'function' && isPortalDevFullAccessBypass();
}

function isPortalNavViewAccessible(viewName) {
    if (!viewName) return true;

    if (isPortalDevFullAccessBypassActive()) {
        return true;
    }

    const authed = typeof isPortalUserAuthenticated === 'function' && isPortalUserAuthenticated();
    if (!authed && PORTAL_GUEST_LOCKED_VIEWS.includes(viewName)) {
        return false;
    }

    if (PORTAL_PREVIEW_ONLY_VIEWS.includes(viewName)) {
        const previewEnabled = typeof isPortalPreviewNavEnabled === 'function'
            ? isPortalPreviewNavEnabled()
            : false;
        if (!previewEnabled) return false;
    }

    return true;
}

function getPortalNavLockTitle(viewName) {
    const authed = typeof isPortalUserAuthenticated === 'function' && isPortalUserAuthenticated();
    if (!authed && PORTAL_GUEST_LOCKED_VIEWS.includes(viewName)) {
        return 'Create an account and log in to access';
    }
    if (PORTAL_PREVIEW_ONLY_VIEWS.includes(viewName)) {
        return 'Coming soon';
    }
    return '';
}

function setPortalNavControlAccessState(controlEl, viewName) {
    if (!controlEl || !viewName) return;

    if (isPortalDevFullAccessBypassActive()) {
        controlEl.classList.remove('portal-nav-guest-hidden', 'nav-tab-preview-locked');
        controlEl.hidden = false;
        controlEl.removeAttribute('aria-disabled');
        controlEl.title = '';
        return;
    }

    const authed = typeof isPortalUserAuthenticated === 'function' && isPortalUserAuthenticated();
    const guestHidden = !authed && PORTAL_GUEST_LOCKED_VIEWS.includes(viewName);

    controlEl.classList.toggle('portal-nav-guest-hidden', guestHidden);
    controlEl.hidden = guestHidden;

    if (guestHidden) {
        controlEl.classList.remove('nav-tab-preview-locked', 'active', 'is-active');
        controlEl.removeAttribute('aria-disabled');
        controlEl.title = '';
        return;
    }

    const accessible = isPortalNavViewAccessible(viewName);
    if (accessible) {
        controlEl.classList.remove('nav-tab-preview-locked');
        controlEl.removeAttribute('aria-disabled');
        controlEl.title = '';
        return;
    }

    controlEl.classList.add('nav-tab-preview-locked');
    controlEl.setAttribute('aria-disabled', 'true');
    controlEl.title = getPortalNavLockTitle(viewName);
    controlEl.classList.remove('active', 'is-active');
}

function applyPortalGuestDeploymentChrome() {
    const authed = typeof isPortalUserAuthenticated === 'function' && isPortalUserAuthenticated();
    document.body.classList.toggle('portal-guest-mode', !authed);

    const memberBlock = document.getElementById('portal-deployment-member-block');
    const guestCta = document.getElementById('portal-deployment-guest-cta');
    const desktopGuestCard = document.getElementById('portal-desktop-guest-auth-card');
    const desktopMemberCluster = document.getElementById('portal-desktop-member-auth-cluster');
    const mobileGuestLoginBlock = document.getElementById('portal-mobile-guest-login-block');
    const mobileCommanderBlock = document.getElementById('portal-mobile-commander-block');

    if (memberBlock) memberBlock.hidden = !authed;
    if (guestCta) guestCta.hidden = authed;
    if (desktopGuestCard) desktopGuestCard.hidden = authed;
    if (desktopMemberCluster) desktopMemberCluster.hidden = !authed;
    if (mobileGuestLoginBlock) mobileGuestLoginBlock.hidden = authed;
    if (mobileCommanderBlock) mobileCommanderBlock.hidden = !authed;

    applyPortalDeploymentDeckPresentation();
}

const PORTAL_ACTIVE_AGE_SERVERS = [
    { id: 'amnek', label: 'Amnek Server (Under Development)' }
];
const PORTAL_DEFAULT_SERVER_ID = 'amnek';
const DEPLOYMENT_PANEL_UNLOCK_SUFFIX = 'ageDeploymentPanelUnlocked';
const DEPLOYMENT_TUTORIAL_SUFFIX = 'ageDeploymentTutorialMode';
const DEPLOYMENT_SERVER_SUFFIX = 'ageDeploymentSelectedServerId';

function resolveDeploymentStorageKey(suffix) {
    const username = String(localStorage.getItem('activeCommanderUser') || '').trim().toLowerCase();
    return username ? `royalArmies_${username}_${suffix}` : `royalArmies_guest_${suffix}`;
}

function isCommanderAgeDeploymentPanelUnlocked() {
    if (localStorage.getItem(resolveDeploymentStorageKey(DEPLOYMENT_PANEL_UNLOCK_SUFFIX)) === 'true') {
        return true;
    }

    // Commanders who joined before unlock persistence shipped still earn the join-age achievement.
    const hasJoinAgeAchievement =
        (window.RoyalArmiesAchievements && typeof window.RoyalArmiesAchievements.hasCommanderAchievement === 'function'
            && window.RoyalArmiesAchievements.hasCommanderAchievement('whoa_slow_down'))
        || (typeof hasCommanderAchievement === 'function' && hasCommanderAchievement('whoa_slow_down'));

    if (hasJoinAgeAchievement) {
        markCommanderAgeDeploymentPanelUnlocked(readCommanderTutorialModePreference());
        return true;
    }

    return false;
}

function markCommanderAgeDeploymentPanelUnlocked(isTutorialModeActive) {
    localStorage.setItem(resolveDeploymentStorageKey(DEPLOYMENT_PANEL_UNLOCK_SUFFIX), 'true');
    localStorage.setItem(resolveDeploymentStorageKey(DEPLOYMENT_TUTORIAL_SUFFIX), isTutorialModeActive ? 'true' : 'false');
    if (!localStorage.getItem(resolveDeploymentStorageKey(DEPLOYMENT_SERVER_SUFFIX))) {
        localStorage.setItem(resolveDeploymentStorageKey(DEPLOYMENT_SERVER_SUFFIX), PORTAL_DEFAULT_SERVER_ID);
    }
}

function readCommanderTutorialModePreference() {
    return localStorage.getItem(resolveDeploymentStorageKey(DEPLOYMENT_TUTORIAL_SUFFIX)) === 'true';
}

function readCommanderSelectedServerId() {
    const saved = localStorage.getItem(resolveDeploymentStorageKey(DEPLOYMENT_SERVER_SUFFIX));
    if (saved && PORTAL_ACTIVE_AGE_SERVERS.some((server) => server.id === saved)) {
        return saved;
    }
    return PORTAL_DEFAULT_SERVER_ID;
}

function hydratePortalActiveServerSelect() {
    const select = document.getElementById('portal-active-server-select');
    if (!select) return;

    const current = readCommanderSelectedServerId();
    select.innerHTML = PORTAL_ACTIVE_AGE_SERVERS.map((server) => (
        `<option value="${server.id}"${server.id === current ? ' selected' : ''}>${server.label}</option>`
    )).join('');
}

function ensurePortalDeploymentServerPanelDelegation() {
    if (document.body?.dataset?.portalServerPanelDelegated === '1') return;
    if (document.body) {
        document.body.dataset.portalServerPanelDelegated = '1';
    }

    document.addEventListener('click', (event) => {
        const joinBtn = event.target.closest('#portal-rejoin-age-btn');
        if (!joinBtn) return;
        event.preventDefault();
        rejoinSelectedAgeServer(event);
    });

    document.addEventListener('change', (event) => {
        const select = event.target.closest('#portal-active-server-select');
        if (!select) return;
        localStorage.setItem(resolveDeploymentStorageKey(DEPLOYMENT_SERVER_SUFFIX), select.value);
    });
}

function bindPortalDeploymentServerPanelControls() {
    ensurePortalDeploymentServerPanelDelegation();
    hydratePortalActiveServerSelect();
}

function canUsePortalJoinAgeButtons() {
    return typeof isPortalUserAuthenticated === 'function' && isPortalUserAuthenticated();
}

function applyPortalDeploymentDeckPresentation() {
    const authed = typeof isPortalUserAuthenticated === 'function' && isPortalUserAuthenticated();
    const showServerPanel = authed && isCommanderAgeDeploymentPanelUnlocked();
    const showJoinButtons = authed && !showServerPanel && canUsePortalJoinAgeButtons();

    const joinActions = document.getElementById('portal-deployment-member-actions');
    const serverPanel = document.getElementById('portal-deployment-server-panel');
    const countdownPanel = document.getElementById('portal-age-countdown-panel');
    const gameTimePanel = document.getElementById('portal-universal-game-time-panel');

    if (joinActions) joinActions.hidden = !showJoinButtons;
    if (gameTimePanel) gameTimePanel.hidden = false;
    if (countdownPanel) {
        countdownPanel.hidden = true;
        countdownPanel.setAttribute('aria-hidden', 'true');
    }
    if (serverPanel) {
        serverPanel.hidden = !showServerPanel;
        if (showServerPanel) {
            joinAgePortalTransitionActive = false;
            bindPortalDeploymentServerPanelControls();
        }
    } else if (authed) {
        ensurePortalDeploymentServerPanelDelegation();
    }

    recacheAgePortalViewportSnapshot();
}

let joinAgePortalTransitionActive = false;
let portalAgeRejoinTransitionActive = false;

function rejoinSelectedAgeServer(clickEvent) {
    if (typeof isPortalUserAuthenticated === 'function' && !isPortalUserAuthenticated()) {
        if (typeof openMainPortalGuestRegister === 'function') {
            openMainPortalGuestRegister(clickEvent);
        }
        return;
    }

    if (portalAgeRejoinTransitionActive) return;

    ensurePortalTermsComplianceBeforeJoinAge().then((termsOk) => {
        if (!termsOk) return;
        rejoinSelectedAgeServerAfterTermsCheck(clickEvent);
    });
}

function rejoinSelectedAgeServerAfterTermsCheck(clickEvent) {
    if (portalAgeRejoinTransitionActive) return;
    portalAgeRejoinTransitionActive = true;

    const select = document.getElementById('portal-active-server-select');
    const serverId = select?.value || readCommanderSelectedServerId();
    localStorage.setItem(resolveDeploymentStorageKey(DEPLOYMENT_SERVER_SUFFIX), serverId);

    const isTutorialModeActive = readCommanderTutorialModePreference();
    haltAllPortalAudioForGameLaunch();

    if (typeof beginCommanderAgeResetSession === 'function') {
        beginCommanderAgeResetSession();
    }

    const destination = typeof resolveActiveAgeHandoffUrl === 'function'
        ? resolveActiveAgeHandoffUrl()
        : (typeof resolveGamePageHandoffUrl === 'function'
            ? resolveGamePageHandoffUrl({ tutorial: isTutorialModeActive, joinAge: false, server: serverId })
            : `/game?tutorial=${isTutorialModeActive}&joinAge=0&server=${encodeURIComponent(serverId)}`);

    verifyPortalAgeJoinAllowed().then((joinAllowed) => {
        if (!joinAllowed) {
            portalAgeRejoinTransitionActive = false;
            return;
        }
        notifyPortalAgeSessionJoin().finally(() => {
            localStorage.setItem('savedCommanderInActiveAge', 'true');
            if (window.RoyalArmiesPageRouteTransition && typeof window.RoyalArmiesPageRouteTransition.navigateTo === 'function') {
                window.RoyalArmiesPageRouteTransition.navigateTo(destination);
            } else {
                window.location.href = destination;
            }
        }).catch(() => {
            portalAgeRejoinTransitionActive = false;
        });
    });
}

function renderPortalUniversalGameTimePanelMarkup() {
    return `
                    <div id="portal-universal-game-time-panel" class="portal-universal-game-time-panel" aria-label="Game time">
                        <div id="portal-universal-game-time-display" class="portal-universal-game-time-display" aria-live="polite">--:--:--</div>
                    </div>`;
}

function renderPortalAgeCountdownPanelMarkup() {
    return `
                    <div id="portal-age-countdown-panel" class="portal-age-countdown-panel" hidden aria-hidden="true">
                        <div id="dynamic-age-sub-timer-display" class="timer-readout-default">-- : -- : -- : --</div>
                    </div>`;
}

function renderPortalDeploymentServerPanelMarkup() {
    return `
                    <div id="portal-deployment-server-panel" class="portal-deployment-server-panel" hidden>
                        <div class="portal-server-panel-header">
                            <h4 class="portal-server-panel-heading">Server Dashboard</h4>
                        </div>
                        <div class="portal-server-panel-controls">
                            <label class="portal-server-panel-label" for="portal-active-server-select">Universal Servers</label>
                            <div class="portal-server-select-shell">
                                <select id="portal-active-server-select" class="portal-active-server-select" aria-label="Active server"></select>
                            </div>
                            <button type="button" id="portal-rejoin-age-btn" class="portal-rejoin-age-btn confirm-btn" onclick="rejoinSelectedAgeServer(event)">Join</button>
                        </div>
                    </div>`;
}

function recacheAgePortalViewportSnapshot() {
    if (activeMainPortalView !== 'portal') return;
    window.cachedAgePortalViewportHTML = snapshotAgePortalViewportForCache();
}

function renderPortalDeploymentDeckMarkup() {
    return `
            <div class="portal-deployment-control-deck custom-centered-row-deck" id="deployment-master-deck-container">
                    ${renderPortalUniversalGameTimePanelMarkup()}
                <div id="portal-deployment-member-block" class="portal-deployment-member-block">
                    ${renderPortalAgeCountdownPanelMarkup()}
                    <div class="deployment-action-button-row portal-deployment-member-actions" id="portal-deployment-member-actions">
                        <div class="action-btn-aura-housing aura-glow-red">
                            <button type="button" class="deployment-image-trigger-btn" onclick="launchGameRoundSector(false, event)" aria-label="Join Age">
                                <img src="images/joinagebtn.png?v=portal-join-age-image-1" alt="Join Age">
                            </button>
                        </div>
                        <div class="action-btn-aura-housing aura-glow-blue">
                            <button type="button" class="deployment-image-trigger-btn" onclick="launchGameRoundSector(true, event)" aria-label="Tutorial Age">
                                <img src="images/joinagetutorialbtn.png?v=portal-join-age-image-1" alt="Tutorial Age">
                            </button>
                        </div>
                    </div>
                    ${renderPortalDeploymentServerPanelMarkup()}
                </div>
                <div id="portal-deployment-guest-cta" class="portal-deployment-guest-cta" hidden>
                    <div class="portal-join-now-aura-housing">
                        <button type="button" class="portal-join-now-trigger-btn" onclick="openMainPortalGuestRegister(event)" aria-label="Join now — create your account">
                            <img src="images/joinnowbtn.png" alt="Join now" class="portal-join-now-artwork">
                        </button>
                    </div>
                </div>
            </div>`;
}

const PORTAL_MOBILE_NAV_VIEW_LABELS = {
    portal: 'Age Portal',
    leaderboards: 'Leaderboards',
    chat: 'Community Chat',
    lore: 'Lore',
    royalty: 'Royalty',
    chronicles: 'The Chronicles',
    roadmap: 'Roadmap',
    settings: 'Settings',
    commander: 'Options'
};

function isPortalMobileNavLayout() {
    return window.matchMedia('(max-width: 1024px)').matches;
}

if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
        if (typeof applyPortalMobileVisualSettingsRestrictions === 'function') {
            applyPortalMobileVisualSettingsRestrictions();
        }
        const drawer = document.getElementById('msg-directory-floating-drawer');
        if (drawer && typeof syncRecipientDirectoryMobilePresentation === 'function') {
            syncRecipientDirectoryMobilePresentation(!drawer.classList.contains('msg-floating-drawer-hidden'));
        }
        if (typeof syncAgePortalPanelHeights === 'function') {
            syncAgePortalPanelHeights();
        }
    });
}

function snapshotAgePortalViewportForCache() {
    const viewport = document.getElementById('main-portal-dynamic-viewport');
    if (!viewport) return '';

    const clone = viewport.cloneNode(true);
    clone.querySelectorAll('#portal-media-player-home, .portal-media-player-home').forEach((el) => el.remove());
    return clone.innerHTML;
}

function mountPortalMediaPlayerForViewport() {
    const home = document.getElementById('portal-media-player-home');
    const mobileMount = document.getElementById('portal-mobile-nav-media-mount');
    const dockInNav = isPortalMobileNavLayout() && mobileMount;

    document.querySelectorAll('#portal-floating-media-player-deck').forEach((node, index) => {
        if (index > 0) node.remove();
    });

    const deck = document.getElementById('portal-floating-media-player-deck');
    if (!deck || !home) return;

    const targetParent = dockInNav ? mobileMount : home;

    if (deck.parentElement !== targetParent) {
        targetParent.appendChild(deck);
    }

    deck.classList.toggle('is-mobile-nav-docked', dockInNav);
    home.hidden = dockInNav;
    home.style.display = dockInNav ? 'none' : '';

    if (typeof syncAchievementToastStackPosition === 'function') {
        requestAnimationFrame(() => syncAchievementToastStackPosition());
    }
}

function isPortalMobileNavMenuOpen() {
    const menu = document.getElementById('portal-mobile-nav-menu');
    return !!menu && menu.classList.contains('is-menu-open');
}

function setPortalMobileNavMenuOpen(isOpen) {
    const shell = document.getElementById('portal-mobile-nav-shell');
    const menu = document.getElementById('portal-mobile-nav-menu');
    const navToggle = document.getElementById('portal-mobile-nav-toggle');
    if (!menu) return;

    if (isOpen) {
        menu.hidden = false;
        menu.classList.add('is-menu-open');
        menu.style.pointerEvents = 'auto';
        menu.removeAttribute('inert');
        if (shell) shell.classList.add('is-nav-open');
        if (navToggle) navToggle.setAttribute('aria-expanded', 'true');
    } else {
        menu.hidden = true;
        menu.classList.remove('is-menu-open', 'is-commander-submenu-open');
        menu.style.top = '';
        menu.style.pointerEvents = 'none';
        menu.setAttribute('inert', '');
        if (shell) shell.classList.remove('is-nav-open');
        if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
    }
}

function applyPortalMobileNavLayoutMode() {
    const mobile = isPortalMobileNavLayout();
    const desktopBlocks = document.querySelectorAll(
        '.main-portal-nav-bar .portal-desktop-nav-only, .main-portal-nav-bar .nav-tab'
    );

    desktopBlocks.forEach((el) => {
        if (mobile) {
            el.setAttribute('aria-hidden', 'true');
            el.setAttribute('inert', '');
            if (el.classList.contains('nav-tab')) {
                el.style.pointerEvents = 'none';
            }
        } else {
            el.removeAttribute('aria-hidden');
            el.removeAttribute('inert');
            if (el.classList.contains('nav-tab')) {
                el.style.pointerEvents = '';
            }
        }
    });

    if (mobile) {
        closePortalMobileNavMenus();
    }
}

function closePortalMobileNavMenus() {
    const commanderSub = document.getElementById('portal-mobile-commander-submenu');
    const commanderToggle = document.getElementById('portal-mobile-commander-toggle');

    setPortalMobileNavMenuOpen(false);

    if (commanderSub) commanderSub.hidden = true;
    if (commanderToggle) commanderToggle.setAttribute('aria-expanded', 'false');

    if (typeof closePortalCommanderIdentityMenu === 'function') {
        closePortalCommanderIdentityMenu();
    }
}

function positionPortalMobileNavMenu() {
    const menu = document.getElementById('portal-mobile-nav-menu');
    const clip = document.querySelector('.portal-mobile-nav-bar-clip');
    if (!menu || !isPortalMobileNavMenuOpen() || !isPortalMobileNavLayout()) return;

    const anchor = clip || document.getElementById('portal-mobile-nav-toggle');
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const topPx = Math.max(0, Math.ceil(rect.bottom));
    menu.style.top = `${topPx}px`;
}

function togglePortalMobileNavMenu(event) {
    if (event) {
        if (event.cancelable) event.preventDefault();
        event.stopPropagation();
    }

    const menu = document.getElementById('portal-mobile-nav-menu');
    const navToggle = document.getElementById('portal-mobile-nav-toggle');
    if (!menu || !navToggle) return;

    const willOpen = !isPortalMobileNavMenuOpen();
    if (willOpen) {
        portalMobileNavDismissLockUntil = Date.now() + 400;
        syncPortalMobileNavIdentity();
        setPortalMobileNavMenuOpen(true);
        requestAnimationFrame(() => {
            positionPortalMobileNavMenu();
            requestAnimationFrame(positionPortalMobileNavMenu);
        });
    } else {
        closePortalMobileNavMenus();
    }
}

function togglePortalMobileCommanderSubmenu(event) {
    if (event) event.stopPropagation();
    const submenu = document.getElementById('portal-mobile-commander-submenu');
    const toggle = document.getElementById('portal-mobile-commander-toggle');
    if (!submenu || !toggle) return;

    const menu = document.getElementById('portal-mobile-nav-menu');
    const willOpen = submenu.hidden;
    submenu.hidden = !willOpen;
    toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    if (menu) {
        menu.classList.toggle('is-commander-submenu-open', willOpen);
    }
}

function portalMobileNavSelectView(viewName, event) {
    if (event) event.stopPropagation();
    if (!isPortalMobileNavMenuOpen()) return;

    const pageBtn = event?.target?.closest?.('.portal-mobile-nav-page-item');
    if (pageBtn?.hidden || pageBtn?.classList.contains('portal-nav-guest-hidden') || pageBtn?.classList.contains('nav-tab-preview-locked')) return;

    closePortalMobileNavMenus();
    switchMainPortalView(viewName, event);
    syncPortalMobileNavChrome(viewName);
}

function portalMobileNavCommanderAction(action, event) {
    if (event) event.stopPropagation();
    closePortalMobileNavMenus();

    switch (action) {
        case 'view-profile':
            if (typeof isPortalMobileNavLayout === 'function' && isPortalMobileNavLayout()) {
                if (typeof openCommanderHubPortalPage === 'function') {
                    openCommanderHubPortalPage('view-profile', event);
                }
            } else if (typeof openPublicCommanderProfileCard === 'function') {
                openPublicCommanderProfileCard(event);
            }
            break;
        case 'edit-profile':
            if (typeof isPortalMobileNavLayout === 'function' && isPortalMobileNavLayout()) {
                if (typeof openCommanderHubPortalPage === 'function') {
                    openCommanderHubPortalPage('profile', event);
                }
            } else if (typeof openCommanderHubModal === 'function') {
                openCommanderHubModal('profile', event);
            }
            break;
        case 'messages':
            if (typeof isPortalMobileNavLayout === 'function' && isPortalMobileNavLayout()) {
                window.pendingMessagesHubChannel = 'messages';
                window.pendingMessagesFolder = 'inbox';
                if (typeof openCommanderHubPortalPage === 'function') {
                    openCommanderHubPortalPage('messages', event);
                }
            } else if (typeof openCommanderHubMessagesInbox === 'function') {
                openCommanderHubMessagesInbox(event);
            }
            break;
        case 'settings':
            if (typeof isPortalMobileNavLayout === 'function' && isPortalMobileNavLayout()) {
                if (typeof openCommanderHubPortalPage === 'function') {
                    openCommanderHubPortalPage('settings', event);
                }
            } else if (typeof openCommanderHubModal === 'function') {
                openCommanderHubModal('settings', event);
            }
            break;
        case 'logout':
            if (typeof handleHeaderAuthAction === 'function') {
                handleHeaderAuthAction();
            } else if (typeof triggerMainDashboardLogout === 'function') {
                triggerMainDashboardLogout();
            }
            break;
        default:
            break;
    }
}

function portalMobileNavAuthAction(event) {
    if (event) event.stopPropagation();
    closePortalMobileNavMenus();
    if (typeof handleHeaderAuthAction === 'function') {
        handleHeaderAuthAction();
    }
}

function syncPortalMobileNavChrome(viewName) {
    const resolved = viewName || activeMainPortalView || 'portal';
    const label = PORTAL_MOBILE_NAV_VIEW_LABELS[resolved] || PORTAL_MOBILE_NAV_VIEW_LABELS.portal;
    const labelEl = document.getElementById('portal-mobile-nav-current-label');
    if (labelEl) labelEl.textContent = label;

    document.querySelectorAll('.portal-mobile-nav-page-item').forEach((btn) => {
        const view = btn.getAttribute('data-portal-view');
        btn.classList.toggle('is-active', view === resolved);
    });
}

function syncPortalMobileNavIdentity() {
    const avatarDesktop = document.getElementById('nav-embedded-avatar-crest');
    const avatarMobile = document.getElementById('portal-mobile-nav-avatar');
    const nameDesktop = document.getElementById('logged-user-tag');
    const nameMobile = document.getElementById('portal-mobile-nav-username');
    const authLabelMobile = document.getElementById('portal-mobile-nav-auth-label');
    const authIconMobile = document.getElementById('portal-mobile-nav-auth-icon');
    const authed = typeof isPortalUserAuthenticated === 'function' && isPortalUserAuthenticated();
    const authLabelText = authed ? 'LOG OUT' : 'LOG IN';
    const authIconSrc = authed ? 'images/logouticon.png' : 'images/profileicon.png';

    const fallbackAvatar = 'images/avatars/commanderprofile01.png';
    const avatarSrc = (avatarDesktop && avatarDesktop.src) ? avatarDesktop.src : fallbackAvatar;

    if (avatarMobile) avatarMobile.src = avatarSrc;
    if (nameMobile && nameDesktop) {
        nameMobile.textContent = nameDesktop.textContent || '';
    }
    if (authLabelMobile) authLabelMobile.textContent = authLabelText;
    if (authIconMobile) authIconMobile.src = authIconSrc;

    const membershipDesktop = document.getElementById('nav-commander-membership-badge-row');
    const membershipMobile = document.getElementById('portal-mobile-nav-membership-slot');
    if (membershipDesktop && membershipMobile) {
        const hasContent = membershipDesktop.innerHTML.trim().length > 0 && !membershipDesktop.hidden;
        membershipMobile.innerHTML = hasContent ? membershipDesktop.innerHTML : '';
        membershipMobile.hidden = !hasContent;
    }
}

function syncPortalMobileNavMailboxIndicators(unreadCount) {
    const count = Number.isFinite(unreadCount) ? unreadCount : 0;
    const mobileCount = document.getElementById('portal-mobile-messages-unread');
    const mobileBtn = document.getElementById('portal-mobile-messages-btn');

    if (mobileCount) {
        if (count > 0) {
            mobileCount.textContent = String(count);
            mobileCount.hidden = false;
        } else {
            mobileCount.textContent = '';
            mobileCount.hidden = true;
        }
    }
    if (mobileBtn) {
        mobileBtn.classList.toggle('has-unread-messages', count > 0);
    }
}

function applyPortalMobileNavPreviewRestrictions() {
    document.querySelectorAll('.portal-mobile-nav-page-item[data-portal-view]').forEach((btn) => {
        setPortalNavControlAccessState(btn, btn.getAttribute('data-portal-view'));
    });
}

let portalMobileNavDismissLockUntil = 0;
let portalMobileNavToggleLockUntil = 0;

function bindPortalMobileNavToggleControls() {
    const navToggle = document.getElementById('portal-mobile-nav-toggle');
    const clip = document.querySelector('.portal-mobile-nav-bar-clip');
    const menu = document.getElementById('portal-mobile-nav-menu');
    if (!navToggle || !clip || clip.dataset.portalNavBarBound === 'true') return;
    clip.dataset.portalNavBarBound = 'true';
    navToggle.removeAttribute('onclick');

    const handleToggleOpen = (event) => {
        if (!isPortalMobileNavLayout()) return;

        const now = Date.now();
        if (now < portalMobileNavToggleLockUntil) return;
        portalMobileNavToggleLockUntil = now + 400;

        event.stopPropagation();
        togglePortalMobileNavMenu(event);
    };

    navToggle.addEventListener('click', handleToggleOpen);

    if (menu && menu.dataset.stopBubbleBound !== 'true') {
        menu.dataset.stopBubbleBound = 'true';
        menu.addEventListener('click', (event) => event.stopPropagation());
        menu.addEventListener('touchend', (event) => event.stopPropagation(), { passive: true });
    }

    clip.addEventListener('click', (event) => {
        if (!isPortalMobileNavLayout()) return;
        if (!event.target.closest('.nav-tab')) return;
        event.preventDefault();
        event.stopPropagation();
    }, true);
}

function bindPortalMobileNavDismissHandlers() {
    if (document.documentElement.dataset.portalMobileNavBound === 'true') return;
    document.documentElement.dataset.portalMobileNavBound = 'true';

    applyPortalMobileNavLayoutMode();
    bindPortalMobileNavToggleControls();

    document.addEventListener('click', (event) => {
        if (Date.now() < portalMobileNavDismissLockUntil) return;

        const menu = document.getElementById('portal-mobile-nav-menu');
        const navToggle = document.getElementById('portal-mobile-nav-toggle');
        if (!menu || !isPortalMobileNavMenuOpen()) return;

        if (menu.contains(event.target)) return;
        if (navToggle?.contains(event.target)) return;

        closePortalMobileNavMenus();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closePortalMobileNavMenus();
    });
}

function applyPortalNavPreviewRestrictions() {
    applyPortalNavAccessRestrictions();
}

function applyPortalNavAccessRestrictions() {
    document.querySelectorAll('.nav-tab[data-portal-view]').forEach((tab) => {
        setPortalNavControlAccessState(tab, tab.getAttribute('data-portal-view'));
    });

    if (!isPortalNavViewAccessible(activeMainPortalView)) {
        switchMainPortalView('portal', null);
        document.querySelectorAll('.nav-tab').forEach((tab) => tab.classList.remove('active'));
        const agePortalTab = document.querySelector('.nav-tab[data-portal-view="portal"]');
        if (agePortalTab) agePortalTab.classList.add('active');
        syncPortalMobileNavChrome('portal');
    }

    applyPortalGuestDeploymentChrome();
    applyPortalMobileNavPreviewRestrictions();
    document.body.classList.toggle('portal-dev-player-bypass', isPortalDevFullAccessBypassActive());
}

/* Block 3: EXTENSIBLE SYSTEM PANEL VIEW CONVERTER SWITCH (ROUTING RECONCILED) */
function switchMainPortalView(viewName, clickEvent, chatChannelKey) {
    if (isPortalMobileNavLayout() && clickEvent?.target?.closest?.('.nav-tab')) {
        return;
    }

    if (!isPortalNavViewAccessible(viewName)) {
        return;
    }

    if (activeMainPortalView === 'commander' && viewName !== 'commander') {
        if (typeof teardownCommanderHubPortalView === 'function') {
            teardownCommanderHubPortalView();
        }
    }

    if (activeMainPortalView === 'lore' && viewName !== 'lore') {
        stopPortalLoreNarration();
    }

    const viewport = document.getElementById('main-portal-dynamic-viewport');
    if (!viewport) {
        console.warn('Portal viewport missing — add #main-portal-dynamic-viewport to main.html');
        return;
    }

    if (viewName === 'chat' && chatChannelKey) {
        activeChatChannelTrack = chatChannelKey;
    }

    if (viewName !== 'chat') {
        if (activeMainPortalView === 'chat') {
            sendPortalPresenceHeartbeat({ onCommunityChat: false });
        }
        stopCommunityChatPresenceLoop();
        stopCommunityChatSyncLoop();
    }

    activeMainPortalView = viewName;

    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));

    const activeTab = clickEvent?.target?.closest?.('.nav-tab');
    if (activeTab) {
        activeTab.classList.add('active');
    } else if (viewName === 'chat') {
        activateCommunityChatNavTab();
    }

    switch(viewName) {
        case 'portal':
            if (window.cachedAgePortalViewportHTML) {
                viewport.innerHTML = window.cachedAgePortalViewportHTML;
                hydrateDevelopersLogDock();
                mountAgePortalHomeLayout();
                initializeTacticalButtonEarthquakeEngine();
                if (arePortalCountdownTimersPaused()) applyPausedPortalCountdownReadouts();
            } else {
                restoreAgePortalHomeViewLayout(viewport);
            }
            applyPortalGuestDeploymentChrome();
            mountPortalMediaPlayerForViewport();
            break;

        case 'chat':
            renderCommunityChatPortalCanvas(viewport);
            startCommunityChatPresenceLoop();
            startCommunityChatSyncLoop();
            break;

        case 'leaderboards':
            renderMasterLeaderboardPortalCanvas(viewport);
            break;

        case 'lore':
            renderMasterLorePortalCanvas(viewport);
            break;

        case 'royalty':
            renderRoyaltyTierPortalCanvas(viewport);
            break;

        case 'chronicles':
            renderChroniclesProgressMatrixCanvas(viewport);
            break;

        case 'roadmap':
            renderEvolutionRoadmapPortalCanvas(viewport);
            break;

        case 'commander':
            if (typeof renderCommanderHubPortalCanvas === 'function') {
                renderCommanderHubPortalCanvas(viewport, window.activeCommanderHubPortalTab);
            }
            break;

        case 'settings':
            renderStagingAudioMixerConsoleCanvas(viewport);
            break;
            
        default:
            // Safe placeholder deck layout blocking empty structural holes on click
            viewport.innerHTML = `
                <div class="dashboard-news-card-box" style="text-align: center !important; align-items: center !important; justify-content: center !important; min-height: 380px !important;">
                    <h3 style="font-family: 'Cinzel', serif; color: #ffd700; margin-bottom: 8px;">${viewName.charAt(0).toUpperCase() + viewName.slice(1)}</h3>
                    <p style="font-family: 'Segoe UI', sans-serif; font-size: 0.8rem; color: rgba(241,224,172,0.5); max-width: 440px; line-height: 1.4; margin: 0;">
                        This section is not ready yet. Content will appear in a future update.
                    </p>
                </div>
            `;
    }

    syncPortalMobileNavChrome(viewName);
}

/** Release IDs from CHRONICLE_DATA (script.js), newest first — shown in Developer's Log sidebar. */
const DEVELOPER_LOG_RELEASE_IDS = ['alpha_0114', 'alpha_0113', 'alpha_0112', 'alpha_0111'];

function applyPortalAlphaVersionLabels() {
    const label = typeof PORTAL_ALPHA_VERSION !== 'undefined'
        ? PORTAL_ALPHA_VERSION
        : 'Alpha 0.1.13';
    document.querySelectorAll('[data-portal-alpha-version]').forEach((el) => {
        el.textContent = label;
    });
    document.title = `Royal Armies - An MMOHFT Medieval-Fantasy Strategy Game (${label})`;
}

let developersLogScheduleTimer = null;

function isDeveloperLogReleasePublished(entryId) {
    if (typeof CHRONICLE_DATA === 'undefined') return false;
    const entry = CHRONICLE_DATA[entryId];
    if (!entry) return false;
    const publishAt = entry.publishAt;
    if (!publishAt) return true;
    const publishMs = new Date(publishAt).getTime();
    return Number.isFinite(publishMs) && Date.now() >= publishMs;
}

function getPublishedDeveloperLogReleaseIds() {
    return DEVELOPER_LOG_RELEASE_IDS.filter((id) => isDeveloperLogReleasePublished(id));
}

function scheduleDevelopersLogDockRefresh() {
    if (developersLogScheduleTimer) {
        clearTimeout(developersLogScheduleTimer);
        developersLogScheduleTimer = null;
    }
    if (typeof CHRONICLE_DATA === 'undefined') return;

    let nextPublishMs = null;
    DEVELOPER_LOG_RELEASE_IDS.forEach((id) => {
        const entry = CHRONICLE_DATA[id];
        if (!entry?.publishAt) return;
        const publishMs = new Date(entry.publishAt).getTime();
        if (!Number.isFinite(publishMs) || Date.now() >= publishMs) return;
        if (nextPublishMs === null || publishMs < nextPublishMs) {
            nextPublishMs = publishMs;
        }
    });

    if (nextPublishMs === null) return;

    const delayMs = Math.max(1000, Math.min(nextPublishMs - Date.now() + 250, 2147483647));
    developersLogScheduleTimer = setTimeout(() => {
        hydrateDevelopersLogDock();
        scheduleDevelopersLogDockRefresh();
    }, delayMs);
}

function formatDeveloperLogParagraph(paragraph) {
    const whatsNewMatch = paragraph.match(/^What's new:\s*(.+)$/i);
    if (!whatsNewMatch) return paragraph;

    const bullets = whatsNewMatch[1]
        .split(/;\s*/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => `<span class="news-bulletin-bullet">• ${item}</span>`)
        .join('<br>');

    return `<span class="news-bulletin-section-label">What's new</span><br>${bullets}`;
}

function formatDeveloperLogDetails(details) {
    return details
        .split(/\n\n+/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map(formatDeveloperLogParagraph)
        .join('<br><br>');
}

function renderDevelopersLogMarkup() {
    if (typeof CHRONICLE_DATA === 'undefined') {
        return '<div class="news-bulletin-item">Development updates could not be loaded.</div>';
    }

    const entries = getPublishedDeveloperLogReleaseIds()
        .map((id) => CHRONICLE_DATA[id])
        .filter(Boolean);
    if (!entries.length) {
        return '<div class="news-bulletin-item">No development updates posted yet.</div>';
    }

    return entries
        .map((entry) => `
            <div class="news-bulletin-item">
                <strong>${entry.title}</strong><br>
                ${formatDeveloperLogDetails(entry.details)}
            </div>
        `)
        .join('');
}

function renderDevelopersLogSidebarShell() {
    return `
        <article class="dashboard-news-card-box portal-developers-log-card">
            <h2 class="card-title-header">Developer's Log</h2>
            <div class="card-scrollable-body-text portal-gold-scrollbar portal-developers-log-scroll" id="dashboard-patch-notes-dock">
                ${renderDevelopersLogMarkup()}
            </div>
        </article>
    `;
}

function mountAgePortalHomeLayout() {
    const panel = document.getElementById('panel-age-portal-mode');
    if (!panel) return;

    const intro = panel.querySelector('.portal-age-intro-card');
    const deploy = panel.querySelector('#deployment-master-deck-container')
        || panel.querySelector('.portal-deployment-control-deck');
    const sidebar = panel.querySelector('.portal-sidebar-flex-column');
    if (!intro || !deploy || !sidebar) return;

    let stack = panel.querySelector('.portal-age-portal-right-stack');
    if (!stack) {
        stack = document.createElement('div');
        stack.className = 'portal-age-portal-right-stack';
    }

    const twinRow = panel.querySelector('.portal-twin-split-deck-row');
    if (twinRow) {
        if (intro.parentElement === twinRow) intro.remove();
        if (sidebar.parentElement === twinRow) sidebar.remove();
        if (!twinRow.children.length) twinRow.remove();
    }

    if (deploy.parentElement !== stack) {
        deploy.remove();
        stack.appendChild(deploy);
    }
    if (sidebar.parentElement !== stack) {
        sidebar.remove();
        stack.appendChild(sidebar);
    }
    if (!panel.contains(stack)) panel.appendChild(stack);
    if (!panel.contains(intro)) panel.insertBefore(intro, stack);

    panel.classList.add('portal-age-portal-layout-mounted');
    syncAgePortalPanelHeights();
    bindAgePortalIntroResizeObserver();
}

function syncAgePortalPanelHeights() {
    const panel = document.getElementById('panel-age-portal-mode');
    if (!panel || !panel.classList.contains('portal-age-portal-layout-mounted')) return;
    if (window.matchMedia('(max-width: 1024px)').matches) {
        const stack = panel.querySelector('.portal-age-portal-right-stack');
        if (stack) stack.style.maxHeight = '';
        return;
    }

    const intro = panel.querySelector('.portal-age-intro-card');
    const stack = panel.querySelector('.portal-age-portal-right-stack');
    if (!intro || !stack) return;

    stack.style.maxHeight = `${intro.offsetHeight}px`;
}

let agePortalIntroResizeObserver = null;

function bindAgePortalIntroResizeObserver() {
    const intro = document.querySelector('#panel-age-portal-mode .portal-age-intro-card');
    if (!intro || typeof ResizeObserver === 'undefined') return;

    if (agePortalIntroResizeObserver) {
        agePortalIntroResizeObserver.disconnect();
    }

    agePortalIntroResizeObserver = new ResizeObserver(() => {
        syncAgePortalPanelHeights();
    });
    agePortalIntroResizeObserver.observe(intro);
}

function hydrateDevelopersLogDock() {
    const dock = document.getElementById('dashboard-patch-notes-dock');
    if (dock) dock.innerHTML = renderDevelopersLogMarkup();
    scheduleDevelopersLogDockRefresh();
}

function restoreAgePortalHomeViewLayout(viewport) {
    viewport.innerHTML = `
        <div class="age-portal-view-canvas" id="panel-age-portal-mode">
            ${renderPortalDeploymentDeckMarkup()}
            <div class="portal-twin-split-deck-row">
                <article class="dashboard-news-card-box portal-age-intro-card">
                    <h2 class="card-title-header">👑 Introduction Into Royal Armies</h2>
                    <div class="card-scrollable-body-text portal-age-intro-body-wrap">
                        <figure class="portal-age-intro-art">
                            <img src="images/amnekart4.png" alt="Illustrated map of the continent of Amnek" class="portal-age-intro-art-image" width="920" height="920">
                        </figure>
                        <p style="margin-bottom: 16px; color: #ffffff; font-size: 1.05rem;">
                            Welcome to <strong>Royal Armies</strong>, a Massively Multiplayer High-Fidelity Tactical (MMOHFT) strategy ecosystem and the first browser game of its kind. Inspired by both the depth of modern MMO titles and the fast, competitive nature of classic persistent browser-based games, Royal Armies is engineered to give old-school veterans a familiar home while providing a highly responsive, visually stimulating world that captures the new generation of strategy gamers.
                        </p>
                        <p style="margin-bottom: 20px;">
                            This is not just an exercise in character exploration or simple text entry. Royal Armies merges tactical agency with fluid menus and graphical matrices. Without the performance lag of a heavy standalone download, you will actively navigate, explore, and uncover ancient historical secrets right through your persistent web browser.
                        </p>
                        
                        <h3 style="color: #c5a059; font-size: 1.1rem; margin-bottom: 10px;">🛡️ Choose Your Playstyle. Defend Your Nation.</h3>
                        <p style="margin-bottom: 12px;">
                            When you enlist for a standard campaign round—known across the community as an <strong>Age</strong>—your first critical directive is choosing your operational path by selecting one of two primary factions:
                        </p>
                        <ul style="list-style: none; padding-left: 0; margin-bottom: 16px;">
                            <li style="margin-bottom: 8px; border-left: 2px solid #c5a059; padding-left: 10px;">
                                <strong>The Physical Path:</strong> A faction forged in raw force and military might, crushing fortifications with heavy artillery, physical superiority, and unbreakable steel lines.
                            </li>
                            <li style="margin-bottom: 8px; border-left: 2px solid #c5a059; padding-left: 10px;">
                                <strong>The Arcane Path:</strong> A faction that channels world-shattering magic to bend reality, summon powerful elements, and alter battlefield mathematics.
                            </li>
                        </ul>
                        <p style="margin-bottom: 20px;">
                            Once your faction is locked, you are randomly assigned to one of fifteen unique nations, housing a synchronized blend of both paths. You will immediately deploy into your regional Capital. From there, you will recruit standard tactical units alongside a legendary specialized battalion 100% unique to your country's individual lore. Your objective is absolute coordination. To survive, you must join fellow commanders, march in real-time grid matrices, rise through the ranks, and capture key defensive strongholds. Your ultimate target? Wipe rival nations completely off the dynamic world map.
                        </p>
                        <div class="portal-intro-wrap-clear" aria-hidden="true"></div>

                        <h3 style="color: #c5a059; font-size: 1.1rem; margin-bottom: 10px;">🏆 Choose Your Path to Victory</h3>
                        <p style="margin-bottom: 16px;">
                            Total world domination is not your only path to absolute renown. Royal Armies features three distinct, highly competitive game modes:
                        </p>
                        
                        <div style="margin-bottom: 14px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px;">
                            <strong>👑 World Domination:</strong> This is a brutal test of speed and attrition. Every Age lasts up to 15 days maximum, and your goal is to capture and hold the highest city count across the continent to claim ultimate supremacy. Form alliances, execute Non-Aggression Pacts, and strike quickly to build an insurmountable lead. As the fields narrow to 6 surviving nations, a 5-day collapse countdown activates. If the numbers drop to 3 surviving nations before the countdown can reach 2 days, it will be updated to a final 48-hour deadline. Even if you do not conquer the map, surviving nations walk away with historical achievements for wealth, aggression, or resilience.
                        </div>
                        
                        <div style="margin-bottom: 14px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px;">
                            <strong>⚔️ Zone Wars:</strong> Territorial dominance is everything. This mode is all about rushing to specific areas of the map, capturing the cities, and claiming them for as long as possible. On Day 1, you will find 5 active conflict zones scattered across Amnek. As time ticks away, the number of active zones systematically collapses—dropping to 4 zones on Day 4, 3 zones on Day 8, and a final bottleneck of 2 zones on Day 12. However, this collapse is dynamically accelerated if countries are eliminated from the map (15 Nations = 5 Zones, 12 Nations = 4 Zones, 9 Nations = 3 Zones, 6 Nations = 2 Zones). The more cities your country owns, the higher your global base statistics rise. Every 30 minutes, an automated point tick processes, awarding victory points. The country with the highest point compilation wins.
                        </div>
                        
                        <div style="margin-bottom: 14px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px;">
                            <strong>🛡️ Crown & Coalition:</strong> A world-wide 24-hour countdown immediately ticks down on bootup. When it strikes zero, a random nation is granted the sovereign crown. Their mission is to survive as the permanent target of the entire map. Your mission is to assemble a tactical coalition to take it from them. You can claim the crown by successfully dropping the specific army that houses the crowned leader. The other path to victory is by engaging and defeating the crowned leader directly in PvP. The crowned nation receives massive defensive stat multipliers. Furthermore, if a leader goes offline, they can be targeted multiple times until a victory is acquired. The longer you hold the crown, the higher your fame rises, and the nation with the highest fame at the end of the Age wins.
                        </div>

                        <h3 style="color: #c5a059; font-size: 1.1rem; margin-bottom: 10px;">📜 A Living, Breathing Chronicle</h3>
                        <p style="margin-bottom: 0;">
                            Royal Armies is structured around an ever-expanding narrative. This is a game with a deep, intentional history that dictates its growth. As time passes, the overarching lore created for this universe will continuously contribute to its structural evolution. This expanding story will natively guide the journey, laying down the foundation to introduce brand-new mechanics, interactive updates, and immersive cinematic lore elements down the road.
                        </p>
                    </div>
                </article>
                <div class="portal-sidebar-flex-column">
                    ${renderDevelopersLogSidebarShell()}
                </div>
            </div>
        </div>
    `;
    hydrateDevelopersLogDock();
    mountAgePortalHomeLayout();
    initializeTacticalButtonEarthquakeEngine();
    applyPortalGuestDeploymentChrome();
}

/* Block 4: MAP INTERFACE DEPLOYMENT SECTOR ROUTER */
const JOIN_AGE_POST_SELECT_DELAY_MS = 400;
const JOIN_AGE_DEPLOY_PULSE_GROW_MS = 420;
const JOIN_AGE_DEPLOY_PULSE_SETTLE_MS = 720;

async function ensurePortalTermsComplianceBeforeJoinAge() {
    if (typeof blockJoinAgeUntilTermsAccepted === 'function') {
        return blockJoinAgeUntilTermsAccepted();
    }
    return true;
}

function launchGameRoundSector(isTutorialModeActive, clickEvent) {
    if (typeof isPortalUserAuthenticated === 'function' && !isPortalUserAuthenticated()) {
        if (typeof openMainPortalGuestRegister === 'function') {
            openMainPortalGuestRegister(clickEvent);
        }
        return;
    }

    if (!canUsePortalJoinAgeButtons()) {
        return;
    }

    if (joinAgePortalTransitionActive) return;

    ensurePortalTermsComplianceBeforeJoinAge().then((termsOk) => {
        if (!termsOk) return;
        launchGameRoundSectorAfterTermsCheck(isTutorialModeActive, clickEvent);
    });
}

function launchGameRoundSectorAfterTermsCheck(isTutorialModeActive, clickEvent) {
    if (joinAgePortalTransitionActive) return;
    joinAgePortalTransitionActive = true;

    markCommanderAgeDeploymentPanelUnlocked(isTutorialModeActive);
    applyPortalDeploymentDeckPresentation();

    if (typeof markJoinAgeAttemptForAchievement === 'function') {
        markJoinAgeAttemptForAchievement();
    } else if (window.RoyalArmiesAchievements && typeof window.RoyalArmiesAchievements.markJoinAgeAttemptForAchievement === 'function') {
        window.RoyalArmiesAchievements.markJoinAgeAttemptForAchievement();
    }

    const clickedHousing = clickEvent?.target?.closest?.('.action-btn-aura-housing')
        ?? clickEvent?.currentTarget?.closest?.('.action-btn-aura-housing');

    haltAllPortalAudioForGameLaunch();
    resetAllJoinAgeDeploymentButtonShakeStates();

    let deployPulseFinished = false;
    let selectAudioFinished = false;

    if (typeof beginCommanderAgeResetSession === 'function') {
        beginCommanderAgeResetSession();
    }

    const attemptGamePageHandoff = () => {
        if (!deployPulseFinished || !selectAudioFinished) return;
        const destination = typeof resolveGamePageHandoffUrl === 'function'
            ? resolveGamePageHandoffUrl({
                tutorial: isTutorialModeActive,
                joinAge: true,
                server: readCommanderSelectedServerId()
            })
            : `/game?tutorial=${isTutorialModeActive}&joinAge=1&server=${encodeURIComponent(readCommanderSelectedServerId())}`;
        verifyPortalAgeJoinAllowed().then((joinAllowed) => {
            if (!joinAllowed) {
                joinAgePortalTransitionActive = false;
                return;
            }
            window.setTimeout(() => {
            localStorage.setItem('savedCommanderInActiveAge', 'true');
            markCommanderAgeDeploymentPanelUnlocked(isTutorialModeActive);
            applyPortalDeploymentDeckPresentation();
            if (typeof markJoinAgeAttemptForAchievement === 'function') {
                markJoinAgeAttemptForAchievement();
            } else if (window.RoyalArmiesAchievements && typeof window.RoyalArmiesAchievements.markJoinAgeAttemptForAchievement === 'function') {
                window.RoyalArmiesAchievements.markJoinAgeAttemptForAchievement();
            }
            notifyPortalAgeSessionJoin().finally(() => {
                if (window.RoyalArmiesPageRouteTransition && typeof window.RoyalArmiesPageRouteTransition.navigateTo === 'function') {
                    window.RoyalArmiesPageRouteTransition.navigateTo(destination);
                } else {
                    window.location.href = destination;
                }
            });
            }, JOIN_AGE_POST_SELECT_DELAY_MS);
        });
    };

    if (clickedHousing && !isPortalMobileNavLayout()) {
        runJoinAgeDeployConfirmPulse(clickedHousing, () => {
            deployPulseFinished = true;
            attemptGamePageHandoff();
        });
    } else {
        deployPulseFinished = true;
    }

    playJoinAgeSelectSfx(() => {
        selectAudioFinished = true;
        attemptGamePageHandoff();
    });
}


/* ==========================================================================
   SECTION 3: ADMINISTRATIVE ENFORCEMENT & OVERLAY FILTERS
   ========================================================================== */

/* Block 5: DISCONNECT WINDOW OVERLAY POPUP TRIGGER MECHANICS */
function triggerMainDashboardLogout() {
    const modal = document.getElementById('main-logout-confirmation-modal');
    if (!modal) {
        executeLogoutRedirect();
        return;
    }
    modal.classList.remove('main-portal-modal-hidden');
    modal.style.setProperty('display', 'flex', 'important');
    modal.setAttribute('aria-hidden', 'false');

    if (!modal.dataset.boundBackdropClose) {
        modal.dataset.boundBackdropClose = 'true';
        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeMainLogoutConfirmationWindow();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modal.style.display !== 'none') {
                closeMainLogoutConfirmationWindow();
            }
        });
    }
}

/* Block 6: DISCONNECT MODAL REVERT LEVER CONTROLLER */
function closeMainLogoutConfirmationWindow() {
    const modal = document.getElementById('main-logout-confirmation-modal');
    if (!modal) return;
    modal.style.setProperty('display', 'none', 'important');
    modal.classList.add('main-portal-modal-hidden');
    modal.setAttribute('aria-hidden', 'true');
}

/* Block 7: CLEAR INTERFACE TRANSACTION SHARDS SYSTEM TERMINATION */
function resolvePortalPresenceUsername() {
    if (typeof getActiveCommanderUsername === 'function') {
        return getActiveCommanderUsername();
    }
    const saved = localStorage.getItem('activeCommanderUser');
    return saved && saved.trim() !== '' ? saved.trim() : '';
}

function clearPortalPresenceSession() {
    const username = resolvePortalPresenceUsername();
    if (!username) return Promise.resolve();

    stopCommunityChatPresenceLoop();
    stopCommunityChatSyncLoop();

    return fetch('/api/portal/presence/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
        keepalive: true
    }).catch(() => notifyPortalAgeSessionLeave().catch(() => {}));
}

function executeLogoutRedirect() {
    closeMainLogoutConfirmationWindow();
    console.log('Purging portal session and returning to landing page...');

    const redirectHome = () => {
        if (typeof markLocalDevLogoutForGuestPreview === 'function') {
            markLocalDevLogoutForGuestPreview();
        }
        if (typeof clearPortalAuthStorage === 'function') {
            clearPortalAuthStorage();
        } else {
            localStorage.removeItem('activeCommanderUser');
        }
        sessionStorage.removeItem('royalArmiesAuthAudioPlay');
        if (typeof refreshMainPortalAuthChrome === 'function') {
            refreshMainPortalAuthChrome();
        }
        window.location.replace('/main');
    };

    const logoutApi = (typeof resolveRoyalArmiesApiUrl === 'function')
        ? resolveRoyalArmiesApiUrl('/api/auth/logout')
        : '/api/auth/logout';
    const serverLogout = (typeof canUsePortalAuthSessionApi === 'function' && canUsePortalAuthSessionApi())
        ? fetch(logoutApi, { method: 'POST', credentials: 'include', keepalive: true }).catch(() => {})
        : Promise.resolve();

    serverLogout.finally(() => {
        clearPortalPresenceSession().finally(redirectHome);
    });
}

/* ==========================================================================
   LIVE PORTAL PLAYER METRICS (registered + online rosters)
   ========================================================================== */

let portalMetricsPollTimer = null;
let portalPresenceHeartbeatTimer = null;
let communityChatPresencePollTimer = null;
const PORTAL_PRESENCE_HEARTBEAT_MS = 20000;
const CHAT_PRESENCE_HEARTBEAT_MS = 8000;
const PORTAL_PRESENCE_IDLE_MS = 10 * 60 * 1000;
let portalUserLastActivityAt = Date.now();
let portalLiveMetricsCache = {
    registeredCount: 0,
    recentRegistrations: [],
    ageOnlineCount: 0,
    agePlayingCount: 0,
    ageOnlinePlayers: [],
    agePlayingPlayers: [],
    portalBrowsingCount: 0,
    portalBrowsingPlayers: []
};

function bumpPortalUserActivityTimestamp() {
    portalUserLastActivityAt = Date.now();
    if (typeof touchPortalLastActivityAt === 'function') {
        touchPortalLastActivityAt(portalUserLastActivityAt);
    }
}

function initializePortalUserActivityTracking() {
    if (window.portalUserActivityTrackingWired) return;
    window.portalUserActivityTrackingWired = true;

    const bump = () => bumpPortalUserActivityTimestamp();
    ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((eventName) => {
        document.addEventListener(eventName, bump, { passive: true });
    });
}

function normalizePortalBrowsingPlayerEntry(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') {
        const username = entry.trim();
        return username ? { username, presence: 'portal' } : null;
    }
    const username = String(entry.username || '').trim();
    if (!username) return null;
    const presence = ['chat', 'portal', 'idle'].includes(entry.presence) ? entry.presence : 'portal';
    return { username, presence };
}

function getPortalBrowsingPresenceMap() {
    const map = new Map();
    (portalLiveMetricsCache.portalBrowsingPlayers || []).forEach((entry) => {
        const normalized = normalizePortalBrowsingPlayerEntry(entry);
        if (!normalized) return;
        const key = normalizeCommunityChatUsername(normalized.username);
        if (!key) return;
        map.set(key, normalized.presence);
    });
    return map;
}

function resolveLocalCommunityChatPresenceState() {
    const idleFor = Date.now() - portalUserLastActivityAt;
    if (idleFor >= PORTAL_PRESENCE_IDLE_MS) return 'idle';
    if (activeMainPortalView === 'chat') return 'chat';
    return 'portal';
}

function isCommanderPlayingActiveAgeLocally() {
    return localStorage.getItem('savedCommanderInActiveAge') === 'true';
}

function formatPortalRegistrationTimestamp(isoString) {
    if (!isoString) return '—';
    const parsed = new Date(isoString);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function renderMetricRosterList(listElement, entries, emptyMessage) {
    if (!listElement) return;
    if (!entries || !entries.length) {
        listElement.innerHTML = `<li class="metric-roster-popover-empty">${emptyMessage}</li>`;
        return;
    }

    listElement.innerHTML = entries.map((entry) => {
        if (typeof entry === 'string') {
            return `<li class="metric-roster-popover-item"><span class="metric-roster-name">${escapeMetricRosterHtml(entry)}</span></li>`;
        }
        const username = entry.username || 'Unknown';
        const joinedLabel = formatPortalRegistrationTimestamp(entry.joinedAt);
        return `<li class="metric-roster-popover-item"><span class="metric-roster-name">${escapeMetricRosterHtml(username)}</span><span class="metric-roster-meta">${escapeMetricRosterHtml(joinedLabel)}</span></li>`;
    }).join('');
}

function escapeMetricRosterHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function applyPortalLiveMetricsToBanner(metrics) {
    const registeredPlayersDisplay = document.getElementById('metrics-registered-players-display');
    const activePlayersDisplay = document.getElementById('metrics-active-players-display');
    const registeredList = document.getElementById('metrics-registered-roster-list');
    const activeList = document.getElementById('metrics-active-roster-list');

    const registeredCount = Number(metrics?.registeredCount) || 0;
    const ageOnlineCount = Number(metrics?.ageOnlineCount) || 0;
    const agePlayingCount = Number(metrics?.agePlayingCount) || 0;
    const recentRegistrations = Array.isArray(metrics?.recentRegistrations) ? metrics.recentRegistrations : [];
    const ageOnlinePlayers = Array.isArray(metrics?.ageOnlinePlayers) ? metrics.ageOnlinePlayers : [];

    const portalBrowsingPlayers = Array.isArray(metrics?.portalBrowsingPlayers) ? metrics.portalBrowsingPlayers : [];

    portalLiveMetricsCache = {
        registeredCount,
        recentRegistrations,
        ageOnlineCount,
        agePlayingCount,
        ageOnlinePlayers,
        agePlayingPlayers: Array.isArray(metrics?.agePlayingPlayers) ? metrics.agePlayingPlayers : [],
        portalBrowsingCount: Number(metrics?.portalBrowsingCount) || portalBrowsingPlayers.length,
        portalBrowsingPlayers
    };

    refreshCommunityChatOnlineRosterIfVisible();

    if (registeredPlayersDisplay) {
        registeredPlayersDisplay.innerText = registeredCount.toLocaleString();
    }
    if (activePlayersDisplay) {
        /* Playing in the Age (online) / total commanders currently in the Age session */
        activePlayersDisplay.innerText = `${ageOnlineCount.toLocaleString()} / ${agePlayingCount.toLocaleString()}`;
    }

    renderMetricRosterList(
        registeredList,
        recentRegistrations,
        'No registered players yet. Accounts appear here after Create Account saves on this server.'
    );
    renderMetricRosterList(
        activeList,
        ageOnlinePlayers,
        'No players are online in the active Age right now.'
    );
}

async function fetchPortalLiveMetrics() {
    try {
        const response = await fetch('/api/portal/metrics', { cache: 'no-store' });
        if (!response.ok) throw new Error(`metrics ${response.status}`);
        const metrics = await response.json();
        applyPortalLiveMetricsToBanner(metrics);
    } catch (err) {
        console.warn('Portal live metrics unavailable:', err);
        applyPortalLiveMetricsToBanner({
            registeredCount: 0,
            recentRegistrations: [],
            ageOnlineCount: 0,
            agePlayingCount: 0,
            ageOnlinePlayers: [],
            agePlayingPlayers: [],
            portalBrowsingCount: 0,
            portalBrowsingPlayers: []
        });
    }
}

function applyPortalMetricsPayload(metrics) {
    if (!metrics || typeof metrics !== 'object') return;
    applyPortalLiveMetricsToBanner(metrics);
}

async function sendPortalPresenceHeartbeat(options = {}) {
    const username = resolvePortalPresenceUsername();
    if (!username || username.toLowerCase() === 'testaccount') return null;

    const onCommunityChat = options.onCommunityChat === true
        || (options.onCommunityChat !== false && activeMainPortalView === 'chat');

    try {
        const presenceUrl = typeof resolveRoyalArmiesApiUrl === 'function'
            ? resolveRoyalArmiesApiUrl('/api/portal/presence')
            : '/api/portal/presence';
        const credentials = typeof canUsePortalAuthSessionApi === 'function' && canUsePortalAuthSessionApi()
            ? 'include'
            : 'same-origin';
        const response = await fetch(presenceUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials,
            body: JSON.stringify({
                username,
                inAge: isCommanderPlayingActiveAgeLocally(),
                onCommunityChat,
                lastActivityAt: portalUserLastActivityAt
            }),
            cache: 'no-store'
        });
        const payload = await response.json().catch(() => ({}));
        if (payload?.inactivityLogout || payload?.code === 'NEXUS-AUTH-017') {
            if (typeof executeInactivityLogout === 'function') {
                executeInactivityLogout({ silent: false });
            }
            return null;
        }
        if (!response.ok) throw new Error(`presence ${response.status}`);
        applyPortalMetricsPayload(payload);
        return payload;
    } catch (err) {
        console.warn('Portal presence heartbeat failed:', err);
        return null;
    }
}

function startCommunityChatPresenceLoop() {
    if (communityChatPresencePollTimer) clearInterval(communityChatPresencePollTimer);

    const pulse = () => {
        sendPortalPresenceHeartbeat({ onCommunityChat: true });
    };

    pulse();
    communityChatPresencePollTimer = setInterval(pulse, CHAT_PRESENCE_HEARTBEAT_MS);
}

function stopCommunityChatPresenceLoop() {
    if (communityChatPresencePollTimer) {
        clearInterval(communityChatPresencePollTimer);
        communityChatPresencePollTimer = null;
    }
}

function refreshCommunityChatOnlineRosterIfVisible() {
    if (activeMainPortalView !== 'chat') return;
    const bin = document.getElementById('chat-online-roster-dock');
    if (bin) renderCommunityChatOnlineRoster(bin);
}

function isRoyalGuardBotUsername(username) {
    if (typeof isRoyalGuardBotAccount === 'function') {
        return isRoyalGuardBotAccount(username);
    }
    const key = normalizeCommunityChatUsername(username);
    return key === 'royal guard bot' || key === 'moderator' || key === 'royal guard';
}

function getRoyalGuardBotDisplayName() {
    return typeof ROYAL_GUARD_BOT_DISPLAY_NAME !== 'undefined'
        ? ROYAL_GUARD_BOT_DISPLAY_NAME
        : 'Royal Guard Bot';
}

const CHAT_ROSTER_PORTAL_QUIPS = [
    'Browsing the portal',
    'Checking chat',
    'Reviewing the Age map',
    'Waiting in the lobby'
];

const CHAT_ROSTER_AGE_QUIPS = [
    'Playing in the active Age',
    'In a live Age session',
    'Deployed in the Age'
];

function hashCommunityChatRosterSeed(name) {
    const normalized = normalizeCommunityChatUsername(name);
    let hash = 0;
    for (let i = 0; i < normalized.length; i += 1) {
        hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function getChatRosterAvatarUrl(name) {
    const seed = hashCommunityChatRosterSeed(name);
    const avatarIndex = String((seed % 8) + 1).padStart(2, '0');
    const avatarFamily = (seed % 3) === 0 ? 'archmageprofile' : 'commanderprofile';
    return `images/avatars/${avatarFamily}${avatarIndex}.png`;
}

function getChatRosterDisplayRank(name, isSelf) {
    const staffRole = typeof getPortalStaffRole === 'function' ? getPortalStaffRole(name) : null;
    if (staffRole === 'owner') return 'Site Owner';
    if (staffRole === 'moderator') return 'Moderator';
    if (isSelf && typeof player !== 'undefined' && Number.isFinite(player.rank)) {
        const maxRankIndex = (typeof CHRONICLE_MAX_RANK === 'number' ? CHRONICLE_MAX_RANK : 50) - 1;
        const rankIndex = Math.max(0, Math.min(player.rank - 1, maxRankIndex));
        if (typeof groundTitles !== 'undefined' && groundTitles[rankIndex]) {
            return groundTitles[rankIndex];
        }
    }
    if (typeof groundTitles !== 'undefined' && groundTitles.length) {
        return groundTitles[hashCommunityChatRosterSeed(name) % groundTitles.length];
    }
    return 'Vintenary';
}

function getChatRosterPresenceQuip(name, inAge, isSelf) {
    const staffRole = typeof getPortalStaffRole === 'function' ? getPortalStaffRole(name) : null;
    if (staffRole === 'owner') {
        return inAge ? 'Owner — in the Age' : 'Owner — on the portal';
    }
    if (staffRole === 'moderator') {
        return inAge ? 'Moderator — in the Age' : 'Moderator — on the portal';
    }
    if (isSelf) {
        return inAge ? 'You are in the Age' : 'You are on the portal';
    }
    const pool = inAge ? CHAT_ROSTER_AGE_QUIPS : CHAT_ROSTER_PORTAL_QUIPS;
    return pool[hashCommunityChatRosterSeed(name) % pool.length];
}

function getChatRosterStaffBadgeMarkup(name) {
    const staffRole = typeof getPortalStaffRole === 'function' ? getPortalStaffRole(name) : null;
    if (staffRole === 'owner') {
        return '<span class="chat-roster-staff-badge chat-roster-staff-badge--owner" title="Site owner"><span class="chat-roster-staff-badge-icon" aria-hidden="true">👑</span>Owner</span>';
    }
    if (staffRole === 'moderator') {
        return '<span class="chat-roster-staff-badge chat-roster-staff-badge--moderator" title="Moderator"><span class="chat-roster-staff-badge-icon" aria-hidden="true">🛡</span>Moderator</span>';
    }
    return '';
}

function formatCommunityChatSenderMarkup(sender) {
    if (isRoyalGuardBotUsername(sender)) {
        const safeName = escapeMetricRosterHtml(getRoyalGuardBotDisplayName());
        return `<span class="chat-message-sender-name chat-message-sender-name--royal-guard-bot"><span class="chat-sender-staff-badge chat-sender-staff-badge--royal-guard-bot" title="Automated chat monitor" aria-hidden="true">🛡</span><strong>${safeName}:</strong></span>`;
    }
    const safeName = escapeMetricRosterHtml(sender);
    const staffRole = typeof getPortalStaffRole === 'function' ? getPortalStaffRole(sender) : null;
    if (staffRole === 'owner') {
        return `<span class="chat-message-sender-name chat-message-sender-name--owner"><span class="chat-sender-staff-badge chat-sender-staff-badge--owner" title="Site owner" aria-hidden="true">👑</span><strong>${safeName}:</strong></span>`;
    }
    if (staffRole === 'moderator') {
        return `<span class="chat-message-sender-name chat-message-sender-name--moderator"><span class="chat-sender-staff-badge chat-sender-staff-badge--moderator" title="Moderator" aria-hidden="true">🛡</span><strong>${safeName}:</strong></span>`;
    }
    return `<span class="chat-message-sender-name"><strong>${safeName}:</strong></span>`;
}

function getChatRosterPresenceRingClass(presenceState) {
    if (presenceState === 'chat') return 'chat-roster-presence-ring--chat-active';
    if (presenceState === 'idle') return 'chat-roster-presence-ring--idle';
    return 'chat-roster-presence-ring--portal-browsing';
}

function getChatRosterStatusMeta(inAge, isSelf, presenceState) {
    const presence = presenceState || 'portal';

    if (presence === 'idle') {
        const idleMeta = { pillClass: 'chat-roster-status-pill--idle', icon: '●', label: 'Away' };
        if (isSelf) return { ...idleMeta, pillClass: 'chat-roster-status-pill--self-idle', label: 'You · Away' };
        return idleMeta;
    }
    if (presence === 'chat') {
        const chatMeta = { pillClass: 'chat-roster-status-pill--chat-active', icon: '●', label: 'In Chat' };
        if (isSelf) return { ...chatMeta, pillClass: 'chat-roster-status-pill--self-chat', label: 'You · In Chat' };
        return chatMeta;
    }

    const portalMeta = { pillClass: 'chat-roster-status-pill--portal-browsing', icon: '●', label: 'On Site' };
    if (isSelf) return { ...portalMeta, pillClass: 'chat-roster-status-pill--self-portal', label: 'You · On Site' };

    if (inAge) {
        return { pillClass: 'chat-roster-status-pill--in-age', icon: '⚔', label: 'In Age' };
    }
    return portalMeta;
}

const chatRosterExpandedCommanders = new Set();
window.chatRosterExpandedCommanders = chatRosterExpandedCommanders;

function getChatRosterExpandKey(name, staffRole) {
    if (staffRole === 'royal-guard-bot') return 'royal-guard-bot';
    return normalizeCommunityChatUsername(name);
}

function isChatRosterCardExpandable(staffRole) {
    return staffRole === 'owner' || staffRole === 'moderator' || staffRole === 'royal-guard-bot';
}

function buildChatRosterExpandHintMarkup() {
    return '<span class="chat-roster-expand-hint" aria-hidden="true">▸</span>';
}

function buildChatRosterExpandPanelMarkup(name, isSelf, inAge, staffRole) {
    if (staffRole === 'royal-guard-bot') {
        return `
            <div class="chat-roster-staff-badge-row">
                <span class="chat-roster-staff-badge chat-roster-staff-badge--royal-guard-bot" title="Automated chat monitor"><span class="chat-roster-staff-badge-icon" aria-hidden="true">🤖</span>Royal Guard</span>
            </div>
            <span class="chat-roster-rank-title">Chat Monitor</span>
            <p class="chat-roster-quip">Watching channels for policy violations</p>
        `;
    }

    const staffBadge = getChatRosterStaffBadgeMarkup(name);
    return `
        ${staffBadge ? `<div class="chat-roster-staff-badge-row">${staffBadge}</div>` : ''}
        <span class="chat-roster-rank-title">${escapeMetricRosterHtml(getChatRosterDisplayRank(name, isSelf))}</span>
        <p class="chat-roster-quip">${escapeMetricRosterHtml(getChatRosterPresenceQuip(name, inAge, isSelf))}</p>
    `;
}

function toggleChatRosterCardExpand(event) {
    const card = event.currentTarget;
    if (!card || !card.classList.contains('chat-roster-commander-card--expandable')) return;
    event.preventDefault();
    event.stopPropagation();

    const expandKey = card.dataset.rosterExpandKey;
    const isExpanded = card.classList.toggle('is-expanded');
    card.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');

    const panel = card.querySelector('.chat-roster-commander-expand-panel');
    if (panel) panel.hidden = !isExpanded;

    if (expandKey) {
        if (isExpanded) chatRosterExpandedCommanders.add(expandKey);
        else chatRosterExpandedCommanders.delete(expandKey);
    }
}

function handleChatRosterCardExpandKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    toggleChatRosterCardExpand(event);
}

function handleChatRosterExpandButtonClick(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const card = event?.currentTarget?.closest('.chat-roster-commander-card');
    if (!card) return;
    toggleChatRosterCardExpand({ ...event, currentTarget: card });
}

function handleChatRosterExpandButtonKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    handleChatRosterExpandButtonClick(event);
}

async function openCommunityChatRosterCommanderProfile(clickEvent) {
    if (clickEvent) {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
    }

    const trigger = clickEvent?.currentTarget;
    const username = String(
        trigger?.dataset?.rosterProfileCommander
        || trigger?.closest('[data-roster-profile-commander]')?.dataset?.rosterProfileCommander
        || ''
    ).trim();
    if (!username || isRoyalGuardBotUsername(username)) return;

    if (typeof playSelectSFX === 'function') playSelectSFX();

    if (typeof openPublicCommanderProfileCard === 'function') {
        const selfRaw = resolvePortalPresenceUsername() || getLoggedCommunityChatUsername();
        const isSelf = normalizeCommunityChatUsername(username) === normalizeCommunityChatUsername(selfRaw);
        await openPublicCommanderProfileCard(null, isSelf ? undefined : username);
    }
}

function handleCommunityChatRosterProfileKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openCommunityChatRosterCommanderProfile(event);
}

window.toggleChatRosterCardExpand = toggleChatRosterCardExpand;
window.handleChatRosterCardExpandKeydown = handleChatRosterCardExpandKeydown;
window.handleChatRosterExpandButtonClick = handleChatRosterExpandButtonClick;
window.handleChatRosterExpandButtonKeydown = handleChatRosterExpandButtonKeydown;
window.openCommunityChatRosterCommanderProfile = openCommunityChatRosterCommanderProfile;
window.handleCommunityChatRosterProfileKeydown = handleCommunityChatRosterProfileKeydown;

function sortCommunityChatRosterPlayers(players, selfLower, playingSet) {
    const rosterScore = (name) => {
        const key = normalizeCommunityChatUsername(name);
        const staffRole = typeof getPortalStaffRole === 'function' ? getPortalStaffRole(name) : null;
        if (staffRole === 'owner') return 0;
        if (staffRole === 'moderator') return 1;
        if (key === selfLower) return 2;
        if (playingSet.has(key)) return 3;
        return 4;
    };

    return players.slice().sort((a, b) => {
        const scoreDiff = rosterScore(a) - rosterScore(b);
        if (scoreDiff !== 0) return scoreDiff;
        return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
}

function buildRoyalGuardBotRosterCardMarkup() {
    const botName = getRoyalGuardBotDisplayName();
    const staffRole = 'royal-guard-bot';
    const expandKey = getChatRosterExpandKey(botName, staffRole);
    const isExpanded = chatRosterExpandedCommanders.has(expandKey);

    return `
        <article class="chat-roster-commander-card chat-roster-commander-card--royal-guard-bot chat-roster-commander-card--expandable ${isExpanded ? 'is-expanded' : ''}"
            data-staff-role="${staffRole}"
            data-roster-commander="royal-guard-bot"
            data-roster-expand-key="${expandKey}"
            role="button"
            tabindex="0"
            aria-expanded="${isExpanded ? 'true' : 'false'}"
            aria-label="${escapeMetricRosterHtml(botName)} — click for details"
            onclick="toggleChatRosterCardExpand(event)"
            onkeydown="handleChatRosterCardExpandKeydown(event)">
            <div class="chat-roster-commander-body">
                <div class="chat-roster-commander-topline">
                    <span class="chat-roster-name-row">
                        <span class="chat-roster-presence-ring chat-roster-presence-ring--bot" aria-hidden="true"></span>
                        <span class="chat-roster-name">${escapeMetricRosterHtml(botName)}</span>
                    </span>
                    <span class="chat-roster-status-pill chat-roster-status-pill--bot"><span class="chat-roster-status-pill-icon" aria-hidden="true">●</span>Online</span>
                    ${buildChatRosterExpandHintMarkup()}
                </div>
                <div class="chat-roster-commander-expand-panel" ${isExpanded ? '' : 'hidden'}>
                    ${buildChatRosterExpandPanelMarkup(botName, false, false, staffRole)}
                </div>
            </div>
        </article>
    `;
}

function buildCommunityChatRosterCardMarkup(name, selfLower, playingSet, presenceState) {
    if (isRoyalGuardBotUsername(name)) return '';
    const isSelf = normalizeCommunityChatUsername(name) === selfLower;
    const inAge = playingSet.has(normalizeCommunityChatUsername(name));
    const staffRole = typeof getPortalStaffRole === 'function' ? getPortalStaffRole(name) : null;
    const resolvedPresence = presenceState || 'portal';
    const presenceRingClass = getChatRosterPresenceRingClass(resolvedPresence);
    const status = getChatRosterStatusMeta(inAge, isSelf, resolvedPresence);
    const isExpandable = isChatRosterCardExpandable(staffRole);
    const expandKey = isExpandable ? getChatRosterExpandKey(name, staffRole) : '';
    const isExpanded = isExpandable && chatRosterExpandedCommanders.has(expandKey);
    const cardModifiers = [
        staffRole === 'owner' ? 'chat-roster-commander-card--owner' : '',
        staffRole === 'moderator' ? 'chat-roster-commander-card--moderator' : '',
        isSelf ? 'chat-roster-commander-card--self' : '',
        inAge ? 'chat-roster-commander-card--in-age' : '',
        `chat-roster-commander-card--presence-${resolvedPresence}`,
        isExpandable ? 'chat-roster-commander-card--expandable' : 'chat-roster-commander-card--slim',
        isExpanded ? 'is-expanded' : ''
    ].filter(Boolean).join(' ');

    const expandPanelMarkup = isExpandable
        ? `<div class="chat-roster-commander-expand-panel" ${isExpanded ? '' : 'hidden'}>${buildChatRosterExpandPanelMarkup(name, isSelf, inAge, staffRole)}</div>`
        : '';

    const profileInteractionAttrs = `role="button" tabindex="0" data-roster-profile-commander="${escapeMetricRosterHtml(name)}" aria-label="View ${escapeMetricRosterHtml(name)} profile" onclick="openCommunityChatRosterCommanderProfile(event)" onkeydown="handleCommunityChatRosterProfileKeydown(event)"`;

    const expandButtonMarkup = isExpandable
        ? `<button type="button" class="chat-roster-expand-btn" aria-expanded="${isExpanded ? 'true' : 'false'}" aria-label="Toggle ${escapeMetricRosterHtml(name)} staff details" data-roster-expand-key="${expandKey}" onclick="handleChatRosterExpandButtonClick(event)" onkeydown="handleChatRosterExpandButtonKeydown(event)">${isExpanded ? '▾' : '▸'}</button>`
        : '';

    return `
        <article class="chat-roster-commander-card chat-roster-commander-card--profile-open ${cardModifiers}" data-roster-commander="${escapeMetricRosterHtml(normalizeCommunityChatUsername(name))}"${staffRole ? ` data-staff-role="${staffRole}"` : ''} ${profileInteractionAttrs}${isExpandable ? ` data-roster-expand-key="${expandKey}"` : ''}>
            <div class="chat-roster-commander-body">
                <div class="chat-roster-commander-topline">
                    <span class="chat-roster-name-row">
                        <span class="chat-roster-presence-ring ${presenceRingClass}" aria-hidden="true" title="${escapeMetricRosterHtml(status.label)}"></span>
                        <span class="chat-roster-name" title="${escapeMetricRosterHtml(name)}">${escapeMetricRosterHtml(name)}</span>
                    </span>
                    <span class="chat-roster-status-pill ${status.pillClass}"><span class="chat-roster-status-pill-icon" aria-hidden="true">${status.icon}</span>${escapeMetricRosterHtml(status.label)}</span>
                    ${expandButtonMarkup}
                </div>
                ${expandPanelMarkup}
            </div>
        </article>
    `;
}

function renderCommunityChatOnlineRoster(targetBin) {
    const bin = targetBin || document.getElementById('chat-online-roster-dock');
    if (!bin) return;

    const selfRaw = resolvePortalPresenceUsername() || getLoggedCommunityChatUsername();
    const selfLower = normalizeCommunityChatUsername(selfRaw);
    const playingSet = new Set(
        (portalLiveMetricsCache.agePlayingPlayers || []).map((name) => normalizeCommunityChatUsername(name))
    );
    const presenceByUser = getPortalBrowsingPresenceMap();

    const seen = new Set();
    const rosterEntries = [];
    (portalLiveMetricsCache.portalBrowsingPlayers || []).forEach((entry) => {
        const normalized = normalizePortalBrowsingPlayerEntry(entry);
        if (!normalized) return;
        const key = normalizeCommunityChatUsername(normalized.username);
        if (!key || key === 'testaccount' || isRoyalGuardBotUsername(normalized.username) || seen.has(key)) return;
        seen.add(key);
        rosterEntries.push({
            username: normalized.username,
            presence: presenceByUser.get(key) || normalized.presence || 'portal'
        });
    });

    if (selfLower && selfLower !== 'testaccount' && !seen.has(selfLower)) {
        rosterEntries.push({
            username: selfRaw.trim(),
            presence: resolveLocalCommunityChatPresenceState()
        });
        seen.add(selfLower);
    }

    const sortedNames = sortCommunityChatRosterPlayers(
        rosterEntries.map((entry) => entry.username),
        selfLower,
        playingSet
    );
    const entryByKey = new Map(
        rosterEntries.map((entry) => [normalizeCommunityChatUsername(entry.username), entry])
    );
    const sortedEntries = sortedNames
        .map((name) => entryByKey.get(normalizeCommunityChatUsername(name)))
        .filter(Boolean);
    const inAgeCount = sortedEntries.filter((entry) => (
        playingSet.has(normalizeCommunityChatUsername(entry.username))
    )).length;

    const countEl = document.getElementById('chat-online-roster-count');
    if (countEl) countEl.textContent = String(sortedEntries.length);

    const inAgeCountEl = document.getElementById('chat-online-in-age-count');
    if (inAgeCountEl) inAgeCountEl.textContent = String(inAgeCount);

    const botCard = buildRoyalGuardBotRosterCardMarkup();
    const humanCards = sortedEntries
        .map((entry) => buildCommunityChatRosterCardMarkup(
            entry.username,
            selfLower,
            playingSet,
            entry.presence
        ))
        .filter(Boolean)
        .join('');

    if (!sortedEntries.length) {
        bin.innerHTML = `${botCard}
            <div class="chat-roster-empty-state chat-roster-empty-state--humans-only">
                <span class="chat-roster-empty-icon" aria-hidden="true">👥</span>
                <p class="chat-roster-empty-title">No other players online</p>
                <p class="chat-roster-empty-copy">Royal Guard is on duty. You're the only player in the portal list right now.</p>
            </div>`;
        return;
    }

    bin.innerHTML = botCard + humanCards;
}

async function requestPortalAgeJoin() {
    const username = resolvePortalPresenceUsername();
    if (!username) {
        return { ok: false, payload: { message: 'No commander session.' } };
    }

    const joinUrl = typeof resolveRoyalArmiesApiUrl === 'function'
        ? resolveRoyalArmiesApiUrl('/api/portal/age/join')
        : '/api/portal/age/join';
    const credentials = typeof canUsePortalAuthSessionApi === 'function' && canUsePortalAuthSessionApi()
        ? 'include'
        : 'same-origin';

    try {
        const response = await fetch(joinUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials,
            body: JSON.stringify({ username })
        });
        const payload = await response.json().catch(() => ({}));
        return { ok: response.ok, payload, response };
    } catch (err) {
        console.warn('Portal age join sync failed:', err);
        return { ok: false, payload: { message: 'Connection error.' } };
    }
}

async function verifyPortalAgeJoinAllowed() {
    const result = await requestPortalAgeJoin();
    if (result.ok) return true;

    if (result.payload?.code === 'NEXUS-GAME-011' || result.payload?.requiresTermsAcceptance) {
        if (typeof promptReturningUserTermsAcceptance === 'function') {
            promptReturningUserTermsAcceptance();
        }
    } else if (typeof showPortalAlert === 'function' && result.payload?.message) {
        await showPortalAlert(result.payload.message, 'Cannot join Age');
    }
    return false;
}

async function notifyPortalAgeSessionJoin() {
    const result = await requestPortalAgeJoin();
    if (!result.ok) {
        console.warn('Portal age join blocked:', result.payload?.message || 'request failed');
    }
}

async function notifyPortalAgeSessionLeave() {
    const username = resolvePortalPresenceUsername();
    if (!username) return;

    try {
        await fetch('/api/portal/age/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username }),
            keepalive: true
        });
    } catch (err) {
        console.warn('Portal age leave sync failed:', err);
    }
}

function bindMetricRosterHoverPopover(cellId, triggerId, popoverId) {
    const cell = document.getElementById(cellId);
    const trigger = document.getElementById(triggerId);
    const popover = document.getElementById(popoverId);
    if (!cell || !trigger || !popover) return;

    const showPopover = () => {
        popover.hidden = false;
        cell.classList.add('is-roster-open');
        trigger.setAttribute('aria-expanded', 'true');
    };

    const hidePopover = () => {
        popover.hidden = true;
        cell.classList.remove('is-roster-open');
        trigger.setAttribute('aria-expanded', 'false');
    };

    cell.addEventListener('mouseenter', showPopover);
    cell.addEventListener('mouseleave', hidePopover);
    cell.addEventListener('focusin', showPopover);
    cell.addEventListener('focusout', (event) => {
        if (!cell.contains(event.relatedTarget)) hidePopover();
    });
}

function initializePortalLivePlayerMetrics() {
    initializePortalUserActivityTracking();
    if (typeof startPortalInactivityLogoutWatch === 'function') {
        startPortalInactivityLogoutWatch();
    }
    bindMetricRosterHoverPopover(
        'metric-registered-players-cell',
        'metrics-registered-label-trigger',
        'metrics-registered-roster-popover'
    );
    bindMetricRosterHoverPopover(
        'metric-active-players-cell',
        'metrics-active-label-trigger',
        'metrics-active-roster-popover'
    );

    fetchPortalLiveMetrics();
    sendPortalPresenceHeartbeat();
    if (isCommanderPlayingActiveAgeLocally()) {
        if (typeof ensureCommanderAgeResetSessionContinuity === 'function') {
            ensureCommanderAgeResetSessionContinuity();
        }
        notifyPortalAgeSessionJoin();
    }

    if (portalPresenceHeartbeatTimer) clearInterval(portalPresenceHeartbeatTimer);
    portalPresenceHeartbeatTimer = setInterval(() => {
        if (activeMainPortalView === 'chat') return;
        sendPortalPresenceHeartbeat();
    }, PORTAL_PRESENCE_HEARTBEAT_MS);

    if (portalMetricsPollTimer) clearInterval(portalMetricsPollTimer);
    portalMetricsPollTimer = setInterval(fetchPortalLiveMetrics, 12000);

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            sendPortalPresenceHeartbeat();
            fetchPortalLiveMetrics();
            if (activeMainPortalView === 'chat') startCommunityChatPresenceLoop();
        }
    });

    window.addEventListener('pagehide', () => {
        clearPortalPresenceSession();
    });
}


/* ==========================================================================
   SECTION 4: LEADERBOARD CHRONICLE COMPILING LOOPS
   ========================================================================== */

/* Block 8: LEADERBOARD REGISTRY (empty until live Age standings sync) */
const globalAgeLeaderboardDossier = {
    individual: [],
    country: []
};
let activeLeaderboardSubTrack = 'individual';

/* Block 9: DYNAMIC LEADERBOARD PORTAL DESIGN COMPILER */
function renderMasterLeaderboardPortalCanvas(viewport) {
    viewport.innerHTML = `
        <div class="leaderboard-workspace-container">
            <div class="leaderboard-sub-toolbar-strip">
                <button class="settings-btn mini-btn ${activeLeaderboardSubTrack === 'individual' ? 'active-sub-glow' : ''}" onclick="toggleLeaderboardSubCategory('individual')">👤 Players</button>
                <button class="settings-btn mini-btn ${activeLeaderboardSubTrack === 'country' ? 'active-sub-glow' : ''}" onclick="toggleLeaderboardSubCategory('country')">🛡️ National Realms</button>
            </div>
            <div class="leaderboard-scrollable-table-bin" id="leaderboard-data-render-viewport"></div>
        </div>
    `;
    executeLeaderboardDataRowsCompile();
}

function toggleLeaderboardSubCategory(subTrack) {
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    activeLeaderboardSubTrack = subTrack;
    executeLeaderboardDataRowsCompile();
}

function executeLeaderboardDataRowsCompile() {
    const bin = document.getElementById('leaderboard-data-render-viewport');
    if (!bin) return;
    bin.innerHTML = "";

    if (activeLeaderboardSubTrack === 'individual') {
        if (!globalAgeLeaderboardDossier.individual.length) {
            bin.innerHTML = `<div class="empty-roster-txt" style="padding: 40px !important;">No player standings have been recorded for this Age yet.</div>`;
            return;
        }
        bin.innerHTML = `
            <table class="leaderboard-production-table-grid">
                <thead>
                    <tr><th>RANK</th><th style="text-align: left;">PLAYER</th><th style="text-align: left;">NATION</th><th style="text-align: right;">POWER SCORE</th><th style="text-align: right; width: 120px;">STATUS</th></tr>
                </thead>
                <tbody>
                    ${globalAgeLeaderboardDossier.individual.map(row => `
                        <tr class="${row.commander === 'testaccount' ? 'current-player-row-highlight' : ''}">
                            <td class="rank-badge-cell rank-num-${row.rank}">#${row.rank}</td>
                            <td class="commander-name-cell"><strong>${row.commander}</strong></td>
                            <td class="country-alliance-cell">${row.country}</td>
                            <td class="score-numerical-cell">${row.score}</td>
                            <td class="status-honorary-title-cell"><span>${row.status}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } else if (activeLeaderboardSubTrack === 'country') {
        if (!globalAgeLeaderboardDossier.country.length) {
            bin.innerHTML = `<div class="empty-roster-txt" style="padding: 40px !important;">No nation standings have been recorded for this Age yet.</div>`;
            return;
        }
        bin.innerHTML = `
            <table class="leaderboard-production-table-grid">
                <thead>
                    <tr><th>RANK</th><th style="text-align: left;">NATION STATE REALM</th><th style="text-align: left;">TOTAL CAPTURED CASTLES</th><th style="text-align: right;">POPULATION REGISTER</th><th style="text-align: right; width: 140px;">HISTORICAL VICTORIES</th></tr>
                </thead>
                <tbody>
                    ${globalAgeLeaderboardDossier.country.map(row => `
                        <tr>
                            <td class="rank-badge-cell rank-num-${row.rank}">#${row.rank}</td>
                            <td class="commander-name-cell" style="color: #ffd700;"><strong>${row.name}</strong></td>
                            <td class="country-alliance-cell" style="color: #f1e0ac;">${row.castles}</td>
                            <td class="score-numerical-cell">${row.population}</td>
                            <td class="status-honorary-title-cell" style="color: #ffd700;"><span>${row.victories}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
}


/* ==========================================================================
   SECTION 5: STAGING COMMUNITY CHAT ARCHITECTURE
   ========================================================================== */

/* Block 10: CHAT CHANNEL REPOSITORIES & MODERATION DATA PATHS */
const COMMUNITY_CHAT_CHANNEL_REGISTRY = [
    {
        id: 'general',
        label: 'General',
        icon: '💬',
        blurb: 'Open chat for everyone in the community.'
    },
    {
        id: 'bugs',
        label: 'Bug Reports',
        icon: '🐛',
        blurb: 'Report bugs, broken UI, and issues that block joining an Age.'
    },
    {
        id: 'gameplay',
        label: 'Gameplay Discussions',
        icon: '⚔️',
        blurb: 'Discuss game mechanics, army builds, timers, and strategy.'
    },
    {
        id: 'help',
        label: 'Help Desk',
        icon: '📜',
        blurb: 'Ask how systems work and get onboarding help from veterans.'
    },
    {
        id: 'offtopic',
        label: 'Off-topic',
        icon: '🍺',
        blurb: 'Casual chat not focused on the current Age.'
    }
];

let activeChatChannelTrack = 'general';
const CHAT_MENTION_ALERT_MAX_VISIBLE = 4;
const CHAT_MENTION_PREVIEW_MAX_CHARS = 110;
const CHAT_MENTION_SUGGESTION_MAX = 8;
let chatMentionAlertRegistry = {};
let chatMentionAlertCounter = 0;
let communityChatMentionRosterCache = [];
let communityChatMentionRosterLoadPromise = null;
let communityChatMentionSuggestState = null;
let userMuteExpirationRegistry = {};
let userBanExpirationRegistry = {}; 
let administrativeBehavioralReviewQueue = [];

// 🔥 STATEFUL SUSPICION TRACKERS: Tracks targeted teasing occurrences and logs chat histories behind the scenes
let playerSuspicionScoreRegistry = {};   // Structure format: { "testaccount": 2 }
let playerTeasingTranscriptHistory = {};  // Structure format: { "testaccount": ["[23:02]: get good"] }

let communityChatLogsDirectory = [];
/** @type {{ mode: 'reply'|'edit', messageId: number, sender?: string, snippet?: string }|null} */
let communityChatComposeState = null;
let communityChatRetentionMeta = null;
let communityChatSyncPollTimer = null;
let communityChatHistoryLoadPromise = null;
const COMMUNITY_CHAT_SERVER_CHANNEL_IDS = ['general', 'bugs', 'gameplay', 'help', 'offtopic'];
const COMMUNITY_CHAT_SYNC_POLL_MS = 20000;
const COMMUNITY_CHAT_MAX_ACTIVE_PER_CHANNEL = 100;

const restrictedProfanityLexiconPattern = /\b(fuck|fucking|bitch|ass|shit|asshole|cunt|retard|retarded)\b/gi;
const adversarialSentimentTriggers = [
 "trash", "garbage", "clown", "idiot", "loser", "hate you", "uninstall",
 "suck", "kill yourself", "kys", "dumb", "stupid", "worthless", "retard", "retarded"
];

// 🔥 PERSISTENT TEASING INSULT TRIGGERS: Borderline target patterns logged for structural escalation
const persistentTeasingInsultTriggers = [
 "get good", "git gud", "quit the game", "stop playing", "uninstall",
 "you're bad", "noob", "easy win", "cry more", "L bozo"
];

function escapeChatMentionAlertHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function getLoggedCommunityChatUsername() {
    if (typeof getActiveCommanderUsername === 'function') {
        return getActiveCommanderUsername() || '';
    }
    return localStorage.getItem('activeCommanderUser') || '';
}

function normalizeCommunityChatUsername(name) {
    return String(name || '').trim().toLowerCase();
}

function isUserOnCommunityChatPanel() {
    return activeMainPortalView === 'chat';
}

function extractMentionedUsernamesFromChatText(text) {
    const matches = String(text || '').match(/@([a-zA-Z0-9_\-]+)/g) || [];
    return matches.map((token) => token.slice(1).toLowerCase());
}

function getCommunityChatOnlineUsernameKeys() {
    const seen = new Set();
    const keys = [];
    (portalLiveMetricsCache.portalBrowsingPlayers || []).forEach((entry) => {
        const normalized = normalizePortalBrowsingPlayerEntry(entry);
        if (!normalized) return;
        const key = normalizeCommunityChatUsername(normalized.username);
        if (!key || key === 'testaccount' || isRoyalGuardBotUsername(normalized.username) || seen.has(key)) return;
        seen.add(key);
        keys.push(key);
    });
    return keys;
}

function getCommunityChatMentionCandidatePool() {
    const seen = new Set();
    const pool = [];

    const pushName = (name) => {
        const trimmed = String(name || '').trim();
        const key = normalizeCommunityChatUsername(trimmed);
        if (!trimmed || !key || key === 'testaccount' || isRoyalGuardBotUsername(trimmed) || seen.has(key)) return;
        seen.add(key);
        pool.push(trimmed);
    };

    communityChatMentionRosterCache.forEach(pushName);
    (portalLiveMetricsCache.portalBrowsingPlayers || []).forEach((entry) => {
        const normalized = normalizePortalBrowsingPlayerEntry(entry);
        if (normalized) pushName(normalized.username);
    });
    (portalLiveMetricsCache.agePlayingPlayers || []).forEach(pushName);
    (portalLiveMetricsCache.recentRegistrations || []).forEach((entry) => {
        pushName(typeof entry === 'string' ? entry : entry?.username);
    });

    const selfName = getLoggedCommunityChatUsername();
    pushName(selfName);

    return pool.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

async function loadCommunityChatMentionRoster(forceReload) {
    if (!isCommunityChatApiAvailable()) {
        communityChatMentionRosterCache = getCommunityChatMentionCandidatePool();
        return communityChatMentionRosterCache;
    }
    if (!forceReload && communityChatMentionRosterCache.length) {
        return communityChatMentionRosterCache;
    }
    if (!forceReload && communityChatMentionRosterLoadPromise) {
        return communityChatMentionRosterLoadPromise;
    }

    communityChatMentionRosterLoadPromise = fetch('/api/portal/community-chat/mention-roster')
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
            if (payload?.status === 'ok' && Array.isArray(payload.usernames)) {
                communityChatMentionRosterCache = payload.usernames
                    .map((name) => String(name || '').trim())
                    .filter(Boolean);
            }
            return getCommunityChatMentionCandidatePool();
        })
        .catch(() => getCommunityChatMentionCandidatePool())
        .finally(() => {
            communityChatMentionRosterLoadPromise = null;
        });

    return communityChatMentionRosterLoadPromise;
}

function getActiveCommunityChatMentionQuery(field) {
    if (!field) return null;

    const value = String(field.value || '');
    const caret = Number.isFinite(field.selectionStart) ? field.selectionStart : value.length;
    const beforeCaret = value.slice(0, caret);
    const match = beforeCaret.match(/@([a-zA-Z0-9_\-]*)$/);
    if (!match) return null;

    return {
        query: match[1] || '',
        startIndex: caret - match[0].length,
        endIndex: caret
    };
}

function filterCommunityChatMentionCandidates(query) {
    const pool = getCommunityChatMentionCandidatePool();
    const normalizedQuery = String(query || '').trim().toLowerCase();
    const onlineSet = new Set(getCommunityChatOnlineUsernameKeys());

    let matches = pool;
    if (normalizedQuery) {
        matches = pool.filter((name) => normalizeCommunityChatUsername(name).includes(normalizedQuery));
    }

    matches = matches.slice().sort((a, b) => {
        const aKey = normalizeCommunityChatUsername(a);
        const bKey = normalizeCommunityChatUsername(b);
        const aStarts = normalizedQuery && aKey.startsWith(normalizedQuery) ? 0 : 1;
        const bStarts = normalizedQuery && bKey.startsWith(normalizedQuery) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        const aOnline = onlineSet.has(aKey) ? 0 : 1;
        const bOnline = onlineSet.has(bKey) ? 0 : 1;
        if (aOnline !== bOnline) return aOnline - bOnline;
        return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });

    return matches.slice(0, CHAT_MENTION_SUGGESTION_MAX);
}

function hideCommunityChatMentionSuggestDropdown() {
    communityChatMentionSuggestState = null;
    const dropdown = document.getElementById('chat-mention-suggest-dropdown');
    if (dropdown) {
        dropdown.hidden = true;
        dropdown.innerHTML = '';
    }
}

function renderCommunityChatMentionSuggestDropdown(field, matches, highlightIndex) {
    const anchor = field?.closest('.chat-input-mention-anchor');
    let dropdown = document.getElementById('chat-mention-suggest-dropdown');
    if (!anchor) return;

    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'chat-mention-suggest-dropdown';
        dropdown.className = 'chat-mention-suggest-dropdown';
        dropdown.setAttribute('role', 'listbox');
        dropdown.setAttribute('aria-label', 'Mention suggestions');
        anchor.insertBefore(dropdown, field);
    }

    if (!matches.length) {
        dropdown.innerHTML = '<p class="chat-mention-suggest-empty">No matching commanders</p>';
        dropdown.hidden = false;
        return;
    }

    dropdown.innerHTML = matches.map((name, index) => {
        const highlighted = index === highlightIndex ? ' is-highlighted' : '';
        return `
            <button
                type="button"
                class="chat-mention-suggest-item${highlighted}"
                role="option"
                aria-selected="${index === highlightIndex ? 'true' : 'false'}"
                data-mention-username="${escapeMetricRosterHtml(name)}"
            ><span class="chat-mention-suggest-at" aria-hidden="true">@</span>${escapeMetricRosterHtml(name)}</button>
        `;
    }).join('');
    dropdown.hidden = false;
}

function refreshCommunityChatMentionSuggestFromField(field) {
    const active = getActiveCommunityChatMentionQuery(field);
    if (!active) {
        hideCommunityChatMentionSuggestDropdown();
        return;
    }

    const matches = filterCommunityChatMentionCandidates(active.query);
    if (!matches.length) {
        communityChatMentionSuggestState = {
            matches: [],
            highlightIndex: 0,
            startIndex: active.startIndex,
            endIndex: active.endIndex
        };
        renderCommunityChatMentionSuggestDropdown(field, [], 0);
        return;
    }

    const previousHighlight = communityChatMentionSuggestState?.highlightIndex || 0;
    const highlightIndex = Math.min(previousHighlight, matches.length - 1);

    communityChatMentionSuggestState = {
        matches,
        highlightIndex,
        startIndex: active.startIndex,
        endIndex: active.endIndex
    };

    renderCommunityChatMentionSuggestDropdown(field, matches, highlightIndex);
}

function applyCommunityChatMentionSelection(field, username) {
    const active = communityChatMentionSuggestState || getActiveCommunityChatMentionQuery(field);
    if (!field || !active || !username) return;

    const value = String(field.value || '');
    const before = value.slice(0, active.startIndex);
    const after = value.slice(active.endIndex);
    const mentionToken = `@${String(username).trim()} `;
    field.value = `${before}${mentionToken}${after}`;

    const caret = (before + mentionToken).length;
    field.setSelectionRange(caret, caret);
    hideCommunityChatMentionSuggestDropdown();
    field.focus();
}

function selectCommunityChatMentionSuggestion(clickEvent, username) {
    if (clickEvent) {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
    }
    const field = document.getElementById('chat-portal-message-input-field');
    const resolvedUsername = username
        || clickEvent?.currentTarget?.dataset?.mentionUsername
        || '';
    if (!field || !resolvedUsername) return;
    applyCommunityChatMentionSelection(field, resolvedUsername);
}

function handleCommunityChatMentionInput(event) {
    const field = event?.target;
    if (!field || field.id !== 'chat-portal-message-input-field') return;

    loadCommunityChatMentionRoster().then(() => {
        refreshCommunityChatMentionSuggestFromField(field);
    });
}

function handleCommunityChatMentionKeydown(event) {
    const field = event?.target;
    if (!field || field.id !== 'chat-portal-message-input-field') return;

    const dropdown = document.getElementById('chat-mention-suggest-dropdown');
    const isOpen = dropdown && !dropdown.hidden;
    const state = communityChatMentionSuggestState;

    if (isOpen && state?.matches?.length) {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            state.highlightIndex = (state.highlightIndex + 1) % state.matches.length;
            renderCommunityChatMentionSuggestDropdown(field, state.matches, state.highlightIndex);
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            state.highlightIndex = (state.highlightIndex - 1 + state.matches.length) % state.matches.length;
            renderCommunityChatMentionSuggestDropdown(field, state.matches, state.highlightIndex);
            return;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault();
            applyCommunityChatMentionSelection(field, state.matches[state.highlightIndex]);
            return;
        }
    }

    if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        hideCommunityChatMentionSuggestDropdown();
        return;
    }

    if (event.key === 'Enter') {
        handleChatInputFieldSubmit(event);
        return;
    }

    setTimeout(() => {
        if (getActiveCommunityChatMentionQuery(field)) {
            refreshCommunityChatMentionSuggestFromField(field);
        } else {
            hideCommunityChatMentionSuggestDropdown();
        }
    }, 0);
}

function wireCommunityChatMentionAutocomplete(field) {
    if (!field || field.dataset.mentionAutocompleteWired === 'true') return;
    field.dataset.mentionAutocompleteWired = 'true';

    field.addEventListener('input', handleCommunityChatMentionInput);
    field.addEventListener('keydown', handleCommunityChatMentionKeydown);
    field.addEventListener('click', handleCommunityChatMentionInput);
    field.addEventListener('blur', () => {
        setTimeout(() => hideCommunityChatMentionSuggestDropdown(), 140);
    });

    const anchor = field.closest('.chat-input-mention-anchor');
    if (anchor && anchor.dataset.mentionSuggestWired !== 'true') {
        anchor.dataset.mentionSuggestWired = 'true';
        anchor.addEventListener('mousedown', (clickEvent) => {
            const option = clickEvent.target.closest('[data-mention-username]');
            if (!option) return;
            clickEvent.preventDefault();
            selectCommunityChatMentionSuggestion(null, option.dataset.mentionUsername);
        });
    }

    loadCommunityChatMentionRoster();
}

function buildChatMentionPreviewSnippet(text) {
    const compact = String(text || '').replace(/\s+/g, ' ').trim();
    if (compact.length <= CHAT_MENTION_PREVIEW_MAX_CHARS) return compact;
    return `${compact.slice(0, CHAT_MENTION_PREVIEW_MAX_CHARS)}…`;
}

function getCommunityChatChannelMeta(channelKey) {
    return COMMUNITY_CHAT_CHANNEL_REGISTRY.find((entry) => entry.id === channelKey)
        || COMMUNITY_CHAT_CHANNEL_REGISTRY[0];
}

function getChatChannelDisplayLabel(channelKey) {
    return getCommunityChatChannelMeta(channelKey).label;
}

function isCommunityChatApiAvailable() {
    return typeof isMailboxApiAvailable === 'function' && isMailboxApiAvailable();
}

function isCommunityChatServerBackedChannel(channelKey) {
    return COMMUNITY_CHAT_SERVER_CHANNEL_IDS.includes(String(channelKey || '').trim());
}

function normalizeCommunityChatLogFromServer(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const sentAt = raw.sentAt || null;
    const time = String(raw.time || '').trim()
        || (sentAt
            ? new Date(sentAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
            : '');

    return {
        id: Number(raw.id),
        channel: raw.channel || 'general',
        sender: raw.sender,
        text: raw.text,
        time,
        sentAt,
        visible: raw.visible !== false,
        originalText: raw.originalText || raw.text,
        recipientAlertOnly: raw.recipientAlertOnly === true,
        replyTo: raw.replyTo || null,
        editedAt: raw.editedAt || null,
        isEdited: !!raw.isEdited
    };
}

function getClientOnlyCommunityChatMessages() {
    return communityChatLogsDirectory.filter((entry) => (
        entry.recipientAlertOnly
        || entry.channel === 'review'
        || !isCommunityChatServerBackedChannel(entry.channel)
    ));
}

function mergeServerCommunityChatMessages(serverMessages) {
    const clientOnly = getClientOnlyCommunityChatMessages();
    const normalized = (Array.isArray(serverMessages) ? serverMessages : [])
        .map(normalizeCommunityChatLogFromServer)
        .filter(Boolean);

    communityChatLogsDirectory = [...normalized, ...clientOnly];
    communityChatLogsDirectory.sort((a, b) => {
        const aMs = Date.parse(a.sentAt || '') || Number(a.id) || 0;
        const bMs = Date.parse(b.sentAt || '') || Number(b.id) || 0;
        return aMs - bMs;
    });
}

function formatCommunityChatRetentionNoticeInnerHtml() {
    const max = communityChatRetentionMeta?.maxActivePerChannel || COMMUNITY_CHAT_MAX_ACTIVE_PER_CHANNEL;
    const days = communityChatRetentionMeta?.purgeIntervalDays || 15;
    let nextPurgeLabel = 'on the next scheduled cycle';

    if (communityChatRetentionMeta?.nextPurgeAt) {
        try {
            nextPurgeLabel = new Date(communityChatRetentionMeta.nextPurgeAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });
        } catch (_err) {
            nextPurgeLabel = 'on the next scheduled cycle';
        }
    }

    return `Community chat keeps the latest <strong>${max}</strong> messages per channel. Older posts are archived for owner review.
            All channel history is cleared automatically every <strong>${days} days</strong>
            (next clear: <strong>${escapeCommunityChatDisplayHtml(nextPurgeLabel)}</strong>).`;
}

function updateCommunityChatRetentionNoticeElement() {
    const notice = document.getElementById('chat-retention-policy-notice');
    if (!notice) return;
    notice.innerHTML = formatCommunityChatRetentionNoticeInnerHtml();
}

function syncCommunityChatRestrictionRegistries(viewerRestrictions) {
    const loggedUser = getLoggedCommunityChatUsername();
    if (!loggedUser) return;

    const now = Date.now();
    const bannedMs = Date.parse(viewerRestrictions?.bannedUntil || '');
    if (Number.isFinite(bannedMs) && bannedMs > now) {
        userBanExpirationRegistry[loggedUser] = bannedMs;
    } else {
        delete userBanExpirationRegistry[loggedUser];
    }

    const mutedMs = Date.parse(viewerRestrictions?.mutedUntil || '');
    if (Number.isFinite(mutedMs) && mutedMs > now) {
        userMuteExpirationRegistry[loggedUser] = mutedMs;
    } else {
        delete userMuteExpirationRegistry[loggedUser];
    }
}

async function postCommunityChatRestrictionToServer(action, targetUsername) {
    if (!isCommunityChatApiAvailable()) return false;

    const username = getLoggedCommunityChatUsername();
    if (!username || !targetUsername) return false;

    try {
        const response = await fetch('/api/portal/community-chat/restrictions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                targetUsername,
                action
            })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.status !== 'ok') {
            console.warn('Community chat restriction failed:', payload.message || response.status);
            return false;
        }
        return true;
    } catch (err) {
        console.warn('Community chat restriction error:', err);
        return false;
    }
}

async function postCommunityChatDisciplinaryNoticeToServer(noticePayload) {
    if (!isCommunityChatApiAvailable()) return null;

    const username = getLoggedCommunityChatUsername();
    if (!username) return null;

    try {
        const response = await fetch('/api/portal/community-chat/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                disciplinaryNotice: true,
                ...noticePayload
            })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.status !== 'ok') {
            console.warn('Community chat disciplinary notice failed:', payload.message || response.status);
            return null;
        }

        mergeServerCommunityChatMessages(payload.messages || [payload.message]);
        return normalizeCommunityChatLogFromServer(payload.message);
    } catch (err) {
        console.warn('Community chat disciplinary notice error:', err);
        return null;
    }
}

async function fetchCommunityChatFromServer() {
    if (!isCommunityChatApiAvailable()) return false;

    const username = getLoggedCommunityChatUsername();
    const url = new URL('/api/portal/community-chat', window.location.href);
    if (username) url.searchParams.set('username', username);

    try {
        const response = await fetch(url.toString());
        if (!response.ok) return false;

        const payload = await response.json();
        if (payload.status !== 'ok' || !Array.isArray(payload.messages)) return false;

        mergeServerCommunityChatMessages(payload.messages);
        communityChatRetentionMeta = payload.retention || communityChatRetentionMeta;
        syncCommunityChatRestrictionRegistries(payload.viewerRestrictions);
        updateCommunityChatRetentionNoticeElement();

        if (activeMainPortalView === 'chat') {
            executeCompileActiveChannelMessageStrips();
        }
        return true;
    } catch (err) {
        console.warn('Community chat sync failed:', err);
        return false;
    }
}

function loadCommunityChatHistory() {
    if (!isCommunityChatApiAvailable()) return Promise.resolve(false);
    if (!communityChatHistoryLoadPromise) {
        communityChatHistoryLoadPromise = fetchCommunityChatFromServer().finally(() => {
            communityChatHistoryLoadPromise = null;
        });
    }
    return communityChatHistoryLoadPromise;
}

function startCommunityChatSyncLoop() {
    if (communityChatSyncPollTimer) clearInterval(communityChatSyncPollTimer);
    if (!isCommunityChatApiAvailable()) return;

    loadCommunityChatHistory();
    communityChatSyncPollTimer = setInterval(() => {
        if (activeMainPortalView !== 'chat') return;
        fetchCommunityChatFromServer();
    }, COMMUNITY_CHAT_SYNC_POLL_MS);
}

function stopCommunityChatSyncLoop() {
    if (communityChatSyncPollTimer) {
        clearInterval(communityChatSyncPollTimer);
        communityChatSyncPollTimer = null;
    }
}

async function postCommunityChatMessageToServer(messagePayload) {
    if (!isCommunityChatApiAvailable()) return null;

    const username = getLoggedCommunityChatUsername();
    try {
        const response = await fetch('/api/portal/community-chat/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                ...messagePayload
            })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.status !== 'ok' || !payload.message) {
            const message = payload.message || 'Unable to send chat message.';
            console.warn('Community chat post failed:', message);
            if (message.includes('reply to your own')) {
                cancelCommunityChatComposeMode(true);
            }
            return null;
        }

        mergeServerCommunityChatMessages(payload.messages || [payload.message]);
        communityChatRetentionMeta = payload.retention || communityChatRetentionMeta;
        syncCommunityChatRestrictionRegistries(payload.viewerRestrictions);
        updateCommunityChatRetentionNoticeElement();
        return normalizeCommunityChatLogFromServer(payload.message);
    } catch (err) {
        console.warn('Community chat post error:', err);
        return null;
    }
}

async function patchCommunityChatMessageOnServer(messageId, text) {
    if (!isCommunityChatApiAvailable()) return null;

    const username = getLoggedCommunityChatUsername();
    try {
        const response = await fetch(`/api/portal/community-chat/messages/${encodeURIComponent(messageId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, text })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.status !== 'ok' || !payload.message) {
            console.warn('Community chat edit failed:', payload.message || response.status);
            return null;
        }

        mergeServerCommunityChatMessages(payload.messages || [payload.message]);
        communityChatRetentionMeta = payload.retention || communityChatRetentionMeta;
        return normalizeCommunityChatLogFromServer(payload.message);
    } catch (err) {
        console.warn('Community chat edit error:', err);
        return null;
    }
}

function appendCommunityChatMessage(logEntry) {
    const currentClockTime = new Date();
    const cleanTimeStr = `${currentClockTime.getHours().toString().padStart(2, '0')}:${currentClockTime.getMinutes().toString().padStart(2, '0')}`;

    const entry = {
        id: logEntry.id || Date.now() + Math.floor(Math.random() * 1000),
        channel: logEntry.channel || activeChatChannelTrack,
        sender: logEntry.sender,
        text: logEntry.text,
        time: logEntry.time || cleanTimeStr,
        visible: logEntry.visible !== false,
        originalText: logEntry.originalText || logEntry.text,
        recipientAlertOnly: !!logEntry.recipientAlertOnly,
        replyTo: logEntry.replyTo || null,
        editedAt: logEntry.editedAt || null,
        isEdited: !!logEntry.isEdited
    };

    const skipLocalStore = logEntry.skipLocalStore === true
        || (
            isCommunityChatApiAvailable()
            && isCommunityChatServerBackedChannel(entry.channel)
            && !entry.recipientAlertOnly
        );

    if (!skipLocalStore) {
        communityChatLogsDirectory.push(entry);
    }

    processChatMessageForMentionAlert(entry);
    return entry;
}

function processChatMessageForMentionAlert(logEntry) {
    if (!logEntry || logEntry.visible === false || logEntry.recipientAlertOnly) return;

    const loggedUser = normalizeCommunityChatUsername(getLoggedCommunityChatUsername());
    const senderName = normalizeCommunityChatUsername(logEntry.sender);
    if (!loggedUser || senderName === loggedUser) return;

    const mentions = extractMentionedUsernamesFromChatText(logEntry.text);
    if (!mentions.includes(loggedUser)) return;
    if (isUserOnCommunityChatPanel()) return;

    showChatMentionAlert({
        sender: logEntry.sender,
        preview: buildChatMentionPreviewSnippet(logEntry.text),
        channel: logEntry.channel,
        messageId: logEntry.id
    });
}

function ensureChatMentionAlertStack() {
    let stack = document.getElementById('chat-mention-alert-stack');
    if (!stack) {
        stack = document.createElement('div');
        stack.id = 'chat-mention-alert-stack';
        stack.className = 'chat-mention-alert-stack';
        stack.setAttribute('aria-live', 'polite');
        stack.setAttribute('aria-label', 'Community chat shoutout alerts');
        document.body.appendChild(stack);
    }
    return stack;
}

function showChatMentionAlert(payload) {
    const stack = ensureChatMentionAlertStack();
    const alertId = `chat-mention-alert-${++chatMentionAlertCounter}`;
    const channel = payload.channel || 'general';
    const sender = payload.sender || 'Unknown player';
    const preview = payload.preview || '';
    const channelLabel = getChatChannelDisplayLabel(channel);

    const card = document.createElement('div');
    card.className = 'chat-mention-alert-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.dataset.alertId = alertId;
    card.dataset.channel = channel;
    card.innerHTML = `
        <div class="chat-mention-alert-card-header">
            <span class="chat-mention-alert-eyebrow">@ Shoutout · ${escapeChatMentionAlertHtml(channelLabel)}</span>
            <button type="button" class="chat-mention-alert-dismiss-btn" aria-label="Dismiss shoutout alert" onclick="dismissChatMentionAlert(event, '${alertId}')">×</button>
        </div>
        <div class="chat-mention-alert-sender">${escapeChatMentionAlertHtml(sender)} called you out</div>
        <div class="chat-mention-alert-preview">"${escapeChatMentionAlertHtml(preview)}"</div>
        <div class="chat-mention-alert-cta">Click to open ${escapeChatMentionAlertHtml(channelLabel)} →</div>
    `;

    card.addEventListener('click', (event) => {
        if (event.target.closest('.chat-mention-alert-dismiss-btn')) return;
        openCommunityChatFromMentionAlert(channel, alertId);
    });
    card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openCommunityChatFromMentionAlert(channel, alertId);
        }
    });

    stack.prepend(card);
    chatMentionAlertRegistry[alertId] = { channel, sender, preview, messageId: payload.messageId };

    const cards = stack.querySelectorAll('.chat-mention-alert-card');
    if (cards.length > CHAT_MENTION_ALERT_MAX_VISIBLE) {
        const removed = cards[cards.length - 1];
        const removedId = removed.dataset.alertId;
        delete chatMentionAlertRegistry[removedId];
        removed.remove();
    }

    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
}

function dismissChatMentionAlert(clickEvent, alertId) {
    if (clickEvent) {
        clickEvent.stopPropagation();
        clickEvent.preventDefault();
    }

    const card = document.querySelector(`.chat-mention-alert-card[data-alert-id="${alertId}"]`);
    if (card) card.remove();
    delete chatMentionAlertRegistry[alertId];
}

function activateCommunityChatNavTab() {
    document.querySelectorAll('.nav-tab').forEach((tab) => tab.classList.remove('active'));
    const chatTab = Array.from(document.querySelectorAll('.nav-tab')).find((tab) => (
        tab.textContent.trim() === 'Community Chat'
    ));
    if (chatTab) chatTab.classList.add('active');
}

function buildCommunityChatChannelSidebarMarkup() {
    return COMMUNITY_CHAT_CHANNEL_REGISTRY.map((channel) => {
        const isActive = activeChatChannelTrack === channel.id;
        return `<button type="button" class="chat-channel-btn ${isActive ? 'active-channel-glow' : ''}" onclick="toggleActiveChatChannelStream('${channel.id}')">${channel.icon} ${channel.label}</button>`;
    }).join('');
}

function openCommunityChatFromMentionAlert(channel, alertId) {
    const registryIds = COMMUNITY_CHAT_CHANNEL_REGISTRY.map((entry) => entry.id);
    if (channel && registryIds.includes(channel)) {
        activeChatChannelTrack = channel;
    }

    dismissChatMentionAlert(null, alertId);
    activateCommunityChatNavTab();
    switchMainPortalView('chat', null, activeChatChannelTrack);

    if (typeof playSelectSFX === 'function') playSelectSFX();
}

window.dismissChatMentionAlert = dismissChatMentionAlert;
window.openCommunityChatFromMentionAlert = openCommunityChatFromMentionAlert;
window.appendCommunityChatMessage = appendCommunityChatMessage;
window.beginReplyToCommunityChatMessage = beginReplyToCommunityChatMessage;
window.beginEditCommunityChatMessage = beginEditCommunityChatMessage;
window.cancelCommunityChatComposeMode = cancelCommunityChatComposeMode;
window.selectCommunityChatMentionSuggestion = selectCommunityChatMentionSuggestion;

/* Block 11: MULTI-COLUMN COMPLIANCE CHAT COMPILER */
function renderCommunityChatPortalCanvas(viewport) {
    const channelMeta = getCommunityChatChannelMeta(activeChatChannelTrack);

    viewport.innerHTML = `
        <div class="chat-workspace-chassis">
            <div class="chat-sidebar-channels-deck" aria-label="Chat channels">
                <p class="chat-sidebar-channels-label">Channels</p>
                ${buildCommunityChatChannelSidebarMarkup()}
            </div>
            <div class="chat-main-feed-compartment">
                <header class="chat-channel-context-banner chat-channel-context-banner-inline">
                    <span class="chat-channel-context-icon" aria-hidden="true">${channelMeta.icon}</span>
                    <div class="chat-channel-context-copy">
                        <h3 class="chat-channel-context-title">${channelMeta.label}</h3>
                        <p class="chat-channel-context-blurb">${channelMeta.blurb}</p>
                    </div>
                </header>
                <div class="chat-scrolling-messages-bin" id="chat-stream-render-viewport"></div>
                <div class="chat-input-toolbar-row" id="chat-portal-input-interaction-tray"></div>
            </div>
            <aside class="chat-sidebar-player-roster-deck" aria-label="Active players">
                <div class="chat-roster-header-deck">
                    <div class="player-roster-header-title">
                        <span class="chat-roster-header-icon" aria-hidden="true">👥</span>
                        <span class="chat-roster-header-label">Active Players</span>
                        <span class="chat-online-roster-count" id="chat-online-roster-count">0</span>
                    </div>
                    <p class="chat-roster-subtitle"><span id="chat-online-in-age-count">0</span> in the Age · click a player for their profile · Owner/Mod ▸ for staff details</p>
                    <div class="chat-roster-status-legend" aria-label="Roster presence and badges">
                        <span class="chat-roster-legend-item"><span class="chat-roster-legend-dot chat-roster-legend-dot--chat-active" aria-hidden="true"></span> In Chat</span>
                        <span class="chat-roster-legend-item"><span class="chat-roster-legend-dot chat-roster-legend-dot--portal-browsing" aria-hidden="true"></span> On Site</span>
                        <span class="chat-roster-legend-item"><span class="chat-roster-legend-dot chat-roster-legend-dot--idle" aria-hidden="true"></span> Away (10m+)</span>
                        <span class="chat-roster-legend-item chat-roster-legend-item--royal-guard-bot"><span aria-hidden="true">🤖</span> Royal Guard</span>
                        <span class="chat-roster-legend-item chat-roster-legend-item--owner"><span aria-hidden="true">👑</span> Owner</span>
                        <span class="chat-roster-legend-item chat-roster-legend-item--moderator"><span aria-hidden="true">🛡</span> Mod</span>
                        <span class="chat-roster-legend-item chat-roster-legend-item--in-age"><span aria-hidden="true">⚔</span> In Age</span>
                    </div>
                </div>
                <div class="player-roster-scrollable-track-bin" id="chat-online-roster-dock">
                    <div class="chat-roster-loading-note">Loading Player List</div>
                </div>
            </aside>
        </div>
    `;
    executeCompileActiveChannelMessageStrips();
    refreshCommunityChatOnlineRosterIfVisible();
    sendPortalPresenceHeartbeat();
    loadCommunityChatHistory();
    loadCommunityChatMentionRoster(true);
}

function toggleActiveChatChannelStream(targetChannel) {
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    activeChatChannelTrack = targetChannel;
    cancelCommunityChatComposeMode(false);
    executeCommunityChatTabRenderingSequence();
}

function escapeCommunityChatDisplayHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function findCommunityChatMessageById(messageId) {
    const id = Number(messageId);
    if (!Number.isFinite(id)) return null;
    return communityChatLogsDirectory.find((log) => log.id === id) || null;
}

function formatCommunityChatMessageBodyHtml(text) {
    return escapeCommunityChatDisplayHtml(text).replace(
        /(@[a-zA-Z0-9_\-]+)/g,
        '<span class="chat-shoutout-mention-badge">$1</span>'
    );
}

function isCommunityChatMessageActionable(log) {
    if (!log || log.visible === false || log.recipientAlertOnly) return false;
    if (isRoyalGuardBotUsername(log.sender)) return false;
    return true;
}

function buildCommunityChatReplyQuoteMarkup(replyTo) {
    if (!replyTo || !replyTo.sender) return '';
    const snippet = escapeCommunityChatDisplayHtml(replyTo.snippet || '');
    const sender = escapeCommunityChatDisplayHtml(replyTo.sender);
    return `
        <div class="chat-message-reply-quote" aria-label="Replying to earlier message">
            <span class="chat-message-reply-quote-label">↳ ${sender}</span>
            <span class="chat-message-reply-quote-text">${snippet}</span>
        </div>
    `;
}

function buildCommunityChatMessageHoverActionsMarkup(log, loggedUser) {
    if (!isCommunityChatMessageActionable(log)) return '';
    const canEdit = log.sender === loggedUser;
    const canReply = normalizeCommunityChatUsername(log.sender) !== normalizeCommunityChatUsername(loggedUser);
    return `
        <div class="chat-message-hover-actions" aria-label="Message actions">
            ${canReply ? `<button type="button" class="chat-message-action-btn" onclick="beginReplyToCommunityChatMessage(${log.id}, event)">Reply</button>` : ''}
            ${canReply ? `<button type="button" class="chat-message-action-btn chat-message-action-btn--report" onclick="beginReportCommunityChatMessage(${log.id}, event)">Report</button>` : ''}
            ${canEdit ? `<button type="button" class="chat-message-action-btn" onclick="beginEditCommunityChatMessage(${log.id}, event)">Edit</button>` : ''}
        </div>
    `;
}

function cancelCommunityChatComposeMode(shouldRecompile = true) {
    communityChatComposeState = null;
    if (shouldRecompile) {
        renderCommunityChatInputTray();
    }
}

function beginReplyToCommunityChatMessage(messageId, clickEvent) {
    if (clickEvent) clickEvent.stopPropagation();
    const target = findCommunityChatMessageById(messageId);
    if (!target || !isCommunityChatMessageActionable(target)) return;

    const loggedUser = getLoggedCommunityChatUsername();
    if (normalizeCommunityChatUsername(target.sender) === normalizeCommunityChatUsername(loggedUser)) {
        return;
    }

    communityChatComposeState = {
        mode: 'reply',
        messageId: target.id,
        sender: target.sender,
        snippet: buildChatMentionPreviewSnippet(target.text)
    };

    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    renderCommunityChatInputTray();

    const field = document.getElementById('chat-portal-message-input-field');
    if (field) {
        field.focus();
        field.placeholder = `Reply to ${target.sender}…`;
    }
}

function beginReportCommunityChatMessage(messageId, clickEvent) {
    if (clickEvent) clickEvent.stopPropagation();
    const target = findCommunityChatMessageById(messageId);
    if (!target || !isCommunityChatMessageActionable(target)) return;

    const loggedUser = getLoggedCommunityChatUsername();
    if (normalizeCommunityChatUsername(target.sender) === normalizeCommunityChatUsername(loggedUser)) {
        return;
    }

    const channel = String(target.channel || 'general').trim() || 'general';
    const snippet = buildChatMentionPreviewSnippet(target.text);
    const contextLabel = `#${channel}${target.time ? ` — ${target.time}` : ''}: ${snippet}`;

    if (typeof RoyalArmiesPlayerReport !== 'undefined' && typeof RoyalArmiesPlayerReport.open === 'function') {
        RoyalArmiesPlayerReport.open({
            targetUsername: target.sender,
            source: 'community_chat',
            contextLabel,
            contextMeta: {
                messageId: target.id,
                channel
            }
        }, clickEvent);
    }
}

function beginEditCommunityChatMessage(messageId, clickEvent) {
    if (clickEvent) clickEvent.stopPropagation();
    const loggedUser = getLoggedCommunityChatUsername();
    const target = findCommunityChatMessageById(messageId);
    if (!target || target.sender !== loggedUser) return;

    communityChatComposeState = {
        mode: 'edit',
        messageId: target.id,
        sender: target.sender,
        snippet: target.text
    };

    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    renderCommunityChatInputTray();

    const field = document.getElementById('chat-portal-message-input-field');
    if (field) {
        field.value = target.text;
        field.focus();
        field.select();
    }
}

function updateCommunityChatMessageText(messageId, newText) {
    const loggedUser = getLoggedCommunityChatUsername();
    const target = findCommunityChatMessageById(messageId);
    if (!target || target.sender !== loggedUser) return false;

    const trimmed = String(newText || '').trim();
    if (!trimmed) return false;

    const currentClockTime = new Date();
    target.text = trimmed;
    target.originalText = trimmed;
    target.isEdited = true;
    target.editedAt = `${currentClockTime.getHours().toString().padStart(2, '0')}:${currentClockTime.getMinutes().toString().padStart(2, '0')}`;
    return true;
}

function renderCommunityChatInputTray() {
    const tray = document.getElementById('chat-portal-input-interaction-tray');
    if (!tray) return;

    const loggedUser = getLoggedCommunityChatUsername();
    const currentEpochTimestamp = Date.now();

    if (userBanExpirationRegistry[loggedUser] && currentEpochTimestamp < userBanExpirationRegistry[loggedUser]) {
        tray.innerHTML = `<div class="chat-restriction-alert-banner system-banned">🔴 You are banned from chat for 15 days because of repeated rule violations.</div>`;
        return;
    }
    if (userMuteExpirationRegistry[loggedUser] && currentEpochTimestamp < userMuteExpirationRegistry[loggedUser]) {
        tray.innerHTML = `<div class="chat-restriction-alert-banner system-muted">⏳ You are temporarily muted from chat. The mute lifts in 30 minutes.</div>`;
        return;
    }

    const channelLabel = getChatChannelDisplayLabel(activeChatChannelTrack);
    let composeBanner = '';

    if (communityChatComposeState) {
        if (communityChatComposeState.mode === 'reply') {
            composeBanner = `
                <div class="chat-compose-context-banner chat-compose-context-banner--reply">
                    <span class="chat-compose-context-copy">↳ Replying to <strong>${escapeCommunityChatDisplayHtml(communityChatComposeState.sender)}</strong>: "${escapeCommunityChatDisplayHtml(communityChatComposeState.snippet)}"</span>
                    <button type="button" class="cancel-btn chat-compose-context-cancel" onclick="cancelCommunityChatComposeMode()">Cancel</button>
                </div>
            `;
        } else if (communityChatComposeState.mode === 'edit') {
            composeBanner = `
                <div class="chat-compose-context-banner chat-compose-context-banner--edit">
                    <span class="chat-compose-context-copy">✎ Editing your message</span>
                    <button type="button" class="cancel-btn chat-compose-context-cancel" onclick="cancelCommunityChatComposeMode()">Cancel</button>
                </div>
            `;
        }
    }

    const sendLabel = communityChatComposeState?.mode === 'edit' ? 'Save' : 'Send';

    tray.innerHTML = `
        <div class="chat-input-toolbar-stack">
            ${composeBanner}
            <div class="chat-input-toolbar-row-inner">
                <div class="chat-input-mention-anchor">
                    <input type="text" id="chat-portal-message-input-field" placeholder="Message ${escapeCommunityChatDisplayHtml(channelLabel)}… Use @username to shout out" autocomplete="off" spellcheck="false">
                    <div id="chat-mention-suggest-dropdown" class="chat-mention-suggest-dropdown" role="listbox" aria-label="Mention suggestions" hidden></div>
                </div>
                <button type="button" class="settings-btn mini-btn" onclick="executeSubmitNewPortalChatMessage()">${sendLabel}</button>
            </div>
            <p class="chat-retention-policy-notice" id="chat-retention-policy-notice" role="note"></p>
        </div>
    `;
    updateCommunityChatRetentionNoticeElement();

    if (communityChatComposeState?.mode === 'edit') {
        const field = document.getElementById('chat-portal-message-input-field');
        if (field) field.value = communityChatComposeState.snippet || '';
    }

    const field = document.getElementById('chat-portal-message-input-field');
    if (field) wireCommunityChatMentionAutocomplete(field);
}

function updateAdministrativeReviewBadgeMetrics() {
 const badge = document.getElementById("review-queue-badge-count");
 if (badge) {
 badge.innerText = administrativeBehavioralReviewQueue.length;
 badge.style.display = administrativeBehavioralReviewQueue.length > 0 ? "inline-block" : "none";
 }
}

function executeCommunityChatTabRenderingSequence() {
    const viewport = document.getElementById('main-portal-dynamic-viewport');
    if (viewport) renderCommunityChatPortalCanvas(viewport);
}

window.toggleActiveChatChannelStream = toggleActiveChatChannelStream;

/* Block 12: TEXT MENTION PARSER & DUAL FILTERS INTERCEPT ENGINE */
function executeCompileActiveChannelMessageStrips() {
 const bin = document.getElementById('chat-stream-render-viewport');
 if (!bin) return;
 bin.innerHTML = "";
 
 const loggedUser = localStorage.getItem("activeCommanderUser") || "testaccount";
 renderCommunityChatInputTray();

 if (activeChatChannelTrack === 'review') {
 if (administrativeBehavioralReviewQueue.length === 0) {
 bin.innerHTML = `<div class="empty-roster-txt" style="padding: 40px !important;">🛡️ No pending behavioral violations submitted for review.</div>`;
 return;
 }
 administrativeBehavioralReviewQueue.forEach((item, index) => {
 const reviewCard = document.createElement('div');
 reviewCard.className = 'behavioral-review-triage-card';
 reviewCard.innerHTML = `
 <div class="review-card-meta-row">
 <span>⚠️ Flagged Sender: <strong style="color:#ffd700;">${item.sender}</strong></span>
 <span class="review-timestamp-tag">[${item.time} in ${item.channel.toUpperCase()}]</span>
 </div>
 <div class="review-card-raw-text">"${item.text}"</div>
 <div class="review-card-action-bar-row">
 <button class="review-action-btn triage-remove" onclick="executeStaffModerationAction('remove', ${index})">REJECT MSG</button>
 <button class="review-action-btn triage-mute" onclick="executeStaffModerationAction('mute', ${index})">MUTE 30M</button>
 <button class="review-action-btn triage-ban" onclick="executeStaffModerationAction('ban', ${index})">BAN 15D</button>
 </div>
 `;
 bin.appendChild(reviewCard);
 });
 return;
 }

 const filteredLogs = communityChatLogsDirectory.filter(log => log.channel === activeChatChannelTrack);

 if (!filteredLogs.length) {
 bin.innerHTML = `<div class="empty-roster-txt chat-channel-empty-state">No messages in <strong>${getChatChannelDisplayLabel(activeChatChannelTrack)}</strong> yet. Post the first message below.</div>`;
 return;
 }

 filteredLogs.forEach(log => {
 if (!log.visible && log.recipientAlertOnly && log.sender === loggedUser) {
 const alertRow = document.createElement('div');
 alertRow.className = 'chat-message-strip-row disciplinary-incident-system-row';
 alertRow.innerHTML = `<span class="chat-message-body-text-content">⚔️ <strong>[INCIDENT DETECTED]:</strong> ${log.text}</span>`;
 bin.appendChild(alertRow);
 return;
 }
 if (!log.visible) return;

 const messageRow = document.createElement('div');
 messageRow.className = 'chat-message-strip-row';
 messageRow.dataset.messageId = String(log.id);
 if (log.sender === loggedUser) messageRow.classList.add('local-sender-highlight-strip');
 if (isRoyalGuardBotUsername(log.sender)) messageRow.classList.add('system-bot-message-highlight');
 const staffRole = typeof getPortalStaffRole === 'function' ? getPortalStaffRole(log.sender) : null;
 if (staffRole === 'owner') messageRow.classList.add('chat-message-strip-row--owner');
 if (staffRole === 'moderator') messageRow.classList.add('chat-message-strip-row--moderator');

 const editedTag = log.isEdited
     ? `<span class="chat-message-edited-tag" title="Edited ${escapeCommunityChatDisplayHtml(log.editedAt || '')}">(edited)</span>`
     : '';
 const formattedTextContent = formatCommunityChatMessageBodyHtml(log.text);
 messageRow.innerHTML = `
 <div class="chat-message-content-stack">
 <div class="chat-message-meta-left">
 <span class="chat-message-timestamp">[${log.time}]</span>
 ${formatCommunityChatSenderMarkup(log.sender)}
 ${editedTag}
 </div>
 ${buildCommunityChatReplyQuoteMarkup(log.replyTo)}
 <span class="chat-message-body-text-content">${formattedTextContent}</span>
 </div>
 ${buildCommunityChatMessageHoverActionsMarkup(log, loggedUser)}
 `;
 bin.appendChild(messageRow);
 });
 
 setTimeout(() => {
 const totalContentHeight = bin.scrollHeight;
 const visibleViewportHeight = bin.clientHeight;
 if (totalContentHeight > visibleViewportHeight) {
 bin.scrollTop = totalContentHeight - visibleViewportHeight;
 }
 }, 15);
}

function handleChatInputFieldSubmit(e) {
 if (e.key === 'Enter') executeSubmitNewPortalChatMessage();
}

async function executeSubmitNewPortalChatMessage() {
 const field = document.getElementById('chat-portal-message-input-field');
 if (!field) return;
 let textContent = field.value.trim();
 if (!textContent) return;

 const loggedUser = localStorage.getItem("activeCommanderUser") || "testaccount";

 if (communityChatComposeState?.mode === 'edit') {
     if (isCommunityChatApiAvailable()) {
         const patched = await patchCommunityChatMessageOnServer(communityChatComposeState.messageId, textContent);
         if (patched) {
             cancelCommunityChatComposeMode(false);
             field.value = '';
             executeCompileActiveChannelMessageStrips();
             if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
         }
         return;
     }

     const updated = updateCommunityChatMessageText(communityChatComposeState.messageId, textContent);
     if (updated) {
         cancelCommunityChatComposeMode(false);
         field.value = '';
         executeCompileActiveChannelMessageStrips();
         if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
     }
     return;
 }

 const replyTarget = communityChatComposeState?.mode === 'reply'
     ? findCommunityChatMessageById(communityChatComposeState.messageId)
     : null;

 if (replyTarget && normalizeCommunityChatUsername(replyTarget.sender) === normalizeCommunityChatUsername(loggedUser)) {
     cancelCommunityChatComposeMode(true);
     return;
 }

 const replyPayload = replyTarget
     ? {
         id: replyTarget.id,
         sender: replyTarget.sender,
         snippet: buildChatMentionPreviewSnippet(replyTarget.text)
     }
     : null;
 const currentClockTime = new Date();
 const cleanTimeStr = `${currentClockTime.getHours().toString().padStart(2, '0')}:${currentClockTime.getMinutes().toString().padStart(2, '0')}`;
 let isViolationFound = false;
 let originalRawText = textContent;
 let lowerCaseCleanText = originalRawText.toLowerCase();

 // 🛑 ACTION GATING 1: HARD PROFANITY SCAN & AUTOMATIC RE-ROUTE REPLACEMENT MASK
 if (restrictedProfanityLexiconPattern.test(textContent)) {
 isViolationFound = true;
 textContent = textContent.replace(restrictedProfanityLexiconPattern, (matchedWord) => "*".repeat(matchedWord.length));
 }

 // 🛑 ACTION GATING 2: TOXIC INSULT SCAN (IMMEDIATE SINGLE FLAGGING TO REVIEW BOARD)
 let isDisrespectMatched = adversarialSentimentTriggers.some(insult => lowerCaseCleanText.includes(insult));
 if (isDisrespectMatched) {
 administrativeBehavioralReviewQueue.push({
 id: Date.now(),
 channel: activeChatChannelTrack,
 sender: loggedUser,
 text: `🔴 [IMMEDIATE TOXICITY FLAG]: ${originalRawText}`,
 time: cleanTimeStr
 });
 updateAdministrativeReviewBadgeMetrics();
 if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
 }

 // 🛑 ACTION GATING 3: PASSIVE-AGGRESSIVE TEASING TRACKER (STATEFUL SUSPICION ENGINE)
 let isTeasingPhraseDetected = persistentTeasingInsultTriggers.some(phrase => lowerCaseCleanText.includes(phrase));
 if (isTeasingPhraseDetected && !isDisrespectMatched) {
 if (!playerSuspicionScoreRegistry[loggedUser]) playerSuspicionScoreRegistry[loggedUser] = 0;
 if (!playerTeasingTranscriptHistory[loggedUser]) playerTeasingTranscriptHistory[loggedUser] = [];

 playerSuspicionScoreRegistry[loggedUser]++;
 playerTeasingTranscriptHistory[loggedUser].push(`[${cleanTimeStr} inside ${activeChatChannelTrack.toUpperCase()}]: "${originalRawText}"`);

 console.log(`ROYAL GUARD AUDIT: User [${loggedUser}] suspicion incremented to: ${playerSuspicionScoreRegistry[loggedUser]}/3`);

 // Check if the target user has breached their final tracking threshold ceiling limits
 if (playerSuspicionScoreRegistry[loggedUser] >= 3) {
 console.log(`ROYAL GUARD: Persistent targeting limits crossed. Packaging chronological logs as proof.`);
 const proofDossierBundleLogsString = playerTeasingTranscriptHistory[loggedUser].join(" | ");

 administrativeBehavioralReviewQueue.push({
 id: Date.now(),
 channel: activeChatChannelTrack,
 sender: loggedUser,
 text: `⚠️ [Repeated harassment] (3 offenses) — Chat log: ${proofDossierBundleLogsString}`,
 time: cleanTimeStr
 });

 // Re-calibrate the score registers to clear the active cache queue track
 playerSuspicionScoreRegistry[loggedUser] = 0;
 playerTeasingTranscriptHistory[loggedUser] = [];

 updateAdministrativeReviewBadgeMetrics();
 if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
 }
 }

 const outboundPayload = {
     channel: activeChatChannelTrack,
     sender: loggedUser,
     text: textContent,
     time: cleanTimeStr,
     visible: true,
     originalText: originalRawText,
     replyTo: replyPayload
 };

 if (isCommunityChatApiAvailable() && isCommunityChatServerBackedChannel(activeChatChannelTrack)) {
     const saved = await postCommunityChatMessageToServer(outboundPayload);
     if (!saved) return;

     processChatMessageForMentionAlert(saved);
 } else {
     appendCommunityChatMessage(outboundPayload);
 }

 cancelCommunityChatComposeMode(false);
 field.value = "";
 executeCompileActiveChannelMessageStrips();

 if (isViolationFound) {
 setTimeout(async () => {
 const botPayload = {
 channel: activeChatChannelTrack,
 sender: getRoyalGuardBotDisplayName(),
 text: `@${loggedUser} Severe behavioral policy violation detected. Clean up your language signature or face total chat exclusion channels.`,
 time: cleanTimeStr,
 visible: true,
 originalText: ""
 };

 if (isCommunityChatApiAvailable() && isCommunityChatServerBackedChannel(activeChatChannelTrack)) {
     await postCommunityChatMessageToServer({ ...botPayload, systemBot: true });
 } else {
     appendCommunityChatMessage(botPayload);
 }

 if (typeof playSelectSFX === 'function') playSelectSFX();
 executeCompileActiveChannelMessageStrips();
 }, 150);
 }
}

/* Block 13: Staff Override Moderation Disciplinary Logic */
async function executeStaffModerationAction(actionType, targetQueueIndex) {
    const targetIncident = administrativeBehavioralReviewQueue[targetQueueIndex];
    if (!targetIncident) return;

    const currentClockTime = new Date();
    const cleanTimeStr = `${currentClockTime.getHours().toString().padStart(2, '0')}:${currentClockTime.getMinutes().toString().padStart(2, '0')}`;
    const offender = targetIncident.sender;

    let targetLogNode = communityChatLogsDirectory.find(log => log.id === targetIncident.id || (log.sender === offender && log.channel === targetIncident.channel));

    switch (actionType) {
        case 'remove':
            console.log("MODERATOR ACTION: Rejecting message and extracting toxic terms.");
            
            // PIPELINE A: HEURISTIC SELF-LEARNING ENGINE
            if (targetIncident.text) {
                executeAutomatedTokenCrestLearning(targetIncident.text);
            }

            // Purge the offensive message block out of standard view layers
            if (targetLogNode) {
                targetLogNode.visible = false; 
            }
            
            // 🔥 PIPELINE B: DISCIPLINARY INDIVIDUAL VISIBILITY NOTIFIER
            // Generates a high-priority system feedback notice card pinned strictly
            // to the timeline of the player who committed the code of conduct violation.
            communityChatLogsDirectory.push({
                id: Date.now(),
                channel: targetIncident.channel,
                sender: offender,
                text: "Your recent message was removed because it broke community rules. This is a warning.",
                time: cleanTimeStr,
                visible: false,          // Keeps it 100% hidden from all common players on screen
                recipientAlertOnly: true // Force-renders the feedback block strictly onto the offender's canvas matrix
            });
            break;
            
        case 'mute':
            console.log(`MODERATOR ACTION: Muting user: ${offender}`);
            userMuteExpirationRegistry[offender] = Date.now() + (30 * 60 * 1000);
            await postCommunityChatRestrictionToServer('mute', offender);
            
            // Also trigger adaptive learning if a mute action was executed on a message card
            if (targetIncident.text) executeAutomatedTokenCrestLearning(targetIncident.text);

            communityChatLogsDirectory.forEach(log => {
                if (log.sender === offender && log.channel === targetIncident.channel) log.visible = false;
            });
            
            if (isCommunityChatApiAvailable() && isCommunityChatServerBackedChannel(targetIncident.channel)) {
                await postCommunityChatDisciplinaryNoticeToServer({
                    channel: targetIncident.channel,
                    sender: offender,
                    text: 'Your communication access has been temporarily suspended for 30 minutes due to behavioral violations.',
                    time: cleanTimeStr,
                    visible: false,
                    recipientAlertOnly: true
                });
            } else {
                communityChatLogsDirectory.push({
                    id: Date.now(),
                    channel: targetIncident.channel,
                    sender: offender,
                    text: 'Your communication access has been temporarily suspended for 30 minutes due to behavioral violations.',
                    time: cleanTimeStr,
                    visible: false,
                    recipientAlertOnly: true
                });
            }
            break;

        case 'ban':
            console.log(`MODERATOR ACTION: Banning user: ${offender}`);
            userBanExpirationRegistry[offender] = Date.now() + (15 * 24 * 60 * 60 * 1000);
            await postCommunityChatRestrictionToServer('ban', offender);
            
            if (targetIncident.text) executeAutomatedTokenCrestLearning(targetIncident.text);

            communityChatLogsDirectory.forEach(log => {
                if (log.sender === offender && log.channel === targetIncident.channel) log.visible = false;
            });

            if (isCommunityChatApiAvailable() && isCommunityChatServerBackedChannel(targetIncident.channel)) {
                await postCommunityChatDisciplinaryNoticeToServer({
                    channel: targetIncident.channel,
                    sender: offender,
                    text: 'Your communication access has been terminated for 15 Days due to code of conduct failures.',
                    time: cleanTimeStr,
                    visible: false,
                    recipientAlertOnly: true
                });
            } else {
                communityChatLogsDirectory.push({
                    id: Date.now(),
                    channel: targetIncident.channel,
                    sender: offender,
                    text: 'Your communication access has been terminated for 15 Days due to code of conduct failures.',
                    time: cleanTimeStr,
                    visible: false,
                    recipientAlertOnly: true
                });
            }
            break;
    }

    // Clear item out of review triage queue array registry
    administrativeBehavioralReviewQueue.splice(targetQueueIndex, 1);
    
    if (typeof playSelectSFX === 'function') playSelectSFX();
    
    updateAdministrativeReviewBadgeMetrics();
    const viewportElement = document.getElementById('main-portal-dynamic-viewport');
    if (viewportElement) {
        renderCommunityChatPortalCanvas(viewportElement);
    }
}

/* Block 14: 🔥 DYNAMIC TOKENIZATION KEYWORD EXTRACTION HELPER METHOD */
function executeAutomatedTokenCrestLearning(rawFlaggedTextString) {
    // A. Strip administrative flag prefixes out of the calculation string pass if present
    let textToAnalyze = rawFlaggedTextString.replace(/🔴 \[IMMEDIATE TOXICITY FLAG\]:/g, "");
    textToAnalyze = textToAnalyze.replace(/⚠️ \[PERSISTENT TARGETING DISCOVERED\].*Proof:/g, "");

    // B. Clean out punctuation marks and isolate words into a lowercase array string pool
    const isolatedTokenArray = textToAnalyze.toLowerCase()
                                            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
                                            .split(/\s+/);

    // C. Non-offensive structural terms array (Prevents the bot from accidentally banning standard dialogue phrases)
    const baselineGrammarStopWords = [
        "this", "is", "a", "an", "the", "and", "or", "but", "if", "because", "bro", "dude",
        "you", "your", "youre", "me", "my", "i", "we", "they", "he", "she", "it", "to", "for", 
        "in", "on", "at", "by", "with", "just", "stop", "playing", "game", "need", "get"
    ];

    isolatedTokenArray.forEach(token => {
        const cleanToken = token.trim();
        if (cleanToken.length < 3) return; // Skip minor connection characters or abbreviations

        // D. CONDITIONAL EVALUATION: Only extract the word if it is not common grammar and not already on the list
        const isCommonWord = baselineGrammarStopWords.includes(cleanToken);
        const isAlreadyListed = adversarialSentimentTriggers.includes(cleanToken) || persistentTeasingInsultTriggers.includes(cleanToken);

        if (!isCommonWord && !isAlreadyListed) {
            // Append the newly discovered toxic word to the detection array list instantly!
            adversarialSentimentTriggers.push(cleanToken);
            console.log(`🤖 ROYAL GUARD ML ENGINE: Extracted new toxic word: [${cleanToken}]. Dictionary updated.`);
        }
    });
}


/* ==========================================================================
   SECTION 6: ROYALTY PAID MEMBERSHIP (member title + Premium Battle Pass)
   ========================================================================== */

const COMMANDER_MEMBERSHIP_STORAGE_KEY = 'savedCommanderMembershipTitle';
const ROYALTY_PAID_BADGE_TITLE = 'Royalty';
const FREE_MEMBERSHIP_BADGE_TITLE = 'Basic';
const ROYALTY_MEMBER_DISPLAY_TITLE = 'Royalty Member';
const BASIC_MEMBER_DISPLAY_TITLE = 'Basic Member';

function normalizeStoredMembershipTitle(stored) {
    const value = String(stored || '').trim();
    if (value === 'Royalty' || value === ROYALTY_MEMBER_DISPLAY_TITLE) return ROYALTY_PAID_BADGE_TITLE;
    if (value === 'Bronze' || value === 'Basic' || value === BASIC_MEMBER_DISPLAY_TITLE) {
        return FREE_MEMBERSHIP_BADGE_TITLE;
    }
    return value;
}

function formatMembershipDisplayTitle(title) {
    const normalized = normalizeStoredMembershipTitle(title);
    if (normalized === FREE_MEMBERSHIP_BADGE_TITLE) return BASIC_MEMBER_DISPLAY_TITLE;
    if (normalized === ROYALTY_PAID_BADGE_TITLE) return ROYALTY_MEMBER_DISPLAY_TITLE;
    if (/member$/i.test(String(title || '').trim())) return String(title).trim();
    const base = String(title || '').trim();
    return base ? `${base} Member` : BASIC_MEMBER_DISPLAY_TITLE;
}

function resolveMembershipBadgeTierClass(title) {
    const normalized = normalizeStoredMembershipTitle(title).toLowerCase();
    if (normalized === 'basic') return 'bronze';
    return normalized;
}
const CHRONICLE_PREMIUM_MONTHLY_PRICE_LABEL = '$10 / month';
const CHRONICLE_TIER_MAX_LEVEL = 50;
/** Player-facing Battle Pass wording (common in level-based reward games). */
const CHRONICLE_BATTLE_PASS_HEADING = 'Battle Pass';
const CHRONICLE_FREE_PASS_LABEL = 'Free Pass';
const CHRONICLE_PREMIUM_PASS_LABEL = 'Premium Pass';

function isActiveCommanderPortalOwner() {
    return typeof isPortalSiteOwner === 'function' && isPortalSiteOwner();
}

function isCommanderExcludedFromChronicleTiers() {
    return isActiveCommanderPortalOwner();
}

function resolveCommanderMembershipTitleForUsername(username, fallbackTitle) {
    if (typeof isPortalSiteOwner === 'function' && isPortalSiteOwner(username)) {
        return ROYALTY_PAID_BADGE_TITLE;
    }
    const activeUser = typeof getActiveCommanderUsername === 'function' ? getActiveCommanderUsername() : '';
    const subjectKey = String(username || '').trim().toLowerCase();
    const activeKey = String(activeUser || '').trim().toLowerCase();
    if (subjectKey && activeKey && subjectKey === activeKey) {
        return getCommanderMembershipTitle();
    }
    return fallbackTitle || FREE_MEMBERSHIP_BADGE_TITLE;
}

function getCommanderMembershipTitle() {
    if (isActiveCommanderPortalOwner()) {
        return ROYALTY_PAID_BADGE_TITLE;
    }
    const stored = normalizeStoredMembershipTitle(localStorage.getItem(COMMANDER_MEMBERSHIP_STORAGE_KEY));
    if (stored === ROYALTY_PAID_BADGE_TITLE) return ROYALTY_PAID_BADGE_TITLE;
    if (localStorage.getItem('savedChroniclePremiumMember') === 'true') return ROYALTY_PAID_BADGE_TITLE;
    return FREE_MEMBERSHIP_BADGE_TITLE;
}

function isCommanderRoyaltyMember() {
    if (isActiveCommanderPortalOwner()) return false;
    return getCommanderMembershipTitle() === ROYALTY_PAID_BADGE_TITLE;
}

function buildCommanderOwnerTagMarkup() {
    return '<span class="commander-owner-tag" title="Site owner"><span class="commander-owner-tag-icon" aria-hidden="true">👑</span>Owner</span>';
}

function shouldShowCommanderOwnerTag(username) {
    return username
        ? (typeof isPortalSiteOwner === 'function' && isPortalSiteOwner(username))
        : isActiveCommanderPortalOwner();
}

function buildCommanderMembershipBadgeRowMarkup(username, badgeClassName = 'membership-badge', options = {}) {
    const includeOwnerTag = options.includeOwnerTag === true;
    const title = username
        ? resolveCommanderMembershipTitleForUsername(username)
        : getCommanderMembershipTitle();
    const tierClass = resolveMembershipBadgeTierClass(title);
    const ownerTag = includeOwnerTag && shouldShowCommanderOwnerTag(username) ? buildCommanderOwnerTagMarkup() : '';
    return `<span class="${badgeClassName} tier-${tierClass}">${formatMembershipDisplayTitle(title)}</span>${ownerTag}`;
}

function applyCommanderMembershipTitle(title) {
    if (isActiveCommanderPortalOwner()) {
        refreshCommanderMembershipBadgeDisplays();
        return;
    }
    const isRoyalty = title === ROYALTY_PAID_BADGE_TITLE;
    const nextTitle = isRoyalty ? ROYALTY_PAID_BADGE_TITLE : FREE_MEMBERSHIP_BADGE_TITLE;
    localStorage.setItem(COMMANDER_MEMBERSHIP_STORAGE_KEY, nextTitle);
    if (isRoyalty) {
        localStorage.setItem('savedChroniclePremiumMember', 'true');
    } else {
        localStorage.removeItem('savedChroniclePremiumMember');
    }
    if (typeof player !== 'undefined') {
        player.membershipTitle = nextTitle;
    }
    if (typeof scheduleCommanderDossierSave === 'function') {
        scheduleCommanderDossierSave({
            membershipTitle: nextTitle,
            premiumMember: isRoyalty
        });
    }
    refreshCommanderMembershipBadgeDisplays();
    if (typeof refreshChronicleRewardsTrackPanels === 'function') {
        refreshChronicleRewardsTrackPanels();
    }
}

function hydrateCommanderMembershipFromStorage() {
    if (typeof player === 'undefined') return;
    player.membershipTitle = getCommanderMembershipTitle();
    refreshCommanderMembershipBadgeDisplays();
}

function refreshCommanderMembershipBadgeDisplays() {
    const title = getCommanderMembershipTitle();
    const tierClass = title.toLowerCase();
    const playerName = typeof player !== 'undefined' ? player.name : undefined;

    document.querySelectorAll('.profile-identity-badge-row').forEach((row) => {
        row.innerHTML = buildCommanderMembershipBadgeRowMarkup(playerName, 'membership-badge', { includeOwnerTag: true });
    });

    document.querySelectorAll('.commander-membership-badge-row').forEach((row) => {
        if (row.id === 'nav-commander-membership-badge-row') return;
        if (row.classList.contains('public-profile-badge-row')) return;
        if (row.classList.contains('profile-identity-badge-row')) return;
        row.innerHTML = buildCommanderMembershipBadgeRowMarkup(playerName, 'membership-badge');
    });

    document.querySelectorAll('.public-profile-badge-row').forEach((row) => {
        const card = row.closest('.public-profile-card, .public-profile-overlay');
        const subjectName = card?.querySelector('.public-profile-commander-name')?.textContent?.trim() || '';
        row.innerHTML = buildCommanderMembershipBadgeRowMarkup(subjectName, 'public-profile-membership');
    });

    const navBadgeRow = document.getElementById('nav-commander-membership-badge-row');
    const navOwnerSlot = document.getElementById('nav-commander-owner-tag-slot');
    if (navBadgeRow) {
        navBadgeRow.innerHTML = buildCommanderMembershipBadgeRowMarkup(undefined, 'membership-badge');
        navBadgeRow.hidden = false;
        navBadgeRow.removeAttribute('aria-hidden');
    }
    if (navOwnerSlot) {
        navOwnerSlot.innerHTML = '';
        navOwnerSlot.hidden = true;
    }

    document.querySelectorAll('.membership-badge').forEach((badge) => {
        if (badge.closest('.commander-membership-badge-row, .nav-commander-owner-tag-slot')) return;
        badge.textContent = `${title} Member`;
        badge.className = `membership-badge tier-${tierClass}`;
    });
    document.querySelectorAll('.public-profile-membership').forEach((badge) => {
        const row = badge.closest('.public-profile-badge-row');
        if (row) return;
        badge.textContent = `${title} Member`;
        badge.className = `public-profile-membership tier-${tierClass}`;
    });
}

async function beginRoyaltyMembershipCheckout() {
    if (typeof playSelectSFX === 'function') playSelectSFX();
    if (window.RoyalArmiesRoyaltyBilling && typeof window.RoyalArmiesRoyaltyBilling.beginRoyaltyMembershipCheckout === 'function') {
        return window.RoyalArmiesRoyaltyBilling.beginRoyaltyMembershipCheckout({
            premiumPassLabel: CHRONICLE_PREMIUM_PASS_LABEL,
            priceLabel: CHRONICLE_PREMIUM_MONTHLY_PRICE_LABEL
        });
    }
    await showPortalAlert(
        `Royalty membership (${CHRONICLE_PREMIUM_MONTHLY_PRICE_LABEL}) checkout is not live yet.\n\n` +
        `When billing is connected, subscribing grants the Royalty Member title and unlocks the ${CHRONICLE_PREMIUM_PASS_LABEL} on The Chronicles.`,
        'Checkout'
    );
}

async function beginRoyaltyMembershipDowngrade() {
    if (typeof playSelectSFX === 'function') playSelectSFX();

    const confirmed = await showPortalConfirm(
        'Downgrade from Royalty to the free plan?\n\n' +
        `You will lose the Royalty Member title and access to the ${CHRONICLE_PREMIUM_PASS_LABEL} on The Chronicles. ` +
        `Your Basic Member status and ${CHRONICLE_FREE_PASS_LABEL} remain.`,
        {
            title: 'Downgrade membership',
            confirmLabel: 'Downgrade',
            cancelLabel: 'Keep Royalty'
        }
    );
    if (!confirmed) return;

    if (typeof applyCommanderMembershipTitle === 'function') {
        applyCommanderMembershipTitle(FREE_MEMBERSHIP_BADGE_TITLE);
    }

    const viewport = document.getElementById('main-portal-dynamic-viewport');
    if (viewport && typeof activeMainPortalView !== 'undefined' && activeMainPortalView === 'royalty') {
        renderRoyaltyTierPortalCanvas(viewport);
    }
}

function openUnlockPremiumTierPortal(clickEvent) {
    if (clickEvent) {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
    }
    if (typeof playSelectSFX === 'function') playSelectSFX();
    window.pendingRoyaltyMembershipFocus = 'royalty';
    switchMainPortalView('royalty', null);
}

/* Block 15: Royalty membership plans (paid = Royalty badge) */
const ROYALTY_PLAN_TIER_ART = {
    standard: {
        src: 'images/basic.png',
        alt: 'Standard membership crest',
        label: 'Basic membership'
    },
    royalty: {
        src: 'images/premium.png',
        alt: 'Royalty premium membership crest',
        label: 'Premium membership'
    }
};

function buildRoyaltyPackageVisualMarkup(planVariant) {
    const art = ROYALTY_PLAN_TIER_ART[planVariant] || ROYALTY_PLAN_TIER_ART.standard;
    return `
        <div class="royalty-package-visual-stage royalty-package-visual-stage--${planVariant}">
            <p class="royalty-package-visual-eyebrow">${art.label}</p>
            <div class="royalty-package-visual-frame">
                <img
                    class="royalty-package-tier-art"
                    src="${art.src}"
                    alt="${art.alt}"
                    width="640"
                    height="480"
                    loading="lazy"
                    decoding="async"
                />
            </div>
        </div>
    `;
}

const globalRoyaltyTierPackagesDatabase = [
    {
        tier: 'Standard',
        cost: 'Free',
        planVariant: 'standard',
        badge: 'FREE',
        badgeTitleGranted: BASIC_MEMBER_DISPLAY_TITLE,
        features: [
            'Basic Member title on profile and public dossier',
            'Basic Tier Battle Pass',
            'And More!'
        ],
        actionText: 'Current plan',
        enabled: false,
        isPaidPlan: false
    },
    {
        tier: 'Premium',
        cost: CHRONICLE_PREMIUM_MONTHLY_PRICE_LABEL,
        planVariant: 'royalty',
        badge: 'ROYALTY',
        badgeTitleGranted: ROYALTY_MEMBER_DISPLAY_TITLE,
        features: [
            'Royalty Member title on profile and public dossier',
            'Premium Tier Battle Pass',
            'Royal Tactician\'s War Room — visual battle analytics & round-by-round stats',
            'Unique designed & animated Royalty cosmetics',
            'Exclusive gold profile frame cosmetics',
            'And More!'
        ],
        actionText: `Unlock ${CHRONICLE_PREMIUM_PASS_LABEL}`,
        enabled: true,
        isPaidPlan: true
    }
];

/* Block 16: ROYALTY MATRIX PORTAL ROUTER INTERCEPT ENGINE */
function renderRoyaltyTierPortalCanvas(viewport) {
    if (isActiveCommanderPortalOwner()) {
        viewport.innerHTML = `
        <div class="royalty-workspace-container">
            <header class="royalty-workspace-header-deck">
                <h2 class="royalty-master-title">👑 Royalty Membership</h2>
                <p class="royalty-master-subtitle">As <strong>site owner</strong>, your profile shows the <strong>Royalty Member</strong> title with an <strong>Owner</strong> tag. Paid membership plans are not required for you, and the ${CHRONICLE_FREE_PASS_LABEL} / ${CHRONICLE_PREMIUM_PASS_LABEL} lanes on the ${CHRONICLE_BATTLE_PASS_HEADING} do not apply.</p>
            </header>
            <div class="royalty-owner-exempt-banner">
                <strong>Owner account</strong> — you are not enrolled in the Standard or Premium membership flows. ${CHRONICLE_BATTLE_PASS_HEADING} level rewards on The Chronicles are disabled for owner accounts.
            </div>
        </div>`;
        return;
    }

    const isRoyalty = isCommanderRoyaltyMember();

    viewport.innerHTML = `
        <div class="royalty-workspace-container">
            <header class="royalty-workspace-header-deck">
                <h2 class="royalty-master-title">👑 Royalty Membership</h2>
                <p class="royalty-master-subtitle">Subscribe monthly to earn the <strong>Royalty Member</strong> title and unlock the <strong>${CHRONICLE_PREMIUM_PASS_LABEL}</strong> on The Chronicles (${CHRONICLE_PREMIUM_MONTHLY_PRICE_LABEL}). Free commanders keep the <strong>Basic Member</strong> title and the <strong>${CHRONICLE_FREE_PASS_LABEL}</strong>.</p>
            </header>
            ${isRoyalty ? `<div class="royalty-active-member-banner">You are a <strong>Royalty Member</strong> — the <strong>${CHRONICLE_PREMIUM_PASS_LABEL}</strong> is unlocked on The Chronicles.</div>` : ''}
            <div class="royalty-plans-deck">
                <div class="royalty-tier-cards-flex-row">
                ${globalRoyaltyTierPackagesDatabase.map((pack) => {
                    const isFreeCurrentPlan = !pack.isPaidPlan && !isRoyalty;
                    const isPaidCurrentPlan = pack.isPaidPlan && isRoyalty;
                    const isActivePlan = isFreeCurrentPlan || isPaidCurrentPlan;
                    const canSubscribe = pack.isPaidPlan && pack.enabled && !isActivePlan;
                    const actionHandler = canSubscribe ? 'onclick="beginRoyaltyMembershipCheckout()"' : '';
                    const badgeClass = pack.isPaidPlan
                        ? 'royalty-plan-pill royalty-plan-pill--paid'
                        : 'royalty-plan-pill royalty-plan-pill--free';

                    let actionFooterMarkup = '';
                    if (isFreeCurrentPlan) {
                        actionFooterMarkup = `
                            <div class="royalty-package-action-footer">
                                <span class="royalty-package-status-label royalty-package-status-label--included" aria-current="true">Current plan</span>
                            </div>`;
                    } else if (isPaidCurrentPlan) {
                        actionFooterMarkup = `
                            <div class="royalty-package-action-footer">
                                <button type="button" class="settings-btn master-action-btn royalty-package-action-btn royalty-package-action-btn--downgrade"
                                        onclick="beginRoyaltyMembershipDowngrade()">
                                    Downgrade
                                </button>
                            </div>`;
                    } else {
                        const complianceMarkup = typeof buildRoyaltyCheckoutComplianceMarkup === 'function'
                            ? buildRoyaltyCheckoutComplianceMarkup()
                            : '';
                        actionFooterMarkup = `
                            <div class="royalty-package-action-footer">
                                ${complianceMarkup}
                                <button type="button" class="settings-btn master-action-btn royalty-package-action-btn pulse-buy-btn"
                                        ${actionHandler}
                                        aria-describedby="royalty-checkout-compliance-note">
                                    Purchase
                                </button>
                            </div>`;
                    }

                    return `
                    <article class="royalty-package-display-card royalty-package--${pack.planVariant} ${isActivePlan ? 'royalty-plan-current' : ''}">
                        ${buildRoyaltyPackageVisualMarkup(pack.planVariant)}
                        <div class="royalty-package-info-deck">
                            <div class="royalty-package-card-header">
                                <div class="royalty-package-title-block">
                                    <h3 class="royalty-package-tier-name">${pack.tier}</h3>
                                    <p class="royalty-badge-title-grant">Member title: <strong>${pack.badgeTitleGranted}</strong></p>
                                </div>
                                <span class="${badgeClass}">${pack.badge}</span>
                            </div>
                            <div class="royalty-package-cost">${pack.cost}</div>
                            <ul class="royalty-package-features-list">
                                ${pack.features.map((feat) => `
                                    <li class="royalty-package-feature-item"><span class="royalty-package-feature-bullet" aria-hidden="true">✦</span><span>${escapeMetricRosterHtml(feat)}</span></li>
                                `).join('')}
                            </ul>
                        </div>
                        ${actionFooterMarkup}
                    </article>
                `;
                }).join('')}
                </div>
            </div>
        </div>
    `;
}


/* ==========================================================================
   SECTION 7: LORE CODEX — NATIONS OF AMNEK
   ========================================================================== */

let portalLoreNarrationAudio = null;
let portalLoreNarrationPlaying = false;
let portalLoreActiveNationId = null;
let portalLoreMusicDuckActive = false;
let portalLoreMusicRestoreFadeActive = false;
let portalLoreMusicRestoreFadeRaf = null;

const PORTAL_LORE_NARRATION_MUSIC_DUCK_LEVEL = 0.1;
const PORTAL_LORE_NARRATION_MUSIC_RESTORE_MS = 3000;

const PORTAL_LORE_NATION_ACCENT = {
    Vaelior: '#5a7a9a',
    Aesthene: '#6a9eb8',
    Khaerant: '#9a7a4a',
    Aethelgard: '#6b8a6b',
    Krall: '#8a4a4a',
    Gorz: '#6a3050',
    Thruun: '#9a6a3a',
    Skaros: '#4a3a6a',
    Lyllis: '#c5b878',
    Saelthine: '#7a8a9a',
    Vaerenth: '#5a8a7a',
    Trex: '#8a6a4a',
    Mynor: '#7a7a8a',
    Zevros: '#4a5a8a',
    Dravic: '#5a6a7a'
};

const PORTAL_LORE_NATION_CREST = {
    Vaelior: 'images/vaeliorcrest.png',
    Aesthene: 'images/aesthenecrest.png',
    Khaerant: 'images/khaerantcrest.png',
    Aethelgard: 'images/aethelgardcrest.png',
    Krall: 'images/krallcrest.png',
    Gorz: 'images/gorzcrest.png',
    Thruun: 'images/thruuncrest.png',
    Skaros: 'images/skaroscrest.png',
    Lyllis: 'images/lylliscrest.png',
    Saelthine: 'images/saelthinecrest.png',
    Vaerenth: 'images/vaerenthcrest.png',
    Trex: 'images/trexcrest.png',
    Mynor: 'images/mynorcrest.png',
    Zevros: 'images/zevroscrest.png',
    Dravic: 'images/draviccrest.png'
};

function resolvePortalLoreNationCrestSrc(nationName) {
    const crestPath = PORTAL_LORE_NATION_CREST[nationName];
    if (!crestPath) return '';
    return resolvePortalLoreAudioUrl(crestPath);
}

function buildPortalLoreNationCrestMarkup(nationName, imgClass) {
    const crestSrc = resolvePortalLoreNationCrestSrc(nationName);
    if (!crestSrc) return '';
    const safeSrc = escapePortalLoreHtml(crestSrc);
    const safeClass = escapePortalLoreHtml(imgClass);
    return `<img class="${safeClass}" src="${safeSrc}" alt="" loading="lazy" decoding="async" />`;
}

function escapePortalLoreHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const PORTAL_LORE_NATION_ARCHIVES = [
        { name: "Vaelior", audio: "audio/vaeliorhistory.mp3", detail: `Hailed far and wide as the sole surviving nation of the Aidoriian bloodline in all the lands of Amnek, the folk of Vaelior govern their days by the venerated customs and deep-rooted traditions of their forebears. Though their ways and ancient stonework may be hoary with age, they yet hold a high and honored station among kingdoms. Their grand city is a frequent pilgrimage for wanderers and sages, seeking knowledge of their history from ages before Amnek's foundation. Its thoroughfares are wrought with ancient majesty, inspiring in many a soul a powerful longing to walk once more in that bygone era. While this realm strives for peace and shuns the throes of conflict, its watchful guardians are ever mindful of the perils that lurk beyond the waves, and have laid many defenses should war's shadow darken their gates.` },
        { name: "Aesthene", audio: "audio/aesthenehistory.mp3", detail: `Aesthene stands as a sovereign realm, forged upon the singular pursuit of elemental mastery. In ages past, its founders broke away from the rigid tenets of the Aidoriian, whose strictures forbade the free and true deployment of sorcery. Thus, Aesthene was established as a hallowed sanctuary, dedicated to the deep and spiritual vow of attaining the pinnacle of arcane might, focused upon that specific, powerful branch known as Divine magic. Their great design was to raise a fortress so formidable that no hostile force might breach its walls. Having endured countless sieges and assaults from their less-than-neighborly rivals, Aesthene has, over the long years, rightfully earned the mantle of the mightiest defensive nation across the whole of Amnek.` },
        { name: "Khaerant", audio: "audio/khaeranthistory.mp3", detail: `The nation of Khaerant is held by many to be naught but a dictatorship, albeit one reformed from the legacy of the Aidoriian rule. Its founding lords deemed the decrees of Old Aidoriia too feeble and did establish a realm governed by iron-willed, stricter tenets. Due to great discord among the Aidoriian council, these founders seceded from the Aidoriian Alliance to claim Khaerant as their sovereign domain. Though the royal coffers overflow with immense wealth, the realm's rigid laws oft prove an intolerable burden upon those subjects who take up residence within its borders. Yet, dark whispers persist of hidden subterranean labor pits, where the vanished toil to mend some unexplained shortfall in the treasury's accounts. Few souls dare voice these troubling tales, for the Sovereign's Host is equipped with the finest weapons and armor gold can procure, and the full extent of the treasury's employment is shrouded in dread. To entertain such sensitive whispers is known to bring swift disappearance without a trace.` },
        { name: "Aethelgard", audio: "audio/aethelgardhistory.wav", detail: `The sovereign dominion of Aethelgard is ensconced deep within the heart of Oracle Mountain, a sanctuary veiled entirely from the world beyond by a perpetual, dense wood. The preservation of their solitude is held as their highest law, and thus have many—be they bold adventurers, weary travelers, cunning merchants, warring clans, or desperate brigands—sought to pierce its silent borders. So relentless are these incursions, aimed at glimpsing the arcane facilities sheltered within, that the nation’s wise leaders have expanded their reach establishing far-flung outposts to apprehend and deter trespassers long before they may threaten the inner sanctums. Aethelgard is a commonwealth comprised chiefly of venerable scholars, devoted to the great pursuit of knowledge, and the steadfast families who sustain their esoteric work. The rites and practices conducted within their national boundaries remain an enigma to all outsiders; yet, despite countless attempts, no soul or siege-ready host has ever succeeded in breaching their formidable defenses to uncover the profound secrets held deep within their stone halls. Nevertheless, ancient chronicles speak of forgotten carvings discovered in the caverns at the mountain’s base, which depict scenes dating back to the planet’s first Great Transition. This lore fuels the suspicion that Aethelgard’s scholars have unearthed some profound relic or truth intrinsically linked to those most ancient of texts.` },
        { name: "Krall", audio: "audio/krallhistory.mp3", detail: `Verily, the Krall are numbered amongst the few nations which, by many accounts, have fallen into a state of decline since the golden age of Aidoriian law. 'Tis held by common assent that this dismal descent stems from a dark seed of outsiders, men whose only desires were a life steeped in perilous thrill and whom held little regard for the welfare of their fellows. Their very creed is to drown the lands in gore and sorrow, thus wreaking utter devastation upon all farthest reaches of Amnek. Though they bear the visage of mere brutes, let no one mistake their savagery for a want of keen wit. Their merciless and unforgiving spirit renders them oft-unpredictable, a fearsome boon against those armies that seek to govern chaos with strict order. Furthermore, these grim fiends possess a terror so profound they compel captured warriors to turn their blades upon their own brethren on the field of battle, finding wicked sport in every agonizing moment of the prisoners' torment.` },
        { name: "Gorz", audio: "audio/gorzhistory.mp3", detail: `A realm forged in pure malice and heedless of the sacred laws of man, Gorz is justly branded as Satan’s very Throne. This vile land, a nest to every manner of degenerate filth, yet endures only through its frightful craft of bending the will of corrupt nobles and state officials, thus turning away all righteous crusades against this odious society. Even the guards who stand watch over this domain are foul and hellish, battling with a savage fury as if their very souls were gripped by the Fiend.` },
        { name: "Thruun", audio: "audio/thruunhistory.mp3", detail: `In a place where explicit unending entertainment and deep-seeded corruption run unfettered and widespread doth flourish the nation of Thruun. It is whispered that Thruun harbors all manner of suspect souls: from the common peasant seeking fleeting, carnal pleasure, to the dishonest merchant who preys upon the destitute for his own gain, and even the cunning lord who schemes and plots, using vile means to advance his station. Verily, Thruun is nought but a boundless revelry, filled with folk who heed not the righteous conduct of war, nor the well-being of any save their own. Such is the tumult of their society that many a host hath sought to utterly cleanse Amnek of their presence. Yet, they are a treacherous realm, possessing the wealth to purchase the loyalty of defenders whose might far exceeds that of the ordinary fighting man. Though they possess no true invincibility, they are as unyielding and fierce as the folk of Krall, and as utterly vile as the denizens of Gorz.` },
        { name: "Skaros", audio: "audio/skaroshistory.mp3", detail: `For generations past, Skaros hath been branded a dominion of black cults and devil-worshippers, whose foulest sorcery is bent upon dragging Amnek into the dread, shrieking void of eternal night. 'Tis a cursed realm, whose people revile the sacred light of the spirit, and whose priests practice dark rites to blight other kingdoms and bring forth their ruin. Three-quarters of the children born beneath that forsaken sky are forced into the hidden shrines of the Devil's servants in their tender years. Their schooling in the dark arts is savage and yields no mercy. Though Skaros commands many sorts of warriors to their defense, these men fight not of their own accord, and are but chattel—mere pawns set against the veiled fiends bred within the borders of that unholy land.` },
        { name: "Lyllis", audio: "audio/lyllishistory.mp3", detail: `Regarded as the celestial light to Skaros’s shadow, the sovereign realm of Lyllis is dedicated to the preservation of a pristine spirit and the pursuit of divine transcendence. In their hubris or holy conviction, they style themselves as gods, professing a mandate from the heavens to restore the world to its primordial state. Yet, their sacred rites are whispered to be severe and unsettling. Their singular crusade is to cleanse the realm of all blemish and usher in the next Great Transition, a cleansing tide they believe shall scour all malice from the earth. Though they seldom forge alliances or declare open enmity, they are masters of subtle manipulation, bending the wills of other nations to serve their own inscrutable designs. Those few who have looked upon the folk of Lyllis speak of an unnerving chill, describing an encounter with beings who seem to have transcended the very essence of humanity.` },
        { name: "Saelthine", audio: "audio/saelthinehistory.mp3", detail: `The realm of Saelthine is steeped in piety, its people devoted utterly to a singular Divine entity, rejecting the folly of lesser deities or the blasphemous notion that mortals might ascend to godhood. Though on the surface they appear as common folk, their society thrives upon the close embrace of many unique cultures and ancient customs, which they eagerly study and share in turn. The sagas and chronicles attest that Saelthine ever lends its strength to those who champion righteous order, standing firm against the wild and chaotic tides that plague the mortal coil. Yet, it is whispered among those who seek the obscured truths that the heart of Saelthine holds secrets and veiled matters that stir great curiosity and raise a host of unanswered questions.` },
        { name: "Vaerenth", audio: "audio/vaerenthhistory.mp3", detail: `Vaerenth is a nation where the worship of manifold deities is practiced, and where a potent, ancient order of elder priests holds sway. These priests offer succor and aid to those in distress, but only if it aligns with the divine will of their pantheon, and only when a suitable recompense is rendered for their sacred works. It is said that the most ancient priests of Vaerenth, alone among all nations, are blessed with lives that stretch far beyond the common span of men, even for their own kin. Indeed, countless travelers bear witness that the populace of this kingdom doth partake in a longevity surpassing that of the average mortal. Whilst this grace has sown seeds of disquiet amongst some neighboring realms, many souls have yearned to claim residency in Vaerenth, drawn only by the whisper of these enduring lifespans. Yet, Vaerenth is known to guard its boundaries fiercely, granting permanent residency only to a select and chosen few. This stricture hath bred confusion and deep suspicion, prompting many to ponder what hidden mysteries lie within the heart of this secluded nation.` },
        { name: "Trex", audio: "audio/trexhistory.mp3", detail: `Having disciplined themselves from dawn till dusk, braving the infernal heats of summer and the treacherous grip of winter's chill, the lineage of Trex has, across countless seasons, sired a progeny of unbreakable spirit. Their principal quest is the preservation of a hale and steadfast essence: in body, mind, and soul. Their deeds—to march, ascend, toil, and clash in battle for days without respite—bear powerful testament to their fervent vow and unwavering resolve in the pursuit of their aims. When the trumpets of war are silent, when their journeys cross the breadth of the realm, and even in moments of brief solace from the rapacious shadow of conflict, still do they hone their skills; ever preparing for the sudden, unforeseen threat that may arise.` },
        { name: "Mynor", audio: "audio/mynorhistory.mp3", detail: `Following the Great Transition, this nation was claimed and given a new name by a guild of master Artificers and wise Scholars who desired the might and bounty of precise craft and ingenious workings. The Mynoran nation charted a course for their future, ensuring they might withstand any threat crossing their boundaries. Knowing full well the perils that yet stalked the lands of Amnek were dire indeed, and possessing no mastery of the arcane arts, they dedicated themselves to the study and mastery of combining the earth's base elements with the immutable laws of nature. Thus, they crafted great mechanisms that served as a mighty bulwark against any invader. Though they may not rush to battle with the same zeal as their neighbors, they hold confidence that their masterful creations shall endure and prevail against the ravages of any prolonged conflict, should they choose to take part.` },
        { name: "Zevros", audio: "audio/zevroshistory.mp3", detail: `Behold Zevros, a true res publica whose citizens have consecrated their very existence to the grand pursuit of binding all kingdoms under a single, mighty banner, ruled by a High Echelon of government that guides their populace with wisdom and iron will. Their fealty to this sacred cause is manifest in their colossal legions and their peerless mastery of martial strategy. Three immutable virtues govern their society: Honour, Valor, and Liberty. The Honour of drawing the sword to shield all that they hold dear, and the glorious esteem gained by yielding one's breath upon the field that others may draw theirs. The boundless Valor born of courage, fortitude, and the steadfast resolve to mend a world grievously fractured by discord. Lastly, the march forward, knowing that the Liberty secured through ceaseless conquest shall grant every man and woman a life worthy of song and dream.` },
        { name: "Dravic", audio: "audio/dravichistory.mp3", detail: `The nation of Dravic, revered as the elder kin to Aesthene, stands as a sovereign kingdom of unparalleled fortitude. Across the breadth of its domain, the very earth is woven with formidable bulwarks and hidden ballistae, forged into the bedrock to repel any foe from field or sky. Dubbed the "Watchful Eye" in the chronicles of old, Dravic possesses the uncanny power to turn the tides of war from behind its seamless, unbreachable walls. For generations, these ramparts have served as a sanctuary for those fleeing the storms of conflict, a role they fulfill even in this present age. Yet, whispers have recently stirred regarding spectral shadows lurking near the ancient mechanisms that sustain the kingdom's soaring foundations. These tales, however, are cast aside by the lords of the land, for no hand can be found to blame for such phantoms.` }
];

function getPortalLoreNationArchives() {
    return PORTAL_LORE_NATION_ARCHIVES;
}

function buildPortalLoreNationId(name) {
    return String(name || '').trim().toLowerCase().replace(/\s+/g, '-');
}

function buildPortalLoreNationEpithet(detail) {
    const text = String(detail || '').trim();
    if (!text) return '';
    const sentenceEnd = text.search(/[.!?](\s|$)/);
    const snippet = sentenceEnd > 40 && sentenceEnd < 160
        ? text.slice(0, sentenceEnd + 1)
        : text.slice(0, 120);
    return snippet.length < text.length ? `${snippet.trim()}…` : snippet.trim();
}

function getPortalLoreNarrationBaseVolume() {
    return 1;
}

function readStoredPortalGain(primaryKey, secondaryKey, fallback) {
    const primary = parseFloat(localStorage.getItem(primaryKey));
    if (Number.isFinite(primary)) return primary;
    const secondary = parseFloat(localStorage.getItem(secondaryKey));
    if (Number.isFinite(secondary)) return secondary;
    return fallback;
}

function resolvePortalLoreAudioUrl(relativePath) {
    const path = String(relativePath || '').trim().replace(/^\//, '');
    if (!path) return '';
    const origin = window.location.origin;
    if (origin && origin !== 'null') {
        return `${origin}/${path}`;
    }
    try {
        return new URL(path, window.location.href).href;
    } catch (err) {
        return path;
    }
}

function getPortalLoreNarrationAudioElement() {
    return document.getElementById('portal-lore-narration-audio');
}

function resolvePortalLoreNarrationGain(nationName) {
    const master = Number.isFinite(currentPortalMasterVol)
        ? currentPortalMasterVol
        : readStoredPortalGain('savedPortalMasterVol', 'savedMasterVol', 1);
    const narration = Number.isFinite(currentPortalNarrationVol)
        ? currentPortalNarrationVol
        : readStoredPortalGain('savedPortalNarrationVol', 'savedNarrationVol', 1);
    const gain = getPortalLoreNarrationBaseVolume() * narration * master;
    return Math.min(1, Math.max(0, gain));
}

function applyPortalLoreNarrationVolume(nationName) {
    const narrationEl = getPortalLoreNarrationAudioElement();
    if (!narrationEl || !nationName) return;
    narrationEl.volume = resolvePortalLoreNarrationGain(nationName);
}

function cancelPortalLoreMusicRestoreFade() {
    if (portalLoreMusicRestoreFadeRaf != null) {
        cancelAnimationFrame(portalLoreMusicRestoreFadeRaf);
        portalLoreMusicRestoreFadeRaf = null;
    }
    portalLoreMusicRestoreFadeActive = false;
}

function easePortalMusicRestore(t) {
    return 1 - Math.pow(1 - t, 3);
}

function beginPortalLoreNarrationMusicDuck() {
    cancelPortalLoreMusicRestoreFade();
    portalLoreMusicDuckActive = true;
    if (typeof applyPortalBackgroundMusicVolume === 'function') {
        applyPortalBackgroundMusicVolume();
    }
}

function endPortalLoreNarrationMusicDuck() {
    if (!portalLoreMusicDuckActive) return;
    portalLoreMusicDuckActive = false;
    cancelPortalLoreMusicRestoreFade();

    const bgMusic = typeof getPortalBackgroundAudioElement === 'function'
        ? getPortalBackgroundAudioElement()
        : null;
    if (!bgMusic || typeof resolvePortalBackgroundMusicGain !== 'function') {
        if (typeof applyPortalBackgroundMusicVolume === 'function') {
            applyPortalBackgroundMusicVolume();
        }
        return;
    }

    const startVol = bgMusic.volume;
    const targetVol = resolvePortalBackgroundMusicGain();
    if (Math.abs(startVol - targetVol) < 0.005) {
        if (typeof applyPortalBackgroundMusicVolume === 'function') {
            applyPortalBackgroundMusicVolume();
        }
        return;
    }

    portalLoreMusicRestoreFadeActive = true;
    const fadeStart = performance.now();

    function stepFade(now) {
        const elapsed = now - fadeStart;
        const progress = Math.min(1, elapsed / PORTAL_LORE_NARRATION_MUSIC_RESTORE_MS);
        bgMusic.volume = startVol + (targetVol - startVol) * easePortalMusicRestore(progress);

        if (progress < 1) {
            portalLoreMusicRestoreFadeRaf = requestAnimationFrame(stepFade);
            return;
        }

        cancelPortalLoreMusicRestoreFade();
        if (typeof applyPortalBackgroundMusicVolume === 'function') {
            applyPortalBackgroundMusicVolume();
        }
    }

    portalLoreMusicRestoreFadeRaf = requestAnimationFrame(stepFade);
}

function stopPortalLoreNarration() {
    const previousNationId = portalLoreActiveNationId;
    const narrationEl = getPortalLoreNarrationAudioElement();
    if (narrationEl) {
        narrationEl.pause();
        narrationEl.currentTime = 0;
        narrationEl.removeAttribute('src');
        narrationEl.load();
    }
    portalLoreNarrationAudio = null;
    portalLoreNarrationPlaying = false;
    endPortalLoreNarrationMusicDuck();
    if (previousNationId) syncPortalLoreAudioButtonState(previousNationId);
}

function syncPortalLoreAudioButtonState(nationId) {
    const isPlaying = portalLoreNarrationPlaying && portalLoreActiveNationId === nationId;
    const btn = document.getElementById('lore-reader-audio-btn');
    if (!btn) return;
    const icon = btn.querySelector('.lore-audio-play-icon');
    btn.classList.toggle('is-playing', isPlaying);
    if (icon) icon.textContent = isPlaying ? '■' : '▶';
    btn.setAttribute('aria-label', isPlaying ? 'Stop nation history' : 'Play nation history');
}

async function togglePortalLoreNarration(nationId) {
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();

    const archives = getPortalLoreNationArchives();
    const nation = archives.find((entry) => buildPortalLoreNationId(entry.name) === nationId);
    if (!nation || !nation.audio) {
        if (typeof showPortalAlert === 'function') {
            await showPortalAlert('No narration audio is available for this nation.', 'Lore audio');
        }
        return;
    }

    if (portalLoreNarrationPlaying && portalLoreActiveNationId === nationId) {
        stopPortalLoreNarration();
        return;
    }

    const narrationEl = getPortalLoreNarrationAudioElement();
    if (!narrationEl) {
        if (typeof showPortalAlert === 'function') {
            await showPortalAlert('Lore audio player is missing from the page. Hard-refresh and try again.', 'Lore audio');
        }
        return;
    }

    if (portalLoreNarrationPlaying) {
        stopPortalLoreNarration();
    }

    portalLoreActiveNationId = nationId;
    const audioUrl = resolvePortalLoreAudioUrl(nation.audio);

    narrationEl.pause();
    narrationEl.currentTime = 0;
    narrationEl.src = audioUrl;
    narrationEl.volume = resolvePortalLoreNarrationGain(nation.name);
    narrationEl.onended = () => {
        portalLoreNarrationPlaying = false;
        portalLoreNarrationAudio = null;
        endPortalLoreNarrationMusicDuck();
        syncPortalLoreAudioButtonState(nationId);
    };

    beginPortalLoreNarrationMusicDuck();

    try {
        await narrationEl.play();
        portalLoreNarrationPlaying = true;
        portalLoreNarrationAudio = narrationEl;
        sessionStorage.setItem('royalArmiesAuthAudioPlay', 'granted');
        syncPortalLoreAudioButtonState(nationId);
    } catch (err) {
        console.warn('Lore narration could not play:', err);
        stopPortalLoreNarration();
        if (typeof showPortalAlert === 'function') {
            await showPortalAlert(
                'Could not play nation narration. Check Voice & Narration volume in Audio settings, then click Listen again.',
                'Lore audio'
            );
        }
    }
}

function buildPortalLoreReaderPanelMarkup(nation) {
    if (!nation) {
        return `
            <div class="lore-reader-empty-state">
                <span class="lore-reader-empty-glyph" aria-hidden="true">📜</span>
                <p>Select a nation from the codex to read its history and hear its chronicle.</p>
            </div>
        `;
    }

    const nationId = buildPortalLoreNationId(nation.name);
    const accent = PORTAL_LORE_NATION_ACCENT[nation.name] || '#b89030';
    const epithet = buildPortalLoreNationEpithet(nation.detail);
    const crestMarkup = buildPortalLoreNationCrestMarkup(nation.name, 'lore-reader-crest');

    return `
        <div class="lore-reader-content" style="--lore-nation-accent: ${accent};">
        <header class="lore-reader-header">
            <div class="lore-reader-sigil-ring" aria-hidden="true">${crestMarkup}</div>
            <div class="lore-reader-title-stack">
                <span class="lore-reader-eyebrow">Nation chronicle</span>
                <h2 class="lore-reader-nation-name">${escapePortalLoreHtml(nation.name)}</h2>
                <p class="lore-reader-epithet">${escapePortalLoreHtml(epithet)}</p>
            </div>
            <button
                type="button"
                id="lore-reader-audio-btn"
                class="lore-audio-play-btn"
                aria-label="Play nation history"
                onclick="togglePortalLoreNarration('${nationId}')"
            >
                <span class="lore-audio-play-icon" aria-hidden="true">▶</span>
                <span class="lore-audio-play-label">Listen</span>
            </button>
        </header>
        <div class="lore-reader-divider" aria-hidden="true"></div>
        <div class="lore-reader-prose-scroll portal-gold-scrollbar">
            <p class="lore-reader-prose">${escapePortalLoreHtml(nation.detail)}</p>
        </div>
        </div>
    `;
}

function updatePortalLoreNationMobileTrigger(nation) {
    const sigilSlot = document.getElementById('lore-nation-mobile-trigger-sigil');
    const nameEl = document.getElementById('lore-nation-mobile-trigger-name');
    if (!nation || !sigilSlot || !nameEl) return;

    sigilSlot.innerHTML = buildPortalLoreNationCrestMarkup(nation.name, 'lore-nation-mobile-trigger-crest');
    nameEl.textContent = nation.name;

    document.querySelectorAll('.lore-nation-mobile-option').forEach((option) => {
        option.classList.toggle('is-active', option.getAttribute('data-nation-id') === buildPortalLoreNationId(nation.name));
    });
}

function closePortalLoreNationMobilePicker() {
    const picker = document.getElementById('lore-nation-mobile-picker');
    const options = document.getElementById('lore-nation-mobile-options');
    const trigger = document.getElementById('lore-nation-mobile-trigger');
    if (options) options.hidden = true;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    if (picker) picker.classList.remove('is-picker-open');
}

function togglePortalLoreNationMobilePicker(event) {
    if (event) event.stopPropagation();
    const options = document.getElementById('lore-nation-mobile-options');
    const trigger = document.getElementById('lore-nation-mobile-trigger');
    const picker = document.getElementById('lore-nation-mobile-picker');
    if (!options || !trigger) return;

    const willOpen = options.hidden;
    if (willOpen) {
        options.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        if (picker) picker.classList.add('is-picker-open');
    } else {
        closePortalLoreNationMobilePicker();
    }
}

function selectPortalLoreNationFromMobilePicker(nationId, event) {
    if (event) event.stopPropagation();
    closePortalLoreNationMobilePicker();
    if (!nationId) return;
    selectPortalLoreNation(nationId);
}

function bindPortalLoreNationMobilePickerDismiss() {
    if (window.portalLoreNationPickerDismissBound) return;
    window.portalLoreNationPickerDismissBound = true;
    document.addEventListener('click', (event) => {
        const picker = document.getElementById('lore-nation-mobile-picker');
        if (!picker || picker.classList.contains('is-picker-open') === false) return;
        if (picker.contains(event.target)) return;
        closePortalLoreNationMobilePicker();
    });
}

function selectPortalLoreNation(nationId) {
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();

    const archives = getPortalLoreNationArchives();
    const nation = archives.find((entry) => buildPortalLoreNationId(entry.name) === nationId);
    if (!nation) return;

    if (portalLoreActiveNationId && portalLoreActiveNationId !== nationId) {
        stopPortalLoreNarration();
    }
    portalLoreActiveNationId = nationId;

    document.querySelectorAll('.lore-nation-chip').forEach((chip) => {
        chip.classList.toggle('is-active', chip.getAttribute('data-nation-id') === nationId);
    });
    updatePortalLoreNationMobileTrigger(nation);

    const readerPanel = document.getElementById('lore-reader-panel');
    if (readerPanel) {
        readerPanel.innerHTML = buildPortalLoreReaderPanelMarkup(nation);
    }
}

window.selectPortalLoreNation = selectPortalLoreNation;
window.selectPortalLoreNationFromMobilePicker = selectPortalLoreNationFromMobilePicker;
window.togglePortalLoreNationMobilePicker = togglePortalLoreNationMobilePicker;
window.togglePortalLoreNarration = togglePortalLoreNarration;
window.stopPortalLoreNarration = stopPortalLoreNarration;

const CHRONICLE_XP_STORAGE_KEY = 'savedChronicleMeritProgress';
const CHRONICLE_XP_PROGRESS_VERSION = 2;

/** Success rarity tiers — game server or client rolls rarity, then XP is drawn from the action table. */
const CHRONICLE_XP_SUCCESS_RARITIES = {
    common: { label: 'Common', cssClass: 'chronicle-rarity-common' },
    uncommon: { label: 'Uncommon', cssClass: 'chronicle-rarity-uncommon' },
    rare: { label: 'Rare', cssClass: 'chronicle-rarity-rare' },
    epic: { label: 'Epic', cssClass: 'chronicle-rarity-epic' },
    legendary: { label: 'Legendary', cssClass: 'chronicle-rarity-legendary' }
};

/** Inclusive min/max Chronicle XP per action at each success rarity. */
const CHRONICLE_XP_BY_ACTIVITY_AND_RARITY = {
    cityBattles: {
        common: [14, 22],
        uncommon: [24, 34],
        rare: [38, 52],
        epic: [55, 72],
        legendary: [80, 110]
    },
    pvpAttacks: {
        common: [8, 14],
        uncommon: [14, 22],
        rare: [24, 34],
        epic: [38, 50],
        legendary: [55, 75]
    },
    loreDiscoveries: {
        common: [10, 18],
        uncommon: [18, 28],
        rare: [32, 44],
        epic: [48, 64],
        legendary: [72, 98]
    }
};

const CHRONICLE_ACTIVITY_META = [
    { key: 'cityBattles', label: 'City battles', icon: '🏛️', hint: 'Join siege or defense of a city on the map' },
    { key: 'pvpAttacks', label: 'PvP combat', icon: '⚔️', hint: 'Attack another commander in open PvP' },
    { key: 'loreDiscoveries', label: 'Lore discoveries', icon: '📜', hint: 'Find hidden chronicle lore scattered on the map' }
];

const CHRONICLE_LEVEL_EPITHETS = [
    'Ledger Initiate', 'Field Observer', 'Skirmish Scribe', 'Banner Chronicler', 'Siege Witness',
    'Duel Scribe', 'Lore Seeker', 'War Archivist', 'Vanguard Scribe', 'Battle Cantor',
    'Citadel Herald', 'PvP Annotator', 'Relic Hunter', 'Frontline Archivist', 'War-Chronicle Knight',
    'High Scribe', 'Siege Laureate', 'Bloodfield Historian', 'Mapward Sage', 'Grand Chronicler',
    'Iron Quill', 'Bastion Keeper', 'Rivalry Scribe', 'Hidden Lore Walker', 'Siege Chronicler',
    'Warband Archivist', 'Duelist Laureate', 'Codex Pathfinder', 'Citadel Loremaster', 'Chronicle Vanguard',
    'Frontline Sovereign', 'PvP High Scribe', 'Relic Sovereign', 'Siege Archon', 'Lorebound Knight',
    'War Sage', 'Battle Archivist', 'Map Legend', 'Citadel Paragon', 'Chronicle Warlord',
    'Grand Mapwarden', 'High Lorekeeper', 'Siege Paragon', 'Bloodfield Sovereign', 'Relic Archon',
    'Chronicle Ascendant', 'Amnek Witness', 'Age Chronicler', 'War of Ages Scribe', 'Eternal Loremaster',
    'Chronicle Apex'
];

const CHRONICLE_LEVEL_XP_THRESHOLDS = (function buildChronicleLevelXpThresholds() {
    const thresholds = [0];
    for (let level = 2; level <= CHRONICLE_TIER_MAX_LEVEL; level += 1) {
        thresholds.push(Math.round(28 * Math.pow(level - 1, 1.62)));
    }
    return thresholds;
})();

const CHRONICLE_BASIC_TIER_REWARDS_BY_RANK = {
    5: { title: 'Scout\'s Crest Frame', reward: 'Profile avatar border — bronze filigree', state: 'locked' },
    10: { title: 'Quartermaster Stipend', reward: '+5% provision cap while enrolled in an Age', state: 'locked' },
    15: { title: 'War Table Emote Pack I', reward: 'Three commander salute animations for chat', state: 'locked' },
    18: { title: 'Campaign Pennant', reward: 'Nation-colored pennant on your public profile card', state: 'locked' },
    22: { title: 'Lord-High Commendation', reward: 'Exclusive title flair and silver nameplate trim', state: 'locked' },
    25: { title: 'Veteran\'s March Pennant', reward: 'Animated campaign streamer on your public dossier', state: 'locked' },
    30: { title: 'War Table Emote Pack II', reward: 'Six additional tactical salute animations for chat', state: 'locked' },
    35: { title: 'Expeditioner\'s Kit', reward: '+8% march readiness bonus while enrolled in an Age', state: 'locked' },
    40: { title: 'Silver Commendation Frame', reward: 'Animated silver avatar border and chronicle ribbon', state: 'locked' },
    45: { title: 'High Command Insignia', reward: 'Exclusive commander insignia slot on your profile card', state: 'locked' },
    50: { title: 'Chronicle Apex — Agebringer', reward: 'Legendary title flair, gold nameplate trim, and codex portrait frame', state: 'locked' }
};

const CHRONICLE_PREMIUM_TIER_REWARDS_BY_RANK = {
    5: { title: 'Gilded Chronicle Frame', reward: 'Animated gold avatar border for your commander dossier', state: 'locked' },
    10: { title: 'Royal Courier Slots', reward: '+3 extra recipients per outbound message while subscribed', state: 'locked' },
    15: { title: 'Premium War Table Emotes', reward: 'Six exclusive salute and victory animations for chat', state: 'locked' },
    18: { title: 'Sovereign Banner Overlay', reward: 'Animated nation banner backdrop on your profile', state: 'locked' },
    22: { title: 'Crownwright\'s Laurels', reward: 'Golden nameplate glow, crown flair, and premium chat badge', state: 'locked' },
    25: { title: 'Royal Vanguard Pennant', reward: 'Animated gold campaign streamer on your public dossier', state: 'locked' },
    30: { title: 'Premium Emote Pack II', reward: 'Twelve exclusive Royalty salute and victory animations', state: 'locked' },
    35: { title: 'Crown Provision Edict', reward: '+12% resource generation while Royalty is active', state: 'locked' },
    40: { title: 'Sovereign Portrait Frame', reward: 'Animated royal portrait frame and crown chat badge tier II', state: 'locked' },
    45: { title: 'Imperial Command Crest', reward: 'Exclusive animated crest slot on your commander dossier', state: 'locked' },
    50: { title: 'Royal Chronicle Apex', reward: 'Supreme crown flair, radiant nameplate, and Royalty codex portrait frame', state: 'locked' }
};

function getChronicleTierRewardsByRankMap(trackKey) {
    return trackKey === 'premium' ? CHRONICLE_PREMIUM_TIER_REWARDS_BY_RANK : CHRONICLE_BASIC_TIER_REWARDS_BY_RANK;
}

function getChronicleTierRewardEntry(rank, trackKey) {
    if (trackKey === 'basic' && rank === 1) return null;
    const reward = getChronicleTierRewardsByRankMap(trackKey)[rank];
    if (!reward) return null;
    return { rank, ...reward };
}

function getChronicleTierLevelTitle(level) {
    return CHRONICLE_LEVEL_EPITHETS[Math.min(Math.max(level, 1), CHRONICLE_LEVEL_EPITHETS.length) - 1]
        || `Level ${level}`;
}

function readChronicleXpProgressRaw() {
    try {
        const stored = localStorage.getItem(CHRONICLE_XP_STORAGE_KEY);
        if (!stored) return null;
        return JSON.parse(stored);
    } catch (err) {
        return null;
    }
}

function createEmptyChronicleXpProgress() {
    const byActivity = {};
    CHRONICLE_ACTIVITY_META.forEach(({ key }) => {
        byActivity[key] = { actions: 0, xp: 0 };
    });
    return { version: CHRONICLE_XP_PROGRESS_VERSION, totalXp: 0, byActivity, lastGain: null };
}

function normalizeChronicleSuccessRarity(rarityKey) {
    const key = String(rarityKey || 'common').toLowerCase();
    return CHRONICLE_XP_SUCCESS_RARITIES[key] ? key : 'common';
}

function rollChronicleXpFromRange(range) {
    const min = Math.min(range[0], range[1]);
    const max = Math.max(range[0], range[1]);
    return min + Math.floor(Math.random() * (max - min + 1));
}

function resolveChronicleXpRange(activityKey, rarityKey) {
    const activityTable = CHRONICLE_XP_BY_ACTIVITY_AND_RARITY[activityKey];
    if (!activityTable) return [0, 0];
    const rarity = normalizeChronicleSuccessRarity(rarityKey);
    return activityTable[rarity] || activityTable.common || [0, 0];
}

function rollChronicleXpForAction(activityKey, rarityKey) {
    return rollChronicleXpFromRange(resolveChronicleXpRange(activityKey, rarityKey));
}

function formatChronicleXpRangeLabel(range) {
    const min = Math.min(range[0], range[1]);
    const max = Math.max(range[0], range[1]);
    return min === max ? `${min}` : `${min}–${max}`;
}

function normalizeChronicleXpProgress(raw) {
    if (!raw || typeof raw !== 'object' || raw.version !== CHRONICLE_XP_PROGRESS_VERSION) {
        return createEmptyChronicleXpProgress();
    }

    if (Number.isFinite(raw.totalXp) && raw.byActivity && typeof raw.byActivity === 'object') {
        const normalized = createEmptyChronicleXpProgress();
        normalized.totalXp = Math.max(0, Math.round(raw.totalXp));
        CHRONICLE_ACTIVITY_META.forEach(({ key }) => {
            const bucket = raw.byActivity[key];
            if (!bucket || typeof bucket !== 'object') return;
            normalized.byActivity[key].actions = Math.max(0, parseInt(bucket.actions, 10) || 0);
            normalized.byActivity[key].xp = Math.max(0, parseInt(bucket.xp, 10) || 0);
        });
        if (raw.lastGain && typeof raw.lastGain === 'object') {
            normalized.lastGain = raw.lastGain;
        }
        normalized.totalXp = CHRONICLE_ACTIVITY_META.reduce(
            (sum, { key }) => sum + (normalized.byActivity[key].xp || 0),
            0
        );
        return normalized;
    }

    return createEmptyChronicleXpProgress();
}

function resetChronicleXpProgress() {
    persistChronicleXpProgress(createEmptyChronicleXpProgress());
    const snapshot = getCommanderChronicleProgressSnapshot();
    if (typeof refreshChronicleRewardsTrackPanels === 'function') {
        refreshChronicleRewardsTrackPanels();
    }
    refreshChronicleProgressHeader(snapshot);
    return snapshot;
}

function persistChronicleXpProgress(progress) {
    const normalized = normalizeChronicleXpProgress(progress);
    localStorage.setItem(CHRONICLE_XP_STORAGE_KEY, JSON.stringify(normalized));
    if (typeof scheduleCommanderDossierSave === 'function') {
        scheduleCommanderDossierSave({ chronicleXp: normalized });
    }
}

function resolveChronicleLevelFromXp(totalXp) {
    let level = 1;
    for (let candidate = 2; candidate <= CHRONICLE_TIER_MAX_LEVEL; candidate += 1) {
        if (totalXp >= CHRONICLE_LEVEL_XP_THRESHOLDS[candidate - 1]) {
            level = candidate;
        }
    }
    return level;
}

function getCommanderChronicleProgressSnapshot() {
    const progress = normalizeChronicleXpProgress(readChronicleXpProgressRaw());
    const totalXp = Math.max(0, progress.totalXp || 0);
    const currentLevel = resolveChronicleLevelFromXp(totalXp);
    const floorXp = CHRONICLE_LEVEL_XP_THRESHOLDS[currentLevel - 1] || 0;
    const ceilingXp = currentLevel >= CHRONICLE_TIER_MAX_LEVEL
        ? floorXp
        : (CHRONICLE_LEVEL_XP_THRESHOLDS[currentLevel] || floorXp);
    const xpInLevel = Math.max(0, totalXp - floorXp);
    const spanToNext = Math.max(1, ceilingXp - floorXp);
    const xpToNextLevel = currentLevel >= CHRONICLE_TIER_MAX_LEVEL ? 0 : spanToNext;
    const progressPct = currentLevel >= CHRONICLE_TIER_MAX_LEVEL
        ? 100
        : Math.min(100, Math.round((xpInLevel / xpToNextLevel) * 100));
    const levelEpithet = getChronicleTierLevelTitle(currentLevel);

    const activities = CHRONICLE_ACTIVITY_META.map((meta) => {
        const bucket = progress.byActivity[meta.key] || { actions: 0, xp: 0 };
        return {
            ...meta,
            count: bucket.actions || 0,
            xp: bucket.xp || 0
        };
    });

    return {
        progress,
        totalXp,
        totalMerit: totalXp,
        currentLevel,
        levelEpithet,
        xpInLevel,
        meritInLevel: xpInLevel,
        xpToNextLevel,
        meritToNextLevel: xpToNextLevel,
        progressPct,
        activities,
        lastGain: progress.lastGain || null,
        isMaxLevel: currentLevel >= CHRONICLE_TIER_MAX_LEVEL
    };
}

/**
 * Grant Chronicle tier XP from an in-game action.
 * @param {string} activityKey - cityBattles | pvpAttacks | loreDiscoveries
 * @param {object} [options]
 * @param {string} [options.rarity] - common | uncommon | rare | epic | legendary (success rarity)
 * @param {number} [options.xp] - exact XP from server (skips roll when set)
 * @param {number} [options.amount=1] - how many actions to record
 * @returns {{ snapshot: object, xpGained: number, rarity: string }}
 */
function recordChronicleXp(activityKey, options = {}) {
    if (isCommanderExcludedFromChronicleTiers()) {
        return { snapshot: getCommanderChronicleProgressSnapshot(), xpGained: 0, rarity: 'common' };
    }
    if (!CHRONICLE_XP_BY_ACTIVITY_AND_RARITY[activityKey]) {
        return { snapshot: getCommanderChronicleProgressSnapshot(), xpGained: 0, rarity: 'common' };
    }

    const progress = normalizeChronicleXpProgress(readChronicleXpProgressRaw());
    const rarity = normalizeChronicleSuccessRarity(options.rarity);
    const actionCount = Math.max(1, parseInt(options.amount, 10) || 1);
    let xpGained = 0;

    if (Number.isFinite(options.xp)) {
        xpGained = Math.max(0, Math.round(options.xp));
    } else {
        for (let i = 0; i < actionCount; i += 1) {
            xpGained += rollChronicleXpForAction(activityKey, rarity);
        }
    }

    progress.byActivity[activityKey].actions += actionCount;
    progress.byActivity[activityKey].xp += xpGained;
    progress.totalXp += xpGained;
    progress.lastGain = {
        activityKey,
        rarity,
        xp: xpGained,
        actions: actionCount,
        at: Date.now()
    };

    persistChronicleXpProgress(progress);
    const snapshot = getCommanderChronicleProgressSnapshot();
    if (typeof refreshChronicleRewardsTrackPanels === 'function') {
        refreshChronicleRewardsTrackPanels();
    }
    refreshChronicleProgressHeader(snapshot);
    return { snapshot, xpGained, rarity };
}

function recordChronicleActivity(activityKey, options = {}) {
    if (typeof options === 'number') {
        return recordChronicleXp(activityKey, { amount: options, rarity: 'common' }).snapshot;
    }
    return recordChronicleXp(activityKey, options).snapshot;
}

function isChronicleBasicTierStartingLevel(level) {
    return level === 1;
}

function isChronicleTierLevelReached(level, trackKey) {
    if (trackKey === 'basic' && isChronicleBasicTierStartingLevel(level)) return false;
    const { currentLevel } = getCommanderChronicleProgressSnapshot();
    return currentLevel >= level;
}

function isChronicleRewardUnlocked(entry, trackKey) {
    if (isCommanderExcludedFromChronicleTiers()) return false;
    const levelMet = isChronicleTierLevelReached(entry.rank, trackKey);
    if (trackKey === 'premium' && !isCommanderRoyaltyMember()) return false;
    return levelMet && entry.state === 'unlocked';
}

function isChronicleRewardEligible(entry, trackKey) {
    if (isCommanderExcludedFromChronicleTiers()) return false;
    if (!isChronicleTierLevelReached(entry.rank, trackKey)) return false;
    if (trackKey === 'premium' && !isCommanderRoyaltyMember()) return false;
    return entry.state !== 'unlocked';
}

let activeChronicleRewardsTrack = 'basic';

function buildChronicleXpEarnedExplanationMarkup() {
    return `
        <div class="chronicle-xp-rules-deck">
            <p class="chronicle-xp-rules-lead">
                Battle Pass XP is earned in Ages — <strong>city battles</strong>, <strong>PvP</strong>, <strong>map lore</strong>,
                and other world actions. Payouts depend on the activity and your success tier; exact amounts are not listed here.
            </p>
        </div>
    `;
}

function buildChronicleMilestoneCardMarkup(entry, trackKey) {
    const ownerExempt = isCommanderExcludedFromChronicleTiers();
    const unlocked = isChronicleRewardUnlocked(entry, trackKey);
    const eligible = isChronicleRewardEligible(entry, trackKey);
    const premiumLocked = !ownerExempt && trackKey === 'premium' && !isCommanderRoyaltyMember();
    const statusLabel = ownerExempt
        ? 'Owner'
        : (unlocked
        ? 'Claimed'
        : (eligible ? 'Eligible' : (premiumLocked ? 'Royalty' : 'Locked')));
    const statusClass = ownerExempt
        ? 'status-owner-exempt-tag'
        : (unlocked
        ? 'status-unlocked-text-tag'
        : (eligible ? 'status-eligible-text-tag' : (premiumLocked ? 'status-premium-required-tag' : 'status-locked-text-tag')));
    const levelTitle = getChronicleTierLevelTitle(entry.rank);

    return `
        <div class="milestone-landmark-capsule-card milestone-landmark-has-reward ${unlocked ? 'landmark-node-unlocked' : 'landmark-node-locked'} ${premiumLocked ? 'landmark-node-premium-gated' : ''} ${ownerExempt ? 'landmark-node-owner-exempt' : ''}">
            <span class="milestone-badge-hexagon-icon" aria-hidden="true">${trackKey === 'premium' ? '👑' : '✦'}</span>
            <div class="milestone-meta-contents">
                <span class="milestone-tier-level-label">Level ${entry.rank} · ${levelTitle}${trackKey === 'premium' ? ' · Premium' : ''}</span>
                <span class="milestone-title-string">${entry.title}</span>
                <p class="milestone-reward-description-text">${entry.reward}</p>
                ${ownerExempt ? `<p class="milestone-premium-hint">${CHRONICLE_BATTLE_PASS_HEADING} passes do not apply to site owner accounts.</p>` : ''}
                ${premiumLocked ? `<p class="milestone-premium-hint">Requires <strong>Royalty</strong> membership (${CHRONICLE_PREMIUM_MONTHLY_PRICE_LABEL}) — unlock on the Royalty page.</p>` : ''}
            </div>
            <span class="milestone-status-action-deck ${statusClass}">${statusLabel}</span>
        </div>
    `;
}

function buildChronicleLevelPassthroughMarkup(level, trackKey) {
    const ownerExempt = isCommanderExcludedFromChronicleTiers();
    const isBasicStart = trackKey === 'basic' && isChronicleBasicTierStartingLevel(level);
    const levelMet = isChronicleTierLevelReached(level, trackKey);
    const premiumLocked = !ownerExempt && trackKey === 'premium' && !isCommanderRoyaltyMember();
    const statusLabel = ownerExempt
        ? 'Owner'
        : (isBasicStart
        ? 'Pass start'
        : (levelMet ? 'Reached' : (premiumLocked ? 'Royalty' : 'Locked')));
    const statusClass = ownerExempt
        ? 'status-owner-exempt-tag'
        : (isBasicStart
        ? 'status-locked-text-tag'
        : (levelMet
            ? 'status-reached-text-tag'
            : (premiumLocked ? 'status-premium-required-tag' : 'status-locked-text-tag')));
    const levelTitle = getChronicleTierLevelTitle(level);
    const titleString = isBasicStart ? `${CHRONICLE_FREE_PASS_LABEL} — Level 1` : 'Level reward';
    const description = isBasicStart
        ? `All commanders start at 0 Battle Pass XP. The ${CHRONICLE_FREE_PASS_LABEL} has no reward at level 1 — play in Ages to rank up.`
        : 'No level reward here — keep earning Battle Pass XP in Ages to unlock the next tier.';

    return `
        <div class="milestone-landmark-capsule-card milestone-landmark-no-reward ${levelMet ? 'landmark-node-unlocked' : 'landmark-node-locked'} ${premiumLocked ? 'landmark-node-premium-gated' : ''} ${isBasicStart ? 'milestone-basic-tier-start' : ''} ${ownerExempt ? 'landmark-node-owner-exempt' : ''}">
            <span class="milestone-badge-hexagon-icon milestone-badge-level-only" aria-hidden="true">◇</span>
            <div class="milestone-meta-contents">
                <span class="milestone-tier-level-label">Level ${level} · ${levelTitle}${trackKey === 'premium' ? ' · Premium' : ''}</span>
                <span class="milestone-title-string">${titleString}</span>
                <p class="milestone-reward-description-text">${description}</p>
            </div>
            <span class="milestone-status-action-deck ${statusClass}">${statusLabel}</span>
        </div>
    `;
}

function buildChronicleRewardsTrackMarkup(trackKey) {
    const rows = [];
    for (let level = 1; level <= CHRONICLE_TIER_MAX_LEVEL; level += 1) {
        const entry = getChronicleTierRewardEntry(level, trackKey);
        rows.push(entry
            ? buildChronicleMilestoneCardMarkup(entry, trackKey)
            : buildChronicleLevelPassthroughMarkup(level, trackKey));
    }
    return rows.join('');
}

function refreshChronicleRewardsTrackPanels() {
    const basicBin = document.getElementById('chronicle-rewards-track-basic');
    const premiumBin = document.getElementById('chronicle-rewards-track-premium');
    if (basicBin) basicBin.innerHTML = buildChronicleRewardsTrackMarkup('basic');
    if (premiumBin) premiumBin.innerHTML = buildChronicleRewardsTrackMarkup('premium');

    const premiumBanner = document.getElementById('chronicle-premium-upsell-banner');
    if (premiumBanner) {
        premiumBanner.hidden = isCommanderRoyaltyMember();
    }

    document.querySelectorAll('.chronicle-rewards-track-tab').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.chronicleTrack === activeChronicleRewardsTrack);
    });
    document.querySelectorAll('.chronicle-rewards-track-panel').forEach((panel) => {
        const isActive = panel.dataset.chronicleTrackPanel === activeChronicleRewardsTrack;
        panel.classList.toggle('chronicle-rewards-track-panel-active', isActive);
        panel.classList.toggle('chronicle-rewards-track-panel-hidden', !isActive);
    });
}

function activateChronicleRewardsTrack(trackKey, clickEvent) {
    if (clickEvent) clickEvent.stopPropagation();
    activeChronicleRewardsTrack = trackKey === 'premium' ? 'premium' : 'basic';
    if (typeof playToggleLeverSFX === 'function') playToggleLeverSFX();
    refreshChronicleRewardsTrackPanels();
}

function refreshChronicleProgressHeader(snapshot) {
    if (!snapshot) snapshot = getCommanderChronicleProgressSnapshot();
    const levelReadout = document.getElementById('chronicle-level-readout');
    const meritTag = document.getElementById('chronicle-merit-fraction-tag');
    const fill = document.getElementById('chronicle-merit-progress-fill');
    const totalTag = document.getElementById('chronicle-total-merit-tag');
    if (levelReadout) {
        levelReadout.textContent = `${CHRONICLE_BATTLE_PASS_HEADING} Level ${snapshot.currentLevel} — ${snapshot.levelEpithet}`;
    }
    if (meritTag) {
        meritTag.textContent = snapshot.isMaxLevel
            ? `${snapshot.totalXp} XP · max level`
            : `${snapshot.xpInLevel} / ${snapshot.xpToNextLevel} XP to next level`;
    }
    if (totalTag) totalTag.textContent = `${snapshot.totalXp} total Battle Pass XP`;
    if (fill) fill.style.width = `${snapshot.progressPct}%`;
}

function renderChroniclesProgressMatrixCanvas(viewport) {
    if (isCommanderExcludedFromChronicleTiers()) {
        viewport.innerHTML = `
        <div class="chronicles-workspace-container">
            <header class="royalty-workspace-header-deck">
                <h2 class="royalty-master-title">📜 ${CHRONICLE_BATTLE_PASS_HEADING}</h2>
                <p class="royalty-master-subtitle">The <strong>${CHRONICLE_FREE_PASS_LABEL}</strong> and <strong>${CHRONICLE_PREMIUM_PASS_LABEL}</strong> are for commanders on Standard and Royalty membership. As <strong>site owner</strong>, you are not enrolled in either pass — your profile still shows <strong>Royalty Member</strong> with an <strong>Owner</strong> tag.</p>
            </header>
            <div class="chronicle-owner-exempt-banner">
                <strong>Owner account</strong> — ${CHRONICLE_FREE_PASS_LABEL} and ${CHRONICLE_PREMIUM_PASS_LABEL} level rewards are disabled. Other commanders earn Battle Pass XP in Ages to unlock rewards on those passes.
            </div>
        </div>`;
        return;
    }

    const snapshot = getCommanderChronicleProgressSnapshot();
    const isRoyalty = isCommanderRoyaltyMember();
    const xpProgressLabel = snapshot.isMaxLevel
        ? `${snapshot.totalXp} XP · max level`
        : `${snapshot.xpInLevel} / ${snapshot.xpToNextLevel} XP to next level`;

    viewport.innerHTML = `
        <div class="chronicles-workspace-container">
            <header class="royalty-workspace-header-deck">
                <h2 class="royalty-master-title">📜 ${CHRONICLE_BATTLE_PASS_HEADING}</h2>
                <p class="royalty-master-subtitle">Battle Pass levels are <strong>not</strong> tied to commander rank. Earn Battle Pass XP in Ages — battles, rivalries, map lore, and more. Both passes have <strong>${CHRONICLE_TIER_MAX_LEVEL} levels</strong>; bonus loot unlocks on select levels only. The <strong>${CHRONICLE_PREMIUM_PASS_LABEL}</strong> requires Royalty membership (${CHRONICLE_PREMIUM_MONTHLY_PRICE_LABEL}).</p>
            </header>
            <div class="chronicles-master-card-box">
                <div class="chronicles-level-header-row">
                    <span class="chronicles-main-rank-readout" id="chronicle-level-readout">${CHRONICLE_BATTLE_PASS_HEADING} Level ${snapshot.currentLevel} — ${snapshot.levelEpithet}</span>
                    <span class="chronicles-xp-fraction-tag" id="chronicle-merit-fraction-tag">${xpProgressLabel}</span>
                </div>
                <div class="chronicles-progress-bar-track-bezel" aria-hidden="true">
                    <div class="chronicle-merit-progress-fill-glow chronicles-progress-bar-fill-glow" id="chronicle-merit-progress-fill" style="width: ${snapshot.progressPct}%;"></div>
                </div>
                <p class="chronicle-total-merit-readout" id="chronicle-total-merit-tag">${snapshot.totalXp} total Battle Pass XP</p>
                ${buildChronicleXpEarnedExplanationMarkup()}
            </div>
            <nav class="chronicle-rewards-track-tab-bar" aria-label="Battle Pass reward lanes">
                <button type="button" class="chronicle-rewards-track-tab ${activeChronicleRewardsTrack === 'basic' ? 'active' : ''}" data-chronicle-track="basic" onclick="activateChronicleRewardsTrack('basic', event)">
                    <span class="chronicle-track-tab-title">${CHRONICLE_FREE_PASS_LABEL}</span>
                    <span class="chronicle-track-tab-badge chronicle-track-tab-badge-free">FREE</span>
                </button>
                <button type="button" class="chronicle-rewards-track-tab ${activeChronicleRewardsTrack === 'premium' ? 'active' : ''}" data-chronicle-track="premium" onclick="activateChronicleRewardsTrack('premium', event)">
                    <span class="chronicle-track-tab-title">${CHRONICLE_PREMIUM_PASS_LABEL}</span>
                    <span class="chronicle-track-tab-badge chronicle-track-tab-badge-premium">$10/mo</span>
                </button>
            </nav>
            <div id="chronicle-premium-upsell-banner" class="chronicle-premium-upsell-banner" ${isRoyalty ? 'hidden' : ''}>
                <div class="chronicle-premium-upsell-copy">
                    The <strong>${CHRONICLE_PREMIUM_PASS_LABEL}</strong> unlocks with <strong>Premium</strong> membership (${CHRONICLE_PREMIUM_MONTHLY_PRICE_LABEL}). Subscribers also receive the <strong>Royalty Member</strong> title on their profile.
                </div>
                <button type="button" class="settings-btn chronicle-premium-upsell-btn pulse-buy-btn" onclick="openUnlockPremiumTierPortal(event)">Unlock ${CHRONICLE_PREMIUM_PASS_LABEL}</button>
            </div>
            <div class="chronicle-rewards-tracks-deck">
                <section class="chronicle-rewards-track-panel chronicle-rewards-track-panel-active" data-chronicle-track-panel="basic" id="chronicle-panel-basic">
                    <h3 class="chronicles-grid-heading-label">${CHRONICLE_FREE_PASS_LABEL} — ${CHRONICLE_TIER_MAX_LEVEL} levels (free)</h3>
                    <div class="chronicles-milestones-scroll-bin">
                        <div class="chronicles-milestones-grid-layout" id="chronicle-rewards-track-basic"></div>
                    </div>
                </section>
                <section class="chronicle-rewards-track-panel chronicle-rewards-track-panel-hidden" data-chronicle-track-panel="premium" id="chronicle-panel-premium">
                    <div class="chronicle-premium-panel-header">
                        <h3 class="chronicles-grid-heading-label">${CHRONICLE_PREMIUM_PASS_LABEL} — ${CHRONICLE_TIER_MAX_LEVEL} levels (Royalty · ${CHRONICLE_PREMIUM_MONTHLY_PRICE_LABEL})</h3>
                        ${isRoyalty ? '' : `<button type="button" class="settings-btn chronicle-premium-panel-unlock-btn" onclick="openUnlockPremiumTierPortal(event)">Unlock ${CHRONICLE_PREMIUM_PASS_LABEL}</button>`}
                    </div>
                    <div class="chronicles-milestones-scroll-bin">
                        <div class="chronicles-milestones-grid-layout" id="chronicle-rewards-track-premium"></div>
                    </div>
                </section>
            </div>
        </div>
    `;
    refreshChronicleRewardsTrackPanels();
}

window.activateChronicleRewardsTrack = activateChronicleRewardsTrack;
window.openUnlockPremiumTierPortal = openUnlockPremiumTierPortal;
window.openRoyaltyMembershipFromChronicles = openUnlockPremiumTierPortal;
window.hydrateCommanderMembershipFromStorage = hydrateCommanderMembershipFromStorage;
window.applyCommanderMembershipTitle = applyCommanderMembershipTitle;
window.buildCommanderMembershipBadgeRowMarkup = buildCommanderMembershipBadgeRowMarkup;
window.isActiveCommanderPortalOwner = isActiveCommanderPortalOwner;
window.isCommanderExcludedFromChronicleTiers = isCommanderExcludedFromChronicleTiers;
window.resolveCommanderMembershipTitleForUsername = resolveCommanderMembershipTitleForUsername;
window.beginRoyaltyMembershipCheckout = beginRoyaltyMembershipCheckout;
window.beginRoyaltyMembershipDowngrade = beginRoyaltyMembershipDowngrade;
window.getCommanderChronicleProgressSnapshot = getCommanderChronicleProgressSnapshot;
window.recordChronicleXp = recordChronicleXp;
window.recordChronicleActivity = recordChronicleActivity;
window.resetChronicleXpProgress = resetChronicleXpProgress;
window.rollChronicleXpForAction = rollChronicleXpForAction;
window.resolveChronicleXpRange = resolveChronicleXpRange;

/* ==========================================================================
   SECTION: EVOLUTION ROADMAP (DEVELOPMENT TIMELINE)
   ========================================================================== */

const ROADMAP_EVOLUTION_PHASES = [
    {
        id: 'pre-alpha',
        era: 'Pre-Alpha',
        status: 'completed',
        statusLabel: 'Completed',
        period: 'World forge & creative foundation',
        summary: 'Royal Armies began as a design document and art-led prototype: fifteen nations, dual Physical/Arcane faction fantasy, and a browser-first MMOHFT strategy pitch before any live portal existed.',
        categories: [
            {
                title: 'Vision & product definition',
                items: [
                    'Defined the MMOHFT (Massively Multiplayer High-Fidelity Tactical) positioning for browser strategy veterans and modern players.',
                    'Authored core Age rules: World Domination, Zone Wars, and Crown & Coalition victory matrices.',
                    'Mapped fifteen sovereign nations with unique units, lore audio, and regional identity hooks.'
                ]
            },
            {
                title: 'Creative production',
                items: [
                    'Established the golden medieval UI art direction, crest language, and cinematic landing slideshow assets.',
                    'Produced nation history voice lines and ambient tracks for lore discovery flows.',
                    'Built the GIMP-centered asset pipeline to merge UI sheets and reduce load flicker.'
                ]
            },
            {
                title: 'Technical planning',
                items: [
                    'Selected persistent browser delivery (no heavy client download) as the primary distribution model.',
                    'Outlined the NEXUS ledger concept for commander accounts, Ages, and future combat sync.',
                    'Drafted rank, provision, and Battlemaster / Archmage progression tables (rank-data foundation).'
                ]
            }
        ]
    },
    {
        id: 'alpha-foundation',
        era: 'Alpha 1.0 — Foundation',
        status: 'completed',
        statusLabel: 'Completed',
        period: 'Landing portal & first server handshake',
        summary: 'The first public-facing stack: cinematic landing page, account creation, and a Node-backed ledger so commanders could register and return with a verified identity.',
        categories: [
            {
                title: 'Core framework',
                items: [
                    'Shipped the main UI theme, full-screen landing overlay, and rotating background slideshow.',
                    'Wired the stone portal login form, registration modal, and password recovery request flow.',
                    'Introduced the narrative intro box with typewriter pacing for first-time visitors.'
                ]
            },
            {
                title: 'Security & accounts',
                items: [
                    'Added bcrypt-protected commander records in the project ledger (db.json).',
                    'Integrated Resend-powered verification email scrolls for new registrations.',
                    'Built secure login against username or email with developer staging bypass for internal QA.'
                ]
            },
            {
                title: 'Audio & presentation',
                items: [
                    'Deployed dual-track audio (landing theme + login lullaby) with universal mute control.',
                    'Added UI click/lever SFX hooks across portal interactions.',
                    'Tuned volume staging sliders that persist to local storage.'
                ]
            },
            {
                title: 'Networking',
                items: [
                    'Connected the client to the NEXUS server for registration and authentication.',
                    'Laid groundwork for live player state hooks and global event broadcasting.',
                    'Published the wide roadmap panel and hub layout prototypes on the landing site.'
                ]
            }
        ]
    },
    {
        id: 'alpha-portal',
        era: 'Alpha 0.1.11 — Age Portal',
        status: 'current',
        statusLabel: 'Live now',
        period: 'Commander hub & live operations — May 2026',
        summary: 'Today\'s build centers on main.html: the Age Portal staging deck where enrolled commanders manage profile, messages, metrics, and community systems while the tactical battle client is still in development.',
        categories: [
            {
                title: 'Age Portal navigation',
                items: [
                    `Dedicated portal home with sticky top navigation: Age Portal, Leaderboards, Community Chat, Lore, Royalty, ${CHRONICLE_BATTLE_PASS_HEADING}, and this Evolution Roadmap.`,
                    'Live Age metrics strip: Great Transition countdown, game mode, Age cycle, leading nation, registered and active player rosters.',
                    'Join the Age deployment deck with tutorial vs standard entry, SFX, and visual feedback (battle screen redirect pending).'
                ]
            },
            {
                title: 'Commander hub',
                items: [
                    'Modal hub for Edit Profile, Messages, and Settings without leaving the portal.',
                    'Profile privacy controls: public vs private dossiers with sensitive field masking for other players.',
                    'Avatar picker, bio, nation, timezone, achievements, and age history panels.',
                    'Developer\'s Log sidebar mirroring shipped release notes (Alpha 0.1.11 entry).'
                ]
            },
            {
                title: 'Messaging & ledger API',
                items: [
                    'Ledger-backed inbox, drafts, and sent folders with server delivery between registered commanders.',
                    'Unread indicators on avatar hub and Messages entry; owner roster picker for account administration.',
                    'Maintenance alert bar driven by /api/portal/maintenance-alert for transparent downtime communication.'
                ]
            },
            {
                title: 'Community & polish',
                items: [
                    'Community chat channels with portal routing and presence-aware metrics.',
                    'Leaderboard canvases compiled for portal display.',
                    'Plain-language relabeling across menus, alerts, and hub tabs; production deploy to royalarmies.com on Render with persistent /data volume.'
                ]
            }
        ]
    },
    {
        id: 'alpha-11-bridge',
        era: 'Alpha 1.1 — Portal completion',
        status: 'upcoming',
        statusLabel: 'Next',
        period: 'Finishing hub surfaces & account depth',
        summary: 'Closes the gap between the staging deck and a feature-complete social layer before the first playable Age loop lands.',
        categories: [
            {
                title: 'Hub surfaces',
                items: [
                    'Lore codex with full nation chronicles, audio narration, and unlock progression.',
                    'Activate Battle Pass XP from city battles, PvP, and map lore with success-rarity payouts.',
                    'Expand Royalty membership checkout when premium billing is ready.'
                ]
            },
            {
                title: 'Account & compliance',
                items: [
                    'Email verification enforcement paths and resend-verify tooling for support.',
                    'Session-hardened API calls replacing username-only mailbox queries where needed.',
                    'Richer penalty / discipline overlays for moderated accounts.'
                ]
            },
            {
                title: 'Operations',
                items: [
                    'Automated deploy pipeline notes in Developer\'s Log from CI.',
                    'Improved metrics: historical registration graph and Age enrollment funnel.',
                    'Game redirect from Join the Age into the tactical client shell (game.html).'
                ]
            }
        ]
    },
    {
        id: 'alpha-2',
        era: 'Alpha 2.0 — First playable Age',
        status: 'upcoming',
        statusLabel: 'Target horizon',
        period: 'Playable round & sync combat foundation',
        summary: `The evolutionary leap from portal-only to a real Age round: map presence, unit actions, and shared battle state so testers can fight, earn XP, and climb the ${CHRONICLE_BATTLE_PASS_HEADING}.`,
        categories: [
            {
                title: 'Playable loop',
                items: [
                    'Launch game.html tactical grid with capital deployment and nation assignment RNG.',
                    'Enroll commanders into live Age rounds with provision economy and rank XP accrual.',
                    'Wire victory mode logic stubs for Domination, Zone Wars, and Crown & Coalition timers.'
                ]
            },
            {
                title: 'Combat & classes',
                items: [
                    'Real-time combat hit resolution and spell animation sync between clients.',
                    'Battlemaster and Archmage skill trees with crests and loadout slots.',
                    'Nation-unique legendary battalion modules per lore bible.'
                ]
            },
            {
                title: 'World & economy',
                items: [
                    'Explorable world map sectors with zone audio and story checkpoints.',
                    'Gold flow, vendors, and inventory scaffolding.',
                    'Map capture events feeding leaderboard and Chronicle tier progress.'
                ]
            },
            {
                title: 'Multiplayer infrastructure',
                items: [
                    'Stable expansion of Aether-code logic for horizontal server scaling.',
                    'Stress testing for alliance chat, mail volume, and Age session churn.',
                    'Closed tester cohort with feedback loop into Developer\'s Log releases.'
                ]
            }
        ]
    }
];

function escapeRoadmapHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderRoadmapCategoryBlock(category) {
    const items = (category.items || [])
        .map((item) => `<li>${escapeRoadmapHtml(item)}</li>`)
        .join('');
    return `
        <article class="evolution-roadmap-topic-card">
            <h4 class="evolution-roadmap-topic-title">${escapeRoadmapHtml(category.title)}</h4>
            <ul class="evolution-roadmap-topic-list">${items}</ul>
        </article>
    `;
}

function renderRoadmapPhaseCard(phase, index) {
    const expanded = phase.status === 'current';
    const categories = (phase.categories || []).map(renderRoadmapCategoryBlock).join('');
    return `
        <article class="evolution-roadmap-phase-card ${phase.status} ${expanded ? 'is-expanded' : ''}" data-roadmap-phase="${escapeRoadmapHtml(phase.id)}">
            <button type="button" class="evolution-roadmap-phase-header" onclick="toggleEvolutionRoadmapPhase(this)" aria-expanded="${expanded ? 'true' : 'false'}">
                <span class="evolution-roadmap-phase-rail">
                    <span class="evolution-roadmap-phase-dot" aria-hidden="true"></span>
                    ${index < ROADMAP_EVOLUTION_PHASES.length - 1 ? '<span class="evolution-roadmap-phase-line" aria-hidden="true"></span>' : ''}
                </span>
                <span class="evolution-roadmap-phase-copy">
                    <span class="evolution-roadmap-phase-meta">
                        <span class="evolution-roadmap-era">${escapeRoadmapHtml(phase.era)}</span>
                        <span class="evolution-roadmap-status evolution-roadmap-status--${phase.status}">${escapeRoadmapHtml(phase.statusLabel)}</span>
                    </span>
                    <span class="evolution-roadmap-period">${escapeRoadmapHtml(phase.period)}</span>
                    <span class="evolution-roadmap-summary">${escapeRoadmapHtml(phase.summary)}</span>
                </span>
                <span class="evolution-roadmap-chevron" aria-hidden="true">▼</span>
            </button>
            <div class="evolution-roadmap-phase-body">
                <div class="evolution-roadmap-topic-grid">${categories}</div>
            </div>
        </article>
    `;
}

function toggleEvolutionRoadmapPhase(headerBtn) {
    const card = headerBtn?.closest?.('.evolution-roadmap-phase-card');
    if (!card) return;
    const willExpand = !card.classList.contains('is-expanded');
    card.classList.toggle('is-expanded', willExpand);
    headerBtn.setAttribute('aria-expanded', willExpand ? 'true' : 'false');
}

function renderEvolutionRoadmapPortalCanvas(viewport) {
    const phaseMarkup = ROADMAP_EVOLUTION_PHASES.map(renderRoadmapPhaseCard).join('');
    viewport.innerHTML = `
        <div class="evolution-roadmap-workspace">
            <header class="evolution-roadmap-hero">
                <div class="evolution-roadmap-hero-copy">
                    <p class="evolution-roadmap-eyebrow">Green Mask Interactive · Royal Armies</p>
                    <h2 class="evolution-roadmap-title">Evolution Roadmap</h2>
                    <p class="evolution-roadmap-lead">From pre-alpha concept through today\'s Age Portal build to the first playable Alpha 2.0 Age. This is the development timeline — not the in-game <strong>${CHRONICLE_BATTLE_PASS_HEADING}</strong> (see <strong>The Chronicles</strong> tab).</p>
                </div>
                <div class="evolution-roadmap-legend" aria-label="Roadmap status legend">
                    <span class="evolution-roadmap-legend-item"><span class="evolution-roadmap-legend-swatch completed"></span> Shipped</span>
                    <span class="evolution-roadmap-legend-item"><span class="evolution-roadmap-legend-swatch current"></span> Live now</span>
                    <span class="evolution-roadmap-legend-item"><span class="evolution-roadmap-legend-swatch upcoming"></span> Planned</span>
                </div>
            </header>
            <div class="evolution-roadmap-timeline">${phaseMarkup}</div>
        </div>
    `;
}

window.toggleEvolutionRoadmapPhase = toggleEvolutionRoadmapPhase;

function renderMasterLorePortalCanvas(viewport) {
    const archives = getPortalLoreNationArchives();
    const nationChips = archives.map((nation, index) => {
        const nationId = buildPortalLoreNationId(nation.name);
        const accent = PORTAL_LORE_NATION_ACCENT[nation.name] || '#b89030';
        const epithet = buildPortalLoreNationEpithet(nation.detail);
        const crestMarkup = buildPortalLoreNationCrestMarkup(nation.name, 'lore-nation-chip-crest');
        const indexLabel = String(index + 1).padStart(2, '0');

        return `
            <button
                type="button"
                class="lore-nation-chip"
                data-nation-id="${nationId}"
                style="--lore-nation-accent: ${accent};"
                onclick="selectPortalLoreNation('${nationId}')"
            >
                <span class="lore-nation-chip-index">${indexLabel}</span>
                <span class="lore-nation-chip-sigil" aria-hidden="true">${crestMarkup}</span>
                <span class="lore-nation-chip-copy">
                    <span class="lore-nation-chip-name">${escapePortalLoreHtml(nation.name)}</span>
                    <span class="lore-nation-chip-epithet">${escapePortalLoreHtml(epithet)}</span>
                </span>
            </button>
        `;
    }).join('');

    const nationMobileOptions = archives.map((nation) => {
        const nationId = buildPortalLoreNationId(nation.name);
        const crestMarkup = buildPortalLoreNationCrestMarkup(nation.name, 'lore-nation-mobile-option-crest');
        return `
            <button
                type="button"
                class="lore-nation-mobile-option"
                data-nation-id="${nationId}"
                onclick="selectPortalLoreNationFromMobilePicker('${nationId}', event)"
            >
                <span class="lore-nation-mobile-option-sigil" aria-hidden="true">${crestMarkup}</span>
                <span class="lore-nation-mobile-option-name">${escapePortalLoreHtml(nation.name)}</span>
            </button>
        `;
    }).join('');

    viewport.innerHTML = `
        <div class="lore-workspace-chassis">
            <header class="lore-codex-hero">
                <p class="lore-codex-eyebrow">Royal Armies · Amnek</p>
                <h2 class="lore-codex-title">Lore of the Fifteen Nations</h2>
                <p class="lore-codex-lead">
                    Explore the sovereign realms that shape the continent. Choose a nation to read its chronicle,
                    then press <strong>Listen</strong> to hear its history narration.
                </p>
            </header>
            <div class="lore-codex-body">
                <div class="lore-nation-picker-mobile" id="lore-nation-mobile-picker">
                    <p class="lore-nation-picker-label">Nation codex</p>
                    <button
                        type="button"
                        class="lore-nation-mobile-trigger"
                        id="lore-nation-mobile-trigger"
                        aria-expanded="false"
                        aria-controls="lore-nation-mobile-options"
                        onclick="togglePortalLoreNationMobilePicker(event)"
                    >
                        <span class="lore-nation-mobile-trigger-sigil" id="lore-nation-mobile-trigger-sigil" aria-hidden="true"></span>
                        <span class="lore-nation-mobile-trigger-name" id="lore-nation-mobile-trigger-name">Select nation</span>
                        <span class="lore-nation-mobile-trigger-chevron" aria-hidden="true">▾</span>
                    </button>
                    <div class="lore-nation-mobile-options portal-gold-scrollbar" id="lore-nation-mobile-options" hidden>
                        ${nationMobileOptions}
                    </div>
                </div>
                <aside class="lore-nation-index-deck portal-desktop-lore-index" aria-label="Nation codex index">
                    <p class="lore-index-label">Nation codex</p>
                    <div class="lore-nation-index-scroll">
                        ${nationChips || '<p class="lore-index-empty">Nation archives are loading…</p>'}
                    </div>
                </aside>
                <article class="lore-reader-compartment" aria-live="polite">
                    <div id="lore-reader-panel" class="lore-reader-panel">
                        ${buildPortalLoreReaderPanelMarkup(null)}
                    </div>
                </article>
            </div>
        </div>
    `;

    bindPortalLoreNationMobilePickerDismiss();

    if (archives.length > 0) {
        selectPortalLoreNation(buildPortalLoreNationId(archives[0].name));
    }
}

/* ==========================================================================
   SECTION 9: SYSTEM OPTIONS & AUDIO SOUNDTRACK CHANNEL MIXER
   ========================================================================== */

function getPortalBackgroundAudioElement() {
    return document.getElementById('portal-background-theme-audio');
}

function hydratePortalVolumeStateFromStorage() {
    const settingsMaster = parseFloat(localStorage.getItem('savedMasterVol'));
    const settingsMusic = parseFloat(localStorage.getItem('savedMusicVol'));
    const portalMaster = parseFloat(localStorage.getItem('savedPortalMasterVol'));
    const portalMusic = parseFloat(localStorage.getItem('savedPortalMusicVol'));

    currentPortalMasterVol = Number.isFinite(portalMaster)
        ? portalMaster
        : (Number.isFinite(settingsMaster) ? settingsMaster : 1.0);
    currentPortalMusicVol = Number.isFinite(portalMusic)
        ? portalMusic
        : (Number.isFinite(settingsMusic) ? settingsMusic : 0.5);

    localStorage.setItem('savedPortalMasterVol', currentPortalMasterVol);
    localStorage.setItem('savedPortalMusicVol', currentPortalMusicVol);
}

function resolvePortalBackgroundMusicGain() {
    hydratePortalVolumeStateFromStorage();
    return Math.min(1, Math.max(0, currentPortalMusicVol * currentPortalMasterVol));
}

function syncPortalJukeboxPlaybackUI(isPlaying) {
    const playBtnIcon = document.getElementById('media-play-symbol-node');
    const vinylGlyph = document.getElementById('media-vinyl-spinning-node');
    if (playBtnIcon) playBtnIcon.innerText = isPlaying ? '⏸' : '▶';
    if (vinylGlyph) vinylGlyph.classList.toggle('vinyl-active-spinning-loop', !!isPlaying);
}

function applyPortalBackgroundMusicVolume() {
    if (portalLoreMusicRestoreFadeActive) {
        cancelPortalLoreMusicRestoreFade();
    }

    const bgMusic = getPortalBackgroundAudioElement();
    if (!bgMusic) return 0;

    const userGain = resolvePortalBackgroundMusicGain();
    const outputGain = portalLoreMusicDuckActive
        ? PORTAL_LORE_NARRATION_MUSIC_DUCK_LEVEL
        : userGain;
    bgMusic.volume = outputGain;

    const muteBtnIcon = document.getElementById('media-mute-symbol-node');
    const volumeSlider = document.getElementById('media-volume-slider-input');
    const userMutedViaDeck = muteBtnIcon && muteBtnIcon.innerText === '🔇';

    if (userMutedViaDeck) {
        bgMusic.muted = true;
    } else if (userGain > 0) {
        bgMusic.muted = false;
        if (muteBtnIcon) muteBtnIcon.innerText = userGain < 0.4 ? '🔉' : '🔊';
        if (volumeSlider) volumeSlider.value = userGain;
    } else {
        bgMusic.muted = true;
        if (muteBtnIcon) muteBtnIcon.innerText = '🔇';
        if (volumeSlider) volumeSlider.value = 0;
    }

    return outputGain;
}

function startPortalBackgroundMusic(options = {}) {
    const bgMusic = getPortalBackgroundAudioElement();
    if (!bgMusic) return Promise.resolve();

    const gain = applyPortalBackgroundMusicVolume();
    if (gain <= 0) {
        syncPortalJukeboxPlaybackUI(false);
        return Promise.resolve();
    }

    bgMusic.muted = false;

    const tryPlay = () => bgMusic.play()
        .then(() => {
            syncPortalJukeboxPlaybackUI(true);
            if (options.markSessionGranted) {
                sessionStorage.setItem('royalArmiesAuthAudioPlay', 'granted');
            }
        })
        .catch((err) => {
            syncPortalJukeboxPlaybackUI(false);
            if (!options.silentFail) {
                console.log('Portal background audio awaiting user interaction:', err);
            }
        });

    if (bgMusic.readyState >= 2) {
        return tryPlay();
    }

    return new Promise((resolve) => {
        const onReady = () => {
            bgMusic.removeEventListener('canplay', onReady);
            tryPlay().finally(resolve);
        };
        bgMusic.addEventListener('canplay', onReady);
        if (bgMusic.networkState === 3 || bgMusic.error) {
            bgMusic.load();
        } else if (bgMusic.readyState < 2) {
            bgMusic.load();
        }
    });
}

function bindPortalBackgroundMusicAutoplayUnlock() {
    const unlock = () => {
        startPortalBackgroundMusic({ markSessionGranted: true, silentFail: true });
        document.removeEventListener('pointerdown', unlock);
        document.removeEventListener('keydown', unlock);
    };

    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
}

/* Block 18: CORE VOLUME BALANCER STATE HOOKS */
let currentPortalMasterVol = 1.0;
let currentPortalMusicVol = 0.5;
hydratePortalVolumeStateFromStorage();
let currentPortalNarrationVol = readStoredPortalGain('savedPortalNarrationVol', 'savedNarrationVol', 1);
let currentPortalSfxVol = readStoredPortalGain('savedPortalSfxVol', 'savedSfxVol', 0.4);

/* Block 19: REAL-TIME METALLIC SLIDERS CONSOLE CANVAS COMPILER */
function renderStagingAudioMixerConsoleCanvas(viewport) {
    viewport.innerHTML = `
        <div class="audio-mixer-workspace-container">
            <header class="royalty-workspace-header-deck" style="text-align: left !important; border-bottom: 1px solid rgba(184,144,48,0.2); padding-bottom: 10px; margin-bottom: 14px;">
                <h2 class="royalty-master-title">🔊 Audio settings</h2>
                <p class="royalty-master-subtitle">Adjust volume levels in real time. Settings are saved for your next visit.</p>
            </header>

            <div class="audio-mixer-controls-deck-grid">
                <!-- Row A: MASTER OUTPUT LAYER CONTROL -->
                <div class="audio-mixer-group-row">
                    <div class="mixer-label-meta-cell">
                        <span class="mixer-channel-title-string">Master Volume</span>
                        <span class="mixer-channel-sub-tag">Overall volume for the portal</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.05" value="${currentPortalMasterVol}" class="mixer-slider-track-input" oninput="handleSliderVolumeInput('master', this)">
                </div>

                <!-- Row B: BACKGROUND AMBIENT SOUNDTRACK ORCHESTRA -->
                <div class="audio-mixer-group-row">
                    <div class="mixer-label-meta-cell">
                        <span class="mixer-channel-title-string">Background Music</span>
                        <span class="mixer-channel-sub-tag">Portal background music</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.05" value="${currentPortalMusicVol}" class="mixer-slider-track-input" oninput="handleSliderVolumeInput('music', this)">
                </div>

                <!-- Row C: VOCAL DISPATCHES LORE NARRATIONS -->
                <div class="audio-mixer-group-row">
                    <div class="mixer-label-meta-cell">
                        <span class="mixer-channel-title-string">Voice & Narration</span>
                        <span class="mixer-channel-sub-tag">Story and nation voice lines</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.05" value="${currentPortalNarrationVol}" class="mixer-slider-track-input" oninput="handleSliderVolumeInput('narration', this)">
                </div>

                <!-- Row D: MECHANICAL INTERACTIVE BUTTON SFX CHANNELS -->
                <div class="audio-mixer-group-row">
                    <div class="mixer-label-meta-cell">
                        <span class="mixer-channel-title-string">Interface Effects</span>
                        <span class="mixer-channel-sub-tag">Menu clicks and UI sounds</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.05" value="${currentPortalSfxVol}" class="mixer-slider-track-input" oninput="handleSliderVolumeInput('sfx', this)" onchange="triggerAudioPreviewSample('sfx')">
                </div>
            </div>
        </div>
    `;
}

/* Block 20: LIVE VOLUME STREAM ENGINE CONSOLE CALIBRATIONS */
function executePortalAudioVolumeCalibration() {
    const masterBackgroundAudioNode = getPortalBackgroundAudioElement();
    const masterNarrationVocalAudioNode = document.getElementById('portal-narration-stream-audio');

    if (masterBackgroundAudioNode) {
        applyPortalBackgroundMusicVolume();
    }
    if (masterNarrationVocalAudioNode && typeof currentPortalNarrationVol !== 'undefined' && typeof currentPortalMasterVol !== 'undefined') {
        masterNarrationVocalAudioNode.volume = currentPortalNarrationVol * currentPortalMasterVol;
    }

    if (typeof currentPortalMasterVol !== 'undefined' && typeof currentPortalMusicVol !== 'undefined') {
        console.log(`Mixer Logs | Master: ${currentPortalMasterVol * 100}% | Music Track Gain: ${(currentPortalMusicVol * currentPortalMasterVol) * 100}%`);
        localStorage.setItem('savedPortalMasterVol', currentPortalMasterVol);
        localStorage.setItem('savedPortalMusicVol', currentPortalMusicVol);
        localStorage.setItem('savedPortalNarrationVol', currentPortalNarrationVol);
        localStorage.setItem('savedPortalSfxVol', currentPortalSfxVol);
    }
}

function handleSliderVolumeInput(channelType, sliderElement) {
    const calculatedGainValue = parseFloat(sliderElement.value);

    if (channelType === 'master') currentPortalMasterVol = calculatedGainValue;
    else if (channelType === 'music') currentPortalMusicVol = calculatedGainValue;
    else if (channelType === 'narration') currentPortalNarrationVol = calculatedGainValue;
    else if (channelType === 'sfx') currentPortalSfxVol = calculatedGainValue;

    executePortalAudioVolumeCalibration();

    if ((channelType === 'master' || channelType === 'narration') && portalLoreNarrationPlaying && portalLoreActiveNationId) {
        const activeNation = getPortalLoreNationArchives().find(
            (entry) => buildPortalLoreNationId(entry.name) === portalLoreActiveNationId
        );
        if (activeNation) applyPortalLoreNarrationVolume(activeNation.name);
    }
}

function triggerAudioPreviewSample(channelType) {
    if (channelType === 'sfx') {
        const selectSFXSoundFile = document.getElementById('select-sound');
        if (selectSFXSoundFile) {
            selectSFXSoundFile.volume = currentPortalSfxVol * currentPortalMasterVol;
            selectSFXSoundFile.currentTime = 0;
            selectSFXSoundFile.play().catch(() => console.log("SFX block waiting for cursor interaction pass..."));
        }
    }
}

/* Block 21: LIVE VOLUME STREAM ENGINE CONSOLE CALIBRATIONS - RECONCILED BOOT ROUTINE */

window.addEventListener('resize', () => {
    const deck = document.getElementById('portal-floating-media-player-deck');
    const toggleBtn = document.getElementById('media-player-expand-toggle');
    if (deck && window.matchMedia('(min-width: 1025px)').matches) {
        ensurePortalMediaPlayerCollapsedByDefault();
    }
    mountPortalMediaPlayerForViewport();
    applyPortalMobileNavLayoutMode();
    if (typeof syncAchievementToastStackPosition === 'function') {
        syncAchievementToastStackPosition();
    }
    if (window.matchMedia('(min-width: 1025px)').matches) {
        closePortalMobileNavMenus();
    } else if (isPortalMobileNavMenuOpen()) {
        positionPortalMobileNavMenu();
    }
});

window.addEventListener('scroll', () => {
    const menu = document.getElementById('portal-mobile-nav-menu');
    if (menu && !menu.hidden && isPortalMobileNavLayout()) {
        positionPortalMobileNavMenu();
    }
}, { passive: true });

window.addEventListener("DOMContentLoaded", () => {
    const bgMusic = getPortalBackgroundAudioElement();
    if (!bgMusic) return;

    applyPortalBackgroundMusicVolume();
    initializeAdvancedMediaJukeboxEngine();

    const joinHoverSfx = getJoinAgeHoverSoundElement();
    const joinSelectSfx = getJoinAgeSelectSoundElement();
    if (joinHoverSfx) {
        applyJoinAgeSfxMaxVolume(joinHoverSfx);
        joinHoverSfx.load();
    }
    if (joinSelectSfx) {
        applyJoinAgeSfxMaxVolume(joinSelectSfx);
        joinSelectSfx.load();
    }

    if (sessionStorage.getItem('royalArmiesAuthAudioPlay') === 'granted') {
        startPortalBackgroundMusic({ markSessionGranted: true, silentFail: true });
    } else {
        bindPortalBackgroundMusicAutoplayUnlock();
    }
});

window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        startPortalBackgroundMusic({ silentFail: true });
    }
});

/* ==========================================================================
   SECTION 12: SERVER PERSISTENT AGE TIMELINE LIFECYCLE ENGINE (METRICS OVERHAUL)
   ========================================================================== */

// ROTATING PLUGINS ARRAY INDEX MODES
const royalArmiesGameModeLoopLedger = ["World Domination", "Zone Wars", "Crown & Coalition"];

// NATION LEADERSHIP COMPILERS BASED ON ACTIVE PROFILE OBJECT CONSTRAINTS
const nationLeadersMatrixMockData = {
    "World Domination": "Aesthine",
    "Zone Wars": "Arcane Order Vanguard",
    "Crown & Coalition": "Physical Steel Alliance"
};

// PERSISTENT TIMELINE LIFECYCLE INITIALIZER KEYS
let currentCampaignAgeNumber = parseInt(localStorage.getItem('savedCampaignAgeNumber')) || 1;
let activeCampaignState = localStorage.getItem('savedCampaignState') || "active"; 
let ageStateTargetTimestamp = parseInt(localStorage.getItem('savedAgeStateTargetTimestamp'));

if (!ageStateTargetTimestamp) {
    ageStateTargetTimestamp = Date.now();
    localStorage.setItem('savedAgeStateTargetTimestamp', ageStateTargetTimestamp);
}

// 🌟 THE 3-MONTH GREAT TRANSITION CLOCK ANCHOR KEY
let greatTransitionTargetTimestamp = parseInt(localStorage.getItem('savedGreatTransitionTargetTimestamp'));

if (!greatTransitionTargetTimestamp) {
    // Generate a fixed timestamp targeting exactly 3 months (90 days baseline) out out into memory registers
    const ninetyDaysInMilliseconds = 90 * 24 * 60 * 60 * 1000;
    greatTransitionTargetTimestamp = Date.now() + ninetyDaysInMilliseconds;
    localStorage.setItem('savedGreatTransitionTargetTimestamp', greatTransitionTargetTimestamp);
}

function applyPlaceholderAgeMetricBannerValues() {
    const ageCycleDisplay = document.getElementById('metrics-age-cycle-display');
    const gameModeDisplay = document.getElementById('metrics-game-mode-display');
    const leadingNationDisplay = document.getElementById('metrics-leading-nation-display');

    if (ageCycleDisplay) ageCycleDisplay.innerText = 'N/A';
    if (gameModeDisplay) gameModeDisplay.innerText = 'N/A';
    if (leadingNationDisplay) leadingNationDisplay.innerText = 'N/A';
}

function runDynamicAgeLifecycleTrackingEngine() {
    const transitionCountdownDisplay = document.getElementById('metrics-transition-countdown-display');

    applyPlaceholderAgeMetricBannerValues();

    if (arePortalCountdownTimersPaused()) {
        applyPausedPortalCountdownReadouts();
        return;
    }

    // Central Deployment Corridor Handle hooks maintained perfectly intact
    const statusHeader = document.getElementById('dynamic-age-status-header');
    const subTimerDisplay = document.getElementById('dynamic-age-sub-timer-display');
    const deckContainer = document.getElementById('deployment-master-deck-container');

    setInterval(() => {
        const currentTime = Date.now();

        applyPlaceholderAgeMetricBannerValues();

        // ============================================================
        // 🌌 THE REPEATING 3-MONTH GREAT TRANSITION COUNTDOWN INTERPOLATOR
        // ============================================================
        let transitionTimeDelta = greatTransitionTargetTimestamp - currentTime;
        
        if (transitionTimeDelta <= 0) {
            // Deadline reached: Automatically roll the calendar track forward exactly another 3 months
            const ninetyDaysInMilliseconds = 90 * 24 * 60 * 60 * 1000;
            greatTransitionTargetTimestamp = Date.now() + ninetyDaysInMilliseconds;
            localStorage.setItem('savedGreatTransitionTargetTimestamp', greatTransitionTargetTimestamp);
            transitionTimeDelta = greatTransitionTargetTimestamp - currentTime;
            console.log("Timeline System Core | 3-Month Great Transition Deadline cleared. Clock rolled forward.");
        }
        
        if (transitionCountdownDisplay) {
            transitionCountdownDisplay.innerText = formatTransitionTimestampClockString(transitionTimeDelta);
        }

        // ============================================================
        // TIMELINE LIFECYCLE FLOW EVALUATIONS MATRIX
        // ============================================================
        if (activeCampaignState === "active") {
            const totalElapsedMilliseconds = currentTime - ageStateTargetTimestamp;

            // Central Deployment Corridor Text String Sync Injections
            if (statusHeader) statusHeader.innerText = `⚔️ AGE ${currentCampaignAgeNumber} HAS BEGUN`;
            if (subTimerDisplay && !subTimerDisplay.classList.contains('timer-hidden-state-lock')) {
                subTimerDisplay.innerHTML = formatTransitionTimestampClockString(totalElapsedMilliseconds);
                subTimerDisplay.classList.remove('timer-readout-alert');
                subTimerDisplay.classList.add('timer-readout-active');
                subTimerDisplay.style.removeProperty('color');
            }
            if (deckContainer) {
                deckContainer.style.borderColor = "#b89030";
                deckContainer.style.animation = "none";
            }

            /* --- Intermission Shift Gate: Activates automatically at the 15-day maximum campaign boundary --- */
            const fifteenDaysInMilliseconds = 15 * 24 * 60 * 60 * 1000;
            if (totalElapsedMilliseconds >= fifteenDaysInMilliseconds) {
                activeCampaignState = "transition";
                ageStateTargetTimestamp = Date.now() + (24 * 60 * 60 * 1000); // Trigger 24h transition intermission block
                
                localStorage.setItem('savedCampaignState', activeCampaignState);
                localStorage.setItem('savedAgeStateTargetTimestamp', ageStateTargetTimestamp);
            }

        } else if (activeCampaignState === "transition") {
            const remainingTransitionMilliseconds = ageStateTargetTimestamp - currentTime;
            const nextAgeNumber = currentCampaignAgeNumber + 1;
            
            if (remainingTransitionMilliseconds <= 0) {
                // Intermission cleared: Step the game version number and release the campaign mode flags
                currentCampaignAgeNumber = nextAgeNumber;
                activeCampaignState = "active";
                ageStateTargetTimestamp = Date.now();
                
                localStorage.setItem('savedCampaignAgeNumber', currentCampaignAgeNumber);
                localStorage.setItem('savedCampaignState', activeCampaignState);
                localStorage.setItem('savedAgeStateTargetTimestamp', ageStateTargetTimestamp);
                return;
            }
            
            // Central Deployment Corridor Intermission Notification Text Strings Sync Injections
            if (statusHeader) statusHeader.innerText = `⚠️ AGE ${currentCampaignAgeNumber} HAS ENDED. AGE ${nextAgeNumber} WILL BEGIN IN:`;
            if (subTimerDisplay && !subTimerDisplay.classList.contains('timer-hidden-state-lock')) {
                subTimerDisplay.innerHTML = formatTransitionTimestampClockString(remainingTransitionMilliseconds);
                subTimerDisplay.classList.remove('timer-readout-active');
            }

            // Emergency indicators fire under the 30 minute timeline threshold block
            const thirtyMinutesInMilliseconds = 30 * 60 * 1000;
            if (remainingTransitionMilliseconds <= thirtyMinutesInMilliseconds) {
                if (deckContainer) {
                    deckContainer.style.setProperty('border-color', '#cc0000', 'important');
                    deckContainer.style.setProperty('animation', 'criticalIntermissionPulsate 1.5s infinite ease-in-out', 'important');
                }
                if (subTimerDisplay && !subTimerDisplay.classList.contains('timer-hidden-state-lock')) {
                    subTimerDisplay.classList.add('timer-readout-alert');
                    subTimerDisplay.style.removeProperty('color');
                }
            } else if (subTimerDisplay && !subTimerDisplay.classList.contains('timer-hidden-state-lock')) {
                subTimerDisplay.classList.remove('timer-readout-alert');
            }
        }
    }, 1000);
}

function formatTransitionTimestampClockString(milliseconds) {
    if (milliseconds < 0) milliseconds = 0;
    const totalSeconds = Math.floor(milliseconds / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const totalDays = Math.floor(totalHours / 24);
    
    const displayHours = (totalHours % 24).toString().padStart(2, '0');
    const displayMinutes = (totalMinutes % 60).toString().padStart(2, '0');
    const displaySeconds = (totalSeconds % 60).toString().padStart(2, '0');
    
    if (totalDays > 0) {
        return `${totalDays}d : ${displayHours}h : ${displayMinutes}m : ${displaySeconds}s`;
    }
    return `${displayHours}h : ${displayMinutes}m : ${displaySeconds}s`;
}

// Fire calculation module natively on script execution
runDynamicAgeLifecycleTrackingEngine();

/* ==========================================================================
   SECTION 13: SCRIPT-DRIVEN TACTICAL EARTHQUAKE HOVER TIMELINES WITH AUDIO
   ========================================================================== */

let joinAgeBuildHoverCount = 0;
let joinAgeBuildAudioFadeInterval = null;
let joinAgeBgMusicPreDuckVolume = null;

const JOIN_AGE_SFX_MAX_VOLUME = 1;
const JOIN_AGE_HOVER_BG_DUCK_VOLUME = 0.2;

function applyJoinAgeSfxMaxVolume(audioElement) {
    if (!audioElement) return;
    audioElement.muted = false;
    audioElement.volume = JOIN_AGE_SFX_MAX_VOLUME;
}

function resolvePortalBackgroundMusicVolume() {
    return resolvePortalBackgroundMusicGain();
}

function duckPortalBackgroundMusicForJoinAgeHover() {
    const bgMusic = document.getElementById('portal-background-theme-audio');
    if (!bgMusic || joinAgeBgMusicPreDuckVolume !== null) return;
    joinAgeBgMusicPreDuckVolume = bgMusic.volume;
    bgMusic.volume = JOIN_AGE_HOVER_BG_DUCK_VOLUME;
}

function restorePortalBackgroundMusicAfterJoinAgeHover() {
    const bgMusic = getPortalBackgroundAudioElement();
    if (!bgMusic) return;

    joinAgeBgMusicPreDuckVolume = null;
    applyPortalBackgroundMusicVolume();
}

function getJoinAgeHoverSoundElement() {
    return document.getElementById('join-age-hover-sound')
        || document.getElementById('join-age-build-sound')
        || document.getElementById('earthquake-build-sound');
}

function getJoinAgeBuildSoundElement() {
    return getJoinAgeHoverSoundElement();
}

function getJoinAgeSelectSoundElement() {
    return document.getElementById('join-age-select-sound');
}

function haltJoinAgeHoverSoundImmediately() {
    joinAgeBuildHoverCount = 0;
    if (joinAgeBuildAudioFadeInterval) {
        clearInterval(joinAgeBuildAudioFadeInterval);
        joinAgeBuildAudioFadeInterval = null;
    }
    restorePortalBackgroundMusicAfterJoinAgeHover();
    const hoverAudio = getJoinAgeHoverSoundElement();
    if (hoverAudio) {
        hoverAudio.pause();
        hoverAudio.currentTime = 0;
        applyJoinAgeSfxMaxVolume(hoverAudio);
    }
}

function haltPortalBackgroundMusicImmediately() {
    const bgMusic = getPortalBackgroundAudioElement();
    if (!bgMusic) return;
    joinAgeBgMusicPreDuckVolume = null;
    bgMusic.pause();
    syncPortalJukeboxPlaybackUI(false);
}

function haltAllPortalAudioForGameLaunch() {
    haltJoinAgeHoverSoundImmediately();
    haltPortalBackgroundMusicImmediately();

    document.querySelectorAll('.deployment-image-trigger-btn').forEach((btn) => {
        btn.disabled = true;
        btn.style.pointerEvents = 'none';
    });
}

function clearJoinAgeButtonShakeState(buttonChassis) {
    if (!buttonChassis) return;

    if (buttonChassis._joinAgeShakeProgressionInterval) {
        clearInterval(buttonChassis._joinAgeShakeProgressionInterval);
        buttonChassis._joinAgeShakeProgressionInterval = null;
    }
    if (buttonChassis._joinAgeRumbleFrameLoop) {
        clearInterval(buttonChassis._joinAgeRumbleFrameLoop);
        buttonChassis._joinAgeRumbleFrameLoop = null;
    }

    buttonChassis.classList.remove('is-building-up', 'shake-level-1', 'shake-level-2', 'shake-level-3');
    buttonChassis.style.left = '0px';
    buttonChassis.style.top = '0px';
    buttonChassis.style.transform = 'scale(1) rotate(0deg)';
}

function resetAllJoinAgeDeploymentButtonShakeStates() {
    document.querySelectorAll(
        '.action-btn-aura-housing.aura-glow-red, .action-btn-aura-housing.aura-glow-blue'
    ).forEach(clearJoinAgeButtonShakeState);
}

function runJoinAgeDeployConfirmPulse(buttonChassis, onComplete) {
    if (!buttonChassis) {
        if (typeof onComplete === 'function') onComplete();
        return;
    }

    clearJoinAgeButtonShakeState(buttonChassis);

    buttonChassis.classList.remove('deploy-confirm-pulse', 'phase-grow', 'phase-settle');
    buttonChassis.classList.add('deploy-confirm-pulse');
    buttonChassis.style.setProperty(
        'transition',
        'transform 0.42s cubic-bezier(0.22, 1, 0.36, 1), left 0.2s ease, top 0.2s ease, filter 0.35s ease',
        'important'
    );
    buttonChassis.style.setProperty('transform', 'scale(1) rotate(0deg)', 'important');

    window.requestAnimationFrame(() => {
        buttonChassis.classList.add('phase-grow');
        buttonChassis.style.setProperty('transform', 'scale(1.2) rotate(0deg)', 'important');

        window.setTimeout(() => {
            buttonChassis.classList.remove('phase-grow');
            buttonChassis.classList.add('phase-settle');
            buttonChassis.style.setProperty('transform', 'scale(1) rotate(0deg)', 'important');

            window.setTimeout(() => {
                buttonChassis.classList.remove('deploy-confirm-pulse', 'phase-settle');
                if (typeof onComplete === 'function') onComplete();
            }, JOIN_AGE_DEPLOY_PULSE_SETTLE_MS);
        }, JOIN_AGE_DEPLOY_PULSE_GROW_MS);
    });
}

function playJoinAgeSelectSfx(onAudioComplete) {
    const selectAudio = getJoinAgeSelectSoundElement();

    const finishAudioPhase = () => {
        if (typeof onAudioComplete === 'function') onAudioComplete();
    };

    if (!selectAudio) {
        console.log('Join Age select SFX missing — proceeding without select audio.');
        finishAudioPhase();
        return;
    }

    let transitionScheduled = false;
    const scheduleTransitionOnce = () => {
        if (transitionScheduled) return;
        transitionScheduled = true;
        selectAudio.removeEventListener('ended', scheduleTransitionOnce);
        finishAudioPhase();
    };

    selectAudio.loop = false;
    applyJoinAgeSfxMaxVolume(selectAudio);
    selectAudio.currentTime = 0;

    selectAudio.addEventListener('ended', scheduleTransitionOnce);

    selectAudio.play()
        .then(() => {
            console.log('Join Age select SFX engaged. Awaiting full playback before deployment handoff.');
        })
        .catch((err) => {
            console.warn('Join Age select SFX blocked — using timed fallback.', err);
            scheduleTransitionOnce();
        });

    const waitForMetadata = () => {
        const durationMs = Number.isFinite(selectAudio.duration) && selectAudio.duration > 0
            ? (selectAudio.duration * 1000) + 100
            : 3500;
        window.setTimeout(scheduleTransitionOnce, durationMs);
    };

    if (selectAudio.readyState >= 1 && Number.isFinite(selectAudio.duration)) {
        waitForMetadata();
    } else {
        selectAudio.addEventListener('loadedmetadata', waitForMetadata, { once: true });
        selectAudio.load();
    }
}

function startJoinAgeBuildSoundscape() {
    const buildAudio = getJoinAgeBuildSoundElement();
    if (!buildAudio) return;

    if (joinAgeBuildAudioFadeInterval) {
        clearInterval(joinAgeBuildAudioFadeInterval);
        joinAgeBuildAudioFadeInterval = null;
    }

    applyJoinAgeSfxMaxVolume(buildAudio);
    buildAudio.loop = true;
    duckPortalBackgroundMusicForJoinAgeHover();

    const attemptPlayback = () => {
        buildAudio.play().catch(() => {});
    };

    if (buildAudio.readyState >= 2) {
        attemptPlayback();
    } else {
        buildAudio.addEventListener('canplaythrough', attemptPlayback, { once: true });
        buildAudio.load();
    }
}

function stopJoinAgeBuildSoundscape() {
    const buildAudio = getJoinAgeBuildSoundElement();
    if (!buildAudio) return;

    if (joinAgeBuildAudioFadeInterval) clearInterval(joinAgeBuildAudioFadeInterval);

    joinAgeBuildAudioFadeInterval = setInterval(() => {
        if (buildAudio.volume > 0.05) {
            buildAudio.volume -= 0.05;
        } else {
            clearInterval(joinAgeBuildAudioFadeInterval);
            joinAgeBuildAudioFadeInterval = null;
            buildAudio.pause();
            buildAudio.currentTime = 0;
            applyJoinAgeSfxMaxVolume(buildAudio);
            if (joinAgeBuildHoverCount === 0) {
                restorePortalBackgroundMusicAfterJoinAgeHover();
            }
        }
    }, 30);
}

function bindJoinAgeDeploymentButtonHover(buttonChassis) {
    if (!buttonChassis || buttonChassis.dataset.earthquakeBound === 'true') return;
    if (isPortalMobileNavLayout()) return;
    buttonChassis.dataset.earthquakeBound = 'true';

    let elapsedHoverSeconds = 0;
    let currentRumbleIntensityMax = 0;

    buttonChassis.addEventListener('mouseenter', () => {
            if (joinAgePortalTransitionActive) return;

            buttonChassis.style.setProperty('transition', 'transform 5.0s cubic-bezier(0.1, 0.8, 0.2, 1), filter 5.0s ease-in-out', 'important');
            buttonChassis.classList.add('is-building-up');

            elapsedHoverSeconds = 0;
            currentRumbleIntensityMax = 0.5;

            joinAgeBuildHoverCount++;
            if (joinAgeBuildHoverCount === 1) {
                startJoinAgeBuildSoundscape();
            }

            buttonChassis._joinAgeRumbleFrameLoop = setInterval(() => {
                const randomOffsetLeft = (Math.random() * (currentRumbleIntensityMax * 2) - currentRumbleIntensityMax);
                const randomOffsetTop = (Math.random() * (currentRumbleIntensityMax * 2) - currentRumbleIntensityMax);
                const randomRotationAngle = (Math.random() * (currentRumbleIntensityMax * 0.5) - (currentRumbleIntensityMax * 0.25));

                buttonChassis.style.left = `${randomOffsetLeft}px`;
                buttonChassis.style.top = `${randomOffsetTop}px`;
                buttonChassis.style.transform = `scale(1.15) rotate(${randomRotationAngle}deg)`;
            }, 30);

            buttonChassis._joinAgeShakeProgressionInterval = setInterval(() => {
                elapsedHoverSeconds += 0.5;

                if (elapsedHoverSeconds >= 0.5 && elapsedHoverSeconds < 2.0) {
                    buttonChassis.classList.add('shake-level-1');
                    currentRumbleIntensityMax = 1.5;
                }
                else if (elapsedHoverSeconds >= 2.0 && elapsedHoverSeconds < 4.0) {
                    buttonChassis.classList.remove('shake-level-1');
                    buttonChassis.classList.add('shake-level-2');
                    currentRumbleIntensityMax = 3.5;
                }
                else if (elapsedHoverSeconds >= 4.0) {
                    buttonChassis.classList.remove('shake-level-2');
                    buttonChassis.classList.add('shake-level-3');
                    currentRumbleIntensityMax = 6.0;
                    clearInterval(buttonChassis._joinAgeShakeProgressionInterval);
                    buttonChassis._joinAgeShakeProgressionInterval = null;
                }
            }, 500);
        });

        buttonChassis.addEventListener('mouseleave', () => {
            if (joinAgePortalTransitionActive) return;

            clearJoinAgeButtonShakeState(buttonChassis);

            buttonChassis.style.setProperty('transition', 'transform 0.2s ease-out, filter 0.2s ease-out', 'important');
            buttonChassis.style.removeProperty('filter');
            buttonChassis.style.transform = 'scale(1) rotate(0deg)';

            joinAgeBuildHoverCount = Math.max(0, joinAgeBuildHoverCount - 1);
            if (joinAgeBuildHoverCount === 0) {
                stopJoinAgeBuildSoundscape();
            }
        });
}

function initializeTacticalButtonEarthquakeEngine() {
    const deploymentHousings = document.querySelectorAll(
        '.action-btn-aura-housing.aura-glow-red, .action-btn-aura-housing.aura-glow-blue'
    );
    deploymentHousings.forEach((housing) => {
        if (isPortalMobileNavLayout()) {
            clearJoinAgeButtonShakeState(housing);
            return;
        }
        bindJoinAgeDeploymentButtonHover(housing);
    });
}

const originalWindowInitHandshake = window.onload;
window.onload = () => {
    if (typeof originalWindowInitHandshake === 'function') originalWindowInitHandshake();
    initializeTacticalButtonEarthquakeEngine();
};

/* ==========================================================================
   SECTION 14: FLOATING MEDIA CONTROLLER BACKEND CHANNELS PIPELINES
   ========================================================================== */

// JUKEBOX REPERTOIRE LIST LEDGER MAP: Expand this ledger array with your custom wav/mp3 files
const royalArmiesPlaylistRepository = [
    { title: "🎵 ARCHIMEDES' LULLABY", file: "audio/archimedeslullaby.wav" },
    { title: "🎵 CASCADING SKIES", file: "audio/cascadingskies.wav" },
    { title: "🎵 JASMINE MOON", file: "audio/jasminemoon.wav" },
    { title: "🎵 KINDRED MEMORIES", file: "audio/Kindred%20Memories.wav" },
    { title: "🎵 WANDERING SOUL", file: "audio/Wandering%20Soul.wav" }
];

let currentTrackIndexMarker = 0;
const PORTAL_JUKEBOX_SHUFFLE_ENABLED = true;

function pickNextShuffleTrackIndex() {
    const len = royalArmiesPlaylistRepository.length;
    if (len <= 1) return 0;
    let next = currentTrackIndexMarker;
    while (next === currentTrackIndexMarker) {
        next = Math.floor(Math.random() * len);
    }
    return next;
}

function syncPortalPlaylistTrackListUI() {
    document.querySelectorAll('.media-playlist-track-item').forEach((item) => {
        const btn = item.querySelector('.media-playlist-track-btn');
        const index = btn ? Number.parseInt(btn.getAttribute('data-track-index'), 10) : -1;
        const isActive = index === currentTrackIndexMarker;
        item.classList.toggle('is-active', isActive);
        if (btn) {
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-current', isActive ? 'true' : 'false');
        }
    });
}

function renderPortalMediaPlaylist() {
    const list = document.getElementById('media-playlist-track-list');
    if (!list) return;

    list.innerHTML = royalArmiesPlaylistRepository.map((track, index) => `
        <li class="media-playlist-track-item${index === currentTrackIndexMarker ? ' is-active' : ''}">
            <button type="button"
                class="media-playlist-track-btn${index === currentTrackIndexMarker ? ' is-active' : ''}"
                data-track-index="${index}"
                onclick="selectPortalPlaylistTrack(${index})"
                aria-current="${index === currentTrackIndexMarker ? 'true' : 'false'}">
                ${track.title}
            </button>
        </li>
    `).join('');
}

function loadPortalPlaylistTrack(trackIndex, options = {}) {
    const bgAudio = getPortalBackgroundAudioElement();
    const trackLabel = document.getElementById('media-active-track-name');
    const track = royalArmiesPlaylistRepository[trackIndex];

    if (!bgAudio || !trackLabel || !track) return;

    currentTrackIndexMarker = trackIndex;
    trackLabel.innerText = track.title;

    const sourceNode = bgAudio.querySelector('source');
    if (sourceNode) {
        sourceNode.src = track.file;
    } else {
        bgAudio.src = track.file;
    }

    bgAudio.removeAttribute('loop');
    bgAudio.load();
    bgAudio.addEventListener('loadedmetadata', () => syncMediaPlayerTimelineUI(bgAudio), { once: true });
    syncPortalPlaylistTrackListUI();

    if (options.autoplay) {
        startPortalBackgroundMusic({ silentFail: true });
    }
}

function advancePortalPlaylistTrack() {
    const nextIndex = PORTAL_JUKEBOX_SHUFFLE_ENABLED
        ? pickNextShuffleTrackIndex()
        : (currentTrackIndexMarker + 1) % royalArmiesPlaylistRepository.length;
    loadPortalPlaylistTrack(nextIndex, { autoplay: true });
}

function syncMediaPlayerTimelineUI(bgAudio) {
    const progressScrubber = document.getElementById('media-timeline-progress-scrubber');
    const currentClock = document.getElementById('media-current-time-clock');
    const totalClock = document.getElementById('media-total-duration-clock');
    if (!progressScrubber || !currentClock || !totalClock) return;

    const currentTime = bgAudio.currentTime || 0;
    currentClock.innerText = formatMediaClockSecondsToString(currentTime);

    const duration = bgAudio.duration;
    if (Number.isFinite(duration) && duration > 0) {
        totalClock.innerText = formatMediaClockSecondsToString(duration);
        progressScrubber.value = (currentTime / duration) * 100;
    }
}

function initializeAdvancedMediaJukeboxEngine() {
    const bgAudio = document.getElementById('portal-background-theme-audio');
    const progressScrubber = document.getElementById('media-timeline-progress-scrubber');
    const vinylGlyph = document.getElementById('media-vinyl-spinning-node');

    if (!bgAudio || !progressScrubber) return;
    if (bgAudio.dataset.jukeboxBound === 'true') return;
    bgAudio.dataset.jukeboxBound = 'true';

    const refreshTimeline = () => syncMediaPlayerTimelineUI(bgAudio);

    bgAudio.addEventListener('loadedmetadata', refreshTimeline);
    bgAudio.addEventListener('durationchange', refreshTimeline);
    bgAudio.addEventListener('timeupdate', refreshTimeline);

    bgAudio.addEventListener('ended', () => {
        advancePortalPlaylistTrack();
    });

    renderPortalMediaPlaylist();
    syncPortalPlaylistTrackListUI();

    if (bgAudio.readyState < 1) {
        bgAudio.load();
    }
    refreshTimeline();

    if (!bgAudio.paused && vinylGlyph) {
        vinylGlyph.classList.add('vinyl-active-spinning-loop');
    }
}

window.togglePortalBackgroundPlayback = function() {
    const bgAudio = getPortalBackgroundAudioElement();
    if (!bgAudio) return;

    if (bgAudio.paused) {
        startPortalBackgroundMusic({ markSessionGranted: true });
    } else {
        bgAudio.pause();
        syncPortalJukeboxPlaybackUI(false);
    }
};

window.togglePortalBackgroundMuteState = function() {
    const bgAudio = document.getElementById('portal-background-theme-audio');
    const muteBtnIcon = document.getElementById('media-mute-symbol-node');
    const volumeSlider = document.getElementById('media-volume-slider-input');
    
    if (!bgAudio || !muteBtnIcon) return;

    bgAudio.muted = !bgAudio.muted;

    if (bgAudio.muted) {
        muteBtnIcon.innerText = "🔇";
        if (volumeSlider) volumeSlider.value = 0;
        console.log("Jukebox Channels | Track audio channel muted.");
    } else {
        applyPortalBackgroundMusicVolume();
        if (bgAudio.paused) {
            startPortalBackgroundMusic({ markSessionGranted: true, silentFail: true });
        }
        console.log("Jukebox Channels | Track audio channel restored.");
    }
};

window.manuallyAdjustPlayerDeckVolume = function(val) {
    const bgAudio = document.getElementById('portal-background-theme-audio');
    const muteBtnIcon = document.getElementById('media-mute-symbol-node');
    
    if (!bgAudio) return;

    bgAudio.volume = parseFloat(val);
    bgAudio.muted = (bgAudio.volume === 0);

    if (muteBtnIcon) {
        muteBtnIcon.innerText = bgAudio.muted ? "🔇" : bgAudio.volume < 0.4 ? "🔉" : "🔊";
    }
    
    // Core database synchronization handles persistent values back down into storage
    localStorage.setItem('savedPortalMusicVol', bgAudio.volume);
};

window.manuallyScrubActiveTrackTimeline = function(sliderElement) {
    const bgAudio = document.getElementById('portal-background-theme-audio');
    const duration = bgAudio && bgAudio.duration;
    if (!bgAudio || !Number.isFinite(duration) || duration <= 0) return;

    const targetScrubTimeSeconds = (parseFloat(sliderElement.value) / 100) * duration;
    bgAudio.currentTime = targetScrubTimeSeconds;
    syncMediaPlayerTimelineUI(bgAudio);
};

window.selectPortalPlaylistTrack = function(trackIndex) {
    const index = Number.parseInt(trackIndex, 10);
    if (!Number.isFinite(index) || index < 0 || index >= royalArmiesPlaylistRepository.length) return;
    loadPortalPlaylistTrack(index, { autoplay: true });
};

window.executeTrackNavigationSkip = function(directionType) {
    if (directionType === 'prev') {
        const prevIndex = (currentTrackIndexMarker - 1 + royalArmiesPlaylistRepository.length)
            % royalArmiesPlaylistRepository.length;
        loadPortalPlaylistTrack(prevIndex, { autoplay: true });
        return;
    }
    advancePortalPlaylistTrack();
};

function formatMediaClockSecondsToString(seconds) {
    if (isNaN(seconds)) return "00:00";
    const min = Math.floor(seconds / 60).toString().padStart(2, '0');
    const sec = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
}

const existingWindowMediaLoadHook = window.onload;
window.onload = () => {
    if (typeof existingWindowMediaLoadHook === 'function') existingWindowMediaLoadHook();
    initializeAdvancedMediaJukeboxEngine();
    initializeTacticalButtonEarthquakeEngine();
    mountPortalMediaPlayerForViewport();
    ensurePortalMediaPlayerCollapsedByDefault();
    if (typeof applyPortalDeploymentDeckPresentation === 'function') {
        applyPortalDeploymentDeckPresentation();
    } else if (typeof applyPortalGuestDeploymentChrome === 'function') {
        applyPortalGuestDeploymentChrome();
    }
    window.cachedAgePortalViewportHTML = snapshotAgePortalViewportForCache();
    if (getPortalBackgroundAudioElement()?.paused) {
        startPortalBackgroundMusic({ silentFail: true });
    }
};

function syncPortalMediaPlayerExpandUI() {
    const deck = document.getElementById('portal-floating-media-player-deck');
    const toggleBtn = document.getElementById('media-player-expand-toggle');
    if (!deck || !toggleBtn) return;

    const isExpanded = deck.classList.contains('is-media-expanded');
    toggleBtn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    toggleBtn.setAttribute('aria-label', isExpanded ? 'Collapse media player' : 'Expand media player');
    toggleBtn.title = isExpanded ? 'Collapse player' : 'Expand player';
}

function togglePortalMediaPlayerExpanded() {
    const deck = document.getElementById('portal-floating-media-player-deck');
    if (!deck) return;

    deck.classList.toggle('is-media-expanded');
    syncPortalMediaPlayerExpandUI();
    if (typeof syncAchievementToastStackPosition === 'function') {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => syncAchievementToastStackPosition());
        });
    }
}

function ensurePortalMediaPlayerCollapsedByDefault() {
    const deck = document.getElementById('portal-floating-media-player-deck');
    if (!deck) return;
    deck.classList.remove('is-media-expanded');
    syncPortalMediaPlayerExpandUI();
}

window.togglePortalMediaPlayerExpanded = togglePortalMediaPlayerExpanded;
window.renderPortalMediaPlaylist = renderPortalMediaPlaylist;
window.mountPortalMediaPlayerForViewport = mountPortalMediaPlayerForViewport;
window.startPortalBackgroundMusic = startPortalBackgroundMusic;
window.applyPortalBackgroundMusicVolume = applyPortalBackgroundMusicVolume;
window.hydratePortalVolumeStateFromStorage = hydratePortalVolumeStateFromStorage;
window.switchMainPortalView = switchMainPortalView;
window.togglePortalMobileNavMenu = togglePortalMobileNavMenu;
window.togglePortalMobileCommanderSubmenu = togglePortalMobileCommanderSubmenu;
window.portalMobileNavSelectView = portalMobileNavSelectView;
window.portalMobileNavCommanderAction = portalMobileNavCommanderAction;
window.portalMobileNavAuthAction = portalMobileNavAuthAction;
window.syncPortalMobileNavIdentity = syncPortalMobileNavIdentity;
window.syncPortalMobileNavChrome = syncPortalMobileNavChrome;
window.syncPortalMobileNavMailboxIndicators = syncPortalMobileNavMailboxIndicators;
window.positionPortalMobileNavMenu = positionPortalMobileNavMenu;
window.triggerMainDashboardLogout = triggerMainDashboardLogout;
window.applyPortalNavAccessRestrictions = applyPortalNavAccessRestrictions;
window.applyPortalGuestDeploymentChrome = applyPortalGuestDeploymentChrome;
window.canUsePortalJoinAgeButtons = canUsePortalJoinAgeButtons;
window.applyPortalDeploymentDeckPresentation = applyPortalDeploymentDeckPresentation;
window.rejoinSelectedAgeServer = rejoinSelectedAgeServer;
window.launchGameRoundSector = launchGameRoundSector;
ensurePortalDeploymentServerPanelDelegation();
window.recacheAgePortalViewportSnapshot = recacheAgePortalViewportSnapshot;
window.isPortalNavViewAccessible = isPortalNavViewAccessible;
window.isPortalDevFullAccessBypassActive = isPortalDevFullAccessBypassActive;
window.closeMainLogoutConfirmationWindow = closeMainLogoutConfirmationWindow;
window.executeLogoutRedirect = executeLogoutRedirect;
window.notifyPortalAgeSessionLeave = notifyPortalAgeSessionLeave;
window.notifyPortalAgeSessionJoin = notifyPortalAgeSessionJoin;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        mountPortalMediaPlayerForViewport();
        ensurePortalMediaPlayerCollapsedByDefault();
    });
} else {
    mountPortalMediaPlayerForViewport();
    ensurePortalMediaPlayerCollapsedByDefault();
}